/**
 * EntitySearch Component
 * Search and filter entities within a graph
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EntitySearchProps, Entity, SearchResult } from '@/types/graph.types';
import { graphService } from '@/services/graphService';
import styles from '@/styles/graphs.module.css';

const EntitySearch: React.FC<EntitySearchProps> = ({
  graphId,
  onResultSelect,
  entityTypeFilter,
  placeholder = 'Search entities...',
  debounceMs = 300,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = React.useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await graphService.searchEntities(
        graphId,
        searchQuery,
        entityTypeFilter,
        50
      );
      setResults(result.entities);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [graphId, entityTypeFilter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for debounced search
    debounceTimer.current = setTimeout(() => {
      performSearch(newQuery);
    }, debounceMs);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className={styles.entitySearch}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        className={styles.searchInput}
      />

      {error && (
        <div style={{ color: '#dc2626', fontSize: '12px' }}>
          Error: {error}
        </div>
      )}

      {loading && (
        <div style={{ color: '#6b7280', fontSize: '12px' }}>
          Searching...
        </div>
      )}

      {query.length > 0 && results.length === 0 && !loading && (
        <div style={{ color: '#6b7280', fontSize: '12px' }}>
          No results found
        </div>
      )}

      {results.length > 0 && (
        <ul className={styles.searchResults}>
          {results.map((entity) => (
            <li
              key={entity.id}
              className={styles.searchResult}
              onClick={() => onResultSelect?.(entity)}
            >
              <span
                className={styles.searchResultBadge}
                style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
              >
                {entity.entity_type.substring(0, 6)}
              </span>
              <span className={styles.searchResultText}>
                {entity.text}
              </span>
              <span className={styles.searchResultConfidence}>
                {(entity.confidence * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EntitySearch;
