# n8n Troubleshooting Guide

**For:** Centre Managers & IT Support
**Purpose:** Diagnose and fix common n8n issues
**Version:** 1.0.0

---

## 🚨 Quick Diagnosis

### Is it working at all?

```bash
# Can you access n8n?
http://localhost:5678

✓ Yes → n8n is running, issue is with specific workflow
✗ No → n8n service is down, see "Service Not Starting"
```

### Is your workflow executing?

**Check Executions tab:**
1. Click **Executions** (left sidebar)
2. Look for your workflow name
3. Check status:
   - ✓ Green = Success
   - ✗ Red = Failed
   - ⏸️ Gray = Stopped/Waiting

---

## 🔧 Common Problems & Solutions

### Problem 1: n8n Won't Start

**Symptoms:**
- Can't access http://localhost:5678
- "Connection refused" error
- Page won't load

**Diagnostic Steps:**

```bash
# 1. Check if n8n container is running
docker-compose ps | grep n8n

# Expected output:
rma-n8n  ... Up ... 0.0.0.0:5678->5678/tcp

# If not running:
docker-compose up -d n8n

# 2. Check n8n logs for errors
docker-compose logs n8n | tail -50

# Look for:
# - "n8n ready on port 5678" → Good!
# - "ECONNREFUSED" → Database/dependency issue
# - "EADDRINUSE" → Port already in use
```

**Solutions:**

**A) Port Already in Use**
```bash
# Find what's using port 5678
sudo lsof -i :5678

# Kill the process or change n8n port in docker-compose.yml:
ports:
  - "5679:5678"  # Use different external port
```

**B) Database Not Ready**
```bash
# Ensure all dependencies are up
docker-compose up -d

# Wait 30 seconds, then check
docker-compose ps
```

**C) Volume Permission Issues**
```bash
# Check volume permissions
docker-compose exec n8n ls -la /home/node/.n8n

# Fix if needed
docker-compose down
sudo chown -R 1000:1000 ./n8n_data
docker-compose up -d n8n
```

---

### Problem 2: Can't Login

**Symptoms:**
- "Invalid credentials" error
- Login page redirects back
- "Unauthorized" message

**Solutions:**

**A) Forgot Password**
```bash
# Reset admin password
docker-compose exec n8n n8n user-management:reset --email=admin@localhost

# Or set new password in .env:
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=new_password_here

# Then restart:
docker-compose restart n8n
```

**B) Auth Not Configured**
```bash
# Check docker-compose.yml has:
environment:
  - N8N_BASIC_AUTH_ACTIVE=true
  - N8N_BASIC_AUTH_USER=${N8N_USER:-admin}
  - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD:-changeme123}

# And .env has:
N8N_USER=admin
N8N_PASSWORD=your_password_here
```

---

### Problem 3: Workflow Won't Activate

**Symptoms:**
- Toggle switch won't turn on
- Error message when activating
- "Workflow has issues" warning

**Common Causes:**

**A) Missing Credentials**
```
Error: "Node 'Send Email' has no credentials"

Solution:
1. Click the red node
2. Click "Credentials"
3. Select or create credential
4. Test credential
5. Save workflow
6. Try activating again
```

**B) Invalid Trigger Configuration**
```
Error: "Webhook path is empty"

Solution:
1. Click trigger node
2. Fill in required fields
3. For webhook: Set unique path (e.g., "new-client")
4. For schedule: Set valid cron expression
5. Save and activate
```

**C) Incomplete Node Configuration**
```
Error: "Required parameter missing"

Solution:
1. Look for red warning icon on nodes
2. Click node
3. Fill in all required fields (marked with *)
4. Save workflow
```

---

### Problem 4: Workflow Executes But Fails

**Symptoms:**
- Workflow starts (green checkmark on trigger)
- Some nodes execute, others fail
- Red X on specific node

**Diagnostic Process:**

**Step 1: Identify Failed Node**
```
1. Click workflow in Executions tab
2. Find node with red X
3. Click to see error message
4. Read error carefully
```

**Step 2: Common Node Errors**

#### Email Node Fails

```
Error: "SMTP connection failed"

Check:
- SMTP server address correct?
- Port correct? (usually 587 or 465)
- Username/password valid?
- Firewall allowing SMTP?

Test:
1. Click node
2. Click "Execute Node"
3. Read detailed error
```

#### HTTP Request Fails (MCP Calls)

```
Error: "401 Unauthorized"
→ API key missing or wrong
→ Check X-API-Key header
→ Verify credential configuration

Error: "404 Not Found"
→ Wrong URL or endpoint
→ Should be: http://mcp-server:8105/mcp/tools/execute

Error: "500 Server Error"
→ MCP server issue
→ Check: docker-compose logs mcp-server

Error: "Connection refused"
→ MCP server not running
→ Run: docker-compose up -d mcp-server
```

#### IF Node Always Takes Same Path

```
Problem: IF node always goes to "true" or "false"

Debug:
1. Click IF node
2. Look at input data (left panel)
3. Check field name matches exactly
4. Verify comparison operator correct

Example:
Input: { "status": "urgent" }
Condition: status === "urgent" ✓
Condition: Status === "urgent" ✗ (wrong case)
Condition: status == "Urgent" ✗ (wrong value case)
```

---

### Problem 5: Data Not Passing Between Nodes

**Symptoms:**
- `{{ $json.field }}` shows empty
- "Cannot read property of undefined"
- Data exists in one node but not next

**Understanding Data Flow:**

```
Node 1 Output:
{
  "client_id": "CLIENT_123",
  "name": "John Smith"
}

Node 2 Reference:
{{ $json.client_id }}  → "CLIENT_123" ✓
{{ $json.name }}       → "John Smith" ✓
{{ $json.email }}      → undefined ✗ (doesn't exist)
```

**Solutions:**

**A) Wrong Field Name**
```
Problem: {{ $json.clientId }}
Node output has: client_id (with underscore)

Solution: {{ $json.client_id }}
```

**B) Data in Wrong Format**
```
Problem: Expected object, got array
Output: [{ "name": "John" }]

Wrong: {{ $json.name }}
Right: {{ $json[0].name }}
```

**C) Referencing Previous Node**
```
Current node: {{ $json.field }}       → Current node's data
Named node:   {{ $node["Node Name"].json.field }}  → Specific node
All items:    {{ $("Node Name").all() }}          → All outputs
```

**D) Check Data Structure**
```
1. Click node that should have data
2. Look at "OUTPUT" tab
3. Expand JSON to see structure
4. Use exact path to field
```

---

### Problem 6: Webhook Not Triggering

**Symptoms:**
- Send data to webhook URL
- Nothing happens
- Workflow doesn't execute

**Diagnostic Steps:**

**Step 1: Get Correct URL**
```
1. Open workflow
2. Click webhook trigger node
3. Click "Listen for Test Event"
4. Copy the "Test URL"

Example: http://localhost:5678/webhook-test/new-client
```

**Step 2: Test Webhook**
```bash
# Use curl to test
curl -X POST http://localhost:5678/webhook-test/new-client \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check n8n Executions tab immediately
# Should see new execution
```

**Step 3: Common Issues**

```
Issue: "Webhook not found"
→ Workflow not activated
→ Solution: Activate workflow first

Issue: "Method not allowed"
→ Webhook expects POST, you sent GET
→ Solution: Check HTTP method in node config

Issue: "Webhook path conflicts"
→ Two workflows use same path
→ Solution: Use unique paths (e.g., "new-client-v2")
```

**Step 4: Production URL**
```
Test URL: http://localhost:5678/webhook-test/path
Production URL: http://localhost:5678/webhook/path

After testing, use production URL in your app!
```

---

### Problem 7: Schedule Trigger Not Running

**Symptoms:**
- Workflow should run daily/weekly
- Never executes
- Executions tab shows nothing

**Check Cron Expression:**

```
Valid cron examples:
0 9 * * *     → Every day at 9 AM
0 9 * * 1     → Every Monday at 9 AM
0 */2 * * *   → Every 2 hours
*/15 * * * *  → Every 15 minutes

Invalid (common mistakes):
9 * * * *     → Missing minute (runs hourly!)
0 9 * * 8     → Day 8 doesn't exist (0-6 for Sun-Sat)
```

**Testing Schedule:**

```
1. Set schedule to run soon (e.g., 5 min from now)
2. Activate workflow
3. Wait
4. Check Executions tab

OR

Manually test:
1. Click "Execute Workflow" button
2. Verifies logic works
3. Then set real schedule
```

**Check Timezone:**

```yaml
# In docker-compose.yml:
environment:
  - GENERIC_TIMEZONE=Europe/London

# Cron runs in this timezone
# 9 AM = 9 AM London time
```

---

### Problem 8: Workflow Loops Forever

**Symptoms:**
- Workflow executes thousands of times
- Fills up execution history
- Slows down n8n

**Causes:**

```
Infinite Loop Example:
Webhook → Send Email → [Email triggers same webhook!]
                         ↓
                      Loop!
```

**Solutions:**

**A) Add Exit Condition**
```
Use IF node:
IF (execution_count < 10)
  → [Yes] Continue
  → [No] Stop
```

**B) Use Wait Node**
```
Loop → Wait (1 minute) → Check condition → Exit if met
```

**C) Emergency Stop**
```bash
# Stop workflow immediately
1. Go to workflow
2. Toggle "Active" OFF

# Or restart n8n
docker-compose restart n8n
```

---

### Problem 9: Slow Workflow Execution

**Symptoms:**
- Workflow takes minutes to complete
- Should be seconds
- Times out

**Performance Diagnosis:**

```
1. Open workflow execution
2. Check each node's execution time
3. Find bottleneck

Common slow nodes:
- HTTP requests (external APIs)
- Loop over large datasets
- Complex IF logic
```

**Solutions:**

**A) Optimize HTTP Requests**
```
Slow: Loop → Call API for each item (100 items = 100 calls)

Fast: Collect IDs → Single API call with all IDs
```

**B) Limit Loop Items**
```
Instead of: Process all 1000 clients

Use: Process first 100, schedule next batch
```

**C) Add Timeout**
```
HTTP Request node:
- Timeout: 10000 (10 seconds)
- Prevents hanging on slow APIs
```

---

### Problem 10: Credentials Not Working

**Symptoms:**
- "Authentication failed"
- "Invalid API key"
- Credentials won't save

**Diagnostic Steps:**

**Step 1: Test Credential**
```
1. Go to Credentials
2. Find credential
3. Click "Test"
4. Check result
```

**Step 2: Common Issues**

**A) API Key Wrong**
```
MCP API Key should be:
- Exactly as in .env file (MCP_API_KEY)
- No extra spaces
- No quotes

Check .env:
MCP_API_KEY=dev-key-change-in-production

Use in credential:
dev-key-change-in-production
(NOT "dev-key-change-in-production")
```

**B) Email Credentials**
```
Common mistakes:
- Wrong SMTP server (gmail.com vs smtp.gmail.com)
- Wrong port (587 for TLS, 465 for SSL)
- 2FA enabled (need app password, not regular password)
- Less secure apps blocked (enable in email settings)
```

**C) Header Auth Not Set**
```
For MCP:
Type: Header Auth
Name: X-API-Key
Value: [your MCP key]

NOT:
Type: Basic Auth
```

---

## 🔍 Debug Tools

### 1. Execution Log

**Where:** Executions tab → Click execution → See detailed log

**What to look for:**
- Input data to each node
- Output data from each node
- Error messages
- Execution time per node

### 2. Node Output Panel

**How:** Click node → See OUTPUT tab

**Shows:**
- JSON data structure
- Array vs object
- Null/undefined values
- Field names (exact spelling)

### 3. Expression Editor

**How:** Click field with `={{ }}` → Opens editor

**Use to:**
- Test expressions before saving
- See live preview of output
- Check data availability

### 4. Workflow Logs

```bash
# See n8n system logs
docker-compose logs -f n8n

# Filter for errors
docker-compose logs n8n | grep -i error

# Filter for specific workflow
docker-compose logs n8n | grep "Workflow: Client Welcome"
```

---

## 📊 Health Checks

### Daily Checks

```bash
# 1. Are services running?
docker-compose ps | grep -E "n8n|mcp"

# 2. Any failed executions today?
# Check n8n UI: Executions → Filter by "Failed"

# 3. Disk space OK?
df -h | grep docker
```

### Weekly Checks

```bash
# 1. Review execution history
#    Delete old test executions

# 2. Check for loops
#    Look for workflows with 100+ executions/day

# 3. Update workflows if needed
#    Import new templates
#    Fix deprecated nodes
```

### Monthly Maintenance

```bash
# 1. Backup workflows
docker-compose exec n8n n8n export:workflow --all --output=/backups/

# 2. Review credentials
#    Remove unused
#    Update passwords

# 3. Clear old executions
#    Settings → Prune execution data
```

---

## 🆘 When to Escalate

### Call IT Support When:

❌ Can't access n8n after restart
❌ Data appears to be lost
❌ Can't create/save workflows
❌ Performance severely degraded
❌ Security concern (unauthorized access)

### You Can Handle:

✅ Individual workflow not working
✅ Credential configuration
✅ Node parameter adjustments
✅ Workflow logic issues
✅ Schedule changes

---

## 📞 Getting Help

### Information to Provide:

1. **Workflow name** and ID
2. **Error message** (exact text)
3. **What you expected** to happen
4. **What actually** happened
5. **Steps to reproduce**

### Screenshots to Include:

- Failed node with error
- Node configuration
- Input/output data
- Execution log

### Example Support Request:

```
Subject: n8n Workflow "Client Welcome" failing on email send

Workflow: Client Welcome (ID: abc123)

Error: "SMTP connection failed"

Expected: Welcome email sends to client

Actual: Email node fails with error:
"Could not connect to mail server smtp.example.com:587"

Steps to reproduce:
1. Activate workflow
2. Send test data to webhook
3. Email node fails

Screenshot attached showing error details.

Config:
- SMTP: smtp.example.com
- Port: 587
- TLS: enabled
```

---

## 🎓 Learning Resources

### Official Docs
- n8n docs: https://docs.n8n.io
- Community forum: https://community.n8n.io

### Video Tutorials
- YouTube: n8n channel
- Search: "n8n troubleshooting"

### Internal Resources
- Centre Manager Guide: `N8N_CENTRE_MANAGER_GUIDE.md`
- Workflow Examples: `N8N_WORKFLOW_EXAMPLES.md`
- IT Support: it@riverside.org.uk

---

## ✅ Troubleshooting Checklist

Before asking for help, check:

- [ ] n8n service is running (`docker-compose ps`)
- [ ] Workflow is activated (toggle ON)
- [ ] All nodes are configured (no red warnings)
- [ ] Credentials are set and tested
- [ ] Checked Executions tab for errors
- [ ] Tried executing workflow manually
- [ ] Reviewed node input/output data
- [ ] Checked service logs for errors
- [ ] Tested with simple/dummy data
- [ ] Documented error message and steps

---

**Document Version:** 1.0.0
**Last Updated:** October 24, 2025
**Support:** it@riverside.org.uk

**🔧 Happy Troubleshooting!**
