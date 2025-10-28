"""
Node implementations for client-specific document agent.

Each node is a pure function: state in → state out.
"""

from typing import Dict, Any
from client_agent_state import ClientAgentState
from langchain_community.llms import Ollama
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field
from langchain.output_parsers import PydanticOutputParser
import logging
import httpx

logger = logging.getLogger(__name__)


class ComplexityAnalysis(BaseModel):
    """Structured output for query complexity analysis."""
    complexity: str = Field(description="Query complexity: 'simple', 'complex', or 'multi_step'")
    requires_calculation: bool = Field(description="Whether query needs numerical calculation")
    requires_eligibility_check: bool = Field(description="Whether query involves eligibility checking")
    requires_worry_analysis: bool = Field(description="Whether this is a 'should I worry?' type query")


def analyze_query_node(state: ClientAgentState) -> Dict[str, Any]:
    """
    Analyze query complexity and determine what analysis is needed.

    Args:
        state: Current agent state

    Returns:
        Updated state with complexity classification
    """
    logger.info(f"[ANALYZE] Analyzing query: {state['question']}")

    try:
        llm = Ollama(
            model=state["model_name"],
            base_url=state["ollama_url"],
            temperature=0.1
        )

        parser = PydanticOutputParser(pydantic_object=ComplexityAnalysis)

        prompt = PromptTemplate(
            template="""Analyze this client document query and classify its complexity:

Question: {question}

Classify as:
- "simple": Direct factual question about client's documents
- "complex": Requires analysis or comparison
- "multi_step": Needs multiple reasoning steps

Also determine:
- Does it need calculation? (mentions numbers, sums, totals)
- Does it need eligibility checking? (mentions DRO, bankruptcy, qualify, eligible)
- Is it a worry/concern question? (mentions worry, concern, anxious, scared)

{format_instructions}
""",
            input_variables=["question"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt | llm | parser
        analysis = chain.invoke({"question": state["question"]})

        logger.info(f"[ANALYZE] Complexity: {analysis.complexity}")

        return {
            **state,
            "complexity": analysis.complexity,
            "reasoning_steps": state.get("reasoning_steps", []) + [{
                "step": "analyze_query",
                "result": {
                    "complexity": analysis.complexity,
                    "requires_calculation": analysis.requires_calculation,
                    "requires_eligibility_check": analysis.requires_eligibility_check,
                    "requires_worry_analysis": analysis.requires_worry_analysis
                }
            }]
        }

    except Exception as e:
        logger.error(f"[ANALYZE] Error: {e}")
        return {
            **state,
            "complexity": "simple",  # Fallback
            "errors": state.get("errors", []) + [f"Analysis error: {str(e)}"]
        }


def retrieve_client_docs_node(
    state: ClientAgentState,
    vectorstore_getter
) -> Dict[str, Any]:
    """
    Retrieve relevant documents from client's uploaded files.

    Args:
        state: Current agent state
        vectorstore_getter: Function to get client's vectorstore

    Returns:
        Updated state with client documents
    """
    client_id = state["client_id"]
    question = state["question"]
    top_k = state.get("top_k", 4)

    logger.info(f"[RETRIEVE] Getting documents for client {client_id}")

    try:
        # Get client's vectorstore
        vectorstore = vectorstore_getter(client_id)

        if vectorstore is None:
            logger.warning(f"[RETRIEVE] No documents for client {client_id}")
            return {
                **state,
                "client_documents": [],
                "available_documents": [],
                "warnings": state.get("warnings", []) + [
                    f"No uploaded documents found for client {client_id}"
                ]
            }

        # Search for relevant documents
        docs = vectorstore.similarity_search(question, k=top_k)

        # Extract unique filenames
        sources = list(set([doc.metadata.get("source", "unknown") for doc in docs]))

        # Format documents
        formatted_docs = []
        for i, doc in enumerate(docs):
            formatted_docs.append({
                "content": doc.page_content,
                "source": doc.metadata.get("source", "unknown"),
                "chunk": doc.metadata.get("chunk", 0),
                "relevance_rank": i + 1
            })

        logger.info(f"[RETRIEVE] Found {len(formatted_docs)} relevant chunks from {len(sources)} documents")

        return {
            **state,
            "client_documents": formatted_docs,
            "available_documents": sources,
            "sources": [{"source": src, "type": "client_document"} for src in sources],
            "reasoning_steps": state.get("reasoning_steps", []) + [{
                "step": "retrieve_client_docs",
                "result": {
                    "documents_found": len(formatted_docs),
                    "unique_sources": len(sources),
                    "sources": sources
                }
            }]
        }

    except Exception as e:
        logger.error(f"[RETRIEVE] Error: {e}")
        return {
            **state,
            "client_documents": [],
            "errors": state.get("errors", []) + [f"Retrieval error: {str(e)}"]
        }


def extract_values_node(state: ClientAgentState) -> Dict[str, Any]:
    """
    Extract financial values from client documents.

    Args:
        state: Current agent state

    Returns:
        Updated state with extracted financial values
    """
    logger.info("[EXTRACT] Extracting financial values from documents")

    try:
        from tools.client_document_tools import extract_financial_values_from_docs

        client_docs = state.get("client_documents", [])

        if not client_docs:
            logger.warning("[EXTRACT] No documents to extract from")
            return {
                **state,
                "extracted_values": {},
                "warnings": state.get("warnings", []) + [
                    "No documents available for value extraction"
                ]
            }

        # Extract values
        result = extract_financial_values_from_docs.invoke({
            "documents": client_docs,
            "client_id": state["client_id"]
        })

        if result.get("success"):
            extracted = result.get("extracted", {})
            summary = result.get("summary", {})

            logger.info(f"[EXTRACT] Found values: {summary}")

            return {
                **state,
                "extracted_values": summary,
                "reasoning_steps": state.get("reasoning_steps", []) + [{
                    "step": "extract_values",
                    "result": {
                        "debt": summary.get("total_debt"),
                        "income": summary.get("total_income"),
                        "assets": summary.get("total_assets"),
                        "details": extracted
                    }
                }]
            }
        else:
            logger.warning(f"[EXTRACT] Extraction failed: {result.get('error')}")
            return {
                **state,
                "extracted_values": {},
                "errors": state.get("errors", []) + [f"Extraction error: {result.get('error')}"]
            }

    except Exception as e:
        logger.error(f"[EXTRACT] Error: {e}")
        return {
            **state,
            "extracted_values": {},
            "errors": state.get("errors", []) + [f"Extract error: {str(e)}"]
        }


def check_eligibility_node(
    state: ClientAgentState,
    threshold_cache: Dict
) -> Dict[str, Any]:
    """
    Check client's eligibility for DRO/bankruptcy based on extracted values.

    Args:
        state: Current agent state
        threshold_cache: Cached threshold values

    Returns:
        Updated state with eligibility results
    """
    logger.info("[ELIGIBILITY] Checking eligibility criteria")

    try:
        from tools.client_document_tools import compare_with_thresholds

        extracted_values = state.get("extracted_values", {})

        if not extracted_values:
            logger.warning("[ELIGIBILITY] No extracted values to check")
            return {
                **state,
                "eligibility_result": None,
                "warnings": state.get("warnings", []) + [
                    "Cannot check eligibility without financial values"
                ]
            }

        # Compare with thresholds
        result = compare_with_thresholds.invoke({
            "extracted_values": extracted_values,
            "threshold_cache": threshold_cache
        })

        if result.get("success"):
            logger.info(f"[ELIGIBILITY] DRO: {result.get('dro_eligible')}, Bankruptcy: {result.get('bankruptcy_viable')}")

            # Generate recommendations based on results
            recommendations = []
            if result.get("dro_eligible"):
                recommendations.append("You appear to meet the criteria for a Debt Relief Order (DRO)")
                recommendations.append("A DRO can write off debts you can't afford to pay")
            elif result.get("bankruptcy_viable"):
                recommendations.append("Bankruptcy may be an option for your situation")
                recommendations.append("Consider speaking with a debt adviser about bankruptcy procedures")
            else:
                recommendations.append("Let's explore other debt solutions that may suit your situation")

            return {
                **state,
                "eligibility_result": result,
                "recommendations": recommendations,
                "confidence": 0.85,  # High confidence when based on extracted values
                "reasoning_steps": state.get("reasoning_steps", []) + [{
                    "step": "check_eligibility",
                    "result": {
                        "dro_eligible": result.get("dro_eligible"),
                        "bankruptcy_viable": result.get("bankruptcy_viable"),
                        "comparisons": result.get("comparisons")
                    }
                }]
            }
        else:
            logger.warning(f"[ELIGIBILITY] Check failed: {result.get('error')}")
            return {
                **state,
                "eligibility_result": None,
                "errors": state.get("errors", []) + [f"Eligibility check error: {result.get('error')}"]
            }

    except Exception as e:
        logger.error(f"[ELIGIBILITY] Error: {e}")
        return {
            **state,
            "eligibility_result": None,
            "errors": state.get("errors", []) + [f"Eligibility error: {str(e)}"]
        }


def worry_analysis_node(state: ClientAgentState) -> Dict[str, Any]:
    """
    Analyze documents to provide "Should I worry?" reassurance.

    Args:
        state: Current agent state

    Returns:
        Updated state with worry analysis
    """
    logger.info("[WORRY] Analyzing worry/concern level")

    try:
        llm = Ollama(
            model=state["model_name"],
            base_url=state["ollama_url"],
            temperature=0.7  # Slightly higher for empathetic responses
        )

        client_docs = state.get("client_documents", [])
        extracted_values = state.get("extracted_values", {})

        # Combine document context
        context = "\n\n".join([doc["content"] for doc in client_docs[:3]])  # Top 3 chunks

        prompt = PromptTemplate(
            template="""You are a compassionate debt adviser analyzing a client's situation.

Client's Documents:
{context}

Financial Summary:
- Debt: £{debt}
- Income: £{income}/month
- Assets: £{assets}

Question: {question}

Provide a reassuring but honest "Should I worry?" analysis:

1. WORRY LEVEL (low/medium/high): Based on debt-to-income ratio and available options

2. REASSURANCE: What they should NOT worry about (focus on positive aspects and available help)

3. CONTEXT: Where they are in their debt journey (many people face similar situations)

4. NEXT STEPS: 2-3 concrete, actionable steps they can take

Be empathetic, clear, and avoid legal jargon. Focus on what they CAN do, not what they can't.
""",
            input_variables=["context", "debt", "income", "assets", "question"]
        )

        chain = prompt | llm | StrOutputParser()

        response = chain.invoke({
            "context": context or "No specific documents provided",
            "debt": extracted_values.get("total_debt", "unknown"),
            "income": extracted_values.get("total_income", "unknown"),
            "assets": extracted_values.get("total_assets", "unknown"),
            "question": state["question"]
        })

        # Parse response (simple parsing)
        lines = response.strip().split("\n")
        worry_level = "medium"  # default
        reassurance = ""
        context_info = ""
        next_steps = []

        current_section = None
        for line in lines:
            line_lower = line.lower()
            if "worry level" in line_lower:
                if "low" in line_lower:
                    worry_level = "low"
                elif "high" in line_lower:
                    worry_level = "high"
                current_section = "worry"
            elif "reassurance" in line_lower:
                current_section = "reassurance"
            elif "context" in line_lower:
                current_section = "context"
            elif "next steps" in line_lower or "action" in line_lower:
                current_section = "steps"
            elif current_section == "reassurance" and line.strip():
                reassurance += line.strip() + " "
            elif current_section == "context" and line.strip():
                context_info += line.strip() + " "
            elif current_section == "steps" and line.strip():
                # Remove numbers/bullets
                step = line.strip().lstrip("0123456789.-• ")
                if step:
                    next_steps.append(step)

        worry_analysis = {
            "worry_level": worry_level,
            "reassurance": reassurance.strip(),
            "context": context_info.strip(),
            "next_steps": next_steps[:3],  # Top 3 steps
            "full_response": response
        }

        logger.info(f"[WORRY] Assessed worry level: {worry_level}")

        return {
            **state,
            "worry_analysis": worry_analysis,
            "confidence": 0.75,
            "reasoning_steps": state.get("reasoning_steps", []) + [{
                "step": "worry_analysis",
                "result": worry_analysis
            }]
        }

    except Exception as e:
        logger.error(f"[WORRY] Error: {e}")
        return {
            **state,
            "worry_analysis": None,
            "errors": state.get("errors", []) + [f"Worry analysis error: {str(e)}"]
        }


def synthesize_answer_node(state: ClientAgentState) -> Dict[str, Any]:
    """
    Synthesize final answer combining all gathered information.

    Args:
        state: Current agent state

    Returns:
        Updated state with final answer
    """
    logger.info("[SYNTHESIZE] Creating final answer")

    try:
        llm = Ollama(
            model=state["model_name"],
            base_url=state["ollama_url"],
            temperature=0.7
        )

        # Gather all context
        client_docs = state.get("client_documents", [])
        extracted_values = state.get("extracted_values", {})
        eligibility = state.get("eligibility_result")
        worry = state.get("worry_analysis")
        recommendations = state.get("recommendations", [])

        # Build context
        doc_context = "\n\n".join([
            f"From {doc['source']}:\n{doc['content']}"
            for doc in client_docs[:4]
        ])

        # Build structured info
        structured_info = ""

        if extracted_values:
            structured_info += f"\nFinancial Summary:\n"
            if extracted_values.get("total_debt"):
                structured_info += f"- Total Debt: £{extracted_values['total_debt']}\n"
            if extracted_values.get("total_income"):
                structured_info += f"- Monthly Income: £{extracted_values['total_income']}\n"
            if extracted_values.get("total_assets"):
                structured_info += f"- Total Assets: £{extracted_values['total_assets']}\n"

        if eligibility:
            structured_info += f"\nEligibility Assessment:\n"
            if eligibility.get("dro_eligible"):
                structured_info += "- DRO: Appears eligible\n"
            if eligibility.get("bankruptcy_viable"):
                structured_info += "- Bankruptcy: May be viable\n"

        if worry:
            structured_info += f"\nConcern Level: {worry.get('worry_level', 'medium')}\n"

        if recommendations:
            structured_info += f"\nRecommendations:\n"
            for rec in recommendations:
                structured_info += f"- {rec}\n"

        prompt = PromptTemplate(
            template="""You are a helpful debt adviser assistant. Answer the client's question based on their uploaded documents.

Client's Question: {question}

Information from Client's Documents:
{doc_context}

{structured_info}

Provide a clear, empathetic answer that:
1. Directly addresses their question
2. References their specific documents when relevant
3. Explains any technical terms simply
4. Provides actionable next steps if appropriate

Keep the tone professional but warm. Be honest about limitations.

Answer:
""",
            input_variables=["question", "doc_context", "structured_info"]
        )

        chain = prompt | llm | StrOutputParser()

        answer = chain.invoke({
            "question": state["question"],
            "doc_context": doc_context or "No specific document context available",
            "structured_info": structured_info or ""
        })

        # Calculate confidence
        confidence = 0.5  # Base confidence
        if client_docs:
            confidence += 0.2
        if extracted_values:
            confidence += 0.1
        if eligibility or worry:
            confidence += 0.1
        confidence = min(confidence, 0.95)  # Cap at 95%

        logger.info(f"[SYNTHESIZE] Generated answer ({int(len(answer))} chars, confidence: {confidence:.2f})")

        return {
            **state,
            "answer": answer.strip(),
            "confidence": confidence,
            "iterations_used": state.get("iterations_used", 0) + 1,
            "reasoning_steps": state.get("reasoning_steps", []) + [{
                "step": "synthesize_answer",
                "result": {
                    "answer_length": len(answer),
                    "confidence": confidence,
                    "context_sources": len(client_docs)
                }
            }]
        }

    except Exception as e:
        logger.error(f"[SYNTHESIZE] Error: {e}")
        return {
            **state,
            "answer": f"I apologize, but I encountered an error while processing your question. Please try again or contact support. Error: {str(e)}",
            "confidence": 0.0,
            "errors": state.get("errors", []) + [f"Synthesis error: {str(e)}"]
        }
