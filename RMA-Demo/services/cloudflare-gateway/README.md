# RMA Cloudflare Gateway

Simple gateway that forwards frontend requests to the coordinator, which handles all worker routing.

## Architecture

```
Frontend (rmatool.org.uk)
    ↓ HTTPS
Cloudflare Worker (this gateway)
    ↓ HTTPS
Coordinator (via Cloudflare Tunnel)
    ↓ HTTP (internal)
Workers (VPN mesh)
```

**Key Benefits:**
- ✅ No KV storage needed (zero quota usage)
- ✅ Free tier compatible (100k requests/day)
- ✅ Simple forwarding logic (< 100 lines)
- ✅ Coordinator handles all routing
- ✅ Workers don't need public IPs

---

## Prerequisites

1. **Cloudflare Account** (free tier works)
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Coordinator with Public URL** (Cloudflare Tunnel)

---

## Setup

### Step 1: Install Wrangler

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Step 2: Get Coordinator Tunnel URL

**Option A: Use Existing Tunnel**

```bash
# Check if tunnel is running
docker logs edge-tunnel 2>&1 | grep "https://.*trycloudflare.com"

# Example output:
# https://saved-honors-detector-larger.trycloudflare.com
```

**Option B: Create New Tunnel (if rate-limited)**

```bash
# Stop old tunnel
docker stop edge-tunnel

# Start new tunnel
docker run -d --name edge-tunnel \\
  --network host \\
  cloudflare/cloudflared:latest \\
  tunnel --url http://localhost:8080 --no-autoupdate

# Get URL
docker logs edge-tunnel 2>&1 | grep "https://" | tail -1
```

**Option C: Use Named Tunnel (Most Stable)**

```bash
# Create named tunnel (persists, no rate limits)
wrangler tunnel create rma-coordinator

# Get tunnel credentials
# Configure tunnel to point to localhost:8080
```

### Step 3: Configure Gateway

```bash
cd services/cloudflare-gateway

# Set coordinator URL as secret
wrangler secret put COORDINATOR_URL

# When prompted, enter your tunnel URL:
# https://your-tunnel.trycloudflare.com
```

### Step 4: Deploy Gateway

```bash
# Deploy to Cloudflare
wrangler deploy

# Output will show your worker URL:
# https://rma-gateway.<your-subdomain>.workers.dev
```

### Step 5: (Optional) Add Custom Domain

```bash
# In wrangler.toml, uncomment routes section:
routes = [
  { pattern = "api.rmatool.org.uk/*", zone_name = "rmatool.org.uk" }
]

# Deploy again
wrangler deploy
```

---

## Testing

### Test 1: Health Check

```bash
# Via workers.dev URL
curl https://rma-gateway.<your-subdomain>.workers.dev/health

# Expected response:
{
  "status": "healthy",
  "coordinator": "local-fastapi",
  "workers": {
    "total": 2,
    "active": 2
  }
}
```

### Test 2: Service List

```bash
curl https://rma-gateway.<your-subdomain>.workers.dev/api/admin/services

# Expected: List of available services
{
  "services": [
    {"name": "llm-inference", "workers": ["edge-local-worker"], "worker_count": 1},
    {"name": "notes-coa", "workers": ["edge-local-worker"], "worker_count": 1},
    ...
  ]
}
```

### Test 3: Service Request

```bash
curl -X POST https://rma-gateway.<your-subdomain>.workers.dev/service/llm/test \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Hello world"}'

# Expected: Service response from worker
```

### Test 4: Complete Flow

```bash
# From frontend JavaScript
fetch('https://api.rmatool.org.uk/service/notes/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Clinical note...' })
})
.then(r => r.json())
.then(data => console.log('Response:', data));
```

---

## Frontend Integration

### Update API Base URL

```typescript
// frontend/src/config.ts
export const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rmatool.org.uk'  // Custom domain
    : 'https://rma-gateway.<your-subdomain>.workers.dev';  // Development
```

### Service Request Helper

```typescript
// frontend/src/lib/api.ts
export async function callService(
  service: string,
  path: string,
  data?: any,
  options?: RequestInit
) {
  const url = `${API_BASE_URL}/service/${service}/${path}`;

  const response = await fetch(url, {
    method: data ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options
  });

  if (!response.ok) {
    throw new Error(`Service request failed: ${response.status}`);
  }

  return response.json();
}

// Usage examples
await callService('notes', 'process', { text: 'Note text' });
await callService('llm', 'generate', { prompt: 'Prompt' });
await callService('ocr', 'extract', { image: base64Image });
```

---

## Request Flow

1. **Frontend** sends request to `https://api.rmatool.org.uk/service/notes/process`
2. **Cloudflare Worker** (this gateway) forwards to coordinator
3. **Coordinator** looks up "notes-coa" service in registry
4. **Coordinator** finds worker: `edge-local-worker`
5. **Coordinator** proxies to `http://edge-local-worker:8000/process`
6. **Worker** processes request and returns response
7. Response flows back through chain to frontend

---

## Monitoring

### Check Gateway Logs

```bash
# Real-time logs
wrangler tail

# Recent errors
wrangler tail --status error
```

### Check Coordinator Logs

```bash
# Service proxy requests
docker logs edge-coordinator 2>&1 | grep "Service proxy"

# Worker forwarding
docker logs edge-coordinator 2>&1 | grep "Proxying to worker"
```

### Check Request Stats

```bash
# Cloudflare dashboard → Workers & Pages → rma-gateway → Metrics
# Shows: Requests, Errors, CPU time
```

---

## Troubleshooting

### Issue: Gateway returns 502

**Cause:** Coordinator tunnel unreachable

**Fix:**
```bash
# Check tunnel is running
docker ps | grep edge-tunnel

# Check tunnel URL is correct
wrangler secret list

# Update if needed
wrangler secret put COORDINATOR_URL
```

### Issue: CORS errors in browser

**Cause:** CORS headers not set

**Fix:** Gateway automatically adds CORS headers. Check browser console for actual error.

### Issue: Service not found (503)

**Cause:** No worker provides the requested service

**Fix:**
```bash
# Check which services are available
curl https://api.rmatool.org.uk/api/admin/services

# Check worker health
curl https://api.rmatool.org.uk/api/admin/workers
```

### Issue: Tunnel rate limited

**Cause:** Too many quick tunnel requests to Cloudflare

**Fix:** Use named tunnel instead of quick tunnel:
```bash
wrangler tunnel create rma-coordinator
# Follow setup instructions
```

---

## Cost Analysis

### Cloudflare Workers Free Tier

- **100,000 requests/day** - Free
- **10ms CPU time/request** (typical)
- **1,000 requests/min burst** - Free

### Usage Estimate

| Users | Requests/Day | Cost |
|-------|--------------|------|
| 10    | ~1,000      | $0   |
| 100   | ~10,000     | $0   |
| 1,000 | ~100,000    | $0   |
| 10,000| ~1,000,000  | $5/month (paid plan needed) |

**Recommendation:** Start with free tier, upgrade when you hit 100k requests/day

---

## Production Checklist

- [ ] Use named Cloudflare Tunnel (not quick tunnel)
- [ ] Set up custom domain (api.rmatool.org.uk)
- [ ] Enable Cloudflare Analytics
- [ ] Add rate limiting (Cloudflare dashboard)
- [ ] Set up monitoring alerts
- [ ] Test failover (stop coordinator, verify error handling)
- [ ] Load test (1000 requests/min)
- [ ] Document for team

---

## Security

### CORS

Gateway allows all origins (`*`) by default. For production, restrict to your domain:

```javascript
// In worker.js, replace:
newResponse.headers.set('Access-Control-Allow-Origin', '*');

// With:
const allowedOrigins = ['https://rmatool.org.uk', 'https://www.rmatool.org.uk'];
const origin = request.headers.get('Origin');
if (allowedOrigins.includes(origin)) {
  newResponse.headers.set('Access-Control-Allow-Origin', origin);
}
```

### Rate Limiting

Add in Cloudflare dashboard:
- Go to Workers & Pages → rma-gateway → Settings → Triggers
- Add rate limit: 100 requests/min per IP

### Authentication

For authenticated endpoints, add API key check:

```javascript
// In worker.js, add before forwarding:
const apiKey = request.headers.get('X-API-Key');
if (!apiKey || apiKey !== env.API_KEY) {
  return new Response('Unauthorized', { status: 401 });
}
```

---

## Maintenance

### Update Gateway

```bash
# Make changes to worker.js
# Deploy updated version
wrangler deploy
```

### Rollback

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback
```

### Update Coordinator URL

```bash
# If tunnel URL changes
wrangler secret put COORDINATOR_URL
# Enter new URL

# No redeployment needed, changes take effect immediately
```

---

## Support

- **Wrangler Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Cloudflare Tunnels:** https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- **Workers Free Tier:** https://developers.cloudflare.com/workers/platform/pricing/

---

**Created:** 2025-12-09
**Version:** 1.0
**Status:** Ready for deployment
