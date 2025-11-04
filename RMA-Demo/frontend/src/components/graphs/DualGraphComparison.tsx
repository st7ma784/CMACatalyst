/**
 * DualGraphComparison Component
 * Side-by-side visualization of manual vs client graphs with applicable rules
 */

'use client';

import React, { useState, useEffect } from 'react';
import { DualGraphComparisonProps, GraphComparison, ApplicableRule } from '@/types/graph.types';
import { graphService } from '@/services/graphService';
import GraphViewer from './GraphViewer';
import ApplicableRulesList from './ApplicableRulesList';
import EntitySearch from './EntitySearch';
import TemporalSelector from './TemporalSelector';
import styles from '@/styles/graphs.module.css';

const DualGraphComparison: React.FC<DualGraphComparisonProps> = ({
  manualGraphId,
  clientGraphId,
  onApplicableRuleSelect,
  onEntitySelect,
}) => {
  const [comparison, setComparison] = useState<GraphComparison | null>(null);
  const [applicableRules, setApplicableRules] = useState<ApplicableRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState<'confidence' | 'temporal' | 'name'>('confidence');

  // Load comparison when component mounts or IDs change
  useEffect(() => {
    const loadComparison = async () => {
      setLoading(true);
      setError(null);

      try {
        // Compare graphs
        const comparisonResult = await graphService.compareGraphs(
          manualGraphId,
          clientGraphId
        );
        setComparison(comparisonResult);

        // Get applicable rules
        const rules = await graphService.getApplicableRules(
          manualGraphId,
          clientGraphId,
          selectedDate
        );
        setApplicableRules(rules);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load comparison';
        setError(errorMessage);
        console.error('Error loading comparison:', err);
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [manualGraphId, clientGraphId, selectedDate]);

  const handleRuleClick = (rule: ApplicableRule) => {
    // Highlight matched entities in graphs
    const nodeIds = rule.matched_entities.map(m => m.manual_entity_id);
    setHighlightedNodes(nodeIds);
    onApplicableRuleSelect?.(rule);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <p>Loading graph comparison...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className={styles.dualComparison}>
      {/* Manual Graph - Left */}
      <div className={styles.manualSide}>
        <GraphViewer
          graphId={manualGraphId}
          graphType="manual"
          title="Knowledge Base (Manual Rules)"
          height="600px"
          highlightedNodes={highlightedNodes}
          onNodeClick={onEntitySelect}
        />
      </div>

      {/* Comparison Panel - Center */}
      <div className={styles.highlights}>
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
            Comparison Analysis
          </h3>
        </div>

        {/* Temporal Selector */}
        <TemporalSelector
          graphId={manualGraphId}
          onDateChange={handleDateChange}
          initialDate={selectedDate}
        />

        {/* Entity Search */}
        <EntitySearch
          graphId={manualGraphId}
          onResultSelect={onEntitySelect}
          placeholder="Search entities..."
        />

        {/* Sort Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSortBy('confidence')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: sortBy === 'confidence' ? '#3b82f6' : '#f3f4f6',
              color: sortBy === 'confidence' ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            By Confidence
          </button>
          <button
            onClick={() => setSortBy('temporal')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: sortBy === 'temporal' ? '#3b82f6' : '#f3f4f6',
              color: sortBy === 'temporal' ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            By Status
          </button>
        </div>

        {/* Applicable Rules */}
        <ApplicableRulesList
          rules={applicableRules}
          onRuleClick={handleRuleClick}
          sortBy={sortBy}
          maxHeight="400px"
        />

        {/* Gaps */}
        {comparison?.gaps && comparison.gaps.length > 0 && (
          <div style={{ padding: '12px', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
              Missing Information
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#78350f' }}>
              {comparison.gaps.slice(0, 5).map((gap, idx) => (
                <li key={idx}>{gap}</li>
              ))}
              {comparison.gaps.length > 5 && (
                <li>... and {comparison.gaps.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Statistics */}
        {comparison && (
          <div style={{ padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#1e40af' }}>
              Match Statistics
            </h4>
            <div style={{ fontSize: '12px', color: '#1e3a8a', lineHeight: '1.6' }}>
              <div>Matched Entities: {comparison.matches.length}</div>
              <div>Applicable Rules: {applicableRules.length}</div>
              <div>Average Similarity: {comparison.matches.length > 0 ? (
                (comparison.matches.reduce((sum, m) => sum + m.similarity_score, 0) / comparison.matches.length * 100).toFixed(1)
              ) : 0}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Client Graph - Right */}
      <div className={styles.clientSide}>
        <GraphViewer
          graphId={clientGraphId}
          graphType="client"
          title="Client Situation"
          height="600px"
          highlightedNodes={highlightedNodes}
          onNodeClick={onEntitySelect}
        />
      </div>
    </div>
  );
};

export default DualGraphComparison;
