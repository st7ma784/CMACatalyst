"""
Threshold detection tools for LangGraph agent.

These tools wrap threshold detection functionality to provide LangChain-compatible
tool interfaces for extracting numerical thresholds from documents.
"""

from typing import Dict, Any, List, Optional
from langchain_core.tools import tool
import re


@tool
def extract_threshold_from_text(
    text: str,
    context: str = ""
) -> Dict[str, Any]:
    """
    Extract numerical thresholds from text (e.g., "debt must be less than £50,000").

    Args:
        text: Text to search for thresholds
        context: Optional context about what threshold to look for (e.g., "DRO debt limit")

    Returns:
        Dictionary with:
        - thresholds: List of detected thresholds
        - count: Number of thresholds found
        - context: Original context

    Example:
        result = extract_threshold_from_text(
            "DRO is available for debts under £50,000",
            "DRO debt limit"
        )
        # Returns: {"thresholds": [{"value": 50000, "operator": "<", "currency": "GBP"}]}
    """
    try:
        thresholds = []

        # Pattern for monetary amounts with operators
        # Matches: "less than £50,000", "under £50k", "> £30,000", etc.
        patterns = [
            # "less than £X", "under £X", "below £X"
            r'(?:less than|under|below|fewer than)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
            # "more than £X", "over £X", "above £X", "exceeding £X"
            r'(?:more than|over|above|exceeding|greater than)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
            # Direct comparison: "< £X", "> £X", "<= £X", ">= £X"
            r'([<>]=?)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
            # "£X or less", "£X or more"
            r'£?\s*([\d,]+(?:\.\d{2})?)\s*k?\s*or\s*(less|more|fewer|greater)',
            # "maximum of £X", "minimum of £X"
            r'(?:maximum|max|minimum|min)\s+of\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
        ]

        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                # Extract value and determine operator
                if 'less' in match.group(0).lower() or 'under' in match.group(0).lower() or 'below' in match.group(0).lower() or 'fewer' in match.group(0).lower():
                    operator = '<'
                    value_str = match.group(1)
                elif 'more' in match.group(0).lower() or 'over' in match.group(0).lower() or 'above' in match.group(0).lower() or 'greater' in match.group(0).lower() or 'exceeding' in match.group(0).lower():
                    operator = '>'
                    value_str = match.group(1)
                elif 'maximum' in match.group(0).lower() or 'max' in match.group(0).lower():
                    operator = '<='
                    value_str = match.group(1)
                elif 'minimum' in match.group(0).lower() or 'min' in match.group(0).lower():
                    operator = '>='
                    value_str = match.group(1)
                elif match.group(0).startswith(('<', '>')):
                    operator = match.group(1)
                    value_str = match.group(2)
                else:
                    continue

                # Parse value (handle k suffix for thousands)
                value_str = value_str.replace(',', '')
                if 'k' in match.group(0).lower():
                    value = float(value_str) * 1000
                else:
                    value = float(value_str)

                thresholds.append({
                    "value": value,
                    "operator": operator,
                    "currency": "GBP",
                    "matched_text": match.group(0),
                    "context": context
                })

        return {
            "success": True,
            "thresholds": thresholds,
            "count": len(thresholds),
            "context": context,
            "original_text": text[:200] + "..." if len(text) > 200 else text
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "thresholds": [],
            "count": 0
        }


@tool
def extract_income_threshold(text: str) -> Dict[str, Any]:
    """
    Extract income-specific thresholds from text.

    Args:
        text: Text to search for income thresholds

    Returns:
        Dictionary with income threshold details

    Example:
        result = extract_income_threshold("Monthly income must not exceed £75")
        # Returns: {"threshold": 75, "period": "monthly", "operator": "<="}
    """
    try:
        # Look for income-specific patterns
        income_patterns = [
            r'(?:monthly|per month)\s+income.*?(?:less than|under|below|not exceed|maximum)\s*£?\s*([\d,]+(?:\.\d{2})?)',
            r'income.*?(?:less than|under|below|not exceed|maximum)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*(?:per month|monthly)',
            r'(?:monthly|per month)\s+income.*?([<>]=?)\s*£?\s*([\d,]+(?:\.\d{2})?)',
        ]

        for pattern in income_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    operator, value_str = match.groups()
                    value = float(value_str.replace(',', ''))
                else:
                    value_str = match.group(1)
                    value = float(value_str.replace(',', ''))
                    operator = '<='  # Default for "not exceed", "maximum", etc.

                return {
                    "success": True,
                    "threshold": value,
                    "operator": operator,
                    "period": "monthly",
                    "currency": "GBP",
                    "matched_text": match.group(0)
                }

        return {
            "success": True,
            "threshold": None,
            "message": "No income threshold found in text"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "threshold": None
        }


@tool
def extract_debt_threshold(text: str) -> Dict[str, Any]:
    """
    Extract debt-specific thresholds from text.

    Args:
        text: Text to search for debt thresholds

    Returns:
        Dictionary with debt threshold details

    Example:
        result = extract_debt_threshold("Total debts must be less than £50,000")
        # Returns: {"threshold": 50000, "operator": "<"}
    """
    try:
        # Look for debt-specific patterns
        debt_patterns = [
            r'(?:total )?debt[s]?.*?(?:less than|under|below|not exceed|maximum)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
            r'(?:total )?debt[s]?.*?([<>]=?)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
            r'(?:maximum|max)\s+debt.*?£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
        ]

        for pattern in debt_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    operator, value_str = match.groups()
                    value = float(value_str.replace(',', ''))
                else:
                    value_str = match.group(1)
                    value = float(value_str.replace(',', ''))
                    operator = '<='  # Default for "not exceed", "maximum", etc.

                # Handle 'k' suffix for thousands
                if 'k' in match.group(0).lower():
                    value *= 1000

                return {
                    "success": True,
                    "threshold": value,
                    "operator": operator,
                    "currency": "GBP",
                    "matched_text": match.group(0)
                }

        return {
            "success": True,
            "threshold": None,
            "message": "No debt threshold found in text"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "threshold": None
        }


@tool
def extract_asset_threshold(text: str) -> Dict[str, Any]:
    """
    Extract asset-specific thresholds from text.

    Args:
        text: Text to search for asset thresholds

    Returns:
        Dictionary with asset threshold details

    Example:
        result = extract_asset_threshold("Assets must not exceed £2,000")
        # Returns: {"threshold": 2000, "operator": "<="}
    """
    try:
        # Look for asset-specific patterns
        asset_patterns = [
            r'(?:total )?asset[s]?.*?(?:less than|under|below|not exceed|maximum)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
            r'(?:total )?asset[s]?.*?([<>]=?)\s*£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
            r'(?:maximum|max)\s+asset.*?£?\s*([\d,]+(?:\.\d{2})?)\s*k?',
        ]

        for pattern in asset_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    operator, value_str = match.groups()
                    value = float(value_str.replace(',', ''))
                else:
                    value_str = match.group(1)
                    value = float(value_str.replace(',', ''))
                    operator = '<='  # Default for "not exceed", "maximum", etc.

                # Handle 'k' suffix for thousands
                if 'k' in match.group(0).lower():
                    value *= 1000

                return {
                    "success": True,
                    "threshold": value,
                    "operator": operator,
                    "currency": "GBP",
                    "matched_text": match.group(0)
                }

        return {
            "success": True,
            "threshold": None,
            "message": "No asset threshold found in text"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "threshold": None
        }


@tool
def compare_value_to_threshold(
    value: float,
    threshold: float,
    operator: str
) -> Dict[str, Any]:
    """
    Compare a value against a threshold using the specified operator.

    Args:
        value: The value to check
        threshold: The threshold to compare against
        operator: Comparison operator ('<', '<=', '>', '>=', '==', '!=')

    Returns:
        Dictionary with:
        - passes: Whether the value meets the threshold criteria
        - value: The original value
        - threshold: The threshold
        - operator: The operator used
        - explanation: Human-readable explanation

    Example:
        result = compare_value_to_threshold(45000, 50000, '<')
        # Returns: {"passes": True, "explanation": "45000 < 50000 ✓"}
    """
    try:
        operator_map = {
            '<': lambda v, t: v < t,
            '<=': lambda v, t: v <= t,
            '>': lambda v, t: v > t,
            '>=': lambda v, t: v >= t,
            '==': lambda v, t: v == t,
            '!=': lambda v, t: v != t,
        }

        if operator not in operator_map:
            return {
                "success": False,
                "error": f"Invalid operator: {operator}",
                "passes": False
            }

        passes = operator_map[operator](value, threshold)
        symbol = "✓" if passes else "✗"

        return {
            "success": True,
            "passes": passes,
            "value": value,
            "threshold": threshold,
            "operator": operator,
            "explanation": f"{value} {operator} {threshold} {symbol}"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "passes": False
        }


# Export all tools
__all__ = [
    "extract_threshold_from_text",
    "extract_income_threshold",
    "extract_debt_threshold",
    "extract_asset_threshold",
    "compare_value_to_threshold"
]
