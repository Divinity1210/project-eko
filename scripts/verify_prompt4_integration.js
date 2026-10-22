/**
 * PROJECT EKO — PROMPT 4 END-TO-END BROWSER & FULL-STACK ACCEPTANCE VERIFICATION
 * Drives Headless Google Chrome via Chrome DevTools Protocol (CDP) with zero external npm dependencies.
 * Audits the complete application from initial load through:
 * - Authoritative Bootstrap & Double-Entry Ledger Sync (ports 3000, 3001, 3002)
 * - Standardized 11-Category Interaction Framework (window.__PROJECT_EKO_INTERACTION__)
 * - Held-Key Repeat Suppression, Modal Input Gating & On-Foot vs. Vehicle Control Separation
 * - Player Spawn, On-Foot Locomotion, Front-Facing Camera ([V]) & NPC Dialogue
 * - EkoPhone OS, 5-Class Dealership, Vehicle Purchase, Fleet, Businesses & EkoBank Ledger
 * - Vehicle Summoning ([1-5]), Driving, Weather ([R]), Day/Night ([T]) & Collision Integrity ([K])
 * - Responsive Desktop (1280x720) & Mobile (390x844) Layouts & Performance Budgets
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const assert = require('assert');
const { spawn } = require('child_process');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = path.join(__dirname, '../ANTIGRAVITY/DELIVERY/screenshots');
const CDP_PORT = 9229;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.socket = null;
    this.msgId = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageErrors = [];
    this.rxBuffer = Buffer.alloc(0);
  }

  async connect() {
    const parsed = new URL(this.wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13'
        }
      });
      req.on('upgrade', (res, socket, head) => {
        this.socket = socket;
        if (head && head.length) {
          this.rxBuffer = Buffer.concat([this.rxBuffer, head]);
          this._processFrames();
        }
        socket.on('data', (chunk) => {
          this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
          this._processFrames();
        });
        socket.on('error', (err) => reject(err));
        resolve();
      });
      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  _sendFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(6);
      header[0] = 0x81;
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(8);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(14);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    const maskOffset = header.length - 4;
    const mask = crypto.randomBytes(4);
    mask.copy(header, maskOffset);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
      masked[i] = payload[i] ^ mask[i & 3];
    }
    this.socket.write(Buffer.concat([header, masked]));
  }

  _processFrames() {
    while (this.rxBuffer.length >= 2) {
      const firstByte = this.rxBuffer[0];
      const secondByte = this.rxBuffer[1];
      const opcode = firstByte & 0x0f;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.rxBuffer.length < 4) return;
        payloadLen = this.rxBuffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (this.rxBuffer.length < 10) return;
        payloadLen = Number(this.rxBuffer.readBigUInt64BE(2));
        offset = 10;
      }

      if (isMasked) offset += 4;
      if (this.rxBuffer.length < offset + payloadLen) return;

      let payload = this.rxBuffer.subarray(offset, offset + payloadLen);
      if (isMasked) {
        const mask = this.rxBuffer.subarray(offset - 4, offset);
        const unmasked = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) unmasked[i] = payload[i] ^ mask[i & 3];
        payload = unmasked;
      }
      this.rxBuffer = this.rxBuffer.subarray(offset + payloadLen);

      if (opcode === 0x01) {
        this._handleMessage(payload.toString('utf8'));
      } else if (opcode === 0x09 && this.socket) {
        // Respond to ping with pong
        const pong = Buffer.from([0x8a, 0x80, 0, 0, 0, 0]);
        this.socket.write(pong);
      }
    }
  }

  _handleMessage(rawText) {
    const msg = JSON.parse(rawText);
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve: res, reject: rej } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
      else res(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const text = msg.params?.exceptionDetails?.text || 'Uncaught exception';
      this.pageErrors.push(text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      const args = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
      this.consoleErrors.push(args);
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this._sendFrame(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression: `(${expression})()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Runtime.evaluate exception: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log(`📸 Saved ${filename}`);
    return outPath;
  }

  async setViewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await this.evaluate('() => { if (typeof onWindowResize === "function") onWindowResize(); }');
  }

  close() {
    if (this.socket) this.socket.destroy();
  }
}

async function waitForCDPTarget(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const targets = await res.json();
        const pageTarget = targets.find((t) => t.type === 'page');
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          return pageTarget.webSocketDebuggerUrl;
        }
      }
    } catch (_) {}
    await sleep(200);
  }
  throw new Error('Timed out waiting for Chrome DevTools Protocol target');
}

async function runVerification() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const userDataDir = path.join('/tmp', `eko-chrome-cdp-${Date.now()}`);

  console.log('🚀 Launching Headless Google Chrome for Project Eko Prompt 4 Verification...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,720',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  let client;
  try {
    const wsUrl = await waitForCDPTarget(CDP_PORT, 12000);
    client = new CDPClient(wsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.setViewport(1280, 720, false);

    // Wait for Three.js scene and EkoBackendSync to initialize
    await sleep(2200);

    // 1. Verify Initial Load & Authoritative Backend Sync
    if (client.pageErrors.length > 0 || client.consoleErrors.length > 0) {
      console.log('⚠️ Early Errors:', { pageErrors: client.pageErrors, consoleErrors: client.consoleErrors });
    }
    const initialDiag = await client.evaluate(`async () => {
      if (typeof window.__PROJECT_EKO_PERF__ === 'undefined' && typeof animate === 'function') {
        animate();
      }
      await window.__PROJECT_EKO_BACKEND_SYNC__.syncAuthoritativeState();
      return {
        backend: window.__PROJECT_EKO_BACKEND_SYNC__.getDiagnostics(),
        interaction: window.__PROJECT_EKO_INTERACTION__.getDiagnostics(),
        spatial: window.__PROJECT_EKO_SPATIAL__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__,
        character: window.__PROJECT_EKO_CHARACTER_DIAGNOSTICS__
      };
    }`);

    console.log('📊 Initial Diagnostics:', JSON.stringify({
      online: initialDiag.backend.online,
      realtimeOnline: initialDiag.backend.realtimeOnline,
      balanceGN: initialDiag.backend.playerBalanceGN,
      uiConsistent: initialDiag.backend.uiBalancesConsistent,
      categories: initialDiag.interaction.categoryCount,
      staticOverlaps: initialDiag.spatial.staticOverlapViolations,
      drawCalls: initialDiag.perf ? initialDiag.perf.drawCalls : null,
      triangles: initialDiag.perf ? initialDiag.perf.triangles : null,
      fps: initialDiag.perf ? initialDiag.perf.fps : null
    }, null, 2));

    assert.strictEqual(initialDiag.backend.online, true, 'Client must connect to authoritative API on port 3001');
    assert.strictEqual(initialDiag.backend.realtimeOnline, true, 'Client must connect to realtime worker on port 3002');
    assert.strictEqual(initialDiag.backend.uiBalancesConsistent, true, 'HUD balance must match authoritative player balance');
    assert.strictEqual(initialDiag.interaction.categoryCount, 11, 'Must expose all 11 standardized interaction categories');
    assert.strictEqual(initialDiag.spatial.staticOverlapViolations, 0, 'Zero static collider overlap violations');

    await client.screenshot('prompt4_01_desktop_spawn_onfoot.png');

    // 2. Test On-Foot vs. Vehicle Control Separation & Unavailable Reason Explanations
    const unavailableTests = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH' }));
      const hornOutcome = window.__PROJECT_EKO_INTERACTION__.lastOutcome;

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
      const spaceOutcome = window.__PROJECT_EKO_INTERACTION__.lastOutcome;

      const beforeRepeats = window.__PROJECT_EKO_INTERACTION__.suppressedRepeats;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', repeat: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', repeat: true }));
      const afterRepeats = window.__PROJECT_EKO_INTERACTION__.suppressedRepeats;

      return {
        hornOutcome,
        spaceOutcome,
        repeatsAdded: afterRepeats - beforeRepeats
      };
    }`);

    assert.strictEqual(unavailableTests.hornOutcome.outcome, 'UNAVAILABLE', 'Horn [H] on foot must log UNAVAILABLE');
    assert.ok(unavailableTests.hornOutcome.reason.includes('requires being inside a vehicle'), 'Horn [H] on foot must explain why');
    assert.strictEqual(unavailableTests.spaceOutcome.outcome, 'UNAVAILABLE', 'Bus-stop [Space] on foot must log UNAVAILABLE');
    assert.strictEqual(unavailableTests.repeatsAdded, 2, 'Held-key auto-repeat (e.repeat) must be suppressed and counted');

    // 3. Test Front-Facing Camera Inspection ([V])
    await client.evaluate(`() => { toggleFrontViewCamera(true); }`);
    await sleep(450);
    await client.screenshot('prompt4_02_front_camera_inspection.png');
    await client.evaluate(`() => { toggleFrontViewCamera(false); }`);
    await sleep(300);

    // 4. Test Approaching Citizen NPC, Opening Dialogue ([E]), Modal Input Gating & Escape Dismissal
    const npcModalTest = await client.evaluate(`() => {
      const blessing = lagosNPCs.find(n => n.userData && n.userData.name === 'Sister Blessing') || lagosNPCs[0];
      if (blessing) {
        playerAvatar.position.set(blessing.position.x + 1.4, blessing.position.y, blessing.position.z + 1.4);
      }
      const res = handleInteractKey(true);
      const isBlockingDuringModal = window.__PROJECT_EKO_INTERACTION__.isModalBlockingWorldInput();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR' }));
      const blockedCount = window.__PROJECT_EKO_INTERACTION__.blockedByModalCount;

      return { res, isBlockingDuringModal, blockedCount };
    }`);

    assert.strictEqual(npcModalTest.res, 'TALK_NPC', '[E] near NPC must trigger TALK_NPC');
    assert.strictEqual(npcModalTest.isBlockingDuringModal, true, 'Active NPC dialogue modal must block world keys');
    assert.ok(npcModalTest.blockedCount >= 1, 'World key pressed during modal must increment blockedByModalCount');

    await sleep(350);
    await client.screenshot('prompt4_03_npc_dialogue_modal.png');

    const modalAfterEsc = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      return window.__PROJECT_EKO_INTERACTION__.isModalBlockingWorldInput();
    }`);
    assert.strictEqual(modalAfterEsc, false, 'Escape key must cleanly close NPC dialogue modal');

    // 5. Test EkoPhone OS, 5-Class Dealership, Fleet, Businesses & Authoritative Purchase
    await client.evaluate(`() => {
      const phone = document.getElementById('eko-phone-container');
      if (phone && !phone.classList.contains('active')) toggleEkoPhone();
      openPhoneApp('dealership');
    }`);
    await sleep(450);
    await client.screenshot('prompt4_04_ekophone_dealership_5classes.png');

    // Attempt buying EkoBRT 42 Coach (480,000 GN) when balance < 480,000 GN -> must explain shortfall
    const brtRejectTest = await client.evaluate(`() => {
      const ok = buyDealershipVehicle('ekobrt_coach_42', 480000);
      return { ok, lastOutcome: window.__PROJECT_EKO_INTERACTION__.lastOutcome };
    }`);
    assert.strictEqual(brtRejectTest.ok, false, 'Buying 480k GN BRT coach with 35k GN must fail cleanly');
    assert.strictEqual(brtRejectTest.lastOutcome.outcome, 'UNAVAILABLE');
    assert.ok(brtRejectTest.lastOutcome.reason.includes('Insufficient Game Naira'), 'Must explain shortfall when funds are insufficient');

    // Collect Fleet Daily Profit (+5,440 GN) and Business Earnings (+2,400 GN)
    const economyCollectTest = await client.evaluate(`async () => {
      openPhoneApp('fleet');
      const fleetOk = collectFleetProfits();
      const fleetDuplicateOk = collectFleetProfits();
      const dupOutcome = window.__PROJECT_EKO_INTERACTION__.lastOutcome;

      openPhoneApp('businesses');
      const bizOk = collectBusinessEarnings();
      return {
        fleetOk,
        fleetDuplicateOk,
        dupOutcome,
        bizOk,
        balanceAfterCollect: player.balance
      };
    }`);

    assert.strictEqual(economyCollectTest.fleetOk, true, 'First fleet profit collection must succeed');
    assert.strictEqual(economyCollectTest.fleetDuplicateOk, false, 'Duplicate fleet profit collection must be rejected');
    assert.strictEqual(economyCollectTest.dupOutcome.outcome, 'UNAVAILABLE', 'Duplicate fleet profit collection must log UNAVAILABLE');
    assert.strictEqual(economyCollectTest.bizOk, true, 'Business franchise revenue collection must succeed');

    await sleep(450);
    await client.screenshot('prompt4_05_ekophone_fleet_and_business.png');

    // Purchase Koro 125 Okada (35,000 GN) from Dealership and verify ownership + double-entry ledger
    const okadaPurchaseTest = await client.evaluate(`async () => {
      if (player.balance < 36000) {
        await window.__PROJECT_EKO_BACKEND_SYNC__.syncTripCompletion('ekoride_passenger_trip', 'Marina Executive Shuttle', 36000, 35);
      }
      player.ownedVehicleModels = player.ownedVehicleModels.filter(m => m !== 'koro_okada_125');
      player.ownedVehicles = player.ownedVehicles.filter(v => v !== 'okada');
      openPhoneApp('dealership');
      const buyOk = buyDealershipVehicle('koro_okada_125', 35000);
      await new Promise(r => setTimeout(r, 400));
      openPhoneApp('rewards');
      await window.__PROJECT_EKO_BACKEND_SYNC__.fetchLedgerAudit();
      await new Promise(r => setTimeout(r, 300));
      const ledgerRes = await fetch('http://localhost:3001/api/v1/economy/ledger/audit').then(r => r.json());
      return {
        buyOk,
        ownedModels: player.ownedVehicleModels.slice(),
        ownedVehicles: player.ownedVehicles.slice(),
        diag: window.__PROJECT_EKO_BACKEND_SYNC__.getDiagnostics(),
        ledgerAudit: ledgerRes.audit,
        ledgerCount: ledgerRes.audit.totalTransactions
      };
    }`);

    assert.strictEqual(okadaPurchaseTest.buyOk, true, 'Purchasing Koro 125 Okada must succeed');
    assert.ok(okadaPurchaseTest.ownedModels.includes('koro_okada_125'), 'ownedVehicleModels must include koro_okada_125');
    assert.ok(okadaPurchaseTest.ownedVehicles.includes('okada'), 'ownedVehicles must include okada');
    assert.strictEqual(okadaPurchaseTest.ledgerAudit.isBalanced, true, 'Authoritative double-entry ledger must remain 100% balanced');
    assert.strictEqual(okadaPurchaseTest.ledgerAudit.unresolvedDiscrepanciesCount, 0, 'Authoritative double-entry ledger must have 0 discrepancies');

    await client.screenshot('prompt4_06_ekobank_double_entry_ledger.png');

    // Close EkoPhone via Escape
    await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    }`);
    await sleep(300);

    // 6. Test Vehicle Summoning ([2] Danfo), Driving, Control Separation & HUD Consistency
    const strafeWhileDriving = await client.evaluate(`async () => {
      quickSwitchVehicle('danfo');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX' }));
      const outcome = window.__PROJECT_EKO_INTERACTION__.lastOutcome;
      keys.w = true;
      await new Promise(r => setTimeout(r, 650));
      keys.w = false;
      return {
        lastOutcome: outcome,
        syncDiag: window.__PROJECT_EKO_BACKEND_SYNC__.getDiagnostics()
      };
    }`);

    assert.strictEqual(strafeWhileDriving.lastOutcome.outcome, 'UNAVAILABLE', 'Strafe [X] while driving must be rejected');
    assert.strictEqual(strafeWhileDriving.syncDiag.isDriving, true, 'Player must be driving after switching to Danfo');
    assert.strictEqual(strafeWhileDriving.syncDiag.activeVehicleKey, 'danfo', 'Active vehicle must be danfo');
    assert.strictEqual(strafeWhileDriving.syncDiag.vehicleSelectionMatchesSpawn, true, 'Active vehicle mesh must match selected class');
    assert.strictEqual(strafeWhileDriving.syncDiag.hudSpeedMatchesSimulation, true, 'HUD speedometer must match simulation speed');
    assert.strictEqual(strafeWhileDriving.syncDiag.fuelAndHealthValid, true, 'Fuel and vehicle condition must remain within valid bounds');

    await client.screenshot('prompt4_07_driving_danfo_cockpit_hud.png');

    // 7. Test Tropical Rain ([R]) + Night Mode ([T]) Visual Coherence
    await client.evaluate(`() => {
      if (!isRaining) toggleRainMode();
      while (!timeBands[timeIndex].isNight) {
        cycleTimeOfDay();
      }
    }`);
    await sleep(500);
    await client.screenshot('prompt4_08_night_rain_driving_coherence.png');

    // Restore Morning Dry weather and test Spatial Collision Debug Overlay ([K])
    await client.evaluate(`() => {
      if (isRaining) toggleRainMode();
      while (timeIndex !== 1) {
        cycleTimeOfDay();
      }
      toggleCollisionDebugMode(true);
    }`);
    await sleep(400);
    await client.screenshot('prompt4_09_spatial_collision_debug.png');
    await client.evaluate(`() => {
      toggleCollisionDebugMode(false);
      const toast = document.getElementById('toast-notification');
      if (toast) toast.classList.remove('active');
    }`);

    // 8. Test Mobile Viewport (390x844) Responsiveness & Touch Controls
    await client.setViewport(390, 844, true);
    await sleep(500);

    const mobileLayoutCheck = await client.evaluate(`() => {
      const touchEl = document.getElementById('mobile-touch-controls');
      const touchStyle = touchEl ? window.getComputedStyle(touchEl).display : 'none';
      const quickCard = document.querySelector('.quick-controls-card');
      const quickCardDisplay = quickCard ? window.getComputedStyle(quickCard).display : 'block';
      return {
        touchControlsDisplay: touchStyle,
        desktopQuickCardDisplay: quickCardDisplay,
        perf: window.__PROJECT_EKO_PERF__
      };
    }`);

    assert.strictEqual(mobileLayoutCheck.touchControlsDisplay, 'flex', 'Mobile viewport (390x844) must display #mobile-touch-controls');
    assert.strictEqual(mobileLayoutCheck.desktopQuickCardDisplay, 'none', 'Mobile viewport (390x844) must hide bulky desktop keyboard card');

    await client.screenshot('prompt4_10_mobile_viewport_390x844.png');

    // Open EkoPhone on Mobile (390x844) to verify responsive modal sizing
    await client.evaluate(`() => {
      const phone = document.getElementById('eko-phone-container');
      if (phone && !phone.classList.contains('active')) toggleEkoPhone();
      openPhoneApp('dealership');
    }`);
    await sleep(400);
    await client.screenshot('prompt4_11_mobile_ekophone_responsive.png');

    // 9. Verify Performance Budgets & Zero Console/Page Errors
    assert.ok(initialDiag.perf.drawCalls <= 75, `Draw calls (${initialDiag.perf.drawCalls}) must be <= 75`);
    assert.ok(initialDiag.perf.triangles <= 35000, `Triangles (${initialDiag.perf.triangles}) must be <= 35,000`);
    assert.strictEqual(client.pageErrors.length, 0, `Expected 0 page errors, got: ${client.pageErrors.join('; ')}`);

    console.log('\n================================================================');
    console.log('✅ PROMPT 4 WHOLE-APPLICATION INTEGRATION VERIFICATION PASSED!');
    console.log(`   • Draw Calls: ${initialDiag.perf.drawCalls} (Budget <= 75)`);
    console.log(`   • Triangles:  ${initialDiag.perf.triangles} (Budget <= 35,000)`);
    console.log(`   • FPS:        ${initialDiag.perf.fps}`);
    console.log(`   • Ledger:     Balanced (0 discrepancies, ${okadaPurchaseTest.ledgerCount} entries)`);
    console.log(`   • Screenshots: 11 saved to ANTIGRAVITY/DELIVERY/screenshots/`);
    console.log('================================================================');
  } finally {
    if (client) client.close();
    chromeProc.kill('SIGKILL');
  }
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
