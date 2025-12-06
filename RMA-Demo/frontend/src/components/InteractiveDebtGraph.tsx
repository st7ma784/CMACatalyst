'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  GitBranch,
  Loader,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Grid3x3,
  Move,
} from 'lucide-react'

/**
 * Interactive Debt Graph with Draggable Nodes
 *
 * Advanced visualization with:
 * - Draggable entity nodes (letters, assets, creditors)
 * - Client data overlay on debt routes
 * - Multiple route comparison (DRO, IVA, Bankruptcy)
 * - Force-directed layout
 * - Position persistence
 * - Real-time path highlighting
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

interface NodePosition {
  [entityId: string]: { x: number; y: number }
}

interface ClientData {
  debt: number
  income: number
  assets: number
  dependents: number
  employment: string
  debts: Array<{ type: string; amount: number; creditor: string }>
}

interface RouteComparison {
  routeName: string
  eligible: boolean
  gaps: string[]
  path: string[]
  confidence: number
  position: 'fit' | 'near-miss' | 'no-fit' | 'needs-review'
}

const ENTITY_COLORS: Record<string, string> = {
  condition: '#3b82f6',
  rule: '#8b5cf6',
  outcome: '#10b981',
  threshold: '#f59e0b',
  process: '#6366f1',
  criteria: '#ec4899',
  exception: '#ef4444',
  action: '#14b8a6',
  journey: '#06b6d4',
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

const ROUTE_COLORS = {
  dro: '#10b981',
  iva: '#3b82f6',
  bankruptcy: '#ef4444',
}

export default function InteractiveDebtGraph({ clientData }: { clientData?: ClientData }) {
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fullScreen, setFullScreen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [nodePositions, setNodePositions] = useState<NodePosition>({})
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<string>('all')
  const [showClientOverlay, setShowClientOverlay] = useState(!!clientData)
  const [routeComparisons, setRouteComparisons] = useState<Map<string, RouteComparison>>(new Map())
  const [autoLayout, setAutoLayout] = useState(true)
  const [highlightedPath, setHighlightedPath] = useState<string[]>([])
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const DEBTS_ROUTES = ['dro', 'iva', 'bankruptcy']

  /**
   * Initialize force-directed layout
   */
  const initializeLayout = useCallback(() => {
    if (!graph) return

    const entities = Object.values(graph.entities)
    const positions: NodePosition = {}

    // Start with circular layout, then apply forces
    const angleSlice = (Math.PI * 2) / entities.length
    entities.forEach((entity, i) => {
      const angle = angleSlice * i
      const radius = 250
      positions[entity.id] = {
        x: 600 + radius * Math.cos(angle),
        y: 400 + radius * Math.sin(angle),
      }
    })

    setNodePositions(positions)
  }, [graph])

  /**
   * Apply force-directed layout for better visual separation
   */
  const applyForceLayout = useCallback(() => {
    if (!autoLayout || !graph) return

    const positions = { ...nodePositions }
    const entities = Object.values(graph.entities)
    const relations = Object.values(graph.relations)

    // Ensure all entities have positions before proceeding
    const hasAllPositions = entities.every(entity => positions[entity.id])
    if (!hasAllPositions) {
      console.warn('Not all entities have positions, skipping force layout')
      return
    }

    // Simple force simulation
    for (let iteration = 0; iteration < 10; iteration++) {
      entities.forEach(entity => {
        // Check if position exists
        if (!positions[entity.id]) return

        let fx = 0
        let fy = 0

        // Repulsion between nodes
        entities.forEach(other => {
          if (entity.id === other.id || !positions[other.id]) return
          const dx = positions[other.id].x - positions[entity.id].x
          const dy = positions[other.id].y - positions[entity.id].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const repulsion = 100 / (dist * dist)
          fx -= (dx / dist) * repulsion
          fy -= (dy / dist) * repulsion
        })

        // Attraction to related nodes
        relations.forEach(rel => {
          if (rel.source_entity_id === entity.id) {
            const target = positions[rel.target_entity_id]
            if (target && positions[entity.id]) {
              const dx = target.x - positions[entity.id].x
              const dy = target.y - positions[entity.id].y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              const attraction = (dist - 200) * 0.01
              fx += (dx / dist) * attraction
              fy += (dy / dist) * attraction
            }
          }
          if (rel.target_entity_id === entity.id) {
            const source = positions[rel.source_entity_id]
            if (source && positions[entity.id]) {
              const dx = source.x - positions[entity.id].x
              const dy = source.y - positions[entity.id].y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              const attraction = (dist - 200) * 0.01
              fx += (dx / dist) * attraction
              fy += (dy / dist) * attraction
            }
          }
        })

        // Apply forces with damping (only if position exists)
        if (positions[entity.id]) {
          positions[entity.id].x += fx * 0.5
          positions[entity.id].y += fy * 0.5

          // Keep in bounds
          positions[entity.id].x = Math.max(50, Math.min(1150, positions[entity.id].x))
          positions[entity.id].y = Math.max(50, Math.min(750, positions[entity.id].y))
        }
      })
    }

    setNodePositions(positions)
  }, [graph, autoLayout, nodePositions])

  /**
   * Load graph from API
   */
  const fetchGraph = async () => {
    try {
      setLoading(true)
      setError('')

      // TODO: Replace with actual API call
      const mockGraph: GraphData = {
        id: 'graph-001',
        entities: {
          ent_debt: {
            id: 'ent_debt',
            type: 'condition',
            label: 'Debt Level',
            properties: { min: 0, max: 50000 },
            source: 'DRO_Manual.pdf',
            confidence: 0.95,
          },
          ent_income: {
            id: 'ent_income',
            type: 'condition',
            label: 'Monthly Income',
            properties: { min: 0, max: 75 },
            source: 'DRO_Manual.pdf',
            confidence: 0.92,
          },
          ent_dro: {
            id: 'ent_dro',
            type: 'rule',
            label: 'DRO Eligibility',
            properties: { type: 'AND' },
            source: 'DRO_Manual.pdf',
            confidence: 0.98,
          },
          ent_outcome_dro: {
            id: 'ent_outcome_dro',
            type: 'outcome',
            label: 'Eligible for DRO',
            properties: {},
            source: 'DRO_Manual.pdf',
            confidence: 0.95,
          },
          ent_iva: {
            id: 'ent_iva',
            type: 'rule',
            label: 'IVA Eligibility',
            properties: { type: 'alternative' },
            source: 'IVA_Manual.pdf',
            confidence: 0.94,
          },
          ent_outcome_iva: {
            id: 'ent_outcome_iva',
            type: 'outcome',
            label: 'Eligible for IVA',
            properties: {},
            source: 'IVA_Manual.pdf',
            confidence: 0.91,
          },
        },
        relations: {
          rel_1: {
            id: 'rel_1',
            type: 'part_of',
            source_entity_id: 'ent_debt',
            target_entity_id: 'ent_dro',
            confidence: 0.98,
          },
          rel_2: {
            id: 'rel_2',
            type: 'part_of',
            source_entity_id: 'ent_income',
            target_entity_id: 'ent_dro',
            confidence: 0.97,
          },
          rel_3: {
            id: 'rel_3',
            type: 'implies',
            source_entity_id: 'ent_dro',
            target_entity_id: 'ent_outcome_dro',
            confidence: 0.95,
          },
        },
        stats: {
          total_entities: 6,
          total_relations: 3,
          entity_types: { condition: 2, rule: 2, outcome: 2 },
          relation_types: { part_of: 2, implies: 1 },
          source_documents: ['DRO_Manual.pdf', 'IVA_Manual.pdf'],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setGraph(mockGraph)
      initializeLayout()

      if (clientData) {
        calculateRouteComparisons(mockGraph)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Compare client against debt routes
   */
  const calculateRouteComparisons = (graphData: GraphData) => {
    if (!clientData) return

    const comparisons = new Map<string, RouteComparison>()

    // DRO comparison
    const droGaps: string[] = []
    if (clientData.debt > 50000) droGaps.push(`Debt over limit by £${clientData.debt - 50000}`)
    if (clientData.income > 75) droGaps.push(`Income over limit by £${clientData.income - 75}`)

    comparisons.set('dro', {
      routeName: 'DRO',
      eligible: droGaps.length === 0,
      gaps: droGaps,
      path: ['Debt Level', 'Monthly Income', 'DRO Eligibility', 'Eligible for DRO'],
      confidence: 0.95,
      position: droGaps.length === 0 ? 'fit' : droGaps.length === 1 ? 'near-miss' : 'no-fit',
    })

    // IVA comparison (more lenient)
    const ivaGaps: string[] = []
    if (clientData.debt < 15000) ivaGaps.push('Debt below IVA minimum')

    comparisons.set('iva', {
      routeName: 'IVA',
      eligible: ivaGaps.length === 0,
      gaps: ivaGaps,
      path: ['Debt Level', 'Income Assessment', 'IVA Eligibility', 'Eligible for IVA'],
      confidence: 0.92,
      position: ivaGaps.length === 0 ? 'fit' : 'near-miss',
    })

    // Bankruptcy comparison
    const bankGaps: string[] = []
    if (clientData.debt < 1000) bankGaps.push('Debt below bankruptcy threshold')

    comparisons.set('bankruptcy', {
      routeName: 'Bankruptcy',
      eligible: bankGaps.length === 0,
      gaps: bankGaps,
      path: ['Debt Level', 'Asset Assessment', 'Bankruptcy Review', 'Eligible for Bankruptcy'],
      confidence: 0.88,
      position: bankGaps.length === 0 ? 'fit' : bankGaps.length === 1 ? 'near-miss' : 'needs-review',
    })

    setRouteComparisons(comparisons)
  }

  /**
   * Handle mouse down on node
   */
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return // Only left click

    setDragging(nodeId)
    setSelectedNode(nodeId)

    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      setDragStart({
        x: (e.clientX - rect.left) / zoom - pan.x,
        y: (e.clientY - rect.top) / zoom - pan.y,
      })
    }
  }

  /**
   * Handle mouse move
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const newX = (e.clientX - rect.left) / zoom - pan.x
    const newY = (e.clientY - rect.top) / zoom - pan.y

    setNodePositions(prev => ({
      ...prev,
      [dragging]: { x: newX, y: newY },
    }))
  }

  /**
   * Handle mouse up
   */
  const handleMouseUp = () => {
    setDragging(null)
  }

  /**
   * Render SVG graph
   */
  const renderGraph = () => {
    if (!graph || !svgRef.current) return

    const svg = svgRef.current
    svg.innerHTML = ''

    const entities = Object.values(graph.entities)
    const relations = Object.values(graph.relations)

    // Render relations first (so they appear behind)
    relations.forEach(rel => {
      const sourcePos = nodePositions[rel.source_entity_id]
      const targetPos = nodePositions[rel.target_entity_id]

      if (!sourcePos || !targetPos) return

      // Highlight path if route selected
      const isHighlighted = highlightedPath.includes(rel.source_entity_id) &&
                           highlightedPath.includes(rel.target_entity_id)

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', sourcePos.x.toString())
      line.setAttribute('y1', sourcePos.y.toString())
      line.setAttribute('x2', targetPos.x.toString())
      line.setAttribute('y2', targetPos.y.toString())
      line.setAttribute('stroke', isHighlighted ? '#ff0000' : RELATION_COLORS[rel.type] || '#ccc')
      line.setAttribute('stroke-width', isHighlighted ? '3' : '2')
      line.setAttribute('opacity', isHighlighted ? '1' : '0.6')
      line.setAttribute('stroke-dasharray', isHighlighted ? '5,5' : '0')

      svg.appendChild(line)

      // Relation label
      const midX = (sourcePos.x + targetPos.x) / 2
      const midY = (sourcePos.y + targetPos.y) / 2

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('x', midX.toString())
      label.setAttribute('y', midY.toString())
      label.setAttribute('font-size', '11')
      label.setAttribute('fill', '#666')
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('class', 'pointer-events-none')
      label.textContent = rel.type
      svg.appendChild(label)
    })

    // Render entities (nodes)
    entities.forEach(entity => {
      const pos = nodePositions[entity.id]
      if (!pos) return

      const isSelected = selectedNode === entity.id
      const nodeRadius = 40

      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', pos.x.toString())
      circle.setAttribute('cy', pos.y.toString())
      circle.setAttribute('r', nodeRadius.toString())
      circle.setAttribute('fill', ENTITY_COLORS[entity.type] || '#ccc')
      circle.setAttribute('stroke', isSelected ? '#000' : '#333')
      circle.setAttribute('stroke-width', isSelected ? '3' : '1')
      circle.setAttribute('opacity', '0.8')
      circle.setAttribute('class', 'cursor-move')
      circle.setAttribute('style', `cursor: ${dragging === entity.id ? 'grabbing' : 'grab'}`)

      // Store entity id for later reference
      ;(circle as any).entityId = entity.id
      circle.onmousedown = (e: MouseEvent) => {
        handleNodeMouseDown(e as any, entity.id)
      }

      svg.appendChild(circle)

      // Confidence indicator (inner circle)
      const confidenceRadius = (nodeRadius * entity.confidence)
      const confidenceCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      confidenceCircle.setAttribute('cx', pos.x.toString())
      confidenceCircle.setAttribute('cy', pos.y.toString())
      confidenceCircle.setAttribute('r', confidenceRadius.toString())
      confidenceCircle.setAttribute('fill', 'none')
      confidenceCircle.setAttribute('stroke', '#fff')
      confidenceCircle.setAttribute('stroke-width', '2')
      confidenceCircle.setAttribute('opacity', '0.5')
      svg.appendChild(confidenceCircle)

      // Entity label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', pos.x.toString())
      text.setAttribute('y', (pos.y - 5).toString())
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('font-size', '12')
      text.setAttribute('font-weight', 'bold')
      text.setAttribute('fill', '#fff')
      text.setAttribute('class', 'pointer-events-none')

      // Wrap text
      const words = entity.label.split(' ')
      const maxWidth = 18
      const lines: string[] = []
      let currentLine = ''

      words.forEach(word => {
        if ((currentLine + word).length > maxWidth) {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        } else {
          currentLine += (currentLine ? ' ' : '') + word
        }
      })
      if (currentLine) lines.push(currentLine)

      lines.forEach((line, i) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
        tspan.setAttribute('x', pos.x.toString())
        tspan.setAttribute('dy', i === 0 ? '0' : '1.2em')
        tspan.textContent = line
        text.appendChild(tspan)
      })

      svg.appendChild(text)

      // Badge showing type
      const typeBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      typeBox.setAttribute('x', (pos.x - nodeRadius - 5).toString())
      typeBox.setAttribute('y', (pos.y + nodeRadius).toString())
      typeBox.setAttribute('width', '60')
      typeBox.setAttribute('height', '16')
      typeBox.setAttribute('fill', '#333')
      typeBox.setAttribute('rx', '3')
      svg.appendChild(typeBox)

      const typeText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      typeText.setAttribute('x', pos.x.toString())
      typeText.setAttribute('y', (pos.y + nodeRadius + 11).toString())
      typeText.setAttribute('font-size', '10')
      typeText.setAttribute('fill', '#fff')
      typeText.setAttribute('text-anchor', 'middle')
      typeText.setAttribute('class', 'pointer-events-none')
      typeText.textContent = entity.type
      svg.appendChild(typeText)
    })
  }

  /**
   * Reset zoom and pan
   */
  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  /**
   * Export graph
   */
  const exportGraph = () => {
    if (!graph) return
    const data = {
      ...graph,
      nodePositions,
    }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debt-graph-${Date.now()}.json`
    a.click()
  }

  // Initialize on mount
  useEffect(() => {
    fetchGraph()
  }, [])

  // Initialize layout when graph loads
  useEffect(() => {
    if (graph && Object.keys(nodePositions).length === 0) {
      initializeLayout()
    }
  }, [graph, nodePositions, initializeLayout])

  // Render when positions change
  useEffect(() => {
    if (Object.keys(nodePositions).length > 0) {
      renderGraph()
    }
  }, [graph, nodePositions, selectedNode, highlightedPath])

  // Apply force layout periodically (only if positions are initialized)
  useEffect(() => {
    if (!autoLayout || Object.keys(nodePositions).length === 0) return
    const interval = setInterval(applyForceLayout, 100)
    return () => clearInterval(interval)
  }, [autoLayout, applyForceLayout, nodePositions])

  return (
    <div className={`${fullScreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      <Card className={fullScreen ? 'h-full rounded-none border-none flex flex-col' : ''}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Interactive Debt Routes Graph</CardTitle>
            <CardDescription>
              Draggable visualization showing client position across debt routes
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
            <Button variant="outline" size="sm" onClick={fetchGraph} disabled={loading}>
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        <CardContent className={`space-y-6 ${fullScreen ? 'flex-1 overflow-hidden' : ''}`}>
          {!loading && graph && (
            <Tabs defaultValue="graph" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="graph">
                  <GitBranch className="h-4 w-4 mr-2" />
                  Interactive Graph
                </TabsTrigger>
                <TabsTrigger value="routes">
                  <Eye className="h-4 w-4 mr-2" />
                  Route Analysis
                </TabsTrigger>
                <TabsTrigger value="details">
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Node Details
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Move className="h-4 w-4 mr-2" />
                  Layout
                </TabsTrigger>
              </TabsList>

              {/* Interactive Graph Tab */}
              <TabsContent value="graph" className="space-y-4 flex-1">
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(Math.min(zoom + 0.2, 3))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">{(zoom * 100).toFixed(0)}%</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(Math.max(zoom - 0.2, 0.5))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetView}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAutoLayout(!autoLayout)}
                    className={autoLayout ? 'bg-blue-100' : ''}
                  >
                    Auto Layout: {autoLayout ? 'On' : 'Off'}
                  </Button>
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportGraph}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>

                <div
                  ref={canvasRef}
                  className="border border-gray-300 rounded-lg bg-gray-50 flex-1 overflow-auto relative"
                  style={{ height: fullScreen ? 'calc(100vh - 300px)' : '600px' }}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <svg
                    ref={svgRef}
                    width="1200"
                    height="800"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                      transformOrigin: '0 0',
                      cursor: dragging ? 'grabbing' : 'grab',
                    }}
                  />
                </div>

                <div className="text-xs text-gray-500">
                  💡 Drag nodes to rearrange. Node size = type importance. Inner circle = confidence level.
                </div>
              </TabsContent>

              {/* Route Analysis Tab */}
              <TabsContent value="routes" className="space-y-4">
                {clientData && (
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from(routeComparisons.values()).map((route, idx) => {
                      const positionColors = {
                        'fit': 'bg-green-50 border-green-300',
                        'near-miss': 'bg-amber-50 border-amber-300',
                        'no-fit': 'bg-red-50 border-red-300',
                        'needs-review': 'bg-blue-50 border-blue-300',
                      }

                      const positionBadges = {
                        'fit': <Badge className="bg-green-600">Perfect Fit</Badge>,
                        'near-miss': <Badge className="bg-amber-600">Near Miss</Badge>,
                        'no-fit': <Badge className="bg-red-600">Not Suitable</Badge>,
                        'needs-review': <Badge className="bg-blue-600">Review Needed</Badge>,
                      }

                      return (
                        <Card
                          key={route.routeName}
                          className={`border-2 cursor-pointer transition-all ${positionColors[route.position]} ${
                            selectedRoute === route.routeName ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => {
                            setSelectedRoute(route.routeName)
                            setHighlightedPath(route.path)
                          }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{route.routeName}</CardTitle>
                              {positionBadges[route.position]}
                            </div>
                            <div className="text-sm text-gray-600">
                              Confidence: {(route.confidence * 100).toFixed(0)}%
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {route.gaps.length === 0 ? (
                              <div className="text-sm text-green-700 font-semibold">✓ All criteria met</div>
                            ) : (
                              <div>
                                <div className="text-sm font-semibold mb-1">Gaps:</div>
                                {route.gaps.map((gap, i) => (
                                  <div key={i} className="text-sm text-gray-700 pl-3">
                                    • {gap}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="pt-2 border-t mt-2">
                              <div className="text-xs text-gray-600">Path:</div>
                              <div className="text-xs mt-1">
                                {route.path.slice(0, 3).join(' → ')}...
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Node Details Tab */}
              <TabsContent value="details" className="space-y-4">
                {selectedNode && graph.entities[selectedNode] ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>{graph.entities[selectedNode].label}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge>{graph.entities[selectedNode].type}</Badge>
                        <Badge variant="outline">
                          Confidence: {(graph.entities[selectedNode].confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Description</h4>
                        <p className="text-sm text-gray-700">{graph.entities[selectedNode].description || 'N/A'}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Properties</h4>
                        <div className="bg-gray-50 p-3 rounded text-sm font-mono text-gray-700">
                          {JSON.stringify(graph.entities[selectedNode].properties, null, 2)}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Source</h4>
                        <p className="text-sm text-gray-700">{graph.entities[selectedNode].source}</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    Click on a node in the graph to see details
                  </div>
                )}
              </TabsContent>

              {/* Layout Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Layout Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoLayout}
                          onChange={e => setAutoLayout(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Enable automatic force-directed layout</span>
                      </label>
                      <p className="text-xs text-gray-600 ml-6">
                        Automatically adjusts node positions to minimize overlaps and optimize visibility.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          initializeLayout()
                          setAutoLayout(true)
                        }}
                      >
                        Reset to Default Layout
                      </Button>
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-2">Legend</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: ENTITY_COLORS.condition }} />
                          <span>Condition</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: ENTITY_COLORS.rule }} />
                          <span>Rule</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: ENTITY_COLORS.outcome }} />
                          <span>Outcome</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
