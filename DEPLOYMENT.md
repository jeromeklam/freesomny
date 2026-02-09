# FreeSomnia Deployment Guide

This guide covers deploying FreeSomnia in development and production environments.

## Prerequisites

- **Node.js 22+** - Required for the server
- **pnpm** - Package manager (`npm install -g pnpm`)
- **PostgreSQL 14+** - Optional, for team/production mode (SQLite works for single-user)

## Quick Start (Development)

```bash
# Clone and install
git clone <repo-url> freesomnia
cd freesomnia
pnpm install

# Configure environment
cp apps/server/.env.example apps/server/.env

# Initialize database
pnpm db:migrate

# Start development servers
pnpm dev
```

The app will be available at http://localhost:5173

## Production Deployment

### 1. System Setup (Debian/Ubuntu)

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Create application directory
sudo mkdir -p /opt/freesomnia
sudo chown $USER:$USER /opt/freesomnia

# Clone repository
cd /opt/freesomnia
git clone <repo-url> .
pnpm install
```

### 2. Configure Environment

```bash
cp apps/server/.env.example apps/server/.env
nano apps/server/.env
```

**Required production settings:**

```bash
# Use PostgreSQL for team mode
DATABASE_URL="postgresql://freesomnia:password@localhost:5432/freesomnia"

# Production mode
NODE_ENV=production

# Your domain (no trailing slash)
CORS_ORIGINS=https://api.yourdomain.com

# Generate secure secret: openssl rand -base64 32
JWT_SECRET=your-secure-random-string-here

# Enable authentication
AUTH_REQUIRED=true
```

### 3. Database Setup

#### SQLite (Single-user mode)

SQLite works out of the box. The database file is created at `apps/server/prisma/data/api-client.db`.

#### PostgreSQL (Team mode)

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE freesomnia;
CREATE USER freesomnia WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE freesomnia TO freesomnia;
\q

# Update Prisma schema for PostgreSQL
# Edit apps/server/prisma/schema.prisma:
# Change: provider = "sqlite"
# To:     provider = "postgresql"

# Regenerate Prisma client and run migrations
cd /opt/freesomnia
pnpm prisma generate --filter @api-client/server
pnpm prisma migrate deploy --filter @api-client/server
```

### 4. Build Application

```bash
cd /opt/freesomnia
pnpm build
```

### 5. Install Systemd Service

```bash
# Create service user
sudo useradd -r -s /bin/false freesomnia

# Set permissions
sudo chown -R freesomnia:freesomnia /opt/freesomnia

# Copy and symlink environment file
sudo cp /opt/freesomnia/apps/server/.env /opt/freesomnia/.env
sudo chown freesomnia:freesomnia /opt/freesomnia/.env
sudo chmod 600 /opt/freesomnia/.env

# Install service
sudo cp /opt/freesomnia/apps/server/freesomnia.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable freesomnia
sudo systemctl start freesomnia

# Check status
sudo systemctl status freesomnia
sudo journalctl -u freesomnia -f
```

### 6. Nginx Reverse Proxy (Recommended)

```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/freesomnia`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/freesomnia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL/TLS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./data/api-client.db` | Database connection string |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `JWT_SECRET` | (insecure default) | Secret for JWT signing |
| `AUTH_REQUIRED` | `false` | Force authentication for all users |
| `APP_URL` | `http://localhost:5173` | Frontend URL (used in password reset links) |
| `SMTP_HOST` | *(none)* | SMTP server hostname (required for email) |
| `SMTP_PORT` | `25` | SMTP port (25=relay, 587=STARTTLS, 465=SSL) |
| `SMTP_USER` | *(none)* | SMTP username (omit for unauthenticated relay) |
| `SMTP_PASS` | *(none)* | SMTP password (omit for unauthenticated relay) |
| `SMTP_FROM` | `noreply@freesomnia.local` | From address for emails |

## Database Migrations

```bash
# Development: create and apply migrations
pnpm db:migrate

# Production: apply existing migrations only
pnpm --filter @api-client/server prisma migrate deploy

# View database in browser
pnpm db:studio
```

## Backup and Restore

### SQLite

```bash
# Backup
cp /opt/freesomnia/apps/server/prisma/data/api-client.db /backup/freesomnia-$(date +%Y%m%d).db

# Restore
cp /backup/freesomnia-20240101.db /opt/freesomnia/apps/server/prisma/data/api-client.db
sudo systemctl restart freesomnia
```

### PostgreSQL

```bash
# Backup
pg_dump -U freesomnia freesomnia > /backup/freesomnia-$(date +%Y%m%d).sql

# Restore
psql -U freesomnia freesomnia < /backup/freesomnia-20240101.sql
sudo systemctl restart freesomnia
```

## Updating

```bash
cd /opt/freesomnia
sudo systemctl stop freesomnia

# Pull updates
git pull

# Install dependencies
pnpm install

# Run migrations
pnpm --filter @api-client/server prisma migrate deploy

# Rebuild
pnpm build

# Restart
sudo systemctl start freesomnia
```

## Troubleshooting

### Check logs

```bash
sudo journalctl -u freesomnia -f
```

### Test database connection

```bash
cd /opt/freesomnia/apps/server
pnpm prisma db pull
```

### Reset database (development only)

```bash
pnpm --filter @api-client/server prisma migrate reset
```

### Permission issues

```bash
sudo chown -R freesomnia:freesomnia /opt/freesomnia
sudo chmod 600 /opt/freesomnia/.env
```

## CI/CD with Jenkins

A Jenkinsfile is provided for automated CI/CD pipelines.

### Jenkins Requirements

- **Plugins:** Pipeline, NodeJS, SSH Agent, Credentials
- **Tools:** NodeJS 22 (configure in Global Tool Configuration)
- **Credentials:**
  - `deploy-ssh-key`: SSH private key for deployment
  - `staging-env`: Secret file with staging .env
  - `prod-env`: Secret file with production .env
  - `staging-host`: Staging server hostname
  - `prod-host`: Production server hostname

### Pipeline Parameters

| Parameter | Description |
|-----------|-------------|
| `ENVIRONMENT` | Target environment: dev, staging, prod |
| `SKIP_TESTS` | Skip running tests |
| `FORCE_DEPLOY` | Deploy even if tests fail |

### Manual Deployment Script

For manual deployments without Jenkins:

```bash
# Development (local)
./scripts/deploy.sh dev

# Staging
DEPLOY_HOST=staging.example.com ./scripts/deploy.sh staging

# Production
DEPLOY_HOST=prod.example.com ./scripts/deploy.sh prod
```

Environment variables for the deploy script:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEPLOY_HOST` | (required for remote) | Target server hostname |
| `DEPLOY_USER` | `freesomnia` | SSH user |
| `DEPLOY_PATH` | `/opt/freesomnia` | Installation path |
| `SKIP_BUILD` | `false` | Skip build step |
| `SKIP_TESTS` | `false` | Skip tests |
