# Phase 4 & 5: Benchmarking & Staging Deployment Guide

## Overview

This guide covers:
- **Phase 4:** Performance benchmarking validation
- **Phase 5:** Staging deployment and testing

---

## Phase 4: Performance Benchmarking (2-3 hours)

### Step 1: Prepare Benchmarking Environment

```bash
# Navigate to project
cd /c/Users/st7ma/Documents/CMACatalyst/RMA-Demo

# Ensure services are running (optional but recommended for accurate results)
docker-compose -f docker-compose.vllm.yml up -d

# Wait for services to be ready
docker-compose -f docker-compose.vllm.yml logs -f vllm
# or
docker-compose -f docker-compose.vllm.yml logs -f ollama
```

### Step 2: Run Benchmark Suite

```bash
# Run benchmarks (works with or without services running)
python benchmark_vllm.py
```

**Expected Output:**
```
BENCHMARKING OLLAMA
  1. Single Request Latency (Ollama)
  2. Throughput Benchmark (Ollama)
  3. Concurrent Request Benchmark (Ollama)

BENCHMARKING vLLM
  1. Single Request Latency (vLLM)
  2. Throughput Benchmark (vLLM)
  3. Concurrent Request Benchmark (vLLM)

BENCHMARK COMPARISON REPORT
  → vLLM is X% faster
  → vLLM is X.Xx faster throughput
```

### Step 3: Analyze Results

Results are saved to `benchmark_results.json`

**What to Look For:**
```
✓ vLLM latency < Ollama latency (target: 5-10x faster)
✓ vLLM throughput > Ollama throughput (target: 5-10x faster)
✓ vLLM error rate < Ollama error rate
✓ vLLM handles more concurrent requests
```

### Step 4: Interpret Results

**Success Criteria:**
- Average Latency: vLLM < 500ms (vs Ollama ~2-5s)
- Throughput: vLLM > 100 req/sec (vs Ollama ~20-50 req/sec)
- Concurrent Requests: vLLM handles 50+ (vs Ollama ~10-20)

---

## Phase 5: Staging Deployment (2-4 hours)

### Step 1: Build Updated Docker Images

```bash
# Option 1: Build with updated requirements
docker build -t rag-service:vllm -f Dockerfile.rag-service services/rag-service/
docker build -t notes-service:vllm -f Dockerfile.notes-service services/notes-service/
docker build -t doc-processor:vllm -f Dockerfile.doc-processor services/doc-processor/

# Option 2: Use existing docker-compose (will pull or rebuild as needed)
docker-compose -f docker-compose.vllm.yml build --no-cache
```

### Step 2: Deploy to Staging

```bash
# Start staging environment with vLLM
docker-compose -f docker-compose.vllm.yml up -d

# Verify all services are running
docker-compose -f docker-compose.vllm.yml ps
```

**Expected Output:**
```
NAME                   STATUS              PORTS
ollama                 Up (healthy)        11434->11434/tcp
vllm                   Up (healthy)        8000->8000/tcp
chromadb               Up (healthy)        8001->8001/tcp
rag-service            Up (healthy)        8003->8003/tcp
notes-service          Up (healthy)        8100->8100/tcp
doc-processor          Up (healthy)        8101->8101/tcp
frontend               Up                  3000->3000/tcp
```

### Step 3: Validate Service Health

```bash
# Check RAG Service
curl http://localhost:8003/health

# Check Notes Service
curl http://localhost:8100/health

# Check Doc-Processor
curl http://localhost:8101/health

# Expected Response:
# {"status": "healthy", "llm_available": true, "provider": "VLLMProvider"}
```

### Step 4: Run End-to-End Tests

```bash
# Test RAG Service
curl -X POST http://localhost:8003/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the color of the sky?"}'

# Test Notes Service
curl -X POST http://localhost:8100/convert \
  -H "Content-Type: application/json" \
  -d '{"notes": "Client discussed case details", "client_name": "John Doe"}'

# Test Doc-Processor
curl -X POST http://localhost:8101/process \
  -F "file=@sample_document.pdf"
```

### Step 5: Monitor Performance

```bash
# Watch real-time logs
docker-compose -f docker-compose.vllm.yml logs -f rag-service

# Monitor resource usage
docker stats

# Check GPU utilization
nvidia-smi

# Expected GPU Usage:
# Ollama (GPU 0): 50-70% for vision tasks
# vLLM (GPU 1): 70-90% for text generation
```

### Step 6: Run Load Testing

```bash
# Install load testing tool (if not already installed)
pip install locust

# Create locustfile.py (see template below)
# Run load test
locust -f locustfile.py --host=http://localhost:8003 -u 50 -r 10
```

### Step 7: Verify Fallback Logic

```bash
# Test fallback to Ollama
export LLM_PROVIDER=ollama
docker-compose -f docker-compose.vllm.yml restart rag-service

# Should still work, just slower
curl http://localhost:8003/health

# Switch back to vLLM
export LLM_PROVIDER=vllm
docker-compose -f docker-compose.vllm.yml restart rag-service
```

### Step 8: Validate 24-Hour Stability

```bash
# Monitor for 24 hours
while true; do
  curl -s http://localhost:8003/health | jq .
  sleep 300  # Every 5 minutes
done
```

---

## Load Test Template (locustfile.py)

```python
from locust import HttpUser, task, between
import json

class RAGServiceUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def query_service(self):
        payload = {
            "query": "What is artificial intelligence?",
            "documents": ["Sample document 1", "Sample document 2"]
        }
        self.client.post(
            "/query",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
    
    @task
    def health_check(self):
        self.client.get("/health")

class NotesServiceUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def convert_notes(self):
        payload = {
            "notes": "Client discussed case details",
            "client_name": "John Doe"
        }
        self.client.post(
            "/convert",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
```

---

## Troubleshooting

### vLLM Service Won't Start

```bash
# Check GPU availability
nvidia-smi

# Check vLLM logs
docker-compose logs vllm

# Common issues:
# - GPU out of memory: reduce model size
# - Port already in use: change port in docker-compose
# - Model not found: ensure model is downloaded
```

### Services Crashing After Deployment

```bash
# Check service logs
docker-compose logs <service-name>

# Restart service
docker-compose restart <service-name>

# Rebuild service
docker-compose build --no-cache <service-name>
docker-compose up -d <service-name>
```

### Performance Not Meeting Targets

```bash
# Verify vLLM is being used
docker-compose logs rag-service | grep "provider"

# Check GPU is allocated correctly
docker-compose exec vllm nvidia-smi

# Check if model is loaded
curl http://localhost:8000/v1/models

# Optimize:
# - Increase GPU memory
# - Reduce batch size
# - Enable paging attention
```

---

## Success Criteria

### Benchmarking Phase Complete When:
- ✅ Benchmark suite runs successfully
- ✅ vLLM shows 5-10x improvement
- ✅ Results saved and analyzed
- ✅ All metrics exceed targets

### Staging Deployment Complete When:
- ✅ All services running and healthy
- ✅ End-to-end tests pass
- ✅ Load tests show expected performance
- ✅ Fallback logic verified
- ✅ 24-hour stability validated

---

## Next: Production Rollout

Once staging validation passes:

1. **Preparation**
   - Deploy with monitoring enabled
   - Set up alerting
   - Create runbooks

2. **Deployment**
   - Blue-green deployment strategy
   - Gradual traffic migration
   - Continuous monitoring

3. **Validation**
   - Real production metrics
   - User acceptance testing
   - Performance verification

---

## Quick Reference Commands

### Benchmarking
```bash
python benchmark_vllm.py              # Run benchmarks
cat benchmark_results.json            # View results
```

### Deployment
```bash
docker-compose -f docker-compose.vllm.yml up -d    # Start services
docker-compose -f docker-compose.vllm.yml ps       # Check status
docker-compose -f docker-compose.vllm.yml logs -f  # Watch logs
docker-compose -f docker-compose.vllm.yml down     # Stop services
```

### Monitoring
```bash
docker stats                          # Resource usage
nvidia-smi                            # GPU status
docker-compose logs <service>         # Service logs
curl http://localhost:8003/health     # Health check
```

### Troubleshooting
```bash
docker-compose build --no-cache       # Rebuild images
docker-compose exec <service> bash    # Interactive shell
docker logs <container> --tail 50     # Last 50 lines
```

---

## Estimated Timeline

- **Phase 4 Benchmarking:** 2-3 hours
  - 30 min: Setup environment
  - 1 hour: Run benchmarks
  - 30-60 min: Analysis

- **Phase 5 Staging:** 2-4 hours
  - 30 min: Build images
  - 1 hour: Deploy and validate
  - 1-2 hours: Load testing and monitoring

- **Total Phases 4-5:** 4-7 hours

---

**Status:** Ready for Phase 4 Benchmarking → Phase 5 Staging Deployment

