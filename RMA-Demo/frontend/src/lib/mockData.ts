/**
 * Mock Data for Testing Graph Components
 * All entity types must match EntityType enum from graph.types.ts
 */

import { DocumentGraph, ApplicableRule, Entity, Relationship } from '@/types/graph.types';

/**
 * Mock Manual Graph - Knowledge base for rules and guidelines
 */
export const mockManualGraph: DocumentGraph = {
  graph_id: 'manual-graph-001',
  document_id: 'manual-tax-rules.md',
  entities: [
    {
      id: 'entity-1',
      text: 'Income Tax Allowance',
      entity_type: 'MONEY_THRESHOLD',
      confidence: 0.95,
      source: 'manual-tax-rules',
    },
    {
      id: 'entity-2',
      text: 'Personal Savings Account',
      entity_type: 'ORGANIZATION',
      confidence: 0.92,
      source: 'manual-tax-rules',
    },
    {
      id: 'entity-3',
      text: 'Marriage Allowance Rule',
      entity_type: 'RULE',
      confidence: 0.98,
      source: 'manual-tax-rules',
    },
  ],
  relationships: [
    {
      entity1: 'entity-1',
      entity2: 'entity-2',
      type: 'AFFECTS_REPAYMENT',
      confidence: 0.88,
      label: 'affects',
    },
  ],
  statistics: {
    entity_count: 3,
    relationship_count: 1,
    average_confidence: 0.93,
    entity_types: {
      DEBT_TYPE: 0,
      CREDITOR: 0,
      MONEY_THRESHOLD: 1,
      REPAYMENT_TERM: 0,
      DURATION: 0,
      OBLIGATION: 0,
      RULE: 1,
      GATE: 0,
      LEGAL_STATUS: 0,
      CLIENT_ATTRIBUTE: 0,
      PERSON: 0,
      ORGANIZATION: 1,
      DATE: 0,
      MONEY: 0,
      PERCENT: 0,
      LOCATION: 0,
    },
  },
};


/**
 * Mock Applicable Rules - Rules that apply to client situation
 */
export const mockApplicableRules: ApplicableRule[] = [
  {
    rule_id: 'rule-001',
    rule_text: 'Marriage Allowance allows transfer of unused allowance to spouse',
    reasoning: 'Client is married and has lower income',
    confidence: 0.95,
    matched_entities: [
      {
        client_entity_id: 'client-entity-4',
        manual_entity_id: 'entity-3',
        match_type: 'EXACT',
      },
    ],
    temporal_status: 'ACTIVE',
    temporal_metadata: {
      effective_date: '2024-01-01',
    },
  },
  {
    rule_id: 'rule-002',
    rule_text: 'Savings Interest Allowance up to £1,000 tax-free',
    reasoning: 'Client has substantial savings that generate interest',
    confidence: 0.91,
    matched_entities: [
      {
        client_entity_id: 'client-entity-3',
        manual_entity_id: 'entity-2',
        match_type: 'SEMANTIC',
      },
    ],
    temporal_status: 'ACTIVE',
    temporal_metadata: {
      effective_date: '2024-01-01',
    },
  },
  {
    rule_id: 'rule-003',
    rule_text: 'Spouse Exemption on gifts provides unlimited gifting between spouses',
    reasoning: 'Client is married, enabling spouse exemption benefits',
    confidence: 0.97,
    matched_entities: [
      {
        client_entity_id: 'client-entity-4',
        manual_entity_id: 'entity-3',
        match_type: 'EXACT',
      },
    ],
    temporal_status: 'ACTIVE',
  },
];



/**
 * Mock Client Graph - Client's specific financial situation
 */
export const mockClientGraph: DocumentGraph = {
  graph_id: 'client-graph-001',
  document_id: 'client-123-facts.md',
  entities: [
    {
      id: 'client-entity-1',
      text: 'John Smith',
      entity_type: 'PERSON',
      confidence: 0.99,
      source: 'client-upload',
    },
    {
      id: 'client-entity-2',
      text: '£50,000',
      entity_type: 'MONEY',
      confidence: 0.96,
      source: 'client-upload',
    },
    {
      id: 'client-entity-3',
      text: '£200,000 Savings',
      entity_type: 'MONEY',
      confidence: 0.94,
      source: 'client-upload',
    },
    {
      id: 'client-entity-4',
      text: 'Married',
      entity_type: 'CLIENT_ATTRIBUTE',
      confidence: 0.98,
      source: 'client-upload',
    },
  ],
  relationships: [
    {
      entity1: 'client-entity-1',
      entity2: 'client-entity-2',
      type: 'PART_OF',
      confidence: 0.97,
      label: 'has income',
    },
    {
      entity1: 'client-entity-1',
      entity2: 'client-entity-3',
      type: 'PART_OF',
      confidence: 0.95,
      label: 'has savings',
    },
  ],
  statistics: {
    entity_count: 4,
    relationship_count: 2,
    average_confidence: 0.96,
    entity_types: {
      DEBT_TYPE: 0,
      OBLIGATION: 0,
      RULE: 0,
      GATE: 0,
      MONEY_THRESHOLD: 0,
      CREDITOR: 0,
      REPAYMENT_TERM: 0,
      LEGAL_STATUS: 0,
      CLIENT_ATTRIBUTE: 1,
      PERSON: 1,
      ORGANIZATION: 0,
      DATE: 0,
      MONEY: 2,
      PERCENT: 0,
      LOCATION: 0,
      DURATION: 0,
    },
  },
};

// Mock Relationships for testing
export const mockRelationships: Relationship[] = [
  {
    entity1: 'entity-1',
    entity2: 'entity-2',
    type: 'AFFECTS_REPAYMENT',
    confidence: 0.88,
    label: 'affects',
  },
  {
    entity1: 'client-entity-1',
    entity2: 'client-entity-2',
    type: 'PART_OF',
    confidence: 0.97,
    label: 'has income',
  },
];

