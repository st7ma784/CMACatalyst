# Graph View Quick Start Guide

## What is the Graph View?

The Graph View provides **transparent, auditable reasoning** for debt advice decisions. Instead of opaque LLM outputs, advisors see:

- **Entities**: Conditions, rules, outcomes, thresholds extracted from manuals
- **Relations**: How these entities connect (implies, requires, prevents, etc.)
- **Paths**: The exact reasoning path to each eligibility decision
- **Confidence**: Belief scores for each extracted entity and relation

## Accessing Graph View

1. Navigate to RMA Dashboard
2. Click the **Graph View** tab (GitBranch icon)
3. View the graph visualization with all extracted entities and relations

## Understanding the Visualization

### Entities (Colored Nodes)

| Color | Type | Example |
|-------|------|---------|
| 🔵 Blue | Condition | "Debt ≤ £50,000" |
| 🟣 Purple | Rule | "DRO Eligibility Rule" |
| 🟢 Green | Outcome | "Eligible for DRO" |
| 🟠 Orange | Threshold | "£50,000 Debt Limit" |
| 🟡 Indigo | Process | "DRO Application" |
| 🔴 Pink | Criteria | "Income Test" |
| 🔴 Red | Exception | "Exception: Self-employed" |
| 🔄 Teal | Action | "Pay £1k to reduce debt" |

### Relations (Arrows with Labels)

| Type | Symbol | Meaning | Example |
|------|--------|---------|---------|
| implies | → | if A then B | "Debt ≤ £50k" → "Passes debt test" |
| leads_to | ⇢ | A causes B | "Payment plan" → "Debt reduction" |
| requires | ⇒ | A needed for B | "DRO" ⇒ "Debt < limit" |
| prevents | ⊗ | A blocks B | "High debt" ⊗ "DRO eligible" |
| contradicts | ≠ | A vs B | "High debt" ≠ "Eligible" |

### Confidence

Each entity and relation has a **confidence score** (0-100%) shown as a progress bar. This indicates:
- **95-100%**: Explicitly stated in manual
- **80-95%**: Clearly implied
- **60-80%**: Inferred from context
- **<60%**: Uncertain - review manually

## Using the Filters

### Filter by Entity Type
```
All entities → Filter to "condition" only
│
↓ Shows only condition nodes (blue)
"Debt ≤ £50,000"
"Income < £75"
"No CCJs"
"Owns no property"
```

### Filter by Relation Type
```
All relations → Filter to "implies" only
│
↓ Shows only implication arrows
Direct logical consequences
```

### Combined Filters
```
Entities: "outcome" + Relations: "leads_to"
│
↓ Shows: What outcomes are achievable?
          What leads to each outcome?
```

## Exploring Entities

### Click an Entity to See Details

```
Entity Card:
┌─────────────────────────────────┐
│ Debt ≤ £50,000                  │
├─────────────────────────────────┤
│ ID: ent_001234                  │
│ Type: condition                 │
│ Confidence: 95%                 │
│ Source: DRO_Manual_2024.pdf     │
│                                 │
│ Properties:                     │
│ {                               │
│   "amount": 50000,              │
│   "currency": "GBP",            │
│   "operator": "≤"               │
│ }                               │
│                                 │
│ Examples:                       │
│ • Total unsecured debt          │
│ • Does not include mortgage     │
└─────────────────────────────────┘
```

## Exploring Relations

### Click a Relation to See Details

```
Relation Details:
┌──────────────────────────────────────┐
│ Debt ≤ £50,000 → Passes Debt Test   │
├──────────────────────────────────────┤
│ Type: implies                        │
│ Confidence: 90%                      │
│ Reasoning:                           │
│ "DRO requires total debt below       │
│  the statutory limit of £50,000"     │
└──────────────────────────────────────┘
```

## Finding Reasoning Paths

### Show All Paths to Eligibility

```
Start from: "Debt ≤ £50,000"
Target: "outcome"

Paths Found: 3

Path 1: Debt ≤ £50k → Income < £75 → Eligible
Path 2: Debt ≤ £50k → No CCJs → Eligible  
Path 3: Debt ≤ £50k → No property → Eligible
```

### Show Reasoning Trail

For a specific client assessment, see the exact path through the graph:

```
Question: "Is this client eligible for DRO?"
Client: {debt: £51k, income: £70, assets: £1.5k}

Reasoning Trail:

Step 1: Check "Debt ≤ £50,000"
  ├─ Client Value: £51,000
  ├─ Threshold: £50,000
  ├─ Result: FAIL ⚠️
  └─ Gap: £1,000 over limit

Step 2: Check "Income < £75"
  ├─ Client Value: £70
  ├─ Threshold: £75
  ├─ Result: PASS ✓
  └─ Meets requirement

Step 3: Combine (AND logic)
  ├─ Debt: FAIL
  ├─ Income: PASS
  ├─ Result: FAIL (not all met)
  └─ Status: NEAR MISS

Recommendation:
"Client is £1,000 below threshold. Options:
 1. Pay £1,000 to qualify
 2. Pursue debt write-off negotiations
 3. Consider IVA instead"
```

## Exporting Graphs

### Export as JSON

Click the **JSON** button to download:

```json
{
  "id": "graph_dro_manual_2024",
  "entities": {
    "ent_001": {
      "type": "condition",
      "label": "Debt ≤ £50,000",
      "confidence": 0.95,
      "properties": {...}
    },
    ...
  },
  "relations": {
    "rel_001": {
      "type": "implies",
      "source_entity_id": "ent_001",
      "target_entity_id": "ent_002",
      "confidence": 0.90
    },
    ...
  },
  "stats": {...}
}
```

**Use cases**:
- Backup and version control
- Import into Neo4j
- Analyze patterns programmatically
- Share with other advisors

### Export as CSV

Click the **CSV** button for spreadsheet analysis:

```csv
Entity ID,Entity Type,Label,Confidence,Source,Description
ent_001,condition,Debt ≤ £50000,0.95,DRO_Manual_2024.pdf,...
ent_002,threshold,£50000 DRO Debt Limit,0.98,DRO_Manual_2024.pdf,...

Relation ID,Type,Source Entity,Target Entity,Confidence,Reasoning
rel_001,implies,Debt ≤ £50000,Passes debt test,0.90,...
```

**Use cases**:
- Compliance documentation
- Rule auditing in Excel
- Cross-reference checking
- Team distribution

## Common Tasks

### Task 1: Understand a Decision

**Scenario**: "Why was the client ineligible?"

**Steps**:
1. Go to Graph View
2. Click the "Ineligible" outcome entity
3. See all relations pointing TO it
4. Follow backwards to see what causes ineligibility

### Task 2: Find Near-Miss Opportunities

**Scenario**: "The client is close to qualifying. What would help?"

**Steps**:
1. Use Eligibility Checker to get near-miss results
2. Switch to Graph View
3. Filter to "action" entities
4. See recommended remediation actions
5. Export CSV for follow-up

### Task 3: Verify Manual Interpretation

**Scenario**: "Is the system correctly reading the manual?"

**Steps**:
1. Go to Graph View
2. Filter to just the rule you're checking
3. See all extracted components
4. Click each entity to verify confidence
5. If incorrect, note for manual refinement

### Task 4: Compare Multiple Manuals

**Scenario**: "How do DRO and IVA eligibility differ?"

**Steps**:
1. Load DRO manual → build graph
2. Export entities as CSV
3. Load IVA manual → build graph
4. Export entities as CSV
5. Compare in spreadsheet for contradictions

### Task 5: Create Custom Rule

**Scenario**: "We have a local variation on the debt limit"

**Steps**:
1. Edit exported JSON
2. Modify threshold entity
3. Add new relation for local rule
4. Re-import for testing

## Statistics Panel

### Graph Overview

```
Entities:
- Total: 450
- Conditions: 125
- Rules: 45
- Outcomes: 30
- Thresholds: 20
- Processes: 40
- Criteria: 35
- Exceptions: 155

Relations:
- Total: 680
- Implies: 250
- Leads_to: 180
- Requires: 150
- Prevents: 50
- Alternatives: 50

Source Documents:
- DRO_Manual_2024.pdf
- IVA_Guide_2024.pdf
- Bankruptcy_Rules_2024.pdf
```

## Troubleshooting

### Problem: "Graph is too cluttered"

**Solution**: Use filters
- Filter to single entity type
- Filter to single relation type
- Focus on specific path

### Problem: "Confidence seems low"

**Possible causes**:
- Ambiguous wording in source
- Implicit rule (not explicitly stated)
- LLM uncertainty (consider low-confidence rule)

**Action**: 
- Click entity to see reasoning
- Check source document chunk
- Manually verify if critical to decision

### Problem: "Can't find an entity I know exists"

**Solution**: 
- Try different filter combinations
- Search using name prefix
- Check entity extraction confidence
- May need to re-ingest manual

### Problem: "Two entities seem to be the same"

**Solution**:
- This is normal (different phrasings)
- Graph builder detects and merges high-similarity entities
- If not merged, export JSON and edit manually

## Best Practices

### For Advisors

✅ **DO**: 
- Review confidence scores on important decisions
- Export graphs for compliance documentation
- Use reasoning trails for client explanations
- Flag low-confidence extractions for review

❌ **DON'T**:
- Ignore red/orange entities (potential issues)
- Trust <60% confidence without verification
- Make decisions based on graph alone (verify with manual)

### For Supervisors

✅ **DO**: 
- Audit graph extractions quarterly
- Track advisor adjustments to graphs
- Monitor confidence score trends
- Use graphs for training new staff

❌ **DON'T**:
- Auto-approve decisions from graphs
- Skip manual verification
- Ignore graph-to-manual discrepancies

### For Compliance

✅ **KEEP**: 
- Graph exports for every decision
- Reasoning trails in case files
- Manual verification notes
- Version history of graphs

## Integration with Other Tabs

### From "Ask the Manuals"
- Ask a question
- Switch to Graph View
- See the entities/relations used to answer
- Understand source material

### From "Eligibility Checker"
- Enter client values
- Check eligibility
- Click "Show Reasoning" 
- Visualize path through graph

### From "Client Documents"
- Upload documents
- Graph View shows extracted structure
- Verify extraction quality
- Identify missing information

## Future Features (Roadmap)

🎯 **Coming Soon**:
- Interactive D3.js visualization (drag nodes, zoom, pan)
- Path highlighting (light up path to selected outcome)
- Batch reasoning (analyze multiple clients at once)
- Neo4j backend (faster queries, larger graphs)
- Custom rule builder (visual rule creation)

## Getting Help

- **Documentation**: See DEBT_ADVICE_GRAPH_SYSTEM.md
- **API Reference**: See graph_routes.py
- **Examples**: See example_graphs/ folder
- **Issues**: Report via admin panel
