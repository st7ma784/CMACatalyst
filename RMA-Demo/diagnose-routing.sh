#!/bin/bash
# Routing Diagnostic Script
# Tests the complete routing chain from frontend → edge router → coordinator → worker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API URLs
EDGE_ROUTER_URL="${EDGE_ROUTER_URL:-https://api.rmatool.org.uk}"
TEST_SERVICE="${TEST_SERVICE:-notes}"
TEST_ENDPOINT="${TEST_ENDPOINT:-convert}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   RMA Tool Routing Diagnostic${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "Testing routing chain for: ${YELLOW}${TEST_SERVICE}/${TEST_ENDPOINT}${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
    local url="$1"
    local description="$2"
    local method="${3:-GET}"
    local data="$4"

    echo -e "${BLUE}Testing:${NC} $description"
    echo -e "  URL: $url"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>&1)
    fi

    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "  Status: ${GREEN}✅ $http_code OK${NC}"
        echo -e "  Response: ${body:0:100}..."
        return 0
    else
        echo -e "  Status: ${RED}❌ $http_code FAILED${NC}"
        echo -e "  Response: $body"
        return 1
    fi
    echo ""
}

# Track failures
failures=0

echo -e "${YELLOW}Step 1: Testing Edge Router${NC}"
echo -e "────────────────────────────────────────────────"
if test_endpoint "$EDGE_ROUTER_URL/health" "Edge Router Health Check"; then
    echo -e "${GREEN}✅ Edge router is accessible${NC}"
else
    echo -e "${RED}❌ Edge router is NOT accessible${NC}"
    echo -e "${RED}   This is a CRITICAL failure - nothing will work${NC}"
    echo -e "${YELLOW}   Fix: Ensure Cloudflare Worker is deployed at api.rmatool.org.uk${NC}"
    ((failures++))
fi
echo ""

echo -e "${YELLOW}Step 2: Checking Registered Coordinators${NC}"
echo -e "────────────────────────────────────────────────"
if test_endpoint "$EDGE_ROUTER_URL/api/admin/coordinators" "Registered Coordinators"; then
    coordinators_response=$(curl -s "$EDGE_ROUTER_URL/api/admin/coordinators")
    coordinator_count=$(echo "$coordinators_response" | jq '. | length' 2>/dev/null || echo "0")

    if [ "$coordinator_count" -gt 0 ]; then
        echo -e "${GREEN}✅ Found $coordinator_count coordinator(s)${NC}"
        echo -e "  Coordinators:"
        echo "$coordinators_response" | jq -r '.[] | "    - \(.worker_id): \(.tunnel_url)"' 2>/dev/null || echo "    (Unable to parse)"

        # Extract first coordinator URL for testing
        COORDINATOR_URL=$(echo "$coordinators_response" | jq -r '.[0].tunnel_url' 2>/dev/null)
        echo -e "  Using coordinator: ${YELLOW}$COORDINATOR_URL${NC}"
    else
        echo -e "${RED}❌ No coordinators registered${NC}"
        echo -e "${YELLOW}   Fix: Start edge coordinator with:${NC}"
        echo -e "   ${BLUE}cd RMA-Demo && docker-compose -f edge-coordinator.yml up -d${NC}"
        ((failures++))
        COORDINATOR_URL=""
    fi
else
    echo -e "${RED}❌ Cannot query coordinators${NC}"
    ((failures++))
    COORDINATOR_URL=""
fi
echo ""

if [ -n "$COORDINATOR_URL" ]; then
    echo -e "${YELLOW}Step 3: Testing Coordinator Directly${NC}"
    echo -e "────────────────────────────────────────────────"
    if test_endpoint "$COORDINATOR_URL/health" "Coordinator Health Check"; then
        echo -e "${GREEN}✅ Coordinator is accessible${NC}"
    else
        echo -e "${RED}❌ Coordinator is NOT accessible${NC}"
        echo -e "${YELLOW}   Fix: Check coordinator tunnel and network connectivity${NC}"
        ((failures++))
    fi
    echo ""

    echo -e "${YELLOW}Step 4: Checking Registered Workers${NC}"
    echo -e "────────────────────────────────────────────────"
    if test_endpoint "$COORDINATOR_URL/api/admin/workers" "Registered Workers"; then
        workers_response=$(curl -s "$COORDINATOR_URL/api/admin/workers")

        # Debug: Show raw response if parsing fails
        if ! echo "$workers_response" | jq empty 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Response is not valid JSON. Raw response:${NC}"
            echo "$workers_response"
            ((failures++))
        else
            worker_count=$(echo "$workers_response" | jq '. | length' 2>/dev/null || echo "0")

            if [ "$worker_count" -gt 0 ]; then
                echo -e "${GREEN}✅ Found $worker_count worker(s)${NC}"
                echo -e "  Workers and their services:"

                # More robust parsing with error handling
                if command -v jq >/dev/null 2>&1; then
                    echo "$workers_response" | jq -r '.[] | "    - \(.worker_id) [\(.status // "unknown")]:\n        Services: \(if .assigned_containers then (.assigned_containers | join(", ")) else "none" end)"' 2>/dev/null || {
                        echo -e "${YELLOW}    (jq parsing failed, showing raw data)${NC}"
                        echo "$workers_response" | head -20
                    }
                else
                    echo -e "${YELLOW}    (jq not installed, showing raw JSON)${NC}"
                    echo "$workers_response" | head -20
                fi
            else
                echo -e "${RED}❌ No workers registered${NC}"
                echo -e "${YELLOW}   Fix: Start a worker with:${NC}"
                echo -e "   ${BLUE}docker run -e COORDINATOR_URL=$COORDINATOR_URL universal-worker:latest${NC}"
                ((failures++))
            fi
        fi
    else
        echo -e "${RED}❌ Cannot query workers${NC}"
        ((failures++))
    fi
    echo ""

    echo -e "${YELLOW}Step 5: Checking Service Availability${NC}"
    echo -e "────────────────────────────────────────────────"
    service_internal="${TEST_SERVICE}-coa"
    if [ "$TEST_SERVICE" = "rag" ]; then
        service_internal="rag-embeddings"
    elif [ "$TEST_SERVICE" = "upload" ]; then
        service_internal="document-processing"
    elif [ "$TEST_SERVICE" = "ner" ]; then
        service_internal="ner-extraction"
    elif [ "$TEST_SERVICE" = "ocr" ]; then
        service_internal="vision-ocr"
    elif [ "$TEST_SERVICE" = "llm" ]; then
        service_internal="llm-inference"
    fi

    workers_with_service=$(curl -s "$COORDINATOR_URL/api/admin/workers" | jq -r ".[] | select(.assigned_containers[]? | contains(\"$service_internal\")) | .worker_id" 2>/dev/null)

    if [ -n "$workers_with_service" ]; then
        echo -e "${GREEN}✅ Service '$service_internal' is available${NC}"
        echo -e "  Workers with this service:"
        echo "$workers_with_service" | while read -r worker_id; do
            echo -e "    - $worker_id"
        done
    else
        echo -e "${RED}❌ No workers have service '$service_internal'${NC}"
        echo -e "${YELLOW}   Fix: Ensure coordinator assigns this service to workers${NC}"
        echo -e "   Check coordinator logs: ${BLUE}docker logs edge-coordinator${NC}"
        ((failures++))
    fi
    echo ""
fi

echo -e "${YELLOW}Step 6: Testing Service Endpoint (Full Stack)${NC}"
echo -e "────────────────────────────────────────────────"
test_data='{"notes":"Test notes for diagnostic","client_name":"Test Client"}'
if [ "$TEST_SERVICE" = "notes" ] && [ "$TEST_ENDPOINT" = "convert" ]; then
    test_url="$EDGE_ROUTER_URL/service/$TEST_SERVICE/$TEST_ENDPOINT"
    if test_endpoint "$test_url" "Service Endpoint (via Edge Router)" "POST" "$test_data"; then
        echo -e "${GREEN}✅ Full routing chain works!${NC}"
    else
        echo -e "${RED}❌ Service endpoint failed${NC}"
        ((failures++))

        # Try directly via coordinator if available
        if [ -n "$COORDINATOR_URL" ]; then
            echo ""
            echo -e "${BLUE}  Retrying via coordinator directly...${NC}"
            coordinator_test_url="$COORDINATOR_URL/service/$TEST_SERVICE/$TEST_ENDPOINT"
            if test_endpoint "$coordinator_test_url" "Service Endpoint (via Coordinator)" "POST" "$test_data"; then
                echo -e "${YELLOW}⚠️  Service works via coordinator but not via edge router${NC}"
                echo -e "${YELLOW}   Issue: Edge router → coordinator routing is broken${NC}"
            else
                echo -e "${RED}❌ Service also fails via coordinator${NC}"
                echo -e "${YELLOW}   Issue: Coordinator → worker routing is broken${NC}"
            fi
        fi
    fi
else
    echo -e "${BLUE}ℹ️  Skipping service endpoint test (only works for notes/convert)${NC}"
    echo -e "   To test other services, set: TEST_SERVICE and TEST_ENDPOINT"
fi
echo ""

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Diagnostic Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

if [ $failures -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Routing is working correctly.${NC}"
    echo ""
    echo -e "${GREEN}Your full stack is operational:${NC}"
    echo -e "  Frontend → Edge Router → Coordinator → Worker"
else
    echo -e "${RED}❌ Found $failures issue(s) in the routing chain${NC}"
    echo ""
    echo -e "${YELLOW}Routing Chain Status:${NC}"
    echo ""
    echo -e "  ┌─────────────┐"
    echo -e "  │  Frontend   │ (Not tested - browser only)"
    echo -e "  └──────┬──────┘"
    echo -e "         │"
    echo -e "         ▼"
    echo -e "  ┌─────────────────┐"
    if curl -s "$EDGE_ROUTER_URL/health" > /dev/null 2>&1; then
        echo -e "  │  Edge Router    │ ${GREEN}✅ Working${NC}"
    else
        echo -e "  │  Edge Router    │ ${RED}❌ FAILED${NC}"
    fi
    echo -e "  └──────┬──────────┘"
    echo -e "         │"
    echo -e "         ▼"
    echo -e "  ┌─────────────────┐"
    if [ -n "$COORDINATOR_URL" ]; then
        echo -e "  │  Coordinator    │ ${GREEN}✅ Registered${NC}"
    else
        echo -e "  │  Coordinator    │ ${RED}❌ Not Registered${NC}"
    fi
    echo -e "  └──────┬──────────┘"
    echo -e "         │"
    echo -e "         ▼"
    echo -e "  ┌─────────────────┐"
    if [ -n "$COORDINATOR_URL" ] && [ "$worker_count" -gt 0 ]; then
        echo -e "  │     Workers     │ ${GREEN}✅ $worker_count Registered${NC}"
    else
        echo -e "  │     Workers     │ ${RED}❌ No Workers${NC}"
    fi
    echo -e "  └─────────────────┘"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    if [ -z "$COORDINATOR_URL" ]; then
        echo -e "  1. Start edge coordinator: ${BLUE}docker-compose -f edge-coordinator.yml up -d${NC}"
        echo -e "  2. Check coordinator logs: ${BLUE}docker logs edge-coordinator${NC}"
        echo -e "  3. Verify tunnel created: Look for 'trycloudflare.com' in logs"
        echo -e "  4. Verify registration: Look for 'Registered with edge router' in logs"
    elif [ "$worker_count" -eq 0 ]; then
        echo -e "  1. Check coordinator logs: ${BLUE}docker logs edge-coordinator${NC}"
        echo -e "  2. Look for local worker registration in logs"
        echo -e "  3. Check worker logs: ${BLUE}docker logs edge-local-worker${NC}"
        echo -e "  4. Verify worker can reach coordinator"
    else
        echo -e "  1. Check service assignments: ${BLUE}curl $COORDINATOR_URL/api/admin/workers | jq${NC}"
        echo -e "  2. Verify service is actually running in worker"
        echo -e "  3. Check worker logs: ${BLUE}docker logs edge-local-worker${NC}"
    fi
fi
echo ""

exit $failures
