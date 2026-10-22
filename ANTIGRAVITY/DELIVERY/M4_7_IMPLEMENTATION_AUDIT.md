# PROJECT EKO — M4.7 IMPLEMENTATION AUDIT

**Date**: 2026-10-20  
**Scope**: Audit of existing Project Eko repository (`services/api/src/server.ts`, `services/realtime/src/server.ts`, `apps/game/index.html`, world registry, authentication, multiplayer transport, quests, career state, economy ledger, reward systems, and automated test suites) prior to M4.7 Guided Gameplay, Multiplayer & Progression Engine implementation.

---

## 1. Executive Summary of Pre-M4.7 Truth Matrix

| Audit Area | Pre-M4.7 Implementation Status | Gap Identified | M4.7 Action Plan |
| :--- | :--- | :--- | :--- |
| **1. Registration & Login** | **NOT IMPLEMENTED** (Hardcoded `demoPlayer` / `usr_eko_hustler_01`) | No `/api/v1/auth/register`, `/api/v1/auth/login`, or session token validation existed. | Implement real account registration, login, password hashing, session tokens, account recovery, and consent/privacy disclosure. |
| **2. Guest Accounts & Promotion** | **NOT IMPLEMENTED** | No guest account creation or safe guest-to-registered promotion endpoint existed. | Implement `/api/v1/auth/guest` and `/api/v1/auth/promote-guest` preserving profile, home, inventory, objectives, and Game Naira ledger history. |
| **3. Player Profile Persistence** | **PARTIAL** (`localStorage` + volatile server memory) | Client stored `__PROJECT_EKO_MASTER_BIBLE_V1__` in `localStorage`, while server used in-memory `demoPlayer` and `__MASTER_BIBLE_STATE__`. | Add per-user disk-backed persistent store (`services/api/data/m4_7_persistent_store.json`) synchronised with authenticated sessions and `localStorage`. |
| **4. Objectives Storage vs Rendering** | **CLIENT-ONLY STAGE INDEX** | `apps/game/index.html` rendered a 5-stage client banner (`__PROJECT_EKO_OBJECTIVE__`), not a canonical objective engine backed by server-persisted records. | Build **EkoGuide Next-Best-Action Engine** with canonical objective definitions, prerequisites, blockers, 15-step onboarding chain, and server-persisted objective state. |
| **5. Simulated NPCs vs Named Characters** | **MIXED WITHOUT DISCRIMINATOR** | `services/realtime/src/server.ts` seeded `peer_chidi_01` (`Chidi_Transporter`), `peer_bayo_02` (`Bayo_Keke`), and `peer_ifeoma_03` (`Ifeoma_Trader`) directly into `zonePlayers` alongside human `/presence` heartbeats. | Tag every entity with explicit `entityKind`: `'HUMAN_PLAYER'`, `'SIMULATED_NPC'`, or `'AI_WORKER'`. Never count NPCs as online human users. |
| **6. Live Human Multiplayer Zone** | **FOUNDATIONAL TRANSPORT ONLY** | `services/realtime/src/server.ts` supported HTTP `/presence` and `/zones/zone_marina_cms` polling, plus a mock client `switchCoopRole` UI, but lacked two-account auth identity, spatial interest filtering, crew invites, server-verified Co-op Danfo route stops, and reconnect/duplicate-session guards. | Upgrade realtime & API servers for multi-user authenticated sessions, spatial interest management, crew system, cooperative Driver + Conductor Danfo route verification, and 60%/40% authoritative ledger split. |
| **7. Hustle Flow Multiplier Rules** | **PARTIAL / UNCONSTRAINED CLIENT LOGIC** | `addHustleStreak(pts)` allowed up to `5.0x` multiplier, lacked inactivity decay and collision penalties, and multiplied EkoRide fares (`15487`) and conductor calls (`17672`). | Build standalone, server-validated `EkoHustleFlowEngine` (`1.0x` default, `3.0x` arcade score cap, `2.0x` Hustle Coin cap, `1.0x` on normal wages/business yields/real rewards, configurable inactivity decay, collision/missed-stop penalties, and anti-exploit idempotency). |
| **8. Currency & Progression Events** | **PARTIAL LEDGER + NO QUEST EVENT BUS** | Double-entry ledger (`postDoubleEntry` / `postMasterLedgerEntry`) settled jobs and shop purchases, but lacked a unified, idempotent quest progression-event bus. | Implement shared `EkoQuestEventBus` (`POST /api/v1/progression/event`) handling 16 canonical event types with unique `eventId` deduplication. |
| **9. Reload & Multi-Session Survival** | **SINGLE-USER LOCALSTORAGE ONLY** | Reload preserved client state in the same browser via `localStorage`, but logging into a new session or restarting the API lost server state. | Persist accounts, profiles, homes, inventory, ledger, objectives, and analytics to disk on the API server and restore automatically on returning login/session resume. |

---

## 2. Detailed Codebase Inspection Findings

### 2.1 Authentication, Guest Accounts & Starter Profiles
- **Inspected Files**: `services/api/src/server.ts` (`lines 25–46`, `2280–2310`), `apps/game/index.html` (`lines 15050–15210`).
- **Findings**:
  - `services/api/src/server.ts` initialized a single hardcoded `demoPlayer` (`id: 'usr_eko_hustler_01'`, `handle: 'Amaka_Driver'`).
  - No authentication routes (`/api/v1/auth/*`) or character creation routes (`/api/v1/character/create`) existed.
  - However, the **five canonical starter profiles** ARE defined in `services/api/src/server.ts` (`lines 2283–2289`):
    1. `profile_new_arrival` — *"New Arrival in Lagos"*, `home_tier0_shared_room`, `5000` GN, `career_mobility_transport`, `goal_first_danfo`.
    2. `profile_early_career` — *"Young Worker / Early Career"*, `home_tier2_self_con_studio`, `5000` GN, `career_commerce_market`, `goal_first_shop`.
    3. `profile_student_learner` — *"Student / Skill Learner"*, `home_tier0_shared_room`, `5000` GN, `career_civic_community`, `goal_self_con_upgrade`.
    4. `profile_skilled_trade` — *"Skilled Trade Starter"*, `home_tier1_improved_room`, `5000` GN, `career_skilled_trades_utilities`, `goal_reliable_daily_car`.
    5. `profile_creator_remote` — *"Creative / Remote Hustler"*, `home_tier1_improved_room`, `5000` GN, `career_creative_media_culture`, `goal_first_digital_studio`.

### 2.2 Player Profile & Objective Persistence
- **Inspected Files**: `services/api/src/server.ts` (`lines 160–248`, `2530–2795`), `apps/game/index.html` (`lines 3238–3510`, `15060–15180`).
- **Findings**:
  - Client state (`needs`, `placedFurniture`, `ownedFurniture`, `wearableEquipped`, `completedJobsCount`, `balanceGN`) persisted in browser `localStorage` under `__PROJECT_EKO_MASTER_BIBLE_V1__`.
  - First-day guidance (`__PROJECT_EKO_OBJECTIVE__`) was a 5-stage client-only banner (`stage 1..5`) in `apps/game/index.html` (`lines 3360–3508`). It did not store canonical objective records on the server or evaluate dynamic blockers, career goals, or multi-branch alternatives.

### 2.3 Simulated NPCs vs Live Human Players & Realtime Transport
- **Inspected Files**: `services/realtime/src/server.ts` (`lines 1–209`), `services/api/src/server.ts` (`lines 1072–1128`), `apps/game/index.html` (`lines 17620–17760`).
- **Findings**:
  - **Simulated Ambient Peers in Realtime Server (`services/realtime/src/server.ts` lines 11–43)**:
    - `peer_chidi_01` (`Chidi_Transporter`, `veh_danfo_yellow`)
    - `peer_bayo_02` (`Bayo_Keke`, `veh_keke_yellow`)
    - `peer_ifeoma_03` (`Ifeoma_Trader`, `on_foot`)
    - These three simulated peers were stored in the same `zonePlayers` Map as real `/presence` heartbeats and included in `playerCount` without an `entityKind` flag.
  - **Simulated Street NPCs in Client (`apps/game/index.html`)**:
    - `Mama Put (Food Vendor)`, `Bola (Dispatch Supervisor)`, `Chief Ade (Depot Manager)`, `Iya Basira (Market Matron)`, `Kemi (Tech Hub Coordinator)`, `Sola (Commuter)`.
  - **Simulated AI Workers (`services/api/src/server.ts` lines 2500–2525)**:
    - `npc_driver_tunde` (`Tunde (Assigned Driver)`) and `npc_rider_segun` (`Segun (Dispatch Rider)`).
  - **Co-op Danfo Mode (`apps/game/index.html` lines 17655–17695)**:
    - Previously used a client-side simulated partner (`Tunde_Coop`) and client-side `balanceNaira += callBonus` when pressing `conductorCallAction()`. In M4.7, cooperative Danfo must support two real authenticated human accounts (Driver + Conductor) with server-validated stop boardings and a balanced 60%/40% net pool settlement in the authoritative Game Naira ledger.

### 2.4 Hustle Flow Multiplier Audit
- **Inspected Files**: `apps/game/index.html` (`lines 15480–15505`, `15780–15800`, `17670–17680`).
- **Findings**:
  - `addHustleStreak(pts)` computed `hustleMultiplier = Math.min(5.0, +(1.0 + Math.floor(hustleStreak / 3) * 0.5).toFixed(1))`.
  - **Violations of M4.7 Rules Found**:
    1. Cap was `5.0x` instead of `3.0x` (arcade score) and `2.0x` (Eko Hustle Coins).
    2. It multiplied normal EkoRide trip earnings (`Math.round(activeTrip.fare * hustleMultiplier)`) and client-side conductor calls, whereas M4.7 specifies that **normal wages, business yields, and real-world rewards are NOT multiplied (`1.0x`)**.
    3. It had no inactivity decay timer, no collision/missed-stop penalty reduction, no server-side validation, and remained visible on the HUD even in modes where Hustle Flow does not apply.

### 2.5 Events That Award Currency or Progression
- **Inspected Files**: `services/api/src/server.ts` (`lines 420–620`, `2810–3550`).
- **Findings**:
  - Authoritative ledger settlements (`postDoubleEntry` / `postMasterLedgerEntry`) exist for:
    - Starter profile grant (`₦5,000 GN` from `SYS_TREASURY_MINT`)
    - Entry-level and career jobs (`POST /api/v1/jobs/complete` with checkpoint token verification and idempotency key)
    - Danfo bus-stop payouts and end-of-shift settlements (`POST /api/v1/danfo/stop-payout`, `POST /api/v1/missions/complete`)
    - Household & market purchases (`POST /api/v1/homes/furniture/buy`, `POST /api/v1/market/buy`)
    - Business operations and AI worker shifts (`POST /api/v1/businesses/operate`, `POST /api/v1/ai-workers/run-shift`)
  - Client-only `balanceNaira += ...` calls in `conductorCallAction` and unverified arcade loops must be replaced or gated by server-verified endpoints with idempotency protection.
