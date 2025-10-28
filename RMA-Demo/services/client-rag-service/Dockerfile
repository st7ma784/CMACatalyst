FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY numerical_tools.py .
COPY client_agent_state.py .
COPY client_agent_graph.py .
COPY client_agent_nodes.py .
COPY tools/ ./tools/

# Expose port
EXPOSE 8104

# Run application
CMD ["python", "app.py"]
