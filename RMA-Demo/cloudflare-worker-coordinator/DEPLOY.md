# Deploy RMA Coordinator to Cloudflare Workers

Complete guide to deploy the coordinator **100% on Cloudflare**.

## Architecture

```
Frontend (Cloudflare Pages)
    ↓
Coordinator (Cloudflare Workers + KV)
    ↓
Workers (Anywhere with Docker)
```

**Everything on Cloudflare's edge network!**

---

## Prerequisites

- Cloudflare account (free)
- Domain: `rmatool.org.uk` added to Cloudflare
- Node.js installed (for wrangler CLI)

---

## Step 1: Install Wrangler

```bash
cd /home/user/CMACatalyst/RMA-Demo/cloudflare-worker-coordinator

# Install dependencies
npm install

# Or install wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

---

## Step 2: Create KV Namespace

KV (Key-Value) stores the worker registry persistently.

```bash
# Create production KV namespace
wrangler kv:namespace create WORKERS

# Output will be something like:
# 🌀 Creating namespace with title "rma-coordinator-WORKERS"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "WORKERS", id = "abc123..." }

# Create preview KV namespace (for testing)
wrangler kv:namespace create WORKERS --preview

# Output:
# { binding = "WORKERS", preview_id = "xyz789..." }
```

**Copy the IDs from the output!**

---

## Step 3: Update wrangler.toml

Edit `wrangler.toml` and replace the KV IDs:

```toml
[[kv_namespaces]]
binding = "WORKERS"
id = "abc123..."  # Replace with your production ID
preview_id = "xyz789..."  # Replace with your preview ID
```

---

## Step 4: Deploy Worker

```bash
# Deploy to Cloudflare
wrangler deploy

# Output:
# ✨ Built successfully
# ✨ Uploaded rma-coordinator
# ✨ Deployed rma-coordinator
# 🌎 https://rma-coordinator.your-subdomain.workers.dev
```

**Your coordinator is now live!** Test it:

```bash
curl https://rma-coordinator.your-subdomain.workers.dev/health
# {"status":"healthy","edge":true}
```

---

## Step 5: Configure Custom Domain

### Option A: Via Wrangler (Recommended)

```bash
# Add custom domain route
wrangler deploy --route "api.rmatool.org.uk/*"
```

### Option B: Via Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com/
2. Select your domain: `rmatool.org.uk`
3. Go to: **Workers & Pages** → **rma-coordinator**
4. Click: **Triggers** → **Add Custom Domain**
5. Enter: `api.rmatool.org.uk`
6. Click: **Add Custom Domain**

### Option C: Update wrangler.toml

Uncomment and update in `wrangler.toml`:

```toml
routes = [
  { pattern = "api.rmatool.org.uk/*", zone_name = "rmatool.org.uk" }
]
```

Then redeploy:
```bash
wrangler deploy
```

---

## Step 6: Test Production Deployment

```bash
# Test health endpoint
curl https://api.rmatool.org.uk/health

# Should return:
# {"status":"healthy","edge":true}

# Test stats (should be empty initially)
curl https://api.rmatool.org.uk/api/admin/stats

# Should return:
# {"total_workers":0,"healthy_workers":0,"offline_workers":0,"by_tier":{"1":0,"2":0,"3":0}}
```

---

## Step 7: Update Workers

Workers are already configured to use `api.rmatool.org.uk`, so no changes needed!

Just start them:

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers

# Start CPU worker
./start-cpu-worker.sh

# Start GPU worker (if available)
./start-gpu-worker.sh
```

Workers will automatically register with the Cloudflare Worker coordinator!

---

## Verify Everything Works

### 1. Check Worker Registration

```bash
# List registered workers
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Should show your workers
```

### 2. Check Stats

```bash
curl https://api.rmatool.org.uk/api/admin/stats | jq

# Should show:
# {
#   "total_workers": 1,
#   "healthy_workers": 1,
#   "offline_workers": 0,
#   "by_tier": { "1": 0, "2": 1, "3": 0 }
# }
```

### 3. Monitor in Real-Time

```bash
# Watch workers (refreshes every 5s)
watch -n 5 'curl -s https://api.rmatool.org.uk/api/admin/workers | jq'
```

---

## Cloudflare Dashboard Monitoring

### View Worker Analytics

1. Go to: https://dash.cloudflare.com/
2. Navigate to: **Workers & Pages** → **rma-coordinator**
3. View:
   - **Requests**: Real-time request counts
   - **Errors**: Error rates and logs
   - **CPU Time**: Performance metrics
   - **KV Operations**: Storage usage

### View KV Data

1. Go to: **Workers & Pages** → **KV**
2. Select: **rma-coordinator-WORKERS**
3. Browse stored workers

---

## Development & Testing

### Test Locally

```bash
# Run dev server with KV emulation
wrangler dev

# Test at http://localhost:8787
curl http://localhost:8787/health
```

### View Logs

```bash
# Tail production logs
wrangler tail

# Or view in dashboard:
# Workers & Pages → rma-coordinator → Logs
```

### Update Coordinator

```bash
# Edit worker.js
vim worker.js

# Deploy changes
wrangler deploy

# Changes are live in seconds!
```

---

## Cost Breakdown

### Cloudflare Workers (Free Tier)

| Resource | Free Tier | Cost |
|----------|-----------|------|
| Requests | 100,000/day | $0 |
| CPU Time | 10ms per request | $0 |
| KV Reads | 100,000/day | $0 |
| KV Writes | 1,000/day | $0 |
| KV Storage | 1 GB | $0 |

**For RMA Coordinator:**
- Worker registrations: ~10 writes/day
- Heartbeats: ~2,880 writes/day (1 worker × 30s interval)
- Stats queries: ~1,000 reads/day

**Total: $0/month** (well within free tier)

### Paid Tier (if needed)

- $5/month for 10M requests
- $0.50 per additional 1M requests
- $0.50/GB KV storage above 1GB

---

## Scaling

### Current Capacity (Free Tier)

- **Workers**: 1,000+ workers
- **Requests**: 100,000/day = ~69 requests/minute
- **Heartbeats**: Supports hundreds of workers
- **KV Storage**: 1GB = ~1M worker records

### When to Scale to Paid

You'll need paid tier when:
- More than 100,000 API requests/day
- More than 1,000 worker registrations/day
- More than 1GB of stored data

For most use cases, **free tier is plenty**!

---

## Troubleshooting

### "KV namespace not found"

```bash
# Check KV namespaces
wrangler kv:namespace list

# Verify IDs in wrangler.toml match
```

### "Route not found"

```bash
# Check routes
wrangler deployments list

# Verify custom domain in dashboard
# Workers & Pages → rma-coordinator → Triggers
```

### "Error 1000: DNS points to prohibited IP"

Your DNS might not be set correctly:

```bash
# Check DNS
dig api.rmatool.org.uk

# Should point to Cloudflare Workers, not an IP
```

Fix: Add route via dashboard instead of DNS record.

### Workers not registering

```bash
# Test coordinator from worker location
curl https://api.rmatool.org.uk/health

# Check worker logs
docker compose logs -f

# Verify COORDINATOR_URL
docker compose exec cpu-worker env | grep COORDINATOR
```

---

## Production Checklist

- [ ] KV namespace created
- [ ] wrangler.toml updated with KV IDs
- [ ] Worker deployed successfully
- [ ] Custom domain configured (api.rmatool.org.uk)
- [ ] Health endpoint responding
- [ ] Frontend deployed to Cloudflare Pages
- [ ] Workers configured with coordinator URL
- [ ] At least one worker registered
- [ ] Stats endpoint showing correct data

---

## Next Steps

1. ✅ Coordinator deployed to Cloudflare Workers
2. ✅ Custom domain configured
3. 🔄 Deploy frontend to Cloudflare Pages
4. 🔄 Start workers
5. 🔄 Monitor via dashboard

**Everything is now 100% on Cloudflare!** 🎉

---

## Useful Commands

```bash
# Deploy
wrangler deploy

# Test locally
wrangler dev

# View logs
wrangler tail

# List deployments
wrangler deployments list

# Check KV data
wrangler kv:key list --namespace-id=YOUR_KV_ID

# Delete deployment
wrangler delete
```

---

## Support

- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Workers Docs**: https://developers.cloudflare.com/workers/
- **KV Docs**: https://developers.cloudflare.com/kv/
- **Troubleshooting**: Check logs via `wrangler tail`
