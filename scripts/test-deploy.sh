#!/bin/bash

# CMA Case Management System - Test Deployment Script
# Quick script for testing specific components

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
}

# Test database connection
test_database() {
    print_status "Testing database connection..."
    if docker exec postgres-test pg_isready -U postgres > /dev/null 2>&1; then
        print_success "Database connection OK"
    else
        print_warning "Database not running - run ./scripts/local-deploy.sh first"
        return 1
    fi
}

# Test Redis connection
test_redis() {
    print_status "Testing Redis connection..."
    if docker exec redis-test redis-cli ping > /dev/null 2>&1; then
        print_success "Redis connection OK"
    else
        print_warning "Redis not running - run ./scripts/local-deploy.sh first"
        return 1
    fi
}

# Test API endpoints
test_api() {
    print_status "Testing API endpoints..."
    
    # Test health endpoint
    if curl -s http://localhost:5000/api/auth/health > /dev/null 2>&1; then
        print_success "API server responding"
    else
        print_warning "API server not responding - ensure server is running"
        return 1
    fi
}

# Run unit tests
run_tests() {
    print_status "Running unit tests..."
    npm test -- --testPathPattern=caseFilestore --passWithNoTests
    print_success "Unit tests completed"
}

# Test file upload functionality
test_file_upload() {
    print_status "Testing file upload directories..."
    
    if [ -d "./uploads" ]; then
        print_success "Upload directory exists"
    else
        mkdir -p ./uploads
        print_success "Created upload directory"
    fi
}

# Main test execution
main() {
    echo "=================================="
    echo "  CMA System - Component Testing"
    echo "=================================="
    echo ""
    
    test_database || true
    test_redis || true
    test_api || true
    test_file_upload
    run_tests
    
    echo ""
    print_success "Component testing completed"
}

main "$@"
