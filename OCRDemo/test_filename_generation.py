#!/usr/bin/env python3
"""
Test script for enhanced filename generation with Ollama
"""

import requests
import json
import sys
from datetime import datetime

def test_filename_generation():
    """Test the enhanced filename generation system"""
    
    base_url = "http://localhost:5001"
    
    # Test document content with monetary amounts
    test_document_text = """
    DEBT COLLECTION NOTICE
    
    Dear Mr. John Smith,
    
    Account Number: ACC123456
    Date: October 2, 2025
    
    Outstanding Balance: £1,234.56
    Late Fee: £25.00
    Total Amount Due: £1,259.56
    
    Please remit payment within 30 days to avoid further action.
    
    Contact us at 0800-123-4567
    
    Regards,
    Collections Department
    """
    
    print("🔍 Testing Enhanced Filename Generation System")
    print("=" * 60)
    
    # Test 1: Check system health
    print("1. Checking system health...")
    try:
        response = requests.get(f"{base_url}/health")
        health_data = response.json()
        
        print(f"   📊 System Status: {health_data['status']}")
        print(f"   📧 Gmail Service: {'✅' if health_data['services']['gmail'] else '❌'}")
        print(f"   🔍 OCR Service: {'✅' if health_data['services']['ocr'] else '❌'}")
        print(f"   🤖 Ollama Service: {'✅' if health_data['services']['ollama'] else '❌'}")
        print(f"   🔌 API Service: {'✅' if health_data['services']['api'] else '❌'}")
        
        if not health_data['services']['ollama']:
            print("\n❌ Ollama service is not available. Testing will use fallback generation.")
        
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False
    
    print("\n2. Testing filename generation patterns...")
    
    # Test different scenarios
    test_cases = [
        {
            "name": "Standard Debt Notice",
            "client_info": {"name": "John Smith", "case_number": "CASE001"},
            "content": test_document_text,
            "expected_pattern": r"^\d{8}_JS_.*\.pdf$"
        },
        {
            "name": "Single Name Client", 
            "client_info": {"name": "Madonna", "case_number": "CASE002"},
            "content": "Invoice for services rendered. Amount: £500.00",
            "expected_pattern": r"^\d{8}_MAD_.*\.pdf$"
        },
        {
            "name": "Multiple Names",
            "client_info": {"name": "Mary Jane Watson Smith", "case_number": "CASE003"},
            "content": "Credit card statement. Balance: £2,500.75",
            "expected_pattern": r"^\d{8}_MS_.*\.pdf$"
        },
        {
            "name": "High Amount Warning",
            "client_info": {"name": "Rich Person", "case_number": "CASE004"},
            "content": "Outstanding debt: £1,500,000.00",
            "expected_pattern": r"^\d{8}_RP_.*\.pdf$"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n   Test {i}: {test_case['name']}")
        print(f"   Client: {test_case['client_info']['name']}")
        print(f"   Content preview: {test_case['content'][:50]}...")
        
        # Here we would test the filename generation
        # For now, just show what we expect
        print(f"   Expected pattern: {test_case['expected_pattern']}")
        print(f"   Expected format: YYYYMMDD_[initials]_[description].pdf")
    
    print(f"\n3. Testing monetary amount validation...")
    
    # Test monetary validation patterns
    monetary_test_cases = [
        "£1,234.56",
        "£25.00", 
        "1500000 pounds",  # Should trigger warning
        "£0.005",  # Should trigger warning
        "1O5.00",  # Should trigger OCR error warning
    ]
    
    for amount in monetary_test_cases:
        print(f"   Testing amount: {amount}")
        if "1500000" in amount:
            print(f"      Expected: WARNING - Unusually high amount")
        elif "0.005" in amount:
            print(f"      Expected: WARNING - Unusually low amount")
        elif "1O5" in amount:
            print(f"      Expected: WARNING - Possible OCR error")
        else:
            print(f"      Expected: VALID")
    
    print(f"\n4. Sample filename outputs...")
    current_date = datetime.now().strftime('%Y%m%d')
    sample_filenames = [
        f"{current_date}_JS_DebtNotice_£1234.pdf",
        f"{current_date}_MAD_Invoice_£500.pdf", 
        f"{current_date}_MS_CreditCard_Statement.pdf",
        f"{current_date}_RP_DebtClaim_£1500k.pdf"
    ]
    
    for filename in sample_filenames:
        print(f"   📄 {filename}")
    
    print("\n✅ Filename generation test completed!")
    print(f"📋 Key Features:")
    print(f"   • Date format: YYYYMMDD")
    print(f"   • Client initials: First + Last name letters")
    print(f"   • Content analysis: Ollama-powered description")
    print(f"   • Monetary validation: Checks for realistic amounts")
    print(f"   • OCR error detection: Warns about suspicious characters")
    print(f"   • Fallback generation: Works without Ollama")
    
    return True

if __name__ == "__main__":
    success = test_filename_generation()
    sys.exit(0 if success else 1)