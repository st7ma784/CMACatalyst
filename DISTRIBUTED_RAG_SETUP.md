# Distributed RAG System - Complete Setup Guide

## Overview

This guide explains how to set up a fully distributed RAG (Retrieval-Augmented Generation) system with automatic manual ingestion using the new orchestrator service.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Coordinator                     │
│              https://api.rmatool.org.uk                     │
│  - Worker Registry (KV Storage)                             │
│  - Request Routing                                          │
│  - Health Monitoring                                        │
└────────┬────────────────────────────────┬───────────────────┘
         │                                │
         ├── GPU Worker (Tier 1)          ├── ChromaDB Worker (Tier 3)
         │   - LLM Inference              │   - Vector Storage
         │   - Embedding Generation       │   - Persistent Volume
         │   - RAG Service                │   - Auto-Tunneling
         │                                │
         └── RAG Orchestrator             └── CPU Worker (Tier 2, optional)
             - Monitors Workers               - Processing Support
             - Triggers Ingestion
             - System Initialization
```

## Components

### 1. GPU Worker
**Purpose**: Provides AI inference and RAG query capabilities
**Container**: `ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest`
**Requirements**: NVIDIA GPU, 16GB+ VRAM
**Services**: LLM (llama3.2), Embeddings (nomic-embed-text), RAG API

### 2. ChromaDB Worker
**Purpose**: Persistent vector database for document embeddings
**Container**: `ghcr.io/st7ma784/cmacatalyst/chromadb-worker:latest`
**Requirements**: 4GB+ RAM, persistent storage
**Services**: ChromaDB HTTP API (port 8000)

### 3. RAG Orchestrator
**Purpose**: Automatic system initialization and manual ingestion
**Container**: `rag-orchestrator` (from source)
**Requirements**: Network access to coordinator
**Services**: Monitors workers, triggers ingestion when ready

## Quick Start

### Step 1: Deploy GPU Worker

```bash
# Pull latest image
docker pull ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# Run with automatic coordinator registration
docker run -d \
  --name rma-gpu-worker \
  --restart unless-stopped \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e USE_TUNNEL=true \
  -v /path/to/manuals:/manuals:ro \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# Check logs
docker logs -f rma-gpu-worker
```

**Expected output:**
```
🚀 Starting GPU Worker Agent...
🚇 Starting Cloudflare Tunnel for port 8102...
✅ Tunnel active: https://random-slug.trycloudflare.com
📡 Registering with coordinator...
✅ Registration successful!
Worker ID: gpu-worker-hostname-1234567890
Tier: 1 (GPU)
```

### Step 2: Deploy ChromaDB Worker

```bash
# Pull latest image (once built)
docker pull ghcr.io/st7ma784/cmacatalyst/chromadb-worker:latest

# Run with persistent volume
docker run -d \
  --name rma-chromadb-worker \
  --restart unless-stopped \
  -v chromadb_data:/chroma/chroma \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e USE_TUNNEL=true \
  ghcr.io/st7ma784/cmacatalyst/chromadb-worker:latest

# Check logs
docker logs -f rma-chromadb-worker
```

**Expected output:**
```
ChromaDB Worker Agent initialized
🚇 Starting Cloudflare Tunnel for port 8000...
✅ Tunnel active: https://another-slug.trycloudflare.com
Waiting for ChromaDB to start...
✅ ChromaDB is ready
📡 Registering with coordinator...
✅ Registration successful!
Worker ID: chromadb-worker-hostname-1234567890
Tier: 3 (Storage)
```

### Step 3: Deploy RAG Orchestrator

```bash
# Build orchestrator from source
cd RMA-Demo/services/rag-orchestrator
docker build -t rag-orchestrator .

# Run orchestrator
docker run -d \
  --name rag-orchestrator \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e CHECK_INTERVAL=60 \
  rag-orchestrator

# Monitor orchestrator
docker logs -f rag-orchestrator
```

**Expected output:**
```
RAG System Orchestrator initialized
🎯 Starting RAG System Orchestrator...
Waiting for required workers: GPU, ChromaDB, RAG
System Status:
  GPU Worker: ❌
  ChromaDB: ❌
  RAG Service: ❌
⏳ Waiting for: GPU worker, ChromaDB, RAG service
...
[After workers register]
System Status:
  GPU Worker: ✅
  ChromaDB: ✅
  RAG Service: ✅
🎉 All required workers are online!
Starting manual ingestion process...
🚀 Triggering training manual ingestion...
✅ Manual ingestion completed!
Total files: 12
Successful: 12
Failed: 0
✅ System initialization complete!
RAG system is ready for queries
```

## Manual Deployment

### Prepare Training Manuals

```bash
# Create manuals directory on GPU worker host
mkdir -p /opt/rma/manuals

# Copy PDF manuals
cp debt-advice-handbook.pdf /opt/rma/manuals/
cp fca-guidelines.pdf /opt/rma/manuals/
# ... add more manuals

# Mount in GPU worker
docker run -d \
  --gpus all \
  -v /opt/rma/manuals:/manuals:ro \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
```

### Verify System Status

```bash
# Check coordinator worker registry
curl https://api.rmatool.org.uk/api/admin/workers | jq '.'

# Should show:
{
  "workers": [
    {
      "worker_id": "gpu-worker-...",
      "tier": 1,
      "status": "online",
      "capabilities": {
        "has_gpu": true,
        "gpu_count": 1,
        ...
      }
    },
    {
      "worker_id": "chromadb-worker-...",
      "tier": 3,
      "status": "online",
      "capabilities": {
        "has_storage": true,
        "storage_type": "vector_database"
      }
    }
  ]
}
```

### Test RAG Queries

Once orchestrator completes ingestion:

```bash
# Query via coordinator
curl -X POST https://api.rmatool.org.uk/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the eligibility criteria for a DRO?",
    "include_sources": true
  }'
```

## Troubleshooting

### CPU Worker Can't Be Pulled

**Issue**: `docker pull ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest` fails with authentication error

**Solution**: Make GitHub Container Registry packages public

1. Go to: https://github.com/st7ma784/CMACatalyst/packages
2. Click on `cpu-worker` → **Package settings**
3. **Danger Zone** → **Change visibility** → **Public**
4. Confirm with repository name
5. Repeat for `gpu-worker` and `chromadb-worker`

See: `GITHUB_PACKAGES_PUBLIC_SETUP.md`

### Orchestrator Stuck Waiting

**Check workers are registered:**
```bash
curl https://api.rmatool.org.uk/api/admin/workers
```

**Check worker logs:**
```bash
docker logs rma-gpu-worker | tail -50
docker logs rma-chromadb-worker | tail -50
```

**Common issues:**
- Workers can't reach coordinator (firewall/network)
- Tunnel creation failed (cloudflared not found)
- ChromaDB not started (check ChromaDB worker logs)

### Ingestion Fails

**Check RAG service is accessible:**
```bash
# Find RAG service URL
RAG_URL=$(curl -s https://api.rmatool.org.uk/api/admin/workers | \
  jq -r '.workers[] | .containers[] | select(.name=="gpu-worker") | .service_url' | head -1)

# Test health
curl $RAG_URL/health
```

**Check manuals directory:**
```bash
# SSH into GPU worker host
docker exec rma-gpu-worker ls -la /manuals

# Should show PDF files
total 45M
-rw-r--r-- 1 root root 12M debt-advice-handbook.pdf
-rw-r--r-- 1 root root 8M fca-guidelines.pdf
...
```

**Manual trigger:**
```bash
# Find RAG service
RAG_URL=$(curl -s https://api.rmatool.org.uk/api/admin/workers | \
  jq -r '.workers[] | .containers[] | select(.name=="gpu-worker") | .service_url' | head -1)

# Trigger ingestion
curl -X POST $RAG_URL/ingest-all-manuals
```

## Production Deployment

### Multi-Node Setup

Deploy components on separate hosts for better reliability:

```
Node 1 (GPU Host):
  - GPU Worker
  - RAG Orchestrator

Node 2 (Storage Host):
  - ChromaDB Worker
  - Persistent Volume (SSD recommended)

Node 3 (Optional CPU Host):
  - CPU Worker(s)
```

### Monitoring

Monitor system health:

```bash
# Watch orchestrator logs
docker logs -f rag-orchestrator

# Check worker heartbeats
while true; do
  curl -s https://api.rmatool.org.uk/api/admin/workers | \
    jq '.workers[] | {id: .worker_id, status: .status, last_heartbeat: .last_heartbeat}'
  sleep 30
done
```

### Backup Strategy

**ChromaDB Data:**
```bash
# Backup vector database
docker run --rm \
  -v chromadb_data:/data \
  -v /backups:/backup \
  ubuntu tar czf /backup/chromadb-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm \
  -v chromadb_data:/data \
  -v /backups:/backup \
  ubuntu tar xzf /backup/chromadb-20251204.tar.gz -C /
```

**Training Manuals:**
```bash
# Keep versioned copies
/opt/rma/manuals/
├── v1.0/
│   ├── debt-advice-handbook.pdf
│   └── fca-guidelines.pdf
└── v1.1/
    ├── debt-advice-handbook.pdf
    ├── fca-guidelines-updated.pdf
    └── new-regulations.pdf
```

## Advanced Configuration

### Custom Ingestion Schedule

Modify orchestrator to re-ingest on schedule:

```python
# In orchestrator.py
import schedule

def scheduled_ingestion():
    """Re-ingest manuals daily at 3 AM"""
    if time.strftime("%H:%M") == "03:00":
        self.ingestion_triggered = False  # Reset flag
        
schedule.every().day.at("03:00").do(scheduled_ingestion)
```

### Manual Override

Disable orchestrator and trigger manually:

```bash
# Stop orchestrator
docker stop rag-orchestrator

# Manual ingestion
RAG_URL=$(curl -s https://api.rmatool.org.uk/api/admin/workers | \
  jq -r '.workers[] | .containers[] | select(.name=="gpu-worker") | .service_url' | head -1)

curl -X POST $RAG_URL/ingest-all-manuals
```

### Multiple GPU Workers

Load balance queries across multiple GPU workers:

```bash
# Node 1
docker run -d --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# Node 2
docker run -d --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# Coordinator automatically load balances
```

## Next Steps

1. **Make packages public**: Follow `GITHUB_PACKAGES_PUBLIC_SETUP.md`
2. **Test deployment**: Deploy all three components
3. **Monitor logs**: Ensure orchestrator triggers ingestion
4. **Test queries**: Verify "Ask the Manuals" works in frontend
5. **Add more manuals**: Expand knowledge base
6. **Scale workers**: Add more GPU/CPU workers as needed

## Support

**Documentation:**
- Worker Deployment: `docs/deployment/worker-deployment.md`
- RAG Architecture: `RAG_ARCHITECTURE_GUIDE.md`
- Coordinator Setup: `RMA-Demo/cloudflare-worker-coordinator/README.md`

**Logs:**
```bash
docker logs rma-gpu-worker
docker logs rma-chromadb-worker
docker logs rag-orchestrator
```

**Coordinator Status:**
```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq '.'
```
