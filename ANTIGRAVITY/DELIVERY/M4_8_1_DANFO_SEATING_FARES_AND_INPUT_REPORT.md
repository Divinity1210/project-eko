# PROJECT EKO — M4.8.1 DELIVERY REPORT
## DANFO INPUT REPAIR, 14-SEAT HOLLOW CABIN, ROUTES, STOP-BASED FARES & CONDUCTOR SYSTEM

**Milestone:** M4.8.1  
**Status:** Complete & Verified (22 / 22 Acceptance Tests Passing, Zero Console/Page Errors)  
**Audit Companion:** [`ANTIGRAVITY/DELIVERY/M4_8_1_KEYBINDING_AUDIT.md`](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/M4_8_1_KEYBINDING_AUDIT.md)

---

## 1. Root Cause of the `F` Keybinding Conflict

### Observed Defect
When standing on foot next to the **Apex Danfo 14** (`heroDanfo`), the proximity prompt displayed:
`🚐 APEX DANFO 14: [E] DRIVE • [F] BOARD AS PASSENGER • [G] JOIN AS CONDUCTOR`
However, pressing `F` opened the **Eko Citizen Flex Card (`#flex-card-modal`)** instead of boarding the Danfo as a passenger.

### Root Cause
1. In [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html), the primary `keydown` listener inside `setupInputListeners()` unconditionally bound `if (k === 'f') { openEkoFlexCard(); return; }`.
2. Simultaneously, the top-left HUD button `#btn-header-flex-card` advertised `🪪 Flex Card (F)`.
3. Although `EkoVehicleOccupancySystem.boardAsPassenger()` existed from M4.8, no keyboard handler routed `KeyF` to `tryBoardNearestVehicleAsPassenger()`, so `openEkoFlexCard()` swallowed every `F` keypress globally.

### Resolution
1. Removed `F` from Flex Card (`#btn-header-flex-card` now displays `🪪 Flex Card`, and optional non-conflicting shortcut `KeyU` is registered for Flex Card).
2. Established the authoritative central keybinding registry `window.__PROJECT_EKO_KEYBINDING_REGISTRY__` (`EkoKeybindingRegistry`) in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html).
3. Bound `KeyF` exclusively to `vehicle.board_passenger` (`tryBoardNearestVehicleAsPassenger()`) when on foot near a vehicle, and confirmed with automated assertion that pressing `F` **never** opens `#flex-card-modal`.

---

## 2. Central Keybinding Registry Table (`window.__PROJECT_EKO_KEYBINDING_REGISTRY__`)

| Action ID | Key / Code | Active Context(s) | Exclusive | Description |
| :--- | :--- | :--- | :---: | :--- |
| `ui.close_modal` | `Escape` | `GLOBAL`, `MODAL_OPEN` | Yes | Closes active topmost modal/drawer cleanly |
| `locomotion.forward_or_throttle` | `KeyW` / `ArrowUp` | `ON_FOOT`, `DRIVER`, `DANFO_HUSTLE` | No | Walk forward on foot; throttle when driving (disabled in `PASSENGER`/`CONDUCTOR`) |
| `locomotion.backward_or_brake` | `KeyS` / `ArrowDown` | `ON_FOOT`, `DRIVER`, `DANFO_HUSTLE` | No | Walk backward on foot; brake/reverse when driving |
| `locomotion.turn_left_or_steer_left` | `KeyA` / `ArrowLeft` | `ON_FOOT`, `DRIVER`, `DANFO_HUSTLE` | No | Turn left on foot; steer left when driving |
| `locomotion.turn_right_or_steer_right` | `KeyD` / `ArrowRight` | `ON_FOOT`, `DRIVER`, `DANFO_HUSTLE` | No | Turn right on foot; steer right when driving |
| `locomotion.sprint` | `ShiftLeft` | `ON_FOOT` | No | Sprint on foot |
| `vehicle.interact_or_drive_or_exit` | `KeyE` | `ON_FOOT`, `ON_FOOT_VEHICLE_PROXIMITY`, `ON_FOOT_HOME_INTERIOR`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Yes | Drive authorised vehicle, interact with NPC/door, or alight at stationary stop |
| `vehicle.board_passenger` | `KeyF` | `ON_FOOT_VEHICLE_PROXIMITY`, `ON_FOOT` | Yes | **Board nearby vehicle as Passenger** (never opens Flex Card) |
| `vehicle.join_conductor` | `KeyG` | `ON_FOOT_VEHICLE_PROXIMITY`, `ON_FOOT`, `CONDUCTOR` | Yes | Join or step down as Danfo Conductor |
| `passenger.request_stop` | `KeyO` | `PASSENGER`, `CONDUCTOR` | Yes | **Request next Danfo stop (`"O wa o!"`)** or signal driver to stop |
| `ui.flex_card` | `KeyU` + `#btn-header-flex-card` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Yes | Open Citizen Flex Card via top-left button or non-conflicting `U` key |
| `vehicle.brake_or_board_stop` | `Space` | `DRIVER`, `CONDUCTOR`, `DANFO_HUSTLE` | Yes | Handbrake/board commuters when driving; collect fares in `CONDUCTOR` mode |
| `camera.cycle_or_conductor_call` | `KeyC` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Yes | Cycle camera (`cockpit`/`passenger`/`chase`) or shout route in `CONDUCTOR` mode |
| `camera.front_selfie` | `KeyV` | `ON_FOOT`, `DRIVER`, `PASSENGER` | Yes | Toggle front/selfie camera |
| `world.city_overview` | `KeyZ` | `ON_FOOT`, `DRIVER`, `CITY_OVERVIEW` | Yes | Toggle 3D Bird's-Eye City Overview (EkoAtlas) |
| `ui.ekolife_hub` | `KeyL` | `ON_FOOT`, `ON_FOOT_HOME_INTERIOR`, `DRIVER` | Yes | Open EkoLife Hub |
| `ui.ekophone` | `KeyP` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Yes | Toggle EkoPhone OS Launcher |
| `home_or_vehicle.door_or_horn` | `KeyH` | `ON_FOOT`, `ON_FOOT_HOME_INTERIOR`, `DRIVER` | Yes | Enter/exit starter home or sound vehicle horn when driving |
| `world.weather_or_rotate_or_look_right` | `KeyR` | `ON_FOOT`, `ON_FOOT_HOME_INTERIOR`, `DRIVER`, `PASSENGER` | Yes | Toggle rain, rotate home furniture, or look right in passenger view |
| `world.quick_action_or_look_left` | `KeyQ` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Yes | Quick action or look left in passenger view |
| `world.time_of_day` | `KeyT` | `ON_FOOT`, `DRIVER` | Yes | Cycle time of day |
| `audio.radio_toggle` | `KeyM` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Yes | Toggle Lagos FM Radio |
| `social.quick_chat` | `KeyY` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Yes | Toggle Lagos Slang Quick Chat |
| `world.cycle_city_event` | `KeyB` | `ON_FOOT`, `DRIVER` | Yes | Cycle dynamic Lagos city event |
| `jobs.shift_checkpoint` | `KeyJ` | `ON_FOOT`, `DRIVER` | Yes | Start or advance active shift checkpoint |
| `locomotion.strafe_toggle` | `KeyX` | `ON_FOOT` | Yes | Toggle on-foot strafe mode |
| `dev.collision_debug` | `KeyK` | `ON_FOOT`, `DRIVER` | Yes | Toggle collision debug wireframes |
| `vehicle.class_select_1_to_5` | `Digit1`–`Digit5` | `ON_FOOT`, `DRIVER` | Yes | Quick-switch vehicle class `1`–`5` |

---

## 3. Canonical Apex Danfo 14 Seat-Layout Specification & Hollow Cabin Architecture

### Why Seats Were Previously Obscured (And How We Fixed It)
Previously, `createHeroApexDanfo()` constructed the Danfo body from two solid filled boxes (`lowerBody` up to `y = 1.525m` and `upperBody` up to `y = 2.35m`), burying the interior seats (`y = 0.68m–1.15m`) inside opaque geometry.

In M4.8.1, `createHeroApexDanfo()` is engineered as a **true hollow 3D commercial-minibus cabin** baked into `chassisBodyMesh` (preserving the single-draw-call performance budget):
- **Hollow Perimeter Walls & Open Sliding Doorway**: Left continuous lower panel, front nose panel, rear tailgate panel, and split right-side panels with an **open right-side sliding passenger doorway (`x = +1.14m, z ∈ [+0.16m, +1.20m], y ∈ [0.48m, 2.22m]`)**.
- **Visible Interior Details**: Ribbed dark-grey rubber cabin floor (`y = 0.50m`), central boarding aisle (`x = +0.22m`), charcoal interior side trim panels, cream acoustic ceiling liner, two chrome overhead passenger grab rails, steel conductor doorway grab-pole (`x = +1.08m, z = +1.18m`), and articulated 3D Driver figure (`Chidi`) at the front-left wheel.
- **Transparent Framed Windows**: Framed pillars (`A/B/C/D`) with a single merged transparent glass shell (`opacity: 0.18, depthWrite: false`) so passengers inside see the cabin, driver, windscreen, and outside Lagos street clearly.

### Canonical 14-Position Seat Diagram (`1 Driver + 1 Conductor + 12 Passenger Seats = 14 Total Capacity`)

```
                   FRONT WINDSCREEN (+Z = +2.38m)
       ┌────────────────────────────────────────────────────┐
Row 0  │ [DRIVER: Chidi]     [PAX 1: Front]  [PAX 2: Front] │  z = +1.38m
(Cab)  │ (-0.56,0.68,1.38)   (0.18,0.68,1.38) (0.68,0.68,1.38)
       ├───────────────────┬────────────────────────────────┤
Row 1  │ [PAX 3: R1 Win]   │ [PAX 4: R1 Aisle]   ║ SLIDING  │  z = +0.42m .. +0.68m
(Door) │ (-0.72,0.68,0.42) │ (-0.24,0.68,0.42)   ║ DOORWAY  │  [CONDUCTOR STEP]
       │                   │      AISLE          ║ ENTRANCE │  (+0.92, 0.54, +0.68)
       ├───────────────────┼─────────────────────╫──────────┤
Row 2  │ [PAX 5: R2 Win]   │ [PAX 6: R2 Aisle]   │ [PAX 7]  │  z = -0.32m
       │ (-0.72,0.68,-0.32)│ (-0.24,0.68,-0.32)  │ (0.68,0.68,-0.32)
       ├───────────────────┼─────────────────────┼──────────┤
Row 3  │ [PAX 8: R3 Win]   │ [PAX 9: R3 Aisle]   │ [PAX 10] │  z = -1.06m
       │ (-0.72,0.68,-1.06)│ (-0.24,0.68,-1.06)  │ (0.68,0.68,-1.06)
       ├───────────────────┴─────────────────────┴──────────┤
Row 4  │ [PAX 11: Mama Risikat (NPC)]  [PAX 12: Kunle (NPC)]│  z = -1.82m
(Back) │ (-0.72, 0.68, -1.82)          (-0.22, 0.68, -1.82) │
       └────────────────────────────────────────────────────┘
                      REAR TAILGATE (-Z = -2.38m)
```

- **Capacity Breakdown**:
  - **Driver Seat (`1`)**: `driver` (`(-0.56, 0.68, 1.38)`), occupied by NPC Captain `Chidi` unless driven by an authorised player.
  - **Conductor Doorway Position (`1`)**: `conductor_step` (`(+0.92, 0.54, 0.68)`), right-side sliding doorway entrance step.
  - **Passenger Seats (`12`)**: `front_passenger`, `front_passenger_window`, `rear_passenger_1`..`rear_passenger_10`. Two rear bench seats (`rear_passenger_9`, `rear_passenger_10`) are initially occupied by NPC commuters (`Mama Risikat`, `Kunle Adebayo`), leaving **10 / 12 passenger seats open** initially.
- **Physical Boarding & Alighting Waypoints**:
  - Boarding: `curbApproach (1.55, 0.05, 0.68)` → `slidingDoorStep (0.92, 0.54, 0.68)` → `aisleAlign (0.22, 0.54, seat.z)` → `seatAnchor (seat.x, 0.68, seat.z)`.
  - Alighting: `seatAnchor` → `slidingDoorStep (0.92, 0.54, 0.68)` → `curbLandingWorld (2.35m right of doorway on pavement)`.

---

## 4. Danfo Routes, Stops & Stop-Based Fare Matrix

### Canonical Routes (`M481_DANFO_ROUTES`)
1. **`route_cms_tbs_northbound` (`NORTHBOUND`)**:
   - Stop `0`: `stop_cms` — **CMS Bus Terminal** (`z = -211.0m`)
   - Stop `1`: `stop_broad_north` — **Broad St North (Odunlami)** (`z = -150.0m`)
   - Stop `2`: `stop_broad_central` — **Broad St Central (Bookshop House)** (`z = -95.0m`)
   - Stop `3`: `stop_broad_south` — **Broad St South (Marina Junction)** (`z = -35.0m`)
   - Stop `4`: `stop_tbs_gate` — **TBS Gate (Tafawa Balewa Square)** (`z = +45.0m`)
2. **`route_tbs_cms_southbound` (`SOUTHBOUND`)**: Reverse corridor from `TBS Gate` (`index 0`) to `CMS Bus Terminal` (`index 4`).
3. **`route_marina_waterfront` (`EASTBOUND`)**: `CMS Bus Terminal` → `Marina Ferry Pier` → `Custom House / Central Bank` → `Obalende Underbridge`.

### Stop-Based Fare Formula
$$\text{BaseFare}_{\text{GN}} = 150 + (\text{stopsCount} - 1) \times 100, \quad \text{WeatherSurcharge}_{\text{GN}} = \begin{cases} 50 & \text{if raining} \\ 0 & \text{otherwise} \end{cases}$$
$$\text{TotalFare}_{\text{GN}} = \text{BaseFare}_{\text{GN}} + \text{WeatherSurcharge}_{\text{GN}}, \quad \text{ChangeDue}_{\text{GN}} = \text{TenderedNote}_{\text{GN}} - \text{TotalFare}_{\text{GN}}$$

| Boarding Stop | Destination Stop | Stops Traveled | Dry Fare (GN) | Rain Fare (GN) | Driver Share (70%) | Conductor Share (30%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| CMS Bus Terminal (`0`) | Broad St North (`1`) | 1 stop | **150 GN** | 200 GN | 105 GN | 45 GN |
| CMS Bus Terminal (`0`) | Broad St Central (`2`) | 2 stops | **250 GN** | 300 GN | 175 GN | 75 GN |
| CMS Bus Terminal (`0`) | Broad St South (`3`) | 3 stops | **350 GN** | 400 GN | 245 GN | 105 GN |
| CMS Bus Terminal (`0`) | TBS Gate (`4`) | 4 stops | **450 GN** | 500 GN | 315 GN | 135 GN |

### Three Sample Fare & Change Calculations
1. **Sample 1 (Short 1-Stop Hop — Exact Auto-Pay)**:
   - Origin: `CMS Bus Terminal (idx 0)` → Destination: `Broad St North (idx 1)` (`stopsCount = 1`, dry weather).
   - Calculation: `150 + (1 - 1) * 100 = 150 GN`. Passenger wallet debited `-150 GN`; Driver transport pool `+105 GN`; Conductor commission `+45 GN`.
2. **Sample 2 (Mid-Corridor 3-Stop Ride — Tendered ₦500 GN Note)**:
   - Origin: `CMS Bus Terminal (idx 0)` → Destination: `Broad St South / Marina Junction (idx 3)` (`stopsCount = 3`, dry weather).
   - Calculation: `150 + (3 - 1) * 100 = 350 GN`. Passenger tenders `500 GN` note; Conductor returns `500 - 350 = 150 GN` change. Net passenger wallet debit: `-350 GN` (`5,000 GN → 4,650 GN`).
3. **Sample 3 (Full 4-Stop Corridor in Rain — Tendered ₦1,000 GN Note)**:
   - Origin: `CMS Bus Terminal (idx 0)` → Destination: `TBS Gate (idx 4)` (`stopsCount = 4`, `isRaining = true`).
   - Calculation: Base `450 GN` + Rain Surcharge `50 GN` = `500 GN`. Passenger tenders `1,000 GN` note; Conductor returns `1,000 - 500 = 500 GN` change. Driver share `+350 GN` (70%), Conductor share `+150 GN` (30%).

---

## 5. Conductor, Passenger & Ledger Safety Summary

- **NPC Conductor (`Tunde`) vs Human Conductor (`[G]`)**:
  - When the player boards as a **Passenger (`[F]`)**, NPC Conductor `Tunde` announces the route, quotes stop-based fares, issues change, and relays `"O wa o!"` (`[O]`) stop requests to Captain `Chidi`.
  - When the player boards as a **Human Conductor (`[G]`)**, the player occupies `conductor_step` (`(0.92, 0.54, 0.68)`), cannot steer or accelerate the Danfo (`isDriving = false`), and uses the Conductor HUD (`#m481-conductor-hud`) to announce routes (`[C]`), collect fares & verify change (`[SPACE]`), and signal stops (`[O]`).
- **Safe Stop Alighting Enforcement (`"O wa o!"`)**:
  - Attempting to exit while the Danfo is moving (`>= 5 km/h`) is rejected with `VEHICLE_MOVING_CANNOT_EXIT`.
  - Pressing `[O]` or tapping `🛑 Request Stop ("O wa!")` halts the Danfo at the requested bus stop layby (`0 km/h`, `danfoAtPermittedStop = true`), allowing safe disembarkation through the right-side sliding doorway.
- **Game Naira Ledger Integrity**:
  - Passenger boarding debits the passenger's Game Naira wallet and **never** pays a driver salary to the passenger (`passengerPaidDriverSalary: false`).
  - Free-roam personal driving generates `0 GN` commercial income.
  - Every fare payment and conductor settlement is guarded by idempotent `eventId` tracking on both client and server (`/api/v1/danfo/board-and-pay`, `/api/v1/danfo/conductor-action`).

---

## 6. Automated Browser & Mobile Verification Results (22 / 22 Passed)

Verified via [`scripts/verify_m4_8_1_danfo_seating_fares_input.js`](file:///Users/divinity/Documents/Project%20Eko/scripts/verify_m4_8_1_danfo_seating_fares_input.js):

1. **Test 1**: Pressing `F` near the Apex Danfo 14 boards as passenger and opens the Route/Stop/Fare selector — **PASS**
2. **Test 2**: Confirming `F` does not open Flex Card during vehicle boarding — **PASS**
3. **Test 3**: Opening Flex Card through `#btn-header-flex-card` button and non-conflicting `KeyU` shortcut — **PASS**
4. **Test 4**: Pressing `E` to drive the Danfo when authorised — **PASS**
5. **Test 5**: Inspecting the Apex Danfo 14 interior and verifying the 14-seat layout (`1 Driver + 1 Conductor + 12 Passenger Seats`) — **PASS**
6. **Test 6**: Boarding through the right-side sliding passenger entrance and sitting on an actual seat anchor — **PASS**
7. **Test 7**: Verifying that the passenger is inside the cabin and not floating or clipping through the roof/road — **PASS**
8. **Test 8**: Selecting a valid stop on the Danfo route and viewing the calculated fare before confirming — **PASS**
9. **Test 9**: Paying the fare (`350 GN` with `500 GN` note → `150 GN` change) and verifying Game Naira ledger debit (`5000 → 4650 GN`) — **PASS**
10. **Test 10**: Attempting to choose an off-route or behind-direction destination and receiving a clear explanation & alternative route — **PASS**
11. **Test 11**: Riding while the Danfo moves along its route with interior passenger camera and visible 3D Driver — **PASS**
12. **Test 12**: Requesting a stop (`"O wa o!"` `[O]`) and alighting safely through the doorway when the vehicle stops — **PASS**
13. **Test 13**: Preventing exit while the vehicle is moving above the safe stop threshold (`>= 5 km/h`) — **PASS**
14. **Test 14**: Attempting to board a full Danfo (`veh_npc_full_shuttle`) and receiving `NO_SEATS_AVAILABLE` — **PASS**
15. **Test 15**: Attempting to occupy an already-occupied seat (`rear_passenger_9`) and verifying `SEAT_ALREADY_OCCUPIED` — **PASS**
16. **Test 16**: Joining as conductor (`[G]`) and verifying conductor-only controls and disabled driving inputs — **PASS**
17. **Test 17**: Collecting fares, issuing change, and verifying 30% conductor commission ledger credit — **PASS**
18. **Test 18**: Verifying that passenger boarding does not pay the player a driver salary — **PASS**
19. **Test 19**: Verifying that free-roam driving does not generate commercial fare income — **PASS**
20. **Test 20**: Verifying that duplicate inputs (`eventId`) do not charge or pay twice — **PASS**
21. **Test 21**: Testing mobile touch controls (`390×844` portrait & `844×390` landscape) for Drive, Board as Passenger, Join as Conductor, Choose Destination, Confirm Fare, Request Stop (`"O wa!"`), and Exit at Stop — **PASS**
22. **Test 22**: Confirming zero console errors and zero uncaught page errors — **PASS**

---

## 9. Captured Visual Evidence (`ANTIGRAVITY/DELIVERY/screenshots/`)

- `m4_8_1_danfo_proximity_on_foot_desktop.png`: On-foot proximity prompt beside the hollow 3D Apex Danfo 14 (`[E] Drive`, `[F] Board as Passenger (10/12 Open)`, `[G] Join as Conductor`).
- `m4_8_1_danfo_route_fare_modal_desktop.png`: Danfo Route, Stop & Stop-Based Fare Selector modal (`CMS -> Broad St -> Bookshop -> Marina -> TBS Gate`, 12 passenger seats, exact/cash note payment, and 70/30 ledger split).
- `m4_8_1_danfo_interior_passenger_view_desktop.png`: First-person interior passenger camera inside the hollow Apex Danfo 14 looking across the cabin seats, driver Chidi, and forward windshield.
- `m4_8_1_danfo_seated_passenger_exterior_desktop.png`: Exterior chase view confirming the passenger avatar is physically seated inside the hollow Danfo cabin on the assigned seat anchor.
- `m4_8_1_danfo_conductor_hud_desktop.png`: Human Conductor role HUD at the right sliding-doorway step (`[C] Shout Route`, `[SPACE] Collect Fares (30%)`, `[O] Signal Stop`, `[E] Step Down`).
- `m4_8_1_mobile_portrait_danfo_passenger.png`: Mobile portrait (`390×844`) Passenger Ride HUD (`O WA O!`, `LOOK L/R`, `CAM`, `ALIGHT`).
- `m4_8_1_mobile_landscape_danfo_stop.png`: Mobile landscape (`844×390`) after requesting `"O wa o!"` stop (`0 km/h` stationary layby halt).

