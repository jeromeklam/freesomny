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
inherit, none, bearer, basic, apikey, jwt, oauth2, openid, hawk

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

## Coding conventions

- TypeScript strict mode
- Zod for API validation
- Zustand for frontend state
- TanStack Query for server state
- Tailwind CSS (dark mode default)
- API responses: `{ data: T }` or `{ error: string }`
