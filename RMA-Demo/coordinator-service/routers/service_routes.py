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
    Routes requests to services via worker's ngrok tunnel URL
    
    Priority:
    1. Worker's tunnel_url (ngrok) - for production
    2. Docker network (upload-service:8103) - for local dev
    3. Environment variable fallback
    """
    
    # Find available workers with this service
    available_workers = worker_registry.get_available_workers(tier=tier)
    service_workers = [
        w for w in available_workers
        if any(service_name in c.name.lower() for c in w.assigned_containers)
    ]

    worker_url = None

    if service_workers:
        # Found workers with this service - use their tunnel URL
        workers_with_tunnel = [w for w in service_workers 
                               if hasattr(w, 'tunnel_url') and w.tunnel_url]
        
        if workers_with_tunnel:
            # Route to worker's ngrok tunnel
            selected_worker = min(workers_with_tunnel, key=lambda w: w.current_load)
            
            # ngrok URL should already include the service path like:
            # https://cesar-uneuphemistic-unloyally.ngrok-free.dev/upload
            # So we just append the path
            base_url = selected_worker.tunnel_url.rstrip('/')
            worker_url = f"{base_url}/{path.lstrip('/')}"
            
            print(f"🔀 Routing {service_name}/{path} to worker {selected_worker.worker_id}: {worker_url}")
    
    # Fallback to Docker network service name (local development)
    if not worker_url:
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
            print(f"🔀 Routing {service_name}/{path} to Docker network: {worker_url}")
    
    if not worker_url:
        raise HTTPException(
            status_code=503,
            detail=f"No workers available for {service_name}. Ensure workers are registered with tunnel URLs."
        )

    # Forward the request
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Get request body if present
            body = None
            if request.method in ["POST", "PUT", "PATCH"]:
                body = await request.body()
            
            # Prepare headers (exclude problematic headers)
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
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type:
                return JSONResponse(
                    content=response.json(),
                    status_code=response.status_code,
                    headers={k: v for k, v in response.headers.items() 
                            if k.lower() not in ['content-length', 'transfer-encoding']}
                )
            else:
                return JSONResponse(
                    content={"data": response.text},
                    status_code=response.status_code
                )
            
    except httpx.HTTPError as e:
        print(f"❌ Proxy error for {service_name}/{path}: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach service: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Unexpected error for {service_name}/{path}: {str(e)}")
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
