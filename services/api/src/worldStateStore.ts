import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.PROJECT_EKO_DATA_DIR || path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'legacy_world_state.json');

export interface LegacyWorldState {
  schemaVersion: 2;
  busStops: Array<Record<string, any>>;
  cityEvents: Array<Record<string, any>>;
  commerceState: {
    mediaSlots: Array<Record<string, any>>;
    mediaCampaigns: Array<Record<string, any>>;
    routeSelectionLog: Array<Record<string, any>>;
    mediaEventsLog: Array<Record<string, any>>;
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateCollection(value: unknown, name: string): value is Array<Record<string, any>> {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && typeof entry.id === 'string');
}

export function loadLegacyWorldState(defaults: Omit<LegacyWorldState, 'schemaVersion'>): LegacyWorldState {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    return { schemaVersion: 2, ...JSON.parse(JSON.stringify(defaults)) };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`[World Store] Refusing to start with unreadable state at ${STORE_PATH}: ${String(error)}`);
  }
  if (!isRecord(parsed) || ![1, 2].includes(parsed.schemaVersion) ||
      !validateCollection(parsed.busStops, 'busStops') ||
      !validateCollection(parsed.cityEvents, 'cityEvents')) {
    throw new Error(`[World Store] Refusing to start with unsupported or malformed state at ${STORE_PATH}.`);
  }

  const expectedStops = new Set(defaults.busStops.map((stop) => stop.id));
  const expectedEvents = new Set(defaults.cityEvents.map((event) => event.id));
  if (parsed.busStops.length !== expectedStops.size || parsed.busStops.some((stop: any) => !expectedStops.has(stop.id)) ||
      parsed.cityEvents.length !== expectedEvents.size || parsed.cityEvents.some((event: any) => !expectedEvents.has(event.id))) {
    throw new Error(`[World Store] World state does not match the current world definition at ${STORE_PATH}.`);
  }
  const commerceState = parsed.schemaVersion === 1 ? defaults.commerceState : parsed.commerceState;
  if (!isRecord(commerceState) || !Array.isArray(commerceState.mediaSlots) ||
      !commerceState.mediaSlots.every((slot: any) => isRecord(slot) && typeof slot.slotId === 'string') ||
      !Array.isArray(commerceState.mediaCampaigns) ||
      !commerceState.mediaCampaigns.every((campaign: any) => isRecord(campaign) && typeof campaign.campaignId === 'string') ||
      !Array.isArray(commerceState.routeSelectionLog) ||
      !commerceState.routeSelectionLog.every((entry: any) => isRecord(entry)) ||
      !Array.isArray(commerceState.mediaEventsLog) ||
      !commerceState.mediaEventsLog.every((entry: any) => isRecord(entry))) {
    throw new Error(`[World Store] Refusing to start with malformed commerce state at ${STORE_PATH}.`);
  }
  const expectedSlots = new Set(defaults.commerceState.mediaSlots.map((slot) => slot.slotId));
  const expectedCampaigns = new Set(defaults.commerceState.mediaCampaigns.map((campaign) => campaign.campaignId));
  if (commerceState.mediaSlots.length !== expectedSlots.size || commerceState.mediaSlots.some((slot: any) => !expectedSlots.has(slot.slotId)) ||
      commerceState.mediaCampaigns.length !== expectedCampaigns.size || commerceState.mediaCampaigns.some((campaign: any) => !expectedCampaigns.has(campaign.campaignId))) {
    throw new Error(`[World Store] Commerce state does not match the current world definition at ${STORE_PATH}.`);
  }
  return { schemaVersion: 2, busStops: parsed.busStops, cityEvents: parsed.cityEvents, commerceState: commerceState as LegacyWorldState['commerceState'] };
}

export function saveLegacyWorldState(state: LegacyWorldState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporaryPath = `${STORE_PATH}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, STORE_PATH);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch (_) {}
    throw new Error(`[World Store] Failed to persist shared world state: ${String(error)}`);
  }
}
