# Zero-Cost Deployment Guide

Deploy the RMA distributed system with **absolutely zero hosting costs** using only Cloudflare's free tier.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Edge (FREE)                                     │
│  - api.rmatool.org.uk                                       │
│  - Durable Objects (coordinator registry)                  │
│  - 100K requests/day, 1K writes/day                         │
└────────────┬───────────────────────────────────────────────┘
             │ Routes to →
             ├──────────────┬──────────────┬──────────────┐
             │              │              │              │
    ┌────────▼────┐  ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼─────┐
    │ Edge Coord  │  │ Edge Coord │ │ Edge Coord │ │   ...    │
    │ (UK)        │  │ (US)       │ │ (EU)       │ │          │
    │ Volunteer   │  │ Volunteer  │ │ Volunteer  │ │ Volunteer│
    │ Hardware    │  │ Hardware   │ │ Hardware   │ │ Hardware │
    └─────────────┘  └────────────┘ └────────────┘ └──────────┘
```

**Cost: $0/month** 🎉

## Step 1: Deploy Cloudflare Edge Router (5 minutes)

### Prerequisites
- Cloudflare account (free)
- Domain pointed to Cloudflare (or use workers.dev subdomain)

### Deploy

```bash
cd services/cloudflare-edge-router
npm install
npx wrangler login
npx wrangler deploy
```

**Output:**
```
✨ Deployed rma-edge-router
   https://rma-edge-router.<your-name>.workers.dev
```

### Add Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click on `rma-edge-router`
3. Go to "Custom Domains" tab
4. Add `api.rmatool.org.uk` (or your domain)

**Done!** Your edge router is now live globally. No servers to manage, no bills.

## Step 2: Bootstrap First Edge Coordinator (1 command)

Ask a contributor with an always-on machine to run:

```bash
# On any Linux machine, Windows WSL, or Mac
curl -fsSL https://raw.githubusercontent.com/st7ma784/CMACatalyst/master/RMA-Demo/edge-coordinator.yml -o edge-coordinator.yml

docker-compose -f edge-coordinator.yml up -d
```

**What this does:**
1. Starts local coordinator
2. Creates Cloudflare Tunnel (free)
3. Registers at `api.rmatool.org.uk`
4. Becomes available globally

**No configuration needed!** It just works.

## Step 3: Add More Edge Coordinators (Optional)

Anyone can run the same command! Each coordinator:
- Auto-registers with edge router
- Accepts worker connections
- Shares load with other coordinators

```bash
# Friend in US runs:
docker-compose -f edge-coordinator.yml up -d

# Friend in EU runs:
docker-compose -f edge-coordinator.yml up -d

# University lab runs:
docker-compose -f edge-coordinator.yml up -d
```

**Geographic distribution = lower latency for everyone!**

## Step 4: Start GPU/CPU Workers

Contributors with compute to donate:

```bash
# Auto-detection (GPU if available, else CPU)
docker run -d \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=auto \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

Workers automatically:
1. Connect to `api.rmatool.org.uk`
2. Get routed to nearest edge coordinator
3. Register with that coordinator
4. Start processing tasks

## Verification

### Check Edge Router

```bash
curl https://api.rmatool.org.uk/health
```

Expected:
```json
{
  "status": "healthy",
  "coordinators": 3,
  "message": "Edge router operational"
}
```

### Check Registered Coordinators

```bash
curl https://api.rmatool.org.uk/api/admin/coordinators
```

Expected:
```json
[
  {
    "worker_id": "edge-uk-1",
    "tunnel_url": "https://abc123.trycloudflare.com",
    "location": "uk",
    "registered_at": 1733437200000
  },
  {
    "worker_id": "edge-us-1", 
    "tunnel_url": "https://xyz789.trycloudflare.com",
    "location": "us",
    "registered_at": 1733437300000
  }
]
```

## Cost Breakdown

| Service | Free Tier | Usage | Cost |
|---------|-----------|-------|------|
| Cloudflare Workers | 100K req/day | ~10K req/day | $0 |
| Durable Objects | 1K writes/day | ~50 writes/day | $0 |
| Cloudflare Tunnels | Unlimited | Unlimited | $0 |
| Edge Coordinators | N/A | Volunteer hardware | $0 |
| GPU/CPU Workers | N/A | Volunteer hardware | $0 |
| **Total** | | | **$0** |

## What If Edge Router Hits Limits?

**Cloudflare Workers:** 100K requests/day
- With 100 active workers × 2,880 heartbeats/day = 288K requests
- If you hit this: Workers heartbeat to coordinators, not edge router ✅

**Durable Objects:** 1K writes/day
- 20 coordinators register once = 20 writes
- Heartbeats use expiry-based cleanup = 0 writes
- Total: ~50 writes/day ✅

**You won't hit the limits** with this architecture!

## Scaling

**With 1 Edge Coordinator:**
- Can handle 100+ workers
- Single point of failure (if it goes down, system stops)

**With 3+ Edge Coordinators:**
- Can handle 1000+ workers
- Automatic failover
- Geographic distribution

**Recommended:**
- Start with 1 coordinator (your friend's server)
- Add more as you get contributors
- Each new coordinator adds redundancy + capacity

## Troubleshooting

### "No coordinators available" Error

**Problem:** Edge router can't find any coordinators

**Solution:** Start at least one edge coordinator:
```bash
docker-compose -f edge-coordinator.yml up -d
```

### Edge Coordinator Not Registering

**Check logs:**
```bash
docker-compose -f edge-coordinator.yml logs edge-registrar
```

**Common issues:**
- Tunnel failed to create (retry: `docker-compose restart tunnel`)
- Edge router URL wrong (check COORDINATOR_URL env var)

### Worker Can't Connect

**Check edge router health:**
```bash
curl https://api.rmatool.org.uk/health
```

**If healthy but workers can't connect:**
- Check worker logs: `docker logs <worker-container>`
- Verify COORDINATOR_URL=https://api.rmatool.org.uk

## Next Steps

1. **Deploy edge router** (you, 5 min)
2. **Get 1 coordinator running** (friend with always-on PC, 1 min)
3. **Tell contributors to run workers** (docker run command)
4. **Turn off your desktop** and sleep well! 😴

Everything runs on volunteer hardware with Cloudflare providing the free global routing layer.
