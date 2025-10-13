#!/usr/bin/env python3
"""
RAG Application using Ollama and ChromaDB for retrieval-augmented generation.
Provides both API endpoints and CLI interface.
"""

import os
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate


# Initialize FastAPI app
app = FastAPI(
    title="Ollama RAG Demo",
    description="Retrieval-Augmented Generation using Ollama and ChromaDB",
    version="1.0.0"
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


class RAGSystem:
    """RAG system managing vector store and LLM interactions."""

    def __init__(self, persist_directory="/data/vectorstore", base_url="http://localhost:11434"):
        self.persist_directory = persist_directory
        self.base_url = base_url
        self.embeddings = None
        self.vectorstore = None
        self.qa_chain = None
        self.initialize()

    def initialize(self):
        """Initialize embeddings and vector store."""
        print("Initializing RAG system...")

        # Initialize embeddings
        self.embeddings = OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=self.base_url
        )

        # Check if vector store exists
        if os.path.exists(self.persist_directory):
            print(f"Loading existing vector store from {self.persist_directory}")
            self.vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings,
                collection_name="documents"
            )
        else:
            print("No vector store found. Please run document ingestion first.")
            self.vectorstore = None

    def create_qa_chain(self, model_name="llama3.2", top_k=4):
        """Create QA chain with retrieval."""
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized")

        # Initialize LLM
        llm = Ollama(
            model=model_name,
            base_url=self.base_url,
            temperature=0.7
        )

        # Create custom prompt template
        prompt_template = """Use the following pieces of context to answer the question at the end.
If you don't know the answer based on the context provided, just say that you don't know,
don't try to make up an answer.

Context:
{context}

Question: {question}

Answer:"""

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


# Initialize RAG system
rag_system = RAGSystem()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Ollama RAG Demo API",
        "endpoints": {
            "/query": "POST - Query the RAG system",
            "/health": "GET - Health check",
            "/stats": "GET - Vector store statistics"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "vector_store_loaded": rag_system.vectorstore is not None
    }


@app.get("/stats")
async def get_stats():
    """Get vector store statistics."""
    if rag_system.vectorstore is None:
        raise HTTPException(status_code=404, detail="Vector store not initialized")

    try:
        collection = rag_system.vectorstore._collection
        count = collection.count()
        return {
            "total_chunks": count,
            "collection_name": "documents"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")


@app.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    """Query the RAG system."""
    if rag_system.vectorstore is None:
        raise HTTPException(
            status_code=503,
            detail="Vector store not initialized. Please add documents first."
        )

    try:
        result = rag_system.query(
            question=request.question,
            model_name=request.model,
            top_k=request.top_k
        )
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.post("/reingest")
async def reingest_documents():
    """Trigger document re-ingestion."""
    try:
        import subprocess
        subprocess.run(["python3", "/app/ingest_documents.py"], check=True)
        rag_system.initialize()  # Reload vector store
        return {"message": "Documents re-ingested successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error re-ingesting documents: {str(e)}")


def main():
    """Start the FastAPI server."""
    print("=" * 50)
    print("Ollama RAG Demo Starting...")
    print("=" * 50)

    if rag_system.vectorstore is None:
        print("\n⚠️  WARNING: No vector store found!")
        print("Please add documents to /documents and restart the container.")
    else:
        print("\n✓ Vector store loaded successfully")

    print("\nStarting API server on http://0.0.0.0:8000")
    print("\nAPI Endpoints:")
    print("  - GET  /          - API information")
    print("  - GET  /health    - Health check")
    print("  - GET  /stats     - Vector store statistics")
    print("  - POST /query     - Query the RAG system")
    print("  - POST /reingest  - Re-ingest documents")
    print("\nExample query:")
    print('  curl -X POST http://localhost:8000/query \\')
    print('    -H "Content-Type: application/json" \\')
    print('    -d \'{"question": "What is this document about?"}\'')
    print("\n" + "=" * 50)

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
