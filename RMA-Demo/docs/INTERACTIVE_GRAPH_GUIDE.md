# Interactive Debt Graph Guide

## Overview

The **Interactive Debt Graph** is a next-generation visualization component that replaces static ASCII diagrams with a **fully interactive, draggable experience**. Advisors can now manipulate the graph to understand client positioning across multiple debt routes (DRO, IVA, Bankruptcy).

## Key Features

### 1. **Draggable Nodes**

Nodes representing entities (conditions, rules, outcomes) can be **grabbed and moved** freely around the canvas.

**How It Works:**
- Click and hold any node (circle)
- Drag to new position
- Release to drop
- Positions are automatically saved

**Visual Feedback:**
- Cursor changes to ✋ "grab" when hovering over nodes
- Cursor changes to ✊ "grabbing" when actively dragging
- Selected node highlighted with black border

**Use Case:** Organize nodes by route or manually create a mental model

### 2. **Force-Directed Layout**

Automatic layout algorithm that continuously adjusts node positions to:
- Minimize overlaps
- Maximize visibility
- Create natural clusters
- Show relationships spatially

**Features:**
- Repulsion between unrelated nodes (100px distance preference)
- Attraction along relation edges (200px ideal distance)
- Damping to prevent oscillation
- Boundary constraints (keep in canvas)

**Toggle:** "Auto Layout: On/Off" button in toolbar

### 3. **Client Data Overlay**

When client information is provided, the graph shows:
- **Where the client stands** (overlaid on the graph)
- **Which routes they fit** (color-coded indicators)
- **Gaps or near-misses** (specific items blocking eligibility)

**Data Shown:**
```
Client Values:
- Debt: £51,000
- Income: £2,100/month
- Assets: £5,000
- Employment: Self-employed
- Dependents: 2
- Creditors: Utility, Credit Card, Payday Lender
```

### 4. **Route Analysis Panel**

Three side-by-side cards showing:

**Card Layout:**
```
┌─────────────────────────────────────┐
│ ROUTE NAME        [Perfect Fit]    │
│ Confidence: 95%                   │
├─────────────────────────────────────┤
│ ✓ All criteria met                 │
│                                   │
│ Path:                            │
│ Debt Level → Income → DRO... →  │
└─────────────────────────────────────┘
```

**Position Indicators:**
- 🟢 **Perfect Fit** - Client meets all criteria
- 🟡 **Near Miss** - 1 item blocking eligibility (can be fixed)
- 🔴 **Not Suitable** - Multiple issues, likely not appropriate
- 🔵 **Review Needed** - Complex situation requiring expert analysis

**Interactive:** Click card to highlight path through graph in red

### 5. **Zoom & Pan Controls**

**Zoom:**
- Zoom In (+20%) - see details
- Zoom Out (-20%) - see full graph
- Range: 50% to 300%
- Display shows current zoom level

**Pan:**
- Click and drag on canvas background to move
- Maintains zoom level
- Reset button returns to 1:1 zoom at origin

**Use Case:** Navigate large graphs or focus on specific area

### 6. **Node Details Panel**

Clicking any node shows:

**Information Displayed:**
- **Label:** "Debt ≤ £50,000"
- **Type Badge:** Colored type indicator
- **Confidence:** 0-100% score
- **Description:** Full text explanation
- **Properties:** JSON view of thresholds, parameters
- **Source:** Which manual/document originated this node

**Use Case:** Understand exact criteria and why extracted with this confidence

### 7. **Path Highlighting**

When debt route card is selected:
- Path through graph turns **red**
- Lines become **dashed** for clarity
- Opacity highlights selected path
- Shows exact sequence for that route

**Visual:**
```
Debt Level
    ↓ (red dashed)
Income Test
    ↓ (red dashed)
DRO Rule
    ↓ (red dashed)
Eligible for DRO
```

## UI Components

### Toolbar

```
[Zoom In] [100%] [Zoom Out] [Reset] [Auto Layout: On] [Export JSON]
```

| Button | Function |
|--------|----------|
| `+` | Increase zoom by 20% (max 300%) |
| `100%` | Display current zoom level |
| `-` | Decrease zoom by 20% (min 50%) |
| `↶` Reset | Return to default view (1x zoom, no pan) |
| Auto Layout | Toggle force-directed layout |
| ⬇ Export | Download as JSON with node positions |

### Tabs

Four tabs for different views:

**1. Interactive Graph**
- Main canvas
- Draggable nodes
- Route overlay
- Zoom controls

**2. Route Analysis**
- Three debt route cards (DRO, IVA, Bankruptcy)
- Client position status
- Gaps and gaps
- Click to highlight path

**3. Node Details**
- Information about selected node
- Full properties
- Source document
- Confidence explanation

**4. Layout Settings**
- Toggle auto-layout
- Reset to default
- Legend (entity type colors)

## Visual Design

### Node Appearance

```
        Node Circle
       ┌─────────────┐
      /             \
    /  Small Inner  \   ← Inner circle shows confidence
   │   Circle        │     (white 50% opacity)
    \   (confidence) /     Radius = node_radius × confidence
      \             /
       └─────────────┘
             │
             ├─ Fill Color: By entity type
             ├─ Border: #333 normal, #000 when selected
             ├─ Border Width: 1px normal, 3px when selected
             └─ Opacity: 80%

Type Badge Below Node
┌──────────────┐
│  condition   │  ← Small box showing entity type
└──────────────┘    Text: "condition", "rule", "outcome", etc.
```

### Connection Lines

| Property | Value |
|----------|-------|
| **Color** | By relation type (red=requires, blue=implies, etc) |
| **Width** | 2px normal, 3px when highlighted |
| **Style** | Solid normal, dashed when highlighted |
| **Label** | Relation type at midpoint |
| **Opacity** | 60% normal, 100% when highlighted |

### Colors Reference

**Entity Types:**
| Type | Color | Hex |
|------|-------|-----|
| Condition | Blue | #3b82f6 |
| Rule | Purple | #8b5cf6 |
| Outcome | Green | #10b981 |
| Threshold | Amber | #f59e0b |
| Process | Indigo | #6366f1 |
| Criteria | Pink | #ec4899 |
| Exception | Red | #ef4444 |
| Action | Teal | #14b8a6 |
| Journey | Cyan | #06b6d4 |

**Routes:**
| Route | Color | Hex |
|-------|-------|-----|
| DRO | Green | #10b981 |
| IVA | Blue | #3b82f6 |
| Bankruptcy | Red | #ef4444 |

## Workflows

### Workflow 1: Understanding DRO Eligibility

1. **Load Graph**
   - Opens "Interactive Graph" tab
   - Auto-layout arranges nodes intelligently

2. **View Route Analysis**
   - Click "Route Analysis" tab
   - See three cards: DRO, IVA, Bankruptcy
   - Status shows "Perfect Fit" or gaps

3. **Click DRO Card**
   - Path highlights in red dashed lines
   - Shows exact sequence: Debt → Income → DRO Rule → Eligible
   - Graph visually shows the reasoning

4. **Explore Nodes**
   - Click "Income" node
   - Details panel shows threshold: "£75/month"
   - Shows confidence: 92%
   - Shows source: "DRO_Manual.pdf"

5. **Adjust Layout**
   - Can drag nodes to create vertical flow
   - Or use "Reset to Default Layout" to restore

### Workflow 2: Client Assessment

**Scenario:** "Is client eligible for DRO?"

1. **Load Client Data**
   ```javascript
   const clientData = {
     debt: 51000,           // £1,000 over limit
     income: 2100,          // Way over limit
     assets: 5000,
     employment: 'employed',
     dependents: 2,
     debts: [
       { type: 'utility', amount: 500, creditor: 'British Gas' },
       { type: 'credit_card', amount: 48000, creditor: 'Visa' },
       { type: 'personal_loan', amount: 2500, creditor: 'Lender' }
     ]
   }
   ```

2. **Analyze Results**
   - Route Analysis shows:
     - **DRO:** Near Miss (debt £1k over, income way over)
     - **IVA:** Perfect Fit (can handle higher debt/income)
     - **Bankruptcy:** Perfect Fit (but not preferred)

3. **Highlight DRO Path**
   - Click DRO card to see requirements
   - Graph shows: Debt ≤ £50k, Income < £75/mo
   - Both light up on graph showing gaps

4. **Recommendation**
   - "Client needs to pay £1,000 to qualify for DRO"
   - "Or consider IVA which has no strict income/debt limits"
   - "Decision depends on client's capability and preference"

### Workflow 3: Comparing Routes

1. **View All Routes Simultaneously**
   - Route Analysis tab shows all three

2. **Compare Cards**
   - Look at gaps for each
   - See which has best fit

3. **Highlight Each Path**
   - Click DRO → see DRO path
   - Click IVA → see IVA path  
   - Click Bankruptcy → see bankruptcy path
   - Graph updates to show each route's decision tree

4. **Make Decision**
   - Route with "Perfect Fit" is recommended
   - Route with "Near Miss" might be fixable
   - Route with "Not Suitable" marked red

## Interactions & Gestures

| Gesture | Action | Result |
|---------|--------|--------|
| **Mouse hover on node** | Show grab cursor | Indicates draggable |
| **Click and drag node** | Move node position | Node follows mouse |
| **Release node** | Drop at new position | Position saved |
| **Click node** | Select node | Highlights border, shows details |
| **Click route card** | Select route | Path highlights in red dashed |
| **Scroll on canvas** | Zoom (with Ctrl) | Zoom in/out |
| **Drag on background** | Pan view | Move entire graph |
| **Click "Reset"** | Reset view | Return to default zoom/pan |
| **Toggle auto-layout** | Enable/disable forces | Nodes adjust positions automatically |

## Technical Implementation

### Component State

```typescript
// Node positioning
const [nodePositions, setNodePositions] = useState<NodePosition>({})

// Interaction state
const [dragging, setDragging] = useState<string | null>(null)
const [selectedNode, setSelectedNode] = useState<string | null>(null)

// View state
const [zoom, setZoom] = useState(1)
const [pan, setPan] = useState({ x: 0, y: 0 })

// Route analysis
const [routeComparisons, setRouteComparisons] = useState<Map<string, RouteComparison>>()
const [highlightedPath, setHighlightedPath] = useState<string[]>([])

// Layout control
const [autoLayout, setAutoLayout] = useState(true)
```

### Force Layout Algorithm

```typescript
const applyForceLayout = () => {
  // For each node:
  // 1. Calculate repulsion from all other nodes (100px target distance)
  // 2. Calculate attraction to connected nodes (200px target distance)
  // 3. Apply forces with 0.5 damping factor
  // 4. Keep in bounds (50-1150 x, 50-750 y)
  // Repeat 10 iterations per update
}
```

### Rendering

```typescript
const renderGraph = () => {
  // 1. Clear SVG
  // 2. Draw relations first (appear behind)
  //    - Line from source to target
  //    - Label at midpoint
  //    - Red/dashed if highlighted
  // 3. Draw entities (nodes)
  //    - Circle at position
  //    - White confidence indicator inside
  //    - Text label (wrapped)
  //    - Type badge below
  // 4. Attach event listeners
}
```

## Performance Considerations

**Optimization Strategies:**

1. **Force Layout Iteration Limit**
   - Only 10 iterations per update
   - Prevents excessive computation
   - Balances responsiveness vs accuracy

2. **Selective Re-rendering**
   - Only re-render when positions change
   - Don't re-render on every mouse move
   - Batched updates every 100ms

3. **SVG Over Canvas**
   - SVG easier to manipulate individual elements
   - Better accessibility
   - Easier to attach event handlers

4. **Memoization**
   - useCallback for expensive functions
   - Prevents unnecessary re-computations

## Future Enhancements

### Phase 2: Advanced Features

- [ ] **D3.js Integration** - Better physics simulation
- [ ] **Animation** - Smooth transitions when dragging
- [ ] **Grouping** - Visually group related nodes by route
- [ ] **Search** - Find nodes by name/property
- [ ] **Undo/Redo** - Revert layout changes
- [ ] **Save Layouts** - Store multiple custom arrangements

### Phase 3: Advanced Visualization

- [ ] **3D Graph** - Three-dimensional navigation
- [ ] **Time-based** - Show graph evolution through eligibility process
- [ ] **Confidence Levels** - Visual gradient showing certainty
- [ ] **Client Journey** - Animate client path through graph
- [ ] **What-if Analysis** - Show how changes affect routes

### Phase 4: Integration

- [ ] **Live Data** - Connect to real client assessments
- [ ] **Multi-client** - Compare multiple clients side-by-side
- [ ] **Historical** - Show how decision changed over time
- [ ] **Audit Trail** - Log all changes for compliance
- [ ] **Export Reports** - Generate PDF showing client path

## Troubleshooting

### Issue: Nodes overlapping

**Solution 1:** Toggle auto-layout off and drag manually
**Solution 2:** Click "Reset to Default Layout"
**Solution 3:** Reduce zoom to see full graph

### Issue: Can't drag node

**Possible causes:**
- Node not fully loaded (wait for refresh)
- Auto-layout is too strong (toggle to "Off")
- Dragging wrong element (click the colored circle, not the label)

**Solution:** Click node first to select, then drag

### Issue: Path not highlighting

**Causes:**
- Selected route has no path data
- Path data incorrectly formatted

**Solution:** Click different route card or refresh

### Issue: Graph too small/too large

**Solution 1:** Use zoom controls
**Solution 2:** Drag on background to pan
**Solution 3:** Click reset to return to default

## Usage Examples

### Example 1: Simple DRO Check

```tsx
<InteractiveDebtGraph 
  clientData={{
    debt: 40000,      // Under £50k limit
    income: 60,       // Under £75/mo limit
    assets: 0,
    employment: 'employed',
    dependents: 0,
    debts: []
  }}
/>
```

**Result:** Route Analysis shows "Perfect Fit" for DRO with green badge

### Example 2: Complex Multi-Creditor Case

```tsx
<InteractiveDebtGraph 
  clientData={{
    debt: 75000,
    income: 3500,
    assets: 25000,
    employment: 'self-employed',
    dependents: 3,
    debts: [
      { type: 'business_loan', amount: 40000, creditor: 'HSBC' },
      { type: 'tax_debt', amount: 15000, creditor: 'HMRC' },
      { type: 'credit_cards', amount: 20000, creditor: 'Multiple' }
    ]
  }}
/>
```

**Result:** 
- DRO: "Not Suitable" (debt and income way over)
- IVA: "Perfect Fit" (handles higher debt/income)
- Bankruptcy: "Near Miss" (needs asset clearance review)

**Graph shows:** 
- Three paths highlighted in sequence when clicking each card
- Advisor can explain why IVA is best option

## Best Practices for Advisors

### Do ✅

- Explore nodes before recommending a route
- Check all three route cards for comparison
- Understand the "gaps" - these are fixable sometimes
- Save node positions you like (positions persist)
- Use details panel to explain to client

### Don't ❌

- Just trust "Perfect Fit" without understanding why
- Ignore "Near Miss" - often can be fixed
- Forget to check confidence scores
- Make decision without understanding the path

---

**Ready to explore debt routes visually? Load a client and see where they fit!**
