#!/bin/bash
# Register coordinator with edge router after tunnel is established

set -e

echo "🔗 Waiting for Cloudflare tunnel to establish..."

# Wait for tunnel container to start
sleep 5

# Extract tunnel URL from cloudflared logs
TUNNEL_URL=""
for i in {1..30}; do
    TUNNEL_URL=$(docker logs edge-tunnel 2>&1 | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)

    if [ -n "$TUNNEL_URL" ]; then
        echo "✅ Tunnel established: $TUNNEL_URL"
        break
    fi

    echo "⏳ Waiting for tunnel... (attempt $i/30)"
    sleep 2
done

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Failed to get tunnel URL after 60 seconds"
    echo "Tunnel logs:"
    docker logs edge-tunnel 2>&1 | tail -20
    exit 1
fi

# Register coordinator with edge router
echo "📝 Registering coordinator with edge router..."

COORDINATOR_ID="edge-coordinator-$(hostname)"

response=$(curl -s -w "\n%{http_code}" -X POST https://api.rmatool.org.uk/api/edge/register \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"$COORDINATOR_ID\",
    \"tunnel_url\": \"$TUNNEL_URL\",
    \"dht_port\": 8468,
    \"capabilities\": {
      \"location\": \"local\",
      \"dht_port\": 8468
    }
  }")

http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅ Coordinator registered successfully!"
    echo "Response: $body"
else
    echo "❌ Registration failed with status $http_code"
    echo "Response: $body"
    exit 1
fi

# Verify registration
echo ""
echo "🔍 Verifying registration..."
registered=$(curl -s https://api.rmatool.org.uk/api/admin/coordinators | jq -r ".[] | select(.tunnel_url==\"$TUNNEL_URL\") | .worker_id")

if [ -n "$registered" ]; then
    echo "✅ Coordinator verified: $registered"
    echo "   Tunnel URL: $TUNNEL_URL"
else
    echo "⚠️  Coordinator not found in registry (may take a moment)"
fi

echo ""
echo "================================================"
echo "✅ Setup complete!"
echo ""
echo "Tunnel URL: $TUNNEL_URL"
echo "Edge Router: https://api.rmatool.org.uk"
echo ""
echo "Test with:"
echo "  ./diagnose-routing.sh"
echo "================================================"
