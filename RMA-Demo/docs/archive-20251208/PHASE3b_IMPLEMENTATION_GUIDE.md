# Phase 3b: Integration & Testing

**Status:** ⏳ **READY TO START**  
**Duration:** 1-2 hours  
**Date:** November 4, 2025  
**Objective:** Install dependencies, test components, integrate with NER service, validate performance

---

## 🎯 Phase 3b Overview

Phase 3b bridges the gap between Phase 3a (component creation) and Phase 3c (dashboard integration). This phase focuses on:

1. **Installation** - Install D3.js and dependencies
2. **Component Testing** - Verify components render correctly
3. **Mock Data Integration** - Test with realistic test data
4. **NER Service Connection** - Connect to live backend
5. **End-to-End Testing** - Full workflow validation
6. **Performance Validation** - Ensure targets are met

**Expected Timeline:**
- Installation: 10 minutes
- Component testing: 20 minutes
- Mock data integration: 20 minutes
- NER service connection: 15 minutes
- Performance validation: 15 minutes
- **Total: 1-1.5 hours**

---

## 📋 Phase 3b Task Breakdown

### Task 1: Dependency Installation (10 minutes)

**Goal:** Install D3.js and all dependencies

**Steps:**

```bash
# Navigate to frontend directory
cd c:\Users\st7ma\Documents\CMACatalyst\RMA-Demo\frontend

# Install all dependencies (including D3.js)
npm install

# Verify installation
npm list d3
npm list @types/d3
```

**Expected Output:**
```
npm notice: Packages installed
d3@7.8.5
@types/d3@7.4.0
```

**Success Criteria:**
- ✅ npm install completes without errors
- ✅ D3.js and @types/d3 are installed
- ✅ node_modules directory is created
- ✅ package-lock.json is generated

**Troubleshooting:**
- If npm not found: Install Node.js from nodejs.org
- If permission error: Try `npm install --legacy-peer-deps`
- If disk space error: Clean cache with `npm cache clean --force`

---

### Task 2: Development Server Startup (5 minutes)

**Goal:** Start the development server and verify it works

**Steps:**

```bash
# From frontend directory
npm run dev

# Server should start on port 3000
# Output should show:
# ▲ Next.js 14.1.0
# - Local: http://localhost:3000
```

**Expected Output:**
```
▲ Next.js 14.1.0
- Local: http://localhost:3000
- Environments: .env.local

✓ Ready in 5.2s
```

**Success Criteria:**
- ✅ Server starts without errors
- ✅ Listening on http://localhost:3000
- ✅ No TypeScript compilation errors
- ✅ Hot reload is enabled

**Next Step:** Open browser to http://localhost:3000

---

### Task 3: Create Test Pages

**Goal:** Create test pages to display and test components

**File: `frontend/app/graphs/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { 
  GraphViewer, 
  EntitySearch, 
  TemporalSelector,
  ApplicableRulesList 
} from '@/components/graphs';

export default function GraphsTestPage() {
  const [selectedEntity, setSelectedEntity] = useState(null);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Graph Components Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Entity Search Test</h2>
        <EntitySearch
          graphId="test-graph"
          onResultSelect={setSelectedEntity}
          placeholder="Search test entities..."
        />
        {selectedEntity && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0' }}>
            <p>Selected: {selectedEntity.text}</p>
            <p>Type: {selectedEntity.entity_type}</p>
            <p>Confidence: {(selectedEntity.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Temporal Selector Test</h2>
        <TemporalSelector
          graphId="test-graph"
          onDateChange={(date) => console.log('Date changed:', date)}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Graph Viewer Test</h2>
        <p>GraphViewer will display when mock data is provided</p>
      </div>
    </div>
  );
}
```

**File: `frontend/app/comparison/page.tsx`**

```typescript
'use client';

import { DualGraphComparison } from '@/components/graphs';

export default function ComparisonPage() {
  return (
    <div style={{ padding: '20px', height: '100vh' }}>
      <h1>Dual Graph Comparison Test</h1>
      <DualGraphComparison
        manualGraphId="test-manual"
        clientGraphId="test-client"
      />
    </div>
  );
}
```

**Success Criteria:**
- ✅ Pages created in correct locations
- ✅ Components import without errors
- ✅ Pages load in browser
- ✅ No TypeScript errors

---

### Task 4: Create Mock Data

**Goal:** Create realistic test data for component testing

**File: `frontend/lib/mockData.ts`**

```typescript
import {
  DocumentGraph,
  Entity,
  Relationship,
  ApplicableRule,
  GraphComparison,
} from '@/types/graph.types';

export const mockEntities: Entity[] = [
  {
    id: 'ent-1',
    text: 'Debt Relief Order',
    entity_type: 'DEBT_TYPE',
    confidence: 0.98,
    source: 'manual-1',
  },
  {
    id: 'ent-2',
    text: 'Credit Union',
    entity_type: 'CREDITOR',
    confidence: 0.92,
    source: 'manual-1',
  },
  {
    id: 'ent-3',
    text: '£15,000',
    entity_type: 'MONEY_THRESHOLD',
    confidence: 0.99,
    source: 'manual-1',
  },
  {
    id: 'ent-4',
    text: 'Interest Rate',
    entity_type: 'REPAYMENT_TERM',
    confidence: 0.87,
    source: 'manual-1',
  },
  {
    id: 'ent-5',
    text: '12 months',
    entity_type: 'DURATION',
    confidence: 0.95,
    source: 'manual-1',
  },
  {
    id: 'ent-6',
    text: 'AND Logic Gate',
    entity_type: 'GATE',
    confidence: 0.99,
    source: 'manual-1',
  },
];

export const mockRelationships: Relationship[] = [
  {
    entity1: 'ent-1',
    entity2: 'ent-2',
    type: 'APPLICABLE_TO',
    confidence: 0.91,
    label: 'DRO applies to credit unions',
  },
  {
    entity1: 'ent-2',
    entity2: 'ent-3',
    type: 'HAS_GATE',
    confidence: 0.88,
    condition: 'debt_amount < 15000',
  },
  {
    entity1: 'ent-3',
    entity2: 'ent-4',
    type: 'TRIGGERS',
    confidence: 0.85,
    label: 'Threshold triggers repayment terms',
  },
  {
    entity1: 'ent-4',
    entity2: 'ent-5',
    type: 'REQUIRES',
    confidence: 0.92,
    label: 'Repayment term requires duration',
  },
  {
    entity1: 'ent-6',
    entity2: 'ent-1',
    type: 'ENABLES',
    confidence: 0.89,
    condition: 'gate_status = true',
  },
];

export const mockManualGraph: DocumentGraph = {
  graph_id: 'g-manual-test',
  document_id: 'doc-manual',
  entities: mockEntities,
  relationships: mockRelationships,
  created_at: new Date().toISOString(),
  statistics: {
    entity_count: mockEntities.length,
    relationship_count: mockRelationships.length,
    average_confidence: 0.92,
    entity_types: {
      DEBT_TYPE: 1,
      CREDITOR: 1,
      MONEY_THRESHOLD: 1,
      REPAYMENT_TERM: 1,
      DURATION: 1,
      GATE: 1,
    },
  },
};

export const mockApplicableRules: ApplicableRule[] = [
  {
    rule_id: 'rule-1',
    rule_text: 'A Debt Relief Order applies when total debt is below £15,000',
    reasoning: 'This matches the client situation where total debt is £12,500',
    confidence: 0.95,
    matched_entities: [
      {
        client_entity_id: 'client-debt-total',
        manual_entity_id: 'ent-3',
        match_type: 'SEMANTIC',
      },
    ],
    temporal_status: 'ACTIVE',
    temporal_metadata: {
      effective_date: '2020-06-01',
      expiry_date: '2030-12-31',
      as_of_date: new Date().toISOString().split('T')[0],
    },
    gates: [
      {
        gate_type: 'AND',
        condition: 'debt < 15000 AND residence = UK',
        satisfied: true,
      },
    ],
  },
  {
    rule_id: 'rule-2',
    rule_text: 'Creditor must be notified within 3 days',
    reasoning: 'Standard procedure for DRO applications',
    confidence: 0.88,
    matched_entities: [
      {
        client_entity_id: 'client-creditor',
        manual_entity_id: 'ent-2',
        match_type: 'EXACT',
      },
    ],
    temporal_status: 'ACTIVE',
    gates: [],
  },
];

export const mockGraphComparison: GraphComparison = {
  manual_graph_id: 'g-manual-test',
  client_graph_id: 'g-client-test',
  applicable_rules: mockApplicableRules,
  gaps: [
    'Employment status not provided',
    'Monthly income not provided',
    'List of all creditors not complete',
  ],
  matches: [
    {
      manual_entity_id: 'ent-1',
      client_entity_id: 'client-debt-relief',
      similarity_score: 0.98,
    },
    {
      manual_entity_id: 'ent-2',
      client_entity_id: 'client-creditor',
      similarity_score: 0.92,
    },
    {
      manual_entity_id: 'ent-3',
      client_entity_id: 'client-debt-total',
      similarity_score: 0.89,
    },
  ],
  comparison_timestamp: new Date().toISOString(),
};
```

**Success Criteria:**
- ✅ Mock data file created
- ✅ Exports all needed mock data
- ✅ Type-safe with TypeScript
- ✅ Realistic DRO scenario

---

### Task 5: Test Components with Mock Data

**Goal:** Verify components render correctly with mock data

**Update: `frontend/app/graphs/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { 
  GraphViewer, 
  EntitySearch, 
  ApplicableRulesList 
} from '@/components/graphs';
import { mockManualGraph, mockApplicableRules } from '@/lib/mockData';

export default function GraphsTestPage() {
  const [selectedEntity, setSelectedEntity] = useState(null);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Graph Components Test with Mock Data</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h2>GraphViewer Component</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }}>
            <p>Graph ID: {mockManualGraph.graph_id}</p>
            <p>Entities: {mockManualGraph.entities.length}</p>
            <p>Relationships: {mockManualGraph.relationships.length}</p>
            <p>Avg Confidence: {mockManualGraph.statistics?.average_confidence}</p>
          </div>
        </div>

        <div>
          <h2>ApplicableRulesList Component</h2>
          <ApplicableRulesList
            rules={mockApplicableRules}
            sortBy="confidence"
            maxHeight="300px"
          />
        </div>
      </div>
    </div>
  );
}
```

**Testing Checklist:**
- [ ] Page loads without errors
- [ ] Mock data displays correctly
- [ ] No console errors
- [ ] Components render
- [ ] Interactions work (expand, click, etc.)

---

### Task 6: Environment Configuration

**Goal:** Configure NER service connection

**File: `frontend/.env.local`**

```env
# NER Graph Service
NEXT_PUBLIC_NER_SERVICE_URL=http://localhost:8108

# Optional: Other services
NEXT_PUBLIC_RAG_SERVICE_URL=http://localhost:8102
NEXT_PUBLIC_VLLM_URL=http://localhost:8000

# Optional: Debug mode
NEXT_PUBLIC_GRAPH_DEBUG=false
```

**Success Criteria:**
- ✅ File created at correct location
- ✅ Variables match service ports
- ✅ Next.js reads environment variables

---

### Task 7: Test NER Service Connection

**Goal:** Verify connection to live NER service

**Steps:**

```bash
# In browser console (F12), run:
import { graphService } from '@/services/graphService';

// Test health check
const health = await graphService.healthCheck();
console.log('NER Service Health:', health);

// If service is running, should return: true
```

**Verification:**
- ✅ Health check returns true
- ✅ No CORS errors
- ✅ No connection errors
- ✅ Service is reachable

**If Health Check Fails:**

Check that NER service is running:

```bash
# Terminal 1: Start NER service (from RMA-Demo directory)
cd services/ner-graph-service
python -m uvicorn app:app --port 8108

# Terminal 2: Frontend dev server continues
npm run dev
```

---

### Task 8: End-to-End Testing

**Goal:** Test complete workflows

**Test 1: Entity Search**

```typescript
// In browser console
import { graphService } from '@/services/graphService';

const results = await graphService.searchEntities(
  'g-manual',
  'DRO',
  ['RULE', 'OBLIGATION'],
  50
);

console.log('Search results:', results);
// Should show entity search results
```

**Test 2: Graph Comparison**

```typescript
const comparison = await graphService.compareGraphs(
  'g-manual',
  'g-client-123'
);

console.log('Comparison:', comparison);
// Should show applicable rules and gaps
```

**Test 3: Temporal Filtering**

```typescript
const filtered = await graphService.filterGraphByDate(
  'g-manual',
  new Date('2025-01-15')
);

console.log('Filtered graph:', filtered);
// Should show rules valid on that date
```

**Test 4: Full Component Workflow**

1. Open DualGraphComparison component
2. Verify both graphs load
3. Check applicable rules display
4. Test entity search
5. Test date filtering
6. Verify highlighting works

---

### Task 9: Performance Validation

**Goal:** Ensure performance targets are met

**Browser DevTools Performance Testing:**

```javascript
// 1. Graph Render Time
console.time('GraphRender');
// (render graph)
console.timeEnd('GraphRender');
// Target: <1000ms

// 2. Search Results Time
console.time('SearchResults');
// (perform search)
console.timeEnd('SearchResults');
// Target: <200ms

// 3. Memory Usage
console.log(performance.memory);
// Check heapUsedSize
// Target: <50MB per graph
```

**Expected Performance:**
- ✅ Graph render: <1 second
- ✅ Search results: <200ms
- ✅ Memory per graph: <50MB
- ✅ Interactions: <100ms
- ✅ Responsive: <16ms (60fps)

**If Performance is Slow:**

1. Check graph size (number of nodes/edges)
2. Open DevTools Performance tab
3. Record while rendering
4. Look for long tasks
5. Identify bottlenecks
6. Optimize (consider canvas rendering for 1000+ nodes)

---

### Task 10: Responsive Design Testing

**Goal:** Verify responsive design works

**Test Breakpoints:**

```javascript
// Mobile: 375px
window.resizeTo(375, 667);

// Tablet: 768px
window.resizeTo(768, 1024);

// Desktop: 1920px
window.resizeTo(1920, 1080);
```

**Checklist:**
- [ ] Mobile: Single column, readable text
- [ ] Tablet: Two columns, touch-friendly
- [ ] Desktop: Three columns, full features
- [ ] No horizontal scrolling
- [ ] All buttons clickable
- [ ] Text readable at all sizes
- [ ] Images scale properly

---

## 📊 Phase 3b Testing Checklist

**Installation & Setup**
- [ ] npm install completes successfully
- [ ] D3.js installed (npm list d3)
- [ ] Development server starts
- [ ] No compilation errors
- [ ] Hot reload working

**Component Testing**
- [ ] Test pages created
- [ ] Components render without errors
- [ ] Mock data displays correctly
- [ ] No console errors or warnings

**Mock Data Integration**
- [ ] Mock data file created
- [ ] Data types match interfaces
- [ ] All components accept mock data
- [ ] Components display mock data correctly

**NER Service Connection**
- [ ] .env.local configured
- [ ] Health check passes
- [ ] API calls successful
- [ ] Error handling works

**End-to-End Testing**
- [ ] Entity search works
- [ ] Graph comparison works
- [ ] Temporal filtering works
- [ ] Full workflow completes

**Performance Validation**
- [ ] Graph render <1s
- [ ] Search <200ms
- [ ] Memory <50MB
- [ ] 60fps interactions

**Responsive Design**
- [ ] Mobile layout correct
- [ ] Tablet layout correct
- [ ] Desktop layout correct
- [ ] All sizes readable

---

## 🚀 Phase 3b Success Criteria

Phase 3b is complete when:

✅ npm install completed successfully  
✅ Development server runs without errors  
✅ Test pages created and displaying components  
✅ Mock data integrated and displaying  
✅ NER service health check passes  
✅ End-to-end workflows validated  
✅ Performance targets met  
✅ Responsive design verified  

---

## ⏱️ Phase 3b Timeline

| Step | Time | Status |
|------|------|--------|
| Installation | 10 min | ⏳ |
| Dev server startup | 5 min | ⏳ |
| Create test pages | 10 min | ⏳ |
| Create mock data | 10 min | ⏳ |
| Component testing | 15 min | ⏳ |
| NER connection | 10 min | ⏳ |
| E2E testing | 15 min | ⏳ |
| Performance check | 10 min | ⏳ |
| Responsive testing | 10 min | ⏳ |
| **Total** | **~85 min** | **⏳ IN PROGRESS** |

---

## 🎯 Next Phase (Phase 3c)

After Phase 3b passes all criteria:

**Phase 3c: Dashboard Integration**
- Create AdvisorGraphInsights component
- Integrate with advisor dashboard
- Add graph visualization to query results
- End-to-end dashboard testing
- Docker deployment

**Estimated Duration:** 1-2 hours

---

**Phase 3b Status:** ⏳ **READY TO START**  
**Next Command:** `cd frontend && npm install && npm run dev`

