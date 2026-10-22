# PROJECT EKO — M4.9 LIVING LAGOS TRAFFIC, DANFO OPERATIONS & ROAD INCIDENTS REPORT

## 1. Executive Summary

Milestone **M4.9 (Living Lagos Traffic, Danfo Operations & Road Incidents)** upgrades Project Eko's Lagos road corridor (Marina / Broad Street / CMS / TBS) into a continuous, state-driven transport and traffic simulation.

Specifically, this milestone resolves the two visual and gameplay defects observed after alighting from the Apex Danfo 14, and completes all 10 phases of the M4.9 specification:
1. **Conductor Stands vs. Passenger Sits Posture**:
   - In `CONDUCTOR` role (`conductor_step`, `x = 0.92, y = 0.38, z = 0.68`), the character stands upright in the right sliding doorway (`'conductor_call'` animation state, `hipsY = 0.92m`, `kneeLX = 0.08 rad`) holding the vertical grab pole.
   - In `PASSENGER` role (`rear_passenger_1..10`, `front_passenger`, `y = 0.28m` base offset), the character sits on the bench cushion (`'sit_vehicle'` animation state, `hipsY = 0.54m`, `kneeLX = 1.48 rad`, `hipLX = -1.42 rad`).
2. **Yellow Danfo vs. Blue BRT Lane Separation & Post-Alighting Departure**:
   - **Blue LAMATA BRT Coaches (`BRT` class)**: Operate on the dedicated blue-painted, curb-separated `BRT_ONLY` lane (`x = -108.5m` in 3D corridor space; `node_cms_brt_gate` in the topological graph).
   - **Yellow Commercial Danfos (`DANFO` class)**: Forbidden from `BRT_ONLY` lanes (`x = -108.5m`). They cruise on the major general-traffic road (`x = -98.0m`, `GENERAL_TRAFFIC_LEFT`), pull laterally into the yellow `BUS_STOP_BAY` (`x = -110.2m`) only to drop off or board passengers, close their sliding door (`DOORS_CLOSING`), check the mirror for a safe merge gap (`CHECKING_DEPARTURE`), steer laterally across `MERGE_ZONE` (`x = -103.5m`) back onto the major road (`x = -98.0m`, `MERGING_BACK_INTO_TRAFFIC`), and continue along their route (`EN_ROUTE`).

---

## 2. Companion Audit & Phase Deliverables

- **Phase 0 Audit**: [`ANTIGRAVITY/DELIVERY/M4_9_TRAFFIC_AND_TRANSPORT_AUDIT.md`](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/M4_9_TRAFFIC_AND_TRANSPORT_AUDIT.md)
- **Phase 2 Lane Rules & Route Tests**: [`ANTIGRAVITY/DELIVERY/M4_9_LANE_RULES_AND_ROUTE_TESTS.md`](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/M4_9_LANE_RULES_AND_ROUTE_TESTS.md)
- **Phase 5 Traffic Audio & Banter Report**: [`ANTIGRAVITY/DELIVERY/M4_9_TRAFFIC_AUDIO_AND_BANTER_REPORT.md`](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/M4_9_TRAFFIC_AUDIO_AND_BANTER_REPORT.md)

---

## 3. Architectural Summary by Phase

### Phase 1 — Complete Danfo Stop & Departure Lifecycle
- **18-State NPC Danfo Operating State Machine**:
  `OUT_OF_SERVICE`, `APPROACHING_STOP`, `QUEUING_FOR_STOP`, `STOPPING`, `DOORS_OPEN`, `ALLOWING_ALIGHTING`, `ALLOWING_BOARDING`, `FARE_PROCESSING`, `DOORS_CLOSING`, `CHECKING_DEPARTURE`, `MERGING_BACK_INTO_TRAFFIC`, `EN_ROUTE`, `STOPPING_FOR_HAZARD`, `DIVERTING`, `COMPLETING_ROUTE`, `RETURNING_TO_DEPOT`, `DISABLED`, `RECOVERY_REQUIRED`.
- **Articulated 3D Sliding Door (`danfo_sliding_door_leaf`)**:
  Visually slides aft to `z = -0.36m` (`doorOpenRatio = 1.0`, `OPEN`) when stopped at a `BUS_STOP_BAY` and slides forward to `z = +0.68m` (`doorOpenRatio = 0.0`, `CLOSED`) during `DOORS_CLOSING` before departure.
- **Automatic Post-Alighting Continuation**:
  When a passenger alights (`exitVehicleToOnFoot()`), the NPC Danfo releases the passenger's seat while keeping remaining NPC commuters (`Mama Ngozi` and `Babatunde`) seated, closes its sliding door, checks `isMergeLaneClearForHeroDanfo()`, merges laterally from `x = -110.2m` (`BUS_STOP_BAY`) across `x = -103.5m` (`MERGE_ZONE`) onto `x = -98.0m` (`GENERAL_TRAFFIC_LEFT`), and continues toward the next stop.
- **Human Driver Override Protection**:
  Both client (`isHeroDanfoHumanDriven()`) and server (`POST /api/v1/traffic/danfo-lifecycle`) suppress automatic NPC departure when a human player occupies the `DRIVER` seat (`autoDepartureSuppressedForHumanDriver: true`).

### Phase 2 — Road Graph, Lane Types & Vehicle Permissions
- **12 Lane Types in `@project-eko/world`**:
  `GENERAL_TRAFFIC`, `GENERAL_TRAFFIC_LEFT`, `GENERAL_TRAFFIC_RIGHT`, `BUS_STOP_BAY`, `BUS_TERMINAL_ACCESS`, `BRT_ONLY`, `PUBLIC_TRANSPORT_ONLY`, `SERVICE_LANE`, `PARKING_AREA`, `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED`, `MERGE_ZONE`.
- **Vehicle-Class Lane Permissions**:
  Enforced in [`packages/world/src/index.ts`](file:///Users/divinity/Documents/Project%20Eko/packages/world/src/index.ts), [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts), and [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html).

### Phase 3 — Context-Aware Lagos Traffic AI
- **5 Driver Profiles**:
  `CALM` (`minMergeGapM = 14.0m`), `ASSERTIVE` (`9.0m`), `IMPATIENT` (`7.5m`), `PROFESSIONAL` (`12.0m`), `INEXPERIENCED` (`16.0m`).
- **Smooth Lateral Steering, Pedestrian Braking & Rain Adaptation**:
  Vehicles steer laterally without teleporting, yield for pedestrians (`PEDESTRIAN_EMERGENCY_BRAKE`), and reduce target speeds by 22% (`rainFactor = 0.78`) during rain.

### Phase 4 — Collisions, Damage, Recovery & Liability
- **5-Component Vehicle Health Model**:
  Tracks `body`, `tyres`, `steering`, `engine`, and `lighting` (0–100%), degrading handling and triggering `RECOVERY_REQUIRED` with flashing hazard lights when condition $\le 20\%$ or engine $\le 15\%$.
- **Deduplication, Cooldown & Innocent Passenger Immunity**:
  Enforces `incidentId` deduplication and a `1500ms` per-pair cooldown (`cooldownSuppressed: true`), awards zero money for crashes (`rewardGN: 0`), and protects passengers from driver crash penalties (`passengerProtectedFromPenalty: true`, `playerPenaltyGN: 0`).
- **Tow Recovery & Workshop Repair**:
  `POST /api/v1/traffic/recover-or-repair` supports `TOW_RECOVERY` (`350 GN`) to Segun Roadside Workshop / TBS Garage and idempotent `WORKSHOP_REPAIR` restoring all 5 subsystems to 100%.

### Phase 5 — Spatial Horns, Lagos Road Banter & Accessible Captions
- **Contextual Horn Triggers & Per-Vehicle Cooldowns**:
  Synthesizes distinct horn timbres per vehicle class (`DANFO`, `BRT`, `PRIVATE_CAR`, `TAXI`, `KEKE`, `OKADA`) with spatial distance attenuation and a `3.2s–4.2s` per-vehicle cooldown (`HORN_COOLDOWN_ACTIVE`).
- **9 Lagos Road Banter Categories & Centralized Accessible Caption Banner**:
  Covers all 9 contextual categories (`ROAD_OBSTRUCTION`, `AGGRESSIVE_MERGE`, `MISSED_JUNCTION`, `NEAR_COLLISION`, `BUS_STOP_DEPARTURE`, `PASSENGER_BOARDING`, `FARE_DISPUTE`, `TRAFFIC_QUEUE`, `DRIVER_WARNING`) and renders captions in `#m49-traffic-caption-banner` (`role="status"`, `aria-live="polite"`).

---

## 4. Automated Verification Matrix (`33/33 PASSED`)

Executed via [`scripts/verify_m4_9_living_lagos_traffic.js`](file:///Users/divinity/Documents/Project%20Eko/scripts/verify_m4_9_living_lagos_traffic.js):

| Test ID | Acceptance Criterion | Status | Verified Telemetry |
| :--- | :--- | :--- | :--- |
| **T01** | NPC Danfo approaches a designated bus stop | **PASS** | `state = APPROACHING_STOP`, pulling into bay `x = -102.68m` |
| **T02** | NPC Danfo slows and stops in the bus stop bay | **PASS** | `speed = 0 km/h`, `bayX = -110.2m`, `z = -150m` |
| **T03** | Doors open when stopped at the bus stop bay | **PASS** | `slidingDoorState = OPEN`, `doorOpenRatio = 1` |
| **T04** | Passenger alights through doorway and returns to `ON_FOOT` | **PASS** | `state = ON_FOOT`, `door = RIGHT_SLIDING_DOOR` |
| **T05** | Passenger seat is released and journey settles once | **PASS** | `availableSeats: 9 -> 10` |
| **T06** | Remaining NPC passengers stay seated inside the Danfo | **PASS** | `remainingSeatedPassengers = 2` (`Mama Ngozi` & `Babatunde`) |
| **T07** | Doors close after stop operations complete | **PASS** | `DOORS_CLOSING -> CLOSED`, `doorOpenRatio = 0` |
| **T08** | Danfo checks traffic, merges laterally out of stop bay, and departs on major road toward next stop | **PASS** | Merged via `x = -98.45m` -> cruising `x = -98.0m` (`GENERAL_TRAFFIC_LEFT`) at `38 km/h` |
| **T09** | If the merge lane is blocked, the Danfo waits stationary | **PASS** | `state = CHECKING_DEPARTURE`, `holdingForTrafficGap = true`, `speed = 0` |
| **T10** | When the blockage clears, the Danfo departs cleanly | **PASS** | Advanced to `z = -125.59m` on `GENERAL_TRAFFIC_LEFT` |
| **T11** | A human-driven Danfo is not hijacked by automatic NPC departure | **PASS** | `clientSuppressed = true`, `serverSuppressed = true` |
| **T12** | Danfo routes use general traffic lanes & bus stop bays, and Conductor stands while Passenger sits | **PASS** | `ConductorState = conductor_call (kneeLX = 0.03)`, `PassengerState = sit_vehicle (kneeLX = 1.203)` |
| **T13** | Yellow Danfo does not enter `BRT_ONLY` lanes | **PASS** | `Danfo -> node_cms_brt_gate` rejected; `usesBrtOnly = false` |
| **T14** | Blue BRT vehicles use `BRT_ONLY` lanes | **PASS** | `BRT path = ["node_cms_bus_park","node_cms_brt_gate"]`, `heroBRT x = -108.5m` on `BRT_ONLY` |
| **T15** | Private cars and Kekes cannot enter `BRT_ONLY` lanes | **PASS** | `PrivateCar -> BRT` rejected; non-BRT traffic on `BRT_ONLY = 0` |
| **T16** | Vehicles divert around a temporarily blocked lane/node | **PASS** | Diverted around `node_broad_st_mid` via `node_odunlami_st -> node_catholic_mission_st` |
| **T17** | Vehicles maintain following distance and queue behind slower vehicles | **PASS** | `activeNPCVehicles = 12`, `CALM gap = 12.5m` |
| **T18** | Vehicles change lanes smoothly without teleporting | **PASS** | Intermediate lateral merge coordinate `x = -98.45m` verified between `-110.2m` and `-98.0m` |
| **T19** | Assertive and impatient driver profiles accept smaller gaps than calm and inexperienced drivers | **PASS** | `IMPATIENT (7.5m) < ASSERTIVE (9m) < CALM (14m) < INEXPERIENCED (16m)` |
| **T20** | Commercial Danfos pull into bus stop bays and merge back into general traffic | **PASS** | `stopBayX = -110.2m -> generalTrafficX = -98.0m` |
| **T21** | Vehicles brake and yield for pedestrians | **PASS** | `PEDESTRIAN_EMERGENCY_BRAKE`, zero pedestrian-hit damage |
| **T22** | Rain reduces vehicle speeds and increases braking distance | **PASS** | `rainSpeedFactor = 0.78` (22% wet-tarmac speed reduction) |
| **T23** | Vehicle-to-vehicle collision applies component damage with zero reward | **PASS** | `condition = 86%`, 5 components degraded, `rewardGN = 0` |
| **T24** | Static obstacle collision applies damage without infinite bounce or NaN | **PASS** | `condition = 73%`, `tyres = 77%` |
| **T25** | Collision cooldown and `incidentId` deduplication prevent repeated frame-by-frame penalties | **PASS** | `cooldownSuppressed = true`, `duplicateIgnored = true` |
| **T26** | Severe damage transitions vehicle to `RECOVERY_REQUIRED` with hazard lights | **PASS** | `status = RECOVERY_REQUIRED`, `condition = 20%`, `hazardLights = true` |
| **T27** | Recovery and Workshop Repair restore all 5 subsystems to 100% and settle once in Game Naira ledger | **PASS** | `towCost = 350 GN`, `repairCost = 1058 GN`, `conditionAfter = 100%`, `idempotentReplay = true` |
| **T28** | Innocent passengers are never charged driver crash penalties and collisions award zero money | **PASS** | `passengerProtectedFromPenalty = true`, `playerPenaltyGN = 0`, `rewardGN = 0` |
| **T29** | Vehicle cut-in or blocked lane triggers a contextual spatial horn | **PASS** | `gain = 0.586`, spatial attenuation verified |
| **T30** | Per-vehicle horn cooldown prevents continuous horn spam | **PASS** | Immediate second horn blocked (`HORN_COOLDOWN_ACTIVE`) |
| **T31** | Lagos road banter triggers across all 9 contextual categories | **PASS** | All 9 categories emitted and verified |
| **T32** | Mute/volume mixer controls horn/voice gain and centralized `aria-live="polite"` caption banner updates | **PASS** | `mutedHornGain = 0`, `ariaLive = "polite"` |
| **T33** | Zero uncaught runtime exceptions and responsive mobile portrait/landscape HUDs | **PASS** | `390x844` portrait & `844x390` landscape verified with `0` console/page errors |
