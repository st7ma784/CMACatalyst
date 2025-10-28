#!/usr/bin/env python3
"""
LangChain tool wrappers for retrieval operations.

Provides tools for searching and retrieving context from manuals.
"""

from langchain_core.tools import tool
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


@tool
def search_manuals_tool(
    query: str,
    top_k: int = 4,
    metadata_filter: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Search training manuals for relevant information.

    Use this tool when you need to find information from the training manuals
    that wasn't included in the initial context.

    Args:
        query: Search query (natural language question or keywords)
        top_k: Number of chunks to retrieve (default: 4)
        metadata_filter: Optional filters (e.g., {"has_number": True})

    Returns:
        Dictionary with:
        - chunks: List of relevant text chunks
        - sources: List of source filenames
        - count: Number of chunks retrieved

    Examples:
        - search_manuals_tool("DRO debt limit 2024")
        - search_manuals_tool("bankruptcy fee", top_k=6)
        - search_manuals_tool("income threshold", metadata_filter={"has_number": True})

    When to use:
        - When initial context is insufficient
        - When you need more specific information
        - When exploring related topics
        - For follow-up searches based on initial analysis

    Note:
        This tool will be bound to the vectorstore instance at runtime
        by the agent graph. The actual implementation is injected.
    """
    # This is a placeholder - actual implementation is injected by agent
    logger.warning("search_manuals_tool called but not bound to vectorstore")
    return {
        "error": "Tool not properly bound to vectorstore",
        "query": query
    }


@tool
def hybrid_search_tool(
    query: str,
    top_k: int = 10,
    semantic_weight: float = 0.7,
    keyword_weight: float = 0.3
) -> Dict[str, Any]:
    """
    Perform hybrid search combining semantic and keyword matching.

    Use this for more comprehensive searches that benefit from both
    semantic understanding and exact keyword matching.

    Args:
        query: Search query
        top_k: Number of results (more than semantic-only)
        semantic_weight: Weight for semantic similarity (0-1)
        keyword_weight: Weight for keyword matching (0-1)

    Returns:
        Dictionary with:
        - chunks: List of relevant chunks
        - sources: Source files
        - semantic_results: Count from semantic search
        - keyword_results: Count from keyword search
        - combined_count: Total unique results

    Examples:
        - hybrid_search_tool("DRO £50000 limit")
          → Finds both semantic matches and exact amount matches
        - hybrid_search_tool("bankruptcy discharge period")
          → Combines meaning understanding with keyword precision

    When to use:
        - When exact numbers or terms are important
        - When semantic search might miss specific details
        - For comprehensive document searches
        - When you need high recall

    Note:
        Like search_manuals_tool, this is bound to vectorstore at runtime.
    """
    # Placeholder - actual implementation injected by agent
    logger.warning("hybrid_search_tool called but not bound to vectorstore")
    return {
        "error": "Tool not properly bound to vectorstore",
        "query": query
    }


def bind_search_tools_to_vectorstore(vectorstore):
    """
    Bind search tools to actual vectorstore instance.

    This is called by the agent graph during initialization to inject
    the vectorstore dependency into the tools.

    Args:
        vectorstore: ChromaDB vectorstore instance

    Returns:
        Updated tool functions with vectorstore bound
    """
    from functools import partial

    def _search_manuals_impl(query: str, top_k: int = 4, metadata_filter: Optional[Dict] = None):
        """Actual implementation of search_manuals_tool."""
        try:
            # Use vectorstore similarity search
            where_filter = metadata_filter if metadata_filter else None

            results = vectorstore.similarity_search(
                query,
                k=top_k,
                filter=where_filter
            )

            chunks = []
            sources = set()

            for doc in results:
                chunks.append({
                    "text": doc.page_content,
                    "source": doc.metadata.get("source", "Unknown"),
                    "metadata": doc.metadata
                })
                sources.add(doc.metadata.get("source", "Unknown"))

            logger.info(f"🔍 Search '{query}': found {len(chunks)} chunks from {len(sources)} sources")

            return {
                "chunks": chunks,
                "sources": list(sources),
                "count": len(chunks),
                "query": query
            }

        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {
                "error": str(e),
                "query": query,
                "chunks": [],
                "sources": []
            }

    def _hybrid_search_impl(
        query: str,
        top_k: int = 10,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3
    ):
        """Actual implementation of hybrid_search_tool."""
        try:
            # Semantic search
            semantic_results = vectorstore.similarity_search(query, k=top_k)

            # For keyword search, we'd ideally use BM25 or similar
            # For now, use metadata filtering for number-containing chunks
            keyword_results = vectorstore.similarity_search(
                query,
                k=top_k,
                filter={"has_number": True}
            )

            # Combine and deduplicate
            seen_ids = set()
            combined_chunks = []

            # Add semantic results first (higher weight)
            for doc in semantic_results:
                chunk_id = doc.metadata.get("chunk_id", id(doc))
                if chunk_id not in seen_ids:
                    seen_ids.add(chunk_id)
                    combined_chunks.append({
                        "text": doc.page_content,
                        "source": doc.metadata.get("source", "Unknown"),
                        "metadata": doc.metadata,
                        "match_type": "semantic"
                    })

            # Add keyword results
            for doc in keyword_results:
                chunk_id = doc.metadata.get("chunk_id", id(doc))
                if chunk_id not in seen_ids:
                    seen_ids.add(chunk_id)
                    combined_chunks.append({
                        "text": doc.page_content,
                        "source": doc.metadata.get("source", "Unknown"),
                        "metadata": doc.metadata,
                        "match_type": "keyword"
                    })

            sources = list(set(chunk["source"] for chunk in combined_chunks))

            logger.info(f"🔍 Hybrid search '{query}': {len(semantic_results)} semantic + "
                       f"{len(keyword_results)} keyword = {len(combined_chunks)} unique")

            return {
                "chunks": combined_chunks[:top_k],  # Limit to top_k
                "sources": sources,
                "semantic_results": len(semantic_results),
                "keyword_results": len(keyword_results),
                "combined_count": len(combined_chunks),
                "query": query
            }

        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            return {
                "error": str(e),
                "query": query,
                "chunks": []
            }

    # Return bound implementations
    return _search_manuals_impl, _hybrid_search_impl


__all__ = [
    'search_manuals_tool',
    'hybrid_search_tool',
    'bind_search_tools_to_vectorstore'
]
