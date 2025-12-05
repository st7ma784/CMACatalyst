"""
DHT (Distributed Hash Table) Module for P2P Service Discovery

This module provides distributed service discovery for the RMA platform,
enabling peer-to-peer communication between workers and coordinators
to minimize Cloudflare edge router costs.

Components:
- dht_node.py: Core DHT node implementation using Kademlia
- dht_client.py: High-level client interface for workers
- dht_config.py: Configuration management
"""

from .dht_node import DHTNode
from .dht_client import DHTClient
from .dht_router import DHTRouter

__all__ = ["DHTNode", "DHTClient", "DHTRouter"]
