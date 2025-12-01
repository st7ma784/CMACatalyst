#!/bin/bash

###############################################################################
# Next.js Build Fix Script
# Resolves: "doesn't have a root layout" build errors
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Navigate to frontend
cd "$(dirname "$0")/frontend" || exit 1

print_header "Next.js Build Fix"

# Step 1: Clear caches
print_step "Step 1: Clearing build caches"
rm -rf .next node_modules/.cache .turbo
print_success "Caches cleared"

# Step 2: Check structure
print_step "Step 2: Verifying app structure"

if [ -f "src/app/layout.tsx" ]; then
    print_success "Root layout exists at src/app/layout.tsx"
else
    print_error "Root layout NOT found at src/app/layout.tsx"
    exit 1
fi

if [ -d "src/app/graphs" ]; then
    print_success "src/app/graphs directory exists"
else
    print_error "src/app/graphs directory NOT found"
fi

if [ -d "src/app/comparison" ]; then
    print_success "src/app/comparison directory exists"
else
    print_error "src/app/comparison directory NOT found"
fi

# Step 3: Clean conflicting directories
print_step "Step 3: Removing conflicting /app directory"
if [ -d "app" ]; then
    rm -rf app
    print_success "/app directory removed (was causing routing conflict)"
else
    print_success "No conflicting /app directory found"
fi

# Step 4: Dependencies
print_step "Step 4: Installing dependencies"
npm install
print_success "Dependencies installed"

# Step 5: Build
print_step "Step 5: Building project (this may take a minute...)"
if npm run build; then
    print_success "Build completed successfully!"
else
    print_error "Build failed - checking for issues..."
    exit 1
fi

print_header "✅ Build Fix Complete"
echo ""
echo -e "${GREEN}You can now run:${NC}"
echo -e "  ${YELLOW}npm run dev${NC}"
echo ""
echo -e "${GREEN}Test pages available at:${NC}"
echo -e "  • http://localhost:3000"
echo -e "  • http://localhost:3000/graphs"
echo -e "  • http://localhost:3000/comparison"
echo ""
