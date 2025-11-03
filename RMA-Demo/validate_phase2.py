#!/usr/bin/env python3
"""
Phase 2 Migration Validation - Static Code Analysis
Validates all file changes without requiring service dependencies
"""

import os
import sys
from pathlib import Path
import re

def print_header(title):
    """Print a formatted header."""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

def validate_file_exists(path, description):
    """Check if a file exists."""
    exists = Path(path).exists()
    status = "✓" if exists else "✗"
    print(f"  {status} {description}")
    return exists

def validate_text_in_file(path, text, description, should_exist=True):
    """Check if text exists in a file."""
    if not Path(path).exists():
        print(f"  ✗ {description} - File not found")
        return False
    
    try:
        content = Path(path).read_text(encoding='utf-8', errors='ignore')
    except:
        try:
            content = Path(path).read_text(encoding='latin-1', errors='ignore')
        except:
            content = Path(path).read_text(errors='ignore')
    
    found = text in content
    matches_expectation = found == should_exist
    status = "✓" if matches_expectation else "✗"
    
    if should_exist:
        print(f"  {status} {description}")
    else:
        print(f"  {status} {description} (should not exist)")
    
    return matches_expectation

def main():
    print_header("PHASE 2 vLLM MIGRATION - VALIDATION REPORT")
    
    base_path = Path(__file__).parent
    services_path = base_path / "services"
    
    results = {}
    
    # ==================== FILE EXISTENCE CHECKS ====================
    print_header("1. File Structure Validation")
    
    results['rag_reqs'] = validate_file_exists(
        services_path / "rag-service" / "requirements.txt",
        "RAG Service requirements.txt"
    )
    results['rag_app'] = validate_file_exists(
        services_path / "rag-service" / "app.py",
        "RAG Service app.py"
    )
    results['provider'] = validate_file_exists(
        services_path / "rag-service" / "llm_provider.py",
        "Provider abstraction layer (llm_provider.py)"
    )
    results['notes_reqs'] = validate_file_exists(
        services_path / "notes-service" / "requirements.txt",
        "Notes Service requirements.txt"
    )
    results['notes_app'] = validate_file_exists(
        services_path / "notes-service" / "app.py",
        "Notes Service app.py"
    )
    results['doc_reqs'] = validate_file_exists(
        services_path / "doc-processor" / "requirements.txt",
        "Doc-Processor requirements.txt"
    )
    results['doc_app'] = validate_file_exists(
        services_path / "doc-processor" / "app.py",
        "Doc-Processor app.py"
    )
    results['docker_compose'] = validate_file_exists(
        base_path / "docker-compose.vllm.yml",
        "Docker Compose multi-GPU setup"
    )
    results['test_suite'] = validate_file_exists(
        base_path / "test_validation.py",
        "Test validation suite"
    )
    
    # ==================== RAG SERVICE VALIDATION ====================
    print_header("2. RAG Service Validation")
    
    rag_reqs_path = services_path / "rag-service" / "requirements.txt"
    rag_app_path = services_path / "rag-service" / "app.py"
    
    results['rag_openai'] = validate_text_in_file(
        rag_reqs_path,
        "openai>=1.0.0",
        "RAG requirements includes openai SDK"
    )
    results['rag_old_ollama'] = validate_text_in_file(
        rag_reqs_path,
        "ollama==0.4.4",
        "RAG requirements does NOT include old ollama",
        should_exist=False
    )
    results['rag_provider_import'] = validate_text_in_file(
        rag_app_path,
        "from llm_provider import get_provider",
        "RAG app.py imports provider"
    )
    results['rag_no_ollama_import'] = validate_text_in_file(
        rag_app_path,
        "from langchain_community.llms import Ollama",
        "RAG app.py does NOT import Ollama directly",
        should_exist=False
    )
    results['rag_initialize_embeddings'] = validate_text_in_file(
        rag_app_path,
        "self.provider.initialize_embeddings()",
        "RAG uses provider for embeddings"
    )
    results['rag_initialize_llm'] = validate_text_in_file(
        rag_app_path,
        "self.provider.initialize_llm",
        "RAG uses provider for LLM"
    )
    
    # ==================== NOTES SERVICE VALIDATION ====================
    print_header("3. Notes Service Validation")
    
    notes_reqs_path = services_path / "notes-service" / "requirements.txt"
    notes_app_path = services_path / "notes-service" / "app.py"
    
    results['notes_openai'] = validate_text_in_file(
        notes_reqs_path,
        "openai>=1.0.0",
        "Notes requirements includes openai SDK"
    )
    results['notes_old_ollama'] = validate_text_in_file(
        notes_reqs_path,
        "ollama==0.1.6",
        "Notes requirements does NOT include old ollama",
        should_exist=False
    )
    results['notes_provider_import'] = validate_text_in_file(
        notes_app_path,
        "from rag_service.llm_provider import get_provider",
        "Notes app.py imports provider"
    )
    results['notes_no_ollama_direct'] = validate_text_in_file(
        notes_app_path,
        "import ollama",
        "Notes app.py does NOT have direct ollama import at top",
        should_exist=False
    )
    results['notes_provider_init'] = validate_text_in_file(
        notes_app_path,
        "self.provider = get_provider()",
        "Notes initializes provider"
    )
    results['notes_convert_method'] = validate_text_in_file(
        notes_app_path,
        "def convert_notes_to_client_letter",
        "Notes has convert_notes_to_client_letter method"
    )
    
    # ==================== DOC-PROCESSOR VALIDATION ====================
    print_header("4. Doc-Processor Service Validation")
    
    doc_reqs_path = services_path / "doc-processor" / "requirements.txt"
    doc_app_path = services_path / "doc-processor" / "app.py"
    
    results['doc_openai'] = validate_text_in_file(
        doc_reqs_path,
        "openai>=1.0.0",
        "Doc-Processor requirements includes openai SDK"
    )
    results['doc_ollama'] = validate_text_in_file(
        doc_reqs_path,
        "ollama",
        "Doc-Processor requirements includes ollama SDK"
    )
    results['doc_provider_import'] = validate_text_in_file(
        doc_app_path,
        "from rag_service.llm_provider import get_provider",
        "Doc-Processor app.py imports provider"
    )
    results['doc_vision_init'] = validate_text_in_file(
        doc_app_path,
        "self.vision_provider = get_provider()",
        "Doc-Processor initializes vision provider"
    )
    results['doc_vision_enhancement'] = validate_text_in_file(
        doc_app_path,
        "def enhance_with_vision_analysis",
        "Doc-Processor has vision enhancement method"
    )
    results['doc_vision_model'] = validate_text_in_file(
        doc_app_path,
        "llava:7b",
        "Doc-Processor uses llava:7b vision model"
    )
    results['doc_use_vision_env'] = validate_text_in_file(
        doc_app_path,
        "USE_VISION_ANALYSIS",
        "Doc-Processor checks USE_VISION_ANALYSIS env var"
    )
    
    # ==================== PROVIDER ABSTRACTION VALIDATION ====================
    print_header("5. Provider Abstraction Layer Validation")
    
    provider_path = services_path / "rag-service" / "llm_provider.py"
    provider_content = provider_path.read_text() if provider_path.exists() else ""
    
    results['provider_abstract_class'] = validate_text_in_file(
        provider_path,
        "class LLMProvider(ABC):",
        "Provider has abstract base class"
    )
    results['provider_ollama_impl'] = validate_text_in_file(
        provider_path,
        "class OllamaProvider(LLMProvider):",
        "Provider has OllamaProvider implementation"
    )
    results['provider_vllm_impl'] = validate_text_in_file(
        provider_path,
        "class VLLMProvider(LLMProvider):",
        "Provider has VLLMProvider implementation"
    )
    results['provider_factory'] = validate_text_in_file(
        provider_path,
        "def get_provider()",
        "Provider has factory function"
    )
    results['provider_env_detection'] = validate_text_in_file(
        provider_path,
        "LLM_PROVIDER",
        "Provider detects LLM_PROVIDER environment variable"
    )
    
    # ==================== DOCKER COMPOSE VALIDATION ====================
    print_header("6. Docker Compose Setup Validation")
    
    docker_path = base_path / "docker-compose.vllm.yml"
    
    results['docker_vllm_service'] = validate_text_in_file(
        docker_path,
        "vllm:",
        "Docker Compose has vLLM service"
    )
    results['docker_ollama_service'] = validate_text_in_file(
        docker_path,
        "ollama:",
        "Docker Compose has Ollama service"
    )
    results['docker_gpu_vllm'] = validate_text_in_file(
        docker_path,
        "CUDA_VISIBLE_DEVICES: '1'",
        "Docker Compose allocates GPU 1 to vLLM"
    )
    results['docker_gpu_ollama'] = validate_text_in_file(
        docker_path,
        "CUDA_VISIBLE_DEVICES: '0'",
        "Docker Compose allocates GPU 0 to Ollama"
    )
    
    # ==================== SUMMARY ====================
    print_header("7. VALIDATION SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    failed = sum(1 for v in results.values() if not v)
    total = len(results)
    
    print(f"\n  Total Checks: {total}")
    print(f"  ✓ Passed: {passed}")
    print(f"  ✗ Failed: {failed}")
    print(f"  Success Rate: {(passed/total)*100:.1f}%")
    
    if failed == 0:
        print("\n" + "✓" * 35)
        print("  ✅ ALL VALIDATION CHECKS PASSED!")
        print("  Phase 2 Migration Complete & Verified")
        print("✓" * 35)
        return 0
    else:
        print("\n" + "✗" * 35)
        print(f"  ❌ {failed} VALIDATION CHECK(S) FAILED")
        print("  Please review failures above")
        print("✗" * 35)
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
