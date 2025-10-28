"""
Client-specific Agent State for LangGraph.

Similar to main RAG service agent_state.py but with client-specific fields
for querying individual client documents.
"""

from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langchain_core.messages import BaseMessage, add_messages


class ClientAgentState(TypedDict):
    """
    State for client-specific document agent.

    Extends base agent state with client-specific context:
    - client_id: Which client's documents to query
    - client_documents: Retrieved client-specific document chunks
    - client_metadata: Metadata about client's uploaded documents
    - general_context: Context from general manuals (via main RAG service)
    """

    # Message history (automatic management)
    messages: Annotated[List[BaseMessage], add_messages]

    # Client identification
    client_id: str

    # Query information
    question: str
    answer: str
    complexity: str  # "simple", "complex", "multi_step"

    # Document retrieval
    client_documents: List[Dict]  # Client-specific documents
    general_context: List[Dict]  # General manual context (from main RAG)

    # Client metadata
    client_metadata: Dict[str, Any]  # Info about client's documents
    available_documents: List[str]  # List of client's uploaded files

    # Financial data (extracted from client docs)
    extracted_values: Dict[str, float]  # debt, income, assets, etc.

    # Symbolic reasoning
    symbolic_variables: Dict[str, float]
    symbolic_constraints: List[Dict]
    constraints_satisfied: bool

    # Numerical tools
    calculations: List[Dict]
    tool_calls: List[Dict]

    # Analysis results
    eligibility_result: Optional[Dict]  # DRO/bankruptcy eligibility
    worry_analysis: Optional[Dict]  # "Should I worry?" result
    recommendations: List[str]

    # Confidence and metadata
    confidence: float
    iterations_used: int
    reasoning_steps: List[Dict]
    sources: List[Dict]  # Source documents for answer

    # Configuration
    model_name: str
    ollama_url: str
    max_iterations: int
    top_k: int
    show_reasoning: bool

    # Error handling
    errors: List[str]
    warnings: List[str]


def create_initial_client_state(
    client_id: str,
    question: str,
    model_name: str = "llama3.2",
    ollama_url: str = "http://ollama:11434",
    max_iterations: int = 2,
    top_k: int = 4,
    show_reasoning: bool = True,
    **kwargs
) -> ClientAgentState:
    """
    Create initial state for client agent.

    Args:
        client_id: Client identifier
        question: User's question about client documents
        model_name: LLM model to use
        ollama_url: Ollama service URL
        max_iterations: Maximum reasoning iterations
        top_k: Number of documents to retrieve
        show_reasoning: Whether to include reasoning steps
        **kwargs: Additional state fields

    Returns:
        Initialized ClientAgentState
    """
    state = ClientAgentState(
        # Message history
        messages=[],

        # Client identification
        client_id=client_id,

        # Query
        question=question,
        answer="",
        complexity="unknown",

        # Document retrieval
        client_documents=[],
        general_context=[],

        # Client metadata
        client_metadata={},
        available_documents=[],

        # Extracted values
        extracted_values={},

        # Symbolic reasoning
        symbolic_variables={},
        symbolic_constraints=[],
        constraints_satisfied=False,

        # Calculations
        calculations=[],
        tool_calls=[],

        # Analysis
        eligibility_result=None,
        worry_analysis=None,
        recommendations=[],

        # Confidence
        confidence=0.0,
        iterations_used=0,
        reasoning_steps=[],
        sources=[],

        # Configuration
        model_name=model_name,
        ollama_url=ollama_url,
        max_iterations=max_iterations,
        top_k=top_k,
        show_reasoning=show_reasoning,

        # Errors
        errors=[],
        warnings=[]
    )

    # Add any additional fields from kwargs
    for key, value in kwargs.items():
        if key in state:
            state[key] = value

    return state


def state_to_response(state: ClientAgentState) -> Dict[str, Any]:
    """
    Convert agent state to API response format.

    Args:
        state: Final agent state

    Returns:
        Dictionary formatted for API response
    """
    response = {
        "answer": state["answer"],
        "sources": state["sources"],
        "confidence": state["confidence"]
    }

    # Add reasoning if requested
    if state.get("show_reasoning", False):
        response["reasoning_steps"] = state["reasoning_steps"]
        response["iterations_used"] = state["iterations_used"]

    # Add client-specific metadata
    response["client_id"] = state["client_id"]
    response["available_documents"] = state["available_documents"]

    # Add extracted values if present
    if state["extracted_values"]:
        response["extracted_values"] = state["extracted_values"]

    # Add eligibility result if present
    if state.get("eligibility_result"):
        response["eligibility_result"] = state["eligibility_result"]

    # Add worry analysis if present
    if state.get("worry_analysis"):
        response["worry_analysis"] = state["worry_analysis"]

    # Add recommendations
    if state["recommendations"]:
        response["recommendations"] = state["recommendations"]

    # Add warnings/errors if any
    if state["warnings"]:
        response["warnings"] = state["warnings"]

    if state["errors"]:
        response["errors"] = state["errors"]

    return response
