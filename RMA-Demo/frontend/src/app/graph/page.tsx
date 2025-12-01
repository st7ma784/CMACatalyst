'use client';

import Link from 'next/link';
import React from 'react';

export default function GraphDashboard() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '32px', margin: '0 0 8px 0' }}>Neo4j Graph Tools</h1>
          <p style={{ color: '#666', margin: '0', fontSize: '16px' }}>
            Entity extraction, graph visualization, and rule matching for financial advisory
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #ddd', padding: '0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '30px', padding: '15px 0' }}>
            <Link href="/graph/extract" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>
              Extract Entities
            </Link>
            <Link href="/graph/ingest" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>
              Ingest Documents
            </Link>
            <Link href="/graph/compare" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>
              Compare Graphs
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Overview */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Overview</h2>
          <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#555', marginBottom: '15px' }}>
            This dashboard provides tools for building and visualizing Neo4j knowledge graphs extracted from financial advisory documents.
            The system extracts entities (like debt types, obligations, rules) and relationships between them to enable intelligent matching
            of client situations against established financial advice.
          </p>
        </div>

        {/* Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {/* Extract Card */}
          <Link href="/graph/extract" style={{ textDecoration: 'none' }}>
            <div
              style={{
                padding: '25px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
              <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#333' }}>Extract Entities</h3>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                Parse markdown documents to extract entities (debt types, obligations, rules) and relationships for graph construction
              </p>
              <div style={{ marginTop: '15px', fontSize: '13px', color: '#007bff', fontWeight: 'bold' }}>
                View Tool →
              </div>
            </div>
          </Link>

          {/* Ingest Card */}
          <Link href="/graph/ingest" style={{ textDecoration: 'none' }}>
            <div
              style={{
                padding: '25px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
              <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#333' }}>Ingest Documents</h3>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                Upload multiple documents to the RAG vector store and automatically extract Neo4j graphs for all of them
              </p>
              <div style={{ marginTop: '15px', fontSize: '13px', color: '#007bff', fontWeight: 'bold' }}>
                View Tool →
              </div>
            </div>
          </Link>

          {/* Compare Card */}
          <Link href="/graph/compare" style={{ textDecoration: 'none' }}>
            <div
              style={{
                padding: '25px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚖️</div>
              <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#333' }}>Compare Graphs</h3>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                Compare manual knowledge graphs against client situation graphs to find applicable rules and reasoning
              </p>
              <div style={{ marginTop: '15px', fontSize: '13px', color: '#007bff', fontWeight: 'bold' }}>
                View Tool →
              </div>
            </div>
          </Link>
        </div>

        {/* How It Works */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>How It Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            {/* Step 1 */}
            <div style={{ backgroundColor: '#e7f3ff', padding: '20px', borderRadius: '8px', border: '1px solid #b0d4e3' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff', marginBottom: '10px' }}>1</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Upload Documents</h4>
              <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                Add markdown or text files containing financial advice or client information
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ backgroundColor: '#f0f8d4', padding: '20px', borderRadius: '8px', border: '1px solid #d4e8b0' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745', marginBottom: '10px' }}>2</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Extract Entities</h4>
              <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                NER service identifies entities (16 types) and relationships (13 types) in documents
              </p>
            </div>

            {/* Step 3 */}
            <div style={{ backgroundColor: '#fff3e0', padding: '20px', borderRadius: '8px', border: '1px solid #ffe0b0' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800', marginBottom: '10px' }}>3</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Build Graphs</h4>
              <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                Graph data stored in Neo4j with full entity/relationship information
              </p>
            </div>

            {/* Step 4 */}
            <div style={{ backgroundColor: '#f8f0ff', padding: '20px', borderRadius: '8px', border: '1px solid #e0b0f0' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9c27b0', marginBottom: '10px' }}>4</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Compare & Match</h4>
              <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                Find applicable rules by comparing client graph against knowledge base
              </p>
            </div>
          </div>
        </div>

        {/* Architecture Info */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '30px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>System Architecture</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#333' }}>Backend Services</h3>
              <ul style={{ margin: '0', paddingLeft: '20px', color: '#666', lineHeight: '2' }}>
                <li><strong>NER Service</strong> (port 8108) - Entity & relationship extraction</li>
                <li><strong>RAG Service</strong> (port 8102) - Document ingestion & retrieval</li>
                <li><strong>Neo4j</strong> (port 7687) - Knowledge graph storage</li>
                <li><strong>Ollama</strong> (port 11434) - Vision & LLM models</li>
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#333' }}>Entity Types Supported</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  'DEBT_TYPE',
                  'OBLIGATION',
                  'RULE',
                  'GATE',
                  'MONEY_THRESHOLD',
                  'CREDITOR',
                  'REPAYMENT_TERM',
                  'LEGAL_STATUS',
                  'CLIENT_ATTRIBUTE',
                  'PERSON',
                  'ORGANIZATION',
                  'DATE',
                  'MONEY',
                  'PERCENT',
                  'LOCATION',
                  'DURATION',
                ].map((type) => (
                  <span
                    key={type}
                    style={{
                      backgroundColor: '#f0f0f0',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#333',
                    }}
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: '#f9f9f9', borderTop: '1px solid #ddd', padding: '20px', marginTop: '40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', color: '#999', fontSize: '14px' }}>
          <p>CMACatalyst RMA Demo • Neo4j Knowledge Graph Builder</p>
        </div>
      </div>
    </div>
  );
}
