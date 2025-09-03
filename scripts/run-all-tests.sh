#!/bin/bash
set -e

echo "🧪 Running comprehensive test suite for MordecAI services..."

# Function to run tests with proper error handling
run_test() {
    local service=$1
    local test_command=$2
    echo "Running tests for $service..."
    
    if eval "$test_command"; then
        echo "✅ $service tests passed"
    else
        echo "❌ $service tests failed"
        exit 1
    fi
}

# Run backend server tests
echo "📊 Running backend server tests..."
run_test "Backend Server" "npm run test:server"

# Test individual microservices
echo "📁 Testing document-inbox service..."
cd services/document-inbox
run_test "Document Inbox" "npm test"
cd ../..

echo "🔍 Testing OCR processor service..."
cd services/ocr-processor
run_test "OCR Processor" "npm test"
cd ../..

# Test Python services (skip if no Python/pytest available)
if command -v python3 &> /dev/null && python3 -m pytest --version &> /dev/null; then
    echo "🐍 Testing translation service..."
    cd services/translation-service
    pip install -r requirements-dev.txt &> /dev/null || echo "Warning: Could not install dev dependencies"
    run_test "Translation Service" "python3 -m pytest tests/ -v"
    cd ../..
else
    echo "⚠️  Skipping Python tests (pytest not available)"
fi

# Run frontend tests
echo "⚛️  Running frontend tests..."
run_test "Frontend" "npm run test:client"

# Run E2E tests (skip if CI environment without display)
if [ -n "$DISPLAY" ] || [ "$CI" != "true" ]; then
    echo "🎭 Running Playwright E2E tests..."
    npx playwright install --with-deps chromium &> /dev/null || echo "Installing Playwright browsers..."
    run_test "E2E Tests" "npm run test:e2e"
else
    echo "⚠️  Skipping E2E tests (no display available)"
fi

echo "🎉 All tests completed successfully!"