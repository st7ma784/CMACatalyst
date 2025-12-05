'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// DHT Node types
interface DHTNode {
  id: string;
  node_id: string;
  node_type: 'coordinator' | 'worker';
  tunnel_url?: string;
  dht_port?: number;
  location?: string;
  status?: 'healthy' | 'degraded' | 'offline';
  services?: string[];
  load?: number;
  last_seen?: number;
  capabilities?: {
    gpu_type?: string;
    cpu_cores?: number;
    ram?: string;
  };
}

// D3 types with force simulation properties
interface D3DHTNode extends DHTNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface DHTLink {
  source: string | D3DHTNode;
  target: string | D3DHTNode;
  type: 'dht_connection' | 'service_route';
}

interface DHTTopologyData {
  nodes: DHTNode[];
  connections: Array<{
    source_id: string;
    target_id: string;
    type: string;
  }>;
  stats?: {
    total_nodes: number;
    coordinator_count: number;
    worker_count: number;
    healthy_count: number;
  };
}

// Color schemes for different node types
const NODE_COLORS = {
  coordinator: '#3B82F6', // Blue
  gpu_worker: '#10B981', // Green
  service_worker: '#F59E0B', // Yellow/Orange
  data_worker: '#8B5CF6', // Purple
  edge_worker: '#EC4899', // Pink
  offline: '#6B7280', // Gray
};

const STATUS_COLORS = {
  healthy: '#10B981',
  degraded: '#F59E0B',
  offline: '#EF4444',
};

interface DHTTopologyGraphProps {
  topologyData: DHTTopologyData;
  onNodeClick?: (node: DHTNode) => void;
}

const DHTTopologyGraph: React.FC<DHTTopologyGraphProps> = ({ topologyData, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<D3DHTNode | null>(null);
  const simulationRef = useRef<d3.Simulation<D3DHTNode, DHTLink> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !topologyData.nodes.length) return;

    // Clear previous content
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Create nodes and links
    const nodes: D3DHTNode[] = topologyData.nodes.map((n) => ({ ...n, id: n.node_id }));
    const links: DHTLink[] = topologyData.connections.map((c) => ({
      source: c.source_id,
      target: c.target_id,
      type: c.type as 'dht_connection' | 'service_route',
    }));

    // Create simulation with stronger forces for better layout
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink<D3DHTNode, DHTLink>(links).id((d) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    simulationRef.current = simulation;

    // Create SVG elements
    const g = svg.append('g');

    // Arrows for directed links
    svg
      .append('defs')
      .selectAll('marker')
      .data(['dht_connection', 'service_route'])
      .enter()
      .append('marker')
      .attr('id', (d) => `arrow-${d}`)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 40)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', (d) => (d === 'dht_connection' ? '#666' : '#3B82F6'));

    // Links
    const linkSelection = g
      .selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', (d) => (d.type === 'dht_connection' ? '#999' : '#3B82F6'))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => (d.type === 'dht_connection' ? 2 : 3))
      .attr('stroke-dasharray', (d) => (d.type === 'service_route' ? '5,5' : '0'))
      .attr('marker-end', (d) => `url(#arrow-${d.type})`);

    // Node groups
    const nodeGroups = g
      .selectAll('.node-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
        onNodeClick?.(d);
      });

    // Get node color based on type and status
    const getNodeColor = (node: D3DHTNode) => {
      if (node.status === 'offline') return NODE_COLORS.offline;
      if (node.node_type === 'coordinator') return NODE_COLORS.coordinator;

      // For workers, determine type from services
      if (node.services?.includes('vllm') || node.capabilities?.gpu_type) {
        return NODE_COLORS.gpu_worker;
      } else if (node.services?.some(s => ['rag', 'ner', 'notes'].includes(s))) {
        return NODE_COLORS.service_worker;
      } else if (node.services?.some(s => ['postgres', 'neo4j', 'redis'].includes(s))) {
        return NODE_COLORS.data_worker;
      } else {
        return NODE_COLORS.edge_worker;
      }
    };

    // Outer circle for status indicator
    nodeGroups
      .append('circle')
      .attr('class', 'status-ring')
      .attr('r', 35)
      .attr('fill', 'none')
      .attr('stroke', (d) => STATUS_COLORS[d.status || 'healthy'])
      .attr('stroke-width', 3)
      .attr('opacity', 0.8);

    // Main node circle
    nodeGroups
      .append('circle')
      .attr('class', 'node')
      .attr('r', 30)
      .attr('fill', getNodeColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Node type icon (simplified text)
    nodeGroups
      .append('text')
      .attr('class', 'node-icon')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '20px')
      .attr('fill', '#fff')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text((d) => (d.node_type === 'coordinator' ? 'C' : 'W'));

    // Node labels
    nodeGroups
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', 45)
      .attr('font-size', '11px')
      .attr('fill', '#374151')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .text((d) => d.node_id.substring(0, 12));

    // Load indicator (small bar below label)
    nodeGroups
      .filter((d) => d.load !== undefined)
      .append('rect')
      .attr('x', -20)
      .attr('y', 50)
      .attr('width', 40)
      .attr('height', 4)
      .attr('fill', '#E5E7EB')
      .attr('rx', 2);

    nodeGroups
      .filter((d) => d.load !== undefined)
      .append('rect')
      .attr('x', -20)
      .attr('y', 50)
      .attr('width', (d) => (d.load || 0) * 40)
      .attr('height', 4)
      .attr('fill', (d) => {
        const load = d.load || 0;
        if (load > 0.8) return '#EF4444';
        if (load > 0.5) return '#F59E0B';
        return '#10B981';
      })
      .attr('rx', 2);

    // Tooltips
    nodeGroups
      .append('title')
      .text((d) => {
        let tooltip = `${d.node_id}\nType: ${d.node_type}\nStatus: ${d.status || 'unknown'}`;
        if (d.location) tooltip += `\nLocation: ${d.location}`;
        if (d.services) tooltip += `\nServices: ${d.services.join(', ')}`;
        if (d.load !== undefined) tooltip += `\nLoad: ${(d.load * 100).toFixed(0)}%`;
        if (d.capabilities?.gpu_type) tooltip += `\nGPU: ${d.capabilities.gpu_type}`;
        return tooltip;
      });

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d) => (d.source as D3DHTNode).x || 0)
        .attr('y1', (d) => (d.source as D3DHTNode).y || 0)
        .attr('x2', (d) => (d.target as D3DHTNode).x || 0)
        .attr('y2', (d) => (d.target as D3DHTNode).y || 0);

      nodeGroups.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [topologyData, onNodeClick]);

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      {topologyData.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">{topologyData.stats.total_nodes}</div>
            <div className="text-xs text-blue-700">Total Nodes</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-indigo-600">{topologyData.stats.coordinator_count}</div>
            <div className="text-xs text-indigo-700">Coordinators</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">{topologyData.stats.worker_count}</div>
            <div className="text-xs text-green-700">Workers</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-emerald-600">{topologyData.stats.healthy_count}</div>
            <div className="text-xs text-emerald-700">Healthy Nodes</div>
          </div>
        </div>
      )}

      {/* Graph Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            DHT Network Topology
          </CardTitle>
          <CardDescription>
            Real-time visualization of distributed hash table peer connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <svg
            ref={svgRef}
            style={{
              width: '100%',
              height: '600px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              backgroundColor: '#FAFAFA',
            }}
          />

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: NODE_COLORS.coordinator }} />
              <span>Coordinator</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: NODE_COLORS.gpu_worker }} />
              <span>GPU Worker</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: NODE_COLORS.service_worker }} />
              <span>Service Worker</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: NODE_COLORS.data_worker }} />
              <span>Data Worker</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: NODE_COLORS.edge_worker }} />
              <span>Edge Worker</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 border-2 rounded-full" style={{ borderColor: STATUS_COLORS.healthy }} />
              <span>Healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 border-2 rounded-full" style={{ borderColor: STATUS_COLORS.degraded }} />
              <span>Degraded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 border-2 rounded-full" style={{ borderColor: STATUS_COLORS.offline }} />
              <span>Offline</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Node Details: {selectedNode.node_id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-gray-700">Type:</span>
                <Badge className="ml-2" variant="outline">{selectedNode.node_type}</Badge>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Status:</span>
                <Badge
                  className="ml-2"
                  style={{
                    backgroundColor: STATUS_COLORS[selectedNode.status || 'healthy'],
                    color: 'white'
                  }}
                >
                  {selectedNode.status || 'unknown'}
                </Badge>
              </div>
              {selectedNode.location && (
                <div>
                  <span className="font-semibold text-gray-700">Location:</span>
                  <span className="ml-2">{selectedNode.location}</span>
                </div>
              )}
              {selectedNode.tunnel_url && (
                <div className="col-span-2">
                  <span className="font-semibold text-gray-700">Tunnel URL:</span>
                  <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">{selectedNode.tunnel_url}</code>
                </div>
              )}
              {selectedNode.services && selectedNode.services.length > 0 && (
                <div className="col-span-2">
                  <span className="font-semibold text-gray-700">Services:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.services.map((service, i) => (
                      <Badge key={i} variant="secondary">{service}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedNode.load !== undefined && (
                <div>
                  <span className="font-semibold text-gray-700">Load:</span>
                  <span className="ml-2">{(selectedNode.load * 100).toFixed(0)}%</span>
                </div>
              )}
              {selectedNode.capabilities?.gpu_type && (
                <div>
                  <span className="font-semibold text-gray-700">GPU:</span>
                  <span className="ml-2">{selectedNode.capabilities.gpu_type}</span>
                </div>
              )}
              {selectedNode.capabilities?.cpu_cores && (
                <div>
                  <span className="font-semibold text-gray-700">CPU Cores:</span>
                  <span className="ml-2">{selectedNode.capabilities.cpu_cores}</span>
                </div>
              )}
              {selectedNode.capabilities?.ram && (
                <div>
                  <span className="font-semibold text-gray-700">RAM:</span>
                  <span className="ml-2">{selectedNode.capabilities.ram}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DHTTopologyGraph;
