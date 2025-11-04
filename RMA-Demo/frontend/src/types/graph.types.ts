/**
 * Graph Type Definitions
 * Defines all TypeScript interfaces for graph visualization components
 * Phase 3: Frontend Graph Visualization
 */

// Entity Types - 15 types supported
export type EntityType =
  | 'DEBT_TYPE'
  | 'OBLIGATION'
  | 'RULE'
  | 'GATE'
  | 'MONEY_THRESHOLD'
  | 'CREDITOR'
  | 'REPAYMENT_TERM'
  | 'LEGAL_STATUS'
  | 'CLIENT_ATTRIBUTE'
  | 'PERSON'
  | 'ORGANIZATION'
  | 'DATE'
  | 'MONEY'
  | 'PERCENT'
  | 'LOCATION'
  | 'DURATION';

// Relationship Types - 13 types supported
export type RelationshipType =
  | 'IS_A'
  | 'PART_OF'
  | 'SYNONYMOUS'
  | 'TRIGGERS'
  | 'REQUIRES'
  | 'BLOCKS'
  | 'FOLLOWS'
  | 'AFFECTS_REPAYMENT'
  | 'HAS_GATE'
  | 'CONTRADICTS'
  | 'EXTENDS'
  | 'APPLICABLE_TO'
  | 'ENABLES'
  | 'RESTRICTS';

/**
 * Entity: Extracted entity from document with metadata
 */
export interface Entity {
  id: string;
  text: string;
  entity_type: EntityType;
  confidence: number; // 0.0 - 1.0
  source: string; // document_id or manual reference
  metadata?: {
    [key: string]: any;
  };
  position?: {
    x: number;
    y: number;
  };
}

/**
 * Relationship: Connection between two entities with temporal metadata
 */
export interface Relationship {
  entity1: string; // entity1 ID
  entity2: string; // entity2 ID
  type: RelationshipType;
  confidence?: number; // 0.0 - 1.0
  condition?: string; // e.g., "IF creditor_type = 'bank'"
  temporal?: {
    effective_date?: string;
    expiry_date?: string;
    logic_gate?: 'AND' | 'OR' | 'NOT';
  };
  label?: string; // Display label
}

/**
 * DocumentGraph: Complete graph of entities and relationships for a document
 */
export interface DocumentGraph {
  graph_id: string;
  document_id: string;
  entities: Entity[];
  relationships: Relationship[];
  created_at?: string;
  metadata?: {
    [key: string]: any;
  };
  statistics?: {
    entity_count: number;
    relationship_count: number;
    average_confidence: number;
    entity_types: { [key in EntityType]: number };
  };
}

/**
 * ApplicableRule: Rule from manual graph that applies to client situation
 */
export interface ApplicableRule {
  rule_id: string;
  rule_text: string;
  reasoning: string;
  confidence: number; // Overall match confidence 0.0 - 1.0
  matched_entities: {
    client_entity_id: string;
    manual_entity_id: string;
    match_type: 'EXACT' | 'SEMANTIC' | 'PATTERN';
  }[];
  temporal_status: 'ACTIVE' | 'EXPIRED' | 'FUTURE';
  temporal_metadata?: {
    effective_date?: string;
    expiry_date?: string;
    as_of_date?: string;
  };
  gates?: {
    gate_type: string;
    condition: string;
    satisfied: boolean;
  }[];
}

/**
 * GraphComparison: Result of comparing two graphs
 */
export interface GraphComparison {
  manual_graph_id: string;
  client_graph_id: string;
  applicable_rules: ApplicableRule[];
  gaps: string[]; // Missing attributes needed for rules
  matches: {
    manual_entity_id: string;
    client_entity_id: string;
    similarity_score: number;
  }[];
  comparison_timestamp: string;
}

/**
 * GraphViewerProps: Props for GraphViewer component
 */
export interface GraphViewerProps {
  graphId: string;
  graphType: 'manual' | 'client';
  title: string;
  editable?: boolean;
  onNodeClick?: (entity: Entity) => void;
  onEdgeClick?: (relationship: Relationship) => void;
  height?: string;
  highlightedNodes?: string[]; // Node IDs to highlight
  highlightedEdges?: string[]; // Edge IDs to highlight
}

/**
 * DualGraphComparisonProps: Props for DualGraphComparison component
 */
export interface DualGraphComparisonProps {
  manualGraphId: string;
  clientGraphId: string;
  onApplicableRuleSelect?: (rule: ApplicableRule) => void;
  onEntitySelect?: (entity: Entity) => void;
}

/**
 * EntitySearchProps: Props for EntitySearch component
 */
export interface EntitySearchProps {
  graphId: string;
  onResultSelect?: (entity: Entity) => void;
  entityTypeFilter?: EntityType[];
  placeholder?: string;
  debounceMs?: number;
}

/**
 * TemporalSelectorProps: Props for TemporalSelector component
 */
export interface TemporalSelectorProps {
  graphId: string;
  onDateChange?: (date: Date) => void;
  initialDate?: Date;
}

/**
 * ApplicableRulesListProps: Props for ApplicableRulesList component
 */
export interface ApplicableRulesListProps {
  rules: ApplicableRule[];
  onRuleClick?: (rule: ApplicableRule) => void;
  sortBy?: 'confidence' | 'temporal' | 'name';
  maxHeight?: string;
}

/**
 * GraphLegendProps: Props for GraphLegend component
 */
export interface GraphLegendProps {
  entityTypes: EntityType[];
  onEntityTypeFilter?: (types: EntityType[]) => void;
  showRelationships?: boolean;
}

/**
 * D3 Node: Internal representation for D3.js force simulation
 */
export interface D3Node extends Entity {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * D3 Link: Internal representation for D3.js links
 */
export interface D3Link extends Relationship {
  source: string | D3Node;
  target: string | D3Node;
}

/**
 * Search Result
 */
export interface SearchResult {
  entities: Entity[];
  relationships: Relationship[];
  query: string;
  total: number;
  query_time_ms: number;
}

/**
 * Graph Statistics
 */
export interface GraphStatistics {
  total_entities: number;
  total_relationships: number;
  entity_types: Record<EntityType, number>;
  relationship_types: Record<RelationshipType, number>;
  average_confidence: number;
  average_relationships_per_entity: number;
  temporal_gates_count: number;
}

/**
 * Reasoning Chain: Path through graph showing how rules lead to conclusions
 */
export interface ReasoningChain {
  start_entity: Entity;
  end_entity: Entity;
  path: Entity[];
  relationships: Relationship[];
  confidence: number;
  explanation: string;
}

/**
 * Graph Style Configuration
 */
export interface GraphStyleConfig {
  nodeRadius: number;
  linkDistance: number;
  chargeStrength: number;
  colors: {
    [key in EntityType]: string;
  };
  relationshipColors: {
    [key in RelationshipType]: string;
  };
  highlightColor: string;
  selectedColor: string;
}

/**
 * D3 Simulation Parameters
 */
export interface SimulationParams {
  nodeCharge: number;
  linkDistance: number;
  linkStrength: number;
  friction: number;
  velocityDecay: number;
}
