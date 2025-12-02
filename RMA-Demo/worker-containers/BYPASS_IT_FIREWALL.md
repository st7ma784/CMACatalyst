# Bypassing IT Firewall Blocks with Named Cloudflare Tunnels

## Problem
Your university IT blocks `api.trycloudflare.com`, preventing quick tunnels from working.

## Solution
Use **named Cloudflare tunnels** with your own domain - no API calls to trycloudflare.com needed!

---

## Quick Setup (5 minutes)

### 1. One-Time Cloudflare Setup

```bash
# Login to Cloudflare (opens browser)
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create rma-workers

# This creates: ~/.cloudflared/<tunnel-id>.json
# Note the tunnel ID shown!

# Route your domain to the tunnel (use wildcard for multiple workers)
cloudflared tunnel route dns rma-workers *.workers.cmacatalyst.com

# Done! DNS is now configured
```

### 2. Copy Credentials to Project

```bash
# Find your tunnel credentials file
ls ~/.cloudflared/*.json

# Copy to worker directory
cp ~/.cloudflared/<tunnel-id>.json /data/CMACatalyst/RMA-Demo/worker-containers/cpu-worker/tunnel-credentials.json

# IMPORTANT: Add to .gitignore!
echo "tunnel-credentials.json" >> .gitignore
```

### 3. Update Environment

Already done in `docker-compose.yml`! Just uncomment the named tunnel lines:

```yaml
environment:
  - TUNNEL_TYPE=named  # ← Enable this
  - TUNNEL_CREDENTIALS=/app/tunnel-credentials.json
  - WORKER_SUBDOMAIN=${HOSTNAME}
```

### 4. Start Workers

```bash
cd /data/CMACatalyst/RMA-Demo/worker-containers/cpu-worker
docker-compose up -d
```

### 5. Verify

```bash
# Check worker logs
docker logs rma-cpu-worker-1 | grep -i tunnel

# Should see:
# ✅ Named tunnel active: https://worker-xxx.workers.cmacatalyst.com
# 💡 No api.trycloudflare.com calls made - using your domain!

# Check coordinator
curl -s https://api.rmatool.org.uk/api/admin/workers | jq '.workers[].tunnel_url'
```

---

## Why This Works

| Method | API Call | Blocked? | Your Domain |
|--------|----------|----------|-------------|
| Quick Tunnel | `api.trycloudflare.com` | ❌ YES | ❌ No (random) |
| Named Tunnel | DNS only | ✅ NO | ✅ Yes |

**Named tunnels**:
- Connect directly to Cloudflare edge servers
- Use standard Cloudflare infrastructure (same as any CF-proxied site)
- No calls to api.trycloudflare.com
- IT can't block without blocking all of Cloudflare!

---

## Testing Named Tunnel Manually

```bash
# Test tunnel manually first
cloudflared tunnel --credentials-file tunnel-credentials.json \
  --url http://localhost:8103 \
  run rma-workers

# In another terminal
curl https://worker-test.workers.cmacatalyst.com/health
```

---

## Troubleshooting

### "Tunnel credentials not found"
```bash
# Check file exists
ls -la tunnel-credentials.json

# Check it's mounted in container
docker exec rma-cpu-worker-1 ls -la /app/tunnel-credentials.json
```

### "Invalid tunnel credentials"
```bash
# Verify JSON structure
cat tunnel-credentials.json | jq .TunnelID
# Should show a UUID
```

### "Connection registration timeout"
```bash
# Check Cloudflare dashboard for tunnel status
# https://dash.cloudflare.com/ → Zero Trust → Tunnels
```

### "DNS not resolving"
```bash
# Check DNS propagation
dig worker-1.workers.cmacatalyst.com
# Should show CNAME to <tunnel-id>.cfargotunnel.com
```

---

## Multiple Workers

Each worker gets its own subdomain automatically:

```bash
# Worker 1 → worker-rma-cpu-worker-1.workers.cmacatalyst.com
# Worker 2 → worker-rma-cpu-worker-2.workers.cmacatalyst.com
# etc.
```

Or set custom subdomains:
```yaml
environment:
  - WORKER_SUBDOMAIN=gpu-1  # → https://gpu-1.workers.cmacatalyst.com
```

---

## Security Notes

⚠️ **Tunnel credentials = Password!**

- Don't commit to git (.gitignore it!)
- Mount as read-only in containers
- Each tunnel can have multiple credentials (rotate if compromised)
- Regenerate with: `cloudflared tunnel token <tunnel-name>`

---

## Cost

**FREE!** ✅

- Cloudflare Tunnels: Free forever
- DNS: Included with Cloudflare free plan
- No bandwidth limits
- Unlimited tunnels

---

## Quick Reference

```bash
# List your tunnels
cloudflared tunnel list

# Delete a tunnel
cloudflared tunnel delete <tunnel-name>

# View tunnel info
cloudflared tunnel info <tunnel-name>

# Regenerate credentials
cloudflared tunnel token <tunnel-name>
```

---

## Success! 🎉

Your workers now bypass the IT firewall and connect through your own domain via Cloudflare's edge network!

Check the coordinator:
```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq
```

You should see `tunnel_url` fields populated with your domain!
