# Phase 4 & 5 Complete Implementation Plan

## Overview

**Phase 4: Benchmarking** - Validate 5-10x performance improvement  
**Phase 5: Staging Deployment** - Deploy and test in staging environment

---

## Phase 4: Performance Benchmarking

### What Gets Benchmarked

#### 1. **Single Request Latency**
```
Measure: Time per request
Target: vLLM < 500ms vs Ollama 2-5s
Method: 10 sequential requests
Metric: Avg/Min/Max/P95/P99 latency
```

#### 2. **Throughput**
```
Measure: Requests per second
Target: vLLM > 100 req/sec vs Ollama 20-50
Method: Sustained requests for 10 seconds
Metric: req/sec, total completed
```

#### 3. **Concurrent Request Handling**
```
Measure: Parallel request capability
Target: vLLM handles 50+ concurrent
Method: 5 workers × 10 requests each
Metric: Concurrent throughput, max latency
```

### Benchmark Script Features

✅ **Dual Provider Testing**
- Automatically tests both Ollama and vLLM
- Switches via LLM_PROVIDER environment variable

✅ **Automatic Comparison**
- Calculates improvement ratios
- Shows faster provider
- Compares error rates

✅ **Result Persistence**
- Saves to benchmark_results.json
- Contains raw latencies and aggregated stats
- Enables trend analysis

✅ **Graceful Degradation**
- Works with or without running services
- Measures initialization times if services down
- Shows meaningful data either way

### Running Phase 4

```bash
# Step 1: Optional - Start services
docker-compose -f docker-compose.vllm.yml up -d

# Step 2: Run benchmarks
python benchmark_vllm.py

# Step 3: Review results
cat benchmark_results.json | python -m json.tool

# Step 4: Analyze improvements
# Look for 5-10x gains in throughput and latency
```

### Expected Phase 4 Output

```
======================================================================
  vLLM BENCHMARKING SUITE
======================================================================

----------------------------------------------------------------------
  1. Single Request Latency (Ollama)
----------------------------------------------------------------------
  Warming up Ollama...
  ✓ Warm-up completed in X.XXXs
  
  Running 5 requests...
    Average Latency: XXX.XXms
    Min Latency: XX.XXms
    Max Latency: XXX.XXms
    P95 Latency: XXX.XXms
    Success Rate: 100.0%

----------------------------------------------------------------------
  1. Single Request Latency (vLLM)
----------------------------------------------------------------------
  [Similar output for vLLM]

----------------------------------------------------------------------
  BENCHMARK COMPARISON REPORT
----------------------------------------------------------------------
  Comparison: Ollama vs vLLM
  
  Latency:
    Ollama: XXX.XXms
    vLLM: XXX.XXms
    → vLLM is X.X% faster

  Throughput:
    Ollama: XX.XX req/sec
    vLLM: XXX.XX req/sec
    → vLLM is X.Xx faster

  Reliability:
    Ollama Error Rate: 0.00%
    vLLM Error Rate: 0.00%

  ✓ Results saved to: benchmark_results.json
```

### Success Criteria for Phase 4

| Metric | Target | Status |
|--------|--------|--------|
| vLLM Latency | < 500ms | ⏳ To verify |
| vLLM Throughput | > 100 req/sec | ⏳ To verify |
| Latency Improvement | 5-10x | ⏳ To verify |
| Throughput Improvement | 5-10x | ⏳ To verify |
| Error Rate | < 1% | ⏳ To verify |
| Concurrent Handling | 50+ simultaneous | ⏳ To verify |

---

## Phase 5: Staging Deployment

### Deployment Steps

#### Step 1: Build Docker Images

```bash
# Build all services with updated requirements
docker-compose -f docker-compose.vllm.yml build --no-cache

# Expected: All services build successfully with new dependencies
# RAG Service: openai SDK installed
# Notes Service: openai SDK installed
# Doc-Processor: openai + ollama SDKs installed
```

#### Step 2: Start Staging Environment

```bash
# Deploy to staging
docker-compose -f docker-compose.vllm.yml up -d

# Verify startup (wait for healthy status)
docker-compose -f docker-compose.vllm.yml ps

# Expected all services: Up (healthy)
```

#### Step 3: Health Checks

```bash
# RAG Service Health
curl -s http://localhost:8003/health | jq .
# Expected: {"status": "healthy", "llm_available": true}

# Notes Service Health
curl -s http://localhost:8100/health | jq .
# Expected: {"status": "healthy", "llm_available": true}

# Doc-Processor Health
curl -s http://localhost:8101/health | jq .
# Expected: {"status": "healthy", "vision_analysis_available": true}
```

#### Step 4: End-to-End Testing

```bash
# Test 1: RAG Service Query
curl -X POST http://localhost:8003/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is document processing?",
    "documents": ["Sample document text"]
  }'

# Test 2: Notes Service Conversion
curl -X POST http://localhost:8100/convert \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Client discussed legal requirements",
    "client_name": "John Smith"
  }'

# Test 3: Document Processing
curl -X POST http://localhost:8101/process \
  -F "file=@sample.pdf"
```

#### Step 5: Provider Switching Test

```bash
# Test Ollama provider
export LLM_PROVIDER=ollama
docker-compose -f docker-compose.vllm.yml restart rag-service

# Verify Ollama mode
curl -s http://localhost:8003/health | jq .provider

# Switch to vLLM
export LLM_PROVIDER=vllm
docker-compose -f docker-compose.vllm.yml restart rag-service

# Verify vLLM mode
curl -s http://localhost:8003/health | jq .provider
```

#### Step 6: Performance Validation

```bash
# Monitor GPU usage
watch -n 1 nvidia-smi

# Expected:
# GPU 0 (Ollama): 50-70% when processing vision
# GPU 1 (vLLM): 70-90% when processing text

# Monitor container stats
docker stats

# Expected:
# vLLM using ~8GB RAM (vs Ollama ~15GB)
# CPU usage 60-80% under load
```

#### Step 7: Load Testing

```bash
# Install Locust
pip install locust

# Create test scenario with multiple concurrent users
locust -f locustfile.py --host=http://localhost:8003 \
  -u 50 -r 10 --run-time 5m

# Expected results:
# 50 concurrent users
# 10 users/sec ramp-up
# 5 minute run time
# All requests succeed
# Response times under target
```

#### Step 8: Stability Monitoring

```bash
# Monitor for 1 hour+
watch -n 60 'docker stats; echo "---"; curl -s http://localhost:8003/health'

# Expected:
# No service restarts
# Memory stable
# GPU utilization steady
# All health checks pass
```

### Deployment Architecture

```
Staging Environment
┌─────────────────────────────────────────┐
│                                         │
│  vLLM Setup (docker-compose.vllm.yml)   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │     Multi-GPU Orchestration      │   │
│  │                                  │   │
│  │  GPU 0: Ollama (Vision)          │   │
│  │    ├─ llama3.2 (text)            │   │
│  │    └─ llava:7b (vision)          │   │
│  │                                  │   │
│  │  GPU 1: vLLM (Text Generation)   │   │
│  │    ├─ llama3.2 (inference)       │   │
│  │    └─ Fast attention (paged)     │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │      Service Layer               │   │
│  │                                  │   │
│  │  ├─ RAG Service (8003)           │   │
│  │  │  └─ Provider: vLLM/Ollama     │   │
│  │  ├─ Notes Service (8100)         │   │
│  │  │  └─ Provider: vLLM/Ollama     │   │
│  │  └─ Doc-Processor (8101)         │   │
│  │     └─ Vision: Ollama (optional) │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │      Supporting Services         │   │
│  │                                  │   │
│  │  ├─ ChromaDB (Vector Store)      │   │
│  │  ├─ Frontend (3000)              │   │
│  │  └─ N8N (Workflow)               │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Staging Validation Checklist

- [ ] **Build Phase**
  - [ ] All Docker images build successfully
  - [ ] No dependency conflicts
  - [ ] Images size reasonable

- [ ] **Startup Phase**
  - [ ] All services start
  - [ ] Health checks pass
  - [ ] No memory errors
  - [ ] GPU allocation correct

- [ ] **Functional Testing**
  - [ ] RAG service queries work
  - [ ] Notes service conversions work
  - [ ] Doc-processor handles uploads
  - [ ] Responses are correct

- [ ] **Performance Testing**
  - [ ] vLLM latency < target
  - [ ] vLLM throughput > target
  - [ ] GPU utilization correct
  - [ ] Memory usage stable

- [ ] **Resilience Testing**
  - [ ] Provider fallback works
  - [ ] Service recovery works
  - [ ] No data loss on restart
  - [ ] Graceful error handling

- [ ] **Stability Testing**
  - [ ] 1+ hour uptime stable
  - [ ] No memory leaks
  - [ ] No service drift
  - [ ] Metrics consistent

---

## Success Criteria

### Phase 4 Success
✅ Benchmarks complete  
✅ 5-10x improvement verified  
✅ All metrics meet targets  
✅ Results documented  

### Phase 5 Success
✅ All services deploy successfully  
✅ End-to-end tests pass  
✅ Performance targets met  
✅ Stability validated  
✅ Ready for production  

---

## Timeline Estimate

| Phase | Task | Duration |
|-------|------|----------|
| 4.1 | Setup benchmarking | 30 min |
| 4.2 | Run benchmarks | 1-2 hours |
| 4.3 | Analyze results | 30 min |
| **Phase 4 Total** | **2-3 hours** |
| 5.1 | Build images | 30 min |
| 5.2 | Deploy staging | 30 min |
| 5.3 | E2E testing | 1 hour |
| 5.4 | Performance validation | 1 hour |
| 5.5 | Stability monitoring | 1+ hours |
| **Phase 5 Total** | **2-4 hours** |
| **Combined Total** | **4-7 hours** |

---

## What's Included

### Phase 4 Deliverables
✅ `benchmark_vllm.py` - Benchmarking suite  
✅ `benchmark_results.json` - Performance data  
✅ Performance comparison report  
✅ Improvement metrics validated  

### Phase 5 Deliverables
✅ Staging deployment working  
✅ All services healthy  
✅ Performance validated  
✅ Stability confirmed  
✅ Ready for production  

---

## Next Phase: Production Rollout

Once Phase 4 & 5 complete:
- Deploy to production with monitoring
- Gradual traffic migration
- Real-time performance tracking
- Ongoing optimization

---

**Status: Phase 4 & 5 Ready to Begin**

