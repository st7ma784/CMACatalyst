#!/usr/bin/env python3
"""
Test script for Agentic RAG Service
Demonstrates the difference between standard and agentic queries
"""

import requests
import json
import time
from typing import Dict

RAG_SERVICE_URL = "http://localhost:8102"

def print_separator():
    print("\n" + "="*80 + "\n")

def test_standard_query(question: str) -> Dict:
    """Test standard RAG query."""
    print("🔵 STANDARD RAG QUERY")
    print(f"Question: {question}")
    
    start_time = time.time()
    
    response = requests.post(
        f"{RAG_SERVICE_URL}/query",
        json={
            "question": question,
            "model": "llama3.2",
            "top_k": 4
        }
    )
    
    elapsed = time.time() - start_time
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n⏱️  Time: {elapsed:.2f}s")
        print(f"\n📚 Sources ({len(result['sources'])}):")
        for source in result['sources']:
            print(f"  - {source}")
        print(f"\n💬 Answer:")
        print(result['answer'])
        return result
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")
        return {}

def test_agentic_query(question: str, show_reasoning: bool = True) -> Dict:
    """Test agentic RAG query with iterative reasoning."""
    print("🟢 AGENTIC RAG QUERY")
    print(f"Question: {question}")
    
    start_time = time.time()
    
    response = requests.post(
        f"{RAG_SERVICE_URL}/agentic-query",
        json={
            "question": question,
            "model": "llama3.2",
            "max_iterations": 3,
            "top_k": 4,
            "show_reasoning": show_reasoning
        }
    )
    
    elapsed = time.time() - start_time
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n⏱️  Time: {elapsed:.2f}s")
        print(f"🔄 Iterations Used: {result['iterations_used']}")
        print(f"🎯 Confidence: {result['confidence']}")
        
        if show_reasoning and 'reasoning_steps' in result:
            print(f"\n🧠 Reasoning Steps:")
            for step in result['reasoning_steps']:
                print(f"\n  📍 {step['step'].upper()}: {step['description']}")
                print(f"     {json.dumps(step['result'], indent=6)}")
        
        print(f"\n📚 Sources ({len(result['sources'])}):")
        for source in result['sources']:
            print(f"  - {source}")
        
        print(f"\n💬 Answer:")
        print(result['answer'])
        
        return result
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")
        return {}

def compare_queries(question: str):
    """Compare standard vs agentic query for the same question."""
    print_separator()
    print(f"🔬 COMPARISON TEST")
    print(f"Question: {question}")
    print_separator()
    
    # Standard query
    standard_result = test_standard_query(question)
    
    print_separator()
    
    # Agentic query
    agentic_result = test_agentic_query(question)
    
    print_separator()
    
    # Comparison summary
    if standard_result and agentic_result:
        print("📊 COMPARISON SUMMARY:")
        print(f"  Standard Sources: {len(standard_result.get('sources', []))}")
        print(f"  Agentic Sources:  {len(agentic_result.get('sources', []))}")
        print(f"  Agentic Confidence: {agentic_result.get('confidence', 'N/A')}")
        print(f"  Iterations Used: {agentic_result.get('iterations_used', 'N/A')}")

def main():
    """Run test scenarios."""
    print("🚀 AGENTIC RAG SERVICE TEST SUITE")
    print("=" * 80)
    
    # Check if service is running
    try:
        response = requests.get(f"{RAG_SERVICE_URL}/health")
        if response.status_code != 200:
            print("❌ RAG service is not running!")
            print("Start it with: docker-compose -f docker-compose.local-parsing.yml up -d rag-service")
            return
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to RAG service at", RAG_SERVICE_URL)
        print("Start it with: docker-compose -f docker-compose.local-parsing.yml up -d rag-service")
        return
    
    print("✅ RAG service is running\n")
    
    # Test scenarios
    scenarios = [
        {
            "name": "Simple Question",
            "question": "What is breathing space?",
            "description": "Single concept, should be classified as 'simple'"
        },
        {
            "name": "Complex Multi-Part Question",
            "question": "How do I prioritize debts for a client with both priority and non-priority debts who wants breathing space?",
            "description": "Requires synthesis of multiple concepts"
        },
        {
            "name": "Comparison Question",
            "question": "What's the difference between a debt management plan and a debt relief order?",
            "description": "Needs information about two different procedures"
        },
        {
            "name": "Scenario-Based Question",
            "question": "If a client has council tax arrears, credit card debt, and a car loan, which debts should be paid first?",
            "description": "Requires understanding prioritization rules"
        }
    ]
    
    # Run tests
    for i, scenario in enumerate(scenarios, 1):
        print_separator()
        print(f"TEST {i}: {scenario['name']}")
        print(f"Description: {scenario['description']}")
        print_separator()
        
        # For the first test, compare both methods
        if i == 1:
            compare_queries(scenario['question'])
        else:
            # For others, just show agentic query
            test_agentic_query(scenario['question'])
        
        if i < len(scenarios):
            input("\n⏸️  Press Enter to continue to next test...")
    
    print_separator()
    print("✅ TEST SUITE COMPLETE!")
    print("\nKey Observations:")
    print("  • Simple questions use fewer iterations (1-2)")
    print("  • Complex questions use more searches (2-3)")
    print("  • Agentic queries provide confidence ratings")
    print("  • Reasoning steps show the thought process")
    print("  • More sources typically found for complex queries")

if __name__ == "__main__":
    main()
