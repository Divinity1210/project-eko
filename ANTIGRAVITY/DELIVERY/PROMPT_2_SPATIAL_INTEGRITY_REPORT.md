# Project Eko — Prompt 2: Spatial Integrity, Grounding & Collision System Report

**Date**: October 16, 2026  
**Target Application**: [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html) (`http://localhost:3000/play`)  
**Automated Verification Suite**: [scripts/run_all_tests.js](file:///Users/divinity/Documents/Project%20Eko/scripts/run_all_tests.js) (`SUITE 8`)  
**Status**: **VERIFIED & COMPLETE (20 / 20 Automated Checks Passing)**

---

## 1. Scene Spatial & Collision Audit Findings

Before modifying the simulation, a full coordinate-level audit was conducted across the Broad Street / Marina / Tafawa Balewa Square (TBS) corridor (`z ∈ [-410, +110]`, `x ∈ [-142, -52]`). Nine root causes of mesh interpenetration, vertical floating/sinking, and spawn collisions were identified and resolved:

| # | Subsystem | Root Cause Identified | Resolution Implemented |
| :--- | :--- | :--- | :--- |
| **1** | **Road vs. Sidewalk Elevation Disagreement** | Broad Street asphalt top is at `y = 0.05m` (`x ∈ [-112, -88]`), while the West Marina Promenade (`x ∈ [-134, -112]`) and East Broad Street Sidewalk (`x ∈ [-88, -68]`) sit on `0.22m`-tall concrete slabs (`y = 0.22m`). Previously, characters (`playerAvatar`, `lagosNPCs`) were clamped to a single flat `y = 0.06m` plane, causing their feet and lower shins to sink `0.16m` into the concrete sidewalks. | Implemented `EkoSpatialEngine.getCharacterGroundHeight(x, z)` which returns `y = 0.22m` on sidewalks/plazas, smoothly steps across the `0.45m` kerb transition (`x ≈ -112` and `x ≈ -88`), and returns `y = 0.05m` (plus speed-bump/pothole elevation) on the roadway. All sidewalk props, vendor stalls, bus shelters, and buildings now rest on `swY = 0.22m`. |
| **2** | **Vehicle Wheel & Chassis Vertical Alignment** | While `attachDetailedWheels()` uses a `0.38m` tyre radius (`CylinderGeometry(0.38, 0.38, 0.28)`), the wheel mounts in `createHeroApexDanfo()`, `createHeroKoroOkada()`, and `createHeroKekeTricycle()` were placed at local `y = 0.36`, causing tyres to clip `2cm` below the vehicle origin (`y = -0.02m`). Furthermore, vehicles lacked suspension pitch over the speed bump (`z = -40`) and potholes (`z = -80, -180`). | Standardized all vehicle wheel center heights to `y = 0.38` so the bottom of every tyre sits flush at local `y = 0.00`. Implemented `EkoSpatialEngine.getVehicleGroundState(x, z, heading, wheelbase)` to sample front and rear axle elevations independently and compute dynamic pitch (`rotation.x`). |
| **3** | **Initial Spawn Interpenetrations (NPCs Inside Props & Vehicles)** | Several NPCs spawned directly inside solid furniture or vehicles: **Bayo_Keke** (`-112.5, -193`) overlapped `heroKeke` (`-112.5, -192`); **Ifeoma_Trader** (`-82.5, -175`) stood inside the Balogun Depot pallet stack (`-82, -176`); **Mama Nkechi** (`-78.5, -195`) overlapped her own Bukka dining bench (`-77.2, -196.2`); **Segun Mechanic** (`-78.5, -69`) clipped into the workshop workbench (`-78, -70`); and `heroOkada` (`-80.5, -203`) clipped the Bukka stall canopy. | Relocated all parked vehicles into dedicated curbside laybys (`playerCar` at `-89.8, -202`; `heroDanfo` at `-110.2, -211`; `heroKeke` at `-110.2, -191.5`; `heroOkada` on the East Sidewalk apron at `-81.2, -203.5`) and recessed all vendor tables, depot pallets, and workshop benches east of `x = -78.2` so every NPC stands in clear, unobstructed space. |
| **4** | **Bus Stop Shelter & TBS Plinth Overlap** | The TBS Bus Stop Shelter (`x = -119.5, z = 45.0, halfL = 2.6`) extended to `z = 47.6`, intersecting the TBS Ceremonial Arch West Plinth (`x = -118.0, z = 50.0, halfW = 4.25, halfL = 4.25`, `minZ = 45.75`). Additionally, the CMS and TBS shelters at `x = -114.5` sat directly in the West Promenade pedestrian lane. | Moved outer bus shelters to `x = -119.5` (west edge) and `x = -78.8` (east edge), and shifted the TBS shelter to `z = 38.0` (`maxZ = 40.6`), providing `5.15m` clearance south of the TBS Arch Plinth. |
| **5** | **Pedestrian-to-Pedestrian Head-On Interpenetration** | Ambient pedestrians patrolled identical `x` coordinates (`x = -82` and `x = -116`) in opposite directions (`dir = ±1`) with zero personal-space separation or local avoidance, causing routine pass-throughs. | Separated sidewalks into directional pedestrian channels (`x = -84.2` northbound / `x = -82.0` southbound on East Sidewalk; `x = -115.8` northbound / `x = -117.8` southbound on West Promenade) and implemented `updatePedestrianAvoidance()` with `0.38m` human capsules, `1.05m` personal-space repulsion, lateral steering, and safe stopping when blocked. |
| **6** | **Player On-Foot Pass-Through** | Player on-foot movement only clamped `x ∈ [-135, -65]` and `z ∈ [-390, 95]`, allowing the player avatar to walk straight through vendor stalls, fuel pumps, parked cars,NPCs, and the TBS Arch pillars. | Implemented sub-stepped `resolvePlayerOnFootCollisions()` testing the player's `0.40m` capsule against all static AABBs, all parked/traffic vehicle OBBs, and all 31 NPC pedestrian capsules. |
| **7** | **Vehicle Penetration of Buildings, Stalls & Traffic** | Driving physics lacked Oriented Bounding Box (OBB) collision resolution against buildings, street furniture, vendor stalls, parked vehicles, and pedestrians. | Implemented sub-stepped (up to 4 substeps/frame for high-speed anti-tunnelling) 5-circle OBB approximation + Separating Axis Theorem (SAT) collision solver in `resolvePlayerVehicleCollisions()`. |
| **8** | **Traffic Distance-Only Braking & Lane Overlap** | Traffic vehicles in Lane 3 (`x = -92`) clipped `playerCar` (`x = -91.5`) and used fixed distance checks that ignored relative velocity, pedestrian crossings, and parked vehicles. | Shifted Traffic Lane 3 to `x = -94.0` (clear of the `x = -89.8` east layby) and upgraded `updateTrafficVehicle()` to compute braking deceleration from bumper-to-bumper gap **and** relative closing velocity (`relSpeedMps² / (2 · gap)`), plus player/pedestrian detection. |
| **9** | **Unsafe Vehicle Summoning & Dismounting** | `switchGameMode()` and `quickSwitchVehicle()` teleported vehicles directly to `playerAvatar.position` without checking whether the position was on a narrow sidewalk, inside a vendor stall, or overlapping another vehicle/NPC. | Implemented `findSafeVehicleSpawn()` and `findSafeDismountPosition()`, which validate 16 candidate curbside/roadway poses against static colliders, vehicles, and pedestrians before placing a vehicle or dismounting the player. |

---

## 2. Explicit Collision Framework & Categories

`EkoSpatialEngine` (`window.__PROJECT_EKO_SPATIAL__`) defines **11 explicit collision categories** and a deterministic interaction matrix (`COLLIDE`, `TRIGGER`, `IGNORE`):

### 2.1 Collision Categories
1. `PLAYER` — Player humanoid character (`radius = 0.40m`, `height = 1.76m`)
2. `NPC_PEDESTRIAN` — 28 Lagos citizens + 3 multiplayer peers (`radius = 0.38m`, `personalSpace = 1.05m`)
3. `VEHICLE` — Player and NPC vehicles (`sedan`, `danfo`, `keke`, `okada`, `suv` OBB hulls)
4. `BUILDING` — East Broad Street towers, TBS Arch plinths, Balogun warehouse, TotalEnergies store, Segun workshop
5. `ROADSIDE_PROP` — Fuel pump islands, stacked cargo pallets, dining benches, mechanic workbenches
6. `STREET_FURNITURE` — Bus stop shelters, streetlight poles, promenade palms
7. `VENDOR_STALL` — Mallam Haruna's Suya grill & canopy, Mama Nkechi's Bukka counter
8. `ROAD_BOUNDARY` — Marina Lagoon seawall (`x = -140.5`) and East Broad Street building wall (`x = -63.0`)
9. `INTERACTABLE` — Non-solid interaction zones
10. `TRIGGER_VOLUME` — 9 dedicated proximity sensors for refuelling, repairs, cargo loading, Suya purchases, passenger hailing, and bus stop boarding
11. `DECORATIVE` — Non-solid visual effects (rain particles, road markings, GPS route arrows)

### 2.2 Documented Intentional Overlaps
All intentional compound overlaps are explicitly registered in `INTENTIONAL_OVERLAPS` and validated via `compoundGroup` / `minY` clearance rules:
- `tbs_arch_crossbeam`: Overhead monumental crossbeam (`minY = 26.5m`) spanning above the TBS Arch West & East plinths (`tbs_arch_compound`) and Broad Street roadway.
- `total_energies_canopy_roof`: High forecourt canopy (`minY = 4.2m`) spanning above the TotalEnergies fuel pump island (`station_compound`).
- `vendor_compound_props`: Bukka dining benches (`bukka_compound`), Balogun stacked pallets (`depot_compound`), and mechanic workbenches (`workshop_compound`) grouped within their respective architectural bays.
- `passenger_in_vehicle`: Seated passenger mesh (`passengerInCarMesh`) parented inside `playerCar` when `passengerState === 'onboard'`.
- `interaction_trigger_sensors`: 9 `TRIGGER_VOLUME` sensors that intentionally overlap sidewalks and curbside bays to detect proximity without blocking movement.

---

## 3. Human Non-Interpenetration & Local Avoidance

 Implemented in `EkoSpatialEngine.updatePedestrianAvoidance(ped, pedIdx, dt)`:
- **Directional Sidewalk Channels**:
  - **East Sidewalk**: Northbound (`+Z`) at `x = -84.2`, Southbound (`-Z`) at `x = -82.0`.
  - **West Promenade**: Northbound (`+Z`) at `x = -115.8`, Southbound (`-Z`) at `x = -117.8`.
- **Look-Ahead Obstacle & Pedestrian Scanning**: Walking NPCs scan `2.6m` ahead along their heading. If another pedestrian, player, static stall, or vehicle blocks their path, they apply smooth lateral avoidance (`±2.1 m/s`) toward an open sidewalk channel while remaining within safe sidewalk bounds (`[-131.5, -113.2]` West or `[-86.8, -79.8]` East).
- **Safe Stopping When Blocked**: If both forward and lateral clearance are blocked (`forwardBlocked && hardBlocked`), the pedestrian smoothly decelerates to `0 m/s` and transitions to the `idle` / `look_around` animation state rather than pushing endlessly into the obstacle.
- **Hard Capsule Separation**: Enforces a strict minimum center-to-center distance (`≥ 0.76m` hard capsule sum, `1.05m` personal space) between all pairs of pedestrians and between pedestrians and the player avatar.

---

## 4. Vehicle OBB Collision Solver, Traffic Braking & Safe Summoning

- **Sub-Stepped Vehicle Solver (`resolvePlayerVehicleCollisions`)**:
  - Automatically sub-steps movement (`1–4` steps per frame based on displacement) to prevent high-speed tunnelling.
  - Tests 5 hull sample circles + 2D Oriented Bounding Box (SAT) against all static colliders in the `SpatialHashGrid2D`, all parked and active traffic vehicles, and all pedestrians.
- **Relative-Velocity Traffic Braking (`updateTrafficVehicle`)**:
  - Computes bumper-to-bumper distance `minGap` and closing speed `relSpeedMps` against leading traffic, the player vehicle/avatar, and nearby pedestrians.
  - Applies emergency braking (`45 km/h/s`) inside `3.2m`, proportional kinematic braking (`relSpeedMps² / (2 · minGap)`) inside `12.0m`, and activates rear brake lights (`0xFF1111`).
- **Collision-Safe Vehicle Summoning (`findSafeVehicleSpawn`) & Dismounting (`findSafeDismountPosition`)**:
  - Evaluates 16 candidate road/layby coordinates around the requested position using `isVehiclePoseClear()`.
  - Guarantees summoned vehicles never spawn inside the player, a pedestrian, a building, a vendor stall, or another vehicle.

---

## 5. Grounding & Vertical Alignment System

- **Character Grounding (`getCharacterGroundHeight(x, z)`)**:
  - Sidewalks (`x ≤ -112.0` or `x ≥ -88.0`) and TBS Ceremonial Plaza (`z ≥ 48.0`): `y = 0.22m`.
  - Kerb step ramp (`0.45m` transition zone): smooth linear interpolation between `0.05m` and `0.22m`.
  - Broad Street Asphalt (`x ∈ (-111.55, -88.45)`): `y = 0.05m` plus speed-bump profile (`+0.11m` cosine hump at `z = -40`) and pothole depressions (`-0.055m` at `(-95, -80)` and `(-103, -180)`).
- **Vehicle Wheel & Pitch Alignment (`getVehicleGroundState(x, z, heading, wheelbase)`)**:
  - Computes independent front-axle and rear-axle ground heights and derives `pitch = atan2(rearY - frontY, wheelbase)`, causing vehicles to visibly pitch nose-up and nose-down as their wheels traverse speed bumps, potholes, and sidewalk aprons.

---

## 6. Collision Debug Mode & Diagnostics

- **Toggle Controls**: Press **`[K]`** on the keyboard or click the **`🛡️ Colliders: OFF (K)`** button (`#btn-collision-debug-pill`) in the top-right HUD.
- **Visual Overlays Rendered**:
  - **Red Wireframes**: Static buildings (`BUILDING`) and corridor boundaries (`ROAD_BOUNDARY`).
  - **Orange Wireframes**: Vendor stalls (`VENDOR_STALL`), roadside props (`ROADSIDE_PROP`), and bus stop shelters/poles (`STREET_FURNITURE`).
  - **Purple Floor Rings**: Non-solid interaction trigger volumes (`TRIGGER_VOLUME`).
  - **Green / Cyan Wireframes**: Player (`PLAYER`) and NPC (`NPC_PEDESTRIAN`) capsule colliders, ground-contact rings, and forward velocity/avoidance vectors (turning **Red** when a route is blocked).
  - **Gold / Blue Oriented Boxes**: Active player vehicle and NPC traffic vehicle OBB collision hulls.
- **Zero Overhead When Disabled**: The debug wireframe group is initialized *after* static scene geometry baking and remains `visible = false` during normal gameplay, adding `0` draw calls when off.

---

## 7. Automated Spatial Integrity Test Results

All 5 automated spatial integrity tests in `SUITE 8` of [scripts/run_all_tests.js](file:///Users/divinity/Documents/Project%20Eko/scripts/run_all_tests.js#L306-L596) pass alongside Suites 1–7 (`20 / 20 PASS`):

```text
--- SUITE 8: SPATIAL INTEGRITY, GROUNDING & COLLISION SYSTEM ---
✅ PASS: Collision framework defines all 11 categories, explicit collision matrix, and documented intentional overlaps
✅ PASS: 2D Spatial Hash Grid validates all static buildings/stalls/props with zero illegal overlaps and rejects roadway or AABB intrusions
✅ PASS: Grounding system aligns character feet on sidewalks (0.22m) vs asphalt (0.05m) and pitches vehicles over speed bumps and potholes
✅ PASS: Pedestrian avoidance prevents human-to-human interpenetration across 120 simulation frames and stops safely when blocked
✅ PASS: Player on-foot & vehicle OBB collision solver, traffic braking, and safe vehicle summoning prevent all solid mesh penetration

====================================================
TEST RESULTS: 20 PASSED | 0 FAILED
STATUS: ALL CRITICAL CHECKS PASS (M0–M3 + CHARACTER + SPATIAL INTEGRITY VERIFIED)
====================================================
```
