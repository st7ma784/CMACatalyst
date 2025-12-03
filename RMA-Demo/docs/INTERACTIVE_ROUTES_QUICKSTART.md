# Interactive Routes - Quick Start

## 5-Minute Quick Start

### Step 1: Open the Tab
Click **"Interactive Routes"** in the dashboard (new 🔋 tab)

### Step 2: See the Graph
You'll see:
- **Colored circles** = entities (conditions, rules, outcomes)
- **Lines between circles** = relationships
- **Three cards below** = route comparison (DRO, IVA, Bankruptcy)

### Step 3: Interact with Nodes
- **Grab any node** with your mouse
- **Drag it** anywhere on the canvas
- **Release** to drop at new position

### Step 4: Understand Routes
Each card shows:
```
┌──────────────────┐
│ DRO              │
│ Perfect Fit ✓    │
│ Confidence: 95%  │
├──────────────────┤
│ ✓ All criteria   │
│   met            │
│                  │
│ Path: Debt >     │
│ Income > DRO...  │
└──────────────────┘
```

### Step 5: Highlight Path
- Click any route card
- Path turns **red dashed lines**
- Shows exact decision tree

### Step 6: Get Details
- Click any colored node
- "Details" tab shows:
  - What this entity is
  - Confidence level (%)
  - Where it came from

---

## Common Tasks

### Task: Understand DRO Requirements
1. Open Interactive Routes
2. Click **DRO card**
3. Path highlights showing:
   - Debt ≤ £50,000
   - Income < £75/month
   - Then eligible

### Task: Compare Routes
1. Look at all 3 cards simultaneously
2. See which has most "Perfect Fit"
3. Look at gaps for each
4. Discuss with client

### Task: Assess a Client
1. Client has: Debt £51k, Income £3k/mo
2. **DRO:** Shows "Near Miss" with gap "£1k over limit"
3. **IVA:** Shows "Perfect Fit"
4. **Bankruptcy:** Shows "Perfect Fit"

**Decision:** IVA is best option (no limits)

### Task: Rearrange Layout
1. Toggle "Auto Layout: Off" (if too busy)
2. Drag nodes to organize
3. Create logical flow (top to bottom)
4. Or by route (left, middle, right)

### Task: Zoom In for Details
1. Click **Zoom In** multiple times
2. Navigate with pan (drag background)
3. Click **Reset** to go back

### Task: Save Your Arrangement
1. Organize nodes nicely
2. Click **Export JSON**
3. Share with team
4. Or archive for records

### Task: Help a Client Choose
1. Load their data
2. Show 3 routes on one screen
3. Highlight each path
4. Explain the gaps
5. Show confidence levels
6. Decide together

---

## The Route Cards Explained

### Perfect Fit ✓ (Green)
```
DRO
Perfect Fit ✓
Confidence: 95%

✓ All criteria met

Path: Debt < £50k
      ↓
      Income < £75
      ↓
      DRO Eligible
```

**Meaning:** Client meets ALL requirements for this route

**Your Action:** Recommend this route confidently

### Near Miss 🟡 (Amber)
```
IVA
Near Miss 🟡
Confidence: 92%

Gap:
• Debt below £15k minimum

Path: Debt > £15k
      ↓
      Debt < £50k
      ↓
      IVA Eligible
```

**Meaning:** Client meets MOST requirements, 1 thing blocking

**Your Action:** "If you increase debt by £X, you'd qualify"

### Not Suitable ❌ (Red)
```
DRO
Not Suitable ❌
Confidence: 88%

Gaps:
• Debt £1k over limit
• Income £500 over limit

Path: [Shows multiple failures]
```

**Meaning:** Client doesn't meet requirements (2+ gaps)

**Your Action:** Recommend different route

### Review Needed 🔵 (Blue)
```
Bankruptcy
Review Needed 🔵
Confidence: 80%

Gap:
• Complex asset situation

Path: [Shows decision point]
```

**Meaning:** Route possible but needs expert review

**Your Action:** Escalate to supervisor for complex analysis

---

## Visual Elements

### Node Colors

```
🔵 Blue Circle     = Condition (debt, income, etc)
🟣 Purple Circle   = Rule (eligibility logic)
🟢 Green Circle    = Outcome (eligible/not eligible)
🟠 Orange Circle   = Threshold (£50k limit, etc)
🔴 Red Circle      = Exception (special case)
🔄 Teal Circle     = Action (pay £X, seek advice, etc)
⭕ Cyan Circle     = Journey (DRO path, IVA path, etc)
```

### Node Size Indicators

```
Small White Circle Inside = Confidence Level
├─ Fills 50% = 50% confidence
├─ Fills 80% = 80% confidence
└─ Fills 100% = 100% confidence
```

### Connection Types

```
Blue Line   = Implies (if A then B)
Purple Line = Leads To (A causes B)
Orange Line = Requires (A needs B)
Red Line    = Prevents (A blocks B)
Green Line  = Equivalent (A is like B)
```

**Special Highlighting:**
```
Red Dashed = Selected route path
Thick Line = Highlighted connection
Opacity = Importance/relevance
```

---

## Controls Reference

### Toolbar

| Button | Action | Use |
|--------|--------|-----|
| **+** | Zoom In 20% | See details |
| **-** | Zoom Out 20% | See full graph |
| **100%** | Display | Shows current zoom |
| **↶** | Reset View | Back to normal |
| **Auto Layout** | Toggle | On/Off automatic arrangement |
| **⬇** | Export JSON | Download and share |

### Tabs

| Tab | Shows | For |
|-----|-------|-----|
| **Interactive Graph** | Main graph canvas | Exploring relationships |
| **Route Analysis** | Three route cards | Client decision |
| **Node Details** | Selected node info | Understanding specifics |
| **Layout Settings** | Preferences | Customizing view |

### Mouse Actions

| Action | Result |
|--------|--------|
| **Hover on node** | Shows grab cursor (hand) |
| **Click & drag node** | Move to new position |
| **Click route card** | Highlights path in red |
| **Click node** | Shows in Details tab |
| **Scroll** | Zoom in/out |
| **Drag background** | Pan across graph |
| **Click Reset** | Return to default |

---

## Decision Tree

### "Which route for this client?"

```
Client Data: Debt £45k, Income £1800/mo

                START HERE
                    ↓
        ┌───────────────────────┐
        │ Open Interactive Routes│
        │ Check all 3 cards     │
        └───────┬───────────────┘
                ↓
        ┌───────────────────────┐
        │ DRO: "Near Miss"      │
        │ IVA: "Perfect Fit" ✓  │
        │ BKP: "Perfect Fit" ✓  │
        └───────┬───────────────┘
                ↓
        ┌───────────────────────┐
        │ Why near-miss for DRO?│
        │ • Income £1800 > £75  │
        │   (Need under £75)    │
        └───────┬───────────────┘
                ↓
        ┌───────────────────────┐
        │ Can client reduce     │
        │ income? NO            │
        └───────┬───────────────┘
                ↓
        ┌───────────────────────┐
        │ → Recommend IVA       │
        │ (can handle income)   │
        │ Confidence: 95%       │
        └───────────────────────┘
```

---

## Tips & Tricks

### ✅ DO

- **Start with all 3 routes** - Instantly see options
- **Highlight each path** - Understand the logic
- **Check confidence** - Higher % is more certain
- **Look for near-miss** - Sometimes fixable!
- **Drag nodes around** - Create your own layout
- **Use zoom on details** - See small text clearly
- **Export your final layout** - Save for records

### ❌ DON'T

- **Ignore red cards** - They're important info too
- **Trust without understanding** - Always check the path
- **Skip the details tab** - Understand WHY entities matter
- **Use >300% zoom** - Will become unreadable
- **Drag off screen** - Click Reset to recover

---

## Common Questions

**Q: A node disappeared!**
A: It's probably off screen. Click "Reset" to see all nodes again.

**Q: Layout keeps changing!**
A: "Auto Layout: On" is active. Toggle to "Off" to lock positions.

**Q: I can't read the labels!**
A: Click **Zoom In** to see text better, or click node to see in Details tab.

**Q: Red path won't show!**
A: Make sure you clicked the route card (DRO, IVA, or Bankruptcy), not the background.

**Q: How do I save my layout?**
A: Click **Export JSON** - it saves node positions. Download and email to team.

**Q: Can I print this?**
A: Screenshot works best. Or export to JSON and print from email.

**Q: What if client doesn't fit any route?**
A: All cards show "Not Suitable"? Escalate to supervisor for alternative solutions.

**Q: Is this data confidential?**
A: Yes! Don't share graphs with client data. Export anonymized versions only.

---

## Example Scenarios

### Scenario 1: Employed Person, Low Debt

**Client:** Sarah, Debt £30k, Income £2000/mo, Employed

**System Shows:**
- DRO: ✓ Perfect Fit (debt under £50k, wait... income way over £75?)
- IVA: ✓ Perfect Fit (handles high income)
- Bankruptcy: ◐ Review (high income, low debt)

**Analysis:**
- "Wait, DRO shows perfect fit but income is £2000?"
- Click DRO card → Path highlights
- Shows: "Debt ≤ £50k ✓" and "Income < £75 ✗ WAIT..."
- "Oh! DRO requires LESS than £75/month? That's very low income."
- Look for "Exceptions" node → "Self-employed income counted differently"
- Sarah is employed, so standard income applies
- **Decision:** IVA is best option (high income friendly)

### Scenario 2: Self-Employed, Medium Debt

**Client:** Ahmed, Debt £45k, Income £3500/mo, Self-employed

**System Shows:**
- DRO: ❌ Not Suitable (income way over, self-employed exception applies)
- IVA: ✓ Perfect Fit
- Bankruptcy: ✓ Perfect Fit (but if possible, avoid)

**Analysis:**
- DRO shows red "Not Suitable"
- Click card → Path shows: "Self-employed exception: different income calculation"
- Can't use DRO with self-employment
- IVA explicitly handles self-employed at any income
- **Decision:** IVA strongly recommended for Ahmed

### Scenario 3: High Debt, Looking for Near-Miss

**Client:** James, Debt £51k, Income £60/mo, Employed

**System Shows:**
- DRO: 🟡 Near Miss (debt £1k over, otherwise would fit!)
- IVA: ✓ Perfect Fit (no strict limits)
- Bankruptcy: ✓ Perfect Fit (but prefer not)

**Analysis:**
- DRO near-miss with gap: "Debt £1,000 over limit"
- **Opportunity:** "If you can pay £1,000 towards debt before DRO application, you'd qualify!"
- Show James: "Option A: Pay £1k now, then DRO (preferred)"
- "Option B: Do IVA now (also works)"
- James prefers "fresh start" of DRO
- **Decision:** Help James save £1,000 first, then DRO

---

## Advisor Confidence Levels

### After 1 Session
✓ Can identify which routes a client fits
✓ Can explain why (show the path)

### After 5 Sessions
✓ Can identify near-miss opportunities
✓ Can explain gaps clearly to clients
✓ Can compare routes confidently

### After 20 Sessions
✓ Can spot complex situations
✓ Can explain exceptions to rules
✓ Can identify learning needs
✓ Can help other advisors

---

## Summary

**Interactive Routes** is your **visual decision support system**.

**In 3 seconds:**
- See which routes a client fits
- Identify any gaps
- Show them exactly why

**In 1 minute:**
- Understand all three debt routes
- Identify best option
- Plan next steps

**Use it with confidence!** 🎯

---

*For more details, see INTERACTIVE_GRAPH_GUIDE.md*
