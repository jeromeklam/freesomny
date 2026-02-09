#!/bin/bash
# ===========================================
# FreeSomnia — Deployment Script
# ===========================================
#
# Deploys a self-contained kit to /opt/freesomnia.
# No pnpm, no npm, no prisma, no build.
# Just copies files and starts the service.
#
# Usage (from extracted kit directory):
#   sudo ./install.sh deploy     # Update existing
#   sudo ./install.sh install    # First-time setup
#   sudo ./install.sh migrate    # DB migrations only
#   sudo ./install.sh status     # Show status

set -e
set -u

APP_HOME="/opt/freesomnia"
APP_USER="freesomnia"
APP_GROUP="freesomnia"
SERVICE_NAME="freesomnia"
NODE_BIN="/usr/local/bin/node"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND="${1:-deploy}"
ENV_FILE="$APP_HOME/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
log_step()    { echo ""; echo -e "${CYAN}=== $1 ===${NC}"; }

# ───────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────

check_root() {
    [ "$(id -u)" -eq 0 ] || log_error "Run as root: sudo ./install.sh $COMMAND"
}

load_env() {
    [ -f "$ENV_FILE" ] || return 0
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line" 2>/dev/null || true
    done < "$ENV_FILE"
    set +a
}

detect_db_type() {
    local url="${DATABASE_URL:-}"
    if [[ "$url" == postgresql://* ]] || [[ "$url" == postgres://* ]]; then
        echo "postgresql"
    elif [[ "$url" == file:* ]] || [[ "$url" == *.db ]]; then
        echo "sqlite"
    else
        echo "unknown"
    fi
}

setup_pg_password() {
    [ -n "${PGPASSWORD:-}" ] && { export PGPASSWORD; return; }
    local url="${DATABASE_URL:-}"
    if [[ "$url" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)$ ]]; then
        export PGPASSWORD="${BASH_REMATCH[3]}"
    fi
}

get_psql_args() {
    local url="${DATABASE_URL:-}"
    if [ -n "${PGHOST:-}" ] || [ -n "${PGUSER:-}" ]; then
        local args=""
        [ -n "${PGHOST:-}" ]     && args="$args -h $PGHOST"
        [ -n "${PGPORT:-}" ]     && args="$args -p $PGPORT"
        [ -n "${PGUSER:-}" ]     && args="$args -U $PGUSER"
        [ -n "${PGDATABASE:-}" ] && args="$args $PGDATABASE"
        echo "$args"
        return
    fi
    if [[ "$url" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)$ ]]; then
        local pg_user="${BASH_REMATCH[2]}"
        local pg_host="${BASH_REMATCH[4]}"
        local pg_port="${BASH_REMATCH[5]}"
        local pg_db="${BASH_REMATCH[6]}"
        pg_db="${pg_db%%\?*}"
        echo "-h $pg_host -p $pg_port -U $pg_user $pg_db"
    fi
}

# ───────────────────────────────────────────────
# Node.js
# ───────────────────────────────────────────────

ensure_node() {
    log_step "Node.js"

    if [ -x "$NODE_BIN" ] && "$NODE_BIN" --version &>/dev/null; then
        log_success "Node.js $($NODE_BIN --version)"
        return
    fi

    log_info "Searching..."
    local found=""
    for nvm_dir in /root/.nvm /home/*/.nvm; do
        if [ -d "$nvm_dir/versions/node" ]; then
            local latest
            latest=$(ls -1 "$nvm_dir/versions/node/" | sort -V | tail -1)
            [ -n "$latest" ] && [ -x "$nvm_dir/versions/node/$latest/bin/node" ] && {
                found="$nvm_dir/versions/node/$latest/bin/node"; break
            }
        fi
    done
    [ -z "$found" ] && command -v node &>/dev/null && found="$(command -v node)"
    [ -z "$found" ] && log_error "Node.js not found. Install Node.js 22+"

    rm -f "$NODE_BIN"
    cp "$(readlink -f "$found")" "$NODE_BIN"
    chmod 755 "$NODE_BIN"
    log_success "Node.js $($NODE_BIN --version) → $NODE_BIN"
}

# ───────────────────────────────────────────────
# Kit validation
# ───────────────────────────────────────────────

check_kit() {
    local ok=1
    for item in apps/web/dist apps/server/dist apps/server/node_modules apps/server/prisma; do
        [ -e "$SCRIPT_DIR/$item" ] || { log_warning "Missing: $item"; ok=0; }
    done
    [ "$ok" -eq 1 ] || log_error "Kit incomplete. Run from the extracted kit directory."
}

# ───────────────────────────────────────────────
# Deploy files (just copy — no install, no build)
# ───────────────────────────────────────────────

deploy_files() {
    log_step "Deploying to $APP_HOME"

    mkdir -p "$APP_HOME"

    # Backup .env
    local env_bak=""
    if [ -f "$ENV_FILE" ]; then
        env_bak="/tmp/.freesomnia-env-$$"
        cp "$ENV_FILE" "$env_bak"
    fi

    # Copy application (server with node_modules + frontend)
    rm -rf "$APP_HOME/apps"
    cp -r "$SCRIPT_DIR/apps" "$APP_HOME/apps"
    log_success "Apps deployed"

    # Migration scripts
    mkdir -p "$APP_HOME/scripts"
    for f in "$SCRIPT_DIR/scripts"/migrate-postgresql*.sql; do
        [ -f "$f" ] && cp "$f" "$APP_HOME/scripts/"
    done
    cp "$SCRIPT_DIR/install.sh" "$APP_HOME/scripts/install.sh"
    chmod +x "$APP_HOME/scripts/install.sh"

    # Restore .env
    if [ -n "${env_bak:-}" ] && [ -f "$env_bak" ]; then
        cp "$env_bak" "$ENV_FILE"
        rm -f "$env_bak"
        log_success ".env restored"
    elif [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
        log_warning "Created $ENV_FILE from example — edit it!"
    fi

    log_success "All files deployed"
}

# ───────────────────────────────────────────────
# Migrations (psql only — no prisma CLI needed)
# ───────────────────────────────────────────────

run_migrations() {
    log_step "Migrations"

    local db_type
    db_type=$(detect_db_type)
    log_info "Database: $db_type"

    if [ "$db_type" != "postgresql" ]; then
        log_info "No PostgreSQL migrations to apply"
        return
    fi

    if ! command -v psql &>/dev/null; then
        log_warning "psql not found — skipping migrations"
        return
    fi

    setup_pg_password
    local psql_args
    psql_args=$(get_psql_args)

    if ! psql $psql_args -c "SELECT 1;" &>/dev/null; then
        log_warning "Cannot connect to PostgreSQL — skipping"
        return
    fi
    log_success "PostgreSQL OK"

    # Get already-applied migrations
    local applied=""
    applied=$(psql $psql_args -t -A -c \
        "SELECT migration_name FROM _prisma_migrations;" 2>/dev/null || echo "")

    # Apply pending SQL scripts
    for sql_file in "$APP_HOME/scripts"/migrate-postgresql*.sql; do
        [ -f "$sql_file" ] || continue
        local fname
        fname=$(basename "$sql_file")
        local mig_name=""
        mig_name=$(grep -oP '(?<=-- Migration: )\S+' "$sql_file" 2>/dev/null || echo "")

        if [ -n "$mig_name" ] && echo "$applied" | grep -q "$mig_name"; then
            log_info "  Skip: $mig_name"
            continue
        fi

        log_info "  Applying: $fname"
        psql $psql_args -f "$sql_file" \
            && log_success "  Applied: $fname" \
            || log_warning "  Failed: $fname (may already exist)"

        # Mark in Prisma tracking table
        if [ -n "$mig_name" ]; then
            psql $psql_args -c "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES (gen_random_uuid(), 'manual', '$mig_name', NOW(), 1) ON CONFLICT DO NOTHING;" 2>/dev/null || true
        fi
    done

    log_success "Migrations done"
}

# ───────────────────────────────────────────────
# Service
# ───────────────────────────────────────────────

setup_service() {
    log_step "Service"
    if ! id -u "$APP_USER" &>/dev/null; then
        useradd -r -s /bin/false "$APP_USER"
        log_success "Created user: $APP_USER"
    fi
    [ -f "$SCRIPT_DIR/freesomnia.service" ] && \
        cp "$SCRIPT_DIR/freesomnia.service" "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    log_success "Service configured"
}

fix_ownership() {
    chown -R "$APP_USER:$APP_GROUP" "$APP_HOME"
    [ -f "$ENV_FILE" ] && chmod 600 "$ENV_FILE"
    log_success "Ownership set"
}

stop_service() {
    systemctl is-active "$SERVICE_NAME" &>/dev/null 2>&1 && {
        systemctl stop "$SERVICE_NAME"
        log_success "Service stopped"
    } || true
}

start_service() {
    systemctl start "$SERVICE_NAME"
    sleep 2
    if systemctl is-active "$SERVICE_NAME" &>/dev/null 2>&1; then
        log_success "Service running"
    else
        log_warning "Service failed — check: journalctl -u $SERVICE_NAME -n 30"
    fi
}

# ───────────────────────────────────────────────
# Status
# ───────────────────────────────────────────────

show_status() {
    log_step "Status"
    [ -x "$NODE_BIN" ] \
        && echo -e "  Node.js:  ${GREEN}$($NODE_BIN --version)${NC}" \
        || echo -e "  Node.js:  ${RED}not found${NC}"
    [ -f "$ENV_FILE" ] \
        && echo -e "  Config:   ${GREEN}$ENV_FILE${NC}" \
        || echo -e "  Config:   ${RED}MISSING${NC}"
    echo -e "  Database: $(detect_db_type)"
    [ -d "$APP_HOME/apps/web/dist" ] \
        && echo -e "  Frontend: ${GREEN}deployed${NC}" \
        || echo -e "  Frontend: ${YELLOW}missing${NC}"
    [ -d "$APP_HOME/apps/server/dist" ] \
        && echo -e "  Backend:  ${GREEN}deployed${NC}" \
        || echo -e "  Backend:  ${YELLOW}missing${NC}"
    [ -d "$APP_HOME/apps/server/node_modules" ] \
        && echo -e "  Modules:  ${GREEN}bundled${NC}" \
        || echo -e "  Modules:  ${RED}missing${NC}"
    if systemctl is-active "$SERVICE_NAME" &>/dev/null 2>&1; then
        echo -e "  Service:  ${GREEN}running${NC}"
    elif systemctl is-enabled "$SERVICE_NAME" &>/dev/null 2>&1; then
        echo -e "  Service:  ${YELLOW}stopped${NC}"
    else
        echo -e "  Service:  ${YELLOW}not installed${NC}"
    fi
    echo ""
}

# ───────────────────────────────────────────────
# Commands
# ───────────────────────────────────────────────

cmd_deploy() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia — Deploy"
    echo "=========================================="
    check_root
    check_kit
    load_env
    ensure_node
    stop_service
    deploy_files
    load_env
    run_migrations
    fix_ownership
    setup_service
    start_service
    show_status
    log_success "Done!"
    echo ""
}

cmd_install() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia — Install"
    echo "=========================================="
    check_root
    check_kit
    ensure_node
    deploy_files
    if [ ! -f "$ENV_FILE" ] || [ ! -s "$ENV_FILE" ]; then
        log_warning "Edit $ENV_FILE first!"
        echo ""
        echo "  JWT_SECRET=\$(openssl rand -base64 32)"
        echo "  DATABASE_URL=postgresql://user:pass@localhost:5432/freesomnia"
        echo "  AUTH_REQUIRED=true"
        echo "  NODE_ENV=production"
        echo ""
        read -p "  Press Enter after editing .env... "
    fi
    load_env
    run_migrations
    fix_ownership
    setup_service
    start_service
    show_status
    log_success "Done!"
    echo ""
}

cmd_migrate() {
    check_root
    load_env
    run_migrations
    fix_ownership
    log_success "Done!"
}

# ───────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────

case "$COMMAND" in
    deploy)     cmd_deploy ;;
    install)    cmd_install ;;
    migrate)    cmd_migrate ;;
    setup-node) check_root; ensure_node ;;
    status)     load_env; show_status ;;
    help|-h)
        echo "Usage: sudo ./install.sh [deploy|install|migrate|status|help]"
        ;;
    *)
        log_error "Unknown: $COMMAND"
        ;;
esac
