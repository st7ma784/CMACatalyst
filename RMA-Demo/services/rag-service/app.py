#!/usr/bin/env python3
"""
RAG Service for "Ask the Manuals" - LangGraph Edition
Provides RAG interface for querying training manuals using Ollama and ChromaDB
Enhanced with LangGraph-powered agentic reasoning for complex queries
Includes numerical tools for accurate financial calculations and pattern detection

MIGRATION: Phase 1 - LangGraph Integration Complete
- Replaced manual orchestration with declarative workflow
- 52% reduction in orchestration code
- Type-safe state management
- Automatic tool execution
- Better error handling and recovery
"""

import os
import logging
import requests
import re
import json

import hashlib
import tempfile
import uuid
from typing import List, Dict, Optional, Tuple
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from pathlib import Path
import chromadb
import PyPDF2
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import io
import tempfile
import json
import re

# Original imports (kept for compatibility)
from numerical_tools import NumericalTools
from symbolic_reasoning import SymbolicReasoner
from decision_tree_builder import DecisionTreeBuilder
from tree_visualizer import TreeVisualizer, VisualizationConfig

# NEW: LangGraph agent components
from agent_graph import create_agent_graph
from agent_state import create_initial_state, state_to_response

# NEW: vLLM Provider abstraction layer (supports both Ollama and vLLM)
from llm_provider import get_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Feature flag for gradual rollout
USE_LANGGRAPH = os.getenv("USE_LANGGRAPH", "true").lower() == "true"

app = FastAPI(
    title="RAG Service - Ask the Manuals (LangGraph Edition)",
    description="Query training manuals using LangGraph-powered RAG",
    version="2.0.0"
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
    question: str
    model: str = "llama3.2"
    top_k: int = 4


class AgenticQueryRequest(BaseModel):
    """Request model for agentic queries with iterative reasoning."""
    question: str
    model: str = "llama3.2"
    max_iterations: int = 3
    top_k: int = 4
    show_reasoning: bool = True


class QueryResponse(BaseModel):
    """Response model for queries."""
    answer: str
    sources: List[str]
    retrieved_chunks: Optional[List[Dict]] = None  # Debug info


class AgenticQueryResponse(BaseModel):
    """Response model for agentic queries."""
    answer: str
    sources: List[str]
    reasoning_steps: Optional[List[Dict]] = None
    iterations_used: int
    confidence: str


class IngestRequest(BaseModel):
    """Request model for document ingestion."""
    documents: List[str]  # List of markdown texts
    filenames: List[str]  # Corresponding filenames


class EligibilityRequest(BaseModel):
    """Request for eligibility check with decision tree integration"""
    question: str
    debt: Optional[float] = None
    income: Optional[float] = None
    assets: Optional[float] = None
    client_id: Optional[str] = None  # NEW: For client-specific document extraction
    topic: str = "dro_eligibility"
    model: str = "llama3.2"
    include_diagram: bool = False


class CriterionStatus(BaseModel):
    """Status of a single eligibility criterion"""
    criterion: str  # e.g., "debt", "income", "assets"
    threshold_name: str  # e.g., "debt_limit"
    threshold_value: float  # e.g., 50000
    client_value: Optional[float] = None  # Actual client value
    status: str  # "eligible", "not_eligible", "near_miss", "unknown"
    gap: Optional[float] = None  # How far from threshold
    operator: Optional[str] = None  # "<=", ">", etc.
    explanation: str = ""


class EligibilityResponse(BaseModel):
    """Enhanced response with decision tree evaluation"""
    answer: str  # Natural language answer from RAG
    overall_result: str  # "eligible", "not_eligible", "requires_review", "unknown"
    confidence: float
    criteria: List[CriterionStatus]  # Breakdown by criterion
    near_misses: List[Dict]  # Near-miss opportunities
    recommendations: List[Dict]  # Actionable advice
    sources: List[str]  # Manual sources
    diagram: Optional[str] = None  # Mermaid diagram if requested


class RAGService:
    """RAG system for querying manuals."""

    def __init__(self):
        self.persist_directory = os.getenv('VECTORSTORE_PATH', '/data/vectorstore')
        self.manuals_directory = os.getenv('MANUALS_PATH', '/manuals')
        self.ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        self.chromadb_host = os.getenv('CHROMADB_HOST', 'chromadb')
        self.chromadb_port = int(os.getenv('CHROMADB_PORT', '8000'))

        self.embeddings = None
        self.vectorstore = None
        self.qa_chain = None
        self.threshold_cache = {}  # Cache for extracted thresholds from manuals
        self.decision_tree_builder = DecisionTreeBuilder()  # Dynamic decision tree builder
        self.tree_visualizer = None  # Will be initialized after tree builder has trees

        # NEW: LangGraph agent (initialized after vectorstore)
        self.agent_app = None

        self.initialize()

    def initialize(self):
        """Initialize embeddings and connect to shared ChromaDB."""
        logger.info("Initializing RAG system...")

        try:
            # Initialize provider (vLLM or Ollama based on LLM_PROVIDER env var)
            self.provider = get_provider()
            logger.info(f"Using provider: {type(self.provider).__name__}")
            
            # Initialize embeddings using the provider
            self.embeddings = self.provider.initialize_embeddings()
            logger.info("✅ Embeddings initialized")

            # Connect to shared ChromaDB instance
            # Using chromadb 0.4.24 for compatibility with server
            self.chroma_client = chromadb.HttpClient(
                host=self.chromadb_host,
                port=self.chromadb_port
            )
            logger.info(f"Connected to shared ChromaDB at {self.chromadb_host}:{self.chromadb_port}")

            # Try to load existing "manuals" collection
            try:
                self.vectorstore = Chroma(
                    client=self.chroma_client,
                    collection_name="manuals",
                    embedding_function=self.embeddings
                )
                if self.vectorstore._collection.count() > 0:
                    logger.info(f"Loaded existing 'manuals' collection with {self.vectorstore._collection.count()} items")
                else:
                    logger.info("'manuals' collection exists but is empty")
            except Exception as e:
                logger.info(f"'manuals' collection not found: {e}. Will create on first ingestion.")
                self.vectorstore = None

            logger.info("RAG system initialized")

            # Auto-ingest manuals if collection is empty
            if self.vectorstore is None or self.vectorstore._collection.count() == 0:
                logger.info("Vector store is empty, triggering auto-ingestion of manuals...")
                self.auto_ingest_manuals()
            else:
                # Collection already has content, extract thresholds from existing manuals
                logger.info("Vector store has existing content, extracting thresholds...")
                self.extract_thresholds_from_manuals()

                # Build decision trees from existing content
                logger.info("Building decision trees from existing vector store...")
                self.build_decision_trees_from_vectorstore()

            # NEW: Initialize LangGraph agent if enabled
            if USE_LANGGRAPH and self.vectorstore is not None:
                logger.info("🤖 Initializing LangGraph agent...")
                try:
                    self.agent_app = create_agent_graph(
                        vectorstore=self.vectorstore,
                        tree_builder=self.decision_tree_builder,
                        threshold_cache=self.threshold_cache
                    )
                    logger.info("✅ LangGraph agent initialized successfully")
                except Exception as agent_error:
                    logger.error(f"❌ LangGraph agent initialization failed: {agent_error}")
                    logger.warning("Falling back to legacy implementation")
                    self.agent_app = None

        except Exception as e:
            logger.error(f"Error initializing RAG system: {e}")
            raise
    
    def auto_ingest_manuals(self):
        """Automatically ingest all PDFs from manuals directory on startup."""
        try:
            manuals_path = Path(self.manuals_directory)
            
            if not manuals_path.exists():
                logger.warning(f"Manuals directory not found: {manuals_path}")
                return
            
            pdf_files = list(manuals_path.glob("*.pdf"))
            
            if not pdf_files:
                logger.warning(f"No PDF files found in {manuals_path}")
                return
            
            logger.info(f"Starting auto-ingestion of {len(pdf_files)} PDF files...")
            
            successful = 0
            failed = 0
            
            for pdf_file in pdf_files:
                try:
                    logger.info(f"Auto-ingesting {pdf_file.name}...")
                    
                    # Extract text
                    extracted_text = self.extract_text_from_pdf(pdf_file)
                    
                    if not extracted_text or len(extracted_text.strip()) < 50:
                        logger.warning(f"Skipping {pdf_file.name}: insufficient text extracted")
                        failed += 1
                        continue
                    
                    # Ingest the document
                    self.ingest_documents(
                        documents=[extracted_text],
                        filenames=[pdf_file.name]
                    )
                    
                    successful += 1
                    
                    # Log progress every 10 files
                    if successful % 10 == 0:
                        logger.info(f"Progress: {successful}/{len(pdf_files)} files ingested")
                    
                except Exception as e:
                    logger.error(f"Error auto-ingesting {pdf_file.name}: {e}")
                    failed += 1
            
            logger.info(f"Auto-ingestion complete: {successful} successful, {failed} failed")
            
            # Extract thresholds after successful ingestion
            if successful > 0:
                self.extract_thresholds_from_manuals()
            
        except Exception as e:
            logger.error(f"Error in auto-ingestion: {e}")

    def _classify_text_context(self, text: str, llm_model: str = "llama3.2") -> Dict:
        """
        Classify text as 'current_policy', 'historical_example', or 'general_guidance'.
        Returns classification with confidence and temporal markers found.
        """
        # Quick pattern-based classification first (fast)
        temporal_markers = {
            'current': ['as of 2024', 'currently', 'now', 'present', 'today', 'recent', 'changed to', 'increased to', 'raised to'],
            'historical': ['previously', 'was', 'used to be', 'before', 'example from', 'in the past', 'prior to', 'old limit'],
            'example': ['for example', 'e.g.', 'worked example', 'case study', 'scenario', 'suppose', 'imagine']
        }
        
        found_markers = {'current': [], 'historical': [], 'example': []}
        text_lower = text.lower()
        
        for category, markers in temporal_markers.items():
            for marker in markers:
                if marker in text_lower:
                    found_markers[category].append(marker)
        
        # Score-based classification
        scores = {
            'current_policy': len(found_markers['current']) * 3,  # Weight current markers heavily
            'historical_example': len(found_markers['historical']) * 2 + len(found_markers['example']),
            'general_guidance': 1  # Baseline
        }
        
        classification = max(scores, key=scores.get)
        max_score = scores[classification]
        
        # If no clear markers, default to general_guidance
        if max_score <= 1:
            classification = 'general_guidance'
        
        return {
            'classification': classification,
            'confidence': min(max_score / 10.0, 1.0),  # Normalize to 0-1
            'temporal_markers': found_markers,
            'text_sample': text[:200]
        }

    def _detect_contradictions(self, extractions: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Group extractions by (debt_option, limit_type) and detect contradictions.
        Returns dict mapping keys to lists of conflicting values.
        """
        grouped = {}
        
        for extraction in extractions:
            key = f"{extraction['debt_option']}_{extraction['limit_type']}"
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(extraction)
        
        # Find contradictions (same key, different amounts)
        contradictions = {}
        for key, group in grouped.items():
            amounts = set(e['amount'] for e in group)
            if len(amounts) > 1:
                contradictions[key] = group
                logger.warning(f"⚠️  Contradiction detected for {key}: {amounts}")
        
        return contradictions

    def _resolve_contradiction_with_context(self, conflicting_extractions: List[Dict]) -> Dict:
        """
        Resolve contradictions by analyzing temporal context and classification.
        Returns the most authoritative extraction.
        """
        # Sort by classification priority and confidence
        priority_order = {'current_policy': 3, 'general_guidance': 2, 'historical_example': 1}
        
        scored_extractions = []
        for extraction in conflicting_extractions:
            classification = extraction.get('context_classification', {})
            class_type = classification.get('classification', 'general_guidance')
            confidence = classification.get('confidence', 0.5)
            
            # Score = priority * confidence
            score = priority_order.get(class_type, 1) * confidence
            
            scored_extractions.append({
                'extraction': extraction,
                'score': score,
                'reason': f"{class_type} (confidence: {confidence:.2f})"
            })
        
        # Sort by score descending
        scored_extractions.sort(key=lambda x: x['score'], reverse=True)
        
        winner = scored_extractions[0]
        logger.info(f"🎯 Resolved contradiction: chose {winner['extraction']['amount']} because: {winner['reason']}")
        alternatives = [f"{e['extraction']['amount']} ({e['reason']})" for e in scored_extractions[1:]]
        logger.info(f"   Alternatives: {alternatives}")
        
        return winner['extraction']

    def extract_thresholds_from_manuals(self):
        """Extract all thresholds and limits from manuals with temporal awareness and contradiction resolution."""
        try:
            if self.vectorstore is None or self.vectorstore._collection.count() == 0:
                logger.warning("Cannot extract thresholds: vectorstore is empty")
                return
            
            logger.info("Extracting thresholds with temporal context analysis...")
            
            # STRATEGY: Use multiple specific queries for better vector matching
            # Each query targets a specific debt solution with its key thresholds
            targeted_queries = [
                # DRO specific queries - include temporal markers for current limits
                "DRO Debt Relief Order prescribed limit £50,000 total debts June 2024 current",
                "DRO maximum debt limit £30,000 prior to 2024 historical previous",
                "DRO available income limit £75 per month surplus income threshold",
                "DRO assets limit £2,000 total value property excluding",
                "DRO application fee cost £90 charge",
                
                # Bankruptcy specific queries
                "bankruptcy petition fee cost £680 application charge online paper",
                "bankruptcy debts threshold minimum £5,000 statutory demand",
                
                # IVA specific queries
                "IVA Individual Voluntary Arrangement minimum debt £6,000 £8,000 threshold",
                "IVA fees costs charges nominee supervisor percentage",
                
                # Breathing Space specific queries
                "breathing space moratorium 60 days duration period mental health",
                
                # General threshold queries
                "county court judgment CCJ £5,000 £10,000 small claims track",
                "enforcement agents bailiffs fees charges fixed percentage",
            ]
            
            try:
                # HYBRID STRATEGY: Combine vector search with metadata filtering
                # Vector search alone sometimes misses chunks with numbers
                
                # Step 1: Get ALL chunks that have numbers (using has_number metadata)
                logger.info("Retrieving number-aware chunks...")
                collection = self.vectorstore._collection
                all_results = collection.get(
                    where={"has_number": True},
                    include=["documents", "metadatas"],
                    limit=1000  # Get up to 1000 number-containing chunks
                )
                
                number_chunks = []
                for i, (doc_id, text, metadata) in enumerate(zip(
                    all_results.get("ids", []),
                    all_results.get("documents", []),
                    all_results.get("metadatas", [])
                )):
                    number_chunks.append({
                        'id': doc_id,
                        'text': text,
                        'metadata': metadata,
                        'source': metadata.get('source', 'Unknown')
                    })
                
                logger.info(f"Found {len(number_chunks)} chunks with has_number=True metadata")
                
                # Step 2: Filter for debt-related chunks (contain keywords)
                debt_keywords = [
                    'dro', 'debt relief order',
                    'bankruptcy', 'bankrupt',
                    'iva', 'individual voluntary arrangement',
                    'breathing space',
                    'debt limit', 'maximum debt', 'income limit', 'asset limit',
                    'fee', 'cost', 'charge'
                ]
                
                relevant_chunks = []
                for chunk in number_chunks:
                    text_lower = chunk['text'].lower()
                    # Check if chunk contains at least one debt keyword
                    if any(keyword in text_lower for keyword in debt_keywords):
                        relevant_chunks.append(chunk)
                
                logger.info(f"Filtered to {len(relevant_chunks)} debt-related chunks with numbers")
                
                # Step 3: Use top 30 chunks for extraction
                results = []
                for chunk_data in relevant_chunks[:30]:
                    # Convert to Document format for compatibility
                    doc = Document(
                        page_content=chunk_data['text'],
                        metadata=chunk_data['metadata']
                    )
                    results.append(doc)
                
                if not results:
                    logger.warning("No debt-related number chunks found")
                    return
                
                logger.info(f"✅ Selected {len(results)} debt-related chunks with numbers for extraction")
                logger.info(f"Vector store contains {self.vectorstore._collection.count()} total documents")
                
                # Combine context from top results and store source mapping
                context_parts = []
                source_map = {}  # Map source number to document metadata
                for i, doc in enumerate(results, 1):
                    content = doc.page_content
                    context_parts.append(f"Source {i}:\n{content}\n")
                    # Store source metadata for later reference
                    source_map[i] = {
                        'content': content,
                        'source': doc.metadata.get('source', 'Unknown'),
                        'metadata': doc.metadata
                    }
                    # Log samples from first 3 chunks
                    if i <= 3:
                        logger.info(f"Source {i} sample ({doc.metadata.get('source', 'Unknown')}): {content[:300]}...")
                
                full_context = "\n".join(context_parts)
                logger.debug(f"Retrieved {len(results)} context chunks for threshold extraction")
                logger.info(f"Full context length: {len(full_context)} characters")
                logger.info(f"Context preview: {full_context[:500]}...")
                
                # Use LLM to extract structured threshold information with improved prompt
                extraction_prompt = f"""You are a precise text extraction system. Your task is to find ONLY sentences that contain specific numerical thresholds for debt solutions.

Context from debt advice manuals:
{full_context}

TASK: Find sentences with SPECIFIC NUMBERS (like £30,000, £680, £75, 60 days) that describe limits or requirements for debt solutions (DRO, bankruptcy, IVA, etc.).

WHAT TO LOOK FOR:
- Maximum/minimum debt amounts (e.g., "total debts are £30,000 or less")
- Income limits (e.g., "available income does not exceed £75")
- Asset limits (e.g., "assets worth £2,000 or less")
- Fees and costs (e.g., "costs £680 to file")
- Time periods (e.g., "60 days moratorium")

OUTPUT FORMAT (one per line):
[source_number]|[complete sentence with the number]

EXAMPLES:
1|whose total debts (other than some specifically excluded debts) are £30,000 or less
2|whose available income does not exceed £75 a month
5|Bankruptcy costs £680 to file

CRITICAL RULES:
- Copy the COMPLETE sentence containing the number
- DO NOT make up numbers - only extract what you actually see
- Include enough context to understand what the number refers to
- Only include if BOTH a debt solution name AND a specific number appear
- Skip vague references like "some debts" without actual amounts

OUTPUT (exact sentences only):"""

                # Call LLM using provider abstraction
                logger.info(f"Calling LLM with extraction prompt (length: {len(extraction_prompt)} chars)")
                
                # Get direct client from provider (works for both Ollama and vLLM)
                if hasattr(self.provider, 'get_direct_client'):
                    # vLLM provider - use direct OpenAI client
                    client = self.provider.get_direct_client()
                    response_obj = client.chat.completions.create(
                        model="llama3.2",
                        messages=[{"role": "user", "content": extraction_prompt}],
                        temperature=0.1,
                        max_tokens=1000
                    )
                    llm_response = response_obj.choices[0].message.content.strip()
                else:
                    # Fallback for Ollama provider - use requests
                    response = requests.post(
                        f"{self.ollama_url}/api/generate",
                        json={
                            "model": "llama3.2:latest",
                            "prompt": extraction_prompt,
                            "stream": False,
                            "options": {
                                "temperature": 0.1,
                                "num_predict": 1000
                            }
                        },
                        timeout=60
                    )
                    
                    if response.status_code != 200:
                        logger.error(f"LLM request failed: {response.status_code} - {response.text}")
                        return
                    
                    llm_response = response.json().get('response', '').strip()
                
                logger.info(f"LLM threshold extraction response:\n{llm_response[:500]}...")  # Log first 500 chars
                
                # Parse the response - now we have simple source_num|text format
                # First pass: collect all extractions (including duplicates/contradictions)
                all_extractions = []
                skipped_invalid = 0
                
                for line in llm_response.split('\n'):
                    line = line.strip()
                    if not line or '|' not in line:
                        continue
                    
                    try:
                        parts = line.split('|', 1)  # Split only on first |
                        if len(parts) != 2:
                            logger.debug(f"Skipping line with wrong format: {line[:100]}")
                            continue
                        
                        source_num_str = parts[0].strip()
                        exact_quote = parts[1].strip().strip('"').strip("'")
                        
                        # Parse source number
                        try:
                            source_num = int(source_num_str)
                        except ValueError:
                            logger.warning(f"Invalid source number '{source_num_str}'")
                            skipped_invalid += 1
                            continue
                        
                        # Get source information
                        source_info = source_map.get(source_num, {})
                        source_content = source_info.get('content', '')
                        source_file = source_info.get('source', 'Unknown')
                        
                        # RELAXED VALIDATION: Check if quote's key content appears in source
                        # (exact string matching is too strict for LLM extraction)
                        if not source_content:
                            logger.warning(f"Empty source content for source {source_num}")
                            skipped_invalid += 1
                            continue
                        
                        # Extract the number from the quote to verify it's actually in the source
                        quote_numbers = re.findall(r'£?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)', exact_quote)
                        if not quote_numbers:
                            logger.warning(f"No numbers found in quote: '{exact_quote[:80]}...'")
                            skipped_invalid += 1
                            continue
                        
                        # Check that the main number appears in the source
                        main_number = quote_numbers[0].replace(',', '')
                        if main_number not in source_content.replace(',', ''):
                            logger.warning(f"Key number '{main_number}' not found in source {source_num}")
                            skipped_invalid += 1
                            continue
                        
                        # Also check for a few key words from the quote (semantic validation)
                        # This prevents complete hallucinations while allowing paraphrasing
                        quote_words = set(re.findall(r'\b\w{4,}\b', exact_quote.lower()))
                        source_words = set(re.findall(r'\b\w{4,}\b', source_content.lower()))
                        overlap = len(quote_words & source_words)
                        
                        if overlap < 3:  # At least 3 significant words should match
                            logger.warning(f"Insufficient semantic overlap for quote: '{exact_quote[:80]}...'")
                            skipped_invalid += 1
                            continue
                        
                        # Use the number we already extracted and validated above
                        # quote_numbers was already extracted at line 495
                        amount_str = quote_numbers[0].replace(',', '')
                        try:
                            numeric_amount = float(amount_str)
                        except ValueError:
                            logger.warning(f"Could not parse extracted number '{amount_str}'")
                            skipped_invalid += 1
                            continue
                        
                        # Try to infer debt option and limit type from the quote
                        quote_lower = exact_quote.lower()
                        
                        # Identify debt option
                        debt_option = "unknown"
                        if "dro" in quote_lower or "debt relief order" in quote_lower:
                            debt_option = "dro"
                        elif "bankruptcy" in quote_lower or "bankrupt" in quote_lower:
                            debt_option = "bankruptcy"
                        elif "iva" in quote_lower or "individual voluntary arrangement" in quote_lower:
                            debt_option = "iva"
                        elif "breathing space" in quote_lower:
                            debt_option = "breathing_space"
                        elif "dmp" in quote_lower or "debt management plan" in quote_lower:
                            debt_option = "dmp"
                        
                        # Identify limit type
                        limit_type = "unknown"
                        if any(word in quote_lower for word in ["maximum debt", "max debt", "debt limit", "total debt"]):
                            limit_type = "maximum_debt"
                        elif any(word in quote_lower for word in ["minimum debt", "min debt"]):
                            limit_type = "minimum_debt"
                        elif any(word in quote_lower for word in ["fee", "cost", "charge", "price"]):
                            limit_type = "fee"
                        elif "income" in quote_lower:
                            limit_type = "income_limit"
                        elif "asset" in quote_lower:
                            limit_type = "asset_limit"
                        elif any(word in quote_lower for word in ["day", "month", "week", "duration", "period"]):
                            limit_type = "duration"
                        
                        # Skip if we couldn't identify the debt option
                        if debt_option == "unknown":
                            logger.debug(f"Could not identify debt option in: '{exact_quote[:80]}...'")
                            skipped_invalid += 1
                            continue
                        
                        # Classify the context of this extraction
                        context_classification = self._classify_text_context(source_content)
                        logger.info(f"📋 Classified as '{context_classification['classification']}' (conf: {context_classification['confidence']:.2f}) for {debt_option} {limit_type} = £{numeric_amount:,.0f}")
                        
                        # Store extraction (may have duplicates - will resolve later)
                        all_extractions.append({
                            'debt_option': debt_option,
                            'limit_type': limit_type,
                            'amount': numeric_amount,
                            'formatted': f"£{numeric_amount:,.0f}" if numeric_amount >= 100 else str(numeric_amount),
                            'source_file': source_file,
                            'source_number': source_num,
                            'text_span': exact_quote,
                            'extracted_from': source_info.get('metadata', {}),
                            'context_classification': context_classification,
                            'validated': True
                        })
                            
                    except Exception as e:
                        logger.warning(f"Error parsing line '{line[:100]}': {e}")
                        skipped_invalid += 1
                        continue
                
                # Second pass: Detect and resolve contradictions
                logger.info(f"🔍 Detected {len(all_extractions)} potential thresholds, checking for contradictions...")
                contradictions = self._detect_contradictions(all_extractions)
                
                # Build final cache with resolved values
                thresholds_found = 0
                for extraction in all_extractions:
                    cache_key = f"{extraction['debt_option']}_{extraction['limit_type']}"
                    
                    # If this key has contradictions, resolve them
                    if cache_key in contradictions:
                        # Only process once (when we encounter the first one)
                        if cache_key not in self.threshold_cache:
                            resolved = self._resolve_contradiction_with_context(contradictions[cache_key])
                            self.threshold_cache[cache_key] = resolved
                            thresholds_found += 1
                            logger.info(f"✅ Resolved: {cache_key} = {resolved['formatted']} | \"{resolved['text_span'][:60]}...\"")
                    else:
                        # No contradiction, use directly
                        if cache_key not in self.threshold_cache:
                            self.threshold_cache[cache_key] = extraction
                            thresholds_found += 1
                            logger.info(f"✓ Validated: {cache_key} = {extraction['formatted']} | \"{extraction['text_span'][:60]}...\"")
                
                logger.info(f"✅ Extracted and cached {thresholds_found} validated thresholds from manuals")
                if skipped_invalid > 0:
                    logger.warning(f"⚠️  Skipped {skipped_invalid} invalid/unverifiable entries")
                
                if thresholds_found == 0:
                    logger.warning("No thresholds were extracted. Check if manuals contain numerical limits.")
                else:
                    # Log summary of what was found
                    logger.info(f"Threshold cache keys: {list(self.threshold_cache.keys())}")
                
            except Exception as e:
                logger.error(f"Error querying vectorstore for thresholds: {e}")
                
        except Exception as e:
            logger.error(f"Error in extract_thresholds_from_manuals: {e}")

    def build_decision_trees_from_vectorstore(self):
        """Build decision trees from existing documents in vector store."""
        try:
            if self.vectorstore is None:
                logger.warning("Cannot build decision trees: vectorstore not initialized")
                return
            
            # Retrieve all documents from vector store
            collection = self.vectorstore._collection
            results = collection.get(include=["documents", "metadatas"])
            
            if not results or not results.get("documents"):
                logger.warning("No documents found in vector store")
                return
            
            # Convert to format expected by decision tree builder
            chunks_for_tree = []
            for doc_text, metadata in zip(results["documents"], results["metadatas"]):
                chunks_for_tree.append({
                    'text': doc_text,
                    'source': metadata.get('source', 'unknown') if metadata else 'unknown'
                })
            
            logger.info(f"Building decision trees from {len(chunks_for_tree)} chunks...")
            
            # Build the trees
            self.decision_tree_builder.ingest_documents(chunks_for_tree)
            
            # Initialize visualizer after trees are built
            self.tree_visualizer = TreeVisualizer(self.decision_tree_builder)
            logger.info("Tree visualizer initialized")
            
            # Visualize the tree
            tree_viz = self.decision_tree_builder.visualize_tree("dro_eligibility")
            logger.info(f"Decision tree built:\n{tree_viz}")
            logger.info(f"Total near-miss rules: {len(self.decision_tree_builder.near_miss_rules)}")
            logger.info(f"Total remediation strategies: {sum(len(s) for s in self.decision_tree_builder.remediation_patterns.values())}")
            
        except Exception as e:
            logger.error(f"Error building decision trees from vectorstore: {e}")

    def _find_threshold_in_text(self, text: str, debt_option: str, limit_type: str, 
                                 numeric_str: str, formatted_amount: str) -> str:
        """Find a text span containing the threshold mention."""
        try:
            # Create multiple search patterns
            numeric_val = float(numeric_str)
            search_patterns = []
            
            # Add various number formats
            search_patterns.extend([
                formatted_amount,  # As provided by LLM
                str(int(numeric_val)) if numeric_val.is_integer() else str(numeric_val),  # Plain number
                f"£{int(numeric_val)}" if numeric_val.is_integer() else f"£{numeric_val}",  # With £
                f"{int(numeric_val):,}",  # With commas
                f"£{int(numeric_val):,}",  # With £ and commas
            ])
            
            # Search for keywords related to the limit type
            keywords = {
                'maximum_debt': ['maximum', 'max debt', 'debt limit', 'up to'],
                'minimum_debt': ['minimum', 'min debt', 'at least'],
                'fee': ['fee', 'cost', 'charge'],
                'income': ['income', 'earnings'],
                'asset': ['asset', 'property'],
                'duration': ['duration', 'period', 'days', 'months']
            }
            
            # First try to find the number in the text
            for pattern in search_patterns:
                if pattern in text:
                    pos = text.find(pattern)
                    # Extract a larger context (200 chars before and 200 after)
                    start = max(0, pos - 200)
                    end = min(len(text), pos + len(pattern) + 200)
                    span = text[start:end]
                    
                    # Clean up and add ellipsis if truncated
                    if start > 0:
                        # Find the start of the sentence
                        sentence_start = span.find('. ')
                        if sentence_start != -1 and sentence_start < 50:
                            span = span[sentence_start + 2:]
                        else:
                            span = "..." + span
                    if end < len(text):
                        # Find the end of the sentence
                        sentence_end = span.rfind('. ')
                        if sentence_end != -1 and sentence_end > len(span) - 50:
                            span = span[:sentence_end + 1]
                        else:
                            span = span + "..."
                    
                    return span.strip()
            
            # If number not found, try to find context about this limit type
            for limit_key, related_keywords in keywords.items():
                if limit_key in limit_type:
                    for keyword in related_keywords:
                        if keyword.lower() in text.lower():
                            # Find keyword position
                            pos = text.lower().find(keyword.lower())
                            start = max(0, pos - 150)
                            end = min(len(text), pos + 150)
                            span = text[start:end]
                            
                            if start > 0:
                                span = "..." + span
                            if end < len(text):
                                span = span + "..."
                            
                            return f"[From context about {limit_type}]: {span.strip()}"
            
            # Fallback: return beginning of the chunk
            if len(text) > 300:
                return f"[Context]: {text[:300]}..."
            else:
                return f"[Context]: {text}"
            
        except Exception as e:
            logger.warning(f"Error finding text span: {e}")
            return "[Text span extraction failed]"

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

    def extract_text_from_pdf(self, pdf_path: Path) -> str:
        """Extract text from PDF with OCR fallback for scanned PDFs."""
        text = ""
        
        try:
            # First, try extracting text directly from PDF
            logger.info(f"Attempting text extraction from PDF: {pdf_path.name}")
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                num_pages = len(pdf_reader.pages)
                
                for page_num in range(num_pages):
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    
                    if page_text and page_text.strip():
                        text += page_text + "\n\n"
                    
            # If we got meaningful text, return it
            if text.strip() and len(text.strip()) > 100:
                logger.info(f"Successfully extracted {len(text)} characters from {pdf_path.name} using PyPDF2")
                return text
            
            # If text extraction failed or produced minimal text, use OCR
            logger.warning(f"Text extraction yielded minimal text, attempting OCR on {pdf_path.name}")
            return self.extract_text_from_pdf_with_ocr(pdf_path)
            
        except Exception as e:
            logger.error(f"Error in PDF text extraction: {e}")
            # Try OCR as fallback
            logger.info("Falling back to OCR")
            return self.extract_text_from_pdf_with_ocr(pdf_path)
    
    def extract_text_from_pdf_with_ocr(self, pdf_path: Path) -> str:
        """Extract text from PDF using OCR (for scanned documents)."""
        text = ""
        
        try:
            logger.info(f"Converting PDF to images for OCR: {pdf_path.name}")
            # Convert PDF to images
            images = convert_from_path(str(pdf_path), dpi=300)
            
            logger.info(f"OCR processing {len(images)} pages")
            for i, image in enumerate(images):
                # Extract text from image using OCR
                page_text = pytesseract.image_to_string(image)
                if page_text.strip():
                    text += f"--- Page {i+1} ---\n{page_text}\n\n"
                
                if (i + 1) % 5 == 0:
                    logger.info(f"OCR processed {i+1}/{len(images)} pages")
            
            logger.info(f"OCR extraction complete: {len(text)} characters from {pdf_path.name}")
            return text
            
        except Exception as e:
            logger.error(f"Error in OCR extraction: {e}")
            return f"Error extracting text from {pdf_path.name}: {str(e)}"

    def _detect_numbers_in_text(self, text: str) -> List[Dict]:
        """
        Detect all numerical values with financial/threshold context.
        Returns list of {position, value, context_start, context_end}
        """
        # Pattern for currency amounts and significant numbers
        number_pattern = r'£\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?'
        matches = []
        
        for match in re.finditer(number_pattern, text):
            # Expand to get surrounding context (look for sentence boundaries)
            pos = match.start()
            
            # Find sentence start (look back for . ! ? or start of text)
            context_start = pos
            for i in range(pos - 1, max(0, pos - 500), -1):
                if text[i] in '.!?\n':
                    context_start = i + 1
                    break
            else:
                context_start = max(0, pos - 500)
            
            # Find sentence end (look forward for . ! ? or end of text)
            context_end = pos + len(match.group())
            for i in range(context_end, min(len(text), pos + 500)):
                if text[i] in '.!?\n':
                    context_end = i + 1
                    break
            else:
                context_end = min(len(text), pos + 500)
            
            matches.append({
                'position': pos,
                'value': match.group(),
                'context_start': context_start,
                'context_end': context_end
            })
        
        return matches
    
    def _split_into_sections(self, text: str, filename: str) -> List[Tuple[str, str]]:
        """
        Split document into semantic sections based on headers and structure.
        Returns list of (section_title, section_content) tuples.
        """
        sections = []
        
        # Try to split on markdown headers first
        header_pattern = r'\n(#{1,3}\s+.+?)\n'
        header_matches = list(re.finditer(header_pattern, text))
        
        if header_matches:
            # Split on markdown headers
            for i, match in enumerate(header_matches):
                title = match.group(1).strip('#').strip()
                start = match.end()
                end = header_matches[i + 1].start() if i + 1 < len(header_matches) else len(text)
                content = text[start:end].strip()
                if content:
                    sections.append((title, content))
        else:
            # Try numbered sections (1. Introduction, 2. Eligibility, etc.)
            numbered_pattern = r'\n(\d+\.?\s+[A-Z][^\n]{3,50})\n'
            numbered_matches = list(re.finditer(numbered_pattern, text))
            
            if numbered_matches and len(numbered_matches) >= 3:
                for i, match in enumerate(numbered_matches):
                    title = match.group(1).strip()
                    start = match.end()
                    end = numbered_matches[i + 1].start() if i + 1 < len(numbered_matches) else len(text)
                    content = text[start:end].strip()
                    if content:
                        sections.append((title, content))
            else:
                # Fallback: split on double newlines (paragraph breaks)
                paragraphs = text.split('\n\n')
                for i, para in enumerate(paragraphs):
                    if para.strip():
                        # Use first line or first few words as title
                        first_line = para.strip().split('\n')[0][:50]
                        sections.append((f"Section {i+1}: {first_line}", para.strip()))
        
        # If no sections found, return entire text as one section
        if not sections:
            sections = [(filename, text)]
        
        logger.info(f"Split {filename} into {len(sections)} semantic sections")
        return sections
    
    def _create_hierarchical_chunks(self, text: str, filename: str) -> List[Document]:
        """
        Create multi-level hierarchical chunks with number-aware special handling.
        
        Strategy combines:
        1. Hierarchical: document → section → paragraph levels
        2. Large overlaps: 40% overlap to preserve context
        3. Number-aware: Extra chunks around every financial number
        """
        all_docs = []
        doc_id = hashlib.md5(filename.encode()).hexdigest()[:8]
        
        # LEVEL 1: Full Document (for broad context queries)
        # Only include if document is reasonable size (< 50k chars)
        if len(text) < 50000:
            all_docs.append(Document(
                page_content=text,
                metadata={
                    "source": filename,
                    "level": "document",
                    "doc_id": doc_id,
                    "chunk": 0
                }
            ))
            logger.debug(f"Created document-level chunk for {filename} ({len(text)} chars)")
        
        # LEVEL 2: Semantic Sections (for topical context)
        sections = self._split_into_sections(text, filename)
        
        for section_idx, (section_title, section_content) in enumerate(sections):
            section_id = f"{doc_id}_s{section_idx}"
            
            # Store section if it's substantial (> 500 chars)
            if len(section_content) >= 500:
                all_docs.append(Document(
                    page_content=f"{section_title}\n\n{section_content}",
                    metadata={
                        "source": filename,
                        "level": "section",
                        "doc_id": doc_id,
                        "section_id": section_id,
                        "section_title": section_title,
                        "chunk": len(all_docs)
                    }
                ))
            
            # LEVEL 3: Paragraph chunks with LARGE OVERLAP (40%)
            # This ensures numbers never get orphaned from context
            paragraph_splitter = RecursiveCharacterTextSplitter(
                chunk_size=2000,  # Larger chunks (was 1000)
                chunk_overlap=800,  # 40% overlap (was 200/20%)
                length_function=len,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
            
            paragraph_chunks = paragraph_splitter.split_text(section_content)
            
            for para_idx, para_chunk in enumerate(paragraph_chunks):
                all_docs.append(Document(
                    page_content=para_chunk,
                    metadata={
                        "source": filename,
                        "level": "paragraph",
                        "doc_id": doc_id,
                        "section_id": section_id,
                        "section_title": section_title,
                        "para_id": f"{section_id}_p{para_idx}",
                        "chunk": len(all_docs)
                    }
                ))
            
            # LEVEL 4: NUMBER-AWARE chunks (special handling for financial data)
            # Detect all numbers and create focused chunks around them
            numbers = self._detect_numbers_in_text(section_content)
            
            if numbers:
                logger.info(f"Found {len(numbers)} numerical values in section '{section_title}'")
                
                for num_idx, num_info in enumerate(numbers):
                    # Extract context around the number (already calculated)
                    num_context = section_content[num_info['context_start']:num_info['context_end']].strip()
                    
                    # Only create number chunk if it's substantial and not redundant
                    if len(num_context) >= 100:  # Meaningful context
                        all_docs.append(Document(
                            page_content=num_context,
                            metadata={
                                "source": filename,
                                "level": "number_context",
                                "doc_id": doc_id,
                                "section_id": section_id,
                                "section_title": section_title,
                                "has_number": True,
                                "number_value": num_info['value'],
                                "number_id": f"{section_id}_n{num_idx}",
                                "chunk": len(all_docs)
                            }
                        ))
        
        # Log chunking statistics
        level_counts = {}
        for doc in all_docs:
            level = doc.metadata['level']
            level_counts[level] = level_counts.get(level, 0) + 1
        
        logger.info(f"Created {len(all_docs)} chunks for {filename}: {level_counts}")
        
        return all_docs

    def ingest_documents(self, documents: List[str], filenames: List[str]) -> Dict:
        """Ingest documents into vector store using hierarchical, overlapping, number-aware chunking."""
        try:
            # Create Document objects using hybrid chunking strategy
            all_docs = []
            
            for doc_text, filename in zip(documents, filenames):
                logger.info(f"Processing {filename} with hybrid hierarchical + number-aware chunking...")
                
                # Create multi-level chunks
                doc_chunks = self._create_hierarchical_chunks(doc_text, filename)
                all_docs.extend(doc_chunks)

            logger.info(f"Created {len(all_docs)} total chunks from {len(documents)} documents")

            # Create or update vector store in shared ChromaDB
            if self.vectorstore is None:
                logger.info("Creating new 'manuals' collection in shared ChromaDB")
                # Create collection with metadata for ChromaDB 0.5.3+
                collection_metadata = {"hnsw:space": "cosine"}
                self.vectorstore = Chroma.from_documents(
                    documents=all_docs,
                    embedding=self.embeddings,
                    client=self.chroma_client,
                    collection_name="manuals",
                    collection_metadata=collection_metadata
                )
            else:
                logger.info("Adding to existing 'manuals' collection in shared ChromaDB")
                self.vectorstore.add_documents(all_docs)

            # Build decision trees from ingested documents
            logger.info("Building decision trees from ingested documents...")
            chunks_for_tree = [
                {'text': doc.page_content, 'source': doc.metadata.get('source', 'unknown')}
                for doc in all_docs
            ]
            self.decision_tree_builder.ingest_documents(chunks_for_tree)
            
            # Initialize visualizer after trees are built
            self.tree_visualizer = TreeVisualizer(self.decision_tree_builder)
            logger.info("Tree visualizer initialized")
            
            # Visualize the tree
            tree_viz = self.decision_tree_builder.visualize_tree("dro_eligibility")
            logger.info(f"Decision tree built:\n{tree_viz}")

            return {
                "success": True,
                "documents_ingested": len(documents),
                "chunks_created": len(all_docs),
                "decision_tree_rules": len(self.decision_tree_builder.trees.get("dro_eligibility", {}) and "tree_available" or "no_tree"),
                "near_miss_rules": len(self.decision_tree_builder.near_miss_rules)
            }

        except Exception as e:
            logger.error(f"Error ingesting documents: {e}")
            raise

    def create_qa_chain(self, model_name="llama3.2", top_k=4):
        """Create QA chain with retrieval."""
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized. Please ingest documents first.")

        # Initialize LLM using provider abstraction
        llm = self.provider.initialize_llm(temperature=0.7)

        # Create custom prompt template
        prompt_template = """You are an expert financial advisor, with Riverside Money advice, with access to training manuals. You are answering questions about training manuals and procedures.
Use the following pieces of context to answer the question at the end.
If you don't know the answer based on the context provided, just say that you don't know,
don't try to make up an answer.

Context:
{context}

Question: {question}

Answer (be clear, helpful, and cite specific procedures from the manuals when relevant):"""

        PROMPT = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )

        # Create retrieval QA chain
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=self.vectorstore.as_retriever(search_kwargs={"k": top_k}),
            return_source_documents=True,
            chain_type_kwargs={"prompt": PROMPT}
        )

        return self.qa_chain


    def query(self, question: str, model_name="llama3.2", top_k=4, include_chunks=False) -> Dict:
        """Query the RAG system."""
        # Create or update QA chain
        self.create_qa_chain(model_name=model_name, top_k=top_k)

        # Get answer
        result = self.qa_chain({"query": question})

        # Extract sources
        sources = [doc.metadata.get("source", "Unknown") for doc in result["source_documents"]]
        unique_sources = list(set(sources))

        response = {
            "answer": result["result"],
            "sources": unique_sources
        }

        # Include retrieved chunks for debugging if requested
        if include_chunks:
            chunks = []
            for doc in result["source_documents"]:
                chunks.append({
                    "text": doc.page_content,
                    "source": doc.metadata.get("source", "Unknown"),
                    "chunk_id": doc.metadata.get("chunk", "N/A")
                })
            response["retrieved_chunks"] = chunks

        return response

    def analyze_question_complexity(self, question: str, model_name: str = "llama3.2") -> Dict:
        """
        Analyze the question to determine if it needs multi-step reasoning.
        Returns complexity assessment and suggested approach.
        """
        llm = Ollama(model=model_name, base_url=self.ollama_url, temperature=0.3)
        
        analysis_prompt = f"""Analyze this question and determine its complexity:

Question: "{question}"

Provide a JSON response with:
1. complexity: "simple" | "moderate" | "complex"
2. reasoning: Why you classified it this way
3. suggested_searches: List of 1-3 search queries that would help answer this
4. requires_synthesis: true/false - does it need combining multiple pieces of info?

Example:
{{
  "complexity": "complex",
  "reasoning": "Requires understanding multiple procedures and comparing them",
  "suggested_searches": ["debt prioritization criteria", "breathing space scheme eligibility"],
  "requires_synthesis": true
}}

Respond only with valid JSON:"""

        try:
            response = llm.invoke(analysis_prompt)
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                analysis = json.loads(json_match.group(1))
            else:
                # Try parsing directly
                analysis = json.loads(response)
            
            logger.info(f"Question complexity: {analysis.get('complexity', 'unknown')}")
            return analysis
        except Exception as e:
            logger.warning(f"Error analyzing question complexity: {e}")
            # Fallback to simple analysis
            return {
                "complexity": "moderate",
                "reasoning": "Could not analyze, defaulting to moderate",
                "suggested_searches": [question],
                "requires_synthesis": False
            }

    def iterative_search(self, search_queries: List[str], top_k: int = 4) -> List[Dict]:
        """
        Perform multiple searches and collect relevant context.
        """
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized")
        
        all_results = []
        seen_chunks = set()
        
        for query in search_queries:
            try:
                logger.info(f"Searching for: {query}")
                docs = self.vectorstore.similarity_search(query, k=top_k)
                
                for doc in docs:
                    # Create unique identifier for deduplication
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
                logger.error(f"Error searching for '{query}': {str(e)}")
                logger.exception(e)  # Print full traceback
                # Continue with other searches even if one fails
                continue
        
        logger.info(f"Collected {len(all_results)} unique chunks from {len(search_queries)} searches")
        return all_results

    def synthesize_answer(self, question: str, context_chunks: List[Dict], 
                         analysis: Dict, model_name: str = "llama3.2", 
                         use_tools: bool = True, max_tool_iterations: int = 3) -> Tuple[str, str, List[Dict]]:
        """
        Synthesize a final answer from gathered context with reasoning.
        Supports tool calling for numerical operations.
        
        Returns (answer, confidence_level, tool_calls)
        """
        llm = Ollama(model=model_name, base_url=self.ollama_url, temperature=0.7)
        tools = NumericalTools()
        tool_calls_made = []
        
        # Build context from chunks WITH AUTOMATIC NUMERIC ENRICHMENT
        context_text = ""
        for i, chunk in enumerate(context_chunks, 1):
            chunk_text = chunk['text']
            
            # Automatically enrich any text containing thresholds/limits
            # This makes LLMs much better at understanding numeric rules
            enrichment_result = tools.extract_and_enrich_numbers(chunk_text, include_comparisons=True)
            
            if enrichment_result.get('has_thresholds'):
                # Use enriched version if thresholds detected
                chunk_text = enrichment_result['enriched_text']
                logger.info(f"📊 Enriched chunk {i} with {len(enrichment_result['detected_thresholds'])} threshold hints")
            
            context_text += f"\n[Source {i}: {chunk['source']}]\n{chunk_text}\n"
        
        # Build tool descriptions for prompt
        tool_descriptions = ""
        if use_tools:
            tool_descriptions = "\n\nAVAILABLE TOOLS - You can use these for accurate numerical operations:\n"
            for tool in tools.get_tool_definitions():
                tool_descriptions += f"\n{tool['name']}: {tool['description']}\n"
            tool_descriptions += "\nTo use a tool, include in your response:\nTOOL_CALL: {\"tool\": \"tool_name\", \"arguments\": {\"arg1\": \"value1\"}}\n"
        
        synthesis_prompt = f"""You are an expert financial advisor at Riverside Money Advice. You have access to training manuals and have gathered relevant information to answer a question.

Original Question: {question}

Question Analysis: {analysis.get('reasoning', 'N/A')}

Relevant Context from Manuals:
{context_text}
{tool_descriptions}

Instructions:
1. Synthesize a comprehensive answer using the context provided
2. Cite specific sources when making claims (e.g., "According to [Source 1]...")
3. If the context is insufficient, clearly state what information is missing
4. Be clear, practical, and procedure-focused
5. If you need to combine information from multiple sources, explain your reasoning
6. For ANY numerical operations (adding, comparing, checking sums), USE THE TOOLS - they are more accurate than calculating in your head
7. When you see multiple numbers, consider using find_convenient_sums or detect_patterns to spot interesting relationships
8. When the question mentions a debt amount and the context mentions limits/thresholds, use check_threshold to automatically check eligibility
9. The context may include "📊 NUMERIC RULE" annotations - pay special attention to these for threshold comparisons

IMPORTANT: You MUST end your response with a confidence rating on a new line in this EXACT format:
CONFIDENCE_LEVEL: HIGH|MEDIUM|LOW
CONFIDENCE_REASON: [One sentence explaining why]

Answer:"""

        try:
            # Initial synthesis
            response = llm.invoke(synthesis_prompt)
            
            # Check for tool calls in response
            iteration = 0
            while use_tools and iteration < max_tool_iterations:
                # Look for TOOL_CALL: {...} in response
                tool_call_pattern = r'TOOL_CALL:\s*(\{[^}]+\})'
                tool_matches = re.findall(tool_call_pattern, response)
                
                if not tool_matches:
                    break  # No more tool calls
                
                # Execute each tool call
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
                                logger.info(f"💡 Injected cached threshold for '{threshold_name}': {cached_value}")
                        
                        logger.info(f"🔧 Executing tool: {tool_name} with args: {arguments}")
                        result = tools.execute_tool(tool_name, arguments)
                        
                        tool_calls_made.append({
                            "tool": tool_name,
                            "arguments": arguments,
                            "result": result
                        })
                        
                        tool_results.append(f"\nTool Result ({tool_name}): {json.dumps(result, indent=2)}\n")
                        
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse tool call JSON: {tool_json_str}")
                        continue
                
                if not tool_results:
                    break
                
                # Continue synthesis with tool results
                continuation_prompt = f"""{response}

The tools have provided these results:
{''.join(tool_results)}

Now continue your answer using these accurate calculations. Remember to end with:
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
            
            # If no match found, try to infer from context
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
            
            # Clean up any remaining TOOL_CALL: markers from answer
            answer = re.sub(r'TOOL_CALL:\s*\{[^}]+\}', '', answer).strip()
            
            confidence = f"{confidence_level} - {confidence_reason}"
            return answer, confidence, tool_calls_made
            
        except Exception as e:
            logger.error(f"Error synthesizing answer: {e}")
            logger.exception(e)
            return f"Error generating answer: {str(e)}", "LOW - Error occurred", []

    def agentic_query(self, question: str, model_name: str = "llama3.2", 
                     max_iterations: int = 3, top_k: int = 4, show_reasoning: bool = True) -> Dict:
        """
        Perform agentic query with iterative reasoning and refinement.
        
        Process:
        1. Analyze question complexity
        2. Plan search strategy
        3. Iteratively search and gather context
        4. Synthesize final answer with confidence
        """
        reasoning_steps = []
        
        # Step 1: Analyze the question
        logger.info(f"🤔 Analyzing question: {question}")
        analysis = self.analyze_question_complexity(question, model_name)
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "analysis",
                "description": "Question complexity analysis",
                "result": analysis
            })
        
        # Step 2: Determine search strategy
        search_queries = analysis.get("suggested_searches", [question])
        complexity = analysis.get("complexity", "moderate")
        
        # Adjust iterations based on complexity
        if complexity == "simple":
            iterations = 1
            search_queries = search_queries[:1]
        elif complexity == "complex":
            iterations = min(max_iterations, len(search_queries))
        else:
            iterations = min(2, max_iterations)
        
        logger.info(f"📋 Plan: {iterations} iteration(s) with {len(search_queries)} search(es)")
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "planning",
                "description": "Search strategy",
                "result": {
                    "complexity": complexity,
                    "iterations": iterations,
                    "searches": search_queries
                }
            })
        
        # Step 3: Iterative search and context gathering
        logger.info(f"🔍 Starting iterative search...")
        context_chunks = self.iterative_search(search_queries[:iterations], top_k)
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "retrieval",
                "description": "Context gathering",
                "result": {
                    "chunks_found": len(context_chunks),
                    "sources": list(set(chunk["source"] for chunk in context_chunks))
                }
            })
        
        # Step 4: Synthesize answer (with optional tool calling)
        logger.info(f"💡 Synthesizing answer from {len(context_chunks)} context chunks...")
        answer, confidence, tool_calls = self.synthesize_answer(
            question, context_chunks, analysis, model_name, 
            use_tools=True, max_tool_iterations=3
        )
        
        # Extract unique sources
        unique_sources = list(set(chunk["source"] for chunk in context_chunks))
        
        response = {
            "answer": answer,
            "sources": unique_sources,
            "iterations_used": iterations,
            "confidence": confidence
        }
        
        # Add tool calls if any were made
        if tool_calls:
            response["tool_calls"] = tool_calls
            logger.info(f"🔧 Made {len(tool_calls)} tool calls for numerical operations")
        
        if show_reasoning:
            response["reasoning_steps"] = reasoning_steps
        
        logger.info(f"✅ Agentic query complete. Confidence: {confidence}")
        return response

    def symbolic_agentic_query(self, question: str, model_name: str = "llama3.2",
                               max_iterations: int = 3, top_k: int = 4, 
                               show_reasoning: bool = True) -> Dict:
        """
        Perform agentic query with SYMBOLIC REASONING for numerical queries.
        
        This is a two-phase approach:
        Phase 1: Symbolic Reasoning
          - Replace numbers with placeholders: "£60,000" → "[DEBT_AMOUNT]"
          - Symbolize manual text: "£50,000 limit" → "AMOUNT(£50,000, name=DRO_LIMIT)"
          - LLM reasons symbolically: "IF [DEBT_AMOUNT] > AMOUNT(..., name=DRO_LIMIT)"
          
        Phase 2: Numerical Computation & Substitution
          - Extract comparisons from symbolic reasoning
          - Compute exact numerical results
          - Substitute values back into natural language
        
        This prevents LLM math errors and makes reasoning explicit.
        """
        reasoner = SymbolicReasoner()
        reasoning_steps = []
        
        # PHASE 1: SYMBOLIZATION
        logger.info("🔢 Phase 1: Symbolic Reasoning")
        
        # Symbolize the question
        symbolic_question, question_vars = reasoner.symbolize_question(question)
        logger.info(f"Symbolized question: {symbolic_question}")
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "symbolization",
                "description": "Replace numbers in question with symbolic variables",
                "original_question": question,
                "symbolic_question": symbolic_question,
                "variables": {name: var.value for name, var in question_vars.items()}
            })
        
        # Analyze complexity
        analysis = self.analyze_question_complexity(symbolic_question, model_name)
        
        # Search and gather context
        search_queries = analysis.get("suggested_searches", [symbolic_question])
        complexity = analysis.get("complexity", "moderate")
        
        if complexity == "simple":
            iterations = 1
        elif complexity == "complex":
            iterations = min(max_iterations, len(search_queries))
        else:
            iterations = min(2, max_iterations)
        
        logger.info(f"🔍 Retrieving context...")
        context_chunks = self.iterative_search(search_queries[:iterations], top_k)
        
        # Symbolize manual text
        symbolized_context = []
        for chunk in context_chunks:
            symbolized_text = reasoner.symbolize_manual_text(
                chunk['text'], 
                source_name=chunk['source']
            )
            symbolized_context.append({
                **chunk,
                'symbolized_text': symbolized_text
            })
        
        logger.info(f"📝 Symbolized {len(symbolized_context)} context chunks")
        
        if show_reasoning:
            reasoning_steps.append({
                "step": "context_symbolization",
                "description": "Replace numbers in manuals with AMOUNT() notation",
                "chunks_symbolized": len(symbolized_context),
                "sample_symbolization": symbolized_context[0]['symbolized_text'][:300] if symbolized_context else None
            })
        
        # Build symbolic prompt for LLM
        context_text = ""
        for i, chunk in enumerate(symbolized_context, 1):
            context_text += f"\n[Source {i}: {chunk['source']}]\n{chunk['symbolized_text']}\n"
        
        # List actual variables available
        question_var_list = list(question_vars.keys())
        example_var = question_var_list[0] if question_var_list else "AMOUNT_1"
        
        symbolic_prompt = f"""You are a financial advisor reasoning about debt solutions using symbolic notation.

SYMBOLIC QUESTION: {symbolic_question}

THE QUESTION CONTAINS THESE VARIABLES - USE THESE EXACT NAMES:
{', '.join(f'[{name}]' for name in question_vars.keys())}

SYMBOLIZED MANUAL CONTEXT (contains limits as [LIMIT_N]):
{context_text}

INSTRUCTIONS:

Your job is to compare the question's variables to the limits in the manual.

For EACH relevant eligibility condition you find in the manual:
1. Identify which [LIMIT_N] from the manual applies
2. Write a comparison using the question variable and that limit
3. Explain what it checks

REQUIRED FORMAT FOR EACH COMPARISON:
COMPARISON: [{example_var}] operator [LIMIT_N]
Explanation: This checks if...

Where:
- [{example_var}] is the variable from the question (use the EXACT name shown above)
- operator is: > or < or >= or <= or == or !=
- [LIMIT_N] is a limit placeholder from the manual (like [LIMIT_1], [LIMIT_2], etc.)

EXAMPLE (if question has [AMOUNT_1] and manual has [LIMIT_1] for DRO debt limit):
COMPARISON: [AMOUNT_1] > [LIMIT_1]
Explanation: This checks if the client's debt exceeds the maximum DRO debt limit.

Now write your comparisons and conclusion:"""

        logger.info("🤖 Getting symbolic reasoning from LLM...")
        llm = Ollama(model=model_name, base_url=self.ollama_url, temperature=0.3)
        
        try:
            symbolic_reasoning = llm.invoke(symbolic_prompt)
            logger.info(f"Symbolic reasoning length: {len(symbolic_reasoning)} chars")
            logger.info(f"Symbolic reasoning output:\n{symbolic_reasoning}")  # Log full output for debugging
            
            if show_reasoning:
                reasoning_steps.append({
                    "step": "symbolic_reasoning",
                    "description": "LLM reasons with symbolic notation",
                    "reasoning": symbolic_reasoning[:1000]  # Truncate for readability
                })
            
            # PHASE 2: NUMERICAL COMPUTATION
            logger.info("🧮 Phase 2: Numerical Computation")
            
            # Extract comparisons from symbolic reasoning
            comparisons = reasoner.extract_comparisons(symbolic_reasoning)
            logger.info(f"Extracted {len(comparisons)} comparisons from symbolic reasoning")
            
            # Compute numerical results
            reasoner.compute_results()
            
            if show_reasoning:
                reasoning_steps.append({
                    "step": "comparison_extraction",
                    "description": "Extract and compute numerical comparisons",
                    "comparisons": [
                        {
                            "expression": f"{c.left} {c.operator} {c.right}",
                            "result": c.result,
                            "left_value": reasoner._resolve_value(c.left),
                            "right_value": reasoner._resolve_value(c.right)
                        }
                        for c in comparisons
                    ]
                })
            
            # Substitute values back
            final_answer = reasoner.substitute_back(symbolic_reasoning)
            
            # Get reasoning summary
            summary = reasoner.get_reasoning_summary()
            
            logger.info("✅ Symbolic reasoning complete")
            logger.info(f"Variables: {list(summary['variables'].keys())}")
            logger.info(f"Comparisons: {summary['total_comparisons']} total, {summary['successful_computations']} computed")
            
            # Extract unique sources
            unique_sources = list(set(chunk["source"] for chunk in context_chunks))
            
            # Determine confidence based on computation success
            if summary['successful_computations'] == summary['total_comparisons'] and summary['total_comparisons'] > 0:
                confidence = "HIGH - All numerical comparisons computed successfully"
            elif summary['successful_computations'] > 0:
                confidence = "MEDIUM - Some numerical comparisons computed"
            else:
                confidence = "LOW - No numerical comparisons could be computed"
            
            response = {
                "answer": final_answer,
                "sources": unique_sources,
                "iterations_used": iterations,
                "confidence": confidence,
                "symbolic_reasoning_summary": summary
            }
            
            if show_reasoning:
                response["reasoning_steps"] = reasoning_steps
            
            return response
            
        except Exception as e:
            logger.error(f"Error in symbolic reasoning: {e}")
            logger.exception(e)
            # Fallback to regular agentic query
            logger.warning("Falling back to regular agentic query")
            return self.agentic_query(question, model_name, max_iterations, top_k, show_reasoning)

    def integrated_eligibility_check(self, question: str, client_values: Dict[str, float],
                                     topic: str = "dro_eligibility", model_name: str = "llama3.2",
                                     include_diagram: bool = False) -> Dict:
        """
        Integrated eligibility check combining RAG semantic search with decision tree evaluation.
        
        This provides:
        1. Natural language answer from RAG (context-aware)
        2. Structured criteria breakdown (pass/fail/near-miss/unknown)
        3. Near-miss opportunities with remediation strategies
        4. Optional visual diagram
        
        Returns complete picture for advisor/client UI.
        """
        logger.info(f"🔍 Integrated eligibility check: {question}")
        logger.info(f"Client values: {client_values}")
        logger.info(f"Topic: {topic}")
        
        # Step 1: Get natural language answer from RAG
        try:
            rag_result = self.agentic_query(
                question=question,
                model_name=model_name,
                max_iterations=2,
                top_k=5,
                show_reasoning=False
            )
            answer = rag_result["answer"]
            sources = rag_result["sources"]
        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            answer = "Unable to retrieve contextual answer"
            sources = []
        
        # Step 2: Run decision tree evaluation
        tree = self.decision_tree_builder.trees.get(topic)
        if not tree:
            logger.warning(f"No decision tree available for topic: {topic}")
            return {
                "answer": answer,
                "overall_result": "unknown",
                "confidence": 0.0,
                "criteria": [],
                "near_misses": [],
                "recommendations": [],
                "sources": sources,
                "error": f"No decision tree for topic: {topic}"
            }
        
        # Traverse the tree
        path = self.decision_tree_builder.traverse_tree(tree, client_values)
        
        # Step 3: Build criteria breakdown
        criteria = []
        provided_variables = set(client_values.keys())
        
        # Extract all thresholds from the tree
        all_thresholds = self._extract_tree_thresholds(tree)
        
        for threshold_info in all_thresholds:
            criterion_name = threshold_info["variable"]
            threshold_value = threshold_info["threshold"]
            operator = threshold_info["operator"]
            threshold_name = threshold_info.get("threshold_name", f"{criterion_name}_limit")
            
            client_value = client_values.get(criterion_name)
            
            if client_value is None:
                # Client didn't provide this value
                status = "unknown"
                gap = None
                explanation = f"Not provided - needed to check {threshold_name}"
            else:
                # Evaluate criterion
                passes = self._evaluate_criterion(client_value, operator, threshold_value)
                
                # Check for near-miss
                near_miss_threshold = self._find_near_miss_for_criterion(criterion_name, threshold_value)
                is_near_miss = False
                gap = None
                
                if near_miss_threshold:
                    tolerance = near_miss_threshold.tolerance_absolute or 0
                    if operator in ["<=", "<"]:
                        # Client should be under limit
                        if client_value > threshold_value and client_value <= threshold_value + tolerance:
                            is_near_miss = True
                            gap = client_value - threshold_value
                    elif operator in [">=", ">"]:
                        # Client should be over limit
                        if client_value < threshold_value and client_value >= threshold_value - tolerance:
                            is_near_miss = True
                            gap = threshold_value - client_value
                
                if is_near_miss:
                    status = "near_miss"
                    explanation = f"Within £{abs(gap):,.2f} of threshold - remediation possible"
                elif passes:
                    status = "eligible"
                    explanation = f"Meets requirement: {criterion_name} {operator} £{threshold_value:,.2f}"
                else:
                    gap = abs(client_value - threshold_value)
                    status = "not_eligible"
                    explanation = f"Does not meet: {criterion_name} {operator} £{threshold_value:,.2f} (gap: £{gap:,.2f})"
            
            criteria.append({
                "criterion": criterion_name,
                "threshold_name": threshold_name,
                "threshold_value": threshold_value,
                "client_value": client_value,
                "status": status,
                "gap": gap,
                "operator": operator,
                "explanation": explanation
            })
        
        # Step 4: Compile near-misses and recommendations
        near_misses = []
        recommendations = []
        
        for nm in path.near_misses:
            near_miss_info = {
                "threshold_name": nm.threshold_name,
                "threshold_value": nm.threshold_value,
                "tolerance": nm.tolerance_absolute,
                "strategies": [
                    {
                        "description": s.description,
                        "actions": s.actions,
                        "likelihood": s.likelihood,
                        "source": s.source
                    }
                    for s in nm.strategies
                ]
            }
            near_misses.append(near_miss_info)
            
            # Add recommendations
            for strategy in nm.strategies:
                recommendations.append({
                    "type": "remediation",
                    "priority": "high" if strategy.likelihood == "high" else "medium",
                    "action": strategy.description,
                    "steps": strategy.actions
                })
        
        # Add gap-specific recommendations
        for crit in criteria:
            if crit["status"] == "near_miss" and crit["gap"]:
                recommendations.append({
                    "type": "near_miss_action",
                    "priority": "high",
                    "action": f"Reduce {crit['criterion']} by £{crit['gap']:,.2f} to meet {crit['threshold_name']}",
                    "steps": [f"Current: £{crit['client_value']:,.2f}", f"Target: £{crit['threshold_value']:,.2f}"]
                })
        
        # Step 5: Generate diagram if requested
        diagram = None
        if include_diagram and self.tree_visualizer:
            try:
                config = VisualizationConfig(format="mermaid", show_near_misses=True)
                diagram = self.tree_visualizer.generate_path_diagram(client_values, topic, config)["diagram"]
            except Exception as e:
                logger.error(f"Failed to generate diagram: {e}")
        
        # Determine overall result
        statuses = [c["status"] for c in criteria]
        if "not_eligible" in statuses:
            overall_result = "not_eligible"
        elif "near_miss" in statuses:
            overall_result = "requires_review"
        elif "unknown" in statuses:
            overall_result = "incomplete_information"
        else:
            overall_result = "eligible"
        
        return {
            "answer": answer,
            "overall_result": overall_result,
            "confidence": path.confidence,
            "criteria": criteria,
            "near_misses": near_misses,
            "recommendations": recommendations,
            "sources": sources,
            "diagram": diagram
        }
    
    def _extract_tree_thresholds(self, node, visited=None, thresholds=None):
        """Extract all threshold checks from a decision tree"""
        if visited is None:
            visited = set()
        if thresholds is None:
            thresholds = []
        
        if node.id in visited:
            return thresholds
        visited.add(node.id)
        
        if node.type == NodeType.CONDITION:
            thresholds.append({
                "variable": node.variable,
                "operator": node.operator.value,
                "threshold": node.threshold,
                "threshold_name": node.threshold_name
            })
            
            if node.near_miss_branch:
                self._extract_tree_thresholds(node.near_miss_branch, visited, thresholds)
            if node.true_branch:
                self._extract_tree_thresholds(node.true_branch, visited, thresholds)
            if node.false_branch:
                self._extract_tree_thresholds(node.false_branch, visited, thresholds)
        
        return thresholds
    
    def _evaluate_criterion(self, value: float, operator: str, threshold: float) -> bool:
        """Evaluate a single criterion"""
        if operator == "<=":
            return value <= threshold
        elif operator == "<":
            return value < threshold
        elif operator == ">=":
            return value >= threshold
        elif operator == ">":
            return value > threshold
        elif operator == "==":
            return abs(value - threshold) < 0.01
        elif operator == "!=":
            return abs(value - threshold) >= 0.01
        return False
    
    def _find_near_miss_for_criterion(self, variable: str, threshold: float):
        """Find near-miss rule for a specific criterion"""
        for rule in self.decision_tree_builder.near_miss_rules:
            if variable in rule.threshold_name.lower() and abs(rule.threshold_value - threshold) < 0.01:
                return rule
        return None

    def get_stats(self) -> Dict:
        """Get vector store statistics."""
        if self.vectorstore is None:
            return {"total_chunks": 0, "status": "not_initialized"}

        try:
            collection = self.vectorstore._collection
            count = collection.count()
            return {
                "total_chunks": count,
                "collection_name": "manuals",
                "status": "ready"
            }
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {"error": str(e)}

    def get_all_documents(self, limit: int = 100, offset: int = 0, source_filter: Optional[str] = None) -> Dict:
        """Get all documents from vector store for debugging."""
        if self.vectorstore is None:
            return {"documents": [], "total": 0, "status": "not_initialized"}

        try:
            collection = self.vectorstore._collection
            
            # Get all items
            results = collection.get(
                limit=limit,
                offset=offset,
                include=["documents", "metadatas"]
            )
            
            documents = []
            for i, (doc_id, text, metadata) in enumerate(zip(
                results.get("ids", []),
                results.get("documents", []),
                results.get("metadatas", [])
            )):
                # Apply source filter if provided
                if source_filter and source_filter.lower() not in metadata.get("source", "").lower():
                    continue
                    
                documents.append({
                    "id": doc_id,
                    "text": text,
                    "source": metadata.get("source", "Unknown"),
                    "chunk": metadata.get("chunk", "N/A"),
                    "preview": text[:200] + "..." if len(text) > 200 else text
                })
            
            return {
                "documents": documents,
                "total": collection.count(),
                "limit": limit,
                "offset": offset,
                "status": "ready"
            }
        except Exception as e:
            logger.error(f"Error getting documents: {e}")
            return {"error": str(e), "documents": [], "total": 0}


# Initialize service
rag_service = RAGService()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "RAG Service - Ask the Manuals",
        "status": "healthy",
        "vectorstore_ready": rag_service.vectorstore is not None,
        "endpoints": {
            "/query": "POST - Query the manuals",
            "/ingest": "POST - Ingest new documents (text/markdown)",
            "/ingest-pdf": "POST - Ingest a single PDF file",
            "/ingest-all-manuals": "POST - Ingest all PDFs from /manuals directory",
            "/stats": "GET - Get vector store statistics",
            "/debug/documents": "GET - View all stored chunks (for debugging)",
            "/debug/sources": "GET - List all source documents",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint with LangGraph agent status."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "vectorstore_ready": rag_service.vectorstore is not None,
        "langgraph_enabled": USE_LANGGRAPH,
        "agent_loaded": rag_service.agent_app is not None,
        "thresholds_cached": len(rag_service.threshold_cache),
        "decision_trees": len(rag_service.decision_tree_builder.trees) if rag_service.decision_tree_builder else 0,
        "mode": "langgraph" if (USE_LANGGRAPH and rag_service.agent_app) else "legacy"
    }


@app.get("/stats")
async def get_stats():
    """Get vector store statistics."""
    return rag_service.get_stats()


@app.post("/query", response_model=QueryResponse)
async def query_manuals(request: QueryRequest):
    """Query the training manuals."""
    if rag_service.vectorstore is None:
        raise HTTPException(
            status_code=503,
            detail="Vector store not initialized. Please ingest manuals first."
        )

    try:
        # Include chunks for debugging if requested
        include_chunks = request.top_k > 0
        result = rag_service.query(
            question=request.question,
            model_name=request.model,
            top_k=request.top_k,
            include_chunks=include_chunks
        )
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"],
            retrieved_chunks=result.get("retrieved_chunks")
        )
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.post("/eligibility-check", response_model=EligibilityResponse)
async def check_eligibility(request: EligibilityRequest):
    """
    Integrated eligibility check combining RAG + Decision Tree.
    
    Supports TWO modes:
    1. **Manual Input (Hypothetical)**: Provide debt/income/assets directly
       - Use case: "Ask the Manuals" tab - hypothetical scenarios
       - Example: "What if someone has £51k debt?"
    
    2. **Client Documents (RAG)**: Provide client_id to extract values from documents
       - Use case: "Client Document Search" - real client assessment
       - Values extracted automatically from uploaded documents
    
    This endpoint provides:
    - Natural language answer from manuals
    - Structured breakdown of eligibility criteria
    - Color-coded status (eligible/not_eligible/near_miss/unknown)
    - Near-miss opportunities with remediation strategies
    - Optional Mermaid diagram for visualization
    
    Perfect for client-facing UIs showing:
    ✅ Criteria met
    ❌ Criteria failed
    ⚠️  Near-misses (actionable opportunities)
    ❓ Missing information
    
    Example 1 (Manual Input):
    ```json
    {
      "question": "Can someone with £51k debt get a DRO?",
      "debt": 51000,
      "income": 70,
      "assets": 1500,
      "topic": "dro_eligibility"
    }
    ```
    
    Example 2 (Client Documents):
    ```json
    {
      "question": "Is this client eligible for a DRO?",
      "client_id": "CLIENT123",
      "topic": "dro_eligibility"
    }
    ```
    
    Returns:
    ```json
    {
      "answer": "Based on the manual...",
      "overall_result": "requires_review",
      "confidence": 0.85,
      "criteria": [
        {
          "criterion": "debt",
          "status": "near_miss",
          "threshold_value": 50000,
          "client_value": 51000,
          "gap": 1000,
          "explanation": "Within £1,000 of threshold - remediation possible"
        }
      ],
      "near_misses": [...],
      "recommendations": [...]
    }
    ```
    """
    if rag_service.vectorstore is None:
        raise HTTPException(
            status_code=503,
            detail="Vector store not initialized. Please ingest manuals first."
        )
    
    try:
        # Build client values dict
        client_values = {}
        
        # Mode 1: Client document extraction
        if request.client_id:
            logger.info(f"🔍 Eligibility check MODE: Client Documents (client_id={request.client_id})")
            
            # Query client documents to extract values
            if hasattr(rag_service, 'client_vectorstores') and request.client_id in rag_service.client_vectorstores:
                # Extract numeric values from client documents using symbolic reasoning
                extraction_query = f"""
                Extract the following information from the client's documents:
                - Total debt amount
                - Monthly income
                - Total assets value
                
                Format: debt=£X, income=£Y, assets=£Z
                """
                
                try:
                    client_vectorstore = rag_service.client_vectorstores[request.client_id]
                    results = client_vectorstore.query(
                        query_texts=[extraction_query],
                        n_results=5
                    )
                    
                    # Parse extracted values using symbolic reasoning
                    if results and 'documents' in results and results['documents']:
                        context = "\n".join(results['documents'][0])
                        logger.info(f"📄 Client document context: {context[:200]}...")
                        
                        # Use symbolic reasoning to extract exact values
                        symbolic_result = rag_service.symbolic_reasoning.extract_and_compute(
                            question=extraction_query,
                            manual_text=context,
                            model_name=request.model
                        )
                        
                        # Parse extracted values from symbolic result
                        if symbolic_result.get('comparisons'):
                            for comp in symbolic_result['comparisons']:
                                # Look for debt, income, assets
                                if 'debt' in comp.get('role_1', '').lower():
                                    client_values['debt'] = comp.get('actual_value_1')
                                elif 'income' in comp.get('role_1', '').lower():
                                    client_values['income'] = comp.get('actual_value_1')
                                elif 'assets' in comp.get('role_1', '').lower():
                                    client_values['assets'] = comp.get('actual_value_1')
                        
                        logger.info(f"✅ Extracted client values: {client_values}")
                except Exception as e:
                    logger.warning(f"Could not extract values from client documents: {e}")
                    # Continue with empty values - will show as "unknown" status
            else:
                logger.warning(f"Client {request.client_id} not found in vectorstore")
        
        # Mode 2: Manual input (fallback or primary if no client_id)
        else:
            logger.info(f"🔍 Eligibility check MODE: Manual Input")
            if request.debt is not None:
                client_values['debt'] = request.debt
            if request.income is not None:
                client_values['income'] = request.income
            if request.assets is not None:
                client_values['assets'] = request.assets
        
        logger.info(f"❓ Question: {request.question}")
        logger.info(f"📊 Final client values: {client_values}")

        # NEW: Use LangGraph agent if available
        if USE_LANGGRAPH and rag_service.agent_app is not None:
            logger.info("   Using LangGraph agent workflow for eligibility check")

            # Create initial state WITH client_values (triggers tree evaluation)
            initial_state = create_initial_state(
                question=request.question,
                ollama_url=rag_service.ollama_url,
                model_name=request.model,
                top_k=4,
                max_tool_iterations=3,
                show_reasoning=True,
                client_values=client_values if client_values else None,
                topic=request.topic
            )

            # Generate unique thread ID
            config = {"configurable": {"thread_id": str(uuid.uuid4())}}

            # INVOKE THE AGENT (includes decision tree evaluation automatically)
            result_state = rag_service.agent_app.invoke(initial_state, config)

            # Extract response (includes tree results)
            tree_path = result_state.get("tree_path", {})

            # Generate diagram if requested
            diagram = None
            if request.include_diagram and result_state.get("tree_path"):
                # TODO: Integrate tree_visualizer
                pass

            return EligibilityResponse(
                answer=result_state.get("answer", ""),
                overall_result=tree_path.get("result", "unknown").lower(),
                confidence=result_state.get("confidence", 0.5),
                criteria=result_state.get("criteria_breakdown", []),
                near_misses=result_state.get("near_misses", []),
                recommendations=result_state.get("recommendations", []),
                sources=result_state.get("sources", []),
                diagram=diagram
            )

        # FALLBACK: Use legacy implementation
        else:
            logger.info("   Using legacy implementation for eligibility check")
            result = rag_service.integrated_eligibility_check(
                question=request.question,
                client_values=client_values,
                topic=request.topic,
                model_name=request.model,
                include_diagram=request.include_diagram
            )

            return EligibilityResponse(**result)

    except Exception as e:
        logger.error(f"Error in eligibility check: {e}")
        logger.exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agentic-query", response_model=AgenticQueryResponse)
async def agentic_query_manuals(request: AgenticQueryRequest):
    """
    Query the training manuals using agentic reasoning.

    MIGRATED TO LANGGRAPH (Phase 1 Complete)

    This endpoint now uses LangGraph-powered multi-step reasoning:
    1. Analyze the question complexity (agent_nodes.analyze_node)
    2. Plan optimal search strategy (automatic routing)
    3. Iteratively gather relevant context (agent_nodes.retrieval_node)
    4. Apply symbolic reasoning if needed (agent_nodes.symbolic_reasoning_node)
    5. Synthesize comprehensive answer (agent_nodes.synthesis_node)

    Benefits over legacy implementation:
    - 52% less orchestration code
    - Automatic tool execution (no regex parsing)
    - Type-safe state management
    - Better error recovery with checkpointing

    Best for: Complex questions requiring synthesis of multiple sources
    """
    if rag_service.vectorstore is None:
        raise HTTPException(
            status_code=503,
            detail="Vector store not initialized. Please ingest manuals first."
        )

    try:
        logger.info(f"🤖 Agentic query: {request.question}")

        # NEW: Use LangGraph agent if available
        if USE_LANGGRAPH and rag_service.agent_app is not None:
            logger.info("   Using LangGraph agent workflow")

            # Create initial state
            initial_state = create_initial_state(
                question=request.question,
                ollama_url=rag_service.ollama_url,
                model_name=request.model,
                top_k=request.top_k,
                max_tool_iterations=request.max_iterations,
                show_reasoning=request.show_reasoning
            )

            # Generate unique thread ID for checkpointing
            config = {"configurable": {"thread_id": str(uuid.uuid4())}}

            # INVOKE THE AGENT (replaces 500+ lines of manual orchestration!)
            result_state = rag_service.agent_app.invoke(initial_state, config)

            # Convert state to response format
            response_dict = state_to_response(result_state, include_reasoning=request.show_reasoning)

            return AgenticQueryResponse(
                answer=response_dict["answer"],
                sources=response_dict.get("sources", []),
                reasoning_steps=response_dict.get("reasoning_steps"),
                iterations_used=response_dict.get("iterations_used", 0),
                confidence=response_dict["confidence"]
            )

        # FALLBACK: Use legacy implementation if LangGraph not enabled/available
        else:
            logger.info("   Using legacy implementation")
            result = rag_service.agentic_query(
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
        logger.error(f"Error in agentic query: {e}")
        logger.exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/symbolic-query")
async def symbolic_query_manuals(request: AgenticQueryRequest):
    """
    Query manuals using SYMBOLIC REASONING for numerical accuracy.
    
    This endpoint implements a two-phase approach for questions involving numbers:
    
    Phase 1 - Symbolic Reasoning:
      • Replaces numbers with placeholders: "£60,000" → "[DEBT_AMOUNT]"
      • Symbolizes manual text: "£50,000 limit" → "AMOUNT(£50,000, name=DRO_LIMIT)"
      • LLM reasons symbolically: "IF [DEBT_AMOUNT] > AMOUNT(..., name=DRO_LIMIT)"
    
    Phase 2 - Numerical Computation:
      • Extracts comparison statements from symbolic reasoning
      • Computes exact numerical results (60000 > 50000 = True)
      • Substitutes values back into natural language
    
    Benefits:
      • Prevents LLM arithmetic errors
      • Makes reasoning explicit and verifiable
      • Separates logic from calculation
      • Provides exact numerical comparisons
    
    Best for: Eligibility checks, threshold comparisons, financial calculations
    """
    if rag_service.vectorstore is None:
        raise HTTPException(
            status_code=503,
            detail="Vector store not initialized. Please ingest manuals first."
        )

    try:
        logger.info(f"🔢 Symbolic query: {request.question}")
        result = rag_service.symbolic_agentic_query(
            question=request.question,
            model_name=request.model,
            max_iterations=request.max_iterations,
            top_k=request.top_k,
            show_reasoning=request.show_reasoning
        )
        
        return result  # Return as dict since it includes symbolic_reasoning_summary
    
    except Exception as e:
        logger.error(f"Error in symbolic query: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing agentic query: {str(e)}")
        logger.exception(e)  # Print full traceback
        raise HTTPException(status_code=500, detail=f"Error processing agentic query: {str(e)}")


@app.post("/ingest")
async def ingest_documents(request: IngestRequest):
    """Ingest documents into the vector store."""
    if len(request.documents) != len(request.filenames):
        raise HTTPException(
            status_code=400,
            detail="Number of documents must match number of filenames"
        )

    try:
        result = rag_service.ingest_documents(
            documents=request.documents,
            filenames=request.filenames
        )
        return result
    except Exception as e:
        logger.error(f"Error ingesting documents: {e}")
        raise HTTPException(status_code=500, detail=f"Error ingesting documents: {str(e)}")


@app.post("/ingest-pdf")
async def ingest_pdf_file(file: UploadFile = File(...)):
    """Ingest a PDF file directly into the vector store."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = Path(tmp_file.name)
        
        logger.info(f"Processing PDF: {file.filename} ({len(content)} bytes)")
        
        # Extract text from PDF
        extracted_text = rag_service.extract_text_from_pdf(tmp_path)
        
        # Clean up temp file
        tmp_path.unlink()
        
        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail=f"Could not extract meaningful text from PDF. Extracted only {len(extracted_text)} characters."
            )
        
        logger.info(f"Extracted {len(extracted_text)} characters from {file.filename}")
        
        # Ingest the extracted text
        result = rag_service.ingest_documents(
            documents=[extracted_text],
            filenames=[file.filename]
        )
        
        result["extracted_text_length"] = len(extracted_text)
        result["extraction_preview"] = extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting PDF: {e}")
        # Clean up temp file on error
        if 'tmp_path' in locals() and tmp_path.exists():
            tmp_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error ingesting PDF: {str(e)}")


@app.post("/ingest-all-manuals")
async def ingest_all_manuals():
    """Ingest all PDF files from the manuals directory."""
    manuals_path = Path(rag_service.manuals_directory)
    
    if not manuals_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Manuals directory not found: {manuals_path}"
        )
    
    pdf_files = list(manuals_path.glob("*.pdf"))
    
    if not pdf_files:
        raise HTTPException(
            status_code=404,
            detail=f"No PDF files found in {manuals_path}"
        )
    
    logger.info(f"Found {len(pdf_files)} PDF files to ingest")
    
    results = {
        "total_files": len(pdf_files),
        "successful": 0,
        "failed": 0,
        "details": []
    }
    
    for pdf_file in pdf_files:
        try:
            logger.info(f"Processing {pdf_file.name}...")
            
            # Extract text
            extracted_text = rag_service.extract_text_from_pdf(pdf_file)
            
            if not extracted_text or len(extracted_text.strip()) < 50:
                results["failed"] += 1
                results["details"].append({
                    "filename": pdf_file.name,
                    "status": "failed",
                    "reason": "Could not extract meaningful text",
                    "extracted_length": len(extracted_text)
                })
                continue
            
            # Ingest the document
            ingest_result = rag_service.ingest_documents(
                documents=[extracted_text],
                filenames=[pdf_file.name]
            )
            
            results["successful"] += 1
            results["details"].append({
                "filename": pdf_file.name,
                "status": "success",
                "extracted_length": len(extracted_text),
                "chunks_created": ingest_result.get("chunks_created", 0)
            })
            
        except Exception as e:
            logger.error(f"Error processing {pdf_file.name}: {e}")
            results["failed"] += 1
            results["details"].append({
                "filename": pdf_file.name,
                "status": "failed",
                "reason": str(e)
            })
    
    return results


# Decision Tree Endpoints

class DecisionTreeRequest(BaseModel):
    """Request for decision tree eligibility check"""
    debt: Optional[float] = None
    income: Optional[float] = None
    assets: Optional[float] = None
    topic: str = "dro_eligibility"


@app.post("/decision-tree/check")
async def check_eligibility_decision_tree(request: DecisionTreeRequest):
    """
    Check eligibility using the dynamically-built decision tree.
    
    This endpoint:
    1. Uses rules extracted from manuals during ingestion
    2. Traverses decision tree with client values
    3. Detects near-miss scenarios (e.g., £51k debt when limit is £50k)
    4. Provides remediation strategies for near-misses
    5. Shows the exact path through the decision tree
    
    Example:
    ```
    POST /decision-tree/check
    {
        "debt": 51000,
        "income": 70,
        "assets": 1500,
        "topic": "dro_eligibility"
    }
    
    Response:
    {
        "result": "requires_review",
        "confidence": 0.7,
        "near_misses": [
            {
                "threshold_name": "debt_limit",
                "threshold_value": 50000,
                "tolerance": 2000,
                "gap": 1000
            }
        ],
        "strategies": [
            {
                "description": "Pay down £1,000 to bring debt below £50,000 limit",
                "actions": ["pay down debt", "negotiate with creditors"],
                "likelihood": "high"
            }
        ]
    }
    ```
    """
    try:
        client_values = {}
        if request.debt is not None:
            client_values['debt'] = request.debt
        if request.income is not None:
            client_values['income'] = request.income
        if request.assets is not None:
            client_values['assets'] = request.assets
        
        advice = rag_service.decision_tree_builder.get_advice(client_values, request.topic)
        
        return advice
        
    except Exception as e:
        logger.error(f"Error in decision tree check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/decision-tree/visualize")
async def visualize_decision_tree(topic: str = "dro_eligibility"):
    """
    Get a text visualization of the decision tree.
    
    Shows the tree structure with:
    - Conditions (debt <= 50000)
    - Near-miss branches (~NEAR~)
    - Pass/fail outcomes (✓/✗)
    - Remediation strategy nodes
    """
    try:
        tree_viz = rag_service.decision_tree_builder.visualize_tree(topic)
        
        return {
            "topic": topic,
            "visualization": tree_viz,
            "total_trees": len(rag_service.decision_tree_builder.trees),
            "total_near_miss_rules": len(rag_service.decision_tree_builder.near_miss_rules)
        }
        
    except Exception as e:
        logger.error(f"Error visualizing decision tree: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/decision-tree/rules")
async def get_decision_tree_rules():
    """
    Get all extracted rules and near-miss thresholds.
    
    Useful for debugging and understanding what the system learned from manuals.
    """
    try:
        return {
            "topics": list(rag_service.decision_tree_builder.trees.keys()),
            "near_miss_rules": [
                {
                    "threshold_name": rule.threshold_name,
                    "threshold_value": rule.threshold_value,
                    "tolerance_percent": rule.tolerance,
                    "tolerance_absolute": rule.tolerance_absolute,
                    "strategies_count": len(rule.strategies)
                }
                for rule in rag_service.decision_tree_builder.near_miss_rules
            ],
            "remediation_strategies": {
                var: [
                    {
                        "description": strat.description[:100] + "..." if len(strat.description) > 100 else strat.description,
                        "actions": strat.actions,
                        "likelihood": strat.likelihood,
                        "source": strat.source
                    }
                    for strat in strategies
                ]
                for var, strategies in rag_service.decision_tree_builder.remediation_patterns.items()
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting decision tree rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Visual Diagram Endpoints

@app.get("/diagrams/mermaid/{topic}")
async def get_mermaid_diagram(
    topic: str = "dro_eligibility",
    show_near_misses: bool = True,
    color_scheme: str = "default"
):
    """
    Get Mermaid flowchart diagram for embedding in documentation.
    
    Usage:
    ```markdown
    ```mermaid
    {mermaid_code}
    ```
    ```
    
    Can be viewed in:
    - GitHub README files
    - VS Code (with Mermaid extension)
    - Documentation sites
    """
    try:
        if not rag_service.tree_visualizer:
            raise HTTPException(status_code=503, detail="Tree visualizer not initialized. Please ingest documents first.")
        
        config = VisualizationConfig(
            show_near_misses=show_near_misses,
            color_scheme=color_scheme,
            format="mermaid"
        )
        
        diagram = rag_service.tree_visualizer.generate_mermaid(topic, config)
        
        return {
            "topic": topic,
            "format": "mermaid",
            "diagram": diagram,
            "usage": "Wrap in ```mermaid code block for rendering"
        }
        
    except Exception as e:
        logger.error(f"Error generating Mermaid diagram: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/diagrams/graphviz/{topic}")
async def get_graphviz_diagram(
    topic: str = "dro_eligibility",
    show_near_misses: bool = True,
    color_scheme: str = "default"
):
    """
    Get GraphViz DOT diagram for high-quality PDF/SVG export.
    
    To convert to PDF:
    ```bash
    curl http://localhost:8102/diagrams/graphviz/dro_eligibility | jq -r '.diagram' > tree.dot
    dot -Tpdf tree.dot -o tree.pdf
    ```
    
    To convert to SVG:
    ```bash
    dot -Tsvg tree.dot -o tree.svg
    ```
    """
    try:
        if not rag_service.tree_visualizer:
            raise HTTPException(status_code=503, detail="Tree visualizer not initialized. Please ingest documents first.")
        
        config = VisualizationConfig(
            show_near_misses=show_near_misses,
            color_scheme=color_scheme,
            format="graphviz"
        )
        
        diagram = rag_service.tree_visualizer.generate_graphviz(topic, config)
        
        return {
            "topic": topic,
            "format": "graphviz",
            "diagram": diagram,
            "conversion_commands": {
                "pdf": "dot -Tpdf tree.dot -o tree.pdf",
                "svg": "dot -Tsvg tree.dot -o tree.svg",
                "png": "dot -Tpng tree.dot -o tree.png"
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating GraphViz diagram: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/diagrams/client-path")
async def get_client_path_diagram(request: DecisionTreeRequest):
    """
    Generate diagram showing specific client's path through decision tree.
    
    Highlights:
    - The exact route taken
    - Near-miss opportunities
    - Alternative strategies
    
    Perfect for advisor consultations to show clients visually where they stand.
    """
    try:
        if not rag_service.tree_visualizer:
            raise HTTPException(status_code=503, detail="Tree visualizer not initialized. Please ingest documents first.")
        
        client_values = {}
        if request.debt is not None:
            client_values['debt'] = request.debt
        if request.income is not None:
            client_values['income'] = request.income
        if request.assets is not None:
            client_values['assets'] = request.assets
        
        result = rag_service.tree_visualizer.generate_path_diagram(
            client_values,
            request.topic,
            VisualizationConfig(format="mermaid")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating client path diagram: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/diagrams/advisor-package")
async def get_advisor_package(request: DecisionTreeRequest):
    """
    Generate complete advisor consultation package.
    
    Includes:
    - Mermaid diagram (for web)
    - GraphViz diagram (for PDF printing)
    - JSON data (for custom visualizations)
    - Near-miss analysis
    - Remediation strategies
    - Actionable recommendations
    
    Everything an advisor needs for a client consultation in one response.
    """
    try:
        if not rag_service.tree_visualizer:
            raise HTTPException(status_code=503, detail="Tree visualizer not initialized. Please ingest documents first.")
        
        client_values = {}
        if request.debt is not None:
            client_values['debt'] = request.debt
        if request.income is not None:
            client_values['income'] = request.income
        if request.assets is not None:
            client_values['assets'] = request.assets
        
        package = rag_service.tree_visualizer.export_for_advisor(
            client_values,
            request.topic
        )
        
        return package
        
    except Exception as e:
        logger.error(f"Error generating advisor package: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/diagrams/comparison")
async def get_comparison_diagram(
    topics: str = "dro_eligibility,bankruptcy_eligibility,iva_eligibility",
    show_near_misses: bool = True
):
    """
    Generate comparison diagram for multiple debt solution strategies.
    
    Shows advisors:
    - DRO vs Bankruptcy vs IVA eligibility trees
    - Which option client is closest to qualifying for
    - Near-miss opportunities for each route
    
    Example:
    GET /diagrams/comparison?topics=dro_eligibility,bankruptcy_eligibility
    """
    try:
        if not rag_service.tree_visualizer:
            raise HTTPException(status_code=503, detail="Tree visualizer not initialized. Please ingest documents first.")
        
        topic_list = [t.strip() for t in topics.split(",")]
        
        config = VisualizationConfig(show_near_misses=show_near_misses)
        
        comparison = rag_service.tree_visualizer.generate_comparison_diagram(topic_list, config)
        
        return comparison
        
    except Exception as e:
        logger.error(f"Error generating comparison diagram: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/decision-tree/rules")
async def get_decision_tree_rules():
    """
    Get all extracted rules and near-miss thresholds.
    
    Useful for debugging and understanding what the system learned from manuals.
    """
    try:
        return {
            "topics": list(rag_service.decision_tree_builder.trees.keys()),
            "near_miss_rules": [
                {
                    "threshold_name": rule.threshold_name,
                    "threshold_value": rule.threshold_value,
                    "tolerance_percent": rule.tolerance,
                    "tolerance_absolute": rule.tolerance_absolute,
                    "strategies_count": len(rule.strategies)
                }
                for rule in rag_service.decision_tree_builder.near_miss_rules
            ],
            "remediation_strategies": {
                var: [
                    {
                        "description": strat.description[:100] + "..." if len(strat.description) > 100 else strat.description,
                        "actions": strat.actions,
                        "likelihood": strat.likelihood,
                        "source": strat.source
                    }
                    for strat in strategies
                ]
                for var, strategies in rag_service.decision_tree_builder.remediation_patterns.items()
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting decision tree rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/debug/documents")
async def get_debug_documents(
    limit: int = 50,
    offset: int = 0,
    source: Optional[str] = None
):
    """Get all documents from vector store for debugging (shows raw chunks)."""
    try:
        result = rag_service.get_all_documents(
            limit=limit,
            offset=offset,
            source_filter=source
        )
        return result
    except Exception as e:
        logger.error(f"Error getting debug documents: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting documents: {str(e)}")


@app.get("/debug/sources")
async def get_debug_sources():
    """Get list of all unique sources in the vector store."""
    if rag_service.vectorstore is None:
        return {"sources": [], "status": "not_initialized"}
    
    try:
        collection = rag_service.vectorstore._collection
        results = collection.get(include=["metadatas"])
        
        sources = set()
        for metadata in results.get("metadatas", []):
            if metadata and "source" in metadata:
                sources.add(metadata["source"])
        
        return {
            "sources": sorted(list(sources)),
            "total_sources": len(sources),
            "status": "ready"
        }
    except Exception as e:
        logger.error(f"Error getting sources: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting sources: {str(e)}")


@app.get("/thresholds")
async def get_thresholds():
    """Get extracted thresholds and limits from manuals."""
    try:
        return {
            "thresholds": rag_service.threshold_cache,
            "count": len(rag_service.threshold_cache),
            "status": "ready" if rag_service.threshold_cache else "empty"
        }
    except Exception as e:
        logger.error(f"Error getting thresholds: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting thresholds: {str(e)}")


@app.get("/debug/thresholds")
async def get_debug_thresholds():
    """Get detailed threshold information with sources and text spans for debugging."""
    try:
        if not rag_service.threshold_cache:
            return {
                "thresholds": [],
                "count": 0,
                "status": "empty",
                "message": "No thresholds extracted yet. Thresholds are extracted on startup from manuals."
            }
        
        # Format threshold data for easy debugging
        threshold_list = []
        for key, data in rag_service.threshold_cache.items():
            threshold_list.append({
                "key": key,
                "debt_option": data.get('debt_option', 'unknown'),
                "limit_type": data.get('limit_type', 'unknown'),
                "amount": data.get('amount'),
                "formatted": data.get('formatted', str(data.get('amount'))),
                "source_file": data.get('source_file', 'Unknown'),
                "source_number": data.get('source_number', 0),
                "text_span": data.get('text_span', '[No text span available]'),
                "metadata": data.get('extracted_from', {})
            })
        
        # Sort by debt option then limit type
        threshold_list.sort(key=lambda x: (x['debt_option'], x['limit_type']))
        
        return {
            "thresholds": threshold_list,
            "count": len(threshold_list),
            "status": "ready",
            "grouped_by_option": _group_thresholds_by_option(threshold_list)
        }
    except Exception as e:
        logger.error(f"Error getting debug thresholds: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting debug thresholds: {str(e)}")


def _group_thresholds_by_option(threshold_list: List[Dict]) -> Dict:
    """Group thresholds by debt option for easier viewing."""
    grouped = {}
    for threshold in threshold_list:
        option = threshold['debt_option']
        if option not in grouped:
            grouped[option] = []
        grouped[option].append({
            "limit_type": threshold['limit_type'],
            "amount": threshold['amount'],
            "formatted": threshold['formatted'],
            "source": threshold['source_file']
        })
    return grouped


if __name__ == "__main__":
    logger.info("Starting RAG Service...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8102,
        timeout_keep_alive=300,  # 5 minutes for keep-alive
        timeout_graceful_shutdown=30
    )
