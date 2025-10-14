#!/bin/bash
# Quick fix for Docker connectivity

echo "Unsetting incorrect DOCKER_HOST and activating docker group..."

# Unset DOCKER_HOST
unset DOCKER_HOST

# Activate docker group
exec newgrp docker
