# Agentic RAG Quick Reference

## API Endpoints

### Standard Query (Fast)
```bash
POST http://localhost:8102/query
{
  "question": "What is breathing space?",
  "model": "llama3.2",
  "top_k": 4
}
```
⚡ **Use when:** Simple lookups, definitions, single-source questions  
⏱️ **Speed:** ~5 seconds  
📚 **Sources:** 1-2 documents  

### Agentic Query (Thorough)
```bash
POST http://localhost:8102/agentic-query
{
  "question": "How do I prioritize debts when client wants breathing space?",
  "model": "llama3.2",
  "max_iterations": 3,
  "top_k": 4,
  "show_reasoning": true
}
```
🧠 **Use when:** Complex questions, comparisons, multi-part scenarios  
⏱️ **Speed:** ~20 seconds  
📚 **Sources:** 2-4 documents  
🎯 **Bonus:** Confidence rating + reasoning steps  

## Quick Decision Guide

| Question Type | Endpoint | Example |
|--------------|----------|---------|
| **Definition** | `/query` | "What is X?" |
| **Lookup** | `/query` | "When is Y deadline?" |
| **Simple How-To** | `/query` | "How to submit form Z?" |
| **Multi-Part** | `/agentic-query` | "How do I X when Y and Z?" |
| **Comparison** | `/agentic-query` | "X vs Y - which is better?" |
| **Scenario** | `/agentic-query` | "What if A, B, and C happen?" |
| **Complex Eligibility** | `/agentic-query` | "Does client qualify given...?" |

## Response Fields

### Standard Query Response
```json
{
  "answer": "string",
  "sources": ["file1.pdf", "file2.pdf"],
  "retrieved_chunks": [...]  // optional debug info
}
```

### Agentic Query Response
```json
{
  "answer": "string",
  "sources": ["file1.pdf", "file2.pdf"],
  "iterations_used": 2,
  "confidence": "HIGH - Found comprehensive procedures",
  "reasoning_steps": [
    {
      "step": "analysis",
      "description": "Question complexity analysis",
      "result": {"complexity": "complex", ...}
    },
    {
      "step": "planning",
      "description": "Search strategy",
      "result": {"iterations": 2, "searches": [...]}
    },
    {
      "step": "retrieval",
      "description": "Context gathering",
      "result": {"chunks_found": 8, "sources": [...]}
    }
  ]
}
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `question` | *required* | The user's question |
| `model` | `llama3.2` | LLM model to use |
| `top_k` | `4` | Chunks per search iteration |
| `max_iterations` | `3` | Max search iterations (agentic only) |
| `show_reasoning` | `true` | Include reasoning steps (agentic only) |

## Complexity Levels

The agent automatically classifies questions:

### 🟢 Simple (1 iteration)
- Single concept
- Definition or lookup
- One-source answer
- Example: "What is breathing space?"

### 🟡 Moderate (2 iterations)
- 2-3 concepts
- Multi-step procedure
- Requires light synthesis
- Example: "How do I set up a DMP?"

### 🔴 Complex (3 iterations)
- Multiple concepts
- Comparison or scenario
- Requires deep synthesis
- Example: "How do I prioritize debts when client has X, Y, Z?"

## Confidence Ratings

The agent provides confidence ratings:

- **HIGH** - Found comprehensive, relevant sources
- **MEDIUM** - Found partial information, some gaps
- **LOW** - Limited information, uncertain answer

## Test Commands

### Quick Test (Simple)
```bash
curl -X POST http://localhost:8102/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is breathing space?"}'
```

### Full Test (Complex)
```bash
curl -X POST http://localhost:8102/agentic-query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I prioritize debts for a client with both secured and unsecured debts?",
    "max_iterations": 3,
    "show_reasoning": true
  }'
```

### Run Test Suite
```bash
python /services/rag-service/test_agentic.py
```

## Performance

| Metric | Standard | Agentic (Simple) | Agentic (Complex) |
|--------|----------|------------------|-------------------|
| **Latency** | 5s | 10s | 25s |
| **LLM Calls** | 1 | 2 | 2 |
| **Searches** | 1 | 1 | 2-3 |
| **Chunks** | 4 | 4 | 8-12 |
| **Sources** | 1-2 | 1-2 | 2-4 |

## Integration Example

```javascript
async function askQuestion(question) {
  // Detect complexity
  const isComplex = 
    question.includes(' and ') || 
    question.includes(' vs ') ||
    question.split(' ').length > 15;
  
  // Choose endpoint
  const endpoint = isComplex 
    ? '/agentic-query' 
    : '/query';
  
  // Make request
  const response = await fetch(`http://localhost:8102${endpoint}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      question,
      max_iterations: 3,
      show_reasoning: true
    })
  });
  
  const result = await response.json();
  
  // Display
  console.log('Answer:', result.answer);
  if (result.confidence) {
    console.log('Confidence:', result.confidence);
  }
  if (result.reasoning_steps) {
    console.log('Reasoning:', result.reasoning_steps);
  }
  
  return result;
}
```

## Files

### Core Implementation
- `/services/rag-service/app.py` - Main service with agentic methods

### Documentation
- `/docs/AGENTIC_RAG.md` - Comprehensive guide
- `/docs/AGENTIC_RAG_ARCHITECTURE.md` - Visual diagrams
- `/AGENTIC_RAG_SUMMARY.md` - Implementation summary

### Testing
- `/services/rag-service/test_agentic.py` - Test script

## Common Issues

### 🔴 "Low confidence" responses
**Cause:** Insufficient documentation  
**Fix:** Ingest more relevant manuals

### 🔴 Slow responses
**Cause:** Too many iterations  
**Fix:** Reduce `max_iterations` or use standard query

### 🔴 "Error analyzing complexity"
**Cause:** LLM timeout or malformed response  
**Fix:** Falls back to moderate complexity automatically

## Next Steps

1. ✅ Implementation complete
2. ⏳ Test with real questions
3. ⏳ Tune parameters (iterations, top_k)
4. ⏳ Add to frontend UI
5. ⏳ Monitor confidence ratings
6. 🔮 Future: Self-refinement, tools, memory

---

**TL;DR:** Use `/query` for simple questions (fast), `/agentic-query` for complex questions (thorough). The agent automatically adapts to question complexity and provides confidence ratings.
