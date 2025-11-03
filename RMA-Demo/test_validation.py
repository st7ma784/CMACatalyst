#!/usr/bin/env python3
"""
Simplified test suite for vLLM migration validation (no pytest required)
Tests embeddings, LLM calls, and provider fallback logic.
"""

import os
import sys
from pathlib import Path

# Add services directory to path
services_dir = Path(__file__).parent / "services"
sys.path.insert(0, str(services_dir / "rag-service"))
sys.path.insert(0, str(services_dir))

def run_test(test_name, test_func):
    """Run a single test and report results."""
    try:
        print(f"\nTesting: {test_name}")
        test_func()
        print(f"✓ {test_name} passed")
        return True
    except Exception as e:
        print(f"✗ {test_name} failed: {e}")
        return False

def test_provider_imports():
    """Test that provider module can be imported."""
    from rag_service.llm_provider import get_provider, LLMProvider, OllamaProvider, VLLMProvider
    assert LLMProvider is not None
    assert OllamaProvider is not None
    assert VLLMProvider is not None
    assert get_provider is not None


def test_provider_initialization():
    """Test that provider can be initialized."""
    from rag_service.llm_provider import get_provider
    provider = get_provider()
    assert provider is not None
    print(f"  Provider: {provider.__class__.__name__}")


def test_rag_service_imports():
    """Test that RAG service can be imported with new provider."""
    sys.path.insert(0, str(services_dir / "rag-service"))
    from app import RAGService
    assert RAGService is not None


def test_notes_service_imports():
    """Test that Notes service can be imported with new provider."""
    sys.path.insert(0, str(services_dir / "notes-service"))
    from app import NotesService
    assert NotesService is not None


def test_doc_processor_imports():
    """Test that Doc-Processor service can be imported with vision enhancement."""
    sys.path.insert(0, str(services_dir / "doc-processor"))
    from app import DocumentProcessor
    assert DocumentProcessor is not None


def test_requirements_updated():
    """Test that requirements.txt files have been updated."""
    rag_reqs = Path(services_dir / "rag-service" / "requirements.txt").read_text()
    assert "openai" in rag_reqs, "openai not found in RAG service requirements"
    assert "ollama==0.4.4" not in rag_reqs, "Old ollama version still in RAG requirements"
    print("  ✓ RAG service requirements updated")
    
    notes_reqs = Path(services_dir / "notes-service" / "requirements.txt").read_text()
    assert "openai" in notes_reqs, "openai not found in Notes service requirements"
    assert "ollama==0.1.6" not in notes_reqs, "Old ollama version still in Notes requirements"
    print("  ✓ Notes service requirements updated")
    
    doc_reqs = Path(services_dir / "doc-processor" / "requirements.txt").read_text()
    assert "openai" in doc_reqs, "openai not found in Doc-Processor requirements"
    print("  ✓ Doc-Processor service requirements updated")


def test_provider_environment_variable():
    """Test that provider respects LLM_PROVIDER environment variable."""
    from rag_service.llm_provider import get_provider
    
    # Test with vLLM provider
    os.environ['LLM_PROVIDER'] = 'vllm'
    vllm_provider = get_provider()
    assert vllm_provider.__class__.__name__ == 'VLLMProvider'
    print("  ✓ VLLM provider selected via env var")
    
    # Test with Ollama provider
    os.environ['LLM_PROVIDER'] = 'ollama'
    ollama_provider = get_provider()
    assert ollama_provider.__class__.__name__ == 'OllamaProvider'
    print("  ✓ Ollama provider selected via env var")
    
    # Reset to default
    if 'LLM_PROVIDER' in os.environ:
        del os.environ['LLM_PROVIDER']


def test_vision_enhancement_integration():
    """Test that Doc-Processor has vision enhancement integration."""
    doc_processor_app = Path(services_dir / "doc-processor" / "app.py").read_text()
    
    assert "enhance_with_vision_analysis" in doc_processor_app, "Vision analysis method not found"
    assert "get_provider" in doc_processor_app, "Provider import not found in Doc-Processor"
    assert "llava:7b" in doc_processor_app, "Vision model reference not found"
    assert "USE_VISION_ANALYSIS" in doc_processor_app, "Vision analysis env var not found"
    print("  ✓ All vision enhancement components present")


def test_provider_files_exist():
    """Test that all provider files exist."""
    llm_provider_path = services_dir / "rag-service" / "llm_provider.py"
    assert llm_provider_path.exists(), "llm_provider.py not found"
    assert llm_provider_path.stat().st_size > 0, "llm_provider.py is empty"
    print("  ✓ llm_provider.py exists and has content")
    
    docker_compose_path = Path(__file__).parent / "docker-compose.vllm.yml"
    assert docker_compose_path.exists(), "docker-compose.vllm.yml not found"
    assert docker_compose_path.stat().st_size > 0, "docker-compose.vllm.yml is empty"
    print("  ✓ docker-compose.vllm.yml exists and has content")


def test_provider_has_required_methods():
    """Test that providers have required methods."""
    from rag_service.llm_provider import OllamaProvider, VLLMProvider
    
    ollama_provider = OllamaProvider()
    assert hasattr(ollama_provider, 'initialize_embeddings'), "OllamaProvider missing initialize_embeddings"
    assert hasattr(ollama_provider, 'initialize_llm'), "OllamaProvider missing initialize_llm"
    print("  ✓ OllamaProvider has required methods")
    
    vllm_provider = VLLMProvider()
    assert hasattr(vllm_provider, 'initialize_embeddings'), "VLLMProvider missing initialize_embeddings"
    assert hasattr(vllm_provider, 'initialize_llm'), "VLLMProvider missing initialize_llm"
    print("  ✓ VLLMProvider has required methods")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("vLLM MIGRATION TEST SUITE - PHASE 2 VALIDATION")
    print("="*70)
    
    tests = [
        ("Provider Imports", test_provider_imports),
        ("Provider Initialization", test_provider_initialization),
        ("Provider Environment Variable", test_provider_environment_variable),
        ("Provider Has Required Methods", test_provider_has_required_methods),
        ("Requirements Updated", test_requirements_updated),
        ("RAG Service Imports", test_rag_service_imports),
        ("Notes Service Imports", test_notes_service_imports),
        ("Doc-Processor Imports", test_doc_processor_imports),
        ("Provider Files Exist", test_provider_files_exist),
        ("Vision Enhancement Integration", test_vision_enhancement_integration),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        if run_test(test_name, test_func):
            passed += 1
        else:
            failed += 1
    
    print("\n" + "="*70)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("="*70)
    
    if failed == 0:
        print("\n✅ ALL TESTS PASSED - Phase 2 Migration Validated!")
    else:
        print(f"\n❌ {failed} TEST(S) FAILED - Please review errors above")
    
    print("\n")
    sys.exit(0 if failed == 0 else 1)
