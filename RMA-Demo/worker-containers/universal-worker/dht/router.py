"""
DHT Request Router

Routes service requests to appropriate workers via DHT.
Implements finger caching and load balancing for efficient routing.
"""

import asyncio
import logging
import time
import random
from typing import Dict, List, Optional, Any
import httpx

logger = logging.getLogger(__name__)


class DHTRouter:
    """
    Routes requests to workers via DHT

    Features:
    - Local service handling (if worker provides service)
    - DHT-based service discovery
    - Finger cache for fast lookups (60s TTL)
    - Load balancing across multiple workers
    - VPN-first routing (fallback to tunnels)
    - Request forwarding via HTTP
    """

    def __init__(self, dht_node, local_services: List[str], worker_id: str):
        """
        Initialize DHT router

        Args:
            dht_node: DHTNode instance for service discovery
            local_services: List of services this worker provides
            worker_id: This worker's ID
        """
        self.dht = dht_node
        self.local_services = set(local_services)
        self.worker_id = worker_id

        # Finger cache: service -> {worker_info, timestamp}
        self.finger_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = 60  # Cache entries valid for 60 seconds

        # Request statistics
        self.stats = {
            "local_requests": 0,
            "forwarded_requests": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "dht_lookups": 0,
            "failed_requests": 0
        }

        logger.info(f"DHT Router initialized for {worker_id}")
        logger.info(f"   Local services: {list(self.local_services)}")

    async def route_request(
        self,
        service_type: str,
        request_data: Dict[str, Any],
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Route request to appropriate worker

        Args:
            service_type: Type of service requested (e.g., "llm-inference")
            request_data: Request payload
            timeout: Request timeout in seconds

        Returns:
            Response from the service

        Raises:
            ServiceNotFoundError: If no worker provides the service
            RequestForwardingError: If forwarding fails
        """
        logger.info(f"Routing request for service: {service_type}")

        # Step 1: Can we handle it locally?
        if service_type in self.local_services:
            logger.info(f"✅ Handling {service_type} locally")
            self.stats["local_requests"] += 1
            return await self._handle_local(service_type, request_data)

        # Step 2: Check finger cache
        cached_worker = self._get_cached_worker(service_type)
        if cached_worker:
            logger.debug(f"Cache hit for {service_type}: {cached_worker['worker_id']}")
            self.stats["cache_hits"] += 1

            try:
                response = await self._forward_request(
                    cached_worker,
                    service_type,
                    request_data,
                    timeout
                )
                self.stats["forwarded_requests"] += 1
                return response

            except Exception as e:
                logger.warning(f"Cached worker failed: {e}, invalidating cache")
                self._invalidate_cache(service_type)
                # Continue to DHT lookup

        # Step 3: DHT lookup
        logger.info(f"Cache miss for {service_type}, querying DHT")
        self.stats["cache_misses"] += 1
        self.stats["dht_lookups"] += 1

        workers = await self._find_service_workers(service_type)

        if not workers:
            logger.error(f"No workers found for service: {service_type}")
            self.stats["failed_requests"] += 1
            raise ServiceNotFoundError(f"No workers provide service: {service_type}")

        # Step 4: Select best worker
        best_worker = self._select_best_worker(workers, service_type)
        logger.info(f"Selected worker {best_worker['worker_id']} for {service_type}")

        # Step 5: Cache the worker
        self._cache_worker(service_type, best_worker)

        # Step 6: Forward request
        try:
            response = await self._forward_request(
                best_worker,
                service_type,
                request_data,
                timeout
            )
            self.stats["forwarded_requests"] += 1
            return response

        except Exception as e:
            logger.error(f"Request forwarding failed: {e}")
            self.stats["failed_requests"] += 1
            raise RequestForwardingError(f"Failed to forward request: {e}")

    async def _handle_local(
        self,
        service_type: str,
        request_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle request locally

        Note: This is a placeholder. In production, this would call the
        actual service running on this worker.

        Args:
            service_type: Service type
            request_data: Request data

        Returns:
            Service response
        """
        # In production, this would route to the actual local service
        # For now, return a mock response
        logger.info(f"Processing {service_type} request locally")

        return {
            "status": "success",
            "message": f"Processed by {self.worker_id}",
            "service": service_type,
            "data": request_data
        }

    async def _find_service_workers(self, service_type: str) -> List[Dict[str, Any]]:
        """
        Find workers offering a service via DHT

        Args:
            service_type: Service to find

        Returns:
            List of worker info dictionaries
        """
        if not self.dht or not self.dht.is_running:
            logger.warning("DHT not available")
            return []

        try:
            workers = await self.dht.find_service_workers(service_type)
            logger.info(f"Found {len(workers)} workers for {service_type}")
            return workers

        except Exception as e:
            logger.error(f"DHT lookup failed: {e}")
            return []

    def _select_best_worker(
        self,
        workers: List[Dict[str, Any]],
        service_type: str
    ) -> Dict[str, Any]:
        """
        Select best worker from available workers

        Selection criteria:
        1. Prefer workers with VPN IP (faster P2P)
        2. Prefer workers with lower load
        3. Random selection if tie (load balancing)

        Args:
            workers: List of available workers
            service_type: Service type being requested

        Returns:
            Selected worker info
        """
        if not workers:
            raise ServiceNotFoundError("No workers available")

        # Filter workers with VPN IP (preferred)
        vpn_workers = [w for w in workers if w.get("vpn_ip")]
        candidates = vpn_workers if vpn_workers else workers

        # Sort by load (lower is better)
        sorted_workers = sorted(
            candidates,
            key=lambda w: w.get("load", 0.5)
        )

        # Select from top 3 lowest-load workers (randomized for load balancing)
        top_workers = sorted_workers[:min(3, len(sorted_workers))]
        selected = random.choice(top_workers)

        logger.debug(
            f"Selected {selected['worker_id']} "
            f"(load: {selected.get('load', 'unknown')}, "
            f"vpn: {selected.get('vpn_ip', 'no')})"
        )

        return selected

    async def _forward_request(
        self,
        worker: Dict[str, Any],
        service_type: str,
        request_data: Dict[str, Any],
        timeout: int
    ) -> Dict[str, Any]:
        """
        Forward request to worker

        Tries VPN IP first (faster P2P), falls back to tunnel URL

        Args:
            worker: Worker info (must have vpn_ip or tunnel_url)
            service_type: Service type
            request_data: Request payload
            timeout: Request timeout

        Returns:
            Service response

        Raises:
            RequestForwardingError: If forwarding fails
        """
        vpn_ip = worker.get("vpn_ip")
        tunnel_url = worker.get("tunnel_url")
        worker_id = worker.get("worker_id", "unknown")

        # Try VPN first (if available)
        if vpn_ip:
            try:
                logger.debug(f"Forwarding to {worker_id} via VPN: {vpn_ip}")
                return await self._send_request(
                    f"http://{vpn_ip}:8000/service/{service_type}",
                    request_data,
                    timeout
                )
            except Exception as e:
                logger.warning(f"VPN forward failed: {e}, trying tunnel...")

        # Fallback to tunnel URL
        if tunnel_url:
            try:
                logger.debug(f"Forwarding to {worker_id} via tunnel: {tunnel_url}")
                return await self._send_request(
                    f"{tunnel_url}/service/{service_type}",
                    request_data,
                    timeout
                )
            except Exception as e:
                logger.error(f"Tunnel forward failed: {e}")
                raise RequestForwardingError(f"Both VPN and tunnel failed: {e}")

        raise RequestForwardingError(f"Worker {worker_id} has no reachable address")

    async def _send_request(
        self,
        url: str,
        request_data: Dict[str, Any],
        timeout: int
    ) -> Dict[str, Any]:
        """
        Send HTTP request to worker

        Args:
            url: Target URL
            request_data: Request payload
            timeout: Timeout in seconds

        Returns:
            Response JSON

        Raises:
            httpx.RequestError: If request fails
        """
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=request_data)
            response.raise_for_status()
            return response.json()

    def _get_cached_worker(self, service_type: str) -> Optional[Dict[str, Any]]:
        """
        Get cached worker for service (if not expired)

        Args:
            service_type: Service type

        Returns:
            Cached worker info or None
        """
        if service_type not in self.finger_cache:
            return None

        cached = self.finger_cache[service_type]
        age = time.time() - cached["timestamp"]

        if age > self.cache_ttl:
            # Cache expired
            del self.finger_cache[service_type]
            return None

        return cached["worker"]

    def _cache_worker(self, service_type: str, worker: Dict[str, Any]):
        """
        Cache worker for service

        Args:
            service_type: Service type
            worker: Worker info to cache
        """
        self.finger_cache[service_type] = {
            "worker": worker,
            "timestamp": time.time()
        }
        logger.debug(f"Cached worker {worker['worker_id']} for {service_type}")

    def _invalidate_cache(self, service_type: str):
        """
        Invalidate cache for service

        Args:
            service_type: Service type to invalidate
        """
        if service_type in self.finger_cache:
            del self.finger_cache[service_type]
            logger.debug(f"Invalidated cache for {service_type}")

    def get_stats(self) -> Dict[str, int]:
        """
        Get routing statistics

        Returns:
            Statistics dictionary
        """
        return {
            **self.stats,
            "cache_size": len(self.finger_cache),
            "cache_hit_rate": (
                self.stats["cache_hits"] / max(1, self.stats["cache_hits"] + self.stats["cache_misses"])
            ) if (self.stats["cache_hits"] + self.stats["cache_misses"]) > 0 else 0.0
        }

    def clear_cache(self):
        """Clear finger cache"""
        self.finger_cache.clear()
        logger.info("Finger cache cleared")


class ServiceNotFoundError(Exception):
    """Raised when no worker provides requested service"""
    pass


class RequestForwardingError(Exception):
    """Raised when request forwarding fails"""
    pass


# Example usage
async def main():
    """Test DHT router"""
    logging.basicConfig(level=logging.INFO)

    # Mock DHT node
    class MockDHTNode:
        def __init__(self):
            self.is_running = True

        async def find_service_workers(self, service_type):
            # Mock workers
            if service_type == "llm-inference":
                return [
                    {
                        "worker_id": "worker-gpu-001",
                        "vpn_ip": "10.42.0.10",
                        "tunnel_url": "https://worker1.example.com",
                        "services": ["llm-inference", "vision-ocr"],
                        "load": 0.3
                    },
                    {
                        "worker_id": "worker-gpu-002",
                        "vpn_ip": "10.42.0.11",
                        "tunnel_url": "https://worker2.example.com",
                        "services": ["llm-inference"],
                        "load": 0.7
                    }
                ]
            return []

    # Create router
    dht = MockDHTNode()
    router = DHTRouter(dht, ["notes-coa", "ner-extraction"], "worker-cpu-001")

    # Test local request
    print("=" * 60)
    print("Test 1: Local request (notes-coa)")
    result = await router.route_request("notes-coa", {"text": "test"})
    print(f"Result: {result}")

    # Test forwarded request (will fail without real workers)
    print("\n" + "=" * 60)
    print("Test 2: DHT lookup for llm-inference")
    try:
        result = await router.route_request("llm-inference", {"prompt": "test"})
        print(f"Result: {result}")
    except Exception as e:
        print(f"Expected failure (no real workers): {e}")

    # Test stats
    print("\n" + "=" * 60)
    print("Router Statistics:")
    stats = router.get_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    asyncio.run(main())
