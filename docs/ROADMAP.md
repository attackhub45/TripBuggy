# TripBuggy — Remaining Work

**Status:** Draft v1
**Companion docs:** [BRD.md](./BRD.md) · [TRD.md](./TRD.md)

A prioritized punch-list of what's left across the build and deployment, as of 2026-09-19. Ordered by what unlocks the most value next, not by category.

---

## Tier 1 — The core product gap

- [ ] **Real agent (Anthropic API)** — Replace the hardcoded logic in `backend/app/agent_service.py` with real Claude tool calls for route drafting, catalog search, and booking decisions. Needs an `ANTHROPIC_API_KEY`. This is the single biggest gap between "demo" and "product" — everything else works, but the agent isn't actually intelligent yet.

## Tier 2 — Product completeness

- [ ] **Real login/signup** — Every browser currently gets a silent anonymous device account (see `ensureAuthenticated()` in `frontend/src/api/client.ts`). No password reset, no way to return on a different device, no visible identity.
- [ ] **Enforce crew roles** — `owner`/`editor`/`viewer` are stored on `crew_members` but nothing checks them. A viewer can currently do everything an owner can.
- [ ] **"My trips" list** — The backend already supports multiple trips per user; the frontend only ever tracks one trip in memory. No screen exists to browse past trips.
- [ ] **Refresh resilience** — The active trip ID lives only in memory (not the URL or localStorage), so refreshing mid-flow loses your place even though the trip still exists in Postgres.

## Tier 3 — Polish

- [ ] **Agent presence on Route + Booking** — The avatar/speech-bubble pattern (`AgentMessage`) only shipped on Discover & Add so far. Bring it to Plan the Route and Agentic Booking for consistency.
- [ ] **Global error/notification pattern** — Most failures currently just fail silently to the console. Only the Home screen has a hand-built inline error. Needs a real toast/banner system.

## Tier 4 — Engineering hygiene (do before or alongside Azure)

- [ ] **Automated tests** — TRD calls for Vitest + React Testing Library (frontend) and pytest (backend). Neither exists yet.
- [ ] **CI pipeline** — Nothing currently runs checks on push.
- [ ] **Observability** — No logging/metrics wired in (TRD names Azure Application Insights).

## Tier 5 — Azure deployment

Nothing provisioned yet beyond installing the Azure CLI locally. Full detail in the runbook from earlier — summarized here:

- [ ] `az login` (you) + confirm subscription
- [ ] Provision: resource group, Postgres Flexible Server, backend App Service, frontend Static Web App, Key Vault
- [ ] First deploy: push backend + frontend code, run migrations against the Azure DB, fix CORS (currently hardcoded to `localhost:5173`)
- [ ] CI/CD: GitHub Actions workflows so pushes to `main` auto-deploy both sides

---

**Explicitly out of scope for now** (per BRD, not oversights): real flight/hotel bookings against live vendor APIs, real payment processing, real document/visa verification. These are documented Phase 2 items.
