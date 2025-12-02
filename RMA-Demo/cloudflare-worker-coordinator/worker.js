/**
 * RMA Coordinator as a Cloudflare Worker
 * Production-ready with KV storage for worker persistence
 * Deployed via GitHub Actions
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

      if (path === '/api/admin/services' && request.method === 'GET') {
        return await handleListServices(env, corsHeaders);
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
    services: data.services || [],  // NEW: Service manifest
    ip_address: data.ip_address,
    tunnel_url: data.tunnel_url,
    is_heartbeat_leader: false,
  };

  // Store worker data
  await env.WORKERS.put(`worker:${workerId}`, JSON.stringify(worker));

  // Update service index for each service this worker provides
  for (const service of worker.services) {
    await addWorkerToService(env, service.name, workerId);
  }

  // Assign heartbeat leadership if needed and requested
  let assignedLeader = false;
  if (data.wants_heartbeat_leadership) {
    const currentLeader = await getHeartbeatLeader(env);
    if (!currentLeader) {
      worker.is_heartbeat_leader = true;
      assignedLeader = true;
      await env.WORKERS.put('heartbeat_leader', workerId);
      await env.WORKERS.put(`worker:${workerId}`, JSON.stringify(worker));
    }
  }

  // Add to worker list
  const workerIds = await getWorkerIds(env);
  workerIds.push(workerId);
  await env.WORKERS.put('worker_ids', JSON.stringify(workerIds));

  return jsonResponse({
    worker_id: workerId,
    tier: worker.tier,
    heartbeat_interval: 30,
    is_heartbeat_leader: assignedLeader,
    services_registered: worker.services.length,
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
  const now = new Date().toISOString();
  const lastHeartbeatTime = new Date(worker.last_heartbeat);
  const currentTime = new Date(now);
  
  // Only write to KV if:
  // 1. Status changed, OR
  // 2. More than 5 minutes since last write (reduces writes by 10x)
  const shouldWrite = 
    worker.status !== (data.status || 'healthy') ||
    (currentTime - lastHeartbeatTime) > 5 * 60 * 1000;

  // Always update in-memory data
  worker.last_heartbeat = now;
  worker.status = data.status || 'healthy';
  worker.current_load = data.current_load;
  worker.available_memory = data.available_memory;

  // Only persist to KV when necessary
  if (shouldWrite) {
    await env.WORKERS.put(workerKey, JSON.stringify(worker));
  }

  return jsonResponse({ status: 'ok' }, corsHeaders);
}

async function handleUnregister(workerId, env, corsHeaders) {
  const workerKey = `worker:${workerId}`;
  
  // Get worker data to find services before deletion
  const workerData = await env.WORKERS.get(workerKey);
  if (workerData) {
    const worker = JSON.parse(workerData);
    
    // Remove worker from each service index
    for (const service of worker.services || []) {
      await removeWorkerFromService(env, service.name, workerId);
    }
    
    // Clean up if was heartbeat leader
    if (worker.is_heartbeat_leader) {
      await env.WORKERS.delete('heartbeat_leader');
    }
  }

  // Remove worker data
  await env.WORKERS.delete(workerKey);

  // Remove from worker list
  const workerIds = await getWorkerIds(env);
  const filteredIds = workerIds.filter(id => id !== workerId);
  await env.WORKERS.put('worker_ids', JSON.stringify(filteredIds));

  return jsonResponse({ status: 'ok', message: 'Worker and services cleaned up' }, corsHeaders);
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

async function handleListServices(env, corsHeaders) {
  const serviceNames = await listAvailableServices(env);
  const serviceDetails = {};
  
  for (const serviceName of serviceNames) {
    const serviceKey = `service:${serviceName}`;
    const workersJson = await env.WORKERS.get(serviceKey);
    const workerIds = workersJson ? JSON.parse(workersJson) : [];
    
    // Count healthy workers
    let healthyCount = 0;
    const now = new Date();
    
    for (const workerId of workerIds) {
      const workerData = await env.WORKERS.get(`worker:${workerId}`);
      if (workerData) {
        const worker = JSON.parse(workerData);
        const ageSeconds = (now - new Date(worker.last_heartbeat)) / 1000;
        if (ageSeconds <= 90) {
          healthyCount++;
        }
      }
    }
    
    serviceDetails[serviceName] = {
      total_workers: workerIds.length,
      healthy_workers: healthyCount,
      status: healthyCount > 0 ? 'available' : 'unavailable'
    };
  }
  
  return jsonResponse({
    services: serviceDetails,
    total_services: serviceNames.length
  }, corsHeaders);
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

  // Get workers providing this service
  const serviceKey = `service:${serviceName}`;
  const workersJson = await env.WORKERS.get(serviceKey);
  
  if (!workersJson) {
    // Graceful fallback: list available services
    const availableServices = await listAvailableServices(env);
    return jsonResponse({ 
      error: `Service '${serviceName}' not available`,
      available_services: availableServices,
      suggestion: "Start a worker with this service enabled or choose from available services"
    }, corsHeaders, 503);
  }
  
  const workerIds = JSON.parse(workersJson);
  
  // Find healthy workers with tunnel URLs and track stale ones
  const healthyWorkers = [];
  const staleWorkers = [];
  const now = new Date();
  
  for (const workerId of workerIds) {
    const workerData = await env.WORKERS.get(`worker:${workerId}`);
    
    if (!workerData) {
      // Worker deleted but still in service index
      staleWorkers.push(workerId);
      continue;
    }
    
    const worker = JSON.parse(workerData);
    const lastHeartbeat = new Date(worker.last_heartbeat);
    const ageSeconds = (now - lastHeartbeat) / 1000;
    
    if (ageSeconds > 90) {
      // Worker is stale (no heartbeat in 90s)
      staleWorkers.push(workerId);
    } else if (worker.tunnel_url) {
      healthyWorkers.push(worker);
    }
  }
  
  // Cleanup stale workers from service index (async, non-blocking)
  if (staleWorkers.length > 0) {
    const cleanedWorkers = workerIds.filter(id => !staleWorkers.includes(id));
    if (cleanedWorkers.length > 0) {
      await env.WORKERS.put(serviceKey, JSON.stringify(cleanedWorkers));
    } else {
      // No healthy workers left, remove service entirely
      await env.WORKERS.delete(serviceKey);
    }
  }

  if (healthyWorkers.length === 0) {
    const availableServices = await listAvailableServices(env);
    return jsonResponse({ 
      error: `No healthy workers available for '${serviceName}'`,
      available_services: availableServices,
      suggestion: "All workers for this service are offline. Try again later or use an alternative service."
    }, corsHeaders, 503);
  }

  // Load balancing: random selection (could be enhanced with least-load)
  const targetWorker = healthyWorkers[Math.floor(Math.random() * healthyWorkers.length)];

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
    // Failover: try another worker if available
    if (healthyWorkers.length > 1) {
      return jsonResponse({ 
        error: 'Service temporarily unavailable, retry recommended',
        retry_after: 2,
        healthy_workers: healthyWorkers.length - 1
      }, corsHeaders, 503);
    }
    
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

// Service registry helpers
async function addWorkerToService(env, serviceName, workerId) {
  const serviceKey = `service:${serviceName}`;
  const workersJson = await env.WORKERS.get(serviceKey);
  const workers = workersJson ? JSON.parse(workersJson) : [];
  
  if (!workers.includes(workerId)) {
    workers.push(workerId);
    await env.WORKERS.put(serviceKey, JSON.stringify(workers));
  }
}

async function getHeartbeatLeader(env) {
  const leaderId = await env.WORKERS.get('heartbeat_leader');
  if (!leaderId) return null;
  
  const workerData = await env.WORKERS.get(`worker:${leaderId}`);
  if (!workerData) {
    await env.WORKERS.delete('heartbeat_leader');
    return null;
  }
  
  const worker = JSON.parse(workerData);
  const lastHeartbeat = new Date(worker.last_heartbeat);
  const ageSeconds = (new Date() - lastHeartbeat) / 1000;
  
  // Leader is stale (offline for >90s), remove
  if (ageSeconds > 90) {
    await env.WORKERS.delete('heartbeat_leader');
    return null;
  }
  
  return worker;
}

async function removeWorkerFromService(env, serviceName, workerId) {
  const serviceKey = `service:${serviceName}`;
  const workersJson = await env.WORKERS.get(serviceKey);
  
  if (workersJson) {
    const workers = JSON.parse(workersJson);
    const filtered = workers.filter(id => id !== workerId);
    
    if (filtered.length > 0) {
      await env.WORKERS.put(serviceKey, JSON.stringify(filtered));
    } else {
      // No more workers for this service, remove key
      await env.WORKERS.delete(serviceKey);
    }
  }
}

async function listAvailableServices(env) {
  const keys = await env.WORKERS.list({ prefix: 'service:' });
  return keys.keys.map(k => k.name.replace('service:', ''));
}
