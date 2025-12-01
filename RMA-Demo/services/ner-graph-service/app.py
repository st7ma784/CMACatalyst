"""
NER Graph Service - Neo4j Entity & Relationship Extraction
Extracts named entities and relationships from documents and stores in Neo4j
"""

import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import httpx
import logging

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NER Graph Service", version="1.0.0")

# Neo4j Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "changeme-in-production")

# LLM Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2:7b")

# Neo4j Driver
driver = None

def init_neo4j():
    """Initialize Neo4j connection"""
    global driver
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        # Test connection
        with driver.session() as session:
            session.run("RETURN 1")
        logger.info("Connected to Neo4j")
        # Create indexes
        with driver.session() as session:
            session.run("CREATE INDEX IF NOT EXISTS FOR (n:Entity) ON (n.id)")
            session.run("CREATE INDEX IF NOT EXISTS FOR (r:Relationship) ON (r.id)")
        logger.info("Neo4j indexes created")
    except ServiceUnavailable:
        logger.error(f"Could not connect to Neo4j at {NEO4J_URI}")
        driver = None

# Initialize on startup
@app.on_event("startup")
async def startup():
    init_neo4j()

@app.on_event("shutdown")
async def shutdown():
    if driver:
        driver.close()

# Pydantic Models
class Entity(BaseModel):
    id: str
    label: str
    type: str
    confidence: float
    properties: Dict[str, Any] = {}

class Relationship(BaseModel):
    id: str
    source_id: str
    target_id: str
    type: str
    confidence: float
    properties: Dict[str, Any] = {}

class ExtractionRequest(BaseModel):
    markdown: str
    source_document: str = "unknown"
    graph_type: str = "MANUAL"

class ExtractionResponse(BaseModel):
    graph_id: str
    entities: List[Entity]
    relationships: List[Relationship]
    entity_count: int
    relationship_count: int
    confidence_avg: float
    created_at: str

class GraphQuery(BaseModel):
    graph_id: str
    entity_type: Optional[str] = None
    limit: int = 100

# Helper Functions
def extract_entities_llm(text: str) -> List[Dict]:
    """Extract entities using Ollama"""
    prompt = f"""Extract named entities from this text. Return as JSON array with id, label, type, confidence.
Entity types: PERSON, ORGANIZATION, LOCATION, CONCEPT, POLICY, AMOUNT, DATE, CONDITION, CONSEQUENCE, PROCESS, REQUIREMENT, EXEMPTION, PENALTY, RELIEF_MEASURE, ELIGIBILITY_CRITERION, APPLICATION_PROCESS

Text:
{text}

Return only valid JSON array, no markdown:"""

    try:
        import httpx
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "temperature": 0.3,
                },
            )
            
            if response.status_code == 200:
                result = response.json()
                text_result = result["response"].strip()
                
                # Try to parse JSON
                try:
                    # Find JSON array in response
                    start = text_result.find('[')
                    end = text_result.rfind(']') + 1
                    if start >= 0 and end > start:
                        json_str = text_result[start:end]
                        entities = json.loads(json_str)
                        return entities
                except json.JSONDecodeError:
                    pass
            
            # Fallback entities
            return [
                {
                    "id": str(uuid.uuid4()),
                    "label": text[:50],
                    "type": "CONCEPT",
                    "confidence": 0.5
                }
            ]
    except Exception as e:
        logger.error(f"Error extracting entities: {e}")
        return []

def extract_relationships_llm(entities: List[Dict], text: str) -> List[Dict]:
    """Extract relationships between entities"""
    if len(entities) < 2:
        return []
    
    entity_labels = [e["label"] for e in entities[:10]]
    prompt = f"""Find relationships between these entities in the text:
Entities: {', '.join(entity_labels)}

Text:
{text}

Return JSON array with source_entity, relationship_type, target_entity, confidence (0-1).
Relationship types: APPLIES_TO, REQUIRES, EXCLUDES, CAUSES, RELATES_TO, DEFINES, DETERMINES, AUTHORIZES

Return only valid JSON array:"""

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "temperature": 0.3,
                },
            )
            
            if response.status_code == 200:
                result = response.json()
                text_result = result["response"].strip()
                
                try:
                    start = text_result.find('[')
                    end = text_result.rfind(']') + 1
                    if start >= 0 and end > start:
                        json_str = text_result[start:end]
                        relationships = json.loads(json_str)
                        return relationships
                except json.JSONDecodeError:
                    pass
            
            return []
    except Exception as e:
        logger.error(f"Error extracting relationships: {e}")
        return []

def store_graph_in_neo4j(graph_id: str, entities: List[Entity], relationships: List[Relationship], metadata: Dict):
    """Store extracted graph in Neo4j"""
    if not driver:
        logger.error("Neo4j driver not initialized")
        return
    
    try:
        with driver.session() as session:
            # Create graph metadata node
            session.run(
                """CREATE (g:Graph {
                    id: $id,
                    source_document: $source,
                    graph_type: $type,
                    created_at: $created,
                    entity_count: $entity_count,
                    relationship_count: $rel_count,
                    avg_confidence: $avg_conf
                })""",
                id=graph_id,
                source=metadata.get("source_document", "unknown"),
                type=metadata.get("graph_type", "MANUAL"),
                created=metadata.get("created_at", datetime.now().isoformat()),
                entity_count=len(entities),
                rel_count=len(relationships),
                avg_conf=metadata.get("avg_confidence", 0.5)
            )
            
            # Create entity nodes
            for entity in entities:
                session.run(
                    """CREATE (e:Entity {
                        id: $id,
                        label: $label,
                        type: $type,
                        confidence: $confidence,
                        graph_id: $graph_id
                    })""",
                    id=entity.id,
                    label=entity.label,
                    type=entity.type,
                    confidence=entity.confidence,
                    graph_id=graph_id
                )
                
                # Add properties
                for key, value in entity.properties.items():
                    session.run(
                        f"""MATCH (e:Entity {{id: $id}}) 
                        SET e.{key} = $value""",
                        id=entity.id,
                        value=str(value)
                    )
            
            # Create relationships
            for rel in relationships:
                session.run(
                    """MATCH (source:Entity {id: $source_id}), (target:Entity {id: $target_id})
                    CREATE (source)-[r:RELATES {
                        id: $id,
                        type: $type,
                        confidence: $confidence,
                        graph_id: $graph_id
                    }]->(target)""",
                    source_id=rel.source_id,
                    target_id=rel.target_id,
                    id=rel.id,
                    type=rel.type,
                    confidence=rel.confidence,
                    graph_id=graph_id
                )
            
            logger.info(f"Stored graph {graph_id} with {len(entities)} entities and {len(relationships)} relationships")
    except Exception as e:
        logger.error(f"Error storing graph in Neo4j: {e}")

# API Endpoints

@app.get("/health")
async def health():
    """Health check endpoint"""
    if driver is None:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "reason": "Neo4j not connected"}
        )
    return {"status": "healthy", "service": "ner-graph-service"}

@app.post("/extract", response_model=ExtractionResponse)
async def extract_graph(request: ExtractionRequest):
    """Extract entities and relationships from markdown document"""
    logger.info(f"Extracting graph from {request.source_document}")
    
    # Generate graph ID
    graph_id = str(uuid.uuid4())
    
    # Extract entities
    entity_data = extract_entities_llm(request.markdown)
    entities = [
        Entity(
            id=e.get("id", str(uuid.uuid4())),
            label=e.get("label", ""),
            type=e.get("type", "CONCEPT"),
            confidence=float(e.get("confidence", 0.5)),
            properties={}
        )
        for e in entity_data if e.get("label")
    ]
    
    # Extract relationships
    rel_data = extract_relationships_llm(entity_data, request.markdown)
    relationships = []
    
    if entities:
        entity_ids = {str(hash(e.label)): e.id for e in entities}
        
        for rel in rel_data:
            # Map entity labels to IDs
            source_label = rel.get("source_entity", "")
            target_label = rel.get("target_entity", "")
            
            # Find matching entities (simplified matching)
            source_id = None
            target_id = None
            
            for entity in entities:
                if source_label.lower() in entity.label.lower():
                    source_id = entity.id
                if target_label.lower() in entity.label.lower():
                    target_id = entity.id
            
            if source_id and target_id:
                relationships.append(
                    Relationship(
                        id=str(uuid.uuid4()),
                        source_id=source_id,
                        target_id=target_id,
                        type=rel.get("relationship_type", "RELATES_TO"),
                        confidence=float(rel.get("confidence", 0.5)),
                        properties={}
                    )
                )
    
    # Calculate average confidence
    all_confidences = [e.confidence for e in entities] + [r.confidence for r in relationships]
    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.5
    
    # Store in Neo4j
    metadata = {
        "source_document": request.source_document,
        "graph_type": request.graph_type,
        "created_at": datetime.now().isoformat(),
        "avg_confidence": avg_confidence
    }
    store_graph_in_neo4j(graph_id, entities, relationships, metadata)
    
    return ExtractionResponse(
        graph_id=graph_id,
        entities=entities,
        relationships=relationships,
        entity_count=len(entities),
        relationship_count=len(relationships),
        confidence_avg=avg_confidence,
        created_at=metadata["created_at"]
    )

@app.get("/graph/{graph_id}")
async def get_graph(graph_id: str):
    """Retrieve stored graph from Neo4j"""
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j not available")
    
    try:
        with driver.session() as session:
            # Get graph metadata
            graph = session.run(
                "MATCH (g:Graph {id: $id}) RETURN g", id=graph_id
            ).single()
            
            if not graph:
                raise HTTPException(status_code=404, detail="Graph not found")
            
            # Get entities
            entities_result = session.run(
                "MATCH (e:Entity {graph_id: $graph_id}) RETURN e", 
                graph_id=graph_id
            )
            entities = [dict(record["e"]) for record in entities_result]
            
            # Get relationships
            rels_result = session.run(
                """MATCH (source:Entity {graph_id: $graph_id})-[r:RELATES {graph_id: $graph_id}]->(target:Entity {graph_id: $graph_id})
                RETURN r""",
                graph_id=graph_id
            )
            relationships = [dict(record["r"]) for record in rels_result]
            
            return {
                "graph_id": graph_id,
                "entities": entities,
                "relationships": relationships,
                "metadata": dict(graph["g"])
            }
    except Exception as e:
        logger.error(f"Error retrieving graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph/{graph_id}/search")
async def search_entities(graph_id: str, query: str, entity_type: Optional[str] = None):
    """Search entities in a graph"""
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j not available")
    
    try:
        with driver.session() as session:
            if entity_type:
                results = session.run(
                    """MATCH (e:Entity {graph_id: $graph_id, type: $type})
                    WHERE toLower(e.label) CONTAINS toLower($query)
                    RETURN e LIMIT 50""",
                    graph_id=graph_id,
                    type=entity_type,
                    query=query
                )
            else:
                results = session.run(
                    """MATCH (e:Entity {graph_id: $graph_id})
                    WHERE toLower(e.label) CONTAINS toLower($query)
                    RETURN e LIMIT 50""",
                    graph_id=graph_id,
                    query=query
                )
            
            entities = [dict(record["e"]) for record in results]
            return {"results": entities, "count": len(entities)}
    except Exception as e:
        logger.error(f"Error searching entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/graph/compare")
async def compare_graphs(graph_ids: List[str]):
    """Compare two or more graphs"""
    if len(graph_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 graphs to compare")
    
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j not available")
    
    try:
        with driver.session() as session:
            # Get entities from each graph
            all_entities = {}
            
            for gid in graph_ids:
                results = session.run(
                    "MATCH (e:Entity {graph_id: $graph_id}) RETURN e",
                    graph_id=gid
                )
                all_entities[gid] = [dict(record["e"]) for record in results]
            
            # Find common entity types
            entity_type_sets = [
                set(e["type"] for e in all_entities[gid])
                for gid in graph_ids
            ]
            common_types = set.intersection(*entity_type_sets) if entity_type_sets else set()
            
            return {
                "graphs": graph_ids,
                "entity_count": {gid: len(all_entities[gid]) for gid in graph_ids},
                "common_entity_types": list(common_types),
                "entities_by_graph": all_entities
            }
    except Exception as e:
        logger.error(f"Error comparing graphs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8108)
