import { RewardEvidence, RewardPayable, PayoutStatus } from '@project-eko/contracts';
import { TelemetryEvidencePackager } from '@project-eko/telemetry';
import { AntiCheatValidator } from '@project-eko/anti-cheat';

export interface SponsorCampaign {
  campaignId: string;
  sponsorName: string;
  title: string;
  totalBudgetFiatNgn: number;
  remainingBudgetFiatNgn: number;
  fixedRewardPerCompletionFiatNgn: number;
  minAverageSpeedKmh: number;
  maxCollisionImpulse: number;
  isActive: boolean;
}

/**
 * REWARD SERVICE (Feature-Flagged Non-Wagering Engine)
 * Strictly separates virtual gameplay from real Accounts Payable records.
 */
export class RewardService {
  private campaigns = new Map<string, SponsorCampaign>();
  private payables = new Map<string, RewardPayable>();
  private settledCompletionKeys = new Set<string>();
  private isRealRewardsFeatureFlagEnabled = false; // Strictly OFF in M0 and default production runtime

  constructor(enableFeatureFlag: boolean = false) {
    // In production, require explicit PROJECT_EKO_ENABLE_LIVE_FIAT_PAYOUTS === 'true' in addition to constructor flag
    if (process.env.NODE_ENV === 'production') {
      this.isRealRewardsFeatureFlagEnabled =
        Boolean(enableFeatureFlag) && process.env.PROJECT_EKO_ENABLE_LIVE_FIAT_PAYOUTS === 'true';
    } else {
      this.isRealRewardsFeatureFlagEnabled = Boolean(enableFeatureFlag);
    }

    // Seed pilot sponsor campaign (M4 pilot model)
    this.campaigns.set('cmp_safe_driver_lagos', {
      campaignId: 'cmp_safe_driver_lagos',
      sponsorName: 'Zenith Brand Partner',
      title: 'Eco-Driver Marina Corridor Challenge',
      totalBudgetFiatNgn: 1_000_000,
      remainingBudgetFiatNgn: 1_000_000,
      fixedRewardPerCompletionFiatNgn: 2_500,
      minAverageSpeedKmh: 35.0,
      maxCollisionImpulse: 10.0,
      isActive: true,
    });
  }

  public isFeatureFlagEnabled(): boolean {
    return this.isRealRewardsFeatureFlagEnabled;
  }

  /**
   * Process completed challenge telemetry into verified evidence and create payable record.
   */
  public evaluateChallengeCompletion(
    campaignId: string,
    missionId: string,
    playerId: string,
    averageSpeedKmh: number,
    maxSpeedKmh: number,
    hardBrakingEvents: number,
    collisionImpulseSum: number,
    passedCheckpoints: string[],
    idempotencyKey?: string
  ): {
    evidence: RewardEvidence;
    payable: RewardPayable | null;
    status: PayoutStatus;
    reason: string;
  } {
    // 1. Anti-Cheat Risk Analysis
    const antiCheat = AntiCheatValidator.validateMovementStep(
      'compact_sedan',
      { x: -480, y: 0, z: -620 },
      { x: 0, y: 0, z: 0 },
      90,
      averageSpeedKmh
    );

    const riskScore = antiCheat.isValid && maxSpeedKmh <= 180 ? 0.04 : 0.95;

    // 2. Cryptographic Evidence Packaging & One-Time Replay Consumption
    const evidence = TelemetryEvidencePackager.createEvidencePackage(
      missionId,
      playerId,
      averageSpeedKmh,
      maxSpeedKmh,
      hardBrakingEvents,
      collisionImpulseSum,
      passedCheckpoints,
      riskScore
    );

    const verification = TelemetryEvidencePackager.verifyAndConsumeEvidence(evidence);
    if (!verification.valid) {
      return {
        evidence,
        payable: null,
        status: 'FAILED',
        reason: `Evidence verification failed: ${verification.reason}`,
      };
    }

    const completionKey = idempotencyKey
      ? `idem:${playerId}:${idempotencyKey}`
      : `comp:${campaignId}:${missionId}:${playerId}:${evidence.telemetryHash}`;
    if (this.settledCompletionKeys.has(completionKey)) {
      return {
        evidence,
        payable: null,
        status: 'FAILED',
        reason: 'DUPLICATE_CHALLENGE_COMPLETION_REJECTED',
      };
    }

    // 3. Feature Flag & Campaign Verification
    if (!this.isRealRewardsFeatureFlagEnabled) {
      return {
        evidence,
        payable: null,
        status: 'PENDING',
        reason: 'Real-reward disbursements are strictly feature-flagged off pending legal validation.',
      };
    }

    const campaign = this.campaigns.get(campaignId);
    if (!campaign || !campaign.isActive) {
      return { evidence, payable: null, status: 'REVERSED', reason: 'Campaign inactive or not found.' };
    }

    if (campaign.remainingBudgetFiatNgn < campaign.fixedRewardPerCompletionFiatNgn) {
      return {
        evidence,
        payable: null,
        status: 'ON_HOLD',
        reason: 'SPONSOR_CAMPAIGN_BUDGET_EXHAUSTED',
      };
    }

    // 4. Criteria Check
    if (
      collisionImpulseSum > campaign.maxCollisionImpulse ||
      averageSpeedKmh < campaign.minAverageSpeedKmh ||
      riskScore > 0.3
    ) {
      return {
        evidence,
        payable: null,
        status: 'ON_HOLD',
        reason: 'Run flagged for manual review due to collision impulse or telemetry anomaly.',
      };
    }

    // 5. Create Immutable Payable Record (VERIFIED -> APPROVED)
    this.settledCompletionKeys.add(completionKey);
    const payable: RewardPayable = {
      payableId: `pay_${Date.now()}_${playerId.slice(0, 8)}`,
      evidenceId: evidence.evidenceId,
      playerId,
      campaignId,
      amountFiatNgn: campaign.fixedRewardPerCompletionFiatNgn,
      currency: 'NGN',
      status: 'APPROVED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    campaign.remainingBudgetFiatNgn -= campaign.fixedRewardPerCompletionFiatNgn;
    this.payables.set(payable.payableId, payable);

    return {
      evidence,
      payable,
      status: 'APPROVED',
      reason: 'Challenge successfully verified and approved for Accounts Payable disbursement.',
    };
  }

  public reversePayable(payableId: string, reason: string): RewardPayable {
    const payable = this.payables.get(payableId);
    if (!payable) {
      throw new Error(`PAYABLE_NOT_FOUND: ${payableId}`);
    }
    if (payable.status === 'PAID' || payable.status === 'REVERSED') {
      throw new Error(`CANNOT_REVERSE_PAYABLE_IN_STATUS_${payable.status}`);
    }
    const campaign = this.campaigns.get(payable.campaignId);
    if (campaign) {
      campaign.remainingBudgetFiatNgn += payable.amountFiatNgn;
    }
    payable.status = 'REVERSED';
    payable.rejectionReason = reason;
    payable.updatedAt = Date.now();
    return payable;
  }

  public reconcileCampaignBudget(campaignId: string): {
    isBalanced: boolean;
    totalBudgetFiatNgn: number;
    remainingBudgetFiatNgn: number;
    committedFiatNgn: number;
  } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`CAMPAIGN_NOT_FOUND: ${campaignId}`);
    }
    let committedFiatNgn = 0;
    for (const p of this.payables.values()) {
      if (p.campaignId === campaignId && p.status !== 'REVERSED' && p.status !== 'FAILED') {
        committedFiatNgn += p.amountFiatNgn;
      }
    }
    return {
      isBalanced: campaign.remainingBudgetFiatNgn + committedFiatNgn === campaign.totalBudgetFiatNgn,
      totalBudgetFiatNgn: campaign.totalBudgetFiatNgn,
      remainingBudgetFiatNgn: campaign.remainingBudgetFiatNgn,
      committedFiatNgn,
    };
  }

  public getPayable(payableId: string): RewardPayable | undefined {
    return this.payables.get(payableId);
  }
}
