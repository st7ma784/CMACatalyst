"""
Numerical tools for LLM to use when analyzing financial data.
Provides accurate math operations, comparisons, and pattern detection.
"""

import re
import json
from typing import List, Dict, Any, Union
from decimal import Decimal, InvalidOperation


class NumericalTools:
    """Tools for numerical operations and pattern detection."""
    
    @staticmethod
    def calculate(expression: str) -> Dict[str, Any]:
        """
        Safely evaluate a mathematical expression.
        
        Args:
            expression: Math expression like "1500 + 2300 - 450"
            
        Returns:
            dict with result and formatted output
            
        Example:
            calculate("1500 + 2300") -> {"result": 3800, "expression": "1500 + 2300", "formatted": "£3,800.00"}
        """
        try:
            # Remove £ signs and commas
            clean_expr = expression.replace('£', '').replace(',', '')
            
            # Only allow numbers, operators, parentheses, and decimal points
            if not re.match(r'^[\d\s\+\-\*\/\(\)\.]+$', clean_expr):
                return {
                    "error": "Invalid characters in expression",
                    "expression": expression
                }
            
            # Evaluate safely
            result = eval(clean_expr)
            
            return {
                "result": float(result),
                "expression": expression,
                "formatted": f"£{result:,.2f}" if result >= 0 else f"-£{abs(result):,.2f}",
                "clean_expression": clean_expr
            }
        except Exception as e:
            return {
                "error": str(e),
                "expression": expression
            }
    
    @staticmethod
    def compare_numbers(num1: Union[str, float], num2: Union[str, float], 
                       operation: str = "greater") -> Dict[str, Any]:
        """
        Compare two numbers.
        
        Args:
            num1: First number (can include £, commas)
            num2: Second number (can include £, commas)
            operation: "greater", "less", "equal", "greater_equal", "less_equal"
            
        Returns:
            dict with comparison result and details
        """
        try:
            # Clean and convert
            val1 = float(str(num1).replace('£', '').replace(',', ''))
            val2 = float(str(num2).replace('£', '').replace(',', ''))
            
            operations = {
                "greater": val1 > val2,
                "less": val1 < val2,
                "equal": abs(val1 - val2) < 0.01,  # Account for floating point
                "greater_equal": val1 >= val2,
                "less_equal": val1 <= val2
            }
            
            result = operations.get(operation, False)
            difference = val1 - val2
            
            return {
                "result": result,
                "num1": val1,
                "num2": val2,
                "operation": operation,
                "difference": difference,
                "formatted_difference": f"£{abs(difference):,.2f}",
                "comparison": f"£{val1:,.2f} {'>' if val1 > val2 else '<' if val1 < val2 else '='} £{val2:,.2f}"
            }
        except Exception as e:
            return {
                "error": str(e),
                "num1": num1,
                "num2": num2
            }
    
    @staticmethod
    def sum_numbers(numbers: List[Union[str, float]]) -> Dict[str, Any]:
        """
        Sum a list of numbers.
        
        Args:
            numbers: List of numbers (can include £, commas)
            
        Returns:
            dict with sum, average, and details
        """
        try:
            # Clean and convert
            values = [float(str(n).replace('£', '').replace(',', '')) for n in numbers]
            
            total = sum(values)
            average = total / len(values) if values else 0
            minimum = min(values) if values else 0
            maximum = max(values) if values else 0
            
            return {
                "sum": total,
                "average": average,
                "count": len(values),
                "min": minimum,
                "max": maximum,
                "formatted_sum": f"£{total:,.2f}",
                "formatted_average": f"£{average:,.2f}",
                "values": values
            }
        except Exception as e:
            return {
                "error": str(e),
                "numbers": numbers
            }
    
    @staticmethod
    def find_convenient_sums(numbers: List[Union[str, float]], 
                           target_tolerance: float = 50) -> Dict[str, Any]:
        """
        Find groups of numbers that sum to convenient/round amounts.
        Useful for detecting patterns in debts or payments.
        
        Args:
            numbers: List of numbers to analyze
            target_tolerance: How close to a round number (default: within £50)
            
        Returns:
            dict with detected patterns
        """
        try:
            # Clean and convert
            values = [float(str(n).replace('£', '').replace(',', '')) for n in numbers]
            
            # Define "convenient" round numbers to check
            round_targets = [100, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000, 
                           7500, 10000, 15000, 20000, 25000, 50000]
            
            patterns = []
            
            # Check pairs
            for i, val1 in enumerate(values):
                for j, val2 in enumerate(values[i+1:], i+1):
                    pair_sum = val1 + val2
                    for target in round_targets:
                        if abs(pair_sum - target) <= target_tolerance:
                            patterns.append({
                                "type": "pair",
                                "values": [val1, val2],
                                "indices": [i, j],
                                "sum": pair_sum,
                                "target": target,
                                "difference": pair_sum - target,
                                "description": f"£{val1:,.2f} + £{val2:,.2f} = £{pair_sum:,.2f} (≈ £{target:,.2f})"
                            })
            
            # Check triples
            for i, val1 in enumerate(values):
                for j, val2 in enumerate(values[i+1:], i+1):
                    for k, val3 in enumerate(values[j+1:], j+1):
                        triple_sum = val1 + val2 + val3
                        for target in round_targets:
                            if abs(triple_sum - target) <= target_tolerance:
                                patterns.append({
                                    "type": "triple",
                                    "values": [val1, val2, val3],
                                    "indices": [i, j, k],
                                    "sum": triple_sum,
                                    "target": target,
                                    "difference": triple_sum - target,
                                    "description": f"£{val1:,.2f} + £{val2:,.2f} + £{val3:,.2f} = £{triple_sum:,.2f} (≈ £{target:,.2f})"
                                })
            
            # Check if total is convenient
            total = sum(values)
            for target in round_targets:
                if abs(total - target) <= target_tolerance:
                    patterns.append({
                        "type": "total",
                        "values": values,
                        "sum": total,
                        "target": target,
                        "difference": total - target,
                        "description": f"Total sum £{total:,.2f} (≈ £{target:,.2f})"
                    })
            
            return {
                "patterns_found": len(patterns),
                "patterns": patterns,
                "total_sum": total,
                "total_count": len(values),
                "analyzed_numbers": values
            }
        except Exception as e:
            return {
                "error": str(e),
                "numbers": numbers
            }
    
    @staticmethod
    def detect_patterns(numbers: List[Union[str, float]]) -> Dict[str, Any]:
        """
        Detect various patterns in a list of numbers.
        
        Args:
            numbers: List of numbers to analyze
            
        Returns:
            dict with detected patterns (duplicates, sequences, etc.)
        """
        try:
            # Clean and convert
            values = [float(str(n).replace('£', '').replace(',', '')) for n in numbers]
            
            # Sort for easier pattern detection
            sorted_values = sorted(values)
            
            # Detect duplicates
            from collections import Counter
            counts = Counter(values)
            duplicates = {val: count for val, count in counts.items() if count > 1}
            
            # Detect similar values (within 5%)
            similar_groups = []
            checked = set()
            for i, val1 in enumerate(sorted_values):
                if val1 in checked:
                    continue
                group = [val1]
                for val2 in sorted_values[i+1:]:
                    if val2 in checked:
                        continue
                    if val1 > 0 and abs((val2 - val1) / val1) <= 0.05:
                        group.append(val2)
                        checked.add(val2)
                if len(group) > 1:
                    similar_groups.append({
                        "values": group,
                        "average": sum(group) / len(group),
                        "range": max(group) - min(group),
                        "count": len(group)
                    })
                checked.add(val1)
            
            # Check for multiples/divisors
            multiples = []
            for i, val1 in enumerate(values):
                for j, val2 in enumerate(values):
                    if i != j and val1 > 0 and val2 > 0:
                        ratio = val2 / val1
                        if ratio == int(ratio) and ratio > 1:
                            multiples.append({
                                "base": val1,
                                "multiple": val2,
                                "factor": int(ratio),
                                "description": f"£{val2:,.2f} is {int(ratio)}x £{val1:,.2f}"
                            })
            
            return {
                "duplicates": duplicates,
                "duplicate_count": len(duplicates),
                "similar_groups": similar_groups,
                "similar_group_count": len(similar_groups),
                "multiples": multiples,
                "multiple_count": len(multiples),
                "total_values": len(values),
                "min": min(values) if values else 0,
                "max": max(values) if values else 0,
                "range": max(values) - min(values) if values else 0
            }
        except Exception as e:
            return {
                "error": str(e),
                "numbers": numbers
            }
    
    @staticmethod
    def extract_numbers_from_text(text: str) -> Dict[str, Any]:
        """
        Extract all numbers from text, handling currency formatting.
        
        Args:
            text: Text to extract numbers from
            
        Returns:
            dict with extracted numbers and statistics
        """
        try:
            # Pattern to match currency amounts: £1,234.56 or 1234.56 or £1234
            pattern = r'£?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)'
            matches = re.findall(pattern, text)
            
            # Clean and convert
            numbers = []
            for match in matches:
                try:
                    clean = match.replace(',', '')
                    numbers.append(float(clean))
                except ValueError:
                    continue
            
            if not numbers:
                return {
                    "numbers": [],
                    "count": 0,
                    "message": "No numbers found in text"
                }
            
            return {
                "numbers": numbers,
                "count": len(numbers),
                "sum": sum(numbers),
                "average": sum(numbers) / len(numbers),
                "min": min(numbers),
                "max": max(numbers),
                "formatted_sum": f"£{sum(numbers):,.2f}",
                "formatted_average": f"£{sum(numbers) / len(numbers):,.2f}"
            }
        except Exception as e:
            return {
                "error": str(e),
                "text_length": len(text)
            }
    
    @classmethod
    def get_tool_definitions(cls) -> List[Dict[str, Any]]:
        """
        Get tool definitions for LLM function calling.
        
        Returns:
            List of tool definitions in format expected by Ollama/LangChain
        """
        return [
            {
                "name": "calculate",
                "description": "Safely evaluate a mathematical expression. Use this for addition, subtraction, multiplication, division. Example: calculate('1500 + 2300 - 450')",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "Mathematical expression to evaluate, e.g., '1500 + 2300' or '5000 * 0.05'"
                        }
                    },
                    "required": ["expression"]
                }
            },
            {
                "name": "compare_numbers",
                "description": "Compare two numbers (greater, less, equal). Example: compare_numbers('5000', '3000', 'greater')",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "num1": {
                            "type": "string",
                            "description": "First number (can include £ or commas)"
                        },
                        "num2": {
                            "type": "string",
                            "description": "Second number (can include £ or commas)"
                        },
                        "operation": {
                            "type": "string",
                            "enum": ["greater", "less", "equal", "greater_equal", "less_equal"],
                            "description": "Comparison operation"
                        }
                    },
                    "required": ["num1", "num2", "operation"]
                }
            },
            {
                "name": "sum_numbers",
                "description": "Sum a list of numbers and get statistics (sum, average, min, max). Example: sum_numbers(['1500', '2300', '450'])",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "numbers": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of numbers to sum"
                        }
                    },
                    "required": ["numbers"]
                }
            },
            {
                "name": "find_convenient_sums",
                "description": "Find groups of numbers that sum to convenient/round amounts (£100, £500, £1000, etc.). Useful for detecting suspicious patterns. Example: find_convenient_sums(['450', '550', '1200'])",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "numbers": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of numbers to analyze for patterns"
                        },
                        "target_tolerance": {
                            "type": "number",
                            "description": "How close to round number (default: 50)"
                        }
                    },
                    "required": ["numbers"]
                }
            },
            {
                "name": "detect_patterns",
                "description": "Detect patterns in numbers: duplicates, similar values, multiples. Example: detect_patterns(['500', '500', '250', '1000'])",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "numbers": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of numbers to analyze"
                        }
                    },
                    "required": ["numbers"]
                }
            },
            {
                "name": "extract_numbers_from_text",
                "description": "Extract all numbers from text and get statistics. Example: extract_numbers_from_text('Client owes £1,500 to creditor A and £2,300 to B')",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "Text to extract numbers from"
                        }
                    },
                    "required": ["text"]
                }
            },
            {
                "name": "check_threshold",
                "description": "Check if an amount meets debt advice thresholds like DRO limits, bankruptcy fees, etc. Automatically knows the rules! Example: check_threshold('60000', 'dro_max_debt')",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "amount": {
                            "type": "string",
                            "description": "Amount to check (can include £ or commas)"
                        },
                        "threshold_name": {
                            "type": "string",
                            "description": "Threshold to check: dro_max_debt, dro_max_assets, dro_max_surplus_income, bankruptcy_fee, breathing_space_duration, priority_debt_threshold, small_claims_limit"
                        }
                    },
                    "required": ["amount", "threshold_name"]
                }
            },
            {
                "name": "extract_and_enrich_numbers",
                "description": "Extract numbers from text AND detect if they are thresholds/limits. Enriches text to make comparisons explicit. Use this when you see limits/maximums/minimums in the manual text.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "Text containing numbers and potential thresholds"
                        },
                        "include_comparisons": {
                            "type": "boolean",
                            "description": "Add explicit comparison hints (default: true)"
                        }
                    },
                    "required": ["text"]
                }
            }
        ]
    
    @staticmethod
    def check_threshold(amount: Union[str, float], threshold_name: str) -> Dict[str, Any]:
        """
        Check if an amount meets common debt advice thresholds.
        
        This tool knows the standard limits and can automatically check them.
        
        Args:
            amount: Amount to check (can include £, commas)
            threshold_name: Name of threshold to check against
            
        Returns:
            dict with comparison results and advice
        """
        # Known thresholds in debt advice
        THRESHOLDS = {
            "dro_max_debt": {
                "value": 30000,
                "description": "DRO maximum qualifying debt",
                "rule": "Must be £30,000 or less to qualify for DRO"
            },
            "dro_max_assets": {
                "value": 2000,
                "description": "DRO maximum asset value",
                "rule": "Assets must not exceed £2,000 (excluding certain items)"
            },
            "dro_max_surplus_income": {
                "value": 75,
                "description": "DRO maximum surplus income",
                "rule": "Monthly surplus income must be £75 or less"
            },
            "bankruptcy_fee": {
                "value": 680,
                "description": "Bankruptcy application fee",
                "rule": "£680 fee required to file for bankruptcy"
            },
            "breathing_space_duration": {
                "value": 60,
                "description": "Standard breathing space duration (days)",
                "rule": "Provides 60 days of protection from creditor action"
            },
            "priority_debt_threshold": {
                "value": 1000,
                "description": "Typical priority debt concern threshold",
                "rule": "Debts over £1,000 typically require urgent attention if they're priority debts"
            },
            "small_claims_limit": {
                "value": 10000,
                "description": "Small claims court limit",
                "rule": "Claims under £10,000 go through small claims procedure"
            }
        }
        
        try:
            # Clean and convert amount
            clean_amount = str(amount).replace('£', '').replace(',', '')
            amount_value = float(clean_amount)
            
            # Get threshold info
            threshold_info = THRESHOLDS.get(threshold_name.lower().replace(' ', '_'))
            
            if not threshold_info:
                available = ", ".join(THRESHOLDS.keys())
                return {
                    "error": f"Unknown threshold: {threshold_name}",
                    "available_thresholds": available
                }
            
            threshold_value = threshold_info["value"]
            
            # Perform comparison
            is_within = amount_value <= threshold_value
            difference = amount_value - threshold_value
            
            # Generate advice
            if is_within:
                if difference == 0:
                    advice = f"✓ Amount is exactly at the {threshold_info['description']} limit"
                else:
                    advice = f"✓ Amount is £{abs(difference):,.2f} below the limit - QUALIFIES"
            else:
                advice = f"✗ Amount is £{difference:,.2f} OVER the limit - DOES NOT QUALIFY"
            
            return {
                "amount": amount_value,
                "formatted_amount": f"£{amount_value:,.2f}",
                "threshold_name": threshold_name,
                "threshold_value": threshold_value,
                "formatted_threshold": f"£{threshold_value:,.2f}",
                "is_within_limit": is_within,
                "difference": difference,
                "formatted_difference": f"£{abs(difference):,.2f}",
                "rule": threshold_info["rule"],
                "advice": advice,
                "comparison": f"£{amount_value:,.2f} {'<=' if is_within else '>'} £{threshold_value:,.2f}"
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "amount": amount,
                "threshold_name": threshold_name
            }
    
    @staticmethod
    def extract_and_enrich_numbers(text: str, include_comparisons: bool = True) -> Dict[str, Any]:
        """
        Extract numbers from text and enrich with semantic meaning.
        
        This makes it MUCH easier for LLMs to understand numerical relationships.
        It converts "limit is £30,000" into structured comparisons.
        
        Args:
            text: Text containing numbers
            include_comparisons: Add explicit comparison hints
            
        Returns:
            dict with extracted numbers, detected thresholds, and enriched text
        """
        try:
            # Extract all currency amounts
            pattern = r'£?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)'
            matches = re.finditer(pattern, text)
            
            numbers = []
            positions = []
            
            for match in matches:
                try:
                    clean = match.group(1).replace(',', '')
                    value = float(clean)
                    numbers.append({
                        "value": value,
                        "formatted": f"£{value:,.2f}",
                        "original": match.group(0),
                        "position": match.start()
                    })
                    positions.append((match.start(), match.end(), value))
                except ValueError:
                    continue
            
            # Detect threshold keywords near numbers
            threshold_keywords = {
                "maximum": "upper_limit",
                "max": "upper_limit", 
                "limit": "threshold",
                "minimum": "lower_limit",
                "min": "lower_limit",
                "at least": "lower_limit",
                "no more than": "upper_limit",
                "cannot exceed": "upper_limit",
                "must be": "exact_or_limit",
                "should be": "target",
                "threshold": "threshold"
            }
            
            detected_thresholds = []
            
            # Look for threshold indicators near each number
            for num_info in numbers:
                pos = num_info["position"]
                # Check 50 characters before the number
                context_before = text[max(0, pos-50):pos].lower()
                context_after = text[pos:min(len(text), pos+50)].lower()
                
                for keyword, threshold_type in threshold_keywords.items():
                    if keyword in context_before or keyword in context_after:
                        detected_thresholds.append({
                            "value": num_info["value"],
                            "formatted": num_info["formatted"],
                            "type": threshold_type,
                            "keyword": keyword,
                            "context": text[max(0, pos-30):min(len(text), pos+30)]
                        })
                        break
            
            # Generate enriched text with explicit comparisons
            enriched_text = text
            
            if include_comparisons and detected_thresholds:
                enrichments = []
                for threshold in detected_thresholds:
                    if threshold["type"] == "upper_limit":
                        enrichments.append(
                            f"\n📊 NUMERIC RULE: {threshold['formatted']} is an UPPER LIMIT. "
                            f"Values ABOVE this do NOT qualify. Values AT OR BELOW qualify."
                        )
                    elif threshold["type"] == "lower_limit":
                        enrichments.append(
                            f"\n📊 NUMERIC RULE: {threshold['formatted']} is a LOWER LIMIT. "
                            f"Values BELOW this do NOT qualify. Values AT OR ABOVE qualify."
                        )
                    elif threshold["type"] == "threshold":
                        enrichments.append(
                            f"\n📊 NUMERIC RULE: {threshold['formatted']} is a KEY THRESHOLD. "
                            f"Check if comparison values are above or below this amount."
                        )
                
                enriched_text = text + "\n" + "\n".join(enrichments)
            
            return {
                "original_text": text,
                "enriched_text": enriched_text,
                "numbers_found": len(numbers),
                "numbers": numbers,
                "detected_thresholds": detected_thresholds,
                "has_thresholds": len(detected_thresholds) > 0
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "original_text": text
            }
    
    @classmethod
    def execute_tool(cls, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool by name with given arguments.
        
        Args:
            tool_name: Name of the tool to execute
            arguments: Dictionary of arguments for the tool
            
        Returns:
            Result from the tool
        """
        tools = {
            "calculate": cls.calculate,
            "compare_numbers": cls.compare_numbers,
            "sum_numbers": cls.sum_numbers,
            "find_convenient_sums": cls.find_convenient_sums,
            "detect_patterns": cls.detect_patterns,
            "extract_numbers_from_text": cls.extract_numbers_from_text,
            "check_threshold": cls.check_threshold,
            "extract_and_enrich_numbers": cls.extract_and_enrich_numbers
        }
        
        tool_func = tools.get(tool_name)
        if not tool_func:
            return {"error": f"Unknown tool: {tool_name}"}
        
        try:
            return tool_func(**arguments)
        except TypeError as e:
            return {"error": f"Invalid arguments for {tool_name}: {str(e)}"}


# Example usage
if __name__ == "__main__":
    tools = NumericalTools()
    
    # Test calculate
    print("Calculate:", tools.calculate("1500 + 2300 - 450"))
    
    # Test compare
    print("\nCompare:", tools.compare_numbers("5000", "3000", "greater"))
    
    # Test sum
    print("\nSum:", tools.sum_numbers(["1500", "2300", "450", "£1,200"]))
    
    # Test convenient sums
    print("\nConvenient sums:", tools.find_convenient_sums(["450", "550", "£1,200", "800"]))
    
    # Test patterns
    print("\nPatterns:", tools.detect_patterns(["500", "500", "250", "1000", "£1,000"]))
    
    # Test extract
    print("\nExtract:", tools.extract_numbers_from_text("Client owes £1,500 to A, £2,300 to B, and £450 to C"))
