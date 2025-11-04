#!/usr/bin/env python3
"""
Graph Integration Module for RAG Service

Integrates the NER Graph Builder Service with RAG for semantic knowledge extraction.
Enables:
1. Automatic graph building from ingested documents (manuals + client documents)
2. Graph search and entity lookup
3. Dual-graph comparison (manual rules vs client situation)
4. Graph-aware reasoning for advisory logic

Architecture:
- DocumentGraph: Represents a document's extracted knowledge graph
- DualGraphSearcher: Compare manual rules graph vs client situation graph
- GraphAwareReasoner: Enhanced reasoning using graph data

Integration Points:
1. Document Ingestion: Call NER service after OCR/parsing
2. Query Processing: Search graphs for relevant rules and relationships
3. Advisory Generation: Use graph data to formalize recommendations
"""

import logging
import requests
import json
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class EntityType(Enum):
    """Entity types that NER service extracts"""
    DEBT_TYPE = "DEBT_TYPE"
    OBLIGATION = "OBLIGATION"
    RULE = "RULE"
    GATE = "GATE"
    MONEY_THRESHOLD = "MONEY_THRESHOLD"
    CREDITOR = "CREDITOR"
    REPAYMENT_TERM = "REPAYMENT_TERM"
    LEGAL_STATUS = "LEGAL_STATUS"
    CLIENT_ATTRIBUTE = "CLIENT_ATTRIBUTE"
    PERSON = "PERSON"
    ORGANIZATION = "ORGANIZATION"
    DATE = "DATE"
    MONEY = "MONEY"
    PERCENT = "PERCENT"
    LOCATION = "LOCATION"
    DURATION = "DURATION"


class RelationType(Enum):
    """Relationship types between entities"""
    # Structural
    IS_A = "IS_A"
    PART_OF = "PART_OF"
    SYNONYMOUS = "SYNONYMOUS"
    # Logical
    TRIGGERS = "TRIGGERS"
    REQUIRES = "REQUIRES"
    BLOCKS = "BLOCKS"
    FOLLOWS = "FOLLOWS"
    # Domain-specific
    AFFECTS_REPAYMENT = "AFFECTS_REPAYMENT"
    HAS_GATE = "HAS_GATE"
    CONTRADICTS = "CONTRADICTS"
    EXTENDS = "EXTENDS"
    APPLICABLE_TO = "APPLICABLE_TO"
    ENABLES = "ENABLES"
    RESTRICTS = "RESTRICTS"


@dataclass
class Entity:
    """Extracted entity with confidence and source"""
    id: str
    text: str
    entity_type: EntityType
    confidence: float
    source_paragraph: str
    context: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "text": self.text,
            "type": self.entity_type.value,
            "confidence": self.confidence,
            "source_paragraph": self.source_paragraph,
            "context": self.context,
            "metadata": self.metadata
        }


@dataclass
class Relationship:
    """Extracted relationship between entities"""
    id: str
    entity1_id: str
    entity2_id: str
    relation_type: RelationType
    confidence: float
    source_sentences: List[str]
    condition: Optional[str] = None  # e.g., "if income > 15000"
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None
    logic_gate: Optional[str] = None  # "AND", "OR", "NOT"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "entity1_id": self.entity1_id,
            "entity2_id": self.entity2_id,
            "type": self.relation_type.value,
            "confidence": self.confidence,
            "source_sentences": self.source_sentences,
            "condition": self.condition,
            "effective_date": self.effective_date,
            "expiry_date": self.expiry_date,
            "logic_gate": self.logic_gate,
            "metadata": self.metadata
        }


@dataclass
class DocumentGraph:
    """Complete knowledge graph extracted from a document"""
    graph_id: str
    document_id: str
    filename: str
    extraction_timestamp: str
    entities: Dict[str, Entity] = field(default_factory=dict)  # id -> Entity
    relationships: Dict[str, Relationship] = field(default_factory=dict)  # id -> Relationship
    extraction_metadata: Dict[str, Any] = field(default_factory=dict)
    error_details: Optional[str] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "graph_id": self.graph_id,
            "document_id": self.document_id,
            "filename": self.filename,
            "extraction_timestamp": self.extraction_timestamp,
            "entities": {eid: entity.to_dict() for eid, entity in self.entities.items()},
            "relationships": {rid: rel.to_dict() for rid, rel in self.relationships.items()},
            "extraction_metadata": self.extraction_metadata,
            "error_details": self.error_details,
            "stats": {
                "entity_count": len(self.entities),
                "relationship_count": len(self.relationships),
                "entity_types": list(set(e.entity_type.value for e in self.entities.values())),
                "relationship_types": list(set(r.relation_type.value for r in self.relationships.values()))
            }
        }


@dataclass
class ApplicableRule:
    """A rule from manual graph that applies to client situation"""
    rule_entity: Entity
    matching_client_attribute: Optional[Entity]
    applicable_paths: List[Tuple[str, ...]]  # Paths from condition to consequence
    temporal_validity: Dict[str, str]  # {effective_date, expiry_date}
    confidence: float
    relevance_explanation: str


class NERServiceClient:
    """Client for communicating with NER Graph Service"""

    def __init__(self, base_url: str = "http://ner-graph-service:8108"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()

    def health_check(self) -> bool:
        """Check if NER service is available"""
        try:
            resp = self.session.get(f"{self.base_url}/health", timeout=5)
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"NER service health check failed: {e}")
            return False

    def extract_and_store_graph(
        self,
        document_text: str,
        document_id: str,
        filename: str,
        graph_label: str = "manual"
    ) -> DocumentGraph:
        """
        Extract entities and relationships from document text using NER service.
        
        Args:
            document_text: Full document content (markdown)
            document_id: Unique document identifier
            filename: Original filename
            graph_label: "manual" or "client" for dual-graph comparison
            
        Returns:
            DocumentGraph with extracted entities and relationships
        """
        try:
            payload = {
                "text": document_text,
                "document_id": document_id,
                "filename": filename,
                "graph_label": graph_label
            }

            resp = self.session.post(
                f"{self.base_url}/extract",
                json=payload,
                timeout=60
            )
            resp.raise_for_status()

            data = resp.json()

            # Parse response into DocumentGraph
            graph = DocumentGraph(
                graph_id=data.get("graph_id"),
                document_id=document_id,
                filename=filename,
                extraction_timestamp=data.get("extraction_timestamp", datetime.now().isoformat()),
                extraction_metadata=data.get("metadata", {})
            )

            # Parse entities
            if "entities" in data:
                for entity_data in data["entities"]:
                    entity = Entity(
                        id=entity_data["id"],
                        text=entity_data["text"],
                        entity_type=EntityType[entity_data["type"]],
                        confidence=entity_data.get("confidence", 0.8),
                        source_paragraph=entity_data.get("source_paragraph", ""),
                        context=entity_data.get("context"),
                        metadata=entity_data.get("metadata", {})
                    )
                    graph.entities[entity.id] = entity

            # Parse relationships
            if "relationships" in data:
                for rel_data in data["relationships"]:
                    rel = Relationship(
                        id=rel_data["id"],
                        entity1_id=rel_data["entity1_id"],
                        entity2_id=rel_data["entity2_id"],
                        relation_type=RelationType[rel_data["type"]],
                        confidence=rel_data.get("confidence", 0.8),
                        source_sentences=rel_data.get("source_sentences", []),
                        condition=rel_data.get("condition"),
                        effective_date=rel_data.get("effective_date"),
                        expiry_date=rel_data.get("expiry_date"),
                        logic_gate=rel_data.get("logic_gate"),
                        metadata=rel_data.get("metadata", {})
                    )
                    graph.relationships[rel.id] = rel

            logger.info(f"Extracted graph {graph.graph_id}: {len(graph.entities)} entities, {len(graph.relationships)} relationships")
            return graph

        except requests.exceptions.RequestException as e:
            logger.error(f"NER service request failed: {e}")
            return DocumentGraph(
                graph_id=f"error-{document_id}",
                document_id=document_id,
                filename=filename,
                extraction_timestamp=datetime.now().isoformat(),
                error_details=str(e)
            )

    def search_graph(
        self,
        graph_id: str,
        query: str,
        entity_types: Optional[List[str]] = None,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Search entities in a graph by keyword.
        
        Args:
            graph_id: ID of graph to search
            query: Keyword search query
            entity_types: Optional filter by entity types
            limit: Max results to return
            
        Returns:
            Search results with matching entities and relationships
        """
        try:
            payload = {
                "query": query,
                "entity_types": entity_types or [],
                "limit": limit
            }

            resp = self.session.post(
                f"{self.base_url}/graph/{graph_id}/search",
                json=payload,
                timeout=10
            )
            resp.raise_for_status()

            return resp.json()

        except Exception as e:
            logger.error(f"Graph search failed: {e}")
            return {"error": str(e), "results": []}

    def compare_graphs(
        self,
        manual_graph_id: str,
        client_graph_id: str
    ) -> Dict[str, Any]:
        """
        Compare two graphs to find applicable rules from manual to client situation.
        
        Args:
            manual_graph_id: ID of manual/knowledge base graph
            client_graph_id: ID of client situation graph
            
        Returns:
            Comparison results with applicable rules and gaps
        """
        try:
            payload = {
                "graph1_id": manual_graph_id,
                "graph2_id": client_graph_id,
                "comparison_type": "applicability"
            }

            resp = self.session.post(
                f"{self.base_url}/graph/compare",
                json=payload,
                timeout=30
            )
            resp.raise_for_status()

            return resp.json()

        except Exception as e:
            logger.error(f"Graph comparison failed: {e}")
            return {"error": str(e), "applicable_rules": [], "gaps": []}

    def get_reasoning_chain(
        self,
        graph_id: str,
        start_entity_id: str,
        end_entity_id: str
    ) -> Dict[str, Any]:
        """
        Generate reasoning chain from one entity to another.
        
        Args:
            graph_id: ID of graph to reason over
            start_entity_id: Starting entity ID
            end_entity_id: Ending entity ID
            
        Returns:
            Reasoning chain with explanation
        """
        try:
            payload = {
                "start_entity_id": start_entity_id,
                "end_entity_id": end_entity_id
            }

            resp = self.session.post(
                f"{self.base_url}/reasoning/chain",
                json=payload,
                timeout=30
            )
            resp.raise_for_status()

            return resp.json()

        except Exception as e:
            logger.error(f"Reasoning chain generation failed: {e}")
            return {"error": str(e), "chain": []}


class DualGraphSearcher:
    """
    Search across dual graphs (manual knowledge + client situation)
    to find applicable rules and identify gaps.
    """

    def __init__(self, ner_client: NERServiceClient):
        self.ner_client = ner_client

    def find_applicable_rules(
        self,
        manual_graph_id: str,
        client_graph_id: str,
        query_entity_types: Optional[List[str]] = None
    ) -> List[ApplicableRule]:
        """
        Find rules from manual graph that apply to client graph.
        
        Returns:
            List of ApplicableRule with confidence scores and applicability explanations
        """
        try:
            comparison = self.ner_client.compare_graphs(manual_graph_id, client_graph_id)

            applicable_rules = []

            if "applicable_rules" in comparison:
                for rule_data in comparison["applicable_rules"]:
                    # Convert to ApplicableRule object
                    rule = ApplicableRule(
                        rule_entity=Entity(
                            id=rule_data["rule_id"],
                            text=rule_data["rule_text"],
                            entity_type=EntityType[rule_data.get("type", "RULE")],
                            confidence=rule_data.get("confidence", 0.8),
                            source_paragraph=rule_data.get("source", "")
                        ),
                        matching_client_attribute=None,  # Optional match
                        applicable_paths=rule_data.get("paths", []),
                        temporal_validity={
                            "effective_date": rule_data.get("effective_date"),
                            "expiry_date": rule_data.get("expiry_date")
                        },
                        confidence=rule_data.get("confidence", 0.8),
                        relevance_explanation=rule_data.get("explanation", "")
                    )
                    applicable_rules.append(rule)

            return applicable_rules

        except Exception as e:
            logger.error(f"Failed to find applicable rules: {e}")
            return []

    def search_rules_by_keyword(
        self,
        manual_graph_id: str,
        keyword: str,
        client_graph_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for rules in manual graph by keyword.
        If client_graph_id provided, filter for applicability to client.
        
        Returns:
            List of matching rules with applicability info
        """
        try:
            # Search manual graph for keyword
            results = self.ner_client.search_graph(
                manual_graph_id,
                keyword,
                entity_types=["RULE", "GATE", "OBLIGATION"],
                limit=20
            )

            if client_graph_id and "results" in results:
                # Score applicability for each result
                for result in results.get("results", []):
                    # Check if rule applies to any client attributes
                    comparison = self.ner_client.compare_graphs(manual_graph_id, client_graph_id)
                    # This would involve more sophisticated matching logic
                    result["applicable_to_client"] = True  # Placeholder
                    result["applicability_confidence"] = 0.75  # Placeholder

            return results.get("results", [])

        except Exception as e:
            logger.error(f"Rule search failed: {e}")
            return []


class GraphAwareReasoner:
    """
    Use graph data to enhance reasoning and generate graph-aware recommendations.
    """

    def __init__(self, ner_client: NERServiceClient, dual_searcher: DualGraphSearcher):
        self.ner_client = ner_client
        self.dual_searcher = dual_searcher

    def build_reasoning_context(
        self,
        manual_graph_id: str,
        client_graph_id: str,
        query: str
    ) -> Dict[str, Any]:
        """
        Build reasoning context by combining graph data with query.
        
        Returns:
            Dictionary with:
            - applicable_rules: Rules from manual relevant to query
            - client_attributes: Extracted attributes from client graph
            - reasoning_paths: Logical connections between entities
            - gaps: Information needed but missing from client graph
        """
        try:
            # Find applicable rules
            applicable_rules = self.dual_searcher.find_applicable_rules(
                manual_graph_id,
                client_graph_id,
                query_entity_types=["RULE", "GATE"]
            )

            # Search for rules matching query
            search_results = self.dual_searcher.search_rules_by_keyword(
                manual_graph_id,
                query,
                client_graph_id
            )

            return {
                "applicable_rules": [
                    {
                        "rule": r.rule_entity.text,
                        "confidence": r.confidence,
                        "explanation": r.relevance_explanation,
                        "temporal_validity": r.temporal_validity,
                        "applicability_paths": r.applicable_paths
                    }
                    for r in applicable_rules
                ],
                "search_results": search_results,
                "query": query,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to build reasoning context: {e}")
            return {
                "error": str(e),
                "applicable_rules": [],
                "search_results": []
            }

    def generate_graph_aware_answer(
        self,
        base_answer: str,
        reasoning_context: Dict[str, Any]
    ) -> str:
        """
        Enhance base LLM answer with graph-derived insights.
        
        Args:
            base_answer: Original answer from RAG/LLM
            reasoning_context: Context from build_reasoning_context()
            
        Returns:
            Enhanced answer with graph citations and formal logic
        """
        if not reasoning_context.get("applicable_rules"):
            return base_answer

        # Build graph-aware enhancement
        enhancement = "\n\n**Graph-Based Analysis:**\n"

        applicable_rules = reasoning_context.get("applicable_rules", [])
        if applicable_rules:
            enhancement += "Applicable Rules from Knowledge Base:\n"
            for i, rule in enumerate(applicable_rules, 1):
                enhancement += f"  {i}. {rule['rule']} (confidence: {rule['confidence']:.2%})\n"
                if rule.get('explanation'):
                    enhancement += f"     {rule['explanation']}\n"

        return base_answer + enhancement


def create_graph_integrator(ner_service_url: str = "http://ner-graph-service:8108") -> Dict[str, Any]:
    """
    Factory function to create and wire up all graph integration components.
    
    Returns:
        Dictionary with NERServiceClient, DualGraphSearcher, and GraphAwareReasoner
    """
    ner_client = NERServiceClient(ner_service_url)

    # Check if service is available
    if not ner_client.health_check():
        logger.warning("NER service not available - graph features will be limited")

    dual_searcher = DualGraphSearcher(ner_client)
    graph_reasoner = GraphAwareReasoner(ner_client, dual_searcher)

    return {
        "ner_client": ner_client,
        "dual_searcher": dual_searcher,
        "graph_reasoner": graph_reasoner
    }
