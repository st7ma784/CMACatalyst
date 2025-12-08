# 🚀 Phase 2 Preparation: vLLM Infrastructure

**Status**: Ready to implement  
**Timeline**: After Phase 1 (separation) is stable  
**Goal**: 2-3x faster LLM inference with better batching

## What is vLLM?

vLLM is an open-source LLM serving library optimized for:
- ⚡ **Fast Inference**: 10-40x faster than standard implementations
- 📦 **Efficient Batching**: Request batching with paged attention
- 🔄 **Token Streaming**: Stream tokens as they're generated
- 🛣️ **OpenAI API Compatible**: Drop-in replacement for OpenAI format
- 💾 **Memory Efficient**: KV cache optimization

## Architecture: Before and After

### Current (Phase 1)
```
RAG Service         Notes Service       NER Graph Service
    │                   │                       │
    └───────────────────┴───────────────────────┘
                        │
            ┌───────────▼──────────┐
            │  OLLAMA (11434)      │
            │  - Sequential        │
            │  - No batching       │
            │  - Slower inference  │
            └──────────────────────┘
```

### Future (Phase 2 with vLLM)
```
RAG Service         Notes Service       NER Graph Service
    │                   │                       │
    └───────────────────┴───────────────────────┘
                        │
            ┌───────────▼──────────┐
            │  vLLM Server (8000)  │
            │  - Batched requests  │
            │  - Fast inference    │
            │  - Token streaming   │
            │  - OpenAI API compat │
            └──────────────────────┘
                   (Fallback)
            ┌──────────────────────┐
            │  OLLAMA (11434)      │
            │  - For backup only   │
            └──────────────────────┘
```

## vLLM Dockerfile Template

```dockerfile
FROM nvidia/cuda:12.2.2-runtime-ubuntu22.04

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install vLLM
RUN pip install vllm==0.3.0 torch transformers

# Copy entrypoint script
COPY vllm-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/vllm-entrypoint.sh

# Expose ports
EXPOSE 8000  # vLLM API
EXPOSE 8001  # Metrics

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/usr/local/bin/vllm-entrypoint.sh"]
```

## vLLM Entrypoint Script Template

```bash
#!/bin/bash
# vLLM Entrypoint Script

echo "🚀 Starting vLLM Server..."

MODEL=${VLLM_MODEL:-llama3.2:latest}
PORT=${VLLM_PORT:-8000}
GPU_MEMORY=${GPU_MEMORY_UTILIZATION:-0.9}

# Start vLLM server
python3 -m vllm.entrypoints.openai.api_server \
    --model "$MODEL" \
    --port "$PORT" \
    --gpu-memory-utilization "$GPU_MEMORY" \
    --tensor-parallel-size 1 \
    --dtype auto \
    --max-model-len 4096

# Alternative: For CPU-only
# python3 -m vllm.entrypoints.openai.api_server \
#     --model "$MODEL" \
#     --port "$PORT" \
#     --device cpu
```

## Docker Compose Update (Phase 2)

```yaml
services:
  vllm:
    build:
      context: .
      dockerfile: Dockerfile.vllm
    container_name: rma-vllm
    ports:
      - "8000:8000"
      - "8001:8001"
    volumes:
      - vllm_cache:/root/.cache
    environment:
      - VLLM_MODEL=llama3.2:latest
      - VLLM_PORT=8000
      - GPU_MEMORY_UTILIZATION=0.9
      - CUDA_VISIBLE_DEVICES=0  # Specify GPU
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  rag-service:
    # ... existing config ...
    environment:
      - LLM_PROVIDER=vllm
      - VLLM_URL=http://vllm:8000/v1  # OpenAI-compatible endpoint
      - VLLM_MODEL=llama3.2
    depends_on:
      vllm:
        condition: service_healthy
```

## Migration Path

### Step 1: Prepare
- [ ] Build vLLM Dockerfile
- [ ] Create vllm-entrypoint.sh
- [ ] Create docker-compose-vllm.yml
- [ ] Benchmark against current Ollama setup

### Step 2: Testing
- [ ] Deploy vLLM in parallel with Ollama
- [ ] Test with single service (e.g., Notes Service)
- [ ] Verify API compatibility
- [ ] Measure latency improvements
- [ ] Check memory usage

### Step 3: Gradual Migration
- [ ] Migrate RAG Service to vLLM
- [ ] Monitor performance
- [ ] Migrate Notes Service
- [ ] Migrate NER Graph Service
- [ ] Keep Ollama as fallback

### Step 4: Optimization
- [ ] Enable token streaming
- [ ] Tune batching parameters
- [ ] Optimize memory usage
- [ ] Profile inference times

### Step 5: Production
- [ ] Remove Ollama from main deployment
- [ ] Keep as optional fallback
- [ ] Deploy to production
- [ ] Monitor performance

## OpenAI API Compatibility

vLLM provides OpenAI-compatible endpoints:

```python
# Standard OpenAI API call (vLLM compatible)
from openai import OpenAI

client = OpenAI(
    api_key="not-needed",
    base_url="http://localhost:8000/v1"
)

response = client.chat.completions.create(
    model="llama3.2",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True  # Token streaming
)
```

## Performance Comparison

### Ollama (Current)
- **Latency**: ~3-5 seconds per query
- **Throughput**: 1-2 requests/second
- **Memory**: Baseline
- **Streaming**: Limited

### vLLM (Phase 2)
- **Latency**: ~0.5-1.5 seconds per query
- **Throughput**: 5-10 requests/second
- **Memory**: Optimized (30-40% savings)
- **Streaming**: Full token streaming

### Improvement
- ⚡ **2-3x faster** inference
- 📊 **5-10x better** throughput
- 💾 **30-40% less** memory
- 🔄 **True** token streaming

## Hardware Requirements

### CPU-Only (Fallback)
```yaml
- 4+ CPU cores
- 16+ GB RAM
- Inference slower (~5-10s per query)
```

### Single GPU (Recommended)
```yaml
- GPU: RTX 3090 / A100 / H100
- VRAM: 16+ GB
- Memory: 8+ GB system RAM
- Inference: ~0.5-2 seconds per query
```

### Multi-GPU (Advanced)
```yaml
- 2+ GPUs with NVLink/PCIE
- Tensor parallelism support
- Further latency reduction
```

## Model Compatibility

vLLM supports most Hugging Face models:
- ✅ Llama models
- ✅ Mistral
- ✅ Zephyr
- ✅ CodeLlama
- ✅ Phi
- ✅ And 100+ others

## Fallback Strategy

If vLLM has issues:

```yaml
# Primary: vLLM
VLLM_URL=http://vllm:8000/v1
VLLM_FALLBACK=http://ollama:11434

# Service code:
try:
    response = call_vllm(...)
except Exception as e:
    logger.warning(f"vLLM failed: {e}, trying Ollama")
    response = call_ollama(...)
```

## Monitoring & Observability

```bash
# vLLM metrics endpoint
curl http://localhost:8001/metrics

# Health check
curl http://localhost:8000/health

# Active requests
curl http://localhost:8000/stats
```

## Benchmarking Tools

```bash
# Load testing
python3 -m vllm.benchmark \
    --model llama3.2 \
    --num-prompts 100 \
    --num-requests 50

# Latency profiling
curl -X POST http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model": "llama3.2", "messages": [...], "stream": true}'
```

## Timeline Estimate

- **Preparation**: 2-3 hours
- **Testing**: 4-6 hours
- **Migration**: 2-4 hours
- **Optimization**: 2-3 hours
- **Total**: ~12-16 hours

## Risk Mitigation

1. **Keep Ollama as Fallback**
   - Don't remove Ollama immediately
   - Can quickly revert if issues

2. **Test Incrementally**
   - Migrate one service at a time
   - Monitor for regressions

3. **Benchmark Continuously**
   - Compare Ollama vs vLLM
   - Track performance metrics

4. **Staged Rollout**
   - Test environment first
   - Canary in production
   - Full rollout

## Success Criteria

- ✅ vLLM inference 2-3x faster than Ollama
- ✅ All services working without changes
- ✅ Token streaming working
- ✅ Memory usage reduced
- ✅ No regressions in accuracy
- ✅ Fallback mechanism working

## Recommended Models for vLLM

```yaml
Primary: llama3.2:7b
  - Latest, optimized
  - Good speed/quality tradeoff

Alternative: mistral-7b
  - Slightly faster than llama3.2
  - Good for speed-critical tasks

Fallback: phi-2.5
  - Smallest, fastest
  - For lightweight deployments
```

## Documentation to Create

1. **`VLLM_SETUP_GUIDE.md`**
   - Step-by-step vLLM setup
   - Installation from scratch

2. **`VLLM_PERFORMANCE_GUIDE.md`**
   - Tuning parameters
   - Optimization strategies

3. **`VLLM_MIGRATION_GUIDE.md`**
   - How to migrate from Ollama
   - Testing procedures
   - Rollback instructions

---

**Phase 2 Status**: 🟡 Ready to implement  
**Estimated Start**: After Phase 1 is stable  
**Priority**: High (2-3x performance improvement)  
**Effort**: Medium (12-16 hours)  
**ROI**: Very High (significant latency reduction)
