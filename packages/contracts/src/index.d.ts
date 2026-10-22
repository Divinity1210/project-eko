/**
 * PROJECT EKO — CORE DOMAIN CONTRACTS
 * Strict schemas, interfaces, and data models across apps, services, and packages.
 */
export type WorldNodeType = 'brt_stop' | 'bus_stop' | 'rail_station' | 'ferry_terminal' | 'junction' | 'parking_area' | 'garage' | 'fuel_station' | 'service_area' | 'loading_zone' | 'pedestrian_crossing' | 'restricted_lane' | 'landmark';
export type TransportMode = 'walk' | 'car' | 'danfo' | 'brt' | 'okada' | 'keke' | 'rail' | 'ferry';
export interface WorldVector3 {
    x: number;
    y: number;
    z: number;
}
export interface WorldNode {
    id: string;
    type: WorldNodeType;
    name: string;
    district: string;
    latitude: number;
    longitude: number;
    gamePosition: WorldVector3;
    connections: string[];
    transportModes: TransportMode[];
    gameplayTags: string[];
    capacity?: number;
    speedLimitKmh?: number;
}
export interface WorldRoute {
    id: string;
    name: string;
    district: string;
    nodeSequence: string[];
    totalDistanceMeters: number;
    estimatedDurationSeconds: number;
    baseFareGameNaira: number;
    transportMode: TransportMode;
}
export type VehicleClass = 'compact_sedan' | 'danfo_minibus' | 'okada_motorcycle';
export interface VehiclePhysicsProfile {
    vehicleClass: VehicleClass;
    displayName: string;
    massKg: number;
    centerOfGravityHeight: number;
    engineMaxPowerKw: number;
    enginePeakTorqueNm: number;
    peakRpm: number;
    idleRpm: number;
    maxRpm: number;
    gearRatios: number[];
    finalDriveRatio: number;
    brakeForceMax: number;
    handbrakeForceMax: number;
    steeringAngleMaxRad: number;
    suspensionStiffness: number;
    suspensionDamping: number;
    suspensionRestLength: number;
    tyreGripCoefficient: number;
    aerodynamicDragCoefficient: number;
    fuelCapacityLiters: number;
    fuelConsumptionBaseRate: number;
}
export interface VehicleControlInput {
    throttle: number;
    brake: number;
    steer: number;
    handbrake: boolean;
    reverse: boolean;
    gear: number;
}
export interface VehicleDamageState {
    bodyCondition: number;
    engineCondition: number;
    tyreTreadPercent: number;
    oilQualityPercent: number;
    isImmobilized: boolean;
}
export interface VehicleState {
    vehicleId: string;
    ownerId: string;
    vehicleClass: VehicleClass;
    position: WorldVector3;
    rotation: WorldVector3;
    velocity: WorldVector3;
    angularVelocity: WorldVector3;
    speedKmh: number;
    rpm: number;
    currentGear: number;
    fuelLiters: number;
    damage: VehicleDamageState;
    driverId: string | null;
    passengerIds: string[];
}
export interface PlayerProfile {
    playerId: string;
    username: string;
    avatarConfig: {
        outfit: string;
        skinTone: string;
        hairStyle: string;
    };
    reputationScore: number;
    driverRating: number;
    gameNairaBalance: number;
    currentZoneId: string;
    currentVehicleId: string | null;
    activeMissionId: string | null;
    ownedVehicleIds: string[];
    licenses: {
        regularDriver: boolean;
        commercialDanfo: boolean;
        dispatchCourier: boolean;
        heavyTruck: boolean;
    };
}
export interface DriverShift {
    shiftId: string;
    playerId: string;
    vehicleId: string;
    startTime: number;
    completedJobsCount: number;
    totalEarningsGameNaira: number;
    fuelConsumedLiters: number;
    maintenanceCostGameNaira: number;
    isActive: boolean;
}
export type MissionType = 'passenger_trip' | 'package_dispatch' | 'danfo_commuter_route' | 'driving_test';
export type MissionStatus = 'available' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export interface Mission {
    missionId: string;
    type: MissionType;
    title: string;
    description: string;
    pickupNodeId: string;
    dropoffNodeId: string;
    passengerName?: string;
    passengerMood?: 'polite' | 'hurried' | 'demanding';
    cargoWeightKg?: number;
    distanceMeters: number;
    estimatedTimeSeconds: number;
    rewardGameNaira: number;
    status: MissionStatus;
    startedAt?: number;
    completedAt?: number;
    telemetryCheckpoints: string[];
}
export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'sink';
export interface LedgerAccount {
    accountCode: string;
    name: string;
    category: AccountCategory;
}
export interface LedgerEntryLine {
    accountCode: string;
    debit: number;
    credit: number;
}
export interface GameLedgerTransaction {
    transactionId: string;
    eventId: string;
    idempotencyKey: string;
    actorId: string;
    timestamp: number;
    reason: string;
    metadata?: Record<string, unknown>;
    lines: LedgerEntryLine[];
}
export type PayoutStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'PAYMENT_PROCESSING' | 'PAID' | 'ON_HOLD' | 'REVERSED' | 'FAILED';
export interface RewardEvidence {
    evidenceId: string;
    missionId: string;
    playerId: string;
    rulesetVersion: string;
    telemetryHash: string;
    averageSpeedKmh: number;
    maxSpeedKmh: number;
    hardBrakingEvents: number;
    collisionImpulseSum: number;
    passedCheckpoints: string[];
    riskScore: number;
    serverSignature: string;
    timestamp: number;
}
export interface RewardPayable {
    payableId: string;
    evidenceId: string;
    playerId: string;
    campaignId: string;
    amountFiatNgn: number;
    currency: 'NGN';
    status: PayoutStatus;
    createdAt: number;
    updatedAt: number;
    externalProviderReference?: string;
    rejectionReason?: string;
}
export interface PlayerPresence {
    playerId: string;
    username: string;
    position: WorldVector3;
    rotationY: number;
    inVehicleId: string | null;
    isDriving: boolean;
    avatarState: 'idle' | 'walking' | 'running' | 'driving';
    lastSeen: number;
}
export interface ZoneSnapshot {
    zoneId: string;
    tickNumber: number;
    timestamp: number;
    weather: 'clear' | 'overcast' | 'rain' | 'heavy_flood';
    timeBand: 'dawn' | 'morning' | 'afternoon' | 'night';
    players: PlayerPresence[];
    vehicles: VehicleState[];
}
export interface ProximityChatMessage {
    messageId: string;
    senderId: string;
    senderName: string;
    position: WorldVector3;
    channel: 'local' | 'crew' | 'radio';
    text: string;
    timestamp: number;
}
