# PROJECT EKO — M4.9 LANE RULES, BRT SEPARATION & ROUTE TESTS

**Milestone:** M4.9 — Living Lagos Traffic, Danfo Operations & Road Incidents  
**Phase:** Phase 2 — Lane-Aware Lagos Road Network  
**Status:** Implemented & Verified

---

## 1. Canonical Lane Classifications (12 Lane Types)

Every road segment, stop layby, terminal connector, and dedicated corridor in Project Eko is classified into one of the 12 canonical lane types defined in [`packages/world/src/index.ts`](file:///Users/divinity/Documents/Project%20Eko/packages/world/src/index.ts#L247-L261) and [`services/api/src/m47Engine.ts`](file:///Users/divinity/Documents/Project%20Eko/services/api/src/m47Engine.ts):

| Lane Classification | Physical Corridor / X-Alignment (Marina–CMS Spine) | Purpose & Rules |
| :--- | :--- | :--- |
| `GENERAL_TRAFFIC` | `x = -98.0m` (Northbound) / `x = -90.0m` (Southbound) | Primary mixed-traffic arterial carriageway used by yellow Danfos, private cars, taxis, Kekes, Okadas, and delivery vans. |
| `GENERAL_TRAFFIC_LEFT` | `x = -98.0m` (Northbound slow/outer lane) | Outer general-traffic lane adjacent to bus stop merge zones; used by commercial Danfos preparing to pull into a stop bay or cruising between stops. |
| `GENERAL_TRAFFIC_RIGHT` | `x = -94.0m` (Northbound fast/overtaking lane) | Inner general-traffic overtaking lane used by faster sedans, taxis, and assertive drivers. |
| `BUS_STOP_BAY` | `x = -110.2m` (West Curb Layby) / `x = -88.5m` (East Curb Layby) | Recessed roadside bus stop layby where yellow Danfos pull in to decelerate, open their sliding door, alight/board passengers, and close doors before merging out. |
| `BUS_TERMINAL_ACCESS` | CMS Motor Park & TBS Terminal Throat | Terminal staging lanes accessible to commercial public transit (`DANFO`, `BRT`). |
| `BRT_ONLY` | `x = -108.6m` (Dedicated Blue LAMATA BRT Corridor + `node_cms_brt_gate`) | Physically segregated blue-marked Bus Rapid Transit corridor reserved **exclusively** for high-capacity blue BRT coaches (`veh_brt_01`, `npc_brt_*`) and emergency vehicles. **Strictly forbidden to yellow Danfos, Kekes, Okadas, and private cars.** |
| `PUBLIC_TRANSPORT_ONLY` | Shared Transit Priority Links | Priority approaches permitted for `DANFO` and `BRT` buses only. |
| `SERVICE_LANE` | `node_tbs_garage`, `node_fuel_station_marina` | Access lanes for Segun's Roadside Workshop, TBS Auto Garage, and Oandoil/TotalEnergies Fuel Stations. |
| `PARKING_AREA` | Roadside Laybys & Market Parking | Designated off-lane parking bays where vehicles can remain stationary in `OUT_OF_SERVICE` or `PARKED` states. |
| `RESTRICTED_ACCESS` | `node_cms_jetty` (Ferry), `node_marina_rail_station` (Elevated Blue Line Rail `y = 12m`) | Non-roadway or grade-separated transit infrastructure excluded from road vehicle pathfinding. |
| `TEMPORARILY_BLOCKED` | Dynamic Incident / Breakdown Zones | Road segments obstructed by disabled vehicles (`DISABLED` / `RECOVERY_REQUIRED`) or roadworks; triggers `DIVERTING` lane changes around the obstacle. |
| `MERGE_ZONE` | `x = -103.5m` (Transition Taper between `BUS_STOP_BAY` `x = -110.2m` and `GENERAL_TRAFFIC` `x = -98.0m`) | Dedicated diagonal acceleration/deceleration taper used by yellow Danfos when pulling out of a bus stop bay (`MERGING_BACK_INTO_TRAFFIC`) into the major road or pulling into a stop (`APPROACHING_STOP`). |

---

## 2. Vehicle-Class Lane Permission Matrix

| Vehicle Class | Permitted Lanes | Forbidden Lanes |
| :--- | :--- | :--- |
| **`DANFO`** (Yellow Commercial Minibus) | `GENERAL_TRAFFIC`, `GENERAL_TRAFFIC_LEFT`, `GENERAL_TRAFFIC_RIGHT`, `BUS_STOP_BAY`, `BUS_TERMINAL_ACCESS`, `PUBLIC_TRANSPORT_ONLY`, `MERGE_ZONE`, `SERVICE_LANE`, `PARKING_AREA` | **`BRT_ONLY`**, `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED` |
| **`BRT`** (Blue LAMATA Rapid Transit Coach) | **`BRT_ONLY`**, `BUS_TERMINAL_ACCESS`, `PUBLIC_TRANSPORT_ONLY`, `MERGE_ZONE`, `GENERAL_TRAFFIC` (shared connectors only) | `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED` |
| **`PRIVATE_CAR`** | `GENERAL_TRAFFIC`, `GENERAL_TRAFFIC_LEFT`, `GENERAL_TRAFFIC_RIGHT`, `MERGE_ZONE`, `SERVICE_LANE`, `PARKING_AREA` | **`BRT_ONLY`**, `PUBLIC_TRANSPORT_ONLY`, `BUS_TERMINAL_ACCESS`, `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED` |
| **`TAXI`** | `GENERAL_TRAFFIC`, `GENERAL_TRAFFIC_LEFT`, `GENERAL_TRAFFIC_RIGHT`, `BUS_STOP_BAY`, `MERGE_ZONE`, `SERVICE_LANE`, `PARKING_AREA` | **`BRT_ONLY`**, `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED` |
| **`KEKE` / `OKADA`** | `GENERAL_TRAFFIC`, `GENERAL_TRAFFIC_LEFT`, `BUS_STOP_BAY`, `MERGE_ZONE`, `SERVICE_LANE`, `PARKING_AREA` | **`BRT_ONLY`**, `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED` |
| **`DELIVERY_VAN` / `HEAVY_TRUCK`** | `GENERAL_TRAFFIC`, `GENERAL_TRAFFIC_LEFT`, `GENERAL_TRAFFIC_RIGHT`, `MERGE_ZONE`, `SERVICE_LANE` | **`BRT_ONLY`**, `PUBLIC_TRANSPORT_ONLY`, `RESTRICTED_ACCESS`, `TEMPORARILY_BLOCKED` |
| **`EMERGENCY_RESCUE`** | All road lanes including `BRT_ONLY` and `RESTRICTED_ACCESS` | `TEMPORARILY_BLOCKED` |

---

## 3. Physical Lateral Trajectory: Yellow Danfo Stop Bay Merge vs. Blue BRT Corridor

1. **Yellow Danfo (`veh_danfo_01` / `veh_danfo_coop`)**:
   - **At Bus Stop (`STOPPING -> DOORS_OPEN -> ALLOWING_ALIGHTING -> ALLOWING_BOARDING`)**: Stopped inside the `BUS_STOP_BAY` layby (`x = -110.2m`).
   - **Departure (`DOORS_CLOSING -> CHECKING_DEPARTURE -> MERGING_BACK_INTO_TRAFFIC`)**: Closes the sliding door (`doorSlideOffset = 0`), checks for oncoming traffic in the `MERGE_ZONE` (`x = -103.5m`) and `GENERAL_TRAFFIC_LEFT` (`x = -98.0m`), sounds a departure horn if clear, and steers diagonally (`yaw` angled +0.24 rad toward the major road) from `x = -110.2m` across `x = -103.5m` (`MERGE_ZONE`) onto the major road `x = -98.0m` (`GENERAL_TRAFFIC_LEFT`).
   - **Cruising (`EN_ROUTE`)**: Travels along `x = -98.0m` / `x = -94.0m` (`GENERAL_TRAFFIC`) until within `28m` of the next designated stop, where it transitions to `APPROACHING_STOP` and pulls smoothly into the next `BUS_STOP_BAY`.
2. **Blue BRT Coach (`veh_brt_01` + NPC BRT)**:
   - Operates exclusively along the blue-painted `BRT_ONLY` corridor (`x = -108.6m`), stopping only at dedicated BRT platforms (`CMS Dedicated BRT Platform`, `Marina BRT Station`, `TBS BRT Terminal`).

---

## 4. Automated Route & Lane Rule Verification Cases

| Test ID | Scenario | Input | Expected Result |
| :--- | :--- | :--- | :--- |
| **LR-01** | Danfo route from CMS Bus Park to National Theatre Connector | `vehicleClass: 'DANFO'`, `start: 'node_cms_bus_park'`, `end: 'node_national_theatre_connector'` | Routes via `['node_cms_bus_park', 'node_outer_marina_loop', 'node_national_theatre_connector']`. Excludes `node_cms_brt_gate` (`BRT_ONLY`) and `node_marina_rail_station` (`RESTRICTED_ACCESS` / rail). |
| **LR-02** | Danfo rejected from direct BRT gate target | `vehicleClass: 'DANFO'`, `start: 'node_cms_bus_park'`, `end: 'node_cms_brt_gate'` | Returns `ok: false, path: null` because `BRT_ONLY` is forbidden for `DANFO`. |
| **LR-03** | Blue BRT permitted on `BRT_ONLY` corridor | `vehicleClass: 'BRT'`, `start: 'node_cms_bus_park'`, `end: 'node_cms_brt_gate'` | Returns `ok: true, path: ['node_cms_bus_park', 'node_cms_brt_gate'], usesBrtOnly: true`. |
| **LR-04** | Private car / Keke forbidden from `BRT_ONLY` | `vehicleClass: 'PRIVATE_CAR'`, `laneType: 'BRT_ONLY'` | `isLanePermittedForVehicleClass('PRIVATE_CAR', 'BRT_ONLY') === false`. |
| **LR-05** | Temporary lane blockage diversion | `vehicleClass: 'DANFO'`, `start: 'node_cms_bus_park'`, `end: 'node_tbs_plaza'`, `blockedNodeIds: ['node_broad_st_mid']` | Diverts around blocked `node_broad_st_mid` or reports diversion path via unobstructed nodes. |
