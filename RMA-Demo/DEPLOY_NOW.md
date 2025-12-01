# Deploy RMA-Demo to Cloudflare NOW

Quick deployment guide to get running in under 30 minutes.

## Architecture

```
rmatool.org.uk (Frontend - Cloudflare Pages)
    ↓
api.rmatool.org.uk (Coordinator - Local + CF Tunnel)
    ↓
Workers (Anywhere with Docker + CF Tunnels)
```

---

## Part 1: Deploy Frontend (10 minutes)

### Option A: Deploy via Cloudflare Dashboard (Easiest)

1. **Push code to GitHub** (if not already)
   ```bash
   cd /home/user/CMACatalyst/RMA-Demo
   git add .
   git commit -m "Prepare for Cloudflare deployment"
   git push origin master
   ```

2. **Create Cloudflare Pages Project**
   - Go to: https://dash.cloudflare.com/
   - Navigate to: **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
   - Select your GitHub repo: `st7ma784/CMACatalyst` (or your fork)
   - Configure:
     - **Project name**: `rma-frontend`
     - **Production branch**: `master`
     - **Build command**: `cd RMA-Demo/frontend && npm ci && npm run build`
     - **Build output directory**: `RMA-Demo/frontend/.next`
     - **Root directory**: (leave empty)

3. **Add Environment Variables**
   - Click **Environment variables (advanced)**
   - Add:
     ```
     NEXT_PUBLIC_API_URL = https://api.rmatool.org.uk
     ```

4. **Deploy**
   - Click **Save and Deploy**
   - Wait 5-10 minutes for first build
   - You'll get a URL like: `rma-frontend.pages.dev`

5. **Add Custom Domain**
   - Go to: **Custom domains** → **Set up a domain**
   - Enter: `rmatool.org.uk`
   - Cloudflare will auto-configure DNS

### Option B: Deploy via Wrangler CLI (Faster if you have it)

```bash
# Install wrangler
npm install -g wrangler

# Login
wrangler login

# Build frontend
cd /home/user/CMACatalyst/RMA-Demo/frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.rmatool.org.uk npm run build

# Deploy
npx wrangler pages deploy .next --project-name=rma-frontend

# Set up custom domain via dashboard (same as above)
```

---

## Part 2: Deploy Coordinator (10 minutes)

We'll run the coordinator locally with a Cloudflare Tunnel to expose it at `api.rmatool.org.uk`.

### Step 1: Install cloudflared

```bash
# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# macOS
brew install cloudflare/cloudflare/cloudflared
```

### Step 2: Authenticate and Create Tunnel

```bash
cd /home/user/CMACatalyst/RMA-Demo

# Login (opens browser)
cloudflared tunnel login

# Create named tunnel
cloudflared tunnel create rma-api

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep rma-api | awk '{print $1}')
echo "Tunnel ID: $TUNNEL_ID"

# Configure DNS route
cloudflared tunnel route dns rma-api api.rmatool.org.uk
```

### Step 3: Create Tunnel Configuration

```bash
# Get credentials file location
CREDS_FILE="$HOME/.cloudflared/$TUNNEL_ID.json"

# Create tunnel config
cat > /home/user/CMACatalyst/RMA-Demo/tunnel-api.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: $CREDS_FILE

ingress:
  - hostname: api.rmatool.org.uk
    service: http://localhost:8080
  - service: http_status:404
EOF

echo "✅ Tunnel config created at tunnel-api.yml"
```

### Step 4: Start Coordinator

```bash
cd /home/user/CMACatalyst/RMA-Demo/coordinator-service

# Install dependencies (if not already)
pip install -r requirements.txt

# Start coordinator
uvicorn app.main:app --host 127.0.0.1 --port 8080
```

### Step 5: Start Tunnel (in another terminal)

```bash
cd /home/user/CMACatalyst/RMA-Demo

# Start tunnel
cloudflared tunnel --config tunnel-api.yml run rma-api
```

**Your coordinator is now live at: `https://api.rmatool.org.uk`**

### Step 6: Test It

```bash
# Test health endpoint
curl https://api.rmatool.org.uk/health

# Should return: {"status":"healthy"}
```

---

## Part 3: Configure Workers (5 minutes)

Now that the coordinator is running, let's configure workers to connect.

### Update Worker Environment Variables

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers

# Update coordinator URL in environment
cat > .env.coordinator << EOF
COORDINATOR_URL=https://api.rmatool.org.uk
USE_TUNNEL=true
EOF
```

### Start CPU Worker

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker

# Create docker-compose override with new coordinator URL
cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  cpu-worker:
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - USE_TUNNEL=true
      - SERVICE_NAME=upload-service
      - SERVICE_PORT=8103
EOF

# Start worker
docker compose up -d

# Watch logs
docker compose logs -f
```

You should see:
```
✅ Tunnel active: https://xxxxx.trycloudflare.com
✅ Registered successfully!
   Worker ID: worker-xxxxx
   Tier: 2
```

### Start GPU Worker (if you have GPU)

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/gpu-worker

cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  gpu-worker:
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - USE_TUNNEL=true
      - SERVICE_NAME=vllm-service
      - SERVICE_PORT=8000
EOF

docker compose up -d
docker compose logs -f
```

---

## Part 4: Verify Everything Works (5 minutes)

### 1. Check Frontend
```bash
curl https://rmatool.org.uk
# Should return HTML
```

### 2. Check Coordinator
```bash
# Health
curl https://api.rmatool.org.uk/health

# Worker stats
curl https://api.rmatool.org.uk/api/admin/stats

# List workers
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

### 3. Open in Browser
```bash
open https://rmatool.org.uk
```

Test uploading a file and verify it processes!

---

## Making It Persistent

### Create Systemd Services (Linux)

#### Coordinator Service
```bash
sudo tee /etc/systemd/system/rma-coordinator.service << 'EOF'
[Unit]
Description=RMA Coordinator Service
After=network.target

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/CMACatalyst/RMA-Demo/coordinator-service
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

#### Tunnel Service
```bash
sudo tee /etc/systemd/system/rma-tunnel.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel for RMA API
After=network.target rma-coordinator.service
Requires=rma-coordinator.service

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/CMACatalyst/RMA-Demo
ExecStart=/usr/local/bin/cloudflared tunnel --config tunnel-api.yml run rma-api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

#### Enable and Start
```bash
sudo systemctl daemon-reload
sudo systemctl enable rma-coordinator rma-tunnel
sudo systemctl start rma-coordinator rma-tunnel

# Check status
sudo systemctl status rma-coordinator
sudo systemctl status rma-tunnel

# View logs
sudo journalctl -u rma-coordinator -f
sudo journalctl -u rma-tunnel -f
```

---

## Quick Reference Commands

### Coordinator
```bash
# Start manually
cd coordinator-service
uvicorn app.main:app --host 127.0.0.1 --port 8080

# Start tunnel manually
cloudflared tunnel --config tunnel-api.yml run rma-api

# Check status (systemd)
sudo systemctl status rma-coordinator rma-tunnel

# Restart
sudo systemctl restart rma-coordinator rma-tunnel

# View logs
sudo journalctl -u rma-coordinator -f
```

### Workers
```bash
# Start worker
cd worker-containers/cpu-worker
docker compose up -d

# View logs
docker compose logs -f

# Restart worker
docker compose restart

# Stop worker
docker compose down
```

### Monitor
```bash
# Watch workers register
curl -s https://api.rmatool.org.uk/api/admin/workers | jq

# Watch stats
watch -n 5 'curl -s https://api.rmatool.org.uk/api/admin/stats | jq'

# Check worker health
curl https://api.rmatool.org.uk/api/admin/health
```

---

## Troubleshooting

### Frontend won't build
```bash
cd frontend
rm -rf .next node_modules
npm ci
NEXT_PUBLIC_API_URL=https://api.rmatool.org.uk npm run build
```

### Tunnel won't start
```bash
# Check if cloudflared is installed
cloudflared --version

# Check if tunnel exists
cloudflared tunnel list

# Test tunnel connection
cloudflared tunnel --config tunnel-api.yml run rma-api
```

### Worker can't connect
```bash
# Test coordinator from worker machine
curl https://api.rmatool.org.uk/health

# Check worker environment
docker compose exec cpu-worker env | grep COORDINATOR

# View worker logs
docker compose logs worker-agent
```

### Coordinator not accessible
```bash
# Check if running locally
curl http://localhost:8080/health

# Check tunnel status
ps aux | grep cloudflared

# Check DNS propagation
dig api.rmatool.org.uk
nslookup api.rmatool.org.uk
```

---

## Cost: $0/month

- Frontend (Cloudflare Pages): $0
- DNS & CDN (Cloudflare): $0
- Coordinator (Local + Tunnel): $0
- Workers (Donated compute): $0

**Total: $0/month**

---

## What's Running Where

| Service | Location | URL | Technology |
|---------|----------|-----|------------|
| Frontend | Cloudflare Edge | https://rmatool.org.uk | Next.js on Pages |
| Coordinator | Your machine | https://api.rmatool.org.uk | FastAPI + CF Tunnel |
| Workers | Anywhere | (register with coordinator) | Docker + CF Tunnels |

---

## Next: Add More Workers

To scale, just spin up more workers on any machine:

```bash
# On any machine with Docker
git clone <your-repo>
cd RMA-Demo/worker-containers/cpu-worker

# Configure
echo "COORDINATOR_URL=https://api.rmatool.org.uk" > .env

# Start
docker compose up -d

# Watch it register
docker compose logs -f
```

The coordinator will automatically discover and route requests to all registered workers!
