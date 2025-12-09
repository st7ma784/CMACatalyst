# Routing Fix Guide - Solving 503 Errors

## Quick Diagnosis

Run the diagnostic script to identify the exact failure point:
```bash
cd RMA-Demo
./diagnose-routing.sh
```

This will test the complete chain and tell you exactly what's broken.

## Common Issues and Fixes

### Issue #1: No Coordinators Registered (Most Common)

**Symptoms:**
- `curl https://api.rmatool.org.uk/api/admin/coordinators` returns `[]`
- Edge router logs show "No coordinators available"
- All service requests return 503

**Root Cause:**
Edge coordinator failed to register with Cloudflare edge router at startup.

**Diagnosis:**
```bash
# Check if coordinator is running
docker ps | grep edge-coordinator

# Check coordinator logs for registration
docker logs edge-coordinator 2>&1 | grep -E "(Tunnel|Register)"

# Should see these messages:
# ✅ Tunnel created: https://abc-xyz.trycloudflare.com
# 📝 Registering coordinator with edge router...
# ✅ Registered with edge router
```

**Fix Options:**

#### Option A: Verify Environment Variables
The coordinator needs `TUNNEL_URL` to register:

```bash
# Check edge-coordinator.yml
cat RMA-Demo/edge-coordinator.yml | grep TUNNEL_URL

# Should see something like:
# TUNNEL_URL: ${TUNNEL_URL:-}  # Set by init container
```

The init container creates the tunnel. Check its logs:
```bash
docker logs $(docker ps -a | grep tunnel-init | awk '{print $1}')
```

#### Option B: Manual Registration
If tunnel exists but registration failed, manually register:

```bash
# Get tunnel URL from logs
TUNNEL_URL=$(docker logs edge-coordinator 2>&1 | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)

echo "Tunnel URL: $TUNNEL_URL"

# Manually register
curl -X POST https://api.rmatool.org.uk/api/edge/register \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"edge-coordinator-manual\",
    \"tunnel_url\": \"$TUNNEL_URL\",
    \"dht_port\": 8468,
    \"capabilities\": {\"location\": \"local\"}
  }"

# Verify registration
curl https://api.rmatool.org.uk/api/admin/coordinators | jq
```

#### Option C: Restart Coordinator
Sometimes the registration fails due to timing. Restart:

```bash
cd RMA-Demo
docker-compose -f edge-coordinator.yml down
docker-compose -f edge-coordinator.yml up -d

# Wait 30 seconds for startup
sleep 30

# Check registration
curl https://api.rmatool.org.uk/api/admin/coordinators | jq
```

---

### Issue #2: No Workers Registered

**Symptoms:**
- Coordinator is registered
- `curl {coordinator_url}/api/admin/workers` returns `[]`
- Service requests return 503 "No workers available"

**Root Cause:**
Workers can't reach the coordinator or registration is failing.

**Diagnosis:**
```bash
# Check if local worker is running
docker ps | grep edge-local-worker

# Check worker logs
docker logs edge-local-worker 2>&1 | grep -E "(Coordinator|Register)"

# Should see:
# ✅ Coordinator is reachable
# 📝 Registering with coordinator...
# ✅ Registration successful!
```

**Fix:**

#### Check Worker Can Reach Coordinator
```bash
# Get coordinator URL from worker environment
docker inspect edge-local-worker | jq '.[0].Config.Env' | grep COORDINATOR_URL

# Test connectivity from worker
docker exec edge-local-worker curl http://localhost:8080/health
# Should return {"status": "healthy", ...}
```

#### Restart Worker
```bash
docker restart edge-local-worker

# Watch logs
docker logs -f edge-local-worker

# Look for: "✅ Registration successful!"
```

---

### Issue #3: Service Not Assigned to Worker

**Symptoms:**
- Worker is registered
- But doesn't have the service you need (e.g., `notes-coa`)

**Diagnosis:**
```bash
# Check what services are assigned
curl http://localhost:8080/api/admin/workers | jq '.[] | {id: .worker_id, services: .assigned_containers}'

# Example output:
# {
#   "id": "worker-123",
#   "services": ["chromadb", "redis"]  # ❌ Missing notes-coa
# }
```

**Root Cause:**
Coordinator assigns services based on "gaps" - services not yet covered.
If you have multiple workers, services might be distributed.

**Fix:**

#### Check Service Catalog
```bash
# See what services exist
grep -A 15 "SERVICE_CATALOG" RMA-Demo/services/local-coordinator/app.py

# Notes service is defined as:
# "notes-coa": {"tier": 2, "requires": "cpu", "priority": 3, "port": 8100}
```

#### Force Service Assignment
Edit coordinator to always assign specific services:

```python
# In services/local-coordinator/app.py
# Around line 420, in register_worker function

# Add after capability detection:
if worker_type == "edge":  # Local edge worker
    # Force assign critical services
    must_have = ["notes-coa", "rag-embeddings", "document-processing"]
    for service in must_have:
        if service not in assigned_containers:
            assigned_containers.append(service)
```

Then restart coordinator:
```bash
docker-compose -f edge-coordinator.yml restart coordinator
```

---

### Issue #4: Service Not Actually Running

**Symptoms:**
- Worker has service assigned
- But service requests still fail with connection errors

**Diagnosis:**
```bash
# Check if service processes are running
docker exec edge-local-worker ps aux | grep -E "(notes|python)"

# Check service launcher logs
docker logs edge-local-worker 2>&1 | grep "notes"

# Should see:
# 🚀 Launching service: notes-coa
# ✅ Service notes-coa started on port 8100
```

**Root Cause:**
Service launcher failed to start the service, or service crashed.

**Fix:**

#### Check Service Launcher
```bash
# Check if service_launcher.py has notes-coa handler
grep -A 20 "def launch_notes" RMA-Demo/worker-containers/universal-worker/service_launcher.py
```

#### Test Service Directly
```bash
# From inside worker
docker exec edge-local-worker curl http://localhost:8100/health

# If fails, service isn't running
# Check for port conflicts or missing dependencies
```

#### Restart Worker to Relaunch Services
```bash
docker restart edge-local-worker

# Watch for service launch messages
docker logs -f edge-local-worker | grep -E "(Launching|Service|started)"
```

---

### Issue #5: Path Routing Problem

**Symptoms:**
- Everything else works
- But service receives wrong path or 404

**Diagnosis:**
Test each layer:

```bash
# Test edge router → coordinator
curl https://api.rmatool.org.uk/service/notes/health

# Test coordinator → worker
curl http://localhost:8080/service/notes/health

# Test worker directly
curl http://localhost:8100/health
```

**Fix:**

Check path handling in coordinator (app.py line 262):
```python
remaining_path = "/" + path if not path.startswith("/") else path
```

Should correctly extract:
- URL: `/service/notes/convert`
- Service: `notes`
- Path: `/convert` (forwarded to worker)

---

## Quick Fixes for Production

### Restart Everything
```bash
cd RMA-Demo
docker-compose -f edge-coordinator.yml down
docker-compose -f edge-coordinator.yml up -d

# Wait for startup
sleep 30

# Run diagnostics
./diagnose-routing.sh
```

### Check Logs for All Components
```bash
# Edge coordinator
docker logs edge-coordinator 2>&1 | tail -50

# Local worker
docker logs edge-local-worker 2>&1 | tail -50

# Tunnel (if separate container)
docker logs $(docker ps -a | grep tunnel | awk '{print $1}') 2>&1 | tail -20
```

### Verify Each Layer Manually
```bash
# 1. Edge router
curl https://api.rmatool.org.uk/health

# 2. Coordinators registered
curl https://api.rmatool.org.uk/api/admin/coordinators | jq

# 3. Coordinator health (use URL from step 2)
COORD_URL="https://abc-xyz.trycloudflare.com"
curl $COORD_URL/health | jq

# 4. Workers registered
curl $COORD_URL/api/admin/workers | jq

# 5. Test service
curl -X POST https://api.rmatool.org.uk/service/notes/convert \
  -H "Content-Type: application/json" \
  -d '{"notes":"test","client_name":"test"}' | jq
```

---

## Prevention - Ensure Reliable Startup

### 1. Add Healthchecks to Docker Compose

```yaml
# edge-coordinator.yml
services:
  coordinator:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 40s

  worker:
    depends_on:
      coordinator:
        condition: service_healthy
```

### 2. Add Retry Logic to Registration

In `worker_agent.py`:
```python
def register_with_coordinator(self, retries=5) -> Dict[str, Any]:
    for attempt in range(retries):
        try:
            response = requests.post(...)
            return response.json()
        except Exception as e:
            if attempt < retries - 1:
                logger.warning(f"Registration failed, retrying in 5s... ({attempt+1}/{retries})")
                time.sleep(5)
            else:
                raise
```

### 3. Add Heartbeat Monitoring

Set up monitoring to alert when:
- No coordinators registered for > 5 minutes
- No workers registered for > 5 minutes
- Service requests failing for > 1 minute

```bash
# Add to crontab
*/5 * * * * /path/to/diagnose-routing.sh || /path/to/alert-script.sh
```

---

## Troubleshooting Flowchart

```
Frontend returns 503
    │
    ├─→ Is edge router accessible?
    │   (curl https://api.rmatool.org.uk/health)
    │   │
    │   ├─→ NO: Check Cloudflare Worker deployment
    │   └─→ YES: Continue
    │
    ├─→ Are coordinators registered?
    │   (curl https://api.rmatool.org.uk/api/admin/coordinators)
    │   │
    │   ├─→ NO: Fix coordinator registration (Issue #1)
    │   └─→ YES: Continue
    │
    ├─→ Is coordinator accessible?
    │   (curl {coordinator_url}/health)
    │   │
    │   ├─→ NO: Check tunnel and network
    │   └─→ YES: Continue
    │
    ├─→ Are workers registered?
    │   (curl {coordinator_url}/api/admin/workers)
    │   │
    │   ├─→ NO: Fix worker registration (Issue #2)
    │   └─→ YES: Continue
    │
    ├─→ Do workers have the service?
    │   (Check assigned_containers for service name)
    │   │
    │   ├─→ NO: Fix service assignment (Issue #3)
    │   └─→ YES: Continue
    │
    └─→ Is service actually running?
        (Test worker directly or check processes)
        │
        ├─→ NO: Fix service launcher (Issue #4)
        └─→ YES: Check path routing (Issue #5)
```

---

## Success Criteria

After fixing, you should see:

1. **Edge Router Health:**
   ```bash
   $ curl https://api.rmatool.org.uk/health
   {"status":"healthy","coordinators":1,"message":"Edge router operational"}
   ```

2. **Coordinators Registered:**
   ```bash
   $ curl https://api.rmatool.org.uk/api/admin/coordinators | jq
   [
     {
       "worker_id": "edge-coordinator-abc",
       "tunnel_url": "https://xyz.trycloudflare.com",
       "last_seen": "2025-12-08T14:00:00"
     }
   ]
   ```

3. **Workers Registered:**
   ```bash
   $ curl http://localhost:8080/api/admin/workers | jq
   [
     {
       "worker_id": "worker-123",
       "status": "healthy",
       "assigned_containers": ["notes-coa", "rag-embeddings", ...]
     }
   ]
   ```

4. **Service Responds:**
   ```bash
   $ curl -X POST https://api.rmatool.org.uk/service/notes/convert \
     -H "Content-Type: application/json" \
     -d '{"notes":"test","client_name":"test"}' | jq
   {
     "matters_discussed": "...",
     "our_actions": "...",
     "full_text": "..."
   }
   ```

---

## Still Not Working?

If you've tried all fixes and it's still broken:

1. **Collect Full Diagnostics:**
   ```bash
   ./diagnose-routing.sh > diagnostic-output.txt 2>&1
   docker logs edge-coordinator > coordinator.log 2>&1
   docker logs edge-local-worker > worker.log 2>&1
   docker ps > containers.txt
   ```

2. **Check Cloudflare Worker Deployment:**
   - Is the worker deployed at api.rmatool.org.uk?
   - Check Cloudflare dashboard → Workers & Pages
   - Verify routes are configured correctly
   - Check Durable Objects are enabled

3. **Network Issues:**
   - Is the tunnel URL actually accessible?
   - Can the Cloudflare Worker reach the tunnel?
   - Firewall blocking connections?

4. **Test Local-Only Setup:**
   ```bash
   # Bypass Cloudflare entirely
   COORD_URL="http://localhost:8080"

   # Test directly
   curl -X POST $COORD_URL/service/notes/convert \
     -H "Content-Type: application/json" \
     -d '{"notes":"test","client_name":"test"}'

   # If this works, issue is with Cloudflare routing
   # If this fails, issue is with coordinator/worker
   ```
