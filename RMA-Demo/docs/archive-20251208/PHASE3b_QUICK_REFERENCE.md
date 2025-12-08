# Phase 3b Quick Reference: Script-Based Execution

**For use on a machine with Node.js v16+ installed**

---

## 🚀 Quick Start (2 Options)

### Option 1: macOS/Linux

```bash
cd /path/to/CMACatalyst/RMA-Demo
bash phase3b-setup.sh
```

### Option 2: Windows PowerShell

```powershell
cd C:\Users\st7ma\Documents\CMACatalyst\RMA-Demo
powershell -ExecutionPolicy Bypass -File phase3b-setup.ps1
```

---

## ✅ What the Script Does (Automated)

```
✓ Checks Node.js and npm
✓ Runs npm install (installs D3.js)
✓ Creates .env.local
✓ Creates mock data (mockData.ts)
✓ Creates test pages (/graphs, /comparison)
✓ Builds project
✓ Starts dev server on http://localhost:3000
```

---

## 🧪 Test After Script Runs

### 1. Open in Browser
```
http://localhost:3000/graphs
http://localhost:3000/comparison
```

### 2. Check Console (F12)
```javascript
import { GraphViewer } from '@/components/graphs';
import { mockManualGraph } from '@/lib/mockData';
console.log('Components:', GraphViewer);
console.log('Mock data:', mockManualGraph);
```

### 3. Verify No Errors
- Console tab: No red errors
- Network tab: All requests successful
- Terminal: "Compiled successfully"

---

## ⏱️ Timing

| Step | Time |
|------|------|
| npm install | 5-10 min |
| Build | 5 min |
| Dev server start | ~1 min |
| **Total** | **~15-20 min** |

---

## 🛑 Stop Dev Server

```
Press: Ctrl+C
```

---

## 🔄 Restart Dev Server

```bash
cd frontend
npm run dev
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| npm command not found | Install Node.js from https://nodejs.org |
| Port 3000 in use | Use: `npm run dev -- -p 3001` |
| Module errors | Delete node_modules, run `npm install` again |
| Build fails | Clear .next: `rm -rf .next && npm run build` |

---

## 📁 Files Created

```
frontend/
├── .env.local (configuration)
├── lib/mockData.ts (mock test data)
└── app/{graphs,comparison}/page.tsx (test pages)
```

---

## ✨ Success Indicators

- ✅ Dev server running
- ✅ http://localhost:3000 loads
- ✅ Test pages display
- ✅ Mock data shows
- ✅ No console errors

---

## 📖 Documentation

- **Setup Plan:** PHASE3b_SCRIPT_IMPLEMENTATION_PLAN.md
- **Detailed Guide:** PHASE3b_IMPLEMENTATION_GUIDE.md
- **Quick Start:** PHASE3b_3c_QUICK_START.md

---

## 🎯 Next Phase

After Phase 3b completes, move to **Phase 3c** (manual tasks):

Read: `PHASE3c_INTEGRATION_GUIDE.md`

---

**Everything is ready. Just need Node.js and run the script! 🚀**

