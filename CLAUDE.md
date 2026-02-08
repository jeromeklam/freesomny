# CLAUDE.md — FreeSomnia (Postman/Hoppscotch Alternative)

## What is this project

A local-first, self-hostable API client for teams. Replaces Postman (paid) and Hoppscotch (broken team collab). Web app served from a Node.js backend, runs directly on Debian — no Docker.

## TODO — Next Steps

### Medium Priority
- [ ] Add request/folder rename inline editing
- [ ] Implement drag & drop reordering for folders/requests
- [ ] Add keyboard shortcuts (Ctrl+Enter to send, Ctrl+S to save, etc.)

### Team Features (remaining)
- [ ] Activity feed + audit log
- [ ] Role-based permissions

### Low Priority / Phase 3
- [ ] Collection runner (run all requests in sequence)
- [ ] Visual request chaining + conditional branching
- [ ] WebSocket support
- [ ] GraphQL support
- [ ] Code generation (cURL, Python, JS, Go, etc.)
- [ ] Command palette (Ctrl+K)
- [ ] Add export functionality UI (OpenAPI, cURL export buttons)

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** Node.js + Fastify + Prisma
- **Database:** SQLite (local) / PostgreSQL (team)
- **Auth:** JWT (bcryptjs, @fastify/jwt)
- **Language:** TypeScript everywhere
- **Monorepo:** pnpm workspaces + Turborepo

## Project structure

```
freesomnia/
├── apps/
│   ├── web/                  # React frontend (Vite)
│   └── server/               # Fastify backend
│       ├── src/routes/       # API routes
│       ├── src/services/     # Business logic
│       └── prisma/           # Schema + migrations
├── packages/
│   ├── shared/               # Types, validation (zod)
│   └── import-export/        # Postman/Hoppscotch/cURL importers
├── scripts/deploy.sh         # Deployment script
├── Jenkinsfile               # CI/CD pipeline
├── DEPLOYMENT.md             # Deployment guide
└── CLAUDE.md
```

## Key models (Prisma)

- **User** - email, password (bcrypt), name, role
- **Group** - team collaboration, members with roles (owner/admin/member)
- **GroupMember** - user membership in groups
- **Folder** - collections with inheritable settings (headers, auth, scripts, baseUrl)
- **Request** - HTTP requests with method, url, headers, body, auth
- **Environment** - variable sets (dev, staging, prod)
- **EnvironmentVariable** - key/value with type (string/secret)

## Core features

### Folder inheritance
Settings merge from root → leaf → request:
- headers/queryParams: deep merge by key
- authType: override (inherit walks up)
- baseUrl: concatenate segments
- preScript/postScript: chain execution

### Auth types supported
inherit, none, bearer, basic, apikey, jwt, jwt_freefw, oauth2, openid, hawk

### Authorization header management
- Authorization headers are **exclusively managed by the Auth tab** — never stored in raw headers
- 3-layer defense: import-time stripping, save-time auto-sync, read-time filtering
- **Headers tab**: shows auth-generated Authorization as a **read-only inherited row** (blue styling) with source folder name
- Resolved view (Résolu tab) shows auth-generated header preview with `[auth:source]` badge
- FreeFW JWT format: `JWT id="<token>"` (with double quotes)
- `getAuthHeaderPreview()` in inheritance.ts generates header value from auth config without executing
- `POST /api/cleanup/auth-headers` — one-time bulk cleanup of stale Authorization headers in DB

### Auth override with `authType: none`
- Setting auth to "none" on a request/folder **suppresses inherited auth headers** (blue rows hidden)
- Authorization header is **preserved in DB** — not stripped on read or save
- User can freely add/edit Authorization manually in the Headers tab
- Backend `stripAuthHeader()` accepts `authType` param: skips stripping when `'none'`
- Backend save auto-sync: 3-branch logic — `inherit` (auto-detect), `none` (pass through), other (strip)
- Frontend `inheritedHeaders` useMemo filters out `auth:` items when `authType === 'none'`
- Cleanup endpoint also respects `authType: none` (skips those items)

### Groups (team collaboration)
- Users belong to groups with roles (owner/admin/member)
- Folders and environments can be assigned to groups
- All group members see group resources

## API routes

```
# Auth
POST /api/auth/register, /api/auth/login
GET  /api/auth/me, /api/auth/status

# Groups
GET/POST /api/groups
GET/PUT/DELETE /api/groups/:id
POST /api/groups/:id/members
POST /api/groups/:id/folders, /api/groups/:id/environments

# Folders
GET/POST /api/folders
PUT/DELETE /api/folders/:id
POST /api/folders/:id/share

# Requests
GET/POST/PUT/DELETE /api/requests/:id
POST /api/requests/:id/send
GET  /api/requests/:id/resolved
GET  /api/requests/:id/inherited

# Folders (additional)
GET  /api/folders/:id/inherited
GET  /api/folders/:id/resolved-settings
POST /api/cleanup/auth-headers

# Environments
GET/POST /api/environments
PUT/DELETE /api/environments/:id
POST /api/environments/:id/share

# Import
POST /api/import/postman, /api/import/hoppscotch
POST /api/import/curl, /api/import/openapi
```

## Environment variables

```bash
DATABASE_URL="file:./data/api-client.db"  # or postgresql://...
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
JWT_SECRET=change-me-in-production
AUTH_REQUIRED=false  # true = force login
```

## Installation Checklist

### Prerequisites
- [ ] Node.js 22+ installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] Git access to repository

### Development (local)
```bash
git clone <repo-url> freesomnia && cd freesomnia
pnpm install
cp apps/server/.env.example apps/server/.env
pnpm db:migrate      # Initialize SQLite database
pnpm dev             # Start dev servers (frontend :5173 + backend :3000)
```

### Production (Debian/Ubuntu)
1. [ ] Install Node.js 22: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs`
2. [ ] Install pnpm: `npm install -g pnpm`
3. [ ] Clone: `sudo mkdir -p /opt/freesomnia && cd /opt/freesomnia && git clone <repo> .`
4. [ ] Install deps: `pnpm install`
5. [ ] Configure: `cp apps/server/.env.example apps/server/.env && nano apps/server/.env`
   - Set `DATABASE_URL` (SQLite or PostgreSQL)
   - Set `NODE_ENV=production`
   - Set `JWT_SECRET` (generate: `openssl rand -base64 32`)
   - Set `AUTH_REQUIRED=true`
   - Set `CORS_ORIGINS=https://yourdomain.com`
   - (Optional) Set SMTP vars for password reset emails
6. [ ] Build: `pnpm build`
7. [ ] Run migrations: `pnpm --filter @api-client/server prisma migrate deploy`
8. [ ] Create service user: `sudo useradd -r -s /bin/false freesomnia`
9. [ ] Set ownership: `sudo chown -R freesomnia:freesomnia /opt/freesomnia`
10. [ ] Copy env: `sudo cp apps/server/.env /opt/freesomnia/.env && sudo chmod 600 /opt/freesomnia/.env`
11. [ ] Install systemd: `sudo cp apps/server/freesomnia.service /etc/systemd/system/`
12. [ ] Enable & start: `sudo systemctl daemon-reload && sudo systemctl enable freesomnia && sudo systemctl start freesomnia`
13. [ ] (Optional) Set up Nginx reverse proxy + Let's Encrypt SSL (see DEPLOYMENT.md)
14. [ ] (Optional, one-time) Cleanup stale auth headers: `curl -X POST http://localhost:3000/api/cleanup/auth-headers`

### Automated deployment
```bash
./scripts/deploy.sh dev        # Local development
DEPLOY_HOST=server ./scripts/deploy.sh staging  # Remote staging
DEPLOY_HOST=server ./scripts/deploy.sh prod     # Remote production (with confirmation)
```

## Coding conventions

- TypeScript strict mode
- Zod for API validation
- Zustand for frontend state
- TanStack Query for server state
- Tailwind CSS (dark mode default)
- API responses: `{ data: T }` or `{ error: string }`
