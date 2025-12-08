# Frontend Topology Visualization Plan

**Goal**: Real-time graph visualization of distributed system architecture in the Systems tab

**Timeline**: Q1 2026  
**Priority**: High (user visibility into system health)

---

## 1. Requirements

### Functional Requirements

**FR1**: Display all active coordinators as nodes
**FR2**: Display all active workers as nodes, grouped by type
**FR3**: Show connections between coordinators and workers
**FR4**: Real-time updates when nodes join/leave
**FR5**: Color-code nodes by type and health status
**FR6**: Display node metadata on hover/click
**FR7**: Show service assignments per worker
**FR8**: Filter/search by worker type, service, location
**FR9**: Auto-layout graph for readability
**FR10**: Export topology as image/JSON

### Non-Functional Requirements

**NFR1**: Updates every 5 seconds (configurable)
**NFR2**: Support up to 1000 nodes without performance degradation
**NFR3**: Responsive design (works on mobile)
**NFR4**: Accessible (keyboard navigation, screen readers)

---

## 2. UI Design

### 2.1 Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  RMA Tool - Systems Dashboard                                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐   │
│  │  Controls       │  │  Graph View                           │   │
│  │                 │  │                                        │   │
│  │  ☑ Coordinators │  │        ◯ edge-1                       │   │
│  │  ☑ GPU Workers  │  │       / | \                           │   │
│  │  ☑ CPU Workers  │  │      /  |  \                          │   │
│  │  ☑ Storage      │  │    ◯   ◯   ◯                          │   │
│  │                 │  │   gpu-1 gpu-2 cpu-1                   │   │
│  │  🔍 Search:     │  │                                        │   │
│  │  [         ]    │  │        ◯ edge-2                       │   │
│  │                 │  │       / | \                           │   │
│  │  Layout:        │  │      /  |  \                          │   │
│  │  ◉ Force        │  │    ◯   ◯   ◯                          │   │
│  │  ○ Hierarchical │  │   gpu-3 stor-1 cpu-2                  │   │
│  │  ○ Circular     │  │                                        │   │
│  │                 │  │                                        │   │
│  │  [Export PNG]   │  │                                        │   │
│  │  [Export JSON]  │  │                                        │   │
│  └─────────────────┘  └──────────────────────────────────────┘   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐│
│  │  Selected Node: gpu-worker-001                                ││
│  │  Type: GPU Worker                                             ││
│  │  Status: Active (last seen: 2s ago)                           ││
│  │  Services: OCR, AI Enhancement                                ││
│  │  Coordinator: edge-1.rmatool.org.uk                           ││
│  │  Tunnel: https://worker-001.tunnel...                         ││
│  │  Hardware: NVIDIA RTX 3090, 24GB VRAM                         ││
│  │  Load: 45% CPU, 67% GPU                                       ││
│  └───────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Color Scheme

**Node Colors**:
- Coordinator: Blue (#3B82F6)
- GPU Worker: Green (#10B981)
- CPU Worker: Yellow (#F59E0B)
- Storage Worker: Purple (#8B5CF6)
- Edge Worker: Teal (#14B8A6)

**Status Indicators**:
- Healthy: Solid fill
- Warning: Yellow outline (>60s since heartbeat)
- Critical: Red outline (>90s since heartbeat)
- Offline: Gray, transparent

**Connection Colors**:
- Active: Green (#10B981)
- Idle: Gray (#9CA3AF)
- High traffic: Thick line
- Low traffic: Thin line

### 2.3 Node Icons

```
Coordinator:  ⬢  (Hexagon)
GPU Worker:   ⚡ (Lightning)
CPU Worker:   ⚙️  (Gear)
Storage:      💾 (Disk)
Edge:         🌐 (Globe)
```

---

## 3. Data Model

### 3.1 API Endpoint

**New Endpoint**: `GET /api/topology`

```json
{
  "coordinators": [
    {
      "id": "edge-1",
      "url": "https://edge-1.rmatool.org.uk",
      "location": "eu-west",
      "workers_count": 12,
      "load": 0.45,
      "cpu_percent": 23.5,
      "memory_percent": 67.2,
      "status": "healthy",
      "last_seen": "2025-12-05T22:00:00Z"
    }
  ],
  "workers": [
    {
      "id": "worker-gpu-001",
      "type": "gpu",
      "coordinator_id": "edge-1",
      "services": ["ocr", "enhancement"],
      "status": "active",
      "tunnel_url": "https://worker-001...",
      "capabilities": {
        "gpu_model": "NVIDIA RTX 3090",
        "vram": "24GB",
        "cpu_cores": 16,
        "ram": "64GB"
      },
      "metrics": {
        "cpu_percent": 45.2,
        "gpu_percent": 67.8,
        "tasks_completed": 1234,
        "uptime_seconds": 86400
      },
      "last_seen": "2025-12-05T22:00:02Z"
    }
  ],
  "connections": [
    {
      "from": "edge-1",
      "to": "worker-gpu-001",
      "type": "registration",
      "active": true,
      "last_activity": "2025-12-05T22:00:02Z"
    }
  ],
  "statistics": {
    "total_nodes": 15,
    "total_coordinators": 3,
    "total_workers": 12,
    "total_services": 8,
    "requests_per_minute": 45.2,
    "average_load": 0.38
  }
}
```

### 3.2 Frontend State

```typescript
interface Node {
  id: string;
  type: 'coordinator' | 'gpu' | 'cpu' | 'storage' | 'edge';
  label: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  metadata: {
    url?: string;
    location?: string;
    services?: string[];
    capabilities?: Record<string, any>;
    metrics?: Record<string, number>;
  };
  x?: number;  // Position (managed by D3)
  y?: number;
  lastSeen: Date;
}

interface Edge {
  source: string;  // Node ID
  target: string;  // Node ID
  type: 'registration' | 'service_request' | 'heartbeat';
  active: boolean;
  strength: number;  // Visual weight (traffic volume)
}

interface TopologyState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  filters: {
    showCoordinators: boolean;
    showGPU: boolean;
    showCPU: boolean;
    showStorage: boolean;
    searchQuery: string;
  };
  layout: 'force' | 'hierarchical' | 'circular';
}
```

---

## 4. Implementation

### 4.1 Technology Stack

**Visualization Library**: D3.js v7
- Force-directed graph layout
- Zoom/pan support
- Smooth transitions
- Custom rendering

**Alternative**: Cytoscape.js
- Easier API
- Better performance for large graphs
- Less flexible styling

**Decision**: D3.js (more control, better for custom layouts)

### 4.2 Component Structure

```
src/components/Systems/
├── TopologyGraph.tsx          # Main graph component
├── TopologyControls.tsx       # Filter/layout controls
├── NodeDetails.tsx            # Selected node info panel
├── TopologyLegend.tsx         # Color legend
├── hooks/
│   ├── useTopologyData.ts     # Fetch topology data
│   ├── useWebSocket.ts        # Real-time updates
│   └── useD3Force.ts          # D3 force simulation
├── utils/
│   ├── layoutAlgorithms.ts    # Graph layouts
│   └── nodeRenderer.ts        # Custom node rendering
└── types/
    └── topology.ts            # TypeScript types
```

### 4.3 Core Implementation

```typescript
// TopologyGraph.tsx
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTopologyData } from './hooks/useTopologyData';

export const TopologyGraph: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, edges, loading } = useTopologyData();
  
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;
    
    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 600;
    
    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));
    
    // Draw edges
    const link = svg.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', d => d.active ? '#10B981' : '#9CA3AF')
      .attr('stroke-width', d => d.strength * 2);
    
    // Draw nodes
    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 20)
      .attr('fill', d => getNodeColor(d.type))
      .attr('stroke', d => getStatusColor(d.status))
      .attr('stroke-width', 3)
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Add labels
    const label = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.label)
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .attr('dy', 35);
    
    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);
  
  return (
    <svg 
      ref={svgRef} 
      width="100%" 
      height="600px"
      style={{ border: '1px solid #e5e7eb' }}
    />
  );
};

function getNodeColor(type: string): string {
  const colors = {
    coordinator: '#3B82F6',
    gpu: '#10B981',
    cpu: '#F59E0B',
    storage: '#8B5CF6',
    edge: '#14B8A6'
  };
  return colors[type] || '#6B7280';
}

function getStatusColor(status: string): string {
  const colors = {
    healthy: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444',
    offline: '#9CA3AF'
  };
  return colors[status] || '#6B7280';
}
```

### 4.4 Real-Time Updates

```typescript
// hooks/useWebSocket.ts
import { useEffect, useState } from 'react';

export function useWebSocket(url: string) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setData(update);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      // Reconnect after 5 seconds
      setTimeout(() => {
        // Retry connection
      }, 5000);
    };
    
    return () => {
      ws.close();
    };
  }, [url]);
  
  return { data, connected };
}

// Usage in TopologyGraph
const { data: update } = useWebSocket('wss://api.rmatool.org.uk/ws/topology');

useEffect(() => {
  if (update) {
    // Update nodes/edges based on websocket message
    handleTopologyUpdate(update);
  }
}, [update]);
```

### 4.5 Backend WebSocket Support

```python
# coordinator/app.py
from fastapi import WebSocket
from typing import List
import asyncio

class TopologyBroadcaster:
    def __init__(self):
        self.connections: List[WebSocket] = []
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.append(websocket)
        
    def disconnect(self, websocket: WebSocket):
        self.connections.remove(websocket)
        
    async def broadcast(self, message: dict):
        for connection in self.connections:
            try:
                await connection.send_json(message)
            except:
                await self.disconnect(connection)

broadcaster = TopologyBroadcaster()

@app.websocket("/ws/topology")
async def topology_websocket(websocket: WebSocket):
    await broadcaster.connect(websocket)
    try:
        while True:
            # Send topology updates every 5 seconds
            topology = get_current_topology()
            await websocket.send_json(topology)
            await asyncio.sleep(5)
    except:
        broadcaster.disconnect(websocket)

# Broadcast on worker register/unregister
@app.post("/api/worker/register")
async def register_worker(worker: WorkerRegistration):
    # ... registration logic ...
    
    # Broadcast topology change
    await broadcaster.broadcast({
        "type": "worker_joined",
        "worker": worker.dict()
    })
```

---

## 5. Advanced Features

### 5.1 Hierarchical Layout

```typescript
// layoutAlgorithms.ts
export function hierarchicalLayout(nodes: Node[], edges: Edge[]) {
  // Group by type
  const coordinators = nodes.filter(n => n.type === 'coordinator');
  const workers = nodes.filter(n => n.type !== 'coordinator');
  
  // Position coordinators in top row
  coordinators.forEach((node, i) => {
    node.x = (i + 1) * (width / (coordinators.length + 1));
    node.y = 100;
    node.fx = node.x;  // Fix position
    node.fy = node.y;
  });
  
  // Position workers below their coordinator
  workers.forEach((worker) => {
    const coordinator = coordinators.find(c => 
      edges.some(e => e.source === c.id && e.target === worker.id)
    );
    
    if (coordinator) {
      // Position below coordinator
      const siblingsCount = workers.filter(w => 
        edges.some(e => e.source === coordinator.id && e.target === w.id)
      ).length;
      
      worker.x = coordinator.x + /* offset based on index */;
      worker.y = 300;
    }
  });
}
```

### 5.2 Node Clustering

```typescript
// Group workers by coordinator
export function clusterLayout(nodes: Node[], edges: Edge[]) {
  const clusters = new Map<string, Node[]>();
  
  // Group workers by coordinator
  nodes.forEach(node => {
    if (node.type === 'coordinator') {
      clusters.set(node.id, [node]);
    }
  });
  
  edges.forEach(edge => {
    if (clusters.has(edge.source)) {
      const worker = nodes.find(n => n.id === edge.target);
      if (worker) {
        clusters.get(edge.source).push(worker);
      }
    }
  });
  
  // Position clusters in circle
  const angleStep = (2 * Math.PI) / clusters.size;
  const clusterRadius = 300;
  
  let angle = 0;
  clusters.forEach((clusterNodes, coordinatorId) => {
    const cx = width / 2 + clusterRadius * Math.cos(angle);
    const cy = height / 2 + clusterRadius * Math.sin(angle);
    
    // Position nodes in cluster
    clusterNodes.forEach((node, i) => {
      const nodeAngle = (2 * Math.PI * i) / clusterNodes.length;
      const nodeRadius = i === 0 ? 0 : 80;  // Coordinator at center
      
      node.x = cx + nodeRadius * Math.cos(nodeAngle);
      node.y = cy + nodeRadius * Math.sin(nodeAngle);
    });
    
    angle += angleStep;
  });
}
```

### 5.3 Traffic Visualization

```typescript
// Animate traffic flow along edges
function animateTraffic(svg: d3.Selection, edges: Edge[]) {
  edges.forEach(edge => {
    if (edge.active && edge.recentActivity) {
      // Create moving circle along edge
      svg.append('circle')
        .attr('r', 3)
        .attr('fill', '#10B981')
        .attr('cx', edge.source.x)
        .attr('cy', edge.source.y)
        .transition()
        .duration(1000)
        .attr('cx', edge.target.x)
        .attr('cy', edge.target.y)
        .remove();
    }
  });
}
```

### 5.4 Export Functionality

```typescript
// Export as PNG
export function exportAsPNG(svgElement: SVGElement) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const img = new Image();
  
  img.onload = () => {
    canvas.width = svgElement.clientWidth;
    canvas.height = svgElement.clientHeight;
    ctx.drawImage(img, 0, 0);
    
    const pngData = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngData;
    downloadLink.download = `topology-${Date.now()}.png`;
    downloadLink.click();
  };
  
  img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
}

// Export as JSON
export function exportAsJSON(topology: TopologyState) {
  const json = JSON.stringify(topology, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `topology-${Date.now()}.json`;
  downloadLink.click();
  
  URL.revokeObjectURL(url);
}
```

---

## 6. Testing Plan

### Unit Tests
- Node rendering
- Edge calculation
- Layout algorithms
- Filter/search logic

### Integration Tests
- WebSocket connection/reconnection
- Real-time updates
- Export functionality

### E2E Tests
- Load topology page
- Select node
- Apply filters
- Change layout
- Export graph

### Performance Tests
- Render 1000 nodes
- Update 100 nodes/second
- Measure frame rate
- Memory usage

---

## 7. Rollout Plan

**Phase 1** (Week 1): Basic graph
- Static topology from API
- Force-directed layout
- Node colors by type

**Phase 2** (Week 2): Interactivity
- Node selection
- Zoom/pan
- Details panel

**Phase 3** (Week 3): Real-time
- WebSocket integration
- Live updates
- Smooth transitions

**Phase 4** (Week 4): Polish
- Alternative layouts
- Export functionality
- Mobile responsive

---

## 8. Success Metrics

- Topology loads in <2 seconds
- Updates render in <100ms
- Smooth 60 FPS animations
- Works on mobile (responsive)
- User can understand system at a glance
