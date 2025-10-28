"""
Client RAG Service Tools for LangGraph Agent.

Provides client-specific document access combined with general manual tools.
"""

from .client_document_tools import (
    search_client_documents,
    extract_financial_values_from_docs,
    list_client_documents,
    get_document_summary,
    compare_with_thresholds
)

# Import numerical tools from parent directory
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from numerical_tools import NumericalTools
except ImportError:
    NumericalTools = None


# Export all tools
__all__ = [
    # Client document tools
    "search_client_documents",
    "extract_financial_values_from_docs",
    "list_client_documents",
    "get_document_summary",
    "compare_with_thresholds",
    # Numerical tools (if available)
    "NumericalTools"
]
