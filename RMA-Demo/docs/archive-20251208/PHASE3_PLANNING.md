# Phase 3 Planning: Frontend Graph Visualization

**Status:** 📋 PLANNED  
**Estimated Duration:** 2-3 hours  
**Start Trigger:** After Phase 2 validation ✅ (READY NOW)  

---

## Phase 3 Objectives

### Primary Goal
Build interactive React components to visualize knowledge graphs extracted by NER service, enabling advisor to:
1. See manual knowledge base as interactive graph
2. Compare manual rules against client situation
3. Search for relevant entities and relationships
4. Understand temporal applicability of rules

### Success Metrics
- Graph renders in <1 second
- 100+ nodes renders smoothly
- Entity search returns results <200ms
- Relationship paths highlighted clearly
- Responsive design (mobile, tablet, desktop)

---

## Architecture

### Component Hierarchy

```
Dashboard
├─ GraphViewer
│  ├─ ManualGraphPanel (read-only)
│  │  ├─ NodeRenderer
│  │  ├─ EdgeRenderer
│  │  └─ LegendPanel
│  │
│  ├─ ClientGraphPanel (read-only for now)
│  │  ├─ NodeRenderer
│  │  ├─ EdgeRenderer
│  │  └─ ComparisonHighlight
│  │
│  └─ ControlPanel
│     ├─ EntityTypeFilter
│     ├─ ConfidenceSlider
│     ├─ TemporalSelector
│     └─ SearchBar

├─ DualGraphComparison (Side-by-side view)
│  ├─ ManualGraphView
│  ├─ ClientGraphView
│  ├─ ApplicableRulesPanel
│  └─ GapsPanel

└─ AdvisorGraphInsights (In query results)
   ├─ ApplicableRulesList
   ├─ ReasoningChainVisualizer
   └─ ConfidenceIndicator
```

### Data Flow

```
Neo4j (Graph DB)
    ↓
NER Service (/graph/{id})
    ├→ Nodes (entities)
    └→ Edges (relationships)
        ↓
Frontend (React)
    ├→ D3.js / vis.js Layout Engine
    ├→ SVG/Canvas Rendering
    ├→ Interaction Handlers
    └→ Filter & Search Logic
```

---

## Component Specifications

### 1. GraphViewer Component (300+ lines)

**Purpose:** Main visualization of single graph

**Props:**
```typescript
interface GraphViewerProps {
  graphId: string;
  graphType: 'manual' | 'client';
  title: string;
  editable?: boolean;
  onNodeClick?: (entity: Entity) => void;
  onEdgeClick?: (relationship: Relationship) => void;
}
```

**Features:**
- Force-directed layout (physics simulation)
- Node color by entity type
- Edge thickness by confidence score
- Hover tooltip showing entity details
- Click to expand relationships
- Zoom and pan controls
- Legend showing entity types

**Implementation:**
```typescript
const GraphViewer: React.FC<GraphViewerProps> = ({
  graphId,
  graphType,
  title,
  editable = false,
  onNodeClick,
  onEdgeClick
}) => {
  const [nodes, setNodes] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Fetch graph from NER service
    fetchGraph(graphId).then(data => {
      setNodes(data.entities);
      setEdges(data.relationships);
      setLoading(false);
      renderGraph();
    });
  }, [graphId]);

  const renderGraph = () => {
    // Use D3.js simulation
    // Position nodes based on relationships
    // Render to SVG
  };

  return (
    <div className="graph-viewer">
      <h3>{title}</h3>
      <svg ref={svgRef} className="graph-canvas" />
      <GraphLegend entityTypes={getEntityTypes(nodes)} />
    </div>
  );
};
```

**Style Considerations:**
- Entity nodes: Color by type (RULE=red, GATE=blue, MONEY_THRESHOLD=green, etc.)
- Relationship edges: Thickness = confidence (0.5-3px)
- Temporal validity: Dashed line if expired, solid if active
- Conditional relationships: Labeled with logic gate

### 2. DualGraphComparison Component (250+ lines)

**Purpose:** Side-by-side manual vs client graph with applicability highlighting

**Props:**
```typescript
interface DualGraphComparisonProps {
  manualGraphId: string;
  clientGraphId: string;
  onApplicableRuleSelect?: (rule: ApplicableRule) => void;
}
```

**Features:**
- Two GraphViewers side-by-side
- Highlighting shows matching entities
- ApplicableRulesList shows rules that apply to client
- GapsPanel shows missing client attributes needed for rules
- Filter by entity type to reduce noise

**Implementation:**
```typescript
const DualGraphComparison: React.FC<DualGraphComparisonProps> = ({
  manualGraphId,
  clientGraphId,
  onApplicableRuleSelect
}) => {
  const [applicableRules, setApplicableRules] = useState<ApplicableRule[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);

  useEffect(() => {
    // Call NER service /graph/compare endpoint
    compareGraphs(manualGraphId, clientGraphId).then(data => {
      setApplicableRules(data.applicable_rules);
      setGaps(data.gaps);
    });
  }, [manualGraphId, clientGraphId]);

  return (
    <div className="dual-comparison">
      <div className="manual-side">
        <GraphViewer
          graphId={manualGraphId}
          graphType="manual"
          title="Knowledge Base (Manual Rules)"
        />
      </div>
      <div className="highlights">
        <ApplicableRulesList
          rules={applicableRules}
          onRuleClick={onApplicableRuleSelect}
        />
        <GapsPanel gaps={gaps} />
      </div>
      <div className="client-side">
        <GraphViewer
          graphId={clientGraphId}
          graphType="client"
          title="Client Situation"
        />
      </div>
    </div>
  );
};
```

### 3. EntitySearch Component (150+ lines)

**Purpose:** Search and filter entities within a graph

**Props:**
```typescript
interface EntitySearchProps {
  graphId: string;
  onResultSelect?: (entity: Entity) => void;
  entityTypeFilter?: EntityType[];
}
```

**Features:**
- Real-time search as user types
- Filter by entity type
- Highlight matches in graph
- Show related entities
- Confidence score display

**Implementation:**
```typescript
const EntitySearch: React.FC<EntitySearchProps> = ({
  graphId,
  onResultSelect,
  entityTypeFilter
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);

  useEffect(() => {
    if (query.length > 2) {
      // Call NER service /graph/{id}/search endpoint
      searchGraph(graphId, query, entityTypeFilter).then(data => {
        setResults(data.results);
      });
    }
  }, [query, entityTypeFilter]);

  return (
    <div className="entity-search">
      <input
        type="text"
        placeholder="Search entities..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="results">
        {results.map(entity => (
          <li key={entity.id} onClick={() => onResultSelect?.(entity)}>
            <span className={`badge ${entity.entity_type}`}>
              {entity.entity_type}
            </span>
            <span className="text">{entity.text}</span>
            <span className="confidence">
              {(entity.confidence * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### 4. TemporalSelector Component (100+ lines)

**Purpose:** Filter relationships by temporal validity

**Props:**
```typescript
interface TemporalSelectorProps {
  graphId: string;
  onDateChange?: (date: Date) => void;
}
```

**Features:**
- Date picker
- Show only rules effective on selected date
- Highlight expired vs active relationships
- Historical view mode

**Implementation:**
```typescript
const TemporalSelector: React.FC<TemporalSelectorProps> = ({
  graphId,
  onDateChange
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    onDateChange?.(date);
    // Filter graph relationships by effective/expiry dates
  };

  return (
    <div className="temporal-selector">
      <label>Effective As Of:</label>
      <input
        type="date"
        value={selectedDate.toISOString().split('T')[0]}
        onChange={(e) => handleDateChange(new Date(e.target.value))}
      />
      <div className="info">
        {/* Show which rules are active/inactive on this date */}
      </div>
    </div>
  );
};
```

### 5. ApplicableRulesList Component (150+ lines)

**Purpose:** Display rules from manual graph that apply to client

**Props:**
```typescript
interface ApplicableRulesListProps {
  rules: ApplicableRule[];
  onRuleClick?: (rule: ApplicableRule) => void;
}
```

**Features:**
- Sort by confidence
- Show reasoning explanation
- Highlight temporal validity
- Click to highlight in graph
- Expandable details

---

## Visualization Libraries

### Option 1: D3.js (Recommended)
**Pros:**
- Fine-grained control
- Powerful force simulation
- Large ecosystem of examples
- Good for complex graphs

**Cons:**
- Steep learning curve
- More code required

**Dependencies:**
```json
{
  "d3": "^7.8.5",
  "@types/d3": "^7.4.0"
}
```

### Option 2: vis.js
**Pros:**
- Easier learning curve
- Good default layouts
- Physics simulation included
- Interactive by default

**Cons:**
- Less customizable
- Larger bundle size

**Dependencies:**
```json
{
  "vis-network": "^9.1.8",
  "vis-data": "^7.1.0"
}
```

### Option 3: Cytoscape.js
**Pros:**
- Excellent for biological/knowledge graphs
- Rich styling system
- Good for complex layouts

**Cons:**
- Specialized use case
- Learning curve

**Recommendation:** **D3.js** for maximum control and best performance with 100+ nodes

---

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── graphs/
│   │   │   ├── GraphViewer.tsx (300 lines)
│   │   │   ├── DualGraphComparison.tsx (250 lines)
│   │   │   ├── EntitySearch.tsx (150 lines)
│   │   │   ├── TemporalSelector.tsx (100 lines)
│   │   │   ├── ApplicableRulesList.tsx (150 lines)
│   │   │   ├── GraphLegend.tsx (80 lines)
│   │   │   └── index.ts
│   │   │
│   │   └── advisor/
│   │       ├── AdvisorGraphInsights.tsx (200 lines)
│   │       └── ReasoningChainVisualizer.tsx (150 lines)
│   │
│   ├── hooks/
│   │   ├── useGraphData.ts (100 lines)
│   │   ├── useDualGraph.ts (100 lines)
│   │   └── useD3Graph.ts (150 lines)
│   │
│   ├── types/
│   │   └── graph.types.ts (50 lines)
│   │
│   ├── styles/
│   │   └── graphs.css (400 lines)
│   │
│   └── services/
│       └── graphService.ts (150 lines) - API client
```

---

## API Endpoints Used

### From NER Service

1. **GET /health**
   - Verify service availability

2. **GET /graph/{graph_id}**
   - Retrieve full graph (nodes + edges)

3. **POST /graph/{graph_id}/search**
   - Search entities by keyword
   - Query: { query, entity_types, limit }

4. **POST /graph/compare**
   - Compare two graphs
   - Body: { graph1_id, graph2_id }

5. **POST /reasoning/chain**
   - Generate reasoning between entities
   - Body: { graph_id, start_entity_id, end_entity_id }

---

## Implementation Timeline

### Hour 1: Component Foundation
- [ ] Setup D3.js and types
- [ ] Create GraphViewer component (basic rendering)
- [ ] Create EntitySearch component
- [ ] Create GraphLegend component
- [ ] Setup graph data types

### Hour 2: Dual-Graph Features
- [ ] Create DualGraphComparison component
- [ ] Create ApplicableRulesList component
- [ ] Create TemporalSelector component
- [ ] Implement filtering logic

### Hour 3: Integration & Polish
- [ ] Create AdvisorGraphInsights component
- [ ] Integrate with dashboard
- [ ] Add hover/click interactions
- [ ] Responsive design
- [ ] Performance optimization
- [ ] Testing

---

## Styling Strategy

### Design System
```css
/* Entity Type Colors */
--color-rule: #E74C3C (red)
--color-gate: #3498DB (blue)
--color-threshold: #2ECC71 (green)
--color-obligation: #F39C12 (orange)
--color-creditor: #9B59B6 (purple)

/* Confidence Scale */
0.0-0.5: opacity 30%, dashed edge
0.5-0.8: opacity 70%, solid edge
0.8-1.0: opacity 100%, thick edge

/* Temporal Status */
Active: solid line
Expired: dashed line with strikethrough
Future: dotted line

/* Responsive */
Mobile: single column, smaller nodes
Tablet: two columns side-by-side
Desktop: full dual comparison
```

---

## Performance Considerations

### Optimization Strategies

1. **Graph Rendering**
   - Use canvas instead of SVG for 1000+ nodes
   - Implement viewport culling (only render visible nodes)
   - Lazy load relationships

2. **Search**
   - Debounce search input (300ms)
   - Client-side filtering for <1000 results
   - Server-side filtering for larger graphs

3. **Memory**
   - Unload graphs when not visible
   - Memoize component renders
   - Use React.lazy for large components

### Performance Targets
- Graph render: <1 second
- Search results: <200ms
- Comparison: <2 seconds
- Memory: <50MB per graph

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
```typescript
describe('GraphViewer', () => {
  test('renders graph with correct nodes', () => {});
  test('handles empty graph', () => {});
  test('responds to node click', () => {});
});

describe('EntitySearch', () => {
  test('searches entities by keyword', () => {});
  test('filters by entity type', () => {});
  test('shows confidence score', () => {});
});
```

### Integration Tests
```typescript
describe('DualGraphComparison', () => {
  test('loads both graphs', () => {});
  test('shows applicable rules', () => {});
  test('highlights matching entities', () => {});
});
```

### E2E Tests (Cypress)
```typescript
describe('Graph visualization workflow', () => {
  test('user can view manual graph', () => {});
  test('user can compare graphs', () => {});
  test('user can search entities', () => {});
});
```

---

## Success Criteria

✅ **Phase 3 Complete When:**
- [ ] GraphViewer renders all graph types correctly
- [ ] DualGraphComparison shows applicable rules
- [ ] EntitySearch returns results <200ms
- [ ] Temporal filtering works correctly
- [ ] Components integrate with dashboard
- [ ] Responsive design tested on all devices
- [ ] Performance targets met (render <1s)
- [ ] Unit test coverage >80%

---

## Dependencies to Add

```json
{
  "d3": "^7.8.5",
  "@types/d3": "^7.4.0",
  "react-d3-library": "^1.0.0" (if using wrapper),
  "axios": "^1.6.0" (for API calls)
}
```

---

## Known Challenges & Mitigations

### Challenge 1: Large Graph Rendering (1000+ nodes)
**Mitigation:** Use canvas + viewport culling, hierarchical layout

### Challenge 2: Real-time Filtering Performance
**Mitigation:** Debounce input, memoize computations

### Challenge 3: Responsive Design Complexity
**Mitigation:** Mobile-first approach, test on multiple devices

### Challenge 4: Semantic Clarity
**Mitigation:** Clear legends, hover tooltips, entity details panel

---

## Next Phase Preview (Phase 4)

After Phase 3 visualization is complete, Phase 4 will:
1. **Query Integration**: Show applicable rules in advisor query results
2. **Reasoning Chains**: Visualize logical paths supporting advice
3. **Temporal Logic**: Apply temporal gates in formal reasoning
4. **Advice Formalization**: Generate formal debt advice with graph citations

**Phase 4 Effort:** 2-3 hours

---

## Quick Start for Phase 3

```bash
# 1. Install dependencies
npm install d3 @types/d3 axios

# 2. Create component files
touch frontend/src/components/graphs/GraphViewer.tsx
touch frontend/src/components/graphs/DualGraphComparison.tsx
# ... other components

# 3. Start with GraphViewer component
# Implement basic D3 force simulation

# 4. Test with sample graph data
# Mock graph data from Phase 1

# 5. Integrate with dashboard progressively

# 6. Test with live NER service
npm run dev
```

---

## Phase 3 Ready! 🚀

All prerequisites complete:
- ✅ Phase 1: NER service operational
- ✅ Phase 2: Graph integration with RAG
- ✅ APIs ready: /graph, /search, /compare
- ✅ Neo4j with data available
- ✅ Design system specified

**Start Phase 3 immediately after Phase 2 validation.**

---

**Status:** 📋 READY TO START
**Estimated Completion:** +2-3 hours
**Next Session:** Frontend graph components
