# NER Graph Service Architecture & Implementation Plan

## Executive Summary

You're building a **dual-graph debt advice engine** that formalizes advisory logic through entity relationships:

1. **Manual Graph** (extracted from training manuals during ingestion)
   - Named Entity Recognition → NER tuples
   - Timestamps & logic gates (when rules become relevant)
   - Pinned relationships (immutable advisory framework)
   - Interactive visualization

2. **Client Graph** (extracted from client documents during ingestion)
   - Similar NER tuples but client-specific data
   - Financial entities, debts, obligations
   - Time-based logical gates (payment dates, statute of limitations)
   - Dynamic, updatable

3. **Advisor LLM** (traverses both graphs)
   - Compares manual rules against client facts
   - Identifies applicable advice paths
   - Generates advisory logic with citations
   - Real-time graph traversal

---

## Current State Analysis

### Document Ingestion Flow (As Is)
```
Document Upload
    ↓
Upload Service (8106)
    ↓
doc-processor (8101) [OCR]
    ├─ LlamaParse → markdown
    ├─ OCR Service (8104) → markdown
    └─ Tesseract → markdown
    ↓
Markdown output
    ↓
[MISSING: Graph extraction & storage]
    ↓
RAG Service (8102) [Vector storage only]
    ├─ ChromaDB (vectors only, no relationships)
    └─ Keyword search, no logical flow
```

### Problem: No Relationship Graph
- ✗ Only stores markdown + vectors
- ✗ No entity extraction
- ✗ No logical relationships
- ✗ No timestamps/gates
- ✗ Advisor LLM can't traverse structured knowledge
- ✗ Can't compare manual advice with client facts

---

## Proposed Solution: Triple-Layer Architecture

### Layer 1: Graph Extraction (NEW SERVICE)
```
NER Graph Builder Service (port 8108)

Input: Markdown from doc-processor
    ↓
Step 1: Entity Extraction
├─ Named Entity Recognition (NER)
├─ Entity types: PERSON, MONEY, DATE, DEBT_TYPE, OBLIGATION, GATE, etc.
└─ Uses vLLM for structured extraction
    ↓
Step 2: Relationship Extraction
├─ Extract tuples: (entity1, relation_type, entity2)
├─ Add metadata: timestamps, logic gates, conditions
├─ Score confidence of relationships
└─ Identify contradictions/dependencies
    ↓
Step 3: Graph Construction
├─ Build RDF/property graph
├─ Add temporal logic (when is this relationship valid?)
├─ Add conditional gates (if X then Y)
└─ Deduplicate across documents
    ↓
Step 4: Storage & Indexing
├─ Neo4j (graph database)
├─ Full-text search index
├─ Relationship type index
└─ Temporal query index

Output: Graph ID, node count, relationship count, extraction confidence
```

### Layer 2: Dual Graph Management (UPDATED SERVICE)
```
RAG Service Enhancement (8102)

Graph Storage Strategy:
├─ Manual Graph
│  ├─ Label: "MANUAL"
│  ├─ Properties: immutable, source_document, extraction_date
│  ├─ Relationships: tagged with rule types
│  └─ Access pattern: read-heavy, cached
│
├─ Client Graph
│  ├─ Label: "CLIENT"
│  ├─ Properties: client_id, mutable, source_document
│  ├─ Relationships: tagged with fact types
│  └─ Access pattern: read-write, versioned

Integration Points:
├─ ChromaDB: Store vectors (unchanged)
├─ Neo4j: Store graphs (new)
└─ Cache layer: Graph traversal results

Query Types:
├─ Vector search: "Find relevant manual sections"
├─ Graph search: "Find all obligations for client"
├─ Cross-graph: "Compare manual rules vs client facts"
└─ Temporal: "What rules apply on DATE X?"
```

### Layer 3: Advisor LLM (UPDATED SERVICE)
```
RAG Service Query Enhancement

Current: Single-model RAG (vector search only)
New: Dual-graph traversal with LLM reasoning

Query Processing:
1. Receive advisory question
2. Extract entities from question (NER)
3. Vector search for relevant manual sections
4. Graph search for:
   ├─ Matching entities in manual graph
   ├─ Matching entities in client graph
   └─ Relationship paths between them
5. LLM reasoning:
   ├─ Traverse manual graph for applicable rules
   ├─ Cross-reference with client graph
   ├─ Identify gates/conditions that apply
   ├─ Generate advisory chain with logic
   └─ Cite both graphs in response
6. Return advisory with:
   ├─ Logical flow (rules → facts → advice)
   ├─ Graph path visualization
   ├─ Confidence score
   └─ Alternative paths explored
```

---

## Detailed Service Design: NER Graph Builder

### Service Architecture
```python
NERGraphBuilder Service (8108)

Endpoints:
├─ POST /extract              → Extract graph from markdown
├─ GET /extract/{extract_id}  → Get extraction status
├─ GET /graph/{graph_id}      → Get graph structure
├─ GET /graph/{graph_id}/search → Query graph
├─ POST /graph/{graph_id}/merge → Merge graphs
└─ GET /health               → Health check

Database:
├─ Neo4j: Graph data (relationships)
└─ PostgreSQL: Metadata, extraction logs

LLM Integration:
├─ vLLM for fast entity extraction
├─ Structured output format (JSON)
└─ Confidence scoring per relationship
```

### Key Components

#### 1. Entity Extractor
```python
class EntityExtractor:
    """Extract named entities with types and confidence scores."""
    
    ENTITY_TYPES = {
        # Manual-specific
        'DEBT_TYPE': 'Type of debt (mortgage, credit card, etc)',
        'OBLIGATION': 'Legal or contractual obligation',
        'RULE': 'Advisory rule or guideline',
        'GATE': 'Time-based trigger or condition',
        'MONEY_THRESHOLD': 'Financial threshold value',
        
        # Standard NER
        'PERSON': 'Individual name',
        'ORGANIZATION': 'Company or institution',
        'DATE': 'Calendar date or period',
        'MONEY': 'Currency amount',
        'PERCENT': 'Percentage value',
        'LOCATION': 'Geographic location',
    }
    
    def extract(self, markdown: str) -> List[Entity]:
        """
        Extract entities using LLM with structured output.
        
        Prompt:
            Extract all entities from this text. For each entity:
            - entity_text (exact text)
            - entity_type (one of: {ENTITY_TYPES})
            - context (surrounding sentence)
            - confidence (0.0-1.0)
            
        Return JSON array of entities.
        """
        pass
```

#### 2. Relationship Extractor
```python
class RelationshipExtractor:
    """Extract relationships between entities with metadata."""
    
    RELATION_TYPES = {
        # Structural
        'IS_A': 'Entity type hierarchy',
        'PART_OF': 'Compositional relationship',
        'SYNONYMOUS': 'Equivalent entities',
        
        # Logical
        'TRIGGERS': 'Event B happens when A occurs',
        'REQUIRES': 'Entity B is required for A',
        'BLOCKS': 'Entity B prevents/blocks A',
        'FOLLOWS': 'Temporal sequence (A then B)',
        
        # Domain-specific (Debt Advice)
        'AFFECTS_REPAYMENT': 'Rule affects repayment calculation',
        'HAS_GATE': 'Rule has time-based condition',
        'CONTRADICTS': 'Rules conflict',
        'EXTENDS': 'Rule extends/modifies another',
    }
    
    def extract(self, markdown: str, entities: List[Entity]) -> List[Relationship]:
        """
        Extract relationships with temporal/conditional metadata.
        
        For each relationship:
        - entity1_id: Source entity
        - entity2_id: Target entity
        - relation_type: One of RELATION_TYPES
        - metadata:
            - condition: "if X then Y"
            - timestamp: "2025-03-15 onwards"
            - logic_gate: "when client_age > 65"
            - confidence: 0.0-1.0
            - source_sentences: [list of supporting text]
        """
        pass
```

#### 3. Graph Constructor
```python
class GraphConstructor:
    """Build Neo4j graph from entities and relationships."""
    
    def build_graph(self, 
                   markdown: str,
                   entities: List[Entity],
                   relationships: List[Relationship],
                   source_document: str,
                   graph_type: str = "MANUAL") -> str:
        """
        Create Neo4j graph.
        
        Neo4j Structure:
        
        Nodes:
        (:Entity {
            id: uuid,
            text: "entity text",
            type: "DEBT_TYPE",
            confidence: 0.95,
            source_document: "doc_id",
            extraction_date: timestamp,
            graph_label: "MANUAL" or "CLIENT"
        })
        
        Relationships:
        [:TRIGGERS {
            confidence: 0.92,
            condition: "when debt > $10,000",
            effective_date: "2025-01-01",
            source_sentences: [...]
        }]
        
        Metadata Nodes:
        (:ExtractionRun {
            id: uuid,
            document_id: "doc_id",
            extraction_date: timestamp,
            confidence_avg: 0.88,
            entity_count: 42,
            relationship_count: 128,
            method: "vLLM+NER"
        })
        """
        pass
```

#### 4. Graph Querier
```python
class GraphQuerier:
    """Query Neo4j graphs for advisory reasoning."""
    
    def find_applicable_rules(self, 
                             client_graph_id: str,
                             manual_graph_id: str,
                             question: str) -> Dict:
        """
        Find manual rules applicable to client situation.
        
        Query Pattern:
        1. Extract entities from question using NER
        2. Find matching entities in both graphs
        3. Traverse relationship chains:
           manual_rule → TRIGGERS → condition → client_fact
        4. Filter by temporal gates (is rule currently valid?)
        5. Rank by applicability and confidence
        
        Return:
        {
            "applicable_rules": [
                {
                    "rule_id": "...",
                    "rule_text": "...",
                    "matching_entities": [...],
                    "reasoning_path": "rule → triggers → condition → fact",
                    "confidence": 0.89,
                    "gates": ["age > 65", "debt_amount > $50k"],
                    "applicable": True/False
                }
            ],
            "reasoning_graph": {
                "nodes": [...],
                "edges": [...]
            }
        }
        """
        pass
```

---

## Integration Points

### 1. Document Ingestion Pipeline (UPDATED)
```
Upload Service (8106)
    ↓ file
doc-processor (8101) [OCR]
    ↓ markdown
NER Graph Builder (8108) [NEW]
    ├─ Extract entities
    ├─ Extract relationships
    ├─ Build Neo4j graph
    └─ Return graph_id
    ↓
RAG Service (8102)
    ├─ Store markdown in ChromaDB (vectors)
    ├─ Link to graph_id in Neo4j
    └─ Return both for future queries
    ↓
Frontend UI
    ├─ Display document content
    ├─ Show interactive graph
    └─ Show entity relationships
```

### 2. Query Processing (UPDATED)
```
User Query: "What can I do about my mortgage?"
    ↓
RAG Service receives query
    ├─ Extract question entities (NER)
    ├─ Vector search in ChromaDB
    │  └─ Find relevant manual sections
    ├─ Graph search in Neo4j
    │  ├─ Manual graph: Find MORTGAGE rules
    │  ├─ Client graph: Find client MORTGAGE facts
    │  └─ Query applicable reasoning chains
    └─ LLM reasoning
       ├─ Traverse both graphs side-by-side
       ├─ Build advisory logic chain
       ├─ Check temporal gates (is advice current?)
       └─ Generate response with graph citation

Response:
{
    "advice": "Based on your mortgage details...",
    "reasoning_graph": {
        "manual_path": "Debt Rule → AFFECTS_REPAYMENT → ...",
        "client_path": "Client Mortgage → HAS_GATE → ...",
        "conclusion": "Advice applies because..."
    },
    "confidence": 0.89,
    "sources": ["manual_doc_1", "client_doc_2"]
}
```

---

## Data Model: RDF Triple Example

### Manual Graph Triple Example
```
Subject: "Mortgage Default Protection"
Predicate: "AFFECTS_REPAYMENT"
Object: "Payment Holiday Eligibility"

Metadata:
{
    "temporal_gate": "applicable_from: 2025-01-01",
    "condition": "if client_age > 60 AND mortgage_balance > $100k",
    "logic_gate": "when unemployment = true",
    "confidence": 0.92,
    "source": "FCA_Guidelines_v2.5",
    "rule_type": "PROTECTION"
}
```

### Client Graph Triple Example
```
Subject: "John Smith's Mortgage"
Predicate: "HAS_STATUS"
Object: "6_Months_Behind"

Metadata:
{
    "as_of_date": "2025-11-04",
    "debt_amount": "$245,000",
    "monthly_payment": "$1,850",
    "confidence": 0.99,
    "source": "client_document_upload_date_2025-11-01",
    "client_id": "client_uuid_123"
}

Then cross-reference:
"6_Months_Behind" MATCHES "TRIGGERS" Payment Holiday Rule
→ "John Smith may be eligible for payment holiday"
```

---

## Frontend Integration: Interactive Graph Visualization

### React Component Structure
```typescript
// Manual Graph Viewer
<ManualGraphViewer graphId={manualGraphId}>
  ├─ Node types: Rules, Entities, Gates
  ├─ Edge colors by relationship type
  ├─ Hover shows entity details
  ├─ Click to highlight related nodes
  └─ Timeline slider to show temporal gates

// Client Graph Viewer
<ClientGraphViewer graphId={clientGraphId} clientId={clientId}>
  ├─ Node types: Client Facts, Debts, Obligations
  ├─ Edge colors by relationship type
  ├─ Show last updated timestamp
  ├─ Edit capability (fact correction)
  └─ Conflict highlighting

// Dual Graph Comparison
<DualGraphComparison 
    manualGraphId={manualGraphId}
    clientGraphId={clientGraphId}
    question={question}>
  ├─ Split-screen view
  ├─ Highlight matching entities
  ├─ Show reasoning chain overlay
  ├─ Animate path through both graphs
  └─ Show applicability gates

// Interactive Legend
<GraphLegend>
  ├─ Entity types (colors)
  ├─ Relationship types (line styles)
  ├─ Temporal gates (time indicators)
  └─ Confidence scores (node size)
```

### Graph Visualization Library
```
Recommended: Vis.js, D3.js, or React Flow
- Handles 100-1000 nodes efficiently
- Zoom/pan/search capability
- Temporal animation (gates over time)
- Responsive design for mobile

Neo4j Browser Integration:
- Direct query editor for power users
- CYPHER query examples provided
- Export graphs as SVG/PNG
```

---

## Implementation Roadmap

### Phase 1: NER Graph Builder Service (Week 1)
```
✓ Create services/ner-graph-service/
  ├─ app.py: Entity & relationship extraction
  ├─ neo4j_client.py: Graph operations
  ├─ extractors.py: Entity/relationship extraction
  ├─ requirements.txt: Neo4j, LangChain, etc.
  └─ Dockerfile

✓ Docker Compose
  ├─ Add Neo4j service (port 7687, UI 7474)
  ├─ Add NER service (port 8108)
  └─ Add Neo4j volume for persistence

✓ Database Schema
  ├─ Entity nodes with types/confidence
  ├─ Relationship edges with metadata
  ├─ Extraction run tracking
  └─ Graph type labels (MANUAL/CLIENT)
```

### Phase 2: RAG Service Enhancement (Week 2)
```
✓ Extend RAG Service
  ├─ Link markdown → graph_id in response
  ├─ Add graph query endpoint
  ├─ Implement dual-graph search
  ├─ Add temporal gate checking
  └─ Enhance LLM prompts for graph reasoning

✓ Update Document Ingestion
  ├─ Call NER service after doc-processor
  ├─ Await graph extraction before responding
  ├─ Store graph_id with document metadata
  └─ Handle extraction failures gracefully
```

### Phase 3: Frontend Components (Week 2-3)
```
✓ Graph Visualization
  ├─ Manual graph viewer (read-only)
  ├─ Client graph viewer (editable)
  ├─ Dual-graph comparison view
  ├─ Entity search and highlight
  └─ Temporal timeline controls

✓ Integration
  ├─ Add graph tab to document viewer
  ├─ Show graph in query results
  ├─ Display reasoning chain overlay
  └─ Export graph images/data
```

### Phase 4: Advisor LLM Enhancement (Week 3-4)
```
✓ Query Processing
  ├─ Extract question entities
  ├─ Search graphs for matches
  ├─ Build reasoning chain
  ├─ Check applicability gates
  └─ Generate advisory with citations

✓ Testing
  ├─ Compare manual rules vs client facts
  ├─ Verify temporal gates work
  ├─ Test reasoning chain logic
  └─ Validate confidence scores
```

---

## Database Schema (Neo4j Cypher)

```cypher
-- Create Entity nodes
CREATE (entity:Entity {
    id: 'entity_uuid',
    text: 'entity text',
    type: 'DEBT_TYPE',  -- or OBLIGATION, GATE, PERSON, etc
    confidence: 0.95,
    source_document: 'doc_id',
    extraction_date: timestamp(),
    graph_label: 'MANUAL'  -- or CLIENT
})

-- Create Relationships with metadata
CREATE (entity1)-[rel:TRIGGERS {
    confidence: 0.92,
    condition: 'when debt > $10,000',
    effective_date: '2025-01-01',
    source_sentences: ['sentence1', 'sentence2'],
    relation_type: 'TRIGGERS'
}]->(entity2)

-- Create Extraction metadata
CREATE (extraction:ExtractionRun {
    id: 'extraction_uuid',
    document_id: 'doc_id',
    extraction_date: timestamp(),
    entity_count: 42,
    relationship_count: 128,
    avg_confidence: 0.88,
    method: 'vLLM+NER'
})

-- Queries
-- Find all rules applicable to client
MATCH (manual_rule:Entity {graph_label: 'MANUAL', type: 'RULE'})
-[rel:AFFECTS_REPAYMENT]->
(client_fact:Entity {graph_label: 'CLIENT'})
WHERE manual_rule.confidence > 0.85
RETURN manual_rule, rel, client_fact

-- Find temporal gates for current date
MATCH (rule:Entity {type: 'RULE'})
-[gate:HAS_GATE {effective_date <= datetime()}]->
(condition:Entity {type: 'GATE'})
RETURN rule, condition

-- Find contradictions
MATCH (rule1:Entity)-[:CONTRADICTS]->(rule2:Entity)
WHERE rule1.confidence > 0.8 AND rule2.confidence > 0.8
RETURN rule1, rule2
```

---

## Configuration & Deployment

### docker-compose.vllm.yml additions
```yaml
# Neo4j Graph Database
neo4j:
  image: neo4j:5.15
  container_name: rma-neo4j
  ports:
    - "7474:7474"  # Browser UI
    - "7687:7687"  # Bolt protocol
  environment:
    - NEO4J_AUTH=neo4j/changeme-in-production
    - NEO4J_PLUGINS=["apoc", "graph-data-science"]
    - NEO4J_dbms_memory_pagecache_size=2G
  volumes:
    - neo4j_data:/data
    - neo4j_logs:/logs
  healthcheck:
    test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "changeme-in-production", "RETURN 1"]
    interval: 15s
    timeout: 10s
    retries: 5

# NER Graph Builder Service
ner-graph-service:
  build:
    context: ./services/ner-graph-service
    dockerfile: Dockerfile
  container_name: rma-ner-graph-service
  ports:
    - "8108:8108"
  environment:
    - NEO4J_URI=bolt://neo4j:7687
    - NEO4J_USER=neo4j
    - NEO4J_PASSWORD=changeme-in-production
    - LLM_PROVIDER=vllm
    - VLLM_URL=http://vllm:8000
  depends_on:
    neo4j:
      condition: service_healthy
    vllm:
      condition: service_healthy
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8108/health"]
    interval: 15s
    timeout: 5s
    retries: 3

volumes:
  neo4j_data:
  neo4j_logs:
```

---

## Performance Considerations

### Graph Query Performance
```
Issue: Large graphs can be slow to traverse
Solution:
├─ Index by: entity_type, relationship_type, graph_label
├─ Cache: Common relationship paths
├─ Batch: Parallel entity extraction for large documents
└─ Paginate: Return results in chunks for UI

Benchmarks (target):
├─ Entity extraction: <10 seconds per page
├─ Relationship extraction: <5 seconds per page
├─ Graph construction: <2 seconds per 100 entities
├─ Query traversal: <200ms for typical advisor queries
└─ UI rendering: <1 second for graphs <500 nodes
```

### Memory Management
```
Challenge: Neo4j memory + LLM VRAM + ChromaDB
Solution:
├─ Neo4j: Allocate 2-4GB heap
├─ vLLM: Allocate 8GB+ on GPU 1
├─ ChromaDB: In-memory caching
├─ Monitor: Set up alerts for OOM conditions
└─ Optimize: Connection pooling, query optimization
```

---

## Testing Strategy

### Unit Tests
```python
# Test entity extraction
test_extract_entities_from_markdown()
test_entity_confidence_scoring()
test_multiple_entity_types()

# Test relationship extraction
test_extract_relationships()
test_temporal_gate_parsing()
test_condition_extraction()

# Test graph operations
test_create_neo4j_graph()
test_query_graph()
test_merge_graphs()
test_temporal_queries()
```

### Integration Tests
```
test_document_to_graph_pipeline()
test_dual_graph_comparison()
test_advisor_llm_with_graphs()
test_ui_graph_rendering()
```

---

## Success Criteria

✅ **Phase 1: NER Graph Builder**
- Entity extraction >85% accuracy
- Relationship extraction >80% accuracy
- Graph construction <5s for typical document
- Neo4j queries respond <200ms

✅ **Phase 2: RAG Integration**
- Document ingestion → automatic graph extraction
- Graph searchable within 2 seconds
- Dual-graph queries working

✅ **Phase 3: Frontend Visualization**
- Manual graph renders in <2 seconds
- Client graph interactive and editable
- Side-by-side comparison functional

✅ **Phase 4: Advisor LLM**
- Advisor can cite graph nodes/relationships
- Reasoning chain visible to user
- Temporal gates correctly evaluated
- Advice quality improved vs vector-only RAG

---

## Open Questions for You

1. **Entity Types**: Should we add domain-specific types beyond standard NER?
   - Suggested: `DEBT_OBLIGATION`, `REPAYMENT_TERM`, `CREDITOR_TYPE`, `LEGAL_STATUS`

2. **Relationship Types**: Which relationships matter most for debt advice?
   - Core: `TRIGGERS`, `REQUIRES`, `HAS_GATE`, `AFFECTS_REPAYMENT`
   - Optional: `CONTRADICTS`, `SUPERSEDES`, `DOCUMENTED_IN`

3. **Temporal Logic**: How specific should time-based gates be?
   - Per-rule effective dates?
   - Client age thresholds?
   - Statute of limitations tracking?

4. **Client Graph Updates**: How often should client graphs be regenerated?
   - Every document upload?
   - Periodic re-extraction?
   - Manual review before updating?

5. **UI Priority**: Which visualization matters most?
   - Manual graph (rule reference)?
   - Client graph (fact tracking)?
   - Side-by-side comparison?

---

## Next Steps

1. **Finalize Requirements** with your team
   - Confirm entity types
   - Define relationship types
   - Set accuracy targets

2. **Set Up Neo4j**
   - Update docker-compose
   - Configure authentication
   - Test connection

3. **Implement NER Service** (Phase 1)
   - Build entity extractor
   - Build relationship extractor
   - Build graph constructor

4. **Test & Iterate**
   - Accuracy on sample documents
   - Performance under load
   - UI integration

Would you like me to proceed with Phase 1 implementation (NER Graph Builder service)?

