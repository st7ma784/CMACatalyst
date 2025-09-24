import pytest
from httpx import AsyncClient
from unittest.mock import Mock, patch, AsyncMock
import torch
from main import app, LocalTranslationService

@pytest.fixture
def mock_translation_service():
    service = LocalTranslationService()
    service.device = "cpu"
    return service

@pytest.mark.asyncio
class TestTranslationService:
    
    async def test_health_check(self):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Local Translation Service"
        assert "timestamp" in data

    async def test_get_supported_languages(self):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.get("/languages")
        
        assert response.status_code == 200
        data = response.json()
        assert "supported_pairs" in data
        assert "languages" in data
        assert "en-es" in data["supported_pairs"]

    @patch('main.translation_service.translate_text')
    async def test_translate_endpoint_success(self, mock_translate):
        mock_translate.return_value = "Hola mundo"
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post("/translate", json={
                "text": "Hello world",
                "target_language": "es",
                "source_language": "en"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["translated_text"] == "Hola mundo"
        assert data["source_language"] == "en"
        assert data["target_language"] == "es"

    async def test_translate_missing_fields(self):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post("/translate", json={
                "text": "Hello world"
            })
        
        assert response.status_code == 422  # Validation error

    @patch('main.translation_service.translate_text')
    async def test_translate_batch_success(self, mock_translate):
        mock_translate.side_effect = ["Hola", "Adiós"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post("/translate-batch", json={
                "texts": ["Hello", "Goodbye"],
                "target_language": "es",
                "source_language": "en"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["translations"]) == 2
        assert data["total_count"] == 2

    async def test_translate_batch_too_many_texts(self):
        texts = ["test"] * 101  # More than limit
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post("/translate-batch", json={
                "texts": texts,
                "target_language": "es"
            })
        
        assert response.status_code == 400
        assert "Maximum 100 texts" in response.json()["detail"]

class TestLocalTranslationService:
    
    @patch('main.AutoTokenizer.from_pretrained')
    @patch('main.AutoModelForSeq2SeqLM.from_pretrained')
    @patch('main.pipeline')
    async def test_load_model_success(self, mock_pipeline, mock_model, mock_tokenizer, mock_translation_service):
        mock_tokenizer.return_value = Mock()
        mock_model.return_value = Mock()
        mock_translator = Mock()
        mock_pipeline.return_value = mock_translator
        
        result = await mock_translation_service.load_model("en", "es")
        
        assert result["translator"] == mock_translator
        assert "en-es" in mock_translation_service.models

    async def test_load_model_unsupported_language(self, mock_translation_service):
        with pytest.raises(ValueError, match="No model available"):
            await mock_translation_service.load_model("en", "xx")

    @patch.object(LocalTranslationService, 'load_model')
    async def test_translate_text_success(self, mock_load_model, mock_translation_service):
        mock_translator = Mock()
        mock_translator.return_value = [{"translation_text": "Hola mundo"}]
        mock_load_model.return_value = {"translator": mock_translator, "reverse": False}
        
        result = await mock_translation_service.translate_text("Hello world", "en", "es")
        
        assert result == "Hola mundo"
        mock_load_model.assert_called_once_with("en", "es")

    @patch.object(LocalTranslationService, 'load_model')
    async def test_translate_text_chunking(self, mock_load_model, mock_translation_service):
        # Create a long text that needs chunking
        long_text = "word " * 200  # 1000 characters
        
        mock_translator = Mock()
        mock_translator.side_effect = [
            [{"translation_text": "translated chunk 1"}],
            [{"translation_text": "translated chunk 2"}],
            [{"translation_text": "translated chunk 3"}]
        ]
        mock_load_model.return_value = {"translator": mock_translator, "reverse": False}
        
        result = await mock_translation_service.translate_text(long_text, "en", "es")
        
        assert "translated chunk" in result
        assert mock_translator.call_count >= 2  # Should be chunked

    def test_fallback_translation(self, mock_translation_service):
        text = "debt payment advice"
        result = mock_translation_service.fallback_translation(text, "es")
        
        assert "deuda" in result
        assert "pago" in result
        assert "consejo" in result

    def test_fallback_translation_unsupported_language(self, mock_translation_service):
        text = "debt payment"
        result = mock_translation_service.fallback_translation(text, "xx")
        
        assert "[Translation to xx not available locally]" in result
        assert "debt payment" in result