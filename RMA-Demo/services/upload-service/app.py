#!/usr/bin/env python3
"""
Upload Service
Handles document uploads, authentication, and client-specific file management
"""

import os
import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
import jwt
import hashlib
import json
import qrcode
from io import BytesIO
import base64
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Upload Service",
    description="Document upload and management with authentication",
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

security = HTTPBearer()

# Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'change-this-secret-key-in-production')
JWT_ALGORITHM = 'HS256'
UPLOAD_DIR = Path(os.getenv('UPLOAD_DIR', '/data/uploads'))
DOC_PROCESSOR_URL = os.getenv('DOC_PROCESSOR_URL', 'http://doc-processor:8101')


class LoginRequest(BaseModel):
    """Login request model."""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Token response model."""
    access_token: str
    token_type: str = "bearer"


class QRCodeRequest(BaseModel):
    """QR code generation request."""
    client_id: str
    client_name: str


class ClientDocument(BaseModel):
    """Client document model."""
    filename: str
    uploaded_at: str
    size: int
    markdown_path: Optional[str] = None


class UploadResponse(BaseModel):
    """Upload response model."""
    success: bool
    filename: str
    client_id: str
    markdown_available: bool
    message: str


# Simple user store (in production, use a real database)
USERS = {
    "admin": {
        "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
        "role": "admin"
    },
    "user": {
        "password_hash": hashlib.sha256("user123".encode()).hexdigest(),
        "role": "user"
    }
}


def create_access_token(username: str, expires_delta: timedelta = timedelta(hours=24)):
    """Create JWT access token."""
    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": username, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return username."""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def get_client_dir(client_id: str) -> Path:
    """Get or create client directory."""
    client_dir = UPLOAD_DIR / client_id
    client_dir.mkdir(parents=True, exist_ok=True)
    return client_dir


def get_client_metadata(client_id: str) -> dict:
    """Get client metadata."""
    metadata_file = get_client_dir(client_id) / "metadata.json"
    if metadata_file.exists():
        with open(metadata_file, 'r') as f:
            return json.load(f)
    return {"client_id": client_id, "documents": []}


def save_client_metadata(client_id: str, metadata: dict):
    """Save client metadata."""
    metadata_file = get_client_dir(client_id) / "metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)


async def process_document_to_markdown(file_path: Path) -> Optional[str]:
    """Process document using doc-processor service."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.name, f, 'application/octet-stream')}
                response = await client.post(f"{DOC_PROCESSOR_URL}/process", files=files)

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    return result.get('markdown')

        logger.warning(f"Document processing failed for {file_path}")
        return None

    except Exception as e:
        logger.error(f"Error processing document: {e}")
        return None


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Upload Service",
        "status": "healthy",
        "endpoints": {
            "/login": "POST - Login and get access token",
            "/generate-qr": "POST - Generate client QR code",
            "/uploads/{client_id}": "POST - Upload document for client",
            "/uploads/{client_id}": "GET - List client documents",
            "/uploads/{client_id}/{filename}": "GET - Download document",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login and get access token."""
    user = USERS.get(request.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    password_hash = hashlib.sha256(request.password.encode()).hexdigest()

    if password_hash != user["password_hash"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    access_token = create_access_token(request.username)

    return TokenResponse(access_token=access_token)


@app.post("/generate-qr")
async def generate_qr_code(
    request: QRCodeRequest,
    username: str = Depends(verify_token)
):
    """Generate QR code for client upload portal."""
    # Generate QR code URL
    base_url = os.getenv('APP_BASE_URL', 'http://localhost:3000')
    upload_url = f"{base_url}/uploads/{request.client_id}"

    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(upload_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    # Save client metadata
    metadata = get_client_metadata(request.client_id)
    metadata["client_name"] = request.client_name
    metadata["qr_generated_at"] = datetime.now().isoformat()
    save_client_metadata(request.client_id, metadata)

    return {
        "client_id": request.client_id,
        "client_name": request.client_name,
        "upload_url": upload_url,
        "qr_code_base64": img_str
    }


@app.post("/uploads/{client_id}", response_model=UploadResponse)
async def upload_document(
    client_id: str,
    file: UploadFile = File(...),
    username: str = Depends(verify_token)
):
    """Upload document for a client."""
    try:
        # Create client directory
        client_dir = get_client_dir(client_id)

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_name = Path(file.filename).stem
        extension = Path(file.filename).suffix
        unique_filename = f"{timestamp}_{original_name}{extension}"

        file_path = client_dir / unique_filename

        # Save file
        content = await file.read()
        with open(file_path, 'wb') as f:
            f.write(content)

        logger.info(f"Saved file: {file_path}")

        # Process to markdown
        markdown = await process_document_to_markdown(file_path)
        markdown_path = None

        if markdown:
            markdown_filename = f"{timestamp}_{original_name}.md"
            markdown_path = client_dir / markdown_filename
            with open(markdown_path, 'w') as f:
                f.write(markdown)
            logger.info(f"Saved markdown: {markdown_path}")

        # Update metadata
        metadata = get_client_metadata(client_id)
        metadata["documents"].append({
            "filename": unique_filename,
            "original_filename": file.filename,
            "uploaded_at": datetime.now().isoformat(),
            "uploaded_by": username,
            "size": len(content),
            "markdown_filename": markdown_filename if markdown else None
        })
        save_client_metadata(client_id, metadata)

        return UploadResponse(
            success=True,
            filename=unique_filename,
            client_id=client_id,
            markdown_available=markdown is not None,
            message="Document uploaded and processed successfully"
        )

    except Exception as e:
        logger.error(f"Error uploading document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading document: {str(e)}"
        )


@app.get("/uploads/{client_id}")
async def list_client_documents(
    client_id: str,
    username: str = Depends(verify_token)
):
    """List all documents for a client."""
    metadata = get_client_metadata(client_id)
    return {
        "client_id": client_id,
        "client_name": metadata.get("client_name", "Unknown"),
        "documents": metadata.get("documents", [])
    }


@app.get("/uploads/{client_id}/{filename}")
async def download_document(
    client_id: str,
    filename: str,
    username: str = Depends(verify_token)
):
    """Download a specific document."""
    file_path = get_client_dir(client_id) / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )


if __name__ == "__main__":
    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Upload directory: {UPLOAD_DIR}")
    logger.info("Starting Upload Service...")
    uvicorn.run(app, host="0.0.0.0", port=8103)
