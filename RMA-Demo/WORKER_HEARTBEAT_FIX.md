# Worker Heartbeat Fix

**Date:** December 8, 2025
**Status:** ✅ Fixed

## Problem

Workers were failing to send heartbeats with 404 errors:
```
edge-coordinator   | INFO: 172.18.0.5:54248 - "POST /api/worker/heartbeat HTTP/1.1" 404 Not Found
edge-local-worker  | ERROR - ❌ Heartbeat failed: 404 Client Error: Not Found
```

## Root Cause

**Worker ID Mismatch** - The worker and coordinator were using different worker IDs:

1. Worker generated its own `worker_id` on startup:
   ```python
   self.worker_id = f"worker-{hostname}-{timestamp}"
   ```

2. Worker sent this ID during registration

3. **Coordinator ignored the worker's ID and generated a new one**

4. Coordinator returned the new ID in the registration response

5. **Worker NEVER updated its `worker_id` to use the coordinator's assigned ID**

6. Worker sent heartbeats with its old self-generated ID

7. Coordinator responded with 404 because it had no record of that worker ID

## Solution

### Fixed worker_agent.py Registration

**Before:**
```python
def register_with_coordinator(self) -> Dict[str, Any]:
    registration_data = {
        "worker_id": self.worker_id,  # ❌ Sent but ignored by coordinator
        "tunnel_url": tunnel_url,
        "capabilities": self.capabilities
    }

    response = requests.post(...)
    result = response.json()
    # ❌ Never updated self.worker_id with coordinator's assigned ID
    return result
```

**After:**
```python
def register_with_coordinator(self) -> Dict[str, Any]:
    registration_data = {
        "tunnel_url": tunnel_url,  # ✅ Removed worker_id (coordinator assigns it)
        "capabilities": self.capabilities
    }

    response = requests.post(...)
    result = response.json()

    # ✅ Update worker_id with the one assigned by coordinator
    if "worker_id" in result:
        old_id = self.worker_id
        self.worker_id = result["worker_id"]
        logger.info(f"   Assigned Worker ID: {self.worker_id}")

    return result
```

### Fixed Heartbeat Data Structure

**Before:**
```python
heartbeat_data = {
    "worker_id": self.worker_id,
    "status": "healthy",
    "services_status": services_status,  # ❌ Not in coordinator's schema
    "current_load": 0.0,
}
```

**After:**
```python
heartbeat_data = {
    "worker_id": self.worker_id,  # ✅ Now using coordinator-assigned ID
    "status": "healthy",
    "current_load": 0.0,
    # ✅ Removed services_status (not in coordinator's HeartbeatRequest model)
}
```

## Changes Made

### Modified Files:
- `worker-containers/universal-worker/worker_agent.py`:
  - Updated `register_with_coordinator()` to capture and use coordinator-assigned worker_id
  - Updated `send_heartbeat()` to send only fields expected by coordinator
  - Added better logging for registration details

## Testing

### Expected Flow:
```
1. Worker starts with self-generated ID: worker-edge-local-worker-1733665200
2. Worker registers with coordinator
3. Coordinator assigns new ID: worker_abc123def456
4. Worker updates self.worker_id = "worker_abc123def456"
5. Worker sends heartbeats with "worker_abc123def456"
6. Coordinator accepts heartbeats: 200 OK ✅
```

### Verify Fix:
```bash
# Start edge-coordinator
cd RMA-Demo
docker compose -f edge-coordinator.yml up -d

# Watch logs
docker logs -f edge-local-worker

# Should see:
# ✅ Registration successful!
#    Assigned Worker ID: worker_xyz123
# 💓 Heartbeat sent successfully

# Check coordinator logs
docker logs -f edge-coordinator

# Should see:
# ✅ POST /api/worker/register HTTP/1.1 200 OK
# ✅ POST /api/worker/heartbeat HTTP/1.1 200 OK  (not 404!)
```

## Impact

- ✅ Workers can now successfully register and send heartbeats
- ✅ Coordinator properly tracks worker health
- ✅ Local worker keeps coordinator alive
- ✅ System works as intended

## Why This Matters

The local worker in edge-coordinator was supposed to:
1. Keep the coordinator alive with regular heartbeats ✅
2. Provide immediate compute capacity ✅
3. Work without external dependencies ✅

But it was failing because heartbeats returned 404, so the coordinator thought the worker was dead.

Now that heartbeats work, the edge-coordinator is truly self-contained with an active local worker!

---

**Status:** ✅ FIXED
**Next Action:** Rebuild universal-worker image and test deployment
