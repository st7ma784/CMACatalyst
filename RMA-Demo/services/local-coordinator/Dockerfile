FROM python:3.11-slim

LABEL org.opencontainers.image.source=https://github.com/st7ma784/CMACatalyst
LABEL org.opencontainers.image.description="Local Coordinator - Worker Registry (KV-Free)"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Environment variables
ENV PORT=8080
ENV HOST=0.0.0.0
ENV ENVIRONMENT=production
ENV ALLOWED_ORIGINS=https://rmatool.org.uk,https://api.rmatool.org.uk

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/health').raise_for_status()"

# Run application
CMD ["python", "app.py"]
