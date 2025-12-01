#!/bin/bash
set -e

echo "🚀 Starting vLLM Worker"
echo "   Coordinator: $COORDINATOR_URL"
echo "   Worker ID: $WORKER_ID"
echo "   Model: $MODEL_NAME"

# Start coordinator integration in background
python /app/coordinator_integration.py &

# Start vLLM server
exec python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL_NAME" \
    --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
    --max-model-len "$MAX_MODEL_LEN" \
    --host 0.0.0.0 \
    --port 8000
