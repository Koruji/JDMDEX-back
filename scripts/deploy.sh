#!/bin/bash

# =============================================================================
# JDMDex API Deployment Script (Docker)
# Usage: ./scripts/deploy.sh [branch]
# Example: ./scripts/deploy.sh develop
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="jdmdex-api"
REPO_URL="https://github.com/loocist/JDMDEX-back.git"
BRANCH=${1:-develop}

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$(whoami)" = "root" ]; then
    log_error "Do not run this script as root!"
    exit 1
fi

# Check if in the right directory
if [ ! -f "docker-compose.yml" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed. Please install it first."
    exit 1
fi

log_info "Starting Docker deployment of ${CONTAINER_NAME} from branch ${BRANCH}..."

# Step 1: Pull latest changes
log_info "Pulling latest changes from GitHub..."
if [ -d ".git" ]; then
    git fetch origin
    git checkout ${BRANCH}
    git pull origin ${BRANCH}
else
    log_error "This is not a git repository!"
    exit 1
fi

# Step 2: Verify .env exists
if [ ! -f ".env" ]; then
    log_warn "No .env file found! Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_warn "⚠️  You MUST edit .env with real values!"
    else
        log_error "No .env or .env.example file found!"
        exit 1
    fi
fi

# Step 3: Stop current containers
log_info "Stopping current containers..."
docker-compose down || true

# Step 4: Build and start with Docker Compose
log_info "Building Docker image..."
docker-compose build --no-cache

log_info "Starting containers..."
docker-compose up -d --remove-orphans

# Step 5: Verify containers are running
log_info "Verifying containers..."
sleep 10

docker-compose ps

# Step 6: Check logs for errors
log_info "Checking container logs..."
if docker-compose logs --tail=20 | grep -i "error\|fail\|exception" > /dev/null 2>&1; then
    log_warn "⚠️  Potential errors found in logs. Check with: docker-compose logs"
else
    log_info "✅ No errors detected in recent logs"
fi

# Step 7: Show running containers
log_info "Running containers:"
docker-compose ps

log_info "=========================================="
log_info "Docker deployment complete!"
log_info "API is running at: http://localhost:$(grep PORT .env | cut -d'=' -f2 || echo '3000')"
log_info "=========================================="

# Show helpful commands
log_info ""
log_info "To view logs:       docker-compose logs -f ${CONTAINER_NAME}"
log_info "To stop containers: docker-compose down"
log_info "To restart:          docker-compose restart ${CONTAINER_NAME}"
