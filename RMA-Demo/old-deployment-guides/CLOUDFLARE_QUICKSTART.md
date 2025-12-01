# Deploy Frontend + Coordinator to Cloudflare

## Quick Setup Guide

### Step 1: Deploy Frontend to Cloudflare Pages

1. **In Cloudflare Dashboard:**
   - Go to **Workers & Pages** → **Create application** → **Pages**
   - Connect to your GitHub repo: `st7ma784/CMACatalyst`
   
2. **Build settings:**
   - **Build command:** `cd RMA-Demo/frontend && npm ci && npm run build`
   - **Build output directory:** `RMA-Demo/frontend/.next`
   - **Root directory:** (leave empty)

3. **Environment variables:**
   Add these in the Pages settings:
   ```
   NEXT_PUBLIC_API_URL=https://api.rmatool.org.uk
   COORDINATOR_URL=https://api.rmatool.org.uk
   ```

4. **Custom domain:**
   After deployment, add custom domain: `app.rmatool.org.uk`

---

### Step 2: Deploy Coordinator as Cloudflare Worker

Since Cloudflare Pages doesn't run Python/FastAPI, we have two options:

#### Option A: Use Cloudflare Tunnel (Recommended)

Run the coordinator locally and expose it:

```bash
cd /home/user/CMACatalyst/RMA-Demo

# Run the setup script
./setup-cloudflare-tunnel.sh

# After tunnel is created, add coordinator route
TUNNEL_NAME="rma-workers"
cloudflared tunnel route dns $TUNNEL_NAME api.rmatool.org.uk

# Run coordinator locally
cd coordinator-service
uvicorn app.main:app --host 127.0.0.1 --port 8080 &

# Run tunnel with coordinator config
cat > tunnel-coordinator.yml << EOF
tunnel: $(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
credentials-file: $HOME/.cloudflared/$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}').json

ingress:
  - hostname: api.rmatool.org.uk
    service: http://localhost:8080
  - service: http_status:404
EOF

# Start tunnel
cloudflared tunnel --config tunnel-coordinator.yml run $TUNNEL_NAME
```

#### Option B: Use a Cloud VM + Cloudflare Proxy

1. Get a free/cheap VM (AWS EC2 free tier, DigitalOcean $6/month, etc.)
2. Deploy coordinator with Docker:
   ```bash
   docker run -d -p 8080:8080 \
     -v $(pwd)/coordinator-service:/app \
     -e PORT=8080 \
     python:3.11-slim \
     sh -c "cd /app && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8080"
   ```
3. Point DNS to VM:
   - In Cloudflare: Add A record `api` → `YOUR_VM_IP` (Orange cloud ON)

---

### Step 3: Configure DNS

In Cloudflare Dashboard → DNS:

1. **Frontend:**
   - CNAME `app` → `rma-frontend.pages.dev` (or whatever Pages gives you)
   - Enable proxy (Orange cloud)

2. **API (if using tunnel):**
   - CNAME `api` → Auto-created by cloudflared tunnel route
   
2. **API (if using VM):**
   - A record `api` → Your VM's IP
   - Enable proxy (Orange cloud)

---

### Step 4: Update Workers

Update worker environment variables:

```bash
# Edit worker-containers/.env.coordinator
echo "COORDINATOR_URL=https://api.rmatool.org.uk" > worker-containers/.env.coordinator

# Rebuild and restart workers
cd worker-containers/cpu-worker
docker compose down
docker compose build
docker compose up -d --scale cpu-worker=4
```

---

## Testing

```bash
# Test frontend
curl https://app.rmatool.org.uk

# Test API
curl https://api.rmatool.org.uk/health

# Test worker registration
curl https://api.rmatool.org.uk/api/admin/workers
```

---

## Summary

- **Frontend:** Cloudflare Pages at `app.rmatool.org.uk`
- **Coordinator API:** Cloudflare Tunnel OR VM at `api.rmatool.org.uk`  
- **Workers:** Local machines with Cloudflare Tunnels at `worker1-4.rmatool.org.uk`

This gives you:
- ✅ Free frontend hosting (Cloudflare Pages)
- ✅ Free API hosting (Cloudflare Tunnel) OR $6/month (VM)
- ✅ Free CDN, SSL, DDoS protection (Cloudflare)
- ✅ Workers stay local with your GPU/CPU resources
