# PROJECT EKO — M4.8.1 KEYBINDING AUDIT & CENTRAL INPUT REGISTRY

**Date:** 2026-10-21  
**Milestone:** M4.8.1 — Phase 1: Fix the Keybinding Conflict & Establish Central Input Registry  
**Status:** **AUDITED & RESOLVED**

---

## 1. Root Cause of the `F` Keybinding Conflict (`media_1792575706631_369c1edf.png`)

### Observed Defect
When standing on foot beside the **Apex Danfo 14 Commercial Minibus**, the contextual interaction prompt displayed:
- `🚐 APEX DANFO 14: [E] DRIVE • [F] BOARD AS PASSENGER • [G] CONDUCTOR`

Simultaneously, the top-left header button displayed:
- `🪪 Flex Card (F)`

When the player pressed `F` to board the Danfo as a passenger:
1. In `apps/game/index.html` (`lines 14933–14941`), the `keydown` handler checked `window.__PROJECT_EKO_VEHICLE_STATE__.tryBoardNearestVehicleAsPassenger()`, which was not wired as a method on `EkoVehicleOccupancySystem`, causing execution to fall through directly to `openEkoFlexCard()`.
2. Even if `tryBoardNearestVehicleAsPassenger()` returned `false` (for example, when slightly outside boarding range or when a prompt was transitioning), `F` unconditionally fell back to opening the **Lagos Citizen Telemetry Card (Flex Card)** modal (`#flex-card-modal`), blocking gameplay and preventing passenger boarding.
3. In `EkoInputPrompts` (`line 20403`), `F` was still mapped to `F: '⚙️ Tools → Flex Card'` in the touch adaptation table.

---

## 2. Repository-Wide Keyboard Listener Audit

We audited all `addEventListener('keydown', ...)` and `addEventListener('keyup', ...)` registrations in `apps/game/index.html`:
1. **Primary World & UI Keydown Dispatcher (`line 14821`)**: Handles locomotion, driving, vehicle interaction (`E`, `F`, `G`), camera (`C`, `V`, `Z`), EkoPhone (`P`), EkoLife (`L`, `H`, `R`), Jobs (`J`), Audio (`M`, `H`), Weather/Time (`R`, `T`, `B`), Quick Chat (`Y`, `1–5`), and Modal Escape (`Escape`).
2. **Primary Keyup Dispatcher (`line 15108`)**: Releases held movement/steering keys (`W`, `A`, `S`, `D`, `Arrow*`, `Shift`, `Space`) and reconciles with active touch holds.
3. **Input Device Detector (`line 20291`)**: Passive capture listener in `EkoInputPrompts` that switches `document.body.dataset.inputDevice = 'keyboard'` when a physical key is pressed.Does not trigger any game actions.
4. **Danfo Hustle Arcade Mode Listener (`line 21026`)**: Active strictly when `EkoDanfoHustleMode.isActive && runState === 'running'`.

To prevent any conflict or scattered logic, all discrete and continuous keybindings are now governed by a single authoritative registry: **`EkoKeybindingRegistry` (`window.__PROJECT_EKO_KEYBINDING_REGISTRY__`)**, with focus-loss (`blur` / `visibilitychange`) held-key reset, `e.repeat` suppression, modal input gating, and strict input-context exclusivity.

---

## 3. Canonical Keybinding Table & Input Context Matrix

| Key / Code | Action ID | Context(s) Permitted | Description | Conflict Resolution |
| :--- | :--- | :--- | :--- | :--- |
| `KeyE` (`E`) | `VEHICLE_DRIVE_OR_INTERACT` | `ON_FOOT` | Enter & drive authorised vehicle, talk to NPC, or interact with shop/station | Mutually exclusive with `DRIVER` / `PASSENGER` / `CONDUCTOR` exit |
| `KeyE` (`E`) | `VEHICLE_EXIT_AT_SAFE_STOP` | `DRIVER`, `PASSENGER`, `CONDUCTOR` | Exit vehicle to curb when safely stationary (`< 5 km/h` at permitted stop) | Blocked while vehicle is moving (`>= 5 km/h`) with clear safety explanation |
| `KeyF` (`F`) | `BOARD_AS_PASSENGER` | `ON_FOOT` | Open Danfo Route & Destination Fare Selector (or board nearest passenger vehicle) | **Exclusive to Passenger Boarding on foot. Removed from Flex Card.** |
| `KeyF` (`F`) | `PASSENGER_REQUEST_STOP_OWA` | `PASSENGER` | Request stop (`"O wa o!"`) at next designated bus stop | Only active while seated as `PASSENGER` |
| `KeyG` (`G`) | `JOIN_OR_LEAVE_CONDUCTOR` | `ON_FOOT`, `CONDUCTOR` | Join Apex Danfo 14 as Conductor on foot, or step down when stationary | Blocked in `DRIVER` and `PASSENGER` states |
| `KeyO` (`O`) | `PASSENGER_CALL_OWA` | `PASSENGER`, `CONDUCTOR` | Passenger calls `"O wa o!"` for next stop; Conductor announces upcoming stop to driver | Exclusive to transit cabin operations |
| `KeyU` (`U`) | `OPEN_FLEX_CARD` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Toggle Shareable Eko Citizen Flex Card (`#flex-card-modal`) | **Assigned unused key `U` (+ visible `🪪 Flex Card` top-bar button)** |
| `KeyC` (`C`) | `CYCLE_CAMERA_OR_CALL_ROUTE` | `ON_FOOT`, `DRIVER`, `PASSENGER`, `CONDUCTOR` | Cycles camera (`chase` ↔ `cockpit` in `DRIVER`; `passenger` ↔ `chase` in `PASSENGER`); calls route in `CONDUCTOR` | Context-partitioned by authoritative occupancy state |
| `Space` | `VEHICLE_BRAKE_OR_BUS_STOP` | `DRIVER`, `CONDUCTOR`, `DANFO_HUSTLE` | Handbrake & bus-stop boarding (`DRIVER`); Fare collection & boarding (`CONDUCTOR`) | Disabled in `PASSENGER` (`isDriving === false`) |
| `KeyW` / `ArrowUp` | `LOCOMOTION_FORWARD_OR_THROTTLE` | `ON_FOOT`, `DRIVER` | Walk forward (`ON_FOOT`) or accelerate (`DRIVER`) | Disabled in `PASSENGER` and `CONDUCTOR` |
| `KeyS` / `ArrowDown` | `LOCOMOTION_BACK_OR_BRAKE` | `ON_FOOT`, `DRIVER` | Walk backward (`ON_FOOT`) or brake/reverse (`DRIVER`) | Disabled in `PASSENGER` and `CONDUCTOR` |
| `KeyA` / `ArrowLeft` | `LOCOMOTION_LEFT_OR_STEER` | `ON_FOOT`, `DRIVER`, `PASSENGER` | Turn left (`ON_FOOT`), steer left (`DRIVER`), look left (`PASSENGER`) | Never steers vehicle in `PASSENGER` |
| `KeyD` / `ArrowRight` | `LOCOMOTION_RIGHT_OR_STEER` | `ON_FOOT`, `DRIVER`, `PASSENGER` | Turn right (`ON_FOOT`), steer right (`DRIVER`), look right (`PASSENGER`) | Never steers vehicle in `PASSENGER` |
| `KeyQ` (`Q`) | `QUICK_ACTION_OR_LOOK_LEFT` | `ON_FOOT`, `PASSENGER`, `CONDUCTOR` | Quick action (`ON_FOOT`), look left (`PASSENGER`), verify change (`CONDUCTOR`) | Context-partitioned |
| `KeyR` (`R`) | `RAIN_ROTATE_OR_LOOK_RIGHT` | `ON_FOOT`, `HOME_INTERIOR`, `PASSENGER` | Toggle rain (`ON_FOOT`), rotate furniture (`HOME_INTERIOR`), look right (`PASSENGER`) | Context-partitioned |
| `KeyH` (`H`) | `HOME_DOOR_OR_HORN` | `ON_FOOT`, `HOME_INTERIOR`, `DRIVER` | Enter/exit 3D home (`ON_FOOT`/`HOME_INTERIOR`), sound horn (`DRIVER`) | Disabled in `PASSENGER` |
| `KeyP` (`P`) | `TOGGLE_EKOPHONE` | `ON_FOOT`, `PASSENGER`, `CONDUCTOR` | Open/close EkoPhone OS | Auto-closed on transition to `DRIVER` |
| `KeyL` (`L`) | `OPEN_EKOLIFE_HUB` | `ON_FOOT`, `DRIVER` | Open EkoLife Hub | Blocked when modal already open |
| `KeyJ` (`J`) | `JOB_SHIFT_ACTION` | `ON_FOOT`, `DRIVER` | Start or advance active JobsHub checkpoint | Validated against active shift state |
| `KeyZ` (`Z`) | `TOGGLE_CITY_ZOOM` | `ON_FOOT`, `DRIVER` | Toggle 3D Bird's-Eye City Overview | Restores role camera on exit |
| `KeyV` (`V`) | `TOGGLE_SELFIE_CAMERA` | `ON_FOOT` | Toggle front-facing avatar inspection camera | On-foot only |
| `KeyX` (`X`) | `TOGGLE_STRAFE_MODE` | `ON_FOOT` | Toggle on-foot strafe movement | On-foot only |
| `KeyM` (`M`) | `TOGGLE_RADIO` | `ALL` | Toggle Radio Eko 99.3 FM | Non-conflicting audio toggle |
| `KeyT` (`T`) | `CYCLE_TIME_OF_DAY` | `ON_FOOT`, `DRIVER` | Cycle Morning / Afternoon / Sunset / Night | World environment control |
| `KeyB` (`B`) | `CYCLE_CITY_EVENT` | `ON_FOOT`, `DRIVER` | Cycle dynamic Lagos city event | World environment control |
| `KeyY` (`Y`) | `TOGGLE_QUICK_CHAT` | `ON_FOOT`, `PASSENGER`, `CONDUCTOR` | Toggle street slang quick chat popover | Non-conflicting social popover |
| `KeyK` (`K`) | `TOGGLE_COLLIDER_DEBUG` | `DEV_DIAGNOSTICS` | Toggle OBB/AABB collision debug wireframes | Diagnostic toggle |
| `Digit1`–`Digit5` | `VEHICLE_SWITCH_OR_CHAT` | `ON_FOOT`, `DRIVER`, `QUICK_CHAT` | Select chat line when Quick Chat open; otherwise summon/switch vehicle | Blocked while seated as `PASSENGER` or `CONDUCTOR` unless exiting first |
| `Escape` | `DISMISS_ACTIVE_MODAL` | `ALL` | Dismiss topmost open modal, dialog, or drawer | Single highest-priority dismissal handler |

---

## 4. Safety Guarantees Implemented
1. **Flex Card Unbound from `F`**:
   - Top-left button updated from `🪪 Flex Card (F)` to `🪪 Flex Card` (with optional `U` shortcut documented in the registry).
   - Pressing `F` **never** calls `openEkoFlexCard()` under any state.
2. **Held-Key & Focus-Loss Hygiene**:
   - `window.addEventListener('blur', ...)` and `document.addEventListener('visibilitychange', ...)` immediately zero out `window.__PROJECT_EKO_KEYBOARD_HELD__` and `keys` so keys never stick across tab switches or modal transitions.
3. **Repeat & Cooldown Protection**:
   - Discrete actions (`E`, `F`, `G`, `O`, `C`, `Space`, `U`) ignore `e.repeat` and enforce a per-action debounce (`180ms`) so rapid or repeated key events cannot trigger duplicate boarding or double fare settlements.
