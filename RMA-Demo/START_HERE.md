# 🚀 RMA-Demo Cloudflare Deployment - START HERE

## Welcome!

This guide will help you deploy the RMA-Demo distributed system to Cloudflare in under 30 minutes, with **$0/month** hosting cost.

## What You'll Build

```
┌──────────────────────────────────────────────┐
│ Frontend: rmatool.org.uk                     │
│ (Cloudflare Pages - Global CDN)             │
└────────────────┬─────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────┐
│ API: api.rmatool.org.uk                      │
│ (Your server + Cloudflare Tunnel)           │
└────────────────┬─────────────────────────────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
      ▼          ▼          ▼
   CPU       GPU       Data
  Worker    Worker    Worker
  (Docker) (Docker) (Docker)
```

## 📚 Documentation

Choose your path:

### 🎯 Quick Deploy (Recommended)
- **File**: `QUICK_DEPLOY.md`
- **Who**: Just want to get it running
- **Time**: 15-30 minutes
- **Content**: Commands only, minimal explanation

### 📖 Detailed Deploy
- **File**: `DEPLOY_NOW.md`
- **Who**: Want to understand each step
- **Time**: 30-45 minutes
- **Content**: Full explanations, alternatives, troubleshooting

### 🏗️ Architecture Guide
- **File**: `CLOUDFLARE_DEPLOYMENT_COMPLETE.md`
- **Who**: Want full system understanding
- **Time**: Read at your leisure
- **Content**: Complete architecture, scaling, security

## ⚡ 3-Step Quick Start

### 1. Deploy Frontend
```bash
# Go to: https://dash.cloudflare.com
# Workers & Pages → Create → Connect GitHub
# Configure build and deploy
# Add custom domain: rmatool.org.uk
```
**Time**: 5 minutes
**Result**: https://rmatool.org.uk is live

### 2. Deploy Coordinator
```bash
cd /home/user/CMACatalyst/RMA-Demo
./setup-api-tunnel.sh
./start-coordinator.sh
```
**Time**: 10 minutes
**Result**: https://api.rmatool.org.uk is live

### 3. Deploy Workers
```bash
cd worker-containers
./start-cpu-worker.sh
# If you have GPU:
./start-gpu-worker.sh
```
**Time**: 5 minutes
**Result**: Workers registered and processing

## ✅ Verify Deployment

```bash
# Frontend
curl https://rmatool.org.uk

# API
curl https://api.rmatool.org.uk/health

# Workers
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Open in browser
open https://rmatool.org.uk
```

## 🔧 Key Scripts

| Script | Purpose |
|--------|---------|
| `setup-api-tunnel.sh` | One-time setup for coordinator tunnel |
| `start-coordinator.sh` | Start coordinator + tunnel |
| `stop-coordinator.sh` | Stop coordinator + tunnel |
| `worker-containers/start-cpu-worker.sh` | Start CPU worker |
| `worker-containers/start-gpu-worker.sh` | Start GPU worker |

## 📊 Management

### Monitor System
```bash
# Watch worker stats (refreshes every 5s)
watch -n 5 'curl -s https://api.rmatool.org.uk/api/admin/stats | jq'

# View logs
tail -f coordinator.log
tail -f tunnel.log
cd worker-containers/cpu-worker && docker compose logs -f
```

### Restart Services
```bash
# Coordinator
./stop-coordinator.sh && ./start-coordinator.sh

# Workers
cd worker-containers/cpu-worker
docker compose restart
```

## 💰 Cost

**Total: $0/month**

- Frontend (Cloudflare Pages): $0
- Coordinator (Local + Tunnel): $0
- Workers (Donated compute): $0

No credit card required for free tier.

## 🆘 Troubleshooting

### Frontend not working
```bash
# Check Cloudflare Pages deployment status
# Dashboard: https://dash.cloudflare.com → Workers & Pages

# Check DNS
dig rmatool.org.uk
```

### API not accessible
```bash
# Check coordinator running
curl http://localhost:8080/health

# Check tunnel running
ps aux | grep cloudflared

# Restart
./stop-coordinator.sh && ./start-coordinator.sh
```

### Workers not connecting
```bash
# Test coordinator from worker
curl https://api.rmatool.org.uk/health

# Check worker logs
docker compose logs -f

# Restart
docker compose restart
```

## 📁 File Structure

```
RMA-Demo/
├── START_HERE.md                    ← You are here
├── QUICK_DEPLOY.md                  ← Quick reference
├── DEPLOY_NOW.md                    ← Detailed guide
├── CLOUDFLARE_DEPLOYMENT_COMPLETE.md ← Full documentation
│
├── setup-api-tunnel.sh              ← Setup coordinator tunnel
├── start-coordinator.sh             ← Start coordinator
├── stop-coordinator.sh              ← Stop coordinator
│
├── frontend/
│   ├── .env.production              ← Production config
│   └── wrangler.toml                ← Cloudflare Pages config
│
├── coordinator-service/
│   └── app/                         ← FastAPI coordinator
│
└── worker-containers/
    ├── start-cpu-worker.sh          ← Start CPU worker
    ├── start-gpu-worker.sh          ← Start GPU worker
    ├── cpu-worker/
    │   └── docker-compose.override.yml  ← Production config
    └── gpu-worker/
        └── docker-compose.override.yml  ← Production config
```

## 🎓 Learn More

- **Cloudflare Pages**: https://developers.cloudflare.com/pages/
- **Cloudflare Tunnels**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **System Architecture**: See `ARCHITECTURE.md`

## 🎯 Next Steps After Deployment

1. ✅ Deploy system (follow guides above)
2. 🔐 Add authentication (API keys for workers)
3. 📊 Set up monitoring (Prometheus/Grafana)
4. 🚀 Scale workers (deploy on more machines)
5. 🔒 Enhance security (rate limiting, CORS)

## 🎉 Ready to Deploy?

Pick your guide:
- **Quick Start**: → `QUICK_DEPLOY.md`
- **Detailed Guide**: → `DEPLOY_NOW.md`

Let's get started! 🚀

---

**Need help?** Check the troubleshooting sections in each guide.
**Found a bug?** Check the logs and error messages.
**Want to contribute?** Deploy workers on your machines!
