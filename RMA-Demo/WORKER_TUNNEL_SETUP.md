# Worker Auto-Tunnel Setup

Workers can automatically create their own Cloudflare Tunnels without baking credentials into containers.

## Quick Start

### Option 1: With Cloudflare Credentials (Recommended)

Each worker creates its own managed tunnel with a stable URL:

```bash
docker run -d \
  --name rma-worker \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e CLOUDFLARE_API_TOKEN=<your_token> \
  -e CLOUDFLARE_ACCOUNT_ID=<your_account_id> \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Option 2: Quick Tunnels (Anonymous)

No credentials needed, but rate-limited and no uptime guarantee:

```bash
docker run -d \
  --name rma-worker \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e USE_TUNNEL=true \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Option 3: Pre-configured Named Tunnel

If you already have a tunnel running elsewhere:

```bash
docker run -d \
  --name rma-worker \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e TUNNEL_URL=https://my-worker.example.com \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Option 4: No Tunnel (Same Network)

If worker and coordinator are on the same network:

```bash
docker run -d \
  --name rma-worker \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e USE_TUNNEL=false \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

## Getting Cloudflare Credentials

### 1. Get API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Create Additional Tunnels" template OR create custom with:
   - **Account** → **Cloudflare Tunnel** → **Edit**
4. Click "Continue to summary" → "Create Token"
5. Copy the token (only shown once!)

Example: `abc123def456ghi789...`

### 2. Get Account ID

1. Go to https://dash.cloudflare.com/
2. Click on any website/domain
3. Scroll down on overview page - Account ID is shown on the right
4. Or look in the URL: `dash.cloudflare.com/<account-id>/...`

Example: `a1b2c3d4e5f6g7h8i9j0`

## How It Works

When a worker starts:

1. **Check for pre-configured tunnel URL** (`TUNNEL_URL` env var)
   - If set, use it directly ✅

2. **Check for Cloudflare credentials** (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`)
   - If set, create managed tunnel named `worker-{hostname}`
   - Tunnel gets permanent URL: `https://{tunnel-id}.cfargotunnel.com`
   - Tunnel persists across restarts ✅

3. **Fallback to quick tunnel** (if no credentials)
   - Anonymous tunnel, rate-limited
   - May fail in some networks
   - URL changes on restart ⚠️

4. **No tunnel** (if `USE_TUNNEL=false`)
   - Worker registers with `http://{hostname}:8000`
   - Only works if coordinator can reach that address ⚠️

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COORDINATOR_URL` | Yes | - | Edge router URL: `https://api.rmatool.org.uk` |
| `USE_TUNNEL` | No | `true` | Enable tunnel creation |
| `TUNNEL_URL` | No | - | Pre-configured tunnel URL (skips auto-creation) |
| `CLOUDFLARE_API_TOKEN` | No | - | API token for managed tunnels |
| `CLOUDFLARE_ACCOUNT_ID` | No | - | Cloudflare account ID |
| `WORKER_TYPE` | No | `auto` | `auto`, `gpu`, `cpu`, `storage`, or `edge` |
| `WORKER_ID` | No | auto | Custom worker identifier |

## Production Deployment

For production workers, use managed tunnels with credentials:

```bash
# Store credentials securely
export CF_TOKEN="your_api_token"
export CF_ACCOUNT="your_account_id"

# Deploy worker
docker run -d \
  --name rma-gpu-worker \
  --runtime nvidia \
  --gpus all \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e CLOUDFLARE_API_TOKEN="$CF_TOKEN" \
  -e CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT" \
  -e WORKER_TYPE=gpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Benefits of Managed Tunnels

- ✅ **Stable URLs**: Same URL across restarts
- ✅ **No rate limits**: Unlike quick tunnels
- ✅ **Better performance**: Cloudflare edge optimization
- ✅ **Monitoring**: View in Cloudflare dashboard
- ✅ **Security**: Token only has tunnel permissions

### Credentials Security

**DO NOT** bake credentials into Docker images. Use:

- Environment variables (as shown above)
- Docker secrets
- Kubernetes secrets
- AWS Secrets Manager / similar

```bash
# Example with docker-compose
docker-compose.yml:
  worker:
    image: ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - CLOUDFLARE_API_TOKEN=${CF_TOKEN}
      - CLOUDFLARE_ACCOUNT_ID=${CF_ACCOUNT}
```

```bash
# Set in .env file (don't commit!)
CF_TOKEN=your_token
CF_ACCOUNT=your_account_id
```

## Troubleshooting

### Quick tunnel fails with EOF error

This usually means:
- Network blocks outbound HTTPS to `api.trycloudflare.com`
- Cloudflare is rate-limiting your IP
- Temporary Cloudflare service issue

**Solution**: Use managed tunnels with API token (Option 1)

### "cloudflared not found"

Worker container should have cloudflared pre-installed. If not:

```bash
docker exec -it rma-worker bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb
```

### Tunnel URL is "api.trycloudflare.com"

This is a parsing bug in older versions. Update to latest:

```bash
docker pull ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Worker registers but services unreachable

Check tunnel is actually working:

```bash
# Get worker's tunnel URL
curl https://edge-1.rmatool.org.uk/api/coordinator/workers | jq '.workers[].tunnel_url'

# Try accessing it directly
curl <tunnel_url>/health
```

## Multiple Workers

Each worker automatically gets its own unique tunnel:

```bash
# Worker 1 (City A)
docker run -d --name worker-cityA -e CLOUDFLARE_API_TOKEN=... ...
# Creates tunnel: worker-cityA-hostname

# Worker 2 (City B)  
docker run -d --name worker-cityB -e CLOUDFLARE_API_TOKEN=... ...
# Creates tunnel: worker-cityB-hostname

# Both use the SAME token and account ID!
```

All workers can share the same API token - each creates its own tunnel automatically.
