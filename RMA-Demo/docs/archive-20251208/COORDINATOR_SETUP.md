# Coordinator Setup - Python Environment

## What's Different Now

The coordinator now uses its own **isolated Python virtual environment** instead of relying on conda or system Python.

## How It Works

When you run `./start-coordinator.sh`, it will:

1. **Create a virtual environment** (first time only)
   - Location: `coordinator-service/venv/`
   - Isolated from system Python and conda

2. **Install dependencies** (first time only)
   - FastAPI, Uvicorn, and all requirements
   - Pinned versions from `requirements.txt`

3. **Start the coordinator**
   - Uses `venv/bin/python` (not system Python)
   - Runs in background with logs

## Quick Start

```bash
# Just run this - it handles everything
./start-coordinator.sh
```

The script will:
- ✅ Create `venv/` if needed
- ✅ Install dependencies if needed
- ✅ Start coordinator on port 8080
- ✅ Start Cloudflare tunnel
- ✅ Save process IDs for later

## Manual Development

If you want to work on the coordinator manually:

```bash
cd coordinator-service

# Activate the environment
source activate-env.sh

# Now you can run commands
python -m uvicorn app.main:app --reload --port 8080

# Or run tests
pytest

# Deactivate when done
deactivate
```

## Files Created

| File | Purpose |
|------|---------|
| `coordinator-service/venv/` | Virtual environment (auto-created) |
| `coordinator-service/.gitignore` | Excludes venv from git |
| `coordinator-service/activate-env.sh` | Helper to activate venv manually |

## Verify It's Working

```bash
# Start the coordinator
./start-coordinator.sh

# Check it's using venv (in logs)
# You should see: "✅ Using virtual environment at coordinator-service/venv"

# Test the API
curl http://localhost:8080/health

# Check the Python being used
ps aux | grep uvicorn
# Should show: ./venv/bin/python
```

## Benefits

- ✅ **Isolated**: Won't conflict with conda or system Python
- ✅ **Reproducible**: Same versions every time
- ✅ **Portable**: Works on any machine with Python 3.8+
- ✅ **No conda required**: Just needs Python 3

## Troubleshooting

### "python3: command not found"

```bash
# Install Python 3
sudo apt update
sudo apt install python3 python3-venv python3-pip
```

### "Permission denied" when creating venv

```bash
# Make sure you have write permissions
ls -ld coordinator-service/
# Should show your user, not root

# If owned by root, fix it:
sudo chown -R $USER:$USER coordinator-service/
```

### Dependencies won't install

```bash
# Update pip first
cd coordinator-service
./venv/bin/pip install --upgrade pip

# Then install requirements
./venv/bin/pip install -r requirements.txt
```

### Want to recreate venv from scratch

```bash
# Remove old venv
rm -rf coordinator-service/venv

# Run start script again - it will recreate
./start-coordinator.sh
```

## Next Steps

1. ✅ Python environment is now isolated
2. 🔄 Deploy frontend to Cloudflare Pages
3. 🔄 Start workers to connect

See `QUICK_DEPLOY.md` for full deployment guide.
