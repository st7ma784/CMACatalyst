# Deploy RMA-Demo 100% on Cloudflare

Everything on Cloudflare's edge network - **$0/month** cost!

## 🎯 What You'll Deploy

```
Frontend (Cloudflare Pages)
    ↓ API calls
Coordinator (Cloudflare Workers + KV)
    ↓ Registration & heartbeats
Workers (Anywhere - Docker containers)
```

**All hosted on Cloudflare!**

---

## ⚡ Quick Start (3 Steps)

### Step 1: Deploy Coordinator (10 minutes)

```bash
cd /home/user/CMACatalyst/RMA-Demo/cloudflare-worker-coordinator

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create KV namespace for worker storage
npx wrangler kv:namespace create WORKERS

# You'll get output like:
# { binding = "WORKERS", id = "abc123..." }

# Create preview namespace
npx wrangler kv:namespace create WORKERS --preview

# You'll get:
# { binding = "WORKERS", preview_id = "xyz789..." }
```

**Update `wrangler.toml`** with your KV IDs:
```toml
[[kv_namespaces]]
binding = "WORKERS"
id = "abc123..."          # <-- Your production ID
preview_id = "xyz789..."  # <-- Your preview ID
```

**Deploy:**
```bash
npx wrangler deploy

# Output will show your Worker URL:
# https://rma-coordinator.your-subdomain.workers.dev
```

**Add custom domain:**
```bash
npx wrangler deploy --route "api.rmatool.org.uk/*"
```

**Test it:**
```bash
curl https://api.rmatool.org.uk/health
# {"status":"healthy","edge":true}
```

✅ **Coordinator deployed!**

---

### Step 2: Deploy Frontend (5 minutes)

1. **Go to Cloudflare Dashboard:**
   - https://dash.cloudflare.com/
   - **Workers & Pages** → **Create application** → **Pages**

2. **Connect GitHub:**
   - Select your repo
   - Configure build:
     ```
     Build command: cd RMA-Demo/frontend && npm ci && npm run build
     Build output: RMA-Demo/frontend/.next
     Root directory: (leave empty)
     ```

3. **Environment variables:**
   ```
   NEXT_PUBLIC_API_URL=https://api.rmatool.org.uk
   NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk
   ```

4. **Deploy!**

5. **Add custom domain:**
   - In Pages settings: **Custom domains** → **Set up a domain**
   - Enter: `rmatool.org.uk`

✅ **Frontend deployed!**

---

### Step 3: Start Workers (5 minutes)

Workers are already configured for `api.rmatool.org.uk`:

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers

# Start CPU worker
./start-cpu-worker.sh

# Start GPU worker (if available)
./start-gpu-worker.sh
```

Workers will auto-register with your Cloudflare Worker coordinator!

✅ **Workers connected!**

---

## ✅ Verify Deployment

```bash
# Test frontend
curl https://rmatool.org.uk

# Test coordinator
curl https://api.rmatool.org.uk/health
# {"status":"healthy","edge":true}

# Check registered workers
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Check stats
curl https://api.rmatool.org.uk/api/admin/stats | jq
```

**Open in browser:**
```bash
open https://rmatool.org.uk
```

Upload a file and verify it processes!

---

## 📊 Cloudflare Dashboard

Monitor everything in one place:

### Coordinator (Workers)
- URL: https://dash.cloudflare.com/ → Workers & Pages → rma-coordinator
- View: Requests, errors, CPU time, logs

### KV Storage
- URL: https://dash.cloudflare.com/ → Workers & Pages → KV
- Browse: Worker registrations, heartbeats

### Frontend (Pages)
- URL: https://dash.cloudflare.com/ → Workers & Pages → rma-frontend
- View: Deployments, analytics, build logs

### DNS
- URL: https://dash.cloudflare.com/ → DNS
- Verify: `api.rmatool.org.uk` and `rmatool.org.uk`

---

## 💰 Cost: **$0/month**

Everything on free tier:

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| Workers | 100K req/day | ~10K/day | $0 |
| KV Reads | 100K/day | ~5K/day | $0 |
| KV Writes | 1K/day | ~300/day (3 workers) | $0 |
| Pages | Unlimited | Unlimited | $0 |
| DNS | Unlimited | 2 records | $0 |
| **Total** | | | **$0** |

---

## 🔧 Management Commands

### Update Coordinator

```bash
cd cloudflare-worker-coordinator

# Edit worker.js
vim worker.js

# Deploy changes
npx wrangler deploy

# Live in seconds!
```

### View Logs

```bash
# Real-time coordinator logs
npx wrangler tail

# Or in dashboard:
# Workers & Pages → rma-coordinator → Logs
```

### Update Frontend

```bash
# Just push to GitHub - auto-deploys!
git add .
git commit -m "Update frontend"
git push origin master

# Or manual deploy:
cd frontend
npm run build
npx wrangler pages deploy .next --project-name=rma-frontend
```

### Monitor Workers

```bash
# Watch worker stats
watch -n 5 'curl -s https://api.rmatool.org.uk/api/admin/stats | jq'

# List all workers
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

---

## 🚀 Scaling

### Current Capacity (Free Tier)

- **Frontend**: Unlimited bandwidth and requests
- **Coordinator**: 100,000 requests/day
- **Workers**: Unlimited (1,000+ workers supported)
- **KV Storage**: 1GB (stores millions of worker records)

### Add More Workers

On any machine with Docker:

```bash
git clone <your-repo>
cd RMA-Demo/worker-containers

# Start worker
./start-cpu-worker.sh

# It auto-registers with coordinator!
```

### When You Need Paid Tier

Only when you exceed:
- 100,000 coordinator requests/day (~69/minute)
- 1,000 KV writes/day (new worker registrations)

For most use cases, **free tier is enough**!

---

## 🎯 Architecture Benefits

**Why 100% Cloudflare?**

1. **Unified Management**
   - Everything in one dashboard
   - Single account, single bill ($0!)
   - Consistent security policies

2. **Performance**
   - Frontend on edge (300+ locations)
   - Coordinator on edge (global)
   - Sub-10ms response times

3. **Reliability**
   - Cloudflare's 100% uptime SLA
   - Auto-scaling
   - DDoS protection included

4. **Cost**
   - $0/month baseline
   - Only pay if you scale massively
   - No surprise bills

5. **Simplicity**
   - No servers to manage
   - No SSH keys
   - No security patches
   - Just code and deploy

---

## 📚 Full Documentation

- **Coordinator Deploy**: `cloudflare-worker-coordinator/DEPLOY.md`
- **Worker Code**: `cloudflare-worker-coordinator/worker.js`
- **Options Comparison**: `COORDINATOR_OPTIONS.md`
- **Architecture**: `CLOUDFLARE_DEPLOYMENT_COMPLETE.md`

---

## 🐛 Troubleshooting

### Coordinator not deploying

```bash
# Check wrangler login
npx wrangler whoami

# Check KV namespace exists
npx wrangler kv:namespace list

# Verify wrangler.toml has correct IDs
cat wrangler.toml
```

### Custom domain not working

```bash
# Check routes
npx wrangler deployments list

# Or add via dashboard:
# Workers & Pages → rma-coordinator → Triggers → Add Custom Domain
```

### Workers not registering

```bash
# Test coordinator from worker
curl https://api.rmatool.org.uk/health

# Check worker logs
docker compose logs -f

# Verify coordinator URL
docker compose exec cpu-worker env | grep COORDINATOR
```

### KV data not persisting

```bash
# Check KV binding in wrangler.toml
cat wrangler.toml | grep -A 3 "kv_namespaces"

# View KV data
npx wrangler kv:key list --namespace-id=YOUR_KV_ID

# Test KV in dev mode
npx wrangler dev
curl http://localhost:8787/api/admin/workers
```

---

## ✅ Deployment Checklist

- [ ] Wrangler CLI installed and logged in
- [ ] KV namespace created (production + preview)
- [ ] wrangler.toml updated with KV IDs
- [ ] Coordinator deployed and responding
- [ ] Custom domain added (api.rmatool.org.uk)
- [ ] Frontend deployed to Pages
- [ ] Custom domain added (rmatool.org.uk)
- [ ] Environment variables set in Pages
- [ ] Workers started and registered
- [ ] End-to-end test: Upload → Process → Results

---

## 🎉 Success!

When everything is working, you'll have:

✅ Frontend at: **https://rmatool.org.uk**
✅ API at: **https://api.rmatool.org.uk**
✅ Workers registered and processing
✅ All on Cloudflare's edge network
✅ **$0/month cost**

**Your distributed AI platform is now live!** 🚀

---

## Next Steps

1. ✅ Everything deployed
2. 🔄 Add more workers (on any machine)
3. 🔄 Monitor via Cloudflare dashboard
4. 🔄 Scale as needed (still $0/month)
5. 🔄 Add authentication (optional)

---

## Need Help?

- **Wrangler**: https://developers.cloudflare.com/workers/wrangler/
- **Workers**: https://developers.cloudflare.com/workers/
- **Pages**: https://developers.cloudflare.com/pages/
- **KV**: https://developers.cloudflare.com/kv/

**Check logs first:**
```bash
npx wrangler tail  # Coordinator logs
```
