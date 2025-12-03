FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for optional format support
RUN apt-get update && apt-get install -y \
    libmagic1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install MarkItDown with all optional dependencies
# [all] includes: pdf, docx, pptx, xlsx, xls, outlook, audio-transcription, youtube-transcription
RUN pip install --no-cache-dir markitdown[all]==0.1.3

# Copy FastAPI wrapper
COPY app.py .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start service
CMD ["python", "app.py"]
