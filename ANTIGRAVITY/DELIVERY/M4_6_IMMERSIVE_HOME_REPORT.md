# PROJECT EKO — M4.6 IMMERSIVE HOME & INTERIOR REALISM REPORT

**Date:** 2026-10-20  
**Milestone:** M4.6 Immersive Home & Interior Realism  
**Status:** VERIFIED & COMPLETE (40/40 Unit & Integration Tests Passing • 30/30 Live Headless Browser Checks Passing)

---

## 1. Audit of Previous vs. Upgraded Housing Implementation

| Subsystem | Previous Implementation (M4 Baseline) | M4.6 Immersive Home Upgrade | Status |
| :--- | :--- | :--- | :--- |
| **Home Coordinate System & Grounding** | Floating cutaway platform at `y = 6.2m` (`avatar.y = 6.32m`) above the villa roof. | Ground-level coherent 3D interior at `(-62, 0.12, -152)` (`avatar.y = 0.22m`), spatially aligned 1:1 with the exterior villa shell (`(-62, 2.0, -152)`) and South front entrance door (`(-62, 0.22, -148.0)`). | ✅ UPGRADED |
| **Exterior Shell Visibility** | Exterior villa shell remained static underneath the floating platform. | `syncExteriorHouseShellVisibility()` dynamically hides the exterior villa roof/shell (`isPlayerExteriorShell: true`) when inside (`isInsideHomeInterior === true`) and restores it immediately on exit. | ✅ UPGRADED |
| **Interior Camera Modes** | Single fixed elevated cutaway camera (`(-62, 13.4, -142.8)`). | Two distinct camera modes with `[C]` / HUD toggle: **1) Home Exploration Mode** (default human-scale 3rd-person follow camera at `y = floorY + 1.48m`, distance `1.95m`, with raycast wall/furniture collision avoidance) and **2) Home Planner Mode** (elevated cutaway floorplan view at `(-61.5, floorY + 6.45, -145.6)`). | ✅ UPGRADED |
| **Starter Home Architecture** | Simple perimeter box with flat floor mats and no interior partitions or windows. | Complete Nigerian self-contained apartment (`8.2m × 8.2m`) with `0.22m` walls, timber skirting boards, North & West recessed windows with mullions/sills/curtains, enclosed NE bathroom partition wall with doorway, NW bedroom alcove privacy half-wall, East kitchenette peninsula counter, and South mahogany front door with brass handle and welcome threshold. | ✅ UPGRADED |
| **3D Furniture & Appliances** | `82` sub-boxes across basic furniture shapes. | `105` multi-part 3D sub-boxes (1 draw call via `THREE.InstancedMesh`) including orthopedic bed with headboard posts & pillows, 4-blade standing fan with motor housing & control buttons, teak wardrobe with mirror door & handles, enclosed shower stall with chrome riser & overhead rose, ceramic washbasin with mirror & vanity, gas stove with red Jollof pot & spice rack, study desk with laptop/mouse/mug & chair, 3-seater parlor sofa with cushions & coffee table, fridge, grocery basket, solar inverter, and framed Afrobeat art canvas. | ✅ UPGRADED |
| **Avatar Collision & Furniture Placement** | Room-bound clamp (`±3.45m`) without furniture or partition collision. | `resolveHomeInteriorAvatarMovement()` prevents walking through placed furniture AABBs and interior partition walls; `validateFurniturePlacement()` rejects out-of-bounds (`PLACEMENT_OUT_OF_ROOM_BOUNDS`), doorway blocking (`PLACEMENT_BLOCKS_DOORWAY`), partition intersection (`PLACEMENT_COLLIDES_WITH_PARTITION`), and furniture overlap (`PLACEMENT_OVERLAPS_FURNITURE`). | ✅ UPGRADED |
| **HUD & Interaction Rules** | Street vehicle switcher and speed HUD remained visible inside the home. | `body.inside-home-interior-mode` CSS hides `#hud-bottom` (vehicle switcher/speedometer), `#danfo-hustle-launch-pill`, and street clutter while inside the home; displays a dedicated Home HUD with a compact expandable `Needs (93%)` pill, `Mode: Exploration [C] / Planner [C]` toggle, `Pantry & Fan` status pill, and contextual proximity prompt. | ✅ UPGRADED |

---

## 2. Two Distinct Home Camera Modes

### 2.1 Home Exploration Mode (`homeCameraMode = 'exploration'`, Default)
- Activated automatically upon entering the starter home via `enterHomeInterior()`.
- **Human-Scale Third-Person Follow Camera**:
  - Eye/pivot height: `floorY + 1.48m` (`1.60m` world Y), looking slightly ahead of the avatar (`lookAheadY = floorY + 1.16m`) so the room ahead is naturally visible.
  - Default follow distance: `1.95m` behind the avatar.
  - **Wall & Tall-Furniture Raycast Collision Avoidance (`resolveHomeInteriorCamera`)**: Steps 14 samples along the camera ray and pulls the camera smoothly forward (`safeDist` down to `0.55m`) whenever a perimeter wall (`±3.72m`), bathroom partition (`x = 1.35, z < -1.98` or `x > 2.58, z ≈ -1.42`), or tall furniture (`h >= 1.35m` such as the wardrobe or fridge) would occlude the view.
- **Full-Height Perimeter & Partition Walls**: In Exploration Mode, the East and South perimeter walls render at full room height (`2.32m`) and the bathroom enclosure renders at full partition height (`2.28m`), creating a genuine enclosed interior space.

### 2.2 Home Planner Mode (`homeCameraMode = 'planner'`)
- Toggled via the on-screen `📐 Mode: Planner [C]` button in the Home HUD or pressing `[C]` while inside the home.
- **Cutaway Architectural View**:
  - Automatically lowers the South and East cutaway walls to `0.48m` and the bathroom partition to `0.95m` while keeping North and West walls at full height (`2.65m`).
  - Positions the camera at `(-61.5, floorY + 6.45, -145.6)` looking at `(-62, floorY + 0.45, -152.1)`, giving an unobstructed view of all 8 room zones and every piece of furniture.
- **Interactive Furniture Placement Controls**:
  - Each object chip in Planner Mode exposes **Rotate 90° (`🔄`)**, **Nudge X (`↔`)**, and **Nudge Z (`↕`)** buttons that validate every move through `validateFurniturePlacement()` before updating the 3D scene and saving to `localStorage`.
  - Switching back to Exploration Mode immediately restores full wall heights and the 3rd-person camera without altering furniture coordinates or rotations.

---

## 3. Upgraded Starter-Home Architecture & Multi-Part 3D Assets

- **Spatial Consistency**:
  - Canonical Property Entity: `prop_marina_self_contain` (`Marina Palm Self-Contain`, Tier 1 Starter Pad) at `(-62, 0.12, -152)`.
  - Exterior Front Entrance Door: `(-62, 0.22, -148.0)` with mahogany door leaf, brass handle, emerald frame, porch canopy, and welcome step.
  - Adjacent city building `bldg_east_160` (*Kakawa Mercantile Court*) is positioned at `x = -44, z = -160` so the entire `8.2m × 8.2m` starter home parcel (`x ∈ [-66.1, -57.9], z ∈ [-156.1, -147.9]`) is 100% free of intersecting city geometry.
- **Multi-Part 3D Household Assets (`105` Sub-Boxes in 1 Draw Call)**:
  - **Bed (`itm_mattress_starter`)**: Mahogany bedframe, headboard, corner posts, orthopedic foam mattress, twin white pillows, and gold throw blanket.
  - **Wardrobe (`itm_wardrobe_rack`)**: Teak cabinet carcass, crown trim, full-length dressing mirror panel, central door seam, and twin brass handles.
  - **Bathroom (`itm_wash_basin` + Enclosure)**: Enclosed ceramic-tiled shower stall with glass screen, chrome riser rail, overhead shower rose, ceramic pedestal washbasin, vanity mirror, chrome tap, and towel bar.
  - **Kitchenette (`itm_table_stove` + `itm_grocery_basket` + `itm_compact_fridge`)**: Kitchenette cabinet, brushed steel twin-burner gas stove, control knobs, cast-iron grates, red Jollof pot with lid and handles, wall spice shelf with jars, woven grocery basket with produce, and double-door refrigerator.
  - **Study & Living (`itm_study_desk` + `itm_lounge_sofa` + `itm_standing_fan`)**: Timber desk with steel legs, open laptop, mouse, coffee mug, task chair, 3-seater velvet sofa with armrests, throw pillows, coffee table, and 4-blade standing fan with motor housing and speed buttons.

---

## 4. Physical Collision & Placement Validation Matrix

Verified in both `scripts/run_all_tests.js` and Check 27 of `scripts/verify_m3_1_atlas_polish.js`:

| Validation Rule | Test Case | Result |
| :--- | :--- | :--- |
| **Room Boundary Enforcement** | `validateFurniturePlacement('itm_standing_fan', 3.8, 0.0, 0)` | Rejected (`PLACEMENT_OUT_OF_ROOM_BOUNDS`) |
| **Front Doorway Clearance** | `validateFurniturePlacement('itm_standing_fan', 0.0, 3.2, 0)` | Rejected (`PLACEMENT_BLOCKS_DOORWAY`) |
| **Bathroom Doorway Clearance** | `validateFurniturePlacement('itm_standing_fan', 1.85, -1.45, 0)` | Rejected (`PLACEMENT_BLOCKS_BATHROOM_DOOR`) |
| **Interior Partition Collision** | `validateFurniturePlacement('itm_standing_fan', 1.35, -2.5, 0)` | Rejected (`PLACEMENT_COLLIDES_WITH_PARTITION`) |
| **Inter-Furniture AABB Overlap** | Placing a second item on top of an occupied coordinate | Rejected (`PLACEMENT_OVERLAPS_FURNITURE`) |
| **Avatar-vs-Furniture Collision** | `resolveHomeInteriorAvatarMovement(-62, -150.2, -64.4, -154.3)` (walking into bed) | Avatar stopped cleanly outside bed footprint |

---

## 5. Performance & Mobile Acceptance Measurements

| Metric / Viewport | Result |
| :--- | :--- |
| **Home Exploration Mode Performance (Desktop `1440×900`)** | **60 FPS** (`16.65 ms`), `35 – 44` draw calls, `25.2k` triangles |
| **Home Planner Mode Performance (Desktop `1440×900`)** | **60 FPS** (`16.65 ms`), `33` draw calls, `23.2k` triangles |
| **Mobile Portrait (`390×844`) Home Interior** | **60 FPS**, `36` draw calls, HUD height `<= 36dvh`, zero overlap with touch controls |
| **Mobile Landscape (`844×390`) Home Interior** | **60 FPS**, `42` draw calls, HUD height `<= 34dvh`, clear room visibility ahead |

---

## 6. Visual Evidence

- [m4_6_home_exterior_entrance.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_exterior_entrance.png) — Ground-level starter home exterior entrance (`(-62, 0.22, -148.0)`).
- [m4_6_home_exploration_mode.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_exploration_mode.png) — Default Home Exploration Mode (human-scale 3rd-person camera, contextual prompt, driving HUD hidden).
- [m4_6_home_planner_mode.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_planner_mode.png) — Home Planner Mode (elevated cutaway floorplan, expanded 8-needs pill, furniture rotation & nudge controls).
- [m4_6_home_cooking_and_bed.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_cooking_and_bed.png) — Functional stove cooking, fan toggle, and bed sleep interaction state.
- [m4_6_home_mobile_portrait.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_mobile_portrait.png) & [m4_6_home_mobile_landscape.png](file:///Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be/m4_6_home_mobile_landscape.png) — Mobile portrait and landscape layouts inside the 3D home.
