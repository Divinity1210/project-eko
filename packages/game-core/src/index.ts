import { Mission, PlayerProfile, DriverShift } from '@project-eko/contracts';
import { MARINA_CMS_NODES, findShortestPath } from '@project-eko/world';
import { EconomyLedger, globalEconomyLedger } from '@project-eko/economy';

/**
 * DRIVER CAREER MANAGER
 * Orchestrates the full lifecycle:
 * START SHIFT -> FIND JOB -> ACCEPT PASSENGER -> NAVIGATE -> DRIVE -> COMPLETE -> GET RATED -> EARN GAME NAIRA -> PAY COSTS
 */
export class DriverCareerManager {
  private activeShifts = new Map<string, DriverShift>();
  private activeMissions = new Map<string, Mission>();
  private ledger: EconomyLedger;

  constructor(ledger: EconomyLedger = globalEconomyLedger) {
    this.ledger = ledger;
  }

  /**
   * Start a new commercial driving shift.
   */
  public startShift(playerId: string, vehicleId: string): DriverShift {
    const shift: DriverShift = {
      shiftId: `shift_${playerId}_${Date.now()}`,
      playerId,
      vehicleId,
      startTime: Date.now(),
      completedJobsCount: 0,
      totalEarningsGameNaira: 0,
      fuelConsumedLiters: 0,
      maintenanceCostGameNaira: 0,
      isActive: true,
    };
    this.activeShifts.set(playerId, shift);
    return shift;
  }

  /**
   * Generate contextual available passenger trips in the Marina/CMS vertical slice.
   */
  public generateAvailableMissions(): Mission[] {
    return [
      {
        missionId: 'mis_cms_to_tbs_corporate',
        type: 'passenger_trip',
        title: 'Broad Street Corporate Commute',
        description: 'Transport an investment banker from CMS Terminal to Tafawa Balewa Square.',
        pickupNodeId: 'node_cms_bus_park',
        dropoffNodeId: 'node_tbs_plaza',
        passengerName: 'Babajide (Financial Analyst)',
        passengerMood: 'hurried',
        distanceMeters: 1450,
        estimatedTimeSeconds: 120,
        rewardGameNaira: 1250,
        status: 'available',
        telemetryCheckpoints: ['node_cms_bus_park', 'node_broad_st_north', 'node_broad_st_mid', 'node_tbs_plaza'],
      },
      {
        missionId: 'mis_marina_promenade_tourist',
        type: 'passenger_trip',
        title: 'Waterfront Jetty Shuttle',
        description: 'Pick up arriving ferry passenger from CMS Jetty to Broad Street South Gateway.',
        pickupNodeId: 'node_cms_jetty',
        dropoffNodeId: 'node_broad_st_south',
        passengerName: 'Kemi (Fashion Merchant)',
        passengerMood: 'polite',
        distanceMeters: 1100,
        estimatedTimeSeconds: 95,
        rewardGameNaira: 950,
        status: 'available',
        telemetryCheckpoints: ['node_cms_jetty', 'node_marina_promenade', 'node_broad_st_south'],
      },
      {
        missionId: 'mis_tbs_to_fuel_station',
        type: 'package_dispatch',
        title: 'Emergency Fuel & Oil Parts Delivery',
        description: 'Deliver alternator belts from TBS Workshop to Marina Filling Station.',
        pickupNodeId: 'node_tbs_garage',
        dropoffNodeId: 'node_fuel_station_marina',
        cargoWeightKg: 15,
        distanceMeters: 1680,
        estimatedTimeSeconds: 140,
        rewardGameNaira: 1400,
        status: 'available',
        telemetryCheckpoints: ['node_tbs_garage', 'node_tbs_plaza', 'node_outer_marina_loop', 'node_fuel_station_marina'],
      },
    ];
  }

  /**
   * Accept a mission from the EkoRide/JobsHub phone app.
   */
  public acceptMission(playerId: string, mission: Mission): Mission {
    const active = { ...mission, status: 'accepted' as const, startedAt: Date.now() };
    this.activeMissions.set(playerId, active);
    return active;
  }

  /**
   * Complete the mission, validate navigation checkpoints, and record double-entry reward.
   */
  public completeMission(
    playerId: string,
    playerProfile: PlayerProfile,
    passedCheckpoints: string[],
    fuelConsumedLiters: number = 0.8,
    settlementIdempotencyKey?: string
  ): {
    completedMission: Mission;
    rating: number;
    earnedGameNaira: number;
    fuelCostGameNaira: number;
    netGameNaira: number;
    updatedBalance: number;
    transactionId: string;
  } {
    const mission = this.activeMissions.get(playerId);
    if (!mission) throw new Error(`No active mission found for player ${playerId}`);

    // Require the complete canonical route in order; a destination-only claim is
    // not enough to award the mission's route rating or payout.
    const plannedCheckpoints = mission.telemetryCheckpoints || [];
    if (!Array.isArray(passedCheckpoints) || plannedCheckpoints.length === 0 ||
        passedCheckpoints.length !== plannedCheckpoints.length ||
        plannedCheckpoints.some((checkpoint, index) => passedCheckpoints[index] !== checkpoint)) {
      throw new Error(`Cannot complete mission: the full canonical checkpoint sequence for '${mission.missionId}' is required.`);
    }

    const rating = 5.0;

    // Calculate economics: Fuel burn (₦650 GN/L) + Municipal Tax (₦100 GN)
    const fuelCostGameNaira = Math.round(fuelConsumedLiters * 650);
    const maintenanceTax = 100;
    const netGameNaira = mission.rewardGameNaira - fuelCostGameNaira - maintenanceTax;

    // Post to double-entry ledger
    const settlementKey = settlementIdempotencyKey || `idemp_mission_${mission.missionId}_${playerId}_${mission.startedAt || 'legacy'}`;
    if (this.ledger.exportTransactions().some((transaction) => transaction.idempotencyKey === settlementKey)) {
      throw new Error(`Mission settlement replay rejected for '${mission.missionId}'.`);
    }
    const postedTransaction = this.ledger.recordMissionReward(
      playerId,
      mission.missionId,
      mission.rewardGameNaira,
      fuelCostGameNaira,
      maintenanceTax,
      settlementKey
    );

    mission.status = 'completed';
    mission.completedAt = Date.now();

    // Update player profile
    playerProfile.gameNairaBalance += netGameNaira;
    playerProfile.driverRating = Number(((playerProfile.driverRating * 9 + rating) / 10).toFixed(2));
    playerProfile.reputationScore += 15;

    // Update active shift stats
    const shift = this.activeShifts.get(playerId);
    if (shift) {
      shift.completedJobsCount += 1;
      shift.totalEarningsGameNaira += netGameNaira;
      shift.fuelConsumedLiters += fuelConsumedLiters;
      shift.maintenanceCostGameNaira += maintenanceTax;
    }

    this.activeMissions.delete(playerId);

    return {
      completedMission: mission,
      rating,
      earnedGameNaira: mission.rewardGameNaira,
      fuelCostGameNaira,
      netGameNaira,
      updatedBalance: playerProfile.gameNairaBalance,
      transactionId: postedTransaction.transactionId,
    };
  }
}

// ==========================================
// 4 CANONICAL MINI-GAMES FOR M0/M1
// ==========================================

export interface MiniGameResult {
  miniGameType: string;
  score: number;
  passed: boolean;
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
  feedback: string;
  unlockedPrivilege?: string;
}

/**
 * 1. Driving Test: Hill start, parallel parking, and junction etiquette.
 */
export function evaluateDrivingTest(
  hillRollbackMeters: number,
  parkingSeconds: number,
  coneHits: number,
  yieldedToJunctionTraffic: boolean
): MiniGameResult {
  let score = 100;
  if (hillRollbackMeters > 0.2) score -= Math.min(30, (hillRollbackMeters - 0.2) * 100);
  if (parkingSeconds > 45) score -= Math.min(25, (parkingSeconds - 45) * 2);
  score -= coneHits * 20;
  if (!yieldedToJunctionTraffic) score -= 35;

  score = Math.max(0, Math.round(score));
  const passed = score >= 70;
  const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'F';

  return {
    miniGameType: 'driving_test',
    score,
    passed,
    grade,
    feedback: passed
      ? 'Congratulations! You passed the Lagos State Driver Licensing Exam.'
      : 'Failed exam. Practice hill clutch balancing and avoid hitting traffic cones.',
    unlockedPrivilege: passed ? 'Regular Driver License' : undefined,
  };
}

/**
 * 2. Delivery Routing: Route optimization under traffic conditions.
 */
export function evaluateDeliveryRouting(
  selectedPath: string[],
  optimalPath: string[],
  timeSeconds: number
): MiniGameResult {
  const isOptimal = selectedPath.join('->') === optimalPath.join('->');
  const score = isOptimal ? Math.max(70, Math.round(100 - timeSeconds * 0.2)) : 55;
  const passed = score >= 65;
  const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : 'F';

  return {
    miniGameType: 'delivery_routing',
    score,
    passed,
    grade,
    feedback: isOptimal
      ? 'Optimal route chosen! Avoided Broad Street congestion.'
      : 'Sub-optimal route. Traffic bottleneck delayed your delivery.',
    unlockedPrivilege: passed ? 'Express Dispatch Bonus (+15% pay)' : undefined,
  };
}

/**
 * 3. Mechanic Bay: Component diagnostics and engine repair.
 */
export function evaluateMechanicBay(
  correctDiagnosis: boolean,
  boltTorqueAccuracyPercent: number,
  repairedWithinTime: boolean
): MiniGameResult {
  if (!correctDiagnosis) {
    return {
      miniGameType: 'mechanic_bay',
      score: 30,
      passed: false,
      grade: 'F',
      feedback: 'Incorrect diagnosis. The engine was overheating due to low coolant, not the alternator belt.',
    };
  }

  const score = Math.round(boltTorqueAccuracyPercent * (repairedWithinTime ? 1.0 : 0.8));
  const passed = score >= 70;
  const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 70 ? 'B' : 'C';

  return {
    miniGameType: 'mechanic_bay',
    score,
    passed,
    grade,
    feedback: passed
      ? 'Diagnosis and repair verified. Vehicle returned to roadworthiness.'
      : 'Repair failed inspection: bolts not torqued to manufacturer specifications.',
    unlockedPrivilege: passed ? 'Mechanic Certification (-25% vehicle repair costs)' : undefined,
  };
}

/**
 * 4. Danfo Conductor: Fast route callout and currency change math.
 */
export function evaluateDanfoConductor(
  calloutRhythmAccuracyPercent: number,
  changeMathErrorsCount: number
): MiniGameResult {
  let score = Math.round(calloutRhythmAccuracyPercent);
  score -= changeMathErrorsCount * 25;
  score = Math.max(0, score);
  const passed = score >= 65;
  const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : 'F';

  return {
    miniGameType: 'danfo_conductor',
    score,
    passed,
    grade,
    feedback: passed
      ? 'Sharp conductor work! Passengers boarded efficiently with correct change.'
      : 'Conductor fumble! Passenger boarding delay caused bus overload penalties.',
    unlockedPrivilege: passed ? 'Commercial Minibus Permit' : undefined,
  };
}
