'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Entity {
  id: string;
  text: string;
  entity_type: string;
  confidence: number;
  context?: string;
  source_paragraph?: number;
}

interface Relationship {
  id: string;
  entity1_id: string;
  entity2_id: string;
  relation_type: string;
  confidence: number;
  condition?: string;
  effective_date?: string;
  logic_gate?: string;
}

interface GraphExtractionResponse {
  extraction_id: string;
  graph_id: string;
  entity_count: number;
  relationship_count: number;
  avg_confidence: number;
  graph_type: string;
  status: string;
  entities?: Entity[];
  relationships?: Relationship[];
}

export const GraphExtractionComponent: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const [sourceDocument, setSourceDocument] = useState('');
  const [graphType, setGraphType] = useState<'MANUAL' | 'CLIENT'>('MANUAL');
  const [loading, setLoading] = useState(false);
  const [extractionResult, setExtractionResult] = useState<GraphExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const handleExtract = async () => {
    if (!markdown.trim() || !sourceDocument.trim()) {
      setError('Please provide both markdown content and document name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<GraphExtractionResponse>(
        'http://localhost:8108/extract',
        {
          markdown,
          source_document: sourceDocument,
          graph_type: graphType,
        }
      );

      setExtractionResult(response.data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Failed to extract graph'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setMarkdown(content);
      setSourceDocument(file.name.replace(/\.[^/.]+$/, ''));
    } catch (err) {
      setError('Failed to read file');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Neo4j Graph Extraction</h1>

      {/* Input Section */}
      <div style={{ marginBottom: '30px', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
        <h2>Extract Entities & Relationships</h2>

        {/* Document Input */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Document Name:
          </label>
          <input
            type="text"
            value={sourceDocument}
            onChange={(e) => setSourceDocument(e.target.value)}
            placeholder="e.g., client-facts or manual-rules"
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Graph Type Selection */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Graph Type:
          </label>
          <div style={{ display: 'flex', gap: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="radio"
                name="graphType"
                value="MANUAL"
                checked={graphType === 'MANUAL'}
                onChange={(e) => setGraphType(e.target.value as 'MANUAL' | 'CLIENT')}
              />
              Manual Knowledge Base
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="radio"
                name="graphType"
                value="CLIENT"
                checked={graphType === 'CLIENT'}
                onChange={(e) => setGraphType(e.target.value as 'MANUAL' | 'CLIENT')}
              />
              Client Situation
            </label>
          </div>
        </div>

        {/* Markdown Input */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Markdown Content:
          </label>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Paste or paste markdown content here..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Or Upload File:
          </label>
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleLoadFromFile}
            style={{
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExtract}
            disabled={loading || !markdown.trim() || !sourceDocument.trim()}
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
            {loading ? 'Extracting...' : 'Extract Graph'}
          </button>
          <button
            onClick={() => {
              setMarkdown('');
              setSourceDocument('');
              setExtractionResult(null);
              setError(null);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Clear
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

      {/* Results Section */}
      {extractionResult && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
          {/* Statistics */}
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
            <h2>Extraction Statistics</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Extraction ID:</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {extractionResult.extraction_id.substring(0, 12)}...
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Graph ID:</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {extractionResult.graph_id.substring(0, 12)}...
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Entities:</td>
                  <td style={{ padding: '8px', fontSize: '16px', fontWeight: 'bold', color: '#007bff' }}>
                    {extractionResult.entity_count}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Relationships:</td>
                  <td style={{ padding: '8px', fontSize: '16px', fontWeight: 'bold', color: '#28a745' }}>
                    {extractionResult.relationship_count}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>Avg Confidence:</td>
                  <td style={{ padding: '8px', fontSize: '16px', fontWeight: 'bold', color: '#ffc107' }}>
                    {(extractionResult.avg_confidence * 100).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Entity List */}
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
            <h2>Entities ({extractionResult.entities?.length || 0})</h2>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {extractionResult.entities?.slice(0, 20).map((entity) => (
                <div
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: selectedEntity?.id === entity.id ? '#e7f3ff' : '#fff',
                    border: selectedEntity?.id === entity.id ? '2px solid #007bff' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{entity.text}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Type: {entity.entity_type} | Confidence: {(entity.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Entity Details */}
          {selectedEntity && (
            <div style={{ gridColumn: '1 / -1', border: '1px solid #007bff', borderRadius: '8px', padding: '20px', backgroundColor: '#e7f3ff' }}>
              <h3>Selected Entity Details</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold', width: '20%' }}>Text:</td>
                    <td style={{ padding: '8px' }}>{selectedEntity.text}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Type:</td>
                    <td style={{ padding: '8px' }}>{selectedEntity.entity_type}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Confidence:</td>
                    <td style={{ padding: '8px' }}>{(selectedEntity.confidence * 100).toFixed(1)}%</td>
                  </tr>
                  {selectedEntity.context && (
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>Context:</td>
                      <td style={{ padding: '8px' }}>{selectedEntity.context}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Relationships */}
          <div style={{ gridColumn: '1 / -1', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
            <h2>Relationships ({extractionResult.relationships?.length || 0})</h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {extractionResult.relationships?.slice(0, 10).map((rel) => (
                <div
                  key={rel.id}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                    <strong>{rel.relation_type}</strong> (Confidence: {(rel.confidence * 100).toFixed(0)}%)
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {rel.entity1_id} → {rel.entity2_id}
                  </div>
                  {rel.condition && <div style={{ fontSize: '12px', color: '#f0ad4e' }}>Condition: {rel.condition}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphExtractionComponent;
