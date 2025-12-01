import {
  DocumentGraph,
  Entity,
  Relationship,
  ApplicableRule,
} from '@/types/graph.types';

export const mockEntities: Entity[] = [
  {
    id: 'ent-1',
    text: 'Debt Relief Order',
    entity_type: 'DEBT_TYPE',
    confidence: 0.98,
    source: 'manual-1',
  },
  {
    id: 'ent-2',
    text: 'Credit Union',
    entity_type: 'CREDITOR',
    confidence: 0.92,
    source: 'manual-1',
  },
  {
    id: 'ent-3',
    text: '£15,000',
    entity_type: 'MONEY_THRESHOLD',
    confidence: 0.99,
    source: 'manual-1',
  },
  {
    id: 'ent-4',
    text: 'Interest Rate',
    entity_type: 'REPAYMENT_TERM',
    confidence: 0.87,
    source: 'manual-1',
  },
  {
    id: 'ent-5',
    text: '12 months',
    entity_type: 'DURATION',
    confidence: 0.95,
    source: 'manual-1',
  },
  {
    id: 'ent-6',
    text: 'AND Logic Gate',
    entity_type: 'GATE',
    confidence: 0.99,
    source: 'manual-1',
  },
];

export const mockRelationships: Relationship[] = [
  {
    entity1: 'ent-1',
    entity2: 'ent-2',
    type: 'APPLICABLE_TO',
    confidence: 0.91,
    label: 'DRO applies to credit unions',
  },
  {
    entity1: 'ent-2',
    entity2: 'ent-3',
    type: 'HAS_GATE',
    confidence: 0.88,
    condition: 'debt_amount < 15000',
  },
  {
    entity1: 'ent-3',
    entity2: 'ent-4',
    type: 'TRIGGERS',
    confidence: 0.85,
    label: 'Threshold triggers repayment terms',
  },
  {
    entity1: 'ent-4',
    entity2: 'ent-5',
    type: 'REQUIRES',
    confidence: 0.92,
    label: 'Repayment term requires duration',
  },
  {
    entity1: 'ent-6',
    entity2: 'ent-1',
    type: 'ENABLES',
    confidence: 0.89,
    condition: 'gate_status = true',
  },
];

export const mockManualGraph: DocumentGraph = {
  graph_id: 'g-manual-test',
  document_id: 'doc-manual',
  entities: mockEntities,
  relationships: mockRelationships,
  created_at: new Date().toISOString(),
  statistics: {
    entity_count: mockEntities.length,
    relationship_count: mockRelationships.length,
    average_confidence: 0.92,
    entity_types: {
      DEBT_TYPE: 1,
      OBLIGATION: 0,
      RULE: 1,
      GATE: 1,
      MONEY_THRESHOLD: 1,
      CREDITOR: 1,
      REPAYMENT_TERM: 1,
      LEGAL_STATUS: 0,
      CLIENT_ATTRIBUTE: 0,
      PERSON: 0,
      ORGANIZATION: 0,
      DATE: 0,
      MONEY: 1,
      PERCENT: 0,
      LOCATION: 0,
      DURATION: 1,
    },
  },
};

export const mockApplicableRules: ApplicableRule[] = [
  {
    rule_id: 'rule-1',
    rule_text: 'A Debt Relief Order applies when total debt is below £15,000',
    reasoning: 'This matches the client situation where total debt is £12,500',
    confidence: 0.95,
    matched_entities: [
      {
        client_entity_id: 'client-debt-total',
        manual_entity_id: 'ent-3',
        match_type: 'SEMANTIC',
      },
    ],
    temporal_status: 'ACTIVE',
    temporal_metadata: {
      effective_date: '2020-06-01',
      expiry_date: '2030-12-31',
      as_of_date: new Date().toISOString().split('T')[0],
    },
    gates: [
      {
        gate_type: 'AND',
        condition: 'debt < 15000 AND residence = UK',
        satisfied: true,
      },
    ],
  },
  {
    rule_id: 'rule-2',
    rule_text: 'Creditor must be notified within 3 days',
    reasoning: 'Standard procedure for DRO applications',
    confidence: 0.88,
    matched_entities: [
      {
        client_entity_id: 'client-creditor',
        manual_entity_id: 'ent-2',
        match_type: 'EXACT',
      },
    ],
    temporal_status: 'ACTIVE',
    gates: [],
  },
];
