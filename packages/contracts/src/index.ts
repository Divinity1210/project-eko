/**
 * PROJECT EKO — CORE DOMAIN CONTRACTS
 * Strict schemas, interfaces, and data models across apps, services, and packages.
 */

// ==========================================
// 1. WORLD & TRANSPORT SPINE CONTRACTS
// ==========================================

export type WorldNodeType =
  | 'brt_stop'
  | 'bus_stop'
  | 'rail_station'
  | 'ferry_terminal'
  | 'junction'
  | 'parking_area'
  | 'garage'
  | 'fuel_station'
  | 'service_area'
  | 'loading_zone'
  | 'pedestrian_crossing'
  | 'restricted_lane'
  | 'landmark';

export type TransportMode = 'walk' | 'car' | 'danfo' | 'brt' | 'okada' | 'keke' | 'rail' | 'ferry';

export type RoadQualityClass =
  | 'MAIN_ARTERIAL'
  | 'SECONDARY_ROAD'
  | 'LOCAL_ROAD'
  | 'MARKET_ROAD'
  | 'SERVICE_LANE';

export type BuildingArchetype =
  | 'low_rise_commercial'
  | 'office_block'
  | 'residential_compound'
  | 'mixed_use'
  | 'market_frontage'
  | 'institutional'
  | 'luxury_development'
  | 'roadside_shop';

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
  connections: string[]; // Connected Node IDs
  transportModes: TransportMode[];
  gameplayTags: string[];
  capacity?: number;
  speedLimitKmh?: number;
  roadClass?: RoadQualityClass;
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

// ==========================================
// 2. VEHICLE & DRIVING DYNAMICS CONTRACTS
// ==========================================

/**
 * FICTIONAL VEHICLE MANUFACTURER UNIVERSE:
 * Adera: Everyday Nigerian compact cars
 * Apex Transit: Commercial buses and Danfos
 * Koro: Motorcycles and Kekes
 * Ovation: Luxury SUVs and executive sedans
 * EkoHaul: Logistics vans and heavy haulage
 */
export type VehicleClass =
  | 'compact_sedan'      // Adera Compact 1.6
  | 'danfo_minibus'      // Apex Danfo 14
  | 'okada_motorcycle'   // Koro 125
  | 'luxury_suv'         // Ovation V8
  | 'keke_tricycle'      // Koro Keke 200
  | 'brt_bus';           // Apex Metro 80

export interface VehiclePhysicsProfile {
  vehicleClass: VehicleClass;
  manufacturer: 'Adera' | 'Apex Transit' | 'Koro' | 'Ovation' | 'EkoHaul';
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
  throttle: number; // 0 to 1
  brake: number;    // 0 to 1
  steer: number;    // -1 (left) to +1 (right)
  handbrake: boolean;
  reverse: boolean;
  gear: number;     // -1: R, 0: N, 1-6: gears
}

export interface VehicleDamageState {
  bodyCondition: number;     // 0 (totaled) to 100 (mint)
  engineCondition: number;   // 0 to 100
  tyreTreadPercent: number;  // 0 to 100
  oilQualityPercent: number; // 0 to 100
  isImmobilized: boolean;
}

export interface VehicleState {
  vehicleId: string;
  ownerId: string;
  vehicleClass: VehicleClass;
  position: WorldVector3;
  rotation: WorldVector3; // Euler angles in radians
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

// ==========================================
// 3. PLAYER & CAREER CONTRACTS
// ==========================================

export interface PlayerProfile {
  playerId: string;
  username: string;
  avatarConfig: {
    outfit: string;
    skinTone: string;
    hairStyle: string;
  };
  reputationScore: number;
  driverRating: number; // 1.0 to 5.0
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

// ==========================================
// 4. MISSIONS & DRIVER CAREER LOOP
// ==========================================

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

// ==========================================
// 5. DOUBLE-ENTRY ECONOMY LEDGER
// ==========================================

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

// ==========================================
// 6. REAL-REWARD & ACCOUNTS PAYABLE CONTRACTS
// ==========================================

export type PayoutStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'APPROVED'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'ON_HOLD'
  | 'REVERSED'
  | 'FAILED';

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

// ==========================================
// 7. REALTIME ZONE & MULTIPLAYER CONTRACTS
// ==========================================

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

// ==========================================
// 8. M3 CANONICAL WORLD REGISTRY, EKOATLAS,
//    EKOPLACES, EKOMEDIA & EKOPROPERTIES
// ==========================================

export type CanonicalEntityType =
  | 'district'
  | 'road'
  | 'junction'
  | 'transport_stop'
  | 'rail_station'
  | 'ferry_terminal'
  | 'landmark'
  | 'building'
  | 'business'
  | 'virtual_property_parcel'
  | 'player_owned_property'
  | 'billboard'
  | 'advertising_placement'
  | 'job_location'
  | 'mission_point'
  | 'event_venue'
  | 'vehicle_depot'
  | 'garage'
  | 'market'
  | 'residential_estate'
  | 'restricted_region';

export type EkoPlaceDirectoryCategory =
  | 'Transport'
  | 'Food'
  | 'Retail'
  | 'Entertainment'
  | 'Garages'
  | 'Dealerships'
  | 'Jobs'
  | 'Properties'
  | 'Events'
  | 'Player Businesses'
  | 'Landmarks'
  | 'Infrastructure';

export type EntityAvailabilityState = 'PLAYABLE' | 'PLANNED' | 'LOCKED';

export type ProvenanceCategory =
  | 'GEOGRAPHIC_FACT'
  | 'ORIGINAL_PROJECT_EKO_ASSET'
  | 'USER_GENERATED_ASSET'
  | 'OPEN_LICENSE_DATA'
  | 'PROTECTED_REAL_WORLD_LIKENESS_EXCLUDED'
  | 'FICTIONAL_COMMERCIAL_BRAND';

export interface EntityProvenanceRecord {
  category: ProvenanceCategory;
  sourceAttribution: string;
  license: string;
  verifiedDate: string;
  rightsNotes: string;
}

export interface EntityLODPolicy {
  minZoomLevel: number;
  maxRenderDistanceM: number;
  streamPolicy: 'ALWAYS_LOADED' | 'DISTRICT_STREAMED' | 'ATLAS_OVERVIEW_ONLY';
  detailTier: 'HERO_3D' | 'STYLIZED_25D' | 'REGION_BOUNDARY';
}

export type EntityInteractionActionType =
  | 'VIEW_DETAILS'
  | 'NAVIGATE'
  | 'ACCEPT_MISSION'
  | 'INTERACT_WORLD'
  | 'VIEW_SCHEDULE'
  | 'VISIT_PROPERTY'
  | 'OPEN_BUSINESS'
  | 'OPEN_APP'
  | 'MANAGE_MEDIA';

export interface EntityInteractionDef {
  actionId: string;
  label: string;
  actionType: EntityInteractionActionType;
  targetId?: string;
  triggerRadiusM?: number;
  requiresVehicle?: boolean;
}

export interface EntityOwnershipState {
  ownerId: string;
  ownerName: string;
  tenancyStatus: 'PUBLIC' | 'MUNICIPAL' | 'LEASEHOLD_ELIGIBLE' | 'PLAYER_OWNED' | 'NPC_OPERATED';
  linkedBusinessId?: string;
  linkedParcelId?: string;
}

export interface GeoReference {
  lat: number;
  lng: number;
  address: string;
  lga: string;
}

export interface CanonicalWorldEntity {
  id: string;
  aliases: string[];
  entityType: CanonicalEntityType;
  placeCategory: EkoPlaceDirectoryCategory;
  displayName: string;
  subtitle: string;
  districtId: string;
  geoReference: GeoReference;
  gamePosition: WorldVector3;
  graphNodeId: string;
  rotation: WorldVector3;
  scale: WorldVector3;
  worldAssetRef: string;
  lodPolicy: EntityLODPolicy;
  availabilityState: EntityAvailabilityState;
  interactions: EntityInteractionDef[];
  ownershipState?: EntityOwnershipState;
  provenance: EntityProvenanceRecord;
  tags: string[];
  scheduleInfo?: string;
}

export type EkoMediaFormat =
  | 'static_billboard'
  | 'digital_billboard'
  | 'terminal_display'
  | 'storefront_sponsorship'
  | 'venue_sponsorship'
  | 'sponsored_activity'
  | 'sponsored_transport_route'
  | 'scheduled_city_event';

export interface EkoMediaSlot {
  slotId: string;
  entityId: string;
  displayName: string;
  districtId: string;
  format: EkoMediaFormat;
  gamePosition: WorldVector3;
  rotationY: number;
  creativeDimensions: {
    widthPx: number;
    heightPx: number;
    aspectRatio: string;
    worldWidthM: number;
    worldHeightM: number;
  };
  operator: string;
  approvalState: 'APPROVED' | 'PENDING_REVIEW' | 'RESTRICTED_LANDMARK_EXEMPT';
  availabilityWindow: {
    startIso: string;
    endIso: string;
    commercialPolicy: 'SANDBOX_VIRTUAL_ONLY';
  };
  campaignState: 'ACTIVE_CAMPAIGN' | 'AVAILABLE_SLOT' | 'PAUSED' | 'HOUSE_FALLBACK';
  activeCampaignId: string | null;
}

export interface EkoMediaCampaign {
  campaignId: string;
  advertiser: {
    advertiserId: string;
    brandName: string;
    sector: string;
    isFictionalBrand: true;
    provenance: 'FICTIONAL_COMMERCIAL_BRAND';
  };
  title: string;
  creative: {
    creativeId: string;
    headline: string;
    subheadline: string;
    ctaLabel: string;
    accentColorHex: string;
    bgColorHex: string;
    disclosureLabel: 'SPONSORED • VIRTUAL AD';
  };
  eligibleInventory: string[];
  schedule: {
    startIso: string;
    endIso: string;
    daypart: 'ALL_DAY' | 'PEAK_COMMUTE' | 'EVENING_PRIME';
  };
  budgetAndPrice: {
    currency: 'GAME_NAIRA_VIRTUAL';
    totalBudgetGN: number;
    spentGN: number;
    cpmVirtualGN: number;
    realMoneySaleAllowed: false;
    commercialPolicyNote: string;
  };
  approvalWorkflow: {
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'REVOKED';
    reviewedBy: string;
    protectsLandmarks: true;
    licensedAssetsVerified: true;
  };
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'REMOVED';
  deliveryMetrics: {
    impressions: number;
    engagements: number;
    routeSelections: number;
    lastDeliveredAt: string | null;
  };
}

export type PermittedPropertyUse =
  | 'FOOD_BEVERAGE'
  | 'RETAIL_KIOSK'
  | 'AUTO_WORKSHOP'
  | 'LOGISTICS_DEPOT'
  | 'TRANSIT_HUB'
  | 'MIXED_COMMERCIAL';

export interface EkoVirtualPropertyParcel {
  parcelId: string;
  entityId: string;
  displayName: string;
  districtId: string;
  eligibleForAcquisition: boolean;
  plotBoundaries: {
    center: WorldVector3;
    widthM: number;
    depthM: number;
    areaSqm: number;
    cornerPoints: Array<{ x: number; z: number }>;
  };
  permittedUses: PermittedPropertyUse[];
  acquisitionTerms: {
    tenureType: 'VIRTUAL_LEASEHOLD_99_CYCLES' | 'VIRTUAL_CONCESSION_DEED';
    acquisitionCostGN: number;
    developmentCostGN: number;
    maintenanceCostPerShiftGN: number;
    realWorldLandClaim: false;
    legalDisclaimer: string;
  };
  buildState: 'UNDEVELOPED' | 'UNDER_CONSTRUCTION' | 'DEVELOPED_ACTIVE';
  businessType: string | null;
  operatingStatus: 'VACANT' | 'CONSTRUCTING' | 'OPEN_OPERATING' | 'MAINTENANCE_REQUIRED';
  ownership: {
    ownerId: string | null;
    ownerName: string;
    acquiredAtIso: string | null;
  };
  ownershipHistory: Array<{
    ownerId: string;
    ownerName: string;
    event: 'INITIAL_REGISTRY' | 'ACQUIRED' | 'DEVELOPED' | 'MAINTENANCE_PAID';
    timestampIso: string;
    amountGN: number;
    ledgerTxId?: string;
  }>;
  associatedBusinessEntityId: string | null;
  hourlyYieldGN: number;
  unclaimedYieldGN: number;
}

