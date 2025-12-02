# Cloudflare Named Tunnel Setup (Bypassing IT Blocks)

**Problem:** University IT blocks `api.trycloudflare.com`  
**Solution:** Use named Cloudflare Tunnels with your own domain instead

---

## Why This Works

- **Quick Tunnels** (`trycloudflare.com`) require calling their API → BLOCKED ❌
- **Named Tunnels** use your domain + Cloudflare DNS → NOT BLOCKED ✅
- Workers register their tunnel subdomain with coordinator
- No random URLs, full DNS control under `cmacatalyst.onrender.com` or your domain

---

## One-Time Setup (Do Once)

### 1. Install cloudflared (Already Done ✅)
Your containers already have it installed!

### 2. Login to Cloudflare (On Your Machine)
```bash
# Login once on your development machine
cloudflared tunnel login
```

This opens browser to authenticate with Cloudflare and downloads a cert to `~/.cloudflared/cert.pem`

### 3. Create a Named Tunnel
```bash
# Create a tunnel named "rma-workers"
cloudflared tunnel create rma-workers
```

This generates:
- Tunnel ID (e.g., `abc123-def456-ghi789`)
- Tunnel credentials JSON file at `~/.cloudflared/<tunnel-id>.json`

### 4. Create DNS Records
```bash
# Route workers.cmacatalyst.com to the tunnel
cloudflared tunnel route dns rma-workers workers.cmacatalyst.com

# Or use wildcards for multiple workers
cloudflared tunnel route dns rma-workers *.workers.cmacatalyst.com
```

Now any subdomain like `worker-1.workers.cmacatalyst.com` will route through your tunnel!

---

## Worker Configuration

### Option A: Share Single Tunnel (Simple)

**Copy tunnel credentials to workers:**
```bash
# Copy the credentials file (secure - treat like a password!)
cp ~/.cloudflared/<tunnel-id>.json /data/CMACatalyst/RMA-Demo/worker-containers/tunnel-credentials.json
```

**Update worker containers to use named tunnel:**
```yaml
# docker-compose.yml
services:
  cpu-worker:
    environment:
      - COORDINATOR_URL=https://cmacatalyst.onrender.com
      - USE_TUNNEL=true
      - TUNNEL_TYPE=named
      - TUNNEL_CREDENTIALS=/app/tunnel-credentials.json
      - WORKER_SUBDOMAIN=${HOSTNAME}  # Uses container hostname
    volumes:
      - ./tunnel-credentials.json:/app/tunnel-credentials.json:ro
```

### Option B: Individual Tunnels Per Worker (Advanced)

Each worker gets its own tunnel for better isolation:
```bash
# Create worker-specific tunnels
cloudflared tunnel create rma-worker-1
cloudflared tunnel create rma-worker-2
cloudflared tunnel route dns rma-worker-1 worker-1.workers.cmacatalyst.com
cloudflared tunnel route dns rma-worker-2 worker-2.workers.cmacatalyst.com
```

---

## Updated Worker Agent Code

Add this to `worker_agent.py`:

```python
def start_named_tunnel(self, tunnel_credentials: str, subdomain: str) -> Optional[str]:
    """Start named Cloudflare tunnel (doesn't call trycloudflare API)"""
    
    if not os.path.exists(tunnel_credentials):
        print(f"⚠️  Tunnel credentials not found: {tunnel_credentials}")
        return None
    
    # Read tunnel ID from credentials
    with open(tunnel_credentials) as f:
        creds = json.load(f)
        tunnel_id = creds.get('TunnelID')
    
    if not tunnel_id:
        print("❌ Invalid tunnel credentials")
        return None
    
    # Construct tunnel URL
    tunnel_url = f"https://{subdomain}.workers.cmacatalyst.com"
    
    print(f"🔧 Starting named tunnel: {tunnel_url}")
    
    try:
        # Start tunnel pointing to local service
        self.tunnel_process = subprocess.Popen([
            'cloudflared', 'tunnel',
            '--credentials-file', tunnel_credentials,
            '--url', f'http://localhost:{self.service_port}',
            'run', tunnel_id
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Wait for "Connection registered" message
        timeout = 30
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            line = self.tunnel_process.stderr.readline()
            if 'Connection' in line and 'registered' in line:
                self.tunnel_url = tunnel_url
                print(f"✅ Named tunnel active: {tunnel_url}")
                return tunnel_url
            
            if self.tunnel_process.poll() is not None:
                print(f"❌ Tunnel failed to start")
                return None
            
            time.sleep(0.1)
        
        print("⚠️  Tunnel timeout")
        return None
        
    except Exception as e:
        print(f"❌ Tunnel error: {e}")
        return None

def start_tunnel(self) -> Optional[str]:
    """Start Cloudflare tunnel (named or quick)"""
    tunnel_type = os.getenv("TUNNEL_TYPE", "quick")
    
    if tunnel_type == "named":
        credentials = os.getenv("TUNNEL_CREDENTIALS")
        subdomain = os.getenv("WORKER_SUBDOMAIN", f"worker-{os.getenv('HOSTNAME', 'unknown')}")
        return self.start_named_tunnel(credentials, subdomain)
    else:
        # Fall back to quick tunnel (will fail if API blocked)
        return self.start_quick_tunnel()
```

---

## Environment Variables

```bash
# Named tunnel (bypasses IT block)
USE_TUNNEL=true
TUNNEL_TYPE=named
TUNNEL_CREDENTIALS=/app/tunnel-credentials.json
WORKER_SUBDOMAIN=worker-1  # Or use ${HOSTNAME}

# Quick tunnel (blocked by IT)
USE_TUNNEL=true
TUNNEL_TYPE=quick  # Default
```

---

## Deployment Flow

1. **Worker starts** → Reads tunnel credentials
2. **Runs cloudflared** → Connects to Cloudflare edge (NOT api.trycloudflare.com!)
3. **Gets subdomain** → e.g., `worker-1.workers.cmacatalyst.com`
4. **Registers with coordinator** → Sends tunnel URL: `https://worker-1.workers.cmacatalyst.com`
5. **Coordinator routes requests** → Uses tunnel URL instead of IP

---

## Testing Named Tunnel

```bash
# Test tunnel manually
cloudflared tunnel --credentials-file tunnel-credentials.json \
  --url http://localhost:8103 \
  run rma-workers

# In another terminal, test it works
curl https://worker-1.workers.cmacatalyst.com/health
```

---

## Benefits Over Quick Tunnels

| Feature | Quick Tunnel | Named Tunnel |
|---------|-------------|--------------|
| **API Call Required** | ✅ api.trycloudflare.com | ❌ No API (DNS only) |
| **Random URL** | ✅ Yes | ❌ Your domain |
| **IT Block Bypass** | ❌ Gets blocked | ✅ Works |
| **Persistent** | ❌ Changes each run | ✅ Same URL |
| **Setup Complexity** | Easy | One-time setup |
| **Security** | Public random | Your domain |

---

## Alternative: Coordinator as Tunnel Broker

Even simpler - have workers register with coordinator which creates tunnel subdomains:

1. Worker → Registers with coordinator: "I need a tunnel"
2. Coordinator → Assigns subdomain: "You are worker-5.workers.cmacatalyst.com"
3. Worker → Starts named tunnel with that subdomain
4. Worker → Confirms tunnel active
5. Coordinator → Routes traffic to worker's tunnel

This way the coordinator manages the DNS/subdomain allocation!

---

## Quick Start Commands

```bash
# 1. One-time setup (on your machine)
cloudflared tunnel login
cloudflared tunnel create rma-workers
cloudflared tunnel route dns rma-workers *.workers.cmacatalyst.com

# 2. Copy credentials to project
cp ~/.cloudflared/<tunnel-id>.json worker-containers/tunnel-credentials.json

# 3. Update docker-compose.yml (see above)

# 4. Start workers
docker-compose up -d

# 5. Check worker registered with tunnel URL
curl https://cmacatalyst.onrender.com/api/admin/workers | jq
```

---

## Security Note

⚠️ The `tunnel-credentials.json` file is like a password! 

- Don't commit to git (add to .gitignore)
- Mount as read-only in containers
- Rotate if compromised
- Each tunnel can have multiple credentials for rotation

---

## Need Help?

The named tunnel approach completely bypasses the IT block because:
- No calls to `api.trycloudflare.com` ✅
- Uses standard Cloudflare infrastructure ✅
- Routes through your domain DNS ✅
- Same protocol as any Cloudflare-proxied site ✅

Would you like me to implement this in the worker agent code?
