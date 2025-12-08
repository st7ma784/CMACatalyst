# CORS Fix Summary

## Problem Identified

The CORS errors you're seeing are **NOT actually CORS configuration issues**. The error message "CORS request did not succeed. Status code: (null)" indicates that the browser **cannot connect** to the backend services at all.

### Root Cause

**Docker rootless networking limitation**: The services are accessible on `localhost` but NOT on the external IP `192.168.5.70` when using Docker's rootless mode.

Diagnostic results:
- ✅ Services respond on `http://localhost:8102`, `http://localhost:8103`, `http://localhost:8104`
- ❌ Services DO NOT respond on `http://192.168.5.70:8102`, `http://192.168.5.70:8103`, `http://192.168.5.70:8104`
- ✅ CORS is properly configured on all services with `allow_origins=["*"]`
- ✅ Services are listening on `0.0.0.0` (correct)

## Solution Implemented

I've implemented a **Next.js API proxy** to route browser requests through the Next.js server (which CAN access the Docker services via internal networking).

### Changes Made

1. **Updated docker-compose.yml**:
   - Added explicit `0.0.0.0` binding to port mappings
   - Added `RAG_SERVICE_URL` environment variables for inter-service communication

2. **Created API proxy routes**:
   - `/RMA-Demo/frontend/src/app/api/rag/[...path]/route.ts` - Proxies to rag-service
   - `/RMA-Demo/frontend/src/app/api/upload/[...path]/route.ts` - Proxies to upload-service

3. **Created utility library**:
   - `/RMA-Demo/frontend/src/lib/apiUrls.ts` - Centralized API URL management

4. **Updated frontend components**:
   - `AskTheManuals.tsx` - Now uses proxy URLs
   - `advisor-dashboard/page.tsx` - Now uses proxy URLs

## Next Steps Required

The API routes were created but Next.js might need a full rebuild in dev mode to pick them up. Here's what you need to do:

### Option 1: Quick Test (Recommended)

```bash
cd RMA-Demo
# Stop and rebuild frontend
docker compose stop frontend
docker compose build --no-cache frontend
docker compose up -d frontend

# Wait 10 seconds, then test
sleep 10
curl -i http://localhost:3000/api/rag/health
curl -i http://localhost:3000/api/upload/health
```

If these return JSON responses (not 404), the proxy is working!

### Option 2: Alternative - Use Nginx Reverse Proxy

If the Next.js proxy doesn't work, you can add an nginx reverse proxy:

```yaml
# Add to docker-compose.yml
nginx:
  image: nginx:alpine
  container_name: rma-nginx
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    - frontend
    - rag-service
    - upload-service
  restart: unless-stopped
```

Then create `nginx.conf` to proxy `/api/*` requests to the backend services.

### Option 3: Fix Docker Networking (Advanced)

Configure Docker to use host networking mode or fix rootless networking:

```bash
# Check if using rootless mode
docker context ls

# If rootless, you may need to configure port forwarding
# Or switch to rootful Docker
```

## Testing

Once the proxy is working, test the "Ask the Manuals" feature:

1. Navigate to `http://192.168.5.70:3000`
2. Go to the "Ask the Manuals" section
3. Try asking a question
4. Check browser console - you should see requests to `/api/rag/*` instead of direct requests to port 8102
5. Requests should succeed without CORS errors

## Diagnostic Script

I've created a diagnostic script at `/RMA-Demo/diagnose-cors.sh` that you can run to check connectivity:

```bash
cd RMA-Demo
./diagnose-cors.sh
```

This will show you:
- Which Docker containers are running
- Local connectivity (localhost)
- External IP connectivity (192.168.5.70)
- CORS preflight test results
- Listening ports

## Summary

The "CORS error" was actually a **connectivity issue** caused by Docker rootless networking not properly exposing ports to external IPs. The solution is to use Next.js as a proxy server, routing browser requests through the frontend container which CAN access backend services via Docker's internal network.

## Files Modified

- `RMA-Demo/docker-compose.yml` - Updated port bindings and environment variables
- `RMA-Demo/frontend/next.config.js` - Added rewrite rules (though these don't work for external URLs in production)
- `RMA-Demo/frontend/src/lib/apiUrls.ts` - NEW: API URL utility
- `RMA-Demo/frontend/src/app/api/rag/[...path]/route.ts` - NEW: RAG service proxy
- `RMA-Demo/frontend/src/app/api/upload/[...path]/route.ts` - NEW: Upload service proxy
- `RMA-Demo/frontend/src/components/AskTheManuals.tsx` - Updated to use proxy URLs
- `RMA-Demo/frontend/src/app/advisor-dashboard/page.tsx` - Updated to use proxy URLs
- `RMA-Demo/diagnose-cors.sh` - NEW: Diagnostic tool

## Contact

If you need help, the diagnostic script output will be very helpful for troubleshooting!
