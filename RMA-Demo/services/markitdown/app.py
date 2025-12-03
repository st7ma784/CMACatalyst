#!/usr/bin/env python3
"""
MarkItDown Service Wrapper
Wraps Microsoft's MarkItDown in a FastAPI service
Compatible with our document extraction bridge at port 8007

Supports: PDF, DOCX, PPTX, XLSX, XLS, Images (with OCR), HTML, CSV, JSON, XML, ZIP, YouTube URLs, ePub
"""
import os
import io
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from markitdown import MarkItDown
    MARKITDOWN_AVAILABLE = True
except ImportError:
    logger.warning("MarkItDown not installed")
    MARKITDOWN_AVAILABLE = False

# Initialize FastAPI app
app = FastAPI(
    title="MarkItDown Service",
    version="1.0.0",
    description="Document extraction service using Microsoft MarkItDown"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ExtractionResponse(BaseModel):
    success: bool
    text: str
    page_count: int = 1
    confidence: float = 0.95
    format: Optional[str] = None

# Initialize MarkItDown converter
converter = None
if MARKITDOWN_AVAILABLE:
    try:
        converter = MarkItDown()
        logger.info("✓ MarkItDown initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize MarkItDown: {e}")
        MARKITDOWN_AVAILABLE = False

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    status = "healthy" if MARKITDOWN_AVAILABLE and converter else "unhealthy"
    return {
        "status": status,
        "service": "markitdown",
        "available": MARKITDOWN_AVAILABLE,
        "supported_formats": [
            "PDF", "DOCX", "PPTX", "XLSX", "XLS",
            "Images (JPG, PNG, GIF, BMP, TIFF, WEBP)",
            "HTML", "CSV", "JSON", "XML", "ZIP",
            "YouTube URLs", "ePub", "Markdown"
        ]
    }

@app.post("/extract", response_model=ExtractionResponse)
async def extract(
    file: UploadFile = File(...),
    extraction_type: str = Form("full")
):
    """
    Extract document using MarkItDown
    
    Args:
        file: Document file (PDF, Word, Excel, PowerPoint, Image, HTML, CSV, JSON, XML, ZIP, YouTube URL, ePub)
        extraction_type: Type of extraction (full, text_only, tables, key_info)
    
    Returns:
        Extracted content as Markdown text with metadata
    """
    if not MARKITDOWN_AVAILABLE or not converter:
        raise HTTPException(status_code=503, detail="MarkItDown service not available")
    
    try:
        # Read file contents
        contents = await file.read()
        filename = file.filename or "document"
        
        logger.info(f"Processing: {filename} ({len(contents)} bytes, type: {file.content_type})")
        
        # Convert to MarkItDown using stream API
        result = converter.convert_stream(io.BytesIO(contents))
        
        # Extract text and metadata
        text = result.text_content
        metadata = result.metadata or {}
        
        # Determine file type/format
        file_ext = os.path.splitext(filename)[1].lower()
        file_format = file_ext[1:] if file_ext else "unknown"
        
        logger.info(f"✓ Extraction successful: {len(text)} characters, format: {file_format}")
        
        return ExtractionResponse(
            success=True,
            text=text,
            page_count=metadata.get('page_count', 1),
            confidence=0.95,  # MarkItDown is very reliable
            format=file_format
        )
        
    except Exception as e:
        logger.error(f"✗ Extraction error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"MarkItDown extraction failed: {str(e)}"
        )

@app.get("/models")
async def list_models():
    """List supported models and file formats"""
    return {
        "service": "markitdown",
        "version": "0.1.3",
        "status": "healthy" if MARKITDOWN_AVAILABLE else "unavailable",
        "supported_formats": {
            "documents": ["PDF", "Word (DOCX)", "Excel (XLSX, XLS)", "PowerPoint (PPTX)"],
            "office": ["Outlook (MSG)"],
            "images": ["JPG", "PNG", "GIF", "BMP", "TIFF", "WEBP"],
            "data": ["CSV", "JSON", "XML"],
            "web": ["HTML", "YouTube URLs"],
            "archives": ["ZIP"],
            "ebooks": ["ePub", "Markdown"]
        },
        "extraction_types": ["full", "text_only", "tables", "key_info"],
        "output_format": "Markdown",
        "features": {
            "ocr": True,
            "table_preservation": True,
            "link_preservation": True,
            "metadata_extraction": True,
            "streaming": True
        },
        "note": "Optimized for LLM consumption with token-efficient Markdown output"
    }

@app.get("/")
async def root():
    """Service information"""
    return {
        "service": "MarkItDown Document Extraction",
        "version": "1.0.0",
        "description": "Microsoft MarkItDown wrapper for FastAPI",
        "endpoints": {
            "health": "GET /health",
            "extract": "POST /extract",
            "models": "GET /models"
        },
        "documentation": "POST /extract with file parameter"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting MarkItDown Service on port {port}")
    logger.info("Supported formats: PDF, Word, Excel, PowerPoint, Images (with OCR), HTML, CSV, JSON, XML, ZIP, YouTube URLs, ePub")
    logger.info("Output format: Markdown (optimized for LLMs)")
    uvicorn.run(app, host="0.0.0.0", port=port)
