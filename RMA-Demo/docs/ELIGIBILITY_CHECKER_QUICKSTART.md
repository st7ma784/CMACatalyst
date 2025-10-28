# Eligibility Checker - Quick Start Guide

## 5-Minute Setup

### 1. Start Backend Service
```bash
cd services/rag-service
docker-compose up -d
```

Verify it's running:
```bash
curl http://localhost:8102/health
# Expected: {"status": "healthy"}
```

### 2. Start Frontend
```bash
cd RMA-Demo/frontend
npm install
npm run dev
```

Access at: `http://localhost:3000`

### 3. Test the System

**Via UI:**
1. Navigate to `http://localhost:3000`
2. Click "Eligibility" tab
3. Fill in form:
   - Question: "Can I get a DRO?"
   - Debt: 51000
   - Income: 70
   - Assets: 1500
4. Click "Check Eligibility"
5. See color-coded results

**Via API:**
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

## What You'll See

### Overall Result
```
⚠️ REQUIRES REVIEW (85% confidence)
```

### Criteria Breakdown
| Criterion | Status | Your Value | Threshold | Gap |
|-----------|--------|------------|-----------|-----|
| **DEBT** | ⚠️ Near-Miss | £51,000 | £50,000 | £1,000 |
| **INCOME** | ✅ Eligible | £70 | £75 | - |
| **ASSETS** | ✅ Eligible | £1,500 | £2,000 | - |

### Recommendations
```
💡 HIGH PRIORITY: Pay down £1,000 in debt to qualify
• Current: £51,000
• Target: £50,000
• Action: Prioritize debt repayment or negotiate settlements
```

## Understanding the Results

### Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | **Eligible** | Criterion met - no action needed |
| ❌ | **Not Eligible** | Criterion failed - significant gap |
| ⚠️ | **Near-Miss** | Within tolerance - remediation possible |
| ❓ | **Unknown** | Value not provided - need more info |

### Color Coding

- **Green** (✅): All good!
- **Red** (❌): Problem that may be insurmountable
- **Yellow** (⚠️): **OPPORTUNITY!** - Close to qualifying
- **Gray** (❓): Need more information

## Common Scenarios

### Scenario 1: Fully Eligible
```json
{
  "debt": 45000,
  "income": 70,
  "assets": 1500
}
```
**Result**: ✅ All green - eligible for DRO

### Scenario 2: Near-Miss (Debt)
```json
{
  "debt": 51000,
  "income": 70,
  "assets": 1500
}
```
**Result**: ⚠️ Pay £1k to qualify

### Scenario 3: Not Eligible
```json
{
  "debt": 60000,
  "income": 100,
  "assets": 3000
}
```
**Result**: ❌ Consider bankruptcy or IVA instead

### Scenario 4: Incomplete Info
```json
{
  "debt": 45000
}
```
**Result**: ❓ Need income and assets to assess

## API Response Structure

```json
{
  "answer": "Natural language explanation from manuals",
  "overall_result": "requires_review|eligible|not_eligible|incomplete_information",
  "confidence": 0.85,
  "criteria": [
    {
      "criterion": "debt",
      "status": "near_miss",
      "threshold_value": 50000,
      "client_value": 51000,
      "gap": 1000,
      "explanation": "Within £1,000 of threshold - remediation possible"
    }
  ],
  "near_misses": [
    {
      "threshold_name": "DRO Debt Limit (2024)",
      "tolerance": 2000,
      "strategies": [...]
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
  "sources": ["DRO_Manual_2024.pdf - Section 3.2"]
}
```

## Key Features

### 1. Contextual Understanding (RAG)
- Searches actual debt advice manuals
- Provides exact references
- Explains the "why" behind decisions

### 2. Structured Evaluation (Decision Tree)
- Checks each criterion individually
- No LLM math errors (symbolic reasoning)
- Consistent, reproducible results

### 3. Lateral Thinking (Near-Misses)
- Identifies opportunities within tolerance
- "You're £1k over - pay that down!"
- Actionable remediation strategies

### 4. Visual Clarity (Color Coding)
- Instant understanding at a glance
- ✅❌⚠️❓ icons for each criterion
- Priority-based recommendations

## Troubleshooting

### Problem: "Connection refused"
**Solution**: Backend not running
```bash
cd services/rag-service
docker-compose up -d
```

### Problem: All criteria show "unknown"
**Solution**: Check form values are populated
- Ensure numbers are entered
- Check browser console for errors

### Problem: No near-misses detected
**Solution**: Rebuild decision tree
```bash
curl -X POST http://localhost:8102/rebuild-tree \
  -d '{"topic": "dro_eligibility"}'
```

### Problem: Frontend shows old data
**Solution**: Clear cache and refresh
```bash
# In browser
Ctrl + Shift + R (hard refresh)

# Or restart dev server
npm run dev
```

## File Locations

### Backend
- **API Endpoint**: `services/rag-service/app.py` lines 2170-2272
- **Integration Logic**: `services/rag-service/app.py` lines 1805-2042
- **Pydantic Models**: `services/rag-service/app.py` lines 85-126

### Frontend
- **Main Component**: `RMA-Demo/frontend/src/components/EligibilityChecker.tsx`
- **Dashboard Integration**: `RMA-Demo/frontend/src/app/page.tsx`

### Documentation
- **Comprehensive Guide**: `ELIGIBILITY_CHECKER_INTEGRATION.md`
- **Quick Summary**: `ELIGIBILITY_CHECKER_SUMMARY.md`
- **Architecture**: `ELIGIBILITY_CHECKER_ARCHITECTURE.md`
- **This File**: `ELIGIBILITY_CHECKER_QUICKSTART.md`

## Next Steps

1. **Customize Decision Trees**: Add your own thresholds in `decision_tree_builder.py`
2. **Update Manuals**: Ingest new PDF manuals via `/ingest-pdf` endpoint
3. **Extend Topics**: Add bankruptcy, IVA, DMP eligibility
4. **Add Authentication**: Secure the endpoint with JWT tokens
5. **Deploy to Production**: Follow deployment checklist in architecture doc

## Support & Resources

- **API Docs**: `http://localhost:8102/docs`
- **Health Check**: `http://localhost:8102/health`
- **Frontend**: `http://localhost:3000`
- **GitHub Issues**: [Project Repository]
- **Documentation**: `/RMA-Demo/ELIGIBILITY_CHECKER_*.md`

## Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════╗
║            ELIGIBILITY CHECKER QUICK REFERENCE                ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  BACKEND:                                                     ║
║  • URL: http://localhost:8102                                 ║
║  • Endpoint: POST /eligibility-check                          ║
║  • Health: GET /health                                        ║
║                                                               ║
║  FRONTEND:                                                    ║
║  • URL: http://localhost:3000                                 ║
║  • Tab: "Eligibility"                                         ║
║                                                               ║
║  STATUS ICONS:                                                ║
║  ✅ Eligible      - Criterion met                             ║
║  ❌ Not Eligible  - Criterion failed                          ║
║  ⚠️ Near-Miss     - Opportunity! (within tolerance)           ║
║  ❓ Unknown       - Need more information                     ║
║                                                               ║
║  OVERALL RESULTS:                                             ║
║  • eligible              → All criteria met                   ║
║  • not_eligible          → One or more criteria failed        ║
║  • requires_review       → Near-misses detected               ║
║  • incomplete_information → Missing values                    ║
║                                                               ║
║  TEST SCENARIOS:                                              ║
║  • All Eligible:  debt=45000, income=70, assets=1500          ║
║  • Near-Miss:     debt=51000, income=70, assets=1500          ║
║  • Not Eligible:  debt=60000, income=100, assets=3000         ║
║  • Incomplete:    debt=45000 (no income/assets)               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## Example cURL Commands

### Check Eligibility (Near-Miss)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can I get a DRO?",
    "debt": 51000,
    "income": 70,
    "assets": 1500,
    "topic": "dro_eligibility",
    "include_diagram": false
  }' | jq
```

### Check Eligibility (All Eligible)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Am I eligible for a DRO?",
    "debt": 45000,
    "income": 70,
    "assets": 1500,
    "topic": "dro_eligibility"
  }' | jq
```

### Check Eligibility (Not Eligible)
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can I get a DRO?",
    "debt": 60000,
    "income": 100,
    "assets": 3000,
    "topic": "dro_eligibility"
  }' | jq
```

### With Diagram
```bash
curl -X POST http://localhost:8102/eligibility-check \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can I get a DRO?",
    "debt": 51000,
    "income": 70,
    "assets": 1500,
    "topic": "dro_eligibility",
    "include_diagram": true
  }' | jq -r '.diagram'
```

## That's It!

You now have a production-ready eligibility checker that:
- ✅ Combines RAG contextual understanding with decision tree logic
- ✅ Detects near-miss opportunities with lateral thinking
- ✅ Provides color-coded, actionable recommendations
- ✅ Integrates seamlessly into your advisor dashboard

**Happy advising!** 🎉
