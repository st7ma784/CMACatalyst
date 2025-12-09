# Fix 422 Registration Error

## The Error
```
422 Client Error: Unprocessable Entity for url: http://localhost:8080/api/worker/register
```

## Root Cause

The coordinator's Pydantic model expects these **required** fields:

```python
class WorkerRegistration(BaseModel):
    worker_id: str          # ❌ MISSING - This was the problem!
    tunnel_url: str         # ✅ Present
    capabilities: Dict[str, Any]  # ✅ Present
```

But the worker was only sending:

```python
registration_data = {
    "tunnel_url": tunnel_url,
    "capabilities": self.capabilities
    # ❌ Missing worker_id!
}
```

## The Fix

**Updated:** `worker-containers/universal-worker/worker_agent.py` line 418-422

**Before:**
```python
registration_data = {
    "tunnel_url": tunnel_url,
    "capabilities": self.capabilities
}
```

**After:**
```python
registration_data = {
    "worker_id": self.worker_id,  # ✅ Now included
    "tunnel_url": tunnel_url,
    "capabilities": self.capabilities
}
```

## Why This Happened

In the earlier fix for the heartbeat 404 issue, we tried to let the coordinator generate the worker_id. But the coordinator's API contract requires the worker_id to be present in the registration request.

The coordinator uses the worker_id as-is from the request - it doesn't generate a new one.

## How to Apply

### Quick Fix (Automated)

```bash
cd RMA-Demo
./rebuild-and-restart.sh
```

This script will:
1. Stop current stack
2. Rebuild worker with fix
3. Start new stack with proper configuration
4. Show status and logs

### Manual Fix

```bash
cd RMA-Demo

# Stop current stack
docker-compose -f edge-coordinator-fixed.yml down

# Rebuild worker
cd worker-containers/universal-worker
docker build -f Dockerfile.optimized -t universal-worker:local .
cd ../..

# Start with local image
docker-compose -f edge-coordinator-fixed.yml up -d --build
```

## Verification

After applying the fix, check logs:

```bash
# Worker should show successful registration
docker logs edge-local-worker 2>&1 | grep -E "Register|worker_id"

# Should see:
# 📝 Registering with coordinator...
# ✅ Registration successful!
# Assigned Worker ID: edge-local-worker
```

```bash
# Coordinator should show worker registered
docker logs edge-coordinator 2>&1 | grep "Registered"

# Should see:
# ✅ Registered auto worker: edge-local-worker (Tier 1/2/3/4)
```

```bash
# Check worker is in registry
curl http://localhost:8080/api/admin/workers | jq

# Should return array with your worker:
# [
#   {
#     "worker_id": "edge-local-worker",
#     "status": "healthy",
#     "assigned_services": [...]
#   }
# ]
```

## All Fixed Issues Summary

This completes the fix chain:

1. ✅ **Worker ID mismatch** (line 434-437 in worker_agent.py)
   - Worker now updates its ID to match coordinator's assignment

2. ✅ **Missing worker_id in registration** (line 419 in worker_agent.py)
   - Worker now sends its ID in the registration request

3. ✅ **Docker bridge networking** (edge-coordinator-fixed.yml)
   - Using host networking to avoid Docker IPs

4. ✅ **Short timeouts during model loading** (app.py lines 38-39)
   - Increased from 90s to 300s (5 min) healthy timeout
   - Increased from 120s to 600s (10 min) stale timeout

## Next Steps

After fixing:

1. Run diagnostic script:
   ```bash
   ./diagnose-routing.sh
   ```

2. Monitor worker status:
   ```bash
   watch -n 5 'curl -s http://localhost:8080/api/admin/workers | jq'
   ```

3. Test service endpoints:
   ```bash
   curl -X POST http://localhost:8080/service/notes/convert \
     -H "Content-Type: application/json" \
     -d '{"notes":"test","client_name":"test"}' | jq
   ```

All checks should now pass! 🎉
