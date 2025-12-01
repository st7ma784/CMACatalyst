"""
Admin dashboard endpoints
"""

from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter()
worker_registry = None  # Injected from main.py


@router.get("/workers")
async def list_workers():
    """
    Get list of all registered workers
    """

    workers_data = []
    for worker in worker_registry.workers.values():
        workers_data.append({
            "worker_id": worker.worker_id,
            "tier": worker.tier,
            "status": worker.status,
            "current_load": worker.current_load,
            "tasks_completed": worker.tasks_completed,
            "assigned_containers": [c.name for c in worker.assigned_containers],
            "last_heartbeat": worker.last_heartbeat.isoformat(),
            "registered_at": worker.registered_at.isoformat(),
            "ip_address": worker.ip_address,
            "capabilities": worker.capabilities.dict()
        })

    return {"workers": workers_data, "total": len(workers_data)}


@router.get("/stats")
async def get_stats():
    """
    Get system statistics
    """

    total_workers = worker_registry.get_worker_count()
    by_tier = worker_registry.get_worker_count_by_tier()
    healthy_count = worker_registry.get_healthy_worker_count()

    # Calculate total tasks completed
    total_tasks = sum(w.tasks_completed for w in worker_registry.workers.values())

    # Calculate average load per tier
    tier_loads = {1: [], 2: [], 3: []}
    for worker in worker_registry.workers.values():
        tier_loads[worker.tier].append(worker.current_load)

    avg_loads = {
        tier: sum(loads) / len(loads) if loads else 0.0
        for tier, loads in tier_loads.items()
    }

    return {
        "total_workers": total_workers,
        "healthy_workers": healthy_count,
        "workers_by_tier": {
            "gpu_workers": by_tier[1],
            "service_workers": by_tier[2],
            "data_workers": by_tier[3]
        },
        "average_load_by_tier": {
            "gpu_workers": avg_loads[1],
            "service_workers": avg_loads[2],
            "data_workers": avg_loads[3]
        },
        "total_tasks_completed": total_tasks
    }


@router.get("/health")
async def admin_health():
    """
    Detailed system health check
    """

    workers_by_status = {"healthy": 0, "degraded": 0, "offline": 0}
    for worker in worker_registry.workers.values():
        workers_by_status[worker.status] += 1

    # Check if we have minimum required workers
    by_tier = worker_registry.get_worker_count_by_tier()
    has_gpu_worker = by_tier[1] > 0
    has_service_worker = by_tier[2] > 0

    overall_status = "healthy"
    if not has_gpu_worker:
        overall_status = "degraded"
    elif not has_service_worker:
        overall_status = "degraded"
    elif workers_by_status["offline"] > workers_by_status["healthy"]:
        overall_status = "degraded"

    return {
        "overall_status": overall_status,
        "workers_by_status": workers_by_status,
        "has_minimum_workers": {
            "gpu_workers": has_gpu_worker,
            "service_workers": has_service_worker
        }
    }
