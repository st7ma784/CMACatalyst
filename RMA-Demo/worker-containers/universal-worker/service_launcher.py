#!/usr/bin/env python3
"""
Service Launcher
Dynamically launches services based on coordinator assignments
Each service runs as a subprocess managed by the worker agent
"""

import os
import time
import subprocess
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def launch_service(service_name: str, port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch a specific service based on its name"""
    
    # GPU Services
    if service_name == "llm-inference":
        return launch_llm_service(port, capabilities)
    
    elif service_name == "vision-ocr":
        return launch_vision_ocr_service(port, capabilities)
    
    elif service_name == "rag-embeddings":
        return launch_rag_service(port, capabilities)
    
    # CPU Services
    elif service_name == "ner-extraction":
        return launch_ner_service(port, capabilities)
    
    elif service_name == "document-processing":
        return launch_document_processing_service(port, capabilities)
    
    elif service_name == "notes-coa":
        return launch_notes_service(port, capabilities)
    
    # Storage Services
    elif service_name == "chromadb":
        return launch_chromadb_service(port, capabilities)
    
    elif service_name == "redis":
        return launch_redis_service(port, capabilities)
    
    elif service_name == "postgres":
        return launch_postgres_service(port, capabilities)
    
    elif service_name == "minio":
        return launch_minio_service(port, capabilities)
    
    elif service_name == "neo4j":
        return launch_neo4j_service(port, capabilities)
    
    # Edge/Coordination Services
    elif service_name == "coordinator":
        return launch_coordinator_service(port, capabilities)
    
    elif service_name == "edge-proxy":
        return launch_edge_proxy_service(port, capabilities)
    
    elif service_name == "load-balancer":
        return launch_load_balancer_service(port, capabilities)
    
    else:
        logger.error(f"Unknown service: {service_name}")
        return None


# GPU Service Launchers

def launch_llm_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch LLM inference service (vLLM or Ollama)"""
    logger.info(f"Starting LLM inference on port {port}")

    # Check if vLLM is available, install if needed
    try:
        import vllm
        logger.info("vLLM package found, attempting to start vLLM server")
    except ImportError:
        logger.warning("vLLM package not installed, installing now...")
        logger.info("This may take a few minutes (326MB download)...")
        try:
            subprocess.check_call([
                "pip3", "install", "--no-cache-dir", "vllm>=0.2.0"
            ])
            logger.info("✅ vLLM installed successfully")
            import vllm
        except Exception as e:
            logger.error(f"Failed to install vLLM: {e}")
            logger.error("Alternatively, set up Ollama as a lighter alternative")
            return None

    # Check GPU availability
    gpu_memory = capabilities.get("gpu_memory", "")
    if not capabilities.get("has_gpu"):
        logger.error("No GPU detected - LLM inference requires GPU")
        logger.error("Consider using CPU-based alternatives like Ollama")
        return None

    # Model configuration
    model_name = os.getenv("LLM_MODEL", "meta-llama/Llama-2-7b-chat-hf")
    logger.info(f"Loading model: {model_name}")
    logger.info(f"GPU: {capabilities.get('gpu_type')} with {gpu_memory}")

    cmd = [
        "python3", "-m", "vllm.entrypoints.api_server",
        "--model", model_name,
        "--port", str(port),
        "--host", "0.0.0.0"
    ]

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Monitor initial startup for errors
        import threading
        def log_output(pipe, prefix):
            for line in iter(pipe.readline, ''):
                if line.strip():
                    logger.info(f"{prefix}: {line.strip()}")

        threading.Thread(target=log_output, args=(process.stdout, "vLLM-stdout"), daemon=True).start()
        threading.Thread(target=log_output, args=(process.stderr, "vLLM-stderr"), daemon=True).start()

        # Wait a bit to check if it started successfully
        time.sleep(2)
        if process.poll() is not None:
            logger.error(f"vLLM process exited immediately with code {process.poll()}")
            logger.error("Common issues:")
            logger.error("  1. Model not downloaded (needs HuggingFace authentication)")
            logger.error("  2. Insufficient GPU memory (Llama-2-7b needs ~14GB)")
            logger.error("  3. CUDA version mismatch")
            return None

        logger.info("✅ vLLM service started successfully")
        return process

    except Exception as e:
        logger.error(f"Failed to start LLM service: {e}")
        logger.error(f"Command: {' '.join(cmd)}")
        return None


def launch_vision_ocr_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch Vision OCR service (LLaVA)"""
    logger.info(f"Starting Vision OCR on port {port}")
    
    # TODO: Implement actual LLaVA service
    # For now, return a placeholder
    cmd = [
        "python3", "-c",
        f"from fastapi import FastAPI; import uvicorn; app = FastAPI(); "
        f"uvicorn.run(app, host='0.0.0.0', port={port})"
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return process
    except Exception as e:
        logger.error(f"Failed to start Vision OCR service: {e}")
        return None


def launch_rag_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch RAG embeddings service"""
    logger.info(f"Starting RAG embeddings on port {port}")
    
    # TODO: Implement actual RAG service
    cmd = [
        "python3", "-c",
        f"from fastapi import FastAPI; import uvicorn; app = FastAPI(); "
        f"uvicorn.run(app, host='0.0.0.0', port={port})"
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return process
    except Exception as e:
        logger.error(f"Failed to start RAG service: {e}")
        return None


# CPU Service Launchers

def launch_ner_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch Named Entity Recognition service"""
    logger.info(f"Starting NER extraction on port {port}")
    
    cmd = [
        "python3", "-c",
        f"from fastapi import FastAPI; import uvicorn; app = FastAPI(); "
        f"uvicorn.run(app, host='0.0.0.0', port={port})"
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return process
    except Exception as e:
        logger.error(f"Failed to start NER service: {e}")
        return None


def launch_document_processing_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch document processing service"""
    logger.info(f"Starting document processing on port {port}")
    
    cmd = [
        "python3", "-c",
        f"from fastapi import FastAPI; import uvicorn; app = FastAPI(); "
        f"uvicorn.run(app, host='0.0.0.0', port={port})"
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return process
    except Exception as e:
        logger.error(f"Failed to start document processing service: {e}")
        return None


def launch_notes_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch notes to CoA service"""
    logger.info(f"Starting notes to CoA on port {port}")
    
    cmd = [
        "python3", "-c",
        f"from fastapi import FastAPI; import uvicorn; app = FastAPI(); "
        f"uvicorn.run(app, host='0.0.0.0', port={port})"
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return process
    except Exception as e:
        logger.error(f"Failed to start notes service: {e}")
        return None


# Storage Service Launchers

def launch_chromadb_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch ChromaDB vector database"""
    logger.info(f"Starting ChromaDB on port {port}")
    
    cmd = [
        "uvicorn",
        "chromadb.app:app",
        "--host", "0.0.0.0",
        "--port", str(port)
    ]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={
                **subprocess.os.environ,
                "CHROMA_SERVER_CORS_ALLOW_ORIGINS": '["*"]',
                "CHROMA_SERVER_HOST": "0.0.0.0",
                "CHROMA_SERVER_HTTP_PORT": str(port)
            }
        )
        return process
    except Exception as e:
        logger.error(f"Failed to start ChromaDB service: {e}")
        return None


def launch_redis_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch Redis cache"""
    logger.info(f"Starting Redis on port {port}")
    
    cmd = ["redis-server", "--port", str(port), "--bind", "0.0.0.0"]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return process
    except Exception as e:
        logger.error(f"Failed to start Redis service: {e}")
        return None


def launch_postgres_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch PostgreSQL database"""
    logger.info(f"Starting PostgreSQL on port {port}")
    
    # TODO: Implement PostgreSQL launcher
    logger.warning("PostgreSQL launcher not implemented yet")
    return None


def launch_minio_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch MinIO object storage"""
    logger.info(f"Starting MinIO on port {port}")
    
    # TODO: Implement MinIO launcher
    logger.warning("MinIO launcher not implemented yet")
    return None


def launch_neo4j_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch Neo4j graph database"""
    logger.info(f"Starting Neo4j on port {port}")
    
    # TODO: Implement Neo4j launcher
    logger.warning("Neo4j launcher not implemented yet")
    return None


# Edge/Coordination Service Launchers

def launch_coordinator_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch local coordinator service (FastAPI)"""
    logger.info(f"Starting Coordinator on port {port}")
    
    # Check if coordinator code exists
    coordinator_path = "/app/services/coordinator/app.py"
    if not subprocess.os.path.exists(coordinator_path):
        logger.error("Coordinator code not found in container")
        return None
    
    cmd = [
        "python3", coordinator_path,
        "--host", "0.0.0.0",
        "--port", str(port)
    ]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={
                **subprocess.os.environ,
                "PORT": str(port),
                "HOST": "0.0.0.0"
            }
        )
        logger.info("✅ Coordinator service started (worker registry)")
        return process
    except Exception as e:
        logger.error(f"Failed to start Coordinator service: {e}")
        return None


def launch_edge_proxy_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch edge proxy service (lightweight routing layer)"""
    logger.info(f"Starting Edge Proxy on port {port}")
    
    # Simple FastAPI proxy that routes to coordinator
    proxy_code = f"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import httpx

app = FastAPI()
COORDINATOR_URL = "http://localhost:8080"

@app.api_route("/{{path:path}}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy(request: Request, path: str):
    async with httpx.AsyncClient() as client:
        url = f"{{COORDINATOR_URL}}/{{path}}"
        response = await client.request(
            method=request.method,
            url=url,
            headers=dict(request.headers),
            content=await request.body()
        )
        return JSONResponse(content=response.json(), status_code=response.status_code)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port={port})
"""
    
    # Write proxy code to temp file
    proxy_file = "/tmp/edge_proxy.py"
    with open(proxy_file, "w") as f:
        f.write(proxy_code)
    
    cmd = ["python3", proxy_file]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        logger.info("✅ Edge Proxy started (routing layer)")
        return process
    except Exception as e:
        logger.error(f"Failed to start Edge Proxy: {e}")
        return None


def launch_load_balancer_service(port: int, capabilities: Dict[str, Any]) -> Optional[subprocess.Popen]:
    """Launch load balancer service"""
    logger.info(f"Starting Load Balancer on port {port}")
    
    # Simple load balancer using FastAPI
    lb_code = f"""
from fastapi import FastAPI, Request
from fastapi.responses import Response
import httpx
import itertools

app = FastAPI()
backends = itertools.cycle([])  # Will be populated from coordinator

@app.get("/health")
async def health():
    return {{"status": "healthy", "service": "load-balancer"}}

@app.api_route("/{{path:path}}", methods=["GET", "POST", "PUT", "DELETE"])
async def load_balance(request: Request, path: str):
    # TODO: Get backends from coordinator and round-robin
    return {{"error": "No backends available"}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port={port})
"""
    
    # Write LB code to temp file
    lb_file = "/tmp/load_balancer.py"
    with open(lb_file, "w") as f:
        f.write(lb_code)
    
    cmd = ["python3", lb_file]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        logger.info("✅ Load Balancer started")
        return process
    except Exception as e:
        logger.error(f"Failed to start Load Balancer: {e}")
        return None

