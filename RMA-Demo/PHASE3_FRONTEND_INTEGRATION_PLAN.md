# Phase 3: Frontend Integration Plan

**Date:** 2025-12-09
**Status:** Planning
**Prerequisites:** Phase 1 (VPN Mesh) + Phase 2 (Service Endpoints) Complete

---

## Overview

Phase 3 connects the frontend (rmatool.org.uk) to the worker mesh, enabling end-to-end service requests from browser to workers. The key challenge is **entry point discovery** - how does the frontend find and connect to workers?

---

## Architecture Goal

```
Frontend (Browser)
    ↓
    ↓ Fetch entry points
    ↓
Cloudflare Worker (Entry Point Discovery API)
    ↓ Read from KV (cached 5min)
    ↓
Cloudflare KV (Entry Points Registry)
    ↑ Updated by workers
    ↑
Workers with Public IPs / Cloudflare Tunnels
    ↓
    ↓ Request routing via HTTP
    ↓
Worker Mesh (Service Endpoints)
```

---

## Current State Assessment

### ✅ What's Ready:

1. **Worker Service Endpoints**
   - `/health` - Worker status
   - `/service/{service_type}` - Service request handler
   - `/stats` - Routing statistics

2. **Worker-to-Worker Communication**
   - HTTP-based request forwarding works
   - Container-to-container communication verified

3. **Coordinator Service Registry**
   - Workers register with coordinator
   - Service assignment working
   - Health tracking functional

### ❌ What's Missing:

1. **Entry Point Discovery**
   - No mechanism for frontend to find workers
   - No entry point registration
   - No public IP tracking

2. **Frontend HTTP Client**
   - No code to fetch entry points
   - No retry/fallback logic
   - No load balancing

3. **Cloudflare KV Integration**
   - No KV namespace set up
   - No worker entry point publishing
   - No Cloudflare Worker for discovery API

---

## Implementation Phases

### Phase 3.1: Entry Point Registration

**Goal:** Workers with public IPs or tunnels register as entry points

#### Changes Needed:

1. **Detect Entry Point Capability**

**File:** `worker_agent.py` (lines ~250-260)

```python
def detect_entry_point_capability(self):
    """
    Determine if this worker can serve as entry point
    Returns: (can_be_entry_point, access_url)
    """
    # Priority 1: Cloudflare tunnel URL
    if self.tunnel_url and "trycloudflare.com" in self.tunnel_url:
        return (True, self.tunnel_url)

    # Priority 2: Public IP with open port
    if self.capabilities.get("has_public_ip"):
        public_ip = self.capabilities.get("public_ip")
        # Verify port 8000 is accessible from outside
        # For now, assume it is
        return (True, f"https://{public_ip}:8443")

    # Priority 3: VPN IP (if frontend can reach VPN)
    if self.vpn_ip:
        return (True, f"http://{self.vpn_ip}:8000")

    return (False, None)
```

2. **Register as Entry Point with Coordinator**

**File:** `worker_agent.py` (add new method ~600)

```python
async def register_entry_point(self):
    """Register worker as entry point if capable"""
    can_be_entry, access_url = self.detect_entry_point_capability()

    if not can_be_entry:
        logger.info("ℹ️  Worker not suitable as entry point")
        return

    try:
        response = requests.post(
            f"{self.coordinator_url}/api/entry-points/register",
            json={
                "worker_id": self.worker_id,
                "access_url": access_url,
                "services": self.assigned_services,
                "capabilities": self.capabilities
            },
            timeout=5
        )

        if response.status_code == 200:
            logger.info(f"✅ Registered as entry point: {access_url}")
            self.is_entry_point = True
        else:
            logger.warning(f"Entry point registration failed: {response.status_code}")

    except Exception as e:
        logger.error(f"Failed to register entry point: {e}")
```

3. **Call Registration in Worker Startup**

**File:** `worker_agent.py` (in `run()` method after API server starts)

```python
# Step 6: Register as entry point if applicable
logger.info("🔍 Checking entry point capability...")
await self.register_entry_point()
```

#### Coordinator Changes:

**File:** `services/local-coordinator/app.py` (add new endpoint)

```python
# Global storage for entry points
entry_points = []  # List of {worker_id, access_url, services, last_seen}

@app.post("/api/entry-points/register")
async def register_entry_point(data: dict):
    """Register a worker as an entry point"""
    worker_id = data.get("worker_id")
    access_url = data.get("access_url")
    services = data.get("services", [])

    # Find or create entry point record
    existing = next((ep for ep in entry_points if ep["worker_id"] == worker_id), None)

    if existing:
        existing["access_url"] = access_url
        existing["services"] = services
        existing["last_seen"] = datetime.now().isoformat()
    else:
        entry_points.append({
            "worker_id": worker_id,
            "access_url": access_url,
            "services": services,
            "last_seen": datetime.now().isoformat(),
            "status": "active"
        })

    logger.info(f"✅ Entry point registered: {worker_id} → {access_url}")

    return {"status": "registered", "worker_id": worker_id}


@app.get("/api/entry-points")
async def get_entry_points():
    """Get list of active entry points"""
    now = datetime.now()

    # Filter out stale entry points (no update in 2 minutes)
    active = []
    for ep in entry_points:
        last_seen = datetime.fromisoformat(ep["last_seen"])
        age = (now - last_seen).total_seconds()

        if age < 120:  # 2 minutes
            active.append({
                "worker_id": ep["worker_id"],
                "access_url": ep["access_url"],
                "services": ep["services"]
            })

    return {
        "entry_points": active,
        "count": len(active),
        "timestamp": now.isoformat()
    }
```

---

### Phase 3.2: Cloudflare KV Entry Point Publishing

**Goal:** Sync coordinator's entry points to Cloudflare KV for edge caching

#### Option A: Push from Coordinator (Simple)

**File:** `services/local-coordinator/app.py` (background task)

```python
import os
import httpx

CLOUDFLARE_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")
CLOUDFLARE_KV_NAMESPACE_ID = os.getenv("CF_KV_NAMESPACE_ID")
CLOUDFLARE_API_TOKEN = os.getenv("CF_API_TOKEN")

async def sync_entry_points_to_kv():
    """Background task to sync entry points to Cloudflare KV"""
    while True:
        try:
            await asyncio.sleep(30)  # Sync every 30 seconds

            # Get active entry points
            active = []
            now = datetime.now()
            for ep in entry_points:
                last_seen = datetime.fromisoformat(ep["last_seen"])
                if (now - last_seen).total_seconds() < 120:
                    active.append({
                        "worker_id": ep["worker_id"],
                        "access_url": ep["access_url"],
                        "services": ep["services"]
                    })

            if not active:
                logger.debug("No active entry points to sync")
                continue

            # Push to Cloudflare KV
            kv_url = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/{CLOUDFLARE_KV_NAMESPACE_ID}/values/entry_points"

            async with httpx.AsyncClient() as client:
                response = await client.put(
                    kv_url,
                    headers={
                        "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "entry_points": active,
                        "updated_at": now.isoformat()
                    },
                    timeout=10
                )

                if response.status_code == 200:
                    logger.debug(f"✅ Synced {len(active)} entry points to KV")
                else:
                    logger.warning(f"KV sync failed: {response.status_code}")

        except Exception as e:
            logger.error(f"Entry point sync error: {e}")
```

**Start task in `lifespan()`:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ...

    # Start entry point sync
    sync_task = asyncio.create_task(sync_entry_points_to_kv())

    yield

    # Shutdown
    sync_task.cancel()
```

#### Option B: Pull from Cloudflare Worker (Better Caching)

**Pros:** Cloudflare Worker caches at edge, reducing KV reads
**Cons:** More complex, requires Cloudflare Worker deployment

*(Defer to Option A for MVP)*

---

### Phase 3.3: Cloudflare Worker Entry Point Discovery API

**Goal:** Edge-cached API for frontend to fetch entry points

**File:** `services/cloudflare-entry-discovery/worker.js` (new file)

```javascript
export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const cacheKey = new Request("https://cache/entry-points", request);

    // Check edge cache first (NOT KV quota)
    let response = await cache.match(cacheKey);

    if (!response) {
      // Cache miss - read from KV (counts against quota)
      const entryPointsData = await env.VPN_KV.get("entry_points", "json");

      if (!entryPointsData) {
        return new Response(
          JSON.stringify({
            error: "No entry points available",
            entry_points: [],
            count: 0
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }

      response = new Response(JSON.stringify(entryPointsData), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60", // Cache 1 minute
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });

      // Store in edge cache (valid for 1 minute)
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  }
}
```

**Deployment:**
```bash
# Create Cloudflare Worker
cd services/cloudflare-entry-discovery
wrangler deploy

# Bind to KV namespace
wrangler kv:namespace create VPN_KV
wrangler kv:namespace list
# Update wrangler.toml with namespace ID
```

**wrangler.toml:**
```toml
name = "entry-point-discovery"
main = "worker.js"
compatibility_date = "2025-12-09"

[[kv_namespaces]]
binding = "VPN_KV"
id = "<NAMESPACE_ID>"
```

---

### Phase 3.4: Frontend Entry Point Client

**Goal:** Frontend can discover and connect to entry points

**File:** `frontend/src/lib/entry-points.ts` (new file)

```typescript
const ENTRY_POINT_API = "https://api.rmatool.org.uk/entry-points";

interface EntryPoint {
  worker_id: string;
  access_url: string;
  services: string[];
}

interface EntryPointResponse {
  entry_points: EntryPoint[];
  count: number;
  updated_at: string;
}

// Cache entry points in memory (1 minute TTL)
let cachedEntryPoints: EntryPoint[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getEntryPoints(): Promise<EntryPoint[]> {
  // Check cache
  const now = Date.now();
  if (cachedEntryPoints && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedEntryPoints;
  }

  try {
    const response = await fetch(ENTRY_POINT_API, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Entry point fetch failed: ${response.status}`);
    }

    const data: EntryPointResponse = await response.json();

    // Update cache
    cachedEntryPoints = data.entry_points;
    cacheTimestamp = now;

    return data.entry_points;

  } catch (error) {
    console.error('Failed to fetch entry points:', error);

    // Return cached data if available
    if (cachedEntryPoints) {
      return cachedEntryPoints;
    }

    throw error;
  }
}

export async function sendServiceRequest(
  serviceType: string,
  requestData: any,
  options?: {
    timeout?: number;
    retries?: number;
  }
): Promise<any> {
  const timeout = options?.timeout || 30000; // 30s default
  const maxRetries = options?.retries || 3;

  const entryPoints = await getEntryPoints();

  if (entryPoints.length === 0) {
    throw new Error('No entry points available');
  }

  // Filter entry points that offer the requested service
  const suitableEntryPoints = entryPoints.filter(ep =>
    ep.services.includes(serviceType)
  );

  // Fallback to any entry point (they can forward)
  const tryEntryPoints = suitableEntryPoints.length > 0
    ? suitableEntryPoints
    : entryPoints;

  // Try each entry point with retries
  let lastError: Error | null = null;

  for (const entryPoint of tryEntryPoints) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(
          `${entryPoint.access_url}/service/${serviceType}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Service request failed: ${response.status}`);
        }

        return await response.json();

      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Entry point ${entryPoint.worker_id} attempt ${attempt + 1} failed:`,
          error
        );

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
  }

  throw new Error(
    `All entry points failed. Last error: ${lastError?.message}`
  );
}

// Convenience functions for specific services
export async function sendNotesCOARequest(noteText: string): Promise<any> {
  return sendServiceRequest('notes-coa', { text: noteText });
}

export async function sendLLMRequest(prompt: string): Promise<any> {
  return sendServiceRequest('llm-inference', { prompt });
}

export async function sendOCRRequest(imageData: string): Promise<any> {
  return sendServiceRequest('vision-ocr', { image: imageData });
}
```

---

### Phase 3.5: Frontend UI Integration

**Goal:** Update frontend components to use entry point client

**File:** `frontend/src/components/ServiceRequestForm.tsx` (example)

```typescript
import { sendServiceRequest } from '@/lib/entry-points';
import { useState } from 'react';

export function ServiceRequestForm() {
  const [serviceType, setServiceType] = useState('notes-coa');
  const [requestData, setRequestData] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const data = await sendServiceRequest(
        serviceType,
        JSON.parse(requestData)
      );

      setResponse(data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select value={serviceType} onChange={e => setServiceType(e.target.value)}>
        <option value="notes-coa">Notes COA</option>
        <option value="llm-inference">LLM Inference</option>
        <option value="vision-ocr">Vision OCR</option>
        <option value="ner-extraction">NER Extraction</option>
      </select>

      <textarea
        value={requestData}
        onChange={e => setRequestData(e.target.value)}
        placeholder='{"text": "Sample input"}'
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Request'}
      </button>

      {error && <div className="error">{error}</div>}
      {response && <pre>{JSON.stringify(response, null, 2)}</pre>}
    </form>
  );
}
```

---

## Testing Plan

### Phase 3.1 Testing: Entry Point Registration

**Test 1: Worker Detects Entry Point Capability**
```bash
# Start worker with tunnel
docker logs edge-local-worker | grep "entry point"
# Expected: "✅ Registered as entry point: https://..."
```

**Test 2: Coordinator Lists Entry Points**
```bash
curl http://localhost:8080/api/entry-points
# Expected: List of registered entry points
```

### Phase 3.2 Testing: KV Sync

**Test 1: Verify KV Contains Entry Points**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/entry_points" \
  -H "Authorization: Bearer {api_token}"
# Expected: JSON with entry points
```

**Test 2: Monitor Sync Frequency**
```bash
# Check coordinator logs
docker logs edge-coordinator | grep "Synced.*entry points"
# Expected: Updates every 30 seconds
```

### Phase 3.3 Testing: Cloudflare Worker

**Test 1: Fetch Entry Points via Edge API**
```bash
curl https://api.rmatool.org.uk/entry-points
# Expected: Cached entry point list (1min cache)
```

**Test 2: Verify Cache Headers**
```bash
curl -I https://api.rmatool.org.uk/entry-points
# Expected: Cache-Control: public, max-age=60
```

### Phase 3.4 Testing: Frontend Client

**Test 1: Fetch Entry Points from Frontend**
```typescript
import { getEntryPoints } from '@/lib/entry-points';

const entryPoints = await getEntryPoints();
console.log('Entry points:', entryPoints);
// Expected: Array of entry points
```

**Test 2: Send Service Request**
```typescript
import { sendServiceRequest } from '@/lib/entry-points';

const result = await sendServiceRequest('notes-coa', {
  text: 'Test clinical note'
});
console.log('Result:', result);
// Expected: Service response
```

### Phase 3.5 Testing: End-to-End

**Test 1: Complete Request Flow**
1. Start worker with tunnel
2. Worker registers as entry point
3. Coordinator syncs to KV
4. Frontend fetches entry points
5. Frontend sends service request
6. Worker processes and returns response

**Test 2: Failover Testing**
1. Start 2 workers as entry points
2. Send request from frontend
3. Stop first entry point mid-request
4. Verify request retries to second entry point
5. Verify request succeeds

---

## Security Considerations

### 1. Entry Point Authentication

**Issue:** Anyone can call entry point APIs

**Mitigation:**
- Add API key authentication
- Use Cloudflare Access for public endpoints
- Rate limiting per IP

### 2. Request Validation

**Issue:** Malicious payloads could exploit workers

**Mitigation:**
- Validate request schemas with Pydantic
- Sanitize user input
- Limit request size

### 3. CORS Configuration

**Issue:** Cross-origin requests from frontend

**Mitigation:**
- Strict CORS headers on entry points
- Whitelist frontend domains only

---

## Performance Optimization

### 1. Entry Point Caching

- Frontend caches entry points (1 min TTL)
- Cloudflare Worker caches at edge (1 min TTL)
- Reduces KV reads: ~1 per minute per region

### 2. Connection Pooling

- Reuse HTTP connections to entry points
- Reduce TLS handshake overhead

### 3. Load Balancing

- Distribute requests across multiple entry points
- Health-check entry points periodically

---

## Deployment Steps

### 1. Configure Cloudflare KV

```bash
# Create KV namespace
wrangler kv:namespace create VPN_KV

# Note the namespace ID
export CF_KV_NAMESPACE_ID="<ID>"
```

### 2. Deploy Cloudflare Worker

```bash
cd services/cloudflare-entry-discovery
wrangler deploy
```

### 3. Update Coordinator

```bash
# Set environment variables
export CF_ACCOUNT_ID="<your_account_id>"
export CF_KV_NAMESPACE_ID="<namespace_id>"
export CF_API_TOKEN="<api_token>"

# Restart coordinator
docker restart edge-coordinator
```

### 4. Update Workers

```bash
# Rebuild worker image with Phase 3 changes
cd worker-containers/universal-worker
docker build -f Dockerfile.optimized -t universal-worker:latest .

# Restart workers
docker restart edge-local-worker
```

### 5. Update Frontend

```bash
cd frontend
npm install
npm run build
npm run deploy
```

---

## Success Criteria

✅ **Phase 3 Complete When:**

1. Workers with tunnels register as entry points
2. Coordinator maintains active entry point list
3. Entry points sync to Cloudflare KV every 30s
4. Cloudflare Worker API returns cached entry points
5. Frontend can fetch entry points programmatically
6. Frontend can send service requests to entry points
7. Requests route through workers to correct service
8. Failover works when entry point goes down
9. End-to-end request completes in < 5 seconds
10. System handles 100+ req/min from frontend

---

## Timeline Estimate

| Phase | Task | Estimate |
|-------|------|----------|
| 3.1 | Entry point registration | 2-3 hours |
| 3.2 | Cloudflare KV sync | 1-2 hours |
| 3.3 | Cloudflare Worker API | 1 hour |
| 3.4 | Frontend client library | 2-3 hours |
| 3.5 | Frontend UI integration | 2-4 hours |
| Testing | End-to-end testing | 2-3 hours |

**Total:** 10-16 hours (~2 working days)

---

## Next Steps

1. ✅ Create Phase 3 plan
2. 🔲 Set up Cloudflare KV namespace
3. 🔲 Implement entry point registration in workers
4. 🔲 Add entry point endpoints to coordinator
5. 🔲 Implement KV sync in coordinator
6. 🔲 Deploy Cloudflare Worker for discovery API
7. 🔲 Create frontend entry point client
8. 🔲 Integrate into frontend UI
9. 🔲 End-to-end testing
10. 🔲 Production deployment

---

**Plan Version:** 1.0
**Created:** 2025-12-09
**Status:** Ready for Implementation
