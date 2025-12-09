"""
VPN Bootstrap Logic

Handles VPN network initialization and worker joining.
First worker bootstraps the network, subsequent workers join.
"""

import asyncio
import httpx
import logging
import os
import json
from typing import Optional, Dict, Tuple
from pathlib import Path

from .nebula_manager import NebulaManager

logger = logging.getLogger(__name__)

# Cloudflare configuration
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")
CLOUDFLARE_KV_NAMESPACE_ID = os.getenv("CLOUDFLARE_KV_NAMESPACE_ID")

# Edge router URL for KV access
EDGE_ROUTER_URL = os.getenv("EDGE_ROUTER_URL", "https://api.rmatool.org.uk")

# VPN configuration
VPN_CIDR = "10.42.0.0/16"
LIGHTHOUSE_IP = "10.42.0.1"
LIGHTHOUSE_PORT = 4242


class CloudflareKVClient:
    """Client for Cloudflare KV operations"""

    def __init__(self):
        self.account_id = CLOUDFLARE_ACCOUNT_ID
        self.api_token = CLOUDFLARE_API_TOKEN
        self.namespace_id = CLOUDFLARE_KV_NAMESPACE_ID
        self.edge_router_url = EDGE_ROUTER_URL

        if self.account_id and self.api_token and self.namespace_id:
            self.use_direct_api = True
            self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/storage/kv/namespaces/{self.namespace_id}"
            logger.info("Using Cloudflare KV direct API")
        else:
            self.use_direct_api = False
            logger.info("Using edge router for KV access")

    async def get(self, key: str) -> Optional[dict]:
        """
        Get value from KV

        Args:
            key: KV key

        Returns:
            Value as dict or None if not found
        """
        try:
            if self.use_direct_api:
                # Direct API access
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{self.base_url}/values/{key}",
                        headers={"Authorization": f"Bearer {self.api_token}"},
                        timeout=10.0
                    )

                    if response.status_code == 404:
                        return None
                    elif response.status_code == 200:
                        return response.json()
                    else:
                        logger.error(f"KV GET failed: {response.status_code} - {response.text}")
                        return None
            else:
                # Via edge router
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{self.edge_router_url}/api/kv/{key}",
                        timeout=10.0
                    )

                    if response.status_code == 404:
                        return None
                    elif response.status_code == 200:
                        return response.json()
                    else:
                        logger.error(f"KV GET failed: {response.status_code}")
                        return None

        except Exception as e:
            logger.error(f"KV GET error for key '{key}': {e}")
            return None

    async def put(self, key: str, value: dict, if_not_exists: bool = False) -> bool:
        """
        Put value into KV

        Args:
            key: KV key
            value: Value as dict (will be JSON serialized)
            if_not_exists: Only write if key doesn't exist (atomic test-and-set)

        Returns:
            True if successful, False otherwise
        """
        try:
            if self.use_direct_api:
                # Direct API access
                async with httpx.AsyncClient() as client:
                    # Check if key exists (for if_not_exists)
                    if if_not_exists:
                        existing = await self.get(key)
                        if existing is not None:
                            logger.debug(f"KV key '{key}' already exists, skipping")
                            return False

                    # Write value
                    response = await client.put(
                        f"{self.base_url}/values/{key}",
                        headers={"Authorization": f"Bearer {self.api_token}"},
                        json=value,
                        timeout=10.0
                    )

                    if response.status_code in [200, 201]:
                        logger.debug(f"KV PUT successful: {key}")
                        return True
                    else:
                        logger.error(f"KV PUT failed: {response.status_code} - {response.text}")
                        return False
            else:
                # Via edge router
                async with httpx.AsyncClient() as client:
                    response = await client.put(
                        f"{self.edge_router_url}/api/kv/{key}",
                        json={
                            "value": value,
                            "if_not_exists": if_not_exists
                        },
                        timeout=10.0
                    )

                    if response.status_code in [200, 201]:
                        logger.debug(f"KV PUT successful: {key}")
                        return True
                    elif response.status_code == 409:
                        logger.debug(f"KV key '{key}' already exists")
                        return False
                    else:
                        logger.error(f"KV PUT failed: {response.status_code}")
                        return False

        except Exception as e:
            logger.error(f"KV PUT error for key '{key}': {e}")
            return False

    async def increment(self, key: str, field: str, default: int = 0) -> Optional[int]:
        """
        Atomically increment a numeric field in a KV value

        Args:
            key: KV key
            field: Field name to increment
            default: Default value if key doesn't exist

        Returns:
            New value after increment, or None on error
        """
        # Simple implementation: read, increment, write
        # Note: This is NOT truly atomic without proper KV atomic operations
        # For production, use Cloudflare Durable Objects for atomic increments

        try:
            value = await self.get(key)
            if value is None:
                value = {field: default}

            current = value.get(field, default)
            new_value = current + 1
            value[field] = new_value

            success = await self.put(key, value)
            if success:
                return new_value
            else:
                return None

        except Exception as e:
            logger.error(f"KV INCREMENT error: {e}")
            return None


# Global KV client
kv_client = CloudflareKVClient()


async def is_first_worker() -> bool:
    """
    Check if this is the first worker (atomic test-and-set)

    Returns:
        True if this worker claimed first worker status, False otherwise
    """
    logger.info("Checking if this is the first worker...")

    # Try to create the bootstrap config with if_not_exists=True
    initial_config = {
        "status": "initializing",
        "created_at": None,
        "next_worker_ip": 2  # Lighthouse uses .1, workers start at .2
    }

    success = await kv_client.put("vpn_bootstrap", initial_config, if_not_exists=True)

    if success:
        logger.info("🌟 This is the FIRST worker - claimed bootstrap lock")
        return True
    else:
        logger.info("This is NOT the first worker - network already exists")
        return False


async def bootstrap_vpn_network(nebula_manager: NebulaManager) -> Dict:
    """
    Bootstrap VPN network (first worker only)

    Args:
        nebula_manager: NebulaManager instance

    Returns:
        Bootstrap configuration dict
    """
    logger.info("🚀 Bootstrapping VPN network as first worker...")

    try:
        # Generate CA certificate
        ca_crt, ca_key = await nebula_manager.initialize_ca("rma-demo-mesh")

        # Generate lighthouse certificate
        lighthouse_crt, lighthouse_key = await nebula_manager.generate_worker_cert(
            ca_crt,
            ca_key,
            "lighthouse",
            f"{LIGHTHOUSE_IP}/16",
            groups=["lighthouse", "workers"]
        )

        # Get public IP (if available)
        public_ip = nebula_manager.get_public_ip()

        # Create static host map
        static_host_map = {}
        if public_ip:
            static_host_map[LIGHTHOUSE_IP] = [f"{public_ip}:{LIGHTHOUSE_PORT}"]
            logger.info(f"Lighthouse will be reachable at {public_ip}:{LIGHTHOUSE_PORT}")
        else:
            logger.warning("No public IP detected - workers behind same NAT must be able to reach this lighthouse")

        # Start Nebula as lighthouse
        await nebula_manager.start_nebula(
            f"{LIGHTHOUSE_IP}/16",
            is_lighthouse=True,
            lighthouse_hosts=[],
            static_host_map={}
        )

        # Wait for VPN to come up
        await asyncio.sleep(3)

        # Verify connection
        if not await nebula_manager.is_connected():
            raise Exception("Lighthouse VPN failed to start")

        # Create bootstrap config
        import time
        bootstrap_config = {
            "ca_crt": ca_crt,
            # Note: We don't store ca_key in KV for security (first worker keeps it locally)
            "lighthouse_public_ip": public_ip,
            "lighthouse_vpn_ip": LIGHTHOUSE_IP,
            "lighthouse_port": LIGHTHOUSE_PORT,
            "network_cidr": VPN_CIDR,
            "created_at": time.time(),
            "next_worker_ip": 2,
            "status": "active"
        }

        # Store in KV (encrypted version will be handled by kv_crypto wrapper)
        success = await kv_client.put("vpn_bootstrap", bootstrap_config)

        if not success:
            raise Exception("Failed to store bootstrap config in KV")

        logger.info("✅ VPN network bootstrapped successfully")
        logger.info(f"   Lighthouse VPN IP: {LIGHTHOUSE_IP}")
        logger.info(f"   Lighthouse Public IP: {public_ip or 'N/A'}")

        return bootstrap_config

    except Exception as e:
        logger.error(f"Failed to bootstrap VPN network: {e}")
        raise


async def join_vpn_network(nebula_manager: NebulaManager, max_retries: int = 3) -> str:
    """
    Join existing VPN network

    Args:
        nebula_manager: NebulaManager instance
        max_retries: Maximum number of retry attempts

    Returns:
        Assigned VPN IP address
    """
    logger.info("Joining existing VPN network...")

    for attempt in range(max_retries):
        try:
            # Fetch bootstrap config
            bootstrap_config = await fetch_bootstrap_config()

            if not bootstrap_config or bootstrap_config.get("status") != "active":
                logger.warning(f"Bootstrap config not ready (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(5)
                continue

            # Allocate VPN IP
            vpn_ip = await allocate_vpn_ip()

            if not vpn_ip:
                raise Exception("Failed to allocate VPN IP")

            # Request signed certificate from lighthouse
            ca_crt = bootstrap_config["ca_crt"]
            lighthouse_public_ip = bootstrap_config.get("lighthouse_public_ip")
            lighthouse_vpn_ip = bootstrap_config["lighthouse_vpn_ip"]

            # Import cert signing client
            from vpn.cert_signing_service import request_certificate

            # Try to get certificate from lighthouse
            # First try public IP (if available), then VPN IP (if we can reach it somehow)
            lighthouse_addr = lighthouse_public_ip if lighthouse_public_ip else lighthouse_vpn_ip

            logger.info(f"Requesting certificate from lighthouse at {lighthouse_addr}")

            try:
                worker_crt, worker_key, ca_crt_from_lighthouse = await request_certificate(
                    lighthouse_ip=lighthouse_addr,
                    worker_name=nebula_manager.worker_id,
                    vpn_ip=f"{vpn_ip}/16",
                    groups=["workers"]
                )

                # Write certificates to disk
                cert_dir = nebula_manager.config_dir
                (cert_dir / "ca.crt").write_text(ca_crt_from_lighthouse)
                (cert_dir / f"{nebula_manager.worker_id}.crt").write_text(worker_crt)
                (cert_dir / f"{nebula_manager.worker_id}.key").write_text(worker_key)

                logger.info("✅ Received signed certificate from lighthouse")

            except Exception as e:
                logger.error(f"Failed to get certificate from lighthouse: {e}")
                raise Exception(f"Certificate request failed: {e}")

            # Build static host map
            lighthouse_public_ip = bootstrap_config.get("lighthouse_public_ip")
            lighthouse_vpn_ip = bootstrap_config["lighthouse_vpn_ip"]
            lighthouse_port = bootstrap_config["lighthouse_port"]

            static_host_map = {}
            if lighthouse_public_ip:
                static_host_map[lighthouse_vpn_ip] = [f"{lighthouse_public_ip}:{lighthouse_port}"]

            # Start Nebula
            await nebula_manager.start_nebula(
                f"{vpn_ip}/16",
                is_lighthouse=False,
                lighthouse_hosts=[lighthouse_vpn_ip],
                static_host_map=static_host_map
            )

            # Wait for connection
            await asyncio.sleep(5)

            # Verify connection
            if await nebula_manager.is_connected():
                logger.info(f"✅ Joined VPN network with IP: {vpn_ip}")
                return vpn_ip
            else:
                logger.warning(f"VPN connection failed (attempt {attempt + 1}/{max_retries})")
                await nebula_manager.stop_nebula()
                await asyncio.sleep(5)

        except Exception as e:
            logger.error(f"Join attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(5)

    raise Exception("Failed to join VPN network after all retries")


async def fetch_bootstrap_config() -> Optional[Dict]:
    """
    Fetch VPN bootstrap config from KV

    Returns:
        Bootstrap config dict or None
    """
    logger.info("Fetching bootstrap config from KV...")

    config = await kv_client.get("vpn_bootstrap")

    if config:
        logger.info("✅ Bootstrap config retrieved")
        return config
    else:
        logger.warning("Bootstrap config not found in KV")
        return None


async def allocate_vpn_ip() -> Optional[str]:
    """
    Allocate next available VPN IP address

    Uses atomic increment on KV to allocate IPs sequentially

    Returns:
        VPN IP address (e.g., "10.42.0.5") or None on error
    """
    logger.info("Allocating VPN IP...")

    # Increment next_worker_ip counter
    next_ip_index = await kv_client.increment("vpn_bootstrap", "next_worker_ip", default=2)

    if next_ip_index is None:
        logger.error("Failed to allocate VPN IP from KV")
        return None

    # Convert to IP address
    # Format: 10.42.0.X where X is next_ip_index
    # For larger deployments, use 10.42.Y.X where Y = index // 256, X = index % 256
    if next_ip_index < 256:
        vpn_ip = f"10.42.0.{next_ip_index}"
    else:
        subnet = next_ip_index // 256
        host = next_ip_index % 256
        vpn_ip = f"10.42.{subnet}.{host}"

    logger.info(f"Allocated VPN IP: {vpn_ip}")
    return vpn_ip


async def register_as_entry_point(public_ip: str, port: int = 8443) -> bool:
    """
    Register this worker as an entry point (for workers with public IPs)

    Args:
        public_ip: Public IP address
        port: Entry point port (default: 8443)

    Returns:
        True if registered successfully
    """
    logger.info(f"Registering as entry point: {public_ip}:{port}")

    try:
        # Get current entry points
        entry_points = await kv_client.get("entry_points") or []

        endpoint = f"{public_ip}:{port}"

        if endpoint not in entry_points:
            entry_points.append(endpoint)
            success = await kv_client.put("entry_points", entry_points)

            if success:
                logger.info(f"✅ Registered as entry point: {endpoint}")
                return True
            else:
                logger.error("Failed to update entry points in KV")
                return False
        else:
            logger.info(f"Already registered as entry point: {endpoint}")
            return True

    except Exception as e:
        logger.error(f"Failed to register as entry point: {e}")
        return False


async def main():
    """Test bootstrap logic"""
    logging.basicConfig(level=logging.INFO)

    # Test as first worker
    worker_id = "test-worker-001"
    manager = NebulaManager(worker_id)

    if not await manager.ensure_nebula_binary():
        print("ERROR: Nebula binary not found")
        return

    if await is_first_worker():
        print("This is the FIRST worker")
        config = await bootstrap_vpn_network(manager)
        print(f"Bootstrap config: {json.dumps(config, indent=2, default=str)}")
    else:
        print("This is NOT the first worker")
        vpn_ip = await join_vpn_network(manager)
        print(f"Assigned VPN IP: {vpn_ip}")

    # Keep running
    print("VPN running... Press Ctrl+C to stop")
    try:
        await asyncio.sleep(60)
    except KeyboardInterrupt:
        print("\nStopping...")

    await manager.stop_nebula()


if __name__ == "__main__":
    asyncio.run(main())
