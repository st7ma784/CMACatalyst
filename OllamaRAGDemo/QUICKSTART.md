# Quick Start: Enhanced RAG with LLaVA Vision

## 🚀 5-Minute Setup

### 1. Start Shared Ollama (if not running)

```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project
docker-compose -f docker-compose.ollama.yml up -d
```

### 2. Pull LLaVA Model

```bash
docker exec shared-ollama-service ollama pull llava:7b
docker exec shared-ollama-service ollama pull llama2
docker exec shared-ollama-service ollama pull nomic-embed-text
```

Wait ~5-10 minutes for models to download (first time only).

### 3. Add Documents

```bash
cd client/OllamaRAGDemo

# Place your PDF, image, HTML, or TXT files here
cp /path/to/your/documents/*.pdf documents/
cp /path/to/your/documents/*.png documents/
```

### 4. Build & Run

```bash
# Build with enhanced dependencies
docker-compose build

# Start the RAG app
docker-compose up -d

# Watch ingestion (will happen automatically on first run)
docker logs -f rag-demo-app
```

### 5. Access the Interface

Open browser: **http://localhost:8000**

Try queries like:
- "What does the pension guide say about retirement age?"
- "Summarize the tax information"
- "What are the key points about debt management?"

## 📊 What You'll See

```
✓ Ollama service is ready
Pulling LLaVA vision model for enhanced document processing...
Processing PDF with LLaVA vision model: /documents/guide.pdf
Converting PDF to images at 400 DPI
Processing page 1/5 with LLaVA vision model
✓ PDF processed: 5 pages, type: financial_guide, confidence: 0.95

Processing methods summary:
  - vision_llm: 8 documents (PDFs & images)
  - beautifulsoup: 3 documents (HTML)
  - direct: 2 documents (TXT)

✓ Vector store created with 156 chunks from 13 documents
✓ Starting RAG application...
INFO:     Application startup complete.
```

## ⚡ Quick Commands

```bash
# View logs
docker logs -f rag-demo-app

# Re-ingest documents (after adding new ones)
rm -rf data/vectorstore/*
docker-compose restart rag-app

# Check which models are loaded
docker exec shared-ollama-service ollama list

# Test manual ingestion
docker exec rag-demo-app python3 /app/ingest_documents_enhanced.py

# Stop everything
docker-compose down
```

## 🎯 Success Indicators

✅ You see "LLaVA vision model" in logs
✅ PDFs show "type: [document_type], confidence: 0.XX"
✅ Web interface loads at http://localhost:8000
✅ Queries return detailed, accurate responses
✅ Processing methods show "vision_llm" for PDFs

## ⚠️ If Something Goes Wrong

**Models not found:**
```bash
docker exec shared-ollama-service ollama pull llava:7b
```

**Ollama not responding:**
```bash
docker-compose -f ../../docker-compose.ollama.yml up -d
```

**Re-ingest documents:**
```bash
rm -rf data/vectorstore/*
docker-compose restart rag-app
```

**Check GPU (optional):**
```bash
nvidia-smi  # Should show GPU if available
```

## 📁 Example Documents to Test

The repository includes sample documents in `documents/`:
- UK pensions guide (TXT)
- Budgeting guide (TXT)
- Debt management guide (TXT)
- Various financial guides

**Add your own PDFs for the full vision model experience!**

---

That's it! Your enhanced RAG system with LLaVA vision model is now processing documents with superior understanding.
