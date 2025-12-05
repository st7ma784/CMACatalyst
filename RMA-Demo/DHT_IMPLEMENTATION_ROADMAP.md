# DHT Implementation Roadmap & Task List

**Goal**: Implement P2P service discovery via DHT to minimize Cloudflare costs and scale to 2000+ workers

**Timeline**: 8 weeks (Q1 2026)  
**Status**: Ready to implement  
**Prerequisites**: Current system operational (edge router, coordinators, workers)

---

## 📋 Implementation Task List

### Phase 1: DHT Foundation (Weeks 1-2)

#### Task 1.1: DHT Library Selection & Setup
- [ ] Evaluate Python DHT libraries (kademlia, py-libp2p)
- [ ] Create proof-of-concept with 2 nodes
- [ ] Document selected library and rationale
- [ ] **Files**: `RMA-Demo/worker-containers/universal-worker/requirements.txt`

#### Task 1.2: DHT Node Module
- [ ] Create `dht_node.py` - Core DHT node logic
- [ ] Create `dht_client.py` - Client interface for workers
- [ ] Create `dht_config.py` - Configuration management
- [ ] **Files**: NEW - `RMA-Demo/worker-containers/universal-worker/dht/`

#### Task 1.3: Coordinator DHT Integration
- [ ] Add DHT node to coordinator startup
- [ ] Implement coordinator registration in DHT
- [ ] Add DHT bootstrap endpoint
- [ ] **Files**: `RMA-Demo/services/local-coordinator/app.py`, `dht_coordinator.py`

#### Task 1.4: Testing Infrastructure
- [ ] Create DHT test suite
- [ ] Add integration tests for 2-node DHT
- [ ] Add network partition tests
- [ ] **Files**: NEW - `RMA-Demo/tests/dht/`

**Deliverables**:
- ✅ DHT library integrated
- ✅ 2 coordinators can join DHT
- ✅ Basic get/set operations work
- ✅ Tests pass

---

### Phase 2: Worker DHT Integration (Weeks 3-4)

#### Task 2.1: Worker DHT Client
- [ ] Add DHT client to worker_agent.py
- [ ] Implement worker registration in DHT
- [ ] Add service publication (announce capabilities)
- [ ] **Files**: `worker_agent.py`, `dht_worker.py`

#### Task 2.2: Service Discovery via DHT
- [ ] Implement `find_service_by_type()` in DHT
- [ ] Add fallback to coordinator if DHT fails
- [ ] Cache DHT results locally (5 min TTL)
- [ ] **Files**: `worker_agent.py`, `dht_client.py`

#### Task 2.3: Request Routing via DHT
- [ ] Query DHT for worker with service
- [ ] Direct P2P communication between workers
- [ ] Track DHT vs coordinator routing metrics
- [ ] **Files**: `worker_agent.py`, `service_router.py`

#### Task 2.4: Testing
- [ ] Test worker registration in DHT
- [ ] Test service discovery (find GPU worker)
- [ ] Test direct P2P request routing
- [ ] **Files**: `tests/dht/test_worker_discovery.py`

**Deliverables**:
- ✅ Workers register in DHT
- ✅ Workers can find each other via DHT
- ✅ Direct P2P service requests work
- ✅ 80% reduction in coordinator traffic

---

### Phase 3: Edge Router as DHT Bootstrap (Weeks 5-6)

#### Task 3.1: Edge Router DHT Seed List
- [ ] Add DHT seed list to Durable Object
- [ ] Track DHT-capable coordinators
- [ ] Implement `/api/dht/bootstrap` endpoint
- [ ] **Files**: `services/cloudflare-edge-router/index.js`, `coordinator-registry.js`

#### Task 3.2: Worker DHT Bootstrap
- [ ] Workers query edge router for DHT seeds
- [ ] Connect to DHT on startup
- [ ] Fallback to coordinator if DHT bootstrap fails
- [ ] **Files**: `worker_agent.py`, `dht_bootstrap.py`

#### Task 3.3: Edge Router Traffic Reduction
- [ ] Make DHT primary discovery method
- [ ] Edge router becomes bootstrap-only
- [ ] Monitor Cloudflare request counts
- [ ] **Files**: `worker_agent.py`, metrics tracking

#### Task 3.4: Testing
- [ ] Test DHT bootstrap via edge router
- [ ] Test system survives coordinator restarts
- [ ] Measure traffic reduction (target: 99%)
- [ ] **Files**: `tests/integration/test_dht_bootstrap.py`

**Deliverables**:
- ✅ Edge router provides DHT seeds
- ✅ Workers bootstrap DHT automatically
- ✅ System works with DHT as primary
- ✅ 99% reduction in Cloudflare traffic

---

### Phase 4: P2P Tunnels & Advanced Features (Weeks 7-8)

#### Task 4.1: P2P Tunnel Support
- [ ] Workers create tunnels for P2P communication
- [ ] Store tunnel URLs in DHT
- [ ] Optimize for direct connections (bypass Cloudflare where possible)
- [ ] **Files**: `dht_node.py`, `tunnel_manager.py`

#### Task 4.2: Load-Based Routing
- [ ] Track worker load in DHT
- [ ] Implement smart worker selection (least loaded)
- [ ] Add latency-aware routing
- [ ] **Files**: `dht_router.py`, `load_balancer.py`

#### Task 4.3: Frontend Transparency
- [ ] Add `/api/dht/topology` endpoint
- [ ] Return DHT ring structure
- [ ] Show P2P connections in graph
- [ ] **Files**: `services/local-coordinator/app.py`, frontend API

#### Task 4.4: Testing & Monitoring
- [ ] Load test with 100+ workers
- [ ] Chaos testing (random node failures)
- [ ] Performance benchmarking
- [ ] **Files**: `tests/load/test_dht_scale.py`

**Deliverables**:
- ✅ P2P tunnels working
- ✅ Smart load balancing
- ✅ Frontend shows DHT topology
- ✅ System scales to 500+ workers

---

## 📁 File Structure

### New Files to Create

```
RMA-Demo/
├── worker-containers/universal-worker/
│   ├── dht/
│   │   ├── __init__.py
│   │   ├── dht_node.py          # ⭐ Core DHT node logic
│   │   ├── dht_client.py        # ⭐ Client interface
│   │   ├── dht_config.py        # Configuration
│   │   ├── dht_bootstrap.py     # Bootstrap logic
│   │   └── dht_router.py        # ⭐ Request routing via DHT
│   ├── p2p/
│   │   ├── __init__.py
│   │   ├── tunnel_manager.py    # ⭐ P2P tunnel management
│   │   └── peer_discovery.py    # Peer discovery
│   └── requirements.txt         # ⭐ Add DHT library
│
├── services/local-coordinator/
│   ├── dht_coordinator.py       # ⭐ Coordinator DHT integration
│   └── app.py                   # ⭐ Add DHT endpoints
│
├── services/cloudflare-edge-router/
│   ├── index.js                 # ⭐ Add /api/dht/bootstrap
│   └── coordinator-registry.js  # ⭐ Track DHT seeds
│
└── tests/
    ├── dht/
    │   ├── test_dht_basic.py    # Basic DHT operations
    │   ├── test_worker_discovery.py
    │   ├── test_coordinator_dht.py
    │   └── test_p2p_routing.py
    ├── integration/
    │   ├── test_dht_bootstrap.py
    │   ├── test_end_to_end_dht.py
    │   └── test_failover.py
    └── load/
        ├── test_dht_scale.py
        └── test_traffic_reduction.py
```

### Files to Modify

```
✏️  worker_agent.py              # Add DHT client, service discovery
✏️  services/local-coordinator/app.py  # Add DHT node, endpoints
✏️  services/cloudflare-edge-router/index.js  # Add bootstrap endpoint
✏️  requirements.txt             # Add kademlia or py-libp2p
✏️  docker-compose.yml          # Add DHT ports
✏️  edge-coordinator.yml        # Add DHT ports
```

---

## 💻 Code Implementation Guide

### 1. DHT Node Core (`dht/dht_node.py`)

```python
"""
Core DHT Node Implementation
Handles joining DHT ring, storing/retrieving data, and routing
"""

import asyncio
import logging
from typing import Dict, List, Optional
from kademlia.network import Server

logger = logging.getLogger(__name__)


class DHTNode:
    """
    DHT Node for distributed service discovery
    
    This node participates in a Kademlia DHT ring, storing and retrieving
    information about coordinators, workers, and services.
    """
    
    def __init__(self, node_id: str, listen_port: int = 8468):
        """
        Initialize DHT node
        
        Args:
            node_id: Unique identifier for this node
            listen_port: UDP port for DHT communication (default 8468)
        """
        self.node_id = node_id
        self.listen_port = listen_port
        self.server = Server()
        self.is_running = False
        
        logger.info(f"DHT Node initialized: {node_id} on port {listen_port}")
    
    async def start(self, bootstrap_nodes: Optional[List[tuple]] = None):
        """
        Start DHT node and join network
        
        Args:
            bootstrap_nodes: List of (ip, port) tuples for initial connection
                           If None, this becomes a bootstrap node
        """
        try:
            # Start listening
            await self.server.listen(self.listen_port)
            self.is_running = True
            logger.info(f"DHT listening on port {self.listen_port}")
            
            # Bootstrap into network
            if bootstrap_nodes:
                logger.info(f"Bootstrapping with {len(bootstrap_nodes)} nodes")
                await self.server.bootstrap(bootstrap_nodes)
                logger.info("✅ DHT bootstrap complete")
            else:
                logger.info("⭐ Starting as DHT bootstrap node")
                
        except Exception as e:
            logger.error(f"Failed to start DHT node: {e}")
            raise
    
    async def stop(self):
        """Gracefully stop DHT node"""
        self.is_running = False
        self.server.stop()
        logger.info("DHT node stopped")
    
    async def set(self, key: str, value: dict) -> bool:
        """
        Store data in DHT
        
        Args:
            key: Key to store (e.g., "worker:gpu-001")
            value: Dict to store (must be JSON-serializable)
            
        Returns:
            True if successful
        """
        try:
            await self.server.set(key, value)
            logger.debug(f"DHT SET: {key}")
            return True
        except Exception as e:
            logger.error(f"DHT SET failed for {key}: {e}")
            return False
    
    async def get(self, key: str) -> Optional[dict]:
        """
        Retrieve data from DHT
        
        Args:
            key: Key to retrieve
            
        Returns:
            Stored value or None if not found
        """
        try:
            value = await self.server.get(key)
            if value:
                logger.debug(f"DHT GET: {key} → found")
            else:
                logger.debug(f"DHT GET: {key} → not found")
            return value
        except Exception as e:
            logger.error(f"DHT GET failed for {key}: {e}")
            return None
    
    async def get_node_count(self) -> int:
        """Get number of nodes in DHT ring"""
        # Note: kademlia doesn't expose this directly
        # This is an approximation based on routing table
        return len(self.server.protocol.router)
    
    async def publish_service(self, service_type: str, worker_id: str, 
                             worker_info: dict):
        """
        Publish worker's service capability to DHT
        
        Args:
            service_type: Type of service (e.g., "ocr", "gpu")
            worker_id: Unique worker identifier
            worker_info: Worker metadata (tunnel_url, capabilities, etc.)
        """
        # Store worker info
        await self.set(f"worker:{worker_id}", worker_info)
        
        # Add to service index
        service_key = f"service:{service_type}"
        current_workers = await self.get(service_key) or []
        
        if worker_id not in current_workers:
            current_workers.append(worker_id)
            await self.set(service_key, current_workers)
            
        logger.info(f"Published service: {service_type} by {worker_id}")
    
    async def find_service_workers(self, service_type: str) -> List[Dict]:
        """
        Find all workers offering a service
        
        Args:
            service_type: Service to search for (e.g., "ocr")
            
        Returns:
            List of worker info dicts
        """
        # Get worker IDs offering this service
        worker_ids = await self.get(f"service:{service_type}") or []
        
        if not worker_ids:
            logger.debug(f"No workers found for service: {service_type}")
            return []
        
        # Fetch worker info for each
        workers = []
        for worker_id in worker_ids:
            worker_info = await self.get(f"worker:{worker_id}")
            if worker_info:
                workers.append(worker_info)
        
        logger.info(f"Found {len(workers)} workers for {service_type}")
        return workers
    
    async def unpublish_worker(self, worker_id: str, services: List[str]):
        """
        Remove worker from DHT when going offline
        
        Args:
            worker_id: Worker to remove
            services: List of services to unpublish
        """
        # Remove from service indexes
        for service_type in services:
            service_key = f"service:{service_type}"
            current_workers = await self.get(service_key) or []
            
            if worker_id in current_workers:
                current_workers.remove(worker_id)
                await self.set(service_key, current_workers)
        
        # Note: Don't delete worker key - let it expire naturally
        logger.info(f"Unpublished worker: {worker_id}")


# Example usage
async def main():
    # Bootstrap node (first coordinator)
    bootstrap = DHTNode("coordinator-1", 8468)
    await bootstrap.start()
    
    # Worker node
    worker = DHTNode("worker-gpu-001", 8469)
    await worker.start([("localhost", 8468)])
    
    # Publish service
    await worker.publish_service("ocr", "worker-gpu-001", {
        "tunnel_url": "https://worker-001.tunnel...",
        "gpu": "NVIDIA RTX 3090",
        "services": ["ocr", "enhance"]
    })
    
    # Find workers
    ocr_workers = await bootstrap.find_service_workers("ocr")
    print(f"OCR workers: {ocr_workers}")
    
    await asyncio.sleep(60)
    await worker.stop()
    await bootstrap.stop()


if __name__ == "__main__":
    asyncio.run(main())
```

### 2. DHT Client for Workers (`dht/dht_client.py`)

```python
"""
DHT Client Interface for Universal Workers
Simplified interface for workers to interact with DHT
"""

import asyncio
import logging
from typing import Dict, List, Optional
from .dht_node import DHTNode

logger = logging.getLogger(__name__)


class DHTClient:
    """
    High-level DHT client for workers
    
    Provides simple interface for:
    - Registering worker in DHT
    - Finding other workers by service type
    - Updating worker status
    """
    
    def __init__(self, worker_id: str, port: int = 8468):
        self.worker_id = worker_id
        self.node = DHTNode(worker_id, port)
        self._task = None
        
    async def connect(self, bootstrap_url: str):
        """
        Connect to DHT network
        
        Args:
            bootstrap_url: Edge router URL to get DHT seeds
        """
        import requests
        
        try:
            # Get DHT seeds from edge router
            response = requests.get(f"{bootstrap_url}/api/dht/bootstrap", 
                                   timeout=10)
            seeds_data = response.json()
            
            # Parse seed nodes
            bootstrap_nodes = []
            for seed in seeds_data.get("seeds", []):
                # Extract host and port from tunnel URL
                # Format: https://edge-1.rmatool.org.uk → (edge-1.rmatool.org.uk, 8468)
                host = seed["tunnel_url"].replace("https://", "").replace("http://", "")
                port = seed.get("dht_port", 8468)
                bootstrap_nodes.append((host, port))
            
            logger.info(f"Bootstrapping DHT with {len(bootstrap_nodes)} seeds")
            
            # Start DHT node
            await self.node.start(bootstrap_nodes if bootstrap_nodes else None)
            
            # Start background heartbeat
            self._task = asyncio.create_task(self._heartbeat_loop())
            
            logger.info("✅ Connected to DHT")
            
        except Exception as e:
            logger.error(f"Failed to connect to DHT: {e}")
            logger.warning("Falling back to coordinator-only mode")
            raise
    
    async def register_worker(self, tunnel_url: str, services: List[str], 
                             capabilities: Dict):
        """
        Register this worker in DHT
        
        Args:
            tunnel_url: Worker's tunnel URL for P2P access
            services: List of services offered (e.g., ["ocr", "enhance"])
            capabilities: Hardware capabilities dict
        """
        worker_info = {
            "worker_id": self.worker_id,
            "tunnel_url": tunnel_url,
            "services": services,
            "capabilities": capabilities,
            "last_seen": asyncio.get_event_loop().time()
        }
        
        # Store worker info
        await self.node.set(f"worker:{self.worker_id}", worker_info)
        
        # Publish each service
        for service in services:
            await self.node.publish_service(service, self.worker_id, worker_info)
        
        logger.info(f"Registered in DHT: {services}")
    
    async def find_worker_for_service(self, service_type: str) -> Optional[Dict]:
        """
        Find a worker offering a service
        
        Args:
            service_type: Service needed (e.g., "ocr")
            
        Returns:
            Worker info dict or None
        """
        workers = await self.node.find_service_workers(service_type)
        
        if not workers:
            return None
        
        # Select worker (simple random for now)
        import random
        selected = random.choice(workers)
        
        logger.info(f"Selected worker {selected['worker_id']} for {service_type}")
        return selected
    
    async def _heartbeat_loop(self):
        """Background task to update DHT presence"""
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                
                # Update last_seen timestamp
                worker_info = await self.node.get(f"worker:{self.worker_id}")
                if worker_info:
                    worker_info["last_seen"] = asyncio.get_event_loop().time()
                    await self.node.set(f"worker:{self.worker_id}", worker_info)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"DHT heartbeat failed: {e}")
    
    async def disconnect(self):
        """Disconnect from DHT"""
        if self._task:
            self._task.cancel()
        
        # Unpublish worker
        worker_info = await self.node.get(f"worker:{self.worker_id}")
        if worker_info:
            services = worker_info.get("services", [])
            await self.node.unpublish_worker(self.worker_id, services)
        
        await self.node.stop()
        logger.info("Disconnected from DHT")
```

### 3. Worker Integration (`worker_agent.py` modifications)

```python
# Add to worker_agent.py

from dht.dht_client import DHTClient

class WorkerAgent:
    def __init__(self):
        # ... existing code ...
        
        # DHT client (optional - falls back to coordinator)
        self.dht_enabled = os.getenv("DHT_ENABLED", "true").lower() == "true"
        self.dht_client: Optional[DHTClient] = None
        
        if self.dht_enabled:
            self.dht_client = DHTClient(self.worker_id)
    
    async def initialize_dht(self):
        """Initialize DHT connection"""
        if not self.dht_enabled or not self.dht_client:
            logger.info("DHT disabled, using coordinator only")
            return
        
        try:
            # Connect to DHT via edge router bootstrap
            await self.dht_client.connect(self.coordinator_url)
            
            # Register worker in DHT
            await self.dht_client.register_worker(
                tunnel_url=self.tunnel_url,
                services=self.assigned_services,
                capabilities=self.capabilities
            )
            
            logger.info("✅ DHT initialized and worker registered")
            
        except Exception as e:
            logger.warning(f"DHT initialization failed: {e}")
            logger.info("Continuing with coordinator-only mode")
            self.dht_enabled = False
    
    async def find_service_worker_dht(self, service_type: str) -> Optional[str]:
        """
        Find worker for service using DHT
        
        Returns:
            Worker tunnel URL or None
        """
        if not self.dht_enabled:
            return None
        
        try:
            worker_info = await self.dht_client.find_worker_for_service(service_type)
            if worker_info:
                return worker_info["tunnel_url"]
            return None
            
        except Exception as e:
            logger.error(f"DHT service lookup failed: {e}")
            return None
    
    def find_service_worker(self, service_type: str) -> str:
        """
        Find worker for service (DHT first, fallback to coordinator)
        
        This is the main method used by services to find workers.
        """
        # Try DHT first
        if self.dht_enabled:
            try:
                # Run async DHT lookup
                loop = asyncio.new_event_loop()
                worker_url = loop.run_until_complete(
                    self.find_service_worker_dht(service_type)
                )
                loop.close()
                
                if worker_url:
                    logger.info(f"Found worker via DHT: {service_type}")
                    return worker_url
                    
            except Exception as e:
                logger.warning(f"DHT lookup failed, falling back to coordinator: {e}")
        
        # Fallback to coordinator
        logger.info(f"Using coordinator to find: {service_type}")
        return self.find_service_worker_coordinator(service_type)
    
    def find_service_worker_coordinator(self, service_type: str) -> str:
        """Original coordinator-based lookup (fallback)"""
        # ... existing coordinator lookup code ...
        pass
```

### 4. Edge Router Bootstrap (`cloudflare-edge-router/index.js`)

```javascript
// Add to index.js

// DHT Bootstrap endpoint
if (path === '/api/dht/bootstrap' && request.method === 'GET') {
  try {
    // Get all healthy coordinators
    const coordinatorsReq = new Request('http://internal/coordinators', { method: 'GET' });
    const coordsResp = await registry.fetch(coordinatorsReq);
    const coordinators = await coordsResp.json();
    
    // Filter to DHT-enabled coordinators (have dht_port)
    const dhtSeeds = coordinators
      .filter(c => c.dht_port)
      .map(c => ({
        node_id: c.worker_id,
        tunnel_url: c.tunnel_url,
        dht_port: c.dht_port || 8468,
        location: c.location
      }));
    
    return new Response(JSON.stringify({
      seeds: dhtSeeds,
      ttl: 300,  // Cache for 5 minutes
      count: dhtSeeds.length
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'DHT bootstrap failed',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 5. Coordinator DHT Integration (`services/local-coordinator/dht_coordinator.py`)

```python
"""
Coordinator DHT Integration
Coordinators run DHT nodes and help bootstrap the network
"""

import asyncio
import logging
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 
                                '../../worker-containers/universal-worker'))

from dht.dht_node import DHTNode

logger = logging.getLogger(__name__)


class CoordinatorDHT:
    """
    DHT integration for coordinator
    
    Coordinators act as stable DHT nodes that help bootstrap
    the network and store coordinator registry information.
    """
    
    def __init__(self, coordinator_id: str, port: int = 8468):
        self.coordinator_id = coordinator_id
        self.node = DHTNode(coordinator_id, port)
        self.port = port
        
    async def start(self, bootstrap_nodes: list = None):
        """
        Start coordinator DHT node
        
        Args:
            bootstrap_nodes: Other coordinators to bootstrap from
        """
        await self.node.start(bootstrap_nodes)
        logger.info(f"Coordinator DHT node started on port {self.port}")
    
    async def register_coordinator(self, tunnel_url: str, location: str):
        """
        Register this coordinator in DHT
        
        Args:
            tunnel_url: Coordinator's public tunnel URL
            location: Geographic location
        """
        coord_info = {
            "coordinator_id": self.coordinator_id,
            "tunnel_url": tunnel_url,
            "location": location,
            "dht_port": self.port,
            "last_seen": asyncio.get_event_loop().time()
        }
        
        # Store coordinator info
        await self.node.set(f"coordinator:{self.coordinator_id}", coord_info)
        
        # Add to location index
        location_key = f"coordinators:{location}"
        current_coords = await self.node.get(location_key) or []
        if self.coordinator_id not in current_coords:
            current_coords.append(self.coordinator_id)
            await self.node.set(location_key, current_coords)
        
        logger.info(f"Registered coordinator in DHT: {self.coordinator_id}")
    
    async def find_coordinators(self, location: str = None) -> list:
        """
        Find coordinators in DHT
        
        Args:
            location: Filter by location (optional)
            
        Returns:
            List of coordinator info dicts
        """
        if location:
            coord_ids = await self.node.get(f"coordinators:{location}") or []
        else:
            # Get all locations (this is inefficient - TODO: improve)
            coord_ids = []
            for loc in ["eu-west", "us-east", "us-west", "asia"]:
                ids = await self.node.get(f"coordinators:{loc}") or []
                coord_ids.extend(ids)
        
        # Fetch coordinator info
        coordinators = []
        for coord_id in coord_ids:
            info = await self.node.get(f"coordinator:{coord_id}")
            if info:
                coordinators.append(info)
        
        return coordinators
    
    async def stop(self):
        """Stop DHT node"""
        await self.node.stop()
```

### 6. Docker Compose Configuration

```yaml
# Add to edge-coordinator.yml

services:
  coordinator:
    # ... existing config ...
    ports:
      - "8080:8080"
      - "8468:8468/udp"  # DHT port
    environment:
      - HOST=0.0.0.0
      - PORT=8080
      - DHT_PORT=8468
      - DHT_ENABLED=true
      - NODE_ENV=production
```

---

## 🧪 Testing Strategy

### Unit Tests

```python
# tests/dht/test_dht_basic.py

import pytest
import asyncio
from worker_agent import DHTNode, DHTClient


@pytest.mark.asyncio
async def test_dht_node_startup():
    """Test DHT node can start"""
    node = DHTNode("test-node-1", 9000)
    await node.start()
    assert node.is_running
    await node.stop()


@pytest.mark.asyncio
async def test_dht_set_get():
    """Test basic DHT storage"""
    node = DHTNode("test-node-1", 9001)
    await node.start()
    
    # Store data
    await node.set("test:key", {"value": "hello"})
    
    # Retrieve data
    result = await node.get("test:key")
    assert result == {"value": "hello"}
    
    await node.stop()


@pytest.mark.asyncio
async def test_dht_worker_registration():
    """Test worker can register in DHT"""
    # Bootstrap node
    bootstrap = DHTNode("bootstrap", 9002)
    await bootstrap.start()
    
    # Worker node
    client = DHTClient("worker-1", 9003)
    
    # Mock bootstrap URL
    # ... test registration ...
    
    await client.disconnect()
    await bootstrap.stop()
```

### Integration Tests

```python
# tests/integration/test_end_to_end_dht.py

import pytest
import requests


def test_worker_finds_service_via_dht():
    """
    End-to-end test: Worker registers, another worker finds it via DHT
    """
    # 1. Start coordinator with DHT
    # 2. Start worker-1 with GPU service
    # 3. Start worker-2
    # 4. Worker-2 queries DHT for GPU service
    # 5. Worker-2 finds worker-1
    # 6. Worker-2 sends request directly to worker-1
    # 7. Verify response received
    
    # ... implementation ...
    pass


def test_dht_fallback_to_coordinator():
    """
    Test system falls back to coordinator if DHT fails
    """
    # 1. Start system with DHT
    # 2. Break DHT (kill bootstrap nodes)
    # 3. Verify workers still work via coordinator
    
    pass
```

### Load Tests

```python
# tests/load/test_dht_scale.py

import pytest
import asyncio
from locust import HttpUser, task, between


class WorkerUser(HttpUser):
    """Simulate workers joining DHT"""
    wait_time = between(1, 5)
    
    @task
    def register_worker(self):
        # Simulate worker registration
        self.client.post("/api/worker/register", json={
            "worker_id": f"worker-{self.environment.runner.user_count}",
            "capabilities": {"gpu": True}
        })
    
    @task(3)
    def query_service(self):
        # Simulate service query
        self.client.post("/api/service/ocr", json={
            "document": "base64data..."
        })


# Run: locust -f test_dht_scale.py --users 100 --spawn-rate 10
```

---

## 📊 Success Metrics

### Traffic Reduction
```
Metric: Cloudflare Worker Requests

Before DHT:
- 51,990 requests/day (20 workers)
- Close to free tier limit

After DHT:
- ~25 requests/day (20 workers)
- 99.95% reduction
- Can support 2000+ workers
```

### Latency
```
Service Request Latency

Before: 200-300ms
├─ Frontend → Edge Router: 50ms
├─ Edge Router → Coordinator: 80ms
├─ Coordinator → Worker: 80ms
└─ Worker Processing: 50ms

After (DHT):
├─ Frontend → Worker (direct): 50ms
└─ Worker Processing: 50ms
= 100ms total (50% reduction)
```

### Reliability
```
System Availability

Before: 99% (coordinator SPOF)
After: 99.9% (DHT self-healing)
```

---

## ⚠️ Important Reminders

### **Minimize Cloudflare Costs**
- ✅ DHT handles 99% of discovery traffic
- ✅ Edge router becomes bootstrap only
- ✅ Direct P2P worker communication
- ✅ Stay well under 100K req/day free tier

### **Use Cloudflare Tunnels**
- ✅ All workers use named tunnels for P2P
- ✅ Tunnel URLs stored in DHT
- ✅ Direct HTTPS connections (bypass edge router)
- ✅ No NAT/firewall issues

### **Scale on Donated Compute**
- ✅ DHT designed for heterogeneous hardware
- ✅ Works with workers joining/leaving frequently
- ✅ No central bottleneck (DHT is distributed)
- ✅ Self-healing on node failures

### **Keep Application Logic Separate**
- ✅ DHT is infrastructure layer only
- ✅ AI/document services remain unchanged
- ✅ Docker Compose still works for local dev
- ✅ Can disable DHT with env var (`DHT_ENABLED=false`)

### **Maintain Local Dev Experience**
```bash
# Local development (no DHT)
docker-compose up

# Production (with DHT)
docker-compose -f edge-coordinator.yml up
```

---

## 📝 Next Steps

1. **Review this roadmap** - Understand scope and timeline
2. **Set up dev environment** - See DEVELOPER_DEPLOYMENT_GUIDE.md
3. **Start Phase 1** - DHT library integration
4. **Run tests continuously** - TDD approach
5. **Monitor metrics** - Track traffic reduction

**Questions?** See [DHT_INTEGRATION_PLAN.md](./DHT_INTEGRATION_PLAN.md) for detailed technical design.

---

**Status**: Ready to implement  
**Next Milestone**: Phase 1 complete (Week 2)  
**Target**: Production DHT by end of Q1 2026
