# FreeSomnia — Installation Guide

## What's in this kit

| File/Directory | Description |
|---|---|
| `apps/web/dist/` | Built frontend (static HTML/JS/CSS) |
| `apps/server/` | Built backend with node_modules (standalone) |
| `apps/server/prisma/` | Database schema (PostgreSQL) |
| `.env.example` | Sample configuration |
| `freesomnia.service` | Systemd service file |
| `install.sh` | Automated install/deploy script |
| `migrate-postgresql*.sql` | PostgreSQL migration scripts |

## Prerequisites

- **Debian/Ubuntu** server (tested on Debian 12, Ubuntu 22.04+)
- **Node.js 22+** (the script can auto-detect nvm-installed node)
- **PostgreSQL 14+** (for team mode) or SQLite (single-user)
- Root access (sudo)

### Install Node.js (if not installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
```

### Install pnpm (if not installed)

```bash
npm install -g pnpm
```

## First-time Installation

### 1. Copy kit to server

```bash
scp freesomnia-deploy-*.tar.gz yourserver:/tmp/
ssh yourserver
cd /tmp
tar xzf freesomnia-deploy-*.tar.gz
cd freesomnia-deploy-*
```

### 2. Run the installer

```bash
sudo ./install.sh install
```

This will:
- Check/install Node.js at `/usr/local/bin/node`
- Create `/opt/freesomnia` directory structure
- Deploy all files
- Install server dependencies
- Create `.env` from `.env.example` (and pause for you to edit it)
- Run database migrations
- Create `freesomnia` system user
- Install and start the systemd service

### 3. Configure the environment

Edit `/opt/freesomnia/.env` with your settings:

```bash
sudo nano /opt/freesomnia/.env
```

**Minimum required changes:**

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Database (choose one):
# SQLite (single user):
DATABASE_URL="file:./data/api-client.db"
# PostgreSQL (team mode):
DATABASE_URL="postgresql://freesomnia:password@localhost:5432/freesomnia"

# Production settings
NODE_ENV=production
AUTH_REQUIRED=true
CORS_ORIGINS=https://your-domain.com
APP_URL=https://your-domain.com
```

### 4. PostgreSQL setup (if using team mode)

```bash
sudo apt install -y postgresql postgresql-contrib

sudo -u postgres psql <<SQL
CREATE DATABASE freesomnia;
CREATE USER freesomnia WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE freesomnia TO freesomnia;
ALTER DATABASE freesomnia OWNER TO freesomnia;
SQL
```

Then restart the service:

```bash
sudo systemctl restart freesomnia
```

### 5. Set up Nginx reverse proxy (recommended)

```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/freesomnia`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

```bash
sudo ln -s /etc/nginx/sites-available/freesomnia /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. SSL with Let's Encrypt (recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Updating (subsequent deployments)

Build a new kit on your dev machine:

```bash
./scripts/make-kit.sh
```

Then deploy:

```bash
scp freesomnia-deploy-*.tar.gz yourserver:/tmp/
ssh yourserver
cd /tmp && tar xzf freesomnia-deploy-*.tar.gz
cd freesomnia-deploy-*
sudo ./install.sh deploy
```

The `deploy` command will:
- Stop the service
- Update all files
- Install dependencies
- Run new migrations
- Fix ownership
- Restart the service

## Other commands

```bash
# Check installation status
sudo ./install.sh status

# Run migrations only (without full deploy)
sudo ./install.sh migrate

# Ensure Node.js is available system-wide
sudo ./install.sh setup-node

# Show help
./install.sh help
```

## Troubleshooting

### Check service logs

```bash
sudo journalctl -u freesomnia -n 50
sudo journalctl -u freesomnia -f    # follow live
```

### Service won't start

```bash
# Check status
sudo systemctl status freesomnia

# Check .env file exists and is readable
sudo ls -la /opt/freesomnia/.env

# Check Node.js is available
/usr/local/bin/node --version

# Try running manually
sudo -u freesomnia /usr/local/bin/node /opt/freesomnia/apps/server/dist/index.js
```

### Database connection issues

```bash
# Test PostgreSQL connection
sudo -u postgres psql -c "SELECT 1;"

# Check DATABASE_URL in .env
grep DATABASE_URL /opt/freesomnia/.env
```

### Permission issues

```bash
sudo chown -R freesomnia:freesomnia /opt/freesomnia
sudo chmod 600 /opt/freesomnia/.env
```

## Email configuration (optional)

For password reset functionality, configure SMTP:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@your-domain.com
```

If SMTP is not configured, reset links are logged to the server console (visible in `journalctl`).

## First admin user

1. Register a user via the web UI
2. Promote to admin in the database:

```bash
# PostgreSQL
sudo -u postgres psql freesomnia -c "UPDATE \"User\" SET role = 'admin' WHERE email = 'your@email.com';"

# SQLite
sqlite3 /opt/freesomnia/apps/server/prisma/data/api-client.db "UPDATE User SET role = 'admin' WHERE email = 'your@email.com';"
```

3. Log out and log back in (JWT token must be refreshed)
4. The shield icon appears in the top-right corner to access the admin dashboard
