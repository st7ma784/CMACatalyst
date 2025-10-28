"""
Symbolic reasoning tools for LangGraph agent.

These tools wrap the SymbolicReasoning class to provide LangChain-compatible
tool interfaces for symbolic logic operations.
"""

from typing import Dict, Any, List, Optional
from langchain_core.tools import tool
import os
import sys

# Add parent directory to path to import symbolic_reasoning
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from symbolic_reasoning import SymbolicReasoning


# Initialize global symbolic reasoning instance
_symbolic_reasoner = SymbolicReasoning()


@tool
def create_symbolic_variable(name: str, value: float, description: str = "") -> Dict[str, Any]:
    """
    Create a symbolic variable to track a financial value.

    Args:
        name: Variable name (e.g., "debt", "income", "assets")
        value: Numerical value
        description: Optional description of what this variable represents

    Returns:
        Dictionary with success status and variable details

    Example:
        create_symbolic_variable("total_debt", 15000, "Client's total debt amount")
    """
    try:
        _symbolic_reasoner.create_variable(name, value, description)
        return {
            "success": True,
            "variable": name,
            "value": value,
            "description": description
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "variable": name
        }


@tool
def add_symbolic_constraint(constraint: str, description: str = "") -> Dict[str, Any]:
    """
    Add a symbolic constraint/rule for eligibility checking.

    Args:
        constraint: Constraint expression (e.g., "debt < 50000")
        description: Optional description of why this constraint exists

    Returns:
        Dictionary with success status and constraint details

    Example:
        add_symbolic_constraint("debt < 50000", "DRO debt limit")
        add_symbolic_constraint("income < 75", "DRO monthly income limit")
    """
    try:
        _symbolic_reasoner.add_constraint(constraint, description)
        return {
            "success": True,
            "constraint": constraint,
            "description": description
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "constraint": constraint
        }


@tool
def evaluate_symbolic_constraints() -> Dict[str, Any]:
    """
    Evaluate all symbolic constraints against current variable values.

    Returns:
        Dictionary with:
        - all_satisfied: Whether all constraints are satisfied
        - satisfied: List of satisfied constraints
        - violated: List of violated constraints
        - variables: Current variable values

    Example:
        results = evaluate_symbolic_constraints()
        if results["all_satisfied"]:
            print("All eligibility criteria met!")
    """
    try:
        result = _symbolic_reasoner.evaluate_constraints()
        return {
            "success": True,
            "all_satisfied": result["all_satisfied"],
            "satisfied": result["satisfied"],
            "violated": result["violated"],
            "variables": _symbolic_reasoner.variables.copy()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@tool
def get_symbolic_explanation() -> Dict[str, Any]:
    """
    Get a human-readable explanation of the symbolic reasoning process.

    Returns:
        Dictionary with:
        - variables: Current variable values and descriptions
        - constraints: All constraints and their status
        - summary: Text summary of the reasoning

    Example:
        explanation = get_symbolic_explanation()
        print(explanation["summary"])
    """
    try:
        explanation = _symbolic_reasoner.explain()
        return {
            "success": True,
            "variables": _symbolic_reasoner.variables.copy(),
            "constraints": _symbolic_reasoner.constraints.copy(),
            "summary": explanation
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@tool
def reset_symbolic_state() -> Dict[str, Any]:
    """
    Reset all symbolic variables and constraints.

    Returns:
        Dictionary with success status

    Example:
        reset_symbolic_state()  # Start fresh for new client
    """
    try:
        _symbolic_reasoner.reset()
        return {
            "success": True,
            "message": "Symbolic state reset successfully"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@tool
def check_dro_eligibility_symbolic(
    debt: float,
    income: float,
    assets: float
) -> Dict[str, Any]:
    """
    Use symbolic reasoning to check DRO (Debt Relief Order) eligibility.

    Args:
        debt: Total debt amount (£)
        income: Monthly disposable income (£)
        assets: Total assets value (£)

    Returns:
        Dictionary with:
        - eligible: Whether client meets DRO criteria
        - constraints: List of constraint evaluation results
        - explanation: Human-readable explanation

    Example:
        result = check_dro_eligibility_symbolic(15000, 50, 1000)
        if result["eligible"]:
            print("Client is eligible for DRO")
    """
    try:
        # Reset state
        _symbolic_reasoner.reset()

        # Create variables
        _symbolic_reasoner.create_variable("debt", debt, "Total debt amount")
        _symbolic_reasoner.create_variable("income", income, "Monthly disposable income")
        _symbolic_reasoner.create_variable("assets", assets, "Total assets value")

        # Add DRO constraints (as of 2023 UK limits)
        _symbolic_reasoner.add_constraint("debt < 50000", "DRO debt limit: £50,000")
        _symbolic_reasoner.add_constraint("income < 75", "DRO monthly income limit: £75")
        _symbolic_reasoner.add_constraint("assets < 2000", "DRO assets limit: £2,000")

        # Evaluate
        result = _symbolic_reasoner.evaluate_constraints()
        explanation = _symbolic_reasoner.explain()

        return {
            "success": True,
            "eligible": result["all_satisfied"],
            "constraints": {
                "satisfied": result["satisfied"],
                "violated": result["violated"]
            },
            "explanation": explanation,
            "variables": {
                "debt": debt,
                "income": income,
                "assets": assets
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "eligible": False
        }


@tool
def check_bankruptcy_eligibility_symbolic(
    debt: float,
    income: float,
    assets: float
) -> Dict[str, Any]:
    """
    Use symbolic reasoning to check bankruptcy eligibility.

    Args:
        debt: Total debt amount (£)
        income: Monthly disposable income (£)
        assets: Total assets value (£)

    Returns:
        Dictionary with:
        - eligible: Whether client meets bankruptcy criteria
        - constraints: List of constraint evaluation results
        - explanation: Human-readable explanation

    Example:
        result = check_bankruptcy_eligibility_symbolic(60000, 100, 5000)
        if result["eligible"]:
            print("Client may consider bankruptcy")
    """
    try:
        # Reset state
        _symbolic_reasoner.reset()

        # Create variables
        _symbolic_reasoner.create_variable("debt", debt, "Total debt amount")
        _symbolic_reasoner.create_variable("income", income, "Monthly disposable income")
        _symbolic_reasoner.create_variable("assets", assets, "Total assets value")

        # Add bankruptcy constraints (simpler - mainly debt-based)
        _symbolic_reasoner.add_constraint("debt >= 5000", "Bankruptcy minimum debt threshold")

        # Evaluate
        result = _symbolic_reasoner.evaluate_constraints()
        explanation = _symbolic_reasoner.explain()

        return {
            "success": True,
            "eligible": result["all_satisfied"],
            "constraints": {
                "satisfied": result["satisfied"],
                "violated": result["violated"]
            },
            "explanation": explanation,
            "variables": {
                "debt": debt,
                "income": income,
                "assets": assets
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "eligible": False
        }


# Export all tools
__all__ = [
    "create_symbolic_variable",
    "add_symbolic_constraint",
    "evaluate_symbolic_constraints",
    "get_symbolic_explanation",
    "reset_symbolic_state",
    "check_dro_eligibility_symbolic",
    "check_bankruptcy_eligibility_symbolic"
]
