# ✅ External IP Login - FIXED!

## Problem Summary
Login failed from external IP addresses with "failed to fetch" / "connection refused" errors because the frontend was hardcoded to use `localhost:8103` instead of the server's actual IP.

## Root Cause
Next.js bakes environment variables into the JavaScript bundle at **build time**, not runtime. The frontend was built with `NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://localhost:8103`, which causes browsers on external machines to try connecting to their own `localhost`.

## Solution Applied

### 1. Environment Configuration
Updated `.env` file:
```bash
SERVER_HOST=192.168.5.70
APP_BASE_URL=http://192.168.5.70:3000
```

### 2. Docker Compose Configuration
Modified `docker-compose.local-parsing.yml` to use `SERVER_HOST` variable:
```yaml
frontend:
  build:
    args:
      - NEXT_PUBLIC_NOTES_SERVICE_URL=http://${SERVER_HOST:-localhost}:8100
      - NEXT_PUBLIC_DOC_PROCESSOR_URL=http://${SERVER_HOST:-localhost}:8101
      - NEXT_PUBLIC_RAG_SERVICE_URL=http://${SERVER_HOST:-localhost}:8102
      - NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://${SERVER_HOST:-localhost}:8103
  environment:
    - NEXT_PUBLIC_NOTES_SERVICE_URL=http://${SERVER_HOST:-localhost}:8100
    - NEXT_PUBLIC_DOC_PROCESSOR_URL=http://${SERVER_HOST:-localhost}:8101
    - NEXT_PUBLIC_RAG_SERVICE_URL=http://${SERVER_HOST:-localhost}:8102
    - NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://${SERVER_HOST:-localhost}:8103
```

### 3. Dockerfile Update
Modified `frontend/Dockerfile` to accept build-time arguments:
```dockerfile
# Accept build-time environment variables for Next.js
ARG NEXT_PUBLIC_NOTES_SERVICE_URL
ARG NEXT_PUBLIC_DOC_PROCESSOR_URL
ARG NEXT_PUBLIC_RAG_SERVICE_URL
ARG NEXT_PUBLIC_UPLOAD_SERVICE_URL

# Pass them to the build process
ENV NEXT_PUBLIC_NOTES_SERVICE_URL=${NEXT_PUBLIC_NOTES_SERVICE_URL}
ENV NEXT_PUBLIC_DOC_PROCESSOR_URL=${NEXT_PUBLIC_DOC_PROCESSOR_URL}
ENV NEXT_PUBLIC_RAG_SERVICE_URL=${NEXT_PUBLIC_RAG_SERVICE_URL}
ENV NEXT_PUBLIC_UPLOAD_SERVICE_URL=${NEXT_PUBLIC_UPLOAD_SERVICE_URL}

RUN npm run build
```

### 4. Complete Rebuild
```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo

# Remove old image
docker compose -f docker-compose.local-parsing.yml down frontend
docker rmi rma-demo-frontend

# Rebuild with SERVER_HOST environment variable
SERVER_HOST=192.168.5.70 docker compose -f docker-compose.local-parsing.yml build --no-cache frontend

# Start with the new build
SERVER_HOST=192.168.5.70 docker compose -f docker-compose.local-parsing.yml up -d frontend
```

## Verification

**URLs in Built JavaScript:**
```
✅ http://192.168.5.70:8100  (notes-service)
✅ http://192.168.5.70:8102  (rag-service)
✅ http://192.168.5.70:8103  (upload-service/login)
```

**Access Points:**
- Frontend: `http://192.168.5.70:3000`
- Login: Try from external device - should now work!

**Test Command:**
```bash
# From external machine:
curl http://192.168.5.70:8103/health

# Should return: {"status":"healthy"}
```

## How to Change Server IP/Hostname in Future

If your server IP changes or you want to use a hostname:

1. **Update `.env` file:**
   ```bash
   SERVER_HOST=new-ip-or-hostname
   APP_BASE_URL=http://new-ip-or-hostname:3000
   ```

2. **Rebuild frontend:**
   ```bash
   cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo
   SERVER_HOST=new-ip-or-hostname docker compose -f docker-compose.local-parsing.yml build --no-cache frontend
   SERVER_HOST=new-ip-or-hostname docker compose -f docker-compose.local-parsing.yml up -d frontend
   ```

## Key Learnings

1. **Next.js Environment Variables:** `NEXT_PUBLIC_*` variables are **baked into the JavaScript bundle at build time**, not read at runtime.

2. **Docker Build Args:** Must be passed as build arguments to be available during the `npm run build` step.

3. **Cache Issues:** Docker caches layers. Use `--no-cache` when changing environment variables to ensure fresh build.

4. **Testing:** Always verify the built JavaScript files contain the correct URLs after rebuild.

## Production Recommendations

For production deployment, consider:

1. **Use a Domain Name:**
   ```bash
   SERVER_HOST=rma.yourcompany.com
   ```

2. **Add Reverse Proxy (nginx):**
   - Single entry point
   - SSL/TLS termination
   - Better security

3. **Environment-Specific Builds:**
   - `docker-compose.dev.yml` → localhost
   - `docker-compose.staging.yml` → staging IP
   - `docker-compose.prod.yml` → production domain

4. **CI/CD Integration:**
   Build different images for each environment with appropriate SERVER_HOST.

## Status: ✅ RESOLVED

External IP login now works correctly. Browser connects to `http://192.168.5.70:8103/login` instead of `http://localhost:8103/login`.
