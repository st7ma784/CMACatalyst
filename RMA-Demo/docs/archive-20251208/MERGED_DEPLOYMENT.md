# RMA Merged Deployment Guide

## Architecture Overview

**NEW Simplified Architecture:**
```
Coordinator (Render.com)
├── Frontend (Next.js static files)
└── API (/api/*)
    ├── /api/auth - Authentication
    ├── /api/worker - Worker registration
    ├── /api/inference - Job submission
    ├── /api/admin - Admin dashboard
    └── /api/service - Service proxy

Workers (Local, behind NAT)
├── CPU Worker 1-4
└── Services exposed via ngrok
    └── nginx proxy (port 9000)
        ├── /upload/ → upload-service:8103
        ├── /rag/ → rag-service:8102
        ├── /notes/ → notes-service:8100
        └── /ner/ → ner-service:8108
```

## What Changed

### Before (Separated)
- Frontend: Separate Render service
- Coordinator: Separate Render service
- Workers: Local with Cloudflare Tunnel (failed)

### After (Merged)
- **Single Render deployment** serving frontend + API
- Workers: Local with ngrok tunnel
- All services accessible through: `https://cesar-uneuphemistic-unloyally.ngrok-free.dev/{service}/`

## Deployment Steps

### 1. Build and Deploy Coordinator

```bash
cd /home/user/CMACatalyst/RMA-Demo

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Copy frontend to coordinator
rm -rf coordinator-service/static
cp -r frontend/.next/standalone/. coordinator-service/static/
cp -r frontend/.next/static coordinator-service/static/.next/
cp -r frontend/public coordinator-service/static/

# Deploy to Render
cd coordinator-service
git add .
git commit -m "Merged frontend and coordinator"
git push origin master
```

Render will auto-deploy from the git push.

### 2. Start Local Services

```bash
cd /home/user/CMACatalyst/RMA-Demo/services

# Start all services
docker-compose -f docker-compose.services.yml up -d

# Verify services are running
curl http://localhost:8103/health  # upload-service
curl http://localhost:8102/health  # rag-service
curl http://localhost:8100/health  # notes-service
curl http://localhost:8108/health  # ner-service
```

### 3. Start Nginx Proxy + ngrok

```bash
cd /home/user/CMACatalyst/RMA-Demo

# This script will:
# 1. Start nginx proxy on port 9000
# 2. Route /upload, /rag, /notes, /ner to respective services
# 3. Start ngrok tunnel to expose port 9000
./start-ngrok.sh
```

Your services will be available at:
- `https://cesar-uneuphemistic-unloyally.ngrok-free.dev/upload/`
- `https://cesar-uneuphemistic-unloyally.ngrok-free.dev/rag/`
- `https://cesar-uneuphemistic-unloyally.ngrok-free.dev/notes/`
- `https://cesar-uneuphemistic-unloyally.ngrok-free.dev/ner/`

### 4. Start Workers

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker

# Start 4 CPU workers
docker-compose up -d --scale cpu-worker=4

# Check worker registration
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

Each worker will register with:
- `tunnel_url`: `https://cesar-uneuphemistic-unloyally.ngrok-free.dev/upload`
- Coordinator routes requests through the ngrok tunnel

## Verification

### Test Frontend
```bash
curl https://api.rmatool.org.uk/
# Should return Next.js HTML
```

### Test API
```bash
# Login
curl -X POST https://api.rmatool.org.uk/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Check workers
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

### Test Service Routing
```bash
# Through ngrok directly
curl https://cesar-uneuphemistic-unloyally.ngrok-free.dev/upload/health

# Through coordinator proxy
curl https://api.rmatool.org.uk/api/service/upload/health
```

## Benefits of Merged Architecture

1. **Single Deployment**: Only one Render service to manage
2. **No CORS Issues**: Frontend and API on same domain
3. **Simplified Auth**: Cookies work seamlessly
4. **Free Tier Friendly**: Uses only 1 Render service
5. **Better Performance**: No extra network hop for frontend

## Troubleshooting

### Frontend Not Loading
```bash
# Check if static files exist
ls -la /home/user/CMACatalyst/RMA-Demo/coordinator-service/static/

# Rebuild if missing
cd frontend && npm run build
```

### ngrok Tunnel Issues
```bash
# Check if ngrok is running
ps aux | grep ngrok

# Check proxy
docker-compose -f docker-compose.proxy.yml ps

# Restart everything
docker-compose -f docker-compose.proxy.yml down
./start-ngrok.sh
```

### Workers Not Connecting
```bash
# Check coordinator URL in worker env
cat /home/user/CMACatalyst/RMA-Demo/worker-containers/.env.coordinator

# Should be: COORDINATOR_URL=https://api.rmatool.org.uk

# Check worker logs
docker-compose -f worker-containers/cpu-worker/docker-compose.yml logs
```

## Environment Variables

### Coordinator (.env)
```bash
JWT_SECRET=your-secret-key
WORKER_PERSISTENCE_FILE=/tmp/workers.json
```

### Workers (.env.coordinator)
```bash
COORDINATOR_URL=https://api.rmatool.org.uk
NGROK_URL=https://cesar-uneuphemistic-unloyally.ngrok-free.dev/upload
USE_TUNNEL=false
```

## Next Steps

1. ✅ Merged frontend + coordinator
2. ✅ Configured ngrok with nginx proxy
3. ✅ Updated worker registration with ngrok URL
4. 🔄 Deploy to Render
5. 🔄 Test end-to-end workflow
6. 🔄 Monitor worker health and service routing

## Cost Breakdown

- **Render.com**: $0 (free tier, 512MB RAM, sleeps after 15min)
- **ngrok**: $0 (free tier, 1 tunnel)
- **Local Resources**: Your hardware for workers + services

**Total: $0/month** 🎉
