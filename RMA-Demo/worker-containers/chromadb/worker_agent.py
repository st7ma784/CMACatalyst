#!/usr/bin/env python3
"""
ChromaDB Storage Worker Agent
Registers with coordinator as Tier 3 (Storage) worker
Provides persistent vector database for RAG system
"""

import os
import sys
import time
import socket
import requests
import subprocess
import logging
from datetime import datetime
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ChromaDBWorkerAgent:
    """Agent for ChromaDB storage worker registration and health monitoring"""
    
    def __init__(self):
        self.coordinator_url = os.getenv("COORDINATOR_URL", "https://api.rmatool.org.uk")
        self.worker_id = os.getenv("WORKER_ID", f"chromadb-worker-{socket.gethostname()}-{int(time.time())}")
        self.chromadb_port = int(os.getenv("CHROMADB_PORT", "8000"))
        self.use_tunnel = os.getenv("USE_TUNNEL", "true").lower() == "true"
        self.tunnel_process: Optional[subprocess.Popen] = None
        self.tunnel_url: Optional[str] = None
        self.heartbeat_interval = 30  # seconds
        
        logger.info(f"ChromaDB Worker Agent initialized")
        logger.info(f"Worker ID: {self.worker_id}")
        logger.info(f"Coordinator: {self.coordinator_url}")
        logger.info(f"ChromaDB Port: {self.chromadb_port}")
        logger.info(f"Tunnel Mode: {self.use_tunnel}")
    
    def start_tunnel(self) -> bool:
        """Start Cloudflare Tunnel for ChromaDB access"""
        if not self.use_tunnel:
            logger.info("Tunnel mode disabled")
            return False
            
        try:
            logger.info(f"🚇 Starting Cloudflare Tunnel for port {self.chromadb_port}...")
            
            self.tunnel_process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://localhost:{self.chromadb_port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            # Wait for tunnel URL (appears in output)
            for line in self.tunnel_process.stdout:
                logger.info(f"Tunnel output: {line.strip()}")
                if "trycloudflare.com" in line or "https://" in line:
                    # Extract URL from output
                    for word in line.split():
                        if "https://" in word and "trycloudflare.com" in word:
                            self.tunnel_url = word.strip()
                            logger.info(f"✅ Tunnel active: {self.tunnel_url}")
                            logger.info(f"🔒 Tunnel mode enabled for ChromaDB on port {self.chromadb_port}")
                            return True
                if "error" in line.lower():
                    logger.error(f"Tunnel error: {line}")
                    return False
            
            logger.warning("Tunnel started but no URL found in output")
            return False
            
        except FileNotFoundError:
            logger.error("cloudflared not found. Install it to use tunnel mode.")
            return False
        except Exception as e:
            logger.error(f"Failed to start tunnel: {e}")
            return False
    
    def wait_for_chromadb(self, timeout=60):
        """Wait for ChromaDB to be ready"""
        logger.info("Waiting for ChromaDB to start...")
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(
                    f"http://localhost:{self.chromadb_port}/api/v1/heartbeat",
                    timeout=2
                )
                if response.status_code == 200:
                    logger.info("✅ ChromaDB is ready")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(2)
        
        logger.error("❌ ChromaDB failed to start within timeout")
        return False
    
    def register_with_coordinator(self) -> bool:
        """Register this ChromaDB worker with the coordinator"""
        try:
            # Determine service URL
            if self.tunnel_url:
                service_url = self.tunnel_url
            else:
                # Use local network IP
                hostname = socket.gethostname()
                local_ip = socket.gethostbyname(hostname)
                service_url = f"http://{local_ip}:{self.chromadb_port}"
            
            registration_data = {
                "worker_id": self.worker_id,
                "tier": 3,  # Tier 3: Storage workers
                "capabilities": {
                    "cpu_cores": os.cpu_count() or 2,
                    "ram_gb": 4,
                    "has_gpu": False,
                    "has_storage": True,
                    "storage_type": "vector_database",
                    "services": ["chromadb"]
                },
                "containers": [
                    {
                        "name": "chromadb",
                        "service_url": service_url,
                        "port": self.chromadb_port,
                        "health_endpoint": "/api/v1/heartbeat",
                        "version": "0.4.24"
                    }
                ]
            }
            
            logger.info(f"📡 Registering with coordinator at {self.coordinator_url}/api/workers/register")
            logger.info(f"Service URL: {service_url}")
            
            response = requests.post(
                f"{self.coordinator_url}/api/workers/register",
                json=registration_data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"✅ Registration successful!")
                logger.info(f"Worker ID: {self.worker_id}")
                logger.info(f"Tier: 3 (Storage)")
                logger.info(f"Assigned containers: chromadb")
                return True
            else:
                logger.error(f"❌ Registration failed: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Registration error: {e}")
            return False
    
    def send_heartbeat(self) -> bool:
        """Send heartbeat to coordinator"""
        try:
            # Check ChromaDB health
            chromadb_healthy = False
            try:
                health_response = requests.get(
                    f"http://localhost:{self.chromadb_port}/api/v1/heartbeat",
                    timeout=2
                )
                chromadb_healthy = health_response.status_code == 200
            except:
                pass
            
            heartbeat_data = {
                "worker_id": self.worker_id,
                "status": "online" if chromadb_healthy else "degraded",
                "current_load": 0.0,  # Storage workers don't track load
                "services_status": {
                    "chromadb": "healthy" if chromadb_healthy else "unhealthy"
                }
            }
            
            response = requests.post(
                f"{self.coordinator_url}/api/workers/heartbeat",
                json=heartbeat_data,
                timeout=5
            )
            
            if response.status_code == 200:
                logger.debug(f"💓 Heartbeat sent successfully")
                return True
            else:
                logger.warning(f"Heartbeat failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
            return False
    
    def run(self):
        """Main worker agent loop"""
        logger.info("🚀 Starting ChromaDB Worker Agent...")
        
        # Start tunnel if enabled
        if self.use_tunnel:
            tunnel_started = self.start_tunnel()
            if not tunnel_started:
                logger.warning("Tunnel failed to start, will use local network")
                self.use_tunnel = False
        
        # Wait for ChromaDB to be ready
        if not self.wait_for_chromadb():
            logger.error("ChromaDB not ready, exiting")
            sys.exit(1)
        
        # Register with coordinator
        max_retries = 5
        retry_count = 0
        while retry_count < max_retries:
            if self.register_with_coordinator():
                break
            retry_count += 1
            logger.warning(f"Registration attempt {retry_count}/{max_retries} failed, retrying in 10s...")
            time.sleep(10)
        
        if retry_count >= max_retries:
            logger.error("Failed to register after maximum retries")
            sys.exit(1)
        
        # Heartbeat loop
        logger.info(f"Starting heartbeat loop (interval: {self.heartbeat_interval}s)")
        failed_heartbeats = 0
        max_failed_heartbeats = 5
        
        while True:
            try:
                time.sleep(self.heartbeat_interval)
                
                if self.send_heartbeat():
                    failed_heartbeats = 0
                else:
                    failed_heartbeats += 1
                    
                if failed_heartbeats >= max_failed_heartbeats:
                    logger.error(f"Failed {max_failed_heartbeats} consecutive heartbeats, attempting re-registration...")
                    if self.register_with_coordinator():
                        failed_heartbeats = 0
                    else:
                        logger.error("Re-registration failed")
                        
            except KeyboardInterrupt:
                logger.info("Shutting down worker agent...")
                if self.tunnel_process:
                    self.tunnel_process.terminate()
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")
                time.sleep(5)

if __name__ == "__main__":
    agent = ChromaDBWorkerAgent()
    agent.run()
