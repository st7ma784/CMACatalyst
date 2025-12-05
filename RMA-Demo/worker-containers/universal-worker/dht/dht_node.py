"""
Core DHT Node Implementation
Handles joining DHT ring, storing/retrieving data, and routing
"""

import asyncio
import logging
from typing import Dict, List, Optional
from kademlia.network import Server

logger = logging.getLogger(__name__)


class DHTNode:
    """
    DHT Node for distributed service discovery

    This node participates in a Kademlia DHT ring, storing and retrieving
    information about coordinators, workers, and services.
    """

    def __init__(self, node_id: str, listen_port: int = 8468):
        """
        Initialize DHT node

        Args:
            node_id: Unique identifier for this node
            listen_port: UDP port for DHT communication (default 8468)
        """
        self.node_id = node_id
        self.listen_port = listen_port
        self.server = Server()
        self.is_running = False

        logger.info(f"DHT Node initialized: {node_id} on port {listen_port}")

    async def start(self, bootstrap_nodes: Optional[List[tuple]] = None):
        """
        Start DHT node and join network

        Args:
            bootstrap_nodes: List of (ip, port) tuples for initial connection
                           If None, this becomes a bootstrap node
        """
        try:
            # Start listening
            await self.server.listen(self.listen_port)
            self.is_running = True
            logger.info(f"DHT listening on port {self.listen_port}")

            # Bootstrap into network
            if bootstrap_nodes:
                logger.info(f"Bootstrapping with {len(bootstrap_nodes)} nodes")
                await self.server.bootstrap(bootstrap_nodes)
                logger.info("✅ DHT bootstrap complete")
            else:
                logger.info("⭐ Starting as DHT bootstrap node")

        except Exception as e:
            logger.error(f"Failed to start DHT node: {e}")
            raise

    async def stop(self):
        """Gracefully stop DHT node"""
        self.is_running = False
        self.server.stop()
        logger.info("DHT node stopped")

    async def set(self, key: str, value: dict) -> bool:
        """
        Store data in DHT

        Args:
            key: Key to store (e.g., "worker:gpu-001")
            value: Dict to store (must be JSON-serializable)

        Returns:
            True if successful
        """
        try:
            await self.server.set(key, value)
            logger.debug(f"DHT SET: {key}")
            return True
        except Exception as e:
            logger.error(f"DHT SET failed for {key}: {e}")
            return False

    async def get(self, key: str) -> Optional[dict]:
        """
        Retrieve data from DHT

        Args:
            key: Key to retrieve

        Returns:
            Stored value or None if not found
        """
        try:
            value = await self.server.get(key)
            if value:
                logger.debug(f"DHT GET: {key} → found")
            else:
                logger.debug(f"DHT GET: {key} → not found")
            return value
        except Exception as e:
            logger.error(f"DHT GET failed for {key}: {e}")
            return None

    async def get_node_count(self) -> int:
        """Get number of nodes in DHT ring"""
        # Note: kademlia doesn't expose this directly
        # This is an approximation based on routing table
        return len(self.server.protocol.router)

    async def publish_service(self, service_type: str, worker_id: str,
                             worker_info: dict):
        """
        Publish worker's service capability to DHT

        Args:
            service_type: Type of service (e.g., "ocr", "gpu")
            worker_id: Unique worker identifier
            worker_info: Worker metadata (tunnel_url, capabilities, etc.)
        """
        # Store worker info
        await self.set(f"worker:{worker_id}", worker_info)

        # Add to service index
        service_key = f"service:{service_type}"
        current_workers = await self.get(service_key) or []

        if worker_id not in current_workers:
            current_workers.append(worker_id)
            await self.set(service_key, current_workers)

        logger.info(f"Published service: {service_type} by {worker_id}")

    async def find_service_workers(self, service_type: str) -> List[Dict]:
        """
        Find all workers offering a service

        Args:
            service_type: Service to search for (e.g., "ocr")

        Returns:
            List of worker info dicts
        """
        # Get worker IDs offering this service
        worker_ids = await self.get(f"service:{service_type}") or []

        if not worker_ids:
            logger.debug(f"No workers found for service: {service_type}")
            return []

        # Fetch worker info for each
        workers = []
        for worker_id in worker_ids:
            worker_info = await self.get(f"worker:{worker_id}")
            if worker_info:
                workers.append(worker_info)

        logger.info(f"Found {len(workers)} workers for {service_type}")
        return workers

    async def unpublish_worker(self, worker_id: str, services: List[str]):
        """
        Remove worker from DHT when going offline

        Args:
            worker_id: Worker to remove
            services: List of services to unpublish
        """
        # Remove from service indexes
        for service_type in services:
            service_key = f"service:{service_type}"
            current_workers = await self.get(service_key) or []

            if worker_id in current_workers:
                current_workers.remove(worker_id)
                await self.set(service_key, current_workers)

        # Note: Don't delete worker key - let it expire naturally
        logger.info(f"Unpublished worker: {worker_id}")


# Example usage
async def main():
    # Bootstrap node (first coordinator)
    bootstrap = DHTNode("coordinator-1", 8468)
    await bootstrap.start()

    # Worker node
    worker = DHTNode("worker-gpu-001", 8469)
    await worker.start([("localhost", 8468)])

    # Publish service
    await worker.publish_service("ocr", "worker-gpu-001", {
        "tunnel_url": "https://worker-001.tunnel...",
        "gpu": "NVIDIA RTX 3090",
        "services": ["ocr", "enhance"]
    })

    # Find workers
    ocr_workers = await bootstrap.find_service_workers("ocr")
    print(f"OCR workers: {ocr_workers}")

    await asyncio.sleep(60)
    await worker.stop()
    await bootstrap.stop()


if __name__ == "__main__":
    asyncio.run(main())
