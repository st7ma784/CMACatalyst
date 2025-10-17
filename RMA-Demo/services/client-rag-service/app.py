#!/usr/bin/env python3
"""
Client Document RAG Service
Provides client-specific vector stores for querying uploaded documents
Each client gets their own collection for document search
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


class QueryResponse(BaseModel):
    """Response model for queries."""
    answer: str
    sources: List[Dict[str, str]]  # filename, chunk info


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

            # Initialize ChromaDB client (shared instance)
            self.chroma_client = chromadb.HttpClient(
                host=self.chromadb_host,
                port=self.chromadb_port
            )
            logger.info(f"Connected to shared ChromaDB at {self.chromadb_host}:{self.chromadb_port}")

            logger.info("Client RAG system initialized")

        except Exception as e:
            logger.error(f"Error initializing Client RAG system: {e}")
            raise

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

    def ingest_document(
        self,
        client_id: str,
        document_text: str,
        filename: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Ingest a single document into client's vector store."""
        try:
            # Split document into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len
            )

            chunks = text_splitter.split_text(document_text)

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

            logger.info(f"Created {len(docs)} chunks from {filename} for client {client_id}")

            # Get or create vector store in shared ChromaDB
            collection_name = f"client_{client_id}"
            vectorstore = self.get_client_vectorstore(client_id)

            if vectorstore is None:
                logger.info(f"Creating new collection {collection_name} in shared ChromaDB")
                vectorstore = Chroma.from_documents(
                    documents=docs,
                    embedding=self.embeddings,
                    client=self.chroma_client,
                    collection_name=collection_name
                )
                self.vectorstores[client_id] = vectorstore
            else:
                logger.info(f"Adding to existing collection {collection_name} in shared ChromaDB")
                vectorstore.add_documents(docs)

            return {
                "success": True,
                "client_id": client_id,
                "filename": filename,
                "chunks_created": len(docs)
            }

        except Exception as e:
            logger.error(f"Error ingesting document for client {client_id}: {e}")
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
                "chunk": doc.metadata.get("chunk", 0),
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


@app.post("/ingest")
async def ingest_document(request: IngestRequest):
    """Ingest a document into a client's vector store."""
    try:
        result = rag_service.ingest_document(
            client_id=request.client_id,
            document_text=request.document_text,
            filename=request.filename,
            metadata=request.metadata
        )
        return result
    except Exception as e:
        logger.error(f"Error ingesting document: {e}")
        raise HTTPException(status_code=500, detail=f"Error ingesting document: {str(e)}")


if __name__ == "__main__":
    logger.info("Starting Client Document RAG Service...")
    uvicorn.run(app, host="0.0.0.0", port=8104)
