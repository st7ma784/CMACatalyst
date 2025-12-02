/**
 * RMA Coordinator as a Cloudflare Worker
 * Production-ready with KV storage for worker persistence
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Routes
    try {
      if (path === '/health') {
        return jsonResponse({ status: 'healthy', edge: true }, corsHeaders);
      }

      // Authentication routes
      if (path === '/api/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env, corsHeaders);
      }

      if (path === '/api/auth/verify' && request.method === 'POST') {
        return await handleVerifyToken(request, env, corsHeaders);
      }

      if (path === '/api/worker/register' && request.method === 'POST') {
        return await handleWorkerRegister(request, env, corsHeaders);
      }

      if (path === '/api/worker/heartbeat' && request.method === 'POST') {
        return await handleHeartbeat(request, env, corsHeaders);
      }

      if (path.startsWith('/api/worker/unregister/') && request.method === 'DELETE') {
        const workerId = path.split('/').pop();
        return await handleUnregister(workerId, env, corsHeaders);
      }

      if (path === '/api/admin/workers' && request.method === 'GET') {
        return await handleListWorkers(env, corsHeaders);
      }

      if (path === '/api/admin/stats' && request.method === 'GET') {
        return await handleStats(env, corsHeaders);
      }

      if (path === '/api/admin/health' && request.method === 'GET') {
        return jsonResponse({ 
          status: 'healthy',
          coordinator: 'cloudflare-worker',
          timestamp: new Date().toISOString()
        }, corsHeaders);
      }

      // Service proxy routes - route to worker services
      if (path.startsWith('/api/service/')) {
        return await handleServiceProxy(path, request, env, corsHeaders);
      }

      // Legacy direct service routes (for backward compatibility)
      if (path.startsWith('/clients') || path.startsWith('/uploads/')) {
        return await handleServiceProxy('/api/service/upload' + path, request, env, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: error.message }, corsHeaders, 500);
    }
  },
};

// Authentication handlers
async function handleLogin(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { username, password } = data;

    // Simple authentication (in production, use proper hashing)
    // Default credentials: admin/admin123
    if (username === 'admin' && password === 'admin123') {
      // Create a simple token (in production, use JWT)
      const token = btoa(`${username}:${Date.now()}`);
      
      return jsonResponse({
        access_token: token,
        token_type: 'bearer',
        user: {
          username: username,
          role: 'admin'
        }
      }, corsHeaders);
    }

    return jsonResponse({ 
      error: 'Invalid credentials' 
    }, corsHeaders, 401);
  } catch (error) {
    return jsonResponse({ 
      error: 'Invalid request' 
    }, corsHeaders, 400);
  }
}

async function handleVerifyToken(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { token } = data;

    // Simple token verification (in production, verify JWT)
    if (token && token.length > 0) {
      try {
        const decoded = atob(token);
        const [username] = decoded.split(':');
        
        return jsonResponse({
          valid: true,
          user: {
            username: username,
            role: 'admin'
          }
        }, corsHeaders);
      } catch {
        return jsonResponse({ 
          valid: false,
          error: 'Invalid token' 
        }, corsHeaders, 401);
      }
    }

    return jsonResponse({ 
      valid: false,
      error: 'No token provided' 
    }, corsHeaders, 401);
  } catch (error) {
    return jsonResponse({ 
      valid: false,
      error: 'Invalid request' 
    }, corsHeaders, 400);
  }
}

async function handleWorkerRegister(request, env, corsHeaders) {
  const data = await request.json();
  const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const worker = {
    worker_id: workerId,
    tier: determineTier(data.capabilities),
    status: 'healthy',
    registered_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
    capabilities: data.capabilities,
    ip_address: data.ip_address,
    tunnel_url: data.tunnel_url,
  };

  // Store in KV
  await env.WORKERS.put(`worker:${workerId}`, JSON.stringify(worker));

  // Add to worker list
  const workerIds = await getWorkerIds(env);
  workerIds.push(workerId);
  await env.WORKERS.put('worker_ids', JSON.stringify(workerIds));

  return jsonResponse({
    worker_id: workerId,
    tier: worker.tier,
    heartbeat_interval: 30,
  }, corsHeaders);
}

async function handleHeartbeat(request, env, corsHeaders) {
  const data = await request.json();
  const workerKey = `worker:${data.worker_id}`;
  const workerData = await env.WORKERS.get(workerKey);

  if (!workerData) {
    return jsonResponse({ error: 'Worker not found' }, corsHeaders, 404);
  }

  const worker = JSON.parse(workerData);
  worker.last_heartbeat = new Date().toISOString();
  worker.status = data.status || 'healthy';
  worker.current_load = data.current_load;
  worker.available_memory = data.available_memory;

  await env.WORKERS.put(workerKey, JSON.stringify(worker));

  return jsonResponse({ status: 'ok' }, corsHeaders);
}

async function handleUnregister(workerId, env, corsHeaders) {
  const workerKey = `worker:${workerId}`;

  // Remove worker data
  await env.WORKERS.delete(workerKey);

  // Remove from worker list
  const workerIds = await getWorkerIds(env);
  const filteredIds = workerIds.filter(id => id !== workerId);
  await env.WORKERS.put('worker_ids', JSON.stringify(filteredIds));

  return jsonResponse({ status: 'ok' }, corsHeaders);
}

async function handleListWorkers(env, corsHeaders) {
  const now = new Date();
  const workerIds = await getWorkerIds(env);
  const workers = [];

  for (const workerId of workerIds) {
    const workerData = await env.WORKERS.get(`worker:${workerId}`);
    if (workerData) {
      const worker = JSON.parse(workerData);
      const lastHeartbeat = new Date(worker.last_heartbeat);
      const ageSeconds = (now - lastHeartbeat) / 1000;

      workers.push({
        ...worker,
        status: ageSeconds > 90 ? 'offline' : worker.status,
      });
    }
  }

  return jsonResponse(workers, corsHeaders);
}

async function handleStats(env, corsHeaders) {
  const now = new Date();
  const workerIds = await getWorkerIds(env);

  const stats = {
    total_workers: workerIds.length,
    healthy_workers: 0,
    offline_workers: 0,
    by_tier: { 1: 0, 2: 0, 3: 0 },
  };

  for (const workerId of workerIds) {
    const workerData = await env.WORKERS.get(`worker:${workerId}`);
    if (workerData) {
      const worker = JSON.parse(workerData);
      const lastHeartbeat = new Date(worker.last_heartbeat);
      const ageSeconds = (now - lastHeartbeat) / 1000;
      const status = ageSeconds > 90 ? 'offline' : worker.status;

      if (status === 'healthy') stats.healthy_workers++;
      if (status === 'offline') stats.offline_workers++;
      stats.by_tier[worker.tier] = (stats.by_tier[worker.tier] || 0) + 1;
    }
  }

  return jsonResponse(stats, corsHeaders);
}

async function getWorkerIds(env) {
  const idsData = await env.WORKERS.get('worker_ids');
  return idsData ? JSON.parse(idsData) : [];
}

async function handleServiceProxy(path, request, env, corsHeaders) {
  // Extract service name from path: /api/service/upload/... or /api/service/rag/...
  const pathParts = path.split('/').filter(Boolean);
  
  if (pathParts.length < 3) {
    return jsonResponse({ error: 'Invalid service path' }, corsHeaders, 400);
  }

  const serviceName = pathParts[2]; // 'upload', 'rag', 'notes', etc.
  const servicePath = '/' + pathParts.slice(3).join('/');

  // Get all workers
  const workerIds = await getWorkerIds(env);
  let targetWorker = null;

  // Find a healthy worker with a tunnel URL
  for (const workerId of workerIds) {
    const workerData = await env.WORKERS.get(`worker:${workerId}`);
    if (workerData) {
      const worker = JSON.parse(workerData);
      const lastHeartbeat = new Date(worker.last_heartbeat);
      const ageSeconds = (new Date() - lastHeartbeat) / 1000;
      
      if (ageSeconds <= 90 && worker.tunnel_url) {
        targetWorker = worker;
        break;
      }
    }
  }

  if (!targetWorker) {
    return jsonResponse({ 
      error: 'No healthy workers available',
      service: serviceName
    }, corsHeaders, 503);
  }

  // Proxy the request to the worker's tunnel URL
  const targetUrl = `${targetWorker.tunnel_url}${servicePath}${request.url.includes('?') ? '?' + request.url.split('?')[1] : ''}`;

  try {
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
    });

    const response = await fetch(proxyRequest);
    
    // Return the proxied response with CORS headers
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return jsonResponse({ 
      error: 'Service proxy failed',
      message: error.message,
      service: serviceName,
      worker: targetWorker.worker_id
    }, corsHeaders, 502);
  }
}

function determineTier(capabilities) {
  if (capabilities.gpu_memory || capabilities.gpu_type) return 1;
  if (capabilities.cpu_cores >= 4) return 2;
  return 3;
}

function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
