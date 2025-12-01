"""
Inference routing endpoints
Routes incoming inference requests to appropriate workers
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import httpx
import random

router = APIRouter()
worker_registry = None  # Injected from main.py


class InferenceRequest(BaseModel):
    """Generic inference request"""
    model: str
    prompt: str
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.7


@router.post("/llm")
async def llm_inference(request: InferenceRequest):
    """
    LLM inference endpoint

    Routes request to available vLLM worker (Tier 1)
    """

    # Find available GPU workers running vLLM
    gpu_workers = worker_registry.get_available_workers(tier=1)
    vllm_workers = [
        w for w in gpu_workers
        if any("vllm" in c.name for c in w.assigned_containers)
    ]

    if not vllm_workers:
        raise HTTPException(
            status_code=503,
            detail="No vLLM workers available. Please try again later."
        )

    # Load balancing: Select least loaded worker
    selected_worker = min(vllm_workers, key=lambda w: w.current_load)

    # Forward request to worker
    container = next(c for c in selected_worker.assigned_containers if "vllm" in c.name)
    worker_url = f"http://{selected_worker.ip_address}:{container.port}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{worker_url}/v1/completions",
                json=request.dict()
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Worker request failed: {str(e)}"
        )


@router.post("/vision")
async def vision_inference(request: InferenceRequest):
    """
    Vision model inference endpoint

    Routes request to available Ollama Vision worker (Tier 1)
    """

    # Find available GPU workers running vision models
    gpu_workers = worker_registry.get_available_workers(tier=1)
    vision_workers = [
        w for w in gpu_workers
        if any("vision" in c.name for c in w.assigned_containers)
    ]

    if not vision_workers:
        raise HTTPException(
            status_code=503,
            detail="No vision workers available. Please try again later."
        )

    # Load balancing
    selected_worker = min(vision_workers, key=lambda w: w.current_load)

    # Forward request to worker
    container = next(c for c in selected_worker.assigned_containers if "vision" in c.name)
    worker_url = f"http://{selected_worker.ip_address}:{container.port}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{worker_url}/api/generate",
                json={
                    "model": request.model,
                    "prompt": request.prompt,
                    "options": {
                        "num_predict": request.max_tokens,
                        "temperature": request.temperature
                    }
                }
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Worker request failed: {str(e)}"
        )


@router.post("/rag/query")
async def rag_query(query: str, context: Optional[str] = None):
    """
    RAG query endpoint

    Routes request to available RAG service worker (Tier 2)
    """

    # Find available RAG workers
    service_workers = worker_registry.get_available_workers(tier=2)
    rag_workers = [
        w for w in service_workers
        if any("rag" in c.name for c in w.assigned_containers)
    ]

    if not rag_workers:
        raise HTTPException(
            status_code=503,
            detail="No RAG workers available. Please try again later."
        )

    # Load balancing
    selected_worker = min(rag_workers, key=lambda w: w.current_load)

    # Forward request to worker
    container = next(c for c in selected_worker.assigned_containers if "rag" in c.name)
    worker_url = f"http://{selected_worker.ip_address}:{container.port}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{worker_url}/query",
                json={"query": query, "context": context}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Worker request failed: {str(e)}"
        )


@router.post("/graph/extract")
async def graph_extract(text: str):
    """
    NER/Graph extraction endpoint

    Routes request to available NER service worker (Tier 2)
    """

    # Find available NER workers
    service_workers = worker_registry.get_available_workers(tier=2)
    ner_workers = [
        w for w in service_workers
        if any("ner" in c.name for c in w.assigned_containers)
    ]

    if not ner_workers:
        raise HTTPException(
            status_code=503,
            detail="No NER workers available. Please try again later."
        )

    # Load balancing
    selected_worker = min(ner_workers, key=lambda w: w.current_load)

    # Forward request to worker
    container = next(c for c in selected_worker.assigned_containers if "ner" in c.name)
    worker_url = f"http://{selected_worker.ip_address}:{container.port}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{worker_url}/extract",
                json={"text": text}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Worker request failed: {str(e)}"
        )
