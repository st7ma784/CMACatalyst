import os
import json
import asyncio
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import psycopg2
import redis
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="CMA RAG-Enhanced Chatbot Service", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "cma_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_PORT = int(os.getenv("DB_PORT", 5432))

# RAG Service URLs
RAG_INGESTION_URL = os.getenv("RAG_INGESTION_URL", "http://rag-ingestion:8004")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

# Initialize Redis client
redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True
)

# Pydantic models
class ChatMessage(BaseModel):
    message: str
    client_id: Optional[str] = None
    session_id: Optional[str] = None
    context: Optional[Dict] = None
    use_rag: bool = True
    manual_type: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict] = []
    confidence: float = 0.0
    session_id: str
    rag_used: bool = False

class RAGService:
    """Service for handling RAG-based query enhancement"""

    def __init__(self):
        self.rag_url = RAG_INGESTION_URL
        self.ollama_url = OLLAMA_URL

    async def search_training_manuals(
        self,
        query: str,
        manual_type: Optional[str] = None,
        top_k: int = 3
    ) -> List[Dict]:
        """Search training manuals for relevant content"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                search_request = {
                    "query": query,
                    "top_k": top_k,
                    "score_threshold": 0.7
                }

                if manual_type:
                    search_request["manual_type"] = manual_type

                response = await client.post(
                    f"{self.rag_url}/search",
                    json=search_request
                )

                if response.status_code == 200:
                    result = response.json()
                    return result.get("results", [])
                else:
                    logger.warning(f"RAG search failed: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"RAG search error: {str(e)}")
            return []

    async def generate_rag_enhanced_response(
        self,
        user_query: str,
        context_docs: List[Dict],
        client_context: Optional[Dict] = None
    ) -> Tuple[str, float]:
        """Generate response using RAG context and Ollama"""
        try:
            # Build context from retrieved documents
            context_text = self._build_context_text(context_docs)

            # Build the enhanced prompt
            prompt = self._build_rag_prompt(user_query, context_text, client_context)

            # Generate response using Ollama
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": "llama3.1:8b",
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "top_p": 0.9,
                            "max_tokens": 500
                        }
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    generated_text = result.get("response", "")

                    # Calculate confidence based on context relevance
                    confidence = self._calculate_confidence(context_docs, user_query)

                    return generated_text.strip(), confidence
                else:
                    logger.error(f"Ollama generation failed: {response.status_code}")
                    return self._fallback_response(user_query), 0.3

        except Exception as e:
            logger.error(f"RAG enhanced generation error: {str(e)}")
            return self._fallback_response(user_query), 0.2

    def _build_context_text(self, context_docs: List[Dict]) -> str:
        """Build context text from retrieved documents"""
        if not context_docs:
            return ""

        context_parts = []
        for i, doc in enumerate(context_docs):
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})
            source = metadata.get("file_name", "Training Manual")

            context_parts.append(f"Source {i+1} ({source}):\n{content}\n")

        return "\n".join(context_parts)

    def _build_rag_prompt(
        self,
        user_query: str,
        context_text: str,
        client_context: Optional[Dict] = None
    ) -> str:
        """Build the RAG-enhanced prompt for Ollama"""

        base_prompt = """You are a professional debt advice assistant working for a debt advice service. You help clients understand their options and provide guidance following FCA guidelines.

IMPORTANT GUIDELINES:
- Always be professional, empathetic, and non-judgmental
- Follow FCA regulations and best practices
- Prioritize the client's wellbeing and financial stability
- If unsure about specific regulations, recommend consulting with a qualified advisor
- Never provide advice that could worsen someone's financial situation

"""

        if context_text:
            base_prompt += f"""RELEVANT TRAINING MATERIAL:
{context_text}

Use this training material to inform your response, but adapt it to the specific client situation.

"""

        if client_context:
            client_info = f"""CLIENT CONTEXT:
- Client ID: {client_context.get('client_id', 'N/A')}
- Previous interactions: {client_context.get('previous_interactions', 'None')}
- Current financial situation: {client_context.get('financial_status', 'Unknown')}

"""
            base_prompt += client_info

        base_prompt += f"""CLIENT QUESTION: {user_query}

RESPONSE:
Provide a helpful, accurate response based on the training materials and FCA guidelines. If the training materials don't cover the specific question, provide general guidance and recommend they speak with an advisor for personalized advice."""

        return base_prompt

    def _calculate_confidence(self, context_docs: List[Dict], user_query: str) -> float:
        """Calculate confidence score based on retrieved context quality"""
        if not context_docs:
            return 0.3

        # Simple confidence calculation based on:
        # 1. Number of relevant documents
        # 2. Average relevance scores
        # 3. Query length/complexity

        scores = [doc.get("score", 0.0) for doc in context_docs]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        # Boost confidence with more relevant documents
        doc_boost = min(len(context_docs) * 0.1, 0.3)

        # Simple query complexity factor
        query_complexity = min(len(user_query.split()) / 10, 0.2)

        confidence = avg_score + doc_boost + query_complexity
        return min(confidence, 0.95)  # Cap at 95%

    def _fallback_response(self, user_query: str) -> str:
        """Provide fallback response when RAG fails"""
        return """I understand you're looking for guidance on your debt situation. While I'd like to provide specific advice, I recommend speaking with one of our qualified debt advisors who can review your individual circumstances and provide personalized guidance following FCA regulations.

You can book an appointment through our website or call our helpline. In the meantime, ensure you're managing any priority debts first (like mortgage, rent, or secured loans) and keep records of all your financial obligations.

Is there a specific area of debt advice you'd like me to help you find more information about?"""

# Database functions
def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT
    )

async def store_conversation(client_id: str, user_message: str, bot_response: str, session_id: str, rag_used: bool):
    """Store conversation in database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO chat_conversations
            (client_id, user_message, bot_response, session_id, rag_used, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (client_id, user_message, bot_response, session_id, rag_used, datetime.now()))

        conn.commit()
        cursor.close()
        conn.close()

    except Exception as e:
        logger.error(f"Failed to store conversation: {str(e)}")

async def get_client_context(client_id: str) -> Optional[Dict]:
    """Get client context from database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get recent conversations
        cursor.execute("""
            SELECT user_message, bot_response, created_at
            FROM chat_conversations
            WHERE client_id = %s
            ORDER BY created_at DESC
            LIMIT 5
        """, (client_id,))

        conversations = cursor.fetchall()

        # Get client basic info (if available)
        cursor.execute("""
            SELECT first_name, last_name, email, phone
            FROM clients
            WHERE id = %s
        """, (client_id,))

        client_info = cursor.fetchone()

        cursor.close()
        conn.close()

        context = {
            "client_id": client_id,
            "previous_interactions": len(conversations),
            "recent_topics": [conv[0][:100] for conv in conversations[:3]]
        }

        if client_info:
            context["client_name"] = f"{client_info[0]} {client_info[1]}"
            context["contact_info"] = {"email": client_info[2], "phone": client_info[3]}

        return context

    except Exception as e:
        logger.error(f"Failed to get client context: {str(e)}")
        return None

# Initialize RAG service
rag_service = RAGService()

# API Endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        # Test connections
        redis_client.ping()
        logger.info("Redis connection successful")

        # Test RAG service
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{RAG_INGESTION_URL}/health")
            if response.status_code == 200:
                logger.info("RAG ingestion service connection successful")
            else:
                logger.warning("RAG ingestion service not available")

        # Test Ollama
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/version")
            if response.status_code == 200:
                logger.info("Ollama connection successful")
            else:
                logger.warning("Ollama service not available")

    except Exception as e:
        logger.error(f"Startup initialization error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        redis_client.ping()

        # Check RAG service
        async with httpx.AsyncClient(timeout=5.0) as client:
            rag_response = await client.get(f"{RAG_INGESTION_URL}/health")
            ollama_response = await client.get(f"{OLLAMA_URL}/api/version")

        return {
            "status": "healthy",
            "redis": "connected",
            "rag_service": "connected" if rag_response.status_code == 200 else "disconnected",
            "ollama": "connected" if ollama_response.status_code == 200 else "disconnected"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(message: ChatMessage):
    """Main chat endpoint with RAG enhancement"""
    try:
        session_id = message.session_id or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Get client context if available
        client_context = None
        if message.client_id:
            client_context = await get_client_context(message.client_id)

        # Search training manuals if RAG is enabled
        sources = []
        rag_used = False

        if message.use_rag:
            sources = await rag_service.search_training_manuals(
                message.message,
                message.manual_type
            )
            rag_used = len(sources) > 0

        # Generate response
        if rag_used:
            response_text, confidence = await rag_service.generate_rag_enhanced_response(
                message.message,
                sources,
                client_context
            )
        else:
            # Fallback to simple Ollama generation
            response_text, confidence = await rag_service.generate_rag_enhanced_response(
                message.message,
                [],
                client_context
            )

        # Store conversation
        if message.client_id:
            await store_conversation(
                message.client_id,
                message.message,
                response_text,
                session_id,
                rag_used
            )

        return ChatResponse(
            response=response_text,
            sources=sources,
            confidence=confidence,
            session_id=session_id,
            rag_used=rag_used
        )

    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/collections/stats")
async def get_rag_stats():
    """Get RAG collection statistics"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{RAG_INGESTION_URL}/collections/stats")

            if response.status_code == 200:
                return response.json()
            else:
                return {"error": "Unable to fetch RAG statistics"}

    except Exception as e:
        logger.error(f"RAG stats error: {str(e)}")
        return {"error": str(e)}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time chat"""
    await websocket.accept()

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Create chat message
            chat_message = ChatMessage(
                message=message_data.get("message", ""),
                client_id=client_id,
                session_id=message_data.get("session_id"),
                use_rag=message_data.get("use_rag", True),
                manual_type=message_data.get("manual_type")
            )

            # Process through chat endpoint logic
            client_context = await get_client_context(client_id)

            sources = []
            rag_used = False

            if chat_message.use_rag:
                sources = await rag_service.search_training_manuals(
                    chat_message.message,
                    chat_message.manual_type
                )
                rag_used = len(sources) > 0

            if rag_used:
                response_text, confidence = await rag_service.generate_rag_enhanced_response(
                    chat_message.message,
                    sources,
                    client_context
                )
            else:
                response_text, confidence = await rag_service.generate_rag_enhanced_response(
                    chat_message.message,
                    [],
                    client_context
                )

            # Send response
            response = {
                "response": response_text,
                "sources": sources,
                "confidence": confidence,
                "rag_used": rag_used,
                "timestamp": datetime.now().isoformat()
            }

            await websocket.send_text(json.dumps(response))

            # Store conversation
            await store_conversation(
                client_id,
                chat_message.message,
                response_text,
                chat_message.session_id or "websocket",
                rag_used
            )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for client {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)