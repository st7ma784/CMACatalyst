/**
 * useGraphData Hook
 * Manages fetching and caching graph data
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DocumentGraph, Entity, Relationship } from '@/types/graph.types';
import { graphService } from '@/services/graphService';

interface UseGraphDataReturn {
  graph: DocumentGraph | null;
  nodes: Entity[];
  edges: Relationship[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGraphData(graphId: string | null): UseGraphDataReturn {
  const [graph, setGraph] = useState<DocumentGraph | null>(null);
  const [nodes, setNodes] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!graphId) {
      setGraph(null);
      setNodes([]);
      setEdges([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await graphService.getGraph(graphId);
      setGraph(data);
      setNodes(data.entities);
      setEdges(data.relationships);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load graph';
      setError(errorMessage);
      console.error('Error loading graph:', err);
    } finally {
      setLoading(false);
    }
  }, [graphId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return {
    graph,
    nodes,
    edges,
    loading,
    error,
    refetch: fetchGraph,
  };
}

export default useGraphData;
