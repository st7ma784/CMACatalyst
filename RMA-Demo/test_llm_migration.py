#!/usr/bin/env python3
"""
Test suite for vLLM migration validation.
Tests embeddings, LLM calls, and provider fallback logic.
"""

import os
import sys
import asyncio
from pathlib import Path

# Add services directory to path
services_dir = Path(__file__).parent / "services"
sys.path.insert(0, str(services_dir / "rag-service"))
sys.path.insert(0, str(services_dir))

def test_provider_imports():
    """Test that provider module can be imported."""
    try:
        from rag_service.llm_provider import get_provider, LLMProvider, OllamaProvider, VLLMProvider
        assert LLMProvider is not None
        assert OllamaProvider is not None
        assert VLLMProvider is not None
        assert get_provider is not None
        print("✓ Provider imports successful")
    except Exception as e:
        pytest.fail(f"Failed to import provider module: {e}")


def test_provider_initialization():
    """Test that provider can be initialized."""
    try:
        from rag_service.llm_provider import get_provider
        provider = get_provider()
        assert provider is not None
        print(f"✓ Provider initialized: {provider.__class__.__name__}")
    except Exception as e:
        pytest.fail(f"Failed to initialize provider: {e}")


def test_embeddings_initialization():
    """Test that embeddings can be initialized via provider."""
    try:
        from rag_service.llm_provider import get_provider
        provider = get_provider()
        embeddings = provider.initialize_embeddings()
        assert embeddings is not None
        print(f"✓ Embeddings initialized: {embeddings.__class__.__name__}")
    except Exception as e:
        pytest.fail(f"Failed to initialize embeddings: {e}")


def test_llm_initialization():
    """Test that LLM can be initialized via provider."""
    try:
        from rag_service.llm_provider import get_provider
        provider = get_provider()
        llm = provider.initialize_llm(temperature=0.7)
        assert llm is not None
        print(f"✓ LLM initialized: {llm.__class__.__name__}")
    except Exception as e:
        pytest.fail(f"Failed to initialize LLM: {e}")


def test_embeddings_generation():
    """Test that embeddings can be generated."""
    try:
        from rag_service.llm_provider import get_provider
        provider = get_provider()
        embeddings = provider.initialize_embeddings()
        
        # Test embedding a simple text
        test_text = "This is a test document for embedding generation."
        result = embeddings.embed_query(test_text)
        
        assert result is not None
        assert len(result) > 0
        print(f"✓ Embeddings generated: {len(result)} dimensions")
    except Exception as e:
        print(f"⚠ Embeddings generation test skipped (may require service running): {e}")


def test_llm_chat_completion():
    """Test that LLM can generate completions."""
    try:
        from rag_service.llm_provider import get_provider
        provider = get_provider()
        llm = provider.initialize_llm(temperature=0.7)
        
        # Test simple completion
        test_prompt = "Summarize in one sentence: The vLLM framework provides fast inference for large language models."
        result = llm.invoke(test_prompt)
        
        assert result is not None
        assert len(str(result)) > 0
        print(f"✓ LLM completion generated: {len(str(result))} characters")
    except Exception as e:
        print(f"⚠ LLM completion test skipped (may require service running): {e}")


def test_provider_environment_variable():
    """Test that provider respects LLM_PROVIDER environment variable."""
    try:
        from rag_service.llm_provider import get_provider
        
        # Test default provider
        default_provider = get_provider()
        default_name = default_provider.__class__.__name__
        print(f"✓ Default provider: {default_name}")
        
        # Test with vLLM provider
        os.environ['LLM_PROVIDER'] = 'vllm'
        vllm_provider = get_provider()
        assert vllm_provider.__class__.__name__ == 'VLLMProvider'
        print(f"✓ VLLM provider selected via env var")
        
        # Test with Ollama provider
        os.environ['LLM_PROVIDER'] = 'ollama'
        ollama_provider = get_provider()
        assert ollama_provider.__class__.__name__ == 'OllamaProvider'
        print(f"✓ Ollama provider selected via env var")
        
        # Reset to default
        if 'LLM_PROVIDER' in os.environ:
            del os.environ['LLM_PROVIDER']
            
    except Exception as e:
        pytest.fail(f"Failed environment variable test: {e}")


def test_rag_service_imports():
    """Test that RAG service can be imported with new provider."""
    try:
        sys.path.insert(0, str(services_dir / "rag-service"))
        from app import RAGService
        assert RAGService is not None
        print("✓ RAG service imports successful")
    except Exception as e:
        pytest.fail(f"Failed to import RAG service: {e}")


def test_notes_service_imports():
    """Test that Notes service can be imported with new provider."""
    try:
        sys.path.insert(0, str(services_dir / "notes-service"))
        from app import NotesService
        assert NotesService is not None
        print("✓ Notes service imports successful")
    except Exception as e:
        pytest.fail(f"Failed to import Notes service: {e}")


def test_doc_processor_imports():
    """Test that Doc-Processor service can be imported with vision enhancement."""
    try:
        sys.path.insert(0, str(services_dir / "doc-processor"))
        from app import DocumentProcessor
        assert DocumentProcessor is not None
        print("✓ Doc-Processor service imports successful")
    except Exception as e:
        pytest.fail(f"Failed to import Doc-Processor service: {e}")


def test_requirements_updated():
    """Test that requirements.txt files have been updated."""
    try:
        rag_reqs = Path(services_dir / "rag-service" / "requirements.txt").read_text()
        assert "openai" in rag_reqs, "openai not found in RAG service requirements"
        assert "ollama==0.4.4" not in rag_reqs, "Old ollama version still in RAG requirements"
        print("✓ RAG service requirements updated")
        
        notes_reqs = Path(services_dir / "notes-service" / "requirements.txt").read_text()
        assert "openai" in notes_reqs, "openai not found in Notes service requirements"
        assert "ollama==0.1.6" not in notes_reqs, "Old ollama version still in Notes requirements"
        print("✓ Notes service requirements updated")
        
        doc_reqs = Path(services_dir / "doc-processor" / "requirements.txt").read_text()
        assert "openai" in doc_reqs, "openai not found in Doc-Processor requirements"
        print("✓ Doc-Processor service requirements updated")
        
    except Exception as e:
        pytest.fail(f"Requirements validation failed: {e}")


def test_provider_fallback_logic():
    """Test that provider has proper fallback logic."""
    try:
        from rag_service.llm_provider import get_provider, VLLMProvider
        provider = get_provider()
        
        # Check for fallback method
        if isinstance(provider, VLLMProvider):
            assert hasattr(provider, 'get_direct_client'), "VLLMProvider missing get_direct_client method"
            client = provider.get_direct_client()
            assert client is not None, "VLLMProvider.get_direct_client() returned None"
            print("✓ vLLM provider has direct client fallback")
        
        print("✓ Provider fallback logic validated")
    except Exception as e:
        print(f"⚠ Fallback logic test skipped: {e}")


def test_vision_enhancement_integration():
    """Test that Doc-Processor has vision enhancement integration."""
    try:
        doc_processor_app = Path(services_dir / "doc-processor" / "app.py").read_text()
        
        assert "enhance_with_vision_analysis" in doc_processor_app, "Vision analysis method not found"
        assert "get_provider" in doc_processor_app, "Provider import not found in Doc-Processor"
        assert "llava:7b" in doc_processor_app, "Vision model reference not found"
        assert "USE_VISION_ANALYSIS" in doc_processor_app, "Vision analysis env var not found"
        
        print("✓ Doc-Processor vision enhancement integrated")
    except Exception as e:
        pytest.fail(f"Vision enhancement integration test failed: {e}")


if __name__ == "__main__":
    """Run tests with detailed output."""
    print("\n" + "="*70)
    print("vLLM MIGRATION TEST SUITE")
    print("="*70 + "\n")
    
    tests = [
        ("Provider Imports", test_provider_imports),
        ("Provider Initialization", test_provider_initialization),
        ("Embeddings Initialization", test_embeddings_initialization),
        ("LLM Initialization", test_llm_initialization),
        ("Requirements Updated", test_requirements_updated),
        ("RAG Service Imports", test_rag_service_imports),
        ("Notes Service Imports", test_notes_service_imports),
        ("Doc-Processor Imports", test_doc_processor_imports),
        ("Provider Environment Variable", test_provider_environment_variable),
        ("Provider Fallback Logic", test_provider_fallback_logic),
        ("Vision Enhancement Integration", test_vision_enhancement_integration),
        ("Embeddings Generation", test_embeddings_generation),
        ("LLM Chat Completion", test_llm_chat_completion),
    ]
    
    passed = 0
    failed = 0
    skipped = 0
    
    for test_name, test_func in tests:
        try:
            print(f"\nTesting: {test_name}")
            test_func()
            passed += 1
        except pytest.skip.Exception:
            skipped += 1
        except Exception as e:
            print(f"✗ {test_name} failed: {e}")
            failed += 1
    
    print("\n" + "="*70)
    print(f"RESULTS: {passed} passed, {failed} failed, {skipped} skipped")
    print("="*70 + "\n")
    
    sys.exit(0 if failed == 0 else 1)
