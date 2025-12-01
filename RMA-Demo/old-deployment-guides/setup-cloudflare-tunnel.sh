#!/bin/bash

# Setup Cloudflare Tunnel for RMA Demo
# This script configures a named Cloudflare Tunnel for your workers

set -e

echo "🌐 Cloudflare Tunnel Setup for rmatool.org.uk"
echo "=============================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing cloudflared..."
    
    # Detect OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
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

# Authenticate with Cloudflare
echo "🔐 Step 1: Authenticate with Cloudflare"
echo "   This will open your browser to login..."
echo ""
cloudflared tunnel login

echo ""
echo "✅ Authentication successful!"
echo ""

# Create tunnel
TUNNEL_NAME="rma-workers"
echo "🚇 Step 2: Creating tunnel '$TUNNEL_NAME'..."
echo ""

cloudflared tunnel create $TUNNEL_NAME

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ Failed to create tunnel"
    exit 1
fi

echo "✅ Tunnel created: $TUNNEL_ID"
echo ""

# Update config file with tunnel ID
echo "📝 Step 3: Updating config file..."
sed -i.bak "s/PUT_YOUR_TUNNEL_ID_HERE/$TUNNEL_ID/" cloudflare-tunnel-config.yml

echo "✅ Configuration updated"
echo ""

# Get credentials file location
CREDS_FILE="$HOME/.cloudflared/$TUNNEL_ID.json"

echo "📋 Tunnel Information:"
echo "   Tunnel Name: $TUNNEL_NAME"
echo "   Tunnel ID: $TUNNEL_ID"
echo "   Credentials: $CREDS_FILE"
echo ""

echo "🎯 Next Steps:"
echo ""
echo "1. Copy credentials to Docker volume:"
echo "   mkdir -p $(pwd)/cloudflared"
echo "   cp $CREDS_FILE $(pwd)/cloudflared/credentials.json"
echo ""
echo "2. Configure DNS routes (run this command):"
echo "   cloudflared tunnel route dns $TUNNEL_NAME worker1.rmatool.org.uk"
echo "   cloudflared tunnel route dns $TUNNEL_NAME worker2.rmatool.org.uk"
echo "   cloudflared tunnel route dns $TUNNEL_NAME worker3.rmatool.org.uk"
echo "   cloudflared tunnel route dns $TUNNEL_NAME worker4.rmatool.org.uk"
echo ""
echo "3. Start the tunnel:"
echo "   cloudflared tunnel --config cloudflare-tunnel-config.yml run $TUNNEL_NAME"
echo ""
echo "✅ Setup complete! Check the dashboard guide for next steps."
