import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { PlayerProfile, VehicleState } from '@project-eko/contracts';
import {
  MARINA_CMS_NODES,
  MARINA_CMS_ROUTES,
  findShortestPath,
  CANONICAL_WORLD_ENTITIES,
  REQUIRED_CANONICAL_ENTITY_TYPES,
  CANONICAL_MEDIA_SLOTS,
  CANONICAL_MEDIA_CAMPAIGNS,
  CANONICAL_PROPERTY_PARCELS,
  resolveCanonicalEntity,
  searchCanonicalPlaces,
  calculateCanonicalRoute,
} from '@project-eko/world';
import { globalEconomyLedger } from '@project-eko/economy';
import { DriverCareerManager } from '@project-eko/game-core';
import { getLegacyBusinesses, getLegacyDanfoHustleState, getLegacyEconomicFlags, getLegacyHouseholdState, getLegacyPlayerProfile, getLegacyPropertyParcels, getLegacyRewardPointsBalance, getLegacySupplyState, getLegacyVehicleState, handleM47ApiRoutes, hasLegacyIdempotencyKey, persistAccountStore, recordLegacyIdempotencyKey, resolveAccountFromRequest, setLegacyPropertyParcels, setLegacyRewardPointsBalance, M47AccountRecord } from './m47Engine';
import { loadLegacyWorldState, saveLegacyWorldState } from './worldStateStore';
import { globalDbAdapter } from './dbAdapter';


const PORT = Number(process.env.PROJECT_EKO_API_PORT || 3001);
const LEDGER_DATA_DIR = process.env.PROJECT_EKO_DATA_DIR || path.join(__dirname, '..', 'data');
const LEDGER_STORE_PATH = path.join(LEDGER_DATA_DIR, 'economy_ledger.json');

// Restore the authoritative virtual-economy journal before seeding the demo
// profile or accepting requests. A corrupt journal must stop startup rather
// than silently resetting economic history.
if (fs.existsSync(LEDGER_STORE_PATH)) {
  try {
    const storedTransactions = JSON.parse(fs.readFileSync(LEDGER_STORE_PATH, 'utf8'));
    globalEconomyLedger.restoreTransactions(storedTransactions);
  } catch (error) {
    throw new Error(`Unable to restore economy ledger at ${LEDGER_STORE_PATH}: ${String(error)}`);
  }
}

globalEconomyLedger.setPersistenceHook((transactions) => {
  fs.mkdirSync(LEDGER_DATA_DIR, { recursive: true });
  const temporaryPath = `${LEDGER_STORE_PATH}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(transactions), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, LEDGER_STORE_PATH);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch (_) {}
    throw new Error(`Unable to durably persist economy ledger at ${LEDGER_STORE_PATH}: ${String(error)}`);
  }
});

const careerManager = new DriverCareerManager(globalEconomyLedger);

// Legacy API compatibility state is loaded from the authenticated account and
// persisted through M47's account store. AsyncLocalStorage keeps concurrent
// requests from crossing account boundaries.
const INITIAL_BALANCE_GN = 35000; // Baseline used only by the legacy economy-health comparison metric.
const legacyAccountContext = new AsyncLocalStorage<M47AccountRecord>();

function currentLegacyAccount(): M47AccountRecord {
  const account = legacyAccountContext.getStore();
  if (!account) throw new Error('Legacy domain state accessed without an authenticated account context.');
  return account;
}

function playerCashAccountCode(): string {
  return `Asset:Player:${currentLegacyAccount().accountId}:Cash`;
}

function bindRequestEventsToAccount(req: http.IncomingMessage, account: M47AccountRecord): void {
  const originalEmit = req.emit;
  (req as any).emit = function(eventName: string, ...args: any[]) {
    return legacyAccountContext.run(account, () => originalEmit.apply(this, [eventName, ...args]));
  };
}

function ensureLegacyAccountLedger(account: M47AccountRecord): void {
  const cashAccount = `Asset:Player:${account.accountId}:Cash`;
  const existingBalance = globalEconomyLedger.getAccountBalance(cashAccount);
  if (existingBalance === 0 && account.gameNairaBalance > 0) {
    globalEconomyLedger.postTransaction(
      `tx_opening_grant_${account.accountId}`,
      `ev_genesis_grant_${account.accountId}`,
      `idem_genesis_grant_${account.accountId}`,
      account.accountId,
      'Opening Citizen Treasury Grant (account migration)',
      [
        { accountCode: cashAccount, debit: account.gameNairaBalance, credit: 0 },
        { accountCode: 'Equity:Treasury:CitizenGrant', debit: 0, credit: account.gameNairaBalance },
      ]
    );
  }
}

const profileProxyCache = new WeakMap<object, object>();
function persistableProfileValue(value: any): any {
  if (!value || typeof value !== 'object') return value;
  const cached = profileProxyCache.get(value);
  if (cached) return cached;
  const proxy = new Proxy(value, {
    get(target, property, receiver) {
      return persistableProfileValue(Reflect.get(target, property, receiver));
    },
    set(target, property, next, receiver) {
      const account = currentLegacyAccount();
      const success = Reflect.set(target, property, next, receiver);
      if (property === 'gameNairaBalance') account.gameNairaBalance = Number(next);
      if (property === 'reputationScore') account.reputation = Number(next);
      persistAccountStore();
      return success;
    },
    deleteProperty(target, property) {
      const success = Reflect.deleteProperty(target, property);
      persistAccountStore();
      return success;
    },
  });
  profileProxyCache.set(value, proxy);
  return proxy;
}

const demoPlayer = new Proxy({} as PlayerProfile, {
  get(_target, property) {
    const account = currentLegacyAccount();
    const profile = getLegacyPlayerProfile(account);
    if (property === 'gameNairaBalance') return account.gameNairaBalance;
    if (property === 'reputationScore') return account.reputation;
    return persistableProfileValue(profile[String(property)]);
  },
  set(_target, property, value) {
    const account = currentLegacyAccount();
    const profile = getLegacyPlayerProfile(account);
    profile[String(property)] = value;
    if (property === 'gameNairaBalance') account.gameNairaBalance = Number(value);
    if (property === 'reputationScore') account.reputation = Number(value);
    persistAccountStore();
    return true;
  },
  ownKeys() {
    return Reflect.ownKeys(getLegacyPlayerProfile(currentLegacyAccount()));
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Object.getOwnPropertyDescriptor(getLegacyPlayerProfile(currentLegacyAccount()), property);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

const legacyVehicleState = new Proxy({} as { fuelLiters: number; condition: number }, {
  get(_target, property) {
    return getLegacyVehicleState(currentLegacyAccount())[String(property) as 'fuelLiters' | 'condition'];
  },
  set(_target, property, value) {
    const state = getLegacyVehicleState(currentLegacyAccount());
    if (property !== 'fuelLiters' && property !== 'condition') return false;
    state[property] = Number(value);
    persistAccountStore();
    return true;
  },
  ownKeys() {
    return Reflect.ownKeys(getLegacyVehicleState(currentLegacyAccount()));
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Object.getOwnPropertyDescriptor(getLegacyVehicleState(currentLegacyAccount()), property);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

// Persistent Module-Scope World & Economic State
const dealershipCatalog = [
  { modelId: 'koro_okada_125', vKey: 'okada', name: 'Koro Okada 125cc', category: 'Two-Wheeler Dispatch', priceGN: 35000, description: 'Agile motorcycle, weaves through heavy go-slow traffic', capacity: 1 },
  { modelId: 'apex_keke_napep', vKey: 'keke', name: 'Apex Keke NAPEP 200', category: 'Commercial Tricycle', priceGN: 65000, description: 'Commercial 3-passenger transport with weather canvas', capacity: 3 },
  { modelId: 'adera_compact_16', vKey: 'sedan', name: 'Adera Compact 1.6 Sedan', category: 'Private / EkoRide Taxi', priceGN: 120000, description: 'Reliable 4-door executive sedan, smooth handling', capacity: 4 },
  { modelId: 'apex_danfo_14', vKey: 'danfo', name: 'Apex Danfo 14 Minibus', category: 'Commercial Mass Transit', priceGN: 250000, description: 'Iconic yellow Lagos workhorse with 14 passenger seating', capacity: 14 },
  { modelId: 'ekobrt_coach_42', vKey: 'brt', name: 'EkoBRT 42 High-Capacity Coach', category: 'Metropolitan BRT Corridor', priceGN: 380000, description: 'LAMATA blue metropolitan high-capacity transit coach', capacity: 42 }
];

const busStopTemplates = [
  { id: 'cms_terminal', alias: 'stop_cms', name: 'CMS Bus Terminal Bay', location: { x: -110.2, y: 0, z: -200 }, waitingPassengers: 8, destination: 'TBS Plaza', baseFareGN: 200, surgeMultiplier: 1.0 },
  { id: 'broad_st_mid', alias: 'stop_broad_mid', name: 'Broad Street Central Stop', location: { x: -88.5, y: 0, z: -90 }, waitingPassengers: 5, destination: 'TBS Plaza', baseFareGN: 150, surgeMultiplier: 1.0 },
  { id: 'tbs_loop', alias: 'stop_tbs', name: 'Tafawa Balewa Square Loop', location: { x: -110.2, y: 0, z: 45 }, waitingPassengers: 6, destination: 'CMS Terminal', baseFareGN: 250, surgeMultiplier: 1.0 }
];

const vehicleMaxFuelLiters = 50.0;
const fuelPricePerLiterGN = 110;
const rewardPointsBalance = new Proxy({} as { value: number }, {
  get(_target, property) {
    if (property !== 'value') return undefined;
    return getLegacyRewardPointsBalance(currentLegacyAccount());
  },
  set(_target, property, value) {
    if (property !== 'value') return false;
    setLegacyRewardPointsBalance(currentLegacyAccount(), Number(value));
    return true;
  },
});

const businessTemplates = [
  {
    id: 'biz_suya_haruna',
    name: "Mallam Haruna's Suya Franchise",
    location: 'Broad Street Night Grill',
    category: 'Street Food & Night Economy',
    owned: true,
    hourlyEarningsGN: 1200,
    unclaimedEarningsGN: 2400,
    inventoryStatus: 'Spices & Beef Stock 82%'
  },
  {
    id: 'biz_bukka_nkechi',
    name: "Mama Nkechi's Marina Bukka",
    location: 'CMS Terminal Food Court',
    category: 'Fast Casual Dining',
    owned: false,
    permitCostGN: 80000,
    projectedHourlyGN: 3500,
    unclaimedEarningsGN: 0
  },
  {
    id: 'biz_parts_balogun',
    name: 'Balogun Auto Spare Parts Depot',
    location: 'Broad Street Corner',
    category: 'Automotive Commercial Retail',
    owned: false,
    permitCostGN: 150000,
    projectedHourlyGN: 6000,
    unclaimedEarningsGN: 0
  }
];

const businessesRegistry = new Proxy(businessTemplates, {
  get(_target, property) {
    const businesses = persistableProfileValue(getLegacyBusinesses(currentLegacyAccount(), businessTemplates));
    return Reflect.get(businesses, property, businesses);
  },
  set(_target, property, value) {
    const businesses = getLegacyBusinesses(currentLegacyAccount(), businessTemplates);
    const success = Reflect.set(businesses, property, value);
    persistAccountStore();
    return success;
  },
  ownKeys() {
    return Reflect.ownKeys(getLegacyBusinesses(currentLegacyAccount(), businessTemplates));
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Object.getOwnPropertyDescriptor(getLegacyBusinesses(currentLegacyAccount(), businessTemplates), property);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

const legacyEconomicFlags = new Proxy({} as { fleetCollectedThisShift: boolean; businessCollectedThisShift: boolean }, {
  get(_target, property) {
    return getLegacyEconomicFlags(currentLegacyAccount())[String(property) as 'fleetCollectedThisShift' | 'businessCollectedThisShift'];
  },
  set(_target, property, value) {
    if (property !== 'fleetCollectedThisShift' && property !== 'businessCollectedThisShift') return false;
    getLegacyEconomicFlags(currentLegacyAccount())[property] = Boolean(value);
    persistAccountStore();
    return true;
  },
});

const retailInventoryTemplates = [
  { businessId: 'biz_suya_haruna', name: "Mallam Haruna's Suya Stand", stockLevel: 28, maxStockLevel: 50, unitRetailPriceGN: 500, unitWholesaleCostGN: 250, status: 'OPTIMAL' },
  { businessId: 'biz_bukka_nkechi', name: "Mama Nkechi's Marina Bukka", stockLevel: 42, maxStockLevel: 60, unitRetailPriceGN: 500, unitWholesaleCostGN: 280, status: 'OPTIMAL' }
];

const cargoBatchTemplates = [
  { cargoId: 'cargo_suya_meat_01', source: 'Balogun Wholesale Depot', destination: "Mallam Haruna's Suya Stand", cargoType: 'Marinated Beef Skewers & Yaji Spices', freightPayoutGN: 1800, status: 'READY_AT_DEPOT' }
];

const supplyStateDefaults = { retailInventories: retailInventoryTemplates, activeCargoBatches: cargoBatchTemplates };
const legacySupplyState = new Proxy({} as typeof supplyStateDefaults, {
  get(_target, property) {
    const state = getLegacySupplyState(currentLegacyAccount(), supplyStateDefaults);
    return persistableProfileValue(state[String(property) as 'retailInventories' | 'activeCargoBatches']);
  },
  set(_target, property, value) {
    if (property !== 'retailInventories' && property !== 'activeCargoBatches') return false;
    getLegacySupplyState(currentLegacyAccount(), supplyStateDefaults)[property] = value;
    persistAccountStore();
    return true;
  },
});

const cityEventTemplates = [
  { id: 'event_owambe_tbs', name: 'TBS Owambe Saturday Celebration', description: 'Massive wedding reception at Tafawa Balewa Square! Transport demand surges +40%, Suya demand doubled.', demandModifier: 1.4, fuelPriceModifier: 1.0, active: true, timeRemainingSeconds: 720 },
  { id: 'event_marina_rush', name: 'Marina Financial District Rush Hour', description: 'Corporate offices close along Broad Street. Surging passenger queues for Danfos and Kekes.', demandModifier: 1.3, fuelPriceModifier: 1.05, active: false, timeRemainingSeconds: 0 }
];

const sharedWorldState = loadLegacyWorldState({
  busStops: busStopTemplates,
  cityEvents: cityEventTemplates,
  commerceState: {
    mediaSlots: JSON.parse(JSON.stringify(CANONICAL_MEDIA_SLOTS)),
    mediaCampaigns: JSON.parse(JSON.stringify(CANONICAL_MEDIA_CAMPAIGNS)),
    routeSelectionLog: [],
    mediaEventsLog: [],
  },
});
const busStops = sharedWorldState.busStops;
const cityEvents = sharedWorldState.cityEvents;

const ALLOWED_API_CORS_ORIGINS = (process.env.PROJECT_EKO_CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8090,http://127.0.0.1:8090,http://localhost:8094,http://127.0.0.1:8094,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedApiCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_API_CORS_ORIGINS.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  return false;
}

const apiMetrics = {
  startedAtMs: Date.now(),
  requestsTotal: 0,
  errors4xxTotal: 0,
  errors5xxTotal: 0,
};

const server = http.createServer(async (req, res) => {
  apiMetrics.requestsTotal += 1;

  // Security & Origin-Allowlist CORS Headers (Never Wildcard '*')
  const requestOrigin = req.headers.origin;
  if (requestOrigin && isAllowedApiCorsOrigin(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  } else if (ALLOWED_API_CORS_ORIGINS.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_API_CORS_ORIGINS[0]);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, X-Staff-Role');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  const origWriteHead = res.writeHead.bind(res);
  (res as any).writeHead = (statusCode: number, ...args: any[]) => {
    if (statusCode >= 500) apiMetrics.errors5xxTotal += 1;
    else if (statusCode >= 400) apiMetrics.errors4xxTotal += 1;
    return origWriteHead(statusCode, ...args);
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 256 * 1024) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'PAYLOAD_TOO_LARGE', maxBytes: 256 * 1024 }));
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'project-eko-domain-api',
      timestamp: Date.now(),
      ledgerBalanced: globalEconomyLedger.auditIntegrity().isBalanced,
      fiatPayoutsEnabled: false,
      livePayoutKillSwitchActive: true
    }));
    return;
  }

  if (url.pathname === '/readyz') {
    const dbHealth = globalDbAdapter.getHealthReport();
    const ledgerAudit = globalEconomyLedger.auditIntegrity();
    const isReady = dbHealth.ready && ledgerAudit.isBalanced;
    res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: isReady ? 'ready' : 'degraded',
      service: 'project-eko-domain-api',
      timestamp: Date.now(),
      database: dbHealth,
      ledgerBalanced: ledgerAudit.isBalanced,
      fiatPayoutsEnabled: false,
    }));
    return;
  }

  if (url.pathname === '/metrics') {
    const dbHealth = globalDbAdapter.getHealthReport();
    const ledgerAudit = globalEconomyLedger.auditIntegrity();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'project-eko-domain-api',
      uptimeSeconds: Math.round((Date.now() - apiMetrics.startedAtMs) / 1000),
      requestsTotal: apiMetrics.requestsTotal,
      errors4xxTotal: apiMetrics.errors4xxTotal,
      errors5xxTotal: apiMetrics.errors5xxTotal,
      ledgerTransactionsTotal: globalEconomyLedger.exportTransactions().length,
      ledgerBalanced: ledgerAudit.isBalanced,
      dbCommittedTxCount: dbHealth.committedTxCount,
      dbRolledBackTxCount: dbHealth.rolledBackTxCount,
    }));
    return;
  }

  if (url.pathname === '/api/v1/db/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      database: globalDbAdapter.getHealthReport(),
      ledgerAudit: globalEconomyLedger.auditIntegrity(),
    }));
    return;
  }

  if (url.pathname === '/api/v1/db/backup' && req.method === 'POST') {
    const snapshot = globalDbAdapter.createBackupSnapshot('api_triggered');
    const verification = globalDbAdapter.verifyBackupSnapshot(snapshot.backupFilePath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: verification.valid,
      snapshot,
      verification,
    }));
    return;
  }

  // Give account/session routes first refusal, then bind each legacy domain
  // request to the authenticated account's durable player profile and wallet.
  if (url.pathname.startsWith('/api/v1/') && await handleM47ApiRoutes(url, req, res)) return;
  if (url.pathname.startsWith('/api/v1/')) {
    if (url.searchParams.has('sessionToken')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: 'SESSION_TOKEN_IN_URL_FORBIDDEN',
        message: 'Session tokens must be passed in X-Session-Token or Authorization: Bearer headers.',
      }));
      return;
    }
    const account = resolveAccountFromRequest(url, req);
    if (!account) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'AUTHENTICATION_REQUIRED' }));
      return;
    }
    ensureLegacyAccountLedger(account);
    getLegacyPlayerProfile(account);
    bindRequestEventsToAccount(req, account);
    return legacyAccountContext.run(account, async () => {

  // GET /api/v1/player/profile
  if (url.pathname === '/api/v1/player/profile' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      player: demoPlayer,
      vehicleState: {
        fuelLiters: legacyVehicleState.fuelLiters,
        maxFuelLiters: vehicleMaxFuelLiters,
        condition: legacyVehicleState.condition
      },
      ledgerAudit: globalEconomyLedger.auditIntegrity()
    }));
    return;
  }

  // GET /api/v1/world/nodes
  if (url.pathname === '/api/v1/world/nodes' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ nodes: MARINA_CMS_NODES, routes: MARINA_CMS_ROUTES }));
    return;
  }

  // GET /api/v1/missions/available
  if (url.pathname === '/api/v1/missions/available' && req.method === 'GET') {
    const missions = careerManager.generateAvailableMissions();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ missions }));
    return;
  }

  // POST /api/v1/missions/accept
  if (url.pathname === '/api/v1/missions/accept' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const missionId = data.missionId;
      const missions = careerManager.generateAvailableMissions();
      // Support UI alias IDs ('mis_cms_to_tbs' and 'mis_broad_shuttle') in addition to canonical IDs
      const aliasMap: Record<string, string> = {
        mis_cms_to_tbs: 'mis_cms_to_tbs_corporate',
        mis_broad_shuttle: 'mis_marina_promenade_tourist'
      };
      const resolvedId = aliasMap[missionId] || missionId;
      const target = missions.find((m) => m.missionId === resolvedId);
      if (!target) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Mission not found', requestedId: missionId }));
        return;
      }

      const accepted = careerManager.acceptMission(demoPlayer.playerId, target);
      demoPlayer.activeMissionId = accepted.missionId;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ acceptedMission: accepted, player: demoPlayer }));
    });
    return;
  }

  // POST /api/v1/missions/complete
  if (url.pathname === '/api/v1/missions/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const activeMissionId = demoPlayer.activeMissionId;
      const activeMission = careerManager.generateAvailableMissions().find((mission) => mission.missionId === activeMissionId);
      if (!activeMission || data.missionId !== activeMissionId) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'NO_MATCHING_ACTIVE_MISSION' }));
        return;
      }
      if (!Array.isArray(data.passedCheckpoints) || typeof data.idempotencyKey !== 'string' || !data.idempotencyKey.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MISSION_EVIDENCE_AND_IDEMPOTENCY_REQUIRED' }));
        return;
      }
      try {
        const result = careerManager.completeMission(
          demoPlayer.playerId,
          demoPlayer,
          data.passedCheckpoints,
          0.8,
          `${demoPlayer.playerId}:mission:${data.idempotencyKey.trim()}`
        );
        demoPlayer.activeMissionId = null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...result, ledgerAudit: globalEconomyLedger.auditIntegrity() }));
      } catch (err: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/v1/trips/complete (Direct EkoRide / LASDRI / Danfo Rush Trip Settlement with Double-Entry Ledger)
  if (url.pathname === '/api/v1/trips/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const tripType = String(data.tripType || 'ekoride_passenger_trip');
      // Settlement values come from the server's trip catalogue. Browser-computed
      // fare totals, reputation and descriptions are presentation only.
      const tripMissionCatalog: Record<string, string> = {
        mis_cms_to_tbs: 'mis_cms_to_tbs_corporate',
        mis_cms_to_tbs_corporate: 'mis_cms_to_tbs_corporate',
        mis_broad_shuttle: 'mis_marina_promenade_tourist',
        mis_marina_promenade_tourist: 'mis_marina_promenade_tourist'
      };
      const canonicalMissionId = tripMissionCatalog[tripType];
      const activeMission = careerManager.generateAvailableMissions().find((mission) => mission.missionId === canonicalMissionId);
      if (!canonicalMissionId || !activeMission) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNSUPPORTED_TRIP_TYPE', message: 'Trip type is not in the server settlement catalogue.' }));
        return;
      }
      if (demoPlayer.activeMissionId !== canonicalMissionId) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'NO_MATCHING_ACTIVE_MISSION', message: 'Accept this mission before settling its trip.' }));
        return;
      }
      if (!Array.isArray(data.passedCheckpoints)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MISSION_CHECKPOINTS_REQUIRED' }));
        return;
      }

      if (typeof data.idempotencyKey !== 'string' || !data.idempotencyKey.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'IDEMPOTENCY_KEY_REQUIRED' }));
        return;
      }

      const idemKey = `${demoPlayer.playerId}:mission:${data.idempotencyKey.trim()}`;
      try {
        const result = careerManager.completeMission(
          demoPlayer.playerId,
          demoPlayer,
          data.passedCheckpoints,
          0.8,
          idemKey
        );
        demoPlayer.activeMissionId = null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          tripType,
          missionId: canonicalMissionId,
          earnedGN: result.netGameNaira,
          grossRewardGN: result.earnedGameNaira,
          reputation: demoPlayer.reputationScore,
          newBalance: result.updatedBalance,
          transactionId: result.transactionId,
          ledgerAudit: globalEconomyLedger.auditIntegrity()
        }));
      } catch (e: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MISSION_SETTLEMENT_REJECTED', message: e?.message || 'Mission settlement rejected.' }));
        return;
      }
    });
    return;
  }

  // GET /api/v1/economy/ledger/audit
  if (url.pathname === '/api/v1/economy/ledger/audit' && req.method === 'GET') {
    const audit = globalEconomyLedger.auditIntegrity();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      audit,
      playerCashAccountBalance: globalEconomyLedger.getAccountBalance(playerCashAccountCode()),
      playerProfileBalance: demoPlayer.gameNairaBalance
    }));
    return;
  }

  // GET /api/v1/dealership/inventory
  if (url.pathname === '/api/v1/dealership/inventory' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      dealership: 'Berger Auto Dealership • Marina Lot',
      vehicles: dealershipCatalog.map(v => ({
        ...v,
        owned: demoPlayer.ownedVehicleIds.some(id => id === v.modelId || id.includes(v.modelId))
      })),
      playerBalance: demoPlayer.gameNairaBalance,
      ownedVehicleIds: demoPlayer.ownedVehicleIds
    }));
    return;
  }

  // POST /api/v1/dealership/purchase
  if (url.pathname === '/api/v1/dealership/purchase' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const modelId = data.modelId;
      const vehSpec = dealershipCatalog.find(v => v.modelId === modelId || v.vKey === modelId);
      if (!vehSpec) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNKNOWN_VEHICLE_MODEL', message: `Unknown vehicle model: ${modelId}` }));
        return;
      }
      const alreadyOwned = demoPlayer.ownedVehicleIds.some(id => id === vehSpec.modelId || id.includes(vehSpec.modelId));
      if (alreadyOwned && !data.allowDuplicate) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'VEHICLE_ALREADY_OWNED',
          message: `${vehSpec.name} is already in your Personal Garage. Use Summon to Curb instead.`
        }));
        return;
      }
      const price = vehSpec.priceGN;
      if (demoPlayer.gameNairaBalance < price) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_FUNDS',
          message: `Insufficient Game Naira balance (Need ₦${price.toLocaleString()} GN, Have ₦${demoPlayer.gameNairaBalance.toLocaleString()} GN)`,
          requiredGN: price,
          currentBalanceGN: demoPlayer.gameNairaBalance
        }));
        return;
      }

      const newVehId = vehSpec.modelId;
      const txId = `tx_veh_${vehSpec.modelId}_${Date.now()}`;
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_${txId}`)}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_dealership_purchase_${vehSpec.modelId}`,
          idemKey,
          demoPlayer.playerId,
          `Purchased ${vehSpec.name} from Berger Auto Dealership`,
          [
            { accountCode: 'Asset:Player:Vehicles', debit: price, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: price }
          ]
        );
        if (posted.transactionId !== txId) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VEHICLE_PURCHASE_REPLAY_REJECTED', transactionId: posted.transactionId }));
          return;
        }
      } catch (e: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'VEHICLE_PURCHASE_REJECTED', details: String(e?.message || e) }));
        return;
      }

      demoPlayer.gameNairaBalance -= price;
      if (!demoPlayer.ownedVehicleIds.includes(newVehId)) demoPlayer.ownedVehicleIds.push(newVehId);
      demoPlayer.currentVehicleId = newVehId;
      demoPlayer.reputationScore += 35;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        vehicleId: newVehId,
        vehicleKey: vehSpec.vKey,
        vehicleName: vehSpec.name,
        pricePaidGN: price,
        newBalance: demoPlayer.gameNairaBalance,
        ownedVehicleIds: demoPlayer.ownedVehicleIds,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // GET /api/v1/fleet/overview
  if (url.pathname === '/api/v1/fleet/overview' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      fleet: {
        activeVehicles: 2,
        collectedThisShift: legacyEconomicFlags.fleetCollectedThisShift,
        assignedDrivers: [
          { driverId: 'drv_tunde', name: 'Driver Tunde', vehicle: 'Apex Danfo 14 (#01)', corridor: 'CMS ⇄ TBS Corridor', dailyGrossGN: 8400, commissionPct: 35, status: 'On Route' },
          { driverId: 'drv_segun', name: 'Driver Segun', vehicle: 'Apex Keke (#01)', corridor: 'Marina ⇄ Idumota Market', dailyGrossGN: 5200, commissionPct: 30, status: 'On Route' }
        ],
        financials: {
          grossRevenueGN: 13600,
          driverCommissionsGN: 4760,
          fuelAndMaintenanceGN: 2040,
          unionLevyGN: 1360,
          netDailyProfitGN: legacyEconomicFlags.fleetCollectedThisShift ? 0 : 5440
        }
      }
    }));
    return;
  }

  // POST /api/v1/fleet/collect
  if (url.pathname === '/api/v1/fleet/collect' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (legacyEconomicFlags.fleetCollectedThisShift) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'ALREADY_COLLECTED',
          message: 'Fleet daily profits have already been collected for this shift.'
        }));
        return;
      }
      const netProfit = 5440;
      const txId = `tx_fleet_settle_${demoPlayer.playerId}`;
      const idemKey = `${demoPlayer.playerId}:idem_fleet_daily_settlement`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        legacyEconomicFlags.fleetCollectedThisShift = true;
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ALREADY_COLLECTED', message: 'Fleet settlement already exists in the ledger.' }));
        return;
      }
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          'ev_fleet_daily_settlement',
          idemKey,
          demoPlayer.playerId,
          'Daily Commercial Fleet Net Settlement (Driver Tunde & Driver Segun)',
          [
            { accountCode: playerCashAccountCode(), debit: netProfit, credit: 0 },
            { accountCode: 'Revenue:Fleet:DailyRemittance', debit: 0, credit: netProfit }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Fleet settlement replay rejected.');
      } catch (e: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'FLEET_SETTLEMENT_REJECTED', details: String(e?.message || e) }));
        return;
      }
      legacyEconomicFlags.fleetCollectedThisShift = true;
      demoPlayer.gameNairaBalance += netProfit;
      demoPlayer.reputationScore += 15;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        collectedGN: netProfit,
        newBalance: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        auditStatus: 'PASSED',
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // GET /api/v1/businesses/registry
  if (url.pathname === '/api/v1/businesses/registry' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      businesses: businessesRegistry,
      collectedThisShift: legacyEconomicFlags.businessCollectedThisShift
    }));
    return;
  }

  // POST /api/v1/businesses/collect
  if (url.pathname === '/api/v1/businesses/collect' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (legacyEconomicFlags.businessCollectedThisShift) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'ALREADY_COLLECTED',
          message: 'Franchise earnings have already been collected for this shift.'
        }));
        return;
      }
      const earnings = 2400;
      const txId = `tx_biz_collect_${demoPlayer.playerId}`;
      const idemKey = `${demoPlayer.playerId}:idem_business_daily_settlement`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        legacyEconomicFlags.businessCollectedThisShift = true;
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ALREADY_COLLECTED', message: 'Business settlement already exists in the ledger.' }));
        return;
      }
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          'ev_business_revenue_collect',
          idemKey,
          demoPlayer.playerId,
          "Collected Mallam Haruna's Suya Franchise Revenue",
          [
            { accountCode: playerCashAccountCode(), debit: earnings, credit: 0 },
            { accountCode: 'Revenue:Business:SuyaFranchise', debit: 0, credit: earnings }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Business settlement replay rejected.');
      } catch (e: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_SETTLEMENT_REJECTED', details: String(e?.message || e) }));
        return;
      }

      legacyEconomicFlags.businessCollectedThisShift = true;
      demoPlayer.gameNairaBalance += earnings;
      demoPlayer.reputationScore += 10;
      const suyaBiz = businessesRegistry.find(b => b.id === 'biz_suya_haruna');
      if (suyaBiz) suyaBiz.unclaimedEarningsGN = 0;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        collectedGN: earnings,
        newBalance: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/businesses/acquire
  if (url.pathname === '/api/v1/businesses/acquire' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const bizId = data.businessId === 'bukka' ? 'biz_bukka_nkechi' : (data.businessId === 'parts' ? 'biz_parts_balogun' : data.businessId);
      const targetBiz = businessesRegistry.find(b => b.id === bizId);
      if (!targetBiz) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNKNOWN_BUSINESS', message: 'Business concession not found in registry.' }));
        return;
      }
      const idemKey = `${demoPlayer.playerId}:idem_business_acquire_${targetBiz.id}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_ACQUISITION_REPLAY_REJECTED', businessId: targetBiz.id }));
        return;
      }
      if (targetBiz.owned) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ALREADY_OWNED', message: `You already own ${targetBiz.name}.` }));
        return;
      }
      const cost = targetBiz.permitCostGN || 80000;
      if (demoPlayer.gameNairaBalance < cost) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_FUNDS',
          message: `Acquiring ${targetBiz.name} requires ₦${cost.toLocaleString()} GN permit fee (Current balance: ₦${demoPlayer.gameNairaBalance.toLocaleString()} GN).`,
          requiredGN: cost,
          currentBalanceGN: demoPlayer.gameNairaBalance
        }));
        return;
      }

      const txId = `tx_biz_acquire_${demoPlayer.playerId}_${targetBiz.id}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_acquire_${targetBiz.id}`,
          idemKey,
          demoPlayer.playerId,
          `Acquired Commercial Concession Permit: ${targetBiz.name}`,
          [
            { accountCode: 'Asset:Player:BusinessConcessions', debit: cost, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: cost }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Business acquisition replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_ACQUISITION_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance -= cost;
      targetBiz.owned = true;
      demoPlayer.reputationScore += 45;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        business: targetBiz,
        permitCostGN: cost,
        newBalance: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/commerce/purchase (Suya, Roadside Gala/Drinks, Bayo Keke Shuttle)
  if (url.pathname === '/api/v1/commerce/purchase' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const itemType = String(data.itemType || 'suya');
      const catalog: Record<string, { name: string; priceGN: number; healthRestore: number }> = {
        suya: { name: "Mallam Haruna's Spicy Beef Suya", priceGN: 500, healthRestore: 100 },
        gala: { name: 'Roadside Beef Gala & Cold La Casera', priceGN: 300, healthRestore: 15 },
        keke_shuttle: { name: 'Bayo Keke Marina Shuttle Fare', priceGN: 400, healthRestore: 0 }
      };
      const item = catalog[itemType];
      if (!item) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNKNOWN_COMMERCE_ITEM', itemType }));
        return;
      }

      if (demoPlayer.gameNairaBalance < item.priceGN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_FUNDS',
          message: `Insufficient Game Naira for ${item.name} (Need ₦${item.priceGN} GN, Have ₦${demoPlayer.gameNairaBalance} GN).`,
          requiredGN: item.priceGN
        }));
        return;
      }

      const suyaStall = itemType === 'suya'
        ? legacySupplyState.retailInventories.find(r => r.businessId === 'biz_suya_haruna')
        : undefined;
      if (itemType === 'suya') {
        if (suyaStall && suyaStall.stockLevel <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'OUT_OF_STOCK',
            message: "Mallam Haruna's Suya Stand is out of stock! Deliver wholesale beef from Balogun Depot first."
          }));
          return;
        }
      }

      const txId = `tx_comm_${itemType}_${demoPlayer.playerId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_${txId}`)}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'COMMERCE_PURCHASE_REPLAY_REJECTED' }));
        return;
      }
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_commerce_${itemType}`,
          idemKey,
          demoPlayer.playerId,
          `Purchased ${item.name} (-₦${item.priceGN} GN)`,
          [
            { accountCode: 'Expense:Player:Consumables', debit: item.priceGN, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: item.priceGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Commerce purchase replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'COMMERCE_PURCHASE_REJECTED', details: String(error?.message || error) }));
        return;
      }

      if (suyaStall) suyaStall.stockLevel = Math.max(0, suyaStall.stockLevel - 1);
      demoPlayer.gameNairaBalance -= item.priceGN;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        itemType,
        itemName: item.name,
        pricePaidGN: item.priceGN,
        healthRestore: item.healthRestore,
        newBalance: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  const sandboxRewardsCatalog = [
    { rewardId: 'rw_data_10gb', name: '10GB High-Speed Mobile Data', partner: 'MTN / Airtel Nigeria', pointsCost: 1500, category: 'Telecom' },
    { rewardId: 'rw_power_5k', name: '₦5,000 Electricity Utility Token', partner: 'Eko Electricity Distribution (EKEDC)', pointsCost: 3000, category: 'Utilities' },
    { rewardId: 'rw_fuel_15l', name: '15L Fuel Voucher', partner: 'NNPC Retail Station', pointsCost: 2500, category: 'Transport' }
  ];

  // GET /api/v1/rewards/sandbox
  if (url.pathname === '/api/v1/rewards/sandbox' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pointsBalance: rewardPointsBalance.value,
      regulatoryNotice: {
        payoutEnabled: false,
        status: 'DISABLED_PENDING_REGULATORY_CLEARANCE',
        complianceAuthority: 'Central Bank of Nigeria (CBN) / SEC Guidelines',
        message: 'Real-money payout is strictly disabled pending licensed Payment Service Provider integration. Sandbox mode active.'
      },
      rewardsCatalog: sandboxRewardsCatalog
    }));
    return;
  }

  // POST /api/v1/rewards/redeem (Sandbox Point Redemption — Strict Non-Fiat Compliance Lockout)
  if (url.pathname === '/api/v1/rewards/redeem' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (data.requestFiatPayout) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'COMPLIANCE_LOCKOUT_ACTIVE',
          payoutEnabled: false,
          message: 'Real-money fiat conversion is strictly prohibited in Sandbox Mode under CBN/SEC compliance controls.'
        }));
        return;
      }
      const rewardId = typeof data.rewardId === 'string' ? data.rewardId.trim() : '';
      const reward = sandboxRewardsCatalog.find((entry) => entry.rewardId === rewardId);
      if (!reward) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'REWARD_NOT_FOUND',
          rewardId
        }));
        return;
      }
      const cost = reward.pointsCost;
      if (rewardPointsBalance.value < cost) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_REWARD_POINTS',
          message: `Need ${cost} Sandbox Points (Current balance: ${rewardPointsBalance.value} Pts).`
        }));
        return;
      }
      rewardPointsBalance.value -= cost;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        rewardId: reward.rewardId,
        pointsDeducted: cost,
        remainingPoints: rewardPointsBalance.value,
        payoutEnabled: false,
        sandboxVoucherCode: `EKO-SBX-${reward.rewardId.toUpperCase()}-${Date.now().toString().slice(-4)}`
      }));
    });
    return;
  }

  // ==========================================
  // M2.5 WORLD-DRIVEN ECONOMIC ENDPOINTS
  // ==========================================

  // GET /api/v1/transit/stops
  if (url.pathname === '/api/v1/transit/stops' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ stops: busStops }));
    return;
  }

  // POST /api/v1/transit/board
  if (url.pathname === '/api/v1/transit/board' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const stopId = data.stopId || 'cms_terminal';
      const targetStop = busStops.find(s => s.id === stopId || s.alias === stopId) || busStops[0];
      const requestedPassengers = Math.floor(Number(data.passengerCount || 1));
      if (!Number.isFinite(requestedPassengers) || requestedPassengers < 1 || targetStop.waitingPassengers < 1) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'NO_WAITING_PASSENGERS' }));
        return;
      }
      const passengerCount = Math.min(requestedPassengers, targetStop.waitingPassengers);
      const farePerHead = Math.max(0, Math.round(targetStop.baseFareGN * targetStop.surgeMultiplier));
      const totalFare = farePerHead * passengerCount;
      const txId = `tx_fare_${demoPlayer.playerId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_${txId}`)}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TRANSIT_FARE_REPLAY_REJECTED' }));
        return;
      }
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_board_${targetStop.id}`,
          idemKey,
          demoPlayer.playerId,
          `Physical passenger boarding fare collected (${passengerCount} pax @ ${targetStop.name})`,
          [
            { accountCode: playerCashAccountCode(), debit: totalFare, credit: 0 },
            { accountCode: 'Revenue:Transport:Fare', debit: 0, credit: totalFare }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Transit fare replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TRANSIT_FARE_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance += totalFare;
      demoPlayer.reputationScore += Math.max(1, Math.round(passengerCount * 2));
      targetStop.waitingPassengers -= passengerCount;
      saveLegacyWorldState(sharedWorldState);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        stopId: targetStop.id,
        boardedCount: passengerCount,
        totalFareGN: totalFare,
        newBalance: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        remainingStopQueue: targetStop.waitingPassengers,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/vehicle/refuel
  if (url.pathname === '/api/v1/vehicle/refuel' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const fuelNeeded = Math.max(0, vehicleMaxFuelLiters - legacyVehicleState.fuelLiters);
      const requestedLiters = data.liters !== undefined ? Number(data.liters) : fuelNeeded;
      if (!Number.isFinite(requestedLiters) || requestedLiters <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_FUEL_AMOUNT' }));
        return;
      }
      const litersNeeded = Math.min(fuelNeeded, requestedLiters);
      const totalCost = Math.round(litersNeeded * fuelPricePerLiterGN);

      if (totalCost <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TANK_ALREADY_FULL', message: 'Fuel tank is already at 50L capacity.' }));
        return;
      }

      if (demoPlayer.gameNairaBalance < totalCost) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INSUFFICIENT_FUNDS', requiredGN: totalCost, currentBalanceGN: demoPlayer.gameNairaBalance }));
        return;
      }

      const txId = `tx_fuel_${demoPlayer.playerId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_${txId}`)}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'REFUEL_REPLAY_REJECTED' }));
        return;
      }
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          'ev_refuel_filling_station',
          idemKey,
          demoPlayer.playerId,
          `Fuel purchase at TotalEnergies Filling Station (${litersNeeded.toFixed(1)}L @ ₦${fuelPricePerLiterGN}/L)`,
          [
            { accountCode: 'Expense:Transport:Fuel', debit: totalCost, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: totalCost }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Refuel replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'REFUEL_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance -= totalCost;
      legacyVehicleState.fuelLiters += litersNeeded;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        litersPumped: litersNeeded,
        totalCostGN: totalCost,
        newFuelLiters: legacyVehicleState.fuelLiters,
        newBalance: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/vehicle/service
  if (url.pathname === '/api/v1/vehicle/service' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const wear = Math.max(0, 100 - legacyVehicleState.condition);
      const serviceCost = Math.max(800, Math.round((wear / 100) * 2500));

      if (demoPlayer.gameNairaBalance < serviceCost) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INSUFFICIENT_FUNDS', requiredGN: serviceCost, currentBalanceGN: demoPlayer.gameNairaBalance }));
        return;
      }

      const txId = `tx_maint_${demoPlayer.playerId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_${txId}`)}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'VEHICLE_SERVICE_REPLAY_REJECTED' }));
        return;
      }
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          'ev_service_workshop',
          idemKey,
          demoPlayer.playerId,
          `Vehicle maintenance at Segun's Roadside Workshop`,
          [
            { accountCode: 'Expense:Transport:Maintenance', debit: serviceCost, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: serviceCost }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Vehicle service replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'VEHICLE_SERVICE_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance -= serviceCost;
      legacyVehicleState.condition = 100;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        serviceCostGN: serviceCost,
        newCondition: legacyVehicleState.condition,
        newBalance: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // GET /api/v1/businesses/inventory
  if (url.pathname === '/api/v1/businesses/inventory' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      retailStalls: legacySupplyState.retailInventories,
      activeCargo: legacySupplyState.activeCargoBatches
    }));
    return;
  }

  // POST /api/v1/logistics/deliver
  if (url.pathname === '/api/v1/logistics/deliver' && req.method === 'POST') {
    req.on('data', () => {});
    req.on('end', () => {
      const targetCargo = legacySupplyState.activeCargoBatches.find(batch => batch.status === 'READY_AT_DEPOT');
      if (!targetCargo) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'NO_READY_CARGO', message: 'There is no wholesale cargo batch ready for delivery.' }));
        return;
      }
      const payout = Number(targetCargo.freightPayoutGN);
      const cargoId = String(targetCargo.cargoId);
      if (!Number.isFinite(payout) || payout <= 0) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_CARGO_PAYOUT', cargoId }));
        return;
      }
      const idemKey = `${demoPlayer.playerId}:idem_freight_delivery_${cargoId}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CARGO_DELIVERY_ALREADY_SETTLED', cargoId }));
        return;
      }
      const txId = `tx_freight_${demoPlayer.playerId}_${cargoId}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          'ev_logistics_restock_delivery',
          idemKey,
          demoPlayer.playerId,
          `Wholesale delivery from Balogun Depot to Mallam Haruna Suya Stand`,
          [
            { accountCode: playerCashAccountCode(), debit: payout, credit: 0 },
            { accountCode: 'Revenue:Logistics:Freight', debit: 0, credit: payout }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Cargo delivery replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CARGO_DELIVERY_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance += payout;
      demoPlayer.reputationScore += 25;
      const suyaStall = legacySupplyState.retailInventories.find(r => r.businessId === 'biz_suya_haruna');
      if (suyaStall) {
        suyaStall.stockLevel = suyaStall.maxStockLevel;
        suyaStall.status = 'OPTIMAL';
      }
      targetCargo.status = 'DELIVERED';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        deliveredCargo: targetCargo,
        freightPayoutGN: payout,
        restockedBusiness: suyaStall,
        newBalance: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // GET /api/v1/city/events
  if (url.pathname === '/api/v1/city/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events: cityEvents }));
    return;
  }

  // POST /api/v1/minigames/complete
  if (url.pathname === '/api/v1/minigames/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const gameType = data.miniGameType || data.minigameId || 'skill_challenge';
      const score = Number(data.score ?? 85);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_MINIGAME_SCORE', minimum: 0, maximum: 100 }));
        return;
      }
      const grade = score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : 'C';
      const bonusGN = grade === 'S' ? 2500 : grade === 'A' ? 1800 : grade === 'B' ? 1200 : 500;
      const repGain = grade === 'S' ? 35 : grade === 'A' ? 25 : grade === 'B' ? 15 : 5;
      const requestedKey = String(data.idempotencyKey || `idem_minigame_${gameType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
      const idemKey = `${demoPlayer.playerId}:${requestedKey}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MINIGAME_REPLAY_REJECTED', idempotencyKey: idemKey }));
        return;
      }
      const txId = `tx_skill_${gameType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_minigame_${gameType}`,
          idemKey,
          demoPlayer.playerId,
          `Skill Certification Bonus (${String(gameType).toUpperCase()} • Grade ${grade} • Score ${score})`,
          [
            { accountCode: playerCashAccountCode(), debit: bonusGN, credit: 0 },
            { accountCode: 'Revenue:Career:SkillGrant', debit: 0, credit: bonusGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Minigame settlement replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MINIGAME_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance += bonusGN;
      demoPlayer.reputationScore += repGain;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        miniGameType: gameType,
        grade,
        score,
        bonusGN,
        newBalance: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/market/bargain
  if (url.pathname === '/api/v1/market/bargain' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (data.rapportBonusGN !== undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CLIENT_ARBITRAGE_CLAIMS_NOT_SUPPORTED' }));
        return;
      }

      // Wholesale and retail values are server-owned until a verified bargaining
      // challenge is available; client price and margin claims are ignored.
      const agreedPriceGN = 900;
      const retailValueGN = 1800;
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_bargain_${Date.now()}_${Math.floor(Math.random() * 1000)}`)}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BARGAIN_PURCHASE_REPLAY_REJECTED' }));
        return;
      }

      if (demoPlayer.gameNairaBalance < agreedPriceGN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INSUFFICIENT_FUNDS', requiredGN: agreedPriceGN }));
        return;
      }

      const txId = `tx_bargain_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          'ev_balogun_wholesale_bargain',
          idemKey,
          demoPlayer.playerId,
          `Balogun Wholesale Bargaining Purchase (Projected Retail: ₦${retailValueGN} GN)`,
          [
            { accountCode: 'Expense:Commerce:WholesaleStock', debit: agreedPriceGN, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: agreedPriceGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Wholesale bargain replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BARGAIN_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance -= agreedPriceGN;
      demoPlayer.reputationScore += 18;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        agreedPriceGN,
        projectedMarginGN: retailValueGN - agreedPriceGN,
        newBalance: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // ============================================================================
  // DANFO HUSTLE — AUTHORITATIVE ARCADE MODE STATE, SETTLEMENT & UNLOCKS
  // ============================================================================
  const gAny = global as any;
  if (!gAny.__DANFO_HUSTLE_STATE__) {
    gAny.__DANFO_HUSTLE_STATE__ = {
      hustleCoinsBalance: 120,
      totalEarnedHustleCoins: 120,
      settledRuns: new Map<string, any>(),
      hustleCoinsLedger: [
        {
          entryId: 'hc_init_starter',
          timestamp: new Date().toISOString(),
          deltaHC: 120,
          reason: 'Starter Arcade Licence Grant (Non-Redeemable In-Game Resource)',
          runId: 'init'
        }
      ],
      records: {
        bestDistanceM: 840,
        bestScore: 4250,
        mostPassengersCarried: 11,
        bestCoinsCollected: 28,
        cleanestRunScore: 3900,
        totalRunsCompleted: 1
      },
      unlockedItems: ['unlock_hop_suspension'],
      equippedLivery: 'default_yellow',
      routes: [
        {
          id: 'route_cms_rush',
          name: 'CMS Passenger Rush',
          corridor: 'Marina Waterfront → CMS Terminal → Broad Street → Tinubu Square',
          distanceM: 1200,
          stopCount: 3,
          stops: ['CMS Ferry Jetty Stop', 'Broad Street Cathedral Stop', 'Tinubu Fountain Terminal'],
          weather: 'CLEAR_DAY',
          trafficDensity: 'MEDIUM',
          baseFareGN: 250,
          completionBonusGN: 1500,
          completionBonusHC: 25,
          timeTargetSec: 90
        },
        {
          id: 'route_ojuelegba_traffic',
          name: 'Ojuelegba Traffic Challenge',
          corridor: 'Western Avenue → Stadium Flyover → Ojuelegba Underbridge → Lawanson',
          distanceM: 1450,
          stopCount: 3,
          stops: ['National Stadium Gate', 'Ojuelegba Underbridge Bay', 'Barracks Bus Terminal'],
          weather: 'GOLDEN_HOUR',
          trafficDensity: 'HIGH',
          baseFareGN: 300,
          completionBonusGN: 2000,
          completionBonusHC: 35,
          timeTargetSec: 105
        },
        {
          id: 'route_yaba_market',
          name: 'Yaba Market Run',
          corridor: 'Sabo Roundabout → Herbert Macaulay Way → Tejuosho Market → Jibowu',
          distanceM: 1350,
          stopCount: 3,
          stops: ['Sabo Tech Hub Junction', 'Tejuosho Market Main Gate', 'Yaba Bus Terminal'],
          weather: 'CLEAR_DAY',
          trafficDensity: 'HIGH',
          baseFareGN: 280,
          completionBonusGN: 1800,
          completionBonusHC: 30,
          timeTargetSec: 95
        },
        {
          id: 'route_oshodi_interchange',
          name: 'Oshodi Interchange Hustle',
          corridor: 'Anthony Village → Cappa → Oshodi Skybridge → Bolade Junction',
          distanceM: 1650,
          stopCount: 4,
          stops: ['Anthony Overhead Stop', 'Cappa Motor Park', 'Oshodi Terminal 2', 'Bolade Market Bay'],
          weather: 'DUSK_RUSH',
          trafficDensity: 'EXTREME',
          baseFareGN: 350,
          completionBonusGN: 2500,
          completionBonusHC: 45,
          timeTargetSec: 115
        },
        {
          id: 'route_marina_rain',
          name: 'Marina Rain Run',
          corridor: 'Eko Bridge Ramp → Ring Road → Bonny Camp → Ahmadu Bello Way',
          distanceM: 1500,
          stopCount: 3,
          stops: ['Eko Bridge Marina Ramp', 'CMS Lagoon View Bay', 'Victoria Island Bar Beach Stop'],
          weather: 'TROPICAL_RAIN',
          trafficDensity: 'HIGH',
          baseFareGN: 320,
          completionBonusGN: 2200,
          completionBonusHC: 40,
          timeTargetSec: 105
        }
      ],
      missions: [
        { id: 'm_collision_free', title: 'Clean Sheet Oga', description: 'Complete a run with 0 hazard collisions', target: 1, progress: 0, completed: false, rewardHC: 30, rewardGN: 800 },
        { id: 'm_passenger_target', title: 'Full Load Conductor', description: 'Board and carry at least 8 passengers in a run', target: 8, progress: 0, completed: false, rewardHC: 25, rewardGN: 600 },
        { id: 'm_coin_target', title: 'Gold Line Collector', description: 'Collect at least 15 Eko Hustle Coins in a single run', target: 15, progress: 0, completed: false, rewardHC: 20, rewardGN: 500 },
        { id: 'm_distance_target', title: 'Eko Mile Muncher', description: 'Drive at least 800m in a single Danfo Hustle run', target: 800, progress: 0, completed: false, rewardHC: 20, rewardGN: 500 },
        { id: 'm_accurate_braking', title: 'Precision Bus Stop Master', description: 'Make at least 2 accurate bus stop boardings in a run', target: 2, progress: 0, completed: false, rewardHC: 25, rewardGN: 700 },
        { id: 'm_time_window', title: 'Express Schedule', description: 'Complete a route within its target time window', target: 1, progress: 0, completed: false, rewardHC: 30, rewardGN: 900 },
        { id: 'm_fuel_efficiency', title: 'Eco-Danfo Cruising', description: 'Finish a run with at least 45% fuel remaining', target: 45, progress: 0, completed: false, rewardHC: 20, rewardGN: 500 },
        { id: 'm_service_rating', title: '5-Star Lagos Commute', description: 'Finish a run with Passenger Service Rating >= 85%', target: 85, progress: 0, completed: false, rewardHC: 35, rewardGN: 1000 }
      ],
      unlockCatalog: [
        { id: 'unlock_hop_suspension', name: 'Heavy-Duty Eko Hydraulic Hop Springs', category: 'ARCADE_UPGRADE', costHC: 50, description: 'Enables and boosts Danfo suspension hop clearance over potholes and tyre piles.' },
        { id: 'unlock_livery_eko_gold', name: 'Eko Gold & Black Championship Strip', category: 'COSMETIC_LIVERY', costHC: 40, description: 'Metallic gold body with dual black racing stripes and illuminated roof destination board.' },
        { id: 'unlock_livery_green_white', name: 'Lagos Metro Emerald Express Livery', category: 'COSMETIC_LIVERY', costHC: 55, description: 'Classic emerald-and-ivory commuter livery with reflective safety trim.' },
        { id: 'unlock_horn_afrobeat', name: 'Ojuelegba Brass Melody Horn Pack', category: 'COSMETIC_AUDIO', costHC: 35, description: 'Upgrades the Danfo air-horn with multi-tone Lagos brass cadence.' },
        { id: 'unlock_magnet_coil', name: 'Extended Booster Duration (+25%)', category: 'ARCADE_UPGRADE', costHC: 65, description: 'Extends active duration of Clear Road, Shield, and Coin Magnet boosters by 25%.' }
      ]
    };
  }
  const danfoHustleDefaults = JSON.parse(JSON.stringify({ ...gAny.__DANFO_HUSTLE_STATE__, settledRuns: [] }));
  const dhState = new Proxy({} as Record<string, any>, {
    get(_target, property) {
      const state = getLegacyDanfoHustleState(currentLegacyAccount(), danfoHustleDefaults);
      return persistableProfileValue(state[String(property)]);
    },
    set(_target, property, value) {
      getLegacyDanfoHustleState(currentLegacyAccount(), danfoHustleDefaults)[String(property)] = value;
      persistAccountStore();
      return true;
    },
    ownKeys() {
      return Reflect.ownKeys(getLegacyDanfoHustleState(currentLegacyAccount(), danfoHustleDefaults));
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(getLegacyDanfoHustleState(currentLegacyAccount(), danfoHustleDefaults), property);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });

  if (url.pathname === '/api/v1/danfo-hustle/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hustleCoinsBalance: dhState.hustleCoinsBalance,
      totalEarnedHustleCoins: dhState.totalEarnedHustleCoins,
      gameNairaBalance: demoPlayer.gameNairaBalance,
      records: dhState.records,
      unlockedItems: dhState.unlockedItems,
      equippedLivery: dhState.equippedLivery,
      routes: dhState.routes,
      missions: dhState.missions,
      unlockCatalog: dhState.unlockCatalog,
      economyRules: {
        hustleCoinsRole: 'Earned through verified Danfo Hustle arcade runs and missions; spent exclusively on in-game cosmetics and arcade upgrades.',
        gameNairaRole: 'Earned from passenger fares and route bonuses; recorded in the authoritative double-entry ledger.',
        realMoneyRedeemable: false,
        clientMintingAllowed: false
      }
    }));
    return;
  }

  if (url.pathname === '/api/v1/danfo-hustle/settle' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const runId = String(data.runId || '').trim();
      if (!runId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MISSING_RUN_ID', message: 'A unique runId is required for idempotent run settlement.' }));
        return;
      }
      const existingRun = dhState.settledRuns.find((entry: any) => entry.runId === runId);
      if (existingRun) {
        const existing = existingRun.payload;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...existing, idempotentReplay: true }));
        return;
      }
      const arcadeStateRecord = getLegacyDanfoHustleState(currentLegacyAccount(), danfoHustleDefaults);
      const arcadeStateBeforeSettlement = JSON.parse(JSON.stringify(arcadeStateRecord));
      const routeId = String(data.routeId || 'route_cms_rush');
      const route = dhState.routes.find((r: any) => r.id === routeId) || dhState.routes[0];
      const distanceM = Math.max(0, Math.round(Number(data.distanceM || 0)));
      const durationSec = Math.max(1, Number(data.durationSec || 1));
      const rawCoins = Math.max(0, Math.round(Number(data.coinsCollected || 0)));
      const rawPassengers = Math.max(0, Math.round(Number(data.passengersCarried || 0)));
      const stopsCompleted = Math.max(0, Math.round(Number(data.stopsCompleted || 0)));
      const stopsMissed = Math.max(0, Math.round(Number(data.stopsMissed || 0)));
      const collisions = Math.max(0, Math.round(Number(data.collisions || 0)));
      const pedestrianHits = Math.max(0, Math.round(Number(data.pedestrianHits || 0)));
      const fuelRemainingPct = Math.max(0, Math.min(100, Math.round(Number(data.fuelRemainingPct ?? 60))));
      const routeCompleted = Boolean(data.routeCompleted);

      if (distanceM < 15 && (rawCoins > 0 || rawPassengers > 0)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'ANTI_CHEAT_STATIONARY_FARMING_DETECTED',
          message: 'Rewards cannot be claimed without forward driving progression.'
        }));
        return;
      }
      const avgSpeedMps = distanceM / durationSec;
      if (avgSpeedMps > 85 || rawCoins > 250 || rawPassengers > 60) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'ANTI_CHEAT_IMPLAUSIBLE_TELEMETRY',
          message: 'Run telemetry exceeded physical arcade bounds.'
        }));
        return;
      }

      const verifiedCoins = Math.min(200, rawCoins);
      const verifiedPassengers = Math.min(42, rawPassengers);
      const luckyFareApplied = Boolean(data.luckyFareApplied);
      const fareMultiplier = luckyFareApplied ? 1.35 : 1.0;
      const grossFareGN = Math.round(verifiedPassengers * route.baseFareGN * fareMultiplier);
      const completionBonusGN = routeCompleted ? route.completionBonusGN : Math.round((distanceM / route.distanceM) * 400);
      const penaltyGN = (collisions * 120) + (stopsMissed * 200) + (pedestrianHits * 600);
      const netGameNairaEarned = Math.max(0, grossFareGN + completionBonusGN - penaltyGN);
      const serviceRatingPct = Math.max(0, Math.min(100, 100 - (collisions * 8) - (stopsMissed * 12) - (pedestrianHits * 35)));

      const newlyCompletedMissions: any[] = [];
      let missionBonusHC = 0;
      let missionBonusGN = 0;
      for (const m of dhState.missions) {
        if (m.id === 'm_collision_free' && distanceM >= 250 && collisions === 0 && pedestrianHits === 0) {
          m.progress = 1;
          if (!m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
        if (m.id === 'm_passenger_target') {
          m.progress = Math.max(m.progress, verifiedPassengers);
          if (verifiedPassengers >= m.target && !m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
        if (m.id === 'm_coin_target') {
          m.progress = Math.max(m.progress, verifiedCoins);
          if (verifiedCoins >= m.target && !m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
        if (m.id === 'm_distance_target') {
          m.progress = Math.max(m.progress, distanceM);
          if (distanceM >= m.target && !m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
        if (m.id === 'm_accurate_braking') {
          m.progress = Math.max(m.progress, stopsCompleted);
          if (stopsCompleted >= m.target && !m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
        if (m.id === 'm_time_window' && routeCompleted && durationSec <= route.timeTargetSec) {
          m.progress = 1;
          if (!m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
        if (m.id === 'm_fuel_efficiency' && distanceM >= 250 && fuelRemainingPct >= m.target) {
          m.progress = Math.max(m.progress, fuelRemainingPct);
          if (!m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
        if (m.id === 'm_service_rating' && distanceM >= 250 && serviceRatingPct >= m.target) {
          m.progress = Math.max(m.progress, serviceRatingPct);
          if (!m.completed) { m.completed = true; newlyCompletedMissions.push(m); missionBonusHC += m.rewardHC; missionBonusGN += m.rewardGN; }
        }
      }

      const routeCompletionHC = routeCompleted ? route.completionBonusHC : 0;
      const totalHustleCoinsEarned = verifiedCoins + routeCompletionHC + missionBonusHC;
      const totalGameNairaAwarded = netGameNairaEarned + missionBonusGN;
      const calculatedScore = Math.max(0,
        Math.round(distanceM * 2.5) +
        (verifiedCoins * 50) +
        (verifiedPassengers * 180) +
        (stopsCompleted * 350) +
        (routeCompleted ? 1500 : 0) -
        (collisions * 250) -
        (stopsMissed * 300) -
        (pedestrianHits * 900)
      );

      dhState.hustleCoinsBalance += totalHustleCoinsEarned;
      dhState.totalEarnedHustleCoins += totalHustleCoinsEarned;
      dhState.hustleCoinsLedger.push({
        entryId: `hc_run_${runId}`,
        timestamp: new Date().toISOString(),
        deltaHC: totalHustleCoinsEarned,
        reason: `Danfo Hustle Run (${route.name}) — ${verifiedCoins} pickup coins + ${routeCompletionHC} route HC + ${missionBonusHC} mission HC`,
        runId
      });

      let txId: string | null = null;
      if (totalGameNairaAwarded > 0) {
        const accountRunId = `${demoPlayer.playerId}_${runId}`;
        txId = `tx_danfo_hustle_${accountRunId}`;
        try {
          const posted = globalEconomyLedger.postTransaction(
            txId,
            'ev_danfo_hustle_settlement',
            `${demoPlayer.playerId}:idem_danfo_hustle_${runId}`,
            demoPlayer.playerId,
            `Danfo Hustle Fares & Route Bonus (${route.name} • ${verifiedPassengers} pax • ${stopsCompleted} stops)`,
            [
              { accountCode: playerCashAccountCode(), debit: totalGameNairaAwarded, credit: 0 },
              { accountCode: 'Revenue:Transport:DanfoHustleFares', debit: 0, credit: totalGameNairaAwarded }
            ]
          );
          if (posted.transactionId !== txId) throw new Error('Danfo Hustle settlement replay rejected.');
        } catch (e: any) {
          for (const key of Object.keys(arcadeStateRecord)) delete arcadeStateRecord[key];
          Object.assign(arcadeStateRecord, arcadeStateBeforeSettlement);
          persistAccountStore();
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'DANFO_HUSTLE_SETTLEMENT_REJECTED', details: String(e?.message || e) }));
          return;
        }
        demoPlayer.gameNairaBalance += totalGameNairaAwarded;
        demoPlayer.reputationScore += Math.max(5, stopsCompleted * 4 + (routeCompleted ? 12 : 2));
      }

      dhState.records.totalRunsCompleted += 1;
      if (distanceM > dhState.records.bestDistanceM) dhState.records.bestDistanceM = distanceM;
      if (calculatedScore > dhState.records.bestScore) dhState.records.bestScore = calculatedScore;
      if (verifiedPassengers > dhState.records.mostPassengersCarried) dhState.records.mostPassengersCarried = verifiedPassengers;
      if (verifiedCoins > dhState.records.bestCoinsCollected) dhState.records.bestCoinsCollected = verifiedCoins;
      if (collisions === 0 && pedestrianHits === 0 && calculatedScore > dhState.records.cleanestRunScore) {
        dhState.records.cleanestRunScore = calculatedScore;
      }

      const settlementPayload = {
        success: true,
        idempotentReplay: false,
        runId,
        routeId: route.id,
        routeName: route.name,
        calculatedScore,
        distanceM,
        verifiedCoins,
        verifiedPassengers,
        stopsCompleted,
        stopsMissed,
        collisions,
        pedestrianHits,
        serviceRatingPct,
        grossFareGN,
        completionBonusGN,
        penaltyGN,
        missionBonusGN,
        totalGameNairaAwarded,
        totalHustleCoinsEarned,
        newlyCompletedMissions,
        hustleCoinsBalance: dhState.hustleCoinsBalance,
        gameNairaBalance: demoPlayer.gameNairaBalance,
        records: dhState.records,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      };
      dhState.settledRuns.push({ runId, payload: settlementPayload });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(settlementPayload));
    });
    return;
  }

  if (url.pathname === '/api/v1/danfo-hustle/unlock' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const itemId = String(data.itemId || '').trim();
      const item = dhState.unlockCatalog.find((u: any) => u.id === itemId);
      if (!item) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNLOCK_ITEM_NOT_FOUND' }));
        return;
      }
      if (dhState.unlockedItems.includes(itemId)) {
        if (item.category === 'COSMETIC_LIVERY') dhState.equippedLivery = itemId;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          alreadyUnlocked: true,
          itemId,
          equippedLivery: dhState.equippedLivery,
          hustleCoinsBalance: dhState.hustleCoinsBalance,
          unlockedItems: dhState.unlockedItems
        }));
        return;
      }
      if (dhState.hustleCoinsBalance < item.costHC) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_HUSTLE_COINS',
          requiredHC: item.costHC,
          availableHC: dhState.hustleCoinsBalance
        }));
        return;
      }
      dhState.hustleCoinsBalance -= item.costHC;
      dhState.unlockedItems.push(itemId);
      if (item.category === 'COSMETIC_LIVERY') {
        dhState.equippedLivery = itemId;
      }
      dhState.hustleCoinsLedger.push({
        entryId: `hc_unlock_${itemId}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        deltaHC: -item.costHC,
        reason: `Unlocked ${item.name} (${item.category})`,
        runId: itemId
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        alreadyUnlocked: false,
        itemId,
        item,
        equippedLivery: dhState.equippedLivery,
        hustleCoinsBalance: dhState.hustleCoinsBalance,
        unlockedItems: dhState.unlockedItems
      }));
    });
    return;
  }

  // ============================================================================
  // M3: CANONICAL WORLD REGISTRY, EKOATLAS, EKOPLACES, EKOMEDIA & EKOPROPERTIES
  // ============================================================================
  if (!gAny.__M3_WORLD_COMMERCE_STATE__) {
    gAny.__M3_WORLD_COMMERCE_STATE__ = {
      entities: JSON.parse(JSON.stringify(CANONICAL_WORLD_ENTITIES)),
      mediaSlots: sharedWorldState.commerceState.mediaSlots,
      mediaCampaigns: sharedWorldState.commerceState.mediaCampaigns,
      propertyParcels: JSON.parse(JSON.stringify(CANONICAL_PROPERTY_PARCELS)),
      routeSelectionLog: sharedWorldState.commerceState.routeSelectionLog,
      mediaEventsLog: sharedWorldState.commerceState.mediaEventsLog,
    };
  }
  const sharedM3State = gAny.__M3_WORLD_COMMERCE_STATE__;
  const m3State = new Proxy(sharedM3State, {
    get(target, property, receiver) {
      if (property === 'propertyParcels') {
        return persistableProfileValue(getLegacyPropertyParcels(currentLegacyAccount(), CANONICAL_PROPERTY_PARCELS as Array<Record<string, any>>));
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property === 'propertyParcels') {
        setLegacyPropertyParcels(currentLegacyAccount(), value);
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    },
  });
  const persistSharedCommerceState = () => {
    sharedWorldState.commerceState = {
      mediaSlots: m3State.mediaSlots,
      mediaCampaigns: m3State.mediaCampaigns,
      routeSelectionLog: m3State.routeSelectionLog,
      mediaEventsLog: m3State.mediaEventsLog,
    };
    saveLegacyWorldState(sharedWorldState);
  };

  // Project this account's business/property ownership onto a detached entity list.
  // Never write account-owned fields back into the shared canonical catalog.
  const getAccountCanonicalEntities = () => {
    const entities = JSON.parse(JSON.stringify(m3State.entities));
    for (const ent of entities) {
      const linkedBiz = (businessesRegistry as any[]).find((b: any) => b.id === ent.id || ent.aliases.includes(b.id));
      if (linkedBiz && linkedBiz.owned) {
        ent.entityType = 'player_owned_property';
        ent.placeCategory = 'Player Businesses';
        ent.ownershipState = {
          ...(ent.ownershipState || {}),
          ownerId: demoPlayer.playerId,
          ownerName: 'Amaka Driver (Player)',
          tenancyStatus: 'PLAYER_OWNED',
          linkedBusinessId: linkedBiz.id,
        };
      }
      const linkedParcel = m3State.propertyParcels.find(
        (p: any) => p.parcelId === ent.id || p.entityId === ent.id || (ent.ownershipState && ent.ownershipState.linkedParcelId === p.parcelId)
      );
      if (linkedParcel && linkedParcel.ownership.ownerId === demoPlayer.playerId) {
        ent.entityType = 'player_owned_property';
        if (linkedParcel.buildState === 'DEVELOPED_ACTIVE') {
          ent.placeCategory = 'Player Businesses';
        }
        ent.ownershipState = {
          ...(ent.ownershipState || {}),
          ownerId: demoPlayer.playerId,
          ownerName: 'Amaka Driver (Player)',
          tenancyStatus: 'PLAYER_OWNED',
          linkedParcelId: linkedParcel.parcelId,
          linkedBusinessId: linkedParcel.associatedBusinessEntityId || undefined,
        };
      }
    }
    return entities;
  };

  // GET /api/v1/atlas/registry
  if (url.pathname === '/api/v1/atlas/registry' && req.method === 'GET') {
    const entities = getAccountCanonicalEntities();
    const presentEntityTypes = Array.from(new Set(entities.map((e: any) => e.entityType)));
    // Include canonical entityTypes + original types so all 21 required types remain represented
    const allSupportedTypes = Array.from(new Set([...REQUIRED_CANONICAL_ENTITY_TYPES, ...presentEntityTypes]));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      version: 'M3.0-CANONICAL-REGISTRY',
      supportedEntityTypes: REQUIRED_CANONICAL_ENTITY_TYPES,
      presentEntityTypes: allSupportedTypes,
      totalEntities: entities.length,
      entities,
      districts: entities.filter((e: any) => e.entityType === 'district' || e.entityType === 'restricted_region'),
      mediaSlotsCount: m3State.mediaSlots.length,
      propertyParcelsCount: m3State.propertyParcels.length,
      activeEvents: cityEvents,
      playerState: {
        playerId: demoPlayer.playerId,
        username: demoPlayer.username,
        balanceGN: demoPlayer.gameNairaBalance,
        ownedVehicleIds: demoPlayer.ownedVehicleIds,
      }
    }));
    return;
  }

  // GET /api/v1/atlas/entity?id=...
  if (url.pathname === '/api/v1/atlas/entity' && req.method === 'GET') {
    const entities = getAccountCanonicalEntities();
    const queryId = (url.searchParams.get('id') || '').trim().toLowerCase();
    const entity = entities.find(
      (e: any) => e.id.toLowerCase() === queryId || e.aliases.some((a: string) => a.toLowerCase() === queryId)
    );
    if (!entity) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ENTITY_NOT_FOUND', requestedId: queryId }));
      return;
    }
    const parcel = m3State.propertyParcels.find(
      (p: any) => p.entityId === entity.id || p.parcelId === entity.id || (entity.ownershipState && entity.ownershipState.linkedParcelId === p.parcelId)
    ) || null;
    const business = (businessesRegistry as any[]).find(
      (b: any) => b.id === entity.id || entity.aliases.includes(b.id) || (entity.ownershipState && entity.ownershipState.linkedBusinessId === b.id)
    ) || null;
    const mediaSlots = m3State.mediaSlots.filter((s: any) => s.entityId === entity.id || s.slotId === entity.id);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      entity,
      parcel,
      business,
      mediaSlots,
    }));
    return;
  }

  // POST /api/v1/atlas/route
  if (url.pathname === '/api/v1/atlas/route' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const fromId = String(data.fromId || 'stop_cms_bus_terminal');
      const toId = String(data.toId || 'lmk_tbs_ceremonial_arch');
      const routePlan = calculateCanonicalRoute(fromId, toId);
      if (!routePlan) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ROUTE_TARGET_NOT_FOUND', fromId, toId }));
        return;
      }

      if (routePlan.toEntity.availabilityState === 'LOCKED') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'REGION_LOCKED',
          message: `${routePlan.toEntity.displayName} is in a LOCKED future-development region and is not yet open for street navigation.`,
          toEntity: routePlan.toEntity,
        }));
        return;
      }

      m3State.routeSelectionLog.push({
        timestampIso: new Date().toISOString(),
        fromEntityId: routePlan.fromEntity.id,
        toEntityId: routePlan.toEntity.id,
        distanceM: routePlan.totalDistanceM,
      });
      persistSharedCommerceState();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        route: routePlan,
      }));
    });
    return;
  }

  // GET /api/v1/places/search
  if (url.pathname === '/api/v1/places/search' && req.method === 'GET') {
    const entities = getAccountCanonicalEntities();
    const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim().toLowerCase();
    const cat = (url.searchParams.get('category') || 'ALL').trim();
    const entityType = (url.searchParams.get('entityType') || 'ALL').trim();
    const districtId = (url.searchParams.get('districtId') || 'ALL').trim();
    const availability = (url.searchParams.get('availability') || 'ALL').trim();

    const filtered = entities.filter((ent: any) => {
      if (cat && cat !== 'ALL') {
        const cLow = cat.toLowerCase();
        const entCat = ent.placeCategory.toLowerCase();
        const matchCat =
          entCat === cLow ||
          (cLow === 'dealerships' && (ent.id === 'gar_segun_auto_clinic' || ent.tags.includes('dealership'))) ||
          (cLow === 'properties' && (ent.entityType === 'virtual_property_parcel' || ent.entityType === 'player_owned_property' || ent.entityType === 'residential_estate')) ||
          (cLow === 'player businesses' && (ent.placeCategory === 'Player Businesses' || (ent.ownershipState && ent.ownershipState.tenancyStatus === 'PLAYER_OWNED')));
        if (!matchCat) return false;
      }
      if (entityType && entityType !== 'ALL' && ent.entityType.toLowerCase() !== entityType.toLowerCase()) return false;
      if (districtId && districtId !== 'ALL' && ent.districtId.toLowerCase() !== districtId.toLowerCase()) return false;
      if (availability && availability !== 'ALL' && ent.availabilityState !== availability) return false;
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
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      query: q,
      category: cat,
      count: filtered.length,
      places: filtered,
      categories: [
        'Transport',
        'Food',
        'Retail',
        'Entertainment',
        'Garages',
        'Dealerships',
        'Jobs',
        'Properties',
        'Events',
        'Player Businesses',
        'Landmarks',
      ],
    }));
    return;
  }

  // GET /api/v1/media/inventory
  if (url.pathname === '/api/v1/media/inventory' && req.method === 'GET') {
    const enrichedSlots = m3State.mediaSlots.map((slot: any) => {
      const activeCamp = m3State.mediaCampaigns.find((c: any) => c.campaignId === slot.activeCampaignId && c.status === 'ACTIVE') || null;
      return {
        ...slot,
        activeCampaign: activeCamp,
      };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      commercialPolicy: 'SANDBOX_VIRTUAL_ONLY_NO_REAL_MONEY_SALE',
      supportedFormats: [
        'static_billboard',
        'digital_billboard',
        'terminal_display',
        'storefront_sponsorship',
        'venue_sponsorship',
        'sponsored_activity',
        'sponsored_transport_route',
        'scheduled_city_event',
      ],
      slots: enrichedSlots,
      campaigns: m3State.mediaCampaigns,
      recentEvents: m3State.mediaEventsLog.slice(-25),
    }));
    return;
  }

  // POST /api/v1/media/campaign/status (Pause, Resume, or Remove Campaign)
  if (url.pathname === '/api/v1/media/campaign/status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (data.requestRealMoneyPurchase || data.realMoneyRateCard) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'REAL_MONEY_AD_SALES_DISABLED',
          message: 'EkoMedia inventory is restricted to virtual Game Naira sandbox campaigns; real-money ad sales are disabled.',
        }));
        return;
      }
      if (data.targetLandmarkId === 'lmk_tbs_ceremonial_arch' || data.targetLandmarkId === 'lmk_marina_heritage_cathedral') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'PROTECTED_LANDMARK_EXEMPT',
          message: 'Commercial branding is strictly prohibited from overwriting protected civic or heritage landmarks.',
        }));
        return;
      }

      const campaignAliasMap: Record<string, string> = {
        camp_ekotel_5g_launch: 'camp_ekopay_zero_fee',
        camp_adera_motors_promo: 'camp_koro_motors_dispatch',
        camp_zuma_malt_owambe: 'camp_zobofresh_citrus',
        camp_ekobank_sme_grant: 'camp_radio_eko_afrobeats',
      };
      const rawCampaignId = String(data.campaignId || '').trim();
      const campaignId = campaignAliasMap[rawCampaignId] || rawCampaignId;
      const newStatus = String(data.status || 'PAUSED').toUpperCase();
      const camp = m3State.mediaCampaigns.find((c: any) => c.campaignId === campaignId || c.campaignId === rawCampaignId);
      if (!camp) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CAMPAIGN_NOT_FOUND', campaignId: rawCampaignId }));
        return;
      }

      if (['ACTIVE', 'PAUSED', 'COMPLETED', 'REMOVED'].includes(newStatus)) {
        camp.status = newStatus;
      }

      // Propagate campaign status to all linked EkoMedia slots
      m3State.mediaSlots.forEach((slot: any) => {
        if (slot.activeCampaignId === camp.campaignId || camp.eligibleInventory.includes(slot.slotId)) {
          if (camp.status === 'ACTIVE') {
            slot.activeCampaignId = camp.campaignId;
            slot.campaignState = 'ACTIVE_CAMPAIGN';
          } else if (camp.status === 'PAUSED') {
            slot.campaignState = 'PAUSED';
          } else {
            slot.activeCampaignId = null;
            slot.campaignState = 'HOUSE_FALLBACK';
          }
        }
      });
      persistSharedCommerceState();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        campaign: camp,
        updatedSlots: m3State.mediaSlots.filter((s: any) => camp.eligibleInventory.includes(s.slotId)),
      }));
    });
    return;
  }

  // POST /api/v1/media/event (Record Impression / Engagement / Sponsored Route Selection)
  if (url.pathname === '/api/v1/media/event' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const campaignAliasMap: Record<string, string> = {
        camp_ekotel_5g_launch: 'camp_ekopay_zero_fee',
        camp_adera_motors_promo: 'camp_koro_motors_dispatch',
        camp_zuma_malt_owambe: 'camp_zobofresh_citrus',
        camp_ekobank_sme_grant: 'camp_radio_eko_afrobeats',
      };
      const slotId = String(data.slotId || '');
      const rawCampId = String(data.campaignId || '');
      const campaignId = campaignAliasMap[rawCampId] || rawCampId;
      const eventType = String(data.eventType || 'IMPRESSION').toUpperCase();

      const slot = m3State.mediaSlots.find((s: any) => s.slotId === slotId);
      const camp = m3State.mediaCampaigns.find((c: any) => c.campaignId === (campaignId || (slot && slot.activeCampaignId)));

      if (camp && camp.status === 'ACTIVE') {
        if (eventType === 'ENGAGEMENT') camp.deliveryMetrics.engagements++;
        else if (eventType === 'ROUTE_SELECT') {
          camp.deliveryMetrics.routeSelections++;
          camp.deliveryMetrics.engagements++;
        } else {
          camp.deliveryMetrics.impressions++;
        }
        camp.deliveryMetrics.lastDeliveredAt = new Date().toISOString();
      }

      m3State.mediaEventsLog.push({
        timestampIso: new Date().toISOString(),
        slotId,
        campaignId: camp ? camp.campaignId : campaignId,
        eventType,
      });
      persistSharedCommerceState();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        campaignId: camp ? camp.campaignId : null,
        deliveryMetrics: camp ? camp.deliveryMetrics : null,
        metrics: camp ? camp.deliveryMetrics : null,
      }));
    });
    return;
  }

  // GET /api/v1/properties/parcels
  if (url.pathname === '/api/v1/properties/parcels' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      legalNotice: 'VIRTUAL GAME RIGHTS ONLY: EkoProperties parcels exist strictly within Project Eko virtual gameplay and confer zero real-world land ownership, lease, or title. Real-money buying, selling, or withdrawals are disabled.',
      payoutEnabled: false,
      realMoneyPurchasesEnabled: false,
      playerBalanceGN: demoPlayer.gameNairaBalance,
      parcels: m3State.propertyParcels,
    }));
    return;
  }

  const parcelAliasMap: Record<string, string> = {
    prop_parcel_suya_01: 'parcel_cms_suya_plot_01',
    prop_parcel_marina_bukka_02: 'parcel_marina_bukka_plot_02',
    prop_parcel_balogun_parts_03: 'parcel_balogun_depot_plot_03',
    prop_parcel_broad_04: 'parcel_broad_st_corner_plot_04',
    prop_parcel_marina_05: 'parcel_marina_promenade_plot_05',
    prop_parcel_tbs_reserve_06: 'parcel_tbs_civic_reserve_non_purchasable',
  };

  // POST /api/v1/properties/acquire
  if (url.pathname === '/api/v1/properties/acquire' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (data.requestRealMoneyPurchase || data.currency === 'NGN_FIAT' || data.currency === 'USD') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'REAL_MONEY_PROPERTY_PURCHASE_DISABLED',
          message: 'Real-money property buying, selling, or withdrawals are strictly disabled. Only virtual Game Naira (GN) is accepted.',
        }));
        return;
      }

      const rawParcelId = String(data.parcelId || '').trim();
      const parcelId = parcelAliasMap[rawParcelId] || rawParcelId;
      const parcel = m3State.propertyParcels.find((p: any) => p.parcelId === parcelId || p.entityId === parcelId || p.parcelId === rawParcelId);
      if (!parcel) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PARCEL_NOT_FOUND', parcelId: rawParcelId }));
        return;
      }

      if (!parcel.eligibleForAcquisition) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'PARCEL_NOT_ELIGIBLE',
          message: `${parcel.displayName} is a protected civic/restricted reserve and is not eligible for acquisition.`,
        }));
        return;
      }

      if (parcel.ownership.ownerId === demoPlayer.playerId) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'PARCEL_ALREADY_OWNED',
          message: `You already hold the virtual deed for ${parcel.displayName}.`,
          parcel,
          newBalance: demoPlayer.gameNairaBalance,
          newBalanceGN: demoPlayer.gameNairaBalance,
        }));
        return;
      }

      const costGN = parcel.acquisitionTerms.acquisitionCostGN;
      if (demoPlayer.gameNairaBalance < costGN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_FUNDS',
          message: `Acquiring ${parcel.displayName} requires ₦${costGN.toLocaleString()} GN (Current balance: ₦${demoPlayer.gameNairaBalance.toLocaleString()} GN).`,
          requiredGN: costGN,
          currentBalanceGN: demoPlayer.gameNairaBalance,
        }));
        return;
      }

      const txId = `tx_prop_acq_${parcel.parcelId}_${Date.now()}`;
      const idemKey = data.idempotencyKey ? String(data.idempotencyKey) : `idem_prop_acq_${parcel.parcelId}_${demoPlayer.playerId}`;
      try {
        globalEconomyLedger.postTransaction(
          txId,
          `ev_acquire_parcel_${parcel.parcelId}`,
          idemKey,
          demoPlayer.playerId,
          `Acquired Virtual Property Parcel: ${parcel.displayName} (-₦${costGN} GN)`,
          [
            { accountCode: 'Asset:Player:BusinessConcessions', debit: costGN, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: costGN },
          ]
        );
      } catch (e: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'DUPLICATE_TRANSACTION',
          message: e && e.message ? e.message : 'Duplicate property acquisition rejected',
        }));
        return;
      }

      demoPlayer.gameNairaBalance -= costGN;
      demoPlayer.reputationScore += 40;
      const nowIso = new Date().toISOString();
      parcel.ownership = {
        ownerId: demoPlayer.playerId,
        ownerName: 'Amaka Driver (Player)',
        acquiredAtIso: nowIso,
      };
      parcel.ownershipHistory.push({
        ownerId: demoPlayer.playerId,
        ownerName: 'Amaka Driver (Player)',
        event: 'ACQUIRED',
        timestampIso: nowIso,
        amountGN: costGN,
        ledgerTxId: txId,
      });

      // If linked to an existing business in (businessesRegistry as any[]), mark it owned too
      if (parcel.associatedBusinessEntityId) {
        const linkedBiz = (businessesRegistry as any[]).find(
          (b: any) => b.id === parcel.associatedBusinessEntityId || (parcel.associatedBusinessEntityId === 'mkt_balogun_wholesale_depot' && b.id === 'biz_parts_balogun')
        );
        if (linkedBiz) linkedBiz.owned = true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        parcel,
        acquisitionCostGN: costGN,
        newBalance: demoPlayer.gameNairaBalance,
        newBalanceGN: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity(),
      }));
    });
    return;
  }

  // POST /api/v1/properties/develop
  if (url.pathname === '/api/v1/properties/develop' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const rawParcelId = String(data.parcelId || '').trim();
      const parcelId = parcelAliasMap[rawParcelId] || rawParcelId;
      const useAliasMap: Record<string, string> = {
        FOOD_COURT: 'FOOD_BEVERAGE',
        TRANSIT_KIOSK: 'TRANSIT_HUB',
        LOGISTICS_HUB: 'LOGISTICS_DEPOT',
      };
      const rawUse = String(data.permittedUse || data.businessType || 'RETAIL_KIOSK').toUpperCase();
      const desiredUse = useAliasMap[rawUse] || rawUse;
      const customBusinessName = String(data.businessName || data.customDisplayName || '').trim();

      const parcel = m3State.propertyParcels.find((p: any) => p.parcelId === parcelId || p.entityId === parcelId || p.parcelId === rawParcelId);
      if (!parcel) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PARCEL_NOT_FOUND', parcelId: rawParcelId }));
        return;
      }

      if (parcel.ownership.ownerId !== demoPlayer.playerId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'NOT_PARCEL_OWNER',
          message: `You must acquire the virtual deed for ${parcel.displayName} before developing it.`,
        }));
        return;
      }

      if (parcel.buildState === 'DEVELOPED_ACTIVE') {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'ALREADY_DEVELOPED',
          message: `${parcel.displayName} is already developed and operating (${parcel.businessType}).`,
          parcel,
        }));
        return;
      }

      if (!parcel.permittedUses.includes(desiredUse)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'USE_NOT_PERMITTED',
          message: `Use '${desiredUse}' is not permitted on ${parcel.displayName}. Permitted uses: ${parcel.permittedUses.join(', ')}.`,
          permittedUses: parcel.permittedUses,
        }));
        return;
      }

      const devCostGN = parcel.acquisitionTerms.developmentCostGN;
      if (demoPlayer.gameNairaBalance < devCostGN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_FUNDS',
          message: `Developing ${parcel.displayName} requires ₦${devCostGN.toLocaleString()} GN (Current balance: ₦${demoPlayer.gameNairaBalance.toLocaleString()} GN).`,
          requiredGN: devCostGN,
          currentBalanceGN: demoPlayer.gameNairaBalance,
        }));
        return;
      }

      const txId = `tx_prop_dev_${parcel.parcelId}_${Date.now()}`;
      const idemKey = data.idempotencyKey ? String(data.idempotencyKey) : `idem_prop_dev_${parcel.parcelId}_${demoPlayer.playerId}`;
      try {
        globalEconomyLedger.postTransaction(
          txId,
          `ev_develop_parcel_${parcel.parcelId}`,
          idemKey,
          demoPlayer.playerId,
          `Developed Virtual Property Parcel: ${parcel.displayName} (${desiredUse})`,
          [
            { accountCode: 'Asset:Player:BusinessConcessions', debit: devCostGN, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: devCostGN },
          ]
        );
      } catch (e: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DUPLICATE_TRANSACTION', message: 'Duplicate development transaction rejected' }));
        return;
      }

      demoPlayer.gameNairaBalance -= devCostGN;
      demoPlayer.reputationScore += 55;
      const nowIso = new Date().toISOString();

      const useLabels: Record<string, string> = {
        FOOD_BEVERAGE: 'Eko Express Suya & Jollof Lounge',
        RETAIL_KIOSK: 'EkoConnect POS & Provisions Hub',
        AUTO_WORKSHOP: 'Marina Quick-Service Tyre & Lube Bay',
        LOGISTICS_DEPOT: 'Lagos Island Micro-Fulfillment Hub',
        TRANSIT_HUB: 'Commuter Keke & Okada Charging Lounge',
        MIXED_COMMERCIAL: 'Broad Street Commercial Plaza Unit',
      };
      const finalBizType = customBusinessName || useLabels[desiredUse] || 'Commercial Venture';

      parcel.buildState = 'DEVELOPED_ACTIVE';
      parcel.businessType = finalBizType;
      parcel.operatingStatus = 'OPEN_OPERATING';
      parcel.unclaimedYieldGN = parcel.hourlyYieldGN;
      const newBizId = parcel.associatedBusinessEntityId || `biz_${parcel.parcelId}`;
      parcel.associatedBusinessEntityId = newBizId;

      parcel.ownershipHistory.push({
        ownerId: demoPlayer.playerId,
        ownerName: 'Amaka Driver (Player)',
        event: 'DEVELOPED',
        timestampIso: nowIso,
        amountGN: devCostGN,
        ledgerTxId: txId,
      });

      // Register or update the associated business in (businessesRegistry as any[]) so EkoCommerce & EkoProperties share one identity
      let existingBiz = (businessesRegistry as any[]).find((b: any) => b.id === newBizId);
      if (!existingBiz) {
        existingBiz = {
          id: newBizId,
          name: finalBizType,
          zone: parcel.displayName,
          owned: true,
          AcquisitionCostGN: parcel.acquisitionTerms.acquisitionCostGN + devCostGN,
          hourlyRevenueGN: parcel.hourlyYieldGN,
          unclaimedEarningsGN: parcel.hourlyYieldGN,
          level: 1,
        };
        (businessesRegistry as any[]).push(existingBiz);
      } else {
        existingBiz.owned = true;
        existingBiz.name = finalBizType;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        parcel,
        associatedBusiness: existingBiz,
        createdBusiness: existingBiz,
        developmentCostGN: devCostGN,
        newBalance: demoPlayer.gameNairaBalance,
        newBalanceGN: demoPlayer.gameNairaBalance,
        reputation: demoPlayer.reputationScore,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity(),
      }));
    });
    return;
  }

  // POST /api/v1/properties/maintain (Pay Shift Maintenance or Collect Property Yield)
  if (url.pathname === '/api/v1/properties/maintain' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const rawParcelId = String(data.parcelId || '').trim();
      const parcelId = parcelAliasMap[rawParcelId] || rawParcelId;
      const action = String(data.action || 'MAINTAIN').toUpperCase(); // 'MAINTAIN' | 'COLLECT_YIELD'
      if (action !== 'MAINTAIN' && action !== 'COLLECT_YIELD') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_PROPERTY_ACTION', action }));
        return;
      }
      const parcel = m3State.propertyParcels.find((p: any) => p.parcelId === parcelId || p.entityId === parcelId || p.parcelId === rawParcelId);
      if (!parcel) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PARCEL_NOT_FOUND', parcelId: rawParcelId }));
        return;
      }
      if (parcel.ownership.ownerId !== demoPlayer.playerId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'NOT_PARCEL_OWNER', message: 'You do not own this virtual parcel.' }));
        return;
      }

      if (action === 'COLLECT_YIELD') {
        const yieldGN = Math.max(0, Math.floor(Number(parcel.unclaimedYieldGN || 0)));
        if (yieldGN <= 0) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'NO_UNCLAIMED_YIELD', parcelId: parcel.parcelId }));
          return;
        }
        const latestDevelopment = [...(parcel.ownershipHistory || [])].reverse()
          .find((entry: any) => entry.event === 'DEVELOPED');
        const yieldEpoch = latestDevelopment?.timestampIso || parcel.ownership.acquiredAtIso;
        const idemKey = `${demoPlayer.playerId}:idem_prop_yield_${parcel.parcelId}_${yieldEpoch}`;
        if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'PROPERTY_YIELD_ALREADY_SETTLED', parcelId: parcel.parcelId }));
          return;
        }
        const txId = `tx_prop_yield_${demoPlayer.playerId}_${parcel.parcelId}_${yieldEpoch}`;
        try {
          const posted = globalEconomyLedger.postTransaction(
            txId,
            `ev_prop_yield_${parcel.parcelId}`,
            idemKey,
            demoPlayer.playerId,
            `Collected Virtual Property Operating Yield: ${parcel.displayName}`,
            [
              { accountCode: playerCashAccountCode(), debit: yieldGN, credit: 0 },
              { accountCode: 'Revenue:Player:Business', debit: 0, credit: yieldGN },
            ]
          );
          if (posted.transactionId !== txId) throw new Error('Property yield replay rejected.');
        } catch (error: any) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'PROPERTY_YIELD_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
          return;
        }
        demoPlayer.gameNairaBalance += yieldGN;
        parcel.unclaimedYieldGN = 0;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          action: 'COLLECT_YIELD',
          collectedYieldGN: yieldGN,
          parcel,
          newBalance: demoPlayer.gameNairaBalance,
          transactionId: txId,
          ledgerAudit: globalEconomyLedger.auditIntegrity(),
        }));
        return;
      }

      const maintCostGN = parcel.acquisitionTerms.maintenanceCostPerShiftGN;
      if (demoPlayer.gameNairaBalance < maintCostGN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INSUFFICIENT_FUNDS', requiredGN: maintCostGN }));
        return;
      }

      const txId = `tx_prop_maint_${parcel.parcelId}_${Date.now()}`;
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_prop_maint_${parcel.parcelId}_${Date.now()}`)}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PROPERTY_MAINTENANCE_REPLAY_REJECTED', parcelId: parcel.parcelId }));
        return;
      }
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_prop_maint_${parcel.parcelId}`,
          idemKey,
          demoPlayer.playerId,
          `Paid Virtual Property Maintenance: ${parcel.displayName}`,
          [
            { accountCode: 'Expense:Transport:Maintenance', debit: maintCostGN, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: maintCostGN },
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Property maintenance replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PROPERTY_MAINTENANCE_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance -= maintCostGN;
      parcel.operatingStatus = 'OPEN_OPERATING';
      parcel.ownershipHistory.push({
        ownerId: demoPlayer.playerId,
        ownerName: 'Amaka Driver (Player)',
        event: 'MAINTENANCE_PAID',
        timestampIso: new Date().toISOString(),
        amountGN: maintCostGN,
        ledgerTxId: txId,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: 'MAINTAIN',
        maintenanceCostGN: maintCostGN,
        parcel,
        newBalance: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity(),
      }));
    });
    return;
  }

  // POST /api/v1/m3/reset (Deterministic Sandbox Reset & Optional Virtual Grant for M3 Tests)
  if (url.pathname === '/api/v1/m3/reset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (typeof data.grantGN === 'number' && data.grantGN > 0 && process.env.PROJECT_EKO_ALLOW_SANDBOX_GRANTS !== 'true') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SANDBOX_GRANTS_DISABLED' }));
        return;
      }
      setLegacyPropertyParcels(currentLegacyAccount(), CANONICAL_PROPERTY_PARCELS as Array<Record<string, any>>);
      Object.assign(sharedM3State, {
        entities: JSON.parse(JSON.stringify(CANONICAL_WORLD_ENTITIES)),
        mediaSlots: JSON.parse(JSON.stringify(CANONICAL_MEDIA_SLOTS)),
        mediaCampaigns: JSON.parse(JSON.stringify(CANONICAL_MEDIA_CAMPAIGNS)),
        propertyParcels: JSON.parse(JSON.stringify(CANONICAL_PROPERTY_PARCELS)),
        routeSelectionLog: [],
        mediaEventsLog: [],
      });
      persistSharedCommerceState();
      if (typeof data.grantGN === 'number' && data.grantGN > 0) {
        const grant = Math.round(data.grantGN);
        const txId = `tx_m3_grant_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        try {
          globalEconomyLedger.postTransaction(
            txId,
            'ev_m3_sandbox_grant',
            `idem_${txId}`,
            demoPlayer.playerId,
            'M3 Sandbox Virtual Property Development Grant',
            [
              { accountCode: playerCashAccountCode(), debit: grant, credit: 0 },
              { accountCode: 'Equity:Treasury:CitizenGrant', debit: 0, credit: grant },
            ]
          );
          demoPlayer.gameNairaBalance += grant;
        } catch (_) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        newBalance: demoPlayer.gameNairaBalance,
        ledgerAudit: globalEconomyLedger.auditIntegrity(),
      }));
    });
    return;
  }

  // ===========================================================================
  // M4–M11 MASTER PRODUCT VISION & GAME SYSTEMS BIBLE — AUTHORITATIVE BACKEND
  // Covers:
  // - Part III (Sections 09–13, App A, C, F): EkoLife 3D Home, 5 Starter Profiles,
  //   7 Housing Tiers (0–6), 8 Room Zones, 12 Item Categories, 17 Appendix F2
  //   Price-Band Items, Collision-Safe Furniture Placement, 8 Needs, 8 Shops,
  //   Household Budget & Rent Safeguards
  // - Part IV (Sections 14–17, App B, C, F4): 8 Work Modes, 12 Career Families,
  //   10 Entry Jobs + 9 Job Cards, 8 Skill Groups, 7 Contextual Reputations,
  //   Server-Validated Evidence & Idempotent GN Journal Settlement
  // - Part V–VIII (Sections 18–40): 9 Vehicle Classes, 10 Mini-Games, 9 Business
  //   Types, 6 Causal Supply Chains, 8-Step Player Labour Market, Social/Crews/
  //   Home Visits/Safety, 8 Economy Health Metrics, 8-State Gated Payables (OFF)
  // ===========================================================================
  if (!gAny.__MASTER_BIBLE_STATE__) {
    const starterProfiles = [
      { profileId: 'profile_new_arrival', name: 'New Arrival', initialHomeTier: 0, initialHomeId: 'home_tier0_shared_room', startingBalanceAssumptionGN: 5000, tradeOff: 'Low overhead; shared amenities and limited storage.' },
      { profileId: 'profile_early_career', name: 'Early-Career Starter', initialHomeTier: 2, initialHomeId: 'home_tier2_selfcon_studio', startingBalanceAssumptionGN: 5000, tradeOff: 'More privacy; higher rent and furnishing needs.' },
      { profileId: 'profile_student_learner', name: 'Student / Learner', initialHomeTier: 0, initialHomeId: 'home_tier0_shared_room', startingBalanceAssumptionGN: 5000, tradeOff: 'Lower starting cost; study/training opportunity.' },
      { profileId: 'profile_skilled_trade', name: 'Skilled-Trade Starter', initialHomeTier: 1, initialHomeId: 'home_tier1_improved_room', startingBalanceAssumptionGN: 5000, tradeOff: 'Simple room with storage corner for tools; supports apprenticeship.' },
      { profileId: 'profile_creator_remote', name: 'Creator / Remote Worker', initialHomeTier: 1, initialHomeId: 'home_tier1_improved_room', startingBalanceAssumptionGN: 5000, tradeOff: 'Compact room with basic desk and connectivity option.' }
    ];

    const housingTiers = [
      { tier: 0, homeId: 'home_tier0_shared_room', archetype: 'Temporary furnished room / starter room', district: 'Yaba / Marina Backstreet', weeklyLeaseGN: 750, gracePeriodDays: 7, maxFurnitureSlots: 8, roomZones: ['zone_entry_hallway', 'zone_bedroom_sleep', 'zone_kitchenette', 'zone_bathroom_wash', 'zone_storage_utility'], unlockDriver: 'Available at arrival; teaches home interaction.' },
      { tier: 1, homeId: 'home_tier1_improved_room', archetype: 'Improved rented room', district: 'Surulere / Bariga / Marina', weeklyLeaseGN: 950, gracePeriodDays: 7, maxFurnitureSlots: 10, roomZones: ['zone_entry_hallway', 'zone_bedroom_sleep', 'zone_kitchenette', 'zone_bathroom_wash', 'zone_study_work', 'zone_storage_utility'], unlockDriver: 'Steady work, rent reliability and savings.' },
      { tier: 2, homeId: 'home_tier2_selfcon_studio', archetype: 'Self-contained studio / room-and-parlour', district: 'Ojota / Lagos Island', weeklyLeaseGN: 1450, gracePeriodDays: 7, maxFurnitureSlots: 14, roomZones: ['zone_entry_hallway', 'zone_bedroom_sleep', 'zone_living_area', 'zone_kitchenette', 'zone_bathroom_wash', 'zone_study_work', 'zone_storage_utility'], unlockDriver: 'Income stability and rental eligibility.' },
      { tier: 3, homeId: 'home_tier3_one_bed_flat', archetype: 'One-bedroom flat', district: 'Ikeja / Broad Street Edge', weeklyLeaseGN: 2400, gracePeriodDays: 7, maxFurnitureSlots: 18, roomZones: ['zone_entry_hallway', 'zone_bedroom_sleep', 'zone_living_area', 'zone_kitchenette', 'zone_bathroom_wash', 'zone_study_work', 'zone_balcony_yard', 'zone_storage_utility'], unlockDriver: 'Higher skill/reputation or stable income.' },
      { tier: 4, homeId: 'home_tier4_household_flat', archetype: 'Two/three-bedroom flat', district: 'Onikan / Surulere Prime', weeklyLeaseGN: 4200, gracePeriodDays: 7, maxFurnitureSlots: 24, roomZones: ['zone_entry_hallway', 'zone_bedroom_sleep', 'zone_living_area', 'zone_kitchenette', 'zone_bathroom_wash', 'zone_study_work', 'zone_balcony_yard', 'zone_storage_utility'], unlockDriver: 'Savings and longer-term progression.' },
      { tier: 5, homeId: 'home_tier5_premium_serviced', archetype: 'Serviced flat / terrace / premium apartment', district: 'Victoria Island / Lekki Phase 1', weeklyLeaseGN: 7500, gracePeriodDays: 7, maxFurnitureSlots: 30, roomZones: ['zone_entry_hallway', 'zone_bedroom_sleep', 'zone_living_area', 'zone_kitchenette', 'zone_bathroom_wash', 'zone_study_work', 'zone_balcony_yard', 'zone_storage_utility'], unlockDriver: 'Higher income and recurring costs.' },
      { tier: 6, homeId: 'home_tier6_executive_duplex', archetype: 'Premium house/duplex/estate residence', district: 'Ikoyi / East Island 36-Villa Estate', weeklyLeaseGN: 12500, gracePeriodDays: 7, maxFurnitureSlots: 40, roomZones: ['zone_entry_hallway', 'zone_bedroom_sleep', 'zone_living_area', 'zone_kitchenette', 'zone_bathroom_wash', 'zone_study_work', 'zone_balcony_yard', 'zone_storage_utility'], unlockDriver: 'Late-game aspiration; no gameplay monopoly.' }
    ];

    const roomZonesCatalog = [
      { roomId: 'zone_entry_hallway', roomType: 'Entry / hallway', coreObjects: ['Door', 'Mat', 'Shoe rack', 'Light switch'], actions: ['Enter/exit', 'Put items away', 'Inspect property'], bounds: { minX: -4.0, maxX: 4.0, minZ: 2.0, maxZ: 4.0 } },
      { roomId: 'zone_bedroom_sleep', roomType: 'Bedroom / sleep', coreObjects: ['Bed/mattress', 'Pillow', 'Wardrobe', 'Standing fan'], actions: ['Sleep', 'Rest', 'Change clothes', 'Store personal items'], bounds: { minX: -4.0, maxX: -0.5, minZ: -4.0, maxZ: 1.5 } },
      { roomId: 'zone_living_area', roomType: 'Living area', coreObjects: ['Sofa/chairs', 'Table', 'TV/Radio', 'Window', 'Curtains'], actions: ['Relax', 'Listen to Radio/TV', 'Host guests'], bounds: { minX: -0.5, maxX: 4.0, minZ: -1.5, maxZ: 2.0 } },
      { roomId: 'zone_kitchenette', roomType: 'Kitchen / kitchenette', coreObjects: ['Stove/cooker', 'Pot/utensils', 'Sink', 'Small refrigerator'], actions: ['Prepare meals', 'Wash dishes', 'Manage food supplies'], bounds: { minX: 0.5, maxX: 4.0, minZ: -4.0, maxZ: -1.5 } },
      { roomId: 'zone_bathroom_wash', roomType: 'Bathroom / wash area', coreObjects: ['Shower/bucket', 'Wash basin', 'Mirror', 'Toiletries kit'], actions: ['Bathe', 'Wash', 'Groom & restore hygiene'], bounds: { minX: -4.0, maxX: -1.5, minZ: 1.5, maxZ: 3.8 } },
      { roomId: 'zone_study_work', roomType: 'Study / work corner', coreObjects: ['Desk', 'Basic chair', 'Small lamp', 'Entry laptop', 'EkoPhone'], actions: ['Study', 'Apply for jobs', 'Complete digital micro-tasks'], bounds: { minX: -0.5, maxX: 3.8, minZ: -4.0, maxZ: -1.5 } },
      { roomId: 'zone_balcony_yard', roomType: 'Balcony / shared yard', coreObjects: ['Chair', 'Plants', 'Water storage', 'Inverter/solar'], actions: ['Air clothes', 'Check water/power resilience', 'Socialise'], bounds: { minX: -4.0, maxX: 4.0, minZ: 3.2, maxZ: 4.0 } },
      { roomId: 'zone_storage_utility', roomType: 'Storage / utility', coreObjects: ['Cupboard', 'Toolbox', 'Cleaning items', 'Workwear'], actions: ['Store inventory', 'Repair household items'], bounds: { minX: 1.8, maxX: 4.0, minZ: 1.5, maxZ: 3.8 } }
    ];

    // Appendix A + Appendix F2 + Section 11 Complete Item Catalogue (All 17 F2 Price-Band Items + Starter Essentials)
    const itemDefinitions = [
      { itemId: 'item_water_snack', itemVersion: '1.0', displayName: 'Water & Small Gala Snack Pack', category: 'Cooking', shopId: 'shop_corner_kiosk', purchaseCostGN: 80, priceBandGN: [50, 120], resaleValueGN: 0, footprint: { w: 0.3, d: 0.3, h: 0.3 }, placeable: false, allowedSurfaces: ['consumable'], durability: 100, interactions: ['CONSUME_FOOD'], effects: { hunger: 28, energy: 8, comfort: 2 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_bukka_meal', itemVersion: '1.0', displayName: 'Simple Marina Bukka Jollof Meal', category: 'Cooking', shopId: 'shop_corner_kiosk', purchaseCostGN: 250, priceBandGN: [180, 350], resaleValueGN: 0, footprint: { w: 0.4, d: 0.4, h: 0.2 }, placeable: false, allowedSurfaces: ['consumable'], durability: 100, interactions: ['CONSUME_FOOD'], effects: { hunger: 55, energy: 20, comfort: 8, health: 10 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_toiletries_kit', itemVersion: '1.0', displayName: 'Basic Toiletries & Soap Kit', category: 'Bathroom/hygiene', shopId: 'shop_corner_kiosk', purchaseCostGN: 200, priceBandGN: [150, 300], resaleValueGN: 80, footprint: { w: 0.4, d: 0.3, h: 0.3 }, placeable: true, allowedSurfaces: ['floor', 'table'], durability: 100, interactions: ['WASH_HYGIENE'], effects: { hygiene: 50, comfort: 6 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_workwear_vest', itemVersion: '1.0', displayName: 'Basic Workwear & Reflective Safety Gear', category: 'Work clothing/equipment', shopId: 'shop_lagos_threads', purchaseCostGN: 320, priceBandGN: [200, 450], resaleValueGN: 150, footprint: { w: 0.5, d: 0.4, h: 0.4 }, placeable: false, allowedSurfaces: ['wardrobe'], durability: 100, interactions: ['EQUIP_WORKWEAR'], effects: { comfort: 4, safetyBonus: 10 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_standing_fan', itemVersion: '1.0', displayName: 'Ox-Style Standing Ventilation Fan', category: 'Climate / lighting', shopId: 'shop_marina_appliances', purchaseCostGN: 750, priceBandGN: [600, 1000], resaleValueGN: 420, footprint: { w: 0.6, d: 0.6, h: 1.3 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['TOGGLE_FAN'], effects: { comfort: 18, energy: 10 }, utilityDemandGN: 15, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_basic_chair', itemVersion: '1.0', displayName: 'Ergonomic Study & Parlour Chair', category: 'Study/work', shopId: 'shop_eko_furniture', purchaseCostGN: 320, priceBandGN: [250, 450], resaleValueGN: 180, footprint: { w: 0.6, d: 0.6, h: 0.9 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['SIT_REST'], effects: { comfort: 10, energy: 12 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_small_table', itemVersion: '1.0', displayName: 'Compact Wooden Work & Dining Table', category: 'Living room', shopId: 'shop_eko_furniture', purchaseCostGN: 480, priceBandGN: [350, 650], resaleValueGN: 260, footprint: { w: 1.1, d: 0.7, h: 0.75 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['PREP_OR_STUDY'], effects: { comfort: 12, productivity: 10 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_pot_utensil_set', itemVersion: '1.0', displayName: 'Basic Aluminium Pot & Utensil Set', category: 'Cooking', shopId: 'shop_balogun_wholesaler', purchaseCostGN: 420, priceBandGN: [300, 600], resaleValueGN: 210, footprint: { w: 0.6, d: 0.5, h: 0.4 }, placeable: true, allowedSurfaces: ['floor', 'table'], durability: 100, interactions: ['COOK_HOME_MEAL'], effects: { hunger: 65, comfort: 10, energy: 18 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_small_lamp', itemVersion: '1.0', displayName: 'Rechargeable Warm LED Desk Lamp', category: 'Climate / lighting', shopId: 'shop_marina_appliances', purchaseCostGN: 220, priceBandGN: [150, 300], resaleValueGN: 110, footprint: { w: 0.35, d: 0.35, h: 0.45 }, placeable: true, allowedSurfaces: ['floor', 'table'], durability: 100, interactions: ['TOGGLE_LIGHT'], effects: { comfort: 8, productivity: 6 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_curtains', itemVersion: '1.0', displayName: 'Ankara Patterned Window Curtains', category: 'Decor/identity', shopId: 'shop_eko_furniture', purchaseCostGN: 350, priceBandGN: [250, 500], resaleValueGN: 170, footprint: { w: 1.2, d: 0.2, h: 1.5 }, placeable: true, allowedSurfaces: ['wall', 'floor'], durability: 100, interactions: ['ADMIRE_DECOR'], effects: { comfort: 11, recreation: 6 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_wardrobe_storage', itemVersion: '1.0', displayName: 'Compact Double-Door Wardrobe', category: 'Storage', shopId: 'shop_eko_furniture', purchaseCostGN: 900, priceBandGN: [700, 1200], resaleValueGN: 500, footprint: { w: 1.0, d: 0.6, h: 1.8 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['CHANGE_OUTFIT', 'STORE_ITEMS'], effects: { comfort: 14, storageCapacity: 12 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_electric_kettle', itemVersion: '1.0', displayName: 'Fast-Boil Electric Kettle & Stove Burner', category: 'Cooking', shopId: 'shop_marina_appliances', purchaseCostGN: 350, priceBandGN: [250, 450], resaleValueGN: 180, footprint: { w: 0.45, d: 0.45, h: 0.35 }, placeable: true, allowedSurfaces: ['floor', 'table'], durability: 100, interactions: ['BOIL_WATER_TEA'], effects: { hunger: 20, energy: 15, comfort: 7 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_bed_upgrade', itemVersion: '1.0', displayName: 'Orthopaedic posturepedic Bed & Mattress Upgrade', category: 'Sleeping essentials', shopId: 'shop_eko_furniture', purchaseCostGN: 1200, priceBandGN: [900, 1600], resaleValueGN: 680, footprint: { w: 1.8, d: 1.3, h: 0.65 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['SLEEP_DEEP_REST'], effects: { energy: 100, comfort: 28, health: 25 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_radio_tv', itemVersion: '1.0', displayName: 'EkoFM Smart Radio & Flatscreen TV', category: 'Living room', shopId: 'shop_marina_appliances', purchaseCostGN: 1650, priceBandGN: [1200, 2500], resaleValueGN: 950, footprint: { w: 1.1, d: 0.45, h: 0.85 }, placeable: true, allowedSurfaces: ['floor', 'table'], durability: 100, interactions: ['ENJOY_MEDIA_RADIO'], effects: { recreation: 45, social: 15, comfort: 16 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_smartphone_upgrade', itemVersion: '1.0', displayName: 'EkoPhone Pro 5G Smartphone Upgrade', category: 'Study/work', shopId: 'shop_marina_appliances', purchaseCostGN: 2800, priceBandGN: [2000, 4500], resaleValueGN: 1600, footprint: { w: 0.25, d: 0.25, h: 0.15 }, placeable: false, allowedSurfaces: ['wardrobe'], durability: 100, interactions: ['CHECK_EKOPHONE_PRO'], effects: { connectivity: 40, recreation: 15 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_entry_laptop', itemVersion: '1.0', displayName: 'Entry Workstation Laptop & Router Bundle', category: 'Study/work', shopId: 'shop_marina_appliances', purchaseCostGN: 5200, priceBandGN: [4500, 9000], resaleValueGN: 3100, footprint: { w: 0.7, d: 0.5, h: 0.35 }, placeable: true, allowedSurfaces: ['floor', 'table'], durability: 100, interactions: ['DO_REMOTE_WORK', 'STUDY_SKILL'], effects: { connectivity: 60, productivity: 35, comfort: 12 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_small_fridge', itemVersion: '1.0', displayName: 'Compact Energy-Saver Refrigerator', category: 'Food preservation', shopId: 'shop_marina_appliances', purchaseCostGN: 3200, priceBandGN: [2500, 4500], resaleValueGN: 1850, footprint: { w: 0.75, d: 0.75, h: 1.25 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['STORE_FRESH_FOOD'], effects: { hunger: 35, comfort: 20 }, utilityDemandGN: 25, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_cleaning_broom_set', itemVersion: '1.0', displayName: 'Household Broom, Mop & Detergent Kit', category: 'Laundry/cleaning', shopId: 'shop_corner_kiosk', purchaseCostGN: 180, priceBandGN: [120, 260], resaleValueGN: 70, footprint: { w: 0.4, d: 0.4, h: 0.9 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['CLEAN_HOME'], effects: { hygiene: 25, comfort: 15 }, provenance: 'ORIGINAL_PROJECT_EKO' },
      { itemId: 'item_solar_inverter', itemVersion: '1.0', displayName: 'Backup Solar Inverter & Water Tank Kit', category: 'Utility/resilience', shopId: 'shop_eko_utilities', purchaseCostGN: 4800, priceBandGN: [3800, 6500], resaleValueGN: 2900, footprint: { w: 0.85, d: 0.65, h: 0.95 }, placeable: true, allowedSurfaces: ['floor'], durability: 100, interactions: ['TOGGLE_BACKUP_POWER'], effects: { comfort: 30, connectivity: 30 }, provenance: 'ORIGINAL_PROJECT_EKO' }
    ];

    // Day-1 Starter Owned Items (Appendix F1: Bed/mattress + pillow, basic storage shelf, wash basin access, basic stove access, starter food pack)
    const initialOwnedItems = [
      { ownedItemId: 'own_starter_bed_01', ownerId: demoPlayer.playerId, itemId: 'item_starter_mattress', displayName: 'Starter Foam Mattress & Pillow Kit', category: 'Sleeping essentials', condition: 100, state: 'PLACED_IN_HOME', roomId: 'zone_bedroom_sleep', transform: { x: -2.6, y: 0.25, z: -2.4, rotY: 0 }, footprint: { w: 1.6, d: 1.1, h: 0.45 }, interactions: ['SLEEP_REST'], effects: { energy: 85, comfort: 14, health: 15 }, acquisitionSource: 'STARTER_PACKAGE_F1', ledgerTxId: 'tx_genesis_starter_home' },
      { ownedItemId: 'own_starter_storage_02', ownerId: demoPlayer.playerId, itemId: 'item_starter_shelf', displayName: 'Starter Storage Shelf & Crate', category: 'Storage', condition: 100, state: 'PLACED_IN_HOME', roomId: 'zone_bedroom_sleep', transform: { x: -3.2, y: 0.6, z: 0.2, rotY: 0 }, footprint: { w: 0.8, d: 0.5, h: 1.2 }, interactions: ['CHANGE_OUTFIT', 'STORE_ITEMS'], effects: { comfort: 8 }, acquisitionSource: 'STARTER_PACKAGE_F1', ledgerTxId: 'tx_genesis_starter_home' },
      { ownedItemId: 'own_starter_wash_03', ownerId: demoPlayer.playerId, itemId: 'item_starter_wash', displayName: 'Wash Area Bucket, Basin & Shower Point', category: 'Bathroom/hygiene', condition: 100, state: 'PLACED_IN_HOME', roomId: 'zone_bathroom_wash', transform: { x: -3.0, y: 0.5, z: 2.6, rotY: 0 }, footprint: { w: 0.9, d: 0.8, h: 1.0 }, interactions: ['WASH_HYGIENE'], effects: { hygiene: 75, comfort: 8 }, acquisitionSource: 'STARTER_PACKAGE_F1', ledgerTxId: 'tx_genesis_starter_home' },
      { ownedItemId: 'own_starter_cook_04', ownerId: demoPlayer.playerId, itemId: 'item_starter_cooker', displayName: 'Compact Tabletop Cooker & Dish Rack', category: 'Cooking', condition: 100, state: 'PLACED_IN_HOME', roomId: 'zone_kitchenette', transform: { x: 2.6, y: 0.5, z: -2.8, rotY: 0 }, footprint: { w: 1.0, d: 0.6, h: 0.85 }, interactions: ['COOK_HOME_MEAL'], effects: { hunger: 60, energy: 15, comfort: 6 }, acquisitionSource: 'STARTER_PACKAGE_F1', ledgerTxId: 'tx_genesis_starter_home' },
      { ownedItemId: 'own_starter_desk_05', ownerId: demoPlayer.playerId, itemId: 'item_starter_desk', displayName: 'Starter Work Surface & EkoPhone Dock', category: 'Study/work', condition: 100, state: 'PLACED_IN_HOME', roomId: 'zone_study_work', transform: { x: 1.2, y: 0.45, z: -2.8, rotY: 0 }, footprint: { w: 1.0, d: 0.6, h: 0.75 }, interactions: ['OPEN_JOBSHUB', 'STUDY_SKILL'], effects: { connectivity: 25, productivity: 12 }, acquisitionSource: 'STARTER_PACKAGE_F1', ledgerTxId: 'tx_genesis_starter_home' },
      { ownedItemId: 'own_starter_food_pack_06', ownerId: demoPlayer.playerId, itemId: 'item_water_snack', displayName: 'Starter Food & Water Welcome Pack', category: 'Cooking', condition: 100, state: 'IN_INVENTORY', roomId: null, transform: null, footprint: { w: 0.3, d: 0.3, h: 0.3 }, interactions: ['CONSUME_FOOD'], effects: { hunger: 35, energy: 12, comfort: 4 }, acquisitionSource: 'STARTER_PACKAGE_F1', ledgerTxId: 'tx_genesis_starter_home' }
    ];

    // Section 13: 8 Shop & Service Categories
    const shopsCatalog = [
      { shopId: 'shop_corner_kiosk', name: 'Marina Corner Kiosk & Provision Store', category: 'Corner shop / kiosk', entityId: 'ent_cms_bus_terminal', description: 'Water, snacks, toiletries and basic household goods.' },
      { shopId: 'shop_balogun_wholesaler', name: 'Balogun Market & Wholesale Arcade', category: 'Market / wholesaler', entityId: 'ent_balogun_wholesale_market', description: 'Food ingredients, cookware, clothing, household goods and business stock.' },
      { shopId: 'shop_eko_furniture', name: 'Eko Haven Furniture Showroom', category: 'Furniture shop', entityId: 'ent_broad_st_development_plot_04', description: 'Beds, chairs, tables, wardrobes, curtains and home decor.' },
      { shopId: 'shop_marina_appliances', name: 'Marina Electronics & Appliance Hub', category: 'Appliance/electronics shop', entityId: 'ent_ekobank_headquarters_tower', description: 'Standing fans, refrigerators, TV/radio, smartphones and work laptops.' },
      { shopId: 'shop_lagos_threads', name: 'Lagos Threads & Workwear Boutique', category: 'Clothing retailer', entityId: 'ent_balogun_wholesale_market', description: 'Everyday, workwear, safety gear, Senator native wear and Owambe outfits.' },
      { shopId: 'shop_eko_utilities', name: 'Eko Power, Water & Data Utility Desk', category: 'Utility/service provider', entityId: 'ent_ekobank_headquarters_tower', description: 'Virtual water, power, solar inverter and connectivity bundles.' },
      { shopId: 'shop_segun_home_repair', name: 'Master Segun Appliance & Home Repair', category: 'Repair provider', entityId: 'ent_segun_auto_clinic_and_fuel', description: 'Appliance/furniture repair, maintenance and home cleaning.' },
      { shopId: 'shop_ekologistics_delivery', name: 'EkoLogistics Home & Business Delivery', category: 'Delivery/logistics', entityId: 'ent_berger_fleet_depot', description: 'Moves large furniture purchases or wholesale business stock to your door.' }
    ];

    // Part IV (Sections 14–17, Appendix B & Appendix F4): 12 Career Families & 11 Complete Entry/Career Job Templates
    const jobTemplates = [
      {
        jobId: 'job_foot_courier',
        version: '1.0',
        title: 'CMS-to-TBS Foot Courier / Parcel Runner',
        workMode: 'Quick gig',
        careerFamily: 'Courier / logistics',
        locationEntityId: 'ent_cms_bus_terminal',
        destinationEntityId: 'ent_ekobank_headquarters_tower',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'None (Entry Tier — No Vehicle Required)',
        activeDurationLabel: '4–7 min',
        grossGNRange: [400, 650],
        baseGrossGN: 550,
        disclosedCostsGN: 30,
        costBreakdown: '₦30 GN Waybill & Packaging Pouch',
        riskLabel: 'Low (Keep parcel dry & on schedule)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_logistics',
        reputationDomain: 'reliability',
        objectiveSteps: ['Collect sealed parcel at CMS Dispatch Desk', 'Follow Broad Street walkway to EkoBank Tower', 'Hand over parcel & sign digital manifest']
      },
      {
        jobId: 'job_market_runner',
        version: '1.0',
        title: 'Balogun Market Wholesale Runner',
        workMode: 'Quick gig',
        careerFamily: 'Retail / market',
        locationEntityId: 'ent_balogun_wholesale_market',
        destinationEntityId: 'ent_mama_nkechi_bukka',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'None (Entry Tier — No Vehicle Required)',
        activeDurationLabel: '5–7 min',
        grossGNRange: [350, 550],
        baseGrossGN: 480,
        disclosedCostsGN: 40,
        costBreakdown: '₦40 GN Market Porterage & Carrier Bag',
        riskLabel: 'Low (Compare stock prices accurately)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_commerce',
        reputationDomain: 'service',
        objectiveSteps: ['Inspect wholesale spice & produce list at Balogun Arcade', 'Verify stock count & bargain supplier rate', 'Deliver supplies to Mama Nkechi Bukka']
      },
      {
        jobId: 'job_shop_assistant',
        version: '1.0',
        title: 'Broad Street Retail Shop-Floor Assistant',
        workMode: 'Scheduled shift',
        careerFamily: 'Retail / market',
        locationEntityId: 'ent_balogun_wholesale_market',
        destinationEntityId: 'ent_balogun_wholesale_market',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'None (Entry Tier — No Vehicle Required)',
        activeDurationLabel: '6–9 min',
        grossGNRange: [400, 650],
        baseGrossGN: 560,
        disclosedCostsGN: 25,
        costBreakdown: '₦25 GN Store Apron Cleaning Fee',
        riskLabel: 'Low (Maintain queue order & shelf accuracy)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_commerce',
        reputationDomain: 'service',
        objectiveSteps: ['Restock front display shelves', 'Serve 3 walk-in customers & verify receipts', 'Tidy counter & reconcile stock sheet']
      },
      {
        jobId: 'job_bukka_helper',
        version: '1.0',
        title: "Mama Nkechi's Bukka & Kitchen Helper",
        workMode: 'Scheduled shift',
        careerFamily: 'Food / hospitality',
        locationEntityId: 'ent_mama_nkechi_bukka',
        destinationEntityId: 'ent_mama_nkechi_bukka',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'Employer supplies cooking equipment (+Free Meal Benefit)',
        activeDurationLabel: '7–10 min',
        grossGNRange: [500, 800],
        baseGrossGN: 680,
        disclosedCostsGN: 50,
        costBreakdown: '₦50 GN Hygiene Cap & Sanitizer Consumables',
        riskLabel: 'Low (Recipe timing & station cleanliness)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_food_hospitality',
        reputationDomain: 'service',
        objectiveSteps: ['Wash & prep smoky party Jollof ingredients', 'Serve lunchtime commuter orders promptly', 'Sanitize cooking station (+25 Hunger restored)']
      },
      {
        jobId: 'job_event_setup',
        version: '1.0',
        title: 'TBS Owambe Stage & Event Setup Assistant',
        workMode: 'Contract',
        careerFamily: 'Events / entertainment',
        locationEntityId: 'ent_tbs_owambe_arena',
        destinationEntityId: 'ent_tbs_owambe_arena',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'None (Entry Tier — No Vehicle Required)',
        activeDurationLabel: '8–12 min',
        grossGNRange: [550, 850],
        baseGrossGN: 740,
        disclosedCostsGN: 60,
        costBreakdown: '₦60 GN Event Crew Glove & Badge Fee',
        riskLabel: 'Low (Follow stage checklist & sound check timing)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_creative_perf',
        reputationDomain: 'reliability',
        objectiveSteps: ['Position VIP canopy chairs & sound speakers at TBS', 'Run stage lighting & microphone checklist', 'Confirm guest check-in barriers']
      },
      {
        jobId: 'job_workshop_apprentice',
        version: '1.0',
        title: 'Segun Auto Clinic Mechanic Apprentice',
        workMode: 'Training/apprenticeship',
        careerFamily: 'Automotive / technical',
        locationEntityId: 'ent_segun_auto_clinic_and_fuel',
        destinationEntityId: 'ent_segun_auto_clinic_and_fuel',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'Employer-provided bay tools for lesson',
        activeDurationLabel: '7–10 min',
        grossGNRange: [300, 500],
        baseGrossGN: 440,
        disclosedCostsGN: 40,
        costBreakdown: '₦40 GN Degreaser & Shop Rag Consumables',
        riskLabel: 'Low (Follow safe hydraulic bay procedure)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_trade_repair',
        reputationDomain: 'skill',
        objectiveSteps: ['Diagnose Danfo alternator & belt tension fault', 'Select torque wrench & calibrate spark plugs', 'Complete safety inspection sign-off']
      },
      {
        jobId: 'job_digital_microtask',
        version: '1.0',
        title: 'EkoTech Digital QA & Data Analyst Micro-Task',
        workMode: 'Contract',
        careerFamily: 'Business / data / product',
        locationEntityId: 'ent_ekobank_headquarters_tower',
        destinationEntityId: 'ent_ekobank_headquarters_tower',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'Home Study Desk / Entry Laptop OR Marina Public Hub',
        activeDurationLabel: '8–12 min',
        grossGNRange: [650, 1000],
        baseGrossGN: 850,
        disclosedCostsGN: 80,
        costBreakdown: '₦80 GN In-Game Data / Hub Connectivity Pass',
        riskLabel: 'Low (Submit accurate bug & route telemetry checklist)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_digital_prof',
        reputationDomain: 'skill',
        objectiveSteps: ['Audit 3 transit route ledger entries for discrepancies', 'Run QA checklist on EkoPlaces directory pins', 'Submit structured verification report']
      },
      {
        jobId: 'job_danfo_conductor_coop',
        version: '1.0',
        title: 'CMS ⇄ TBS Danfo Conductor Co-Op Shift',
        workMode: 'Scheduled shift',
        careerFamily: 'Transport / passenger',
        locationEntityId: 'ent_cms_bus_terminal',
        destinationEntityId: 'ent_tbs_ceremonial_arch',
        requiresVehicle: false,
        requiredSkillId: null,
        requiredGear: 'Pass conductor call tutorial (No owned vehicle needed)',
        activeDurationLabel: '8–12 min',
        grossGNRange: [500, 900],
        baseGrossGN: 760,
        disclosedCostsGN: 60,
        costBreakdown: '₦60 GN Union Park Ticket & Change Pouch',
        riskLabel: 'Medium (Accurate change arithmetic & safe stop calls)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_mobility',
        reputationDomain: 'service',
        objectiveSteps: ['Call "TBS! Broad Street! Enter with your change!" at CMS Bay', 'Board waiting commuters & calculate exact Naira change', 'Signal safe stop at Broad St Mid & TBS Loop']
      },
      {
        jobId: 'job_contracted_driver',
        version: '1.0',
        title: 'Berger EkoFleet Contracted Shuttle Driver',
        workMode: 'Profession',
        careerFamily: 'Transport / passenger',
        locationEntityId: 'ent_berger_fleet_depot',
        destinationEntityId: 'ent_tbs_ceremonial_arch',
        requiresVehicle: false,
        requiredSkillId: 'skill_mobility',
        requiredGear: 'Employer/Fleet vehicle assigned at Berger Depot',
        activeDurationLabel: '10–15 min',
        grossGNRange: [800, 1400],
        baseGrossGN: 1180,
        disclosedCostsGN: 220,
        costBreakdown: '₦220 GN Fleet Fuel & Depot Dispatch Levy',
        riskLabel: 'Medium (Respect speed limits, stops & passenger comfort)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_mobility',
        reputationDomain: 'safety',
        objectiveSteps: ['Check out assigned shuttle at Berger Fleet Depot', 'Pick up commuters at CMS & Broad Street Central', 'Complete safe arrival at TBS Ceremonial Loop']
      },
      {
        jobId: 'job_independent_ridehail',
        version: '1.0',
        title: 'EkoRide Independent Executive Charter (CMS → TBS)',
        workMode: 'Profession',
        careerFamily: 'Transport / passenger',
        locationEntityId: 'ent_mission_sister_blessing_pickup',
        destinationEntityId: 'ent_tbs_ceremonial_arch',
        requiresVehicle: true,
        requiredSkillId: 'skill_mobility',
        requiredGear: 'Eligible owned/rented Sedan, SUV, Keke or Danfo',
        activeDurationLabel: '10–15 min',
        grossGNRange: [800, 1400],
        baseGrossGN: 1320,
        disclosedCostsGN: 260,
        costBreakdown: '₦260 GN Fuel Burn, Tyre Wear & EkoRide Dispatch Fee',
        riskLabel: 'Medium (Zero preventable collisions for 5-star tip)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_mobility',
        reputationDomain: 'safety',
        objectiveSteps: ['Pick up Sister Blessing at CMS Curbside Bay', 'Navigate Broad Street corridor smoothly', 'Drop off at TBS South Gate & settle ledger receipt']
      },
      {
        jobId: 'job_furniture_delivery',
        version: '1.0',
        title: 'EkoLogistics Home Furniture & Supply Delivery',
        workMode: 'Contract',
        careerFamily: 'Courier / logistics',
        locationEntityId: 'ent_berger_fleet_depot',
        destinationEntityId: 'ent_marina_palm_courts_estate',
        requiresVehicle: false,
        requiredSkillId: 'skill_logistics',
        requiredGear: 'Fleet Delivery Van provided or Team Co-op',
        activeDurationLabel: '8–12 min',
        grossGNRange: [700, 1150],
        baseGrossGN: 960,
        disclosedCostsGN: 120,
        costBreakdown: '₦120 GN Van Fuel & Strapping Kit',
        riskLabel: 'Low (Zero cargo damage & accurate placement)',
        repeatability: 'Unlimited repeatable shift',
        skillTrained: 'skill_logistics',
        reputationDomain: 'reliability',
        objectiveSteps: ['Load boxed furniture order at Showroom Dock', 'Drive carefully along cross-street to East Island Estate', 'Confirm doorstep delivery & customer sign-off']
      }
    ];

    // Section 15: All 12 Career Families
    const careerFamilies = [
      'Transport / passenger', 'Courier / logistics', 'Retail / market', 'Food / hospitality',
      'Automotive / technical', 'Fashion / personal services', 'Construction / facilities',
      'Office / administration', 'Business / data / product', 'Digital / creative',
      'Events / entertainment', 'Community / city services'
    ];

    // Section 16: 8 Skill Groups & 7 Contextual Reputations
    const skillsState: Record<string, { skillId: string; name: string; level: number; xp: number; nextLevelXp: number; unlocks: string }> = {
      skill_mobility: { skillId: 'skill_mobility', name: 'Mobility & Safe Driving', level: 2, xp: 140, nextLevelXp: 250, unlocks: 'Commercial vehicle classes, higher-value transit contracts' },
      skill_logistics: { skillId: 'skill_logistics', name: 'Logistics & Dispatch', level: 1, xp: 60, nextLevelXp: 150, unlocks: 'Multi-stop jobs, larger shipments, fleet dispatcher roles' },
      skill_trade_repair: { skillId: 'skill_trade_repair', name: 'Trade & Technical Repair', level: 1, xp: 45, nextLevelXp: 150, unlocks: 'Advanced vehicle/home repairs, workshop permits' },
      skill_commerce: { skillId: 'skill_commerce', name: 'Commerce & Bargaining', level: 1, xp: 75, nextLevelXp: 150, unlocks: 'Wholesale sourcing discounts, store management' },
      skill_food_hospitality: { skillId: 'skill_food_hospitality', name: 'Food & Hospitality', level: 1, xp: 50, nextLevelXp: 150, unlocks: 'Catering contracts, bukka & suya stall mastery' },
      skill_digital_prof: { skillId: 'skill_digital_prof', name: 'Digital & Professional Analysis', level: 1, xp: 40, nextLevelXp: 150, unlocks: 'Analyst/QA contracts, remote digital studio briefs' },
      skill_creative_perf: { skillId: 'skill_creative_perf', name: 'Creative & Event Production', level: 1, xp: 55, nextLevelXp: 150, unlocks: 'Event production, fashion styling & creator briefs' },
      skill_leadership_ent: { skillId: 'skill_leadership_ent', name: 'Leadership & Enterprise', level: 1, xp: 65, nextLevelXp: 150, unlocks: 'Fleet delegation, staff hiring & multi-branch operations' }
    };

    const contextualReputation: Record<string, { id: string; label: string; score: number; tier: string }> = {
      reliability: { id: 'reliability', label: 'Reliability (Completion & Punctuality)', score: 92, tier: 'TRUSTED' },
      safety: { id: 'safety', label: 'Safety (Collision-Free & Road Discipline)', score: 94, tier: 'EXEMPLARY' },
      service: { id: 'service', label: 'Service (Passenger & Client Satisfaction)', score: 90, tier: 'HIGH' },
      skill: { id: 'skill', label: 'Verified Job Family Skill', score: 86, tier: 'PROFICIENT' },
      businessTrust: { id: 'businessTrust', label: 'Business & Contract Fulfilment', score: 88, tier: 'GOOD_STANDING' },
      communityConduct: { id: 'communityConduct', label: 'Community Code of Conduct', score: 98, tier: 'CLEAN_RECORD' },
      creatorPartnerTrust: { id: 'creatorPartnerTrust', label: 'Creator & IP Provenance Compliance', score: 95, tier: 'VERIFIED' }
    };

    // Section 12: 8 Needs & Wellbeing State (with zero punitive offline decay)
    const needsState = {
      hunger: 84,
      energy: 88,
      hygiene: 86,
      social: 74,
      recreation: 72,
      comfort: 80,
      health: 96,
      connectivity: 85,
      offlineDecayDisabled: true,
      accessibilityOptions: {
        reducedPrompts: false,
        reducedMotion: false,
        simplifiedNeeds: false
      },
      lastUpdatedAtIso: new Date().toISOString()
    };

    // Section 18: Full 9-Class Vehicle & Water Transit Catalogue (All 9 PLAYABLE in Phase 7 / M7)
    const nineVehicleClasses = [
      { classId: 'veh_compact_sedan', name: 'Adera Compact 1.6 Sedan', classType: 'Compact sedan', status: 'PLAYABLE', priceGN: 120000, charterFeeGN: 250, grossRunGN: 1150, capacity: 4, fuelBurnLPerKm: 0.08, primaryUse: 'Starter private vehicle, ride-hail, taxi and courier work.' },
      { classId: 'veh_suv_premium', name: 'Adera Royale SUV 3.0', classType: 'SUV / premium vehicle', status: 'PLAYABLE', priceGN: 290000, charterFeeGN: 450, grossRunGN: 1950, capacity: 6, fuelBurnLPerKm: 0.13, primaryUse: 'Premium passenger charter and Victoria Island executive runs.' },
      { classId: 'veh_yellow_danfo', name: 'Apex Danfo 14 Minibus', classType: 'Yellow Danfo', status: 'PLAYABLE', priceGN: 250000, charterFeeGN: 350, grossRunGN: 1750, capacity: 14, fuelBurnLPerKm: 0.14, primaryUse: 'Route transport, passenger fares and conductor co-op.' },
      { classId: 'veh_korope_shuttle', name: 'Koro Mini-Shuttle (Korope 7)', classType: 'Korope / shuttle', status: 'PLAYABLE', priceGN: 145000, charterFeeGN: 220, grossRunGN: 1200, capacity: 7, fuelBurnLPerKm: 0.09, primaryUse: 'Smaller local route operations and tight inner-street stops.' },
      { classId: 'veh_brt_coach', name: 'EkoBRT 42 High-Capacity Coach', classType: 'BRT-style coach', status: 'PLAYABLE', priceGN: 380000, charterFeeGN: 550, grossRunGN: 2800, capacity: 42, fuelBurnLPerKm: 0.22, primaryUse: 'Structured high-capacity LAMATA corridor simulation.' },
      { classId: 'veh_okada_moto', name: 'Koro Okada 125cc Dispatch', classType: 'Okada / motorcycle', status: 'PLAYABLE', priceGN: 35000, charterFeeGN: 100, grossRunGN: 850, capacity: 1, fuelBurnLPerKm: 0.04, primaryUse: 'Agile parcel courier and short-trip dispatch.' },
      { classId: 'veh_keke_tricycle', name: 'Apex Keke NAPEP 200', classType: 'Keke / tricycle', status: 'PLAYABLE', priceGN: 65000, charterFeeGN: 140, grossRunGN: 980, capacity: 3, fuelBurnLPerKm: 0.05, primaryUse: 'Local passenger and estate shuttle service.' },
      { classId: 'veh_delivery_van', name: 'Apex CargoVan 2500 Logistics', classType: 'Delivery van / truck', status: 'PLAYABLE', priceGN: 210000, charterFeeGN: 380, grossRunGN: 2250, capacity: 2, fuelBurnLPerKm: 0.15, primaryUse: 'Furniture delivery, wholesale market stock and freight.' },
      { classId: 'veh_lagoon_ferry', name: 'LASWA EkoWaterways Catamaran & Heavy Rig', classType: 'Waterways ferry / heavy service', status: 'PLAYABLE', priceGN: 420000, charterFeeGN: 500, grossRunGN: 2650, capacity: 36, fuelBurnLPerKm: 0.20, primaryUse: 'Lagoon ferry transit (CMS ⇄ VI ⇄ Ikoyi ⇄ Apapa) and heavy port logistics.' }
    ];

    // Section 09: All 8 Canonical Lagos Districts (Phase 10 / M10 Multi-District 3D Streaming)
    const eightLagosDistricts = [
      { districtId: 'dist_lagos_island', name: 'Lagos Island Core (Marina / CMS / Broad St / TBS)', availability: 'PLAYABLE', streamState: 'STREAMED_ACTIVE', hubCoords: { x: -96, y: 0.22, z: -150 }, signatureLandmark: 'Tafawa Balewa Square & CMS Bus Terminal', transitLinks: ['BRT', 'Blue Line Rail', 'CMS Ferry Jetty', 'Danfo'] },
      { districtId: 'dist_victoria_island', name: 'Victoria Island & Eko Atlantic Hub', availability: 'PLAYABLE', streamState: 'STREAMABLE_3D', hubCoords: { x: -28, y: 0.22, z: -42 }, signatureLandmark: 'Adeola Odeku Corporate Towers & Eko Atlantic Seawall', transitLinks: ['VI Water Jetty', 'EkoRide Executive', 'Coastal Bus'] },
      { districtId: 'dist_yaba_mainland', name: 'Yaba Tech & Academic Corridor', availability: 'PLAYABLE', streamState: 'STREAMABLE_3D', hubCoords: { x: -112, y: 0.22, z: -60 }, signatureLandmark: 'Sabo Tech Incubator & Unilag Gate Hub', transitLinks: ['Mainland BRT', 'Danfo Express', 'Okada Courier'] },
      { districtId: 'dist_ikeja_capital', name: 'Ikeja Civic, Computer Village & Airport Hub', availability: 'PLAYABLE', streamState: 'STREAMABLE_3D', hubCoords: { x: -78, y: 0.22, z: -128 }, signatureLandmark: 'Computer Village Electronics Plaza & Alausa Secretariat', transitLinks: ['Red/Blue Rail Link', 'Airport Shuttle', 'BRT'] },
      { districtId: 'dist_lekki_peninsula', name: 'Lekki Phase 1 & Haven Residential Corridor', availability: 'PLAYABLE', streamState: 'STREAMABLE_3D', hubCoords: { x: -26, y: 0.22, z: -98 }, signatureLandmark: 'Lekki Link Cable Bridge & 400-Home Green-Roof Estate', transitLinks: ['Estate Keke', 'Coastal Expressway', 'Lekki Jetty'] },
      { districtId: 'dist_apapa_port', name: 'Apapa Port, Container Terminal & Logistics', availability: 'PLAYABLE', streamState: 'STREAMABLE_3D', hubCoords: { x: -128, y: 0.22, z: -195 }, signatureLandmark: 'Apapa Container Gantry Cranes & Tin Can Wharf', transitLinks: ['CMS-Apapa Ferry', 'Heavy Flatbed Freight', 'Rail Spur'] },
      { districtId: 'dist_surulere_cultural', name: 'Surulere National Stadium, Cinema & Music Hub', availability: 'PLAYABLE', streamState: 'STREAMABLE_3D', hubCoords: { x: -64, y: 0.22, z: 22 }, signatureLandmark: 'Surulere Stadium Arena & Nollywood Studio Strip', transitLinks: ['Ojuelegba Danfo', 'Stadium BRT', 'Keke'] },
      { districtId: 'dist_ikoyi_lagoon', name: 'Ikoyi Waterfront & Lagoon Residential', availability: 'PLAYABLE', streamState: 'STREAMABLE_3D', hubCoords: { x: -24, y: 0.22, z: -68 }, signatureLandmark: 'Falomo Lagoon Promenade & Waterfront Mansions', transitLinks: ['Falomo Ferry Jetty', 'Executive SUV', 'Bridge Link'] }
    ];

    // Section 22 & 23: 6 Causal Supply Chains & Player Labour Market Offers
    const supplyChains = [
      { chainId: 'chain_food', name: 'Food & Culinary Chain', flow: 'Balogun Wholesaler → Delivery Driver → Suya/Bukka Stall → Commuter Customer', wholesaleInputCostGN: 250, deliveryFeeGN: 80, retailRevenueGN: 550, netMarginGN: 220, stockUnitsAdded: 10 },
      { chainId: 'chain_vehicle', name: 'Vehicle Parts & Maintenance Chain', flow: 'Balogun Parts Supplier → Logistics → Segun Auto Clinic → Fleet Owner', wholesaleInputCostGN: 400, deliveryFeeGN: 100, retailRevenueGN: 820, netMarginGN: 320, stockUnitsAdded: 8 },
      { chainId: 'chain_fashion', name: 'Fashion & Textile Chain', flow: 'Balogun Textile Market → Tailor Studio → Lagos Threads Retailer → Citizen', wholesaleInputCostGN: 320, deliveryFeeGN: 70, retailRevenueGN: 700, netMarginGN: 310, stockUnitsAdded: 8 },
      { chainId: 'chain_furnishing', name: 'Home Furnishing Chain', flow: 'Eko Furniture Showroom → EkoLogistics Van → Player 3D Home Interior', wholesaleInputCostGN: 450, deliveryFeeGN: 120, retailRevenueGN: 900, netMarginGN: 330, stockUnitsAdded: 5 },
      { chainId: 'chain_digital', name: 'Digital & Creative Brief Chain', flow: 'Marina Corporate Brief → Creator/Analyst Desk → QA Review → Settlement', wholesaleInputCostGN: 80, deliveryFeeGN: 0, retailRevenueGN: 650, netMarginGN: 570, stockUnitsAdded: 1 },
      { chainId: 'chain_events', name: 'Owambe & City Event Chain', flow: 'TBS Venue → Event Organiser → Catering/Sound Suppliers → Transit Surge', wholesaleInputCostGN: 500, deliveryFeeGN: 140, retailRevenueGN: 1100, netMarginGN: 460, stockUnitsAdded: 12 }
    ];

    const labourMarketOffers = [
      { offerId: 'lob_suya_night_01', employerId: 'usr_lagos_citizen_01', employerName: "Mallam Haruna's Suya Grill", role: 'Evening Grill & Spice Assistant', task: 'Prep 20 beef skewers & serve Broad St night commuters', payGN: 620, durationLabel: '8 min shift', status: 'OPEN', workerId: null, rating: null },
      { offerId: 'lob_danfo_conductor_02', employerId: 'npc_driver_tunde', employerName: 'Tunde Danfo Crew (CMS–TBS)', role: 'Route Conductor Co-Op Partner', task: 'Call stops & manage passenger change along Broad Street', payGN: 700, durationLabel: '10 min shift', status: 'OPEN', workerId: null, rating: null },
      { offerId: 'lob_bukka_supply_03', employerId: 'npc_mama_nkechi', employerName: "Mama Nkechi's Marina Bukka", role: 'Produce & Rice Restock Runner', task: 'Transport 2 sacks of Jollof ingredients from Balogun Market', payGN: 540, durationLabel: '6 min shift', status: 'OPEN', workerId: null, rating: null }
    ];

    // Section 24 & 32: Social, Crews, Home Visits & Moderation State
    const socialAndSafetyState = {
      presenceOptIn: true,
      homeVisitPolicy: { permission: 'FRIENDS_ALLOWED', maxVisitors: 4, itemProtectionLocked: true, activeVisitors: ['Tunde_Danfo', 'Chidinma_Tech'] },
      friends: [
        { peerId: 'peer_tunde', name: 'Tunde Bakare', role: 'Danfo Crew Captain', status: 'ONLINE_BROAD_ST', trustScore: 95 },
        { peerId: 'peer_chidinma', name: 'Chidinma Okafor', role: 'Yaba FinTech Analyst', status: 'ONLINE_MARINA', trustScore: 97 },
        { peerId: 'peer_segun', name: 'Master Segun', role: 'Lead Auto Engineer', status: 'AT_WORKSHOP', trustScore: 99 }
      ],
      crews: [
        { crewId: 'crew_marina_transit', name: 'Marina Express Transit Crew', category: 'Transport Crew', members: 14, joined: true, perk: '+10% Co-op Conductor & Fleet Route Coordination' },
        { crewId: 'crew_balogun_syndicate', name: 'Balogun Wholesale Logistics Syndicate', category: 'Logistics Syndicate', members: 9, joined: false, perk: '+12% Freight & Market Runner Efficiency' },
        { crewId: 'crew_eko_creators', name: 'Eko Creative & Owambe Collective', category: 'Creative Collective', members: 18, joined: false, perk: '+15% Event Setup & Digital Brief Reputation' }
      ],
      mutedPeerIds: [] as string[],
      blockedPeerIds: [] as string[],
      safetyReports: [] as any[]
    };

    // Section 27: Real-World Earning Strict Boundaries, 8-State Payable Lifecycle & 8 Regulatory Gates (OFF)
    const realRewardComplianceState = {
      realCashRewardsEnabled: false, // NON-NEGOTIABLE: OFF until all 8 regulatory & provider gates have written clearance
      gnToFiatConversionAllowed: false,
      hustleCoinsToFiatAllowed: false,
      playerDepositsOrStakingAllowed: false,
      paidEntryCompetitionsAllowed: false,
      payableLifecycleStates: ['PENDING', 'VERIFIED', 'APPROVED', 'PAYMENT_PROCESSING', 'PAID', 'ON_HOLD', 'FAILED', 'REVERSED'],
      regulatoryGates: [
        { gateId: 'gate_gaming_classification', area: 'Gaming classification', status: 'GATED_PENDING_WRITTEN_COUNSEL', requirement: 'Written state/federal authority classification for free-to-play sponsor-funded skill/creator model.' },
        { gateId: 'gate_competition_prizes', area: 'Competition / prizes', status: 'GATED_PENDING_WRITTEN_COUNSEL', requirement: 'Verify promotional/prize competition rules and mandatory participant disclosures.' },
        { gateId: 'gate_payments_stored_value', area: 'Payments / stored value', status: 'GATED_PENDING_WRITTEN_COUNSEL', requirement: 'Confirm accounts-payable payout flow obligations without stored-value wallet creation.' },
        { gateId: 'gate_provider_acceptance', area: 'Provider acceptance', status: 'GATED_PENDING_PSP_APPROVAL', requirement: 'Written regulated PSP approval for exact sponsor reward & payout workflow.' },
        { gateId: 'gate_aml_identity', area: 'AML / identity', status: 'GATED_PENDING_POLICY_SIGN_OFF', requirement: 'Define KYC tiers, sanctions checks, transaction monitoring and retention thresholds.' },
        { gateId: 'gate_age_safeguarding', area: 'Age / safeguarding', status: 'GATED_PENDING_POLICY_SIGN_OFF', requirement: 'Enforce 18+ age verification and minor safeguarding restrictions on reward campaigns.' },
        { gateId: 'gate_tax_contracts', area: 'Tax / contracts', status: 'GATED_PENDING_TAX_SIGN_OFF', requirement: 'Establish withholding, invoicing and recipient tax reporting rules.' },
        { gateId: 'gate_privacy_evidence', area: 'Privacy / evidence', status: 'GATED_PENDING_DPO_SIGN_OFF', requirement: 'Data minimisation and lawful retention schedule for anti-cheat & KYC telemetry.' }
      ],
      sandboxPayables: [
        { payableId: 'pay_sandbox_demo_01', campaignId: 'camp_adera_safe_driver_pilot', sponsorName: 'Adera Motors (Sandbox Dry-Run)', recipientId: demoPlayer.playerId, state: 'ON_HOLD', holdReason: 'GLOBAL_REAL_REWARD_GATE_LOCKED_OFF', note: 'Simulated dry-run only — zero fiat disbursement enabled.' }
      ]
    };

    // Section 07: 18 Source-Verified Lagos Transport Reference Nodes
    const transportReferenceNodes = [
      { worldNodeId: 'node_cms', nodeType: 'BRTStop', name: 'CMS Bus, BRT & Blue Line Interchange', districtId: 'dist_lagos_island', geoReference: { lat: 6.4508, lng: 3.3894, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -110, y: 0, z: -200, heading: 0 }, connections: ['node_marina', 'node_national_theatre', 'node_oyingbo'], services: ['Passenger', 'BRT', 'Rail', 'Ferry'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_marina', nodeType: 'RailStation', name: 'Marina Elevated Rail & Waterfront Node', districtId: 'dist_lagos_island', geoReference: { lat: 6.4525, lng: 3.3852, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -118, y: 0, z: -155, heading: 0 }, connections: ['node_cms', 'node_national_theatre'], services: ['Passenger', 'Rail', 'Jobs'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_national_theatre', nodeType: 'RailStation', name: 'National Theatre Cultural Interchange', districtId: 'dist_surulere_cultural', geoReference: { lat: 6.4767, lng: 3.3688, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -64, y: 0, z: 22, heading: 0 }, connections: ['node_marina', 'node_iganmu', 'node_oyingbo'], services: ['Passenger', 'Rail', 'Event'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_iganmu', nodeType: 'RailStation', name: 'Iganmu Industrial & Logistics Station', districtId: 'dist_apapa_port', geoReference: { lat: 6.4820, lng: 3.3560, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -75, y: 0, z: -70, heading: 0 }, connections: ['node_national_theatre', 'node_alaba', 'node_mile_2'], services: ['Passenger', 'Freight', 'Repair'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_alaba', nodeType: 'BusStop', name: 'Alaba International Electronics & Trade Node', districtId: 'dist_apapa_port', geoReference: { lat: 6.4622, lng: 3.1912, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -81, y: 0, z: -175, heading: 0 }, connections: ['node_mile_2', 'node_iganmu'], services: ['Passenger', 'Freight', 'Wholesale'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_mile_2', nodeType: 'RailStation', name: 'Mile 2 Multi-Modal Terminal & Ferry Link', districtId: 'dist_apapa_port', geoReference: { lat: 6.4631, lng: 3.3095, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -126, y: 0, z: -195, heading: 0 }, connections: ['node_iganmu', 'node_alaba', 'node_cms'], services: ['Passenger', 'Rail', 'Ferry', 'Freight'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_oyingbo', nodeType: 'RailStation', name: 'Oyingbo Red Line & Market Hub', districtId: 'dist_yaba_mainland', geoReference: { lat: 6.4792, lng: 3.3814, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -104, y: 0, z: -175, heading: 0 }, connections: ['node_cms', 'node_yaba'], services: ['Passenger', 'Rail', 'Food'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_yaba', nodeType: 'RailStation', name: 'Yaba Tech & Tejuosho Transit Station', districtId: 'dist_yaba_mainland', geoReference: { lat: 6.5095, lng: 3.3711, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -112, y: 0, z: -160, heading: 0 }, connections: ['node_oyingbo', 'node_mushin', 'node_ojota'], services: ['Passenger', 'Rail', 'Jobs'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_mushin', nodeType: 'RailStation', name: 'Mushin Trade & Spare Parts Node', districtId: 'dist_yaba_mainland', geoReference: { lat: 6.5290, lng: 3.3541, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -75, y: 0, z: -70, heading: 0 }, connections: ['node_yaba', 'node_oshodi'], services: ['Passenger', 'Rail', 'Repair'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_oshodi', nodeType: 'BRTStop', name: 'Oshodi Transport Interchange Mega-Terminal', districtId: 'dist_ikeja_capital', geoReference: { lat: 6.5562, lng: 3.3490, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -110, y: 0, z: -200, heading: 0 }, connections: ['node_mushin', 'node_ikeja', 'node_maryland'], services: ['Passenger', 'BRT', 'Rail', 'Freight'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_ikeja', nodeType: 'RailStation', name: 'Ikeja Capital, Computer Village & Alausa Hub', districtId: 'dist_ikeja_capital', geoReference: { lat: 6.5965, lng: 3.3418, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -112, y: 0, z: -110, heading: 0 }, connections: ['node_oshodi', 'node_agege', 'node_maryland'], services: ['Passenger', 'Rail', 'BRT', 'Jobs'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_agege', nodeType: 'RailStation', name: 'Agege Mainland Rail & Commuter Hub', districtId: 'dist_ikeja_capital', geoReference: { lat: 6.6214, lng: 3.3258, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -96, y: 0, z: 45, heading: 0 }, connections: ['node_ikeja', 'node_iju'], services: ['Passenger', 'Rail', 'Food'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_iju', nodeType: 'RailStation', name: 'Iju North Rail Station', districtId: 'dist_ikeja_capital', geoReference: { lat: 6.6520, lng: 3.3210, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -64, y: 0, z: -120, heading: 0 }, connections: ['node_agege', 'node_agbado'], services: ['Passenger', 'Rail'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_agbado', nodeType: 'RailStation', name: 'Agbado Northern Terminus & Freight Link', districtId: 'dist_ikeja_capital', geoReference: { lat: 6.6850, lng: 3.3100, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -56, y: 0, z: -135, heading: 0 }, connections: ['node_iju'], services: ['Passenger', 'Rail', 'Freight'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_maryland', nodeType: 'BRTStop', name: 'Maryland Ikorodu Road BRT Node', districtId: 'dist_ikeja_capital', geoReference: { lat: 6.5720, lng: 3.3680, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -82, y: 0, z: -130, heading: 0 }, connections: ['node_oshodi', 'node_ojota', 'node_yaba'], services: ['Passenger', 'BRT'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_ojota', nodeType: 'BRTStop', name: 'Ojota Inter-District BRT & Park Hub', districtId: 'dist_ikeja_capital', geoReference: { lat: 6.5880, lng: 3.3795, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -80, y: 0, z: -155, heading: 0 }, connections: ['node_maryland', 'node_ketu'], services: ['Passenger', 'BRT', 'Jobs'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_ketu', nodeType: 'BRTStop', name: 'Ketu Corridor BRT & Market Node', districtId: 'dist_yaba_mainland', geoReference: { lat: 6.5980, lng: 3.3890, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -82, y: 0, z: -192, heading: 0 }, connections: ['node_ojota', 'node_mile_12'], services: ['Passenger', 'BRT', 'Food'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' },
      { worldNodeId: 'node_mile_12', nodeType: 'BRTStop', name: 'Mile 12 Fresh Produce & BRT Terminal', districtId: 'dist_yaba_mainland', geoReference: { lat: 6.6095, lng: 3.3970, source: 'LAMATA_PUBLIC_REF' }, gameTransform: { x: -80, y: 0, z: -212, heading: 0 }, connections: ['node_ketu', 'node_cms'], services: ['Passenger', 'BRT', 'Freight', 'Food'], state: 'OPEN', assetRights: 'ORIGINAL_PROJECT_EKO' }
    ];

    // Section 06 Module 13: Creator Studio Catalog
    const creatorStudioCatalog = [
      { projectId: 'crt_afrobeat_poster', title: 'TBS Owambe Festival 3D Billboard Creative', category: 'Campaign Creative', commissionGN: 850, skillGroup: 'digital_creative', ipProvenance: 'ORIGINAL_CREATOR_WORK', submissionsCount: 0 },
      { projectId: 'crt_danfo_gold_livery', title: 'Eko Gold Heritage Danfo Custom Livery', category: 'Vehicle Cosmetic', commissionGN: 1100, skillGroup: 'digital_creative', ipProvenance: 'ORIGINAL_CREATOR_WORK', submissionsCount: 0 },
      { projectId: 'crt_broad_st_story_quest', title: 'Broad Street Morning Rush Community Story', category: 'Interactive Story / Event', commissionGN: 950, skillGroup: 'social_persuasion', ipProvenance: 'ORIGINAL_CREATOR_WORK', submissionsCount: 0 },
      { projectId: 'crt_lagos_radio_jingle', title: 'Zuko! Afro-Cinema & Bukka Audio Jingle', category: 'Audio & Performance', commissionGN: 1200, skillGroup: 'digital_creative', ipProvenance: 'ORIGINAL_CREATOR_WORK', submissionsCount: 0 }
    ];

    // Section 06 Module 14: Operations Console State
    const operationsConsoleState = {
      ledgerReconciliationRuns: 1,
      lastReconciliationBalanced: true,
      sponsoredCampaignsPaused: false,
      realRewardKillSwitchLocked: true,
      auditLogs: [
        { auditId: 'ops_boot_01', action: 'VERIFY_KILL_SWITCH_LOCKED', status: 'LOCKED_SAFE', timestampIso: new Date().toISOString(), detail: 'Section 27 Real-Reward Kill Switch verified OFF.' }
      ]
    };

    // Section 46 Appendix F7: 7-Stage Long-Term Livelihood Ladder
    const livelihoodLadderStages = [
      { stage: 1, id: 'stage_1_new_arrival', title: '1. New Arrival', playerState: 'Starter room, basic outfit and EkoPhone', capability: 'On-foot jobs and low-cost purchases', feeling: 'I can start without already owning things.', unlocked: true },
      { stage: 2, id: 'stage_2_reliable_worker', title: '2. Reliable Worker', playerState: 'Better job ratings, first home item upgrades and savings', capability: 'More shifts and entry qualifications', feeling: 'My effort changes my life.', unlocked: true },
      { stage: 3, id: 'stage_3_skilled_professional', title: '3. Skilled Professional', playerState: 'Trade, digital or commercial driving skill', capability: 'Better-paying work and employer-owned equipment', feeling: 'I have a marketable skill.', unlocked: true },
      { stage: 4, id: 'stage_4_first_owner', title: '4. First Owner', playerState: 'Eligible vehicle, tools or micro-business asset', capability: 'Work independently and manage running costs', feeling: 'Ownership brings freedom and responsibility.', unlocked: true },
      { stage: 5, id: 'stage_5_operator', title: '5. Operator', playerState: 'Staff, route, stock, contracts and reputation', capability: 'Hire players/NPC workers; serve demand', feeling: 'My choices affect other livelihoods.', unlocked: true },
      { stage: 6, id: 'stage_6_entrepreneur', title: '6. Entrepreneur', playerState: 'Multiple assets, business systems and suppliers', capability: 'Manage supply chains, expansion and risk', feeling: 'I build an enterprise.', unlocked: true },
      { stage: 7, id: 'stage_7_ecosystem_contributor', title: '7. Ecosystem Contributor', playerState: 'Trusted player/creator/business participant', capability: 'Qualify for approved sponsor or creator contracts if eligible', feeling: 'Real-world earning is contractual and gated, never cash conversion of GN.', unlocked: true }
    ];

    gAny.__MASTER_BIBLE_STATE__ = {
      selectedStarterProfileId: 'profile_new_arrival',
      starterProfiles,
      currentHomeId: 'home_tier0_shared_room',
      ownedHomeIds: ['home_tier0_shared_room'],
      isInsideHomeInterior: false,
      savedExteriorPosition: { x: -68, y: 0.22, z: -152, heading: 1.57 },
      housingTiers,
      roomZonesCatalog,
      itemDefinitions,
      ownedItems: initialOwnedItems,
      shopsCatalog,
      jobTemplates,
      careerFamilies,
      activeJobInstance: null as any,
      completedJobHistory: [] as any[],
      skillsState,
      contextualReputation,
      needsState,
      nineVehicleClasses,
      eightLagosDistricts,
      activeStreamedDistrictId: 'dist_lagos_island',
      transportReferenceNodes,
      creatorStudioCatalog,
      operationsConsoleState,
      livelihoodLadderStages,
      supplyChains,
      labourMarketOffers,
      socialAndSafetyState,
      realRewardComplianceState,
      householdLeaseState: {
        weeklyLeaseGN: 750,
        utilityBundleGN: 150,
        graceDaysRemaining: 7,
        inGameWeekNumber: 1,
        status: 'ACTIVE_IN_GRACE_PERIOD',
        nonPunitiveGuarantee: 'Offline decay is disabled. Unpaid rent triggers grace period or low-cost recovery option — never deletes home or belongings.'
      },
      householdTransactions: [
        { transactionId: 'tx_genesis_starter_home', timestampIso: new Date().toISOString(), type: 'STARTER_PACKAGE', amountGN: 0, sourceOrSink: 'SOURCE', description: 'Day-1 New Arrival Starter Room & Essential Kit (Appendix F1)', linkedEntityId: 'home_tier0_shared_room' }
      ],
      processedIdempotencyKeys: {
        has: (key: string) => hasLegacyIdempotencyKey(currentLegacyAccount(), key),
        add: (key: string) => { recordLegacyIdempotencyKey(currentLegacyAccount(), key); return this; },
      }
    };
  }

  const sharedMasterBibleState = gAny.__MASTER_BIBLE_STATE__;
  const householdStateKeys = new Set([
    'selectedStarterProfileId', 'currentHomeId', 'ownedHomeIds', 'isInsideHomeInterior',
    'savedExteriorPosition', 'ownedItems', 'householdLeaseState', 'householdTransactions',
    'activeJobInstance', 'completedJobHistory', 'skillsState', 'contextualReputation', 'needsState',
    'nineVehicleClasses', 'supplyChains', 'labourMarketOffers', 'creatorStudioCatalog',
    'socialAndSafetyState', 'activeStreamedDistrictId',
  ]);
  const mbState = new Proxy(sharedMasterBibleState, {
    get(target, property, receiver) {
      if (typeof property === 'string' && householdStateKeys.has(property)) {
        const defaults: Record<string, any> = {};
        for (const key of householdStateKeys) defaults[key] = Reflect.get(target, key, receiver);
        const state = getLegacyHouseholdState(currentLegacyAccount(), defaults);
        return persistableProfileValue(state[property]);
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (typeof property === 'string' && householdStateKeys.has(property)) {
        const defaults: Record<string, any> = {};
        for (const key of householdStateKeys) defaults[key] = Reflect.get(target, key, receiver);
        getLegacyHouseholdState(currentLegacyAccount(), defaults)[property] = value;
        persistAccountStore();
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    },
  });

  // Helper: Compute Section 26 Economy Health Metrics & Section 13 Household Budget View
  const buildHouseholdAndEconomySnapshot = () => {
    const completedJobs = mbState.completedJobHistory || [];
    const totalJobEarningsGN = completedJobs.reduce((s: number, j: any) => s + (j.netRewardGN || 0), 0);
    const totalItemSpendGN = (mbState.householdTransactions || [])
      .filter((t: any) => t.sourceOrSink === 'SINK')
      .reduce((s: number, t: any) => s + (t.amountGN || 0), 0);
    const currentHome = mbState.housingTiers.find((h: any) => h.homeId === mbState.currentHomeId) || mbState.housingTiers[0];
    const nextHome = mbState.housingTiers.find((h: any) => h.tier === currentHome.tier + 1) || currentHome;

    return {
      householdBudgetView: {
        availableBalanceGN: demoPlayer.gameNairaBalance,
        provisionalFirstWeekModelStartGN: 5000,
        essentials: {
          weeklyLeaseGN: currentHome.weeklyLeaseGN,
          weeklyUtilityBundleGN: mbState.householdLeaseState.utilityBundleGN,
          recommendedDailyFoodAndHygieneGN: 260,
          graceDaysRemaining: mbState.householdLeaseState.graceDaysRemaining
        },
        transport: {
          shortPublicTransitFareBandGN: [80, 160],
          fuelPricePerLiterGN,
          vehicleConditionPercent: legacyVehicleState.condition,
          walkingOptionAlwaysPreserved: true
        },
        workInvestment: {
          entryJobDepositGN: 0,
          ownedWorkItems: mbState.ownedItems.filter((i: any) => i.category === 'Work clothing/equipment' || i.category === 'Study/work').map((i: any) => i.displayName)
        },
        homeGoal: {
          currentHomeArchetype: currentHome.archetype,
          nextTargetArchetype: nextHome.archetype,
          nextTargetWeeklyLeaseGN: nextHome.weeklyLeaseGN,
          ownedFurnitureCount: mbState.ownedItems.filter((i: any) => i.state === 'PLACED_IN_HOME').length,
          maxFurnitureSlots: currentHome.maxFurnitureSlots
        },
        recurringObligations: mbState.householdLeaseState,
        transactionHistory: mbState.householdTransactions.slice(0, 20),
        businessView: {
          ownedBusinesses: businessesRegistry.filter(b => b.owned),
          retailInventories: legacySupplyState.retailInventories,
          supplyChains: mbState.supplyChains
        }
      },
      economyHealthMetrics: {
        gnCreationVsSinksRatio: totalItemSpendGN > 0 ? Number(((INITIAL_BALANCE_GN + totalJobEarningsGN) / totalItemSpendGN).toFixed(2)) : 1.35,
        medianEntryJobNetGN: 520,
        medianEarningsPerActiveHourGN: 3120,
        coreNeedsCostToEntryIncomeRatio: 0.34,
        timeToFirstMeaningfulPurchaseMinutes: 6,
        timeToFirstVehicleOrBusinessMinutes: 45,
        stockoutIncidencePercent: 0,
        fraudOrExploitRejections: 0,
        ledgerBalanced: globalEconomyLedger.auditIntegrity().isBalanced
      }
    };
  };

  // GET /api/v1/ekolife/state — Full Master Bible State (Home, Interior, Items, Needs, Jobs, Skills, Budget, Social, Compliance)
  if (url.pathname === '/api/v1/ekolife/state' && req.method === 'GET') {
    const accountDistricts = mbState.eightLagosDistricts.map((d: any) => ({
      ...d,
      streamState: d.districtId === mbState.activeStreamedDistrictId ? 'STREAMED_ACTIVE' : 'STREAMABLE_3D',
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      playerBalanceGN: demoPlayer.gameNairaBalance,
      selectedStarterProfileId: mbState.selectedStarterProfileId,
      starterProfiles: mbState.starterProfiles,
      currentHomeId: mbState.currentHomeId,
      ownedHomeIds: mbState.ownedHomeIds,
      isInsideHomeInterior: mbState.isInsideHomeInterior,
      savedExteriorPosition: mbState.savedExteriorPosition,
      housingTiers: mbState.housingTiers,
      roomZonesCatalog: mbState.roomZonesCatalog,
      itemDefinitions: mbState.itemDefinitions,
      ownedItems: mbState.ownedItems,
      activeStreamedDistrictId: mbState.activeStreamedDistrictId,
      eightLagosDistricts: accountDistricts,
      shopsCatalog: mbState.shopsCatalog,
      needsState: mbState.needsState,
      jobTemplates: mbState.jobTemplates,
      careerFamilies: mbState.careerFamilies,
      activeJobInstance: mbState.activeJobInstance,
      completedJobHistory: mbState.completedJobHistory,
      skillsState: mbState.skillsState,
      contextualReputation: mbState.contextualReputation,
      nineVehicleClasses: mbState.nineVehicleClasses,
      supplyChains: mbState.supplyChains,
      labourMarketOffers: mbState.labourMarketOffers,
      creatorStudioCatalog: mbState.creatorStudioCatalog,
      socialAndSafetyState: mbState.socialAndSafetyState,
      realRewardComplianceState: mbState.realRewardComplianceState,
      ...buildHouseholdAndEconomySnapshot(),
      ledgerAudit: globalEconomyLedger.auditIntegrity()
    }));
    return;
  }

  // POST /api/v1/ekolife/interior-transition — Enter or Exit 3D Home Interior (Preserves Exterior State & Persists Interior)
  if (url.pathname === '/api/v1/ekolife/interior-transition' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (data.starterProfileId) {
        const prof = mbState.starterProfiles.find((p: any) => p.profileId === data.starterProfileId);
        if (prof) {
          mbState.selectedStarterProfileId = prof.profileId;
          mbState.currentHomeId = prof.initialHomeId;
          if (!mbState.ownedHomeIds.includes(prof.initialHomeId)) {
            mbState.ownedHomeIds.push(prof.initialHomeId);
          }
        }
      }
      if (data.homeId) {
        const tierObj = mbState.housingTiers.find((h: any) => h.homeId === data.homeId);
        if (tierObj) {
          mbState.currentHomeId = tierObj.homeId;
          mbState.householdLeaseState.weeklyLeaseGN = tierObj.weeklyLeaseGN;
          if (!mbState.ownedHomeIds.includes(tierObj.homeId)) {
            mbState.ownedHomeIds.push(tierObj.homeId);
          }
        }
      }
      if (typeof data.enter === 'boolean') {
        if (data.enter && data.exteriorPosition) {
          mbState.savedExteriorPosition = data.exteriorPosition;
        }
        mbState.isInsideHomeInterior = data.enter;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        isInsideHomeInterior: mbState.isInsideHomeInterior,
        currentHomeId: mbState.currentHomeId,
        selectedStarterProfileId: mbState.selectedStarterProfileId,
        savedExteriorPosition: mbState.savedExteriorPosition,
        ownedItems: mbState.ownedItems
      }));
    });
    return;
  }

  // POST /api/v1/ekolife/use-object — Interact with 3D Home Object or Inventory Consumable to Restore Needs
  if (url.pathname === '/api/v1/ekolife/use-object' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const ownedItem = mbState.ownedItems.find((i: any) => i.ownedItemId === data.ownedItemId || i.itemId === data.itemId);
      const interaction = data.interaction || (ownedItem && ownedItem.interactions && ownedItem.interactions[0]) || 'INTERACT';
      const effects = (ownedItem && ownedItem.effects) || data.effects || { energy: 15, comfort: 10 };

      const n = mbState.needsState;
      if (typeof effects.hunger === 'number') n.hunger = Math.min(100, Math.max(0, n.hunger + effects.hunger));
      if (typeof effects.energy === 'number') n.energy = Math.min(100, Math.max(0, n.energy + effects.energy));
      if (typeof effects.hygiene === 'number') n.hygiene = Math.min(100, Math.max(0, n.hygiene + effects.hygiene));
      if (typeof effects.social === 'number') n.social = Math.min(100, Math.max(0, n.social + effects.social));
      if (typeof effects.recreation === 'number') n.recreation = Math.min(100, Math.max(0, n.recreation + effects.recreation));
      if (typeof effects.comfort === 'number') n.comfort = Math.min(100, Math.max(0, n.comfort + effects.comfort));
      if (typeof effects.health === 'number') n.health = Math.min(100, Math.max(0, n.health + effects.health));
      if (typeof effects.connectivity === 'number') n.connectivity = Math.min(100, Math.max(0, n.connectivity + effects.connectivity));
      n.lastUpdatedAtIso = new Date().toISOString();

      if (data.accessibilityOptions) {
        n.accessibilityOptions = { ...n.accessibilityOptions, ...data.accessibilityOptions };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        interaction,
        ownedItemUsed: ownedItem ? ownedItem.displayName : (data.objectLabel || 'Home Object'),
        needsState: n
      }));
    });
    return;
  }

  // POST /api/v1/ekolife/shop-purchase — Buy Item from Any of the 8 Shop Categories (Idempotent Double-Entry GN Ledger)
  if (url.pathname === '/api/v1/ekolife/shop-purchase' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const itemId = data.itemId;
      const idemKey = `${demoPlayer.playerId}:${data.idempotencyKey || `idem_shop_${itemId}_${Date.now()}`}`;
      if (mbState.processedIdempotencyKeys.has(idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DUPLICATE_PURCHASE_REJECTED', idempotencyKey: idemKey }));
        return;
      }

      const itemDef = mbState.itemDefinitions.find((it: any) => it.itemId === itemId);
      if (!itemDef) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ITEM_NOT_FOUND', itemId }));
        return;
      }

      const deliveryFeeGN = data.arrangeDelivery ? 80 : 0;
      const totalCostGN = itemDef.purchaseCostGN + deliveryFeeGN;
      if (demoPlayer.gameNairaBalance < totalCostGN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INSUFFICIENT_FUNDS', requiredGN: totalCostGN, availableGN: demoPlayer.gameNairaBalance }));
        return;
      }

      const txId = `tx_shop_${itemDef.itemId}_${Date.now()}`;
      try {
        globalEconomyLedger.postTransaction(
          txId,
          `ev_buy_${itemDef.itemId}`,
          idemKey,
          demoPlayer.playerId,
          `Purchased ${itemDef.displayName}${deliveryFeeGN > 0 ? ' (+Delivery)' : ''}`,
          [
            { accountCode: 'Expense:Player:HouseholdGoods', debit: totalCostGN, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: totalCostGN }
          ]
        );
      } catch (err) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LEDGER_REJECTED', details: String(err) }));
        return;
      }

      mbState.processedIdempotencyKeys.add(idemKey);
      demoPlayer.gameNairaBalance -= totalCostGN;

      const ownedItem = {
        ownedItemId: `own_${itemDef.itemId}_${Date.now()}`,
        ownerId: demoPlayer.playerId,
        itemId: itemDef.itemId,
        displayName: itemDef.displayName,
        category: itemDef.category,
        condition: 100,
        state: data.autoPlaceInRoom ? 'PLACED_IN_HOME' : 'IN_INVENTORY',
        roomId: data.autoPlaceInRoom || null,
        transform: data.autoPlaceTransform || null,
        footprint: itemDef.footprint,
        interactions: itemDef.interactions,
        effects: itemDef.effects,
        acquisitionSource: itemDef.shopId,
        ledgerTxId: txId
      };
      mbState.ownedItems.push(ownedItem);

      // Apply immediate comfort/need boost if consumable
      if (!itemDef.placeable && itemDef.effects) {
        const n = mbState.needsState;
        if (itemDef.effects.hunger) n.hunger = Math.min(100, n.hunger + itemDef.effects.hunger);
        if (itemDef.effects.energy) n.energy = Math.min(100, n.energy + itemDef.effects.energy);
        if (itemDef.effects.hygiene) n.hygiene = Math.min(100, n.hygiene + itemDef.effects.hygiene);
        if (itemDef.effects.comfort) n.comfort = Math.min(100, n.comfort + itemDef.effects.comfort);
      }

      mbState.householdTransactions.unshift({
        transactionId: txId,
        timestampIso: new Date().toISOString(),
        type: 'ITEM_PURCHASE',
        amountGN: totalCostGN,
        sourceOrSink: 'SINK',
        description: `Bought ${itemDef.displayName} (${itemDef.category})`,
        linkedEntityId: itemDef.shopId
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        ownedItem,
        totalCostGN,
        newBalanceGN: demoPlayer.gameNairaBalance,
        transactionId: txId,
        needsState: mbState.needsState,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/ekolife/place-item — Validate Room Bounds, Doorway Clearance & AABB Footprint Collision for 3D Furniture Placement
  if (url.pathname === '/api/v1/ekolife/place-item' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const target = mbState.ownedItems.find((i: any) => i.ownedItemId === data.ownedItemId || i.itemId === data.itemId);
      if (!target) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OWNED_ITEM_NOT_FOUND' }));
        return;
      }

      if (data.action === 'STORE') {
        target.state = 'IN_INVENTORY';
        target.roomId = null;
        target.transform = null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'STORE', ownedItem: target }));
        return;
      }

      const px = Number(data.x ?? 0);
      const pz = Number(data.z ?? 0);
      const rotY = Number(data.rotY ?? 0);
      const roomId = data.roomId || 'zone_living_area';
      const fp = target.footprint || { w: 0.8, d: 0.8, h: 0.8 };
      const rotated = Math.abs(Math.round(rotY / (Math.PI / 2))) % 2 === 1;
      const halfW = (rotated ? fp.d : fp.w) * 0.5;
      const halfD = (rotated ? fp.w : fp.d) * 0.5;

      // 1. Validate Room Wall Boundaries (-3.85..+3.85 on X and Z)
      if (px - halfW < -3.85 || px + halfW > 3.85 || pz - halfD < -3.85 || pz + halfD > 3.85) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'WALL_BOUNDARY_VIOLATION',
          message: 'Cannot place furniture through room walls or outside floor boundaries (-3.85m..+3.85m).'
        }));
        return;
      }

      // 2. Validate Front Doorway Clearance Zone (x: -0.9..+0.9, z: 2.6..4.0)
      if (px + halfW > -0.9 && px - halfW < 0.9 && pz + halfD > 2.6 && pz - halfD < 4.0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'DOORWAY_CLEARANCE_VIOLATION',
          message: 'Cannot block the front doorway entry/exit clearance zone.'
        }));
        return;
      }

      // 3. Validate AABB Overlap Against Existing Placed Items
      const otherPlaced = mbState.ownedItems.filter(
        (other: any) => other.ownedItemId !== target.ownedItemId && other.state === 'PLACED_IN_HOME' && other.transform
      );
      for (const other of otherPlaced) {
        const ofp = other.footprint || { w: 0.8, d: 0.8, h: 0.8 };
        const oRot = Math.abs(Math.round((other.transform.rotY || 0) / (Math.PI / 2))) % 2 === 1;
        const oHalfW = (oRot ? ofp.d : ofp.w) * 0.5;
        const oHalfD = (oRot ? ofp.w : ofp.d) * 0.5;
        const ox = other.transform.x;
        const oz = other.transform.z;
        const overlapX = Math.abs(px - ox) < (halfW + oHalfW - 0.04);
        const overlapZ = Math.abs(pz - oz) < (halfD + oHalfD - 0.04);
        if (overlapX && overlapZ) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'FURNITURE_COLLISION_OVERLAP',
            collidingWith: other.displayName,
            message: `Placement overlaps existing item "${other.displayName}". Choose an open floor spot.`
          }));
          return;
        }
      }

      target.state = 'PLACED_IN_HOME';
      target.roomId = roomId;
      target.transform = { x: Number(px.toFixed(2)), y: Number((fp.h * 0.5).toFixed(2)), z: Number(pz.toFixed(2)), rotY: Number(rotY.toFixed(2)) };
      mbState.needsState.comfort = Math.min(100, mbState.needsState.comfort + 8);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: 'PLACE',
        ownedItem: target,
        needsState: mbState.needsState
      }));
    });
    return;
  }

  // POST /api/v1/jobshub/accept — Accept Entry or Career Job from the 11 Canonical Job Cards
  if (url.pathname === '/api/v1/jobshub/accept' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const jobTpl = mbState.jobTemplates.find((j: any) => j.jobId === data.jobId);
      if (!jobTpl) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JOB_TEMPLATE_NOT_FOUND', jobId: data.jobId }));
        return;
      }

      const instance = {
        jobInstanceId: `jinst_${jobTpl.jobId}_${Date.now()}`,
        playerId: demoPlayer.playerId,
        jobId: jobTpl.jobId,
        version: jobTpl.version,
        title: jobTpl.title,
        workMode: jobTpl.workMode,
        careerFamily: jobTpl.careerFamily,
        locationEntityId: jobTpl.locationEntityId,
        destinationEntityId: jobTpl.destinationEntityId,
        baseGrossGN: jobTpl.baseGrossGN,
        disclosedCostsGN: jobTpl.disclosedCostsGN,
        objectiveSteps: jobTpl.objectiveSteps,
        completedSteps: [] as string[],
        state: 'ACCEPTED_IN_PROGRESS',
        acceptedAtIso: new Date().toISOString()
      };
      mbState.activeJobInstance = instance;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        jobInstance: instance,
        jobTemplate: jobTpl
      }));
    });
    return;
  }

  // POST /api/v1/jobshub/complete — Validate Work Evidence & Settle Auditable Double-Entry GN Journal Receipt
  if (url.pathname === '/api/v1/jobshub/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const jobId = data.jobId || (mbState.activeJobInstance && mbState.activeJobInstance.jobId) || 'job_foot_courier';
      const jobTpl = mbState.jobTemplates.find((j: any) => j.jobId === jobId);
      if (!jobTpl) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JOB_NOT_FOUND', jobId }));
        return;
      }

      const activeJob = mbState.activeJobInstance;
      if (!activeJob || activeJob.state !== 'ACCEPTED_IN_PROGRESS' ||
          activeJob.jobInstanceId !== data.jobInstanceId || activeJob.jobId !== jobTpl.jobId ||
          activeJob.playerId !== demoPlayer.playerId) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ACTIVE_JOB_INSTANCE_REQUIRED' }));
        return;
      }

      // Server-side evidence validation: reject empty/unverified client claims
      const evidence = data.evidence || {};
      const completedSteps = Array.isArray(evidence.completedSteps) ? evidence.completedSteps : [];
      const canonicalSteps = Array.isArray(activeJob.objectiveSteps) ? activeJob.objectiveSteps : [];
      const completedStepSet = new Set(completedSteps);
      if (completedSteps.length !== canonicalSteps.length || completedStepSet.size !== canonicalSteps.length ||
          !canonicalSteps.every((step: string) => completedStepSet.has(step))) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'WORK_EVIDENCE_INCOMPLETE',
          message: 'Server rejected job settlement: every canonical objective step must be completed.'
        }));
        return;
      }

      const idemKey = `${demoPlayer.playerId}:${data.idempotencyKey || `idem_job_${jobId}_${data.jobInstanceId || Date.now()}`}`;
      if (mbState.processedIdempotencyKeys.has(idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DUPLICATE_JOB_SETTLEMENT_REJECTED', idempotencyKey: idemKey }));
        return;
      }

      const requestedQuality = Number(evidence.qualityScore ?? 1.0);
      if (!Number.isFinite(requestedQuality)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_QUALITY_SCORE' }));
        return;
      }
      const qualityScore = Math.max(0.5, Math.min(1.25, requestedQuality));
      const qualityBonusGN = Math.round(jobTpl.baseGrossGN * Math.max(0, qualityScore - 1.0));
      const grossGN = jobTpl.baseGrossGN + qualityBonusGN;
      const disclosedCostsGN = jobTpl.disclosedCostsGN;
      const netRewardGN = Math.max(100, grossGN - disclosedCostsGN);

      const txId = `tx_job_${jobTpl.jobId}_${activeJob.jobInstanceId}`;
      try {
        globalEconomyLedger.postTransaction(
          txId,
          `ev_job_complete_${jobTpl.jobId}`,
          idemKey,
          demoPlayer.playerId,
          `Job Settlement: ${jobTpl.title} (Gross ₦${grossGN} - Costs ₦${disclosedCostsGN})`,
          [
            { accountCode: playerCashAccountCode(), debit: netRewardGN, credit: 0 },
            { accountCode: 'Expense:Job:DisclosedOperatingCosts', debit: disclosedCostsGN, credit: 0 },
            { accountCode: 'Revenue:Player:LivelihoodWages', debit: 0, credit: grossGN }
          ]
        );
      } catch (err) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LEDGER_REJECTED', details: String(err) }));
        return;
      }

      mbState.processedIdempotencyKeys.add(idemKey);
      demoPlayer.gameNairaBalance += netRewardGN;

      // Update Skill & Contextual Reputation
      const sk = mbState.skillsState[jobTpl.skillTrained];
      if (sk) {
        sk.xp += 45;
        if (sk.xp >= sk.nextLevelXp) {
          sk.level += 1;
          sk.nextLevelXp = Math.round(sk.nextLevelXp * 1.5);
        }
      }
      const rep = mbState.contextualReputation[jobTpl.reputationDomain];
      if (rep) {
        rep.score = Math.min(100, rep.score + 2);
      }

      // Active-session mild exertion on needs (and +25 hunger restored if bukka helper meal benefit)
      mbState.needsState.energy = Math.max(15, mbState.needsState.energy - 6);
      if (jobTpl.jobId === 'job_bukka_helper') {
        mbState.needsState.hunger = Math.min(100, mbState.needsState.hunger + 25);
      } else {
        mbState.needsState.hunger = Math.max(15, mbState.needsState.hunger - 4);
      }

      const receipt = {
        receiptId: `rcpt_${txId}`,
        transactionId: txId,
        idempotencyKey: idemKey,
        jobId: jobTpl.jobId,
        title: jobTpl.title,
        careerFamily: jobTpl.careerFamily,
        grossGN,
        qualityBonusGN,
        disclosedCostsGN,
        netRewardGN,
        skillUpdated: sk,
        reputationUpdated: rep,
        completedAtIso: new Date().toISOString()
      };
      mbState.completedJobHistory.unshift(receipt);
      mbState.activeJobInstance = null;
      mbState.householdTransactions.unshift({
        transactionId: txId,
        timestampIso: receipt.completedAtIso,
        type: 'JOB_WAGE_SETTLEMENT',
        amountGN: netRewardGN,
        sourceOrSink: 'SOURCE',
        description: `${jobTpl.title} (Gross ₦${grossGN} - Costs ₦${disclosedCostsGN})`,
        linkedEntityId: jobTpl.locationEntityId
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        receipt,
        newBalanceGN: demoPlayer.gameNairaBalance,
        needsState: mbState.needsState,
        skillsState: mbState.skillsState,
        contextualReputation: mbState.contextualReputation,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // GET /api/v1/household/budget — Complete Household Budget View, Rent Grace & Economy Health Metrics
  if (url.pathname === '/api/v1/household/budget' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      ...buildHouseholdAndEconomySnapshot(),
      ledgerAudit: globalEconomyLedger.auditIntegrity()
    }));
    return;
  }

  // POST /api/v1/household/pay-obligations — Phase 6 (M6) Settle Recurring Weekly Rent & Utilities Cycle (Double-Entry Ledger)
  if (url.pathname === '/api/v1/household/pay-obligations' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const lease = mbState.householdLeaseState;
      const rentGN = Number(lease.weeklyLeaseGN || 750);
      const utilitiesGN = Number(lease.utilityBundleGN || 150);
      const totalObligationGN = Math.max(100, rentGN + utilitiesGN);
      const cycleNumber = Number(lease.inGameWeekNumber || 1);
      const idemKey = `${demoPlayer.playerId}:${String(data.idempotencyKey || `idem_rent_util_cycle_${cycleNumber}`)}`;
      const txId = `tx_rent_util_${demoPlayer.playerId}_${cycleNumber}`;

      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OBLIGATION_CYCLE_ALREADY_SETTLED', cycleNumber }));
        return;
      }

      if (demoPlayer.gameNairaBalance < totalObligationGN) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'INSUFFICIENT_FUNDS_FOR_OBLIGATIONS',
          requiredGN: totalObligationGN,
          availableGN: demoPlayer.gameNairaBalance
        }));
        return;
      }

      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_household_obligation_${txId}`,
          idemKey,
          demoPlayer.playerId,
          `Household Rent (₦${rentGN}) & Utilities (₦${utilitiesGN}) Cycle #${lease.inGameWeekNumber}`,
          [
            { accountCode: 'Expense:Player:HouseholdGoods', debit: totalObligationGN, credit: 0 },
            { accountCode: playerCashAccountCode(), debit: 0, credit: totalObligationGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Household obligation replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OBLIGATION_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }

      demoPlayer.gameNairaBalance -= totalObligationGN;
      lease.inGameWeekNumber = cycleNumber + 1;
      lease.graceDaysRemaining = 7;
      lease.status = 'PAID_CURRENT_CYCLE';
      if (mbState.contextualReputation && mbState.contextualReputation.propertyStewardship) {
        mbState.contextualReputation.propertyStewardship.score = Math.min(100, mbState.contextualReputation.propertyStewardship.score + 3);
      }
      mbState.needsState.comfort = Math.min(100, (mbState.needsState.comfort || 80) + 12);
      mbState.needsState.connectivity = Math.min(100, (mbState.needsState.connectivity || 85) + 15);

      const receipt = {
        receiptId: `rcpt_${txId}`,
        transactionId: txId,
        idempotencyKey: idemKey,
        cyclePaid: lease.inGameWeekNumber - 1,
        rentGN,
        utilitiesGN,
        totalObligationGN,
        paidAtIso: new Date().toISOString()
      };

      mbState.householdTransactions.unshift({
        transactionId: txId,
        timestampIso: receipt.paidAtIso,
        type: 'RENT_AND_UTILITIES_SETTLEMENT',
        amountGN: totalObligationGN,
        sourceOrSink: 'SINK',
        description: `Settled Cycle #${receipt.cyclePaid} Rent (₦${rentGN}) + Utilities (₦${utilitiesGN})`,
        linkedEntityId: mbState.currentHomeId
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        receipt,
        newBalanceGN: demoPlayer.gameNairaBalance,
        householdLeaseState: lease,
        ...buildHouseholdAndEconomySnapshot(),
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/supply-chain/execute — Causal Business Supply Chain Loop (Buy Wholesale -> Deliver -> Customer Sale Net of Costs)
  if (url.pathname === '/api/v1/supply-chain/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const supplyChainAliases: Record<string, string> = {
        chain_food_bukka: 'chain_food',
        chain_auto_parts: 'chain_vehicle',
        chain_retail_fashion: 'chain_fashion',
        chain_furniture_home: 'chain_furnishing',
        chain_media_production: 'chain_digital',
        chain_event_hospitality: 'chain_events',
      };
      const requestedChainId = typeof data.chainId === 'string' ? data.chainId.trim() : '';
      const resolvedChainId = supplyChainAliases[requestedChainId] || requestedChainId;
      const chain = mbState.supplyChains.find((c: any) => c.chainId === resolvedChainId);
      if (!chain) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SUPPLY_CHAIN_NOT_FOUND', chainId: requestedChainId }));
        return;
      }
      const totalCostGN = Math.round(Number(chain.wholesaleInputCostGN) + Number(chain.deliveryFeeGN));
      const grossSalesGN = Math.round(Number(chain.retailRevenueGN));
      const netProfitGN = grossSalesGN - totalCostGN;
      if (!Number.isFinite(totalCostGN) || totalCostGN <= 0 || !Number.isFinite(grossSalesGN) || grossSalesGN <= totalCostGN) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_SUPPLY_CHAIN_CONFIGURATION', chainId: chain.chainId }));
        return;
      }
      if (typeof data.idempotencyKey !== 'string' || !data.idempotencyKey.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'IDEMPOTENCY_KEY_REQUIRED' }));
        return;
      }
      const idemKey = `${demoPlayer.playerId}:${data.idempotencyKey.trim()}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SUPPLY_CHAIN_REPLAY_REJECTED', idempotencyKey: idemKey }));
        return;
      }
      if (demoPlayer.gameNairaBalance < totalCostGN) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_WORKING_CAPITAL',
          requiredGN: totalCostGN,
          balanceGN: demoPlayer.gameNairaBalance
        }));
        return;
      }
      const txId = `tx_chain_${demoPlayer.playerId}_${chain.chainId}_${Date.now()}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_supply_chain_${chain.chainId}`,
          idemKey,
          demoPlayer.playerId,
          `Causal Supply Chain (${chain.name}): Sales ₦${grossSalesGN} - Stock/Delivery ₦${totalCostGN}`,
          [
            { accountCode: playerCashAccountCode(), debit: netProfitGN, credit: 0 },
            { accountCode: 'Expense:Business:WholesaleAndDelivery', debit: totalCostGN, credit: 0 },
            { accountCode: 'Revenue:Player:BusinessSales', debit: 0, credit: grossSalesGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Supply-chain replay rejected.');
      } catch (err) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LEDGER_REJECTED', details: String(err) }));
        return;
      }

      demoPlayer.gameNairaBalance += netProfitGN;
      chain.runsCompleted = (chain.runsCompleted || 0) + 1;
      if (legacySupplyState.retailInventories[0]) {
        legacySupplyState.retailInventories[0].stockLevel = Math.min(legacySupplyState.retailInventories[0].maxStockLevel, legacySupplyState.retailInventories[0].stockLevel + chain.stockUnitsAdded);
      }
      mbState.householdTransactions.unshift({
        transactionId: txId,
        timestampIso: new Date().toISOString(),
        type: 'SUPPLY_CHAIN_CYCLE',
        amountGN: netProfitGN,
        sourceOrSink: 'SOURCE',
        description: `${chain.name} Net Cycle (+₦${netProfitGN} GN after ₦${totalCostGN} stock/delivery)`,
        linkedEntityId: chain.chainId
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        chain,
        grossSalesGN,
        totalCostGN,
        netProfitGN,
        newBalanceGN: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/labour/market — 8-Step Player-to-Player Labour Market Workflow
  if (url.pathname === '/api/v1/labour/market' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const action = data.action;
      if (action === 'CREATE_OFFER') {
        const newOffer = {
          offerId: `lob_custom_${Date.now()}`,
          employerId: demoPlayer.playerId,
          employerName: data.employerName || "Amaka's Suya & Logistics Enterprise",
          role: data.role || 'Evening Delivery & Stall Assistant',
          task: data.task || 'Deliver 10 orders along Broad Street',
          payGN: Math.max(200, Number(data.payGN || 550)),
          durationLabel: '8 min shift',
          status: 'OPEN',
          workerId: null,
          rating: null
        };
        mbState.labourMarketOffers.unshift(newOffer);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'CREATE_OFFER', offer: newOffer, offers: mbState.labourMarketOffers }));
        return;
      }

      const offer = mbState.labourMarketOffers.find((o: any) => o.offerId === data.offerId);
      if (!offer) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LABOUR_OFFER_NOT_FOUND', offerId: data.offerId }));
        return;
      }

      if (action === 'ACCEPT_CONTRACT') {
        if (offer.status !== 'OPEN' || offer.employerId === demoPlayer.playerId) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'LABOUR_OFFER_UNAVAILABLE' }));
          return;
        }
        offer.status = 'ACCEPTED_IN_PROGRESS';
        offer.workerId = demoPlayer.playerId;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action, offer }));
        return;
      }

      if (action !== 'COMPLETE_CONTRACT' || offer.status !== 'ACCEPTED_IN_PROGRESS' ||
          offer.workerId !== demoPlayer.playerId) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LABOUR_CONTRACT_NOT_ACCEPTED' }));
        return;
      }

      const payGN = Number(offer.payGN);
      if (!Number.isFinite(payGN) || payGN <= 0) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_LABOUR_OFFER_PAY' }));
        return;
      }
      const idemKey = `${demoPlayer.playerId}:idem_labour_offer_${offer.offerId}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LABOUR_SETTLEMENT_REPLAY_REJECTED' }));
        return;
      }
      const txId = `tx_labour_${demoPlayer.playerId}_${offer.offerId}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_labour_${txId}`,
          idemKey,
          demoPlayer.playerId,
          `Labour Contract Settlement: ${offer ? offer.role : 'Shift'}`,
          [
            { accountCode: playerCashAccountCode(), debit: payGN, credit: 0 },
            { accountCode: 'Revenue:Player:LivelihoodWages', debit: 0, credit: payGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Labour settlement replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'LABOUR_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }
      demoPlayer.gameNairaBalance += payGN;
      offer.status = 'SETTLED_AND_RATED';
      offer.rating = 5;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: 'SETTLE_AND_RATE',
        offer,
        payGN,
        newBalanceGN: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/social/action — Crews, Home Visit Permissions, Safety Reports & Moderation
  if (url.pathname === '/api/v1/social/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const soc = mbState.socialAndSafetyState;
      if (data.action === 'JOIN_CREW' && data.crewId) {
        const crew = soc.crews.find((c: any) => c.crewId === data.crewId);
        if (crew) crew.joined = !crew.joined;
      } else if (data.action === 'SET_HOME_VISIT_POLICY' && data.permission) {
        soc.homeVisitPolicy.permission = data.permission;
      } else if (data.action === 'REPORT_SAFETY') {
        soc.safetyReports.unshift({
          reportId: `rep_${Date.now()}`,
          targetId: data.targetId || 'peer_unknown',
          reason: data.reason || 'CONDUCT_REVIEW',
          status: 'QUEUED_FOR_MODERATION',
          timestampIso: new Date().toISOString()
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, socialAndSafetyState: soc }));
    });
    return;
  }

  // POST /api/v1/fleet/dispatch-or-charter — Phase 7 (M7) Complete 9-Class Fleet & Lagoon Ferry Operations
  if (url.pathname === '/api/v1/fleet/dispatch-or-charter' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const veh = mbState.nineVehicleClasses.find((v: any) => v.classId === data.classId);
      if (!veh) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'FLEET_CLASS_NOT_FOUND' }));
        return;
      }
      const charterFeeGN = Math.round(Number(veh.charterFeeGN));
      const grossRunGN = Math.round(Number(veh.grossRunGN));
      const netProfitGN = grossRunGN - charterFeeGN;
      if (!Number.isFinite(charterFeeGN) || charterFeeGN <= 0 || !Number.isFinite(grossRunGN) || grossRunGN <= charterFeeGN) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_FLEET_SETTLEMENT_CONFIGURATION' }));
        return;
      }
      if (typeof data.idempotencyKey !== 'string' || !data.idempotencyKey.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'IDEMPOTENCY_KEY_REQUIRED' }));
        return;
      }
      const idemKey = `${demoPlayer.playerId}:fleet_charter:${data.idempotencyKey.trim()}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'FLEET_RUN_REPLAY_REJECTED' }));
        return;
      }
      if (demoPlayer.gameNairaBalance < charterFeeGN) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INSUFFICIENT_CHARTER_DEPOSIT', requiredGN: charterFeeGN, balanceGN: demoPlayer.gameNairaBalance }));
        return;
      }
      const txId = `tx_fleet_${veh.classId}_${Date.now()}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_fleet_${txId}`,
          idemKey,
          demoPlayer.playerId,
          `Fleet / Waterways Run Settlement: ${veh.name}`,
          [
            { accountCode: playerCashAccountCode(), debit: netProfitGN, credit: 0 },
            { accountCode: 'Expense:Fleet:CharterAndFuel', debit: charterFeeGN, credit: 0 },
            { accountCode: 'Revenue:Fleet:RunRevenue', debit: 0, credit: grossRunGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Fleet run replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'FLEET_RUN_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }
      demoPlayer.gameNairaBalance += netProfitGN;
      veh.runsCompleted = (veh.runsCompleted || 0) + 1;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        vehicle: veh,
        grossRunGN,
        charterFeeGN,
        netProfitGN,
        newBalanceGN: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/districts/stream — Phase 10 (M10) Multi-District 3D World Streaming (8 Lagos Districts)
  if (url.pathname === '/api/v1/districts/stream' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const targetId = data.districtId || 'dist_lagos_island';
      const dist = mbState.eightLagosDistricts.find((d: any) => d.districtId === targetId);
      if (!dist) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'DISTRICT_NOT_FOUND' }));
        return;
      }
      mbState.activeStreamedDistrictId = dist.districtId;
      const accountDistricts = mbState.eightLagosDistricts.map((d: any) => ({
        ...d,
        streamState: d.districtId === mbState.activeStreamedDistrictId ? 'STREAMED_ACTIVE' : 'STREAMABLE_3D',
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        activeStreamedDistrictId: mbState.activeStreamedDistrictId,
        district: { ...dist, streamState: 'STREAMED_ACTIVE' },
        eightLagosDistricts: accountDistricts
      }));
    });
    return;
  }

  // POST /api/v1/ekolife/item-lifecycle — Section 11 Rotate, Store, or Sell Owned/Placed Furniture Items
  if (url.pathname === '/api/v1/ekolife/item-lifecycle' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const action = data.action || 'ROTATE';
      const owned = mbState.ownedItems.find((o: any) => o.ownedItemId === data.instanceId || o.itemId === data.itemId);
      if (action === 'SELL' && !owned) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OWNED_ITEM_NOT_FOUND' }));
        return;
      }
      if (action === 'SELL' && owned) {
        if (owned.ownerId !== demoPlayer.playerId || owned.ownershipState === 'SOLD' || owned.state === 'SOLD') {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ITEM_NOT_SELLABLE', ownedItemId: owned.ownedItemId }));
          return;
        }
        const def = mbState.itemDefinitions.find((d: any) => d.itemId === owned.itemId) || { resaleValueGN: 250, displayName: 'Household Item' };
        const resaleGN = Number(def.resaleValueGN || 250);
        if (!Number.isFinite(resaleGN) || resaleGN <= 0) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_ITEM_RESALE_VALUE' }));
          return;
        }
        const idemKey = `${demoPlayer.playerId}:idem_resale_${owned.ownedItemId}`;
        if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ITEM_RESALE_REPLAY_REJECTED', ownedItemId: owned.ownedItemId }));
          return;
        }
        const txId = `tx_resale_${demoPlayer.playerId}_${owned.ownedItemId}`;
        try {
          const posted = globalEconomyLedger.postTransaction(
            txId,
            `ev_resale_${txId}`,
            idemKey,
            demoPlayer.playerId,
            `Household Item Resale: ${def.displayName}`,
            [
              { accountCode: playerCashAccountCode(), debit: resaleGN, credit: 0 },
              { accountCode: 'Revenue:Player:LivelihoodWages', debit: 0, credit: resaleGN }
            ]
          );
          if (posted.transactionId !== txId) throw new Error('Item resale replay rejected.');
        } catch (error: any) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ITEM_RESALE_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
          return;
        }
        owned.ownershipState = 'SOLD';
        owned.state = 'SOLD';
        owned.placement = null;
        demoPlayer.gameNairaBalance += resaleGN;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action, resaleGN, newBalanceGN: demoPlayer.gameNairaBalance, ledgerAudit: globalEconomyLedger.auditIntegrity() }));
        return;
      }
      if (owned && owned.placement && action === 'ROTATE') {
        owned.placement.rotY = Number(((owned.placement.rotY || 0) + (data.deltaRad || Math.PI / 2)).toFixed(4));
      } else if (owned && action === 'STORE') {
        owned.ownershipState = 'STORED_INVENTORY';
        owned.placement = null;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, action, ownedItem: owned || null }));
    });
    return;
  }

  // POST /api/v1/transit/conductor-coop — Section 19 Danfo Driver + Conductor Co-Op Shift Settlement
  if (url.pathname === '/api/v1/transit/conductor-coop' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const routeId = String(data.routeId || 'route_cms_tbs_loop');
      if (routeId !== 'route_cms_tbs_loop') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'COOP_ROUTE_NOT_FOUND', routeId }));
        return;
      }
      const grossRouteFaresGN = 1800;
      const disclosedFuelAndUnionCostGN = 200;
      const netPoolGN = grossRouteFaresGN - disclosedFuelAndUnionCostGN;
      const driverShareGN = Math.round(netPoolGN * 0.60);
      const conductorShareGN = netPoolGN - driverShareGN;
      const requestKey = String(data.idempotencyKey || '').trim();
      if (!requestKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'IDEMPOTENCY_KEY_REQUIRED' }));
        return;
      }
      const idemKey = `${demoPlayer.playerId}:${requestKey}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CONDUCTOR_COOP_REPLAY_REJECTED' }));
        return;
      }
      const txId = `tx_coop_conductor_${demoPlayer.playerId}_${Date.now()}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_coop_${txId}`,
          idemKey,
          demoPlayer.playerId,
          `Section 19 Danfo Conductor Co-Op Share (40% of Net Pool)`,
          [
            { accountCode: playerCashAccountCode(), debit: conductorShareGN, credit: 0 },
            { accountCode: 'Revenue:Player:LivelihoodWages', debit: 0, credit: conductorShareGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Conductor co-op replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CONDUCTOR_COOP_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }
      demoPlayer.gameNairaBalance += conductorShareGN;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        routeId,
        grossRouteFaresGN,
        disclosedFuelAndUnionCostGN,
        netPoolGN,
        driverShareGN,
        conductorShareGN,
        newBalanceGN: demoPlayer.gameNairaBalance,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/creator/submit — Section 06 Module 13 Creator Studio Submission & Settlement
  if (url.pathname === '/api/v1/creator/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const proj = mbState.creatorStudioCatalog.find((p: any) => p.projectId === data.projectId);
      if (!proj) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CREATOR_PROJECT_NOT_FOUND', projectId: data.projectId }));
        return;
      }
      const commissionGN = Number(proj.commissionGN);
      const idemKey = `${demoPlayer.playerId}:idem_creator_submission_${proj.projectId}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CREATOR_SUBMISSION_ALREADY_SETTLED', projectId: proj.projectId }));
        return;
      }
      const txId = `tx_creator_${demoPlayer.playerId}_${proj.projectId}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_creator_${txId}`,
          idemKey,
          demoPlayer.playerId,
          `Creator Studio Approved Commission: ${proj.title}`,
          [
            { accountCode: playerCashAccountCode(), debit: commissionGN, credit: 0 },
            { accountCode: 'Revenue:Player:LivelihoodWages', debit: 0, credit: commissionGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Creator submission replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CREATOR_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }
      proj.submissionsCount = (proj.submissionsCount || 0) + 1;
      demoPlayer.gameNairaBalance += commissionGN;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        project: proj,
        commissionGN,
        newBalanceGN: demoPlayer.gameNairaBalance,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // POST /api/v1/ops/console — Section 06 Module 14 Operations Console (Audit, Moderate, Pause Campaigns, Reconcile)
  if (url.pathname === '/api/v1/ops/console' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const action = data.action || 'RECONCILE_LEDGER';
      const ops = mbState.operationsConsoleState;
      const audit = globalEconomyLedger.auditIntegrity();
      if (action === 'RECONCILE_LEDGER') {
        ops.ledgerReconciliationRuns += 1;
        ops.lastReconciliationBalanced = audit.isBalanced;
      } else if (action === 'TOGGLE_CAMPAIGN_PAUSE') {
        ops.sponsoredCampaignsPaused = !ops.sponsoredCampaignsPaused;
      } else if (action === 'VERIFY_KILL_SWITCH_LOCKED') {
        ops.realRewardKillSwitchLocked = !mbState.realRewardComplianceState.realCashRewardsEnabled;
      }
      const logEntry = {
        auditId: `ops_${Date.now()}`,
        action,
        status: audit.isBalanced ? 'VERIFIED_OK' : 'ALERT',
        timestampIso: new Date().toISOString(),
        detail: `Ops Action ${action} executed • Ledger Balanced=${audit.isBalanced} • RealRewardOff=${!mbState.realRewardComplianceState.realCashRewardsEnabled}`
      };
      ops.auditLogs.unshift(logEntry);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, operationsConsoleState: ops, ledgerAudit: audit }));
    });
    return;
  }

  // POST /api/v1/economy/first-week-simulation — Section 46 (Appendices F1–F7) First-Week Affordability Model
  if (url.pathname === '/api/v1/economy/first-week-simulation' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      openingBalanceGN: 5000,
      moments: [
        { moment: '1. Arrival', action: 'Inspect starter room, learn EkoPhone & starter food/water pack', deltaGN: 0, balanceAfterGN: 5000 },
        { moment: '2. First shift', action: 'Complete Foot Courier job (550 gross - 50 cost)', deltaGN: 500, balanceAfterGN: 5500 },
        { moment: '3. Second activity', action: 'Work Shop-Floor Assistant shift (550 gross - 50 cost)', deltaGN: 500, balanceAfterGN: 6000 },
        { moment: '4. First purchase', action: 'Buy toiletries (200), bukka meal (250) & Standing Fan (750)', deltaGN: -1200, balanceAfterGN: 4800 },
        { moment: '5. Skill step', action: 'Complete Workshop Apprentice lesson stipend', deltaGN: 450, balanceAfterGN: 5250 },
        { moment: '6. Household planning', action: 'Pay shared-room weekly lease after grace period', deltaGN: -750, balanceAfterGN: 4500 },
        { moment: '7. End-of-week review', action: 'Retain healthy buffer + fan upgrade + skill progress', deltaGN: 0, balanceAfterGN: 4500 }
      ],
      tuningMetrics: {
        medianEntryJobNetGN: 500,
        coreNeedsToIncomeRatio: 0.42,
        timeToFirstUsefulPurchaseMin: 12,
        timeToFirstRentPaymentMin: 35,
        timeToFirstCareerUnlockMin: 24
      },
      livelihoodLadderStages: mbState.livelihoodLadderStages
    }));
    return;
  }

  // POST /api/v1/business/operate-shift — Phase 8 (M8) Player Business Operations Across All 9 Canonical Business Types
  if (url.pathname === '/api/v1/business/operate-shift' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const businessAliases: Record<string, string> = {
        biz_food_bukka: 'biz_suya_haruna',
        biz_auto_mechanic: 'biz_mechanic_tunde',
        biz_fashion_tailor: 'biz_bukka_nkechi',
      };
      const requestedBizId = typeof data.bizId === 'string' ? data.bizId.trim() : '';
      const bizId = businessAliases[requestedBizId] || requestedBizId;
      const business = businessesRegistry.find((candidate: any) => candidate.id === bizId);
      if (!business) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_NOT_FOUND', bizId: requestedBizId }));
        return;
      }
      if (!business.owned) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_NOT_OWNED', bizId }));
        return;
      }
      const grossRevenueGN = Math.floor(Number(business.hourlyEarningsGN || business.projectedHourlyGN || 0));
      if (!Number.isFinite(grossRevenueGN) || grossRevenueGN <= 0) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_HAS_NO_CONFIGURED_SHIFT_REVENUE', bizId }));
        return;
      }
      const operatingCostGN = Math.max(200, Math.round(grossRevenueGN * 0.35));
      const netProfitGN = grossRevenueGN - operatingCostGN;
      if (typeof data.idempotencyKey !== 'string' || !data.idempotencyKey.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'IDEMPOTENCY_KEY_REQUIRED' }));
        return;
      }
      const idemKey = `${demoPlayer.playerId}:${data.idempotencyKey.trim()}`;
      if (globalEconomyLedger.exportTransactions().some(tx => tx.idempotencyKey === idemKey)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_SHIFT_REPLAY_REJECTED', bizId }));
        return;
      }
      if (demoPlayer.gameNairaBalance < operatingCostGN) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_OPERATING_CAPITAL',
          requiredGN: operatingCostGN,
          balanceGN: demoPlayer.gameNairaBalance
        }));
        return;
      }
      const txId = `tx_biz_${bizId}_${Date.now()}`;
      try {
        const posted = globalEconomyLedger.postTransaction(
          txId,
          `ev_biz_${txId}`,
          idemKey,
          demoPlayer.playerId,
          `Player Business Shift (${bizId}): Gross ₦${grossRevenueGN} - Operating Cost ₦${operatingCostGN}`,
          [
            { accountCode: playerCashAccountCode(), debit: netProfitGN, credit: 0 },
            { accountCode: 'Expense:Business:OperatingCosts', debit: operatingCostGN, credit: 0 },
            { accountCode: 'Revenue:Player:BusinessSales', debit: 0, credit: grossRevenueGN }
          ]
        );
        if (posted.transactionId !== txId) throw new Error('Business shift replay rejected.');
      } catch (error: any) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BUSINESS_SHIFT_SETTLEMENT_REJECTED', details: String(error?.message || error) }));
        return;
      }
      demoPlayer.gameNairaBalance += netProfitGN;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        bizId,
        operatingCostGN,
        grossRevenueGN,
        netProfitGN,
        newBalanceGN: demoPlayer.gameNairaBalance,
        transactionId: txId,
        ledgerAudit: globalEconomyLedger.auditIntegrity()
      }));
    });
    return;
  }

  // M4.7 Guided Gameplay, Auth, Character Creation, EkoGuide, Quest Event Bus, Co-op Ledger, EkoProgress, Hustle Flow & Funnel Analytics
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
    });
  }
});



server.listen(PORT, () => {
  console.log(`[Project Eko API] Domain API running on http://localhost:${PORT}`);
});

