#!/usr/bin/env python3
"""
OCR Service - Standalone Document-to-Markdown Conversion
Uses Ollama with vision models for document OCR and text extraction
Separates vision analysis from text generation LLM
"""

import os
import logging
import tempfile
import mimetypes
import base64
import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from typing import Optional, List
import pytesseract
from PIL import Image
import pdf2image
import io
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OCR Service",
    description="Standalone document-to-markdown OCR service using Ollama vision models",
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


class OCRRequest(BaseModel):
    """Request model for OCR processing."""
    method: str = "ollama"  # 'ollama' or 'tesseract'
    include_vision_analysis: bool = True


class OCRResponse(BaseModel):
    """Response model for OCR processing."""
    markdown: str
    method: str  # 'ollama_vision', 'tesseract', 'hybrid'
    pages: int
    success: bool
    error: Optional[str] = None
    processing_time: float = 0.0


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    ollama_available: bool
    vision_models: List[str]
    ocr_methods_available: List[str]


class OllamaOCRService:
    """Standalone OCR service using Ollama vision models."""

    def __init__(self):
        self.ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        self.vision_model = os.getenv('VISION_MODEL', 'llava-next:34b-v1.5-q4_K_M')
        self.fallback_model = os.getenv('FALLBACK_MODEL', 'llava:7b')
        self.tesseract_available = self._check_tesseract()
        self.ollama_available = False
        
        # Check Ollama availability
        self._check_ollama_health()
        
        logger.info(f"OCR Service initialized:")
        logger.info(f"  - Ollama URL: {self.ollama_url}")
        logger.info(f"  - Vision Model: {self.vision_model}")
        logger.info(f"  - Fallback Model: {self.fallback_model}")
        logger.info(f"  - Tesseract Available: {self.tesseract_available}")
        logger.info(f"  - Ollama Available: {self.ollama_available}")

    def _check_tesseract(self) -> bool:
        """Check if Tesseract is available."""
        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")
            return False

    def _check_ollama_health(self) -> bool:
        """Check if Ollama is available and models are loaded."""
        try:
            response = requests.get(
                f"{self.ollama_url}/api/tags",
                timeout=5
            )
            self.ollama_available = response.status_code == 200
            
            if self.ollama_available:
                logger.info("Ollama is available")
                # Try to pull vision model if not available
                self._ensure_model_available()
            
            return self.ollama_available
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            self.ollama_available = False
            return False

    def _ensure_model_available(self):
        """Ensure vision model is available, pull if needed."""
        try:
            # Check if model exists
            response = requests.get(
                f"{self.ollama_url}/api/show",
                json={"name": self.vision_model},
                timeout=10
            )
            
            if response.status_code != 200:
                logger.info(f"Model {self.vision_model} not found, attempting fallback")
                self.vision_model = self.fallback_model
                
                # Check fallback
                response = requests.get(
                    f"{self.ollama_url}/api/show",
                    json={"name": self.fallback_model},
                    timeout=10
                )
                
                if response.status_code != 200:
                    logger.warning(f"Neither {self.vision_model} nor fallback available")
                else:
                    logger.info(f"Using fallback model: {self.fallback_model}")
        except Exception as e:
            logger.warning(f"Could not verify model availability: {e}")

    def get_available_models(self) -> List[str]:
        """Get list of available Ollama models."""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get('models', [])
                return [m['name'] for m in models if 'vision' in m['name'].lower() or 'llava' in m['name'].lower()]
            return []
        except Exception as e:
            logger.warning(f"Could not retrieve model list: {e}")
            return []

    def ocr_image_with_ollama(self, image: Image.Image, model: Optional[str] = None) -> str:
        """OCR a single image using Ollama vision model."""
        if not self.ollama_available:
            raise RuntimeError("Ollama is not available")
        
        model = model or self.vision_model
        
        try:
            # Convert image to bytes
            image_bytes = io.BytesIO()
            image.save(image_bytes, format='PNG')
            image_base64 = base64.b64encode(image_bytes.getvalue()).decode('utf-8')
            
            # Call Ollama vision model
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": "Extract and transcribe all text from this document image. Format the output as structured markdown with proper headings and formatting.",
                    "images": [image_base64],
                    "stream": False,
                    "options": {
                        "temperature": 0.3,  # Lower temperature for more accurate OCR
                        "num_predict": 4096
                    }
                },
                timeout=120
            )
            
            if response.status_code != 200:
                raise RuntimeError(f"Ollama error: {response.text}")
            
            result = response.json()
            return result.get('response', '')
        
        except Exception as e:
            logger.error(f"Ollama OCR failed: {e}")
            raise

    def ocr_with_tesseract(self, file_path: str, mime_type: str) -> str:
        """OCR using Tesseract (CPU-based, good fallback)."""
        if not self.tesseract_available:
            raise RuntimeError("Tesseract is not available")
        
        try:
            images = []
            
            if mime_type == 'application/pdf':
                images = pdf2image.convert_from_path(file_path)
            elif mime_type.startswith('image/'):
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
            logger.info(f"Successfully processed {file_path} with Tesseract ({len(images)} pages)")
            return markdown
        
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            raise

    def ocr_hybrid(self, file_path: str, mime_type: str) -> tuple[str, str]:
        """
        Hybrid approach: Try Ollama vision first, fallback to Tesseract.
        Returns (markdown, method_used)
        """
        mime_type = mime_type or mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
        
        # Try Ollama vision first
        if self.ollama_available:
            try:
                logger.info(f"Attempting Ollama vision OCR with {self.vision_model}")
                
                # Convert document to images
                if mime_type == 'application/pdf':
                    images = pdf2image.convert_from_path(file_path)
                elif mime_type.startswith('image/'):
                    images = [Image.open(file_path)]
                else:
                    raise ValueError(f"Unsupported file type: {mime_type}")
                
                if not images:
                    raise ValueError("Could not extract images from document")
                
                # OCR each image
                text_blocks = []
                for i, image in enumerate(images):
                    logger.info(f"OCRing page {i + 1}/{len(images)} with {self.vision_model}")
                    text = self.ocr_image_with_ollama(image)
                    
                    if len(images) > 1:
                        text_blocks.append(f"## Page {i + 1}\n\n{text}")
                    else:
                        text_blocks.append(text)
                
                markdown = "\n\n---\n\n".join(text_blocks)
                logger.info(f"Successfully processed {file_path} with Ollama vision ({len(images)} pages)")
                return markdown, "ollama_vision"
            
            except Exception as e:
                logger.warning(f"Ollama vision OCR failed: {e}. Falling back to Tesseract.")
        
        # Fallback to Tesseract
        if self.tesseract_available:
            try:
                logger.info("Attempting Tesseract fallback OCR")
                markdown = self.ocr_with_tesseract(file_path, mime_type)
                return markdown, "tesseract"
            except Exception as e:
                logger.error(f"Tesseract fallback failed: {e}")
                raise RuntimeError("All OCR methods failed")
        
        raise RuntimeError("No OCR methods available (Ollama and Tesseract both failed)")

    def process_document(self, file_path: str, mime_type: Optional[str] = None, 
                        method: str = "hybrid") -> tuple[str, str, int]:
        """
        Process document to markdown.
        Returns (markdown, method_used, num_pages)
        """
        mime_type = mime_type or mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
        
        try:
            if method == "hybrid":
                markdown, method_used = self.ocr_hybrid(file_path, mime_type)
            elif method == "ollama":
                if not self.ollama_available:
                    raise RuntimeError("Ollama not available, cannot use ollama method")
                
                # Convert to images
                if mime_type == 'application/pdf':
                    images = pdf2image.convert_from_path(file_path)
                elif mime_type.startswith('image/'):
                    images = [Image.open(file_path)]
                else:
                    raise ValueError(f"Unsupported file type: {mime_type}")
                
                text_blocks = []
                for i, image in enumerate(images):
                    text = self.ocr_image_with_ollama(image)
                    if len(images) > 1:
                        text_blocks.append(f"## Page {i + 1}\n\n{text}")
                    else:
                        text_blocks.append(text)
                
                markdown = "\n\n---\n\n".join(text_blocks)
                method_used = "ollama_vision"
            
            elif method == "tesseract":
                if not self.tesseract_available:
                    raise RuntimeError("Tesseract not available, cannot use tesseract method")
                markdown = self.ocr_with_tesseract(file_path, mime_type)
                method_used = "tesseract"
            
            else:
                raise ValueError(f"Unknown method: {method}")
            
            # Count pages
            if mime_type == 'application/pdf':
                images = pdf2image.convert_from_path(file_path)
                num_pages = len(images)
            else:
                num_pages = 1
            
            return markdown, method_used, num_pages
        
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            raise


# Initialize service
ocr_service = OllamaOCRService()


# ============ API Endpoints ============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    methods = []
    if ocr_service.ollama_available:
        methods.append("ollama_vision")
    if ocr_service.tesseract_available:
        methods.append("tesseract")
    
    return HealthResponse(
        status="healthy" if methods else "degraded",
        ollama_available=ocr_service.ollama_available,
        vision_models=ocr_service.get_available_models(),
        ocr_methods_available=methods
    )


@app.post("/process", response_model=OCRResponse)
async def process_document(file: UploadFile = File(...), method: str = "hybrid"):
    """
    Process a document and return markdown.
    
    Methods:
    - 'hybrid': Try Ollama vision first, fallback to Tesseract
    - 'ollama': Use only Ollama vision (requires Ollama running)
    - 'tesseract': Use only Tesseract OCR
    """
    import time
    start_time = time.time()
    
    try:
        # Validate method
        if method not in ["hybrid", "ollama", "tesseract"]:
            raise HTTPException(status_code=400, detail=f"Unknown method: {method}")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            mime_type = file.content_type
            markdown, method_used, num_pages = ocr_service.process_document(
                tmp_path, 
                mime_type=mime_type,
                method=method
            )
            
            processing_time = time.time() - start_time
            
            return OCRResponse(
                markdown=markdown,
                method=method_used,
                pages=num_pages,
                success=True,
                processing_time=processing_time
            )
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        logger.error(f"Error processing document: {e}")
        processing_time = time.time() - start_time
        
        return OCRResponse(
            markdown="",
            method="unknown",
            pages=0,
            success=False,
            error=str(e),
            processing_time=processing_time
        )


@app.get("/models")
async def list_models():
    """List available Ollama models."""
    return {
        "models": ocr_service.get_available_models(),
        "current_vision_model": ocr_service.vision_model,
        "ollama_available": ocr_service.ollama_available
    }


@app.post("/models/set")
async def set_model(model_name: str):
    """Switch to a different vision model."""
    if not ocr_service.ollama_available:
        raise HTTPException(status_code=503, detail="Ollama not available")
    
    try:
        ocr_service.vision_model = model_name
        ocr_service._ensure_model_available()
        
        return {
            "status": "success",
            "current_model": ocr_service.vision_model
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    port = int(os.getenv("OCR_SERVICE_PORT", "8104"))
    uvicorn.run(app, host="0.0.0.0", port=port)
