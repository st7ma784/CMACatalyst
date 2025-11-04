/**
 * useD3Graph Hook
 * Manages D3.js force simulation and rendering
 */

'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { D3Node, D3Link, Entity, Relationship } from '@/types/graph.types';

interface UseD3GraphParams {
  nodes: Entity[];
  edges: Relationship[];
  width: number;
  height: number;
  onNodeClick?: (node: Entity) => void;
  onEdgeClick?: (edge: Relationship) => void;
  highlightedNodes?: string[];
  highlightedEdges?: string[];
  nodeRadius?: number;
  linkDistance?: number;
  chargeStrength?: number;
}

interface UseD3GraphReturn {
  svgRef: React.RefObject<SVGSVGElement>;
  simulation: d3.Simulation<D3Node, D3Link> | null;
}

const ENTITY_COLORS: Record<string, string> = {
  DEBT_TYPE: '#E74C3C',
  OBLIGATION: '#F39C12',
  RULE: '#E74C3C',
  GATE: '#3498DB',
  MONEY_THRESHOLD: '#2ECC71',
  CREDITOR: '#9B59B6',
  REPAYMENT_TERM: '#1ABC9C',
  LEGAL_STATUS: '#34495E',
  CLIENT_ATTRIBUTE: '#95A5A6',
  PERSON: '#F1C40F',
  ORGANIZATION: '#E67E22',
  DATE: '#BDC3C7',
  MONEY: '#27AE60',
  PERCENT: '#16A085',
  LOCATION: '#2980B9',
  DURATION: '#8E44AD',
};

export function useD3Graph({
  nodes: inputNodes,
  edges: inputEdges,
  width,
  height,
  onNodeClick,
  onEdgeClick,
  highlightedNodes = [],
  highlightedEdges = [],
  nodeRadius = 6,
  linkDistance = 30,
  chargeStrength = -150,
}: UseD3GraphParams): UseD3GraphReturn {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  useEffect(() => {
    if (!svgRef.current || inputNodes.length === 0) return;

    // Prepare data with D3 compatibility
    const nodes: D3Node[] = inputNodes.map((node) => ({
      ...node,
      id: node.id,
      x: Math.random() * width,
      y: Math.random() * height,
    }));

    const links: D3Link[] = inputEdges.map((edge) => ({
      ...edge,
      source: edge.entity1,
      target: edge.entity2,
    }));

    // Clear previous SVG
    d3.select(svgRef.current).selectAll('*').remove();

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background-color', '#f9fafb');

    // Add zoom behavior
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Create simulation
    const simulation = d3.forceSimulation<D3Node, D3Link>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id((d) => d.id)
        .distance(linkDistance))
      .force('charge', d3.forceManyBody<D3Node>().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>(nodeRadius * 2));

    // Create link elements
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#ccc')
      .attr('stroke-width', (d) => {
        const confidence = d.confidence ?? 0.5;
        return 0.5 + confidence * 2.5;
      })
      .attr('stroke-dasharray', (d) => {
        if (d.temporal?.expiry_date) {
          return '5,5'; // Dashed for temporal
        }
        return '0';
      })
      .attr('class', (d) => `edge ${highlightedEdges.includes(d.entity1 + d.entity2) ? 'highlighted' : ''}`)
      .on('click', (event, d) => {
        event.stopPropagation();
        onEdgeClick?.(d);
      });

    // Create node elements
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', nodeRadius)
      .attr('fill', (d) => ENTITY_COLORS[d.entity_type] || '#95A5A6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('class', (d) => `node ${highlightedNodes.includes(d.id) ? 'highlighted' : ''}`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d);
      });

    // Add labels for high-confidence nodes
    const labels = g.append('g')
      .selectAll('text')
      .data(nodes.filter(n => n.confidence >= 0.7))
      .enter()
      .append('text')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .attr('fill', '#333')
      .text((d) => d.text.substring(0, 10))
      .style('pointer-events', 'none');

    // Add tooltips
    const tooltip = d3.select('body')
      .append('div')
      .style('position', 'absolute')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('display', 'none');

    node.on('mouseover', (event, d) => {
      tooltip
        .style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .text(`${d.text} (${d.entity_type}) - ${(d.confidence * 100).toFixed(0)}%`);
    })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      });

    // Update positions on simulation
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x || 0)
        .attr('y1', (d) => (d.source as D3Node).y || 0)
        .attr('x2', (d) => (d.target as D3Node).x || 0)
        .attr('y2', (d) => (d.target as D3Node).y || 0);

      node
        .attr('cx', (d) => d.x || 0)
        .attr('cy', (d) => d.y || 0);

      labels
        .attr('x', (d) => d.x || 0)
        .attr('y', (d) => (d.y || 0) - nodeRadius - 5);
    });

    // Store simulation reference
    simulationRef.current = simulation;

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [inputNodes, inputEdges, width, height, nodeRadius, linkDistance, chargeStrength, highlightedNodes, highlightedEdges, onNodeClick, onEdgeClick]);

  return {
    svgRef,
    simulation: simulationRef.current,
  };
}

export default useD3Graph;
