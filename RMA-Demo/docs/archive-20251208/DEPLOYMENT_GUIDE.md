# RMA Platform Deployment Guide

This guide covers deploying all components of the RMA distributed platform.

## 🌐 Edge Router (Cloudflare Workers)

The edge router at `api.rmatool.org.uk` handles coordinator registration and routes requests.

### Manual Deployment

```bash
cd services/cloudflare-edge-router
./deploy.sh
```

Or using wrangler directly:

```bash
cd services/cloudflare-edge-router
npx wrangler login
npx wrangler deploy
```

### Automatic Deployment (GitHub Actions)

The edge router automatically deploys when code changes are pushed to the `services/cloudflare-edge-router/` directory.

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers Deploy permission
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

**How to get these:**

1. **API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Create Token → Use "Edit Cloudflare Workers" template
   - Copy the token

2. **Account ID**:
   - Go to https://dash.cloudflare.com
   - Select your domain
   - Copy Account ID from the sidebar

3. **Add to GitHub**:
   - Repository → Settings → Secrets and variables → Actions
   - Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

### Verify Deployment

```bash
curl https://api.rmatool.org.uk/health
# Should return: {"status":"healthy","coordinators":1,"message":"Edge router operational"}

curl https://api.rmatool.org.uk/api/admin/coordinators
# Should return: List of registered coordinators
```

## 📡 Coordinator (Local/Edge Deployment)

Coordinators manage workers and handle DHT coordination.

### Deploy Coordinator

```bash
cd /path/to/deployment
docker-compose -f edge-coordinator.yml up -d
```

This starts:
- Coordinator service (port 8080, DHT port 8468/udp)
- Cloudflare Tunnel
- Edge registrar worker

### Verify Coordinator

```bash
# Check coordinator health
curl http://localhost:8080/health

# Check via tunnel
curl https://edge-1.rmatool.org.uk/health

# Check DHT stats (if deployed)
curl https://edge-1.rmatool.org.uk/api/dht/stats
```

## 🖥️ Frontend (Cloudflare Pages)

The frontend at `rmatool.org.uk` is deployed via Cloudflare Pages.

### Environment Variables

Set these in Cloudflare Pages dashboard:

```bash
NEXT_PUBLIC_API_URL=https://edge-1.rmatool.org.uk
NEXT_PUBLIC_COORDINATOR_URL=https://edge-1.rmatool.org.uk
```

### Build Settings

- **Framework preset**: Next.js
- **Build command**: `npm run build`
- **Build output directory**: `.next`
- **Root directory**: `frontend`

### Manual Build

```bash
cd frontend
npm install
npm run build
```

## 🤖 Universal Workers

Contributors deploy workers to donate compute resources.

### Auto-Detection Worker

```bash
docker pull ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
docker run -d --name rma-worker --restart unless-stopped \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=auto \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Storage Worker

```bash
docker run -d --name rma-storage --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=storage \
  -v ./chroma-data:/chroma/chroma \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

## 🔍 Troubleshooting

### Edge Router Not Responding

**Issue**: `api.rmatool.org.uk` returns errors

**Solutions**:
1. Check if edge router is deployed: `npx wrangler deployments list`
2. Redeploy: `cd services/cloudflare-edge-router && ./deploy.sh`
3. Check Cloudflare dashboard for errors

### Coordinator Not Registering

**Issue**: No coordinators show up at `/api/admin/coordinators`

**Solutions**:
1. Check coordinator logs: `docker logs edge-coordinator`
2. Verify tunnel is running: `docker logs edge-tunnel`
3. Check registrar logs: `docker logs edge-registrar`
4. Manually register:
   ```bash
   curl -X POST https://api.rmatool.org.uk/api/edge/register \
     -H "Content-Type: application/json" \
     -d '{"worker_id":"test","tunnel_url":"https://edge-1.rmatool.org.uk","capabilities":{"location":"test"}}'
   ```

### Frontend Connection Error

**Issue**: "Make sure the coordinator service is running"

**Solutions**:
1. Check frontend env vars point to coordinator (not edge router for admin endpoints)
2. Verify coordinator is accessible: `curl https://edge-1.rmatool.org.uk/health`
3. Rebuild frontend with correct `NEXT_PUBLIC_API_URL`

### DHT Not Working

**Issue**: DHT topology shows no nodes

**Solutions**:
1. Check coordinator has DHT enabled: `curl https://edge-1.rmatool.org.uk/api/dht/stats`
2. Verify UDP port 8468 is exposed: `docker ps` (should show `8468/udp`)
3. Check workers have DHT support in requirements.txt
4. Review coordinator startup logs for DHT initialization

## 📊 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Network                       │
├─────────────────────────────────────────────────────────────┤
│  api.rmatool.org.uk (Edge Router - Workers)                 │
│    ↓ Routes to coordinators                                 │
│  rmatool.org.uk (Frontend - Pages)                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Tunnels (NAT Traversal)             │
├─────────────────────────────────────────────────────────────┤
│  edge-1.rmatool.org.uk → Local Coordinator                  │
│  edge-2.rmatool.org.uk → Another Coordinator                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   Local Coordinators                        │
├─────────────────────────────────────────────────────────────┤
│  • Manage workers in their region                           │
│  • DHT node (port 8468/udp)                                 │
│  • Service assignment & load balancing                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  Universal Workers (P2P)                    │
├─────────────────────────────────────────────────────────────┤
│  • GPU Workers (Tier 1): vLLM, Vision AI                   │
│  • CPU Workers (Tier 2): RAG, NER, Document Processing      │
│  • Storage Workers (Tier 3): ChromaDB, Redis, PostgreSQL    │
│  • Edge Workers (Tier 4): Regional coordinators            │
│  • P2P communication via DHT (99.95% less coordinator load) │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Deployment Checklist

- [ ] Deploy edge router to Cloudflare Workers
- [ ] Configure GitHub secrets for auto-deployment
- [ ] Deploy at least 1 coordinator
- [ ] Verify coordinator registers with edge router
- [ ] Deploy frontend to Cloudflare Pages with correct env vars
- [ ] Test frontend connects to coordinator
- [ ] Deploy at least 1 worker for testing
- [ ] Verify DHT topology shows nodes (if DHT enabled)

## 📝 Notes

- **Zero-cost architecture**: All free tiers (Cloudflare Workers, Pages, Tunnels)
- **Scales to 2000+ workers**: DHT-based P2P service discovery
- **Auto-healing**: Workers auto-reconnect, stale registrations cleaned up
- **Global edge**: Cloudflare's network provides <50ms latency worldwide
