# Eligibility Checker Integration Guide

## Overview

The Eligibility Checker is a comprehensive system that combines RAG (Retrieval-Augmented Generation) with Decision Tree evaluation to provide structured, color-coded eligibility assessments for debt solutions like DRO (Debt Relief Orders), Bankruptcy, and IVAs.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Frontend (Next.js/React)                        │
│ - EligibilityChecker.tsx                        │
│ - Color-coded UI components                     │
│ - Real-time status indicators                   │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ Backend API Endpoint                            │
│ POST /eligibility-check                         │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ RAG Service Integration                         │
│ integrated_eligibility_check()                  │
├─────────────────────────────────────────────────┤
│ Step 1: RAG Query                               │
│   └─> Semantic search in manuals                │
│                                                  │
│ Step 2: Decision Tree Evaluation                │
│   └─> Check client values against thresholds    │
│                                                  │
│ Step 3: Criteria Breakdown                      │
│   └─> Determine status for each criterion       │
│                                                  │
│ Step 4: Near-Miss Detection                     │
│   └─> Find opportunities within tolerance       │
│                                                  │
│ Step 5: Recommendations                         │
│   └─> Generate actionable advice                │
│                                                  │
│ Step 6: Optional Diagram                        │
│   └─> Mermaid visualization of decision flow    │
└─────────────────────────────────────────────────┘
```

## Backend Components

### 1. API Endpoint

**Location:** `services/rag-service/app.py` (lines 2170-2272)

```python
@app.post("/eligibility-check", response_model=EligibilityResponse)
async def check_eligibility(request: EligibilityRequest):
    """
    Integrated eligibility check combining RAG + Decision Tree.
    
    Returns structured breakdown with:
    ✅ Criteria met
    ❌ Criteria failed  
    ⚠️ Near-misses (actionable opportunities)
    ❓ Missing information
    """
```

### 2. Pydantic Models

**Location:** `services/rag-service/app.py` (lines 85-126)

#### EligibilityRequest
```python
class EligibilityRequest(BaseModel):
    question: str
    debt: Optional[float] = None
    income: Optional[float] = None
    assets: Optional[float] = None
    topic: str = "dro_eligibility"
    include_diagram: bool = False
```

#### CriterionStatus
```python
class CriterionStatus(BaseModel):
    criterion: str              # "debt", "income", "assets"
    threshold_value: float
    client_value: Optional[float]
    status: str                 # "eligible", "not_eligible", "near_miss", "unknown"
    gap: Optional[float]        # How much over/under threshold
    operator: Optional[str]     # "<=", ">=", etc.
    explanation: str
```

#### EligibilityResponse
```python
class EligibilityResponse(BaseModel):
    answer: str                 # Natural language from RAG
    overall_result: str         # "eligible", "not_eligible", "requires_review", "incomplete_information"
    confidence: float
    criteria: List[CriterionStatus]
    near_misses: List[Dict]
    recommendations: List[Dict]
    sources: List[str]
    diagram: Optional[str] = None
```

### 3. Core Integration Method

**Location:** `services/rag-service/app.py` (lines 1805-2042)

```python
def integrated_eligibility_check(
    self,
    question: str,
    client_values: Dict[str, float],
    topic: str = "dro_eligibility",
    model_name: str = "gpt-4o-mini",
    include_diagram: bool = False
) -> dict:
```

**Status Determination Logic:**
```python
if client_value is None:
    status = "unknown"          # ❓ Value not provided
elif is_near_miss:
    status = "near_miss"        # ⚠️ Within tolerance
elif passes_criterion:
    status = "eligible"         # ✅ Meets requirement
else:
    status = "not_eligible"     # ❌ Fails requirement
```

### 4. Helper Methods

**Location:** `services/rag-service/app.py` (lines 2042-2095)

- `_extract_tree_thresholds()` - Recursively get all thresholds from decision tree
- `_evaluate_criterion()` - Boolean evaluation of criterion (value vs threshold)
- `_find_near_miss_for_criterion()` - Lookup near-miss rules for specific criterion

## Frontend Components

### 1. EligibilityChecker Component

**Location:** `RMA-Demo/frontend/src/components/EligibilityChecker.tsx`

**Features:**
- TypeScript/React with full type safety
- Tailwind CSS for styling
- Color-coded status indicators
- Responsive grid layout
- Real-time API integration

**Status Colors:**
```typescript
✅ Eligible:      Green  (bg-green-50, border-green-500)
❌ Not Eligible:  Red    (bg-red-50, border-red-500)
⚠️ Near-Miss:     Yellow (bg-yellow-50, border-yellow-500)
❓ Unknown:       Gray   (bg-gray-50, border-gray-500)
```

### 2. UI Sections

#### Overall Result Banner
```typescript
<Card className={`p-6 border-2 ${getOverallResultColor(result.overall_result)}`}>
  <h3>Overall Result: ELIGIBLE</h3>
  <div>Confidence: 85%</div>
</Card>
```

#### Criteria Breakdown Grid
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {result.criteria.map((criterion) => (
    <Card className={`border-l-4 ${getStatusColor(criterion.status)}`}>
      <div className="flex items-center gap-2">
        <span>{getStatusIcon(criterion.status)}</span>
        <span>{criterion.criterion}</span>
      </div>
      <div>Threshold: £{criterion.threshold_value}</div>
      <div>Your Value: £{criterion.client_value}</div>
      {criterion.gap > 0 && (
        <div className="text-red-700">Gap: £{criterion.gap}</div>
      )}
      <div className="italic">{criterion.explanation}</div>
    </Card>
  ))}
</div>
```

#### Near-Miss Opportunities
```typescript
<Card className="bg-yellow-50 border-yellow-500">
  <h4>⚠️ Near-Miss Opportunities:</h4>
  <p>You're close! Here are opportunities to qualify:</p>
  {result.near_misses.map((nearMiss) => (
    <Card>
      <strong>{nearMiss.threshold_name}</strong>
      <span>Within £{nearMiss.tolerance} tolerance</span>
      <ul>
        {nearMiss.strategies.map((strategy) => (
          <li>
            <strong>{strategy.description}</strong>
            <ul>
              {strategy.actions.map((action) => (
                <li>• {action}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  ))}
</Card>
```

#### Recommendations
```typescript
<Card className="bg-blue-50 border-blue-500">
  <h4>💡 Recommendations:</h4>
  {result.recommendations.map((rec) => (
    <Card className={`border-l-4 priority-${rec.priority}`}>
      <span className={getPriorityColor(rec.priority)}>
        {rec.priority} priority
      </span>
      <p>{rec.action}</p>
      <ul>
        {rec.steps.map((step) => (
          <li>• {step}</li>
        ))}
      </ul>
    </Card>
  ))}
</Card>
```

## Integration into Main Dashboard

**Location:** `RMA-Demo/frontend/src/app/page.tsx`

Added new tab to the main advisor dashboard:

```tsx
<TabsList className="grid w-full grid-cols-7 mb-8">
  {/* ... existing tabs ... */}
  <TabsTrigger value="eligibility" className="flex items-center gap-2">
    <CheckCircle className="h-4 w-4" />
    Eligibility
  </TabsTrigger>
</TabsList>

<TabsContent value="eligibility">
  <EligibilityChecker />
</TabsContent>
```

## Example Request/Response

### Request
```json
{
  "question": "Can I get a DRO?",
  "debt": 51000,
  "income": 70,
  "assets": 1500,
  "topic": "dro_eligibility",
  "include_diagram": false
}
```

### Response
```json
{
  "answer": "Based on the Debt Relief Order manual, the maximum debt limit is £50,000. Your debt of £51,000 exceeds this limit by £1,000. However, you meet the income requirement (£70 vs £75 limit) and the assets requirement (£1,500 vs £2,000 limit).",
  "overall_result": "requires_review",
  "confidence": 0.85,
  "criteria": [
    {
      "criterion": "debt",
      "threshold_value": 50000,
      "client_value": 51000,
      "status": "near_miss",
      "gap": 1000,
      "operator": "<=",
      "explanation": "Within £1,000 of threshold - remediation possible"
    },
    {
      "criterion": "income",
      "threshold_value": 75,
      "client_value": 70,
      "status": "eligible",
      "gap": null,
      "operator": "<=",
      "explanation": "Meets requirement: income <= £75"
    },
    {
      "criterion": "assets",
      "threshold_value": 2000,
      "client_value": 1500,
      "status": "eligible",
      "gap": null,
      "operator": "<=",
      "explanation": "Meets requirement: assets <= £2,000"
    }
  ],
  "near_misses": [
    {
      "threshold_name": "DRO Debt Limit (2024)",
      "tolerance": 2000,
      "strategies": [
        {
          "description": "Pay down £1,000 to qualify",
          "actions": [
            "Current debt: £51,000",
            "Target debt: £50,000",
            "Options: lump sum payment, debt write-off negotiation"
          ],
          "likelihood": "high"
        }
      ]
    }
  ],
  "recommendations": [
    {
      "type": "near_miss_action",
      "priority": "high",
      "action": "Reduce debt by £1,000 to meet debt_limit",
      "steps": [
        "Current: £51,000",
        "Target: £50,000",
        "Potential strategies: Pay down priority debts, negotiate settlements"
      ]
    }
  ],
  "sources": [
    "DRO_Manual_2024.pdf - Section 3.2: Eligibility Criteria",
    "DRO_Manual_2024.pdf - Section 4.1: Debt Limits"
  ]
}
```

## Usage Example

### Client Scenario
A client with:
- £51,000 debt
- £70 monthly income
- £1,500 in assets
- Question: "Can I get a DRO?"

### UI Display

**Overall Result Banner:**
```
┌─────────────────────────────────────────┐
│ ⚠️ OVERALL RESULT: REQUIRES REVIEW      │
│    Confidence: 85%                      │
└─────────────────────────────────────────┘
```

**Criteria Breakdown:**
```
┌──────────────┬──────────────┬──────────────┐
│ ❌ DEBT      │ ✅ INCOME    │ ✅ ASSETS    │
├──────────────┼──────────────┼──────────────┤
│ Threshold:   │ Threshold:   │ Threshold:   │
│ £50,000      │ £75          │ £2,000       │
│              │              │              │
│ Your Value:  │ Your Value:  │ Your Value:  │
│ £51,000      │ £70          │ £1,500       │
│              │              │              │
│ Gap: £1,000  │ ✓ Eligible   │ ✓ Eligible   │
│              │              │              │
│ Near-miss -  │ Meets        │ Meets        │
│ remediation  │ requirement  │ requirement  │
│ possible     │              │              │
└──────────────┴──────────────┴──────────────┘
```

**Near-Miss Opportunities:**
```
⚠️ You're close! Here are opportunities to qualify:

┌─────────────────────────────────────────────┐
│ DRO Debt Limit (2024)                       │
│ Within £2,000 tolerance                     │
│                                             │
│ Possible strategies:                        │
│ • Pay down £1,000 to qualify                │
│   - Current debt: £51,000                   │
│   - Target debt: £50,000                    │
│   - Options: lump sum, debt write-off       │
└─────────────────────────────────────────────┘
```

**Recommendations:**
```
💡 HIGH PRIORITY: Reduce debt by £1,000 to meet debt_limit
   • Current: £51,000
   • Target: £50,000
   • Potential strategies: Pay down priority debts, negotiate settlements
```

## Color-Coding Guide

### Status Indicators

| Status | Icon | Color | Border | Meaning |
|--------|------|-------|--------|---------|
| **Eligible** | ✅ | Green 50 | Green 500 | Criterion met |
| **Not Eligible** | ❌ | Red 50 | Red 500 | Criterion failed |
| **Near-Miss** | ⚠️ | Yellow 50 | Yellow 500 | Within tolerance |
| **Unknown** | ❓ | Gray 50 | Gray 500 | Value not provided |

### Priority Colors

| Priority | Badge Color | Border |
|----------|-------------|--------|
| **High** | Red 500 | Red 600 |
| **Medium** | Yellow 500 | Yellow 600 |
| **Low** | Green 500 | Green 600 |

### Overall Result Colors

| Result | Background | Border | Text |
|--------|------------|--------|------|
| **Eligible** | Green 100 | Green 500 | Green 900 |
| **Not Eligible** | Red 100 | Red 500 | Red 900 |
| **Requires Review** | Yellow 100 | Yellow 500 | Yellow 900 |
| **Incomplete Info** | Gray 100 | Gray 500 | Gray 900 |

## Testing

### 1. Test DRO Eligibility (All Criteria Met)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can I get a DRO?",
    "debt": 45000,
    "income": 70,
    "assets": 1500,
    "topic": "dro_eligibility"
  }'
```

**Expected Result:**
- Overall: `eligible`
- All criteria: `eligible` status
- No near-misses
- Recommendations: None or informational

### 2. Test Near-Miss Scenario
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can I get a DRO?",
    "debt": 51000,
    "income": 70,
    "assets": 1500,
    "topic": "dro_eligibility"
  }'
```

**Expected Result:**
- Overall: `requires_review`
- Debt criterion: `near_miss` status with gap = 1000
- Income/Assets: `eligible` status
- Near-misses: 1 opportunity detected
- Recommendations: "Pay £1k to qualify"

### 3. Test Incomplete Information
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can I get a DRO?",
    "debt": 45000,
    "topic": "dro_eligibility"
  }'
```

**Expected Result:**
- Overall: `incomplete_information`
- Debt criterion: `eligible` status
- Income/Assets: `unknown` status
- Recommendations: "Please provide income and assets"

### 4. Test Multiple Failures
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can I get a DRO?",
    "debt": 60000,
    "income": 100,
    "assets": 3000,
    "topic": "dro_eligibility"
  }'
```

**Expected Result:**
- Overall: `not_eligible`
- All criteria: `not_eligible` status
- No near-misses
- Recommendations: Alternative debt solutions

## Deployment

### Backend

1. Ensure RAG service is running:
```bash
cd services/rag-service
docker-compose up -d
```

2. Verify endpoint is accessible:
```bash
curl http://localhost:8102/health
```

### Frontend

1. Install dependencies:
```bash
cd RMA-Demo/frontend
npm install
```

2. Update environment variables:
```bash
# .env.local
NEXT_PUBLIC_RAG_SERVICE_URL=http://localhost:8102
```

3. Start development server:
```bash
npm run dev
```

4. Access eligibility checker:
```
http://localhost:3000
→ Navigate to "Eligibility" tab
```

## Known Limitations

### Current Issues

1. **Tree Optimization**: Decision tree builds all thresholds in deep linear chain
   - Need to filter by topic (DRO vs Bankruptcy vs IVA)
   - Need to prioritize thresholds (debt > income > assets)
   - Need to group related checks

2. **API URL Hardcoding**: Frontend component has hardcoded URL
   - Should use environment variable: `process.env.NEXT_PUBLIC_RAG_SERVICE_URL`

3. **Error Handling**: Limited error handling for network failures
   - Should add retry logic
   - Should add better error messages

### Future Enhancements

1. **Client Value Pre-filling**: Auto-populate from client profile
2. **Historical Tracking**: Store eligibility checks over time
3. **Comparison Mode**: Compare multiple debt solutions side-by-side
4. **PDF Export**: Generate PDF report of eligibility assessment
5. **Email Integration**: Send results to client
6. **Real-time Collaboration**: Share screen with client during consultation

## Troubleshooting

### Issue: "Failed to load eligibility check"

**Cause:** Backend service not running or wrong URL

**Solution:**
```bash
# Check backend is running
docker ps | grep rag-service

# Check logs
docker logs rag-service

# Restart if needed
docker-compose restart rag-service
```

### Issue: All criteria show "unknown"

**Cause:** Client values not being sent in request

**Solution:**
- Verify form values are populated
- Check browser console for errors
- Inspect network request payload

### Issue: Near-misses not detected

**Cause:** Decision tree not built or thresholds not defined

**Solution:**
```bash
# Rebuild decision tree
curl -X POST http://localhost:8102/rebuild-tree \
  -H "Content-Type: application/json" \
  -d '{"topic": "dro_eligibility"}'
```

### Issue: Diagram not rendering

**Cause:** Mermaid syntax error or diagram too large

**Solution:**
- Check `include_diagram: true` in request
- Verify Mermaid syntax in response
- Use external Mermaid renderer if needed

## Support

For issues or questions:
1. Check logs: `docker logs rag-service`
2. Review API documentation: `/docs` endpoint
3. Test with curl examples above
4. Check frontend console for errors

## Related Documentation

- **Symbolic Reasoning**: `services/rag-service/symbolic_reasoning.py`
- **Decision Tree Builder**: `services/rag-service/decision_tree_builder.py`
- **Tree Visualizer**: `services/rag-service/tree_visualizer.py`
- **API Reference**: `http://localhost:8102/docs`
- **Frontend Components**: `RMA-Demo/frontend/src/components/`

## Changelog

### v1.0.0 (Current)
- ✅ Backend integration complete
- ✅ Frontend UI component with color-coding
- ✅ Structured criteria breakdown
- ✅ Near-miss detection with gap calculation
- ✅ Recommendation generation
- ✅ Optional Mermaid diagram
- ✅ Integrated into main dashboard

### Upcoming (v1.1.0)
- ❌ Tree optimization (topic filtering)
- ❌ Client value pre-filling from profile
- ❌ PDF export functionality
- ❌ Historical eligibility tracking
- ❌ Comparison mode for multiple solutions
