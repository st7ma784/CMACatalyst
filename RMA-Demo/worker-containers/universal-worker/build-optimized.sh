#!/bin/bash
# Optimized build script for universal worker
# Designed for GitHub Actions with limited disk space

set -e

echo "🏗️  Building Universal Worker (Optimized)"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check disk space before build
echo -e "${YELLOW}📊 Checking disk space...${NC}"
df -h / | grep -v Filesystem

# Build with BuildKit for better caching and multi-stage support
export DOCKER_BUILDKIT=1

# Tag for the image
TAG="${DOCKER_TAG:-universal-worker:latest}"

echo -e "${GREEN}🔨 Building image: ${TAG}${NC}"
echo "Using Dockerfile.optimized with multi-stage build"

# Build with cache mount for pip (saves time on rebuilds)
docker build \
    -f Dockerfile.optimized \
    -t "${TAG}" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --progress=plain \
    .

# Check final image size
echo -e "${GREEN}✅ Build complete!${NC}"
echo -e "${YELLOW}📦 Final image size:${NC}"
docker images "${TAG}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Optional: Clean up intermediate images to free space
if [ "${CLEANUP_INTERMEDIATE:-false}" = "true" ]; then
    echo -e "${YELLOW}🧹 Cleaning up intermediate images...${NC}"
    docker image prune -f --filter "label=stage=intermediate"
    echo -e "${GREEN}✅ Cleanup complete${NC}"
fi

# Show disk space after build
echo -e "${YELLOW}📊 Disk space after build:${NC}"
df -h / | grep -v Filesystem

echo ""
echo -e "${GREEN}🎉 Build successful!${NC}"
echo "Image: ${TAG}"
echo ""
echo "To run: docker run -e COORDINATOR_URL=http://coordinator:8080 ${TAG}"
