# ADR-0003: Server-Authoritative Gameplay & Telemetry Verification

## Status
Approved

## Context
Browser-based WebGL environments run in untrusted client runtimes (user browsers). Players can alter JavaScript memory, spoof WebSocket payloads, inject synthetic coordinates, and forge completion events for high-value missions or sponsored skill challenges.

## Decision
We adopt a **Server-Authoritative Gameplay and Verification Model**:
1. The client is treated strictly as an untrusted rendering and input capture engine.
2. For casual movement in the open world, client-side prediction and server reconciliation are used for responsive driving.
3. For all **reward-bearing missions, commercial certifications, and economy-affecting tasks**, the server validates:
   * Timestamps and passage through server-verified checkpoints.
   * Acceleration envelopes and maximum theoretical vehicle velocities.
   * Total collision impulse sums.
   * Telemetry evidence package cryptographic signing.

## Alternatives Considered
* *Client-Authoritative Reporting*: Rejected due to trivial cheatability and exploitability.
* *Full Lockstep Server Physics*: Rejected because network latency across African 4G networks (80–180ms) would make real-time vehicle driving feel unplayable and sluggish.

## Consequences
* **Positive**: High resistance to automated cheating, impossible-speed spoofing, and reward farming bots.
* **Negative**: Requires server CPU cycles to validate input trajectories and verify checkpoint sequences.

## Rollback / Reversal Strategy
If server load spikes during peak traffic, verification can be processed asynchronously in background worker queues (`services/rewards`) rather than synchronously blocking zone ticks.
