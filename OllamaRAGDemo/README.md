# Ollama RAG Demo

A complete demonstration of Retrieval-Augmented Generation (RAG) using Ollama, ChromaDB, and LangChain. This system processes HTML and TXT documents into a vector store and uses RAG to answer questions based on the document content.

## Features

- 🚀 **GPU-accelerated** Ollama inference using NVIDIA CUDA
- 📚 **Vector Store** using ChromaDB for efficient document retrieval
- 🔄 **Automatic document ingestion** of HTML and TXT files
- 🌐 **REST API** for easy integration
- 🎯 **RAG implementation** with source attribution
- 🐳 **Docker containerized** for easy deployment

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Docker Container                        │
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   Ollama    │───▶│   ChromaDB   │◀──▶│  RAG App      │  │
│  │  (LLM +     │    │ Vector Store │    │ (FastAPI)     │  │
│  │ Embeddings) │    │              │    │               │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│         │                   │                    │           │
│         ▼                   ▼                    ▼           │
│    GPU Accel          Persisted Data       REST API         │
└─────────────────────────────────────────────────────────────┘
         │                   │                    │
         └───────────────────┴────────────────────┘
                             │
                      Mounted Volumes
                      - documents/
                      - data/vectorstore/
```

## Prerequisites

- Docker and Docker Compose
- NVIDIA GPU with CUDA support
- NVIDIA Container Toolkit (nvidia-docker2)

### Installing NVIDIA Container Toolkit

```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

## Quick Start

1. **Clone/Navigate to the OllamaDemo directory**

```bash
cd OllamaDemo
```

2. **Add your documents**

Place HTML or TXT files in the `documents/` directory:

```bash
cp your_document.html documents/
cp your_notes.txt documents/
```

3. **Build and start the container**

```bash
docker-compose up --build
```

The first startup will:
- Download and install Ollama
- Pull the llama3.2 model (~2GB)
- Pull the nomic-embed-text embedding model
- Process all documents in the `documents/` directory
- Start the RAG API server

This may take 10-15 minutes on first run.

4. **Access the API**

The API will be available at `http://localhost:8000`

## API Usage

### Health Check

```bash
curl http://localhost:8000/health
```

### Get Vector Store Statistics

```bash
curl http://localhost:8000/stats
```

### Query the RAG System

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is RAG?",
    "model": "llama3.2",
    "top_k": 4
  }'
```

Response:
```json
{
  "answer": "RAG stands for Retrieval-Augmented Generation...",
  "sources": ["/documents/sample.txt"]
}
```

### Re-ingest Documents

After adding new documents:

```bash
curl -X POST http://localhost:8000/reingest
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/health` | GET | Health check |
| `/stats` | GET | Vector store statistics |
| `/query` | POST | Query the RAG system |
| `/reingest` | POST | Re-process documents |

## Configuration

### Change the LLM Model

Edit `entrypoint.sh` to pull a different model:

```bash
ollama pull mistral
# or
ollama pull codellama
```

Then specify it in your query:

```json
{
  "question": "Your question here",
  "model": "mistral"
}
```

### Adjust Chunk Size

Modify `app/ingest_documents.py`:

```python
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,      # Adjust this
    chunk_overlap=200,    # Adjust this
    length_function=len,
)
```

### Change Retrieval Parameters

In your API query, adjust `top_k`:

```json
{
  "question": "Your question",
  "top_k": 8  // Retrieve more context chunks
}
```

## Directory Structure

```
OllamaDemo/
├── Dockerfile              # Container definition
├── docker-compose.yml      # Docker Compose configuration
├── entrypoint.sh          # Container startup script
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── app/
│   ├── ingest_documents.py  # Document processing script
│   └── rag_app.py          # FastAPI RAG application
├── documents/             # Place your documents here
│   ├── sample.txt
│   └── ollama_info.html
└── data/
    └── vectorstore/       # Persisted vector database
```

## Volume Mounts

- `./documents` → `/documents` - Your source documents
- `./data/vectorstore` → `/data/vectorstore` - Persisted vector embeddings
- `ollama_data` (named volume) → `/root/.ollama` - Ollama models cache

## Troubleshooting

### GPU Not Detected

Check NVIDIA runtime:
```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

### Container Fails to Start

Check logs:
```bash
docker-compose logs -f
```

### Out of Memory

Reduce model size or use a smaller model:
- llama3.2:1b (smallest)
- llama3.2:3b (medium)
- mistral (7B parameters)

### Slow Inference

- Ensure GPU is being used (check nvidia-smi)
- Reduce `top_k` in queries
- Use smaller chunk sizes
- Switch to a smaller model

## Development

### Run Document Ingestion Manually

```bash
docker-compose exec ollama-rag-demo python3 /app/ingest_documents.py
```

### Access Container Shell

```bash
docker-compose exec ollama-rag-demo bash
```

### Test Ollama Directly

```bash
docker-compose exec ollama-rag-demo ollama run llama3.2
```

## Performance Tips

1. **GPU Memory**: Monitor with `nvidia-smi`. Models like llama3.2:3b need ~4GB VRAM
2. **Batch Processing**: Process multiple queries in parallel for better throughput
3. **Caching**: Vector store is cached; subsequent startups are faster
4. **Model Selection**: Balance between model size and performance needs

## Example Queries

```bash
# General question about RAG
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the benefits of RAG?"}'

# Question about Ollama
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What models are available in Ollama?"}'

# Using a different model
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Ollama used for?",
    "model": "mistral",
    "top_k": 6
  }'
```

## Extending the Demo

### Add Support for PDFs

1. Add `pypdf2` to `requirements.txt`
2. Modify `ingest_documents.py` to process PDF files
3. Rebuild container

### Add Web Interface

1. Create a simple HTML/JavaScript frontend
2. Mount it in the container
3. Serve with FastAPI static files

### Add Authentication

1. Install `python-jose` and `passlib`
2. Implement JWT authentication in `rag_app.py`
3. Protect endpoints with dependencies

## License

This demo is provided as-is for educational purposes.

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [LangChain Documentation](https://python.langchain.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
