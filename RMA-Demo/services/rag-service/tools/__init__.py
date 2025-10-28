"""
LangChain tool wrappers for all RMA agent capabilities.

This module replaces manual tool execution in app.py (lines 1412-1467)
with LangChain's native tool calling infrastructure.

Benefits:
- Automatic tool call detection (no regex parsing)
- JSON schema validation
- Error recovery and retries
- Parallel execution where possible
- Better error messages
"""

from .numerical_tools import (
    calculate_tool,
    compare_numbers_tool,
    check_threshold_tool,
    sum_numbers_tool,
    extract_numbers_tool,
    find_patterns_tool,
    extract_and_enrich_tool
)

from .retrieval_tools import (
    search_manuals_tool,
    hybrid_search_tool
)

from .reasoning_tools import (
    symbolic_reasoning_tool
)

from .decision_tree_tools import (
    evaluate_decision_tree_tool
)


# Export all tools for agent registration
ALL_TOOLS = [
    # Numerical operations (most frequently used)
    calculate_tool,
    compare_numbers_tool,
    check_threshold_tool,
    sum_numbers_tool,
    extract_numbers_tool,
    find_patterns_tool,
    extract_and_enrich_tool,

    # Retrieval operations
    search_manuals_tool,
    hybrid_search_tool,

    # Advanced reasoning
    symbolic_reasoning_tool,
    evaluate_decision_tree_tool
]


# Tool categories for selective binding
NUMERICAL_TOOLS = [
    calculate_tool,
    compare_numbers_tool,
    check_threshold_tool,
    sum_numbers_tool,
    extract_numbers_tool,
    find_patterns_tool,
    extract_and_enrich_tool
]

RETRIEVAL_TOOLS = [
    search_manuals_tool,
    hybrid_search_tool
]

REASONING_TOOLS = [
    symbolic_reasoning_tool,
    evaluate_decision_tree_tool
]


__all__ = [
    'ALL_TOOLS',
    'NUMERICAL_TOOLS',
    'RETRIEVAL_TOOLS',
    'REASONING_TOOLS',
    # Individual tools
    'calculate_tool',
    'compare_numbers_tool',
    'check_threshold_tool',
    'sum_numbers_tool',
    'extract_numbers_tool',
    'find_patterns_tool',
    'extract_and_enrich_tool',
    'search_manuals_tool',
    'hybrid_search_tool',
    'symbolic_reasoning_tool',
    'evaluate_decision_tree_tool'
]
