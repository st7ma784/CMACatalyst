/**
 * TemporalSelector Component
 * Filter relationships by temporal validity
 */

'use client';

import React, { useState, useEffect } from 'react';
import { TemporalSelectorProps } from '@/types/graph.types';
import { graphService } from '@/services/graphService';
import styles from '@/styles/graphs.module.css';

const TemporalSelector: React.FC<TemporalSelectorProps> = ({
  graphId,
  onDateChange,
  initialDate,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
  );
  const [activeRulesCount, setActiveRulesCount] = useState(0);
  const [expiredRulesCount, setExpiredRulesCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Update graph when date changes
    const updateGraph = async () => {
      setLoading(true);
      try {
        const date = new Date(selectedDate);
        await graphService.filterGraphByDate(graphId, date);
        onDateChange?.(date);

        // Calculate active vs expired rules (mock for now)
        // In real implementation, this would come from the backend
        setActiveRulesCount(Math.floor(Math.random() * 10) + 5);
        setExpiredRulesCount(Math.floor(Math.random() * 5));
      } catch (error) {
        console.error('Failed to update graph:', error);
      } finally {
        setLoading(false);
      }
    };

    updateGraph();
  }, [selectedDate, graphId, onDateChange]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setSelectedDate(nextWeek.toISOString().split('T')[0]);
  };

  return (
    <div className={styles.temporalSelector}>
      <label>Effective As Of:</label>
      <input
        type="date"
        value={selectedDate}
        onChange={handleDateChange}
        disabled={loading}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={handleToday}
          style={{
            flex: 1,
            padding: '6px 8px',
            fontSize: '11px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          disabled={loading}
        >
          Today
        </button>
        <button
          onClick={handleTomorrow}
          style={{
            flex: 1,
            padding: '6px 8px',
            fontSize: '11px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          disabled={loading}
        >
          Tomorrow
        </button>
        <button
          onClick={handleNextWeek}
          style={{
            flex: 1,
            padding: '6px 8px',
            fontSize: '11px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          disabled={loading}
        >
          +7 Days
        </button>
      </div>

      {loading ? (
        <div className={styles.temporalInfo}>
          Updating graph...
        </div>
      ) : (
        <div className={styles.temporalInfo}>
          <div>
            <strong>Active Rules:</strong> {activeRulesCount}
          </div>
          <div>
            <strong>Expired Rules:</strong> {expiredRulesCount}
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.5' }}>
            Solid lines: Active rules
            <br />
            Dashed lines: Expired rules
            <br />
            Dotted lines: Future rules
          </div>
        </div>
      )}
    </div>
  );
};

export default TemporalSelector;
