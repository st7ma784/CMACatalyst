FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Create directories
RUN mkdir -p /data/vectorstore /manuals

# Expose port
EXPOSE 8102

# Run application
CMD ["python", "app.py"]
