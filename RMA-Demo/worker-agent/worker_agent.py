#!/usr/bin/env python3
"""
RMA Worker Agent

This script runs on worker nodes to:
1. Detect hardware capabilities
2. Register with coordinator
3. Pull and run assigned containers
4. Send periodic heartbeats
5. Monitor container health
"""

import os
import sys
import time
import json
import signal
import argparse
import subprocess
from typing import Dict, Any, Optional, List
from datetime import datetime

try:
    import requests
    import psutil
    import docker
except ImportError:
    print("❌ Missing dependencies. Install with:")
    print("   pip install requests psutil docker")
    sys.exit(1)

# Try to import GPU detection library
try:
    import GPUtil
    HAS_GPU_UTIL = True
except ImportError:
    HAS_GPU_UTIL = False
    print("⚠️  GPUtil not installed. GPU detection will be limited.")
    print("   For GPU support: pip install gputil")


class WorkerAgent:
    """Worker agent for RMA distributed system"""

    def __init__(self, coordinator_url: str):
        self.coordinator_url = coordinator_url.rstrip('/')
        self.worker_id: Optional[str] = None
        self.assigned_containers: List[Dict] = []
        self.docker_client = None
        self.running = True
        self.containers = []

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\n🛑 Received signal {signum}. Shutting down gracefully...")
        self.running = False

    def detect_gpu_capabilities(self) -> Optional[Dict[str, Any]]:
        """Detect GPU capabilities"""

        if HAS_GPU_UTIL:
            try:
                gpus = GPUtil.getGPUs()
                if gpus:
                    gpu = gpus[0]  # Use first GPU
                    return {
                        "gpu_memory": f"{int(gpu.memoryTotal)}MB",
                        "gpu_type": gpu.name,
                        "gpu_driver": gpu.driver
                    }
            except Exception as e:
                print(f"⚠️  GPU detection via GPUtil failed: {e}")

        # Fallback: Try nvidia-smi
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                output = result.stdout.strip()
                if output:
                    parts = output.split(',')
                    return {
                        "gpu_memory": parts[1].strip() if len(parts) > 1 else "Unknown",
                        "gpu_type": parts[0].strip(),
                        "gpu_driver": "nvidia"
                    }
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as e:
            print(f"⚠️  nvidia-smi not available: {e}")

        # Fallback: Try ROCm (AMD)
        try:
            result = subprocess.run(
                ['rocm-smi', '--showmeminfo', 'vram'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return {
                    "gpu_memory": "Unknown (AMD)",
                    "gpu_type": "AMD GPU",
                    "gpu_driver": "rocm"
                }
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            pass

        return None

    def detect_capabilities(self) -> Dict[str, Any]:
        """Detect hardware capabilities of this machine"""

        print("🔍 Detecting hardware capabilities...")

        # GPU detection
        gpu_caps = self.detect_gpu_capabilities()

        # CPU and RAM detection
        cpu_cores = psutil.cpu_count(logical=True)
        ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        disk_gb = psutil.disk_usage('/').total / (1024 ** 3)

        capabilities = {
            "cpu_cores": cpu_cores,
            "ram": f"{ram_gb:.1f}GB",
            "storage": f"{disk_gb:.1f}GB"
        }

        # Add GPU info if available
        if gpu_caps:
            capabilities.update(gpu_caps)
            print(f"✅ Detected GPU: {gpu_caps.get('gpu_type')} ({gpu_caps.get('gpu_memory')})")
        else:
            print("ℹ️  No GPU detected")

        print(f"✅ CPU Cores: {cpu_cores}")
        print(f"✅ RAM: {ram_gb:.1f}GB")
        print(f"✅ Storage: {disk_gb:.1f}GB")

        return capabilities

    def register_with_coordinator(self) -> Dict[str, Any]:
        """Register this worker with the coordinator"""

        print(f"\n📡 Registering with coordinator: {self.coordinator_url}")

        capabilities = self.detect_capabilities()

        try:
            response = requests.post(
                f"{self.coordinator_url}/api/worker/register",
                json={"capabilities": capabilities},
                timeout=30
            )
            response.raise_for_status()
            assignment = response.json()

            self.worker_id = assignment["worker_id"]
            self.assigned_containers = assignment["assigned_containers"]

            print(f"\n✅ Registered successfully!")
            print(f"   Worker ID: {self.worker_id}")
            print(f"   Tier: {assignment['tier']}")
            print(f"   Assigned containers: {len(self.assigned_containers)}")

            for container in self.assigned_containers:
                print(f"     - {container['name']} (port {container['port']})")

            return assignment

        except requests.RequestException as e:
            print(f"❌ Registration failed: {e}")
            sys.exit(1)

    def setup_docker(self):
        """Initialize Docker client"""
        try:
            self.docker_client = docker.from_env()
            print("✅ Docker client initialized")
        except docker.errors.DockerException as e:
            print(f"❌ Docker initialization failed: {e}")
            print("   Make sure Docker is installed and running")
            sys.exit(1)

    def pull_and_start_containers(self):
        """Pull container images and start them"""

        if not self.assigned_containers:
            print("⚠️  No containers assigned")
            return

        print(f"\n🐳 Starting {len(self.assigned_containers)} container(s)...")

        for spec in self.assigned_containers:
            print(f"\n📥 Pulling image: {spec['image']}")

            try:
                # Pull image
                self.docker_client.images.pull(spec['image'])
                print(f"✅ Image pulled: {spec['image']}")

                # Determine if GPU is needed
                device_requests = []
                if 'vllm' in spec['name'] or 'vision' in spec['name']:
                    # GPU container
                    device_requests = [
                        docker.types.DeviceRequest(count=-1, capabilities=[['gpu']])
                    ]

                # Start container
                container = self.docker_client.containers.run(
                    spec['image'],
                    name=spec['name'],
                    environment=spec['env'],
                    ports={f"{spec['port']}/tcp": spec['port']},
                    device_requests=device_requests,
                    detach=True,
                    restart_policy={"Name": "unless-stopped"}
                )

                self.containers.append(container)
                print(f"✅ Container started: {spec['name']}")

            except docker.errors.ImageNotFound:
                print(f"❌ Image not found: {spec['image']}")
            except docker.errors.APIError as e:
                print(f"❌ Failed to start container {spec['name']}: {e}")

    def send_heartbeat(self):
        """Send heartbeat to coordinator"""

        if not self.worker_id:
            return

        # Get current system load
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

            # Print heartbeat status every 5 minutes
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

    def stop_containers(self):
        """Stop and remove containers"""

        if not self.containers:
            return

        print(f"\n🛑 Stopping {len(self.containers)} container(s)...")

        for container in self.containers:
            try:
                print(f"   Stopping {container.name}...")
                container.stop(timeout=10)
                container.remove()
                print(f"   ✅ Stopped {container.name}")
            except docker.errors.APIError as e:
                print(f"   ⚠️  Failed to stop {container.name}: {e}")

    def run(self):
        """Main worker loop"""

        print("=" * 60)
        print("RMA Worker Agent")
        print("=" * 60)

        # Initialize Docker
        self.setup_docker()

        # Register with coordinator
        assignment = self.register_with_coordinator()

        # Start containers
        self.pull_and_start_containers()

        print("\n✅ Worker is now active and running!")
        print("   Press Ctrl+C to stop gracefully\n")

        # Main loop: Send heartbeats
        heartbeat_interval = assignment.get("heartbeat_interval", 30)
        last_heartbeat = 0

        while self.running:
            current_time = time.time()

            # Send heartbeat
            if current_time - last_heartbeat >= heartbeat_interval:
                self.send_heartbeat()
                last_heartbeat = current_time

            # Sleep briefly
            time.sleep(5)

        # Shutdown
        print("\n🛑 Shutting down worker...")
        self.stop_containers()
        self.unregister()
        print("✅ Worker shutdown complete")


def main():
    """Main entry point"""

    parser = argparse.ArgumentParser(description="RMA Worker Agent")
    parser.add_argument(
        "--coordinator",
        type=str,
        default=os.getenv("COORDINATOR_URL", "http://localhost:8080"),
        help="Coordinator URL (default: http://localhost:8080)"
    )
    parser.add_argument(
        "--test-capabilities",
        action="store_true",
        help="Test capability detection and exit"
    )

    args = parser.parse_args()

    # Test mode: Just show capabilities
    if args.test_capabilities:
        agent = WorkerAgent(args.coordinator)
        capabilities = agent.detect_capabilities()
        print("\n📊 Detected Capabilities:")
        print(json.dumps(capabilities, indent=2))
        return

    # Normal mode: Run worker
    agent = WorkerAgent(args.coordinator)
    agent.run()


if __name__ == "__main__":
    main()
