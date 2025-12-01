#!/bin/bash

# Start ngrok tunnel for RMA services via nginx proxy
# This exposes all local services through a single ngrok tunnel

echo "🚇 Starting ngrok tunnel for RMA services..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   https://ngrok.com/download"
    exit 1
fi

# Start nginx proxy if not running
echo "📦 Starting nginx proxy..."
cd /home/user/CMACatalyst/RMA-Demo
docker-compose -f docker-compose.proxy.yml up -d

# Wait for proxy to be ready
sleep 2

# Check if proxy is running
if curl -sf http://localhost:9000/health > /dev/null 2>&1; then
    echo "   ✅ Nginx proxy is running on port 9000"
else
    echo "   ❌ Nginx proxy failed to start"
    exit 1
fi

echo ""
echo "📡 Checking if services are accessible through proxy..."

services=(
    "upload:8103"
    "rag:8102"
    "notes:8100"
    "ner:8108"
)

for service in "${services[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    if curl -sf http://localhost:9000/$name/health > /dev/null 2>&1; then
        echo "   ✅ $name-service (port $port) accessible at /http://localhost:9000/$name/"
    else
        echo "   ⚠️  $name-service (port $port) not accessible through proxy"
    fi
done

echo ""
echo "🌐 Your ngrok domain: https://cesar-uneuphemistic-unloyally.ngrok-free.dev"
echo ""
echo "Starting ngrok tunnel..."
echo "Services will be available at:"
echo "  - https://cesar-uneuphemistic-unloyally.ngrok-free.dev/upload/"
echo "  - https://cesar-uneuphemistic-unloyally.ngrok-free.dev/rag/"
echo "  - https://cesar-uneuphemistic-unloyally.ngrok-free.dev/notes/"
echo "  - https://cesar-uneuphemistic-unloyally.ngrok-free.dev/ner/"
echo ""

# Start ngrok pointing to the nginx proxy
ngrok http 9000 --domain=cesar-uneuphemistic-unloyally.ngrok-free.dev
