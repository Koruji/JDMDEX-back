#!/bin/bash

# =============================================================================
# JDMDex API Deployment Script
# Usage: ./scripts/deploy.sh [branch]
# Example: ./scripts/deploy.sh main
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="jdmdex-back"
REPO_URL="https://github.com/loocist/JDMDEX-back.git"
DEPLOY_DIR="/home/$(whoami)/JDMDEX-back"
BRANCH=${1:-main}

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
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

log_info "Starting deployment of ${APP_NAME} from branch ${BRANCH}..."

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

# Step 2: Install production dependencies
log_info "Installing production dependencies..."
npm ci --only=production

# Step 3: Verify .env exists
if [ ! -f ".env" ]; then
    log_warn "No .env file found! Copying from .env.example if it exists..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_warn "⚠️  You MUST edit .env with real values!"
    else
        log_error "No .env or .env.example file found!"
        exit 1
    fi
fi

# Step 4: Restart service with PM2
log_info "Restarting service with PM2..."
if pm2 list | grep -q "${APP_NAME}"; then
    pm2 restart ${APP_NAME}
    log_info "Service restarted successfully"
else
    pm2 start src/app.js --name ${APP_NAME}
    pm2 save
    pm2 startup
    log_info "New service started and saved"
fi

# Step 5: Verify service is running
log_info "Verifying service..."
sleep 3
pm2 list
pm2 show ${APP_NAME}

# Step 6: Check logs for errors
log_info "Checking for errors in logs..."
if pm2 logs ${APP_NAME} --lines 20 | grep -i "error\|fail\|exception" > /dev/null 2>&1; then
    log_warn "⚠️  Potential errors found in logs. Check with: pm2 logs ${APP_NAME}"
else
    log_info "✅ No errors detected in recent logs"
fi

log_info "=========================================="
log_info "Deployment complete!"
log_info "Service is running at: http://localhost:$(grep PORT .env | cut -d'=' -f2)"
log_info "=========================================="
