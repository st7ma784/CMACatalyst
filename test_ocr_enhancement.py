#!/usr/bin/env python3
"""
Test script for the enhanced OCR demo with AI analysis
"""

import sys
import os
import asyncio
import json
from typing import Dict

# Add the OCRDemo/src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'OCRDemo', 'src'))

try:
    from ocr_processor import OCRProcessor
    from ollama_analyzer import OllamaDocumentAnalyzer
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running this from the project root directory")
    sys.exit(1)


async def test_ai_analysis():
    """Test the AI-enhanced OCR analysis"""
    print("🧪 Testing AI-Enhanced OCR Analysis")
    print("=" * 50)

    # Sample document text that simulates OCR output
    sample_text = """
    MORTGAGE STATEMENT

    Dear Mr. John Smith,

    Account Number: MORT123456789
    Date: 15/10/2024

    We are writing to inform you about your mortgage account.

    Current Balance: £45,000.00
    Monthly Payment: £1,250.00
    Arrears Amount: £5,000.00

    Property Address: 123 Main Street, London, SW1A 1AA

    This is an urgent matter that requires immediate attention.
    Please contact us immediately to discuss payment arrangements.

    Yours sincerely,
    Halifax Building Society
    Customer Services Department
    """

    print("📄 Sample Document Text:")
    print("-" * 30)
    print(sample_text[:200] + "..." if len(sample_text) > 200 else sample_text)
    print("\n")

    # Initialize the OCR processor
    print("🔧 Initializing OCR Processor...")
    ocr_processor = OCRProcessor()

    # Test AI analysis
    print("🤖 Testing AI Analysis...")
    try:
        ai_result = await ocr_processor.extract_client_info_with_ai(sample_text)

        print("✅ AI Analysis Results:")
        print(json.dumps(ai_result, indent=2, default=str))

        # Test fallback analysis
        print("\n🔄 Testing Fallback Analysis...")
        fallback_result = ocr_processor._extract_client_info_regex(sample_text)

        print("✅ Fallback Analysis Results:")
        print(json.dumps(fallback_result, indent=2, default=str))

        # Compare results
        print("\n📊 Comparison:")
        print(f"AI Method: {ai_result.get('extraction_method', 'unknown')}")
        print(f"AI Client Name: {ai_result.get('client_name', 'unknown')}")
        print(f"AI Debt Amount: £{ai_result.get('debt_amount', 0)}")
        print(f"AI Debt Type: {ai_result.get('debt_type', 'unknown')}")
        print(f"AI Creditor: {ai_result.get('creditor_name', 'unknown')}")

        print(f"\nFallback Client Name: {fallback_result.get('client_name', 'unknown')}")
        print(f"Fallback Debt Amount: £{fallback_result.get('debt_amount', 0)}")
        print(f"Fallback Method: {fallback_result.get('extraction_method', 'unknown')}")

        return True

    except Exception as e:
        print(f"❌ AI Analysis Failed: {e}")
        print("This might be expected if Ollama is not running")
        return False


async def test_ollama_connection():
    """Test direct connection to Ollama service"""
    print("\n🔌 Testing Ollama Connection...")
    print("-" * 30)

    try:
        analyzer = OllamaDocumentAnalyzer()
        is_connected = await analyzer.test_connection()

        if is_connected:
            print("✅ Ollama service is available")
            return True
        else:
            print("❌ Ollama service is not available")
            return False

    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False


def test_regex_fallback():
    """Test the regex fallback functionality"""
    print("\n🔧 Testing Regex Fallback...")
    print("-" * 30)

    sample_text = """
    Credit Card Statement

    Dear Mrs. Sarah Johnson,

    Account: CC987654321
    Statement Date: 20/10/2024

    Outstanding Balance: £2,500.00
    Minimum Payment: £125.00

    This is a priority debt notice.

    Barclaycard Services
    """

    try:
        ocr_processor = OCRProcessor()
        result = ocr_processor._extract_client_info_regex(sample_text)

        print("✅ Regex Analysis Results:")
        print(json.dumps(result, indent=2, default=str))
        return True

    except Exception as e:
        print(f"❌ Regex analysis failed: {e}")
        return False


async def main():
    """Main test function"""
    print("🚀 Starting Enhanced OCR Demo Tests")
    print("=" * 60)

    # Test 1: Ollama connection
    ollama_available = await test_ollama_connection()

    # Test 2: Regex fallback (should always work)
    regex_works = test_regex_fallback()

    # Test 3: AI analysis (may fail if Ollama is not available)
    ai_works = await test_ai_analysis()

    # Summary
    print("\n📋 Test Summary:")
    print("=" * 30)
    print(f"✅ Regex Fallback: {'PASS' if regex_works else 'FAIL'}")
    print(f"🔌 Ollama Connection: {'PASS' if ollama_available else 'FAIL'}")
    print(f"🤖 AI Analysis: {'PASS' if ai_works else 'FAIL'}")

    if regex_works:
        print("\n✅ Enhanced OCR system is functional!")
        if not ollama_available:
            print("ℹ️  Note: Ollama is not available, but fallback is working")
        else:
            print("🎉 Full AI-enhanced analysis is available!")
    else:
        print("\n❌ System has issues that need to be resolved")

    return regex_works


if __name__ == "__main__":
    asyncio.run(main())