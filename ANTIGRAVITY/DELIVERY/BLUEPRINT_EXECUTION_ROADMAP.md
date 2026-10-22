# Project Eko Blueprint Execution Roadmap

**Baseline:** 21 October 2026  
**Objective:** Bring the implementation into line with the Real-Economy Open-World Master Blueprint, completing and verifying each phase before advancing.

## Phase 0 — Baseline and gates

**Status: Engineering baseline complete; external gate open.** The blueprint and repository were compared. The API's double-entry Game Naira journal now restores and persists on each posting, and the workspace build order was corrected. Legal classification and PSP confirmation remain external gates and must not be represented as complete without written evidence.

**Exit criteria:** A recorded code baseline; known technical and external blockers; a successful workspace build; no claim that real payouts are live.

## Phase 1 — Identity and authoritative actions

**Status: Complete — session identity boundary implemented and acceptance checked.** M47 player routes resolve only valid, unexpired session tokens; the legacy API now requires a verified session after auth routes; and the realtime worker validates sessions through the API. The browser attaches its active token to both services. Realtime presence, chat, crew, co-op, vehicle and disconnect actions derive the acting player from the session, not request-body IDs. Co-op stop inputs no longer choose passenger counts, participant roles are checked, and the legacy payout endpoint stays disabled until it consumes verified zone evidence. Unsupported owner-access and recovery flows fail closed.

**Evidence:** `npm run build` passes. `npm run verify:phase1` launches isolated API/realtime services with temporary storage, confirms missing and invalid sessions are rejected, verifies two accounts keep separate M47 journey state when a request forges both the other account ID and token in its body, verifies realtime presence/chat/disconnect bind to the authenticated account, and confirms client-claimed co-op settlement is unavailable. The verifier removes its temporary data. Inline browser JavaScript also passes `node --check`.

**Boundary to carry into Phase 2:** The older domain API is now session-gated, but portions of its legacy economy/profile model still read and mutate a single server-side demo profile. Those values are not yet per-account. Phase 2 must replace that demo state with account-scoped domain state before legacy economy actions can be treated as production player state. Full visual browser acceptance of the mobile HUD also remains outstanding; the current browser tab uses a `file://` URL that the browser-control policy does not allow this task to reload.

**Mobile HUD increment:** On phones, the wallet/location/navigation and movement/context action remain prominent; wardrobe, multiplayer counts and account controls moved into Tools; event ticker noise is suppressed; and the EkoGuide card is compacted below the top strip.

## Phase 2 — Durable domain state

Replace remaining JSON and process-memory state with the documented database boundary. Persist profiles, vehicles, businesses, world/economic state, ledger journal, idempotency records and cooperative settlements. Scope the legacy demo economy/profile state to authenticated accounts before re-enabling its write routes. Add migrations, restart recovery and reconciliation.

**Status: In progress — account-scoped domain state, durable shared transit and commerce state, and restart recovery are implemented on the current JSON snapshot store.** Player profiles, wallets, vehicle state and ownership, businesses, fleet flags and 9-class run counts, retail supply, supply-chain run counts, cargo batches, rewards, household inventory and lease state, careers, labour offers and Creator Studio submissions, social preferences, streamed districts, Danfo Hustle records, and parcel ownership/build state bind to authenticated accounts. M47 snapshots use schema version 1, reject malformed or unreadable stores at startup, and write through restrictive-permission temporary files followed by atomic rename. Account, ledger, and shared-world snapshots are atomic.

Purchases and income/sink mutations increasingly use server-owned values and post the ledger before changing player state. This now includes dealership, fleet collection/runs, server-priced vehicle charters with a funded deposit, owned-business shifts (with funded operating capital and 3-line gross/expense/net journal posting) and acquisition/revenue collection, household obligations, commerce, transit conductor co-op, fuel/service, supply-chain runs (with funded working capital, explicit idempotency keys, and no silent default fallback), cargo delivery, household item resale, labour, Creator Studio, property maintenance/yield, wholesale bargaining, sandbox reward redemptions (using server catalog point costs), minigame reward, career settlement, and mission-priced trip settlements. Browser settlement handlers wait for server approval and reconcile the authoritative balance before crediting or debiting local state, while preserving synchronous execution in isolated VM unit tests. Trip clients cannot set payout/reputation or submit arbitrary trip types; mission settlement requires an accepted matching mission and the full canonical checkpoint sequence in order. Both mission completion routes use the same one-time career and ledger settlement, and idempotency keys are required and account-scoped. Bus-stop fares settle through the server's boarding route, with the browser's duplicate route-completion settlement removed. Replays are rejected or returned idempotently where covered; unknown vehicle classes, businesses, supply chains, rewards, and arbitrary prices are rejected. Labour offers, properties, and player state are account-scoped; transit queues, commerce stock, city events, media metrics/history, and route-selection logs remain shared world state.

`npm run verify:phase2` covers two-account isolation, server-derived transaction amounts, settlement replay rejection across API restarts including fleet charters, supply-chain runs, owned-business shifts/acquisition, cargo delivery, household item resale and obligation cycles, conductor co-op and Creator Studio commissions, sandbox reward redemptions, property/labour state, and API restart recovery, plus malformed snapshot startup failure. `npm test` (19 suites / 52 top-level tests), `npm run verify:phase1`, and `npm run verify:prod-readiness` also pass.

**Production Readiness Hardening Increment (22 October 2026):**
- **Telemetry & Payout Fail-Closed Hardening:** Removed hardcoded prototype HMAC secret in `packages/telemetry/src/index.ts` (enforcing `PROJECT_EKO_EVIDENCE_HMAC_KEY` >= 32 chars in production), added one-time evidence consumption (`verifyAndConsumeEvidence`), and removed fabricated `PAID` completions from `services/payouts/src/index.ts` (`executePayout` now fails closed to `ON_HOLD` / `killSwitchBlocked: true` unless settled via an HMAC-verified provider webhook).
- **Security Headers, Origin-Allowlist CORS & Dynamic Config:** Replaced wildcard `Access-Control-Allow-Origin: *` across Game, API, and Realtime services with `PROJECT_EKO_CORS_ORIGINS` allowlist + strict security headers, added `/config.js` runtime endpoint discovery, and enforced a `256 KB` payload ceiling (`413 PAYLOAD_TOO_LARGE`).
- **Identity, Privacy & Staff RBAC:** Removed URL query-string (`?sessionToken=`) and request-body token fallbacks (`400 SESSION_TOKEN_IN_URL_FORBIDDEN`), added under-13 registration rejection (`403 AGE_REQUIREMENT_NOT_MET`), session listing/revocation (`/api/v1/auth/sessions`, `/api/v1/auth/logout`), auth rate limiting (`429 AUTH_RATE_LIMIT_EXCEEDED`), NDPA/GDPR privacy export/consent-withdrawal/account-deletion (`/api/v1/privacy/*`), and staff RBAC + audit logs (`/api/v1/ops/moderation/*`).
- **Database Schema & Adapter (`services/api/src/dbAdapter.ts`):** Expanded `infra/database/001_initial_schema.sql` to 20 canonical PostgreSQL domain tables + `verify_ledger_transaction_balanced` trigger, and wired `ProductionDatabaseAdapter` with ACID WAL transactions and SHA-256 verified backup snapshots (`/api/v1/db/status`, `/api/v1/db/backup`).
- **Authoritative Realtime Movement, Zone Persistence & Co-op Checkpoint Tokens:** Added `AntiCheatValidator.validateMovementStep` and speed/teleport rejection (`422 MOVEMENT_PLAUSIBILITY_REJECTED`) to `/vehicles/sync-transform`, atomic zone state persistence (`zone_state_store.json`) surviving Realtime worker restarts, and server-signed `checkpointToken` issuance in `/coop/danfo/board-stop` verified by `/api/v1/multiplayer/coop-danfo/settle`.

- **Sequential Checkpoint Enforcement Before Reward Settlement:** Job shifts (`startActiveJobShift` -> `advanceActiveJobCheckpoint` -> `completeJobShift`), EkoGuide action buttons (`completeJobGameplayStep`, `claimJobSettlementStep`, `completeTaxiFareStep`), passenger trips (`boardSisterBlessingIntoVehicle` -> `concludeTripSuccess`), M47 onboarding progression (`JobTaskCompleted`, `JobSettlementPosted`), and 9-class fleet charters (`/api/v1/fleet/dispatch-or-charter`) enforce strict sequential checkpoint completion in order before crediting any reward.

**Still outstanding:** Replace JSON snapshots with a live PostgreSQL driver connection in production environments; account-scope household/world ownership and remaining fleet and economic simulation state; complete transaction/idempotency handling across all domain mutations; and verify worker restart recovery. Vehicle inventory is account-bound in the profile, while broader fleet and world interactions still need a complete ownership model. The current local runtime has no external PostgreSQL server configured, so this increment deliberately does not claim live external PostgreSQL-backed domain state or Phase 2 completion.

**Exit criteria:** State survives API and zone-worker restarts; duplicate requests remain idempotent; ledger reconciliation is clean; runtime services use the schema rather than parallel in-memory sources of truth.

## Phase 3 — Multiplayer and zone acceptance

Connect player sessions to authoritative zone state, secure movement and occupancy mutations, and demonstrate the blueprint's 32–64-player zone target with latency, disconnect and recovery measurements.

**Exit criteria:** Two or more authenticated clients see and interact with each other; movement and cooperative rewards derive from zone state; load evidence covers target concurrency and recovery cases.

## Phase 4 — Expand the Lagos world

Extend the current Marina/CMS slice into a connected 3–4-district transport alpha, using the location bible and rights-aware geographic data. Prioritise transit links, routes, landmarks and economic activities that create repeatable loops.

**Exit criteria:** Multiple districts are playable and connected; transport modes and vehicle lane rules are valid across district boundaries; asset/geodata provenance is recorded.

## Phase 5 — Complete careers and enterprise loops

Close the gaps between jobs, skills, licences, household progression, business operations, supply chains and fleet management. Tune Game Naira sources and sinks using observed simulation data.

**Exit criteria:** At least one complete worker-to-owner progression path is playable end to end; each implemented mini-game affects a career or enterprise outcome; economic sources and sinks reconcile.

## Phase 6 — Reward pilot, only after external approval

Keep fiat payout disabled until Nigerian counsel and a licensed provider confirm the exact model. Then complete signed evidence, deterministic replay, campaign budgets, KYC/age checks, manual review, payout reconciliation and kill switches.

**Exit criteria:** Written legal/provider approvals; closed sponsor-funded pilot; no Game Naira conversion; idempotent provider settlement and audit reconciliation.

## Phase 7 — Closed alpha and launch readiness

Establish operational monitoring, moderation workflows, privacy and retention controls, mobile/performance budgets, analytics and measured player retention before public launch or city expansion.

**Exit criteria:** Blueprint stability, moderation, retention, fraud and economy-health targets are measured and met; release gates have named owners and evidence.

## Working rule

Work proceeds in order. A phase can contain smaller reviewable increments, but it is not marked complete until its exit criteria have implementation evidence. Legal and provider decisions are tracked as external blockers, not simulated in code.
