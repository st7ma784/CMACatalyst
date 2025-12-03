# Debt Advice Graph System

## Overview

The Debt Advice Graph System transforms opaque LLM reasoning into transparent, auditable knowledge graphs. Instead of relying on black-box LLM responses, advisors can see exactly which rules, conditions, and relationships led to each decision.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Input Documents                                         │
│ (Debt Manuals or Client Documents)                     │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ GraphBuilder (LLM-Powered Extraction)                   │
│                                                         │
│ 1. Entity Extraction                                    │
│    - Conditions: "Debt ≤ £50,000"                      │
│    - Rules: "DRO Eligibility Rule"                     │
│    - Outcomes: "Eligible for DRO"                      │
│    - Thresholds: "£50,000 Debt Limit"                  │
│    - Processes: "DRO Application"                      │
│                                                         │
│ 2. Relation Extraction                                  │
│    - implies: "Debt ≤ £50k" → "Eligible for DRO"      │
│    - requires: "Must have income < £75"                │
│    - leads_to: "Payment plan" → "Debt reduction"       │
│    - prevents: "High debt" → "DRO eligibility"         │
│                                                         │
│ 3. Graph Enrichment                                     │
│    - Merge duplicate entities                          │
│    - Detect transitive relations                       │
│    - Assign confidence scores                          │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ DebtAdviceGraph                                         │
│                                                         │
│ Entities:                                               │
│ {                                                       │
│   "ent_001": {                                          │
│     "type": "condition",                                │
│     "label": "Debt ≤ £50,000",                          │
│     "properties": {"amount": 50000, "currency": "GBP"}, │
│     "confidence": 0.95,                                 │
│     "source": "DRO_Manual_2024.pdf"                     │
│   }                                                     │
│ }                                                       │
│                                                         │
│ Relations:                                              │
│ {                                                       │
│   "rel_001": {                                          │
│     "type": "implies",                                  │
│     "source_entity_id": "ent_001",                      │
│     "target_entity_id": "ent_002",                      │
│     "confidence": 0.90,                                 │
│     "reasoning": "DRO requires debt below limit"        │
│   }                                                     │
│ }                                                       │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ Storage Layer                                           │
│ - ChromaDB for embedding-based search                   │
│ - Optional: Neo4j for native graph queries              │
│ - File system for JSON export                           │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ Query Interfaces                                        │
│ - Graph Visualization (React component)                 │
│ - REST API endpoints                                    │
│ - Path finding (reasoning trails)                       │
│ - Reasoning explanation (why this decision)             │
└─────────────────────────────────────────────────────────┘
```

## Entity Types

### Condition
**Definition**: A state or circumstance that must be checked

**Examples**:
- "Debt ≤ £50,000"
- "Monthly income < £75"
- "No recent CCJs"
- "Owns no property"

**Properties**:
```json
{
  "type": "condition",
  "label": "Debt ≤ £50,000",
  "properties": {
    "amount": 50000,
    "currency": "GBP",
    "operator": "≤"
  }
}
```

### Threshold
**Definition**: A specific numerical limit or boundary

**Examples**:
- "DRO Debt Limit: £50,000"
- "IVA Income Threshold: £75/month"
- "Bankruptcy Asset Test: £1,000"

**Properties**:
```json
{
  "type": "threshold",
  "label": "DRO Debt Limit",
  "properties": {
    "value": 50000,
    "currency": "GBP",
    "year": 2024,
    "applicable_to": "DRO"
  }
}
```

### Rule
**Definition**: A procedural or eligibility rule

**Examples**:
- "DRO Eligibility Rule"
- "Income Test Rule"
- "Asset Accumulation Rule"

**Properties**:
```json
{
  "type": "rule",
  "label": "DRO Eligibility Rule",
  "properties": {
    "manual_section": "3.2",
    "version": "2024",
    "effective_from": "2024-01-01"
  }
}
```

### Outcome
**Definition**: A possible result or conclusion

**Examples**:
- "Eligible for DRO"
- "Ineligible - Debt too high"
- "Requires further review"
- "Recommend debt management plan"

**Properties**:
```json
{
  "type": "outcome",
  "label": "Eligible for DRO",
  "properties": {
    "status": "eligible",
    "next_steps": ["application", "payment_plan"],
    "success_probability": 0.95
  }
}
```

### Process
**Definition**: Steps in a procedure

**Examples**:
- "DRO Application Process"
- "Payment Plan Setup"
- "Credit Report Update"

**Properties**:
```json
{
  "type": "process",
  "label": "DRO Application Process",
  "properties": {
    "duration_days": 28,
    "steps": 5,
    "cost": 620
  }
}
```

### Criteria
**Definition**: Assessment criteria

**Examples**:
- "Income Test"
- "Asset Test"
- "Debt Repayment Capacity"

**Properties**:
```json
{
  "type": "criteria",
  "label": "Income Test",
  "properties": {
    "threshold": 75,
    "currency": "GBP",
    "period": "monthly"
  }
}
```

### Exception
**Definition**: Exceptions to rules

**Examples**:
- "Exception: Self-employed income"
- "Exception: Inherited assets in trust"
- "Exception: Recent bankruptcy"

**Properties**:
```json
{
  "type": "exception",
  "label": "Exception: Self-employed income",
  "properties": {
    "applies_to": "income_test",
    "calculation_method": "3-year average"
  }
}
```

### Action
**Definition**: Recommended actions

**Examples**:
- "Pay £1,000 to reduce debt"
- "Seek tax advice"
- "Review insurance policies"

**Properties**:
```json
{
  "type": "action",
  "label": "Pay £1,000 to reduce debt",
  "properties": {
    "type": "remediation",
    "cost": 1000,
    "timeframe_days": 30
  }
}
```

## Relation Types

### implies (→)
**Definition**: If A is true, then B is logically true

**Example**: 
- "Debt ≤ £50k" **implies** "Passes debt test"

**Semantics**: A → B (material implication)

### leads_to (→)
**Definition**: A causes B to happen or occur

**Example**:
- "Payment plan" **leads_to** "Debt reduction"

**Semantics**: Causal relationship, temporal sequence

### requires (⇒)
**Definition**: A must be true/present for B to work

**Example**:
- "DRO approval" **requires** "Debt ≤ £50k AND Income < £75"

**Semantics**: Prerequisite, necessity

### prevents (⊗)
**Definition**: A prevents B from happening

**Example**:
- "Recent bankruptcy" **prevents** "DRO eligibility"

**Semantics**: Blocking relationship, negation

### contradicts (≠)
**Definition**: A and B cannot both be true

**Example**:
- "High debt" **contradicts** "DRO eligible"

**Semantics**: Logical contradiction

### equivalent (≡)
**Definition**: A is the same as B

**Example**:
- "IVA payment plan" **equivalent** "Debt repayment plan"

**Semantics**: Synonymy, equivalence

### part_of (⊂)
**Definition**: A is a part or component of B

**Example**:
- "Income test" **part_of** "DRO eligibility criteria"

**Semantics**: Composition, membership

### alternative_to (|)
**Definition**: Either A or B (but not necessarily both)

**Example**:
- "DRO" **alternative_to** "IVA"

**Semantics**: Disjunction, choice

### refines (→)
**Definition**: A specializes or details B

**Example**:
- "Monthly income < £75" **refines** "Income test"

**Semantics**: Specification, elaboration

### triggers (→)
**Definition**: A activates or initiates B

**Example**:
- "Missed payment" **triggers** "Debt recovery process"

**Semantics**: Event activation, initiation

## Frontend Components

### DebtAdviceGraph.tsx

Main React component for graph visualization and exploration.

**Features**:
1. **Interactive Visualization**
   - SVG-based rendering (upgradeable to D3.js or Cytoscape.js)
   - Node and edge rendering
   - Click entities for details
   - Color-coded by type and relation

2. **Filtering**
   - Filter by entity type
   - Filter by relation type
   - Live updates to visualization

3. **Export**
   - JSON export for analysis
   - CSV export for spreadsheet tools
   - Full graph structure preservation

4. **Reasoning Trails**
   - Show paths from conditions to outcomes
   - Highlight chain of reasoning
   - Display confidence at each step

5. **Full-Screen Mode**
   - Maximize for detailed exploration
   - Responsive to window resizing

**Usage**:
```tsx
import DebtAdviceGraph from '@/components/DebtAdviceGraph'

export default function Dashboard() {
  return (
    <Tabs>
      <TabsContent value="graph">
        <DebtAdviceGraph />
      </TabsContent>
    </Tabs>
  )
}
```

## Backend API Endpoints

### POST /api/graph/build
Build a graph from text chunks

**Request**:
```json
{
  "text_chunks": [
    {
      "text": "The DRO debt limit is £50,000...",
      "chunk_id": "chunk_1",
      "page": 10
    }
  ],
  "source_files": ["DRO_Manual_2024.pdf"],
  "document_type": "manual",
  "force_rebuild": false
}
```

**Response**:
```json
{
  "id": "graph_xyz",
  "entities": {
    "ent_001": {
      "type": "threshold",
      "label": "DRO Debt Limit",
      "confidence": 0.95
    }
  },
  "relations": {
    "rel_001": {
      "type": "implies",
      "source_entity_id": "ent_001",
      "target_entity_id": "ent_002",
      "confidence": 0.90
    }
  },
  "stats": {
    "total_entities": 150,
    "total_relations": 200,
    "entity_types": {...},
    "relation_types": {...}
  }
}
```

### GET /api/graph/{graph_id}
Retrieve a specific graph

### GET /api/graph/{graph_id}/paths
Find reasoning paths

**Query Parameters**:
- `start_entity_id`: Starting entity
- `target_type`: Optional target entity type (e.g., "outcome")
- `max_depth`: Maximum path length (default: 5)

**Response**:
```json
{
  "start_entity_id": "ent_001",
  "target_type": "outcome",
  "paths": [
    ["ent_001", "ent_002", "ent_003"],
    ["ent_001", "ent_004", "ent_003"]
  ],
  "path_labels": [
    ["Debt ≤ £50k", "Income < £75", "Eligible for DRO"],
    ["Debt ≤ £50k", "No CCJs", "Eligible for DRO"]
  ],
  "total_paths": 2
}
```

### POST /api/graph/reasoning-trail
Generate a reasoning trail for a decision

**Request**:
```json
{
  "graph_id": "graph_xyz",
  "question": "Is the client eligible for a DRO?",
  "client_values": {
    "debt": 51000,
    "income": 70,
    "assets": 1500,
    "has_ccjs": false
  }
}
```

**Response**:
```json
{
  "question": "Is the client eligible for a DRO?",
  "start_conditions": {"debt": 51000, "income": 70},
  "path": [
    {
      "entity_id": "ent_001",
      "entity_label": "Debt ≤ £50k",
      "result": false,
      "actual_value": 51000,
      "threshold": 50000,
      "gap": 1000
    },
    {
      "entity_id": "ent_002",
      "entity_label": "Income < £75",
      "result": true,
      "actual_value": 70,
      "threshold": 75
    }
  ],
  "conclusion_entity_id": "ent_099",
  "conclusion_label": "Requires review - near miss",
  "confidence": 0.85
}
```

## Workflow: Manual Ingestion

```
1. Manual Upload
   ├─ PDF → Text extraction
   └─ Chunks created (by section/page)

2. Graph Building
   ├─ Entity Extraction (LLM)
   │  ├─ Identify conditions, rules, outcomes
   │  └─ Extract properties and examples
   └─ Relation Extraction (LLM)
      ├─ Find connections between entities
      └─ Classify relation types

3. Graph Enrichment
   ├─ Deduplication
   ├─ Transitive closure
   └─ Confidence scoring

4. Storage
   ├─ ChromaDB (for retrieval)
   └─ JSON export (for backup)

5. Visualization
   └─ DebtAdviceGraph component
```

## Workflow: Client Document Processing

```
1. Client Document Upload
   ├─ Extract text (OCR if needed)
   └─ Chunk by document sections

2. Client-Specific Graph
   ├─ Entity Extraction (with client values)
   │  ├─ "Client debt: £51k" (specific, not generic)
   │  └─ Extract from balance sheets, payslips
   └─ Relation Extraction
      └─ Which rules apply to THIS client

3. Overlay with Manual Graph
   ├─ Match client entities to manual entities
   └─ Apply manual rules to client data

4. Eligibility Assessment
   ├─ Traverse reasoning paths
   ├─ Collect matching paths for client
   └─ Output colored recommendation

5. Explanation
   └─ "Client is NEAR MISS because..."
      └─ Show exact path through graph
```

## Integration with Eligibility Checker

The graph system enhances the eligibility checker by providing transparency:

```
Eligibility Checker
├─ Question: "Is client eligible for DRO?"
├─ Client Values: {debt: 51000, income: 70, assets: 1500}
└─ Reasoning Process:
   ├─ Build graph from DRO manual
   ├─ Find "eligible for DRO" outcomes
   ├─ Trace back to starting conditions
   ├─ Check which conditions are met:
   │  ├─ "Debt ≤ £50k"? NO (£51k) ⚠️
   │  ├─ "Income < £75"? YES ✅
   │  ├─ "No CCJs"? YES ✅
   │  └─ "Owns no property"? YES ✅
   └─ Output Reasoning Trail:
      └─ "Not eligible, but within £1k of threshold"
         └─ "RECOMMENDATION: Pay £1k to qualify"
```

## Benefits for Advisors

### Transparency
✅ See exactly which rules apply  
✅ Understand why a decision was made  
✅ Challenge specific reasoning steps  

### Auditability
✅ Full reasoning trail saved  
✅ Reproducible across cases  
✅ Compliance evidence  

### Confidence
✅ Confidence scores on each extraction  
✅ Know where LLM is uncertain  
✅ Manual review triggers for low-confidence  

### Customization
✅ Can edit graphs for local variations  
✅ Can add custom rules  
✅ Can merge multiple manuals  

## Example: Complete Graph for Simple Rule

```
Manual Text:
"A DRO can be granted if the debtor's total debt does not exceed £50,000
and their monthly income is less than £75."

Extracted Graph:

Entities:
- ent_001: "Debt ≤ £50,000" (condition)
- ent_002: "Monthly income < £75" (condition)
- ent_003: "Debtor meets all criteria" (rule)
- ent_004: "Eligible for DRO" (outcome)
- ent_005: "£50,000 DRO Debt Limit" (threshold)
- ent_006: "£75 Monthly Income Limit" (threshold)

Relations:
- rel_001: ent_005 defines ent_001
- rel_002: ent_006 defines ent_002
- rel_003: ent_001 AND ent_002 → ent_003 (both required)
- rel_004: ent_003 implies ent_004

Reasoning Path for Client (debt: £51k, income: £70):
1. Check: Debt ≤ £50,000?
   Input: £51,000
   Threshold: £50,000
   Result: FAIL (gap: £1,000)

2. Check: Income < £75?
   Input: £70
   Threshold: £75
   Result: PASS

3. Check: Both conditions required?
   Status: FAIL (only 1 of 2 met)

4. Conclusion: NEAR MISS
   Recommendation: Pay £1,000 to meet debt threshold
```

## Future Enhancements

### Phase 2: Advanced Visualization
- D3.js force-directed graph
- Interactive node dragging
- Zoom and pan
- Animation along paths

### Phase 3: Graph Database
- Migrate to Neo4j for:
  - Faster path queries
  - Cross-document queries
  - Pattern detection
  - Performance at scale

### Phase 4: Manual Cross-Referencing
- Link entities across manuals
- Detect conflicting rules
- Build comprehensive rule set
- Version management

### Phase 5: Learning and Adaptation
- Track advisor corrections
- Refine entity extraction
- Update confidence scores
- Improve relation detection

### Phase 6: Automated Testing
- Generate test cases from graphs
- Verify eligibility decisions
- Edge case detection
- Regression detection
