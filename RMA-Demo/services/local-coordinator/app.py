"""
Local Coordinator Service
FastAPI-based worker registry and state management
Eliminates Cloudflare KV limits with in-memory storage
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import asyncio
import logging
import os
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# In-memory storage
workers: Dict[str, Dict[str, Any]] = {}
services: Dict[str, List[str]] = {}  # service_name -> [worker_ids]

# Service definitions and requirements
SERVICE_CATALOG = {
    # GPU Services (Tier 1)
    "llm-inference": {"tier": 1, "requires": "gpu", "priority": 1, "port": 8105},
    "vision-ocr": {"tier": 1, "requires": "gpu", "priority": 1, "port": 8104},
    "rag-embeddings": {"tier": 1, "requires": "gpu", "priority": 2, "port": 8102},
    
    # CPU Services (Tier 2)
    "ner-extraction": {"tier": 2, "requires": "cpu", "priority": 2, "port": 8108},
    "document-processing": {"tier": 2, "requires": "cpu", "priority": 2, "port": 8103},
    "notes-coa": {"tier": 2, "requires": "cpu", "priority": 3, "port": 8100},
    
    # Storage Services (Tier 3)
    "chromadb": {"tier": 3, "requires": "storage", "priority": 1, "port": 8000},
    "redis": {"tier": 3, "requires": "storage", "priority": 2, "port": 6379},
    "postgres": {"tier": 3, "requires": "storage", "priority": 3, "port": 5432},
    "minio": {"tier": 3, "requires": "storage", "priority": 4, "port": 9000},
    "neo4j": {"tier": 3, "requires": "storage", "priority": 5, "port": 7474},
    
    # Edge/Coordination Services (Tier 4)
    "coordinator": {"tier": 4, "requires": "edge", "priority": 1, "port": 8080},
    "edge-proxy": {"tier": 4, "requires": "edge", "priority": 1, "port": 8787},
    "load-balancer": {"tier": 4, "requires": "edge", "priority": 2, "port": 8090},
}

# Background task handle
cleanup_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("🚀 Local Coordinator starting up...")
    global cleanup_task
    cleanup_task = asyncio.create_task(cleanup_stale_workers())
    logger.info("✅ Coordinator ready - listening for worker registrations")
    
    yield
    
    # Shutdown
    logger.info("🛑 Coordinator shutting down...")
    if cleanup_task:
        cleanup_task.cancel()
    logger.info("👋 Coordinator stopped")


app = FastAPI(
    title="RMA Local Coordinator",
    description="Worker registry and state management (KV-free)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://rmatool.org.uk,https://api.rmatool.org.uk,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class WorkerRegistration(BaseModel):
    worker_id: str
    tunnel_url: str
    capabilities: Dict[str, Any]
    services: Optional[List[Dict[str, Any]]] = None
    containers: Optional[List[Dict[str, Any]]] = None


class WorkerHeartbeat(BaseModel):
    worker_id: str
    status: str = "healthy"
    current_load: Optional[float] = 0.0
    available_memory: Optional[str] = None
    loaded_models: Optional[List[str]] = []
    active_requests: Optional[int] = 0
    gpu_utilization: Optional[float] = 0.0
    services_status: Optional[Dict[str, str]] = {}
    specialization: Optional[str] = None


class BroadcastJob(BaseModel):
    job_type: str
    job_data: Dict[str, Any]
    required_capability: Optional[str] = None


# API Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    active_workers = len([w for w in workers.values() if is_worker_healthy(w)])
    return {
        "status": "healthy",
        "coordinator": "local-fastapi",
        "timestamp": datetime.now().isoformat(),
        "workers": {
            "total": len(workers),
            "active": active_workers,
            "stale": len(workers) - active_workers
        }
    }


@app.post("/api/worker/register")
async def register_worker(registration: WorkerRegistration):
    """Register a new worker and assign services based on gaps"""
    worker_id = registration.worker_id
    
    # Determine worker type from capabilities
    capabilities = registration.capabilities
    worker_type = determine_worker_type(capabilities)
    tier = determine_tier(capabilities)
    
    # Analyze service gaps and assign services
    assigned_services = assign_services_to_worker(worker_type, tier, capabilities)
    
    # Create worker record
    worker_data = {
        "worker_id": worker_id,
        "tunnel_url": registration.tunnel_url,
        "capabilities": capabilities,
        "worker_type": worker_type,
        "tier": tier,
        "assigned_services": assigned_services,
        "services": registration.services or [],
        "containers": registration.containers or [],
        "registered_at": datetime.now().isoformat(),
        "last_heartbeat": datetime.now().isoformat(),
        "status": "online",
        "tasks_completed": 0
    }
    
    # Store worker
    workers[worker_id] = worker_data
    
    # Index assigned services
    for service_name in assigned_services:
        if service_name not in services:
            services[service_name] = []
        if worker_id not in services[service_name]:
            services[service_name].append(worker_id)
    
    logger.info(f"✅ Registered {worker_type} worker: {worker_id} (Tier {tier})")
    logger.info(f"   Assigned services: {', '.join(assigned_services)}")
    
    return {
        "status": "registered",
        "worker_id": worker_id,
        "worker_type": worker_type,
        "tier": tier,
        "assigned_services": assigned_services,
        "service_configs": [
            {
                "name": svc,
                "port": SERVICE_CATALOG[svc]["port"],
                "priority": SERVICE_CATALOG[svc]["priority"]
            }
            for svc in assigned_services
        ],
        "message": f"Worker registered with {len(assigned_services)} service(s)"
    }


@app.post("/api/worker/heartbeat")
async def worker_heartbeat(heartbeat: WorkerHeartbeat):
    """Process worker heartbeat"""
    worker_id = heartbeat.worker_id
    
    if worker_id not in workers:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    worker = workers[worker_id]
    
    # Update worker state
    worker["last_heartbeat"] = datetime.now().isoformat()
    worker["status"] = heartbeat.status
    worker["current_load"] = heartbeat.current_load
    worker["available_memory"] = heartbeat.available_memory
    worker["loaded_models"] = heartbeat.loaded_models or []
    worker["active_requests"] = heartbeat.active_requests or 0
    worker["gpu_utilization"] = heartbeat.gpu_utilization or 0.0
    worker["services_status"] = heartbeat.services_status or {}
    
    if heartbeat.specialization:
        worker["specialization"] = heartbeat.specialization
    
    # Log periodically (every ~60 heartbeats = 30 minutes at 30s intervals)
    import random
    if random.random() < 0.017:  # ~1.7% chance = roughly once per 30 min
        models_info = f", Models: {', '.join(heartbeat.loaded_models)}" if heartbeat.loaded_models else ""
        logger.info(f"💓 Heartbeat from {worker_id}: CPU {heartbeat.current_load:.0%}{models_info}")
    
    return {"status": "ok"}


@app.delete("/api/worker/unregister/{worker_id}")
async def unregister_worker(worker_id: str):
    """Unregister a worker"""
    if worker_id not in workers:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    # Remove from services index
    for service_list in services.values():
        if worker_id in service_list:
            service_list.remove(worker_id)
    
    # Remove worker
    del workers[worker_id]
    
    logger.info(f"🗑️  Unregistered worker: {worker_id}")
    
    return {"status": "ok", "message": "Worker unregistered"}


@app.get("/api/coordinator/workers")
async def get_workers():
    """Get list of healthy workers (for edge worker cache)"""
    now = datetime.now()
    healthy = []
    
    for worker in workers.values():
        if is_worker_healthy(worker, now):
            healthy.append(worker)
    
    return {
        "workers": healthy,
        "count": len(healthy),
        "timestamp": now.isoformat()
    }


@app.get("/api/admin/workers")
async def list_all_workers():
    """Admin endpoint - list all workers with details"""
    now = datetime.now()
    
    worker_list = []
    for worker in workers.values():
        age_seconds = (now - datetime.fromisoformat(worker["last_heartbeat"])).total_seconds()
        worker_info = {
            **worker,
            "age_seconds": age_seconds,
            "is_healthy": age_seconds < 90
        }
        worker_list.append(worker_info)
    
    return {
        "workers": worker_list,
        "total": len(worker_list),
        "healthy": len([w for w in worker_list if w["is_healthy"]])
    }


@app.get("/api/admin/services")
async def list_services():
    """Admin endpoint - list all services and their workers"""
    service_details = {}
    
    for service_name, worker_ids in services.items():
        healthy_workers = [
            wid for wid in worker_ids
            if wid in workers and is_worker_healthy(workers[wid])
        ]
        
        service_details[service_name] = {
            "name": service_name,
            "workers": healthy_workers,
            "worker_count": len(healthy_workers)
        }
    
    return {
        "services": list(service_details.values()),
        "total_services": len(service_details)
    }


@app.get("/api/admin/gaps")
async def analyze_service_gaps():
    """Analyze which services need more workers"""
    gaps = []
    
    for svc_name, svc_info in SERVICE_CATALOG.items():
        current_workers = services.get(svc_name, [])
        healthy_count = sum(
            1 for wid in current_workers
            if wid in workers and is_worker_healthy(workers[wid])
        )
        
        # Determine if there's a gap
        status = "ok"
        if healthy_count == 0:
            status = "critical"
        elif healthy_count == 1:
            status = "warning"
        
        gaps.append({
            "service": svc_name,
            "required_type": svc_info["requires"],
            "priority": svc_info["priority"],
            "current_workers": healthy_count,
            "status": status,
            "port": svc_info["port"]
        })
    
    # Sort by status (critical first) then priority
    gaps.sort(key=lambda x: (
        0 if x["status"] == "critical" else (1 if x["status"] == "warning" else 2),
        x["priority"]
    ))
    
    critical = [g for g in gaps if g["status"] == "critical"]
    warnings = [g for g in gaps if g["status"] == "warning"]
    
    return {
        "gaps": gaps,
        "critical_gaps": critical,
        "warnings": warnings,
        "summary": {
            "total_services": len(SERVICE_CATALOG),
            "covered": len([g for g in gaps if g["status"] == "ok"]),
            "needs_attention": len(critical) + len(warnings)
        }
    }


@app.post("/api/coordinator/broadcast-job")
async def broadcast_job(job: BroadcastJob):
    """Broadcast a job to all capable workers"""
    capable_workers = []
    
    # Find workers that can handle this job
    for worker in workers.values():
        if not is_worker_healthy(worker):
            continue
        
        # For RAG/ingestion, prefer GPU/CPU workers (tier <= 2)
        if worker.get("tier", 3) > 2:
            continue
        
        # Check capability if specified
        if job.required_capability:
            caps = worker.get("capabilities", {})
            has_capability = job.required_capability in caps or any(
                job.required_capability in s.get("capabilities", [])
                for s in worker.get("services", [])
            )
            if not has_capability:
                continue
        
        capable_workers.append(worker)
    
    if not capable_workers:
        raise HTTPException(
            status_code=503,
            detail=f"No capable workers available for job type: {job.job_type}"
        )
    
    # Broadcast to all capable workers (simulated - actual implementation would use async HTTP)
    results = []
    for worker in capable_workers:
        results.append({
            "worker_id": worker["worker_id"],
            "status": "queued",
            "message": "Job broadcast successful"
        })
    
    logger.info(f"📢 Broadcast job '{job.job_type}' to {len(capable_workers)} workers")
    
    return {
        "job_type": job.job_type,
        "broadcasted_to": len(capable_workers),
        "successful": len(results),
        "workers": results
    }


# Helper functions

def determine_worker_type(capabilities: Dict[str, Any]) -> str:
    """Determine worker type from capabilities"""
    if capabilities.get("has_gpu") or capabilities.get("worker_type") == "gpu":
        return "gpu"
    elif capabilities.get("has_edge") or capabilities.get("worker_type") == "edge" or capabilities.get("has_public_ip"):
        return "edge"
    elif capabilities.get("has_storage") or capabilities.get("worker_type") == "storage":
        return "storage"
    else:
        return "cpu"


def determine_tier(capabilities: Dict[str, Any]) -> int:
    """Determine worker tier based on capabilities"""
    # Tier 1: GPU workers (highest capability)
    if capabilities.get("has_gpu") or capabilities.get("worker_type") == "gpu":
        return 1
    
    # Tier 2: CPU workers
    if capabilities.get("worker_type") == "cpu":
        return 2
    
    # Tier 3: Storage/infrastructure workers
    if capabilities.get("has_storage") or capabilities.get("worker_type") == "storage":
        return 3
    
    # Tier 4: Edge/Coordination workers (good network, public IP, can host coordinator)
    if capabilities.get("has_edge") or capabilities.get("worker_type") == "edge" or capabilities.get("has_public_ip"):
        return 4
    
    # Default to storage tier if unclear
    return 3


def assign_services_to_worker(worker_type: str, tier: int, capabilities: Dict[str, Any]) -> List[str]:
    """
    Dynamically assign services to worker based on current gaps
    
    Strategy:
    1. Find all services matching worker's capability (gpu/cpu/storage/edge)
    2. Calculate coverage for each service (how many workers already provide it)
    3. Prefer assigning services with lowest coverage (biggest gaps)
    4. Assign multiple services if worker has capacity (unless enough workers exist)
    5. Priority: critical services (priority 1) > nice-to-have (priority 5)
    
    Worker flexibility vs specialization:
    - Workers are flexible: Any worker CAN run ANY service in its tier
    - GPU (Tier 1): Prefer 1 service/worker - model loading is expensive (5-10GB VRAM, 30-60s)
    - CPU (Tier 2): Can handle 2-3 services - minimal overhead switching between them
    - Storage (Tier 3): Can run multiple databases simultaneously - no model concerns
    - Edge (Tier 4): Can run coordinator + proxy together - stateless routing services
    """
    
    # Get all services this worker CAN run
    eligible_services = [
        svc_name for svc_name, svc_info in SERVICE_CATALOG.items()
        if svc_info["requires"] == worker_type
    ]
    
    if not eligible_services:
        logger.warning(f"No eligible services found for worker type: {worker_type}")
        return []
    
    # Calculate service coverage (how many workers already provide each service)
    service_coverage = {}
    for svc_name in eligible_services:
        current_workers = services.get(svc_name, [])
        # Count only healthy workers
        healthy_count = sum(
            1 for wid in current_workers
            if wid in workers and is_worker_healthy(workers[wid])
        )
        service_coverage[svc_name] = healthy_count
    
    # Sort services by:
    # 1. Coverage (ascending - prefer gaps)
    # 2. Priority (ascending - prefer critical services)
    sorted_services = sorted(
        eligible_services,
        key=lambda svc: (
            service_coverage.get(svc, 0),  # Fewest workers first
            SERVICE_CATALOG[svc]["priority"]  # Higher priority (lower number) first
        )
    )
    
    # Decide how many services to assign
    total_workers_in_tier = sum(
        1 for w in workers.values()
        if w.get("tier") == tier and is_worker_healthy(w)
    )
    
    # If we have plenty of workers, specialize (1 service per worker)
    # If we're short on workers, multi-task (assign multiple services)
    if total_workers_in_tier >= len(eligible_services):
        # Enough workers - specialize
        max_services = 1
    elif total_workers_in_tier >= len(eligible_services) / 2:
        # Some workers - assign 2 services
        max_services = 2
    else:
        # Very few workers - assign all critical services
        max_services = min(3, len(eligible_services))
    
    assigned = sorted_services[:max_services]
    
    logger.info(f"   Service gaps for {worker_type}: {service_coverage}")
    logger.info(f"   Workers in tier {tier}: {total_workers_in_tier + 1} (including this one)")
    logger.info(f"   Assignment strategy: {max_services} service(s) per worker")
    
    return assigned


def is_worker_healthy(worker: Dict[str, Any], now: datetime = None) -> bool:
    """Check if worker is healthy (heartbeat within 90 seconds)"""
    if now is None:
        now = datetime.now()
    
    last_heartbeat = datetime.fromisoformat(worker["last_heartbeat"])
    age_seconds = (now - last_heartbeat).total_seconds()
    
    return age_seconds < 90


async def cleanup_stale_workers():
    """Background task to remove stale workers"""
    while True:
        try:
            await asyncio.sleep(60)  # Check every minute
            
            now = datetime.now()
            stale = []
            
            for worker_id, worker in list(workers.items()):
                if not is_worker_healthy(worker, now):
                    age_seconds = (now - datetime.fromisoformat(worker["last_heartbeat"])).total_seconds()
                    if age_seconds > 120:  # 2 minutes stale
                        stale.append(worker_id)
            
            # Remove stale workers
            for worker_id in stale:
                logger.warning(f"🧹 Removing stale worker: {worker_id}")
                
                # Remove from services
                for service_list in services.values():
                    if worker_id in service_list:
                        service_list.remove(worker_id)
                
                # Remove worker
                del workers[worker_id]
            
            if stale:
                logger.info(f"🧹 Cleaned up {len(stale)} stale workers")
                
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")


# Metrics endpoint (optional)
@app.get("/metrics")
async def metrics():
    """Prometheus-compatible metrics"""
    active = len([w for w in workers.values() if is_worker_healthy(w)])
    
    metrics_text = f"""# HELP coordinator_workers_total Total registered workers
# TYPE coordinator_workers_total gauge
coordinator_workers_total {len(workers)}

# HELP coordinator_workers_active Active workers (healthy heartbeat)
# TYPE coordinator_workers_active gauge
coordinator_workers_active {active}

# HELP coordinator_services_total Total services registered
# TYPE coordinator_services_total gauge
coordinator_services_total {len(services)}
"""
    
    return JSONResponse(content=metrics_text, media_type="text/plain")


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8080))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"🚀 Starting coordinator on {host}:{port}")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
