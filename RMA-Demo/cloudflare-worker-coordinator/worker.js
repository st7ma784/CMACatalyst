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

      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: error.message }, corsHeaders, 500);
    }
  },
};

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
