#!/usr/bin/env python3
"""
Agent state definition for LangGraph.
Defines the shared state passed between all nodes.

This replaces manual variable tracking across methods in the old implementation.
"""

from typing import TypedDict, List, Dict, Optional, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    State shared across all agent nodes.

    This replaces the manual tracking of variables across the synthesize_answer()
    method and other methods in the old code (app.py:1342-1952).

    Benefits:
    - Type-safe: IDE autocomplete and type checking
    - Documented: All fields in one place
    - Immutable: Each node returns new state, no side effects
    - Testable: Easy to create test states
    """

    # =====================================================
    # CORE INPUT/OUTPUT
    # =====================================================
    messages: Annotated[List[BaseMessage], add_messages]  # Conversation history with automatic merging
    question: str                     # Original user question
    answer: str                       # Final generated answer

    # =====================================================
    # ANALYSIS PHASE
    # Replaces: analyze_question_complexity() return values
    # =====================================================
    complexity: str                   # "simple" | "moderate" | "complex"
    suggested_searches: List[str]     # Search queries to execute (1-3)
    reasoning: str                    # Analysis reasoning/explanation
    requires_symbolic: bool           # Whether symbolic reasoning is needed
    requires_tools: bool              # Whether numerical tools are needed

    # =====================================================
    # RETRIEVAL PHASE
    # Replaces: iterative_search() return values
    # =====================================================
    context_chunks: List[Dict]        # Retrieved manual chunks with metadata
    retrieval_metadata: Dict          # Search statistics (total chunks, queries, etc.)

    # =====================================================
    # SYMBOLIC REASONING PHASE (if needed)
    # Replaces: symbolic_agentic_query() intermediate variables
    # =====================================================
    symbolic_variables: Dict[str, float]     # Extracted variables (e.g., {"AMOUNT_1": 60000})
    symbolic_comparisons: List[Dict]         # Comparisons to compute
    symbolic_reasoning: Optional[str]        # Raw symbolic reasoning output

    # =====================================================
    # TOOL EXECUTION PHASE
    # Replaces: manual tool calling loop variables
    # =====================================================
    tool_calls: List[Dict]            # Tools called with arguments
    tool_results: List[Dict]          # Results from tool execution
    tool_iteration: int               # Current iteration count (for loop control)
    max_tool_iterations: int          # Maximum iterations allowed

    # =====================================================
    # OUTPUT PHASE
    # Replaces: confidence extraction and response building
    # =====================================================
    confidence: float                 # 0.0 to 1.0 confidence score
    confidence_reason: str            # Explanation for confidence level
    sources: List[str]                # Manual citations (filenames)

    # =====================================================
    # DECISION TREE PHASE (for eligibility checks)
    # Replaces: integrated_eligibility_check() variables
    # =====================================================
    client_values: Optional[Dict[str, float]]    # {"debt": 45000, "income": 500, ...}
    topic: Optional[str]                         # "dro_eligibility", "bankruptcy", etc.
    tree_path: Optional[Dict]                    # Decision tree traversal result
    criteria_breakdown: Optional[List[Dict]]     # Criterion-by-criterion results
    near_misses: Optional[List[Dict]]            # Near-miss opportunities
    recommendations: Optional[List[Dict]]        # Actionable recommendations

    # =====================================================
    # CONFIGURATION
    # =====================================================
    ollama_url: str                   # Ollama base URL
    model_name: str                   # Model to use (e.g., "llama3.2")
    top_k: int                        # Number of chunks to retrieve
    show_reasoning: bool              # Whether to include reasoning steps in response


def create_initial_state(
    question: str,
    ollama_url: str = "http://ollama:11434",
    model_name: str = "llama3.2",
    top_k: int = 4,
    max_tool_iterations: int = 3,
    show_reasoning: bool = True,
    client_values: Optional[Dict[str, float]] = None,
    topic: Optional[str] = None
) -> AgentState:
    """
    Create initial state from a question.

    This replaces manual variable initialization in old code.

    Args:
        question: User's question
        ollama_url: Ollama service URL
        model_name: LLM model to use
        top_k: Number of chunks to retrieve
        max_tool_iterations: Maximum tool calling iterations
        show_reasoning: Include reasoning steps in response
        client_values: Client financial values (for eligibility checks)
        topic: Topic for decision tree (e.g., "dro_eligibility")

    Returns:
        Initialized AgentState ready for processing

    Example:
        >>> state = create_initial_state("What is the DRO debt limit?")
        >>> # Pass to agent graph
        >>> result = agent_app.invoke(state, config)
    """
    return AgentState(
        # Core
        messages=[],
        question=question,
        answer="",

        # Analysis
        complexity="unknown",
        suggested_searches=[],
        reasoning="",
        requires_symbolic=False,
        requires_tools=False,

        # Retrieval
        context_chunks=[],
        retrieval_metadata={},

        # Symbolic reasoning
        symbolic_variables={},
        symbolic_comparisons=[],
        symbolic_reasoning=None,

        # Tools
        tool_calls=[],
        tool_results=[],
        tool_iteration=0,
        max_tool_iterations=max_tool_iterations,

        # Output
        confidence=0.5,
        confidence_reason="",
        sources=[],

        # Decision tree
        client_values=client_values,
        topic=topic,
        tree_path=None,
        criteria_breakdown=None,
        near_misses=None,
        recommendations=None,

        # Config
        ollama_url=ollama_url,
        model_name=model_name,
        top_k=top_k,
        show_reasoning=show_reasoning
    )


def state_to_response(state: AgentState, include_reasoning: bool = True) -> Dict:
    """
    Convert agent state to API response format.

    This helps maintain compatibility with existing API contracts.

    Args:
        state: Final agent state after processing
        include_reasoning: Whether to include reasoning steps

    Returns:
        Dictionary matching AgenticQueryResponse or EligibilityResponse format
    """
    response = {
        "answer": state.get("answer", ""),
        "sources": state.get("sources", []),
        "confidence": f"{state.get('confidence', 0.5):.0%} - {state.get('confidence_reason', 'N/A')}"
    }

    if include_reasoning:
        response["reasoning_steps"] = state.get("tool_results", [])
        response["iterations_used"] = state.get("tool_iteration", 0)

    # If this was an eligibility check, add tree results
    if state.get("tree_path"):
        response.update({
            "overall_result": state["tree_path"].get("result", "unknown").lower(),
            "criteria": state.get("criteria_breakdown", []),
            "near_misses": state.get("near_misses", []),
            "recommendations": state.get("recommendations", [])
        })

    return response
