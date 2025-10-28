#!/usr/bin/env python3
"""
Client Document RAG Service
Provides client-specific vector stores for querying uploaded documents
Each client gets their own collection for document search
Enhanced with agentic capabilities for intelligent document analysis
"""

import os
import logging
import requests
from typing import List, Dict, Optional, Tuple, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from pathlib import Path
import chromadb
import json
import re
from numerical_tools import NumericalTools
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Client Document RAG Service",
    description="Query client-specific documents using RAG",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    """Request model for queries."""
    client_id: str
    question: str
    model: str = "llama3.2"
    top_k: int = 4


class AgenticQueryRequest(BaseModel):
    """Request model for agentic queries."""
    client_id: str
    question: str
    model: str = "llama3.2"
    max_iterations: int = 2
    top_k: int = 4
    show_reasoning: bool = True


class DocumentWorryRequest(BaseModel):
    """Request for 'Should I worry?' analysis."""
    client_id: str
    filename: str
    document_summary: Optional[str] = None


class QueryResponse(BaseModel):
    """Response model for queries."""
    answer: str
    sources: List[Dict[str, str]]  # filename, chunk info


class AgenticQueryResponse(BaseModel):
    """Response model for agentic queries."""
    answer: str
    sources: List[Dict[str, str]]
    reasoning_steps: Optional[List[Dict]] = None
    iterations_used: int
    confidence: str


class DocumentWorryResponse(BaseModel):
    """Response for 'Should I worry?' analysis."""
    worry_level: str  # "low" | "medium" | "high"
    reassurance: str  # Main reassuring message
    context: str  # Where this fits in their debt journey
    next_steps: Optional[List[str]] = None
    related_docs: Optional[List[str]] = None
    confidence: str


class IngestRequest(BaseModel):
    """Request model for document ingestion."""
    client_id: str
    document_text: str
    filename: str
    metadata: Optional[Dict] = None


class ClientRAGService:
    """RAG system for client-specific documents."""

    def __init__(self):
        self.persist_directory = os.getenv('VECTORSTORE_PATH', '/data/vectorstore')
        self.ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        self.chromadb_host = os.getenv('CHROMADB_HOST', 'chromadb')
        self.chromadb_port = int(os.getenv('CHROMADB_PORT', '8000'))

        # Create base directory
        Path(self.persist_directory).mkdir(parents=True, exist_ok=True)

        self.embeddings = None
        self.vectorstores = {}  # Cache of client vectorstores
        self.threshold_cache = {}  # Cache for extracted thresholds from general manuals

        # LangGraph agent
        self.agent_app = None
        self.use_langgraph = os.getenv("USE_LANGGRAPH", "true").lower() == "true"

        self.initialize()

    def initialize(self):
        """Initialize embeddings and ChromaDB client."""
        logger.info("Initializing Client RAG system...")

        try:
            # Initialize embeddings
            self.embeddings = OllamaEmbeddings(
                model="nomic-embed-text",
                base_url=self.ollama_url
            )

            # Initialize ChromaDB client (shared instance, without tenant/database for compatibility)
            self.chroma_client = chromadb.HttpClient(
                host=self.chromadb_host,
                port=self.chromadb_port,
                settings=chromadb.Settings(anonymized_telemetry=False)
            )
            logger.info(f"Connected to shared ChromaDB at {self.chromadb_host}:{self.chromadb_port}")

            logger.info("Client RAG system initialized")

            # Load thresholds from main RAG service
            self.load_thresholds_from_rag_service()

            # Initialize LangGraph agent if enabled
            if self.use_langgraph:
                self.initialize_agent()

        except Exception as e:
            logger.error(f"Error initializing Client RAG system: {e}")
            raise

    def initialize_agent(self):
        """Initialize LangGraph agent for client document queries."""
        try:
            from client_agent_graph import create_client_agent_graph

            logger.info("Initializing Client LangGraph agent...")

            self.agent_app = create_client_agent_graph(
                vectorstore_getter=self.get_client_vectorstore,
                threshold_cache=self.threshold_cache,
                rag_service_url=os.getenv('RAG_SERVICE_URL', 'http://rag-service:8102')
            )

            logger.info("✅ Client LangGraph agent initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize client agent: {e}")
            logger.warning("Falling back to legacy implementation")
            self.use_langgraph = False
            self.agent_app = None

    def load_thresholds_from_rag_service(self):
        """Load threshold cache from main RAG service."""
        try:
            # RAG service URL from environment or default
            rag_service_url = os.getenv('RAG_SERVICE_URL', 'http://rag-service:8102')
            
            logger.info(f"Loading thresholds from {rag_service_url}/thresholds...")
            
            response = requests.get(f"{rag_service_url}/thresholds", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.threshold_cache = data.get('thresholds', {})
                count = data.get('count', 0)
                
                if count > 0:
                    logger.info(f"✅ Loaded {count} thresholds from RAG service")
                    logger.debug(f"Threshold keys: {list(self.threshold_cache.keys())}")
                else:
                    logger.warning("RAG service returned empty threshold cache")
            else:
                logger.warning(f"Failed to load thresholds from RAG service: HTTP {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"Could not connect to RAG service to load thresholds: {e}")
            logger.info("Client RAG service will operate without threshold cache")
        except Exception as e:
            logger.error(f"Error loading thresholds from RAG service: {e}")

    def get_client_vectorstore(self, client_id: str) -> Chroma:
        """Get or create vector store for a specific client using shared ChromaDB."""
        # Check cache
        if client_id in self.vectorstores:
            return self.vectorstores[client_id]

        collection_name = f"client_{client_id}"

        try:
            # Try to get existing collection from shared ChromaDB
            logger.info(f"Checking for existing collection {collection_name} in shared ChromaDB")
            vectorstore = Chroma(
                client=self.chroma_client,
                collection_name=collection_name,
                embedding_function=self.embeddings
            )
            # Test if collection has data
            if vectorstore._collection.count() > 0:
                logger.info(f"Loaded existing collection {collection_name} with {vectorstore._collection.count()} items")
            else:
                logger.info(f"Collection {collection_name} exists but is empty")
        except Exception as e:
            logger.info(f"Collection {collection_name} not found or error: {e}. Will create on first ingestion.")
            vectorstore = None

        self.vectorstores[client_id] = vectorstore
        return vectorstore

    def get_threshold_from_cache(self, threshold_name: str) -> Optional[float]:
        """
        Retrieve a threshold value from cache.
        
        Args:
            threshold_name: Name like "DRO maximum debt", "bankruptcy fee", etc.
        
        Returns:
            The threshold amount as float, or None if not found
        """
        try:
            # Normalize the threshold name
            normalized = threshold_name.lower().strip()
            
            # Try direct match first
            if normalized in self.threshold_cache:
                return self.threshold_cache[normalized]['amount']
            
            # Try to construct cache key from parts
            cache_key = normalized.replace(' ', '_')
            if cache_key in self.threshold_cache:
                return self.threshold_cache[cache_key]['amount']
            
            # Try partial matches
            for key, value in self.threshold_cache.items():
                if threshold_name.lower() in key or key in threshold_name.lower():
                    logger.debug(f"Found threshold via partial match: {key}")
                    return value['amount']
            
            logger.debug(f"Threshold not found in cache: {threshold_name}")
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving threshold from cache: {e}")
            return None

    def ingest_document(
        self,
        client_id: str,
        document_text: str,
        filename: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Ingest a single document into client's vector store."""
        try:
            logger.info(f"=" * 70)
            logger.info(f"📥 [INGEST] Starting document ingestion")
            logger.info(f"   ├─ Client ID: {client_id}")
            logger.info(f"   ├─ Filename: {filename}")
            logger.info(f"   ├─ Text length: {len(document_text)} chars")
            logger.info(f"   ├─ Text preview: {document_text[:200]}...")
            logger.info(f"   └─ Metadata: {metadata}")
            
            # Split document into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len
            )

            logger.info(f"   → Splitting text into chunks...")
            chunks = text_splitter.split_text(document_text)
            logger.info(f"   ✓ Created {len(chunks)} chunks")

            # Create Document objects for each chunk
            docs = []
            for i, chunk in enumerate(chunks):
                doc_metadata = {
                    "source": filename,
                    "chunk": i,
                    "client_id": client_id
                }
                if metadata:
                    doc_metadata.update(metadata)

                docs.append(Document(
                    page_content=chunk,
                    metadata=doc_metadata
                ))
                
                if i == 0:  # Log first chunk as sample
                    logger.info(f"   → Sample chunk 0: {chunk[:150]}...")

            logger.info(f"   ✓ Created {len(docs)} Document objects")

            # Get or create vector store in shared ChromaDB
            collection_name = f"client_{client_id}"
            logger.info(f"   → Collection name: {collection_name}")
            
            vectorstore = self.get_client_vectorstore(client_id)

            if vectorstore is None:
                logger.info(f"   → Creating NEW collection in shared ChromaDB...")
                logger.info(f"      ├─ ChromaDB host: {self.chromadb_host}:{self.chromadb_port}")
                logger.info(f"      └─ Embedding model: nomic-embed-text")
                
                vectorstore = Chroma.from_documents(
                    documents=docs,
                    embedding=self.embeddings,
                    client=self.chroma_client,
                    collection_name=collection_name
                )
                self.vectorstores[client_id] = vectorstore
                logger.info(f"   ✓ Collection created successfully")
            else:
                current_count = vectorstore._collection.count()
                logger.info(f"   → Adding to EXISTING collection (current: {current_count} items)...")
                vectorstore.add_documents(docs)
                new_count = vectorstore._collection.count()
                logger.info(f"   ✓ Added documents (new total: {new_count} items)")
                
            # Verify ingestion
            final_count = vectorstore._collection.count()
            logger.info(f"   ✓ Verification: Collection now has {final_count} total items")
            
            # Try a test query to verify
            try:
                test_results = vectorstore._collection.get(limit=1, include=["metadatas"])
                logger.info(f"   ✓ Sample from collection: {test_results['metadatas'][0] if test_results['metadatas'] else 'No metadata'}")
            except Exception as e:
                logger.warning(f"   ! Could not verify collection contents: {e}")

            result = {
                "success": True,
                "client_id": client_id,
                "filename": filename,
                "chunks_created": len(docs),
                "collection_name": collection_name,
                "total_in_collection": final_count,
                "message": f"Successfully indexed {len(docs)} chunks"
            }
            
            logger.info(f"✅ [INGEST] SUCCESS - Ingestion complete!")
            logger.info(f"   └─ Result: {result}")
            logger.info(f"=" * 70)
            
            return result

        except Exception as e:
            logger.error(f"=" * 70)
            logger.error(f"❌ [INGEST] FAILED - Error ingesting document")
            logger.error(f"   ├─ Client: {client_id}")
            logger.error(f"   ├─ Filename: {filename}")
            logger.error(f"   ├─ Error type: {type(e).__name__}")
            logger.error(f"   └─ Error message: {str(e)}")
            import traceback
            logger.error(f"   Traceback:\n{traceback.format_exc()}")
            logger.error(f"=" * 70)
            raise

    def query_client_documents(
        self,
        client_id: str,
        question: str,
        model_name: str = "llama3.2",
        top_k: int = 4
    ) -> Dict:
        """Query a client's documents."""
        vectorstore = self.get_client_vectorstore(client_id)

        if vectorstore is None:
            raise ValueError(f"No documents found for client {client_id}")

        # Initialize LLM
        llm = Ollama(
            model=model_name,
            base_url=self.ollama_url,
            temperature=0.7
        )

        # Create custom prompt template for client documents
        prompt_template = """You are a helpful assistant helping an advisor review documents for client {client_id}.
Use the following pieces of context from the client's uploaded documents to answer the question.
If you don't know the answer based on the documents provided, just say that you don't know,
don't try to make up an answer.

Context from client documents:
{context}

Question: {question}

Answer (be specific and cite which document the information came from):"""

        PROMPT = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"],
            partial_variables={"client_id": client_id}
        )

        # Create retrieval QA chain
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=vectorstore.as_retriever(search_kwargs={"k": top_k}),
            return_source_documents=True,
            chain_type_kwargs={"prompt": PROMPT}
        )

        # Get answer
        result = qa_chain({"query": question})

        # Extract sources with details
        sources = []
        for doc in result["source_documents"]:
            sources.append({
                "filename": doc.metadata.get("source", "Unknown"),
                "chunk": str(doc.metadata.get("chunk", 0)),
                "text_preview": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content
            })

        return {
            "answer": result["result"],
            "sources": sources,
            "client_id": client_id
        }

    def get_client_stats(self, client_id: str) -> Dict:
        """Get statistics for a client's vector store."""
        vectorstore = self.get_client_vectorstore(client_id)

        if vectorstore is None:
            return {
                "client_id": client_id,
                "total_chunks": 0,
                "status": "not_initialized"
            }

        try:
            collection = vectorstore._collection
            count = collection.count()

            # Get unique sources
            results = collection.get(include=["metadatas"])
            sources = set()
            if results and results.get("metadatas"):
                for metadata in results["metadatas"]:
                    if "source" in metadata:
                        sources.add(metadata["source"])

            return {
                "client_id": client_id,
                "total_chunks": count,
                "total_documents": len(sources),
                "documents": list(sources),
                "status": "ready"
            }
        except Exception as e:
            logger.error(f"Error getting stats for client {client_id}: {e}")
            return {"error": str(e)}

    def list_all_clients(self) -> List[str]:
        """List all clients with vector stores in shared ChromaDB."""
        try:
            # Get all collections from shared ChromaDB
            collections = self.chroma_client.list_collections()

            # Filter for client collections (those starting with "client_")
            client_ids = []
            for collection in collections:
                if collection.name.startswith("client_"):
                    # Extract client_id from collection name
                    client_id = collection.name[7:]  # Remove "client_" prefix
                    client_ids.append(client_id)

            return client_ids
        except Exception as e:
            logger.error(f"Error listing clients: {e}")
            return []

    def analyze_client_question(self, client_id: str, question: str, model_name: str = "llama3.2") -> Dict:
        """Analyze question complexity for client documents."""
        llm = Ollama(model=model_name, base_url=self.ollama_url, temperature=0.3)
        
        analysis_prompt = f"""Analyze this question about client {client_id}'s documents:

Question: "{question}"

Provide a JSON response with:
1. complexity: "simple" | "moderate" | "complex"
2. reasoning: Why you classified it this way
3. suggested_searches: List of 1-3 search queries
4. requires_synthesis: true/false

Example:
{{
  "complexity": "simple",
  "reasoning": "Single document lookup needed",
  "suggested_searches": ["client documents about X"],
  "requires_synthesis": false
}}

Respond only with valid JSON:"""

        try:
            response = llm.invoke(analysis_prompt)
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                analysis = json.loads(json_match.group(1))
            else:
                analysis = json.loads(response)
            
            logger.info(f"Client question complexity: {analysis.get('complexity', 'unknown')}")
            return analysis
        except Exception as e:
            logger.warning(f"Error analyzing question: {e}")
            return {
                "complexity": "moderate",
                "reasoning": "Could not analyze",
                "suggested_searches": [question],
                "requires_synthesis": False
            }

    def iterative_client_search(self, client_id: str, search_queries: List[str], top_k: int = 4) -> List[Dict]:
        """Perform multiple searches on client documents."""
        vectorstore = self.get_client_vectorstore(client_id)
        if vectorstore is None:
            return []
        
        all_results = []
        seen_chunks = set()
        
        for query in search_queries:
            try:
                logger.info(f"Searching client {client_id} docs for: {query}")
                docs = vectorstore.similarity_search(query, k=top_k)
                
                for doc in docs:
                    chunk_id = f"{doc.metadata.get('source', 'unknown')}_{doc.metadata.get('chunk', 0)}"
                    
                    if chunk_id not in seen_chunks:
                        seen_chunks.add(chunk_id)
                        all_results.append({
                            "text": doc.page_content,
                            "source": doc.metadata.get("source", "Unknown"),
                            "chunk_id": doc.metadata.get("chunk", 0),
                            "query": query
                        })
            except Exception as e:
                logger.error(f"Error searching client {client_id} docs for '{query}': {str(e)}")
                logger.exception(e)
                continue
        
        logger.info(f"Collected {len(all_results)} unique chunks from {len(search_queries)} searches")
        return all_results

    def synthesize_client_answer(self, client_id: str, question: str, context_chunks: List[Dict], 
                                 analysis: Dict, model_name: str = "llama3.2",
                                 use_tools: bool = True, max_tool_iterations: int = 3) -> Tuple[str, str, List[Dict]]:
        """Synthesize answer from client documents with confidence and tool support."""
        llm = Ollama(model=model_name, base_url=self.ollama_url, temperature=0.7)
        tools = NumericalTools()
        tool_calls_made = []
        
        # Build context WITH AUTOMATIC NUMERIC ENRICHMENT
        context_text = ""
        for i, chunk in enumerate(context_chunks, 1):
            chunk_text = chunk['text']
            
            # Automatically enrich any text containing numbers/thresholds
            enrichment_result = tools.extract_and_enrich_numbers(chunk_text, include_comparisons=True)
            
            if enrichment_result.get('has_thresholds'):
                chunk_text = enrichment_result['enriched_text']
                logger.info(f"📊 Client {client_id} - Enriched chunk {i} with threshold hints")
            
            context_text += f"\n[Document {i}: {chunk['source']}]\n{chunk_text}\n"
        
        # Build tool descriptions for prompt
        tool_descriptions = ""
        if use_tools:
            tool_descriptions = "\n\nAVAILABLE TOOLS - Use these for numerical operations on client financial data:\n"
            for tool in tools.get_tool_definitions():
                tool_descriptions += f"\n{tool['name']}: {tool['description']}\n"
            tool_descriptions += "\nTo use a tool, include in your response:\nTOOL_CALL: {\"tool\": \"tool_name\", \"arguments\": {\"arg1\": \"value1\"}}\n"
            tool_descriptions += "\nIMPORTANT: Use find_convenient_sums and detect_patterns when you see multiple numbers - this can reveal suspicious patterns!\n"
        
        synthesis_prompt = f"""You are an advisor helping review documents for client {client_id}.

Original Question: {question}

Analysis: {analysis.get('reasoning', 'N/A')}

Context from Client's Documents:
{context_text}
{tool_descriptions}

Instructions:
1. Provide a clear, specific answer using the context
2. Cite which documents you're referencing
3. If information is missing, state what's needed
4. Be reassuring but accurate
5. For ANY calculations or number comparisons, USE THE TOOLS - they're more accurate!
6. When analyzing debts or payments, use find_convenient_sums and detect_patterns to spot interesting relationships
7. When you see debt amounts, use check_threshold to automatically check against common limits (DRO, bankruptcy, etc.)
8. Pay attention to "📊 NUMERIC RULE" annotations in the context - these are important threshold comparisons

IMPORTANT: You MUST end your response with a confidence rating on a new line in this EXACT format:
CONFIDENCE_LEVEL: HIGH|MEDIUM|LOW
CONFIDENCE_REASON: [One sentence explaining why]

Answer:"""

        try:
            # Initial synthesis
            response = llm.invoke(synthesis_prompt)
            
            # Check for tool calls
            iteration = 0
            while use_tools and iteration < max_tool_iterations:
                tool_call_pattern = r'TOOL_CALL:\s*(\{[^}]+\})'
                tool_matches = re.findall(tool_call_pattern, response)
                
                if not tool_matches:
                    break
                
                # Execute tools
                tool_results = []
                for tool_json_str in tool_matches:
                    try:
                        tool_call = json.loads(tool_json_str)
                        tool_name = tool_call.get('tool')
                        arguments = tool_call.get('arguments', {})
                        
                        # Special handling for check_threshold: inject cached threshold if available
                        if tool_name == 'check_threshold' and 'threshold_value' not in arguments:
                            threshold_name = arguments.get('threshold_name', '')
                            cached_value = self.get_threshold_from_cache(threshold_name)
                            if cached_value is not None:
                                arguments['threshold_value'] = str(cached_value)
                                logger.info(f"💡 Client {client_id} - Injected cached threshold for '{threshold_name}': {cached_value}")
                        
                        logger.info(f"🔧 Client {client_id} - Executing tool: {tool_name}")
                        result = tools.execute_tool(tool_name, arguments)
                        
                        tool_calls_made.append({
                            "tool": tool_name,
                            "arguments": arguments,
                            "result": result
                        })
                        
                        tool_results.append(f"\nTool Result ({tool_name}): {json.dumps(result, indent=2)}\n")
                        
                    except json.JSONDecodeError:
                        continue
                
                if not tool_results:
                    break
                
                # Continue with tool results
                continuation_prompt = f"""{response}

The tools have provided these accurate calculations:
{''.join(tool_results)}

Now continue your answer using these results. Remember to end with:
CONFIDENCE_LEVEL: HIGH|MEDIUM|LOW
CONFIDENCE_REASON: [One sentence explaining why]

Continued Answer:"""
                
                response = llm.invoke(continuation_prompt)
                iteration += 1
            
            # Extract confidence with robust patterns
            patterns = [
                r'CONFIDENCE_LEVEL:\s*(HIGH|MEDIUM|LOW)\s*\n\s*CONFIDENCE_REASON:\s*(.+?)(?:\n|$)',
                r'CONFIDENCE:\s*\[?(HIGH|MEDIUM|LOW)\]?\s*-\s*(.+?)(?:\n|$)',
                r'Confidence[:\s]+\[?(HIGH|MEDIUM|LOW)\]?\s*[-:]\s*(.+?)(?:\n|$)',
            ]
            
            confidence_level = None
            confidence_reason = None
            answer = response.strip()
            
            for pattern in patterns:
                confidence_match = re.search(pattern, response, re.IGNORECASE)
                if confidence_match:
                    confidence_level = confidence_match.group(1).strip().upper()
                    confidence_reason = confidence_match.group(2).strip()
                    answer = response[:confidence_match.start()].strip()
                    break
            
            # If no match found, infer from context
            if confidence_level is None:
                lower_response = response.lower()
                if any(word in lower_response for word in ['insufficient', 'unclear', 'not sure', 'cannot determine', 'missing']):
                    confidence_level = "LOW"
                    confidence_reason = "Response indicates insufficient or unclear information"
                elif any(word in lower_response for word in ['may', 'possibly', 'might', 'could be', 'seems']):
                    confidence_level = "MEDIUM"
                    confidence_reason = "Response contains hedging language indicating uncertainty"
                else:
                    confidence_level = "MEDIUM"
                    confidence_reason = "Confidence level not explicitly stated by model"
            
            # Clean up TOOL_CALL markers
            answer = re.sub(r'TOOL_CALL:\s*\{[^}]+\}', '', answer).strip()
            
            confidence = f"{confidence_level} - {confidence_reason}"
            return answer, confidence, tool_calls_made
            
        except Exception as e:
            logger.error(f"Error synthesizing answer: {e}")
            logger.exception(e)
            return f"Error generating answer: {str(e)}", "LOW - Error occurred", []

    def agentic_client_query(self, client_id: str, question: str, model_name: str = "llama3.2",
                            max_iterations: int = 2, top_k: int = 4, show_reasoning: bool = True) -> Dict:
        """Perform agentic query on client documents."""
        reasoning_steps = []
        
        # Check if client has documents
        vectorstore = self.get_client_vectorstore(client_id)
        if vectorstore is None:
            return {
                "answer": f"No documents found for client {client_id}",
                "sources": [],
                "iterations_used": 0,
                "confidence": "N/A - No documents",
                "reasoning_steps": []
            }
        
        # Step 1: Analyze
        logger.info(f"🤔 Analyzing client question for {client_id}: {question}")
        analysis = self.analyze_client_question(client_id, question, model_name)
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "analysis",
                "description": "Question complexity analysis",
                "result": analysis
            })
        
        # Step 2: Plan
        search_queries = analysis.get("suggested_searches", [question])
        complexity = analysis.get("complexity", "moderate")
        
        if complexity == "simple":
            iterations = 1
        else:
            iterations = min(max_iterations, len(search_queries))
        
        logger.info(f"📋 Plan: {iterations} iteration(s)")
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "planning",
                "description": "Search strategy",
                "result": {
                    "complexity": complexity,
                    "iterations": iterations,
                    "searches": search_queries[:iterations]
                }
            })
        
        # Step 3: Search
        logger.info(f"🔍 Searching client documents...")
        context_chunks = self.iterative_client_search(client_id, search_queries[:iterations], top_k)
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "retrieval",
                "description": "Context gathering",
                "result": {
                    "chunks_found": len(context_chunks),
                    "sources": list(set(chunk["source"] for chunk in context_chunks))
                }
            })
        
        # Step 4: Synthesize (with tool support)
        logger.info(f"💡 Synthesizing answer...")
        answer, confidence, tool_calls = self.synthesize_client_answer(
            client_id, question, context_chunks, analysis, model_name,
            use_tools=True, max_tool_iterations=3
        )
        
        # Format sources
        sources = []
        seen_sources = set()
        for chunk in context_chunks:
            source_name = chunk["source"]
            if source_name not in seen_sources:
                seen_sources.add(source_name)
                sources.append({"filename": source_name, "chunk": str(chunk["chunk_id"])})
        
        result = {
            "answer": answer,
            "sources": sources,
            "iterations_used": iterations,
            "confidence": confidence
        }
        
        # Add tool calls if any
        if tool_calls:
            result["tool_calls"] = tool_calls
            logger.info(f"🔧 Client {client_id} - Made {len(tool_calls)} tool calls")
        
        if show_reasoning:
            result["reasoning_steps"] = reasoning_steps
        
        logger.info(f"✅ Agentic query complete")
        return result

    async def analyze_document_worry(self, client_id: str, filename: str, 
                                     document_summary: Optional[str] = None,
                                     model_name: str = "llama3.2") -> Dict:
        """Analyze if client should worry about a specific document."""
        logger.info(f"🔍 Analyzing worry level for {filename} (client {client_id})")
        
        # Get all client documents for context
        vectorstore = self.get_client_vectorstore(client_id)
        if vectorstore is None:
            client_docs = []
        else:
            try:
                results = vectorstore._collection.get(include=["metadatas"])
                client_docs = list(set(m.get("source", "") for m in results.get("metadatas", [])))
            except:
                client_docs = []
        
        # Get content from this specific document
        doc_content = ""
        if vectorstore:
            try:
                specific_docs = vectorstore.similarity_search(filename, k=3)
                doc_content = "\n".join([doc.page_content[:500] for doc in specific_docs])
            except:
                pass
        
        # Query training manuals for context (if RAG service available)
        training_context = ""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                rag_url = os.getenv('RAG_SERVICE_URL', 'http://rag-service:8102')
                response = await client.post(
                    f"{rag_url}/query",
                    json={
                        "question": f"What does a {filename} document typically mean for someone in debt? Should they worry?",
                        "top_k": 2
                    }
                )
                if response.status_code == 200:
                    training_context = response.json().get("answer", "")
        except Exception as e:
            logger.warning(f"Could not query training manuals: {e}")
        
        # Analyze with LLM
        llm = Ollama(model=model_name, base_url=self.ollama_url, temperature=0.5)
        
        analysis_prompt = f"""You are a reassuring debt advisor helping a client understand a document they received.

CLIENT ID: {client_id}
DOCUMENT: {filename}
DOCUMENT SUMMARY: {document_summary or "Not provided"}

DOCUMENT CONTENT PREVIEW:
{doc_content[:1000] if doc_content else "Content not available"}

CLIENT'S OTHER DOCUMENTS:
{", ".join(client_docs) if client_docs else "This is their first document"}

GENERAL GUIDANCE:
{training_context[:500] if training_context else "Not available"}

Your task: Provide a reassuring, clear analysis with:

1. WORRY_LEVEL: "low" | "medium" | "high"
2. REASSURANCE: A warm, reassuring message (don't scare them!)
3. CONTEXT: Where this fits in their debt journey
4. NEXT_STEPS: 2-3 concrete next steps (be specific)
5. RELATED_DOCS: Which of their other documents are related
6. CONFIDENCE: How confident you are in this analysis

FORMAT YOUR RESPONSE AS JSON:
{{
  "worry_level": "low",
  "reassurance": "This is a normal part of the process...",
  "context": "This document shows that...",
  "next_steps": ["Contact your advisor", "Gather X documents"],
  "related_docs": ["document1.pdf"],
  "confidence": "HIGH - Clear standard procedure"
}}

IMPORTANT: Be reassuring but honest. Most debt documents are routine parts of the process!

JSON Response:"""

        try:
            response = llm.invoke(analysis_prompt)
            
            # Extract JSON
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                # Try parsing directly
                result = json.loads(response)
            
            logger.info(f"✅ Worry analysis complete: {result.get('worry_level', 'unknown')}")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing worry: {e}")
            return {
                "worry_level": "medium",
                "reassurance": "We'd recommend discussing this document with your advisor to understand what it means for your situation.",
                "context": "This is a document related to your debt management process.",
                "next_steps": [
                    "Contact your debt advisor",
                    "Bring this document to your next appointment",
                    "Don't ignore correspondence from creditors"
                ],
                "related_docs": [],
                "confidence": "LOW - Could not analyze automatically"
            }


# Initialize service
rag_service = ClientRAGService()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Client Document RAG Service",
        "status": "healthy",
        "endpoints": {
            "/query": "POST - Query client documents",
            "/ingest": "POST - Ingest new document for client",
            "/stats/{client_id}": "GET - Get client vector store statistics",
            "/clients": "GET - List all clients with documents",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/clients")
async def list_clients():
    """List all clients with vector stores."""
    clients = rag_service.list_all_clients()
    return {
        "clients": clients,
        "total": len(clients)
    }


@app.get("/stats/{client_id}")
async def get_client_stats(client_id: str):
    """Get statistics for a client's vector store."""
    return rag_service.get_client_stats(client_id)


@app.delete("/delete/{client_id}/{filename}")
async def delete_document(client_id: str, filename: str):
    """Delete a specific document from a client's vector store."""
    try:
        collection_name = f"client_{client_id}"
        
        # Check if collection exists
        if collection_name not in [c.name for c in rag_service.chroma_client.list_collections()]:
            raise HTTPException(status_code=404, detail=f"No documents found for client {client_id}")
        
        # Get the collection
        collection = rag_service.chroma_client.get_collection(collection_name)
        
        # Get all documents with this filename
        results = collection.get(
            where={"source": filename},
            include=["metadatas"]
        )
        
        if not results or not results.get("ids"):
            raise HTTPException(status_code=404, detail=f"Document {filename} not found in vector store")
        
        # Delete all chunks for this document
        collection.delete(ids=results["ids"])
        
        logger.info(f"Deleted {len(results['ids'])} chunks for document {filename} from client {client_id}")
        
        return {
            "message": "Document deleted from vector store",
            "client_id": client_id,
            "filename": filename,
            "chunks_deleted": len(results["ids"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse)
async def query_client_documents(request: QueryRequest):
    """Query a client's documents."""
    try:
        result = rag_service.query_client_documents(
            client_id=request.client_id,
            question=request.question,
            model_name=request.model,
            top_k=request.top_k
        )
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.post("/agentic-query", response_model=AgenticQueryResponse)
async def agentic_query_client_documents(request: AgenticQueryRequest):
    """
    Query client documents using agentic reasoning (LangGraph or legacy).

    This endpoint uses multi-step reasoning to:
    1. Analyze the question complexity
    2. Plan an optimal search strategy
    3. Iteratively gather relevant context from client documents
    4. Synthesize a comprehensive answer with confidence rating
    """
    try:
        logger.info(f"🤖 Agentic query for client {request.client_id}: {request.question}")

        # Use LangGraph agent if available
        if rag_service.use_langgraph and rag_service.agent_app is not None:
            logger.info("Using LangGraph client agent")
            from client_agent_state import create_initial_client_state, state_to_response

            # Create initial state
            initial_state = create_initial_client_state(
                client_id=request.client_id,
                question=request.question,
                model_name=request.model,
                ollama_url=rag_service.ollama_url,
                max_iterations=request.max_iterations,
                top_k=request.top_k,
                show_reasoning=request.show_reasoning
            )

            # Run agent
            result_state = rag_service.agent_app.invoke(initial_state)

            # Convert state to response
            response_data = state_to_response(result_state)

            return AgenticQueryResponse(
                answer=response_data["answer"],
                sources=response_data.get("sources", []),
                reasoning_steps=response_data.get("reasoning_steps") if request.show_reasoning else None,
                iterations_used=response_data.get("iterations_used", 1),
                confidence=str(response_data.get("confidence", 0.5))
            )
        else:
            # Fallback to legacy implementation
            logger.info("Using legacy client RAG implementation")
            result = rag_service.agentic_client_query(
                client_id=request.client_id,
                question=request.question,
                model_name=request.model,
                max_iterations=request.max_iterations,
                top_k=request.top_k,
                show_reasoning=request.show_reasoning
            )

            return AgenticQueryResponse(
                answer=result["answer"],
                sources=result["sources"],
                reasoning_steps=result.get("reasoning_steps"),
                iterations_used=result["iterations_used"],
                confidence=result["confidence"]
            )
    except Exception as e:
        logger.error(f"Error processing agentic query: {str(e)}")
        logger.exception(e)  # Print full traceback
        raise HTTPException(status_code=500, detail=f"Error processing agentic query: {str(e)}")


@app.post("/should-i-worry", response_model=DocumentWorryResponse)
async def analyze_document_worry(request: DocumentWorryRequest):
    """
    Analyze if a client should worry about a specific document (LangGraph or legacy).

    This provides a reassuring, contextual analysis of documents including:
    - Worry level (low/medium/high)
    - Reassuring explanation
    - Where it fits in their debt journey
    - Recommended next steps
    - Related documents from their collection
    """
    try:
        logger.info(f"😰 'Should I worry?' analysis for {request.filename} (client {request.client_id})")

        # Use LangGraph agent if available
        if rag_service.use_langgraph and rag_service.agent_app is not None:
            logger.info("Using LangGraph worry analysis")
            from client_agent_state import create_initial_client_state, state_to_response

            # Create worry-focused question
            question = f"I'm worried about this document: {request.filename}. Should I be concerned?"
            if request.document_summary:
                question += f" The document shows: {request.document_summary}"

            # Create initial state
            initial_state = create_initial_client_state(
                client_id=request.client_id,
                question=question,
                model_name="llama3.2",
                ollama_url=rag_service.ollama_url,
                max_iterations=2,
                top_k=4,
                show_reasoning=False
            )

            # Run agent
            result_state = rag_service.agent_app.invoke(initial_state)

            # Extract worry analysis from state
            worry_analysis = result_state.get("worry_analysis", {})

            if worry_analysis:
                return DocumentWorryResponse(
                    worry_level=worry_analysis.get("worry_level", "medium"),
                    reassurance=worry_analysis.get("reassurance", result_state.get("answer", "")),
                    context=worry_analysis.get("context", ""),
                    next_steps=worry_analysis.get("next_steps", []),
                    related_docs=result_state.get("available_documents", []),
                    confidence=str(result_state.get("confidence", 0.75))
                )
            else:
                # Fallback to answer if no worry analysis
                return DocumentWorryResponse(
                    worry_level="medium",
                    reassurance=result_state.get("answer", ""),
                    context="",
                    next_steps=[],
                    related_docs=result_state.get("available_documents", []),
                    confidence=str(result_state.get("confidence", 0.5))
                )
        else:
            # Fallback to legacy implementation
            logger.info("Using legacy worry analysis")
            result = await rag_service.analyze_document_worry(
                client_id=request.client_id,
                filename=request.filename,
                document_summary=request.document_summary
            )

            return DocumentWorryResponse(
                worry_level=result["worry_level"],
                reassurance=result["reassurance"],
                context=result["context"],
                next_steps=result.get("next_steps"),
                related_docs=result.get("related_docs"),
                confidence=result["confidence"]
            )
    except Exception as e:
        logger.error(f"Error analyzing document worry: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing document: {str(e)}")


@app.post("/ingest")
async def ingest_document(request: IngestRequest):
    """Ingest a document into a client's vector store."""
    try:
        logger.info(f"🌐 [API] Received ingest request")
        logger.info(f"   ├─ Client ID: {request.client_id}")
        logger.info(f"   ├─ Filename: {request.filename}")
        logger.info(f"   ├─ Text length: {len(request.document_text)} chars")
        logger.info(f"   └─ Metadata: {request.metadata}")
        
        result = rag_service.ingest_document(
            client_id=request.client_id,
            document_text=request.document_text,
            filename=request.filename,
            metadata=request.metadata
        )
        
        logger.info(f"✅ [API] Returning success response: {result}")
        return result
        
    except Exception as e:
        logger.error(f"❌ [API] Error ingesting document: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"   Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error ingesting document: {str(e)}")


# ============================================================
# N8N-COMPATIBLE ENDPOINTS
# Structured outputs for workflow automation
# ============================================================

class AuditChecklistRequest(BaseModel):
    """Request for audit checklist validation."""
    client_id: str
    checklist: List[Dict[str, Any]]  # List of checks to perform
    strict_mode: bool = False  # Fail on first missing item

class AuditChecklistResponse(BaseModel):
    """Response from audit checklist validation."""
    client_id: str
    total_checks: int
    passed_checks: int
    failed_checks: int
    warnings: int
    pass_rate: float
    overall_status: str  # "PASS", "FAIL", "WARNING"
    results: List[Dict[str, Any]]
    summary: str
    recommendations: List[str]

class N8NQueryRequest(BaseModel):
    """Simple query format for n8n."""
    client_id: str
    query: str
    return_sources: bool = True

class N8NQueryResponse(BaseModel):
    """Structured response for n8n workflows."""
    success: bool
    client_id: str
    query: str
    answer: str
    confidence: float
    sources: List[Dict[str, Any]]
    metadata: Dict[str, Any]


@app.post("/n8n/query", response_model=N8NQueryResponse)
async def n8n_query(request: N8NQueryRequest):
    """
    N8N-compatible query endpoint with structured output.

    Designed for easy integration with n8n workflows.
    Returns consistent JSON structure for workflow processing.
    """
    try:
        # Use agentic query for better results
        agentic_request = AgenticQueryRequest(
            client_id=request.client_id,
            query=request.query,
            include_reasoning=True
        )

        result = await agentic_query_endpoint(agentic_request)

        # Convert to n8n-friendly format
        sources = []
        if request.return_sources and result.sources:
            for source in result.sources[:5]:  # Limit to 5 sources
                sources.append({
                    "filename": source.get("filename", "unknown"),
                    "content": source.get("content", "")[:200] + "...",  # Truncate for n8n
                    "relevance": source.get("relevance_score", 0.0)
                })

        return N8NQueryResponse(
            success=True,
            client_id=request.client_id,
            query=request.query,
            answer=result.answer,
            confidence=result.confidence_score,
            sources=sources,
            metadata={
                "reasoning_steps": len(result.reasoning_trace) if result.reasoning_trace else 0,
                "tools_used": result.tools_used or [],
                "processing_time_ms": 0  # Could add timing
            }
        )

    except Exception as e:
        logger.error(f"N8N query error: {e}")
        return N8NQueryResponse(
            success=False,
            client_id=request.client_id,
            query=request.query,
            answer=f"Error: {str(e)}",
            confidence=0.0,
            sources=[],
            metadata={"error": str(e)}
        )


@app.post("/n8n/audit-checklist", response_model=AuditChecklistResponse)
async def n8n_audit_checklist(request: AuditChecklistRequest):
    """
    Audit agent endpoint for n8n workflows.

    Validates client documents against a checklist of required items.
    Perfect for compliance checks, document validation, and audit trails.

    Checklist format:
    [
        {
            "item": "Proof of income",
            "required": true,
            "query": "Does the client have proof of income documents?",
            "category": "financial"
        },
        {
            "item": "Bank statements (last 3 months)",
            "required": true,
            "query": "Are there bank statements for the last 3 months?",
            "category": "financial"
        }
    ]
    """
    try:
        results = []
        passed = 0
        failed = 0
        warnings = 0

        for idx, check in enumerate(request.checklist):
            item = check.get("item", f"Check {idx+1}")
            required = check.get("required", True)
            query = check.get("query", f"Check if client has: {item}")
            category = check.get("category", "general")

            # Query the client's documents
            query_request = N8NQueryRequest(
                client_id=request.client_id,
                query=query,
                return_sources=True
            )

            query_result = await n8n_query(query_request)

            # Analyze the answer to determine pass/fail
            answer_lower = query_result.answer.lower()

            # Simple heuristic: look for positive/negative indicators
            positive_indicators = ["yes", "found", "has", "provided", "included", "present", "confirmed"]
            negative_indicators = ["no", "not found", "missing", "absent", "no evidence", "unclear", "cannot confirm"]

            positive_score = sum(1 for indicator in positive_indicators if indicator in answer_lower)
            negative_score = sum(1 for indicator in negative_indicators if indicator in answer_lower)

            # Determine status
            if positive_score > negative_score and query_result.confidence > 0.6:
                status = "PASS"
                passed += 1
            elif required:
                status = "FAIL"
                failed += 1
            else:
                status = "WARNING"
                warnings += 1

            results.append({
                "item": item,
                "category": category,
                "required": required,
                "status": status,
                "answer": query_result.answer,
                "confidence": query_result.confidence,
                "sources_found": len(query_result.sources),
                "recommendation": _get_recommendation(status, item, required)
            })

            # In strict mode, fail fast
            if request.strict_mode and status == "FAIL":
                break

        total_checks = len(results)
        pass_rate = (passed / total_checks * 100) if total_checks > 0 else 0

        # Determine overall status
        if failed > 0:
            overall_status = "FAIL"
        elif warnings > 0:
            overall_status = "WARNING"
        else:
            overall_status = "PASS"

        # Generate summary
        summary = f"Audit completed: {passed}/{total_checks} checks passed ({pass_rate:.1f}%). "
        if failed > 0:
            summary += f"{failed} required items missing. "
        if warnings > 0:
            summary += f"{warnings} optional items not found."

        # Generate recommendations
        recommendations = []
        for result in results:
            if result["status"] in ["FAIL", "WARNING"]:
                recommendations.append(result["recommendation"])

        return AuditChecklistResponse(
            client_id=request.client_id,
            total_checks=total_checks,
            passed_checks=passed,
            failed_checks=failed,
            warnings=warnings,
            pass_rate=pass_rate,
            overall_status=overall_status,
            results=results,
            summary=summary,
            recommendations=recommendations
        )

    except Exception as e:
        logger.error(f"Audit checklist error: {e}")
        raise HTTPException(status_code=500, detail=f"Audit error: {str(e)}")


def _get_recommendation(status: str, item: str, required: bool) -> str:
    """Generate recommendation based on audit result."""
    if status == "FAIL":
        return f"REQUIRED: Request {item} from client immediately. This is a mandatory document."
    elif status == "WARNING":
        return f"OPTIONAL: Consider requesting {item} from client for completeness."
    else:
        return f"OK: {item} verified in client documents."


@app.get("/n8n/workflows")
async def list_n8n_workflows():
    """
    List available n8n workflow templates.

    Returns information about pre-built workflows that can be
    imported into n8n for automation.
    """
    return {
        "workflows": [
            {
                "name": "Client Document Audit",
                "description": "Automated audit of client documents against compliance checklist",
                "endpoint": "/n8n/audit-checklist",
                "triggers": ["manual", "schedule", "webhook"],
                "file": "workflows/client-audit-agent.json"
            },
            {
                "name": "Document Query",
                "description": "Query client documents with structured output",
                "endpoint": "/n8n/query",
                "triggers": ["manual", "webhook"],
                "file": "workflows/document-query.json"
            },
            {
                "name": "Missing Documents Alert",
                "description": "Check for missing required documents and send alerts",
                "endpoint": "/n8n/audit-checklist",
                "triggers": ["schedule"],
                "file": "workflows/missing-docs-alert.json"
            }
        ]
    }


if __name__ == "__main__":
    logger.info("Starting Client Document RAG Service...")
    uvicorn.run(app, host="0.0.0.0", port=8104)
