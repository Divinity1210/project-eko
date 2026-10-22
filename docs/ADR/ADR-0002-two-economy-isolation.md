# ADR-0002: Two-Economy Hard Isolation Architecture

## Status
Approved

## Context
A major hazard in digital world projects is the blurring of simulation currency with real fiat currency. If in-game virtual money (Game Naira) can be purchased, sold, staked against other players, or converted directly into real bank withdrawals, the platform instantly becomes classified as an unlicensed casino/gambling platform under Nigerian gaming laws (LSLGA / NLRC) or an illegal deposit-taking banking institution under Central Bank of Nigeria (CBN) regulations.

## Decision
We enforce an absolute, non-negotiable **Hard Architectural Boundary** between two completely isolated systems:
1. **Virtual Simulation Economy (Game Naira)**:
   * Powers all in-game jobs, bus fares, vehicle buying, rent, and repairs.
   * **Zero real-world monetary value. Non-convertible. Non-withdrawable.**
2. **Real-Reward System (Fiat NGN)**:
   * Funded exclusively by external corporate sponsors and verified commercial campaigns.
   * Disbursed as Accounts Payable (AP) directly through licensed Payment Service Providers (PSPs) to external bank accounts.
   * **Game Naira balances can NEVER be exchanged for real rewards.**

## Alternatives Considered
* *Single Convertible Currency*: Rejected as an existential legal and regulatory catastrophe.
* *Player-to-Player Cash Staking*: Rejected because risking capital on competition outcomes triggers strict betting/gambling licenses.

## Consequences
* **Positive**: Absolute immunity against illegal banking and gambling charges; zero liability for in-game currency hyper-inflation bleeding into real-world cash loss.
* **Negative**: Players must understand that grinding ₦100,000,000 Game Naira in-game does not entitle them to cash out ₦100,000,000 real Naira.

## Rollback / Reversal Strategy
This architecture is permanent and foundational. Under no circumstances may this boundary be bridged.
