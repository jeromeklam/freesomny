#!/bin/bash
# ===========================================
# FreeSomnia — Build Deployment Kit
# ===========================================
#
# Creates a SELF-CONTAINED tarball. The server just
# copies files and starts. No pnpm, no npm, no prisma
# needed on the target machine.
#
# Uses "pnpm deploy" to create a standalone server
# with flat node_modules (no symlinks, no workspace).
#
# Usage:  ./scripts/make-kit.sh
# Output: freesomnia-deploy-{version}-{date}.tar.gz

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC} $1"; }
log_error()   { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

get_version() {
    local f="$PROJECT_ROOT/packages/shared/src/version.ts"
    [ -f "$f" ] && grep "APP_VERSION" "$f" | head -1 | sed "s/.*'\(.*\)'.*/\1/" || echo "0.0.0"
}

# Restore original schema on ANY exit (success or failure)
SCHEMA_ORIG=""
cleanup() {
    [ -n "$SCHEMA_ORIG" ] && [ -f "$SCHEMA_ORIG" ] && mv "$SCHEMA_ORIG" "${SCHEMA_ORIG%.orig}"
}
trap cleanup EXIT

main() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia — Build Deployment Kit"
    echo "=========================================="
    echo ""

    cd "$PROJECT_ROOT"

    # ── 1. Build ───────────────────────────────────
    log_info "Building project..."
    pnpm build
    log_success "Build complete"

    [ -d "apps/web/dist" ]    || log_error "Missing apps/web/dist"
    [ -d "apps/server/dist" ] || log_error "Missing apps/server/dist"

    # ── 2. Kit directory ───────────────────────────
    VERSION=$(get_version)
    KIT_NAME="freesomnia-deploy-${VERSION}-$(date +%Y%m%d)"
    KIT_DIR="/tmp/$KIT_NAME"
    rm -rf "$KIT_DIR"

    log_info "Kit: $KIT_NAME"

    # ── 3. Patch schema BEFORE deploy ────────────
    # @prisma/client postinstall runs "prisma generate" automatically
    # when the prisma CLI is available. Patching the source ensures
    # the generated client targets PostgreSQL.
    local schema="$PROJECT_ROOT/apps/server/prisma/schema.prisma"
    SCHEMA_ORIG="${schema}.orig"
    cp "$schema" "$SCHEMA_ORIG"

    sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/' "$schema"
    rm -f "${schema}.bak"

    # Cross-platform: add Linux binary targets when building on macOS
    if [[ "$(uname)" == "Darwin" ]] && ! grep -q "binaryTargets" "$schema"; then
        log_info "Adding Linux binary targets (cross-platform build)"
        perl -i -pe 's/(provider = "prisma-client-js")/$1\n  binaryTargets = ["native", "debian-openssl-3.0.x"]/' "$schema"
    fi

    # ── 4. Deploy server (standalone, flat node_modules) ──
    log_info "Creating standalone server package..."
    pnpm --filter @api-client/server deploy --prod "$KIT_DIR/apps/server"

    # Restore original schema (also handled by trap on failure)
    mv "$SCHEMA_ORIG" "$schema"
    SCHEMA_ORIG=""

    # Remove source files (not needed in production)
    rm -rf "$KIT_DIR/apps/server/src" \
           "$KIT_DIR/apps/server/tsconfig.json" \
           "$KIT_DIR/apps/server/.env.example"
    log_success "Server + node_modules ready"

    # ── 5. Ensure Prisma client is generated ───────
    # @prisma/client postinstall may or may not have generated.
    # Run explicit generate as insurance using any available prisma CLI.
    local prisma_bin=""
    for p in \
        "$KIT_DIR/apps/server/node_modules/.bin/prisma" \
        "$PROJECT_ROOT/apps/server/node_modules/.bin/prisma" \
        "$PROJECT_ROOT/node_modules/.bin/prisma" \
        ; do
        [ -x "$p" ] && { prisma_bin="$p"; break; }
    done

    if [ -n "$prisma_bin" ]; then
        log_info "Generating Prisma client (PostgreSQL)..."
        cd "$KIT_DIR/apps/server"
        "$prisma_bin" generate --schema=prisma/schema.prisma
        log_success "Prisma client generated"
    else
        log_info "Prisma CLI not found — relying on @prisma/client postinstall"
    fi

    # ── 6. Frontend ────────────────────────────────
    cd "$PROJECT_ROOT"
    mkdir -p "$KIT_DIR/apps/web"
    cp -r apps/web/dist "$KIT_DIR/apps/web/dist"
    log_success "Frontend copied"

    # ── 7. Support files ───────────────────────────
    cp scripts/install.sh "$KIT_DIR/install.sh"
    chmod +x "$KIT_DIR/install.sh"

    [ -f apps/server/.env.example ]       && cp apps/server/.env.example "$KIT_DIR/.env.example"
    [ -f apps/server/freesomnia.service ] && cp apps/server/freesomnia.service "$KIT_DIR/freesomnia.service"

    mkdir -p "$KIT_DIR/scripts"
    for f in scripts/migrate-postgresql*.sql; do
        [ -f "$f" ] && cp "$f" "$KIT_DIR/scripts/"
    done
    [ -f scripts/README-INSTALL.md ] && cp scripts/README-INSTALL.md "$KIT_DIR/README-INSTALL.md"

    # ── 8. Tarball ─────────────────────────────────
    TARBALL="$PROJECT_ROOT/$KIT_NAME.tar.gz"
    cd /tmp
    tar -czf "$TARBALL" "$KIT_NAME"
    rm -rf "$KIT_DIR"

    SIZE=$(du -h "$TARBALL" | cut -f1)
    echo ""
    log_success "Kit: $KIT_NAME.tar.gz ($SIZE)"
    echo ""
    echo "  Deploy:"
    echo "    scp $KIT_NAME.tar.gz server:/tmp/"
    echo "    ssh server"
    echo "    cd /tmp && tar xzf $KIT_NAME.tar.gz && cd $KIT_NAME"
    echo "    sudo ./install.sh install   # first time"
    echo "    sudo ./install.sh deploy    # updates"
    echo ""
}

main "$@"
