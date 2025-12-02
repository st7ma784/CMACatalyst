# Cloudflare KV Write Optimization

## Problem

Cloudflare Workers KV free tier: **1,000 writes per day**

Previous implementation:
- Every heartbeat = 1 KV write
- Heartbeat interval: 30 seconds
- **Writes per worker per day**: 2,880
- **Result**: Hit limit with just 1 worker in 8 hours! ❌

## Solution

### Optimized Heartbeat Strategy

Only write to KV when:
1. **Status changes** (healthy → error)
2. **5+ minutes since last write**

This reduces writes by **10x**:
- Before: 2,880 writes/day per worker
- After: **288 writes/day per worker** ✅

### New Capacity

With optimization:
- **Free tier (1,000 writes/day)**: 3 workers
- **10 workers**: 2,880 writes/day (~$1/month)
- **100 workers**: 28,800 writes/day (~$10/month)

## Implementation

```javascript
// Only persist to KV every 5 minutes, not every 30 seconds
const shouldWrite = 
  worker.status !== (data.status || 'healthy') ||
  (currentTime - lastHeartbeatTime) > 5 * 60 * 1000;

if (shouldWrite) {
  await env.WORKERS.put(workerKey, JSON.stringify(worker));
}
```

## Trade-offs

### Pros ✅
- 10x reduction in KV writes
- Stay within free tier for 3 workers
- Still detect failures within 5 minutes
- Instant status change detection

### Cons ⚠️
- Last heartbeat timestamp may be up to 5 minutes stale in KV
- Still accurate for worker health (checked every 30s)
- Admin dashboard shows correct real-time data

## Alternative: Use Durable Objects

For even better performance with many workers:

```bash
# Migrate to Durable Objects (paid tier: $5/month)
# Benefits:
# - Unlimited reads/writes within DO
# - True in-memory state
# - Better for >10 workers
```

But for now, **optimized KV is perfect for your use case**!

## Monitoring

Check your KV usage:
```bash
# View KV operations in dashboard
https://dash.cloudflare.com/ → Workers & Pages → KV → Usage

# Current writes/day should be:
# ~288 × (number of workers) + ~10 registrations
```

## Cost Projection

| Workers | Writes/day | Cost/month |
|---------|------------|------------|
| 1-3     | <1,000     | $0         |
| 5       | 1,440      | ~$0.50     |
| 10      | 2,880      | ~$1.00     |
| 20      | 5,760      | ~$2.00     |
| 50      | 14,400     | ~$5.00     |

**You're now good for 3 workers on the free tier!** 🎉
