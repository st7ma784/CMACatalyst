# Phase 3b & 3c Quick Start Guide

**Date:** November 4, 2025  
**Objective:** Execute Phase 3b testing, then immediately move to Phase 3c integration  
**Total Time:** 2-3 hours  

---

## 🚀 Quick Start Commands

### Phase 3b: Installation & Testing

```bash
# 1. Navigate to frontend
cd c:\Users\st7ma\Documents\CMACatalyst\RMA-Demo\frontend

# 2. Install dependencies (includes D3.js)
npm install

# 3. Start development server
npm run dev

# 4. Open browser
# Visit http://localhost:3000 (opens automatically or use Ctrl+Click)

# 5. Verify in browser console (F12)
# Test health check:
import { graphService } from '@/services/graphService';
const health = await graphService.healthCheck();
console.log('NER Service:', health); // Should be: true
```

### Access Test Pages

```
# After dev server starts, navigate to:
http://localhost:3000/graphs        # Components test
http://localhost:3000/comparison    # Comparison test
```

---

## 📋 Phase 3b Checklist (Quick Version)

**Installation (10 min)**
- [ ] Run: `npm install` in frontend
- [ ] Run: `npm run dev`
- [ ] No errors in terminal

**Verification (5 min)**
- [ ] Browser opens to http://localhost:3000
- [ ] Console shows "compiled successfully"
- [ ] No TypeScript errors

**Testing (20 min)**
- [ ] Open F12 browser console
- [ ] Run health check (see above)
- [ ] Should return: `true`
- [ ] If false: NER service not running

**Mock Data (15 min)**
- [ ] Create `frontend/lib/mockData.ts` (see PHASE3b_IMPLEMENTATION_GUIDE.md)
- [ ] Update test page to use mock data
- [ ] Verify components display data

**Performance Check (10 min)**
- [ ] In console, run:
  ```javascript
  console.time('test');
  // (test whatever)
  console.timeEnd('test');
  ```
- [ ] Measure render time <1s

**Mark Complete When:**
- ✅ npm install succeeds
- ✅ Dev server runs without errors
- ✅ Test pages load
- ✅ Mock data displays
- ✅ Health check passes
- ✅ No console errors

---

## 📋 Phase 3c Checklist (Quick Version)

**Before Starting Phase 3c:**
- ✅ Phase 3b must be complete
- ✅ Dev server still running
- ✅ NER service accessible
- ✅ Test pages working

**Create Components (20 min)**
- [ ] Create `frontend/src/components/graphs/AdvisorGraphInsights.tsx`
- [ ] Create `frontend/src/components/advisor/AdvisorResults.tsx`
- [ ] Update `frontend/src/components/graphs/index.ts`
- [ ] Update `frontend/src/types/graph.types.ts`

**Create Pages & Endpoints (15 min)**
- [ ] Create `frontend/src/app/advisor/page.tsx`
- [ ] Create `frontend/app/api/advisor/query/route.ts`

**Test Integration (15 min)**
- [ ] Navigate to http://localhost:3000/advisor
- [ ] Submit test query
- [ ] Verify response displays
- [ ] Check graph loads
- [ ] Test graph interactions

**Mark Complete When:**
- ✅ Advisor page loads
- ✅ Can submit queries
- ✅ Results display with advice
- ✅ Graph section shows
- ✅ All interactions work

---

## 🔗 File References

### Phase 3b Key Files

**Read These First:**
- `PHASE3b_IMPLEMENTATION_GUIDE.md` (600+ lines, complete instructions)
- `PHASE3_DEPLOYMENT_GUIDE.md` (setup reference)

**Create These Files:**
- `frontend/lib/mockData.ts` (mock test data)
- `frontend/app/graphs/page.tsx` (test page)
- `frontend/app/comparison/page.tsx` (comparison test)

### Phase 3c Key Files

**Read This First:**
- `PHASE3c_INTEGRATION_GUIDE.md` (700+ lines, complete architecture)

**Create These Files:**
- `frontend/src/components/graphs/AdvisorGraphInsights.tsx` (new component)
- `frontend/src/components/advisor/AdvisorResults.tsx` (new component)
- `frontend/src/app/advisor/page.tsx` (advisor page)
- `frontend/app/api/advisor/query/route.ts` (API endpoint)

**Update These Files:**
- `frontend/src/components/graphs/index.ts` (add exports)
- `frontend/src/types/graph.types.ts` (add interfaces)

---

## 🎯 Success Indicators

### Phase 3b Success: You Know It Works When...

```
✅ npm install completes without errors
✅ "npm run dev" shows "Ready in 5.2s"
✅ Browser opens to http://localhost:3000
✅ Console shows no TypeScript errors
✅ Health check returns: true
✅ Test pages display components
✅ Mock data shows in components
✅ No errors in browser console
```

### Phase 3c Success: You Know It Works When...

```
✅ Advisor page loads at http://localhost:3000/advisor
✅ Can type and submit a query
✅ Query results display
✅ Text advice shows in blue box
✅ Recommendations list shows
✅ Graph section displays with legend
✅ Can click "Show Graph" / "Hide Graph"
✅ Tabs work (Graph | Rules | Reasoning)
✅ No console errors
```

---

## 🐛 Troubleshooting

### Problem: npm install fails

**Solution 1:** Clear cache
```bash
npm cache clean --force
npm install
```

**Solution 2:** Use legacy peer deps
```bash
npm install --legacy-peer-deps
```

### Problem: Dev server won't start

**Solution 1:** Port already in use
```bash
# Find process on port 3000
netstat -ano | findstr :3000
# Kill it or use different port:
npm run dev -- -p 3001
```

**Solution 2:** Clear Next.js cache
```bash
rm -r .next
npm run dev
```

### Problem: Health check returns false

**Solution:** NER service not running

```bash
# In separate terminal, start NER service
cd services/ner-graph-service
python -m uvicorn app:app --port 8108
```

### Problem: Import errors in console

**Solution:** Modules not found (expected before npm install)

```bash
# This is normal before npm install
npm install
npm run dev
```

### Problem: Components don't render

**Solution 1:** Check component imports
```typescript
// Verify in browser console:
import { GraphViewer } from '@/components/graphs';
// Should not throw error
```

**Solution 2:** Verify mock data loaded
```typescript
import { mockManualGraph } from '@/lib/mockData';
console.log('Mock data:', mockManualGraph);
// Should show graph object
```

---

## 🔍 Quick Debug Commands

### In Browser Console (F12)

```javascript
// Check if components available
import { GraphViewer, AdvisorGraphInsights } from '@/components/graphs';
console.log('Components loaded:', { GraphViewer, AdvisorGraphInsights });

// Check if services available
import { graphService } from '@/services/graphService';
console.log('Service available:', graphService);

// Test API health
const health = await graphService.healthCheck();
console.log('Health:', health);

// Check environment
console.log('NER URL:', process.env.NEXT_PUBLIC_NER_SERVICE_URL);

// Measure performance
console.time('test');
// (do something)
console.timeEnd('test');
```

### In Terminal

```bash
# Check Node version
node --version

# Check npm version
npm --version

# List installed packages
npm list d3

# Check frontend build
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

---

## 📊 Time Breakdown

### Phase 3b: ~75 minutes total

| Task | Time | Status |
|------|------|--------|
| npm install | 10 min | ⏳ |
| Dev server startup | 5 min | ⏳ |
| Test verification | 10 min | ⏳ |
| Mock data creation | 15 min | ⏳ |
| Component testing | 15 min | ⏳ |
| NER service connection | 10 min | ⏳ |
| Performance validation | 10 min | ⏳ |
| **Subtotal** | **75 min** | |

### Phase 3c: ~50 minutes total

| Task | Time | Status |
|------|------|--------|
| Component creation | 20 min | ⏳ |
| Page & API setup | 15 min | ⏳ |
| Integration testing | 15 min | ⏳ |
| **Subtotal** | **50 min** | |

### **Grand Total: ~125 minutes (2-2.5 hours)**

---

## 🎓 Learning Path

**If you want to understand the code:**

1. Read `PHASE3a_DELIVERABLES_INDEX.md` (overview of 11 files created)
2. Open `frontend/src/components/graphs/GraphViewer.tsx` (main component)
3. Open `frontend/src/services/graphService.ts` (API client)
4. Open `frontend/src/types/graph.types.ts` (type definitions)
5. Read `PHASE3_DEPLOYMENT_GUIDE.md` (deployment reference)

**If you just want to run it:**

```bash
cd frontend
npm install
npm run dev
# Visit http://localhost:3000
```

---

## 🚀 Next Steps After Phase 3c

Once Phase 3c is complete (advisor page working):

1. **Phase 4: Formal Logic Engine** (2-3 hours)
   - Implement temporal logic gates
   - Create reasoning chain formalization
   - Generate graph-backed recommendations
   - Add reasoning citations

2. **Docker Deployment** (1 hour)
   - Build container images
   - Create docker-compose for all services
   - Deploy locally

3. **End-to-End Testing** (1-2 hours)
   - Full user workflows
   - Performance testing
   - Edge cases and error handling

---

## 💾 Important Files to Bookmark

**Architecture & Planning:**
- `PHASE3_DEPLOYMENT_GUIDE.md` - Complete setup guide
- `PHASE3b_IMPLEMENTATION_GUIDE.md` - Detailed Phase 3b steps
- `PHASE3c_INTEGRATION_GUIDE.md` - Detailed Phase 3c steps
- `PHASE3a_DELIVERABLES_INDEX.md` - Reference for all created files

**Component Reference:**
- `frontend/src/components/graphs/` - All graph components
- `frontend/src/services/graphService.ts` - API client
- `frontend/src/types/graph.types.ts` - TypeScript definitions

**Configuration:**
- `frontend/package.json` - Dependencies (D3.js, etc.)
- `frontend/.env.local` - Environment variables
- `frontend/next.config.js` - Next.js config

---

## 📞 Support Quick Links

**If you get stuck:**

1. Check troubleshooting section above
2. Read the detailed guide (PHASE3b or PHASE3c)
3. Look in the component file comments
4. Check browser console (F12) for errors
5. Check terminal for server errors

**Common Issues:**

| Issue | Solution | Time |
|-------|----------|------|
| npm install fails | Run with `--legacy-peer-deps` | 2 min |
| Port 3000 in use | Kill process or use different port | 5 min |
| Health check fails | Start NER service in separate terminal | 5 min |
| Components not rendering | Clear cache, restart dev server | 10 min |
| Module not found | Run npm install again | 5 min |

---

## ✅ Completion Checklist

### Phase 3b Complete When:
- [x] All dependencies installed
- [x] Dev server running
- [x] Test pages working
- [x] Mock data displaying
- [x] NER service connected
- [x] Performance acceptable
- [x] All tests passing

### Phase 3c Complete When:
- [x] Advisor page functional
- [x] Components created
- [x] API endpoint working
- [x] Results displaying
- [x] Graph visible in results
- [x] All interactions working
- [x] Responsive design verified

### Project Status After:
- Phase 1: ✅ Complete (NER Service)
- Phase 2: ✅ Complete (Graph Integration)
- Phase 3a: ✅ Complete (Components)
- Phase 3b: ⏳ In Progress (Testing)
- Phase 3c: ⏳ Next (Integration)
- Phase 4: 📋 Planned (Logic Engine)

---

**Ready to Start?** 

```bash
cd c:\Users\st7ma\Documents\CMACatalyst\RMA-Demo\frontend
npm install
npm run dev
```

Then open: **http://localhost:3000**

🎉 **Good luck! You've got this!**

