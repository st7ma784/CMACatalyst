# System Orchestrator Dashboard - Setup Guide

The RMA dashboard now includes a **System Orchestrator** tab for monitoring and managing the distributed worker pool.

## Features

### Real-Time Monitoring
- **System Health**: Overall distributed system status (healthy/degraded/error)
- **Active Workers**: Total workers and healthy worker count
- **GPU Workers**: Tier 1 workers with average load
- **Tasks Completed**: Total tasks processed across all workers

### Worker Tier Distribution
- **Tier 1 (GPU)**: vLLM and Vision model workers
- **Tier 2 (Service)**: RAG, Notes, NER service workers
- **Tier 3 (Data)**: PostgreSQL, Neo4j, Redis, ChromaDB workers

Each tier shows:
- Worker count
- Average load percentage
- Visual load bar

### Active Workers Table
Real-time table showing:
- Worker ID
- Tier assignment
- Status (healthy/degraded/offline)
- Current load (visual bar + percentage)
- Assigned containers
- Hardware specs (GPU, CPU, RAM)
- Tasks completed

### Auto-Refresh
- Dashboard auto-refreshes every 10 seconds
- Manual refresh button available
- Last update timestamp shown

---

## Setup

### 1. Environment Configuration

Add coordinator URL to `.env.local`:

```bash
# For local development
NEXT_PUBLIC_COORDINATOR_URL=http://localhost:8080

# For production
NEXT_PUBLIC_COORDINATOR_URL=https://rma-coordinator.fly.dev
```

### 2. Start Coordinator

```bash
cd coordinator-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Access System Tab

1. Login to RMA dashboard
2. Click on **System** tab
3. View distributed system status

---

## Usage

### Viewing System Health

The top row shows:
- **System Health**: Green (healthy), Yellow (degraded), Red (error)
- **Active Workers**: Total count with healthy count
- **GPU Workers**: Count and average load
- **Tasks Completed**: Total across all workers

### Monitoring Worker Tiers

Three tier cards show:
- **Tier 1 (GPU)**: vLLM and Vision workers for inference
- **Tier 2 (Service)**: Application service workers
- **Tier 3 (Data)**: Database workers

Each shows worker count and average load with color-coded bar:
- Green: < 50% load (healthy)
- Yellow: 50-80% load (moderate)
- Red: > 80% load (high)

### Worker Details

The workers table shows all registered workers with:
- **Status badges**: Color-coded (green/yellow/red)
- **Load bars**: Visual representation of CPU usage
- **Container info**: What services each worker is running
- **Hardware specs**: GPU, CPU, RAM details

### No Workers Message

If no workers are registered, you'll see:
```
No workers registered yet
Start a worker using the worker agent to see it appear here
```

To add workers:
```bash
cd worker-agent
python worker_agent.py --coordinator http://localhost:8080
```

---

## Troubleshooting

### "Connection Error" Message

**Problem**: Dashboard shows red error box

**Solutions**:
1. Check coordinator is running:
   ```bash
   curl http://localhost:8080/health
   ```

2. Verify `NEXT_PUBLIC_COORDINATOR_URL` in `.env.local`

3. Check CORS settings in coordinator (`main.py`)

4. Restart frontend:
   ```bash
   npm run dev
   ```

### Workers Not Appearing

**Problem**: Table shows "No workers registered yet"

**Solutions**:
1. Verify workers are actually registered:
   ```bash
   curl http://localhost:8080/api/admin/workers
   ```

2. Check worker agent is running:
   ```bash
   cd worker-agent
   python worker_agent.py --coordinator http://localhost:8080
   ```

3. Check coordinator logs for registration errors

### Stale Data

**Problem**: Dashboard not updating

**Solutions**:
1. Click **Refresh** button
2. Check browser console for fetch errors
3. Verify network connectivity to coordinator

### Load Bars Not Showing

**Problem**: Load bars appear empty or incorrect

**Solutions**:
1. Workers may not be sending heartbeats
2. Check worker agent logs
3. Verify heartbeat endpoint is working:
   ```bash
   curl -X POST http://localhost:8080/api/worker/heartbeat \
     -H "Content-Type: application/json" \
     -d '{"worker_id":"test","status":"healthy","current_load":0.5}'
   ```

---

## Production Deployment

### Update Environment Variables

For production, update `.env.local`:

```bash
NEXT_PUBLIC_COORDINATOR_URL=https://rma-coordinator.fly.dev
```

### CORS Configuration

Make sure coordinator allows your frontend domain in `main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-rma-dashboard.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Build and Deploy

```bash
cd frontend
npm run build
# Deploy dist/ to your hosting provider
```

---

## API Endpoints Used

The System tab calls these coordinator endpoints:

- `GET /api/admin/workers` - Get list of all workers
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/health` - Get system health status

All endpoints refresh every 10 seconds automatically.

---

## Screenshots

### System Health Overview
Shows overall system status with worker counts and load metrics.

### Worker Tier Distribution
Three cards showing GPU, Service, and Data worker tiers with load bars.

### Active Workers Table
Detailed table of all workers with status, load, and hardware info.

---

## Integration with Existing Tabs

The System tab integrates seamlessly with existing RMA features:

- **Notes to CoA**: Uses distributed workers for LLM processing
- **Ask the Manuals**: Routes through coordinator to RAG workers
- **Search Client Docs**: Uses distributed OCR and NER workers
- **Graph**: Uses distributed NER workers for entity extraction

All existing functionality now benefits from the distributed worker pool!

---

## Next Steps

1. **Add Workers**: Start worker agents on different machines
2. **Monitor Load**: Watch worker distribution and load balancing
3. **Scale Up**: Add more workers when load increases
4. **Configure Alerts**: Set up notifications for system degradation

---

## Support

Issues with the System Orchestrator tab?

1. Check coordinator logs: `cd coordinator-service && fly logs` (or local logs)
2. Check frontend console: Browser Developer Tools → Console
3. Verify environment variables: Check `.env.local`
4. Test API directly: Use `curl` to test coordinator endpoints

For more help, see:
- `DISTRIBUTED_ARCHITECTURE.md` - Full system architecture
- `DISTRIBUTED_QUICK_START.md` - Setup guide
- `coordinator-service/README.md` - Coordinator documentation
