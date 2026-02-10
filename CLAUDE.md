# CLAUDE.md — FreeSomnia (Postman/Hoppscotch Alternative)

## What is this project

A local-first, self-hostable API client for teams. Replaces Postman (paid) and Hoppscotch (broken team collab). Web app served from a Node.js backend, runs directly on Debian — no Docker.

## Version management

- Version and changelog are in `packages/shared/src/version.ts`
- **On every update**: bump `APP_VERSION` and add a new `CHANGELOG` entry (in French)
- Changelog is displayed in the UI via the version badge next to the app name
- Follow semver: patch for fixes, minor for features, major for breaking changes
- Current version: see `APP_VERSION` in `packages/shared/src/version.ts`

## TODO — Next Steps

### Medium Priority
- [x] Add request rename inline editing (double-click on tab/sidebar + context menu)
- [ ] Add folder rename inline editing
- [ ] Implement drag & drop reordering for folders/requests
- [ ] Add keyboard shortcuts (Ctrl+Enter to send, Ctrl+S to save, etc.)

### Team Features (remaining)
- [ ] Activity feed + audit log
- [ ] Role-based permissions

### Low Priority / Phase 3
- [ ] **Tauri integration** — native desktop app for standalone experience
- [ ] Collection runner (run all requests in sequence)
- [ ] Visual request chaining + conditional branching
- [ ] WebSocket support
- [ ] GraphQL support
- [ ] Command palette (Ctrl+K)
- [ ] Add export functionality UI (OpenAPI, cURL export buttons)

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** Node.js + Fastify + Prisma
- **Database:** SQLite (local dev) / PostgreSQL (production)
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
│       ├── src/services/     # Business logic (http-engine, agent-manager, etc.)
│       └── prisma/           # Schema + migrations
├── packages/
│   ├── shared/               # Types, validation (zod)
│   ├── import-export/        # Postman/Hoppscotch/cURL importers
│   └── agent/                # Local proxy agent CLI (@api-client/agent)
├── scripts/
│   ├── make-kit.sh           # Build self-contained deployment tarball
│   ├── install.sh            # Server install/deploy/migrate script
│   ├── deploy.sh             # CI/CD deployment
│   ├── README-INSTALL.md     # Installation guide (included in kit)
│   └── migrate-postgresql*.sql  # PostgreSQL migration scripts
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

### Favorite requests
- `isFavorite` boolean field on Request model (Prisma)
- Star icon on each request in sidebar: yellow filled = favorited, gray outline on hover = not favorited
- Context menu: "Add to Favorites" / "Remove from Favorites"
- Collapsible "FAVORITES" section at top of sidebar (above COLLECTIONS)
- Shows flat list: method badge + name + collection name + unstar button on hover
- `GET /api/requests/favorites` endpoint returns favorited requests with folder name
- Collapse state persisted in localStorage via Zustand
- Toggle via `useToggleFavorite()` hook → `PUT /api/requests/:id` with `{ isFavorite }`

### Collection search
- Search bar in sidebar header: toggleable via Search icon, filters collections and requests by name
- Recursive filter: shows matching folders/requests and their parent chain
- Auto-expands all folders that contain matches when search is active
- Clear button (X) to reset and show full tree again
- Escape key also clears and hides the search bar

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

### Send modes (browser fetch + agent proxy)
3 ways to execute HTTP requests, selected via split-button dropdown next to Send:

- **Server** (default): request executed by Fastify backend via `undici` — standard mode
- **Browser**: request executed by browser's `fetch()` API — can reach localhost/Docker containers. Subject to CORS restrictions. Flow: `POST /prepare` → browser `fetch()` → `POST /report`
- **Agent**: request forwarded via WebSocket to a local agent CLI running on the dev machine — full HTTP capabilities (no CORS, SSL bypass, all headers). The agent authenticates with JWT and connects via `GET /api/ws/agent`

Key files:
- `apps/server/src/services/http-engine.ts` — `prepareRequest()` (shared) + `executeRequest()`
- `apps/web/src/lib/browser-fetch.ts` — browser-side fetch execution
- `apps/server/src/services/agent-manager.ts` — WebSocket agent connection manager
- `apps/server/src/routes/agents.ts` — WS endpoint + `GET /api/agents`
- `packages/agent/` — standalone CLI: `freesomnia-agent --server URL --email x --password y`

### Groups (team collaboration)
- Users belong to groups with roles (owner/admin/member)
- Folders and environments can be assigned to groups
- All group members see group resources
- **UI**: FolderSettings General tab and EnvironmentModal Settings tab have group assignment dropdowns
- **FolderTree**: purple badge with Users icon shows group name on group-owned folders
- **Inherited group**: subfolders of group-owned collections show a dimmer purple badge (inherited); FolderSettings shows inherited group as read-only
- **Admin Groups tab**: shows Members, Collections, and Environments sections (list with remove buttons)
- **Backend**: `POST /api/groups/:id/folders` (assign), `DELETE /api/groups/:id/folders/:folderId` (unassign)
- **Backend**: `POST /api/groups/:id/environments` (assign), `DELETE /api/groups/:id/environments/:envId` (unassign)
- **Admin backend**: `DELETE /api/admin/groups/:id/folders/:folderId` (admin remove folder from group)
- **Admin backend**: `DELETE /api/admin/groups/:id/environments/:environmentId` (admin remove env from group)

### Theme switcher (light / dark / auto)
- 3 modes: `light`, `dark` (default), `auto` (follows OS preference via `matchMedia`)
- Persisted in Zustand store (localStorage) like language preference
- `Theme` type (`'light' | 'dark' | 'auto'`) in `apps/web/src/stores/app.ts`
- `useTheme()` hook in `apps/web/src/hooks/useTheme.ts` — applies/removes `dark` class on `<html>`, listens to `matchMedia` in auto mode
- Toggle: Moon/Sun/Monitor icon button in header, cycles dark → light → auto
- Tailwind `darkMode: 'class'` — all components use `dark:` variants (light defaults + dark overrides)
- CSS (index.css): scrollbar and CodeMirror themes use `.dark` parent selector
- Color mapping: `bg-gray-900`→`bg-gray-50 dark:bg-gray-900`, `bg-gray-800`→`bg-white dark:bg-gray-800`, `border-gray-700`→`border-gray-200 dark:border-gray-700`, `text-gray-400`→`text-gray-500 dark:text-gray-400`, `text-white`→`text-gray-900 dark:text-white`
- Accent/semantic colors (blue, green, red, yellow, purple, orange) left unchanged

### Code generation
- CodeGeneratorModal: cURL, PHP, Python code generation
- Includes inherited headers from parent folders and auth-generated Authorization
- Supports all auth types: bearer, basic, apikey, jwt_freefw, oauth2, openid
- `buildMergedRequest()` merges inherited + request headers and resolves inherited auth

### Deployment kit (`scripts/make-kit.sh` + `scripts/install.sh`)
Self-contained tarball — NO pnpm, npm, or prisma needed on the target server.

**Build process (`make-kit.sh`):**
1. `pnpm build` — compiles TypeScript (server + shared + import-export) and Vite (frontend)
2. Patches `schema.prisma`: `sqlite` → `postgresql`, adds `binaryTargets = ["native", "debian-openssl-3.0.x"]` on macOS
3. `pnpm --filter @api-client/server deploy --prod $KIT_DIR/apps/server` — creates standalone server with flat `node_modules` (no symlinks, no workspace)
4. Restores original schema (trap on EXIT for safety)
5. Explicit `prisma generate` as insurance (searches kit → project server → project root for prisma CLI)
6. Copies `apps/web/dist`, `install.sh`, `.env.example`, `freesomnia.service`, migration SQL scripts
7. Creates `freesomnia-deploy-{version}-{date}.tar.gz`

**Deploy process (`install.sh`):**
- Commands: `install` (first time), `deploy` (updates), `migrate` (DB only), `status`
- `deploy_files()`: backs up `.env`, copies `apps/` to `/opt/freesomnia/apps/`, restores `.env`
- `rebuild_native_modules()`: runs `npm rebuild isolated-vm` to recompile C++ addon for target platform (requires `npm` + `build-essential`)
- `run_migrations()`: applies `migrate-postgresql*.sql` via `psql`, tracks in `_prisma_migrations` table via direct SQL INSERT
- `setup_service()`: creates `freesomnia` user, installs systemd service
- `ensure_node()`: finds Node.js (nvm dirs, PATH) and copies to `/usr/local/bin/node`

**Kit structure (deployed to `/opt/freesomnia/`):**
```
/opt/freesomnia/
├── apps/
│   ├── web/dist/              # Frontend (Vite build)
│   └── server/
│       ├── dist/index.js      # Compiled backend entry point
│       ├── prisma/            # Schema (postgresql) + migrations
│       ├── node_modules/      # All prod deps (flat, from pnpm deploy)
│       └── package.json
├── scripts/
│   ├── install.sh
│   └── migrate-postgresql*.sql
├── .env                       # Server configuration
└── freesomnia.service         # Systemd unit file
```

**Cross-platform notes:**
- `isolated-vm` (C++ native addon): lazy dynamic import in `sandbox.ts` — server starts even if module can't load; scripts skip gracefully with warning instead of blocking requests
- `install.sh` automatically runs `npm rebuild isolated-vm` after deploy (requires `apt install npm build-essential python3` on server)
- Prisma binary targets: macOS builds include both `native` (macOS) and `debian-openssl-3.0.x` (Linux) query engines
- Schema patching happens BEFORE `pnpm deploy` so `@prisma/client` postinstall generates the correct PostgreSQL client

**Adding new PostgreSQL migrations:**
1. Create `scripts/migrate-postgresql-{feature}.sql` with header: `-- Migration: {prisma_migration_name}`
2. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotent SQL
3. The migration name must match the Prisma migration directory name exactly
4. `install.sh` will auto-apply and track it in `_prisma_migrations`

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
DELETE /api/groups/:id/folders/:folderId, /api/groups/:id/environments/:envId

# Folders
GET/POST /api/folders
PUT/DELETE /api/folders/:id
POST /api/folders/:id/share

# Requests
GET/POST/PUT/DELETE /api/requests/:id
POST /api/requests/:id/send          # ?via=agent&agentId=xxx for agent mode
POST /api/requests/:id/prepare       # Resolve + pre-scripts, return ready-to-execute data
POST /api/requests/:id/report        # Post-scripts + history after browser-side fetch
GET  /api/requests/:id/resolved
GET  /api/requests/:id/inherited

# Agents (WebSocket proxy)
GET  /api/ws/agent                   # WebSocket upgrade (?token=JWT&name=AgentName)
GET  /api/agents                     # List connected agents for current user

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

# SMTP (email): authenticated (port 587/465) or unauthenticated relay (port 25)
# If SMTP_HOST is not set, emails are logged to console instead
SMTP_HOST=smtp.example.com
SMTP_PORT=25            # 25=relay (no auth), 587=STARTTLS, 465=SSL
SMTP_USER=              # optional — omit for unauthenticated relay
SMTP_PASS=              # optional — omit for unauthenticated relay
SMTP_FROM=noreply@example.com
```

## Database: SQLite vs PostgreSQL

- **Development:** SQLite (`provider = "sqlite"` in schema.prisma, `DATABASE_URL="file:./data/api-client.db"`)
- **Production:** PostgreSQL (`DATABASE_URL="postgresql://user:pass@host:5432/freesomnia"`)
- **IMPORTANT:** Prisma schema uses `provider = "sqlite"`, so auto-generated migrations produce SQLite-specific SQL (PRAGMA, table recreation). These migrations **do NOT work on PostgreSQL**.
- **For production deployments with schema changes:** manually apply the equivalent PostgreSQL SQL (`ALTER TABLE ADD COLUMN`, etc.), then run `prisma migrate resolve --applied <migration_name>` to mark the migration as applied, then `prisma generate` to update the client.
- **All new code touching new DB fields must be backwards-compatible** (try/catch or `'field' in obj` checks) so the server doesn't crash if the migration hasn't been applied yet.

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

### Production (Recommended: Deployment Kit)
```bash
# On dev machine: build the self-contained kit
./scripts/make-kit.sh

# Copy to server
scp freesomnia-deploy-*.tar.gz server:/tmp/

# On server: extract and install
cd /tmp && tar xzf freesomnia-deploy-*.tar.gz && cd freesomnia-deploy-*
sudo ./install.sh install    # First time (creates user, service, .env)
sudo ./install.sh deploy     # Updates (preserves .env, runs migrations)
```

After first install, edit `/opt/freesomnia/.env`:
- `DATABASE_URL=postgresql://user:pass@localhost:5432/freesomnia`
- `JWT_SECRET=$(openssl rand -base64 32)`
- `AUTH_REQUIRED=true`
- `NODE_ENV=production`
- `CORS_ORIGINS=https://yourdomain.com`
- (Optional) SMTP vars for password reset emails

### Production (Alternative: From Source)
1. [ ] Install Node.js 22 + pnpm on the server
2. [ ] Clone, `pnpm install`, `pnpm build`
3. [ ] Configure `.env`, run Prisma migrations
4. [ ] Set up systemd service
5. [ ] See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions

## Coding conventions

- TypeScript strict mode
- Zod for API validation
- Zustand for frontend state
- TanStack Query for server state
- Tailwind CSS (light/dark/auto theme, `darkMode: 'class'`)
- API responses: `{ data: T }` or `{ error: string }`
