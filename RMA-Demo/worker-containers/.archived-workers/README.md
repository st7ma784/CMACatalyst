# Archived Worker Containers

**Date Archived:** December 8, 2025

## What's Here

This directory contains the deprecated CPU and GPU worker containers that have been replaced by the universal worker architecture.

### Archived Contents
- `cpu-worker/` - Old CPU-specific worker
- `gpu-worker/` - Old GPU-specific worker
- `start-cpu-worker.sh` - Old CPU worker startup script
- `start-gpu-worker.sh` - Old GPU worker startup script

## Why Archived

These worker containers have been deprecated in favor of the **universal worker container** which:

- ✅ Auto-detects hardware capabilities (GPU/CPU)
- ✅ Gets service assignments dynamically from the coordinator
- ✅ Supports all 14 microservices across all 4 tiers
- ✅ Simplifies deployment (single container vs multiple types)
- ✅ Reduces maintenance overhead

## New Approach

Instead of separate worker containers, use the universal worker:

```bash
# Pull the universal worker
docker pull ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Run with auto-detection (recommended)
docker run -d --name rma-worker --restart unless-stopped \
  --gpus all \
  -e WORKER_TYPE=auto \
  -e COORDINATOR_URL=https://edge-1.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

See `/worker-containers/universal-worker/` for the current implementation.

## Migration Notes

If you're still using the old workers:

1. Stop the old workers: `docker stop <container-name>`
2. Remove the old workers: `docker rm <container-name>`
3. Deploy the universal worker using the command above
4. Verify registration: Check https://rmatool.org.uk → System tab

## References

- Universal Worker README: `/worker-containers/README.md`
- Getting Started Guide: https://rmatool.org.uk → Documentation → Getting Started

---

**Status:** Archived for reference only - Do not use in production
