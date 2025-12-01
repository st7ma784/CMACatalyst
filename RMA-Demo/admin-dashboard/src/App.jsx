import { useState, useEffect } from 'react'

// Direct API endpoint (no proxy needed)
const API_BASE = 'https://rma-coordinator.fly.dev/api'

function App() {
  const [stats, setStats] = useState(null)
  const [workers, setWorkers] = useState([])
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, workersRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`),
        fetch(`${API_BASE}/admin/workers`),
        fetch(`${API_BASE}/admin/health`)
      ])

      if (!statsRes.ok || !workersRes.ok || !healthRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const statsData = await statsRes.json()
      const workersData = await workersRes.json()
      const healthData = await healthRes.json()

      setStats(statsData)
      setWorkers(workersData.workers || [])
      setHealth(healthData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error">
          Error loading dashboard: {error}
          <br />
          Make sure the coordinator service is running.
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="header">
        <h1>RMA Distributed System</h1>
        <p>Admin Dashboard - Real-time worker monitoring</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card healthy">
          <h3>Total Workers</h3>
          <div className="value">{stats?.total_workers || 0}</div>
          <div className="label">Active nodes</div>
        </div>

        <div className="stat-card healthy">
          <h3>Healthy Workers</h3>
          <div className="value">{stats?.healthy_workers || 0}</div>
          <div className="label">Online and responding</div>
        </div>

        <div className="stat-card">
          <h3>GPU Workers</h3>
          <div className="value">{stats?.workers_by_tier?.gpu_workers || 0}</div>
          <div className="label">Tier 1 (vLLM, Vision)</div>
        </div>

        <div className="stat-card">
          <h3>Service Workers</h3>
          <div className="value">{stats?.workers_by_tier?.service_workers || 0}</div>
          <div className="label">Tier 2 (RAG, NER, etc)</div>
        </div>

        <div className="stat-card">
          <h3>Data Workers</h3>
          <div className="value">{stats?.workers_by_tier?.data_workers || 0}</div>
          <div className="label">Tier 3 (Databases)</div>
        </div>

        <div className="stat-card">
          <h3>Tasks Completed</h3>
          <div className="value">{stats?.total_tasks_completed || 0}</div>
          <div className="label">All time</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className={`stat-card ${
          stats?.average_load_by_tier?.gpu_workers > 0.8 ? 'error' :
          stats?.average_load_by_tier?.gpu_workers > 0.5 ? 'warning' : 'healthy'
        }`}>
          <h3>GPU Average Load</h3>
          <div className="value">
            {((stats?.average_load_by_tier?.gpu_workers || 0) * 100).toFixed(0)}%
          </div>
          <div className="label">Tier 1 utilization</div>
        </div>

        <div className={`stat-card ${
          stats?.average_load_by_tier?.service_workers > 0.8 ? 'error' :
          stats?.average_load_by_tier?.service_workers > 0.5 ? 'warning' : 'healthy'
        }`}>
          <h3>Service Average Load</h3>
          <div className="value">
            {((stats?.average_load_by_tier?.service_workers || 0) * 100).toFixed(0)}%
          </div>
          <div className="label">Tier 2 utilization</div>
        </div>

        <div className={`stat-card ${
          health?.overall_status === 'healthy' ? 'healthy' :
          health?.overall_status === 'degraded' ? 'warning' : 'error'
        }`}>
          <h3>System Health</h3>
          <div className="value" style={{ fontSize: '1.5rem', textTransform: 'uppercase' }}>
            {health?.overall_status || 'Unknown'}
          </div>
          <div className="label">
            {health?.has_minimum_workers?.gpu_workers ? 'Has GPU' : 'No GPU'} | {' '}
            {health?.has_minimum_workers?.service_workers ? 'Has Services' : 'No Services'}
          </div>
        </div>
      </div>

      <div className="workers-section">
        <h2>Active Workers ({workers.length})</h2>

        {workers.length === 0 ? (
          <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>
            No workers registered yet. Start a worker using the worker agent.
          </p>
        ) : (
          <table className="workers-table">
            <thead>
              <tr>
                <th>Worker ID</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Load</th>
                <th>Containers</th>
                <th>Tasks</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(worker => (
                <tr key={worker.worker_id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {worker.worker_id}
                  </td>
                  <td>
                    <span className="tier-badge">
                      Tier {worker.tier}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${worker.status}`}>
                      {worker.status}
                    </span>
                  </td>
                  <td>
                    <div>
                      <div className="load-bar">
                        <div
                          className={`load-bar-fill ${
                            worker.current_load > 0.8 ? 'high' :
                            worker.current_load > 0.5 ? 'medium' : 'low'
                          }`}
                          style={{ width: `${worker.current_load * 100}%` }}
                        />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                        {(worker.current_load * 100).toFixed(0)}%
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.875rem' }}>
                      {worker.assigned_containers.map((c, i) => (
                        <div key={i} style={{ color: '#94a3b8' }}>
                          {c.replace('rma-', '').replace('-worker', '')}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {worker.tasks_completed}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(worker.registered_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="refresh-info">
        Auto-refreshing every 5 seconds | Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}

export default App
