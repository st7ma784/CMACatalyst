# vLLM Worker Container
# GPU-accelerated LLM inference with coordinator integration

FROM vllm/vllm-openai:v0.3.0

# Install coordinator communication dependencies
RUN pip install --no-cache-dir requests

# Copy coordinator integration script
COPY coordinator_integration.py /app/coordinator_integration.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Environment variables (set by worker agent)
ENV COORDINATOR_URL=""
ENV WORKER_ID=""
ENV MODEL_NAME="meta-llama/Llama-2-7b-hf"
ENV GPU_MEMORY_UTILIZATION="0.9"
ENV MAX_MODEL_LEN="4096"

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
