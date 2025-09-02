import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional
import psycopg2
import redis
import torch
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="CMA Chatbot Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        database=os.getenv("DB_NAME", "cma_system"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
        port=os.getenv("DB_PORT", 5432)
    )

# Initialize local LLM
class LocalLLMService:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
        
    async def initialize_model(self):
        """Initialize the local LLM model"""
        try:
            model_name = os.getenv("LLM_MODEL_NAME", "microsoft/DialoGPT-medium")
            
            # For production, consider using Llama 2 7B or similar:
            # model_name = "meta-llama/Llama-2-7b-chat-hf"
            # You'll need to request access from Meta and use HF token
            
            logger.info(f"Loading model: {model_name}")
            
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                device_map="auto" if self.device == "cuda" else None,
                low_cpu_mem_usage=True
            )
            
            # Add padding token if it doesn't exist
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
                
            logger.info("Model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            # Fallback to a smaller model
            try:
                model_name = "microsoft/DialoGPT-small"
                logger.info(f"Falling back to: {model_name}")
                
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.model = AutoModelForCausalLM.from_pretrained(model_name)
                
                if self.tokenizer.pad_token is None:
                    self.tokenizer.pad_token = self.tokenizer.eos_token
                    
                logger.info("Fallback model loaded successfully")
            except Exception as fallback_error:
                logger.error(f"Fallback model failed: {fallback_error}")
                raise
    
    async def generate_response(self, prompt: str, context: str = "") -> str:
        """Generate response using local LLM"""
        if not self.model or not self.tokenizer:
            await self.initialize_model()
        
        try:
            # Prepare the input with context
            system_prompt = """You are a helpful AI assistant for a Community Money Advice service. 
You help with debt advice, budgeting, and financial guidance. Be professional, empathetic, and provide practical advice.
Always remind users to speak with a qualified debt advisor for personalized advice."""
            
            full_prompt = f"{system_prompt}\n\nContext: {context}\n\nUser: {prompt}\n\nAssistant:"
            
            # Tokenize input
            inputs = self.tokenizer.encode(full_prompt, return_tensors="pt", truncate=True, max_length=512)
            
            if self.device == "cuda":
                inputs = inputs.to(self.device)
            
            # Generate response
            with torch.no_grad():
                outputs = self.model.generate(
                    inputs,
                    max_new_tokens=150,
                    num_return_sequences=1,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                    attention_mask=torch.ones_like(inputs)
                )
            
            # Decode response
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract only the assistant's response
            if "Assistant:" in response:
                response = response.split("Assistant:")[-1].strip()
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I apologize, but I'm having trouble processing your request right now. Please try again or contact a debt advisor directly."

# Initialize LLM service
llm_service = LocalLLMService()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_text(message)

manager = ConnectionManager()

class ChatMessage(BaseModel):
    message: str
    case_id: Optional[int] = None
    user_id: Optional[int] = None

class ChatbotService:
    def __init__(self):
        self.system_prompt = """
        You are a helpful AI assistant for Community Money Advice (CMA) debt advisors. 
        Your role is to provide guidance and support to debt advisors helping clients with financial difficulties.
        
        Key responsibilities:
        - Provide advice on debt management strategies
        - Help interpret FCA regulations and compliance requirements
        - Suggest appropriate debt solutions based on client circumstances
        - Assist with case documentation and note-taking
        - Offer guidance on client communication
        
        Always be professional, accurate, and helpful. If you're unsure about something, 
        acknowledge the limitation and suggest consulting official resources or supervisors.
        """

    async def get_case_context(self, case_id: int) -> Dict:
        """Retrieve case context from database"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Get case details
            cursor.execute("""
                SELECT c.*, cl.first_name, cl.last_name, cl.email, cl.phone
                FROM cases c
                JOIN clients cl ON c.client_id = cl.id
                WHERE c.id = %s
            """, (case_id,))
            
            case_data = cursor.fetchone()
            if not case_data:
                return {}
            
            # Get recent notes
            cursor.execute("""
                SELECT content, created_at, note_category
                FROM notes 
                WHERE case_id = %s 
                ORDER BY created_at DESC 
                LIMIT 5
            """, (case_id,))
            
            notes = cursor.fetchall()
            
            conn.close()
            
            return {
                'case': dict(case_data),
                'recent_notes': [dict(note) for note in notes]
            }
            
        except Exception as e:
            logger.error(f"Error fetching case context: {e}")
            return {}

    async def generate_response(self, message: str, case_id: Optional[int] = None, user_id: Optional[int] = None) -> str:
        """Generate response using local LLM with case context"""
        try:
            context = ""
            if case_id:
                case_context = await self.get_case_context(case_id)
                if case_context:
                    context = f"Case Context: Client {case_context['case']['first_name']} {case_context['case']['last_name']}, Status: {case_context['case']['status']}"
            
            response = await llm_service.generate_response(message, context)
            
            # Save conversation to Redis for session management
            conversation_key = f"chat_session_{user_id}_{case_id or 'general'}"
            conversation_data = {
                'timestamp': datetime.now().isoformat(),
                'user_message': message,
                'bot_response': response,
                'case_id': case_id,
                'user_id': user_id
            }
            
            redis_client.lpush(conversation_key, json.dumps(conversation_data))
            redis_client.expire(conversation_key, 86400)  # 24 hours
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I apologize, but I'm experiencing technical difficulties. Please try again or contact your supervisor for assistance."

chatbot_service = ChatbotService()

# WebSocket endpoint
@app.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            user_message = message_data.get('message', '')
            case_id = message_data.get('case_id')
            user_id = message_data.get('user_id')
            
            # Generate response using local LLM
            response = await chatbot_service.generate_response(user_message, case_id, user_id)
            
            # Send response back
            response_data = {
                'message': response,
                'timestamp': datetime.now().isoformat(),
                'session_id': session_id
            }
            
            await manager.send_personal_message(json.dumps(response_data), session_id)
            
    except WebSocketDisconnect:
        manager.disconnect(session_id)
        logger.info(f"WebSocket disconnected: {session_id}")

# REST endpoint for chat
@app.post("/chat")
async def chat_endpoint(chat_message: ChatMessage):
    try:
        response = await chatbot_service.generate_response(
            chat_message.message, 
            chat_message.case_id, 
            chat_message.user_id
        )
        
        return {
            'response': response,
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        'status': 'healthy',
        'service': 'CMA Chatbot',
        'model_loaded': llm_service.model is not None,
        'device': llm_service.device,
        'timestamp': datetime.now().isoformat()
    }

# Model info endpoint
@app.get("/model-info")
async def model_info():
    if not llm_service.model:
        await llm_service.initialize_model()
    
    return {
        'model_name': os.getenv("LLM_MODEL_NAME", "microsoft/DialoGPT-medium"),
        'device': llm_service.device,
        'model_loaded': llm_service.model is not None,
        'torch_version': torch.__version__,
        'cuda_available': torch.cuda.is_available()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
            
            conversation_data = {
                "messages": [
                    {"role": "user", "content": user_message, "timestamp": datetime.now().isoformat()},
                    {"role": "assistant", "content": bot_response, "timestamp": datetime.now().isoformat()}
                ]
            }
            
            cursor.execute("""
                INSERT INTO chatbot_conversations (case_id, user_id, session_id, conversation_data)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                conversation_data = chatbot_conversations.conversation_data || %s,
                updated_at = CURRENT_TIMESTAMP
            """, (case_id, user_id, session_id, json.dumps(conversation_data), json.dumps(conversation_data)))
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error saving conversation: {e}")

chatbot_service = ChatbotService()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            user_message = message_data.get("message", "")
            case_id = message_data.get("case_id")
            user_id = message_data.get("user_id")
            
            # Get case context if case_id provided
            case_context = {}
            if case_id:
                case_context = await chatbot_service.get_case_context(case_id)
            
            # Generate response
            bot_response = await chatbot_service.generate_response(user_message, case_context)
            
            # Save conversation
            await chatbot_service.save_conversation(session_id, user_message, bot_response, case_id, user_id)
            
            # Send response
            response_data = {
                "message": bot_response,
                "timestamp": datetime.now().isoformat(),
                "session_id": session_id
            }
            
            await manager.send_personal_message(json.dumps(response_data), session_id)
            
    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(session_id)

@app.post("/chat")
async def chat_endpoint(message: ChatMessage):
    """REST endpoint for chat (alternative to WebSocket)"""
    try:
        case_context = {}
        if message.case_id:
            case_context = await chatbot_service.get_case_context(message.case_id)
        
        response = await chatbot_service.generate_response(message.message, case_context)
        
        return {
            "response": response,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/conversations/{session_id}")
async def get_conversation(session_id: str):
    """Get conversation history"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT * FROM chatbot_conversations 
            WHERE session_id = %s
        """, (session_id,))
        
        conversation = cursor.fetchone()
        conn.close()
        
        if conversation:
            return dict(conversation)
        else:
            return {"session_id": session_id, "conversation_data": {"messages": []}}
            
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
