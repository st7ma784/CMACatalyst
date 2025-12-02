# RMA Coordinator - Cloudflare Worker Version

Deploy the coordinator **directly to Cloudflare's edge network** with zero servers.

## Benefits

- ✅ **$0/month** - Free on Workers free tier
- ✅ **Global edge network** - Deployed to 300+ locations
- ✅ **Zero cold starts** - Always ready
- ✅ **No servers** - Truly serverless
- ✅ **Auto-scaling** - Handles any load

## Quick Deploy

```bash
cd /home/user/CMACatalyst/RMA-Demo/cloudflare-worker-coordinator

# Install dependencies
npm install

# Deploy to Cloudflare
npm run deploy
```

That's it! Your coordinator is now at: `https://api.rmatool.org.uk`

## Limitations

**Current (in-memory storage)**:
- ⚠️ Worker registry resets when Worker restarts
- ⚠️ Not suitable for production as-is

**For Production**:
Add persistent storage using Cloudflare KV or D1:

### Option A: KV (Key-Value)
```bash
# Create KV namespace
wrangler kv:namespace create WORKERS

# Update wrangler.toml with the ID
# Uncomment the kv_namespaces section
```

Then update `worker.js`:
```javascript
// Store workers in KV instead of Map
await env.WORKERS.put(workerId, JSON.stringify(worker));
const worker = JSON.parse(await env.WORKERS.get(workerId));
```

### Option B: D1 (SQL Database)
```bash
# Create D1 database
wrangler d1 create rma-coordinator

# Create table
wrangler d1 execute rma-coordinator --command="
  CREATE TABLE workers (
    worker_id TEXT PRIMARY KEY,
    tier INTEGER,
    status TEXT,
    registered_at TEXT,
    last_heartbeat TEXT,
    capabilities TEXT,
    tunnel_url TEXT
  )
"
```

## Testing

```bash
# Test locally
npm run dev

# Then test endpoints
curl http://localhost:8787/health

# Deploy to production
npm run deploy

# Test production
curl https://api.rmatool.org.uk/health
```

## API Compatibility

This Worker implements the same API as the FastAPI coordinator:

- `GET /health` - Health check
- `POST /api/worker/register` - Register worker
- `POST /api/worker/heartbeat` - Send heartbeat
- `GET /api/admin/workers` - List workers
- `GET /api/admin/stats` - System stats

Workers can connect without any changes!

## Cost

**Free Tier**:
- 100,000 requests/day
- Unlimited workers
- 10ms CPU time per request
- **Total: $0/month**

**Paid Tier** (if needed):
- $5/month for 10M requests
- Still very cheap for small-medium deployments

## Migration from FastAPI

1. Deploy this Worker
2. Update DNS to point to Worker
3. Workers automatically connect
4. Shut down old coordinator

No worker changes needed!
