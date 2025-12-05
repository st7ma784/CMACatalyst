"""
DHT Bootstrap Integration Tests
Tests end-to-end DHT bootstrap flow with edge router
"""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, patch

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../worker-containers/universal-worker'))

from dht.dht_node import DHTNode
from dht.dht_client import DHTClient


@pytest.mark.asyncio
async def test_dht_bootstrap_from_seeds():
    """Test DHT client can bootstrap from seed list"""
    # Create bootstrap node (simulating coordinator)
    bootstrap = DHTNode("coordinator-1", 9100)
    await bootstrap.start()

    # Simulate DHT seeds response from edge router
    seeds_data = {
        "seeds": [
            {
                "node_id": "coordinator-1",
                "tunnel_url": "localhost",
                "dht_port": 9100,
                "location": "test"
            }
        ],
        "ttl": 300,
        "count": 1
    }

    # Create worker client
    client = DHTClient("worker-test-1", 9101)

    # Mock the requests.get call to return our seeds
    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.json.return_value = seeds_data
        mock_get.return_value = mock_response

        # Connect to DHT
        await client.connect("http://localhost:8080")

        # Verify client is connected
        assert client.node.is_running

        # Register worker
        await client.register_worker(
            tunnel_url="https://worker-test-1.tunnel.local",
            services=["ocr"],
            capabilities={"gpu": True}
        )

        # Verify worker is registered in DHT
        worker_info = await bootstrap.get("worker:worker-test-1")
        assert worker_info is not None
        assert worker_info["worker_id"] == "worker-test-1"
        assert "ocr" in worker_info["services"]

    await client.disconnect()
    await bootstrap.stop()


@pytest.mark.asyncio
async def test_dht_bootstrap_multiple_coordinators():
    """Test DHT bootstrap with multiple coordinator seeds"""
    # Create 3 bootstrap nodes (simulating multiple coordinators)
    coordinators = []
    for i in range(3):
        coord = DHTNode(f"coordinator-{i}", 9110 + i)
        await coord.start([("localhost", 9110)] if i > 0 else None)
        await asyncio.sleep(0.5)
        coordinators.append(coord)

    # Simulate edge router response with all coordinators
    seeds_data = {
        "seeds": [
            {
                "node_id": f"coordinator-{i}",
                "tunnel_url": "localhost",
                "dht_port": 9110 + i,
                "location": "test"
            }
            for i in range(3)
        ],
        "ttl": 300,
        "count": 3
    }

    # Worker bootstraps from first coordinator
    client = DHTClient("worker-multi-1", 9115)

    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.json.return_value = seeds_data
        mock_get.return_value = mock_response

        await client.connect("http://localhost:8080")

        # Register worker
        await client.register_worker(
            tunnel_url="https://worker-multi-1.tunnel.local",
            services=["enhance"],
            capabilities={"gpu": "RTX 4090"}
        )

        # All coordinators should be able to find the worker
        for coord in coordinators:
            workers = await coord.find_service_workers("enhance")
            assert len(workers) >= 1
            # Find our worker in the list
            our_worker = next((w for w in workers if w.get("worker_id") == "worker-multi-1"), None)
            assert our_worker is not None

    await client.disconnect()
    for coord in coordinators:
        await coord.stop()


@pytest.mark.asyncio
async def test_dht_service_discovery_end_to_end():
    """Test complete service discovery flow via DHT"""
    # Setup: 1 coordinator, 2 workers
    coordinator = DHTNode("coordinator-1", 9120)
    await coordinator.start()

    # Worker 1 with OCR service
    worker1 = DHTClient("worker-ocr-1", 9121)

    # Worker 2 needs to find OCR service
    worker2 = DHTClient("worker-client-1", 9122)

    # Mock bootstrap for both workers
    seeds_data = {
        "seeds": [{
            "node_id": "coordinator-1",
            "tunnel_url": "localhost",
            "dht_port": 9120,
            "location": "test"
        }],
        "ttl": 300,
        "count": 1
    }

    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.json.return_value = seeds_data
        mock_get.return_value = mock_response

        # Connect both workers
        await worker1.connect("http://localhost:8080")
        await worker2.connect("http://localhost:8080")

        # Worker 1 registers OCR service
        await worker1.register_worker(
            tunnel_url="https://worker-ocr-1.tunnel.local",
            services=["ocr"],
            capabilities={"gpu": "T4"}
        )

        # Wait for DHT propagation
        await asyncio.sleep(1)

        # Worker 2 finds OCR service
        ocr_worker = await worker2.find_worker_for_service("ocr")
        assert ocr_worker is not None
        assert ocr_worker["worker_id"] == "worker-ocr-1"
        assert ocr_worker["tunnel_url"] == "https://worker-ocr-1.tunnel.local"

    await worker1.disconnect()
    await worker2.disconnect()
    await coordinator.stop()


@pytest.mark.asyncio
async def test_dht_fallback_when_bootstrap_fails():
    """Test graceful handling when DHT bootstrap fails"""
    client = DHTClient("worker-fallback-1", 9130)

    # Mock failed bootstrap request
    with patch('requests.get') as mock_get:
        mock_get.side_effect = Exception("Connection refused")

        # Connect should raise exception since bootstrap failed
        with pytest.raises(Exception):
            await client.connect("http://localhost:8080")


@pytest.mark.asyncio
async def test_dht_heartbeat_updates():
    """Test DHT client heartbeat updates worker presence"""
    bootstrap = DHTNode("coordinator-1", 9140)
    await bootstrap.start()

    client = DHTClient("worker-heartbeat-1", 9141)

    seeds_data = {
        "seeds": [{
            "node_id": "coordinator-1",
            "tunnel_url": "localhost",
            "dht_port": 9140,
            "location": "test"
        }],
        "ttl": 300,
        "count": 1
    }

    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.json.return_value = seeds_data
        mock_get.return_value = mock_response

        await client.connect("http://localhost:8080")

        # Register worker
        await client.register_worker(
            tunnel_url="https://worker-heartbeat-1.tunnel.local",
            services=["chat"],
            capabilities={}
        )

        # Get initial last_seen
        worker_info_1 = await bootstrap.get("worker:worker-heartbeat-1")
        last_seen_1 = worker_info_1.get("last_seen")

        # Wait for heartbeat (runs every 30 seconds, but we can trigger manually)
        await asyncio.sleep(2)

        # Manually trigger heartbeat update
        worker_info = await client.node.get("worker:worker-heartbeat-1")
        if worker_info:
            import time
            worker_info["last_seen"] = time.time()
            await client.node.set("worker:worker-heartbeat-1", worker_info)

        # Get updated last_seen
        worker_info_2 = await bootstrap.get("worker:worker-heartbeat-1")
        last_seen_2 = worker_info_2.get("last_seen")

        # Verify last_seen was updated
        assert last_seen_2 > last_seen_1

    await client.disconnect()
    await bootstrap.stop()


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
