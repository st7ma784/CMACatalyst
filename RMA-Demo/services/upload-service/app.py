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
from contextlib import asynccontextmanager
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
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'change-this-secret-key-in-production')
JWT_ALGORITHM = 'HS256'
UPLOAD_DIR = Path(os.getenv('UPLOAD_DIR', '/data/uploads'))
DOC_PROCESSOR_URL = os.getenv('DOC_PROCESSOR_URL', 'http://doc-processor:8101')
CLIENT_RAG_URL = os.getenv('CLIENT_RAG_URL', 'http://client-rag-service:8104')
RAG_SERVICE_URL = os.getenv('RAG_SERVICE_URL', 'http://rag-service:8102')


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


class ClientQueryRequest(BaseModel):
    """Request model for querying client documents."""
    client_id: str
    question: str
    model: str = "llama3.2"


class ClientQueryResponse(BaseModel):
    """Response model for client document queries."""
    answer: str
    sources: List[dict]
    client_id: str


class TriageRequest(BaseModel):
    """Request model for document triage."""
    client_id: str
    filename: str


class TriageResponse(BaseModel):
    """Response model for document triage."""
    document_summary: str
    document_type: str
    concern_level: str  # "low", "medium", "high"
    reassurance: str
    next_steps: List[str]
    advisor_guidance: str


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

security = HTTPBearer()


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
    except (jwt.PyJWTError, jwt.DecodeError, Exception):
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
        # Determine correct MIME type based on file extension
        import mimetypes
        mime_type = mimetypes.guess_type(str(file_path))[0]
        if not mime_type:
            # Default to PDF if we can't determine type
            mime_type = 'application/pdf' if file_path.suffix.lower() == '.pdf' else 'application/octet-stream'
        
        logger.info(f"📄 [DOC-PROCESS] Starting: {file_path.name}")
        logger.info(f"   ├─ MIME type: {mime_type}")
        logger.info(f"   ├─ File size: {file_path.stat().st_size} bytes")
        logger.info(f"   └─ Target URL: {DOC_PROCESSOR_URL}/process")
        
        async with httpx.AsyncClient(timeout=600.0) as client:  # 10 minutes for local vision model processing (15-25s per page)
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.name, f, mime_type)}
                logger.info(f"   → Sending to doc-processor...")
                response = await client.post(f"{DOC_PROCESSOR_URL}/process", files=files)
            
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        markdown = result.get('markdown')
                        logger.info(f"   ✓ Doc-processor responded successfully")
                        logger.info(f"   ├─ Text length: {len(markdown) if markdown else 0} chars")
                        logger.info(f"   ├─ Method used: {result.get('method', 'unknown')}")
                        logger.info(f"   └─ Pages: {result.get('total_pages', 'unknown')}")
                        return markdown
                    else:
                        error_msg = result.get('error', 'Unknown error')
                        logger.warning(f"   ✗ Doc-processor returned failure")
                        logger.warning(f"   └─ Error: {error_msg}")
                else:
                    logger.warning(f"   ✗ HTTP {response.status_code} from doc-processor")
                    logger.warning(f"   └─ Response: {response.text[:500]}")

        return None

    except Exception as e:
        import traceback
        logger.error(f"Error processing document {file_path.name}: {type(e).__name__}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return None


async def analyze_document_for_naming(document_text: str) -> dict:
    """
    Analyze document to extract 2-word summary and document date for intelligent file naming.
    Returns dict with 'summary' (2 words) and 'date' (YYYYMMDD format).
    """
    try:
        # Use Ollama directly for fast analysis
        ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        
        # Create a focused prompt for document classification
        prompt = f"""Analyze this document and provide ONLY:
1. A 2-word description (e.g., "Council Tax", "Debt Letter", "Bank Statement", "Benefits Letter")
2. The document date in YYYYMMDD format (if found, otherwise use "UNKNOWN")

Document text (first 1500 chars):
{document_text[:1500]}

Respond ONLY in this exact format (no other text):
SUMMARY: [two words]
DATE: [YYYYMMDD or UNKNOWN]"""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,  # Lower temperature for more consistent output
                        "num_predict": 50    # Short response
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                response_text = result.get("response", "")
                
                # Parse the response
                import re
                summary_match = re.search(r'SUMMARY:\s*(.+?)(?:\n|$)', response_text, re.IGNORECASE)
                date_match = re.search(r'DATE:\s*(\w+)', response_text, re.IGNORECASE)
                
                summary = "Unknown Document"
                doc_date = "UNKNOWN"
                
                if summary_match:
                    summary = summary_match.group(1).strip()
                    # Clean up and ensure it's 2 words max
                    words = summary.split()[:2]
                    summary = "_".join(words).replace(" ", "_")
                    # Remove any special characters
                    summary = re.sub(r'[^a-zA-Z0-9_]', '', summary)
                
                if date_match:
                    doc_date = date_match.group(1).strip()
                    # Validate date format
                    if not re.match(r'^\d{8}$', doc_date):
                        doc_date = "UNKNOWN"
                
                logger.info(f"Document analysis: summary='{summary}', date='{doc_date}'")
                return {"summary": summary, "date": doc_date}
            else:
                logger.warning(f"Document analysis failed: HTTP {response.status_code}")
                
    except Exception as e:
        logger.error(f"Error analyzing document for naming: {e}")
    
    # Fallback
    return {"summary": "Document", "date": "UNKNOWN"}


async def detect_document_boundaries(pdf_path: Path) -> List[dict]:
    """
    Analyze a PDF to detect multiple distinct documents within it.
    Returns a list of document boundary info with page ranges.
    
    Uses LLM to analyze page content and detect document transitions.
    """
    try:
        from PyPDF2 import PdfReader
        
        logger.info(f"🔍 [DOC-SPLIT] Analyzing PDF for document boundaries: {pdf_path}")
        
        reader = PdfReader(str(pdf_path))
        num_pages = len(reader.pages)
        
        logger.info(f"   ├─ Total pages: {num_pages}")
        
        if num_pages <= 1:
            logger.info(f"   └─ Single page document, no splitting needed")
            return [{"start_page": 0, "end_page": 0, "page_count": 1}]
        
        # Extract text from each page for analysis
        page_texts = []
        for i, page in enumerate(reader.pages):
            try:
                text = page.extract_text()
                # Get first 500 chars of each page for analysis
                page_texts.append({
                    "page_num": i,
                    "preview": text[:500] if text else ""
                })
            except Exception as e:
                logger.warning(f"   ⚠️  Could not extract text from page {i}: {e}")
                page_texts.append({"page_num": i, "preview": ""})
        
        # Use LLM to detect document boundaries
        ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        
        # Create analysis prompt with page previews
        page_summaries = []
        for i, page_data in enumerate(page_texts):
            preview = page_data["preview"].replace("\n", " ")[:200]
            page_summaries.append(f"Page {i}: {preview}")
        
        prompt = f"""Analyze these {num_pages} pages from a scanned PDF file. Determine if this PDF contains MULTIPLE separate documents or just ONE document.

Page previews:
{chr(10).join(page_summaries)}

Common indicators of document boundaries:
- New letterhead/header
- Different sender/recipient
- Different dates (more than a few days apart)
- Different document types (e.g., letter then form)
- Clear visual breaks or separators
- Change in formatting style

Respond in this EXACT format:
DOCUMENT_COUNT: [number]
BOUNDARIES: [comma-separated page numbers where new documents start, e.g., "0,3,7" means docs start at pages 0, 3, and 7]

Example responses:
- Single document: "DOCUMENT_COUNT: 1\\nBOUNDARIES: 0"
- Three documents: "DOCUMENT_COUNT: 3\\nBOUNDARIES: 0,2,5"
"""

        logger.info(f"   ├─ Analyzing page structure with LLM...")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 100
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                response_text = result.get("response", "")
                
                logger.info(f"   ├─ LLM Response: {response_text[:200]}")
                
                # Parse the response
                import re
                count_match = re.search(r'DOCUMENT_COUNT:\s*(\d+)', response_text, re.IGNORECASE)
                boundaries_match = re.search(r'BOUNDARIES:\s*([\d,\s]+)', response_text, re.IGNORECASE)
                
                if count_match and boundaries_match:
                    doc_count = int(count_match.group(1))
                    boundary_pages = [int(x.strip()) for x in boundaries_match.group(1).split(',')]
                    
                    logger.info(f"   ├─ Detected {doc_count} documents")
                    logger.info(f"   ├─ Boundary pages: {boundary_pages}")
                    
                    # Create document ranges
                    documents = []
                    for i in range(len(boundary_pages)):
                        start_page = boundary_pages[i]
                        end_page = boundary_pages[i + 1] - 1 if i + 1 < len(boundary_pages) else num_pages - 1
                        documents.append({
                            "start_page": start_page,
                            "end_page": end_page,
                            "page_count": end_page - start_page + 1
                        })
                    
                    logger.info(f"   └─ Document ranges: {documents}")
                    return documents
        
        # Fallback: treat as single document
        logger.info(f"   └─ Treating as single document (analysis inconclusive)")
        return [{"start_page": 0, "end_page": num_pages - 1, "page_count": num_pages}]
        
    except Exception as e:
        logger.error(f"Error detecting document boundaries: {e}")
        # Fallback: treat as single document
        return [{"start_page": 0, "end_page": 0, "page_count": 1}]


async def split_pdf_into_documents(pdf_path: Path, boundaries: List[dict], client_dir: Path) -> List[Path]:
    """
    Split a PDF file into separate PDF files based on detected boundaries.
    Returns list of new PDF file paths.
    """
    try:
        from PyPDF2 import PdfReader, PdfWriter
        
        logger.info(f"✂️  [DOC-SPLIT] Splitting PDF into {len(boundaries)} documents")
        
        reader = PdfReader(str(pdf_path))
        split_files = []
        
        for idx, boundary in enumerate(boundaries):
            writer = PdfWriter()
            
            # Add pages for this document
            for page_num in range(boundary["start_page"], boundary["end_page"] + 1):
                writer.add_page(reader.pages[page_num])
            
            # Create filename for split document
            original_stem = pdf_path.stem
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            split_filename = f"{timestamp}_{original_stem}_part{idx + 1}.pdf"
            split_path = client_dir / split_filename
            
            # Write split PDF
            with open(split_path, 'wb') as output_file:
                writer.write(output_file)
            
            split_files.append(split_path)
            logger.info(f"   ├─ Created: {split_filename} (pages {boundary['start_page']}-{boundary['end_page']})")
        
        logger.info(f"   └─ Successfully split into {len(split_files)} files")
        return split_files
        
    except Exception as e:
        logger.error(f"Error splitting PDF: {e}")
        return []


async def process_multipage_pdf(file_path: Path, client_id: str, original_filename: str, client_dir: Path) -> List[dict]:
    """
    Process a PDF that may contain multiple documents.
    Detects boundaries, splits into separate files, processes and names each intelligently.
    Returns list of processed document info.
    """
    try:
        extension = file_path.suffix.lower()
        
        # Only process PDFs
        if extension != '.pdf':
            logger.info(f"Not a PDF file, skipping multi-document processing: {file_path}")
            return []
        
        logger.info(f"📄 [MULTI-DOC] Processing multipage PDF: {file_path.name}")
        
        # Step 1: Detect document boundaries
        boundaries = await detect_document_boundaries(file_path)
        
        # If only one document detected, return empty to use normal processing
        if len(boundaries) == 1:
            logger.info(f"   └─ Single document detected, using normal processing flow")
            return []
        
        logger.info(f"   ├─ Detected {len(boundaries)} separate documents")
        
        # Step 2: Split PDF into separate files
        split_files = await split_pdf_into_documents(file_path, boundaries, client_dir)
        
        if not split_files:
            logger.warning(f"   └─ Failed to split PDF, using normal processing")
            return []
        
        # Step 3: Process each split document
        processed_docs = []
        
        for split_path in split_files:
            logger.info(f"   ├─ Processing split document: {split_path.name}")
            
            # Process document to get text
            processed_text = await process_document_to_markdown(split_path)
            
            if not processed_text:
                logger.warning(f"   │  ⚠️  Failed to process {split_path.name}")
                continue
            
            # Analyze for intelligent naming
            doc_analysis = await analyze_document_for_naming(processed_text)
            
            # Create intelligent filename
            intelligent_name = f"{client_id}_{doc_analysis['summary']}_{doc_analysis['date']}{extension}"
            intelligent_path = client_dir / intelligent_name
            
            # Handle duplicate names
            counter = 1
            while intelligent_path.exists():
                intelligent_name = f"{client_id}_{doc_analysis['summary']}_{doc_analysis['date']}_{counter}{extension}"
                intelligent_path = client_dir / intelligent_name
                counter += 1
            
            # Rename file
            try:
                import shutil
                shutil.move(str(split_path), str(intelligent_path))
                logger.info(f"   │  ✓ Renamed to: {intelligent_name}")
            except Exception as e:
                logger.warning(f"   │  ⚠️  Failed to rename, keeping: {split_path.name}")
                intelligent_path = split_path
                intelligent_name = split_path.name
            
            # Index to RAG
            doc_metadata = {
                "original_filename": original_filename,
                "intelligent_filename": intelligent_name,
                "document_summary": doc_analysis['summary'].replace("_", " "),
                "document_date": doc_analysis['date'],
                "uploaded_at": datetime.now().isoformat(),
                "uploaded_by": "client",
                "part_of_multipage": True,
                "original_multipage_file": original_filename
            }
            
            indexed = await index_document_to_rag(
                client_id=client_id,
                markdown_text=processed_text,
                filename=intelligent_name,
                metadata=doc_metadata
            )
            
            # Get file size
            file_size = intelligent_path.stat().st_size if intelligent_path.exists() else 0
            
            processed_docs.append({
                "filename": intelligent_name,
                "original_filename": original_filename,
                "uploaded_at": datetime.now().isoformat(),
                "uploaded_by": "client",
                "size": file_size,
                "processed_text_length": len(processed_text),
                "indexed_to_rag": indexed,
                "document_summary": doc_analysis['summary'].replace("_", " "),
                "document_date": doc_analysis['date'],
                "part_of_multipage": True,
                "original_multipage_file": original_filename
            })
            
            logger.info(f"   │  ✓ Indexed: {indexed}")
        
        logger.info(f"   └─ Successfully processed {len(processed_docs)} documents from multipage PDF")
        
        # Delete original combined PDF
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"   ✓ Deleted original multipage PDF: {file_path.name}")
        except Exception as e:
            logger.warning(f"   ⚠️  Could not delete original file: {e}")
        
        return processed_docs
        
    except Exception as e:
        logger.error(f"Error in multipage PDF processing: {e}")
        return []


async def index_document_to_rag(client_id: str, markdown_text: str, filename: str, metadata: dict = None) -> bool:
    """Index document into client-specific RAG vector store."""
    try:
        logger.info(f"📚 [RAG-INDEX] Starting indexing for client: {client_id}")
        logger.info(f"   ├─ Filename: {filename}")
        logger.info(f"   ├─ Text length: {len(markdown_text)} chars")
        logger.info(f"   ├─ Metadata: {metadata}")
        logger.info(f"   └─ Target URL: {CLIENT_RAG_URL}/ingest")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "client_id": client_id,
                "document_text": markdown_text,
                "filename": filename,
                "metadata": metadata or {}
            }
            
            logger.info(f"   → Sending payload to client-rag-service...")
            logger.debug(f"   → Payload keys: {list(payload.keys())}")
            
            response = await client.post(f"{CLIENT_RAG_URL}/ingest", json=payload)
            
            logger.info(f"   ← Response status: {response.status_code}")

            if response.status_code == 200:
                result = response.json()
                logger.info(f"   ← Response body: {result}")
                
                if result.get('success'):
                    chunks_created = result.get('chunks_created', 0)
                    collection_name = result.get('collection_name', 'unknown')
                    logger.info(f"   ✓ Successfully indexed!")
                    logger.info(f"   ├─ Chunks created: {chunks_created}")
                    logger.info(f"   ├─ Collection: {collection_name}")
                    logger.info(f"   └─ Message: {result.get('message', 'N/A')}")
                    return True
                else:
                    logger.warning(f"   ✗ RAG service returned success=false")
                    logger.warning(f"   └─ Response: {result}")
            else:
                logger.warning(f"   ✗ HTTP {response.status_code} from client-rag-service")
                try:
                    error_body = response.json()
                    logger.warning(f"   └─ Error body: {error_body}")
                except:
                    logger.warning(f"   └─ Error text: {response.text[:500]}")

        logger.warning(f"❌ [RAG-INDEX] Failed to index {filename} for client {client_id}")
        return False

    except Exception as e:
        logger.error(f"❌ [RAG-INDEX] Exception during indexing: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        return False


async def reprocess_unindexed_documents():
    """
    On startup, check all client directories for documents that haven't been
    processed or indexed, and reprocess them.
    """
    logger.info("Checking for unprocessed documents...")
    
    # Wait a bit for other services to be ready
    await asyncio.sleep(5)
    
    if not UPLOAD_DIR.exists():
        logger.info("No upload directory found, skipping reprocessing")
        return
    
    processed_count = 0
    failed_count = 0
    
    for client_dir in UPLOAD_DIR.iterdir():
        if not client_dir.is_dir():
            continue
            
        client_id = client_dir.name
        metadata_file = client_dir / "metadata.json"
        
        if not metadata_file.exists():
            continue
            
        try:
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            documents = metadata.get("documents", [])
            needs_update = False
            
            for doc in documents:
                # Check if document needs processing (only check indexed_to_rag for local parsing)
                if not doc.get("indexed_to_rag"):
                    filename = doc.get("filename")
                    original_filename = doc.get("original_filename", filename)
                    file_path = client_dir / filename
                    
                    if not file_path.exists():
                        logger.warning(f"File not found: {file_path}")
                        continue
                    
                    logger.info(f"Reprocessing {filename} for client {client_id}")
                    
                    try:
                        # Process document (returns text from local parser or markdown from LlamaParse)
                        processed_text = await process_document_to_markdown(file_path)
                        
                        if processed_text:
                            logger.info(f"Successfully processed {filename}, got {len(processed_text)} chars")
                            
                            # Analyze document for intelligent naming (if not already renamed)
                            final_filename = filename
                            if not filename.startswith(client_id):  # Check if already has intelligent name
                                doc_analysis = await analyze_document_for_naming(processed_text)
                                
                                # Create intelligent filename
                                extension = Path(filename).suffix
                                intelligent_name = f"{client_id}_{doc_analysis['summary']}_{doc_analysis['date']}{extension}"
                                intelligent_path = client_dir / intelligent_name
                                
                                # Rename file
                                try:
                                    import shutil
                                    if intelligent_path.exists():
                                        # If target exists, append counter
                                        counter = 1
                                        while intelligent_path.exists():
                                            intelligent_name = f"{client_id}_{doc_analysis['summary']}_{doc_analysis['date']}_{counter}{extension}"
                                            intelligent_path = client_dir / intelligent_name
                                            counter += 1
                                    
                                    shutil.move(str(file_path), str(intelligent_path))
                                    final_filename = intelligent_name
                                    doc["filename"] = intelligent_name
                                    logger.info(f"Renamed to: {intelligent_name}")
                                except Exception as e:
                                    logger.warning(f"Failed to rename, keeping original: {e}")
                                
                                # Update doc metadata with analysis
                                doc["document_summary"] = doc_analysis['summary'].replace("_", " ")
                                doc["document_date"] = doc_analysis['date']
                            
                            # Index to RAG
                            doc_metadata = {
                                "original_filename": original_filename,
                                "intelligent_filename": final_filename,
                                "document_summary": doc.get("document_summary", "Unknown"),
                                "document_date": doc.get("document_date", "UNKNOWN"),
                                "uploaded_at": doc.get("uploaded_at", datetime.now().isoformat()),
                                "uploaded_by": doc.get("uploaded_by", "client"),
                                "reprocessed_at": datetime.now().isoformat()
                            }
                            
                            indexed = await index_document_to_rag(
                                client_id=client_id,
                                markdown_text=processed_text,
                                filename=final_filename,
                                metadata=doc_metadata
                            )
                            
                            doc["indexed_to_rag"] = indexed
                            doc["processed_at"] = datetime.now().isoformat()
                            needs_update = True
                            
                            if indexed:
                                processed_count += 1
                                logger.info(f"✓ Successfully reprocessed and indexed {final_filename}")
                            else:
                                failed_count += 1
                                logger.warning(f"✗ Failed to index {filename}")
                        else:
                            failed_count += 1
                            logger.warning(f"✗ Failed to process {filename}")
                            
                    except Exception as e:
                        failed_count += 1
                        logger.error(f"Error reprocessing {filename}: {e}")
            
            # Save updated metadata
            if needs_update:
                with open(metadata_file, 'w') as f:
                    json.dump(metadata, f, indent=2)
                    
        except Exception as e:
            logger.error(f"Error processing client {client_id}: {e}")
    
    logger.info(f"Document reprocessing complete: {processed_count} successful, {failed_count} failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    logger.info("Upload Service starting up...")
    asyncio.create_task(reprocess_unindexed_documents())
    yield
    # Shutdown
    logger.info("Upload Service shutting down...")


app = FastAPI(
    title="Upload Service",
    description="Document upload and management with authentication",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    # Get base URL - if localhost, try to detect actual host IP
    base_url = os.getenv('APP_BASE_URL', 'http://localhost:3000')
    
    # If using localhost, try to get the actual network IP for QR code
    if 'localhost' in base_url or '127.0.0.1' in base_url:
        try:
            import socket
            # Get hostname
            hostname = socket.gethostname()
            # Try to get IP address
            ip_address = socket.gethostbyname(hostname)
            
            # Only replace if we got a real IP (not localhost)
            if ip_address and ip_address != '127.0.0.1' and not ip_address.startswith('127.'):
                # Extract port from base_url if present
                import re
                port_match = re.search(r':(\d+)', base_url)
                port = f":{port_match.group(1)}" if port_match else ':3000'
                base_url = f"http://{ip_address}{port}"
                logger.info(f"Using detected IP for QR code: {base_url}")
        except Exception as e:
            logger.warning(f"Could not detect network IP, using configured base URL: {e}")
    
    upload_url = f"{base_url}/client-upload/{request.client_id}"

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
    file: UploadFile = File(...)
):
    """Upload document for a client (public endpoint - no auth required)."""
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

        # NEW: Try multi-document processing for PDFs
        multi_docs = []
        if extension.lower() == '.pdf':
            logger.info(f"🔍 Checking if PDF contains multiple documents...")
            multi_docs = await process_multipage_pdf(
                file_path=file_path,
                client_id=client_id,
                original_filename=file.filename,
                client_dir=client_dir
            )
        
        # If multi-document processing succeeded, update metadata and return
        if multi_docs:
            logger.info(f"✓ Processed as {len(multi_docs)} separate documents")
            metadata = get_client_metadata(client_id)
            
            # Add all split documents to metadata
            for doc in multi_docs:
                metadata["documents"].append(doc)
            
            save_client_metadata(client_id, metadata)
            
            # Return info about first document (could be enhanced to return all)
            first_doc = multi_docs[0]
            return UploadResponse(
                success=True,
                filename=first_doc["filename"],
                client_id=client_id,
                markdown_available=True,
                message=f"Document split into {len(multi_docs)} separate documents and processed successfully (searchable via AI)"
            )

        # FALLBACK: Normal single-document processing
        logger.info(f"Processing as single document")
        processed_text = await process_document_to_markdown(file_path)
        indexed = False
        final_filename = unique_filename  # Default to timestamp-based name

        if processed_text:
            logger.info(f"Successfully processed {file.filename}, got {len(processed_text)} chars")

            # Analyze document for intelligent naming
            doc_analysis = await analyze_document_for_naming(processed_text)
            
            # Create intelligent filename: CLIENTID_TwoWordSummary_Date.ext
            intelligent_name = f"{client_id}_{doc_analysis['summary']}_{doc_analysis['date']}{extension}"
            intelligent_path = client_dir / intelligent_name
            
            # Rename file to intelligent name
            try:
                import shutil
                shutil.move(str(file_path), str(intelligent_path))
                final_filename = intelligent_name
                logger.info(f"Renamed file to: {intelligent_name}")
            except Exception as e:
                logger.warning(f"Failed to rename file, keeping original: {e}")
                final_filename = unique_filename

            # Index document into client-specific RAG
            doc_metadata = {
                "original_filename": file.filename,
                "intelligent_filename": final_filename,
                "document_summary": doc_analysis['summary'].replace("_", " "),
                "document_date": doc_analysis['date'],
                "uploaded_at": datetime.now().isoformat(),
                "uploaded_by": "client"
            }
            indexed = await index_document_to_rag(
                client_id=client_id,
                markdown_text=processed_text,
                filename=final_filename,
                metadata=doc_metadata
            )

        # Update metadata
        metadata = get_client_metadata(client_id)
        metadata["documents"].append({
            "filename": final_filename,
            "original_filename": file.filename,
            "uploaded_at": datetime.now().isoformat(),
            "uploaded_by": "client",
            "size": len(content),
            "processed_text_length": len(processed_text) if processed_text else 0,
            "indexed_to_rag": indexed,
            "document_summary": doc_analysis.get('summary', 'Unknown').replace("_", " ") if processed_text else None,
            "document_date": doc_analysis.get('date', 'UNKNOWN') if processed_text else None
        })
        save_client_metadata(client_id, metadata)

        message = "Document uploaded and processed successfully"
        if indexed:
            message += " (searchable via AI)"

        return UploadResponse(
            success=True,
            filename=final_filename,
            client_id=client_id,
            markdown_available=processed_text is not None,
            message=message
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


@app.delete("/uploads/{client_id}/{filename}")
async def delete_document(
    client_id: str,
    filename: str,
    username: str = Depends(verify_token)
):
    """Delete a specific document from client uploads."""
    try:
        file_path = get_client_dir(client_id) / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete the physical file
        file_path.unlink()
        logger.info(f"Deleted file: {file_path}")
        
        # Update metadata to remove document from list
        metadata = get_client_metadata(client_id)
        documents = metadata.get("documents", [])
        
        # Remove document from metadata
        updated_docs = [doc for doc in documents if doc.get("filename") != filename]
        metadata["documents"] = updated_docs
        
        # Save updated metadata
        metadata_path = get_client_dir(client_id) / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        # Delete from vector store (ChromaDB via client-rag-service)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                delete_url = f"{CLIENT_RAG_URL}/delete/{client_id}/{filename}"
                response = await client.delete(delete_url)
                
                if response.status_code == 200:
                    logger.info(f"Deleted document from vector store: {filename}")
                else:
                    logger.warning(f"Could not delete from vector store: {response.text}")
        except Exception as e:
            logger.warning(f"Error deleting from vector store: {e}")
        
        return {
            "message": "Document deleted successfully",
            "filename": filename,
            "client_id": client_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query-client-documents", response_model=ClientQueryResponse)
async def query_client_documents(
    request: ClientQueryRequest,
    username: str = Depends(verify_token)
):
    """Query a client's documents using AI."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "client_id": request.client_id,
                "question": request.question,
                "model": request.model,
                "top_k": 4
            }
            response = await client.post(f"{CLIENT_RAG_URL}/query", json=payload)

            if response.status_code == 200:
                result = response.json()
                return ClientQueryResponse(
                    answer=result["answer"],
                    sources=result["sources"],
                    client_id=request.client_id
                )
            elif response.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail=f"No documents found for client {request.client_id}"
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Error querying documents"
                )

    except httpx.HTTPError as e:
        logger.error(f"Error querying client documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to document search service: {str(e)}"
        )


@app.get("/clients")
async def list_all_clients(
    username: str = Depends(verify_token)
):
    """List all clients with uploaded documents."""
    try:
        clients = []
        if UPLOAD_DIR.exists():
            for client_dir in UPLOAD_DIR.iterdir():
                if client_dir.is_dir():
                    metadata = get_client_metadata(client_dir.name)
                    doc_count = len(metadata.get("documents", []))
                    clients.append({
                        "client_id": client_dir.name,
                        "client_name": metadata.get("client_name", "Unknown"),
                        "document_count": doc_count
                    })
        
        return {
            "clients": sorted(clients, key=lambda x: x["client_id"]),
            "total_count": len(clients)
        }
    except Exception as e:
        logger.error(f"Error listing clients: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error listing clients: {str(e)}"
        )


@app.get("/client-stats/{client_id}")
async def get_client_document_stats(
    client_id: str,
    username: str = Depends(verify_token)
):
    """Get statistics about a client's searchable documents."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{CLIENT_RAG_URL}/stats/{client_id}")

            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=500, detail="Error getting statistics")

    except httpx.HTTPError as e:
        logger.error(f"Error getting client stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting statistics: {str(e)}"
        )


@app.post("/triage-document", response_model=TriageResponse)
async def triage_document(
    request: TriageRequest
):
    """
    Triage a document: analyze it and provide reassuring advice (public endpoint - no auth required).
    Uses the document content + training manuals RAG to provide context-aware guidance.
    """
    try:
        # Get the document markdown
        client_dir = get_client_dir(request.client_id)
        metadata = get_client_metadata(request.client_id)

        # Find the document
        doc_info = None
        for doc in metadata.get("documents", []):
            if doc["filename"] == request.filename:
                doc_info = doc
                break

        if not doc_info:
            raise HTTPException(status_code=404, detail="Document not found")

        markdown_filename = doc_info.get("markdown_filename")
        if not markdown_filename:
            raise HTTPException(status_code=400, detail="Document not yet processed")

        markdown_path = client_dir / markdown_filename
        if not markdown_path.exists():
            raise HTTPException(status_code=404, detail="Processed document not found")

        with open(markdown_path, 'r') as f:
            document_content = f.read()

        # Step 1: Analyze the document to determine type and concern level
        analysis_prompt = f"""Analyze this financial document and provide:
1. Document type (e.g., "Debt Collection Letter", "Bank Statement", "Benefit Letter", "Council Tax Bill")
2. Concern level: "low", "medium", or "high" (how urgently does this need attention?)
3. Brief summary (2-3 sentences max)

Document content:
{document_content[:2000]}...

Respond in JSON format:
{{
  "document_type": "...",
  "concern_level": "low|medium|high",
  "summary": "..."
}}"""

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get document analysis from Ollama directly
            analysis_response = await client.post(
                f"{os.getenv('OLLAMA_URL', 'http://ollama:11434')}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": analysis_prompt,
                    "stream": False
                }
            )

            if analysis_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Error analyzing document")

            analysis_text = analysis_response.json().get("response", "")

            # Parse JSON from response (try to extract JSON)
            import re
            import json as json_lib
            json_match = re.search(r'\{[^}]+\}', analysis_text, re.DOTALL)
            if json_match:
                try:
                    analysis = json_lib.loads(json_match.group())
                except:
                    analysis = {
                        "document_type": "Financial Document",
                        "concern_level": "medium",
                        "summary": analysis_text[:200]
                    }
            else:
                analysis = {
                    "document_type": "Financial Document",
                    "concern_level": "medium",
                    "summary": analysis_text[:200]
                }

        # Step 2: Query training manuals for relevant advice
        advice_query = f"What advice should I give to a client who received a {analysis['document_type']}? What are the typical next steps and what should they know?"

        async with httpx.AsyncClient(timeout=60.0) as client:
            rag_response = await client.post(
                f"{RAG_SERVICE_URL}/query",
                json={
                    "question": advice_query,
                    "model": "llama3.2",
                    "top_k": 3
                }
            )

            if rag_response.status_code == 200:
                rag_result = rag_response.json()
                advisor_guidance = rag_result.get("answer", "")
            else:
                advisor_guidance = "Please consult with your advisor for specific guidance."

        # Step 3: Generate reassuring client-facing message
        reassurance_prompt = f"""You are a friendly, reassuring money advisor. A client has uploaded a {analysis['document_type']} and is worried about it.

Document summary: {analysis['summary']}
Concern level: {analysis['concern_level']}

Write a SHORT, reassuring message (3-4 sentences) that:
1. Acknowledges their document
2. Reassures them this is manageable
3. Indicates what typically happens next

Be warm, friendly, and encouraging. Do NOT use jargon."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            reassurance_response = await client.post(
                f"{os.getenv('OLLAMA_URL', 'http://ollama:11434')}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": reassurance_prompt,
                    "stream": False
                }
            )

            if reassurance_response.status_code == 200:
                reassurance = reassurance_response.json().get("response", "").strip()
            else:
                reassurance = "We've received your document and will review it shortly. Don't worry - our team is here to help you through this."

        # Step 4: Generate next steps
        next_steps_prompt = f"""Based on this {analysis['document_type']}, list 2-3 simple next steps for the client in plain language. Each step should be one short sentence.

Document type: {analysis['document_type']}
Concern level: {analysis['concern_level']}

Format as a simple numbered list."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            steps_response = await client.post(
                f"{os.getenv('OLLAMA_URL', 'http://ollama:11434')}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": next_steps_prompt,
                    "stream": False
                }
            )

            if steps_response.status_code == 200:
                steps_text = steps_response.json().get("response", "")
                # Extract steps from numbered list
                import re
                steps = re.findall(r'\d+\.\s*([^\n]+)', steps_text)
                if not steps:
                    steps = [
                        "Review the document carefully",
                        "Contact us if you have questions",
                        "Keep a copy for your records"
                    ]
            else:
                steps = [
                    "Review the document carefully",
                    "Contact us if you have questions",
                    "Keep a copy for your records"
                ]

        return TriageResponse(
            document_summary=analysis.get("summary", ""),
            document_type=analysis.get("document_type", "Financial Document"),
            concern_level=analysis.get("concern_level", "medium"),
            reassurance=reassurance,
            next_steps=steps[:3],  # Limit to 3 steps
            advisor_guidance=advisor_guidance
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triaging document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error triaging document: {str(e)}"
        )


if __name__ == "__main__":
    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Upload directory: {UPLOAD_DIR}")
    logger.info("Starting Upload Service...")
    uvicorn.run(app, host="0.0.0.0", port=8103)
