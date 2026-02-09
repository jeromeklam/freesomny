#!/bin/bash
# ===========================================
# FreeSomnia — Build Deployment Kit
# ===========================================
#
# Creates a self-contained deployment tarball that can be
# copied to a server and installed with install.sh.
#
# Usage:
#   ./scripts/make-kit.sh
#
# Output:
#   freesomnia-deploy-{version}-{date}.tar.gz
#
# The kit contains:
#   - web-dist/          Built frontend (static files)
#   - server-dist/       Built backend (JS)
#   - prisma/            Prisma schema + migrations
#   - server-package.json  Server package.json for deps
#   - pnpm-lock.yaml     Lockfile for reproducible installs
#   - .env.example       Sample configuration
#   - freesomnia.service Systemd service file
#   - install.sh         Deployment/installation script
#   - migrate-*.sql      PostgreSQL migration scripts
#   - README-INSTALL.md  Installation instructions

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ===========================================
# Extract version from shared package
# ===========================================
get_version() {
    local version_file="$PROJECT_ROOT/packages/shared/src/version.ts"
    if [ -f "$version_file" ]; then
        grep "APP_VERSION" "$version_file" | head -1 | sed "s/.*'\(.*\)'.*/\1/"
    else
        echo "0.0.0"
    fi
}

# ===========================================
# Main
# ===========================================
main() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia — Build Deployment Kit"
    echo "=========================================="
    echo ""

    cd "$PROJECT_ROOT"

    # 1. Build
    log_info "Building project..."
    pnpm build
    log_success "Build complete"

    # 2. Check build artifacts exist
    if [ ! -d "apps/web/dist" ]; then
        log_error "Frontend build not found at apps/web/dist"
    fi
    if [ ! -d "apps/server/dist" ]; then
        log_error "Backend build not found at apps/server/dist"
    fi

    # 3. Prepare kit directory
    VERSION=$(get_version)
    DATE=$(date +%Y%m%d)
    KIT_NAME="freesomnia-deploy-${VERSION}-${DATE}"
    KIT_DIR="/tmp/$KIT_NAME"

    rm -rf "$KIT_DIR"
    mkdir -p "$KIT_DIR"

    log_info "Assembling kit: $KIT_NAME"

    # Frontend
    cp -r apps/web/dist "$KIT_DIR/web-dist"
    log_success "Frontend copied"

    # Backend
    cp -r apps/server/dist "$KIT_DIR/server-dist"
    log_success "Backend copied"

    # Prisma schema + migrations
    cp -r apps/server/prisma "$KIT_DIR/prisma"
    log_success "Prisma schema copied"

    # Server package.json (for npm install --prod)
    cp apps/server/package.json "$KIT_DIR/server-package.json"

    # Lockfile
    if [ -f pnpm-lock.yaml ]; then
        cp pnpm-lock.yaml "$KIT_DIR/pnpm-lock.yaml"
    fi

    # .env.example
    cp apps/server/.env.example "$KIT_DIR/.env.example"

    # Systemd service
    cp apps/server/freesomnia.service "$KIT_DIR/freesomnia.service"

    # Install script
    cp scripts/install.sh "$KIT_DIR/install.sh"
    chmod +x "$KIT_DIR/install.sh"

    # PostgreSQL migration scripts
    for sql_file in scripts/migrate-postgresql*.sql; do
        [ -f "$sql_file" ] && cp "$sql_file" "$KIT_DIR/"
    done

    # README
    cp scripts/README-INSTALL.md "$KIT_DIR/README-INSTALL.md" 2>/dev/null || true

    log_success "Kit assembled"

    # 4. Create tarball
    TARBALL="$PROJECT_ROOT/$KIT_NAME.tar.gz"
    cd /tmp
    tar -czf "$TARBALL" "$KIT_NAME"
    rm -rf "$KIT_DIR"

    SIZE=$(du -h "$TARBALL" | cut -f1)

    echo ""
    log_success "Kit created: $KIT_NAME.tar.gz ($SIZE)"
    echo ""
    echo "  To deploy:"
    echo "    1. scp $KIT_NAME.tar.gz server:/tmp/"
    echo "    2. ssh server"
    echo "    3. cd /tmp && tar xzf $KIT_NAME.tar.gz"
    echo "    4. cd $KIT_NAME"
    echo "    5. sudo ./install.sh install   # first time"
    echo "       sudo ./install.sh deploy    # updates"
    echo ""
}

main "$@"
