#!/usr/bin/env python3
"""
Test script to demonstrate automatic threshold detection and enrichment.
Shows how the system now understands numeric rules without explicit prompting.
"""

import sys
sys.path.append('./services/rag-service')

from numerical_tools import NumericalTools

def demo_basic_threshold_check():
    """Demo 1: Checking if amounts meet known thresholds"""
    print("=" * 70)
    print("DEMO 1: Automatic Threshold Checking")
    print("=" * 70)
    
    tools = NumericalTools()
    
    test_cases = [
        ("25000", "dro_max_debt", "Client with £25,000 debt"),
        ("60000", "dro_max_debt", "Client with £60,000 debt"),
        ("1500", "dro_max_assets", "Client with £1,500 assets"),
        ("2500", "dro_max_assets", "Client with £2,500 assets"),
    ]
    
    for amount, threshold, description in test_cases:
        print(f"\n{description}")
        print(f"Question: Does {amount} qualify for {threshold}?")
        
        result = tools.check_threshold(amount, threshold)
        
        if "error" in result:
            print(f"  ERROR: {result['error']}")
        else:
            print(f"  ✓ Amount: {result['formatted_amount']}")
            print(f"  ✓ Limit: {result['formatted_threshold']}")
            print(f"  ✓ Rule: {result['rule']}")
            print(f"  ✓ Result: {result['advice']}")
            print(f"  ✓ Comparison: {result['comparison']}")

def demo_text_enrichment():
    """Demo 2: Automatic detection and enrichment of thresholds in text"""
    print("\n" + "=" * 70)
    print("DEMO 2: Automatic Text Enrichment")
    print("=" * 70)
    
    tools = NumericalTools()
    
    manual_texts = [
        "To qualify for a DRO, your total debt must not exceed £30,000.",
        "The maximum asset value is £2,000 (excluding certain items like tools of trade).",
        "Monthly surplus income must be no more than £75 to qualify.",
        "The bankruptcy application fee is £680.",
        "Breathing space provides 60 days of protection from creditor action.",
    ]
    
    for text in manual_texts:
        print(f"\nOriginal text:")
        print(f"  {text}")
        
        result = tools.extract_and_enrich_numbers(text, include_comparisons=True)
        
        if result.get('has_thresholds'):
            print(f"\nDetected {len(result['detected_thresholds'])} threshold(s):")
            for threshold in result['detected_thresholds']:
                print(f"  • {threshold['formatted']} ({threshold['type']}) - keyword: '{threshold['keyword']}'")
            
            print(f"\nEnriched text (what the LLM sees):")
            print(f"  {result['enriched_text']}")
        else:
            print("  No thresholds detected")

def demo_question_answering():
    """Demo 3: How the system would answer questions"""
    print("\n" + "=" * 70)
    print("DEMO 3: Question Answering with Threshold Understanding")
    print("=" * 70)
    
    tools = NumericalTools()
    
    scenarios = [
        {
            "question": "Can a client with £60,000 debt get a DRO?",
            "manual_context": "To qualify for a DRO, your total debt must not exceed £30,000.",
            "client_debt": "60000"
        },
        {
            "question": "Is this client eligible for a DRO?",
            "manual_context": "DRO maximum debt limit is £30,000.",
            "client_debt": "25000"
        }
    ]
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\nScenario {i}:")
        print(f"  Question: {scenario['question']}")
        print(f"  Manual says: \"{scenario['manual_context']}\"")
        print(f"  Client's debt: £{float(scenario['client_debt']):,.2f}")
        
        # Step 1: Enrich the manual text
        enrichment = tools.extract_and_enrich_numbers(scenario['manual_context'])
        print(f"\n  [System enriches context with threshold hints]")
        if enrichment.get('detected_thresholds'):
            for t in enrichment['detected_thresholds']:
                print(f"    📊 Detected: {t['formatted']} is an {t['type']}")
        
        # Step 2: LLM can call check_threshold tool
        print(f"\n  [LLM calls tool: check_threshold('{scenario['client_debt']}', 'dro_max_debt')]")
        result = tools.check_threshold(scenario['client_debt'], 'dro_max_debt')
        
        print(f"\n  Tool result:")
        print(f"    {result['advice']}")
        print(f"    Comparison: {result['comparison']}")
        
        print(f"\n  [LLM synthesizes answer with accurate comparison]")
        if result['is_within_limit']:
            print(f"    ✅ Yes, the client CAN get a DRO. Their debt of {result['formatted_amount']} is")
            print(f"       {result['formatted_difference']} below the £30,000 limit.")
        else:
            print(f"    ❌ No, the client CANNOT get a DRO. Their debt of {result['formatted_amount']} is")
            print(f"       {result['formatted_difference']} OVER the £30,000 limit.")

def demo_available_thresholds():
    """Demo 4: Show all available pre-configured thresholds"""
    print("\n" + "=" * 70)
    print("DEMO 4: Pre-Configured Threshold Knowledge")
    print("=" * 70)
    
    print("\nThe system automatically knows these thresholds:")
    print("\n1. dro_max_debt: £30,000 - DRO maximum qualifying debt")
    print("2. dro_max_assets: £2,000 - DRO maximum asset value")
    print("3. dro_max_surplus_income: £75 - DRO maximum surplus income")
    print("4. bankruptcy_fee: £680 - Bankruptcy application fee")
    print("5. breathing_space_duration: 60 days - Standard breathing space duration")
    print("6. priority_debt_threshold: £1,000 - Priority debt concern threshold")
    print("7. small_claims_limit: £10,000 - Small claims court limit")
    
    print("\nThe LLM can check ANY amount against these thresholds instantly!")
    print("No need to retrieve this info from manuals - it's built-in knowledge.")

if __name__ == "__main__":
    demo_basic_threshold_check()
    demo_text_enrichment()
    demo_question_answering()
    demo_available_thresholds()
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("""
The system now has THREE layers of threshold understanding:

1. AUTOMATIC CONTEXT ENRICHMENT
   - When manual text says "limit is £30,000"
   - System adds: "📊 NUMERIC RULE: £30,000 is an UPPER LIMIT"
   - LLM now EXPLICITLY knows it's a threshold

2. BUILT-IN THRESHOLD KNOWLEDGE  
   - check_threshold tool knows common limits (DRO, bankruptcy, etc.)
   - LLM can instantly check: check_threshold('60000', 'dro_max_debt')
   - Returns: "£60,000 is £30,000 OVER the limit - DOES NOT QUALIFY"

3. ACCURATE COMPARISONS
   - LLM doesn't do math in its head (error-prone)
   - Calls Python tools for perfect accuracy
   - Result: "£60,000 > £30,000" is always correct

This solves your problem! Now:
✅ LLM knows £60,000 > £30,000 (DRO limit)  
✅ Even if the question doesn't mention "DRO limit"
✅ Even if it's just implied in the context
✅ The comparison is mathematically accurate
    """)
