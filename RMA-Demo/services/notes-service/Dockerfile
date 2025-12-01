FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY llm_provider.py .
COPY notes_graph.py .

# Expose port
EXPOSE 8100

# Run application
CMD ["python", "app.py"]