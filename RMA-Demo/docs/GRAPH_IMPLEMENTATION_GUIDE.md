# Graph System Implementation Guide

## Overview

This guide walks through implementing the complete graph system from component to production.

## Architecture Summary

```
┌─────────────────┐
│  React Frontend │ (DebtAdviceGraph.tsx - DONE ✓)
│  SVG + Filter   │
└────────┬────────┘
         │
    API Calls
         │
┌────────▼────────────────────────┐
│   FastAPI Backend (rag-service) │
│                                 │
│  POST /api/graph/build ─────────┤─→ graph_builder.py (DONE ✓)
│  GET  /api/graph/{id} ─────────┤    graph_routes.py (DONE ✓)
│  GET  /api/graph/{id}/paths ───┤
│  POST /api/graph/reasoning-trail│
└────────┬────────────────────────┘
         │
    Storage & LLM
         │
┌────────▼─────────────────────────────────┐
│  graph_builder.py (LLM Integration)      │
│  ├─ GraphBuilder class                   │
│  ├─ Entity/Relation classes              │
│  ├─ Extraction prompts                   │
│  └─ Graph enrichment logic               │
└────────┬─────────────────────────────────┘
         │
    Persistence
         │
    ┌────┴─────┐
    │           │
┌───▼──┐   ┌───▼──┐
│Chrome│   │ JSON │
│  DB  │   │ File │
└──────┘   └──────┘
```

## Phase 1: Core Infrastructure (DONE)

### Completed Files:
- ✅ `graph_builder.py` - Entity/Relation classes and extraction logic
- ✅ `graph_routes.py` - FastAPI endpoints
- ✅ `DebtAdviceGraph.tsx` - React visualization component
- ✅ `page.tsx` - Added Graph View tab

### What Works Now:
- Graph data structures (Entity, Relation, DebtAdviceGraph)
- Entity types enumeration
- Relation types enumeration
- Graph path finding algorithm
- Basic visualization (SVG nodes and edges)
- Export to JSON/CSV

## Phase 2: LLM Integration (NEXT)

### File: `rag-service/app.py`

**Add to imports**:
```python
from graph_builder import GraphBuilder, DebtAdviceGraph, EntityType, RelationType
from graph_routes import register_graph_routes
```

**Add to startup**:
```python
@app.on_event("startup")
async def startup_event():
    # ... existing code ...
    
    # Initialize graph builder with LLM provider
    global graph_builder
    graph_builder = GraphBuilder(llm_provider=llm_client)
```

**Register graph routes**:
```python
# At the end of app.py
register_graph_routes(app)
```

### File: `rag-service/requirements.txt`

Add if not present:
```
langchain>=0.1.0
langchain-community>=0.0.10
pydantic>=2.0
```

### Testing LLM Integration

**Test entity extraction**:
```bash
curl -X POST http://localhost:8102/api/graph/build \
  -H "Content-Type: application/json" \
  -d '{
    "text_chunks": [
      {
        "text": "A DRO can be granted if debt does not exceed £50,000 and income is less than £75 per month.",
        "chunk_id": "sample_1"
      }
    ],
    "source_files": ["sample_manual.txt"],
    "document_type": "manual"
  }'
```

**Expected response**:
```json
{
  "id": "graph_xyz",
  "entities": {
    "ent_001": {
      "type": "threshold",
      "label": "£50,000 DRO Debt Limit",
      "confidence": 0.95
    },
    "ent_002": {
      "type": "threshold", 
      "label": "£75 Monthly Income Limit",
      "confidence": 0.95
    }
  },
  "relations": {...},
  "stats": {...}
}
```

## Phase 3: Storage Layer (IMPLEMENTATION)

### Option A: ChromaDB Storage (Recommended for MVP)

**File: `rag-service/graph_store.py` (NEW)**

```python
"""Graph persistence layer using ChromaDB"""

import json
import chromadb
from typing import Optional, List
from graph_builder import DebtAdviceGraph
import logging

logger = logging.getLogger(__name__)

class GraphStore:
    """Store and retrieve graphs from ChromaDB"""
    
    def __init__(self, chroma_client):
        self.chroma = chroma_client
        self.collection = None
        self._init_collection()
    
    def _init_collection(self):
        """Initialize ChromaDB collection for graphs"""
        try:
            self.collection = self.chroma.get_collection("debt_graphs")
        except:
            self.collection = self.chroma.create_collection(
                name="debt_graphs",
                metadata={"description": "Debt advice graphs"}
            )
    
    def save(self, graph: DebtAdviceGraph) -> str:
        """Save graph to store"""
        graph_data = graph.to_dict()
        
        # Store as JSON
        doc_id = graph.id
        
        self.collection.add(
            ids=[doc_id],
            documents=[json.dumps(graph_data)],
            metadatas=[{
                "source_documents": ",".join(graph.source_documents),
                "entity_count": len(graph.entities),
                "relation_count": len(graph.relations),
                "created_at": graph.created_at
            }]
        )
        
        logger.info(f"Saved graph {doc_id}")
        return doc_id
    
    def get(self, graph_id: str) -> Optional[DebtAdviceGraph]:
        """Retrieve graph from store"""
        try:
            results = self.collection.get(ids=[graph_id])
            if not results['documents']:
                return None
            
            graph_data = json.loads(results['documents'][0])
            # Reconstruct graph from data
            # TODO: implement deserialization
            return graph_data
        except Exception as e:
            logger.error(f"Failed to get graph {graph_id}: {e}")
            return None
    
    def list_all(self) -> List[dict]:
        """List all graphs"""
        try:
            results = self.collection.get(limit=1000)
            graphs = []
            for doc_id, metadata in zip(results['ids'], results['metadatas']):
                graphs.append({
                    "id": doc_id,
                    "source_documents": metadata.get("source_documents", "").split(","),
                    "entity_count": metadata.get("entity_count", 0),
                    "relation_count": metadata.get("relation_count", 0),
                    "created_at": metadata.get("created_at")
                })
            return graphs
        except Exception as e:
            logger.error(f"Failed to list graphs: {e}")
            return []
    
    def delete(self, graph_id: str) -> bool:
        """Delete graph from store"""
        try:
            self.collection.delete(ids=[graph_id])
            logger.info(f"Deleted graph {graph_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete graph {graph_id}: {e}")
            return False
```

### Option B: Neo4j Storage (Production Scale)

```python
"""Neo4j graph database backend"""

from neo4j import GraphDatabase

class GraphNeo4jStore:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def save(self, graph: DebtAdviceGraph):
        """Save graph to Neo4j"""
        with self.driver.session() as session:
            # Create graph node
            session.run(
                "CREATE (g:Graph {id: $id, created_at: $created})",
                id=graph.id,
                created=graph.created_at
            )
            
            # Create entity nodes
            for entity in graph.entities.values():
                session.run("""
                    CREATE (e:Entity {
                        id: $id,
                        type: $type,
                        label: $label,
                        confidence: $confidence
                    })
                    """,
                    id=entity.id,
                    type=entity.type.value,
                    label=entity.label,
                    confidence=entity.confidence
                )
            
            # Create relations
            for rel in graph.relations.values():
                session.run("""
                    MATCH (source:Entity {id: $source})
                    MATCH (target:Entity {id: $target})
                    CREATE (source)-[r:RELATES {
                        type: $type,
                        confidence: $confidence
                    }]->(target)
                    """,
                    source=rel.source_entity_id,
                    target=rel.target_entity_id,
                    type=rel.type.value,
                    confidence=rel.confidence
                )
```

### Update graph_routes.py to use store

**File: `rag-service/graph_routes.py`**

```python
# At the top, add:
from graph_store import GraphStore

# In each endpoint, replace placeholders:

@router.post("/build", response_model=GraphResponse)
async def build_graph(request: BuildGraphRequest):
    # ... existing code ...
    
    # Save to store
    from app import graph_store  # Import from main app
    graph_store.save(graph)
    
    # ... return response ...

@router.get("/{graph_id}")
async def get_graph(graph_id: str):
    from app import graph_store
    graph = graph_store.get(graph_id)
    if not graph:
        raise HTTPException(status_code=404)
    # ... return response ...
```

## Phase 4: Eligibility Checker Integration (IMPLEMENTATION)

### Update EligibilityChecker to show Graph Reasoning

**File: `frontend/src/components/EligibilityChecker.tsx`**

Add to component state:
```typescript
const [showGraphReasoning, setShowGraphReasoning] = useState(false)
const [reasoningTrail, setReasoningTrail] = useState(null)
```

Add method to get reasoning:
```typescript
const fetchReasoningTrail = async (graphId: string) => {
  try {
    const response = await fetch(
      `${RAG_SERVICE_URL}/api/graph/reasoning-trail`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph_id: graphId,
          question: formData.question,
          client_values: {
            debt: formData.debt,
            income: formData.income,
            assets: formData.assets
          }
        })
      }
    )
    const data = await response.json()
    setReasoningTrail(data)
    setShowGraphReasoning(true)
  } catch (err) {
    console.error('Error fetching reasoning trail:', err)
  }
}
```

Add to results display:
```typescript
{result && (
  <>
    <Button
      variant="outline"
      onClick={() => fetchReasoningTrail(currentGraphId)}
      className="mt-4"
    >
      Show Reasoning Path
    </Button>
    
    {showGraphReasoning && reasoningTrail && (
      <ReasoningTrailDisplay trail={reasoningTrail} />
    )}
  </>
)}
```

### Create ReasoningTrailDisplay Component

**File: `frontend/src/components/ReasoningTrailDisplay.tsx` (NEW)**

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowDown, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function ReasoningTrailDisplay({ trail }) {
  return (
    <Card className="mt-4 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-sm">Reasoning Path</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {trail.path.map((step, idx) => (
          <div key={idx} className="flex gap-4">
            <div className="flex flex-col items-center">
              {step.result ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              {idx < trail.path.length - 1 && (
                <ArrowDown className="h-4 w-4 text-gray-400 mt-2" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{step.entity_label}</div>
              <div className="text-xs text-gray-600 mt-1">
                Value: {step.actual_value} vs Threshold: {step.threshold_value}
              </div>
              {step.gap && (
                <Badge variant={step.result ? "outline" : "destructive"}>
                  Gap: {step.gap}
                </Badge>
              )}
            </div>
          </div>
        ))}
        
        <div className="mt-4 p-3 bg-white rounded border-l-4 border-blue-600">
          <div className="font-semibold text-sm">{trail.conclusion_label}</div>
          <div className="text-xs text-gray-600 mt-1">
            Confidence: {(trail.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## Phase 5: Testing (IMPLEMENTATION)

### Test Script

**File: `rag-service/test_graph_builder.py` (NEW)**

```python
"""Test graph builder with sample manuals"""

import asyncio
from graph_builder import GraphBuilder, EntityType, RelationType

async def test_entity_extraction():
    """Test entity extraction from sample text"""
    
    sample_text = """
    A Debt Relief Order (DRO) can be granted if:
    1. The debtor's total debt does not exceed £50,000
    2. Their monthly income is less than £75
    3. They have not had a previous DRO in the last 6 years
    
    The £50,000 threshold is set by statute and is reviewed annually.
    Income is calculated on a monthly average over 12 months.
    """
    
    class MockLLM:
        async def generate(self, prompt):
            # Simulate LLM response
            return """{
                "entities": [
                    {
                        "label": "Total debt ≤ £50,000",
                        "type": "threshold",
                        "properties": {"amount": 50000, "currency": "GBP"},
                        "confidence": 0.95
                    },
                    {
                        "label": "Monthly income < £75",
                        "type": "threshold",
                        "properties": {"amount": 75, "currency": "GBP", "period": "monthly"},
                        "confidence": 0.95
                    }
                ]
            }"""
    
    builder = GraphBuilder(llm_provider=MockLLM())
    
    entities = await builder.extract_entities(sample_text, "test.txt", "chunk_1")
    
    print(f"Extracted {len(entities)} entities:")
    for e in entities:
        print(f"  - {e.label} ({e.type.value}): {e.confidence:.0%} confidence")
    
    assert len(entities) >= 2, "Should extract at least 2 entities"
    assert any(e.type == EntityType.THRESHOLD for e in entities)
    print("✓ Entity extraction test passed")

async def test_graph_building():
    """Test full graph building"""
    
    sample_chunks = [
        {
            "text": "A DRO requires debt ≤ £50,000 and income < £75/month",
            "chunk_id": "1"
        }
    ]
    
    class MockLLM:
        async def generate(self, prompt):
            if "entity" in prompt.lower():
                return """{
                    "entities": [
                        {"label": "Debt ≤ £50k", "type": "threshold", "confidence": 0.95, "properties": {}}
                    ]
                }"""
            else:
                return """{
                    "relations": [
                        {
                            "source": "Debt ≤ £50k",
                            "target": "Eligible for DRO",
                            "type": "implies",
                            "confidence": 0.90
                        }
                    ]
                }"""
    
    builder = GraphBuilder(llm_provider=MockLLM())
    graph = await builder.build_graph(sample_chunks, ["test.pdf"])
    
    print(f"Graph built: {len(graph.entities)} entities, {len(graph.relations)} relations")
    assert len(graph.entities) > 0
    assert graph.id.startswith("graph_")
    print("✓ Graph building test passed")

if __name__ == "__main__":
    asyncio.run(test_entity_extraction())
    asyncio.run(test_graph_building())
```

Run tests:
```bash
cd rag-service
python test_graph_builder.py
```

## Phase 6: Deployment Checklist

- [ ] Graph builder integrated with LLM provider
- [ ] GraphStore initialized in app.py
- [ ] graph_routes registered with app
- [ ] Sample graphs ingested and tested
- [ ] Frontend DebtAdviceGraph component loads graphs
- [ ] Eligibility checker shows reasoning trails
- [ ] Export to JSON working
- [ ] Export to CSV working
- [ ] Documentation updated
- [ ] Sample data loaded
- [ ] Performance tested (>1000 entities)

## Integration Checklist

### Backend (`rag-service/app.py`)

```python
# 1. Add imports at top
from graph_builder import GraphBuilder
from graph_routes import register_graph_routes
from graph_store import GraphStore

# 2. Initialize in startup
graph_store = None
graph_builder = None

@app.on_event("startup")
async def startup():
    global graph_store, graph_builder
    graph_store = GraphStore(chroma_client)
    graph_builder = GraphBuilder(llm_provider=llm_client)

# 3. Register routes
register_graph_routes(app)

# 4. Add dependency injection to endpoints
@router.post("/api/graph/build")
async def build_graph(request):
    graph = await graph_builder.build_graph(...)
    graph_store.save(graph)
    return graph.to_dict()
```

### Frontend (`page.tsx`)

```typescript
// 1. Import component
import DebtAdviceGraph from '@/components/DebtAdviceGraph'

// 2. Add to tabs (DONE in Phase 1)
<TabsTrigger value="graph">Graph View</TabsTrigger>

// 3. Add content tab
<TabsContent value="graph">
  <DebtAdviceGraph />
</TabsContent>
```

## Performance Optimization

### For Large Graphs (>10k entities)

1. **Pagination**: Load entities/relations in batches
2. **Virtualization**: Only render visible nodes
3. **Clustering**: Group similar entities
4. **Caching**: Cache extracted graphs in Redis

### Neo4j Indexing

```cypher
CREATE INDEX ON :Entity(id);
CREATE INDEX ON :Entity(type);
CREATE CONSTRAINT ON (e:Entity) ASSERT e.id IS UNIQUE;
```

## Next Steps

1. **Integrate LLM** in graph_builder (Phase 2)
2. **Implement Storage** layer (Phase 3)
3. **Update Eligibility Checker** integration (Phase 4)
4. **Run Tests** (Phase 5)
5. **Deploy to Production** (Phase 6)

Each phase has clear TODOs and can be completed independently!
