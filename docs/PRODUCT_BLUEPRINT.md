# Vantelyx CLM Product Blueprint

## Product thesis

Most CLM products become slow document repositories. Vantelyx CLM should feel like a live contract command center: every contract has an owner, current status, next action, risk score, renewal clock, obligations, approvals, and audit history.

## Core modules

### 1. AI Intake

Purpose: reduce manual intake and contract setup.

Key capabilities:

- Upload PDF/DOCX/scanned contracts
- Classify agreement type
- Extract parties, dates, value, renewal notice, termination rights, governing law, indemnity, liability, insurance, data/security language
- Generate contract record automatically
- Recommend workflow route
- Flag missing or non-standard clauses

### 2. Contract Repository

Purpose: single source of truth.

Key capabilities:

- Searchable metadata
- Version history
- Document attachments
- Tags and departments
- Counterparty linkage
- Risk and status filters
- Exportable contract register

### 3. Contract Workspace

Purpose: one-page operating view for each contract.

Key capabilities:

- AI contract brief
- Clause insights
- Risk score
- Related documents
- Approval history
- Obligations
- Renewal dates
- Next action

### 4. Workflow Studio

Purpose: approval automation.

Key capabilities:

- Approval routes by contract type, department, value, risk, clause deviation, vendor category
- SLA timers
- Escalations
- Parallel and sequential approvals
- Rejection and resubmission flow
- Audit trail

### 5. Obligation Center

Purpose: ensure promises in contracts become executable tasks.

Key capabilities:

- Obligation extraction
- Owner assignment
- Due dates
- Priority
- Status tracking
- Escalation
- Link back to source clause

### 6. Renewal Command

Purpose: avoid missed renewals and unwanted auto-renewals.

Key capabilities:

- Renewal notice calendar
- Auto-renewal detection
- Notice deadline alerts
- Renewal decision workflow
- Revenue/procurement impact visibility

### 7. Vendor / Counterparty Intelligence

Purpose: connect contract risk with relationship risk.

Key capabilities:

- Counterparty profile
- Active contracts
- Expiring contracts
- Risk level
- Insurance/compliance review
- Last review date

### 8. Risk & Compliance

Purpose: make the platform audit-ready and evaluator-friendly.

Key capabilities:

- Clause playbooks
- Deviation approvals
- RBAC
- Audit logs
- Document access controls
- Legal hold readiness
- Retention policies
- Exportable evidence

### 9. Analytics

Purpose: leadership visibility.

Key reports:

- Contract cycle time
- Workflow bottlenecks
- Contracts by status
- High-risk clauses
- Expiring contracts
- Obligations by owner
- Portfolio value exposure
- Vendor concentration

## Differentiators to beat traditional CLM tools

- Beginner-friendly command center instead of heavy legal UI
- AI next-action assistant on every contract
- Renewal risk scoring, not just calendar reminders
- Clause deviation explanation in business language
- Obligations as tasks, not hidden text
- Vendor/counterparty risk tied to contracts
- RFP coverage matrix built into the demo for procurement evaluation
- Future vendor portal for supplier document self-service
- Executive dashboard that speaks risk, value, time, and ownership

## Recommended architecture

Frontend:

- React
- TypeScript
- Tailwind CSS
- Vite
- Recharts

Backend:

- .NET 8 Web API
- MySQL 8
- EF Core + Pomelo provider in next step
- Object storage for documents
- Queue-based extraction workers

AI services:

- Document parser/OCR
- Clause extraction
- Obligation extraction
- Risk scoring
- Contract summarization
- Playbook comparison

Security:

- SSO/OIDC
- RBAC
- Tenant isolation
- Audit trail
- Encryption at rest and in transit
- Secure document storage
- Admin activity monitoring

## MVP release scope

Release 1 should include:

- Contract repository
- Contract creation/editing
- Document upload
- Workflow approvals
- Renewal alerts
- Obligations
- Audit trail
- Dashboard
- Admin roles
- Basic AI extraction preview

Release 2 should include:

- Full AI extraction
- Clause playbook
- Redline comparison
- E-signature integration
- Vendor portal
- Advanced analytics
- Bulk import

Release 3 should include:

- Procurement ERP/CRM integrations
- Microsoft 365/SharePoint integration
- Salesforce/HubSpot integration
- Public-sector compliance packs
- Advanced AI negotiation assistant
