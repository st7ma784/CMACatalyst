# Eligibility Checker - Dual Mode Operation

## Overview

The Eligibility Checker now supports **TWO distinct modes** of operation, making it versatile for both hypothetical questions and real client assessments:

### 🔵 Mode 1: Manual Input (Hypothetical)
**Use Case**: "Ask the Manuals" tab  
**Scenario**: Advisor wants to explore what-if scenarios  
**Example**: "What if someone has £51,000 debt - can they get a DRO?"

### 🟢 Mode 2: Client Documents (RAG)
**Use Case**: "Client Document Search" tab  
**Scenario**: Advisor assessing real client with uploaded documents  
**Example**: "Is CLIENT123 eligible for a DRO?"

---

## Mode 1: Manual Input (Hypothetical Questions)

### Purpose
Answer hypothetical eligibility questions without needing actual client data.

### How It Works
1. User provides financial values directly in the form
2. System evaluates against decision tree thresholds
3. Returns color-coded eligibility assessment

### UI Flow

```
┌─────────────────────────────────────────┐
│ Mode: 📝 Manual Input (Hypothetical)    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Question:                               │
│ "Can someone with £51k debt get a DRO?" │
└─────────────────────────────────────────┘
              ↓
┌───────────┬───────────┬──────────┐
│ Debt:     │ Income:   │ Assets:  │
│ £51,000   │ £70       │ £1,500   │
└───────────┴───────────┴──────────┘
              ↓
        [Check Eligibility]
              ↓
┌─────────────────────────────────────────┐
│ ⚠️ REQUIRES REVIEW                      │
│                                         │
│ ⚠️ DEBT: £51k vs £50k limit (Gap: £1k) │
│ ✅ INCOME: £70 vs £75 limit            │
│ ✅ ASSETS: £1.5k vs £2k limit          │
│                                         │
│ 💡 Recommendation: Pay £1k to qualify   │
└─────────────────────────────────────────┘
```

### Example API Request (Manual Mode)

```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can someone with £51,000 debt get a DRO?",
    "debt": 51000,
    "income": 70,
    "assets": 1500,
    "topic": "dro_eligibility",
    "include_diagram": false
  }'
```

### Example Response

```json
{
  "answer": "Based on the Debt Relief Order manual, the maximum debt limit is £50,000. The client's debt of £51,000 exceeds this by £1,000, placing them just outside the eligibility criteria. However, they meet both the income requirement (£70 vs £75 limit) and assets requirement (£1,500 vs £2,000 limit).",
  "overall_result": "requires_review",
  "confidence": 0.85,
  "criteria": [
    {
      "criterion": "debt",
      "threshold_name": "debt_limit",
      "threshold_value": 50000,
      "client_value": 51000,
      "status": "near_miss",
      "gap": 1000,
      "operator": "<=",
      "explanation": "Within £1,000 of threshold - remediation possible"
    },
    {
      "criterion": "income",
      "threshold_name": "income_limit",
      "threshold_value": 75,
      "client_value": 70,
      "status": "eligible",
      "gap": null,
      "operator": "<=",
      "explanation": "Meets requirement: income <= £75"
    },
    {
      "criterion": "assets",
      "threshold_name": "assets_limit",
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
      "gap": 1000,
      "strategies": [
        {
          "description": "Pay down £1,000 to qualify",
          "actions": [
            "Current debt: £51,000",
            "Target debt: £50,000",
            "Options: Lump sum payment, debt write-off negotiation"
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
    "DRO_Manual_2024.pdf - Section 3.2: Eligibility Criteria"
  ]
}
```

---

## Mode 2: Client Documents (RAG Extraction)

### Purpose
Assess real clients by extracting financial values from their uploaded documents.

### How It Works
1. User selects client from dropdown
2. System queries client's document vectorstore
3. Symbolic reasoning extracts exact debt/income/assets values
4. Evaluates against decision tree thresholds
5. Returns same color-coded assessment

### UI Flow

```
┌─────────────────────────────────────────┐
│ Mode: 👤 Client Documents (RAG)         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Question:                               │
│ "Is this client eligible for a DRO?"    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Select Client:                          │
│ ▼ John Smith (CLIENT123)                │
└─────────────────────────────────────────┘
              ↓
        [Check Eligibility]
              ↓
    (System extracts values from
     client's uploaded documents)
              ↓
┌─────────────────────────────────────────┐
│ 📄 Extracted from documents:            │
│    Debt: £51,234 (from bank statement)  │
│    Income: £68 (from payslip)           │
│    Assets: £1,450 (from asset list)     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ ⚠️ REQUIRES REVIEW                      │
│                                         │
│ ⚠️ DEBT: £51.2k vs £50k (Gap: £1.2k)   │
│ ✅ INCOME: £68 vs £75 limit            │
│ ✅ ASSETS: £1.45k vs £2k limit         │
│                                         │
│ 💡 Recommendation: Pay £1.2k to qualify │
└─────────────────────────────────────────┘
```

### Example API Request (Client Mode)

```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Is this client eligible for a DRO?",
    "client_id": "CLIENT123",
    "topic": "dro_eligibility",
    "include_diagram": false
  }'
```

### Backend Processing

```python
# 1. Detect client_id provided
if request.client_id:
    # 2. Query client's document vectorstore
    extraction_query = """
    Extract the following information:
    - Total debt amount
    - Monthly income
    - Total assets value
    """
    
    client_vectorstore = rag_service.client_vectorstores[request.client_id]
    results = client_vectorstore.query(
        query_texts=[extraction_query],
        n_results=5
    )
    
    # 3. Use symbolic reasoning to extract exact values
    context = "\n".join(results['documents'][0])
    symbolic_result = rag_service.symbolic_reasoning.extract_and_compute(
        question=extraction_query,
        manual_text=context,
        model_name=request.model
    )
    
    # 4. Parse extracted values
    for comp in symbolic_result['comparisons']:
        if 'debt' in comp['role_1'].lower():
            client_values['debt'] = comp['actual_value_1']
        elif 'income' in comp['role_1'].lower():
            client_values['income'] = comp['actual_value_1']
        elif 'assets' in comp['role_1'].lower():
            client_values['assets'] = comp['actual_value_1']
    
    # 5. Continue with normal eligibility check
    result = rag_service.integrated_eligibility_check(
        question=request.question,
        client_values=client_values,  # Extracted from documents!
        topic=request.topic,
        model_name=request.model,
        include_diagram=request.include_diagram
    )
```

### Document Extraction Examples

#### Example 1: Bank Statement
```
Document content:
"Account balance as of March 2024: £1,450
 Total outstanding debt: £51,234 (credit cards + loans)"

Extracted:
- debt: 51234
- assets: 1450
```

#### Example 2: Payslip
```
Document content:
"Net monthly income: £68.50
 Deductions: Tax £15, NI £8"

Extracted:
- income: 68.50
```

#### Example 3: Asset List
```
Document content:
"Vehicle value: £800
 Savings: £650
 Total assets: £1,450"

Extracted:
- assets: 1450
```

---

## Comparison: Manual vs Client Mode

| Aspect | Manual Input | Client Documents |
|--------|--------------|------------------|
| **Use Case** | Hypothetical scenarios | Real client assessment |
| **Values Source** | User types in form | Extracted from documents |
| **Accuracy** | Depends on user input | Depends on document quality |
| **Speed** | Immediate | Slightly slower (extraction) |
| **Best For** | "What if" questions | Actual eligibility checks |
| **Example Tab** | "Ask the Manuals" | "Client Document Search" |

---

## Integration Points

### Frontend Components

#### EligibilityChecker.tsx (Standalone)
- Accessed via "Eligibility" tab in main dashboard
- Has mode selector (Manual/Client)
- Can be used for both scenarios

#### AskTheManuals.tsx
- Natural place for Manual mode
- Add button: "Check Eligibility with These Values"
- Pre-fills form with hypothetical values

#### ClientDocumentSearch.tsx
- Natural place for Client mode
- Add button: "Check This Client's Eligibility"
- Auto-selects client_id from search context

### Backend Endpoint

```python
@app.post("/eligibility-check")
async def check_eligibility(request: EligibilityRequest):
    """
    Dual-mode eligibility check:
    
    Mode 1 (Manual): Provide debt/income/assets
    Mode 2 (Client): Provide client_id
    
    Both return identical EligibilityResponse structure.
    """
```

---

## Usage Scenarios

### Scenario 1: Advisor Exploring Options
**Context**: Advisor in consultation, client mentions £51k debt  
**Action**: Switch to Manual mode  
**Input**:
- Question: "Can someone with £51k debt get a DRO?"
- Debt: 51000
- Income: 70
- Assets: 1500

**Result**: Immediate feedback showing near-miss opportunity

---

### Scenario 2: Formal Client Assessment
**Context**: Client uploaded bank statements, payslips  
**Action**: Switch to Client mode  
**Input**:
- Question: "Is this client eligible for a DRO?"
- Client: John Smith (CLIENT123)

**Result**: Values extracted from documents, formal eligibility report

---

### Scenario 3: Comparison Shopping
**Context**: Advisor wants to compare DRO vs Bankruptcy  

**Manual Mode - DRO**:
```json
{
  "question": "DRO eligibility?",
  "debt": 51000,
  "topic": "dro_eligibility"
}
```

**Manual Mode - Bankruptcy**:
```json
{
  "question": "Bankruptcy eligibility?",
  "debt": 51000,
  "topic": "bankruptcy_eligibility"
}
```

**Result**: Side-by-side comparison of options

---

### Scenario 4: Progress Tracking
**Context**: Client paying down debt over time  

**Month 1 (Client Mode)**:
```json
{
  "client_id": "CLIENT123",
  "question": "Current eligibility?"
}
```
Result: £51k debt - near-miss

**Month 3 (Client Mode)**:
```json
{
  "client_id": "CLIENT123",
  "question": "Current eligibility?"
}
```
Result: £49k debt - eligible!

---

## Benefits of Dual Mode

### For Advisors
✅ **Flexibility**: One tool for both hypothetical and real assessments  
✅ **Speed**: Quick what-if analysis without uploading documents  
✅ **Accuracy**: Document extraction eliminates manual entry errors  
✅ **Consistency**: Same UI/UX for both modes

### For Clients
✅ **Privacy**: Hypothetical questions don't require revealing identity  
✅ **Thoroughness**: Document-based assessment uses actual data  
✅ **Transparency**: See exactly what values were extracted  
✅ **Actionable**: Get specific recommendations based on real numbers

### For Development
✅ **Reusability**: Same backend logic for both modes  
✅ **Testability**: Easy to test with manual values  
✅ **Scalability**: Add more modes (e.g., API integration) easily  
✅ **Maintainability**: Single source of truth for eligibility rules

---

## Technical Implementation

### Frontend Mode Toggle

```typescript
const [mode, setMode] = useState<'manual' | 'client'>('manual');

// Mode selector buttons
<div className="flex gap-2">
  <button
    onClick={() => setMode('manual')}
    className={mode === 'manual' ? 'bg-blue-600' : 'bg-white'}
  >
    📝 Manual Input
  </button>
  <button
    onClick={() => setMode('client')}
    className={mode === 'client' ? 'bg-blue-600' : 'bg-white'}
  >
    👤 Client Documents
  </button>
</div>

// Conditional form rendering
{mode === 'manual' && (
  <div>
    <input name="debt" type="number" />
    <input name="income" type="number" />
    <input name="assets" type="number" />
  </div>
)}

{mode === 'client' && (
  <select name="client_id">
    {clients.map(c => <option value={c.client_id}>{c.name}</option>)}
  </select>
)}
```

### Backend Mode Detection

```python
# Detect mode based on request fields
if request.client_id:
    # Mode 2: Client Documents
    logger.info("MODE: Client Documents (RAG extraction)")
    
    # Extract values from client vectorstore
    client_vectorstore = rag_service.client_vectorstores[request.client_id]
    results = client_vectorstore.query(...)
    
    # Use symbolic reasoning for extraction
    symbolic_result = rag_service.symbolic_reasoning.extract_and_compute(...)
    
    # Parse extracted values
    client_values = parse_symbolic_result(symbolic_result)
else:
    # Mode 1: Manual Input
    logger.info("MODE: Manual Input")
    
    # Use provided values directly
    client_values = {
        'debt': request.debt,
        'income': request.income,
        'assets': request.assets
    }

# Continue with same eligibility check logic
result = rag_service.integrated_eligibility_check(
    question=request.question,
    client_values=client_values,  # Source doesn't matter!
    ...
)
```

---

## Error Handling

### Manual Mode Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing values" | Not all fields filled | Mark optional, show "unknown" status |
| "Invalid number" | Non-numeric input | Frontend validation |
| "Negative value" | Debt/income/assets < 0 | Frontend validation |

### Client Mode Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Client not found" | Invalid client_id | Show dropdown of valid clients |
| "No documents" | Client uploaded nothing | Fallback to manual mode |
| "Extraction failed" | Poor document quality | Show "unknown" status, suggest manual |
| "Ambiguous values" | Multiple conflicting amounts | Show all options, ask for clarification |

---

## Testing Both Modes

### Test 1: Manual Mode (All Eligible)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -d '{"question": "DRO eligibility?", "debt": 45000, "income": 70, "assets": 1500}'
```
**Expected**: All ✅ green

### Test 2: Manual Mode (Near-Miss)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -d '{"question": "DRO eligibility?", "debt": 51000, "income": 70, "assets": 1500}'
```
**Expected**: Debt ⚠️ yellow, others ✅ green

### Test 3: Manual Mode (Not Eligible)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -d '{"question": "DRO eligibility?", "debt": 60000, "income": 100, "assets": 3000}'
```
**Expected**: All ❌ red

### Test 4: Client Mode (With Documents)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -d '{"question": "Is CLIENT123 eligible?", "client_id": "CLIENT123"}'
```
**Expected**: Values extracted from documents, status determined

### Test 5: Client Mode (No Documents)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -d '{"question": "Is NEWCLIENT eligible?", "client_id": "NEWCLIENT"}'
```
**Expected**: All ❓ gray (unknown)

---

## Future Enhancements

### Phase 2: Hybrid Mode
Combine both approaches:
- Start with client documents
- Allow advisor to override extracted values
- Useful for "what if client paid £1k" scenarios

### Phase 3: Historical Tracking
- Store eligibility checks over time
- Chart progress: "Client was near-miss 3 months ago, now eligible"
- Automatic alerts when status changes

### Phase 4: Bulk Assessment
- Upload CSV of hypothetical scenarios
- Run eligibility checks in parallel
- Export results as Excel report

---

## Summary

The dual-mode Eligibility Checker provides:

1. **Flexibility**: Handle both hypothetical and real client scenarios
2. **Accuracy**: Symbolic reasoning extracts exact values from documents
3. **Consistency**: Same UI/UX and response structure for both modes
4. **Integration**: Works seamlessly with "Ask the Manuals" and "Client Search" tabs
5. **Actionable**: Always provides color-coded status and recommendations

**Both modes** produce the same high-quality output:
- ✅❌⚠️❓ Color-coded status indicators
- Natural language answers from manuals
- Structured criteria breakdown
- Near-miss opportunities
- Priority-based recommendations
- Optional decision tree diagrams

**The system is now production-ready for both advisor consultation (manual) and formal client assessment (documents)!**
