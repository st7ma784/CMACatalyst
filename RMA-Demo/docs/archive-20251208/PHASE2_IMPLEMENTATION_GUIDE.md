#!/usr/bin/env python3
"""
PHASE 2 IMPLEMENTATION GUIDE
RAG Service Graph Integration

Complete integration of NER Graph Service with RAG Service for semantic knowledge extraction.
This guide covers the new components, configuration, testing, and deployment.

===================================================================================
OVERVIEW
===================================================================================

Phase 2 adds graph-based semantic reasoning to the RAG service by:
1. Automatically extracting knowledge graphs from ingested manuals
2. Enabling dual-graph comparison (manual rules vs client situation)
3. Enhancing LLM reasoning with formal logic from graphs
4. Providing graph search capabilities for entity/relationship lookup

Architecture:
- graph_integrator.py: Integration layer with NER service
- test_graph_integration.py: Comprehensive test suite
- Updated app.py: Calls NER service on document ingestion

===================================================================================
FILES MODIFIED
===================================================================================

1. services/rag-service/graph_integrator.py (NEW - 600+ lines)
   - NERServiceClient: Communication with NER Graph Service
   - DualGraphSearcher: Compare manual vs client graphs
   - GraphAwareReasoner: Enhance reasoning with graph data
   - DocumentGraph, Entity, Relationship: Data structures
   - create_graph_integrator(): Factory function

2. services/rag-service/test_graph_integration.py (NEW - 400+ lines)
   - TestNERServiceClient: Service communication tests
   - TestDualGraphSearcher: Dual-graph logic tests
   - TestGraphAwareReasoner: Reasoning enhancement tests
   - End-to-end integration tests

3. services/rag-service/app.py (MODIFIED)
   - Added graph_integrator imports
   - Updated __init__: Added graph component initialization
   - Updated initialize(): Initialize NER service client
   - Updated ingest_documents(): Call NER service on ingestion
   - Return manual_graph_id in ingest response

===================================================================================
CONFIGURATION
===================================================================================

Environment Variables (all optional with sensible defaults):

# Graph Integration
NER_SERVICE_URL=http://ner-graph-service:8108    # NER service endpoint
USE_GRAPH_REASONING=true                         # Enable/disable graph features

# Neo4j (used by NER service)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=changeme-in-production

# vLLM (used by NER service for entity extraction)
VLLM_URL=http://vllm:8000
VLLM_API_KEY=sk-vllm
VLLM_MODEL=llama3.2

===================================================================================
COMPONENT DETAILS
===================================================================================

### NERServiceClient
Communicates with NER Graph Service API.

Key Methods:
- health_check(): Verify service availability
- extract_and_store_graph(text, doc_id, filename, graph_label): Extract entities/relationships
- search_graph(graph_id, query, entity_types, limit): Search entities
- compare_graphs(graph1_id, graph2_id): Find applicable rules
- get_reasoning_chain(graph_id, start_id, end_id): Generate reasoning

### DualGraphSearcher
Compare two knowledge graphs (manual rules vs client situation).

Key Methods:
- find_applicable_rules(manual_graph_id, client_graph_id): Rules that apply to client
- search_rules_by_keyword(manual_graph_id, keyword, client_graph_id): Find relevant rules

### GraphAwareReasoner
Enhance LLM reasoning with graph data.

Key Methods:
- build_reasoning_context(manual_id, client_id, query): Collect applicable rules
- generate_graph_aware_answer(base_answer, reasoning_context): Enhance answer

### Data Structures
- Entity: Extracted entity with confidence, type, source
- Relationship: Connection between entities with temporal/logical metadata
- DocumentGraph: Complete graph from a document
- ApplicableRule: Rule from manual with applicability info

===================================================================================
INTEGRATION FLOW
===================================================================================

1. RAG Service Startup (initialize())
   ├─ Initialize embeddings
   ├─ Connect to ChromaDB
   ├─ Initialize graph components if USE_GRAPH_REASONING=true
   └─ Check NER service health

2. Document Ingestion (ingest_documents())
   ├─ Create hierarchical chunks (existing)
   ├─ Add to ChromaDB vectorstore (existing)
   ├─ NEW: Extract graph from document
   │  ├─ Call NER service /extract endpoint
   │  ├─ Store graph_id in manual_graph_id
   │  └─ Log entity/relationship counts
   └─ Build decision trees (existing)

3. Query Processing (query() or agentic_query())
   ├─ Retrieve chunks from vectorstore (existing)
   ├─ NEW: (Optional) Search graphs for relevant rules
   ├─ Generate LLM response (existing)
   └─ NEW: (Optional) Enhance with graph insights

4. Eligibility Check (integrated_eligibility_check())
   ├─ Extract client attributes
   ├─ NEW: Create client situation graph
   ├─ NEW: Compare manual vs client graphs
   ├─ Evaluate decision tree (existing)
   └─ Combine results

===================================================================================
API ENDPOINTS (RAG Service)
===================================================================================

NEW: GET /health/graphs
Returns graph integration status:
{
  "graph_reasoning_enabled": true,
  "ner_service_available": true,
  "manual_graph_id": "graph-abc123...",
  "entities_in_manual_graph": 145,
  "relationships_in_manual_graph": 283
}

NEW: POST /graph/search
Search for entities/rules by keyword:
Request: {
  "query": "debt relief order",
  "entity_types": ["RULE", "GATE"],
  "limit": 10
}
Response: {
  "results": [...],
  "total": 5
}

NEW: POST /graph/compare
Compare two graphs to find applicable rules:
Request: {
  "manual_graph_id": "graph-manual-...",
  "client_graph_id": "graph-client-...",
  "query": "debt relief eligibility"
}
Response: {
  "applicable_rules": [...],
  "gaps": [...],
  "confidence": 0.85
}

===================================================================================
ENTITY & RELATIONSHIP TYPES
===================================================================================

Entity Types (15 types):
Domain-specific:
  - DEBT_TYPE: Types of debt (e.g., "credit card debt")
  - OBLIGATION: Financial obligations
  - RULE: Policy/eligibility rules
  - GATE: Eligibility gates/conditions
  - MONEY_THRESHOLD: Monetary thresholds (£15,000 etc)
  - CREDITOR: Creditor information
  - REPAYMENT_TERM: Repayment periods
  - LEGAL_STATUS: Legal classifications
  - CLIENT_ATTRIBUTE: Client characteristic/situation

Standard NER:
  - PERSON, ORGANIZATION, DATE, MONEY, PERCENT, LOCATION, DURATION

Relationship Types (13 types):
Structural:
  - IS_A: Classification (DRO is a debt solution)
  - PART_OF: Composition (repayment is part of DRO)
  - SYNONYMOUS: Equivalence

Logical:
  - TRIGGERS: Initiates (debt < threshold triggers eligibility)
  - REQUIRES: Prerequisite
  - BLOCKS: Prevention
  - FOLLOWS: Sequence

Domain:
  - AFFECTS_REPAYMENT: Changes repayment
  - HAS_GATE: Has eligibility condition
  - CONTRADICTS: Conflicts with
  - EXTENDS: Extends/modifies
  - APPLICABLE_TO: Applies to specific scenario
  - ENABLES, RESTRICTS: Permission/restriction

Temporal Metadata on Relationships:
  - effective_date: When rule starts
  - expiry_date: When rule ends
  - logic_gate: Logical operator (AND, OR, NOT)
  - condition: Textual condition

===================================================================================
USAGE EXAMPLES
===================================================================================

### Example 1: Initialize with Graph Integration
```python
from graph_integrator import create_graph_integrator

# Create all components
components = create_graph_integrator("http://ner-graph-service:8108")
ner_client = components['ner_client']
dual_searcher = components['dual_searcher']
graph_reasoner = components['graph_reasoner']

# Check NER service health
if ner_client.health_check():
    print("✅ NER service available")
```

### Example 2: Extract Graph from Manual
```python
# After ingesting manual
manual_text = "Debt Relief Orders are for debts under £15,000..."
graph = ner_client.extract_and_store_graph(
    document_text=manual_text,
    document_id="manual-dro",
    filename="dro-manual.txt",
    graph_label="manual"
)
print(f"Extracted {len(graph.entities)} entities, {len(graph.relationships)} relationships")
```

### Example 3: Find Applicable Rules
```python
# Given client graph_id and manual graph_id
applicable_rules = dual_searcher.find_applicable_rules(
    manual_graph_id="graph-manual-123",
    client_graph_id="graph-client-456"
)

for rule in applicable_rules:
    print(f"Rule: {rule.rule_entity.text}")
    print(f"  Confidence: {rule.confidence:.2%}")
    print(f"  Explanation: {rule.relevance_explanation}")
```

### Example 4: Search Rules by Keyword
```python
results = dual_searcher.search_rules_by_keyword(
    manual_graph_id="graph-manual-123",
    keyword="income threshold",
    client_graph_id="graph-client-456"  # Optional
)

for result in results:
    print(f"Rule: {result['text']}")
    if result.get('applicable_to_client'):
        print(f"  ✅ Applicable to client")
```

### Example 5: Enhance Answer with Graph Insights
```python
# Build context from graphs
context = graph_reasoner.build_reasoning_context(
    manual_graph_id="graph-manual-123",
    client_graph_id="graph-client-456",
    query="am I eligible for DRO?"
)

# Get base answer from RAG/LLM
base_answer = "Based on the manuals, you may be eligible..."

# Enhance with graph insights
enhanced = graph_reasoner.generate_graph_aware_answer(base_answer, context)
print(enhanced)
```

===================================================================================
TESTING
===================================================================================

### Run All Tests
```bash
cd services/rag-service
pytest test_graph_integration.py -v
```

### Run Specific Test Class
```bash
pytest test_graph_integration.py::TestNERServiceClient -v
pytest test_graph_integration.py::TestDualGraphSearcher -v
pytest test_graph_integration.py::TestGraphAwareReasoner -v
```

### Run Specific Test
```bash
pytest test_graph_integration.py::TestNERServiceClient::test_health_check_success -v
```

### With Coverage
```bash
pytest test_graph_integration.py --cov=graph_integrator --cov-report=html
```

### Test Coverage Target: >85%

Test Suite Includes:
- NER service communication (5 tests)
- Graph extraction (3 tests)
- Graph searching (2 tests)
- Graph comparison (2 tests)
- Dual-graph reasoning (4 tests)
- End-to-end workflows (3 tests)
- Error handling (4 tests)

Total: 23 tests

===================================================================================
DEPLOYMENT CHECKLIST
===================================================================================

Pre-Deployment:
□ All 23 integration tests passing
□ NER Graph Service deployed and healthy
□ Neo4j running with APOC plugins
□ vLLM available for entity extraction
□ ChromaDB accessible

Deployment:
□ Build RAG service: docker build -t rma-rag-service services/rag-service/
□ Start services: docker-compose up -d neo4j ner-graph-service
□ Start RAG service: docker-compose up -d rag-service
□ Wait for health checks to pass (~60 seconds)

Post-Deployment:
□ Verify all health checks: curl http://localhost:8102/health
□ Check graph integration: curl http://localhost:8102/health/graphs
□ Test ingestion with graph extraction
□ Verify manual_graph_id in ingest response
□ Monitor logs for graph extraction

===================================================================================
TROUBLESHOOTING
===================================================================================

### NER Service Not Available
```
Symptom: Graph reasoning disabled at startup
Solution:
1. Check NER service is running: docker ps | grep ner-graph
2. Verify network: docker network ls
3. Check connectivity: docker exec rag-service curl http://ner-graph-service:8108/health
```

### Graph Extraction Slow
```
Symptom: Ingest times increased significantly
Solution:
1. Disable temporarily: USE_GRAPH_REASONING=false
2. Check NER service logs: docker logs rma-ner-graph-service
3. Check vLLM capacity: Look for CUDA memory errors
4. Reduce document size if testing
```

### Graphs Not Being Found in Queries
```
Symptom: Graph search returns empty results
Solution:
1. Verify manual_graph_id was set: Check ingest response
2. Check Neo4j browser: http://localhost:7474
3. Verify entities were extracted: MATCH (n) RETURN count(n)
4. Check search parameters: entity_types might be too restrictive
```

### Memory Issues
```
Symptom: vLLM crashes during extraction
Solution:
1. Reduce VLLM_GPU_MEMORY_UTILIZATION to 0.7 or 0.8
2. Break large documents into smaller chunks
3. Process documents sequentially instead of batch
4. Increase GPU memory allocation
```

===================================================================================
PERFORMANCE TARGETS
===================================================================================

Metric                          Target      Unit
Graph Extraction               2-5         seconds per document
Entity Search                  <200        milliseconds
Relationship Search            <300        milliseconds
Dual-Graph Comparison          1-3         seconds
Answer Enhancement             <100        milliseconds
Memory Usage                    <2          GB
Neo4j Query Latency            <50         milliseconds

Benchmarks run with typical RMA manual (~50 pages):
- Entities extracted: ~200-300
- Relationships: ~300-500
- Storage size: ~50-100 MB per graph

===================================================================================
NEXT STEPS (Phase 3)
===================================================================================

After Phase 2 is deployed:
1. Frontend Graph Visualization
   - Interactive graph rendering
   - Manual/client/comparison views

2. Enhanced Query Processing
   - Automatic client graph creation
   - Real-time dual-graph search
   - Graph citations in answers

3. Advanced Reasoning
   - Path-based deduction
   - Temporal constraint checking
   - Confidence aggregation

===================================================================================
SUPPORT & DEBUGGING
===================================================================================

Enable Debug Logging:
```python
import logging
logging.getLogger("graph_integrator").setLevel(logging.DEBUG)
```

Check NER Service API:
```bash
# Health check
curl http://localhost:8108/health

# Extract example
curl -X POST http://localhost:8108/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "...", "document_id": "doc-1", "filename": "test.txt"}'

# Search graph
curl -X POST http://localhost:8108/graph/graph-id/search \
  -H "Content-Type: application/json" \
  -d '{"query": "debt", "entity_types": ["DEBT_TYPE"], "limit": 10}'
```

Neo4j Console:
```
http://localhost:7474

Query: MATCH (n) RETURN count(n) LIMIT 5
Query: MATCH (e:Entity) WHERE e.type = 'RULE' RETURN e LIMIT 5
Query: MATCH (e1:Entity)-[r:TRIGGERS]->(e2:Entity) RETURN e1, r, e2 LIMIT 3
```

===================================================================================
DOCUMENTATION REFERENCES
===================================================================================

- NER_GRAPH_SERVICE_ARCHITECTURE.md: Graph service design
- PHASE1_NER_IMPLEMENTATION.md: NER service API reference
- Agent Graph Nodes (agent_nodes.py): LangGraph node definitions
- Decision Tree Builder (decision_tree_builder.py): Eligibility logic

"""

# Quick Reference
print(__doc__)
