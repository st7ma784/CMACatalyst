#!/bin/bash

# Simple Docker Build Script for OCR Demo
# Tests if the Docker image can be built successfully

set -e

echo "🔨 Testing Docker Build for OCR Demo..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found. Make sure you're in the OCRDemo directory."
    exit 1
fi

# Check requirements.txt exists
if [ ! -f "requirements.txt" ]; then
    print_error "requirements.txt not found."
    exit 1
fi

print_status "Building Docker image..."
print_status "This may take several minutes for the first build..."

# Build the Docker image
if docker build -t ocr-demo-test . --no-cache; then
    print_success "Docker image built successfully!"
    
    # Show image size
    image_size=$(docker images ocr-demo-test --format "table {{.Size}}" | tail -n 1)
    print_status "Image size: $image_size"
    
    # Test basic container run
    print_status "Testing container startup..."
    if timeout 30 docker run --rm ocr-demo-test python -c "print('Container test successful')"; then
        print_success "Container runs successfully!"
    else
        print_error "Container failed to run properly"
        exit 1
    fi
    
    # Cleanup test image
    print_status "Cleaning up test image..."
    docker rmi ocr-demo-test
    
    print_success "🎉 Docker build test completed successfully!"
    echo ""
    echo "You can now run the full setup with: ./setup.sh"
    
else
    print_error "Docker build failed!"
    echo ""
    echo "Common solutions:"
    echo "1. Check internet connection for package downloads"
    echo "2. Verify requirements.txt has compatible package versions"
    echo "3. Try running: docker system prune -f"
    echo "4. Check Docker has enough disk space"
    exit 1
fi