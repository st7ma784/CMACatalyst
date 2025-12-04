#!/usr/bin/env python3
"""
Containerized GPU Worker Agent
For running GPU workloads in containers with Cloudflare Tunnel support
"""

import os
import sys
import time
import json
import signal
import subprocess
from typing import Dict, Any, Optional

try:
    import requests
    import psutil
    import GPUtil
    HAS_GPU = True
except ImportError:
    print("❌ Missing dependencies")
    sys.exit(1)


class GPUWorkerAgent:
    """Containerized worker agent for GPU workloads"""

    def __init__(self, coordinator_url: str, use_tunnel: bool = True, service_port: int = 8000):
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
            
        service_name = os.getenv("SERVICE_NAME", "vllm-service")
        print(f"🔧 Starting Cloudflare Tunnel for {service_name}:{self.service_port}...")
        
        try:
            self.tunnel_process = subprocess.Popen(
                ['cloudflared', 'tunnel', '--url', f'http://{service_name}:{self.service_port}'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            
            timeout = 30
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                if self.tunnel_process.poll() is not None:
                    stderr = self.tunnel_process.stderr.read()
                    print(f"❌ Tunnel process exited unexpectedly: {stderr}")
                    return None
                    
                line = self.tunnel_process.stderr.readline()
                if 'trycloudflare.com' in line:
                    parts = line.split('https://')
                    if len(parts) > 1:
                        url = 'https://' + parts[1].split()[0].strip()
                        self.tunnel_url = url
                        print(f"✅ Tunnel active: {url}")
                        return url
                        
                time.sleep(0.1)
            
            print("⚠️  Tunnel URL not found in output, using IP instead")
            return None
            
        except FileNotFoundError:
            print("⚠️  cloudflared not found, skipping tunnel")
            return None
        except Exception as e:
            print(f"⚠️  Tunnel setup failed: {e}")
            return None

    def detect_gpu_capabilities(self) -> Optional[Dict[str, Any]]:
        """Detect GPU capabilities"""
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                return {
                    "gpu_memory": f"{int(gpu.memoryTotal)}MB",
                    "gpu_type": gpu.name,
                    "gpu_driver": gpu.driver,
                    "gpu_utilization": f"{gpu.load * 100:.1f}%"
                }
        except Exception as e:
            print(f"⚠️  GPU detection failed: {e}")
        return None

    def detect_capabilities(self) -> Dict[str, Any]:
        """Detect container capabilities"""
        print("🔍 Detecting GPU container capabilities...")

        cpu_cores = psutil.cpu_count(logical=True)
        ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        disk_gb = psutil.disk_usage('/').total / (1024 ** 3)

        capabilities = {
            "cpu_cores": cpu_cores,
            "ram": f"{ram_gb:.1f}GB",
            "storage": f"{disk_gb:.1f}GB",
            "containerized": True,
            "worker_type": "gpu"
        }

        # Add GPU info
        gpu_caps = self.detect_gpu_capabilities()
        if gpu_caps:
            capabilities.update(gpu_caps)
            print(f"✅ Detected GPU: {gpu_caps.get('gpu_type')} ({gpu_caps.get('gpu_memory')})")
        else:
            print("⚠️  No GPU detected in container")

        print(f"✅ CPU Cores: {cpu_cores}")
        print(f"✅ RAM: {ram_gb:.1f}GB")

        return capabilities

    def register_with_coordinator(self) -> Dict[str, Any]:
        """Register this worker with the coordinator"""
        print(f"\n📡 Registering with coordinator: {self.coordinator_url}")

        capabilities = self.detect_capabilities()
        capabilities["has_gpu"] = True  # Explicitly mark GPU capability
        endpoint_url = self.tunnel_url or capabilities.get("ip_address")

        # Define services this GPU worker can provide
        # GPU workers are Tier 1 and can handle GPU + CPU + processing tasks
        services = [
            {
                "name": "gpu-worker",  # Generic GPU worker service
                "service_url": endpoint_url,
                "port": 8102,
                "capabilities": ["llm", "embeddings", "ocr", "vision", "rag"],
                "health_endpoint": "/health"
            },
            {
                "name": "rag",  # RAG query service
                "service_url": endpoint_url,
                "port": 8102,
                "health_endpoint": "/health"
            },
            {
                "name": "vllm",  # vLLM inference (if available)
                "service_url": endpoint_url,
                "port": 8102,
                "health_endpoint": "/health"
            },
            {
                "name": "embeddings",  # Embedding generation
                "service_url": endpoint_url,
                "port": 8102,
                "health_endpoint": "/health"
            }
        ]

        try:
            response = requests.post(
                f"{self.coordinator_url}/api/worker/register",
                json={
                    "capabilities": capabilities,
                    "containers": services,  # Use containers format for service manifest
                    "ip_address": endpoint_url,
                    "tunnel_url": self.tunnel_url
                },
                timeout=30
            )
            response.raise_for_status()
            assignment = response.json()

            self.worker_id = assignment["worker_id"]
            self.tier = assignment["tier"]

            print(f"\n✅ Registered successfully!")
            print(f"   Worker ID: {self.worker_id}")
            print(f"   Tier: {self.tier} (GPU - can handle GPU, CPU, and processing tasks)")
            print(f"   Services: {', '.join([s['name'] for s in services])}")
            if self.tunnel_url:
                print(f"   Tunnel URL: {self.tunnel_url}")
            elif endpoint_url:
                print(f"   IP Address: {endpoint_url}")

            return assignment

        except requests.RequestException as e:
            print(f"❌ Registration failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Response: {e.response.text}")
            return None

    def send_heartbeat(self):
        """Send heartbeat to coordinator with GPU stats"""
        if not self.worker_id:
            return

        cpu_percent = psutil.cpu_percent(interval=1) / 100.0
        current_load = min(cpu_percent, 1.0)
        available_memory = psutil.virtual_memory().available / (1024 ** 3)

        # Get GPU stats if available
        gpu_stats = {}
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                gpu_stats = {
                    "gpu_utilization": f"{gpu.load * 100:.1f}%",
                    "gpu_memory_used": f"{gpu.memoryUsed}MB",
                    "gpu_temperature": f"{gpu.temperature}°C"
                }
        except Exception:
            pass

        heartbeat_data = {
            "worker_id": self.worker_id,
            "status": "healthy",
            "current_load": current_load,
            "available_memory": f"{available_memory:.1f}GB"
        }
        heartbeat_data.update(gpu_stats)

        try:
            response = requests.post(
                f"{self.coordinator_url}/api/worker/heartbeat",
                json=heartbeat_data,
                timeout=10
            )
            response.raise_for_status()

            # Log every 5 minutes
            if int(time.time()) % 300 < 30:
                gpu_info = f", GPU: {gpu_stats.get('gpu_utilization', 'N/A')}" if gpu_stats else ""
                print(f"💓 Heartbeat sent (CPU: {current_load:.1%}{gpu_info})")

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
        print("RMA GPU Worker (Containerized)")
        print("=" * 60)

        # Start tunnel if enabled
        if self.use_tunnel:
            self.start_tunnel()
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

        print("\n✅ GPU Worker is now active!")
        print("   Ready to process LLM/Vision workloads")
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
    use_tunnel = os.getenv("USE_TUNNEL", "true").lower() == "true"
    service_port = int(os.getenv("SERVICE_PORT", "8103"))
    
    print(f"Starting GPU worker for coordinator: {coordinator_url}")
    if use_tunnel:
        print(f"🔒 Tunnel mode enabled for service on port {service_port}")
    
    agent = GPUWorkerAgent(
        coordinator_url,
        use_tunnel=use_tunnel,
        service_port=service_port
    )
    agent.run()
    
    print(f"Starting GPU worker for coordinator: {coordinator_url}")
    agent = GPUWorkerAgent(
        coordinator_url,
        use_tunnel=use_tunnel,
        service_port=service_port
    )
    agent.run()


if __name__ == "__main__":
    main()
