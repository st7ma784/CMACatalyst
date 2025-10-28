#!/usr/bin/env python3
"""
Symbolic Reasoning for Financial Queries

Separates logical reasoning from numerical computation by:
1. Replacing numbers with symbolic placeholders (e.g., [DEBT_AMOUNT], AMOUNT(£50000))
2. Having LLM reason symbolically about relationships
3. Extracting numerical comparisons from symbolic reasoning
4. Computing exact numerical results
5. Substituting results back into natural language

This prevents LLM math errors and makes reasoning explicit and verifiable.
"""

import re
import os
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SymbolicVariable:
    """Represents a symbolic variable extracted from text."""
    name: str  # e.g., "DEBT_AMOUNT", "DRO_LIMIT"
    value: Optional[float] = None  # Numerical value if known
    original_text: str = ""  # Original text snippet
    unit: str = "£"  # Currency or unit


@dataclass
class SymbolicComparison:
    """Represents a comparison extracted from symbolic reasoning."""
    left: str  # Variable name or value
    operator: str  # >, <, >=, <=, ==, !=
    right: str  # Variable name or value
    result: Optional[bool] = None  # Computed result


class SymbolicReasoner:
    """
    Handles symbolic reasoning for financial queries.
    
    Workflow:
    1. symbolize_question() - Replace numbers in question with [VARIABLE] placeholders
    2. symbolize_manual_text() - Replace numbers in manual with AMOUNT() notation
    3. get_symbolic_reasoning() - Have LLM reason with symbols
    4. extract_comparisons() - Parse symbolic reasoning for comparison statements
    5. compute_results() - Evaluate numerical comparisons
    6. substitute_back() - Replace symbols with actual numbers and results
    """
    
    def __init__(self):
        self.variables: Dict[str, SymbolicVariable] = {}
        self.comparisons: List[SymbolicComparison] = []
        
        # Patterns for detecting financial amounts
        self.amount_pattern = r'£\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)'
        
        # Variable naming conventions based on context
        self.context_hints = {
            'debt': 'DEBT_AMOUNT',
            'income': 'INCOME',
            'asset': 'ASSETS',
            'surplus': 'SURPLUS_INCOME',
            'limit': 'LIMIT',
            'maximum': 'MAX_LIMIT',
            'minimum': 'MIN_LIMIT',
            'fee': 'FEE',
            'cost': 'COST',
        }
    
    def symbolize_question(self, question: str) -> Tuple[str, Dict[str, SymbolicVariable]]:
        """
        Replace numbers in question with GENERIC indexed placeholders.
        NO SEMANTIC HINTS to avoid biasing the model.
        
        Args:
            question: Original question with numbers
            
        Returns:
            (symbolic_question, variables_dict)
            
        Example:
            "Can client with £60,000 debt get DRO?"
            → ("Can client with [AMOUNT_1] get DRO?", {"AMOUNT_1": 60000})
        """
        symbolic_q = question
        question_vars = {}
        
        # Find all amounts in question
        matches = list(re.finditer(self.amount_pattern, question))
        
        for i, match in enumerate(matches):
            amount_str = match.group(1).replace(',', '')
            amount_value = float(amount_str)
            
            # Use GENERIC indexed name - no semantic hints
            var_name = f"AMOUNT_{i + 1}"
            
            # Create variable
            variable = SymbolicVariable(
                name=var_name,
                value=amount_value,
                original_text=match.group(0),
                unit="£"
            )
            
            question_vars[var_name] = variable
            self.variables[var_name] = variable
            
            # Replace in question
            symbolic_q = symbolic_q.replace(
                match.group(0), 
                f"[{var_name}]",
                1  # Replace only first occurrence
            )
        
        logger.info(f"Symbolized question: '{question}' → '{symbolic_q}'")
        logger.info(f"Question variables (generic): {list(question_vars.keys())}")
        
        return symbolic_q, question_vars
    
    def symbolize_manual_text(self, text: str, source_name: str = "manual") -> str:
        """
        Replace financial figures in manual text with GENERIC LIMIT notation.
        Uses simple indexed names to avoid biasing the model.
        
        Args:
            text: Original manual text
            source_name: Name of source for tracking
            
        Returns:
            Symbolized text with LIMIT_N replacements
            
        Example:
            "DRO maximum debt is £50,000"
            → "DRO maximum debt is [LIMIT_1]"
        """
        symbolized = text
        
        # Find all amounts
        matches = list(re.finditer(self.amount_pattern, text))
        
        # Process in reverse to maintain string positions
        for i, match in enumerate(reversed(matches)):
            amount_str = match.group(1).replace(',', '')
            amount_value = float(amount_str)
            original = match.group(0)
            
            # Use GENERIC indexed name for limits
            var_name = f"LIMIT_{len(matches) - i}"
            
            # Create variable if not exists
            if var_name not in self.variables:
                variable = SymbolicVariable(
                    name=var_name,
                    value=amount_value,
                    original_text=original,
                    unit="£"
                )
                self.variables[var_name] = variable
            
            # Replace with simple bracket notation (cleaner than AMOUNT())
            replacement = f"[{var_name}]"
            symbolized = symbolized[:match.start()] + replacement + symbolized[match.end():]
        
        return symbolized
    
    def _infer_variable_name(self, text: str, position: int, index: int) -> str:
        """
        Infer a semantic variable name from surrounding context.
        
        Looks for keywords near the number to create meaningful names like:
        - DEBT_AMOUNT (if "debt" nearby)
        - DRO_MAX_DEBT (if "DRO" and "maximum" nearby)
        - INCOME_LIMIT (if "income" and "limit" nearby)
        """
        # Extract context window around the number (100 chars before/after)
        start = max(0, position - 100)
        end = min(len(text), position + 100)
        context = text[start:end].lower()
        
        # Check for debt solution types
        solution_type = None
        if 'dro' in context or 'debt relief order' in context:
            solution_type = 'DRO'
        elif 'bankruptcy' in context or 'bankrupt' in context:
            solution_type = 'BANKRUPTCY'
        elif 'iva' in context or 'individual voluntary' in context:
            solution_type = 'IVA'
        
        # Check for limit types
        limit_type = None
        for hint, var_prefix in self.context_hints.items():
            if hint in context:
                limit_type = var_prefix
                break
        
        # Construct variable name
        if solution_type and limit_type:
            var_name = f"{solution_type}_{limit_type}"
        elif limit_type:
            var_name = limit_type
        elif solution_type:
            var_name = f"{solution_type}_AMOUNT"
        else:
            # Fallback to generic numbered variable
            var_name = f"AMOUNT_{index + 1}"
        
        # Ensure uniqueness
        if var_name in self.variables:
            suffix = 2
            while f"{var_name}_{suffix}" in self.variables:
                suffix += 1
            var_name = f"{var_name}_{suffix}"
        
        return var_name
    
    def discover_roles(self, symbolic_question: str, symbolized_context: str, llm_model: str = "llama3.2") -> Dict[str, str]:
        """
        Have the LLM discover the semantic roles of variables WITHOUT bias.
        
        This is a key innovation: instead of pre-labeling variables, we let the model
        analyze the context and determine what each number represents.
        
        Args:
            symbolic_question: Question with [AMOUNT_N] placeholders
            symbolized_context: Manual text with [LIMIT_N] placeholders
            llm_model: Model to use for role discovery
            
        Returns:
            Dict mapping variable names to semantic roles
            
        Example:
            AMOUNT_1 → "client_debt"
            LIMIT_1 → "maximum_debt_threshold"
            LIMIT_2 → "income_limit"
        """
        # Get all variables
        all_vars = list(self.variables.keys())
        
        discovery_prompt = f"""Analyze the following symbolic financial query and context to determine what each variable represents.

SYMBOLIC QUESTION: {symbolic_question}

SYMBOLIZED CONTEXT: {symbolized_context[:2000]}

VARIABLES TO ANALYZE: {', '.join(all_vars)}

For each variable, identify its SEMANTIC ROLE from this list:
- client_debt: Amount of debt the client has
- maximum_debt_limit: Maximum allowed debt for eligibility
- minimum_debt_limit: Minimum required debt
- client_income: Client's income amount
- income_limit: Maximum/minimum allowed income
- client_assets: Client's asset value
- asset_limit: Maximum allowed assets
- fee: Cost or charge amount
- duration: Time period (days/months)
- percentage: Percentage value
- other: If none of the above fit

OUTPUT FORMAT (one per line):
VARIABLE_NAME=role

Example:
AMOUNT_1=client_debt
LIMIT_1=maximum_debt_limit
LIMIT_2=income_limit

Analyze and output roles:"""

        try:
            from langchain_community.llms import Ollama
            llm = Ollama(model=llm_model, base_url=os.getenv('OLLAMA_URL', 'http://ollama:11434'), temperature=0.1)
            response = llm.invoke(discovery_prompt)
            
            # Parse response
            roles = {}
            for line in response.split('\n'):
                line = line.strip()
                if '=' in line:
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        var_name = parts[0].strip()
                        role = parts[1].strip().lower()
                        if var_name in self.variables:
                            roles[var_name] = role
                            logger.info(f"🔍 Discovered role: {var_name} = {role}")
            
            return roles
            
        except Exception as e:
            logger.error(f"Error in role discovery: {e}")
            return {}
    
    def extract_comparisons(self, symbolic_reasoning: str) -> List[SymbolicComparison]:
        """
        Extract comparison statements from symbolic reasoning.
        
        Looks for patterns like:
        - "COMPARISON: [AMOUNT_1] > [LIMIT_1]"
        - "IF [AMOUNT_2] <= [LIMIT_2] THEN..."
        
        Supports simple bracket notation with generic variable names.
        
        Returns list of SymbolicComparison objects
        """
        comparisons = []
        
        # Primary pattern: COMPARISON: [VAR] operator [VAR]
        # Simple bracket notation: [AMOUNT_1] > [LIMIT_1]
        comparison_simple_pattern = r'COMPARISON:\s*\[([^\]]+)\]\s*(>|<|>=|<=|==|!=)\s*\[([^\]]+)\]'
        
        matches = re.finditer(comparison_simple_pattern, symbolic_reasoning, re.IGNORECASE)
        for match in matches:
            left = match.group(1).strip()
            operator = match.group(2).strip()
            right = match.group(3).strip()
            
            comparison = SymbolicComparison(
                left=left,
                operator=operator,
                right=right
            )
            comparisons.append(comparison)
            logger.info(f"📊 Extracted comparison: {left} {operator} {right}")
        
        # Fallback patterns for conditional and natural language formats
        fallback_patterns = [
            # IF [VAR] operator [VAR] format
            r'IF\s+\[([^\]]+)\]\s*(>|<|>=|<=|==|!=)\s*\[([^\]]+)\]',
            # Natural language comparisons
            r'\[([^\]]+)\]\s+(?:exceeds|is greater than|is more than)\s+\[([^\]]+)\]',
            r'\[([^\]]+)\]\s+(?:is less than|is below|does not exceed)\s+\[([^\]]+)\]',
        ]
        
        for pattern in fallback_patterns:
            matches = re.finditer(pattern, symbolic_reasoning, re.IGNORECASE)
            for match in matches:
                groups = [g for g in match.groups() if g is not None]
                
                if len(groups) >= 2:
                    left = groups[0].strip()
                    if len(groups) >= 3 and groups[1] in ['>', '<', '>=', '<=', '==', '!=']:
                        operator = groups[1]
                        right = groups[2].strip()
                    else:
                        # Infer operator from natural language
                        if 'exceeds' in match.group(0).lower() or 'greater' in match.group(0).lower():
                            operator = '>'
                        elif 'less' in match.group(0).lower() or 'below' in match.group(0).lower() or 'does not exceed' in match.group(0).lower():
                            operator = '<='
                        else:
                            operator = '=='
                        right = groups[1].strip()
                    
                    comparison = SymbolicComparison(
                        left=left,
                        operator=operator,
                        right=right
                    )
                    comparisons.append(comparison)
                    logger.debug(f"Extracted fallback comparison: {left} {operator} {right}")
        
        self.comparisons = comparisons
        logger.info(f"Total comparisons extracted: {len(comparisons)}")
        return comparisons
    
    def compute_results(self) -> List[SymbolicComparison]:
        """
        Evaluate all extracted comparisons using known variable values.
        
        Updates comparison.result with boolean outcome.
        """
        for comp in self.comparisons:
            try:
                # Get values for left and right sides
                left_val = self._resolve_value(comp.left)
                right_val = self._resolve_value(comp.right)
                
                if left_val is None or right_val is None:
                    logger.warning(f"Cannot compute: {comp.left} {comp.operator} {comp.right} (missing values)")
                    continue
                
                # Evaluate comparison
                if comp.operator == '>':
                    comp.result = left_val > right_val
                elif comp.operator == '<':
                    comp.result = left_val < right_val
                elif comp.operator == '>=':
                    comp.result = left_val >= right_val
                elif comp.operator == '<=':
                    comp.result = left_val <= right_val
                elif comp.operator == '==':
                    comp.result = abs(left_val - right_val) < 0.01  # Float comparison
                elif comp.operator == '!=':
                    comp.result = abs(left_val - right_val) >= 0.01
                
                logger.info(f"✓ Computed: {comp.left} ({left_val}) {comp.operator} {comp.right} ({right_val}) = {comp.result}")
                
            except Exception as e:
                logger.error(f"Error computing comparison: {e}")
                continue
        
        return self.comparisons
    
    def _resolve_value(self, identifier: str) -> Optional[float]:
        """Resolve a variable name or AMOUNT() reference to its numerical value."""
        # Clean up identifier
        identifier = identifier.strip('[]')
        
        # Check if it's in our variables
        if identifier in self.variables:
            return self.variables[identifier].value
        
        # Check if it's a direct number
        try:
            return float(identifier.replace(',', '').replace('£', ''))
        except ValueError:
            return None
    
    def substitute_back(self, symbolic_text: str) -> str:
        """
        Replace symbolic placeholders with actual values and comparison results.
        
        Args:
            symbolic_text: Text with [VARIABLES] and AMOUNT() notation
            
        Returns:
            Natural language text with values substituted back
        """
        result = symbolic_text
        
        # Replace [VARIABLE] placeholders with actual values
        for var_name, variable in self.variables.items():
            if variable.value is not None:
                placeholder = f"[{var_name}]"
                if placeholder in result:
                    formatted_value = f"£{variable.value:,.0f}" if variable.value >= 100 else f"£{variable.value:.2f}"
                    result = result.replace(placeholder, formatted_value)
        
        # Replace AMOUNT(£X, name=Y) with just the amount
        amount_refs = re.findall(r'AMOUNT\(([^,]+),\s*name=\w+\)', result)
        for amount_ref in amount_refs:
            full_match = f"AMOUNT({amount_ref}, name=\\w+)"
            result = re.sub(full_match, amount_ref, result)
        
        # Add computed comparison results as annotations
        for comp in self.comparisons:
            if comp.result is not None:
                # Find the comparison in text and add result
                left_str = f"[{comp.left}]" if comp.left in self.variables else comp.left
                right_str = f"[{comp.right}]" if comp.right in self.variables else comp.right
                
                # Create human-readable annotation
                left_val = self._resolve_value(comp.left)
                right_val = self._resolve_value(comp.right)
                
                if left_val and right_val:
                    annotation = f" (£{left_val:,.0f} {comp.operator} £{right_val:,.0f} = {comp.result})"
                    
                    # Try to insert annotation after comparison statement
                    # This is best-effort; exact placement depends on text structure
                    comp_pattern = f"{re.escape(left_str)}.*?{re.escape(right_str)}"
                    match = re.search(comp_pattern, result)
                    if match:
                        insert_pos = match.end()
                        result = result[:insert_pos] + annotation + result[insert_pos:]
        
        return result
    
    def get_reasoning_summary(self) -> Dict:
        """
        Get a summary of the symbolic reasoning process.
        
        Returns:
            Dictionary with variables, comparisons, and results
        """
        return {
            'variables': {
                name: {
                    'value': var.value,
                    'original_text': var.original_text,
                    'unit': var.unit
                }
                for name, var in self.variables.items()
            },
            'comparisons': [
                {
                    'left': comp.left,
                    'operator': comp.operator,
                    'right': comp.right,
                    'result': comp.result,
                    'left_value': self._resolve_value(comp.left),
                    'right_value': self._resolve_value(comp.right)
                }
                for comp in self.comparisons
            ],
            'total_comparisons': len(self.comparisons),
            'successful_computations': sum(1 for c in self.comparisons if c.result is not None)
        }
