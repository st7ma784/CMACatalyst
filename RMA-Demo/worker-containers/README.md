# RMA Worker Containers

Worker containers for the RMA distributed system with **universal worker architecture**.

## ⭐ Universal Worker (Recommended)

A single container that can run **any of the 14 microservices** across all 4 tiers based on coordinator assignment.

### Quick Start

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Auto-detection (recommended)
docker run -d --gpus all \
  -e WORKER_TYPE=auto \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Supported Services (14 total)

**Tier 1 (GPU) - 3 services:**
- `llm-inference`: vLLM with Llama 3.2 (port 8105)
- `vision-ocr`: LLaVA multimodal (port 8104)
- `rag-embeddings`: sentence-transformers (port 8102)

**Tier 2 (CPU) - 3 services:**
- `ner-extraction`: spaCy NER (port 8108)
- `document-processing`: PDF/DOCX parsing (port 8103)
- `notes-coa`: Advisor notes (port 8100)

**Tier 3 (Storage) - 5 services:**
- `chromadb`: Vector database (port 8000)
- `redis`: Cache (port 6379)
- `postgres`: Relational DB (port 5432)
- `minio`: S3 storage (port 9000)
- `neo4j`: Graph DB (port 7474)

**Tier 4 (Edge) - 3 services:**
- `coordinator`: Worker registry (port 8080)
- `edge-proxy`: Routing layer (port 8787)
- `load-balancer`: Traffic distribution (port 8090)

### Worker Types

```bash
# GPU Worker (Tier 1)
docker run -d --gpus all \
  -e WORKER_TYPE=gpu \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# CPU Worker (Tier 2)
docker run -d \
  -e WORKER_TYPE=cpu \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Storage Worker (Tier 3)
docker run -d \
  -v ./chroma-data:/chroma/chroma \
  -e WORKER_TYPE=storage \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Edge Worker (Tier 4)
docker run -d \
  -p 8080:8080 -p 8787:8787 -p 8090:8090 \
  -e WORKER_TYPE=edge \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

## Building from Source

### Build Universal Worker

```bash
cd RMA-Demo/worker-containers/universal-worker
docker build -t ghcr.io/st7ma784/cmacatalyst/universal-worker:latest .
```

### Build Coordinator

```bash
cd RMA-Demo/services/local-coordinator
docker build -t ghcr.io/st7ma784/cmacatalyst/coordinator:latest .
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

**Universal Worker:**
- `WORKER_TYPE` - Worker tier: `auto`, `gpu`, `cpu`, `storage`, `edge`
- `COORDINATOR_URL` - Coordinator endpoint (e.g., https://api.rmatool.org.uk)
- `WORKER_ID` - Unique identifier (auto-generated if not set)

**Auto-Detection (WORKER_TYPE=auto):**
Priority: GPU → Edge → Storage → CPU

**Service-specific variables:**
- GPU services: `MODEL_NAME`, `GPU_MEMORY_UTILIZATION`, `MAX_MODEL_LEN`
- Storage services: `CHROMADB_HOST`, `CHROMADB_PORT`, `NEO4J_URI`, `REDIS_HOST`
- Edge services: `LOAD_BALANCER_PORT`, `EDGE_PROXY_PORT`

## Deployment Best Practices

1. **Use Auto-Detection for Mixed Hardware**
   ```bash
   docker run -d --gpus all \
     -e WORKER_TYPE=auto \
     -e COORDINATOR_URL=https://api.rmatool.org.uk \
     ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
   ```

2. **Specify Worker Type for Dedicated Nodes**
   - GPU nodes: `WORKER_TYPE=gpu` (CUDA + cuDNN required)
   - CPU nodes: `WORKER_TYPE=cpu` (no GPU needed)
   - Storage nodes: `WORKER_TYPE=storage` (requires persistent volumes)
   - Edge nodes: `WORKER_TYPE=edge` (exposed ports for load balancer)

3. **Volume Mounts for Storage Workers**
   ```bash
   docker run -d \
     -v ./chroma-data:/chroma/chroma \
     -v ./postgres-data:/var/lib/postgresql/data \
     -e WORKER_TYPE=storage \
     ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
   ```

4. **Resource Limits**
   ```bash
   docker run -d --gpus all \
     --memory=16g --cpus=4 \
     -e WORKER_TYPE=gpu \
     ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
   ```

## Testing Locally

### Test Single Universal Worker

```bash
# Start coordinator
cd RMA-Demo/services/local-coordinator
python -m uvicorn app.main:app --port 8080 &

# Test auto-detection
docker run --rm --gpus all \
    -e COORDINATOR_URL=http://host.docker.internal:8080 \
    -e WORKER_TYPE=auto \
    ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Check registered services
curl http://localhost:8080/api/admin/workers
```

### Test Full System with Multiple Workers

```bash
# Start coordinator
cd RMA-Demo/services/local-coordinator
docker-compose up -d

# Start GPU worker
docker run -d --gpus all \
    -e WORKER_TYPE=gpu \
    -e COORDINATOR_URL=http://localhost:8080 \
    ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Start CPU worker
docker run -d \
    -e WORKER_TYPE=cpu \
    -e COORDINATOR_URL=http://localhost:8080 \
    ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Start storage worker
docker run -d \
    -v ./chroma-data:/chroma/chroma \
    -e WORKER_TYPE=storage \
    -e COORDINATOR_URL=http://localhost:8080 \
    ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

## Published Containers

Containers are automatically built via GitHub Actions and published to:

**Universal Worker:**
- `ghcr.io/st7ma784/cmacatalyst/universal-worker:latest`
  - Single container supporting all 14 microservices
  - Auto-detects hardware capabilities
  - Dynamically assigned services by coordinator

**Coordinator:**
- `ghcr.io/st7ma784/cmacatalyst/coordinator:latest`
  - In-memory worker registry (no KV limits)
  - Dynamic service assignment based on gaps
  - Health tracking with 30s heartbeats

### Legacy Containers (Deprecated)

The following individual worker containers are **deprecated** in favor of the universal worker:
- ~~cpu-worker~~ → Use `universal-worker` with `WORKER_TYPE=cpu`
- ~~gpu-worker~~ → Use `universal-worker` with `WORKER_TYPE=gpu`
- ~~storage-worker~~ → Use `universal-worker` with `WORKER_TYPE=storage`

See [chromadb/README.md](chromadb/README.md) for migration details.

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
    -e WORKER_TYPE=auto \
    ghcr.io/st7ma784/cmacatalyst/universal-worker:latest /bin/bash

# Check which services were detected
docker logs <container-name> | grep "Detected"
```

### Worker Not Registering with Coordinator

```bash
# Test coordinator connectivity from container
docker exec <container-name> curl http://coordinator:8080/health

# Check worker registration
curl http://localhost:8080/api/admin/workers

# Verify COORDINATOR_URL is correct
docker inspect <container-name> | grep COORDINATOR_URL
```

### Can't Connect to Coordinator

```bash
# Check network connectivity
docker network ls
docker network inspect rma-network

# Test from host
curl http://localhost:8080/health
```

### GPU Not Detected

```bash
# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# Check NVIDIA Container Toolkit
nvidia-ctk --version
```

## Production Considerations

1. **Worker Type Strategy**
   - Auto-detection: Best for heterogeneous fleets
   - Fixed types: Better for dedicated node pools
   - Storage workers: Require persistent volumes with backups

2. **Resource Allocation**
   - GPU workers: 8GB+ VRAM, 16GB+ RAM recommended
   - CPU workers: 4+ cores, 8GB+ RAM recommended
   - Storage workers: Fast SSD storage for databases

3. **High Availability**
   - Run multiple workers per tier
   - Coordinator handles failover automatically
   - Storage workers need replication (PostgreSQL streaming, Redis sentinel)

4. **Monitoring**
   - Coordinator exposes `/api/admin/workers` endpoint
   - Worker heartbeats every 30s
   - Check service assignment gaps regularly

5. **Security**
   - Non-root users in containers
   - Network policies to isolate tiers
   - Secrets management for database credentials

## Documentation

- [Dynamic Service Allocation Guide](../DYNAMIC_SERVICE_ALLOCATION.md)
- [Tier 4 Architecture](../TIER_4_ARCHITECTURE.md)
- [Deployment Guide](../docs/UPDATED_DEPLOYMENT_GUIDE.md)
