# Worker Leaderboard - Visual Preview

## What Users Will See

### Top Section (Medal Winners)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🥇   │ worker-gpu-alpha-001          [GPU] [healthy]                  │ 450 │
│       │ ⚡ 142 tasks  📈 8.5h uptime  💻 NVIDIA RTX 4090              │ pts │
└─────────────────────────────────────────────────────────────────────────────┘
   ↑ Gradient yellow-orange background for top 3

┌─────────────────────────────────────────────────────────────────────────────┐
│  🥈   │ worker-gpu-beta-007           [GPU] [healthy]                  │ 385 │
│       │ ⚡ 120 tasks  📈 5.2h uptime  💻 NVIDIA RTX 3090              │ pts │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  🥉   │ worker-cpu-charlie-003        [CPU] [healthy]                  │ 298 │
│       │ ⚡ 145 tasks  📈 12.3h uptime                                 │ pts │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Regular Rankings (4-10)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  #4   │ worker-storage-delta-012      [Storage] [healthy]              │ 156 │
│       │ ⚡ 98 tasks  📈 18.7h uptime                                   │ pts │
└─────────────────────────────────────────────────────────────────────────────┘
   ↑ Gray background for #4-10

┌─────────────────────────────────────────────────────────────────────────────┐
│  #5   │ worker-gpu-echo-005           [GPU] [degraded]                 │ 142 │
│       │ ⚡ 38 tasks  📈 6.1h uptime  💻 NVIDIA RTX 3080               │ pts │
└─────────────────────────────────────────────────────────────────────────────┘

... (continues to #10)
```

### Bottom Info Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏆 Contribution Score Formula:                                              │
│    (Tasks × Tier Weight) + Uptime Hours                                     │
│                                                                              │
│    Tier Weights: GPU (3x) • CPU (2x) • Storage (1x)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Breakdown: Top Worker Example

### Worker: worker-gpu-alpha-001 (1st Place)

**Visual Elements:**
- **Rank Badge:** 🥇 (2xl font size, bold)
- **Background:** Gradient from yellow-50 to orange-50
- **Border:** 2px solid yellow-300
- **Shadow:** Subtle shadow for depth

**Information Display:**
```
Left Section:
┌─────────────────────────────────────────┐
│ 🥇  │                                   │
│     │  worker-gpu-alpha-001             │
│     │  [🚀 GPU] [✅ healthy]           │
│     │                                   │
│     │  ⚡ 142 tasks                    │
│     │  📈 8.5h uptime                  │
│     │  💻 NVIDIA RTX 4090              │
└─────────────────────────────────────────┘

Right Section:
┌────────┐
│  450   │  ← Large bold number
│  pts   │  ← Small gray text
└────────┘
```

**Contribution Score Calculation:**
```
Tasks Completed: 142
Tier: 1 (GPU) → Weight: 3x
Uptime: 8.5 hours

Score = (142 × 3) + 8.5
      = 426 + 8.5
      = 434.5
      → Displayed as: 435 pts
```

---

## Comparison: 4th Place vs 1st Place

### Visual Difference

**1st Place (🥇):**
- Background: `bg-gradient-to-r from-yellow-50 to-orange-50`
- Border: `border-yellow-300`
- Shadow: `shadow-sm`
- Rank: Large emoji medal

**4th Place (#4):**
- Background: `bg-gray-50`
- Border: `border-gray-200`
- Shadow: None
- Rank: Text "#4"

This creates clear visual hierarchy where top 3 "pop" from the page.

---

## Empty State

When no workers are registered:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                                   👥                                         │
│                          (large gray icon)                                   │
│                                                                              │
│                         No workers available                                 │
│                                                                              │
│                Deploy a worker to contribute compute resources!              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Desktop (>768px)
- Full worker details displayed
- GPU type shown in hardware section
- All metrics visible in single line
- Contribution points aligned right

### Mobile (<768px)
- Worker ID wraps if needed
- Metrics stack vertically
- Contribution points stay right-aligned
- Top 3 gradient backgrounds maintained

---

## Real-Time Updates

**Update Frequency:** Every 10 seconds

**What Updates:**
- Worker status (healthy → degraded if heartbeat missed)
- Tasks completed (increments as workers process)
- Uptime hours (continuously increases)
- Contribution score (recalculates automatically)
- Rankings (re-sorts based on new scores)

**User Experience:**
- Smooth transitions when rankings change
- No jarring full-page reloads
- Loading spinner during fetch
- Error state if coordinator unreachable

---

## Engagement Drivers

### Why Users Will Care

1. **Competition:**
   - "Can I reach the podium?"
   - "My GPU is better than theirs"
   - Friendly rivalry between contributors

2. **Recognition:**
   - Public visibility of contributions
   - Medal badges create prestige
   - Screenshot-worthy achievements

3. **Transparency:**
   - Clear scoring formula
   - No hidden algorithms
   - Fair weighting by hardware tier

4. **Progress Tracking:**
   - Watch your rank improve over time
   - See uptime accumulate
   - Track task completions

### Behavioral Impact

**Expected Outcomes:**
- More users deploy workers (to appear on leaderboard)
- Existing workers stay online longer (uptime = points)
- GPU owners prioritize their workers (3x multiplier)
- Contributors share screenshots on social media
- Creates community around distributed compute

---

## Technical Implementation Details

### Data Flow

```
1. SystemOrchestrator fetches worker data every 10s:
   GET /api/admin/workers → Array<Worker>

2. Client-side calculation for each worker:
   - Parse registered_at timestamp
   - Calculate uptime: (now - registered_at) / (1000 * 60 * 60)
   - Get tier weight: tier 1 → 3, tier 2 → 2, tier 3 → 1
   - Calculate score: (tasks_completed * tierWeight) + uptimeHours

3. Sort workers by contributionScore (descending)

4. Slice top 10 for display

5. Render with visual hierarchy (medals for top 3)
```

### Performance Considerations

**Computation Complexity:** O(n log n) for sorting
- With 100 workers: ~664 comparisons
- With 1,000 workers: ~9,966 comparisons
- Negligible impact (<1ms on modern browsers)

**Memory Usage:**
- Each worker object: ~500 bytes
- 1,000 workers: ~500KB
- Well within browser limits

**Network Usage:**
- API call every 10s: ~5KB response (100 workers)
- 6 calls/min × 60 min = 360 calls/hour
- ~1.8MB/hour bandwidth (negligible)

---

## Accessibility

### Screen Reader Support
- Rank badges announced as "First place", "Second place", etc.
- Worker IDs read aloud
- Status badges have ARIA labels
- Contribution scores have descriptive labels

### Keyboard Navigation
- Tab through leaderboard entries
- Focus styles on interactive elements
- Skip links for screen reader users

### Color Contrast
- All text meets WCAG AA standards
- Status badges have sufficient contrast
- Gradient backgrounds don't obscure text

---

## A/B Testing Recommendations

### Metrics to Track
1. **Engagement:**
   - Time spent on System tab
   - Return visits to leaderboard
   - Screenshot/share events

2. **Worker Deployments:**
   - New worker registrations after feature launch
   - Worker uptime before/after
   - Task completion rates

3. **Community Growth:**
   - GitHub stars/forks increase
   - Discord/forum mentions
   - Social media shares

### Variants to Test
1. **Score Formula:**
   - Current: (tasks × weight) + uptime
   - Variant A: tasks × weight (ignore uptime)
   - Variant B: (tasks × weight) + (uptime × 0.1)

2. **Display Density:**
   - Current: Top 10
   - Variant A: Top 5 (more focus)
   - Variant B: Top 20 (more visibility)

3. **Update Frequency:**
   - Current: 10 seconds
   - Variant A: 5 seconds (more real-time)
   - Variant B: 30 seconds (less server load)

---

## Example Scenarios

### Scenario 1: New GPU Contributor

**User:** Deploys RTX 4090 worker for first time

**Timeline:**
```
T+0:    Worker registers, appears at bottom of leaderboard
        Rank: #25 (0 tasks, 0 uptime)
        
T+1h:   Processes 20 tasks
        Score: (20 × 3) + 1 = 61
        Rank: #12 (moved up!)
        
T+8h:   Processes 142 tasks total
        Score: (142 × 3) + 8 = 434
        Rank: #1 🥇 (podium!)
        
User sees their rank climb over the day → Strong engagement
```

### Scenario 2: Long-Running Storage Worker

**User:** Deploys storage worker, leaves running for weeks

**Timeline:**
```
Week 1:  50 tasks, 168h uptime
         Score: (50 × 1) + 168 = 218
         Rank: #8
         
Week 2:  120 tasks, 336h uptime
         Score: (120 × 1) + 336 = 456
         Rank: #3 🥉 (bronze medal!)
         
Uptime accumulation rewards reliable infrastructure
```

### Scenario 3: Multi-Worker Organization

**Organization:** Runs 3 workers (2 GPU, 1 CPU)

**Leaderboard Shows:**
```
#1  🥇  org-gpu-worker-1     [GPU]     520 pts
#4  #4  org-gpu-worker-2     [GPU]     305 pts
#7  #7  org-cpu-worker-1     [CPU]     198 pts

Total organizational contribution: 1,023 pts
(Could be future feature: Organization Leaderboard)
```

---

## Success Criteria

### Launch Metrics (Week 1)
- ✅ 10+ workers appear on leaderboard
- ✅ At least 1 worker reaches podium (top 3)
- ✅ Zero frontend errors in production
- ✅ Leaderboard loads in <500ms

### Growth Metrics (Month 1)
- 🎯 20% increase in worker deployments
- 🎯 30% increase in average worker uptime
- 🎯 5+ social media mentions/shares
- 🎯 Positive community feedback

### Long-Term Impact (Quarter 1)
- 🚀 50+ active workers in leaderboard
- 🚀 "Worker of the Month" recognition program
- 🚀 Community contributions to leaderboard features
- 🚀 Integration with GitHub contributor stats

---

This leaderboard transforms the System tab from passive monitoring to active engagement, 
creating a community around distributed compute contributions! 🎉
