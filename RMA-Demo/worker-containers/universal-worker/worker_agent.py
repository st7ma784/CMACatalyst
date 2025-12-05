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
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UniversalWorkerAgent:
    """Agent that auto-detects capabilities and runs assigned services"""
    
    def __init__(self):
        self.coordinator_url = os.getenv("COORDINATOR_URL", "https://api.rmatool.org.uk")
        self.worker_id = os.getenv("WORKER_ID", f"worker-{socket.gethostname()}-{int(time.time())}")
        self.worker_type = os.getenv("WORKER_TYPE", "auto")  # auto/gpu/cpu/storage
        self.use_tunnel = os.getenv("USE_TUNNEL", "true").lower() == "true"
        
        self.tunnel_process: Optional[subprocess.Popen] = None
        self.tunnel_url: Optional[str] = None
        self.service_processes: Dict[str, subprocess.Popen] = {}
        self.assigned_services: List[str] = []
        
        # Auto-detect hardware capabilities
        self.capabilities = self.detect_capabilities()
        
        logger.info(f"🚀 Universal Worker Agent initialized")
        logger.info(f"Worker ID: {self.worker_id}")
        logger.info(f"Worker Type: {self.worker_type}")
        logger.info(f"Capabilities: {json.dumps(self.capabilities, indent=2)}")
        logger.info(f"Coordinator: {self.coordinator_url}")
    
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
        
        logger.info("🌐 Creating Cloudflare Tunnel...")
        
        try:
            # Start cloudflared tunnel
            process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", "http://localhost:8000", "--no-autoupdate"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            self.tunnel_process = process
            
            # Wait for tunnel URL in output
            for _ in range(30):  # 30 second timeout
                line = process.stderr.readline()
                if "https://" in line and ".trycloudflare.com" in line:
                    tunnel_url = line.split("https://")[1].split()[0]
                    self.tunnel_url = f"https://{tunnel_url}"
                    logger.info(f"✅ Tunnel created: {self.tunnel_url}")
                    return self.tunnel_url
                time.sleep(1)
            
            logger.error("❌ Failed to get tunnel URL")
            return None
            
        except Exception as e:
            logger.error(f"❌ Tunnel creation failed: {e}")
            return None
    
    def register_with_coordinator(self) -> Dict[str, Any]:
        """Register worker and receive service assignments"""
        logger.info("📝 Registering with coordinator...")
        
        registration_data = {
            "worker_id": self.worker_id,
            "tunnel_url": self.tunnel_url or f"http://{socket.gethostname()}:8000",
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
            self.assigned_services = result.get("assigned_services", [])
            
            logger.info(f"✅ Registration successful!")
            logger.info(f"   Assigned Services: {', '.join(self.assigned_services)}")
            
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
            
            heartbeat_data = {
                "worker_id": self.worker_id,
                "status": "healthy" if all(s == "running" for s in services_status.values()) else "degraded",
                "services_status": services_status,
                "current_load": 0.0,  # TODO: Calculate actual load
            }
            
            response = requests.post(
                f"{self.coordinator_url}/api/worker/heartbeat",
                json=heartbeat_data,
                timeout=5
            )
            response.raise_for_status()
            
        except requests.RequestException as e:
            logger.error(f"❌ Heartbeat failed: {e}")
    
    def run(self):
        """Main worker loop"""
        try:
            # Step 1: Create tunnel
            if self.use_tunnel:
                tunnel_url = self.create_tunnel()
                if not tunnel_url:
                    logger.error("❌ Failed to create tunnel, exiting")
                    return
            
            # Step 2: Register and get service assignments
            registration_result = self.register_with_coordinator()
            service_configs = registration_result.get("service_configs", [])
            
            # Step 3: Launch assigned services
            for service_config in service_configs:
                service_name = service_config["name"]
                self.launch_service(service_name, service_config)
            
            # Step 4: Heartbeat loop
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
