'use client';

import React, { useState } from 'react';
import GraphExtractionComponent from '@/components/GraphExtractionComponent';
import GraphVisualizer from '@/components/GraphVisualizer';
import axios from 'axios';

interface ExtractionResult {
  graph_id: string;
  entities: Array<{
    id: string;
    text: string;
    entity_type: string;
    confidence: number;
  }>;
  relationships: Array<{
    id: string;
    entity1_id: string;
    entity2_id: string;
    relation_type: string;
    confidence: number;
  }>;
}

export default function ExtractPage() {
  const [graphData, setGraphData] = useState<ExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExtractionComplete = (result: any) => {
    // Fetch the full graph data from Neo4j
    if (result.graph_id) {
      fetchGraphData(result.graph_id);
    }
  };

  const fetchGraphData = async (graphId: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:8108/graph/${graphId}`);
      setGraphData(response.data);
    } catch (err) {
      console.error('Failed to fetch graph:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Neo4j Entity & Relationship Extraction</h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Extract entities and relationships from documents into the Neo4j knowledge graph
          </p>
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Left: Extraction Form */}
          <div style={{ gridColumn: '1', display: 'flex', flexDirection: 'column' }}>
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff' }}>
              <GraphExtractionComponent />
            </div>
          </div>

          {/* Right: Graph Visualization */}
          <div style={{ gridColumn: '2', display: 'flex', flexDirection: 'column' }}>
            {graphData ? (
              <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff', height: '700px', overflowY: 'auto' }}>
                <h2>Graph Visualization</h2>
                <GraphVisualizer
                  graphData={graphData}
                  title={`${graphData.entities.length} Entities, ${graphData.relationships.length} Relationships`}
                />
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '40px',
                  backgroundColor: '#f9f9f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '500px',
                  textAlign: 'center',
                }}
              >
                {loading ? (
                  <div>
                    <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading graph visualization...</div>
                    <div style={{ color: '#999', fontSize: '14px' }}>This may take a moment...</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '18px', marginBottom: '10px', color: '#999' }}>
                      Extract entities to visualize the graph
                    </div>
                    <div style={{ color: '#bbb', fontSize: '14px' }}>
                      The graph will appear here after extraction
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
