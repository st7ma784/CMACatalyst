/**
 * Cloudflare Worker - RMA Gateway
 *
 * Simple gateway that forwards all requests to the coordinator.
 * The coordinator handles service discovery and routing to workers.
 *
 * Architecture:
 *   Frontend → CF Worker (this) → Coordinator → Workers
 *
 * Free Tier Compatible: Yes (100k requests/day)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Get coordinator URL from environment
    const COORDINATOR_URL = env.COORDINATOR_URL;

    if (!COORDINATOR_URL) {
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          message: 'COORDINATOR_URL not set'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Build target URL
    const targetUrl = `${COORDINATOR_URL}${url.pathname}${url.search}`;

    // Forward request to coordinator
    try {
      const modifiedRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow'
      });

      const response = await fetch(modifiedRequest);

      // Clone response and add/modify headers
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });

      // Ensure CORS headers are present
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      // Add gateway header for debugging
      newResponse.headers.set('X-Gateway', 'RMA-Cloudflare-Worker');

      return newResponse;

    } catch (error) {
      // Gateway error - coordinator unreachable
      return new Response(
        JSON.stringify({
          error: 'Gateway error',
          message: 'Unable to reach coordinator',
          details: error.message,
          coordinator_url: COORDINATOR_URL
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};
