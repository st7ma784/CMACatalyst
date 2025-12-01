'use client';

import React from 'react';

export interface GraphViewerProps {
  graphId: string;
  height?: string;
  width?: string;
}

export const GraphViewer: React.FC<GraphViewerProps> = ({ graphId, height = '500px', width = '100%' }) => {
  return (
    <div style={{ height, width, border: '1px solid #ddd', borderRadius: '8px', padding: '10px', backgroundColor: '#f9f9f9' }}>
      <p>Graph Viewer: {graphId}</p>
      <p style={{ fontSize: '12px', color: '#666' }}>Component initialized</p>
    </div>
  );
};

export default GraphViewer;
