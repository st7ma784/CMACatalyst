# Edge Federation Architecture Guide

## The Problem You're Solving

You want multiple edge workers (each behind firewalls) to:
1. All register at a single public URL: `api.rmatool.org.uk`
2. Accept requests routed through that URL
3. **Without hitting KV limits**

## How It Works (The Simple Answer)

Each edge worker creates its own Cloudflare Tunnel when it starts:

```bash
# Edge Worker 1 (behind firewall in UK)
docker run -e WORKER_TYPE=edge ...
  → Creates tunnel: https://abc123.trycloudflare.com
  → Registers at api.rmatool.org.uk with tunnel URL
  → Starts coordinator on port 8080 (accessible via tunnel)

# Edge Worker 2 (behind firewall in US)  
docker run -e WORKER_TYPE=edge ...
  → Creates tunnel: https://xyz789.trycloudflare.com
  → Registers at api.rmatool.org.uk with tunnel URL
  → Starts coordinator on port 8080 (accessible via tunnel)
```

Now `api.rmatool.org.uk` knows about both tunnels and can route requests to them!

## The Cloudflare Edge Worker (at api.rmatool.org.uk)

This is a **simple router** that stores a list of edge coordinators:

```javascript
// Deployed at api.rmatool.org.uk (Cloudflare Worker)
// This is STATELESS - just stores a map of coordinators

let coordinators = [
  { id: "uk-1", url: "https://abc123.trycloudflare.com", location: "uk" },
  { id: "us-1", url: "https://xyz789.trycloudflare.com", location: "us" }
];

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    
    // Worker registration endpoint
    if (path === '/api/worker/register' && request.method === 'POST') {
      const data = await request.json();
      
      if (data.worker_type === 'edge') {
        // Add to coordinators list (in-memory, no KV!)
        coordinators.push({
          id: data.worker_id,
          url: data.tunnel_url,  // e.g., https://abc123.trycloudflare.com
          location: data.location || 'unknown'
        });
        
        return new Response(JSON.stringify({ 
          status: "registered",
          role: "edge_coordinator" 
        }));
      }
      
      // Non-edge workers: pick closest coordinator and forward
      const coordinator = selectClosestCoordinator(coordinators, request);
      return fetch(`${coordinator.url}/api/worker/register`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    
    // All other requests: route to nearest coordinator
    const coordinator = selectClosestCoordinator(coordinators, request);
    return fetch(`${coordinator.url}${path}`, request);
  }
};

function selectClosestCoordinator(coordinators, request) {
  // Simple round-robin or geo-based selection
  return coordinators[Math.floor(Math.random() * coordinators.length)];
}
```

## Do You Need KV?

**Short answer: Use Durable Objects (free tier)!**

For bootstrapping without any local hosting, use **Cloudflare Durable Objects**:
- Free tier: 1M reads/day, 1K writes/day
- Perfect for coordinator registry (5-20 coordinators = 20 writes max)
- Persistent in-memory storage (survives restarts)
- Zero hosting costs ✅

**Why this works:**
```
Edge coordinators register: 20 writes (one-time per coordinator)
Worker heartbeats: Go to edge coordinators (not to KV!)
KV writes per day: ~0 for steady state ✅
```

## The Bootstrap Problem

**Q: How does the FIRST edge worker start if there's no coordinator?**

**A: The first edge worker IS the coordinator!**

```python
# In worker_agent.py
def run(self):
    if self.capabilities.get("worker_type") == "edge":
        # I'm an edge worker - run coordinator locally
        logger.info("🌐 Starting LOCAL coordinator on port 8080")
        
        # Start coordinator service
        self.launch_coordinator()
        
        # Register with api.rmatool.org.uk
        # Tell it: "I'm a coordinator, route workers to me!"
        self.register_as_edge_coordinator()
        
        # Now wait for other workers to connect to ME
        logger.info(f"✅ Coordinator ready at {self.tunnel_url}")
        
        # Keep running forever
        self.heartbeat_loop()
```

## Registration Flow

### Edge Worker Registration:
```
Edge Worker (UK)
  ↓ Create tunnel
  ↓ https://abc123.trycloudflare.com
  ↓
POST api.rmatool.org.uk/api/worker/register
  {
    "worker_type": "edge",
    "tunnel_url": "https://abc123.trycloudflare.com",
    "services": ["coordinator", "edge-proxy"]
  }
  ↓
api.rmatool.org.uk stores:
  coordinators.push("https://abc123.trycloudflare.com")
  ↓
Returns: { "status": "registered", "role": "edge_coordinator" }
```

### GPU Worker Registration:
```
GPU Worker
  ↓ Create tunnel
  ↓ https://gpu456.trycloudflare.com  
  ↓
POST api.rmatool.org.uk/api/worker/register
  {
    "worker_type": "gpu",
    "tunnel_url": "https://gpu456.trycloudflare.com",
    "gpu": "RTX 4090"
  }
  ↓
api.rmatool.org.uk picks a coordinator:
  coordinator = coordinators[0]  // "https://abc123.trycloudflare.com"
  ↓
POST https://abc123.trycloudflare.com/api/worker/register
  {
    "worker_type": "gpu",
    "tunnel_url": "https://gpu456.trycloudflare.com",
    "gpu": "RTX 4090"
  }
  ↓
UK Coordinator stores worker in memory
Returns: { "assigned_services": ["llm-inference"] }
```

## Handling Coordinator Failures

If a coordinator goes offline:
1. Its tunnel URL becomes unreachable
2. api.rmatool.org.uk detects this (health checks or failed requests)
3. Removes it from the coordinators list
4. Routes new requests to remaining coordinators
5. Workers connected to dead coordinator automatically reconnect to api.rmatool.org.uk

## Fully Serverless Setup (Zero Hosting Costs!)

### 1. Deploy Cloudflare Edge Router (One-Time, Free Forever)

This is your `api.rmatool.org.uk` - the global entry point that routes to edge coordinators.

```bash
cd services/cloudflare-edge-router
npm install wrangler
npx wrangler deploy
```

### 2. Start Edge Coordinator (Anyone Can Run One)

**On your friend's always-on server, university lab machine, or cloud VM:**

```bash
# Single docker-compose command - bundles coordinator + edge worker + tunnel
docker-compose -f edge-coordinator.yml up -d
```

**What this does:**
1. Starts local coordinator on port 8080
2. Starts cloudflared tunnel pointing to coordinator
3. Registers tunnel URL at `api.rmatool.org.uk`
4. Accepts worker registrations from anyone

**The docker-compose file:**
```yaml
version: '3.8'

services:
  coordinator:
    image: ghcr.io/st7ma784/cmacatalyst/coordinator:latest
    container_name: edge-coordinator
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - HOST=0.0.0.0
      - PORT=8080
    networks:
      - edge-network

  tunnel:
    image: cloudflare/cloudflared:latest
    container_name: edge-tunnel
    restart: unless-stopped
    command: tunnel --url http://coordinator:8080 --no-autoupdate
    depends_on:
      - coordinator
    networks:
      - edge-network

  edge-registrar:
    image: ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
    container_name: edge-registrar
    restart: unless-stopped
    environment:
      - WORKER_TYPE=edge
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - USE_TUNNEL=true
    depends_on:
      - tunnel
    networks:
      - edge-network

networks:
  edge-network:
    driver: bridge
```

**Anyone can start one!** No coordination needed - just run it and it auto-registers.

### 3. Start GPU/CPU Workers (Also Zero Config)

```bash
# On any machine with GPU
docker run -d \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=auto \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**What happens:**
1. Worker connects to `api.rmatool.org.uk`
2. Edge router picks closest coordinator
3. Worker registers there (tunnel auto-created)
4. Worker receives service assignments
5. User requests get routed through tunnels

### 4. Turn Off Your Desktop! 

Once edge coordinators are running on contributor machines:
- You don't need to host anything
- No cloud costs
- No VPS fees
- Everything runs on volunteer hardware
- Coordinators stay online as long as contributors keep them running

## Why This Avoids KV Limits

**Traditional approach (bad):**
```
Every heartbeat → KV write
10 workers × 2,880 heartbeats/day = 28,800 KV writes ❌
```

**Edge federation approach (good):**
```
Edge coordinator registration → 1 KV write (or in-memory)
Worker heartbeats → Local coordinator (in-memory, unlimited)
api.rmatool.org.uk → Just routes requests (no KV)
```

**Total KV usage:**
- 5 edge coordinators × 1 registration = 5 writes total
- 0 ongoing writes for heartbeats ✅
- Stays well under 1,000 writes/day limit!

## Key Insight

The magic is that **each coordinator is accessible via its Cloudflare Tunnel**, so:
- No port forwarding needed
- No public IP required
- No firewall configuration
- Just create tunnel + register URL

The `api.rmatool.org.uk` Edge Worker is just a **thin router** that:
1. Remembers which tunnel URLs are coordinators
2. Routes requests to them
3. Doesn't store any state (or minimal state)

Does this make sense now?
