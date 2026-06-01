# Vantelyx CLM — Sequenced Roadmap (post-award)

Effort = rough engineering estimate assuming 2 senior full-stack engineers.
"Compete bar" = the point at which the capability honestly competes with incumbents for a
single-institution higher-ed deployment (not the Fortune 500 market).

## Phase 0 — Submission & POC (NOW → next few days)

- Positioning narrative + demo script + curated seed data. (see UTAH_POSITIONING.md, POC_PLAN.md)
- Polish demoed screens; align API port; verify builds.
- **Outcome:** wins the evaluation. No new product capability required.

## Phase 1 — Production floor (4–6 weeks) ← required before any real go-live

The unglamorous 80% that makes CLM trustworthy. Without this, you fail procurement security review.

1. **SSO/SAML or OIDC** federation (Shibboleth / Entra ID / Okta) — replace dev-login JWT. *(~1.5 wk)*
2. **Multi-tenant isolation + row-level contract visibility** enforced server-side. *(~1 wk)*
3. **Real persistence at scale** — EF migrations (reconcile date types to init.sql), per-entity
   writes (replace whole-aggregate rewrite), concurrency control, backup/restore. *(~1.5 wk)*
4. **Immutable audit log** + retention/legal-hold policies. *(~1 wk)*
5. **Encryption at rest/in transit**, secrets management, basic rate limiting. *(~0.5 wk)*

**Compete bar reached:** can pass a public-sector security questionnaire and run real users.

## Phase 2 — The actual contract engine (6–10 weeks) ← the real product

5. **Document pipeline** — upload → object storage (Azure Blob/S3/MinIO) → OCR/parse → **clause
   & obligation extraction** → risk scoring. This is *the* differentiator vs. a glorified database. *(~4–5 wk)*
6. **Versioning + redline comparison** on documents. *(~2 wk)*
7. **E-signature integration** (DocuSign/Adobe abstraction). *(~1.5 wk)*
8. **Private/Tenant AI** — wire the existing Copilot hooks to Azure OpenAI / on-prem Ollama with
   RAG over the contract corpus; prompt-safety + AI audit logging. *(~2 wk)*

**Compete bar reached:** genuinely competitive in the higher-ed/public-sector niche.

## Phase 3 — Stickiness & scale (8–12 weeks)

9. **Integrations:** M365/SharePoint, and the university ERP/SIS (Banner/Workday/PeopleSoft). *(~4 wk)*
10. **Higher-ed packs:** sponsored-research/grants contract types, sub-awards, F&A terms,
    open-records/FOIA export workflows. *(~3 wk)*
11. **Advanced analytics & reporting**, bulk import/migration tooling. *(~2 wk)*
12. **SOC 2 Type II** program — *start early (long lead, 6–12 months calendar)*.

**Compete bar reached:** defensible, sticky, expandable to other institutions.

## Critical-path summary

```
Win POC (days)  →  Production floor (~5 wk)  →  Document/AI engine (~8 wk)  →  Integrations + certs (ongoing)
   words+demo        security & persistence        the real product             stickiness & scale
```

## Biggest risks to manage

- **Treating the demo as the product.** The visible 20% is done; the invisible 80% (Phase 1) is not.
- **Document extraction accuracy.** This is incumbents' moat (trained on millions of contracts).
  Set expectations; start narrow (a few contract types) and measure accuracy honestly.
- **Security certification lead time.** SOC 2 is calendar-bound — begin the day after award.
- **Scope creep into Fortune-500 parity.** Stay in the higher-ed/public-sector lane where you win.
