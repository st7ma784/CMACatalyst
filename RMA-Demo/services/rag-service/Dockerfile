FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PDF processing and OCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY agent_graph.py .
COPY agent_state.py .
COPY agent_nodes.py .
COPY numerical_tools.py .
COPY symbolic_reasoning.py .
COPY decision_tree_builder.py .
COPY tree_visualizer.py .
COPY tools/ ./tools/

# Create directories
RUN mkdir -p /data/vectorstore /manuals

# Expose port
EXPOSE 8102

# Run application
CMD ["python", "app.py"]
