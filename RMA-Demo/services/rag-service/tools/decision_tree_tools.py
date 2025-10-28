#!/usr/bin/env python3
"""
LangChain tool wrapper for decision tree evaluation.

Makes the decision tree system available as a tool for the LangGraph agent.
"""

from langchain_core.tools import tool
from typing import Dict, Any, Optional
import logging
import sys
import os

# Import the existing decision tree classes
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from decision_tree_builder import DecisionTreeBuilder

logger = logging.getLogger(__name__)


@tool
def evaluate_decision_tree_tool(
    topic: str,
    client_values: Dict[str, float],
    include_strategies: bool = True
) -> Dict[str, Any]:
    """
    Evaluate client eligibility using decision tree logic.

    This tool provides structured eligibility evaluation with:
    - Rule-based decision making
    - Near-miss detection (close to qualifying)
    - Remediation strategies (how to qualify)
    - Criterion-by-criterion breakdown

    Args:
        topic: Decision tree topic (e.g., "dro_eligibility", "bankruptcy", "iva")
        client_values: Dict with client financial data:
            - "debt": Total debt amount
            - "income": Monthly surplus income
            - "assets": Total asset value
            - "amount": Any other relevant amount
        include_strategies: Whether to include remediation strategies (default: True)

    Returns:
        Dictionary with:
        - result: "ELIGIBLE" | "NOT_ELIGIBLE" | "REQUIRES_REVIEW"
        - confidence: Confidence score (0-1)
        - criteria: List of criterion results (each threshold checked)
        - near_misses: List of near-miss opportunities with gaps
        - strategies: List of remediation strategies (if near-miss)
        - nodes_traversed: Number of decision nodes evaluated
        - path: Decision path taken through tree

    Examples:
        Input:
            topic: "dro_eligibility"
            client_values: {"debt": 45000, "income": 50, "assets": 1000}

        Output:
            result: "ELIGIBLE"
            confidence: 0.95
            criteria: [
                {criterion: "debt", threshold: 50000, client_value: 45000,
                 status: "eligible", gap: 5000},
                {criterion: "income", threshold: 75, client_value: 50,
                 status: "eligible", gap: 25},
                {criterion: "assets", threshold: 2000, client_value: 1000,
                 status: "eligible", gap: 1000}
            ]
            near_misses: []
            strategies: []

        Near-Miss Example:
            client_values: {"debt": 52000, "income": 50, "assets": 1000}

        Output:
            result: "NOT_ELIGIBLE"
            near_misses: [
                {
                    threshold: 50000,
                    gap: 2000,
                    tolerance: 5000,
                    within_tolerance: True
                }
            ]
            strategies: [
                {
                    description: "Pay down debt to bring below £50,000 limit",
                    actions: ["Pay £2,000+ to reduce debt below limit"],
                    likelihood: "high"
                }
            ]

    When to use:
        - Eligibility check questions
        - "Can this client qualify for DRO/bankruptcy/IVA?"
        - When you have client financial values
        - When structured evaluation is needed

    Benefits:
        - Consistent rule application
        - Near-miss detection (close calls)
        - Actionable recommendations
        - Audit trail of decision logic
        - Criterion-by-criterion transparency

    Note:
        Like symbolic reasoning, this preserves your existing decision tree
        system (decision_tree_builder.py) while making it accessible as a
        tool for the agent.
    """
    try:
        # Note: DecisionTreeBuilder instance should be provided by agent context
        # For now, we'll create a new instance (in production, this would be injected)
        tree_builder = DecisionTreeBuilder()

        # Get the appropriate tree
        tree = tree_builder.get_tree(topic)

        if not tree:
            logger.error(f"No decision tree found for topic: {topic}")
            return {
                "error": f"No decision tree available for '{topic}'",
                "result": "UNKNOWN",
                "available_topics": list(tree_builder.trees.keys())
            }

        # Traverse the tree with client values
        path = tree_builder.traverse_tree(tree, client_values)

        logger.info(f"🌲 Tree evaluation: {topic} → {path.result} "
                   f"(confidence: {path.confidence:.0%})")

        # Build criteria breakdown
        criteria = []
        for node in path.nodes_traversed:
            if node.node_type == "CONDITION":
                client_value = client_values.get(node.variable)
                if client_value is not None:
                    # Calculate gap (positive = eligible, negative = not eligible)
                    if node.operator.value in ["<=", "<"]:
                        # Upper limit
                        gap = node.threshold - client_value
                    else:
                        # Lower limit
                        gap = client_value - node.threshold

                    criteria.append({
                        "criterion": node.variable,
                        "threshold_name": f"{topic}_{node.variable}_limit",
                        "threshold_value": node.threshold,
                        "client_value": client_value,
                        "operator": node.operator.value,
                        "status": "eligible" if gap >= 0 else "not_eligible",
                        "gap": abs(gap),
                        "explanation": node.source_text or ""
                    })

        # Extract near-miss information
        near_misses = []
        for nm in path.near_misses:
            near_misses.append({
                "threshold_value": nm.threshold_value,
                "tolerance": nm.tolerance,
                "tolerance_absolute": nm.tolerance_absolute,
                "strategies": [
                    {
                        "description": strat.description,
                        "actions": strat.actions,
                        "likelihood": strat.likelihood
                    }
                    for strat in nm.strategies
                ]
            })

        # Extract strategies
        strategies = []
        if include_strategies:
            for strat in path.strategies:
                strategies.append({
                    "description": strat.description,
                    "actions": strat.actions,
                    "likelihood": strat.likelihood
                })

        return {
            "result": path.result,
            "confidence": path.confidence,
            "criteria": criteria,
            "near_misses": near_misses,
            "strategies": strategies,
            "nodes_traversed": len(path.nodes_traversed),
            "decisions_made": len([n for n in path.nodes_traversed if n.node_type == "CONDITION"]),
            "topic": topic,
            "success": True
        }

    except Exception as e:
        logger.error(f"Decision tree evaluation failed: {e}")
        return {
            "error": str(e),
            "result": "ERROR",
            "confidence": 0.0,
            "criteria": [],
            "success": False
        }


__all__ = ['evaluate_decision_tree_tool']
