import os
import asyncio
import logging
import hashlib
from typing import List, Dict, Optional
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from chromadb.config import Settings
import httpx

from document_processor import DocumentProcessor
from embedding_service import EmbeddingService
from case_ingestion_routes import add_case_routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Document Ingestion Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
CHROMADB_HOST = os.getenv("CHROMADB_HOST", "chromadb")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", "8000"))
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio")
MINIO_PORT = int(os.getenv("MINIO_PORT", "9000"))
MINIO_ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
TRAINING_MANUALS_BUCKET = os.getenv("TRAINING_MANUALS_BUCKET", "training-manuals")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

# Initialize services
chroma_client = chromadb.HttpClient(
    host=CHROMADB_HOST,
    port=CHROMADB_PORT,
    settings=Settings(allow_reset=True)
)

s3_client = boto3.client(
    's3',
    endpoint_url=f"http://{MINIO_ENDPOINT}:{MINIO_PORT}",
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    region_name='us-east-1'
)

document_processor = DocumentProcessor()
embedding_service = EmbeddingService(ollama_url=OLLAMA_URL)

# Pydantic models
class IngestionRequest(BaseModel):
    bucket_path: Optional[str] = None
    file_path: Optional[str] = None
    manual_type: str = "general"
    force_reprocess: bool = False

class IngestionResponse(BaseModel):
    status: str
    message: str
    documents_processed: int
    chunks_created: int
    processing_time: float

class SearchRequest(BaseModel):
    query: str
    manual_type: Optional[str] = None
    collection_name: Optional[str] = "training_manuals"
    top_k: int = 5
    score_threshold: float = 0.7

class SearchResponse(BaseModel):
    results: List[Dict]
    query: str
    total_results: int

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize ChromaDB collections and S3 bucket"""
    try:
        # Create training manuals bucket if it doesn't exist
        try:
            s3_client.head_bucket(Bucket=TRAINING_MANUALS_BUCKET)
            logger.info(f"Bucket {TRAINING_MANUALS_BUCKET} already exists")
        except ClientError:
            s3_client.create_bucket(Bucket=TRAINING_MANUALS_BUCKET)
            logger.info(f"Created bucket {TRAINING_MANUALS_BUCKET}")

        # Initialize ChromaDB collections
        try:
            collection = chroma_client.get_collection("training_manuals")
            logger.info("ChromaDB collection 'training_manuals' already exists")
        except Exception:
            collection = chroma_client.create_collection(
                name="training_manuals",
                metadata={"description": "Training manual chunks for RAG"}
            )
            logger.info("Created ChromaDB collection 'training_manuals'")

        # Initialize case precedents collection
        try:
            case_collection = chroma_client.get_collection("case_precedents")
            logger.info("ChromaDB collection 'case_precedents' already exists")
        except Exception:
            case_collection = chroma_client.create_collection(
                name="case_precedents",
                metadata={"description": "Closed case precedents for similarity lookup"}
            )
            logger.info("Created ChromaDB collection 'case_precedents'")

        # Initialize case notes collection
        try:
            notes_collection = chroma_client.get_collection("case_notes")
            logger.info("ChromaDB collection 'case_notes' already exists")
        except Exception:
            notes_collection = chroma_client.create_collection(
                name="case_notes",
                metadata={"description": "Enhanced case notes for knowledge sharing"}
            )
            logger.info("Created ChromaDB collection 'case_notes'")

    except Exception as e:
        logger.error(f"Startup initialization failed: {str(e)}")
        raise

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check ChromaDB connection
        chroma_client.heartbeat()

        # Check Ollama connection
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_URL}/api/version", timeout=5.0)
            response.raise_for_status()

        return {
            "status": "healthy",
            "chromadb": "connected",
            "ollama": "connected",
            "s3": "connected"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.post("/ingest/manual", response_model=IngestionResponse)
async def ingest_training_manual(
    request: IngestionRequest,
    background_tasks: BackgroundTasks
):
    """Ingest a training manual from S3 into the vector store"""
    start_time = datetime.now()

    try:
        if request.file_path:
            # Process single file
            files_to_process = [request.file_path]
        elif request.bucket_path:
            # Process all files in bucket path
            files_to_process = await list_s3_files(request.bucket_path)
        else:
            # Process entire bucket
            files_to_process = await list_s3_files("")

        if not files_to_process:
            raise HTTPException(status_code=404, detail="No files found to process")

        # Process files in background
        background_tasks.add_task(
            process_documents_background,
            files_to_process,
            request.manual_type,
            request.force_reprocess
        )

        processing_time = (datetime.now() - start_time).total_seconds()

        return IngestionResponse(
            status="accepted",
            message=f"Started processing {len(files_to_process)} files",
            documents_processed=0,
            chunks_created=0,
            processing_time=processing_time
        )

    except Exception as e:
        logger.error(f"Ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search", response_model=SearchResponse)
async def search_collections(request: SearchRequest):
    """Search training manuals using vector similarity"""
    try:
        # Generate query embedding
        query_embedding = await embedding_service.generate_embedding(request.query)

        # Search in specified ChromaDB collection
        collection_name = request.collection_name or "training_manuals"
        collection = chroma_client.get_collection(collection_name)

        # Build where clause for filtering
        where_clause = {}
        if request.manual_type:
            where_clause["manual_type"] = request.manual_type

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=request.top_k,
            where=where_clause if where_clause else None
        )

        # Format results
        formatted_results = []
        if results['documents']:
            for i, doc in enumerate(results['documents'][0]):
                if results['distances'][0][i] <= (1 - request.score_threshold):
                    formatted_results.append({
                        "content": doc,
                        "metadata": results['metadatas'][0][i],
                        "score": 1 - results['distances'][0][i],
                        "id": results['ids'][0][i]
                    })

        return SearchResponse(
            results=formatted_results,
            query=request.query,
            total_results=len(formatted_results)
        )

    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections/stats")
async def get_collection_stats():
    """Get statistics about the training manuals collection"""
    try:
        collection = chroma_client.get_collection("training_manuals")
        count = collection.count()

        # Get sample of metadata to show manual types
        sample = collection.get(limit=100)
        manual_types = set()
        if sample['metadatas']:
            for metadata in sample['metadatas']:
                manual_types.add(metadata.get('manual_type', 'unknown'))

        return {
            "total_chunks": count,
            "manual_types": list(manual_types),
            "collection_name": "training_manuals"
        }

    except Exception as e:
        logger.error(f"Stats retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/collections/reset")
async def reset_collection():
    """Reset the training manuals collection (development only)"""
    try:
        # Delete and recreate collection
        try:
            chroma_client.delete_collection("training_manuals")
        except Exception:
            pass

        collection = chroma_client.create_collection(
            name="training_manuals",
            metadata={"description": "Training manual chunks for RAG"}
        )

        return {"status": "success", "message": "Collection reset successfully"}

    except Exception as e:
        logger.error(f"Collection reset failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def list_s3_files(prefix: str = "") -> List[str]:
    """List files in S3 bucket with optional prefix"""
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        files = []

        for page in paginator.paginate(Bucket=TRAINING_MANUALS_BUCKET, Prefix=prefix):
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    if key.lower().endswith(('.pdf', '.txt', '.docx', '.doc')):
                        files.append(key)

        return files

    except Exception as e:
        logger.error(f"Failed to list S3 files: {str(e)}")
        return []

async def process_documents_background(
    file_paths: List[str],
    manual_type: str,
    force_reprocess: bool
):
    """Background task to process documents"""
    logger.info(f"Starting background processing of {len(file_paths)} files")

    collection = chroma_client.get_collection("training_manuals")
    total_chunks = 0

    for file_path in file_paths:
        try:
            # Generate file hash for deduplication
            file_hash = hashlib.md5(file_path.encode()).hexdigest()

            # Check if already processed
            if not force_reprocess:
                existing = collection.get(where={"file_hash": file_hash})
                if existing['ids']:
                    logger.info(f"Skipping {file_path} - already processed")
                    continue

            # Download file from S3
            file_content = s3_client.get_object(
                Bucket=TRAINING_MANUALS_BUCKET,
                Key=file_path
            )['Body'].read()

            # Process document
            chunks = await document_processor.process_document(
                file_content,
                file_path,
                manual_type
            )

            if chunks:
                # Generate embeddings
                embeddings = []
                chunk_texts = []
                chunk_metadata = []
                chunk_ids = []

                for i, chunk in enumerate(chunks):
                    embedding = await embedding_service.generate_embedding(chunk['text'])
                    embeddings.append(embedding)
                    chunk_texts.append(chunk['text'])

                    metadata = {
                        "file_path": file_path,
                        "file_hash": file_hash,
                        "manual_type": manual_type,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "processed_at": datetime.now().isoformat(),
                        **chunk.get('metadata', {})
                    }
                    chunk_metadata.append(metadata)
                    chunk_ids.append(f"{file_hash}_{i}")

                # Store in ChromaDB
                collection.add(
                    embeddings=embeddings,
                    documents=chunk_texts,
                    metadatas=chunk_metadata,
                    ids=chunk_ids
                )

                total_chunks += len(chunks)
                logger.info(f"Processed {file_path}: {len(chunks)} chunks")

        except Exception as e:
            logger.error(f"Failed to process {file_path}: {str(e)}")
            continue

    logger.info(f"Background processing completed: {total_chunks} total chunks added")

# Add case management routes
add_case_routes(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)