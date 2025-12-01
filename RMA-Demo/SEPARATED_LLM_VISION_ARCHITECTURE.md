# 🏗️ Separated LLM & Vision Architecture (Phase 1)

**Objective**: Separate vision/OCR models from language models to enable independent scaling and optimization.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (3000)                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
    ┌───────▼────────┐          ┌────────▼──────────┐
    │  RAG Service   │          │  Notes Service    │
    │    (8102)      │          │     (8100)        │
    └────────┬───────┘          └────────┬──────────┘
             │                            │
             └────────────┬───────────────┘
                          │
            ┌─────────────▼──────────────┐
            │   OLLAMA (LLM)             │
            │   Port: 11434              │
            │   Models:                  │
            │   - llama3.2:latest        │
            │   - llama2:7b              │
            │   Use: RAG, Chat, NER      │
            └────────────────────────────┘


    ┌─────────────────────────────────────┐
    │  Doc Processor (8101)               │
    │  OCR Service (8104)                 │
    │  Client RAG (8105)                  │
    └─────────────────┬───────────────────┘
                      │
         ┌────────────▼──────────────────┐
         │  OLLAMA VISION (VLM/OCR)      │
         │  Port: 11435                  │
         │  Models:                      │
         │  - llava:7b (Vision)          │
         │  - ollama-ocr (Future)        │
         │  Use: Document parsing, OCR   │
         └───────────────────────────────┘

Graph Database Layer:
┌─────────────┬──────────────────┬──────────────┐
│  Neo4j      │  PostgreSQL      │  ChromaDB    │
│  (7687)     │  (5432)          │  (8005)      │
│  Graph DB   │  Relational DB   │  Vector DB   │
└─────────────┴──────────────────┴──────────────┘
```

## Phase 1: Separation (Current)

### Benefits
✅ Independent scaling (vision separate from LLM)
✅ Ollama vision can handle multiple parallel requests
✅ LLM Ollama optimized for text-only workloads
✅ Clear resource allocation
✅ Foundation for Phase 2 (vLLM)

### Services Configuration

**Ollama (LLM)** - Port 11434
- Models: llama3.2:latest, llama2:7b
- Services: RAG, Notes, NER Graph
- CPU/Memory optimized for text generation

**Ollama Vision** - Port 11435
- Models: llava:7b (and future: ollama-ocr)
- Services: OCR Service, Doc Processor, Client RAG
- Optimized for vision inference

## Phase 2: vLLM Optimization (Future)

Replace Ollama LLM with vLLM for:
- Faster inference (KV cache optimization)
- Better batching
- Token streaming
- Lower latency for chatbot

Vision stays with Ollama or upgrades to specialized VLM server.

## Implementation Steps

1. **Create Vision Ollama Service**
   - New `ollama-entrypoint-vision.sh` for vision models
   - Port 11435
   - Auto-pull llava:7b

2. **Update Main Ollama**
   - Remove vision models from main Ollama
   - Keep llama3.2, llama2

3. **Update Services**
   - Doc Processor: `VISION_OLLAMA_URL=http://ollama-vision:11435`
   - OCR Service: `VISION_OLLAMA_URL=http://ollama-vision:11435`
   - Client RAG: Option to use vision models

4. **Update docker-compose-simple.yml**
   - Two Ollama services with different ports
   - Health checks for each
   - Proper dependencies

## Environment Variables

### LLM Ollama (11434)
```
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:latest
```

### Vision Ollama (11435)
```
VISION_OLLAMA_URL=http://ollama-vision:11435
VISION_MODEL=llava:7b
```

## Next Steps After Separation

- Profile resource usage
- Monitor inference times
- Prepare vLLM containers
- Benchmark vLLM vs Ollama for language tasks
- Consider ollama-ocr or similar for vision optimization
