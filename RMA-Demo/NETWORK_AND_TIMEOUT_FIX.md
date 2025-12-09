# Network and Timeout Fixes - Complete Guide

## Problems Fixed

1. **Docker IP addresses (172.x.x.x) in logs** instead of proper hostnames
2. **404 errors on worker heartbeats** due to worker ID mismatch
3. **Workers disappearing during model loading** due to timeout

## Root Causes

### Issue 1: Docker Bridge Networking
When using Docker bridge networks, containers see each other via internal IPs like `172.18.0.3`. This causes:
- Logs showing `172.18.0.3` instead of `edge-local-worker`
- Confusion when debugging
- Potential routing issues

### Issue 2: Worker ID Mismatch (Already Fixed)
- Worker generates its own ID: `worker-edge-local-worker-1733665200`
- Coordinator assigns different ID: `worker_abc123`
- Worker never updates to coordinator's ID
- Heartbeats use old ID → 404 errors

**Status:** ✅ Fixed in `worker_agent.py` (lines 433-437)

### Issue 3: Short Timeout During Model Loading
- Coordinator marks workers unhealthy after **90 seconds** without heartbeat
- Model loading (vLLM, transformers) can take **5-10 minutes**
- Worker gets removed while loading models
- Services never start

## Solutions Applied

### Fix 1: Use Host Networking

**Changed:** `edge-coordinator-fixed.yml`
- Coordinator now uses `network_mode: host`
- Worker uses `network_mode: host`
- No more Docker bridge IPs

**Benefits:**
- ✅ Logs show proper hostnames
- ✅ Worker can access localhost:8080 directly
- ✅ No NAT overhead
- ✅ Simpler networking

**Trade-off:**
- Port conflicts possible (8080, 8468 must be free)
- Less isolated than bridge networking

### Fix 2: Increased Timeouts

**Changed:** `services/local-coordinator/app.py`
- Configurable timeouts via environment variables
- Default healthy timeout: 90s → **300s (5 minutes)**
- Default stale timeout: 120s → **600s (10 minutes)**
- Worker marked "degraded" instead of removed during long operations

**New Environment Variables:**
```bash
HEARTBEAT_TIMEOUT_SECONDS=300  # Mark unhealthy after 5 min
WORKER_TIMEOUT_SECONDS=600     # Remove worker after 10 min
```

### Fix 3: Build Worker from Local Source

**Changed:** `edge-coordinator-fixed.yml`
- Worker now builds from local `Dockerfile.optimized`
- Includes heartbeat fix
- Uses optimized multi-stage build

## Migration Steps

### Step 1: Stop Current Stack
```bash
cd RMA-Demo
docker-compose -f edge-coordinator.yml down
```

### Step 2: Rebuild Coordinator Image

The coordinator needs the timeout fixes. You have two options:

#### Option A: Use Fixed Docker Compose (Recommended)
```bash
# Use the new docker-compose file with all fixes
docker-compose -f edge-coordinator-fixed.yml up -d --build
```

#### Option B: Rebuild Coordinator Manually
```bash
# If you want to push to your registry
cd services/local-coordinator
docker build -t ghcr.io/st7ma784/cmacatalyst/coordinator:latest .
docker push ghcr.io/st7ma784/cmacatalyst/coordinator:latest

# Then use original compose file
cd ../..
docker-compose -f edge-coordinator.yml up -d
```

### Step 3: Wait for Startup
```bash
# Watch logs
docker logs -f edge-coordinator

# Look for:
# ⏱️  Worker timeouts: healthy=300s, stale=600s
# ✅ Coordinator ready

# Wait ~30 seconds for worker to register
sleep 30
```

### Step 4: Verify Workers Register
```bash
# Check workers
curl http://localhost:8080/api/admin/workers | jq

# Should see edge-local-worker with status: "healthy"
```

### Step 5: Test Service Routes
```bash
# Run diagnostic script
./diagnose-routing.sh

# Should pass all checks
```

## What Changed in Each File

### 1. `edge-coordinator-fixed.yml`
```yaml
# BEFORE: Bridge networking
networks:
  edge-network:
    driver: bridge

services:
  coordinator:
    networks:
      - edge-network

# AFTER: Host networking
services:
  coordinator:
    network_mode: host  # Direct host access
    environment:
      - HEARTBEAT_TIMEOUT_SECONDS=300
      - WORKER_TIMEOUT_SECONDS=600

  local-worker:
    network_mode: host  # Direct host access
    build:              # Build from local source
      context: ./worker-containers/universal-worker
      dockerfile: Dockerfile.optimized
```

### 2. `services/local-coordinator/app.py`
```python
# BEFORE: Hardcoded 90 second timeout
def is_worker_healthy(worker):
    age_seconds = (now - last_heartbeat).total_seconds()
    return age_seconds < 90  # Too short!

# AFTER: Configurable timeout
WORKER_HEALTHY_TIMEOUT = int(os.getenv("HEARTBEAT_TIMEOUT_SECONDS", "300"))

def is_worker_healthy(worker):
    age_seconds = (now - last_heartbeat).total_seconds()
    return age_seconds < WORKER_HEALTHY_TIMEOUT  # 5 minutes default
```

### 3. `worker-containers/universal-worker/worker_agent.py`
```python
# BEFORE: Never updated worker_id
response = requests.post(...)
result = response.json()
return result  # ❌ Ignores coordinator's assigned ID

# AFTER: Updates to coordinator's ID
response = requests.post(...)
result = response.json()

# ✅ Update worker_id with coordinator's assignment
if "worker_id" in result:
    self.worker_id = result["worker_id"]
    logger.info(f"   Assigned Worker ID: {self.worker_id}")

return result
```

## Verification Checklist

After migration, verify everything works:

### 1. Check Logs Show Hostnames
```bash
docker logs edge-coordinator 2>&1 | tail -20
```

**Before (Bad):**
```
INFO: 172.18.0.3:57610 - "POST /api/worker/heartbeat HTTP/1.1" 404
```

**After (Good):**
```
INFO: 127.0.0.1:57610 - "POST /api/worker/heartbeat HTTP/1.1" 200 OK
```

### 2. Check Worker Registered
```bash
curl http://localhost:8080/api/admin/workers | jq
```

**Should see:**
```json
[
  {
    "worker_id": "edge-local-worker",
    "status": "healthy",
    "assigned_containers": ["notes-coa", "rag-embeddings", ...],
    "last_heartbeat": "2025-12-08T15:00:00"
  }
]
```

### 3. Check No 404 Errors
```bash
docker logs edge-local-worker 2>&1 | grep -i "404\|error"
```

**Should see:**
```
# Nothing! (or only old errors before restart)
```

### 4. Check Worker Survives Model Loading
```bash
# Watch worker during model load
watch -n 2 'curl -s http://localhost:8080/api/admin/workers | jq ".[].status"'

# Should stay "healthy" even during long model loading
# May briefly show "degraded" but shouldn't disappear
```

### 5. Test Service Endpoints
```bash
curl -X POST http://localhost:8080/service/notes/convert \
  -H "Content-Type: application/json" \
  -d '{"notes":"test","client_name":"test"}' | jq
```

**Should return:**
```json
{
  "matters_discussed": "...",
  "our_actions": "...",
  "full_text": "..."
}
```

## Monitoring

### Check Worker Health Over Time
```bash
# Run this in a separate terminal
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:8080/api/admin/workers | jq '.[] | {id: .worker_id, status: .status, last_heartbeat: .last_heartbeat}'
  sleep 30
done
```

### Watch for Degraded Status
```bash
# Alert if worker becomes degraded
docker logs -f edge-coordinator | grep -E "degraded|stale|Removing"
```

If you see workers becoming degraded frequently, increase timeouts further:
```yaml
environment:
  - HEARTBEAT_TIMEOUT_SECONDS=600  # 10 minutes
  - WORKER_TIMEOUT_SECONDS=1200    # 20 minutes
```

## Troubleshooting

### Workers Still Getting 404
**Cause:** Using old worker image without ID update fix

**Fix:**
```bash
# Force rebuild worker
docker-compose -f edge-coordinator-fixed.yml build local-worker --no-cache
docker-compose -f edge-coordinator-fixed.yml up -d local-worker
```

### Workers Still Disappearing
**Cause:** Model loading takes longer than timeout

**Fix:** Increase timeout:
```bash
# Edit edge-coordinator-fixed.yml
environment:
  - HEARTBEAT_TIMEOUT_SECONDS=900  # 15 minutes
  - WORKER_TIMEOUT_SECONDS=1800    # 30 minutes

# Restart
docker-compose -f edge-coordinator-fixed.yml restart coordinator
```

### Port Conflicts with Host Networking
**Cause:** Another service using port 8080 or 8468

**Check:**
```bash
sudo lsof -i :8080
sudo lsof -i :8468
```

**Fix:** Stop conflicting service or change ports:
```yaml
environment:
  - PORT=8081  # Use different port
```

### Still Seeing Docker IPs
**Cause:** Not using fixed docker-compose file

**Fix:** Ensure using `edge-coordinator-fixed.yml` with `network_mode: host`

## Rollback Plan

If things break, rollback:

```bash
# Stop new stack
docker-compose -f edge-coordinator-fixed.yml down

# Revert coordinator code
cd services/local-coordinator
git checkout app.py

# Start old stack
cd ../..
docker-compose -f edge-coordinator.yml up -d
```

## Next Steps

After migration:
1. Monitor worker status for 1 hour
2. Verify services respond correctly
3. Check error logs for any issues
4. Update production deployment
5. Document any custom timeout values needed

## Summary

✅ **Fixed:** Docker IP addresses → Using host networking
✅ **Fixed:** 404 heartbeat errors → Worker ID now syncs
✅ **Fixed:** Workers disappearing → Timeouts increased to 5-10 minutes
✅ **Improved:** Worker marked "degraded" instead of removed during long operations
✅ **Improved:** Configurable timeouts via environment variables

**New Default Behavior:**
- Worker healthy if heartbeat < 5 minutes old
- Worker degraded if heartbeat 5-10 minutes old (stays registered)
- Worker removed if heartbeat > 10 minutes old (truly gone)

This gives plenty of time for model loading while still detecting truly dead workers.
