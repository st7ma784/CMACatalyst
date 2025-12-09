# VPN Mesh Phase 1 - Testing Guide

## Overview

This guide will walk you through testing the complete VPN mesh + certificate signing implementation (Phase 1).

**What We're Testing:**
- ✅ Single worker bootstrap (lighthouse initialization)
- ✅ Certificate signing service startup
- ✅ Multi-worker VPN joining
- ✅ Certificate request/signing flow
- ✅ VPN connectivity between workers
- ✅ Entry point registration (if public IPs available)

---

## Prerequisites

### 1. Cloudflare KV Namespace

```bash
# Install Wrangler CLI (if not already installed)
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login

# Create VPN KV namespace
wrangler kv:namespace create "vpn_bootstrap"

# Copy the namespace ID from the output
# Example output:
# 📦 Creating namespace...
# ✨  Success! Created namespace "vpn_bootstrap" with ID: abc123def456
```

**Save these values:**
```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"  # From Cloudflare dashboard
export CLOUDFLARE_API_TOKEN="your-api-token"    # Create API token with KV edit permissions
export CLOUDFLARE_KV_NAMESPACE_ID="abc123def456"  # From above command
```

### 2. Generate Encryption Keys

```bash
# Generate VPN encryption key
python3 << 'EOF'
from cryptography.fernet import Fernet
print(f"VPN_ENCRYPTION_KEY={Fernet.generate_key().decode()}")
EOF

# Generate certificate service secret
python3 -c "import secrets; print(f'CERT_SERVICE_SECRET={secrets.token_urlsafe(32)}')"
```

**Save these values** - you'll need them for all workers.

### 3. Build Worker Image

```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/universal-worker

# Build the worker image with VPN support
docker build -f Dockerfile.optimized -t rma-worker:vpn-phase1 .
```

---

## Test 1: Single Worker Bootstrap (Lighthouse)

### Step 1.1: Start Coordinator (if needed)

```bash
# In a separate terminal
cd /home/user/CMACatalyst/RMA-Demo/services/local-coordinator
python3 -m uvicorn app:app --host 0.0.0.0 --port 8080
```

### Step 1.2: Create Environment File

Create `.env.lighthouse` with your actual values:

```bash
# .env.lighthouse
COORDINATOR_URL=http://localhost:8080
VPN_ENABLED=true
USE_TUNNEL=false  # Disable tunnels for local testing
DHT_ENABLED=true

# Cloudflare KV configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_KV_NAMESPACE_ID=your-namespace-id

# VPN security
VPN_ENCRYPTION_KEY=your-generated-encryption-key
CERT_SERVICE_SECRET=your-generated-cert-secret
```

### Step 1.3: Run First Worker (Lighthouse)

```bash
docker run --rm -it \
  --name vpn-lighthouse \
  --network host \
  --cap-add NET_ADMIN \
  --device /dev/net/tun \
  --env-file .env.lighthouse \
  rma-worker:vpn-phase1
```

### Step 1.4: Expected Output

Watch for these log messages:

```
🔐 VPN MESH INITIALIZATION
🔍 Checking if this is the first worker...
🌟 This is the FIRST worker - bootstrapping VPN network
Generating CA certificate: rma-demo-mesh
✅ CA certificate generated successfully
Generating worker certificate: lighthouse → 10.42.0.1/16
✅ Worker certificate generated: lighthouse
Starting Nebula daemon (lighthouse=True)
✅ Nebula started (PID: 1234)
✅ CA private key loaded for cert signing
🔐 Starting certificate signing service...
✅ Certificate signing service started on port 8444
✅ VPN network bootstrapped
   Lighthouse VPN IP: 10.42.0.1
   Network CIDR: 10.42.0.0/16
============================================================
✅ VPN MESH READY - IP: 10.42.0.1
============================================================
```

### Step 1.5: Verify VPN Interface

In another terminal:

```bash
# Check Nebula interface exists
docker exec vpn-lighthouse ip addr show nebula1

# Expected output:
# nebula1: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1300
#     inet 10.42.0.1/16 scope global nebula1
#     valid_lft forever preferred_lft forever

# Test VPN connectivity (ping self)
docker exec vpn-lighthouse ping -c 3 10.42.0.1
```

### Step 1.6: Verify Certificate Signing Service

```bash
# Test cert signing service health
docker exec vpn-lighthouse curl -s http://localhost:8444/health | jq .

# Expected output:
# {
#   "status": "healthy",
#   "service": "cert-signing",
#   "certs_signed": 0,
#   "uptime": 1702136400.0
# }
```

### Step 1.7: Verify KV Storage

```bash
# Check bootstrap config was stored in KV
wrangler kv:key get --namespace-id="$CLOUDFLARE_KV_NAMESPACE_ID" "vpn_bootstrap" | jq .

# Expected output (may be encrypted):
# {
#   "ca_crt": "-----BEGIN NEBULA CERTIFICATE-----...",
#   "lighthouse_public_ip": null,
#   "lighthouse_vpn_ip": "10.42.0.1",
#   "lighthouse_port": 4242,
#   "network_cidr": "10.42.0.0/16",
#   "created_at": 1702136400.0,
#   "next_worker_ip": 2,
#   "status": "active"
# }
```

---

## Test 2: Second Worker Joins VPN

### Step 2.1: Create Environment File for Worker 2

Create `.env.worker2`:

```bash
# .env.worker2
COORDINATOR_URL=http://localhost:8080
VPN_ENABLED=true
USE_TUNNEL=false
DHT_ENABLED=true

# Cloudflare KV configuration (same as lighthouse)
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_KV_NAMESPACE_ID=your-namespace-id

# VPN security (MUST match lighthouse)
VPN_ENCRYPTION_KEY=your-same-encryption-key
CERT_SERVICE_SECRET=your-same-cert-secret
```

### Step 2.2: Run Second Worker

```bash
# In a new terminal
docker run --rm -it \
  --name vpn-worker-2 \
  --network host \
  --cap-add NET_ADMIN \
  --device /dev/net/tun \
  --env-file .env.worker2 \
  rma-worker:vpn-phase1
```

### Step 2.3: Expected Output

```
🔐 VPN MESH INITIALIZATION
🔍 Checking if this is the first worker...
This is NOT the first worker
Joining existing VPN network...
Allocated VPN IP: 10.42.0.2
Requesting certificate from lighthouse at 10.42.0.1
✅ Received signed certificate from lighthouse
Starting Nebula daemon (lighthouse=False)
✅ Nebula started (PID: 5678)
✅ Joined VPN network
   Worker VPN IP: 10.42.0.2
============================================================
✅ VPN MESH READY - IP: 10.42.0.2
============================================================
```

### Step 2.4: Verify VPN Connectivity Between Workers

```bash
# From lighthouse, ping worker 2
docker exec vpn-lighthouse ping -c 3 10.42.0.2

# From worker 2, ping lighthouse
docker exec vpn-worker-2 ping -c 3 10.42.0.1

# Expected: All pings successful (0% packet loss)
```

### Step 2.5: Check Certificate Signing Stats

```bash
# Check how many certificates the lighthouse has signed
docker exec vpn-lighthouse curl -s http://localhost:8444/stats | jq .

# Expected output:
# {
#   "total_certs_signed": 1,
#   "recent_signings": 1,
#   "rate_limit_window": 60,
#   "max_certs_per_window": 10
# }
```

---

## Test 3: Third Worker Joins VPN

### Step 3.1: Run Third Worker

```bash
# Create .env.worker3 (same as .env.worker2)
cp .env.worker2 .env.worker3

# Run third worker
docker run --rm -it \
  --name vpn-worker-3 \
  --network host \
  --cap-add NET_ADMIN \
  --device /dev/net/tun \
  --env-file .env.worker3 \
  rma-worker:vpn-phase1
```

### Step 3.2: Verify Full Mesh Connectivity

```bash
# From lighthouse
docker exec vpn-lighthouse ping -c 2 10.42.0.2
docker exec vpn-lighthouse ping -c 2 10.42.0.3

# From worker 2
docker exec vpn-worker-2 ping -c 2 10.42.0.1
docker exec vpn-worker-2 ping -c 2 10.42.0.3

# From worker 3
docker exec vpn-worker-3 ping -c 2 10.42.0.1
docker exec vpn-worker-3 ping -c 2 10.42.0.2
```

**Expected:** All workers can ping all other workers (full mesh connectivity).

---

## Test 4: VPN Performance Testing

### Step 4.1: Latency Test

```bash
# Ping test (1000 packets)
docker exec vpn-worker-2 ping -c 1000 -i 0.01 10.42.0.1 | tail -n 5

# Expected latency:
# - Same host: 0.1-2ms
# - Same network: 1-10ms
# - Different networks: 20-50ms
```

### Step 4.2: Bandwidth Test (Optional)

```bash
# Install iperf3 in containers if needed
docker exec vpn-lighthouse apt-get update && apt-get install -y iperf3

# Start server on lighthouse
docker exec vpn-lighthouse iperf3 -s &

# Test from worker 2
docker exec vpn-worker-2 apt-get update && apt-get install -y iperf3
docker exec vpn-worker-2 iperf3 -c 10.42.0.1 -t 10

# Expected throughput:
# - Same host: 10+ Gbps
# - Same network: 100+ Mbps
# - Different networks: Depends on internet connection
```

---

## Troubleshooting

### Issue: Worker Can't Join VPN

**Symptom:** Worker logs show "Failed to get certificate from lighthouse"

**Possible Causes:**
1. **Cert service not running on lighthouse**
   ```bash
   docker exec vpn-lighthouse curl http://localhost:8444/health
   # If fails, check lighthouse logs for cert service startup
   ```

2. **Wrong CERT_SERVICE_SECRET**
   - Verify all workers use the same secret
   - Check env vars: `docker exec vpn-worker-2 env | grep CERT_SERVICE_SECRET`

3. **Network connectivity issue**
   - Check if worker can reach lighthouse (before VPN)
   - May need lighthouse public IP if workers on different networks

**Solution:**
```bash
# Restart lighthouse with verbose logging
docker logs vpn-lighthouse | grep -i "cert.*sign"

# Ensure lighthouse has public IP if workers are remote
# Or use EDGE_ROUTER_URL to proxy cert requests
```

### Issue: VPN Interface Not Created

**Symptom:** `ip addr show nebula1` shows "Device not found"

**Possible Causes:**
1. **Missing NET_ADMIN capability**
   ```bash
   # Ensure you're running with --cap-add NET_ADMIN
   ```

2. **Missing /dev/net/tun device**
   ```bash
   # Ensure you're running with --device /dev/net/tun
   ```

3. **Nebula process died**
   ```bash
   # Check if Nebula is running
   docker exec vpn-lighthouse ps aux | grep nebula
   ```

**Solution:**
```bash
# Check Nebula logs
docker exec vpn-lighthouse cat /tmp/nebula/*/nebula.log

# Ensure proper Docker run command with network privileges
```

### Issue: KV Access Denied

**Symptom:** "Failed to store bootstrap config in KV"

**Possible Causes:**
1. **Invalid API token**
   - Token needs "Workers KV Storage:Edit" permission

2. **Wrong namespace ID**
   - Verify with: `wrangler kv:namespace list`

3. **Rate limits exceeded**
   - Free tier: 1000 writes/day
   - Check usage: `wrangler kv:key list --namespace-id=$CLOUDFLARE_KV_NAMESPACE_ID`

**Solution:**
```bash
# Test KV access manually
wrangler kv:key put --namespace-id="$CLOUDFLARE_KV_NAMESPACE_ID" "test" "value"
wrangler kv:key get --namespace-id="$CLOUDFLARE_KV_NAMESPACE_ID" "test"
```

---

## Validation Checklist

After completing all tests, verify:

- [ ] **Lighthouse bootstrapped successfully**
  - VPN IP: 10.42.0.1
  - Cert service running on port 8444
  - CA certificate generated and stored

- [ ] **Workers joined VPN**
  - Each worker has unique VPN IP (10.42.0.2, 10.42.0.3, etc.)
  - All workers received signed certificates
  - No certificate signing errors

- [ ] **Full mesh connectivity**
  - All workers can ping all other workers
  - Latency < 50ms (for local networks)
  - 0% packet loss

- [ ] **Cloudflare KV**
  - Bootstrap config stored
  - next_worker_ip increments correctly
  - Entry points registered (if applicable)

- [ ] **Certificate signing service**
  - Cert service stats show signed certs
  - Health endpoint responds
  - Rate limiting works (try signing 11+ certs rapidly)

---

## Next Steps After Successful Testing

Once Phase 1 testing is complete:

1. **Phase 2: DHT Request Routing**
   - Implement `dht/router.py` for request forwarding
   - Workers forward requests via DHT
   - Test service-to-service communication over VPN

2. **Phase 3: Frontend Integration**
   - Entry point discovery API
   - Frontend connects to any entry point worker
   - Test end-to-end request flow

3. **Production Hardening**
   - Multi-lighthouse HA
   - Certificate rotation
   - Monitoring and alerting
   - Load testing (100+ workers)

---

## Cleanup

When done testing:

```bash
# Stop all workers
docker stop vpn-lighthouse vpn-worker-2 vpn-worker-3

# Clean up KV (optional - will break existing VPN)
wrangler kv:key delete --namespace-id="$CLOUDFLARE_KV_NAMESPACE_ID" "vpn_bootstrap"
wrangler kv:key delete --namespace-id="$CLOUDFLARE_KV_NAMESPACE_ID" "entry_points"

# Remove test images (optional)
docker rmi rma-worker:vpn-phase1
```

---

## Success Criteria

✅ **Phase 1 is successful if:**

1. Lighthouse boots, generates CA, starts cert service
2. 3+ workers successfully join VPN
3. All workers can communicate via VPN (ping test)
4. Certificate signing service signs all worker certs
5. VPN IPs allocated sequentially (10.42.0.1, 10.42.0.2, ...)
6. No errors or warnings in logs
7. Cloudflare KV usage < 100 writes total

**If all criteria met:** ✅ **Phase 1 COMPLETE - Ready for Phase 2!**

---

**Testing Time Estimate:** 30-45 minutes
**Prerequisites Setup:** 15-20 minutes
**Total:** ~1 hour for complete Phase 1 validation
