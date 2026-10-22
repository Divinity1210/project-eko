# PROJECT EKO — M4.6.1 IMMERSION, OCCLUSION & MOBILE UX POLISH REPORT

**Date:** 2026-10-20
**Scope:** Polish pass on existing systems only. No new feature families, districts or economy changes.
**Result:** M4.6.1 acceptance **60/60 passed**, run against the live app (`http://localhost:3000`). Regression browser suite (M3.1–M4.6) **30/30 passed**. Unit/integration suite **43/43 passed** in the sandbox. One older live-API test fails when it runs against the stateful dev server; details in §10.

> [!IMPORTANT]
> All "mobile" evidence comes from **headless Chrome with device-metrics and touch emulation**, driven by real CDP `Input.dispatchTouchEvent` multi-touch events. That is genuine touch input. It is **not** a physical phone. Frame rates were measured on the development Mac, so they are **not** phone GPU numbers. A test on a real iOS/Android device is still outstanding (§10).

---

## 1. Root causes found (and fixed)

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Avatar invisible indoors; nothing grounded in the first-person view | `resolveHomeInteriorAvatarMovement()` returned `{x, z}` only. The frame loop called `position.set(x, undefined, z)`, so `y` became `NaN` and the avatar's world matrix broke. | The function now returns `y = homeAvatarFootY (0.22 m)`. Avatar verified grounded across 98 walking samples. |
| 2 | The "Exploration" camera was really a front-facing selfie camera, so walking forward moved toward the screen | `resolveHomeInteriorCamera()` places the camera along `+lookYaw`, but the frame loop passed `playerHeading` instead of `playerHeading + π` | Now passes `heading + π`. Verified the camera sits 1.81 m behind the avatar at 1.63 m eye height. |
| 3 | Exterior player labels showed across the home interior | Peer badges were drawn with raw `project(camera)` and no visibility rules at all | New `EkoVisibility` service applies 6 ordered rules (§3) |
| 4 | Door prompts said `[E]`/`[H]` on phones | Keyboard-only strings were hard-coded in more than 25 places | New `EkoInputPrompts` service detects the active device and rewrites hints into real touch actions (§4) |
| 5 | The "Press [H] to enter home" prompt did nothing | The `[H]` handler always hit the vehicle-horn toast when on foot. The enter-home branch further down could never run. | `[H]` now enters the home when you are at the porch or residence. The prompt was corrected to `PRESS [E] OR [H] TO ENTER`. |
| 6 | The exterior house (5.8 m) was smaller than the interior (8.2 m). The door was inside the interior footprint, and there was no collider. | Mismatched geometry from M4.6 | Exterior shell is now 8.5 × 8.5 m, front door at z = −147.70 (interior doorway at −147.95). Added a solid `player_residence_shell` collider. |
| 7 | Street players could never reach the front door | The on-foot clamp stopped `x` at −66 (the door is at x = −62). Exiting the home teleported you to −62 and the next frame snapped you back to −66. | The walkable plot now extends to x = −57.5 along the residence frontage (z −157.5 to −140.5). The house collider blocks walking into the walls. |
| 8 | Camera started inside the house shell after exiting | The exit camera was set to z = −149.2, which is inside the shell | Camera now starts at z = −147.3 behind the avatar on the porch |
| 9 | The residence navigation point pointed at the side wall | `teleportToVenue('home')` used (−68, −152) | Now (−62, −146.2), on the porch facing the door. Vehicles are placed in the kerb lane. |
| 10 | The portrait home HUD overlapped the touch deck | HUD sat at `bottom: 78px` with z-index 1250, while the touch deck is 124 px tall | Portrait HUD sits at `bottom: safe+136px`. In landscape it docks between the two clusters. Overlap measured at **0 px²** on all viewports. |
| 11 | The interact prompt showed twice in the home | Both the street `#interaction-cue` and the home HUD prompt were visible | `#interaction-cue` is hidden in `home` and `planner` modes |
| 12 | One stove tap could cook twice; key + tap overlap could double-fire | `useHomeObject()` had no duplicate-input guard | A shared 900 ms per-object guard (`DUPLICATE_INPUT_SUPPRESSED`) covers keys, touch, HUD buttons and prompts |
| 13 | Game Naira earned since the last save was lost on reload (−1,200 GN observed) | Some balance changes never called `saveMasterBibleStateToStorage()` | State is now flushed on `pagehide`, `beforeunload` and when the page is hidden |
| 14 | Pressing Escape froze rendering (headless) | The browser's default Escape action set `visibilityState` to `hidden`, which stopped `requestAnimationFrame` | The game's Escape handler now calls `preventDefault()`. Confirmed with a CDP probe that frames resume. |
| 15 | Front view felt inverted | Turning is relative to the character, but in front view the screen is mirrored | The turn axis is mirrored in street front/portrait view, so screen-left goes left. Forward movement is unchanged. Indoors this flag is ignored. |
| 16 | On-foot turn buttons were 38 px tall | CSS | Raised to the 44 px minimum |

---

## 2. Starter home improvements

All new geometry goes into the existing single `InstancedMesh` (still one draw call). Canonical item IDs, prices, room zones and interactions are unchanged.

* **Architecture:** 2.72 m ceiling with cornice (hidden only in Planner). East and south walls now run full height so no city geometry shows above them. Door lintel, timber jamb and head casings, marble threshold, bathroom doorway header and threshold, all four skirting boards, wall switch (1.2 m) and power socket (0.3 m) as scale references. Bathroom partitions are now full height.
* **Materials and lighting:** Timber floor planks in alternating tones. The interior uses a `MeshStandardMaterial` (roughness 0.82) instead of flat Lambert shading. A warm `PointLight` ceiling lamp is created **once at boot** and dimmed to 0 outside the home, so the light count never changes and there are no shader recompile hitches.
* **Shadows and grounding:** Every object has a baked contact-shadow footprint (cheap ambient-occlusion substitute; dynamic shadow maps were not added, see §10).
* **Furniture detail:** Bed legs and duvet seam, sofa legs and seat cushions, two extra diagonal fan blades, stove control knobs and cabinet seam, wardrobe plinth, fridge feet, desk chair legs and desk apron.
* **Clearance (measured):** Walkable floor area is 38.2 m². Minimum avatar-to-furniture clearance while walking is 0.207 m. All 6 objects can be reached on foot within interaction range (0.6–1.2 m).
* **Spawning:** If the saved indoor position is now blocked (for example, furniture was moved), entry falls back to the canonical spawn inside the door (`isHomeInteriorPointBlocked()`).
* **Memory:** GPU geometry and materials from previous interior builds are now disposed on every rebuild.

## 3. Nameplate and occlusion (`EkoVisibility`)

Rules are applied in order to peer badges, chat bubbles, the new nearest-NPC nameplate and economic anchor badges:

1. Entity visibility state
2. Privacy/permission flag (`nameplatePrivacy: 'hidden'`)
3. Distance budget (peers 38 m, NPCs 9 m, anchors 12–15 m)
4. Camera frustum
5. **Interior/exterior boundary.** When the camera and the label are on opposite sides of the home shell, the label shows only if the camera→label segment passes through the **open doorway** (|x| < 0.92 m, y < 2.22 m). Windows are opaque panes, so they never reveal labels.
6. **Exterior wall occlusion.** New `EkoSpatialEngine.isLineOfSightBlocked()`: a segment-vs-AABB test against existing building and stall colliders taller than 1.35 m. It skips colliders that contain either endpoint and is cached per label, refreshed every 6 frames.

| Test (running app) | Result |
|---|---|
| Inside home, peer behind the west wall, in frustum, 14 m away | Hidden: `INTERIOR_BOUNDARY_OCCLUDED` ✅ |
| Inside home, peer seen through the open front door | Visible: `VISIBLE_THROUGH_DOORWAY` ✅ |
| Street, peer behind the house | Hidden: `WALL_OCCLUDED` (`player_residence_shell`) ✅ |
| Street, peer on the porch in clear view | Visible ✅ |
| Peer 48 m away | Hidden: `OUT_OF_RANGE` ✅ |
| Nearest NPC (Mama Nkechi) | Nameplate "💬 Mama Nkechi • Chef & Owner — Press E to talk"; `[E]` opened her dialogue ✅ |

Nameplates are **not** disabled globally.

## 4. Context-aware input prompts (`EkoInputPrompts`)

* **Device detection:** `(pointer: coarse)` media query at start. After that, the last input used decides: touch pointer/touchstart → `touch`; keydown or mouse pointer → `keyboard`. The result is exposed as `body.input-touch` / `body.input-keyboard`.
* **How rewriting works:** One `MutationObserver` rewrites text nodes only while touch is active, flushed in a microtask so no keyboard hint ever paints. Switching back to keyboard restores the original text exactly.
* **Mappings (each points to a real control):**
  * `Press [E]` → `Tap Interact`
  * `[H]` indoors → `Tap Exit Home` (new 🚪 EXIT HOME touch button)
  * `[C]` indoors → `📐 Plan` (CAM button turns into PLAN/WALK)
  * `[WASD]` → joystick
  * `[SPACE]` → `H-Brake` (bus boarding)
  * `[L]`/`[Z]`/`[Q]`/`[M]`/`[X]`… → `⚙️ Tools → …`
  * Button labels have their key suffixes removed.
* **Unavailable actions:** `[G]` Conductor Co-op and `[Y]` chat have no touch control, so the text says "(no touch control yet)" instead of showing a key.
* **Contextual interact button:** The label comes from the same proximity logic the game uses: ⚡ ENTER / ⚡ COOK / 🚪 EXIT / ⚡ TALK / ⚡ DRIVE. It shows a dimmed "NOTHING NEARBY" when nothing is in range.
* **Gamepad:** Gameplay has no controller bindings. A connected pad is detected and the player is told it is not supported; no fake button prompts are shown.
* **Duplicate events:** Key auto-repeat is ignored (existing). Touch has per-button debounce (existing). The new 900 ms object guard is verified: a second rapid tap at the stove did not cook again.

## 5. Contextual HUD states (`EkoHudMode`)

The state is recalculated every frame from the game's own flags and written to `body[data-hud-mode]`, so closing a modal automatically restores the previous interface. Recorded live sequence:
`interact→home→planner→home→interact→atlas→interact→street→…→driving→interact→atlas→interact→hustle→driving`

| Mode | What is shown / hidden |
|---|---|
| street / interact (phone) | Speedometer/vehicle strip hidden on foot; mission banner gives way to the active prompt |
| driving | Steering, pedals, horn, cam and gauge strip shown; on-foot clusters hidden |
| home | Driving clusters, vehicle strip, duplicate cue and bus HUD hidden; EXIT HOME + PLAN shown; residence title, pantry pill and catalog hidden on phones; furniture list starts collapsed |
| planner | As home, plus RUN and turn buttons hidden |
| atlas (modal or aerial) | Whole touch deck, cue, vehicle strip, home HUD and nameplates hidden |
| hustle | The existing Danfo Hustle HUD takes over |

## 6. Camera and input tests (real keys and real multi-touch)

| Test | Result |
|---|---|
| `[H]` at porch → inside; spawn clear of walls/door/furniture | ✅ (−62.00, 0.22, −150.20) |
| Exploration camera behind avatar at human height | ✅ 1.81 m behind, 1.63 m high |
| Held W in 7 headings, 98 samples | ✅ 0 furniture hits, 0 wall hits, always grounded |
| `[C]` → Planner → `[C]` → Exploration | ✅ Furniture JSON and avatar position byte-identical |
| Planner invalid placement | ✅ Out of bounds / blocks doorway rejected; valid position accepted |
| `[E]` at fan | ✅ ON→OFF, comfort 88→100 |
| `[H]` inside → porch; camera outside shell | ✅ (−62.00, −145.40), cam z −147.06 |
| Joystick held + Interact tapped with a second finger, then that finger lifted | ✅ Joystick stays active, W held throughout |
| Release / window blur | ✅ No stuck keys |
| LEFT/RIGHT (follow cam) | ✅ ΔLEFT > 0, ΔRIGHT < 0 |
| Front view: LEFT turns screen-left; joystick-up still walks forward | ✅ |
| Walk → drive (Tap Interact at sedan) → GAS + STEER LEFT together → exit → LEFT still turns left | ✅ No inversion |
| Tools → EkoAtlas hides touch deck; closing restores it | ✅ |
| Danfo Hustle state enters and exits | ✅ |
| Keyboard user after touch sees `PRESS [E] OR [H]` again | ✅ |

## 7. Mobile viewport evidence (touch emulation)

| Viewport | HUD vs touch overlap | Keyboard hints visible | Touch targets |
|---|---|---|---|
| Phone portrait 390×844 | 0 px² (HUD top 583/844) | 0 | All ≥ 41×44 px |
| Phone landscape 844×390 (home + driving) | 0 px² | 0 | ✅ |
| Tablet 768×1024 | 0 px² | 0 | ✅ |
| Desktop 1440×900 (keyboard) | n/a | Keys shown correctly | n/a |

Screenshots are in `ANTIGRAVITY/DELIVERY/screenshots/`:

| Before (M4.6) | After (M4.6.1) |
|---|---|
| `m4_6_1_before/m4_6_home_exploration_mode.png` (no avatar, city towers above walls) | `m4_6_1_home_exploration_desktop.png` (avatar from behind, ceiling, furnished room) |
| `m4_6_1_before/m4_6_home_mobile_portrait.png` (HUD over controls, keyboard keys) | `m4_6_1_mobile_portrait_home_exploration.png` (HUD above deck, EXIT HOME/PLAN, "Tap Interact") |
| `m4_6_1_before/m4_6_home_mobile_landscape.png` | `m4_6_1_phone_landscape_844x390_home.png` (contextual ⚡ COOK) |
| `m4_6_1_before/m4_6_home_planner_mode.png` | `m4_6_1_home_planner_desktop.png`, `m4_6_1_mobile_portrait_home_planner.png` |
| `m4_6_1_before/user_feedback_review.png` (your review) | `m4_6_1_occlusion_inside_home_no_labels.png`, `m4_6_1_occlusion_through_doorway.png`, `m4_6_1_npc_nameplate_desktop.png` |
| — | `m4_6_1_mobile_portrait_street_porch.png`, `m4_6_1_mobile_portrait_driving.png`, `m4_6_1_phone_landscape_844x390_driving.png`, `m4_6_1_mobile_portrait_atlas.png`, `m4_6_1_tablet_768x1024_home.png`, `m4_6_1_home_after_reload.png` |

## 8. Persistence

The desk was rotated 90° and the state saved, then the page was really reloaded (`Page.reload`). All of the following matched after reload:

* Furniture positions and rotations (desk rotY 1.5708)
* Pantry (1)
* Fan state (ON)
* Residence (`res_marina_selfcon`)
* Owned items (6)
* Game Naira balance

The Game Naira check failed until fix #13 was added.

## 9. Performance (headless Chrome on the dev Mac — not phone hardware)

Load costs: DOMContentLoaded 836 ms, load event 977 ms, three.min.js 342 ms / 118 KB, app boot 302 ms, home entry transition 692 ms (including the interior rebuild).

| Mode | Viewport / preset | FPS | Avg / p95 frame (ms) | Draw calls | Triangles | JS heap (MB) |
|---|---|---|---|---|---|---|
| Street | 1440×900 desktop_high | 60 | 16.68 / 17.6 | 52 | 27,336 | 18.6 |
| Home exploration | 1440×900 | 60 | 16.66 / 17.5 | 47 | 26,844 | 18.3 |
| Home planner | 1440×900 | 60 | 16.67 / 17.7 | 32 | 23,568 | 16.6 |
| EkoAtlas aerial | 1440×900 | 60 | 16.67 / 17.5 | 54 | 24,922 | 17.2 |
| EkoAtlas modal | 1440×900 | 60 | 16.67 / 17.5 | 40 | 24,152 | 16.2 |
| Street | 390×844 mobile_balanced | 60 | 16.67 / 16.8 | 31 | 21,852 | 16.6 |
| Home exploration | 390×844 | 60 | 16.66 / 16.9 | 32 | 23,640 | 16.9 |
| Home planner | 390×844 | 60 | 16.66 / 16.8 | 32 | 23,568 | 21.9 |
| EkoAtlas modal | 390×844 | 60 | 16.67 / 16.9 | 38 | 23,460 | 17.2 |
| Home exploration | 844×390 | 60 | 16.66 / 17.0 | 54 | 28,980 | 26.2 |
| Driving | 844×390 | 60 | 16.67 / 16.8 | 58 | 27,598 | 25.0 |
| Home exploration | 768×1024 | 60 | 16.67 / 16.8 | 41 | 24,940 | 18.2 |

Every mode stays within the existing budget (≤ 75 calls, ≤ 35k triangles). The 60 FPS ceiling comes from the display refresh rate on this machine.

## 10. Known defects and remaining placeholders

* **No physical-device test yet.** Real iOS Safari / Android Chrome sessions (safe-area notches, real GPU frame times, thermal throttling) are still needed.
* **Live-API unit test:** `Authoritative M3 API …` fails only when run unsandboxed against the long-running dev API on :3001 (`usr_eko_hustler_01` vs expected `player_amaka`). It passes or skips in the isolated sandbox. This is server state or identity drift that existed before this work, not an M4.6.1 change. The server was not modified.
* **Windows are opaque:** labels never show through them. Only the open doorway counts.
* **No dynamic shadow maps indoors.** Contact-shadow footprints are used instead (performance choice).
* **Furniture is still procedural boxes** (more detail and better materials, but no textured `.glb` hero assets).
* **No gamepad support** (detected and disclosed only).
* **No touch controls for Conductor Co-op `[G]` or quick chat `[Y]`.** Prompts say so instead of showing a key.
* **No touch rotate button in Exploration Mode.** Touch users rotate furniture in Planner via the 🔄 chips (keyboard `[R]` works in both modes).
* **Behaviour changes to note:**
  * Front-view turning is mirrored to match the screen.
  * Leaving Danfo Hustle returns you in the driving state.

## 11. Files changed

* `apps/game/index.html`:
  * Home geometry, materials, lighting and furniture detail
  * Exterior shell and collider, walkable frontage
  * Home camera, movement and spawn fixes
  * `[H]` and Escape fixes
  * `EkoInputPrompts`, `EkoVisibility`, `EkoHudMode`, `isLineOfSightBlocked`
  * Touch EXIT HOME / PLAN controls, contextual interact label, HUD-state CSS
  * Duplicate-use guard, persistence flush, navigation target fix
* `scripts/run_all_tests.js`: Suite 17 (3 tests); THREE mock and monotonic clock updates
* `scripts/verify_m4_6_1_immersion_mobile.js`: **new**, 60-check acceptance harness using real keys and real multi-touch
* `ANTIGRAVITY/DELIVERY/m4_6_1_acceptance_results.json`: raw results, metrics and HUD history
* `ANTIGRAVITY/DELIVERY/screenshots/m4_6_1_*.png` and `screenshots/m4_6_1_before/`
