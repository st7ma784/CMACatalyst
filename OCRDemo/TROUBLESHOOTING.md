# Docker Build Troubleshooting Guide

This guide helps resolve common Docker build issues with the OCR Demo system.

## 🔧 Quick Fixes

### 1. Dependency Conflicts (Most Common)

**Error:** `ERROR: Cannot install -r requirements.txt... conflicting dependencies`

**Solution:**
```bash
# Use minimal requirements for testing
cp requirements-minimal.txt requirements.txt
./test-build.sh
```

### 2. Docker Compose Not Found

**Error:** `Command 'docker-compose' not found`

**Solutions:**
```bash
# Option 1: Install Docker Compose plugin (recommended)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Option 2: Install standalone Docker Compose
sudo apt-get install docker-compose

# Option 3: Use Snap
sudo snap install docker

# Verify installation
docker compose version
# OR
docker-compose --version
```

### 3. Permission Issues

**Error:** `permission denied while trying to connect to the Docker daemon`

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or use sudo for docker commands
sudo ./setup.sh
```

### 4. Network/Download Issues

**Error:** `ERROR: Could not find a version that satisfies the requirement...`

**Solutions:**
```bash
# Clear Docker cache
docker system prune -f

# Use alternative mirror
pip install --index-url https://pypi.org/simple/ -r requirements.txt

# Build with network host
docker build --network=host -t ocr-demo .
```

### 5. Disk Space Issues

**Error:** `no space left on device`

**Solutions:**
```bash
# Clean Docker system
docker system prune -a -f

# Remove unused images
docker image prune -a -f

# Check disk space
df -h
```

## 🛠️ Step-by-Step Resolution

### Step 1: Test Docker Installation
```bash
docker --version
docker run hello-world
```

### Step 2: Test Simple Build
```bash
./test-build.sh
```

### Step 3: Check Requirements Compatibility
```bash
# Test with minimal requirements
cp requirements-minimal.txt requirements.txt
docker build -t test-ocr .
```

### Step 4: Full System Test
```bash
# If build succeeds, try full setup
./setup.sh
```

## 📋 Environment-Specific Solutions

### Ubuntu/Debian
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin
```

### CentOS/RHEL
```bash
# Install Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### macOS
```bash
# Install Docker Desktop
brew install --cask docker

# Or manual download from: https://www.docker.com/products/docker-desktop
```

### Windows
```bash
# Install Docker Desktop for Windows
# Download from: https://www.docker.com/products/docker-desktop

# Or use WSL2 with Linux instructions
```

## 🔍 Debugging Commands

### Check Docker Status
```bash
docker info
docker version
systemctl status docker  # Linux only
```

### Monitor Build Process
```bash
docker build --progress=plain --no-cache -t ocr-demo .
```

### Check Running Containers
```bash
docker ps -a
docker logs <container_id>
```

### Check Images
```bash
docker images
docker history ocr-demo
```

## 🚨 Common Error Messages

### "Package has no installation candidate"
- Update package lists: `sudo apt-get update`
- Check network connectivity
- Try different package mirror

### "Docker daemon not running"
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### "buildx not found"
```bash
# Update Docker to latest version
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### "No such file or directory"
- Ensure you're in the OCRDemo directory
- Check all required files exist: `ls -la`

## 🔄 Alternative Installation Methods

### Method 1: Without Docker
```bash
# Install Python dependencies locally (not recommended for production)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

### Method 2: Using Podman (Docker alternative)
```bash
# Install Podman
sudo apt-get install podman

# Use podman instead of docker
alias docker=podman
./setup.sh
```

### Method 3: Manual Service Setup
```bash
# Install services separately
sudo apt-get install tesseract-ocr redis-server postgresql-client

# Configure each service manually
# (Advanced users only)
```

## 📞 Getting Help

If you're still experiencing issues:

1. **Check logs:** `./test-build.sh` for detailed error output
2. **Update system:** `sudo apt-get update && sudo apt-get upgrade`
3. **Try minimal build:** Use `requirements-minimal.txt`
4. **Check GitHub issues:** Look for similar problems
5. **System requirements:** Ensure 4GB RAM, 10GB disk space

## ✅ Success Indicators

You know the build is working when:
- `./test-build.sh` completes without errors
- `docker images` shows the ocr-demo image
- `./setup.sh` starts all services
- Dashboard loads at `http://localhost:5001`