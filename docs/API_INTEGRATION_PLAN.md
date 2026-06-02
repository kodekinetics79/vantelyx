# Vantelyx CLM — API Integration Plan (Sprint 10)

This describes how the React frontend, the .NET 8 API, and MySQL fit together, and the
four run modes. The working local demo is always preserved: if the API is unset or
unreachable, the frontend falls back to its localStorage services.

## Run modes

### 1. Frontend-only mode (default demo)
No backend required. Leave `VITE_API_BASE_URL` unset (do not create `client/.env`).
All data comes from localStorage seed services.

```bash
npm install
npm run dev   # http://localhost:9701
```

### 2. API mode (frontend + .NET API, in-memory)
API runs without a database (InMemory provider). Frontend calls the API first, falls
back to localStorage on failure/timeout.

```bash
# terminal 1 — API (defaults to InMemory persistence, auth off)
dotnet run --project server/Vantelyx.Api/Vantelyx.Api.csproj
# serves http://localhost:5058 when ASPNETCORE_URLS is set (see below)

# terminal 2 — frontend in API mode
cp client/.env.example client/.env   # sets VITE_API_BASE_URL=http://localhost:5058
npm run dev
```

Set the API port explicitly:

```bash
ASPNETCORE_URLS=http://localhost:5058 dotnet run --project server/Vantelyx.Api/Vantelyx.Api.csproj
```

### 3. MySQL mode (API persists to MySQL)
Start MySQL (schema + seed auto-load), then run the API with the MySQL provider.

```bash
cp .env.example .env
docker compose up -d mysql
ASPNETCORE_URLS=http://localhost:5058 \
Persistence__Provider=MySql \
ConnectionStrings__DefaultConnection="Server=localhost;Port=3306;Database=vantelyx_clm;User=vantelyx_user;Password=vantelyx_password;" \
dotnet run --project server/Vantelyx.Api/Vantelyx.Api.csproj
```

(For zero-infra durability you can use `Persistence__Provider=Sqlite` instead.)

### 4. Full-stack local mode (everything via docker-compose)
```bash
cp .env.example .env
docker compose up --build
# MySQL :3306, API :5058 (MySQL provider), web :9701
```

## Fallback behavior
- `client/src/services/apiClient.ts` only calls the API when `VITE_API_BASE_URL` is set.
- Every request has an 8s timeout (`AbortController`); on any non-OK status, network error,
  or timeout it logs `console.warn` and returns the provided localStorage fallback.
- It never throws into the UI.
- `clmRepository.ts` calls the API first (when enabled) and falls back to the localStorage
  services for contracts, metrics, approvals, obligations, activity, and exports.
- Operational/integration collections (work items, notifications, integrations) remain
  localStorage-backed on the frontend; matching read endpoints exist on the API for future wiring.

## API endpoints
```
GET   /api/health
GET   /api/contracts
GET   /api/contracts/{id}
POST  /api/contracts
PATCH /api/contracts/{id}/status
PATCH /api/contracts/{id}/approvals/{stepId}
PATCH /api/contracts/{id}/obligations/{obligationId}
POST  /api/contracts/{id}/activity
GET   /api/dashboard/metrics
GET   /api/work-items
GET   /api/notifications
GET   /api/integrations
GET   /api/execution-packages
GET   /api/security/current-user
POST  /api/auth/dev-login            (demo token; not full auth)
```

Health response shape:
```json
{ "status": "healthy", "databaseMode": "InMemory|Sqlite|MySql", "apiVersion": "1.0.0", "timestampUtc": "..." }
```

## curl quick checks
```bash
curl -s http://localhost:5058/api/health
curl -s http://localhost:5058/api/contracts
curl -s http://localhost:5058/api/dashboard/metrics
curl -s http://localhost:5058/api/work-items
curl -s http://localhost:5058/api/integrations
```

## Auth (prep only — not implemented)
`/api/auth/dev-login` issues a demo HS256 token; `Auth:Enabled=true` enforces it on write
endpoints. Production work is deferred and marked with TODOs in the codebase:
Microsoft Entra ID / Azure AD, SAML/OIDC, SCIM provisioning, JWT validation against the
IdP JWKS, tenant isolation, row-level RBAC enforcement, and audit-grade access logs.

## CORS
The API allows the Vite dev origins: `http://localhost:9701`, `:9702`, `:9703`, and `:5173`.
