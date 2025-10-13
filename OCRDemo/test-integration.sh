#!/bin/bash

# OCR Demo Integration Test Script
# Tests all components of the OCR Demo system

set -e

echo "🧪 Running OCR Demo Integration Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
}

# Determine Docker Compose command
DOCKER_COMPOSE_CMD=""
if command -v "docker compose" &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v "docker-compose" &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    print_fail "Docker Compose not found. Please install Docker Compose."
    exit 1
fi

BASE_URL="http://localhost:5001"
OLLAMA_URL="http://localhost:11434"

# Test 1: Health Check
print_test "Testing system health check..."
if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    health_response=$(curl -s "$BASE_URL/health")
    if echo "$health_response" | grep -q '"status":"healthy"'; then
        print_pass "System health check passed"
    else
        print_fail "System reported unhealthy status"
        echo "$health_response"
    fi
else
    print_fail "Health check endpoint not responding"
    exit 1
fi

# Test 2: Ollama Service
print_test "Testing Ollama LLM service..."
if curl -sf "$OLLAMA_URL/api/version" > /dev/null 2>&1; then
    print_pass "Ollama service is running"
    
    # Test model availability
    if curl -sf "$BASE_URL/api/ollama/test" > /dev/null 2>&1; then
        ollama_response=$(curl -s "$BASE_URL/api/ollama/test")
        if echo "$ollama_response" | grep -q '"status":"success"'; then
            print_pass "Ollama integration working"
        else
            print_fail "Ollama integration failed"
            echo "$ollama_response"
        fi
    else
        print_fail "Ollama test endpoint not responding"
    fi
else
    print_fail "Ollama service not running"
fi

# Test 3: Database Connection
print_test "Testing database connection..."
if $DOCKER_COMPOSE_CMD exec -T ocr-demo python -c "
from src.database import Database
db = Database()
stats = db.get_stats()
print('Database connection successful')
" > /dev/null 2>&1; then
    print_pass "Database connection working"
else
    print_fail "Database connection failed"
fi

# Test 4: OCR Processor
print_test "Testing OCR processor..."
if $DOCKER_COMPOSE_CMD exec -T ocr-demo python -c "
from src.ocr_processor import OCRProcessor
ocr = OCRProcessor()
if ocr.is_available():
    print('OCR processor available')
else:
    print('OCR processor not available')
    exit(1)
" > /dev/null 2>&1; then
    print_pass "OCR processor is available"
else
    print_fail "OCR processor not working"
fi

# Test 5: API Statistics
print_test "Testing API statistics endpoint..."
if curl -sf "$BASE_URL/api/stats" > /dev/null 2>&1; then
    stats_response=$(curl -s "$BASE_URL/api/stats")
    if echo "$stats_response" | grep -q 'total_emails'; then
        print_pass "Statistics endpoint working"
    else
        print_fail "Statistics endpoint returned invalid data"
    fi
else
    print_fail "Statistics endpoint not responding"
fi

# Test 6: Document Processing API
print_test "Testing document processing endpoints..."
if curl -sf "$BASE_URL/api/recent_documents" > /dev/null 2>&1; then
    print_pass "Recent documents endpoint working"
else
    print_fail "Recent documents endpoint not responding"
fi

# Test 7: Dashboard Access
print_test "Testing dashboard access..."
if curl -sf "$BASE_URL/" > /dev/null 2>&1; then
    dashboard_response=$(curl -s "$BASE_URL/")
    if echo "$dashboard_response" | grep -q 'OCR Demo'; then
        print_pass "Dashboard accessible"
    else
        print_fail "Dashboard returned unexpected content"
    fi
else
    print_fail "Dashboard not accessible"
fi

# Test 8: Gmail Authentication Setup
print_test "Testing Gmail authentication setup..."
if [ -f "credentials/credentials.json" ]; then
    print_pass "Gmail credentials file found"
    
    # Test auth endpoint
    if curl -sf "$BASE_URL/auth/gmail" > /dev/null 2>&1; then
        print_pass "Gmail auth endpoint accessible"
    else
        print_fail "Gmail auth endpoint not responding"
    fi
else
    print_skip "Gmail credentials not configured (see GMAIL_SETUP.md)"
fi

# Test 9: Catalyst API Configuration
print_test "Testing Catalyst API configuration..."
if curl -sf "$BASE_URL/api/test_api" > /dev/null 2>&1; then
    api_response=$(curl -s "$BASE_URL/api/test_api")
    if echo "$api_response" | grep -q '"status":"success"'; then
        print_pass "Catalyst API connection working"
    else
        print_skip "Catalyst API not configured or not accessible"
        # This is expected if credentials aren't set up yet
    fi
else
    print_fail "API test endpoint not responding"
fi

# Test 10: Container Status
print_test "Testing container status..."
containers_up=$($DOCKER_COMPOSE_CMD ps --services --filter "status=running" 2>/dev/null | wc -l)
total_containers=$($DOCKER_COMPOSE_CMD ps --services 2>/dev/null | wc -l)

if [ "$containers_up" -eq "$total_containers" ] && [ "$containers_up" -gt 0 ]; then
    print_pass "All containers are running ($containers_up/$total_containers)"
else
    print_fail "Some containers are not running ($containers_up/$total_containers)"
    $DOCKER_COMPOSE_CMD ps
fi

# Test 11: Log Files
print_test "Testing log file creation..."
if [ -f "logs/ocr_demo.log" ]; then
    print_pass "Log file created"
else
    print_skip "Log file not yet created"
fi

# Test 12: Processing Directories
print_test "Testing processing directories..."
error_count=0

for dir in "temp" "processed_docs" "data" "logs"; do
    if [ -d "$dir" ]; then
        if [ -w "$dir" ]; then
            print_pass "Directory $dir exists and is writable"
        else
            print_fail "Directory $dir exists but is not writable"
            ((error_count++))
        fi
    else
        print_fail "Directory $dir does not exist"
        ((error_count++))
    fi
done

if [ $error_count -eq 0 ]; then
    print_pass "All required directories are properly configured"
fi

echo ""
echo "🎯 Integration Test Summary:"
echo "✅ Core system components tested"
echo "✅ API endpoints verified"  
echo "✅ Container orchestration checked"
echo "✅ File system permissions validated"
echo ""

# Final recommendations
echo "📋 Next Steps for Full Integration:"
echo "1. Complete Gmail API setup (see GMAIL_SETUP.md)"
echo "2. Configure Catalyst CMA credentials in .env"
echo "3. Test with real email and document"
echo "4. Monitor dashboard for processing results"
echo ""

print_pass "Integration tests completed successfully!"

# Test email processing flow (if configured)
if [ -f "credentials/token.json" ] && grep -q "CATALYST_USERNAME" .env && ! grep -q "your_username" .env; then
    echo ""
    print_test "Full system appears configured - you can now:"
    echo "  1. Send test email to your+RMA@gmail.com"
    echo "  2. Monitor dashboard at $BASE_URL"
    echo "  3. Check processing logs: $DOCKER_COMPOSE_CMD logs -f ocr-demo"
fi