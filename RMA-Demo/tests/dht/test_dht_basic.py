"""
Basic DHT Unit Tests
Tests core DHT functionality: node startup, get/set operations, service discovery
"""

import pytest
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../worker-containers/universal-worker'))

from dht.dht_node import DHTNode
from dht.dht_client import DHTClient


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
    success = await node.set("test:key", {"value": "hello", "count": 42})
    assert success

    # Retrieve data
    result = await node.get("test:key")
    assert result is not None
    assert result["value"] == "hello"
    assert result["count"] == 42

    await node.stop()


@pytest.mark.asyncio
async def test_dht_bootstrap():
    """Test DHT node can bootstrap from another node"""
    # Bootstrap node
    bootstrap = DHTNode("bootstrap-node", 9002)
    await bootstrap.start()

    # Worker node joins via bootstrap
    worker = DHTNode("worker-node", 9003)
    await worker.start([("localhost", 9002)])

    # Wait for bootstrap to complete
    await asyncio.sleep(1)

    # Both nodes should be running
    assert bootstrap.is_running
    assert worker.is_running

    await worker.stop()
    await bootstrap.stop()


@pytest.mark.asyncio
async def test_dht_service_publication():
    """Test worker can publish service to DHT"""
    # Bootstrap node
    bootstrap = DHTNode("bootstrap", 9004)
    await bootstrap.start()

    # Worker node
    worker = DHTNode("worker-gpu-001", 9005)
    await worker.start([("localhost", 9004)])
    await asyncio.sleep(1)

    # Publish service
    worker_info = {
        "worker_id": "worker-gpu-001",
        "tunnel_url": "https://worker-001.tunnel.local",
        "gpu": "NVIDIA RTX 3090",
        "services": ["ocr", "enhance"]
    }
    await worker.publish_service("ocr", "worker-gpu-001", worker_info)

    # Find service from bootstrap node
    workers = await bootstrap.find_service_workers("ocr")
    assert len(workers) == 1
    assert workers[0]["worker_id"] == "worker-gpu-001"
    assert workers[0]["tunnel_url"] == "https://worker-001.tunnel.local"

    await worker.stop()
    await bootstrap.stop()


@pytest.mark.asyncio
async def test_dht_multiple_workers_same_service():
    """Test multiple workers can offer the same service"""
    # Bootstrap node
    bootstrap = DHTNode("bootstrap", 9006)
    await bootstrap.start()

    # Create 3 workers
    workers = []
    for i in range(3):
        worker = DHTNode(f"worker-{i}", 9007 + i)
        await worker.start([("localhost", 9006)])
        await asyncio.sleep(0.5)

        # Publish OCR service
        worker_info = {
            "worker_id": f"worker-{i}",
            "tunnel_url": f"https://worker-{i}.tunnel.local",
            "services": ["ocr"]
        }
        await worker.publish_service("ocr", f"worker-{i}", worker_info)
        workers.append(worker)

    # Find all OCR workers
    ocr_workers = await bootstrap.find_service_workers("ocr")
    assert len(ocr_workers) == 3

    # Verify all workers are in the list
    worker_ids = [w["worker_id"] for w in ocr_workers]
    assert "worker-0" in worker_ids
    assert "worker-1" in worker_ids
    assert "worker-2" in worker_ids

    # Cleanup
    for worker in workers:
        await worker.stop()
    await bootstrap.stop()


@pytest.mark.asyncio
async def test_dht_worker_unpublish():
    """Test worker can unpublish from DHT"""
    # Bootstrap node
    bootstrap = DHTNode("bootstrap", 9010)
    await bootstrap.start()

    # Worker node
    worker = DHTNode("worker-001", 9011)
    await worker.start([("localhost", 9010)])
    await asyncio.sleep(1)

    # Publish service
    worker_info = {
        "worker_id": "worker-001",
        "tunnel_url": "https://worker-001.tunnel.local",
        "services": ["ocr", "enhance"]
    }
    await worker.publish_service("ocr", "worker-001", worker_info)
    await worker.publish_service("enhance", "worker-001", worker_info)

    # Verify published
    ocr_workers = await bootstrap.find_service_workers("ocr")
    assert len(ocr_workers) == 1

    # Unpublish
    await worker.unpublish_worker("worker-001", ["ocr", "enhance"])

    # Verify unpublished (service list should be empty)
    ocr_workers_after = await bootstrap.find_service_workers("ocr")
    assert len(ocr_workers_after) == 0

    await worker.stop()
    await bootstrap.stop()


@pytest.mark.asyncio
async def test_dht_service_not_found():
    """Test DHT returns empty list for non-existent service"""
    node = DHTNode("test-node", 9012)
    await node.start()

    # Search for non-existent service
    workers = await node.find_service_workers("non-existent-service")
    assert workers == []

    await node.stop()


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
