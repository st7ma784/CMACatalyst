#!/usr/bin/env python3
"""
Document Processor Service - LOCAL PARSING VERSION
Processes uploaded documents using LOCAL LLMs (LLaVA vision model)
No cloud services - fully on-premises and GDPR compliant
"""

import os
import logging
import tempfile
import mimetypes
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from typing import Optional, Dict, Any
import json

# Import local parser
from local_parser import LocalDocumentParser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Document Processor Service (Local)",
    description="Convert documents using local LLMs - No cloud services",
    version="2.0.0"
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
    method: str
    success: bool
    classification: Optional[Dict[str, Any]] = None
    structured_data: Optional[Dict[str, Any]] = None
    total_pages: Optional[int] = None
    error: Optional[str] = None


class DocumentProcessor:
    """Service for processing documents with local LLMs."""

    def __init__(self):
        self.use_local_parsing = os.getenv('USE_LOCAL_PARSING', 'true').lower() == 'true'

        # Initialize local parser
        if self.use_local_parsing:
            try:
                self.local_parser = LocalDocumentParser()
                logger.info("Local document parser initialized (LLaVA + Ollama)")
            except Exception as e:
                logger.error(f"Failed to initialize local parser: {e}")
                self.use_local_parsing = False

        # LlamaParse fallback (if API key provided)
        self.llama_parse_api_key = os.getenv('LLAMA_PARSE_API_KEY', '')
        self.use_llamaparse = bool(self.llama_parse_api_key) and not self.use_local_parsing

        if self.use_llamaparse:
            try:
                from llama_parse import LlamaParse
                self.llama_parser = LlamaParse(
                    api_key=self.llama_parse_api_key,
                    result_type="markdown",
                    verbose=True
                )
                logger.warning("Using LlamaParse (cloud service) - consider switching to local parsing")
            except Exception as e:
                logger.warning(f"LlamaParse initialization failed: {e}")
                self.use_llamaparse = False

    def process_document(self, file_path: str, mime_type: str) -> ProcessResponse:
        """
        Process document using available methods.
        Priority: Local Vision LLM > LlamaParse > Tesseract
        """

        # Method 1: Local Vision LLM (Preferred)
        if self.use_local_parsing:
            try:
                logger.info(f"Processing with local vision LLM: {file_path}")
                result = self.local_parser.parse_document(file_path)

                return ProcessResponse(
                    markdown=result['text'],
                    method=result['method'],
                    success=True,
                    classification=result.get('classification'),
                    structured_data=result.get('structured_data'),
                    total_pages=result.get('total_pages')
                )

            except Exception as e:
                logger.error(f"Local parsing failed: {e}")
                # Fall through to next method

        # Method 2: LlamaParse (Cloud fallback)
        if self.use_llamaparse:
            try:
                logger.info(f"Processing with LlamaParse: {file_path}")
                documents = self.llama_parser.load_data(file_path)
                markdown_text = "\n\n".join([doc.text for doc in documents])

                return ProcessResponse(
                    markdown=markdown_text,
                    method="llamaparse_cloud",
                    success=True
                )

            except Exception as e:
                logger.error(f"LlamaParse failed: {e}")
                # Fall through to Tesseract

        # Method 3: Tesseract (Final fallback)
        try:
            logger.info(f"Processing with Tesseract fallback: {file_path}")
            markdown = self._process_with_tesseract(file_path, mime_type)

            return ProcessResponse(
                markdown=markdown,
                method="tesseract_fallback",
                success=True
            )

        except Exception as e:
            error_msg = f"All processing methods failed. Last error: {str(e)}"
            logger.error(error_msg)

            return ProcessResponse(
                markdown="",
                method="none",
                success=False,
                error=error_msg
            )

    def _process_with_tesseract(self, file_path: str, mime_type: str) -> str:
        """Tesseract OCR fallback."""
        import pytesseract
        from PIL import Image
        import pdf2image

        images = []

        if mime_type == 'application/pdf':
            images = pdf2image.convert_from_path(file_path)
        elif mime_type.startswith('image/'):
            images = [Image.open(file_path)]
        else:
            raise ValueError(f"Unsupported file type: {mime_type}")

        text_blocks = []
        for i, image in enumerate(images):
            text = pytesseract.image_to_string(image)
            if len(images) > 1:
                text_blocks.append(f"## Page {i + 1}\n\n{text}")
            else:
                text_blocks.append(text)

        return "\n\n---\n\n".join(text_blocks)


# Initialize processor
doc_processor = DocumentProcessor()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Document Processor Service (Local)",
        "version": "2.0.0",
        "status": "healthy",
        "parsing_methods": {
            "local_vision_llm": doc_processor.use_local_parsing,
            "llamaparse_cloud": doc_processor.use_llamaparse,
            "tesseract_fallback": True
        },
        "privacy": "Local processing - GDPR compliant" if doc_processor.use_local_parsing else "May use cloud services",
        "endpoints": {
            "/process": "POST - Process document to markdown",
            "/health": "GET - Health check",
            "/capabilities": "GET - Show available parsing methods"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "local_parsing": doc_processor.use_local_parsing,
        "llamaparse_available": doc_processor.use_llamaparse,
        "tesseract_available": True,
        "recommended_method": "local_vision_llm" if doc_processor.use_local_parsing else "tesseract"
    }


@app.get("/capabilities")
async def get_capabilities():
    """Show available document processing capabilities."""
    capabilities = {
        "local_vision_llm": {
            "available": doc_processor.use_local_parsing,
            "features": [
                "Document classification",
                "Structured data extraction",
                "Table understanding",
                "Form field extraction",
                "Layout preservation",
                "Complex layouts",
                "Privacy-first (on-premises)"
            ],
            "speed": "30-60s per page with GPU",
            "quality": "Excellent",
            "cost": "Free (local processing)"
        },
        "llamaparse_cloud": {
            "available": doc_processor.use_llamaparse,
            "features": [
                "Advanced PDF parsing",
                "Table extraction",
                "Layout understanding"
            ],
            "speed": "Fast (cloud)",
            "quality": "Excellent",
            "cost": "$0.003 per page",
            "privacy_warning": "Sends documents to external cloud service"
        },
        "tesseract_fallback": {
            "available": True,
            "features": [
                "Basic OCR",
                "Text extraction",
                "Simple layouts"
            ],
            "speed": "10-30s per page",
            "quality": "Fair",
            "cost": "Free (local)"
        }
    }

    return {
        "capabilities": capabilities,
        "active_method": (
            "local_vision_llm" if doc_processor.use_local_parsing
            else "llamaparse_cloud" if doc_processor.use_llamaparse
            else "tesseract_fallback"
        ),
        "recommendation": "Enable USE_LOCAL_PARSING=true for best privacy and quality"
    }


@app.post("/process", response_model=ProcessResponse)
async def process_document(file: UploadFile = File(...)):
    """Process uploaded document to markdown with classification and structure."""
    temp_file_path = None

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
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

        if not result.success:
            raise HTTPException(status_code=500, detail=result.error)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing document: {e}")
        # Cleanup on error
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Document Processor Service (Local Version)")
    logger.info("=" * 60)

    if doc_processor.use_local_parsing:
        logger.info("✅ Using LOCAL vision LLM (LLaVA) - Privacy-first")
        logger.info("   All documents processed on-premises")
        logger.info("   GDPR compliant - No external API calls")
    elif doc_processor.use_llamaparse:
        logger.warning("⚠️  Using LlamaParse (cloud service)")
        logger.warning("   Documents sent to external servers")
        logger.warning("   Consider enabling USE_LOCAL_PARSING=true")
    else:
        logger.info("Using Tesseract fallback only")

    logger.info("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8101)
