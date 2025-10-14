#!/bin/bash
# Complete Docker and NVIDIA Container Toolkit Reinstallation
# With rootless support for GPU access

set -e

echo "========================================="
echo "Docker + NVIDIA Container Toolkit Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to wait for apt locks to be released
wait_for_apt() {
    echo -e "${YELLOW}Waiting for apt locks to be released...${NC}"
    while sudo fuser /var/lib/dpkg/lock >/dev/null 2>&1 || \
          sudo fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || \
          sudo fuser /var/cache/apt/archives/lock >/dev/null 2>&1; do
        echo "Waiting for other package managers to finish..."
        sleep 2
    done
    echo -e "${GREEN}✓ Apt locks released${NC}"
}

echo -e "${YELLOW}Checking for existing package manager processes...${NC}"
wait_for_apt

echo -e "${YELLOW}Step 1: Stopping all containers and removing old Docker installation${NC}"
# Stop all running containers
sudo docker stop $(sudo docker ps -aq) 2>/dev/null || true
sudo docker rm $(sudo docker ps -aq) 2>/dev/null || true

# Remove old Docker packages
sudo apt-get remove -y docker docker-engine docker.io containerd runc docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true

# Remove old NVIDIA container toolkit
sudo apt-get remove -y nvidia-container-toolkit nvidia-docker2 2>/dev/null || true
sudo apt-get purge -y nvidia-container-toolkit nvidia-docker2 2>/dev/null || true

# Clean up old files
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd
sudo rm -rf /etc/docker
sudo rm -f /etc/apt/sources.list.d/nvidia-docker.list

echo -e "${GREEN}✓ Old installation removed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Installing Docker CE${NC}"
# Update package index
wait_for_apt
sudo apt-get update

# Install prerequisites
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
wait_for_apt
sudo apt-get update
wait_for_apt
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo -e "${GREEN}✓ Docker CE installed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Installing NVIDIA Container Toolkit${NC}"
# Configure the repository
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install the NVIDIA Container Toolkit packages
wait_for_apt
sudo apt-get update
wait_for_apt
sudo apt-get install -y nvidia-container-toolkit

echo -e "${GREEN}✓ NVIDIA Container Toolkit installed${NC}"
echo ""

echo -e "${YELLOW}Step 4: Configuring Docker for NVIDIA GPU support${NC}"
# Configure the container runtime
sudo nvidia-ctk runtime configure --runtime=docker

# Create daemon.json with nvidia runtime as default
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "default-runtime": "nvidia",
  "runtimes": {
    "nvidia": {
      "path": "nvidia-container-runtime",
      "runtimeArgs": []
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

echo -e "${GREEN}✓ Docker daemon configured${NC}"
echo ""

echo -e "${YELLOW}Step 5: Setting up user permissions${NC}"
# Add user to docker group
sudo usermod -aG docker $USER

# Set proper permissions for docker socket
sudo chown root:docker /var/run/docker.sock
sudo chmod 660 /var/run/docker.sock

echo -e "${GREEN}✓ User permissions configured${NC}"
echo ""

echo -e "${YELLOW}Step 6: Restarting Docker daemon${NC}"
sudo systemctl daemon-reload
sudo systemctl restart docker
sudo systemctl enable docker

echo -e "${GREEN}✓ Docker daemon restarted${NC}"
echo ""

echo -e "${YELLOW}Step 7: Verifying installation${NC}"
echo "Docker version:"
sudo docker --version
echo ""
echo "Docker Compose version:"
sudo docker compose version
echo ""
echo "NVIDIA Container Toolkit version:"
nvidia-ctk --version
echo ""

echo -e "${YELLOW}Step 8: Testing GPU access${NC}"
echo "Running nvidia-smi in a container..."
sudo docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi

echo ""
echo -e "${GREEN}========================================="
echo "Installation Complete!"
echo "=========================================${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT NOTES:${NC}"
echo "1. You may need to log out and back in for group changes to take effect"
echo "2. Or run: newgrp docker"
echo "3. Test with: docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi"
echo ""
echo -e "${GREEN}You can now restart your Ollama service with GPU support!${NC}"
