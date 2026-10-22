# PROJECT EKO — M4.7 END-TO-END PLAYER JOURNEY & GAME FLOW REPAIR REPORT

**Date:** 2026-10-20  
**Scope:** End-to-End Player Journey State Machine, Single Authoritative Objective Coordinator, First-Time Citizen Balance Isolation, First-Class Wardrobe & 3D Avatar Styling, Active Shift Substep Coordination, and 24-Step Browser Acceptance Verification  
**Product Promise:** LIVE. DRIVE. BUILD. EARN.  
**Core Rule Enforced:** **ONE PLAYER JOURNEY. ONE AUTHORITATIVE STATE. ONE CLEAR NEXT ACTION.**

---

## 1. Root Causes Identified (From Phase 0 Audit)

Full root-cause details are documented in [`ANTIGRAVITY/DELIVERY/M4_7_GAMEFLOW_ROOT_CAUSE_AUDIT.md`](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/M4_7_GAMEFLOW_ROOT_CAUSE_AUDIT.md). The four primary defects reproduced from the user screenshot and codebase trace were:

1. **Four Competing Objective & Instruction Banners Rendered Simultaneously**:
   - `#mission-hud-banner` (`STAGE 3/6 • NO-VEHICLE STREET JOB`) at top-center (`apps/game/index.html:4211`).
   - `#m47-ekoguide-hud` (`EKOGUIDE • STEP 9/15 (60%)`) at top-right (`apps/game/index.html:32840`).
   - `#jobshub-active-shift-hud` (`ACTIVE SHIFT • STEP 3/3`) at bottom-center (`apps/game/index.html:29560`).
   - `#interaction-prompt` (`PRESS [E] OR [J] TO COMPLETE`) above bottom-center.
2. **Stale Demo Balance (`₦487,580 GN`) Leaking into New Citizen Accounts**:
   - `EkoBackendSync.syncAuthoritativeState()` (`apps/game/index.html:18622`) unconditionally applied `__PROJECT_EKO_MASTER_BIBLE_V1__.playerBalanceGN` from `localStorage` without scoping it to the active `accountId`, and `OnboardingScreen.applyAccountState()` checked `window.EkoBackendSync` (undefined) and `#player-balance` instead of `EkoBackendSync.reconcileBalance()` and `#hud-gn-balance`.
   - Additionally, `EkoLifeSystem.equipOutfit()` previously triggered `completeQuest('q_home')` (`+₦900 GN`) during character preview and reload restoration.
3. **Uncoordinated Active Shift Substeps (`Step 1..3 of 3`) vs. Overall Journey Progress (`Step 1..15`)**:
   - `EkoLifeSystem.activeJobShift` and `EkoGuideEngine` operated independently without a hierarchical coordinator distinguishing `OVERALL JOURNEY` from `CURRENT SHIFT ACTION`, and `activeJobShift` was not persisted across page reloads.
4. **Wardrobe & 3D Character Appearance Gaps**:
   - `EkoHumanCharacterSystem.applyOutfitToCharacter()` recolored `'top'`, `'bottom'`, `'accent'`, and `'shoe'` vertex slots and attached 3D garment meshes (`outfitSpineMesh`, `outfitHeadMesh`), but did not recolor `'skin'` or `'hair'` slots or scale `bodyType` from the character creation form, and there was no dedicated first-class Wardrobe modal separating owned outfits (`₦0 GN` equip) from shop-locked outfits.

---

## 2. Player-Journey State Machine Table

The authoritative player journey state is persisted in `M47AccountRecord.onboarding` ([`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts)) and synchronized with `EkoGuideEngine` and `EkoLifeSystem` ([`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html)):

| Stage | Canonical Journey Step | Objective ID | Triggering Game Event(s) | Authoritative State Mutation |
| :--- | :--- | :--- | :--- | :--- |
| **Stage A** | Entry & Auth | `obj_01_register_or_guest` | `AccountCreated` | Creates permanent citizen or promotable guest account (`accountStatus`) |
| **Stage B** | Character & Attire Setup | `obj_02_create_character` | `ProfileCreated` / `CharacterProfileCompleted` / `InitialOutfitSelected` | Persists `bodyType`, `skinTone`, `hairStyle`, `outfitPreset`, `ownedOutfits`, `equippedOutfitId` |
| **Stage C** | Starter Profile & Grant | `obj_03_claim_starter_profile` | `StarterHomeClaimed` / `StarterProfileSelected` / `StarterHomeAssigned` | Mints exact `₦5,000 GN` starter grant in ledger; assigns `res_tier0_compound` at Marina Porch (`-62, 0.22, -146.2`) |
| **Stage D** | Starter Home Arrival | `obj_04_enter_starter_home` | `HomeEntered` | Transitions `isInsideHomeInterior = true`, activates interior lighting & HUD |
| **Stage E** | Household Interaction & Needs | `obj_05_use_household_object`, `obj_06_inspect_household_needs` | `HouseholdObjectUsed`, `NeedsInspected` | Restores corresponding need (`energy`, `comfort`, `hygiene`, `hunger`) and records `homeOnboardingStage` |
| **Stage F** | Wardrobe & Outfit Equip | Integrated at Home & Top Pill | `WardrobeOpened`, `ClothingEquipped` | Opens `#m47-wardrobe-modal`, equips owned outfits for `₦0 GN`, updates 3D avatar SkinnedMesh & garment attachments |
| **Stage G** | JobsHub & First Shift Accept | `obj_07_open_jobshub`, `obj_08_select_no_vehicle_job` | `JobsHubOpened`, `JobAccepted` | Starts `activeJobShift` (`job_foot_courier`, 3 checkpoints, no vehicle required) |
| **Stage H** | Shift Checkpoints (`1/3 -> 3/3`) | `obj_09_reach_task_location`, `obj_10_complete_job_gameplay` | `JobLocationReached` / `ShiftCheckpointCompleted`, `JobTaskCompleted` / `JobCompleted` | Advances `activeJobShift.currentStepIndex` (`0 -> 1 -> 2 -> completed`) with 3D world beacon & reload persistence |
| **Stage I** | Authoritative Settlement | `obj_11_receive_job_settlement` | `JobSettlementPosted` | Credits verified wage (`+₦1,243 GN` / `+₦500 GN` net) via double-entry ledger; clears `activeJobShift = null` immediately |
| **Stage J** | First Shop Purchase & Use | `obj_12_visit_shop`, `obj_13_purchase_affordable_item`, `obj_14_place_and_use_item` | `ShopVisited`, `ItemPurchased` / `ClothingPurchased`, `ItemPlaced` / `FurniturePlaced` | Debits item price via ledger, unlocks corresponding Wardrobe outfit (`outfit_corporate_suit`), places/uses item in 3D home |
| **Stage K** | First-Day Graduation | `obj_15_verify_persistent_progress` | `HomeProgressVerified` / `FirstDayCompleted` | Marks `firstDayCompleted = true`, opens `#m47-graduation-modal` summary, and transitions to Free Roam |

---

## 3. Objective Coordination Rules

`EkoGuideEngine` (`window.__PROJECT_EKO_GUIDE__` in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L32978-L33400)) is the **single authoritative HUD coordinator**:

1. **Legacy Competing Banners Suppressed**:
   - `#mission-hud-banner`, `#jobshub-active-shift-hud`, and `#slang-banter-panel` are hidden (`display: none !important` in `#m47-guided-styles`).
2. **Hierarchical Separation of Overall Journey vs. Active Shift Substeps**:
   - `#m47-guide-overall-journey-line` always displays the macro journey state (e.g., `OVERALL JOURNEY: First Day in Lagos — Step 7 of 12` or `Completed (12 of 12) • Free Roam Active`).
   - Whenever `EkoLifeSystem.activeJobShift` is active (`status === 'ACTIVE'`), `#m47-guide-active-shift-substep` renders inside the EkoGuide card (`💼 CURRENT SHIFT ACTION: Step k of 3`) and the primary action button targets the current checkpoint (`▶ Complete Checkpoint k/3 [E / J]`).
3. **Immediate Shift Clearance & No Auto-Start**:
   - Completing checkpoint `3/3` immediately sets `activeJobShift = null`, removes the shift substep pill, posts the ledger settlement, and advances the primary objective to Step 12 (`Visit the Household & Necessities Shop`). No subsequent shift ever auto-starts.
4. **Contextual Suppression**:
   - When the player is actively driving (`controlMode === 'vehicle' && speed > 5`), unrelated home tutorials are suppressed in favor of road-safe navigation guidance.
   - When inside the 3D home after onboarding completion, relevant household actions (`Home Comfort & Needs Ready — Head Out for Next Shift`) are prioritized.

---

## 4. First-Time Player Flow & Clean-Account Balance Isolation

- **Dev Test-Fixture Reset (`POST /api/v1/dev/test-fixture/reset` & `OnboardingScreen.resetTestFixture()`)**:
  - Resets server and browser state to a clean first-time citizen profile, clearing `localStorage` keys (`__PROJECT_EKO_M47_SESSION__`, `__PROJECT_EKO_M47_GUIDE_V1__`, `__PROJECT_EKO_MASTER_BIBLE_V1__`) without weakening authentication or economy validation.
- **Account-Scoped Storage & Authoritative Balance**:
  - Every new citizen account starts with the exact starter profile grant (`₦5,000 GN`), verified in both `player.balance` and `#hud-gn-balance` (`₦5,000 GN`).
  - Passive Danfo fleet remittances (`Tunde Bakare`) only fire when `player.ownedVehicles.includes('danfo')`.
  - Returning players with a valid session (`restoreExistingSession()` + `characterCreated === true`) are restored directly into Lagos without reopening the entry modal on page reload.

---

## 5. Clothing, Wardrobe & 3D Avatar Customization Flow

- **Live 3D Character Setup**:
  - `EkoHumanCharacterSystem.applyOutfitToCharacter()` (`apps/game/index.html:8770–8829`) dynamically recolors `'skin'` (`skinHex`), `'hair'` (`hairHex`), `'top'`, `'bottom'`, `'accent'`, and `'shoe'` vertex color slots on the 15-bone `SkinnedMesh`, scales the avatar group by `bodyType` (`compact_runner`, `athletic_lagos`, `tall_executive`), and attaches sculpted 3D garment and headwear meshes (`outfitSpineMesh`, `outfitHeadMesh`).
- **First-Class Wardrobe Modal (`#m47-wardrobe-modal`)**:
  - Accessible from the top-right `👗 Wardrobe` pill, the EkoGuide HUD `👗 Wardrobe` button, and inside the 3D starter home.
  - Clearly distinguishes **Owned Outfits** (`Lagos Street Hustler Fit`, `Sunday Senator Native Wear` — equippable for `₦0 GN`) from **Shop-Locked Outfits** (`Broad Street Corporate Suit` `₦4,500 GN`, `Royal Owambe Gold Agbada` `₦22,000 GN`).
  - Purchasing `itm_everyday_shirt` (`₦4,500 GN`) or using **Buy & Equip** in the Wardrobe debits the authoritative ledger, unlocks `outfit_corporate_suit` in `ownedOutfitIds`, immediately dresses the 3D avatar, and persists across page reloads.

---

## 6. Work, Checkpoints, Settlement & Mid-Shift Reload Recovery

- Accepting a qualifying no-vehicle job (`job_foot_courier` — *Walking Parcel Runner*) initializes a 3-checkpoint shift (`Broad St Dispatch Desk` -> `Marina Ferry Waybill Counter` -> `CMS Final Sign-Off`).
- **Mid-Shift Reload Recovery**: `activeJobShift` (including `jobId`, `currentStepIndex`, and `checkpoints`) is persisted in `saveMasterBibleStateToStorage()` and synced via `POST /api/v1/journey/sync-state`. Reloading the browser after Checkpoint `2/3` restores the active shift at `Step 3 of 3` with its 3D world beacon intact.
- Completing Checkpoint `3/3` credits the player's Game Naira balance (`+₦1,243 GN`), records a double-entry ledger transaction (`TREASURY_COMMERCIAL_OPERATIONS` -> `PLAYER_WALLET`), clears `activeJobShift`, and advances EkoGuide to the shop objective.

---

## 7. Automated & Browser Verification Results

### 7.1 Unit & Integration Test Suite (`node scripts/run_all_tests.js`)
- **Result**: **49 PASSED | 0 FAILED** across Suites 1–18 (Double-Entry Economy Ledger, Vehicle Dynamics, World Graph, Anti-Cheat, 3D Humanoid Character System, Spatial Integrity, PBR & Hero Vehicles, Standardized Interaction Framework, Mobile-First Touch Controls, Danfo Hustle, EkoAtlas, Master Vision Bible M0–M11, M4.6.1–M4.6.4 Immersion & Furniture/Clothing, and M4.7 Guided Gameplay, Multiplayer & Progression Engine).

### 7.2 M4.7 Guided Gameplay, Multiplayer & Progression Suite (`node scripts/verify_m4_7_guided_multiplayer_progression.js`)
- **Result**: **23 PASSED | 0 FAILED** (Guest creation & promotion, duplicate username rejection, two-player realtime `zone_marina_cms` separation from NPCs, proximity chat & moderation, 2-human Crew creation, 60/40 Cooperative Danfo route validation & ledger settlement, reconnect state restoration, EkoProgress career map, Hustle Flow multiplier caps, and reload persistence).

### 7.3 M4.7 24-Step End-to-End Gameflow Browser Suite (`node scripts/verify_m4_7_end_to_end_gameflow.js`)
- **Result**: **24/24 STEPS PASSED | 0 FAILED** in a real headless Chromium browser (`1440x900` Desktop & `390x844` Mobile Portrait):
  1. `PASS [Step 1]`: Open entry screen on a clean account & verify legacy duplicate HUDs are hidden.
  2. `PASS [Step 2]`: Create a new permanent citizen account via registration form.
  3. `PASS [Step 3]`: Customize character body build, skin tone & hairstyle with live 3D avatar update.
  4. `PASS [Step 4]`: Select initial starter clothes (`Sunday Senator Native Wear`) & update 3D avatar.
  5. `PASS [Step 5]`: Select canonical starter profile (`New Arrival in Lagos`).
  6. `PASS [Step 6]`: Confirm initial Game Naira matches selected starter profile (`₦5,000 GN` — never `₦487,580 GN`).
  7. `PASS [Step 7]`: Arrive outside Marina Starter Home porch (`-62, 0.22, -145.4`) with EkoGuide pointing to Enter Home.
  8. `PASS [Step 8]`: Enter 3D starter home interior & advance EkoGuide to Household Object interaction.
  9. `PASS [Step 9]`: Use household object (`Starter Bed`) inside 3D starter home.
  10. `PASS [Step 10]`: Confirm needs and objective state update (Steps 5 & 6 completed, advancing to JobsHub).
  11. `PASS [Step 11]`: Open First-Class Wardrobe modal & display Owned vs. Locked outfits.
  12. `PASS [Step 12]`: Equip owned outfit for `₦0 GN` & verify 3D avatar updates immediately.
  13. `PASS [Step 13]`: Open JobsHub & display qualifying no-vehicle entry jobs.
  14. `PASS [Step 14]`: Accept qualifying no-vehicle job (`Walking Parcel Runner`) & coordinate `OVERALL JOURNEY` vs. `CURRENT SHIFT ACTION Step 1 of 3`.
  15. `PASS [Step 15]`: Complete shift checkpoint `1/3` & advance coordinator to `Checkpoint 2 of 3`.
  16. `PASS [Step 16]`: Complete shift checkpoint `2/3` & verify Active-Job Mid-Shift Reload Recovery resumes at `Step 3 of 3`.
  17. `PASS [Step 17]`: Complete final shift checkpoint `3/3`.
  18. `PASS [Step 18]`: Confirm authoritative job settlement credits Game Naira (`+₦1,243 GN`).
  19. `PASS [Step 19]`: Confirm completed shift immediately disappears from active objective banner without auto-starting another shift.
  20. `PASS [Step 20]`: Confirm next objective advances cleanly to `Visit the Household & Necessities Shop` (`Step 12/15`).
  21. `PASS [Step 21]`: Visit shop via EkoGuide objective action.
  22. `PASS [Step 22]`: Buy affordable clothing item (`Smart Lagos Work Shirt` `₦4,500 GN`) & unlock `Broad Street Corporate Suit` in Wardrobe.
  23. `PASS [Step 23]`: Equip purchased Corporate Suit on 3D avatar, use home item & display Stage K First-Day Graduation Summary.
  24. `PASS [Step 24]`: Reload page & confirm balance (`₦3,543 GN`), equipped Corporate Suit outfit, inventory, home state and Free Roam objective persist.

---

## 8. Captured Visual Evidence

- `m4_7_gameflow_step1_entry.png` — Clean-account entry screen with legacy duplicate banners hidden and `₦5,000 GN` starting state.
- `m4_7_gameflow_step5_character_setup.png` — 5-step character creation & appearance customization modal (`Compact Runner Build`, `Deep Espresso`, `Afro Twist Crown`, `Sunday Senator Native Wear`, `New Arrival in Lagos`).
- `m4_7_gameflow_step7_arrival_porch.png` — Arrival outside the 3D Marina Starter Home porch wearing the selected `Sunday Senator Native Wear` with exact `₦5,000 GN` balance and single EkoGuide objective (`4. Discover & Enter Your 3D Starter Home`).
- `m4_7_gameflow_step12_wardrobe.png` — First-Class Lagos Wardrobe modal showing Owned (`₦0 GN` equip) vs. Shop-Locked (`₦4,500 GN` / `₦22,000 GN`) outfits.
- `m4_7_gameflow_step14_active_shift_coordinated.png` — Single coordinated EkoGuide banner displaying `OVERALL JOURNEY: First Day in Lagos — Step 7 of 12` alongside `💼 CURRENT SHIFT ACTION: Step 1 of 3 (Walking Parcel Runner (No Vehicle))`.
- `m4_7_gameflow_step20_post_shift_shop_objective.png` — Immediate clearance of the active shift banner upon completing Checkpoint `3/3`, crediting `+₦1,243 GN` and advancing to `12. Visit the Household & Necessities Shop`.
- `m4_7_gameflow_step23_graduation_summary.png` — Stage K First-Day Graduation & Free Roam modal displaying authoritative wallet balance (`₦3,543 GN`), equipped `Broad Street Corporate Suit`, and long-term Lagos career paths.
- `m4_7_gameflow_step24_mobile_portrait_clean_hud.png` — Post-reload Mobile Portrait (`390x844`) view inside the 3D home wearing the persisted `Broad Street Corporate Suit` with a single clean EkoGuide HUD and touch-aware controls.
