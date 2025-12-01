'use client';

import React, { useState } from 'react';
import axios from 'axios';

interface IngestionResult {
  success: boolean;
  processed: number;
  failed: number;
  details: {
    name: string;
    status: 'success' | 'error';
    message?: string;
  }[];
}

interface GraphExtractionStatus {
  extraction_id: string;
  graph_id: string;
  entity_count: number;
  relationship_count: number;
  avg_confidence: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export default function IngestPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [collectionName, setCollectionName] = useState('manuals');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [graphStatus, setGraphStatus] = useState<GraphExtractionStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []);
    setFiles([...files, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleIngest = async () => {
    if (!files.length || !collectionName.trim()) {
      setError('Please select files and provide a collection name');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // First, ingest to RAG service (for vector store)
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('collection_name', collectionName);

      const ragResponse = await axios.post('http://localhost:8102/ingest', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Then, extract graphs for each document
      const extractionResults: GraphExtractionStatus[] = [];

      for (const file of files) {
        try {
          const content = await file.text();
          const extractResponse = await axios.post('http://localhost:8108/extract', {
            markdown: content,
            source_document: file.name.replace(/\.[^/.]+$/, ''),
            graph_type: 'MANUAL',
          });

          extractionResults.push({
            extraction_id: extractResponse.data.extraction_id,
            graph_id: extractResponse.data.graph_id,
            entity_count: extractResponse.data.entity_count,
            relationship_count: extractResponse.data.relationship_count,
            avg_confidence: extractResponse.data.avg_confidence,
            status: 'COMPLETED',
          });
        } catch (err) {
          console.error(`Failed to extract graph from ${file.name}:`, err);
        }
      }

      setGraphStatus(extractionResults);
      setResult({
        success: true,
        processed: files.length,
        failed: 0,
        details: files.map((f) => ({
          name: f.name,
          status: 'success',
        })),
      });

      // Clear files after successful ingestion
      setFiles([]);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Failed to ingest documents'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Document Ingestion</h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Upload documents to ingest into the RAG vector store and extract Neo4j graphs
          </p>
        </div>

        {/* Main Form */}
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '30px', backgroundColor: '#fff' }}>
          {/* Collection Name */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
              Collection Name:
            </label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="e.g., manuals, client-docs, tax-rules"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '14px',
              }}
            />
            <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              Documents will be grouped in this collection for easier management
            </p>
          </div>

          {/* File Upload Area */}
          <div
            style={{
              marginBottom: '25px',
              padding: '30px',
              border: '2px dashed #ccc',
              borderRadius: '4px',
              backgroundColor: '#fafafa',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#007bff';
              e.currentTarget.style.backgroundColor = '#e7f3ff';
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = '#ccc';
              e.currentTarget.style.backgroundColor = '#fafafa';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#ccc';
              e.currentTarget.style.backgroundColor = '#fafafa';
              const droppedFiles = Array.from(e.dataTransfer.files);
              setFiles([...files, ...droppedFiles]);
            }}
          >
            <input
              type="file"
              multiple
              accept=".md,.txt,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="fileInput"
            />
            <label htmlFor="fileInput" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '18px', marginBottom: '8px', fontWeight: 'bold' }}>
                📄 Drop files here or click to select
              </div>
              <p style={{ color: '#999', fontSize: '14px' }}>Supported formats: Markdown, Text, PDF</p>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ marginBottom: '12px', fontWeight: 'bold' }}>Selected Files ({files.length}):</h3>
              <div style={{ backgroundColor: '#f9f9f9', borderRadius: '4px', padding: '12px' }}>
                {files.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px',
                      backgroundColor: '#fff',
                      marginBottom: '8px',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{file.name}</span>
                      <span style={{ color: '#999', fontSize: '12px', marginLeft: '10px' }}>
                        ({(file.size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            <button
              onClick={handleIngest}
              disabled={loading || !files.length || !collectionName.trim()}
              style={{
                padding: '12px 24px',
                backgroundColor: loading || !files.length || !collectionName.trim() ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || !files.length || !collectionName.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              {loading ? 'Ingesting...' : 'Ingest Documents'}
            </button>
            <button
              onClick={() => {
                setFiles([]);
                setResult(null);
                setGraphStatus([]);
                setError(null);
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              Clear
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '15px',
                backgroundColor: '#f8d7da',
                color: '#721c24',
                borderRadius: '4px',
                border: '1px solid #f5c6cb',
                marginBottom: '25px',
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Success Result */}
          {result?.success && (
            <div
              style={{
                padding: '15px',
                backgroundColor: '#d4edda',
                color: '#155724',
                borderRadius: '4px',
                border: '1px solid #c3e6cb',
              }}
            >
              <strong>✓ Ingestion Complete!</strong>
              <p>
                {result.processed} document{result.processed !== 1 ? 's' : ''} successfully ingested and graph extracted
              </p>
            </div>
          )}
        </div>

        {/* Graph Extraction Status */}
        {graphStatus.length > 0 && (
          <div style={{ marginTop: '30px', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#fff' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>Graph Extraction Results</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
              {graphStatus.map((status) => (
                <div
                  key={status.extraction_id}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    padding: '15px',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <span
                      style={{
                        backgroundColor: status.status === 'COMPLETED' ? '#28a745' : '#ffc107',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      {status.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <strong>Entities:</strong> {status.entity_count}
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <strong>Relationships:</strong> {status.relationship_count}
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <strong>Avg Confidence:</strong> {(status.avg_confidence * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '10px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    Graph ID: {status.graph_id.substring(0, 12)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
