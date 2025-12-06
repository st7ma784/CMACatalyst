#!/bin/bash
# Universal Model Download Script
# Downloads AI models on worker spin-up with comprehensive logging
# Supports volume mounting for container hosts to share models

set -e

# ============================================
# Configuration
# ============================================
MODEL_CACHE_DIR="${MODEL_CACHE_DIR:-/models}"
HF_HOME="${HF_HOME:-$MODEL_CACHE_DIR/huggingface}"
OLLAMA_MODELS="${OLLAMA_MODELS:-$MODEL_CACHE_DIR/ollama}"
VLLM_CACHE="${VLLM_CACHE:-$MODEL_CACHE_DIR/vllm}"

# GPU Configuration
MIN_GPU_MEMORY_GB="${MIN_GPU_MEMORY_GB:-8}"
ENABLE_GPU="${ENABLE_GPU:-auto}"

# Logging
LOG_LEVEL="${LOG_LEVEL:-INFO}"
LOG_FILE="${LOG_FILE:-/var/log/model-download.log}"

# ============================================
# Logging Functions
# ============================================
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_success() { log "SUCCESS" "✅ $@"; }

# ============================================
# GPU Detection
# ============================================
detect_gpu() {
    log_info "Detecting GPU capabilities..."

    if command -v nvidia-smi &> /dev/null; then
        GPU_COUNT=$(nvidia-smi --query-gpu=count --format=csv,noheader | head -1)
        GPU_MEMORY=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
        GPU_MEMORY_GB=$((GPU_MEMORY / 1024))

        log_success "GPU detected: $GPU_NAME"
        log_info "  GPU Count: $GPU_COUNT"
        log_info "  GPU Memory: ${GPU_MEMORY_GB}GB"
        log_info "  Required: ${MIN_GPU_MEMORY_GB}GB minimum"

        if [ "$GPU_MEMORY_GB" -lt "$MIN_GPU_MEMORY_GB" ]; then
            log_warn "GPU memory (${GPU_MEMORY_GB}GB) below minimum (${MIN_GPU_MEMORY_GB}GB)"
            log_warn "Some models may not load properly"
            return 1
        fi

        return 0
    else
        log_warn "No GPU detected (nvidia-smi not available)"
        log_info "CPU-only mode will be used"
        return 1
    fi
}

# ============================================
# Volume Mount Detection
# ============================================
check_volume_mounts() {
    log_info "Checking for volume mounts..."
    log_info "═══════════════════════════════════════════════"
    log_info "Model cache directories:"
    log_info "  HuggingFace: $HF_HOME"
    log_info "  Ollama: $OLLAMA_MODELS"
    log_info "  vLLM: $VLLM_CACHE"
    log_info "═══════════════════════════════════════════════"
    log_info ""
    log_info "To mount external volumes and share models:"
    log_info "  docker run -v /host/models:/models ..."
    log_info "  or in docker-compose.yml:"
    log_info "    volumes:"
    log_info "      - /host/models:/models"
    log_info "═══════════════════════════════════════════════"

    # Create directories if they don't exist
    mkdir -p "$HF_HOME" "$OLLAMA_MODELS" "$VLLM_CACHE"

    # Check if directories have existing models
    local hf_size=$(du -sh "$HF_HOME" 2>/dev/null | cut -f1 || echo "0")
    local ollama_size=$(du -sh "$OLLAMA_MODELS" 2>/dev/null | cut -f1 || echo "0")
    local vllm_size=$(du -sh "$VLLM_CACHE" 2>/dev/null | cut -f1 || echo "0")

    log_info "Current cache sizes:"
    log_info "  HuggingFace: $hf_size"
    log_info "  Ollama: $ollama_size"
    log_info "  vLLM: $vllm_size"
}

# ============================================
# Model Download Functions
# ============================================

# Download Ollama models (vision, text)
download_ollama_model() {
    local model_name=$1
    local estimated_size=$2

    log_info "Checking Ollama model: $model_name (estimated: $estimated_size)"

    # Wait for Ollama to be ready
    local max_retries=30
    local retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        if curl -s "${OLLAMA_URL:-http://localhost:11434}/api/tags" > /dev/null 2>&1; then
            break
        fi
        retry_count=$((retry_count + 1))
        log_info "  Waiting for Ollama... ($retry_count/$max_retries)"
        sleep 2
    done

    if [ $retry_count -eq $max_retries ]; then
        log_error "Ollama not available after $max_retries attempts"
        return 1
    fi

    # Check if model already exists
    if curl -s "${OLLAMA_URL:-http://localhost:11434}/api/tags" | grep -q "\"name\":\"$model_name\""; then
        log_success "Model already available: $model_name"
        return 0
    fi

    log_info "📥 Downloading model: $model_name (this may take several minutes...)"
    log_info "  Estimated download size: $estimated_size"
    log_info "  Cache location: $OLLAMA_MODELS"

    # Pull the model with progress
    if curl -X POST "${OLLAMA_URL:-http://localhost:11434}/api/pull" \
        -d "{\"name\": \"$model_name\"}" 2>&1 | tee -a "$LOG_FILE" | grep -q "success"; then
        log_success "Downloaded: $model_name"
        return 0
    else
        # Try with ollama CLI if available
        if command -v ollama &> /dev/null; then
            OLLAMA_MODELS="$OLLAMA_MODELS" ollama pull "$model_name" | tee -a "$LOG_FILE"
            log_success "Downloaded: $model_name"
            return 0
        else
            log_error "Failed to download: $model_name"
            return 1
        fi
    fi
}

# Download HuggingFace models (embeddings, etc.)
download_hf_model() {
    local model_repo=$1
    local estimated_size=$2

    log_info "Checking HuggingFace model: $model_repo (estimated: $estimated_size)"

    # Check if model already cached
    local model_path="$HF_HOME/hub/models--${model_repo//\/+--}"
    if [ -d "$model_path" ]; then
        log_success "Model already cached: $model_repo"
        return 0
    fi

    log_info "📥 Downloading model: $model_repo"
    log_info "  Estimated download size: $estimated_size"
    log_info "  Cache location: $HF_HOME"

    # Use huggingface-cli to download with progress
    if command -v huggingface-cli &> /dev/null; then
        export HF_HOME="$HF_HOME"
        huggingface-cli download "$model_repo" | tee -a "$LOG_FILE"
        log_success "Downloaded: $model_repo"
        return 0
    else
        log_warn "huggingface-cli not available, model will download on first use"
        return 0
    fi
}

# Download vLLM models
download_vllm_model() {
    local model_repo=$1
    local estimated_size=$2

    log_info "Checking vLLM model: $model_repo (estimated: $estimated_size)"

    # vLLM uses HuggingFace cache, so check there
    local model_path="$HF_HOME/hub/models--${model_repo//\/+--}"
    if [ -d "$model_path" ]; then
        log_success "Model already cached: $model_repo"
        return 0
    fi

    log_info "📥 Downloading model: $model_repo"
    log_info "  Estimated download size: $estimated_size"
    log_info "  Cache location: $HF_HOME"
    log_info "  Note: vLLM will download on first inference if not pre-cached"

    # Pre-download using huggingface-cli if available
    if command -v huggingface-cli &> /dev/null; then
        export HF_HOME="$HF_HOME"
        huggingface-cli download "$model_repo" | tee -a "$LOG_FILE"
        log_success "Downloaded: $model_repo"
        return 0
    else
        log_info "Will download on first vLLM startup"
        return 0
    fi
}

# ============================================
# Model Manifest
# ============================================
download_models_for_worker_type() {
    local worker_type=$1

    log_info "═══════════════════════════════════════════════"
    log_info "Downloading models for worker type: $worker_type"
    log_info "═══════════════════════════════════════════════"

    case $worker_type in
        "gpu-worker"|"gpu"|"all")
            log_info "GPU Worker - Loading LLM, Vision, Embedding models"

            # Vision models for OCR
            download_ollama_model "llava:7b" "4.7GB" || log_warn "Failed to download llava:7b"

            # Optional: larger vision model (only if GPU has enough memory)
            if detect_gpu && [ "$GPU_MEMORY_GB" -ge 24 ]; then
                download_ollama_model "llava-next:34b-v1.5-q4_K_M" "~20GB" || log_warn "Failed to download llava-next:34b"
            fi

            # Text generation model (via vLLM)
            download_vllm_model "mistralai/Mistral-7B-Instruct-v0.2" "~14GB" || log_warn "Failed to download Mistral"

            # Embedding model
            download_ollama_model "nomic-embed-text" "274MB" || log_warn "Failed to download nomic-embed-text"
            ;;

        "ocr"|"ocr-worker")
            log_info "OCR Worker - Loading vision models"

            # Primary OCR vision model
            download_ollama_model "llava:7b" "4.7GB" || log_warn "Failed to download llava:7b"

            # Fallback: smaller vision model
            download_ollama_model "llava:latest" "4.7GB" || log_warn "Failed to download llava:latest"
            ;;

        "embedding"|"embedding-worker")
            log_info "Embedding Worker - Loading embedding models"

            # Embedding model
            download_ollama_model "nomic-embed-text" "274MB" || log_warn "Failed to download nomic-embed-text"

            # Alternative: HuggingFace embedding model
            download_hf_model "sentence-transformers/all-MiniLM-L6-v2" "90MB" || log_warn "Failed to download all-MiniLM-L6-v2"
            ;;

        "vllm"|"llm-worker")
            log_info "vLLM Worker - Loading LLM models"

            # LLM model
            download_vllm_model "mistralai/Mistral-7B-Instruct-v0.2" "~14GB" || log_warn "Failed to download Mistral"

            # Text generation via Ollama (fallback)
            download_ollama_model "llama3.2" "2.0GB" || log_warn "Failed to download llama3.2"
            ;;

        "cpu-worker"|"cpu")
            log_info "CPU Worker - Loading lightweight models"

            # Lightweight text model
            download_ollama_model "llama3.2" "2.0GB" || log_warn "Failed to download llama3.2"

            # Embedding model
            download_ollama_model "nomic-embed-text" "274MB" || log_warn "Failed to download nomic-embed-text"
            ;;

        *)
            log_error "Unknown worker type: $worker_type"
            log_info "Valid types: gpu-worker, ocr, embedding, vllm, cpu-worker, all"
            return 1
            ;;
    esac

    log_success "Model download complete for $worker_type"
}

# ============================================
# Main Execution
# ============================================
main() {
    log_info "═══════════════════════════════════════════════"
    log_info "Model Download Script - Worker Spin-up"
    log_info "═══════════════════════════════════════════════"

    # Detect environment
    detect_gpu || log_info "Running in CPU-only mode"
    check_volume_mounts

    # Get worker type from argument or environment
    WORKER_TYPE="${1:-${WORKER_TYPE:-gpu-worker}}"

    log_info ""
    log_info "Worker Type: $WORKER_TYPE"
    log_info "GPU Enabled: $ENABLE_GPU"
    log_info ""

    # Download models
    download_models_for_worker_type "$WORKER_TYPE"

    log_info ""
    log_info "═══════════════════════════════════════════════"
    log_success "Model download script completed"
    log_info "═══════════════════════════════════════════════"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Models are cached in: $MODEL_CACHE_DIR"
    log_info "  2. To share models across containers:"
    log_info "     docker run -v /host/models:/models ..."
    log_info "  3. Check logs at: $LOG_FILE"
    log_info ""
}

# Run main if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
