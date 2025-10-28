#!/usr/bin/env python3
"""
LangChain tool wrappers for numerical operations.

This wraps the existing NumericalTools class from numerical_tools.py
as LangChain tools for use with LangGraph.

Replaces: Manual tool calling loop in app.py:1412-1467
"""

from langchain_core.tools import tool
from typing import Union, List, Dict, Any
import sys
import os
import logging

# Import the existing NumericalTools class
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from numerical_tools import NumericalTools

logger = logging.getLogger(__name__)

# Create shared instance
_tools = NumericalTools()


@tool
def calculate_tool(expression: str) -> Dict[str, Any]:
    """
    Safely evaluate a mathematical expression.

    Use this tool for ANY arithmetic operations: addition, subtraction,
    multiplication, division. Do NOT try to calculate in your head.

    Args:
        expression: Math expression like "1500 + 2300 - 450" or "50000 * 0.15"

    Returns:
        Dictionary with:
        - result: Numerical result
        - formatted: Formatted currency string (e.g., "£3,800.00")
        - expression: Original expression

    Examples:
        - "1500 + 2300" → £3,800.00
        - "50000 - 45000" → £5,000.00
        - "250 * 12" → £3,000.00
        - "10000 / 4" → £2,500.00

    When to use:
        - ANY time you need to add, subtract, multiply, or divide numbers
        - Calculating totals, differences, percentages
        - DO NOT calculate manually - always use this tool
    """
    try:
        result = _tools.calculate(expression)
        logger.info(f"🧮 Calculate: {expression} = {result.get('formatted', result.get('result'))}")
        return result
    except Exception as e:
        logger.error(f"Calculate failed: {e}")
        return {"error": str(e), "expression": expression}


@tool
def compare_numbers_tool(
    num1: Union[str, float],
    num2: Union[str, float],
    operation: str = "greater"
) -> Dict[str, Any]:
    """
    Compare two financial amounts.

    Use this when you need to check if one amount is greater than,
    less than, or equal to another. Essential for threshold checking.

    Args:
        num1: First number (can include £ and commas)
        num2: Second number (can include £ and commas)
        operation: One of:
            - "greater": num1 > num2
            - "less": num1 < num2
            - "equal": num1 == num2
            - "greater_equal": num1 >= num2
            - "less_equal": num1 <= num2

    Returns:
        Dictionary with:
        - result: True/False
        - difference: Numerical difference
        - formatted_difference: Formatted currency difference
        - comparison: Human-readable comparison string

    Examples:
        - compare(60000, 50000, "greater") → True, difference: £10,000
        - compare(45000, 50000, "less_equal") → True, difference: £5,000
        - compare(50000, 50000, "equal") → True

    When to use:
        - Checking if client debt exceeds limit
        - Checking if income is below threshold
        - Any numerical comparison
    """
    try:
        result = _tools.compare_numbers(num1, num2, operation)
        logger.info(f"⚖️ Compare: {num1} {operation} {num2} = {result.get('result')}")
        return result
    except Exception as e:
        logger.error(f"Compare failed: {e}")
        return {"error": str(e), "num1": num1, "num2": num2}


@tool
def check_threshold_tool(
    amount: float,
    threshold_name: str,
    threshold_value: Union[float, str, None] = None,
    context: str = ""
) -> Dict[str, Any]:
    """
    Check if an amount meets an eligibility threshold.

    THIS IS THE MOST IMPORTANT TOOL FOR ELIGIBILITY CHECKS.
    Use this when comparing client values against DRO/bankruptcy/IVA limits.

    Args:
        amount: The client's value (e.g., their debt amount)
        threshold_name: Name of threshold (e.g., "dro_maximum_debt", "bankruptcy_fee")
        threshold_value: The limit (optional - will be fetched from cache if not provided)
        context: Additional context (e.g., "DRO eligibility", "bankruptcy assessment")

    Returns:
        Dictionary with:
        - eligible: True/False
        - threshold_name: Name of threshold checked
        - threshold_value: The limit value
        - amount: Client's value
        - gap: Distance from threshold (positive = under, negative = over)
        - percentage: Percentage of threshold used
        - advice: Contextual advice based on result

    Examples:
        - check_threshold(45000, "dro_maximum_debt")
          → Eligible: True, £5,000 below limit, 90% of limit
        - check_threshold(55000, "dro_maximum_debt")
          → Eligible: False, £5,000 above limit, 110% of limit
        - check_threshold(500, "dro_surplus_income", threshold_value=50)
          → Eligible: False, £450 above limit

    When to use:
        - ANY eligibility check question
        - Checking if client qualifies for DRO/bankruptcy/IVA
        - Comparing client values to known limits

    Note:
        In the old code, this had special handling (app.py:1429-1434) for
        threshold injection. Now the agent context automatically provides
        the threshold cache, making this a clean tool call.
    """
    try:
        result = _tools.check_threshold(
            amount=amount,
            threshold_name=threshold_name,
            threshold_value=threshold_value,
            context=context
        )
        logger.info(f"🎯 Threshold check: {amount} vs {threshold_name} = {result.get('eligible')}")
        return result
    except Exception as e:
        logger.error(f"Threshold check failed: {e}")
        return {
            "error": str(e),
            "amount": amount,
            "threshold_name": threshold_name
        }


@tool
def sum_numbers_tool(numbers: List[Union[str, float]]) -> Dict[str, Any]:
    """
    Calculate sum and statistics for a list of numbers.

    Use when you need to add multiple debts, income sources, or assets.
    Also provides average, min, max for context.

    Args:
        numbers: List of amounts (can include £ and commas)

    Returns:
        Dictionary with:
        - sum: Total of all numbers
        - average: Mean value
        - min: Smallest value
        - max: Largest value
        - count: Number of values
        - formatted_sum: Currency formatted sum

    Examples:
        - sum_numbers([1500, 2300, 450])
          → Sum: £4,250, Average: £1,416.67, Min: £450, Max: £2,300
        - sum_numbers(["£15,000", "£25,000", "£10,000"])
          → Sum: £50,000, Average: £16,666.67

    When to use:
        - Calculating total debt from multiple sources
        - Summing income from multiple jobs
        - Adding up assets
        - Any time you need to combine multiple numbers
    """
    try:
        result = _tools.sum_numbers(numbers)
        logger.info(f"➕ Sum: {len(numbers)} numbers = {result.get('formatted_sum')}")
        return result
    except Exception as e:
        logger.error(f"Sum failed: {e}")
        return {"error": str(e), "numbers": numbers}


@tool
def extract_numbers_tool(text: str) -> Dict[str, Any]:
    """
    Extract all financial amounts from text and calculate statistics.

    Use when parsing client documents, letters, or manual text to find amounts.
    Automatically detects currency amounts with £ symbols.

    Args:
        text: Text containing currency amounts

    Returns:
        Dictionary with:
        - amounts: List of found amounts
        - count: Number of amounts found
        - sum: Total of all amounts
        - average: Mean amount
        - min: Smallest amount
        - max: Largest amount
        - formatted_amounts: List of formatted strings

    Examples:
        - extract_numbers("Client has £15,000 debt and £25,000 assets")
          → Found: [£15,000, £25,000], Sum: £40,000, Count: 2
        - extract_numbers("Income of £1,200/month, expenses £800/month")
          → Found: [£1,200, £800], Sum: £2,000

    When to use:
        - Parsing client documents or letters
        - Extracting numbers from manual text
        - Finding amounts in unstructured text
        - Quick analysis of document contents
    """
    try:
        result = _tools.extract_numbers_from_text(text)
        logger.info(f"🔍 Extracted {result.get('count', 0)} numbers from text")
        return result
    except Exception as e:
        logger.error(f"Extract numbers failed: {e}")
        return {"error": str(e), "text": text[:100]}


@tool
def find_patterns_tool(numbers: List[Union[str, float]]) -> Dict[str, Any]:
    """
    Detect patterns in a list of numbers (duplicates, similar values, etc.).

    Use for fraud detection or identifying suspicious patterns in transactions.
    Helps identify unusual payment patterns that might need investigation.

    Args:
        numbers: List of amounts to analyze

    Returns:
        Dictionary with:
        - duplicates: List of duplicate values
        - similar_values: Groups of similar values (within 5%)
        - round_amounts: List of round numbers (multiples of 100)
        - suspicious_sums: Combinations that sum to round amounts
        - patterns: Description of detected patterns

    Examples:
        - find_patterns([500, 500, 498, 1000, 1000])
          → Duplicates: [500, 1000], Similar: [500, 498]
        - find_patterns([999, 998, 997])
          → Similar values detected: clustered around £998

    When to use:
        - Fraud detection analysis
        - Identifying suspicious transaction patterns
        - Quality checking data entry
        - Finding unusual payment groupings
    """
    try:
        result = _tools.detect_patterns(numbers)
        logger.info(f"🔎 Pattern analysis: {len(numbers)} numbers")
        return result
    except Exception as e:
        logger.error(f"Pattern detection failed: {e}")
        return {"error": str(e), "numbers": numbers}


@tool
def extract_and_enrich_tool(text: str, include_comparisons: bool = True) -> Dict[str, Any]:
    """
    AUTOMATICALLY enrich text containing thresholds with explicit numeric rules.

    This is a CRITICAL tool that makes LLMs much better at understanding
    numeric rules by adding explicit annotations.

    Args:
        text: Text containing numbers and threshold keywords
        include_comparisons: Whether to include comparison hints

    Returns:
        Dictionary with:
        - enriched_text: Text with added "📊 NUMERIC RULE" annotations
        - has_thresholds: True if thresholds were detected
        - detected_thresholds: List of detected threshold keywords
        - original_text: Original text

    Examples:
        Input: "The debt limit is £50,000 for DRO"
        Output:
            📊 NUMERIC RULE: £50,000 is an UPPER LIMIT for DRO debt.
            Values ABOVE this do NOT qualify.
            Values AT OR BELOW this DO qualify.

    When to use:
        - Before passing manual text to LLM for synthesis
        - When text contains eligibility limits
        - To make numeric rules explicit
        - Automatically called in retrieval phase

    Note:
        This tool is typically called automatically during context
        preparation (see agent_nodes.py retrieval_node), but can be
        called explicitly if needed.
    """
    try:
        result = _tools.extract_and_enrich_numbers(text, include_comparisons)
        if result.get('has_thresholds'):
            logger.info(f"📊 Enriched text with {len(result.get('detected_thresholds', []))} threshold hints")
        return result
    except Exception as e:
        logger.error(f"Extract and enrich failed: {e}")
        return {
            "error": str(e),
            "enriched_text": text,
            "has_thresholds": False
        }


# Export all tools
__all__ = [
    'calculate_tool',
    'compare_numbers_tool',
    'check_threshold_tool',
    'sum_numbers_tool',
    'extract_numbers_tool',
    'find_patterns_tool',
    'extract_and_enrich_tool'
]
