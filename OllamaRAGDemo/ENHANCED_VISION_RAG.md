# Enhanced OllamaRAGDemo with LLaVA Vision Model

## 🚀 What's New

The OllamaRAGDemo now supports **LLaVA vision models** for superior document understanding during RAG ingestion!

### Key Enhancements

1. **LLaVA Vision Model Integration**
   - Process PDFs with visual understanding (not just text extraction)
   - Extract text from images and scanned documents
   - Automatic document classification
   - Structured data extraction from complex layouts

2. **Multi-Format Support**
   - ✅ **HTML files** - BeautifulSoup parsing
   - ✅ **TXT files** - Direct text loading
   - ✅ **PDF files** - LLaVA vision model (NEW!)
   - ✅ **Images** - PNG, JPG, JPEG, TIFF (NEW!)

3. **Intelligent Processing**
   - Document type classification (financial guides, tax guides, etc.)
   - Structured metadata extraction
   - Enhanced chunking with context preservation
   - Fallback mechanisms for reliability

## 📋 Requirements

- **GPU**: NVIDIA GPU with CUDA support (recommended for LLaVA)
- **RAM**: Minimum 8GB, recommended 16GB
- **Storage**: ~6GB for LLaVA models
- **Docker**: With NVIDIA Container Toolkit (for GPU)

## 🔧 Setup

### 1. Ensure GPU Support (Optional but Recommended)

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### 2. Start the Shared Ollama Service

```bash
# Navigate to the shared Ollama directory
cd /path/to/windsurf-project

# Start shared Ollama with GPU support
docker-compose -f docker-compose.ollama.yml up -d
```

### 3. Pull Required Models

```bash
# Option A: Automatic (recommended)
docker exec shared-ollama-service /bin/bash -c "ollama pull llava:7b && ollama pull llama2 && ollama pull nomic-embed-text"

# Option B: Using the helper script
cd client/OllamaRAGDemo
./pull-models.sh
```

**Model Sizes:**
- `llava:7b` - ~4GB (recommended - good balance)
- `llava:13b` - ~7GB (better quality, slower)
- `llama2` - ~4GB (text processing)
- `nomic-embed-text` - ~274MB (embeddings)

### 4. Prepare Your Documents

Place your documents in the `documents/` folder:

```bash
cd client/OllamaRAGDemo
mkdir -p documents

# Copy your PDFs, images, HTML, or TXT files
cp /path/to/your/documents/*.pdf documents/
cp /path/to/your/documents/*.png documents/
cp /path/to/your/documents/*.html documents/
```

**Supported Formats:**
- PDF documents (processed with LLaVA vision)
- PNG, JPG, JPEG, TIFF images (processed with LLaVA vision)
- HTML files (parsed with BeautifulSoup)
- TXT files (direct loading)

### 5. Build and Start RAG Application

```bash
cd client/OllamaRAGDemo

# Build the container
docker-compose build

# Start the application
docker-compose up -d

# Watch the logs to see ingestion progress
docker logs -f rag-demo-app
```

## 📊 How It Works

### Document Ingestion Pipeline

```
Document Files (PDF/Image/HTML/TXT)
        ↓
    File Type Detection
        ↓
┌──────────────────────────┐
│  PDF/Image Processing    │
│  → LLaVA Vision Model    │
│  → Document Classification│
│  → Structured Extraction │
│  → High-quality Text     │
└──────────────────────────┘
        ↓
    Text Chunking
    (1000 chars, 200 overlap)
        ↓
    Ollama Embeddings
    (nomic-embed-text)
        ↓
    ChromaDB Vector Store
        ↓
    RAG Query Interface
```

### Processing Methods by File Type

| File Type | Processing Method | Quality | Speed |
|-----------|------------------|---------|-------|
| PDF | LLaVA Vision Model | Excellent | Medium (30-60s/page) |
| Images | LLaVA Vision Model | Excellent | Medium (20-40s/image) |
| HTML | BeautifulSoup | Good | Fast |
| TXT | Direct Load | Perfect | Very Fast |

## 🎯 Using the Enhanced Ingestion

### Standard Ingestion (Original)

```bash
# Uses basic text extraction only
docker exec rag-demo-app python3 /app/ingest_documents.py
```

### Enhanced Ingestion with LLaVA (NEW!)

```bash
# Uses LLaVA vision model for PDFs and images
docker exec rag-demo-app python3 /app/ingest_documents_enhanced.py
```

### Configure Vision Model Usage

Edit `docker-compose.yml`:

```yaml
environment:
  - USE_VISION_MODEL=true      # Enable/disable vision model
  - VISION_MODEL=llava:7b      # Choose model size (7b, 13b, 34b)
  - TEXT_MODEL=llama2          # Text processing model
```

**To disable vision model:**
```yaml
environment:
  - USE_VISION_MODEL=false  # Falls back to basic PDF extraction
```

## 💡 Example: Ingesting Financial Documents

```bash
# 1. Add your financial PDFs and images
cp financial_statements/*.pdf documents/
cp scanned_forms/*.png documents/
cp guides/*.html documents/

# 2. Clear existing vector store (if re-ingesting)
rm -rf data/vectorstore/*

# 3. Restart to trigger re-ingestion with vision model
docker-compose restart rag-app

# 4. Watch the magic happen
docker logs -f rag-demo-app
```

**You'll see output like:**
```
Processing PDF with LLaVA vision model: /documents/pension_guide.pdf
Converting PDF to images at 400 DPI
Processing page 1/5 with LLaVA vision model
✓ PDF processed: 5 pages, type: pension_guide, confidence: 0.95

Processing methods summary:
  - vision_llm: 12 documents
  - beautifulsoup: 8 documents
  - direct: 5 documents

✓ Vector store created with 342 chunks from 25 documents
```

## 🔍 Query the Enhanced RAG

Access the web interface: **http://localhost:8000**

### Example Queries

**Before (basic extraction):**
```
Q: What does the pension guide say about retirement age?
A: The text mentions retirement age in several places... [generic response]
```

**After (LLaVA vision model):**
```
Q: What does the pension guide say about retirement age?
A: According to the UK Pensions Comprehensive Guide, the state pension age 
   is currently 66 for both men and women. This is scheduled to increase to 
   67 between 2026 and 2028. The document also discusses private pension 
   access from age 55 (increasing to 57 in 2028)... [detailed, accurate response]
```

## 📈 Benefits of Vision Model

### Traditional PDF Extraction
- ❌ Often misses complex layouts
- ❌ Struggles with tables and forms
- ❌ Poor handling of scanned documents
- ❌ No document understanding

### LLaVA Vision Model
- ✅ Understands document structure
- ✅ Accurately extracts tables and forms
- ✅ Works with scanned documents
- ✅ Classifies document types automatically
- ✅ Extracts structured metadata
- ✅ Preserves formatting and context

## 🔧 Troubleshooting

### Vision Model Not Working

**Check if models are pulled:**
```bash
docker exec shared-ollama-service ollama list
```

**Should see:**
```
llava:7b
llama2
nomic-embed-text
```

**Pull manually if missing:**
```bash
docker exec shared-ollama-service ollama pull llava:7b
```

### Slow Processing

**Using smaller model:**
```yaml
environment:
  - VISION_MODEL=llava:7b  # Instead of 13b or 34b
```

**Reduce image DPI:**
Edit `local_parser.py`:
```python
dpi = 200  # Instead of 400
```

### Out of Memory

**Use smaller LLaVA model:**
```yaml
environment:
  - VISION_MODEL=llava:7b  # Requires ~4GB VRAM
```

**Or disable vision model:**
```yaml
environment:
  - USE_VISION_MODEL=false
```

## 🎓 Advanced Usage

### Custom Document Classification

Edit `local_parser.py` to add custom document types:

```python
def _classify_document(self, text, first_page_image):
    # Add your custom categories
    categories = [
        'custom_type_1',
        'custom_type_2',
        # ...
    ]
```

### Adjust Chunking Strategy

Edit `ingest_documents_enhanced.py`:

```python
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1500,      # Larger chunks (was 1000)
    chunk_overlap=300,    # More overlap (was 200)
)
```

### Monitor Processing

```bash
# Real-time logs
docker logs -f rag-demo-app

# Check ingestion stats
docker exec rag-demo-app python3 -c "
from ingest_documents_enhanced import load_documents
docs, meta = load_documents()
print(f'Total documents: {len(docs)}')
for m in meta:
    print(f'{m[\"type\"]}: {m.get(\"method\", \"unknown\")}')
"
```

## 📚 File Structure

```
OllamaRAGDemo/
├── app/
│   ├── rag_app.py                      # Main RAG application
│   ├── ingest_documents.py             # Original ingestion (basic)
│   ├── ingest_documents_enhanced.py    # NEW: Vision model ingestion
│   └── local_parser.py                 # NEW: LLaVA vision parser
├── documents/                          # Place your docs here
│   ├── *.pdf                          # Processed with LLaVA
│   ├── *.png, *.jpg                   # Processed with LLaVA
│   ├── *.html                         # Processed with BeautifulSoup
│   └── *.txt                          # Direct loading
├── data/
│   └── vectorstore/                   # ChromaDB storage
├── docker-compose.yml                 # Updated with vision config
├── Dockerfile.app                     # Updated with dependencies
├── requirements.txt                   # Updated with pdf2image, etc.
└── pull-models.sh                     # Helper script for models
```

## 🚀 Next Steps

1. ✅ Add your documents to `documents/` folder
2. ✅ Pull required models (`llava:7b`, `llama2`, `nomic-embed-text`)
3. ✅ Start the application
4. ✅ Watch ingestion logs
5. ✅ Query your documents at http://localhost:8000
6. ✅ Compare quality with/without vision model

## 🆘 Support

For issues:
1. Check logs: `docker logs -f rag-demo-app`
2. Verify models: `docker exec shared-ollama-service ollama list`
3. Check GPU: `nvidia-smi` (if using GPU)
4. Review document formats (PDF, PNG, etc.)

## 📝 Comparison: Before vs After

| Feature | Basic Ingestion | Enhanced with LLaVA |
|---------|----------------|---------------------|
| PDF Text Extraction | PyPDF2 (basic) | Vision Model (advanced) |
| Scanned Documents | ❌ Poor | ✅ Excellent |
| Tables/Forms | ❌ Broken | ✅ Preserved |
| Images | ❌ Not supported | ✅ Fully supported |
| Document Classification | ❌ None | ✅ Automatic |
| Metadata Extraction | ❌ Basic | ✅ Structured |
| Processing Speed | Fast | Medium |
| Quality | Fair | Excellent |
| Privacy | ✅ Local | ✅ Local |

---

**The vision model provides significantly better document understanding, leading to more accurate and contextual RAG responses!**
