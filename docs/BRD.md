# TripBuggy — Business Requirements Document (BRD)

**Status:** Draft v1
**Owner:** Frank Tharakan
**Companion doc:** [TRD.md](./TRD.md)

---

## 1. Purpose

TripBuggy is a trip-planning product where the customer supplies almost nothing — just a destination — and an agent does the rest: asking a short round of qualifying questions, drafting a route, surfacing options, booking at a customer-chosen level of autonomy, and staying available to handle changes once the trip is underway.

This document defines *what* the product must do and *why*, for anyone building, reviewing, or prioritizing the work. It does not prescribe implementation — see the TRD for that.

## 2. Problem Statement

Trip planning today asks the traveler to be their own travel agent: research destinations, compare options across a dozen tabs, track a budget by hand, and manually rebook when something changes mid-trip. TripBuggy collapses that into a conversation — the traveler names a destination and answers a few questions; the agent carries the rest of the weight, at whatever level of hand-holding the traveler wants.

## 3. Goals

- Reduce trip setup to one input (destination) plus a short, low-friction Q&A.
- Let the agent draft and refine the itinerary without the customer needing to search manually.
- Give the customer explicit, adjustable control over how much the agent is allowed to do unsupervised, especially at booking time.
- Keep the agent available *during* the trip to handle disruptions, not just before it.
- Ship a planning-and-UI experience first; real bookings and payments are a deliberate later phase (see §6, Out of Scope).

## 4. Target Users

- **Primary:** individual travelers or small groups planning leisure trips who want a fast, low-effort planning experience and are comfortable delegating some or all decisions to an agent.
- **Secondary (v1, lightweight):** a "crew" — travel companions invited to a trip with owner/editor/viewer roles.

Out of scope for v1: travel agencies, corporate travel management, multi-trip loyalty programs.

## 5. Product Flow (Business Logic)

This is the same logic captured visually in the [TripBuggy Route Map](https://claude.ai/code/artifact/18cb4bdb-a1e7-4d99-b6c8-e24522abfec3) artifact; this section is the authoritative written version.

| # | Stage | What happens | Trigger to move on |
|---|-------|---------------|---------------------|
| 1 | **Agent Intake** | Customer supplies only a destination. Agent asks a short round of follow-up questions: when, who's coming, budget vibe, pace. | All questions answered (or explicitly skipped) |
| — | *Decision: solo or crew?* | If traveling with others, an **Invite Crew** step assigns owner/editor/viewer roles before continuing. Solo trips skip straight through. | — |
| 2 | **Plan the Route** | Agent drafts stops and sequences legs from the intake answers. | Draft route exists |
| 3 | **Discover & Add** | Agent surfaces flights, stays, and activities matching the route and preferences. Customer can also add items manually (optional side input — used when offline or when the agent has nothing to suggest). | At least one item added |
| 4 | **Build Itinerary** | Items are placed on specific days; overlapping/conflicting times are flagged. | Itinerary has no unresolved conflicts |
| — | *Decision: within budget?* | If the running total exceeds the customer's budget, the flow **loops back to Discover & Add** so an item can be swapped and the total re-checked. This is the only loop before booking. | Within budget |
| 5 | **Agentic Booking** | The customer sets, by prompt, how much autonomy the agent has: **draft only** (agent shortlists, customer books), **approve each** (agent proposes, customer confirms per item — the default), or **full auto** (agent books without per-item confirmation). This is one configurable stage, not three different flows — nothing downstream needs to know which setting was used. International trips get an optional **Documents Check** reminder (passport/visa) as a side input. | Items reach a booked/confirmed state appropriate to the chosen autonomy level |
| 6 | **On the Road** | Live, day-of view with check-ins. When a travel change is needed (delay, closure, missed connection), the customer tells the agent in a prompt, and the flow **loops back into Agentic Booking**, at whichever autonomy level is currently set, to secure the replacement. This is the second and only other loop in the system. | Trip dates end / customer marks trip complete |
| 7 | **Trip Recap** | Journal, photos, and the option to save the trip as a template for a future one. | — |

**Design principles that must survive into implementation:**
1. **One customer input starts everything** — the destination. Everything else is the agent asking, not the customer filling out a form.
2. **Solo and group share one engine.** Choosing "crew" only inserts a role-invite step; nothing downstream forks by trip type.
3. **Side inputs (offline manual entry, documents check) are not separate flows.** They feed into stages that already exist.
4. **Booking autonomy is a dial, not a branch.** It's a customer-set parameter on the Agentic Booking stage, changeable at any time by prompt.
5. **There are exactly two loops**: over-budget (→ Discover & Add) and on-the-road change (→ Agentic Booking). Both reuse existing stages rather than introducing new ones.

## 6. Scope

### In scope — v1
- Agent Intake conversational Q&A (destination + 4 follow-up questions).
- Solo/crew branching with basic crew invite (roles, no granular permissions beyond owner/editor/viewer).
- Agent-drafted route and agent-surfaced options (flights/stays/activities) — **simulated inventory**, not live third-party search results.
- Manual item entry as a fallback input.
- Itinerary builder with day placement and time-conflict detection.
- Budget tracking with the over-budget loop back to Discover & Add.
- Agentic Booking stage with the three-level autonomy dial — **bookings are simulated** (state transitions and confirmations are recorded, no money moves and no real vendor is contacted).
- Documents Check reminder for international trips (static reminder, not a live visa/passport verification service).
- On the Road live view, with the agent-assisted change loop back into (simulated) Agentic Booking.
- Trip Recap with journal/photos and save-as-template.
- User accounts and persistent storage so a trip (and its On the Road state) can be returned to across sessions.
- The Google-style intake UI already prototyped: single destination search, progressive one-question-at-a-time flow, and a growing filmstrip of destination-themed imagery as questions are answered.

### Explicitly out of scope — v1
- Real flight/hotel/activity search against live vendor inventory.
- Real payment processing or any real financial transaction.
- Real document/visa verification.
- Corporate or multi-tenant/agency features.
- Native mobile apps (web only, responsive).

### Planned for a later phase (not v1)
- Live booking integrations (e.g., a flights/hotels aggregator API).
- Real payment processing.
- Push/SMS notifications for on-the-road changes.
- Multi-currency support.

## 7. User Experience Requirements

- The entry point is deliberately minimal — a single destination search box, no visible form, no account wall before the first interaction (Google.com-style restraint: one input, one primary action, nothing else competing for attention).
- After the destination is submitted, questions are asked **one at a time**, not as a long form — each answer should feel like a single, fast tap.
- As each question is answered, a **destination-themed image** should appear, building a small visual sense of the place before the itinerary exists. Since no live photo API is used in v1, this is illustrated art keyed to the destination (see TRD for the mechanism) with a graceful generic fallback for destinations without custom art.
- The customer must always be able to see and change the current booking autonomy level in plain language, not a technical toggle.
- On-the-road change requests are prompt-based (free text to the agent), not a rigid form.

## 8. Success Metrics (v1)

- % of started intakes that reach a completed itinerary without abandoning.
- Median number of questions/taps from landing to a drafted route.
- % of trips where the customer changes the booking autonomy level at least once (signals the control is discoverable and trusted).
- % of on-the-road change requests successfully resolved by the agent without the customer having to leave the flow.

## 9. Assumptions

- The agent is powered by a hosted LLM (Claude) with tool-calling; it is not a fully deterministic rules engine.
- "Simulated" booking in v1 still needs a real, persisted state machine (proposed → pending approval → confirmed) so that Phase 2 (real bookings) can slot in without redesigning the flow.
- A destination typed in free text will not always match a known place; the product must degrade gracefully (generic art, agent still asks its questions) rather than block the flow.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Customers expect real bookings in v1 and are confused by "simulated" state | Trust/credibility | UI must be explicit that a booking is confirmed *in TripBuggy*, without implying a real vendor transaction, until Phase 2 ships |
| Full-auto booking autonomy books something the customer wouldn't have chosen | Trust, potential churn | Full auto should still surface a post-hoc summary/receipt of what was booked and why, and remain easy to downgrade to approve-each |
| Free-text change requests on the road are ambiguous | Agent makes wrong call | Agent should confirm its interpretation before acting when the autonomy level is anything other than full auto |

## 11. Glossary

- **Agent Intake** — the destination + Q&A stage.
- **Crew** — travel companions invited to a trip, with a role.
- **Autonomy level** — the customer-set dial on Agentic Booking (draft only / approve each / full auto).
- **On the Road** — the live, day-of stage where the agent handles change requests.
- **Loop** — a stage that can send the flow back to an earlier stage rather than always moving forward (there are exactly two: budget, and on-the-road change).
