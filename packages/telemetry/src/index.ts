import { RewardEvidence } from '@project-eko/contracts';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SignedCheckpointToken {
  tokenId: string;
  sessionId: string;
  accountId: string;
  vehicleId: string;
  routeId: string;
  stopOrCheckpointIds: string[];
  distanceMeters: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signature: string;
}

export class TelemetryEvidencePackager {
  private static readonly RULES_VERSION = 'v1.0.0_M0_CANONICAL';
  private static readonly MAX_EVIDENCE_CLOCK_SKEW_MS = 10 * 60 * 1000;
  private static consumedEvidenceIds = new Set<string>();
  private static consumedTelemetryHashes = new Set<string>();

  /**
   * Resolves the authoritative server signing secret from managed environment configuration.
   * Fails closed in production if PROJECT_EKO_EVIDENCE_HMAC_KEY is not provisioned or too short.
   */
  public static resolveSigningSecret(secretOverride?: string): string {
    const candidate = (secretOverride || process.env.PROJECT_EKO_EVIDENCE_HMAC_KEY || '').trim();
    if (process.env.NODE_ENV === 'production') {
      if (candidate.length < 32) {
        throw new Error('EVIDENCE_SIGNING_SECRET_MISSING_IN_PRODUCTION: PROJECT_EKO_EVIDENCE_HMAC_KEY (>= 32 chars) is required.');
      }
      return candidate;
    }
    if (candidate.length > 0) {
      return candidate;
    }
    // Non-production local sandbox fallback derived via SHA-256 of workspace runtime scope
    return crypto
      .createHash('sha256')
      .update(`project-eko-dev-telemetry-key:${process.env.PROJECT_EKO_ENV || 'development'}`)
      .digest('hex');
  }

  public static isUsingManagedSecret(): boolean {
    const configured = (process.env.PROJECT_EKO_EVIDENCE_HMAC_KEY || '').trim();
    return configured.length >= 32;
  }

  /**
   * Canonicalizes telemetry fields deterministically before hashing/signing.
   */
  public static canonicalizeEvidenceData(
    missionId: string,
    playerId: string,
    averageSpeedKmh: number,
    maxSpeedKmh: number,
    hardBrakingEvents: number,
    collisionImpulseSum: number,
    passedCheckpoints: string[],
    riskScore: number
  ): string {
    const normalizedCheckpoints = passedCheckpoints.map((cp) => String(cp).trim()).join(',');
    return [
      this.RULES_VERSION,
      String(missionId).trim(),
      String(playerId).trim(),
      Number(averageSpeedKmh).toFixed(2),
      Number(maxSpeedKmh).toFixed(2),
      Math.max(0, Math.round(Number(hardBrakingEvents))),
      Number(collisionImpulseSum).toFixed(2),
      normalizedCheckpoints,
      Number(riskScore).toFixed(4),
    ].join(':');
  }

  /**
   * Generates a cryptographic evidence package from raw drive telemetry.
   */
  public static createEvidencePackage(
    missionId: string,
    playerId: string,
    averageSpeedKmh: number,
    maxSpeedKmh: number,
    hardBrakingEvents: number,
    collisionImpulseSum: number,
    passedCheckpoints: string[],
    riskScore: number,
    secretOverride?: string
  ): RewardEvidence {
    const rawData = this.canonicalizeEvidenceData(
      missionId,
      playerId,
      averageSpeedKmh,
      maxSpeedKmh,
      hardBrakingEvents,
      collisionImpulseSum,
      passedCheckpoints,
      riskScore
    );
    const telemetryHash = crypto.createHash('sha256').update(rawData).digest('hex');
    const evidenceId = `ev_${crypto.randomUUID()}`;
    const timestamp = Date.now();

    const serverSecret = this.resolveSigningSecret(secretOverride);
    const signingInput = `${evidenceId}:${missionId}:${playerId}:${telemetryHash}:${timestamp}`;
    const serverSignature = crypto
      .createHmac('sha256', serverSecret)
      .update(signingInput)
      .digest('hex');

    return {
      evidenceId,
      missionId,
      playerId,
      rulesetVersion: this.RULES_VERSION,
      telemetryHash,
      averageSpeedKmh,
      maxSpeedKmh,
      hardBrakingEvents,
      collisionImpulseSum,
      passedCheckpoints: [...passedCheckpoints],
      riskScore,
      serverSignature,
      timestamp,
    };
  }

  /**
   * Verifies the cryptographic signature of an evidence package using timing-safe comparison.
   */
  public static verifyEvidenceSignature(evidence: RewardEvidence, secretOverride?: string): boolean {
    if (!evidence || typeof evidence.serverSignature !== 'string' || typeof evidence.telemetryHash !== 'string') {
      return false;
    }
    const serverSecret = this.resolveSigningSecret(secretOverride);
    const signingInput = `${evidence.evidenceId}:${evidence.missionId}:${evidence.playerId}:${evidence.telemetryHash}:${evidence.timestamp}`;
    const expectedCanonicalSig = crypto
      .createHmac('sha256', serverSecret)
      .update(signingInput)
      .digest('hex');
    const expectedHashOnlySig = crypto
      .createHmac('sha256', serverSecret)
      .update(evidence.telemetryHash)
      .digest('hex');

    const actualBuf = Buffer.from(evidence.serverSignature, 'utf8');
    const canonicalBuf = Buffer.from(expectedCanonicalSig, 'utf8');
    if (actualBuf.length === canonicalBuf.length && crypto.timingSafeEqual(actualBuf, canonicalBuf)) {
      return true;
    }
    const hashOnlyBuf = Buffer.from(expectedHashOnlySig, 'utf8');
    if (actualBuf.length === hashOnlyBuf.length && crypto.timingSafeEqual(actualBuf, hashOnlyBuf)) {
      return true;
    }
    return false;
  }

  /**
   * Verifies signature, clock-skew freshness, and one-time replay protection, then marks the evidence consumed.
   */
  public static verifyAndConsumeEvidence(
    evidence: RewardEvidence,
    secretOverride?: string,
    maxAgeMs: number = this.MAX_EVIDENCE_CLOCK_SKEW_MS
  ): { valid: boolean; reason?: string } {
    if (!this.verifyEvidenceSignature(evidence, secretOverride)) {
      return { valid: false, reason: 'INVALID_EVIDENCE_SIGNATURE' };
    }
    const now = Date.now();
    if (typeof evidence.timestamp !== 'number' || Math.abs(now - evidence.timestamp) > maxAgeMs) {
      return { valid: false, reason: 'EVIDENCE_TIMESTAMP_EXPIRED_OR_SKEWED' };
    }
    if (this.consumedEvidenceIds.has(evidence.evidenceId)) {
      return { valid: false, reason: 'EVIDENCE_REPLAY_DETECTED' };
    }
    const dedupKey = `${evidence.playerId}:${evidence.missionId}:${evidence.telemetryHash}:${evidence.timestamp}`;
    if (this.consumedTelemetryHashes.has(dedupKey)) {
      return { valid: false, reason: 'DUPLICATE_TELEMETRY_SUBMISSION' };
    }
    this.consumedEvidenceIds.add(evidence.evidenceId);
    this.consumedTelemetryHashes.add(dedupKey);
    return { valid: true };
  }

  /**
   * Issues a server-signed checkpoint/co-op completion token from the authoritative realtime worker.
   */
  public static signCheckpointToken(
    payload: Omit<SignedCheckpointToken, 'tokenId' | 'issuedAt' | 'expiresAt' | 'nonce' | 'signature'>,
    ttlMs: number = 10 * 60 * 1000,
    secretOverride?: string
  ): SignedCheckpointToken {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ttlMs;
    const nonce = crypto.randomUUID();
    const tokenId = `chk_${crypto.randomUUID()}`;
    const canonical = [
      tokenId,
      payload.sessionId,
      payload.accountId,
      payload.vehicleId,
      payload.routeId,
      payload.stopOrCheckpointIds.join(','),
      Number(payload.distanceMeters).toFixed(2),
      issuedAt,
      expiresAt,
      nonce,
    ].join('|');
    const signature = crypto
      .createHmac('sha256', this.resolveSigningSecret(secretOverride))
      .update(canonical)
      .digest('hex');
    return {
      ...payload,
      tokenId,
      issuedAt,
      expiresAt,
      nonce,
      signature,
    };
  }

  /**
   * Verifies a server-signed checkpoint/co-op completion token.
   */
  public static verifyCheckpointToken(token: SignedCheckpointToken, secretOverride?: string): { valid: boolean; reason?: string } {
    if (!token || typeof token.signature !== 'string' || !Array.isArray(token.stopOrCheckpointIds)) {
      return { valid: false, reason: 'MALFORMED_CHECKPOINT_TOKEN' };
    }
    if (Date.now() > token.expiresAt) {
      return { valid: false, reason: 'CHECKPOINT_TOKEN_EXPIRED' };
    }
    const canonical = [
      token.tokenId,
      token.sessionId,
      token.accountId,
      token.vehicleId,
      token.routeId,
      token.stopOrCheckpointIds.join(','),
      Number(token.distanceMeters).toFixed(2),
      token.issuedAt,
      token.expiresAt,
      token.nonce,
    ].join('|');
    const expected = crypto
      .createHmac('sha256', this.resolveSigningSecret(secretOverride))
      .update(canonical)
      .digest('hex');
    const actualBuf = Buffer.from(token.signature, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
      return { valid: false, reason: 'INVALID_CHECKPOINT_TOKEN_SIGNATURE' };
    }
    return { valid: true };
  }

  /**
   * Persists verified evidence packages to an append-only JSON store for audit durability.
   */
  public static persistEvidenceRecord(evidence: RewardEvidence, dataDir?: string): void {
    const targetDir = dataDir || process.env.PROJECT_EKO_DATA_DIR || path.join(process.cwd(), 'services', 'api', 'data');
    fs.mkdirSync(targetDir, { recursive: true });
    const storePath = path.join(targetDir, 'telemetry_evidence_log.json');
    let existing: RewardEvidence[] = [];
    if (fs.existsSync(storePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      } catch (_) {
        existing = [];
      }
    }
    if (!existing.some((item) => item.evidenceId === evidence.evidenceId)) {
      existing.push(evidence);
      const tmpPath = `${storePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(existing, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmpPath, storePath);
    }
  }
}
