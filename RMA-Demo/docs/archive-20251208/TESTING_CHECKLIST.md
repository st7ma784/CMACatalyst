# 🧪 Testing Checklist - RMA Demo

## ✅ What We Just Fixed

### 1. Added `/api/admin/health` endpoint
```bash
curl https://api.rmatool.org.uk/api/admin/health
# ✅ Returns: {"status":"healthy","coordinator":"cloudflare-worker","timestamp":"..."}
```

### 2. Added Service Proxy Routes
The coordinator now proxies requests to worker services:
- `/api/service/upload/*` → Worker's upload-service
- `/api/service/rag/*` → Worker's RAG service
- `/api/service/notes/*` → Worker's notes service
- `/api/service/ner/*` → Worker's NER service

Legacy routes also work:
- `/clients` → `/api/service/upload/clients`
- `/uploads/*` → `/api/service/upload/uploads/*`

### 3. Updated Frontend Environment Variables
Changed from hardcoded `localhost:8103` to coordinator-routed URLs:
```env
NEXT_PUBLIC_UPLOAD_SERVICE_URL=https://api.rmatool.org.uk/api/service/upload
NEXT_PUBLIC_NOTES_SERVICE_URL=https://api.rmatool.org.uk/api/service/notes
NEXT_PUBLIC_RAG_SERVICE_URL=https://api.rmatool.org.uk/api/service/rag
NEXT_PUBLIC_NER_SERVICE_URL=https://api.rmatool.org.uk/api/service/ner
```

## 🎯 Testing Steps

### Step 1: Verify Coordinator ✅
```bash
# Health check
curl https://api.rmatool.org.uk/health
# ✅ {"status":"healthy","edge":true}

# Admin health
curl https://api.rmatool.org.uk/api/admin/health
# ✅ {"status":"healthy","coordinator":"cloudflare-worker",...}

# Login
curl -X POST https://api.rmatool.org.uk/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# ✅ {"access_token":"...","token_type":"bearer",...}
```

### Step 2: Start a Worker
```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers
./start-cpu-worker.sh
```

**Expected behavior:**
1. ✅ Docker builds worker image
2. ✅ Worker container starts
3. ✅ Worker agent detects capabilities (CPU, RAM)
4. ✅ Cloudflared tunnel starts for upload-service:8103
5. ✅ Worker registers with coordinator (sends tunnel URL)
6. ✅ Heartbeats start (every 30s)

**Watch for in logs:**
```
🔧 Starting Cloudflare Tunnel for upload-service:8103...
✅ Tunnel URL: https://xxxx-xxxx-xxxx.trycloudflare.com
📡 Registering with coordinator: https://api.rmatool.org.uk
✅ Registered successfully!
```

### Step 3: Verify Worker Registration
```bash
# Check workers are registered
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Expected output:
# [
#   {
#     "worker_id": "worker-1234...",
#     "tier": 2,
#     "status": "healthy",
#     "tunnel_url": "https://xxxx-xxxx-xxxx.trycloudflare.com",
#     "capabilities": {
#       "cpu_cores": 12,
#       "ram": "31.2GB",
#       ...
#     }
#   }
# ]
```

### Step 4: Test Service Routing
```bash
# Test upload service through coordinator proxy
curl https://api.rmatool.org.uk/api/service/upload/health

# Expected: Proxied to worker's upload-service
# Should return service health status
```

### Step 5: Test Frontend
1. Open: https://rmatool.org.uk
2. Click "Advisor Login"
3. Username: `admin`, Password: `admin123`
4. ✅ Should log in successfully
5. Try accessing `/clients` endpoint
6. ✅ Should be routed through coordinator to worker service

## 🐛 Troubleshooting

### Worker Won't Start
```bash
# Check Docker
docker ps
docker compose logs

# Check network
docker network ls | grep rma

# Rebuild
cd worker-containers/cpu-worker
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Tunnel Fails
The worker agent has retry logic and fallback:
1. Tries Cloudflare tunnel (3 attempts)
2. Falls back to ngrok if env var set
3. Falls back to IP address

**Common issue**: Cloudflare API blocks/SSL errors
```bash
# Check cloudflared
cloudflared --version

# Test tunnel manually
cloudflared tunnel --url http://localhost:8103
```

### Worker Doesn't Register
```bash
# Check coordinator URL in worker
docker compose exec cpu-worker env | grep COORDINATOR

# Test coordinator from worker
docker compose exec cpu-worker curl https://api.rmatool.org.uk/health

# Check worker logs
docker compose logs -f | grep -i "register\|error"
```

### Service Proxy Returns 503
Means no healthy workers available:
```bash
# Check worker status
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Verify:
# - status: "healthy" (not "offline")
# - tunnel_url exists
# - last_heartbeat is recent (<90 seconds)
```

## 📊 Expected Architecture Flow

```
User Browser
    ↓
https://rmatool.org.uk (Frontend - Cloudflare Pages)
    ↓
https://api.rmatool.org.uk/api/service/upload/... (Coordinator - CF Worker)
    ↓ [Looks up healthy worker with tunnel_url]
    ↓
https://xxxx-xxxx-xxxx.trycloudflare.com/... (Worker's Tunnel)
    ↓
upload-service:8103 (Docker service in worker container)
    ↓
Response back through chain
```

## ✅ Success Criteria

1. ✅ Coordinator health endpoint responds
2. ✅ Frontend login works
3. ✅ Worker starts and registers
4. ✅ Worker appears in `/api/admin/workers` with tunnel URL
5. ✅ Service proxy routes work (returns 200, not 503)
6. ✅ Frontend can access services through coordinator

## 🚀 Next Test

After verifying worker registration:
1. Upload a file through frontend
2. Check it reaches the upload-service
3. Verify processing happens
4. Check results are returned

---

**Current Status**: Coordinator and frontend deployed ✅
**Next Step**: Start CPU worker and verify service routing
