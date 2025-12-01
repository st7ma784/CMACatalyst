FROM python:3.11-slim

WORKDIR /app

# Install Node.js for frontend build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy and build frontend
COPY frontend /tmp/frontend
WORKDIR /tmp/frontend
RUN npm ci && npm run build

# Copy frontend build to static directory
RUN mkdir -p /app/static && \
    cp -r /tmp/frontend/.next/standalone/* /app/static/ && \
    cp -r /tmp/frontend/.next/static /app/static/.next/ && \
    cp -r /tmp/frontend/public /app/static/ && \
    rm -rf /tmp/frontend

# Copy application code
WORKDIR /app
COPY app/ ./app/
COPY models/ ./models/
COPY routers/ ./routers/
COPY utils/ ./utils/

# Create __init__.py files
RUN touch app/__init__.py models/__init__.py routers/__init__.py utils/__init__.py

# Expose port
EXPOSE 8080

# Run application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
