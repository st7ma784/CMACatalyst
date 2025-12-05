# Cloudflare Edge Router

Global entry point for the RMA distributed worker system. Routes workers to edge coordinators with zero hosting costs.

## Architecture

```
User/Worker → api.rmatool.org.uk (Cloudflare Edge) → Edge Coordinators → Workers
                        ↑
                   Durable Object
                (Coordinator Registry)
```

## Features

- **Zero hosting costs** (Cloudflare free tier)
- **Global distribution** (Cloudflare edge network)
- **Persistent storage** (Durable Objects, 1K writes/day free)
- **Auto-failover** (routes around dead coordinators)

## Deployment

### 1. Install Wrangler

```bash
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Deploy

```bash
npx wrangler deploy
```

This deploys to `https://rma-edge-router.<your-subdomain>.workers.dev`

### 4. Set Custom Domain (Optional)

In Cloudflare dashboard:
1. Go to Workers & Pages
2. Find `rma-edge-router`
3. Click "Custom Domains"
4. Add `api.rmatool.org.uk`

## API Endpoints

### Edge Coordinator Registration
```
POST /api/edge/register
{
  "worker_id": "edge-uk-1",
  "worker_type": "edge",
  "tunnel_url": "https://abc123.trycloudflare.com",
  "role": "edge_coordinator"
}
```

### Worker Registration (Routed to Coordinator)
```
POST /api/worker/register
{
  "worker_id": "gpu-1",
  "worker_type": "gpu",
  "capabilities": { ... }
}
```

### Health Check
```
GET /health
```

### Admin Dashboard
```
GET /api/admin/coordinators
```

## Cost Analysis

**Durable Objects (Free Tier):**
- 1M reads/day ✅
- 1K writes/day ✅
- Unlimited storage (up to 1 GB)

**Expected Usage:**
- Edge coordinator registrations: 5-20 writes (one-time)
- Heartbeats: Can be batched or use expiry-based cleanup
- Worker registrations: Routed to coordinators (0 writes to DO)
- Total writes: < 100/day ✅

**Worker Requests (Free Tier):**
- 100K requests/day ✅
- Most requests are routed (pass-through), minimal processing

## Local Development

```bash
npx wrangler dev
```

This starts a local server at `http://localhost:8787`

## Monitoring

```bash
# View live logs
npx wrangler tail

# Check deployed version
npx wrangler deployments list
```
