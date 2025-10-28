"""
Dynamic Decision Tree Builder for Financial Eligibility Rules

Extracts rules from source documents and builds decision trees with:
- Binary eligibility checks (pass/fail)
- Near-miss detection and remediation strategies
- Lateral thinking for borderline cases
- Dynamic construction from manuals during ingestion
"""

import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class NodeType(Enum):
    """Types of decision tree nodes"""
    ROOT = "root"
    CONDITION = "condition"
    RESULT = "result"
    NEAR_MISS = "near_miss"
    STRATEGY = "strategy"


class Operator(Enum):
    """Comparison operators for conditions"""
    LESS_THAN = "<"
    LESS_EQUAL = "<="
    GREATER_THAN = ">"
    GREATER_EQUAL = ">="
    EQUAL = "=="
    NOT_EQUAL = "!="


@dataclass
class RemediationStrategy:
    """Strategy to address near-miss scenarios"""
    description: str
    actions: List[str]
    likelihood: str  # "high", "medium", "low"
    example: Optional[str] = None
    source: Optional[str] = None  # Which manual section this came from


@dataclass
class NearMissThreshold:
    """Defines what constitutes a 'near miss' for a threshold"""
    threshold_name: str
    threshold_value: float
    tolerance: float  # How close is "near" (e.g., 2% over limit)
    tolerance_absolute: Optional[float] = None  # Absolute value (e.g., £1000 over)
    strategies: List[RemediationStrategy] = field(default_factory=list)


@dataclass
class DecisionNode:
    """A node in the decision tree"""
    id: str
    type: NodeType
    
    # For CONDITION nodes
    variable: Optional[str] = None
    operator: Optional[Operator] = None
    threshold: Optional[float] = None
    threshold_name: Optional[str] = None
    
    # For NEAR_MISS nodes
    near_miss_info: Optional[NearMissThreshold] = None
    gap_amount: Optional[float] = None  # How far from threshold
    
    # For RESULT nodes
    result: Optional[str] = None  # "eligible", "not_eligible", "requires_review"
    confidence: Optional[float] = None
    explanation: Optional[str] = None
    
    # Tree structure
    true_branch: Optional['DecisionNode'] = None
    false_branch: Optional['DecisionNode'] = None
    near_miss_branch: Optional['DecisionNode'] = None
    
    # Metadata
    source_text: Optional[str] = None
    source_document: Optional[str] = None


@dataclass
class DecisionPath:
    """Records a path through the decision tree"""
    nodes: List[DecisionNode]
    decisions: List[Dict[str, Any]]
    final_result: str
    near_misses: List[NearMissThreshold]
    strategies: List[RemediationStrategy]
    confidence: float


class DecisionTreeBuilder:
    """
    Dynamically builds decision trees from source documents.
    
    Extracts:
    - Eligibility conditions (IF debt <= 50000 THEN eligible)
    - Threshold values (DRO limit is £50,000)
    - Near-miss remediation strategies (pay down debt to qualify)
    """
    
    def __init__(self):
        self.trees: Dict[str, DecisionNode] = {}  # topic -> root node
        self.thresholds: Dict[str, float] = {}  # name -> value
        self.near_miss_rules: List[NearMissThreshold] = []
        self.remediation_patterns: Dict[str, List[RemediationStrategy]] = {}
        
    def extract_rules_from_chunk(self, chunk_text: str, source_doc: str) -> List[Dict[str, Any]]:
        """
        Extract eligibility rules from a text chunk.
        
        Looks for patterns like:
        - "must not exceed £50,000"
        - "total debt must be less than £50,000"
        - "income should not be more than £75 per month"
        - "you are not eligible if debt exceeds £50,000"
        """
        rules = []
        
        # Detect topic from source document name
        topic = self._infer_topic_from_source(source_doc, chunk_text)
        
        # Pattern 1: "must (not) exceed/be less than X"
        patterns = [
            # Positive conditions (must be less than)
            r'(?:debt|total debt|amount|income).*?must(?:\s+not)?\s+(?:be\s+)?(?:more than|exceed|be above)\s*£?([\d,]+(?:\.\d{2})?)',
            r'(?:debt|total debt|amount|income).*?(?:must|should)\s+be\s+(?:less than|below|under)\s*£?([\d,]+(?:\.\d{2})?)',
            
            # Negative conditions (threshold for exclusion)
            r'(?:not eligible|ineligible|excluded)\s+if.*?(?:exceeds?|more than|above)\s*£?([\d,]+(?:\.\d{2})?)',
            r'(?:exceeds?|more than|above)\s*£?([\d,]+(?:\.\d{2})?).*?(?:not eligible|ineligible)',
            
            # Explicit limits
            r'(?:limit|maximum|cap|threshold)(?:\s+is|\s+of)?\s*£?([\d,]+(?:\.\d{2})?)',
            r'up to\s*£?([\d,]+(?:\.\d{2})?)',
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, chunk_text, re.IGNORECASE)
            for match in matches:
                value_str = match.group(1).replace(',', '')
                try:
                    value = float(value_str)
                    
                    # Determine variable and operator from context
                    context = match.group(0).lower()
                    
                    if 'debt' in context:
                        variable = 'debt'
                    elif 'income' in context:
                        variable = 'income'
                    elif 'asset' in context or 'property' in context:
                        variable = 'assets'
                    else:
                        variable = 'amount'
                    
                    # Determine operator
                    if 'not exceed' in context or 'less than' in context or 'below' in context or 'under' in context or 'up to' in context:
                        operator = Operator.LESS_EQUAL
                    elif 'exceed' in context or 'more than' in context or 'above' in context:
                        operator = Operator.GREATER_THAN
                    else:
                        operator = Operator.LESS_EQUAL  # Default for limits
                    
                    rules.append({
                        'variable': variable,
                        'operator': operator,
                        'threshold': value,
                        'context': match.group(0),
                        'source': source_doc,
                        'topic': topic,  # NEW: Associate rule with topic
                        'relevance_score': self._calculate_relevance(value, variable, topic)  # NEW: Score for prioritization
                    })
                    
                    logger.debug(f"Extracted rule: {variable} {operator.value} {value} (topic: {topic})")
                    
                except ValueError:
                    continue
        
        return rules
    
    def _infer_topic_from_source(self, source_doc: str, chunk_text: str) -> str:
        """Infer the topic (DRO, bankruptcy, IVA, etc.) from document and content"""
        source_lower = source_doc.lower()
        text_lower = chunk_text.lower()
        
        # Check document name first
        if 'dro' in source_lower or 'debt relief order' in text_lower:
            return 'dro'
        elif 'bankruptcy' in source_lower or 'bankrupt' in text_lower:
            return 'bankruptcy'
        elif 'iva' in source_lower or 'individual voluntary arrangement' in text_lower:
            return 'iva'
        elif 'debt management' in source_lower or 'dmp' in source_lower:
            return 'dmp'
        
        # Default to general if can't determine
        return 'general'
    
    def _calculate_relevance(self, threshold: float, variable: str, topic: str) -> float:
        """
        Calculate relevance score for prioritizing rules.
        
        Higher scores = more important for the topic.
        """
        score = 0.0
        
        # Known DRO thresholds (prioritize these)
        if topic == 'dro':
            if variable == 'debt' and threshold in [50000, 30000]:  # Current and old DRO debt limits
                score = 100.0
            elif variable == 'income' and threshold in [75, 50]:  # Monthly income limits
                score = 90.0
            elif variable == 'assets' and threshold in [2000, 1000]:  # Asset limits
                score = 85.0
            elif variable == 'debt' and 40000 <= threshold <= 60000:  # Near DRO range
                score = 80.0
            else:
                score = 50.0  # Other DRO-related thresholds
        
        # Known bankruptcy thresholds
        elif topic == 'bankruptcy':
            if variable == 'debt' and threshold == 5000:  # Minimum debt for creditor petition
                score = 100.0
            elif variable == 'assets' and threshold > 10000:
                score = 90.0
            else:
                score = 50.0
        
        # Default scoring
        else:
            score = 30.0
        
        return score
    
    def extract_remediation_strategies(self, chunk_text: str, source_doc: str) -> List[RemediationStrategy]:
        """
        Extract strategies for addressing near-miss scenarios.
        
        Looks for patterns like:
        - "pay down debt to bring it below the limit"
        - "sell assets to reduce total value"
        - "wait until debts are written off"
        - "consider an IVA instead"
        """
        strategies = []
        
        # Pattern indicators for remediation advice
        remediation_patterns = [
            r'(?:could|can|may|might)\s+(?:pay|reduce|sell|discharge|write off|negotiate).*?(?:to|in order to)\s+(?:bring|get|reduce|lower).*?(?:below|under|down to)',
            r'(?:consider|try|attempt).*?(?:paying|reducing|selling|discharging)',
            r'(?:alternative|option|instead).*?(?:IVA|bankruptcy|debt management|payment plan)',
            r'if.*?(?:pay|reduce|sell).*?(?:could|might|may)\s+(?:qualify|be eligible)',
        ]
        
        for pattern in remediation_patterns:
            matches = re.finditer(pattern, chunk_text, re.IGNORECASE)
            for match in matches:
                context = match.group(0)
                
                # Extract the action
                action_verbs = ['pay', 'reduce', 'sell', 'discharge', 'write off', 'negotiate', 'consider', 'wait']
                actions = []
                for verb in action_verbs:
                    if verb in context.lower():
                        # Extract full phrase around verb
                        verb_pos = context.lower().find(verb)
                        phrase = context[max(0, verb_pos-20):min(len(context), verb_pos+100)]
                        actions.append(phrase.strip())
                
                if actions:
                    strategies.append(RemediationStrategy(
                        description=context.strip(),
                        actions=actions,
                        likelihood="medium",  # Could be refined with ML
                        example=None,
                        source=source_doc
                    ))
        
        return strategies
    
    def build_near_miss_rules(self, rules: List[Dict[str, Any]]) -> List[NearMissThreshold]:
        """
        Create near-miss thresholds for extracted rules.
        
        For each threshold, defines:
        - Tolerance range (e.g., within 5% or £2000)
        - Associated remediation strategies
        """
        near_miss_rules = []
        
        for rule in rules:
            variable = rule['variable']
            threshold = rule['threshold']
            
            # Define tolerance based on threshold magnitude
            if threshold >= 10000:  # Large amounts (e.g., £50,000)
                tolerance_absolute = 2000  # £2,000 wiggle room
                tolerance_percent = 0.04  # 4%
            elif threshold >= 1000:  # Medium amounts (e.g., £2,000)
                tolerance_absolute = 200  # £200 wiggle room
                tolerance_percent = 0.10  # 10%
            else:  # Small amounts (e.g., £75)
                tolerance_absolute = 10  # £10 wiggle room
                tolerance_percent = 0.15  # 15%
            
            # Get relevant strategies for this threshold
            strategies = self.remediation_patterns.get(variable, [])
            
            near_miss_rule = NearMissThreshold(
                threshold_name=f"{variable}_limit",
                threshold_value=threshold,
                tolerance=tolerance_percent,
                tolerance_absolute=tolerance_absolute,
                strategies=strategies
            )
            
            near_miss_rules.append(near_miss_rule)
            logger.info(f"Created near-miss rule for {variable}: £{threshold} ± £{tolerance_absolute}")
        
        return near_miss_rules
    
    def build_tree_from_rules(self, rules: List[Dict[str, Any]], topic: str = "default") -> DecisionNode:
        """
        Build a decision tree from extracted rules.
        
        Creates a tree structure with:
        - CONDITION nodes for each rule
        - NEAR_MISS nodes for borderline cases
        - RESULT nodes for final outcomes
        - STRATEGY nodes for remediation advice
        
        IMPROVED: Filters rules by topic, prioritizes by relevance, and creates parallel structure
        """
        if not rules:
            return DecisionNode(
                id="root_empty",
                type=NodeType.ROOT,
                result="no_rules_found",
                explanation="No eligibility rules could be extracted from the manual."
            )
        
        # Filter rules by topic
        topic_key = topic.split('_')[0]  # Extract 'dro' from 'dro_eligibility'
        filtered_rules = [r for r in rules if r.get('topic', 'general') == topic_key or r.get('topic') == 'general']
        
        if not filtered_rules:
            logger.warning(f"No rules found for topic '{topic_key}', using all rules")
            filtered_rules = rules
        
        logger.info(f"Building tree for {topic}: {len(filtered_rules)} relevant rules (filtered from {len(rules)} total)")
        
        # Sort by relevance score (highest first), then by variable priority
        variable_priority = {'debt': 0, 'income': 1, 'assets': 2, 'amount': 3}
        filtered_rules = sorted(
            filtered_rules,
            key=lambda r: (
                -r.get('relevance_score', 0),  # Highest score first (negative for descending)
                variable_priority.get(r['variable'], 99),  # Then by variable priority
                -r['threshold']  # Then by threshold value (largest first)
            )
        )
        
        # Log top rules being used
        logger.info(f"Top 5 rules for {topic}:")
        for i, rule in enumerate(filtered_rules[:5]):
            logger.info(f"  {i+1}. {rule['variable']} {rule['operator'].value} £{rule['threshold']:,.0f} (score: {rule.get('relevance_score', 0)})")
        
        # Build tree recursively with filtered rules
        root = self._build_node_recursive(filtered_rules, 0, "root", max_depth=5)  # Limit depth
        self.trees[topic] = root
        
        return root
    
    def _build_node_recursive(self, rules: List[Dict[str, Any]], depth: int, parent_id: str, max_depth: int = 5) -> DecisionNode:
        """
        Recursively build decision tree nodes with depth limit.
        
        IMPROVED: Stops at max_depth to prevent overly deep trees
        """
        # Stop if no rules or max depth reached
        if not rules or depth >= max_depth:
            return DecisionNode(
                id=f"{parent_id}_leaf",
                type=NodeType.RESULT,
                result="eligible",
                confidence=0.9 - (depth * 0.1),  # Lower confidence for deeper paths
                explanation="All checked conditions satisfied" if not rules else f"Reached evaluation limit at depth {depth}"
            )
        
        # Take first rule and create condition node
        rule = rules[0]
        remaining_rules = rules[1:]
        
        node_id = f"{parent_id}_{rule['variable']}_{int(rule['threshold'])}"
        
        condition_node = DecisionNode(
            id=node_id,
            type=NodeType.CONDITION,
            variable=rule['variable'],
            operator=rule['operator'],
            threshold=rule['threshold'],
            threshold_name=rule.get('threshold_name', f"{rule['variable']}_limit"),
            source_text=rule.get('context'),
            source_document=rule.get('source')
        )
        
        # TRUE branch: condition satisfied, check remaining rules
        condition_node.true_branch = self._build_node_recursive(remaining_rules, depth + 1, f"{node_id}_pass", max_depth)
        
        # FALSE branch: condition failed
        condition_node.false_branch = DecisionNode(
            id=f"{node_id}_fail",
            type=NodeType.RESULT,
            result="not_eligible",
            confidence=0.95,
            explanation=f"Failed condition: {rule['variable']} {rule['operator'].value} £{rule['threshold']:,.0f}"
        )
        
        # NEAR_MISS branch: close to threshold
        near_miss_threshold = self._find_near_miss_rule(rule['variable'], rule['threshold'])
        if near_miss_threshold:
            condition_node.near_miss_branch = DecisionNode(
                id=f"{node_id}_near",
                type=NodeType.NEAR_MISS,
                near_miss_info=near_miss_threshold,
                result="requires_review",
                confidence=0.7,
                explanation=f"Near threshold: consider remediation strategies"
            )
        
        return condition_node
    
    def _find_near_miss_rule(self, variable: str, threshold: float) -> Optional[NearMissThreshold]:
        """Find the near-miss rule for a given variable and threshold"""
        for rule in self.near_miss_rules:
            if variable in rule.threshold_name and rule.threshold_value == threshold:
                return rule
        return None
    
    def traverse_tree(self, tree: DecisionNode, client_values: Dict[str, float]) -> DecisionPath:
        """
        Traverse the decision tree with client values.
        
        Returns the path taken, including any near-miss detections.
        """
        path = DecisionPath(
            nodes=[],
            decisions=[],
            final_result="unknown",
            near_misses=[],
            strategies=[],
            confidence=1.0
        )
        
        current = tree
        
        while current:
            path.nodes.append(current)
            
            if current.type == NodeType.RESULT:
                path.final_result = current.result
                path.confidence = current.confidence
                break
            
            if current.type == NodeType.CONDITION:
                client_value = client_values.get(current.variable)
                
                if client_value is None:
                    path.final_result = "insufficient_data"
                    path.confidence = 0.0
                    break
                
                # Check for near-miss first
                if current.near_miss_branch and current.near_miss_info:
                    threshold = current.threshold
                    tolerance_abs = current.near_miss_info.tolerance_absolute or 0
                    
                    # Check if within near-miss range
                    if current.operator in [Operator.LESS_EQUAL, Operator.LESS_THAN]:
                        # Client should be UNDER threshold
                        if client_value > threshold and client_value <= threshold + tolerance_abs:
                            # Near miss: slightly over limit
                            path.near_misses.append(current.near_miss_info)
                            path.strategies.extend(current.near_miss_info.strategies)
                            path.decisions.append({
                                'variable': current.variable,
                                'client_value': client_value,
                                'threshold': threshold,
                                'gap': client_value - threshold,
                                'decision': 'near_miss_over'
                            })
                            current = current.near_miss_branch
                            continue
                    
                    elif current.operator in [Operator.GREATER_THAN, Operator.GREATER_EQUAL]:
                        # Client should be OVER threshold
                        if client_value < threshold and client_value >= threshold - tolerance_abs:
                            # Near miss: slightly under limit
                            path.near_misses.append(current.near_miss_info)
                            path.strategies.extend(current.near_miss_info.strategies)
                            path.decisions.append({
                                'variable': current.variable,
                                'client_value': client_value,
                                'threshold': threshold,
                                'gap': threshold - client_value,
                                'decision': 'near_miss_under'
                            })
                            current = current.near_miss_branch
                            continue
                
                # Normal condition evaluation
                result = self._evaluate_condition(client_value, current.operator, current.threshold)
                
                path.decisions.append({
                    'variable': current.variable,
                    'client_value': client_value,
                    'threshold': current.threshold,
                    'operator': current.operator.value,
                    'result': result
                })
                
                if result:
                    current = current.true_branch
                else:
                    current = current.false_branch
            
            else:
                # Unexpected node type
                break
        
        return path
    
    def _evaluate_condition(self, value: float, operator: Operator, threshold: float) -> bool:
        """Evaluate a comparison"""
        if operator == Operator.LESS_THAN:
            return value < threshold
        elif operator == Operator.LESS_EQUAL:
            return value <= threshold
        elif operator == Operator.GREATER_THAN:
            return value > threshold
        elif operator == Operator.GREATER_EQUAL:
            return value >= threshold
        elif operator == Operator.EQUAL:
            return abs(value - threshold) < 0.01  # Float equality with tolerance
        elif operator == Operator.NOT_EQUAL:
            return abs(value - threshold) >= 0.01
        return False
    
    def ingest_documents(self, chunks: List[Dict[str, Any]]) -> None:
        """
        Process document chunks during ingestion to build decision trees.
        
        This is called during the RAG ingestion pipeline.
        
        IMPROVED: Builds separate trees for different topics (DRO, bankruptcy, IVA, etc.)
        """
        all_rules = []
        all_strategies = []
        
        for chunk in chunks:
            text = chunk.get('text', '')
            source = chunk.get('source', 'unknown')
            
            # Extract rules
            rules = self.extract_rules_from_chunk(text, source)
            all_rules.extend(rules)
            
            # Extract remediation strategies
            strategies = self.extract_remediation_strategies(text, source)
            all_strategies.extend(strategies)
        
        # Group strategies by variable
        for strategy in all_strategies:
            for action in strategy.actions:
                if 'debt' in action.lower():
                    self.remediation_patterns.setdefault('debt', []).append(strategy)
                elif 'income' in action.lower():
                    self.remediation_patterns.setdefault('income', []).append(strategy)
                elif 'asset' in action.lower():
                    self.remediation_patterns.setdefault('assets', []).append(strategy)
        
        # Build near-miss rules
        self.near_miss_rules = self.build_near_miss_rules(all_rules)
        
        # Group rules by topic
        rules_by_topic = {}
        for rule in all_rules:
            topic = rule.get('topic', 'general')
            rules_by_topic.setdefault(topic, []).append(rule)
        
        logger.info(f"Rules grouped by topic: {[(topic, len(rules)) for topic, rules in rules_by_topic.items()]}")
        
        # Build separate tree for each topic
        if 'dro' in rules_by_topic and len(rules_by_topic['dro']) > 0:
            tree = self.build_tree_from_rules(all_rules, topic="dro_eligibility")
            logger.info(f"Built DRO eligibility tree with {len(rules_by_topic['dro'])} DRO-specific rules")
        
        if 'bankruptcy' in rules_by_topic and len(rules_by_topic['bankruptcy']) > 0:
            tree = self.build_tree_from_rules(all_rules, topic="bankruptcy_eligibility")
            logger.info(f"Built bankruptcy eligibility tree with {len(rules_by_topic['bankruptcy'])} bankruptcy-specific rules")
        
        if 'iva' in rules_by_topic and len(rules_by_topic['iva']) > 0:
            tree = self.build_tree_from_rules(all_rules, topic="iva_eligibility")
            logger.info(f"Built IVA eligibility tree with {len(rules_by_topic['iva'])} IVA-specific rules")
        
        # Build general tree with all rules if we didn't build topic-specific ones
        if not self.trees:
            tree = self.build_tree_from_rules(all_rules, topic="dro_eligibility")
            logger.warning("No topic-specific trees built, created general dro_eligibility tree")
        
        logger.info(f"Total trees built: {len(self.trees)}, strategies: {len(all_strategies)}, near-miss rules: {len(self.near_miss_rules)}")
    
    def get_advice(self, client_values: Dict[str, float], topic: str = "dro_eligibility") -> Dict[str, Any]:
        """
        Get eligibility advice for a client.
        
        Returns:
        - Eligibility result
        - Path through decision tree
        - Near-miss detections
        - Remediation strategies
        """
        tree = self.trees.get(topic)
        if not tree:
            return {
                'result': 'no_tree',
                'message': 'No decision tree available for this topic'
            }
        
        path = self.traverse_tree(tree, client_values)
        
        # Format response
        response = {
            'result': path.final_result,
            'confidence': path.confidence,
            'decisions': path.decisions,
            'near_misses': [
                {
                    'threshold_name': nm.threshold_name,
                    'threshold_value': nm.threshold_value,
                    'tolerance': nm.tolerance_absolute
                }
                for nm in path.near_misses
            ],
            'strategies': [
                {
                    'description': s.description,
                    'actions': s.actions,
                    'likelihood': s.likelihood,
                    'source': s.source
                }
                for s in path.strategies
            ]
        }
        
        return response
    
    def visualize_tree(self, topic: str = "dro_eligibility") -> str:
        """Generate a text visualization of the decision tree"""
        tree = self.trees.get(topic)
        if not tree:
            return "No tree available"
        
        lines = []
        self._visualize_node(tree, lines, depth=0, prefix="")
        return "\n".join(lines)
    
    def _visualize_node(self, node: DecisionNode, lines: List[str], depth: int, prefix: str):
        """Recursively visualize tree structure"""
        indent = "  " * depth
        
        if node.type == NodeType.CONDITION:
            lines.append(f"{indent}{prefix}❓ {node.variable} {node.operator.value} £{node.threshold}")
            if node.near_miss_branch:
                self._visualize_node(node.near_miss_branch, lines, depth + 1, "~NEAR~ ")
            if node.true_branch:
                self._visualize_node(node.true_branch, lines, depth + 1, "✓ YES → ")
            if node.false_branch:
                self._visualize_node(node.false_branch, lines, depth + 1, "✗ NO → ")
        
        elif node.type == NodeType.RESULT:
            emoji = "✅" if node.result == "eligible" else "❌" if node.result == "not_eligible" else "⚠️"
            lines.append(f"{indent}{prefix}{emoji} {node.result.upper()}")
        
        elif node.type == NodeType.NEAR_MISS:
            lines.append(f"{indent}{prefix}⚠️  NEAR MISS - {len(node.near_miss_info.strategies)} strategies available")
