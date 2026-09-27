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
- [x] **Observability** — Azure Application Insights, via `azure-monitor-opentelemetry` + `FastAPIInstrumentor` in `app/main.py`. Only activates when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set (the `tripbuggy-insights` resource's connection string, set as a backend app setting) — a no-op for local dev. Captures requests, traces, and everything logged under the `app` logger namespace (including `agent_service.py`'s existing fallback warnings).
- [x] **Abuse protection** — `slowapi`-based per-IP rate limits (`app/rate_limit.py`) on signup (5/hour — anonymous device accounts were previously unlimited), login (20/hour), and every endpoint that calls the paid Anthropic agent: route drafting (20/hour), Discover (10/hour — the priciest, since it does live web search), change-request interpretation (20/hour), and the assistant widget (30/hour). Disabled during the pytest suite (`DISABLE_RATE_LIMIT=1` in `conftest.py`) since it reuses one process/IP across many calls; verified separately in `tests/test_rate_limit.py`, which turns it on just for that one test.
- [x] **Operator admin routes** — `app/routers/admin.py`, all under `/api/v1/admin`. Not a customer feature — guarded by a shared secret (`ADMIN_TOKEN` app setting) via the `X-Admin-Token` header, checked in `app/deps.py`'s `require_admin` with a fail-closed default (unset token = routes unusable, not open). No admin UI; call these directly (e.g. `curl -H "X-Admin-Token: ..."`).
  - Users: list (with trip counts), edit email/display name, reset password, deactivate/reactivate (blocks login and invalidates any existing token immediately — see `deps.py`'s `get_current_user` and `auth.py`'s `login`), delete (cascades their trips, same as a customer deleting their own).
  - Trips: list a specific user's trips, delete any single trip by id (for removing one bad item without nuking the whole account).
  - Settings: `force_simulated_agent` — a cost kill switch (`AppSetting` table, checked in `agent_service._get_client`) that forces every agent call to its deterministic simulated fallback regardless of `ANTHROPIC_API_KEY`, for when costs spike and you need to stop live Claude calls without redeploying. Read fresh per call, not cached, since the deployed backend runs multiple gunicorn workers that don't share memory.

## Tier 5 — Azure deployment (free tier)

Azure App Service has no free managed Postgres long-term, so the plan mixes providers: Azure hosts
compute (free), a third-party host provides Postgres (free). CORS is now configurable via
`CORS_ORIGINS` (see `backend/app/config.py`) instead of hardcoded — no more code changes needed
before deploying. `.github/workflows/deploy-backend.yml` and `deploy-frontend.yml` already exist
and fire on every push to `main` once the secrets below are set; `backend/startup.sh` is the App
Service startup command (runs `alembic upgrade head` then serves with gunicorn+uvicorn workers).

- [ ] **Postgres**: create a free project on [Neon](https://neon.tech) or [Supabase](https://supabase.com), grab the connection string, run `alembic upgrade head` against it once from a local shell.
- [ ] **`az login`** (you) + confirm subscription.
- [ ] **Provision** (all free-tier SKUs):
  ```bash
  az group create -n tripbuggy-rg -l eastus
  az appservice plan create -n tripbuggy-plan -g tripbuggy-rg --sku F1 --is-linux
  az webapp create -n <unique-backend-name> -g tripbuggy-rg -p tripbuggy-plan --runtime "PYTHON:3.11"
  az webapp config set -n <unique-backend-name> -g tripbuggy-rg --startup-file "startup.sh"
  az webapp config appsettings set -n <unique-backend-name> -g tripbuggy-rg --settings \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    DATABASE_URL="<neon/supabase connection string>" \
    JWT_SECRET="<generate a real random secret>" \
    ANTHROPIC_API_KEY="<optional>" \
    CORS_ORIGINS="https://<your-static-web-app>.azurestaticapps.net"
  az staticwebapp create -n tripbuggy-frontend -g tripbuggy-rg -l eastus2 --sku Free
  ```
- [ ] **Get deploy credentials** and add them as GitHub repo secrets (Settings → Secrets and variables → Actions):
  - `AZURE_WEBAPP_NAME` = the backend app name you chose above
  - `AZURE_WEBAPP_PUBLISH_PROFILE` = output of `az webapp deployment list-publishing-profiles -n <backend-name> -g tripbuggy-rg --xml`
  - `AZURE_STATIC_WEB_APPS_API_TOKEN` = output of `az staticwebapp secrets list -n tripbuggy-frontend --query "properties.apiKey" -o tsv`
  - `VITE_API_URL` = `https://<unique-backend-name>.azurewebsites.net`
- [ ] **First deploy**: push to `main` (or run each workflow manually via `workflow_dispatch`) — both sides deploy automatically from then on.
- [x] **Observability**: done — see Tier 4.

### Scaling beyond free tier

The free SKUs above cap out fast (App Service F1: 60 CPU-min/day, single shared core, no
autoscale; free Postgres: small storage/connection limits, autosuspends when idle). None of this
requires code changes to outgrow — it's a config/SKU change:

- App Service: `az appservice plan update -n tripbuggy-plan -g tripbuggy-rg --sku B1` (or `S1`/`P1v3`
  for autoscale) once traffic is real.
- Postgres: upgrade the Neon/Supabase plan, or migrate to Azure Database for PostgreSQL Flexible
  Server (General Purpose tier) if you want everything under one Azure bill.
- Static Web Apps: Free tier's CDN already scales; upgrade to Standard (~$9/mo) only if you need
  more than 100GB/month bandwidth or private endpoints.

### Managing the Anthropic cost

At meaningful scale, the Anthropic API — not Azure — is the dominant line item, driven mostly by
Discover's live web search. Two levers, in order of impact:

1. **Cache Discover results** (biggest lever, not yet implemented) — skip re-running the
   web-search research call when a trip's inputs (destination/when/who/budget/pace) haven't
   changed, and share cached results across different users with the same profile+destination.
   Needs a TTL (e.g. 24-48h) so prices/links don't go stale forever.
2. **Cheaper model for mechanical calls** (done) — `app/config.py`'s `anthropic_model_fast`
   (`claude-haiku-4-5-20251001`) now handles the catalog-structuring pass in
   `_agent_discover_catalog` and the in-app assistant widget's Q&A
   (`_agent_answer_assistant_question`) — both are reformatting/lookup tasks that don't need
   Sonnet-level reasoning. Route drafting and change-request interpretation stay on
   `anthropic_model` (Sonnet), since those still benefit from stronger reasoning.

Reference pricing (per [claude.com/pricing](https://claude.com/pricing), fetched 2026-09-26 —
check current rates before relying on this for budgeting):

| | Sonnet 5 | Haiku 4.5 |
|---|---|---|
| Input | $2 / MTok | $1 / MTok |
| Output | $10 / MTok | $5 / MTok |
| Prompt cache read | $0.20 / MTok | $0.10 / MTok |
| Prompt cache write | $2.50 / MTok | $1.25 / MTok |

Web search tool: $10 per 1,000 searches, separate from token cost — this is why caching
Discover's results (lever 1) matters more than the model swap does; Haiku only affects the two
calls that don't touch web search.

---

## Post-launch fixes (GitHub issues)

- [x] **#1 Drag-and-drop route reordering** — see Tier 5/UI history above.
- [x] **#2 Booking links weren't carried onto Itinerary/Booking** — see above.
- [x] **#3 Every priced item must have a real source/booking link** — `_simulate_discover_catalog` now gives flights a Google Flights query link (`?q=Flights+to+<destination>`, which auto-detects the customer's own origin — no origin/dates needed) and activities a TripAdvisor search link (`?q=<destination>+things+to+do`), both verified working before hardcoding. The real agent's structuring call now requires `platform`/`booking_url` on every item (schema-enforced, not just prompted) and falls back to these same three verified generic searches — Google Flights, Airbnb, TripAdvisor — instead of ever omitting a link. `google.com` added to `ALLOWED_BOOKING_DOMAINS`.
- [x] **#4 Place name verification** — new `POST /api/v1/destinations/verify` (Haiku, rate-limited 30/hour): checks the customer's free-text destination is a real place, silently fixes casing/spelling ("pariss" → "Paris"), and offers up to 3 close real alternatives when it doesn't recognize it at all (with a "use it as typed anyway" override — never blocks the customer). Wired into `HomeScreen.tsx`'s "Plan my trip", not "Surprise me" (already a known-valid destination). Fails soft — a verification-call failure just proceeds with the original text rather than blocking trip creation.

---

**Explicitly out of scope for now** (per BRD, not oversights): real flight/hotel bookings against live vendor APIs, real payment processing, real document/visa verification. These are documented Phase 2 items.
