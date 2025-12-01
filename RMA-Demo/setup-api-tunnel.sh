#!/bin/bash

# Simple setup for Cloudflare Tunnel to expose coordinator API
# This creates a tunnel for api.rmatool.org.uk → localhost:8080

set -e

echo "🌐 Setting up Cloudflare Tunnel for Coordinator API"
echo "===================================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing cloudflared..."

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflare/cloudflare/cloudflared
    else
        echo "❌ Unsupported OS. Please install cloudflared manually:"
        echo "   https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        exit 1
    fi
fi

echo "✅ cloudflared installed: $(cloudflared --version)"
echo ""

# Authenticate
echo "🔐 Authenticating with Cloudflare (browser will open)..."
cloudflared tunnel login

# Create tunnel
TUNNEL_NAME="rma-api"
echo ""
echo "🚇 Creating tunnel: $TUNNEL_NAME"
cloudflared tunnel create $TUNNEL_NAME 2>/dev/null || echo "⚠️  Tunnel already exists, using existing tunnel"

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ Failed to get tunnel ID. Please check cloudflared tunnel list"
    exit 1
fi

echo "✅ Tunnel ID: $TUNNEL_ID"

# Route DNS
echo ""
echo "🌐 Setting up DNS route for api.rmatool.org.uk..."
cloudflared tunnel route dns $TUNNEL_NAME api.rmatool.org.uk 2>/dev/null || echo "⚠️  DNS route already exists"

# Create config
CONFIG_FILE="tunnel-api.yml"
CREDS_FILE="$HOME/.cloudflared/$TUNNEL_ID.json"

cat > $CONFIG_FILE << EOF
tunnel: $TUNNEL_ID
credentials-file: $CREDS_FILE

ingress:
  - hostname: api.rmatool.org.uk
    service: http://localhost:8080
  - service: http_status:404
EOF

echo "✅ Configuration saved to $CONFIG_FILE"
echo ""
echo "🎯 Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the coordinator:"
echo "   cd coordinator-service"
echo "   uvicorn app.main:app --host 127.0.0.1 --port 8080"
echo ""
echo "2. In another terminal, start the tunnel:"
echo "   cloudflared tunnel --config tunnel-api.yml run $TUNNEL_NAME"
echo ""
echo "3. Or use the combined start script:"
echo "   ./start-coordinator.sh"
echo ""
echo "4. Test the deployment:"
echo "   curl https://api.rmatool.org.uk/health"
echo ""
