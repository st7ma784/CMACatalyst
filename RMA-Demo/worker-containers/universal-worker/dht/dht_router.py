"""
DHT Request Router
Intelligent request routing for P2P worker communication
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional
import requests
from .dht_client import DHTClient

logger = logging.getLogger(__name__)


class DHTRouter:
    """
    Intelligent router for P2P service requests via DHT

    Routes requests directly to workers via their tunnel URLs,
    bypassing the coordinator and edge router.
    """

    def __init__(self, dht_client: DHTClient, coordinator_url: str):
        """
        Initialize DHT router

        Args:
            dht_client: DHT client instance
            coordinator_url: Coordinator URL for fallback
        """
        self.dht_client = dht_client
        self.coordinator_url = coordinator_url

        # Request tracking for metrics
        self._request_count = 0
        self._dht_hits = 0
        self._coordinator_fallbacks = 0
        self._errors = 0

        # Latency tracking for worker selection
        self._worker_latencies: Dict[str, List[float]] = {}

    async def route_request(
        self,
        service_type: str,
        endpoint: str,
        method: str = "POST",
        data: Optional[Dict] = None,
        timeout: int = 30
    ) -> Optional[Dict]:
        """
        Route a service request via DHT

        Args:
            service_type: Type of service (e.g., "ocr")
            endpoint: Service endpoint (e.g., "/api/ocr")
            method: HTTP method (default "POST")
            data: Request data
            timeout: Request timeout in seconds

        Returns:
            Response data dict or None on failure
        """
        self._request_count += 1
        start_time = time.time()

        try:
            # Try DHT first
            worker_info = await self.dht_client.find_worker_for_service(service_type)

            if worker_info:
                # Route directly to worker via P2P
                worker_url = worker_info["tunnel_url"]
                full_url = f"{worker_url}{endpoint}"

                logger.info(f"Routing {service_type} request to {worker_info['worker_id']} via DHT")

                try:
                    response = requests.request(
                        method=method,
                        url=full_url,
                        json=data,
                        timeout=timeout
                    )

                    # Track latency for this worker
                    latency = time.time() - start_time
                    self._record_latency(worker_info["worker_id"], latency)

                    if response.status_code == 200:
                        self._dht_hits += 1
                        logger.debug(f"DHT request successful ({latency*1000:.0f}ms)")
                        return response.json()
                    else:
                        logger.warning(f"Worker returned status {response.status_code}")
                        # Fall through to coordinator fallback

                except requests.RequestException as e:
                    logger.warning(f"P2P request failed: {e}")
                    # Fall through to coordinator fallback

            # Fallback to coordinator
            logger.info(f"Falling back to coordinator for {service_type}")
            return await self._coordinator_fallback(service_type, endpoint, method, data, timeout)

        except Exception as e:
            self._errors += 1
            logger.error(f"Routing error: {e}")
            return None

    async def _coordinator_fallback(
        self,
        service_type: str,
        endpoint: str,
        method: str,
        data: Optional[Dict],
        timeout: int
    ) -> Optional[Dict]:
        """
        Fallback to coordinator for service request

        Args:
            service_type: Service type
            endpoint: Endpoint path
            method: HTTP method
            data: Request data
            timeout: Timeout

        Returns:
            Response dict or None
        """
        self._coordinator_fallbacks += 1

        try:
            # Query coordinator for worker
            coord_response = requests.get(
                f"{self.coordinator_url}/api/worker/find/{service_type}",
                timeout=5
            )

            if coord_response.status_code != 200:
                logger.error("Coordinator failed to find worker")
                return None

            worker_url = coord_response.json().get("worker_url")
            if not worker_url:
                logger.error("Coordinator returned no worker URL")
                return None

            # Make request to worker via coordinator
            full_url = f"{worker_url}{endpoint}"
            response = requests.request(
                method=method,
                url=full_url,
                json=data,
                timeout=timeout
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Worker request failed with status {response.status_code}")
                return None

        except requests.RequestException as e:
            logger.error(f"Coordinator fallback failed: {e}")
            return None

    def _record_latency(self, worker_id: str, latency: float):
        """
        Record latency for a worker

        Args:
            worker_id: Worker identifier
            latency: Latency in seconds
        """
        if worker_id not in self._worker_latencies:
            self._worker_latencies[worker_id] = []

        self._worker_latencies[worker_id].append(latency)

        # Keep only last 10 measurements
        if len(self._worker_latencies[worker_id]) > 10:
            self._worker_latencies[worker_id] = self._worker_latencies[worker_id][-10:]

    def get_worker_avg_latency(self, worker_id: str) -> Optional[float]:
        """
        Get average latency for a worker

        Args:
            worker_id: Worker identifier

        Returns:
            Average latency in seconds or None
        """
        if worker_id not in self._worker_latencies:
            return None

        latencies = self._worker_latencies[worker_id]
        if not latencies:
            return None

        return sum(latencies) / len(latencies)

    def get_metrics(self) -> Dict:
        """
        Get routing metrics

        Returns:
            Metrics dict with request statistics
        """
        dht_hit_rate = (self._dht_hits / self._request_count * 100) if self._request_count > 0 else 0
        coordinator_rate = (self._coordinator_fallbacks / self._request_count * 100) if self._request_count > 0 else 0
        error_rate = (self._errors / self._request_count * 100) if self._request_count > 0 else 0

        return {
            "total_requests": self._request_count,
            "dht_hits": self._dht_hits,
            "dht_hit_rate_pct": round(dht_hit_rate, 2),
            "coordinator_fallbacks": self._coordinator_fallbacks,
            "coordinator_fallback_rate_pct": round(coordinator_rate, 2),
            "errors": self._errors,
            "error_rate_pct": round(error_rate, 2),
            "worker_latencies": {
                worker_id: round(self.get_worker_avg_latency(worker_id) * 1000, 2)
                for worker_id in self._worker_latencies.keys()
            }
        }

    def reset_metrics(self):
        """Reset routing metrics"""
        self._request_count = 0
        self._dht_hits = 0
        self._coordinator_fallbacks = 0
        self._errors = 0
        logger.info("Routing metrics reset")
