"""
DHT Load and Scale Testing
Tests DHT performance with 100+ workers
"""

import asyncio
import logging
import time
import sys
import os
from typing import List

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../worker-containers/universal-worker'))

from dht.dht_node import DHTNode
from dht.dht_client import DHTClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DHT LoadTest:
    """Load testing for DHT with many workers"""

    def __init__(self, num_workers: int = 100):
        self.num_workers = num_workers
        self.coordinators: List[DHTNode] = []
        self.workers: List[DHTClient] = []
        self.start_port = 10000

    async def setup_coordinators(self, num_coordinators: int = 3):
        """
        Set up bootstrap coordinators

        Args:
            num_coordinators: Number of coordinators to create
        """
        logger.info(f"Setting up {num_coordinators} coordinators...")

        for i in range(num_coordinators):
            coord = DHTNode(f"coordinator-{i}", self.start_port + i)

            # First coordinator is bootstrap, others join it
            if i == 0:
                await coord.start()
            else:
                await coord.start([("localhost", self.start_port)])

            self.coordinators.append(coord)
            await asyncio.sleep(0.5)  # Let DHT stabilize

        logger.info(f"✅ {len(self.coordinators)} coordinators ready")

    async def spawn_workers(self, batch_size: int = 10):
        """
        Spawn workers in batches

        Args:
            batch_size: Workers to spawn per batch
        """
        logger.info(f"Spawning {self.num_workers} workers in batches of {batch_size}...")

        coord_port = self.start_port
        base_port = self.start_port + 100

        for batch_start in range(0, self.num_workers, batch_size):
            batch_end = min(batch_start + batch_size, self.num_workers)
            batch_workers = []

            for i in range(batch_start, batch_end):
                worker = DHTClient(f"worker-{i}", base_port + i)
                batch_workers.append(worker)

            # Connect workers concurrently
            await asyncio.gather(*[
                self._connect_and_register_worker(w, coord_port, i % 5)
                for i, w in enumerate(batch_workers)
            ])

            self.workers.extend(batch_workers)

            logger.info(f"✅ Spawned workers {batch_start}-{batch_end} ({len(self.workers)} total)")
            await asyncio.sleep(1)  # Brief pause between batches

        logger.info(f"✅ All {len(self.workers)} workers spawned")

    async def _connect_and_register_worker(self, worker: DHTClient, coord_port: int, service_type_idx: int):
        """
        Connect and register a worker

        Args:
            worker: Worker client
            coord_port: Coordinator port
            service_type_idx: Service type index (for variety)
        """
        # Mock bootstrap with seed
        seeds_data = {
            "seeds": [{
                "node_id": "coordinator-0",
                "tunnel_url": "localhost",
                "dht_port": coord_port,
                "location": "test"
            }]
        }

        # Connect to DHT
        try:
            await worker.node.start([("localhost", coord_port)])

            # Register with varying services
            service_types = ["ocr", "enhance", "chat", "embedding", "ner"]
            service = service_types[service_type_idx]

            await worker.register_worker(
                tunnel_url=f"https://{worker.worker_id}.tunnel.local",
                services=[service],
                capabilities={"worker_type": "test", "has_gpu": service_type_idx < 2}
            )

        except Exception as e:
            logger.error(f"Worker {worker.worker_id} failed to connect: {e}")

    async def test_service_discovery(self):
        """Test service discovery performance"""
        logger.info("Testing service discovery...")

        service_types = ["ocr", "enhance", "chat", "embedding", "ner"]
        results = []

        for service_type in service_types:
            start_time = time.time()

            # Find workers from coordinator
            workers_found = await self.coordinators[0].find_service_workers(service_type)

            latency = time.time() - start_time

            results.append({
                "service": service_type,
                "workers_found": len(workers_found),
                "latency_ms": latency * 1000
            })

            logger.info(f"  {service_type}: {len(workers_found)} workers, {latency*1000:.1f}ms")

        return results

    async def test_concurrent_lookups(self, num_lookups: int = 100):
        """
        Test concurrent service lookups

        Args:
            num_lookups: Number of concurrent lookups
        """
        logger.info(f"Testing {num_lookups} concurrent lookups...")

        start_time = time.time()

        tasks = []
        for i in range(num_lookups):
            service_type = ["ocr", "enhance", "chat"][i % 3]
            task = self.coordinators[0].find_service_workers(service_type)
            tasks.append(task)

        results = await asyncio.gather(*tasks)

        total_time = time.time() - start_time
        avg_latency = total_time / num_lookups

        logger.info(f"✅ {num_lookups} lookups in {total_time:.2f}s")
        logger.info(f"   Average latency: {avg_latency*1000:.1f}ms")

        return {
            "total_lookups": num_lookups,
            "total_time_s": total_time,
            "avg_latency_ms": avg_latency * 1000,
            "lookups_per_second": num_lookups / total_time
        }

    async def cleanup(self):
        """Clean up all workers and coordinators"""
        logger.info("Cleaning up...")

        # Disconnect workers
        await asyncio.gather(*[
            worker.disconnect() for worker in self.workers
        ], return_exceptions=True)

        # Stop coordinators
        await asyncio.gather(*[
            coord.stop() for coord in self.coordinators
        ], return_exceptions=True)

        logger.info("✅ Cleanup complete")

    def print_summary(self, discovery_results, concurrent_results):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("DHT LOAD TEST SUMMARY")
        print("=" * 60)
        print(f"Workers: {self.num_workers}")
        print(f"Coordinators: {len(self.coordinators)}")
        print()
        print("Service Discovery:")
        for result in discovery_results:
            print(f"  {result['service']:12} - {result['workers_found']:3} workers, {result['latency_ms']:.1f}ms")
        print()
        print("Concurrent Lookups:")
        print(f"  Total: {concurrent_results['total_lookups']}")
        print(f"  Time: {concurrent_results['total_time_s']:.2f}s")
        print(f"  Avg Latency: {concurrent_results['avg_latency_ms']:.1f}ms")
        print(f"  Throughput: {concurrent_results['lookups_per_second']:.1f} lookups/s")
        print("=" * 60)


async def run_load_test(num_workers: int = 100):
    """
    Run DHT load test

    Args:
        num_workers: Number of workers to simulate
    """
    test = DHTLoadTest(num_workers=num_workers)

    try:
        # Setup
        await test.setup_coordinators(num_coordinators=3)
        await test.spawn_workers(batch_size=20)

        # Wait for DHT to stabilize
        logger.info("Waiting for DHT to stabilize...")
        await asyncio.sleep(5)

        # Run tests
        discovery_results = await test.test_service_discovery()
        concurrent_results = await test.test_concurrent_lookups(num_lookups=200)

        # Print results
        test.print_summary(discovery_results, concurrent_results)

    finally:
        await test.cleanup()


if __name__ == "__main__":
    # Run load test with 100 workers
    logger.info("Starting DHT load test...")
    asyncio.run(run_load_test(num_workers=100))
