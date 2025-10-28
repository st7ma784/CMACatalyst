# Agentic RAG Architecture

## Overview

The RMA-Demo system includes an advanced **Agentic RAG (Retrieval-Augmented Generation)** capability that goes beyond simple vector similarity search. Instead of just retrieving similar documents and passing them to an LLM, the agentic approach uses AI reasoning to analyze questions, plan searches strategically, and synthesize answers with confidence assessments.

This feature is available for both:
- **Training Manual Queries** (`rag-service` on port 8102)
- **Client Document Queries** (`client-rag-service` on port 8104)

## Key Concepts

### What is Agentic RAG?

Traditional RAG systems follow a simple pattern:
1. User asks a question
2. System performs vector similarity search
3. Retrieved chunks are passed to LLM
4. LLM generates an answer

**Agentic RAG** adds intelligence to this process:
1. **Analyze** the question's complexity
2. **Plan** a search strategy with multiple targeted queries
3. **Iteratively search** and gather relevant context
4. **Synthesize** an answer with confidence assessment
5. **Provide reasoning** about the process

### Benefits

- **Better answers for complex questions** - Can handle multi-faceted queries requiring information synthesis
- **More targeted retrieval** - Generates specific search queries instead of using the raw question
- **Confidence metrics** - Tells you how confident the system is in its answer
- **Transparent reasoning** - Shows the thought process behind the answer
- **Adaptive complexity** - Simple questions get quick answers, complex ones get thorough analysis

## Numerical Tools Integration

### Overview

A key challenge with LLMs is their poor performance on numerical operations. They often make arithmetic errors, struggle with comparisons, and miss numerical patterns. To address this, the agentic RAG system includes **Numerical Tools** - Python functions the LLM can call for accurate calculations.

### Why This Architecture is Critical for Debt Advice

This might seem like a "minor architectural thing," but it's actually **fundamental to providing accurate debt advice**. Here's why:

#### The Problem: LLMs Can't Do Math Reliably

Large Language Models are pattern-matching engines, not calculators. When you ask an LLM "Is £60,000 too much debt for a DRO?", here's what can go wrong:

**Without Tools:**
```
LLM: "Let me think... £60,000 is quite high, but I believe the DRO limit 
is around £50,000, so this might be within range..."
```
❌ **Wrong!** The DRO limit is £30,000, and the client is £30,000 over the limit.

**The Stakes:**
- ❌ Wrong eligibility assessment → client pursues wrong debt solution
- ❌ Wasted time applying for options they can't get
- ❌ Incorrect advice could lead to financial harm
- ❌ Regulatory compliance issues for the advice organization
- ❌ Loss of trust when clients discover the error

#### The Solution: Three-Layer Numerical Architecture

**Layer 1: Automatic Context Enrichment**
- System scans retrieved manual text for thresholds
- Automatically adds "📊 NUMERIC RULE" annotations
- Makes thresholds explicit to the LLM without requiring it to "understand" numbers

**Layer 2: Dynamic Threshold Extraction**
- On startup, system queries its own manuals: "What are all the limits for debt solutions?"
- Extracts and caches thresholds (DRO max: £30,000, bankruptcy fee: £680, etc.)
- **No hardcoded values** - stays current as manuals are updated
- Threshold cache shared across all queries

**Layer 3: Tool-Based Validation**
- LLM recognizes it needs to check a threshold
- Calls `check_threshold('60000', 'DRO maximum debt')`
- System injects cached threshold value if LLM didn't extract it
- Python performs exact comparison: `60000 > 30000 = True`
- Returns: "EXCEEDS_LIMIT: Amount £60,000 exceeds DRO maximum debt of £30,000 by £30,000"

**Result:**
```
LLM: "Based on the threshold check, the client's £60,000 total debt 
significantly exceeds the DRO maximum limit of £30,000 (by £30,000). 
They would NOT be eligible for a Debt Relief Order."
```
✅ **Accurate!** Python handled the comparison, LLM interpreted the result.

### Why Numerical Tools?

**LLM Limitations:**
- ❌ Arithmetic errors: "£1,500 + £2,300 = £3,900" (wrong!)
- ❌ Poor at comparisons: Confuses which debt is larger
- ❌ Misses patterns: Won't notice £450 + £550 = £1,000 (suspicious!)
- ❌ Inconsistent with formatting: Struggles with "£1,234.56" vs "1234.56"
- ❌ Hallucinates thresholds: Makes up limits that sound plausible
- ❌ Outdated training: May have wrong historical limits

**With Numerical Tools:**
- ✅ Perfect arithmetic every time
- ✅ Accurate comparisons and rankings
- ✅ Automatic pattern detection
- ✅ Handles all currency formats
- ✅ Uses CURRENT thresholds from YOUR manuals
- ✅ No hardcoded values that go stale

### Real-World Impact

**Scenario: Client with £28,000 debt asks about DRO eligibility**

**Without Tools (Pure LLM):**
- LLM might say "£28,000 is close to the limit, you might be eligible"
- Advisor proceeds with DRO application
- Later discovers client actually has £28,500 when properly calculated
- If other debts surface, total could exceed £30,000
- **Risk:** Application rejected after time and fees invested

**With Tools:**
```python
# System automatically:
1. Retrieves DRO limit from cached thresholds: £30,000
2. LLM calls: sum_numbers(['15000', '8000', '5000'])
   Result: £28,000
3. LLM calls: check_threshold('28000', 'DRO maximum debt', '30000')
   Result: "WITHIN_LIMIT: £28,000 is £2,000 below limit (93.3% utilization)"
4. LLM responds: "Yes, eligible. Total debt £28,000 is within the £30,000 
   limit with £2,000 headroom. Note: Any additional debts discovered 
   must be included, as you're at 93% of the limit."
```
✅ **Accurate calculation**
✅ **Correct eligibility assessment**  
✅ **Proactive warning about headroom**

### Why Dynamic Thresholds Matter

**The Problem with Hardcoding:**
```python
# BAD: Hardcoded in source code
THRESHOLDS = {
    "dro_max_debt": 30000,  # What if this changes to £35,000?
    "bankruptcy_fee": 680,   # What if fee increases?
}
```

**Issues:**
- 📅 Regulations change - limits update periodically
- 🔧 Requires code changes and redeployment to update values
- 📚 Creates disconnect between manuals and system behavior
- 🐛 Risk of forgetting to update all hardcoded values
- ⚖️ Compliance risk if system uses outdated limits

**Dynamic Extraction Approach:**
```python
# GOOD: Extracted from manuals on startup
def extract_thresholds_from_manuals():
    query = "List all limits and thresholds for debt solutions"
    # Retrieves from vector store containing current manuals
    # Parses and caches values
    return extracted_thresholds
```

**Benefits:**
- ✅ Single source of truth: the manuals
- ✅ Update manual PDF → restart service → thresholds current
- ✅ No code changes needed for threshold updates
- ✅ System automatically stays compliant
- ✅ Can verify system is using correct current values
- ✅ Different deployments can have different thresholds (regional variations)

### Architecture Principles

**1. Separation of Concerns**
- **Manuals** = Source of truth for rules and thresholds
- **Vector Store** = Semantic search for relevant context
- **LLM** = Understanding, reasoning, and language generation
- **Python Tools** = Numerical operations and exact comparisons
- **Cache** = Fast threshold lookup without repeated queries

**2. Trust but Verify**
- LLM extracts thresholds from context (trust)
- System validates and supplements from cache (verify)
- Python performs exact math (guarantee accuracy)

**3. Self-Documenting Behavior**
- Tool calls are logged: "check_threshold('60000', 'DRO maximum debt', '30000')"
- Audit trail shows which thresholds were used
- Responses cite sources: "According to [Source 2: DRO_Guidelines.pdf]..."

**4. Graceful Degradation**
- If threshold not in cache: LLM tries to extract from retrieved context
- If extraction fails: System returns "needs_lookup" message
- Never makes up numbers or guesses

### Available Tools

#### 1. calculate(expression)
Safely evaluate mathematical expressions.

**Use Cases:**
- Adding/subtracting debts
- Calculating percentages
- Simple arithmetic

**Example:**
```json
{
  "tool": "calculate",
  "arguments": {"expression": "1500 + 2300 - 450"}
}
```

**Result:**
```json
{
  "result": 3350.0,
  "formatted": "£3,350.00",
  "expression": "1500 + 2300 - 450"
}
```

#### 2. compare_numbers(num1, num2, operation)
Compare two numbers with operations: greater, less, equal, greater_equal, less_equal.

**Use Cases:**
- Checking if debt exceeds threshold
- Comparing two options
- Prioritization logic

**Example:**
```json
{
  "tool": "compare_numbers",
  "arguments": {
    "num1": "£5,000",
    "num2": "3000",
    "operation": "greater"
  }
}
```

**Result:**
```json
{
  "result": true,
  "num1": 5000.0,
  "num2": 3000.0,
  "difference": 2000.0,
  "formatted_difference": "£2,000.00",
  "comparison": "£5,000.00 > £3,000.00"
}
```

#### 3. sum_numbers(numbers)
Sum a list of numbers and get statistics.

**Use Cases:**
- Total debt calculation
- Average payment amounts
- Finding min/max debts

**Example:**
```json
{
  "tool": "sum_numbers",
  "arguments": {
    "numbers": ["1500", "£2,300", "450", "1,200"]
  }
}
```

**Result:**
```json
{
  "sum": 5450.0,
  "average": 1362.5,
  "count": 4,
  "min": 450.0,
  "max": 2300.0,
  "formatted_sum": "£5,450.00",
  "formatted_average": "£1,362.50"
}
```

#### 4. find_convenient_sums(numbers, target_tolerance)
**⭐ Pattern Detection - Find groups summing to round amounts**

This is the "super cool feature" - it automatically detects when numbers add up to convenient sums like £100, £500, £1,000, £5,000, etc. This can reveal:
- Suspicious patterns (debts that conveniently total £10,000)
- Possible fraud indicators
- Related transactions
- Payment arrangements

**Use Cases:**
- Fraud detection
- Finding related debts
- Identifying payment plans
- Spotting manufactured scenarios

**Example:**
```json
{
  "tool": "find_convenient_sums",
  "arguments": {
    "numbers": ["450", "550", "£1,200", "800"],
    "target_tolerance": 50
  }
}
```

**Result:**
```json
{
  "patterns_found": 3,
  "patterns": [
    {
      "type": "pair",
      "values": [450.0, 550.0],
      "sum": 1000.0,
      "target": 1000.0,
      "difference": 0.0,
      "description": "£450.00 + £550.00 = £1,000.00 (≈ £1,000.00)"
    },
    {
      "type": "pair",
      "values": [1200.0, 800.0],
      "sum": 2000.0,
      "target": 2000.0,
      "difference": 0.0,
      "description": "£1,200.00 + £800.00 = £2,000.00 (≈ £2,000.00)"
    },
    {
      "type": "total",
      "values": [450.0, 550.0, 1200.0, 800.0],
      "sum": 3000.0,
      "target": 3000.0,
      "difference": 0.0,
      "description": "Total sum £3,000.00 (≈ £3,000.00)"
    }
  ],
  "total_sum": 3000.0
}
```

**Red Flags This Detects:**
- 🚩 Multiple debts that perfectly total a round number
- 🚩 Two debts that are suspiciously complementary (£450 + £550 = £1,000)
- 🚩 Payment amounts that align too neatly

#### 5. detect_patterns(numbers)
Detect various numerical patterns in data.

**Patterns Detected:**
- **Duplicates**: Same number appearing multiple times
- **Similar Values**: Numbers within 5% of each other
- **Multiples**: One number being a multiple of another

**Use Cases:**
- Finding duplicate charges
- Identifying recurring payments
- Spotting systematic patterns

**Example:**
```json
{
  "tool": "detect_patterns",
  "arguments": {
    "numbers": ["500", "500", "250", "1000", "£1,000"]
  }
}
```

**Result:**
```json
{
  "duplicates": {
    "500.0": 2,
    "1000.0": 2
  },
  "duplicate_count": 2,
  "similar_groups": [
    {
      "values": [1000.0, 1000.0],
      "average": 1000.0,
      "range": 0.0,
      "count": 2
    }
  ],
  "multiples": [
    {
      "base": 250.0,
      "multiple": 500.0,
      "factor": 2,
      "description": "£500.00 is 2x £250.00"
    },
    {
      "base": 250.0,
      "multiple": 1000.0,
      "factor": 4,
      "description": "£1,000.00 is 4x £250.00"
    }
  ]
}
```

#### 6. extract_numbers_from_text(text)
Extract all numbers from text and get statistics.

**Use Cases:**
- Parsing narrative descriptions
- Extracting amounts from letters
- Quick data gathering

**Example:**
```json
{
  "tool": "extract_numbers_from_text",
  "arguments": {
    "text": "Client owes £1,500 to creditor A, £2,300 to B, and £450 to C"
  }
}
```

**Result:**
```json
{
  "numbers": [1500.0, 2300.0, 450.0],
  "count": 3,
  "sum": 4250.0,
  "average": 1416.67,
  "min": 450.0,
  "max": 2300.0,
  "formatted_sum": "£4,250.00"
}
```

#### 7. check_threshold(amount, threshold_name, threshold_value=None) ⭐ KEY TOOL

**This is the cornerstone tool for the dynamic threshold system.**

Check if an amount meets or exceeds a threshold/limit. The system automatically:
1. Tries to use the provided `threshold_value` if given
2. Falls back to cached thresholds extracted from manuals on startup
3. Automatically determines if it's an upper limit (maximum) or lower limit (minimum)
4. Returns detailed comparison with qualification status

**Use Cases:**
- **Eligibility checking**: "Is £60,000 too much debt for a DRO?"
- **Income limits**: "Does £1,200/month income qualify for breathing space?"
- **Fee affordability**: "Can client afford £680 bankruptcy fee?"
- **Debt ceiling validation**: "Is total debt under IVA maximum?"

**How It Works:**

```
Question: "Can a client with £60,000 debt get a DRO?"

1. System retrieves context mentioning "DRO maximum debt is £30,000"
2. LLM recognizes need to check threshold
3. LLM calls: check_threshold('60000', 'DRO maximum debt')
4. System checks cache: dro_maximum_debt = 30000
5. System injects cached value into call
6. Python executes: 60000 > 30000? YES
7. Returns: {
     "qualifies": false,
     "exceeds_limit": true,
     "amount": 60000,
     "threshold": 30000,
     "difference": 30000,
     "percentage": 200.0,
     "advice": "Amount £60,000 exceeds DRO maximum debt of £30,000 by £30,000 (200% of limit)"
   }
```

**Example with Explicit Threshold:**
```json
{
  "tool": "check_threshold",
  "arguments": {
    "amount": "60000",
    "threshold_name": "DRO maximum debt",
    "threshold_value": "30000"
  }
}
```

**Example with Cached Threshold (Automatic):**
```json
{
  "tool": "check_threshold",
  "arguments": {
    "amount": "25000",
    "threshold_name": "DRO maximum debt"
  }
}
// System automatically injects threshold_value: "30000" from cache
```

**Result (Within Limit):**
```json
{
  "qualifies": true,
  "within_limit": true,
  "amount": 25000.0,
  "threshold": 30000.0,
  "difference": 5000.0,
  "percentage": 83.33,
  "advice": "Amount £25,000 is within DRO maximum debt limit of £30,000. Remaining headroom: £5,000 (83% utilization)",
  "headroom": 5000.0,
  "utilization": 83.33
}
```

**Result (Exceeds Limit):**
```json
{
  "qualifies": false,
  "exceeds_limit": true,
  "amount": 60000.0,
  "threshold": 30000.0,
  "difference": 30000.0,
  "percentage": 200.0,
  "advice": "Amount £60,000 exceeds DRO maximum debt of £30,000 by £30,000 (200% of limit)"
}
```

**Why This Tool is Critical:**

1. **Zero-Hallucination Thresholds**: LLMs often make up limits that sound plausible. This tool uses ACTUAL values from YOUR manuals.

2. **Current Compliance**: Thresholds are extracted from manuals on startup. Update the PDF, restart the service, and you're compliant with new limits.

3. **Audit Trail**: Every threshold check is logged with the exact values used, creating a compliance record.

4. **Intelligent Interpretation**: Automatically detects upper vs. lower limits:
   - "maximum debt" → upper limit (amount should be BELOW)
   - "minimum income" → lower limit (amount should be ABOVE)

5. **Actionable Advice**: Doesn't just return true/false, but explains:
   - How much over/under the limit
   - Percentage utilization
   - Remaining headroom if within limit

**Threshold Cache Population:**

On service startup:
```python
# System queries its own manuals
query = "List all numerical limits, maximums, minimums, thresholds, 
         and fees for debt solutions (DRO, bankruptcy, IVA, etc.)"

# Extracts values like:
# "DRO maximum debt: £30,000"
# "DRO application fee: £90"
# "Bankruptcy fee: £680"

# Caches as:
{
  "dro_maximum_debt": {"amount": 30000, "formatted": "£30,000"},
  "dro_fee": {"amount": 90, "formatted": "£90"},
  "bankruptcy_fee": {"amount": 680, "formatted": "£680"}
}
```

**No Hardcoded Values Anywhere!** 🎉

### How Tool Calling Works

**1. LLM Requests Tool**

The LLM includes a tool call in its response:
```
Based on the documents, the client has multiple debts. Let me calculate the total:

TOOL_CALL: {"tool": "sum_numbers", "arguments": {"numbers": ["1500", "2300", "450"]}}
```

**2. System Executes Tool**

The Python function runs and returns accurate results:
```json
{
  "sum": 4250.0,
  "average": 1416.67,
  "formatted_sum": "£4,250.00"
}
```

**3. LLM Continues with Results**

The system provides the tool output back to the LLM:
```
Tool Result (sum_numbers): {
  "sum": 4250.0,
  "formatted_sum": "£4,250.00"
}

Now continue your answer...
```

**4. LLM Incorporates Results**

The LLM uses the accurate calculation:
```
The client's total debt is £4,250.00 across three creditors.
```

### Integration in Synthesis

The tool calling is integrated into the `synthesize_answer()` method:

```python
def synthesize_answer(question, context, analysis, use_tools=True):
    # Initial response from LLM
    response = llm.invoke(prompt)
    
    # Check for tool calls (max 3 iterations)
    for iteration in range(max_tool_iterations):
        tool_matches = find_tool_calls(response)
        
        if not tool_matches:
            break  # No more tools needed
        
        # Execute each tool
        results = []
        for tool_call in tool_matches:
            result = tools.execute_tool(
                tool_call['tool'],
                tool_call['arguments']
            )
            results.append(result)
        
        # Continue synthesis with tool results
        response = llm.invoke(continuation_prompt + results)
    
    return clean_response(response)
```

### Example: Detecting Suspicious Patterns

**Question:** "Analyze the client's debts and check for any unusual patterns"

**Context from Documents:**
```
Debt to Bank A: £2,450
Debt to Credit Card B: £1,550
Debt to Loan C: £1,000
Debt to Store D: £5,000
```

**LLM Process:**

1. **Initial Analysis:**
```
I see four debts. Let me check for patterns:

TOOL_CALL: {"tool": "find_convenient_sums", "arguments": {"numbers": ["2450", "1550", "1000", "5000"]}}
```

2. **Tool Result:**
```json
{
  "patterns_found": 2,
  "patterns": [
    {
      "type": "pair",
      "values": [2450.0, 1550.0],
      "sum": 4000.0,
      "target": 4000.0,
      "description": "£2,450.00 + £1,550.00 = £4,000.00 (≈ £4,000.00)"
    },
    {
      "type": "total",
      "values": [2450.0, 1550.0, 1000.0, 5000.0],
      "sum": 10000.0,
      "target": 10000.0,
      "description": "Total sum £10,000.00 (≈ £10,000.00)"
    }
  ]
}
```

3. **LLM Response:**
```
⚠️ UNUSUAL PATTERN DETECTED

The client's four debts total EXACTLY £10,000.00, which is suspiciously round.

Additionally, the debts to Bank A and Credit Card B sum to exactly £4,000.00.

This level of precision is unusual in natural debt accumulation and may warrant further investigation:
- Are these debts legitimate?
- Could this be a manufactured scenario?
- Are the debts related or from the same source?

Recommendation: Request supporting documentation for all four debts.

CONFIDENCE_LEVEL: HIGH
CONFIDENCE_REASON: Tool-assisted numerical analysis reveals statistically improbable patterns
```

### Configuration

**Enable/Disable Tools:**
```python
# In agentic_query()
answer, confidence, tool_calls = synthesize_answer(
    question, context, analysis,
    use_tools=True,  # Set to False to disable
    max_tool_iterations=3  # Max tool call rounds
)
```

**Adjust Pattern Detection Tolerance:**
```python
# Default: within £50 of round numbers
find_convenient_sums(numbers, target_tolerance=50)

# Stricter: within £10
find_convenient_sums(numbers, target_tolerance=10)

# Looser: within £100
find_convenient_sums(numbers, target_tolerance=100)
```

### Performance Impact

**Tool Calling Overhead:**
- Each tool call: <100ms (Python execution)
- LLM continuation: ~1-2 seconds per iteration
- Max iterations: 3 (configurable)

**Total Impact:**
- No tools: 3-5 seconds
- With tools (1-2 calls): 5-8 seconds
- Worth it for accuracy and pattern detection!

### Best Practices

**When to Encourage Tool Use:**

1. **Questions involving calculations:**
   - "What is the total debt?"
   - "How much more does X owe than Y?"
   - "Calculate the monthly payment"

2. **Questions about patterns:**
   - "Are there any suspicious patterns?"
   - "Do any debts seem related?"
   - "Check for unusual amounts"

3. **Comparisons:**
   - "Which option costs more?"
   - "Is this within the threshold?"
   - "Prioritize these debts"

**Prompt Engineering:**

The prompts explicitly encourage tool use:
```
For ANY numerical operations (adding, comparing, checking sums), 
USE THE TOOLS - they are more accurate than calculating in your head

When you see multiple numbers, consider using find_convenient_sums 
or detect_patterns to spot interesting relationships
```

### Troubleshooting

**Tools Not Being Called:**

1. Check LLM temperature (too high = creative but doesn't follow format)
2. Verify tool descriptions are clear in prompt
3. Check logs for tool call attempts
4. Ensure `use_tools=True` in synthesize_answer()

**Tool Errors:**

Common issues:
- Invalid JSON in tool call → Parser fails gracefully, continues without tool
- Wrong argument types → Returns error dict, LLM adapts
- Missing arguments → Returns error dict with guidance

**Verification:**

Check `tool_calls` field in response:
```json
{
  "answer": "...",
  "tool_calls": [
    {
      "tool": "sum_numbers",
      "arguments": {"numbers": ["1500", "2300"]},
      "result": {"sum": 3800.0, "formatted_sum": "£3,800.00"}
    }
  ]
}
```

## Architecture

### 1. Question Complexity Analysis

The first step analyzes the incoming question to determine its complexity and plan the approach.

**Prompt:** The system asks the LLM to classify the question as:
- **Simple**: Direct, factual questions with straightforward answers
- **Moderate**: Questions requiring some context or explanation
- **Complex**: Multi-faceted questions requiring synthesis across multiple sources

**Output:**
```json
{
  "complexity": "complex",
  "reasoning": "Requires understanding multiple procedures and comparing them",
  "suggested_searches": [
    "debt prioritization criteria",
    "breathing space scheme eligibility"
  ],
  "requires_synthesis": true
}
```

**Example Classifications:**

| Question | Complexity | Reasoning |
|----------|-----------|-----------|
| "What is breathing space?" | Simple | Direct definition question |
| "How do I handle client debt priorities?" | Moderate | Requires procedural knowledge |
| "Should I recommend bankruptcy vs DRO for this client?" | Complex | Requires comparing multiple options |

### 2. Search Strategy Planning

Based on complexity analysis, the system determines:

- **Number of search iterations**:
  - Simple: 1 iteration
  - Moderate: 2 iterations
  - Complex: Up to `max_iterations` (default 3)

- **Search queries**: Uses the LLM-generated `suggested_searches` instead of the raw question
  - More targeted retrieval
  - Better semantic matching
  - Reduced noise

**Example:**
```
Question: "What are the consequences if a client enters breathing space?"
Suggested Searches:
  1. "breathing space scheme creditor actions"
  2. "breathing space moratorium effects"
  3. "breathing space scheme consequences"
```

### 3. Iterative Context Gathering

The system performs multiple vector similarity searches using the planned queries.

**Process:**
1. For each search query:
   - Perform vector similarity search (top_k chunks, default 4)
   - Collect results with metadata (source, chunk ID, query used)
2. Deduplicate chunks (same content only counted once)
3. Aggregate all unique chunks into a context pool

**Deduplication:**
- Uses `{source}_{chunk_id}` as unique identifier
- Prevents redundant information
- Maintains diverse perspectives

**Result:**
```python
{
  "chunks_found": 12,
  "sources": ["CPAG 5 debt respite schemes.pdf", "CPAG 3 court procedures.pdf"],
  "unique_chunks": 12,
  "search_queries_used": 3
}
```

### 4. Answer Synthesis

The final step combines all gathered context into a coherent answer.

**Synthesis Prompt Structure:**
```
You are an expert financial advisor at Riverside Money Advice.

Original Question: {question}
Question Analysis: {complexity reasoning}

Relevant Context:
[Source 1: filename.pdf]
{context chunk 1}
[Source 2: filename.pdf]
{context chunk 2}
...

Instructions:
1. Synthesize a comprehensive answer using the context
2. Cite specific sources when making claims
3. If context is insufficient, state what's missing
4. Be clear, practical, and procedure-focused

IMPORTANT: You MUST end your response with:
CONFIDENCE_LEVEL: HIGH|MEDIUM|LOW
CONFIDENCE_REASON: [One sentence explaining why]
```

**Output Format:**
```json
{
  "answer": "Detailed answer with source citations...",
  "sources": ["CPAG 5.pdf", "CPAG 3.pdf"],
  "confidence": "HIGH - Answer based on comprehensive manual coverage",
  "iterations_used": 2,
  "reasoning_steps": [...]
}
```

### 5. Confidence Assessment

The system provides explicit confidence ratings with reasoning:

**Confidence Levels:**

- **HIGH**: Answer well-supported by multiple sources, comprehensive coverage
  - Example: "HIGH - Multiple manual sections directly address this question"
  
- **MEDIUM**: Partial information available, some uncertainty or hedging
  - Example: "MEDIUM - Some relevant information found but may require case-specific judgment"
  
- **LOW**: Insufficient information, missing critical context
  - Example: "LOW - Limited information in manuals, additional resources needed"

**Confidence Extraction:**

The system uses multiple regex patterns to extract confidence from LLM output:
1. Primary format: `CONFIDENCE_LEVEL: HIGH\nCONFIDENCE_REASON: ...`
2. Fallback format: `CONFIDENCE: [HIGH] - ...`
3. Natural format: `Confidence: HIGH - ...`

If no explicit confidence is provided, the system infers it from:
- Uncertainty language ("may", "possibly", "might") → MEDIUM
- Missing information indicators ("insufficient", "unclear") → LOW
- Otherwise → MEDIUM (default)

## API Usage

### Training Manual Queries (rag-service)

**Endpoint:** `POST /agentic-query`

**Request:**
```json
{
  "question": "What is breathing space and who is eligible?",
  "show_reasoning": true,
  "model": "llama3.2",
  "max_iterations": 3,
  "top_k": 4
}
```

**Parameters:**
- `question` (required): The question to answer
- `show_reasoning` (optional, default: true): Include reasoning steps in response
- `model` (optional, default: "llama3.2"): Ollama model to use
- `max_iterations` (optional, default: 3): Maximum search iterations for complex questions
- `top_k` (optional, default: 4): Number of chunks per search

**Response:**
```json
{
  "answer": "Breathing space is a debt respite scheme that provides legal protection...",
  "sources": ["CPAG 5 debt respite schemes.pdf"],
  "confidence": "HIGH - Comprehensive coverage in manual section",
  "iterations_used": 1,
  "reasoning_steps": [
    {
      "step": "analysis",
      "description": "Question complexity analysis",
      "result": {
        "complexity": "simple",
        "reasoning": "Direct definition question",
        "suggested_searches": ["breathing space definition"],
        "requires_synthesis": false
      }
    },
    {
      "step": "planning",
      "description": "Search strategy",
      "result": {
        "complexity": "simple",
        "iterations": 1,
        "searches": ["breathing space definition"]
      }
    },
    {
      "step": "retrieval",
      "description": "Context gathering",
      "result": {
        "chunks_found": 4,
        "sources": ["CPAG 5 debt respite schemes.pdf"]
      }
    }
  ]
}
```

### Client Document Queries (client-rag-service)

**Endpoint:** `POST /agentic-query`

**Request:**
```json
{
  "client_id": "CLIENT001",
  "question": "What is the total debt amount?",
  "show_reasoning": true,
  "model": "llama3.2",
  "max_iterations": 2,
  "top_k": 4
}
```

**Response:** Same format as manual queries, but searches client-specific documents

## Implementation Details

### Code Structure

**rag-service/app.py:**
```python
class RAGService:
    def analyze_question_complexity(question, model) -> Dict:
        """Classify question complexity and suggest searches"""
        
    def iterative_search(search_queries, top_k) -> List[Dict]:
        """Perform multiple targeted searches"""
        
    def synthesize_answer(question, context_chunks, analysis) -> Tuple[str, str]:
        """Generate answer with confidence from gathered context"""
        
    def agentic_query(question, ...) -> Dict:
        """Main agentic workflow orchestrator"""
```

**Workflow:**
```python
def agentic_query(question):
    # Step 1: Analyze
    analysis = analyze_question_complexity(question)
    
    # Step 2: Plan
    search_queries = analysis["suggested_searches"]
    iterations = determine_iterations(analysis["complexity"])
    
    # Step 3: Gather
    context_chunks = iterative_search(search_queries[:iterations])
    
    # Step 4: Synthesize
    answer, confidence = synthesize_answer(question, context_chunks, analysis)
    
    # Step 5: Return
    return {
        "answer": answer,
        "confidence": confidence,
        "reasoning_steps": [...]
    }
```

### Performance Characteristics

**Simple Questions:**
- 1 search iteration
- 4 chunks retrieved
- ~2-3 seconds response time
- Low LLM token usage

**Moderate Questions:**
- 2 search iterations
- 8-12 unique chunks
- ~4-6 seconds response time
- Moderate LLM token usage

**Complex Questions:**
- 3+ search iterations
- 12-20 unique chunks
- ~8-12 seconds response time
- Higher LLM token usage

### Error Handling

The system gracefully handles failures at each stage:

1. **Complexity Analysis Failure:**
   - Falls back to "moderate" complexity
   - Uses original question as search query
   
2. **Search Failure:**
   - Logs error but continues with other searches
   - Returns partial results if some searches succeed
   
3. **Synthesis Failure:**
   - Returns error message with LOW confidence
   - Logs full exception for debugging

## Configuration

### Environment Variables

Both services use these settings:

```env
OLLAMA_URL=http://ollama:11434
CHROMADB_HOST=chromadb
CHROMADB_PORT=8000
```

### Service-Specific Settings

**rag-service:**
- Collection name: `"manuals"`
- Default model: `llama3.2`
- Max iterations: 3
- Top-k: 4

**client-rag-service:**
- Collection name per client: `"client_{client_id}"`
- Default model: `llama3.2`
- Max iterations: 2 (client docs typically smaller)
- Top-k: 4

## Comparison: Traditional vs Agentic RAG

| Aspect | Traditional RAG | Agentic RAG |
|--------|----------------|-------------|
| Query Processing | Use question as-is | Analyze & generate targeted searches |
| Search Strategy | Single search | Multiple iterative searches |
| Context Quality | May include irrelevant chunks | Targeted, deduplicated chunks |
| Answer Quality | Basic retrieval + generation | Synthesis with reasoning |
| Confidence | None | Explicit confidence rating |
| Complexity Handling | Same process for all questions | Adaptive based on complexity |
| Response Time | Faster (single pass) | Slower (multi-stage) |
| Transparency | Black box | Reasoning steps provided |

## Best Practices

### When to Use Agentic RAG

✅ **Use Agentic RAG for:**
- Complex questions requiring synthesis
- Questions spanning multiple topics
- When you need confidence metrics
- When transparency is important
- User-facing advisors needing explanations

❌ **Consider Standard RAG for:**
- Simple lookups or definitions
- High-volume automated queries
- Latency-sensitive applications
- When reasoning overhead isn't needed

### Optimizing Performance

1. **Adjust max_iterations:**
   - Use 1-2 for most questions
   - Reserve 3+ for known complex scenarios

2. **Tune top_k:**
   - Lower for simple questions (2-3)
   - Higher for complex synthesis (5-8)

3. **Model Selection:**
   - `llama3.2`: Fast, good quality (recommended)
   - Larger models: Better synthesis, slower

4. **Caching:**
   - Cache common questions
   - Especially valuable for simple complexity questions

### Prompt Engineering Tips

The system's effectiveness depends on well-crafted prompts:

1. **Analysis Prompt:**
   - Clearly define complexity levels
   - Provide examples of each level
   - Request structured JSON output

2. **Synthesis Prompt:**
   - Emphasize source citation
   - Request explicit confidence
   - Specify format requirements

## Troubleshooting

### Low Quality Answers

**Symptoms:** Answers are vague or off-topic

**Solutions:**
1. Check if complexity analysis is working (inspect reasoning_steps)
2. Verify search queries are relevant
3. Increase top_k to gather more context
4. Check manual ingestion completeness

### Confidence Always "MEDIUM"

**Symptoms:** Confidence never shows HIGH or LOW

**Solutions:**
1. Check LLM is following prompt format
2. Review synthesis prompt clarity
3. Verify regex patterns are matching
4. Enable full logging to see raw LLM output

### Slow Response Times

**Symptoms:** Queries take >15 seconds

**Solutions:**
1. Reduce max_iterations (try 2 instead of 3)
2. Lower top_k (try 3 instead of 4)
3. Use smaller/faster Ollama model
4. Check ChromaDB performance
5. Verify Ollama has GPU access

### Inconsistent Results

**Symptoms:** Same question gives different answers

**Solutions:**
1. Lower LLM temperature (0.3-0.5 instead of 0.7)
2. Use `show_reasoning` to debug decision process
3. Check if vector store has been updated
4. Verify question analysis is consistent

## Future Enhancements

Potential improvements to the agentic system:

1. **Query Refinement:**
   - Allow LLM to refine searches based on initial results
   - True multi-turn reasoning

2. **Source Ranking:**
   - Weight more authoritative sources higher
   - Learn from user feedback

3. **Confidence Calibration:**
   - Track actual accuracy vs predicted confidence
   - Adjust confidence thresholds

4. **Caching & Learning:**
   - Cache common question patterns
   - Learn optimal search strategies

5. **Multi-Modal Support:**
   - Handle images, tables in documents
   - Visual reasoning for charts/diagrams

## Related Documentation

- [RAG Service API Reference](../api/reference.md#rag-service)
- [Client RAG Service API Reference](../api/reference.md#client-rag-service)
- [Vector Database Architecture](../architecture/database.md#chromadb)
- [Ollama Model Configuration](../deployment/aws-guide.md#ollama-setup)

## References

- LangChain Documentation: https://python.langchain.com/docs/
- ChromaDB Documentation: https://docs.trychroma.com/
- Ollama Documentation: https://ollama.ai/
