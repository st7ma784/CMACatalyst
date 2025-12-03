'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  ArrowRight,
  Filter,
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  GitBranch,
  Info,
  Loader
} from 'lucide-react'

/**
 * Graph Visualization Component for Debt Advice
 *
 * Displays entity-relation-entity graphs extracted from debt manuals and client documents.
 * Shows transparent reasoning paths for advisor decision-making.
 *
 * Features:
 * - Interactive node visualization
 * - Filter by entity/relation type
 * - Show reasoning paths
 * - Export graph data
 * - Full-screen mode
 */

interface Entity {
  id: string
  type: string
  label: string
  properties: Record<string, any>
  source: string
  confidence: number
  description?: string
  examples?: string[]
}

interface Relation {
  id: string
  type: string
  source_entity_id: string
  target_entity_id: string
  label?: string
  confidence: number
  reasoning?: string
}

interface GraphData {
  id: string
  entities: Record<string, Entity>
  relations: Record<string, Relation>
  stats: {
    total_entities: number
    total_relations: number
    entity_types: Record<string, number>
    relation_types: Record<string, number>
    source_documents: string[]
  }
  created_at: string
  updated_at: string
}

interface GraphStats {
  total_entities: number
  total_relations: number
  entity_types: Record<string, number>
  relation_types: Record<string, number>
}

const ENTITY_COLORS: Record<string, string> = {
  condition: '#3b82f6',      // blue
  rule: '#8b5cf6',           // purple
  outcome: '#10b981',        // green
  threshold: '#f59e0b',      // amber
  process: '#6366f1',        // indigo
  criteria: '#ec4899',       // pink
  exception: '#ef4444',      // red
  action: '#14b8a6',         // teal
  journey: '#06b6d4',        // cyan
}

const RELATION_COLORS: Record<string, string> = {
  implies: '#3b82f6',
  leads_to: '#8b5cf6',
  requires: '#f59e0b',
  prevents: '#ef4444',
  contradicts: '#dc2626',
  equivalent: '#10b981',
  part_of: '#6366f1',
  alternative_to: '#ec4899',
  refines: '#14b8a6',
  triggers: '#06b6d4',
}

export default function DebtAdviceGraph() {
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullScreen, setFullScreen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [selectedRelation, setSelectedRelation] = useState<Relation | null>(null)
  const [filterEntityType, setFilterEntityType] = useState<string>('')
  const [filterRelationType, setFilterRelationType] = useState<string>('')
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const RAG_SERVICE_URL = process.env.NEXT_PUBLIC_RAG_SERVICE_URL || 'http://localhost:8102'

  /**
   * Fetch graph data (e.g., for current manual or client)
   */
  const fetchGraph = async (graphId?: string) => {
    setLoading(true)
    setError(null)

    try {
      // For now, use a sample graph ID
      // In production, this would be selected from UI
      const id = graphId || 'sample_dro_manual'

      const response = await fetch(`${RAG_SERVICE_URL}/api/graph/${id}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch graph: ${response.statusText}`)
      }

      const data = await response.json()
      setGraph(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Graph fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Build graph from uploaded documents or manuals
   */
  const buildGraph = async (textChunks: Array<{ text: string; chunk_id: string }>, sourceFiles: string[]) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${RAG_SERVICE_URL}/api/graph/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_chunks: textChunks,
          source_files: sourceFiles,
          document_type: 'manual',
          force_rebuild: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to build graph: ${response.statusText}`)
      }

      const data = await response.json()
      setGraph(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Graph build error:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Find reasoning paths through graph
   */
  const findPaths = async (startEntityId: string, targetType?: string) => {
    if (!graph) return

    try {
      const params = new URLSearchParams({
        start_entity_id: startEntityId,
        ...(targetType && { target_type: targetType }),
      })

      const response = await fetch(
        `${RAG_SERVICE_URL}/api/graph/${graph.id}/paths?${params}`
      )

      if (!response.ok) {
        throw new Error('Failed to find paths')
      }

      const data = await response.json()
      return data.path_labels
    } catch (err) {
      console.error('Path finding error:', err)
      return []
    }
  }

  /**
   * Get reasoning trail for a decision
   */
  const getReasoningTrail = async (question: string, clientValues: Record<string, any>) => {
    if (!graph) return

    try {
      const response = await fetch(
        `${RAG_SERVICE_URL}/api/graph/reasoning-trail`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            graph_id: graph.id,
            question,
            client_values: clientValues,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to get reasoning trail')
      }

      return await response.json()
    } catch (err) {
      console.error('Reasoning trail error:', err)
      return null
    }
  }

  /**
   * Export graph as JSON
   */
  const exportGraph = () => {
    if (!graph) return

    const dataStr = JSON.stringify(graph, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `graph_${graph.id}_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Export as CSV for spreadsheet analysis
   */
  const exportAsCSV = () => {
    if (!graph) return

    let csv = 'Entity ID,Entity Type,Label,Confidence,Source,Description\n'

    for (const entity of Object.values(graph.entities)) {
      csv += `"${entity.id}","${entity.type}","${entity.label}",${entity.confidence},"${entity.source}","${entity.description || ''}"\n`
    }

    csv += '\n\nRelation ID,Type,Source Entity,Target Entity,Confidence,Reasoning\n'

    for (const rel of Object.values(graph.relations)) {
      const sourceLabel = graph.entities[rel.source_entity_id]?.label || rel.source_entity_id
      const targetLabel = graph.entities[rel.target_entity_id]?.label || rel.target_entity_id
      csv += `"${rel.id}","${rel.type}","${sourceLabel}","${targetLabel}",${rel.confidence},"${rel.reasoning || ''}"\n`
    }

    const dataBlob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `graph_${graph.id}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Simple SVG visualization of graph
   * In production, use D3.js or Cytoscape.js for interactive visualization
   */
  const renderGraphVisualization = () => {
    if (!graph || !svgRef.current) return

    const entities = Object.values(graph.entities).filter(e => {
      if (filterEntityType && e.type !== filterEntityType) return false
      return true
    })

    const relations = Object.values(graph.relations).filter(r => {
      if (filterRelationType && r.type !== filterRelationType) return false
      return true
    })

    // Simple grid layout
    const padding = 40
    const cellWidth = 250
    const cellHeight = 120
    const colsPerRow = 3

    // Clear SVG
    if (svgRef.current) {
      svgRef.current.innerHTML = ''
    }

    // Draw relations first (so they appear behind nodes)
    const svg = svgRef.current
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

    for (const rel of relations) {
      const sourceEntity = graph.entities[rel.source_entity_id]
      const targetEntity = graph.entities[rel.target_entity_id]

      if (!sourceEntity || !targetEntity) continue

      const sourceIndex = entities.indexOf(sourceEntity)
      const targetIndex = entities.indexOf(targetEntity)

      if (sourceIndex === -1 || targetIndex === -1) continue

      const x1 = padding + (sourceIndex % colsPerRow) * cellWidth + cellWidth / 2
      const y1 = padding + Math.floor(sourceIndex / colsPerRow) * cellHeight + cellHeight / 2

      const x2 = padding + (targetIndex % colsPerRow) * cellWidth + cellWidth / 2
      const y2 = padding + Math.floor(targetIndex / colsPerRow) * cellHeight + cellHeight / 2

      // Draw arrow
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', x1.toString())
      line.setAttribute('y1', y1.toString())
      line.setAttribute('x2', x2.toString())
      line.setAttribute('y2', y2.toString())
      line.setAttribute('stroke', RELATION_COLORS[rel.type] || '#999')
      line.setAttribute('stroke-width', '2')
      line.setAttribute('marker-end', `url(#arrowhead-${rel.type})`)
      line.style.opacity = rel.confidence.toString()
      g.appendChild(line)

      // Draw label
      const midX = (x1 + x2) / 2
      const midY = (y1 + y2) / 2
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', midX.toString())
      text.setAttribute('y', midY.toString())
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('font-size', '10')
      text.setAttribute('fill', '#666')
      text.textContent = rel.type
      g.appendChild(text)
    }

    svg?.appendChild(g)

    // Draw entities
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const x = padding + (i % colsPerRow) * cellWidth
      const y = padding + Math.floor(i / colsPerRow) * cellHeight

      // Background rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', x.toString())
      rect.setAttribute('y', y.toString())
      rect.setAttribute('width', cellWidth.toString())
      rect.setAttribute('height', cellHeight.toString())
      rect.setAttribute('fill', ENTITY_COLORS[entity.type] || '#e5e7eb')
      rect.setAttribute('stroke', '#333')
      rect.setAttribute('stroke-width', '2')
      rect.setAttribute('rx', '4')
      rect.style.opacity = entity.confidence.toString()
      rect.style.cursor = 'pointer'
      rect.onclick = () => setSelectedEntity(entity)
      svg?.appendChild(rect)

      // Type badge
      const typeBg = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      typeBg.setAttribute('x', (x + 8).toString())
      typeBg.setAttribute('y', (y + 20).toString())
      typeBg.setAttribute('font-size', '10')
      typeBg.setAttribute('font-weight', 'bold')
      typeBg.setAttribute('fill', 'white')
      typeBg.textContent = entity.type.toUpperCase()
      svg?.appendChild(typeBg)

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', (x + cellWidth / 2).toString())
      label.setAttribute('y', (y + cellHeight / 2).toString())
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('font-size', '12')
      label.setAttribute('font-weight', 'bold')
      label.setAttribute('fill', 'white')

      // Wrap text
      const words = entity.label.split(' ')
      let line = ''
      for (let j = 0; j < words.length; j++) {
        const testLine = line + (line ? ' ' : '') + words[j]
        if (testLine.length > 20) {
          if (line) {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
            tspan.setAttribute('x', (x + cellWidth / 2).toString())
            tspan.setAttribute('dy', '1.2em')
            tspan.textContent = line
            label.appendChild(tspan)
          }
          line = words[j]
        } else {
          line = testLine
        }
      }
      if (line) {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
        tspan.setAttribute('x', (x + cellWidth / 2).toString())
        tspan.setAttribute('dy', '1.2em')
        tspan.textContent = line
        label.appendChild(tspan)
      }

      svg?.appendChild(label)

      // Confidence indicator
      const confidenceBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      confidenceBar.setAttribute('x', x.toString())
      confidenceBar.setAttribute('y', (y + cellHeight - 8).toString())
      confidenceBar.setAttribute('width', (cellWidth * entity.confidence).toString())
      confidenceBar.setAttribute('height', '4')
      confidenceBar.setAttribute('fill', '#4b5563')
      svg?.appendChild(confidenceBar)
    }
  }

  /**
   * Filter entities
   */
  const getFilteredStats = (): GraphStats => {
    if (!graph) {
      return {
        total_entities: 0,
        total_relations: 0,
        entity_types: {},
        relation_types: {},
      }
    }

    let entityCount = Object.keys(graph.entities).length
    let relationCount = Object.keys(graph.relations).length

    if (filterEntityType) {
      entityCount = Object.values(graph.entities).filter(
        e => e.type === filterEntityType
      ).length
    }

    if (filterRelationType) {
      relationCount = Object.values(graph.relations).filter(
        r => r.type === filterRelationType
      ).length
    }

    return {
      total_entities: entityCount,
      total_relations: relationCount,
      entity_types: graph.stats.entity_types,
      relation_types: graph.stats.relation_types,
    }
  }

  // Initial load
  useEffect(() => {
    fetchGraph()
  }, [])

  // Re-render when filter changes
  useEffect(() => {
    renderGraphVisualization()
  }, [graph, filterEntityType, filterRelationType])

  const stats = getFilteredStats()

  return (
    <div className={`${fullScreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      <Card className={fullScreen ? 'h-full rounded-none border-none' : ''}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Debt Advice Graph View</CardTitle>
            <CardDescription>
              Entity-relation graph showing debt solution rules and relationships
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFullScreen(!fullScreen)}
            >
              {fullScreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchGraph()}
              disabled={loading}
            >
              {loading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="flex gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">{error}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : graph ? (
            <Tabs defaultValue="graph" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="graph" className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Graph View
                </TabsTrigger>
                <TabsTrigger value="entities" className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Entities ({stats.total_entities})
                </TabsTrigger>
                <TabsTrigger value="relations" className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Relations ({stats.total_relations})
                </TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              {/* Graph Visualization Tab */}
              <TabsContent value="graph" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="filter-entity" className="text-xs">
                        Entity Type
                      </Label>
                      <select
                        id="filter-entity"
                        value={filterEntityType}
                        onChange={e => setFilterEntityType(e.target.value)}
                        className="w-full mt-1 px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">All entities</option>
                        {Object.entries(stats.entity_types).map(([type, count]) => (
                          <option key={type} value={type}>
                            {type} ({count})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1">
                      <Label htmlFor="filter-relation" className="text-xs">
                        Relation Type
                      </Label>
                      <select
                        id="filter-relation"
                        value={filterRelationType}
                        onChange={e => setFilterRelationType(e.target.value)}
                        className="w-full mt-1 px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">All relations</option>
                        {Object.entries(stats.relation_types).map(([type, count]) => (
                          <option key={type} value={type}>
                            {type} ({count})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={exportGraph}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={exportAsCSV}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        CSV
                      </Button>
                    </div>
                  </div>
                </div>

                {/* SVG Canvas */}
                <div
                  ref={canvasRef}
                  className="border border-gray-300 rounded-lg bg-gray-50 overflow-auto"
                  style={{ height: fullScreen ? 'calc(100vh - 300px)' : '500px' }}
                >
                  <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox="0 0 1200 800"
                    preserveAspectRatio="xMinYMin meet"
                  >
                    <defs>
                      {Object.entries(RELATION_COLORS).map(([type, color]) => (
                        <marker
                          key={`arrow-${type}`}
                          id={`arrowhead-${type}`}
                          markerWidth="10"
                          markerHeight="10"
                          refX="9"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 10 3, 0 6" fill={color} />
                        </marker>
                      ))}
                    </defs>
                  </svg>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-4 mt-4 p-3 bg-gray-50 rounded">
                  <div>
                    <h4 className="text-xs font-semibold mb-2">Entity Types</h4>
                    <div className="space-y-1 text-xs">
                      {Object.entries(ENTITY_COLORS).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: color }}
                          />
                          <span className="capitalize">{type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold mb-2">Relation Types</h4>
                    <div className="space-y-1 text-xs">
                      {Object.entries(RELATION_COLORS).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-2">
                          <div
                            className="w-1 h-3"
                            style={{ backgroundColor: color }}
                          />
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Entities Tab */}
              <TabsContent value="entities" className="space-y-3">
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {Object.values(graph.entities)
                    .filter(
                      e => !filterEntityType || e.type === filterEntityType
                    )
                    .map(entity => (
                      <div
                        key={entity.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-blue-50"
                        onClick={() => setSelectedEntity(entity)}
                        style={{
                          borderLeftColor: ENTITY_COLORS[entity.type] || '#999',
                          borderLeftWidth: '4px',
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{entity.label}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              <Badge variant="outline" className="text-xs mr-1">
                                {entity.type}
                              </Badge>
                              <span className="text-gray-500">
                                Confidence: {(entity.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            {entity.description && (
                              <div className="text-xs text-gray-700 mt-2">
                                {entity.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              {/* Relations Tab */}
              <TabsContent value="relations" className="space-y-3">
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {Object.values(graph.relations)
                    .filter(
                      r => !filterRelationType || r.type === filterRelationType
                    )
                    .map(rel => {
                      const source = graph.entities[rel.source_entity_id]
                      const target = graph.entities[rel.target_entity_id]
                      return (
                        <div
                          key={rel.id}
                          className="p-3 border rounded-lg"
                          style={{
                            borderLeftColor: RELATION_COLORS[rel.type] || '#999',
                            borderLeftWidth: '4px',
                          }}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex-1">
                              <div className="font-medium">
                                {source?.label || rel.source_entity_id}
                              </div>
                              <div className="text-gray-600 text-xs my-1">
                                <ArrowRight className="inline h-3 w-3 mx-1" />
                                <Badge variant="outline" className="text-xs">
                                  {rel.type}
                                </Badge>
                              </div>
                              <div className="font-medium">
                                {target?.label || rel.target_entity_id}
                              </div>
                              {rel.reasoning && (
                                <div className="text-xs text-gray-700 mt-2 italic">
                                  "{rel.reasoning}"
                                </div>
                              )}
                            </div>
                            <div className="text-right text-xs text-gray-500">
                              {(rel.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Entities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.total_entities}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-purple-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Relations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.total_relations}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {selectedEntity && (
                  <Card className="border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-sm">Selected Entity Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold">Label:</span> {selectedEntity.label}
                      </div>
                      <div>
                        <span className="font-semibold">Type:</span> {selectedEntity.type}
                      </div>
                      <div>
                        <span className="font-semibold">ID:</span>{' '}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {selectedEntity.id}
                        </code>
                      </div>
                      <div>
                        <span className="font-semibold">Confidence:</span>{' '}
                        {(selectedEntity.confidence * 100).toFixed(0)}%
                      </div>
                      <div>
                        <span className="font-semibold">Source:</span> {selectedEntity.source}
                      </div>
                      {Object.keys(selectedEntity.properties).length > 0 && (
                        <div>
                          <span className="font-semibold">Properties:</span>
                          <pre className="bg-gray-100 p-2 rounded text-xs mt-1 overflow-auto">
                            {JSON.stringify(selectedEntity.properties, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No graph loaded. Click "Refresh" or upload documents to build a graph.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
