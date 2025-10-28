"""
Decision Tree Visualizer for Financial Strategy Flows

Generates visual diagrams showing:
- Decision flows for different debt solutions (DRO, Bankruptcy, IVA)
- Near-miss scenarios highlighted
- Alternative routes when close to thresholds
- Export formats: Mermaid, GraphViz, SVG, JSON
"""

import logging
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
from decision_tree_builder import DecisionNode, NodeType, Operator, DecisionTreeBuilder, DecisionPath

logger = logging.getLogger(__name__)


@dataclass
class VisualizationConfig:
    """Configuration for diagram generation"""
    show_near_misses: bool = True
    show_thresholds: bool = True
    show_confidence: bool = True
    highlight_path: Optional[List[str]] = None  # IDs of nodes to highlight
    color_scheme: str = "default"  # "default", "colorblind", "monochrome"
    format: str = "mermaid"  # "mermaid", "graphviz", "json"


class TreeVisualizer:
    """
    Generates visual representations of decision trees.
    
    Supports multiple output formats for different use cases:
    - Mermaid: For web embedding (GitHub, documentation)
    - GraphViz: For high-quality PDF/SVG export
    - JSON: For custom visualizations
    """
    
    def __init__(self, decision_tree_builder: DecisionTreeBuilder):
        self.builder = decision_tree_builder
        self.color_schemes = {
            "default": {
                "pass": "#90EE90",      # Light green
                "fail": "#FFB6C1",      # Light red
                "near_miss": "#FFD700", # Gold
                "condition": "#87CEEB", # Sky blue
                "eligible": "#228B22",  # Forest green
                "not_eligible": "#DC143C", # Crimson
                "review": "#FFA500"     # Orange
            },
            "colorblind": {
                "pass": "#0173B2",
                "fail": "#DE8F05",
                "near_miss": "#CC78BC",
                "condition": "#029E73",
                "eligible": "#0173B2",
                "not_eligible": "#DE8F05",
                "review": "#CC78BC"
            },
            "monochrome": {
                "pass": "#E0E0E0",
                "fail": "#606060",
                "near_miss": "#A0A0A0",
                "condition": "#C0C0C0",
                "eligible": "#404040",
                "not_eligible": "#808080",
                "review": "#909090"
            }
        }
    
    def generate_mermaid(self, topic: str = "dro_eligibility", config: Optional[VisualizationConfig] = None) -> str:
        """
        Generate Mermaid flowchart syntax.
        
        Mermaid is ideal for:
        - GitHub README.md files
        - Documentation sites
        - Live preview in VS Code
        
        Returns:
            Mermaid markdown that can be embedded in ```mermaid blocks
        """
        if config is None:
            config = VisualizationConfig()
        
        tree = self.builder.trees.get(topic)
        if not tree:
            return "graph TD\n    A[No decision tree available]"
        
        colors = self.color_schemes.get(config.color_scheme, self.color_schemes["default"])
        
        lines = ["graph TD"]
        visited = set()
        
        self._add_mermaid_node(tree, lines, visited, config, colors)
        
        # Add legend
        if config.show_near_misses:
            lines.append("\n    %% Legend")
            lines.append("    legend_pass[✓ Condition Met]:::pass_style")
            lines.append("    legend_fail[✗ Condition Failed]:::fail_style")
            lines.append("    legend_near[≈ Near Miss]:::near_style")
            lines.append("\n    %% Styles")
            lines.append(f"    classDef pass_style fill:{colors['pass']},stroke:#333,stroke-width:2px")
            lines.append(f"    classDef fail_style fill:{colors['fail']},stroke:#333,stroke-width:2px")
            lines.append(f"    classDef near_style fill:{colors['near_miss']},stroke:#333,stroke-width:4px")
            lines.append(f"    classDef eligible_style fill:{colors['eligible']},stroke:#333,stroke-width:3px,color:#fff")
            lines.append(f"    classDef not_eligible_style fill:{colors['not_eligible']},stroke:#333,stroke-width:3px,color:#fff")
        
        return "\n".join(lines)
    
    def _add_mermaid_node(self, node: DecisionNode, lines: List[str], visited: Set[str], 
                          config: VisualizationConfig, colors: Dict[str, str], depth: int = 0):
        """Recursively add Mermaid nodes"""
        if node.id in visited:
            return
        visited.add(node.id)
        
        # Format node label
        if node.type == NodeType.CONDITION:
            label = f"{node.variable} {node.operator.value} £{node.threshold:,.0f}"
            shape = "{" + label + "}"  # Diamond for decisions
            style_class = "condition"
        elif node.type == NodeType.RESULT:
            if node.result == "eligible":
                label = "✅ ELIGIBLE"
                style_class = "eligible_style"
            elif node.result == "not_eligible":
                label = "❌ NOT ELIGIBLE"
                style_class = "not_eligible_style"
            else:
                label = f"⚠️ {node.result.upper()}"
                style_class = "review"
            shape = "[" + label + "]"  # Rectangle for results
        elif node.type == NodeType.NEAR_MISS:
            label = f"≈ Near Miss: {node.near_miss_info.threshold_name}"
            shape = "(" + label + ")"  # Rounded for near-miss
            style_class = "near_style"
        else:
            label = "Unknown"
            shape = "[" + label + "]"
            style_class = "default"
        
        # Add node definition
        node_def = f"    {node.id}{shape}"
        if style_class and node.type != NodeType.CONDITION:
            node_def += f":::{style_class}"
        lines.append(node_def)
        
        # Add edges
        if node.type == NodeType.CONDITION:
            if config.show_near_misses and node.near_miss_branch and node.near_miss_info:
                tolerance = node.near_miss_info.tolerance_absolute or 0
                lines.append(f"    {node.id} -->|≈ Within £{tolerance:,.0f}| {node.near_miss_branch.id}")
                self._add_mermaid_node(node.near_miss_branch, lines, visited, config, colors, depth + 1)
            
            if node.true_branch:
                lines.append(f"    {node.id} -->|✓ YES| {node.true_branch.id}")
                self._add_mermaid_node(node.true_branch, lines, visited, config, colors, depth + 1)
            
            if node.false_branch:
                lines.append(f"    {node.id} -->|✗ NO| {node.false_branch.id}")
                self._add_mermaid_node(node.false_branch, lines, visited, config, colors, depth + 1)
    
    def generate_graphviz(self, topic: str = "dro_eligibility", config: Optional[VisualizationConfig] = None) -> str:
        """
        Generate GraphViz DOT format.
        
        GraphViz produces publication-quality diagrams:
        - Convert to PDF: dot -Tpdf tree.dot -o tree.pdf
        - Convert to SVG: dot -Tsvg tree.dot -o tree.svg
        - Convert to PNG: dot -Tpng tree.dot -o tree.png
        
        Returns:
            DOT language diagram specification
        """
        if config is None:
            config = VisualizationConfig()
        
        tree = self.builder.trees.get(topic)
        if not tree:
            return "digraph G { label=\"No decision tree available\"; }"
        
        colors = self.color_schemes.get(config.color_scheme, self.color_schemes["default"])
        
        lines = [
            "digraph DecisionTree {",
            "    rankdir=TB;",
            "    node [style=filled, fontname=\"Arial\"];",
            "    edge [fontname=\"Arial\"];",
            f"    label=\"{topic.replace('_', ' ').title()} Decision Flow\";",
            "    labelloc=t;",
            "    fontsize=20;",
            ""
        ]
        
        visited = set()
        self._add_graphviz_node(tree, lines, visited, config, colors)
        
        lines.append("}")
        return "\n".join(lines)
    
    def _add_graphviz_node(self, node: DecisionNode, lines: List[str], visited: Set[str],
                           config: VisualizationConfig, colors: Dict[str, str]):
        """Recursively add GraphViz nodes"""
        if node.id in visited:
            return
        visited.add(node.id)
        
        # Format node
        if node.type == NodeType.CONDITION:
            label = f"{node.variable}\\n{node.operator.value} £{node.threshold:,.0f}"
            lines.append(f"    {node.id} [label=\"{label}\", shape=diamond, fillcolor=\"{colors['condition']}\"];")
        elif node.type == NodeType.RESULT:
            if node.result == "eligible":
                label = "✓ ELIGIBLE"
                color = colors['eligible']
            elif node.result == "not_eligible":
                label = "✗ NOT ELIGIBLE"
                color = colors['not_eligible']
            else:
                label = f"⚠ {node.result.upper()}"
                color = colors['review']
            lines.append(f"    {node.id} [label=\"{label}\", shape=box, fillcolor=\"{color}\", fontcolor=white];")
        elif node.type == NodeType.NEAR_MISS:
            tolerance = node.near_miss_info.tolerance_absolute if node.near_miss_info else 0
            label = f"≈ Near Miss\\n±£{tolerance:,.0f}"
            lines.append(f"    {node.id} [label=\"{label}\", shape=ellipse, fillcolor=\"{colors['near_miss']}\", penwidth=3];")
        
        # Add edges
        if node.type == NodeType.CONDITION:
            if config.show_near_misses and node.near_miss_branch:
                lines.append(f"    {node.id} -> {node.near_miss_branch.id} [label=\"Near\", color=\"{colors['near_miss']}\", penwidth=2];")
                self._add_graphviz_node(node.near_miss_branch, lines, visited, config, colors)
            
            if node.true_branch:
                lines.append(f"    {node.id} -> {node.true_branch.id} [label=\"YES\", color=\"{colors['pass']}\"];")
                self._add_graphviz_node(node.true_branch, lines, visited, config, colors)
            
            if node.false_branch:
                lines.append(f"    {node.id} -> {node.false_branch.id} [label=\"NO\", color=\"{colors['fail']}\"];")
                self._add_graphviz_node(node.false_branch, lines, visited, config, colors)
    
    def generate_path_diagram(self, client_values: Dict[str, float], topic: str = "dro_eligibility",
                              config: Optional[VisualizationConfig] = None) -> Dict:
        """
        Generate a diagram highlighting the specific path for a client.
        
        Shows:
        - The exact route taken through the decision tree
        - Near-miss branches that were close
        - Alternative strategies if applicable
        
        Returns:
            Dictionary with diagram and metadata
        """
        if config is None:
            config = VisualizationConfig()
        
        # Get the decision path
        path = self.builder.traverse_tree(self.builder.trees.get(topic), client_values)
        
        # Highlight the nodes in the path
        config.highlight_path = [node.id for node in path.nodes]
        
        # Generate diagram with highlighted path
        if config.format == "mermaid":
            diagram = self.generate_mermaid(topic, config)
        elif config.format == "graphviz":
            diagram = self.generate_graphviz(topic, config)
        else:
            diagram = self.generate_json(topic, path)
        
        return {
            "diagram": diagram,
            "format": config.format,
            "result": path.final_result,
            "confidence": path.confidence,
            "near_misses": [
                {
                    "threshold": nm.threshold_name,
                    "value": nm.threshold_value,
                    "tolerance": nm.tolerance_absolute,
                    "strategies": [
                        {
                            "description": s.description,
                            "actions": s.actions,
                            "likelihood": s.likelihood
                        }
                        for s in nm.strategies
                    ]
                }
                for nm in path.near_misses
            ],
            "decisions_made": [
                {
                    "variable": d.get("variable"),
                    "client_value": d.get("client_value"),
                    "threshold": d.get("threshold"),
                    "result": d.get("result", d.get("decision"))
                }
                for d in path.decisions
            ]
        }
    
    def generate_json(self, topic: str = "dro_eligibility", path: Optional[DecisionPath] = None) -> Dict:
        """
        Generate JSON representation for custom visualizations.
        
        Useful for:
        - Building custom web UIs
        - Integration with charting libraries (D3.js, Chart.js)
        - Mobile apps
        
        Returns:
            Hierarchical JSON structure
        """
        tree = self.builder.trees.get(topic)
        if not tree:
            return {"error": "No tree available"}
        
        def node_to_dict(node: DecisionNode, path_nodes: Set[str] = None) -> Dict:
            """Convert node to dictionary"""
            if path_nodes is None:
                path_nodes = set()
            
            result = {
                "id": node.id,
                "type": node.type.value,
                "on_path": node.id in path_nodes
            }
            
            if node.type == NodeType.CONDITION:
                result.update({
                    "variable": node.variable,
                    "operator": node.operator.value,
                    "threshold": node.threshold,
                    "threshold_name": node.threshold_name
                })
                
                if node.near_miss_branch:
                    result["near_miss"] = node_to_dict(node.near_miss_branch, path_nodes)
                if node.true_branch:
                    result["true_branch"] = node_to_dict(node.true_branch, path_nodes)
                if node.false_branch:
                    result["false_branch"] = node_to_dict(node.false_branch, path_nodes)
            
            elif node.type == NodeType.RESULT:
                result.update({
                    "result": node.result,
                    "confidence": node.confidence,
                    "explanation": node.explanation
                })
            
            elif node.type == NodeType.NEAR_MISS:
                result.update({
                    "threshold_info": {
                        "name": node.near_miss_info.threshold_name,
                        "value": node.near_miss_info.threshold_value,
                        "tolerance": node.near_miss_info.tolerance_absolute
                    },
                    "strategies_count": len(node.near_miss_info.strategies)
                })
            
            return result
        
        path_node_ids = set()
        if path:
            path_node_ids = {n.id for n in path.nodes}
        
        return {
            "topic": topic,
            "tree": node_to_dict(tree, path_node_ids),
            "statistics": {
                "total_nodes": len(self._count_nodes(tree)),
                "near_miss_rules": len(self.builder.near_miss_rules),
                "remediation_strategies": sum(len(s) for s in self.builder.remediation_patterns.values())
            }
        }
    
    def _count_nodes(self, node: DecisionNode, visited: Set[str] = None) -> Set[str]:
        """Count total nodes in tree"""
        if visited is None:
            visited = set()
        
        if node.id in visited:
            return visited
        
        visited.add(node.id)
        
        if node.type == NodeType.CONDITION:
            if node.near_miss_branch:
                self._count_nodes(node.near_miss_branch, visited)
            if node.true_branch:
                self._count_nodes(node.true_branch, visited)
            if node.false_branch:
                self._count_nodes(node.false_branch, visited)
        
        return visited
    
    def generate_comparison_diagram(self, topics: List[str], config: Optional[VisualizationConfig] = None) -> Dict:
        """
        Generate a comparison diagram showing multiple debt solution strategies.
        
        Useful for advisors to show clients:
        - DRO vs Bankruptcy vs IVA
        - Which route is closest to eligibility
        - Near-misses for each option
        
        Returns:
            Dictionary with comparison data and diagrams
        """
        if config is None:
            config = VisualizationConfig()
        
        comparisons = {}
        
        for topic in topics:
            tree = self.builder.trees.get(topic)
            if tree:
                comparisons[topic] = {
                    "diagram": self.generate_mermaid(topic, config),
                    "json": self.generate_json(topic),
                    "near_miss_count": len([
                        rule for rule in self.builder.near_miss_rules
                        if topic.split('_')[0] in rule.threshold_name.lower()
                    ])
                }
        
        return {
            "comparisons": comparisons,
            "total_topics": len(comparisons)
        }
    
    def export_for_advisor(self, client_values: Dict[str, float], topic: str = "dro_eligibility") -> Dict:
        """
        Generate advisor-friendly export with all relevant information.
        
        Includes:
        - Decision path diagram
        - Near-miss opportunities
        - Remediation strategies
        - Alternative debt solutions
        
        Returns:
            Complete package for advisor consultation
        """
        # Get path with highlighting
        path_diagram = self.generate_path_diagram(client_values, topic, VisualizationConfig(format="mermaid"))
        
        # Get GraphViz for printing
        graphviz_diagram = self.generate_graphviz(topic)
        
        # Get detailed JSON
        tree = self.builder.trees.get(topic)
        path = self.builder.traverse_tree(tree, client_values)
        json_data = self.generate_json(topic, path)
        
        return {
            "client_values": client_values,
            "topic": topic,
            "result": path.final_result,
            "confidence": path.confidence,
            
            # Visual diagrams
            "diagrams": {
                "mermaid": path_diagram["diagram"],
                "graphviz": graphviz_diagram,
                "json": json_data
            },
            
            # Decision details
            "decisions": path_diagram["decisions_made"],
            
            # Near-miss opportunities
            "near_misses": path_diagram["near_misses"],
            
            # Recommendations
            "recommendations": self._generate_recommendations(path, client_values)
        }
    
    def _generate_recommendations(self, path: DecisionPath, client_values: Dict[str, float]) -> List[Dict]:
        """Generate actionable recommendations based on near-misses"""
        recommendations = []
        
        for nm in path.near_misses:
            for strategy in nm.strategies:
                recommendations.append({
                    "type": "near_miss_strategy",
                    "threshold": nm.threshold_name,
                    "gap": "Close to limit",
                    "action": strategy.description,
                    "steps": strategy.actions,
                    "likelihood": strategy.likelihood,
                    "priority": "high" if strategy.likelihood == "high" else "medium"
                })
        
        # Add gap-specific recommendations
        for decision in path.decisions:
            if isinstance(decision, dict) and "gap" in decision:
                variable = decision.get("variable")
                gap = decision.get("gap")
                
                if gap and abs(gap) < 5000:  # Within £5k
                    recommendations.append({
                        "type": "close_to_threshold",
                        "variable": variable,
                        "gap_amount": gap,
                        "action": f"Reduce {variable} by £{abs(gap):,.2f} to qualify",
                        "priority": "high"
                    })
        
        return recommendations
