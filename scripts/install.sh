#!/bin/bash
# ===========================================
# FreeSomnia Deployment Script
# ===========================================
#
# Usage (from extracted kit directory):
#   ./install.sh [command]
#
# Commands:
#   deploy      Deploy kit files + restart service (default)
#   install     First-time full installation
#   migrate     Run database migrations only
#   setup-node  Ensure node is available system-wide
#   status      Show installation status
#
# The app home directory is /opt/freesomnia
# Configuration is read from /opt/freesomnia/.env
#
# Typical workflow:
#   scp freesomnia-deploy-*.tar.gz server:/tmp/
#   ssh server
#   cd /tmp && tar xzf freesomnia-deploy-*.tar.gz
#   cd freesomnia-deploy-*
#   sudo ./install.sh deploy
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# ===========================================
# Configuration
# ===========================================
APP_HOME="/opt/freesomnia"
APP_USER="freesomnia"
APP_GROUP="freesomnia"
SERVICE_NAME="freesomnia"
NODE_BIN="/usr/local/bin/node"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND="${1:-deploy}"
ENV_FILE="$APP_HOME/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ===========================================
# Helper Functions
# ===========================================
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
log_step()    { echo ""; echo -e "${CYAN}=== $1 ===${NC}"; }

# ===========================================
# Check root
# ===========================================
check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        log_error "This script must be run as root (use sudo ./install.sh)"
    fi
}

# ===========================================
# Load .env from APP_HOME
# ===========================================
load_env() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "No .env file found at $ENV_FILE"
        return
    fi

    log_info "Loading config from $ENV_FILE"
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$line" ]] && continue
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            eval "$line" 2>/dev/null || true
        fi
    done < "$ENV_FILE"
    set +a
}

# ===========================================
# Detect database type
# ===========================================
detect_db_type() {
    local db_url="${DATABASE_URL:-}"
    if [ -z "$db_url" ]; then
        echo "unknown"
    elif [[ "$db_url" == postgresql://* ]] || [[ "$db_url" == postgres://* ]]; then
        echo "postgresql"
    elif [[ "$db_url" == file:* ]] || [[ "$db_url" == *.db ]]; then
        echo "sqlite"
    else
        echo "unknown"
    fi
}

# ===========================================
# Extract and export PGPASSWORD from .env or DATABASE_URL
# Must run in current shell (not subshell) so export persists
# ===========================================
setup_pg_password() {
    # Already set from .env via load_env?
    if [ -n "${PGPASSWORD:-}" ]; then
        export PGPASSWORD
        return
    fi

    # Extract from DATABASE_URL
    local db_url="${DATABASE_URL:-}"
    if [[ "$db_url" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)$ ]]; then
        export PGPASSWORD="${BASH_REMATCH[3]}"
    fi
}

# ===========================================
# Build psql connection args
# Call setup_pg_password BEFORE using $(get_psql_args)
# ===========================================
get_psql_args() {
    local db_url="${DATABASE_URL:-}"

    # If we have individual PG* vars, use those
    if [ -n "${PGHOST:-}" ] || [ -n "${PGUSER:-}" ]; then
        local args=""
        [ -n "${PGHOST:-}" ] && args="$args -h $PGHOST"
        [ -n "${PGPORT:-}" ] && args="$args -p $PGPORT"
        [ -n "${PGUSER:-}" ] && args="$args -U $PGUSER"
        [ -n "${PGDATABASE:-}" ] && args="$args $PGDATABASE"
        echo "$args"
        return
    fi

    # Parse DATABASE_URL: postgresql://user:pass@host:port/dbname
    if [[ "$db_url" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)$ ]]; then
        local pg_user="${BASH_REMATCH[2]}"
        local pg_host="${BASH_REMATCH[4]}"
        local pg_port="${BASH_REMATCH[5]}"
        local pg_db="${BASH_REMATCH[6]}"
        pg_db="${pg_db%%\?*}"
        echo "-h $pg_host -p $pg_port -U $pg_user $pg_db"
        return
    fi

    echo "$db_url"
}

# ===========================================
# Ensure Node.js is available system-wide
# ===========================================
ensure_node() {
    log_step "Checking Node.js"

    # Already available and is a real binary (not a broken symlink)?
    if [ -x "$NODE_BIN" ] && "$NODE_BIN" --version &>/dev/null; then
        log_success "Node.js $($NODE_BIN --version) at $NODE_BIN"
        return
    fi

    log_info "Node.js not found at $NODE_BIN, searching..."

    # Find node binary
    local found_node=""

    # 1. Check common nvm locations
    for nvm_dir in /root/.nvm /home/*/.nvm; do
        if [ -d "$nvm_dir/versions/node" ]; then
            # Get latest version
            local latest
            latest=$(ls -1 "$nvm_dir/versions/node/" | sort -V | tail -1)
            if [ -n "$latest" ] && [ -x "$nvm_dir/versions/node/$latest/bin/node" ]; then
                found_node="$nvm_dir/versions/node/$latest/bin/node"
                break
            fi
        fi
    done

    # 2. Check PATH (when run as root with nvm loaded)
    if [ -z "$found_node" ] && command -v node &>/dev/null; then
        found_node="$(command -v node)"
    fi

    if [ -z "$found_node" ]; then
        log_error "Cannot find Node.js. Install Node.js 22+:
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs"
    fi

    log_info "Found Node.js at $found_node"

    # Check if it's a symlink pointing into /root (not accessible by service user)
    local real_path
    real_path=$(readlink -f "$found_node")

    # Remove existing symlink/file
    rm -f "$NODE_BIN"

    # Copy the real binary (not symlink — service user can't access /root/)
    cp "$real_path" "$NODE_BIN"
    chmod 755 "$NODE_BIN"

    log_success "Copied Node.js to $NODE_BIN ($($NODE_BIN --version))"
}

# ===========================================
# Check kit files exist
# ===========================================
check_kit() {
    local missing=0

    for item in web-dist server-dist prisma server-package.json; do
        if [ ! -e "$SCRIPT_DIR/$item" ]; then
            log_warning "Missing: $item"
            missing=1
        fi
    done

    if [ "$missing" -eq 1 ]; then
        log_error "Kit files missing. Are you running from the extracted kit directory?"
    fi
}

# ===========================================
# Deploy kit files to APP_HOME
# ===========================================
deploy_files() {
    log_step "Deploying files to $APP_HOME"

    # Ensure app directory structure exists
    mkdir -p "$APP_HOME/apps/web"
    mkdir -p "$APP_HOME/apps/server"
    mkdir -p "$APP_HOME/scripts"

    # Deploy web frontend
    rm -rf "$APP_HOME/apps/web/dist"
    cp -r "$SCRIPT_DIR/web-dist" "$APP_HOME/apps/web/dist"
    log_success "Frontend deployed"

    # Deploy server backend
    rm -rf "$APP_HOME/apps/server/dist"
    cp -r "$SCRIPT_DIR/server-dist" "$APP_HOME/apps/server/dist"
    log_success "Backend deployed"

    # Deploy Prisma schema + migrations
    rm -rf "$APP_HOME/apps/server/prisma"
    cp -r "$SCRIPT_DIR/prisma" "$APP_HOME/apps/server/prisma"
    log_success "Prisma schema deployed"

    # Deploy server package.json
    cp "$SCRIPT_DIR/server-package.json" "$APP_HOME/apps/server/package.json"

    # Deploy pnpm-lock.yaml if present
    if [ -f "$SCRIPT_DIR/pnpm-lock.yaml" ]; then
        cp "$SCRIPT_DIR/pnpm-lock.yaml" "$APP_HOME/pnpm-lock.yaml"
    fi

    # Deploy migration scripts
    for sql_file in "$SCRIPT_DIR"/migrate-postgresql*.sql; do
        [ -f "$sql_file" ] && cp "$sql_file" "$APP_HOME/scripts/"
    done

    # Deploy this install script
    cp "$SCRIPT_DIR/install.sh" "$APP_HOME/scripts/install.sh"
    chmod +x "$APP_HOME/scripts/install.sh"

    # Deploy .env.example if no .env exists
    if [ ! -f "$ENV_FILE" ] && [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
        log_warning "Created $ENV_FILE from .env.example — please edit it!"
    fi

    log_success "All files deployed"
}

# ===========================================
# Install npm dependencies (server only)
# ===========================================
install_deps() {
    log_step "Installing server dependencies"

    cd "$APP_HOME/apps/server"

    # Install production dependencies only
    if command -v pnpm &>/dev/null; then
        pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod
    elif command -v npm &>/dev/null; then
        npm install --production
    else
        log_error "Neither pnpm nor npm found"
    fi

    log_success "Dependencies installed"
}

# ===========================================
# Run migrations
# ===========================================
run_migrations() {
    log_step "Database migrations"

    local db_type
    db_type=$(detect_db_type)
    log_info "Database type: $db_type"

    case "$db_type" in
        sqlite)
            log_info "Running Prisma migrate deploy (SQLite)..."
            cd "$APP_HOME"
            npx --prefix apps/server prisma migrate deploy --schema=apps/server/prisma/schema.prisma 2>/dev/null || {
                log_warning "Prisma migrate deploy returned non-zero (may be OK if already up to date)"
            }
            ;;
        postgresql)
            log_info "Checking PostgreSQL migrations..."

            if ! command -v psql &>/dev/null; then
                log_warning "psql not found — skipping PostgreSQL migrations"
                return
            fi

            # Export PGPASSWORD in current shell before subshell calls
            setup_pg_password

            local psql_args
            psql_args=$(get_psql_args)

            # Test connection
            if ! psql $psql_args -c "SELECT 1;" &>/dev/null; then
                log_warning "Cannot connect to PostgreSQL — skipping migrations"
                return
            fi
            log_success "PostgreSQL connection OK"

            # Find and apply pending SQL scripts
            local scripts_dir="$APP_HOME/scripts"
            local applied_migrations=""
            if psql $psql_args -c "SELECT migration_name FROM _prisma_migrations;" &>/dev/null 2>&1; then
                applied_migrations=$(psql $psql_args -t -A -c "SELECT migration_name FROM _prisma_migrations;" 2>/dev/null || echo "")
            fi

            for sql_file in "$scripts_dir"/migrate-postgresql*.sql; do
                [ -f "$sql_file" ] || continue
                local filename
                filename=$(basename "$sql_file")

                # Extract migration name from header
                local migration_name=""
                migration_name=$(grep -oP '(?<=-- Migration: )\S+' "$sql_file" 2>/dev/null || echo "")

                if [ -n "$migration_name" ] && echo "$applied_migrations" | grep -q "$migration_name"; then
                    log_info "  Already applied: $migration_name"
                    continue
                fi

                log_info "  Applying: $filename"
                if psql $psql_args -f "$sql_file"; then
                    log_success "  Applied: $filename"
                else
                    log_warning "  Failed: $filename (may be already applied)"
                fi

                if [ -n "$migration_name" ]; then
                    cd "$APP_HOME"
                    npx --prefix apps/server prisma migrate resolve --applied "$migration_name" --schema=apps/server/prisma/schema.prisma 2>/dev/null || true
                fi
            done
            ;;
        *)
            log_warning "Unknown database type — skipping migrations"
            ;;
    esac

    # Always regenerate Prisma client
    log_info "Regenerating Prisma client..."
    cd "$APP_HOME"
    npx --prefix apps/server prisma generate --schema=apps/server/prisma/schema.prisma 2>/dev/null || {
        log_warning "Prisma generate failed (may need: cd $APP_HOME/apps/server && pnpm install)"
    }
    log_success "Migrations complete"
}

# ===========================================
# Setup systemd service
# ===========================================
setup_service() {
    log_step "Setting up systemd service"

    # Create service user if needed
    if ! id -u "$APP_USER" &>/dev/null; then
        useradd -r -s /bin/false "$APP_USER"
        log_success "Created user: $APP_USER"
    fi

    # Install service file
    if [ -f "$SCRIPT_DIR/freesomnia.service" ]; then
        cp "$SCRIPT_DIR/freesomnia.service" /etc/systemd/system/$SERVICE_NAME.service
    elif [ -f "$APP_HOME/apps/server/freesomnia.service" ]; then
        cp "$APP_HOME/apps/server/freesomnia.service" /etc/systemd/system/$SERVICE_NAME.service
    fi

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    log_success "Service installed and enabled"
}

# ===========================================
# Fix ownership
# ===========================================
fix_ownership() {
    log_info "Setting ownership to $APP_USER:$APP_GROUP"
    chown -R "$APP_USER:$APP_GROUP" "$APP_HOME"
    # Keep .env readable only by owner
    [ -f "$ENV_FILE" ] && chmod 600 "$ENV_FILE"
    log_success "Ownership set"
}

# ===========================================
# Stop / Start service
# ===========================================
stop_service() {
    if systemctl is-active $SERVICE_NAME &>/dev/null 2>&1; then
        log_info "Stopping $SERVICE_NAME service..."
        systemctl stop $SERVICE_NAME
        log_success "Service stopped"
    fi
}

start_service() {
    log_info "Starting $SERVICE_NAME service..."
    systemctl start $SERVICE_NAME
    sleep 2

    if systemctl is-active $SERVICE_NAME &>/dev/null 2>&1; then
        log_success "Service started"
    else
        log_warning "Service may have failed. Check: journalctl -u $SERVICE_NAME -n 20"
    fi
}

# ===========================================
# Show status
# ===========================================
show_status() {
    log_step "Status"

    # Node.js
    if [ -x "$NODE_BIN" ]; then
        echo -e "  Node.js:   ${GREEN}$($NODE_BIN --version) at $NODE_BIN${NC}"
    else
        echo -e "  Node.js:   ${RED}not found at $NODE_BIN${NC}"
    fi

    # .env
    if [ -f "$ENV_FILE" ]; then
        echo -e "  Config:    ${GREEN}$ENV_FILE${NC}"
    else
        echo -e "  Config:    ${RED}$ENV_FILE MISSING${NC}"
    fi

    # Database
    local db_type
    db_type=$(detect_db_type)
    echo -e "  Database:  $db_type"

    if [ "$db_type" = "postgresql" ] && command -v psql &>/dev/null; then
        setup_pg_password
        local psql_args
        psql_args=$(get_psql_args)
        if psql $psql_args -c "SELECT 1;" &>/dev/null 2>&1; then
            local count
            count=$(psql $psql_args -t -A -c "SELECT COUNT(*) FROM _prisma_migrations;" 2>/dev/null || echo "?")
            echo -e "  PG status: ${GREEN}connected ($count migrations)${NC}"
        else
            echo -e "  PG status: ${RED}cannot connect${NC}"
        fi
    fi

    # Build
    [ -d "$APP_HOME/apps/web/dist" ] \
        && echo -e "  Frontend:  ${GREEN}deployed${NC}" \
        || echo -e "  Frontend:  ${YELLOW}missing${NC}"
    [ -d "$APP_HOME/apps/server/dist" ] \
        && echo -e "  Backend:   ${GREEN}deployed${NC}" \
        || echo -e "  Backend:   ${YELLOW}missing${NC}"

    # Service
    if systemctl is-active $SERVICE_NAME &>/dev/null 2>&1; then
        echo -e "  Service:   ${GREEN}running${NC}"
    elif systemctl is-enabled $SERVICE_NAME &>/dev/null 2>&1; then
        echo -e "  Service:   ${YELLOW}stopped${NC}"
    else
        echo -e "  Service:   ${YELLOW}not installed${NC}"
    fi

    echo ""
}

# ===========================================
# Commands
# ===========================================
cmd_deploy() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia — Deploy"
    echo "=========================================="
    echo ""

    check_root
    check_kit
    load_env
    ensure_node
    stop_service
    deploy_files
    install_deps
    load_env  # Reload after deploy (in case .env.example was copied)
    run_migrations
    fix_ownership
    setup_service
    start_service
    show_status

    log_success "Deployment complete!"
    echo ""
}

cmd_install() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia — First-time Installation"
    echo "=========================================="
    echo ""

    check_root
    check_kit
    ensure_node
    deploy_files

    # Interactive .env setup if missing
    if [ ! -f "$ENV_FILE" ] || [ ! -s "$ENV_FILE" ]; then
        log_warning "Please edit $ENV_FILE before continuing!"
        echo ""
        echo "  Minimum changes needed:"
        echo "    JWT_SECRET=\$(openssl rand -base64 32)"
        echo "    DATABASE_URL=postgresql://user:pass@localhost:5432/freesomnia"
        echo "    AUTH_REQUIRED=true"
        echo "    NODE_ENV=production"
        echo ""
        read -p "  Press Enter after editing .env, or Ctrl+C to abort... "
    fi

    load_env
    install_deps
    run_migrations
    fix_ownership
    setup_service
    start_service
    show_status

    log_success "Installation complete!"
    echo ""
}

cmd_migrate() {
    echo ""
    echo "=========================================="
    echo "  FreeSomnia — Database Migration"
    echo "=========================================="
    echo ""

    check_root
    load_env
    run_migrations
    fix_ownership

    log_success "Migration complete!"
    echo ""
}

cmd_setup_node() {
    check_root
    ensure_node
}

# ===========================================
# Main
# ===========================================
main() {
    case "$COMMAND" in
        deploy)     cmd_deploy ;;
        install)    cmd_install ;;
        migrate)    cmd_migrate ;;
        setup-node) cmd_setup_node ;;
        status)     load_env; show_status ;;
        help|-h|--help)
            echo ""
            echo "FreeSomnia Deployment Script"
            echo ""
            echo "Usage: sudo ./install.sh [command]"
            echo ""
            echo "Commands:"
            echo "  deploy      Deploy kit + restart service (default)"
            echo "  install     First-time full installation"
            echo "  migrate     Run database migrations only"
            echo "  setup-node  Ensure node is available system-wide"
            echo "  status      Show installation status"
            echo "  help        Show this help"
            echo ""
            echo "Workflow:"
            echo "  1. scp freesomnia-deploy-*.tar.gz server:/tmp/"
            echo "  2. ssh server"
            echo "  3. cd /tmp && tar xzf freesomnia-deploy-*.tar.gz"
            echo "  4. cd freesomnia-deploy-*"
            echo "  5. sudo ./install.sh deploy"
            echo ""
            echo "App home: $APP_HOME"
            echo "Config:   $ENV_FILE"
            echo ""
            ;;
        *)
            log_error "Unknown command: $COMMAND. Use: deploy, install, migrate, setup-node, status, help"
            ;;
    esac
}

main "$@"
