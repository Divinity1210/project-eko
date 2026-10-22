# PROJECT EKO — M4.7 END-TO-END PLAYER JOURNEY & GAME FLOW
## Phase 0: Root Cause & State-Management Audit (`M4_7_GAMEFLOW_ROOT_CAUSE_AUDIT.md`)

**Date**: 2026-10-20  
**Scope**: Complete code trace of signup/login, character creation, starter profile, starter home, wardrobe/clothing, needs, EkoGuide, objective state, JobsHub, work shifts/checkpoints, Game Naira settlement, shops, and persistence across [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html) and [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts).

---

## 1. Exact Reproduction & Diagnosis of the Supplied Screenshot

In the supplied screenshot (`media_1792522041069_7b00bdf1.png`), a guest user (`Guest_Lagos_8326`) is standing at a work checkpoint (`Marina Bukka Prep & Counter Helper — Step 3/3`) while **four independent, uncoordinated UI/state systems** render competing instructions and balances simultaneously:

| Visible Element in Screenshot | Owning System & Code Location | Competing State Shown | Why It Happened |
| :--- | :--- | :--- | :--- |
| **Top-Center Pill (`#mission-hud-banner`)** | `updateObjectiveTrackerHUD()` & `resolveActiveObjectiveSpec()` (`apps/game/index.html:4211`, `16180–16353`) | `💼 ACTIVE SHIFT STEP 3/3` + 6-stage stepper (`1.🏠 2.🛍️ 3.💼 4.🚕 5.📦 6.🎉`) + `✅ Complete Step 3/3` | Legacy M1–M4.6.4 mission pill runs its own 6-stage `GUIDED_OBJECTIVES` state (`window.__PROJECT_EKO_OBJECTIVE__.guidedIndex`) and overrides its headline when `EkoLifeSystem.activeJobShift` exists, while keeping the 6-stage buttons visible. |
| **Top-Right Panel (`#m47-ekoguide-hud`)** | `EkoGuideEngine.renderHud()` (`apps/game/index.html:32829–33035`) | `🧭 EKOGUIDE • STEP 9/15 (60%) — 10. Complete All 3/3 Shift Checkpoints` | `EkoGuideEngine` only checks `this.completedObjectiveIds` (`9/15` completed, meaning objective index 9 = Step 10 is next). It never inspects `EkoLifeSystem.activeJobShift.currentStepIndex` (`Step 3/3`) and renders as a second objective HUD alongside `#mission-hud-banner`. |
| **Center-Bottom Prompt (`#interaction-prompt`)** | `updateInteractionPrompt()` (`apps/game/index.html:14338–14345`) | `💼 ACTIVE SHIFT [STEP 3/3]: SERVE COMMUTER LUNCH ORDERS & SANITIZE COUNTER — PRESS [E] OR [J] TO COMPLETE` | The street proximity loop unconditionally overwrites `#interaction-prompt` with the active shift checkpoint string even when `#jobshub-active-shift-hud` is already open right below it. |
| **Bottom-Center Bar (`#jobshub-active-shift-hud`)** | `EkoLifeSystem.updateActiveJobHUD()` (`apps/game/index.html:5190–5220`, `29516–29579`) | `💼 ACTIVE SHIFT • STEP 3 / 3 Marina Bukka Prep & Counter Helper` + 3 checkpoint cards + `✅ Complete Step 3/3 on Street [E / J]` + `⚡ Complete All & Settle Ledger` | `EkoLifeSystem` renders its own full-width shift tracker bar at the bottom of the screen, duplicating both `#mission-hud-banner` and `#m47-ekoguide-hud`. |
| **Top-Right Balance (`#hud-gn-balance`)** | `EkoBackendSync.syncAuthoritativeState()` (`apps/game/index.html:18585–18606`) | `₦487,580 GN` on a brand-new guest account (`Guest_Lagos_8326`) | `EkoBackendSync.syncAuthoritativeState()` runs on a 15s timer (and at boot) calling `GET /api/v1/player/profile` (which returns the global seeded test user `usr_eko_hustler_01`) or reading unscoped `localStorage.__PROJECT_EKO_MASTER_BIBLE_V1__.playerBalanceGN`, overwriting the new account's opening balance. |
| **Bottom-Left & Bottom-Right Clutter** | `#slang-banter-panel`, `.hud-bottom-bar`, vehicle selector strip `[1] Sedan .. [5] BRT` | Slang panel overlapping `Move & Look` card; vehicle speedometer `0 KM/H` and 5 vehicle buttons shown while player is on foot during introductory shift. | Introductory street HUD does not suppress non-essential panels (`#slang-banter-panel`, vehicle gauges when on foot). |

---

## 2. Inventory of Every Independent System Mutating Player Journey State

### A. Active Objective & Onboarding Step Controllers (3 Competing Systems)
1. **`window.__PROJECT_EKO_OBJECTIVE__` (`apps/game/index.html:16020–16480`)**:
   - Tracks `guidedIndex` (`0..5`) and `journeyMilestones` (`enteredHome`, `usedHomeItem`, `exitedHome`, `boughtShopItem`, `completedStreetJob`, `completedDrive`, `completedCargo`, `completedCulture`).
   - Controls `#mission-hud-banner` (`#objective-step-tag`, `#objective-stage-stepper`, `#mission-headline`, `#mission-guide`, `#btn-objective-action`).
2. **`window.__PROJECT_EKO_GUIDE__` (`EkoGuideEngine`, `apps/game/index.html:32621–33102`)**:
   - Tracks `completedObjectiveIds` across a 15-step array (`obj_01_register_or_guest` .. `obj_15_verify_persistent_progress`) in `localStorage.__PROJECT_EKO_M47_GUIDE_V1__`.
   - Controls `#m47-ekoguide-hud` and `#m47-ekoguide-modal`.
   - Worse: `EkoGuideEngine.executeActionByName()` contained shortcut buttons (`completeJobGameplayStep`, `buyAffordableItemStep`) that auto-started or auto-completed actions directly from the HUD button rather than coordinating with the player's actual in-world state.
3. **`EkoLifeSystem.dailyQuests` (`apps/game/index.html:24990–24995`)**:
   - Tracks `q_church`, `q_owambe`, `q_home`, `q_billboard` inside the EkoLife modal.

### B. Active Job & Shift Controllers
1. **`EkoLifeSystem.activeJobShift` (`apps/game/index.html:25139`, `29581–29742`)**:
   - Stores `{ shiftId, jobId, title, checkpoints, currentStepIndex, completedSteps, qualityScore }` in memory.
   - **Critical Persistence Bug**: `saveMasterBibleStateToStorage()` (`line 26945`) and `loadMasterBibleStateFromStorage()` (`line 26989`) **never saved or restored `activeJobShift`**! If a player reloaded mid-shift (e.g., at Checkpoint 2/3), `activeJobShift` was lost on reload.
   - **UI Duplication Bug**: When `activeJobShift` is active, four places render instructions simultaneously (`#mission-hud-banner`, `#m47-ekoguide-hud`, `#interaction-prompt`, and `#jobshub-active-shift-hud`).

### C. Navigation Target Controllers (2 Competing Systems)
1. **`window.__PROJECT_EKO_ATLAS__.activeNavigationTargetId`**:
   - Set by `setGPSWaypoint(entityId)`.
2. **`updateObjectiveTrackerHUD()` (`line 16344`)**:
   - Directly repositions `window.__PROJECT_EKO_ATLAS__.destinationBeaconMesh.position` every frame to `spec.targetX, spec.targetZ`, fighting with `activeJobBeaconGroup` (`line 29503`).

### D. Signup, Character Creation, Starter Profile & Economy Balance Controllers
1. **Starter Profile Mismatch**:
   - `EkoLifeSystem.starterProfiles` (`lines 25001–25007`) defines 5 profiles (`profile_hostel_youth`, `profile_selfcon_starter`, `profile_family_flat`, `profile_street_hustler`, `profile_driver_trainee`) with starting balances of `₦6,000`–`₦11,500 GN`.
   - `EkoAuthAndOnboardingSystem` (`lines 33115–33121`) and `services/api/src/m47Engine.ts` defined 5 differently named IDs (`profile_new_arrival`, `profile_early_career`, `profile_student_learner`, `profile_skilled_trade`, `profile_creator_remote`) with `₦5,000 GN`.
2. **Account Isolation & Balance Leak Bug**:
   - `EkoBackendSync.syncAuthoritativeState()` (`line 18589`) fetches `/api/v1/player/profile` without an `accountId` or `sessionToken`, receiving the shared `usr_eko_hustler_01` profile (`₦35,000+` or `₦487,580 GN`), and overwrites `player.balance`.
   - When creating a new account or starting a fresh guest session, `localStorage.__PROJECT_EKO_MASTER_BIBLE_V1__` was not scoped or reset for the new `accountId`, leaking previous test state into the new player's session.
3. **Character Appearance & Clothing System Gaps**:
   - `EkoHumanCharacterSystem.applyOutfitToCharacter()` (`line 8770`) updates `'top'`, `'bottom'`, `'accent'`, and `'shoe'` vertex color slots and 3D bone attachments (`outfit_street_hustler`, `outfit_sunday_senator`, `outfit_owambe_agbada`, `outfit_corporate_suit`), and `partSlots` also tags `'skin'` and `'hair'` vertices (`lines 8679–8680`), but `applyOutfitToCharacter` did not update `'skin'` and `'hair'` vertex colors from character creation!
   - Furthermore, `EkoLifeSystem.outfits` had no explicit `ownedOutfitIds` tracking (all 4 outfits could be equipped from the EkoLife modal without checking ownership, whereas `itm_everyday_shirt` and `itm_ceremonial_asoebi` were sold in `shop_clothing_tailor`).

---

## 3. Architectural Remediation Plan (Phases 1–8)

1. **Phase 1 — One Authoritative Player Journey State (`PlayerJourneyState`)**:
   - Maintain a single canonical `PlayerJourneyState` on both server (`services/api/src/m47Engine.ts`) and client (`window.__PROJECT_EKO_JOURNEY__` / `EkoGuideEngine`), scoped by `accountId`.
   - Track: `accountStatus`, `characterSetupCompleted`, `appearance` (`skinToneHex`, `hairColorHex`, `hairStyle`, `bodyType`, `initialOutfitId`), `starterProfileId`, `starterHomeAssigned`, `currentResidenceId`, `ownedOutfitIds`, `equippedOutfitId`, `homeEntered`, `householdObjectUsed`, `wardrobeUsed`, `needsInspected`, `activeCareerGoal`, `activeJobShift` (including `jobId`, `shiftId`, `currentStepIndex`, `completedSteps`, `checkpoints`), `firstSettlementCompleted`, `firstPurchaseCompleted`, `firstPurchasedItemUsedOrPlaced`, `firstDayCompleted`, `tutorialSkipped`, `currentObjectiveId`, `lastValidProgressionEvent`, and `processedEventIds`.
   - Isolate account state so a fresh account or guest starts with the exact canonical opening balance for their chosen starter profile (never leaking `usr_eko_hustler_01`'s `₦487,580 GN` balance).

2. **Phase 2 & 5 — One Authoritative Objective Coordinator & Unified HUD**:
   - Retire/unify the competing HUD banners:
     - Hide the legacy top-center `#mission-hud-banner` (`1.🏠..6.🎉` duplicate pill) and the redundant bottom-center `#jobshub-active-shift-hud` full-width duplicate panel during normal play (or fold shift checkpoint progress directly into the single authoritative `EkoGuide` Next Step HUD card).
     - Make `EkoGuideEngine` (`#m47-ekoguide-hud`) the **single authoritative objective coordinator** that displays:
       - **OVERALL JOURNEY**: e.g. `First Day in Lagos — Step 6 of 12` (or `Active Career Goal` after graduation).
       - **CURRENT ACTION**: e.g. `Complete Checkpoint 3 of 3: Serve Commuter Lunch Orders` when a shift is active, or the next onboarding objective when no shift is active.
       - One primary action button, one optional navigation button (`🗺️ Route`), concise explanation, and optional minimisation.
     - Suppress completed shifts immediately upon settlement, never auto-start a second shift, and hide non-essential overlays (`#slang-banter-panel`) by default.

3. **Phase 3 & 6 — True End-to-End First-Time Experience (Stages A–K) & First-Class Wardrobe**:
   - **Stages A–D**: Entry screen → Character Creation with live 3D avatar preview & skin/hair/initial outfit application → Canonical Starter Profile selection (supporting all 5 Master Bible profiles with accurate housing tier, opening Game Naira, starter outfit, and entry jobs) → Arrival at Marina Palm Courts porch (`-62, -146.2`) facing the starter home with `₦0` leaked test money.
   - **Stages E–G**: Enter 3D starter home → Use household objects (bed, stove/kettle, washbasin, study desk) updating the 8 canonical needs → Open Wardrobe (`itm_wardrobe_rack`) → Equip owned outfit with immediate 3D avatar mesh update.
   - **Stages H–I**: Open JobsHub (`"You do not need a car to start earning"`) → Select & accept a qualifying no-vehicle job → Complete the 3 on-street checkpoints in sequence → Server-validated double-entry ledger settlement + itemized receipt → Shift cleared cleanly (`activeJobShift = null`).
   - **Stages J–K**: Visit shop (`shop_clothing_tailor`, `shop_food_groceries`, or `shop_furniture_home`) → Purchase an affordable item via authoritative ledger deduction → Equip new garment on 3D avatar or place/use furniture in 3D home → **First-Day Graduation Summary Modal** with free-roam unlock and next career choices.

4. **Phase 4 — First-Time vs. Returning Player & Safe Dev/Test Reset**:
   - Explicit handling for: (a) Fresh player, (b) Returning player with completed onboarding, (c) Returning player mid-shift (resuming at exact `currentStepIndex` without duplication), (d) Returning player mid-onboarding.
   - Explicit development-only reset/fixture endpoint (`POST /api/v1/dev/test-fixture/reset`) that creates an isolated fresh test fixture without overwriting existing player accounts.
