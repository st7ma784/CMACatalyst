import os
import json
import asyncio
import logging
import re
import math
from datetime import datetime
from typing import Dict, List, Optional
import psycopg2
import redis
import torch
import httpx
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
            inputs = self.tokenizer.encode(full_prompt, return_tensors="pt", truncation=True, max_length=512)
            
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

class CalculatorService:
    """Financial calculation service for debt advice"""
    
    @staticmethod
    def calculate_debt_to_income_ratio(total_debt: float, monthly_income: float) -> float:
        """Calculate debt-to-income ratio"""
        if monthly_income <= 0:
            return float('inf')
        return (total_debt / monthly_income) * 100
    
    @staticmethod
    def calculate_disposable_income(income: float, expenses: float) -> float:
        """Calculate disposable income"""
        return max(0, income - expenses)
    
    @staticmethod
    def calculate_payment_plan(debt_amount: float, interest_rate: float, months: int) -> Dict:
        """Calculate payment plan details"""
        if months <= 0 or debt_amount <= 0:
            return {"error": "Invalid parameters"}
        
        monthly_rate = interest_rate / 100 / 12
        if monthly_rate == 0:
            monthly_payment = debt_amount / months
        else:
            monthly_payment = debt_amount * (monthly_rate * (1 + monthly_rate) ** months) / ((1 + monthly_rate) ** months - 1)
        
        total_paid = monthly_payment * months
        total_interest = total_paid - debt_amount
        
        return {
            "monthly_payment": round(monthly_payment, 2),
            "total_paid": round(total_paid, 2),
            "total_interest": round(total_interest, 2),
            "months": months
        }
    
    @staticmethod
    def parse_calculation_request(message: str) -> Dict:
        """Parse calculation requests from natural language"""
        calculations = {}
        
        # Debt-to-income ratio
        debt_income_pattern = r'debt.*income.*ratio.*debt.*£?(\d+(?:,\d{3})*(?:\.\d{2})?).*income.*£?(\d+(?:,\d{3})*(?:\.\d{2})?)'
        match = re.search(debt_income_pattern, message.lower())
        if match:
            debt = float(match.group(1).replace(',', ''))
            income = float(match.group(2).replace(',', ''))
            calculations['debt_to_income'] = CalculatorService.calculate_debt_to_income_ratio(debt, income)
        
        # Payment plan calculations
        payment_pattern = r'payment.*plan.*£?(\d+(?:,\d{3})*(?:\.\d{2})?).*(\d+).*months?.*(\d+(?:\.\d+)?)[%]?.*interest'
        match = re.search(payment_pattern, message.lower())
        if match:
            debt = float(match.group(1).replace(',', ''))
            months = int(match.group(2))
            interest = float(match.group(3))
            calculations['payment_plan'] = CalculatorService.calculate_payment_plan(debt, interest, months)
        
        return calculations

class LocalCouncilService:
    """Service for searching local council information"""
    
    @staticmethod
    async def search_council_info(query: str, postcode: str = None) -> Dict:
        """Search for local council information using web search"""
        try:
            # Use DuckDuckGo as a privacy-focused search engine
            search_query = f"{query} local council UK"
            if postcode:
                search_query += f" {postcode}"
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Use a simple web search API or scrape results
                response = await client.get(
                    f"https://html.duckduckgo.com/html/?q={search_query}",
                    headers={'User-Agent': 'Mozilla/5.0 (compatible; MordecAI/1.0)'}
                )
                
                if response.status_code == 200:
                    # Basic extraction of search results
                    content = response.text
                    # Simple regex to extract relevant council information
                    council_patterns = [
                        r'([\w\s]+ council)',
                        r'([\w\s]+\.gov\.uk)',
                        r'council tax.*?£?(\d+)',
                        r'housing benefit.*?£?(\d+)'
                    ]
                    
                    results = []
                    for pattern in council_patterns:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        results.extend(matches[:3])  # Limit results
                    
                    return {
                        "query": query,
                        "results": results[:5],  # Limit to 5 results
                        "source": "web_search"
                    }
        except Exception as e:
            logger.error(f"Council search error: {e}")
            return {
                "query": query,
                "error": "Search temporarily unavailable",
                "suggestion": "Try contacting local council directly"
            }

class MCPService:
    """Model Context Protocol service for per-client data access"""
    
    def __init__(self):
        self.tools = {
            "get_case_details": self.get_case_details,
            "get_client_history": self.get_client_history,
            "calculate_finances": self.calculate_finances,
            "search_council": self.search_council,
            "get_compliance_info": self.get_compliance_info,
            "generate_confirmation_of_advice": self.generate_confirmation_of_advice
        }
    
    async def get_case_details(self, case_id: int) -> Dict:
        """MCP tool: Get comprehensive case details"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT c.*, cl.first_name, cl.last_name, cl.email, cl.phone, 
                       cl.date_of_birth, cl.address, cl.postcode
                FROM cases c
                JOIN clients cl ON c.client_id = cl.id
                WHERE c.id = %s
            """, (case_id,))
            
            case_data = cursor.fetchone()
            if not case_data:
                return {"error": "Case not found"}
            
            # Get debts
            cursor.execute("""
                SELECT creditor_name, balance, priority_type, status 
                FROM creditors WHERE case_id = %s
            """, (case_id,))
            debts = cursor.fetchall()
            
            # Get recent notes
            cursor.execute("""
                SELECT content, created_at, note_category, created_by
                FROM notes 
                WHERE case_id = %s 
                ORDER BY created_at DESC 
                LIMIT 10
            """, (case_id,))
            notes = cursor.fetchall()
            
            conn.close()
            
            case_info = dict(zip([desc[0] for desc in cursor.description], case_data))
            
            return {
                "case_details": case_info,
                "debts": [dict(zip(['creditor', 'balance', 'priority', 'status'], debt)) for debt in debts],
                "recent_notes": [dict(zip(['content', 'date', 'category', 'author'], note)) for note in notes]
            }
            
        except Exception as e:
            logger.error(f"Error getting case details: {e}")
            return {"error": "Failed to retrieve case details"}
    
    async def calculate_finances(self, calculation_type: str, params: Dict) -> Dict:
        """MCP tool: Perform financial calculations"""
        calc_service = CalculatorService()
        
        if calculation_type == "debt_to_income":
            return {
                "ratio": calc_service.calculate_debt_to_income_ratio(
                    params.get('debt', 0), 
                    params.get('income', 0)
                )
            }
        elif calculation_type == "payment_plan":
            return calc_service.calculate_payment_plan(
                params.get('debt', 0),
                params.get('interest_rate', 0),
                params.get('months', 12)
            )
        elif calculation_type == "disposable_income":
            return {
                "disposable_income": calc_service.calculate_disposable_income(
                    params.get('income', 0),
                    params.get('expenses', 0)
                )
            }
        else:
            return {"error": "Unknown calculation type"}
    
    async def search_council(self, query: str, postcode: str = None) -> Dict:
        """MCP tool: Search local council information"""
        council_service = LocalCouncilService()
        return await council_service.search_council_info(query, postcode)
    
    async def generate_confirmation_of_advice(self, case_id: int, note_ids: List[int] = None) -> Dict:
        """MCP tool: Generate Confirmation of Advice from case notes"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Get case details
            case_details = await self.get_case_details(case_id)
            if 'error' in case_details:
                return case_details
            
            # Get notes for CoA generation
            if note_ids:
                cursor.execute("""
                    SELECT id, title, content, note_category, created_at, user_id
                    FROM notes 
                    WHERE case_id = %s AND id = ANY(%s)
                    ORDER BY created_at ASC
                """, (case_id, note_ids))
            else:
                # Get all notes from the last 30 days
                cursor.execute("""
                    SELECT id, title, content, note_category, created_at, user_id
                    FROM notes 
                    WHERE case_id = %s AND created_at >= NOW() - INTERVAL '30 days'
                    ORDER BY created_at ASC
                """, (case_id,))
            
            notes = cursor.fetchall()
            conn.close()
            
            if not notes:
                return {"error": "No notes found for Confirmation of Advice generation"}
            
            # Format notes for CoA generation
            notes_summary = "\n".join([
                f"- {note[1]}: {note[2]}" for note in notes
            ])
            
            client_info = case_details.get('case_details', {})
            client_name = f"{client_info.get('first_name', '')} {client_info.get('last_name', '')}"
            
            # Generate CoA using specialized prompt
            coa_prompt = f"""
Generate a professional Confirmation of Advice letter for:

Client: {client_name}
Case ID: {case_id}

Case Summary:
{notes_summary}

Debts Summary:
{len(case_details.get('debts', []))} total debts identified
{len([d for d in case_details.get('debts', []) if d.get('priority') == 'priority'])} priority debts

Create a formal Confirmation of Advice letter that includes:
1. Client situation summary
2. Advice provided
3. Recommended actions
4. Next steps
5. FCA compliance statements

Use professional but clear language suitable for clients.
            """
            
            response = await llm_service.generate_response(coa_prompt, "")
            
            return {
                "confirmation_of_advice": response,
                "case_id": case_id,
                "client_name": client_name,
                "notes_count": len(notes),
                "generated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating CoA: {e}")
            return {"error": "Failed to generate Confirmation of Advice"}

class ChatbotService:
    def __init__(self):
        self.calculator = CalculatorService()
        self.council_search = LocalCouncilService()
        self.mcp_service = MCPService()
        self.system_prompt = """
        You are a helpful AI assistant for Community Money Advice (CMA) debt advisors. 
        Your role is to provide guidance and support to debt advisors helping clients with financial difficulties.
        
        Key capabilities:
        - Financial calculations (debt-to-income ratios, payment plans, disposable income)
        - Case detail access and analysis
        - Local council information searches
        - FCA compliance guidance
        - Debt advice strategies
        - Confirmation of Advice generation
        - Translation assistance
        
        When generating Confirmation of Advice letters, follow FCA guidelines:
        - Clearly state the advice given
        - Include specific recommendations
        - Mention any limitations or assumptions
        - Use professional but accessible language
        - Include standard regulatory disclaimers
        
        For translations, maintain the professional tone and technical accuracy while adapting for cultural context.
        
        Always be professional, accurate, and helpful. Clearly show calculation results.
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
                'case': dict(zip([desc[0] for desc in cursor.description], case_data)),
                'recent_notes': [dict(zip([desc[0] for desc in cursor.description], note)) for note in notes]
            }
            
        except Exception as e:
            logger.error(f"Error fetching case context: {e}")
            return {}

    async def generate_response(self, message: str, case_id: Optional[int] = None, user_id: Optional[int] = None) -> str:
        """Generate response using local LLM with enhanced capabilities"""
        try:
            # Check for calculation requests
            calculations = self.calculator.parse_calculation_request(message)
            
            # Check for case detail requests
            case_info = None
            if case_id and any(keyword in message.lower() for keyword in ['case', 'details', 'history', 'client']):
                case_info = await self.mcp_service.get_case_details(case_id)
            
            # Check for council search requests
            council_info = None
            if any(keyword in message.lower() for keyword in ['council', 'local authority', 'housing', 'benefits']):
                postcode = None
                if case_info and 'case_details' in case_info:
                    postcode = case_info['case_details'].get('postcode')
                council_info = await self.council_search.search_council_info(message, postcode)
            
            # Build enhanced context
            context = ""
            enhanced_response_parts = []
            
            if case_id:
                if not case_info:
                    case_info = await self.get_case_context(case_id)
                if case_info:
                    case_data = case_info.get('case', {})
                    context = f"Case Context: Client {case_data.get('first_name', '')} {case_data.get('last_name', '')}, Status: {case_data.get('status', '')}"
            
            # Add calculation results
            if calculations:
                calc_text = "Calculations:\n"
                for calc_type, result in calculations.items():
                    if calc_type == 'debt_to_income':
                        calc_text += f"• Debt-to-Income Ratio: {result:.1f}%\n"
                    elif calc_type == 'payment_plan':
                        calc_text += f"• Monthly Payment: £{result['monthly_payment']}\n"
                        calc_text += f"• Total Interest: £{result['total_interest']}\n"
                enhanced_response_parts.append(calc_text)
            
            # Add council search results
            if council_info and 'results' in council_info:
                council_text = f"Local Council Information:\n"
                for result in council_info['results']:
                    council_text += f"• {result}\n"
                enhanced_response_parts.append(council_text)
            
            # Generate LLM response
            llm_response = await llm_service.generate_response(message, context)
            
            # Combine enhanced features with LLM response
            final_response = ""
            if enhanced_response_parts:
                final_response = "\n\n".join(enhanced_response_parts) + "\n\n" + llm_response
            else:
                final_response = llm_response
            
            # Save conversation to Redis
            conversation_key = f"chat_session_{user_id}_{case_id or 'general'}"
            conversation_data = {
                'timestamp': datetime.now().isoformat(),
                'user_message': message,
                'bot_response': final_response,
                'case_id': case_id,
                'user_id': user_id,
                'calculations': calculations,
                'council_search': council_info is not None
            }
            
            redis_client.lpush(conversation_key, json.dumps(conversation_data))
            redis_client.expire(conversation_key, 86400)
            
            return final_response
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I apologize, but I'm experiencing technical difficulties. Please try again or contact your supervisor for assistance."

chatbot_service = ChatbotService()

# MCP endpoints
@app.get("/mcp/tools")
async def get_mcp_tools():
    """Get available MCP tools"""
    return {
        "tools": [
            {
                "name": "get_case_details",
                "description": "Get comprehensive case details including client info, debts, and notes",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "case_id": {"type": "integer"}
                    },
                    "required": ["case_id"]
                }
            },
            {
                "name": "calculate_finances", 
                "description": "Perform financial calculations (debt ratios, payment plans, disposable income)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "calculation_type": {"type": "string", "enum": ["debt_to_income", "payment_plan", "disposable_income"]},
                        "params": {"type": "object"}
                    },
                    "required": ["calculation_type", "params"]
                }
            },
            {
                "name": "search_council",
                "description": "Search for local council information and services",
                "inputSchema": {
                    "type": "object", 
                    "properties": {
                        "query": {"type": "string"},
                        "postcode": {"type": "string"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "generate_confirmation_of_advice",
                "description": "Generate a formal Confirmation of Advice letter from case notes",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "case_id": {"type": "integer"},
                        "note_ids": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Optional: specific note IDs to include"
                        }
                    },
                    "required": ["case_id"]
                }
            }
        ]
    }

@app.post("/mcp/tools/{tool_name}")
async def call_mcp_tool(tool_name: str, params: Dict):
    """Call an MCP tool"""
    try:
        if tool_name not in chatbot_service.mcp_service.tools:
            raise HTTPException(status_code=404, detail=f"Tool {tool_name} not found")
        
        tool_func = chatbot_service.mcp_service.tools[tool_name]
        result = await tool_func(**params)
        
        return {
            "tool": tool_name,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"MCP tool error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint
@app.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            message_type = message_data.get('type', 'message')
            
            if message_type == 'get_capabilities':
                # Send capabilities information
                capabilities = {
                    'type': 'capabilities',
                    'capabilities': [
                        'Financial calculations',
                        'Case detail access',
                        'Local council search',
                        'FCA compliance guidance',
                        'Document analysis'
                    ],
                    'mcp_tools': list(chatbot_service.mcp_service.tools.keys()),
                    'timestamp': datetime.now().isoformat()
                }
                await manager.send_personal_message(json.dumps(capabilities), session_id)
                continue
            
            user_message = message_data.get('message', '')
            case_id = message_data.get('case_id')
            user_id = message_data.get('user_id')
            
            # Generate response using enhanced chatbot service
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
