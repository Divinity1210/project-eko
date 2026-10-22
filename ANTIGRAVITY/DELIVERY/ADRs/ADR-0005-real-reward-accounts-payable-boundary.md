# ADR-0005: Real-Reward Accounts Payable (AP) Boundary & State Machine

## Status
Approved

## Context
If real cash payouts to players are designed as instantaneous in-game "wallet withdrawals," the platform acts as an unlicenced stored-value facility and becomes vulnerable to fast automated drain attacks by coordinated fraud rings.

## Decision
We structure the real-reward cashout mechanism as a corporate **Accounts Payable (AP) State Machine**:
1. Earning a real reward does NOT deposit funds into an in-game digital wallet. It creates an external **Reward Payable** record.
2. The payable record progresses through an immutable 7-state lifecycle:
   $$\text{PENDING} \longrightarrow \text{VERIFIED} \longrightarrow \text{APPROVED} \longrightarrow \text{PAYMENT\_PROCESSING} \longrightarrow \text{PAID}$$
   (with terminal exception states: `ON_HOLD`, `REVERSED`, `FAILED`).
3. Actual monetary execution occurs outside the game server via licensed Nigerian Payment Service Provider (PSP) APIs (Paystack, Flutterwave) directly to the player's verified commercial bank account.
4. Payouts require strict adult verification (18+), velocity caps (1 payout per 24 hours), and step-up AML manual review triggers for accounts exceeding ₦50,000 monthly cumulative volume.

## Alternatives Considered
* *In-Game Fiat Stored-Value Wallet*: Rejected because issuing stored-value instruments requires banking/MMO licensing from the Central Bank of Nigeria.
* *Crypto / Web3 Token Airdrops*: Rejected due to Nigerian banking directives on crypto-asset service providers and poor user accessibility for mainstream Nigerian youth.

## Consequences
* **Positive**: Full compliance with CBN guidelines; manual compliance review window stops drain attacks before money leaves the bank; zero player fiat deposit custody.
* **Negative**: Payouts are not instantaneous (typically settling within 1–24 hours depending on batch review).

## Rollback / Reversal Strategy
Feature-flagging allows instant global shutoff of all AP payouts via an administrative kill switch without impacting the virtual simulation gameplay.
