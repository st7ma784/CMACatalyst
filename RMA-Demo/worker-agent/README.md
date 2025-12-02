# RMA Worker Agent

Worker agent for contributing compute resources to the RMA distributed system.

## Installation

### Prerequisites

1. **Docker**: Worker agent requires Docker to run containers
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com | sh

   # Add user to docker group
   sudo usermod -aG docker $USER

   # Log out and back in for group to take effect
   ```

2. **Python 3.8+**: Worker agent is written in Python
   ```bash
   python3 --version  # Check version
   ```

### Install Worker Agent

```bash
cd worker-agent

# Install dependencies
pip install -r requirements.txt

# Optional: Install GPU support (for NVIDIA GPUs)
pip install gputil

# Make script executable
chmod +x worker_agent.py
```

## Usage

### Basic Usage

```bash
# Register with default coordinator (localhost)
python worker_agent.py

# Register with specific coordinator
python worker_agent.py --coordinator https://api.rmatool.org.uk

# Set coordinator via environment variable
export COORDINATOR_URL=https://api.rmatool.org.uk
python worker_agent.py
```

### Test Capabilities

Before registering, you can test what capabilities will be detected:

```bash
python worker_agent.py --test-capabilities
```

Output example:
```json
{
  "gpu_memory": "24564MB",
  "gpu_type": "NVIDIA GeForce RTX 4090",
  "gpu_driver": "nvidia",
  "cpu_cores": 16,
  "ram": "64.0GB",
  "storage": "1024.5GB"
}
```

### Run as Systemd Service (Linux)

For persistent worker operation:

```bash
# Create systemd service file
sudo nano /etc/systemd/system/rma-worker.service
```

Add content:
```ini
[Unit]
Description=RMA Worker Agent
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=your-username
Environment="COORDINATOR_URL=https://api.rmatool.org.uk"
WorkingDirectory=/path/to/worker-agent
ExecStart=/usr/bin/python3 /path/to/worker-agent/worker_agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rma-worker
sudo systemctl start rma-worker
sudo systemctl status rma-worker
```

View logs:
```bash
sudo journalctl -u rma-worker -f
```

### Run with Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  rma-worker:
    build: .
    environment:
      COORDINATOR_URL: https://api.rmatool.org.uk
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

## How It Works

1. **Detection**: Worker detects hardware capabilities (GPU, CPU, RAM)
2. **Registration**: Contacts coordinator and receives tier assignment
3. **Container Pull**: Downloads assigned container images
4. **Container Start**: Starts containers with appropriate GPU access
5. **Heartbeat**: Sends health status every 30 seconds
6. **Monitoring**: Monitors system load and reports to coordinator

## Tier Assignment

Based on your hardware, you'll be assigned to a tier:

### Tier 1: GPU Workers (High Power)
**Requirements**: 8GB+ VRAM, GPU (NVIDIA/AMD)
**Assigned**: vLLM or Ollama Vision containers

### Tier 2: Service Workers (Medium Power)
**Requirements**: 4GB+ RAM, 2+ CPU cores
**Assigned**: RAG, Notes, NER, or OCR service containers

### Tier 3: Data Workers (Light Power)
**Requirements**: 2GB+ RAM
**Assigned**: PostgreSQL, Neo4j, ChromaDB, or Redis containers

## Troubleshooting

### GPU Not Detected

**NVIDIA GPUs**:
```bash
# Check if nvidia-smi works
nvidia-smi

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

**AMD GPUs**:
```bash
# Check ROCm installation
rocm-smi

# Install ROCm if needed
# https://rocmdocs.amd.com/en/latest/Installation_Guide/Installation-Guide.html
```

### Docker Permission Denied

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in
```

### Container Failed to Start

```bash
# Check Docker logs
docker logs <container-name>

# Check worker agent logs
python worker_agent.py  # Run in foreground to see errors
```

### Can't Connect to Coordinator

```bash
# Test connection
curl https://api.rmatool.org.uk/health

# Check firewall
sudo ufw status
```

## Security

- Worker agent only communicates with coordinator (no direct worker-to-worker)
- Containers run in isolated Docker environment
- No sensitive data stored on worker
- Can be stopped at any time without data loss

## Contributing Compute

By running a worker, you contribute to:
- Distributed AI inference processing
- Reduced centralized infrastructure costs
- Community-powered compute pool

### Incentive System (Future)
- Earn credits for compute time donated
- Priority access when system is at capacity
- Community recognition and leaderboards

## Stopping the Worker

### Graceful Shutdown
```bash
# Press Ctrl+C in terminal
# Or send SIGTERM
kill <worker-pid>
```

The worker will:
1. Stop accepting new tasks
2. Complete current tasks
3. Stop and remove containers
4. Unregister from coordinator

### Force Stop
```bash
# Force kill (not recommended)
kill -9 <worker-pid>

# Cleanup orphaned containers
docker ps -a | grep rma- | awk '{print $1}' | xargs docker rm -f
```

## Support

Issues? Questions?
- GitHub Issues: https://github.com/your-org/rma-demo/issues
- Documentation: https://docs.rma.ai
