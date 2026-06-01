# Vantelyx CLM — POC Demo Plan (days-out execution)

Goal of the POC: make the evaluators *feel* the product is real, fast, and built for them.
Win on flow and polish, not on opening every half-built screen. **Demo depth over breadth.**

## Golden rule

Demo only what is solid. If a screen is thin or mock, either (a) polish it to look intentional,
or (b) don't navigate to it. A confident 6-screen story beats a shaky 15-screen tour.

## Pre-POC hardening punch list (do these, in order)

**P0 — must be true before the demo**
- [ ] Decide demo mode: **frontend-only** (localStorage, zero infra — safest) OR **full stack**
      (API + SQLite persistence + Auth on). Pick ONE and rehearse it. Frontend-only is the
      lower-risk choice unless persistence is part of the pitch.
- [ ] Seed a *curated* demo dataset that makes Copilot shine: a few high-risk contracts, upcoming
      renewals (30/60/90), overdue obligations, pending approvals, a vendor with a compliance flag,
      and at least one executed contract. (Seeding already runs on load — verify the numbers look good.)
- [ ] Click every screen you intend to show. Fix anything that overflows, errors, or shows empty.
- [ ] Login screen: confirm role-picker works and the session user shows in the sidebar.
- [ ] Copilot: rehearse the exact prompts you'll type (see script). Confirm each returns clean cards.
- [ ] `npm run build` clean; if full-stack, `dotnet build` clean and health endpoint green.
- [ ] Align the API port: `client/.env.example` says `:5058` but README/Docker use `:8088`. Fix before anyone runs it.

**P1 — strongly improves perceived quality**
- [ ] Hide or relabel any "Coming soon"/thin modules from the nav for the demo build.
- [ ] Make sure CSV exports actually download (contracts/obligations/renewals/audit).
- [ ] Add University of Utah-flavored sample data (department names, a research agreement, an NDA).
- [ ] Test on the actual screen/resolution you'll present on; check the laptop, not just your monitor.

**P2 — nice to have, only if time**
- [ ] One "research/grant contract" sample to land the higher-ed wedge live.
- [ ] A private-LLM talking point slide (no code needed) for the data-sovereignty question.

## Demo script (≈12–15 min, tight narrative)

1. **Login (15s)** — "Role-based from the first screen; production uses university SSO." Pick an exec/legal role.
2. **Command Center (2m)** — portfolio value, high-risk count, renewals, what-needs-attention.
   "Every contract has an owner, status, next action, risk, renewal clock." This is the hook.
3. **Copilot (3m) — the centerpiece.** Type live:
   - "Which contracts are high risk?"
   - "What renewals are due in 90 days?"
   - "Which obligations are overdue?"
   - "What should I work on today?"
   Call out: confidence levels, human-review reminders, clickable results. "Decision-support, not autopilot — and it runs on *your* data."
4. **Repository + NL search (2m)** — "high-risk vendor agreements expiring in 90 days." Show filters + export.
5. **Contract Workspace (3m)** — open one contract: summary, clauses, approvals, obligations, renewals, activity.
   Land "obligations as accountable tasks" and "clause deviation in business language."
6. **Governance close (2m)** — RBAC roles, audit trail, RFP coverage matrix. "Audit-ready and built for public-sector accountability."
7. **The pitch (1m)** — fit + speed + AI governance. Hand to the positioning narrative.

## Questions you WILL get — and the honest answers

- **"Where does the data live / is our data sent to OpenAI?"** → "Today it runs on your data with
  no external AI calls. Roadmap supports Azure OpenAI and on-prem models so contracts never leave
  your tenant." (True — the AI is local/rule-based now with clean integration hooks.)
- **"Does it do real document upload and clause extraction?"** → "The pipeline is architected;
  ingestion/OCR at scale is the first roadmap item post-award. Today we demo the operations and
  decision-support layer." Don't fake it live.
- **"SSO? SOC2? Tenant isolation?"** → "Architected for SAML/OIDC, multi-tenant isolation, and
  immutable audit; hardening is sequenced ahead of production go-live." Don't overclaim certs.
- **"E-signature?"** → "DocuSign/Adobe integration is a planned connector; the execution flow is modeled today."

## Hard "do not" list for the demo

- Don't open thin/mock screens you haven't rehearsed.
- Don't claim SOC2, live OCR, or native integrations exist today.
- Don't run an unrehearsed full-stack setup live — if using the API, have it already running and verified.
- Don't let Copilot take an unrehearsed free-text question that might hit the "not enough data" fallback in front of evaluators.
