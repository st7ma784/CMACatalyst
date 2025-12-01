'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Entity {
  id: string;
  text: string;
  entity_type: string;
  confidence: number;
}

interface Relationship {
  id: string;
  entity1_id: string;
  entity2_id: string;
  relation_type: string;
  confidence: number;
}

interface GraphData {
  entities: Entity[];
  relationships: Relationship[];
}

interface D3Node extends Entity {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link extends Relationship {
  source: string | D3Node;
  target: string | D3Node;
}

const ENTITY_COLORS: Record<string, string> = {
  DEBT_TYPE: '#FF6B6B',
  OBLIGATION: '#4ECDC4',
  RULE: '#45B7D1',
  GATE: '#FFA07A',
  MONEY_THRESHOLD: '#98D8C8',
  CREDITOR: '#F7DC6F',
  REPAYMENT_TERM: '#BB8FCE',
  LEGAL_STATUS: '#85C1E2',
  CLIENT_ATTRIBUTE: '#F8B88B',
  PERSON: '#82E0AA',
  ORGANIZATION: '#F5B7B1',
  DATE: '#D7BDE2',
  MONEY: '#AED6F1',
  PERCENT: '#F9E79F',
  LOCATION: '#D5F4E6',
  DURATION: '#FADBD8',
};

interface GraphVisualizerProps {
  graphData: GraphData;
  title?: string;
  onEntityClick?: (entity: Entity) => void;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ graphData, title, onEntityClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !graphData.entities.length) return;

    // Clear previous content
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Create nodes and links
    const nodes: D3Node[] = graphData.entities.map((e) => ({ ...e }));
    const links: D3Link[] = graphData.relationships.map((r) => ({
      ...r,
      source: r.entity1_id,
      target: r.entity2_id,
    }));

    // Create simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id((d) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    // Create SVG elements
    const g = svg.append('g');

    // Arrows for directed links
    svg
      .append('defs')
      .selectAll('marker')
      .data(['arrowhead'])
      .enter()
      .append('marker')
      .attr('id', (d) => d)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 28)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#999');

    // Links
    const linkSelection = g
      .selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => 2 + d.confidence * 3)
      .attr('marker-end', 'url(#arrowhead)');

    // Link labels
    const linkLabels = g
      .selectAll('.link-label')
      .data(links)
      .enter()
      .append('text')
      .attr('class', 'link-label')
      .attr('font-size', '11px')
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .text((d) => d.relation_type);

    // Nodes
    const nodeSelection = g
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', 25)
      .attr('fill', (d) => ENTITY_COLORS[d.entity_type] || '#999')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
        onEntityClick?.(d);
      });

    // Node labels
    const textSelection = g
      .selectAll('.node-label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('font-size', '12px')
      .attr('fill', '#fff')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text((d) => d.text.substring(0, 8));

    // Node titles for hover
    nodeSelection
      .append('title')
      .text((d) => `${d.text}\n${d.entity_type}\nConfidence: ${(d.confidence * 100).toFixed(0)}%`);

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d) => (d.source as D3Node).x || 0)
        .attr('y1', (d) => (d.source as D3Node).y || 0)
        .attr('x2', (d) => (d.target as D3Node).x || 0)
        .attr('y2', (d) => (d.target as D3Node).y || 0);

      linkLabels
        .attr('x', (d) => (((d.source as D3Node).x || 0) + ((d.target as D3Node).x || 0)) / 2)
        .attr('y', (d) => (((d.source as D3Node).y || 0) + ((d.target as D3Node).y || 0)) / 2);

      nodeSelection.attr('cx', (d) => d.x || 0).attr('cy', (d) => d.y || 0);

      textSelection.attr('x', (d) => d.x || 0).attr('y', (d) => d.y || 0);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, onEntityClick]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {title && <h3 style={{ margin: '10px 0' }}>{title}</h3>}
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '500px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: '#fafafa',
        }}
      />
      {selectedNode && (
        <div
          style={{
            marginTop: '15px',
            padding: '15px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            border: '1px solid #999',
          }}
        >
          <h4>Selected: {selectedNode.text}</h4>
          <p>
            <strong>Type:</strong> {selectedNode.entity_type}
          </p>
          <p>
            <strong>Confidence:</strong> {(selectedNode.confidence * 100).toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
};

export default GraphVisualizer;
