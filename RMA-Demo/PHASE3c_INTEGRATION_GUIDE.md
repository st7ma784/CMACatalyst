# Phase 3c: Dashboard Integration

**Status:** 📋 **PLANNED**  
**Duration:** 1-2 hours  
**Date:** November 4, 2025  
**Objective:** Integrate graph components into advisor dashboard, enable graph visualization in query results

---

## 🎯 Phase 3c Overview

Phase 3c builds on Phase 3b by integrating the graph visualization components into the main advisor dashboard. This phase makes graphs visible and interactive to end users through the advisory interface.

**Key Activities:**
1. Create AdvisorGraphInsights component
2. Integrate with advisor dashboard
3. Add graph to query results
4. Implement reasoning chain view
5. Add interactive graph controls
6. Test responsive design
7. Performance optimization

**Dependencies:**
- ✅ Phase 3b complete (components tested)
- ✅ Advisor dashboard exists
- ✅ Backend APIs working
- ✅ Environment configured

---

## 📋 Phase 3c Architecture

### Component Hierarchy

```
AdvisorDashboard (main page)
├── QueryPanel
│   └── Submit query
├── ResultsPanel
│   ├── TextAdvice (existing)
│   ├── RecommendationsList (existing)
│   └── AdvisorGraphInsights ✨ NEW
│       ├── GraphViewer
│       │   ├── GraphLegend
│       │   └── Controls
│       ├── RulesList (ApplicableRulesList)
│       ├── EntitySearch
│       └── TemporalSelector
└── Footer
```

### Data Flow

```
1. User Query
   ↓
2. Backend processes (NER Service, RAG, Logic)
   ↓
3. Response includes:
   - text_advice: "Your situation qualifies for DRO..."
   - recommendations: ["Apply for DRO", "Contact creditor"]
   - graph_insights: {
       graph_id: "g-123",
       applicable_rules: [...],
       matched_entities: [...],
       reasoning_chain: [...]
     }
   ↓
4. AdvisorGraphInsights renders
   - Shows applicable rules
   - Displays entity graph
   - Explains reasoning
   - Allows exploration
```

---

## 🏗️ Task 1: Create AdvisorGraphInsights Component

**File:** `frontend/src/components/graphs/AdvisorGraphInsights.tsx`

```typescript
'use client';

import React, { useState, useCallback } from 'react';
import {
  GraphViewer,
  ApplicableRulesList,
  EntitySearch,
  TemporalSelector,
  GraphLegend,
} from '@/components/graphs';
import {
  DocumentGraph,
  ApplicableRule,
} from '@/types/graph.types';
import { graphService } from '@/services/graphService';
import styles from '@/styles/graphs.module.css';

interface AdvisorGraphInsightsProps {
  manualGraphId: string;
  clientGraphId?: string;
  applicableRules?: ApplicableRule[];
  onRuleSelect?: (rule: ApplicableRule) => void;
  showComparison?: boolean;
  compact?: boolean;
}

/**
 * AdvisorGraphInsights
 * 
 * Displays graph-based insights in the advisor dashboard.
 * Shows applicable rules, entity graph, and reasoning chain.
 * 
 * Features:
 * - Interactive entity graph with D3.js
 * - Applicable rules list with sorting
 * - Entity search and filtering
 * - Temporal validity indicators
 * - Responsive design for all screen sizes
 * - Comparison mode for manual vs client graphs
 */
export const AdvisorGraphInsights: React.FC<AdvisorGraphInsightsProps> = ({
  manualGraphId,
  clientGraphId,
  applicableRules = [],
  onRuleSelect,
  showComparison = false,
  compact = false,
}) => {
  const [selectedRule, setSelectedRule] = useState<ApplicableRule | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'rules' | 'reasoning'>('graph');
  const [loading, setLoading] = useState(false);

  const handleRuleSelect = useCallback(
    (rule: ApplicableRule) => {
      setSelectedRule(rule);
      onRuleSelect?.(rule);
    },
    [onRuleSelect]
  );

  const handleEntitySelect = useCallback((entityId: string) => {
    setSelectedEntity(entityId);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading graph insights...</p>
      </div>
    );
  }

  // Compact mode: Single column
  if (compact) {
    return (
      <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Graph Insights</h3>
        <div style={{ marginBottom: '16px' }}>
          <ApplicableRulesList
            rules={applicableRules}
            sortBy="confidence"
            maxHeight="250px"
            onRuleSelect={handleRuleSelect}
          />
        </div>
        {selectedRule && (
          <div style={{
            padding: '12px',
            backgroundColor: 'white',
            borderLeft: '4px solid #2563eb',
            borderRadius: '4px',
          }}>
            <p style={{ fontSize: '14px', margin: 0 }}>
              <strong>Selected Rule:</strong> {selectedRule.rule_text}
            </p>
            <p style={{ fontSize: '13px', color: '#666', margin: '8px 0 0' }}>
              {selectedRule.reasoning}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full mode: Multi-column layout
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {/* Left column: Graph Visualization */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'white',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0 }}>Entity Graph</h3>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Graph ID: {manualGraphId.substring(0, 8)}...
          </div>
        </div>

        <div style={{ padding: '12px' }}>
          <GraphViewer
            graphId={manualGraphId}
            height="400px"
            onNodeSelect={handleEntitySelect}
          />
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          fontSize: '12px',
        }}>
          <p style={{ margin: 0 }}>
            💡 <strong>Tip:</strong> Click entities to highlight relationships
          </p>
        </div>
      </div>

      {/* Right column: Rules and Details */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Tab selector */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}>
          {['graph', 'rules', 'reasoning'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: activeTab === tab ? 'white' : 'transparent',
                borderBottom: activeTab === tab ? '2px solid #2563eb' : 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab ? '600' : '400',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'graph' ? '📊 ' : tab === 'rules' ? '📋 ' : '🔗 '}
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {activeTab === 'graph' && (
            <div>
              <h4 style={{ marginTop: 0 }}>Search Entities</h4>
              <EntitySearch
                graphId={manualGraphId}
                onResultSelect={handleEntitySelect}
                placeholder="Search in graph..."
              />
              <h4 style={{ marginTop: '16px' }}>Temporal Filter</h4>
              <TemporalSelector
                graphId={manualGraphId}
                onDateChange={(date) => console.log('Date changed:', date)}
              />
            </div>
          )}

          {activeTab === 'rules' && (
            <div>
              <h4 style={{ marginTop: 0 }}>Applicable Rules</h4>
              <ApplicableRulesList
                rules={applicableRules}
                sortBy="confidence"
                maxHeight="300px"
                onRuleSelect={handleRuleSelect}
              />
            </div>
          )}

          {activeTab === 'reasoning' && (
            <div>
              <h4 style={{ marginTop: 0 }}>Reasoning Chain</h4>
              {selectedRule ? (
                <div>
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '6px',
                    marginBottom: '12px',
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                      {selectedRule.rule_text}
                    </p>
                  </div>
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '12px',
                  }}>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      <strong>Reasoning:</strong>
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
                      {selectedRule.reasoning}
                    </p>
                  </div>
                  {selectedRule.gates && selectedRule.gates.length > 0 && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '6px',
                    }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>
                        ⚙️ Gates:
                      </p>
                      {selectedRule.gates.map((gate, idx) => (
                        <p key={idx} style={{ margin: '6px 0 0', fontSize: '12px' }}>
                          {gate.gate_type}: {gate.condition}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#666', fontSize: '14px' }}>
                  Select a rule to view reasoning chain
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvisorGraphInsights;
```

**Type Definitions Update:**

Add to `frontend/src/types/graph.types.ts`:

```typescript
// Add this interface for advisor use case
export interface GraphInsightsData {
  graph_id: string;
  applicable_rules: ApplicableRule[];
  matched_entities: Array<{
    manual_id: string;
    client_id: string;
    similarity: number;
  }>;
  reasoning_chain: ReasoningChain;
  gaps: string[];
  comparison_timestamp: string;
}

export interface AdvisorGraphInsightsProps {
  manualGraphId: string;
  clientGraphId?: string;
  applicableRules?: ApplicableRule[];
  onRuleSelect?: (rule: ApplicableRule) => void;
  showComparison?: boolean;
  compact?: boolean;
}
```

---

## 🏗️ Task 2: Create Advisor Results Component

**File:** `frontend/src/components/advisor/AdvisorResults.tsx`

This component integrates graph insights into the existing results panel.

```typescript
'use client';

import React, { useState } from 'react';
import { AdvisorGraphInsights } from '@/components/graphs';
import { ApplicableRule } from '@/types/graph.types';

interface AdvisorQueryResult {
  id: string;
  query: string;
  text_advice: string;
  recommendations: string[];
  graph_insights?: {
    graph_id: string;
    applicable_rules: ApplicableRule[];
    gaps?: string[];
  };
  confidence: number;
  timestamp: string;
}

interface AdvisorResultsProps {
  result: AdvisorQueryResult;
  onRequestDetails?: (result: AdvisorQueryResult) => void;
}

export const AdvisorResults: React.FC<AdvisorResultsProps> = ({
  result,
  onRequestDetails,
}) => {
  const [showGraph, setShowGraph] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        marginBottom: '16px',
      }}>
        <div>
          <h3 style={{ margin: 0, marginBottom: '8px' }}>
            Query: {result.query}
          </h3>
          <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
            {new Date(result.timestamp).toLocaleString()}
            {' • '}
            Confidence: {(result.confidence * 100).toFixed(0)}%
          </p>
        </div>
        {result.graph_insights && (
          <button
            onClick={() => setShowGraph(!showGraph)}
            style={{
              padding: '8px 12px',
              backgroundColor: showGraph ? '#2563eb' : '#e5e7eb',
              color: showGraph ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {showGraph ? '📊 Hide Graph' : '📊 Show Graph'}
          </button>
        )}
      </div>

      {/* Text Advice Section */}
      <div style={{
        padding: '16px',
        backgroundColor: '#f0f9ff',
        borderRadius: '6px',
        marginBottom: '16px',
        borderLeft: '4px solid #0284c7',
      }}>
        <h4 style={{ margin: '0 0 8px', color: '#0c4a6e' }}>
          💡 Advice
        </h4>
        <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>
          {result.text_advice}
        </p>
      </div>

      {/* Recommendations Section */}
      {result.recommendations.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 12px' }}>
            ✓ Recommendations
          </h4>
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            listStyle: 'none',
          }}>
            {result.recommendations.map((rec, idx) => (
              <li key={idx} style={{
                marginBottom: '8px',
                paddingLeft: '24px',
                position: 'relative',
                color: '#374151',
              }}>
                <span style={{
                  position: 'absolute',
                  left: 0,
                  color: '#16a34a',
                }}>
                  ✓
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Graph Insights Section */}
      {showGraph && result.graph_insights && (
        <div style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb',
        }}>
          <h4 style={{ margin: '0 0 16px' }}>
            📊 Graph-Based Analysis
          </h4>
          <AdvisorGraphInsights
            manualGraphId={result.graph_insights.graph_id}
            applicableRules={result.graph_insights.applicable_rules}
            compact={false}
            onRuleSelect={(rule) => {
              setExpandedRule(rule.rule_id);
            }}
          />
          {result.graph_insights.gaps && result.graph_insights.gaps.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '6px',
              borderLeft: '4px solid #f59e0b',
            }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>
                ⚠️ Information Gaps:
              </p>
              <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13px' }}>
                {result.graph_insights.gaps.map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        gap: '12px',
      }}>
        <button
          onClick={() => onRequestDetails?.(result)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          View Details
        </button>
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          Export Report
        </button>
      </div>
    </div>
  );
};

export default AdvisorResults;
```

---

## 🏗️ Task 3: Update Advisor Dashboard

**File:** `frontend/src/app/advisor/page.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { AdvisorResults } from '@/components/advisor/AdvisorResults';

interface QueryResult {
  id: string;
  query: string;
  text_advice: string;
  recommendations: string[];
  graph_insights?: any;
  confidence: number;
  timestamp: string;
}

export default function AdvisorPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);

    try {
      // Call advisor API endpoint
      const response = await fetch('/api/advisor/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      // Add to results with timestamp
      const newResult: QueryResult = {
        id: Date.now().toString(),
        query,
        text_advice: data.advice || 'No advice available',
        recommendations: data.recommendations || [],
        graph_insights: data.graph_insights,
        confidence: data.confidence || 0.5,
        timestamp: new Date().toISOString(),
      };

      setResults([newResult, ...results]);
      setQuery('');
    } catch (error) {
      console.error('Error submitting query:', error);
      alert('Error processing query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Financial Advice Advisor</h1>

      {/* Query Form */}
      <form onSubmit={handleSubmitQuery} style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}>
        <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>
          Your Question:
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="E.g., 'I have £12,500 in unsecured debt. Am I eligible for a Debt Relief Order?'"
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontFamily: 'inherit',
            fontSize: '14px',
            marginBottom: '12px',
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            padding: '10px 24px',
            backgroundColor: loading ? '#d1d5db' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          {loading ? 'Processing...' : 'Ask Question'}
        </button>
      </form>

      {/* Results */}
      {results.length > 0 ? (
        <div>
          <h2 style={{ marginBottom: '16px' }}>
            Results ({results.length})
          </h2>
          {results.map((result) => (
            <AdvisorResults
              key={result.id}
              result={result}
              onRequestDetails={(r) => console.log('Details:', r)}
            />
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#666',
        }}>
          <p>No queries submitted yet. Ask your first question to get started!</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🏗️ Task 4: Create API Endpoint

**File:** `frontend/app/api/advisor/query/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/advisor/query
 * 
 * Process a financial advice query and return:
 * - text_advice: Personalized advice
 * - recommendations: Action items
 * - graph_insights: Graph-based analysis
 * - confidence: Confidence score
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Call backend advisor service
    // This would typically call your Python backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    const response = await fetch(`${backendUrl}/api/advisor/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      advice: data.advice || 'Based on the provided information...',
      recommendations: data.recommendations || [],
      graph_insights: data.graph_insights,
      confidence: data.confidence || 0.75,
    });
  } catch (error) {
    console.error('Query error:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
```

---

## 🏗️ Task 5: Update Component Exports

**File:** `frontend/src/components/graphs/index.ts`

```typescript
export { GraphViewer } from './GraphViewer';
export { DualGraphComparison } from './DualGraphComparison';
export { EntitySearch } from './EntitySearch';
export { TemporalSelector } from './TemporalSelector';
export { ApplicableRulesList } from './ApplicableRulesList';
export { GraphLegend } from './GraphLegend';
export { AdvisorGraphInsights } from './AdvisorGraphInsights';

export type {
  GraphViewerProps,
  DualGraphComparisonProps,
  EntitySearchProps,
  TemporalSelectorProps,
  ApplicableRulesListProps,
  GraphLegendProps,
  AdvisorGraphInsightsProps,
} from '@/types/graph.types';
```

---

## 📊 Phase 3c Testing Checklist

**Component Creation**
- [ ] AdvisorGraphInsights component created
- [ ] Accepts all required props
- [ ] TypeScript types complete
- [ ] Tab system works
- [ ] Compact mode works
- [ ] Full mode works

**Integration**
- [ ] AdvisorResults component created
- [ ] Shows text advice
- [ ] Shows recommendations
- [ ] Shows graph insights
- [ ] Show/hide graph toggle works
- [ ] Info gaps display

**Dashboard**
- [ ] Advisor page updated
- [ ] Query form works
- [ ] Results display correctly
- [ ] Multiple results stack
- [ ] Graph loads in results

**API Endpoint**
- [ ] /api/advisor/query endpoint works
- [ ] Accepts POST requests
- [ ] Returns correct format
- [ ] Error handling works
- [ ] Calls backend service

**Responsive Design**
- [ ] Mobile: Single column
- [ ] Tablet: Two columns
- [ ] Desktop: Full layout
- [ ] No horizontal scroll
- [ ] All text readable

**Performance**
- [ ] Page loads <2 seconds
- [ ] Results render <1 second
- [ ] Graph renders <1 second
- [ ] No memory leaks
- [ ] No console errors

---

## 🎯 Phase 3c Success Criteria

Phase 3c is complete when:

✅ AdvisorGraphInsights component created  
✅ Integrated into advisor dashboard  
✅ Graph displays in query results  
✅ All interactions work (tabs, search, filtering)  
✅ Responsive design verified  
✅ Performance targets met  
✅ No console errors  
✅ All tests pass  

---

## 🚀 Phase 3c Implementation Steps

**Step 1: Create Components (20 minutes)**
- [ ] Create AdvisorGraphInsights.tsx
- [ ] Create AdvisorResults.tsx
- [ ] Update component exports
- [ ] Update TypeScript types

**Step 2: Create API Endpoint (10 minutes)**
- [ ] Create /api/advisor/query route
- [ ] Connect to backend service
- [ ] Error handling

**Step 3: Update Dashboard (10 minutes)**
- [ ] Update advisor page
- [ ] Add query form
- [ ] Integrate results component
- [ ] Add styling

**Step 4: Test Integration (15 minutes)**
- [ ] Test component rendering
- [ ] Test data flow
- [ ] Test API calls
- [ ] Verify responsive design

**Step 5: Performance Optimization (10 minutes)**
- [ ] Profile with DevTools
- [ ] Optimize if needed
- [ ] Verify targets met

**Total: ~65 minutes**

---

## 📋 Phase 3c Architecture Details

### Component Props Flow

```typescript
// From dashboard to results
<AdvisorResults
  result={{
    query: "Am I eligible for DRO?",
    text_advice: "Yes, you qualify because...",
    recommendations: ["Apply for DRO"],
    graph_insights: {
      graph_id: "g-123",
      applicable_rules: [...],
    },
    confidence: 0.95,
    timestamp: "2025-11-04T..."
  }}
/>

// From results to graph component
<AdvisorGraphInsights
  manualGraphId="g-123"
  applicableRules={result.graph_insights.applicable_rules}
  onRuleSelect={handleRuleSelect}
  compact={false}
/>
```

### Data Shape from Backend

```json
{
  "advice": "You are eligible for a Debt Relief Order because...",
  "recommendations": [
    "Apply to the Insolvency Service",
    "Gather financial documents",
    "Contact your creditors"
  ],
  "graph_insights": {
    "graph_id": "g-client-123",
    "applicable_rules": [
      {
        "rule_id": "dro-1",
        "rule_text": "DRO applies when total debt < £15,000",
        "reasoning": "Your total debt is £12,500",
        "confidence": 0.98,
        "temporal_status": "ACTIVE"
      }
    ],
    "gaps": [
      "Employment status not provided"
    ]
  },
  "confidence": 0.92
}
```

---

## 🔗 Integration Points

### Frontend → Backend

```
POST /api/advisor/query
├── Input: { query: string }
├── Process: NER + RAG + Logic
└── Output: {
    advice: string,
    recommendations: string[],
    graph_insights: GraphInsightsData,
    confidence: number
  }
```

### Data Sources

- **NER Service:** http://localhost:8108
- **RAG Service:** http://localhost:8102
- **Advisor Backend:** http://localhost:8000

---

## 🎨 UI/UX Considerations

**Responsive Breakpoints:**

```css
/* Desktop (>1024px) */
- Two-column layout: Graph | Rules
- All features visible
- Full controls

/* Tablet (768-1024px) */
- Stacked layout: Graph, then Rules
- Tab switcher for compact mode
- Touch-friendly buttons

/* Mobile (<768px) */
- Single column
- Compact mode by default
- Scrollable sections
```

**Visual Hierarchy:**

1. Query result summary (confidence, timestamp)
2. Text advice (blue background, prominent)
3. Recommendations (green checkmarks)
4. Graph section (collapsible, secondary)
5. Gaps and warnings (yellow background)

---

## 🎯 Next Phase (Phase 4)

After Phase 3c completes:

**Phase 4: Formal Logic Engine**
- Implement temporal gate evaluation
- Create reasoning chain formalization
- Generate graph-backed advice
- Add graph citations

**Estimated Duration:** 2-3 hours

---

**Phase 3c Status:** 📋 **PLANNED**  
**Start After:** Phase 3b completion  
**Duration:** 1-2 hours  
**Complexity:** Medium

