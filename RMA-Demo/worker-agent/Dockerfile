FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker agent
COPY worker_agent.py .

# Make executable
RUN chmod +x worker_agent.py

# Run worker agent
CMD ["python", "worker_agent.py"]
