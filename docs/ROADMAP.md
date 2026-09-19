# TripBuggy — Remaining Work

**Status:** Draft v1
**Companion docs:** [BRD.md](./BRD.md) · [TRD.md](./TRD.md)

A prioritized punch-list of what's left across the build and deployment, as of 2026-09-19. Ordered by what unlocks the most value next, not by category.

---

## Tier 1 — The core product gap

- [ ] **Real agent (Anthropic API)** — Replace the hardcoded logic in `backend/app/agent_service.py` with real Claude tool calls for route drafting, catalog search, and booking decisions. Needs an `ANTHROPIC_API_KEY`. This is the single biggest gap between "demo" and "product" — everything else works, but the agent isn't actually intelligent yet.

## Tier 2 — Product completeness ✅ done (2026-09-19)

- [x] **Real login/signup** — `LoginScreen`/`SignupScreen` + `authStore`. Signing in swaps the session from the silent device account to a real one.
- [x] **Enforce crew roles** — `require_viewer`/`require_editor`/`require_owner` in `deps.py` resolve role by email match (owner or `crew_members`), no schema change needed. Verified: an editor can edit a trip they don't own; a viewer's write attempt gets a real 403.
- [x] **"My trips" list** — `TripsListScreen` + `GET /api/v1/trips`, showing owned + crew trips with a role badge, opening straight to the right screen for that trip's status.
- [x] **Refresh resilience** — active trip id persists to `localStorage`; `App.tsx` rehydrates it before rendering routes. Verified with a hard reload on a deep route (`/route`).

**Known follow-up, not a security gap:** the frontend doesn't yet disable mutating buttons for viewers — the backend correctly rejects the write (403), but a viewer currently sees an enabled "Add" button that then fails. Cosmetic; worth a small pass later.

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
