#!/usr/bin/env python3
"""
Document Processor Service - Updated to use standalone OCR Service
Processes uploaded documents (PDF, images) into markdown
Uses LLamaParse (primary), OCR Service (secondary), and Tesseract (fallback)
"""

import os
import logging
import tempfile
import mimetypes
import requests
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from typing import Optional
import sys

# Add parent directory to path to import llm_provider
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Document Processor Service",
    description="Convert documents to markdown using LLamaParse (primary), OCR Service (secondary), and Tesseract (fallback)",
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
    method: str  # 'llamaparse', 'ocr_service', 'tesseract'
    pages: int = 0
    success: bool
    error: Optional[str] = None
    processing_time: float = 0.0


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    llamaparse_available: bool
    ocr_service_available: bool
    processing_methods: list


class DocumentProcessor:
    """Service for processing documents to markdown."""

    def __init__(self):
        import time
        self.start_time = time.time()
        
        # LLamaParse configuration
        self.llama_parse_api_key = os.getenv('LLAMA_PARSE_API_KEY', '')
        self.use_llamaparse = bool(self.llama_parse_api_key)
        self.llama_parser = None
        
        if self.use_llamaparse:
            try:
                from llama_parse import LlamaParse
                self.llama_parser = LlamaParse(
                    api_key=self.llama_parse_api_key,
                    result_type="markdown",
                    verbose=True
                )
                logger.info("✓ LlamaParse initialized successfully")
            except Exception as e:
                logger.warning(f"✗ LlamaParse initialization failed: {e}")
                self.use_llamaparse = False
        else:
            logger.info("⚠ LlamaParse API key not configured. Using OCR Service / Tesseract fallback.")
        
        # OCR Service configuration
        self.ocr_service_url = os.getenv('OCR_SERVICE_URL', 'http://ocr-service:8104')
        self.ocr_service_available = self._check_ocr_service()
        
        logger.info(f"Document Processor initialized:")
        logger.info(f"  - LlamaParse: {'✓ Available' if self.use_llamaparse else '✗ Not available'}")
        logger.info(f"  - OCR Service: {'✓ Available' if self.ocr_service_available else '✗ Not available'}")
        logger.info(f"  - Startup time: {time.time() - self.start_time:.2f}s")

    def _check_ocr_service(self) -> bool:
        """Check if OCR service is available."""
        try:
            response = requests.get(
                f"{self.ocr_service_url}/health",
                timeout=5
            )
            is_available = response.status_code == 200
            if is_available:
                logger.info(f"✓ OCR Service available at {self.ocr_service_url}")
            return is_available
        except Exception as e:
            logger.warning(f"✗ OCR Service check failed: {e}")
            return False

    def process_with_llamaparse(self, file_path: str) -> str:
        """Process document with LlamaParse."""
        if not self.llama_parser:
            raise RuntimeError("LlamaParse not initialized")
        
        try:
            logger.info(f"Processing with LlamaParse: {file_path}")
            documents = self.llama_parser.load_data(file_path)
            markdown_text = "\n\n".join([doc.text for doc in documents])
            logger.info(f"✓ LlamaParse processing successful")
            return markdown_text
        except Exception as e:
            logger.error(f"✗ LlamaParse processing failed: {e}")
            raise

    def process_with_ocr_service(self, file_path: str) -> tuple[str, str, int]:
        """
        Process document with standalone OCR Service.
        Returns (markdown, method_used, num_pages)
        """
        if not self.ocr_service_available:
            raise RuntimeError("OCR Service not available")
        
        try:
            logger.info(f"Processing with OCR Service: {file_path}")
            
            # Upload file to OCR service
            with open(file_path, 'rb') as f:
                files = {'file': f}
                response = requests.post(
                    f"{self.ocr_service_url}/process",
                    files=files,
                    params={'method': 'hybrid'},
                    timeout=300  # OCR can take time
                )
            
            if response.status_code != 200:
                raise RuntimeError(f"OCR Service error: {response.text}")
            
            result = response.json()
            
            if not result.get('success'):
                raise RuntimeError(f"OCR Service failed: {result.get('error')}")
            
            logger.info(f"✓ OCR Service processing successful ({result.get('method')}, {result.get('pages')} pages)")
            return result['markdown'], result['method'], result.get('pages', 1)
        
        except Exception as e:
            logger.error(f"✗ OCR Service processing failed: {e}")
            raise

    def process_with_tesseract(self, file_path: str, mime_type: str) -> tuple[str, int]:
        """Process document with Tesseract OCR (local fallback)."""
        try:
            logger.info(f"Processing with Tesseract: {file_path}")
            
            import pytesseract
            from PIL import Image
            import pdf2image
            
            images = []

            if mime_type == 'application/pdf':
                # Convert PDF to images
                images = pdf2image.convert_from_path(file_path)
            elif mime_type.startswith('image/'):
                # Open image directly
                images = [Image.open(file_path)]
            else:
                raise ValueError(f"Unsupported file type: {mime_type}")

            if not images:
                raise ValueError("Could not extract images from document")

            # OCR each image
            text_blocks = []
            for i, image in enumerate(images):
                text = pytesseract.image_to_string(image)
                if len(images) > 1:
                    text_blocks.append(f"## Page {i + 1}\n\n{text}")
                else:
                    text_blocks.append(text)

            markdown = "\n\n---\n\n".join(text_blocks)
            logger.info(f"✓ Tesseract processing successful ({len(images)} pages)")
            return markdown, len(images)

        except Exception as e:

    def process_document(self, file_path: str, mime_type: Optional[str] = None) -> ProcessResponse:
        """
        Process document to markdown.
        Tries LlamaParse first, then OCR Service, then Tesseract.
        """
        import time
        start_time = time.time()
        
        mime_type = mime_type or mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
        
        try:
            # Try LlamaParse first
            if self.use_llamaparse:
                try:
                    markdown = self.process_with_llamaparse(file_path)
                    processing_time = time.time() - start_time
                    
                    # Get page count if possible
                    try:
                        import pdf2image
                        if mime_type == 'application/pdf':
                            images = pdf2image.convert_from_path(file_path)
                            pages = len(images)
                        else:
                            pages = 1
                    except:
                        pages = 0
                    
                    return ProcessResponse(
                        markdown=markdown,
                        method="llamaparse",
                        pages=pages,
                        success=True,
                        processing_time=processing_time
                    )
                except Exception as e:
                    logger.warning(f"LlamaParse failed: {e}. Trying OCR Service...")

            # Try OCR Service second
            if self.ocr_service_available:
                try:
                    markdown, method, pages = self.process_with_ocr_service(file_path)
                    processing_time = time.time() - start_time
                    
                    return ProcessResponse(
                        markdown=markdown,
                        method=method,
                        pages=pages,
                        success=True,
                        processing_time=processing_time
                    )
                except Exception as e:
                    logger.warning(f"OCR Service failed: {e}. Trying Tesseract...")

            # Fallback to Tesseract
            try:
                logger.info("Falling back to Tesseract")
                markdown, pages = self.process_with_tesseract(file_path, mime_type)
                processing_time = time.time() - start_time
                
                return ProcessResponse(
                    markdown=markdown,
                    method="tesseract",
                    pages=pages,
                    success=True,
                    processing_time=processing_time
                )
            except Exception as e:
                error_msg = f"Tesseract failed: {str(e)}"
                logger.error(error_msg)
                processing_time = time.time() - start_time
                
                return ProcessResponse(
                    markdown="",
                    method="none",
                    pages=0,
                    success=False,
                    error=error_msg,
                    processing_time=processing_time
                )

        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            
            return ProcessResponse(
                markdown="",
                method="none",
                pages=0,
                success=False,
                error=error_msg,
                processing_time=processing_time
            )


# Initialize processor
doc_processor = DocumentProcessor()


# ============ API Endpoints ============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    methods = []
    if doc_processor.use_llamaparse:
        methods.append("llamaparse")
    if doc_processor.ocr_service_available:
        methods.append("ocr_service")
    methods.append("tesseract")  # Always available
    
    return HealthResponse(
        status="healthy",
        llamaparse_available=doc_processor.use_llamaparse,
        ocr_service_available=doc_processor.ocr_service_available,
        processing_methods=methods
    )


@app.post("/process", response_model=ProcessResponse)
async def process_document(file: UploadFile = File(...)):
    """
    Process a document and return markdown.
    
    Tries methods in order:
    1. LlamaParse (premium, most accurate)
    2. Standalone OCR Service (free, Ollama-based)
    3. Tesseract (local OCR, always available)
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            mime_type = file.content_type
            response = doc_processor.process_document(tmp_path, mime_type=mime_type)
            return response
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        logger.error(f"Error processing document: {e}")
        return ProcessResponse(
            markdown="",
            method="none",
            pages=0,
            success=False,
            error=str(e)
        )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Document Processor Service v2.0",
        "description": "Convert documents to markdown (LlamaParse → OCR Service → Tesseract)",
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "process": "/process"
        }
    }


if __name__ == "__main__":
    port = int(os.getenv("DOC_PROCESSOR_PORT", "8101"))
    uvicorn.run(app, host="0.0.0.0", port=port)
