"""
Service routing endpoints
Routes requests to services running on workers
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional
import httpx
import os

router = APIRouter()
worker_registry = None  # Injected from main.py


async def proxy_to_service(
    service_name: str,
    path: str,
    request: Request,
    tier: int = 2
):
    """
    Generic service proxy
    Finds a worker running the specified service and forwards the request
    
    Strategy:
    1. Try to find a worker with the service and route to worker's IP
    2. If no worker IP, try docker network service name (e.g., http://upload-service:8103)
    3. Fallback to environment variable for direct URL
    """
    
    # Find available workers with this service
    available_workers = worker_registry.get_available_workers(tier=tier)
    service_workers = [
        w for w in available_workers
        if any(service_name in c.name.lower() for c in w.assigned_containers)
    ]

    worker_url = None

    if service_workers:
        # Found workers with this service
        workers_with_ip = [w for w in service_workers if w.ip_address]
        
        if workers_with_ip:
            # Route to worker IP/tunnel URL
            selected_worker = min(workers_with_ip, key=lambda w: w.current_load)
            container = next(
                (c for c in selected_worker.assigned_containers 
                 if service_name in c.name.lower()),
                None
            )
            if container:
                # Use tunnel URL if available, otherwise use IP
                if hasattr(selected_worker, 'tunnel_url') and selected_worker.tunnel_url:
                    worker_url = f"{selected_worker.tunnel_url}/{path}"
                else:
                    # For local testing: if worker IP looks like a LAN/public IP,
                    # prefer Docker network name since IP won't route to container ports
                    worker_url = None  # Force fallback to Docker network name
    
    # Fallback to Docker network service name
    if not worker_url:
        # Map service name to container name
        service_map = {
            "upload": ("upload-service", 8103),
            "rag": ("rag-service", 8102),
            "notes": ("notes-service", 8100),
            "ner": ("ner-service", 8108),
            "client-rag": ("client-rag-service", 8101),
            "doc-processor": ("doc-processor-service", 8104)
        }
        
        if service_name in service_map:
            container_name, port = service_map[service_name]
            worker_url = f"http://{container_name}:{port}/{path}"
        else:
            # Last resort: environment variable
            fallback_url = os.getenv(f"{service_name.upper().replace('-', '_')}_SERVICE_URL")
            if fallback_url:
                worker_url = f"{fallback_url}/{path}"
    
    if not worker_url:
        raise HTTPException(
            status_code=503,
            detail=f"No workers or services available for {service_name}. Please ensure service containers are running or workers are connected."
        )

    # Forward the request
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Get request body if present
            body = None
            if request.method in ["POST", "PUT", "PATCH"]:
                body = await request.body()
            
            # Prepare headers (exclude host and connection headers)
            headers = {
                k: v for k, v in request.headers.items()
                if k.lower() not in ['host', 'connection', 'content-length']
            }
            
            # Make the request
            response = await client.request(
                method=request.method,
                url=worker_url,
                content=body,
                headers=headers,
                params=request.query_params
            )
            
            # Return response
            return JSONResponse(
                content=response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
                status_code=response.status_code,
                headers=dict(response.headers)
            )
            
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Worker request failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )


@router.api_route("/upload/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def upload_service(path: str, request: Request):
    """Proxy requests to upload service"""
    return await proxy_to_service("upload", path, request, tier=2)


@router.api_route("/rag/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def rag_service(path: str, request: Request):
    """Proxy requests to RAG service"""
    return await proxy_to_service("rag", path, request, tier=2)


@router.api_route("/notes/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def notes_service(path: str, request: Request):
    """Proxy requests to notes service"""
    return await proxy_to_service("notes", path, request, tier=2)


@router.api_route("/ner/{path:path}", methods=["GET", "POST"])
async def ner_service(path: str, request: Request):
    """Proxy requests to NER/graph service"""
    return await proxy_to_service("ner", path, request, tier=2)


@router.api_route("/client-rag/{path:path}", methods=["GET", "POST"])
async def client_rag_service(path: str, request: Request):
    """Proxy requests to client RAG service"""
    return await proxy_to_service("client-rag", path, request, tier=2)


@router.api_route("/doc-processor/{path:path}", methods=["GET", "POST"])
async def doc_processor_service(path: str, request: Request):
    """Proxy requests to document processor service"""
    return await proxy_to_service("doc-processor", path, request, tier=2)
