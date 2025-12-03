# Testing the Debt Advice Graph System

## Quick Start Testing

### 1. Verify Component Compilation

```bash
cd RMA-Demo/frontend

# Check for TypeScript errors
npm run build

# Verify DebtAdviceGraph component compiles
npx tsc --noEmit src/components/DebtAdviceGraph.tsx
```

Expected output:
```
✓ Compiled successfully
```

### 2. Verify Graph Builder Module

```bash
cd RMA-Demo/services/rag-service

# Check Python syntax
python -m py_compile graph_builder.py
python -m py_compile graph_routes.py
```

Expected output:
```
(no errors - files compile successfully)
```

### 3. Load Example Graph in Frontend

```bash
# Start frontend
cd RMA-Demo/frontend
npm run dev

# Open http://localhost:3000
# Navigate to "Graph View" tab
# Should show loading spinner then empty graph
# (because backend not running yet)
```

### 4. Test Graph Structure

```python
# Python test script - save as test_graph.py

from graph_builder import (
    Entity, Relation, DebtAdviceGraph,
    EntityType, RelationType
)

# Create sample entities
debt_entity = Entity(
    id="ent_001",
    type=EntityType.CONDITION,
    label="Debt ≤ £50,000",
    properties={"amount": 50000, "currency": "GBP"},
    source="test.txt",
    source_chunk_id="chunk_1",
    confidence=0.95
)

income_entity = Entity(
    id="ent_002",
    type=EntityType.CONDITION,
    label="Income < £75",
    properties={"amount": 75, "currency": "GBP", "period": "monthly"},
    source="test.txt",
    source_chunk_id="chunk_1",
    confidence=0.95
)

outcome_entity = Entity(
    id="ent_003",
    type=EntityType.OUTCOME,
    label="Eligible for DRO",
    properties={},
    source="test.txt",
    source_chunk_id="chunk_1",
    confidence=0.95
)

# Create graph
graph = DebtAdviceGraph(
    id="test_graph_001",
    source_documents=["test.txt"]
)

# Add entities
graph.add_entity(debt_entity)
graph.add_entity(income_entity)
graph.add_entity(outcome_entity)

# Add relations
relation1 = Relation(
    id="rel_001",
    type=RelationType.IMPLIES,
    source_entity_id="ent_001",
    target_entity_id="ent_003",
    confidence=0.90,
    reasoning="Debt under limit implies passing debt test"
)

relation2 = Relation(
    id="rel_002",
    type=RelationType.IMPLIES,
    source_entity_id="ent_002",
    target_entity_id="ent_003",
    confidence=0.90,
    reasoning="Income under limit implies passing income test"
)

graph.add_relation(relation1)
graph.add_relation(relation2)

# Test data structures
assert len(graph.entities) == 3, f"Expected 3 entities, got {len(graph.entities)}"
assert len(graph.relations) == 2, f"Expected 2 relations, got {len(graph.relations)}"

# Test serialization
graph_dict = graph.to_dict()
assert graph_dict['id'] == 'test_graph_001'
assert graph_dict['stats']['total_entities'] == 3
assert graph_dict['stats']['total_relations'] == 2

# Test path finding
paths = graph.find_paths('ent_001', EntityType.OUTCOME)
print(f"Found {len(paths)} paths from Debt to Outcome")
assert len(paths) > 0, "Should find at least one path"

print("✓ All graph structure tests passed!")
```

Run test:
```bash
python test_graph.py
```

Expected output:
```
Found 1 paths from Debt to Outcome
✓ All graph structure tests passed!
```

## Component Testing

### Test DebtAdviceGraph Component

Create test file: `frontend/src/components/__tests__/DebtAdviceGraph.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DebtAdviceGraph from '../DebtAdviceGraph'

describe('DebtAdviceGraph Component', () => {
  // Mock fetch
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('renders component with tabs', () => {
    render(<DebtAdviceGraph />)
    
    expect(screen.getByText('Debt Advice Graph View')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /graph view/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /entities/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /relations/i })).toBeInTheDocument()
  })

  test('renders refresh button', () => {
    render(<DebtAdviceGraph />)
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    expect(refreshButton).toBeInTheDocument()
  })

  test('displays filters for entity and relation types', () => {
    render(<DebtAdviceGraph />)
    
    const entityFilter = screen.getByLabelText(/entity type/i)
    const relationFilter = screen.getByLabelText(/relation type/i)
    
    expect(entityFilter).toBeInTheDocument()
    expect(relationFilter).toBeInTheDocument()
  })

  test('renders export buttons', () => {
    render(<DebtAdviceGraph />)
    
    const jsonButton = screen.getByRole('button', { name: /json/i })
    const csvButton = screen.getByRole('button', { name: /csv/i })
    
    expect(jsonButton).toBeInTheDocument()
    expect(csvButton).toBeInTheDocument()
  })
})
```

Run tests:
```bash
npm test -- DebtAdviceGraph.test.tsx
```

## Integration Testing

### Test API Endpoints (Once Backend is Running)

```bash
# 1. Start backend
cd RMA-Demo/services/rag-service
python -m uvicorn app:app --reload --port 8102

# 2. In another terminal, test endpoints

# Health check
curl http://localhost:8102/health

# Test graph build endpoint
curl -X POST http://localhost:8102/api/graph/build \
  -H "Content-Type: application/json" \
  -d '{
    "text_chunks": [
      {
        "text": "A DRO requires debt under £50,000 and income less than £75 per month.",
        "chunk_id": "sample_1"
      }
    ],
    "source_files": ["sample.txt"],
    "document_type": "manual"
  }'

# Expected response
# {
#   "id": "graph_...",
#   "entities": {...},
#   "relations": {...},
#   "stats": {...}
# }
```

### Test Frontend Integration

```bash
# 1. Start frontend
npm run dev

# 2. Open DevTools (F12)

# 3. Go to Network tab

# 4. Click Graph View tab

# 5. Should see request to /api/graph/sample_dro_manual

# 6. Check response in Network tab

# 7. Should see graph visualization load (initially empty)
```

## End-to-End Testing

### Full Workflow Test

```
1. Backend Setup
   └─ Start rag-service with graph endpoints

2. Manual Ingestion
   └─ Build graph from DRO manual

3. Graph Visualization
   └─ View entities and relations in frontend

4. Filtering
   └─ Filter to "condition" entities only
   └─ See only debt, income, CCJ checks

5. Path Finding
   └─ Find paths from conditions to "Eligible" outcome

6. Export
   └─ Export to JSON
   └─ Verify structure
   └─ Export to CSV
   └─ Verify columns

7. Eligibility Checking
   └─ Enter client values (debt: £51k, income: £70)
   └─ Get eligibility result
   └─ Show reasoning trail
   └─ Verify path shown in graph

8. Documentation
   └─ Verify all guides are readable
   └─ Verify code examples run
```

## Performance Testing

### Measure Graph Building Speed

```python
import time
from graph_builder import GraphBuilder

# Create 10 sample chunks
sample_chunks = [
    {
        "text": f"Sample rule {i}: Some condition must be met.",
        "chunk_id": f"chunk_{i}"
    }
    for i in range(10)
]

builder = GraphBuilder(llm_provider=None)

# Time entity extraction (mock)
start = time.time()
# entities = await builder.extract_entities(...)
elapsed = time.time() - start
print(f"Entity extraction: {elapsed:.2f}s")

# Time graph building
start = time.time()
# graph = await builder.build_graph(sample_chunks, ["test.pdf"])
elapsed = time.time() - start
print(f"Full graph build: {elapsed:.2f}s")
```

### Measure Rendering Speed

```typescript
// Add performance measurement in DebtAdviceGraph.tsx

const renderGraphVisualization = () => {
  const startTime = performance.now()
  
  // ... existing rendering code ...
  
  const endTime = performance.now()
  console.log(`Graph render time: ${(endTime - startTime).toFixed(2)}ms`)
}
```

## Load Testing

### Test with Large Graphs

```python
# Create a graph with 1000+ entities
def create_large_test_graph():
    graph = DebtAdviceGraph(
        id="large_test_graph",
        source_documents=["test.pdf"]
    )
    
    # Add 1000 entities
    for i in range(1000):
        entity = Entity(
            id=f"ent_{i:04d}",
            type=EntityType.CONDITION if i % 3 == 0 else EntityType.OUTCOME,
            label=f"Entity {i}",
            properties={"index": i},
            source="test.pdf",
            source_chunk_id=f"chunk_{i // 10}",
            confidence=0.85 + (i % 15) / 100
        )
        graph.add_entity(entity)
    
    # Add 1500 relations
    for i in range(1500):
        source_idx = i % 1000
        target_idx = (i + 1 + (i // 3)) % 1000
        
        rel = Relation(
            id=f"rel_{i:04d}",
            type=RelationType.IMPLIES if i % 2 == 0 else RelationType.LEADS_TO,
            source_entity_id=f"ent_{source_idx:04d}",
            target_entity_id=f"ent_{target_idx:04d}",
            confidence=0.80 + (i % 20) / 100
        )
        graph.add_relation(rel)
    
    return graph

# Measure performance
import time

start = time.time()
graph = create_large_test_graph()
build_time = time.time() - start

start = time.time()
paths = graph.find_paths("ent_0000")
path_time = time.time() - start

start = time.time()
graph_dict = graph.to_dict()
dict_time = time.time() - start

print(f"Build time: {build_time:.2f}s")
print(f"Path finding: {path_time:.2f}s")
print(f"Serialization: {dict_time:.2f}s")

# Expected:
# Build time: <2s
# Path finding: <1s
# Serialization: <0.5s
```

## Browser DevTools Testing

### Check Network Requests

1. Open DevTools (F12)
2. Go to "Network" tab
3. Filter to "Fetch/XHR"
4. Navigate to Graph View
5. Look for requests to `/api/graph/...`
6. Check response payloads are valid JSON
7. Check response times < 500ms

### Check Console for Errors

1. Open DevTools Console tab
2. Should see no errors
3. May see warnings (acceptable)
4. Click through all tabs
5. Interact with filters
6. Verify no errors appear

## Validation Checklist

### Code Quality

- [ ] TypeScript compiles without errors
- [ ] Python syntax valid (py_compile)
- [ ] No unused imports
- [ ] No console.log statements left in
- [ ] Proper error handling

### Functionality

- [ ] Graph visualization renders
- [ ] Filters update visualization
- [ ] Export to JSON produces valid JSON
- [ ] Export to CSV produces valid CSV
- [ ] Entity details panel works
- [ ] Relation details panel works
- [ ] Full-screen mode works
- [ ] Refresh button reloads graph

### Performance

- [ ] Graph build < 2 seconds
- [ ] SVG rendering < 500ms
- [ ] Path finding < 1 second
- [ ] Export < 500ms
- [ ] UI responsive (no jank)

### Documentation

- [ ] All guides readable
- [ ] All code examples valid
- [ ] API documentation complete
- [ ] Architecture diagrams clear
- [ ] Examples runnable

## Debugging Guide

### Frontend Issues

**Problem**: Graph view shows loading spinner forever
- **Check**: Is backend running? (`curl http://localhost:8102/health`)
- **Check**: Are CORS enabled?
- **Check**: Does `/api/graph/sample_dro_manual` exist?
- **Fix**: Check browser console for error messages

**Problem**: Visualization doesn't show nodes
- **Check**: Does graph have entities? (Check Network response)
- **Check**: Is SVG canvas visible? (Inspect element)
- **Check**: Are there rendering errors? (Console tab)
- **Fix**: Verify `renderGraphVisualization()` function

**Problem**: Filters don't work
- **Check**: Are entity types populated? (Check select options)
- **Check**: Is useEffect running? (Add console.log)
- **Fix**: Verify filter state updates

### Backend Issues

**Problem**: /api/graph/build returns 500 error
- **Check**: Are imports working? (`python -c "from graph_builder import *"`)
- **Check**: Is LLM provider initialized?
- **Check**: Check server logs for error
- **Fix**: Enable debug logging

**Problem**: Graph structure invalid
- **Check**: Do entities have all required fields?
- **Check**: Are relation IDs valid?
- **Check**: Is JSON valid? (`json.dumps()` then `json.loads()`)
- **Fix**: Use `DebtAdviceGraph.to_dict()` to validate structure

## Success Criteria

✅ Frontend compiles without TypeScript errors  
✅ Backend compiles without Python errors  
✅ Graph View tab visible in dashboard  
✅ Graph visualization renders (SVG)  
✅ Filters update visualization  
✅ Entity/relation details show on click  
✅ Export to JSON/CSV works  
✅ No console errors when navigating  
✅ Performance metrics acceptable  
✅ All documentation readable  

## Next Steps After Testing

1. **If tests pass**:
   - Implement storage layer (Phase 3)
   - Integrate LLM (Phase 4)
   - Test eligibility integration

2. **If tests fail**:
   - Check error messages in console/logs
   - See Debugging Guide above
   - Verify file paths and imports
   - Check CORS and API configuration

3. **Performance optimization**:
   - If rendering slow, use D3.js instead of SVG
   - If queries slow, migrate to Neo4j
   - If export slow, stream to file

## Questions?

Refer to:
- **GRAPH_VIEW_QUICK_START.md** - User guide
- **GRAPH_IMPLEMENTATION_GUIDE.md** - Technical details
- **GRAPH_EXAMPLES.md** - Sample data
- **DEBT_ADVICE_GRAPH_SYSTEM.md** - Architecture

Happy testing! 🚀
