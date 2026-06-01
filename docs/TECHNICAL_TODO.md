# Technical Implementation Backlog

## Immediate next steps

1. Replace mock frontend data with API service calls.
2. Add EF Core and MySQL persistence.
3. Create migrations from `database/init.sql`.
4. Add auth middleware and permission checks.
5. Add file upload endpoint.
6. Add document storage provider abstraction.
7. Add AI extraction queue and worker.
8. Add tests.

## API endpoints to add

- `POST /api/documents/upload`
- `POST /api/contracts/{id}/workflow/start`
- `POST /api/contracts/{id}/workflow/approve`
- `POST /api/contracts/{id}/workflow/reject`
- `POST /api/contracts/{id}/obligations`
- `PATCH /api/obligations/{id}`
- `GET /api/reports/portfolio`
- `GET /api/reports/renewals`
- `GET /api/reports/risk`
- `POST /api/playbooks/clauses`
- `POST /api/ai/contracts/{id}/extract`
- `POST /api/ai/contracts/{id}/compare-playbook`

## Production security checklist

- Enforce tenant ID on every query.
- Add row-level authorization.
- Log all sensitive actions.
- Encrypt documents.
- Add malware scanning for uploads.
- Add immutable audit logs.
- Add backup/restore.
- Add rate limiting.
- Add admin action approvals.
- Add retention/legal hold policies.
