"""
NER and Relationship extraction using LLM-based structured outputs.
Uses vLLM with JSON schema enforcement for reliable entity and relationship extraction.
"""

import json
import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class EntityType(str, Enum):
    """Entity types for debt advice domain."""
    # Domain-specific
    DEBT_TYPE = "DEBT_TYPE"  # Mortgage, credit card, personal loan, etc
    OBLIGATION = "OBLIGATION"  # Payment, legal requirement, contractual duty
    RULE = "RULE"  # Advisory rule or guideline
    GATE = "GATE"  # Time-based trigger or condition
    MONEY_THRESHOLD = "MONEY_THRESHOLD"  # Financial threshold value
    CREDITOR = "CREDITOR"  # Creditor or financial institution
    REPAYMENT_TERM = "REPAYMENT_TERM"  # Payment duration, frequency, amount
    LEGAL_STATUS = "LEGAL_STATUS"  # Bankruptcy, IVA, DMP status
    CLIENT_ATTRIBUTE = "CLIENT_ATTRIBUTE"  # Age, employment status, location
    
    # Standard NER
    PERSON = "PERSON"  # Individual name
    ORGANIZATION = "ORGANIZATION"  # Company or institution
    DATE = "DATE"  # Calendar date or period
    MONEY = "MONEY"  # Currency amount
    PERCENT = "PERCENT"  # Percentage value
    LOCATION = "LOCATION"  # Geographic location
    DURATION = "DURATION"  # Time duration


class RelationType(str, Enum):
    """Types of relationships between entities."""
    # Structural
    IS_A = "IS_A"  # Entity type hierarchy
    PART_OF = "PART_OF"  # Compositional relationship
    SYNONYMOUS = "SYNONYMOUS"  # Equivalent entities
    
    # Logical
    TRIGGERS = "TRIGGERS"  # Event B happens when A occurs
    REQUIRES = "REQUIRES"  # Entity B is required for A
    BLOCKS = "BLOCKS"  # Entity B prevents/blocks A
    FOLLOWS = "FOLLOWS"  # Temporal sequence (A then B)
    
    # Domain-specific (Debt Advice)
    AFFECTS_REPAYMENT = "AFFECTS_REPAYMENT"  # Rule affects repayment calculation
    HAS_GATE = "HAS_GATE"  # Rule has time-based condition
    CONTRADICTS = "CONTRADICTS"  # Rules conflict
    EXTENDS = "EXTENDS"  # Rule extends/modifies another
    APPLICABLE_TO = "APPLICABLE_TO"  # Rule applicable to debt type
    ENABLES = "ENABLES"  # Enables a strategy or action
    RESTRICTS = "RESTRICTS"  # Restricts a strategy or action


@dataclass
class Entity:
    """Extracted entity with metadata."""
    id: str  # UUID
    text: str  # Entity text (exact from document)
    entity_type: EntityType  # Type classification
    start_position: int  # Character position in document
    end_position: int  # Character end position
    context: str  # Surrounding sentence for reference
    confidence: float  # 0.0-1.0, confidence in extraction
    source_paragraph: int  # Paragraph number in document
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "text": self.text,
            "entity_type": self.entity_type.value,
            "start_position": self.start_position,
            "end_position": self.end_position,
            "context": self.context,
            "confidence": self.confidence,
            "source_paragraph": self.source_paragraph,
        }


@dataclass
class Relationship:
    """Extracted relationship between entities with temporal/conditional metadata."""
    id: str  # UUID
    entity1_id: str  # Source entity ID
    entity2_id: str  # Target entity ID
    relation_type: RelationType  # Type of relationship
    confidence: float  # 0.0-1.0, confidence in relationship
    
    # Temporal/Conditional Metadata
    condition: Optional[str] = None  # "if X then Y" condition text
    effective_date: Optional[str] = None  # "2025-01-01" onwards validity
    expiry_date: Optional[str] = None  # When relationship expires
    logic_gate: Optional[str] = None  # "when client_age > 65", structured condition
    
    # Source tracking
    source_sentences: Optional[List[str]] = None  # Supporting text fragments
    source_paragraph: Optional[int] = None  # Which paragraph
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "entity1_id": self.entity1_id,
            "entity2_id": self.entity2_id,
            "relation_type": self.relation_type.value,
            "confidence": self.confidence,
            "condition": self.condition,
            "effective_date": self.effective_date,
            "expiry_date": self.expiry_date,
            "logic_gate": self.logic_gate,
            "source_sentences": self.source_sentences or [],
            "source_paragraph": self.source_paragraph,
        }


class EntityExtractor:
    """Extract named entities using LLM with structured output."""
    
    EXTRACTION_PROMPT = """Extract all named entities from this text. For each entity, identify:
1. entity_text (exact text from document)
2. entity_type (one of: DEBT_TYPE, OBLIGATION, RULE, GATE, MONEY_THRESHOLD, CREDITOR, REPAYMENT_TERM, LEGAL_STATUS, CLIENT_ATTRIBUTE, PERSON, ORGANIZATION, DATE, MONEY, PERCENT, LOCATION, DURATION)
3. confidence (0.0-1.0, how confident you are)
4. start_position (character index where entity starts)
5. end_position (character index where entity ends)
6. context (the full sentence containing this entity)

Focus on domain-specific entities first (DEBT_TYPE, OBLIGATION, RULE, GATE, MONEY_THRESHOLD).
Only extract standard NER types (PERSON, DATE, MONEY) if they are relevant to the financial/debt domain.

Return a JSON array of entities:
[
  {{
    "entity_text": "...",
    "entity_type": "...",
    "confidence": 0.95,
    "start_position": 45,
    "end_position": 52,
    "context": "full sentence here"
  }}
]

Text to analyze:
{text}"""

    def __init__(self, llm_client):
        """
        Initialize entity extractor.
        
        Args:
            llm_client: LLM client with structured output support (vLLM)
        """
        self.llm = llm_client
    
    def extract(self, text: str, source_paragraph: int = 0) -> List[Entity]:
        """
        Extract entities from text using LLM.
        
        Args:
            text: Text to extract entities from
            source_paragraph: Paragraph number for tracking
            
        Returns:
            List of extracted entities
        """
        try:
            # Call LLM with structured output
            prompt = self.EXTRACTION_PROMPT.format(text=text)
            
            response = self.llm.create_extraction(
                prompt=prompt,
                schema_name="entity_extraction",
                max_tokens=2000
            )
            
            # Parse response
            try:
                entities_data = json.loads(response)
                if not isinstance(entities_data, list):
                    entities_data = [entities_data]
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse LLM response: {response}")
                return []
            
            # Convert to Entity objects
            entities = []
            for i, entity_data in enumerate(entities_data):
                try:
                    entity = Entity(
                        id=f"entity_{source_paragraph}_{i}_{hash(entity_data['entity_text']) % 10000}",
                        text=entity_data["entity_text"],
                        entity_type=EntityType[entity_data["entity_type"]],
                        start_position=entity_data.get("start_position", -1),
                        end_position=entity_data.get("end_position", -1),
                        context=entity_data.get("context", ""),
                        confidence=float(entity_data.get("confidence", 0.8)),
                        source_paragraph=source_paragraph,
                    )
                    
                    # Filter out low-confidence entities
                    if entity.confidence > 0.5:
                        entities.append(entity)
                except (KeyError, ValueError) as e:
                    logger.warning(f"Failed to parse entity: {entity_data}, error: {e}")
                    continue
            
            logger.info(f"Extracted {len(entities)} entities from paragraph {source_paragraph}")
            return entities
            
        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            return []
    
    def extract_batch(self, paragraphs: List[str]) -> List[Entity]:
        """
        Extract entities from multiple paragraphs.
        
        Args:
            paragraphs: List of text paragraphs
            
        Returns:
            Combined list of entities from all paragraphs
        """
        all_entities = []
        for i, paragraph in enumerate(paragraphs):
            entities = self.extract(paragraph, source_paragraph=i)
            all_entities.extend(entities)
        return all_entities


class RelationshipExtractor:
    """Extract relationships between entities using LLM."""
    
    EXTRACTION_PROMPT = """Given these entities extracted from a financial/debt advice document:

Entities:
{entities_list}

Extract relationships between these entities. For each relationship, identify:
1. entity1_text (first entity text - must be from entities list)
2. entity2_text (second entity text - must be from entities list)
3. relation_type (one of: IS_A, PART_OF, SYNONYMOUS, TRIGGERS, REQUIRES, BLOCKS, FOLLOWS, AFFECTS_REPAYMENT, HAS_GATE, CONTRADICTS, EXTENDS, APPLICABLE_TO, ENABLES, RESTRICTS)
4. confidence (0.0-1.0)
5. condition (if applicable: "if X then Y" format)
6. effective_date (if applicable: "2025-01-01" format, or null)
7. logic_gate (if applicable: "when condition" format, or null)
8. source_sentences (list of sentences supporting this relationship)

Return a JSON array of relationships:
[
  {{
    "entity1_text": "...",
    "entity2_text": "...",
    "relation_type": "TRIGGERS",
    "confidence": 0.92,
    "condition": "when debt > $10,000",
    "effective_date": "2025-01-01",
    "logic_gate": null,
    "source_sentences": ["sentence 1", "sentence 2"]
  }}
]

Original text for context:
{text}"""

    def __init__(self, llm_client):
        """
        Initialize relationship extractor.
        
        Args:
            llm_client: LLM client with structured output support
        """
        self.llm = llm_client
    
    def extract(self, 
                text: str, 
                entities: List[Entity],
                source_paragraph: int = 0) -> List[Relationship]:
        """
        Extract relationships between entities.
        
        Args:
            text: Original text
            entities: List of extracted entities
            source_paragraph: For tracking
            
        Returns:
            List of extracted relationships
        """
        if len(entities) < 2:
            logger.debug(f"Skipping relationship extraction: only {len(entities)} entities")
            return []
        
        try:
            # Build entity list for prompt
            entities_list = "\n".join([
                f"- {entity.text} (type: {entity.entity_type.value}, confidence: {entity.confidence})"
                for entity in entities
            ])
            
            # Call LLM
            prompt = self.EXTRACTION_PROMPT.format(
                entities_list=entities_list,
                text=text
            )
            
            response = self.llm.create_extraction(
                prompt=prompt,
                schema_name="relationship_extraction",
                max_tokens=3000
            )
            
            # Parse response
            try:
                relationships_data = json.loads(response)
                if not isinstance(relationships_data, list):
                    relationships_data = [relationships_data]
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse relationships: {response}")
                return []
            
            # Map entity texts to IDs
            entity_map = {entity.text: entity.id for entity in entities}
            
            # Convert to Relationship objects
            relationships = []
            for i, rel_data in enumerate(relationships_data):
                try:
                    entity1_text = rel_data.get("entity1_text", "")
                    entity2_text = rel_data.get("entity2_text", "")
                    
                    # Verify entities exist
                    if entity1_text not in entity_map or entity2_text not in entity_map:
                        logger.debug(f"Skipping relationship: entities not found")
                        continue
                    
                    relationship = Relationship(
                        id=f"rel_{source_paragraph}_{i}_{hash(entity1_text + entity2_text) % 10000}",
                        entity1_id=entity_map[entity1_text],
                        entity2_id=entity_map[entity2_text],
                        relation_type=RelationType[rel_data.get("relation_type", "FOLLOWS")],
                        confidence=float(rel_data.get("confidence", 0.8)),
                        condition=rel_data.get("condition"),
                        effective_date=rel_data.get("effective_date"),
                        expiry_date=rel_data.get("expiry_date"),
                        logic_gate=rel_data.get("logic_gate"),
                        source_sentences=rel_data.get("source_sentences", []),
                        source_paragraph=source_paragraph,
                    )
                    
                    # Filter out low-confidence relationships
                    if relationship.confidence > 0.5:
                        relationships.append(relationship)
                except (KeyError, ValueError) as e:
                    logger.warning(f"Failed to parse relationship: {rel_data}, error: {e}")
                    continue
            
            logger.info(f"Extracted {len(relationships)} relationships from paragraph {source_paragraph}")
            return relationships
            
        except Exception as e:
            logger.error(f"Relationship extraction failed: {e}")
            return []
    
    def extract_batch(self,
                     paragraphs: List[str],
                     all_entities: List[Entity]) -> List[Relationship]:
        """
        Extract relationships from multiple paragraphs.
        
        Args:
            paragraphs: List of text paragraphs
            all_entities: All entities across all paragraphs
            
        Returns:
            Combined list of relationships
        """
        all_relationships = []
        for i, paragraph in enumerate(paragraphs):
            # Get entities for this paragraph
            para_entities = [e for e in all_entities if e.source_paragraph == i]
            relationships = self.extract(paragraph, para_entities, source_paragraph=i)
            all_relationships.extend(relationships)
        return all_relationships


class GraphConstructor:
    """Construct Neo4j graph from entities and relationships."""
    
    def __init__(self, neo4j_client):
        """
        Initialize graph constructor.
        
        Args:
            neo4j_client: Neo4j connection client
        """
        self.neo4j = neo4j_client
    
    def build_graph(self,
                   markdown: str,
                   entities: List[Entity],
                   relationships: List[Relationship],
                   source_document: str,
                   graph_type: str = "MANUAL") -> Dict:
        """
        Build Neo4j graph from entities and relationships.
        
        Args:
            markdown: Original markdown text
            entities: List of entities
            relationships: List of relationships
            source_document: Document ID/name
            graph_type: "MANUAL" or "CLIENT"
            
        Returns:
            Dict with graph_id, node_count, relationship_count, metadata
        """
        try:
            # Create extraction run metadata
            extraction_id = f"extraction_{source_document}_{hash(markdown) % 100000}"
            
            graph_id = self.neo4j.create_extraction_run(
                extraction_id=extraction_id,
                document_id=source_document,
                entity_count=len(entities),
                relationship_count=len(relationships),
                avg_confidence=sum(e.confidence for e in entities) / len(entities) if entities else 0.0,
                graph_type=graph_type
            )
            
            # Create entity nodes
            entity_ids = {}
            for entity in entities:
                node_id = self.neo4j.create_entity_node(
                    entity_id=entity.id,
                    text=entity.text,
                    entity_type=entity.entity_type.value,
                    confidence=entity.confidence,
                    source_document=source_document,
                    graph_label=graph_type,
                    extraction_run_id=extraction_id
                )
                entity_ids[entity.id] = node_id
            
            logger.info(f"Created {len(entities)} entity nodes")
            
            # Create relationship edges
            relationship_count = 0
            for relationship in relationships:
                self.neo4j.create_relationship(
                    from_entity_id=relationship.entity1_id,
                    to_entity_id=relationship.entity2_id,
                    relation_type=relationship.relation_type.value,
                    confidence=relationship.confidence,
                    condition=relationship.condition,
                    effective_date=relationship.effective_date,
                    expiry_date=relationship.expiry_date,
                    logic_gate=relationship.logic_gate,
                    source_sentences=relationship.source_sentences
                )
                relationship_count += 1
            
            logger.info(f"Created {relationship_count} relationships")
            
            return {
                "graph_id": graph_id,
                "extraction_id": extraction_id,
                "entity_count": len(entities),
                "relationship_count": relationship_count,
                "avg_confidence": sum(e.confidence for e in entities) / len(entities) if entities else 0.0,
                "graph_type": graph_type,
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"Graph construction failed: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }


def split_into_paragraphs(markdown: str) -> List[str]:
    """Split markdown into paragraphs for batch processing."""
    paragraphs = [p.strip() for p in markdown.split("\n\n") if p.strip()]
    return paragraphs
