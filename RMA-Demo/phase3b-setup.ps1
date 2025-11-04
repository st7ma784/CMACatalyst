# ============================================================================
# PHASE 3b: SETUP AND TESTING SCRIPT (Windows PowerShell)
# ============================================================================
# This script automates Phase 3b setup and testing for the CMACatalyst project
# Run this on a machine with Node.js v16+ and npm v8+ installed
#
# Usage: powershell -ExecutionPolicy Bypass -File phase3b-setup.ps1
# ============================================================================

param(
    [switch]$SkipBuild = $false,
    [switch]$DevOnly = $false
)

# ============================================================================
# COLOR AND OUTPUT FUNCTIONS
# ============================================================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Text)
    Write-Host "▶ $Text" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ $Text" -ForegroundColor Yellow
}

# ============================================================================
# PHASE 3b STEP 1: CHECK PREREQUISITES
# ============================================================================

function Check-Prerequisites {
    Write-Header "PHASE 3b STEP 1: Checking Prerequisites"
    
    # Check Node.js
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Error-Custom "Node.js not found. Please install Node.js v16+ from https://nodejs.org"
        exit 1
    }
    
    $nodeVersion = node --version
    Write-Success "Node.js installed: $nodeVersion"
    
    # Check npm
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        Write-Error-Custom "npm not found. Please install npm v8+ from https://nodejs.org"
        exit 1
    }
    
    $npmVersion = npm --version
    Write-Success "npm installed: $npmVersion"
    
    # Check frontend directory
    if (-not (Test-Path "frontend")) {
        Write-Error-Custom "frontend directory not found. Run this script from the project root."
        exit 1
    }
    
    Write-Success "frontend directory exists"
}

# ============================================================================
# PHASE 3b STEP 2: INSTALL DEPENDENCIES
# ============================================================================

function Install-Dependencies {
    Write-Header "PHASE 3b STEP 2: Installing Dependencies (10 min)"
    
    Push-Location frontend
    
    Write-Step "Running: npm install"
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "npm install failed"
        Pop-Location
        exit 1
    }
    
    Write-Success "Dependencies installed successfully"
    
    # Verify D3.js installation
    Write-Step "Verifying D3.js installation..."
    $d3Check = npm list d3 | Select-String "d3@"
    if ($d3Check) {
        Write-Success "D3.js 7.8.5 verified"
    } else {
        Write-Error-Custom "D3.js verification failed"
    }
    
    Pop-Location
}

# ============================================================================
# PHASE 3b STEP 3: CREATE ENVIRONMENT FILE
# ============================================================================

function Create-EnvironmentFile {
    Write-Header "PHASE 3b STEP 3: Creating Environment Configuration"
    
    $envFile = "frontend\.env.local"
    
    if (Test-Path $envFile) {
        Write-Info "$envFile already exists. Skipping creation."
        return
    }
    
    Write-Step "Creating $envFile"
    
    $envContent = @"
# NER Graph Service
NEXT_PUBLIC_NER_SERVICE_URL=http://localhost:8108

# Optional: Other services
NEXT_PUBLIC_RAG_SERVICE_URL=http://localhost:8102
NEXT_PUBLIC_VLLM_URL=http://localhost:8000

# Debug mode
NEXT_PUBLIC_GRAPH_DEBUG=false
"@
    
    Set-Content -Path $envFile -Value $envContent
    Write-Success "Environment file created: $envFile"
}

# ============================================================================
# PHASE 3b STEP 4: CREATE MOCK DATA FILE
# ============================================================================

function Create-MockData {
    Write-Header "PHASE 3b STEP 4: Creating Mock Data"
    
    $mockFile = "frontend\lib\mockData.ts"
    
    Write-Step "Creating mock data file..."
    
    if (-not (Test-Path "frontend\lib")) {
        New-Item -ItemType Directory -Path "frontend\lib" -Force | Out-Null
    }
    
    $mockContent = @"
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
"@
    
    Set-Content -Path $mockFile -Value $mockContent
    Write-Success "Mock data created: $mockFile"
}

# ============================================================================
# PHASE 3b STEP 5: CREATE TEST PAGES
# ============================================================================

function Create-TestPages {
    Write-Header "PHASE 3b STEP 5: Creating Test Pages"
    
    # Create graphs test page
    Write-Step "Creating /app/graphs/page.tsx..."
    
    if (-not (Test-Path "frontend\app\graphs")) {
        New-Item -ItemType Directory -Path "frontend\app\graphs" -Force | Out-Null
    }
    
    $graphsPageContent = @"
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
"@
    
    Set-Content -Path "frontend\app\graphs\page.tsx" -Value $graphsPageContent
    Write-Success "Test page created: /app/graphs/page.tsx"
    
    # Create comparison test page
    Write-Step "Creating /app/comparison/page.tsx..."
    
    if (-not (Test-Path "frontend\app\comparison")) {
        New-Item -ItemType Directory -Path "frontend\app\comparison" -Force | Out-Null
    }
    
    $comparisonPageContent = @"
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
"@
    
    Set-Content -Path "frontend\app\comparison\page.tsx" -Value $comparisonPageContent
    Write-Success "Test page created: /app/comparison/page.tsx"
}

# ============================================================================
# PHASE 3b STEP 6: BUILD PROJECT
# ============================================================================

function Build-Project {
    if ($SkipBuild) {
        Write-Info "Skipping build (--SkipBuild flag set)"
        return
    }
    
    Write-Header "PHASE 3b STEP 6: Building Project"
    
    Push-Location frontend
    
    Write-Step "Running: npm run build"
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Build failed"
        Pop-Location
        exit 1
    }
    
    Write-Success "Build completed successfully"
    
    Pop-Location
}

# ============================================================================
# PHASE 3b STEP 7: START DEV SERVER
# ============================================================================

function Start-DevServer {
    Write-Header "PHASE 3b STEP 7: Starting Development Server"
    
    Write-Info "Starting dev server on http://localhost:3000"
    Write-Info "Press Ctrl+C to stop the server"
    Write-Info ""
    Write-Info "Test pages available at:"
    Write-Info "  • http://localhost:3000/graphs"
    Write-Info "  • http://localhost:3000/comparison"
    Write-Info ""
    
    Push-Location frontend
    npm run dev
    Pop-Location
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    Write-Header "🚀 PHASE 3b: TESTING & INTEGRATION - AUTOMATED SETUP"
    
    Write-Info "This script will:"
    Write-Info "1. Check Node.js and npm prerequisites"
    Write-Info "2. Install D3.js and dependencies"
    Write-Info "3. Create environment configuration"
    Write-Info "4. Create mock data files"
    Write-Info "5. Create test pages"
    Write-Info "6. Build the project"
    Write-Info "7. Start the development server"
    Write-Info ""
    
    Check-Prerequisites
    Install-Dependencies
    Create-EnvironmentFile
    Create-MockData
    Create-TestPages
    
    if (-not $DevOnly) {
        Build-Project
    }
    
    Start-DevServer
}

# Run main function
Main
