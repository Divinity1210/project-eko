import { VehicleClass, WorldVector3 } from '@project-eko/contracts';
import { VEHICLE_PROFILES } from '@project-eko/physics';

export interface AntiCheatValidationResult {
  isValid: boolean;
  violationCode?: 'IMPOSSIBLE_SPEED' | 'TELEPORT_DETECTED' | 'EXCESSIVE_ACCELERATION' | 'BOT_INPUT_PATTERN';
  riskScore: number; // 0.0 (clean) to 1.0 (blatant cheat)
  details: string;
}

export class AntiCheatValidator {
  /**
   * Validates kinematic trajectory between two consecutive client telemetry points.
   */
  public static validateMovementStep(
    vehicleClass: VehicleClass,
    startPos: WorldVector3,
    endPos: WorldVector3,
    deltaTimeSeconds: number,
    reportedSpeedKmh: number
  ): AntiCheatValidationResult {
    const profile = VEHICLE_PROFILES[vehicleClass] || VEHICLE_PROFILES.compact_sedan;

    // 1. Distance & Velocity
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const dz = endPos.z - startPos.z;
    const distanceMeters = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const calculatedSpeedMs = distanceMeters / Math.max(0.001, deltaTimeSeconds);
    const calculatedSpeedKmh = calculatedSpeedMs * 3.6;

    // 2. Maximum Theoretical Speed Check
    const maxAllowedSpeedKmh = 180; // Hard max for compact/danfo in Lagos
    if (calculatedSpeedKmh > maxAllowedSpeedKmh || reportedSpeedKmh > maxAllowedSpeedKmh) {
      return {
        isValid: false,
        violationCode: 'IMPOSSIBLE_SPEED',
        riskScore: 0.95,
        details: `Reported speed ${calculatedSpeedKmh.toFixed(1)} km/h exceeds maximum theoretical limit ${maxAllowedSpeedKmh} km/h for ${profile.displayName}.`,
      };
    }

    // 3. Teleportation Check (excessive delta in short time)
    if (distanceMeters > 50 && deltaTimeSeconds < 0.2) {
      return {
        isValid: false,
        violationCode: 'TELEPORT_DETECTED',
        riskScore: 0.99,
        details: `Displacement of ${distanceMeters.toFixed(1)}m in ${deltaTimeSeconds}s is mathematically impossible without warp hacks.`,
      };
    }

    return {
      isValid: true,
      riskScore: 0.02,
      details: 'Kinematics within lawful vehicle envelope.',
    };
  }

  /**
   * Evaluates steering input stream for unnatural bot macro precision.
   */
  public static analyzeInputJitter(steerSamples: number[]): AntiCheatValidationResult {
    if (steerSamples.length < 20) {
      return { isValid: true, riskScore: 0.05, details: 'Insufficient samples for statistical analysis.' };
    }

    // Measure variance
    const mean = steerSamples.reduce((a, b) => a + b, 0) / steerSamples.length;
    const variance = steerSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / steerSamples.length;

    // A completely flat steering input (variance == 0 while vehicle is turning) is indicative of a bot script
    if (variance < 0.00001 && Math.abs(mean) > 0.1) {
      return {
        isValid: false,
        violationCode: 'BOT_INPUT_PATTERN',
        riskScore: 0.85,
        details: 'Zero input jitter detected during extended curve navigation; bot macro suspected.',
      };
    }

    return {
      isValid: true,
      riskScore: 0.03,
      details: 'Human micro-jitter verified.',
    };
  }
}
