"""
Neo4j client wrapper for graph operations.
Handles entity creation, relationship creation, and graph queries.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid
from neo4j import GraphDatabase, Session, Driver
from neo4j.exceptions import ServiceUnavailable, AuthError

logger = logging.getLogger(__name__)


class Neo4jClient:
    """Neo4j graph database client."""
    
    def __init__(self, uri: str, user: str, password: str):
        """
        Initialize Neo4j client.
        
        Args:
            uri: Neo4j connection URI (e.g., "bolt://localhost:7687")
            user: Authentication username
            password: Authentication password
        """
        self.uri = uri
        self.user = user
        self.password = password
        self._driver: Optional[Driver] = None
        self._session: Optional[Session] = None
    
    def connect(self) -> bool:
        """
        Connect to Neo4j.
        
        Returns:
            True if connection successful
        """
        try:
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                encrypted=False
            )
            
            # Test connection
            self._driver.verify_connectivity()
            logger.info(f"Connected to Neo4j at {self.uri}")
            return True
            
        except (ServiceUnavailable, AuthError) as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            return False
    
    def close(self):
        """Close Neo4j connection."""
        if self._driver:
            self._driver.close()
            logger.info("Neo4j connection closed")
    
    def _get_session(self) -> Session:
        """Get active session, creating if needed."""
        if not self._driver:
            raise RuntimeError("Not connected to Neo4j. Call connect() first.")
        if not self._session or self._session.closed:
            self._session = self._driver.session()
        return self._session
    
    def setup_indices(self) -> bool:
        """
        Create indices for efficient querying.
        
        Returns:
            True if successful
        """
        try:
            session = self._get_session()
            
            # Entity indices
            session.run("""
                CREATE INDEX IF NOT EXISTS entity_type_idx
                FOR (e:Entity) ON (e.type)
            """)
            
            session.run("""
                CREATE INDEX IF NOT EXISTS entity_graph_idx
                FOR (e:Entity) ON (e.graph_label)
            """)
            
            # Relationship indices
            session.run("""
                CREATE INDEX IF NOT EXISTS rel_type_idx
                FOR ()-[r:RELATIONSHIP]-() ON (r.relation_type)
            """)
            
            # Extraction run indices
            session.run("""
                CREATE INDEX IF NOT EXISTS extraction_doc_idx
                FOR (e:ExtractionRun) ON (e.document_id)
            """)
            
            logger.info("Database indices created")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create indices: {e}")
            return False
    
    def create_extraction_run(self,
                            extraction_id: str,
                            document_id: str,
                            entity_count: int,
                            relationship_count: int,
                            avg_confidence: float,
                            graph_type: str = "MANUAL") -> str:
        """
        Create extraction run metadata node.
        
        Args:
            extraction_id: Unique extraction ID
            document_id: Source document ID
            entity_count: Number of entities extracted
            relationship_count: Number of relationships extracted
            avg_confidence: Average confidence score
            graph_type: "MANUAL" or "CLIENT"
            
        Returns:
            Graph ID for this extraction
        """
        try:
            session = self._get_session()
            
            query = """
            CREATE (e:ExtractionRun {
                id: $extraction_id,
                document_id: $document_id,
                extraction_date: datetime(),
                entity_count: $entity_count,
                relationship_count: $relationship_count,
                avg_confidence: $avg_confidence,
                method: 'vLLM+NER',
                graph_type: $graph_type
            })
            RETURN e.id as extraction_id
            """
            
            result = session.run(query, {
                "extraction_id": extraction_id,
                "document_id": document_id,
                "entity_count": entity_count,
                "relationship_count": relationship_count,
                "avg_confidence": avg_confidence,
                "graph_type": graph_type
            })
            
            record = result.single()
            if record:
                logger.info(f"Created extraction run: {extraction_id}")
                return record["extraction_id"]
            else:
                raise RuntimeError("Failed to create extraction run")
                
        except Exception as e:
            logger.error(f"Failed to create extraction run: {e}")
            raise
    
    def create_entity_node(self,
                          entity_id: str,
                          text: str,
                          entity_type: str,
                          confidence: float,
                          source_document: str,
                          graph_label: str = "MANUAL",
                          extraction_run_id: Optional[str] = None) -> str:
        """
        Create entity node in Neo4j.
        
        Args:
            entity_id: Unique entity ID
            text: Entity text
            entity_type: Type of entity
            confidence: Confidence score (0.0-1.0)
            source_document: Source document ID
            graph_label: "MANUAL" or "CLIENT"
            extraction_run_id: Associated extraction run
            
        Returns:
            Node ID
        """
        try:
            session = self._get_session()
            
            query = """
            CREATE (e:Entity {
                id: $entity_id,
                text: $text,
                type: $entity_type,
                confidence: $confidence,
                source_document: $source_document,
                graph_label: $graph_label,
                extraction_run_id: $extraction_run_id,
                created_at: datetime()
            })
            RETURN e.id as entity_id
            """
            
            result = session.run(query, {
                "entity_id": entity_id,
                "text": text,
                "entity_type": entity_type,
                "confidence": confidence,
                "source_document": source_document,
                "graph_label": graph_label,
                "extraction_run_id": extraction_run_id
            })
            
            record = result.single()
            if record:
                return record["entity_id"]
            else:
                raise RuntimeError(f"Failed to create entity: {entity_id}")
                
        except Exception as e:
            logger.error(f"Failed to create entity node: {e}")
            raise
    
    def create_relationship(self,
                          from_entity_id: str,
                          to_entity_id: str,
                          relation_type: str,
                          confidence: float,
                          condition: Optional[str] = None,
                          effective_date: Optional[str] = None,
                          expiry_date: Optional[str] = None,
                          logic_gate: Optional[str] = None,
                          source_sentences: Optional[List[str]] = None) -> str:
        """
        Create relationship between entities.
        
        Args:
            from_entity_id: Source entity ID
            to_entity_id: Target entity ID
            relation_type: Type of relationship
            confidence: Confidence score
            condition: Conditional logic
            effective_date: When relationship becomes valid
            expiry_date: When relationship expires
            logic_gate: Gate condition
            source_sentences: Supporting sentences
            
        Returns:
            Relationship ID
        """
        try:
            session = self._get_session()
            
            rel_id = f"rel_{uuid.uuid4().hex[:8]}"
            
            # First, ensure both entities exist
            session.run("""
            MATCH (e1:Entity {id: $from_id})
            MATCH (e2:Entity {id: $to_id})
            RETURN e1.id, e2.id
            """, {
                "from_id": from_entity_id,
                "to_id": to_entity_id
            })
            
            # Create relationship using dynamic label
            query = f"""
            MATCH (e1:Entity {{id: $from_id}})
            MATCH (e2:Entity {{id: $to_id}})
            CREATE (e1)-[r:{relation_type} {{
                id: $rel_id,
                relation_type: $relation_type,
                confidence: $confidence,
                condition: $condition,
                effective_date: $effective_date,
                expiry_date: $expiry_date,
                logic_gate: $logic_gate,
                source_sentences: $source_sentences,
                created_at: datetime()
            }}]->(e2)
            RETURN r.id as rel_id
            """
            
            result = session.run(query, {
                "rel_id": rel_id,
                "from_id": from_entity_id,
                "to_id": to_entity_id,
                "relation_type": relation_type,
                "confidence": confidence,
                "condition": condition,
                "effective_date": effective_date,
                "expiry_date": expiry_date,
                "logic_gate": logic_gate,
                "source_sentences": source_sentences or []
            })
            
            record = result.single()
            if record:
                return record["rel_id"]
            else:
                raise RuntimeError(f"Failed to create relationship between {from_entity_id} and {to_entity_id}")
                
        except Exception as e:
            logger.error(f"Failed to create relationship: {e}")
            raise
    
    def get_graph(self, graph_id: str) -> Dict:
        """
        Retrieve graph structure and nodes.
        
        Args:
            graph_id: Graph ID (extraction ID)
            
        Returns:
            Dictionary with nodes and edges
        """
        try:
            session = self._get_session()
            
            # Get entities
            entities_result = session.run("""
            MATCH (e:Entity {extraction_run_id: $graph_id})
            RETURN {
                id: e.id,
                text: e.text,
                type: e.type,
                confidence: e.confidence,
                graph_label: e.graph_label
            } as entity
            """, {"graph_id": graph_id})
            
            nodes = [record["entity"] for record in entities_result]
            
            # Get relationships
            edges_result = session.run("""
            MATCH (e1:Entity {extraction_run_id: $graph_id})
            -[r]->(e2:Entity {extraction_run_id: $graph_id})
            RETURN {
                from: e1.id,
                to: e2.id,
                type: e1.id,
                confidence: r.confidence,
                condition: r.condition,
                effective_date: r.effective_date
            } as edge
            """, {"graph_id": graph_id})
            
            edges = [record["edge"] for record in edges_result]
            
            return {
                "graph_id": graph_id,
                "nodes": nodes,
                "edges": edges,
                "node_count": len(nodes),
                "edge_count": len(edges)
            }
            
        except Exception as e:
            logger.error(f"Failed to get graph: {e}")
            return {"error": str(e)}
    
    def find_applicable_rules(self,
                            client_graph_id: str,
                            manual_graph_id: str,
                            question_entities: List[str]) -> Dict:
        """
        Find manual rules applicable to client situation.
        
        Args:
            client_graph_id: Client situation graph ID
            manual_graph_id: Manual rules graph ID
            question_entities: Entities extracted from question
            
        Returns:
            Dict with applicable rules and reasoning paths
        """
        try:
            session = self._get_session()
            
            # Find matching entities across graphs
            query = """
            MATCH (manual:Entity {
                extraction_run_id: $manual_graph_id,
                type: 'RULE'
            })
            MATCH (client:Entity {
                extraction_run_id: $client_graph_id
            })
            WHERE manual.text CONTAINS client.text
               OR client.text CONTAINS manual.text
            RETURN {
                manual_entity: manual.text,
                client_entity: client.text,
                match_type: 'direct_text_match'
            } as match
            LIMIT 20
            """
            
            matches_result = session.run(query, {
                "client_graph_id": client_graph_id,
                "manual_graph_id": manual_graph_id
            })
            
            matches = [record["match"] for record in matches_result]
            
            return {
                "applicable_rules": matches,
                "match_count": len(matches),
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"Failed to find applicable rules: {e}")
            return {"error": str(e)}
    
    def search_entities(self,
                       search_text: str,
                       graph_label: Optional[str] = None,
                       entity_type: Optional[str] = None) -> List[Dict]:
        """
        Search for entities by text.
        
        Args:
            search_text: Text to search for
            graph_label: Filter by "MANUAL" or "CLIENT"
            entity_type: Filter by entity type
            
        Returns:
            List of matching entities
        """
        try:
            session = self._get_session()
            
            query = """
            MATCH (e:Entity)
            WHERE e.text CONTAINS $search_text
            """
            
            params = {"search_text": search_text}
            
            if graph_label:
                query += " AND e.graph_label = $graph_label"
                params["graph_label"] = graph_label
            
            if entity_type:
                query += " AND e.type = $entity_type"
                params["entity_type"] = entity_type
            
            query += """
            RETURN {
                id: e.id,
                text: e.text,
                type: e.type,
                confidence: e.confidence,
                graph_label: e.graph_label
            } as entity
            LIMIT 50
            """
            
            result = session.run(query, params)
            return [record["entity"] for record in result]
            
        except Exception as e:
            logger.error(f"Failed to search entities: {e}")
            return []
    
    def get_relationship_paths(self,
                              from_entity_id: str,
                              to_entity_id: str,
                              max_depth: int = 5) -> List[List[str]]:
        """
        Find all paths between two entities.
        
        Args:
            from_entity_id: Start entity ID
            to_entity_id: End entity ID
            max_depth: Maximum path depth
            
        Returns:
            List of paths (each path is a list of entity IDs)
        """
        try:
            session = self._get_session()
            
            query = f"""
            MATCH path = shortestPath(
                (from:Entity {{id: $from_id}})
                -[*1..{max_depth}]->
                (to:Entity {{id: $to_id}})
            )
            RETURN [node.id IN nodes(path) | node.id] as path
            """
            
            result = session.run(query, {
                "from_id": from_entity_id,
                "to_id": to_entity_id
            })
            
            paths = [record["path"] for record in result]
            return paths
            
        except Exception as e:
            logger.error(f"Failed to find relationship paths: {e}")
            return []
