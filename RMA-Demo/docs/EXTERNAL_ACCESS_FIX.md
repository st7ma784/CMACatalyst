# Fix: External IP Login Fails with "Connection Refused"

## The Problem

When accessing from external IP addresses, login fails with "failed to fetch" errors. The logs show:
```
httpx.ConnectError: All connection attempts failed
```

**Root Cause:**
The frontend uses `localhost` URLs for backend services. When the browser runs on an external client:
- Browser tries to connect to `http://localhost:8103/login`
- But `localhost` refers to the external client's machine, NOT your server
- Result: Connection refused

## The Solution

### Option 1: Use Server IP/Hostname (Quick Fix)

Replace `localhost` with your server's actual IP address or hostname.

**Server IP:** `192.168.5.70`

**Edit docker-compose.local-parsing.yml:**

```yaml
frontend:
  environment:
    # Replace localhost with your server IP or hostname
    - NEXT_PUBLIC_NOTES_SERVICE_URL=http://192.168.5.70:8100
    - NEXT_PUBLIC_DOC_PROCESSOR_URL=http://192.168.5.70:8101
    - NEXT_PUBLIC_RAG_SERVICE_URL=http://192.168.5.70:8102
    - NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://192.168.5.70:8103
```

**Or use a hostname:**
```yaml
    - NEXT_PUBLIC_NOTES_SERVICE_URL=http://your-server.local:8100
    - NEXT_PUBLIC_DOC_PROCESSOR_URL=http://your-server.local:8101
    - NEXT_PUBLIC_RAG_SERVICE_URL=http://your-server.local:8102
    - NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://your-server.local:8103
```

**Then rebuild and restart:**
```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo
docker compose -f docker-compose.local-parsing.yml build frontend
docker compose -f docker-compose.local-parsing.yml restart frontend
```

### Option 2: Use Environment File (Better for Multiple Environments)

Create a `.env` file:

```bash
# .env
SERVER_HOST=192.168.5.70
```

Update docker-compose.local-parsing.yml:
```yaml
frontend:
  environment:
    - NEXT_PUBLIC_NOTES_SERVICE_URL=http://${SERVER_HOST:-localhost}:8100
    - NEXT_PUBLIC_DOC_PROCESSOR_URL=http://${SERVER_HOST:-localhost}:8101
    - NEXT_PUBLIC_RAG_SERVICE_URL=http://${SERVER_HOST:-localhost}:8102
    - NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://${SERVER_HOST:-localhost}:8103
```

### Option 3: Use Reverse Proxy (Production Ready)

For production, use nginx as a reverse proxy so everything goes through one domain.

**Benefits:**
- Single entry point (e.g., `https://rma.yourcompany.com`)
- No CORS issues
- Easy SSL/TLS setup
- Standard deployment pattern

**Example nginx config:**
```nginx
server {
    listen 80;
    server_name rma.yourcompany.com;

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
    }

    # Backend APIs
    location /api/notes/ {
        proxy_pass http://notes-service:8100/;
    }
    location /api/doc-processor/ {
        proxy_pass http://doc-processor:8101/;
    }
    location /api/rag/ {
        proxy_pass http://rag-service:8102/;
    }
    location /api/upload/ {
        proxy_pass http://upload-service:8103/;
    }
}
```

## Quick Fix Command

Run this to update and restart with your server IP:

```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo

# Update the docker-compose file with your server IP
sed -i 's|http://localhost:8100|http://192.168.5.70:8100|g' docker-compose.local-parsing.yml
sed -i 's|http://localhost:8101|http://192.168.5.70:8101|g' docker-compose.local-parsing.yml
sed -i 's|http://localhost:8102|http://192.168.5.70:8102|g' docker-compose.local-parsing.yml
sed -i 's|http://localhost:8103|http://192.168.5.70:8103|g' docker-compose.local-parsing.yml

# Rebuild and restart frontend
docker compose -f docker-compose.local-parsing.yml build frontend
docker compose -f docker-compose.local-parsing.yml restart frontend
```

## Firewall Check

Also ensure your firewall allows external access to these ports:

```bash
# Check firewall status
sudo ufw status

# If firewall is active, allow ports:
sudo ufw allow 3000/tcp comment "RMA Frontend"
sudo ufw allow 8100/tcp comment "RMA Notes Service"
sudo ufw allow 8101/tcp comment "RMA Doc Processor"
sudo ufw allow 8102/tcp comment "RMA RAG Service"
sudo ufw allow 8103/tcp comment "RMA Upload Service"
```

## Testing

After applying the fix:

1. **From external machine:**
   ```bash
   curl http://192.168.5.70:8103/health
   ```

2. **Access frontend:**
   - Open browser: `http://192.168.5.70:3000`
   - Try logging in
   - Should now connect successfully

3. **Check browser console:**
   - Open DevTools (F12)
   - Network tab should show requests going to `192.168.5.70:8103` instead of `localhost`

## Notes

- **Local Development:** Keep localhost for local testing
- **Production:** Use domain name (e.g., `rma.company.com`) instead of IP
- **SSL/TLS:** For production, always use HTTPS with proper certificates
- **CORS:** Make sure backend services allow your frontend origin

## What Changed

**Before:**
```
Browser on external IP → http://localhost:8103/login 
                       ↓
                   FAILS (localhost = external client's machine)
```

**After:**
```
Browser on external IP → http://192.168.5.70:8103/login 
                       ↓
                   SUCCESS (connects to your actual server)
```
