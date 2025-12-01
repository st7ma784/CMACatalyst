#!/usr/bin/env python3
"""
LangGraph workflow for notes to client communication.

Converts advisor notes to client-friendly letters through structured reasoning.
"""

import logging
from typing import Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict

logger = logging.getLogger(__name__)


class NotesState(TypedDict):
    """State for notes conversion workflow."""
    advisor_notes: str
    client_name: str
    financial_context: str  # Extracted financial info
    issues: str  # Identified issues
    extraction_analysis: str  # Analysis of extracted info
    action_plan: str  # Planned actions
    client_letter: str  # Final output


def extract_financial_context_node(state: NotesState, llm_provider) -> dict:
    """Extract financial context from advisor notes."""
    
    prompt = f"""Analyze these advisor notes and extract key financial information.

Advisor Notes:
{state['advisor_notes']}

Extract and summarize:
1. Current financial situation (income, debts, assets)
2. Financial challenges or problems
3. Key numbers or amounts mentioned
4. Timeline or urgency factors

Be specific and preserve all numbers/figures from the notes.

Respond in a brief, structured format."""

    response = llm_provider.call_llm(prompt, temperature=0.3)
    
    return {
        "financial_context": response,
        "advisor_notes": state["advisor_notes"],
        "client_name": state["client_name"]
    }


def identify_issues_node(state: NotesState, llm_provider) -> dict:
    """Identify the key issues being addressed."""
    
    prompt = f"""Based on these advisor notes and financial context, identify the core issues.

Advisor Notes:
{state['advisor_notes']}

Financial Context:
{state['financial_context']}

What are the 2-4 main issues being discussed? For each:
1. Name the issue
2. Why it's important for the client
3. How it affects their situation

Use simple language. Avoid jargon."""

    response = llm_provider.call_llm(prompt, temperature=0.3)
    
    return {
        "issues": response,
        "financial_context": state["financial_context"],
        "advisor_notes": state["advisor_notes"],
        "client_name": state["client_name"]
    }


def analyze_extraction_node(state: NotesState, llm_provider) -> dict:
    """Analyze what the advisor extracted and its implications."""
    
    prompt = f"""The advisor wrote these notes after analyzing a client's situation.

Advisor Notes:
{state['advisor_notes']}

Identified Issues:
{state['issues']}

Now, explain to a non-financial person:
1. What the advisor discovered
2. Why this matters
3. What it means for the client's situation
4. What options might exist (don't prescribe, just explain)

Use simple, clear language. Reading age 12-14.
Be warm and reassuring where appropriate."""

    response = llm_provider.call_llm(prompt, temperature=0.5)
    
    return {
        "extraction_analysis": response,
        "issues": state["issues"],
        "financial_context": state["financial_context"],
        "advisor_notes": state["advisor_notes"],
        "client_name": state["client_name"]
    }


def plan_actions_node(state: NotesState, llm_provider) -> dict:
    """Plan next actions based on identified issues."""
    
    prompt = f"""Based on the advisor's notes and analysis, what actions are needed?

Advisor Notes:
{state['advisor_notes']}

Issues Identified:
{state['issues']}

Analysis:
{state['extraction_analysis']}

What should happen next? For each action:
1. What the advisor will do
2. What the client needs to do
3. Timeline or urgency
4. Why this action helps

Be specific and actionable.
Use simple language."""

    response = llm_provider.call_llm(prompt, temperature=0.4)
    
    return {
        "action_plan": response,
        "extraction_analysis": state["extraction_analysis"],
        "issues": state["issues"],
        "financial_context": state["financial_context"],
        "advisor_notes": state["advisor_notes"],
        "client_name": state["client_name"]
    }


def generate_letter_node(state: NotesState, llm_provider) -> dict:
    """Generate the final client letter."""
    
    prompt = f"""Write a warm, professional letter to {state['client_name']} explaining their case.

Use this information:

Financial Situation:
{state['financial_context']}

Key Issues:
{state['issues']}

Explanation:
{state['extraction_analysis']}

Next Steps:
{state['action_plan']}

The letter should:
1. Start with a warm greeting
2. Explain what you discussed (in simple language)
3. Outline the situation clearly but reassuringly
4. Explain what you'll do next
5. Explain what they should do
6. Close professionally

Guidelines:
- Reading age 12-14
- Warm but professional tone
- Empathetic to their situation
- Clear and specific
- 300-400 words
- Three main sections: YOUR SITUATION, WHAT WE'LL DO, WHAT YOU SHOULD DO

Write the letter now:"""

    response = llm_provider.call_llm(prompt, temperature=0.6)
    
    return {
        "client_letter": response,
        "action_plan": state["action_plan"],
        "extraction_analysis": state["extraction_analysis"],
        "issues": state["issues"],
        "financial_context": state["financial_context"],
        "advisor_notes": state["advisor_notes"],
        "client_name": state["client_name"]
    }


def create_notes_graph(llm_provider):
    """Create the LangGraph workflow for notes conversion.
    
    Replaces the single-prompt approach with a multi-step reasoning pipeline:
    1. Extract financial context from notes
    2. Identify key issues being addressed
    3. Analyze what was extracted and implications
    4. Plan next actions
    5. Generate warm, professional letter
    
    This ensures:
    - Output is directly relevant to advisor notes
    - Financial context is preserved
    - Issues are clearly identified
    - Actions are specific and actionable
    - Letter is warm and professional
    """
    
    workflow = StateGraph(NotesState)
    
    # Add nodes
    workflow.add_node("extract_context", lambda s: extract_financial_context_node(s, llm_provider))
    workflow.add_node("identify_issues", lambda s: identify_issues_node(s, llm_provider))
    workflow.add_node("analyze", lambda s: analyze_extraction_node(s, llm_provider))
    workflow.add_node("plan_actions", lambda s: plan_actions_node(s, llm_provider))
    workflow.add_node("generate_letter", lambda s: generate_letter_node(s, llm_provider))
    
    # Set entry point
    workflow.set_entry_point("extract_context")
    
    # Create edges (sequential pipeline)
    workflow.add_edge("extract_context", "identify_issues")
    workflow.add_edge("identify_issues", "analyze")
    workflow.add_edge("analyze", "plan_actions")
    workflow.add_edge("plan_actions", "generate_letter")
    workflow.add_edge("generate_letter", END)
    
    # Compile without checkpointing (simpler workflow doesn't need it)
    app = workflow.compile()
    
    return app
