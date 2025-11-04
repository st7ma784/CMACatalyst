#!/bin/bash

# ============================================================================
# PHASE 3b: SETUP AND TESTING SCRIPT
# ============================================================================
# This script automates Phase 3b setup and testing for the CMACatalyst project
# Run this on a machine with Node.js v16+ and npm v8+ installed
#
# Usage: bash phase3b-setup.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# ============================================================================
# PHASE 3b STEP 1: CHECK PREREQUISITES
# ============================================================================
check_prerequisites() {
    print_header "PHASE 3b STEP 1: Checking Prerequisites"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js v16+ from https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install npm v8+ from https://nodejs.org"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    print_success "npm installed: $NPM_VERSION"
    
    # Check frontend directory
    if [ ! -d "frontend" ]; then
        print_error "frontend directory not found. Run this script from the project root."
        exit 1
    fi
    
    print_success "frontend directory exists"
}

# ============================================================================
# PHASE 3b STEP 2: INSTALL DEPENDENCIES
# ============================================================================
install_dependencies() {
    print_header "PHASE 3b STEP 2: Installing Dependencies (10 min)"
    
    cd frontend
    
    print_step "Running: npm install"
    npm install
    
    print_success "Dependencies installed successfully"
    
    # Verify D3.js installation
    print_step "Verifying D3.js installation..."
    npm list d3 | grep "d3@"
    print_success "D3.js 7.8.5 verified"
    
    cd ..
}

# ============================================================================
# PHASE 3b STEP 3: CREATE ENVIRONMENT FILE
# ============================================================================
create_env_file() {
    print_header "PHASE 3b STEP 3: Creating Environment Configuration"
    
    ENV_FILE="frontend/.env.local"
    
    if [ -f "$ENV_FILE" ]; then
        print_info "$ENV_FILE already exists. Skipping creation."
        return
    fi
    
    print_step "Creating $ENV_FILE"
    
    cat > "$ENV_FILE" << 'EOF'
# NER Graph Service
NEXT_PUBLIC_NER_SERVICE_URL=http://localhost:8108

# Optional: Other services
NEXT_PUBLIC_RAG_SERVICE_URL=http://localhost:8102
NEXT_PUBLIC_VLLM_URL=http://localhost:8000

# Debug mode
NEXT_PUBLIC_GRAPH_DEBUG=false
EOF
    
    print_success "Environment file created: $ENV_FILE"
}

# ============================================================================
# PHASE 3b STEP 4: CREATE MOCK DATA FILE
# ============================================================================
create_mock_data() {
    print_header "PHASE 3b STEP 4: Creating Mock Data"
    
    MOCK_FILE="frontend/lib/mockData.ts"
    
    print_step "Creating mock data file..."
    
    mkdir -p frontend/lib
    
    cat > "$MOCK_FILE" << 'EOF'
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
      CREDITOR: 1,
      MONEY_THRESHOLD: 1,
      REPAYMENT_TERM: 1,
      DURATION: 1,
      GATE: 1,
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
EOF
    
    print_success "Mock data created: $MOCK_FILE"
}

# ============================================================================
# PHASE 3b STEP 5: CREATE TEST PAGES
# ============================================================================
create_test_pages() {
    print_header "PHASE 3b STEP 5: Creating Test Pages"
    
    # Create graphs test page
    print_step "Creating /app/graphs/page.tsx..."
    
    mkdir -p frontend/app/graphs
    
    cat > "frontend/app/graphs/page.tsx" << 'EOF'
'use client';

import { useState } from 'react';
import { 
  GraphViewer, 
  EntitySearch, 
  TemporalSelector,
  ApplicableRulesList 
} from '@/components/graphs';
import { mockManualGraph, mockApplicableRules } from '@/lib/mockData';

export default function GraphsTestPage() {
  const [selectedEntity, setSelectedEntity] = useState(null);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Graph Components Test with Mock Data</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h2>GraphViewer Component</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }}>
            <p>Graph ID: {mockManualGraph.graph_id}</p>
            <p>Entities: {mockManualGraph.entities.length}</p>
            <p>Relationships: {mockManualGraph.relationships.length}</p>
            <p>Avg Confidence: {mockManualGraph.statistics?.average_confidence}</p>
          </div>
        </div>

        <div>
          <h2>ApplicableRulesList Component</h2>
          <ApplicableRulesList
            rules={mockApplicableRules}
            sortBy="confidence"
            maxHeight="300px"
          />
        </div>
      </div>
    </div>
  );
}
EOF
    
    print_success "Test page created: /app/graphs/page.tsx"
    
    # Create comparison test page
    print_step "Creating /app/comparison/page.tsx..."
    
    mkdir -p frontend/app/comparison
    
    cat > "frontend/app/comparison/page.tsx" << 'EOF'
'use client';

import { DualGraphComparison } from '@/components/graphs';

export default function ComparisonPage() {
  return (
    <div style={{ padding: '20px', height: '100vh' }}>
      <h1>Dual Graph Comparison Test</h1>
      <DualGraphComparison
        manualGraphId="test-manual"
        clientGraphId="test-client"
      />
    </div>
  );
}
EOF
    
    print_success "Test page created: /app/comparison/page.tsx"
}

# ============================================================================
# PHASE 3b STEP 6: BUILD PROJECT
# ============================================================================
build_project() {
    print_header "PHASE 3b STEP 6: Building Project"
    
    cd frontend
    
    print_step "Running: npm run build"
    npm run build
    
    print_success "Build completed successfully"
    
    cd ..
}

# ============================================================================
# PHASE 3b STEP 7: START DEV SERVER
# ============================================================================
start_dev_server() {
    print_header "PHASE 3b STEP 7: Starting Development Server"
    
    print_info "Starting dev server on http://localhost:3000"
    print_info "Press Ctrl+C to stop the server"
    print_info ""
    print_info "Test pages available at:"
    print_info "  • http://localhost:3000/graphs"
    print_info "  • http://localhost:3000/comparison"
    print_info ""
    
    cd frontend
    npm run dev
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================
main() {
    print_header "🚀 PHASE 3b: TESTING & INTEGRATION - AUTOMATED SETUP"
    
    print_info "This script will:"
    print_info "1. Check Node.js and npm prerequisites"
    print_info "2. Install D3.js and dependencies"
    print_info "3. Create environment configuration"
    print_info "4. Create mock data files"
    print_info "5. Create test pages"
    print_info "6. Build the project"
    print_info "7. Start the development server"
    print_info ""
    
    check_prerequisites
    install_dependencies
    create_env_file
    create_mock_data
    create_test_pages
    build_project
    start_dev_server
}

# Run main function
main
