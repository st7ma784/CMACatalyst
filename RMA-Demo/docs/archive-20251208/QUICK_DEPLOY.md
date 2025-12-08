# Quick Deploy Guide - RMA-Demo on Cloudflare

Get your distributed RMA system running in 30 minutes.

## Prerequisites

- Domain registered with Cloudflare: `rmatool.org.uk`
- Docker installed
- Git repository access
- Cloudflare account

---

## Step 1: Deploy Frontend (5 minutes)

### Via Cloudflare Dashboard

1. **Go to Cloudflare Dashboard**
   - https://dash.cloudflare.com/
   - Navigate to: **Workers & Pages**

2. **Create Pages Project**
   - Click **Create application** → **Pages** → **Connect to Git**
   - Connect your GitHub repo
   - Configure:
     ```
     Project name: rma-frontend
     Production branch: master
     Framework preset: Next.js
     Build command: cd RMA-Demo/frontend && npm ci && npm run build
     Build output: RMA-Demo/frontend/.next
     Root directory: (leave empty)
     ```

3. **Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://api.rmatool.org.uk
   NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk
   ```

4. **Deploy**
   - Click **Save and Deploy**
   - Wait for build (5-10 minutes)
   - Note your URL: `rma-frontend.pages.dev`

5. **Custom Domain**
   - Go to: **Custom domains** → **Set up a domain**
   - Enter: `rmatool.org.uk`
   - Cloudflare configures DNS automatically

**✅ Frontend deployed at: https://rmatool.org.uk**

---

## Step 2: Deploy Coordinator (10 minutes)

### On your local machine or server

```bash
cd /home/user/CMACatalyst/RMA-Demo

# Run the setup script
./setup-api-tunnel.sh
```

This will:
- Install cloudflared
- Authenticate with Cloudflare (opens browser)
- Create tunnel named "rma-api"
- Configure DNS: `api.rmatool.org.uk`
- Create `tunnel-api.yml` config file

### Start the Coordinator

```bash
# Quick start (runs in background)
./start-coordinator.sh
```

Or manually in separate terminals:

```bash
# Terminal 1: Start coordinator
cd coordinator-service
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8080

# Terminal 2: Start tunnel
cloudflared tunnel --config tunnel-api.yml run rma-api
```

### Test It

```bash
curl https://api.rmatool.org.uk/health
# Should return: {"status":"healthy"}

curl https://api.rmatool.org.uk/api/admin/stats
# Should return: {"total_workers":0,...}
```

**✅ Coordinator deployed at: https://api.rmatool.org.uk**

---

## Step 3: Deploy Workers (10 minutes)

### CPU Worker

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers

# Start CPU worker
./start-cpu-worker.sh
```

Watch the logs - you should see:
```
✅ Tunnel active: https://xxxxx.trycloudflare.com
✅ Registered successfully!
   Worker ID: worker-abc123
   Tier: 2
💓 Heartbeat sent
```

### GPU Worker (if you have GPU)

```bash
# Start GPU worker
./start-gpu-worker.sh
```

### Verify Workers Registered

```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

You should see your workers listed with their tunnel URLs.

**✅ Workers connected and registered**

---

## Step 4: Test End-to-End (5 minutes)

### Open the Frontend

```bash
open https://rmatool.org.uk
```

### Test File Upload

1. Click "Upload" or navigate to upload page
2. Select a file
3. Upload it
4. Verify:
   - File uploads successfully
   - Processing happens on a worker
   - Results are displayed

### Monitor System

```bash
# Watch worker stats
watch -n 5 'curl -s https://api.rmatool.org.uk/api/admin/stats | jq'

# View coordinator logs
tail -f coordinator.log

# View worker logs
cd worker-containers/cpu-worker
docker compose logs -f
```

**✅ System is live and processing requests!**

---

## Architecture Overview

```
User → rmatool.org.uk (Cloudflare Pages)
         ↓
       api.rmatool.org.uk (Coordinator via CF Tunnel)
         ↓
       Workers (anywhere, via CF Tunnels)
         - CPU Workers (upload, rag, notes, ner)
         - GPU Workers (vllm, vision)
```

---

## Management Commands

### Coordinator

```bash
# Start
./start-coordinator.sh

# Stop
./stop-coordinator.sh

# View logs
tail -f coordinator.log
tail -f tunnel.log

# Restart
./stop-coordinator.sh && ./start-coordinator.sh

# Make persistent (systemd)
sudo systemctl enable rma-coordinator rma-tunnel
sudo systemctl start rma-coordinator rma-tunnel
```

### Workers

```bash
# CPU Worker
cd worker-containers/cpu-worker
docker compose up -d      # Start
docker compose logs -f    # View logs
docker compose restart    # Restart
docker compose down       # Stop

# GPU Worker
cd worker-containers/gpu-worker
docker compose up -d
docker compose logs -f
```

### Frontend

Frontend auto-deploys on git push to master.

To manually deploy:
```bash
cd frontend
npm run build
npx wrangler pages deploy .next --project-name=rma-frontend
```

---

## Monitoring

### Check System Status

```bash
# Frontend
curl https://rmatool.org.uk

# Coordinator health
curl https://api.rmatool.org.uk/health

# Worker stats
curl https://api.rmatool.org.uk/api/admin/stats | jq

# List all workers
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

### Cloudflare Dashboard

- **Pages**: https://dash.cloudflare.com → Workers & Pages → rma-frontend
  - Build history, logs, analytics

- **Tunnels**: https://dash.cloudflare.com → Zero Trust → Access → Tunnels
  - Tunnel status, traffic

- **DNS**: https://dash.cloudflare.com → DNS
  - Verify records for api.rmatool.org.uk

### Real-time Monitoring

```bash
# Watch workers register/unregister
watch -n 2 'curl -s https://api.rmatool.org.uk/api/admin/workers | jq'

# Monitor coordinator
tail -f coordinator.log

# Monitor tunnel
tail -f tunnel.log
```

---

## Troubleshooting

### Frontend not accessible

```bash
# Check Cloudflare Pages deployment
# Go to: https://dash.cloudflare.com → Workers & Pages → rma-frontend

# Check DNS
dig rmatool.org.uk
nslookup rmatool.org.uk

# Check if Pages is serving
curl -I https://rmatool.org.uk
```

### Coordinator not accessible

```bash
# Test locally
curl http://localhost:8080/health

# Check tunnel is running
ps aux | grep cloudflared

# Check tunnel logs
tail -f tunnel.log

# Restart tunnel
./stop-coordinator.sh
./start-coordinator.sh
```

### Worker won't connect

```bash
# Check coordinator is accessible from worker
curl https://api.rmatool.org.uk/health

# Check worker logs
docker compose logs worker-agent

# Check if cloudflared is in container
docker compose exec cpu-worker which cloudflared

# Restart worker
docker compose restart
```

### Worker registered but not receiving requests

```bash
# Check worker status
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Check worker tunnel URL is accessible
curl <worker-tunnel-url>/health

# Check worker heartbeats
docker compose logs | grep "Heartbeat sent"
```

---

## Scaling

### Add More Workers

On any machine (home, cloud, lab):

```bash
# Clone repo
git clone <your-repo>
cd RMA-Demo/worker-containers

# Start CPU worker
./start-cpu-worker.sh

# Or GPU worker (if available)
./start-gpu-worker.sh
```

Workers auto-register with coordinator. No configuration changes needed!

### Scale Coordinator (if needed)

Currently running locally. To make it highly available:

**Option 1**: Run on a VPS with auto-restart
```bash
# Install as systemd service (see DEPLOY_NOW.md)
sudo systemctl enable rma-coordinator rma-tunnel
```

**Option 2**: Deploy to Railway/Render (free tier)
- Point DNS directly to service
- Remove tunnel setup
- Update worker configs

---

## Cost

| Component | Hosting | Cost |
|-----------|---------|------|
| Frontend | Cloudflare Pages | $0/month |
| Coordinator | Local + CF Tunnel | $0/month |
| Workers | Donated compute | $0/month |
| Domain | Cloudflare DNS | $0/month |
| **Total** | | **$0/month** |

---

## Security

Current setup includes:
- ✅ HTTPS everywhere (Cloudflare SSL)
- ✅ DDoS protection (Cloudflare)
- ✅ Workers behind NAT (outbound only)
- ✅ Encrypted tunnels

Future enhancements:
- 🔄 Worker authentication (JWT)
- 🔄 API rate limiting
- 🔄 Webhook signing
- 🔄 mTLS for tunnels

---

## Next Steps

1. ✅ Deploy frontend → **DONE**
2. ✅ Deploy coordinator → **DONE**
3. ✅ Deploy workers → **DONE**
4. 🔄 Test with real workloads
5. 🔄 Add more workers
6. 🔄 Monitor and optimize
7. 🔄 Implement authentication

---

## Support

- **Issues**: See logs and error messages
- **Cloudflare**: https://developers.cloudflare.com/
- **Docker**: https://docs.docker.com/
- **Documentation**: See DEPLOY_NOW.md for detailed steps

---

**You're now running a distributed AI compute platform with $0/month hosting cost!** 🎉
