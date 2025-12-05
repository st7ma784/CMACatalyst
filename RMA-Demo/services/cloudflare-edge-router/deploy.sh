#!/bin/bash
# Manual deployment script for edge router

echo "🚀 Deploying RMA Edge Router to Cloudflare Workers..."
echo ""

# Check if wrangler is configured
if ! npx wrangler whoami &>/dev/null; then
    echo "❌ Not logged in to Cloudflare"
    echo "Run: npx wrangler login"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Deploy
echo "📡 Deploying to Cloudflare Workers..."
npx wrangler deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Edge Router is now live at: https://api.rmatool.org.uk"
    echo ""
    echo "Updated endpoints:"
    echo "  ✓ /api/admin/workers - Proxied to coordinator"
    echo "  ✓ /api/admin/stats - Proxied to coordinator"
    echo "  ✓ /api/dht/bootstrap - DHT seed nodes"
    echo "  ✓ /api/edge/register - Coordinator registration"
    echo "  ✓ /health - Health check"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi
