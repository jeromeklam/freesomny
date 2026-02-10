<p align="center">
  <img src="https://img.shields.io/badge/version-0.5.3-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/typescript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/built%20with-Claude-blueviolet" alt="Built with Claude" />
</p>

# FreeSomnia

**A local-first, self-hostable API client for teams.**

FreeSomnia is a modern alternative to Postman and Hoppscotch, designed for developers who want full control over their API testing workflows. It runs on your own infrastructure — no cloud dependency, no subscription, no telemetry.

Can be deployed as a **shared team server** (Node.js + PostgreSQL) or run **standalone** on a single machine with SQLite (zero configuration).

---

## Why FreeSomnia?

| | Postman | Hoppscotch | **FreeSomnia** |
|---|---------|------------|----------------|
| Self-hosted | Cloud-first | Partial | **Yes, fully** |
| Standalone mode | No | No | **Yes (SQLite, no setup)** |
| Team collaboration | Paid plans | Limited | **Built-in groups** |
| No account required | No | No | **Yes (single-user mode)** |
| Import from others | - | - | **Postman, Hoppscotch, cURL, OpenAPI** |
| Runs on bare metal | No | Docker | **Yes (Debian/Ubuntu, no Docker)** |
| Open source | No | Yes | **Yes** |
| Price | $$$  | Free/Paid | **Free forever** |

---

## Features

**Core**
- Collections with nested folders and drag & drop reordering
- **Favorites**: star requests to pin them in a collapsible "FAVORITES" section at the top of the sidebar
- **Search bar**: filter collections and requests by name — toggle with search icon, auto-expands matches
- Full HTTP client: all methods, headers, params, body (JSON, form-data, raw, JSON:API)
- Environment variables with `{{variable}}` interpolation and syntax highlighting
- Inline request rename: double-click on tab or sidebar, or use the context menu
- Request history and response viewer with syntax highlighting

**Authentication**
- Bearer, Basic, API Key, JWT, OAuth2, OpenID Connect, Hawk
- FreeFW JWT format (`JWT id="<token>"`)
- Folder-level auth inheritance — set once, inherit everywhere

**Team Collaboration**
- Groups with roles (owner, admin, member)
- Shared collections and environments
- Admin dashboard: manage members, collections, environments per group
- User registration with email verification + admin approval
- Audit log for tracking all actions

**Developer Experience**
- Code generation: cURL, PHP, Python (with inherited headers & auth)
- JSON:API query builder (filters, sort, include, pagination, fields)
- 3 send modes: Server, Browser (fetch), Agent (local WebSocket proxy)
- Import: Postman v2.1, Hoppscotch, cURL, OpenAPI 3.x
- Folder inheritance: headers, params, auth, base URL cascade from parent to child

**Deployment**
- **Standalone**: run with SQLite, zero configuration, single binary-like experience
- **Team server**: Node.js + PostgreSQL with systemd service
- Single `tar.gz` deployment kit (~900KB)
- Nginx reverse proxy ready + Let's Encrypt SSL
- Automated install script with PostgreSQL migration support

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/jeromeklam/freesomny.git
cd freesomny
pnpm install

# Configure
cp apps/server/.env.example apps/server/.env

# Initialize database and start
pnpm db:migrate
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4 |
| Backend | Node.js, Fastify, Prisma |
| Database | SQLite (standalone) / PostgreSQL (team) |
| Auth | JWT, bcryptjs |
| Language | TypeScript (strict mode) |
| Monorepo | pnpm workspaces + Turborepo |
| State | Zustand (UI) + TanStack Query (server) |

---

## Project Structure

```
freesomnia/
├── apps/
│   ├── web/                  # React frontend (Vite)
│   └── server/               # Fastify backend
│       ├── src/routes/       # API routes
│       ├── src/services/     # Business logic
│       └── prisma/           # Schema + migrations
├── packages/
│   ├── shared/               # Types, validation (zod), constants
│   ├── import-export/        # Postman/Hoppscotch/cURL/OpenAPI importers
│   └── agent/                # Local proxy agent CLI
├── scripts/
│   ├── make-kit.sh           # Build deployment tarball
│   ├── install.sh            # Server install/deploy script
│   └── deploy.sh             # CI/CD deployment
├── DEPLOYMENT.md             # Full deployment guide
└── CLAUDE.md                 # AI assistant context
```

---

## Production Deployment

### Option 1: Deployment Kit (Recommended)

```bash
# Build the kit
./scripts/make-kit.sh

# Copy to server
scp freesomnia-deploy-*.tar.gz server:/tmp/

# On server
cd /tmp && tar xzf freesomnia-deploy-*.tar.gz
cd freesomnia-deploy-*
sudo ./install.sh install    # First time
sudo ./install.sh deploy     # Updates
```

### Option 2: From Source

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions including:
- PostgreSQL setup for team mode
- Nginx reverse proxy configuration
- Let's Encrypt SSL
- Systemd service management
- Jenkins CI/CD pipeline

---

## Configuration

Key environment variables (see `.env.example` for all options):

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/freesomnia"
NODE_ENV=production
JWT_SECRET=your-secure-random-string    # openssl rand -base64 32
AUTH_REQUIRED=true                       # Enable authentication
CORS_ORIGINS=https://yourdomain.com

# SMTP — authenticated or unauthenticated relay
SMTP_HOST=mail.internal.local
SMTP_PORT=25                             # 25=relay, 587=STARTTLS, 465=SSL
SMTP_FROM=noreply@yourdomain.com
# SMTP_USER=...                          # Optional (omit for port 25 relay)
# SMTP_PASS=...                          # Optional
```

---

## Agent Mode

Run API requests from your local machine through a WebSocket proxy — bypass CORS, access localhost services, use local certificates:

```bash
npx freesomnia-agent --server https://freesomnia.yourdomain.com \
  --email you@example.com --password your-password --name "My Laptop"
```

The agent appears in the send mode dropdown and all requests are executed locally.

---

## Roadmap

- [ ] **Tauri integration** — native desktop app (macOS, Linux, Windows) with embedded backend for true standalone experience
- [ ] Collection runner (run all requests in sequence)
- [ ] WebSocket & GraphQL support
- [ ] Visual request chaining + conditional branching
- [ ] Command palette (Ctrl+K)

---

## Built With Claude

This project is developed and maintained with the help of [Claude](https://claude.ai) by Anthropic. From architecture decisions to implementation, Claude Code serves as an AI pair programmer throughout the development process.

---

## License

MIT

---

<p align="center">
  <strong>FreeSomnia</strong> — Your APIs, your server, your rules.
</p>
