import { GameLedgerTransaction, LedgerEntryLine } from '@project-eko/contracts';

/**
 * DOUBLE-ENTRY ECONOMY LEDGER
 * Enforces: Sum(Debits) === Sum(Credits) on every journal entry.
 * Balances are materialized projections, not arbitrary mutable variables.
 */
export class EconomyLedger {
  private transactions: GameLedgerTransaction[] = [];
  private processedIdempotencyKeys = new Set<string>();
  private persistenceHook: ((transactions: GameLedgerTransaction[]) => void) | null = null;

  /**
   * Attach the storage boundary used by the hosting service. Persistence runs
   * synchronously after validation and before a transaction is acknowledged.
   */
  public setPersistenceHook(hook: ((transactions: GameLedgerTransaction[]) => void) | null): void {
    this.persistenceHook = hook;
  }

  /** Return a detached journal snapshot suitable for durable storage. */
  public exportTransactions(): GameLedgerTransaction[] {
    return JSON.parse(JSON.stringify(this.transactions));
  }

  /**
   * Restore a journal snapshot before serving requests. Reject malformed,
   * unbalanced, or duplicate records rather than starting with partial money
   * history.
   */
  public restoreTransactions(snapshot: GameLedgerTransaction[]): void {
    if (!Array.isArray(snapshot)) {
      throw new Error('Ledger snapshot must be an array.');
    }

    const restored: GameLedgerTransaction[] = [];
    const idempotencyKeys = new Set<string>();
    const transactionIds = new Set<string>();

    for (const tx of snapshot) {
      if (!tx || typeof tx !== 'object' || !tx.transactionId || !tx.eventId || !tx.idempotencyKey ||
          !tx.actorId || !Array.isArray(tx.lines) || tx.lines.length < 2 ||
          !Number.isFinite(tx.timestamp) || typeof tx.reason !== 'string') {
        throw new Error('Ledger snapshot contains a malformed transaction.');
      }
      if (idempotencyKeys.has(tx.idempotencyKey) || transactionIds.has(tx.transactionId)) {
        throw new Error(`Ledger snapshot contains a duplicate transaction or idempotency key: ${tx.transactionId}`);
      }

      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of tx.lines) {
        if (!line || typeof line.accountCode !== 'string' || !line.accountCode ||
            !Number.isFinite(line.debit) || !Number.isFinite(line.credit) ||
            line.debit < 0 || line.credit < 0) {
          throw new Error(`Ledger snapshot contains an invalid entry line in ${tx.transactionId}.`);
        }
        totalDebit += line.debit;
        totalCredit += line.credit;
      }
      if (Math.abs(totalDebit - totalCredit) > 0.0001) {
        throw new Error(`Ledger snapshot contains an unbalanced transaction: ${tx.transactionId}.`);
      }

      restored.push(JSON.parse(JSON.stringify(tx)));
      idempotencyKeys.add(tx.idempotencyKey);
      transactionIds.add(tx.transactionId);
    }

    this.transactions = restored;
    this.processedIdempotencyKeys = idempotencyKeys;
  }

  /**
   * Post a balanced journal transaction to the ledger.
   * Throws an error if debits and credits do not balance or if idempotency key was already processed.
   */
  public postTransaction(
    transactionId: string,
    eventId: string,
    idempotencyKey: string,
    actorId: string,
    reason: string,
    lines: LedgerEntryLine[],
    metadata: Record<string, unknown> = {}
  ): GameLedgerTransaction {
    // 1. Idempotency Check
    if (this.processedIdempotencyKeys.has(idempotencyKey)) {
      const existing = this.transactions.find((t) => t.idempotencyKey === idempotencyKey);
      if (existing) return existing;
      throw new Error(`Idempotency conflict: key '${idempotencyKey}' already processed.`);
    }

    // 2. Validate Lines Exist
    if (!lines || lines.length < 2) {
      throw new Error(`Transaction must contain at least 2 entry lines (double-entry requirement).`);
    }

    // 3. Mathematical Balance Invariant: Total Debits == Total Credits
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error(`Ledger entry lines cannot have negative values (debit: ${line.debit}, credit: ${line.credit})`);
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    // Floating-point precision guard
    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.0001) {
      throw new Error(
        `Ledger balance invariant violated: Total Debits (${totalDebit}) != Total Credits (${totalCredit}). Difference: ${diff}`
      );
    }

    const tx: GameLedgerTransaction = {
      transactionId,
      eventId,
      idempotencyKey,
      actorId,
      timestamp: Date.now(),
      reason,
      metadata,
      lines: JSON.parse(JSON.stringify(lines)),
    };

    this.transactions.push(tx);
    this.processedIdempotencyKeys.add(idempotencyKey);
    try {
      this.persistenceHook?.(this.exportTransactions());
    } catch (error) {
      this.transactions.pop();
      this.processedIdempotencyKeys.delete(idempotencyKey);
      throw error;
    }
    return tx;
  }

  /**
   * Project the current balance of any specific account.
   * Asset/Expense: Normal Debit Balance (Debits - Credits)
   * Liability/Equity/Revenue/Sink: Normal Credit Balance (Credits - Debits)
   */
  public getAccountBalance(accountCode: string): number {
    let balance = 0;
    const isNormalDebit = accountCode.startsWith('Asset') || accountCode.startsWith('Expense');

    for (const tx of this.transactions) {
      for (const line of tx.lines) {
        if (line.accountCode === accountCode) {
          if (isNormalDebit) {
            balance += line.debit - line.credit;
          } else {
            balance += line.credit - line.debit;
          }
        }
      }
    }

    return balance;
  }

  /**
   * Run a global ledger integrity audit across all accounts.
   * Sum of all debits must equal sum of all credits across the entire historical journal.
   */
  public auditIntegrity(): {
    totalTransactions: number;
    cumulativeDebits: number;
    cumulativeCredits: number;
    isBalanced: boolean;
    unresolvedDiscrepanciesCount: number;
  } {
    let cumulativeDebits = 0;
    let cumulativeCredits = 0;

    for (const tx of this.transactions) {
      for (const line of tx.lines) {
        cumulativeDebits += line.debit;
        cumulativeCredits += line.credit;
      }
    }

    const diff = Math.abs(cumulativeDebits - cumulativeCredits);
    const isBalanced = diff < 0.0001;

    return {
      totalTransactions: this.transactions.length,
      cumulativeDebits,
      cumulativeCredits,
      isBalanced,
      unresolvedDiscrepanciesCount: isBalanced ? 0 : 1,
    };
  }

  /**
   * Helper: Reward player for completed passenger ride
   */
  public recordMissionReward(
    playerId: string,
    missionId: string,
    rewardAmount: number,
    fuelCost: number = 0,
    maintenanceTax: number = 0,
    idempotencyKey: string = `idemp_mission_${missionId}_${playerId}`
  ): GameLedgerTransaction {
    const netCash = rewardAmount - fuelCost - maintenanceTax;
    const lines: LedgerEntryLine[] = [
      { accountCode: `Asset:Player:${playerId}:Cash`, debit: netCash, credit: 0 },
      { accountCode: 'Revenue:System:PassengerFares', debit: 0, credit: rewardAmount },
    ];

    if (fuelCost > 0) {
      lines.push({ accountCode: 'Sink:System:FuelTaxBurn', debit: fuelCost, credit: 0 });
    }
    if (maintenanceTax > 0) {
      lines.push({ accountCode: 'Sink:System:LicensingAndWear', debit: maintenanceTax, credit: 0 });
    }

    return this.postTransaction(
      `tx_reward_${missionId}_${Date.now()}`,
      `ev_mission_complete_${missionId}`,
      idempotencyKey,
      playerId,
      `Completed passenger trip mission ${missionId}`,
      lines,
      { missionId, rewardAmount, fuelCost, maintenanceTax }
    );
  }
}

// Global in-memory singleton for prototype
export const globalEconomyLedger = new EconomyLedger();
