/**
 * ApplicableRulesList Component
 * Display rules from manual graph that apply to client
 */

'use client';

import React, { useState } from 'react';
import { ApplicableRulesListProps, ApplicableRule } from '@/types/graph.types';
import styles from '@/styles/graphs.module.css';

const ApplicableRulesList: React.FC<ApplicableRulesListProps> = ({
  rules,
  onRuleClick,
  sortBy = 'confidence',
  maxHeight = '400px',
}) => {
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Sort rules
  const sortedRules = [...rules].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence;
      case 'temporal':
        const statusOrder = { ACTIVE: 0, FUTURE: 1, EXPIRED: 2 };
        return (statusOrder[a.temporal_status] || 3) - (statusOrder[b.temporal_status] || 3);
      case 'name':
        return a.rule_text.localeCompare(b.rule_text);
      default:
        return 0;
    }
  });

  const handleRuleClick = (rule: ApplicableRule) => {
    setSelectedRule(rule.rule_id);
    onRuleClick?.(rule);
  };

  const getTemporalColor = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return '#10b981';
      case 'FUTURE':
        return '#f59e0b';
      case 'EXPIRED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{ maxHeight, overflow: 'auto' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#111827' }}>
        Applicable Rules ({rules.length})
      </h4>

      {rules.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
          No applicable rules found
        </div>
      ) : (
        <ul className={styles.applicableRulesList}>
          {sortedRules.map((rule) => (
            <li
              key={rule.rule_id}
              className={`${styles.applicableRuleItem} ${selectedRule === rule.rule_id ? styles.active : ''}`}
              onClick={() => handleRuleClick(rule)}
              onDoubleClick={() => setExpandedRule(expandedRule === rule.rule_id ? null : rule.rule_id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div className={styles.applicableRuleText}>
                  {rule.rule_text.length > 80 ? `${rule.rule_text.substring(0, 80)}...` : rule.rule_text}
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: getTemporalColor(rule.temporal_status),
                    color: 'white',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rule.temporal_status}
                </span>
              </div>

              {rule.reasoning && (
                <div className={styles.applicableRuleReasoning}>
                  {rule.reasoning.length > 100 ? `${rule.reasoning.substring(0, 100)}...` : rule.reasoning}
                </div>
              )}

              <div className={styles.applicableRuleConfidence}>
                <span>Confidence:</span>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${rule.confidence * 100}%` }}
                  />
                </div>
                <span>{(rule.confidence * 100).toFixed(0)}%</span>
              </div>

              {expandedRule === rule.rule_id && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280' }}>
                  <div>
                    <strong>Full Text:</strong>
                    <p style={{ margin: '4px 0 0 0', lineHeight: '1.5' }}>{rule.rule_text}</p>
                  </div>

                  {rule.reasoning && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Reasoning:</strong>
                      <p style={{ margin: '4px 0 0 0', lineHeight: '1.5' }}>{rule.reasoning}</p>
                    </div>
                  )}

                  {rule.temporal_metadata && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Temporal:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', lineHeight: '1.5' }}>
                        {rule.temporal_metadata.effective_date && (
                          <li>Effective: {rule.temporal_metadata.effective_date}</li>
                        )}
                        {rule.temporal_metadata.expiry_date && (
                          <li>Expires: {rule.temporal_metadata.expiry_date}</li>
                        )}
                        {rule.temporal_metadata.as_of_date && (
                          <li>Evaluated as of: {rule.temporal_metadata.as_of_date}</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {rule.gates && rule.gates.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Gates:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', lineHeight: '1.5' }}>
                        {rule.gates.map((gate, idx) => (
                          <li key={idx}>
                            {gate.gate_type}: {gate.condition} ({gate.satisfied ? '✓' : '✗'})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rule.matched_entities.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Matched Entities ({rule.matched_entities.length}):</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', lineHeight: '1.5', fontSize: '11px' }}>
                        {rule.matched_entities.slice(0, 5).map((match, idx) => (
                          <li key={idx}>
                            {match.match_type}: {match.manual_entity_id}
                          </li>
                        ))}
                        {rule.matched_entities.length > 5 && (
                          <li>... and {rule.matched_entities.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '8px', fontSize: '10px', color: '#9ca3af' }}>
                Double-click to expand
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ApplicableRulesList;
