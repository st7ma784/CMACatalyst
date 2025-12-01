"""
Worker management endpoints
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from models.worker import WorkerCapabilities, Worker

router = APIRouter()
worker_registry = None  # Injected from main.py


class WorkerRegistrationRequest(BaseModel):
    """Worker registration request"""
    capabilities: WorkerCapabilities
    ip_address: Optional[str] = None  # Worker can provide its own public IP


class HeartbeatRequest(BaseModel):
    """Worker heartbeat request"""
    worker_id: str
    status: str = "healthy"
    current_load: float = 0.0
    available_memory: Optional[str] = None


@router.post("/register")
async def register_worker(request: WorkerRegistrationRequest, req: Request):
    """
    Register a new worker node

    Returns assignment including worker_id, tier, and containers to run
    """

    # Extract IP address - prefer worker-provided IP, fallback to request client IP
    ip_address = request.ip_address or (req.client.host if req.client else None)
    
    print(f"🔍 Worker registration: ip_address from body={request.ip_address}, from client={req.client.host if req.client else None}, final={ip_address}")

    # Register worker
    worker = worker_registry.register_worker(
        capabilities=request.capabilities,
        ip_address=ip_address
    )

    return {
        "worker_id": worker.worker_id,
        "tier": worker.tier,
        "assigned_containers": [c.dict() for c in worker.assigned_containers],
        "heartbeat_url": "/api/worker/heartbeat",
        "heartbeat_interval": 30,  # seconds
        "coordinator_url": str(req.base_url).rstrip('/')
    }


@router.post("/heartbeat")
async def worker_heartbeat(heartbeat: HeartbeatRequest):
    """
    Receive worker heartbeat

    Workers should send heartbeats every 30 seconds to maintain healthy status
    """

    worker = worker_registry.get_worker(heartbeat.worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker_registry.update_heartbeat(
        worker_id=heartbeat.worker_id,
        status=heartbeat.status,
        current_load=heartbeat.current_load
    )

    return {"status": "ok", "message": "Heartbeat received"}


@router.delete("/unregister/{worker_id}")
async def unregister_worker(worker_id: str):
    """
    Unregister a worker

    Workers should call this endpoint when shutting down gracefully
    """

    worker = worker_registry.get_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker_registry.unregister_worker(worker_id)

    return {"status": "ok", "message": f"Worker {worker_id} unregistered"}


@router.get("/tasks")
async def get_tasks(worker_id: str):
    """
    Pull tasks for worker (pull model)

    Workers poll this endpoint to check for new tasks
    """

    worker = worker_registry.get_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # TODO: Implement task queue
    # For now, return empty task list
    return {"tasks": []}


@router.post("/task-complete")
async def task_complete(worker_id: str, task_id: str, result: dict):
    """
    Report task completion

    Workers call this endpoint after completing a task
    """

    worker = worker_registry.get_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Update task completion count
    worker.tasks_completed += 1

    # TODO: Store task result

    return {"status": "ok", "message": "Task result received"}
