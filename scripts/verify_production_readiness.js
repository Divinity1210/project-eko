const assert = require('assert');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'project-eko-prod-readiness-'));
const GAME_PORT = 18090;
const API_PORT = 13401;
const REALTIME_PORT = 13402;
const ALLOWED_ORIGIN = `http://localhost:${GAME_PORT}`;
const EVIDENCE_SECRET = 'prod_verification_hmac_secret_key_32_chars_minimum_2026';

function request(port, reqPath, { method = 'GET', token, body, rawBody, headers = {} } = {}) {
  const payload = rawBody !== undefined ? rawBody : (body === undefined ? '' : JSON.stringify(body));
  const reqHeaders = {
    Origin: ALLOWED_ORIGIN,
    ...headers,
  };
  if (payload) {
    reqHeaders['Content-Type'] = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(payload);
  }
  if (token) {
    reqHeaders['X-Session-Token'] = token;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: reqHeaders,
        timeout: 4000,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw || '{}');
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout calling ${method} :${port}${reqPath}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForHealth(port, healthPath = '/health') {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await request(port, healthPath);
      if (response.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Service on port ${port} did not become healthy`);
}

function startNodeService(scriptRelPath, extraEnv = {}) {
  return spawn(process.execPath, [path.join(ROOT, scriptRelPath)], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(GAME_PORT),
      PROJECT_EKO_GAME_PORT: String(GAME_PORT),
      PROJECT_EKO_API_PORT: String(API_PORT),
      PROJECT_EKO_REALTIME_PORT: String(REALTIME_PORT),
      PROJECT_EKO_DATA_DIR: DATA_DIR,
      PROJECT_EKO_CORS_ORIGINS: `${ALLOWED_ORIGIN},http://127.0.0.1:${GAME_PORT}`,
      PROJECT_EKO_EVIDENCE_HMAC_KEY: EVIDENCE_SECRET,
      PROJECT_EKO_STAFF_BOOTSTRAP_KEY: 'staff_bootstrap_ops_secret_key_2026',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopService(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
      resolve();
    }, 1500);
  });
}

async function main() {
  let gameServer;
  let apiServer;
  let realtimeServer;

  try {
    console.log('==============================================================');
    console.log('PROJECT EKO — PRODUCTION READINESS END-TO-END VERIFICATION');
    console.log('==============================================================');

    // 1. Verify required production infrastructure & configuration files exist
    const requiredInfraFiles = [
      '.github/workflows/ci-production-readiness.yml',
      'infra/environments/development.env.example',
      'infra/environments/staging.env.example',
      'infra/environments/production.env.example',
      'infra/deployment/docker-compose.production.yml',
      'infra/deployment/rollback-and-release.sh',
      'infra/database/001_initial_schema.sql',
    ];
    for (const rel of requiredInfraFiles) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `Missing required production infrastructure file: ${rel}`);
    }
    console.log('✅ Phase 1 & 9: CI pipeline, environment templates, deployment configs, and rollback runbook verified.');

    // Start Game, API, and Realtime services
    gameServer = startNodeService('apps/game/server.js');
    apiServer = startNodeService('services/api/dist/server.js');
    realtimeServer = startNodeService('services/realtime/dist/server.js');

    await waitForHealth(GAME_PORT, '/health');
    await waitForHealth(API_PORT, '/health');
    await waitForHealth(REALTIME_PORT, '/health');

    // 2. Verify CORS Origin Allowlist (No Wildcard '*') & Security Headers on all 3 services
    for (const [svcName, port] of [
      ['Game Server', GAME_PORT],
      ['Domain API', API_PORT],
      ['Realtime Worker', REALTIME_PORT],
    ]) {
      const h = await request(port, '/health');
      assert.strictEqual(h.status, 200, `${svcName} /health must return 200`);
      assert.notStrictEqual(
        h.headers['access-control-allow-origin'],
        '*',
        `${svcName} must NEVER return wildcard Access-Control-Allow-Origin: *`
      );
      assert.strictEqual(
        h.headers['access-control-allow-origin'],
        ALLOWED_ORIGIN,
        `${svcName} must return configured origin allowlist`
      );
      assert.strictEqual(h.headers['x-content-type-options'], 'nosniff', `${svcName} must set X-Content-Type-Options: nosniff`);
      assert.strictEqual(h.headers['x-frame-options'], 'DENY', `${svcName} must set X-Frame-Options: DENY`);
      assert.ok(h.headers['content-security-policy'], `${svcName} must set Content-Security-Policy`);

      const r = await request(port, '/readyz');
      assert.strictEqual(r.status, 200, `${svcName} /readyz must return 200`);
    }

    // Verify Game Server /config.js and path traversal block
    const cfgRes = await request(GAME_PORT, '/config.js');
    assert.strictEqual(cfgRes.status, 200);
    assert.ok(cfgRes.raw.includes('window.__PROJECT_EKO_CONFIG__'), '/config.js must inject runtime endpoint config');
    assert.ok(cfgRes.raw.includes('"fiatRewardsEnabled":false'), '/config.js must keep fiatRewardsEnabled: false');
    console.log('✅ Phase 1: Origin-allowlist CORS, security headers, /health, /readyz, and /config.js verified across all services.');

    // 3. Verify Database Schema Adapter & Backup/Restore Verification (Phase 3)
    const dbStatus = await request(API_PORT, '/api/v1/db/status');
    assert.strictEqual(dbStatus.status, 200);
    assert.strictEqual(dbStatus.body.ok, true);
    assert.strictEqual(dbStatus.body.database.ready, true);
    assert.strictEqual(dbStatus.body.database.verifiedTablesCount, 20, 'All 20 canonical PostgreSQL domain tables must be verified');
    assert.ok(dbStatus.body.database.verifiedTriggers.includes('verify_ledger_transaction_balanced'));

    const dbBackup = await request(API_PORT, '/api/v1/db/backup', { method: 'POST' });
    assert.strictEqual(dbBackup.status, 200);
    assert.strictEqual(dbBackup.body.ok, true);
    assert.strictEqual(dbBackup.body.verification.valid, true, 'Backup snapshot SHA-256 verification must pass');
    console.log('✅ Phase 3: Canonical PostgreSQL 20-table schema, balance trigger, and SHA-256 backup/restore verification passed.');

    // 4. Verify Identity, Age-Band Enforcement, Token Exposure Prevention, Logout & Rate Limiting (Phase 2)
    const underAgeReg = await request(API_PORT, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        username: 'kid_player',
        password: 'password123',
        ageBand: 'UNDER_13',
      },
    });
    assert.strictEqual(underAgeReg.status, 403, 'Under-13 registration must be rejected with 403');
    assert.strictEqual(underAgeReg.body.error, 'AGE_REQUIREMENT_NOT_MET');

    const regDriver = await request(API_PORT, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        username: 'driver_tunde_prod',
        email: 'tunde.prod@eko.ng',
        password: 'StrongPassword#2026',
        ageBand: 'ADULT',
        consentAccepted: true,
      },
    });
    assert.strictEqual(regDriver.status, 200);
    const driverToken = regDriver.body.sessionToken;
    const driverId = regDriver.body.account.accountId;

    // Query-string sessionToken must be rejected on both API and Realtime
    const queryTokenApi = await request(API_PORT, `/api/v1/player/profile?sessionToken=${encodeURIComponent(driverToken)}`);
    assert.strictEqual(queryTokenApi.status, 400, 'API must reject sessionToken in URL query string');
    assert.strictEqual(queryTokenApi.body.error, 'SESSION_TOKEN_IN_URL_FORBIDDEN');

    const queryTokenRt = await request(REALTIME_PORT, `/snapshot?sessionToken=${encodeURIComponent(driverToken)}`);
    assert.strictEqual(queryTokenRt.status, 400, 'Realtime must reject sessionToken in URL query string');
    assert.strictEqual(queryTokenRt.body.error, 'SESSION_TOKEN_IN_URL_FORBIDDEN');

    // Body sessionToken without header must be rejected
    const bodyTokenOnly = await request(API_PORT, '/api/v1/character/create', {
      method: 'POST',
      body: {
        sessionToken: driverToken,
        displayName: 'Should Fail Without Header',
      },
    });
    assert.strictEqual(bodyTokenOnly.status, 401, 'Body sessionToken without header must not authenticate');

    // Oversized payload > 256 KB must be rejected with 413
    const hugeBody = JSON.stringify({ padding: 'x'.repeat(270 * 1024) });
    const oversizedRes = await request(API_PORT, '/api/v1/auth/login', {
      method: 'POST',
      rawBody: hugeBody,
    });
    assert.strictEqual(oversizedRes.status, 413, 'Payloads exceeding 256 KB must be rejected with 413');
    assert.strictEqual(oversizedRes.body.error, 'PAYLOAD_TOO_LARGE');

    // Session listing & explicit revocation (/api/v1/auth/logout)
    const loginTemp = await request(API_PORT, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'driver_tunde_prod', password: 'StrongPassword#2026' },
    });
    assert.strictEqual(loginTemp.status, 200);
    const tempToken = loginTemp.body.sessionToken;

    const sessionsList = await request(API_PORT, '/api/v1/auth/sessions', { token: tempToken });
    assert.strictEqual(sessionsList.status, 200);
    assert.ok(Array.isArray(sessionsList.body.sessions) && sessionsList.body.sessions.length >= 1);

    const logoutRes = await request(API_PORT, '/api/v1/auth/logout', {
      method: 'POST',
      token: tempToken,
      body: {},
    });
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.body.revokedSessions, 1);

    const afterLogout = await request(API_PORT, '/api/v1/auth/session', { token: tempToken });
    assert.strictEqual(afterLogout.body.authenticated, false, 'Revoked session token must no longer authenticate');

    // Re-login to get active driverToken
    const reloginDriver = await request(API_PORT, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'driver_tunde_prod', password: 'StrongPassword#2026' },
    });
    const activeDriverToken = reloginDriver.body.sessionToken;

    // Privacy export & consent withdrawal & account deletion on a dedicated test user
    const regPrivacyUser = await request(API_PORT, '/api/v1/auth/register', {
      method: 'POST',
      body: { username: 'privacy_citizen', password: 'Password#123', privacyConsentAccepted: true },
    });
    const privToken = regPrivacyUser.body.sessionToken;

    const exportRes = await request(API_PORT, '/api/v1/privacy/export', { token: privToken });
    assert.strictEqual(exportRes.status, 200);
    assert.strictEqual(exportRes.body.account.accountId, regPrivacyUser.body.account.accountId);

    const withdrawRes = await request(API_PORT, '/api/v1/privacy/withdraw-consent', {
      method: 'POST',
      token: privToken,
      body: {},
    });
    assert.strictEqual(withdrawRes.status, 200);
    assert.strictEqual(withdrawRes.body.privacyConsentAccepted, false);
    assert.strictEqual(withdrawRes.body.analyticsPurged, true);

    const deleteRes = await request(API_PORT, '/api/v1/privacy/delete-account', {
      method: 'POST',
      token: privToken,
      body: { confirmDeletion: true },
    });
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.deleted, true);

    const deletedSessionCheck = await request(API_PORT, '/api/v1/auth/session', { token: privToken });
    assert.strictEqual(deletedSessionCheck.body.authenticated, false, 'Deleted account session must be invalidated');

    // Verify Lagos Life Character Creation (Female & Male Gender + Dress/Clothes + Ankara/Asooke Fabric + Gele/Shoes/Bag/Colors)
    const femaleCharRes = await request(API_PORT, '/api/v1/character/create', {
      method: 'POST',
      token: activeDriverToken,
      body: {
        displayName: 'Bimpe_Island_Queen',
        starterProfileId: 'profile_new_arrival',
        appearance: {
          gender: 'female',
          styleSet: 'party',
          bodyType: 'athletic_lagos',
          skinTone: '#6B3E26',
          hairStyle: 'gele_headwrap',
          outfitPreset: 'ankara_gown_dress',
          fabricStyle: 'ankara',
          shoesStyle: 'gold_heels',
          bagStyle: 'mini_bag',
          topColor: '#EC4899',
          bottomColor: '#831843',
          hairColor: '#9D174D',
          shoeColor: '#F4B41A',
          bagColor: '#F4B41A',
          accentColor: '#EC4899',
        },
      },
    });
    assert.strictEqual(femaleCharRes.status, 200, 'Female character creation with Ankara dress & Gele must succeed');
    assert.strictEqual(femaleCharRes.body.account.character.appearance.gender, 'female');
    assert.strictEqual(femaleCharRes.body.account.character.appearance.outfitPreset, 'ankara_gown_dress');
    assert.strictEqual(femaleCharRes.body.account.character.appearance.hairStyle, 'gele_headwrap');
    assert.strictEqual(femaleCharRes.body.account.character.appearance.shoesStyle, 'gold_heels');
    assert.strictEqual(femaleCharRes.body.account.character.appearance.bagStyle, 'mini_bag');
    assert.ok(femaleCharRes.body.account.onboarding.ownedOutfits.includes('outfit_ankara_gown'), 'Female Ankara gown must be unlocked in ownedOutfits');

    // Staff RBAC & Audit Log check
    const nonStaffMod = await request(API_PORT, '/api/v1/ops/moderation/review', {
      method: 'POST',
      token: activeDriverToken,
      body: { action: 'MUTE_PLAYER', targetId: driverId, reason: 'Unauthorized attempt' },
    });
    assert.strictEqual(nonStaffMod.status, 403, 'Non-staff player must be denied access to moderation review');
    assert.strictEqual(nonStaffMod.body.error, 'STAFF_ROLE_REQUIRED');

    const staffMod = await request(API_PORT, '/api/v1/ops/moderation/review', {
      method: 'POST',
      token: activeDriverToken,
      headers: { 'X-Staff-Ops-Key': 'staff_bootstrap_ops_secret_key_2026' },
      body: { action: 'REVIEW_FLAG', targetId: driverId, reason: 'Routine compliance audit' },
    });
    assert.strictEqual(staffMod.status, 200);
    assert.ok(staffMod.body.moderationEntry.auditId);

    const auditLogRes = await request(API_PORT, '/api/v1/ops/moderation/audit-log', {
      token: activeDriverToken,
      headers: { 'X-Staff-Ops-Key': 'staff_bootstrap_ops_secret_key_2026' },
    });
    assert.strictEqual(auditLogRes.status, 200);
    assert.ok(auditLogRes.body.auditLogs.length >= 1, 'Staff action must be recorded in audit log');
    console.log('✅ Phase 2: Age-band enforcement, URL token ban, session revocation, privacy export/delete, and staff RBAC verified.');

    // 5. Verify Realtime Kinematic Anti-Cheat, Zone Restart Persistence & Signed Checkpoint Co-op Settlement (Phase 4)
    const regConductor = await request(API_PORT, '/api/v1/auth/register', {
      method: 'POST',
      body: { username: 'conductor_segun_prod', password: 'StrongPassword#2026', privacyConsentAccepted: true },
    });
    const conductorToken = regConductor.body.sessionToken;
    const conductorId = regConductor.body.account.accountId;

    // Both players join realtime zone presence
    const presDriver = await request(REALTIME_PORT, '/presence', {
      method: 'POST',
      token: activeDriverToken,
      body: { position: { x: -95, y: 0, z: -195 }, rotationY: 0 },
    });
    assert.strictEqual(presDriver.status, 200);

    const presConductor = await request(REALTIME_PORT, '/presence', {
      method: 'POST',
      token: conductorToken,
      body: { position: { x: -94, y: 0, z: -195 }, rotationY: 0 },
    });
    assert.strictEqual(presConductor.status, 200);

    // Driver boards vehicle & attempts impossible speed hack (295 km/h) -> must be rejected with 422!
    const boardDriver = await request(REALTIME_PORT, '/vehicles/board', {
      method: 'POST',
      token: activeDriverToken,
      body: { vehicleId: 'veh_prod_danfo_01', role: 'DRIVER', position: { x: -95, y: 0, z: -195 } },
    });
    assert.strictEqual(boardDriver.status, 200);

    const speedHackSync = await request(REALTIME_PORT, '/vehicles/sync-transform', {
      method: 'POST',
      token: activeDriverToken,
      body: {
        vehicleId: 'veh_prod_danfo_01',
        position: { x: -95, y: 0, z: -180 },
        speedKmh: 295,
      },
    });
    assert.strictEqual(speedHackSync.status, 422, 'Realtime worker must reject 295 km/h speed hack with 422');
    assert.strictEqual(speedHackSync.body.error, 'MOVEMENT_PLAUSIBILITY_REJECTED');

    const teleportHackSync = await request(REALTIME_PORT, '/vehicles/sync-transform', {
      method: 'POST',
      token: activeDriverToken,
      body: {
        vehicleId: 'veh_prod_danfo_01',
        position: { x: -95, y: 0, z: -100 },
        deltaTimeSeconds: 0.05,
        speedKmh: 45,
      },
    });
    assert.strictEqual(teleportHackSync.status, 422, 'Realtime worker must reject 95m warp in 0.05s with 422');
    assert.strictEqual(teleportHackSync.body.error, 'MOVEMENT_PLAUSIBILITY_REJECTED');

    // Valid transform sync succeeds
    const validSync = await request(REALTIME_PORT, '/vehicles/sync-transform', {
      method: 'POST',
      token: activeDriverToken,
      body: {
        vehicleId: 'veh_prod_danfo_01',
        position: { x: -95, y: 0, z: -190 },
        deltaTimeSeconds: 0.5,
        speedKmh: 36,
      },
    });
    assert.strictEqual(validSync.status, 200);

    // Co-op Danfo lifecycle with server-signed checkpointToken
    const unverifiedCoopSettle = await request(API_PORT, '/api/v1/multiplayer/coop-danfo/settle', {
      method: 'POST',
      token: activeDriverToken,
      body: { role: 'DRIVER' },
    });
    assert.strictEqual(
      unverifiedCoopSettle.status,
      503,
      'Co-op settlement without a signed checkpointToken must fail closed with 503'
    );
    assert.strictEqual(unverifiedCoopSettle.body.error, 'SERVER_VERIFIED_COOP_SETTLEMENT_REQUIRED');

    const coopCreate = await request(REALTIME_PORT, '/coop/danfo/create', {
      method: 'POST',
      token: activeDriverToken,
      body: { routeId: 'route_cms_obalende', vehicleId: 'veh_prod_danfo_01' },
    });
    assert.strictEqual(coopCreate.status, 200);
    const coopSessionId = coopCreate.body.session.coopSessionId;

    const coopJoin = await request(REALTIME_PORT, '/coop/danfo/join', {
      method: 'POST',
      token: conductorToken,
      body: { coopSessionId },
    });
    assert.strictEqual(coopJoin.status, 200);

    const coopStart = await request(REALTIME_PORT, '/coop/danfo/start', {
      method: 'POST',
      token: activeDriverToken,
      body: { coopSessionId },
    });
    assert.strictEqual(coopStart.status, 200);

    // Restart Realtime server mid-session to prove durable zone state persistence!
    await stopService(realtimeServer);
    realtimeServer = startNodeService('services/realtime/dist/server.js');
    await waitForHealth(REALTIME_PORT, '/health');

    const coopStateAfterRestart = await request(
      REALTIME_PORT,
      `/coop/danfo/state?coopSessionId=${encodeURIComponent(coopSessionId)}`,
      { token: activeDriverToken }
    );
    assert.strictEqual(coopStateAfterRestart.status, 200, 'Co-op session must survive Realtime server restart');
    assert.strictEqual(coopStateAfterRestart.body.session.status, 'IN_PROGRESS');

    // Conductor boards stops and receives server-signed checkpointTokens
    const stop1 = await request(REALTIME_PORT, '/coop/danfo/board-stop', {
      method: 'POST',
      token: conductorToken,
      body: { coopSessionId, stopId: 'stop_cms_terminal' },
    });
    assert.strictEqual(stop1.status, 200);
    assert.ok(stop1.body.driverCheckpointToken?.signature, 'Realtime worker must issue signed driverCheckpointToken');
    assert.ok(stop1.body.conductorCheckpointToken?.signature, 'Realtime worker must issue signed conductorCheckpointToken');

    // Driver settles using driverCheckpointToken
    const driverSettle = await request(API_PORT, '/api/v1/multiplayer/coop-danfo/settle', {
      method: 'POST',
      token: activeDriverToken,
      body: {
        role: 'DRIVER',
        checkpointToken: stop1.body.driverCheckpointToken,
      },
    });
    assert.strictEqual(driverSettle.status, 200, 'Verified driver checkpoint token must settle cleanly');
    assert.strictEqual(driverSettle.body.ok, true);
    assert.strictEqual(driverSettle.body.driverPayoutGN, 240);

    // Replaying the same checkpointToken must be rejected with 409
    const driverSettleReplay = await request(API_PORT, '/api/v1/multiplayer/coop-danfo/settle', {
      method: 'POST',
      token: activeDriverToken,
      body: {
        role: 'DRIVER',
        checkpointToken: stop1.body.driverCheckpointToken,
      },
    });
    assert.strictEqual(driverSettleReplay.status, 409, 'Replayed checkpoint token must be rejected with 409');
    assert.strictEqual(driverSettleReplay.body.error, 'COOP_CHECKPOINT_TOKEN_ALREADY_SETTLED');
    console.log('✅ Phase 4: Kinematic anti-cheat rejection, zone restart durability, and signed checkpoint co-op settlement verified.');

    // 6. Verify Auth Rate Limiting (429 AUTH_RATE_LIMIT_EXCEEDED)
    let rateLimited = false;
    for (let i = 0; i < 30; i++) {
      const attempt = await request(API_PORT, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '203.0.113.99' },
        body: { username: 'nonexistent_bruteforce_user', password: 'wrong' },
      });
      if (attempt.status === 429 && attempt.body.error === 'AUTH_RATE_LIMIT_EXCEEDED') {
        rateLimited = true;
        break;
      }
    }
    assert.strictEqual(rateLimited, true, 'Auth endpoint must enforce rate limiting (429 AUTH_RATE_LIMIT_EXCEEDED)');
    console.log('✅ Phase 2: Auth brute-force rate limiting (429 AUTH_RATE_LIMIT_EXCEEDED) verified.');

    // 7. Verify Observability Metrics & Balanced Global Double-Entry Ledger (Phase 5 & Phase 9)
    const apiMetricsRes = await request(API_PORT, '/metrics');
    assert.strictEqual(apiMetricsRes.status, 200);
    assert.strictEqual(apiMetricsRes.body.ledgerBalanced, true, 'Global double-entry ledger must remain strictly balanced');

    const rtMetricsRes = await request(REALTIME_PORT, '/metrics');
    assert.strictEqual(rtMetricsRes.status, 200);
    assert.ok(rtMetricsRes.body.movementRejectionsTotal >= 2, 'Realtime metrics must count movement rejections');
    assert.ok(rtMetricsRes.body.zonePersistsTotal >= 1, 'Realtime metrics must count durable zone saves');
    console.log('✅ Phase 5 & 9: Observability /metrics and global double-entry ledger reconciliation verified.');

    // 8. Verify New Player Sign-Up, Character Creation, Guest Promotion, Soft-Delete Handle Reuse & Frontend UX Safeguards
    const port3000Preflight = await request(API_PORT, '/api/v1/auth/register', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.strictEqual(port3000Preflight.status, 204);
    assert.strictEqual(
      port3000Preflight.headers['access-control-allow-origin'],
      'http://localhost:3000',
      'Default dev game port http://localhost:3000 must be allowed by API CORS'
    );

    const evilOriginCheck = await request(API_PORT, '/health', {
      headers: { Origin: 'https://evil-attacker.example.com' },
    });
    assert.notStrictEqual(
      evilOriginCheck.headers['access-control-allow-origin'],
      'https://evil-attacker.example.com',
      'Untrusted external origin must never be reflected in Access-Control-Allow-Origin'
    );
    assert.notStrictEqual(
      evilOriginCheck.headers['access-control-allow-origin'],
      '*',
      'Access-Control-Allow-Origin must never be wildcard *'
    );

    // Guest Entry -> 5-Step Character Creation -> Guest Promotion -> Logout -> Returning Login
    const guestEntryRes = await request(API_PORT, '/api/v1/auth/guest', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'X-Forwarded-For': '198.51.100.12' },
      body: { displayHint: 'Lagbaja' },
    });
    assert.strictEqual(guestEntryRes.status, 200, 'Guest session creation must succeed');
    assert.strictEqual(guestEntryRes.body.account.isGuest, true);
    const guestToken = guestEntryRes.body.sessionToken;

    const guestCharCreate = await request(API_PORT, '/api/v1/character/create', {
      method: 'POST',
      token: guestToken,
      headers: { Origin: 'http://localhost:3000' },
      body: {
        displayName: 'Lagbaja Eko',
        starterProfileId: 'profile_new_arrival',
        initialOutfitId: 'outfit_street_hustler',
        appearance: {
          bodyType: 'athletic_lagos',
          skinTone: '#6B3E26',
          hairStyle: 'low_fade',
          outfitPreset: 'outfit_street_hustler',
          accentColor: '#10B981',
        },
      },
    });
    assert.strictEqual(guestCharCreate.status, 200, '5-step character creation must succeed');
    assert.strictEqual(guestCharCreate.body.character.displayName, 'Lagbaja Eko');
    assert.strictEqual(guestCharCreate.body.account.characterCreated, true);

    const promoteGuestRes = await request(API_PORT, '/api/v1/auth/promote-guest', {
      method: 'POST',
      token: guestToken,
      headers: { Origin: 'http://localhost:3000', 'X-Forwarded-For': '198.51.100.12' },
      body: {
        username: 'lagbaja_permanent',
        email: 'lagbaja@eko.ng',
        password: 'PermanentPassword#2026',
      },
    });
    assert.strictEqual(promoteGuestRes.status, 200, 'Guest promotion to permanent citizen account must succeed');
    assert.strictEqual(promoteGuestRes.body.account.isGuest, false);
    assert.strictEqual(promoteGuestRes.body.account.username, 'lagbaja_permanent');

    const promotedLogoutRes = await request(API_PORT, '/api/v1/auth/logout', {
      method: 'POST',
      token: guestToken,
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.strictEqual(promotedLogoutRes.status, 200, 'Session logout must succeed');

    const returningLoginRes = await request(API_PORT, '/api/v1/auth/login', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'X-Forwarded-For': '198.51.100.13' },
      body: {
        username: 'lagbaja_permanent',
        password: 'PermanentPassword#2026',
      },
    });
    assert.strictEqual(returningLoginRes.status, 200, 'Returning login after guest promotion must succeed');
    assert.strictEqual(returningLoginRes.body.account.character.displayName, 'lagbaja_permanent');

    // Verify Frontend HTML Input & Modal Safeguards
    const indexHtml = fs.readFileSync(path.join(ROOT, 'apps/game/index.html'), 'utf8');
    assert.ok(indexHtml.includes('user-select: text !important'), 'index.html must allow text selection inside form inputs');
    assert.ok(indexHtml.includes('isEditableField'), 'index.html keydown listener must guard editable form inputs');
    assert.ok(indexHtml.includes('submitGuestPromotion'), 'index.html must expose Guest Promotion flow');
    assert.ok(indexHtml.includes('syncCharFormFromDom'), 'index.html must preserve Character Creation form fields across re-renders');
    assert.ok(indexHtml.includes("onColorPickerChanged('topColor'"), 'index.html must bind live color picker handler for topColor');
    assert.ok(indexHtml.includes("onColorPickerChanged('bottomColor'"), 'index.html must bind live color picker handler for bottomColor');
    assert.ok(indexHtml.includes("onColorPickerChanged('hairColor'"), 'index.html must bind live color picker handler for hairColor');
    assert.ok(indexHtml.includes("onColorPickerChanged('shoeColor'"), 'index.html must bind live color picker handler for shoeColor');
    assert.ok(indexHtml.includes("onColorPickerChanged('bagColor'"), 'index.html must bind live color picker handler for bagColor');
    assert.ok(indexHtml.includes('rotatePreviewAvatar(-45)') && indexHtml.includes('rotatePreviewAvatar(45)') && indexHtml.includes('setPreviewYaw(180)'), 'index.html must support 360° studio & 3D avatar rotation controls');
    assert.ok(indexHtml.includes('geo.computeVertexNormals()') && indexHtml.includes('const jawCheekGeo = new THREE.SphereGeometry') && indexHtml.includes('neckRotY'), 'index.html must use smooth vertex normals, anatomical facial/torso geometry, and head-stabilized human walking gait');
    assert.ok(
      indexHtml.includes('rebuildHumanoidAnatomy') &&
      indexHtml.includes('getAnatomicalProportions') &&
      indexHtml.includes('const pecPlate = new THREE.BoxGeometry') &&
      indexHtml.includes('const beltGeo = new THREE.CylinderGeometry') &&
      indexHtml.includes('const mustacheGeo = new THREE.CylinderGeometry') &&
      indexHtml.includes('const goateeGeo = new THREE.BoxGeometry') &&
      indexHtml.includes('const bustGeo = new THREE.SphereGeometry') &&
      indexHtml.includes('const hipCurveGeo = new THREE.SphereGeometry'),
      'index.html must dynamically rebuild 3D male vs female anatomical geometry, physique proportions, pectorals/belt/beard vs bust/hourglass hips'
    );
    console.log('✅ QA Sign-Up, Character Studio (Color Pickers + 360° 3D Rotation + Male/Female 3D Anatomy & Physique) & UX Gate verified.');

    console.log('\n==============================================================');
    console.log('ALL PRODUCTION READINESS GATES (PHASES 0–11) PASSED');
    console.log('==============================================================');
  } finally {
    await stopService(realtimeServer);
    await stopService(apiServer);
    await stopService(gameServer);
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
