# Final Setup - Complete Stack with Tunnel

## What Was Fixed

1. ✅ **422 Registration Error** - Worker now includes `worker_id` in registration
2. ✅ **Worker Heartbeat 404** - Worker syncs ID with coordinator
3. ✅ **Docker Networking** - Using host networking (no more 172.x IPs)
4. ✅ **Model Loading Timeouts** - Increased to 5-10 minutes
5. ✅ **Local Build** - Worker builds from source with all fixes
6. ✅ **Cloudflare Tunnel** - Added back for internet access

## Complete Setup

### Run the Rebuild Script

```bash
cd RMA-Demo
./rebuild-and-restart.sh
```

This script will:
1. Stop old containers
2. Rebuild worker from local source (with fixes)
3. Start Cloudflare tunnel
4. Start coordinator (with increased timeouts)
5. Start local worker
6. Wait for tunnel URL
7. Register coordinator with edge router
8. Run diagnostics

### What You'll See

**Successful Output:**
```
🔗 Waiting for Cloudflare tunnel to establish...
✅ Tunnel established: https://abc-xyz.trycloudflare.com
📝 Registering coordinator with edge router...
✅ Coordinator registered successfully!
✅ Coordinator verified: edge-coordinator-hostname
```

**Diagnostic Results:**
```
✅ Edge router is accessible
✅ Found 1 coordinator(s)
✅ Coordinator is accessible
✅ Found 1 worker(s)
✅ Service 'notes-coa' is available
✅ Full routing chain works!
```

## Manual Steps (If Needed)

### If Tunnel Doesn't Start

```bash
# Check tunnel logs
docker logs edge-tunnel

# Restart tunnel
docker restart edge-tunnel

# Wait and check again
sleep 10
docker logs edge-tunnel 2>&1 | grep trycloudflare.com
```

### If Registration Fails

```bash
# Get tunnel URL manually
TUNNEL_URL=$(docker logs edge-tunnel 2>&1 | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
echo "Tunnel URL: $TUNNEL_URL"

# Register manually
curl -X POST https://api.rmatool.org.uk/api/edge/register \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"edge-coordinator-$(hostname)\",
    \"tunnel_url\": \"$TUNNEL_URL\",
    \"dht_port\": 8468,
    \"capabilities\": {\"location\": \"local\"}
  }"

# Verify
curl https://api.rmatool.org.uk/api/admin/coordinators | jq
```

### If Worker Doesn't Start

```bash
# Check worker logs
docker logs edge-local-worker

# Common issues:
# - vLLM installation (takes 5-10 minutes)
# - Model loading (can take another 5-10 minutes)
# - GPU not available

# Check if worker registered
curl http://localhost:8080/api/admin/workers | jq
```

## Verifying Everything Works

### 1. Check Containers
```bash
docker ps
# Should see: edge-tunnel, edge-coordinator, edge-local-worker
```

### 2. Check Coordinator Registration
```bash
curl https://api.rmatool.org.uk/api/admin/coordinators | jq
# Should return array with your coordinator
```

### 3. Check Worker Registration
```bash
curl http://localhost:8080/api/admin/workers | jq
# Should return array with edge-local-worker
```

### 4. Test Service Endpoint
```bash
# Through edge router (full stack)
curl -X POST https://api.rmatool.org.uk/service/notes/convert \
  -H "Content-Type: application/json" \
  -d '{"notes":"Test notes","client_name":"Test"}' | jq

# Direct to coordinator (bypass edge router)
curl -X POST http://localhost:8080/service/notes/convert \
  -H "Content-Type: application/json" \
  -d '{"notes":"Test notes","client_name":"Test"}' | jq
```

### 5. Run Full Diagnostic
```bash
./diagnose-routing.sh
```

All checks should pass!

## Architecture Diagram

```
Frontend (rmatool.org.uk)
    │
    │ POST /service/notes/convert
    │
    ▼
┌─────────────────────────────────────────┐
│  Cloudflare Edge Router                 │
│  api.rmatool.org.uk                     │
│  (Durable Objects storage)              │
└─────────┬───────────────────────────────┘
          │
          │ Routes to registered coordinator
          │
          ▼
┌─────────────────────────────────────────┐
│  Cloudflare Tunnel                      │
│  https://abc-xyz.trycloudflare.com      │
│  (cloudflared)                          │
└─────────┬───────────────────────────────┘
          │
          │ Proxies to localhost:8080
          │
          ▼
┌─────────────────────────────────────────┐
│  Edge Coordinator                       │
│  localhost:8080                         │
│  (FastAPI with timeouts: 300s/600s)    │
└─────────┬───────────────────────────────┘
          │
          │ Maps service & routes to worker
          │
          ▼
┌─────────────────────────────────────────┐
│  Universal Worker                       │
│  (Built from local source)              │
│  Running: notes-service on port 8100    │
└─────────────────────────────────────────┘
```

## Monitoring

### Watch Logs in Real-Time
```bash
# Tunnel
docker logs -f edge-tunnel

# Coordinator
docker logs -f edge-coordinator

# Worker
docker logs -f edge-local-worker
```

### Check Worker Health
```bash
watch -n 5 'curl -s http://localhost:8080/api/admin/workers | jq ".[].status"'
```

### Monitor Service Requests
```bash
# Watch coordinator for service requests
docker logs -f edge-coordinator | grep "/service/"
```

## Troubleshooting

### "No coordinators registered"
- Tunnel might not be established yet
- Run `./register-coordinator.sh` manually
- Check tunnel logs for errors

### "Worker not found" or 404 on heartbeat
- Worker image might be old (from registry)
- Rebuild: `docker-compose -f edge-coordinator-local-build.yml build local-worker --no-cache`
- Restart: `docker-compose -f edge-coordinator-local-build.yml up -d local-worker`

### "Service not available"
- Worker might still be installing vLLM/loading models
- Check worker logs: `docker logs edge-local-worker`
- Wait 10-15 minutes for first startup
- Once loaded, subsequent starts are faster

### "Connection refused" on localhost:8080
- Using host networking, so should work
- Check coordinator is running: `docker ps | grep coordinator`
- Check coordinator logs: `docker logs edge-coordinator`

## Success Criteria

After running `./rebuild-and-restart.sh`, you should have:

✅ Tunnel established with public URL
✅ Coordinator registered at edge router
✅ Worker registered with coordinator
✅ Services assigned to worker
✅ All diagnostic checks pass
✅ Frontend can call API endpoints

## Next Steps

1. **Test from frontend** - Your React app should now be able to call `https://api.rmatool.org.uk/service/notes/convert`

2. **Monitor production** - Set up monitoring for:
   - Coordinator registration status
   - Worker health
   - Service availability

3. **Scale up** - Add more workers:
   ```bash
   docker run -e COORDINATOR_URL=http://localhost:8080 \
     universal-worker:local
   ```

4. **Optimize** - Fine-tune timeouts based on your actual model loading times

---

**Everything is now configured and ready!** 🎉

Run `./rebuild-and-restart.sh` to start the complete stack.
