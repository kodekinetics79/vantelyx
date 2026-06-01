# Vantelyx CLM Suite

A VS Code-ready Contract Lifecycle Management / Contract Operations application starter with a polished React frontend, .NET 8 API, MySQL schema, Docker support, and RFP coverage documentation.

## What is included

- Modern React + TypeScript + Vite frontend
- Tailwind-based enterprise UI
- CLM modules:
  - Command Center dashboard
  - AI Intake
  - Contract Repository
  - Contract Workspace
  - Workflow Studio
  - Obligation Center
  - Renewal Command
  - Vendor / Counterparty Intelligence
  - Risk & Compliance
  - Analytics
  - Admin & Security
  - RFP Coverage Matrix
- .NET 8 Minimal API with sample endpoints
- MySQL-ready database schema
- Docker Compose for web + API + MySQL
- Product blueprint and implementation notes

## Fast frontend run

```bash
cd vantelyx-clm-suite
npm install
npm run dev
```

Open:

```text
http://localhost:9701
```

## Run API only

```bash
cd vantelyx-clm-suite
dotnet run --project server/Vantelyx.Api/Vantelyx.Api.csproj
```

API health:

```bash
curl http://localhost:8088/api/health
```

Contracts endpoint:

```bash
curl http://localhost:8088/api/contracts
```

## Run MySQL only

```bash
cd vantelyx-clm-suite
cp .env.example .env
docker compose up -d mysql
```

MySQL seed scripts are auto-loaded from:
- `database/init.sql`
- `database/seed.sql`

## Run full stack

```bash
cd vantelyx-clm-suite
cp .env.example .env
docker compose up -d
```

Open:

```text
Frontend: http://localhost:9701
API:      http://localhost:8088
MySQL:    localhost:3306
```

## Persistence & Auth (spike)

The API defaults to in-memory with auth off (open demo). Two opt-in capabilities exist:

**Durable persistence** — contracts survive restart. Selected via `Persistence:Provider`:

```bash
# SQLite (no infra, great for the POC laptop demo)
Persistence__Provider=Sqlite dotnet run --project server/Vantelyx.Api/Vantelyx.Api.csproj

# MySQL (production path; uses ConnectionStrings:DefaultConnection)
Persistence__Provider=MySql dotnet run --project server/Vantelyx.Api/Vantelyx.Api.csproj
```

Contracts are stored as a JSON payload keyed by id+tenant (vertical slice). The full
relational mapping to `database/init.sql` is the next step.

**JWT auth** — set `Auth__Enabled=true` to require a bearer token on all write endpoints
(reads stay open). Get a dev token, then call:

```bash
curl -s -X POST localhost:8088/api/auth/dev-login -H 'Content-Type: application/json' -d '{"userId":"usr_admin"}'
# → { "data": { "token": "<jwt>", "user": {...} } }
curl -H "Authorization: Bearer <jwt>" ...
```

`/api/security/current-user` resolves the principal from the token's `sub` claim. The
dev-login endpoint is a placeholder for OIDC/SAML federation against the university IdP.

## Recommended next development sequence

1. Connect React frontend to the .NET API instead of mock data.
2. Add EF Core + Pomelo MySQL provider and map the schema in `database/init.sql`.
3. Add authentication: SSO/OIDC first, local dev login second.
4. Add document storage: Azure Blob, S3, or local MinIO for dev.
5. Add AI document extraction pipeline: upload → OCR/parser → clause extraction → obligation extraction → risk scoring.
6. Add e-signature integrations: DocuSign/Adobe Sign-ready abstraction.
7. Add tenant-aware RBAC and audit enforcement before production.

## Product positioning

Vantelyx CLM is positioned as more than document storage. It is a contract execution intelligence platform focused on:

- Faster contract intake
- Safer approvals
- Clause deviation control
- Obligations accountability
- Renewal revenue protection
- Audit-ready evidence
- Executive visibility
- AI-assisted legal and business review

## Notes

This is a strong application foundation and demo-ready frontend. It is not yet production-certified legal software. Before production, complete authentication, persistence, document security, encryption, tenant isolation, audit immutability, backup/recovery, and legal/compliance validation.
