#!/bin/bash

# CMA Case Management System - Local Deployment Script
# This script sets up the complete system for local testing

set -e

echo "🚀 Starting CMA Case Management System Local Deployment..."

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

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is installed and running"
}

# Check if Node.js is installed
check_node() {
    print_status "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Stop and remove existing containers
cleanup_containers() {
    print_status "Cleaning up existing containers..."
    
    # Stop and remove PostgreSQL container if it exists
    if docker ps -a --format 'table {{.Names}}' | grep -q postgres-test; then
        docker stop postgres-test 2>/dev/null || true
        docker rm postgres-test 2>/dev/null || true
        print_success "Removed existing PostgreSQL container"
    fi
    
    # Stop and remove Redis container if it exists
    if docker ps -a --format 'table {{.Names}}' | grep -q redis-test; then
        docker stop redis-test 2>/dev/null || true
        docker rm redis-test 2>/dev/null || true
        print_success "Removed existing Redis container"
    fi
}

# Start PostgreSQL container
start_postgres() {
    print_status "Starting PostgreSQL container..."
    
    docker run --name postgres-test \
        -e POSTGRES_PASSWORD=password \
        -e POSTGRES_DB=cma_db \
        -e POSTGRES_USER=postgres \
        -p 5432:5432 \
        -d postgres:13
    
    print_success "PostgreSQL container started"
    
    # Wait for PostgreSQL to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Test connection
    for i in {1..30}; do
        if docker exec postgres-test pg_isready -U postgres > /dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done
}

# Start Redis container
start_redis() {
    print_status "Starting Redis container..."
    
    docker run --name redis-test \
        -p 6379:6379 \
        -d redis:6-alpine
    
    print_success "Redis container started"
    
    # Wait for Redis to be ready
    sleep 3
}

# Initialize database schema
init_database() {
    print_status "Initializing database schema..."
    
    # Copy schema file to container and execute
    docker exec -i postgres-test psql -U postgres -d cma_db < database/schema.sql
    
    print_success "Database schema initialized"
}

# Install dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    # Install server dependencies
    npm install
    
    # Install client dependencies
    cd client
    npm install
    cd ..
    
    print_success "Dependencies installed"
}

# Build React application
build_frontend() {
    print_status "Building React frontend..."
    
    cd client
    npm run build
    cd ..
    
    print_success "Frontend built successfully"
}

# Create environment file
create_env_file() {
    print_status "Creating environment configuration..."
    
    cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cma_db
DB_USER=postgres
DB_PASSWORD=password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# File Storage
FILE_STORAGE_PATH=./uploads

# Email Configuration (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Twilio Configuration (Optional - for SMS)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Environment
NODE_ENV=development
PORT=5000
EOF
    
    print_success "Environment file created"
}

# Start the application
start_application() {
    print_status "Starting CMA Case Management System..."
    
    # Start the server in background
    npm start &
    SERVER_PID=$!
    
    # Wait for server to start
    print_status "Waiting for server to start..."
    sleep 5
    
    # Check if server is running
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_success "Server started successfully on http://localhost:5000"
        
        # Open browser (optional)
        if command -v xdg-open &> /dev/null; then
            xdg-open http://localhost:5000 &
        elif command -v open &> /dev/null; then
            open http://localhost:5000 &
        fi
        
        echo ""
        echo "🎉 CMA Case Management System is now running!"
        echo ""
        echo "📊 Application: http://localhost:5000"
        echo "🗄️  PostgreSQL: localhost:5432 (postgres/password)"
        echo "🔴 Redis: localhost:6379"
        echo ""
        echo "Press Ctrl+C to stop the application"
        
        # Wait for Ctrl+C
        trap 'print_status "Shutting down..."; kill $SERVER_PID 2>/dev/null; exit 0' INT
        wait $SERVER_PID
    else
        print_error "Failed to start server"
        exit 1
    fi
}

# Main execution
main() {
    echo "=================================================="
    echo "  CMA Case Management System - Local Deployment"
    echo "=================================================="
    echo ""
    
    check_docker
    check_node
    cleanup_containers
    start_postgres
    start_redis
    init_database
    install_dependencies
    build_frontend
    create_env_file
    start_application
}

# Run main function
main "$@"
