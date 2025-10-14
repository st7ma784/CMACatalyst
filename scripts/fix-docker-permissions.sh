#!/bin/bash
# Fix Docker permissions and socket issues

echo "Fixing Docker socket permissions and user access..."

# Check if user is in docker group
if ! groups | grep -q docker; then
    echo "Adding user to docker group..."
    sudo usermod -aG docker $USER
fi

# Fix socket permissions
echo "Setting correct socket permissions..."
sudo chown root:docker /var/run/docker.sock 2>/dev/null || true
sudo chmod 660 /var/run/docker.sock 2>/dev/null || true

# Remove any incorrect DOCKER_HOST environment variable
echo "Checking environment variables..."
if [ ! -z "$DOCKER_HOST" ]; then
    echo "WARNING: DOCKER_HOST is set to: $DOCKER_HOST"
    echo "This should typically be unset for system Docker."
    echo "To unset it, run: unset DOCKER_HOST"
fi

# Check for rootless Docker conflict
if [ -d "$HOME/.docker" ]; then
    echo "Found user-level Docker directory at $HOME/.docker"
    if [ -S "$HOME/.docker/run/docker.sock" ]; then
        echo "WARNING: Rootless Docker socket found!"
        echo "You have both system Docker and rootless Docker."
        echo "Recommendation: Remove rootless Docker to avoid conflicts."
        read -p "Remove rootless Docker? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            dockerd-rootless-setuptool.sh uninstall
            rm -rf $HOME/.docker
            echo "Rootless Docker removed."
        fi
    fi
fi

echo ""
echo "==================================="
echo "To activate docker group membership:"
echo "==================================="
echo "Run ONE of these commands:"
echo ""
echo "  newgrp docker"
echo ""
echo "OR log out and log back in."
echo ""
echo "Then test with: docker ps"
echo ""
