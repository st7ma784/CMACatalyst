#!/usr/bin/env python3
"""
RAG Application using Ollama and ChromaDB for retrieval-augmented generation.
Provides both API endpoints and CLI interface.
"""

import os
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
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

    def __init__(self, persist_directory="/data/vectorstore", base_url=None):
        self.persist_directory = persist_directory
        # Use environment variable or default
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
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
    """Root endpoint - serves web interface."""
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ollama RAG Demo</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: Arial, sans-serif;
                background: #f5f5f5;
                padding: 20px;
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                padding: 30px;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
            }
            .subtitle {
                color: #666;
                margin-bottom: 30px;
            }
            .query-section {
                margin-bottom: 30px;
            }
            label {
                display: block;
                margin-bottom: 10px;
                font-weight: bold;
                color: #555;
            }
            input[type="text"] {
                width: 100%;
                padding: 12px;
                border: 2px solid #ddd;
                border-radius: 5px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            input[type="text"]:focus {
                outline: none;
                border-color: #4CAF50;
            }
            button {
                background: #4CAF50;
                color: white;
                padding: 12px 30px;
                border: none;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 10px;
                transition: background 0.3s;
            }
            button:hover {
                background: #45a049;
            }
            button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            .results-section {
                margin-top: 30px;
                padding-top: 30px;
                border-top: 2px solid #eee;
            }
            .result-card {
                background: #f9f9f9;
                border-left: 4px solid #4CAF50;
                padding: 20px;
                margin-bottom: 20px;
                border-radius: 5px;
            }
            .answer {
                color: #333;
                line-height: 1.6;
                margin-bottom: 15px;
                white-space: pre-wrap;
            }
            .sources {
                color: #666;
                font-size: 14px;
            }
            .sources strong {
                color: #333;
            }
            .source-item {
                background: white;
                padding: 5px 10px;
                margin: 5px 5px 5px 0;
                display: inline-block;
                border-radius: 3px;
                border: 1px solid #ddd;
            }
            .loading {
                text-align: center;
                color: #666;
                padding: 20px;
            }
            .error {
                background: #ffebee;
                border-left-color: #f44336;
                color: #c62828;
            }
            .timestamp {
                color: #999;
                font-size: 12px;
                margin-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔍 Ollama RAG Demo</h1>
            <p class="subtitle">Retrieval-Augmented Generation with Haystack Search</p>
            
            <div class="query-section">
                <label for="question">Ask a Question:</label>
                <input type="text" id="question" name="question" 
                       placeholder="e.g., What are Julian's hobbies?" 
                       autocomplete="off"
                       onkeypress="if(event.key==='Enter') askQuestion()">
                <button onclick="askQuestion()" id="askBtn">Ask Question</button>
            </div>
            
            <div class="results-section" id="results">
                <p style="color: #999; text-align: center;">Your answers will appear here...</p>
            </div>
        </div>

        <script>
            async function askQuestion() {
                const question = document.getElementById('question').value.trim();
                if (!question) {
                    alert('Please enter a question');
                    return;
                }

                const resultsDiv = document.getElementById('results');
                const askBtn = document.getElementById('askBtn');
                
                // Disable button and show loading
                askBtn.disabled = true;
                askBtn.textContent = 'Thinking...';
                
                // Add loading message
                const loadingCard = document.createElement('div');
                loadingCard.className = 'result-card loading';
                loadingCard.innerHTML = '<p>🤔 Searching documents and generating answer...</p>';
                resultsDiv.insertBefore(loadingCard, resultsDiv.firstChild);

                try {
                    const response = await fetch('/query', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            question: question,
                            model: 'llama3.2',
                            top_k: 4
                        })
                    });

                    // Remove loading message
                    resultsDiv.removeChild(loadingCard);

                    if (!response.ok) {
                        throw new Error('Failed to get answer');
                    }

                    const data = await response.json();
                    
                    // Create result card
                    const resultCard = document.createElement('div');
                    resultCard.className = 'result-card';
                    
                    const timestamp = new Date().toLocaleTimeString();
                    
                    let sourcesHtml = '';
                    if (data.sources && data.sources.length > 0) {
                        sourcesHtml = '<div class="sources"><strong>Sources:</strong><br>';
                        data.sources.forEach(source => {
                            const fileName = source.split('/').pop();
                            sourcesHtml += `<span class="source-item">${fileName}</span>`;
                        });
                        sourcesHtml += '</div>';
                    }
                    
                    resultCard.innerHTML = `
                        <strong>Q: ${question}</strong>
                        <div class="answer">${data.answer}</div>
                        ${sourcesHtml}
                        <div class="timestamp">${timestamp}</div>
                    `;
                    
                    resultsDiv.insertBefore(resultCard, resultsDiv.firstChild);
                    
                    // Clear input
                    document.getElementById('question').value = '';

                } catch (error) {
                    // Remove loading message
                    if (resultsDiv.contains(loadingCard)) {
                        resultsDiv.removeChild(loadingCard);
                    }
                    
                    // Show error
                    const errorCard = document.createElement('div');
                    errorCard.className = 'result-card error';
                    errorCard.innerHTML = `
                        <strong>Error</strong>
                        <div class="answer">Failed to get answer. Please make sure documents are loaded and try again.</div>
                    `;
                    resultsDiv.insertBefore(errorCard, resultsDiv.firstChild);
                } finally {
                    // Re-enable button
                    askBtn.disabled = false;
                    askBtn.textContent = 'Ask Question';
                }
            }
            
            // Focus the input field when page loads
            window.addEventListener('DOMContentLoaded', function() {
                document.getElementById('question').focus();
            });
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@app.get("/api")
async def api_info():
    """API information endpoint."""
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
