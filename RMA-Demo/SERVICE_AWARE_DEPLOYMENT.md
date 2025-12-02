# Service-Aware Worker Deployment Guide

## What's New

### ✅ Service Discovery
Workers now advertise what services they're running:
- Upload service
- RAG service  
- Notes service
- NER/Graph service
- OCR service
- vLLM service
- Doc processor
- Client RAG

### ✅ Graceful Fallback
When a service isn't available, the coordinator:
- Returns 503 with helpful error message
- Lists all available services
- Suggests alternatives

### ✅ Distributed Heartbeat (Future)
- One "leader" worker manages heartbeats for entire cluster
- 97% reduction in KV writes (30/day vs 288/worker/day)
- Can run 30+ workers on free tier!

## Quick Start

### 1. Deploy Updated Coordinator

The coordinator now supports service registry. Deploy via Cloudflare dashboard:

```bash
# Go to: https://dash.cloudflare.com → Workers & Pages → rma-coordinator
# Click "Edit Code"
# Paste the updated worker.js
# Click "Save and Deploy"
```

Or with Node 20+:
```bash
cd cloudflare-worker-coordinator
npx wrangler deploy
```

### 2. Start Service-Aware Workers

Workers will auto-detect what services are running:

```bash
cd worker-containers/cpu-worker

# Start worker with services
docker-compose up -d

# Check logs to see service detection
docker-compose logs -f worker
```

You'll see output like:
```
🔍 Detecting available services...
   ✅ upload (port 8103)
   ✅ rag (port 8102)
   ✅ notes (port 8100)
   ⚪ ner (not available)
   ⚪ vllm (not available)
✅ Found 3 active service(s)

📡 Registering with coordinator: https://api.rmatool.org.uk
✅ Registered successfully!
   Worker ID: worker-1733155200000-abc123
   Tier: 2
   Services: 3
```

### 3. Verify Service Discovery

```bash
# Test the service discovery system
./test-service-discovery.sh
```

Or manually:
```bash
# List all services
curl https://api.rmatool.org.uk/api/admin/services | jq

# Expected output:
{
  "services": {
    "upload": {
      "total_workers": 2,
      "healthy_workers": 2,
      "status": "available"
    },
    "rag": {
      "total_workers": 1,
      "healthy_workers": 1,
      "status": "available"
    },
    "notes": {
      "total_workers": 2,
      "healthy_workers": 2,
      "status": "available"
    }
  },
  "total_services": 3
}
```

### 4. Test Service Routing

```bash
# Route to upload service (any worker providing it)
curl https://api.rmatool.org.uk/api/service/upload/health

# Route to RAG service
curl https://api.rmatool.org.uk/api/service/rag/health

# Test graceful fallback (unavailable service)
curl https://api.rmatool.org.uk/api/service/nonexistent/test
# Returns:
{
  "error": "Service 'nonexistent' not available",
  "available_services": ["upload", "rag", "notes"],
  "suggestion": "Start a worker with this service enabled or choose from available services"
}
```

## Architecture

### Service Detection Flow

```
Worker Startup
     ↓
1. Detect hardware capabilities (CPU, RAM, GPU)
     ↓
2. Probe all known services on docker network
     ↓
3. Build service manifest:
   {
     "name": "upload",
     "container": "upload-service",
     "port": 8103,
     "health": "healthy"
   }
     ↓
4. Register with coordinator:
   POST /api/worker/register
   {
     "capabilities": {...},
     "services": [...],
     "tunnel_url": "https://..."
   }
     ↓
5. Coordinator updates service registry:
   - KV: service:upload → [worker1, worker3]
   - KV: service:rag → [worker2]
     ↓
6. Ready to route requests!
```

### Request Routing Flow

```
Client Request
     ↓
GET /api/service/upload/clients
     ↓
Coordinator checks service registry
     ↓
service:upload → [worker1, worker3]
     ↓
Check health of workers
     ↓
worker1: healthy ✅
worker3: healthy ✅
     ↓
Load balance (random selection)
     ↓
Route to worker3.tunnel_url/clients
     ↓
Return response to client
```

## Service Configuration

### Adding New Services

To add a new service to detection:

1. **Update worker_agent.py:**
```python
service_checks = {
    "upload": ("upload-service", 8103),
    "rag": ("rag-service", 8102),
    "my-new-service": ("my-service-container", 8200),  # Add here
}
```

2. **Ensure service has /health endpoint:**
```python
@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0"}
```

3. **Restart workers:**
```bash
docker-compose restart worker
```

### Deploying Specialized Workers

**GPU Worker with AI Services:**
```yaml
# docker-compose.yml
services:
  worker:
    image: rma-gpu-worker:latest
    environment:
      - USE_TUNNEL=true
      - COORDINATOR_URL=https://api.rmatool.org.uk
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
  
  vllm-service:
    image: vllm/vllm-openai:latest
    # ... vLLM config
  
  ocr-service:
    image: rma-ocr-service:latest
    # ... OCR config
```

**Storage/Upload Worker:**
```yaml
services:
  worker:
    image: rma-cpu-worker:latest
    environment:
      - USE_TUNNEL=true
  
  upload-service:
    image: rma-upload-service:latest
    volumes:
      - /mnt/storage:/data/uploads
  
  rag-service:
    image: rma-rag-service:latest
```

## Monitoring

### Health Checks

```bash
# Overall system health
curl https://api.rmatool.org.uk/health

# Worker statistics
curl https://api.rmatool.org.uk/api/admin/stats

# Service availability
curl https://api.rmatool.org.uk/api/admin/services

# Individual worker details
curl https://api.rmatool.org.uk/api/admin/workers
```

### Cloudflare Dashboard

Monitor in real-time:
- https://dash.cloudflare.com → Workers & Pages → rma-coordinator
- View requests, errors, CPU usage
- Check KV operations (should be <1000/day)

## Troubleshooting

### Service Not Detected

**Symptom:** Worker starts but doesn't list a service

**Check:**
```bash
# Verify service is running
docker-compose ps

# Check service health manually
curl http://localhost:8103/health

# Check worker logs
docker-compose logs worker
```

**Fix:**
- Ensure service container is in same docker network
- Verify service has /health endpoint
- Check firewall/network connectivity

### Service Shows Unavailable

**Symptom:** curl returns "Service not available"

**Check:**
```bash
# List registered services
curl https://api.rmatool.org.uk/api/admin/services | jq

# Check if workers are healthy
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

**Fix:**
- Start workers with this service: `docker-compose up -d`
- Check worker heartbeats (should be <90s old)
- Verify tunnel URLs are accessible

### Routing Fails

**Symptom:** 502 Bad Gateway from coordinator

**Check:**
```bash
# Test worker tunnel directly
curl https://worker-tunnel-url.trycloudflare.com/health

# Check coordinator logs
cd cloudflare-worker-coordinator
npx wrangler tail
```

**Fix:**
- Verify tunnel is active: `docker-compose logs worker | grep tunnel`
- Check service is responding: `docker-compose logs upload-service`
- Restart worker: `docker-compose restart`

## Cost Analysis

### Current Architecture (Optimized Heartbeats)

| Workers | KV Writes/Day | Status | Cost |
|---------|---------------|---------|------|
| 1       | 288           | ✅ Free | $0   |
| 3       | 864           | ✅ Free | $0   |
| 5       | 1,440         | ⚠️ Paid | $0.50|
| 10      | 2,880         | ⚠️ Paid | $1.00|

### With Distributed Heartbeat (Future)

| Workers | KV Writes/Day | Status | Cost |
|---------|---------------|---------|------|
| 1-30    | 30            | ✅ Free | $0   |
| 50      | 30            | ✅ Free | $0   |
| 100     | 30            | ✅ Free | $0   |

**With leader-based heartbeats, you can scale to 30+ workers on the free tier!**

## Next Steps

1. ✅ Deploy updated coordinator
2. ✅ Start service-aware workers
3. ✅ Verify service discovery
4. 🔄 Test service routing
5. 🔄 Implement distributed heartbeats (optional)
6. 🔄 Add monitoring/alerting
7. 🔄 Scale to production

## Example: Multi-Worker Deployment

```bash
# Terminal 1: Storage worker
cd worker-containers/storage-worker
docker-compose up -d

# Terminal 2: AI worker (GPU)
cd worker-containers/ai-worker
docker-compose up -d

# Terminal 3: Processing worker
cd worker-containers/processing-worker
docker-compose up -d

# Check service distribution
curl https://api.rmatool.org.uk/api/admin/services | jq
```

Result:
```json
{
  "services": {
    "upload": {
      "total_workers": 1,
      "healthy_workers": 1,
      "status": "available"
    },
    "rag": {
      "total_workers": 2,
      "healthy_workers": 2,
      "status": "available"
    },
    "vllm": {
      "total_workers": 1,
      "healthy_workers": 1,
      "status": "available"
    },
    "doc-processor": {
      "total_workers": 1,
      "healthy_workers": 1,
      "status": "available"
    }
  },
  "total_services": 4
}
```

**Your distributed AI platform is now intelligent and resilient!** 🚀
