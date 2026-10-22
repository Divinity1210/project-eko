# PROJECT EKO — M4.7 GUIDED GAMEPLAY, MULTIPLAYER & PROGRESSION ENGINE
## Delivery & Verification Report

**Date**: 2026-10-20  
**Milestone**: M4.7 — Guided Gameplay, Multiplayer & Progression Engine  
**Product Promise**: **LIVE. DRIVE. BUILD. EARN.**

---

## 1. Phase 0 Implementation Audit Summary

Prior to implementing M4.7, a comprehensive code-level audit of the repository (`apps/game/index.html`, `services/api/src/server.ts`, `services/realtime/src/server.ts`, `packages/economy/src/index.ts`, `packages/world/src/index.ts`, and `scripts/run_all_tests.js`) was executed and documented in [`ANTIGRAVITY/DELIVERY/M4_7_IMPLEMENTATION_AUDIT.md`](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/M4_7_IMPLEMENTATION_AUDIT.md).

| Audit Question | Pre-M4.7 State | M4.7 Delivered Resolution |
| :--- | :--- | :--- |
| **1. Real registration & login** | Seeded in-memory accounts only (`usr_eko_hustler_01`, `usr_eko_driver_02`); no registration/login endpoints or session tokens. | Implemented `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/session`, `/api/v1/auth/recovery`, password hashing (`scryptSync`), uniqueness & moderation checks, privacy consent, and zero-payment disclosure. |
| **2. Guest accounts & safe promotion** | None existed. | Implemented `/api/v1/auth/guest` and `/api/v1/auth/promote-guest`, preserving `accountId`, Game Naira ledger history, starter home, inventory, and objective progress upon promotion. |
| **3. Player profile persistence** | Browser `localStorage` only (`__PROJECT_EKO_MASTER_BIBLE_V1__`); server RAM wiped on process restart. | Implemented disk-backed server state persistence (`services/api/data/m4_7_persistent_store.json`) synchronized with client session storage across reloads and new browser sessions. |
| **4. Objectives stored vs rendered** | Linear 6-stage client-only banner (`M464PlayableFlowGuide`); no prerequisite evaluation or blocker detection. | Implemented data-driven 15-objective `EkoGuide` engine (`services/api/src/m47Engine.ts` + `EkoGuideEngine` in `apps/game/index.html`) persisted on server and client. |
| **5. Simulated NPCs vs live humans** | Ambient NPCs and multiplayer bots shared a single peer list with no entity kind distinction. | Enforced explicit `entityKind`: `HUMAN_PLAYER` vs `SIMULATED_NPC` vs `AI_WORKER` in `services/realtime/src/server.ts` and `EkoMultiplayerEngine`. Simulated NPCs are never counted as online human players. |
| **6. Live human shared realtime zone** | Single-user bot simulation in `services/realtime/src/server.ts`. | Upgraded `zone_marina_cms` (`:3002`) with multi-user human presence, spatial interest culling (`180m`), proximity interaction (`15m`), moderated chat, Crews, and Cooperative Danfo routes. |
| **7. Hustle Flow multiplier rules** | Static `1.25x` UI badge; no decay, collision penalty, or currency cap separation. | Implemented standalone `EkoHustleFlowEngine` (`1.0x` default, `3.0x` arcade score cap, `2.0x` Hustle Coin cap, `1.0x` normal Game Naira wages/passive income/real rewards, inactivity decay, collision/missed-stop penalties). |
| **8. Trusted game events & persistence** | Event payouts scattered across endpoints without a unified event bus. | Implemented idempotent `EkoQuestEventBus` with `processedEventIds` deduplication and authoritative double-entry ledger settlement. |

---

## 2. Onboarding and Authentication Flow

Implemented in [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts) and `EkoAuthAndOnboardingSystem` in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html):

- **Entry Screen (`#m47-auth-modal`)**:
  - **Start Your Journey (Quick Guest Entry — Promotable)** (`POST /api/v1/auth/guest`)
  - **Create Citizen Account** (`POST /api/v1/auth/register`)
  - **Log In to Existing Account** (`POST /api/v1/auth/login`)
- **Explicit Zero-Payment & Value Disclosure**:
  - Clearly states that an account enables saved progress across sessions, 3D starter home persistence, authoritative Game Naira ledger auditing, and live multiplayer crews, and that **zero payment information is required to play**.
- **Modern Form Standards & Validation**:
  - Uses proper `autocomplete="username"`, `autocomplete="email"`, `autocomplete="new-password"`, and `autocomplete="current-password"` attributes, plus CSS `:user-invalid` / `:user-valid` selectors so validation styling appears only after user interaction.
- **Safe Guest-to-Registered Promotion (`POST /api/v1/auth/promote-guest`)**:
  - Upgrades an introductory guest session to a permanent account in-place, preserving `accountId`, `gameNairaBalance`, `completedObjectiveIds`, and starter home state.
- **Returning Player Auto-Restore (`GET /api/v1/auth/session`)**:
  - Automatically restores the player's profile, Game Naira balance, and current `EkoGuide` objective without restarting onboarding.

---

## 3. Starter Profile and First-Day Progression Flow

Character creation (`POST /api/v1/auth/character`) guides the player through:
1. **Character Appearance**: Body build, skin tone, hairstyle, starter attire preset, and accent color.
2. **Display Name**: Enforces 3–24 character format (`^[A-Za-z0-9_.-]{3,24}$`), moderation blocklist filtering, and case-insensitive uniqueness across all accounts.
3. **5 Canonical Starter Profiles** (from `EkoLifeSystem.starterProfilesCatalog`):
   - `profile_new_arrival` — **New Arrival in Lagos** (Tier 0 Shared Compound Room, `₦5,000 GN` opening grant, Mobility & Transport track, Foot Courier / Bus-Stop Caller entry work).
   - `profile_early_career` — **Young Worker / Early Career** (Tier 2 Self-Contained Studio, `₦5,000 GN` opening grant, Commerce & Market Trade track).
   - `profile_student_learner` — **Student / Skill Learner** (Tier 0 Shared Compound Room Yaba, `₦5,000 GN` opening grant, Civic & Community Services track).
   - `profile_skilled_trade` — **Skilled Trade Starter** (Tier 1 Improved Courtyard Room, `₦5,000 GN` opening grant, Skilled Trades & Mechanics track).
   - `profile_creator_remote` — **Creative / Remote Hustler** (Tier 1 Improved Courtyard Room Yaba, `₦5,000 GN` opening grant, Creative Media & Tech track).
4. **Transparent Starting Summary**: Explains the player's walkable 3D starter home, `₦5,000 GN` opening ledger balance, and immediate no-vehicle entry-level work (`+₦500 GN` net per shift).
5. **Confirmation & Arrival**: Places the player in Marina / CMS with their starter home unlocked and `obj_04_discover_enter_home` queued in `EkoGuide`.

### 15-Step First-Day Onboarding Objective Chain
1. `obj_01_register_or_guest` — Complete Registration or Guest Entry (`+10 XP`)
2. `obj_02_create_character` — Create Your Lagos Character (`+15 XP`)
3. `obj_03_claim_starter_profile` — Claim Starter Profile & `₦5,000 GN` (`+15 XP`)
4. `obj_04_discover_enter_home` — Discover & Enter Your 3D Starter Home (`+20 XP`)
5. `obj_05_use_home_object` — Interact with a Household Object (`+20 XP`)
6. `obj_06_inspect_needs` — Inspect Your 8 Canonical Needs (`+15 XP`)
7. `obj_07_open_jobshub` — Open JobsHub & View Entry Work (`+15 XP`)
8. `obj_08_accept_entry_job` — Accept a Qualifying No-Vehicle Job (`+20 XP`)
9. `obj_09_reach_job_location` — Reach the Active Job Checkpoint (`+25 XP`)
10. `obj_10_complete_job_gameplay` — Complete Job Shift Checkpoints (`+40 XP`)
11. `obj_11_receive_job_settlement` — Receive Authoritative Game Naira Settlement (`+₦500 GN` ledger wage + `+30 XP`)
12. `obj_12_visit_shop` — Visit the Household & Necessities Shop (`+15 XP`)
13. `obj_13_buy_affordable_item` — Buy an Eligible Affordable Item (`+25 XP`)
14. `obj_14_place_and_use_item` — Place & Use the Item at Home (`+35 XP`)
15. `obj_15_verify_persistent_progress` — Return Home & Verify Persistent Progress (`+100 XP` + `+₦250 GN` milestone bonus)

---

## 4. EkoGuide Decision Logic and Objective Schema

Implemented in `evaluateEkoGuide()` in [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts) and `EkoGuideEngine` in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html):

- **Canonical Objective Schema (`CanonicalObjectiveDefinition`)**:
  - Includes `objectiveId`, `stepNumber`, `name`, `description`, `whyItMatters`, `prerequisites` (`minLevel`, `requiredObjectiveIds`, `requiresVehicle`, `minBalanceGN`, `requiredCareerTrack`), `triggeringEvents`, `progressTarget`, `completionCriteria`, `reward` (`gameNaira`, `xp`, `skillId`, `skillPoints`, `reputationDelta`), `optionalBranchObjectiveId`, `destination` (`zoneId`, `label`, `x`, `z`, `interactionTargetId`), `contextualHelp`, `failureRecovery`, `repeatable`, `accessibility`, and `analyticsStage`.
- **Priority & Suppression Rules**:
  - **Driving Suppression**: When `isDriving === true`, `EkoGuide` automatically suppresses unrelated home/shopping tutorials (`suppressedUnrelatedTutorial: true`) and displays a compact route-focus bar.
  - **Home Context Preference**: When `inHome === true` and Energy/Hunger/Comfort are low, `EkoGuide` prioritizes household restoration actions.
  - **No-Vehicle Progression Guarantee**: Vehicle ownership is never required for onboarding or Tier 1–2 non-driving career progression.
  - **Single Primary Objective + Up to 2 Secondary Suggestions**: Never issues conflicting primary objectives simultaneously.
  - **Skip & Replay Controls**: Players can skip or replay the onboarding chain at any time via `/api/v1/ekoguide/tutorial-control` or the `"What should I do next?"` modal.

---

## 5. Quest and Objective Event Bus

Implemented via `processTrustedGameplayEvent()` in [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts) and `EkoQuestEventBus` in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html):

- **Supported Trusted Events**:
  - `AccountRegistered`, `CharacterCreated`, `StarterProfileSelected`, `HomeEntered`, `HomeExited`, `HouseholdObjectUsed`, `NeedsInspected`, `JobsHubOpened`, `JobAccepted`, `JobLocationReached`, `JobTaskCompleted`, `JobSettlementPosted`, `ShopVisited`, `ItemPurchased`, `ItemPlaced`, `HomeProgressVerified`, `DanfoRunCompleted`, `CrewJoined`, `MultiplayerCoopCompleted`, `ObjectiveCompleted`, `ObjectiveBlocked`.
- **Strict Idempotency**:
  - Every event carries a unique `eventId`. Both `account.onboarding.processedEventIds` and the server-wide `processedEventIds` set reject duplicate event submissions (`duplicateIgnored: true`, `rewardsGranted: []`), preventing duplicate UI events or network retries from ever double-crediting Game Naira or XP.

---

## 6. Blocker Explanation and Recovery Guidance

When a player attempts an unavailable or gated action (e.g., selecting a commercial Danfo driving shift without a vehicle, attempting to buy an item exceeding their Game Naira balance, or placing furniture on an occupied coordinate):
- `EkoGuide` records a structured `blockerExplanation` (`blockedItemOrAction`, `reason`, `legitimateAlternative`, `recoveryActionLabel`, `recoveryTargetId`).
- The compact `#m47-ekoguide-hud` and `#m47-ekoguide-modal` display the exact blocker reason and a one-click **Recovery Action** button (such as starting a no-vehicle Foot Courier shift for `+₦500 GN`).

---

## 7. Multiplayer Architecture, Sync Rules and Live Test Proof

Implemented in [`services/realtime/src/server.ts`](file:///Users/divinity/Documents/Project%20Eko/services/realtime/src/server.ts) and `EkoMultiplayerEngine` in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html):

- **Strict Entity Classification**:
  - Every zone entity carries `entityKind`:
    - `'HUMAN_PLAYER'` — Authenticated live human user session.
    - `'SIMULATED_NPC'` — Ambient Lagos characters (`Chidi_Transporter`, `Bayo_Keke`, `Ifeoma_Trader`).
    - `'AI_WORKER'` — Autonomous fleet/market background workers (`EkoTransit_Bot_01`, `Marina_Courier_AI_02`).
  - `/api/v1/zone/state` and `/api/v1/zone/summary` report `onlineHumanCount`, `simulatedNpcCount`, and `aiWorkerCount` separately and assert `simulatedNpcsCountedAsHumans: false`.
- **Authoritative Zone State & Interest Management**:
  - Spatial interest radius culling (`180m`) filters distant peer payloads while keeping nearby human players (`<= 15m` proximity interaction radius) discoverable.
- **Disconnect, Reconnect & Stale Session Protection**:
  - Reconnecting with a newer `sessionToken` supersedes the prior socket/session token (`SUPERSEDED_BY_NEW_SESSION`), rejecting stale session writes while restoring the player's last authoritative coordinates and role.
- **Safety & Moderation Controls**:
  - Enforces chat message length limits (`<= 180` chars), rate-limiting (`600ms` cooldown), prohibited content filtering, per-player block/mute lists (`/api/v1/zone/block`), and abuse reporting (`/api/v1/zone/report`).

---

## 8. Cooperative Danfo Driver + Conductor Validation

Implemented across [`services/realtime/src/server.ts`](file:///Users/divinity/Documents/Project%20Eko/services/realtime/src/server.ts) (`/api/v1/zone/coop-danfo/*`) and [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts) (`/api/v1/multiplayer/coop-danfo/settle`):

1. **Driver Session Creation (`/api/v1/zone/coop-danfo/create`)**:
   - `Player A` creates a Cooperative Danfo session on `route_cms_tbs_loop` as `DRIVER`.
   - **Pre-Start Guard**: Attempting to call `/api/v1/zone/coop-danfo/start` before a second live human joins as `CONDUCTOR` fails closed (`400 Bad Request: Cannot start Cooperative Danfo route until both DRIVER and CONDUCTOR human roles are filled`).
2. **Conductor Join (`/api/v1/zone/coop-danfo/join`)**:
   - `Player B` joins as `CONDUCTOR` with an explicit `60% Driver / 40% Conductor` net pool split contract.
   - **Zero Join Reward**: Joining a vehicle grants `₦0 GN`.
3. **Server-Validated Stop Boarding (`/api/v1/zone/coop-danfo/board-stop`)**:
   - Validates all 3 canonical corridor stops (`stop_cms_terminal` → `stop_marina_jetty` → `stop_tbs_east_gate`), boarding 14 passengers (`₦4,200 GN` gross fares, `₦300 GN` corridor levy, `₦3,900 GN` net pool). Duplicate stop boarding is rejected.
4. **Authoritative Double-Entry Settlement (`/api/v1/multiplayer/coop-danfo/settle`)**:
   - Settles the completed run idempotently in the double-entry ledger:
     - **Driver (60%)**: `+₦2,340 GN` (`txId` recorded)
     - **Conductor (40%)**: `+₦1,560 GN` (`txId` recorded)
   - Re-submitting the same `coopSessionId` returns the existing settlement receipt without double-paying.

---

## 9. EkoProgress and Career Unlock Map

Implemented in `buildEkoProgressMap()` in [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts) (`GET /api/v1/ekoprogress`) and `EkoProgressSystem` in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html):

- Displays current career track, active life goal, Citizen Level, XP, Reputation, 8 canonical skills, achievements, unlocked opportunities (including 5 Day-1 no-vehicle jobs), and locked Tier 2 opportunities.
- Every locked opportunity includes both **Non-Driving Career Paths** (Balogun Senior Retail Stall Supervisor, Surulere Certified Diagnostic Technician, Yaba Digital Studio Contract Producer) and **Driving Career Paths** (Commercial Danfo Corridor Captain) with a human-readable `lockExplanation` detailing exact level, shift count, skill, reputation, and equipment prerequisites.

---

## 10. Hustle Flow Multiplier Rules and Economy Protection

Implemented in `HustleFlowSessionEngine` in [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts) and `EkoHustleFlowEngine` in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html):

| Parameter / Rule | Canonical Value | Enforcement |
| :--- | :--- | :--- |
| **Default Multiplier** | `1.0x` | Initialized at `1.0x` for every session. |
| **Max Arcade Score Multiplier** | `3.0x` | Capped at `3.0x` during active Danfo Hustle / Skill runs. |
| **Max Eko Hustle Coin Multiplier** | `2.0x` | Capped at `min(2.0, 1.0 + (scoreMultiplier - 1.0) * 0.5)`. |
| **Normal Game Naira Wages** | `1.0x` (Fixed) | Standard job wages (`+₦500 GN`) are never inflated by arcade multipliers. |
| **Passive Business Yields** | `1.0x` (Fixed) | Passive/property income is never multiplied by Hustle Flow. |
| **Real-World Reward Conversion** | `0.0x` / `1.0x` (Gated) | Never inflates real-world reward conversion. |
| **Build Events** | `+0.20x` to `+0.35x` | Clean stop boarding, hazard avoidance, golden coin streak, route checkpoint. |
| **Penalties** | `-0.60x` / `-0.45x` / `-0.35x` | Collision (`-0.60x`), missed stop (`-0.45x`), off-route violation (`-0.35x`). |
| **Inactivity Decay** | `-0.10x/sec` after `8s` | Automatically decays toward `1.0x` when no valid action occurs. |
| **Anti-Exploit Deduplication** | `processedActionIds` | Rejects duplicate `actionEventId` / `runId` payloads. |
| **Contextual HUD Chip** | `#m47-hustle-flow-chip` | Shown only during active arcade/hustle runs; hidden inside home interiors, shops, and EkoAtlas. |

---

## 11. Mobile Guidance and HUD Discipline

- **Compact Next Step Panel (`#m47-ekoguide-hud`)**:
  - Respects `env(safe-area-inset-*)` and responsive portrait (`390x844`) / landscape (`844x390`) breakpoints with zero overlap against the top status bar, minimap, or bottom touch controls.
  - Supports one-tap minimise (`—` / `▲`) so players can collapse the guide to a single slim bar at any time.
- **Context-Aware Touch Labels**:
  - Hooks into `EkoInputPrompts` so touch devices see `"Tap: Enter 3D Starter Home"` instead of keyboard key hints.

---

## 12. Funnel Analytics and Dashboard Specification

Implemented in [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts) (`GET /api/v1/analytics/funnel` and `POST /api/v1/analytics/event`):

- **16 Tracked Player Journey Stages**:
  1. `01_landing_view`
  2. `02_auth_started`
  3. `03_auth_completed`
  4. `04_character_created`
  5. `05_starter_profile_selected`
  6. `06_home_entered`
  7. `07_home_object_used`
  8. `08_needs_inspected`
  9. `09_jobshub_opened`
  10. `10_first_job_accepted`
  11. `11_first_job_completed`
  12. `12_first_wage_settled`
  13. `13_shop_visited`
  14. `14_first_item_purchased`
  15. `15_first_item_placed`
  16. `16_day_one_onboarding_completed`
- **Dashboard Specification & KPIs Returned by `/api/v1/analytics/funnel`**:
  - `stageCounts` and `stageConversionRatesPct` across all 16 stages.
  - `averageTimeToFirstMeaningfulActionMs` (TTFMA) and `averageTimeToFirstEarnedGameNairaMs` (TTFGN).
  - `topBlockedObjectives` frequency breakdown.
  - `privacyCompliance` assertion (`piiStoredInAnalytics: false`, `paymentInfoRequired: false`).

---

## 13. Automated and Browser Test Results

1. **Master Unit & Integration Suite (`node scripts/run_all_tests.js`)**:
   - **49 PASSED | 0 FAILED** across Suites 1–18 (including Suite 18 testing M4.7 Auth, Guest Promotion, 5 Starter Profiles, 15-Step `EkoGuide` Chain, Blocker Recovery, Idempotent Quest Event Bus, Multiplayer Human vs Simulated NPC Separation, Cooperative Danfo 60%/40% Split, `EkoProgress` Map, and Standalone `EkoHustleFlowEngine`).
2. **Multi-Session Headless Chrome & Live Services Acceptance Suite (`node scripts/verify_m4_7_guided_multiplayer_progression.js`)**:
   - **23 PASSED | 0 FAILED**, verifying two simultaneous authenticated human sessions (`Player A` and `Player B`) in `zone_marina_cms`, proximity interaction, chat moderation, Crew creation, Cooperative Danfo Driver + Conductor 3-stop run and 60%/40% double-entry settlement, disconnect/reconnect/stale-session rejection, mobile portrait HUD bounds, and full page reload persistence.
   - Machine-readable results saved to [`m4_7_acceptance_results.json`](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_7_acceptance_results.json).

---

## 14. Remaining Known Limitations

- **Local Development Persistence Store**: `services/api/src/m47Engine.ts` persists accounts, sessions, onboarding progress, and ledger state to `services/api/data/m4_7_persistent_store.json` so state survives server restarts in local/staging environments; production deployment targets managed PostgreSQL + Redis as defined in `infra/db/schema.sql`.
- **WebSocket Fallback Polling**: In restricted browser environments where raw WebSocket upgrades are proxied, `EkoMultiplayerEngine` seamlessly falls back to HTTP zone synchronization (`/api/v1/zone/join`, `/api/v1/zone/move`, `/api/v1/zone/state`) against the same authoritative `zone_marina_cms` state on `:3002`.
