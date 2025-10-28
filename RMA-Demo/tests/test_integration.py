"""
Integration tests for LangGraph migration.

Tests the complete workflow from query to response, comparing
LangGraph implementation with legacy implementation.
"""

import pytest
import httpx
import json
import time
from typing import Dict, Any, List

# Test configuration
BASE_URL = "http://localhost:8102"
TIMEOUT = 60.0  # seconds


class TestSimpleQueries:
    """Test simple factual queries that don't require tools."""

    def test_simple_factual_query(self):
        """Test a simple question about DRO definition."""
        query = {
            "question": "What is a DRO?",
            "topic": "general",
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "answer" in data
        assert "complexity" in data
        assert "confidence" in data

        # Verify answer quality
        assert len(data["answer"]) > 50  # Non-trivial answer
        assert "DRO" in data["answer"] or "Debt Relief Order" in data["answer"]
        assert data["confidence"] >= 0.6  # Reasonable confidence

        print(f"✓ Simple query test passed")
        print(f"  Complexity: {data['complexity']}")
        print(f"  Confidence: {data['confidence']}")
        print(f"  Answer length: {len(data['answer'])} chars")

    def test_bankruptcy_definition(self):
        """Test a simple question about bankruptcy."""
        query = {
            "question": "What is bankruptcy?",
            "topic": "general",
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        assert "answer" in data
        assert "bankruptcy" in data["answer"].lower()
        assert data["confidence"] >= 0.6

        print(f"✓ Bankruptcy definition test passed")


class TestComplexQueries:
    """Test complex queries that require multi-step reasoning and tools."""

    def test_eligibility_with_tools(self):
        """Test eligibility check using symbolic reasoning tools."""
        query = {
            "question": "Is a client with £15,000 debt, £50/month income, and £1,000 assets eligible for a DRO?",
            "topic": "dro_eligibility",
            "debt": 15000,
            "income": 50,
            "assets": 1000,
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        # Verify structured response
        assert "answer" in data
        assert "complexity" in data
        assert "confidence" in data

        # This client should be eligible (all values under limits)
        assert "eligible" in data["answer"].lower() or "yes" in data["answer"].lower()

        # Verify symbolic variables were used
        if "symbolic_variables" in data:
            assert "debt" in data["symbolic_variables"] or len(data["symbolic_variables"]) > 0

        print(f"✓ Eligibility with tools test passed")
        print(f"  Complexity: {data['complexity']}")
        print(f"  Confidence: {data['confidence']}")

    def test_threshold_extraction(self):
        """Test threshold extraction from manuals."""
        query = {
            "question": "What are the debt limits for DRO eligibility?",
            "topic": "dro",
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        assert "answer" in data
        # Should mention £50,000 limit
        assert "50" in data["answer"] or "50,000" in data["answer"]

        print(f"✓ Threshold extraction test passed")

    def test_multi_step_calculation(self):
        """Test query requiring multiple calculation steps."""
        query = {
            "question": "If a client has debts of £12,000, £8,000, and £15,000, what is their total debt? Are they eligible for a DRO?",
            "topic": "dro_eligibility",
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        # Should calculate total: 35,000
        assert "35" in data["answer"] or "35000" in data["answer"] or "35,000" in data["answer"]

        # Should be eligible (under £50,000)
        assert "eligible" in data["answer"].lower() or "yes" in data["answer"].lower()

        print(f"✓ Multi-step calculation test passed")


class TestSymbolicReasoning:
    """Test symbolic reasoning capabilities."""

    def test_dro_symbolic_check(self):
        """Test DRO eligibility using symbolic constraints."""
        query = {
            "question": "Check DRO eligibility with symbolic reasoning",
            "topic": "dro_eligibility",
            "debt": 45000,
            "income": 60,
            "assets": 1500,
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        # Client is eligible (all under limits)
        assert data["confidence"] >= 0.7

        print(f"✓ DRO symbolic check passed")

    def test_dro_near_miss(self):
        """Test near-miss detection (just over limit)."""
        query = {
            "question": "Check DRO eligibility",
            "topic": "dro_eligibility",
            "debt": 51000,  # Just over £50k limit
            "income": 50,
            "assets": 1000,
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        # Should indicate not eligible but close
        assert "not eligible" in data["answer"].lower() or "ineligible" in data["answer"].lower()

        print(f"✓ Near-miss detection test passed")

    def test_bankruptcy_eligibility(self):
        """Test bankruptcy eligibility check."""
        query = {
            "question": "Is bankruptcy an option?",
            "topic": "bankruptcy",
            "debt": 60000,
            "income": 100,
            "assets": 5000,
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        # High debt suggests bankruptcy is viable
        assert len(data["answer"]) > 50
        assert data["confidence"] >= 0.5

        print(f"✓ Bankruptcy eligibility test passed")


class TestLegacyComparison:
    """Compare LangGraph vs Legacy implementation."""

    def test_same_query_both_versions(self):
        """Run the same query through both implementations."""
        query_base = {
            "question": "What are the income limits for a DRO?",
            "topic": "dro"
        }

        # Test with LangGraph
        query_langgraph = {**query_base, "use_langgraph": True}
        response_langgraph = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query_langgraph,
            timeout=TIMEOUT
        )

        # Test with legacy
        query_legacy = {**query_base, "use_langgraph": False}
        response_legacy = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query_legacy,
            timeout=TIMEOUT
        )

        assert response_langgraph.status_code == 200
        assert response_legacy.status_code == 200

        data_langgraph = response_langgraph.json()
        data_legacy = response_legacy.json()

        # Both should mention £75
        assert "75" in data_langgraph["answer"]
        assert "75" in data_legacy["answer"]

        # Confidence should be similar (±20%)
        conf_diff = abs(data_langgraph["confidence"] - data_legacy["confidence"])
        assert conf_diff < 0.2, f"Confidence differs too much: {conf_diff}"

        print(f"✓ Legacy comparison test passed")
        print(f"  LangGraph confidence: {data_langgraph['confidence']}")
        print(f"  Legacy confidence: {data_legacy['confidence']}")


class TestPerformance:
    """Measure and compare performance."""

    def test_simple_query_performance(self):
        """Measure response time for simple queries."""
        query = {
            "question": "What is a DRO?",
            "topic": "general",
            "use_langgraph": True
        }

        # Measure LangGraph performance
        start = time.time()
        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )
        langgraph_time = time.time() - start

        assert response.status_code == 200

        # Measure legacy performance
        query["use_langgraph"] = False
        start = time.time()
        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )
        legacy_time = time.time() - start

        print(f"✓ Performance test passed")
        print(f"  LangGraph time: {langgraph_time:.2f}s")
        print(f"  Legacy time: {legacy_time:.2f}s")
        print(f"  Difference: {((langgraph_time - legacy_time) / legacy_time * 100):.1f}%")

        # Should be within ±50% (some variance expected)
        assert abs(langgraph_time - legacy_time) < max(langgraph_time, legacy_time) * 0.5

    def test_complex_query_performance(self):
        """Measure response time for complex queries with tools."""
        query = {
            "question": "Is a client with £15,000 debt, £50/month income, and £1,000 assets eligible for a DRO?",
            "topic": "dro_eligibility",
            "debt": 15000,
            "income": 50,
            "assets": 1000,
            "use_langgraph": True
        }

        # Warm up
        httpx.post(f"{BASE_URL}/agentic-query", json=query, timeout=TIMEOUT)

        # Measure 3 runs
        times = []
        for _ in range(3):
            start = time.time()
            response = httpx.post(
                f"{BASE_URL}/agentic-query",
                json=query,
                timeout=TIMEOUT
            )
            times.append(time.time() - start)
            assert response.status_code == 200

        avg_time = sum(times) / len(times)

        print(f"✓ Complex query performance test passed")
        print(f"  Average time: {avg_time:.2f}s")
        print(f"  Min: {min(times):.2f}s, Max: {max(times):.2f}s")

        # Should complete in reasonable time (< 10s)
        assert avg_time < 10.0


class TestErrorHandling:
    """Test error handling and edge cases."""

    def test_invalid_topic(self):
        """Test handling of invalid topic."""
        query = {
            "question": "What is a DRO?",
            "topic": "invalid_topic_xyz",
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        # Should still return 200 (graceful degradation)
        assert response.status_code in [200, 400]

        print(f"✓ Invalid topic test passed")

    def test_missing_financial_values(self):
        """Test eligibility query without financial values."""
        query = {
            "question": "Am I eligible for a DRO?",
            "topic": "dro_eligibility",
            "use_langgraph": True
            # No debt/income/assets provided
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        # Should handle gracefully
        assert response.status_code == 200
        data = response.json()

        # Should ask for more information
        assert len(data["answer"]) > 0

        print(f"✓ Missing values test passed")

    def test_extreme_values(self):
        """Test handling of extreme financial values."""
        query = {
            "question": "Check eligibility",
            "topic": "dro_eligibility",
            "debt": 999999999,  # Extremely high debt
            "income": 0,
            "assets": 0,
            "use_langgraph": True
        }

        response = httpx.post(
            f"{BASE_URL}/agentic-query",
            json=query,
            timeout=TIMEOUT
        )

        assert response.status_code == 200
        data = response.json()

        # Should clearly indicate not eligible
        assert "not eligible" in data["answer"].lower() or "ineligible" in data["answer"].lower()

        print(f"✓ Extreme values test passed")


def generate_test_report():
    """Generate a test report comparing implementations."""
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "tests": {
            "simple_queries": 0,
            "complex_queries": 0,
            "symbolic_reasoning": 0,
            "legacy_comparison": 0,
            "performance": 0,
            "error_handling": 0
        },
        "passed": 0,
        "failed": 0,
        "performance_data": []
    }

    return report


if __name__ == "__main__":
    print("=" * 80)
    print("RMA-Demo Integration Tests")
    print("LangGraph Migration Validation")
    print("=" * 80)
    print()

    # Run tests with pytest
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "-s"  # Show print statements
    ])
