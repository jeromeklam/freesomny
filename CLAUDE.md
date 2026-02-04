# CLAUDE.md — FreeSomnia (Postman/Hoppscotch Alternative)

## What is this project

A local-first, self-hostable API client for teams. Replaces Postman (paid) and Hoppscotch (broken team collab). Web app served from a Node.js backend, runs directly on Debian — no Docker.

## TODO — Next Steps

### High Priority
- [ ] Complete i18n for remaining components (FolderTree, FolderSettings, History, ImportModal, AuthEditor, BodyEditor, ScriptEditor, KeyValueEditor)
- [ ] Persist language preference to localStorage
- [ ] Add Settings modal UI (currently no UI, just the button)
- [ ] Implement request execution error handling (show errors in UI)

### Medium Priority
- [ ] Add export functionality UI (OpenAPI, cURL export buttons)
- [ ] Implement request duplication
- [ ] Add request/folder rename inline editing
- [ ] Implement drag & drop reordering for folders/requests
- [ ] Add keyboard shortcuts (Ctrl+Enter to send, Ctrl+S to save, etc.)
- [ ] Add request tabs (multiple requests open at once)

### Low Priority / Phase 2
- [ ] Collection runner (run all requests in sequence)
- [ ] Visual request chaining + conditional branching
- [ ] WebSocket support
- [ ] GraphQL support
- [ ] Code generation (cURL, Python, JS, Go, etc.)
- [ ] Command palette (Ctrl+K)

### Team Features (Phase 3)
- [ ] PostgreSQL backend + user auth (JWT)
- [ ] Shared folders (push/pull/conflict resolution)
- [ ] Shared environments
- [ ] Activity feed + audit log
- [ ] Role-based permissions

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** Node.js + Fastify + Prisma
- **HTTP client:** undici (Node.js built-in, handles HTTP/1.1 + HTTP/2, custom DNS, mTLS)
- **Database:** SQLite (local dev + solo) / PostgreSQL (team server)
- **Scripting sandbox:** isolated-vm (V8 isolates for user scripts)
- **Auth:** jsonwebtoken (JWT signing), hawk (Hawk auth), openid-client (OIDC discovery)
- **Language:** TypeScript everywhere
- **Monorepo:** pnpm workspaces + Turborepo
- **Target OS:** Debian 12+ (bare metal / VM, no Docker)

## Project structure

```
api-client/
├── apps/
│   ├── web/                  # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── components/   # UI components
│   │   │   ├── hooks/        # React hooks
│   │   │   ├── stores/       # Zustand stores
│   │   │   ├── lib/          # Utilities
│   │   │   └── pages/        # Route pages
│   │   └── vite.config.ts
│   └── server/               # Fastify backend
│       ├── src/
│       │   ├── routes/       # API routes
│       │   ├── services/     # Business logic
│       │   ├── scripting/    # JS sandbox engine
│       │   └── lib/          # Utilities
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
├── packages/
│   ├── shared/               # Shared types, constants, validation (zod)
│   └── import-export/        # Postman/Hoppscotch/cURL/OpenAPI importers
├── CLAUDE.md
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Database schema (Prisma — core models)

```prisma
model Folder {
  id          String    @id @default(cuid())
  name        String
  description String    @default("")  // markdown — documents this folder's purpose
  parentId    String?   // null = root-level collection
  parent      Folder?   @relation("children", fields: [parentId], references: [id])
  children    Folder[]  @relation("children")
  requests    Request[]

  // --- Inheritable settings (merge down to children) ---
  headers     Json      @default("[]")  // [{key, value, description?, enabled}]
  queryParams Json      @default("[]")  // [{key, value, description?, enabled}]
  authType    String    @default("inherit") // inherit | none | bearer | basic | apikey | jwt | oauth2 | openid | hawk
  authConfig  Json      @default("{}")     // shape depends on authType, see Auth System section
  preScript   String?   // JS — runs before all requests in this folder + subfolders
  postScript  String?   // JS — runs after all requests in this folder + subfolders
  baseUrl     String?   // optional — prepended to request URLs (e.g. "{{base_url}}/v2")

  // --- Network settings (inheritable, "inherit" = use parent / global default) ---
  timeout         Int?      // ms, null = inherit from parent, root default = 30000
  followRedirects String    @default("inherit") // inherit | true | false
  verifySsl       String    @default("inherit") // inherit | true | false
  proxy           String?   // http://proxy:8080, null = inherit

  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Request {
  id            String    @id @default(cuid())
  name          String
  description   String    @default("")  // markdown — documents what this request does, expected behavior, notes
  method        String    @default("GET") // GET POST PUT PATCH DELETE HEAD OPTIONS
  url           String    @default("")    // relative or absolute — folder baseUrl prepended if set
  queryParams   Json      @default("[]")  // [{key, value, description?, enabled}]
  headers       Json      @default("[]")  // [{key, value, description?, enabled}]
  bodyType      String    @default("none") // none json form-data urlencoded raw binary
  body          String    @default("")
  bodyDescription String  @default("")    // documents the body schema / expected format
  authType      String    @default("inherit") // inherit | none | bearer | basic | apikey | jwt | oauth2 | openid | hawk
  authConfig    Json      @default("{}")     // shape depends on authType, see Auth System section
  preScript     String?   // JS pre-request hook
  postScript    String?   // JS post-response hook

  // --- Network settings (per-request override) ---
  timeout         Int?      // null = inherit
  followRedirects String    @default("inherit")
  verifySsl       String    @default("inherit")
  proxy           String?   // null = inherit

  folderId      String
  folder        Folder    @relation(fields: [folderId], references: [id], onDelete: Cascade)
  sortOrder     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Key-value item shape (headers, queryParams)

All key-value arrays (headers, query params) use this shape:

```ts
interface KeyValueItem {
  key: string
  value: string
  description?: string   // optional — documents what this param/header does
  enabled: boolean       // toggle on/off without deleting
}
```

Examples:
```json
[
  { "key": "Authorization", "value": "Bearer {{token}}", "description": "JWT from /auth/login post-script", "enabled": true },
  { "key": "X-Request-Id",  "value": "{{$randomUUID}}",  "description": "Trace ID for distributed tracing", "enabled": true },
  { "key": "X-Debug",       "value": "1",                 "description": "Enable debug logging on server", "enabled": false }
]
```

## Core feature: folder inheritance

Folders form a tree. Every inheritable setting merges from root → leaf → request. This is the heart of the data model.

### What gets inherited and how

| Setting      | Merge strategy | Example |
|-------------|---------------|---------|
| **headers** | Deep merge — child adds/overrides by key, parent headers still apply | Root sets `X-Api-Version: 2`, subfolder adds `X-Team: billing` → request gets both |
| **queryParams** | Deep merge — same as headers, by key | Root sets `format=json`, subfolder adds `verbose=true` → request gets both |
| **authType** | Override — `"inherit"` means use parent's value, any other value replaces entirely | Root sets Bearer token, subfolder says `"inherit"` → uses root's Bearer. Subfolder sets `"basic"` → overrides. |
| **baseUrl** | Concatenate — each level appends its segment | Root: `{{host}}`, subfolder: `/api/v2`, sub-subfolder: `/users` → final: `{{host}}/api/v2/users` |
| **preScript** | Chain — all scripts run in order root→leaf (see execution order below) | Root pre-script sets auth header, subfolder pre-script adds logging |
| **postScript** | Chain — all scripts run in order leaf→root | Request post-script saves token, root post-script logs timing |
| **timeout** | Override — null means inherit from parent, root fallback = global setting (30s) | Root sets 60s for slow API, subfolder inherits, one request overrides to 5s |
| **followRedirects** | Override — `"inherit"` walks up, root fallback = true | Root sets true, one folder disables for OAuth redirect capture |
| **verifySsl** | Override — `"inherit"` walks up, root fallback = global setting (true) | Root folder for local Docker APIs sets false (self-signed certs) |
| **proxy** | Override — null means inherit from parent, root fallback = global proxy or none | Corporate folder uses proxy, local dev folder sets null to bypass |

### Resolution algorithm (runs at send time)

```
function resolveRequest(request):
    chain = getAncestorChain(request.folder)  // [root, ..., parent, folder]

    // 1. Merge headers (parent first, child overrides by key)
    mergedHeaders = {}
    for folder in chain:
        for h in folder.headers where h.enabled:
            mergedHeaders[h.key] = h.value    // child overwrites parent
    for h in request.headers where h.enabled:
        mergedHeaders[h.key] = h.value        // request overwrites all

    // 2. Merge queryParams (same logic)
    mergedParams = {}
    for folder in chain:
        for p in folder.queryParams where p.enabled:
            mergedParams[p.key] = p.value
    for p in request.queryParams where p.enabled:
        mergedParams[p.key] = p.value

    // 3. Resolve auth (walk up until non-"inherit" found)
    resolvedAuth = { type: "none", config: {} }
    if request.authType != "inherit":
        resolvedAuth = { type: request.authType, config: request.authConfig }
    else:
        for folder in reverse(chain):         // walk up from closest folder
            if folder.authType != "inherit":
                resolvedAuth = { type: folder.authType, config: folder.authConfig }
                break

    // 4. Build URL (concatenate baseUrls + request url)
    baseUrl = ""
    for folder in chain:
        if folder.baseUrl:
            baseUrl = joinUrl(baseUrl, folder.baseUrl)
    finalUrl = joinUrl(baseUrl, request.url)

    // 5. Collect scripts (all levels, ordered)
    preScripts  = chain.map(f => f.preScript).filter(Boolean) + [request.preScript].filter(Boolean)
    postScripts = [request.postScript].filter(Boolean) + reverse(chain).map(f => f.postScript).filter(Boolean)

    return { method, url: finalUrl, headers: mergedHeaders, params: mergedParams, auth: resolvedAuth, preScripts, postScripts }
```

### Folder settings UI

When editing a folder, show tabs. Only THIS folder's values are editable. Inherited values shown below, read-only.

```
FOLDER: Auth / Login
Tabs: Docs | Headers | Params | Auth | Base URL | Pre-script | Post-script

HEADERS (this folder)
────────────────────────────────────────────────────────────────
Key              Value                  Description            On
Authorization    Bearer {{token}}       JWT from login         [x]
Content-Type     application/json       Default content type   [x]

[+ Add header]

INHERITED (read-only)
────────────────────────────────────────────────────────────────
Key              Value                  From
X-Api-Version    2                      [root]
```

- Editable rows = this folder's own headers. Standard key-value table.
- Inherited rows = dimmed, read-only, shows which parent defined them
- If this folder sets a key that a parent also sets, show "overrides [parent]" next to it
- Auth tab default = "Inherit from parent"

## Core feature: auth system

The app supports 8 authentication methods. Auth is inheritable through the folder chain (see folder inheritance). The `authConfig` JSON shape depends on the `authType`.

### Auth types and their config shapes

```ts
// authType: "none" — no authentication
type AuthNone = {}

// authType: "bearer" — simple Bearer token
type AuthBearer = {
  token: string           // e.g. "{{token}}" — supports env vars
}
// → Header: Authorization: Bearer <token>

// authType: "basic" — HTTP Basic Authentication
type AuthBasic = {
  username: string        // e.g. "{{username}}"
  password: string        // e.g. "{{password}}"
}
// → Header: Authorization: Basic <base64(username:password)>

// authType: "apikey" — API Key (header, query, or cookie)
type AuthApiKey = {
  key: string             // header/param name, e.g. "X-API-Key"
  value: string           // e.g. "{{api_key}}"
  addTo: "header" | "query" | "cookie"   // where to inject the key
}
// → Adds key=value to the specified location

// authType: "jwt" — JSON Web Token (manually constructed or from env)
type AuthJwt = {
  algorithm: "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "ES256" | "ES384" | "ES512"
  secret: string          // HMAC secret or private key (PEM) — e.g. "{{jwt_secret}}"
  payload: string         // JSON string for JWT claims, supports env vars
                          // e.g. '{"sub":"{{user_id}}","iat":"{{$timestamp}}"}'
  headerPrefix: string    // default: "Bearer" — prefix in Authorization header
  addTo: "header" | "query"   // default: "header"
  queryParamName?: string     // only if addTo: "query", e.g. "jwt_token"
}
// → Signs JWT at send time, adds: Authorization: Bearer <signed_jwt>
// → payload supports dynamic vars: {{$timestamp}}, {{$randomUUID}}, env vars

// authType: "oauth2" — OAuth 2.0 (multiple grant types)
type AuthOAuth2 = {
  grantType: "authorization_code" | "client_credentials" | "password" | "implicit" | "refresh_token"
  accessTokenUrl: string      // token endpoint, e.g. "{{host}}/oauth/token"
  authUrl?: string            // authorization endpoint (for authorization_code + implicit)
  clientId: string            // e.g. "{{oauth_client_id}}"
  clientSecret?: string       // e.g. "{{oauth_client_secret}}" (not needed for implicit)
  scope?: string              // space-separated scopes, e.g. "read write admin"
  username?: string           // only for password grant
  password?: string           // only for password grant
  redirectUri?: string        // for authorization_code, e.g. "http://localhost:3000/callback"
  audience?: string           // some providers require this (Auth0, etc.)
  state?: string              // CSRF protection for authorization_code
  pkce: boolean               // enable PKCE (Proof Key for Code Exchange) — default: false
  codeChallengeMethod?: "S256" | "plain"  // only if pkce: true
  tokenPrefix: string         // default: "Bearer"
  headerPrefix: string        // default: "Bearer"
  addTo: "header" | "query"   // default: "header"
  // --- Token management ---
  accessToken?: string        // cached token (filled after successful auth)
  refreshToken?: string       // cached refresh token
  expiresAt?: number          // unix timestamp — auto-refresh when expired
  autoRefresh: boolean        // default: true — refresh token automatically before expiry
}
// → Full OAuth2 flow. For authorization_code: opens browser popup for consent.
// → Tokens cached in authConfig, auto-refreshed when expired.
// → PKCE support for public clients (mobile, SPA).

// authType: "openid" — OpenID Connect (built on OAuth2 + discovery)
type AuthOpenId = {
  discoveryUrl: string        // e.g. "https://accounts.google.com/.well-known/openid-configuration"
                              // OR "{{host}}/.well-known/openid-configuration"
  clientId: string
  clientSecret?: string       // optional for public clients
  scope: string               // must include "openid", e.g. "openid profile email"
  redirectUri?: string
  responseType?: string       // default: "code" (authorization code flow)
  pkce: boolean               // default: true for OpenID
  codeChallengeMethod?: "S256" | "plain"
  audience?: string
  // --- Auto-fetched from discovery ---
  authorizationEndpoint?: string  // auto-populated from discovery
  tokenEndpoint?: string          // auto-populated from discovery
  userinfoEndpoint?: string       // auto-populated from discovery
  jwksUri?: string                // auto-populated from discovery
  // --- Token management ---
  accessToken?: string
  idToken?: string            // OpenID-specific: JWT containing user claims
  refreshToken?: string
  expiresAt?: number
  autoRefresh: boolean        // default: true
  tokenPrefix: string         // default: "Bearer"
  addTo: "header" | "query"
}
// → Fetches .well-known/openid-configuration to discover endpoints.
// → Standard authorization code flow with PKCE by default.
// → Caches access_token + id_token, auto-refresh.
// → id_token can be used in scripts: env.get("__id_token__")

// authType: "hawk" — Hawk HTTP Authentication
type AuthHawk = {
  authId: string              // Hawk credentials ID, e.g. "{{hawk_id}}"
  authKey: string             // Hawk credentials key, e.g. "{{hawk_key}}"
  algorithm: "sha256" | "sha1"  // default: "sha256"
  ext?: string                // app-specific extension data
  app?: string                // application ID (Oz)
  dlg?: string                // delegated-by (Oz)
  nonce?: string              // custom nonce — auto-generated if empty
  timestamp?: string          // custom timestamp — auto-generated if empty
  includePayloadHash: boolean // default: false — hash request body in MAC
}
// → Computes Hawk Authorization header at send time:
//   Authorization: Hawk id="xxx", ts="xxx", nonce="xxx", mac="xxx"
// → Payload hashing optional (include body content-type + hash in MAC)
```

### Auth UI — tab layout per type

The Auth tab shows a type dropdown at the top, then the fields for that type. All fields support env vars `{{var}}`.

```
AUTH
Type: [Inherit from parent v]  ← default
      [None]
      [Bearer Token]
      [Basic Auth]
      [API Key]
      [JWT]
      [OAuth 2.0]
      [OpenID Connect]
      [Hawk]

If inherited: "Using bearer from [root]"  [Override]
```

**OAuth 2.0:**

```
AUTH — OAuth 2.0
────────────────────────────────────────────────────────────────
Grant Type:     [Authorization Code v]
Auth URL:       [{{host}}/oauth/authorize              ]
Token URL:      [{{host}}/oauth/token                  ]
Client ID:      [{{oauth_client_id}}                   ]
Client Secret:  [{{oauth_client_secret}}               ]  [show]
Scope:          [openid profile email                  ]
Redirect URI:   [http://localhost:3000/callback         ]

[x] Enable PKCE (S256)
[x] Auto-refresh token

Token: valid (expires in 47min)   [Refresh] [Clear]
  — or —
Token: expired                    [Get New Token]
  — or —
Token: none                       [Get Token]

Inherited from: [root]  [Override]
────────────────────────────────────────────────────────────────
```

**OpenID Connect:**

```
AUTH — OpenID Connect
────────────────────────────────────────────────────────────────
Discovery URL:  [https://accounts.google.com/.well-known/openid-configuration]
                [Fetch Configuration]

Discovered endpoints:
  Authorization:  https://accounts.google.com/o/oauth2/v2/auth       ok
  Token:          https://oauth2.googleapis.com/token                 ok
  UserInfo:       https://openidconnect.googleapis.com/v1/userinfo    ok
  JWKS:           https://www.googleapis.com/oauth2/v3/certs          ok

Client ID:      [{{oidc_client_id}}                    ]
Client Secret:  [{{oidc_client_secret}}                ]  [show]
Scope:          [openid profile email                  ]
[x] Enable PKCE (S256)

Access Token:   valid (expires in 3542s)   [Refresh]
ID Token:       valid                      [Decode]
────────────────────────────────────────────────────────────────
```

**Hawk:**

```
AUTH — Hawk
────────────────────────────────────────────────────────────────
Auth ID:        [{{hawk_id}}                           ]
Auth Key:       [{{hawk_key}}                          ]  [show]
Algorithm:      [SHA-256 v]
[ ] Include payload hash

Advanced (optional):
  Ext:          [                                      ]
  App ID:       [                                      ]
  Delegated By: [                                      ]
  Nonce:        [auto-generated                        ]
  Timestamp:    [auto-generated                        ]

Preview:
  Authorization: Hawk id="dh37fgj492je", ts="1697000000",
    nonce="j4h3g2", mac="6R4rV5iE+NPoym..."
────────────────────────────────────────────────────────────────
```

**JWT:**

```
AUTH — JWT
────────────────────────────────────────────────────────────────
Algorithm:      [RS256 v]
Secret / Key:   [{{jwt_private_key}}                   ]  [show]
Header prefix:  [Bearer                                ]
Add to:         [Header v]

Payload (JSON):
  {
    "sub": "{{user_id}}",
    "iss": "my-api-client",
    "iat": {{$timestamp}},
    "exp": {{$timestamp + 3600}},
    "scope": "admin"
  }
  Supports env vars {{var}} and dynamic values {{$timestamp}}

Preview:
  Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
  [Decode header] [Decode payload]
────────────────────────────────────────────────────────────────
```

### Auth execution flow (at send time)

```
1. Resolve authType from folder chain (walk up until non-"inherit")
2. Resolve env vars in authConfig ({{token}}, {{client_id}}, etc.)
3. Execute auth-specific logic:

   bearer  → Set header: Authorization: Bearer <token>
   basic   → Set header: Authorization: Basic <base64(user:pass)>
   apikey  → Set header/query/cookie depending on addTo
   jwt     → Sign JWT with payload + secret → Set header/query
   oauth2  → Check cached token:
             → valid? use it
             → expired + refresh_token + autoRefresh? refresh it
             → no token? start grant flow (browser popup for auth_code/implicit)
             → Set header/query with access_token
   openid  → Same as oauth2 but:
             → First: fetch discovery URL if endpoints not cached
             → Includes id_token handling
             → Set header/query with access_token
   hawk    → Compute MAC from request method, URL, timestamp, nonce, ext
             → If includePayloadHash: hash body with content-type
             → Set header: Authorization: Hawk id="...", ts="...", nonce="...", mac="..."
   none    → Do nothing

4. Pass modified request to pre-request scripts (scripts can further modify headers)
```

### OAuth2 / OpenID token management

Tokens are cached in `authConfig` and persisted to the database. The backend handles:

- **Token refresh:** When `autoRefresh: true` and token is expired, backend sends refresh_token to tokenEndpoint before executing the request
- **Authorization code flow:** Backend returns a redirect URL → frontend opens popup/tab → user consents → callback receives code → backend exchanges code for tokens
- **PKCE:** Backend generates code_verifier + code_challenge for public client flows
- **Token display in UI:** Show expiry countdown, decode button for JWTs (shows header + payload), clear button to force re-auth
- **Secrets stored encrypted:** client_secret, auth_key, jwt_secret stored encrypted at rest (same as secret env vars)

### Dependencies for auth

```
jsonwebtoken     — JWT signing (HS*, RS*, ES* algorithms)
hawk             — Hawk header computation
openid-client    — OpenID Connect discovery + token management (optional, can implement manually)
```

## Core feature: parameter traceability (Resolved View)

When viewing a request, a "Resolved" tab shows the final merged state with the source of each value. Simple text tags like `[root]`, `[Users]`, `[request]`, `[local]` indicate where each value comes from.

### Headers — resolved view

Each row shows: key, final value, source tag, and if overridden, what it replaced.

```
HEADERS (5 resolved)
────────────────────────────────────────────────────────────────────
Key              Value                  Source         Overrides
────────────────────────────────────────────────────────────────────
X-Api-Version    2                      [root]
Accept           application/json       [request]      text/plain [Users] < application/json [root]
Content-Type     multipart/form-data    [Admin]        application/json [root]
X-Team           platform               [Users]
X-Admin          true                   [Admin]
X-Confirm        true                   [request]
────────────────────────────────────────────────────────────────────
```

- `Source` = the level that set the final value
- `Overrides` = previous values that got replaced, rightmost is the original
- No override column if no conflict on that key

### Query params — resolved view

Same layout as headers.

```
QUERY PARAMS (4 resolved)
────────────────────────────────────────────────────────────────────
Key              Value                  Source         Overrides
────────────────────────────────────────────────────────────────────
format           xml                    [request]      json [root]
verbose          true                   [Users]
soft             true                   [request]
────────────────────────────────────────────────────────────────────
```

### URL — resolved view

Show final URL, then the breakdown per level.

```
URL
────────────────────────────────────────────────────────────────────
Final: http://localhost:3000/api/v2/admin/users/42

Segments:
  {{host}}             [root]    → http://localhost:3000  [local override]
  /api/v2              [Users]
  /admin               [Admin]
  /users/{{user_id}}   [request] → /users/42             [env: team]
────────────────────────────────────────────────────────────────────
```

### Auth — resolved view

```
AUTH
────────────────────────────────────────────────────────────────────
Type:    bearer
Token:   {{token}} → eyJhbG...  [local override]
Source:  [root]
Chain:   request (inherit) > Admin (inherit) > Users (inherit) > root (bearer)
────────────────────────────────────────────────────────────────────
```

### Environment variables

```
ENVIRONMENT: dev
────────────────────────────────────────────────────────────────────
Key          Team Value              Your Value             Status
────────────────────────────────────────────────────────────────────
host         https://api.prod.com    http://localhost:3000  [overridden]
token        —                       ********               [overridden]
user_id      42                      —                      [team]
api_key      ********                —                      [team]
username     admin                   alice                  [overridden]
password     ********                ********               [overridden]
debug        false                   —                      [team]
────────────────────────────────────────────────────────────────────
[team] = using team default    [overridden] = local value active
[missing] = not set anywhere

Actions: per-row "reset" on overridden vars, bulk "reset all overrides"
Secrets: masked by default, toggle "show secrets" to reveal
────────────────────────────────────────────────────────────────────
```

### Scripts — execution order

```
SCRIPTS
────────────────────────────────────────────────────────────────────
Pre-request (top-down):
  1. [root]      Sets Authorization header
  2. [Users]     Logs request URL
  3. [request]   Adds X-Confirm timestamp

--- HTTP REQUEST ---

Post-response (bottom-up):
  1. [request]   Checks status === 200
  2. [Users]     Saves pagination cursor
  3. [root]      Logs response time
────────────────────────────────────────────────────────────────────
```

### Folder settings — edit view

When clicking a folder to edit its settings, show only what THIS folder defines. Inherited values shown separately below, grayed out.

```
FOLDER: Admin
────────────────────────────────────────────────────────────────────
Tabs: Headers | Params | Auth | Base URL | Scripts

HEADERS (this folder)
Key              Value                  Enabled
X-Admin          true                   [x]
Content-Type     multipart/form-data    [x]

INHERITED (read-only, from parents)
Key              Value                  Defined in
X-Api-Version    2                      [root]
Accept           text/plain             [Users]       * overridden by request
X-Team           platform               [Users]
────────────────────────────────────────────────────────────────────
```

### Design principles for the UI

- No icons or emojis — use plain text tags: `[root]`, `[Users]`, `[Admin]`, `[request]`, `[local]`, `[team]`
- Tags are small inline labels with subtle background color to distinguish levels
- Override chain reads left to right: final value first, then what it replaced
- Inherited rows clearly separated and visually dimmed (lower opacity or lighter text)
- Tables are dense — no wasted space, every column has a purpose
- "Overrides" column only appears when at least one row has an override

### API: resolved view endpoint

```
GET /api/requests/:id/resolved?environmentId=xxx
```

Returns the fully computed state:

```json
{
  "url": {
    "final": "http://localhost:3000/api/v2/admin/users/42",
    "segments": [
      { "raw": "{{host}}", "resolved": "http://localhost:3000", "source": "folder", "folderName": "root", "envSource": "local_override" },
      { "raw": "/api/v2", "resolved": "/api/v2", "source": "folder", "folderName": "Users" },
      { "raw": "/admin", "resolved": "/admin", "source": "folder", "folderName": "Admin" },
      { "raw": "/users/{{user_id}}", "resolved": "/users/42", "source": "request", "envSource": "team" }
    ]
  },
  "auth": {
    "type": "bearer",
    "config": { "token": "{{token}}", "resolvedToken": "eyJhbG..." },
    "source": { "type": "folder", "folderName": "root" },
    "inheritChain": ["request:inherit", "Admin:inherit", "Users:inherit", "root:bearer"]
  },
  "headers": [
    { "key": "X-Api-Version", "value": "2", "source": "root", "overrides": [] },
    { "key": "Accept", "value": "application/json", "source": "request", "overrides": [
      { "value": "text/plain", "source": "Users" },
      { "value": "application/json", "source": "root" }
    ]}
  ],
  "queryParams": [],
  "scripts": {
    "pre": [
      { "source": "root", "description": "Sets Authorization header" },
      { "source": "Users", "description": "Logs request URL" },
      { "source": "request", "description": "Adds X-Confirm timestamp" }
    ],
    "post": [
      { "source": "request", "description": "Checks status === 200" },
      { "source": "Users", "description": "Saves pagination cursor" },
      { "source": "root", "description": "Logs response time" }
    ]
  }
}
```

model Environment {
  id          String    @id @default(cuid())
  name        String    // "dev", "staging", "prod"
  description String    @default("")  // documents what this environment targets, usage notes
  isActive    Boolean   @default(false)
  variables   EnvironmentVariable[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model EnvironmentVariable {
  id            String      @id @default(cuid())
  key           String
  value         String      @default("")
  description   String      @default("")  // documents what this variable is for, expected format
  type          String      @default("string") // string | secret | dynamic
  scope         String      @default("global") // global | collection | request | local
  isSecret      Boolean     @default(false)
  environmentId String
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  @@unique([environmentId, key, scope])
}

model LocalOverride {
  id            String  @id @default(cuid())
  key           String
  value         String
  description   String  @default("")  // user's personal note for this override
  environmentId String
  userId        String  @default("local") // for future multi-user
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([environmentId, key, userId])
}

model HistoryEntry {
  id            String   @id @default(cuid())
  method        String
  url           String
  requestHeaders  Json
  requestBody     String?
  responseStatus  Int
  responseHeaders Json
  responseBody    String?
  responseTime    Int      // ms
  responseSize    Int      // bytes
  createdAt       DateTime @default(now())
}
```

## Core feature: layered environments

Variable resolution order (highest priority wins):

1. **Local override** — per-user, never synced, for personal credentials
2. **Request-level** — scoped to a single request
3. **Collection-level** — scoped to a collection/folder
4. **Global / Team** — shared baseline (base URLs, API versions, shared keys)

When the app resolves `{{api_key}}` it walks layers top-to-bottom. First match wins. Undefined → show warning in UI.

### Environment variable editor UI

```
ENVIRONMENT: dev
Tabs: Docs | Variables

VARIABLES
────────────────────────────────────────────────────────────────
Key          Team Value              Your Value             Status
────────────────────────────────────────────────────────────────
base_url     http://localhost:3000   —                      [team]
username     admin                   alice                  [overridden]  [reset]
password     ********                ********               [overridden]  [reset]
api_ver      v2                      —                      [team]
token        —                       —                      [missing]
────────────────────────────────────────────────────────────────
Filter: [All v] [Show overridden only]            [Reset all overrides]
────────────────────────────────────────────────────────────────
[team] = using team default
[overridden] = local value active — [reset] removes local override
[missing] = not set anywhere
Secrets masked by default, "show secrets" toggle to reveal
```

### Reset to factory

- Per-variable: click "reset" on that row (deletes local override, reverts to team value)
- Bulk: "Reset all overrides" button → confirmation dialog listing what will change
- Reset only removes the LocalOverride row, never touches the global value

## Core feature: pre-request & post-response script hooks

User scripts run in a sandboxed V8 isolate (isolated-vm). The server exposes these APIs to scripts:

```js
// === Available in both pre-request and post-response ===
env.get("token")                    // read variable (respects layer priority)
env.set("token", "abc123")          // write to local override layer
env.delete("old_key")               // remove local override
console.log("debug")                // output to script console panel

// === Pre-request only ===
request.url                         // string, mutable
request.method                      // string, mutable
request.headers.get("Authorization")
request.headers.set("Authorization", "Bearer " + env.get("token"))
request.headers.delete("X-Old")
request.body.text()                 // raw body string
request.body.json()                 // parsed JSON
request.body.set("raw string")      // replace body
request.body.setJSON({key: "val"})  // replace body as JSON
request.skip()                      // cancel this request

// === Post-response only ===
response.status                     // number
response.statusText                 // string
response.headers                    // read-only Map
response.body.text()                // raw string
response.body.json()                // parsed JSON
response.time                       // ms
response.size                       // bytes

// Assertions
test("Status is 200", () => response.status === 200)
test("Has token", () => response.body.json().token !== undefined)
```

### Script execution order

```
root folder pre-script
  └→ subfolder pre-script
       └→ sub-subfolder pre-script
            └→ request pre-script
                 └→ HTTP REQUEST
            ┌→ request post-script
       ┌→ sub-subfolder post-script
  ┌→ subfolder post-script
root folder post-script
```

Pre-scripts run top-down (root → request). Post-scripts run bottom-up (request → root). All levels in the chain execute — they stack, not override.

## API routes (backend)

```
# Folders (collections are just root-level folders)
GET    /api/folders                        — returns full tree
POST   /api/folders                        — create folder (parentId in body, null = root)
PUT    /api/folders/:id                    — rename, update settings
DELETE /api/folders/:id                    — cascade deletes children + requests
PATCH  /api/folders/:id/reorder            — move within parent or reparent
GET    /api/folders/:id/resolved-settings  — returns merged inherited settings for preview

# Requests
GET    /api/requests/:id
POST   /api/requests
PUT    /api/requests/:id
DELETE /api/requests/:id

# Execute request (the core action)
POST   /api/requests/:id/send     — walks folder chain, merges settings, runs scripts, sends HTTP, saves to history

# Execute raw (no saved request needed)
POST   /api/send                  — same as above but from ad-hoc request body

# Environments
GET    /api/environments
POST   /api/environments
PUT    /api/environments/:id
DELETE /api/environments/:id
PUT    /api/environments/:id/activate

# Variables
GET    /api/environments/:id/variables           — returns merged view (team + local)
PUT    /api/environments/:id/variables/:key       — set team value
PUT    /api/environments/:id/overrides/:key       — set local override
DELETE /api/environments/:id/overrides/:key       — reset single var to factory
DELETE /api/environments/:id/overrides            — reset ALL overrides (factory reset)

# History
GET    /api/history
GET    /api/history/:id
DELETE /api/history
DELETE /api/history/:id

# Import/Export
POST   /api/import/postman        — Postman Collection v2.1 JSON → folder tree
POST   /api/import/hoppscotch     — Hoppscotch JSON → folder tree
POST   /api/import/curl           — cURL command string → single request
POST   /api/import/openapi        — OpenAPI 3.x spec (JSON or YAML) → folder tree grouped by tags/paths
GET    /api/export/folder/:id     — native JSON format (see spec below)
GET    /api/export/openapi/:id    — exports folder as OpenAPI 3.x spec (JSON)
GET    /api/export/curl/:id       — exports single request as cURL command
```

## Native export format (JSON, OpenAPI 3.x compliant)

The app's native export format is a **valid OpenAPI 3.x document** with custom extensions (`x-*` fields) to preserve app-specific features (scripts, inheritance, environments). This means exports are readable by any OpenAPI tool AND fully re-importable without data loss.

### Export schema

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "My API Collection",
    "description": "Folder description (markdown)",
    "version": "1.0.0",
    "x-exported-at": "2026-02-03T12:00:00Z",
    "x-app-version": "0.1.0"
  },
  "servers": [
    {
      "url": "{{base_url}}",
      "description": "Base URL from environment variable"
    }
  ],

  "paths": {
    "/api/users": {
      "summary": "Users folder",
      "description": "Folder description (markdown)",
      "x-folder-settings": {
        "headers": [
          { "key": "X-Api-Version", "value": "2", "description": "API version targeting", "enabled": true }
        ],
        "queryParams": [],
        "auth": { "type": "bearer", "config": { "token": "{{token}}" } },
        "baseUrl": "/api/v2",
        "preScript": "request.headers.set('X-Timestamp', Date.now())",
        "postScript": null,
        "timeout": 30000,
        "verifySsl": "true"
      },
      "get": {
        "operationId": "listUsers",
        "summary": "List all users",
        "description": "Returns paginated list of users. Supports cursor-based pagination via `after` param.",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "description": "Page number for pagination",
            "schema": { "type": "integer", "default": 1 }
          },
          {
            "name": "Authorization",
            "in": "header",
            "description": "JWT from /auth/login post-script",
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": { "description": "Success" }
        },
        "x-request-settings": {
          "auth": { "type": "inherit" },
          "preScript": null,
          "postScript": "env.set('user_count', response.body.json().total)",
          "timeout": null,
          "verifySsl": "inherit"
        }
      },
      "post": {
        "operationId": "createUser",
        "summary": "Create a user",
        "description": "Creates a new user. Requires admin role.",
        "requestBody": {
          "description": "User object with required name and email fields",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name":  { "type": "string" },
                  "email": { "type": "string" }
                }
              },
              "example": { "name": "Alice", "email": "alice@example.com" }
            }
          }
        },
        "responses": {
          "201": { "description": "Created" }
        },
        "x-request-settings": {
          "auth": { "type": "inherit" },
          "preScript": null,
          "postScript": "test('Created', () => response.status === 201)"
        }
      }
    }
  },

  "x-environments": [
    {
      "name": "dev",
      "description": "Local development environment",
      "variables": [
        { "key": "base_url",  "value": "http://localhost:3000", "description": "Local API server", "type": "string", "secret": false },
        { "key": "token",     "value": "",                       "description": "Set by /auth/login post-script", "type": "secret", "secret": true }
      ]
    },
    {
      "name": "prod",
      "description": "Production environment — use with caution",
      "variables": [
        { "key": "base_url",  "value": "https://api.example.com", "description": "Production API", "type": "string", "secret": false },
        { "key": "token",     "value": "",                          "description": "Set by /auth/login post-script", "type": "secret", "secret": true }
      ]
    }
  ],

  "x-folder-tree": [
    {
      "name": "Auth",
      "description": "Authentication endpoints — login, refresh, logout",
      "settings": { "baseUrl": "/auth", "headers": [], "queryParams": [], "auth": { "type": "none" }, "preScript": null, "postScript": null },
      "children": [],
      "requests": ["loginUser", "refreshToken"]
    },
    {
      "name": "Users",
      "description": "User management CRUD",
      "settings": { "baseUrl": "/api/v2", "headers": [{ "key": "X-Api-Version", "value": "2", "description": "API version", "enabled": true }], "queryParams": [], "auth": { "type": "bearer", "config": { "token": "{{token}}" } } },
      "children": [
        {
          "name": "Admin",
          "description": "Admin-only user operations",
          "settings": { "headers": [{ "key": "X-Admin", "value": "true", "description": "Admin flag", "enabled": true }] },
          "children": [],
          "requests": ["deleteUser", "updateRole"]
        }
      ],
      "requests": ["listUsers", "createUser", "getUser"]
    }
  ]
}
```

### Import/export mapping rules

| Source format | → App mapping |
|---|---|
| **OpenAPI 3.x** `info.description` | → Folder description |
| **OpenAPI 3.x** `operation.summary` | → Request name |
| **OpenAPI 3.x** `operation.description` | → Request description |
| **OpenAPI 3.x** `parameter.description` | → Header/param description |
| **OpenAPI 3.x** `requestBody.description` | → Body description |
| **OpenAPI 3.x** tags | → Folders (one folder per tag) |
| **OpenAPI 3.x** `x-*` extensions | → App-specific settings (scripts, auth, network) |
| **Postman** `request.description` | → Request description |
| **Postman** `item[].description` | → Folder description |
| **Postman** `event[].script` | → Pre/post scripts |
| **Postman** `variable[].description` | → Variable description |
| **Hoppscotch** — no description fields | → descriptions left empty |
| **cURL** | → single request, no descriptions |

On **re-import** of native format: the `x-folder-tree` restores the exact folder hierarchy, `x-environments` restores environments, and `x-request-settings` restores scripts/auth/network settings. Standard OpenAPI fields are also parsed so any OpenAPI 3.x file imports cleanly even without the `x-*` extensions.

## Networking & HTTP engine

The backend is the HTTP proxy — the browser never calls target APIs directly. All requests go: **Browser → Fastify backend → target API**. This is critical because:
- Avoids CORS issues entirely (backend-to-backend has no CORS)
- Backend can reach localhost, Docker containers, private networks
- Scripts run server-side with full access to response

### HTTP client (undici)

Use `undici` (Node.js built-in) as the HTTP client in the backend. It supports:
- HTTP/1.1 and HTTP/2
- Custom DNS resolution
- Connection pooling
- Streaming responses
- Client certificates (mTLS)

```ts
// apps/server/src/services/http-engine.ts
import { request as undiciRequest } from 'undici'

async function executeRequest(resolved: ResolvedRequest): Promise<HttpResponse> {
  const { method, url, headers, body, timeout, followRedirects, verifySsl } = resolved

  const response = await undiciRequest(url, {
    method,
    headers,
    body,
    maxRedirections: followRedirects ? 10 : 0,
    headersTimeout: timeout,
    bodyTimeout: timeout,
    connect: {
      rejectUnauthorized: verifySsl,  // false = ignore self-signed certs
    },
  })

  return {
    status: response.statusCode,
    statusText: '',
    headers: Object.fromEntries(
      Object.entries(response.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? ''])
    ),
    body: await response.body.text(),
    time: elapsed,
    size: /* from content-length or body length */,
  }
}
```

### Reaching local & Docker targets

Since the backend runs directly on the Debian host (not in Docker), it can natively reach:

| Target | URL example | Works because |
|--------|------------|---------------|
| Host localhost | `http://localhost:8080` | Same machine |
| Docker container (published port) | `http://localhost:3306` | Port mapped to host via `-p` |
| Docker bridge IP | `http://172.17.0.3:8080` | Host can reach docker0 bridge |
| Docker custom network | `http://172.18.0.5:8080` | Host can reach custom bridge subnets |
| Docker container by name | `http://my-api-container:8080` | Needs DNS resolution (see below) |
| Remote server | `https://api.example.com` | Standard outbound HTTP |

### Docker container name resolution

Docker container names (e.g. `http://my-api:3000`) don't resolve from the host by default. Two approaches:

**Option A — Use IPs or published ports (recommended, zero config):**
Users set env vars like `{{base_url}} = http://localhost:8080` where 8080 is the published port. This always works.

**Option B — Docker DNS helper (optional, Phase 2):**
Add a settings page where users can enable Docker integration. The backend queries the Docker socket to build a container-name → IP lookup:

```ts
// apps/server/src/services/docker-dns.ts
import Dockerode from 'dockerode'

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' })

async function resolveDockerHost(hostname: string): Promise<string | null> {
  const containers = await docker.listContainers()
  for (const container of containers) {
    const names = container.Names.map(n => n.replace(/^\//, ''))
    if (names.includes(hostname)) {
      // Get IP from the first network
      const networks = container.NetworkSettings?.Networks ?? {}
      const firstNet = Object.values(networks)[0]
      return firstNet?.IPAddress ?? null
    }
  }
  return null
}
```

Then in the HTTP engine, before sending: if the URL hostname doesn't resolve via normal DNS, try `resolveDockerHost()` and rewrite the URL.

### Request settings (per-request overrides)

Each request (and folder) can configure:

```prisma
// Add to Folder and Request models:
  timeout         Int       @default(30000)  // ms, 0 = no timeout
  followRedirects Boolean   @default(true)
  verifySsl       Boolean   @default(true)   // false = accept self-signed certs
  proxy           String?                    // http://proxy:8080, overrides global
```

These inherit through the folder chain (same merge logic: `"inherit"` walks up).

### Global proxy & SSL settings

In the app settings (stored in a `Settings` table or JSON file):

```json
{
  "proxy": {
    "enabled": false,
    "http": "",
    "https": "",
    "noProxy": "localhost,127.0.0.1,172.17.0.0/16,172.18.0.0/16,10.0.0.0/8"
  },
  "ssl": {
    "verifyCertificates": true,
    "clientCert": null,
    "clientKey": null,
    "caCert": null
  },
  "docker": {
    "enabled": false,
    "socketPath": "/var/run/docker.sock"
  },
  "timeout": 30000
}
```

`noProxy` defaults include Docker bridge subnets so local container traffic never goes through a corporate proxy.

### Settings UI

```
SETTINGS
Tabs: General | Proxy | SSL | Docker | Data
────────────────────────────────────────────────────────────────
Proxy
  [ ] Enable proxy
  HTTP:     [                                       ]
  HTTPS:    [                                       ]
  No proxy: [localhost,127.0.0.1,172.17.0.0/16,...  ]

SSL
  [x] Verify SSL certificates (disable for self-signed)
  Client cert: [Browse...]
  Client key:  [Browse...]
  CA bundle:   [Browse...]

Docker integration
  [ ] Enable Docker container name resolution
  Socket: [/var/run/docker.sock]
  [Test connection]

Default timeout: [30000] ms
────────────────────────────────────────────────────────────────
```


## Deployment (Debian, no Docker)

Install and run directly on Debian 12+:

```bash
# Prerequisites
sudo apt update && sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
npm install -g pnpm

# Clone and install
git clone <repo> && cd api-client
pnpm install

# Setup DB
cd apps/server
cp .env.example .env          # DATABASE_URL="file:./data/api-client.db"
pnpm prisma migrate deploy
cd ../..

# Build and run
pnpm build
pnpm start                    # serves frontend + backend on port 3000
```

For production, use a systemd unit:

```ini
# /etc/systemd/system/api-client.service
[Unit]
Description=API Client
After=network.target

[Service]
Type=simple
User=apiclient
WorkingDirectory=/opt/api-client
ExecStart=/usr/bin/node apps/server/dist/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=file:/opt/api-client/data/api-client.db

[Install]
WantedBy=multi-user.target
```

## UI layout (React)

```
┌──────────────────────────────────────────────────────────────────┐
│  [App Name]   [Env: dev v]   [Search]                [Settings]  │
├────────────┬─────────────────────────────────────────────────────┤
│            │  [GET v] [{{base_url}}/api/users        ] [Send]    │
│  FOLDERS   │─────────────────────────────────────────────────────│
│            │  Params | Headers | Auth | Body | Scripts | Resolved│
│ v My API   │─────────────────────────────────────────────────────│
│  v Auth    │  Key           │ Value              │ Source        │
│    POST login│ X-Api-Version│ 2                  │ [root]        │
│    POST refresh│ Accept     │ application/json   │ [request]     │
│  v Users   │  X-Team        │ platform           │ [Users]       │
│    GET list│                                                     │
│    GET by id│─────────────────────────────────────────────────────│
│    POST create│ Response  200 OK  150ms  2.3KB                   │
│  v Billing │  Body | Headers | Cookies | Tests | Console         │
│   v Invoices│────────────────────────────────────────────────────│
│     GET list│  {                                                 │
│     GET by id│   "users": [...]                                  │
│            │  }                                                   │
│ HISTORY    │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

- Left sidebar: folder tree + history. Click folder name to edit its settings. Click request to open it.
- Right top: request builder with tabs (Params, Headers, Auth, Body, Scripts, Resolved)
- Right bottom: response viewer
- "Resolved" tab = the traceability view (see parameter traceability section)

## Implementation phases

### Phase 1 — MVP (build this first)
1. Monorepo scaffold (pnpm + turbo + vite + fastify)
2. Prisma schema + migrations (Folder, Request, Environment, LocalOverride, History)
3. Folder tree CRUD (sidebar with nested folders, drag & drop, context menu)
4. Folder settings panel (headers, params, auth, baseUrl, scripts — per folder)
5. Request builder (method, URL, params, headers, body, auth tabs)
6. Inheritance engine — resolve merged headers/params/auth/baseUrl/scripts walking the folder chain
7. HTTP execution engine (send request from backend with resolved settings)
8. Response viewer (status, body with syntax highlighting, headers, timing)
9. Environment system with layered resolution + local overrides + reset to factory
10. Scripting engine (isolated-vm sandbox, pre/post hooks, env API, assertions)
11. Script console panel (logs, errors, test results)
12. History (auto-save, search, replay)
13. Import: Postman, Hoppscotch, cURL, OpenAPI (map to folder tree)

### Phase 2 — Power user
- Collection runner (run all requests in sequence)
- Visual request chaining + conditional branching
- WebSocket, GraphQL, gRPC support
- Code generation (cURL, Python, JS, Go, etc.)
- Tabs + workspaces
- Keyboard shortcuts + command palette

### Phase 3 — Team collaboration
- PostgreSQL backend + user auth (JWT)
- **Shared folders** (push/pull/conflict resolution)
- Shared environments (admin manages team vars, members pull + override locally)
- Environment templates for onboarding ("please set your {{username}}")
- Activity feed + audit log
- Role-based permissions (admin/member/viewer)
- Install via apt or simple install script on Debian (systemd service)

## Coding conventions

- TypeScript strict mode everywhere
- Zod for all API request/response validation (shared package)
- Zustand for frontend state
- React Query (TanStack Query) for server state
- CodeMirror 6 for all code/script editors
- Tailwind CSS — dark mode as default, light mode toggle
- All API responses follow: `{ data: T }` or `{ error: string, details?: any }`
- Test with Vitest
- Lint with Biome
