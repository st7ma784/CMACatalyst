"""
Worker models and registry
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Literal
from datetime import datetime, timedelta
import uuid
import threading
import time
import json
import os
from pathlib import Path


class WorkerCapabilities(BaseModel):
    """Hardware capabilities of a worker"""
    gpu_memory: Optional[str] = None  # e.g., "16GB"
    gpu_type: Optional[str] = None    # e.g., "NVIDIA RTX 4090"
    cpu_cores: int
    ram: str                          # e.g., "64GB"
    storage: Optional[str] = None     # e.g., "1TB"
    network_bandwidth: Optional[str] = None


class ContainerAssignment(BaseModel):
    """Container assignment for worker"""
    name: str
    image: str
    port: int
    env: Dict[str, str]


class Worker(BaseModel):
    """Worker node representation"""
    worker_id: str = Field(default_factory=lambda: f"worker-{uuid.uuid4().hex[:8]}")
    capabilities: WorkerCapabilities
    tier: int  # 1=GPU, 2=Service, 3=Data
    assigned_containers: List[ContainerAssignment] = []
    status: Literal["healthy", "degraded", "offline"] = "healthy"
    last_heartbeat: datetime = Field(default_factory=datetime.utcnow)
    registered_at: datetime = Field(default_factory=datetime.utcnow)
    current_load: float = 0.0  # 0.0 to 1.0
    ip_address: Optional[str] = None
    tunnel_url: Optional[str] = None  # Cloudflare tunnel URL for reverse proxy
    port: Optional[int] = None
    tasks_completed: int = 0


class WorkerRegistry:
    """Registry for managing workers"""

    def __init__(self, persistence_file: str = None):
        self.workers: Dict[str, Worker] = {}
        self._lock = threading.Lock()
        self._health_monitor_running = False
        self._health_monitor_thread = None
        
        # Use /tmp for writable storage on Render, or disable persistence
        if persistence_file is None:
            persistence_file = os.getenv("WORKER_PERSISTENCE_FILE", "/tmp/workers.json")
        
        self.persistence_file = persistence_file
        self._load_workers()

    def register_worker(self, capabilities: WorkerCapabilities, ip_address: str = None, tunnel_url: str = None) -> Worker:
        """Register a new worker and assign tier + containers"""

        # Determine tier based on capabilities
        tier = self._determine_tier(capabilities)

        # Create worker
        worker = Worker(
            capabilities=capabilities,
            tier=tier,
            ip_address=ip_address,
            tunnel_url=tunnel_url
        )

        # Assign containers
        worker.assigned_containers = self._assign_containers(worker)

        with self._lock:
            self.workers[worker.worker_id] = worker

        print(f"✅ Registered worker {worker.worker_id} (Tier {tier})")
        self._save_workers()
        return worker

    def _determine_tier(self, capabilities: WorkerCapabilities) -> int:
        """Determine worker tier based on capabilities"""

        # Tier 1: GPU workers
        if capabilities.gpu_memory and capabilities.gpu_type:
            gpu_memory_gb = int(''.join(filter(str.isdigit, capabilities.gpu_memory)))
            if gpu_memory_gb >= 8:  # Minimum 8GB VRAM for GPU tasks
                return 1

        # Tier 2: Service workers
        ram_gb = int(''.join(filter(str.isdigit, capabilities.ram)))
        if ram_gb >= 4 and capabilities.cpu_cores >= 2:
            return 2

        # Tier 3: Data workers
        return 3

    def _assign_containers(self, worker: Worker) -> List[ContainerAssignment]:
        """Assign appropriate containers based on worker tier and current needs"""

        assignments = []

        if worker.tier == 1:  # GPU worker
            # Check what GPU services are needed
            vllm_workers = self._count_workers_by_container("rma-vllm-worker")
            vision_workers = self._count_workers_by_container("rma-ollama-vision-worker")

            # Balance GPU workloads
            if vllm_workers <= vision_workers:
                assignments.append(ContainerAssignment(
                    name="rma-vllm-worker",
                    image="ghcr.io/rma/vllm-worker:latest",
                    port=8000,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id,
                        "MODEL_NAME": "meta-llama/Llama-2-7b-hf",
                        "GPU_MEMORY_UTILIZATION": "0.9"
                    }
                ))
            else:
                assignments.append(ContainerAssignment(
                    name="rma-ollama-vision-worker",
                    image="ghcr.io/rma/ollama-vision-worker:latest",
                    port=11434,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id,
                        "OLLAMA_HOST": "0.0.0.0:11434"
                    }
                ))

        elif worker.tier == 2:  # Service worker
            # Assign service based on current distribution
            service_distribution = self._get_service_distribution()

            # Find service with lowest worker count
            min_service = min(service_distribution, key=service_distribution.get)

            service_configs = {
                "upload": ContainerAssignment(
                    name="rma-upload-worker",
                    image="ghcr.io/rma/upload-worker:latest",
                    port=8103,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id,
                        "JWT_SECRET": "production-secret-change-this"
                    }
                ),
                "rag": ContainerAssignment(
                    name="rma-rag-worker",
                    image="ghcr.io/rma/rag-worker:latest",
                    port=8102,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id
                    }
                ),
                "notes": ContainerAssignment(
                    name="rma-notes-worker",
                    image="ghcr.io/rma/notes-worker:latest",
                    port=8100,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id
                    }
                ),
                "ner": ContainerAssignment(
                    name="rma-ner-worker",
                    image="ghcr.io/rma/ner-worker:latest",
                    port=8108,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id
                    }
                ),
                "client-rag": ContainerAssignment(
                    name="rma-client-rag-worker",
                    image="ghcr.io/rma/client-rag-worker:latest",
                    port=8101,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id
                    }
                ),
                "doc-processor": ContainerAssignment(
                    name="rma-doc-processor-worker",
                    image="ghcr.io/rma/doc-processor-worker:latest",
                    port=8104,
                    env={
                        "COORDINATOR_URL": "http://coordinator:8080",
                        "WORKER_ID": worker.worker_id
                    }
                )
            }

            assignments.append(service_configs[min_service])

        elif worker.tier == 3:  # Data worker
            # Assign data store based on current needs
            data_distribution = self._get_data_distribution()
            min_data = min(data_distribution, key=data_distribution.get)

            data_configs = {
                "postgres": ContainerAssignment(
                    name="rma-postgres-worker",
                    image="postgres:16-alpine",
                    port=5432,
                    env={
                        "POSTGRES_USER": "rma_user",
                        "POSTGRES_PASSWORD": "rma_password",
                        "POSTGRES_DB": "rma_db"
                    }
                ),
                "neo4j": ContainerAssignment(
                    name="rma-neo4j-worker",
                    image="neo4j:5.15",
                    port=7687,
                    env={
                        "NEO4J_AUTH": "neo4j/changeme"
                    }
                ),
                "redis": ContainerAssignment(
                    name="rma-redis-worker",
                    image="redis:7-alpine",
                    port=6379,
                    env={}
                )
            }

            assignments.append(data_configs.get(min_data, data_configs["redis"]))

        return assignments

    def _count_workers_by_container(self, container_name: str) -> int:
        """Count workers running specific container"""
        count = 0
        for worker in self.workers.values():
            if any(c.name == container_name for c in worker.assigned_containers):
                count += 1
        return count

    def _get_service_distribution(self) -> Dict[str, int]:
        """Get distribution of service workers"""
        distribution = {
            "upload": 0,
            "rag": 0,
            "notes": 0,
            "ner": 0,
            "client-rag": 0,
            "doc-processor": 0
        }
        for worker in self.workers.values():
            if worker.tier == 2:
                for container in worker.assigned_containers:
                    if "upload" in container.name:
                        distribution["upload"] += 1
                    elif "rag" in container.name and "client" not in container.name:
                        distribution["rag"] += 1
                    elif "notes" in container.name:
                        distribution["notes"] += 1
                    elif "ner" in container.name:
                        distribution["ner"] += 1
                    elif "client-rag" in container.name:
                        distribution["client-rag"] += 1
                    elif "doc-processor" in container.name:
                        distribution["doc-processor"] += 1
        return distribution

    def _get_data_distribution(self) -> Dict[str, int]:
        """Get distribution of data workers"""
        distribution = {"postgres": 0, "neo4j": 0, "redis": 0}
        for worker in self.workers.values():
            if worker.tier == 3:
                for container in worker.assigned_containers:
                    if "postgres" in container.name:
                        distribution["postgres"] += 1
                    elif "neo4j" in container.name:
                        distribution["neo4j"] += 1
                    elif "redis" in container.name:
                        distribution["redis"] += 1
        return distribution

    def update_heartbeat(self, worker_id: str, status: str, current_load: float):
        """Update worker heartbeat"""
        with self._lock:
            if worker_id in self.workers:
                self.workers[worker_id].last_heartbeat = datetime.utcnow()
                self.workers[worker_id].status = status
                self.workers[worker_id].current_load = current_load
                # Save periodically (every heartbeat might be too frequent in production)
                self._save_workers()

    def unregister_worker(self, worker_id: str):
        """Remove worker from registry"""
        with self._lock:
            if worker_id in self.workers:
                del self.workers[worker_id]
                print(f"❌ Unregistered worker {worker_id}")
                self._save_workers()

    def get_worker(self, worker_id: str) -> Optional[Worker]:
        """Get worker by ID"""
        return self.workers.get(worker_id)

    def get_workers_by_tier(self, tier: int) -> List[Worker]:
        """Get all workers of specific tier"""
        return [w for w in self.workers.values() if w.tier == tier]

    def get_available_workers(self, tier: int) -> List[Worker]:
        """Get healthy, low-load workers of specific tier"""
        return [
            w for w in self.workers.values()
            if w.tier == tier and w.status == "healthy" and w.current_load < 0.8
        ]

    def get_worker_count(self) -> int:
        """Get total worker count"""
        return len(self.workers)

    def get_worker_count_by_tier(self) -> Dict[int, int]:
        """Get worker count by tier"""
        distribution = {1: 0, 2: 0, 3: 0}
        for worker in self.workers.values():
            distribution[worker.tier] += 1
        return distribution

    def get_healthy_worker_count(self) -> int:
        """Get count of healthy workers"""
        return sum(1 for w in self.workers.values() if w.status == "healthy")

    def start_health_monitor(self):
        """Start background health monitoring"""
        self._health_monitor_running = True
        self._health_monitor_thread = threading.Thread(target=self._health_monitor_loop, daemon=True)
        self._health_monitor_thread.start()

    def stop_health_monitor(self):
        """Stop health monitoring"""
        self._health_monitor_running = False
        if self._health_monitor_thread:
            self._health_monitor_thread.join(timeout=5)

    def _health_monitor_loop(self):
        """Background loop to monitor worker health"""
        while self._health_monitor_running:
            current_time = datetime.utcnow()
            modified = False

            with self._lock:
                for worker_id, worker in list(self.workers.items()):
                    time_since_heartbeat = current_time - worker.last_heartbeat

                    # Mark as offline if no heartbeat for 5 minutes (more lenient)
                    if time_since_heartbeat > timedelta(minutes=5):
                        if worker.status != "offline":
                            print(f"⚠️ Worker {worker_id} offline (no heartbeat for {time_since_heartbeat})")
                            worker.status = "offline"
                            modified = True

                    # Remove if offline for 30 minutes (increased tolerance)
                    elif time_since_heartbeat > timedelta(minutes=30):
                        print(f"🗑️ Removing offline worker {worker_id}")
                        del self.workers[worker_id]
                        modified = True

            if modified:
                self._save_workers()

            time.sleep(30)  # Check every 30 seconds

    def _save_workers(self):
        """Save worker registry to disk"""
        try:
            # Ensure directory exists
            persist_dir = os.path.dirname(self.persistence_file)
            if persist_dir:  # Only create if there's a directory component
                os.makedirs(persist_dir, exist_ok=True)
            
            # Convert workers to dict format
            workers_data = {
                worker_id: {
                    "worker_id": worker.worker_id,
                    "capabilities": worker.capabilities.dict(),
                    "tier": worker.tier,
                    "status": worker.status,
                    "last_heartbeat": worker.last_heartbeat.isoformat(),
                    "registered_at": worker.registered_at.isoformat(),
                    "current_load": worker.current_load,
                    "ip_address": worker.ip_address,
                    "tunnel_url": worker.tunnel_url,
                    "port": worker.port,
                    "tasks_completed": worker.tasks_completed,
                    "assigned_containers": [c.dict() for c in worker.assigned_containers]
                }
                for worker_id, worker in self.workers.items()
            }
            
            # Write to file atomically
            temp_file = self.persistence_file + ".tmp"
            with open(temp_file, 'w') as f:
                json.dump(workers_data, f, indent=2)
            os.replace(temp_file, self.persistence_file)
            
        except PermissionError as e:
            print(f"⚠️ No write permission for worker persistence ({self.persistence_file}), running in-memory only")
        except Exception as e:
            print(f"⚠️ Failed to save workers: {e}")

    def _load_workers(self):
        """Load worker registry from disk"""
        try:
            if not os.path.exists(self.persistence_file):
                print("ℹ️ No existing worker registry found, starting fresh")
                return
            
            with open(self.persistence_file, 'r') as f:
                workers_data = json.load(f)
            
            for worker_id, data in workers_data.items():
                # Reconstruct worker object
                worker = Worker(
                    worker_id=data["worker_id"],
                    capabilities=WorkerCapabilities(**data["capabilities"]),
                    tier=data["tier"],
                    status=data["status"],
                    last_heartbeat=datetime.fromisoformat(data["last_heartbeat"]),
                    registered_at=datetime.fromisoformat(data["registered_at"]),
                    current_load=data["current_load"],
                    ip_address=data.get("ip_address"),
                    tunnel_url=data.get("tunnel_url"),
                    port=data.get("port"),
                    tasks_completed=data["tasks_completed"],
                    assigned_containers=[ContainerAssignment(**c) for c in data["assigned_containers"]]
                )
                self.workers[worker_id] = worker
            
            print(f"✅ Loaded {len(self.workers)} workers from disk")
            
        except Exception as e:
            print(f"⚠️ Failed to load workers: {e}, starting fresh")
