# ADR-0009: Anti-Cheat & Cryptographic Reward Evidence Architecture

## Status
Approved

## Context
When real monetary rewards (even sponsor-funded skill challenges) are offered on an open web platform, attackers will deploy automated bots, memory injection tools, headless browser farms, and network replay scripts to farm cash payouts.

## Decision
We implement a **Multi-Layered Anti-Cheat & Cryptographic Evidence Engine**:
1. **Session Nonce & Challenge**: Starting a reward-bearing mission requests a unique cryptographically signed session token from `services/rewards`.
2. **Continuous Telemetry Vector Streaming**: Client sends periodic micro-telemetry checkpoints (steering angle variance, throttle ramp-up curves, velocity, checkpoint timestamps).
3. **Statistical Bot & Macro Heuristics**:
   * *Input Micro-Jitter*: Human driving exhibits natural motor tremors and reaction jitter; perfectly flat steering inputs or binary on/off pulses trigger bot flags.
   * *Impossible Velocity / Acceleration*: Any frame delta where $a > a_{\text{max\_theoretical}}$ triggers immediate disqualification.
   * *Collision Reality Check*: A run reporting 120 km/h average speed through crowded Oshodi market streets without a single collision event is flagged for deterministic replay audit.
4. **Signed Evidence Package**: The server hashes all validated telemetry into an immutable `RewardEvidence` record stored in PostgreSQL before creating an Accounts Payable entry.

## Alternatives Considered
* *Kernel-Level Anti-Cheat (e.g. Vanguard/EasyAntiCheat)*: Impossible in a standard web browser sandbox.
* *Simple Captchas*: Ineffective against reverse-engineered WebSocket API bots and ruins game immersion.

## Consequences
* **Positive**: Robust defence-in-depth against automated cash-farming syndicates.
* **Negative**: Telemetry streaming adds minor network payload overhead (~4 KB/min per active mission).

## Rollback / Reversal Strategy
Heuristic thresholds are managed dynamically in `services/rewards/config/rules.json`. If false-positive rates exceed 0.5%, strictness can be dialed down while keeping evidence logging active.
