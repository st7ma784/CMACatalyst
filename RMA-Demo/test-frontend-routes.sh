#!/bin/bash
# Frontend Route Audit Script
# Tests all frontend API calls to ensure they route correctly to workers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API endpoints
EDGE_API="https://api.rmatool.org.uk"
COORDINATOR_URL="https://edge-1.rmatool.org.uk"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Frontend Route Audit${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    echo -ne "${YELLOW}Testing:${NC} $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ OK${NC} ($http_code)"
        return 0
    elif [ "$http_code" = "503" ]; then
        echo -e "${YELLOW}⚠ Service Unavailable${NC} ($http_code)"
        echo "$body" | jq -r '.message // .error' 2>/dev/null || echo "$body"
        return 1
    else
        echo -e "${RED}✗ FAIL${NC} ($http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

echo -e "${BLUE}=== Infrastructure Health ===${NC}"
test_endpoint "Edge Router Health" "$EDGE_API/health"
test_endpoint "Coordinator Health" "$COORDINATOR_URL/health"
echo ""

echo -e "${BLUE}=== Coordinator Registry ===${NC}"
test_endpoint "List Coordinators" "$EDGE_API/api/admin/coordinators"
test_endpoint "List Workers" "$COORDINATOR_URL/api/coordinator/workers"
test_endpoint "Admin Workers" "$COORDINATOR_URL/api/admin/workers"
test_endpoint "Service Registry" "$COORDINATOR_URL/api/admin/services"
test_endpoint "Service Gaps" "$COORDINATOR_URL/api/admin/gaps"
echo ""

echo -e "${BLUE}=== DHT Status ===${NC}"
test_endpoint "DHT Stats" "$COORDINATOR_URL/api/dht/stats"
test_endpoint "DHT Topology" "$COORDINATOR_URL/api/dht/topology"
test_endpoint "DHT Bootstrap" "$EDGE_API/api/dht/bootstrap"
echo ""

echo -e "${BLUE}=== Service Routing (Frontend URLs) ===${NC}"

# RAG Service (NEXT_PUBLIC_RAG_SERVICE_URL)
test_endpoint "RAG: Stats" "$EDGE_API/service/rag/stats"
test_endpoint "RAG: Debug Sources" "$EDGE_API/service/rag/debug/sources"
test_endpoint "RAG: Graph Health" "$EDGE_API/service/rag/api/health"

# Upload Service (NEXT_PUBLIC_UPLOAD_SERVICE_URL)
test_endpoint "Upload: Health" "$EDGE_API/service/upload/health"
test_endpoint "Upload: List Clients" "$EDGE_API/service/upload/clients"

# Notes Service (NEXT_PUBLIC_NOTES_SERVICE_URL)
test_endpoint "Notes: Health" "$EDGE_API/service/notes/health"
# test_endpoint "Notes: Convert" "$EDGE_API/service/notes/convert" "POST" '{"client_name":"Test","notes":"Test notes"}'

# NER Service (NEXT_PUBLIC_NER_SERVICE_URL)
test_endpoint "NER: Health" "$EDGE_API/service/ner/health"

echo ""
echo -e "${BLUE}=== Service Discovery ===${NC}"

# Check if workers are registered with services
echo -ne "${YELLOW}Checking service assignments...${NC} "
workers_json=$(curl -s "$COORDINATOR_URL/api/coordinator/workers")
worker_count=$(echo "$workers_json" | jq -r '.count // 0')

if [ "$worker_count" -eq 0 ]; then
    echo -e "${RED}✗ No workers registered${NC}"
    echo ""
    echo -e "${YELLOW}To register a worker, run:${NC}"
    echo "  docker run -d \\"
    echo "    -e COORDINATOR_URL=https://api.rmatool.org.uk \\"
    echo "    -e CLOUDFLARE_API_TOKEN=\"your_token\" \\"
    echo "    -e CLOUDFLARE_ACCOUNT_ID=\"your_account\" \\"
    echo "    ghcr.io/st7ma784/cmacatalyst/universal-worker:latest"
else
    echo -e "${GREEN}✓ $worker_count worker(s) found${NC}"
    echo ""
    echo "$workers_json" | jq -r '.workers[] | "\(.worker_id): \(.assigned_services // [] | join(", "))"'
fi

echo ""
echo -e "${BLUE}=== Service Availability Summary ===${NC}"

services=("rag-embeddings" "document-processing" "notes-coa" "ner-extraction" "vision-ocr" "llm-inference")
for service in "${services[@]}"; do
    echo -ne "  ${service}: "
    available=$(echo "$workers_json" | jq -r --arg svc "$service" '[.workers[] | select(.assigned_services != null and (.assigned_services | contains([$svc])))] | length')
    if [ "$available" -gt 0 ]; then
        echo -e "${GREEN}✓ $available worker(s)${NC}"
    else
        echo -e "${RED}✗ None${NC}"
    fi
done

echo ""
echo -e "${BLUE}=== Load Balancing Test ===${NC}"
echo "Testing service proxy route selection..."

for i in {1..5}; do
    echo -ne "  Request $i: "
    response=$(curl -s "$EDGE_API/service/rag/stats" -w "%{http_code}")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC}"
    elif [ "$http_code" = "503" ]; then
        echo -e "${YELLOW}⚠ Service unavailable${NC}"
    else
        echo -e "${RED}✗ Error $http_code${NC}"
    fi
done

echo ""
echo -e "${BLUE}=== Frontend Integration Summary ===${NC}"
echo ""
echo "Frontend service URLs (from .env.production):"
echo "  - RAG:    $EDGE_API/service/rag"
echo "  - Upload: $EDGE_API/service/upload"
echo "  - Notes:  $EDGE_API/service/notes"
echo "  - NER:    $EDGE_API/service/ner"
echo ""

if [ "$worker_count" -eq 0 ]; then
    echo -e "${RED}⚠ WARNING: No workers registered!${NC}"
    echo "Frontend will receive 503 errors for all service requests."
    echo ""
    echo "Next steps:"
    echo "  1. Deploy a worker with: docker run ... (see above)"
    echo "  2. Worker will auto-register and receive service assignments"
    echo "  3. Re-run this test to verify routing"
else
    echo -e "${GREEN}✓ Workers registered and ready${NC}"
    echo ""
    echo "Request flow:"
    echo "  Frontend → Edge Router → Coordinator → Worker"
    echo "  rmatool.org.uk → api.rmatool.org.uk → edge-1.rmatool.org.uk → worker"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
