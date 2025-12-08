# RMA System - Complete Documentation

**Last Updated:** December 8, 2025

This document consolidates all RMA-Demo documentation into a single, up-to-date reference.

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [Getting Started - Local](#getting-started-local)
3. [Getting Started - Distributed](#getting-started-distributed)
4. [Architecture Overview](#architecture-overview)
5. [Worker Management](#worker-management)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)

---

## Quick Start

### What is RMA?

RMA is a distributed AI system for debt advice and document processing, designed to run on zero-cost infrastructure using Cloudflare's global network and volunteer compute nodes.

**Live System:**
- Frontend: https://rmatool.org.uk
- Edge Router: https://api.rmatool.org.uk
- Edge Coordinator: https://edge-1.rmatool.org.uk

---

## Getting Started - Local

**Perfect for:** Development, testing, single-machine deployments

### Prerequisites

- Docker & Docker Compose
- 8GB RAM minimum (16GB recommended)
- 20GB free disk space
- (Optional) NVIDIA GPU with 8GB+ VRAM

### Quick Setup (5 Minutes)

```bash
cd RMA-Demo

# Start edge coordinator
docker compose -f edge-coordinator.yml up -d

# Verify
docker ps
curl http://localhost:8080/health
```

**Access Points:**
- Coordinator: http://localhost:8080
- Frontend: https://rmatool.org.uk (or deploy locally)
- System Status: Frontend → System tab

### What's Running

```
edge-coordinator  - FastAPI coordinator (port 8080)
edge-tunnel       - Cloudflare tunnel (connects to api.rmatool.org.uk)
edge-registrar    - Auto-registers coordinator with Cloudflare
```

### Next Steps

1. **Add Workers** - Deploy CPU/GPU workers to process requests
2. **Monitor** - Check System tab for registered workers
3. **Use** - Upload documents, ask questions, analyze debts

---

## Getting Started - Distributed

**Perfect for:** Production, multiple machines, volunteer networks

### Architecture

```
Users → Frontend (Cloudflare Pages)
     → Edge Router (Cloudflare Worker)  
     → Edge Coordinators (Your machines)
     → Workers (Distributed compute)
```

### Prerequisites

**Coordinator Machine:**
- 2GB RAM, 1 CPU core
- Docker installed
- Always-on internet connection

**Worker Machines (optional):**
- CPU: 4GB+ RAM, 4+ cores
- GPU: NVIDIA GPU, 8GB+ VRAM
- Can be behind NAT/firewalls

### Deployment Steps

#### 1. Deploy Edge Coordinator

On your coordinator machine:

```bash
cd RMA-Demo

# Start with Cloudflare Tunnel
docker compose -f edge-coordinator.yml up -d

# Verify tunnel connection
docker logs edge-tunnel
# Should see: ✅ Registered tunnel connection

# Verify coordinator registration  
docker logs edge-registrar
# Should see: ✅ Registered as edge coordinator
```

#### 2. Deploy Workers

**Same Machine (Local):**
```bash
cd RMA-Demo/worker-containers/cpu-worker
export COORDINATOR_URL=http://localhost:8080
docker compose up -d
```

**Different Machine (Remote):**
```bash
cd RMA-Demo/worker-containers/cpu-worker
export COORDINATOR_URL=https://edge-1.rmatool.org.uk
docker compose up -d
```

**With GPU:**
```bash
cd RMA-Demo/worker-containers/gpu-worker
export COORDINATOR_URL=https://edge-1.rmatool.org.uk
docker compose up -d
```

#### 3. Verify Deployment

```bash
# Check coordinator is registered globally
curl https://api.rmatool.org.uk/health
# "coordinators": 1

# Check workers registered locally
curl http://localhost:8080/api/admin/workers
# Lists all registered workers

# Or use the frontend
# https://rmatool.org.uk → System tab
```

### Configuration

**Environment Variables:**

```bash
# Required
COORDINATOR_URL=https://edge-1.rmatool.org.uk

# Optional
WORKER_TYPE=cpu          # or "gpu" (auto-detected)
USE_TUNNEL=true          # Create Cloudflare tunnel
SERVICE_PORT=8103        # Service port number
SERVICE_NAME=upload      # Service identifier
```

### Network Restrictions

If your IT blocks Cloudflare:

```bash
# Workers can connect via local network
export COORDINATOR_URL=http://COORDINATOR_IP:8080

# Edge coordinator still works locally
# External access won't work, but internal network will
```

---

## Architecture Overview

### Layer 1: Edge Routing (Cloudflare Global)

**URL:** https://api.rmatool.org.uk  
**Type:** Cloudflare Worker with KV storage

**Responsibilities:**
- Route requests to available edge coordinators
- Store coordinator registry (auto-expire after 5min timeout)
- Handle authentication
- Deployed globally across 300+ Cloudflare datacenters

**Cost:** $0/month (100K requests/day free tier)

### Layer 2: Edge Coordination (Distributed)

**URL:** https://edge-1.rmatool.org.uk (and edge-2, edge-3, etc.)  
**Type:** FastAPI Python service

**Responsibilities:**
- Worker registration and health monitoring
- Service routing and load balancing
- Tier assignment (GPU/CPU/Storage)
- Container assignment logic
- Runs on volunteer hardware via Cloudflare Tunnels

**Cost:** $0 (runs on your machines)

### Layer 3: Workers (Distributed Compute)

**Types:**
- **Tier 1 (GPU):** vLLM, Vision Models (requires GPU)
- **Tier 2 (CPU):** RAG, Notes, NER, Document Processing
- **Tier 3 (Storage):** PostgreSQL, Neo4j, Redis, ChromaDB

**Connection Methods:**
- Local: Direct connection via localhost
- Remote: Cloudflare Tunnels or public IPs
- NAT: Works behind firewalls with tunnel

**Cost:** $0 (runs on volunteer hardware)

### Layer 4: Frontend (Static CDN)

**URL:** https://rmatool.org.uk  
**Type:** Next.js static export on Cloudflare Pages

**Features:**
- Global CDN distribution
- Automatic SSL
- Zero-downtime deployments
- Connect via API proxy to coordinators

**Cost:** $0/month (unlimited bandwidth on free tier)

---

## Worker Management

### Worker Types

**CPU Worker (Tier 2):**
```bash
cd worker-containers/cpu-worker
docker compose up -d
```

Services: upload-service, rag-service, notes-service, ner-service  
Ports: 8103, 8102, 8100, 8108

**GPU Worker (Tier 1):**
```bash
cd worker-containers/gpu-worker
docker compose --profile gpu up -d
```

Services: vllm-inference, vision-models  
Requires: NVIDIA GPU, nvidia-docker runtime

**Universal Worker:**
```bash
cd worker-containers/universal-worker
docker compose up -d
```

Auto-detects capabilities and runs appropriate services.

### Worker Configuration

**docker-compose.yml override:**
```yaml
services:
  worker:
    environment:
      - COORDINATOR_URL=https://edge-1.rmatool.org.uk
      - WORKER_TYPE=cpu
      - USE_TUNNEL=true
```

**Environment file (.env.coordinator):**
```bash
COORDINATOR_URL=http://localhost:8080
```

### Monitoring Workers

**Check registration:**
```bash
curl http://localhost:8080/api/admin/workers | jq
```

**View stats:**
```bash
curl http://localhost:8080/api/admin/stats | jq
```

**Frontend:**
- Go to https://rmatool.org.uk
- Click "System" tab
- See all registered workers, health, load, services

### Scaling

**Add more workers:**
```bash
# On any machine
cd RMA-Demo/worker-containers/cpu-worker
export COORDINATOR_URL=https://edge-1.rmatool.org.uk
docker compose up -d
```

Workers auto-register and are immediately available for work.

**Remove workers:**
```bash
docker compose down
# Worker auto-unregisters after heartbeat timeout (60s)
```

---

## Troubleshooting

### Edge Coordinator Won't Start

**Problem:** Container exits immediately

**Solutions:**
```bash
# Check logs
docker logs edge-coordinator

# Common issues:
# 1. Port 8080 already in use
sudo lsof -i :8080
# Kill the process or change port

# 2. Permission issues
sudo chown -R $USER:$USER .

# 3. Docker network issues
docker network prune
docker compose -f edge-coordinator.yml up -d
```

### Cloudflare Tunnel Not Connecting

**Problem:** "Connection refused" or timeout errors

**Solutions:**
```bash
# Check tunnel logs
docker logs edge-tunnel

# Verify DNS
ping api.cloudflare.com

# If IT blocks Cloudflare:
# - Workers must connect via local network
# - External access won't work
# - Use: COORDINATOR_URL=http://LOCAL_IP:8080
```

### Workers Not Registering

**Problem:** Workers don't appear in System tab

**Solutions:**
```bash
# 1. Check coordinator URL
echo $COORDINATOR_URL

# 2. Test connectivity
curl $COORDINATOR_URL/health

# 3. Check worker logs
docker logs cpu-worker-1

# 4. Verify network
# Same machine: use localhost:8080
# Different machine: use coordinator's IP or tunnel URL

# 5. Check firewall
# Port 8080 must be accessible from worker machine
```

### Services Return 503

**Problem:** API calls fail with "Service Unavailable"

**Solutions:**
```bash
# 1. Check if workers are registered
curl http://localhost:8080/api/admin/workers

# 2. Check worker services are running
docker exec -it cpu-worker-1 curl localhost:8103/health

# 3. Restart worker
docker compose restart

# 4. Check service logs
docker logs cpu-worker-1
```

### Frontend Can't Connect

**Problem:** Frontend shows "No workers available"

**Solutions:**
```bash
# 1. Check coordinator is registered
curl https://api.rmatool.org.uk/health

# 2. Verify edge coordinator is running
docker ps | grep edge-coordinator

# 3. Check edge registrar logs
docker logs edge-registrar

# 4. Test direct coordinator access
curl https://edge-1.rmatool.org.uk/health
```

---

## API Reference

### Coordinator Endpoints

**Base URL:** `http://localhost:8080` or `https://edge-1.rmatool.org.uk`

#### Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2025-12-08T00:00:00Z"
}
```

#### List Workers
```bash
GET /api/admin/workers

Response:
[
  {
    "worker_id": "worker-123",
    "tier": 2,
    "status": "healthy",
    "current_load": 0.15,
    "capabilities": {
      "cpu_cores": 24,
      "ram": "94GB",
      "worker_type": "cpu"
    },
    "services": ["upload", "rag", "notes", "ner"],
    "last_heartbeat": "2025-12-08T00:00:00Z"
  }
]
```

#### System Stats
```bash
GET /api/admin/stats

Response:
{
  "total_workers": 3,
  "healthy_workers": 3,
  "by_tier": {
    "1": 1,  // GPU workers
    "2": 2,  // CPU workers  
    "3": 0   // Storage workers
  }
}
```

#### Worker Registration
```bash
POST /api/worker/register

Body:
{
  "worker_id": "my-worker-123",
  "tunnel_url": "https://tunnel.example.com",
  "capabilities": {
    "cpu_cores": 8,
    "ram": "16GB",
    "worker_type": "cpu"
  },
  "services": [
    {"name": "upload-service", "port": 8103},
    {"name": "rag-service", "port": 8102}
  ]
}

Response:
{
  "worker_id": "my-worker-123",
  "tier": 2,
  "assigned_services": ["upload", "rag", "notes", "ner"],
  "heartbeat_interval": 30
}
```

#### Worker Heartbeat
```bash
POST /api/worker/heartbeat

Body:
{
  "worker_id": "my-worker-123",
  "status": "healthy",
  "current_load": 0.25,
  "available_memory": "12GB"
}

Response:
{
  "status": "acknowledged",
  "next_heartbeat": 30
}
```

### Edge Router Endpoints

**Base URL:** `https://api.rmatool.org.uk`

#### Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "coordinators": 1,
  "message": "Edge router operational"
}
```

#### Edge Coordinator Registration
```bash
POST /api/edge/register

Body:
{
  "worker_id": "edge-coord-1",
  "worker_type": "edge",
  "tunnel_url": "https://edge-1.rmatool.org.uk",
  "services": ["coordinator", "edge-proxy"]
}

Response:
{
  "worker_id": "edge-coord-1",
  "role": "edge_coordinator",
  "tunnel_url": "https://edge-1.rmatool.org.uk",
  "status": "registered",
  "heartbeat_interval": 60
}
```

### Service Proxy

**Upload Service:**
```bash
POST https://api.rmatool.org.uk/api/service/upload/documents
# Proxied to worker's upload-service:8103
```

**RAG Service:**
```bash
POST https://api.rmatool.org.uk/api/service/rag/query
# Proxied to worker's rag-service:8102
```

**Notes Service:**
```bash
POST https://api.rmatool.org.uk/api/service/notes/extract
# Proxied to worker's notes-service:8100
```

**NER Service:**
```bash
POST https://api.rmatool.org.uk/api/service/ner/extract
# Proxied to worker's ner-service:8108
```

---

## Summary

**RMA is a distributed AI system that:**

1. ✅ Runs on $0/month infrastructure (Cloudflare free tier)
2. ✅ Scales horizontally with volunteer workers
3. ✅ Works behind NAT/firewalls with Cloudflare Tunnels
4. ✅ Auto-registers and load-balances workers
5. ✅ Provides debt advice, document processing, RAG, NER
6. ✅ Deploys in 5 minutes locally or globally

**Key URLs:**
- Frontend: https://rmatool.org.uk
- Edge Router: https://api.rmatool.org.uk
- Your Coordinator: https://edge-1.rmatool.org.uk (or http://localhost:8080)

**Next Steps:**
1. Deploy edge coordinator (5 min)
2. Add workers (2 min each)
3. Monitor via System tab
4. Start processing documents

For detailed guides, see the Frontend Documentation tab at https://rmatool.org.uk
