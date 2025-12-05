"""
P2P (Peer-to-Peer) Module
Manages tunnel creation and peer discovery for direct worker communication
"""

from .tunnel_manager import TunnelManager
from .peer_discovery import PeerDiscovery

__all__ = ["TunnelManager", "PeerDiscovery"]
