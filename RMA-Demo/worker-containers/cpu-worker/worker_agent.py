#!/usr/bin/env python3
"""
Containerized CPU Worker Agent
Lightweight version for running in containers with Cloudflare Tunnel support
"""

import os
import sys
import time
import json
import signal
import subprocess
from typing import Dict, Any, Optional, List
from datetime import datetime

try:
    import requests
    import psutil
except ImportError:
    print("❌ Missing dependencies")
    sys.exit(1)


class ContainerWorkerAgent:
    """Containerized worker agent for CPU workloads with tunnel support"""

    def __init__(self, coordinator_url: str, use_tunnel: bool = True, service_port: int = 8103):
        self.coordinator_url = coordinator_url.rstrip('/')
        self.worker_id: Optional[str] = None
        self.running = True
        self.tier = None
        self.use_tunnel = use_tunnel
        self.tunnel_process = None
        self.tunnel_url = None
        self.service_port = service_port

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\n🛑 Received signal {signum}. Shutting down...")
        self.running = False
        if self.tunnel_process:
            print("🔌 Closing tunnel...")
            self.tunnel_process.terminate()
            self.tunnel_process.wait()

    def start_tunnel(self) -> Optional[str]:
        """Start cloudflared tunnel and return public URL"""
        if not self.use_tunnel:
            return None
            
        # Get service name from environment
        service_name = os.getenv("SERVICE_NAME", "upload-service")
        print(f"🔧 Starting Cloudflare Tunnel for {service_name}:{self.service_port}...")
        
        # Retry logic for tunnel creation (API can be flaky)
        max_retries = 3
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    print(f"🔄 Retry {attempt}/{max_retries} after {retry_delay}s...")
                    time.sleep(retry_delay)
                
                # Try connecting to the service first to make sure it's ready
                try:
                    response = requests.get(f'http://{service_name}:{self.service_port}/health', timeout=5)
                    if response.status_code != 200:
                        print(f"⚠️  Service {service_name}:{self.service_port} not ready yet")
                        if attempt < max_retries - 1:
                            continue
                        return None
                except Exception as e:
                    print(f"⚠️  Cannot reach service {service_name}:{self.service_port}: {e}")
                    if attempt < max_retries - 1:
                        continue
                    return None
                
                # Start cloudflared quick tunnel pointing to the service container
                self.tunnel_process = subprocess.Popen(
                    ['cloudflared', 'tunnel', '--url', f'http://{service_name}:{self.service_port}', 
                     '--no-tls-verify'],  # Skip TLS verification for local services
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1
                )
                
                # Wait for tunnel URL (appears in stderr)
                timeout = 30
                start_time = time.time()
                
                while time.time() - start_time < timeout:
                    if self.tunnel_process.poll() is not None:
                        stderr = self.tunnel_process.stderr.read()
                        if "EOF" in stderr or "TLS" in stderr or "SSL" in stderr:
                            # API connection issue, try again
                            print(f"⚠️  Cloudflare API connection failed (attempt {attempt + 1}/{max_retries}): TLS/SSL error")
                            break
                        else:
                            print(f"❌ Tunnel process exited: {stderr}")
                            return None
                        
                    line = self.tunnel_process.stderr.readline()
                    if 'trycloudflare.com' in line:
                        # Extract URL from line
                        parts = line.split('https://')
                        if len(parts) > 1:
                            url = 'https://' + parts[1].split()[0].strip()
                            self.tunnel_url = url
                            print(f"✅ Tunnel active: {url}")
                            return url
                            
                    time.sleep(0.1)
                
                # If we got here, timeout occurred, try again
                if attempt < max_retries - 1:
                    if self.tunnel_process:
                        self.tunnel_process.terminate()
                        self.tunnel_process.wait()
                    continue
                else:
                    print("⚠️  Tunnel creation timed out after retries")
                    print("💡 Cloudflare Tunnel may be blocked by firewall/proxy")
                    return None
                
            except FileNotFoundError:
                print("⚠️  cloudflared not found, skipping tunnel (worker will use IP)")
                return None
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"⚠️  Tunnel attempt {attempt + 1} failed: {e}, retrying...")
                    continue
                else:
                    print(f"⚠️  Tunnel setup failed after {max_retries} attempts: {e}")
                    print("💡 Consider using a VPN or different network if issues persist")
                    return None
        
        return None

    def detect_capabilities(self) -> Dict[str, Any]:
        """Detect container capabilities"""
        print("🔍 Detecting container capabilities...")

        cpu_cores = psutil.cpu_count(logical=True)
        ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        disk_gb = psutil.disk_usage('/').total / (1024 ** 3)

        # Detect public IP
        public_ip = self.detect_public_ip()

        capabilities = {
            "cpu_cores": cpu_cores,
            "ram": f"{ram_gb:.1f}GB",
            "storage": f"{disk_gb:.1f}GB",
            "containerized": True,
            "worker_type": "cpu",
            "ip_address": public_ip
        }

        print(f"✅ CPU Cores: {cpu_cores}")
        print(f"✅ RAM: {ram_gb:.1f}GB")
        if public_ip:
            print(f"✅ Public IP: {public_ip}")

        return capabilities

    def detect_public_ip(self) -> Optional[str]:
        """Detect worker's public IP address"""
        # Try multiple IP detection services
        services = [
            "https://api.ipify.org",
            "https://ifconfig.me/ip",
            "https://icanhazip.com",
        ]
        
        for service in services:
            try:
                response = requests.get(service, timeout=5)
                if response.status_code == 200:
                    ip = response.text.strip()
                    # Basic validation
                    if ip and len(ip.split('.')) == 4:
                        return ip
            except Exception:
                continue
        
        # Fallback: try to get host's IP from environment or docker host
        try:
            import socket
            # This gets the container's IP in the docker network
            ip = socket.gethostbyname(socket.gethostname())
            # Check if it's a private IP
            if not ip.startswith(('127.', '172.', '10.')):
                return ip
        except Exception:
            pass
        
        return None

    def register_with_coordinator(self) -> Dict[str, Any]:
        """Register this worker with the coordinator"""
        print(f"\n📡 Registering with coordinator: {self.coordinator_url}")

        capabilities = self.detect_capabilities()
        ip_address = capabilities.get("ip_address")
        
        # Priority: ngrok env var > tunnel URL > IP address
        ngrok_url = os.getenv("NGROK_URL")
        if ngrok_url:
            endpoint_url = ngrok_url
            print(f"🔗 Using ngrok URL from environment: {ngrok_url}")
        elif self.tunnel_url:
            endpoint_url = self.tunnel_url
        else:
            endpoint_url = ip_address

        try:
            response = requests.post(
                f"{self.coordinator_url}/api/worker/register",
                json={
                    "capabilities": capabilities,
                    "ip_address": endpoint_url,  # Send tunnel/ngrok URL as "IP"
                    "tunnel_url": ngrok_url or self.tunnel_url  # Send tunnel URL separately
                },
                timeout=30
            )
            response.raise_for_status()
            assignment = response.json()

            self.worker_id = assignment["worker_id"]
            self.tier = assignment["tier"]

            print(f"\n✅ Registered successfully!")
            print(f"   Worker ID: {self.worker_id}")
            print(f"   Tier: {self.tier}")
            if self.tunnel_url:
                print(f"   Tunnel URL: {self.tunnel_url}")
            elif ip_address:
                print(f"   IP Address: {ip_address}")

            return assignment

        except requests.RequestException as e:
            print(f"❌ Registration failed: {e}")
            # Retry after delay
            return None

    def send_heartbeat(self):
        """Send heartbeat to coordinator"""
        if not self.worker_id:
            return

        cpu_percent = psutil.cpu_percent(interval=1) / 100.0
        current_load = min(cpu_percent, 1.0)
        available_memory = psutil.virtual_memory().available / (1024 ** 3)

        try:
            response = requests.post(
                f"{self.coordinator_url}/api/worker/heartbeat",
                json={
                    "worker_id": self.worker_id,
                    "status": "healthy",
                    "current_load": current_load,
                    "available_memory": f"{available_memory:.1f}GB"
                },
                timeout=10
            )
            response.raise_for_status()

            # Log every 5 minutes
            if int(time.time()) % 300 < 30:
                print(f"💓 Heartbeat sent (load: {current_load:.1%})")

        except requests.RequestException as e:
            print(f"⚠️  Heartbeat failed: {e}")

    def unregister(self):
        """Unregister from coordinator"""
        if not self.worker_id:
            return

        print(f"\n📤 Unregistering worker {self.worker_id}...")
        try:
            response = requests.delete(
                f"{self.coordinator_url}/api/worker/unregister/{self.worker_id}",
                timeout=10
            )
            response.raise_for_status()
            print("✅ Unregistered successfully")
        except requests.RequestException as e:
            print(f"⚠️  Unregister failed: {e}")

    def run(self):
        """Main worker loop"""
        print("=" * 60)
        print("RMA CPU Worker (Containerized)")
        print("=" * 60)

        # Start tunnel if enabled
        if self.use_tunnel:
            self.start_tunnel()
            # Give tunnel a moment to stabilize
            time.sleep(2)

        # Register with coordinator
        assignment = None
        retry_count = 0
        max_retries = 5

        while not assignment and retry_count < max_retries:
            assignment = self.register_with_coordinator()
            if not assignment:
                retry_count += 1
                print(f"⚠️  Retrying registration ({retry_count}/{max_retries})...")
                time.sleep(5)

        if not assignment:
            print("❌ Failed to register after multiple attempts")
            sys.exit(1)

        print("\n✅ CPU Worker is now active!")
        print("   Ready to process service workloads")
        if self.tunnel_url:
            print(f"   Accessible via: {self.tunnel_url}")
        print("   Press Ctrl+C to stop\n")

        # Main loop: Send heartbeats
        heartbeat_interval = assignment.get("heartbeat_interval", 30)
        last_heartbeat = 0

        while self.running:
            current_time = time.time()

            if current_time - last_heartbeat >= heartbeat_interval:
                self.send_heartbeat()
                last_heartbeat = current_time

            time.sleep(5)

        # Shutdown
        print("\n🛑 Shutting down worker...")
        self.unregister()
        print("✅ Worker shutdown complete")


def main():
    """Main entry point"""
    coordinator_url = os.getenv("COORDINATOR_URL", "http://localhost:8080")
    use_tunnel = os.getenv("USE_TUNNEL", "false").lower() == "true"
    service_port = int(os.getenv("SERVICE_PORT", "8103"))
    
    print(f"Starting CPU worker for coordinator: {coordinator_url}")
    if use_tunnel:
        print(f"🔒 Tunnel mode enabled for service on port {service_port}")
    
    agent = ContainerWorkerAgent(
        coordinator_url,
        use_tunnel=use_tunnel,
        service_port=service_port
    )
    agent.run()


if __name__ == "__main__":
    main()
