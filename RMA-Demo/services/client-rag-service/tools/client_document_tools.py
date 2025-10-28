"""
Client document tools for LangGraph agent.

These tools provide access to client-specific uploaded documents
and combine them with general manual context.
"""

from typing import Dict, Any, List, Optional
from langchain_core.tools import tool
import re


@tool
def search_client_documents(
    client_id: str,
    query: str,
    vectorstore,
    top_k: int = 4
) -> Dict[str, Any]:
    """
    Search client's uploaded documents for relevant information.

    Args:
        client_id: Client identifier
        query: Search query
        vectorstore: Client's vector store
        top_k: Number of results to return

    Returns:
        Dictionary with:
        - documents: List of relevant document chunks
        - count: Number of documents found
        - sources: List of source filenames

    Example:
        results = search_client_documents("CLIENT123", "What debts do I have?", vectorstore)
    """
    try:
        if vectorstore is None:
            return {
                "success": False,
                "error": f"No documents found for client {client_id}",
                "documents": [],
                "count": 0,
                "sources": []
            }

        # Search vector store
        docs = vectorstore.similarity_search(query, k=top_k)

        # Extract unique sources
        sources = list(set([doc.metadata.get("source", "unknown") for doc in docs]))

        # Format documents
        formatted_docs = []
        for doc in docs:
            formatted_docs.append({
                "content": doc.page_content,
                "source": doc.metadata.get("source", "unknown"),
                "chunk": doc.metadata.get("chunk", 0),
                "metadata": doc.metadata
            })

        return {
            "success": True,
            "documents": formatted_docs,
            "count": len(formatted_docs),
            "sources": sources,
            "client_id": client_id
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "documents": [],
            "count": 0,
            "sources": []
        }


@tool
def extract_financial_values_from_docs(
    documents: List[Dict],
    client_id: str
) -> Dict[str, Any]:
    """
    Extract financial values (debt, income, assets) from client documents.

    Args:
        documents: List of document chunks
        client_id: Client identifier

    Returns:
        Dictionary with:
        - debt: Total debt amount
        - income: Monthly income
        - assets: Total assets
        - extracted_values: All found financial values

    Example:
        values = extract_financial_values_from_docs(client_docs, "CLIENT123")
        # Returns: {"debt": 15000, "income": 1200, "assets": 5000}
    """
    try:
        extracted = {
            "debt": None,
            "income": None,
            "assets": None,
            "debts_list": [],
            "income_sources": [],
            "asset_items": []
        }

        # Patterns for financial values
        debt_pattern = r'(?:debt|owe|owing|balance).*?£?\s*([\d,]+(?:\.\d{2})?)'
        income_pattern = r'(?:income|salary|earn|wage).*?£?\s*([\d,]+(?:\.\d{2})?)'
        asset_pattern = r'(?:asset|savings|property value).*?£?\s*([\d,]+(?:\.\d{2})?)'

        total_debt = 0
        total_income = 0
        total_assets = 0

        # Search through all document chunks
        for doc in documents:
            content = doc.get("content", "")

            # Extract debts
            debt_matches = re.finditer(debt_pattern, content, re.IGNORECASE)
            for match in debt_matches:
                amount_str = match.group(1).replace(',', '')
                try:
                    amount = float(amount_str)
                    total_debt += amount
                    extracted["debts_list"].append({
                        "amount": amount,
                        "context": match.group(0),
                        "source": doc.get("source", "unknown")
                    })
                except ValueError:
                    pass

            # Extract income
            income_matches = re.finditer(income_pattern, content, re.IGNORECASE)
            for match in income_matches:
                amount_str = match.group(1).replace(',', '')
                try:
                    amount = float(amount_str)
                    total_income += amount
                    extracted["income_sources"].append({
                        "amount": amount,
                        "context": match.group(0),
                        "source": doc.get("source", "unknown")
                    })
                except ValueError:
                    pass

            # Extract assets
            asset_matches = re.finditer(asset_pattern, content, re.IGNORECASE)
            for match in asset_matches:
                amount_str = match.group(1).replace(',', '')
                try:
                    amount = float(amount_str)
                    total_assets += amount
                    extracted["asset_items"].append({
                        "amount": amount,
                        "context": match.group(0),
                        "source": doc.get("source", "unknown")
                    })
                except ValueError:
                    pass

        # Set totals
        if extracted["debts_list"]:
            extracted["debt"] = total_debt
        if extracted["income_sources"]:
            extracted["income"] = total_income
        if extracted["asset_items"]:
            extracted["assets"] = total_assets

        return {
            "success": True,
            "client_id": client_id,
            "extracted": extracted,
            "summary": {
                "total_debt": extracted["debt"],
                "total_income": extracted["income"],
                "total_assets": extracted["assets"]
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "extracted": {}
        }


@tool
def list_client_documents(client_id: str, vectorstore) -> Dict[str, Any]:
    """
    List all documents uploaded by a client.

    Args:
        client_id: Client identifier
        vectorstore: Client's vector store

    Returns:
        Dictionary with:
        - documents: List of unique filenames
        - count: Number of documents
        - total_chunks: Total document chunks stored

    Example:
        docs = list_client_documents("CLIENT123", vectorstore)
        # Returns: {"documents": ["statement.pdf", "payslip.pdf"], "count": 2}
    """
    try:
        if vectorstore is None:
            return {
                "success": True,
                "documents": [],
                "count": 0,
                "total_chunks": 0,
                "message": f"No documents for client {client_id}"
            }

        # Get collection info
        collection = vectorstore._collection
        total_chunks = collection.count()

        # Get all metadata to extract unique filenames
        results = collection.get(include=["metadatas"])

        # Extract unique sources
        sources = set()
        if results and "metadatas" in results:
            for metadata in results["metadatas"]:
                if "source" in metadata:
                    sources.add(metadata["source"])

        documents = sorted(list(sources))

        return {
            "success": True,
            "client_id": client_id,
            "documents": documents,
            "count": len(documents),
            "total_chunks": total_chunks
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "documents": [],
            "count": 0
        }


@tool
def get_document_summary(
    filename: str,
    client_id: str,
    vectorstore
) -> Dict[str, Any]:
    """
    Get summary of a specific client document.

    Args:
        filename: Document filename
        client_id: Client identifier
        vectorstore: Client's vector store

    Returns:
        Dictionary with:
        - filename: Document name
        - chunks: List of all chunks from this document
        - word_count: Approximate word count
        - key_topics: Main topics found in document

    Example:
        summary = get_document_summary("statement.pdf", "CLIENT123", vectorstore)
    """
    try:
        if vectorstore is None:
            return {
                "success": False,
                "error": f"No documents for client {client_id}",
                "filename": filename
            }

        # Get all chunks from this document
        collection = vectorstore._collection
        results = collection.get(
            where={"source": filename},
            include=["metadatas", "documents"]
        )

        if not results or not results.get("documents"):
            return {
                "success": False,
                "error": f"Document {filename} not found",
                "filename": filename
            }

        chunks = results["documents"]
        metadatas = results.get("metadatas", [])

        # Calculate stats
        total_text = " ".join(chunks)
        word_count = len(total_text.split())

        # Simple topic extraction (most common words)
        words = total_text.lower().split()
        word_freq = {}
        for word in words:
            if len(word) > 4:  # Only words longer than 4 chars
                word_freq[word] = word_freq.get(word, 0) + 1

        # Get top 5 topics
        key_topics = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:5]
        key_topics = [word for word, freq in key_topics]

        return {
            "success": True,
            "client_id": client_id,
            "filename": filename,
            "chunk_count": len(chunks),
            "word_count": word_count,
            "key_topics": key_topics,
            "chunks": [
                {
                    "content": chunk,
                    "metadata": metadatas[i] if i < len(metadatas) else {}
                }
                for i, chunk in enumerate(chunks)
            ]
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "filename": filename
        }


@tool
def compare_with_thresholds(
    extracted_values: Dict[str, float],
    threshold_cache: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compare client's extracted financial values with eligibility thresholds.

    Args:
        extracted_values: Dict with debt, income, assets
        threshold_cache: Threshold values from main RAG service

    Returns:
        Dictionary with:
        - dro_eligible: Whether client meets DRO criteria
        - bankruptcy_viable: Whether bankruptcy is an option
        - comparisons: Detailed threshold comparisons

    Example:
        result = compare_with_thresholds(
            {"debt": 15000, "income": 50, "assets": 1000},
            threshold_cache
        )
    """
    try:
        debt = extracted_values.get("debt", 0)
        income = extracted_values.get("income", 0)
        assets = extracted_values.get("assets", 0)

        # DRO thresholds (UK as of 2023)
        dro_debt_limit = 50000
        dro_income_limit = 75  # monthly disposable income
        dro_asset_limit = 2000

        # Check DRO eligibility
        dro_eligible = (
            debt < dro_debt_limit and
            income < dro_income_limit and
            assets < dro_asset_limit
        )

        # Check bankruptcy viability (simpler criteria)
        bankruptcy_viable = debt >= 5000

        comparisons = {
            "dro": {
                "eligible": dro_eligible,
                "criteria": [
                    {
                        "name": "Total Debt",
                        "value": debt,
                        "threshold": dro_debt_limit,
                        "passes": debt < dro_debt_limit,
                        "margin": dro_debt_limit - debt
                    },
                    {
                        "name": "Monthly Income",
                        "value": income,
                        "threshold": dro_income_limit,
                        "passes": income < dro_income_limit,
                        "margin": dro_income_limit - income
                    },
                    {
                        "name": "Total Assets",
                        "value": assets,
                        "threshold": dro_asset_limit,
                        "passes": assets < dro_asset_limit,
                        "margin": dro_asset_limit - assets
                    }
                ]
            },
            "bankruptcy": {
                "viable": bankruptcy_viable,
                "criteria": [
                    {
                        "name": "Minimum Debt",
                        "value": debt,
                        "threshold": 5000,
                        "passes": debt >= 5000
                    }
                ]
            }
        }

        return {
            "success": True,
            "dro_eligible": dro_eligible,
            "bankruptcy_viable": bankruptcy_viable,
            "comparisons": comparisons,
            "extracted_values": extracted_values
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# Export all tools
__all__ = [
    "search_client_documents",
    "extract_financial_values_from_docs",
    "list_client_documents",
    "get_document_summary",
    "compare_with_thresholds"
]
