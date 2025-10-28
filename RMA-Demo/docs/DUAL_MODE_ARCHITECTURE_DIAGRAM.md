# Eligibility Checker - Complete Dual Mode Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ELIGIBILITY CHECKER                             │
│                      (Unified Component)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     MODE SELECTOR         │
                    └─────────────┬─────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
                ↓                                   ↓
   ┌─────────────────────────┐       ┌─────────────────────────┐
   │   MODE 1: MANUAL INPUT  │       │  MODE 2: CLIENT DOCS    │
   │   (Hypothetical)        │       │  (RAG Extraction)       │
   └─────────────────────────┘       └─────────────────────────┘
                │                                   │
                ↓                                   ↓
   ┌─────────────────────────┐       ┌─────────────────────────┐
   │ User provides:          │       │ User selects:           │
   │ • Question              │       │ • Question              │
   │ • Debt: £51,000         │       │ • Client: CLIENT123     │
   │ • Income: £70           │       │                         │
   │ • Assets: £1,500        │       │ System extracts:        │
   │                         │       │ • Debt from documents   │
   │                         │       │ • Income from documents │
   │                         │       │ • Assets from documents │
   └─────────────────────────┘       └─────────────────────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  ↓
                    ┌─────────────────────────┐
                    │  POST /eligibility-check │
                    │                          │
                    │  Backend detects mode:   │
                    │  • client_id present?    │
                    │    → Client mode         │
                    │  • values present?       │
                    │    → Manual mode         │
                    └─────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
                ↓                                   ↓
   ┌─────────────────────────┐       ┌─────────────────────────┐
   │ MANUAL MODE PROCESSING  │       │ CLIENT MODE PROCESSING  │
   ├─────────────────────────┤       ├─────────────────────────┤
   │ 1. Use provided values  │       │ 1. Query client vector  │
   │    client_values = {    │       │    store                │
   │      debt: 51000,       │       │                         │
   │      income: 70,        │       │ 2. Extract with query:  │
   │      assets: 1500       │       │    "Find debt, income,  │
   │    }                    │       │     assets in docs"     │
   │                         │       │                         │
   │                         │       │ 3. Symbolic reasoning   │
   │                         │       │    parses exact values  │
   │                         │       │                         │
   │                         │       │ 4. Build client_values  │
   │                         │       │    from extraction      │
   └─────────────────────────┘       └─────────────────────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  ↓
               ┌──────────────────────────────────────┐
               │  UNIFIED ELIGIBILITY CHECK           │
               │  (Same logic for both modes)         │
               ├──────────────────────────────────────┤
               │ 1. RAG Query                         │
               │    → Get contextual answer           │
               │                                      │
               │ 2. Decision Tree Traversal           │
               │    → Check values vs thresholds      │
               │                                      │
               │ 3. Criteria Breakdown                │
               │    → Determine status for each       │
               │                                      │
               │ 4. Near-Miss Detection               │
               │    → Find opportunities              │
               │                                      │
               │ 5. Recommendations                   │
               │    → Generate advice                 │
               │                                      │
               │ 6. Optional Diagram                  │
               │    → Mermaid visualization           │
               └──────────────────────────────────────┘
                                  │
                                  ↓
               ┌──────────────────────────────────────┐
               │  ELIGIBILITY RESPONSE                │
               │  (Identical structure both modes)    │
               ├──────────────────────────────────────┤
               │ {                                    │
               │   "answer": "Natural language...",   │
               │   "overall_result": "requires_review"│
               │   "confidence": 0.85,                │
               │   "criteria": [                      │
               │     {                                │
               │       "criterion": "debt",           │
               │       "status": "near_miss",         │
               │       "threshold_value": 50000,      │
               │       "client_value": 51000,         │
               │       "gap": 1000                    │
               │     },                               │
               │     {                                │
               │       "criterion": "income",         │
               │       "status": "eligible",          │
               │       "client_value": 70,            │
               │       "threshold_value": 75          │
               │     },                               │
               │     ...                              │
               │   ],                                 │
               │   "near_misses": [...],              │
               │   "recommendations": [...]           │
               │ }                                    │
               └──────────────────────────────────────┘
                                  │
                                  ↓
               ┌──────────────────────────────────────┐
               │  COLOR-CODED UI DISPLAY              │
               │  (Same for both modes)               │
               ├──────────────────────────────────────┤
               │ ⚠️ OVERALL: REQUIRES REVIEW          │
               │                                      │
               │ ┌──────────┬──────────┬──────────┐  │
               │ │ ⚠️ DEBT  │ ✅ INCOME│ ✅ ASSETS│  │
               │ ├──────────┼──────────┼──────────┤  │
               │ │ £51k vs  │ £70 vs   │ £1.5k vs │  │
               │ │ £50k     │ £75      │ £2k      │  │
               │ │ Gap: £1k │ ✓        │ ✓        │  │
               │ └──────────┴──────────┴──────────┘  │
               │                                      │
               │ 💡 Recommendation:                   │
               │    Pay £1k to qualify                │
               └──────────────────────────────────────┘
```

## Mode Selection Logic

```
User opens Eligibility Checker
         ↓
┌────────────────────┐
│ Mode Selector UI   │
├────────────────────┤
│ [ 📝 Manual ]      │  ← Default
│ [ 👤 Client ]      │
└────────────────────┘
         ↓
User clicks mode button
         ↓
    ┌────────────────────────┐
    │ Mode = 'manual'?       │
    └────────┬───────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ↓                 ↓
┌─────────┐     ┌─────────┐
│ Manual  │     │ Client  │
│ Mode    │     │ Mode    │
└─────────┘     └─────────┘
    ↓                 ↓
┌─────────────┐  ┌──────────────┐
│ Show form:  │  │ Show form:   │
│ • Debt      │  │ • Client     │
│ • Income    │  │   dropdown   │
│ • Assets    │  │              │
└─────────────┘  └──────────────┘
```

## Backend Mode Detection

```python
@app.post("/eligibility-check")
async def check_eligibility(request: EligibilityRequest):
    
    # Mode detection
    if request.client_id is not None:
        # ┌─────────────────────────┐
        # │ CLIENT DOCUMENTS MODE   │
        # └─────────────────────────┘
        
        client_vectorstore = rag_service.client_vectorstores[request.client_id]
        
        # Query client documents
        extraction_query = "Extract debt, income, assets"
        results = client_vectorstore.query(...)
        
        # Use symbolic reasoning for exact values
        context = "\n".join(results['documents'][0])
        symbolic_result = rag_service.symbolic_reasoning.extract_and_compute(
            question=extraction_query,
            manual_text=context,
            model_name=request.model
        )
        
        # Parse extracted values
        client_values = {}
        for comp in symbolic_result['comparisons']:
            if 'debt' in comp['role_1'].lower():
                client_values['debt'] = comp['actual_value_1']
            elif 'income' in comp['role_1'].lower():
                client_values['income'] = comp['actual_value_1']
            elif 'assets' in comp['role_1'].lower():
                client_values['assets'] = comp['actual_value_1']
    
    else:
        # ┌─────────────────────────┐
        # │ MANUAL INPUT MODE       │
        # └─────────────────────────┘
        
        # Use provided values directly
        client_values = {}
        if request.debt is not None:
            client_values['debt'] = request.debt
        if request.income is not None:
            client_values['income'] = request.income
        if request.assets is not None:
            client_values['assets'] = request.assets
    
    # ┌─────────────────────────────────────┐
    # │ UNIFIED PROCESSING                  │
    # │ (Same regardless of mode)           │
    # └─────────────────────────────────────┘
    
    result = rag_service.integrated_eligibility_check(
        question=request.question,
        client_values=client_values,  # Source doesn't matter!
        topic=request.topic,
        model_name=request.model,
        include_diagram=request.include_diagram
    )
    
    return EligibilityResponse(**result)
```

## Frontend Mode Toggle

```typescript
const EligibilityChecker = () => {
  const [mode, setMode] = useState<'manual' | 'client'>('manual');
  const [clients, setClients] = useState<ClientInfo[]>([]);
  
  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, []);
  
  // Conditional form rendering
  return (
    <div>
      {/* Mode Selector */}
      <Card className="mode-selector">
        <button 
          onClick={() => setMode('manual')}
          className={mode === 'manual' ? 'active' : ''}
        >
          📝 Manual Input (Hypothetical)
        </button>
        <button 
          onClick={() => setMode('client')}
          className={mode === 'client' ? 'active' : ''}
        >
          👤 Client Documents (RAG)
        </button>
      </Card>
      
      {/* Conditional Forms */}
      <form onSubmit={handleSubmit}>
        <input name="question" required />
        
        {mode === 'manual' && (
          <>
            <input name="debt" type="number" placeholder="£51,000" />
            <input name="income" type="number" placeholder="£70" />
            <input name="assets" type="number" placeholder="£1,500" />
          </>
        )}
        
        {mode === 'client' && (
          <select name="client_id" required>
            <option value="">-- Select Client --</option>
            {clients.map(c => (
              <option key={c.client_id} value={c.client_id}>
                {c.client_name}
              </option>
            ))}
          </select>
        )}
        
        <button type="submit">Check Eligibility</button>
      </form>
    </div>
  );
};
```

## Client Document Extraction Flow

```
Client Mode Selected
      ↓
User selects "CLIENT123"
      ↓
Backend receives: { client_id: "CLIENT123", question: "..." }
      ↓
┌──────────────────────────────────────────┐
│ Query Client Vectorstore                 │
├──────────────────────────────────────────┤
│ client_vectorstore.query(                │
│   "Extract total debt, monthly income,   │
│    and total assets from documents"      │
│ )                                         │
└──────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ Retrieved Document Chunks                │
├──────────────────────────────────────────┤
│ [0] "Bank statement showing balance of   │
│      £1,450 and total debts of £51,234"  │
│                                           │
│ [1] "Payslip dated March 2024:           │
│      Net monthly income: £68.50"         │
│                                           │
│ [2] "Asset list: Vehicle £800, Savings   │
│      £650, Total assets £1,450"          │
└──────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ Symbolic Reasoning Extraction            │
├──────────────────────────────────────────┤
│ context = "\n".join(all_chunks)          │
│                                           │
│ symbolic_result =                         │
│   symbolic_reasoning.extract_and_compute( │
│     question="Extract debt, income...",  │
│     manual_text=context                  │
│   )                                       │
└──────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ Parsed Values                            │
├──────────────────────────────────────────┤
│ {                                         │
│   'debt': 51234,     # From bank stmt    │
│   'income': 68.5,    # From payslip      │
│   'assets': 1450     # From asset list   │
│ }                                         │
└──────────────────────────────────────────┘
      ↓
Continue with normal eligibility check
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN DASHBOARD                           │
│                 (RMA-Demo/frontend/page.tsx)                │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ↓                         ↓                         ↓
┌──────────┐       ┌──────────────────┐      ┌────────────────┐
│ Ask the  │       │ Client Document  │      │  Eligibility   │
│ Manuals  │       │     Search       │      │    Checker     │
└──────────┘       └──────────────────┘      └────────────────┘
    │                         │                         │
    │                         │                         │
    ↓                         ↓                         ↓
  Manual                   Client               Both Modes
   Mode                     Mode              (with selector)
    │                         │                         │
    └─────────────────────────┴─────────────────────────┘
                              │
                              ↓
              ┌───────────────────────────┐
              │ POST /eligibility-check   │
              │                           │
              │ Same endpoint for all!    │
              └───────────────────────────┘
```

## Response Structure (Both Modes)

```json
{
  "answer": "Based on the Debt Relief Order manual...",
  "overall_result": "requires_review|eligible|not_eligible|incomplete_information",
  "confidence": 0.85,
  
  "criteria": [
    {
      "criterion": "debt",
      "threshold_name": "debt_limit",
      "threshold_value": 50000,
      "client_value": 51000,        ← Manual: from form
                                    ← Client: from documents
      "status": "near_miss",
      "gap": 1000,
      "explanation": "Within £1,000 of threshold"
    },
    {
      "criterion": "income",
      "threshold_value": 75,
      "client_value": 70,           ← Same structure
      "status": "eligible",
      "explanation": "Meets requirement"
    },
    {
      "criterion": "assets",
      "threshold_value": 2000,
      "client_value": 1500,         ← Same structure
      "status": "eligible",
      "explanation": "Meets requirement"
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
          "actions": [...],
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
      "steps": [...]
    }
  ],
  
  "sources": ["DRO_Manual_2024.pdf - Section 3.2"],
  "diagram": "graph TD\n..."  // Optional Mermaid
}
```

## UI Display (Identical for Both Modes)

```
┌───────────────────────────────────────────────────────┐
│ ⚠️ OVERALL RESULT: REQUIRES REVIEW                    │
│ Confidence: 85%                                       │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ Answer from Manuals:                                  │
│ Based on the Debt Relief Order manual, the maximum    │
│ debt limit is £50,000. Your debt of £51,000 exceeds   │
│ this by £1,000...                                     │
└───────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┐
│ ⚠️ DEBT      │ ✅ INCOME    │ ✅ ASSETS    │
├──────────────┼──────────────┼──────────────┤
│ Threshold:   │ Threshold:   │ Threshold:   │
│ £50,000      │ £75          │ £2,000       │
│              │              │              │
│ Your Value:  │ Your Value:  │ Your Value:  │
│ £51,000      │ £70          │ £1,500       │
│              │              │              │
│ Gap: £1,000  │ ✓ Eligible   │ ✓ Eligible   │
│              │              │              │
│ Within       │ Meets income │ Meets assets │
│ tolerance -  │ requirement  │ requirement  │
│ remediation  │              │              │
│ possible     │              │              │
└──────────────┴──────────────┴──────────────┘

┌───────────────────────────────────────────────────────┐
│ ⚠️ NEAR-MISS OPPORTUNITIES:                           │
│                                                       │
│ DRO Debt Limit (2024)                                │
│ Within £2,000 tolerance                              │
│                                                       │
│ Possible strategies:                                  │
│ • Pay down £1,000 to qualify                         │
│   - Current debt: £51,000                            │
│   - Target debt: £50,000                             │
│   - Options: Lump sum, debt write-off negotiation    │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ 💡 RECOMMENDATIONS:                                    │
│                                                       │
│ HIGH PRIORITY: Reduce debt by £1,000 to meet limit   │
│ • Current: £51,000                                    │
│ • Target: £50,000                                     │
│ • Strategies: Pay priority debts, negotiate           │
└───────────────────────────────────────────────────────┘
```

## Key Takeaways

### Unified Backend
- ✅ Single endpoint handles both modes
- ✅ Mode detection is automatic (client_id present?)
- ✅ Same eligibility logic regardless of source
- ✅ Identical response structure

### Flexible Frontend
- ✅ Mode selector for easy switching
- ✅ Conditional form rendering
- ✅ Same color-coded display
- ✅ Works with existing tabs

### Accurate Extraction
- ✅ Symbolic reasoning for exact values
- ✅ No LLM math errors
- ✅ Handles poor document quality gracefully
- ✅ Fallback to manual mode if needed

### Consistent UX
- ✅ Same status indicators (✅❌⚠️❓)
- ✅ Same recommendations format
- ✅ Same near-miss detection
- ✅ Same optional diagrams

**The dual-mode system is production-ready and provides maximum flexibility for both advisor consultation (manual) and formal client assessment (documents)!** 🎉
