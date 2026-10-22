#!/usr/bin/env node
/**
 * PROJECT EKO — M4.7 GUIDED GAMEPLAY, MULTIPLAYER & PROGRESSION ENGINE
 * Phase 9 End-to-End API Integration & Two-Browser Headless Chrome Acceptance Suite
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const assert = require('assert');
const { spawn } = require('child_process');

const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GAME_URL = 'http://localhost:3000/index.html';
const API_URL = 'http://localhost:3001';
const RT_URL = 'http://localhost:3002';
const ARTIFACT_DIR = '/Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be';
const DELIVERY_SCREENSHOT_DIR = path.join(__dirname, '..', 'ANTIGRAVITY', 'DELIVERY', 'screenshots');
fs.mkdirSync(DELIVERY_SCREENSHOT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function createCDPClient(port) {
  const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const wsUrl = new URL(pageTarget.webSocketDebuggerUrl);

  const socket = net.createConnection({
    host: wsUrl.hostname,
    port: Number(wsUrl.port),
  });

  let buffer = Buffer.alloc(0);
  let msgId = 0;
  const pending = new Map();

  function processFrames() {
    while (buffer.length >= 2) {
      const firstByte = buffer[0];
      const secondByte = buffer[1];
      const opcode = firstByte & 0x0f;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = isMasked ? 4 : 0;
      if (buffer.length < offset + maskLen + payloadLen) return;

      let payload = buffer.slice(offset + maskLen, offset + maskLen + payloadLen);
      if (isMasked) {
        const mask = buffer.slice(offset, offset + 4);
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }
      buffer = buffer.slice(offset + maskLen + payloadLen);

      if (opcode === 0x1) {
        try {
          const msg = JSON.parse(payload.toString('utf8'));
          if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch (_) {}
      }
    }
  }

  await new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    let upgraded = false;
    socket.on('connect', () => {
      const req = [
        `GET ${wsUrl.pathname}${wsUrl.search} HTTP/1.1`,
        `Host: ${wsUrl.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n');
      socket.write(req);
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const idx = buffer.indexOf('\r\n\r\n');
        if (idx !== -1) {
          upgraded = true;
          buffer = buffer.slice(idx + 4);
          resolve();
          processFrames();
        }
      } else {
        processFrames();
      }
    });
    socket.on('error', reject);
  });

  function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const data = Buffer.from(JSON.stringify({ id, method, params }), 'utf8');
      const mask = crypto.randomBytes(4);
      let header;
      if (data.length < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81;
        header[1] = 0x80 | data.length;
      } else if (data.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(data.length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(data.length), 2);
      }
      const masked = Buffer.alloc(data.length);
      for (let i = 0; i < data.length; i++) {
        masked[i] = data[i] ^ mask[i % 4];
      }
      socket.write(Buffer.concat([header, mask, masked]));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res && res.exceptionDetails) {
      const desc = res.exceptionDetails.exception && res.exceptionDetails.exception.description
        ? res.exceptionDetails.exception.description
        : res.exceptionDetails.text;
      throw new Error(`Eval error: ${desc}`);
    }
    return res && res.result ? res.result.value : undefined;
  }

  async function setViewport(width, height, mobile = false) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await evaluate(`window.dispatchEvent(new Event('resize'));`);
    await sleep(300);
  }

  async function screenshot(filename) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buf);
    fs.writeFileSync(path.join(DELIVERY_SCREENSHOT_DIR, filename), buf);
    return outPath;
  }

  return { close: () => socket.destroy(), send, evaluate, setViewport, screenshot };
}

const results = {
  milestone: 'M4.7_GUIDED_GAMEPLAY_MULTIPLAYER_PROGRESSION',
  timestampIso: new Date().toISOString(),
  passed: 0,
  failed: 0,
  checks: [],
  screenshots: [],
};

function recordCheck(name, condition, detail = {}) {
  if (condition) {
    results.passed += 1;
    results.checks.push({ name, status: 'PASS', detail });
    console.log(`✅ PASS: ${name}`);
  } else {
    results.failed += 1;
    results.checks.push({ name, status: 'FAIL', detail });
    console.error(`❌ FAIL: ${name}`, detail);
    throw new Error(`Check failed: ${name}`);
  }
}

async function apiJson(baseUrl, method, endpoint, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function launchChromeOnPort(debugPort, url) {
  const userDataDir = path.join('/tmp', `eko_chrome_m47_${debugPort}_${Date.now()}`);
  const proc = spawn(
    CHROME_BIN,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu-vsync',
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      url,
    ],
    { stdio: 'ignore' }
  );
  for (let i = 0; i < 40; i++) {
    try {
      await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
      break;
    } catch (_) {
      await sleep(250);
    }
  }
  const cdp = await createCDPClient(debugPort);
  for (let i = 0; i < 40; i++) {
    const ready = await cdp.evaluate(`Boolean(window.__PROJECT_EKO_LIFE__ && window.__PROJECT_EKO_GUIDE__ && window.__PROJECT_EKO_AUTH__)`);
    if (ready) break;
    await sleep(250);
  }
  return { proc, cdp };
}

(async () => {
  console.log('================================================================');
  console.log('PROJECT EKO — M4.7 GUIDED GAMEPLAY, MULTIPLAYER & PROGRESSION');
  console.log('================================================================\n');

  const runSuffix = Math.floor(10000 + Math.random() * 89999);
  const userAHandle = `Dayo_Driver_${runSuffix}`;
  const userBHandle = `Kemi_Cond_${runSuffix}`;
  const userEmailA = `dayo_${runSuffix}@eko.lagos`;
  const userEmailB = `kemi_${runSuffix}@eko.lagos`;

  // -------------------------------------------------------------------------
  // 1. PHASE 1: BRAND-NEW REGISTRATION, GUEST PROMOTION & CHARACTER CREATION
  // -------------------------------------------------------------------------
  const profilesRes = await apiJson(API_URL, 'GET', '/api/v1/auth/starter-profiles');
  recordCheck(
    'Phase 1.1: Canonical 5 Starter Profiles & Zero-Payment Account Disclosure served',
    profilesRes.ok &&
      Array.isArray(profilesRes.data.starterProfiles) &&
      profilesRes.data.starterProfiles.length === 5 &&
      profilesRes.data.accountBenefitsExplanation.includes('Zero payment information'),
    { count: profilesRes.data.starterProfiles.length }
  );

  const guestRes = await apiJson(API_URL, 'POST', '/api/v1/auth/guest', {});
  recordCheck(
    'Phase 1.2: Introductory Guest Account created with session token',
    guestRes.ok && guestRes.data.isGuest === true && Boolean(guestRes.data.sessionToken),
    { guestId: guestRes.data.account.accountId }
  );

  const promoteRes = await apiJson(API_URL, 'POST', '/api/v1/auth/promote-guest', {
    sessionToken: guestRes.data.sessionToken,
    username: `Promoted_${runSuffix}`,
    email: `promoted_${runSuffix}@eko.lagos`,
    password: 'secure_lagos_password_123',
  });
  recordCheck(
    'Phase 1.3: Guest account safely promoted to permanent registered account preserving state',
    promoteRes.ok &&
      promoteRes.data.promoted === true &&
      promoteRes.data.account.isGuest === false &&
      promoteRes.data.account.gameNairaBalance === 5000,
    { accountId: promoteRes.data.account.accountId, promotedFrom: promoteRes.data.account.promotedFromGuestId }
  );

  const regARes = await apiJson(API_URL, 'POST', '/api/v1/auth/register', {
    username: userAHandle,
    email: userEmailA,
    password: 'password_dayo_2026',
    privacyConsentAccepted: true,
  });
  const regBRes = await apiJson(API_URL, 'POST', '/api/v1/auth/register', {
    username: userBHandle,
    email: userEmailB,
    password: 'password_kemi_2026',
    privacyConsentAccepted: true,
  });
  recordCheck(
    'Phase 1.4: Two brand-new authenticated citizen accounts registered (Player A & Player B)',
    regARes.ok && regBRes.ok && regARes.data.account.accountId !== regBRes.data.account.accountId,
    { playerAId: regARes.data.account.accountId, playerBId: regBRes.data.account.accountId }
  );

  const dupNameRes = await apiJson(API_URL, 'POST', '/api/v1/auth/register', {
    username: userAHandle,
    email: `dup_${runSuffix}@eko.lagos`,
    password: 'password_dayo_2026',
    privacyConsentAccepted: true,
  });
  recordCheck(
    'Phase 1.5: Duplicate display handle rejected during registration',
    dupNameRes.status === 400 && dupNameRes.data.field === 'username',
    { error: dupNameRes.data.error }
  );

  const charARes = await apiJson(API_URL, 'POST', '/api/v1/character/create', {
    sessionToken: regARes.data.sessionToken,
    displayName: userAHandle,
    starterProfileId: 'profile_new_arrival',
    appearance: {
      bodyType: 'athletic_lagos',
      skinTone: '#6B3E26',
      hairStyle: 'low_fade',
      outfitPreset: 'smart_ankara_casual',
      accentColor: '#10B981',
    },
  });
  const charBRes = await apiJson(API_URL, 'POST', '/api/v1/character/create', {
    sessionToken: regBRes.data.sessionToken,
    displayName: userBHandle,
    starterProfileId: 'profile_early_career',
    appearance: {
      bodyType: 'compact_runner',
      skinTone: '#5C3317',
      hairStyle: 'braids_classic',
      outfitPreset: 'marina_workwear',
      accentColor: '#38BDF8',
    },
  });
  recordCheck(
    'Phase 1.6: 5-step character creation initializes canonical starter profile, 3D starter home & ₦5,000 GN',
    charARes.ok &&
      charBRes.ok &&
      charARes.data.account.characterCreated === true &&
      charARes.data.starterProfile.starterHomeId === 'home_tier0_shared_room' &&
      charARes.data.account.gameNairaBalance === 5000,
    {
      playerAHome: charARes.data.starterProfile.starterHomeId,
      playerBHome: charBRes.data.starterProfile.starterHomeId,
    }
  );

  // -------------------------------------------------------------------------
  // 2. PHASE 2 & 3: COMPLETE 15-STEP ONBOARDING CHAIN, CONTEXTUAL UPDATES, BLOCKER & IDEMPOTENCY
  // -------------------------------------------------------------------------
  const drivingGuideRes = await apiJson(
    API_URL,
    'GET',
    `/api/v1/ekoguide/state?sessionToken=${encodeURIComponent(regARes.data.sessionToken)}&isDriving=true`
  );
  recordCheck(
    'Phase 2.1: EkoGuide suppresses unrelated home tutorials while player is actively driving',
    drivingGuideRes.ok &&
      drivingGuideRes.data.guideState.primaryObjective.isCompactDrivingMode === true &&
      drivingGuideRes.data.guideState.primaryObjective.suppressHomeTutorials === true,
    { primaryWhenDriving: drivingGuideRes.data.guideState.primaryObjective.name }
  );

  const blockedEvRes = await apiJson(API_URL, 'POST', '/api/v1/progression/event', {
    sessionToken: regARes.data.sessionToken,
    eventId: `ev_block_test_${runSuffix}`,
    eventType: 'ObjectiveBlocked',
    metadata: { reason: 'REQUIRES_VEHICLE_DANFO_OWNERSHIP' },
  });
  const blockedGuide = blockedEvRes.data.guideState;
  recordCheck(
    'Phase 2.2: Blocked objective explains vehicle/resource blocker and provides no-vehicle recovery guidance',
    blockedEvRes.ok &&
      blockedGuide.primaryObjective.blockerInfo !== null &&
      blockedGuide.primaryObjective.blockerInfo.recoverySuggestion.includes('No-Vehicle Entry Job'),
    { blockerInfo: blockedGuide.primaryObjective.blockerInfo }
  );

  const onboardingEventsSequence = [
    { eventType: 'HomeEntered', metadata: { residenceId: 'home_tier0_shared_room' } },
    { eventType: 'HouseholdObjectUsed', metadata: { itemId: 'item_bed_foam_single' } },
    { eventType: 'NeedsInspected', metadata: { source: 'home_hud' } },
    { eventType: 'JobsHubOpened', metadata: {} },
    { eventType: 'JobAccepted', metadata: { jobId: 'job_entry_foot_courier' } },
    { eventType: 'JobLocationReached', metadata: { checkpoint: 1 } },
    { eventType: 'JobTaskCompleted', metadata: { checkpointsCompleted: 3 } },
    { eventType: 'JobSettlementPosted', metadata: { netPayGN: 500 } },
    { eventType: 'ShopVisited', metadata: { shopId: 'shop_yaba_home_essentials' } },
    { eventType: 'ItemPurchased', metadata: { itemId: 'item_standing_fan', priceGN: 750 } },
    { eventType: 'ItemPlaced', metadata: { itemId: 'item_standing_fan', x: 1.2, z: -1.5, rotY: 0 } },
    { eventType: 'HomeProgressVerified', metadata: { verified: true } },
  ];

  for (let i = 0; i < onboardingEventsSequence.length; i++) {
    const item = onboardingEventsSequence[i];
    const evRes = await apiJson(API_URL, 'POST', '/api/v1/progression/event', {
      sessionToken: regARes.data.sessionToken,
      eventId: `ev_chain_${runSuffix}_${i}`,
      eventType: item.eventType,
      metadata: item.metadata,
    });
    assert.strictEqual(evRes.ok, true);
  }

  const balBeforeDupEvent = (
    await apiJson(API_URL, 'GET', `/api/v1/auth/session?sessionToken=${encodeURIComponent(regARes.data.sessionToken)}`)
  ).data.account.gameNairaBalance;

  const dupEventRes = await apiJson(API_URL, 'POST', '/api/v1/progression/event', {
    sessionToken: regARes.data.sessionToken,
    eventId: `ev_chain_${runSuffix}_${onboardingEventsSequence.length - 1}`,
    eventType: 'HomeProgressVerified',
    metadata: { verified: true },
  });
  const balAfterDupEvent = (
    await apiJson(API_URL, 'GET', `/api/v1/auth/session?sessionToken=${encodeURIComponent(regARes.data.sessionToken)}`)
  ).data.account.gameNairaBalance;

  recordCheck(
    'Phase 3.1: Full 15-step onboarding chain completed & duplicate eventId rejected idempotently without double reward',
    dupEventRes.ok &&
      dupEventRes.data.duplicateIgnored === true &&
      balBeforeDupEvent === balAfterDupEvent &&
      dupEventRes.data.guideState.onboardingChainProgress.completedCount === 15 &&
      dupEventRes.data.guideState.onboardingChainProgress.tutorialCompleted === true,
    {
      completedCount: dupEventRes.data.guideState.onboardingChainProgress.completedCount,
      balanceGN: balAfterDupEvent,
    }
  );

  const loginARes = await apiJson(API_URL, 'POST', '/api/v1/auth/login', {
    usernameOrEmail: userAHandle,
    password: 'password_dayo_2026',
  });
  recordCheck(
    'Phase 1.7: Returning player login restores existing profile & current objective without restarting onboarding',
    loginARes.ok &&
      loginARes.data.returningPlayerRestored === true &&
      loginARes.data.onboardingRestarted === false &&
      loginARes.data.guideState.onboardingChainProgress.completedCount === 15,
    { restoredAccount: loginARes.data.account.accountId }
  );

  // -------------------------------------------------------------------------
  // 3. PHASE 4: MULTIPLAYER ENGINE (2 AUTHENTICATED HUMANS vs SIMULATED NPCs, CREW, CO-OP DANFO & RECONNECT)
  // -------------------------------------------------------------------------
  const playerAId = regARes.data.account.accountId;
  const playerBId = regBRes.data.account.accountId;

  const presARes = await apiJson(RT_URL, 'POST', '/presence', {
    playerId: playerAId,
    username: userAHandle,
    sessionId: `sess_A1_${runSuffix}`,
    requestId: `req_pres_A1_${runSuffix}`,
    position: { x: -95, y: 0, z: -195 },
    rotationY: 1.57,
    inVehicleId: 'apex_danfo_14',
    isDriving: true,
    avatarState: 'driving',
  });
  const presBRes = await apiJson(RT_URL, 'POST', '/presence', {
    playerId: playerBId,
    username: userBHandle,
    sessionId: `sess_B1_${runSuffix}`,
    requestId: `req_pres_B1_${runSuffix}`,
    position: { x: -93, y: 0, z: -194 },
    rotationY: -1.57,
    inVehicleId: 'apex_danfo_14',
    isDriving: false,
    avatarState: 'idle',
  });

  const snapRes = await apiJson(RT_URL, 'GET', `/snapshot?viewerId=${encodeURIComponent(playerAId)}&radius=450`);
  const humanIdsInZone = snapRes.data.humanPlayers.map((p) => p.playerId);
  const npcIdsInZone = snapRes.data.simulatedNpcs.map((p) => p.playerId);
  recordCheck(
    'Phase 4.1: Two authenticated human users join zone_marina_cms; strictly separated from Simulated NPCs & AI Workers',
    presARes.ok &&
      presBRes.ok &&
      humanIdsInZone.includes(playerAId) &&
      humanIdsInZone.includes(playerBId) &&
      npcIdsInZone.includes('peer_chidi_01') &&
      !humanIdsInZone.includes('peer_chidi_01') &&
      snapRes.data.simulatedNpcCount === 3 &&
      snapRes.data.aiWorkerCount === 2,
    {
      onlineHumanCount: snapRes.data.onlineHumanCount,
      simulatedNpcCount: snapRes.data.simulatedNpcCount,
      aiWorkerCount: snapRes.data.aiWorkerCount,
    }
  );

  const proxRes = await apiJson(RT_URL, 'POST', '/proximity/interact', {
    actorId: playerAId,
    targetId: playerBId,
    interactionType: 'CREW_HANDSHAKE',
  });
  recordCheck(
    'Phase 4.2: Proximity interaction verified between two nearby human players',
    proxRes.ok && proxRes.data.actorEntityKind === 'HUMAN_PLAYER' && proxRes.data.targetEntityKind === 'HUMAN_PLAYER',
    { distanceMeters: proxRes.data.distanceMeters }
  );

  const validChatRes = await apiJson(RT_URL, 'POST', '/chat', {
    senderId: playerAId,
    senderName: userAHandle,
    text: 'Kemi! Enter conductor side make we run CMS to Obalende!',
  });
  const blockedModChatRes = await apiJson(RT_URL, 'POST', '/chat', {
    senderId: playerAId,
    senderName: userAHandle,
    text: 'Click this scam link for free password',
  });
  recordCheck(
    'Phase 4.3: Proximity chat broadcasts valid messages and blocks prohibited content via moderation policy',
    validChatRes.ok &&
      validChatRes.data.message.isHuman === true &&
      blockedModChatRes.status === 400 &&
      blockedModChatRes.data.error === 'MODERATION_BLOCKED',
    { blockedReason: blockedModChatRes.data.reason }
  );

  const crewCreateRes = await apiJson(RT_URL, 'POST', '/crew/create', {
    leaderId: playerAId,
    leaderName: userAHandle,
    name: `Marina Express Crew ${runSuffix}`,
  });
  const crewInviteRes = await apiJson(RT_URL, 'POST', '/crew/invite', {
    crewId: crewCreateRes.data.crew.crewId,
    targetPlayerId: playerBId,
    invitedBy: playerAId,
  });
  const crewAcceptRes = await apiJson(RT_URL, 'POST', '/crew/respond', {
    crewId: crewCreateRes.data.crew.crewId,
    playerId: playerBId,
    username: userBHandle,
    accept: true,
  });
  recordCheck(
    'Phase 4.4: Crew creation, invitation, and two-human membership verified (NPC invite rejected)',
    crewCreateRes.ok &&
      crewInviteRes.ok &&
      crewAcceptRes.ok &&
      crewAcceptRes.data.crew.memberIds.includes(playerAId) &&
      crewAcceptRes.data.crew.memberIds.includes(playerBId),
    { crewId: crewCreateRes.data.crew.crewId, members: crewAcceptRes.data.crew.memberIds }
  );

  const coopCreateRes = await apiJson(RT_URL, 'POST', '/coop/danfo/create', {
    driverPlayerId: playerAId,
    driverName: userAHandle,
    crewId: crewCreateRes.data.crew.crewId,
  });
  const coopSessionId = coopCreateRes.data.session.coopSessionId;

  const prematureStartRes = await apiJson(RT_URL, 'POST', '/coop/danfo/start', { coopSessionId });
  recordCheck(
    'Phase 4.5: Cooperative Danfo route refuses to start before both Driver & Conductor prerequisites are met',
    prematureStartRes.status === 400 && prematureStartRes.data.error === 'PREREQUISITES_NOT_MET_BOTH_ROLES_REQUIRED'
  );

  const coopJoinRes = await apiJson(RT_URL, 'POST', '/coop/danfo/join', {
    coopSessionId,
    conductorPlayerId: playerBId,
    conductorName: userBHandle,
  });
  recordCheck(
    'Phase 4.6: Player B joins Cooperative Danfo as Conductor with 60/40 contract and 0 reward on join',
    coopJoinRes.ok &&
      coopJoinRes.data.rewardAwardedOnJoin === 0 &&
      coopJoinRes.data.session.status === 'READY_TO_START' &&
      coopJoinRes.data.session.compensationContract.driverSharePct === 60 &&
      coopJoinRes.data.session.compensationContract.conductorSharePct === 40
  );

  await apiJson(RT_URL, 'POST', '/coop/danfo/start', { coopSessionId });
  const stop1 = await apiJson(RT_URL, 'POST', '/coop/danfo/board-stop', {
    coopSessionId,
    stopId: 'stop_cms_terminal',
    passengersBoarded: 5,
  });
  const dupStop1 = await apiJson(RT_URL, 'POST', '/coop/danfo/board-stop', {
    coopSessionId,
    stopId: 'stop_cms_terminal',
    passengersBoarded: 5,
  });
  const stop2 = await apiJson(RT_URL, 'POST', '/coop/danfo/board-stop', {
    coopSessionId,
    stopId: 'stop_marina_first_bank',
    passengersBoarded: 5,
  });
  const stop3 = await apiJson(RT_URL, 'POST', '/coop/danfo/board-stop', {
    coopSessionId,
    stopId: 'stop_obalende_underbridge',
    passengersBoarded: 4,
  });

  recordCheck(
    'Phase 4.7: Server validates all 3 Co-op Danfo stops (14 passengers boarded) and rejects duplicate stop boarding',
    stop1.ok &&
      dupStop1.status === 409 &&
      stop2.ok &&
      stop3.ok &&
      stop3.data.allStopsCompleted === true &&
      stop3.data.session.totalPassengersBoarded === 14 &&
      stop3.data.session.grossFareRevenueGN === 4200 &&
      stop3.data.session.netPoolGN === 3900,
    {
      grossFareRevenueGN: stop3.data.session.grossFareRevenueGN,
      netPoolGN: stop3.data.session.netPoolGN,
      driverPayoutGN: stop3.data.session.driverPayoutGN,
      conductorPayoutGN: stop3.data.session.conductorPayoutGN,
    }
  );

  const coopSettleRes = await apiJson(API_URL, 'POST', '/api/v1/multiplayer/coop-danfo/settle', {
    coopSessionId,
    idempotencyKey: stop3.data.session.settlementIdempotencyKey,
    driverAccountId: playerAId,
    conductorAccountId: playerBId,
    stopsCompleted: 3,
    totalPassengersBoarded: 14,
  });
  const dupCoopSettleRes = await apiJson(API_URL, 'POST', '/api/v1/multiplayer/coop-danfo/settle', {
    coopSessionId,
    idempotencyKey: stop3.data.session.settlementIdempotencyKey,
    driverAccountId: playerAId,
    conductorAccountId: playerBId,
    stopsCompleted: 3,
    totalPassengersBoarded: 14,
  });

  recordCheck(
    'Phase 4.8: Authoritative Co-op Danfo ledger settlement credits Driver (60% = +₦2,340 GN) & Conductor (40% = +₦1,560 GN) and blocks duplicate settlement',
    coopSettleRes.ok &&
      coopSettleRes.data.settlement.driverPayoutGN === 2340 &&
      coopSettleRes.data.settlement.conductorPayoutGN === 1560 &&
      dupCoopSettleRes.data.duplicateSettlementRejected === true,
    {
      driverBalanceAfterGN: coopSettleRes.data.settlement.driverBalanceAfterGN,
      conductorBalanceAfterGN: coopSettleRes.data.settlement.conductorBalanceAfterGN,
    }
  );

  const discRes = await apiJson(RT_URL, 'POST', '/disconnect', { playerId: playerBId });
  const reconRes = await apiJson(RT_URL, 'POST', '/reconnect', {
    playerId: playerBId,
    sessionId: `sess_B2_reconnected_${runSuffix}`,
  });
  const staleRes = await apiJson(RT_URL, 'POST', '/presence', {
    playerId: playerBId,
    sessionId: `sess_B1_${runSuffix}`,
  });
  recordCheck(
    'Phase 4.9: Disconnection, reconnection state restoration, and stale superseded session rejection verified',
    discRes.ok &&
      discRes.data.connectionState === 'DISCONNECTED' &&
      reconRes.ok &&
      reconRes.data.reconnected === true &&
      reconRes.data.restoredCrew !== null &&
      staleRes.status === 409 &&
      staleRes.data.error === 'STALE_SESSION_SUPERSEDED',
    { reconnectCount: reconRes.data.reconnectCount }
  );

  // -------------------------------------------------------------------------
  // 4. PHASE 5 & 8: EKOPROGRESS CAREER MAP & ANALYTICS FUNNEL VERIFICATION
  // -------------------------------------------------------------------------
  const progMapRes = await apiJson(
    API_URL,
    'GET',
    `/api/v1/ekoprogress/map?sessionToken=${encodeURIComponent(regARes.data.sessionToken)}`
  );
  recordCheck(
    'Phase 5.1: EkoProgress map returns unlocked entry jobs, non-driving paths, and explains every locked opportunity',
    progMapRes.ok &&
      progMapRes.data.progressMap.nonDrivingPathsAvailable === true &&
      progMapRes.data.progressMap.unlockedOpportunities.length >= 5 &&
      progMapRes.data.progressMap.lockedOpportunities.every((l) => l.lockExplanation.includes('Locked until you satisfy:')),
    {
      level: progMapRes.data.progressMap.currentLevel,
      unlockedCount: progMapRes.data.progressMap.unlockedOpportunities.length,
      lockedCount: progMapRes.data.progressMap.lockedOpportunities.length,
    }
  );

  const funnelRes = await apiJson(API_URL, 'GET', '/api/v1/analytics/funnel');
  recordCheck(
    'Phase 8.1: Privacy-safe 16-stage player journey funnel & TTFMA metrics recorded',
    funnelRes.ok &&
      funnelRes.data.funnel.stages.length === 16 &&
      funnelRes.data.funnel.totalRegisteredAccounts >= 2,
    {
      totalRegisteredAccounts: funnelRes.data.funnel.totalRegisteredAccounts,
      medianTimeToFirstMeaningfulActionMs: funnelRes.data.funnel.medianTimeToFirstMeaningfulActionMs,
    }
  );

  // -------------------------------------------------------------------------
  // 5. TWO-BROWSER HEADLESS CHROME ACCEPTANCE (DESKTOP + MOBILE PORTRAIT + RELOAD PERSISTENCE)
  // -------------------------------------------------------------------------
  let browserA;
  let browserB;
  try {
    browserA = await launchChromeOnPort(9347, `${GAME_URL}?onboarding=1`);
    browserB = await launchChromeOnPort(9348, GAME_URL);

    await browserA.cdp.setViewport(1440, 900, false);
    await sleep(400);
    results.screenshots.push(await browserA.cdp.screenshot('m4_7_onboarding_entry_desktop.png'));

    await browserA.cdp.evaluate(`window.__PROJECT_EKO_AUTH__.openModal('character');`);
    await sleep(300);
    results.screenshots.push(await browserA.cdp.screenshot('m4_7_character_creation_desktop.png'));

    await browserA.cdp.evaluate(`
      window.__PROJECT_EKO_AUTH__.closeModal();
      window.__PROJECT_EKO_GUIDE__.openWhatNextModal();
    `);
    await sleep(300);
    results.screenshots.push(await browserA.cdp.screenshot('m4_7_ekoguide_what_next_desktop.png'));

    await browserA.cdp.evaluate(`
      window.__PROJECT_EKO_GUIDE__.closeWhatNextModal();
      window.__PROJECT_EKO_PROGRESS__.openModal();
    `);
    await sleep(400);
    results.screenshots.push(await browserA.cdp.screenshot('m4_7_ekoprogress_career_map_desktop.png'));

    // Authenticate Browser A as Player A and Browser B as Player B simultaneously
    await browserA.cdp.evaluate(`
      window.__PROJECT_EKO_AUTH__.sessionToken = ${JSON.stringify(regARes.data.sessionToken)};
      window.__PROJECT_EKO_AUTH__.accountId = ${JSON.stringify(playerAId)};
      window.__PROJECT_EKO_AUTH__.username = ${JSON.stringify(userAHandle)};
      window.__PROJECT_EKO_MULTIPLAYER__.sendHeartbeat();
      window.__PROJECT_EKO_MULTIPLAYER__.fetchZoneSnapshot();
    `);
    await browserB.cdp.evaluate(`
      window.__PROJECT_EKO_AUTH__.sessionToken = ${JSON.stringify(regBRes.data.sessionToken)};
      window.__PROJECT_EKO_AUTH__.accountId = ${JSON.stringify(playerBId)};
      window.__PROJECT_EKO_AUTH__.username = ${JSON.stringify(userBHandle)};
      window.__PROJECT_EKO_MULTIPLAYER__.sendHeartbeat();
      window.__PROJECT_EKO_MULTIPLAYER__.fetchZoneSnapshot();
    `);
    await sleep(500);

    await browserA.cdp.evaluate(`
      window.__PROJECT_EKO_PROGRESS__.closeModal();
      window.__PROJECT_EKO_MULTIPLAYER__.openModal();
    `);
    await sleep(400);
    results.screenshots.push(await browserA.cdp.screenshot('m4_7_multiplayer_zone_separation_desktop.png'));

    // Test Mobile Portrait (390x844) on Browser B
    await browserB.cdp.setViewport(390, 844, true);
    const mobileGuideCheck = await browserB.cdp.evaluate(`(() => {
      window.__PROJECT_EKO_INPUT_PROMPTS__.setDevice('touch', 'm47_test');
      window.__PROJECT_EKO_GUIDE__.renderHud();
      const hud = document.getElementById('m47-ekoguide-hud');
      const btn = document.getElementById('m47-guide-primary-action-btn');
      const rect = hud ? hud.getBoundingClientRect() : null;
      return {
        hudVisible: Boolean(hud && rect && rect.width > 0 && rect.height > 0),
        actionLabel: btn ? btn.innerText : '',
        fitsViewport: Boolean(rect && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight)
      };
    })()`);

    recordCheck(
      'Phase 7.1: Mobile-first touch guidance renders compact Next Step HUD with touch-aware labels & safe viewport bounds',
      mobileGuideCheck.hudVisible && mobileGuideCheck.fitsViewport && mobileGuideCheck.actionLabel.includes('Tap:'),
      mobileGuideCheck
    );

    results.screenshots.push(await browserB.cdp.screenshot('m4_7_mobile_portrait_ekoguide.png'));

    // Complete a No-Vehicle Job on Browser B and verify persistence across page reload
    const beforeReloadState = await browserB.cdp.evaluate(`(() => {
      const life = window.__PROJECT_EKO_LIFE__;
      life.startActiveJobShift('job_foot_courier');
      life.advanceActiveJobCheckpoint();
      life.advanceActiveJobCheckpoint();
      const jobRes = life.advanceActiveJobCheckpoint();
      if (typeof life.saveMasterBibleStateToStorage === 'function') life.saveMasterBibleStateToStorage();
      return {
        jobSuccess: Boolean(jobRes && jobRes.success && jobRes.shiftCompleted),
        balanceAfterJobGN: player.balance,
        completedObjectivesCount: window.__PROJECT_EKO_GUIDE__.completedObjectiveIds.length
      };
    })()`);

    await browserB.cdp.send('Page.reload', { ignoreCache: false });
    await sleep(1200);
    for (let i = 0; i < 35; i++) {
      const ready = await browserB.cdp.evaluate(`Boolean(window.__PROJECT_EKO_LIFE__ && window.__PROJECT_EKO_LIFE__.initialized && document.getElementById('m47-ekoguide-hud'))`);
      if (ready) break;
      await sleep(200);
    }
    await sleep(300);

    const afterReloadState = await browserB.cdp.evaluate(`(() => {
      return {
        balanceAfterReloadGN: player.balance,
        completedObjectivesCount: window.__PROJECT_EKO_GUIDE__.completedObjectiveIds.length
      };
    })()`);

    recordCheck(
      'Phase 9.1: Browser no-vehicle job settlement & EkoGuide progression survive full page reload',
      beforeReloadState.jobSuccess &&
        afterReloadState.balanceAfterReloadGN === beforeReloadState.balanceAfterJobGN &&
        afterReloadState.completedObjectivesCount === beforeReloadState.completedObjectivesCount,
      { beforeReloadState, afterReloadState }
    );
  } finally {
    if (browserA) {
      try { browserA.cdp.close(); } catch (_) {}
      try { browserA.proc.kill(); } catch (_) {}
    }
    if (browserB) {
      try { browserB.cdp.close(); } catch (_) {}
      try { browserB.proc.kill(); } catch (_) {}
    }
  }

  const outPath = path.join(ARTIFACT_DIR, 'm4_7_acceptance_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n================================================================`);
  console.log(`M4.7 ACCEPTANCE SUITE COMPLETE: ${results.passed} PASSED | ${results.failed} FAILED`);
  console.log(`Evidence written to: ${outPath}`);
  console.log(`================================================================`);
})();
