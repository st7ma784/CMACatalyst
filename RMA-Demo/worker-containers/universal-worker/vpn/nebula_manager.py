"""
Nebula VPN Manager

Manages the lifecycle of Nebula VPN for RMA-Demo workers.
Handles certificate generation, Nebula daemon management, and connectivity checks.
"""

import asyncio
import logging
import os
import subprocess
import tempfile
import yaml
from pathlib import Path
from typing import Optional, Tuple
import socket
import time

logger = logging.getLogger(__name__)


class NebulaManager:
    """
    Manages Nebula VPN lifecycle for a worker

    Responsibilities:
    - Ensure Nebula binary is available
    - Generate CA and worker certificates
    - Configure and start Nebula daemon
    - Monitor VPN connectivity
    """

    NEBULA_BINARY = "/usr/local/bin/nebula"
    NEBULA_CERT_BINARY = "/usr/local/bin/nebula-cert"
    VPN_CIDR = "10.42.0.0/16"
    LIGHTHOUSE_PORT = 4242

    def __init__(self, worker_id: str, config_dir: Optional[Path] = None):
        """
        Initialize Nebula manager

        Args:
            worker_id: Unique worker identifier
            config_dir: Directory for Nebula configs (default: /tmp/nebula/)
        """
        self.worker_id = worker_id
        self.config_dir = config_dir or Path(f"/tmp/nebula/{worker_id}")
        self.config_dir.mkdir(parents=True, exist_ok=True)

        self.nebula_process: Optional[subprocess.Popen] = None
        self.vpn_ip: Optional[str] = None

        logger.info(f"NebulaManager initialized for {worker_id}")

    def is_nebula_installed(self) -> bool:
        """Check if Nebula binary is installed"""
        return os.path.exists(self.NEBULA_BINARY) and os.path.exists(self.NEBULA_CERT_BINARY)

    async def ensure_nebula_binary(self) -> bool:
        """
        Ensure Nebula binary is available

        Returns:
            True if binary is available, False otherwise
        """
        if self.is_nebula_installed():
            logger.info("✅ Nebula binaries found")
            return True

        logger.warning("⚠️ Nebula not found - should be installed via Dockerfile")
        logger.warning("   Expected at: /usr/local/bin/nebula")
        return False

    async def initialize_ca(self, ca_name: str = "rma-demo-mesh") -> Tuple[str, str]:
        """
        Generate new CA certificate (first worker only)

        Args:
            ca_name: Name for the CA certificate

        Returns:
            Tuple of (ca_crt, ca_key) as PEM strings
        """
        logger.info(f"Generating CA certificate: {ca_name}")

        try:
            # Generate CA
            result = await asyncio.create_subprocess_exec(
                self.NEBULA_CERT_BINARY,
                "ca",
                "-name", ca_name,
                "-out-crt", str(self.config_dir / "ca.crt"),
                "-out-key", str(self.config_dir / "ca.key"),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                raise Exception(f"CA generation failed: {stderr.decode()}")

            # Read certificates
            ca_crt = (self.config_dir / "ca.crt").read_text()
            ca_key = (self.config_dir / "ca.key").read_text()

            logger.info("✅ CA certificate generated successfully")
            return (ca_crt, ca_key)

        except Exception as e:
            logger.error(f"Failed to generate CA: {e}")
            raise

    async def generate_worker_cert(
        self,
        ca_crt: str,
        ca_key: str,
        worker_name: str,
        vpn_ip: str,
        groups: Optional[list] = None
    ) -> Tuple[str, str]:
        """
        Generate worker certificate signed by CA

        Args:
            ca_crt: CA certificate PEM string
            ca_key: CA private key PEM string
            worker_name: Name for the worker certificate
            vpn_ip: VPN IP address for this worker (e.g., "10.42.0.10/16")
            groups: Optional list of groups for the worker

        Returns:
            Tuple of (worker_crt, worker_key) as PEM strings
        """
        logger.info(f"Generating worker certificate: {worker_name} → {vpn_ip}")

        try:
            # Write CA files temporarily
            ca_crt_path = self.config_dir / "ca.crt"
            ca_key_path = self.config_dir / "ca.key"
            ca_crt_path.write_text(ca_crt)
            ca_key_path.write_text(ca_key)

            # Build command
            cmd = [
                self.NEBULA_CERT_BINARY,
                "sign",
                "-name", worker_name,
                "-ip", vpn_ip,
                "-ca-crt", str(ca_crt_path),
                "-ca-key", str(ca_key_path),
                "-out-crt", str(self.config_dir / f"{worker_name}.crt"),
                "-out-key", str(self.config_dir / f"{worker_name}.key"),
            ]

            # Add groups if specified
            if groups:
                cmd.extend(["-groups", ",".join(groups)])

            # Generate worker cert
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                raise Exception(f"Worker cert generation failed: {stderr.decode()}")

            # Read certificates
            worker_crt = (self.config_dir / f"{worker_name}.crt").read_text()
            worker_key = (self.config_dir / f"{worker_name}.key").read_text()

            logger.info(f"✅ Worker certificate generated: {worker_name}")
            return (worker_crt, worker_key)

        except Exception as e:
            logger.error(f"Failed to generate worker cert: {e}")
            raise

    def generate_nebula_config(
        self,
        vpn_ip: str,
        is_lighthouse: bool = False,
        lighthouse_hosts: Optional[list] = None,
        static_host_map: Optional[dict] = None
    ) -> dict:
        """
        Generate Nebula configuration

        Args:
            vpn_ip: This worker's VPN IP
            is_lighthouse: Whether this worker is a lighthouse
            lighthouse_hosts: List of lighthouse VPN IPs
            static_host_map: Static host map for lighthouse IPs

        Returns:
            Nebula configuration dict
        """
        config = {
            "pki": {
                "ca": str(self.config_dir / "ca.crt"),
                "cert": str(self.config_dir / f"{self.worker_id}.crt"),
                "key": str(self.config_dir / f"{self.worker_id}.key"),
            },
            "static_host_map": static_host_map or {},
            "lighthouse": {
                "am_lighthouse": is_lighthouse,
                "interval": 60,
                "hosts": lighthouse_hosts or [],
            },
            "listen": {
                "host": "0.0.0.0",
                "port": self.LIGHTHOUSE_PORT,
            },
            "punchy": {
                "punch": True,
                "respond": True,
            },
            "tun": {
                "disabled": False,
                "dev": "nebula1",
                "drop_local_broadcast": False,
                "drop_multicast": False,
                "tx_queue": 500,
                "mtu": 1300,
            },
            "logging": {
                "level": "info",
                "format": "text",
            },
            "firewall": {
                "conntrack": {
                    "tcp_timeout": "12m",
                    "udp_timeout": "3m",
                    "default_timeout": "10m",
                },
                "outbound": [
                    {"port": "any", "proto": "any", "host": "any"}
                ],
                "inbound": [
                    {"port": "any", "proto": "any", "host": "any"}
                ],
            },
        }

        return config

    async def start_nebula(
        self,
        vpn_ip: str,
        is_lighthouse: bool = False,
        lighthouse_hosts: Optional[list] = None,
        static_host_map: Optional[dict] = None
    ) -> subprocess.Popen:
        """
        Start Nebula daemon

        Args:
            vpn_ip: This worker's VPN IP
            is_lighthouse: Whether this worker is a lighthouse
            lighthouse_hosts: List of lighthouse VPN IPs
            static_host_map: Static host map {vpn_ip: ["public_ip:port"]}

        Returns:
            Nebula process
        """
        logger.info(f"Starting Nebula daemon (lighthouse={is_lighthouse})")

        # Generate config
        config = self.generate_nebula_config(
            vpn_ip,
            is_lighthouse,
            lighthouse_hosts,
            static_host_map
        )

        # Write config file
        config_path = self.config_dir / "config.yml"
        with open(config_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)

        logger.info(f"Nebula config written to: {config_path}")

        # Start Nebula process
        self.nebula_process = subprocess.Popen(
            [self.NEBULA_BINARY, "-config", str(config_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        self.vpn_ip = vpn_ip.split('/')[0]  # Extract IP without CIDR

        # Wait a moment for startup
        await asyncio.sleep(2)

        if self.nebula_process.poll() is not None:
            # Process died
            stdout, stderr = self.nebula_process.communicate()
            raise Exception(f"Nebula failed to start:\nSTDOUT: {stdout}\nSTDERR: {stderr}")

        logger.info(f"✅ Nebula started (PID: {self.nebula_process.pid})")
        return self.nebula_process

    async def stop_nebula(self):
        """Stop Nebula daemon gracefully"""
        if self.nebula_process and self.nebula_process.poll() is None:
            logger.info("Stopping Nebula daemon...")
            self.nebula_process.terminate()

            try:
                await asyncio.wait_for(
                    asyncio.create_task(self._wait_for_process()),
                    timeout=10
                )
                logger.info("✅ Nebula stopped gracefully")
            except asyncio.TimeoutError:
                logger.warning("Nebula didn't stop gracefully, killing...")
                self.nebula_process.kill()
                await self._wait_for_process()
                logger.info("✅ Nebula killed")

    async def _wait_for_process(self):
        """Wait for Nebula process to exit"""
        while self.nebula_process.poll() is None:
            await asyncio.sleep(0.1)

    async def is_connected(self, timeout: int = 5) -> bool:
        """
        Check if VPN is connected

        Args:
            timeout: Timeout in seconds

        Returns:
            True if connected, False otherwise
        """
        if not self.vpn_ip:
            return False

        # Check if nebula1 interface exists
        try:
            result = await asyncio.create_subprocess_exec(
                "ip", "addr", "show", "nebula1",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(
                result.communicate(),
                timeout=timeout
            )

            if result.returncode == 0 and self.vpn_ip.encode() in stdout:
                logger.debug(f"✅ VPN interface active: {self.vpn_ip}")
                return True

        except (asyncio.TimeoutError, Exception) as e:
            logger.debug(f"VPN connectivity check failed: {e}")

        return False

    async def get_vpn_ip(self) -> Optional[str]:
        """
        Get current VPN IP address

        Returns:
            VPN IP address or None
        """
        try:
            result = await asyncio.create_subprocess_exec(
                "ip", "-4", "addr", "show", "nebula1",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await result.communicate()

            if result.returncode == 0:
                # Parse IP from output
                # Example: inet 10.42.0.1/16 scope global nebula1
                for line in stdout.decode().split('\n'):
                    if 'inet' in line and 'nebula1' in line:
                        ip = line.strip().split()[1].split('/')[0]
                        logger.debug(f"VPN IP: {ip}")
                        return ip

        except Exception as e:
            logger.error(f"Failed to get VPN IP: {e}")

        return None

    def get_public_ip(self) -> Optional[str]:
        """
        Get worker's public IP address

        Returns:
            Public IP or None
        """
        try:
            # Try to detect public IP via external service
            result = subprocess.run(
                ["curl", "-s", "--max-time", "3", "https://api.ipify.org"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                public_ip = result.stdout.strip()
                logger.info(f"Detected public IP: {public_ip}")
                return public_ip

        except Exception as e:
            logger.debug(f"Could not detect public IP: {e}")

        return None


async def main():
    """Test Nebula manager"""
    logging.basicConfig(level=logging.INFO)

    manager = NebulaManager("test-worker-001")

    # Check binary
    if not await manager.ensure_nebula_binary():
        logger.error("Nebula binary not found!")
        return

    # Generate CA (first worker)
    ca_crt, ca_key = await manager.initialize_ca()
    print(f"CA Certificate length: {len(ca_crt)} bytes")

    # Generate worker cert
    worker_crt, worker_key = await manager.generate_worker_cert(
        ca_crt, ca_key, "test-worker-001", "10.42.0.1/16", groups=["workers"]
    )
    print(f"Worker Certificate length: {len(worker_crt)} bytes")

    # Start Nebula (as lighthouse)
    await manager.start_nebula("10.42.0.1/16", is_lighthouse=True)

    # Check connectivity
    await asyncio.sleep(3)
    connected = await manager.is_connected()
    print(f"VPN Connected: {connected}")

    if connected:
        vpn_ip = await manager.get_vpn_ip()
        print(f"VPN IP: {vpn_ip}")

    # Keep running
    print("Nebula running... Press Ctrl+C to stop")
    try:
        await asyncio.sleep(60)
    except KeyboardInterrupt:
        print("\nStopping...")

    # Cleanup
    await manager.stop_nebula()


if __name__ == "__main__":
    asyncio.run(main())
