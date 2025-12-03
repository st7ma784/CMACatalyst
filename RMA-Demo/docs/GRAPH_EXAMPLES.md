# Graph Examples & Test Data

This document provides example graphs and test data for understanding and testing the graph system.

## Example 1: Simple DRO Eligibility Graph

### Source Text

```
Debt Relief Order (DRO) - Eligibility Criteria

A DRO can be granted if the debtor meets ALL of the following conditions:

1. Total Debt Limit: The debtor's total unsecured debt must not exceed £50,000.
   This includes all outstanding consumer debts but excludes mortgages and court fines.

2. Monthly Income: The debtor's monthly income must be less than £75.
   Income is calculated as the average of the last 12 months.

3. Previous DRO: The debtor must not have had a DRO granted in the previous 6 years.

4. Bankruptcy: The debtor must not currently be in bankruptcy.

If all conditions are met, the debtor is ELIGIBLE FOR DRO.
```

### Extracted Graph

```json
{
  "id": "graph_dro_simple_001",
  "entities": {
    "ent_001": {
      "id": "ent_001",
      "type": "threshold",
      "label": "Total Debt ≤ £50,000",
      "properties": {
        "amount": 50000,
        "currency": "GBP",
        "type": "unsecured_debt"
      },
      "confidence": 0.98,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_1",
      "description": "The debtor's total unsecured debt must not exceed £50,000",
      "examples": [
        "Credit card debt",
        "Personal loans",
        "Overdrafts",
        "Payday loans"
      ]
    },
    "ent_002": {
      "id": "ent_002",
      "type": "threshold",
      "label": "Monthly Income < £75",
      "properties": {
        "amount": 75,
        "currency": "GBP",
        "period": "monthly",
        "calculation": "average of last 12 months"
      },
      "confidence": 0.97,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_2"
    },
    "ent_003": {
      "id": "ent_003",
      "type": "criteria",
      "label": "No Previous DRO",
      "properties": {
        "lookback_period_years": 6
      },
      "confidence": 0.95,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_3"
    },
    "ent_004": {
      "id": "ent_004",
      "type": "criteria",
      "label": "Not in Bankruptcy",
      "properties": {},
      "confidence": 0.95,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_4"
    },
    "ent_005": {
      "id": "ent_005",
      "type": "condition",
      "label": "Debt ≤ £50,000",
      "properties": {},
      "confidence": 0.96,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_1"
    },
    "ent_006": {
      "id": "ent_006",
      "type": "condition",
      "label": "Income < £75/month",
      "properties": {},
      "confidence": 0.96,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_2"
    },
    "ent_007": {
      "id": "ent_007",
      "type": "condition",
      "label": "No previous DRO in 6 years",
      "properties": {},
      "confidence": 0.94,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_3"
    },
    "ent_008": {
      "id": "ent_008",
      "type": "condition",
      "label": "Not currently bankrupt",
      "properties": {},
      "confidence": 0.94,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_4"
    },
    "ent_009": {
      "id": "ent_009",
      "type": "rule",
      "label": "DRO Eligibility Rule (AND)",
      "properties": {
        "logic": "all_conditions_must_be_true"
      },
      "confidence": 0.97,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_5"
    },
    "ent_010": {
      "id": "ent_010",
      "type": "outcome",
      "label": "Eligible for DRO",
      "properties": {
        "status": "approved",
        "next_steps": ["application", "waiting_period", "order_granted"]
      },
      "confidence": 0.96,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_6"
    },
    "ent_011": {
      "id": "ent_011",
      "type": "outcome",
      "label": "Not Eligible for DRO",
      "properties": {
        "status": "rejected"
      },
      "confidence": 0.96,
      "source": "DRO_Manual_2024.pdf",
      "source_chunk_id": "chunk_6"
    }
  },
  "relations": {
    "rel_001": {
      "id": "rel_001",
      "type": "defines",
      "source_entity_id": "ent_001",
      "target_entity_id": "ent_005",
      "confidence": 0.98,
      "reasoning": "The threshold of £50k defines what constitutes a debt-eligible condition"
    },
    "rel_002": {
      "id": "rel_002",
      "type": "defines",
      "source_entity_id": "ent_002",
      "target_entity_id": "ent_006",
      "confidence": 0.98,
      "reasoning": "The threshold of £75/month defines the income condition"
    },
    "rel_003": {
      "id": "rel_003",
      "type": "part_of",
      "source_entity_id": "ent_005",
      "target_entity_id": "ent_009",
      "confidence": 0.97,
      "reasoning": "Debt condition is one of multiple criteria in the eligibility rule"
    },
    "rel_004": {
      "id": "rel_004",
      "type": "part_of",
      "source_entity_id": "ent_006",
      "target_entity_id": "ent_009",
      "confidence": 0.97,
      "reasoning": "Income condition is one of multiple criteria in the eligibility rule"
    },
    "rel_005": {
      "id": "rel_005",
      "type": "part_of",
      "source_entity_id": "ent_007",
      "target_entity_id": "ent_009",
      "confidence": 0.95,
      "reasoning": "Previous DRO check is one criterion"
    },
    "rel_006": {
      "id": "rel_006",
      "type": "part_of",
      "source_entity_id": "ent_008",
      "target_entity_id": "ent_009",
      "confidence": 0.95,
      "reasoning": "Bankruptcy check is one criterion"
    },
    "rel_007": {
      "id": "rel_007",
      "type": "implies",
      "source_entity_id": "ent_009",
      "target_entity_id": "ent_010",
      "confidence": 0.96,
      "reasoning": "Meeting ALL eligibility criteria implies eligibility for DRO"
    },
    "rel_008": {
      "id": "rel_008",
      "type": "prevents",
      "source_entity_id": "ent_005",
      "target_entity_id": "ent_010",
      "confidence": 0.90,
      "reasoning": "If debt exceeds limit, prevents DRO eligibility"
    }
  },
  "stats": {
    "total_entities": 11,
    "total_relations": 8,
    "entity_types": {
      "threshold": 2,
      "criteria": 2,
      "condition": 4,
      "rule": 1,
      "outcome": 2
    },
    "relation_types": {
      "defines": 2,
      "part_of": 4,
      "implies": 1,
      "prevents": 1
    }
  },
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T10:30:00"
}
```

## Example 2: Complex DRO with Exceptions

### Source Text

```
EXCEPTIONS TO DRO ELIGIBILITY

Self-Employed Income:
For self-employed individuals, income is calculated as the average of the last 
3 years of tax returns (not the standard 12 months). If less than 3 years of 
trading history, use available history.

Student Loans:
Student loans are treated as a separate category and may not count toward the 
£50,000 debt limit in certain circumstances. Contact the Insolvency Service 
for clarification.

Mortgage Debt:
Mortgage debt is NEVER included in the £50,000 calculation.
Only unsecured consumer debt counts.

Inherited Assets:
Assets received through inheritance within the last 5 years do not count 
toward the debtor's asset test.
```

### Graph Fragment (Exceptions)

```json
{
  "entities": {
    "ent_100": {
      "id": "ent_100",
      "type": "exception",
      "label": "Exception: Self-employed income",
      "properties": {
        "applies_to": "income_threshold",
        "calculation_period_months": 36,
        "original_period_months": 12
      },
      "confidence": 0.92,
      "description": "For self-employed, use 3-year average instead of 12-month average"
    },
    "ent_101": {
      "id": "ent_101",
      "type": "exception",
      "label": "Exception: Student loans not counted",
      "properties": {
        "applies_to": "debt_threshold",
        "treatment": "separate_category"
      },
      "confidence": 0.85,
      "description": "Student loans may not count toward the £50k limit"
    },
    "ent_102": {
      "id": "ent_102",
      "type": "exception",
      "label": "Exception: Mortgage debt excluded",
      "properties": {
        "applies_to": "debt_threshold",
        "excluded_debt_type": "mortgage"
      },
      "confidence": 0.99,
      "description": "Mortgage debt never included in debt calculation"
    }
  },
  "relations": {
    "rel_100": {
      "id": "rel_100",
      "type": "refines",
      "source_entity_id": "ent_100",
      "target_entity_id": "ent_006",
      "confidence": 0.92,
      "reasoning": "Exception refines income threshold for self-employed"
    },
    "rel_101": {
      "id": "rel_101",
      "type": "refines",
      "source_entity_id": "ent_102",
      "target_entity_id": "ent_005",
      "confidence": 0.99,
      "reasoning": "Mortgage exclusion refines how debt is calculated"
    }
  }
}
```

## Example 3: Near-Miss Scenario

### Client Data

```json
{
  "client_id": "CLIENT_456",
  "debt": 51234,
  "income": 70,
  "assets": 1500,
  "has_previous_dro": false,
  "is_bankrupt": false,
  "is_self_employed": false,
  "has_mortgage": true,
  "mortgage_balance": 120000
}
```

### Reasoning Trail

```json
{
  "question": "Is CLIENT_456 eligible for a DRO?",
  "start_conditions": {
    "debt": 51234,
    "income": 70,
    "assets": 1500
  },
  "path": [
    {
      "entity_id": "ent_005",
      "entity_label": "Debt ≤ £50,000",
      "relation_type": "check",
      "result": false,
      "actual_value": 51234,
      "threshold_value": 50000,
      "gap": 1234,
      "status": "FAIL ⚠️"
    },
    {
      "entity_id": "ent_006",
      "entity_label": "Income < £75/month",
      "relation_type": "check",
      "result": true,
      "actual_value": 70,
      "threshold_value": 75,
      "gap": -5,
      "status": "PASS ✓"
    },
    {
      "entity_id": "ent_007",
      "entity_label": "No previous DRO in 6 years",
      "relation_type": "check",
      "result": true,
      "status": "PASS ✓"
    },
    {
      "entity_id": "ent_008",
      "entity_label": "Not currently bankrupt",
      "relation_type": "check",
      "result": true,
      "status": "PASS ✓"
    },
    {
      "entity_id": "ent_009",
      "entity_label": "DRO Eligibility Rule (AND)",
      "relation_type": "evaluate",
      "result": false,
      "combined_status": "3 of 4 criteria met",
      "status": "FAIL - NEAR MISS"
    }
  ],
  "conclusion_entity_id": "ent_near_miss_001",
  "conclusion_label": "NEAR MISS - Ineligible by £1,234",
  "confidence": 0.95,
  "recommendations": [
    {
      "type": "remediation",
      "priority": "HIGH",
      "action": "Pay down £1,234 to meet debt threshold",
      "estimated_benefit": "IMMEDIATE ELIGIBILITY",
      "timeframe_days": 30
    },
    {
      "type": "alternative",
      "priority": "MEDIUM",
      "action": "Consider IVA instead (no debt limit)",
      "estimated_benefit": "Same outcome, different process",
      "timeframe_days": 60
    },
    {
      "type": "negotiation",
      "priority": "MEDIUM",
      "action": "Negotiate debt write-off with creditors",
      "estimated_benefit": "Could reduce debt below threshold",
      "timeframe_days": 60
    }
  ]
}
```

## Test Data: CSV Format

### Entities CSV

```csv
Entity ID,Entity Type,Label,Confidence,Source,Description,Examples
ent_001,threshold,Total Debt ≤ £50000,0.98,DRO_Manual_2024.pdf,The debtor's total unsecured debt must not exceed £50000,Credit card debt|Personal loans|Overdrafts
ent_002,threshold,Monthly Income < £75,0.97,DRO_Manual_2024.pdf,The debtor's monthly income must be less than £75,Salary|Benefits|Self-employment
ent_005,condition,Debt ≤ £50000,0.96,DRO_Manual_2024.pdf,Active condition that must be checked,Debt assessment
ent_006,condition,Income < £75/month,0.96,DRO_Manual_2024.pdf,Active condition that must be checked,Income verification
ent_009,rule,DRO Eligibility Rule (AND),0.97,DRO_Manual_2024.pdf,All conditions must be met,Combined criteria check
ent_010,outcome,Eligible for DRO,0.96,DRO_Manual_2024.pdf,Positive outcome,Application approval
```

### Relations CSV

```csv
Relation ID,Type,Source Entity,Target Entity,Confidence,Reasoning
rel_001,defines,Total Debt ≤ £50000,Debt ≤ £50000,0.98,Threshold defines condition
rel_003,part_of,Debt ≤ £50000,DRO Eligibility Rule (AND),0.97,Condition is part of rule
rel_007,implies,DRO Eligibility Rule (AND),Eligible for DRO,0.96,Rule completion implies eligibility
```

## Importing Test Data

### Via API

```bash
# Build graph from chunks
curl -X POST http://localhost:8102/api/graph/build \
  -H "Content-Type: application/json" \
  -d @test_graph_request.json
```

### Via Python Script

```python
from graph_builder import GraphBuilder, DebtAdviceGraph, Entity, Relation, EntityType, RelationType
import json

# Load test data
with open('example_graph_1.json') as f:
    data = json.load(f)

# Reconstruct graph
graph = DebtAdviceGraph(
    id=data['id'],
    source_documents=data.get('source_documents', [])
)

for entity_data in data['entities'].values():
    entity = Entity(
        id=entity_data['id'],
        type=EntityType(entity_data['type']),
        label=entity_data['label'],
        properties=entity_data['properties'],
        source=entity_data['source'],
        source_chunk_id=entity_data['source_chunk_id'],
        confidence=entity_data['confidence']
    )
    graph.add_entity(entity)

# Use in tests
paths = graph.find_paths('ent_010')
print(f"Found {len(paths)} paths to outcome")
```

## Query Examples

### Find all near-miss scenarios

```python
# Get all outcomes
near_misses = [e for e in graph.entities.values() 
               if 'near' in e.label.lower() or 'near' in (e.description or '').lower()]

# Find paths to near-miss outcomes
for outcome in near_misses:
    paths = graph.find_paths(outcome.id, max_depth=7)
    print(f"{outcome.label}: {len(paths)} ways to reach")
```

### Check for contradictions

```python
# Find contradicting relations
contradictions = [r for r in graph.relations.values() 
                  if r.type == RelationType.CONTRADICTS]

for contradiction in contradictions:
    source = graph.entities[contradiction.source_entity_id]
    target = graph.entities[contradiction.target_entity_id]
    print(f"Contradiction: {source.label} vs {target.label}")
```

## Performance Benchmarks

### Graph Size: ~150 Entities, ~200 Relations

- Load time: <100ms
- Path finding (10 paths): <50ms
- Render (SVG): <200ms
- Export (JSON): <50ms
- Export (CSV): <100ms

### Graph Size: ~1000 Entities, ~1500 Relations (with Neo4j)

- Load time: <500ms
- Path finding (100 paths): <200ms
- Complex queries: <1s
- Bulk operations: <5s

## Next Steps

1. Load these examples into DebtAdviceGraph component
2. Test filtering and path finding
3. Verify reasoning trail generation
4. Export and compare with source manual
5. Use for advisor training
