#!/usr/bin/env python3
"""
Document Extraction Service - Bridge to External OCR/Extraction Services
Provides unified interface to containerized extraction tools:
  - Primary: MarkItDown (Microsoft) - comprehensive file format support
  - Secondary: OlmoOCR2 (fallback if available)
  - Other: Marker, Llama Parse, PaddleOCR, DocTR (configurable)
"""
import os
import io
import logging
import base64
import requests
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize app
app = FastAPI(
    title="Document Extraction Service",
    version="2.0.0",
    description="Multi-backend document extraction with MarkItDown + OlmoOCR2 fallback"
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration - delegate to external services
# Primary: MarkItDown (marker), Fallback: OlmoOCR2 or others
BACKEND_SERVICE = os.getenv("BACKEND_SERVICE", "markitdown")  # markitdown, olmocr2, marker, llamaparse, paddle
BACKEND_URL = os.getenv("BACKEND_URL", "http://markitdown:8080")  # adjust based on backend
FALLBACK_SERVICE = os.getenv("FALLBACK_SERVICE", "olmocr2")  # fallback if primary fails
FALLBACK_URL = os.getenv("FALLBACK_URL", "http://olmocr2:8000")  # fallback URL

class ExtractionResponse(BaseModel):
    success: bool
    text: str
    extraction_type: str
    page_count: int
    confidence: float = 0.85
    backend_used: str = "unknown"

async def try_extraction(url: str, files, data, service_name: str):
    """Try extraction with given backend"""
    try:
        logger.info(f"Attempting extraction with {service_name} at {url}")
        response = requests.post(
            f"{url}/extract",
            files=files,
            data=data,
            timeout=300
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Successfully extracted with {service_name}")
            return result, service_name
        else:
            logger.warning(f"{service_name} returned status {response.status_code}")
            return None, service_name
            
    except requests.exceptions.RequestException as e:
        logger.warning(f"{service_name} connection failed: {e}")
        return None, service_name

@app.get("/health")
async def health_check():
    """Health check endpoint - check primary and fallback services"""
    primary_healthy = False
    fallback_healthy = False
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        primary_healthy = response.status_code == 200
        logger.info(f"Primary backend ({BACKEND_SERVICE}): {'✓ HEALTHY' if primary_healthy else '✗ DOWN'}")
    except Exception as e:
        logger.warning(f"Primary health check failed ({BACKEND_SERVICE}): {e}")
    
    try:
        response = requests.get(f"{FALLBACK_URL}/health", timeout=5)
        fallback_healthy = response.status_code == 200
        logger.info(f"Fallback backend ({FALLBACK_SERVICE}): {'✓ HEALTHY' if fallback_healthy else '✗ DOWN'}")
    except Exception as e:
        logger.warning(f"Fallback health check failed ({FALLBACK_SERVICE}): {e}")
    
    overall_status = "healthy" if primary_healthy else ("degraded" if fallback_healthy else "unhealthy")
    
    return {
        "status": overall_status,
        "service": "document-extraction",
        "primary_backend": BACKEND_SERVICE,
        "primary_url": BACKEND_URL,
        "primary_available": primary_healthy,
        "fallback_backend": FALLBACK_SERVICE,
        "fallback_url": FALLBACK_URL,
        "fallback_available": fallback_healthy,
        "note": "Uses primary backend; falls back to fallback if primary fails"
    }

@app.post("/extract/upload", response_model=ExtractionResponse)
async def extract_from_upload(
    file: UploadFile = File(...),
    extraction_type: str = Form("full")
):
    """Extract from uploaded file (PDF or image) - tries primary, falls back to fallback"""
    try:
        contents = await file.read()
        filename = file.filename or "document"
        
        files = {'file': (filename, io.BytesIO(contents), file.content_type)}
        data = {'extraction_type': extraction_type}
        
        # Try primary backend first
        result, backend = await try_extraction(
            BACKEND_URL, files, data, BACKEND_SERVICE
        )
        
        if result is None:
            logger.info(f"Primary backend ({BACKEND_SERVICE}) failed, trying fallback ({FALLBACK_SERVICE})")
            # Reset file pointer for fallback attempt
            files = {'file': (filename, io.BytesIO(contents), file.content_type)}
            result, backend = await try_extraction(
                FALLBACK_URL, files, data, FALLBACK_SERVICE
            )
        
        if result is not None:
            return ExtractionResponse(
                success=result.get('success', True),
                text=result.get('text', ''),
                extraction_type=extraction_type,
                page_count=result.get('page_count', 1),
                confidence=result.get('confidence', 0.85),
                backend_used=backend
            )
        else:
            logger.error("All extraction backends failed")
            raise HTTPException(
                status_code=503,
                detail=f"All extraction backends unavailable. Primary: {BACKEND_SERVICE}, Fallback: {FALLBACK_SERVICE}"
            )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload extraction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract", response_model=ExtractionResponse)
async def extract_from_base64(
    data: str = Form(...),
    extraction_type: str = Form("full")
):
    """Extract from base64-encoded image - tries primary, falls back to fallback"""
    try:
        # Decode image data
        image_data = base64.b64decode(data)
        
        files = {'file': ('image.jpg', io.BytesIO(image_data), 'image/jpeg')}
        data_form = {'extraction_type': extraction_type}
        
        # Try primary backend first
        result, backend = await try_extraction(
            BACKEND_URL, files, data_form, BACKEND_SERVICE
        )
        
        if result is None:
            logger.info(f"Primary backend ({BACKEND_SERVICE}) failed, trying fallback ({FALLBACK_SERVICE})")
            # Reset file pointer for fallback attempt
            files = {'file': ('image.jpg', io.BytesIO(image_data), 'image/jpeg')}
            result, backend = await try_extraction(
                FALLBACK_URL, files, data_form, FALLBACK_SERVICE
            )
        
        if result is not None:
            return ExtractionResponse(
                success=result.get('success', True),
                text=result.get('text', ''),
                extraction_type=extraction_type,
                page_count=result.get('page_count', 1),
                confidence=result.get('confidence', 0.85),
                backend_used=backend
            )
        else:
            raise HTTPException(
                status_code=503,
                detail=f"All extraction backends unavailable. Primary: {BACKEND_SERVICE}, Fallback: {FALLBACK_SERVICE}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def list_models():
    """List available models and backend configuration"""
    return {
        "primary_backend": BACKEND_SERVICE,
        "primary_url": BACKEND_URL,
        "fallback_backend": FALLBACK_SERVICE,
        "fallback_url": FALLBACK_URL,
        "note": "Uses primary backend for extraction; automatically falls back to fallback if primary unavailable",
        "supported_formats": ["PDF", "JPG", "PNG", "TIFF", "WEBP", "Word", "Excel", "PowerPoint"],
        "extraction_types": ["full", "text_only", "tables", "key_info"],
        "backends": {
            "markitdown": "Microsoft MarkItDown - comprehensive file format support (RECOMMENDED)",
            "olmocr2": "OlmoOCR2 - fallback OCR solution",
            "marker": "Marker - PDF/image focused extraction",
            "llamaparse": "LlamaParse - cloud/self-hosted extraction",
            "paddle": "PaddleOCR - lightweight OCR"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8007))
    logger.info(f"Starting Document Extraction Service on port {port}")
    logger.info(f"Primary Backend: {BACKEND_SERVICE} at {BACKEND_URL}")
    logger.info(f"Fallback Backend: {FALLBACK_SERVICE} at {FALLBACK_URL}")
    logger.info("Multi-backend extraction with automatic failover enabled")
    logger.info("Configure via environment variables:")
    logger.info("  - BACKEND_SERVICE (default: markitdown)")
    logger.info("  - BACKEND_URL (default: http://markitdown:8080)")
    logger.info("  - FALLBACK_SERVICE (default: olmocr2)")
    logger.info("  - FALLBACK_URL (default: http://olmocr2:8000)")
    uvicorn.run(app, host="0.0.0.0", port=port)
