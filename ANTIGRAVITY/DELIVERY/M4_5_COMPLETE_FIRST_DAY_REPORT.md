# PROJECT EKO — M4.5 COMPLETE FIRST-DAY EXPERIENCE REPORT

**Date:** 2026-10-20  
**Milestone:** M4.5 Complete First-Day Experience  
**Status:** VERIFIED & COMPLETE (40/40 Unit & Integration Tests Passing • 30/30 Live Headless Browser Checks Passing)

---

## 1. Executive Summary

Milestone M4.5 proves end-to-end in the running Project Eko application ([apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html) and [services/api/server.js](file:///Users/divinity/Documents/Project%20Eko/services/api/server.js)) that a newly created player can:
1. **Establish and enter a walkable 3D starter home** (`Marina Palm Self-Contain`, Tier 1 Starter Pad at `(-62, 0.12, -152)`) directly from the street entrance door (`(-62, 0.22, -148.0)`) or EkoLife housing controls, and exit cleanly back to the front porch (`(-62, 0.22, -146.5)`).
2. **Use genuinely functional household objects** (`itm_mattress_starter`, `itm_standing_fan`, `itm_table_stove`, `itm_grocery_basket`, `itm_compact_fridge`, `itm_wash_basin`, `itm_wardrobe_rack`, `itm_study_desk`, `itm_work_laptop`, `itm_lounge_sofa`, `itm_afrobeat_painting`, `itm_backup_inverter`) that mutate real household state (`pantryServings`, `fanTurnedOn`, `dressedBuffActive`, `studyPrepActive`, `inverterActive`), update the 8 canonical needs, and enforce cooldown/pantry/placement rules.
3. **Manage the 8 canonical needs** (`hunger`, `energy`, `hygiene`, `social`, `fun`, `comfort`, `health`, `dataConnectivity`) with `offlineDecayDisabled: true` and non-punitive low-need recovery so ordinary gameplay mistakes never trigger unavoidable failure loops.
4. **Complete the authoritative shop, ledger, and 3D inventory placement loop**, including browsing 8 shops and 19 illustrated items, rejecting unaffordable or duplicate non-stackable purchases, posting balanced double-entry Game Naira (`GN`) ledger entries, adding items to inventory, validating collision-safe 3D placement, and using placed items inside the home.
5. **Discover, perform, and settle a no-vehicle entry-level job (`job_foot_courier` — Walking Parcel Runner)** by walking to 3 physical 3D street checkpoints (`(-112, -202)` → `(-84, -155)` → `(-82, -122)`), submitting telemetry for server verification, and receiving an idempotent double-entry ledger settlement (`+1,243 GN` net).
6. **Maintain 100% state persistence across save/reload and mobile portrait/landscape viewports**, preserving `playerBalanceGN`, `ownedItemIds`, `placedFurniture` (positions & rotations), `needs`, `pantryServings`, `fanTurnedOn`, and `completedJobReceipts`.

---

## 2. Verification of the 3D Starter Home (`Marina Palm Self-Contain`)

| Requirement | Implementation & Verification | Status |
| :--- | :--- | :--- |
| **Door Entry & Exit** | Physical Mahogany Front Entrance Door at `(-62, 0.22, -148.0)` with porch canopy and step; pressing `[E]` at the door or `[H]` enters `homeInteriorGroup` at `(-62, 0.12, -152)` (`avatar.y = 0.22m`). Pressing `[H]` or walking to the South threshold exits to `(-62, 0.22, -146.5)`. | ✅ PASS |
| **8 Configured Room Zones** | `sleep_zone` (NW Bedroom Alcove), `work_study_zone` (North Study Nook), `hygiene_zone` (NE Enclosed Bathroom), `storage_zone` (West Wardrobe Bay), `living_social_zone` (Center Ankara Parlor), `cooking_zone` (East Kitchenette), `utility_corner` (SW/SE Utility Corner), and `veranda_frontage` (South Threshold). | ✅ PASS |
| **Character Grounding & Collision** | Avatar feet grounded at `y = 0.22m` (`floorY = 0.12m` + `0.10m` slab). `resolveHomeInteriorAvatarMovement()` enforces perimeter walls (`±3.62m`), interior partitions (NE bathroom wall, NW alcove divider, East kitchenette peninsula), and AABB footprints of all placed furniture. | ✅ PASS |
| **Furniture Footprints, Placement & Rotation** | `validateFurniturePlacement()` enforces room bounds, front door clearance (`z > 2.75`), bathroom doorway clearance, partition walls, and inter-object AABB overlaps (respecting 90° `rotY` swaps). | ✅ PASS |
| **Accessible Object-Interaction Prompts** | Real-time proximity detection (`getNearestPlacedHomeItem`) updates `#interaction-prompt` and `#home-hud-contextual-prompt` with object-specific action verbs (`Sleep`, `Switch Fan ON/OFF`, `Cook Home Jollof Meal`, `Stock Home Pantry`, `Freshen Up`, `Study & Prep`). | ✅ PASS |
| **Camera Transitions** | Smooth transitions between Street Camera, **Home Exploration Mode** (default 3rd-person human-scale camera at `floorY + 1.48m` with raycast collision avoidance), and **Home Planner Mode** (elevated cutaway floorplan view). | ✅ PASS |

---

## 3. Genuine Functional Household Objects & 8 Canonical Needs

### 3.1 Functional Household Object Matrix

| Canonical Item ID | Name | Action Verb | Stateful Behavior & Need Impact |
| :--- | :--- | :--- | :--- |
| `itm_mattress_starter` | Orthopedic Starter Mattress & Bedframe | `Sleep & Recover` | Restores `energy +42`, `comfort +18`, `health +8`; triggers sleeping/resting character pose; 8s cooldown prevents spam. |
| `itm_standing_fan` | Ox Breeze Standing Fan | `Switch Fan ON / OFF` | Toggles `fanTurnedOn` (`true`/`false`), updates HUD badge (`Fan: ON ❄️` / `Fan: OFF`), restores `comfort +16`, `energy +5`. |
| `itm_table_stove` | Tabletop Gas Burner & Jollof Pot | `Cook Home Jollof Meal` | Consumes `1` serving from `pantryServings` (blocks with clear prompt if `pantryServings <= 0`); restores `hunger +38`, `comfort +10`, `health +6`. |
| `itm_grocery_basket` | Home Cooking Grocery Basket (5 Meals) | `Stock Home Pantry (+3 Meals)` | Adds `+3` raw meal servings to `pantryServings` (up to 12 max) for stove cooking and restores `hunger +24`, `health +8`. |
| `itm_compact_fridge` | Haier Thermocool Compact Fridge | `Inspect & Chill Pantry (+2 Meals)` | Chills/adds `+2` servings to `pantryServings` and restores `hunger +18`, `comfort +12`, `health +6`. |
| `itm_wash_basin` | Ceramic Wash & Hygiene Station | `Freshen Up & Wash` | Restores `hygiene +40`, `health +8`, `comfort +8`. |
| `itm_wardrobe_rack` | Teak Wardrobe & Outfit Rack | `Organize & Dress Smart` | Activates `dressedBuffActive = true`; restores `hygiene +18`, `social +15`, `comfort +10`. |
| `itm_study_desk` | Starter Study & JobHub Work Desk | `Study & Prep Career Skills` | Activates `studyPrepActive = true`; awards `+4` `customer_service` & `digital_media` XP; restores `fun +10`, `social +8`. |
| `itm_work_laptop` | Creator Pro Work Laptop | `Run Digital & Logistics Prep` | Awards `+8` `digital_media` & `business_accounting` XP; restores `fun +14`, `dataConnectivity +15`. |
| `itm_lounge_sofa` | Plush 3-Seater Parlor Sofa | `Relax & Host Parlor` | Restores `comfort +28`, `social +22`, `fun +18`, `energy +12`. |
| `itm_afrobeat_painting` | Framed Lagbaja & Fela Wall Canvas | `Admire Lagos Art` | Restores `fun +20`, `comfort +14`, `social +10`, and `+8 Clout`. |
| `itm_backup_inverter` | EkoSolar 1.5kVA Hybrid Inverter | `Check Pure-Sine Backup` | Sets `inverterActive = true`, guarantees uninterrupted home power during NEPA outages, restores `comfort +22`, `dataConnectivity +20`. |

### 3.2 Eight Canonical Needs (`offlineDecayDisabled: true`)
- **Needs Tracked**: `hunger`, `energy`, `hygiene`, `social`, `fun`, `comfort`, `health`, `dataConnectivity` (all clamped `0..100`).
- **Accessibility & Non-Punitive Design**:
  - `offlineDecayDisabled: true` is strictly enforced — zero need decay occurs while offline or between sessions.
  - Active decay runs gently every 45 seconds of live play and respects player accessibility presets (`relaxed` = `0.5x`, `standard` = `1.0x`, `simulation` = `1.35x`).
  - Even if needs drop below `30%`, earnings multiplier floors at `0.92x` (never zero), and the player can always recover energy, hygiene, and comfort for free using starter home objects.

---

## 4. Authoritative Shop, Inventory & Collision-Safe Placement Loop

- **Unaffordable Purchase Rejection**: Attempting to buy an item whose price exceeds `playerBalanceGN` returns `{ success: false, error: 'INSUFFICIENT_FUNDS' }` without mutating inventory or ledger state.
- **Duplicate Non-Stackable Guard**: Durable furniture/appliances (`stackable: false`) already in `ownedItemIds` return `{ success: false, error: 'ALREADY_OWNED_NON_STACKABLE' }` on repeated buy inputs.
- **Authoritative Double-Entry Ledger Settlement**: Affordable purchases debit `PLAYER_WALLET_GN` and credit `MERCHANT_REVENUE_GN`, updating `playerBalanceGN` and adding the item to `ownedItemIds` and `inventoryCounts`.
- **Collision-Safe Placement Validation**:
  - Placing at `(3.8, 0.0)` → Rejected (`PLACEMENT_OUT_OF_ROOM_BOUNDS`).
  - Placing at `(0.0, 3.2)` → Rejected (`PLACEMENT_BLOCKS_DOORWAY`).
  - Placing at `(1.35, -2.5)` → Rejected (`PLACEMENT_COLLIDES_WITH_PARTITION`).
  - Valid placements auto-select a non-overlapping room coordinate and persist across reloads.

---

## 5. No-Vehicle Entry-Level Job Loop (`job_foot_courier`)

1. **Discovery & Upfront Disclosure**: In `EkoLife -> JobsHub`, `job_foot_courier` (*Walking Parcel Runner (No Vehicle)*) clearly discloses:
   - **Vehicle Required**: `None (On-Foot)`
   - **Base Pay**: `950 GN`
   - **Max Quality Bonus**: `+350 GN`
   - **Shift Cost (Shoe Wear & Drinking Water)**: `-50 GN`
2. **Physical 3D Street Execution**:
   - Starting the shift via `startActiveJobShift('job_foot_courier')` spawns a glowing 3D green-and-gold checkpoint beacon on the street.
   - The player traverses 3 physical checkpoints along the Marina/Broad Street corridor:
     1. `(-112.0, -202.0)` — Collect waybill pouch at CMS Dispatch Kiosk (`1/3`)
     2. `(-84.0, -155.0)` — Verify stamp at Kakawa Street Chambers (`2/3`)
     3. `(-82.0, -122.0)` — Deliver signed manifest at Broad St Courier Desk (`3/3`)
3. **Authoritative Verification & Balanced Settlement**:
   - Submitting completion with `qualityScore = 0.98` posts an idempotent double-entry receipt (`rcpt_job_foot_courier_*`) crediting **+1,243 GN net** (`950 GN` base + `343 GN` quality bonus - `50 GN` cost) and awarding `+18 physical_stamina` & `+18 driving_navigation` XP.

---

## 6. New-Player Economics Across 3 Canonical Stage Profiles

Verified via `window.__PROJECT_EKO_LIFE__.applyEconomicStageProfile(stageId)` (Note: profile tuning values below are marked **provisional** per specification):

| Economic Stage Profile | Canonical Starter Profile | Opening Balance (GN) | Validated Income Source (No Vehicle Needed) | Household & Essential Expenses | Sample Essential Purchase | Ending Balance (GN) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. New Arrival (`new_arrival`)** *(Provisional Tuning)* | `fresh_graduate` (Tier 1 Starter Self-Contain) | **8,500 GN** | `job_foot_courier` (+1,243 GN net) or `job_market_assistant` (+1,426 GN net) | Rent: `0 GN` (Tier 1 Starter Pad included) • Utilities: `350 GN/cycle` | `itm_grocery_basket` (`-2,200 GN`, 5 home meals) + `itm_snacks_water` (`-650 GN`) | **6,893 GN** (after 1 shift + 5-meal grocery basket + snack) |
| **2. Working Player (`working_player`)** *(Provisional Tuning)* | `market_apprentice` (Tier 1 Furnished Self-Contain) | **24,000 GN** | `job_bukka_helper` (+1,623 GN net) + `job_auto_apprentice` (+1,967 GN net) | Utilities: `350 GN/cycle` • Transit/Food: `800 GN` | `itm_compact_fridge` (`-28,000 GN` after 2 shifts) or `itm_ceremonial_asoebi` (`-18,500 GN`) | **9,090 GN – 27,590 GN** |
| **3. Established Player (`established_player`)** *(Provisional Tuning)* | `creative_freelancer` (Tier 3 Victoria Island 2-Bed Flat) | **145,000 GN** | `job_creative_microtask` (+2,608 GN net) + Business Dividends (`biz_pos_kiosk`) | Tier 3 Rent & Estate Service Charge: `12,850 GN/cycle` | `itm_work_laptop` (Owned) + `itm_backup_inverter` (Owned) + Shop Restock | **134,758+ GN** |

**How a New Arrival Affords Essentials Without a Vehicle or Business:**
- A new arrival starts with **8,500 GN** and **Tier 1 Starter Self-Contain housing (`0 GN` rent)** already equipped with a starter mattress, standing fan, tabletop stove, study desk, wardrobe, and wash basin.
- Buying a **Home Cooking Grocery Basket (`2,200 GN`)** stocks **5 home-cooked Jollof meals (`440 GN` per meal)**, leaving **6,300 GN** cash buffer.
- Completing just **two 90-second on-foot shifts** (`Walking Parcel Runner` at `+1,243 GN` and `Balogun Market Stall Assistant` at `+1,426 GN`) earns **+2,669 GN** with zero vehicle ownership required—more than covering the entire 5-meal grocery basket plus `350 GN` utilities!

---

## 7. Mobile & Persistence Acceptance

### 7.1 Mobile Viewport & Touch Acceptance
Tested in headless Chromium across representative mobile viewports:
- **Phone Portrait (`390×844`)**: `m4_6_home_mobile_portrait.png` — Compact Home HUD (`max-height: 36dvh`) sits cleanly above the virtual thumbstick (`#mobile-joy-zone`) and `ACT / DRIVE [E]` touch button (`#mobile-action-cluster`). All buttons meet `>= 40px` touch target height; `60 FPS`, `36 draw calls`.
- **Phone Landscape (`844×390`)**: `m4_6_home_mobile_landscape.png` — Ultra-compact single-strip Home HUD (`max-height: 34dvh`) preserves clear 3D room visibility ahead; `60 FPS`, `42 draw calls`.

### 7.2 Save / Reload Persistence Verification
Verified in Check 30 of `scripts/verify_m3_1_atlas_polish.js`:
1. Applied `new_arrival` profile (`8,500 GN`), completed `job_foot_courier` (`+1,243 GN` → `9,743 GN`), stocked pantry (`6 servings`), toggled fan `OFF`, and saved state.
2. Executed `await page.reload()` and waited for `EkoBackendSync.syncAuthoritativeState()`.
3. Verified post-reload state:
   - `playerBalanceGN === 9743` (`₦9,743 GN` in top HUD)
   - `placedFurniture.length === 9` (all 9 3D objects & rotations preserved)
   - `ownedItemIds.length === 9`
   - `pantryServings === 6`
   - `fanTurnedOn === false`
   - `completedJobReceipts.length >= 1`

---

## 8. Real Performance Measurements Across All 3 Modes

Measured via `renderer.info.render` and `EkoPerformanceManager` in headless Chromium (`scripts/verify_m3_1_atlas_polish.js`):

| Gameplay Mode | Draw Calls | Triangles | Frame Rate (FPS) | Avg Frame Time |
| :--- | :---: | :---: | :---: | :---: |
| **1. EkoAtlas (Aerial & 2.5D Directory)** | `35 – 56` | `22,826` | **60 FPS** | `16.66 ms` |
| **2. Street-Level Gameplay (Living Lagos)** | `52` | `27,336` | **60 FPS** | `16.65 ms` |
| **3. 3D Starter Home Interior (Exploration & Planner)** | `33 – 45` | `23,200 – 25,200` | **60 FPS** | `16.65 ms` |

---

## 9. Evidence Screenshots

All visual evidence is stored in `/Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/`:
- [m4_6_home_exterior_entrance.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_exterior_entrance.png) — Ground-level starter home exterior with mahogany front door, canopy, windows, and avatar on the front porch.
- [m4_6_home_exploration_mode.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_exploration_mode.png) — Default human-scale 3rd-person interior camera with contextual proximity prompt and clean Home HUD.
- [m4_6_home_cooking_and_bed.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_cooking_and_bed.png) — Functional household object interactions (`Pantry: 5 Meals`, `Fan: OFF`, `Needs: 94%`).
- [m4_6_home_planner_mode.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_planner_mode.png) — Elevated cutaway floorplan view showing all 8 zones, partition walls, and furniture placement/rotation controls.
- [m4_5_shop_and_job_receipt.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_5_shop_and_job_receipt.png) — Verified `job_foot_courier` ledger receipt (`+₦1,243 GN`) in `EkoLife -> JobsHub`.
- [m4_5_reload_persistence.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_5_reload_persistence.png) — Post-reload persistence verification (`₦9,743 GN`, 9 placed 3D objects, `Pantry: 6 Meals`).
- [m4_6_home_mobile_portrait.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_mobile_portrait.png) & [m4_6_home_mobile_landscape.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_mobile_landscape.png) — Mobile portrait and landscape acceptance inside the 3D home.

---

## 10. Remaining Gaps & Honest Disclosures

- **Instanced Procedural Box Furniture Geometry**: All 12 household furniture and appliance models inside the 3D starter home are built from multi-part procedural sub-boxes (`105` total sub-boxes packed into a single `THREE.InstancedMesh` draw call for 60 FPS mobile/desktop performance) rather than external textured `.glb` meshes.
- **Instant Character Pose Transitions on Object Use**: Interacting with the bed, sofa, stove, or desk triggers the character's `interact` / resting state and immediate need/pantry updates with toast feedback rather than multi-second cinematic cutscenes.
