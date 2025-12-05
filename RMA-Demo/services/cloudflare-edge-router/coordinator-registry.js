/**
 * Coordinator Registry (Durable Object)
 * Stores list of edge coordinators with their tunnel URLs
 * Free tier: 1M reads/day, 1K writes/day (plenty for 5-20 coordinators)
 */

export class CoordinatorRegistry {
  constructor(state, env) {
    this.state = state;
    this.coordinators = [];
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      // Load coordinators from persistent storage
      const stored = await this.state.storage.get('coordinators');
      this.coordinators = stored || [];
      this.initialized = true;
    }
  }

  async fetch(request) {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;

    // Register edge coordinator
    if (path === '/api/edge/register' && request.method === 'POST') {
      const data = await request.json();
      
      // Check if already registered
      const existing = this.coordinators.findIndex(c => c.worker_id === data.worker_id);
      
      if (existing >= 0) {
        // Update existing coordinator
        this.coordinators[existing] = {
          worker_id: data.worker_id,
          tunnel_url: data.tunnel_url,
          location: data.capabilities?.location || 'unknown',
          dht_port: data.dht_port || data.capabilities?.dht_port || 8468,
          registered_at: Date.now(),
          last_seen: Date.now()
        };
      } else {
        // Add new coordinator
        this.coordinators.push({
          worker_id: data.worker_id,
          tunnel_url: data.tunnel_url,
          location: data.capabilities?.location || 'unknown',
          dht_port: data.dht_port || data.capabilities?.dht_port || 8468,
          registered_at: Date.now(),
          last_seen: Date.now()
        });
      }

      // Persist to Durable Object storage
      await this.state.storage.put('coordinators', this.coordinators);

      console.log(`✅ Edge coordinator registered: ${data.tunnel_url}`);

      return new Response(JSON.stringify({
        status: 'registered',
        role: 'edge_coordinator',
        total_coordinators: this.coordinators.length,
        message: 'Coordinator registered successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get list of coordinators
    if (path === '/coordinators' || url.hostname === 'internal') {
      // Clean up stale coordinators (not seen in 5 minutes)
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      const activeCoordinators = this.coordinators.filter(c => {
        return (now - c.last_seen) < staleThreshold;
      });

      // Update if list changed
      if (activeCoordinators.length !== this.coordinators.length) {
        this.coordinators = activeCoordinators;
        await this.state.storage.put('coordinators', this.coordinators);
      }

      return new Response(JSON.stringify(this.coordinators), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Coordinator heartbeat (keep-alive)
    if (path === '/api/edge/heartbeat' && request.method === 'POST') {
      const data = await request.json();
      const coordinator = this.coordinators.find(c => c.worker_id === data.worker_id);
      
      if (coordinator) {
        coordinator.last_seen = Date.now();
        await this.state.storage.put('coordinators', this.coordinators);
        
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Coordinator not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}
