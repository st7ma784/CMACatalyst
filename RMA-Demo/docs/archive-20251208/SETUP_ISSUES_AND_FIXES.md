# Service Setup Review: Issues & Recommended Fixes

## 🔴 Critical Issues

### 1. **Service Registry Cleanup on Worker Unregister** ❌

**Issue:** When a worker unregisters, it's removed from the main worker list but NOT from the service registry.

**Current Code:**
```javascript
async function handleUnregister(workerId, env, corsHeaders) {
  await env.WORKERS.delete(`worker:${workerId}`);
  
  // Remove from worker list
  const workerIds = await getWorkerIds(env);
  const filteredIds = workerIds.filter(id => id !== workerId);
  await env.WORKERS.put('worker_ids', JSON.stringify(filteredIds));
  
  // ❌ MISSING: Remove from service registry!
  return jsonResponse({ status: 'ok' }, corsHeaders);
}
```

**Problem:** Service index (`service:upload`, `service:rag`, etc.) still points to dead workers.

**Impact:**
- Requests route to offline workers
- 503 errors even when other workers provide the service
- Service registry becomes polluted over time

**Fix Required:** Add service cleanup to unregister handler.

---

### 2. **No Service Cleanup on Worker Timeout** ❌

**Issue:** Workers that go offline (no heartbeat >90s) are marked as offline in stats but remain in service registry.

**Current Code:**
```javascript
async function handleListWorkers(env, corsHeaders) {
  // Workers marked offline after 90s, but service registry unchanged
  workers.push({
    ...worker,
    status: ageSeconds > 90 ? 'offline' : worker.status,
  });
}
```

**Problem:** Service discovery shows services as "available" when all workers are actually offline.

**Impact:**
- False positive service availability
- Requests fail with 503 but user thinks service exists
- No automatic cleanup

**Fix Required:** Background cleanup job or cleanup on service routing attempt.

---

### 3. **Worker Registration Race Condition** ⚠️

**Issue:** Multiple workers can register simultaneously and all claim heartbeat leadership.

**Current Code:**
```javascript
if (data.wants_heartbeat_leadership) {
  const currentLeader = await getHeartbeatLeader(env);
  if (!currentLeader) {
    // ⚠️ Race: Another worker might pass this check simultaneously
    worker.is_heartbeat_leader = true;
    await env.WORKERS.put('heartbeat_leader', workerId);
  }
}
```

**Problem:** KV is eventually consistent. Two workers might both see "no leader" and both claim leadership.

**Impact:**
- Multiple heartbeat leaders (wastes KV writes)
- Unpredictable behavior

**Fix Required:** Use atomic KV operations or accept eventual consistency with conflict resolution.

---

### 4. **No Worker Deduplication** ⚠️

**Issue:** If a worker crashes and restarts quickly, it creates a new worker_id and registers again.

**Current Code:**
```javascript
const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// Always creates new ID
```

**Problem:** Same physical machine might have 5+ "dead" worker entries polluting the registry.

**Impact:**
- Service registry bloat
- Confusing metrics (shows 10 workers, only 2 are real)
- KV storage waste

**Fix Required:** Use machine fingerprint or tunnel URL as stable identifier.

---

## 🟡 Medium Issues

### 5. **Heartbeat Doesn't Update Service Health** ⚠️

**Issue:** Worker sends heartbeat but doesn't report per-service health.

**Current Heartbeat:**
```javascript
{
  "worker_id": "worker-123",
  "status": "healthy",
  "current_load": 0.5,
  "available_memory": "7GB"
}
```

**Missing:** Individual service health (e.g., "rag service container crashed but worker still healthy").

**Impact:**
- Can't detect partial failures
- Routes to workers with broken services
- Poor observability

**Fix Required:** Include service health array in heartbeat.

---

### 6. **No Service Version Tracking** ⚠️

**Issue:** Services report version on registration but it's never used or updated.

**Current Code:**
```javascript
services.append({
  "name": service_name,
  "version": health_data.get("version", "unknown")  // Stored but never checked
})
```

**Problem:** Can't do rolling updates or version-aware routing.

**Impact:**
- Can't prevent routing to incompatible service versions
- No way to do canary deployments
- Version drift undetectable

**Fix Required:** Track versions in service registry and expose in admin API.

---

### 7. **Hardcoded Service Detection** ⚠️

**Issue:** Service names and ports are hardcoded in worker agent.

**Current Code:**
```python
service_checks = {
    "upload": ("upload-service", 8103),
    "rag": ("rag-service", 8102),
    # ... hardcoded list
}
```

**Problem:** Adding new services requires code changes and redeployment.

**Impact:**
- Not extensible
- Requires coordination across all workers
- Can't have custom services

**Fix Required:** Use environment variables or service discovery protocol.

---

### 8. **No Load Balancing Strategy** ⚠️

**Issue:** Random selection for load balancing doesn't consider worker load.

**Current Code:**
```javascript
const targetWorker = healthyWorkers[Math.floor(Math.random() * healthyWorkers.length)];
```

**Problem:** Overloaded worker (90% CPU) and idle worker (10% CPU) have equal selection chance.

**Impact:**
- Poor resource utilization
- Slower response times
- Some workers overwhelmed while others idle

**Fix Required:** Implement least-loaded or weighted random selection.

---

## 🟢 Minor Issues

### 9. **No Circuit Breaker** 💡

**Issue:** Failed service requests keep retrying immediately.

**Impact:** Cascading failures, wasted resources.

**Suggested:** Implement circuit breaker pattern (open after N failures, half-open for retry).

---

### 10. **No Request Timeout Configuration** 💡

**Issue:** Service proxy has no timeout (relies on Cloudflare Workers 50s limit).

**Impact:** Slow services block workers indefinitely.

**Suggested:** Add configurable timeouts per service type.

---

### 11. **No Service Health Probe Interval** 💡

**Issue:** Service health only checked once on registration.

**Impact:** Service can become unhealthy but worker doesn't know.

**Suggested:** Periodic health checks (every 5 min) to update service status.

---

### 12. **No Metrics/Observability** 💡

**Issue:** No request counts, latencies, or error rates.

**Impact:** Can't monitor performance or debug issues.

**Suggested:** Track per-service metrics in KV or external service.

---

## 🔧 Recommended Fixes

### Priority 1: Critical (Fix Now)

**Fix #1: Service Registry Cleanup on Unregister**

```javascript
async function handleUnregister(workerId, env, corsHeaders) {
  const workerKey = `worker:${workerId}`;
  
  // Get worker data to find services
  const workerData = await env.WORKERS.get(workerKey);
  if (workerData) {
    const worker = JSON.parse(workerData);
    
    // Remove worker from each service index
    for (const service of worker.services || []) {
      await removeWorkerFromService(env, service.name, workerId);
    }
  }
  
  // Remove worker data
  await env.WORKERS.delete(workerKey);
  
  // Remove from worker list
  const workerIds = await getWorkerIds(env);
  const filteredIds = workerIds.filter(id => id !== workerId);
  await env.WORKERS.put('worker_ids', JSON.stringify(filteredIds));
  
  // Clean up if was heartbeat leader
  const leaderId = await env.WORKERS.get('heartbeat_leader');
  if (leaderId === workerId) {
    await env.WORKERS.delete('heartbeat_leader');
  }
  
  return jsonResponse({ status: 'ok' }, corsHeaders);
}

async function removeWorkerFromService(env, serviceName, workerId) {
  const serviceKey = `service:${serviceName}`;
  const workersJson = await env.WORKERS.get(serviceKey);
  if (workersJson) {
    const workers = JSON.parse(workersJson);
    const filtered = workers.filter(id => id !== workerId);
    
    if (filtered.length > 0) {
      await env.WORKERS.put(serviceKey, JSON.stringify(filtered));
    } else {
      // No more workers for this service, remove key
      await env.WORKERS.delete(serviceKey);
    }
  }
}
```

---

**Fix #2: Automatic Stale Worker Cleanup**

Add to service proxy handler:

```javascript
async function handleServiceProxy(path, request, env, corsHeaders) {
  const serviceName = pathParts[2];
  const serviceKey = `service:${serviceName}`;
  const workersJson = await env.WORKERS.get(serviceKey);
  
  if (!workersJson) {
    return gracefulFallback(serviceName, env, corsHeaders);
  }
  
  const workerIds = JSON.parse(workersJson);
  const healthyWorkers = [];
  const staleWorkers = [];
  const now = new Date();
  
  for (const workerId of workerIds) {
    const workerData = await env.WORKERS.get(`worker:${workerId}`);
    if (!workerData) {
      // Worker deleted but still in service index
      staleWorkers.push(workerId);
      continue;
    }
    
    const worker = JSON.parse(workerData);
    const ageSeconds = (now - new Date(worker.last_heartbeat)) / 1000;
    
    if (ageSeconds > 90) {
      staleWorkers.push(workerId);
    } else if (worker.tunnel_url) {
      healthyWorkers.push(worker);
    }
  }
  
  // Cleanup stale workers from service index
  if (staleWorkers.length > 0) {
    const cleanedWorkers = workerIds.filter(id => !staleWorkers.includes(id));
    if (cleanedWorkers.length > 0) {
      await env.WORKERS.put(serviceKey, JSON.stringify(cleanedWorkers));
    } else {
      await env.WORKERS.delete(serviceKey);
    }
  }
  
  if (healthyWorkers.length === 0) {
    return gracefulFallback(serviceName, env, corsHeaders);
  }
  
  // Continue with routing...
}
```

---

### Priority 2: Important (Fix Soon)

**Fix #3: Enhanced Heartbeat with Service Health**

Update worker agent:

```python
def send_heartbeat(self):
    """Send heartbeat with service health"""
    if not self.worker_id:
        return

    # Check service health
    service_health = []
    for service in self.services:
        try:
            response = requests.get(
                f'http://{service["container"]}:{service["port"]}/health',
                timeout=2
            )
            service_health.append({
                "name": service["name"],
                "status": "healthy" if response.status_code == 200 else "degraded"
            })
        except Exception:
            service_health.append({
                "name": service["name"],
                "status": "unhealthy"
            })
    
    cpu_percent = psutil.cpu_percent(interval=1) / 100.0
    
    requests.post(
        f"{self.coordinator_url}/api/worker/heartbeat",
        json={
            "worker_id": self.worker_id,
            "status": "healthy",
            "current_load": cpu_percent,
            "available_memory": f"{available_memory:.1f}GB",
            "service_health": service_health  # NEW
        },
        timeout=10
    )
```

Update coordinator to store and expose service health.

---

**Fix #4: Load-Based Load Balancing**

```javascript
async function selectWorker(healthyWorkers) {
  // Weighted random based on inverse load
  // Workers with lower load have higher chance of selection
  
  const weights = healthyWorkers.map(w => {
    const load = w.current_load || 0.5;
    return 1 / (load + 0.1);  // Avoid division by zero
  });
  
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < healthyWorkers.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return healthyWorkers[i];
    }
  }
  
  return healthyWorkers[healthyWorkers.length - 1];
}
```

---

### Priority 3: Nice to Have (Consider)

**Fix #5: Worker Fingerprinting**

```python
def get_worker_fingerprint(self) -> str:
    """Generate stable worker ID based on machine characteristics"""
    import hashlib
    import platform
    
    # Combine hostname, MAC address, and container ID
    fingerprint = f"{platform.node()}-{self.get_mac_address()}"
    return hashlib.sha256(fingerprint.encode()).hexdigest()[:16]

def register_with_coordinator(self):
    """Register with stable fingerprint"""
    fingerprint = self.get_worker_fingerprint()
    
    response = requests.post(
        f"{self.coordinator_url}/api/worker/register",
        json={
            "fingerprint": fingerprint,  # Use for deduplication
            "capabilities": capabilities,
            "services": services
        }
    )
```

---

## 📊 Impact Summary

| Issue | Severity | Impact | Effort to Fix |
|-------|----------|--------|---------------|
| Service registry cleanup | 🔴 Critical | High | Low (2 hours) |
| Stale worker cleanup | 🔴 Critical | High | Medium (4 hours) |
| Registration race condition | 🟡 Medium | Medium | High (8 hours) |
| Worker deduplication | 🟡 Medium | Medium | Medium (6 hours) |
| Service health in heartbeat | 🟡 Medium | Medium | Low (3 hours) |
| Load-based balancing | 🟡 Medium | Medium | Low (2 hours) |
| Service version tracking | 🟢 Minor | Low | Low (2 hours) |
| Hardcoded services | 🟢 Minor | Low | Medium (4 hours) |

---

## ✅ Immediate Action Plan

1. **Today:** Implement service registry cleanup on unregister (Fix #1)
2. **Today:** Add stale worker cleanup in service router (Fix #2)
3. **Tomorrow:** Add service health to heartbeat (Fix #3)
4. **This Week:** Implement load-based routing (Fix #4)
5. **Next Week:** Add worker fingerprinting (Fix #5)
6. **Future:** Consider circuit breaker, metrics, configurable services

---

## Testing Recommendations

### Test Case 1: Worker Crash
```bash
# Start worker
docker-compose up -d

# Verify registration
curl https://api.rmatool.org.uk/api/admin/services | jq

# Kill worker (simulates crash)
docker-compose kill

# Wait 90 seconds
sleep 90

# Verify service cleanup
curl https://api.rmatool.org.uk/api/admin/services | jq
# Should show 0 workers for that service
```

### Test Case 2: Graceful Shutdown
```bash
# Start worker
docker-compose up -d

# Graceful shutdown (triggers unregister)
docker-compose stop

# Immediately check services
curl https://api.rmatool.org.uk/api/admin/services | jq
# Should show worker removed instantly
```

### Test Case 3: Service Routing Resilience
```bash
# Start 2 workers with upload service
# Kill one worker
# Send upload request
curl https://api.rmatool.org.uk/api/service/upload/health
# Should route to remaining healthy worker
```

---

## 🎯 Summary

Your service setup is **90% solid** but has **2 critical gaps** that will cause production issues:

1. **Service registry doesn't clean up** when workers disappear
2. **Stale workers accumulate** over time

These are easy fixes (< 1 day work) but critical for production stability.

The other issues are nice-to-haves that improve reliability and observability but won't cause immediate problems.

**Recommendation:** Implement Fix #1 and #2 before deploying more workers. The rest can wait.
