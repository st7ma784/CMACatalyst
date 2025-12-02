#!/bin/bash
# Test Service Discovery & Graceful Fallback

COORDINATOR_URL="https://api.rmatool.org.uk"

echo "======================================================================"
echo "RMA Service Discovery Test"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}1. Checking coordinator health...${NC}"
response=$(curl -s "$COORDINATOR_URL/health")
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Coordinator is healthy${NC}"
else
    echo -e "${RED}❌ Coordinator unavailable${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}2. Listing registered workers...${NC}"
workers=$(curl -s "$COORDINATOR_URL/api/admin/workers" | jq -r '. | length')
echo -e "   Workers registered: ${GREEN}$workers${NC}"
echo ""

echo -e "${BLUE}3. Listing available services...${NC}"
services_response=$(curl -s "$COORDINATOR_URL/api/admin/services")
echo "$services_response" | jq '.'
echo ""

service_count=$(echo "$services_response" | jq -r '.total_services')
if [ "$service_count" -gt 0 ]; then
    echo -e "${GREEN}✅ Services discovered: $service_count${NC}"
    
    # List each service with health
    echo ""
    echo "Service Status:"
    echo "$services_response" | jq -r '.services | to_entries[] | "  - \(.key): \(.value.healthy_workers)/\(.value.total_workers) workers (\(.value.status))"'
else
    echo -e "${YELLOW}⚠️  No services registered yet${NC}"
    echo "   Start workers with: docker-compose up -d"
fi
echo ""

echo -e "${BLUE}4. Testing graceful fallback (unavailable service)...${NC}"
fallback_response=$(curl -s "$COORDINATOR_URL/api/service/nonexistent/test")
echo "$fallback_response" | jq '.'
echo ""

if echo "$fallback_response" | grep -q "available_services"; then
    echo -e "${GREEN}✅ Graceful fallback working${NC}"
    echo "   Coordinator suggests available services when requested service is unavailable"
else
    echo -e "${YELLOW}⚠️  Fallback response unclear${NC}"
fi
echo ""

echo -e "${BLUE}5. Testing service routing (if services available)...${NC}"
if [ "$service_count" -gt 0 ]; then
    # Get first available service
    first_service=$(echo "$services_response" | jq -r '.services | to_entries[] | select(.value.healthy_workers > 0) | .key' | head -1)
    
    if [ -n "$first_service" ]; then
        echo "   Testing service: $first_service"
        service_test=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$COORDINATOR_URL/api/service/$first_service/health")
        http_code=$(echo "$service_test" | grep "HTTP_CODE" | cut -d: -f2)
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✅ Service routing successful${NC}"
            echo "$service_test" | grep -v "HTTP_CODE" | jq '.' 2>/dev/null || echo "$service_test" | grep -v "HTTP_CODE"
        else
            echo -e "${YELLOW}⚠️  Service returned HTTP $http_code${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  No healthy services to test${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No services to test${NC}"
fi
echo ""

echo "======================================================================"
echo "Service Discovery Test Complete"
echo "======================================================================"
echo ""
echo "Next steps:"
echo "  1. Deploy workers: cd worker-containers && docker-compose up -d"
echo "  2. Check services: curl $COORDINATOR_URL/api/admin/services | jq"
echo "  3. Test routing: curl $COORDINATOR_URL/api/service/upload/health"
echo ""
