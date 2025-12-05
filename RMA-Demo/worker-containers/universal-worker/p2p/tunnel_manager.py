"""
P2P Tunnel Manager
Manages Cloudflare tunnel creation and lifecycle for worker P2P communication
"""

import subprocess
import logging
import time
import re
from typing import Optional

logger = logging.getLogger(__name__)


class TunnelManager:
    """
    Manages Cloudflare tunnels for P2P worker communication

    Tunnels provide:
    - NAT traversal without port forwarding
    - HTTPS endpoints for secure communication
    - Free tier usage (no bandwidth costs for tunnel setup)
    - Automatic failover and reconnection
    """

    def __init__(self, service_port: int = 8000):
        """
        Initialize tunnel manager

        Args:
            service_port: Local port to expose via tunnel
        """
        self.service_port = service_port
        self.tunnel_process: Optional[subprocess.Popen] = None
        self.tunnel_url: Optional[str] = None
        self.tunnel_type = "cloudflare"

    def create_tunnel(self, timeout: int = 30) -> Optional[str]:
        """
        Create a Cloudflare tunnel

        Args:
            timeout: Maximum seconds to wait for tunnel URL

        Returns:
            Tunnel URL (e.g., "https://worker-abc.trycloudflare.com") or None
        """
        logger.info(f"Creating Cloudflare Tunnel for port {self.service_port}...")

        try:
            # Start cloudflared tunnel
            self.tunnel_process = subprocess.Popen(
                [
                    "cloudflared",
                    "tunnel",
                    "--url", f"http://localhost:{self.service_port}",
                    "--no-autoupdate"
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Wait for tunnel URL in stderr
            start_time = time.time()
            while time.time() - start_time < timeout:
                line = self.tunnel_process.stderr.readline()

                if not line:
                    # Process died
                    if self.tunnel_process.poll() is not None:
                        logger.error("Tunnel process died unexpectedly")
                        return None
                    continue

                # Look for tunnel URL
                # Format: "https://worker-abc-123.trycloudflare.com"
                match = re.search(r'https://[a-z0-9\-]+\.trycloudflare\.com', line)
                if match:
                    self.tunnel_url = match.group(0)
                    logger.info(f"✅ Tunnel created: {self.tunnel_url}")
                    return self.tunnel_url

                time.sleep(0.1)

            logger.error(f"Timeout waiting for tunnel URL ({timeout}s)")
            self.stop_tunnel()
            return None

        except FileNotFoundError:
            logger.error("cloudflared not found - install from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/")
            return None
        except Exception as e:
            logger.error(f"Failed to create tunnel: {e}")
            return None

    def create_named_tunnel(self, tunnel_name: str, tunnel_credentials: str) -> Optional[str]:
        """
        Create a named Cloudflare tunnel (persistent)

        Requires:
        - Cloudflare account
        - Tunnel credentials file

        Args:
            tunnel_name: Name of the tunnel
            tunnel_credentials: Path to tunnel credentials JSON

        Returns:
            Tunnel URL or None
        """
        logger.info(f"Creating named tunnel: {tunnel_name}")

        try:
            # Start cloudflared with credentials
            self.tunnel_process = subprocess.Popen(
                [
                    "cloudflared",
                    "tunnel",
                    "--credentials-file", tunnel_credentials,
                    "run",
                    tunnel_name
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Named tunnels use DNS, construct URL
            self.tunnel_url = f"https://{tunnel_name}.tunnel.example.com"
            logger.info(f"✅ Named tunnel started: {self.tunnel_url}")
            return self.tunnel_url

        except Exception as e:
            logger.error(f"Failed to create named tunnel: {e}")
            return None

    def stop_tunnel(self):
        """Stop the tunnel process"""
        if self.tunnel_process:
            logger.info("Stopping tunnel...")
            self.tunnel_process.terminate()

            try:
                self.tunnel_process.wait(timeout=5)
                logger.info("✅ Tunnel stopped")
            except subprocess.TimeoutExpired:
                logger.warning("Tunnel didn't stop gracefully, killing...")
                self.tunnel_process.kill()
                self.tunnel_process.wait()

            self.tunnel_process = None
            self.tunnel_url = None

    def is_tunnel_healthy(self) -> bool:
        """
        Check if tunnel is still running

        Returns:
            True if tunnel process is alive
        """
        if not self.tunnel_process:
            return False

        return self.tunnel_process.poll() is None

    def get_tunnel_url(self) -> Optional[str]:
        """
        Get tunnel URL

        Returns:
            Tunnel URL or None
        """
        return self.tunnel_url

    def get_tunnel_metrics(self) -> dict:
        """
        Get tunnel metrics

        Returns:
            Dict with tunnel statistics
        """
        return {
            "tunnel_url": self.tunnel_url,
            "tunnel_type": self.tunnel_type,
            "is_healthy": self.is_tunnel_healthy(),
            "service_port": self.service_port
        }
