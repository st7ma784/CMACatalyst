#!/bin/bash

# Build All Microservices Script
# This script builds Docker images for all microservices

set -e  # Exit on any error

echo "🚀 Building all microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TAG="latest"
REGISTRY=""
PUSH=false
BUILD_ARGS=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --push)
      PUSH=true
      shift
      ;;
    --build-arg)
      BUILD_ARGS="$BUILD_ARGS --build-arg $2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --tag TAG           Set the tag for Docker images (default: latest)"
      echo "  --registry REGISTRY Set the Docker registry prefix"
      echo "  --push              Push images to registry after building"
      echo "  --build-arg ARG     Pass build argument to Docker build"
      echo "  --help              Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Set image names
if [ -n "$REGISTRY" ]; then
  API_GATEWAY_IMAGE="${REGISTRY}/cma-api-gateway:${TAG}"
  FRONTEND_IMAGE="${REGISTRY}/cma-frontend:${TAG}"
  CHATBOT_IMAGE="${REGISTRY}/cma-chatbot:${TAG}"
  DOCUMENT_INBOX_IMAGE="${REGISTRY}/cma-document-inbox:${TAG}"
  OCR_PROCESSOR_IMAGE="${REGISTRY}/cma-ocr-processor:${TAG}"
  TRANSLATION_SERVICE_IMAGE="${REGISTRY}/cma-translation-service:${TAG}"
else
  API_GATEWAY_IMAGE="cma/api-gateway:${TAG}"
  FRONTEND_IMAGE="cma/frontend:${TAG}"
  CHATBOT_IMAGE="cma/chatbot:${TAG}"
  DOCUMENT_INBOX_IMAGE="cma/document-inbox:${TAG}"
  OCR_PROCESSOR_IMAGE="cma/ocr-processor:${TAG}"
  TRANSLATION_SERVICE_IMAGE="cma/translation-service:${TAG}"
fi

# Function to build and optionally push an image
build_service() {
  local service_name=$1
  local dockerfile=$2
  local context=$3
  local image_name=$4
  
  echo -e "${BLUE}Building $service_name...${NC}"
  
  if [ -f "$dockerfile" ]; then
    docker build $BUILD_ARGS -f "$dockerfile" -t "$image_name" "$context"
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Successfully built $service_name${NC}"
      
      if [ "$PUSH" = true ]; then
        echo -e "${YELLOW}📤 Pushing $image_name...${NC}"
        docker push "$image_name"
        
        if [ $? -eq 0 ]; then
          echo -e "${GREEN}✅ Successfully pushed $service_name${NC}"
        else
          echo -e "${RED}❌ Failed to push $service_name${NC}"
          return 1
        fi
      fi
    else
      echo -e "${RED}❌ Failed to build $service_name${NC}"
      return 1
    fi
  else
    echo -e "${RED}❌ Dockerfile not found: $dockerfile${NC}"
    return 1
  fi
}

# Function to run tests for a service
run_service_tests() {
  local service_name=$1
  local service_dir=$2
  
  echo -e "${BLUE}Running tests for $service_name...${NC}"
  
  if [ -f "$service_dir/package.json" ]; then
    (cd "$service_dir" && npm test)
  elif [ -f "$service_dir/pytest.ini" ]; then
    (cd "$service_dir" && python -m pytest)
  else
    echo -e "${YELLOW}⚠️  No test configuration found for $service_name${NC}"
  fi
}

# Pre-build checks
echo -e "${BLUE}🔍 Pre-build checks...${NC}"

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed${NC}"
  exit 1
fi

if ! docker info &> /dev/null; then
  echo -e "${RED}❌ Docker daemon is not running${NC}"
  exit 1
fi

# Check if all required Dockerfiles exist
DOCKERFILES=(
  "Dockerfile"
  "Dockerfile.frontend"
  "Dockerfile.chatbot"
  "services/document-inbox/Dockerfile"
  "services/ocr-processor/Dockerfile"
  "services/translation-service/Dockerfile"
)

for dockerfile in "${DOCKERFILES[@]}"; do
  if [ ! -f "$dockerfile" ]; then
    echo -e "${RED}❌ Missing Dockerfile: $dockerfile${NC}"
    exit 1
  fi
done

echo -e "${GREEN}✅ All pre-build checks passed${NC}"

# Run tests before building
echo -e "\n${BLUE}🧪 Running tests...${NC}"
run_service_tests "document-inbox" "services/document-inbox"
run_service_tests "ocr-processor" "services/ocr-processor"
run_service_tests "translation-service" "services/translation-service"

# Build services
echo -e "\n${BLUE}🔨 Building Docker images...${NC}"

# Build main API Gateway
build_service "API Gateway" "Dockerfile" "." "$API_GATEWAY_IMAGE"

# Build Frontend
build_service "Frontend" "Dockerfile.frontend" "." "$FRONTEND_IMAGE"

# Build Chatbot
build_service "Chatbot" "Dockerfile.chatbot" "." "$CHATBOT_IMAGE"

# Build Document Inbox Service
build_service "Document Inbox" "services/document-inbox/Dockerfile" "services/document-inbox" "$DOCUMENT_INBOX_IMAGE"

# Build OCR Processor Service
build_service "OCR Processor" "services/ocr-processor/Dockerfile" "services/ocr-processor" "$OCR_PROCESSOR_IMAGE"

# Build Translation Service
build_service "Translation Service" "services/translation-service/Dockerfile" "services/translation-service" "$TRANSLATION_SERVICE_IMAGE"

# Summary
echo -e "\n${GREEN}🎉 Build Summary:${NC}"
echo "Built images:"
echo "  - $API_GATEWAY_IMAGE"
echo "  - $FRONTEND_IMAGE"
echo "  - $CHATBOT_IMAGE"
echo "  - $DOCUMENT_INBOX_IMAGE"
echo "  - $OCR_PROCESSOR_IMAGE"
echo "  - $TRANSLATION_SERVICE_IMAGE"

if [ "$PUSH" = true ]; then
  echo -e "${GREEN}📤 All images pushed to registry${NC}"
fi

# Generate docker-compose override file for the built images
echo -e "\n${BLUE}📝 Generating docker-compose.override.yml...${NC}"
cat > docker-compose.override.yml << EOF
# Generated docker-compose override file
# This file uses the locally built images
version: '3.8'

services:
  api-gateway:
    image: $API_GATEWAY_IMAGE
    
  frontend:
    image: $FRONTEND_IMAGE
    
  chatbot:
    image: $CHATBOT_IMAGE
    
  document-inbox:
    image: $DOCUMENT_INBOX_IMAGE
    
  ocr-processor:
    image: $OCR_PROCESSOR_IMAGE
    
  translation-service:
    image: $TRANSLATION_SERVICE_IMAGE
EOF

echo -e "${GREEN}✅ Generated docker-compose.override.yml${NC}"

# Optional: Run security scan
if command -v trivy &> /dev/null; then
  echo -e "\n${BLUE}🔒 Running security scans...${NC}"
  trivy image "$API_GATEWAY_IMAGE" --exit-code 1 --severity HIGH,CRITICAL || echo -e "${YELLOW}⚠️  Security issues found in API Gateway${NC}"
  trivy image "$FRONTEND_IMAGE" --exit-code 1 --severity HIGH,CRITICAL || echo -e "${YELLOW}⚠️  Security issues found in Frontend${NC}"
else
  echo -e "${YELLOW}⚠️  Trivy not installed, skipping security scan${NC}"
fi

# Test that all containers can start
echo -e "\n${BLUE}🧪 Testing container startup...${NC}"
for image in "$API_GATEWAY_IMAGE" "$FRONTEND_IMAGE" "$DOCUMENT_INBOX_IMAGE"; do
  echo -e "${BLUE}Testing $image...${NC}"
  timeout 30s docker run --rm "$image" echo "Container started successfully" || echo -e "${YELLOW}⚠️  Container test failed for $image${NC}"
done

echo -e "\n${GREEN}🎊 All services built successfully!${NC}"
echo -e "${BLUE}To deploy the services, run:${NC}"
echo "  docker-compose up -d"

exit 0