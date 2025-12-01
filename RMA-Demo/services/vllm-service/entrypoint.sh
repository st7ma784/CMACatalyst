#!/bin/bash

# vLLM Model Download and Server Startup Script
# Automatically downloads specified model on first run
# Subsequent runs use cached model

set -e

MODEL_NAME="${MODEL_NAME:-meta-llama/Llama-2-7b-hf}"
HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-.cache/huggingface/hub}"
VLLM_ALLOW_RUNTIME_LORA_UPDATING="${VLLM_ALLOW_RUNTIME_LORA_UPDATING:-1}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.9}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-4096}"
TENSOR_PARALLEL_SIZE="${TENSOR_PARALLEL_SIZE:-1}"

echo "🚀 Starting vLLM Server"
echo "📦 Model: $MODEL_NAME"
echo "💾 Cache: $HUGGINGFACE_HUB_CACHE"
echo "🎯 GPU Memory: $GPU_MEMORY_UTILIZATION"
echo ""

# Check if we need to download the model
if [ ! -d "$HUGGINGFACE_HUB_CACHE" ]; then
    echo "📥 Creating Hugging Face cache directory..."
    mkdir -p "$HUGGINGFACE_HUB_CACHE"
fi

echo "⏳ Initializing vLLM with model: $MODEL_NAME"
echo "   This may take several minutes on first run..."
echo ""

# Run vLLM with OpenAI-compatible API
python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL_NAME" \
    --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
    --max-model-len "$MAX_MODEL_LEN" \
    --tensor-parallel-size "$TENSOR_PARALLEL_SIZE" \
    --host 0.0.0.0 \
    --port 8000 \
    --served-model-name llm \
    --disable-log-requests
