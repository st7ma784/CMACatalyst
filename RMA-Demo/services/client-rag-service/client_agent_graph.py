"""
LangGraph workflow for client-specific document agent.

This agent combines client's uploaded documents with general manual knowledge
to provide personalized debt advice.
"""

from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END
from client_agent_state import ClientAgentState
import logging

logger = logging.getLogger(__name__)


def create_client_agent_graph(
    vectorstore_getter,  # Function to get client vectorstore
    threshold_cache: Dict,
    rag_service_url: str = "http://rag-service:8102"
):
    """
    Create LangGraph workflow for client document queries.

    Args:
        vectorstore_getter: Function(client_id) -> vectorstore
        threshold_cache: Cached threshold values
        rag_service_url: URL of main RAG service for general context

    Returns:
        Compiled StateGraph
    """
    from client_agent_nodes import (
        analyze_query_node,
        retrieve_client_docs_node,
        extract_values_node,
        check_eligibility_node,
        synthesize_answer_node,
        worry_analysis_node
    )

    # Create state graph
    workflow = StateGraph(ClientAgentState)

    # Add nodes
    workflow.add_node("analyze", lambda s: analyze_query_node(s))

    workflow.add_node(
        "retrieve_client",
        lambda s: retrieve_client_docs_node(s, vectorstore_getter)
    )

    workflow.add_node(
        "extract_values",
        lambda s: extract_values_node(s)
    )

    workflow.add_node(
        "check_eligibility",
        lambda s: check_eligibility_node(s, threshold_cache)
    )

    workflow.add_node(
        "worry_analysis",
        lambda s: worry_analysis_node(s)
    )

    workflow.add_node(
        "synthesize",
        lambda s: synthesize_answer_node(s)
    )

    # Define routing logic
    def route_after_analyze(state: ClientAgentState) -> Literal["retrieve_client", "synthesize"]:
        """Route based on query complexity."""
        complexity = state.get("complexity", "simple")

        if complexity == "simple":
            # Simple queries can go straight to retrieval and synthesis
            return "retrieve_client"
        else:
            # Complex queries need full workflow
            return "retrieve_client"

    def route_after_retrieval(state: ClientAgentState) -> Literal["extract_values", "synthesize"]:
        """Route based on whether we need value extraction."""
        question_lower = state["question"].lower()

        # Check if question involves eligibility or financial analysis
        if any(keyword in question_lower for keyword in [
            "eligible", "eligibility", "qualify",
            "dro", "bankruptcy", "debt relief"
        ]):
            return "extract_values"

        # Check if asking about worrying
        if "worry" in question_lower or "concern" in question_lower:
            return "extract_values"  # Need values for worry analysis

        # Otherwise, go straight to synthesis
        return "synthesize"

    def route_after_values(state: ClientAgentState) -> Literal["check_eligibility", "worry_analysis", "synthesize"]:
        """Route based on what type of analysis is needed."""
        question_lower = state["question"].lower()

        # Worry analysis
        if "worry" in question_lower or "concern" in question_lower:
            return "worry_analysis"

        # Eligibility check
        if any(keyword in question_lower for keyword in [
            "eligible", "eligibility", "qualify",
            "dro", "bankruptcy"
        ]):
            return "check_eligibility"

        # Default to synthesis
        return "synthesize"

    # Set entry point
    workflow.set_entry_point("analyze")

    # Add edges
    workflow.add_conditional_edges(
        "analyze",
        route_after_analyze,
        {
            "retrieve_client": "retrieve_client",
            "synthesize": "synthesize"
        }
    )

    workflow.add_conditional_edges(
        "retrieve_client",
        route_after_retrieval,
        {
            "extract_values": "extract_values",
            "synthesize": "synthesize"
        }
    )

    workflow.add_conditional_edges(
        "extract_values",
        route_after_values,
        {
            "check_eligibility": "check_eligibility",
            "worry_analysis": "worry_analysis",
            "synthesize": "synthesize"
        }
    )

    # Both eligibility and worry analysis go to synthesis
    workflow.add_edge("check_eligibility", "synthesize")
    workflow.add_edge("worry_analysis", "synthesize")

    # Synthesize goes to END
    workflow.add_edge("synthesize", END)

    # Compile
    app = workflow.compile()

    logger.info("✅ Client agent graph compiled successfully")

    return app


def visualize_client_graph(graph, output_path: str = "client_agent_graph.png"):
    """
    Generate visualization of client agent graph.

    Args:
        graph: Compiled StateGraph
        output_path: Where to save visualization
    """
    try:
        from langchain_core.runnables.graph import MermaidDrawMethod

        # Generate mermaid diagram
        mermaid_code = graph.get_graph().draw_mermaid()

        # Save to file
        with open(output_path.replace(".png", ".mmd"), "w") as f:
            f.write(mermaid_code)

        logger.info(f"✅ Graph diagram saved to {output_path.replace('.png', '.mmd')}")

        # Also try to render as PNG if graphviz available
        try:
            png_data = graph.get_graph().draw_mermaid_png(
                draw_method=MermaidDrawMethod.API
            )
            with open(output_path, "wb") as f:
                f.write(png_data)
            logger.info(f"✅ Graph PNG saved to {output_path}")
        except Exception as e:
            logger.debug(f"Could not generate PNG: {e}")

    except Exception as e:
        logger.error(f"Error visualizing graph: {e}")
