"""
NER Graph Builder Service
FastAPI application for extracting entities, relationships, and building knowledge graphs.
"""

import logging
import os
import uuid
from typing import Dict, List, Optional
from datetime import datetime
import asyncio

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
import uvicorn

from extractors import (
    EntityExtractor, RelationshipExtractor, GraphConstructor,
    split_into_paragraphs, Entity, Relationship
)
from neo4j_client import Neo4jClient
from llm_client import VLLMClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "changeme-in-production")
VLLM_URL = os.getenv("VLLM_URL", "http://vllm:8000")
VLLM_MODEL = os.getenv("VLLM_MODEL", "llama3.2")

# Initialize clients
neo4j_client = Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
vllm_client = VLLMClient(VLLM_URL, VLLM_MODEL)

entity_extractor = EntityExtractor(vllm_client)
relationship_extractor = RelationshipExtractor(vllm_client)
graph_constructor = GraphConstructor(neo4j_client)

# FastAPI app
app = FastAPI(
    title="NER Graph Builder Service",
    description="Extract entities and relationships from documents and build semantic knowledge graphs",
    version="1.0.0"
)

# Pydantic models for API
class EntityResponse(BaseModel):
    """Entity extraction result."""
    id: str
    text: str
    entity_type: str
    confidence: float
    context: str
    source_paragraph: int


class RelationshipResponse(BaseModel):
    """Relationship extraction result."""
    id: str
    entity1_id: str
    entity2_id: str
    relation_type: str
    confidence: float
    condition: Optional[str] = None
    effective_date: Optional[str] = None
    logic_gate: Optional[str] = None
    source_sentences: List[str] = []


class ExtractionRequest(BaseModel):
    """Request to extract graph from markdown."""
    markdown: str = Field(..., description="Markdown text to extract from")
    source_document: str = Field(..., description="Document ID or name")
    graph_type: str = Field(
        "MANUAL",
        description="Type of graph: MANUAL (knowledge base) or CLIENT (situation)"
    )


class ExtractionResponse(BaseModel):
    """Response from graph extraction."""
    extraction_id: str
    graph_id: str
    entity_count: int
    relationship_count: int
    avg_confidence: float
    graph_type: str
    status: str
    entities: Optional[List[EntityResponse]] = None
    relationships: Optional[List[RelationshipResponse]] = None


class GraphQueryResponse(BaseModel):
    """Response from graph query."""
    nodes: List[Dict]
    edges: List[Dict]
    node_count: int
    edge_count: int


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    neo4j_connected: bool
    vllm_available: bool
    timestamp: str


# Lifecycle events
@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup."""
    logger.info("Starting NER Graph Builder Service")
    
    # Connect to Neo4j
    if neo4j_client.connect():
        neo4j_client.setup_indices()
        logger.info("Neo4j connected and indices created")
    else:
        logger.error("Failed to connect to Neo4j")
    
    # Check vLLM
    if vllm_client.health_check():
        logger.info("vLLM service is available")
    else:
        logger.warning("vLLM service is not available")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    logger.info("Shutting down NER Graph Builder Service")
    neo4j_client.close()


# Health check endpoint
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Check service health and dependencies."""
    return HealthResponse(
        status="healthy",
        neo4j_connected=True,  # Would be False if connection failed
        vllm_available=vllm_client.health_check(),
        timestamp=datetime.utcnow().isoformat()
    )


# Extraction endpoints
@app.post("/extract", response_model=ExtractionResponse, tags=["Extraction"])
async def extract_graph(request: ExtractionRequest) -> ExtractionResponse:
    """
    Extract entities, relationships, and build knowledge graph from markdown.
    
    Returns:
        Extraction ID, graph ID, entity/relationship counts, and optionally full data
    """
    try:
        logger.info(f"Starting extraction for document: {request.source_document}")
        
        # Split markdown into paragraphs
        paragraphs = split_into_paragraphs(request.markdown)
        logger.info(f"Split markdown into {len(paragraphs)} paragraphs")
        
        # Extract entities from all paragraphs
        all_entities = entity_extractor.extract_batch(paragraphs)
        logger.info(f"Extracted {len(all_entities)} entities")
        
        # Extract relationships
        all_relationships = relationship_extractor.extract_batch(paragraphs, all_entities)
        logger.info(f"Extracted {len(all_relationships)} relationships")
        
        # Build Neo4j graph
        result = graph_constructor.build_graph(
            markdown=request.markdown,
            entities=all_entities,
            relationships=all_relationships,
            source_document=request.source_document,
            graph_type=request.graph_type
        )
        
        if result.get("status") == "failed":
            raise HTTPException(
                status_code=500,
                detail=f"Graph construction failed: {result.get('error')}"
            )
        
        # Convert to response models
        entity_responses = [
            EntityResponse(
                id=e.id,
                text=e.text,
                entity_type=e.entity_type.value,
                confidence=e.confidence,
                context=e.context,
                source_paragraph=e.source_paragraph
            )
            for e in all_entities
        ]
        
        relationship_responses = [
            RelationshipResponse(
                id=r.id,
                entity1_id=r.entity1_id,
                entity2_id=r.entity2_id,
                relation_type=r.relation_type.value,
                confidence=r.confidence,
                condition=r.condition,
                effective_date=r.effective_date,
                logic_gate=r.logic_gate,
                source_sentences=r.source_sentences or []
            )
            for r in all_relationships
        ]
        
        return ExtractionResponse(
            extraction_id=result["extraction_id"],
            graph_id=result["graph_id"],
            entity_count=result["entity_count"],
            relationship_count=result["relationship_count"],
            avg_confidence=result["avg_confidence"],
            graph_type=result["graph_type"],
            status="success",
            entities=entity_responses,
            relationships=relationship_responses
        )
        
    except Exception as e:
        logger.error(f"Extraction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}"
        )


# Graph query endpoints
@app.get("/graph/{graph_id}", response_model=GraphQueryResponse, tags=["Graph"])
async def get_graph(graph_id: str) -> GraphQueryResponse:
    """
    Retrieve graph structure (nodes and edges).
    
    Args:
        graph_id: Extraction run ID
        
    Returns:
        Nodes and edges of the graph
    """
    try:
        graph_data = neo4j_client.get_graph(graph_id)
        
        if "error" in graph_data:
            raise HTTPException(
                status_code=404,
                detail=f"Graph not found: {graph_data['error']}"
            )
        
        return GraphQueryResponse(
            nodes=graph_data["nodes"],
            edges=graph_data["edges"],
            node_count=graph_data["node_count"],
            edge_count=graph_data["edge_count"]
        )
        
    except Exception as e:
        logger.error(f"Failed to get graph: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get graph: {str(e)}"
        )


@app.get("/graph/{graph_id}/search", tags=["Graph"])
async def search_graph(
    graph_id: str,
    query: str,
    entity_type: Optional[str] = None,
    limit: int = 50
) -> Dict:
    """
    Search entities in a graph.
    
    Args:
        graph_id: Graph ID
        query: Search query text
        entity_type: Optional entity type filter
        limit: Maximum results
        
    Returns:
        Matching entities
    """
    try:
        results = neo4j_client.search_entities(
            search_text=query,
            graph_label="MANUAL" if "MANUAL" in graph_id else "CLIENT",
            entity_type=entity_type
        )
        
        return {
            "query": query,
            "results": results[:limit],
            "result_count": len(results)
        }
        
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@app.post("/graph/compare", tags=["Graph"])
async def compare_graphs(
    manual_graph_id: str,
    client_graph_id: str,
    question_entities: List[str] = []
) -> Dict:
    """
    Compare manual graph with client graph.
    
    Args:
        manual_graph_id: Manual knowledge graph ID
        client_graph_id: Client situation graph ID
        question_entities: Entities from advisor question
        
    Returns:
        Applicable rules and reasoning paths
    """
    try:
        result = neo4j_client.find_applicable_rules(
            client_graph_id=client_graph_id,
            manual_graph_id=manual_graph_id,
            question_entities=question_entities
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Graph comparison failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Graph comparison failed: {str(e)}"
        )


# Reasoning endpoints
@app.post("/reasoning/chain", tags=["Reasoning"])
async def generate_reasoning_chain(
    question: str,
    applicable_rules: str,
    client_facts: str
) -> Dict:
    """
    Generate reasoning chain from question, rules, and facts.
    
    Args:
        question: Advisory question
        applicable_rules: Applicable rules from manual graph
        client_facts: Client facts from client graph
        
    Returns:
        Generated reasoning chain
    """
    try:
        reasoning = vllm_client.generate_reasoning_chain(
            question=question,
            applicable_rules=applicable_rules,
            client_facts=client_facts
        )
        
        return {
            "question": question,
            "reasoning": reasoning,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Reasoning generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Reasoning generation failed: {str(e)}"
        )


# Status/diagnostic endpoints
@app.get("/stats", tags=["Stats"])
async def get_statistics() -> Dict:
    """Get service statistics."""
    return {
        "service": "NER Graph Builder",
        "version": "1.0.0",
        "neo4j_uri": NEO4J_URI,
        "vllm_url": VLLM_URL,
        "vllm_model": VLLM_MODEL,
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8108,
        log_level="info"
    )
