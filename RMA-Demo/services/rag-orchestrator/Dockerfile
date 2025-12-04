# RAG System Orchestrator
# Monitors coordinator and triggers manual ingestion when system is ready

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir requests

# Copy orchestrator script
COPY orchestrator.py .

# Environment variables
ENV COORDINATOR_URL="https://api.rmatool.org.uk"
ENV MANUALS_PATH="/manuals"
ENV CHECK_INTERVAL="60"

# Run orchestrator
CMD ["python", "orchestrator.py"]
