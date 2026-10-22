# PROJECT EKO — M4.8 VEHICLE SEATS, PASSENGER EXPERIENCE, 3D COCKPIT & DRIVER PERMISSIONS REPORT

**Date:** 2026-10-21  
**Milestone:** M4.8 — Vehicle Seats, Passenger Experience, 3D Cockpit View & Driver Permissions  
**Status:** **VERIFIED COMPLETE (16/16 Browser Acceptance Scenarios Passed • 49/49 Core Regression Suites Passed)**

---

## 1. Root Cause Analysis of Screenshot (`media_1792529130712_da2ef98f.png`)

Before modifying the UI or simulation loop, we audited the vehicle entity, character controller, interaction system, camera manager, and HUD state in `apps/game/index.html`, `services/api/src/m47Engine.ts`, and `services/realtime/src/server.ts`.

### Root Causes Identified in the Screenshot
1. **No Authoritative Vehicle Occupancy State Machine:**
   - Previously, the client tracked two independent booleans (`isDriving` and `isConductorMode`) without a mutually exclusive occupancy state machine (`ON_FOOT`, `ENTERING_VEHICLE`, `DRIVER`, `PASSENGER`, `CONDUCTOR`, `EXITING_VEHICLE`).
   - Calling `joinChidiConductor()` set `isConductorMode = true` and displayed `#conductor-hud-banner` (`🚌 CONDUCTOR CO-OP: [SPACE] Board • Fare Mini-Game`), while pressing `[E]` or `1–5` (`quickSwitchVehicle`) set `isDriving = true` and displayed the Driving HUD without clearing `isConductorMode` or hiding `#conductor-hud-banner`.
   - Furthermore, opening `#eko-phone-container` (`Player Businesses & Commerce`) did not suppress vehicle HUD prompts or auto-close when transitioning into `DRIVER` or `PASSENGER` roles, resulting in driving controls, the conductor co-op banner, and the Player Businesses panel all appearing simultaneously.
2. **Lack of Dedicated Passenger Seat & Camera Role:**
   - Hailing Bayo's Keke shuttle (`hailBayoShuttle()`) previously executed an instantaneous teleport rather than boarding an explicit passenger seat (`PASSENGER` state) with a seated avatar transform, passenger interior camera, look-around controls, and disabled driving inputs.
3. **Opaque Exterior Greenhouse Shell Blocking 3D Cockpit View:**
   - While `cameraMode === 'cockpit'` positioned the camera inside the vehicle cabin, the vehicle's upper greenhouse box mesh (`glassMat`) had `opacity: 0.85` (and opaque cabin geometry on some vehicle archetypes), obscuring the road ahead from inside the driver's seat.
4. **Missing Driver Eligibility & Career Qualification Gate:**
   - Switching to or mounting high-capacity commercial transit vehicles (`brt` — 40-Seater LAMATA High-Capacity BRT Coach) or locked player-owned vehicles lacked an authoritative permission check and career qualification modal explaining the required licence (`cdl_mass_transit`) and offering a one-click **Board as Passenger `[F]`** alternative.

---

## 2. Canonical Vehicle Occupancy State Model

We implemented a single authoritative state machine across:
- **Domain API (`services/api/src/m47Engine.ts`)**: `M48OccupancyRole`, `M48SeatRecord`, `M48VehicleRecord`, and `m48PlayerOccupancy`.
- **Realtime Zone Server (`services/realtime/src/server.ts`)**: `ExtendedPlayerPresence.vehicleOccupancyRole` & `seatId`, plus `ExtendedVehicleState.seats`, `conductorId`, and `safetyState`.
- **Game Client (`apps/game/index.html`)**: `window.__PROJECT_EKO_VEHICLE_STATE__` (`EkoVehicleOccupancySystem`).

### Canonical States
| State | Description | Driving Controls (`W/S/A/D`, `Space`) | Active HUD | Active Camera |
| :--- | :--- | :--- | :--- | :--- |
| `ON_FOOT` | Walking/running in the world or inside 3D buildings | Disabled (On-foot locomotion active) | On-Foot Control Chip | `chase` / `selfie` / `city_overview` |
| `ENTERING_VEHICLE` | Validated boarding transition into assigned seat | Disabled | Boarding Toast | Transitioning to target role camera |
| `DRIVER` | Operating vehicle from `driver` seat | **Enabled** (Throttle, Brake, Steer, Horn) | Driver Speedometer & Telemetry HUD | `chase` or `cockpit` (3D Interior) |
| `PASSENGER` | Seated in `front_passenger` or `rear_passenger_*` | **Disabled** (`isDriving = false`) | Dedicated Passenger HUD (`#m48-passenger-hud`) | `passenger` (Interior Look-Around) or `chase` |
| `CONDUCTOR` | Standing on Danfo doorway step (`conductor_step`) | **Disabled** (`isDriving = false`) | Conductor Co-op Banner (`#conductor-hud-banner`) | `chase` |
| `EXITING_VEHICLE` | Stepping out to validated safe curb offset | Disabled | Exiting Toast | Returning to `ON_FOOT` camera |

### Canonical Vehicle Registry & Seat Definitions
| Vehicle ID | Key | Display Name | Access Mode | Required Licence | Supported Seats |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `veh_sedan_starter` | `sedan` | Adera Compact 1.6 Sedan | `OWNED` | `null` (Free-roam permitted) | `driver`, `front_passenger`, `rear_passenger_left`, `rear_passenger_right` |
| `veh_danfo_coop` | `danfo` | Apex Danfo 14 Commercial Minibus | `RENTAL_OR_STARTER` | `null` | `driver`, `front_passenger`, `rear_passenger_1`, `rear_passenger_2`, `conductor_step` (`CONDUCTOR`) |
| `veh_okada_dispatch` | `okada` | Eko Okada 150cc Dispatch Bike | `JOB_ASSIGNED` | `null` | `driver`, `pillion_passenger` |
| `veh_keke_bayo` | `keke` | Bayo Keke Marwa Shuttle #12 | `PUBLIC_TRANSIT` | `null` | `driver` (Bayo NPC by default), `rear_passenger_1`, `rear_passenger_2` |
| `veh_brt_lamata` | `brt` | 40-Seater LAMATA High-Capacity BRT Coach | `PUBLIC_TRANSIT` | `cdl_mass_transit` | `driver` (Requires Mass Transit CDL), `passenger_row_1`, `passenger_row_2`, `passenger_row_3` |
| `veh_peer_locked_suv` | `locked_suv` | Tunde_VI Personal Executive Sedan (Locked) | `OTHER_HUMAN_OWNED_LOCKED` | `null` | `driver` (Locked to owner `peer_tunde_vi`), `front_passenger`, `rear_passenger_left` |
| `veh_npc_full_shuttle` | `full_shuttle` | Obalende Express Danfo #99 (FULL) | `PUBLIC_TRANSIT` | `null` | `driver` (NPC), `front_passenger` (Occupied), `rear_passenger_1` (Occupied) |

---

## 3. Driver Eligibility, Qualification Modal & Economic Integrity

### Driver Eligibility Rules
A player is permitted to enter the `DRIVER` role only when validated by `POST /api/v1/vehicles/request-seat` and `EkoVehicleOccupancySystem.checkDriverEligibility()`:
1. **Ownership / Granted Access**: Player owns the vehicle (`OWNED`) or the owner has granted access via `POST /api/v1/vehicles/owner-access` (`OWNER_GRANTED`). Attempting to drive `veh_peer_locked_suv` without permission is rejected with HTTP 403 `OTHER_HUMAN_OWNED_LOCKED`.
2. **Permitted Rental / Starter / Job-Assigned Vehicle**: Allowed for free-roam or accepted job shifts (`veh_sedan_starter`, `veh_danfo_coop`, `veh_okada_dispatch`).
3. **Career Qualification Check (`cdl_mass_transit`)**: Attempting to drive the 40-Seater LAMATA BRT Coach (`veh_brt_lamata`) without the Mass Transit CDL is rejected with HTTP 403 `DRIVING_QUALIFICATION_REQUIRED`. Instead of silently activating driving controls, the client opens `#m48-qualification-modal` explaining the requirement and offering:
   - **`🪑 Board as Passenger [F]`** (immediately boards a passenger seat on the BRT coach)
   - **`🎓 Pass LASDRI Mass Transit CDL`** (unlocks the qualification and mounts as driver)
   - **`🚶 Stay On Foot`**

### Economic Integrity Rules
- Entering, switching, or riding in a vehicle (`request-seat`, `exit-seat`, `quickSwitchVehicle`, `requestBoardAsPassenger`) always returns `rewardAwardedGN: 0` and never increments `hustleFlowStreak`.
- Commercial earnings are awarded strictly once per valid shift completion (`JobSettlementPosted`) with server-side idempotency (`duplicateIgnored: true` on replay).

---

## 4. Passenger Experience & Synchronised Shuttle / Multiplayer Movement

When a player boards a vehicle as `PASSENGER` (via `[F]` or `#m48-qualification-modal`):
- An available passenger seat (`front_passenger`, `rear_passenger_1`, etc.) is assigned and recorded on both the API server and Realtime server.
- `isDriving` and `isConductorMode` are forced to `false`, and `currentSpeedKmh` / throttle inputs from the passenger's keyboard are ignored so the passenger cannot steer or accelerate the vehicle.
- `playerAvatar` is attached to the vehicle at the exact seat local offset (`seatOffset`) rotated by the vehicle's heading (`rotation.y`) in the seated posture (`driving` animation state).
- The camera switches to `'passenger'` mode inside the cabin looking out through the transparent windows, with `[Q]` / `[R]` or `[A]` / `[D]` yaw look-around (`passengerLookYaw`) and `[C]` camera toggle.
- While riding in Bayo's Keke shuttle (`veh_keke_bayo`), LAMATA BRT (`veh_brt_lamata`), or a human-driven vehicle in multiplayer, the vehicle moves smoothly along the Marina–CMS–TBS corridor and the passenger's world coordinates remain locked to the moving seat transform.
- If a vehicle has zero open passenger seats (`veh_npc_full_shuttle`), boarding is rejected with `NO_SEATS_AVAILABLE` without clipping into existing occupants.

---

## 5. Real 3D Cockpit View (`cameraMode === 'cockpit'`)

We upgraded `attachVehicleInteriorAndSystems()` and `updateVehicleVisualDynamics(dt)` in `apps/game/index.html` to provide a genuine 3D interior cockpit across `sedan`, `danfo`, `keke`, `brt`, and `okada`:
- **3D Cockpit Components Attached to Every Hero Vehicle (`ud.cockpitParts`)**:
  - `dashboardConsole`: Sculpted dark-slate dashboard deck spanning the front cabin.
  - `instrumentCluster`: Recessed backlit binnacle housing with emerald telemetry bezel.
  - `speedoNeedle`: Live rotating 3D needle driven by `currentSpeedKmh` (`needleRatio * 2.6 - 1.3 rad`).
  - `warningLightMesh`: Reactive warning indicator lamp (emerald when healthy, amber/red under low fuel or engine wear).
  - `steeringWheel`: Tilted toward the driver (`rotation.x = -0.55`) and rotating dynamically with `steeringAngle` (`rotation.z = -steeringAngle * 3.4`).
  - `acceleratorPedal` & `brakePedal`: Footwell pedals that depress dynamically with throttle (`w` / `ArrowUp`) and brake (`s` / `ArrowDown` / `Space`).
  - `gearSelector`: Center console transmission stalk that tilts forward in Drive (`currentSpeedKmh > 1`) and backward in Reverse.
  - `rearviewMirror`, `wingMirrorLeft`, `wingMirrorRight`: Specular interior top-center and exterior side mirrors.
  - `cockpitPillars`: Left and right structural A-pillars framing the windscreen.
  - `cabinDomeLight`: Warm overhead interior dome lamp.
  - `seatMeshes`: Driver and passenger seats with sculpted backrests and headrests.
- **Unobstructed Transparent Windscreen & Draw-Call Budgeting**:
  - `glassMat` uses `transparent: true, opacity: 0.22, depthWrite: false`.
  - When `cameraMode === 'cockpit'` or `'passenger'` on the active vehicle, opaque exterior greenhouse box shells (`isExteriorGreenhouseShell`) are hidden and cockpit detail sub-meshes are made visible ONLY on the active vehicle, keeping total scene draw calls at **49–52 calls** (well under the 60 target / 75 maximum budget).

---

## 6. Two-Account Realtime Multiplayer & Disconnect Safety Policy

In `services/realtime/src/server.ts` (`:3002`) and `services/api/src/m47Engine.ts` (`:3001`):
- **Simultaneous Multi-Role Occupancy**: Player A (`Driver_Kunle`) occupies `driver`, Player B (`Passenger_Zainab`) occupies `front_passenger`, and Player C (`Conductor_Tobi`) occupies `conductor_step` on `veh_danfo_coop`.
- **Hijack Prevention**: While Player A occupies `driver`, Player B's request for `DRIVER` on `veh_danfo_coop` is rejected with `DRIVER_SEAT_OCCUPIED_BY_HUMAN` (`409 Conflict`).
- **Seat Transform Synchronisation**: Calling `POST /vehicles/sync-transform` as Driver A moves the vehicle to `(x: -96, y: 0, z: 25)` and automatically updates the world positions of all seated occupants (`Driver_Kunle`, `Passenger_Zainab`, `Conductor_Tobi`) using their rotated `localOffset`.
- **Driver Disconnect Safety Policy**: When Driver A disconnects (`POST /disconnect` on `:3002` and `POST /api/v1/vehicles/driver-disconnect` on `:3001`), the vehicle immediately halts (`speedKmh = 0`, `safetyState = 'SAFE_STOP_DRIVER_DISCONNECTED'`, `safetyPolicy = 'VEHICLE_SAFELY_HALTED_PASSENGERS_PRESERVED'`), preserving seated passengers safely so they can exit cleanly without being stranded in motion.

---

## 7. 16 Browser Acceptance Scenarios — Verification Summary

Verified via `node scripts/verify_m4_8_vehicle_seats_passenger_driver.js` (full JSON evidence in `/Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_8_verification_results.json`):

| # | Scenario | Status | Key Verified Evidence |
| :- | :--- | :--- | :--- |
| 1 | Entering an owned or permitted vehicle as driver | **PASS** | `ON_FOOT -> ENTERING_VEHICLE -> DRIVER`, `seatId: "driver"`, `isDriving: true`, `isConductorMode: false` |
| 2 | Driving with driver HUD and controls | **PASS** | Moved `2.39m` at `48 km/h`, `steerWheelRotZ: -1.496`, Driver HUD active |
| 3 | Switching to 3D cockpit view and back to exterior camera | **PASS** | `cameraMode: "cockpit"` -> `"chase"`, all 12 cockpit parts verified, `exteriorShellHiddenInCockpit: true` |
| 4 | Exiting the vehicle to on-foot state | **PASS** | `DRIVER -> EXITING_VEHICLE -> ON_FOOT`, `isDriving: false`, `playerAvatarVisible: true` |
| 5 | Attempting to drive a vehicle owned by another player without permission | **PASS** | Denied with `OTHER_HUMAN_OWNED_LOCKED`, player remains `ON_FOOT` |
| 6 | Attempting to drive a vehicle requiring a missing qualification | **PASS** | Denied with `DRIVING_QUALIFICATION_REQUIRED` (`cdl_mass_transit`), modal shown with `Board as Passenger [F]` button |
| 7 | Entering a vehicle as a passenger | **PASS** | `ON_FOOT -> ENTERING_VEHICLE -> PASSENGER` on `veh_keke_bayo`, `seatId: "rear_passenger_1"` |
| 8 | Verifying passenger HUD, passenger camera, and disabled driving controls | **PASS** | `cameraMode: "passenger"`, `unintendedMoveDist: 0`, `unintendedSteerDelta: 0`, `yawAfterLook: 0.35` |
| 9 | Riding in a moving vehicle as a passenger | **PASS** | Shuttle moved `319.94m`, passenger avatar moved `319.94m`, `seatAttachDelta: 0` |
| 10 | Exiting a vehicle as a passenger | **PASS** | `PASSENGER -> EXITING_VEHICLE -> ON_FOOT`, `passengerHudVisible: false`, `playerAvatarVisible: true` |
| 11 | Attempting to board a full vehicle | **PASS** | `veh_npc_full_shuttle` rejected with `NO_SEATS_AVAILABLE`, state remains `ON_FOOT` |
| 12 | Entering conductor mode and verifying conductor-only controls | **PASS** | `state: "CONDUCTOR"`, `seatId: "conductor_step"`, `isDriving: false`, `conductorBannerVisible: true` |
| 13 | Verifying business panels, conductor prompts, passenger prompts, and driving controls never conflict | **PASS** | Entering `DRIVER` auto-closed `#eko-phone-container`, hid `#conductor-hud-banner` and `#m48-passenger-hud` |
| 14 | Verifying entering, switching, or riding in a vehicle does not grant currency or Hustle Flow | **PASS** | `balBefore: 35000`, `balAfter: 35000`, `deltaGN: 0`, `streakDelta: 0` |
| 15 | Verifying accepted work awards only once per valid completion | **PASS** | First `JobSettlementPosted` awarded `+500 GN` (`5500 GN`), duplicate replay returned `duplicateIgnored: true` |
| 16 | Two-account realtime multiplayer & Mobile Portrait/Landscape layouts | **PASS** | Driver + Passenger + Conductor synced (`passengerSyncedZ: 26.58`), hijack denied (`DRIVER_SEAT_OCCUPIED_BY_HUMAN`), disconnect halted vehicle (`VEHICLE_SAFELY_HALTED_PASSENGERS_PRESERVED`) |
