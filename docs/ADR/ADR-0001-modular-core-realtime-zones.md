# ADR-0001: Modular Core with Dedicated Realtime Zone Workers

## Status
Approved

## Context
Project Eko requires both complex enterprise business logic (career progression, asset ownership, double-entry banking, compliance, campaign management) and low-latency multiplayer spatial synchronization (vehicle positions, traffic flow, avatar movement). Building a massive distributed microservices architecture on day one would introduce devastating operational overhead and latency for a lean engineering team, while a pure single-process monolith cannot scale realtime physics snapshots.

## Decision
We adopt a **Modular Monolith for Domain & API Services** paired with **Dedicated, Ephemeral Realtime Zone Workers**:
1. The **Domain API** (`services/api`) manages REST/GraphQL domain workflows (Player, Career, Economy Ledger, Fleet, Admin) backed by PostgreSQL.
2. The **Realtime Workers** (`services/realtime`) run isolated spatial zone processes (e.g. Marina/CMS zone worker) communicating over WebSockets/WebTransport, maintaining in-memory spatial indexes and syncing cross-zone state via Redis Pub/Sub.

## Alternatives Considered
* *Full Microservices (20+ separate services)*: Rejected due to operational complexity, distributed transaction race conditions, and excessive networking latency.
* *Pure Single-Thread Monolith (HTTP only)*: Rejected because real-time vehicle physics and proximity multiplayer cannot function on request/response polling.

## Consequences
* **Positive**: Rapid local development, single database transaction boundary for financial integrity, zone workers can be scaled horizontally per district based on player density.
* **Negative**: Realtime workers must synchronize state changes back to PostgreSQL asynchronously; requires clean package boundaries.

## Rollback / Reversal Strategy
If zone worker memory usage becomes unsustainable, individual zone workers can be containerized into standalone auto-scaled microservices behind an edge gateway without rewriting the underlying `packages/world` or `packages/physics` core logic.
