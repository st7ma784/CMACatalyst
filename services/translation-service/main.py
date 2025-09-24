import os
import logging
from typing import Dict, List, Optional
from datetime import datetime
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Local Translation Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = "en"

class BatchTranslationRequest(BaseModel):
    texts: List[str]
    target_language: str
    source_language: str = "en"

class LocalTranslationService:
    def __init__(self):
        self.models = {}
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Translation service using device: {self.device}")
        
        # Supported language pairs with their model names
        self.model_mapping = {
            "en-es": "Helsinki-NLP/opus-mt-en-es",
            "en-fr": "Helsinki-NLP/opus-mt-en-fr", 
            "en-de": "Helsinki-NLP/opus-mt-en-de",
            "en-it": "Helsinki-NLP/opus-mt-en-it",
            "en-pt": "Helsinki-NLP/opus-mt-en-pt",
            "en-pl": "Helsinki-NLP/opus-mt-en-pl",
            "en-ar": "Helsinki-NLP/opus-mt-en-ar",
            "en-zh": "Helsinki-NLP/opus-mt-en-zh",
            "en-tr": "Helsinki-NLP/opus-mt-en-tr",
            "en-ro": "Helsinki-NLP/opus-mt-en-ro"
        }
        
    async def load_model(self, source_lang: str, target_lang: str):
        """Load translation model for specific language pair"""
        model_key = f"{source_lang}-{target_lang}"
        
        if model_key in self.models:
            return self.models[model_key]
            
        model_name = self.model_mapping.get(model_key)
        if not model_name:
            # Try reverse direction
            reverse_key = f"{target_lang}-{source_lang}"
            model_name = self.model_mapping.get(reverse_key)
            if model_name:
                model_key = reverse_key
                
        if not model_name:
            raise ValueError(f"No model available for {source_lang} to {target_lang}")
            
        try:
            logger.info(f"Loading translation model: {model_name}")
            
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                device_map="auto" if self.device == "cuda" else None
            )
            
            translator = pipeline(
                "translation", 
                model=model, 
                tokenizer=tokenizer,
                device=0 if self.device == "cuda" else -1,
                max_length=512
            )
            
            self.models[model_key] = {
                'translator': translator,
                'reverse': model_key.startswith(target_lang)
            }
            
            logger.info(f"Model loaded successfully: {model_name}")
            return self.models[model_key]
            
        except Exception as e:
            logger.error(f"Error loading translation model: {e}")
            raise
    
    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate text using local models"""
        try:
            model_info = await self.load_model(source_lang, target_lang)
            translator = model_info['translator']
            
            # Split long text into chunks to avoid model limits
            max_chunk_size = 400  # Conservative limit for most models
            chunks = [text[i:i+max_chunk_size] for i in range(0, len(text), max_chunk_size)]
            
            translated_chunks = []
            for chunk in chunks:
                if not chunk.strip():
                    continue
                    
                result = translator(chunk)
                translated_text = result[0]['translation_text']
                translated_chunks.append(translated_text)
            
            return ' '.join(translated_chunks)
            
        except Exception as e:
            logger.error(f"Translation error: {e}")
            # Fallback to simple dictionary-based translation for common debt advice terms
            return self.fallback_translation(text, target_lang)
    
    def fallback_translation(self, text: str, target_lang: str) -> str:
        """Simple fallback translation for basic debt advice terms"""
        
        # Basic debt advice terminology in different languages
        translations = {
            "es": {
                "debt": "deuda",
                "payment": "pago", 
                "advice": "consejo",
                "budget": "presupuesto",
                "creditor": "acreedor",
                "balance": "saldo",
                "interest": "interés",
                "monthly": "mensual"
            },
            "fr": {
                "debt": "dette",
                "payment": "paiement",
                "advice": "conseil", 
                "budget": "budget",
                "creditor": "créancier",
                "balance": "solde",
                "interest": "intérêt",
                "monthly": "mensuel"
            },
            "de": {
                "debt": "Schuld",
                "payment": "Zahlung",
                "advice": "Beratung",
                "budget": "Budget", 
                "creditor": "Gläubiger",
                "balance": "Saldo",
                "interest": "Zinsen",
                "monthly": "monatlich"
            }
        }
        
        if target_lang in translations:
            translated = text
            for en_term, translated_term in translations[target_lang].items():
                translated = translated.replace(en_term, translated_term)
            return translated
            
        return f"[Translation to {target_lang} not available locally] {text}"

# Initialize translation service
translation_service = LocalTranslationService()

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    """Translate text using local models"""
    try:
        translated = await translation_service.translate_text(
            request.text,
            request.source_language, 
            request.target_language
        )
        
        return {
            "translated_text": translated,
            "source_language": request.source_language,
            "target_language": request.target_language,
            "provider": "local_helsinki_nlp",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Translation endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/translate-batch")
async def translate_batch(request: BatchTranslationRequest):
    """Translate multiple texts"""
    try:
        if len(request.texts) > 100:
            raise HTTPException(status_code=400, detail="Maximum 100 texts per batch")
            
        translations = []
        for text in request.texts:
            try:
                translated = await translation_service.translate_text(
                    text,
                    request.source_language,
                    request.target_language
                )
                translations.append(translated)
            except Exception as e:
                logger.error(f"Individual translation failed: {e}")
                translations.append(f"[Translation failed] {text}")
        
        return {
            "translations": translations,
            "source_language": request.source_language,
            "target_language": request.target_language,
            "total_count": len(translations),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Batch translation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/languages")
async def get_supported_languages():
    """Get supported language pairs"""
    return {
        "supported_pairs": list(translation_service.model_mapping.keys()),
        "languages": {
            "source": ["en"],
            "targets": list(set(pair.split("-")[1] for pair in translation_service.model_mapping.keys()))
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Local Translation Service",
        "models_loaded": len(translation_service.models),
        "device": translation_service.device,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)