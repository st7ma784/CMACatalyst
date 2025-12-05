"""
Peer Discovery
Discovers and tracks peers in the P2P network via DHT
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class PeerDiscovery:
    """
    Discovers and tracks peers via DHT

    Maintains a list of known peers and their capabilities
    for efficient service routing.
    """

    def __init__(self, dht_client):
        """
        Initialize peer discovery

        Args:
            dht_client: DHT client instance
        """
        self.dht_client = dht_client
        self.known_peers: Dict[str, Dict] = {}
        self.peer_capabilities: Dict[str, Set[str]] = {}
        self._discovery_task = None

    async def start_discovery(self, interval: int = 60):
        """
        Start background peer discovery

        Args:
            interval: Discovery interval in seconds
        """
        logger.info("Starting peer discovery...")
        self._discovery_task = asyncio.create_task(self._discovery_loop(interval))

    async def stop_discovery(self):
        """Stop background peer discovery"""
        if self._discovery_task:
            self._discovery_task.cancel()
            try:
                await self._discovery_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped peer discovery")

    async def _discovery_loop(self, interval: int):
        """
        Background task to discover peers

        Args:
            interval: Discovery interval
        """
        while True:
            try:
                await asyncio.sleep(interval)
                await self.discover_peers()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Peer discovery error: {e}")

    async def discover_peers(self):
        """Discover peers offering various services"""
        service_types = ["ocr", "enhance", "chat", "embedding", "ner", "storage"]

        for service_type in service_types:
            try:
                workers = await self.dht_client.node.find_service_workers(service_type)

                for worker_info in workers:
                    worker_id = worker_info.get("worker_id")
                    if worker_id:
                        self.known_peers[worker_id] = worker_info

                        # Track capabilities
                        if worker_id not in self.peer_capabilities:
                            self.peer_capabilities[worker_id] = set()
                        self.peer_capabilities[worker_id].add(service_type)

            except Exception as e:
                logger.error(f"Failed to discover {service_type} peers: {e}")

        logger.info(f"Discovered {len(self.known_peers)} peers")

    def get_peers_for_service(self, service_type: str) -> List[Dict]:
        """
        Get peers offering a specific service

        Args:
            service_type: Service needed

        Returns:
            List of peer info dicts
        """
        peers = []
        for peer_id, capabilities in self.peer_capabilities.items():
            if service_type in capabilities:
                peer_info = self.known_peers.get(peer_id)
                if peer_info:
                    peers.append(peer_info)

        return peers

    def get_all_peers(self) -> List[Dict]:
        """
        Get all known peers

        Returns:
            List of peer info dicts
        """
        return list(self.known_peers.values())

    def get_peer_count(self) -> int:
        """
        Get number of known peers

        Returns:
            Peer count
        """
        return len(self.known_peers)

    def clear_stale_peers(self, max_age: int = 300):
        """
        Remove stale peers not seen recently

        Args:
            max_age: Maximum peer age in seconds
        """
        current_time = time.time()
        stale_peers = []

        for peer_id, peer_info in self.known_peers.items():
            last_seen = peer_info.get("last_seen", 0)
            if current_time - last_seen > max_age:
                stale_peers.append(peer_id)

        for peer_id in stale_peers:
            del self.known_peers[peer_id]
            del self.peer_capabilities[peer_id]

        if stale_peers:
            logger.info(f"Removed {len(stale_peers)} stale peers")
