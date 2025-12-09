# RMA Tool Routing Architecture - Complete Flow

## The Problem: 503 Errors on Service Requests

Frontend is getting `503 Service Unavailable` when calling:
```
POST https://api.rmatool.org.uk/service/notes/convert
```

## Expected Routing Flow

```
┌──────────────┐
│   Frontend   │ https://rmatool.org.uk
│ (Cloudflare  │
│    Pages)    │
└──────┬───────┘
       │ POST /service/notes/convert
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│        Cloudflare Worker (Edge Router)                   │
│        Deployed at: api.rmatool.org.uk                   │
│        Code: services/cloudflare-edge-router/index.js    │
├──────────────────────────────────────────────────────────┤
│  Routes:                                                  │
│  • /service/* → Forward to coordinator                   │
│  • /api/worker/register → Forward to coordinator         │
│  • /api/worker/heartbeat → Forward to coordinator        │
│  • /api/edge/register → Store coordinator registration   │
│  • /api/admin/* → Proxy to coordinator                   │
└──────┬───────────────────────────────────────────────────┘
       │ Forward to coordinator.tunnel_url/service/notes/convert
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│            Edge Coordinator (Local)                      │
│            Code: services/local-coordinator/app.py       │
│            Runs with Cloudflare Tunnel                   │
├──────────────────────────────────────────────────────────┤
│  Service Mapping:                                        │
│  • notes     → notes-coa (internal service name)         │
│  • rag       → rag-embeddings                            │
│  • upload    → document-processing                       │
│  • ner       → ner-extraction                            │
│  • ocr       → vision-ocr                                │
│  • llm       → llm-inference                             │
│                                                           │
│  Route: /service/{service}/{path:path}                   │
│  Example: /service/notes/convert                         │
│    1. Maps "notes" → "notes-coa"                         │
│    2. Finds worker with "notes-coa" service              │
│    3. Forwards "/convert" to worker.tunnel_url/convert   │
└──────┬───────────────────────────────────────────────────┘
       │ Forward to worker.tunnel_url/convert
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│              Universal Worker                            │
│              Code: worker-containers/universal-worker    │
│              Running: notes-service container            │
├──────────────────────────────────────────────────────────┤
│  Service: notes-service                                  │
│  Code: services/notes-service/app.py                     │
│  Endpoint: POST /convert                                 │
│  Port: 8100                                              │
│                                                           │
│  Receives: { notes, client_name }                        │
│  Returns: { matters_discussed, our_actions, ... }        │
└──────────────────────────────────────────────────────────┘
```

## Actual Frontend Routes Called

From `frontend/src/lib/apiUrls.ts` and component analysis:

### Service Routes (via /service/*)
| Frontend Call | Maps To | Worker Service | Actual Endpoint |
|--------------|---------|----------------|-----------------|
| `/service/notes/convert` | `notes-coa` | notes-service | `POST /convert` |
| `/service/rag/*` | `rag-embeddings` | rag-service | Various |
| `/service/upload/*` | `document-processing` | upload-service | Various |
| `/service/ner/*` | `ner-extraction` | ner-service | Various |

### Admin Routes (via /api/admin/*)
| Frontend Call | Purpose | Proxied To |
|--------------|---------|------------|
| `/api/admin/workers` | List workers | Coordinator |
| `/api/admin/stats` | System stats | Coordinator |
| `/api/dht/stats` | DHT status | Coordinator |
| `/api/dht/topology` | DHT topology | Coordinator |

## Where Things Break - Root Causes

### Issue #1: No Coordinators Registered ⚠️
**Symptom:** Edge router returns 503 "No coordinators available"

**Root Cause:**
- Edge coordinator must register with Cloudflare edge router at startup
- Registration endpoint: `POST https://api.rmatool.org.uk/api/edge/register`
- Registration requires:
  ```json
  {
    "worker_id": "edge-coordinator-123",
    "tunnel_url": "https://abc-xyz.trycloudflare.com",
    "dht_port": 8468,
    "capabilities": { "location": "unknown" }
  }
  ```

**Check:**
```bash
# From edge coordinator logs
docker logs edge-coordinator 2>&1 | grep "Registered with edge router"
# Should see: "✅ Registered with edge router"

# Or query edge router
curl https://api.rmatool.org.uk/api/admin/coordinators
# Should return array of registered coordinators
```

**Fix:** Ensure coordinator registration happens at startup (already in code at line 136-155 of app.py)

---

### Issue #2: No Workers Registered ⚠️
**Symptom:** Coordinator returns 503 "No workers available for service: notes-coa"

**Root Cause:**
- Workers must register with coordinator
- Universal worker calls `/api/worker/register` at startup
- But if coordinator isn't reachable, registration fails

**Check:**
```bash
# Check coordinator's registered workers
curl http://localhost:8080/api/admin/workers
# Should return array of workers

# Check worker logs
docker logs edge-local-worker 2>&1 | grep "Registration"
# Should see: "✅ Registration successful!"
```

**Fix:** Ensure worker can reach coordinator URL

---

### Issue #3: Service Not Assigned ⚠️
**Symptom:** Worker is registered but doesn't have `notes-coa` service

**Root Cause:**
- Coordinator assigns services based on "gaps" - what services are missing
- If a service is already covered by another worker, new workers don't get it
- Service catalog is defined in coordinator (lines 78-100 of app.py)

**Check:**
```bash
# Check worker's assigned services
curl http://localhost:8080/api/admin/workers | jq '.[] | {id: .worker_id, services: .assigned_containers}'
# Should show notes-coa in assigned_containers
```

**Fix:** Ensure service assignment logic includes needed services

---

### Issue #4: Service Not Actually Running ⚠️
**Symptom:** Service is assigned but worker isn't running the container

**Root Cause:**
- Universal worker receives service assignments but must launch them
- `service_launcher.py` launches services as subprocesses
- If launch fails, service won't respond

**Check:**
```bash
# Check worker processes
docker exec edge-local-worker ps aux | grep notes
# Should see python process running notes-service

# Test service directly
curl http://worker-hostname:8100/health
# Should return {"status": "healthy"}
```

**Fix:** Check service_launcher.py for notes-coa service launcher

---

### Issue #5: Incorrect Path Forwarding ⚠️
**Symptom:** Service is running but receives wrong path

**Problem:** Path manipulation between layers

**Frontend sends:**
```
POST https://api.rmatool.org.uk/service/notes/convert
```

**Edge router forwards:**
```
POST {coordinator.tunnel_url}/service/notes/convert
```

**Coordinator extracts:**
- Service: "notes"
- Path: "convert" (or "/convert")

**Coordinator forwards:**
```
POST {worker.tunnel_url}/convert  (✅ correct)
```

**Worker expects:**
```
POST /convert  (✅ matches)
```

**Check:** Review coordinator path handling at line 262 in app.py

---

## Current Status Checklist

Run these commands to diagnose:

```bash
# 1. Check Cloudflare Edge Router
curl https://api.rmatool.org.uk/health
# Expected: {"status": "healthy", "coordinators": 1, ...}

# 2. Check registered coordinators
curl https://api.rmatool.org.uk/api/admin/coordinators
# Expected: [{"worker_id": "...", "tunnel_url": "https://...", ...}]

# 3. Check coordinator health
curl https://api.rmatool.org.uk/api/admin/workers
# Expected: Array of workers with assigned services

# 4. Check specific worker
curl https://api.rmatool.org.uk/api/admin/workers | jq '.[] | select(.assigned_containers[] | contains("notes"))'
# Expected: Worker with notes-coa service

# 5. Test service directly (if you have worker tunnel URL)
curl {worker.tunnel_url}/convert -X POST \
  -H "Content-Type: application/json" \
  -d '{"notes": "test", "client_name": "test"}'
# Expected: 200 OK with response

# 6. Test through coordinator
curl {coordinator.tunnel_url}/service/notes/convert -X POST \
  -H "Content-Type: application/json" \
  -d '{"notes": "test", "client_name": "test"}'
# Expected: 200 OK with response

# 7. Test through edge router (full stack)
curl https://api.rmatool.org.uk/service/notes/convert -X POST \
  -H "Content-Type: application/json" \
  -d '{"notes": "test", "client_name": "test"}'
# Expected: 200 OK with response
```

## Most Likely Root Cause

Based on the symptoms, the most likely issue is:

**No coordinators registered with edge router at api.rmatool.org.uk**

This would cause:
- Edge router returns 503 "No coordinators available"
- Admin endpoints also fail (they proxy to coordinator)
- Service endpoints all fail

**Verification:**
```bash
curl https://api.rmatool.org.uk/api/admin/coordinators
```

If this returns `[]` (empty array) or an error, then coordinators aren't registering.

**Why coordinators might not register:**
1. Coordinator isn't setting `TUNNEL_URL` environment variable
2. Coordinator tunnel isn't actually created (cloudflared not running)
3. Network issue preventing registration HTTP call
4. Edge router's Durable Object isn't persisting registrations

## Next Steps

1. **Check coordinator registration**:
   ```bash
   docker logs edge-coordinator 2>&1 | grep -E "(Tunnel|Register)"
   ```

2. **Verify tunnel is created**:
   ```bash
   # Should see tunnel URL in logs
   docker logs edge-coordinator 2>&1 | grep "trycloudflare.com"
   ```

3. **Test coordinator accessibility**:
   ```bash
   # Get tunnel URL from logs
   TUNNEL_URL="https://abc-xyz.trycloudflare.com"
   curl $TUNNEL_URL/health
   ```

4. **Test edge router**:
   ```bash
   curl https://api.rmatool.org.uk/health
   ```

5. **Manually register coordinator** (if needed):
   ```bash
   curl -X POST https://api.rmatool.org.uk/api/edge/register \
     -H "Content-Type: application/json" \
     -d '{
       "worker_id": "test-coordinator",
       "tunnel_url": "'"$TUNNEL_URL"'",
       "dht_port": 8468,
       "capabilities": {"location": "local"}
     }'
   ```
