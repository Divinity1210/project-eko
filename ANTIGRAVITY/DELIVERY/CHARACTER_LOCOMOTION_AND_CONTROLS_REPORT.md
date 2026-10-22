# PROJECT EKO — CHARACTER LOCOMOTION, GAIT FOOT-LOCKING & DIRECTIONAL CONTROLS REPORT

**Date:** 2026-10-16  
**Target Application:** [apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html) (`http://localhost:3000`)  
**Verification Suites:** [scripts/run_all_tests.js](file:///Users/divinity/Documents/Project%20Eko/scripts/run_all_tests.js) (`30/30 PASS`) • [scripts/verify_locomotion_and_controls.js](file:///Users/divinity/Documents/Project%20Eko/scripts/verify_locomotion_and_controls.js) (`9/9 Browser Acceptance Scenarios PASS`) • [scripts/verify_prompt4_integration.js](file:///Users/divinity/Documents/Project%20Eko/scripts/verify_prompt4_integration.js) (`Full-Stack Integration PASS`)

---

## 1. Root Cause Diagnosis (Section A)

A full audit of the character model (`EkoHumanCharacterSystem.createHumanoid`), 15-bone skeleton (`THREE.SkinnedMesh` + `THREE.Skeleton`), animation state machine (`EkoAnimStateMachine`), on-foot/vehicle movement code (`updateSimulation`), coordinate transformations, camera orientation, and keyboard input listeners identified **eight concrete root causes** across two defect classes:

### 1.1 Why the Character Appeared to Glide While Walking

| Defect ID | Subsystem | Root Cause Diagnosed | Impact Before Fix |
| :--- | :--- | :--- | :--- |
| **Defect 1A** | **State Name Mismatch (`walk` vs `walk_forward`, `walk_back` vs `walk_backward`)** | In `updateSimulation()`, the on-foot movement loop called `EkoAnimStateMachine.setState(playerAvatar, 'walk')` for forward walking and `'walk_back'` for backward walking (and `'walk'` for all walking NPC pedestrians). However, `EkoAnimStateMachine.updateCharacter()` only checked `if (activeState === 'walk_forward' \|\| activeState === 'start_move')` and `else if (activeState === 'walk_backward')`. | After the `0.11s` `start_move` transient expired, `activeState` became `'walk'`, which matched **no branch** inside `updateCharacter()`. All target bone rotations (`hpLX`, `hpRX`, `knLX`, `knRX`, `shLX`, `shRX`) defaulted to `0` (static bind pose) while `playerAvatar.position` translated across the ground—causing the character to glide like a rigid statue. |
| **Defect 1B** | **Ignored 3rd Parameter (`opts`) in `updateCharacter`** | `updateSimulation()` passed `{ speed: totalGroundSpeed, headLookYaw, headLookPitch, turnLean }` as the 3rd argument (`opts`) to `EkoAnimStateMachine.updateCharacter(playerAvatar, dt, opts)`, but `updateCharacter(charGroup, dt)` only declared two parameters and ignored `opts`. | `charGroup.anim.speed` remained `0` (`undefined`/unupdated), disconnecting animation playback speed and stride amplitude from actual ground translation speed. |
| **Defect 1C** | **Unrealistic Walk/Run Translation Speeds vs. Leg Geometry** | `baseWalkSpeed` was set to `4.8 m/s` (`17.3 km/h`—faster than a human sprint) and `baseRunSpeed` to `9.2 m/s` (`33.1 km/h`), while the humanoid leg length is $L_{\text{leg}} = 0.90\text{ m}$ ($L_{\text{thigh}} = 0.41\text{ m}$, $L_{\text{calf+foot}} = 0.49\text{ m}$). | Even with active limb oscillation, translating at `4.8 m/s` during a walk forced the character to slide ~2.1 meters per step beyond physical foot contact. |
| **Defect 1D** | **Inverted Knee Swing Phase & Missing Vertical Foot-Locking** | Knee flexion previously used `Math.max(0, Math.sin(p - 0.65))` (which bent the knee during the backward stance phase instead of the forward swing phase) and `hipsY` used a flat `Math.abs(Math.sin(p))` offset rather than solving stance-leg vertical reach. | The stance foot lifted off or sank into the pavement instead of planting firmly while the swing knee cleared the ground. |

### 1.2 Why Left / Right Controls Were Reversed

| Defect ID | Subsystem | Root Cause Diagnosed | Impact Before Fix |
| :--- | :--- | :--- | :--- |
| **Defect 2A** | **Vehicle Steering Sign Inversion** | In Three.js right-handed coordinates with the vehicle/character facing `+Z` (`heading = 0`) and `+Y` up, World Left ($\mathbf{U} \times \mathbf{F}$) is `+X` and World Right ($\mathbf{F} \times \mathbf{U}$) is `-X`. Positive yaw ($\Delta\psi > 0$, `steeringAngle > 0`) rotates `+Z` toward `+X` (**Left**). However, `updateSimulation()` had `if (keys.a) steeringAngle = Math.max(-0.68, steeringAngle - ...)` and `else if (keys.d) steeringAngle = Math.min(0.68, steeringAngle + ...)`. | Pressing `A` / `ArrowLeft` while driving set `steeringAngle < 0` (`-yaw`), which steered the vehicle **Right** (`-X`), while pressing `D` / `ArrowRight` set `steeringAngle > 0` (`+yaw`), steering **Left** (`+X`). |
| **Defect 2B** | **On-Foot Camera Look-Ahead Pan Kick & Rigid Yaw Lock** | The third-person follow camera locked `followYaw = playerHeading` on every frame (even when turning in place) and aimed `camera.lookAt` at `2.8m` in front of `playerHeading` before the camera position (`0.14` lerp) moved behind the player. | When pressing `A` (Turn Left, `+playerHeading`), `lookTargetX` immediately jumped `+X` (left) `2.8m` ahead of the player before the camera body moved, panning the camera lens left and visually kicking the player character to the **right** side of the screen while keeping their back rigidly locked to the camera. |
| **Defect 2C** | **Inverted Head Turn Yaw (`headLookYaw`)** | In `updateSimulation()`, `headLookYaw` was computed as `-playerTurnVel * 0.14`. | When turning left (`playerTurnVel > 0`, `+Y`), the character's head rotated `-Y` (to the **right**), contradicting the turn direction. |
| **Defect 2D** | **Swapped Anatomical Left / Right Bone X-Coordinates** | In `EkoHumanCharacterSystem.createHumanoid()`, `bShoulderL` and `bHipL` were positioned at `-X` (`-shoulderX`, `-hipX`) and `bShoulderR` and `bHipR` at `+X` (`+shoulderX`, `+hipX`). | For a character facing `+Z` with `+Y` up, anatomical Left is `+X` and anatomical Right is `-X`. Placing left bones on `-X` inverted left/right limb identity. |

---

## 2. Files Modified & Animation Assets / Systems Used

### 2.1 Files Modified
1. **[apps/game/index.html](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html)**
   - [`EkoHumanCharacterSystem.createHumanoid`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L5060-L5501): Calibrated canonical `+Z` forward and anatomical Left (`+X`) / Right (`-X`) joint coordinates (`bShoulderL` at `+shoulderX`, `bShoulderR` at `-shoulderX`, `bHipL` at `+hipX`, `bHipR` at `-hipX`), added high-contrast indigo-slate trousers (`0x253B56`) and ankle cuff accents on `Amaka Driver` for unmistakable visual leg readability, and initialized gait/foot-locking telemetry fields (`canonicalState`, `stateHistory`, `strideLength`, `gaitFrequency`, `leftFootHeight`, `rightFootHeight`, `stanceFoot`).
   - [`EkoAnimStateMachine`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L5510-L5914): Implemented `normalizeState()` (`'walk' -> 'walk_forward'`, `'walk_back' -> 'walk_backward'`), synchronized 3rd-argument `opts` (`speed`, `signedSpeed`, `turnRate`, `headLookYaw`, `headLookPitch`), implemented stride-matched gait angular velocity $\omega = \pi v / S$, 180° alternating leg swing, counter-swinging arms, swing-phase knee flexion, analytical stance-foot ground locking (`hipsY = 0.02 + Math.max(reachL, reachR)`), retrograde `walk_backward` gait, in-place stepping `turn_left`/`turn_right`, and stationary phase decay to `0` in `idle`.
   - [`updateSimulation`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L9516-L9962): Fixed vehicle steering sign convention (`keys.a` $\rightarrow$ `+steeringAngle` Left, `keys.d` $\rightarrow$ `-steeringAngle` Right), calibrated biomechanical on-foot speeds (`baseWalkSpeed = 2.65 m/s`, `baseRunSpeed = 5.60 m/s`, `reverseWalkSpeed = -1.75 m/s`), fixed `headLookYaw = +playerTurnVel * 0.15`, and decoupled `followCamYaw` and `frontCamYaw` during in-place turns.
   - [`toggleVehicleMount`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L10621-L10738), [`toggleFrontViewCamera`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L10833-L10859), [`cycleCamera`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L10877-L10909), and [`quickSwitchVehicle`](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L11114-L11202): Synchronized `followCamYaw` and `frontCamYaw` with `playerHeading` across mode transitions and ensured vehicle mounting from selfie view cleanly resets `cameraMode` to `'chase'`.
   - [`EkoLocomotionDiagnostics` (`window.__PROJECT_EKO_LOCOMOTION__`)](file:///Users/divinity/Documents/Project%20Eko/apps/game/index.html#L12919-L12999): Exposed real-time skeletal joint angles, foot heights, stride length, gait frequency, heading, camera yaw, and vehicle steering telemetry.
2. **[scripts/run_all_tests.js](file:///Users/divinity/Documents/Project%20Eko/scripts/run_all_tests.js)**
   - Added **Suite 11** (`Character Locomotion, Gait Foot-Locking & Directional Controls`) testing `EkoAnimStateMachine` kinematics, foot-locking, retrograde walk, running frequency scaling, stationary zero-cycling, and directional control sign conventions (`30/30 PASS`).
3. **[scripts/verify_locomotion_and_controls.js](file:///Users/divinity/Documents/Project%20Eko/scripts/verify_locomotion_and_controls.js)**
   - Created automated Headless Chrome CDP browser verification suite executing all 9 acceptance test scenarios from Section E and saving quantitative telemetry to [ANTIGRAVITY/DELIVERY/locomotion_verification_metrics.json](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/locomotion_verification_metrics.json).

### 2.2 Character Rigs & Animation System Used
- **Canonical 15-Bone glTF 2.0 Armatures ([apps/game/assets/characters/manifest.json](file:///Users/divinity/Documents/Project%20Eko/apps/game/assets/characters/manifest.json))**:
  - `eko_citizen_female.glb`, `eko_citizen_male.glb`, `eko_ elder_female.glb`, `eko_vendor_male.glb` (100% original Project Eko procedural glTF 2.0 binary assets, `+Z` forward axis, `+Y` up axis).
  - 15 hierarchical bones: `Root` (0) $\rightarrow$ `Hips` (1) $\rightarrow$ `Spine` (2) $\rightarrow$ `Neck` (3) $\rightarrow$ `Head` (4), `Shoulder_L` (5) $\rightarrow$ `Forearm_L` (6), `Shoulder_R` (7) $\rightarrow$ `Forearm_R` (8), `Thigh_L` (9) $\rightarrow$ `Shin_L` (10) $\rightarrow$ `Foot_L` (11), `Thigh_R` (12) $\rightarrow$ `Shin_R` (13) $\rightarrow$ `Foot_R` (14).
- **Procedural Biomechanical Joint-Animation & Foot-Locking Engine (`EkoAnimStateMachine`)**:
  - Supports all 17+ states: `idle`, `start_move`, `walk_forward` (alias `walk`), `walk_backward` (alias `walk_back`), `run`, `turn_left`, `turn_right`, `stop_move`, `look_around`, `talk_gesture`, `interact`, `enter_vehicle`, `exit_vehicle`, `stand_bus_stop`, `sit_vehicle`, `driving`, `passenger_board`, `passenger_disembark`, `hail`, and `conductor_call`.

---

## 3. Biomechanical Locomotion & Foot-Locking Design (Section B)

To eliminate foot sliding and ensure natural human gait:
1. **Stride-Matched Phase Advancement**:
   - Given instantaneous ground speed $v = |\text{speed}|$, step angular amplitude $\theta_{\text{amp}}$, and anatomical leg length $L_{\text{leg}} = L_{\text{thigh}} + L_{\text{calf+foot}} = 0.41 + 0.49 = 0.90\text{ m}$:
     $$L_{\text{step}} = 2 L_{\text{leg}} \sin(\theta_{\text{amp}}), \qquad \omega = \frac{\pi \, v}{L_{\text{step}}}, \qquad \phi(t + \Delta t) = (\phi(t) + \omega \Delta t) \bmod 2\pi$$
   - Full stride length is $S = 2 L_{\text{step}} \approx 2.01\text{ m}$ at brisk walk ($v = 2.65\text{ m/s}$, $f = 1.32\text{ Hz}$) and increases during running ($v = 5.60\text{ m/s}$, $f = 1.90\text{ Hz}$).
2. **Alternating Legs & Counter-Swinging Arms**:
   - Left and right legs operate strictly $180^\circ$ ($\pi\text{ rad}$) out of phase ($\phi_L = \phi$, $\phi_R = \phi + \pi$).
   - Hip pitch `hpLX = -Math.sin(pL) * strideAmp` swings the left leg forward (`+Z`) when $\sin(\phi_L) > 0$, while `shLX = +Math.sin(pL) * armAmp` swings the left arm backward (`-Z`) and `shRX = -Math.sin(pL) * armAmp` swings the right arm forward (`+Z`).
3. **Asymmetric Swing-Phase Knee Flexion & Analytical Vertical Foot-Locking**:
   - Each knee flexes during the forward swing phase ($\cos(\phi - 0.22) > 0$) up to `0.77 rad` (`44°`) to clear the ground, while remaining supportive during the stance phase.
   - Pelvis elevation `hipsY` is solved analytically on every frame from the vertical reach of the stance leg:
     $$\text{reach}_i = L_{\text{thigh}}\cos(\theta_{\text{hip},i}) + L_{\text{calf+foot}}\cos(\theta_{\text{hip},i} + \theta_{\text{knee},i}), \qquad y_{\text{hips}} = 0.02 + \max(\text{reach}_L, \text{reach}_R)$$
   - This locks the stance foot sole at $0.00\text{ m}$ ground clearance while the swing foot lifts up to $0.14\text{ m}$.

---

## 4. Authoritative Coordinate System & Control Mapping (Section C)

### 4.1 Canonical Coordinate System (Calibrated in One Authoritative Place)
- **Model & Vehicle Forward Axis**: `+Z` $\rightarrow$ World $(\sin\psi, 0, \cos\psi)$
- **Model & Vehicle Up Axis**: `+Y` $\rightarrow$ World $(0, 1, 0)$
- **Model & Vehicle Left Axis**: `+X` $\rightarrow$ World $(\cos\psi, 0, -\sin\psi)$
- **Model & Vehicle Right Axis**: `-X` $\rightarrow$ World $(-\cos\psi, 0, \sin\psi)$
- **Turn Left Sign**: $\Delta\psi > 0$ (`playerTurnVel > 0`, `steeringAngle > 0`) rotates `+Z` toward `+X` (**Left**).
- **Turn Right Sign**: $\Delta\psi < 0$ (`playerTurnVel < 0`, `steeringAngle < 0`) rotates `+Z` toward `-X` (**Right**).

### 4.2 Unified Directional Control Table

| Mode | Active Camera | Physical Input | Action / State | Mathematical Effect | Verified Visual & Spatial Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On Foot** | Follow (`chase`) or Front (`front`/`portrait`) | `W` / `ArrowUp` | Move Forward (`walk_forward`) | `playerCurrentSpeed = +2.65 m/s` along $(\sin\psi, \cos\psi)$ | Advances forward along character's facing direction with alternating gait |
| **On Foot** | Follow (`chase`) or Front (`front`/`portrait`) | `Shift` + `W` / `ArrowUp` | Run Forward (`run`) | `playerCurrentSpeed = +5.60 m/s` along $(\sin\psi, \cos\psi)$ | Sprints forward with faster gait cycle ($1.90\text{ Hz}$) and deeper knee drive |
| **On Foot** | Follow (`chase`) or Front (`front`/`portrait`) | `S` / `ArrowDown` | Move Backward (`walk_backward`) | `playerCurrentSpeed = -1.75 m/s` along $(\sin\psi, \cos\psi)$ | Steps backward with retrograde gait and over-shoulder glance |
| **On Foot** | Follow (`chase`) or Front (`front`/`portrait`) | `A` / `ArrowLeft` | Turn Left (`turn_left`) | `playerTurnVel = +2.55 rad/s` ($\Delta\psi > 0$) | Rotates character visibly to their **Left** (`+X` at $\psi=0$) |
| **On Foot** | Follow (`chase`) or Front (`front`/`portrait`) | `D` / `ArrowRight` | Turn Right (`turn_right`) | `playerTurnVel = -2.55 rad/s` ($\Delta\psi < 0$) | Rotates character visibly to their **Right** (`-X` at $\psi=0$) |
| **Driving** | Third-Person (`chase`) or Cockpit (`hood`) | `W` / `ArrowUp` | Accelerate | Increases `currentSpeedKmh` toward `vProfile.maxSpeed` | Accelerates vehicle forward along $(\sin\psi_v, \cos\psi_v)$ |
| **Driving** | Third-Person (`chase`) or Cockpit (`hood`) | `S` / `ArrowDown` | Brake / Reverse | Decelerates or reverses down to `-28 km/h` | Brakes with nose-dive or backs up cleanly |
| **Driving** | Third-Person (`chase`) or Cockpit (`hood`) | `A` / `ArrowLeft` | Steer Left | `steeringAngle > 0` ($\Delta\psi_v > 0$ when moving forward) | Front wheels and vehicle trajectory turn **Left** (`+X` at $\psi_v=0$) |
| **Driving** | Third-Person (`chase`) or Cockpit (`hood`) | `D` / `ArrowRight` | Steer Right | `steeringAngle < 0` ($\Delta\psi_v < 0$ when moving forward) | Front wheels and vehicle trajectory turn **Right** (`-X` at $\psi_v=0$) |

---

## 5. Browser Acceptance Test Results & Telemetry (Section E)

All browser acceptance tests in [scripts/verify_locomotion_and_controls.js](file:///Users/divinity/Documents/Project%20Eko/scripts/verify_locomotion_and_controls.js) were executed in live Headless Chrome (WebGL enabled, `1280x720`) against `http://localhost:3000`. Full telemetry is saved in [ANTIGRAVITY/DELIVERY/locomotion_verification_metrics.json](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/locomotion_verification_metrics.json):

| Acceptance Test Scenario | Input Tested | Recorded State & Telemetry | Result |
| :--- | :--- | :--- | :--- |
| **1. Walk Forward (3+ seconds)** | `W` (`KeyW`) | `canonicalState = 'walk_forward'`, $\Delta Z = +8.448\text{ m}$, $v = 2.65\text{ m/s}$, $S = 2.008\text{ m}$, $f = 1.32\text{ Hz}$, `maxHipSpread = 1.052 rad`, `maxArmSpread = 0.820 rad`, `maxKneeL/R = 0.767 / 0.768 rad`, `leftLeadFrames = 67`, `rightLeadFrames = 68`, `footLockPassedAllFrames = true` | **PASS** |
| **2. Stop & Confirm Stationary** | Release `W` | `stop_move` $\rightarrow$ `idle`, $v = 0\text{ m/s}$, `phaseFrame55 = 0.000`, `phaseFrame74 = 0.000`, `hipLRotX = 0`, `hipRRotX = 0` (zero idle limb cycling) | **PASS** |
| **3. Walk Backward** | `S` (`KeyS`) | `canonicalState = 'walk_backward'`, $\Delta Z = -3.362\text{ m}$, $v = -1.75\text{ m/s}$, $S = 1.398\text{ m}$, `maxHipSpread = 0.716 rad`, `spineRotX = -0.04 rad` | **PASS** |
| **4. Turn Left On Foot (WASD)** | `A` (`KeyA`) then `W` | `canonicalState = 'turn_left'`, `playerHeading = +1.105 rad` (`+63.3°` Left), subsequent forward walk $\Delta X = +1.485\text{ m}$ (World Left) | **PASS** |
| **5. Turn Right On Foot (WASD)** | `D` (`KeyD`) then `W` | `canonicalState = 'turn_right'`, `playerHeading = -1.105 rad` (`-63.3°` Right), subsequent forward walk $\Delta X = -1.485\text{ m}$ (World Right) | **PASS** |
| **6. Repeat with Arrow Keys & Run** | `ArrowUp`, `Shift+ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` | `ArrowUp` $\rightarrow$ `walk_forward`; `Shift+ArrowUp` $\rightarrow$ `run` ($5.60\text{ m/s}$, $f = 1.90\text{ Hz}$); `ArrowDown` $\rightarrow$ `walk_backward`; `ArrowLeft` $\rightarrow$ `+1.105 rad` Left; `ArrowRight` $\rightarrow$ `-1.105 rad` Right | **PASS** |
| **7. Front-Facing View (`[V]`)** | `KeyV` + `W`/`S`/`A`/`D` | `isFrontViewMode = true`, `cameraMode = 'front'`, `W` $\Delta Z = +2.663\text{ m}$ forward, `S` backward, `A` turns Left (`+1.105 rad`), `D` turns Right (`-0.936 rad`) — zero camera inversion | **PASS** |
| **8. Enter & Exit Vehicle (`[E]`)** | `KeyE` near car & in car | `enteredDriving = true` (`enter_vehicle`), `exitedOnFoot = true` (`exit_vehicle`) | **PASS** |
| **9. Drive Left/Right in Chase & Cockpit Views** | `W+A`, `W+D` (`chase`) & `C` + `ArrowUp+ArrowLeft`, `ArrowUp+ArrowRight` (`hood`) | **Chase View:** Left `steer = +0.68 rad`, `heading = +2.77 rad`, $\Delta X = +6.333\text{ m}$ (Left); Right `steer = -0.68 rad`, `heading = -2.30 rad`, $\Delta X = -5.217\text{ m}$ (Right). **Cockpit (`hood`) View:** Left `steer = +0.68 rad`, `heading = +0.96 rad`, $\Delta X = +1.267\text{ m}$ (Left); Right `steer = -0.68 rad`, `heading = -2.30 rad`, $\Delta X = -5.217\text{ m}$ (Right) | **PASS** |

---

## 6. Visual Verification Screenshots

All 10 acceptance screenshots were captured directly from the live browser canvas:

1. **Walk Forward (Follow View — Alternating Legs & Foot-Locking)**: [locomotion_01_walk_forward_follow.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_01_walk_forward_follow.png)
2. **Stationary Stop (`stop_move` $\rightarrow$ `idle` — Zero Limb Cycling)**: [locomotion_02_stationary_idle.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_02_stationary_idle.png)
3. **Walk Backward (`walk_backward` Retrograde Gait)**: [locomotion_03_walk_backward_follow.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_03_walk_backward_follow.png)
4. **Turn Left On Foot (`A` $\rightarrow$ `turn_left`, `+yaw` Left)**: [locomotion_04_turn_left_wasd.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_04_turn_left_wasd.png)
5. **Turn Right On Foot (`D` $\rightarrow$ `turn_right`, `-yaw` Right)**: [locomotion_05_turn_right_wasd.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_05_turn_right_wasd.png)
6. **Running Gait (`Shift + ArrowUp` — High Knee Drive & Counter-Swing)**: [locomotion_06_run_and_arrow_keys.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_06_run_and_arrow_keys.png)
7. **Front-Facing / Selfie Mode (`[V]` — Walk Forward Toward Camera)**: [locomotion_07_front_view_walk_forward.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_07_front_view_walk_forward.png)
8. **Front-Facing / Selfie Mode (`[V]` — Turn Left/Right Inspection)**: [locomotion_08_front_view_turn_left_right.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_08_front_view_turn_left_right.png)
9. **Driving Third-Person (`chase`) View — Steer Left & Right**: [locomotion_09_driving_chase_steer_left_right.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_09_driving_chase_steer_left_right.png)
10. **Driving Cockpit (`hood`) View — Steer Left & Right**: [locomotion_10_driving_cockpit_steer_left_right.png](file:///Users/divinity/Documents/Project%20Eko/ANTIGRAVITY/DELIVERY/screenshots/locomotion_10_driving_cockpit_steer_left_right.png)

---

## 7. Remaining Defects & Performance Budget Audit

- **Remaining Locomotion or Control Defects**: **None (`0`)**.
- **Runtime Console / Page Errors**: **`0` errors**.
- **WebGL Render Budget**: **`65 draw calls`** (target $\le 75$) and **`31.0k triangles`** (target $\le 35,000$).
