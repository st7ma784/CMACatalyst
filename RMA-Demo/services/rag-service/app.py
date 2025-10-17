#!/usr/bin/env python3
"""
RAG Service for "Ask the Manuals"
Provides RAG interface for querying training manuals using Ollama and ChromaDB
"""

import os
import logging
from typing import List, Dict, Optional
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG Service - Ask the Manuals",
    description="Query training manuals using RAG",
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
    question: str
    model: str = "llama3.2"
    top_k: int = 4


class QueryResponse(BaseModel):
    """Response model for queries."""
    answer: str
    sources: List[str]


class IngestRequest(BaseModel):
    """Request model for document ingestion."""
    documents: List[str]  # List of markdown texts
    filenames: List[str]  # Corresponding filenames


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

        self.initialize()

    def initialize(self):
        """Initialize embeddings and connect to shared ChromaDB."""
        logger.info("Initializing RAG system...")

        try:
            # Initialize embeddings
            self.embeddings = OllamaEmbeddings(
                model="nomic-embed-text",
                base_url=self.ollama_url
            )

            # Connect to shared ChromaDB instance
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

        except Exception as e:
            logger.error(f"Error initializing RAG system: {e}")
            raise

    def ingest_documents(self, documents: List[str], filenames: List[str]) -> Dict:
        """Ingest documents into vector store."""
        try:
            # Create Document objects
            docs = []
            for doc_text, filename in zip(documents, filenames):
                # Split document into chunks
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1000,
                    chunk_overlap=200,
                    length_function=len
                )

                chunks = text_splitter.split_text(doc_text)

                # Create Document objects for each chunk
                for i, chunk in enumerate(chunks):
                    docs.append(Document(
                        page_content=chunk,
                        metadata={
                            "source": filename,
                            "chunk": i
                        }
                    ))

            logger.info(f"Created {len(docs)} chunks from {len(documents)} documents")

            # Create or update vector store in shared ChromaDB
            if self.vectorstore is None:
                logger.info("Creating new 'manuals' collection in shared ChromaDB")
                self.vectorstore = Chroma.from_documents(
                    documents=docs,
                    embedding=self.embeddings,
                    client=self.chroma_client,
                    collection_name="manuals"
                )
            else:
                logger.info("Adding to existing 'manuals' collection in shared ChromaDB")
                self.vectorstore.add_documents(docs)

            return {
                "success": True,
                "documents_ingested": len(documents),
                "chunks_created": len(docs)
            }

        except Exception as e:
            logger.error(f"Error ingesting documents: {e}")
            raise

    def create_qa_chain(self, model_name="llama3.2", top_k=4):
        """Create QA chain with retrieval."""
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized. Please ingest documents first.")

        # Initialize LLM
        llm = Ollama(
            model=model_name,
            base_url=self.ollama_url,
            temperature=0.7
        )

        # Create custom prompt template
        prompt_template = """You are a helpful assistant answering questions about training manuals and procedures.
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

    def query(self, question: str, model_name="llama3.2", top_k=4) -> Dict:
        """Query the RAG system."""
        # Create or update QA chain
        self.create_qa_chain(model_name=model_name, top_k=top_k)

        # Get answer
        result = self.qa_chain({"query": question})

        # Extract sources
        sources = [doc.metadata.get("source", "Unknown") for doc in result["source_documents"]]
        unique_sources = list(set(sources))

        return {
            "answer": result["result"],
            "sources": unique_sources
        }

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
            "/ingest": "POST - Ingest new documents",
            "/stats": "GET - Get vector store statistics",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "vectorstore_ready": rag_service.vectorstore is not None
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
        result = rag_service.query(
            question=request.question,
            model_name=request.model,
            top_k=request.top_k
        )
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


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


if __name__ == "__main__":
    logger.info("Starting RAG Service...")
    uvicorn.run(app, host="0.0.0.0", port=8102)
