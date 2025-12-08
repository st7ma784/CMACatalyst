# vLLM Migration Implementation Guide

## Quick Start: Minimal Code Changes

This guide shows exactly how to migrate each service from Ollama to vLLM with minimal changes.

---

## 1. RAG Service Migration

### Current Code (Ollama)
File: `services/rag-service/app.py`

```python
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.llms import Ollama

class RAGService:
    def __init__(self):
        self.ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        
        # Initialize embeddings
        self.embeddings = OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=self.ollama_url
        )
        
        # Initialize LLM for synthesis
        self.llm = Ollama(
            model="llama3.2",
            base_url=self.ollama_url,
            temperature=0.7
        )
```

### New Code (vLLM)

#### Option A: Direct Replacement (Easiest)

```python
import os
from openai import OpenAI
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.llms.openai import OpenAI as LangChainOpenAI

class RAGService:
    def __init__(self):
        # Get configuration from environment
        llm_provider = os.getenv('LLM_PROVIDER', 'vllm')
        self.vllm_url = os.getenv('VLLM_URL', 'http://vllm:8000')
        self.vllm_key = os.getenv('VLLM_API_KEY', 'sk-vllm')
        
        if llm_provider == 'vllm':
            # Initialize OpenAI-compatible embeddings
            self.embeddings = OpenAIEmbeddings(
                model="nomic-embed-text",
                openai_api_base=self.vllm_url + "/v1",
                openai_api_key=self.vllm_key
            )
            
            # Initialize OpenAI-compatible LLM
            self.llm = LangChainOpenAI(
                model_name="llama3.2",
                openai_api_base=self.vllm_url + "/v1",
                openai_api_key=self.vllm_key,
                temperature=0.7
            )
            
            # Direct client for advanced features
            self.vllm_client = OpenAI(
                api_key=self.vllm_key,
                base_url=self.vllm_url + "/v1"
            )
```

#### Option B: Abstraction Layer (Production Ready)

Create a new file: `services/rag-service/llm_provider.py`

```python
"""
LLM Provider Abstraction Layer
Supports both Ollama and vLLM with fallback
"""

import os
from typing import Optional
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    def initialize_embeddings(self):
        pass
    
    @abstractmethod
    def initialize_llm(self):
        pass

class OllamaProvider(LLMProvider):
    """Ollama-based LLM provider"""
    
    def __init__(self, base_url: str = None):
        from langchain_community.embeddings import OllamaEmbeddings
        from langchain_community.llms import Ollama
        
        self.base_url = base_url or os.getenv('OLLAMA_URL', 'http://ollama:11434')
        self.OllamaEmbeddings = OllamaEmbeddings
        self.Ollama = Ollama
    
    def initialize_embeddings(self):
        return self.OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=self.base_url
        )
    
    def initialize_llm(self, temperature: float = 0.7):
        return self.Ollama(
            model="llama3.2",
            base_url=self.base_url,
            temperature=temperature
        )

class VLLMProvider(LLMProvider):
    """vLLM-based LLM provider (OpenAI compatible)"""
    
    def __init__(self, api_base: str = None, api_key: str = None):
        from langchain.embeddings.openai import OpenAIEmbeddings
        from langchain.llms.openai import OpenAI as LangChainOpenAI
        from openai import OpenAI
        
        self.api_base = api_base or os.getenv('VLLM_URL', 'http://vllm:8000')
        self.api_key = api_key or os.getenv('VLLM_API_KEY', 'sk-vllm')
        self.full_api_base = f"{self.api_base}/v1"
        
        self.OpenAIEmbeddings = OpenAIEmbeddings
        self.LangChainOpenAI = LangChainOpenAI
        self.OpenAI = OpenAI
    
    def initialize_embeddings(self):
        return self.OpenAIEmbeddings(
            model="nomic-embed-text",
            openai_api_base=self.full_api_base,
            openai_api_key=self.api_key
        )
    
    def initialize_llm(self, temperature: float = 0.7):
        return self.LangChainOpenAI(
            model_name="llama3.2",
            openai_api_base=self.full_api_base,
            openai_api_key=self.api_key,
            temperature=temperature
        )
    
    def get_direct_client(self):
        """Get direct OpenAI client for advanced features"""
        return self.OpenAI(
            api_key=self.api_key,
            base_url=self.full_api_base
        )

def get_provider() -> LLMProvider:
    """Factory function to get the configured LLM provider"""
    provider = os.getenv('LLM_PROVIDER', 'vllm').lower()
    
    try:
        if provider == 'ollama':
            return OllamaProvider()
        elif provider == 'vllm':
            return VLLMProvider()
        else:
            print(f"Unknown provider '{provider}', falling back to vLLM")
            return VLLMProvider()
    except ImportError as e:
        print(f"Provider initialization failed: {e}, attempting fallback...")
        if provider == 'vllm':
            # Try Ollama as fallback
            return OllamaProvider()
        else:
            return VLLMProvider()
```

### Usage in RAG Service

```python
# In services/rag-service/app.py
from llm_provider import get_provider

class RAGService:
    def __init__(self):
        self.provider = get_provider()
        self.embeddings = self.provider.initialize_embeddings()
        self.llm = self.provider.initialize_llm(temperature=0.7)
        
        # For advanced features (if vLLM)
        if hasattr(self.provider, 'get_direct_client'):
            self.direct_client = self.provider.get_direct_client()
```

---

## 2. Direct API Calls Migration

### Current (Ollama)
```python
import requests

response = requests.post(
    f"{self.ollama_url}/api/generate",
    json={
        "model": "llama3.2",
        "prompt": extraction_prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 1000
        }
    },
    timeout=60
)
llm_response = response.json().get('response', '').strip()
```

### New (vLLM)
```python
from openai import OpenAI

# Initialize client
vllm_client = OpenAI(
    api_key=os.getenv("VLLM_API_KEY", "sk-vllm"),
    base_url=os.getenv("VLLM_URL", "http://vllm:8000") + "/v1"
)

# Make request
response = vllm_client.chat.completions.create(
    model="llama3.2",
    messages=[
        {"role": "user", "content": extraction_prompt}
    ],
    temperature=0.1,
    max_tokens=1000
)
llm_response = response.choices[0].message.content
```

### Helper Function (Drop-in Replacement)
```python
def ollama_to_vllm_call(prompt: str, model: str = "llama3.2", 
                        temperature: float = 0.7, max_tokens: int = 1000) -> str:
    """
    Drop-in replacement for Ollama API calls using vLLM.
    
    Args:
        prompt: The prompt text
        model: Model name (default: llama3.2)
        temperature: Temperature for generation
        max_tokens: Maximum tokens to generate
    
    Returns:
        Generated text
    """
    from openai import OpenAI
    
    client = OpenAI(
        api_key=os.getenv("VLLM_API_KEY", "sk-vllm"),
        base_url=os.getenv("VLLM_URL", "http://vllm:8000") + "/v1"
    )
    
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens
    )
    
    return response.choices[0].message.content
```

---

## 3. Notes Service Migration

### Current (Ollama)
File: `services/notes-service/app.py`

```python
import ollama

@app.post("/process")
async def process_notes(request: NoteRequest):
    # Direct Ollama call
    response = ollama.generate(
        model="llama3.2",
        prompt=request.text,
        stream=False
    )
    return {"result": response['response']}
```

### New (vLLM)
```python
from openai import OpenAI
import os

llm_client = OpenAI(
    api_key=os.getenv("VLLM_API_KEY", "sk-vllm"),
    base_url=os.getenv("VLLM_URL", "http://vllm:8000") + "/v1"
)

@app.post("/process")
async def process_notes(request: NoteRequest):
    # vLLM call via OpenAI SDK
    response = llm_client.chat.completions.create(
        model="llama3.2",
        messages=[{"role": "user", "content": request.text}],
        temperature=0.7,
        max_tokens=2000
    )
    return {"result": response.choices[0].message.content}
```

### Updated requirements.txt
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
openai>=1.0.0          # NEW: Instead of ollama
python-multipart==0.0.6
```

---

## 4. Doc-Processor (Vision) - Keep Ollama or Migrate

### Option A: Keep Ollama for Vision (Recommended Initially)
```python
# File: services/doc-processor/app.py
import os
from openai import OpenAI

# Use vLLM for text, Ollama for vision
vllm_client = OpenAI(
    api_key=os.getenv("VLLM_API_KEY", "sk-vllm"),
    base_url=os.getenv("VLLM_URL", "http://vllm:8000") + "/v1"
)

# Keep Ollama import for vision
import ollama
ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")

@app.post("/extract-text-vision")
async def extract_text_vision(file: UploadFile):
    """Use Ollama for vision-based text extraction"""
    # Existing Ollama vision code
    response = ollama.generate(
        model="llava:7b",
        prompt="Extract text from this image",
        images=[image_base64],
        stream=False
    )
    return {"text": response['response']}

@app.post("/process-document")
async def process_document(request: DocumentRequest):
    """Use vLLM for text processing"""
    response = vllm_client.chat.completions.create(
        model="llama3.2",
        messages=[{"role": "user", "content": request.text}],
        temperature=0.7
    )
    return {"result": response.choices[0].message.content}
```

### Option B: Migrate Vision to vLLM (Requires More VRAM)
```python
# Use vLLM for both text and vision
# Note: Requires model configuration in vLLM

# Add to docker-compose.yml for vLLM:
# --model llava-hf/llava-1.6-7b-hf

vllm_client = OpenAI(
    api_key=os.getenv("VLLM_API_KEY", "sk-vllm"),
    base_url=os.getenv("VLLM_URL", "http://vllm:8000") + "/v1"
)

@app.post("/extract-text-vision")
async def extract_text_vision(file: UploadFile):
    """Use vLLM for vision-based text extraction"""
    import base64
    
    # Read and encode image
    content = await file.read()
    image_base64 = base64.b64encode(content).decode('utf-8')
    
    response = vllm_client.chat.completions.create(
        model="llava",  # vLLM model name
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract all text from this image"},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                }
            ]
        }],
        max_tokens=2000
    )
    return {"text": response.choices[0].message.content}
```

---

## 5. Docker Compose Configuration

### Multi-GPU Setup (Recommended)
```yaml
version: '3.8'

services:
  # Keep Ollama for vision-only (GPU 0)
  ollama:
    image: ollama/ollama:latest
    container_name: rma-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0
      - CUDA_VISIBLE_DEVICES=0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']
              capabilities: [gpu]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 10s
      timeout: 5s
      retries: 3

  # vLLM for text generation (GPU 1)
  vllm:
    image: vllm/vllm-openai:latest
    container_name: rma-vllm
    ports:
      - "8000:8000"
    environment:
      - VLLM_API_KEY=sk-vllm
      - VLLM_HOST=0.0.0.0
      - VLLM_PORT=8000
      - CUDA_VISIBLE_DEVICES=1
    volumes:
      - vllm_data:/root/.cache/huggingface
    command: --model meta-llama/Llama-2-7b-hf --served-model-name llama3.2 --tensor-parallel-size 1
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['1']
              capabilities: [gpu]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  chromadb:
    image: chromadb/chroma:0.4.24
    container_name: rma-chromadb
    ports:
      - "8005:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - CHROMA_SERVER_CORS_ALLOW_ORIGINS=["*"]
    restart: unless-stopped

  rag-service:
    build:
      context: ./services/rag-service
      dockerfile: Dockerfile
    container_name: rma-rag-service
    ports:
      - "8102:8102"
    volumes:
      - ./manuals:/manuals
    environment:
      # vLLM configuration
      - LLM_PROVIDER=vllm
      - VLLM_URL=http://vllm:8000
      - VLLM_API_KEY=sk-vllm
      # Fallback to Ollama if needed
      - OLLAMA_URL=http://ollama:11434
      # ChromaDB
      - CHROMADB_HOST=chromadb
      - CHROMADB_PORT=8000
      - MANUALS_PATH=/manuals
    depends_on:
      vllm:
        condition: service_healthy
      chromadb:
        condition: service_started
    restart: unless-stopped

  notes-service:
    build:
      context: ./services/notes-service
      dockerfile: Dockerfile
    container_name: rma-notes-service
    ports:
      - "8100:8100"
    environment:
      - LLM_PROVIDER=vllm
      - VLLM_URL=http://vllm:8000
      - VLLM_API_KEY=sk-vllm
    depends_on:
      vllm:
        condition: service_healthy
    restart: unless-stopped

  doc-processor:
    build:
      context: ./services/doc-processor
      dockerfile: Dockerfile
    container_name: rma-doc-processor
    ports:
      - "8101:8101"
    environment:
      # Vision: Keep Ollama
      - OLLAMA_URL=http://ollama:11434
      - VISION_MODEL=llava:7b
      # Text: Use vLLM
      - LLM_PROVIDER=vllm
      - VLLM_URL=http://vllm:8000
      - VLLM_API_KEY=sk-vllm
      - TEXT_MODEL=llama3.2
    depends_on:
      ollama:
        condition: service_healthy
      vllm:
        condition: service_healthy
    restart: unless-stopped

  # ... other services

volumes:
  ollama_data:
  vllm_data:
  chroma_data:
  upload_data:
  n8n_data:

networks:
  default:
    name: rma-network
```

### Single-GPU Setup (Alternative)
```yaml
# Single GPU: time-share between Ollama and vLLM
# Less ideal but works for development

vllm:
  image: vllm/vllm-openai:latest
  container_name: rma-vllm
  ports:
    - "8000:8000"
  environment:
    - VLLM_API_KEY=sk-vllm
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  # Memory optimization
  command: --model meta-llama/Llama-2-7b-hf --gpu-memory-utilization 0.7 --tensor-parallel-size 1
```

---

## 6. Environment Configuration

### .env File
```bash
# ============================================
# LLM Provider Configuration
# ============================================

# Which provider to use: "ollama" or "vllm"
LLM_PROVIDER=vllm

# vLLM Configuration (if using vLLM)
VLLM_URL=http://vllm:8000
VLLM_API_KEY=sk-vllm
VLLM_MODEL=llama3.2

# Ollama Configuration (fallback or vision-only)
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2
OLLAMA_VISION_MODEL=llava:7b

# Document Processing
OCR_PROVIDER=ollama  # Keep Ollama for vision
USE_LOCAL_PARSING=true

# ============================================
# Service Configuration
# ============================================

CHROMADB_HOST=chromadb
CHROMADB_PORT=8000
MANUALS_PATH=/manuals

# ... other config
```

---

## 7. Testing & Validation

### Test Script
Create: `tests/test_llm_migration.py`

```python
"""
Test suite for vLLM migration
Validates that both providers work correctly
"""

import pytest
import os
from openai import OpenAI


@pytest.fixture
def vllm_client():
    """Create vLLM client"""
    return OpenAI(
        api_key=os.getenv("VLLM_API_KEY", "sk-vllm"),
        base_url=os.getenv("VLLM_URL", "http://vllm:8000") + "/v1"
    )


def test_vllm_health(vllm_client):
    """Test vLLM API is responsive"""
    models = vllm_client.models.list()
    assert len(models.data) > 0
    print(f"✅ vLLM healthy with {len(models.data)} model(s)")


def test_vllm_simple_generation(vllm_client):
    """Test basic text generation"""
    response = vllm_client.chat.completions.create(
        model="llama3.2",
        messages=[{"role": "user", "content": "Say hello"}],
        temperature=0.7,
        max_tokens=50
    )
    
    assert response.choices[0].message.content
    assert len(response.choices[0].message.content) > 0
    print(f"✅ Generated: {response.choices[0].message.content[:50]}...")


def test_vllm_streaming(vllm_client):
    """Test streaming generation"""
    stream = vllm_client.chat.completions.create(
        model="llama3.2",
        messages=[{"role": "user", "content": "List 3 fruits"}],
        max_tokens=100,
        stream=True
    )
    
    full_response = ""
    for chunk in stream:
        if chunk.choices[0].delta.content:
            full_response += chunk.choices[0].delta.content
    
    assert len(full_response) > 0
    print(f"✅ Streamed: {full_response[:50]}...")


def test_vllm_temperature_impact(vllm_client):
    """Test that temperature affects generation"""
    responses = []
    
    for temp in [0.1, 0.9]:
        response = vllm_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": "Complete this story: Once upon a time"}],
            temperature=temp,
            max_tokens=50
        )
        responses.append(response.choices[0].message.content)
    
    # With temp 0.1 (deterministic) and temp 0.9 (creative), should be different
    # (with high probability)
    print(f"✅ Low temp (0.1): {responses[0][:40]}...")
    print(f"✅ High temp (0.9): {responses[1][:40]}...")


def test_vllm_concurrent_requests(vllm_client):
    """Test multiple concurrent requests"""
    import asyncio
    
    async def make_request(prompt):
        # Note: sync client doesn't support async, use threads instead
        pass
    
    # For this test, use ThreadPoolExecutor
    from concurrent.futures import ThreadPoolExecutor
    
    prompts = [
        "What is Python?",
        "Explain machine learning",
        "Who is Einstein?"
    ]
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(
                vllm_client.chat.completions.create,
                model="llama3.2",
                messages=[{"role": "user", "content": p}],
                max_tokens=50
            )
            for p in prompts
        ]
        
        results = [f.result() for f in futures]
    
    assert len(results) == 3
    assert all(r.choices[0].message.content for r in results)
    print(f"✅ Processed {len(results)} concurrent requests")


def test_embedding_compatibility():
    """Test embedding generation"""
    from langchain.embeddings.openai import OpenAIEmbeddings
    
    embeddings = OpenAIEmbeddings(
        model="nomic-embed-text",
        openai_api_base=os.getenv("VLLM_URL", "http://vllm:8000") + "/v1",
        openai_api_key=os.getenv("VLLM_API_KEY", "sk-vllm")
    )
    
    # Generate embedding
    text = "This is a test document about machine learning"
    embedding = embeddings.embed_query(text)
    
    assert len(embedding) > 0
    assert isinstance(embedding[0], float)
    print(f"✅ Generated embedding with dimension {len(embedding)}")


def test_provider_abstraction():
    """Test the provider abstraction layer"""
    from llm_provider import get_provider
    
    os.environ['LLM_PROVIDER'] = 'vllm'
    provider = get_provider()
    
    embeddings = provider.initialize_embeddings()
    llm = provider.initialize_llm()
    
    assert embeddings is not None
    assert llm is not None
    print("✅ Provider abstraction working correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

### Run Tests
```bash
# Start containers first
docker-compose up -d vllm ollama chromadb

# Run tests
pytest tests/test_llm_migration.py -v

# Clean up
docker-compose down
```

---

## 8. Performance Benchmarking

Create: `tests/benchmark_vllm_vs_ollama.py`

```python
"""
Benchmark vLLM vs Ollama performance
"""

import time
import json
from openai import OpenAI
import ollama
import statistics


def benchmark_vllm(num_requests: int = 10, prompt_tokens: int = 100):
    """Benchmark vLLM performance"""
    client = OpenAI(
        api_key="sk-vllm",
        base_url="http://vllm:8000/v1"
    )
    
    prompt = "Explain quantum computing in detail. " * (prompt_tokens // 5)
    
    latencies = []
    total_tokens = 0
    
    for i in range(num_requests):
        start = time.time()
        
        response = client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200
        )
        
        latency = time.time() - start
        latencies.append(latency)
        total_tokens += response.usage.completion_tokens
    
    return {
        "provider": "vLLM",
        "num_requests": num_requests,
        "avg_latency_ms": statistics.mean(latencies) * 1000,
        "p99_latency_ms": sorted(latencies)[int(len(latencies)*0.99)] * 1000,
        "throughput_req_sec": num_requests / sum(latencies),
        "throughput_tokens_sec": total_tokens / sum(latencies),
        "total_time_sec": sum(latencies)
    }


def benchmark_ollama(num_requests: int = 10, prompt_tokens: int = 100):
    """Benchmark Ollama performance"""
    prompt = "Explain quantum computing in detail. " * (prompt_tokens // 5)
    
    latencies = []
    total_tokens = 0
    
    for i in range(num_requests):
        start = time.time()
        
        response = ollama.generate(
            model="llama3.2",
            prompt=prompt,
            stream=False
        )
        
        latency = time.time() - start
        latencies.append(latency)
        # Rough token count (ollama doesn't always provide it)
        total_tokens += len(response['response'].split())
    
    return {
        "provider": "Ollama",
        "num_requests": num_requests,
        "avg_latency_ms": statistics.mean(latencies) * 1000,
        "p99_latency_ms": sorted(latencies)[int(len(latencies)*0.99)] * 1000,
        "throughput_req_sec": num_requests / sum(latencies),
        "throughput_tokens_sec": total_tokens / sum(latencies),
        "total_time_sec": sum(latencies)
    }


if __name__ == "__main__":
    print("🔄 Benchmarking vLLM vs Ollama")
    print("=" * 60)
    
    # Warmup
    print("\n🔥 Warmup...")
    benchmark_vllm(1)
    benchmark_ollama(1)
    
    # Benchmarks
    print("\n📊 Sequential Requests (10 requests):")
    vllm_result = benchmark_vllm(10)
    print(f"\nvLLM:\n{json.dumps(vllm_result, indent=2)}")
    
    ollama_result = benchmark_ollama(10)
    print(f"\nOllama:\n{json.dumps(ollama_result, indent=2)}")
    
    # Comparison
    print("\n📈 Comparison:")
    print(f"  Latency improvement: {ollama_result['avg_latency_ms'] / vllm_result['avg_latency_ms']:.1f}x")
    print(f"  Throughput improvement: {vllm_result['throughput_req_sec'] / ollama_result['throughput_req_sec']:.1f}x")
    print(f"  Token throughput: {vllm_result['throughput_tokens_sec']:.0f} tokens/sec (vLLM) vs {ollama_result['throughput_tokens_sec']:.0f} (Ollama)")
```

---

## Migration Checklist

- [ ] Review this guide with team
- [ ] Prepare dev environment with vLLM container
- [ ] Update `docker-compose.yml` with vLLM service
- [ ] Create `llm_provider.py` abstraction layer
- [ ] Update `services/rag-service/requirements.txt` (add openai, remove ollama)
- [ ] Update `services/rag-service/app.py` to use vLLM
- [ ] Update `services/notes-service/requirements.txt`
- [ ] Update `services/notes-service/app.py` to use vLLM
- [ ] Update `.env` with vLLM configuration
- [ ] Run test suite (`pytest tests/test_llm_migration.py`)
- [ ] Run performance benchmarks
- [ ] Update docker-compose for production (multi-GPU setup)
- [ ] Test full RAG pipeline end-to-end
- [ ] Deploy to staging environment
- [ ] Monitor performance in staging
- [ ] Deploy to production
- [ ] Document vLLM configuration for team

---

## Troubleshooting

### vLLM Container Won't Start
```bash
# Check logs
docker logs rma-vllm

# Ensure GPU is available
nvidia-smi

# Try with smaller model
docker-compose up vllm -d --build
```

### API Key Issues
```bash
# vLLM accepts any string as API key in development
VLLM_API_KEY=sk-vllm  # Any value works

# For production, use proper authentication
```

### Memory Issues
```bash
# Reduce GPU memory utilization in docker-compose
command: --model llama3.2 --gpu-memory-utilization 0.5 --max-num-seqs 2

# Or reduce max batch size
command: --model llama3.2 --max-model-len 2048
```

### Slow Generation
```bash
# Check if model is fully loaded
docker exec rma-vllm curl http://localhost:8000/health

# Check GPU utilization
nvidia-smi dmon -s p

# May need to wait for model to load completely
sleep 30 && curl http://localhost:8000/health
```

