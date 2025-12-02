# Frontend Access in RMA Distributed System

## Overview

The RMA system has **two main architectures** for accessing the frontend, depending on your deployment mode:

1. **Distributed Mode** - Coordinator + Workers (for production/community deployments)
2. **Standalone Mode** - All-in-one Docker Compose (for local development/testing)

---

## Architecture 1: Distributed System (Production)

### How It Works

```
┌─────────────┐
│   Browser   │
│  (User)     │
└──────┬──────┘
       │
       │ http://localhost:3000 or https://rma-frontend.yourdomain.com
       │
┌──────▼──────────────────────────────────────┐
│         Frontend Container                   │
│         (Next.js App)                        │
│         - Port 3000                          │
│         - Makes API calls via proxy routes   │
└──────┬──────────────────────────────────────┘
       │
       │ API calls go through Next.js API routes
       │ /api/coordinator/* → Coordinator
       │ /api/services/* → Worker Services
       │
┌──────▼──────────────────────────────────────┐
│      Coordinator Service                     │
│      https://api.rmatool.org.uk         │
│      - Manages worker registry               │
│      - Routes inference requests             │
│      - Admin dashboard API                   │
└──────┬──────────────────────────────────────┘
       │
       │ Routes requests to appropriate workers
       │
   ┌───┴────┬─────────┬─────────────┐
   │        │         │             │
┌──▼──┐  ┌─▼──┐   ┌──▼──┐      ┌───▼───┐
│GPU  │  │GPU │   │Svc  │      │Data   │
│Work1│  │Work2│  │Work1│      │Work1  │
└─────┘  └────┘   └─────┘      └───────┘
```

### Setup Instructions

#### 1. Deploy Coordinator (if not already running)

```bash
cd /home/user/CMACatalyst/RMA-Demo/coordinator-service

# Deploy to Fly.io
fly deploy

# Or run locally
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

**Coordinator URL**: `https://api.rmatool.org.uk` or `http://localhost:8080`

#### 2. Start CPU Workers (Already Done!)

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker
docker compose up -d --scale cpu-worker=4
```

✅ Your 4 workers are now running and registered with the coordinator!

#### 3. Deploy Frontend with Coordinator Integration

Create a new docker-compose file for frontend with coordinator:

```yaml
# /home/user/CMACatalyst/RMA-Demo/docker-compose.frontend-distributed.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: rma-frontend-distributed
    ports:
      - "3000:3000"
    environment:
      # Coordinator URL (change to your deployed coordinator)
      - NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk
      
      # For system orchestrator dashboard
      - NEXT_PUBLIC_API_URL=http://localhost:3000
      
      # These services are accessed via coordinator
      - NEXT_PUBLIC_RAG_SERVICE_URL=http://localhost:3000/api/rag
      - NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://localhost:3000/api/upload
      - NEXT_PUBLIC_NER_SERVICE_URL=http://localhost:3000/api/ner
    restart: unless-stopped
    networks:
      - rma-network

networks:
  rma-network:
    external: true  # Connect to same network as workers if local
```

**Start the frontend:**

```bash
cd /home/user/CMACatalyst/RMA-Demo
docker compose -f docker-compose.frontend-distributed.yml up -d
```

#### 4. Access the Application

Open your browser to:

**Main Application**: http://localhost:3000

Available features:
- **System Orchestrator Dashboard**: View all workers, their status, and system health
  - Navigate to: http://localhost:3000/orchestrator (or wherever the SystemOrchestrator component is mounted)
  
- **RAG Query Interface**: Ask questions to the RAG system
  - Navigate to: http://localhost:3000/advisor-dashboard or similar
  
- **Admin Dashboard**: Full system monitoring
  - Navigate to coordinator directly: https://api.rmatool.org.uk/api/admin/workers

### How Requests Flow

1. **User opens browser** → http://localhost:3000
2. **User queries RAG system** → Frontend makes API call to `/api/rag/query`
3. **Next.js API route** → Proxies to coordinator: `https://api.rmatool.org.uk/api/inference/rag/query`
4. **Coordinator** → Finds available Tier 2 worker running RAG service
5. **Coordinator** → Routes request to worker's RAG container
6. **Worker processes** → Returns response
7. **Response flows back** → Coordinator → Frontend → User

---

## Architecture 2: Standalone Mode (Local Development)

### How It Works

```
┌─────────────┐
│   Browser   │
│  (User)     │
└──────┬──────┘
       │
       │ http://localhost:3000
       │
┌──────▼──────────────────────────────────────┐
│         Frontend Container                   │
└──────┬──────────────────────────────────────┘
       │
       │ Direct service calls (same Docker network)
       │
   ┌───┴────┬─────────┬─────────────┐
   │        │         │             │
┌──▼──┐  ┌─▼──┐   ┌──▼──┐      ┌───▼───┐
│Ollama  │RAG  │   │Notes│      │Upload │
│:11434  │:8102│   │:8100│      │:8103  │
└────────┘──────┘   └─────┘      └───────┘
```

### Setup Instructions

```bash
cd /home/user/CMACatalyst/RMA-Demo

# Use the all-in-one docker-compose
docker compose -f docker-compose-separated.yml up -d

# Or the simple version
docker compose -f docker-compose.yml up -d
```

**Access**: http://localhost:3000

This mode doesn't use the coordinator - all services run in the same Docker network and communicate directly.

---

## Current Setup Analysis

Based on your running workers, here's what you have:

```bash
# Check your workers
docker ps --filter "name=cpu-worker"
```

You have **4 CPU workers** running as **Tier 2** (Service Workers).

### What This Means:

- ✅ Workers are registered with coordinator
- ✅ Each worker can run service containers (RAG, Notes, NER)
- ⚠️ No frontend container running yet
- ⚠️ Coordinator needs to route frontend API calls

### To See Your Workers in Action:

**Option 1: View in Coordinator Admin API**

```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

**Option 2: Start Frontend with System Orchestrator**

The frontend has a built-in `SystemOrchestrator` component that shows:
- All registered workers
- Their status (healthy/degraded/offline)
- Their assigned containers
- System load and statistics

---

## Worker Timeout Configuration (FIXED!)

I've updated the coordinator to keep workers alive longer:

- **Before**: Workers marked offline after 2 minutes, removed after 10 minutes
- **After**: Workers marked offline after 5 minutes, removed after 30 minutes

This gives workers more grace time if they're processing heavy workloads or have temporary network hiccups.

**File Updated**: `/home/user/CMACatalyst/RMA-Demo/coordinator-service/models/worker.py`

### To Apply the Change:

If coordinator is deployed on Fly.io:
```bash
cd /home/user/CMACatalyst/RMA-Demo/coordinator-service
fly deploy
```

If running locally:
```bash
# Restart the coordinator
pkill -f "uvicorn.*coordinator"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

---

## Quick Start: Complete Setup

Here's the complete command sequence to get everything running:

```bash
# 1. Start coordinator (if not already deployed)
cd /home/user/CMACatalyst/RMA-Demo/coordinator-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 &

# 2. Workers are already running! ✅
# (Your 4 cpu-worker containers)

# 3. Start frontend with coordinator integration
cd /home/user/CMACatalyst/RMA-Demo

# Option A: Build and run frontend with coordinator URL
docker build -t rma-frontend:latest ./frontend
docker run -d \
  --name rma-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_COORDINATOR_URL=http://host.docker.internal:8080 \
  rma-frontend:latest

# 4. Access application
xdg-open http://localhost:3000  # Linux
```

---

## Environment Variables Reference

### Frontend Container

```bash
# Coordinator (for distributed mode)
NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk

# API proxy base (for internal routing)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Service URLs (proxied through frontend API routes)
NEXT_PUBLIC_RAG_SERVICE_URL=http://localhost:3000/api/rag
NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://localhost:3000/api/upload
NEXT_PUBLIC_NER_SERVICE_URL=http://localhost:3000/api/ner
NEXT_PUBLIC_NEO4J_BROWSER_URL=http://localhost:7474
```

### Worker Containers

```bash
# Coordinator URL (set automatically by compose file)
COORDINATOR_URL=https://api.rmatool.org.uk

# Worker ID (assigned by coordinator on registration)
WORKER_ID=worker-abc12345  # Auto-generated

# Service-specific variables (assigned by coordinator)
# For RAG workers:
OLLAMA_URL=http://ollama:11434
CHROMADB_HOST=chromadb
CHROMADB_PORT=8000
```

---

## Monitoring Your Setup

### Check Worker Status

```bash
# View all workers
curl http://localhost:8080/api/admin/workers | jq

# View system statistics  
curl http://localhost:8080/api/admin/stats | jq

# Check system health
curl http://localhost:8080/api/admin/health | jq
```

### Check Worker Logs

```bash
# All workers
docker logs cpu-worker-cpu-worker-1
docker logs cpu-worker-cpu-worker-2
docker logs cpu-worker-cpu-worker-3
docker logs cpu-worker-cpu-worker-4

# Follow logs
docker logs -f cpu-worker-cpu-worker-1
```

### View Worker Heartbeats

```bash
# Check if heartbeats are being sent
docker logs cpu-worker-cpu-worker-1 | grep "Heartbeat"
```

---

## Troubleshooting

### Workers Scale Down Quickly

**Issue**: Workers being marked offline and removed
**Solution**: Updated timeouts (already fixed!)
- Offline threshold: 2 min → 5 min
- Removal threshold: 10 min → 30 min

### Frontend Can't Connect to Coordinator

**Issue**: CORS errors or connection refused
**Solution**: 
1. Check coordinator is running: `curl http://localhost:8080/health`
2. Update `NEXT_PUBLIC_COORDINATOR_URL` in frontend env
3. Check network connectivity between containers

### Workers Not Processing Requests

**Issue**: Workers registered but not receiving tasks
**Solution**:
1. Check worker is healthy: `curl http://localhost:8080/api/admin/workers`
2. Verify worker containers are running: `docker ps`
3. Check coordinator logs for routing decisions

---

## Next Steps

1. **Deploy Coordinator to Fly.io** (if not already done)
   ```bash
   cd coordinator-service
   fly deploy
   ```

2. **Build Frontend with Coordinator URL**
   ```bash
   cd frontend
   docker build --build-arg NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk -t rma-frontend .
   ```

3. **Scale Workers as Needed**
   ```bash
   docker compose up -d --scale cpu-worker=8  # Scale to 8 workers
   ```

4. **Add GPU Workers** (if you have GPU available)
   ```bash
   cd worker-containers/gpu-worker
   docker compose up -d --scale gpu-worker=2
   ```

---

## Summary

✅ **What's Working:**
- 4 CPU workers registered and running
- Workers sending heartbeats to coordinator
- Workers staying alive longer (updated timeouts)

🚀 **Next Actions:**
- Deploy/start coordinator (if not running)
- Build and deploy frontend with coordinator URL
- Access http://localhost:3000 to see system orchestrator dashboard
- Watch your distributed system in action!

**Frontend Access**: http://localhost:3000 → Makes API calls → Coordinator routes to workers → Workers process → Response back to frontend

Welcome to your distributed AI infrastructure! 🎉
