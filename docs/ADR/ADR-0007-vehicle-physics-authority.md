# ADR-0007: Vehicle Physics Simulation & Authority Model

## Status
Approved

## Context
Driving in Project Eko must feel weighted, responsive, and grounded in real vehicular dynamics (Pacejka tyre grip, suspension weight transfer, body roll, road bump reactions). However, simulating a 60 Hz rigid-body multi-wheel vehicle engine on a remote server with 150ms network round-trip time leads to intolerable input lag for client steering.

## Decision
We implement a **Dual-Tier Semi-Authoritative Physics Model**:
1. **Client-Side Simulation (60 Hz)**:
   * The browser client executes the physics model locally in real time: raycast suspension, Pacejka lateral/longitudinal tyre friction, engine torque curves, steering angle, and chassis roll.
   * Gives instant, tactile, satisfying steering and braking response with zero perceived input lag.
2. **Server-Side Validation (20 Hz)**:
   * The client streams compressed input vectors (`steer`, `throttle`, `brake`, `gear`) and position/velocity snapshots.
   * For non-reward casual driving, the server performs coarse position bounding box checks.
   * For **reward-bearing missions, commercial driving tests, and tournaments**, the server validates the trajectory against kinematic limits (maximum acceleration, turning radius envelope, top speed) and deterministic checkpoint timestamps before approving rewards.

## Alternatives Considered
* *Full Client Authority*: Rejected due to trivial speed and teleport cheating.
* *Pure Server-Authoritative Input Streaming (Cloud Gaming)*: Rejected due to bandwidth costs and poor responsiveness over mobile networks.

## Consequences
* **Positive**: Silky smooth local driving feel combined with high anti-cheat security on financial and progression rewards.
* **Negative**: Code duplication between client physics runner and server verification logic (mitigated by sharing `packages/physics` across both client and server via TypeScript monorepo).

## Rollback / Reversal Strategy
Shared physics equations in `packages/physics` allow headless execution on both Node.js and browser environments, ensuring identical math across both layers.
