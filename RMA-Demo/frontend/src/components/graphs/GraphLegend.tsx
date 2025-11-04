/**
 * GraphLegend Component
 * Displays legend for entity types and their colors
 */

'use client';

import React, { useState } from 'react';
import { GraphLegendProps, EntityType } from '@/types/graph.types';
import styles from '@/styles/graphs.module.css';

const ENTITY_COLORS: Record<EntityType, string> = {
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

const GraphLegend: React.FC<GraphLegendProps> = ({
  entityTypes,
  onEntityTypeFilter,
  showRelationships = false,
}) => {
  const [expandedRelationships, setExpandedRelationships] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<EntityType>>(new Set(entityTypes));

  const handleTypeToggle = (type: EntityType) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(type)) {
      newSelected.delete(type);
    } else {
      newSelected.add(type);
    }
    setSelectedTypes(newSelected);
    onEntityTypeFilter?.(Array.from(newSelected));
  };

  const handleSelectAll = () => {
    const allSelected = selectedTypes.size === entityTypes.length;
    const newSelected = allSelected ? new Set<EntityType>() : new Set(entityTypes);
    setSelectedTypes(newSelected);
    onEntityTypeFilter?.(Array.from(newSelected));
  };

  return (
    <div className={styles.legend}>
      <h4>Entity Types</h4>

      <div className={styles.legendControls}>
        <button
          onClick={handleSelectAll}
          className={styles.selectAllButton}
        >
          {selectedTypes.size === entityTypes.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <ul className={styles.legendList}>
        {entityTypes.map((type) => (
          <li key={type} className={styles.legendItem}>
            <label className={styles.legendLabel}>
              <input
                type="checkbox"
                checked={selectedTypes.has(type)}
                onChange={() => handleTypeToggle(type)}
                className={styles.legendCheckbox}
              />
              <span
                className={styles.legendColor}
                style={{ backgroundColor: ENTITY_COLORS[type] }}
              />
              <span className={styles.legendText}>{type}</span>
            </label>
          </li>
        ))}
      </ul>

      {showRelationships && (
        <div className={styles.relationshipsSection}>
          <button
            onClick={() => setExpandedRelationships(!expandedRelationships)}
            className={styles.expandButton}
          >
            {expandedRelationships ? '▼' : '▶'} Relationships
          </button>

          {expandedRelationships && (
            <ul className={styles.relationshipsList}>
              <li>→ IS_A (Inheritance)</li>
              <li>↔ PART_OF (Composition)</li>
              <li>⟷ SYNONYMOUS (Alias)</li>
              <li>⇒ TRIGGERS (Causation)</li>
              <li>⊙ REQUIRES (Dependency)</li>
              <li>⊘ BLOCKS (Prohibition)</li>
              <li>↪ FOLLOWS (Sequence)</li>
              <li>⚖ AFFECTS_REPAYMENT (Impact)</li>
              <li>🚪 HAS_GATE (Condition)</li>
              <li>✗ CONTRADICTS (Conflict)</li>
              <li>∪ EXTENDS (Expansion)</li>
              <li>✓ APPLICABLE_TO (Scope)</li>
              <li>⚡ ENABLES (Permission)</li>
              <li>🔒 RESTRICTS (Limitation)</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphLegend;
