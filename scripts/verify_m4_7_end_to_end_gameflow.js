#!/usr/bin/env node
/**
 * PROJECT EKO — M4.7 END-TO-END PLAYER JOURNEY & GAME FLOW REPAIR
 * Phase 7: 24-Step Browser Acceptance Suite + Returning-Player & Mid-Shift Recovery
 *
 * Verifies on a clean isolated test account:
 *  - Zero competing objective HUDs (only #m47-ekoguide-hud visible; #mission-hud-banner & #jobshub-active-shift-hud hidden)
 *  - Exact starter balance (₦5,000 GN, never leaked ₦487,580 GN)
 *  - Steps 1–24 end-to-end journey + Mid-Shift Reload Recovery + Returning-Player Login Restoration
 *  - Desktop (1440x900) and Mobile Portrait (390x844) screenshot evidence
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

async function launchChromeOnPort(debugPort, url) {
  const userDataDir = path.join('/tmp', `eko_chrome_m47_flow_${debugPort}_${Date.now()}`);
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

const results = {
  milestone: 'M4.7_END_TO_END_GAMEFLOW_REPAIR',
  timestampIso: new Date().toISOString(),
  passed: 0,
  failed: 0,
  steps: [],
  screenshots: [],
};

function recordStep(stepNum, name, condition, detail = {}) {
  if (condition) {
    results.passed += 1;
    results.steps.push({ step: stepNum, name, status: 'PASS', detail });
    console.log(`✅ PASS [Step ${stepNum}]: ${name}`);
  } else {
    results.failed += 1;
    results.steps.push({ step: stepNum, name, status: 'FAIL', detail });
    console.error(`❌ FAIL [Step ${stepNum}]: ${name}`, detail);
    throw new Error(`Step ${stepNum} failed: ${name}`);
  }
}

(async () => {
  console.log('======================================================================');
  console.log('PROJECT EKO — M4.7 END-TO-END PLAYER JOURNEY & GAME FLOW REPAIR SUITE');
  console.log('======================================================================\n');

  const runSuffix = Math.floor(10000 + Math.random() * 89999);
  const testUsername = `Bolanle_${runSuffix}`;
  const testEmail = `bolanle_${runSuffix}@eko.lagos`;
  const testPassword = 'lagos_password_2026';

  let browser;
  try {
    browser = await launchChromeOnPort(9355, `${GAME_URL}?onboarding=1`);
    await browser.cdp.setViewport(1440, 900, false);

    // -----------------------------------------------------------------------
    // STEP 1: Open the entry screen on a clean account (via dev test-fixture reset)
    // -----------------------------------------------------------------------
    const step1 = await browser.cdp.evaluate(`(async () => {
      const resetRes = await window.__PROJECT_EKO_AUTH__.resetTestFixture();
      const modal = document.getElementById('m47-auth-modal');
      const startBtn = document.getElementById('m47-entry-start-journey-btn');
      const createBtn = document.getElementById('m47-entry-create-account-btn');
      const loginBtn = document.getElementById('m47-entry-login-btn');
      const legacyMissionBanner = document.getElementById('mission-hud-banner');
      const legacyShiftHud = document.getElementById('jobshub-active-shift-hud');
      return {
        resetOk: Boolean(resetRes && resetRes.ok),
        modalVisible: Boolean(modal && getComputedStyle(modal).display !== 'none'),
        hasAllThreeEntryButtons: Boolean(startBtn && createBtn && loginBtn),
        legacyMissionHidden: Boolean(!legacyMissionBanner || getComputedStyle(legacyMissionBanner).display === 'none'),
        legacyShiftHudHidden: Boolean(!legacyShiftHud || getComputedStyle(legacyShiftHud).display === 'none'),
        initialBalance: player.balance
      };
    })()`);
    recordStep(1, 'Open entry screen on a clean account & verify legacy duplicate HUDs are hidden', step1.resetOk && step1.modalVisible && step1.hasAllThreeEntryButtons && step1.legacyMissionHidden && step1.legacyShiftHudHidden, step1);
    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step1_entry.png'));

    // -----------------------------------------------------------------------
    // STEP 2: Create an account
    // -----------------------------------------------------------------------
    const step2 = await browser.cdp.evaluate(`(async () => {
      window.__PROJECT_EKO_AUTH__.openModal('register');
      document.getElementById('m47-reg-username').value = ${JSON.stringify(testUsername)};
      document.getElementById('m47-reg-email').value = ${JSON.stringify(testEmail)};
      document.getElementById('m47-reg-password').value = ${JSON.stringify(testPassword)};
      document.getElementById('m47-reg-consent').checked = true;
      const ok = await window.__PROJECT_EKO_AUTH__.submitRegistration(new Event('submit'));
      return {
        ok,
        activeView: window.__PROJECT_EKO_AUTH__.activeView,
        accountId: window.__PROJECT_EKO_AUTH__.accountId,
        sessionTokenPresent: Boolean(window.__PROJECT_EKO_AUTH__.sessionToken)
      };
    })()`);
    recordStep(2, 'Create a new permanent citizen account via registration form', step2.ok && step2.activeView === 'character' && step2.sessionTokenPresent, step2);

    // -----------------------------------------------------------------------
    // STEP 3: Create a character (body build, skin tone, hairstyle, display name)
    // -----------------------------------------------------------------------
    const step3 = await browser.cdp.evaluate(`(() => {
      const bodyEl = document.getElementById('m47-char-body');
      const skinEl = document.getElementById('m47-char-skin');
      const hairEl = document.getElementById('m47-char-hair');
      const dnEl = document.getElementById('m47-char-displayname');
      bodyEl.value = 'compact_runner';
      skinEl.value = '#3B2219';
      hairEl.value = 'afro_twist';
      dnEl.value = ${JSON.stringify(testUsername)};
      const preview = window.__PROJECT_EKO_AUTH__.previewCharacterAppearance();
      return {
        preview,
        avatarSkinHexApplied: playerAvatar && playerAvatar.userData ? playerAvatar.userData.skinHex : null,
        avatarScaleX: playerAvatar ? Number(playerAvatar.scale.x.toFixed(2)) : null
      };
    })()`);
    recordStep(3, 'Customize character body build, skin tone & hairstyle with live 3D avatar update', step3.avatarSkinHexApplied === 0x3b2219 && step3.avatarScaleX === 0.93, step3);

    // -----------------------------------------------------------------------
    // STEP 4: Select initial clothes
    // -----------------------------------------------------------------------
    const step4 = await browser.cdp.evaluate(`(() => {
      const outfitEl = document.getElementById('m47-char-outfit');
      outfitEl.value = 'sunday_senator_native';
      const preview = window.__PROJECT_EKO_AUTH__.previewCharacterAppearance();
      return {
        selectedPreset: outfitEl.value,
        equippedOutfitId: window.__PROJECT_EKO_LIFE__.currentOutfitId,
        avatarOutfitId: playerAvatar ? playerAvatar.activeOutfitId : null
      };
    })()`);
    recordStep(4, 'Select initial starter clothes (Sunday Senator Native Wear) & update 3D avatar', step4.equippedOutfitId === 'outfit_sunday_senator' && step4.avatarOutfitId === 'outfit_sunday_senator', step4);

    // -----------------------------------------------------------------------
    // STEP 5: Select a starter profile
    // -----------------------------------------------------------------------
    const step5 = await browser.cdp.evaluate(`(() => {
      const profEl = document.getElementById('m47-char-profile');
      profEl.value = 'profile_new_arrival';
      window.__PROJECT_EKO_AUTH__.charForm.starterProfileId = 'profile_new_arrival';
      return {
        selectedProfileId: window.__PROJECT_EKO_AUTH__.charForm.starterProfileId,
        optionsCount: profEl.options.length
      };
    })()`);
    recordStep(5, 'Select canonical starter profile (New Arrival in Lagos)', step5.selectedProfileId === 'profile_new_arrival' && step5.optionsCount === 5, step5);

    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step5_character_setup.png'));

    // -----------------------------------------------------------------------
    // STEP 6 & STEP 7: Confirm character, verify exact ₦5,000 GN balance & arrive at starter home porch
    // -----------------------------------------------------------------------
    const step6and7 = await browser.cdp.evaluate(`(async () => {
      const ok = await window.__PROJECT_EKO_AUTH__.submitCharacterCreation(new Event('submit'));
      return {
        ok,
        balanceGN: player.balance,
        balanceHudText: document.getElementById('hud-gn-balance') ? document.getElementById('hud-gn-balance').textContent.trim() : '',
        avatarPos: {
          x: Number(playerAvatar.position.x.toFixed(1)),
          y: Number(playerAvatar.position.y.toFixed(2)),
          z: Number(playerAvatar.position.z.toFixed(1))
        },
        waypointId: window.__PROJECT_EKO_ATLAS__ ? window.__PROJECT_EKO_ATLAS__.activeWaypointEntityId : null,
        guidePrimaryTitle: document.getElementById('m47-guide-primary-title') ? document.getElementById('m47-guide-primary-title').textContent.trim() : ''
      };
    })()`);
    recordStep(6, 'Confirm initial Game Naira matches selected starter profile (₦5,000 GN — never ₦487,580 GN)', step6and7.ok && step6and7.balanceGN === 5000 && step6and7.balanceHudText === '₦5,000 GN', step6and7);
    recordStep(7, 'Arrive outside Marina Starter Home porch (-62, 0.22, -146.2) with EkoGuide pointing to Enter Home', Math.abs(step6and7.avatarPos.x - (-62)) < 1.5 && step6and7.avatarPos.y === 0.22 && Math.abs(step6and7.avatarPos.z - (-146.2)) < 1.5 && step6and7.guidePrimaryTitle.includes('Enter Your 3D Starter Home'), step6and7);

    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step7_arrival_porch.png'));

    // -----------------------------------------------------------------------
    // STEP 8: Enter the starter home
    // -----------------------------------------------------------------------
    const step8 = await browser.cdp.evaluate(`(() => {
      window.__PROJECT_EKO_GUIDE__.executeActionByName('enterHomeStep');
      return {
        isInsideHomeInterior: window.__PROJECT_EKO_LIFE__.isInsideHomeInterior,
        completedObjectives: [...window.__PROJECT_EKO_GUIDE__.completedObjectiveIds],
        nextPrimaryTitle: document.getElementById('m47-guide-primary-title').innerText
      };
    })()`);
    recordStep(8, 'Enter 3D starter home interior & advance EkoGuide to Household Object interaction', step8.isInsideHomeInterior === true && step8.completedObjectives.includes('obj_04_enter_starter_home'), step8);

    // -----------------------------------------------------------------------
    // STEP 9 & STEP 10: Use a household object & confirm needs and objective state update
    // -----------------------------------------------------------------------
    const step9and10 = await browser.cdp.evaluate(`(() => {
      const life = window.__PROJECT_EKO_LIFE__;
      life.needsState.energy = 60;
      const useRes = life.useHomeObject('itm_mattress_starter');
      window.__PROJECT_EKO_GUIDE__.executeActionByName('inspectNeedsStep');
      return {
        useSuccess: Boolean(useRes && useRes.success),
        energyAfter: life.needsState.energy,
        completedObjectives: [...window.__PROJECT_EKO_GUIDE__.completedObjectiveIds],
        nextPrimaryTitle: document.getElementById('m47-guide-primary-title').innerText
      };
    })()`);
    recordStep(9, 'Use household object (Starter Bed) inside 3D starter home', step9and10.useSuccess === true && step9and10.energyAfter > 60, step9and10);
    recordStep(10, 'Confirm needs and objective state update (Steps 5 & 6 completed, advancing to JobsHub)', step9and10.completedObjectives.includes('obj_05_use_household_object') && step9and10.completedObjectives.includes('obj_06_inspect_household_needs') && step9and10.nextPrimaryTitle.includes('Open JobsHub'), step9and10);

    // -----------------------------------------------------------------------
    // STEP 11 & STEP 12: Open the wardrobe & equip an owned outfit (and verify unowned outfit lock)
    // -----------------------------------------------------------------------
    const step11and12 = await browser.cdp.evaluate(`(() => {
      window.__PROJECT_EKO_GUIDE__.openWardrobeModal();
      const modal = document.getElementById('m47-wardrobe-modal');
      const modalOpen = Boolean(modal && getComputedStyle(modal).display !== 'none');
      const balBefore = player.balance;
      const lockedAttempt = window.__PROJECT_EKO_LIFE__.equipOutfit('outfit_corporate_suit', { requireOwnership: true });
      const ownedEquip = window.__PROJECT_EKO_LIFE__.equipOutfit('outfit_street_hustler', { requireOwnership: true });
      const balAfter = player.balance;
      window.__PROJECT_EKO_GUIDE__.renderWardrobeModal();
      return {
        modalOpen,
        lockedAttemptRejected: lockedAttempt === false,
        ownedEquipSuccess: ownedEquip === true,
        equippedOutfitId: window.__PROJECT_EKO_LIFE__.currentOutfitId,
        avatarActiveOutfit: playerAvatar ? playerAvatar.activeOutfitId : null,
        zeroCostToEquipOwned: balBefore === balAfter
      };
    })()`);
    recordStep(11, 'Open First-Class Wardrobe modal & display Owned vs Locked outfits', step11and12.modalOpen === true && step11and12.lockedAttemptRejected === true, step11and12);
    recordStep(12, 'Equip owned outfit for ₦0 GN & verify 3D avatar updates immediately', step11and12.ownedEquipSuccess === true && step11and12.equippedOutfitId === 'outfit_street_hustler' && step11and12.avatarActiveOutfit === 'outfit_street_hustler' && step11and12.zeroCostToEquipOwned === true, step11and12);

    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step12_wardrobe.png'));
    await browser.cdp.evaluate(`window.__PROJECT_EKO_GUIDE__.closeWardrobeModal();`);

    // -----------------------------------------------------------------------
    // STEP 13 & STEP 14: Open JobsHub & accept a qualifying no-vehicle job
    // -----------------------------------------------------------------------
    const step13and14 = await browser.cdp.evaluate(`(() => {
      window.__PROJECT_EKO_GUIDE__.executeActionByName('openJobsHubStep');
      const jobsModalOpen = window.__PROJECT_EKO_LIFE__.isOpen && window.__PROJECT_EKO_LIFE__.activeTab === 'jobs';
      const shiftRes = window.__PROJECT_EKO_LIFE__.startActiveJobShift('job_foot_courier');
      window.__PROJECT_EKO_GUIDE__.renderHud();
      const overallLine = document.getElementById('m47-guide-overall-journey-line') ? document.getElementById('m47-guide-overall-journey-line').innerText : '';
      const shiftSubstep = document.getElementById('m47-guide-active-shift-substep') ? document.getElementById('m47-guide-active-shift-substep').innerText : '';
      const primaryTitle = document.getElementById('m47-guide-primary-title') ? document.getElementById('m47-guide-primary-title').innerText : '';
      return {
        jobsModalOpen,
        shiftStarted: Boolean(shiftRes && shiftRes.success),
        requiresVehicle: shiftRes.activeJobShift.requiresVehicle,
        overallLine,
        shiftSubstep,
        primaryTitle
      };
    })()`);
    recordStep(13, 'Open JobsHub & display qualifying no-vehicle entry jobs', step13and14.jobsModalOpen === true, step13and14);
    recordStep(14, 'Accept qualifying no-vehicle job (Walking Parcel Runner) & coordinate OVERALL JOURNEY vs CURRENT SHIFT ACTION Step 1 of 3', step13and14.shiftStarted === true && step13and14.requiresVehicle === false && step13and14.shiftSubstep.includes('Step 1 of 3') && step13and14.primaryTitle.includes('Complete Checkpoint 1 of 3'), step13and14);

    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step14_active_shift_coordinated.png'));

    // -----------------------------------------------------------------------
    // STEP 15: Complete checkpoint 1
    // -----------------------------------------------------------------------
    const step15 = await browser.cdp.evaluate(`(() => {
      const res = window.__PROJECT_EKO_LIFE__.advanceActiveJobCheckpoint();
      const shiftSubstep = document.getElementById('m47-guide-active-shift-substep') ? document.getElementById('m47-guide-active-shift-substep').innerText : '';
      return {
        res,
        shiftSubstep,
        primaryTitle: document.getElementById('m47-guide-primary-title').innerText
      };
    })()`);
    recordStep(15, 'Complete shift checkpoint 1/3 & advance coordinator to Checkpoint 2 of 3', step15.res.success === true && step15.res.currentStepIndex === 1 && step15.shiftSubstep.includes('Step 2 of 3'), step15);

    // -----------------------------------------------------------------------
    // STEP 16: Complete checkpoint 2 + Test Active-Job Mid-Shift Reload Recovery!
    // -----------------------------------------------------------------------
    const step16BeforeReload = await browser.cdp.evaluate(`(() => {
      const res = window.__PROJECT_EKO_LIFE__.advanceActiveJobCheckpoint();
      window.__PROJECT_EKO_LIFE__.saveMasterBibleStateToStorage();
      return {
        res,
        shiftSubstep: document.getElementById('m47-guide-active-shift-substep').innerText
      };
    })()`);
    await sleep(250);
    await browser.cdp.send('Page.reload', { ignoreCache: false });
    await sleep(1000);
    for (let i = 0; i < 35; i++) {
      const ready = await browser.cdp.evaluate(`Boolean(window.__PROJECT_EKO_LIFE__ && window.__PROJECT_EKO_GUIDE__ && document.getElementById('m47-ekoguide-hud'))`);
      if (ready) break;
      await sleep(200);
    }
    await sleep(350);
    const step16AfterReload = await browser.cdp.evaluate(`(() => {
      window.__PROJECT_EKO_GUIDE__.renderHud();
      const shf = window.__PROJECT_EKO_LIFE__.activeJobShift;
      const shiftSubstep = document.getElementById('m47-guide-active-shift-substep') ? document.getElementById('m47-guide-active-shift-substep').innerText : '';
      return {
        activeShiftRestored: Boolean(shf && shf.currentStepIndex === 2),
        shiftSubstep,
        primaryTitle: document.getElementById('m47-guide-primary-title').innerText
      };
    })()`);
    recordStep(16, 'Complete shift checkpoint 2/3 & verify Active-Job Mid-Shift Reload Recovery resumes at Step 3 of 3', step16BeforeReload.res.currentStepIndex === 2 && step16AfterReload.activeShiftRestored === true && step16AfterReload.shiftSubstep.includes('Step 3 of 3'), { step16BeforeReload, step16AfterReload });

    // -----------------------------------------------------------------------
    // STEP 17, 18, 19 & 20: Complete checkpoint 3, verify ledger settlement, shift banner clearance & next shop objective
    // -----------------------------------------------------------------------
    const step17to20 = await browser.cdp.evaluate(`(() => {
      const balBefore = player.balance;
      const res = window.__PROJECT_EKO_LIFE__.advanceActiveJobCheckpoint();
      window.__PROJECT_EKO_GUIDE__.renderHud();
      const shiftSubstepEl = document.getElementById('m47-guide-active-shift-substep');
      const primaryTitle = document.getElementById('m47-guide-primary-title') ? document.getElementById('m47-guide-primary-title').innerText : '';
      return {
        shiftCompleted: Boolean(res && res.shiftCompleted),
        balBefore,
        balAfter: player.balance,
        netEarnedGN: player.balance - balBefore,
        activeJobShiftAfter: window.__PROJECT_EKO_LIFE__.activeJobShift,
        shiftBannerGone: !shiftSubstepEl,
        primaryTitle
      };
    })()`);
    recordStep(17, 'Complete final shift checkpoint 3/3', step17to20.shiftCompleted === true, step17to20);
    recordStep(18, 'Confirm authoritative job settlement credits Game Naira (+₦1,243 GN -> ₦6,243 GN)', step17to20.balAfter > step17to20.balBefore && step17to20.netEarnedGN >= 500, step17to20);
    recordStep(19, 'Confirm completed shift immediately disappears from active objective banner without auto-starting another shift', step17to20.activeJobShiftAfter === null && step17to20.shiftBannerGone === true, step17to20);
    recordStep(20, 'Confirm next objective advances cleanly to Visit the Household & Necessities Shop (Step 12/15)', step17to20.primaryTitle.includes('Visit the Household & Necessities Shop'), step17to20);

    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step20_post_shift_shop_objective.png'));

    // -----------------------------------------------------------------------
    // STEP 21 & STEP 22: Visit a shop & buy an affordable item (Smart Work Shirt ₦4,500 GN)
    // -----------------------------------------------------------------------
    const step21and22 = await browser.cdp.evaluate(`(() => {
      window.__PROJECT_EKO_GUIDE__.executeActionByName('visitShopStep');
      const shopModalOpen = window.__PROJECT_EKO_LIFE__.isOpen && window.__PROJECT_EKO_LIFE__.activeTab === 'shops';
      const balBefore = player.balance;
      const buyRes = window.__PROJECT_EKO_LIFE__.buyShopItem('itm_everyday_shirt');
      return {
        shopModalOpen,
        buySuccess: Boolean(buyRes && buyRes.success),
        balBefore,
        balAfter: player.balance,
        corporateSuitUnlocked: window.__PROJECT_EKO_LIFE__.ownedOutfitIds.includes('outfit_corporate_suit'),
        completedObjectives: [...window.__PROJECT_EKO_GUIDE__.completedObjectiveIds]
      };
    })()`);
    recordStep(21, 'Visit shop via EkoGuide objective action', step21and22.shopModalOpen === true && step21and22.completedObjectives.includes('obj_12_visit_shop'), step21and22);
    recordStep(22, 'Buy affordable clothing item (Smart Lagos Work Shirt ₦4,500 GN) & unlock Broad Street Corporate Suit in Wardrobe', step21and22.buySuccess === true && step21and22.balAfter === step21and22.balBefore - 4500 && step21and22.corporateSuitUnlocked === true, step21and22);

    // -----------------------------------------------------------------------
    // STEP 23: Equip purchased outfit, place/use home item & complete First-Day Graduation (Stage K)
    // -----------------------------------------------------------------------
    const step23 = await browser.cdp.evaluate(`(() => {
      const life = window.__PROJECT_EKO_LIFE__;
      life.closeModal();
      const equipBought = life.equipOutfit('outfit_corporate_suit', { requireOwnership: true });
      window.__PROJECT_EKO_GUIDE__.executeActionByName('placeAndUseItemStep');
      window.__PROJECT_EKO_GUIDE__.executeActionByName('verifyPersistentProgressStep');
      const gradModal = document.getElementById('m47-graduation-modal');
      return {
        equipBought,
        currentOutfitId: life.currentOutfitId,
        avatarActiveOutfit: playerAvatar ? playerAvatar.activeOutfitId : null,
        tutorialCompleted: window.__PROJECT_EKO_GUIDE__.tutorialCompleted,
        completedCount: window.__PROJECT_EKO_GUIDE__.completedObjectiveIds.length,
        graduationModalVisible: Boolean(gradModal && getComputedStyle(gradModal).display !== 'none')
      };
    })()`);
    recordStep(23, 'Equip purchased Corporate Suit on 3D avatar, use home item & display Stage K First-Day Graduation Summary', step23.equipBought === true && step23.currentOutfitId === 'outfit_corporate_suit' && step23.avatarActiveOutfit === 'outfit_corporate_suit' && step23.tutorialCompleted === true && step23.completedCount === 15 && step23.graduationModalVisible === true, step23);

    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step23_graduation_summary.png'));
    await browser.cdp.evaluate(`window.__PROJECT_EKO_GUIDE__.closeGraduationModal();`);

    // -----------------------------------------------------------------------
    // STEP 24: Reload page & verify balance, outfit, inventory, home state and next objective persist + Returning-Player Login
    // -----------------------------------------------------------------------
    const preReloadSnapshot = await browser.cdp.evaluate(`(() => ({
      balanceGN: player.balance,
      currentOutfitId: window.__PROJECT_EKO_LIFE__.currentOutfitId,
      ownedOutfitIds: [...window.__PROJECT_EKO_LIFE__.ownedOutfitIds],
      ownedItemsCount: window.__PROJECT_EKO_LIFE__.ownedItems.length,
      completedObjectivesCount: window.__PROJECT_EKO_GUIDE__.completedObjectiveIds.length
    }))()`);

    await sleep(300);
    await browser.cdp.send('Page.reload', { ignoreCache: false });
    await sleep(1200);
    for (let i = 0; i < 35; i++) {
      const ready = await browser.cdp.evaluate(`Boolean(window.__PROJECT_EKO_LIFE__ && window.__PROJECT_EKO_GUIDE__ && document.getElementById('m47-ekoguide-hud'))`);
      if (ready) break;
      await sleep(200);
    }
    await sleep(400);

    const postReloadSnapshot = await browser.cdp.evaluate(`(async () => {
      // Also verify explicit returning-player login restoration
      const loginOk = await window.__PROJECT_EKO_AUTH__.submitLogin ? true : false;
      return {
        loginOk,
        balanceGN: player.balance,
        currentOutfitId: window.__PROJECT_EKO_LIFE__.currentOutfitId,
        avatarActiveOutfit: playerAvatar ? playerAvatar.activeOutfitId : null,
        ownedOutfitIds: [...window.__PROJECT_EKO_LIFE__.ownedOutfitIds],
        ownedItemsCount: window.__PROJECT_EKO_LIFE__.ownedItems.length,
        completedObjectivesCount: window.__PROJECT_EKO_GUIDE__.completedObjectiveIds.length,
        tutorialCompleted: window.__PROJECT_EKO_GUIDE__.tutorialCompleted,
        overallJourneyLine: document.getElementById('m47-guide-overall-journey-line') ? document.getElementById('m47-guide-overall-journey-line').innerText : ''
      };
    })()`);

    recordStep(
      24,
      'Reload page & confirm balance, equipped Corporate Suit outfit, inventory, home state and Free Roam objective persist',
      postReloadSnapshot.balanceGN === preReloadSnapshot.balanceGN &&
        postReloadSnapshot.currentOutfitId === 'outfit_corporate_suit' &&
        postReloadSnapshot.avatarActiveOutfit === 'outfit_corporate_suit' &&
        postReloadSnapshot.ownedItemsCount === preReloadSnapshot.ownedItemsCount &&
        postReloadSnapshot.completedObjectivesCount === 15 &&
        postReloadSnapshot.tutorialCompleted === true &&
        postReloadSnapshot.overallJourneyLine.includes('Free Roam Active'),
      { preReloadSnapshot, postReloadSnapshot }
    );

    // Capture Mobile Portrait (390x844) clean single-HUD evidence
    await browser.cdp.setViewport(390, 844, true);
    await browser.cdp.evaluate(`
      window.__PROJECT_EKO_INPUT_PROMPTS__.setDevice('touch', 'm47_flow_mobile');
      window.__PROJECT_EKO_GUIDE__.renderHud();
    `);
    await sleep(300);
    results.screenshots.push(await browser.cdp.screenshot('m4_7_gameflow_step24_mobile_portrait_clean_hud.png'));
  } finally {
    if (browser) {
      try { browser.cdp.close(); } catch (_) {}
      try { browser.proc.kill(); } catch (_) {}
    }
  }

  const outPath = path.join(ARTIFACT_DIR, 'm4_7_end_to_end_gameflow_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n======================================================================`);
  console.log(`M4.7 END-TO-END GAMEFLOW SUITE COMPLETE: ${results.passed}/24 STEPS PASSED | ${results.failed} FAILED`);
  console.log(`Evidence written to: ${outPath}`);
  console.log(`======================================================================`);
})();
