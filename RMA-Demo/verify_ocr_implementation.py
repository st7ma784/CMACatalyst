#!/usr/bin/env python3
"""
OCR Service Implementation Verification Script
Checks that all files are created and configured correctly
"""

import os
import json
import sys
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def check(condition, message):
    """Print check result"""
    if condition:
        print(f"{Colors.GREEN}✓{Colors.RESET} {message}")
        return True
    else:
        print(f"{Colors.RED}✗{Colors.RESET} {message}")
        return False

def warn(message):
    """Print warning"""
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {message}")

def info(message):
    """Print info"""
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {message}")

def section(title):
    """Print section header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BOLD}{title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}\n")

def verify_ocr_service_implementation():
    """Verify OCR Service implementation"""
    section("OCR Service Implementation Verification")
    
    results = []
    base_path = Path(".")
    
    # ==================== Files Check ====================
    section("1. Files Verification")
    
    # Check OCR Service files
    ocr_service_files = [
        "services/ocr-service/app.py",
        "services/ocr-service/requirements.txt",
        "services/ocr-service/Dockerfile",
    ]
    
    for file in ocr_service_files:
        exists = (base_path / file).exists()
        results.append(check(exists, f"OCR Service file: {file}"))
        if exists and file.endswith(".py"):
            size = (base_path / file).stat().st_size
            info(f"  File size: {size:,} bytes")
    
    # Check Doc-Processor updated
    doc_processor_file = "services/doc-processor/app.py"
    exists = (base_path / doc_processor_file).exists()
    results.append(check(exists, f"Doc-Processor updated: {doc_processor_file}"))
    
    # Check Docker Compose updated
    docker_compose = "docker-compose.vllm.yml"
    exists = (base_path / docker_compose).exists()
    results.append(check(exists, f"Docker Compose: {docker_compose}"))
    
    # ==================== Documentation Check ====================
    section("2. Documentation Verification")
    
    docs = [
        "OCR_SERVICE_QUICK_START.md",
        "OCR_SERVICE_VISUAL_SUMMARY.md",
        "OCR_SERVICE_MIGRATION_SUMMARY.md",
        "OCR_SERVICE_INTEGRATION_GUIDE.md",
        "OCR_SERVICE_DEPLOYMENT_CHECKLIST.md",
        "OCR_SERVICE_INDEX.md",
    ]
    
    for doc in docs:
        exists = (base_path / doc).exists()
        results.append(check(exists, f"Documentation: {doc}"))
        if exists:
            size = (base_path / doc).stat().st_size
            lines = sum(1 for _ in open(base_path / doc))
            info(f"  Lines: {lines:,}, Size: {size:,} bytes")
    
    # ==================== Content Validation ====================
    section("3. Content Validation")
    
    # Check OCR Service app.py contains key components
    ocr_app = base_path / "services/ocr-service/app.py"
    if ocr_app.exists():
        content = ocr_app.read_text()
        
        checks = [
            ("OllamaOCRService class", "class OllamaOCRService" in content),
            ("Health endpoint", "@app.get(\"/health\")" in content),
            ("Process endpoint", "@app.post(\"/process\")" in content),
            ("Models endpoint", "@app.get(\"/models\")" in content),
            ("Hybrid OCR method", "def ocr_hybrid" in content),
            ("Tesseract fallback", "process_with_tesseract" in content),
        ]
        
        for check_name, result in checks:
            results.append(check(result, f"OCR Service contains: {check_name}"))
    
    # Check Doc-Processor app.py has OCR integration
    doc_proc = base_path / "services/doc-processor/app.py"
    if doc_proc.exists():
        content = doc_proc.read_text()
        
        checks = [
            ("OCR Service URL config", "OCR_SERVICE_URL" in content),
            ("Health response model", "class HealthResponse" in content),
            ("OCR service check method", "_check_ocr_service" in content),
            ("Process with OCR method", "process_with_ocr_service" in content),
            ("3-level fallback", "LlamaParse" in content and "ocr_service" in content and "tesseract" in content),
        ]
        
        for check_name, result in checks:
            results.append(check(result, f"Doc-Processor contains: {check_name}"))
    
    # Check Docker Compose updated
    docker_file = base_path / "docker-compose.vllm.yml"
    if docker_file.exists():
        content = docker_file.read_text()
        
        checks = [
            ("OCR Service definition", "ocr-service:" in content),
            ("OCR Service port 8104", "- \"8104:8104\"" in content),
            ("Ollama URL config", "OLLAMA_URL=http://ollama:11434" in content),
            ("Vision model config", "VISION_MODEL=" in content),
            ("Doc-Processor OCR URL", "OCR_SERVICE_URL=http://ocr-service:8104" in content),
            ("Port updates (8105)", "- \"8105:8105\"" in content),
        ]
        
        for check_name, result in checks:
            results.append(check(result, f"Docker Compose contains: {check_name}"))
    
    # ==================== Requirements Check ====================
    section("4. Requirements Verification")
    
    req_files = [
        "services/ocr-service/requirements.txt",
        "services/doc-processor/requirements.txt",
    ]
    
    for req_file in req_files:
        path = base_path / req_file
        if path.exists():
            content = path.read_text()
            
            if "ocr-service" in req_file:
                checks = [
                    ("fastapi", "fastapi" in content),
                    ("requests", "requests" in content),
                    ("pdf2image", "pdf2image" in content),
                    ("pytesseract", "pytesseract" in content),
                ]
            else:
                checks = [
                    ("fastapi", "fastapi" in content),
                    ("requests", "requests" in content),
                ]
            
            for check_name, result in checks:
                results.append(check(result, f"{req_file}: {check_name}"))
    
    # ==================== File Sizes ====================
    section("5. File Size Summary")
    
    files_to_check = [
        ("services/ocr-service/app.py", 400),  # Should be 400+ lines
        ("services/doc-processor/app.py", 200),  # Should be 200+ lines modified
        ("OCR_SERVICE_QUICK_START.md", 3000),  # Should be 3KB+
        ("OCR_SERVICE_INTEGRATION_GUIDE.md", 10000),  # Should be 10KB+
    ]
    
    for file, min_size in files_to_check:
        path = base_path / file
        if path.exists():
            size = path.stat().st_size
            status = "✓" if size >= min_size else "⚠"
            print(f"{Colors.GREEN}{status}{Colors.RESET} {file}: {size:,} bytes (min: {min_size:,})")
    
    # ==================== Summary ====================
    section("6. Verification Summary")
    
    passed = sum(results)
    total = len(results)
    percentage = (passed / total) * 100 if total > 0 else 0
    
    print(f"\n{Colors.BOLD}Results:{Colors.RESET}")
    print(f"  {Colors.GREEN}Passed: {passed}/{total} ({percentage:.1f}%){Colors.RESET}")
    
    if percentage == 100:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ All checks passed! OCR Service implementation is complete.{Colors.RESET}")
        return True
    elif percentage >= 90:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ Most checks passed ({percentage:.0f}%). Review failures above.{Colors.RESET}")
        return False
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}✗ Implementation incomplete. Review failures above.{Colors.RESET}")
        return False

def print_next_steps():
    """Print next steps"""
    section("Next Steps")
    
    print(f"{Colors.BOLD}1. Deploy:{Colors.RESET}")
    print("   docker-compose -f docker-compose.vllm.yml up -d")
    print()
    
    print(f"{Colors.BOLD}2. Test OCR Service:{Colors.RESET}")
    print("   curl -F \"file=@sample.pdf\" http://localhost:8104/process | jq .")
    print()
    
    print(f"{Colors.BOLD}3. Check Health:{Colors.RESET}")
    print("   curl http://localhost:8104/health | jq .")
    print("   curl http://localhost:8101/health | jq .")
    print()
    
    print(f"{Colors.BOLD}4. Monitor GPU:{Colors.RESET}")
    print("   watch -n 1 nvidia-smi")
    print()
    
    print(f"{Colors.BOLD}5. Follow deployment guide:{Colors.RESET}")
    print("   See: OCR_SERVICE_DEPLOYMENT_CHECKLIST.md")
    print()

if __name__ == "__main__":
    print(f"\n{Colors.BOLD}{Colors.BLUE}OCR Service Implementation Verification{Colors.RESET}\n")
    
    success = verify_ocr_service_implementation()
    print_next_steps()
    
    sys.exit(0 if success else 1)
