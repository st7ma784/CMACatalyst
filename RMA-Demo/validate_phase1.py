"""
Phase 1 Setup and Validation Script for NER Graph Builder Service
Checks all dependencies, creates test data, validates extraction pipeline
"""

import requests
import json
import time
import sys
from typing import Dict, List, Optional
import subprocess

class Phase1Validator:
    """Validate Phase 1 NER Graph Builder setup."""
    
    def __init__(self):
        self.neo4j_url = "http://localhost:7474"
        self.neo4j_bolt = "bolt://localhost:7687"
        self.ner_service_url = "http://localhost:8108"
        self.vllm_url = "http://localhost:8000"
        self.ollama_url = "http://localhost:11434"
        
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def check(self, name: str, condition: bool, details: str = "") -> bool:
        """Record a check result."""
        status = "✅ PASS" if condition else "❌ FAIL"
        self.results.append(f"{status}: {name}" + (f" ({details})" if details else ""))
        
        if condition:
            self.passed += 1
        else:
            self.failed += 1
        
        return condition
    
    def test_service_health(self) -> bool:
        """Test all services are running."""
        print("\n=== Service Health Checks ===")
        
        try:
            response = requests.get(f"{self.ner_service_url}/health", timeout=5)
            health = response.json()
            self.check(
                "NER Service Health",
                response.status_code == 200,
                f"vLLM available: {health.get('vllm_available')}"
            )
        except Exception as e:
            self.check("NER Service Health", False, str(e))
            return False
        
        try:
            response = requests.get(f"{self.vllm_url}/health", timeout=5)
            self.check("vLLM Service", response.status_code == 200)
        except Exception as e:
            self.check("vLLM Service", False, str(e))
        
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            models = response.json().get("models", [])
            self.check("Ollama Service", response.status_code == 200, f"{len(models)} models")
        except Exception as e:
            self.check("Ollama Service", False, str(e))
        
        return self.passed > 0
    
    def test_neo4j_connection(self) -> bool:
        """Test Neo4j connectivity."""
        print("\n=== Neo4j Connection ===")
        
        try:
            # Try to connect via Neo4j Browser API
            response = requests.get(f"{self.neo4j_url}/health", timeout=5)
            self.check("Neo4j Browser", response.status_code == 200)
            
            # Test Bolt protocol connection via NER service
            response = requests.get(f"{self.ner_service_url}/health", timeout=5)
            health = response.json()
            self.check("Neo4j Bolt Connection", health.get("neo4j_connected", False))
            
            return True
        except Exception as e:
            self.check("Neo4j Connection", False, str(e))
            return False
    
    def test_entity_extraction(self) -> Optional[Dict]:
        """Test entity extraction with sample document."""
        print("\n=== Entity Extraction Test ===")
        
        sample_doc = """
# Mortgage Payment Holiday Policy

When a client has defaulted on their mortgage for more than 3 months, 
they may be eligible for a Payment Holiday. This policy was effective from 2025-01-01.

Requirements:
- Debt amount exceeds $100,000
- Client age is over 60 years old
- Client is currently unemployed

Benefits:
- 3-month payment suspension
- Interest waived during holiday
- Maintain credit rating

This new policy supersedes the Standard Repayment Policy which requires 
full monthly payments. The payment holiday extends for exactly 90 days.
        """
        
        try:
            response = requests.post(
                f"{self.ner_service_url}/extract",
                json={
                    "markdown": sample_doc,
                    "source_document": "test_manual_phase1",
                    "graph_type": "MANUAL"
                },
                timeout=120
            )
            
            if response.status_code != 200:
                self.check("Entity Extraction Request", False, f"Status {response.status_code}")
                return None
            
            result = response.json()
            self.check(
                "Entity Extraction Success",
                result.get("status") == "success",
                f"Entities: {result.get('entity_count')}, Relationships: {result.get('relationship_count')}"
            )
            
            self.check("Entity Count", result.get("entity_count", 0) > 5, f"{result.get('entity_count')} entities")
            self.check("Relationship Count", result.get("relationship_count", 0) > 3, f"{result.get('relationship_count')} relationships")
            self.check("Average Confidence", result.get("avg_confidence", 0) > 0.7, f"{result.get('avg_confidence'):.2f}")
            
            return result
            
        except requests.exceptions.Timeout:
            self.check("Entity Extraction", False, "Timeout - vLLM may be slow")
            return None
        except Exception as e:
            self.check("Entity Extraction", False, str(e))
            return None
    
    def test_graph_query(self, graph_id: str) -> bool:
        """Test graph query operations."""
        print("\n=== Graph Query Test ===")
        
        try:
            response = requests.get(
                f"{self.ner_service_url}/graph/{graph_id}",
                timeout=10
            )
            
            if response.status_code != 200:
                self.check("Graph Query", False, f"Status {response.status_code}")
                return False
            
            graph = response.json()
            self.check(
                "Graph Retrieval",
                graph.get("node_count", 0) > 0,
                f"Nodes: {graph.get('node_count')}, Edges: {graph.get('edge_count')}"
            )
            
            return True
            
        except Exception as e:
            self.check("Graph Query", False, str(e))
            return False
    
    def test_graph_search(self, graph_id: str) -> bool:
        """Test graph search functionality."""
        print("\n=== Graph Search Test ===")
        
        try:
            response = requests.get(
                f"{self.ner_service_url}/graph/{graph_id}/search",
                params={"query": "payment", "limit": 10},
                timeout=10
            )
            
            if response.status_code != 200:
                self.check("Graph Search", False, f"Status {response.status_code}")
                return False
            
            result = response.json()
            has_results = result.get("result_count", 0) > 0
            self.check(
                "Graph Search",
                has_results,
                f"Found {result.get('result_count')} results"
            )
            
            return has_results
            
        except Exception as e:
            self.check("Graph Search", False, str(e))
            return False
    
    def test_api_endpoints(self) -> bool:
        """Test all API endpoints are accessible."""
        print("\n=== API Endpoints Check ===")
        
        endpoints = [
            ("GET", "/health"),
            ("GET", "/stats"),
        ]
        
        success = True
        for method, endpoint in endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{self.ner_service_url}{endpoint}", timeout=5)
                else:
                    response = requests.post(f"{self.ner_service_url}{endpoint}", timeout=5)
                
                self.check(f"Endpoint {method} {endpoint}", response.status_code in [200, 400, 422])
            except Exception as e:
                self.check(f"Endpoint {method} {endpoint}", False, str(e))
                success = False
        
        return success
    
    def run_all_tests(self) -> int:
        """Run all validation tests."""
        print("=" * 60)
        print("Phase 1 NER Graph Builder - Validation Suite")
        print("=" * 60)
        
        # Service health
        if not self.test_service_health():
            print("\n❌ Services not running. Start with:")
            print("   docker-compose -f docker-compose.vllm.yml up -d neo4j ner-graph-service")
            return 1
        
        # Neo4j connection
        time.sleep(2)
        if not self.test_neo4j_connection():
            print("\n⚠️  Neo4j connection issues")
        
        # API endpoints
        self.test_api_endpoints()
        
        # Entity extraction (main test)
        extraction_result = self.test_entity_extraction()
        if extraction_result:
            graph_id = extraction_result.get("graph_id")
            
            # Graph queries
            time.sleep(1)
            self.test_graph_query(graph_id)
            self.test_graph_search(graph_id)
        
        # Print summary
        print("\n" + "=" * 60)
        print("VALIDATION SUMMARY")
        print("=" * 60)
        for result in self.results:
            print(result)
        
        total = self.passed + self.failed
        percentage = (self.passed / total * 100) if total > 0 else 0
        
        print(f"\nTotal: {self.passed}/{total} passed ({percentage:.1f}%)")
        
        if self.failed == 0:
            print("\n✅ Phase 1 Validation: ALL TESTS PASSED!")
            return 0
        else:
            print(f"\n⚠️  Phase 1 Validation: {self.failed} test(s) failed")
            return 1
    
    def print_instructions(self):
        """Print setup instructions."""
        print("\n" + "=" * 60)
        print("SETUP INSTRUCTIONS")
        print("=" * 60)
        print("""
1. Start Docker Compose services:
   docker-compose -f docker-compose.vllm.yml up -d

2. Wait for services to be healthy (~60 seconds):
   docker logs rma-ner-graph-service
   docker logs rma-neo4j

3. Access Neo4j Browser:
   Open http://localhost:7474
   Username: neo4j
   Password: changeme-in-production

4. Test extraction endpoint:
   curl http://localhost:8108/health

5. Review documentation:
   - RMA-Demo/PHASE1_NER_IMPLEMENTATION.md
   - RMA-Demo/NER_GRAPH_SERVICE_ARCHITECTURE.md
        """)


if __name__ == "__main__":
    validator = Phase1Validator()
    
    if "--help" in sys.argv:
        validator.print_instructions()
        sys.exit(0)
    
    exit_code = validator.run_all_tests()
    sys.exit(exit_code)
