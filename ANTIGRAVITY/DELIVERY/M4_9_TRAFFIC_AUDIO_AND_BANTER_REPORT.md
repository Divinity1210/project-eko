# PROJECT EKO — M4.9 TRAFFIC AUDIO, CONTEXTUAL HORNS & LAGOS ROAD BANTER REPORT

**Milestone:** M4.9 — Living Lagos Traffic, Danfo Operations & Road Incidents  
**Phase:** Phase 5 — Horns, Driver Banter & Lagos Audio Culture  
**Status:** Implemented & Verified

---

## 1. Contextual Horn System & Anti-Cacophony Cooldown Rules

Every vehicle class in Project Eko features a distinct procedural WebAudio horn voice with spatial distance attenuation (`maxRange = 85m`) and strict per-vehicle and global concurrency limits:

| Vehicle Class | Horn Fundamental Frequencies | Timbre & Envelope | Cooldown (Per Vehicle) |
| :--- | :--- | :--- | :--- |
| **`DANFO`** (Yellow Commercial Minibus) | `380 Hz + 475 Hz` (Two-tone brass air-horn) | Sawtooth + triangle double-tap (`120ms` + `180ms`) | `3.5s` (`IMPATIENT`: `2.2s`, `CALM`: `6.0s`) |
| **`BRT`** (Blue LAMATA Transit Coach) | `195 Hz + 245 Hz` (Deep pneumatic transit horn) | Low-pass filtered sawtooth chord (`320ms`) | `5.0s` |
| **`KEKE` / `OKADA`** | `540 Hz + 680 Hz` (High piezo buzzer horn) | Crisp square-wave staccato (`90ms`) | `3.0s` |
| **`PRIVATE_CAR` / `TAXI`** | `410 Hz + 512 Hz` (Standard dual-tone automotive horn) | Balanced triangle-sawtooth blend (`180ms`) | `4.0s` |

### Valid Contextual Horn Triggers
Horns are **never** fired randomly without cause. A horn is triggered only by one of the following verified traffic events:
1. **`VEHICLE_CUT_IN`**: Another vehicle merges within `9m` ahead with a speed differential `> 12 km/h`.
2. **`BLOCKED_LANE_OR_STOP_BAY`**: A vehicle is stationary obstructing an active lane or bus stop bay for `> 2.5s`.
3. **`PEDESTRIAN_HAZARD_WARNING`**: A pedestrian steps within `8.5m` of an approaching vehicle's forward corridor.
4. **`DANFO_STOP_ARRIVAL_AND_DEPARTURE`**: Conductor/driver signals arrival at a bus bay or signals departure (`CHECKING_DEPARTURE -> MERGING_BACK_INTO_TRAFFIC`) to alert waiting commuters and adjacent traffic.
5. **`NEAR_MISS_OR_COLLISION`**: Immediate warning blast upon emergency braking or collision impact.
6. **`PLAYER_MANUAL_HORN`**: Human driver presses `H` (or mobile Horn button) while in `DRIVER` state.

---

## 2. Structured Lagos Road Banter Catalogue (9 Contextual Categories)

All NPC driver, conductor, and commuter voice/caption lines are culturally authentic Nigerian English / Lagos Pidgin without profanity, hate speech, or slurs. Each category enforces a minimum `4.5s` category cooldown:

| Category ID | Trigger Context | Approved Lagos Banter Lines |
| :--- | :--- | :--- |
| **`ROAD_OBSTRUCTION`** | Lane or stop bay blocked by stationary or disabled vehicle | • *"Oga move your motor small, road no be parking space!"*<br>• *"Shift front abeg, people dey hurry go Island!"*<br>• *"Wetin happen for front? Clear well make Danfo pass!"* |
| **`AGGRESSIVE_MERGE`** | Vehicle cuts into lane with tight gap or merges from stop bay | • *"Easy o! Check your side mirror before you enter lane!"*<br>• *"Driver calm down, we all dey use this Broad Street!"*<br>• *"No use your bumper test my paint o, enter gently!"* |
| **`MISSED_JUNCTION`** | Driver overshoots stop bay or diverts around blocked node | • *"Ah! Driver you don pass the turning—take next loop!"*<br>• *"No vex passengers, junction lock up ahead, we dey divert!"* |
| **`NEAR_COLLISION`** | Emergency brake or `< 3.5m` high-speed closing event | • *"Ewo! Hold brake well o, that one close!"*<br>• *"Shine your eye driver, small thing remain!"*<br>• *"Thank God for good brake o, everybody steady!"* |
| **`BUS_STOP_DEPARTURE`** | Danfo closes sliding door and merges out of bus stop bay | • *"Door closed! Driver Chidi, clear for mirror—enter main road!"*<br>• *"Oya we dey move! Next stop Broad Street, hold your change!"*<br>• *"One-chance no dey here o, CMS express moving now!"* |
| **`PASSENGER_BOARDING`** | Danfo opens sliding door in `BUS_STOP_BAY` for boarding | • *"Oya enter with your change! CMS, Broad Street, TBS straight!"*<br>• *"Two seats for front, ten for back—move inside make person sitdown!"* |
| **`FARE_DISPUTE`** | Incorrect change arithmetic or insufficient fare attempt | • *"Madam abeg check the change well, na ₦200 remain for your ₦500!"*<br>• *"Conductor, my ₦150 change dey your hand o—no forget!"* |
| **`TRAFFIC_QUEUE`** | Multi-vehicle queue in congestion or rain slowdown | • *"Go-slow dey front o, everybody hold patience small!"*<br>• *"Rain dey fall for Marina, make we follow line gently!"* |
| **`DRIVER_WARNING`** | Pedestrian crossing emergency brake or vehicle damage alert | • *"Watch pedestrian for zebra crossing! Hold brake!"*<br>• *"Engine and steering dey feel heavy o—visit Segun Workshop soon!"* |

---

## 3. Audio Mixer Controls & Accessible Live Captions (`aria-live="polite"`)

1. **Multi-Channel Audio Mixer**:
   - Exposes independent gain controls in `window.__PROJECT_EKO_TRAFFIC__.audioConfig` and the Traffic & Audio HUD modal:
     - `masterVolume` (`0.0 – 1.0`, default `0.85`)
     - `vehicleVolume` (`0.0 – 1.0`, default `0.80`)
     - `hornVolume` (`0.0 – 1.0`, default `0.75`)
     - `npcVoiceVolume` (`0.0 – 1.0`, default `0.85`)
     - `ambientVolume` (`0.0 – 1.0`, default `0.65`)
     - `muted` (`boolean`, default `false`)
     - `reducedAudioMode` (`boolean`, default `false` — halves horn density and extends cooldowns by `2.5x`)
2. **Accessible Centralized Caption Banner**:
   - Implemented as a single persistent DOM container (`#m49-traffic-caption-banner`) with `role="status"` and `aria-live="polite"` `aria-atomic="true"`, displaying speaker badge, banter category tag, and caption text whenever a horn/banter cue occurs within `45m` of the player.
