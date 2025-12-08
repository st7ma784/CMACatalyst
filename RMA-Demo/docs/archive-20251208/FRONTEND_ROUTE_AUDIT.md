# Frontend Route Audit Report
**Date**: December 6, 2025  
**Time**: 18:09 UTC

## Executive Summary

✅ **Infrastructure**: Healthy  
✅ **Coordinator Registry**: Working with heartbeat  
⚠️ **Service Routing**: Ready but no workers deployed  
✅ **DHT**: Operational  

---

## 1. Infrastructure Health

| Component | Status | Endpoint | Notes |
|-----------|--------|----------|-------|
| Edge Router | ✅ Healthy | `https://api.rmatool.org.uk` | Cloudflare Worker deployed |
| Coordinator | ✅ Healthy | `https://edge-1.rmatool.org.uk` | Registered and heartbeating |
| DHT Network | ✅ Operational | Port 8468/UDP | Coordinator acting as stable node |

---

## 2. Request Flow Architecture

```
Frontend (rmatool.org.uk)
    ↓
Edge Router (api.rmatool.org.uk)
    ↓ [Service Discovery via DO Registry]
Coordinator (edge-1.rmatool.org.uk)
    ↓ [Worker Selection + Load Balancing]
Worker (tunnel URLs)
    ↓
Service Response
```

### Key Improvements Made Today:

1. **Added `/api/edge/heartbeat` endpoint** to edge router
2. **Coordinator heartbeat loop** now keeps registration alive (60s interval)
3. **Managed tunnel creation** via Cloudflare API (non-interactive)
4. **Comprehensive frontend documentation** for distributed worker deployment

---

## 3. Frontend Service URLs

From `frontend/.env.production`:

| Service | Frontend URL | Maps To | Status |
|---------|--------------|---------|--------|
| **RAG** | `https://api.rmatool.org.uk/service/rag` | `rag-embeddings` | ⚠️ No workers |
| **Upload** | `https://api.rmatool.org.uk/service/upload` | `document-processing` | ⚠️ No workers |
| **Notes** | `https://api.rmatool.org.uk/service/notes` | `notes-coa` | ⚠️ No workers |
| **NER** | `https://api.rmatool.org.uk/service/ner` | `ner-extraction` | ⚠️ No workers |

---

## 4. Service Routing Logic

### Edge Router (`/service/{service}/{path}`)

1. **Receives request**: `GET https://api.rmatool.org.uk/service/rag/stats`
2. **Checks coordinator registry**: Finds `edge-1.rmatool.org.uk`
3. **Forwards to coordinator**: `GET https://edge-1.rmatool.org.uk/service/rag/stats`
4. **Returns response** with CORS headers

### Coordinator (`/service/{service}/{path}`)

1. **Maps service name**: `rag` → `rag-embeddings`
2. **Finds workers**: Looks up in `services["rag-embeddings"]` registry
3. **Selects worker**: Currently first available (TODO: round-robin)
4. **Proxies request**: `GET https://{worker_tunnel_url}/{path}`
5. **Returns response** with CORS headers

**Current Status**: ✅ Routing logic works, ⚠️ No workers registered

---

## 5. Worker Registration Flow

When a worker starts:

1. **Creates tunnel**: Either managed (with API token) or quick tunnel
2. **Registers with edge**: `POST https://api.rmatool.org.uk/api/worker/register`
3. **Edge routes to coordinator**: Forwards to `edge-1.rmatool.org.uk`
4. **Coordinator assigns services**: Based on capabilities (GPU → AI services)
5. **Worker starts services**: Launches assigned service containers
6. **Sends heartbeats**: Every 60 seconds to stay registered

**Example Worker Deployment**:

```bash
docker run -d \
  --name rma-worker \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e CLOUDFLARE_API_TOKEN="your_api_token" \
  -e CLOUDFLARE_ACCOUNT_ID="your_account_id" \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

---

## 6. DHT (Distributed Hash Table)

### Current Status

```
DHT Nodes: 1 (coordinator)
DHT Port: 8468/UDP
Bootstrap: api.rmatool.org.uk/api/dht/bootstrap
```

### DHT Responsibilities

1. **Service Discovery**: Workers publish services to DHT
2. **Load Balancing**: Multiple workers for same service = automatic distribution
3. **Redundancy**: Service replication across workers
4. **Coordinator Discovery**: Bootstrap new nodes

### DHT Data Model

```python
# Worker Registry
"worker:{worker_id}" → {
    "worker_id": str,
    "tunnel_url": str,
    "assigned_services": [str],
    "capabilities": {...}
}

# Service Registry
"service:{service_name}" → [worker_id, worker_id, ...]

# Coordinator Registry
"coordinator:{coord_id}" → {
    "tunnel_url": str,
    "location": str,
    "dht_port": int
}
```

---

## 7. Load Balancing Strategy

### Current Implementation (Coordinator)

```python
# Simple: First available worker
worker_id = services[internal_service_name][0]
```

### Recommended Enhancement

```python
# Round-robin across healthy workers
service_workers = services[internal_service_name]
healthy_workers = [w for w in service_workers if is_worker_healthy(workers[w])]

# Track last used index per service
last_index = load_balancer_state.get(service_name, 0)
next_index = (last_index + 1) % len(healthy_workers)
worker_id = healthy_workers[next_index]
load_balancer_state[service_name] = next_index
```

### Future: DHT-based Load Balancing

- Workers publish load metrics to DHT
- Coordinator queries DHT for least-loaded worker
- Automatic failover when worker becomes unavailable

---

## 8. Redundancy & High Availability

### Current Architecture

```
Single Point of Failure:
- ❌ One coordinator (edge-1)
- ❌ No service redundancy (0 workers)

Resilience Features:
- ✅ Coordinator heartbeat (auto-re-register)
- ✅ Worker heartbeat (health monitoring)
- ✅ Durable Object persistence (coordinator registry)
- ✅ Graceful degradation (503 when no workers)
```

### Recommended Deployment

```
Multiple Coordinators:
- edge-1.rmatool.org.uk (London)
- edge-2.rmatool.org.uk (New York)
- edge-3.rmatool.org.uk (Singapore)

Service Redundancy:
- 3+ workers for critical services (RAG, Notes)
- Geographic distribution
- Auto-scaling based on load
```

---

## 9. Frontend API Call Audit

### Components Making API Calls

| Component | Service | Endpoints Used | Status |
|-----------|---------|----------------|--------|
| `NotesToCoA` | notes | `/convert` | ⚠️ No worker |
| `AskTheManuals` | rag | `/query`, `/sample_dro_manual` | ⚠️ No worker |
| `ManualsViewer` | rag | `/stats`, `/debug/sources`, `/debug/documents` | ⚠️ No worker |
| `DebtAdviceGraph` | rag | `/api/graph/*`, `/api/graph/build` | ⚠️ No worker |
| `ClientDocumentSearch` | upload | `/clients`, `/client-stats/*`, `/query-client-documents` | ⚠️ No worker |
| `QRCodeGenerator` | upload | `/generate-qr` | ⚠️ No worker |
| `ShouldIWorryDialog` | rag | `/should-i-worry` | ⚠️ No worker |
| `EligibilityChecker` | rag | `/eligibility-check` | ⚠️ No worker |
| `GraphExtractionComponent` | ner | `/extract` | ⚠️ No worker |
| `SystemOrchestrator` | coordinator | `/api/admin/workers`, `/api/dht/*` | ✅ Working |

### All Frontend Routes

✅ **Working**:
- Coordinator health checks
- Worker registry queries
- DHT status/topology
- Admin endpoints

⚠️ **Needs Workers**:
- All service-specific routes (rag, upload, notes, ner)
- Graph operations
- Document processing
- QR generation
- AI analysis

---

## 10. Testing Results

### Infrastructure Tests

```bash
✓ Edge Router Health (200)
✓ Coordinator Health (200)
✓ List Coordinators (200)
✓ List Workers (200)
✓ Service Registry (200)
✓ DHT Stats (200)
✓ DHT Topology (200)
```

### Service Routing Tests

```bash
✗ RAG: Stats (502) - No workers available
✗ Upload: Health (502) - No workers available
✗ Notes: Health (502) - No workers available
✗ NER: Health (502) - No workers available
```

**Expected Behavior**: 502 is correct when no workers are registered.  
**When workers are registered**: Will return 200 with service responses.

---

## 11. Service Assignment Logic

### Coordinator Service Assignment

When a worker registers, the coordinator assigns services based on:

1. **Worker Capabilities**:
   ```python
   capabilities = {
       "cpu_cores": int,
       "ram": str,
       "has_gpu": bool,
       "gpu_memory": str,
       "worker_type": "cpu" | "gpu" | "edge"
   }
   ```

2. **Service Requirements**:
   ```python
   SERVICE_TIERS = {
       "llm-inference": "gpu",      # Requires GPU
       "vision-ocr": "gpu",          # Requires GPU
       "rag-embeddings": "cpu",      # CPU-only
       "document-processing": "cpu",  # CPU-only
       "notes-coa": "cpu",           # CPU-only
       "ner-extraction": "cpu"       # CPU-only
   }
   ```

3. **Load Balancing**:
   - Multiple CPU workers → distribute CPU services
   - Multiple GPU workers → distribute GPU services
   - Fill gaps first (missing services get priority)

### Current Service Gaps

```bash
$ curl https://edge-1.rmatool.org.uk/api/admin/gaps

{
  "gaps": [
    "llm-inference",
    "vision-ocr",
    "rag-embeddings",
    "document-processing",
    "notes-coa",
    "ner-extraction"
  ],
  "message": "All services need workers"
}
```

---

## 12. Next Steps

### Immediate (Deploy Workers)

1. **Deploy CPU Worker**:
   ```bash
   docker run -d \
     --name worker-cpu-1 \
     -e COORDINATOR_URL=https://api.rmatool.org.uk \
     -e CLOUDFLARE_API_TOKEN="${CF_TOKEN}" \
     -e CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT}" \
     ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
   ```

2. **Deploy GPU Worker** (if available):
   ```bash
   docker run -d \
     --name worker-gpu-1 \
     --runtime nvidia \
     --gpus all \
     -e COORDINATOR_URL=https://api.rmatool.org.uk \
     -e CLOUDFLARE_API_TOKEN="${CF_TOKEN}" \
     -e CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT}" \
     -e WORKER_TYPE=gpu \
     ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
   ```

3. **Verify Registration**:
   ```bash
   curl https://edge-1.rmatool.org.uk/api/coordinator/workers | jq '.workers[] | {worker_id, assigned_services}'
   ```

### Short-term (Improve Load Balancing)

1. **Implement round-robin**: Modify coordinator to rotate through workers
2. **Add health checks**: Ping workers before routing requests
3. **Implement retries**: Retry failed requests on different workers
4. **Add metrics**: Track request counts per worker

### Medium-term (Enhance Redundancy)

1. **Deploy multiple coordinators**: Add edge-2, edge-3 in different regions
2. **Service replication**: Ensure 2+ workers per critical service
3. **Geographic routing**: Route to nearest coordinator/worker
4. **Auto-scaling**: Scale workers based on load

### Long-term (Production Hardening)

1. **Implement DHT-based discovery**: Workers publish to DHT, coordinator queries
2. **Add circuit breakers**: Prevent cascading failures
3. **Implement rate limiting**: Protect services from overload
4. **Add observability**: Prometheus metrics, distributed tracing
5. **Implement service mesh**: Consider using Consul/Envoy for advanced routing

---

## 13. Troubleshooting Guide

### No Workers Registered

**Symptoms**: `curl https://edge-1.rmatool.org.uk/api/coordinator/workers` returns empty array

**Causes**:
1. No workers deployed
2. Worker registration failing (check worker logs)
3. Coordinator not reachable (check tunnel)

**Fix**: Deploy a worker (see step 12.1)

### Service Returns 503

**Symptoms**: `curl https://api.rmatool.org.uk/service/rag/stats` returns 503

**Causes**:
1. No coordinators registered (check `/api/admin/coordinators`)
2. Coordinator expired (heartbeat not working)

**Fix**: Restart edge-registrar: `docker restart edge-registrar`

### Service Returns 502

**Symptoms**: `curl https://api.rmatool.org.uk/service/rag/stats` returns 502

**Causes**:
1. No workers with requested service
2. Worker tunnel unreachable
3. Worker service not started

**Fix**: Deploy worker with required service, check worker logs

### Coordinator Disappeared

**Symptoms**: Coordinator was registered, now missing from `/api/admin/coordinators`

**Cause**: Heartbeat not working (5-minute TTL)

**Fix**: 
1. Check edge-registrar logs: `docker logs edge-registrar`
2. Restart: `docker restart edge-registrar`
3. Verify: `curl https://api.rmatool.org.uk/api/admin/coordinators`

---

## 14. Monitoring Recommendations

### Key Metrics to Track

```
Infrastructure:
- Coordinator count (should be ≥1)
- Coordinator heartbeat age (should be <60s)
- Worker count (should be ≥1 per service)
- Worker heartbeat age (should be <120s)

Performance:
- Request latency (p50, p95, p99)
- Request success rate
- Worker CPU/memory usage
- Service queue length

Reliability:
- Service uptime (per service)
- Worker failure rate
- Coordinator failover events
- DHT network size
```

### Alerting Rules

```yaml
- name: RMA Infrastructure
  rules:
    - alert: NoCoordinatorsRegistered
      expr: coordinator_count == 0
      for: 1m
      severity: critical
      
    - alert: NoWorkersForService
      expr: service_worker_count{service="rag-embeddings"} == 0
      for: 5m
      severity: warning
      
    - alert: HighServiceLatency
      expr: service_latency_p95 > 5000  # 5 seconds
      for: 5m
      severity: warning
```

---

## 15. Summary

### What's Working ✅

1. Edge router deployed and healthy
2. Coordinator registered with heartbeat
3. DHT network operational
4. Service routing infrastructure in place
5. Frontend URLs correctly configured
6. Worker registration flow implemented
7. Managed tunnel creation working

### What Needs Workers ⚠️

1. All service-specific routes (rag, upload, notes, ner)
2. Graph operations
3. Document processing
4. AI analysis features

### Recommended Actions

**Priority 1**: Deploy at least one CPU worker to enable core services  
**Priority 2**: Implement round-robin load balancing in coordinator  
**Priority 3**: Deploy GPU worker for AI-intensive services  
**Priority 4**: Add second coordinator for redundancy

---

## Appendix: Test Scripts

All tests can be run with:

```bash
./test-frontend-routes.sh
```

This will audit:
- Infrastructure health
- Coordinator registry
- DHT status
- Service routing
- Load balancing
- Worker assignments
