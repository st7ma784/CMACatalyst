# Cloudflare Tunnel Troubleshooting & Alternatives

## Issue: SSL/TLS Connection to Cloudflare API

**Symptoms:**
```
failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": EOF
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL
```

**Root Cause:**
- Network firewall blocking Cloudflare API
- Corporate/institutional network restrictions
- SSL/TLS cipher mismatch
- Missing intermediate CA certificates

## Solutions

### Solution 1: Use Local Development (Current)

For local testing, workers and services communicate via Docker network:

```yaml
# docker-compose.yml
environment:
  - USE_TUNNEL=false  # Disable tunnel for local dev
```

**Pros:**
- ✅ Works immediately
- ✅ No external dependencies
- ✅ Faster (no tunnel overhead)

**Cons:**
- ❌ Coordinator on Render can't reach services
- ❌ Only works for local testing

### Solution 2: ngrok (Recommended Alternative)

ngrok is more reliable than Cloudflare quick tunnels:

1. **Install ngrok:**
```bash
# Download from https://ngrok.com/download
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

2. **Sign up** (free tier: 1 agent, 40 connections/min)

3. **Run tunnel:**
```bash
ngrok http 8103  # For upload-service
```

4. **Update worker to report ngrok URL:**
```python
# Worker reports: https://abc123.ngrok-free.app
```

### Solution 3: SSH Reverse Tunnel

Use SSH for NAT traversal:

1. **On remote server with public IP:**
```bash
# Accept reverse tunnel on port 8103
GatewayPorts yes  # in /etc/ssh/sshd_config
```

2. **From worker machine:**
```bash
ssh -R 8103:localhost:8103 user@your-server.com
```

3. **Worker reports:** `http://your-server.com:8103`

### Solution 4: Tailscale/ZeroTier (VPN)

Create a mesh VPN:

1. **Install Tailscale:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

2. **All machines join same network**

3. **Use Tailscale IPs** for service communication

### Solution 5: Local Coordinator (Simplest)

Run coordinator locally instead of on Render:

```bash
cd coordinator-service
docker compose up -d
```

**Access:** `http://localhost:8080`

Workers and coordinator on same network = no tunnels needed!

## Testing Tunnel Connectivity

```bash
# Test from container
docker exec cpu-worker-cpu-worker-1 curl -v https://api.trycloudflare.com

# Test from host
curl -v https://api.trycloudflare.com

# Check firewall
sudo iptables -L -n | grep 443
sudo ufw status

# Check network policy
ping api.trycloudflare.com
nslookup api.trycloudflare.com
```

## Current Architecture

### Local Development
```
Local Docker Network
├─ Coordinator (localhost:8080)
├─ Workers (report public IP)
└─ Services (Docker network names)
```

### Production with Render
```
Render Coordinator (cmacatalyst.onrender.com)
     ↓ (can't reach local services)
Local Workers (behind NAT)
     ↓ (need tunnel)
Services (upload, rag, notes...)
```

## Recommended Setup for Your Environment

Given the firewall/network restrictions:

### Option A: Local Everything
Run coordinator locally:
- No tunnels needed
- Fastest performance
- Easy debugging

### Option B: ngrok for Production
- Reliable tunnel service
- Free tier sufficient
- Works through most firewalls

### Option C: Split Architecture
- Coordinator on Render (lightweight)
- Services run directly on VPS with public IP
- No tunnels needed if services have public IPs

## Implementation: ngrok Integration

Update worker_agent.py:

```python
def start_ngrok_tunnel(self) -> Optional[str]:
    """Start ngrok tunnel as alternative to Cloudflare"""
    try:
        # Requires ngrok installed and auth token set
        self.tunnel_process = subprocess.Popen(
            ['ngrok', 'http', str(self.service_port), '--log', 'stdout'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for ngrok URL
        for _ in range(30):
            line = self.tunnel_process.stdout.readline()
            if 'url=' in line:
                url = line.split('url=')[1].strip()
                return url
            time.sleep(0.5)
    except Exception as e:
        print(f"ngrok tunnel failed: {e}")
    return None
```

## Next Steps

1. **For local testing:** Keep `USE_TUNNEL=false` (current setup)
2. **For production:** Choose ngrok, SSH tunnel, or VPN
3. **If network allows:** Debug Cloudflare API access with IT team

Your current setup works great for local development! 🎉
