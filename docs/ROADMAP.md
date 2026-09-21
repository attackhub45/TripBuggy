# TripBuggy — Remaining Work

**Status:** Draft v1
**Companion docs:** [BRD.md](./BRD.md) · [TRD.md](./TRD.md)

A prioritized punch-list of what's left across the build and deployment, as of 2026-09-19. Ordered by what unlocks the most value next, not by category.

---

## Tier 1 — The core product gap ✅ done (2026-09-19)

- [x] **Real agent (Anthropic API)** — `agent_service.py` now calls Claude (tool calling) for route drafting, catalog discovery, and on-the-road change-target interpretation, falling back to the old deterministic simulation on any failure. Booking's own state transitions stay deterministic on purpose — only the two content-generation tasks and the change-target pick got real reasoning.

  Verified live: a Marrakech trip (not one of the app's 8 hardcoded destinations) produced a genuinely specific, on-brief route and catalog; a free-text change request correctly identified the one affected item out of six booked, confirmed via logs to be a real API call rather than the random fallback.

  Two real bugs found and fixed along the way: Claude occasionally double-encodes a complex tool input as a JSON string instead of a native array (handled in `_extract_list_field`); and route/catalog generation was being given the canonicalized name from the 8-destination matcher instead of what the customer actually typed (e.g. "Kyoto, Japan" was resolving to "Tokyo") — fixed by passing the raw destination string to the real agent calls.

## Tier 2 — Product completeness ✅ done (2026-09-19)

- [x] **Real login/signup** — `LoginScreen`/`SignupScreen` + `authStore`. Signing in swaps the session from the silent device account to a real one.
- [x] **Enforce crew roles** — `require_viewer`/`require_editor`/`require_owner` in `deps.py` resolve role by email match (owner or `crew_members`), no schema change needed. Verified: an editor can edit a trip they don't own; a viewer's write attempt gets a real 403.
- [x] **"My trips" list** — `TripsListScreen` + `GET /api/v1/trips`, showing owned + crew trips with a role badge, opening straight to the right screen for that trip's status.
- [x] **Refresh resilience** — active trip id persists to `localStorage`; `App.tsx` rehydrates it before rendering routes. Verified with a hard reload on a deep route (`/route`).

**Known follow-up, not a security gap:** the frontend doesn't yet disable mutating buttons for viewers — the backend correctly rejects the write (403), but a viewer currently sees an enabled "Add" button that then fails. Cosmetic; worth a small pass later.

## Tier 3 — Polish ✅ done (2026-09-19)

- [x] **Agent presence on Route + Booking** — `AgentMessage` now appears on `RouteScreen` (drafting/drafted, naming the destination) and `BookingScreen` (reflects the chosen autonomy level, a running-booking state, and an all-booked state). Verified live on a Lisbon trip.
- [x] **Global error/notification pattern** — New `toastStore` + `ToastHost`, mounted once in `App.tsx`. Every trip-mutating action in `tripStore.ts` that previously threw into the void now routes through a `withToast` wrapper that surfaces a readable message (via `lib/errors.ts`, which unwraps FastAPI's `{"detail": ...}` body) before rethrowing. `startTrip`/`loadTrip` were left alone — they already have dedicated inline error UI in `HomeScreen`/`App.tsx`.

  Found and fixed a real bug along the way: `OnTheRoadScreen`'s change-request submit used to navigate to Booking regardless of whether the request succeeded; it now awaits the result and stays put on failure.

  Verified live: killed the backend mid-flow on the Booking screen and confirmed the toast fired with "Could not reach the backend — is it running?", the item stayed in its prior state (no silent corruption), and dismiss worked; restarted the backend and confirmed approvals resumed normally.

## Tier 4 — Engineering hygiene (do before or alongside Azure)

- [x] **Automated tests** — Backend pytest suite (`backend/tests/`, 79 tests) and a Playwright E2E suite (`frontend/e2e/`) both exist. TRD's Vitest + React Testing Library layer for frontend unit tests still doesn't — E2E covers the user-facing flows in the meantime.
- [x] **CI pipeline** — `.github/workflows/ci.yml` runs pytest, frontend lint + typecheck/build, and the Playwright suite on every push/PR to `main`. (`.github/workflows/e2e-daily.yml` also still runs the E2E suite on a daily schedule as a drift canary.)
- [ ] **Observability** — No logging/metrics wired in (TRD names Azure Application Insights).

## Tier 5 — Azure deployment

Nothing provisioned yet beyond installing the Azure CLI locally. Full detail in the runbook from earlier — summarized here:

- [ ] `az login` (you) + confirm subscription
- [ ] Provision: resource group, Postgres Flexible Server, backend App Service, frontend Static Web App, Key Vault
- [ ] First deploy: push backend + frontend code, run migrations against the Azure DB, fix CORS (currently hardcoded to `localhost:5173`)
- [ ] CI/CD: GitHub Actions workflows so pushes to `main` auto-deploy both sides

---

**Explicitly out of scope for now** (per BRD, not oversights): real flight/hotel bookings against live vendor APIs, real payment processing, real document/visa verification. These are documented Phase 2 items.
