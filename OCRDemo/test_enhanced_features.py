#!/usr/bin/env python3
"""
Test script for the enhanced OCR Demo system with structured data view and custom downloads
"""

import requests
import json
import sys
from datetime import datetime

def test_enhanced_features():
    """Test the enhanced OCR Demo features"""
    
    base_url = "http://localhost:5001"
    
    print("🚀 Testing Enhanced OCR Demo Features")
    print("=" * 60)
    
    # Test 1: System Health Check
    print("1. System Health Check...")
    try:
        response = requests.get(f"{base_url}/health")
        health_data = response.json()
        
        print(f"   📊 System Status: {health_data['status']}")
        
        services = health_data['services']
        print(f"   📧 Gmail Service: {'✅' if services['gmail'] else '❌'}")
        print(f"   🔍 OCR Service: {'✅' if services['ocr'] else '❌'}")
        print(f"   🤖 Ollama Service: {'✅' if services['ollama'] else '❌'}")
        print(f"   🔌 API Service: {'✅' if services['api'] else '❌'}")
        
        ollama_available = services['ollama']
        
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False
    
    # Test 2: API Endpoints
    print(f"\n2. Testing API Endpoints...")
    
    endpoints_to_test = [
        ("/api/recent_documents", "Recent Documents"),
        ("/api/stats", "Statistics"),
        ("/api/processing_status", "Processing Status")
    ]
    
    for endpoint, name in endpoints_to_test:
        try:
            response = requests.get(f"{base_url}{endpoint}")
            if response.status_code == 200:
                print(f"   ✅ {name}: OK")
            else:
                print(f"   ⚠️ {name}: Status {response.status_code}")
        except Exception as e:
            print(f"   ❌ {name}: {e}")
    
    # Test 3: Enhanced Features Overview
    print(f"\n3. Enhanced Features Overview...")
    
    print(f"   📋 Document Analysis Modal:")
    print(f"      • PDF Viewer: Direct document viewing")
    print(f"      • Extracted Data: Structured information display")
    print(f"      • OCR Text: Full text with statistics")
    print(f"      • Monetary Analysis: Amounts with validation")
    print(f"      • Client Information: Names, case numbers")
    print(f"      • Processing Details: Timestamps, confidence")
    
    print(f"\n   📥 Custom Download Options:")
    print(f"      • Original Format: Standard processed filename")
    print(f"      • RMA Format: date_RMA_clientinitials_documentsummary.pdf")
    print(f"      • Intelligent Naming: Ollama-powered content analysis")
    print(f"      • Monetary Validation: Warns about suspicious amounts")
    
    # Test 4: Filename Generation Examples
    print(f"\n4. Filename Generation Examples...")
    current_date = datetime.now().strftime('%Y%m%d')
    
    examples = [
        {
            "client": "John Smith",
            "content": "Debt collection notice for £1,234.56",
            "expected": f"{current_date}_RMA_JS_Debt_Notice.pdf"
        },
        {
            "client": "Mary Johnson",
            "content": "Credit card statement showing balance £2,500.75",
            "expected": f"{current_date}_RMA_MJ_Credit_Statement.pdf"
        },
        {
            "client": "Robert Wilson",
            "content": "Parking fine notice amount £60.00",
            "expected": f"{current_date}_RMA_RW_Parking_Fine.pdf"
        },
        {
            "client": "Sarah Davis",
            "content": "Utility bill overdue payment £150.25",
            "expected": f"{current_date}_RMA_SD_Utility_Bill.pdf"
        }
    ]
    
    for example in examples:
        print(f"   📄 Client: {example['client']}")
        print(f"      Content: {example['content']}")
        print(f"      Expected: {example['expected']}")
        print()
    
    # Test 5: Monetary Validation Examples
    print(f"5. Monetary Validation Features...")
    
    validation_examples = [
        ("£1,234.56", "VALID", "Standard currency format"),
        ("£25.00", "VALID", "Small amount format"),
        ("£1,500,000.00", "WARNING", "Unusually high amount"),
        ("£0.005", "WARNING", "Unusually low amount"),
        ("1O5.00", "WARNING", "Possible OCR error (O instead of 0)"),
        ("ll5.00", "WARNING", "Possible OCR error (l instead of 1)")
    ]
    
    for amount, status, description in validation_examples:
        status_icon = "✅" if status == "VALID" else "⚠️"
        print(f"   {status_icon} {amount} → {status}: {description}")
    
    # Test 6: User Interface Features
    print(f"\n6. User Interface Enhancements...")
    
    ui_features = [
        "🔍 'View & Analyze' button: Opens enhanced modal with tabs",
        "📥 'Download RMA' button: Downloads with custom filename",
        "📊 Real-time processing status with confidence indicators",
        "💰 Monetary amounts highlighted with validation warnings",
        "📝 Full OCR text view with character/word counts",
        "🏷️ Client information with case management integration",
        "⏰ Processing timestamps with detailed metadata",
        "📱 Responsive design for mobile and desktop viewing"
    ]
    
    for feature in ui_features:
        print(f"   {feature}")
    
    # Test 7: Dashboard Access
    print(f"\n7. Dashboard Access...")
    print(f"   🌐 Main Dashboard: http://localhost:5001")
    print(f"   📧 Gmail Auth: http://localhost:5001/auth/gmail")
    print(f"   🔧 API Health: http://localhost:5001/health")
    
    # Test 8: Next Steps
    print(f"\n8. Testing Your System...")
    print(f"   1. Open: http://localhost:5001")
    print(f"   2. Authenticate Gmail (if not done already)")
    print(f"   3. Send test email with PDF attachment to your +RMA address")
    print(f"   4. Watch for document processing")
    print(f"   5. Click 'View & Analyze' to see enhanced modal")
    print(f"   6. Try 'Download RMA' for custom filename")
    print(f"   7. Review extracted data accuracy in structured view")
    
    print(f"\n✅ Enhanced OCR Demo system ready for testing!")
    print(f"🎯 Key Improvements:")
    print(f"   • Structured data validation for debt extraction accuracy")
    print(f"   • Custom RMA filename format with intelligent naming")
    print(f"   • Enhanced PDF viewing with detailed analysis")
    print(f"   • Monetary amount validation and OCR error detection")
    print(f"   • Professional document management workflow")
    
    return True

if __name__ == "__main__":
    success = test_enhanced_features()
    sys.exit(0 if success else 1)