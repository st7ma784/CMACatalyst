#!/usr/bin/env python3
"""
Integration Tests for Phase 2: Graph Integration

Tests the integration between RAG service and NER Graph Service.

Coverage:
1. NER Service communication and health checks
2. Document graph extraction and storage
3. Graph search and entity lookup
4. Dual-graph comparison logic
5. Graph-aware reasoning with RAG results
6. End-to-end document ingestion with graph extraction
"""

import pytest
import json
import logging
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Import components to test
from graph_integrator import (
    NERServiceClient,
    DualGraphSearcher,
    GraphAwareReasoner,
    DocumentGraph,
    Entity,
    Relationship,
    EntityType,
    RelationType,
    ApplicableRule,
    create_graph_integrator
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestNERServiceClient:
    """Tests for NER service communication"""

    def test_health_check_success(self):
        """NER service health check returns True when available"""
        with patch('requests.Session.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_get.return_value = mock_response

            client = NERServiceClient("http://mock-ner:8108")
            result = client.health_check()

            assert result is True
            mock_get.assert_called_once()

    def test_health_check_failure(self):
        """NER service health check returns False when unavailable"""
        with patch('requests.Session.get') as mock_get:
            mock_get.side_effect = Exception("Connection refused")

            client = NERServiceClient("http://mock-ner:8108")
            result = client.health_check()

            assert result is False

    def test_extract_and_store_graph_success(self):
        """Successful graph extraction from document"""
        mock_response_data = {
            "graph_id": "graph-123",
            "extraction_timestamp": datetime.now().isoformat(),
            "metadata": {"version": "1.0"},
            "entities": [
                {
                    "id": "e1",
                    "text": "Debt Relief Order",
                    "type": "DEBT_TYPE",
                    "confidence": 0.95,
                    "source_paragraph": "A DRO is...",
                    "context": None,
                    "metadata": {}
                }
            ],
            "relationships": [
                {
                    "id": "r1",
                    "entity1_id": "e1",
                    "entity2_id": "e2",
                    "type": "TRIGGERS",
                    "confidence": 0.85,
                    "source_sentences": ["DRO triggers..."],
                    "condition": None,
                    "effective_date": None,
                    "expiry_date": None,
                    "logic_gate": None,
                    "metadata": {}
                }
            ]
        }

        with patch('requests.Session.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response

            client = NERServiceClient("http://mock-ner:8108")
            graph = client.extract_and_store_graph(
                "Test document content",
                "doc-123",
                "test.txt",
                "manual"
            )

            assert graph.graph_id == "graph-123"
            assert len(graph.entities) == 1
            assert "e1" in graph.entities
            assert graph.entities["e1"].text == "Debt Relief Order"
            assert graph.entities["e1"].entity_type == EntityType.DEBT_TYPE
            assert graph.entities["e1"].confidence == 0.95

    def test_extract_and_store_graph_error(self):
        """Graph extraction handles errors gracefully"""
        with patch('requests.Session.post') as mock_post:
            mock_post.side_effect = Exception("Service unavailable")

            client = NERServiceClient("http://mock-ner:8108")
            graph = client.extract_and_store_graph(
                "Test document",
                "doc-123",
                "test.txt"
            )

            assert graph.error_details is not None
            assert len(graph.entities) == 0

    def test_search_graph_success(self):
        """Graph search returns matching entities"""
        search_results = {
            "query": "debt",
            "results": [
                {
                    "entity_id": "e1",
                    "text": "Debt Relief Order",
                    "type": "DEBT_TYPE",
                    "confidence": 0.9
                }
            ]
        }

        with patch('requests.Session.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = search_results
            mock_post.return_value = mock_response

            client = NERServiceClient("http://mock-ner:8108")
            results = client.search_graph(
                "graph-123",
                "debt",
                entity_types=["DEBT_TYPE"],
                limit=10
            )

            assert len(results["results"]) == 1
            assert results["results"][0]["text"] == "Debt Relief Order"

    def test_compare_graphs_success(self):
        """Graph comparison identifies applicable rules"""
        comparison = {
            "applicable_rules": [
                {
                    "rule_id": "r1",
                    "rule_text": "If debt < £15,000, eligible for DRO",
                    "type": "RULE",
                    "confidence": 0.88,
                    "paths": [["RULE", "GATE", "MONEY_THRESHOLD"]],
                    "effective_date": None,
                    "expiry_date": None,
                    "explanation": "Matches client's debt level"
                }
            ],
            "gaps": []
        }

        with patch('requests.Session.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = comparison
            mock_post.return_value = mock_response

            client = NERServiceClient("http://mock-ner:8108")
            result = client.compare_graphs("graph-manual", "graph-client")

            assert len(result["applicable_rules"]) == 1
            assert "eligible" in result["applicable_rules"][0]["rule_text"]


class TestDualGraphSearcher:
    """Tests for dual-graph searching"""

    def test_find_applicable_rules(self):
        """Find rules applicable to client situation"""
        mock_client = Mock(spec=NERServiceClient)
        mock_client.compare_graphs.return_value = {
            "applicable_rules": [
                {
                    "rule_id": "r1",
                    "rule_text": "Debt Relief Order eligibility",
                    "type": "RULE",
                    "confidence": 0.9,
                    "paths": [],
                    "source": "Manual section 3.1",
                    "effective_date": None,
                    "expiry_date": None,
                    "explanation": "Client meets debt threshold"
                }
            ]
        }

        searcher = DualGraphSearcher(mock_client)
        rules = searcher.find_applicable_rules("graph-manual", "graph-client")

        assert len(rules) == 1
        assert isinstance(rules[0], ApplicableRule)
        assert rules[0].confidence == 0.9
        assert "eligibility" in rules[0].rule_entity.text.lower()

    def test_search_rules_by_keyword(self):
        """Search for rules matching keywords"""
        mock_client = Mock(spec=NERServiceClient)
        mock_client.search_graph.return_value = {
            "results": [
                {
                    "entity_id": "e1",
                    "text": "Debt Relief Order for debts under £15,000",
                    "type": "RULE",
                    "confidence": 0.92,
                    "applicable_to_client": True,
                    "applicability_confidence": 0.85
                }
            ]
        }

        searcher = DualGraphSearcher(mock_client)
        results = searcher.search_rules_by_keyword(
            "graph-manual",
            "debt relief",
            "graph-client"
        )

        assert len(results) == 1
        assert "Relief" in results[0]["text"]
        assert results[0]["applicable_to_client"] is True


class TestGraphAwareReasoner:
    """Tests for graph-aware reasoning"""

    def test_build_reasoning_context(self):
        """Build context from graphs for reasoning"""
        mock_client = Mock(spec=NERServiceClient)
        mock_searcher = Mock(spec=DualGraphSearcher)

        mock_applicable_rules = [
            ApplicableRule(
                rule_entity=Entity(
                    id="r1",
                    text="DRO eligible if debt < £15,000",
                    entity_type=EntityType.RULE,
                    confidence=0.9,
                    source_paragraph="Manual page 5"
                ),
                matching_client_attribute=None,
                applicable_paths=[["RULE", "GATE", "MONEY_THRESHOLD"]],
                temporal_validity={"effective_date": None, "expiry_date": None},
                confidence=0.9,
                relevance_explanation="Client's total debt is £12,000"
            )
        ]

        mock_searcher.find_applicable_rules.return_value = mock_applicable_rules
        mock_searcher.search_rules_by_keyword.return_value = [
            {"rule": "DRO eligibility", "confidence": 0.9}
        ]

        reasoner = GraphAwareReasoner(mock_client, mock_searcher)
        context = reasoner.build_reasoning_context(
            "graph-manual",
            "graph-client",
            "debt relief order"
        )

        assert "applicable_rules" in context
        assert len(context["applicable_rules"]) == 1
        assert context["applicable_rules"][0]["confidence"] == 0.9
        assert "debt" in context["applicable_rules"][0]["rule"].lower()

    def test_generate_graph_aware_answer(self):
        """Generate enhanced answer with graph insights"""
        mock_client = Mock(spec=NERServiceClient)
        mock_searcher = Mock(spec=DualGraphSearcher)

        reasoner = GraphAwareReasoner(mock_client, mock_searcher)

        base_answer = "Based on the manual, you may be eligible for a Debt Relief Order."

        reasoning_context = {
            "applicable_rules": [
                {
                    "rule": "DRO requires debt < £15,000",
                    "confidence": 0.9,
                    "explanation": "Your total debt is £12,000",
                    "temporal_validity": {},
                    "applicability_paths": []
                }
            ]
        }

        enhanced = reasoner.generate_graph_aware_answer(base_answer, reasoning_context)

        assert base_answer in enhanced
        assert "Graph-Based Analysis" in enhanced
        assert "DRO requires" in enhanced
        assert "confidence: 90%" in enhanced


class TestDocumentGraph:
    """Tests for DocumentGraph data structure"""

    def test_document_graph_creation(self):
        """Create and populate document graph"""
        graph = DocumentGraph(
            graph_id="g1",
            document_id="d1",
            filename="manual.md",
            extraction_timestamp=datetime.now().isoformat()
        )

        entity = Entity(
            id="e1",
            text="Debt Relief Order",
            entity_type=EntityType.DEBT_TYPE,
            confidence=0.95,
            source_paragraph="Section 1"
        )
        graph.entities["e1"] = entity

        rel = Relationship(
            id="r1",
            entity1_id="e1",
            entity2_id="e2",
            relation_type=RelationType.TRIGGERS,
            confidence=0.85,
            source_sentences=["DRO triggers..."]
        )
        graph.relationships["r1"] = rel

        dict_repr = graph.to_dict()

        assert dict_repr["graph_id"] == "g1"
        assert dict_repr["stats"]["entity_count"] == 1
        assert dict_repr["stats"]["relationship_count"] == 1
        assert "DEBT_TYPE" in dict_repr["stats"]["entity_types"]


class TestGraphIntegration:
    """End-to-end integration tests"""

    def test_create_graph_integrator(self):
        """Factory function creates all components"""
        with patch('requests.Session.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_get.return_value = mock_response

            components = create_graph_integrator("http://mock-ner:8108")

            assert "ner_client" in components
            assert "dual_searcher" in components
            assert "graph_reasoner" in components
            assert isinstance(components["ner_client"], NERServiceClient)
            assert isinstance(components["dual_searcher"], DualGraphSearcher)
            assert isinstance(components["graph_reasoner"], GraphAwareReasoner)

    def test_end_to_end_extraction_and_search(self):
        """End-to-end: Extract graph, search, and reason"""
        # Mock NER service response
        mock_extraction = {
            "graph_id": "g1",
            "extraction_timestamp": datetime.now().isoformat(),
            "metadata": {},
            "entities": [
                {
                    "id": "e1",
                    "text": "Income threshold",
                    "type": "MONEY_THRESHOLD",
                    "confidence": 0.9,
                    "source_paragraph": "Section 2",
                    "context": None,
                    "metadata": {}
                }
            ],
            "relationships": []
        }

        mock_comparison = {
            "applicable_rules": [
                {
                    "rule_id": "r1",
                    "rule_text": "Income must be below threshold",
                    "type": "RULE",
                    "confidence": 0.85,
                    "paths": [],
                    "source": "Manual",
                    "effective_date": None,
                    "expiry_date": None,
                    "explanation": "Matches client situation"
                }
            ]
        }

        with patch('requests.Session.post') as mock_post, \
             patch('requests.Session.get') as mock_get:

            mock_response = Mock()
            mock_response.status_code = 200
            mock_post.return_value = mock_response
            mock_get.return_value = mock_response

            # First extraction
            mock_response.json.side_effect = [
                mock_extraction,  # Manual extraction
                mock_extraction,  # Client extraction
                mock_comparison   # Comparison
            ]

            client = NERServiceClient("http://mock-ner:8108")

            # Extract manual graph
            manual_graph = client.extract_and_store_graph(
                "Manual text",
                "manual-1",
                "manual.md",
                "manual"
            )
            assert manual_graph.graph_id == "g1"

            # Extract client graph
            client_graph = client.extract_and_store_graph(
                "Client situation",
                "client-1",
                "client.txt",
                "client"
            )
            assert client_graph.graph_id == "g1"

            # Compare graphs
            comparison = client.compare_graphs(
                manual_graph.graph_id,
                client_graph.graph_id
            )
            assert len(comparison["applicable_rules"]) == 1


def run_tests():
    """Run all tests and report results"""
    pytest.main([__file__, "-v", "--tb=short"])


if __name__ == "__main__":
    run_tests()
