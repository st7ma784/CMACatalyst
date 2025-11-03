# vLLM Migration Analysis for RMA-Demo

## Executive Summary

**Yes, migration from Ollama to vLLM is feasible** and would provide significant scaling advantages. This document details the assessment and migration plan.

---

## Current Ollama Architecture

### Services Using Ollama
1. **RAG Service** (`services/rag-service/app.py`)
   - Embeddings: `nomic-embed-text` via `OllamaEmbeddings`
   - LLM: `llama3.2` for synthesis and analysis
   - Usage: Vector generation, QA chains, question analysis, threshold extraction

2. **Notes Service** (`services/notes-service/app.py`)
   - LLM: `llama3.2` for processing
   - Simple REST calls to Ollama API

3. **Doc-Processor Service** (`services/doc-processor/app.py`)
   - Vision Model: `llava:7b` for OCR
   - Text Model: `llama3.2` for document processing

### Docker Compose Configuration
```yaml
ollama:
  image: ollama/ollama:latest
  ports: 11434
  volumes: ollama_data
  GPU: all (via deploy.resources)
```

### Current Dependencies
- `ollama==0.4.4` (Python SDK)
- `langchain==0.3.0` with `langchain-community==0.3.0`
- Direct HTTP REST calls to Ollama API

---

## Why vLLM is Better for Scaling

### Key Advantages

| Feature | Ollama | vLLM |
|---------|--------|------|
| **Throughput** | Single request at a time | Batching & concurrent requests |
| **Latency** | Higher per-request latency | Lower latency with KV-cache |
| **Memory Efficiency** | Baseline | 70-80% more efficient via paging |
| **Request Batching** | Not supported | Native LoRA batching |
| **GPU Utilization** | ~30-50% typical | ~70-90% typical |
| **Vision Models** | Supported (slower) | Supported (much faster) |
| **Scaling Pattern** | Vertical only | Horizontal + vertical |
| **OpenAI-Compatible API** | No | Yes (standard compliance) |

### Performance Metrics (Typical)
- **Throughput increase**: 2-5x more tokens/sec
- **Latency reduction**: 30-50% lower response times
- **Memory overhead**: 2-3GB base + model
- **GPU memory**: ~50-80% lower fragmentation

---

## Migration Requirements

### 1. **Direct Replacements** (Low Risk)

These services can be migrated with minimal code changes:

#### a) RAG Service Embeddings
```python
# Current (Ollama)
from langchain_community.embeddings import OllamaEmbeddings
embeddings = OllamaEmbeddings(model="nomic-embed-text", base_url="http://ollama:11434")

# New (vLLM)
from langchain.embeddings import HuggingFaceEmbeddings
embeddings = HuggingFaceEmbeddings(model_name="nomic-embed-text", encode_kwargs={"normalize_embeddings": True})
# OR (if keeping API compatibility)
from langchain.embeddings.openai import OpenAIEmbeddings
embeddings = OpenAIEmbeddings(model="nomic-embed-text", openai_api_base="http://vllm:8000/v1", openai_api_key="na")
```

#### b) RAG Service LLM
```python
# Current (Ollama)
from langchain_community.llms import Ollama
llm = Ollama(model="llama3.2", base_url="http://ollama:11434")

# New (vLLM - OpenAI compatible)
from langchain.llms.openai import OpenAI
llm = OpenAI(
    model_name="llama3.2",
    openai_api_base="http://vllm:8000/v1",
    openai_api_key="sk-vllm",
    temperature=0.7
)
```

#### c) Direct REST Calls
```python
# Current (Ollama)
response = requests.post("http://ollama:11434/api/generate", json={
    "model": "llama3.2",
    "prompt": "...",
    "stream": False
})

# New (vLLM - OpenAI compatible)
import openai
response = openai.ChatCompletion.create(
    model="llama3.2",
    messages=[{"role": "user", "content": "..."}],
    api_base="http://vllm:8000/v1",
    api_key="sk-vllm"
)
```

### 2. **More Complex Services** (Medium Risk)

#### Notes Service
- Switch from direct Ollama SDK to OpenAI SDK
- ~20 lines of code change

#### Doc-Processor (Vision)
- Ollama's `llava:7b` → vLLM's `llava-1.6-34b-hf`
- Better OCR performance but requires more VRAM
- Alternative: Keep Ollama for vision-only, migrate text to vLLM

---

## Detailed Migration Plan

### Phase 1: Infrastructure Setup (2-3 hours)

#### Step 1.1: Docker Compose Changes
Add vLLM service alongside Ollama (for gradual migration):

```yaml
vllm:
  image: vllm/vllm-openai:latest
  container_name: rma-vllm
  ports:
    - "8000:8000"
  environment:
    - VLLM_API_KEY=sk-vllm
    - VLLM_PORT=8000
    - VLLM_SERVED_MODEL_NAME=llama3.2
  volumes:
    - vllm_data:/root/.cache
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
  restart: unless-stopped
```

#### Step 1.2: Model Downloads
vLLM uses Hugging Face format. Ensure models are available:
```bash
# Pull models into vLLM's cache
docker exec rma-vllm python -m vllm.entrypoints.openai.api_server \
  --model NousResearch/Hermes-2-Theta-Llama-3-8B \
  --port 8000
```

### Phase 2: Code Migration (4-6 hours)

#### Step 2.1: Update Dependencies
```txt
# Remove
ollama==0.4.4

# Add
openai>=1.0.0
langchain>=0.3.0
requests>=2.31.0
python-dotenv>=1.0.0
```

#### Step 2.2: Environment Variables
```bash
# .env or docker-compose environment
OLLAMA_URL=http://ollama:11434          # Keep for backward compatibility
VLLM_URL=http://vllm:8000                # New vLLM endpoint
VLLM_API_KEY=sk-vllm                     # Simple key for testing
LLM_PROVIDER=vllm                         # Switch: "ollama" or "vllm"
```

#### Step 2.3: Service-by-Service Migration

**RAG Service (`app.py`)**
```python
# 1. Update imports
from openai import OpenAI  # Replace Ollama imports
from langchain.embeddings.openai import OpenAIEmbeddings

# 2. Initialize
vllm_client = OpenAI(
    api_key=os.getenv("VLLM_API_KEY", "sk-vllm"),
    base_url=os.getenv("VLLM_URL", "http://vllm:8000/v1")
)

embeddings = OpenAIEmbeddings(
    model="nomic-embed-text",
    openai_api_base=os.getenv("VLLM_URL", "http://vllm:8000/v1"),
    openai_api_key=os.getenv("VLLM_API_KEY", "sk-vllm")
)

# 3. Replace Ollama calls
# Old: ollama.invoke(prompt)
# New:
response = vllm_client.chat.completions.create(
    model="llama3.2",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.7,
    max_tokens=1000
)
result = response.choices[0].message.content
```

**Notes Service**
```python
# Similar pattern - use OpenAI SDK instead of Ollama SDK
```

**Doc-Processor (Keep Ollama for Vision)**
```python
# Option 1: Keep Ollama for vision, use vLLM for text
# Option 2: Use vLLM for both (if VRAM allows)
# Recommendation: Option 1 for now (easier transition)
```

### Phase 3: Testing & Validation (3-4 hours)

#### Step 3.1: Unit Tests
- Test each service independently
- Mock vLLM endpoint for CI/CD

#### Step 3.2: Integration Tests
- Test full RAG pipeline
- Test document processing
- Test notes service

#### Step 3.3: Performance Benchmarks
```python
# Benchmark script
import time
from openai import OpenAI

client = OpenAI(api_key="sk-vllm", base_url="http://localhost:8000/v1")

# Throughput test
start = time.time()
for i in range(10):
    response = client.chat.completions.create(
        model="llama3.2",
        messages=[{"role": "user", "content": f"Test {i}"}],
        max_tokens=100
    )
throughput = 10 / (time.time() - start)
print(f"Throughput: {throughput:.2f} req/sec")

# Latency test
latencies = []
for i in range(50):
    start = time.time()
    response = client.chat.completions.create(
        model="llama3.2",
        messages=[{"role": "user", "content": "Quick test"}],
        max_tokens=50
    )
    latencies.append(time.time() - start)
print(f"Avg latency: {sum(latencies)/len(latencies)*1000:.0f}ms")
print(f"p99 latency: {sorted(latencies)[int(len(latencies)*0.99)]*1000:.0f}ms")
```

### Phase 4: Gradual Rollout (1-2 weeks)

#### Week 1
- Deploy vLLM container alongside Ollama
- Update RAG service to use vLLM
- Monitor performance and errors

#### Week 2
- Update notes service
- Update doc-processor (text component)
- Run A/B tests

#### Week 3
- Deprecate Ollama (or keep for vision)
- Optimize vLLM settings
- Fine-tune performance

---

## Implementation Comparison

### Minimal Migration (Backward Compatible)

Keep Ollama, add vLLM as optional:
```python
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")

if LLM_PROVIDER == "vllm":
    llm = OpenAI(api_key="sk-vllm", base_url="http://vllm:8000/v1")
else:
    from langchain_community.llms import Ollama
    llm = Ollama(model="llama3.2", base_url="http://ollama:11434")
```

### Complete Migration

Remove Ollama entirely, use vLLM:
- Simpler deployment
- Better resource utilization
- Standard OpenAI API

---

## Performance Expectations

### Before (Ollama)
- **Concurrent requests**: 1 at a time (sequential)
- **Throughput**: ~20-30 tokens/sec
- **Response time**: 2-5 seconds
- **GPU Utilization**: 40-50%

### After (vLLM)
- **Concurrent requests**: 5-10+ simultaneous
- **Throughput**: ~100-150 tokens/sec (3-5x improvement)
- **Response time**: 0.5-2 seconds
- **GPU Utilization**: 75-85%

### Example: Processing 100 Questions
- **Ollama**: 100 * 3.5sec = 350 seconds (5.8 minutes)
- **vLLM**: With batching, ~30-60 seconds (5-10x faster)

---

## Vision Model Considerations

### Ollama llava:7b
- Works but slower
- Limited VRAM (fits on most GPUs)
- Already in RMA-Demo

### vLLM Vision Options
1. **llava-1.6-34b-hf** (High quality)
   - Better OCR
   - Requires 24GB+ VRAM
   - 2-3x faster than Ollama

2. **llava-1.6-7b-hf** (Balanced)
   - Similar to Ollama quality
   - Fits on 8GB VRAM
   - 1.5x faster

3. **Keep Ollama for vision only**
   - Recommendation: Start here
   - Allows incremental migration
   - Less VRAM pressure

---

## Configuration Examples

### Docker Compose (vLLM with Ollama)
```yaml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: rma-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1  # Allocate 1 GPU for Ollama
              capabilities: [gpu]
    restart: unless-stopped

  vllm:
    image: vllm/vllm-openai:latest
    container_name: rma-vllm
    ports:
      - "8000:8000"
    environment:
      VLLM_API_KEY: sk-vllm
    volumes:
      - vllm_data:/root/.cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1  # Allocate 1 GPU for vLLM
              capabilities: [gpu]
    restart: unless-stopped

  rag-service:
    build:
      context: ./services/rag-service
    container_name: rma-rag-service
    ports:
      - "8102:8102"
    environment:
      - VLLM_URL=http://vllm:8000
      - VLLM_API_KEY=sk-vllm
      - LLM_PROVIDER=vllm
    depends_on:
      - vllm
      - chromadb
```

### .env
```bash
# LLM Configuration
LLM_PROVIDER=vllm
VLLM_URL=http://vllm:8000
VLLM_API_KEY=sk-vllm
VLLM_MODEL=llama3.2

# Fallback to Ollama if vLLM unavailable
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2

# Document Processing
OCR_PROVIDER=ollama  # Keep vision on Ollama
OLLAMA_VISION_MODEL=llava:7b
```

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Model compatibility** | API differences | Use OpenAI SDK (standard) |
| **VRAM exhaustion** | OOM crashes | Profile memory, limit batch size |
| **Dependency changes** | Breaking updates | Pin versions in requirements.txt |
| **Vision model quality** | OCR degradation | Keep Ollama vision for now |
| **Rollback complexity** | Production outage | Run both in parallel initially |
| **Performance regression** | Slower responses | Benchmark before/after carefully |

---

## Rollback Plan

If vLLM migration causes issues:

```yaml
# Switch back to Ollama (environment variable)
LLM_PROVIDER: ollama
```

Since the code is abstracted with a provider selector, switching takes seconds.

---

## Estimated Effort & Timeline

| Phase | Task | Hours | Risk |
|-------|------|-------|------|
| 1 | Infrastructure setup | 2-3 | Low |
| 2 | Code migration | 4-6 | Medium |
| 3 | Testing & benchmarking | 3-4 | Low |
| 4 | Gradual rollout | 5-7 | Medium |
| **Total** | | **15-20 hours** | |

### Timeline
- **Day 1**: Infrastructure + basic migration
- **Days 2-3**: Service updates + testing
- **Days 4-7**: Gradual rollout with monitoring

---

## Recommendations

### ✅ Proceed with Migration If:
1. You have 2+ GPUs (one for vLLM, one for other services)
2. Need better throughput/latency for production
3. Plan to scale to multiple requests concurrently
4. Want standard OpenAI-compatible API

### ⚠️ Consider Waiting If:
1. Single GPU with tight VRAM
2. Current performance is sufficient
3. Team unfamiliar with vLLM

### 🎯 Recommended Approach (Staged):
1. **Phase 1**: Deploy vLLM alongside Ollama
2. **Phase 2**: Migrate RAG service (text generation only)
3. **Phase 3**: Keep Ollama for vision (llava:7b)
4. **Phase 4**: Once stable, migrate remaining services
5. **Phase 5**: Evaluate complete Ollama removal

---

## Next Steps

1. **Approve migration strategy** (this document)
2. **Create branch**: `feature/vllm-migration`
3. **Setup dev environment** with vLLM container
4. **Implement Phase 1-2** (infrastructure + RAG service)
5. **Benchmark performance** improvements
6. **Schedule rollout** with team

---

## References

- [vLLM Documentation](https://docs.vllm.ai/)
- [vLLM vs Ollama Comparison](https://github.com/vllm-project/vllm/discussions)
- [OpenAI API Compatibility](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html)
- [Performance Tuning Guide](https://docs.vllm.ai/en/latest/serving/performance_tips.html)

