#!/usr/bin/env python3
"""
Integration test for the enhanced OCR demo - validates code structure and imports
"""

import sys
import os
import ast
import inspect

def test_file_structure():
    """Test that all required files exist"""
    print("📁 Testing File Structure...")
    print("-" * 30)

    required_files = [
        'OCRDemo/src/ocr_processor.py',
        'OCRDemo/src/ollama_analyzer.py',
        'OCRDemo/src/main.py',
        'OCRDemo/templates/dashboard.html',
        'OCRDemo/static/js/dashboard.js'
    ]

    all_exist = True
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path}")
            all_exist = False

    return all_exist

def test_python_syntax():
    """Test that Python files have valid syntax"""
    print("\n🐍 Testing Python Syntax...")
    print("-" * 30)

    python_files = [
        'OCRDemo/src/ocr_processor.py',
        'OCRDemo/src/ollama_analyzer.py',
        'OCRDemo/src/main.py'
    ]

    all_valid = True
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                code = f.read()
            ast.parse(code)
            print(f"✅ {file_path} - Valid syntax")
        except SyntaxError as e:
            print(f"❌ {file_path} - Syntax error: {e}")
            all_valid = False
        except FileNotFoundError:
            print(f"❌ {file_path} - File not found")
            all_valid = False

    return all_valid

def test_key_functions():
    """Test that key functions and classes are properly defined"""
    print("\n🔧 Testing Key Functions...")
    print("-" * 30)

    # Test OCR Processor
    try:
        with open('OCRDemo/src/ocr_processor.py', 'r') as f:
            ocr_code = f.read()

        # Check for key methods
        required_methods = [
            'extract_client_info_with_ai',
            '_extract_client_info_regex',
            'extract_client_info'
        ]

        for method in required_methods:
            if f"def {method}" in ocr_code or f"async def {method}" in ocr_code:
                print(f"✅ OCRProcessor.{method} - Found")
            else:
                print(f"❌ OCRProcessor.{method} - Missing")

    except FileNotFoundError:
        print("❌ OCRProcessor file not found")

    # Test Ollama Analyzer
    try:
        with open('OCRDemo/src/ollama_analyzer.py', 'r') as f:
            ollama_code = f.read()

        # Check for key methods
        ollama_methods = [
            'analyze_document',
            '_build_analysis_prompt',
            '_parse_json_response',
            '_validate_and_clean_data'
        ]

        for method in ollama_methods:
            if f"def {method}" in ollama_code or f"async def {method}" in ollama_code:
                print(f"✅ OllamaDocumentAnalyzer.{method} - Found")
            else:
                print(f"❌ OllamaDocumentAnalyzer.{method} - Missing")

    except FileNotFoundError:
        print("❌ OllamaDocumentAnalyzer file not found")

def test_api_integration():
    """Test that main.py has the enhanced API endpoint"""
    print("\n🌐 Testing API Integration...")
    print("-" * 30)

    try:
        with open('OCRDemo/src/main.py', 'r') as f:
            main_code = f.read()

        # Check for enhanced document details endpoint
        if 'ai_extracted_info' in main_code:
            print("✅ AI extracted info integration - Found")
        else:
            print("❌ AI extracted info integration - Missing")

        # Check for asyncio integration
        if 'asyncio' in main_code and 'extract_client_info_with_ai' in main_code:
            print("✅ Async AI analysis integration - Found")
        else:
            print("❌ Async AI analysis integration - Missing")

        # Check for ollama_analyzer import
        if 'from ollama_analyzer import' in main_code:
            print("✅ Ollama analyzer import - Found")
        else:
            print("❌ Ollama analyzer import - Missing")

    except FileNotFoundError:
        print("❌ main.py file not found")

def test_frontend_integration():
    """Test that frontend has AI analysis display"""
    print("\n🎨 Testing Frontend Integration...")
    print("-" * 30)

    # Test HTML template
    try:
        with open('OCRDemo/templates/dashboard.html', 'r') as f:
            html_code = f.read()

        ai_elements = [
            'ai-extraction-method',
            'ai-client-name',
            'ai-debt-type',
            'ai-debt-amount',
            'AI-Enhanced Document Analysis'
        ]

        for element in ai_elements:
            if element in html_code:
                print(f"✅ HTML: {element} - Found")
            else:
                print(f"❌ HTML: {element} - Missing")

    except FileNotFoundError:
        print("❌ dashboard.html file not found")

    # Test JavaScript
    try:
        with open('OCRDemo/static/js/dashboard.js', 'r') as f:
            js_code = f.read()

        js_functions = [
            'updateAIAnalysisTab',
            'ai_extracted_info',
            'extraction_method'
        ]

        for func in js_functions:
            if func in js_code:
                print(f"✅ JS: {func} - Found")
            else:
                print(f"❌ JS: {func} - Missing")

    except FileNotFoundError:
        print("❌ dashboard.js file not found")

def test_prompt_engineering():
    """Test that the AI prompt is properly structured"""
    print("\n🤖 Testing AI Prompt Engineering...")
    print("-" * 30)

    try:
        with open('OCRDemo/src/ollama_analyzer.py', 'r') as f:
            code = f.read()

        prompt_elements = [
            'debt advisor',
            'priority debt',
            'non-priority debt',
            'JSON format',
            'file_summary',
            'client_name',
            'debt_type',
            'debt_amount',
            'creditor_name'
        ]

        for element in prompt_elements:
            if element.lower() in code.lower():
                print(f"✅ Prompt: {element} - Found")
            else:
                print(f"❌ Prompt: {element} - Missing")

    except FileNotFoundError:
        print("❌ ollama_analyzer.py file not found")

def main():
    """Run all integration tests"""
    print("🧪 OCR Demo AI Enhancement Integration Test")
    print("=" * 60)

    # Run all tests
    tests = [
        ("File Structure", test_file_structure),
        ("Python Syntax", test_python_syntax),
        ("Key Functions", test_key_functions),
        ("API Integration", test_api_integration),
        ("Frontend Integration", test_frontend_integration),
        ("Prompt Engineering", test_prompt_engineering)
    ]

    results = []
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
            results.append((test_name, False))

    # Summary
    print("\n📋 Integration Test Summary:")
    print("=" * 40)

    passed = 0
    total = len(results)

    for test_name, success in results:
        status = "PASS" if success else "FAIL"
        icon = "✅" if success else "❌"
        print(f"{icon} {test_name}: {status}")
        if success:
            passed += 1

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All integration tests passed!")
        print("✅ OCR Demo AI enhancement is properly integrated")
        print("\nReady for deployment and testing with real documents!")
    else:
        print(f"\n⚠️  {total - passed} tests failed - review implementation")

    return passed == total

if __name__ == "__main__":
    main()