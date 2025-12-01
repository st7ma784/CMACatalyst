#!/usr/bin/env python3
"""
Containerized CPU Worker Agent
Lightweight version for running in containers
"""

import os
import sys
import time
import json
import signal
from typing import Dict, Any, Optional
from datetime import datetime

try:
    import requests
    import psutil
except ImportError:
    print("❌ Missing dependencies")
    sys.exit(1)


class ContainerWorkerAgent:
    """Containerized worker agent for CPU workloads"""

    def __init__(self, coordinator_url: str):
        self.coordinator_url = coordinator_url.rstrip('/')
        self.worker_id: Optional[str] = None
        self.running = True
        self.tier = None

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\n🛑 Received signal {signum}. Shutting down...")
        self.running = False

    def detect_capabilities(self) -> Dict[str, Any]:
        """Detect container capabilities"""
        print("🔍 Detecting container capabilities...")

        cpu_cores = psutil.cpu_count(logical=True)
        ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        disk_gb = psutil.disk_usage('/').total / (1024 ** 3)

        capabilities = {
            "cpu_cores": cpu_cores,
            "ram": f"{ram_gb:.1f}GB",
            "storage": f"{disk_gb:.1f}GB",
            "containerized": True,
            "worker_type": "cpu"
        }

        print(f"✅ CPU Cores: {cpu_cores}")
        print(f"✅ RAM: {ram_gb:.1f}GB")

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
            self.tier = assignment["tier"]

            print(f"\n✅ Registered successfully!")
            print(f"   Worker ID: {self.worker_id}")
            print(f"   Tier: {self.tier}")

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
    
    print(f"Starting CPU worker for coordinator: {coordinator_url}")
    
    agent = ContainerWorkerAgent(coordinator_url)
    agent.run()


if __name__ == "__main__":
    main()
