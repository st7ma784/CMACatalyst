# QR Code Network Access Configuration

## Overview

The RMA Dashboard QR code generator has been enhanced to automatically work on local networks, making it easy for clients to upload documents from their mobile devices even when the dashboard is hosted on a local server.

## How It Works

### Automatic IP Detection

When you generate a QR code, the system now:

1. **Checks the configured `APP_BASE_URL`** from environment variables
2. **Detects if using localhost** (`localhost` or `127.0.0.1`)
3. **Automatically discovers your machine's network IP** using Python's socket library
4. **Generates QR code with the network-accessible URL** instead of localhost

This means QR codes will work automatically when scanned by phones on the same network, without manual configuration.

### Example Behavior

**Before (wouldn't work from phones):**
```
QR Code URL: http://localhost:3000/client-upload/CLIENT001
❌ Mobile phones can't access "localhost"
```

**After (works from any device on network):**
```
QR Code URL: http://192.168.1.100:3000/client-upload/CLIENT001
✅ Mobile phones can access this IP on the local network
```

## Configuration Options

### Option 1: Auto-Detection (Default - Recommended)

Leave `APP_BASE_URL` as localhost in `.env`:

```bash
APP_BASE_URL=http://localhost:3000
```

The system will automatically detect and use your network IP for QR codes.

**Pros:**
- No manual configuration needed
- Works automatically
- Adapts to network changes

**Cons:**
- May detect wrong IP if multiple network interfaces
- Won't work across subnets/VLANs

### Option 2: Manual IP Configuration

Set specific IP address in `.env`:

```bash
APP_BASE_URL=http://192.168.1.100:3000
```

**Pros:**
- Full control over URL
- Works with complex network setups
- Predictable behavior

**Cons:**
- Must update if IP changes
- Requires knowing your IP address

### Option 3: Hostname Configuration

Use your machine's hostname in `.env`:

```bash
APP_BASE_URL=http://my-server.local:3000
```

**Pros:**
- Works even if IP changes
- Human-readable
- Good for networks with mDNS/Bonjour

**Cons:**
- Requires network supports .local resolution
- May not work on all client devices

## Finding Your Network IP

### Linux
```bash
hostname -I
# Or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### macOS
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Windows
```bash
ipconfig | findstr IPv4
```

## Testing QR Codes

1. **Generate a QR code** in the dashboard
2. **Check the logs** to see what URL was used:
   ```bash
   docker logs rma-upload-service --tail=20 | grep "Using detected IP"
   ```
3. **Scan with your phone** on the same WiFi network
4. **Verify you can access** the upload page

## Network Requirements

For QR codes to work, ensure:

1. **Same Network:** Phone and server on same WiFi/LAN
2. **Firewall:** Port 3000 allowed (check with `sudo ufw allow 3000`)
3. **No VPN:** Client device not routing through VPN
4. **No Network Isolation:** Some routers isolate wireless clients

### Testing Network Access

From your phone's browser, manually visit:
```
http://YOUR_SERVER_IP:3000
```

If this works, QR codes will work too.

## Troubleshooting

### QR Code Still Shows localhost

**Check logs:**
```bash
docker logs rma-upload-service | grep QR
```

**Possible causes:**
- IP detection failed (check firewall/networking)
- APP_BASE_URL manually set to localhost
- Network interface misconfigured

**Solution:**
Manually set `APP_BASE_URL` in `.env` to your IP address.

### Phone Can't Access URL

**Check 1: Same Network**
```bash
# On server
ip addr show

# Compare with phone's WiFi settings
# Should be same subnet (e.g., 192.168.1.x)
```

**Check 2: Firewall**
```bash
# Allow port 3000
sudo ufw allow 3000/tcp

# Check firewall status
sudo ufw status
```

**Check 3: Service Running**
```bash
# Test from server
curl http://localhost:3000

# Test from another computer on network
curl http://YOUR_IP:3000
```

### Wrong IP Detected

If your machine has multiple network interfaces (ethernet, WiFi, VPN), it might detect the wrong one.

**Solution:** Manually set the correct IP in `.env`:

```bash
# Find all IPs
hostname -I

# Set the correct one
APP_BASE_URL=http://192.168.1.100:3000
```

**Restart upload service:**
```bash
docker compose -f docker-compose.local-parsing.yml restart upload-service
```

## Production Deployment

### For Domain Names

If you have a domain (e.g., `rma.yourorg.co.uk`):

```bash
APP_BASE_URL=https://rma.yourorg.co.uk
```

QR codes will use HTTPS and the full domain.

### For AWS/Cloud Deployment

```bash
APP_BASE_URL=https://your-loadbalancer.region.elb.amazonaws.com
```

Or with custom domain:
```bash
APP_BASE_URL=https://rma-demo.yourcompany.com
```

## Security Considerations

### Local Network Only (Default)

- QR codes only work on local network
- No internet exposure
- Client uploads stay within organization
- ✅ Good for privacy and GDPR compliance

### Public Access (Production)

If you make the dashboard publicly accessible:

1. **Use HTTPS** (required for security)
2. **Enable authentication** on client upload (currently public by design)
3. **Rate limiting** to prevent abuse
4. **Consider IP whitelisting** for upload endpoints

## Code Implementation

The auto-detection logic in `/services/upload-service/app.py`:

```python
# If using localhost, try to detect actual host IP
if 'localhost' in base_url or '127.0.0.1' in base_url:
    try:
        import socket
        hostname = socket.gethostname()
        ip_address = socket.gethostbyname(hostname)
        
        # Only replace if we got a real IP
        if ip_address and ip_address != '127.0.0.1':
            port_match = re.search(r':(\d+)', base_url)
            port = f":{port_match.group(1)}" if port_match else ':3000'
            base_url = f"http://{ip_address}{port}"
            logger.info(f"Using detected IP for QR code: {base_url}")
    except Exception as e:
        logger.warning(f"Could not detect network IP: {e}")
```

## Best Practices

1. **Test QR codes** before giving them to clients
2. **Use static IP** for production deployments
3. **Document the URL** in case QR code doesn't work
4. **Provide alternative** upload method (email, in-person)
5. **Monitor logs** for QR code generation issues

## Summary

✅ **Automatic:** Works out-of-the-box on local networks
✅ **Flexible:** Can override with manual configuration
✅ **Logged:** Check logs to see what URL was used
✅ **Tested:** Logs confirm IP detection

For most users, no configuration is needed—just generate QR codes and they'll work on your local network!
