# ChromaDB Storage Worker Container

## ⚠️ DEPRECATED - Use Universal Worker Instead

This container is **deprecated**. Please use the `universal-worker` container with `WORKER_TYPE=storage` instead.

### Why Deprecated?

1. **Dynamic Service Allocation**: The new architecture uses the universal worker that can run ANY storage service (ChromaDB, Redis, PostgreSQL, MinIO, Neo4j) based on coordinator assignments
2. **Better Resource Utilization**: Universal worker can multi-task storage services efficiently
3. **Unified Codebase**: Single container for all worker types (GPU, CPU, Storage, Edge)

### Migration

**Old way (deprecated):**
```bash
docker run -d --name chromadb-worker \
  -v ./chroma-data:/chroma/chroma \
  worker-containers/chromadb
```

**New way (recommended):**
```bash
docker run -d --name rma-storage-worker \
  -v ./chroma-data:/chroma/chroma \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=storage \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

The coordinator will automatically assign ChromaDB (and potentially Redis/PostgreSQL) based on system gaps.

## Fixed Bug

If you're seeing this error:
```
/docker_entrypoint.sh: line 13: exec: chroma: not found
```

**Problem:** ChromaDB doesn't have a `chroma` CLI command. It's a Python package with a FastAPI application.

**Fix Applied:** Updated `CMD` to use `uvicorn chromadb.app:app` instead of `chroma run`.

**Better Solution:** Use the universal-worker container which handles this correctly.

## For Legacy Use Only

If you must use this container for some reason, it now correctly starts ChromaDB with:

```dockerfile
CMD python worker_agent.py & exec uvicorn chromadb.app:app --host 0.0.0.0 --port ${CHROMADB_PORT}
```

But seriously, use the universal-worker instead! 😊
