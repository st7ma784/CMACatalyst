"""
Performance benchmarking for LangGraph vs Legacy implementation.

Compares response times, accuracy, and resource usage.
"""

import httpx
import time
import json
import statistics
from typing import Dict, List, Tuple
from datetime import datetime


BASE_URL = "http://localhost:8102"
TIMEOUT = 60.0


class PerformanceBenchmark:
    """Benchmark LangGraph vs Legacy implementation."""

    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "langgraph": {},
            "legacy": {},
            "comparison": {}
        }

    def run_query(self, query: Dict, implementation: str, runs: int = 5) -> Dict:
        """Run a query multiple times and collect metrics."""
        query["use_langgraph"] = (implementation == "langgraph")

        times = []
        responses = []

        # Warm-up run
        try:
            httpx.post(f"{BASE_URL}/agentic-query", json=query, timeout=TIMEOUT)
        except Exception as e:
            print(f"  Warning: Warm-up failed: {e}")

        # Actual benchmark runs
        for i in range(runs):
            try:
                start = time.time()
                response = httpx.post(
                    f"{BASE_URL}/agentic-query",
                    json=query,
                    timeout=TIMEOUT
                )
                elapsed = time.time() - start

                if response.status_code == 200:
                    times.append(elapsed)
                    responses.append(response.json())
                else:
                    print(f"  Warning: Run {i+1} failed with status {response.status_code}")

            except Exception as e:
                print(f"  Warning: Run {i+1} failed: {e}")

        if not times:
            return {
                "error": "All runs failed",
                "avg_time": None,
                "min_time": None,
                "max_time": None,
                "std_dev": None
            }

        return {
            "avg_time": statistics.mean(times),
            "min_time": min(times),
            "max_time": max(times),
            "std_dev": statistics.stdev(times) if len(times) > 1 else 0,
            "success_rate": len(times) / runs,
            "avg_confidence": statistics.mean([r.get("confidence", 0) for r in responses]),
            "responses": responses
        }

    def benchmark_simple_query(self):
        """Benchmark simple factual query."""
        print("\n1. Simple Factual Query")
        print("   Question: 'What is a DRO?'")

        query = {
            "question": "What is a DRO?",
            "topic": "general"
        }

        print("   Testing LangGraph...", end=" ")
        lg_results = self.run_query(query, "langgraph", runs=5)
        print(f"✓ {lg_results['avg_time']:.2f}s avg")

        print("   Testing Legacy...   ", end=" ")
        legacy_results = self.run_query(query, "legacy", runs=5)
        print(f"✓ {legacy_results['avg_time']:.2f}s avg")

        self.results["simple_query"] = {
            "langgraph": lg_results,
            "legacy": legacy_results,
            "speedup": (legacy_results['avg_time'] - lg_results['avg_time']) / legacy_results['avg_time'] * 100
        }

    def benchmark_eligibility_check(self):
        """Benchmark eligibility check with symbolic reasoning."""
        print("\n2. Eligibility Check (with tools)")
        print("   Question: DRO eligibility with financial values")

        query = {
            "question": "Is a client with £15,000 debt, £50/month income, and £1,000 assets eligible for a DRO?",
            "topic": "dro_eligibility",
            "debt": 15000,
            "income": 50,
            "assets": 1000
        }

        print("   Testing LangGraph...", end=" ")
        lg_results = self.run_query(query, "langgraph", runs=5)
        print(f"✓ {lg_results['avg_time']:.2f}s avg")

        print("   Testing Legacy...   ", end=" ")
        legacy_results = self.run_query(query, "legacy", runs=5)
        print(f"✓ {legacy_results['avg_time']:.2f}s avg")

        self.results["eligibility_check"] = {
            "langgraph": lg_results,
            "legacy": legacy_results,
            "speedup": (legacy_results['avg_time'] - lg_results['avg_time']) / legacy_results['avg_time'] * 100
        }

    def benchmark_threshold_extraction(self):
        """Benchmark threshold extraction query."""
        print("\n3. Threshold Extraction")
        print("   Question: 'What are the debt limits for a DRO?'")

        query = {
            "question": "What are the debt limits for a DRO?",
            "topic": "dro"
        }

        print("   Testing LangGraph...", end=" ")
        lg_results = self.run_query(query, "langgraph", runs=5)
        print(f"✓ {lg_results['avg_time']:.2f}s avg")

        print("   Testing Legacy...   ", end=" ")
        legacy_results = self.run_query(query, "legacy", runs=5)
        print(f"✓ {legacy_results['avg_time']:.2f}s avg")

        self.results["threshold_extraction"] = {
            "langgraph": lg_results,
            "legacy": legacy_results,
            "speedup": (legacy_results['avg_time'] - lg_results['avg_time']) / legacy_results['avg_time'] * 100
        }

    def benchmark_complex_multi_step(self):
        """Benchmark complex multi-step query."""
        print("\n4. Complex Multi-Step Query")
        print("   Question: Multiple calculations + eligibility")

        query = {
            "question": "If a client has debts of £12,000, £8,000, and £15,000, what is their total debt? Are they eligible for a DRO?",
            "topic": "dro_eligibility"
        }

        print("   Testing LangGraph...", end=" ")
        lg_results = self.run_query(query, "langgraph", runs=3)  # Fewer runs for complex queries
        print(f"✓ {lg_results['avg_time']:.2f}s avg")

        print("   Testing Legacy...   ", end=" ")
        legacy_results = self.run_query(query, "legacy", runs=3)
        print(f"✓ {legacy_results['avg_time']:.2f}s avg")

        self.results["complex_multi_step"] = {
            "langgraph": lg_results,
            "legacy": legacy_results,
            "speedup": (legacy_results['avg_time'] - lg_results['avg_time']) / legacy_results['avg_time'] * 100
        }

    def generate_report(self):
        """Generate detailed performance report."""
        print("\n" + "=" * 80)
        print("PERFORMANCE BENCHMARK REPORT")
        print("=" * 80)

        # Summary table
        print("\nSummary:")
        print("-" * 80)
        print(f"{'Test Case':<30} {'LangGraph':<15} {'Legacy':<15} {'Speedup':<15}")
        print("-" * 80)

        for test_name, data in self.results.items():
            if test_name in ["timestamp"]:
                continue

            lg_time = data["langgraph"].get("avg_time", 0)
            legacy_time = data["legacy"].get("avg_time", 0)
            speedup = data.get("speedup", 0)

            speedup_str = f"{speedup:+.1f}%" if speedup != 0 else "N/A"

            print(f"{test_name:<30} {lg_time:<15.2f} {legacy_time:<15.2f} {speedup_str:<15}")

        print("-" * 80)

        # Overall statistics
        all_speedups = [
            data["speedup"] for data in self.results.values()
            if isinstance(data, dict) and "speedup" in data
        ]

        if all_speedups:
            avg_speedup = statistics.mean(all_speedups)
            print(f"\nOverall Average Speedup: {avg_speedup:+.1f}%")

            if avg_speedup > 0:
                print(f"✓ LangGraph is {avg_speedup:.1f}% FASTER on average")
            elif avg_speedup < 0:
                print(f"⚠ LangGraph is {abs(avg_speedup):.1f}% SLOWER on average")
            else:
                print("≈ LangGraph and Legacy have similar performance")

        # Confidence comparison
        print("\nConfidence Scores:")
        print("-" * 80)

        for test_name, data in self.results.items():
            if test_name in ["timestamp"]:
                continue

            lg_conf = data["langgraph"].get("avg_confidence", 0)
            legacy_conf = data["legacy"].get("avg_confidence", 0)
            conf_diff = lg_conf - legacy_conf

            print(f"{test_name:<30} LG: {lg_conf:.2f}  Legacy: {legacy_conf:.2f}  Diff: {conf_diff:+.2f}")

        print("-" * 80)

        # Save to file
        with open("test_results/benchmark_report.json", "w") as f:
            json.dump(self.results, f, indent=2)

        print("\n✓ Full results saved to test_results/benchmark_report.json")
        print("=" * 80)

    def run_all(self):
        """Run all benchmarks."""
        print("=" * 80)
        print("Starting Performance Benchmark")
        print("=" * 80)

        self.benchmark_simple_query()
        self.benchmark_eligibility_check()
        self.benchmark_threshold_extraction()
        self.benchmark_complex_multi_step()

        self.generate_report()


if __name__ == "__main__":
    import sys

    # Check if services are available
    try:
        response = httpx.get(f"{BASE_URL}/health", timeout=5.0)
        if response.status_code != 200:
            print("ERROR: RAG service is not responding")
            print("Please start services: docker-compose up -d")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Cannot connect to RAG service: {e}")
        print("Please start services: docker-compose up -d")
        sys.exit(1)

    # Create results directory
    import os
    os.makedirs("test_results", exist_ok=True)

    # Run benchmarks
    benchmark = PerformanceBenchmark()
    benchmark.run_all()
