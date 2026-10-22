# PROJECT EKO — M4.9 TRAFFIC, DANFO OPERATIONS & ROAD INCIDENTS AUDIT

**Milestone:** M4.9 — Living Lagos Traffic, Danfo Operations & Road Incidents  
**Date:** 2026-10-21  
**Status:** Phase 0 Root-Cause & Architecture Audit Complete

---

## 1. Executive Summary & Root-Cause Analysis of Observed Defects

During testing of the M4.8.1 passenger journey (`media_1792586793450_ae0a9f3c.png`), three critical behavioural and visual defects were observed:
1. **Stationary Danfo After Passenger Alighting**: After the player alighted from the yellow Apex Danfo 14 at the destination stop, the Danfo remained indefinitely frozen beside the road with its door open instead of closing its sliding door, checking traffic, merging out of the stop bay into the major road, and continuing its route.
2. **Yellow Danfo vs. Blue BRT Lane Separation & Straight-Line Trajectory**: When cruising as an NPC-driven passenger shuttle, the yellow Danfo moved in a straight line along its parked `x = -110.2` / `-108.6` corridor (overlapping the West curb / dedicated BRT alignment) rather than pulling out of the `BUS_STOP_BAY` (`x = -110.2`), merging laterally across a `MERGE_ZONE` into the `GENERAL_TRAFFIC` carriageway (`x = -98.0` / `-94.0`), and leaving the `BRT_ONLY` lane (`x = -108.6`) exclusively for the blue LAMATA BRT coaches.
3. **Conductor Standing vs. Passenger Sitting Posture**: When occupying the Danfo as `CONDUCTOR`, the character avatar was placed into the `'driving'` animation state (seated with knees bent at `90°`), whereas a Danfo conductor stands upright at the sliding doorway step (`'conductor_call'` / standing posture) while a `PASSENGER` sits (`'sit_vehicle'` posture on the bench cushion).

---

## 2. Detailed Code Audit by Subsystem

### 2.1 Why the Danfo Remained Stationary After Passenger Journey Ended
- **Source File:** [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L14184-L14201) & [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L36840-L37055)
- **Root Cause 1 — Simulation Loop Gated by Player Occupancy:** In `updateSimulation(dt)` (line 14197), `window.__PROJECT_EKO_VEHICLE_STATE__.updateOccupiedNonDriverTick(dt)` was only invoked inside `else if (occSys.state === 'PASSENGER' || occSys.state === 'CONDUCTOR')`. The moment the player exited to `ON_FOOT`, no autonomous NPC Danfo controller ticked `heroDanfo`.
- **Root Cause 2 — Hard Zeroing on Exit Without Departure Lifecycle:** In `exitVehicleToOnFoot()` (line 36856), alighting immediately executed `this.shuttleCruiseActive = false; this.shuttleSpeedKmh = 0; this.danfoRideActive = false;` and left `heroDanfo` without an NPC operating state machine (`ALLOWING_ALIGHTING -> ALLOWING_BOARDING -> DOORS_CLOSING -> CHECKING_DEPARTURE -> MERGING_BACK_INTO_TRAFFIC -> EN_ROUTE`).

### 2.2 NPC-Driven Vehicles vs. Player-Driven Vehicles
- **Source File:** [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L11788-L11840) & [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L14250-L14325)
- **Actual Implementation:**
  - `spawnNPCTraffic()` spawns 8 ambient NPC vehicles across 2 lanes (`x = -106` northbound and `x = -90` southbound) plus a fixed-x `updateTraffic()` loop that translates `v.mesh.position.z += v.dir * v.speed * dt` and wraps at `z = ±360`.
  - `heroDanfo` (`veh_danfo_01`), `heroBRT` (`veh_brt_01`), `heroKeke` (`veh_keke_01`), and `heroSedan` (`veh_sedan_01`) are interactive hero vehicles managed by `EkoSpatialEngine` and `EkoVehicleOccupancySystem`.
- **Defects Identified:**
  - Ambient NPC vehicles lack driver behavioural profiles (`CALM`, `ASSERTIVE`, `IMPATIENT`, `PROFESSIONAL`, `INEXPERIENCED`), lane-change steering, stop-bay pull-in/pull-out manoeuvres, and pedestrian emergency braking.
  - `heroBRT` (`veh_brt_01`) is spawned at `(-108.5, 0, -45)` on the dedicated blue BRT lane (`x = -108.6`), but does not actively run its dedicated BRT corridor cycle when unpiloted, whereas `spawnNPCTraffic()` placed Danfos/Kekes at `x = -106` (encroaching on the BRT reserve) instead of keeping yellow Danfos in `GENERAL_TRAFFIC` (`x = -98.0` northbound, `x = -92.0` southbound) and `BUS_STOP_BAY` (`x = -110.2` / `x = -88.5`).

### 2.3 Road Graph, Lane Definitions & BRT Infrastructure
- **Source File:** [packages/world/src/index.ts](file:///Users/divinity/Documents/Project%20Eko/packages/world/src/index.ts#L19-L305)
- **Actual Implementation:**
  - `MARINA_CMS_GRAPH_NODES` and `MARINA_CMS_GRAPH_EDGES` define 9 nodes and 11 edges across Marina / CMS (`node_cms_bus_terminal`, `node_cms_brt_gate`, `node_marina_rail_station`, `node_broad_street_junction`, `node_victoria_island_gate`, etc.).
  - `findShortestPath(startNodeId, endNodeId)` (lines 250–305) runs unweighted/distance Dijkstra across all edges regardless of `transportModes`.
- **Defects Identified:**
  - `findShortestPath` has no `vehicleClass` or `laneType` filter. A query from `node_cms_bus_terminal` to `node_marina_rail_station` or across `edge_cms_to_brt` routes a commercial Danfo onto `node_cms_brt_gate` (`transportModes: ['walk', 'brt']`) or `node_marina_rail_station` (`transportModes: ['walk', 'rail']`, `y = 12`).
  - Missing explicit lane classification types (`GENERAL_TRAFFIC`, `GENERAL_TRAFFIC_LEFT`, `GENERAL_TRAFFIC_RIGHT`, `BUS_STOP_BAY`, `BUS_TERMINAL_ACCESS`, `BRT_ONLY`, `PUBLIC_TRANSPORT_ONLY`, `SERVICE_LANE`, `PARKING_AREA`, `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED`, `MERGE_ZONE`) and vehicle-class lane permission matrices.

### 2.4 Driver, Conductor & Passenger Occupancy States and Postures
- **Source File:** [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L9506-L9848) (`EkoAnimStateMachine`) & [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L36932-L36972) (`syncSeatedAvatarTransform`)
- **Actual Implementation:**
  - `EkoAnimStateMachine` defines `'sit_vehicle'`, `'driving'`, and `'conductor_call'` states.
- **Defects Identified:**
  - In `syncSeatedAvatarTransform()`, `if (this.state === 'DRIVER' || this.state === 'CONDUCTOR')` assigned `'driving'` to both driver and conductor (`hipsY = 0.54`, knees bent `1.42 rad`), making the conductor sit in mid-air at the doorway instead of standing upright (`'conductor_call'`, `hipsY = 0.92`, knees straight `0.08 rad`).
  - Furthermore, `EkoAnimStateMachine.updateCharacter(playerAvatar, dt, ...)` was only called in the `ON_FOOT` branch of `updateSimulation`, meaning bone rotations did not smoothly interpolate after switching to `'sit_vehicle'` or `'conductor_call'` unless explicitly ticked.

### 2.5 Vehicle Physics, Collision Detection, Damage & Recovery
- **Source File:** [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L13317-L13430), [services/api/src/m47Engine.ts](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts#L685-L715), [services/realtime/src/server.ts](file:///Users/divinity/Documents/Project%20Eko/services/realtime/src/server.ts)
- **Actual Implementation:**
  - `EkoSpatialEngine.resolveVehicleAABB()` handles basic player-driven vehicle vs. building AABB pushback and speed reduction (`vehicle.speed *= 0.35`).
  - `services/api/src/m47Engine.ts` tracks basic vehicle `condition` (`0–100`) and `repairCostKobo` in the fleet garage.
- **Defects Identified:**
  - No unified road-incident classification (`VEHICLE_VEHICLE`, `VEHICLE_STATIC`, `VEHICLE_BARRIER`, `LOW_SPEED_BUMP`, `SIDE_IMPACT`, `REAR_END`, `SCRAPE`, `PEDESTRIAN_EMERGENCY_BRAKE`).
  - No subsystem component damage model (`body`, `tyres`, `steering`, `engine`, `lighting`) affecting top speed, acceleration, steering drift, or `DISABLED -> RECOVERY_REQUIRED` breakdown states.
  - Need strict server-side incident deduplication (`incidentId` + per-vehicle cooldown) and explicit verification that collisions never award Game Naira and never penalize an innocent `PASSENGER`.

### 2.6 Engine, Horn, Driver Banter & Environmental Audio
- **Source File:** [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L13540-L13640)
- **Actual Implementation:**
  - WebAudio engine synth (`playHorn()`, engine pitch modulation) exists for player vehicle horn (`H`).
- **Defects Identified:**
  - Missing NPC contextual horn triggers with per-vehicle cooldowns and anti-cacophony cap.
  - Missing structured Nigerian road banter system across the 9 required categories (`ROAD_OBSTRUCTION`, `AGGRESSIVE_MERGE`, `MISSED_JUNCTION`, `NEAR_COLLISION`, `BUS_STOP_DEPARTURE`, `PASSENGER_BOARDING`, `FARE_DISPUTE`, `TRAFFIC_QUEUE`, `DRIVER_WARNING`).
  - Missing granular audio mixer (`master`, `vehicle`, `horn`, `npcVoice`, `ambient`, `mute`, `reducedAudio`) and centralized accessible `aria-live="polite"` caption banner for key horns/banter cues.

---

## 3. M4.9 Implementation Architecture

| Phase | Subsystem | Target Files |
| :--- | :--- | :--- |
| **Phase 1** | 18-state NPC Danfo state machine (`OUT_OF_SERVICE` through `RECOVERY_REQUIRED`), automatic post-alighting door close, departure check, lateral merge into general traffic, conductor standing vs. passenger sitting fix | `apps/game/index.html`, `services/api/src/m47Engine.ts` |
| **Phase 2** | 12-type Lane Classification Registry, Vehicle Class Lane Permissions (`DANFO` vs `BRT` vs `KEKE` vs `SEDAN`), lane-aware `findVehicleRouteWithLaneRules()`, blue BRT corridor vs. yellow Danfo general-traffic + stop-bay merge geometry | `packages/world/src/index.ts`, `services/api/src/m47Engine.ts`, `apps/game/index.html` |
| **Phase 3** | 5 Lagos Driver AI Profiles (`CALM`, `ASSERTIVE`, `IMPATIENT`, `PROFESSIONAL`, `INEXPERIENCED`), smooth lateral lane changing, pedestrian emergency yield, rain & market slow-zones | `apps/game/index.html` |
| **Phase 4** | Unified Road-Incident Engine, 5-component vehicle damage (`body`, `tyres`, `steering`, `engine`, `lighting`), `incidentId` deduplication + cooldown, zero crash reward enforcement, innocent passenger immunity, tow & repair workflow | `services/api/src/m47Engine.ts`, `services/api/src/server.ts`, `apps/game/index.html` |
| **Phase 5** | Contextual Lagos Horn & 9-Category Banter System, per-vehicle cooldowns, Audio Mixer controls, centralized `aria-live="polite"` live caption region | `apps/game/index.html` |
| **Phase 6–8** | Player driving traffic reactions, economy integration, spatial-hash collision culling, 3-tier traffic simulation LOD (`NEAR_ACTIVE`, `MID_SIMPLIFIED`, `FAR_CORRIDOR`) | `apps/game/index.html` |
| **Phase 9–10** | 33-scenario automated Playwright + API verification suite (`scripts/verify_m4_9_living_lagos_traffic.js`) & final delivery documentation | `scripts/verify_m4_9_living_lagos_traffic.js`, `ANTIGRAVITY/DELIVERY/*` |
