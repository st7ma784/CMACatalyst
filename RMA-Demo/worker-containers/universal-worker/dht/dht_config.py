"""
DHT Configuration Management

Provides configuration settings for DHT nodes and clients
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class DHTConfig:
    """
    DHT Configuration

    Configuration settings for DHT nodes, loaded from environment variables
    with sensible defaults for production use.
    """

    # DHT Network Settings
    dht_enabled: bool = True
    dht_port: int = 8468

    # Bootstrap Settings
    bootstrap_url: str = "https://api.rmatool.org.uk"
    bootstrap_timeout: int = 10  # seconds
    bootstrap_retry_count: int = 3
    bootstrap_retry_delay: int = 5  # seconds

    # Heartbeat Settings
    heartbeat_interval: int = 30  # seconds
    worker_ttl: int = 300  # 5 minutes

    # Service Discovery Settings
    discovery_cache_ttl: int = 60  # seconds
    max_workers_per_service: int = 50

    # Network Settings
    connection_timeout: int = 10  # seconds
    max_retries: int = 3

    @classmethod
    def from_env(cls) -> "DHTConfig":
        """
        Load configuration from environment variables

        Returns:
            DHTConfig instance with values from environment
        """
        return cls(
            dht_enabled=os.getenv("DHT_ENABLED", "true").lower() == "true",
            dht_port=int(os.getenv("DHT_PORT", "8468")),
            bootstrap_url=os.getenv("BOOTSTRAP_URL", "https://api.rmatool.org.uk"),
            bootstrap_timeout=int(os.getenv("DHT_BOOTSTRAP_TIMEOUT", "10")),
            bootstrap_retry_count=int(os.getenv("DHT_BOOTSTRAP_RETRY", "3")),
            bootstrap_retry_delay=int(os.getenv("DHT_BOOTSTRAP_DELAY", "5")),
            heartbeat_interval=int(os.getenv("DHT_HEARTBEAT_INTERVAL", "30")),
            worker_ttl=int(os.getenv("DHT_WORKER_TTL", "300")),
            discovery_cache_ttl=int(os.getenv("DHT_CACHE_TTL", "60")),
            max_workers_per_service=int(os.getenv("DHT_MAX_WORKERS", "50")),
            connection_timeout=int(os.getenv("DHT_TIMEOUT", "10")),
            max_retries=int(os.getenv("DHT_MAX_RETRIES", "3")),
        )

    def __repr__(self) -> str:
        """String representation of config"""
        return (
            f"DHTConfig("
            f"enabled={self.dht_enabled}, "
            f"port={self.dht_port}, "
            f"bootstrap={self.bootstrap_url})"
        )


# Global config instance
config = DHTConfig.from_env()
