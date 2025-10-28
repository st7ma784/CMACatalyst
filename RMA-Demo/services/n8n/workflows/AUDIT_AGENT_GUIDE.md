# Client Document Audit Agent - N8N Workflow Guide

## Overview

The **Client Document Audit Agent** is an automated workflow that validates client documents against a compliance checklist using AI-powered document analysis. It's perfect for:

- 📋 **Compliance Checks** - Ensure all required documents are present
- 🔍 **Document Validation** - Verify document completeness
- 📊 **Audit Trails** - Generate reports for regulatory compliance
- 🚨 **Missing Documents Alerts** - Identify gaps in client files
- ⏰ **Scheduled Audits** - Automatically check clients on schedule

## Features

### 🤖 AI-Powered Analysis
- Uses LangGraph agentic RAG to understand document context
- Analyzes document content, not just filenames
- Provides confidence scores for each check
- Generates human-readable explanations

### 📊 Structured Outputs
- Pass/Fail/Warning status for each item
- Overall audit score and pass rate
- Detailed recommendations
- Exportable reports (JSON and Text)

### 🔄 Flexible Checklists
- Customizable audit criteria
- Required vs optional items
- Category organization (financial, identity, debt, etc.)
- Custom queries for each item

## N8N-Compatible Endpoints

### 1. `/n8n/audit-checklist` (POST)

Runs a complete audit against a checklist.

**Request:**
```json
{
  "client_id": "john-smith",
  "strict_mode": false,
  "checklist": [
    {
      "item": "Proof of Income",
      "required": true,
      "query": "Does the client have proof of income documents?",
      "category": "financial"
    },
    {
      "item": "Bank Statements (Last 3 Months)",
      "required": true,
      "query": "Are there bank statements covering the last 3 months?",
      "category": "financial"
    }
  ]
}
```

**Response:**
```json
{
  "client_id": "john-smith",
  "total_checks": 10,
  "passed_checks": 7,
  "failed_checks": 2,
  "warnings": 1,
  "pass_rate": 70.0,
  "overall_status": "FAIL",
  "summary": "Audit completed: 7/10 checks passed (70.0%). 2 required items missing. 1 optional items not found.",
  "results": [
    {
      "item": "Proof of Income",
      "category": "financial",
      "required": true,
      "status": "PASS",
      "answer": "Yes, the client has provided payslips for the last 3 months...",
      "confidence": 0.92,
      "sources_found": 3,
      "recommendation": "OK: Proof of Income verified in client documents."
    }
  ],
  "recommendations": [
    "REQUIRED: Request Photo ID from client immediately. This is a mandatory document.",
    "OPTIONAL: Consider requesting Employment Contract from client for completeness."
  ]
}
```

### 2. `/n8n/query` (POST)

Simple document query with structured output.

**Request:**
```json
{
  "client_id": "john-smith",
  "query": "What is the client's monthly income?",
  "return_sources": true
}
```

**Response:**
```json
{
  "success": true,
  "client_id": "john-smith",
  "query": "What is the client's monthly income?",
  "answer": "Based on the payslips, the client's monthly income is £2,400...",
  "confidence": 0.87,
  "sources": [
    {
      "filename": "payslip_jan.pdf",
      "content": "Gross Pay: £2,400...",
      "relevance": 0.95
    }
  ],
  "metadata": {
    "reasoning_steps": 3,
    "tools_used": ["numerical_extraction"],
    "processing_time_ms": 0
  }
}
```

### 3. `/n8n/workflows` (GET)

List available workflow templates.

## How to Use the Audit Workflow

### Step 1: Import into N8N

1. Open N8N at `http://192.168.5.70:5678`
2. Click **"Workflows"** → **"Add Workflow"**
3. Click **"..."** menu → **"Import from File"**
4. Select `client-audit-agent.json`
5. Activate the workflow

### Step 2: Configure Client ID

1. Open the **"Set Client ID"** node
2. Change the `client_id` value to your client (e.g., "jane-doe")
3. Save the workflow

### Step 3: Customize Checklist

The **"Build Audit Checklist"** node contains the audit criteria:

```javascript
[
  {
    "item": "Proof of Income",
    "required": true,  // Fails audit if missing
    "query": "Does the client have proof of income documents?",
    "category": "financial"
  },
  {
    "item": "Credit Card Statements",
    "required": false,  // Warning only if missing
    "query": "Are there recent credit card statements?",
    "category": "debt"
  }
]
```

**Checklist Item Properties:**
- `item` - Name of the document/requirement
- `required` - true = must have, false = optional
- `query` - AI query to validate the item
- `category` - Grouping for reports (financial, identity, debt, etc.)

### Step 4: Run the Audit

1. Click **"Execute Workflow"**
2. View results in the workflow
3. Check the generated report files

### Step 5: Review Results

The workflow generates:

1. **Audit Status** - PASS/FAIL/WARNING
2. **Detailed Report** - Text file with full analysis
3. **JSON Output** - Structured data for integration
4. **Recommendations** - Action items for missing documents

## Default Audit Checklist

The sample workflow includes these checks:

### Required Documents ✅
1. **Proof of Income** - Payslips, benefit letters
2. **Bank Statements (Last 3 Months)** - Recent transactions
3. **Proof of Address** - Utility bill, council tax
4. **Photo ID** - Passport, driving license

### Optional Documents ⚠️
5. **Credit Card Statements** - Recent statements
6. **Loan Agreements** - Active loan contracts
7. **Mortgage Statement** - Property finance
8. **Employment Contract** - Job agreement
9. **Budget Planner** - Income/expense breakdown
10. **Creditor Letters** - Communication from lenders

## Customization Examples

### Example 1: DRO-Specific Audit

```json
{
  "item": "Debt under £30,000",
  "required": true,
  "query": "Based on the client documents, is the total debt under £30,000?",
  "category": "eligibility"
}
```

### Example 2: Bankruptcy Check

```json
{
  "item": "Debt over £5,000",
  "required": true,
  "query": "Does the client have debts totaling more than £5,000?",
  "category": "eligibility"
}
```

### Example 3: Asset Verification

```json
{
  "item": "Property Ownership",
  "required": false,
  "query": "Does the client own any property or significant assets?",
  "category": "assets"
}
```

## Automation Options

### Schedule Daily Audits

1. Replace **"Manual Trigger"** with **"Schedule Trigger"**
2. Set to run daily at 9:00 AM
3. Add **"Get All Clients"** node before audit
4. Loop through each client

### Email Notifications

1. Add **"Send Email"** node after **"Format Failure"**
2. Configure email with recommendations
3. Attach the audit report

### Slack Alerts

1. Add **"Slack"** node after **"Check Audit Result"**
2. Send message to #compliance channel
3. Include client ID and failed items

### Webhook Trigger

1. Replace **"Manual Trigger"** with **"Webhook"**
2. Get webhook URL
3. Call from external system when client uploads document

## Advanced Features

### Strict Mode

Set `strict_mode: true` to fail immediately on first missing required document:

```json
{
  "client_id": "john-smith",
  "strict_mode": true,
  "checklist": [...]
}
```

### Custom Confidence Threshold

Modify the audit logic to require higher confidence:

```javascript
if (positive_score > negative_score && query_result.confidence > 0.8) {
  status = "PASS"
}
```

### Category-Based Reports

Filter results by category:

```javascript
{{ $json.results.filter(r => r.category === 'financial') }}
```

## Troubleshooting

### No Documents Found

**Problem:** All checks fail with "not found"
**Solution:**
- Verify client_id matches uploaded documents
- Check documents are ingested: GET `/clients`
- Review upload logs

### Low Confidence Scores

**Problem:** Results marked as WARNING despite documents existing
**Solution:**
- Improve query wording to be more specific
- Upload clearer document scans
- Check OCR quality for PDF documents

### Slow Performance

**Problem:** Audit takes too long
**Solution:**
- Reduce checklist size
- Set `return_sources: false` for faster queries
- Enable strict mode to fail fast

## API Testing

Test the endpoint directly with curl:

```bash
curl -X POST http://192.168.5.70:8104/n8n/audit-checklist \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "john-smith",
    "strict_mode": false,
    "checklist": [
      {
        "item": "Proof of Income",
        "required": true,
        "query": "Does the client have proof of income?",
        "category": "financial"
      }
    ]
  }'
```

## Best Practices

### 1. Clear Query Language
✅ "Does the client have bank statements for the last 3 months?"
❌ "Bank statements?"

### 2. Specific Categories
✅ "financial", "identity", "debt", "assets"
❌ "documents", "misc", "other"

### 3. Appropriate Required Flags
✅ Mark genuinely mandatory items as required
❌ Mark everything as required

### 4. Meaningful Recommendations
✅ "REQUIRED: Request Photo ID from client immediately"
❌ "Missing document"

## Integration Examples

### With CRM System

```javascript
// Get clients from CRM
const clients = await crm.getClients();

// Audit each client
for (const client of clients) {
  const audit = await runAudit(client.id);

  if (audit.overall_status === "FAIL") {
    await crm.addTask(client.id, "Request missing documents");
  }
}
```

### With Email System

```javascript
if (audit.overall_status === "FAIL") {
  await sendEmail({
    to: advisor.email,
    subject: `Action Required: ${client.name} Missing Documents`,
    body: audit.recommendations.join('\n')
  });
}
```

## Support

For help with the Audit Agent:
- Check workflow execution logs in N8N
- Review API documentation: http://192.168.5.70:8104/docs
- Test endpoints individually before workflow use
- Start with a small checklist (2-3 items) for testing

## Version History

- **v1.0** - Initial release with 10-item default checklist
- Full LangGraph agentic RAG integration
- N8N-compatible structured outputs
- Automated report generation
