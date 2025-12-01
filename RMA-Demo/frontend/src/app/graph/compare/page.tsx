'use client';

import React, { useState } from 'react';
import axios from 'axios';
import GraphVisualizer from '@/components/GraphVisualizer';

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

interface ApplicableRule {
  rule_id: string;
  rule_text: string;
  matched_entities: Entity[];
  matched_relationships: Relationship[];
  reasoning: string;
  confidence: number;
}

interface ComparisonResult {
  manual_graph_id: string;
  client_graph_id: string;
  applicable_rules: ApplicableRule[];
  explanation: string;
}

export default function ComparePage() {
  const [manualGraphId, setManualGraphId] = useState('');
  const [clientGraphId, setClientGraphId] = useState('');
  const [manualGraph, setManualGraph] = useState<GraphData | null>(null);
  const [clientGraph, setClientGraph] = useState<GraphData | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRule, setSelectedRule] = useState<ApplicableRule | null>(null);

  const handleFetchGraphs = async () => {
    if (!manualGraphId.trim() || !clientGraphId.trim()) {
      setError('Please provide both graph IDs');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [manualRes, clientRes] = await Promise.all([
        axios.get(`http://localhost:8108/graph/${manualGraphId}`),
        axios.get(`http://localhost:8108/graph/${clientGraphId}`),
      ]);

      setManualGraph(manualRes.data);
      setClientGraph(clientRes.data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Failed to fetch graphs'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!manualGraphId.trim() || !clientGraphId.trim()) {
      setError('Please provide both graph IDs');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8108/graph/compare', {
        manual_graph_id: manualGraphId,
        client_graph_id: clientGraphId,
      });

      setComparisonResult(response.data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Failed to compare graphs'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Graph Comparison & Rule Matching</h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Compare knowledge graphs to find applicable rules and reasoning
          </p>
        </div>

        {/* Input Section */}
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff', marginBottom: '20px' }}>
          <h2>Graph Selection</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Manual Graph ID:
              </label>
              <input
                type="text"
                value={manualGraphId}
                onChange={(e) => setManualGraphId(e.target.value)}
                placeholder="Paste graph ID..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Client Graph ID:
              </label>
              <input
                type="text"
                value={clientGraphId}
                onChange={(e) => setClientGraphId(e.target.value)}
                placeholder="Paste graph ID..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleFetchGraphs}
              disabled={loading || !manualGraphId.trim() || !clientGraphId.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor: loading ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {loading ? 'Loading...' : 'Load Graphs'}
            </button>
            <button
              onClick={handleCompare}
              disabled={loading || !manualGraphId.trim() || !clientGraphId.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor: loading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {loading ? 'Comparing...' : 'Compare & Find Rules'}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: '15px',
                padding: '15px',
                backgroundColor: '#f8d7da',
                color: '#721c24',
                borderRadius: '4px',
                border: '1px solid #f5c6cb',
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Two Column Graph Display */}
        {(manualGraph || clientGraph) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {manualGraph && (
              <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff' }}>
                <GraphVisualizer
                  graphData={manualGraph}
                  title={`Manual Knowledge Graph (${manualGraph.entities.length} entities)`}
                />
              </div>
            )}
            {clientGraph && (
              <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff' }}>
                <GraphVisualizer
                  graphData={clientGraph}
                  title={`Client Situation Graph (${clientGraph.entities.length} entities)`}
                />
              </div>
            )}
          </div>
        )}

        {/* Comparison Results */}
        {comparisonResult && (
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff' }}>
            <h2 style={{ marginBottom: '15px' }}>Applicable Rules</h2>

            {/* Summary */}
            <div
              style={{
                padding: '15px',
                backgroundColor: '#f0f8ff',
                borderRadius: '4px',
                marginBottom: '20px',
                border: '1px solid #b0d4e3',
              }}
            >
              <p style={{ margin: 0 }}>{comparisonResult.explanation}</p>
            </div>

            {/* Rules List */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
              {/* Rules Sidebar */}
              <div style={{ borderRight: '1px solid #eee', paddingRight: '20px' }}>
                <h3 style={{ marginBottom: '15px' }}>Found {comparisonResult.applicable_rules.length} Rules</h3>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {comparisonResult.applicable_rules.map((rule, index) => (
                    <div
                      key={rule.rule_id}
                      onClick={() => setSelectedRule(rule)}
                      style={{
                        padding: '12px',
                        marginBottom: '10px',
                        backgroundColor: selectedRule?.rule_id === rule.rule_id ? '#e7f3ff' : '#f9f9f9',
                        border: selectedRule?.rule_id === rule.rule_id ? '2px solid #007bff' : '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '13px', marginBottom: '5px' }}>
                        <strong>Rule {index + 1}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                        {rule.rule_text.substring(0, 100)}...
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#999',
                          marginTop: '5px',
                        }}
                      >
                        Confidence: {(rule.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rule Details */}
              <div>
                {selectedRule ? (
                  <div>
                    <h3 style={{ marginBottom: '15px' }}>Rule Details</h3>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ marginBottom: '8px', color: '#333' }}>Rule Text:</h4>
                      <p style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '4px', lineHeight: '1.6' }}>
                        {selectedRule.rule_text}
                      </p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ marginBottom: '8px', color: '#333' }}>Confidence: </h4>
                      <div
                        style={{
                          width: '100%',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          height: '24px',
                        }}
                      >
                        <div
                          style={{
                            width: `${selectedRule.confidence * 100}%`,
                            backgroundColor: '#28a745',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                        >
                          {(selectedRule.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ marginBottom: '8px', color: '#333' }}>Reasoning:</h4>
                      <p style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '4px', lineHeight: '1.6', color: '#555' }}>
                        {selectedRule.reasoning}
                      </p>
                    </div>

                    <div>
                      <h4 style={{ marginBottom: '8px', color: '#333' }}>
                        Matched Entities ({selectedRule.matched_entities.length}):
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {selectedRule.matched_entities.map((entity) => (
                          <span
                            key={entity.id}
                            style={{
                              backgroundColor: '#e7f3ff',
                              color: '#007bff',
                              padding: '6px 12px',
                              borderRadius: '16px',
                              fontSize: '12px',
                            }}
                          >
                            {entity.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#999',
                    }}
                  >
                    Select a rule to view details
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
