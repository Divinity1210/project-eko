# PROJECT EKO — SPECIFICATION AUDIT & RISK REGISTER (M0)

> **Document Status**: Active Audit & Architectural Gate  
> **Audited Documents**: All specifications within `ANTIGRAVITY/00` through `10`  
> **Core Mandate**: Identify contradictions, premature complexity, regulatory risks, scalability bottlenecks, and exploit vectors before code freeze.

---

## 1. Product Specification Audit

### 1.1 Premature Breadth vs. Lean Foundation
* **Identified Risk**: The Master PRD and Gameplay Bible outlined 10+ mini-games (cooking, 5v5 soccer, fashion styling, music studio, property inspection) and 9 sprawling districts.
* **Audit Finding**: Implementing 10 mini-games in early phases fragments engineering focus into shallow mini-games rather than nailing the core mobility and economic loop.
* **Correction for M0/M1**:
  * **Hard Scope Cut**: Freeze all non-mobility mini-games. Focus exclusively on:
    1. **Driving Test** (Licensing gatekeeper)
    2. **Delivery Routing** (Logistics navigation under traffic)
    3. **Mechanic Bay** (Vehicle diagnosis and maintenance)
    4. **Danfo Conductor** (Fare math and route callout)
  * All secondary mini-games (Football, Cooking, Fashion, Music) are relegated to Phase M5/M6 content updates.

### 1.2 Progression Pacing & Economy Traps
* **Identified Risk**: Over-promising passive income too early (e.g., players buying fleets at Level 30 without operational sinks).
* **Audit Finding**: If passive fleet income exceeds operational expenses (fuel, driver wages, union dues, maintenance), the game will suffer hyper-inflation within weeks.
* **Correction**: Vehicle operations must enforce mandatory variable maintenance costs, tire replacement intervals, and licensing depreciation sinks.

---

## 2. Technical & Architectural Audit

### 2.1 Realtime Scalability & Client Authority Hazards
* **Identified Risk**: Allowing client-side driving physics to report mission completion without server verification.
* **Audit Finding**: In WebGL browser games, malicious clients can easily modify JavaScript memory, simulate 500 km/h velocities, teleport between checkpoints, or forge completion events.
* **Correction (ADR-0003 & ADR-0007)**:
  * **Semi-Authoritative Driving Model**: The client renders local responsive driving at 60 Hz for input latency feel, but streams compressed input/position packets to the server.
  * The server runs a **20 Hz headless physics verification step** verifying top-speed constraints, acceleration envelopes, collision impulses, and checkpoint passage timestamps before validating any mission reward.

### 2.2 Browser & Mobile Performance Limits
* **Identified Risk**: High draw calls and unbounded polycounts causing crashes on African mobile browsers (Tecno, Infinix, Samsung A-series with 3–4GB RAM).
* **Audit Finding**: WebGL context loss occurs when GPU VRAM exceeds 500MB on mobile Safari/Chrome.
* **Correction (ADR-0010)**:
  * Initial bundle size strictly capped at **< 15MB gzipped**.
  * Texture atlases capped at 1024x1024 with KTX2 / Basis Universal GPU compression.
  * Maximum 35,000 active draw triangles in the camera frustum at any given frame.
  * Draw calls capped at **< 75 draw calls per frame** via static mesh instancing for buildings, road barriers, and street lamps.

---

## 3. Economy & Ledger Audit

### 3.1 Money Creation vs. Sinks (Hyperinflation Risk)
* **Identified Risk**: Uncapped mission spawning minting infinite Game Naira.
* **Audit Finding**: If passenger fares generate new Game Naira out of thin air without proportional sinks, money supply will explode.
* **Correction**:
  * Implement the **Double-Entry Economic Constitution** (ADR-0004).
  * System accounts (`System:MunicipalTreasury`, `System:FuelTaxSink`, `System:LicensingSink`) permanently absorb and burn Game Naira on every transaction.
  * Every mission reward must be balanced against maintenance degradation (tire wear, oil breakdown, fuel burn).

### 3.2 Asset Ownership Race Conditions & Double-Spending
* **Identified Risk**: Network latency causing duplicate hire-purchase deductions or dual-ownership of vehicles during peer-to-peer trades.
* **Correction**: Strict PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) and UUIDv4 idempotency keys on every balance mutation.

---

## 4. Real-Reward Economy Audit (Regulatory Caution)

### 4.1 Legal Classification Overclaims
* **Critical Finding**: Prior documentation casually suggested that classifying rewards as "sponsor skill challenges" automatically exempted the platform from gaming or banking regulation in Nigeria.
* **Audit Ruling**:
  * **REGULATORY ASSUMPTION — REQUIRES PROFESSIONAL VALIDATION**.
  * We must not state or assume that the current design definitely avoids licensing.
  * Promotional competitions with cash prizes in Lagos State fall under the statutory purview of the **Lagos State Lotteries and Gaming Authority (LSLGA)** under the Lagos State Lotteries and Gaming Law 2021.
  * At the federal level, the **National Lottery Regulatory Commission (NLRC)** exercises oversight over promotional competitions and games of skill with monetary prizes.
  * Moving money to players' commercial bank accounts exposes the platform to **Central Bank of Nigeria (CBN)** payment service guidelines.
* **Action Taken**: Real-money cashouts are **STRICTLY FEATURE-FLAGGED OFF** in all early milestones (M0–M3). A comprehensive questionnaire for Nigerian legal counsel has been drafted in `ANTIGRAVITY/07_REAL_REWARDS/REGULATORY_QUESTIONS_FOR_COUNSEL.md`.

---

## 5. Summary Audit Matrix & Gate Decisions

```
┌─────────────────────┬──────────────────────────┬──────────────────────┬─────────────────────────────┐
│ Domain              │ Identified Concern       │ Severity             │ Architectural Resolution    │
├─────────────────────┼──────────────────────────┼──────────────────────┼─────────────────────────────┤
│ Product Scope       │ 10 mini-games & 9 zones  │ HIGH (Scope Creep)   │ Cut to 1 zone + 4 minigames │
├─────────────────────┼──────────────────────────┼──────────────────────┼─────────────────────────────┤
│ Vehicle Physics     │ Client speed spoofing    │ CRITICAL (Exploit)   │ Server telemetry checkpoints│
├─────────────────────┼──────────────────────────┼──────────────────────┼─────────────────────────────┤
│ Browser Performance │ VRAM blowout on mobile   │ HIGH (Crash Risk)    │ KTX2 + strict LOD budgets   │
├─────────────────────┼──────────────────────────┼──────────────────────┼─────────────────────────────┤
│ Economy Ledger      │ Infinite money minting   │ HIGH (Inflation)     │ Double-entry balanced sinks │
├─────────────────────┼──────────────────────────┼──────────────────────┼─────────────────────────────┤
│ Real Cash Rewards   │ Regulatory overclaims    │ CRITICAL (Legal)     │ Feature-flag off + counsel  │
├─────────────────────┼──────────────────────────┼──────────────────────┼─────────────────────────────┤
│ IP & Likenesses     │ Unlicensed auto brands   │ HIGH (Trademark)     │ Original fictional designs  │
└─────────────────────┴──────────────────────────┴──────────────────────┴─────────────────────────────┘
```
