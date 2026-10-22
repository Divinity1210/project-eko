import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { PlayerPresence, VehicleState, ZoneSnapshot } from '@project-eko/contracts';
import { AntiCheatValidator } from '@project-eko/anti-cheat';
import { TelemetryEvidencePackager, SignedCheckpointToken } from '@project-eko/telemetry';

const PORT = Number(process.env.PROJECT_EKO_REALTIME_PORT || 3002);
const ZONE_ID = 'zone_marina_cms';
const REALTIME_DATA_DIR = process.env.PROJECT_EKO_DATA_DIR || path.join(__dirname, '..', 'data');
const ZONE_STATE_STORE_PATH = path.join(REALTIME_DATA_DIR, 'zone_state_store.json');
const ALLOWED_REALTIME_CORS_ORIGINS = (process.env.PROJECT_EKO_CORS_ORIGINS || 'http://localhost:8090,http://127.0.0.1:8090,http://localhost:8094,http://127.0.0.1:8094,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const realtimeMetrics = {
  startedAtMs: Date.now(),
  requestsTotal: 0,
  movementRejectionsTotal: 0,
  zonePersistsTotal: 0,
};

export type EntityKind = 'HUMAN_PLAYER' | 'SIMULATED_NPC' | 'AI_WORKER';

export interface ExtendedPlayerPresence extends PlayerPresence {
  entityKind: EntityKind;
  isHuman: boolean;
  isSimulatedNpc?: boolean;
  isAiWorker?: boolean;
  sessionId?: string;
  connectionState?: 'CONNECTED' | 'DISCONNECTED';
  reconnectCount?: number;
  crewId?: string | null;
  coopSessionId?: string | null;
  coopRole?: 'DRIVER' | 'CONDUCTOR' | null;
  vehicleOccupancyRole?: 'ON_FOOT' | 'ENTERING_VEHICLE' | 'DRIVER' | 'PASSENGER' | 'CONDUCTOR' | 'EXITING_VEHICLE';
  seatId?: string | null;
  roleTitle?: string;
}

export interface ExtendedVehicleState extends VehicleState {
  entityKind?: EntityKind;
  isHumanControlled?: boolean;
  conductorId?: string | null;
  safetyState?: 'NORMAL' | 'SAFE_STOP_DRIVER_DISCONNECTED';
  seats?: Record<string, { seatId: string; role: 'DRIVER' | 'PASSENGER' | 'CONDUCTOR'; occupantId: string | null; localOffset: { x: number; y: number; z: number } }>;
}

// Initial Active Entities in the Marina/CMS zone
const zonePlayers = new Map<string, ExtendedPlayerPresence>();
const zoneVehicles = new Map<string, ExtendedVehicleState>();

// Session, Idempotency, Moderation, Privacy, Crew & Co-op Stores
const playerSessions = new Map<string, {
  playerId: string;
  username: string;
  sessionId: string;
  supersededSessionIds: Set<string>;
  connectionState: 'CONNECTED' | 'DISCONNECTED';
  lastSeen: number;
  disconnectedAt: number | null;
  reconnectCount: number;
}>();

const processedRequestIds = new Map<string, any>();
const chatRateLimits = new Map<string, number[]>();
const blockedUsersByPlayer = new Map<string, Set<string>>();
const privacySettingsByPlayer = new Map<string, {
  playerId: string;
  allowCrewInvites: boolean;
  allowProximityChat: boolean;
  showOnlineStatus: boolean;
}>();
const moderationReports: Array<{
  reportId: string;
  reporterId: string;
  targetId: string;
  category: string;
  reason: string;
  timestamp: number;
  status: string;
}> = [];

export interface CrewRecord {
  crewId: string;
  name: string;
  leaderId: string;
  leaderName: string;
  memberIds: string[];
  members: Array<{ playerId: string; username: string; role: string; joinedAt: number }>;
  pendingInvites: Array<{ inviteId: string; targetPlayerId: string; invitedBy: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; createdAt: number }>;
  createdAt: number;
}

const activeCrews = new Map<string, CrewRecord>();

export interface CoopDanfoSession {
  coopSessionId: string;
  crewId: string | null;
  routeId: string;
  routeName: string;
  vehicleId: string;
  driverPlayerId: string | null;
  driverName: string | null;
  conductorPlayerId: string | null;
  conductorName: string | null;
  roleDescriptions: {
    DRIVER: string;
    CONDUCTOR: string;
  };
  compensationContract: {
    driverSharePct: number;
    conductorSharePct: number;
    fuelCostGN: number;
    unionLevyGN: number;
    farePerPassengerGN: number;
    description: string;
  };
  status: 'WAITING_FOR_ROLES' | 'READY_TO_START' | 'IN_PROGRESS' | 'COMPLETED';
  eligibleStops: Array<{
    stopId: string;
    name: string;
    order: number;
    position: { x: number; y: number; z: number };
    boardedPassengers: number;
    completed: boolean;
    completedAt: number | null;
    calledByConductorId: string | null;
  }>;
  totalPassengersBoarded: number;
  grossFareRevenueGN: number;
  netPoolGN: number;
  driverPayoutGN: number;
  conductorPayoutGN: number;
  settled: boolean;
  settlementIdempotencyKey: string | null;
  checkpointToken?: SignedCheckpointToken | null;
  driverCheckpointToken?: SignedCheckpointToken | null;
  conductorCheckpointToken?: SignedCheckpointToken | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

const coopDanfoSessions = new Map<string, CoopDanfoSession>();

// Seed Simulated Ambient NPCs in the Marina/CMS zone (explicitly tagged SIMULATED_NPC, never counted as online humans)
zonePlayers.set('peer_chidi_01', {
  playerId: 'peer_chidi_01',
  username: 'Chidi_Transporter',
  entityKind: 'SIMULATED_NPC',
  isHuman: false,
  isSimulatedNpc: true,
  roleTitle: 'Simulated Danfo Operator (NPC)',
  position: { x: -96, y: 0, z: -195 },
  rotationY: 1.57,
  inVehicleId: 'veh_npc_danfo_01',
  isDriving: false,
  avatarState: 'idle',
  connectionState: 'CONNECTED',
  lastSeen: Date.now(),
});

zonePlayers.set('peer_bayo_02', {
  playerId: 'peer_bayo_02',
  username: 'Bayo_Keke',
  entityKind: 'SIMULATED_NPC',
  isHuman: false,
  isSimulatedNpc: true,
  roleTitle: 'Simulated Keke Shuttle Rider (NPC)',
  position: { x: -112, y: 0, z: -195 },
  rotationY: 0,
  inVehicleId: 'veh_npc_keke_01',
  isDriving: true,
  avatarState: 'driving',
  connectionState: 'CONNECTED',
  lastSeen: Date.now(),
});

zonePlayers.set('peer_ifeoma_03', {
  playerId: 'peer_ifeoma_03',
  username: 'Ifeoma_Trader',
  entityKind: 'SIMULATED_NPC',
  isHuman: false,
  isSimulatedNpc: true,
  roleTitle: 'Simulated Balogun Market Trader (NPC)',
  position: { x: -83, y: 0, z: -180 },
  rotationY: 3.14,
  inVehicleId: null,
  isDriving: false,
  avatarState: 'walking',
  connectionState: 'CONNECTED',
  lastSeen: Date.now(),
});

const chatMessages: any[] = [
  {
    messageId: 'msg_001',
    senderId: 'peer_chidi_01',
    senderName: 'Chidi_Transporter',
    entityKind: 'SIMULATED_NPC',
    isHuman: false,
    position: { x: -96, y: 0, z: -195 },
    channel: 'local',
    text: 'CMS to TBS express loading now! Enter with your change!',
    timestamp: Date.now() - 15000,
  },
  {
    messageId: 'msg_002',
    senderId: 'peer_bayo_02',
    senderName: 'Bayo_Keke',
    entityKind: 'SIMULATED_NPC',
    isHuman: false,
    position: { x: -112, y: 0, z: -195 },
    channel: 'local',
    text: 'How far senior driver! Road clear front?',
    timestamp: Date.now() - 8000,
  },
];

// Seed AI Worker vehicles (explicitly tagged AI_WORKER)
zoneVehicles.set('veh_npc_danfo_01', {
  vehicleId: 'veh_npc_danfo_01',
  ownerId: 'npc_driver_tunde',
  entityKind: 'AI_WORKER',
  isHumanControlled: false,
  vehicleClass: 'danfo_minibus',
  position: { x: -450, y: 0, z: -580 },
  rotation: { x: 0, y: 0.85, z: 0 },
  velocity: { x: -4.2, y: 0, z: -2.1 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  speedKmh: 28,
  rpm: 2100,
  currentGear: 2,
  fuelLiters: 48,
  damage: {
    bodyCondition: 82,
    engineCondition: 90,
    tyreTreadPercent: 75,
    oilQualityPercent: 80,
    isImmobilized: false,
  },
  driverId: 'npc_driver_tunde',
  passengerIds: ['npc_commuter_1', 'npc_commuter_2', 'npc_commuter_3'],
});

zoneVehicles.set('veh_npc_okada_01', {
  vehicleId: 'veh_npc_okada_01',
  ownerId: 'npc_rider_segun',
  entityKind: 'AI_WORKER',
  isHumanControlled: false,
  vehicleClass: 'okada_motorcycle',
  position: { x: -210, y: 0, z: -240 },
  rotation: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 8.5 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  speedKmh: 35,
  rpm: 4200,
  currentGear: 3,
  fuelLiters: 8,
  damage: {
    bodyCondition: 95,
    engineCondition: 98,
    tyreTreadPercent: 90,
    oilQualityPercent: 92,
    isImmobilized: false,
  },
  driverId: 'npc_rider_segun',
  passengerIds: [],
});

function persistDurableZoneState(): void {
  try {
    fs.mkdirSync(REALTIME_DATA_DIR, { recursive: true });
    const humanPlayers = Array.from(zonePlayers.values()).filter((p) => p.isHuman);
    const humanVehicles = Array.from(zoneVehicles.values()).filter((v) => v.isHumanControlled);
    const crews = Array.from(activeCrews.values());
    const coopSessions = Array.from(coopDanfoSessions.values());
    const sessions = Array.from(playerSessions.values()).map((s) => ({
      ...s,
      supersededSessionIds: Array.from(s.supersededSessionIds),
    }));
    const payload = {
      zoneId: ZONE_ID,
      savedAtMs: Date.now(),
      movementRejectionsTotal: realtimeMetrics.movementRejectionsTotal,
      zonePersistsTotal: realtimeMetrics.zonePersistsTotal + 1,
      humanPlayers,
      humanVehicles,
      crews,
      coopSessions,
      sessions,
    };
    const tmpPath = `${ZONE_STATE_STORE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, ZONE_STATE_STORE_PATH);
    realtimeMetrics.zonePersistsTotal += 1;
  } catch {
    // ignore write failures in read-only environments
  }
}

function loadDurableZoneState(): void {
  try {
    if (!fs.existsSync(ZONE_STATE_STORE_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(ZONE_STATE_STORE_PATH, 'utf8'));
    if (typeof raw.movementRejectionsTotal === 'number') {
      realtimeMetrics.movementRejectionsTotal = raw.movementRejectionsTotal;
    }
    if (typeof raw.zonePersistsTotal === 'number') {
      realtimeMetrics.zonePersistsTotal = raw.zonePersistsTotal;
    }
    if (Array.isArray(raw.humanPlayers)) {
      for (const p of raw.humanPlayers) {
        if (p && p.playerId) zonePlayers.set(p.playerId, p);
      }
    }
    if (Array.isArray(raw.humanVehicles)) {
      for (const v of raw.humanVehicles) {
        if (v && v.vehicleId) zoneVehicles.set(v.vehicleId, v);
      }
    }
    if (Array.isArray(raw.crews)) {
      for (const c of raw.crews) {
        if (c && c.crewId) activeCrews.set(c.crewId, c);
      }
    }
    if (Array.isArray(raw.coopSessions)) {
      for (const s of raw.coopSessions) {
        if (s && s.coopSessionId) coopDanfoSessions.set(s.coopSessionId, s);
      }
    }
    if (Array.isArray(raw.sessions)) {
      for (const s of raw.sessions) {
        if (s && s.playerId) {
          playerSessions.set(s.playerId, {
            ...s,
            supersededSessionIds: new Set(Array.isArray(s.supersededSessionIds) ? s.supersededSessionIds : []),
          });
        }
      }
    }
  } catch {
    // ignore corrupt/empty store on startup
  }
}

loadDurableZoneState();

let tickCount = 0;
const HUMAN_HEARTBEAT_TIMEOUT_MS = 45000;

function distance2D(a?: { x: number; z: number }, b?: { x: number; z: number }): number {
  if (!a || !b) return 0;
  const dx = (Number(a.x) || 0) - (Number(b.x) || 0);
  const dz = (Number(a.z) || 0) - (Number(b.z) || 0);
  return Math.sqrt(dx * dx + dz * dz);
}

const DISALLOWED_CHAT_PATTERNS = [
  /\bscam\s+link\b/i,
  /\bfree\s+password\b/i,
  /\bhate\s+speech\b/i,
  /\bslur_test_token\b/i,
];

function checkModerationText(text: string): { allowed: boolean; reason?: string } {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { allowed: false, reason: 'EMPTY_MESSAGE' };
  if (trimmed.length > 220) return { allowed: false, reason: 'MESSAGE_TOO_LONG_MAX_220' };
  for (const pat of DISALLOWED_CHAT_PATTERNS) {
    if (pat.test(trimmed)) {
      return { allowed: false, reason: 'PROHIBITED_CONTENT_POLICY' };
    }
  }
  return { allowed: true };
}

// 20 Hz Tick Loop (50ms)
setInterval(() => {
  tickCount++;
  const now = Date.now();

  // Update NPC vehicles in circular movement loop
  const danfo = zoneVehicles.get('veh_npc_danfo_01');
  if (danfo) {
    danfo.rotation.y += 0.005;
    danfo.position.x += -Math.sin(danfo.rotation.y) * (danfo.speedKmh / 3.6) * 0.05;
    danfo.position.z += -Math.cos(danfo.rotation.y) * (danfo.speedKmh / 3.6) * 0.05;
  }

  // Keep simulated NPCs' lastSeen fresh but never mark them as human
  for (const [id, p] of zonePlayers.entries()) {
    if (p.entityKind === 'SIMULATED_NPC') {
      p.lastSeen = now;
    } else if (p.entityKind === 'HUMAN_PLAYER') {
      if (p.connectionState === 'CONNECTED' && now - (p.lastSeen || 0) > HUMAN_HEARTBEAT_TIMEOUT_MS) {
        p.connectionState = 'DISCONNECTED';
        const sess = playerSessions.get(id);
        if (sess) {
          sess.connectionState = 'DISCONNECTED';
          sess.disconnectedAt = now;
        }
      }
    }
  }
}, 50);

function getClassifiedEntities(viewerId?: string | null, interestRadiusMeters: number = 450) {
  const allPlayers = Array.from(zonePlayers.values());
  const viewer = viewerId ? zonePlayers.get(viewerId) : null;

  const activeHumanPlayers = allPlayers.filter(
    (p) => p.entityKind === 'HUMAN_PLAYER' && p.isHuman === true && p.connectionState !== 'DISCONNECTED'
  );
  const disconnectedHumanPlayers = allPlayers.filter(
    (p) => p.entityKind === 'HUMAN_PLAYER' && p.isHuman === true && p.connectionState === 'DISCONNECTED'
  );
  const simulatedNpcs = allPlayers.filter((p) => p.entityKind === 'SIMULATED_NPC');
  const aiWorkers = Array.from(zoneVehicles.values()).filter((v) => v.entityKind === 'AI_WORKER');

  let spatialFilteredPlayers = allPlayers.filter((p) => p.connectionState !== 'DISCONNECTED');
  let culledOutOfRangeCount = 0;

  if (viewer && viewer.position && interestRadiusMeters > 0) {
    spatialFilteredPlayers = spatialFilteredPlayers.filter((p) => {
      if (p.playerId === viewer.playerId) return true;
      const d = distance2D(viewer.position, p.position);
      const within = d <= interestRadiusMeters;
      if (!within) culledOutOfRangeCount++;
      return within;
    });
  }

  return {
    allPlayers,
    activeHumanPlayers,
    disconnectedHumanPlayers,
    simulatedNpcs,
    aiWorkers,
    spatialFilteredPlayers,
    onlineHumanCount: activeHumanPlayers.length,
    simulatedNpcCount: simulatedNpcs.length,
    aiWorkerCount: aiWorkers.length,
    spatialInterestStats: {
      viewerId: viewerId || null,
      radiusMeters: interestRadiusMeters,
      totalEntities: allPlayers.length,
      broadcastEntities: spatialFilteredPlayers.length,
      culledOutOfRangeCount,
    },
  };
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

type AuthenticatedRealtimePlayer = { accountId: string; username: string };

async function resolveRealtimeSession(req: http.IncomingMessage): Promise<AuthenticatedRealtimePlayer | null> {
  const rawToken = req.headers['x-session-token'] ||
    (req.headers.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, '') : '');
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!token) return null;

  return new Promise((resolve) => {
    const validation = http.get({
      hostname: '127.0.0.1',
      port: Number(process.env.PROJECT_EKO_API_PORT || 3001),
      path: '/api/v1/auth/session',
      headers: { 'X-Session-Token': token },
      timeout: 2500,
    }, (response) => {
      let payload = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { payload += chunk; });
      response.on('end', () => {
        try {
          const data = JSON.parse(payload || '{}');
          if (response.statusCode !== 200 || data.authenticated !== true || !data.account?.accountId) {
            resolve(null);
            return;
          }
          const player = {
            accountId: String(data.account.accountId),
            username: String(data.account.character?.displayName || data.account.username || 'Lagos Citizen'),
          };
          resolve(player);
        } catch {
          resolve(null);
        }
      });
    });
    validation.on('timeout', () => { validation.destroy(); resolve(null); });
    validation.on('error', () => resolve(null));
  });
}

const server = http.createServer(async (req, res) => {
  realtimeMetrics.requestsTotal += 1;

  // Security & Origin-Allowlist CORS Headers (Never Wildcard '*')
  const requestOrigin = req.headers.origin;
  if (requestOrigin && ALLOWED_REALTIME_CORS_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  } else if (ALLOWED_REALTIME_CORS_ORIGINS.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_REALTIME_CORS_ORIGINS[0]);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    const classified = getClassifiedEntities();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        zone: ZONE_ID,
        tick: tickCount,
        onlineHumanCount: classified.onlineHumanCount,
        simulatedNpcCount: classified.simulatedNpcCount,
        aiWorkerCount: classified.aiWorkerCount,
        durableStatePath: ZONE_STATE_STORE_PATH,
      })
    );
    return;
  }

  if (url.pathname === '/readyz') {
    const classified = getClassifiedEntities();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ready',
        service: 'project-eko-realtime-worker',
        zone: ZONE_ID,
        tick: tickCount,
        onlineHumanCount: classified.onlineHumanCount,
        zonePersistsTotal: realtimeMetrics.zonePersistsTotal,
      })
    );
    return;
  }

  if (url.pathname === '/metrics') {
    const classified = getClassifiedEntities();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        service: 'project-eko-realtime-worker',
        zone: ZONE_ID,
        uptimeSeconds: Math.round((Date.now() - realtimeMetrics.startedAtMs) / 1000),
        tick: tickCount,
        requestsTotal: realtimeMetrics.requestsTotal,
        movementRejectionsTotal: realtimeMetrics.movementRejectionsTotal,
        zonePersistsTotal: realtimeMetrics.zonePersistsTotal,
        onlineHumanCount: classified.onlineHumanCount,
        activeVehiclesCount: zoneVehicles.size,
      })
    );
    return;
  }

  if (url.searchParams.has('sessionToken')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        error: 'SESSION_TOKEN_IN_URL_FORBIDDEN',
        message: 'Session tokens must be passed in X-Session-Token or Authorization: Bearer headers.',
      })
    );
    return;
  }

  // Every zone endpoint except health/readyz/metrics is session-bound. Resolve the account at
  // the API authority and never accept a client-selected player identity.
  const authenticatedPlayer = await resolveRealtimeSession(req);
  if (!authenticatedPlayer) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'AUTHENTICATION_REQUIRED' }));
    return;
  }
  const authenticatedPlayerId = authenticatedPlayer?.accountId || '';

  // GET /snapshot — 20Hz Server Snapshot with strict HUMAN_PLAYER vs SIMULATED_NPC vs AI_WORKER separation & Spatial Interest Management
  if (url.pathname === '/snapshot' && req.method === 'GET') {
    const viewerId = authenticatedPlayerId;
    const radiusParam = Number(url.searchParams.get('radius'));
    const radiusMeters = !Number.isNaN(radiusParam) && radiusParam > 0 ? radiusParam : 450;
    const classified = getClassifiedEntities(viewerId, radiusMeters);

    const snapshot: ZoneSnapshot & Record<string, any> = {
      zoneId: ZONE_ID,
      tickNumber: tickCount,
      timestamp: Date.now(),
      weather: 'clear',
      timeBand: 'afternoon',
      players: classified.spatialFilteredPlayers,
      vehicles: Array.from(zoneVehicles.values()),
      humanPlayers: classified.activeHumanPlayers,
      disconnectedHumanPlayers: classified.disconnectedHumanPlayers,
      simulatedNpcs: classified.simulatedNpcs,
      aiWorkers: classified.aiWorkers,
      onlineHumanCount: classified.onlineHumanCount,
      simulatedNpcCount: classified.simulatedNpcCount,
      aiWorkerCount: classified.aiWorkerCount,
      spatialInterestStats: classified.spatialInterestStats,
      crews: Array.from(activeCrews.values()),
      coopSessions: Array.from(coopDanfoSessions.values()),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(snapshot));
    return;
  }

  // POST /presence — Authenticated Human Heartbeat, Position/Orientation Sync & Session Dedup
  if (url.pathname === '/presence' && req.method === 'POST') {
    const p = await readJsonBody(req);
    p.playerId = authenticatedPlayerId;
    p.username = authenticatedPlayer?.username || p.username;

    // Check duplicate request idempotency
    const requestKey = p.requestId ? `${authenticatedPlayerId}:${p.requestId}` : null;
    if (requestKey && processedRequestIds.has(requestKey)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...processedRequestIds.get(requestKey), duplicateIgnored: true }));
      return;
    }

    // Never allow a client heartbeat to overwrite a seeded SIMULATED_NPC id as human
    if (p.playerId.startsWith('peer_') || p.entityKind === 'SIMULATED_NPC') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ synced: false, error: 'CANNOT_IMPERSONATE_SIMULATED_NPC' }));
      return;
    }

    const now = Date.now();
    const incomingSessionId = String(p.sessionId || `sess_${p.playerId}_default`);
    let existingSession = playerSessions.get(p.playerId);
    let staleSessionReplaced = false;
    let reconnected = false;

    if (existingSession) {
      // Reject if this request explicitly carries a known superseded stale sessionId
      if (existingSession.supersededSessionIds.has(incomingSessionId)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            synced: false,
            error: 'STALE_SESSION_SUPERSEDED',
            activeSessionId: existingSession.sessionId,
          })
        );
        return;
      }
      if (existingSession.sessionId !== incomingSessionId) {
        existingSession.supersededSessionIds.add(existingSession.sessionId);
        existingSession.sessionId = incomingSessionId;
        staleSessionReplaced = true;
      }
      if (existingSession.connectionState === 'DISCONNECTED') {
        existingSession.connectionState = 'CONNECTED';
        existingSession.reconnectCount += 1;
        existingSession.disconnectedAt = null;
        reconnected = true;
      }
      existingSession.lastSeen = now;
      if (p.username) existingSession.username = p.username;
    } else {
      existingSession = {
        playerId: p.playerId,
        username: p.username || p.playerId,
        sessionId: incomingSessionId,
        supersededSessionIds: new Set<string>(),
        connectionState: 'CONNECTED',
        lastSeen: now,
        disconnectedAt: null,
        reconnectCount: 0,
      };
      playerSessions.set(p.playerId, existingSession);
    }

    const prevPresence = zonePlayers.get(p.playerId);
    const updatedPresence: ExtendedPlayerPresence = {
      playerId: p.playerId,
      username: p.username || prevPresence?.username || p.playerId,
      entityKind: 'HUMAN_PLAYER',
      isHuman: true,
      isSimulatedNpc: false,
      isAiWorker: false,
      sessionId: existingSession.sessionId,
      connectionState: 'CONNECTED',
      reconnectCount: existingSession.reconnectCount,
      crewId: p.crewId !== undefined ? p.crewId : (prevPresence?.crewId || null),
      coopSessionId: p.coopSessionId !== undefined ? p.coopSessionId : (prevPresence?.coopSessionId || null),
      coopRole: p.coopRole !== undefined ? p.coopRole : (prevPresence?.coopRole || null),
      roleTitle: p.roleTitle || prevPresence?.roleTitle || 'Authenticated Citizen (Human)',
      position: p.position || prevPresence?.position || { x: -95, y: 0, z: -185 },
      rotationY: typeof p.rotationY === 'number' ? p.rotationY : (prevPresence?.rotationY || 0),
      inVehicleId: p.inVehicleId !== undefined ? p.inVehicleId : (prevPresence?.inVehicleId || null),
      isDriving: Boolean(p.isDriving),
      avatarState: p.avatarState || prevPresence?.avatarState || 'idle',
      lastSeen: now,
    };

    zonePlayers.set(p.playerId, updatedPresence);
    persistDurableZoneState();

    const classified = getClassifiedEntities(p.playerId);
    const responsePayload = {
      synced: true,
      tick: tickCount,
      player: updatedPresence,
      reconnected,
      reconnectCount: existingSession.reconnectCount,
      staleSessionReplaced,
      onlineHumanCount: classified.onlineHumanCount,
      simulatedNpcCount: classified.simulatedNpcCount,
    };

    if (requestKey) {
      processedRequestIds.set(requestKey, responsePayload);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responsePayload));
    return;
  }

  // POST /disconnect — Explicit Disconnect Simulation / Graceful Leave
  if (url.pathname === '/disconnect' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const playerId = authenticatedPlayerId;
    const p = zonePlayers.get(playerId);
    const sess = playerSessions.get(playerId);
    if (!p || p.entityKind !== 'HUMAN_PLAYER') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'HUMAN_PLAYER_NOT_FOUND' }));
      return;
    }
    p.connectionState = 'DISCONNECTED';
    if (sess) {
      sess.connectionState = 'DISCONNECTED';
      sess.disconnectedAt = Date.now();
    }

    // M4.8 Driver Disconnect Safety Policy: If this player was driving a shared vehicle, bring it to a safe stop
    let safetyHaltedVehicleId: string | null = null;
    const affectedPassengers: string[] = [];
    for (const [vid, veh] of zoneVehicles.entries()) {
      if (veh.driverId === playerId) {
        veh.driverId = null;
        veh.speedKmh = 0;
        veh.velocity = { x: 0, y: 0, z: 0 };
        veh.angularVelocity = { x: 0, y: 0, z: 0 };
        veh.safetyState = 'SAFE_STOP_DRIVER_DISCONNECTED';
        if (veh.seats && veh.seats['driver']) {
          veh.seats['driver'].occupantId = null;
        }
        safetyHaltedVehicleId = vid;
        for (const pid of veh.passengerIds || []) {
          affectedPassengers.push(pid);
        }
        if (veh.conductorId) {
          affectedPassengers.push(veh.conductorId);
        }
      }
    }
    p.isDriving = false;
    p.vehicleOccupancyRole = 'ON_FOOT';
    p.inVehicleId = null;
    p.seatId = null;

    const classified = getClassifiedEntities();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        playerId,
        connectionState: 'DISCONNECTED',
        safetyHaltedVehicleId,
        affectedPassengers,
        safetyPolicy: safetyHaltedVehicleId ? 'VEHICLE_SAFELY_HALTED_PASSENGERS_PRESERVED' : 'NONE',
        onlineHumanCount: classified.onlineHumanCount,
      })
    );
    return;
  }

  // POST /reconnect — Explicit Session Reconnection & State Recovery
  if (url.pathname === '/reconnect' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const playerId = authenticatedPlayerId;
    const p = zonePlayers.get(playerId);
    const sess = playerSessions.get(playerId);
    if (!p || !sess) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'SESSION_NOT_FOUND' }));
      return;
    }
    const now = Date.now();
    p.connectionState = 'CONNECTED';
    p.lastSeen = now;
    if (body.sessionId && body.sessionId !== sess.sessionId) {
      sess.supersededSessionIds.add(sess.sessionId);
      sess.sessionId = String(body.sessionId);
      p.sessionId = sess.sessionId;
    }
    sess.connectionState = 'CONNECTED';
    sess.reconnectCount += 1;
    sess.disconnectedAt = null;
    sess.lastSeen = now;
    p.reconnectCount = sess.reconnectCount;

    const classified = getClassifiedEntities(playerId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        reconnected: true,
        player: p,
        reconnectCount: sess.reconnectCount,
        onlineHumanCount: classified.onlineHumanCount,
        restoredCrew: p.crewId ? activeCrews.get(p.crewId) || null : null,
        restoredCoopSession: p.coopSessionId ? coopDanfoSessions.get(p.coopSessionId) || null : null,
      })
    );
    return;
  }

  // POST /proximity/interact — Proximity Interaction Between Two Authenticated Human Players
  if (url.pathname === '/proximity/interact' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const actor = zonePlayers.get(authenticatedPlayerId);
    const target = zonePlayers.get(String(body.targetId || ''));
    if (!actor || !target) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'PLAYER_NOT_IN_ZONE' }));
      return;
    }
    const blocked = blockedUsersByPlayer.get(target.playerId);
    if (blocked && blocked.has(actor.playerId)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'BLOCKED_BY_TARGET_PLAYER' }));
      return;
    }
    const dist = distance2D(actor.position, target.position);
    const maxRange = 35;
    if (dist > maxRange) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'TARGET_OUT_OF_PROXIMITY_RANGE',
          distanceMeters: Number(dist.toFixed(2)),
          maxRangeMeters: maxRange,
        })
      );
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        interactionId: `prox_${Date.now()}`,
        actorId: actor.playerId,
        actorEntityKind: actor.entityKind,
        targetId: target.playerId,
        targetEntityKind: target.entityKind,
        interactionType: body.interactionType || 'GREET',
        distanceMeters: Number(dist.toFixed(2)),
        timestamp: Date.now(),
      })
    );
    return;
  }

  // GET /chat — Proximity Chat Feed (filters blocked senders for viewerId)
  if (url.pathname === '/chat' && req.method === 'GET') {
    const viewerId = authenticatedPlayerId;
    const blockedSet = viewerId ? blockedUsersByPlayer.get(viewerId) : null;
    const filtered = blockedSet
      ? chatMessages.filter((m) => !blockedSet.has(m.senderId))
      : chatMessages;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: filtered }));
    return;
  }

  // POST /chat — Send Proximity Chat Message with Rate Limiting & Moderation
  if (url.pathname === '/chat' && req.method === 'POST') {
    const msg = await readJsonBody(req);
    const senderId = authenticatedPlayerId;
    const now = Date.now();

    // Rate limiting: max 5 messages per 10 seconds per sender
    const history = (chatRateLimits.get(senderId) || []).filter((t) => now - t < 10000);
    if (history.length >= 5) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sent: false, error: 'CHAT_RATE_LIMIT_EXCEEDED', retryAfterMs: 3000 }));
      return;
    }

    const modCheck = checkModerationText(msg.text);
    if (!modCheck.allowed) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sent: false, error: 'MODERATION_BLOCKED', reason: modCheck.reason }));
      return;
    }

    history.push(now);
    chatRateLimits.set(senderId, history);

    const senderPresence = zonePlayers.get(senderId);
    const enrichedMsg = {
      messageId: 'msg_' + now + '_' + Math.floor(Math.random() * 1000),
      senderId,
      senderName: senderPresence?.username || authenticatedPlayer?.username || senderId,
      entityKind: senderPresence?.entityKind || 'HUMAN_PLAYER',
      isHuman: senderPresence ? senderPresence.isHuman : true,
      position: senderPresence?.position || { x: -95, y: 0, z: -185 },
      channel: msg.channel || 'local',
      text: String(msg.text).trim(),
      timestamp: now,
    };
    chatMessages.push(enrichedMsg);
    if (chatMessages.length > 40) chatMessages.shift();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sent: true, message: enrichedMsg }));
    return;
  }

  // POST /moderation/block — Block or Unblock another player
  if (url.pathname === '/moderation/block' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const blockerId = authenticatedPlayerId;
    const blockedId = String(body.blockedId || '');
    if (!blockerId || !blockedId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'MISSING_PLAYER_IDS' }));
      return;
    }
    let set = blockedUsersByPlayer.get(blockerId);
    if (!set) {
      set = new Set<string>();
      blockedUsersByPlayer.set(blockerId, set);
    }
    if (body.unblock) {
      set.delete(blockedId);
    } else {
      set.add(blockedId);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, blockerId, blockedUsers: Array.from(set) }));
    return;
  }

  // POST /moderation/report — Report a player or message
  if (url.pathname === '/moderation/report' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body.targetId || !body.reason) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'MISSING_REPORT_FIELDS' }));
      return;
    }
    const report = {
      reportId: `rep_${Date.now()}`,
      reporterId: authenticatedPlayerId,
      targetId: String(body.targetId),
      category: String(body.category || 'CONDUCT'),
      reason: String(body.reason),
      timestamp: Date.now(),
      status: 'QUEUED_FOR_REVIEW',
    };
    moderationReports.push(report);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, report }));
    return;
  }

  // POST /privacy/settings — Update player privacy controls
  if (url.pathname === '/privacy/settings' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const playerId = authenticatedPlayerId;
    const settings = {
      playerId,
      allowCrewInvites: body.allowCrewInvites !== undefined ? Boolean(body.allowCrewInvites) : true,
      allowProximityChat: body.allowProximityChat !== undefined ? Boolean(body.allowProximityChat) : true,
      showOnlineStatus: body.showOnlineStatus !== undefined ? Boolean(body.showOnlineStatus) : true,
    };
    privacySettingsByPlayer.set(playerId, settings);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, settings }));
    return;
  }

  // POST /crew/create — Create a Multiplayer Crew
  if (url.pathname === '/crew/create' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const leaderId = authenticatedPlayerId;
    const leaderPresence = zonePlayers.get(leaderId);
    if (!leaderPresence || !leaderPresence.isHuman || leaderPresence.connectionState !== 'CONNECTED') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'HUMAN_LEADER_REQUIRED' }));
      return;
    }
    const crewId = `crew_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const leaderName = authenticatedPlayer?.username || leaderPresence?.username || leaderId;
    const crew: CrewRecord = {
      crewId,
      name: String(body.name || `${leaderName}'s Marina Syndicate`),
      leaderId,
      leaderName,
      memberIds: [leaderId],
      members: [{ playerId: leaderId, username: leaderName, role: 'LEADER', joinedAt: Date.now() }],
      pendingInvites: [],
      createdAt: Date.now(),
    };
    activeCrews.set(crewId, crew);
    if (leaderPresence) leaderPresence.crewId = crewId;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, crew }));
    return;
  }

  // POST /crew/invite — Invite an Authenticated Human Player to a Crew
  if (url.pathname === '/crew/invite' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const crew = activeCrews.get(String(body.crewId || ''));
    const targetId = String(body.targetPlayerId || '');
    if (!crew || !targetId) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'CREW_OR_TARGET_NOT_FOUND' }));
      return;
    }
    if (!crew.memberIds.includes(authenticatedPlayerId)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'CREW_MEMBER_REQUIRED' }));
      return;
    }
    const targetPresence = zonePlayers.get(targetId);
    if (targetPresence && !targetPresence.isHuman) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'CANNOT_INVITE_SIMULATED_NPC_TO_HUMAN_CREW' }));
      return;
    }
    const targetPrivacy = privacySettingsByPlayer.get(targetId);
    if (targetPrivacy && !targetPrivacy.allowCrewInvites) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'TARGET_PRIVACY_BLOCKS_CREW_INVITES' }));
      return;
    }
    const invite = {
      inviteId: `inv_${Date.now()}`,
      targetPlayerId: targetId,
      invitedBy: authenticatedPlayerId,
      status: 'PENDING' as const,
      createdAt: Date.now(),
    };
    crew.pendingInvites.push(invite);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, crew, invite }));
    return;
  }

  // POST /crew/respond — Accept or Decline a Crew Invitation
  if (url.pathname === '/crew/respond' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const crew = activeCrews.get(String(body.crewId || ''));
    const playerId = authenticatedPlayerId;
    if (!crew || !playerId) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'CREW_NOT_FOUND' }));
      return;
    }
    const inv = crew.pendingInvites.find((i) => i.targetPlayerId === playerId && i.status === 'PENDING');
    if (inv) {
      inv.status = body.accept !== false ? 'ACCEPTED' : 'DECLINED';
    }
    if (body.accept !== false && !crew.memberIds.includes(playerId)) {
      const p = zonePlayers.get(playerId);
      crew.memberIds.push(playerId);
      crew.members.push({
        playerId,
        username: body.username || p?.username || playerId,
        role: 'MEMBER',
        joinedAt: Date.now(),
      });
      if (p) p.crewId = crew.crewId;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, crew }));
    return;
  }

  // POST /coop/danfo/create — Create a Cooperative Danfo Driver + Conductor Session
  if (url.pathname === '/coop/danfo/create' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const driverId = authenticatedPlayerId;
    const driverPresence = zonePlayers.get(driverId);
    if (!driverPresence || !driverPresence.isHuman || driverPresence.connectionState !== 'CONNECTED') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'AUTHENTICATED_HUMAN_DRIVER_REQUIRED' }));
      return;
    }
    const coopSessionId = `coop_danfo_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const session: CoopDanfoSession = {
      coopSessionId,
      crewId: body.crewId || driverPresence?.crewId || null,
      routeId: 'route_cms_obalende_yaba_coop',
      routeName: 'CMS → Marina → Obalende → Yaba Co-op Corridor',
      vehicleId: body.vehicleId || 'apex_danfo_14',
      driverPlayerId: driverId,
      driverName: body.driverName || driverPresence?.username || driverId,
      conductorPlayerId: null,
      conductorName: null,
      roleDescriptions: {
        DRIVER: 'Pilot the 14-seater Danfo safely between designated bus stops, hold steady in boarding bays, and avoid collisions.',
        CONDUCTOR: 'Call route destinations at each bus stop, manage passenger boarding, and verify fare collection before departure.',
      },
      compensationContract: {
        driverSharePct: 60,
        conductorSharePct: 40,
        fuelCostGN: 200,
        unionLevyGN: 100,
        farePerPassengerGN: 300,
        description: 'Agreed Co-op Contract: 60% Driver / 40% Conductor split of Net Route Pool (Gross Fares minus ₦200 Fuel & ₦100 Union Levy). Zero payout on join; requires verified stop completions.',
      },
      status: 'WAITING_FOR_ROLES',
      eligibleStops: [
        {
          stopId: 'stop_cms_terminal',
          name: 'CMS Bus Terminal Bay',
          order: 1,
          position: { x: -95, y: 0, z: -195 },
          boardedPassengers: 0,
          completed: false,
          completedAt: null,
          calledByConductorId: null,
        },
        {
          stopId: 'stop_marina_first_bank',
          name: 'Marina Broad Street Junction',
          order: 2,
          position: { x: -65, y: 0, z: -165 },
          boardedPassengers: 0,
          completed: false,
          completedAt: null,
          calledByConductorId: null,
        },
        {
          stopId: 'stop_obalende_underbridge',
          name: 'Obalende Underbridge Express Bay',
          order: 3,
          position: { x: -30, y: 0, z: -135 },
          boardedPassengers: 0,
          completed: false,
          completedAt: null,
          calledByConductorId: null,
        },
      ],
      totalPassengersBoarded: 0,
      grossFareRevenueGN: 0,
      netPoolGN: 0,
      driverPayoutGN: 0,
      conductorPayoutGN: 0,
      settled: false,
      settlementIdempotencyKey: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };
    coopDanfoSessions.set(coopSessionId, session);
    if (driverPresence) {
      driverPresence.coopSessionId = coopSessionId;
      driverPresence.coopRole = 'DRIVER';
    }
    persistDurableZoneState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, session }));
    return;
  }

  // POST /coop/danfo/join — Second Authenticated Human Joins as Conductor (No reward awarded on join!)
  if (url.pathname === '/coop/danfo/join' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const session = coopDanfoSessions.get(String(body.coopSessionId || ''));
    const conductorId = authenticatedPlayerId;
    if (!session || !conductorId) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'COOP_SESSION_NOT_FOUND' }));
      return;
    }
    if (conductorId === session.driverPlayerId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'DRIVER_AND_CONDUCTOR_MUST_BE_DISTINCT_PLAYERS' }));
      return;
    }
    const conductorPresence = zonePlayers.get(conductorId);
    if (!conductorPresence || !conductorPresence.isHuman || conductorPresence.connectionState !== 'CONNECTED') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'CONDUCTOR_MUST_BE_HUMAN_PLAYER' }));
      return;
    }
    session.conductorPlayerId = conductorId;
    session.conductorName = body.conductorName || conductorPresence?.username || conductorId;
    session.status = 'READY_TO_START';
    if (conductorPresence) {
      conductorPresence.coopSessionId = session.coopSessionId;
      conductorPresence.coopRole = 'CONDUCTOR';
    }
    persistDurableZoneState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        rewardAwardedOnJoin: 0,
        session,
      })
    );
    return;
  }

  // POST /coop/danfo/start — Start Route Only When Both Driver & Conductor Prerequisites Are Met
  if (url.pathname === '/coop/danfo/start' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const session = coopDanfoSessions.get(String(body.coopSessionId || ''));
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'COOP_SESSION_NOT_FOUND' }));
      return;
    }
    if (session.driverPlayerId !== authenticatedPlayerId && session.conductorPlayerId !== authenticatedPlayerId) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'COOP_PARTICIPANT_REQUIRED' }));
      return;
    }
    if (!session.driverPlayerId || !session.conductorPlayerId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'PREREQUISITES_NOT_MET_BOTH_ROLES_REQUIRED',
          driverAssigned: Boolean(session.driverPlayerId),
          conductorAssigned: Boolean(session.conductorPlayerId),
        })
      );
      return;
    }
    session.status = 'IN_PROGRESS';
    session.startedAt = Date.now();
    persistDurableZoneState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, session }));
    return;
  }

  // POST /coop/danfo/board-stop — Server-Validated Stop Boarding by Driver + Conductor
  if (url.pathname === '/coop/danfo/board-stop' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const session = coopDanfoSessions.get(String(body.coopSessionId || ''));
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'COOP_SESSION_NOT_FOUND' }));
      return;
    }
    if (session.conductorPlayerId !== authenticatedPlayerId) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'ASSIGNED_CONDUCTOR_REQUIRED' }));
      return;
    }
    if (session.status !== 'IN_PROGRESS') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'ROUTE_NOT_IN_PROGRESS', status: session.status }));
      return;
    }
    const stop = session.eligibleStops.find((s) => s.stopId === body.stopId);
    if (!stop) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'INVALID_BUS_STOP_ID' }));
      return;
    }
    if (stop.completed) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'STOP_ALREADY_BOARDED_DUPLICATE_REJECTED', stop }));
      return;
    }
    const boardedCount = 4;
    stop.boardedPassengers = boardedCount;
    stop.completed = true;
    stop.completedAt = Date.now();
    stop.calledByConductorId = session.conductorPlayerId;

    session.totalPassengersBoarded = session.eligibleStops.reduce((sum, s) => sum + s.boardedPassengers, 0);
    session.grossFareRevenueGN =
      session.totalPassengersBoarded * session.compensationContract.farePerPassengerGN;
    const costs = session.compensationContract.fuelCostGN + session.compensationContract.unionLevyGN;
    session.netPoolGN = Math.max(0, session.grossFareRevenueGN - costs);
    session.driverPayoutGN = Math.round(
      session.netPoolGN * (session.compensationContract.driverSharePct / 100)
    );
    session.conductorPayoutGN = session.netPoolGN - session.driverPayoutGN;

    const allCompleted = session.eligibleStops.every((s) => s.completed);
    const completedStopIds = session.eligibleStops.filter((s) => s.completed).map((s) => s.stopId);
    const distanceMeters = completedStopIds.length * 420;

    if (session.driverPlayerId) {
      session.driverCheckpointToken = TelemetryEvidencePackager.signCheckpointToken({
        sessionId: session.coopSessionId,
        accountId: session.driverPlayerId,
        vehicleId: session.vehicleId,
        routeId: session.routeId,
        stopOrCheckpointIds: completedStopIds,
        distanceMeters,
      });
    }
    if (session.conductorPlayerId) {
      session.conductorCheckpointToken = TelemetryEvidencePackager.signCheckpointToken({
        sessionId: session.coopSessionId,
        accountId: session.conductorPlayerId,
        vehicleId: session.vehicleId,
        routeId: session.routeId,
        stopOrCheckpointIds: completedStopIds,
        distanceMeters,
      });
    }
    session.checkpointToken = session.conductorCheckpointToken || session.driverCheckpointToken || null;

    if (allCompleted) {
      session.status = 'COMPLETED';
      session.completedAt = Date.now();
      session.settlementIdempotencyKey = `idem_coop_settle_${session.coopSessionId}`;
    }

    persistDurableZoneState();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        stop,
        allStopsCompleted: allCompleted,
        checkpointToken: session.checkpointToken,
        driverCheckpointToken: session.driverCheckpointToken,
        conductorCheckpointToken: session.conductorCheckpointToken,
        session,
      })
    );
    return;
  }

  // GET /coop/danfo/state — Inspect Co-op Danfo Session
  if (url.pathname === '/coop/danfo/state' && req.method === 'GET') {
    const coopSessionId = url.searchParams.get('coopSessionId');
    if (coopSessionId) {
      const s = coopDanfoSessions.get(coopSessionId);
      res.writeHead(s ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(s ? { ok: true, session: s } : { ok: false, error: 'NOT_FOUND' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sessions: Array.from(coopDanfoSessions.values()) }));
    return;
  }

  // M4.8 MULTIPLAYER VEHICLE SEAT OCCUPANCY & TRANSFORM SYNCHRONIZATION
  if (url.pathname === '/vehicles/board' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const playerId = authenticatedPlayerId;
    const vehicleId = String(body.vehicleId || 'veh_shared_danfo_01');
    const role = String(body.role || 'PASSENGER').toUpperCase() as
      | 'DRIVER'
      | 'PASSENGER'
      | 'CONDUCTOR';
    const p = zonePlayers.get(playerId);
    if (!p) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'PLAYER_NOT_IN_ZONE' }));
      return;
    }

    let veh = zoneVehicles.get(vehicleId);
    if (!veh) {
      veh = {
        vehicleId,
        ownerId: playerId,
        entityKind: 'HUMAN_PLAYER',
        isHumanControlled: true,
        vehicleClass: body.vehicleClass || 'danfo_minibus',
        position: body.position || { ...p.position },
        rotation: { x: 0, y: p.rotationY || 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        speedKmh: 0,
        rpm: 850,
        currentGear: 1,
        fuelLiters: 50,
        damage: {
          bodyCondition: 100,
          engineCondition: 100,
          tyreTreadPercent: 100,
          oilQualityPercent: 100,
          isImmobilized: false,
        },
        driverId: null,
        passengerIds: [],
        conductorId: null,
        safetyState: 'NORMAL',
        seats: {
          driver: { seatId: 'driver', role: 'DRIVER', occupantId: null, localOffset: { x: -0.62, y: 0.68, z: 1.68 } },
          conductor_step: { seatId: 'conductor_step', role: 'CONDUCTOR', occupantId: null, localOffset: { x: 0.88, y: 0.56, z: 0.68 } },
          front_passenger: { seatId: 'front_passenger', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.12, y: 0.68, z: 1.68 } },
          front_passenger_window: { seatId: 'front_passenger_window', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.68, y: 0.68, z: 1.68 } },
          rear_passenger_1: { seatId: 'rear_passenger_1', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.74, y: 0.68, z: 0.62 } },
          rear_passenger_2: { seatId: 'rear_passenger_2', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.18, y: 0.68, z: 0.62 } },
          rear_passenger_3: { seatId: 'rear_passenger_3', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.74, y: 0.68, z: -0.32 } },
          rear_passenger_4: { seatId: 'rear_passenger_4', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.18, y: 0.68, z: -0.32 } },
          rear_passenger_5: { seatId: 'rear_passenger_5', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.68, y: 0.68, z: -0.32 } },
          rear_passenger_6: { seatId: 'rear_passenger_6', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.74, y: 0.68, z: -1.22 } },
          rear_passenger_7: { seatId: 'rear_passenger_7', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.18, y: 0.68, z: -1.22 } },
          rear_passenger_8: { seatId: 'rear_passenger_8', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.68, y: 0.68, z: -1.22 } },
          rear_passenger_9: { seatId: 'rear_passenger_9', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.58, y: 0.70, z: -2.08 } },
          rear_passenger_10: { seatId: 'rear_passenger_10', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.58, y: 0.70, z: -2.08 } },
        },
      };
      zoneVehicles.set(vehicleId, veh);
    }

    if (!veh.seats) {
      veh.seats = {
        driver: { seatId: 'driver', role: 'DRIVER', occupantId: veh.driverId || null, localOffset: { x: -0.62, y: 0.68, z: 1.68 } },
        conductor_step: { seatId: 'conductor_step', role: 'CONDUCTOR', occupantId: veh.conductorId || null, localOffset: { x: 0.88, y: 0.56, z: 0.68 } },
        front_passenger: { seatId: 'front_passenger', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.12, y: 0.68, z: 1.68 } },
        front_passenger_window: { seatId: 'front_passenger_window', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.68, y: 0.68, z: 1.68 } },
        rear_passenger_1: { seatId: 'rear_passenger_1', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.74, y: 0.68, z: 0.62 } },
        rear_passenger_2: { seatId: 'rear_passenger_2', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.18, y: 0.68, z: 0.62 } },
        rear_passenger_3: { seatId: 'rear_passenger_3', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.74, y: 0.68, z: -0.32 } },
        rear_passenger_4: { seatId: 'rear_passenger_4', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.18, y: 0.68, z: -0.32 } },
        rear_passenger_5: { seatId: 'rear_passenger_5', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.68, y: 0.68, z: -0.32 } },
        rear_passenger_6: { seatId: 'rear_passenger_6', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.74, y: 0.68, z: -1.22 } },
        rear_passenger_7: { seatId: 'rear_passenger_7', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.18, y: 0.68, z: -1.22 } },
        rear_passenger_8: { seatId: 'rear_passenger_8', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.68, y: 0.68, z: -1.22 } },
        rear_passenger_9: { seatId: 'rear_passenger_9', role: 'PASSENGER', occupantId: null, localOffset: { x: -0.58, y: 0.70, z: -2.08 } },
        rear_passenger_10: { seatId: 'rear_passenger_10', role: 'PASSENGER', occupantId: null, localOffset: { x: 0.58, y: 0.70, z: -2.08 } },
      };
    }

    if (role === 'DRIVER') {
      if (veh.driverId && veh.driverId !== playerId) {
        const existingDriver = zonePlayers.get(veh.driverId);
        if (existingDriver && existingDriver.isHuman && existingDriver.connectionState === 'CONNECTED') {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: false,
              error: 'DRIVER_SEAT_OCCUPIED_BY_HUMAN',
              driverId: veh.driverId,
              reason: 'Cannot take control of a vehicle actively driven by another human player.',
            })
          );
          return;
        }
      }
      veh.driverId = playerId;
      veh.safetyState = 'NORMAL';
      veh.seats['driver'].occupantId = playerId;
      veh.passengerIds = (veh.passengerIds || []).filter((id) => id !== playerId);
      if (veh.conductorId === playerId) veh.conductorId = null;

      p.inVehicleId = vehicleId;
      p.isDriving = true;
      p.vehicleOccupancyRole = 'DRIVER';
      p.seatId = 'driver';
      p.avatarState = 'driving';
    } else if (role === 'CONDUCTOR') {
      if (veh.conductorId && veh.conductorId !== playerId) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'CONDUCTOR_SEAT_OCCUPIED' }));
        return;
      }
      if (veh.driverId === playerId) veh.driverId = null;
      veh.passengerIds = (veh.passengerIds || []).filter((id) => id !== playerId);
      veh.conductorId = playerId;
      veh.seats['conductor_step'].occupantId = playerId;

      p.inVehicleId = vehicleId;
      p.isDriving = false;
      p.vehicleOccupancyRole = 'CONDUCTOR';
      p.seatId = 'conductor_step';
      p.avatarState = 'idle';
    } else {
      // PASSENGER
      const passSeats = Object.values(veh.seats).filter((s) => s.role === 'PASSENGER');
      const freeSeat = passSeats.find((s) => !s.occupantId || s.occupantId === playerId);
      if (!freeSeat) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'NO_SEATS_AVAILABLE' }));
        return;
      }
      if (veh.driverId === playerId) veh.driverId = null;
      if (veh.conductorId === playerId) veh.conductorId = null;
      freeSeat.occupantId = playerId;
      if (!veh.passengerIds.includes(playerId)) {
        veh.passengerIds.push(playerId);
      }

      p.inVehicleId = vehicleId;
      p.isDriving = false;
      p.vehicleOccupancyRole = 'PASSENGER';
      p.seatId = freeSeat.seatId;
      p.avatarState = 'driving';
    }

    persistDurableZoneState();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        rewardAwardedOnBoard: 0,
        vehicle: veh,
        player: p,
      })
    );
    return;
  }

  if (url.pathname === '/vehicles/sync-transform' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const vehicleId = String(body.vehicleId || '');
    const driverId = authenticatedPlayerId;
    const veh = zoneVehicles.get(vehicleId);
    if (!veh) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'VEHICLE_NOT_FOUND' }));
      return;
    }
    if (!veh.driverId || veh.driverId !== driverId) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'ONLY_AUTHORITATIVE_DRIVER_CAN_SYNC_VEHICLE_TRANSFORM' }));
      return;
    }

    // Phase 4: Authoritative kinematic plausibility & anti-cheat validation
    const incomingSpeedKmh = typeof body.speedKmh === 'number' ? body.speedKmh : veh.speedKmh;
    if (!Number.isFinite(incomingSpeedKmh) || incomingSpeedKmh < 0 || incomingSpeedKmh > 180) {
      realtimeMetrics.movementRejectionsTotal += 1;
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'MOVEMENT_PLAUSIBILITY_REJECTED',
          reason: `Impossible vehicle speed (${incomingSpeedKmh} km/h exceeds 180 km/h ceiling).`,
        })
      );
      return;
    }

    if (body.position && veh.position) {
      const stepDist = distance2D(veh.position, body.position);
      if (stepDist > 1000) {
        realtimeMetrics.movementRejectionsTotal += 1;
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            error: 'MOVEMENT_PLAUSIBILITY_REJECTED',
            reason: `Impossible teleport distance (${stepDist.toFixed(1)}m in a single sync step).`,
          })
        );
        return;
      }
      if (typeof body.deltaTimeSeconds === 'number' && body.deltaTimeSeconds > 0) {
        const stepCheck = AntiCheatValidator.validateMovementStep(
          veh.vehicleClass || 'danfo_minibus',
          { x: veh.position.x, y: veh.position.y || 0, z: veh.position.z },
          { x: body.position.x, y: body.position.y || 0, z: body.position.z },
          body.deltaTimeSeconds,
          incomingSpeedKmh
        );
        if (!stepCheck.isValid) {
          realtimeMetrics.movementRejectionsTotal += 1;
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: false,
              error: 'MOVEMENT_PLAUSIBILITY_REJECTED',
              violationCode: stepCheck.violationCode,
              reason: stepCheck.details || 'Kinematic step exceeded physical velocity envelope.',
            })
          );
          return;
        }
      }
    }

    if (body.position) veh.position = body.position;
    if (typeof body.rotationY === 'number') veh.rotation = { x: 0, y: body.rotationY, z: 0 };
    if (typeof body.speedKmh === 'number') veh.speedKmh = body.speedKmh;

    const rotY = veh.rotation?.y || 0;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    // Synchronize world positions of all occupants (driver, passengers, conductor) to their exact seat offsets
    const syncedOccupants: Array<{ playerId: string; role: string; seatId: string; position: { x: number; y: number; z: number } }> = [];
    if (veh.seats) {
      for (const seat of Object.values(veh.seats)) {
        if (seat.occupantId) {
          const occPlayer = zonePlayers.get(seat.occupantId);
          if (occPlayer) {
            const wx = veh.position.x + seat.localOffset.x * cosY + seat.localOffset.z * sinY;
            const wy = (veh.position.y || 0) + seat.localOffset.y;
            const wz = veh.position.z - seat.localOffset.x * sinY + seat.localOffset.z * cosY;
            occPlayer.position = { x: Number(wx.toFixed(2)), y: Number(wy.toFixed(2)), z: Number(wz.toFixed(2)) };
            occPlayer.rotationY = rotY;
            syncedOccupants.push({
              playerId: occPlayer.playerId,
              role: occPlayer.vehicleOccupancyRole || seat.role,
              seatId: seat.seatId,
              position: occPlayer.position,
            });
          }
        }
      }
    }

    persistDurableZoneState();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        vehicle: veh,
        syncedOccupants,
      })
    );
    return;
  }

  if (url.pathname === '/vehicles/exit' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const playerId = authenticatedPlayerId;
    const vehicleId = String(body.vehicleId || '');
    const p = zonePlayers.get(playerId);
    const veh = zoneVehicles.get(vehicleId || (p?.inVehicleId || ''));
    if (veh) {
      if (veh.driverId === playerId) {
        veh.driverId = null;
        veh.speedKmh = 0;
      }
      if (veh.conductorId === playerId) veh.conductorId = null;
      veh.passengerIds = (veh.passengerIds || []).filter((id) => id !== playerId);
      if (veh.seats) {
        for (const s of Object.values(veh.seats)) {
          if (s.occupantId === playerId) s.occupantId = null;
        }
      }
    }
    if (p) {
      p.inVehicleId = null;
      p.isDriving = false;
      p.vehicleOccupancyRole = 'ON_FOOT';
      p.seatId = null;
      p.avatarState = 'idle';
      if (body.exitPosition) {
        p.position = body.exitPosition;
      } else if (veh) {
        p.position = { x: veh.position.x + 2.2, y: 0, z: veh.position.z };
      }
    }
    persistDurableZoneState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, vehicle: veh || null, player: p || null }));
    return;
  }

  if (url.pathname === '/vehicles/state' && req.method === 'GET') {
    const vehicleId = url.searchParams.get('vehicleId');
    if (vehicleId) {
      const veh = zoneVehicles.get(vehicleId);
      res.writeHead(veh ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(veh ? { ok: true, vehicle: veh } : { ok: false, error: 'NOT_FOUND' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, vehicles: Array.from(zoneVehicles.values()) }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[Project Eko Realtime] Zone Worker (${ZONE_ID}) running on http://localhost:${PORT}`);
});
