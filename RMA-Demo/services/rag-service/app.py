#!/usr/bin/env python3
"""
RAG Service for "Ask the Manuals"
Provides RAG interface for querying training manuals using Ollama and ChromaDB
"""

import os
import logging
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
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
import PyPDF2
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import io
import tempfile

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
    retrieved_chunks: Optional[List[Dict]] = None  # Debug info


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
            
            # Auto-ingest manuals if collection is empty
            if self.vectorstore is None or self.vectorstore._collection.count() == 0:
                logger.info("Vector store is empty, triggering auto-ingestion of manuals...")
                self.auto_ingest_manuals()

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
            
        except Exception as e:
            logger.error(f"Error in auto-ingestion: {e}")

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


if __name__ == "__main__":
    logger.info("Starting RAG Service...")
    uvicorn.run(app, host="0.0.0.0", port=8102)
