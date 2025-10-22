FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Create data directory
RUN mkdir -p /data/uploads

# Expose port
EXPOSE 8103

# Run application
CMD ["python", "app.py"]
