"""
RMA Distributed Coordinator Service
Minimal coordinator for managing distributed worker pool
Serves frontend and API endpoints
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import uvicorn
import os
from pathlib import Path

from models.worker import WorkerRegistry
from routers import worker_routes, inference_routes, admin_routes, service_routes, auth_routes
from utils.database import init_db

# Global worker registry
worker_registry = WorkerRegistry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("🚀 Initializing RMA Coordinator Service...")
    init_db()
    worker_registry.start_health_monitor()
    print("✅ Coordinator ready!")

    yield

    # Shutdown
    print("🛑 Shutting down coordinator...")
    worker_registry.stop_health_monitor()


app = FastAPI(
    title="RMA Distributed Coordinator",
    description="Coordinator for distributed RMA worker pool",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (API endpoints)
app.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(worker_routes.router, prefix="/api/worker", tags=["Worker"])
app.include_router(inference_routes.router, prefix="/api/inference", tags=["Inference"])
app.include_router(admin_routes.router, prefix="/api/admin", tags=["Admin"])
app.include_router(service_routes.router, prefix="/api/service", tags=["Services"])

# Serve Next.js static files
STATIC_DIR = Path(__file__).parent.parent / "static"
if STATIC_DIR.exists():
    # Mount Next.js static assets
    app.mount("/_next/static", StaticFiles(directory=str(STATIC_DIR / ".next" / "static")), name="next-static")
    app.mount("/public", StaticFiles(directory=str(STATIC_DIR / "public")), name="public")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve Next.js frontend for all non-API routes"""
        # Skip API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Try to serve the file directly
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        
        # For all other routes, serve the Next.js index (SPA behavior)
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        # Fallback to server.js if using standalone mode
        raise HTTPException(status_code=404, detail="Frontend not built")
else:
    print(f"⚠️  Static directory not found: {STATIC_DIR}")
    print("   Frontend will not be served. Run: cd frontend && npm run build")


@app.get("/api")
async def api_root():
    """API root endpoint"""
    return {
        "status": "healthy",
        "service": "RMA Distributed Coordinator API",
        "version": "1.0.0",
        "active_workers": worker_registry.get_worker_count()
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "workers": {
            "total": worker_registry.get_worker_count(),
            "by_tier": worker_registry.get_worker_count_by_tier(),
            "healthy": worker_registry.get_healthy_worker_count()
        }
    }


# Pass registry to routers
worker_routes.worker_registry = worker_registry
inference_routes.worker_registry = worker_registry
admin_routes.worker_registry = worker_registry
service_routes.worker_registry = worker_registry
 

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=True
    )
