# ADR-0004: Double-Entry Economy Ledger Architecture

## Status
Approved

## Context
Standard game architectures often represent player money as a single mutable integer column in a user table (e.g., `UPDATE users SET balance = balance + 500`). This pattern is catastrophic for complex economies: it leaves zero audit trail, makes race-condition exploits trivial, hides currency leaks, and prevents forensic reconstruction of fraud.

## Decision
All financial transactions in Project Eko are governed by an **Immutable Double-Entry Accounting Ledger**:
1. Every economic event generates a multi-legged journal entry where $\sum \text{Debits} \equiv \sum \text{Credits}$.
2. Account types are strictly classified as: `Asset`, `Liability`, `Equity`, `Revenue`, `Expense`, or `Sink`.
3. Player balances are materialized projections derived from ledger entries, cached with row-version locks.
4. Client requests require unique idempotency keys (UUIDv4) to guarantee that dropped or retried network packets never duplicate transactions.
5. Corrections or refunds are never performed by editing existing records; they require compensating journal entries with documented reason codes.

## Alternatives Considered
* *Single-Column Balance Table*: Rejected due to inability to audit currency creation and susceptibility to concurrency race conditions.
* *Blockchain / Smart Contract Token*: Rejected due to high transaction gas fees, regulatory scrutiny, and unnecessary complexity for an in-game closed simulation currency.

## Consequences
* **Positive**: Absolute mathematical auditability, 100% detection of currency generation anomalies, zero silent balance drift.
* **Negative**: Requires additional storage for journal entries and index maintenance; queries for historical balance reconstruction require indexed aggregation.

## Rollback / Reversal Strategy
The double-entry journal is an immutable core invariant of `packages/economy`. If performance degrades, materialized balance snapshots can be refreshed periodically while keeping the journal log intact.
