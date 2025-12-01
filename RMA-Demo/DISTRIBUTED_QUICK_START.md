# RMA Distributed System - Quick Start Guide

Get your distributed RMA system running in 15 minutes!

## Overview

You're about to set up a **democratized compute pool** where:
- A minimal coordinator runs on free-tier hosting
- Workers can dynamically join/leave, donating compute power
- The system auto-routes workloads to appropriate workers
- You can monitor everything via admin dashboard

## Prerequisites

- **Coordinator**: None! (runs on free tier: Fly.io, Railway, Render)
- **Workers**: Docker installed, optionally GPU for Tier 1 workers

---

## Step 1: Deploy Coordinator (5 minutes)

### Option A: Fly.io (Recommended - Free Tier)

```bash
# Navigate to coordinator
cd RMA-Demo/coordinator-service

# Install flyctl (if not installed)
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (first time)
fly launch --name rma-coordinator --region lhr --org personal

# Deploy
fly deploy

# Get URL
fly status
# Your coordinator is now at: https://rma-coordinator.fly.dev
```

### Option B: Railway (Free Tier)

1. Push code to GitHub
2. Go to https://railway.app
3. New Project → Deploy from GitHub
4. Select your repo → `coordinator-service` folder
5. Railway auto-detects Dockerfile
6. Click Deploy!
7. Get URL from Railway dashboard

### Option C: Local Testing

```bash
cd RMA-Demo/coordinator-service

# Install dependencies
pip install -r requirements.txt

# Run locally
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080

# Coordinator running at: http://localhost:8080
```

### Verify Deployment

```bash
# Test coordinator health
curl https://rma-coordinator.fly.dev/health

# Should return:
# {
#   "status": "healthy",
#   "workers": {"total": 0, "by_tier": {...}, "healthy": 0}
# }
```

---

## Step 2: Start Worker Agent (5 minutes)

Workers auto-detect hardware and register with coordinator.

### Install Worker Agent

```bash
cd RMA-Demo/worker-agent

# Install dependencies
pip install -r requirements.txt

# Optional: GPU support
pip install gputil
```

### Test Capability Detection

```bash
# See what tier you'll be assigned
python worker_agent.py --test-capabilities

# Example output:
# {
#   "gpu_memory": "24564MB",
#   "gpu_type": "NVIDIA RTX 4090",
#   "cpu_cores": 16,
#   "ram": "64.0GB"
# }
# → Will be assigned Tier 1 (GPU worker)
```

### Run Worker Agent

```bash
# Connect to production coordinator
python worker_agent.py --coordinator https://rma-coordinator.fly.dev

# Or local testing
python worker_agent.py --coordinator http://localhost:8080
```

**What happens next:**
1. Worker detects hardware capabilities
2. Registers with coordinator
3. Gets assigned tier (1=GPU, 2=Service, 3=Data)
4. Downloads container image
5. Starts container
6. Begins sending heartbeats every 30 seconds

### Example Output

```
============================================================
RMA Worker Agent
============================================================
🔍 Detecting hardware capabilities...
✅ Detected GPU: NVIDIA RTX 4090 (24564MB)
✅ CPU Cores: 16
✅ RAM: 64.0GB
✅ Storage: 1024.5GB

📡 Registering with coordinator: https://rma-coordinator.fly.dev

✅ Registered successfully!
   Worker ID: worker-abc12345
   Tier: 1
   Assigned containers: 1
     - rma-vllm-worker (port 8000)

🐳 Starting 1 container(s)...
📥 Pulling image: ghcr.io/rma/vllm-worker:latest
✅ Image pulled
✅ Container started: rma-vllm-worker

✅ Worker is now active and running!
   Press Ctrl+C to stop gracefully

💓 Heartbeat sent (load: 23%)
```

---

## Step 3: Access Admin Dashboard (5 minutes)

### Option A: Run Locally

```bash
cd RMA-Demo/admin-dashboard

# Install dependencies
npm install

# Update coordinator URL in vite.config.js if needed
# Then run
npm run dev

# Dashboard at: http://localhost:3001
```

### Option B: Deploy to Vercel (Free)

```bash
cd RMA-Demo/admin-dashboard

# Install Vercel CLI
npm i -g vercel

# Build
npm run build

# Deploy
vercel deploy --prod

# Update proxy in vite.config.js to point to your coordinator
```

### Dashboard Features

You should now see:
- **Total Workers**: 1 (your worker)
- **Worker Details**: ID, tier, status, load, containers
- **System Health**: Status indicators
- **Auto-refresh**: Every 5 seconds

---

## Step 4: Test Inference (2 minutes)

### Test LLM Inference (Tier 1 Worker)

```bash
curl -X POST https://rma-coordinator.fly.dev/api/inference/llm \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2:7b",
    "prompt": "Explain quantum computing in one sentence.",
    "max_tokens": 100
  }'
```

### Test RAG Query (Tier 2 Worker)

First, start a Tier 2 worker (on a machine without GPU):

```bash
# On a different machine (or same machine)
python worker_agent.py --coordinator https://rma-coordinator.fly.dev
# This will be assigned Tier 2 (Service worker)

# Then test RAG
curl -X POST https://rma-coordinator.fly.dev/api/inference/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is RMA?"}'
```

---

## Architecture at a Glance

```
┌─────────────────────────────────────────┐
│  Coordinator (Free Tier)                │
│  https://rma-coordinator.fly.dev        │
│  - Worker registry                      │
│  - Request routing                      │
│  - Health monitoring                    │
└────────────┬────────────────────────────┘
             │
   ┌─────────┴──────────┬──────────────┐
   │                    │              │
┌──▼────────────┐  ┌────▼──────────┐  │
│ GPU Worker 1  │  │ GPU Worker 2  │  │
│ (Your PC)     │  │ (Friend's PC) │  │
│ Tier 1        │  │ Tier 1        │  │
│ vLLM          │  │ Vision/OCR    │  │
└───────────────┘  └───────────────┘  │
                                      │
┌───────────────┐  ┌───────────────┐ │
│Service Worker │  │Service Worker │ │
│ (Cloud VM)    │  │ (Raspberry Pi)│◄┘
│ Tier 2        │  │ Tier 3        │
│ RAG + Notes   │  │ Redis Cache   │
└───────────────┘  └───────────────┘
```

---

## Cost Breakdown

### Before (Centralized)
- GPU server: **$500-1000/month**

### After (Distributed)
- Coordinator: **$0/month** (free tier)
- Domain (optional): **$1/month**
- Workers: **$0** (donated by community)

**Total: ~$1/month** (99.9% cost reduction!)

---

## Scaling Up

### Add More Workers

Just run worker agent on more machines:

```bash
# On Machine 2
python worker_agent.py --coordinator https://rma-coordinator.fly.dev

# On Machine 3
python worker_agent.py --coordinator https://rma-coordinator.fly.dev

# Check dashboard - worker count increases!
```

### Worker Tiers Auto-Balance

- **Tier 1** (GPU): vLLM and Vision workers auto-balance
- **Tier 2** (Service): RAG, Notes, NER auto-distribute
- **Tier 3** (Data): Databases auto-assign

Coordinator intelligently assigns containers based on current distribution.

---

## Running as a Service

### Linux (systemd)

```bash
sudo nano /etc/systemd/system/rma-worker.service
```

Add:
```ini
[Unit]
Description=RMA Worker Agent
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=youruser
Environment="COORDINATOR_URL=https://rma-coordinator.fly.dev"
WorkingDirectory=/path/to/worker-agent
ExecStart=/usr/bin/python3 /path/to/worker-agent/worker_agent.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable rma-worker
sudo systemctl start rma-worker
sudo systemctl status rma-worker
```

### Docker Compose

```yaml
version: '3.8'
services:
  rma-worker:
    build: ./worker-agent
    environment:
      COORDINATOR_URL: https://rma-coordinator.fly.dev
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

---

## Troubleshooting

### Coordinator not starting

```bash
# Check logs
fly logs

# Or locally
python -m uvicorn app.main:app --reload
```

### Worker can't register

```bash
# Test connection
curl https://rma-coordinator.fly.dev/health

# Check Docker is running
docker ps

# Check worker logs
python worker_agent.py  # Run in foreground
```

### GPU not detected

```bash
# NVIDIA
nvidia-smi

# Install NVIDIA Container Toolkit
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

# AMD
rocm-smi
```

### Dashboard shows no workers

```bash
# Verify workers registered
curl https://rma-coordinator.fly.dev/api/admin/workers

# Check CORS settings in coordinator
# Check proxy config in admin-dashboard/vite.config.js
```

---

## Next Steps

1. **Register Domain** (optional)
   - Buy domain: Namecheap, Google Domains ($10/year)
   - Point to Fly.io: `fly certs add yourdomain.com`

2. **Build Worker Containers**
   ```bash
   cd worker-containers
   docker build -t ghcr.io/rma/vllm-worker:latest vllm/
   docker push ghcr.io/rma/vllm-worker:latest
   ```

3. **Add Authentication** (for public dashboard)
   - Add JWT authentication to coordinator
   - Protect admin endpoints

4. **Monitoring**
   - Add Prometheus metrics
   - Set up Grafana dashboards
   - Configure alerts (Slack, email)

5. **Worker Incentives** (future)
   - Credit system for compute donations
   - Priority queue for contributors
   - Community leaderboard

---

## Summary

You've just deployed a **distributed, democratized compute pool**!

- ✅ Coordinator running on free tier
- ✅ Workers dynamically joining/leaving
- ✅ Intelligent workload routing
- ✅ Real-time monitoring dashboard
- ✅ **99.9% cost reduction**

**Total setup time**: ~15 minutes
**Total cost**: ~$1/month
**Scalability**: Unlimited (add more workers anytime)

Welcome to democratized AI infrastructure! 🚀
