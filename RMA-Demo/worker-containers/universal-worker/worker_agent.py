#!/usr/bin/env python3
"""
Universal Worker Agent
Auto-detects hardware capabilities (GPU/CPU/Storage)
Registers with coordinator and receives service assignments
Dynamically launches assigned services
"""

import os
import sys
import time
import socket
import requests
import subprocess
import logging
import json
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

# FastAPI for service endpoint
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

# Import DHT client
try:
    from dht.dht_client import DHTClient
    DHT_AVAILABLE = True
except ImportError:
    DHT_AVAILABLE = False
    logging.warning("DHT module not available - running in coordinator-only mode")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UniversalWorkerAgent:
    """Agent that auto-detects capabilities and runs assigned services"""

    def __init__(self):
        self.coordinator_url = os.getenv("COORDINATOR_URL", "http://localhost:8080")
        self.worker_id = os.getenv("WORKER_ID", f"worker-{socket.gethostname()}-{int(time.time())}")
        self.worker_type = os.getenv("WORKER_TYPE", "auto")  # auto/gpu/cpu/storage/edge
        self.use_tunnel = os.getenv("USE_TUNNEL", "true").lower() == "true"

        self.tunnel_process: Optional[subprocess.Popen] = None
        self.tunnel_url: Optional[str] = os.getenv("TUNNEL_URL")  # Pre-configured tunnel URL (for named tunnels)
        self.service_processes: Dict[str, subprocess.Popen] = {}
        self.assigned_services: List[str] = []

        # VPN mesh networking
        self.vpn_enabled = os.getenv("VPN_ENABLED", "true").lower() == "true"
        self.vpn_manager: Optional[Any] = None
        self.vpn_ip: Optional[str] = None
        self.is_lighthouse: bool = False
        self.cert_service_task: Optional[Any] = None  # Background task for cert signing service
        self.ca_key: Optional[str] = None  # CA private key (lighthouse only)

        # DHT client (optional - falls back to coordinator)
        self.dht_enabled = DHT_AVAILABLE and os.getenv("DHT_ENABLED", "true").lower() == "true"
        self.dht_client: Optional[DHTClient] = None
        self.dht_router: Optional[Any] = None  # DHT router for request forwarding

        if self.dht_enabled and DHT_AVAILABLE:
            self.dht_client = DHTClient(self.worker_id)

        # Auto-detect hardware capabilities
        self.capabilities = self.detect_capabilities()

        logger.info(f"🚀 Universal Worker Agent initialized")
        logger.info(f"Worker ID: {self.worker_id}")
        logger.info(f"Worker Type: {self.worker_type}")
        logger.info(f"DHT Enabled: {self.dht_enabled}")
        logger.info(f"Capabilities: {json.dumps(self.capabilities, indent=2)}")
        logger.info(f"Coordinator: {self.coordinator_url}")

        # Create FastAPI app for service endpoint
        self.app = self._create_fastapi_app()
        self.api_server_task: Optional[Any] = None

    def _create_fastapi_app(self) -> FastAPI:
        """
        Create FastAPI app with service endpoint

        This endpoint receives forwarded requests from other workers
        """
        app = FastAPI(
            title=f"RMA Worker - {self.worker_id}",
            description="Universal worker with DHT-based service routing",
            version="2.0.0"
        )

        @app.get("/health")
        async def health():
            """Health check endpoint"""
            return {
                "status": "healthy",
                "worker_id": self.worker_id,
                "vpn_ip": self.vpn_ip,
                "services": self.assigned_services,
                "dht_enabled": self.dht_enabled,
                "uptime": time.time()
            }

        @app.post("/service/{service_type}")
        async def handle_service_request(service_type: str, request_data: dict):
            """
            Handle service request (local or forwarded from other workers)

            This is the main endpoint for DHT-based request routing.
            Requests are routed via DHT router if available.
            """
            logger.info(f"📨 Received request for service: {service_type}")

            # Use DHT router if available
            if self.dht_router:
                try:
                    result = await self.dht_router.route_request(
                        service_type,
                        request_data,
                        timeout=30
                    )
                    logger.info(f"✅ Request completed for {service_type}")
                    return result

                except Exception as e:
                    logger.error(f"❌ Request routing failed: {e}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Request routing failed: {str(e)}"
                    )
            else:
                # Fallback: DHT router not available
                logger.warning("DHT router not available, cannot route request")
                raise HTTPException(
                    status_code=503,
                    detail="DHT router not initialized"
                )

        @app.get("/stats")
        async def get_stats():
            """Get worker and routing statistics"""
            stats = {
                "worker_id": self.worker_id,
                "vpn_ip": self.vpn_ip,
                "services": self.assigned_services,
                "capabilities": self.capabilities
            }

            # Add DHT router stats if available
            if self.dht_router:
                stats["routing"] = self.dht_router.get_stats()

            return stats

        return app

    def detect_capabilities(self) -> Dict[str, Any]:
        """Auto-detect hardware capabilities"""
        caps = {
            "hostname": socket.gethostname(),
            "cpu_cores": os.cpu_count() or 0,
        }
        
        # Detect GPU
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                gpu_info = result.stdout.strip().split(",")
                caps["has_gpu"] = True
                caps["gpu_type"] = gpu_info[0].strip()
                caps["gpu_memory"] = gpu_info[1].strip() if len(gpu_info) > 1 else "Unknown"
                caps["worker_type"] = "gpu"
                logger.info(f"✅ GPU detected: {caps['gpu_type']} ({caps['gpu_memory']})")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            caps["has_gpu"] = False
        
        # Detect public IP / edge capability (good network access)
        try:
            # Check if we have a public IP
            import socket as sock
            s = sock.socket(sock.AF_INET, sock.SOCK_DGRAM)
            s.settimeout(2)
            # Connect to public DNS to get our outbound IP
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            
            # Check if IP is public (not in private ranges)
            is_public = not (
                local_ip.startswith("10.") or
                local_ip.startswith("192.168.") or
                local_ip.startswith("172.16.") or
                local_ip.startswith("127.")
            )
            
            if is_public:
                caps["has_public_ip"] = True
                caps["public_ip"] = local_ip
                logger.info(f"✅ Public IP detected: {local_ip} (Edge capability)")
            
            # Check network bandwidth (simplified - check we can reach coordinator quickly)
            start_time = time.time()
            response = requests.get(f"{self.coordinator_url}/health", timeout=2)
            latency_ms = (time.time() - start_time) * 1000
            
            if latency_ms < 50 and response.status_code == 200:
                caps["low_latency"] = True
                caps["latency_ms"] = round(latency_ms, 2)
                logger.info(f"✅ Low latency to coordinator: {latency_ms:.0f}ms")
            
            # If we have public IP OR very low latency, we're edge-capable
            if is_public or (latency_ms < 50 if 'latency_ms' in locals() else False):
                caps["has_edge"] = True
                if not caps.get("has_gpu"):
                    logger.info("✅ Edge/Coordination capability detected")
        
        except Exception as e:
            logger.debug(f"Edge detection skipped: {e}")
            caps["has_public_ip"] = False
        
        # If no GPU and worker_type is auto, determine if edge/storage/CPU
        if self.worker_type == "auto" and not caps.get("has_gpu"):
            # Check for edge capability first (best network positioning)
            if caps.get("has_edge"):
                caps["worker_type"] = "edge"
                logger.info("✅ Edge worker (good network access)")
            # Check if running in storage-optimized environment
            elif os.path.exists("/chroma") or os.path.exists("/data"):
                caps["worker_type"] = "storage"
                caps["has_storage"] = True
                logger.info("✅ Storage environment detected")
            else:
                caps["worker_type"] = "cpu"
                logger.info("✅ CPU worker (no GPU found)")
        elif self.worker_type != "auto":
            caps["worker_type"] = self.worker_type
        
        # Get RAM info
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        total_kb = int(line.split()[1])
                        caps["ram"] = f"{total_kb // 1024 // 1024}GB"
                        break
        except FileNotFoundError:
            caps["ram"] = "Unknown"
        
        return caps
    
    def create_tunnel(self) -> Optional[str]:
        """Create Cloudflare Tunnel to expose services"""
        if not self.use_tunnel:
            logger.info("⏭️  Tunnel disabled, using direct connection")
            return None
        
        # Check for pre-configured tunnel URL (named tunnel managed externally)
        if self.tunnel_url:
            logger.info(f"✅ Using pre-configured tunnel: {self.tunnel_url}")
            return self.tunnel_url
        
        # Check if cloudflared is installed
        try:
            result = subprocess.run(["which", "cloudflared"], capture_output=True, text=True)
            if result.returncode != 0:
                logger.error("❌ cloudflared not found in PATH")
                logger.error("   Install with: wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && dpkg -i cloudflared-linux-amd64.deb")
                return None
            logger.info(f"✅ Found cloudflared at: {result.stdout.strip()}")
        except Exception as e:
            logger.error(f"❌ Failed to check for cloudflared: {e}")
            return None
        
        # Check for Cloudflare credentials for managed tunnels
        cf_api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        cf_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        
        if cf_api_token and cf_account_id:
            # Use managed tunnel with credentials
            return self.create_managed_tunnel(cf_api_token, cf_account_id)
        else:
            # Fallback to quick tunnel (anonymous, may be rate limited)
            logger.info("ℹ️  No CLOUDFLARE_API_TOKEN found, using quick tunnel")
            logger.info("   Quick tunnels have rate limits and no uptime guarantee")
            logger.info("   For production, set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID")
            return self.create_quick_tunnel()
    
    def create_managed_tunnel(self, api_token: str, account_id: str) -> Optional[str]:
        """Create a managed Cloudflare Tunnel using API (non-interactive)"""
        tunnel_name = f"worker-{self.worker_id or socket.gethostname()}"
        logger.info(f"🌐 Creating managed Cloudflare Tunnel via API: {tunnel_name}")
        
        try:
            import requests
            import json
            import uuid
            import os
            
            # Create tunnel via Cloudflare API
            headers = {
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json"
            }
            
            # Generate tunnel secret
            tunnel_secret = str(uuid.uuid4()).replace("-", "")
            
            # Create tunnel via API
            create_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/cfd_tunnel"
            create_payload = {
                "name": tunnel_name,
                "tunnel_secret": tunnel_secret
            }
            
            logger.info(f"Creating tunnel via API: {tunnel_name}")
            response = requests.post(create_url, headers=headers, json=create_payload, timeout=10)
            
            if response.status_code == 409:
                # Tunnel already exists, try to get existing tunnel
                logger.info(f"Tunnel {tunnel_name} already exists, fetching existing tunnel...")
                list_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/cfd_tunnel"
                list_response = requests.get(list_url, headers=headers, timeout=10)
                
                if list_response.status_code != 200:
                    logger.error(f"Failed to list tunnels: {list_response.text}")
                    logger.info("Falling back to quick tunnel...")
                    return self.create_quick_tunnel()
                
                tunnels = list_response.json().get("result", [])
                tunnel = next((t for t in tunnels if t.get("name") == tunnel_name), None)
                
                if not tunnel:
                    logger.error(f"Could not find existing tunnel {tunnel_name}")
                    logger.info("Falling back to quick tunnel...")
                    return self.create_quick_tunnel()
                
                tunnel_id = tunnel["id"]
                logger.info(f"Using existing tunnel: {tunnel_id}")
                
            elif response.status_code == 200 or response.status_code == 201:
                result = response.json().get("result", {})
                tunnel_id = result.get("id")
                logger.info(f"✅ Tunnel created via API: {tunnel_id}")
            else:
                logger.error(f"Failed to create tunnel via API: {response.status_code} - {response.text}")
                logger.info("Falling back to quick tunnel...")
                return self.create_quick_tunnel()
            
            # Create credentials file for cloudflared
            credentials_dir = os.path.expanduser("~/.cloudflared")
            os.makedirs(credentials_dir, exist_ok=True)
            
            credentials_file = os.path.join(credentials_dir, f"{tunnel_id}.json")
            credentials = {
                "AccountTag": account_id,
                "TunnelSecret": tunnel_secret,
                "TunnelID": tunnel_id
            }
            
            with open(credentials_file, "w") as f:
                json.dump(credentials, f)
            
            logger.info(f"✅ Credentials file created: {credentials_file}")
            
            # Start tunnel with credentials file
            process = subprocess.Popen(
                [
                    "cloudflared", "tunnel", "run",
                    "--url", "http://localhost:8000",
                    "--credentials-file", credentials_file,
                    tunnel_id
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            
            self.tunnel_process = process
            
            # The tunnel URL will be: https://<tunnel-id>.cfargotunnel.com
            self.tunnel_url = f"https://{tunnel_id}.cfargotunnel.com"
            logger.info(f"✅ Managed tunnel started: {self.tunnel_url}")
            
            # Wait a moment for tunnel to initialize
            time.sleep(2)
            
            return self.tunnel_url
            
        except Exception as e:
            logger.error(f"Failed to create managed tunnel: {e}")
            import traceback
            logger.error(traceback.format_exc())
            logger.info("Falling back to quick tunnel...")
            return self.create_quick_tunnel()
    
    def create_quick_tunnel(self) -> Optional[str]:
        """Create an anonymous quick tunnel (rate limited, no uptime guarantee)"""
        logger.info("🌐 Creating Cloudflare Quick Tunnel...")
        
        try:
            # Start cloudflared tunnel with unbuffered output
            process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", "http://localhost:8000", "--no-autoupdate", "--metrics", "localhost:9090"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,  # Merge stderr into stdout
                text=True,
                bufsize=1,  # Line buffered
                universal_newlines=True
            )
            
            self.tunnel_process = process
            
            # Wait for tunnel URL in output
            import re
            tunnel_found = False
            for i in range(60):  # Increased to 60 second timeout for slow connections
                line = process.stdout.readline()
                if line:
                    line = line.strip()
                    logger.info(f"[cloudflared] {line}")
                    
                    # Look for tunnel URL in various formats
                    if "trycloudflare.com" in line or "Your quick Tunnel" in line or "tunnel" in line.lower():
                        # Try multiple patterns
                        match = re.search(r'https://([a-z0-9]+-[a-z0-9]+-[a-z0-9]+)\.trycloudflare\.com', line)
                        if not match:
                            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                        if match:
                            url = match.group(0)
                            # Skip api.trycloudflare.com
                            if not url.startswith("https://api."):
                                self.tunnel_url = url
                                tunnel_found = True
                                logger.info(f"✅ Tunnel created: {self.tunnel_url}")
                                # Keep process running and return
                                return self.tunnel_url
                
                # Check if process died
                poll_result = process.poll()
                if poll_result is not None:
                    # Get any remaining output
                    remaining = process.stdout.read()
                    if remaining:
                        for remaining_line in remaining.split('\n'):
                            if remaining_line.strip():
                                logger.error(f"[cloudflared] {remaining_line.strip()}")
                    logger.error(f"❌ cloudflared process exited with code {poll_result}")
                    logger.error("   This may be due to rate limiting or network issues")
                    logger.error("   Try again in a few minutes or use a named tunnel")
                    break
                    
                time.sleep(1)
            
            if not tunnel_found:
                logger.error("❌ Failed to get tunnel URL")
                logger.error("   Cloudflared started but didn't provide a tunnel URL")
                logger.error("   This could be rate limiting - Cloudflare limits quick tunnels")
            return None
            
        except Exception as e:
            logger.error(f"❌ Tunnel creation failed: {e}")
            return None
    
    def resolve_tunnel_to_ip(self, tunnel_url: str) -> str:
        """
        Resolve tunnel hostname to IP address for coordinator access.
        Worker can resolve .cfargotunnel.com via cloudflared, but coordinator may not.
        """
        try:
            from urllib.parse import urlparse
            parsed = urlparse(tunnel_url)
            hostname = parsed.hostname
            
            if hostname and '.cfargotunnel.com' in hostname:
                # Try to resolve via socket (works with cloudflared running)
                try:
                    ip = socket.gethostbyname(hostname)
                    resolved_url = f"{parsed.scheme}://{ip}"
                    if parsed.port:
                        resolved_url += f":{parsed.port}"
                    logger.info(f"✅ Resolved tunnel {hostname} → {ip}")
                    return resolved_url
                except socket.gaierror:
                    logger.warning(f"⚠️  Could not resolve {hostname}, using original URL")
                    return tunnel_url
            else:
                # Not a tunnel URL, return as-is
                return tunnel_url
                
        except Exception as e:
            logger.warning(f"⚠️  Tunnel resolution error: {e}, using original URL")
            return tunnel_url

    async def initialize_vpn(self):
        """
        Initialize VPN mesh networking

        This method:
        1. Checks if this is the first worker (bootstrap)
        2. Either bootstraps VPN network or joins existing network
        3. Registers as entry point if worker has public IP
        """
        if not self.vpn_enabled:
            logger.info("⏭️  VPN disabled, skipping VPN initialization")
            return

        logger.info("=" * 60)
        logger.info("🔐 VPN MESH INITIALIZATION")
        logger.info("=" * 60)

        try:
            # Import VPN modules
            from vpn.nebula_manager import NebulaManager
            from vpn.bootstrap import (
                is_first_worker,
                bootstrap_vpn_network,
                join_vpn_network,
                register_as_entry_point
            )

            # Initialize Nebula manager
            self.vpn_manager = NebulaManager(self.worker_id)

            # Check if Nebula binary is available
            if not await self.vpn_manager.ensure_nebula_binary():
                logger.error("❌ Nebula binary not found")
                logger.error("   VPN requires Nebula to be installed")
                logger.error("   Disabling VPN and continuing with tunnels...")
                self.vpn_enabled = False
                return

            # Check if this is the first worker
            logger.info("🔍 Checking if this is the first worker...")
            is_first = await is_first_worker()

            if is_first:
                logger.info("🌟 This is the FIRST worker - bootstrapping VPN network")
                self.is_lighthouse = True

                # Bootstrap VPN network
                bootstrap_config = await bootstrap_vpn_network(self.vpn_manager)
                self.vpn_ip = bootstrap_config["lighthouse_vpn_ip"]

                # Store CA key for certificate signing (lighthouse only)
                ca_key_path = self.vpn_manager.config_dir / "ca.key"
                if ca_key_path.exists():
                    self.ca_key = ca_key_path.read_text()
                    logger.info("✅ CA private key loaded for cert signing")

                # Start certificate signing service in background
                logger.info("🔐 Starting certificate signing service...")
                await self._start_cert_signing_service()

                logger.info(f"✅ VPN network bootstrapped")
                logger.info(f"   Lighthouse VPN IP: {self.vpn_ip}")
                logger.info(f"   Network CIDR: {bootstrap_config['network_cidr']}")

            else:
                logger.info("Joining existing VPN network...")
                self.is_lighthouse = False

                # Join existing network
                self.vpn_ip = await join_vpn_network(self.vpn_manager)

                logger.info(f"✅ Joined VPN network")
                logger.info(f"   Worker VPN IP: {self.vpn_ip}")

            # Update capabilities with VPN IP
            self.capabilities["vpn_ip"] = self.vpn_ip
            self.capabilities["is_lighthouse"] = self.is_lighthouse

            # Register as entry point if worker has public IP
            if self.capabilities.get("has_public_ip"):
                public_ip = self.capabilities.get("public_ip")
                logger.info(f"📍 Registering as entry point (public IP: {public_ip})")

                success = await register_as_entry_point(public_ip, port=8443)
                if success:
                    logger.info("✅ Registered as VPN entry point")
                    self.capabilities["is_entry_point"] = True
                else:
                    logger.warning("⚠️  Failed to register as entry point")
            else:
                logger.info("ℹ️  No public IP - not registering as entry point")

            logger.info("=" * 60)
            logger.info(f"✅ VPN MESH READY - IP: {self.vpn_ip}")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"❌ VPN initialization failed: {e}")
            logger.error("   Disabling VPN and continuing with tunnels...")
            logger.error("   Stack trace:", exc_info=True)
            self.vpn_enabled = False
            self.vpn_manager = None
            self.vpn_ip = None

    async def _start_cert_signing_service(self):
        """
        Start certificate signing service (lighthouse only)

        Runs in background to sign certificates for joining workers
        """
        if not self.is_lighthouse or not self.ca_key:
            logger.warning("Cannot start cert signing service - not lighthouse or no CA key")
            return

        try:
            from vpn.cert_signing_service import CertSigningService
            import threading

            # Get CA cert
            ca_crt_path = self.vpn_manager.config_dir / "ca.crt"
            ca_crt = ca_crt_path.read_text()

            # Create cert signing service
            cert_service = CertSigningService(
                ca_crt=ca_crt,
                ca_key=self.ca_key,
                nebula_manager=self.vpn_manager
            )

            # Start service in background thread
            def run_cert_service():
                """Run cert service in thread"""
                try:
                    import asyncio
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(cert_service.start())
                except Exception as e:
                    logger.error(f"Cert signing service error: {e}")

            cert_thread = threading.Thread(
                target=run_cert_service,
                daemon=True,
                name="cert-signing-service"
            )
            cert_thread.start()

            # Give it a moment to start
            await asyncio.sleep(2)

            logger.info("✅ Certificate signing service started on port 8444")

        except Exception as e:
            logger.error(f"Failed to start cert signing service: {e}")
            logger.warning("Workers may not be able to join VPN network!")

    async def start_api_server(self, port: int = 8000):
        """
        Start FastAPI server for service endpoint

        Runs in background thread to handle incoming service requests
        """
        logger.info(f"🌐 Starting API server on port {port}...")

        try:
            import threading

            def run_api_server():
                """Run FastAPI server in thread"""
                try:
                    uvicorn.run(
                        self.app,
                        host="0.0.0.0",
                        port=port,
                        log_level="info"
                    )
                except Exception as e:
                    logger.error(f"API server error: {e}")

            api_thread = threading.Thread(
                target=run_api_server,
                daemon=True,
                name="api-server"
            )
            api_thread.start()

            # Give it a moment to start
            await asyncio.sleep(2)

            logger.info(f"✅ API server started on http://0.0.0.0:{port}")
            logger.info(f"   Endpoints:")
            logger.info(f"   - GET  /health - Health check")
            logger.info(f"   - POST /service/{{service_type}} - Service requests")
            logger.info(f"   - GET  /stats - Worker statistics")

        except Exception as e:
            logger.error(f"Failed to start API server: {e}")
            raise

    def register_with_coordinator(self) -> Dict[str, Any]:
        """Register worker and receive service assignments"""
        logger.info("📝 Registering with coordinator...")

        # Use worker_id as hostname (resolvable on Docker network)
        # Fallback to socket.gethostname() if tunnel_url not set
        tunnel_url = self.tunnel_url or f"http://{self.worker_id}:8000"

        registration_data = {
            "worker_id": self.worker_id,  # Include worker_id (coordinator may reassign it)
            "tunnel_url": tunnel_url,
            "vpn_ip": self.vpn_ip,  # Include VPN IP for P2P communication
            "capabilities": self.capabilities
        }

        try:
            response = requests.post(
                f"{self.coordinator_url}/api/worker/register",
                json=registration_data,
                timeout=10
            )
            response.raise_for_status()

            result = response.json()

            # IMPORTANT: Update worker_id with the one assigned by coordinator
            if "worker_id" in result:
                old_id = self.worker_id
                self.worker_id = result["worker_id"]
                logger.info(f"   Assigned Worker ID: {self.worker_id}")

            # Get assigned containers (coordinator returns "assigned_containers", not "assigned_services")
            self.assigned_services = result.get("assigned_services", [])
            assigned_containers = result.get("assigned_containers", [])
            if assigned_containers:
                logger.info(f"   Assigned Containers: {len(assigned_containers)}")
                for container in assigned_containers:
                    logger.info(f"      - {container.get('name', 'unknown')}")

            logger.info(f"✅ Registration successful!")

            return result

        except requests.RequestException as e:
            logger.error(f"❌ Registration failed: {e}")
            raise
    
    def launch_service(self, service_name: str, service_config: Dict[str, Any]) -> bool:
        """Launch an assigned service"""
        logger.info(f"🚀 Launching service: {service_name}")
        
        port = service_config.get("port", 8000)
        
        # Import service launcher
        try:
            from service_launcher import launch_service
            process = launch_service(service_name, port, self.capabilities)
            
            if process:
                self.service_processes[service_name] = process
                logger.info(f"✅ Service {service_name} started on port {port}")
                return True
            else:
                logger.error(f"❌ Failed to start {service_name}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error launching {service_name}: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat to coordinator"""
        try:
            # Check service health
            services_status = {}
            for svc_name, process in self.service_processes.items():
                if process.poll() is None:
                    services_status[svc_name] = "running"
                else:
                    services_status[svc_name] = "stopped"
                    logger.warning(f"⚠️  Service {svc_name} stopped unexpectedly")

            # Coordinator expects: worker_id, status, current_load, available_memory (optional)
            heartbeat_data = {
                "worker_id": self.worker_id,
                "status": "healthy" if all(s == "running" for s in services_status.values()) or not services_status else "degraded",
                "current_load": 0.0,  # TODO: Calculate actual load
            }

            response = requests.post(
                f"{self.coordinator_url}/api/worker/heartbeat",
                json=heartbeat_data,
                timeout=5
            )
            response.raise_for_status()
            logger.debug(f"💓 Heartbeat sent successfully")

        except requests.RequestException as e:
            logger.error(f"❌ Heartbeat failed: {e}")

    async def initialize_dht(self):
        """Initialize DHT connection"""
        if not self.dht_enabled or not self.dht_client:
            logger.info("DHT disabled, using coordinator only")
            return

        try:
            # Connect to DHT via edge router bootstrap
            await self.dht_client.connect(self.coordinator_url)

            # Register worker in DHT (includes VPN IP for P2P routing)
            await self.dht_client.register_worker(
                tunnel_url=self.tunnel_url or f"http://{socket.gethostname()}:8000",
                services=self.assigned_services,
                capabilities=self.capabilities,
                vpn_ip=self.vpn_ip  # Include VPN IP for fast P2P routing
            )

            # Initialize DHT router for request forwarding
            from dht.router import DHTRouter
            self.dht_router = DHTRouter(
                dht_node=self.dht_client.node,
                local_services=self.assigned_services,
                worker_id=self.worker_id,
                coordinator_url=os.getenv("COORDINATOR_URL", "http://host.docker.internal:8080")
            )

            logger.info("✅ DHT initialized and worker registered")
            logger.info(f"✅ DHT router ready with HTTP fallback for service discovery")

        except Exception as e:
            logger.warning(f"DHT initialization failed: {e}")
            logger.info("Continuing with coordinator-only mode")
            self.dht_enabled = False

    async def find_service_worker_dht(self, service_type: str) -> Optional[str]:
        """
        Find worker for service using DHT

        Returns:
            Worker tunnel URL or None
        """
        if not self.dht_enabled:
            return None

        try:
            worker_info = await self.dht_client.find_worker_for_service(service_type)
            if worker_info:
                return worker_info["tunnel_url"]
            return None

        except Exception as e:
            logger.error(f"DHT service lookup failed: {e}")
            return None

    def find_service_worker(self, service_type: str) -> Optional[str]:
        """
        Find worker for service (DHT first, fallback to coordinator)

        This method can be used by services to find other workers.
        """
        # Try DHT first
        if self.dht_enabled:
            try:
                # Run async DHT lookup
                loop = asyncio.new_event_loop()
                worker_url = loop.run_until_complete(
                    self.find_service_worker_dht(service_type)
                )
                loop.close()

                if worker_url:
                    logger.info(f"Found worker via DHT: {service_type}")
                    return worker_url

            except Exception as e:
                logger.warning(f"DHT lookup failed, falling back to coordinator: {e}")

        # Fallback to coordinator
        logger.info(f"Using coordinator to find: {service_type}")
        return self.find_service_worker_coordinator(service_type)

    def find_service_worker_coordinator(self, service_type: str) -> Optional[str]:
        """Original coordinator-based lookup (fallback)"""
        try:
            response = requests.get(
                f"{self.coordinator_url}/api/worker/find/{service_type}",
                timeout=5
            )
            response.raise_for_status()
            result = response.json()
            return result.get("worker_url")
        except requests.RequestException as e:
            logger.error(f"Coordinator lookup failed: {e}")
            return None

    def run_edge_worker(self):
        """Run as edge coordinator - hosts the coordinator service locally"""
        try:
            logger.info("=" * 60)
            logger.info("🌐 EDGE WORKER MODE - Running coordinator locally")
            logger.info("=" * 60)
            
            # Edge workers don't run a local coordinator
            # Instead, they register at api.rmatool.org.uk as an edge coordinator
            # and api.rmatool.org.uk routes workers to them
            
            logger.info("ℹ️  Edge workers should run the coordinator service separately")
            logger.info("   Start coordinator with:")
            logger.info("   cd services/local-coordinator && python -m uvicorn app:app --host 0.0.0.0 --port 8080")
            logger.info("")
            
            # Create tunnel for the coordinator (if not already configured)
            if self.use_tunnel and not self.tunnel_url:
                logger.info("📡 Creating Cloudflare Tunnel for coordinator access...")
                # Tunnel to port 8080 where coordinator should be running
                process = subprocess.Popen(
                    ["cloudflared", "tunnel", "--url", "http://localhost:8080", "--no-autoupdate"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                self.tunnel_process = process
                
                # Wait for tunnel URL
                for _ in range(30):
                    line = process.stderr.readline()
                    if "https://" in line and ".trycloudflare.com" in line:
                        # Log the actual line for debugging
                        logger.debug(f"Cloudflared output: {line.strip()}")
                        # Extract URL - match subdomain.trycloudflare.com (not api.trycloudflare.com)
                        import re
                        # Look for pattern like https://abc-xyz-123.trycloudflare.com
                        match = re.search(r'https://([a-z0-9]+-[a-z0-9]+-[a-z0-9]+)\.trycloudflare\.com', line)
                        if match:
                            self.tunnel_url = match.group(0)
                            logger.info(f"✅ Tunnel created: {self.tunnel_url}")
                            break
                        # Fallback to any subdomain except 'api'
                        match = re.search(r'https://(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                        if match:
                            self.tunnel_url = match.group(0)
                            logger.info(f"✅ Tunnel created: {self.tunnel_url}")
                            break
                    time.sleep(1)
                
                if not self.tunnel_url:
                    logger.error("❌ Failed to create tunnel")
                    return
            elif not self.tunnel_url:
                # No tunnel URL configured, use direct access
                public_ip = self.capabilities.get("public_ip", socket.gethostname())
                self.tunnel_url = f"http://{public_ip}:8080"
                logger.info(f"ℹ️  Direct access mode: {self.tunnel_url}")
            else:
                # Tunnel URL was pre-configured (e.g., named tunnel)
                logger.info(f"✅ Using pre-configured tunnel: {self.tunnel_url}")
            
            # Register as edge coordinator at api.rmatool.org.uk
            if self.coordinator_url and self.coordinator_url != "http://localhost:8080":
                logger.info(f"📝 Registering as edge coordinator at {self.coordinator_url}...")
                registration_data = {
                    "worker_id": self.worker_id,
                    "worker_type": "edge",
                    "tunnel_url": self.tunnel_url,
                    "services": ["coordinator", "edge-proxy"],
                    "capabilities": self.capabilities,
                    "role": "edge_coordinator"
                }
                
                try:
                    response = requests.post(
                        f"{self.coordinator_url}/api/edge/register",
                        json=registration_data,
                        timeout=10
                    )
                    response.raise_for_status()
                    result = response.json()
                    logger.info("✅ Registered as edge coordinator")
                    logger.info(f"   Role: {result.get('role', 'coordinator')}")
                except requests.RequestException as e:
                    logger.warning(f"⚠️  Failed to register at {self.coordinator_url}: {e}")
                    logger.info("   Running as standalone coordinator")
            
            logger.info("")
            logger.info("=" * 60)
            logger.info("✅ EDGE COORDINATOR READY")
            logger.info(f"   Tunnel URL: {self.tunnel_url}")
            logger.info("   Other workers should set:")
            logger.info(f"   COORDINATOR_URL={self.tunnel_url}")
            logger.info("=" * 60)
            logger.info("")
            
            # Keep tunnel alive and send heartbeats
            heartbeat_interval = 60  # Send heartbeat every 60 seconds
            last_heartbeat = time.time()
            
            logger.info("🔄 Starting coordinator heartbeat loop...")
            
            while True:
                # Check tunnel process if we created one
                if self.tunnel_process:
                    if self.tunnel_process.poll() is not None:
                        logger.error("❌ Tunnel process died")
                        break
                
                # Send coordinator heartbeat to edge router
                current_time = time.time()
                if current_time - last_heartbeat >= heartbeat_interval:
                    try:
                        response = requests.post(
                            f"{self.coordinator_url}/api/edge/heartbeat",
                            json={"worker_id": self.worker_id},
                            timeout=5
                        )
                        if response.status_code == 200:
                            logger.debug("💓 Coordinator heartbeat sent")
                        else:
                            logger.warning(f"Coordinator heartbeat returned {response.status_code}")
                        last_heartbeat = current_time
                    except Exception as e:
                        logger.warning(f"Failed to send coordinator heartbeat: {e}")
                
                time.sleep(30)
                
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down edge coordinator...")
            self.cleanup()
        except Exception as e:
            logger.error(f"❌ Fatal error in edge worker: {e}")
            self.cleanup()
            raise
    
    def run(self):
        """Main worker loop"""
        try:
            # Special handling for edge workers
            if self.capabilities.get("worker_type") == "edge":
                logger.info("🌐 Detected as EDGE worker - will run coordinator locally")
                logger.info("   Other workers should register with this coordinator at:")
                logger.info(f"   http://{socket.gethostname()}:8080")
                
                # Edge workers run the coordinator service itself
                # They don't register with an external coordinator
                self.run_edge_worker()
                return
            
            # For non-edge workers: register with coordinator
            # Step 0: Check coordinator availability
            logger.info(f"🔍 Checking coordinator availability at {self.coordinator_url}...")
            try:
                health_response = requests.get(f"{self.coordinator_url}/health", timeout=5)
                if health_response.status_code == 200:
                    logger.info("✅ Coordinator is reachable")
                else:
                    logger.error(f"❌ Coordinator returned status {health_response.status_code}")
                    logger.error("   Make sure the coordinator is running:")
                    logger.error(f"   cd RMA-Demo/services/local-coordinator && python -m uvicorn app:app --host 0.0.0.0 --port 8080")
                    return
            except requests.RequestException as e:
                logger.error(f"❌ Cannot reach coordinator at {self.coordinator_url}: {e}")
                logger.error("")
                logger.error("   The coordinator must be running before starting workers.")
                logger.error("   Start the coordinator with:")
                logger.error(f"   cd RMA-Demo/services/local-coordinator && python -m uvicorn app:app --host 0.0.0.0 --port 8080")
                logger.error("")
                logger.error("   Or if using Docker, set COORDINATOR_URL to the correct address:")
                logger.error("   docker run -e COORDINATOR_URL=http://host.docker.internal:8080 ...")
                return
            
            # Step 1: Initialize VPN mesh network (optional)
            if self.vpn_enabled:
                logger.info("🔗 Initializing VPN mesh network...")
                loop = asyncio.new_event_loop()
                loop.run_until_complete(self.initialize_vpn())
                loop.close()

            # Step 2: Create tunnel (optional)
            if self.use_tunnel:
                tunnel_url = self.create_tunnel()
                if not tunnel_url:
                    logger.warning("⚠️  Failed to create tunnel, continuing without tunnel")

            # Step 3: Register and get service assignments
            registration_result = self.register_with_coordinator()
            service_configs = registration_result.get("service_configs", [])

            # Step 4: Initialize DHT (after registration so we know our assigned services)
            if self.dht_enabled:
                logger.info("🔗 Initializing DHT connection...")
                loop = asyncio.new_event_loop()
                loop.run_until_complete(self.initialize_dht())
                loop.close()

            # Step 5: Start API server for service endpoint
            logger.info("🚀 Starting API server for service routing...")
            loop = asyncio.new_event_loop()
            loop.run_until_complete(self.start_api_server(port=8000))
            loop.close()

            # Step 6: Launch assigned services
            for service_config in service_configs:
                service_name = service_config["name"]
                self.launch_service(service_name, service_config)

            # Step 7: Heartbeat loop
            logger.info("💓 Starting heartbeat loop...")
            while True:
                time.sleep(30)  # Heartbeat every 30 seconds
                self.send_heartbeat()
                
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down gracefully...")
            self.cleanup()
        except Exception as e:
            logger.error(f"❌ Fatal error: {e}")
            self.cleanup()
            raise
    
    def cleanup(self):
        """Clean up resources"""
        logger.info("🧹 Cleaning up...")

        # Stop VPN
        if self.vpn_enabled and self.vpn_manager:
            logger.info("   Stopping VPN...")
            try:
                loop = asyncio.new_event_loop()
                loop.run_until_complete(self.vpn_manager.stop_nebula())
                loop.close()
                logger.info("✅ VPN stopped")
            except Exception as e:
                logger.warning(f"VPN stop failed: {e}")

        # Disconnect from DHT
        if self.dht_enabled and self.dht_client:
            logger.info("   Disconnecting from DHT...")
            try:
                loop = asyncio.new_event_loop()
                loop.run_until_complete(self.dht_client.disconnect())
                loop.close()
                logger.info("✅ Disconnected from DHT")
            except Exception as e:
                logger.warning(f"DHT disconnect failed: {e}")

        # Stop all service processes
        for svc_name, process in self.service_processes.items():
            if process.poll() is None:
                logger.info(f"   Stopping {svc_name}...")
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

        # Stop tunnel
        if self.tunnel_process and self.tunnel_process.poll() is None:
            logger.info("   Stopping tunnel...")
            self.tunnel_process.terminate()
            try:
                self.tunnel_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.tunnel_process.kill()

        # Unregister from coordinator
        try:
            requests.delete(
                f"{self.coordinator_url}/api/worker/unregister/{self.worker_id}",
                timeout=5
            )
            logger.info("✅ Unregistered from coordinator")
        except requests.RequestException:
            pass


if __name__ == "__main__":
    agent = UniversalWorkerAgent()
    agent.run()
