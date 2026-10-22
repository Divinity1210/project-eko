# PROJECT EKO — M3 WORLD DISCOVERY, EKOATLAS & CITY COMMERCE AUDIT
**Document ID**: `M3_WORLD_COMMERCE_AUDIT`  
**Milestone**: M3 (`EkoAtlas, World Discovery & City Commerce`)  
**Product Principle**: `LIVE. DRIVE. BUILD. EARN.`  
**Date**: 2026-10-17  

---

## 1. Executive Summary

Before implementing the M3 Canonical World Registry, EkoAtlas, EkoPlaces Directory, EkoMedia Inventory, and EkoProperties systems, a complete technical audit was conducted across the existing Project Eko monorepo:
- Shared Contracts: [`packages/contracts/src/index.ts`](file:///Users/divinity/Documents/Project%20Eko/packages/contracts/src/index.ts)
- World Graph & District Data: [`packages/world/src/index.ts`](file:///Users/divinity/Documents/Project%20Eko/packages/world/src/index.ts)
- Authoritative Economy Ledger: [`packages/economy/src/index.ts`](file:///Users/divinity/Documents/Project%20Eko/packages/economy/src/index.ts)
- Domain API Server (`:3001`): [`services/api/src/server.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/server.ts)
- Realtime Presence Server (`:3002`): [`services/realtime/src/server.ts`](file:///Users/divinity/Documents/Project%20Eko/services/realtime/src/server.ts)
- WebGL/Three.js Client (`:3000`): [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html)

### Key Architectural Gap Identified
1. **Split World Representation**: [`packages/world/src/index.ts`](file:///Users/divinity/Documents/Project%20Eko/packages/world/src/index.ts) defines a 15-node road graph (`MARINA_CMS_NODES` spanning `x: [-500, 120]`, `z: [-680, 120]`), 6 buildings (`MARINA_CMS_BUILDINGS`), and 3 vendors (`MARINA_CMS_VENDORS`), whereas the live 3D game world in [`apps/game/index.html`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html) and [`services/api/src/server.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/server.ts) places interactive entities along the Marina / Broad Street / CMS / TBS corridor at `x: [-140, -55]`, `z: [-390, +95]`.
2. **Fragmented Entity IDs**: The same physical location is referenced by different IDs in different modules (e.g., `node_cms_bus_park` in `@project-eko/world`, `cms_terminal` in `busStops`, and `cms` in `gpsTargets`).
3. **Absence of Dedicated City Atlas, Directory, Media Inventory, and Virtual Property Systems**:
   - No interactive pan/zoom city atlas (`EkoAtlas`) exists yet—only a 110×110px local 2D canvas radar (`#minimap-canvas`) with 3 hardcoded GPS targets (`cms`, `tbs`, `depot`).
   - No unified `EkoPlaces` directory exists.
   - No `EkoMedia` inventory or campaign engine exists—only 2 static decorative 3D signs (`EKO ATLANTIC` and `RADIO EKO 99.3 FM`) rendered in `buildEnvironment()` without registry IDs or campaign state.
   - No `EkoProperties` parcel/development system exists—only 3 hardcoded businesses (`biz_suya_haruna`, `biz_bukka_nkechi`, `biz_parts_balogun`) in `server.ts`.

---

## 2. Current World Coordinates & Map Topology

### 2.1 Live 3D Scene Coordinate System (`apps/game/index.html`)
- **Right-Handed Metric World Space (`1 unit = 1 meter`)**:
  - **Forward / North-South Corridor Axis (`Z`)**: Runs from `z = -390m` (Outer Marina / CMS approach) through `z = -200m` (CMS Bus Terminal & Blue Line Station) and `z = -90m` (Broad Street Financial District) to `z = +45m..+95m` (Tafawa Balewa Square Ceremonial Arch & Racecourse Loop).
  - **Lateral / East-West Axis (`X`)**:
    - `x < -125m`: Lagos Lagoon water surface & Marina seawall (`bound_west_lagoon_seawall` at `x = -140.5m`).
    - `x ∈ [-139.0m, -113.3m]`: West Marina Promenade & Elevated Blue Line Rail Viaduct (`x = -155m`, `y = 17.6m`), surface height `y = 0.22m`.
    - `x ∈ [-112.75m, -87.25m]`: Broad Street / Marina 4-Lane Asphalt Carriageway, surface height `y = 0.05m` (center median at `x = -98m`, speed bump at `z = -40m`, potholes at `(-103, -80)` and `(-96, -180)`).
    - `x ∈ [-86.7m, -66.0m]`: East Broad Street Commercial Sidewalk,Vendor Stalls, Depot, Filling Station & Workshop forecourts, surface height `y = 0.22m`.
    - `x > -63.0m`: East Broad Street High-Rise Building Line (`bldg_east_360` through `bldg_east_p20`).

### 2.2 Graph Topology (`packages/world/src/index.ts`)
- `MARINA_CMS_NODES` (15 nodes) and `MARINA_CMS_EDGES` (18 directed/bidirectional edges) with Dijkstra shortest-path routing (`findShortestPath(startNodeId, endNodeId)`).
- Currently, `findShortestPath` is tested in unit tests (`scripts/run_all_tests.js`) but is **not yet wired** into the live EkoPhone navigation or 3D street-level GPS route arrows in `apps/game/index.html`.

---

## 3. Existing Lagos Districts, Landmarks & Transport Nodes

### 3.1 Existing Districts
| District ID | Name | Status in Codebase |
| :--- | :--- | :--- |
| `lagos_island_marina_cms` | Lagos Island: Marina, Broad Street, CMS & TBS | **PLAYABLE** (`MARINA_CMS_SHOWCASE` in `@project-eko/world` & 3D scene in `apps/game/index.html`) |
| `victoria_island_annex` | Victoria Island Financial Annex | Referenced by `security_gatehouse_vi_annex` (`x: -72.5, z: -42`), **PLANNED** |
| `obalende_ikoyi` | Obalende & Ikoyi Transit Junction | Referenced in dialogue/slang & `@project-eko/world` (`node_king_george_v`), **PLANNED** |
| `eko_atlantic_phase1` | Eko Atlantic Coastal City | Referenced on billboard, **LOCKED** (Future Expansion) |
| `yaba_tech_mainland` | Yaba & Third Mainland Approach | **LOCKED** (Future Expansion) |

### 3.2 Existing Landmarks, Buildings & Transport Nodes in 3D Scene
| Current ID(s) | Entity Type | Display Name | 3D Scene Position `(x, y, z)` | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `cms_terminal` / `shelter_cms_terminal` | `transport_stop` | CMS Bus Terminal Bay | `(-110.2, 0, -200)` | Active bus stop (`queue: 9, fare: 300`) |
| `broad_st_mid` / `shelter_broad_st_mid` | `transport_stop` | Broad Street Central Stop | `(-88.5, 0, -90)` | Active bus stop (`queue: 7, fare: 250`) |
| `tbs_loop` / `shelter_tbs_loop` | `transport_stop` | Tafawa Balewa Square Loop | `(-110.2, 0, 45)` | Active bus stop (`queue: 11, fare: 350`) |
| `elevatedTrainMesh` / `node_cms_metro` | `rail_station` | CMS Marina Blue Line Rail Station | `(-132.0, 0.22, -200)` | Elevated rail viaduct & moving Blue Line train |
| `node_cms_ferry` | `ferry_terminal` | CMS Lagoon Ferry Jetty | `(-136.0, 0.22, -235)` | Defined in `@project-eko/world`, adjacent to Lagoon seawall |
| `tbs_arch_compound` / `bldg_tbs_complex` | `landmark` | Tafawa Balewa Square (TBS) Ceremonial Arch | `(-100.0, 0, 50)` | Monumental arch (`x: -118..-82, z: 50`) |
| `bldg_cathedral_church` / `bldg_east_200` | `landmark` | Marina Heritage Cathedral & Belfry | `(-56.0, 0, -200)` | Iconic Gothic-inspired cathedral tower |
| `bldg_east_360` .. `bldg_east_p20` | `building` | 9 East Broad Street Towers | `x: -58..-56, z: -360..+20` | 5 architectural archetypes with instanced night windows |

---

## 4. Existing World Entity Models & IDs

- **Contracts (`packages/contracts/src/index.ts`)**:
  - `WorldNode` (`id`, `name`, `type`, `position`, `connections`)
  - `RoadEdge` (`id`, `fromNodeId`, `toNodeId`, `lanes`, `maxSpeedKmh`, `isOneWay`, `surfaceQuality`)
  - `BuildingFootprint` (`id`, `name`, `category`, `position`, `dimensions`, `headingRad`, `colorHex`)
  - `StreetVendorProp` (`id`, `name`, `vendorType`, `position`, `headingRad`)
- **Missing from Contracts (To Be Added in Phase 1)**:
  - `CanonicalWorldEntity` covering all 21 required entity types (`district`, `road`, `junction`, `transport_stop`, `rail_station`, `ferry_terminal`, `landmark`, `building`, `business`, `virtual_property_parcel`, `player_owned_property`, `billboard`, `advertising_placement`, `job_location`, `mission_point`, `event_venue`, `vehicle_depot`, `garage`, `market`, `residential_estate`, `restricted_region`), `LODLoadingPolicy`, `EntityAvailabilityState`, `EntityProvenanceRecord`, `EkoMediaSlot`, `EkoMediaCampaign`, and `EkoVirtualPropertyParcel`.

---

## 5. Current EkoPhone Navigation & HUD Minimap

- **HUD Minimap (`#minimap-card` & `renderMinimapRadar()`)**:
  - Renders a 110×110px 2D canvas centered on the player at `0.36 px/m`.
  - Contains 3 quick-waypoint buttons (`CMS`, `TBS`, `Depot`) calling `setGPSWaypoint(key)`.
- **EkoPhone (`#eko-phone-container` & `openPhoneApp(appId)`)**:
  - Currently supports 7 apps: `dealership` (Berger Auto), `fleet` (EkoFleet), `businesses` (EkoCommerce), `jobs` (LASDRI & Jobs), `danfo_hustle` (Danfo Hustle Hub), `coop` (Live Co-op), and `rewards` (EkoBank & Rewards).
  - Does **not** yet include **EkoAtlas**, **EkoPlaces**, **EkoProperties**, or **EkoMedia Admin**.

---

## 6. Existing Business, Property & Fleet Systems

- **Businesses (`/api/v1/businesses/registry`, `/api/v1/businesses/collect`, `/api/v1/businesses/acquire`)**:
  - `biz_suya_haruna`: Mallam Haruna's Suya Franchise (`x: -80, z: -212`), player-owned (`owned: true`), generates `₦800/hr`, interactive in 3D world (`buySuyaFood()`, `deliverWholesaleCargo()`).
  - `biz_bukka_nkechi`: Mama Nkechi's Marina Bukka (`x: -80, z: -196`), acquirable for `₦80,000 GN`.
  - `biz_parts_balogun`: Balogun Auto Spare Parts Depot (`x: -80, z: -175`), acquirable for `₦150,000 GN`, interactive in 3D world (`loadWholesaleCargo()`, `market_bargaining` mini-game).
- **Service Infrastructure**:
  - `filling_station`: TotalEnergies Filling Station (`x: -78, z: -140`), refuels vehicle at `₦110 GN/L`.
  - `mechanic_workshop`: Segun Auto Clinic (`x: -78, z: -70`), repairs vehicle health to `100%` for `₦2,200 GN` or via `mechanic_bay` calibration mini-game.
- **Fleet (`/api/v1/fleet/overview`, `/api/v1/fleet/collect`)**:
  - Tracks AI drivers (`Tunde Bakare` and `Segun Adebayo`) operating on `CMS -> TBS` and `Marina -> Obalende` with daily profit collection (`+₦5,440 GN`) and live 3D Danfo remittance ticks.
- **Dealership & Garage (`/api/v1/dealership/inventory`, `/api/v1/dealership/purchase`)**:
  - 5 vehicle classes (`sedan`, `okada`, `keke`, `danfo`, `brt`) with collision-safe curb summoning (`findSafeVehicleSpawn`).
- **Missing Virtual Property Foundation**:
  - No virtual land parcels (`virtual_property_parcel`), plot boundaries, lease/acquisition terms, build states (`UNDEVELOPED` -> `UNDER_CONSTRUCTION` -> `DEVELOPED_ACTIVE`), maintenance schedules, or ownership history exist yet.

---

## 7. Current Asset Loading, Scene Streaming & LOD

- **Current 3D Scene Management (`EkoPerformanceManager` in `apps/game/index.html`)**:
  - Uses procedural low-draw-call Three.js geometry, shared PBR materials (`window.__EKO_PBR_MATERIALS__`), and `THREE.InstancedMesh` for night windows.
  - Implements distance-based NPC visibility culling (`npcCullDist: 42m..65m`), 2-tier skeletal animation throttling (`npcFullAnimDist: 24m..40m`), and traffic visibility culling (`trafficCullDist: 58m..85m`).
- **District Streaming Policy Needed for M3**:
  - Opening `EkoAtlas` must render a lightweight, stylized 2.5D/isometric interactive vector/canvas overview of Lagos Island and surrounding districts **without** instantiating high-detail 3D Three.js meshes or textures for unvisited/planned/locked districts.

---

## 8. Existing Advertisement or Sponsorship Components

- In `buildEnvironment()` (`apps/game/index.html` lines 4093–4122), two static 3D billboards are constructed:
  1. East roadside billboard at `x: -66, y: 12, z: -150` (`"EKO ATLANTIC • LIVE DRIVE BUILD"`).
  2. West roadside billboard at `x: -118, y: 11, z: -80` (`"RADIO EKO 99.3 FM • NON-STOP AFROBEATS"`).
- Neither billboard has a canonical registry ID, slot metadata, campaign model, impression/engagement tracking, `SPONSORED` disclosure badge, or live admin pause/remove controls.

---

## 9. Relevant Performance Budgets

Per project engineering gates enforced in `window.__PROJECT_EKO_PERF__` and `EkoPerformanceManager`:
- **3D Scene Draw Calls**: Target `≤ 60`, Hard Gate `≤ 75` draw calls.
- **3D Scene Triangle Count**: Hard Gate `≤ 35,000` triangles.
- **Frame Rate**: `60 FPS` desktop target (`~16.7ms` frame time), stable `30–60 FPS` mobile viewport target.
- **EkoAtlas Interactive Map**:
  - Initial map open/render time: `< 50ms`.
  - Pan/zoom interaction latency: `< 16ms` (`60 FPS` canvas rendering).
  - Zero additional Three.js draw calls when viewing unvisited districts in EkoAtlas.
  - Scrollable UI lists (`EkoPlaces`, `EkoProperties`, `EkoMedia`) isolated with CSS `content-visibility: auto` and `@container` queries to prevent full-document layout thrashing.
