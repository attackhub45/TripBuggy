# TripBuggy — Technical Requirements Document (TRD)

**Status:** Draft v1
**Companion doc:** [BRD.md](./BRD.md) — read that first for *what* and *why*. This document is *how*.

**Stack decisions locked in for v1:** React frontend, Python (FastAPI) backend, Azure hosting, planning-and-UI scope only (no live bookings), user accounts + persistent storage required.

---

## 1. Architecture Overview

```
┌─────────────────────┐        HTTPS/JSON        ┌──────────────────────┐
│  React SPA (Vite)    │ ────────────────────────▶│  FastAPI backend      │
│  Azure Static Web App│ ◀──────────────────────── │  Azure Container App │
└─────────────────────┘                            └──────────┬───────────┘
                                                                │
                                          ┌─────────────────────┼─────────────────────┐
                                          ▼                     ▼                     ▼
                                ┌─────────────────┐   ┌──────────────────┐  ┌──────────────────┐
                                │ Azure Postgres    │   │ Anthropic Claude  │  │ Azure Key Vault    │
                                │ Flexible Server   │   │ API (agent calls) │  │ (secrets)          │
                                └─────────────────┘   └──────────────────┘  └──────────────────┘
```

- **Frontend**: React + TypeScript (Vite), deployed as a static app.
- **Backend**: Python 3.12 + FastAPI, deployed as a container.
- **Database**: Azure Database for PostgreSQL — Flexible Server.
- **Agent layer**: Anthropic Claude API via the Python `anthropic` SDK, using tool calling. Lives inside the backend, not called directly from the frontend (keeps the API key server-side).
- **Auth**: email/password + JWT (via `fastapi-users` or equivalent), issued by the backend. Azure AD B2C is a plausible v2 upgrade, not required for v1.
- **Secrets**: Azure Key Vault, injected as environment variables at deploy time — never committed.

## 2. Repository Layout

```
TripBuggy/
├── docs/
│   ├── BRD.md
│   └── TRD.md
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── screens/          # Home, Flow, Summary, Itinerary, Booking, OnTheRoad, Recap
│   │   ├── components/
│   │   ├── theme/            # design tokens ported from the artifacts (see §8)
│   │   ├── art/               # destination SVG scene library
│   │   ├── api/               # typed API client
│   │   └── state/             # trip state store
│   └── package.json
├── backend/                  # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/          # trips, intake, itinerary, booking, ontheroad, auth
│   │   ├── services/         # agent_service, budget_service, booking_service
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── db.py
│   ├── alembic/               # migrations
│   └── pyproject.toml
├── infra/                    # IaC for Azure (Bicep or Terraform)
└── .github/workflows/        # CI/CD
```

## 3. Data Model

All primary keys are UUIDs. Timestamps (`created_at`, `updated_at`) are implied on every table.

| Table | Key fields | Notes |
|---|---|---|
| `users` | email, hashed_password, display_name | v1 auth |
| `trips` | user_id (owner), raw_destination, matched_destination_key, status, is_international, autonomy_level | `status`: intake → planning → booking → on_the_road → complete |
| `intake_answers` | trip_id, question_key, answer_value | one row per question (when/who/budget/pace) |
| `crew_members` | trip_id, user_id or invited_email, role | role: owner / editor / viewer |
| `route_stops` | trip_id, order_index, name, notes | output of "Plan the Route" |
| `itinerary_items` | trip_id, day_index, item_type (flight/stay/activity), title, source (agent/manual), cost_estimate, status (proposed/confirmed) | output of "Discover & Add" / "Build Itinerary" |
| `budget_snapshots` | trip_id, total_estimate, budget_cap, over_budget | recomputed whenever itinerary items change |
| `booking_records` | trip_id, itinerary_item_id, autonomy_level_at_booking, status (drafted/pending_approval/simulated_booked), confirmation_ref | Agentic Booking output; **simulated in v1** |
| `change_requests` | trip_id, prompt_text, created_at, resolution_status, resulting_booking_id | On the Road loop |

`autonomy_level` is stored on `trips` (current setting) and echoed onto each `booking_record` at the time of booking, so history is preserved even if the customer changes the dial later.

## 4. API Design (v1)

REST, JSON, versioned under `/api/v1`. All endpoints except `/auth/*` require a bearer JWT.

| Method | Path | Purpose | Maps to BRD stage |
|---|---|---|---|
| POST | `/auth/signup`, `/auth/login` | account creation / session | — |
| POST | `/trips` | create a trip from a raw destination string | Agent Intake (start) |
| POST | `/trips/{id}/intake-answers` | submit one Q&A answer; returns next question or "done" | Agent Intake |
| POST | `/trips/{id}/crew` | invite a crew member with a role | Crew branch |
| POST | `/trips/{id}/route` | trigger agent route drafting | Plan the Route |
| POST | `/trips/{id}/discover` | ask agent to surface options (simulated catalog) | Discover & Add |
| POST | `/trips/{id}/itinerary-items` | add an item (agent-sourced or manual) | Discover & Add / Build Itinerary |
| PATCH | `/trips/{id}/itinerary-items/{item_id}` | move/edit/remove an item | Build Itinerary |
| GET | `/trips/{id}/budget` | current total vs. cap, `over_budget` flag | Budget check |
| PATCH | `/trips/{id}/autonomy` | set draft_only / approve_each / full_auto | Agentic Booking (the dial) |
| POST | `/trips/{id}/book` | run the booking stage at the current autonomy level | Agentic Booking |
| POST | `/trips/{id}/change-requests` | submit a free-text on-the-road change prompt | On the Road loop |
| GET | `/trips/{id}` | full trip state (used by On the Road / Recap views) | On the Road, Trip Recap |
| POST | `/trips/{id}/complete` | mark trip finished, unlock Recap | Trip Recap |

## 5. Agent Design

The agent is invoked **server-side only**, from `services/agent_service.py`, using the Anthropic Claude API with tool calling. One conversational "agent session" per trip, reused across stages so context (destination, answers, current itinerary) persists without being re-sent from scratch each call.

**Tools exposed to the agent** (implemented as plain Python functions, described to Claude via tool schemas):

- `ask_next_question()` — drives Agent Intake one question at a time.
- `draft_route(destination, answers)` — produces `route_stops`.
- `search_catalog(criteria)` — **v1: returns simulated/mocked results** from a static or lightly-randomized in-repo dataset, not a live vendor call. This function is the seam where a real search API (Duffel, Amadeus, etc.) gets swapped in during Phase 2 — keep its signature stable.
- `check_budget(trip_id)` — returns the over/under status that triggers the budget loop.
- `book_items(trip_id, autonomy_level)` — **v1: simulated.** Behavior differs by level:
  - `draft_only`: sets items to `proposed`, does nothing further.
  - `approve_each`: sets items to `pending_approval`, waits for a customer confirmation call per item.
  - `full_auto`: sets items straight to `simulated_booked` and returns a summary receipt.
- `handle_change_request(trip_id, prompt_text)` — called from the On the Road loop; re-invokes `book_items` logic for the affected item(s) at the trip's current autonomy level, after confirming its interpretation of the request (except in `full_auto`, per BRD §10 risk mitigation).

**Prompting principle:** the system prompt for the agent should encode the BRD's five design principles (§5 of the BRD) directly — one input starts everything, solo/crew share one engine, side inputs aren't branches, autonomy is a dial not a fork, exactly two loops — so the agent's own behavior (what it asks, when it loops) stays consistent with the documented flow instead of drifting.

## 6. Frontend Architecture

Screens map directly to BRD stages. The existing [TripBuggy Intake](https://claude.ai/code/artifact/c2e9ce0b-a8a1-4a8f-8974-5a3b571a0215) artifact is the reference implementation for Home/Flow/Summary — port its structure, don't redesign it:

| Screen | Corresponds to | Key components |
|---|---|---|
| `HomeScreen` | Agent Intake (destination entry) | Search box, primary CTA, "surprise me" |
| `FlowScreen` | Agent Intake (Q&A) | `QuestionCard`, `Chips`, `ProgressDots`, `Filmstrip` |
| `RouteScreen` | Plan the Route | Ordered stop list, agent-drafted, editable |
| `DiscoverScreen` | Discover & Add | Agent-surfaced option cards + manual-add form (optional side input) |
| `ItineraryScreen` | Build Itinerary | Day-by-day grid, conflict warnings, budget indicator (surfaces the loop back to `DiscoverScreen` when over budget) |
| `BookingScreen` | Agentic Booking | The three-stop **autonomy dial** control (draft only / approve each / full auto) ported from the node design in the Route Map artifact, plus per-item status |
| `OnTheRoadScreen` | On the Road | Live day view, prompt box for change requests, links a submitted change back into `BookingScreen` state |
| `RecapScreen` | Trip Recap | Journal/photos, "save as template" |

**Destination art**: port the 9 hand-drawn SVG `<symbol>` scenes (Paris, Tokyo, New York, Rome, Santorini, Bali, Iceland, Dubai, fallback) from the Intake artifact into `frontend/src/art/` as a single `DestinationArt.tsx` component. Keep the crop-via-viewBox technique for the filmstrip thumbnails — it's cheap (one asset per destination, reused at multiple crops) and self-contained (no external image requests).

**State**: a single `TripContext` (or Zustand store) holding the current trip's server state, hydrated from `GET /trips/{id}` and updated optimistically as the customer moves through screens.

## 7. Non-Functional Requirements

- **Security**: JWT auth on every non-auth endpoint; `ANTHROPIC_API_KEY` and DB credentials only ever read from Key Vault-backed environment variables, never committed or logged.
- **Performance**: agent calls (Q&A, route drafting, booking) should show optimistic UI state ("thinking…") since LLM calls are not instant; target perceived response under 2s for chip-based Q&A steps.
- **Accessibility**: carry forward the focus-visible states, semantic buttons, and reduced-motion handling already established in the artifact prototypes.
- **Observability**: Azure Application Insights on the backend — log every agent tool call (name + duration + success/failure), every autonomy-level change, and every change-request resolution, since these are the events the BRD's success metrics (§8) depend on.

## 8. Design System Carryover

Port the token system already validated in the two published artifacts directly into `frontend/src/theme/`:

- Palette: `--sand`, `--ink`, `--rust`, `--sage`, `--dust`, `--dusk` (plus light/dark surface/text/border derivations already defined in the artifacts' CSS).
- Type: Barlow Condensed (display), Karla (body), IBM Plex Mono (labels/data) via Google Fonts.
- Component patterns to reuse as-is: pill search input, chip buttons, the three-stop dial control, the growing filmstrip.

## 9. Azure Hosting & Deployment

- **Frontend**: Azure Static Web Apps, built from `frontend/` via GitHub Actions on push to `main`.
- **Backend**: containerize FastAPI (`backend/Dockerfile`), push to Azure Container Registry, deploy to Azure Container Apps.
- **Database**: Azure Database for PostgreSQL Flexible Server; connection string in Key Vault.
- **Secrets**: Azure Key Vault, referenced by Container Apps via managed identity — no secrets in `.env` files in the repo.
- **CI/CD**: two GitHub Actions workflows — `deploy-frontend.yml` (build + deploy to Static Web Apps) and `deploy-backend.yml` (build image, push to ACR, deploy revision to Container Apps). Both gated on tests passing.

## 10. Testing Strategy

- **Frontend**: Vitest + React Testing Library for components; at minimum, cover the Q&A flow state machine and the autonomy dial.
- **Backend**: pytest for services and routers; mock the Anthropic client in tests (no live LLM calls in CI).
- **Integration**: a smoke test that walks one full trip through every BRD stage end-to-end against a test database, asserting the two loops (budget, on-the-road change) actually re-enter the right stage.

## 11. Suggested Build Phases (for Claude Code)

1. **Scaffold** — repo layout above, empty FastAPI app with health check, empty Vite React app, Azure resources provisioned (infra/), CI/CD skeleton deploying "hello world" both sides.
2. **Auth + Trip shell** — signup/login, `POST /trips`, empty `HomeScreen` → `GET /trips/{id}` round trip.
3. **Agent Intake** — port the Home/Flow/Summary screens and destination art from the Intake artifact; wire to `intake-answers` endpoint and the real agent Q&A tool.
4. **Route + Discover + Itinerary** — `RouteScreen`, `DiscoverScreen`, `ItineraryScreen`, simulated catalog search, conflict detection.
5. **Budget loop** — budget indicator + the loop back into `DiscoverScreen` when over cap.
6. **Agentic Booking** — the autonomy dial UI and the simulated `book_items` behavior per level.
7. **On the Road + change loop** — `OnTheRoadScreen`, change-request prompt, loop back into booking.
8. **Trip Recap** — journal/photos, save-as-template.
9. **Hardening** — observability, accessibility pass, integration smoke test, production deploy.

## 12. Open Questions for Phase 2 (not v1)

- Which live travel-inventory API to integrate for real search/booking (Duffel vs. Amadeus vs. other).
- Real payment processing provider and PCI approach.
- Whether Azure AD B2C replaces the v1 JWT auth once real accounts/payments are involved.
