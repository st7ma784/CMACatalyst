'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  Server,
  Cpu,
  Database,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Users
} from 'lucide-react'

const COORDINATOR_URL = process.env.NEXT_PUBLIC_COORDINATOR_URL || 'http://localhost:8080'

interface Worker {
  worker_id: string
  tier: number
  status: 'healthy' | 'degraded' | 'offline'
  current_load: number
  tasks_completed: number
  assigned_containers: string[]
  last_heartbeat: string
  registered_at: string
  capabilities: {
    gpu_memory?: string
    gpu_type?: string
    cpu_cores: number
    ram: string
  }
}

interface SystemStats {
  total_workers: number
  healthy_workers: number
  workers_by_tier: {
    gpu_workers: number
    service_workers: number
    data_workers: number
  }
  average_load_by_tier: {
    gpu_workers: number
    service_workers: number
    data_workers: number
  }
  total_tasks_completed: number
}

interface SystemHealth {
  overall_status: 'healthy' | 'degraded' | 'error'
  workers_by_status: {
    healthy: number
    degraded: number
    offline: number
  }
  has_minimum_workers: {
    gpu_workers: boolean
    service_workers: boolean
  }
}

export default function SystemOrchestrator() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchSystemData = async () => {
    try {
      const [workersRes, statsRes, healthRes] = await Promise.all([
        fetch(`${COORDINATOR_URL}/api/admin/workers`),
        fetch(`${COORDINATOR_URL}/api/admin/stats`),
        fetch(`${COORDINATOR_URL}/api/admin/health`)
      ])

      if (!workersRes.ok || !statsRes.ok || !healthRes.ok) {
        throw new Error('Failed to fetch system data')
      }

      const workersData = await workersRes.json()
      const statsData = await statsRes.json()
      const healthData = await healthRes.json()

      setWorkers(workersData.workers || [])
      setStats(statsData)
      setHealth(healthData)
      setError(null)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSystemData()
    const interval = setInterval(fetchSystemData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800'
      case 'offline':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTierIcon = (tier: number) => {
    switch (tier) {
      case 1:
        return <Cpu className="h-4 w-4" />
      case 2:
        return <Server className="h-4 w-4" />
      case 3:
        return <Database className="h-4 w-4" />
      default:
        return null
    }
  }

  const getTierLabel = (tier: number) => {
    switch (tier) {
      case 1:
        return 'GPU Worker'
      case 2:
        return 'Service Worker'
      case 3:
        return 'Data Worker'
      default:
        return 'Unknown'
    }
  }

  const getLoadBarColor = (load: number) => {
    if (load > 0.8) return 'bg-red-500'
    if (load > 0.5) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading system status...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="h-5 w-5 text-red-600" />
          <h3 className="font-semibold text-red-900">Connection Error</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <p className="text-sm text-red-600 mb-4">
          Make sure the coordinator service is running at: <code className="bg-red-100 px-2 py-1 rounded">{COORDINATOR_URL}</code>
        </p>
        <Button onClick={fetchSystemData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Orchestrator</h2>
          <p className="text-sm text-gray-600 mt-1">
            Distributed worker pool monitoring and management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
          <Button onClick={fetchSystemData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {health?.overall_status === 'healthy' ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : health?.overall_status === 'degraded' ? (
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <span className="text-2xl font-bold capitalize">
                {health?.overall_status || 'Unknown'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{stats?.total_workers || 0}</div>
                <div className="text-xs text-gray-500">
                  {stats?.healthy_workers || 0} healthy
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">GPU Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Cpu className="h-8 w-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">
                  {stats?.workers_by_tier?.gpu_workers || 0}
                </div>
                <div className="text-xs text-gray-500">
                  {((stats?.average_load_by_tier?.gpu_workers || 0) * 100).toFixed(0)}% avg load
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tasks Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="text-2xl font-bold">{stats?.total_tasks_completed || 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Worker Tier Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-sm font-medium">Tier 1: GPU Workers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {stats?.workers_by_tier?.gpu_workers || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">vLLM, Vision Models</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Average Load</span>
                <span className="font-semibold">
                  {((stats?.average_load_by_tier?.gpu_workers || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getLoadBarColor(
                    stats?.average_load_by_tier?.gpu_workers || 0
                  )}`}
                  style={{ width: `${(stats?.average_load_by_tier?.gpu_workers || 0) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-medium">Tier 2: Service Workers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats?.workers_by_tier?.service_workers || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">RAG, Notes, NER</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Average Load</span>
                <span className="font-semibold">
                  {((stats?.average_load_by_tier?.service_workers || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getLoadBarColor(
                    stats?.average_load_by_tier?.service_workers || 0
                  )}`}
                  style={{
                    width: `${(stats?.average_load_by_tier?.service_workers || 0) * 100}%`
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              <CardTitle className="text-sm font-medium">Tier 3: Data Workers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats?.workers_by_tier?.data_workers || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">PostgreSQL, Neo4j, Redis</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Average Load</span>
                <span className="font-semibold">
                  {((stats?.average_load_by_tier?.data_workers || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getLoadBarColor(
                    stats?.average_load_by_tier?.data_workers || 0
                  )}`}
                  style={{ width: `${(stats?.average_load_by_tier?.data_workers || 0) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Workers ({workers.length})</CardTitle>
          <CardDescription>
            Real-time status of all registered worker nodes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <div className="text-center py-12">
              <Server className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">No workers registered yet</p>
              <p className="text-sm text-gray-500">
                Start a worker using the worker agent to see it appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Worker ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Tier
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Load
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Containers
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Hardware
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Tasks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((worker) => (
                    <tr key={worker.worker_id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {worker.worker_id}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getTierIcon(worker.tier)}
                          <span className="text-sm">{getTierLabel(worker.tier)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusBadgeColor(worker.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(worker.status)}
                            {worker.status}
                          </div>
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mb-1">
                            <div
                              className={`h-2 rounded-full ${getLoadBarColor(
                                worker.current_load
                              )}`}
                              style={{ width: `${worker.current_load * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {(worker.current_load * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {worker.assigned_containers.map((container, i) => (
                            <div key={i} className="text-xs text-gray-600">
                              {container.replace('rma-', '').replace('-worker', '')}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-600 space-y-1">
                          {worker.capabilities.gpu_type && (
                            <div>{worker.capabilities.gpu_type}</div>
                          )}
                          <div>{worker.capabilities.cpu_cores} cores</div>
                          <div>{worker.capabilities.ram} RAM</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold">{worker.tasks_completed}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Distributed System Active</h4>
            <p className="text-sm text-blue-700">
              Workers are automatically load-balanced across requests. Add more workers anytime
              to scale capacity.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Coordinator: <code className="bg-blue-100 px-2 py-0.5 rounded">{COORDINATOR_URL}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
