# n8n Workflow Automation - Centre Manager Guide

**For:** Centre Managers & Non-Technical Users
**Purpose:** Create and manage automated workflows without coding
**Version:** 1.0.0
**Date:** October 24, 2025

---

## 📚 Table of Contents

1. [What is n8n?](#what-is-n8n)
2. [Getting Started](#getting-started)
3. [Understanding Workflows](#understanding-workflows)
4. [Available Tools (MCP)](#available-tools-mcp)
5. [Creating Your First Workflow](#creating-your-first-workflow)
6. [Workflow Examples](#workflow-examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Security & Privacy](#security--privacy)

---

## What is n8n?

**n8n** (pronounced "nodemation") is a visual workflow automation tool that lets you create automated processes without writing code.

### Think of it like:
- **LEGO blocks** - Snap together pre-built pieces to create something useful
- **Recipe building** - Follow steps in order to achieve a result
- **Flowcharts** - Visual diagrams that execute themselves

### What can you automate?

✅ **Client onboarding**
- Send welcome emails automatically
- Create calendar appointments
- Generate client folders

✅ **Document processing**
- Check eligibility when documents are uploaded
- Notify advisers of urgent cases
- Extract financial information

✅ **Routine tasks**
- Weekly client follow-ups
- Monthly statistics reports
- Reminder emails

✅ **Data management**
- Update client records
- Generate reports
- Archive completed cases

---

## Getting Started

### Accessing n8n

1. **Open your browser** and go to:
   ```
   http://localhost:5678
   ```
   (Or your organization's n8n URL)

2. **Login** with credentials provided by IT:
   ```
   Username: [provided by IT]
   Password: [provided by IT]
   ```

3. **You'll see the n8n dashboard** with:
   - **Workflows** (left sidebar) - Your saved workflows
   - **Credentials** (left sidebar) - Saved connections
   - **Executions** (left sidebar) - History of runs
   - **Main canvas** (center) - Where you build workflows

### First-Time Setup

**Step 1: Save your credentials**
1. Click **Credentials** in left sidebar
2. Click **+ Add Credential**
3. Choose credential type (e.g., "HTTP Header Auth" for MCP)
4. Fill in details provided by IT
5. Click **Save**

**Step 2: Import templates**
1. Click **Workflows** in left sidebar
2. Click **+ Add Workflow**
3. Click **Import from File**
4. Select template file (e.g., `client-onboarding.json`)
5. Click **Save**

---

## Understanding Workflows

### What is a Workflow?

A workflow is a series of connected **nodes** (steps) that automate a process.

### Anatomy of a Workflow

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  TRIGGER    │─────→│   ACTION    │─────→│   ACTION    │
│  (Start)    │      │  (Do this)  │      │ (Then this) │
└─────────────┘      └─────────────┘      └─────────────┘
```

**Example: Client Welcome Email**
```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ New Client   │─────→│ Send Welcome │─────→│ Create       │
│ Registered   │      │ Email        │      │ Appointment  │
└──────────────┘      └──────────────┘      └──────────────┘
```

### Types of Nodes

#### 1. **Trigger Nodes** (🎯 How workflows start)

| Icon | Name | When to Use |
|------|------|-------------|
| 🔘 | Manual Trigger | Test workflows, run on-demand |
| 📅 | Schedule | Run daily/weekly/monthly |
| 🌐 | Webhook | Triggered by external events (e.g., form submission) |

#### 2. **Action Nodes** (⚙️ What workflows do)

| Icon | Name | What It Does |
|------|------|--------------|
| 📧 | Email | Send emails |
| 📊 | Spreadsheet | Read/write to Google Sheets |
| 🗓️ | Calendar | Create calendar events |
| 🔧 | HTTP Request | Call MCP tools |
| 🔀 | IF | Make decisions (if this, then that) |
| ✏️ | Set | Store temporary data |

#### 3. **Logic Nodes** (🧠 How workflows think)

| Icon | Name | Purpose |
|------|------|---------|
| 🔀 | IF | Choose different paths |
| ➰ | Loop | Repeat steps |
| ⏸️ | Wait | Pause before continuing |
| ➕ | Merge | Combine multiple paths |

---

## Available Tools (MCP)

The MCP Server provides specialized tools for debt advice workflows:

### Tool 1: Check Client Eligibility

**What it does:** Checks if a client qualifies for DRO or bankruptcy

**When to use:**
- After document upload
- During client assessment
- Before adviser meeting

**Example:**
```
Input:
- Client debt: £15,000
- Monthly income: £50
- Assets: £1,000

Output:
- DRO: Eligible ✓
- Reason: All criteria met
- Recommendations: [list of next steps]
```

**How to use in n8n:**
1. Add **HTTP Request** node
2. Set URL: `http://mcp-server:8105/mcp/tools/execute`
3. Add header: `X-API-Key: [your-key]`
4. Set body:
   ```json
   {
     "tool_name": "check_client_eligibility",
     "arguments": {
       "question": "Is this client eligible for a DRO?",
       "debt": 15000,
       "income": 50,
       "assets": 1000,
       "topic": "dro_eligibility"
     }
   }
   ```

### Tool 2: Extract Client Values

**What it does:** Pulls financial numbers from client documents

**When to use:**
- After document upload
- To populate forms
- For record keeping

**Example:**
```
Input:
- Client ID: CLIENT_123
- Fields: ["debt", "income", "assets"]

Output:
- Debt: £15,000
- Income: £1,200/month
- Assets: £500
```

### Tool 3: Get Centre Statistics

**What it does:** Retrieves centre performance metrics

**When to use:**
- Monthly reports
- Manager dashboards
- Funding applications

**Example:**
```
Input:
- Date range: "month"

Output:
- Total clients: 45
- DRO applications: 12
- Bankruptcy: 3
- Average debt: £18,500
```

### Tool 4: Query Manuals

**What it does:** Searches debt advice manuals for information

**When to use:**
- Adviser training
- Policy questions
- Case research

### Tool 5: Get Similar Cases

**What it does:** Finds clients with similar situations

**When to use:**
- Case comparisons
- Outcome predictions
- Training examples

---

## Creating Your First Workflow

### Example: Automated Client Welcome

**Goal:** Send welcome email when new client registers

**Step-by-Step:**

#### Step 1: Create New Workflow

1. Click **+ Add Workflow** (top right)
2. Name it: "Client Welcome Automation"
3. Click **Save**

#### Step 2: Add Trigger

1. Click **+** on canvas
2. Search "Webhook"
3. Click **Webhook** trigger
4. Configure:
   - **HTTP Method**: POST
   - **Path**: `client-registered`
5. Click **Listen for Test Event**
6. Click **Execute Node** to get webhook URL

#### Step 3: Add Email Node

1. Click **+** after webhook
2. Search "Email"
3. Click **Send Email**
4. Configure:
   - **From Email**: advice@riverside.org.uk
   - **To Email**: `{{ $json.client_email }}`
   - **Subject**: "Welcome to Riverside Money Advice"
   - **Text**:
     ```
     Dear {{ $json.client_name }},

     Thank you for contacting Riverside Money Advice.

     Your appointment is scheduled for {{ $json.appointment_date }}.

     Please bring:
     - Recent bank statements
     - List of all debts
     - Proof of income

     Best regards,
     Riverside Money Advice Team
     ```

#### Step 4: Add Calendar Event

1. Click **+** after email
2. Search "Google Calendar"
3. Click **Create Event**
4. Configure:
   - **Calendar**: Primary
   - **Start**: `{{ $json.appointment_date }}T10:00:00`
   - **End**: `{{ $json.appointment_date }}T11:00:00`
   - **Summary**: `Client: {{ $json.client_name }}`

#### Step 5: Test Workflow

1. Click **Execute Workflow** (top right)
2. Send test data to webhook:
   ```json
   {
     "client_name": "John Smith",
     "client_email": "john@example.com",
     "appointment_date": "2025-11-01"
   }
   ```
3. Check each node turns green ✓
4. Verify email was sent

#### Step 6: Activate Workflow

1. Toggle **Active** switch (top right)
2. Workflow now runs automatically!

---

## Workflow Examples

### Example 1: Document Upload Alert

**Trigger:** Client uploads document
**Actions:**
1. Check document type
2. If urgent (court letter) → Notify adviser immediately
3. If standard → Add to weekly summary
4. Extract financial values
5. Update client record

**When useful:**
- Urgent documents need immediate attention
- Routine documents can be batched
- Automatic data entry

### Example 2: Weekly Follow-Up

**Trigger:** Every Monday 9 AM
**Actions:**
1. Get list of clients with pending actions
2. For each client:
   - Check if deadline approaching
   - Send reminder email
   - Update status

**When useful:**
- Prevent missed deadlines
- Consistent client communication
- Workload management

### Example 3: Eligibility Check Pipeline

**Trigger:** New client intake form submitted
**Actions:**
1. Extract client details
2. Call MCP: Extract financial values
3. Call MCP: Check DRO eligibility
4. Call MCP: Check bankruptcy eligibility
5. Generate recommendation report
6. Email to assigned adviser
7. Create calendar appointment

**When useful:**
- Fast initial assessment
- Consistent eligibility checking
- Adviser preparation

### Example 4: Monthly Statistics Report

**Trigger:** 1st of each month, 8 AM
**Actions:**
1. Call MCP: Get centre statistics
2. Format as readable report
3. Create graphs/charts
4. Email to manager
5. Save to Google Drive

**When useful:**
- Funder reporting
- Performance monitoring
- Trend analysis

---

## Best Practices

### ✅ DO

**1. Name workflows clearly**
```
✓ "Client Welcome - Email + Calendar"
✗ "Workflow 1"
```

**2. Add notes to complex nodes**
- Right-click node → "Add Note"
- Explain WHY, not just WHAT

**3. Test with real data**
- Use actual client scenarios
- Verify emails send correctly
- Check calendar events appear

**4. Use error notifications**
- Add error email notification
- Monitor failed executions
- Fix issues promptly

**5. Version your workflows**
- Before major changes, duplicate workflow
- Name with date: "Client Welcome v2 (2025-10-24)"

### ❌ DON'T

**1. Don't hardcode sensitive data**
```
✗ API Key in workflow
✓ Use Credentials feature
```

**2. Don't create infinite loops**
```
✗ Trigger → Send Email → Trigger (loops forever!)
✓ Add stopping conditions
```

**3. Don't skip testing**
```
✗ Activate immediately
✓ Test thoroughly first
```

**4. Don't ignore errors**
```
✗ Hope it works
✓ Check Executions tab regularly
```

**5. Don't overcomplicate**
```
✗ 50 nodes, 10 branches
✓ Keep it simple, split into multiple workflows
```

---

## Troubleshooting

### Problem: Workflow won't activate

**Symptoms:**
- Toggle switch won't turn on
- Error message appears

**Causes & Solutions:**

1. **Missing credentials**
   - Check all nodes have credentials configured
   - Test credentials in Credentials panel

2. **Invalid trigger**
   - Webhook trigger needs valid path
   - Schedule trigger needs valid cron expression

3. **Missing required fields**
   - Check all red fields are filled
   - Hover over red icon for details

### Problem: Email not sending

**Check:**
1. Email credentials configured?
2. "From" email valid?
3. "To" email has value?
4. SMTP settings correct?

**Test:**
1. Execute node individually
2. Check error message
3. Verify email server allows sending

### Problem: MCP tool returning error

**Check:**
1. MCP server running? (`curl http://mcp-server:8105/health`)
2. API key correct?
3. Tool name spelled correctly?
4. Required arguments provided?

**Common errors:**

```
"401 Unauthorized"
→ API key missing or wrong

"404 Not Found"
→ Wrong URL or tool name

"500 Server Error"
→ Check MCP server logs
```

### Problem: Data not passing between nodes

**Symptoms:**
- `{{ $json.field }}` shows empty
- Nodes execute but no data

**Solutions:**

1. **Check data format**
   - Click node to see output
   - Verify field name matches

2. **Use correct reference**
   ```
   First node: $json.client_name
   Named node: $node["Node Name"].json.client_name
   Previous node: $("Node Name").item.json.client_name
   ```

3. **Check for arrays**
   ```
   Single item: $json.name
   Array: $json[0].name
   ```

### Problem: Workflow running multiple times

**Causes:**
1. Multiple active webhooks
2. External system sending duplicates
3. Loop without exit condition

**Solutions:**
1. Check only ONE workflow active for same trigger
2. Add deduplication logic
3. Add stopping conditions to loops

---

## Security & Privacy

### Data Protection

**✅ ALWAYS:**
- Use credentials for API keys (never hardcode)
- Limit access to n8n (password protect)
- Review who can see workflow data
- Delete test data with real client info
- Use test/dummy data for development

**❌ NEVER:**
- Share credentials publicly
- Include personal data in workflow names
- Leave test client data in workflows
- Share screenshots with sensitive data
- Email passwords or API keys

### GDPR Compliance

**Ensure workflows:**
1. Only collect necessary data
2. Store data securely
3. Delete data when no longer needed
4. Log data access
5. Allow data export/deletion

**Example: Compliant vs Non-Compliant**

```
❌ Store all client emails forever
✓ Store for 6 months, then auto-delete

❌ Log client conversations
✓ Log only metadata (date, duration)

❌ Email client data to personal address
✓ Email only to work addresses
```

### Access Control

**Who should access n8n?**
- ✓ Centre Manager
- ✓ IT Administrator
- ✓ Designated workflow creators
- ✗ General advisers (unless trained)
- ✗ External contractors (without approval)

**Workflow permissions:**
- Set who can view
- Set who can edit
- Set who can activate
- Review regularly

---

## Getting Help

### Internal Support

**1. Check the docs first**
- This guide
- n8n workflow templates
- MCP tool documentation

**2. Ask your IT team**
- Email: it@riverside.org.uk
- Phone: [number]
- Ticket system: [URL]

**3. Ask other centre managers**
- Share what works
- Learn from each other
- Monthly workflow review meeting

### External Resources

**n8n Documentation:**
- Official docs: https://docs.n8n.io
- Community forum: https://community.n8n.io
- Video tutorials: https://www.youtube.com/c/n8n-io

**Common Questions:**
- "How do I...?" → Search docs
- "Why isn't this working?" → Check executions tab
- "Is this possible?" → Ask community

---

## Next Steps

### Week 1: Learn
- [ ] Login to n8n
- [ ] Explore the interface
- [ ] Review example workflows
- [ ] Watch tutorial videos

### Week 2: Practice
- [ ] Import a template workflow
- [ ] Test it with dummy data
- [ ] Modify one node
- [ ] Test your changes

### Week 3: Create
- [ ] Identify a repetitive task
- [ ] Design a simple workflow
- [ ] Build it in n8n
- [ ] Test thoroughly

### Week 4: Deploy
- [ ] Review with IT
- [ ] Test with real data
- [ ] Activate workflow
- [ ] Monitor for issues

### Ongoing
- [ ] Monthly workflow review
- [ ] Share successes with team
- [ ] Improve existing workflows
- [ ] Create new automations

---

## Appendix: Quick Reference

### Common Expressions

```javascript
// Access field from current node
{{ $json.fieldName }}

// Access field from named node
{{ $node["Node Name"].json.fieldName }}

// Format date
{{ $now.toFormat('yyyy-MM-dd') }}

// Conditional
{{ $json.status === 'urgent' ? 'Yes' : 'No' }}

// Calculate
{{ $json.debt + $json.assets }}
```

### MCP Tool Quick Reference

```javascript
// Check eligibility
{
  "tool_name": "check_client_eligibility",
  "arguments": {
    "question": "Is client eligible for DRO?",
    "debt": 15000,
    "income": 50,
    "assets": 1000,
    "topic": "dro_eligibility"
  }
}

// Extract values
{
  "tool_name": "extract_client_values",
  "arguments": {
    "client_id": "CLIENT_123",
    "fields": ["debt", "income", "assets"]
  }
}

// Get statistics
{
  "tool_name": "get_centre_statistics",
  "arguments": {
    "date_range": "month"
  }
}
```

---

**Document Version:** 1.0.0
**For:** Centre Managers
**Support:** it@riverside.org.uk
**Last Updated:** October 24, 2025

**🎉 Happy Automating!**
