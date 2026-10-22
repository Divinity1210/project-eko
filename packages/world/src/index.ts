import {
  WorldNode,
  WorldRoute,
  WorldVector3,
  CanonicalWorldEntity,
  CanonicalEntityType,
  EkoPlaceDirectoryCategory,
  EkoMediaSlot,
  EkoMediaCampaign,
  EkoVirtualPropertyParcel,
} from '@project-eko/contracts';


/**
 * MARINA / CMS / TBS CLUSTER NODES
 * Topologically grounded world graph for the M0/M1 vertical slice.
 * Coordinate origin (0, 0, 0) is Tafawa Balewa Square (TBS).
 */
export const MARINA_CMS_NODES: Record<string, WorldNode> = {
  node_tbs_plaza: {
    id: 'node_tbs_plaza',
    type: 'landmark',
    name: 'Tafawa Balewa Square (TBS) Ceremonial Plaza',
    district: 'Lagos Island',
    latitude: 6.4474,
    longitude: 3.4015,
    gamePosition: { x: 0, y: 0, z: 0 },
    connections: ['node_catholic_mission_st', 'node_broad_st_south', 'node_tbs_garage'],
    transportModes: ['walk', 'car', 'danfo'],
    gameplayTags: ['event_hub', 'racing_start', 'civic_center'],
    speedLimitKmh: 40,
  },
  node_tbs_garage: {
    id: 'node_tbs_garage',
    type: 'garage',
    name: 'TBS Central Auto Garage & Workshop',
    district: 'Lagos Island',
    latitude: 6.4468,
    longitude: 3.4005,
    gamePosition: { x: -60, y: 0, z: 40 },
    connections: ['node_tbs_plaza'],
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    gameplayTags: ['repair_depot', 'mechanic_bay', 'tuning'],
  },
  node_catholic_mission_st: {
    id: 'node_catholic_mission_st',
    type: 'junction',
    name: 'Catholic Mission Street Junction',
    district: 'Lagos Island',
    latitude: 6.4485,
    longitude: 3.3985,
    gamePosition: { x: -120, y: 0, z: -150 },
    connections: ['node_tbs_plaza', 'node_broad_st_mid', 'node_odunlami_st'],
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    gameplayTags: ['street_commerce', 'traffic_junction'],
    speedLimitKmh: 50,
  },
  node_odunlami_st: {
    id: 'node_odunlami_st',
    type: 'junction',
    name: 'Odunlami Street Corner',
    district: 'Lagos Island',
    latitude: 6.4502,
    longitude: 3.3962,
    gamePosition: { x: -220, y: 0, z: -320 },
    connections: ['node_catholic_mission_st', 'node_broad_st_north'],
    transportModes: ['walk', 'car', 'okada'],
    gameplayTags: ['dense_retail', 'pedestrian_density'],
    speedLimitKmh: 40,
  },
  node_broad_st_north: {
    id: 'node_broad_st_north',
    type: 'junction',
    name: 'Broad Street Commercial Spine (North)',
    district: 'Lagos Island',
    latitude: 6.4525,
    longitude: 3.3930,
    gamePosition: { x: -350, y: 0, z: -480 },
    connections: ['node_odunlami_st', 'node_broad_st_mid', 'node_cms_bus_park'],
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    gameplayTags: ['banking_strip', 'street_vendors'],
    speedLimitKmh: 50,
  },
  node_broad_st_mid: {
    id: 'node_broad_st_mid',
    type: 'junction',
    name: 'Broad Street / Financial Towers',
    district: 'Lagos Island',
    latitude: 6.4500,
    longitude: 3.3955,
    gamePosition: { x: -220, y: 0, z: -250 },
    connections: ['node_broad_st_north', 'node_broad_st_south', 'node_catholic_mission_st', 'node_marina_promenade'],
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    gameplayTags: ['financial_hustle', 'high_rise_facades'],
    speedLimitKmh: 50,
  },
  node_broad_st_south: {
    id: 'node_broad_st_south',
    type: 'junction',
    name: 'Broad Street South Gateway',
    district: 'Lagos Island',
    latitude: 6.4475,
    longitude: 3.3980,
    gamePosition: { x: -90, y: 0, z: -80 },
    connections: ['node_broad_st_mid', 'node_tbs_plaza', 'node_marina_promenade'],
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    gameplayTags: ['junction', 'pedestrian_crossing'],
    speedLimitKmh: 50,
  },
  node_cms_bus_park: {
    id: 'node_cms_bus_park',
    type: 'bus_stop',
    name: 'CMS Multi-Modal Bus Terminal',
    district: 'Lagos Island',
    latitude: 6.4535,
    longitude: 3.3910,
    gamePosition: { x: -480, y: 0, z: -620 },
    connections: ['node_broad_st_north', 'node_cms_brt_gate', 'node_cms_jetty', 'node_outer_marina_loop'],
    transportModes: ['walk', 'car', 'danfo', 'brt', 'okada'],
    gameplayTags: ['danfo_depot', 'passenger_demand_high', 'dispatch_hub'],
    capacity: 25,
    speedLimitKmh: 30,
  },
  node_cms_brt_gate: {
    id: 'node_cms_brt_gate',
    type: 'brt_stop',
    name: 'CMS Dedicated BRT Corridor Platform',
    district: 'Lagos Island',
    latitude: 6.4540,
    longitude: 3.3905,
    gamePosition: { x: -520, y: 0, z: -660 },
    connections: ['node_cms_bus_park', 'node_outer_marina_loop', 'node_marina_rail_station'],
    transportModes: ['walk', 'brt'],
    gameplayTags: ['brt_route_lite', 'high_capacity_boarding'],
    speedLimitKmh: 50,
  },
  node_cms_jetty: {
    id: 'node_cms_jetty',
    type: 'ferry_terminal',
    name: 'CMS Ferry Terminal (Waterfront)',
    district: 'Lagos Island',
    latitude: 6.4545,
    longitude: 3.3895,
    gamePosition: { x: -560, y: 0, z: -720 },
    connections: ['node_cms_bus_park', 'node_marina_promenade'],
    transportModes: ['walk', 'ferry'],
    gameplayTags: ['waterfront_transit', 'lagoon_dock'],
  },
  node_marina_promenade: {
    id: 'node_marina_promenade',
    type: 'junction',
    name: 'Inner Marina Waterfront Boulevard',
    district: 'Lagos Island',
    latitude: 6.4510,
    longitude: 3.3920,
    gamePosition: { x: -380, y: 0, z: -350 },
    connections: ['node_cms_jetty', 'node_broad_st_mid', 'node_broad_st_south', 'node_marina_rail_station'],
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    gameplayTags: ['scenic_drive', 'ocean_breeze', 'commercial_facades'],
    speedLimitKmh: 60,
  },
  node_marina_rail_station: {
    id: 'node_marina_rail_station',
    type: 'rail_station',
    name: 'Marina Blue Line Elevated Rail Station',
    district: 'Lagos Island',
    latitude: 6.4520,
    longitude: 3.3900,
    gamePosition: { x: -450, y: 12, z: -500 }, // Elevated bridge station
    connections: ['node_cms_brt_gate', 'node_marina_promenade', 'node_national_theatre_connector'],
    transportModes: ['walk', 'rail'],
    gameplayTags: ['rapid_transit', 'elevated_rail'],
  },
  node_outer_marina_loop: {
    id: 'node_outer_marina_loop',
    type: 'junction',
    name: 'Outer Marina Expressway Loop',
    district: 'Lagos Island',
    latitude: 6.4560,
    longitude: 3.3880,
    gamePosition: { x: -650, y: 0, z: -800 },
    connections: ['node_cms_bus_park', 'node_cms_brt_gate', 'node_national_theatre_connector', 'node_fuel_station_marina'],
    transportModes: ['car', 'danfo', 'brt', 'okada'],
    gameplayTags: ['express_highway', 'high_speed'],
    speedLimitKmh: 80,
  },
  node_national_theatre_connector: {
    id: 'node_national_theatre_connector',
    type: 'junction',
    name: 'Eko Bridge Approach (To National Theatre / Iganmu)',
    district: 'Mainland West Link',
    latitude: 6.4600,
    longitude: 3.3820,
    gamePosition: { x: -900, y: 8, z: -1050 },
    connections: ['node_outer_marina_loop', 'node_marina_rail_station'],
    transportModes: ['car', 'danfo', 'brt', 'rail'],
    gameplayTags: ['mainland_bridge_link', 'bridge_approach'],
    speedLimitKmh: 80,
  },
  node_fuel_station_marina: {
    id: 'node_fuel_station_marina',
    type: 'fuel_station',
    name: 'Oandoil Filling Station Marina',
    district: 'Lagos Island',
    latitude: 6.4550,
    longitude: 3.3890,
    gamePosition: { x: -600, y: 0, z: -760 },
    connections: ['node_outer_marina_loop'],
    transportModes: ['car', 'danfo', 'okada'],
    gameplayTags: ['refuel', 'convenience_store', 'air_pump'],
  },
};

export const MARINA_CMS_ROUTES: WorldRoute[] = [
  {
    id: 'route_cms_commuter',
    name: 'CMS Terminal to TBS Commercial Express',
    district: 'Lagos Island',
    nodeSequence: ['node_cms_bus_park', 'node_broad_st_north', 'node_broad_st_mid', 'node_broad_st_south', 'node_tbs_plaza'],
    totalDistanceMeters: 1420,
    estimatedDurationSeconds: 150,
    baseFareGameNaira: 350,
    transportMode: 'danfo',
  },
  {
    id: 'route_marina_waterfront',
    name: 'TBS to Marina Waterfront Circuit',
    district: 'Lagos Island',
    nodeSequence: ['node_tbs_plaza', 'node_catholic_mission_st', 'node_broad_st_mid', 'node_marina_promenade', 'node_cms_jetty'],
    totalDistanceMeters: 1650,
    estimatedDurationSeconds: 180,
    baseFareGameNaira: 400,
    transportMode: 'car',
  },
];

/**
 * Spatial Distance Calculation (Euclidean in Game Coordinates)
 */
export function calculateDistance(a: WorldVector3, b: WorldVector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * M4.9 LANE-AWARE LAGOS ROAD NETWORK & VEHICLE PERMISSION RULES
 */
export type LagosRoadLaneType =
  | 'GENERAL_TRAFFIC'
  | 'GENERAL_TRAFFIC_LEFT'
  | 'GENERAL_TRAFFIC_RIGHT'
  | 'BUS_STOP_BAY'
  | 'BUS_TERMINAL_ACCESS'
  | 'BRT_ONLY'
  | 'PUBLIC_TRANSPORT_ONLY'
  | 'SERVICE_LANE'
  | 'PARKING_AREA'
  | 'RESTRICTED_ACCESS'
  | 'TEMPORARILY_BLOCKED'
  | 'MERGE_ZONE';

export type LagosVehicleClass =
  | 'DANFO'
  | 'BRT'
  | 'PRIVATE_CAR'
  | 'TAXI'
  | 'KEKE'
  | 'OKADA'
  | 'DELIVERY_VAN'
  | 'HEAVY_TRUCK'
  | 'EMERGENCY_RESCUE';

export const VEHICLE_CLASS_LANE_PERMISSIONS: Record<
  LagosVehicleClass,
  {
    allowedLanes: LagosRoadLaneType[];
    forbiddenLanes: LagosRoadLaneType[];
    requiredTransportMode: 'danfo' | 'brt' | 'car' | 'okada';
  }
> = {
  DANFO: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'BUS_STOP_BAY',
      'BUS_TERMINAL_ACCESS',
      'PUBLIC_TRANSPORT_ONLY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'danfo',
  },
  BRT: {
    allowedLanes: [
      'BRT_ONLY',
      'BUS_TERMINAL_ACCESS',
      'BUS_STOP_BAY',
      'PUBLIC_TRANSPORT_ONLY',
      'MERGE_ZONE',
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_RIGHT',
    ],
    forbiddenLanes: ['RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'brt',
  },
  PRIVATE_CAR: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'PUBLIC_TRANSPORT_ONLY', 'BUS_TERMINAL_ACCESS', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'car',
  },
  TAXI: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'BUS_STOP_BAY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'car',
  },
  KEKE: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'BUS_STOP_BAY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'okada',
  },
  OKADA: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'BUS_STOP_BAY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'okada',
  },
  DELIVERY_VAN: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'PUBLIC_TRANSPORT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'car',
  },
  HEAVY_TRUCK: {
    allowedLanes: ['GENERAL_TRAFFIC', 'GENERAL_TRAFFIC_LEFT', 'MERGE_ZONE', 'SERVICE_LANE'],
    forbiddenLanes: ['BRT_ONLY', 'BUS_STOP_BAY', 'PUBLIC_TRANSPORT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'car',
  },
  EMERGENCY_RESCUE: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'BUS_STOP_BAY',
      'BUS_TERMINAL_ACCESS',
      'BRT_ONLY',
      'PUBLIC_TRANSPORT_ONLY',
      'SERVICE_LANE',
      'PARKING_AREA',
      'RESTRICTED_ACCESS',
      'MERGE_ZONE',
    ],
    forbiddenLanes: ['TEMPORARILY_BLOCKED'],
    requiredTransportMode: 'car',
  },
};

export const NODE_PRIMARY_LANE_CLASSIFICATION: Record<string, LagosRoadLaneType> = {
  node_tbs_plaza: 'GENERAL_TRAFFIC',
  node_tbs_garage: 'SERVICE_LANE',
  node_catholic_mission_st: 'GENERAL_TRAFFIC',
  node_odunlami_st: 'GENERAL_TRAFFIC',
  node_broad_st_north: 'GENERAL_TRAFFIC_LEFT',
  node_broad_st_mid: 'GENERAL_TRAFFIC_RIGHT',
  node_broad_st_south: 'GENERAL_TRAFFIC',
  node_cms_bus_park: 'BUS_STOP_BAY',
  node_cms_brt_gate: 'BRT_ONLY',
  node_cms_jetty: 'RESTRICTED_ACCESS',
  node_marina_promenade: 'GENERAL_TRAFFIC',
  node_marina_rail_station: 'RESTRICTED_ACCESS',
  node_outer_marina_loop: 'GENERAL_TRAFFIC_RIGHT',
  node_national_theatre_connector: 'MERGE_ZONE',
  node_fuel_station_marina: 'SERVICE_LANE',
};

export function isLanePermittedForVehicleClass(
  vehicleClass: LagosVehicleClass,
  laneType: LagosRoadLaneType
): boolean {
  const rules = VEHICLE_CLASS_LANE_PERMISSIONS[vehicleClass] || VEHICLE_CLASS_LANE_PERMISSIONS.DANFO;
  if (rules.forbiddenLanes.includes(laneType)) return false;
  return rules.allowedLanes.includes(laneType);
}

/**
 * Route Pathfinder (A* / Dijkstra Algorithm on World Node Graph with M4.9 Lane & Vehicle Class Rules)
 */
export function findShortestPath(
  startNodeId: string,
  endNodeId: string,
  options?: {
    vehicleClass?: LagosVehicleClass;
    blockedNodeIds?: string[];
    blockedEdgeKeys?: string[];
    allowNonRoadModes?: boolean;
  }
): string[] | null {
  if (startNodeId === endNodeId) return [startNodeId];
  if (!MARINA_CMS_NODES[startNodeId] || !MARINA_CMS_NODES[endNodeId]) return null;

  const vehicleClass: LagosVehicleClass = options?.vehicleClass || 'DANFO';
  const rules = VEHICLE_CLASS_LANE_PERMISSIONS[vehicleClass] || VEHICLE_CLASS_LANE_PERMISSIONS.DANFO;
  const blockedNodes = new Set(options?.blockedNodeIds || []);
  const blockedEdges = new Set(options?.blockedEdgeKeys || []);
  const allowNonRoadModes = Boolean(options?.allowNonRoadModes);

  const isNodeTraversable = (nodeId: string): boolean => {
    if (blockedNodes.has(nodeId)) return false;
    const node = MARINA_CMS_NODES[nodeId];
    if (!node) return false;
    if (allowNonRoadModes) return true;
    const laneType = NODE_PRIMARY_LANE_CLASSIFICATION[nodeId] || 'GENERAL_TRAFFIC';
    if (!isLanePermittedForVehicleClass(vehicleClass, laneType)) return false;
    if (!node.transportModes.includes(rules.requiredTransportMode)) {
      // Allow BRT on road nodes that support 'danfo' or 'car' only when not restricted
      if (vehicleClass === 'BRT' && (node.transportModes.includes('brt') || node.transportModes.includes('danfo'))) {
        return true;
      }
      return false;
    }
    return true;
  };

  if (!isNodeTraversable(startNodeId) || !isNodeTraversable(endNodeId)) {
    return null;
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const nodeId of Object.keys(MARINA_CMS_NODES)) {
    if (!isNodeTraversable(nodeId)) continue;
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
    unvisited.add(nodeId);
  }

  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let current: string | null = null;
    let smallestDist = Infinity;

    for (const nodeId of unvisited) {
      if (distances[nodeId] < smallestDist) {
        smallestDist = distances[nodeId];
        current = nodeId;
      }
    }

    if (!current || distances[current] === Infinity) break;
    if (current === endNodeId) {
      const path: string[] = [];
      let step: string | null = current;
      while (step) {
        path.unshift(step);
        step = previous[step];
      }
      return path;
    }

    unvisited.delete(current);
    const currentNode = MARINA_CMS_NODES[current];

    for (const neighborId of currentNode.connections) {
      if (!unvisited.has(neighborId)) continue;
      if (blockedEdges.has(`${current}->${neighborId}`) || blockedEdges.has(`${neighborId}->${current}`)) continue;
      const neighborNode = MARINA_CMS_NODES[neighborId];
      if (!neighborNode) continue;

      const alt = distances[current] + calculateDistance(currentNode.gamePosition, neighborNode.gamePosition);
      if (alt < distances[neighborId]) {
        distances[neighborId] = alt;
        previous[neighborId] = current;
      }
    }
  }

  return null;
}

export function findVehicleRouteWithLaneRules(
  startNodeId: string,
  endNodeId: string,
  vehicleClass: LagosVehicleClass = 'DANFO',
  options?: { blockedNodeIds?: string[]; blockedEdgeKeys?: string[] }
) {
  const path = findShortestPath(startNodeId, endNodeId, {
    vehicleClass,
    blockedNodeIds: options?.blockedNodeIds,
    blockedEdgeKeys: options?.blockedEdgeKeys,
  });
  const visitedLanes = (path || []).map((nId) => ({
    nodeId: nId,
    laneType: NODE_PRIMARY_LANE_CLASSIFICATION[nId] || 'GENERAL_TRAFFIC',
  }));
  const usesBrtOnly = visitedLanes.some((v) => v.laneType === 'BRT_ONLY');
  return {
    ok: Boolean(path && path.length > 0),
    vehicleClass,
    startNodeId,
    endNodeId,
    path,
    visitedLanes,
    usesBrtOnly,
    forbiddenLanesForClass: VEHICLE_CLASS_LANE_PERMISSIONS[vehicleClass].forbiddenLanes,
  };
}

// ==========================================
// M1 WORLD AUTHORING DATA (MARINA/CMS/TBS)
// ==========================================

export interface WorldBuildingDef {
  id: string;
  archetype:
    | 'low_rise_commercial'
    | 'office_block'
    | 'residential_compound'
    | 'mixed_use'
    | 'market_frontage'
    | 'institutional'
    | 'roadside_shop';
  position: WorldVector3;
  width: number;
  height: number;
  depth: number;
  rotationY: number;
  facadeColor: string;
  signageText?: string;
  hasGeePeeWaterTank: boolean;
  hasAirConditioners: boolean;
  hasBalconies: boolean;
  hasGeneratorEnclosure: boolean;
  hasCommercialShutters: boolean;
}

export interface WorldRoadSegment {
  id: string;
  roadName: string;
  roadClass: 'MAIN_ARTERIAL' | 'SECONDARY_ROAD' | 'LOCAL_ROAD' | 'SERVICE_LANE';
  startPos: WorldVector3;
  endPos: WorldVector3;
  widthMeters: number;
  hasOpenGutters: boolean;
  hasPaintedKerbs: boolean; // Black & white Lagos municipal kerbs
  hasPotholes: boolean;
  hasZebraCrossing: boolean;
  hasSpeedBump: boolean;
}

export interface WorldVendorDef {
  id: string;
  name: string;
  vendorType: 'suya_stand' | 'mama_put' | 'plantain_chips' | 'pure_water' | 'kiosk_provisions';
  position: WorldVector3;
  dialogueGreeting: string;
}

export const MARINA_CMS_BUILDINGS: WorldBuildingDef[] = [
  {
    id: 'bld_broad_st_bank_tower',
    archetype: 'office_block',
    position: { x: -65, y: 0, z: -280 },
    width: 28,
    height: 72,
    depth: 32,
    rotationY: 0,
    facadeColor: '#1A2E40', // Deep corporate reflective glass
    signageText: 'FIRST METROPOLITAN BANK',
    hasGeePeeWaterTank: true,
    hasAirConditioners: true,
    hasBalconies: false,
    hasGeneratorEnclosure: true,
    hasCommercialShutters: false,
  },
  {
    id: 'bld_heritage_commercial_court',
    archetype: 'mixed_use',
    position: { x: -65, y: 0, z: -210 },
    width: 24,
    height: 38,
    depth: 26,
    rotationY: 0,
    facadeColor: '#C4B9A3', // 1970s Brazilian/Colonial textured concrete
    signageText: 'CHIEF OLU ENTERPRISES • LEGAL & PHOTOCOPY',
    hasGeePeeWaterTank: true,
    hasAirConditioners: true,
    hasBalconies: true,
    hasGeneratorEnclosure: true,
    hasCommercialShutters: true,
  },
  {
    id: 'bld_marina_plaza_chambers',
    archetype: 'office_block',
    position: { x: -65, y: 0, z: -140 },
    width: 26,
    height: 55,
    depth: 28,
    rotationY: 0,
    facadeColor: '#2B3A4A',
    signageText: 'MARINA COMMERCE CHAMBERS',
    hasGeePeeWaterTank: true,
    hasAirConditioners: true,
    hasBalconies: false,
    hasGeneratorEnclosure: true,
    hasCommercialShutters: false,
  },
  {
    id: 'bld_catholic_mission_shops',
    archetype: 'market_frontage',
    position: { x: -155, y: 0, z: -120 },
    width: 32,
    height: 18,
    depth: 18,
    rotationY: 0.1,
    facadeColor: '#A39281',
    signageText: 'MAMA EJIRO BUKKA & PROVISIONS',
    hasGeePeeWaterTank: true,
    hasAirConditioners: false,
    hasBalconies: true,
    hasGeneratorEnclosure: true,
    hasCommercialShutters: true,
  },
  {
    id: 'bld_tbs_civic_offices',
    archetype: 'institutional',
    position: { x: 45, y: 0, z: -40 },
    width: 36,
    height: 24,
    depth: 24,
    rotationY: -0.15,
    facadeColor: '#E2DCD2',
    signageText: 'LAGOS STATE CIVIC AFFAIRS',
    hasGeePeeWaterTank: true,
    hasAirConditioners: true,
    hasBalconies: false,
    hasGeneratorEnclosure: true,
    hasCommercialShutters: false,
  },
  {
    id: 'bld_cms_ferry_administration',
    archetype: 'low_rise_commercial',
    position: { x: -210, y: 0, z: -270 },
    width: 22,
    height: 14,
    depth: 18,
    rotationY: 0,
    facadeColor: '#4A6274',
    signageText: 'WATERWAYS TRANSIT DESK',
    hasGeePeeWaterTank: true,
    hasAirConditioners: true,
    hasBalconies: false,
    hasGeneratorEnclosure: true,
    hasCommercialShutters: true,
  },
];

export const MARINA_CMS_VENDORS: WorldVendorDef[] = [
  {
    id: 'vnd_suya_cms',
    name: 'Alhaji Musa Suya Spot',
    vendorType: 'suya_stand',
    position: { x: -115, y: 0, z: -180 },
    dialogueGreeting: 'Oga driver! Hot pepper suya dey with onion!',
  },
  {
    id: 'vnd_mama_put_broad',
    name: 'Mama Nkechi Canteen',
    vendorType: 'mama_put',
    position: { x: -85, y: 0, z: -240 },
    dialogueGreeting: 'Welcome o! Amala, pounded yam, hot fish!',
  },
  {
    id: 'vnd_plantain_chips_tbs',
    name: 'Brother Sunday Hawkers',
    vendorType: 'plantain_chips',
    position: { x: -20, y: 0, z: -10 },
    dialogueGreeting: 'Ripe plantain chips! Cold pure water!',
  },
];

// ==========================================
// M3 CANONICAL WORLD REGISTRY (PHASE 1, 5, 6, 9)
// Single Source of Truth across EkoAtlas, EkoPlaces,
// EkoPhone, Street-Level 3D World, EkoMedia & EkoProperties
// ==========================================

export const REQUIRED_CANONICAL_ENTITY_TYPES: CanonicalEntityType[] = [
  'district',
  'road',
  'junction',
  'transport_stop',
  'rail_station',
  'ferry_terminal',
  'landmark',
  'building',
  'business',
  'virtual_property_parcel',
  'player_owned_property',
  'billboard',
  'advertising_placement',
  'job_location',
  'mission_point',
  'event_venue',
  'vehicle_depot',
  'garage',
  'market',
  'residential_estate',
  'restricted_region',
];

export const CANONICAL_WORLD_ENTITIES: CanonicalWorldEntity[] = [
  // 1. DISTRICTS (Playable, Planned, Locked)
  {
    id: 'dist_lagos_island_marina_cms',
    aliases: ['lagos_island', 'marina_cms_tbs', 'district_marina'],
    entityType: 'district',
    placeCategory: 'Landmarks',
    displayName: 'Marina, Broad Street & CMS Corridor',
    subtitle: 'Active Playable District • Lagos Island Financial & Transit Core',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4515, lng: 3.3945, address: 'Marina / Broad Street, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -96, y: 0, z: -120 },
    graphNodeId: 'node_broad_st_mid',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'district_mesh_marina_cms_active',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 800, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_view_district', label: 'Explore District', actionType: 'VIEW_DETAILS' },
      { actionId: 'act_nav_district', label: 'Navigate to Center', actionType: 'NAVIGATE', targetId: 'dist_lagos_island_marina_cms' },
    ],
    ownershipState: { ownerId: 'state_lagos', ownerName: 'Lagos State Municipal Authority', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Project Eko Cartography',
      license: 'ODbL-1.0 / Original Stylised 3D Adaptation',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Real street topology adapted to stylised Project Eko metric space; no third-party proprietary map tiles used.',
    },
    tags: ['marina', 'cms', 'broad street', 'tbs', 'lagos island', 'playable', 'district'],
  },
  {
    id: 'dist_obalende_ikoyi_link',
    aliases: ['obalende', 'ikoyi_junction', 'district_obalende'],
    entityType: 'district',
    placeCategory: 'Landmarks',
    displayName: 'Obalende & Ikoyi Transit Link',
    subtitle: 'Planned Expansion District • Eastern Island Commuter Interchange',
    districtId: 'dist_obalende_ikoyi_link',
    geoReference: { lat: 6.4492, lng: 3.4125, address: 'Obalende Roundabout, Ikoyi', lga: 'Eti-Osa / Lagos Island' },
    gamePosition: { x: 40, y: 0, z: 85 },
    graphNodeId: 'node_king_george_v',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'atlas_overview_obalende_25d',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 450, streamPolicy: 'ATLAS_OVERVIEW_ONLY', detailTier: 'STYLIZED_25D' },
    availabilityState: 'PLANNED',
    interactions: [{ actionId: 'act_view_obalende', label: 'View Planned Roadmap', actionType: 'VIEW_DETAILS' }],
    ownershipState: { ownerId: 'state_lagos', ownerName: 'Lagos State Municipal Authority', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL)',
      license: 'ODbL-1.0',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Planned district shown in stylised 2.5D overview only; high-detail 3D assets not streamed until unlocked.',
    },
    tags: ['obalende', 'ikoyi', 'planned', 'expansion', 'district'],
  },
  {
    id: 'dist_victoria_island_annex',
    aliases: ['victoria_island', 'vi_annex', 'district_vi'],
    entityType: 'district',
    placeCategory: 'Landmarks',
    displayName: 'Victoria Island Financial Annex',
    subtitle: 'Planned Expansion District • Corporate & Coastal Commercial Zone',
    districtId: 'dist_victoria_island_annex',
    geoReference: { lat: 6.4281, lng: 3.4219, address: 'Ahmadu Bello Way / Adeola Odeku, VI', lga: 'Eti-Osa LGA' },
    gamePosition: { x: -25, y: 0, z: -42 },
    graphNodeId: 'node_tbs_plaza',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'atlas_overview_vi_25d',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 450, streamPolicy: 'ATLAS_OVERVIEW_ONLY', detailTier: 'STYLIZED_25D' },
    availabilityState: 'PLANNED',
    interactions: [{ actionId: 'act_view_vi', label: 'View Planned District', actionType: 'VIEW_DETAILS' }],
    ownershipState: { ownerId: 'state_lagos', ownerName: 'Lagos State Municipal Authority', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL)',
      license: 'ODbL-1.0',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Planned district boundary; detailed geometry deferred per mobile LOD budget.',
    },
    tags: ['victoria island', 'vi', 'planned', 'corporate', 'district'],
  },
  {
    id: 'reg_eko_atlantic_future_zone',
    aliases: ['eko_atlantic', 'restricted_coastal_zone'],
    entityType: 'restricted_region',
    placeCategory: 'Landmarks',
    displayName: 'Eko Atlantic Coastal Reclamation Zone',
    subtitle: 'Locked Future-Development Region • Phase M4 Coastal Expansion',
    districtId: 'reg_eko_atlantic_future_zone',
    geoReference: { lat: 6.4140, lng: 3.4090, address: 'South Atlantic Seawall Corridor', lga: 'Eti-Osa LGA' },
    gamePosition: { x: -165, y: 0, z: 110 },
    graphNodeId: 'node_tbs_plaza',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'atlas_boundary_locked_coastal',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 300, streamPolicy: 'ATLAS_OVERVIEW_ONLY', detailTier: 'REGION_BOUNDARY' },
    availabilityState: 'LOCKED',
    interactions: [{ actionId: 'act_view_locked_zone', label: 'Inspect Locked Region Info', actionType: 'VIEW_DETAILS' }],
    ownershipState: { ownerId: 'dev_authority', ownerName: 'Coastal Development Authority', tenancyStatus: 'PUBLIC' },
    provenance: {
      category: 'PROTECTED_REAL_WORLD_LIKENESS_EXCLUDED',
      sourceAttribution: 'Original Project Eko Fictionalised Future Zone',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Protected private architectural likenesses excluded; marked clearly as a locked future region.',
    },
    tags: ['locked', 'restricted', 'future development', 'coastal', 'eko atlantic'],
  },

  // 2. ROAD & JUNCTION ENTITIES
  {
    id: 'road_broad_street_arterial',
    aliases: ['broad_street', 'marina_expressway', 'road_main_corridor'],
    entityType: 'road',
    placeCategory: 'Infrastructure',
    displayName: 'Broad Street & Marina Dual Carriageway',
    subtitle: '4-Lane Primary Arterial • Speed Limit 60 km/h • Black/White Municipal Kerbs',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4512, lng: 3.3958, address: 'Broad Street, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -98, y: 0.05, z: -110 },
    graphNodeId: 'node_broad_st_mid',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 25.5, y: 1, z: 480 },
    worldAssetRef: 'road_broad_st_carriageway',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 600, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_view_road', label: 'View Corridor Telemetry', actionType: 'VIEW_DETAILS' },
      { actionId: 'act_nav_road', label: 'Navigate to Broad Street', actionType: 'NAVIGATE', targetId: 'road_broad_street_arterial' },
    ],
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Project Eko Road Network',
      license: 'ODbL-1.0',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Historical Lagos Island arterial alignment represented with original procedural PBR asphalt.',
    },
    tags: ['road', 'broad street', 'marina', 'highway', 'arterial'],
  },
  {
    id: 'junc_catholic_mission_cross',
    aliases: ['node_catholic_mission_st', 'catholic_mission_junction', 'cross_avenue_junction'],
    entityType: 'junction',
    placeCategory: 'Infrastructure',
    displayName: 'Catholic Mission Street & Broad St Junction',
    subtitle: 'Signalised 4-Way Urban Intersection & Pedestrian Zebra Crossing',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4485, lng: 3.3985, address: 'Catholic Mission St / Broad St', lga: 'Lagos Island LGA' },
    gamePosition: { x: -96, y: 0.05, z: 0 },
    graphNodeId: 'node_catholic_mission_st',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'junction_cross_avenue_0',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 400, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_view_junction', label: 'View Junction Status', actionType: 'VIEW_DETAILS' },
      { actionId: 'act_nav_junction', label: 'Navigate to Junction', actionType: 'NAVIGATE', targetId: 'junc_catholic_mission_cross' },
    ],
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL)',
      license: 'ODbL-1.0',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Verified Lagos Island intersection name and relative topology.',
    },
    tags: ['junction', 'intersection', 'catholic mission', 'zebra crossing', 'traffic'],
  },

  // 3. TRANSPORT STOPS, RAIL STATION & FERRY TERMINAL
  {
    id: 'stop_cms_bus_terminal',
    aliases: ['ent_cms_bus_terminal', 'cms_terminal', 'node_cms_bus_park', 'cms', 'shelter_cms_terminal', 'node_cms_brt_gate'],
    entityType: 'transport_stop',
    placeCategory: 'Transport',
    displayName: 'CMS Bus Terminal & Danfo Park',
    subtitle: 'Primary Commuter Hub • Danfo, EkoBRT & Keke Boarding Bay (Fare: ₦300 GN)',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4541, lng: 3.3908, address: 'CMS Outer Marina, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -110.2, y: 0.05, z: -200 },
    graphNodeId: 'node_cms_bus_park',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'shelter_cms_terminal',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    scheduleInfo: 'Every 2 mins • Routes: CMS -> Broad St -> TBS Express (₦300 GN) & Danfo Hustle Arcade',
    interactions: [
      { actionId: 'act_nav_cms', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'stop_cms_bus_terminal' },
      { actionId: 'act_sched_cms', label: 'View Route & Schedule', actionType: 'VIEW_SCHEDULE', targetId: 'route_cms_commuter' },
      { actionId: 'act_board_cms', label: 'Board Commuters [SPACE]', actionType: 'INTERACT_WORLD', targetId: 'stop_cms_bus_terminal', triggerRadiusM: 10, requiresVehicle: true },
      { actionId: 'act_mission_cms', label: 'Accept CMS-TBS Dispatch', actionType: 'ACCEPT_MISSION', targetId: 'mis_cms_to_tbs' },
    ],
    ownershipState: { ownerId: 'lamata_transit', ownerName: 'Lagos Metropolitan Area Transport Authority (Virtual)', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Original Project Eko Shelter Mesh',
      license: 'ODbL-1.0 / Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Geographic location based on CMS Marina transit hub; 3D shelter and signage are 100% original Project Eko assets.',
    },
    tags: ['cms', 'bus stop', 'terminal', 'danfo', 'brt', 'transport', 'commuter', 'pickup'],
  },
  {
    id: 'stop_broad_street_central',
    aliases: ['broad_st_mid', 'node_broad_st_mid', 'shelter_broad_st_mid'],
    entityType: 'transport_stop',
    placeCategory: 'Transport',
    displayName: 'Broad Street Central Bus Stop',
    subtitle: 'Mid-Corridor Banking & Market Commuter Bay (Fare: ₦250 GN)',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4508, lng: 3.3958, address: 'Broad Street Mid-Block, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -88.5, y: 0.05, z: -90 },
    graphNodeId: 'node_broad_st_mid',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'shelter_broad_st_mid',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 450, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    scheduleInfo: 'Every 3 mins • Serves Broad Street Financial Towers, Segun Auto Clinic & Balogun Market',
    interactions: [
      { actionId: 'act_nav_broad_stop', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'stop_broad_street_central' },
      { actionId: 'act_sched_broad_stop', label: 'View Route & Schedule', actionType: 'VIEW_SCHEDULE', targetId: 'route_cms_commuter' },
      { actionId: 'act_board_broad_stop', label: 'Board Commuters [SPACE]', actionType: 'INTERACT_WORLD', targetId: 'stop_broad_street_central', triggerRadiusM: 10, requiresVehicle: true },
    ],
    ownershipState: { ownerId: 'lamata_transit', ownerName: 'LAMATA Virtual Transit', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Original Project Eko Shelter Mesh',
      license: 'ODbL-1.0 / Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original stylised 3D commuter shelter placed along Broad Street.',
    },
    tags: ['broad street', 'bus stop', 'transport', 'commuter', 'banking'],
  },
  {
    id: 'stop_tbs_plaza_loop',
    aliases: ['tbs_loop', 'shelter_tbs_loop', 'tbs_bus_stop'],
    entityType: 'transport_stop',
    placeCategory: 'Transport',
    displayName: 'Tafawa Balewa Square (TBS) Terminus Loop',
    subtitle: 'Northern Ceremonial Terminus & Passenger Drop-Off Bay (Fare: ₦350 GN)',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4474, lng: 3.4015, address: 'TBS Racecourse Loop, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -110.2, y: 0.05, z: 45 },
    graphNodeId: 'node_tbs_plaza',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'shelter_tbs_loop',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    scheduleInfo: 'Every 2 mins • Terminus for CMS-TBS Express & Obalende Connector',
    interactions: [
      { actionId: 'act_nav_tbs_stop', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'stop_tbs_plaza_loop' },
      { actionId: 'act_sched_tbs_stop', label: 'View Route & Schedule', actionType: 'VIEW_SCHEDULE', targetId: 'route_cms_commuter' },
      { actionId: 'act_board_tbs_stop', label: 'Board / Disembark [SPACE]', actionType: 'INTERACT_WORLD', targetId: 'stop_tbs_plaza_loop', triggerRadiusM: 10, requiresVehicle: true },
    ],
    ownershipState: { ownerId: 'lamata_transit', ownerName: 'LAMATA Virtual Transit', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Original Project Eko Shelter Mesh',
      license: 'ODbL-1.0 / Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Verified TBS transit terminus location with original 3D shelter.',
    },
    tags: ['tbs', 'bus stop', 'terminus', 'transport', 'dropoff'],
  },
  {
    id: 'rail_marina_blue_line_station',
    aliases: ['node_marina_rail_station', 'elevatedTrainMesh', 'marina_rail'],
    entityType: 'rail_station',
    placeCategory: 'Transport',
    displayName: 'Marina Blue Line Elevated Rail Station',
    subtitle: 'Elevated Electric Light-Rail Viaduct & Waterfront Concourse',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4520, lng: 3.3900, address: 'Marina Waterfront Viaduct, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -132, y: 0.22, z: -200 },
    graphNodeId: 'node_marina_rail_station',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'elevatedTrainMesh',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 600, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    scheduleInfo: 'Every 4 mins • Marina <-> National Theatre <-> Mile 2 Electric Rail Line',
    interactions: [
      { actionId: 'act_nav_rail', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'rail_marina_blue_line_station' },
      { actionId: 'act_sched_rail', label: 'View Rail Schedule', actionType: 'VIEW_SCHEDULE', targetId: 'rail_marina_blue_line_station' },
    ],
    ownershipState: { ownerId: 'lamata_rail', ownerName: 'Lagos Rail Mass Transit (Virtual)', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Original Project Eko Viaduct 3D Mesh',
      license: 'ODbL-1.0 / Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Inspired by the Marina elevated rail alignment; train and viaduct are original procedural 3D models.',
    },
    tags: ['rail', 'train', 'blue line', 'marina', 'transport', 'station'],
  },
  {
    id: 'ferry_cms_lagoon_terminal',
    aliases: ['node_cms_jetty', 'cms_ferry', 'marina_jetty'],
    entityType: 'ferry_terminal',
    placeCategory: 'Transport',
    displayName: 'CMS Marina Lagoon Ferry Terminal',
    subtitle: 'Waterways Passenger Jetty • Boats to Apapa, Victoria Island & Ikorodu',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4535, lng: 3.3895, address: 'Marina Seawall Promenade, CMS', lga: 'Lagos Island LGA' },
    gamePosition: { x: -135, y: 0.22, z: -235 },
    graphNodeId: 'node_cms_jetty',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'bound_west_lagoon_seawall',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    scheduleInfo: 'Every 15 mins • Water Taxi to Apapa Port, Falomo Jetty & Ikorodu Terminal',
    interactions: [
      { actionId: 'act_nav_ferry', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'ferry_cms_lagoon_terminal' },
      { actionId: 'act_sched_ferry', label: 'View Ferry Schedule', actionType: 'VIEW_SCHEDULE', targetId: 'route_marina_waterfront' },
    ],
    ownershipState: { ownerId: 'laswa_waterways', ownerName: 'Lagos Waterways Authority (Virtual)', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Original Project Eko Seawall',
      license: 'ODbL-1.0 / Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Ferry terminal position along Lagos Lagoon seawall.',
    },
    tags: ['ferry', 'jetty', 'boat', 'lagoon', 'waterways', 'cms', 'transport'],
  },

  // 4. LANDMARKS & BUILDINGS
  {
    id: 'lmk_tbs_ceremonial_arch',
    aliases: ['tbs', 'node_tbs_plaza', 'tbs_arch_compound', 'bldg_tbs_complex'],
    entityType: 'landmark',
    placeCategory: 'Landmarks',
    displayName: 'Tafawa Balewa Square (TBS) Ceremonial Arch',
    subtitle: 'Historic National Monument, Civic Arena & EkoRide Destination Hub',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4474, lng: 3.4015, address: 'Tafawa Balewa Square, Racecourse, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -96, y: 0.05, z: 45 },
    graphNodeId: 'node_tbs_plaza',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'tbs_arch_compound',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 750, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_tbs', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'lmk_tbs_ceremonial_arch' },
      { actionId: 'act_details_tbs', label: 'View Landmark Details', actionType: 'VIEW_DETAILS', targetId: 'lmk_tbs_ceremonial_arch' },
      { actionId: 'act_interact_tbs', label: 'Complete TBS Dropoff', actionType: 'INTERACT_WORLD', targetId: 'lmk_tbs_ceremonial_arch', triggerRadiusM: 8 },
    ],
    ownershipState: { ownerId: 'civic_trust', ownerName: 'National Civic Monument Trust', tenancyStatus: 'PUBLIC' },
    provenance: {
      category: 'PROTECTED_REAL_WORLD_LIKENESS_EXCLUDED',
      sourceAttribution: 'Original Project Eko Stylised Ceremonial Archway',
      license: 'Project Eko Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Stylised civic archway inspired by Lagos Island monumental gates; commercial branding is strictly prohibited on this protected landmark.',
    },
    tags: ['tbs', 'tafawa balewa square', 'landmark', 'arch', 'monument', 'civic', 'destination'],
  },
  {
    id: 'lmk_marina_heritage_cathedral',
    aliases: ['bldg_cathedral_church', 'bldg_east_200', 'cathedral'],
    entityType: 'landmark',
    placeCategory: 'Landmarks',
    displayName: 'Marina Heritage Cathedral & Belfry',
    subtitle: 'Historic Lagos Island Stone Cathedral & Clocktower Landmark',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4525, lng: 3.3912, address: '29 Marina Road, CMS, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -56, y: 0, z: -200 },
    graphNodeId: 'node_cms_bus_park',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'bldg_east_200',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 650, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_cathedral', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'lmk_marina_heritage_cathedral' },
      { actionId: 'act_details_cathedral', label: 'View Heritage History', actionType: 'VIEW_DETAILS', targetId: 'lmk_marina_heritage_cathedral' },
    ],
    ownershipState: { ownerId: 'heritage_diocese', ownerName: 'Marina Heritage Trust', tenancyStatus: 'PUBLIC' },
    provenance: {
      category: 'PROTECTED_REAL_WORLD_LIKENESS_EXCLUDED',
      sourceAttribution: 'Original Project Eko Stylised Heritage Architecture',
      license: 'Project Eko Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Protected heritage landmark; exempt from commercial sponsorship overlays.',
    },
    tags: ['cathedral', 'marina', 'heritage', 'landmark', 'cms'],
  },
  {
    id: 'bldg_first_metropolitan_tower',
    aliases: ['bld_broad_st_bank_tower', 'bldg_east_280', 'bldg_zenith_marina'],
    entityType: 'building',
    placeCategory: 'Landmarks',
    displayName: 'First Metropolitan Bank Tower',
    subtitle: '22-Storey Curtain-Wall Financial Skyscraper on Broad Street',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4530, lng: 3.3922, address: 'Broad Street Financial Core, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -56, y: 0, z: -280 },
    graphNodeId: 'node_broad_st_north',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'bldg_east_280',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 550, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_bank_tower', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'bldg_first_metropolitan_tower' },
      { actionId: 'act_open_ekobank', label: 'Open EkoBank Ledger', actionType: 'OPEN_APP', targetId: 'rewards' },
    ],
    ownershipState: { ownerId: 'corp_first_metro', ownerName: 'First Metropolitan Financial Group (Fictional)', tenancyStatus: 'NPC_OPERATED' },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Architectural Studio',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original fictional bank brand and procedural curtain-wall skyscraper.',
    },
    tags: ['building', 'skyscraper', 'bank', 'broad street', 'tower'],
  },

  // 5. BUSINESSES, PLAYER-OWNED PROPERTIES, MARKETS, DEPOTS & GARAGES
  {
    id: 'biz_suya_haruna',
    aliases: ['vendor_suya_grill', 'trigger_suya_stand', 'vnd_suya_cms', 'suya_stand'],
    entityType: 'player_owned_property',
    placeCategory: 'Player Businesses',
    displayName: "Mallam Haruna's Night Suya Franchise",
    subtitle: 'Player-Owned Street Food Concession • Generates ₦800 GN/hr • Wholesale Delivery & Retail',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4538, lng: 3.3915, address: 'CMS East Sidewalk, Broad Street Approach', lga: 'Lagos Island LGA' },
    gamePosition: { x: -80, y: 0.22, z: -212 },
    graphNodeId: 'node_cms_bus_park',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'vendor_suya_grill',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 450, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_suya', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'biz_suya_haruna' },
      { actionId: 'act_interact_suya', label: 'Buy Suya (₦500) / Unload Cargo [E]', actionType: 'INTERACT_WORLD', targetId: 'biz_suya_haruna', triggerRadiusM: 6.5 },
      { actionId: 'act_open_biz_suya', label: 'Open EkoCommerce Interface', actionType: 'OPEN_BUSINESS', targetId: 'biz_suya_haruna' },
    ],
    ownershipState: {
      ownerId: 'player_amaka',
      ownerName: 'Amaka Driver (Player)',
      tenancyStatus: 'PLAYER_OWNED',
      linkedBusinessId: 'biz_suya_haruna',
      linkedParcelId: 'parcel_cms_suya_plot_01',
    },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Street Commerce Library',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original fictional street food business and 3D grill stall.',
    },
    tags: ['suya', 'food', 'player business', 'owned', 'cms', 'haruna', 'restaurant'],
  },
  {
    id: 'biz_bukka_nkechi',
    aliases: ['biz_marina_bukka', 'vendor_bukka_counter', 'vnd_mama_put_broad', 'bukka'],
    entityType: 'business',
    placeCategory: 'Food',
    displayName: "Mama Nkechi's Marina Bukka & Canteen",
    subtitle: 'Traditional Lagos Mama-Put Canteen • Concession Permit: ₦80,000 GN (Yield: ₦1,450/hr)',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4532, lng: 3.3920, address: 'Broad Street East Walkway, Near CMS', lga: 'Lagos Island LGA' },
    gamePosition: { x: -80, y: 0.22, z: -196 },
    graphNodeId: 'node_broad_st_north',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'vendor_bukka_counter',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 450, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_bukka', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'biz_bukka_nkechi' },
      { actionId: 'act_open_biz_bukka', label: 'Open Business & Concession Permit', actionType: 'OPEN_BUSINESS', targetId: 'biz_bukka_nkechi' },
      { actionId: 'act_visit_parcel_bukka', label: 'Visit Virtual Property Parcel', actionType: 'VISIT_PROPERTY', targetId: 'parcel_marina_bukka_plot_02' },
    ],
    ownershipState: {
      ownerId: 'npc_mama_nkechi',
      ownerName: 'Mama Nkechi Culinary Enterprise',
      tenancyStatus: 'LEASEHOLD_ELIGIBLE',
      linkedBusinessId: 'biz_bukka_nkechi',
      linkedParcelId: 'parcel_marina_bukka_plot_02',
    },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Street Commerce Library',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original fictional canteen business.',
    },
    tags: ['bukka', 'food', 'mama put', 'jollof', 'amala', 'business', 'concession', 'nkechi'],
  },
  {
    id: 'mkt_balogun_wholesale_depot',
    aliases: ['depot', 'biz_parts_balogun', 'biz_balogun_parts', 'infra_balogun_depot_building', 'node_balogun_edge'],
    entityType: 'market',
    placeCategory: 'Retail',
    displayName: 'Balogun Market Wholesale & Auto Parts Depot',
    subtitle: 'West Africa Trade Hub • Wholesale Cargo Loading (+₦1,800 GN) & Haggling Mini-Game [Q]',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4558, lng: 3.3895, address: 'Balogun / Breadfruit Approach, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -80, y: 0.22, z: -175 },
    graphNodeId: 'node_balogun_edge',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'infra_balogun_depot_building',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_depot', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'mkt_balogun_wholesale_depot' },
      { actionId: 'act_interact_depot', label: 'Load Cargo [E] / Bargain [Q]', actionType: 'INTERACT_WORLD', targetId: 'mkt_balogun_wholesale_depot', triggerRadiusM: 8.5 },
      { actionId: 'act_open_biz_depot', label: 'Open Wholesale Concession Interface', actionType: 'OPEN_BUSINESS', targetId: 'mkt_balogun_wholesale_depot' },
    ],
    ownershipState: {
      ownerId: 'npc_madam_sikira',
      ownerName: 'Balogun Traders Association (Madam Sikira)',
      tenancyStatus: 'LEASEHOLD_ELIGIBLE',
      linkedBusinessId: 'biz_parts_balogun',
      linkedParcelId: 'parcel_balogun_depot_plot_03',
    },
    provenance: {
      category: 'GEOGRAPHIC_FACT',
      sourceAttribution: 'OpenStreetMap Contributors (ODbL) & Original Project Eko Depot Mesh',
      license: 'ODbL-1.0 / Original 3D Asset',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Inspired by historic Balogun Market district on Lagos Island; uses original fictional traders and 3D assets.',
    },
    tags: ['market', 'balogun', 'retail', 'depot', 'cargo', 'wholesale', 'auto parts', 'bargain'],
  },
  {
    id: 'depot_eko_energy_station',
    aliases: ['filling_station', 'infra_total_store', 'node_fuel_station_marina', 'fuel_station'],
    entityType: 'vehicle_depot',
    placeCategory: 'Infrastructure',
    displayName: 'EkoEnergy Marina Filling Station & Fleet Depot',
    subtitle: '24/7 PMS Fuel Forecourt (₦110 GN/L) & Commercial Fleet Dispatch Bay',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4522, lng: 3.3942, address: 'Broad Street / Marina Service Forecourt', lga: 'Lagos Island LGA' },
    gamePosition: { x: -78, y: 0.22, z: -140 },
    graphNodeId: 'node_broad_st_mid',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'infra_total_store',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_station', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'depot_eko_energy_station' },
      { actionId: 'act_refuel_station', label: 'Refuel Vehicle [E] (₦110 GN/L)', actionType: 'INTERACT_WORLD', targetId: 'depot_eko_energy_station', triggerRadiusM: 10 },
      { actionId: 'act_open_fleet_app', label: 'Open EkoFleet Dispatch', actionType: 'OPEN_APP', targetId: 'fleet' },
    ],
    ownershipState: { ownerId: 'corp_eko_energy', ownerName: 'EkoEnergy Petroleum Plc (Fictional)', tenancyStatus: 'NPC_OPERATED' },
    provenance: {
      category: 'FICTIONAL_COMMERCIAL_BRAND',
      sourceAttribution: 'Project Eko Original Brand System',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Fictional energy station and fleet depot; does not claim affiliation with real-world petroleum companies.',
    },
    tags: ['fuel', 'filling station', 'petrol', 'vehicle depot', 'fleet', 'refuel'],
  },
  {
    id: 'gar_segun_auto_clinic',
    aliases: ['mechanic_workshop', 'infra_mechanic_workshop', 'node_tbs_garage', 'segun_garage'],
    entityType: 'garage',
    placeCategory: 'Garages',
    displayName: 'Segun Auto Clinic & Berger Showroom Annex',
    subtitle: 'Full Chassis Overhaul (₦2,200 GN), Engine Calibration Mini-Game [Q] & Vehicle Summon Garage',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4495, lng: 3.3975, address: '70 Broad Street East Forecourt, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -78, y: 0.22, z: -70 },
    graphNodeId: 'node_broad_st_south',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'infra_mechanic_workshop',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_garage', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'gar_segun_auto_clinic' },
      { actionId: 'act_service_garage', label: 'Service Vehicle [E] / Tune Engine [Q]', actionType: 'INTERACT_WORLD', targetId: 'gar_segun_auto_clinic', triggerRadiusM: 10 },
      { actionId: 'act_open_dealership', label: 'Open Berger Auto Dealership & Garage', actionType: 'OPEN_APP', targetId: 'dealership' },
    ],
    ownershipState: { ownerId: 'npc_segun_mech', ownerName: 'Master Segun Auto Engineering', tenancyStatus: 'NPC_OPERATED' },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Automotive Workshop Library',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original fictional mechanic workshop and dealership annex.',
    },
    tags: ['garage', 'mechanic', 'dealership', 'repair', 'segun', 'berger auto', 'vehicles'],
  },

  // 6. VIRTUAL PROPERTY PARCELS (PHASE 6 EKOPROPERTIES)
  {
    id: 'parcel_broad_st_corner_plot_04',
    aliases: ['parcel_04', 'virtual_plot_broad_st'],
    entityType: 'virtual_property_parcel',
    placeCategory: 'Properties',
    displayName: 'Broad Street Financial Corner Parcel (Plot #04)',
    subtitle: 'Eligible Virtual Commercial Parcel • 140 sqm • Acquire for ₦95,000 GN',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4501, lng: 3.3968, address: 'Plot 04 Broad Street East Walkway', lga: 'Lagos Island LGA' },
    gamePosition: { x: -76, y: 0.22, z: -115 },
    graphNodeId: 'node_broad_st_mid',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'parcel_marker_plot_04',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 400, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_parcel_04', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'parcel_broad_st_corner_plot_04' },
      { actionId: 'act_visit_parcel_04', label: 'Visit Virtual Property', actionType: 'VISIT_PROPERTY', targetId: 'parcel_broad_st_corner_plot_04' },
      { actionId: 'act_open_prop_04', label: 'Open EkoProperties Deed Desk', actionType: 'OPEN_APP', targetId: 'properties' },
    ],
    ownershipState: {
      ownerId: 'eko_land_registry',
      ownerName: 'Project Eko Virtual Land Registry',
      tenancyStatus: 'LEASEHOLD_ELIGIBLE',
      linkedParcelId: 'parcel_broad_st_corner_plot_04',
    },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Virtual Registry',
      license: 'Project Eko Original IP (Virtual Game Rights Only)',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Strictly a virtual in-game development parcel; confers zero real-world land ownership or legal title.',
    },
    tags: ['property', 'parcel', 'real estate', 'virtual plot', 'broad street', 'build'],
  },
  {
    id: 'parcel_marina_promenade_plot_05',
    aliases: ['parcel_05', 'virtual_plot_marina_waterfront'],
    entityType: 'virtual_property_parcel',
    placeCategory: 'Properties',
    displayName: 'Marina Waterfront Kiosk Parcel (Plot #05)',
    subtitle: 'Eligible Virtual Waterfront Parcel • 110 sqm • Acquire for ₦68,000 GN',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4518, lng: 3.3918, address: 'Plot 05 West Marina Lagoon Promenade', lga: 'Lagos Island LGA' },
    gamePosition: { x: -120, y: 0.22, z: -165 },
    graphNodeId: 'node_marina_promenade',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'parcel_marker_plot_05',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 400, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_parcel_05', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'parcel_marina_promenade_plot_05' },
      { actionId: 'act_visit_parcel_05', label: 'Visit Virtual Property', actionType: 'VISIT_PROPERTY', targetId: 'parcel_marina_promenade_plot_05' },
      { actionId: 'act_open_prop_05', label: 'Open EkoProperties Deed Desk', actionType: 'OPEN_APP', targetId: 'properties' },
    ],
    ownershipState: {
      ownerId: 'eko_land_registry',
      ownerName: 'Project Eko Virtual Land Registry',
      tenancyStatus: 'LEASEHOLD_ELIGIBLE',
      linkedParcelId: 'parcel_marina_promenade_plot_05',
    },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Virtual Registry',
      license: 'Project Eko Original IP (Virtual Game Rights Only)',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Strictly a virtual in-game development parcel; confers zero real-world land ownership.',
    },
    tags: ['property', 'parcel', 'marina', 'waterfront', 'kiosk', 'build'],
  },

  // 7. BILLBOARDS & ADVERTISING PLACEMENTS (PHASE 5 EKOMEDIA)
  {
    id: 'media_billboard_broad_st_east',
    aliases: ['billboard_east_150', 'slot_bb_broad_east'],
    entityType: 'billboard',
    placeCategory: 'Entertainment',
    displayName: 'Broad Street East Digital Super-Unipole (#BB-01)',
    subtitle: 'Approved LASAA Virtual Digital Billboard • 12m × 4m • Sponsored Creative Active',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4520, lng: 3.3948, address: 'Broad Street East Kerbline (-150m)', lga: 'Lagos Island LGA' },
    gamePosition: { x: -66, y: 12, z: -150 },
    graphNodeId: 'node_broad_st_mid',
    rotation: { x: 0, y: -0.25, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'eko_media_mesh_bb_east_150',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_bb_east', label: 'Navigate to Placement', actionType: 'NAVIGATE', targetId: 'media_billboard_broad_st_east' },
      { actionId: 'act_manage_bb_east', label: 'Manage Campaign in EkoMedia', actionType: 'MANAGE_MEDIA', targetId: 'slot_bb_broad_east' },
    ],
    ownershipState: { ownerId: 'lasaa_virtual', ownerName: 'EkoMedia Outdoor Registry', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'FICTIONAL_COMMERCIAL_BRAND',
      sourceAttribution: 'Project Eko EkoMedia Ad Studio',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Displays only approved original fictional advertiser creatives with explicit SPONSORED disclosure.',
    },
    tags: ['billboard', 'advertising', 'media', 'sponsored', 'broad street', 'digital'],
  },
  {
    id: 'media_placement_marina_west_gantry',
    aliases: ['billboard_west_80', 'slot_bb_marina_west', 'gantry_highway_broad_st'],
    entityType: 'advertising_placement',
    placeCategory: 'Entertainment',
    displayName: 'Marina Promenade Acoustic & Radio Gantry (#AD-02)',
    subtitle: 'Approved Roadside & Terminal Placement • Radio Eko 99.3 FM & ZoboFresh',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4505, lng: 3.3960, address: 'Marina West Promenade (-80m)', lga: 'Lagos Island LGA' },
    gamePosition: { x: -118, y: 11, z: -80 },
    graphNodeId: 'node_broad_st_south',
    rotation: { x: 0, y: 0.25, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'eko_media_mesh_bb_west_80',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 500, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_bb_west', label: 'Navigate to Placement', actionType: 'NAVIGATE', targetId: 'media_placement_marina_west_gantry' },
      { actionId: 'act_manage_bb_west', label: 'Manage Campaign in EkoMedia', actionType: 'MANAGE_MEDIA', targetId: 'slot_bb_marina_west' },
    ],
    ownershipState: { ownerId: 'lasaa_virtual', ownerName: 'EkoMedia Outdoor Registry', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'FICTIONAL_COMMERCIAL_BRAND',
      sourceAttribution: 'Project Eko EkoMedia Ad Studio',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Displays approved fictional Radio Eko 99.3 FM & ZoboFresh creatives.',
    },
    tags: ['advertising', 'placement', 'radio eko', 'media', 'marina', 'sponsored'],
  },

  // 8. JOB LOCATIONS, MISSION POINTS & EVENT VENUES
  {
    id: 'job_lasdri_career_hub',
    aliases: ['lasdri', 'jobs_hub', 'cdl_exam_center'],
    entityType: 'job_location',
    placeCategory: 'Jobs',
    displayName: 'LASDRI Driver Certification & Career Hub',
    subtitle: 'Commercial Driving License (CDL) Exam (+₦2,000 GN), Conductor Co-Op & Skill Jobs',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4488, lng: 3.3992, address: 'Broad Street South Civic Annex', lga: 'Lagos Island LGA' },
    gamePosition: { x: -82, y: 0.22, z: -35 },
    graphNodeId: 'node_broad_st_south',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'bldg_east_035',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 450, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_lasdri', label: 'Navigate', actionType: 'NAVIGATE', targetId: 'job_lasdri_career_hub' },
      { actionId: 'act_open_jobs', label: 'Open Jobs & CDL Exam Hub', actionType: 'OPEN_APP', targetId: 'jobs' },
      { actionId: 'act_accept_job_shuttle', label: 'Accept Broad St Banking Run (₦950)', actionType: 'ACCEPT_MISSION', targetId: 'mis_broad_shuttle' },
    ],
    ownershipState: { ownerId: 'lasdri_institute', ownerName: 'Lagos State Drivers Institute (Virtual)', tenancyStatus: 'MUNICIPAL' },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Career System',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Fictionalised in-game driver training and dispatch center.',
    },
    tags: ['jobs', 'career', 'lasdri', 'cdl', 'exam', 'work', 'dispatch'],
  },
  {
    id: 'mis_point_sister_blessing_pickup',
    aliases: ['trigger_passenger_pickup', 'hailing_bay', 'mis_cms_to_tbs', 'mis_broad_shuttle'],
    entityType: 'mission_point',
    placeCategory: 'Jobs',
    displayName: 'Broad Street Commuter Pickup Bay (Sister Blessing)',
    subtitle: 'Active EkoRide Mission Point • Pickup Sister Blessing & Drive to TBS (+₦1,250 GN)',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4514, lng: 3.3952, address: 'Broad Street Roadside Layby (-120m)', lga: 'Lagos Island LGA' },
    gamePosition: { x: -96, y: 0.05, z: -120 },
    graphNodeId: 'node_broad_st_mid',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'hailingBayMesh',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 400, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_pickup', label: 'Navigate to Pickup Bay', actionType: 'NAVIGATE', targetId: 'mis_point_sister_blessing_pickup' },
      { actionId: 'act_accept_cms_tbs', label: 'Accept CMS-TBS Mission (+₦1,250 GN)', actionType: 'ACCEPT_MISSION', targetId: 'mis_cms_to_tbs' },
    ],
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Mission Engine',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original Project Eko mission character and 3D pickup beacon.',
    },
    tags: ['mission', 'pickup', 'sister blessing', 'ekoride', 'fare', 'passenger', 'jobs'],
  },
  {
    id: 'ev_venue_tbs_festival_arena',
    aliases: ['tbs_arena', 'lagos_festival_stage', 'event_venue_tbs', 'ent_tbs_owambe_arena', 'pin_owambe'],
    entityType: 'event_venue',
    placeCategory: 'Events',
    displayName: 'TBS Cultural & Afrobeats Festival Arena',
    subtitle: 'Live City Event Venue • Hosts Owambe Weekend Surge, Tech Expo & LASDRI Time Trials',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4472, lng: 3.4018, address: 'Tafawa Balewa Square East Concourse', lga: 'Lagos Island LGA' },
    gamePosition: { x: -88, y: 0.05, z: 42 },
    graphNodeId: 'node_tbs_plaza',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'tbs_arch_compound',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 600, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    scheduleInfo: 'Active City Event Rotation • Press [B] or use EkoAtlas Events Bar to inspect active surge multipliers',
    interactions: [
      { actionId: 'act_nav_event_venue', label: 'Navigate to Venue', actionType: 'NAVIGATE', targetId: 'ev_venue_tbs_festival_arena' },
      { actionId: 'act_view_event_venue', label: 'View Active City Event', actionType: 'VIEW_DETAILS', targetId: 'ev_venue_tbs_festival_arena' },
    ],
    ownershipState: { ownerId: 'civic_events_board', ownerName: 'Lagos Cultural & Events Board', tenancyStatus: 'PUBLIC' },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Dynamic Events Engine',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original festival event venue and dynamic economy surge system.',
    },
    tags: ['event', 'venue', 'festival', 'entertainment', 'tbs', 'owambe', 'afrobeats'],
  },

  // 9. RESIDENTIAL ESTATE & CULTURAL LANDMARK
  {
    id: 'est_marina_heights_gated_courts',
    aliases: ['security_gatehouse_vi_annex', 'bldg_east_035', 'marina_residential_estate', 'ent_marina_palm_estate', 'pin_home'],
    entityType: 'residential_estate',
    placeCategory: 'Properties',
    displayName: 'Marina Heights Gated Residential Estate',
    subtitle: 'Secured Island Residential Compound with Gatehouse & Backup Generator Court',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4490, lng: 3.3988, address: '42 Broad Street / VI Annex Link', lga: 'Lagos Island LGA' },
    gamePosition: { x: -72.5, y: 0.22, z: -42 },
    graphNodeId: 'node_broad_st_south',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'security_gatehouse_vi_annex',
    lodPolicy: { minZoomLevel: 2, maxRenderDistanceM: 450, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_estate', label: 'Navigate to Estate Gatehouse', actionType: 'NAVIGATE', targetId: 'est_marina_heights_gated_courts' },
      { actionId: 'act_view_estate', label: 'View Estate Details', actionType: 'VIEW_DETAILS', targetId: 'est_marina_heights_gated_courts' },
    ],
    ownershipState: { ownerId: 'assn_marina_residents', ownerName: 'Marina Heights Residents Association', tenancyStatus: 'NPC_OPERATED' },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Architectural Studio',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-17',
      rightsNotes: 'Original Nigerian gated residential compound archetype.',
    },
    tags: ['residential', 'estate', 'compound', 'gatehouse', 'housing', 'properties'],
  },
  {
    id: 'ent_grace_cathedral_marina',
    aliases: ['grace_cathedral', 'cathedral_marina', 'pin_church'],
    entityType: 'landmark',
    placeCategory: 'Landmarks',
    displayName: 'Grace Cathedral Marina Sanctuary',
    subtitle: 'Historic Marina Waterfront Cathedral • Choir Praise, Thanksgiving Seed & Blessed Hustle (+25% Earnings)',
    districtId: 'dist_lagos_island_marina_cms',
    geoReference: { lat: 6.4508, lng: 3.3918, address: '29 Marina Boulevard, Lagos Island', lga: 'Lagos Island LGA' },
    gamePosition: { x: -116, y: 0.22, z: -115 },
    graphNodeId: 'node_marina_promenade',
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    worldAssetRef: 'scene://landmarks/grace_cathedral_marina',
    lodPolicy: { minZoomLevel: 1, maxRenderDistanceM: 600, streamPolicy: 'ALWAYS_LOADED', detailTier: 'HERO_3D' },
    availabilityState: 'PLAYABLE',
    interactions: [
      { actionId: 'act_nav_cathedral', label: 'Navigate to Cathedral', actionType: 'NAVIGATE', targetId: 'ent_grace_cathedral_marina' },
      { actionId: 'act_visit_cathedral', label: 'Attend Worship Service', actionType: 'VIEW_DETAILS', targetId: 'ent_grace_cathedral_marina' },
    ],
    ownershipState: { ownerId: 'civic_cathedral_trust', ownerName: 'Marina Historic Sanctuary Trust', tenancyStatus: 'PUBLIC' },
    provenance: {
      category: 'ORIGINAL_PROJECT_EKO_ASSET',
      sourceAttribution: 'Project Eko Architectural Studio (Marina Gothic-Tropical Sanctuary)',
      license: 'Project Eko Original IP',
      verifiedDate: '2026-10-19',
      rightsNotes: '100% original procedural cathedral landmark.',
    },
    tags: ['landmark', 'cathedral', 'church', 'worship', 'marina', 'culture'],
  },
];

// ==========================================
// PHASE 5: EKOMEDIA INVENTORY SLOTS (ALL 8 FORMATS) & CAMPAIGNS
// ==========================================

export const CANONICAL_MEDIA_SLOTS: EkoMediaSlot[] = [
  {
    slotId: 'slot_bb_broad_east',
    entityId: 'media_billboard_broad_st_east',
    displayName: 'Broad Street East Digital Unipole (#BB-01)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'digital_billboard',
    gamePosition: { x: -66, y: 12, z: -150 },
    rotationY: -0.25,
    creativeDimensions: { widthPx: 1200, heightPx: 400, aspectRatio: '3:1', worldWidthM: 12, worldHeightM: 4 },
    operator: 'LASAA Virtual Outdoor Registry',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_ekopay_zero_fee',
  },
  {
    slotId: 'slot_bb_marina_west',
    entityId: 'media_placement_marina_west_gantry',
    displayName: 'Marina West Roadside Billboard (#BB-02)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'static_billboard',
    gamePosition: { x: -118, y: 11, z: -80 },
    rotationY: 0.25,
    creativeDimensions: { widthPx: 1200, heightPx: 400, aspectRatio: '3:1', worldWidthM: 12, worldHeightM: 4 },
    operator: 'LASAA Virtual Outdoor Registry',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_radio_eko_afrobeats',
  },
  {
    slotId: 'slot_term_cms_shelter',
    entityId: 'stop_cms_bus_terminal',
    displayName: 'CMS Bus Terminal Commuter LED Panel (#TD-03)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'terminal_display',
    gamePosition: { x: -119.5, y: 3.1, z: -200 },
    rotationY: 1.57,
    creativeDimensions: { widthPx: 800, heightPx: 300, aspectRatio: '8:3', worldWidthM: 4.4, worldHeightM: 1.4 },
    operator: 'LAMATA Virtual Transit Media',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_zobofresh_citrus',
  },
  {
    slotId: 'slot_store_haruna_suya',
    entityId: 'biz_suya_haruna',
    displayName: 'Haruna Suya Fascia Storefront Sponsorship (#SF-04)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'storefront_sponsorship',
    gamePosition: { x: -78.2, y: 3.3, z: -212 },
    rotationY: -1.57,
    creativeDimensions: { widthPx: 600, heightPx: 200, aspectRatio: '3:1', worldWidthM: 3.0, worldHeightM: 0.9 },
    operator: 'EkoCommerce Retail Media Network',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_zobofresh_citrus',
  },
  {
    slotId: 'slot_venue_tbs_arena',
    entityId: 'ev_venue_tbs_festival_arena',
    displayName: 'TBS Festival Arena Stage Banner (#VS-05)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'venue_sponsorship',
    gamePosition: { x: -84, y: 4.5, z: 42 },
    rotationY: 0,
    creativeDimensions: { widthPx: 960, heightPx: 320, aspectRatio: '3:1', worldWidthM: 6.0, worldHeightM: 2.0 },
    operator: 'Lagos Cultural & Events Board',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_radio_eko_afrobeats',
  },
  {
    slotId: 'slot_act_lasdri_trial',
    entityId: 'job_lasdri_career_hub',
    displayName: 'LASDRI Expressway Time Trial Sponsorship (#SA-06)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'sponsored_activity',
    gamePosition: { x: -82, y: 3.5, z: -35 },
    rotationY: 0,
    creativeDimensions: { widthPx: 640, heightPx: 240, aspectRatio: '8:3', worldWidthM: 3.6, worldHeightM: 1.2 },
    operator: 'LASDRI Career Challenges',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_koro_motors_dispatch',
  },
  {
    slotId: 'slot_route_cms_tbs_express',
    entityId: 'stop_broad_street_central',
    displayName: 'CMS-TBS Commuter Route Title Sponsorship (#SR-07)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'sponsored_transport_route',
    gamePosition: { x: -78.8, y: 3.1, z: -90 },
    rotationY: -1.57,
    creativeDimensions: { widthPx: 800, heightPx: 300, aspectRatio: '8:3', worldWidthM: 4.2, worldHeightM: 1.3 },
    operator: 'LAMATA Virtual Transit Media',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_ekopay_zero_fee',
  },
  {
    slotId: 'slot_event_marina_tech_expo',
    entityId: 'ev_venue_tbs_festival_arena',
    displayName: 'Scheduled City Event Spotlight (#SE-08)',
    districtId: 'dist_lagos_island_marina_cms',
    format: 'scheduled_city_event',
    gamePosition: { x: -96, y: 6.8, z: -150 },
    rotationY: 0,
    creativeDimensions: { widthPx: 1000, heightPx: 300, aspectRatio: '10:3', worldWidthM: 8.0, worldHeightM: 2.2 },
    operator: 'EkoMedia City Events Network',
    approvalState: 'APPROVED',
    availabilityWindow: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', commercialPolicy: 'SANDBOX_VIRTUAL_ONLY' },
    campaignState: 'ACTIVE_CAMPAIGN',
    activeCampaignId: 'camp_koro_motors_dispatch',
  },
];

export const CANONICAL_MEDIA_CAMPAIGNS: EkoMediaCampaign[] = [
  {
    campaignId: 'camp_ekopay_zero_fee',
    advertiser: {
      advertiserId: 'adv_ekopay_fintech',
      brandName: 'EkoPay Digital POS',
      sector: 'Fictional Fintech & Commuter Wallet',
      isFictionalBrand: true,
      provenance: 'FICTIONAL_COMMERCIAL_BRAND',
    },
    title: 'EkoPay Instant Danfo Tap & Transfer',
    creative: {
      creativeId: 'cr_ekopay_01',
      headline: 'EKOPAY • ZERO-FEE DANFO & MARKET POS',
      subheadline: 'Tap your EkoPhone at CMS & Balogun • 100% Virtual Game Naira',
      ctaLabel: 'Navigate to CMS Terminal',
      accentColorHex: '#10B981',
      bgColorHex: '#06281E',
      disclosureLabel: 'SPONSORED • VIRTUAL AD',
    },
    eligibleInventory: ['slot_bb_broad_east', 'slot_route_cms_tbs_express'],
    schedule: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', daypart: 'ALL_DAY' },
    budgetAndPrice: {
      currency: 'GAME_NAIRA_VIRTUAL',
      totalBudgetGN: 120000,
      spentGN: 42500,
      cpmVirtualGN: 500,
      realMoneySaleAllowed: false,
      commercialPolicyNote: 'Internal development sandbox inventory only; priced in virtual Game Naira (GN) with no real-world commercial rate card.',
    },
    approvalWorkflow: {
      status: 'APPROVED',
      reviewedBy: 'LASAA Virtual Compliance Board',
      protectsLandmarks: true,
      licensedAssetsVerified: true,
    },
    status: 'ACTIVE',
    deliveryMetrics: {
      impressions: 184,
      engagements: 27,
      routeSelections: 14,
      lastDeliveredAt: '2026-10-17T18:30:00Z',
    },
  },
  {
    campaignId: 'camp_radio_eko_afrobeats',
    advertiser: {
      advertiserId: 'adv_radio_eko',
      brandName: 'Radio Eko 99.3 FM',
      sector: 'Fictional In-Game Broadcast Station',
      isFictionalBrand: true,
      provenance: 'FICTIONAL_COMMERCIAL_BRAND',
    },
    title: 'Radio Eko 99.3 FM Non-Stop Afrobeats & Highlife',
    creative: {
      creativeId: 'cr_radio_eko_01',
      headline: 'RADIO EKO 99.3 FM • SOUND OF LAGOS ISLAND',
      subheadline: 'Press [M] in your Danfo for Live Procedural Afrobeats & Highlife',
      ctaLabel: 'Navigate to TBS Festival Arena',
      accentColorHex: '#F4B41A',
      bgColorHex: '#1E1B4B',
      disclosureLabel: 'SPONSORED • VIRTUAL AD',
    },
    eligibleInventory: ['slot_bb_marina_west', 'slot_venue_tbs_arena'],
    schedule: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', daypart: 'ALL_DAY' },
    budgetAndPrice: {
      currency: 'GAME_NAIRA_VIRTUAL',
      totalBudgetGN: 95000,
      spentGN: 31200,
      cpmVirtualGN: 450,
      realMoneySaleAllowed: false,
      commercialPolicyNote: 'Internal fictional radio promotion; zero real-world monetary billing.',
    },
    approvalWorkflow: {
      status: 'APPROVED',
      reviewedBy: 'LASAA Virtual Compliance Board',
      protectsLandmarks: true,
      licensedAssetsVerified: true,
    },
    status: 'ACTIVE',
    deliveryMetrics: {
      impressions: 156,
      engagements: 34,
      routeSelections: 19,
      lastDeliveredAt: '2026-10-17T18:32:00Z',
    },
  },
  {
    campaignId: 'camp_zobofresh_citrus',
    advertiser: {
      advertiserId: 'adv_zobofresh',
      brandName: 'ZoboFresh Hibiscus & Ginger',
      sector: 'Fictional Lagos Beverage Maker',
      isFictionalBrand: true,
      provenance: 'FICTIONAL_COMMERCIAL_BRAND',
    },
    title: 'Ice-Cold ZoboFresh at Haruna Suya & CMS Terminal',
    creative: {
      creativeId: 'cr_zobofresh_01',
      headline: 'ZOBOFRESH • CHILLED HIBISCUS & SPICED GINGER',
      subheadline: 'Pair with Mallam Haruna Hot Beef Suya at CMS Sidewalk!',
      ctaLabel: 'Navigate to Haruna Suya Stand',
      accentColorHex: '#EC4899',
      bgColorHex: '#3B0764',
      disclosureLabel: 'SPONSORED • VIRTUAL AD',
    },
    eligibleInventory: ['slot_term_cms_shelter', 'slot_store_haruna_suya'],
    schedule: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', daypart: 'PEAK_COMMUTE' },
    budgetAndPrice: {
      currency: 'GAME_NAIRA_VIRTUAL',
      totalBudgetGN: 75000,
      spentGN: 24800,
      cpmVirtualGN: 400,
      realMoneySaleAllowed: false,
      commercialPolicyNote: 'Fictional beverage brand for street-commerce immersion.',
    },
    approvalWorkflow: {
      status: 'APPROVED',
      reviewedBy: 'LASAA Virtual Compliance Board',
      protectsLandmarks: true,
      licensedAssetsVerified: true,
    },
    status: 'ACTIVE',
    deliveryMetrics: {
      impressions: 142,
      engagements: 22,
      routeSelections: 11,
      lastDeliveredAt: '2026-10-17T18:35:00Z',
    },
  },
  {
    campaignId: 'camp_koro_motors_dispatch',
    advertiser: {
      advertiserId: 'adv_koro_motors',
      brandName: 'Koro & Apex Motors Nigeria',
      sector: 'Fictional Vehicle Manufacturer',
      isFictionalBrand: true,
      provenance: 'FICTIONAL_COMMERCIAL_BRAND',
    },
    title: 'Apex Danfo 14 & Koro 125 Fleet Upgrade',
    creative: {
      creativeId: 'cr_koro_01',
      headline: 'APEX MOTORS • BUILT FOR LAGOS HUSTLE',
      subheadline: 'Visit Segun Auto Clinic & Berger Showroom on Broad Street',
      ctaLabel: 'Navigate to Berger Showroom',
      accentColorHex: '#38BDF8',
      bgColorHex: '#0F172A',
      disclosureLabel: 'SPONSORED • VIRTUAL AD',
    },
    eligibleInventory: ['slot_act_lasdri_trial', 'slot_event_marina_tech_expo'],
    schedule: { startIso: '2026-01-01T00:00:00Z', endIso: '2027-12-31T23:59:59Z', daypart: 'ALL_DAY' },
    budgetAndPrice: {
      currency: 'GAME_NAIRA_VIRTUAL',
      totalBudgetGN: 110000,
      spentGN: 38000,
      cpmVirtualGN: 480,
      realMoneySaleAllowed: false,
      commercialPolicyNote: 'Fictional in-game vehicle manufacturer campaign.',
    },
    approvalWorkflow: {
      status: 'APPROVED',
      reviewedBy: 'LASAA Virtual Compliance Board',
      protectsLandmarks: true,
      licensedAssetsVerified: true,
    },
    status: 'ACTIVE',
    deliveryMetrics: {
      impressions: 128,
      engagements: 19,
      routeSelections: 9,
      lastDeliveredAt: '2026-10-17T18:36:00Z',
    },
  },
];

// ==========================================
// PHASE 6: EKOPROPERTIES VIRTUAL PARCELS
// ==========================================

export const CANONICAL_PROPERTY_PARCELS: EkoVirtualPropertyParcel[] = [
  {
    parcelId: 'parcel_cms_suya_plot_01',
    entityId: 'biz_suya_haruna',
    displayName: 'CMS East Sidewalk Concession Parcel (#P-01)',
    districtId: 'dist_lagos_island_marina_cms',
    eligibleForAcquisition: true,
    plotBoundaries: {
      center: { x: -78.2, y: 0.22, z: -212 },
      widthM: 6,
      depthM: 8,
      areaSqm: 48,
      cornerPoints: [
        { x: -81.2, z: -216 },
        { x: -75.2, z: -216 },
        { x: -75.2, z: -208 },
        { x: -81.2, z: -208 },
      ],
    },
    permittedUses: ['FOOD_BEVERAGE', 'RETAIL_KIOSK'],
    acquisitionTerms: {
      tenureType: 'VIRTUAL_CONCESSION_DEED',
      acquisitionCostGN: 45000,
      developmentCostGN: 25000,
      maintenanceCostPerShiftGN: 350,
      realWorldLandClaim: false,
      legalDisclaimer: 'VIRTUAL GAME RIGHTS ONLY: This parcel exists solely inside Project Eko virtual gameplay and confers zero real-world land ownership, lease, or property rights.',
    },
    buildState: 'DEVELOPED_ACTIVE',
    businessType: 'Night Suya & Grill Concession',
    operatingStatus: 'OPEN_OPERATING',
    ownership: {
      ownerId: 'player_amaka',
      ownerName: 'Amaka Driver (Player)',
      acquiredAtIso: '2026-10-01T10:00:00Z',
    },
    ownershipHistory: [
      {
        ownerId: 'eko_land_registry',
        ownerName: 'Project Eko Virtual Land Registry',
        event: 'INITIAL_REGISTRY',
        timestampIso: '2026-01-01T00:00:00Z',
        amountGN: 0,
      },
      {
        ownerId: 'player_amaka',
        ownerName: 'Amaka Driver (Player)',
        event: 'ACQUIRED',
        timestampIso: '2026-10-01T10:00:00Z',
        amountGN: 45000,
        ledgerTxId: 'tx_genesis_suya_01',
      },
    ],
    associatedBusinessEntityId: 'biz_suya_haruna',
    hourlyYieldGN: 800,
    unclaimedYieldGN: 2400,
  },
  {
    parcelId: 'parcel_marina_bukka_plot_02',
    entityId: 'biz_bukka_nkechi',
    displayName: 'Marina Walkway Culinary Parcel (#P-02)',
    districtId: 'dist_lagos_island_marina_cms',
    eligibleForAcquisition: true,
    plotBoundaries: {
      center: { x: -77.5, y: 0.22, z: -196 },
      widthM: 8,
      depthM: 10,
      areaSqm: 80,
      cornerPoints: [
        { x: -81.5, z: -201 },
        { x: -73.5, z: -201 },
        { x: -73.5, z: -191 },
        { x: -81.5, z: -191 },
      ],
    },
    permittedUses: ['FOOD_BEVERAGE', 'MIXED_COMMERCIAL'],
    acquisitionTerms: {
      tenureType: 'VIRTUAL_CONCESSION_DEED',
      acquisitionCostGN: 80000,
      developmentCostGN: 35000,
      maintenanceCostPerShiftGN: 500,
      realWorldLandClaim: false,
      legalDisclaimer: 'VIRTUAL GAME RIGHTS ONLY: This parcel exists solely inside Project Eko virtual gameplay and confers zero real-world land ownership, lease, or property rights.',
    },
    buildState: 'DEVELOPED_ACTIVE',
    businessType: 'Traditional Bukka & Canteen',
    operatingStatus: 'OPEN_OPERATING',
    ownership: {
      ownerId: null,
      ownerName: 'Available Virtual Concession (Mama Nkechi Operator)',
      acquiredAtIso: null,
    },
    ownershipHistory: [
      {
        ownerId: 'eko_land_registry',
        ownerName: 'Project Eko Virtual Land Registry',
        event: 'INITIAL_REGISTRY',
        timestampIso: '2026-01-01T00:00:00Z',
        amountGN: 0,
      },
    ],
    associatedBusinessEntityId: 'biz_bukka_nkechi',
    hourlyYieldGN: 1450,
    unclaimedYieldGN: 0,
  },
  {
    parcelId: 'parcel_balogun_depot_plot_03',
    entityId: 'mkt_balogun_wholesale_depot',
    displayName: 'Balogun Wholesale Logistics Plot (#P-03)',
    districtId: 'dist_lagos_island_marina_cms',
    eligibleForAcquisition: true,
    plotBoundaries: {
      center: { x: -77.6, y: 0.22, z: -175 },
      widthM: 10,
      depthM: 12,
      areaSqm: 120,
      cornerPoints: [
        { x: -82.6, z: -181 },
        { x: -72.6, z: -181 },
        { x: -72.6, z: -169 },
        { x: -82.6, z: -169 },
      ],
    },
    permittedUses: ['LOGISTICS_DEPOT', 'AUTO_WORKSHOP', 'MIXED_COMMERCIAL'],
    acquisitionTerms: {
      tenureType: 'VIRTUAL_LEASEHOLD_99_CYCLES',
      acquisitionCostGN: 150000,
      developmentCostGN: 55000,
      maintenanceCostPerShiftGN: 850,
      realWorldLandClaim: false,
      legalDisclaimer: 'VIRTUAL GAME RIGHTS ONLY: This parcel exists solely inside Project Eko virtual gameplay and confers zero real-world land ownership, lease, or property rights.',
    },
    buildState: 'DEVELOPED_ACTIVE',
    businessType: 'Wholesale Auto Parts & Textiles Depot',
    operatingStatus: 'OPEN_OPERATING',
    ownership: {
      ownerId: null,
      ownerName: 'Available Virtual Leasehold (Balogun Traders)',
      acquiredAtIso: null,
    },
    ownershipHistory: [
      {
        ownerId: 'eko_land_registry',
        ownerName: 'Project Eko Virtual Land Registry',
        event: 'INITIAL_REGISTRY',
        timestampIso: '2026-01-01T00:00:00Z',
        amountGN: 0,
      },
    ],
    associatedBusinessEntityId: 'mkt_balogun_wholesale_depot',
    hourlyYieldGN: 2800,
    unclaimedYieldGN: 0,
  },
  {
    parcelId: 'parcel_broad_st_corner_plot_04',
    entityId: 'parcel_broad_st_corner_plot_04',
    displayName: 'Broad Street Financial Corner Parcel (#P-04)',
    districtId: 'dist_lagos_island_marina_cms',
    eligibleForAcquisition: true,
    plotBoundaries: {
      center: { x: -76.0, y: 0.22, z: -115 },
      widthM: 10,
      depthM: 14,
      areaSqm: 140,
      cornerPoints: [
        { x: -81.0, z: -122 },
        { x: -71.0, z: -122 },
        { x: -71.0, z: -108 },
        { x: -81.0, z: -108 },
      ],
    },
    permittedUses: ['RETAIL_KIOSK', 'FOOD_BEVERAGE', 'MIXED_COMMERCIAL', 'TRANSIT_HUB'],
    acquisitionTerms: {
      tenureType: 'VIRTUAL_LEASEHOLD_99_CYCLES',
      acquisitionCostGN: 95000,
      developmentCostGN: 40000,
      maintenanceCostPerShiftGN: 600,
      realWorldLandClaim: false,
      legalDisclaimer: 'VIRTUAL GAME RIGHTS ONLY: This parcel exists solely inside Project Eko virtual gameplay and confers zero real-world land ownership, lease, or property rights.',
    },
    buildState: 'UNDEVELOPED',
    businessType: null,
    operatingStatus: 'VACANT',
    ownership: {
      ownerId: null,
      ownerName: 'Unclaimed Virtual Plot (Eligible)',
      acquiredAtIso: null,
    },
    ownershipHistory: [
      {
        ownerId: 'eko_land_registry',
        ownerName: 'Project Eko Virtual Land Registry',
        event: 'INITIAL_REGISTRY',
        timestampIso: '2026-01-01T00:00:00Z',
        amountGN: 0,
      },
    ],
    associatedBusinessEntityId: null,
    hourlyYieldGN: 1950,
    unclaimedYieldGN: 0,
  },
  {
    parcelId: 'parcel_marina_promenade_plot_05',
    entityId: 'parcel_marina_promenade_plot_05',
    displayName: 'Marina Waterfront Kiosk Parcel (#P-05)',
    districtId: 'dist_lagos_island_marina_cms',
    eligibleForAcquisition: true,
    plotBoundaries: {
      center: { x: -120.0, y: 0.22, z: -165 },
      widthM: 10,
      depthM: 11,
      areaSqm: 110,
      cornerPoints: [
        { x: -125.0, z: -170.5 },
        { x: -115.0, z: -170.5 },
        { x: -115.0, z: -159.5 },
        { x: -125.0, z: -159.5 },
      ],
    },
    permittedUses: ['RETAIL_KIOSK', 'FOOD_BEVERAGE', 'TRANSIT_HUB'],
    acquisitionTerms: {
      tenureType: 'VIRTUAL_LEASEHOLD_99_CYCLES',
      acquisitionCostGN: 68000,
      developmentCostGN: 30000,
      maintenanceCostPerShiftGN: 450,
      realWorldLandClaim: false,
      legalDisclaimer: 'VIRTUAL GAME RIGHTS ONLY: This parcel exists solely inside Project Eko virtual gameplay and confers zero real-world land ownership, lease, or property rights.',
    },
    buildState: 'UNDEVELOPED',
    businessType: null,
    operatingStatus: 'VACANT',
    ownership: {
      ownerId: null,
      ownerName: 'Unclaimed Virtual Plot (Eligible)',
      acquiredAtIso: null,
    },
    ownershipHistory: [
      {
        ownerId: 'eko_land_registry',
        ownerName: 'Project Eko Virtual Land Registry',
        event: 'INITIAL_REGISTRY',
        timestampIso: '2026-01-01T00:00:00Z',
        amountGN: 0,
      },
    ],
    associatedBusinessEntityId: null,
    hourlyYieldGN: 1350,
    unclaimedYieldGN: 0,
  },
  {
    parcelId: 'parcel_tbs_civic_reserve_non_purchasable',
    entityId: 'lmk_tbs_ceremonial_arch',
    displayName: 'TBS National Monument Civic Reserve (#P-06 • Restricted)',
    districtId: 'dist_lagos_island_marina_cms',
    eligibleForAcquisition: false,
    plotBoundaries: {
      center: { x: -100.0, y: 0, z: 50 },
      widthM: 46,
      depthM: 20,
      areaSqm: 920,
      cornerPoints: [
        { x: -123, z: 40 },
        { x: -77, z: 40 },
        { x: -77, z: 60 },
        { x: -123, z: 60 },
      ],
    },
    permittedUses: [],
    acquisitionTerms: {
      tenureType: 'VIRTUAL_LEASEHOLD_99_CYCLES',
      acquisitionCostGN: 0,
      developmentCostGN: 0,
      maintenanceCostPerShiftGN: 0,
      realWorldLandClaim: false,
      legalDisclaimer: 'PROTECTED CIVIC LANDMARK: Not eligible for private virtual acquisition or commercial development.',
    },
    buildState: 'DEVELOPED_ACTIVE',
    businessType: 'Public Civic Monument',
    operatingStatus: 'OPEN_OPERATING',
    ownership: {
      ownerId: 'civic_trust',
      ownerName: 'National Civic Monument Trust (Protected)',
      acquiredAtIso: '2026-01-01T00:00:00Z',
    },
    ownershipHistory: [
      {
        ownerId: 'civic_trust',
        ownerName: 'National Civic Monument Trust',
        event: 'INITIAL_REGISTRY',
        timestampIso: '2026-01-01T00:00:00Z',
        amountGN: 0,
      },
    ],
    associatedBusinessEntityId: null,
    hourlyYieldGN: 0,
    unclaimedYieldGN: 0,
  },
];

/**
 * Resolve any canonical entity ID or cross-application alias to its single CanonicalWorldEntity record.
 */
export function resolveCanonicalEntity(idOrAlias: string): CanonicalWorldEntity | null {
  if (!idOrAlias) return null;
  const norm = idOrAlias.trim().toLowerCase();
  for (const ent of CANONICAL_WORLD_ENTITIES) {
    if (ent.id.toLowerCase() === norm) return ent;
    if (ent.aliases.some(a => a.toLowerCase() === norm)) return ent;
  }
  return null;
}

/**
 * Search and filter the Canonical World Registry for EkoAtlas and EkoPlaces Directory.
 */
export function searchCanonicalPlaces(options: {
  query?: string;
  category?: EkoPlaceDirectoryCategory | 'ALL' | string;
  entityType?: CanonicalEntityType | 'ALL' | string;
  districtId?: string;
  availabilityState?: 'PLAYABLE' | 'PLANNED' | 'LOCKED' | 'ALL';
} = {}): CanonicalWorldEntity[] {
  const q = (options.query || '').trim().toLowerCase();
  const cat = options.category && options.category !== 'ALL' ? options.category.toLowerCase() : null;
  const eType = options.entityType && options.entityType !== 'ALL' ? options.entityType.toLowerCase() : null;
  const dist = options.districtId && options.districtId !== 'ALL' ? options.districtId.toLowerCase() : null;
  const avail = options.availabilityState && options.availabilityState !== 'ALL' ? options.availabilityState : null;

  return CANONICAL_WORLD_ENTITIES.filter(ent => {
    if (cat) {
      const entCat = ent.placeCategory.toLowerCase();
      // Match direct category or Dealerships/Garages shared automotive service lookup
      const matchesCat =
        entCat === cat ||
        (cat === 'food' && ent.tags.includes('food')) ||
        (cat === 'dealerships' && (ent.id === 'gar_segun_auto_clinic' || ent.tags.includes('dealership'))) ||
        (cat === 'properties' && (ent.entityType === 'virtual_property_parcel' || ent.entityType === 'player_owned_property' || ent.entityType === 'residential_estate'));
      if (!matchesCat) return false;
    }
    if (eType && ent.entityType.toLowerCase() !== eType) return false;
    if (dist && ent.districtId.toLowerCase() !== dist) return false;
    if (avail && ent.availabilityState !== avail) return false;

    if (q) {
      const hay = [
        ent.id,
        ent.displayName,
        ent.subtitle,
        ent.placeCategory,
        ent.entityType,
        ent.geoReference.address,
        ...ent.aliases,
        ...ent.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Calculate a continuous route between two canonical entities using the world graph and 3D corridor coordinates.
 */
export function calculateCanonicalRoute(fromIdOrAlias: string, toIdOrAlias: string): {
  fromEntity: CanonicalWorldEntity;
  toEntity: CanonicalWorldEntity;
  nodePath: string[];
  waypoints3D: WorldVector3[];
  totalDistanceM: number;
  estimatedDurationSec: number;
} | null {
  const fromEnt = resolveCanonicalEntity(fromIdOrAlias) || resolveCanonicalEntity('stop_cms_bus_terminal');
  const toEnt = resolveCanonicalEntity(toIdOrAlias);
  if (!fromEnt || !toEnt) return null;

  const rawPath = findShortestPath(fromEnt.graphNodeId, toEnt.graphNodeId) || [fromEnt.graphNodeId, toEnt.graphNodeId];

  // Construct 3D street-level waypoints along the Broad Street / Marina corridor (x = -96 carriageway center)
  const startZ = fromEnt.gamePosition.z;
  const endZ = toEnt.gamePosition.z;
  const waypoints3D: WorldVector3[] = [{ ...fromEnt.gamePosition }];
  const steps = 6;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    waypoints3D.push({
      x: -96,
      y: 0.12,
      z: Number((startZ + (endZ - startZ) * t).toFixed(1)),
    });
  }
  waypoints3D.push({ ...toEnt.gamePosition });

  const distM = Math.max(15, Math.round(calculateDistance(fromEnt.gamePosition, toEnt.gamePosition)));
  const estSec = Math.max(5, Math.round(distM / 11.5));

  return {
    fromEntity: fromEnt,
    toEntity: toEnt,
    nodePath: rawPath,
    waypoints3D,
    totalDistanceM: distM,
    estimatedDurationSec: estSec,
  };
}


