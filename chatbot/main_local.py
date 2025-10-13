import os
import json
import asyncio
import logging
import httpx
import ollama
from typing import Dict, List, Optional
from datetime import datetime

import psycopg2
import redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="CMA Chatbot Service - Local GPU", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "localhost")
OLLAMA_PORT = os.getenv("OLLAMA_PORT", "11434")
MODEL_NAME = os.getenv("MODEL_NAME", "llama2:7b")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "http://n8n:5678/webhook")

# Initialize Redis client
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True
)

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "cma_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
        port=os.getenv("DB_PORT", 5432)
    )

# Ollama client initialization
ollama_client = ollama.Client(host=f"http://{OLLAMA_HOST}:{OLLAMA_PORT}")

class ChatMessage(BaseModel):
    message: str
    client_id: Optional[str] = None
    case_id: Optional[str] = None
    context: Optional[Dict] = None

class OllamaService:
    def __init__(self):
        self.client = ollama_client
        self.model = MODEL_NAME
        
    async def generate_response(self, prompt: str, context: Optional[Dict] = None) -> str:
        """Generate response using local Ollama instance"""
        try:
            # Build enhanced prompt with context
            enhanced_prompt = self._build_prompt(prompt, context)
            
            response = self.client.generate(
                model=self.model,
                prompt=enhanced_prompt,
                options={
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": 512,
                }
            )
            
            return response['response']
            
        except Exception as e:
            logger.error(f"Error generating Ollama response: {e}")
            return "I apologize, but I'm having trouble processing your request right now. Please try again later."
    
    def _build_prompt(self, user_message: str, context: Optional[Dict] = None) -> str:
        """Build enhanced prompt with context and guidelines"""
        base_prompt = """You are a professional debt advice assistant for a UK debt advice centre. 
You must follow FCA guidelines and provide helpful, accurate advice about debt management.

Guidelines:
- Always be empathetic and supportive
- Provide practical, actionable advice
- Mention relevant legislation or regulations when appropriate
- Suggest next steps or resources
- Never give specific financial product recommendations
- If unsure, recommend speaking with a qualified advisor

"""
        
        if context:
            if context.get('client_info'):
                base_prompt += f"Client context: {context['client_info']}\n"
            if context.get('case_info'):
                base_prompt += f"Case details: {context['case_info']}\n"
        
        base_prompt += f"Client question: {user_message}\n\nResponse:"
        
        return base_prompt

class ContextService:
    def __init__(self):
        pass
    
    async def get_client_context(self, client_id: str) -> Dict:
        """Retrieve client context from database"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Get client info
            cursor.execute("""
                SELECT id, name, email, phone, vulnerability_flags, created_at 
                FROM clients WHERE id = %s
            """, (client_id,))
            
            client_data = cursor.fetchone()
            
            if not client_data:
                return {}
            
            # Get recent cases
            cursor.execute("""
                SELECT id, case_type, status, total_debt, priority, created_at
                FROM cases WHERE client_id = %s 
                ORDER BY created_at DESC LIMIT 3
            """, (client_id,))
            
            cases = cursor.fetchall()
            
            context = {
                'client_info': {
                    'id': client_data[0],
                    'name': client_data[1],
                    'email': client_data[2],
                    'phone': client_data[3],
                    'vulnerability_flags': client_data[4],
                    'client_since': client_data[5].isoformat() if client_data[5] else None
                },
                'recent_cases': [
                    {
                        'id': case[0],
                        'type': case[1],
                        'status': case[2],
                        'total_debt': float(case[3]) if case[3] else 0,
                        'priority': case[4],
                        'created': case[5].isoformat() if case[5] else None
                    } for case in cases
                ]
            }
            
            cursor.close()
            conn.close()
            
            return context
            
        except Exception as e:
            logger.error(f"Error getting client context: {e}")
            return {}

class N8NIntegration:
    def __init__(self):
        self.webhook_url = N8N_WEBHOOK_URL
    
    async def trigger_workflow(self, workflow_data: Dict) -> Dict:
        """Trigger n8n workflow for advanced processing"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.webhook_url}/ai-assistant",
                    json=workflow_data,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"N8N workflow error: {response.status_code}")
                    return {}
                    
        except Exception as e:
            logger.error(f"Error triggering N8N workflow: {e}")
            return {}

# Initialize services
ollama_service = OllamaService()
context_service = ContextService()
n8n_integration = N8NIntegration()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Ollama connection
        models = ollama_client.list()
        ollama_status = "healthy" if models else "unhealthy"
        
        # Check Redis connection
        redis_status = "healthy" if redis_client.ping() else "unhealthy"
        
        # Check database connection
        try:
            conn = get_db_connection()
            conn.close()
            db_status = "healthy"
        except:
            db_status = "unhealthy"
        
        return {
            "status": "healthy",
            "services": {
                "ollama": ollama_status,
                "redis": redis_status,
                "database": db_status
            },
            "model": MODEL_NAME,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/chat")
async def chat_endpoint(message: ChatMessage):
    """Main chat endpoint with Ollama integration"""
    try:
        # Get client context if client_id provided
        context = {}
        if message.client_id:
            context = await context_service.get_client_context(message.client_id)
        
        # Merge with provided context
        if message.context:
            context.update(message.context)
        
        # Generate response using Ollama
        response = await ollama_service.generate_response(
            message.message, 
            context
        )
        
        # Log conversation
        conversation_data = {
            "client_id": message.client_id,
            "case_id": message.case_id,
            "user_message": message.message,
            "ai_response": response,
            "context": context,
            "timestamp": datetime.now().isoformat(),
            "model": MODEL_NAME
        }
        
        # Store in Redis for session management
        if message.client_id:
            session_key = f"chat_session:{message.client_id}"
            redis_client.lpush(session_key, json.dumps(conversation_data))
            redis_client.ltrim(session_key, 0, 49)  # Keep last 50 messages
            redis_client.expire(session_key, 86400)  # Expire after 24 hours
        
        # Trigger N8N workflow for advanced processing (optional)
        if message.client_id:
            asyncio.create_task(
                n8n_integration.trigger_workflow({
                    "client_id": message.client_id,
                    "question": message.message,
                    "context": context
                })
            )
        
        return {
            "response": response,
            "client_id": message.client_id,
            "case_id": message.case_id,
            "timestamp": datetime.now().isoformat(),
            "model": MODEL_NAME
        }
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def list_models():
    """List available Ollama models"""
    try:
        models = ollama_client.list()
        return {
            "models": [model["name"] for model in models["models"]],
            "current_model": MODEL_NAME
        }
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        return {"error": str(e)}

@app.post("/models/pull/{model_name}")
async def pull_model(model_name: str):
    """Pull a new model from Ollama"""
    try:
        result = ollama_client.pull(model_name)
        return {"status": "success", "model": model_name, "result": result}
    except Exception as e:
        logger.error(f"Error pulling model {model_name}: {e}")
        return {"error": str(e)}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time chat"""
    await websocket.accept()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Get context
            context = await context_service.get_client_context(client_id)
            
            # Generate response
            response = await ollama_service.generate_response(
                message_data["message"], 
                context
            )
            
            # Send response back
            await websocket.send_text(json.dumps({
                "response": response,
                "timestamp": datetime.now().isoformat(),
                "model": MODEL_NAME
            }))
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for client {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)