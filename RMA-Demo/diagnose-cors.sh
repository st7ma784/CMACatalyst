#!/bin/bash
# Diagnostic script for CORS issues

echo "=========================================="
echo "RMA-Demo CORS Diagnostic Tool"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "1. Checking if Docker containers are running..."
echo "-------------------------------------------"
docker ps --filter "name=rma-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "2. Testing local connectivity to services..."
echo "-------------------------------------------"
for port in 8102 8103 8104; do
    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Port $port: Service responding"
    else
        echo -e "${RED}✗${NC} Port $port: Service NOT responding"
    fi
done
echo ""

echo "3. Testing external IP connectivity to services..."
echo "-------------------------------------------"
EXTERNAL_IP="192.168.5.70"
for port in 8102 8103 8104; do
    if curl -s -f "http://$EXTERNAL_IP:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $EXTERNAL_IP:$port: Service responding"
    else
        echo -e "${RED}✗${NC} $EXTERNAL_IP:$port: Service NOT responding"
    fi
done
echo ""

echo "4. Testing CORS preflight (OPTIONS) requests..."
echo "-------------------------------------------"
for port in 8102 8103 8104; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
        -H "Origin: http://192.168.5.70:3000" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        "http://$EXTERNAL_IP:$port/health" 2>&1)

    if [ "$response" = "200" ] || [ "$response" = "204" ]; then
        echo -e "${GREEN}✓${NC} Port $port: CORS preflight OK (status $response)"
    else
        echo -e "${RED}✗${NC} Port $port: CORS preflight FAILED (status $response)"
    fi
done
echo ""

echo "5. Checking firewall rules..."
echo "-------------------------------------------"
if command -v ufw &> /dev/null; then
    echo "UFW Status:"
    sudo ufw status numbered | grep -E "8102|8103|8104|3000"
elif command -v firewall-cmd &> /dev/null; then
    echo "Firewalld Status:"
    sudo firewall-cmd --list-ports | grep -E "8102|8103|8104|3000"
else
    echo -e "${YELLOW}!${NC} No firewall manager detected (ufw/firewalld)"
fi
echo ""

echo "6. Checking listening ports..."
echo "-------------------------------------------"
echo "Services listening on all interfaces (0.0.0.0):"
ss -tlnp | grep -E ":8102|:8103|:8104" | grep "0.0.0.0" || echo "No services found listening on 0.0.0.0"
echo ""
echo "Services listening on localhost only (127.0.0.1):"
ss -tlnp | grep -E ":8102|:8103|:8104" | grep "127.0.0.1" || echo "No services found listening on 127.0.0.1"
echo ""

echo "7. Testing actual CORS headers..."
echo "-------------------------------------------"
for port in 8102 8103; do
    echo "Port $port:"
    curl -s -I -X POST \
        -H "Origin: http://192.168.5.70:3000" \
        -H "Content-Type: application/json" \
        "http://$EXTERNAL_IP:$port/health" 2>&1 | grep -i "access-control" || echo "No CORS headers found"
    echo ""
done

echo "=========================================="
echo "Diagnostic complete!"
echo "=========================================="
