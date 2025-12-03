#!/usr/bin/env python3
"""
BGE-M3 Embedding Service
High-performance open-source embeddings using the best model (BGE-M3)
Provides OpenAI-compatible embedding API
"""

import os
import logging
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from sentence_transformers import SentenceTransformer
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BGE-M3 Embedding Service",
    description="High-performance embeddings using BGE-M3 model",
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

# Initialize model globally
model = None

class EmbeddingRequest(BaseModel):
    """Request model for embeddings."""
    input: List[str]
    model: str = "bge-m3"

class EmbeddingResponse(BaseModel):
    """Response model for embeddings."""
    object: str = "list"
    data: List[dict]
    model: str
    usage: dict

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup."""
    global model
    logger.info("Loading BGE-M3 embedding model...")
    try:
        # BGE-M3: best open-source multilingual embeddings
        # Supports dense, sparse, and colbert vectors
        # 384 dimensions, excellent for semantic search
        model = SentenceTransformer('BAAI/bge-m3')
        logger.info("BGE-M3 model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "model": "bge-m3"}

@app.post("/v1/embeddings")
async def create_embeddings(request: EmbeddingRequest):
    """
    Create embeddings for input texts.
    Compatible with OpenAI embedding API format.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Ensure input is list
        if isinstance(request.input, str):
            texts = [request.input]
        else:
            texts = request.input
        
        # Generate embeddings
        embeddings = model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,  # L2 normalization
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        # Format response to match OpenAI API
        response_data = []
        for i, (text, embedding) in enumerate(zip(texts, embeddings)):
            response_data.append({
                "object": "embedding",
                "embedding": embedding.tolist(),
                "index": i
            })
        
        return EmbeddingResponse(
            data=response_data,
            model="bge-m3",
            usage={
                "prompt_tokens": sum(len(t.split()) for t in texts),
                "total_tokens": sum(len(t.split()) for t in texts)
            }
        )
    
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed")
async def embed_texts(texts: List[str]):
    """Alternative endpoint for embedding texts."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        embeddings = model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        return {
            "embeddings": [emb.tolist() for emb in embeddings],
            "model": "bge-m3",
            "dimension": len(embeddings[0])
        }
    
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def list_models():
    """List available models."""
    return {
        "object": "list",
        "data": [
            {
                "id": "bge-m3",
                "object": "model",
                "owned_by": "BAAI",
                "dimensions": 1024,
                "multilingual": True
            }
        ]
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8006))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
