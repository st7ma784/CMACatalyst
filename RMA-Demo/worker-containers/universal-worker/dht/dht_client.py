"""
DHT Client Interface for Universal Workers
Simplified interface for workers to interact with DHT
"""

import asyncio
import logging
import time
import random
from typing import Dict, List, Optional
from .dht_node import DHTNode
from .dht_config import DHTConfig

logger = logging.getLogger(__name__)

# Load configuration
config = DHTConfig.from_env()


class DHTClient:
    """
    High-level DHT client for workers

    Provides simple interface for:
    - Registering worker in DHT
    - Finding other workers by service type
    - Updating worker status
    """

    def __init__(self, worker_id: str, port: int = 8468):
        self.worker_id = worker_id
        self.node = DHTNode(worker_id, port)
        self._task = None

        # Service discovery cache
        self._service_cache: Dict[str, Dict] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._cache_ttl = config.discovery_cache_ttl

    async def connect(self, bootstrap_url: str):
        """
        Connect to DHT network

        Args:
            bootstrap_url: Edge router URL to get DHT seeds
        """
        import requests

        try:
            # Get DHT seeds from edge router
            response = requests.get(f"{bootstrap_url}/api/dht/bootstrap",
                                   timeout=10)
            seeds_data = response.json()

            # Parse seed nodes
            bootstrap_nodes = []
            for seed in seeds_data.get("seeds", []):
                # Extract host and port from tunnel URL
                # Format: https://edge-1.rmatool.org.uk → (edge-1.rmatool.org.uk, 8468)
                host = seed["tunnel_url"].replace("https://", "").replace("http://", "")
                port = seed.get("dht_port", 8468)
                bootstrap_nodes.append((host, port))

            logger.info(f"Bootstrapping DHT with {len(bootstrap_nodes)} seeds")

            # Start DHT node
            await self.node.start(bootstrap_nodes if bootstrap_nodes else None)

            # Start background heartbeat
            self._task = asyncio.create_task(self._heartbeat_loop())

            logger.info("✅ Connected to DHT")

        except Exception as e:
            logger.error(f"Failed to connect to DHT: {e}")
            logger.warning("Falling back to coordinator-only mode")
            raise

    async def register_worker(self, tunnel_url: str, services: List[str],
                             capabilities: Dict):
        """
        Register this worker in DHT

        Args:
            tunnel_url: Worker's tunnel URL for P2P access
            services: List of services offered (e.g., ["ocr", "enhance"])
            capabilities: Hardware capabilities dict
        """
        worker_info = {
            "worker_id": self.worker_id,
            "tunnel_url": tunnel_url,
            "services": services,
            "capabilities": capabilities,
            "last_seen": asyncio.get_event_loop().time()
        }

        # Store worker info
        await self.node.set(f"worker:{self.worker_id}", worker_info)

        # Publish each service
        for service in services:
            await self.node.publish_service(service, self.worker_id, worker_info)

        logger.info(f"Registered in DHT: {services}")

    async def find_worker_for_service(self, service_type: str, use_cache: bool = True) -> Optional[Dict]:
        """
        Find a worker offering a service with caching and smart selection

        Args:
            service_type: Service needed (e.g., "ocr")
            use_cache: Whether to use cached results (default True)

        Returns:
            Worker info dict or None
        """
        # Check cache first
        if use_cache and service_type in self._service_cache:
            cache_age = time.time() - self._cache_timestamps.get(service_type, 0)
            if cache_age < self._cache_ttl:
                logger.debug(f"Using cached worker for {service_type} (age: {cache_age:.1f}s)")
                return self._service_cache[service_type]

        # Query DHT for workers
        workers = await self.node.find_service_workers(service_type)

        if not workers:
            # Remove from cache if service no longer available
            self._service_cache.pop(service_type, None)
            self._cache_timestamps.pop(service_type, None)
            return None

        # Smart worker selection: prefer workers with lower load and better capabilities
        selected = self._select_best_worker(workers, service_type)

        # Cache the result
        self._service_cache[service_type] = selected
        self._cache_timestamps[service_type] = time.time()

        logger.info(f"Selected worker {selected['worker_id']} for {service_type}")
        return selected

    def _select_best_worker(self, workers: List[Dict], service_type: str) -> Dict:
        """
        Select the best worker from available options

        Selection criteria (in order of priority):
        1. Worker health (prefer healthy workers)
        2. Current load (prefer less loaded workers)
        3. Capabilities (prefer better hardware for demanding tasks)
        4. Latency (prefer closer workers - future enhancement)
        5. Random selection for load balancing

        Args:
            workers: List of available workers
            service_type: Type of service requested

        Returns:
            Best worker dict
        """
        if len(workers) == 1:
            return workers[0]

        # Filter out stale workers (not seen in last 5 minutes)
        current_time = time.time()
        healthy_workers = [
            w for w in workers
            if (current_time - w.get('last_seen', 0)) < 300
        ]

        if not healthy_workers:
            # All workers are stale, return random from original list
            return random.choice(workers)

        # Sort by load (if available)
        workers_with_load = [w for w in healthy_workers if 'current_load' in w]
        if workers_with_load:
            # Sort by load (ascending) and take least loaded
            workers_with_load.sort(key=lambda w: w.get('current_load', 1.0))
            # Pick from top 3 least loaded workers (for load balancing)
            top_workers = workers_with_load[:min(3, len(workers_with_load))]
            return random.choice(top_workers)

        # For GPU-intensive tasks, prefer workers with better GPUs
        if service_type in ['ocr', 'enhance', 'chat', 'embedding']:
            gpu_workers = [w for w in healthy_workers if w.get('capabilities', {}).get('has_gpu')]
            if gpu_workers:
                # Prefer T4 > RTX 3090 > RTX 4090 > other (by VRAM and availability)
                gpu_workers.sort(
                    key=lambda w: self._gpu_score(w.get('capabilities', {}).get('gpu_type', '')),
                    reverse=True
                )
                return gpu_workers[0]

        # Default: random selection from healthy workers
        return random.choice(healthy_workers)

    def _gpu_score(self, gpu_type: str) -> int:
        """
        Score GPU by desirability for AI workloads

        Returns:
            Higher score = better GPU
        """
        gpu_type_lower = gpu_type.lower()

        # High-end datacenter GPUs
        if 'a100' in gpu_type_lower or 'h100' in gpu_type_lower:
            return 100
        if 'v100' in gpu_type_lower:
            return 90

        # Mid-range datacenter
        if 't4' in gpu_type_lower:
            return 80
        if 'a10' in gpu_type_lower:
            return 75

        # Consumer high-end
        if '4090' in gpu_type_lower:
            return 70
        if '3090' in gpu_type_lower or '3080' in gpu_type_lower:
            return 65
        if '4080' in gpu_type_lower:
            return 60

        # Consumer mid-range
        if '3070' in gpu_type_lower or '4070' in gpu_type_lower:
            return 50
        if '3060' in gpu_type_lower or '4060' in gpu_type_lower:
            return 40

        # Default
        return 10

    def clear_cache(self, service_type: Optional[str] = None):
        """
        Clear service discovery cache

        Args:
            service_type: Specific service to clear, or None to clear all
        """
        if service_type:
            self._service_cache.pop(service_type, None)
            self._cache_timestamps.pop(service_type, None)
            logger.debug(f"Cleared cache for {service_type}")
        else:
            self._service_cache.clear()
            self._cache_timestamps.clear()
            logger.debug("Cleared all service cache")

    async def _heartbeat_loop(self):
        """Background task to update DHT presence"""
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds

                # Update last_seen timestamp
                worker_info = await self.node.get(f"worker:{self.worker_id}")
                if worker_info:
                    worker_info["last_seen"] = asyncio.get_event_loop().time()
                    await self.node.set(f"worker:{self.worker_id}", worker_info)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"DHT heartbeat failed: {e}")

    async def disconnect(self):
        """Disconnect from DHT"""
        if self._task:
            self._task.cancel()

        # Unpublish worker
        worker_info = await self.node.get(f"worker:{self.worker_id}")
        if worker_info:
            services = worker_info.get("services", [])
            await self.node.unpublish_worker(self.worker_id, services)

        await self.node.stop()
        logger.info("Disconnected from DHT")
