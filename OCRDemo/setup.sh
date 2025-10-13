#!/bin/bash

# OCR Demo Setup and Deployment Script
# This script sets up the OCR Demo application for production deployment

set -e  # Exit on any error

echo "🚀 Starting OCR Demo Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check prerequisites
print_status "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    print_status "Install Docker with: curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    exit 1
fi

DOCKER_COMPOSE_CMD="docker compose"


print_success "Prerequisites check passed (using: $DOCKER_COMPOSE_CMD)"

# Create necessary directories
print_status "Creating required directories..."
mkdir -p {logs,data,processed_docs,temp,credentials}
chmod 755 logs data processed_docs temp credentials
print_success "Directories created"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from example..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_status "Please edit .env file with your configuration:"
        echo "  - Gmail API credentials"
        echo "  - Catalyst CMA system details"
        echo "  - Security settings"
        print_warning "Setup paused. Please configure .env file and run this script again."
        exit 0
    else
        print_error ".env.example file not found. Cannot create configuration."
        exit 1
    fi
fi

# Validate .env file
print_status "Validating environment configuration..."

required_vars=(
    "GMAIL_CLIENT_ID"
    "GMAIL_CLIENT_SECRET"
    "GMAIL_TARGET_EMAIL"
    "CATALYST_BASE_URL"
    "CATALYST_USERNAME"
    "CATALYST_PASSWORD"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing or empty required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_warning "Please configure these variables in .env file"
    exit 1
fi

print_success "Environment configuration validated"

# Build Docker images
print_status "Building Docker images..."
$DOCKER_COMPOSE_CMD build --no-cache

if [ $? -eq 0 ]; then
    print_success "Docker images built successfully"
else
    print_error "Failed to build Docker images"
    exit 1
fi

# Run tests if available
if [ -f "tests/test_setup.py" ]; then
    print_status "Running setup tests..."
    $DOCKER_COMPOSE_CMD run --rm ocr-demo python -m pytest tests/test_setup.py -v
fi

# Start services
print_status "Starting OCR Demo services..."
$DOCKER_COMPOSE_CMD up -d

if [ $? -eq 0 ]; then
    print_success "Services started successfully"
else
    print_error "Failed to start services"
    exit 1
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 15

# Setup Ollama models
print_status "Setting up Ollama models..."
$DOCKER_COMPOSE_CMD exec -T ollama ollama pull llama2:7b &
LLAMA_PID=$!

# Health check
print_status "Performing health check..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -sf http://localhost:5001/health > /dev/null 2>&1; then
        print_success "Health check passed"
        break
    else
        print_status "Attempt $attempt/$max_attempts - Service not ready yet..."
        sleep 2
        ((attempt++))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    print_error "Health check failed - service may not be running properly"
    print_status "Checking service logs..."
    $DOCKER_COMPOSE_CMD logs ocr-demo
    exit 1
fi

# Wait for Ollama model download to complete
print_status "Waiting for Ollama model download to complete..."
wait $LLAMA_PID
if [ $? -eq 0 ]; then
    print_success "Ollama model setup completed"
else
    print_warning "Ollama model setup encountered issues (will retry on first use)"
fi

# Display service information
print_success "🎉 OCR Demo setup completed successfully!"
echo ""
echo "📊 Service Information:"
echo "  - Dashboard: http://localhost:5001"
echo "  - Health Check: http://localhost:5001/health"
echo "  - API Base: http://localhost:5001/api"
echo "  - Ollama LLM: http://localhost:11434"
echo ""
echo "📁 Important Directories:"
echo "  - Logs: ./logs/"
echo "  - Processed Documents: ./processed_docs/"
echo "  - Database: ./data/"
echo "  - Credentials: ./credentials/"
echo ""
echo "🔧 Management Commands:"
echo "  - View logs: $DOCKER_COMPOSE_CMD logs -f ocr-demo"
echo "  - Stop services: $DOCKER_COMPOSE_CMD down"
echo "  - Restart services: $DOCKER_COMPOSE_CMD restart"
echo "  - Update images: $DOCKER_COMPOSE_CMD build && $DOCKER_COMPOSE_CMD up -d"
echo ""
echo "🧠 Ollama Commands:"
echo "  - List models: $DOCKER_COMPOSE_CMD exec ollama ollama list"
echo "  - Pull new model: $DOCKER_COMPOSE_CMD exec ollama ollama pull <model>"
echo "  - Test Ollama: curl http://localhost:11434/api/version"
echo ""

# Check API connections
print_status "Checking API connections..."
if curl -sf http://localhost:5001/api/test_api | grep -q "success"; then
    print_success "Catalyst API connection working"
else
    print_warning "Catalyst API may need configuration"
    echo "  Check CATALYST_BASE_URL, username, and password in .env"
fi

# Check Ollama
if curl -sf http://localhost:11434/api/version > /dev/null 2>&1; then
    print_success "Ollama service running"
else
    print_warning "Ollama service may still be starting"
fi

print_success "Setup completed! The OCR Demo is ready for use."
echo ""
print_status "📋 Next Steps:"
echo "1. Set up Gmail API credentials (see GMAIL_SETUP.md)"
echo "2. Visit http://localhost:5001/auth/gmail to authenticate Gmail"
echo "3. Configure Catalyst CMA credentials in .env"
echo "4. Send a test email to your+RMA@gmail.com with an attachment"
echo "5. Monitor processing on the dashboard"

# Optional: Open browser
if command -v xdg-open &> /dev/null; then
    print_status "Opening dashboard in browser..."
    xdg-open http://localhost:5001
elif command -v open &> /dev/null; then
    print_status "Opening dashboard in browser..."
    open http://localhost:5001
fi