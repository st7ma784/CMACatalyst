# Railway Deployment for RMA Coordinator

This coordinator service is configured to deploy on Railway's free tier.

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/deploy)

## Manual Deployment

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Initialize Project:**
   ```bash
   cd coordinator-service
   railway init
   ```

4. **Set Environment Variables:**
   ```bash
   railway variables set JWT_SECRET=your-secret-key-here
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get Your URL:**
   ```bash
   railway domain
   ```

## Environment Variables

The following environment variables should be configured in Railway:

- `JWT_SECRET` - Secret key for JWT token signing (required)
- `PORT` - Automatically set by Railway (default: 8080)

## Free Tier Limits

Railway's free tier includes:
- $5 USD credit per month
- 512MB RAM
- 1GB storage
- Always-on service
- Custom domain support

## Architecture

```
Internet → Railway (Coordinator) → Workers (via Cloudflare Tunnels)
                ↓
           Frontend API calls
```

The coordinator is stateless and lightweight, perfect for Railway's free tier.

## Alternative: Render.com

If Railway runs out, you can also deploy to Render:

1. Create `render.yaml` (see render.yaml in this directory)
2. Connect your GitHub repo to Render
3. Deploy automatically on push

## Alternative: Vercel (Serverless)

For Vercel deployment, the coordinator needs to be adapted to serverless functions. This would require:
- Converting FastAPI routes to Vercel serverless functions
- Using external state store (Redis/Upstash) for worker registry
- Cold start considerations

Current architecture is better suited for Railway/Render which support long-running processes.
