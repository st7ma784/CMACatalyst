#!/usr/bin/env python3
"""
LangChain tool wrapper for symbolic reasoning.

Preserves the brilliant symbolic reasoning system while making it
available as a tool for the LangGraph agent.
"""

from langchain_core.tools import tool
from typing import Dict, List, Any
import logging
import sys
import os

# Import the existing SymbolicReasoner
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from symbolic_reasoning import SymbolicReasoner

logger = logging.getLogger(__name__)


@tool
def symbolic_reasoning_tool(
    question: str,
    context_texts: List[str],
    model_name: str = "llama3.2"
) -> Dict[str, Any]:
    """
    Apply symbolic reasoning to numerical queries.

    This tool implements a sophisticated 5-step process that PREVENTS LLM
    math errors by separating logical reasoning from numerical computation.

    Process:
    1. Symbolize question: Replace numbers with [AMOUNT_1], [AMOUNT_2], etc.
    2. Symbolize context: Replace manual numbers with [LIMIT_1], [LIMIT_2], etc.
    3. LLM symbolic reasoning: Get logical reasoning with symbolic variables
    4. Extract comparisons: Find COMPARISON: statements
    5. Compute results: Python does the math (NOT the LLM)
    6. Substitute back: Replace symbols with actual values and results

    Args:
        question: User's question with numbers (e.g., "Can £60,000 debt qualify for DRO?")
        context_texts: List of manual text chunks (may contain numbers)
        model_name: LLM model to use for reasoning (default: "llama3.2")

    Returns:
        Dictionary with:
        - answer: Final answer with numbers substituted back
        - symbolic_variables: Extracted variables (e.g., {"AMOUNT_1": 60000})
        - comparisons: List of computed comparisons
        - reasoning: Raw symbolic reasoning
        - variables_count: Number of variables extracted

    Examples:
        Input:
            question: "Can client with £60,000 debt get DRO?"
            context: ["The DRO debt limit is £50,000..."]

        Process:
            1. Symbolic Q: "Can client with [AMOUNT_1] get DRO?"
            2. Symbolic C: "The DRO debt limit is [LIMIT_1]..."
            3. LLM: "COMPARISON: [AMOUNT_1] > [LIMIT_1] → not eligible"
            4. Python: 60000 > 50000 = True
            5. Final: "£60,000 > £50,000 (TRUE), therefore not eligible"

    When to use:
        - ANY question involving numerical comparisons
        - Eligibility checks with thresholds
        - When accuracy is critical (no LLM math errors)
        - Questions with "can client with X qualify?"

    Benefits:
        - LLM cannot make arithmetic errors (Python does math)
        - Reasoning is explicit and verifiable
        - Comparisons are logged for audit
        - Generic variable names prevent bias

    Note:
        This tool preserves your existing brilliant symbolic reasoning
        system (symbolic_reasoning.py) while making it accessible to
        the agent. The implementation is UNCHANGED - just wrapped.
    """
    try:
        reasoner = SymbolicReasoner()

        # Step 1: Symbolize question
        symbolic_q, variables = reasoner.symbolize_question(question)
        logger.info(f"🔢 Symbolized question with {len(variables)} variables")

        # Step 2: Symbolize context chunks
        symbolic_contexts = []
        for text in context_texts:
            symbolic_text, chunk_vars = reasoner.symbolize_manual_text(text)
            symbolic_contexts.append(symbolic_text)
            variables.update(chunk_vars)

        logger.info(f"🔢 Total variables after context: {len(variables)}")

        # Step 3: Get symbolic reasoning from LLM
        # Note: The LLM binding happens at agent level, so we need to get it from context
        # For now, we'll use the Ollama instance directly
        from langchain_community.llms import Ollama
        ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")
        llm = Ollama(model=model_name, base_url=ollama_url, temperature=0.7)

        symbolic_context = "\n\n".join(symbolic_contexts)
        reasoning = reasoner.get_symbolic_reasoning(symbolic_q, symbolic_context, llm)

        # Step 4: Extract comparisons
        comparisons = reasoner.extract_comparisons(reasoning)
        logger.info(f"🔍 Extracted {len(comparisons)} comparisons")

        # Step 5: Compute results (Python does the math!)
        results = reasoner.compute_results(comparisons, variables)
        logger.info(f"✅ Computed {len(results)} comparison results")

        # Step 6: Substitute back to natural language
        final_answer = reasoner.substitute_back(reasoning, variables, results)

        return {
            "answer": final_answer,
            "symbolic_variables": {
                var.name: var.value for var in variables.values()
            },
            "comparisons": [
                {
                    "left": c.left,
                    "operator": c.operator,
                    "right": c.right,
                    "result": c.result
                }
                for c in comparisons
            ],
            "reasoning": reasoning,
            "variables_count": len(variables),
            "success": True
        }

    except Exception as e:
        logger.error(f"Symbolic reasoning failed: {e}")
        return {
            "error": str(e),
            "answer": "Symbolic reasoning failed - falling back to standard synthesis",
            "success": False
        }


__all__ = ['symbolic_reasoning_tool']
