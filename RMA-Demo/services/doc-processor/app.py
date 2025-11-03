#!/usr/bin/env python3
"""
Document Processor Service
Processes uploaded documents (PDF, images) into markdown using LLamaParse (primary) and Tesseract (fallback)
"""

import os
import logging
import tempfile
import mimetypes
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from typing import Optional
import pytesseract
from PIL import Image
import pdf2image
import io
import sys

# Add parent directory to path to import llm_provider
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rag_service.llm_provider import get_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Document Processor Service",
    description="Convert documents to markdown using LLamaParse (primary) and Tesseract (fallback)",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessResponse(BaseModel):
    """Response model for document processing."""
    markdown: str
    method: str  # 'llamaparse' or 'tesseract'
    success: bool
    error: Optional[str] = None


class DocumentProcessor:
    """Service for processing documents to markdown."""

    def __init__(self):
        self.llama_parse_api_key = os.getenv('LLAMA_PARSE_API_KEY', '')
        self.use_llamaparse = bool(self.llama_parse_api_key)
        
        # Initialize vision provider (Ollama with llava:7b for visual analysis)
        self.use_vision_analysis = os.getenv('USE_VISION_ANALYSIS', 'true').lower() == 'true'
        self.vision_provider = None
        self.vision_model = 'llava:7b'
        
        if self.use_vision_analysis:
            try:
                self.vision_provider = get_provider()
                logger.info(f"Vision provider initialized: {self.vision_provider.__class__.__name__}")
            except Exception as e:
                logger.warning(f"Vision provider initialization failed: {e}. Will use document text extraction only.")
                self.use_vision_analysis = False

        if self.use_llamaparse:
            try:
                from llama_parse import LlamaParse
                self.llama_parser = LlamaParse(
                    api_key=self.llama_parse_api_key,
                    result_type="markdown",
                    verbose=True
                )
                logger.info("LlamaParse initialized successfully")
            except Exception as e:
                logger.warning(f"LlamaParse initialization failed: {e}. Will use Tesseract fallback.")
                self.use_llamaparse = False
        else:
            logger.info("LlamaParse API key not provided. Using Tesseract only.")

    def process_with_llamaparse(self, file_path: str) -> str:
        """Process document with LlamaParse."""
        try:
            documents = self.llama_parser.load_data(file_path)
            markdown_text = "\n\n".join([doc.text for doc in documents])
            logger.info(f"Successfully processed {file_path} with LlamaParse")
            return markdown_text
        except Exception as e:
            logger.error(f"LlamaParse processing failed: {e}")
            raise

    def process_with_tesseract(self, file_path: str, mime_type: str) -> str:
        """Process document with Tesseract OCR (fallback)."""
        try:
            images = []

            if mime_type == 'application/pdf':
                # Convert PDF to images
                images = pdf2image.convert_from_path(file_path)
            elif mime_type.startswith('image/'):
                # Open image directly
                images = [Image.open(file_path)]
            else:
                raise ValueError(f"Unsupported file type: {mime_type}")

            # OCR each image
            text_blocks = []
            for i, image in enumerate(images):
                text = pytesseract.image_to_string(image)
                if len(images) > 1:
                    text_blocks.append(f"## Page {i + 1}\n\n{text}")
                else:
                    text_blocks.append(text)

            markdown = "\n\n---\n\n".join(text_blocks)
            logger.info(f"Successfully processed {file_path} with Tesseract")
            return markdown

        except Exception as e:
            logger.error(f"Tesseract processing failed: {e}")
            raise

    def enhance_with_vision_analysis(self, file_path: str, extracted_text: str, mime_type: str) -> str:
        """
        Enhance extracted text with vision analysis using Ollama's llava:7b model.
        This is optional and improves accuracy for complex documents with diagrams/tables.
        """
        if not self.use_vision_analysis or not self.vision_provider:
            return extracted_text
        
        try:
            # For vision analysis, we convert documents to images
            images = []
            if mime_type == 'application/pdf':
                images = pdf2image.convert_from_path(file_path)
            elif mime_type.startswith('image/'):
                images = [Image.open(file_path)]
            else:
                return extracted_text
            
            if not images:
                return extracted_text
            
            # Use vision provider to analyze images
            # This provides additional context that might be missed by OCR
            enhanced_analysis = []
            
            # Only analyze first 3 pages to avoid excessive processing
            for i, image in enumerate(images[:3]):
                try:
                    # Convert image to bytes for vision model
                    import base64
                    from io import BytesIO
                    
                    buffered = BytesIO()
                    image.save(buffered, format="PNG")
                    img_b64 = base64.b64encode(buffered.getvalue()).decode()
                    
                    # Get vision provider client
                    import ollama
                    ollama_client = ollama.Client(host=os.getenv('OLLAMA_URL', 'http://ollama:11434'))
                    
                    # Request visual analysis
                    response = ollama_client.generate(
                        model=self.vision_model,
                        prompt="Describe the structure, layout, and any diagrams or tables you see in this document image. Focus on elements that text extraction might miss.",
                        images=[img_b64],
                        stream=False
                    )
                    
                    if response and 'response' in response:
                        vision_insight = response['response'].strip()
                        if vision_insight:
                            enhanced_analysis.append(f"### Visual Analysis (Page {i+1}):\n{vision_insight}")
                
                except Exception as e:
                    logger.debug(f"Vision analysis for page {i+1} failed: {e}")
                    continue
            
            # Combine OCR text with vision analysis
            if enhanced_analysis:
                return extracted_text + "\n\n" + "\n\n".join(enhanced_analysis)
            
            return extracted_text
            
        except Exception as e:
            logger.warning(f"Vision analysis enhancement failed: {e}. Returning extracted text only.")
            return extracted_text

    def process_document(self, file_path: str, mime_type: str) -> ProcessResponse:
        """
        Process document to markdown.
        Tries LlamaParse first, falls back to Tesseract, optionally enhances with vision analysis.
        """
        markdown = ""
        method = "none"
        success = False
        error = None

        # Try LlamaParse first
        if self.use_llamaparse:
            try:
                markdown = self.process_with_llamaparse(file_path)
                method = "llamaparse"
                success = True
                # Optionally enhance with vision analysis
                if self.use_vision_analysis:
                    markdown = self.enhance_with_vision_analysis(file_path, markdown, mime_type)
                return ProcessResponse(markdown=markdown, method=method, success=success)
            except Exception as e:
                logger.warning(f"LlamaParse failed, trying Tesseract: {e}")
                error = str(e)

        # Fallback to Tesseract
        try:
            markdown = self.process_with_tesseract(file_path, mime_type)
            method = "tesseract"
            # Optionally enhance with vision analysis
            if self.use_vision_analysis:
                markdown = self.enhance_with_vision_analysis(file_path, markdown, mime_type)
            success = True
            return ProcessResponse(markdown=markdown, method=method, success=success)
        except Exception as e:
            error_msg = f"All processing methods failed. Last error: {str(e)}"
            logger.error(error_msg)
            return ProcessResponse(
                markdown="",
                method="none",
                success=False,
                error=error_msg
            )


# Initialize processor
doc_processor = DocumentProcessor()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Document Processor Service",
        "status": "healthy",
        "llamaparse_available": doc_processor.use_llamaparse,
        "vision_analysis_available": doc_processor.use_vision_analysis,
        "vision_provider": doc_processor.vision_provider.__class__.__name__ if doc_processor.vision_provider else None,
        "endpoints": {
            "/process": "POST - Process document to markdown",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "llamaparse_available": doc_processor.use_llamaparse,
        "tesseract_available": True,
        "vision_analysis_available": doc_processor.use_vision_analysis
    }


@app.post("/process", response_model=ProcessResponse)
async def process_document(file: UploadFile = File(...)):
    """Process uploaded document to markdown."""
    temp_file = None

    try:
        # Determine mime type
        mime_type = file.content_type or mimetypes.guess_type(file.filename)[0]

        if not mime_type:
            raise HTTPException(status_code=400, detail="Could not determine file type")

        # Supported types
        supported_types = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/tiff']
        if mime_type not in supported_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {mime_type}. Supported: {supported_types}"
            )

        # Save uploaded file to temp location
        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # Process document
        result = doc_processor.process_document(temp_file_path, mime_type)

        # Cleanup
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

        if not result.success:
            raise HTTPException(status_code=500, detail=result.error)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


if __name__ == "__main__":
    logger.info("Starting Document Processor Service...")
    uvicorn.run(app, host="0.0.0.0", port=8101)
