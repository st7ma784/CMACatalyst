# Agentic RAG Service

## Overview

The RAG service has been enhanced with **agentic reasoning capabilities** that enable it to handle complex questions through multi-step reasoning and iterative refinement.

## Key Features

### 1. **Question Complexity Analysis**
The agent first analyzes incoming questions to determine their complexity level:
- **Simple**: Single-step queries requiring straightforward retrieval
- **Moderate**: Questions needing 2-3 sources combined
- **Complex**: Multi-faceted questions requiring synthesis across multiple procedures

### 2. **Adaptive Search Strategy**
Based on complexity analysis, the agent:
- Plans optimal search queries
- Determines how many iteration steps needed
- Adjusts retrieval depth (top_k) dynamically

### 3. **Iterative Context Gathering**
The agent performs multiple targeted searches:
- Deduplicates retrieved chunks
- Tracks which queries found which information
- Builds a comprehensive context base

### 4. **Intelligent Synthesis**
Finally, the agent:
- Combines information from multiple sources
- Provides source citations
- Rates confidence in its answer
- Explains reasoning when requested

## API Comparison

### Standard RAG Query
```bash
POST /query
{
  "question": "What is the breathing space scheme?",
  "model": "llama3.2",
  "top_k": 4
}
```

**Response:**
```json
{
  "answer": "The breathing space scheme is...",
  "sources": ["manual_chapter_3.pdf"],
  "retrieved_chunks": [...]
}
```

### Agentic RAG Query
```bash
POST /agentic-query
{
  "question": "How do I prioritize debts for a client with both priority and non-priority debts who wants breathing space?",
  "model": "llama3.2",
  "max_iterations": 3,
  "top_k": 4,
  "show_reasoning": true
}
```

**Response:**
```json
{
  "answer": "To prioritize debts in this situation, follow these steps:\n\n1. According to [Source 1: debt_prioritization.pdf], identify priority debts first...\n\n2. Next, [Source 2: breathing_space.pdf] states that breathing space applies to both types...\n\n3. The recommended approach from [Source 3: case_management.pdf] is...",
  "sources": [
    "debt_prioritization.pdf",
    "breathing_space.pdf", 
    "case_management.pdf"
  ],
  "reasoning_steps": [
    {
      "step": "analysis",
      "description": "Question complexity analysis",
      "result": {
        "complexity": "complex",
        "reasoning": "Requires combining debt prioritization rules with breathing space eligibility",
        "suggested_searches": [
          "debt prioritization criteria",
          "breathing space scheme eligibility",
          "priority vs non-priority debts"
        ],
        "requires_synthesis": true
      }
    },
    {
      "step": "planning",
      "description": "Search strategy",
      "result": {
        "complexity": "complex",
        "iterations": 3,
        "searches": [
          "debt prioritization criteria",
          "breathing space scheme eligibility",
          "priority vs non-priority debts"
        ]
      }
    },
    {
      "step": "retrieval",
      "description": "Context gathering",
      "result": {
        "chunks_found": 8,
        "sources": [
          "debt_prioritization.pdf",
          "breathing_space.pdf",
          "case_management.pdf"
        ]
      }
    }
  ],
  "iterations_used": 3,
  "confidence": "HIGH - Found comprehensive procedures in multiple sources that directly address this scenario"
}
```

## When to Use Agentic Query

### Use Standard `/query` for:
- Simple lookups ("What is the definition of X?")
- Single-source questions
- Fast responses needed
- Known procedures with clear documentation

### Use Agentic `/agentic-query` for:
- ✅ **Multi-part questions** ("How do I do X AND Y?")
- ✅ **Comparison questions** ("What's the difference between X and Y?")
- ✅ **Scenario-based questions** ("What should I do when...?")
- ✅ **Complex eligibility** ("Does this client qualify for...?")
- ✅ **Procedure synthesis** ("What are the steps for...?")
- ✅ **When you need confidence ratings**
- ✅ **When you want to see the reasoning process**

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENTIC RAG WORKFLOW                     │
└─────────────────────────────────────────────────────────────┘

1. ANALYZE QUESTION
   ┌──────────────────┐
   │ User Question    │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐      ╔════════════════════╗
   │ LLM Analysis     │─────▶║ Complexity: COMPLEX║
   │ - Complexity     │      ║ Needs: 3 searches  ║
   │ - Search plan    │      ║ Synthesis: YES     ║
   └────────┬─────────┘      ╚════════════════════╝
            │
            ▼
2. PLAN STRATEGY
   ┌──────────────────┐
   │ Generate search  │
   │ queries:         │
   │ 1. "debt types"  │
   │ 2. "breathing    │
   │     space rules" │
   │ 3. "prioritize   │
   │     debts"       │
   └────────┬─────────┘
            │
            ▼
3. ITERATIVE SEARCH
   ┌──────────────────┐
   │ Search 1 ────────┼─▶ ChromaDB ─▶ 3 chunks
   │ Search 2 ────────┼─▶ ChromaDB ─▶ 4 chunks
   │ Search 3 ────────┼─▶ ChromaDB ─▶ 3 chunks
   └────────┬─────────┘
            │ (Deduplicate)
            ▼
   ┌──────────────────┐
   │ Combined Context │
   │ 8 unique chunks  │
   │ 3 source docs    │
   └────────┬─────────┘
            │
            ▼
4. SYNTHESIZE ANSWER
   ┌──────────────────┐
   │ LLM Synthesis    │
   │ - Combine info   │
   │ - Add citations  │
   │ - Rate confidence│
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Final Response   │
   │ + Reasoning      │
   │ + Confidence     │
   │ + Sources        │
   └──────────────────┘
```

## Configuration Parameters

### `max_iterations` (default: 3)
- Controls maximum search iterations
- Higher = more thorough but slower
- Automatically reduced for simple questions

### `top_k` (default: 4)
- Number of chunks per search
- Total chunks can be up to `max_iterations * top_k`
- Deduplication reduces final count

### `show_reasoning` (default: true)
- Include step-by-step reasoning in response
- Set to `false` for production if you only need final answer
- Helpful for debugging and transparency

### `model` (default: "llama3.2")
- LLM model to use
- Same model used for analysis, search planning, and synthesis
- Can switch to more powerful models for complex queries

## Example Use Cases

### 1. Complex Eligibility Check
**Question:** "Can a client with income from benefits and part-time work, who has council tax arrears and credit card debt, qualify for breathing space?"

**Why Agentic?**
- Needs to check: income rules, debt types, eligibility criteria
- Requires synthesis across multiple policy areas
- Benefits from step-by-step reasoning

**Expected Behavior:**
- Iteration 1: Search breathing space eligibility
- Iteration 2: Search income considerations
- Iteration 3: Search qualifying debt types
- Synthesis: Combine all rules into cohesive answer

### 2. Procedure Comparison
**Question:** "What's the difference between breathing space and a debt relief order?"

**Why Agentic?**
- Needs information about TWO different procedures
- Requires comparison and contrast
- Benefits from gathering comprehensive info on both

**Expected Behavior:**
- Iteration 1: Search breathing space details
- Iteration 2: Search DRO details
- Synthesis: Compare eligibility, duration, effects, costs, etc.

### 3. Multi-Step Process
**Question:** "What are all the steps to set up a debt management plan for a client?"

**Why Agentic?**
- Procedural question with multiple phases
- May need info on: initial assessment, creditor contact, plan creation, monitoring
- Benefits from iterative gathering to ensure nothing missed

## Performance Considerations

### Latency
- Standard query: ~2-5 seconds
- Agentic query: ~10-20 seconds (depends on iterations)
- Trade-off: Speed vs. comprehensiveness

### Token Usage
- Agentic queries use more LLM calls:
  - 1x complexity analysis
  - 1x synthesis
  - Total: ~2x more LLM calls than standard
- Consider this for cost/resource planning

### Caching
- Could implement caching for:
  - Question complexity analysis (similar questions)
  - Common search queries
  - Vector similarity searches

## Future Enhancements

### Planned Features
1. **Self-Refinement**: Agent checks its own answer and refines if needed
2. **Tool Use**: Agent can invoke calculators, eligibility checkers, etc.
3. **Memory**: Remember context from previous questions in session
4. **Citation Validation**: Verify claims against source material
5. **Confidence Calibration**: Learn when to ask for clarification

### Potential Improvements
- Add question clarification step (ask user for more info)
- Implement query expansion with synonyms
- Use multiple models (smaller for analysis, larger for synthesis)
- Add retrieval feedback loop (search → evaluate → search again if needed)

## Testing the Feature

### 1. Start the Services
```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo
docker-compose -f docker-compose.local-parsing.yml up -d rag-service
```

### 2. Ingest Test Documents
```bash
curl -X POST http://localhost:8102/ingest-pdf \
  -F "file=@/path/to/manual.pdf"
```

### 3. Try Simple Query (Baseline)
```bash
curl -X POST http://localhost:8102/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is breathing space?",
    "model": "llama3.2",
    "top_k": 4
  }'
```

### 4. Try Agentic Query (Complex)
```bash
curl -X POST http://localhost:8102/agentic-query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I prioritize debts for a client with both secured and unsecured debts who is considering bankruptcy?",
    "model": "llama3.2",
    "max_iterations": 3,
    "top_k": 4,
    "show_reasoning": true
  }'
```

### 5. Compare Results
Look for:
- ✅ More comprehensive answer in agentic query
- ✅ Better source coverage (more relevant documents)
- ✅ Confidence rating
- ✅ Step-by-step reasoning visible

## Integration with Frontend

Update your frontend to detect complex questions and use agentic query:

```javascript
const askQuestion = async (question) => {
  // Simple heuristic to detect complex questions
  const isComplex = 
    question.includes(' and ') || 
    question.includes(' or ') ||
    question.split(' ').length > 15 ||
    question.includes('compare') ||
    question.includes('difference') ||
    question.includes('steps to');
  
  const endpoint = isComplex ? '/agentic-query' : '/query';
  
  const response = await fetch(`http://localhost:8102${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      model: 'llama3.2',
      max_iterations: 3,
      top_k: 4,
      show_reasoning: true // Show in dev mode
    })
  });
  
  const result = await response.json();
  
  // Display reasoning steps if available
  if (result.reasoning_steps) {
    console.log('Reasoning:', result.reasoning_steps);
  }
  
  return result;
};
```

## Monitoring & Debugging

### Log Output
The service logs each step with emojis for easy scanning:
```
🤔 Analyzing question: How do I...
📋 Plan: 3 iteration(s) with 3 search(es)
🔍 Starting iterative search...
  Searching for: debt prioritization
  Searching for: bankruptcy eligibility
  Searching for: secured vs unsecured
💡 Synthesizing answer from 9 context chunks...
✅ Agentic query complete. Confidence: HIGH - ...
```

### Metrics to Track
- Average iterations used per query
- Confidence distribution (HIGH/MEDIUM/LOW)
- Retrieval coverage (chunks found vs needed)
- Query latency by complexity level
- User feedback on answer quality

## Troubleshooting

### Agent Returns Low Confidence
**Possible causes:**
- Insufficient documentation in vector store
- Question outside scope of ingested manuals
- Ambiguous or unclear question

**Solutions:**
- Ingest more relevant documents
- Rephrase question to be more specific
- Check if manuals cover this topic

### Too Many Iterations
**Possible causes:**
- Very complex question
- Poor complexity analysis

**Solutions:**
- Reduce `max_iterations` parameter
- Break question into smaller sub-questions
- Use standard query for simpler parts

### Slow Response Time
**Possible causes:**
- High iterations count
- Large context chunks
- LLM model too large

**Solutions:**
- Reduce `max_iterations` and `top_k`
- Use smaller/faster model for analysis step
- Implement caching for common queries

---

## Summary

The agentic RAG service transforms a simple retrieval system into an intelligent agent that can:
- ✅ Analyze question complexity
- ✅ Plan optimal search strategies  
- ✅ Iteratively gather comprehensive context
- ✅ Synthesize well-cited answers
- ✅ Provide confidence ratings
- ✅ Show transparent reasoning

Use it for complex, multi-faceted questions where quality and comprehensiveness matter more than raw speed.
