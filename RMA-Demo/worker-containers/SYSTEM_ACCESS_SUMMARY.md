# RMA Distributed System - Access Summary

## ✅ System Status (Currently Running)

### Coordinator
- **Container**: `rma-coordinator-local`
- **Port**: 8080
- **Status**: Running and healthy
- **API Base**: http://localhost:8080

### Workers
- **Count**: 4 CPU workers (Tier 2 - Service Workers)
- **Status**: All 4 healthy and registered
- **Network**: Connected to `rma-network`
- **Coordinator URL**: http://rma-coordinator-local:8080

**Worker IDs**:
1. worker-3d2b7b12 (load: 8.8%)
2. worker-d44beea0 (load: 7.6%)
3. worker-8686c6ce (load: 6.0%)
4. worker-4beaabe6 (load: 4.7%)

### Timeout Configuration
✅ **FIXED** - Workers now stay alive longer:
- **Offline threshold**: 5 minutes (was 2 minutes)
- **Removal threshold**: 30 minutes (was 10 minutes)

---

## 📍 How to Access the System

### 1. Coordinator API (Currently Running)

**Base URL**: http://localhost:8080

**Available Endpoints**:

```bash
# Health check
curl http://localhost:8080/health

# List all workers
curl http://localhost:8080/api/admin/workers | jq

# System statistics
curl http://localhost:8080/api/admin/stats | jq

# System health overview
curl http://localhost:8080/api/admin/health | jq
```

### 2. Frontend Access (Not Yet Started)

The frontend needs to be started separately. Here are your options:

#### Option A: Use Existing Standalone Frontend

Start the regular RMA frontend (without distributed features):

```bash
cd /home/user/CMACatalyst/RMA-Demo
docker compose -f docker-compose-separated.yml up -d
```

Then access: http://localhost:3000

**Note**: This runs the full RMA stack (Ollama, RAG, etc.) in standalone mode, NOT using the distributed workers.

#### Option B: Build Custom Frontend with System Orchestrator

The SystemOrchestrator component needs a small fix first (wrong import path for Card components).

Once fixed, you can:

```bash
cd /home/user/CMACatalyst/RMA-Demo/frontend
npm run dev
# Access: http://localhost:3001 (or whatever port)
```

The System Orchestrator Dashboard will show:
- All 4 workers
- Their status, tier, and load
- System health metrics
- Real-time updates every 5 seconds

#### Option C: Access Coordinator Admin API Directly

Use the REST API directly to monitor your system:

```bash
# Watch workers in real-time
watch -n 5 'curl -s http://localhost:8080/api/admin/workers | jq'

# Check system stats
watch -n 5 'curl -s http://localhost:8080/api/admin/stats | jq'
```

### 3. Worker Logs

Monitor what your workers are doing:

```bash
# View logs from all workers
docker logs cpu-worker-cpu-worker-1
docker logs cpu-worker-cpu-worker-2
docker logs cpu-worker-cpu-worker-3
docker logs cpu-worker-cpu-worker-4

# Follow logs in real-time
docker logs -f cpu-worker-cpu-worker-1

# Check heartbeat activity
docker logs cpu-worker-cpu-worker-1 2>&1 | grep "Heartbeat"
```

---

## 🔧 Managing Your System

### Scale Workers Up/Down

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker

# Scale to 8 workers
docker compose up -d --scale cpu-worker=8

# Scale down to 2 workers
docker compose up -d --scale cpu-worker=2

# Check result
curl -s http://localhost:8080/api/admin/stats | jq '.total_workers'
```

### Stop Workers

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker
docker compose down
```

### Stop Coordinator

```bash
docker stop rma-coordinator-local
docker rm rma-coordinator-local
```

### Restart Everything

```bash
# Stop workers
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker
docker compose down

# Stop coordinator
docker stop rma-coordinator-local
docker rm rma-coordinator-local

# Start coordinator
cd /home/user/CMACatalyst/RMA-Demo
docker run -d --name rma-coordinator-local -p 8080:8080 --network rma-network rma-demo-coordinator:latest

# Start workers
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker
docker compose up -d --scale cpu-worker=4
```

---

## 🎯 What Each Worker Can Do

Your Tier 2 (Service) workers are assigned to run these services:

- **RAG Service** (Port 8102): Answer questions using retrieval-augmented generation
- **Notes Service** (Port 8100): Process and manage notes
- **NER Service** (Port 8108): Named Entity Recognition and graph extraction

The coordinator automatically balances service assignments across workers.

---

## 📊 Current Architecture

```
┌─────────────────────────┐
│   Your Browser          │
│   (Not yet connected)   │
└──────────┬──────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  Coordinator (Port 8080)         │
│  http://localhost:8080           │
│  - Worker registry               │
│  - Request routing               │
│  - Health monitoring             │
└────────┬─────────────────────────┘
         │
         ├─→ Worker 1 (worker-3d2b7b12) Load: 8.8%
         ├─→ Worker 2 (worker-d44beea0) Load: 7.6%
         ├─→ Worker 3 (worker-8686c6ce) Load: 6.0%
         └─→ Worker 4 (worker-4beaabe6) Load: 4.7%
```

---

## 🚀 Next Steps

### Immediate Actions:

1. **Monitor your system**:
   ```bash
   watch -n 5 'curl -s http://localhost:8080/api/admin/workers | jq'
   ```

2. **Test worker registration**:
   ```bash
   curl -s http://localhost:8080/api/admin/stats | jq
   ```

3. **View worker capabilities**:
   ```bash
   curl -s http://localhost:8080/api/admin/workers | jq '.workers[] | {id: .worker_id, tier, status, cpu: .capabilities.cpu_cores, ram: .capabilities.ram}'
   ```

### To Add Frontend:

1. **Fix SystemOrchestrator component** (change Card import from 'tabs' to 'card')
2. **Build frontend** with coordinator URL
3. **Access dashboard** to see real-time worker status

### To Add More Worker Types:

```bash
# Add GPU workers (if you have GPU)
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/gpu-worker
docker compose up -d --scale gpu-worker=2
```

---

## 🐛 Troubleshooting

### Workers Not Showing Up

```bash
# Check worker logs
docker logs cpu-worker-cpu-worker-1

# Check network connectivity
docker exec cpu-worker-cpu-worker-1 curl -s http://rma-coordinator-local:8080/health

# Verify network
docker network inspect rma-network
```

### Coordinator Not Responding

```bash
# Check coordinator logs
docker logs rma-coordinator-local

# Restart coordinator
docker restart rma-coordinator-local

# Check port availability
netstat -tuln | grep 8080
```

### Workers Timing Out

✅ Already fixed! New timeouts:
- Offline: 5 minutes
- Removal: 30 minutes

If still timing out, check heartbeat logs:
```bash
docker logs cpu-worker-cpu-worker-1 2>&1 | grep -E "(Heartbeat|failed)"
```

---

## 📝 Configuration Files

### Coordinator
- **Location**: `/home/user/CMACatalyst/RMA-Demo/coordinator-service/`
- **Updated file**: `models/worker.py` (timeout configuration)

### Workers  
- **Location**: `/home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker/`
- **Config**: `docker-compose.yml`
- **Coordinator URL**: `http://rma-coordinator-local:8080`

### Frontend Access Guide
- **Location**: `/home/user/CMACatalyst/RMA-Demo/worker-containers/FRONTEND_ACCESS_GUIDE.md`
- **Full documentation** for frontend integration

---

## 🎉 Success!

You now have a **working distributed compute system** with:
- ✅ 1 coordinator managing the pool
- ✅ 4 CPU workers registered and healthy
- ✅ Extended timeout periods (workers stay alive longer)
- ✅ Real-time monitoring via REST API
- ✅ Scalable architecture (add/remove workers anytime)

**Cost**: $0 (all running locally)

**Next**: Connect a frontend to visualize your distributed system! 🚀
