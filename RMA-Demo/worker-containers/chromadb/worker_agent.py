#!/usr/bin/env python3
"""
Storage Worker Agent
Registers with coordinator as Tier 3 (Storage/Infrastructure) worker
Provides persistent storage services: ChromaDB, Redis, PostgreSQL, MinIO, Neo4j
Can be configured to run multiple storage services simultaneously
"""

import os
import sys
import time
import socket
import requests
import subprocess
import logging
from datetime import datetime
from typing import Optional, List, Dict

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class StorageWorkerAgent:
    """Agent for storage worker registration and health monitoring"""
    
    def __init__(self):
        self.coordinator_url = os.getenv("COORDINATOR_URL", "https://api.rmatool.org.uk")
        self.worker_id = os.getenv("WORKER_ID", f"storage-worker-{socket.gethostname()}-{int(time.time())}")
        self.chromadb_port = int(os.getenv("CHROMADB_PORT", "8000"))
        self.use_tunnel = os.getenv("USE_TUNNEL", "true").lower() == "true"
        self.tunnel_process: Optional[subprocess.Popen] = None
        self.tunnel_url: Optional[str] = None
        self.heartbeat_interval = 30  # seconds
        
        # Storage service configuration
        self.enabled_services = self._detect_enabled_services()
        
        logger.info(f"Storage Worker Agent initialized")
        logger.info(f"Worker ID: {self.worker_id}")
        logger.info(f"Coordinator: {self.coordinator_url}")
        logger.info(f"Enabled services: {', '.join(self.enabled_services)}")
        logger.info(f"Tunnel Mode: {self.use_tunnel}")
    
    def _detect_enabled_services(self) -> List[str]:
        """Detect which storage services are enabled in this container"""
        services = []
        
        # Check for ChromaDB
        if os.getenv("ENABLE_CHROMADB", "true").lower() == "true":
            services.append("chromadb")
        
        # Check for Redis (if REDIS_PORT is set)
        if os.getenv("REDIS_PORT"):
            services.append("redis")
        
        # Check for PostgreSQL (if POSTGRES_PORT is set)
        if os.getenv("POSTGRES_PORT"):
            services.append("postgres")
        
        # Check for MinIO (if MINIO_PORT is set)
        if os.getenv("MINIO_PORT"):
            services.append("minio")
        
        # Check for Neo4j (if NEO4J_PORT is set)
        if os.getenv("NEO4J_PORT"):
            services.append("neo4j")
        
        # Default to ChromaDB if nothing specified
        if not services:
            services.append("chromadb")
        
        return services
    
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
        """Register this storage worker with the coordinator"""
        try:
            # Determine service URL
            if self.tunnel_url:
                service_url = self.tunnel_url
            else:
                # Use local network IP
                hostname = socket.gethostname()
                local_ip = socket.gethostbyname(hostname)
                service_url = f"http://{local_ip}:{self.chromadb_port}"
            
            # Build service manifest for all enabled storage services
            containers = []
            
            if "chromadb" in self.enabled_services:
                containers.append({
                    "name": "chromadb",
                    "service_url": service_url,
                    "port": self.chromadb_port,
                    "health_endpoint": "/api/v1/heartbeat",
                    "version": "0.4.24",
                    "capabilities": ["vector_database", "embeddings_storage", "semantic_search"]
                })
            
            if "redis" in self.enabled_services:
                redis_port = int(os.getenv("REDIS_PORT", "6379"))
                containers.append({
                    "name": "redis",
                    "service_url": f"http://{socket.gethostbyname(socket.gethostname())}:{redis_port}",
                    "port": redis_port,
                    "health_endpoint": "/ping",
                    "capabilities": ["cache", "session_storage", "task_queue"]
                })
            
            if "postgres" in self.enabled_services:
                postgres_port = int(os.getenv("POSTGRES_PORT", "5432"))
                containers.append({
                    "name": "postgres",
                    "service_url": f"postgresql://{socket.gethostbyname(socket.gethostname())}:{postgres_port}",
                    "port": postgres_port,
                    "capabilities": ["relational_database", "sql", "transactions"]
                })
            
            if "minio" in self.enabled_services:
                minio_port = int(os.getenv("MINIO_PORT", "9000"))
                containers.append({
                    "name": "minio",
                    "service_url": f"http://{socket.gethostbyname(socket.gethostname())}:{minio_port}",
                    "port": minio_port,
                    "health_endpoint": "/minio/health/live",
                    "capabilities": ["object_storage", "s3_compatible", "file_storage"]
                })
            
            if "neo4j" in self.enabled_services:
                neo4j_port = int(os.getenv("NEO4J_PORT", "7474"))
                containers.append({
                    "name": "neo4j",
                    "service_url": f"http://{socket.gethostbyname(socket.gethostname())}:{neo4j_port}",
                    "port": neo4j_port,
                    "capabilities": ["graph_database", "cypher", "relationships"]
                })
            
            registration_data = {
                "worker_id": self.worker_id,
                "capabilities": {
                    "cpu_cores": os.cpu_count() or 2,
                    "ram_gb": 4,
                    "has_gpu": False,
                    "has_storage": True,
                    "storage_type": "multi_service",
                    "storage_services": self.enabled_services,
                    "worker_type": "storage"
                },
                "containers": containers,
                "tunnel_url": self.tunnel_url
            }
            
            logger.info(f"📡 Registering with coordinator at {self.coordinator_url}/api/worker/register")
            logger.info(f"Service URL: {service_url}")
            logger.info(f"Providing services: {', '.join(self.enabled_services)}")
            
            response = requests.post(
                f"{self.coordinator_url}/api/worker/register",
                json=registration_data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"✅ Registration successful!")
                logger.info(f"Worker ID: {self.worker_id}")
                logger.info(f"Tier: 3 (Storage/Infrastructure)")
                logger.info(f"Services registered: {', '.join(self.enabled_services)}")
                return True
            else:
                logger.error(f"❌ Registration failed: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Registration error: {e}")
            return False
    
    def send_heartbeat(self) -> bool:
        """Send heartbeat to coordinator with storage service health"""
        try:
            # Check health of all enabled services
            services_status = {}
            
            if "chromadb" in self.enabled_services:
                try:
                    health_response = requests.get(
                        f"http://localhost:{self.chromadb_port}/api/v1/heartbeat",
                        timeout=2
                    )
                    services_status["chromadb"] = "healthy" if health_response.status_code == 200 else "unhealthy"
                except:
                    services_status["chromadb"] = "unhealthy"
            
            # Add health checks for other services as needed
            # Redis, Postgres, MinIO, Neo4j would have their own health checks
            
            # Overall status is healthy if at least one service is healthy
            any_healthy = any(status == "healthy" for status in services_status.values())
            
            heartbeat_data = {
                "worker_id": self.worker_id,
                "status": "online" if any_healthy else "degraded",
                "current_load": 0.0,  # Storage workers don't track CPU load
                "services_status": services_status
            }
            
            response = requests.post(
                f"{self.coordinator_url}/api/worker/heartbeat",
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
        logger.info("🚀 Starting Storage Worker Agent...")
        logger.info(f"Services: {', '.join(self.enabled_services)}")
        
        # Start tunnel if enabled
        if self.use_tunnel:
            tunnel_started = self.start_tunnel()
            if not tunnel_started:
                logger.warning("Tunnel failed to start, will use local network")
                self.use_tunnel = False
        
        # Wait for ChromaDB to be ready (if enabled)
        if "chromadb" in self.enabled_services:
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
                logger.info("Shutting down storage worker agent...")
                if self.tunnel_process:
                    self.tunnel_process.terminate()
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")
                time.sleep(5)

if __name__ == "__main__":
    agent = StorageWorkerAgent()
    agent.run()
