/**
 * Cloudflare Edge Router
 * Deployed at api.rmatool.org.uk
 * Routes workers to distributed edge coordinators
 * Uses Durable Objects for coordinator registry (free tier: 1K writes/day)
 */

export { CoordinatorRegistry } from './coordinator-registry';

// Main Edge Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Get Durable Object instance
    const id = env.COORDINATOR_REGISTRY.idFromName('global');
    const registry = env.COORDINATOR_REGISTRY.get(id);

    // Edge coordinator registration
    if (path === '/api/edge/register' && request.method === 'POST') {
      try {
        const data = await request.json();
        
        // Accept either format: {url, location} or {worker_type, role, tunnel_url}
        if (data.url || data.tunnel_url) {
          // Forward to Durable Object to store the registration
          const registerReq = new Request('http://internal/api/edge/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              worker_id: data.worker_id || `edge-${Date.now()}`,
              tunnel_url: data.url || data.tunnel_url,
              capabilities: {
                location: data.location || 'unknown'
              }
            })
          });
          const response = await registry.fetch(registerReq);
          return response;
        }
        
        return new Response(JSON.stringify({ 
          error: 'Invalid edge registration',
          required: 'Must provide "url" or "tunnel_url" field'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Registration failed',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Worker registration - route to best coordinator
    if (path === '/api/worker/register' && request.method === 'POST') {
      // Get available coordinators
      const coordinatorsReq = new Request('http://internal/coordinators', { method: 'GET' });
      const coordsResp = await registry.fetch(coordinatorsReq);
      const coordinators = await coordsResp.json();

      if (coordinators.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No coordinators available',
          message: 'Please start an edge coordinator first using: docker-compose -f edge-coordinator.yml up -d'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Select best coordinator (round-robin for now)
      const coordinator = coordinators[Math.floor(Math.random() * coordinators.length)];

      // Forward registration to coordinator
      const workerData = await request.json();
      const coordResponse = await fetch(`${coordinator.tunnel_url}/api/worker/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workerData)
      });

      return coordResponse;
    }

    // Service requests - route to appropriate worker
    if (path.startsWith('/api/service/')) {
      // Get coordinators
      const coordinatorsReq = new Request('http://internal/coordinators', { method: 'GET' });
      const coordsResp = await registry.fetch(coordinatorsReq);
      const coordinators = await coordsResp.json();

      if (coordinators.length === 0) {
        return new Response('No coordinators available', { status: 503 });
      }

      // Route to random coordinator (they'll handle the service lookup)
      const coordinator = coordinators[Math.floor(Math.random() * coordinators.length)];
      const serviceResponse = await fetch(`${coordinator.tunnel_url}${path}`, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      return serviceResponse;
    }

    // DHT Bootstrap endpoint
    if (path === '/api/dht/bootstrap' && request.method === 'GET') {
      try {
        // Get all healthy coordinators
        const coordinatorsReq = new Request('http://internal/coordinators', { method: 'GET' });
        const coordsResp = await registry.fetch(coordinatorsReq);
        const coordinators = await coordsResp.json();

        // Filter to DHT-enabled coordinators (have dht_port)
        const dhtSeeds = coordinators
          .filter(c => c.dht_port)
          .map(c => ({
            node_id: c.worker_id,
            tunnel_url: c.tunnel_url,
            dht_port: c.dht_port || 8468,
            location: c.location || 'unknown'
          }));

        return new Response(JSON.stringify({
          seeds: dhtSeeds,
          ttl: 300,  // Cache for 5 minutes
          count: dhtSeeds.length
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300'
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          error: 'DHT bootstrap failed',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Health check
    if (path === '/health') {
      const coordinatorsReq = new Request('http://internal/coordinators', { method: 'GET' });
      const coordsResp = await registry.fetch(coordinatorsReq);
      const coordinators = await coordsResp.json();

      return new Response(JSON.stringify({
        status: 'healthy',
        coordinators: coordinators.length,
        message: 'Edge router operational'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Admin dashboard - show registered coordinators
    if (path === '/api/admin/coordinators') {
      const coordinatorsReq = new Request('http://internal/coordinators', { method: 'GET' });
      const coordsResp = await registry.fetch(coordinatorsReq);
      return coordsResp;
    }

    return new Response('Not Found', { status: 404 });
  }
};
