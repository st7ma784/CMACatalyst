# Worker Service Assignment Fix

## Problem

GPU workers were only being assigned GPU services (3 services):
- llm-inference
- vision-ocr
- rag-embeddings

They were missing critical CPU services needed by the frontend:
- notes-coa (required for `/service/notes/convert`)
- ner-extraction
- document-processing

## Root Cause

The service assignment logic in `/services/local-coordinator/app.py` had two issues:

1. **Missing CPU services for GPU workers**: Initially, GPU workers could only run GPU services. But GPU machines also have CPUs and can run CPU services.

2. **Tier-based specialization limiting assignments**: Even after adding CPU services to eligible_services, the specialization logic (lines 766-776) was limiting assignments based on worker count in the tier. With 1 GPU worker and 6 eligible services, it would only assign the top 3 by priority, which happened to be the GPU services.

## Solution

Modified `/services/local-coordinator/app.py` with two changes:

### Change 1: Allow GPU workers to run CPU services (lines 723-730)
```python
# GPU workers can ALSO run CPU services (they have CPUs too!)
if worker_type == "gpu":
    cpu_services = [
        svc_name for svc_name, svc_info in SERVICE_CATALOG.items()
        if svc_info["requires"] == "cpu"
    ]
    eligible_services.extend(cpu_services)
    logger.info(f"   GPU worker can also run CPU services: {cpu_services}")
```

### Change 2: GPU workers fill all service gaps (lines 764-774)
```python
# Special case: GPU workers should fill all service gaps (GPU + CPU services)
# They have the capacity and we want to ensure critical CPU services get assigned
if worker_type == "gpu":
    # Assign all services with zero coverage (fill all gaps)
    uncovered_services = [svc for svc in sorted_services if service_coverage.get(svc, 0) == 0]
    if uncovered_services:
        assigned = uncovered_services
        logger.info(f"   GPU worker filling {len(uncovered_services)} service gaps")
    else:
        # All services covered, just assign the top priority service
        assigned = sorted_services[:1]
```

This ensures GPU workers:
1. Can run both GPU and CPU services
2. Fill all service gaps when they're the only worker
3. Ensure critical services like notes-coa are always available

## Result

After the fix, GPU workers are now assigned all 6 services:

**GPU Services (Tier 1):**
- llm-inference (port 8101, priority 1)
- vision-ocr (port 8102, priority 2)
- rag-embeddings (port 8105, priority 2)

**CPU Services (Tier 2):**
- ner-extraction (port 8108, priority 2)
- document-processing (port 8103, priority 2)
- notes-coa (port 8100, priority 3)

## Testing

Verify the fix:
```bash
# Check worker has all services
curl -s http://localhost:8080/api/admin/workers | jq '.workers[0].assigned_services'

# Expected output:
[
  "llm-inference",
  "vision-ocr",
  "rag-embeddings",
  "ner-extraction",
  "document-processing",
  "notes-coa"
]

# Check service registry
curl -s http://localhost:8080/api/admin/services | jq '.services[].name'

# Expected output:
"llm-inference"
"vision-ocr"
"rag-embeddings"
"ner-extraction"
"document-processing"
"notes-coa"
```

## Frontend Impact

The frontend can now successfully call:
- `POST /service/notes/convert` (uses notes-coa service)
- `POST /service/ner/extract` (uses ner-extraction service)
- `POST /service/document/process` (uses document-processing service)

All routes should now work end-to-end through the full stack:
```
Frontend → Edge Router → Cloudflare Tunnel → Coordinator → Worker → Service
```

## Files Modified

- `/home/user/CMACatalyst/RMA-Demo/services/local-coordinator/app.py`
  - Lines 723-730: Added CPU services to GPU worker eligible list
  - Lines 764-774: Modified assignment strategy for GPU workers
  - Line 792: Fixed logging to use `len(assigned)` instead of undefined `max_services`

## Deployment

To apply this fix:
```bash
cd /home/user/CMACatalyst/RMA-Demo

# Rebuild coordinator
docker compose -f edge-coordinator-local-build.yml build coordinator

# Restart coordinator
docker compose -f edge-coordinator-local-build.yml restart coordinator

# Force worker re-registration
docker stop edge-local-worker && docker rm edge-local-worker
docker compose -f edge-coordinator-local-build.yml up -d local-worker

# Wait and verify
sleep 30
curl -s http://localhost:8080/api/admin/workers | jq '.workers[0].assigned_services'
```

## Status

✅ **FIXED** - GPU workers now receive both GPU and CPU service assignments (6 total services)
