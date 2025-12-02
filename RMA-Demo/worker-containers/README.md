# RMA Worker Containers

Worker-compatible containers for the RMA distributed system.

## Overview

Each container includes:
1. **Original service code** (vLLM, RAG, etc.)
2. **Coordinator integration** (task pulling, reporting)
3. **Health monitoring** (self-reporting status)

## Building Containers

### Build All Containers

```bash
# From RMA-Demo directory
cd worker-containers

# Build vLLM worker
docker build -t ghcr.io/rma/vllm-worker:latest vllm/

# Build RAG worker
docker build -t ghcr.io/rma/rag-worker:latest rag/

# Build other workers
docker build -t ghcr.io/rma/notes-worker:latest notes/
docker build -t ghcr.io/rma/ner-worker:latest ner/
# ... etc
```

### Push to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push containers
docker push ghcr.io/rma/vllm-worker:latest
docker push ghcr.io/rma/rag-worker:latest
# ... etc
```

## Container Structure

```
worker-container/
├── Dockerfile              # Container build instructions
├── entrypoint.sh          # Startup script
├── coordinator_integration.py  # Coordinator communication
└── [service-specific files]
```

## Environment Variables

All worker containers accept:
- `COORDINATOR_URL` - Coordinator endpoint (e.g., https://api.rmatool.org.uk)
- `WORKER_ID` - Unique worker identifier (set by worker agent)

Plus service-specific variables:
- vLLM: `MODEL_NAME`, `GPU_MEMORY_UTILIZATION`, `MAX_MODEL_LEN`
- RAG: `OLLAMA_URL`, `CHROMADB_HOST`, `CHROMADB_PORT`
- NER: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`

## Creating New Worker Containers

To convert an existing service to a worker container:

1. **Copy existing Dockerfile as base**
   ```bash
   cp ../../services/your-service/Dockerfile ./your-service/Dockerfile
   ```

2. **Add coordinator integration dependency**
   ```dockerfile
   RUN pip install --no-cache-dir requests
   ```

3. **Copy coordinator integration script**
   ```dockerfile
   COPY ../vllm/coordinator_integration.py ./coordinator_integration.py
   ```

4. **Add coordinator environment variables**
   ```dockerfile
   ENV COORDINATOR_URL=""
   ENV WORKER_ID=""
   ```

5. **Update CMD to run coordinator integration**
   ```dockerfile
   CMD python coordinator_integration.py & python app.py
   ```

6. **Build and test**
   ```bash
   docker build -t ghcr.io/rma/your-service-worker:latest your-service/
   docker run --rm -e COORDINATOR_URL=http://localhost:8080 -e WORKER_ID=test \
       ghcr.io/rma/your-service-worker:latest
   ```

## Testing Locally

### Test Single Container

```bash
# Start coordinator
cd ../coordinator-service
python -m uvicorn app.main:app --port 8080 &

# Run worker container
docker run --rm \
    -e COORDINATOR_URL=http://host.docker.internal:8080 \
    -e WORKER_ID=test-worker \
    -p 8000:8000 \
    ghcr.io/rma/vllm-worker:latest
```

### Test Full System

```bash
# Start coordinator
cd ../coordinator-service
docker-compose up -d

# Start worker agent (auto-pulls and starts containers)
cd ../worker-agent
python worker_agent.py --coordinator http://localhost:8080
```

## Container Registry

Containers are published to GitHub Container Registry (ghcr.io):
- `ghcr.io/rma/vllm-worker:latest`
- `ghcr.io/rma/ollama-vision-worker:latest`
- `ghcr.io/rma/rag-worker:latest`
- `ghcr.io/rma/notes-worker:latest`
- `ghcr.io/rma/ner-worker:latest`
- `ghcr.io/rma/doc-processor-worker:latest`
- `ghcr.io/rma/ocr-worker:latest`
- `ghcr.io/rma/postgres-worker:latest` (uses official postgres:16-alpine)
- `ghcr.io/rma/neo4j-worker:latest` (uses official neo4j:5.15)
- `ghcr.io/rma/redis-worker:latest` (uses official redis:7-alpine)
- `ghcr.io/rma/chromadb-worker:latest` (uses official chromadb image)

## GPU Support

GPU workers (vLLM, Ollama Vision) require:
- NVIDIA GPU with 8GB+ VRAM
- NVIDIA Container Toolkit installed on host
- `--gpus all` flag when running manually
- Worker agent automatically adds GPU support

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs <container-name>

# Run in interactive mode
docker run --rm -it \
    -e COORDINATOR_URL=http://localhost:8080 \
    -e WORKER_ID=test \
    ghcr.io/rma/your-worker:latest /bin/bash
```

### Can't Connect to Coordinator

```bash
# Test from inside container
docker exec <container-name> curl http://coordinator:8080/health

# Check network
docker network ls
docker network inspect rma-network
```

### GPU Not Detected

```bash
# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# Check NVIDIA Container Toolkit
nvidia-ctk --version
```

## Production Considerations

1. **Image Size**: Multi-stage builds to reduce size
2. **Security**: Non-root users, minimal base images
3. **Logging**: Structured logging to stdout/stderr
4. **Health Checks**: Dockerfile HEALTHCHECK directives
5. **Versioning**: Semantic versioning (v1.0.0, v1.1.0, etc.)

## Next Steps

1. Build all worker containers
2. Push to container registry
3. Update coordinator to return correct image names
4. Test with worker agent
5. Deploy coordinator to production
6. Distribute worker agent to contributors
