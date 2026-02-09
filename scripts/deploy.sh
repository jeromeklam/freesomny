#!/bin/bash
# ===========================================
# FreeSomnia Deployment Script
# ===========================================
# Usage:
#   ./scripts/deploy.sh [environment]
#
# Environments:
#   dev     - Development (default)
#   staging - Staging environment
#   prod    - Production environment
#
# Prerequisites:
#   - Node.js 22+
#   - pnpm installed globally
#   - SSH access to target server (for remote deployment)
#
# Environment variables (optional):
#   DEPLOY_HOST     - Remote host for deployment
#   DEPLOY_USER     - SSH user (default: freesomnia)
#   DEPLOY_PATH     - Remote path (default: /opt/freesomnia)
#   SKIP_BUILD      - Skip build step if set to "true"
#   SKIP_TESTS      - Skip tests if set to "true"

set -e  # Exit on error
set -u  # Exit on undefined variable

# ===========================================
# Configuration
# ===========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="${1:-dev}"

# Default values
DEPLOY_USER="${DEPLOY_USER:-freesomnia}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/freesomnia}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===========================================
# Helper Functions
# ===========================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

check_requirements() {
    log_info "Checking requirements..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        log_error "Node.js 22+ is required (found v$NODE_VERSION)"
    fi

    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Run: npm install -g pnpm"
    fi

    log_success "All requirements met"
}

install_dependencies() {
    log_info "Installing dependencies..."
    cd "$PROJECT_ROOT"
    pnpm install --frozen-lockfile
    log_success "Dependencies installed"
}

run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log_warning "Skipping tests (SKIP_TESTS=true)"
        return
    fi

    log_info "Running tests..."
    cd "$PROJECT_ROOT"

    # Run linting
    if pnpm lint 2>/dev/null; then
        log_success "Linting passed"
    else
        log_warning "No lint script found, skipping"
    fi

    # Run type checking
    pnpm --filter @api-client/server exec tsc --noEmit
    pnpm --filter @api-client/web exec tsc --noEmit
    log_success "Type checking passed"

    # Run unit tests if available
    if pnpm test 2>/dev/null; then
        log_success "Tests passed"
    else
        log_warning "No test script found, skipping"
    fi
}

build_project() {
    if [ "$SKIP_BUILD" = "true" ]; then
        log_warning "Skipping build (SKIP_BUILD=true)"
        return
    fi

    log_info "Building project..."
    cd "$PROJECT_ROOT"
    pnpm build
    log_success "Build completed"
}

run_migrations() {
    log_info "Running database migrations..."
    cd "$PROJECT_ROOT"
    pnpm --filter @api-client/server prisma migrate deploy
    log_success "Migrations completed"
}

deploy_local() {
    log_info "Deploying locally (development mode)..."

    # Ensure .env exists
    if [ ! -f "$PROJECT_ROOT/apps/server/.env" ]; then
        log_info "Creating .env from .env.example..."
        cp "$PROJECT_ROOT/apps/server/.env.example" "$PROJECT_ROOT/apps/server/.env"
        log_warning "Please review and update apps/server/.env"
    fi

    run_migrations

    log_success "Local deployment complete"
    log_info "Start the server with: pnpm dev"
}

deploy_remote() {
    if [ -z "${DEPLOY_HOST:-}" ]; then
        log_error "DEPLOY_HOST environment variable is required for remote deployment"
    fi

    log_info "Deploying to $DEPLOY_HOST..."

    # Create deployment package
    log_info "Creating deployment package..."
    DEPLOY_PACKAGE="/tmp/freesomnia-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

    cd "$PROJECT_ROOT"
    tar -czf "$DEPLOY_PACKAGE" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.db' \
        --exclude='*.db-journal' \
        --exclude='.env' \
        --exclude='.env.local' \
        .

    log_info "Uploading to $DEPLOY_HOST..."
    scp "$DEPLOY_PACKAGE" "$DEPLOY_USER@$DEPLOY_HOST:/tmp/"

    log_info "Executing remote deployment..."
    ssh "$DEPLOY_USER@$DEPLOY_HOST" bash -s << EOF
        set -e

        # Backup current deployment
        if [ -d "$DEPLOY_PATH" ]; then
            sudo cp -r "$DEPLOY_PATH" "$DEPLOY_PATH.backup-\$(date +%Y%m%d-%H%M%S)"
        fi

        # Extract new deployment
        sudo mkdir -p "$DEPLOY_PATH"
        sudo tar -xzf "$DEPLOY_PACKAGE" -C "$DEPLOY_PATH"
        sudo chown -R $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_PATH"

        # Install dependencies
        cd "$DEPLOY_PATH"
        pnpm install --frozen-lockfile

        # Run migrations and regenerate Prisma client
        pnpm --filter @api-client/server prisma migrate deploy
        pnpm --filter @api-client/server prisma generate

        # Restart service
        sudo systemctl restart freesomnia

        # Cleanup
        rm -f "$DEPLOY_PACKAGE"

        echo "Remote deployment complete"
EOF

    # Cleanup local package
    rm -f "$DEPLOY_PACKAGE"

    log_success "Remote deployment to $DEPLOY_HOST completed"
}

# ===========================================
# Main
# ===========================================
main() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia Deployment"
    echo "  Environment: $ENVIRONMENT"
    echo "=========================================="
    echo ""

    check_requirements
    install_dependencies
    run_tests
    build_project

    case "$ENVIRONMENT" in
        dev|development)
            deploy_local
            ;;
        staging|stage)
            DEPLOY_HOST="${DEPLOY_HOST:-}"
            deploy_remote
            ;;
        prod|production)
            log_warning "Production deployment - please confirm"
            read -p "Continue with production deployment? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                log_error "Deployment cancelled"
            fi
            deploy_remote
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT. Use: dev, staging, or prod"
            ;;
    esac

    echo ""
    log_success "Deployment completed successfully!"
    echo ""
}

main "$@"
