# Project Eko — Character System, Mobile-First Interface & Danfo Hustle Complete Acceptance Report

**Delivery Path:** `ANTIGRAVITY/DELIVERY/CHARACTER_MOBILE_AND_DANFO_HUSTLE_ACCEPTANCE_REPORT.md`  
**Verification Telemetry:** `ANTIGRAVITY/DELIVERY/complete_acceptance_verification.json`  
**Automated Test Suites:** `scripts/run_all_tests.js` (`36/36 PASS`) & `scripts/verify_complete_acceptance.js` (`allPassed: true`)  
**Compliance Posture:** **Strict Virtual-Only Economy** (`Eko Hustle Coins` and `Game Naira` are non-redeemable in-game resources; real-money payouts remain disabled with HTTP `403 COMPLIANCE_LOCKOUT_ACTIVE`).

---

## Executive Summary

Project Eko's 3D humanoid character system (`EkoHumanCharacterSystem` & `EkoAnimStateMachine`), mobile-first touch interface (`EkoMobileTouchSystem`), mode-aware performance manager (`EkoPerformanceManager`), and `DANFO HUSTLE` 3D arcade runner (`EkoDanfoHustleMode`) have been verified end-to-end in a live Headless Chrome WebGL renderer across both **Living Lagos** (open-world mode) and **Danfo Hustle** (arcade mode).

All **7 end-to-end gameplay journeys (Section A)**, all **18 mandatory regression tests (Section B)**, and all **6 browser renderer performance profiles (Section C)**—including **4x CPU-throttled mobile portrait (`390×844`) and mobile landscape (`780×360`)**—passed with zero failures.

---

## 1. Defects Identified

During cross-system integration and live browser verification across `Living Lagos`, `Mobile-First Touch`, and `Danfo Hustle`, **8 defects** were identified and resolved:

| Defect ID | Subsystem | Defect Summary | Status |
| :--- | :--- | :--- | :--- |
| **DEF-01** | Input Reconciliation (`Keyboard` + `Touch`) | Releasing a touchscreen button (`pointerup` on `#btn-touch-drive-gas` or `#touch-joystick-zone`) unconditionally overwrote `keys.w = false`, cancelling an actively held physical keyboard key (`KeyW`), and vice versa (`keyup` cancelled an active touch hold). | **FIXED & VERIFIED (`b5_keyboardTouchConflict`)** |
| **DEF-02** | Modal Input Gating (`EkoInteractionSystem`) | `EkoInteractionSystem.isModalBlockingWorldInput()` and `closeTopmostModal()` did not include `#danfo-hustle-hub-modal` or `#danfo-hustle-results-modal`, allowing world keys to leak while the Danfo Hustle Hub or Results overlay was open. | **FIXED & VERIFIED (`Suite 14`)** |
| **DEF-03** | 3D Livery Persistence Across Browser Refresh | `createHeroApexDanfo()` did not tag its body panels with `name = 'chassisBodyMesh'`, and `EkoDanfoHustleMode.syncFromServer()` did not invoke `applyEquippedLiveryToDanfo()` after fetching `/api/v1/danfo-hustle/state`, causing equipped liveries (`unlock_livery_eko_gold`) to revert to default yellow after `Page.reload`. | **FIXED & VERIFIED (`b15_browserRefresh`)** |
| **DEF-04** | Interrupted Network Request Recovery (`EkoBackendSync`) | When a network request to `http://localhost:3001` failed mid-flight or timed out during transient connectivity loss, `EkoBackendSync.request()` dropped the mutating `POST` payload instead of queuing it for idempotent replay on reconnect. | **FIXED & VERIFIED (`b16_interruptedNetworkRequests`)** |
| **DEF-05** | Missing/Corrupt `.glb` Asset Fallback Diagnostics | While `EkoHumanCharacterSystem` constructed a 15-bone procedural `SkinnedMesh` rig, it lacked explicit 404/network failure telemetry and a deterministic fallback verification hook when an external `.glb` URI fails to load. | **FIXED & VERIFIED (`b18_assetFailureFallback`)** |
| **DEF-06** | Mobile 4x CPU Shader Recompilation Stall & Arcade Draw Calls | Switching `renderer.shadowMap.enabled` from `true` to `false` in `mobile_low` forced Three.js to recompile all WebGL shaders mid-session under `4x` CPU throttling, and `Danfo Hustle` kept all corridor coins, boosters, obstacles, and stop bays visible simultaneously (`168` draw calls). | **FIXED & VERIFIED (`Section C Performance Gate`)** |
| **DEF-07** | Trip Completion Endpoint Idempotency (`POST /api/v1/trips/complete`) | `EconomyLedger.postTransaction()` returns the existing transaction object on duplicate `idempotencyKey` rather than throwing; `POST /api/v1/trips/complete` did not check `postedTx.transactionId !== txId`, allowing duplicate replays to credit `demoPlayer.gameNairaBalance` a second time and desynchronize player cash from `Asset:Player:Cash`. | **FIXED & VERIFIED (`b11_rewardIdempotency`, `b12_gameNairaLedgerBalance`)** |
| **DEF-08** | Vehicle Dismount Priority Near Roadside Vendors (`handleInteractKey`) | Pressing `[E]` or tapping `#btn-touch-drive-interact` (`🚪 EXIT / ACT`) while driving near Mallam Haruna's Suya Stand (`z = -212`) without wholesale cargo triggered on-foot food purchase (`Priority 4`) instead of exiting the vehicle (`Priority 5`). | **FIXED & VERIFIED (`A.4 mobileDriving`)** |

---

## 2. Root Causes

1. **DEF-01 Root Cause:** Keyboard listeners (`window.addEventListener('keydown'/'keyup')`) and touch listeners (`EkoMobileTouchSystem`) both mutated the shared boolean `keys` object directly without tracking per-device hold state. Introducing `window.__PROJECT_EKO_KEYBOARD_HELD__` and `EkoMobileTouchSystem.isTouchHoldingKey(keyProp)` + `reconcileInputState()` ensures each `keys[k]` flag is the logical OR (`kb[k] || touchHold[k]`).
2. **DEF-02 Root Cause:** `#danfo-hustle-hub-modal` and `#danfo-hustle-results-modal` use the `.dh-modal-backdrop.open` class rather than inline `style.display = 'block'`. Adding `.classList.contains('open')` checks to `isModalBlockingWorldInput()` and `closeTopmostModal()` unified Escape-key and world-input gating across both modes.
3. **DEF-03 Root Cause:** `applyEquippedLiveryToDanfo()` traversed `heroDanfo` looking for `child.name === 'chassisBodyMesh' || child.name === 'danfoBody'`, which were unset on `lowerBody`, `upperBody`, and `roofCap`, and `syncFromServer()` updated `this.equippedLivery` without re-applying the material hex color (`0xF59E0B`).
4. **DEF-04 Root Cause:** `EkoBackendSync.request()` caught `fetch` errors and marked `this.online = false` but did not persist failed `POST` bodies alongside their `idempotencyKey`. Adding `pendingSyncQueue` and `flushPendingQueue()` guarantees zero lost rewards across network drops.
5. **DEF-05 Root Cause:** `EkoHumanCharacterSystem` needed `assetDiagnostics` (`verifiedGLBCount`, `totalGLBBytes`, `failedAssets`, `proceduralFallbackCount`) and `simulateAssetLoadFailure(uri)` to prove that a failed `.glb` fetch cleanly falls back to the 15-bone `SkinnedMesh` without crashing the scene.
6. **DEF-06 Root Cause:** Toggling `renderer.shadowMap.enabled` invalidates Three.js material programs, causing a multi-hundred-millisecond shader compilation spike under `4x` CPU throttling. Keeping `shadowEnabled: true` with `shadowUpdateInterval: 60` in `mobile_low` and adding corridor distance culling (`relZ >= -12 && relZ <= 46..65`) in `EkoDanfoHustleMode.update(dt)` eliminated shader recompilation stalls and reduced `Danfo Hustle` draw calls from `168` to `82–85` at a locked **60 FPS**.
7. **DEF-07 Root Cause:** `EconomyLedger.postTransaction()` is idempotent-safe and returns the original `GameLedgerTransaction` when `this.processedIdempotencyKeys.has(idempotencyKey)`. Checking `if (postedTx.transactionId !== txId)` in `POST /api/v1/trips/complete` before incrementing `demoPlayer.gameNairaBalance` prevents double-crediting and returns HTTP `409 DUPLICATE_TRANSACTION`.
8. **DEF-08 Root Cause:** `handleInteractKey()` evaluated `if (activeNearbySuya)` before `if (isDriving)` even when `!playerHasCargo`. Guarding Priority 4 with `if (activeNearbySuya && (playerHasCargo || !isDriving))` ensures that pressing `[E]` or `🚪 EXIT` inside a vehicle without cargo dismounts cleanly.

---

## 3. Files Changed

| File Path | Summary of Changes |
| :--- | :--- |
| `apps/game/index.html` | Added `window.__PROJECT_EKO_KEYBOARD_HELD__` & `EkoMobileTouchSystem.isTouchHoldingKey()` / `reconcileInputState()` / `recordTouchLatency()`; integrated `#danfo-hustle-hub-modal` & `#danfo-hustle-results-modal` into `EkoInteractionSystem`; tagged `heroDanfo` body meshes (`chassisBodyMesh`) and auto-applied liveries on `syncFromServer()`; added `EkoBackendSync.pendingSyncQueue`, `simulateNetworkInterruption()`, and `flushPendingQueue()`; added `EkoHumanCharacterSystem.assetDiagnostics` and `simulateAssetLoadFailure()`; upgraded `EkoPerformanceManager` (`v6.1.0-MODE-AWARE-PERF`) with frame-time percentiles (`min`/`avg`/`p50`/`p95`/`p99`/`max`), WebGL/JS heap telemetry, and corridor distance culling in `EkoDanfoHustleMode.update(dt)`; guarded `handleInteractKey()` Priority 4 with `(playerHasCargo || !isDriving)`. |
| `services/api/src/server.ts` | Updated `POST /api/v1/trips/complete` to pass `data.idempotencyKey` into `globalEconomyLedger.postTransaction()` and check `if (postedTx.transactionId !== txId)`, returning HTTP `409 DUPLICATE_TRANSACTION` (`idempotentReplay: true`) without double-crediting `demoPlayer.gameNairaBalance`. |
| `services/api/dist/server.js` | Compiled JavaScript output matching `services/api/src/server.ts` idempotency enforcement on `POST /api/v1/trips/complete`. |
| `scripts/run_all_tests.js` | Added **Suite 14** (`Complete Cross-System Integration, Regression & Performance Gate`), expanding the automated contract & unit suite to **36 passing tests (`0 failed`)**. |
| `scripts/verify_complete_acceptance.js` | Created full Headless Chrome CDP & WebGL verification harness executing Section A (7 E2E journeys), Section B (18 mandatory regressions), and Section C (6 Desktop & 4x CPU-throttled Mobile performance profiles) and exporting `ANTIGRAVITY/DELIVERY/complete_acceptance_verification.json` + screenshots. |

---

## 4. Models and Animation Assets Used

### 4.1 Canonical glTF 2.0 Binary (`.glb`) Character Assets
Verified via `/assets/characters/manifest.json` and `EkoHumanCharacterSystem.verifyGLBAssets()` (`verifiedGLBCount: 4`, `totalGLBBytes: 273,052`):

| Asset ID | File Path | Size (Bytes) | Skeleton & Mesh Specification |
| :--- | :--- | :--- | :--- |
| `citizen_male_casual` | `apps/game/assets/characters/citizen_male_casual.glb` | `68,148 B` | 15-bone humanoid armature (`Hips`, `Spine`, `Chest`, `Neck`, `Head`, `Shoulder_L/R`, `UpperArm_L/R`, `LowerArm_L/R`, `UpperLeg_L/R`, `LowerLeg_L/R`), `+Z` forward, `+Y` up |
| `citizen_female_smart` | `apps/game/assets/characters/citizen_female_smart.glb` | `68,696 B` | 15-bone humanoid armature, fitted Ankara peplum blouse & skirt silhouette, `+Z` forward, `+Y` up |
| `danfo_driver_pro` | `apps/game/assets/characters/danfo_driver_pro.glb` | `68,060 B` | 15-bone humanoid armature, Lagos commercial transit operator attire, `+Z` forward, `+Y` up |
| `street_vendor_apron` | `apps/game/assets/characters/street_vendor_apron.glb` | `68,148 B` | 15-bone humanoid armature, market trader apron & headwrap silhouette, `+Z` forward, `+Y` up |

### 4.2 Procedural 15-Bone `THREE.SkinnedMesh` Runtime Rig & 8 Wardrobe Archetypes
- Every player and citizen NPC instance in `EkoHumanCharacterSystem` (`version: '2.0.0-SKINNED-HUMANOID'`) is bound to a 15-bone `THREE.Skeleton` with anatomical Left at `+X` (`anatomicalLeftHipX: +0.1081m`) and anatomical Right at `-X` (`anatomicalRightHipX: -0.1081m`) when facing `+Z` (`forwardDot: 1.0`).
- **22 Supported Animation States in `EkoAnimStateMachine` (`STATES.length === 22`)**:
  - Core Locomotion & Transitions: `idle`, `idle_variation`, `walk_forward`, `walk`, `run`, `walk_backward`, `walk_back`, `turn_left`, `turn_right`, `strafe_left`, `strafe_right`, `start_move`, `stop_move`
  - Contextual & World Interactions: `talk_gesture`, `wave_hail`, `carry_load`, `vendor_work`, `enter_vehicle`, `exit_vehicle`, `driving`, `react_horn`, `interact`

### 4.3 5 Playable Hero Vehicles (`100% Original Procedural Project Eko IP`)
- `sedan`: **Adera Compact 1.6 Sedan** (`playerCar`)
- `danfo`: **Apex Danfo 14 Commercial Minibus** (`heroDanfo`, with dynamic livery support on `chassisBodyMesh`)
- `okada`: **Koro 125 Commercial Motorcycle** (`heroOkada`)
- `keke`: **Apex Keke 200 Tricycle** (`heroKeke`)
- `brt`: **EkoBRT 42 High-Capacity Coach** (`heroBRT`)

---

## 5. Controls Verified

All keyboard and touchscreen controls were verified across On-Foot, Open-World Driving, and Danfo Hustle Arcade modes with zero input inversion or stuck-key conflicts:

| Mode | Action | Desktop Keyboard / Mouse | Mobile Touchscreen Control | Verification Result |
| :--- | :--- | :--- | :--- | :--- |
| **On-Foot** | Walk Forward / Back | `W` / `S` or `↑` / `↓` | Left Virtual Analog Joystick (`#touch-joystick-zone`) Y-axis | **PASS** (`walk_forward` / `walk_backward`, `forwardDot = 1.0`) |
| **On-Foot** | Turn Left / Right | `A` / `D` or `←` / `→` | Joystick X-axis or dedicated `#btn-touch-turn-left` / `#btn-touch-turn-right` | **PASS** (`A`/Left increases `+playerHeading`, `D`/Right decreases `-playerHeading`) |
| **On-Foot** | Run / Sprint | Hold `Shift` | Hold `#btn-touch-foot-run` or tap to latch (`runLatched`) or full joystick deflection | **PASS** (`canonicalState = 'run'`, gait frequency scales with speed) |
| **On-Foot** | Camera Mode Cycle | `V` (Front View) / `C` (Cycle) / Mouse Orbit | Tap `#btn-touch-foot-cam` (`🤳 CAM`) | **PASS** (`chase` → `front` → `portrait` → `chase`) |
| **On-Foot** | Talk NPC / Board Vehicle | `E` | Tap `#btn-touch-foot-interact` (`⚡ ACT / DRIVE`) | **PASS** (Talks to NPC `<3.8m` or mounts parked vehicle) |
| **Driving (Open World)** | Accelerate / Brake-Reverse | `W` / `S` or `↑` / `↓` | Independent `#btn-touch-drive-gas` (`▲ GAS`) & `#btn-touch-drive-brake` (`▼ BRAKE`) | **PASS** (`speedAccelerating: 10.3 km/h`, `speedAfterBrake: 6.8 km/h`) |
| **Driving (Open World)** | Steer Left / Right | `A` / `D` or `←` / `→` | `#btn-touch-steer-left` (`◀`) & `#btn-touch-steer-right` (`▶`) | **PASS** (`Left` increases `+vehicleHeading`, `Right` decreases `-vehicleHeading`) |
| **Driving (Open World)** | Handbrake / Bus Stop | `Space` | `#btn-touch-drive-handbrake` (`🅿️ H-BRAKE`) | **PASS** (Brakes vehicle & boards waiting commuters at bus stops) |
| **Driving (Open World)** | Horn & NPC Reaction | `H` | `#btn-touch-drive-horn` (`📯 HORN`) | **PASS** (Plays horn & triggers `react_horn` on nearby NPCs) |
| **Driving (Open World)** | Exit Vehicle | `E` | `#btn-touch-drive-interact` (`🚪 EXIT / ACT`) | **PASS** (`exitedViaTouch: true` to safe sidewalk position) |
| **Danfo Hustle (Arcade)** | Lane Switch Left / Right | `A` / `D` or `←` / `→` | `#dh-btn-lane-left` (`◀ LEFT`) / `#dh-btn-lane-right` (`RIGHT ▶`) or horizontal swipe | **PASS** (Smooth lateral interpolation across 5 lanes `[-6.8, -3.4, 0, 3.4, 6.8]`) |
| **Danfo Hustle (Arcade)** | Suspension Hop / Horn / Board | `Space` / `H` / `E` | `#dh-btn-hop` (`⬆️ HOP`), `#dh-btn-horn` (`📯 HORN`), `#dh-btn-board` (`🚏 BOARD`) | **PASS** (Hops potholes, parts crossing pedestrians, boards commuters) |

---

## 6. Mobile Viewport Results

Audited via `EkoMobileTouchSystem.auditViewportLayout()` across mobile portrait, mobile landscape, and desktop viewports (`b17_responsiveUILayout.passed === true`):

| Viewport Profile | Dimensions | Aspect Ratio | Active HUD & Touch Elements Audited | Overlaps (`overlapCount`) | Out-of-Bounds (`outOfBoundsCount`) | Screenshot Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mobile Portrait** | `390 × 844` (`DPR 2`) | `0.462` | `minimap-card` (`137×48`), `hud-meta-right` (`235×42`), `gauge-cluster` (`336×45`), `touch-cluster-onfoot-left` (`146×84`), `touch-cluster-onfoot-right` (`146×83`) | **`0`** | **`0`** | `ANTIGRAVITY/DELIVERY/screenshots/acceptance_mobile_onfoot_390x844.png` |
| **Mobile Landscape** | `780 × 360` (`DPR 2`) | `2.167` | `minimap-card` (`178×48`), `hud-meta-right` (`235×42`), `gauge-cluster` (`336×45`), `touch-cluster-onfoot-left` (`158×72`), `touch-cluster-onfoot-right` (`158×83`) | **`0`** | **`0`** | `ANTIGRAVITY/DELIVERY/screenshots/acceptance_mobile_driving_780x360.png` |
| **Desktop Widescreen** | `1366 × 768` (`DPR 1`) | `1.779` | `minimap-card` (`309×134`), `hud-meta-right` (`675×88`), `gauge-cluster` (`357×128`), `quick-controls-card` (`380×114`), `brand-cluster` (`309×71`) | **`0`** | **`0`** | `ANTIGRAVITY/DELIVERY/screenshots/acceptance_danfo_hustle_1366x768.png` |

---

## 7. Danfo Hustle Mechanics

Verified in live browser execution (`A.5 danfoHustle` and `B.7`, `B.8`, `B.10`, `B.13`):

1. **5 Authentic Lagos Corridors:**
   - `route_cms_rush`: *CMS Passenger Rush* (`1,200m`, 3 stops, `₦250 GN` base fare, `+₦1,500 GN` & `+25 HC` bonus)
   - `route_ojuelegba_traffic`: *Ojuelegba Traffic Challenge* (`1,450m`, 3 stops, `₦300 GN` base fare, `+₦2,000 GN` & `+35 HC` bonus)
   - `route_yaba_market`: *Yaba Market Run* (`1,350m`, 3 stops, `₦280 GN` base fare, `+₦1,800 GN` & `+30 HC` bonus)
   - `route_oshodi_interchange`: *Oshodi Interchange Hustle* (`1,650m`, 4 stops, `₦350 GN` base fare, `+₦2,500 GN` & `+45 HC` bonus)
   - `route_marina_rain`: *Marina Rain Run* (`1,500m`, 3 stops, wet road traction, `₦320 GN` base fare, `+₦2,200 GN` & `+40 HC` bonus)
2. **4 Coin Placement Patterns (`Eko Hustle Coins`):**
   - `short_trail` (acceleration lane lines), `individual` (safe lane single pickups), `risk_reward_line` (2 HC high-value coins placed before hazards), and `optional_cluster` (outer lane 0/4 clusters).
   - **Zero Coin Duplication (`b13_coinDuplication`):** Collecting a coin immediately flags `coin.collected = true` and hides `coin.mesh.visible = false`; a second pass over the exact same coordinates yields `0` additional coins (`coinsAfterFirstPass: 1`, `coinsAfterSecondPass: 1`).
3. **5 Original Power-Ups / Boosters:**
   - `coin_magnet` (8s cross-lane coin attraction), `shield` (8s Eko Shield bubble absorbing the next obstacle impact with zero penalty), `lucky_fare` (2x passenger fare multiplier at the next bus stop), `clear_road` (6s ahead lane hazard parting), and `fuel_can` (+25% fuel restore & +120 pts).
4. **7 Lagos Obstacle & Hazard Archetypes & Ethical Pedestrian Rule:**
   - `pothole` & `tyre_pile` (low hazards clearable via `⬆️ HOP` suspension jump for `+80 PTS`), `roadblock_cone`, `handcart`, `stalled_danfo`, `keke_weaver`, and `pedestrian_crossing`.
   - **Pedestrian Safety Rule (`b8_pedestrianCollision`):** Honking (`[H]` / `📯 HORN`) causes crossing pedestrians to step aside safely and awards a `+40 PTS` safety bonus; colliding with a pedestrian never awards points, increments `pedestrianHits: 1`, resets combo multiplier to `1.0x`, and deducts `-900 PTS` (`scoreBeforePed: 1000` → `scoreAfterPed: 0`).
5. **Gradual Bus Stop Passenger Boarding (`b10_passengerBoarding`):**
   - Pulling into the green curbside loading bay (`Lane 0` or `Lane 4`) and braking (`speed < 18 km/h` or holding `S`/`Space`) advances `boardingProgress` gradually (`+1.15/s`) while waiting 3D passengers walk toward the Danfo door (`midBoardingProgress: 0.23`, `midBoardingCompleted: false` → `finishedBoardingCompleted: true`).

---

## 8. Economy Tests

All virtual rewards (`Game Naira` and `Eko Hustle Coins`) are governed by the double-entry `EconomyLedger` (`packages/economy/src/index.ts`) and authoritative API (`services/api/src/server.ts`):

- **A.5 Danfo Hustle Authoritative Run Settlement (`POST /api/v1/danfo-hustle/run/complete`):**
  - Settled `route_cms_rush` with `settlementOk: true`, awarding `+₦1,260 GN` (`initialGN: 49,350` → `postRunGN: 50,610`) and `+42 HC` (`initialHC: 80` → `postRunHC: 122`), backed by balanced double-entry journal lines (`Debit Asset:Player:Cash`, `Credit Revenue:Transport:DanfoHustleFares`).
- **A.6 Global Double-Entry Ledger Audit (`GET /api/v1/economy/ledger/audit`):**
  - Returned HTTP `200` with `ledgerBalanced: true` (`Sum(Debits) === Sum(Credits)`, `unresolvedDiscrepanciesCount: 0`).
- **B.11 Reward Idempotency (`b11_rewardIdempotency`):**
  - Submitting `POST /api/v1/trips/complete` with `idempotencyKey: "idem_reg_b11_..."` returned HTTP `200` on first submission and HTTP `409 DUPLICATE_TRANSACTION` (`idempotentReplay: true`) on duplicate replay, rejecting double-crediting.
- **B.12 Authoritative Balance Reconciliation (`b12_gameNairaLedgerBalance`):**
  - After `EkoBackendSync.syncAuthoritativeState()`, client HUD/player balance (`clientCash: 57,940`) matched the server profile balance (`serverBalance: 57,940`) to the exact Naira.
- **B.16 Interrupted Network Request Queue & Recovery (`b16_interruptedNetworkRequests`):**
  - Simulated a `600ms` network outage via `EkoBackendSync.simulateNetworkInterruption(600)` during `syncTripCompletion()`; verified the request was queued (`queuedDuringOutage: 1`) and automatically flushed on reconnect (`flushedCount: 1`, `remainingQueue: 0`).
- **Non-Fiat Compliance Lockout:**
  - `GET /api/v1/rewards/sandbox` enforces `payoutEnabled: false`, and `POST /api/v1/rewards/redeem` with `requestFiatPayout: true` returns HTTP `403 COMPLIANCE_LOCKOUT_ACTIVE`.

---

## 9. Browser Test Evidence

Executed via `node scripts/verify_complete_acceptance.js` against a live Headless Chrome WebGL instance (`ANTIGRAVITY/DELIVERY/complete_acceptance_verification.json`):

### 9.1 Section A — End-to-End Gameplay Journeys (`7/7 PASS`)
- **A.1 Living Lagos E2E Journey:** Spawned on foot at `(-83.8, -208)` in `idle` state → walked forward `0.64m` (`walk_forward`) → turned left & right → opened NPC dialogue (`dialogueOpened: true`) → mounted `heroDanfo` (`enteredVehicle: true`, `driveSeatedAnim: 'driving'`) → drove through traffic at `15.3 km/h` → boarded 4 passengers at CMS bus stop (`onboardAfterStop: 4`) → completed mission (`cashBeforeMission: ₦48,150 GN` → `cashAfterMission: ₦49,350 GN`).
- **A.2 Character Controls:** Verified `idle`, `walk_forward`, `run`, `walk_backward`, `turn_left`, `turn_right` and camera cycle `['front', 'portrait', 'chase', 'front']` across all 22 state-machine states.
- **A.3 Mobile Exploration (`390×844` Touch-Only):** Moved `2.12m` forward via virtual joystick (`joyForwardAnim: 'run'`), turned left via joystick X-deflection (`turnedLeftViaJoystick: true`), toggled run latch, and switched camera via `#btn-touch-foot-cam` (`cameraSwitchedViaTouch: true`).
- **A.4 Mobile Driving (`780×360` Touch-Only):** Boarded vehicle via `#btn-touch-foot-interact` (`enteredViaTouch: true`), accelerated to `10.3 km/h` via `#btn-touch-drive-gas`, steered left & right via `#btn-touch-steer-left`/`#btn-touch-steer-right`, braked to `6.8 km/h` via `#btn-touch-drive-brake`, sounded horn via `#btn-touch-drive-horn`, and exited cleanly to the sidewalk via `#btn-touch-drive-interact` (`exitedViaTouch: true`).
- **A.5 Danfo Hustle Full Run:** Completed `route_cms_rush` (`earnedGN: 1,260`, `earnedHC: 42`, `settlementOk: true`) and returned to `Living Lagos` (`returnedToLivingLagos: true`).
- **A.6 & A.7 Economy & Existing Systems:** Verified EkoPhone (`wallet`, `jobs`, `biz`, `fleet`, `motors`), garage vehicle summon (`summonedOkada: true`), fleet dispatch settlement (`HTTP 200`), business earnings collection (`HTTP 200`), and multiplayer presence worker (`realtimeWorkerStatus: 'ok'`).

### 9.2 Section B — 18 Mandatory Regression Tests (`18/18 PASS`)

| # | Regression Test ID | Key Measured Telemetry | Result |
| :--- | :--- | :--- | :--- |
| 1 | `b1_characterOrientation` | `forwardDot: 1.0`, `anatomicalLeftHipX: +0.1081`, `anatomicalRightHipX: -0.1081` | **PASS** |
| 2 | `b2_walkAnimSync` | `walkingState: 'walk_forward'`, `stoppedState: 'idle'`, `gaitFrequencyHz: 1.2733` | **PASS** |
| 3 | `b3_footSliding` | `minStanceFootClearanceM: 0`, `strideLengthM: 1.9664`, `stanceFoot: 'left'` | **PASS** |
| 4 | `b4_leftRightCorrectness` | `onFootLeftRightOk: true`, `drivingSteerOk: true`, `arcadeLaneSwitchOk: true` | **PASS** |
| 5 | `b5_keyboardTouchConflict` | `keyWPreservedAfterTouchRelease: true`, `touchHoldPreservedAfterKeyUp: true`, `bothReleasedCleanly: true` | **PASS** |
| 6 | `b6_vehicleSteering` | `vYaw0: -0.217` → `vYawLeft: -0.0363` (`+yaw`) → `vYawRight: -0.2342` (`-yaw`) | **PASS** |
| 7 | `b7_vehicleCollision` | `collBefore: 0` → `collAfter: 1` | **PASS** |
| 8 | `b8_pedestrianCollision` | `pedestrianHits: 1`, `scoreBeforePed: 1000` → `scoreAfterPed: 0` (safety penalty) | **PASS** |
| 9 | `b9_vehicleSpawning` | All 5 classes (`sedan`, `danfo`, `okada`, `keke`, `brt`) spawned at `groundY: 0.05m` | **PASS** |
| 10 | `b10_passengerBoarding` | `midBoardingCompleted: false` (`0.23`), `finishedBoardingCompleted: true` (`1.00`) | **PASS** |
| 11 | `b11_rewardIdempotency` | `firstStatus: 200`, `duplicateStatus: 409` (`error: 'DUPLICATE_TRANSACTION'`) | **PASS** |
| 12 | `b12_gameNairaLedgerBalance` | `clientCash: 57940 === serverBalance: 57940` | **PASS** |
| 13 | `b13_coinDuplication` | `coinsBefore: 0` → `coinsAfterFirstPass: 1` → `coinsAfterSecondPass: 1` | **PASS** |
| 14 | `b14_repeatedButtonPresses` | `suppressionsBefore: 0` → `suppressionsAfter: 2` (`debouncedTapSuppressions`) | **PASS** |
| 15 | `b15_browserRefresh` | `cash: 57940`, `hc: 80`, `equippedLivery: 'unlock_livery_eko_gold'`, `danfoHex: 0xF59E0B` preserved across `Page.reload` | **PASS** |
| 16 | `b16_interruptedNetworkRequests` | `queuedDuringOutage: 1`, `flushedCount: 1`, `remainingQueue: 0` | **PASS** |
| 17 | `b17_responsiveUILayout` | `overlapCount: 0`, `outOfBoundsCount: 0` across `390×844`, `780×360`, and `1366×768` | **PASS** |
| 18 | `b18_assetFailureFallback` | `fallbackTriggered: true`, `fallbackMeshCreated: true`, `boneCount: 15`, `verifiedGLBCount: 4` | **PASS** |

---

## 10. Performance Results

Measured directly from the live Chrome WebGL renderer (`renderer.info.render`, `renderer.info.memory`, `performance.memory`, and `EkoPerformanceManager`) across both **Living Lagos** and **Danfo Hustle**, with **4x CPU throttling (`Emulation.setCPUThrottlingRate({ rate: 4 })`)** applied on all mobile profiles:

| Profile ID | Mode | Viewport | CPU Throttle | Quality Preset | FPS | Frame Time (`min` / `avg` / `p50` / `p95` / `p99` / `max` ms) | Draw Calls | Triangles | JS Heap Used / Total | WebGL Geoms / Textures | Initial Load Time | Asset Payload (`HTML` + `GLB`) | Avg Touch Latency | NPC LOD (`Full` / `Throttled` / `Culled`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `living_lagos_desktop_1366x768` | Living Lagos | `1366×768` | `1x` | `desktop_high` | **60 FPS** | `14.9` / `16.64` / `16.7` / `18.4` / `18.4` / `18.4` ms | `50` | `32,592` | `44.53 MB` / `68.36 MB` | `88` / `32` | `218 ms` | `1,458.6 KB` (`1.22 MB` + `273 KB`) | `4.70 ms` | `11` / `14` / `6` |
| `living_lagos_mobile_portrait_390x844_4xCPU` | Living Lagos | `390×844` | **`4x` CPU** | `mobile_balanced` | **60 FPS** | `15.1` / `16.64` / `16.7` / `18.5` / `18.6` / `18.6` ms | `49` | `28,184` | `37.39 MB` / `69.78 MB` | `88` / `32` | `218 ms` | `1,458.5 KB` | `2.60 ms` | `3` / `17` / `11` |
| `living_lagos_mobile_landscape_780x360_4xCPU` | Living Lagos | `780×360` | **`4x` CPU** | `mobile_low` | **61 FPS** | `11.0` / `16.42` / `16.7` / `18.1` / `18.4` / `18.4` ms | `40` | `26,804` | `42.86 MB` / `70.94 MB` | `90` / `32` | `218 ms` | `1,458.6 KB` | `2.07 ms` | `2` / `15` / `14` |
| `danfo_hustle_desktop_1366x768` | Danfo Hustle | `1366×768` | `1x` | `desktop_high` | **60 FPS** | `15.3` / `16.62` / `16.6` / `18.4` / `18.4` / `18.4` ms | `82` | `24,706` | `38.66 MB` / `72.28 MB` | `118` / `32` | `218 ms` | `1,456.5 KB` | `1.58 ms` | `0` / `3` / `28` |
| `danfo_hustle_mobile_portrait_390x844_4xCPU` | Danfo Hustle | `390×844` | **`4x` CPU** | `mobile_balanced` | **60 FPS** | `14.5` / `16.68` / `16.9` / `18.8` / `18.8` / `18.8` ms | `83` | `24,770` | `43.34 MB` / `73.44 MB` | `120` / `32` | `218 ms` | `1,456.5 KB` | `1.28 ms` | `0` / `3` / `28` |
| `danfo_hustle_mobile_landscape_780x360_4xCPU` | Danfo Hustle | `780×360` | **`4x` CPU** | `mobile_low` | **60 FPS** | `11.8` / `16.54` / `16.4` / `18.7` / `19.2` / `19.2` ms | `85` | `24,738` | `48.19 MB` / `74.61 MB` | `120` / `32` | `218 ms` | `1,456.5 KB` | `1.25 ms` | `1` / `2` / `28` |

---

## 11. Known Limitations

1. **In-Memory Backend Persistence Across Server Restarts:** While client state and backend ledger state persist across browser refreshes (`Page.reload` verified in `b15_browserRefresh`), `services/api/src/server.ts` currently stores `demoPlayer`, `globalEconomyLedger`, and `global.__DANFO_HUSTLE_STATE__` in Node.js process memory rather than a persistent PostgreSQL/SQLite store when the API process itself is restarted.
2. **Corridor Geometry Wrapping on Multi-Kilometre Arcade Runs:** `Danfo Hustle` routes up to `1,650m` (`route_oshodi_interchange`) recycle the Marina–CMS–Broad Street–TBS 3D corridor geometry seamlessly via longitudinal loop wrapping (`worldUnitsDriven`) rather than streaming separate mainland district meshes for Yaba and Oshodi.
3. **Simulated CPU Throttling vs. Physical Mobile Thermal Throttling:** Mobile performance was measured in Headless Chrome using `Emulation.setCPUThrottlingRate({ rate: 4 })`, `deviceScaleFactor: 2`, and touch emulation at `390×844` and `780×360`; physical entry-level Android/iOS hardware may experience additional GPU fill-rate variance under sustained thermal load, which is mitigated by the user-selectable `mobile_low` (`1.0x` DPR) preset.

---

## 12. Features Still Using Placeholders

1. **Audio Synthesis (`AudioEngine`):** Engine revving, horn blasts, door chimes, footsteps, cash register chimes, and Lagos ambient soundscapes are generated procedurally in real time using the Web Audio API (`AudioContext` oscillators and noise buffers) rather than external recorded `.mp3`/`.ogg` voice-over and foley stems.
2. **Real-Rewards Partner Voucher Fulfillment (`/api/v1/rewards/redeem`):** Telecom data (`10GB MTN/Airtel`), electricity utility tokens (`EKEDC`), and fuel vouchers (`NNPC`) issue deterministic sandbox voucher codes (`EKO-SBX-...`) with `payoutEnabled: false` pending licensed Payment Service Provider and regulatory integration.
3. **Multiplayer Remote Peer Bots (`services/realtime`):** The realtime WebSocket/HTTP presence server (`http://localhost:3002`) broadcasts live player telemetry alongside simulated autonomous Lagos corridor operators (`Bayo_Keke`, `Ifeoma_Trader`, `Tunde_Danfo`) when only a single human browser session is connected.

---

## 13. Recommended Next Milestone

**Milestone M4 — Persistent Database Storage, Mainland District Streaming & Recorded Nigerian Voice/Foley Pack:**
1. **PostgreSQL / SQLite Ledger & Profile Persistence:** Persist `EconomyLedger` journal entries, `PlayerProfile`, vehicle deeds, and `Danfo Hustle` records/unlocks to disk so authoritative state survives API server restarts and deployments.
2. **Dedicated Mainland 3D Corridor Meshes (Ojuelegba Flyover, Yaba Tejuosho Market & Oshodi Skybridge):** Expand the 3D world graph beyond the Marina–CMS–TBS island spine with distinct mainland landmark geometry for the `Ojuelegba`, `Yaba`, and `Oshodi` Danfo Hustle routes.
3. **Recorded Nigerian Pidgin Voice & Afrobeats/Fuji Stems:** Supplement the procedural Web Audio synthesizer with compressed `.opus`/`.webm` voice callouts for bus conductors (*"Owa o! CMS, Broad Street, TBS, enter with your change o!"*) and ambient street foley.
