#!/usr/bin/env python3
"""
RAG System Orchestrator
Monitors coordinator for required workers and triggers manual ingestion when ready
Required workers: GPU (for LLM), CPU (for processing), ChromaDB (for storage)
"""

import os
import time
import requests
import logging
from typing import Dict, List, Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RAGSystemOrchestrator:
    """Orchestrates RAG system initialization when required workers are available"""
    
    def __init__(self):
        self.coordinator_url = os.getenv("COORDINATOR_URL", "https://api.rmatool.org.uk")
        self.manuals_directory = os.getenv("MANUALS_PATH", "/manuals")
        self.check_interval = int(os.getenv("CHECK_INTERVAL", "60"))  # seconds
        self.ingestion_triggered = False
        
        logger.info("RAG System Orchestrator initialized")
        logger.info(f"Coordinator: {self.coordinator_url}")
        logger.info(f"Manuals directory: {self.manuals_directory}")
        logger.info(f"Check interval: {self.check_interval}s")
    
    def get_registered_workers(self) -> Optional[Dict]:
        """Get list of registered workers from coordinator"""
        try:
            response = requests.get(
                f"{self.coordinator_url}/api/admin/workers",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to get workers: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting workers: {e}")
            return None
    
    def check_system_readiness(self, workers_data: Dict) -> Dict[str, bool]:
        """Check if system has all required components for RAG"""
        readiness = {
            "has_gpu_worker": False,
            "has_cpu_worker": False,
            "has_chromadb": False,
            "has_rag_service": False
        }
        
        if not workers_data or "workers" not in workers_data:
            return readiness
        
        workers = workers_data["workers"]
        
        for worker in workers:
            tier = worker.get("tier")
            capabilities = worker.get("capabilities", {})
            containers = worker.get("containers", [])
            status = worker.get("status", "offline")
            
            if status != "online":
                continue
            
            # Check for GPU worker (Tier 1)
            if tier == 1 and capabilities.get("has_gpu", False):
                readiness["has_gpu_worker"] = True
                logger.debug(f"Found GPU worker: {worker.get('worker_id')}")
            
            # Check for CPU worker (Tier 2)
            if tier == 2:
                readiness["has_cpu_worker"] = True
                logger.debug(f"Found CPU worker: {worker.get('worker_id')}")
            
            # Check for specific services in containers
            for container in containers:
                service_name = container.get("name", "")
                
                if service_name == "chromadb":
                    readiness["has_chromadb"] = True
                    logger.debug(f"Found ChromaDB service")
                
                if service_name in ["rag-service", "gpu-worker"]:
                    readiness["has_rag_service"] = True
                    logger.debug(f"Found RAG service: {service_name}")
        
        return readiness
    
    def trigger_manual_ingestion(self) -> bool:
        """Trigger ingestion of training manuals"""
        try:
            logger.info("🚀 Triggering training manual ingestion...")
            
            # Find RAG service endpoint from coordinator
            workers_data = self.get_registered_workers()
            rag_service_url = None
            
            if workers_data and "workers" in workers_data:
                for worker in workers_data["workers"]:
                    for container in worker.get("containers", []):
                        if container.get("name") in ["rag-service", "gpu-worker"]:
                            rag_service_url = container.get("service_url")
                            break
                    if rag_service_url:
                        break
            
            if not rag_service_url:
                logger.error("No RAG service found in registered workers")
                return False
            
            # Call the ingestion endpoint
            logger.info(f"Calling RAG service at: {rag_service_url}")
            
            # Try /ingest-all-manuals endpoint
            response = requests.post(
                f"{rag_service_url}/ingest-all-manuals",
                timeout=300  # 5 minutes for large ingestion
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info("✅ Manual ingestion completed!")
                logger.info(f"Total files: {result.get('total_files', 0)}")
                logger.info(f"Successful: {result.get('successful', 0)}")
                logger.info(f"Failed: {result.get('failed', 0)}")
                return True
            else:
                logger.error(f"Ingestion failed: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error triggering ingestion: {e}")
            return False
    
    def run(self):
        """Main orchestrator loop"""
        logger.info("🎯 Starting RAG System Orchestrator...")
        logger.info("Waiting for required workers: GPU, CPU, ChromaDB")
        
        while True:
            try:
                # Get current workers
                workers_data = self.get_registered_workers()
                
                if workers_data:
                    readiness = self.check_system_readiness(workers_data)
                    
                    # Log current status
                    logger.info("System Status:")
                    logger.info(f"  GPU Worker: {'✅' if readiness['has_gpu_worker'] else '❌'}")
                    logger.info(f"  CPU Worker: {'✅' if readiness['has_cpu_worker'] else '❌'}")
                    logger.info(f"  ChromaDB: {'✅' if readiness['has_chromadb'] else '❌'}")
                    logger.info(f"  RAG Service: {'✅' if readiness['has_rag_service'] else '❌'}")
                    
                    # Check if system is ready
                    if all([
                        readiness['has_gpu_worker'],
                        readiness['has_chromadb'],
                        readiness['has_rag_service']
                    ]):
                        if not self.ingestion_triggered:
                            logger.info("🎉 All required workers are online!")
                            logger.info("Starting manual ingestion process...")
                            
                            if self.trigger_manual_ingestion():
                                self.ingestion_triggered = True
                                logger.info("✅ System initialization complete!")
                                logger.info("RAG system is ready for queries")
                                # Continue monitoring but don't trigger again
                            else:
                                logger.warning("Ingestion failed, will retry next cycle")
                        else:
                            logger.debug("System already initialized, monitoring...")
                    else:
                        missing = []
                        if not readiness['has_gpu_worker']:
                            missing.append("GPU worker")
                        if not readiness['has_chromadb']:
                            missing.append("ChromaDB")
                        if not readiness['has_rag_service']:
                            missing.append("RAG service")
                        
                        logger.info(f"⏳ Waiting for: {', '.join(missing)}")
                        self.ingestion_triggered = False  # Reset if workers go offline
                
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                logger.info("Shutting down orchestrator...")
                break
            except Exception as e:
                logger.error(f"Error in orchestrator loop: {e}")
                time.sleep(self.check_interval)

if __name__ == "__main__":
    orchestrator = RAGSystemOrchestrator()
    orchestrator.run()
