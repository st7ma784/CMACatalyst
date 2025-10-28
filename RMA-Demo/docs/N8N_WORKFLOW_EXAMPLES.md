# n8n Workflow Examples Library

**Purpose:** Ready-to-use workflow templates for common tasks
**For:** Centre Managers
**Difficulty:** 🟢 Beginner | 🟡 Intermediate | 🔴 Advanced

---

## 📚 Table of Contents

1. [Client Management](#client-management)
2. [Document Processing](#document-processing)
3. [Communication](#communication)
4. [Reporting](#reporting)
5. [Case Management](#case-management)
6. [Alerts & Monitoring](#alerts--monitoring)

---

## Client Management

### 1. New Client Onboarding 🟢

**When to use:** Automate welcome process for new clients

**Trigger:** New client form submitted (webhook)

**What it does:**
1. Receives client details from form
2. Sends personalized welcome email
3. Creates calendar appointment
4. Generates client folder
5. Notifies assigned adviser

**Workflow:**
```
Webhook → Set Client Data → Send Welcome Email → Create Calendar → Notify Adviser
```

**Configuration:**

```json
{
  "nodes": [
    {
      "name": "Webhook - New Client",
      "type": "webhook",
      "path": "new-client",
      "method": "POST"
    },
    {
      "name": "Set Client Data",
      "type": "set",
      "values": {
        "client_name": "{{ $json.name }}",
        "client_email": "{{ $json.email }}",
        "appointment_date": "{{ $json.preferred_date }}"
      }
    },
    {
      "name": "Send Welcome Email",
      "type": "emailSend",
      "fromEmail": "advice@riverside.org.uk",
      "toEmail": "{{ $json.client_email }}",
      "subject": "Welcome to Riverside Money Advice",
      "text": "Dear {{ $json.client_name }},\n\nThank you for contacting us..."
    }
  ]
}
```

**Test with:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "07700 900123",
  "preferred_date": "2025-11-01"
}
```

---

### 2. Client Follow-Up Scheduler 🟡

**When to use:** Automatically schedule follow-ups based on case type

**Trigger:** Case status changed

**What it does:**
1. Detects case type (DRO, bankruptcy, etc.)
2. Calculates appropriate follow-up date
3. Creates reminder in calendar
4. Adds to adviser's task list

**Decision Logic:**
```
DRO → 7 days
Bankruptcy → 14 days
Debt Management → 30 days
Emergency → 2 days
```

**Workflow:**
```
Webhook → IF (Case Type) → Set Follow-Up Date → Create Reminder → Notify Adviser
```

---

### 3. Inactive Client Re-engagement 🟡

**When to use:** Re-engage clients who haven't contacted you in 90 days

**Trigger:** Weekly schedule (Monday 9 AM)

**What it does:**
1. Query database for clients inactive > 90 days
2. For each client:
   - Generate personalized email
   - Offer new appointment
   - Track response

**Workflow:**
```
Schedule → Get Inactive Clients → Loop (For Each) → Send Email → Wait for Response → Update Status
```

---

## Document Processing

### 4. Document Upload Pipeline 🟢

**When to use:** Process and analyze newly uploaded client documents

**Trigger:** Document uploaded (webhook from frontend)

**What it does:**
1. Receives document metadata
2. Calls doc-processor service
3. Indexes in client vectorstore
4. Checks for urgent flags (court letter, eviction)
5. Notifies adviser if urgent

**Workflow:**
```
Webhook → Process Document → Index in RAG → IF (Urgent?) → [Yes] Notify Adviser
                                                         → [No] Add to Summary
```

**Configuration:**
```json
{
  "name": "Check Document Urgency",
  "type": "if",
  "conditions": {
    "string": [
      {
        "value1": "{{ $json.document_type }}",
        "operation": "contains",
        "value2": "court"
      }
    ]
  }
}
```

---

### 5. Automatic Eligibility Check 🟡

**When to use:** Check DRO/bankruptcy eligibility when financial docs uploaded

**Trigger:** Financial document uploaded

**What it does:**
1. Calls MCP: Extract client values
2. Calls MCP: Check DRO eligibility
3. Calls MCP: Check bankruptcy eligibility
4. Generates summary report
5. Emails adviser with recommendation

**Workflow:**
```
Webhook → Extract Values → Check DRO → Check Bankruptcy → Generate Report → Email Adviser
```

**MCP Call Example:**
```json
{
  "name": "Extract Financial Values",
  "type": "httpRequest",
  "url": "http://mcp-server:8105/mcp/tools/execute",
  "method": "POST",
  "headers": {
    "X-API-Key": "={{ $credentials.mcpApiKey }}"
  },
  "body": {
    "tool_name": "extract_client_values",
    "arguments": {
      "client_id": "{{ $json.client_id }}",
      "fields": ["debt", "income", "assets"]
    }
  }
}
```

---

### 6. Bulk Document Organizer 🔴

**When to use:** Organize multiple documents by type

**Trigger:** Manual or scheduled

**What it does:**
1. Gets list of all client documents
2. Categorizes by type (bank statement, payslip, etc.)
3. Renames with standard format
4. Moves to appropriate folders
5. Updates client record

**Workflow:**
```
Manual Trigger → Get Documents → Loop (For Each) → Classify → Rename → Move → Update Record
```

---

## Communication

### 7. Appointment Reminders 🟢

**When to use:** Send automated reminders 24 hours before appointments

**Trigger:** Daily at 9 AM

**What it does:**
1. Query calendar for tomorrow's appointments
2. For each appointment:
   - Get client email
   - Send reminder with details
   - Log sent reminder

**Workflow:**
```
Schedule (Daily 9 AM) → Get Tomorrow's Appointments → Loop (For Each) → Send Email → Log
```

**Email Template:**
```
Subject: Reminder: Appointment Tomorrow

Dear {{ $json.client_name }},

This is a reminder of your appointment tomorrow:

Date: {{ $json.appointment_date }}
Time: {{ $json.appointment_time }}
Adviser: {{ $json.adviser_name }}

Please bring:
- Bank statements
- List of debts
- Proof of income

If you need to reschedule, call us on 0800 XXX XXXX.

Best regards,
Riverside Money Advice
```

---

### 8. Court Date Alert System 🟡

**When to use:** Alert clients and advisers of approaching court dates

**Trigger:** Daily at 8 AM

**What it does:**
1. Check for court dates in next 7 days
2. Calculate urgency (7 days = urgent, 3 days = critical)
3. Send email to client
4. Send alert to adviser
5. Add to priority task list

**Workflow:**
```
Schedule → Get Court Dates → IF (Days Until)
  → [7 days] Send Standard Alert
  → [3 days] Send Urgent Alert + SMS
  → [1 day] Send Critical Alert + Call Adviser
```

---

### 9. Outcome Letter Generator 🟡

**When to use:** Generate and send outcome letters after case completion

**Trigger:** Case status → "Completed"

**What it does:**
1. Gets case details and outcome
2. Generates letter from template
3. Populates client information
4. Sends email with PDF attachment
5. Archives in client folder

**Workflow:**
```
Webhook → Get Case Details → Generate Letter → Convert to PDF → Email Client → Archive
```

---

## Reporting

### 10. Weekly Statistics Report 🟢

**When to use:** Send weekly performance summary to manager

**Trigger:** Friday 5 PM

**What it does:**
1. Calls MCP: Get centre statistics for past week
2. Formats as readable report
3. Generates charts (using Google Sheets)
4. Emails to manager

**Workflow:**
```
Schedule (Friday 5 PM) → Get Statistics → Format Report → Create Charts → Email Manager
```

**Report Format:**
```
Weekly Statistics Report
Week ending: {{ $now.toFormat('yyyy-MM-dd') }}

Clients:
- New clients: {{ $json.new_clients }}
- Total active: {{ $json.total_active }}
- Completed cases: {{ $json.completed }}

Outcomes:
- DRO applications: {{ $json.dro_count }}
- Bankruptcy: {{ $json.bankruptcy_count }}
- Debt management plans: {{ $json.dmp_count }}

Financial Impact:
- Total debt advised on: £{{ $json.total_debt }}
- Average debt per client: £{{ $json.avg_debt }}
- Total debt written off: £{{ $json.debt_written_off }}
```

---

### 11. Funder Report Generator 🔴

**When to use:** Generate monthly reports for funders

**Trigger:** 1st of month, 8 AM

**What it does:**
1. Collects data for previous month
2. Generates multiple report types
3. Creates graphs and visualizations
4. Compiles into PDF
5. Emails to funder contacts
6. Saves to Google Drive

**Workflow:**
```
Schedule → Get Monthly Data → Generate Report Types → Create Visualizations → Compile PDF → Email → Save to Drive
```

**Data Sources:**
- MCP centre statistics
- Calendar appointments
- Case management system
- Client satisfaction surveys

---

### 12. Real-Time Dashboard 🔴

**When to use:** Live dashboard showing current centre status

**Trigger:** Every 15 minutes

**What it does:**
1. Collects real-time metrics
2. Updates Google Sheet (used as dashboard)
3. Calculates trends
4. Highlights alerts

**Metrics:**
- Clients waiting
- Average wait time
- Cases in progress
- Urgent cases
- Adviser availability

---

## Case Management

### 13. Deadline Tracker 🟡

**When to use:** Track and alert on case deadlines

**Trigger:** Daily at 8 AM

**What it does:**
1. Gets all cases with deadlines
2. Categorizes by urgency:
   - Red: < 3 days
   - Amber: 3-7 days
   - Green: > 7 days
3. Sends prioritized list to advisers
4. Escalates red items to manager

**Workflow:**
```
Schedule → Get Deadlines → Categorize → Email Advisers → IF (Red) → Email Manager
```

---

### 14. Case Assignment Automation 🟡

**When to use:** Auto-assign new cases to advisers based on workload

**Trigger:** New case created

**What it does:**
1. Gets current adviser workloads
2. Checks adviser specialties
3. Assigns to least busy qualified adviser
4. Sends notification
5. Updates case record

**Logic:**
```javascript
Adviser Selection:
1. Filter by specialty (if DRO, bankruptcy, etc.)
2. Sort by current caseload (ascending)
3. Select first available
4. If all busy, add to queue
```

---

### 15. Quality Assurance Sampling 🟡

**When to use:** Random sample of cases for QA review

**Trigger:** Weekly

**What it does:**
1. Gets completed cases from last week
2. Randomly selects 10%
3. Creates QA checklist for each
4. Assigns to QA reviewer
5. Tracks completion

---

## Alerts & Monitoring

### 16. Service Health Monitor 🔴

**When to use:** Monitor system health and alert on issues

**Trigger:** Every 5 minutes

**What it does:**
1. Pings all services (RAG, MCP, DB)
2. Checks response times
3. If service down:
   - Send alert to IT
   - Log incident
   - Update status page

**Services to Monitor:**
- RAG Service (http://rag-service:8102/health)
- Client RAG (http://client-rag-service:8104/health)
- MCP Server (http://mcp-server:8105/health)
- Ollama (http://ollama:11434/api/tags)
- ChromaDB (http://chromadb:8000/api/v1/heartbeat)

**Workflow:**
```
Schedule (5 min) → Check Services → IF (Any Down) → Send Alert → Log Incident
```

---

### 17. High-Risk Client Alert 🟡

**When to use:** Alert when client shows high-risk indicators

**Trigger:** Document upload or case update

**What it does:**
1. Analyzes client situation
2. Checks for risk factors:
   - Court proceedings
   - Eviction notice
   - Utility disconnection
   - Mental health flags
3. If high-risk, escalates immediately

**Workflow:**
```
Webhook → Analyze Document → IF (High Risk) → Immediate Adviser Alert + Manager Notification
```

---

### 18. Capacity Warning System 🟢

**When to use:** Alert when centre approaching capacity

**Trigger:** Daily at 9 AM and 2 PM

**What it does:**
1. Gets current appointments and capacity
2. Calculates percentage full
3. If > 80%, warns manager
4. If > 95%, stops accepting new appointments

**Workflow:**
```
Schedule → Get Capacity → Calculate % → IF (> 80%) → Warn Manager
                                      → IF (> 95%) → Pause Bookings + Alert
```

---

## 🎯 Workflow Templates

### Template: Basic Email Automation

```json
{
  "name": "Basic Email Template",
  "nodes": [
    {
      "name": "Trigger",
      "type": "webhook",
      "path": "send-email"
    },
    {
      "name": "Send Email",
      "type": "emailSend",
      "fromEmail": "advice@riverside.org.uk",
      "toEmail": "{{ $json.recipient }}",
      "subject": "{{ $json.subject }}",
      "text": "{{ $json.body }}"
    }
  ]
}
```

### Template: MCP Tool Call

```json
{
  "name": "MCP Tool Template",
  "nodes": [
    {
      "name": "Call MCP Tool",
      "type": "httpRequest",
      "method": "POST",
      "url": "http://mcp-server:8105/mcp/tools/execute",
      "authentication": "httpHeaderAuth",
      "headers": {
        "X-API-Key": "={{ $credentials.mcpApiKey }}"
      },
      "body": {
        "tool_name": "TOOL_NAME_HERE",
        "arguments": {
          "param1": "value1"
        }
      }
    }
  ]
}
```

### Template: Conditional Branching

```json
{
  "name": "Conditional Template",
  "nodes": [
    {
      "name": "IF Decision",
      "type": "if",
      "conditions": {
        "string": [
          {
            "value1": "={{ $json.status }}",
            "operation": "equal",
            "value2": "urgent"
          }
        ]
      }
    },
    {
      "name": "If Urgent",
      "type": "emailSend",
      "subject": "URGENT: Immediate action required"
    },
    {
      "name": "If Standard",
      "type": "emailSend",
      "subject": "Standard notification"
    }
  ]
}
```

---

## 💡 Tips for Creating Workflows

### Start Simple
1. **One trigger, one action**
   - Get it working first
   - Add complexity later

2. **Test each node individually**
   - Execute node button
   - Check output
   - Verify before continuing

3. **Use descriptive names**
   - "Send Welcome Email" ✓
   - "HTTP Request 1" ✗

### Add Error Handling

```
Main Workflow
     ↓
   [Try]
     ↓
  IF Error?
   ├→ [Yes] → Send Error Alert → Log → Stop
   └→ [No] → Continue
```

### Use Expressions Wisely

```javascript
// Good: Clear and maintainable
{{ $json.client_name }}

// Bad: Complex nested logic
{{ $json.clients[0].details.name.split(' ')[0] }}
```

### Document Your Workflows

Add notes to complex nodes:
- Why this step is needed
- What data format expected
- Common issues and solutions

---

## 📥 Importing Templates

### From File

1. Click **+ Add Workflow**
2. Click **Import from File**
3. Select JSON file
4. Review imported nodes
5. Update credentials
6. Test before activating

### From Code

1. Copy JSON template
2. Click **+ Add Workflow**
3. Click **Import from URL** or **Import from clipboard**
4. Paste JSON
5. Click **Import**

---

## 🆘 Common Issues

### Workflow not executing

**Check:**
- [ ] Workflow is activated (toggle is ON)
- [ ] Trigger is configured correctly
- [ ] No errors in nodes (red indicators)
- [ ] Credentials are valid

### Data not passing between nodes

**Check:**
- [ ] Previous node executed successfully
- [ ] Field names match exactly
- [ ] Using correct expression syntax
- [ ] Data is in expected format

### Email not sending

**Check:**
- [ ] Email credentials configured
- [ ] SMTP settings correct
- [ ] "From" email authorized
- [ ] Recipient email valid

---

## 📚 Additional Resources

- **More examples**: `/services/n8n/workflows/`
- **n8n documentation**: https://docs.n8n.io
- **Community workflows**: https://n8n.io/workflows
- **Support**: it@riverside.org.uk

---

**Document Version:** 1.0.0
**Last Updated:** October 24, 2025
**Maintained By:** IT Team

**🚀 Start automating!**
