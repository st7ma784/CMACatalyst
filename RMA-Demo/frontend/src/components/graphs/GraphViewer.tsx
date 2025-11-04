/**
 * GraphViewer Component
 * Main visualization component for displaying knowledge graphs
 * Phase 3: Frontend Graph Visualization
 */

'use client';

import React, { useState } from 'react';
import { GraphViewerProps, Entity, Relationship } from '@/types/graph.types';
import useGraphData from '@/hooks/useGraphData';
import useD3Graph from '@/hooks/useD3Graph';
import GraphLegend from './GraphLegend';
import styles from '@/styles/graphs.module.css';

const GraphViewer: React.FC<GraphViewerProps> = ({
  graphId,
  graphType,
  title,
  editable = false,
  onNodeClick,
  onEdgeClick,
  height = '600px',
  highlightedNodes = [],
  highlightedEdges = [],
}) => {
  const { nodes, edges, loading, error, refetch } = useGraphData(graphId);
  const [selectedNode, setSelectedNode] = useState<Entity | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Relationship | null>(null);

  // Calculate SVG dimensions
  const width = typeof window !== 'undefined' ? window.innerWidth - 40 : 1200;
  const heightPx = parseInt(height);

  // Use D3 hook for rendering
  const { svgRef } = useD3Graph({
    nodes,
    edges,
    width,
    height: heightPx,
    onNodeClick: (node) => {
      setSelectedNode(node);
      onNodeClick?.(node);
    },
    onEdgeClick: (edge) => {
      setSelectedEdge(edge);
      onEdgeClick?.(edge);
    },
    highlightedNodes,
    highlightedEdges,
  });

  if (loading) {
    return (
      <div className={styles.graphViewerContainer}>
        <h3>{title}</h3>
        <div className={styles.loadingState}>
          <p>Loading graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.graphViewerContainer}>
        <h3>{title}</h3>
        <div className={styles.errorState}>
          <p>Error: {error}</p>
          <button onClick={refetch} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.graphViewerContainer}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <div className={styles.stats}>
          <span>{nodes.length} entities</span>
          <span>{edges.length} relationships</span>
        </div>
      </div>

      <div className={styles.viewerBody}>
        <div className={styles.graphCanvas}>
          <svg ref={svgRef} className={styles.svg} />
        </div>

        <div className={styles.sidebar}>
          <GraphLegend
            entityTypes={[...new Set(nodes.map(n => n.entity_type))]}
          />

          {selectedNode && (
            <div className={styles.selectedNode}>
              <h4>Selected Entity</h4>
              <p><strong>Text:</strong> {selectedNode.text}</p>
              <p><strong>Type:</strong> {selectedNode.entity_type}</p>
              <p><strong>Confidence:</strong> {(selectedNode.confidence * 100).toFixed(1)}%</p>
              <p><strong>Source:</strong> {selectedNode.source}</p>
              {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                <div>
                  <strong>Metadata:</strong>
                  <ul>
                    {Object.entries(selectedNode.metadata).map(([key, value]) => (
                      <li key={key}>{key}: {String(value)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {selectedEdge && (
            <div className={styles.selectedEdge}>
              <h4>Selected Relationship</h4>
              <p><strong>Type:</strong> {selectedEdge.type}</p>
              {selectedEdge.confidence && (
                <p><strong>Confidence:</strong> {(selectedEdge.confidence * 100).toFixed(1)}%</p>
              )}
              {selectedEdge.condition && (
                <p><strong>Condition:</strong> {selectedEdge.condition}</p>
              )}
              {selectedEdge.temporal && (
                <div>
                  <strong>Temporal:</strong>
                  {selectedEdge.temporal.effective_date && (
                    <p>From: {selectedEdge.temporal.effective_date}</p>
                  )}
                  {selectedEdge.temporal.expiry_date && (
                    <p>Until: {selectedEdge.temporal.expiry_date}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        <button onClick={refetch} className={styles.refreshButton}>
          ↻ Refresh
        </button>
        {editable && (
          <button className={styles.editButton}>
            ✎ Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default GraphViewer;
