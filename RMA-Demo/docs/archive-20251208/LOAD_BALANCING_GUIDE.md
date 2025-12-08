# Intelligent Load Balancing Guide

## Overview

The coordinator implements intelligent load balancing across multiple workers to:
- **Prevent duplicate model downloads** - Route to workers that already have models loaded
- **Enable worker specialization** - Workers can declare preferences for specific tasks
- **Distribute load efficiently** - Balance requests based on current load and capacity
- **Support parallel execution** - Broadcast jobs to multiple workers simultaneously

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Coordinator                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          selectBestWorker() Algorithm                  │ │
│  │  • Model awareness (100 points if loaded)              │ │
│  │  • Worker specialization (50 points)                   │ │
│  │  • Current load (-30 points per 100% CPU)             │ │
│  │  • Active requests (-5 points each)                    │ │
│  │  • Tier preference (GPU=30, CPU=20, Storage=10)       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                │                            │
       ┌────────▼────────┐          ┌───────▼────────┐
       │  GPU Worker 1   │          │  GPU Worker 2  │
       │  Specialization:│          │  Specialization:│
       │      OCR        │          │      vLLM      │
       │                 │          │                │
       │  Loaded Models: │          │  Loaded Models:│
       │  • llama-vision │          │  • llama3.2    │
       │  • nomic-embed  │          │  • nomic-embed │
       └─────────────────┘          └────────────────┘
```

## Smart Routing Algorithm

### Scoring Factors

The `selectBestWorker()` function scores each worker based on multiple factors:

| Factor | Points | Description |
|--------|--------|-------------|
| Model Loaded | +100 | Worker already has required model loaded |
| Specialization | +50 | Worker declares preference for this service |
| Tier (GPU) | +30 | GPU workers preferred for compute tasks |
| Tier (CPU) | +20 | CPU workers as fallback |
| Tier (Storage) | +10 | Storage workers for data operations |
| Service Health | +10 | Service is confirmed healthy |
| CPU Load | -30 per 100% | Penalty for high CPU usage |
| Active Requests | -5 each | Penalty for concurrent requests |
| GPU Utilization | -20 per 100% | Penalty for high GPU usage (GPU workers only) |
| Random | +0-5 | Tiebreaker for equal scores |

### Example Scenarios

#### Scenario 1: OCR Request with 2 GPU Workers

**Workers:**
- GPU-1: Has `llama-vision` loaded, 20% CPU, 0 active requests, specialization: `ocr`
- GPU-2: Has `llama3.2` loaded, 15% CPU, 2 active requests, specialization: `vllm`

**Scoring for GPU-1:**
- Model loaded (llama-vision): +100
- Specialization (ocr): +50
- Tier (GPU): +30
- CPU load (20%): -6
- Active requests (0): 0
- **Total: ~174 points**

**Scoring for GPU-2:**
- Model loaded (wrong model): 0
- Specialization (wrong): 0
- Tier (GPU): +30
- CPU load (15%): -4.5
- Active requests (2): -10
- **Total: ~15.5 points**

**Result: GPU-1 wins** - Avoids downloading llama3.2, respects specialization

#### Scenario 2: vLLM Request During High Load

**Workers:**
- GPU-1: Has `llama3.2`, 90% CPU, 5 active requests
- GPU-2: Has `llama3.2`, 30% CPU, 1 active request

**Scoring:**
- GPU-1: 100 (model) + 30 (tier) - 27 (CPU) - 25 (requests) = ~78
- GPU-2: 100 (model) + 30 (tier) - 9 (CPU) - 5 (requests) = ~116

**Result: GPU-2 wins** - Better load distribution

## Worker Configuration

### Setting Worker Specialization

Workers declare specialization via environment variable:

```bash
# GPU Worker 1 - Specialized for OCR
docker run -d --gpus all \
  -e WORKER_SPECIALIZATION="ocr" \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# GPU Worker 2 - Specialized for vLLM
docker run -d --gpus all \
  -e WORKER_SPECIALIZATION="vllm" \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
```

### Model Detection

Workers automatically detect loaded models by checking:

1. **Ollama models**: `GET http://localhost:11434/api/tags`
   - Detects: `llama3.2`, `llama3.2-vision`, custom models
   
2. **Embedding service**: `GET http://localhost:8000/health`
   - Detects: `nomic-embed-text`
   
3. **OCR/Vision service**: `GET http://localhost:8001/health`
   - Detects: `llama-vision`, PaddleOCR

### Heartbeat Data

Workers send comprehensive load information:

```json
{
  "worker_id": "gpu-worker-abc123",
  "status": "healthy",
  "current_load": 0.42,
  "available_memory": "24.5GB",
  "gpu_utilization": 65.3,
  "active_requests": 2,
  "loaded_models": ["llama3.2", "nomic-embed-text"],
  "specialization": "vllm",
  "services_status": {
    "vllm": "healthy",
    "embeddings": "healthy"
  }
}
```

## Job Broadcasting

For tasks that can be parallelized (e.g., bulk ingestion), use job broadcasting:

### Broadcast Endpoint

```http
POST https://api.rmatool.org.uk/api/coordinator/broadcast-job
Content-Type: application/json

{
  "job_type": "rag_ingestion",
  "job_data": {
    "documents": [...],
    "collection": "manuals",
    "chunk_size": 512
  },
  "required_capability": "embeddings"
}
```

### Response

```json
{
  "job_type": "rag_ingestion",
  "broadcasted_to": 3,
  "successful": 3,
  "failed": 0,
  "workers": [
    {"worker_id": "gpu-1", "status": "accepted", "status_code": 200},
    {"worker_id": "gpu-2", "status": "accepted", "status_code": 200},
    {"worker_id": "cpu-1", "status": "accepted", "status_code": 200}
  ]
}
```

### Broadcast Behavior

- Sends job to **all capable workers** simultaneously
- Workers filter by tier (GPU/CPU preferred, tier ≤ 2)
- Workers check for required capability
- Each worker processes independently
- Results aggregated by coordinator

## Shared Resources

### ChromaDB Sharing

Workers share embeddings via common ChromaDB storage:

```yaml
# All workers use same ChromaDB endpoint
environment:
  CHROMADB_URL: "http://storage-worker:8000"
  
# Storage worker provides ChromaDB
services:
  storage-worker:
    image: ghcr.io/st7ma784/cmacatalyst/storage-worker
    ports:
      - "8000:8000"
```

**Benefits:**
- Parallel ingestion without conflicts
- Shared vector store reduces duplication
- Workers can query same collection

## Deployment Examples

### Single GPU - General Purpose

```bash
# One worker handles everything
docker run -d --gpus all \
  -e COORDINATOR_URL="https://api.rmatool.org.uk" \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
```

### Multiple GPUs - Specialized

```bash
# GPU 1: OCR specialist
docker run -d --gpus '"device=0"' \
  -e WORKER_SPECIALIZATION="ocr" \
  -e COORDINATOR_URL="https://api.rmatool.org.uk" \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# GPU 2: vLLM specialist
docker run -d --gpus '"device=1"' \
  -e WORKER_SPECIALIZATION="vllm" \
  -e COORDINATOR_URL="https://api.rmatool.org.uk" \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# Shared storage
docker run -d \
  -e ENABLE_CHROMADB="true" \
  -e COORDINATOR_URL="https://api.rmatool.org.uk" \
  ghcr.io/st7ma784/cmacatalyst/storage-worker:latest
```

### CPU Fallback Cluster

```bash
# Multiple CPU workers for scale-out
for i in {1..3}; do
  docker run -d \
    -e COORDINATOR_URL="https://api.rmatool.org.uk" \
    ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
done
```

## Monitoring

### Check Worker Status

```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq '.workers[] | {
  id: .worker_id,
  tier: .tier,
  specialization: .specialization,
  loaded_models: .loaded_models,
  active_requests: .active_requests,
  cpu_load: .current_load,
  gpu_util: .gpu_utilization
}'
```

### Example Output

```json
{
  "id": "gpu-worker-abc123",
  "tier": 1,
  "specialization": "vllm",
  "loaded_models": ["llama3.2", "nomic-embed-text"],
  "active_requests": 2,
  "cpu_load": 0.45,
  "gpu_util": 72.5
}
```

### Service Distribution

```bash
curl https://api.rmatool.org.uk/api/admin/services | jq '.services[] | {
  name: .name,
  worker_count: .worker_count,
  workers: .workers
}'
```

## Troubleshooting

### Issue: Models Keep Re-downloading

**Symptom:** Workers downloading same models repeatedly

**Solution:**
1. Check workers report loaded models:
   ```bash
   curl https://api.rmatool.org.uk/api/admin/workers | jq '.[].loaded_models'
   ```

2. Verify model detection:
   ```bash
   docker exec gpu-worker curl http://localhost:11434/api/tags
   ```

3. Check coordinator routing logs in Cloudflare Workers dashboard

### Issue: Load Not Distributed

**Symptom:** One worker overloaded, others idle

**Solution:**
1. Verify heartbeat frequency (should be every 30s)
2. Check worker tier assignments
3. Ensure workers register with correct capabilities
4. Review selectBestWorker() scoring in coordinator logs

### Issue: Broadcast Jobs Not Parallel

**Symptom:** Ingestion jobs sequential instead of parallel

**Solution:**
1. Use broadcast endpoint: `/api/coordinator/broadcast-job`
2. Ensure multiple capable workers registered
3. Check workers have required capability in manifest
4. Verify ChromaDB shared between workers

## Performance Tips

1. **Specialize Workers**: Set `WORKER_SPECIALIZATION` for predictable workloads
2. **Keep Models Loaded**: Don't restart workers unnecessarily
3. **Monitor Heartbeats**: 30-second interval balances freshness vs overhead
4. **Use Tiers**: Let GPU workers handle CPU tasks during idle time
5. **Broadcast Heavy Jobs**: Use broadcasting for bulk ingestion/processing

## API Reference

### Select Best Worker (Internal)

```javascript
function selectBestWorker(healthyWorkers, serviceName, servicePath)
// Returns: worker object with highest score
```

### Detect Required Model (Internal)

```javascript
function detectRequiredModel(servicePath)
// Returns: model name string or null
// Examples: "llama3.2", "llama-vision", "nomic-embed-text"
```

### Broadcast Job

```javascript
POST /api/coordinator/broadcast-job
{
  "job_type": string,
  "job_data": object,
  "required_capability": string  // optional
}
```

## Related Documentation

- [CAPABILITY_BASED_ROUTING.md](./CAPABILITY_BASED_ROUTING.md) - Tier system architecture
- [DISTRIBUTED_RAG_SETUP.md](./DISTRIBUTED_RAG_SETUP.md) - Deployment guide
- [SHARED_OLLAMA_SETUP.md](./SHARED_OLLAMA_SETUP.md) - Model sharing strategies
