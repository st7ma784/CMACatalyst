# Phase 3b & 3c Implementation Plan: Script-Based Execution

**Date:** November 4, 2025  
**Status:** Ready to Execute When Node.js is Available  
**Duration:** 2-2.5 hours on target machine  

---

## 🚀 Overview

This document provides a complete plan for executing **Phase 3b & 3c** using automated scripts when you're on a machine with Node.js v16+ installed.

**Two setup scripts have been created:**
1. `phase3b-setup.sh` - For macOS/Linux
2. `phase3b-setup.ps1` - For Windows PowerShell

---

## 📋 Prerequisites

### Machine Requirements

Before running the scripts, verify you have:

```bash
# Check Node.js
node --version     # Should be v16.0.0 or higher

# Check npm
npm --version      # Should be v8.0.0 or higher
```

**If not installed:**
- Download from https://nodejs.org
- Install the LTS (Long Term Support) version
- Restart terminal/PowerShell after installation

### Repository Setup

Ensure you have:
- ✅ Latest code pulled from master branch
- ✅ All Phase 3a files present (see PHASE3a_DELIVERABLES_INDEX.md)
- ✅ frontend/package.json with D3.js dependencies
- ✅ All component files in frontend/src/components/graphs/

---

## 🎯 Phase 3b: Automated Setup via Script

### Option 1: macOS/Linux

```bash
# Navigate to project root
cd c:\Users\st7ma\Documents\CMACatalyst\RMA-Demo

# Run the setup script
bash phase3b-setup.sh
```

**What the script does:**
1. ✅ Checks Node.js and npm installed
2. ✅ Runs `npm install` (installs D3.js)
3. ✅ Creates `.env.local` with configuration
4. ✅ Creates mock data file (`frontend/lib/mockData.ts`)
5. ✅ Creates test pages (`/graphs` and `/comparison`)
6. ✅ Builds the project (`npm run build`)
7. ✅ Starts dev server (`npm run dev`)

**Output:**
```
════════════════════════════════════════════════════════════
🚀 PHASE 3b: TESTING & INTEGRATION - AUTOMATED SETUP
════════════════════════════════════════════════════════════

✓ Node.js installed: v18.17.0
✓ npm installed: 9.6.7
✓ frontend directory exists
✓ Dependencies installed successfully
✓ D3.js 7.8.5 verified
✓ Environment file created: frontend/.env.local
✓ Mock data created: frontend/lib/mockData.ts
✓ Test page created: /app/graphs/page.tsx
✓ Test page created: /app/comparison/page.tsx
✓ Build completed successfully

ℹ Starting dev server on http://localhost:3000
ℹ Press Ctrl+C to stop the server
ℹ Test pages available at:
  • http://localhost:3000/graphs
  • http://localhost:3000/comparison
```

---

### Option 2: Windows PowerShell

```powershell
# Navigate to project root
cd C:\Users\st7ma\Documents\CMACatalyst\RMA-Demo

# Run the setup script (may need to bypass execution policy)
powershell -ExecutionPolicy Bypass -File phase3b-setup.ps1
```

**Alternative (if above fails):**

```powershell
# Set execution policy for current session only
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Run the script
.\phase3b-setup.ps1
```

**Script options:**

```powershell
# Skip the build step (faster, for testing only)
.\phase3b-setup.ps1 -SkipBuild

# Only run npm install and start dev server (no build)
.\phase3b-setup.ps1 -DevOnly
```

---

## 📊 What Each Script Does

### Phase 3b Step-by-Step (Automated)

| Step | Time | Action | Files Created |
|------|------|--------|----------------|
| 1. Prerequisites | 1 min | Check Node.js, npm, directories | - |
| 2. Dependencies | 10 min | `npm install` D3.js 7.8.5 | node_modules/ |
| 3. Environment | 1 min | Create `.env.local` | frontend/.env.local |
| 4. Mock Data | 2 min | Create `mockData.ts` | frontend/lib/mockData.ts |
| 5. Test Pages | 2 min | Create test page components | frontend/app/{graphs,comparison}/ |
| 6. Build | 5 min | `npm run build` | frontend/.next/ |
| 7. Dev Server | - | `npm run dev` | Listening on :3000 |
| **Total** | **~25 min** | **Includes npm install time** | **See column 4** |

---

## 🔍 Manual Verification After Script Runs

After the script completes and dev server starts (http://localhost:3000):

### 1. Check Components Render

```javascript
// In browser console (F12):
import { GraphViewer, ApplicableRulesList } from '@/components/graphs';
console.log('Components loaded:', { GraphViewer, ApplicableRulesList });
// Should log component functions, not errors
```

### 2. Test Mock Data

```javascript
// In browser console:
import { mockManualGraph, mockApplicableRules } from '@/lib/mockData';
console.log('Mock graph:', mockManualGraph);
console.log('Mock rules:', mockApplicableRules);
// Should display mock data objects
```

### 3. Check NER Service Connection

```javascript
// In browser console:
import { graphService } from '@/services/graphService';
const health = await graphService.healthCheck();
console.log('NER Health:', health);
// Will return: false (normal if NER not running) or true (if running)
```

### 4. Verify Environment

```javascript
// In browser console:
console.log('NER URL:', process.env.NEXT_PUBLIC_NER_SERVICE_URL);
// Should output: http://localhost:8108
```

---

## 🧪 Post-Script Testing Checklist

After scripts complete, verify:

### Dev Server
- [ ] Browser loads http://localhost:3000
- [ ] No "Cannot find modules" errors
- [ ] Console tab shows "Compiled successfully"

### Test Pages
- [ ] http://localhost:3000/graphs loads
- [ ] http://localhost:3000/comparison loads
- [ ] No TypeScript errors in console

### Components
- [ ] GraphViewer component renders
- [ ] ApplicableRulesList displays rules
- [ ] EntitySearch input visible
- [ ] TemporalSelector date picker visible

### Mock Data
- [ ] Mock graph data displays
- [ ] 6 entities shown
- [ ] 5 relationships shown
- [ ] Statistics visible

### Performance
- [ ] Components render <1 second
- [ ] No memory warnings
- [ ] Smooth interactions

---

## 🔄 What Happens Inside the Scripts

### Detailed Script Flow

**phase3b-setup.sh / phase3b-setup.ps1:**

```
START
  ↓
Check prerequisites (Node.js, npm)
  ↓ (if missing, EXIT with error)
Install dependencies (npm install)
  ↓ (takes 5-10 min, includes D3.js)
Create .env.local
  ↓ (NER_SERVICE_URL=http://localhost:8108)
Create mock data (mockData.ts)
  ↓ (6 entities, 5 relationships, 2 rules)
Create test pages (/graphs, /comparison)
  ↓ (pages that display mock data)
Build project (npm run build)
  ↓ (creates optimized next.js build)
Start dev server (npm run dev)
  ↓
LISTENING ON http://localhost:3000
Ready for Phase 3b testing
```

---

## 📁 Files Created by Scripts

### Created During Script Execution

```
frontend/
├── .env.local ← NEW (environment config)
├── lib/
│   └── mockData.ts ← NEW (mock test data)
├── app/
│   ├── graphs/
│   │   └── page.tsx ← NEW (test page 1)
│   └── comparison/
│       └── page.tsx ← NEW (test page 2)
└── .next/ ← NEW (build output)
```

### Files Used by Script (already exist)

```
frontend/
├── src/components/graphs/ (6 components from Phase 3a)
├── src/services/graphService.ts
├── src/types/graph.types.ts
├── src/hooks/ (useGraphData, useD3Graph)
├── src/styles/graphs.module.css
└── package.json (with D3.js already added)
```

---

## ⚙️ Script Parameters (PowerShell Only)

The PowerShell script supports optional parameters:

```powershell
# Run with all steps (default)
.\phase3b-setup.ps1

# Skip the npm build step (faster for testing)
.\phase3b-setup.ps1 -SkipBuild

# Only install dependencies and start dev server
.\phase3b-setup.ps1 -DevOnly

# Combine parameters
.\phase3b-setup.ps1 -SkipBuild -DevOnly
```

---

## 🚨 Troubleshooting Script Execution

### Problem: Script permission denied (bash)

```bash
# Make script executable
chmod +x phase3b-setup.sh

# Run again
bash phase3b-setup.sh
```

### Problem: npm install hangs

```bash
# Cancel with Ctrl+C, then try:
cd frontend
npm cache clean --force
npm install
cd ..
```

### Problem: Port 3000 already in use

```bash
# Find process on port 3000
lsof -i :3000  (macOS/Linux)
netstat -ano | findstr :3000  (Windows)

# Kill the process or use different port:
npm run dev -- -p 3001
```

### Problem: TypeScript errors in console

```
These are EXPECTED before first build completes.
Wait for "Compiled successfully" message.
```

### Problem: Module not found errors

```bash
# Delete node_modules and reinstall
cd frontend
rm -rf node_modules
npm install
cd ..
```

---

## 📈 Success Indicators

**Scripts Complete Successfully When:**

✅ All 7 steps finish without errors  
✅ Dev server shows "Ready in Xs"  
✅ http://localhost:3000 loads  
✅ Test pages accessible  
✅ Console shows no critical errors  

**After First Test:**

✅ Mock data displays in components  
✅ No "Cannot find module" errors  
✅ Components render <1 second  
✅ Responsive on mobile/tablet/desktop  

---

## 🔗 Phase 3b Next Steps (After Script Runs)

Once script completes and dev server is running:

### 1. Open Test Pages

```
http://localhost:3000/graphs       → See GraphViewer + rules
http://localhost:3000/comparison   → See DualGraphComparison
```

### 2. Open Browser DevTools (F12)

- Console tab: Check for errors
- Network tab: Monitor API calls
- Performance tab: Measure render times

### 3. Test NER Connection (Optional)

If you have NER service running on port 8108:

```javascript
// In console:
const health = await graphService.healthCheck();
console.log(health);  // Should return: true
```

### 4. Run Performance Tests

```javascript
// Measure render time
console.time('render');
// (reload page)
console.timeEnd('render');
// Should be <1000ms
```

### 5. Test Responsive Design

- Press F12, click device toolbar
- Test: Mobile (375px), Tablet (768px), Desktop (1920px)
- Verify: No horizontal scrolling, text readable

---

## 📚 Documentation Reference

**Before running script:**
- Read: PHASE3b_3c_QUICK_START.md (5 min overview)

**While script runs:**
- Read: PHASE3b_IMPLEMENTATION_GUIDE.md (reference)

**After script completes:**
- Read: PHASE3_STATUS.md (next steps)
- Reference: PHASE3c_INTEGRATION_GUIDE.md (Phase 3c coming next)

---

## ⏱️ Timeline

### If Node.js Already Installed

```
Script start → npm install (5-10 min) → Build (5 min) → Dev server (∞)
Total initial setup: ~20 minutes
```

### If Node.js Not Installed

```
1. Download Node.js (5 min)
2. Install Node.js (5 min)
3. Restart terminal (2 min)
4. Run script (20 min)
Total: ~30-35 minutes
```

---

## ✅ Phase 3b Complete When

Scripts finish successfully AND you verify:

- ✅ Dev server running on http://localhost:3000
- ✅ Test pages load (/graphs, /comparison)
- ✅ Mock data displays in components
- ✅ No critical console errors
- ✅ Performance <1 second render time
- ✅ Responsive design works on all sizes

**Move to Phase 3c when:** All items above verified

---

## 🎯 Phase 3c: Next Phase (Manual Implementation)

After Phase 3b scripts complete, Phase 3c requires **manual component creation**:

Read: `PHASE3c_INTEGRATION_GUIDE.md`

Tasks:
1. Create AdvisorGraphInsights.tsx (15 min)
2. Create AdvisorResults.tsx (10 min)
3. Create /advisor page (10 min)
4. Create /api/advisor/query endpoint (10 min)
5. Test integration (20 min)

**Total Phase 3c:** ~65 minutes (manual work)

---

## 📞 Quick Reference

### Running Scripts

| Platform | Command |
|----------|---------|
| **macOS/Linux** | `bash phase3b-setup.sh` |
| **Windows PS** | `powershell -ExecutionPolicy Bypass -File phase3b-setup.ps1` |
| **Windows PS (alt)** | `.\phase3b-setup.ps1` (after setting execution policy) |

### Dev Server Access

```
URL: http://localhost:3000
Graphs Test: http://localhost:3000/graphs
Comparison Test: http://localhost:3000/comparison
```

### Stop Dev Server

```
Press: Ctrl+C (in terminal where npm run dev is running)
```

### Restart Dev Server

```bash
cd frontend
npm run dev
```

---

## 📝 Notes

**Script Behavior:**

- Scripts are **idempotent** - safe to run multiple times
- Skips creating files that already exist
- Always runs `npm install` (updates packages if needed)
- Always starts dev server (press Ctrl+C to stop)

**Network Requirements:**

- npm install needs internet (downloading packages)
- NER service connection optional for Phase 3b
- Required for Phase 3c (queries need backend)

**Disk Space:**

- node_modules/: ~500MB
- .next/: ~100MB
- Total: ~600MB per run

---

**Ready to execute on a machine with Node.js v16+ installed! 🚀**

