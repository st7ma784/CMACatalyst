'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Users,
  Trophy,
  Medal,
  Award,
  Network
} from 'lucide-react'

const COORDINATOR_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.rmatool.org.uk'

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
  by_tier?: {
    '1': number
    '2': number
    '3': number
    '4': number
  }
  workers_by_tier?: {
    gpu_workers: number
    service_workers: number
    data_workers: number
    edge_workers: number
  }
  average_load_by_tier?: {
    gpu_workers: number
    service_workers: number
    data_workers: number
    edge_workers: number
  }
  total_tasks_completed?: number
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

  // Helper functions to handle both old and new API response formats
  const getWorkersByTier = (tier: number): number => {
    if (!stats) return 0
    if (stats.by_tier) {
      return stats.by_tier[tier.toString() as '1' | '2' | '3' | '4'] || 0
    }
    if (stats.workers_by_tier) {
      const key = tier === 1 ? 'gpu_workers' : tier === 2 ? 'service_workers' : tier === 3 ? 'data_workers' : 'edge_workers'
      return stats.workers_by_tier[key] || 0
    }
    return 0
  }

  const getAverageLoad = (tier: number): number => {
    if (!stats?.average_load_by_tier) return 0
    const key = tier === 1 ? 'gpu_workers' : tier === 2 ? 'service_workers' : tier === 3 ? 'data_workers' : 'edge_workers'
    return stats.average_load_by_tier[key] || 0
  }

  const fetchSystemData = async () => {
    try {
      const [workersRes, statsRes] = await Promise.all([
        fetch(`${COORDINATOR_URL}/api/admin/workers`),
        fetch(`${COORDINATOR_URL}/api/admin/stats`)
      ])

      if (!workersRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch system data')
      }

      const workersData = await workersRes.json()
      const statsData = await statsRes.json()

      // API returns array directly
      const workersArray = Array.isArray(workersData) ? workersData : []
      setWorkers(workersArray)
      setStats(statsData)
      
      // Derive health from workers and stats
      const healthyCount = workersArray.filter(w => w.status === 'healthy').length
      const degradedCount = workersArray.filter(w => w.status === 'degraded').length
      const offlineCount = workersArray.filter(w => w.status === 'offline').length
      
      setHealth({
        overall_status: workersArray.length === 0 ? 'error' : 
                       healthyCount === workersArray.length ? 'healthy' : 'degraded',
        workers_by_status: {
          healthy: healthyCount,
          degraded: degradedCount,
          offline: offlineCount
        },
        has_minimum_workers: {
          gpu_workers: (statsData?.by_tier?.['1'] || 0) > 0,
          service_workers: (statsData?.by_tier?.['2'] || 0) > 0
        }
      })
      
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
      case 4:
        return <Network className="h-4 w-4" />
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
      case 4:
        return 'Edge Worker'
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
                  {getWorkersByTier(1)}
                </div>
                <div className="text-xs text-gray-500">
                  {(getAverageLoad(1) * 100).toFixed(0)}% avg load
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-sm font-medium">Tier 1: GPU Workers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {getWorkersByTier(1)}
            </div>
            <p className="text-xs text-gray-600 mt-1">vLLM, Vision Models</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Average Load</span>
                <span className="font-semibold">
                  {(getAverageLoad(1) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getLoadBarColor(
                    getAverageLoad(1)
                  )}`}
                  style={{ width: `${(getAverageLoad(1) * 100)}%` }}
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
              {getWorkersByTier(2)}
            </div>
            <p className="text-xs text-gray-600 mt-1">RAG, Notes, NER</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Average Load</span>
                <span className="font-semibold">
                  {(getAverageLoad(2) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getLoadBarColor(
                    getAverageLoad(2)
                  )}`}
                  style={{
                    width: `${(getAverageLoad(2) * 100)}%`
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
              {getWorkersByTier(3)}
            </div>
            <p className="text-xs text-gray-600 mt-1">PostgreSQL, Neo4j, Redis</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Average Load</span>
                <span className="font-semibold">
                  {(getAverageLoad(3) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getLoadBarColor(
                    getAverageLoad(3)
                  )}`}
                  style={{ width: `${(getAverageLoad(3) * 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-sm font-medium">Tier 4: Edge Workers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">
              {getWorkersByTier(4)}
            </div>
            <p className="text-xs text-gray-600 mt-1">Coordinator, Proxy, LB</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Average Load</span>
                <span className="font-semibold">
                  {(getAverageLoad(4) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getLoadBarColor(
                    getAverageLoad(4)
                  )}`}
                  style={{ width: `${(getAverageLoad(4) * 100)}%` }}
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
                                worker.current_load || 0
                              )}`}
                              style={{ width: `${(worker.current_load || 0) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {((worker.current_load || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {worker.assigned_containers && worker.assigned_containers.length > 0 ? (
                            worker.assigned_containers.map((container, i) => (
                              <div key={i} className="text-xs text-gray-600">
                                {container.replace('rma-', '').replace('-worker', '')}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-600 space-y-1">
                          {worker.capabilities?.gpu_type && (
                            <div>{worker.capabilities.gpu_type}</div>
                          )}
                          <div>{worker.capabilities?.cpu_cores || 0} cores</div>
                          <div>{worker.capabilities?.ram || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold">{worker.tasks_completed || 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Worker Leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Worker Leaderboard
              </CardTitle>
              <CardDescription>
                Top contributors by donated compute resources
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No workers available</p>
              <p className="text-sm mt-2">Deploy a worker to contribute compute resources!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workers
                .map(worker => {
                  // Calculate uptime in hours
                  const registeredTime = new Date(worker.registered_at).getTime()
                  const now = Date.now()
                  const uptimeHours = (now - registeredTime) / (1000 * 60 * 60)
                  
                  // Calculate contribution score (weighted by tier)
                  // Tier 1 (GPU) = 3x, Tier 4 (Edge) = 2.5x, Tier 2 (CPU) = 2x, Tier 3 (Storage) = 1x
                  const tierWeight = worker.tier === 1 ? 3 : worker.tier === 4 ? 2.5 : worker.tier === 2 ? 2 : 1
                  const contributionScore = (worker.tasks_completed || 0) * tierWeight + uptimeHours
                  
                  return {
                    ...worker,
                    uptimeHours,
                    contributionScore
                  }
                })
                .sort((a, b) => b.contributionScore - a.contributionScore)
                .slice(0, 10) // Top 10
                .map((worker, index) => {
                  const isTop3 = index < 3
                  const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`
                  
                  return (
                    <div
                      key={worker.worker_id}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                        isTop3
                          ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300 shadow-sm'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-2xl font-bold min-w-[3rem] text-center">
                          {rankBadge}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-semibold bg-white px-2 py-1 rounded border">
                              {worker.worker_id}
                            </code>
                            <div className="flex items-center gap-1">
                              {getTierIcon(worker.tier)}
                              <span className="text-xs text-gray-600">{getTierLabel(worker.tier)}</span>
                            </div>
                            <Badge className={getStatusBadgeColor(worker.status)}>
                              {worker.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              <span>{worker.tasks_completed || 0} tasks</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              <span>{worker.uptimeHours.toFixed(1)}h uptime</span>
                            </div>
                            {worker.capabilities?.gpu_type && (
                              <div className="flex items-center gap-1">
                                <Cpu className="h-3 w-3" />
                                <span>{worker.capabilities.gpu_type}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold text-gray-900">
                          {worker.contributionScore.toFixed(0)}
                        </div>
                        <div className="text-xs text-gray-500">contribution pts</div>
                      </div>
                    </div>
                  )
                })}
              
              {workers.length > 10 && (
                <div className="text-center pt-2">
                  <p className="text-xs text-gray-500">
                    Showing top 10 of {workers.length} workers
                  </p>
                </div>
              )}
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Award className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <strong>Contribution Score Formula:</strong> (Tasks × Tier Weight) + Uptime Hours
                    <br />
                    <span className="text-blue-600">
                      Tier Weights: GPU (3x) • CPU (2x) • Storage (1x)
                    </span>
                  </div>
                </div>
              </div>
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
