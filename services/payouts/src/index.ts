import { RewardPayable, PayoutStatus } from '@project-eko/contracts';
import * as crypto from 'crypto';

export interface BankAccountDetails {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  isBvnVerified: boolean;
  isAdultVerified: boolean; // Must be >= 18
}

export interface PayoutResult {
  payoutId: string;
  payableId: string;
  status: PayoutStatus;
  providerReference?: string;
  settledAt?: number;
  failureReason?: string;
  killSwitchBlocked?: boolean;
}

export interface PayoutExecutionOptions {
  /**
   * Only honored when NODE_ENV !== 'production' and an isolated unit test explicitly
   * requests sandbox state-machine verification. Default is false (fail-closed).
   */
  allowIsolatedSandboxTestSettlement?: boolean;
}

export interface PayoutAuditEntry {
  auditId: string;
  payableId: string;
  idempotencyKey: string;
  fromStatus: PayoutStatus;
  toStatus: PayoutStatus;
  reason: string;
  timestamp: number;
}

/**
 * ACCOUNTS PAYABLE (AP) PAYOUT ORCHESTRATOR
 * Enforces fail-closed regulatory kill-switch controls and idempotent state transitions.
 * Live fiat bank transfers remain strictly disabled until legal sign-off, KYC integration,
 * and licensed PSP webhook verification are enabled.
 */
export class PayoutOrchestrator {
  private processedPayouts = new Map<string, PayoutResult>();
  private inFlightPayables = new Map<string, RewardPayable>();
  private auditTrail: PayoutAuditEntry[] = [];
  private livePayoutKillSwitchEnabled = false;

  constructor(enableLivePayouts: boolean = false) {
    // Even if true is requested, production requires an explicit PSP webhook secret and regulatory override
    const regulatoryGateUnlocked =
      process.env.PROJECT_EKO_ENABLE_LIVE_FIAT_PAYOUTS === 'true' &&
      Boolean(process.env.PROJECT_EKO_PSP_WEBHOOK_SECRET && process.env.PROJECT_EKO_PSP_WEBHOOK_SECRET.length >= 32);
    this.livePayoutKillSwitchEnabled = Boolean(enableLivePayouts && regulatoryGateUnlocked);
  }

  public getKillSwitchStatus(): {
    realCashPayoutsEnabled: boolean;
    lockReason: string;
    providerWebhookConfigured: boolean;
  } {
    return {
      realCashPayoutsEnabled: this.livePayoutKillSwitchEnabled,
      lockReason: this.livePayoutKillSwitchEnabled
        ? 'UNLOCKED_WITH_VERIFIED_PSP_CONFIG'
        : 'LOCKED_BY_REGULATORY_AND_EXECUTIVE_GATE',
      providerWebhookConfigured: Boolean(
        process.env.PROJECT_EKO_PSP_WEBHOOK_SECRET && process.env.PROJECT_EKO_PSP_WEBHOOK_SECRET.length >= 32
      ),
    };
  }

  private recordAudit(
    payableId: string,
    idempotencyKey: string,
    fromStatus: PayoutStatus,
    toStatus: PayoutStatus,
    reason: string
  ): void {
    this.auditTrail.push({
      auditId: `aud_${crypto.randomUUID()}`,
      payableId,
      idempotencyKey,
      fromStatus,
      toStatus,
      reason,
      timestamp: Date.now(),
    });
  }

  public getAuditTrail(): PayoutAuditEntry[] {
    return [...this.auditTrail];
  }

  /**
   * Dispatches an approved payable through the Accounts Payable state machine.
   * Fails closed (never fabricates a PAID bank settlement) unless either:
   * - A verified PSP webhook callback settles an in-flight PAYMENT_PROCESSING record, OR
   * - An isolated non-production test explicitly sets allowIsolatedSandboxTestSettlement: true.
   */
  public executePayout(
    payable: RewardPayable,
    bankDetails: BankAccountDetails,
    idempotencyKey: string,
    options?: PayoutExecutionOptions
  ): PayoutResult {
    const normalizedKey = String(idempotencyKey || '').trim();
    if (!normalizedKey) {
      throw new Error('PAYOUT_IDEMPOTENCY_KEY_REQUIRED');
    }

    // 1. Strict Idempotency Check
    if (this.processedPayouts.has(normalizedKey)) {
      const existing = this.processedPayouts.get(normalizedKey)!;
      if (existing.payableId !== payable.payableId) {
        throw new Error(`PAYOUT_IDEMPOTENCY_CONFLICT: Key '${normalizedKey}' already bound to payable '${existing.payableId}'.`);
      }
      return existing;
    }

    const initialStatus = payable.status;

    // 2. State Guard: Must be APPROVED
    if (payable.status !== 'APPROVED') {
      const failedResult: PayoutResult = {
        payoutId: `payout_err_${Date.now()}`,
        payableId: payable.payableId,
        status: 'FAILED',
        failureReason: `Cannot disburse payable in status '${payable.status}'. Must be 'APPROVED'.`,
      };
      this.recordAudit(payable.payableId, normalizedKey, initialStatus, 'FAILED', failedResult.failureReason!);
      return failedResult;
    }

    // 3. KYC Guard: Strict Adult (18+) and BVN Verification
    if (!bankDetails || !bankDetails.isAdultVerified || !bankDetails.isBvnVerified) {
      payable.status = 'ON_HOLD';
      payable.updatedAt = Date.now();
      payable.rejectionReason = 'Adult identity (18+) and bank verification required for cash-out.';
      const onHoldResult: PayoutResult = {
        payoutId: `payout_hold_${Date.now()}`,
        payableId: payable.payableId,
        status: 'ON_HOLD',
        failureReason: payable.rejectionReason,
      };
      this.recordAudit(payable.payableId, normalizedKey, initialStatus, 'ON_HOLD', payable.rejectionReason);
      this.processedPayouts.set(normalizedKey, onHoldResult);
      return onHoldResult;
    }

    const allowSandboxSim =
      options?.allowIsolatedSandboxTestSettlement === true && process.env.NODE_ENV !== 'production';

    // 4. Regulatory Kill-Switch Guard (Fail-Closed in Production & Default Runtime)
    if (!this.livePayoutKillSwitchEnabled && !allowSandboxSim) {
      payable.status = 'ON_HOLD';
      payable.updatedAt = Date.now();
      payable.rejectionReason =
        'LIVE_PAYOUTS_DISABLED_BY_KILL_SWITCH: Real-money fiat payouts are locked pending legal counsel sign-off and licensed PSP integration.';
      const blockedResult: PayoutResult = {
        payoutId: `payout_locked_${Date.now()}`,
        payableId: payable.payableId,
        status: 'ON_HOLD',
        failureReason: payable.rejectionReason,
        killSwitchBlocked: true,
      };
      this.recordAudit(payable.payableId, normalizedKey, initialStatus, 'ON_HOLD', payable.rejectionReason);
      this.processedPayouts.set(normalizedKey, blockedResult);
      return blockedResult;
    }

    // 5. Transition APPROVED -> PAYMENT_PROCESSING
    payable.status = 'PAYMENT_PROCESSING';
    payable.updatedAt = Date.now();
    this.inFlightPayables.set(payable.payableId, payable);
    this.recordAudit(
      payable.payableId,
      normalizedKey,
      initialStatus,
      'PAYMENT_PROCESSING',
      allowSandboxSim ? 'Sandbox simulation transfer initiated' : 'Awaiting licensed PSP webhook confirmation'
    );

    if (allowSandboxSim) {
      const providerReference = `sbx_sim_trx_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      payable.status = 'PAID';
      payable.updatedAt = Date.now();
      payable.externalProviderReference = providerReference;
      const simResult: PayoutResult = {
        payoutId: `payout_sbx_${Date.now()}`,
        payableId: payable.payableId,
        status: 'PAID',
        providerReference,
        settledAt: payable.updatedAt,
      };
      this.recordAudit(payable.payableId, normalizedKey, 'PAYMENT_PROCESSING', 'PAID', 'Isolated sandbox test settlement');
      this.processedPayouts.set(normalizedKey, simResult);
      return simResult;
    }

    const pendingWebhookResult: PayoutResult = {
      payoutId: `payout_proc_${Date.now()}`,
      payableId: payable.payableId,
      status: 'PAYMENT_PROCESSING',
    };
    this.processedPayouts.set(normalizedKey, pendingWebhookResult);
    return pendingWebhookResult;
  }

  /**
   * Verifies a signed PSP webhook payload (HMAC-SHA256) and transitions an in-flight
   * PAYMENT_PROCESSING payable to PAID or FAILED.
   */
  public handleVerifiedProviderWebhook(
    rawPayload: string,
    signatureHeader: string,
    webhookSecret?: string
  ): PayoutResult {
    const secret = (webhookSecret || process.env.PROJECT_EKO_PSP_WEBHOOK_SECRET || '').trim();
    if (secret.length < 32) {
      throw new Error('PSP_WEBHOOK_SECRET_NOT_CONFIGURED');
    }
    const expectedSig = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
    const actualBuf = Buffer.from(String(signatureHeader || ''), 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
      throw new Error('INVALID_PSP_WEBHOOK_SIGNATURE');
    }

    const event = JSON.parse(rawPayload);
    const payableId = String(event.payableId || '');
    const payable = this.inFlightPayables.get(payableId);
    if (!payable || payable.status !== 'PAYMENT_PROCESSING') {
      throw new Error(`PAYABLE_NOT_IN_PAYMENT_PROCESSING: ${payableId}`);
    }

    if (event.event === 'transfer.success' && typeof event.providerReference === 'string' && event.providerReference.trim()) {
      payable.status = 'PAID';
      payable.updatedAt = Date.now();
      payable.externalProviderReference = event.providerReference.trim();
      this.recordAudit(payableId, `webhook:${event.providerReference}`, 'PAYMENT_PROCESSING', 'PAID', 'Verified PSP webhook transfer.success');
      return {
        payoutId: `payout_paid_${Date.now()}`,
        payableId,
        status: 'PAID',
        providerReference: payable.externalProviderReference,
        settledAt: payable.updatedAt,
      };
    }

    payable.status = 'FAILED';
    payable.updatedAt = Date.now();
    payable.rejectionReason = String(event.reason || 'PSP transfer failed');
    this.recordAudit(payableId, `webhook:fail:${Date.now()}`, 'PAYMENT_PROCESSING', 'FAILED', payable.rejectionReason);
    return {
      payoutId: `payout_fail_${Date.now()}`,
      payableId,
      status: 'FAILED',
      failureReason: payable.rejectionReason,
    };
  }
}
