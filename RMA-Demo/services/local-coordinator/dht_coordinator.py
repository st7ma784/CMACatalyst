"""
Coordinator DHT Integration
Coordinators run DHT nodes and help bootstrap the network
"""

import asyncio
import logging
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__),
                                '../../worker-containers/universal-worker'))

from dht.dht_node import DHTNode

logger = logging.getLogger(__name__)


class CoordinatorDHT:
    """
    DHT integration for coordinator

    Coordinators act as stable DHT nodes that help bootstrap
    the network and store coordinator registry information.
    """

    def __init__(self, coordinator_id: str, port: int = 8468):
        self.coordinator_id = coordinator_id
        self.node = DHTNode(coordinator_id, port)
        self.port = port

    async def start(self, bootstrap_nodes: list = None):
        """
        Start coordinator DHT node

        Args:
            bootstrap_nodes: Other coordinators to bootstrap from
        """
        await self.node.start(bootstrap_nodes)
        logger.info(f"Coordinator DHT node started on port {self.port}")

    async def register_coordinator(self, tunnel_url: str, location: str):
        """
        Register this coordinator in DHT

        Args:
            tunnel_url: Coordinator's public tunnel URL
            location: Geographic location
        """
        coord_info = {
            "coordinator_id": self.coordinator_id,
            "tunnel_url": tunnel_url,
            "location": location,
            "dht_port": self.port,
            "last_seen": asyncio.get_event_loop().time()
        }

        # Store coordinator info
        await self.node.set(f"coordinator:{self.coordinator_id}", coord_info)

        # Add to location index
        location_key = f"coordinators:{location}"
        current_coords = await self.node.get(location_key) or []
        if self.coordinator_id not in current_coords:
            current_coords.append(self.coordinator_id)
            await self.node.set(location_key, current_coords)

        logger.info(f"Registered coordinator in DHT: {self.coordinator_id}")

    async def find_coordinators(self, location: str = None) -> list:
        """
        Find coordinators in DHT

        Args:
            location: Filter by location (optional)

        Returns:
            List of coordinator info dicts
        """
        if location:
            coord_ids = await self.node.get(f"coordinators:{location}") or []
        else:
            # Get all locations (this is inefficient - TODO: improve)
            coord_ids = []
            for loc in ["eu-west", "us-east", "us-west", "asia"]:
                ids = await self.node.get(f"coordinators:{loc}") or []
                coord_ids.extend(ids)

        # Fetch coordinator info
        coordinators = []
        for coord_id in coord_ids:
            info = await self.node.get(f"coordinator:{coord_id}")
            if info:
                coordinators.append(info)

        return coordinators

    async def get_topology(self) -> dict:
        """
        Get DHT topology for frontend visualization

        Returns:
            Dictionary with nodes and edges for graph visualization
        """
        nodes = []
        edges = []

        # Get all coordinators
        coordinators = await self.find_coordinators()
        for coord in coordinators:
            nodes.append({
                "id": coord["coordinator_id"],
                "type": "coordinator",
                "location": coord.get("location", "unknown")
            })

        # Get all workers (this is a simplified version)
        # In production, we'd need a better way to enumerate all workers
        # For now, we'll just return what we have
        node_count = await self.node.get_node_count()

        return {
            "nodes": nodes,
            "edges": edges,
            "dht_enabled": True,
            "node_count": node_count,
            "coordinator_count": len(coordinators)
        }

    async def stop(self):
        """Stop DHT node"""
        await self.node.stop()
