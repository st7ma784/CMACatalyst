# Agentic RAG Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENTIC RAG SYSTEM                                │
│                                                                             │
│  ┌─────────────┐                                                           │
│  │   User      │                                                           │
│  │  Question   │                                                           │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐      │
│  │                    AGENTIC QUERY ORCHESTRATOR                   │      │
│  └─────────────────────────────────────────────────────────────────┘      │
│         │                                                                   │
│         ├─────────────────┬──────────────────┬─────────────────┐          │
│         │                 │                  │                 │          │
│         ▼                 ▼                  ▼                 ▼          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │   Step 1    │   │   Step 2    │   │   Step 3    │   │   Step 4    │  │
│  │  ANALYZE    │   │   PLAN      │   │  SEARCH     │   │ SYNTHESIZE  │  │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │
│         │                 │                  │                 │          │
│         ▼                 ▼                  ▼                 ▼          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │ Complexity  │   │  Search     │   │ Vector DB   │   │   Final     │  │
│  │ Assessment  │   │  Strategy   │   │  Queries    │   │  Answer     │  │
│  │             │   │             │   │             │   │             │  │
│  │ • Simple    │   │ • Iterations│   │ • Query 1   │   │ • Combined  │  │
│  │ • Moderate  │   │ • Top-K     │   │ • Query 2   │   │ • Cited     │  │
│  │ • Complex   │   │ • Queries   │   │ • Query 3   │   │ • Confident │  │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Workflow

### Step 1: Complexity Analysis

```
┌──────────────────────────────────────────────────────────────────────┐
│                      COMPLEXITY ANALYZER                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input: "How do I prioritize debts for a client who wants           │
│          breathing space?"                                           │
│                                                                      │
│  ┌────────────────────┐                                             │
│  │   LLM Analysis     │                                             │
│  │   (llama3.2)       │                                             │
│  └─────────┬──────────┘                                             │
│            │                                                         │
│            ▼                                                         │
│  ┌──────────────────────────────────────────────┐                  │
│  │  Analysis Result (JSON)                      │                  │
│  ├──────────────────────────────────────────────┤                  │
│  │ {                                            │                  │
│  │   "complexity": "complex",                   │                  │
│  │   "reasoning": "Requires combining           │                  │
│  │                 debt prioritization rules    │                  │
│  │                 with breathing space rules", │                  │
│  │   "suggested_searches": [                    │                  │
│  │     "debt prioritization criteria",          │                  │
│  │     "breathing space eligibility",           │                  │
│  │     "priority vs non-priority debts"         │                  │
│  │   ],                                         │                  │
│  │   "requires_synthesis": true                 │                  │
│  │ }                                            │                  │
│  └──────────────────────────────────────────────┘                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Step 2: Search Planning

```
┌──────────────────────────────────────────────────────────────────────┐
│                       SEARCH PLANNER                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Complexity: COMPLEX  →  Max Iterations: 3                          │
│                                                                      │
│  ┌────────────────────────────────────────────┐                    │
│  │  Search Strategy                           │                    │
│  ├────────────────────────────────────────────┤                    │
│  │  Iteration 1: "debt prioritization"        │                    │
│  │  Iteration 2: "breathing space"            │                    │
│  │  Iteration 3: "priority debts"             │                    │
│  │                                            │                    │
│  │  Top-K per search: 4 chunks                │                    │
│  │  Expected total: ~12 chunks                │                    │
│  │  After dedup: ~8-10 unique chunks          │                    │
│  └────────────────────────────────────────────┘                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Step 3: Iterative Retrieval

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ITERATIVE SEARCH ENGINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Iteration 1: "debt prioritization"                                        │
│  ┌─────────────┐                                                           │
│  │ ChromaDB    │ ──→ [Chunk 1: "Priority debts include rent..."]          │
│  │ Vector      │ ──→ [Chunk 2: "Non-priority debts are..."]               │
│  │ Search      │ ──→ [Chunk 3: "When prioritizing, consider..."]          │
│  └─────────────┘ ──→ [Chunk 4: "Legal obligations require..."]            │
│                                                                             │
│  Iteration 2: "breathing space"                                            │
│  ┌─────────────┐                                                           │
│  │ ChromaDB    │ ──→ [Chunk 5: "Breathing space gives 60 days..."]        │
│  │ Vector      │ ──→ [Chunk 6: "Eligible clients must have..."]           │
│  │ Search      │ ──→ [Chunk 1: "Priority debts include..."] (duplicate!)  │
│  └─────────────┘ ──→ [Chunk 7: "During breathing space..."]               │
│                                                                             │
│  Iteration 3: "priority debts"                                             │
│  ┌─────────────┐                                                           │
│  │ ChromaDB    │ ──→ [Chunk 1: "Priority debts..."] (duplicate!)          │
│  │ Vector      │ ──→ [Chunk 8: "Council tax is priority..."]              │
│  │ Search      │ ──→ [Chunk 9: "Mortgage arrears must..."]                │
│  └─────────────┘ ──→ [Chunk 2: "Non-priority debts..."] (duplicate!)      │
│                                                                             │
│  ┌───────────────────────────────────────────┐                            │
│  │  DEDUPLICATION                            │                            │
│  │  Total retrieved: 12 chunks               │                            │
│  │  After dedup: 9 unique chunks             │                            │
│  │  From sources: 3 different documents      │                            │
│  └───────────────────────────────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 4: Answer Synthesis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ANSWER SYNTHESIZER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Context Chunks (9 unique):                                                │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ [Source 1: debt_prioritization.pdf]                         │          │
│  │ "Priority debts include rent, mortgage, council tax..."     │          │
│  │                                                              │          │
│  │ [Source 2: breathing_space_guide.pdf]                       │          │
│  │ "Breathing space provides 60 days protection from..."       │          │
│  │                                                              │          │
│  │ [Source 3: case_procedures.pdf]                             │          │
│  │ "When creating a debt management plan, first..."            │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                             │                                              │
│                             ▼                                              │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │             LLM Synthesis (llama3.2)                        │          │
│  │  Prompt: "Combine these contexts to answer the question"    │          │
│  └─────────────────────┬───────────────────────────────────────┘          │
│                        │                                                   │
│                        ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  Final Answer                                               │          │
│  ├─────────────────────────────────────────────────────────────┤          │
│  │  "To prioritize debts for a client seeking breathing       │          │
│  │   space:                                                    │          │
│  │                                                             │          │
│  │   1. According to [Source 1], identify priority debts      │          │
│  │      first - these include rent, mortgage, council tax,    │          │
│  │      and court fines.                                       │          │
│  │                                                             │          │
│  │   2. As stated in [Source 2], breathing space applies      │          │
│  │      to both priority and non-priority debts, giving       │          │
│  │      60 days protection.                                    │          │
│  │                                                             │          │
│  │   3. Following [Source 3] procedure, create a debt         │          │
│  │      management plan that addresses priority debts first   │          │
│  │      while utilizing breathing space protection.           │          │
│  │                                                             │          │
│  │   CONFIDENCE: HIGH - Found comprehensive procedures in     │          │
│  │   multiple sources that directly address this scenario."   │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Comparison: Standard vs Agentic

### Standard RAG Flow

```
Question → Single Search → Top 4 Chunks → Direct Answer
           (one query)     (4 results)    (no analysis)
           
Time: ~5s
Sources: 1-2 docs
Quality: Good for simple queries
```

### Agentic RAG Flow

```
Question → Analyze → Plan → Search 1 → Search 2 → Search 3 → Synthesize
           (LLM)     (strategy) (4)      (4)        (4)      (combine)
                                                              
                                    ↓ Deduplication ↓
                                    
                                    8-10 unique chunks
                                    2-3 source docs
                                    
                                         ↓
                                         
                                  Final Answer
                                  + Confidence
                                  + Citations
                                  
Time: ~20s
Sources: 2-4 docs
Quality: Excellent for complex queries
```

## Decision Tree: When to Use Which?

```
                        User Question
                             │
                             ▼
                    ┌────────────────┐
                    │ Analyze Query  │
                    └────────┬───────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
             ▼               ▼               ▼
        ┌────────┐      ┌────────┐     ┌────────┐
        │ Simple │      │Moderate│     │Complex │
        └───┬────┘      └───┬────┘     └───┬────┘
            │               │               │
            ▼               ▼               ▼
      Use STANDARD   Use AGENTIC      Use AGENTIC
      - 1 search     - 2 iterations   - 3 iterations
      - Fast (5s)    - Medium (15s)   - Thorough (25s)
      - Direct       - Synthesis      - Deep synthesis

Examples:
Simple: "What is X?"
        "Define Y"
        
Moderate: "How do I do X?"
          "What are steps for Y?"
          
Complex: "How do I X when Y and Z?"
         "Compare X vs Y"
         "What if scenario A, B, and C?"
```

## Architecture Benefits

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT CAPABILITIES                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ Self-Awareness                                         │
│     Knows when a question is complex                       │
│                                                             │
│  ✅ Planning                                               │
│     Creates search strategy before executing               │
│                                                             │
│  ✅ Iteration                                              │
│     Can perform multiple searches to gather context        │
│                                                             │
│  ✅ Deduplication                                          │
│     Doesn't waste tokens on duplicate information          │
│                                                             │
│  ✅ Synthesis                                              │
│     Combines multiple sources coherently                   │
│                                                             │
│  ✅ Citation                                               │
│     Explicitly references sources                          │
│                                                             │
│  ✅ Confidence                                             │
│     Rates its own answer quality                           │
│                                                             │
│  ✅ Transparency                                           │
│     Shows reasoning steps                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Future Enhancements

```
Current Implementation:
  Question → Analyze → Search → Synthesize → Answer

Planned Enhancements:

1. Self-Refinement Loop:
   Question → Analyze → Search → Synthesize → Evaluate
                            ↑                      │
                            └──────────────────────┘
                            (if confidence LOW, search again)

2. Tool Integration:
   Question → Analyze → Search + Call Tools → Synthesize
                        │
                        ├→ Calculator
                        ├→ Eligibility Checker
                        └→ Date Calculator

3. Multi-Agent System:
   Question → Route to Specialist Agent
              │
              ├→ Debt Agent (for debt questions)
              ├→ Benefits Agent (for benefits)
              └→ Legal Agent (for legal procedures)

4. Memory System:
   Question 1 → Answer 1 ──┐
                            ├→ Session Memory
   Question 2 → Answer 2 ──┘     │
                                 ▼
   Question 3 (referring back) → Use Memory + Search

5. Human-in-the-Loop:
   Complex Question → Agent Realizes Needs Clarification
                   → Ask User for Details
                   → Continue with Better Context
```

---

This architecture enables the RAG system to operate more like a knowledgeable advisor who can reason through complex scenarios rather than just retrieving and regurgitating information!
