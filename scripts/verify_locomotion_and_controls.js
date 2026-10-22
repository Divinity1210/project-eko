/**
 * PROJECT EKO — CHARACTER LOCOMOTION, GAIT FOOT-LOCKING & DIRECTIONAL CONTROLS BROWSER ACCEPTANCE TEST
 * Drives Headless Google Chrome via Chrome DevTools Protocol (CDP) against http://localhost:3000.
 *
 * Executes all Section E browser acceptance tests:
 * 1. Walk forward for several seconds (W) -> verify alternating legs, counter-swinging arms, knee flexion & foot-locking
 * 2. Stop -> confirm character decelerates via stop_move to idle and limbs stop cycling when stationary
 * 3. Walk backward (S) -> verify retrograde walk_backward animation and backward translation
 * 4. Press left (A) -> verify character turns left (+yaw, +X local left) with turn_left stepping animation
 * 5. Press right (D) -> verify character turns right (-yaw, -X local right) with turn_right stepping animation
 * 6. Repeat using Arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) + Running gait (Shift + ArrowUp)
 * 7. Switch into Front-Facing / Selfie view ([V]) and repeat W/S/A/D and Arrow key tests (confirming zero camera inversion)
 * 8. Enter and exit a car ([E]) -> verify enter_vehicle and exit_vehicle transitions
 * 9. Drive left and right (A/D & ArrowLeft/ArrowRight) in both Third-Person (Chase) and Cockpit (Hood) views
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const assert = require('assert');
const { spawn } = require('child_process');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = path.join(__dirname, '../ANTIGRAVITY/DELIVERY/screenshots');
const REPORT_JSON_PATH = path.join(__dirname, '../ANTIGRAVITY/DELIVERY/locomotion_verification_metrics.json');
const CDP_PORT = 9231;

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

  async setViewport(width, height) {
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

async function waitForCDPTarget(port, timeoutMs = 12000) {
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

async function runLocomotionVerification() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const userDataDir = path.join('/tmp', `eko-locomotion-cdp-${Date.now()}`);

  console.log('🚀 Launching Headless Google Chrome for Character Locomotion & Controls Verification...');
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
  const reportMetrics = {};

  try {
    const wsUrl = await waitForCDPTarget(CDP_PORT, 12000);
    client = new CDPClient(wsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.setViewport(1280, 720);

    // Wait for scene + EkoLocomotionDiagnostics to initialize
    for (let i = 0; i < 40; i++) {
      const ready = await client.evaluate('() => Boolean(window.__PROJECT_EKO_LOCOMOTION__ && window.playerAvatar && window.playerAvatar.rig)');
      if (ready) break;
      await sleep(200);
    }

    // Install deterministic step helper in page so we can dispatch real KeyboardEvents AND advance exact simulation steps
    // Pause background requestAnimationFrame so asynchronous CDP screenshot encoding never advances extra frames mid-key-hold
    await client.evaluate(`() => {
      window.requestAnimationFrame = () => 0;

      window.__stepKeys = (keyDownList, frames, dt = 1/60) => {
        for (const k of keyDownList) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code, bubbles: true }));
        }
        const samples = [];
        for (let i = 0; i < frames; i++) {
          updateSimulation(dt);
          samples.push(window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics());
        }
        if (renderer && scene && camera) renderer.render(scene, camera);
        for (const k of keyDownList) {
          window.dispatchEvent(new KeyboardEvent('keyup', { key: k.key, code: k.code, bubbles: true }));
        }
        return {
          first: samples[0],
          mid: samples[Math.floor(samples.length / 2)],
          last: samples[samples.length - 1],
          samples
        };
      };

      window.__resetPlayerOnFootPose = (x = -83.6, z = -206.0, heading = 0) => {
        if (isDriving) toggleVehicleMount();
        keys.w = keys.a = keys.s = keys.d = keys.shift = keys.space = false;
        playerCurrentSpeed = 0;
        playerStrafeSpeed = 0;
        playerTurnVel = 0;
        playerHeading = heading;
        followCamYaw = heading;
        frontCamYaw = heading;
        cameraOrbitYaw = 0;
        const gy = EkoSpatialEngine.getCharacterGroundHeight(x, z);
        playerAvatar.position.set(x, gy, z);
        playerAvatar.rotation.y = heading;
        EkoAnimStateMachine.setState(playerAvatar, 'idle');
        for (let i = 0; i < 20; i++) updateSimulation(1/60);
        renderer.render(scene, camera);
        return window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      };
    }`);

    // =========================================================================
    // TEST 1: WALK FORWARD FOR SEVERAL SECONDS (W) — FOLLOW CAMERA
    // =========================================================================
    console.log('\n[TEST 1] Walk forward for several seconds (W) in Third-Person Follow Camera...');
    const initPose = await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');
    assert.strictEqual(initPose.isDriving, false, 'Player must start on foot');
    assert.strictEqual(initPose.cameraMode, 'chase', 'Camera must start in third-person follow (chase) mode');
    assert.ok(initPose.rig.anatomicalLeftHipX > 0 && initPose.rig.anatomicalRightHipX < 0, 'Anatomical Left hip must be +X and Right hip -X');

    // Walk forward for 3.0 seconds (180+ frames at 60Hz) holding W, stopping at peak mid-stride for screenshot clarity
    const walkFwdRes = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
      const samples = [];
      for (let i = 0; i < 180; i++) {
        updateSimulation(1/60);
        samples.push(window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics());
      }
      for (let extra = 0; extra < 18; extra++) {
        const last = samples[samples.length - 1];
        if (Math.abs(last.rig.hipLRotX - last.rig.hipRRotX) > 0.88 && last.rig.kneeLRotX > 0.45) break;
        updateSimulation(1/60);
        samples.push(window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics());
      }
      if (renderer && scene && camera) renderer.render(scene, camera);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
      return samples;
    }`);
    await client.screenshot('locomotion_01_walk_forward_follow.png');

    const startZ = initPose.playerPosition.z;
    const endWalkDiag = walkFwdRes[walkFwdRes.length - 1];
    const deltaZForward = endWalkDiag.playerPosition.z - startZ;
    let maxHipSpread = 0;
    let maxArmSpread = 0;
    let maxKneeL = 0;
    let maxKneeR = 0;
    let leftLeadFrames = 0;
    let rightLeadFrames = 0;
    let footLockPassedAllFrames = true;

    for (const s of walkFwdRes.slice(15)) {
      const hipSpread = Math.abs(s.rig.hipLRotX - s.rig.hipRRotX);
      const armSpread = Math.abs(s.rig.shoulderLRotX - s.rig.shoulderRRotX);
      if (hipSpread > maxHipSpread) maxHipSpread = hipSpread;
      if (armSpread > maxArmSpread) maxArmSpread = armSpread;
      if (s.rig.kneeLRotX > maxKneeL) maxKneeL = s.rig.kneeLRotX;
      if (s.rig.kneeRRotX > maxKneeR) maxKneeR = s.rig.kneeRRotX;
      if (s.rig.hipLRotX < -0.20 && s.rig.hipRRotX > 0.20) leftLeadFrames++;
      if (s.rig.hipRRotX < -0.20 && s.rig.hipLRotX > 0.20) rightLeadFrames++;
      if (Math.min(s.anim.leftFootHeight, s.anim.rightFootHeight) !== 0) footLockPassedAllFrames = false;
    }

    assert.strictEqual(endWalkDiag.anim.canonicalState, 'walk_forward', 'State must be walk_forward while holding W');
    assert.ok(deltaZForward > 5.5, `Walking forward 3s must advance +Z by > 5.5m (got +${deltaZForward.toFixed(2)}m)`);
    assert.ok(maxHipSpread > 0.85, `Alternating legs must swing with spread > 0.85 rad (got ${maxHipSpread.toFixed(3)} rad)`);
    assert.ok(maxArmSpread > 0.65, `Counter-swinging arms must swing with spread > 0.65 rad (got ${maxArmSpread.toFixed(3)} rad)`);
    assert.ok(leftLeadFrames > 25 && rightLeadFrames > 25, `Left and right legs must alternate lead phases (L=${leftLeadFrames}, R=${rightLeadFrames})`);
    assert.ok(maxKneeL > 0.45 && maxKneeR > 0.45, `Both knees must flex during swing phase (L=${maxKneeL.toFixed(2)}, R=${maxKneeR.toFixed(2)})`);
    assert.strictEqual(footLockPassedAllFrames, true, 'Stance foot must remain locked at 0.00m clearance on every frame');
    console.log(`✅ PASS: Walk Forward (W) — ΔZ = +${deltaZForward.toFixed(2)}m, hipSpread = ${maxHipSpread.toFixed(2)} rad, armSpread = ${maxArmSpread.toFixed(2)} rad, kneeFlex L/R = ${maxKneeL.toFixed(2)}/${maxKneeR.toFixed(2)} rad`);

    reportMetrics.walkForwardFollow = {
      deltaZMeters: Number(deltaZForward.toFixed(3)),
      speedMps: endWalkDiag.playerCurrentSpeed,
      strideLengthM: endWalkDiag.anim.strideLength,
      gaitFrequencyHz: endWalkDiag.anim.gaitFrequency,
      maxHipSpreadRad: Number(maxHipSpread.toFixed(3)),
      maxArmSpreadRad: Number(maxArmSpread.toFixed(3)),
      maxKneeLRad: Number(maxKneeL.toFixed(3)),
      maxKneeRRad: Number(maxKneeR.toFixed(3)),
      leftLeadFrames,
      rightLeadFrames,
      footLockPassedAllFrames
    };

    // =========================================================================
    // TEST 2: STOP AND CONFIRM CHARACTER BECOMES STATIONARY (NO IDLE CYCLING)
    // =========================================================================
    console.log('\n[TEST 2] Release W and verify smooth stop_move -> stationary idle with zero limb cycling...');
    const stopSamples = await client.evaluate(`() => {
      const samples = [];
      for (let i = 0; i < 75; i++) {
        updateSimulation(1/60);
        samples.push(window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics());
      }
      if (renderer && scene && camera) renderer.render(scene, camera);
      return samples;
    }`);
    await client.screenshot('locomotion_02_stationary_idle.png');

    const stationarySampleA = stopSamples[55];
    const stationarySampleB = stopSamples[74];
    assert.strictEqual(stationarySampleB.anim.canonicalState, 'idle', 'Character must return to idle after stopping');
    assert.strictEqual(stationarySampleB.playerCurrentSpeed, 0, 'Player speed must be 0 when stationary');
    assert.strictEqual(stationarySampleA.anim.phase, stationarySampleB.anim.phase, 'Gait phase must not continue cycling when stationary');
    assert.ok(Math.abs(stationarySampleB.rig.hipLRotX) < 0.015 && Math.abs(stationarySampleB.rig.hipRRotX) < 0.015, 'Legs must settle into stationary two-foot stance');
    console.log(`✅ PASS: Stationary Stop — speed = ${stationarySampleB.playerCurrentSpeed} m/s, state = ${stationarySampleB.anim.canonicalState}, hipL/R = ${stationarySampleB.rig.hipLRotX}/${stationarySampleB.rig.hipRRotX} rad`);

    reportMetrics.stationaryStop = {
      finalState: stationarySampleB.anim.canonicalState,
      speedMps: stationarySampleB.playerCurrentSpeed,
      phaseFrame55: stationarySampleA.anim.phase,
      phaseFrame74: stationarySampleB.anim.phase,
      hipLRotX: stationarySampleB.rig.hipLRotX,
      hipRRotX: stationarySampleB.rig.hipRRotX
    };

    // =========================================================================
    // TEST 3: WALK BACKWARD (S) AND VERIFY RETROGRADE WALK ANIMATION
    // =========================================================================
    console.log('\n[TEST 3] Walk backward (S) and verify retrograde walk_backward animation...');
    const beforeBackZ = stationarySampleB.playerPosition.z;
    const walkBackRes = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', bubbles: true }));
      const samples = [];
      for (let i = 0; i < 120; i++) {
        updateSimulation(1/60);
        samples.push(window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics());
      }
      for (let extra = 0; extra < 18; extra++) {
        const last = samples[samples.length - 1];
        if (Math.abs(last.rig.hipLRotX - last.rig.hipRRotX) > 0.62 && last.rig.kneeRRotX > 0.35) break;
        updateSimulation(1/60);
        samples.push(window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics());
      }
      if (renderer && scene && camera) renderer.render(scene, camera);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 's', code: 'KeyS', bubbles: true }));
      return samples;
    }`);
    await client.screenshot('locomotion_03_walk_backward_follow.png');
    await client.evaluate(`() => {
      for (let i = 0; i < 40; i++) updateSimulation(1/60);
    }`);

    const endBackDiag = walkBackRes[walkBackRes.length - 1];
    const deltaZBack = endBackDiag.playerPosition.z - beforeBackZ;
    let maxBackHipSpread = 0;
    for (const s of walkBackRes.slice(15)) {
      const spread = Math.abs(s.rig.hipLRotX - s.rig.hipRRotX);
      if (spread > maxBackHipSpread) maxBackHipSpread = spread;
    }

    assert.strictEqual(endBackDiag.anim.canonicalState, 'walk_backward', 'State must be walk_backward while holding S');
    assert.ok(deltaZBack < -2.4, `Walking backward 2s must move -Z by < -2.4m (got ${deltaZBack.toFixed(2)}m)`);
    assert.ok(maxBackHipSpread > 0.55, `Backward walk must alternate legs (spread = ${maxBackHipSpread.toFixed(2)} rad)`);
    assert.ok(endBackDiag.rig.spineRotX < 0, `Backward walk must use retrograde spine pitch (got ${endBackDiag.rig.spineRotX})`);
    console.log(`✅ PASS: Walk Backward (S) — ΔZ = ${deltaZBack.toFixed(2)}m, state = ${endBackDiag.anim.canonicalState}, hipSpread = ${maxBackHipSpread.toFixed(2)} rad, spineRotX = ${endBackDiag.rig.spineRotX}`);

    reportMetrics.walkBackwardFollow = {
      deltaZMeters: Number(deltaZBack.toFixed(3)),
      speedMps: endBackDiag.playerCurrentSpeed,
      canonicalState: endBackDiag.anim.canonicalState,
      strideLengthM: endBackDiag.anim.strideLength,
      maxHipSpreadRad: Number(maxBackHipSpread.toFixed(3)),
      spineRotX: endBackDiag.rig.spineRotX
    };

    // =========================================================================
    // TEST 4 & 5: TURN LEFT (A) AND TURN RIGHT (D) ON FOOT
    // =========================================================================
    console.log('\n[TEST 4 & 5] Press Left (A) and Right (D) on foot and verify turn_left / turn_right direction...');
    await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');

    // Hold A (Turn Left) for 30 frames (~0.5s -> ~1.1 rad Left)
    const turnLeftWASD = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
      for (let i = 0; i < 30; i++) updateSimulation(1/60);
      if (renderer && scene && camera) renderer.render(scene, camera);
      const diag = window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }));
      return diag;
    }`);
    await client.screenshot('locomotion_04_turn_left_wasd.png');

    assert.strictEqual(turnLeftWASD.anim.canonicalState, 'turn_left', 'Holding A while stationary must activate turn_left animation');
    assert.ok(turnLeftWASD.playerTurnVel > 1.5, `Pressing A (Left) must produce positive turn velocity (+yaw Left), got ${turnLeftWASD.playerTurnVel}`);
    assert.ok(turnLeftWASD.playerHeading > 0.85 && turnLeftWASD.playerHeading < 2.2, `Pressing A (Left) must rotate character heading toward +X Left (+yaw in [0.85, 2.2] rad), got ${turnLeftWASD.playerHeading}`);
    assert.ok(turnLeftWASD.rig.headRotY > 0.15 && turnLeftWASD.rig.spineRotY > 0.05, 'Head and torso must lead into Left (+Y) turn');

    // Verify that walking forward after turning left moves in the +X (Left) world direction!
    const walkAfterLeft = await client.evaluate(`() => {
      const beforeX = playerAvatar.position.x;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
      for (let i = 0; i < 40; i++) updateSimulation(1/60);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
      const afterX = playerAvatar.position.x;
      return afterX - beforeX;
    }`);
    assert.ok(walkAfterLeft > 0.65, `Walking forward after turning Left must move toward +X (world Left of +Z), got ΔX = +${walkAfterLeft.toFixed(2)}m`);
    console.log(`✅ PASS: Turn Left (A) — state = ${turnLeftWASD.anim.canonicalState}, heading = +${turnLeftWASD.playerHeading.toFixed(3)} rad, subsequent walk ΔX = +${walkAfterLeft.toFixed(2)}m (Left)`);

    // Reset to heading = 0 and test D (Turn Right)
    await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');
    const turnRightWASD = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', bubbles: true }));
      for (let i = 0; i < 30; i++) updateSimulation(1/60);
      if (renderer && scene && camera) renderer.render(scene, camera);
      const diag = window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', code: 'KeyD', bubbles: true }));
      return diag;
    }`);
    await client.screenshot('locomotion_05_turn_right_wasd.png');

    assert.strictEqual(turnRightWASD.anim.canonicalState, 'turn_right', 'Holding D while stationary must activate turn_right animation');
    assert.ok(turnRightWASD.playerTurnVel < -1.5, `Pressing D (Right) must produce negative turn velocity (-yaw Right), got ${turnRightWASD.playerTurnVel}`);
    assert.ok(turnRightWASD.playerHeading < -0.85 && turnRightWASD.playerHeading > -2.2, `Pressing D (Right) must rotate character heading toward -X Right (-yaw in [-2.2, -0.85] rad), got ${turnRightWASD.playerHeading}`);
    assert.ok(turnRightWASD.rig.headRotY < -0.15 && turnRightWASD.rig.spineRotY < -0.05, 'Head and torso must lead into Right (-Y) turn');

    // Verify that walking forward after turning right moves in the -X (Right) world direction!
    const walkAfterRight = await client.evaluate(`() => {
      const beforeX = playerAvatar.position.x;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
      for (let i = 0; i < 40; i++) updateSimulation(1/60);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
      const afterX = playerAvatar.position.x;
      return afterX - beforeX;
    }`);
    assert.ok(walkAfterRight < -0.65, `Walking forward after turning Right must move toward -X (world Right of +Z), got ΔX = ${walkAfterRight.toFixed(2)}m`);
    console.log(`✅ PASS: Turn Right (D) — state = ${turnRightWASD.anim.canonicalState}, heading = ${turnRightWASD.playerHeading.toFixed(3)} rad, subsequent walk ΔX = ${walkAfterRight.toFixed(2)}m (Right)`);

    reportMetrics.turnControlsWASD = {
      turnLeftHeadingRad: turnLeftWASD.playerHeading,
      turnLeftWalkDeltaXM: Number(walkAfterLeft.toFixed(3)),
      turnRightHeadingRad: turnRightWASD.playerHeading,
      turnRightWalkDeltaXM: Number(walkAfterRight.toFixed(3))
    };

    // =========================================================================
    // TEST 6: REPEAT USING ARROW KEYS + RUNNING GAIT (SHIFT + ARROWUP)
    // =========================================================================
    console.log('\n[TEST 6] Repeat on-foot locomotion & turning using Arrow keys + Shift Run...');
    await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');

    const arrowFwd = await client.evaluate('() => window.__stepKeys([{ key: "ArrowUp", code: "ArrowUp" }], 60)');
    assert.strictEqual(arrowFwd.last.anim.canonicalState, 'walk_forward', 'ArrowUp must trigger walk_forward');
    assert.ok(arrowFwd.last.playerPosition.z > -204.2, 'ArrowUp must move character forward (+Z)');

    const arrowRun = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
      for (let i = 0; i < 50; i++) updateSimulation(1/60);
      if (renderer && scene && camera) renderer.render(scene, camera);
      const diag = window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', code: 'ShiftLeft', bubbles: true }));
      return diag;
    }`);
    await client.screenshot('locomotion_06_run_and_arrow_keys.png');
    assert.strictEqual(arrowRun.anim.canonicalState, 'run', 'Shift + ArrowUp must trigger run state');
    assert.ok(arrowRun.playerCurrentSpeed > 4.5, `Running speed (${arrowRun.playerCurrentSpeed} m/s) must exceed walk speed`);
    assert.ok(arrowRun.anim.gaitFrequency > reportMetrics.walkForwardFollow.gaitFrequencyHz, 'Running gait frequency must exceed walking frequency');

    await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');
    const arrowBack = await client.evaluate('() => window.__stepKeys([{ key: "ArrowDown", code: "ArrowDown" }], 50)');
    assert.strictEqual(arrowBack.last.anim.canonicalState, 'walk_backward', 'ArrowDown must trigger walk_backward');
    assert.ok(arrowBack.last.playerPosition.z < -206.9, 'ArrowDown must move character backward (-Z)');

    await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');
    const arrowLeft = await client.evaluate('() => window.__stepKeys([{ key: "ArrowLeft", code: "ArrowLeft" }], 30)');
    assert.strictEqual(arrowLeft.last.anim.canonicalState, 'turn_left', 'ArrowLeft must trigger turn_left');
    assert.ok(arrowLeft.last.playerHeading > 0.70, `ArrowLeft must turn character Left (+heading = ${arrowLeft.last.playerHeading})`);

    await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');
    const arrowRight = await client.evaluate('() => window.__stepKeys([{ key: "ArrowRight", code: "ArrowRight" }], 30)');
    assert.strictEqual(arrowRight.last.anim.canonicalState, 'turn_right', 'ArrowRight must trigger turn_right');
    assert.ok(arrowRight.last.playerHeading < -0.70, `ArrowRight must turn character Right (-heading = ${arrowRight.last.playerHeading})`);
    console.log(`✅ PASS: Arrow Keys & Run — ArrowUp walk_forward, Shift+ArrowUp run (${arrowRun.playerCurrentSpeed.toFixed(2)} m/s), ArrowDown walk_backward, ArrowLeft (+${arrowLeft.last.playerHeading.toFixed(2)} rad), ArrowRight (${arrowRight.last.playerHeading.toFixed(2)} rad)`);

    reportMetrics.arrowKeysAndRun = {
      arrowUpState: arrowFwd.last.anim.canonicalState,
      runSpeedMps: arrowRun.playerCurrentSpeed,
      runGaitFreqHz: arrowRun.anim.gaitFrequency,
      arrowDownState: arrowBack.last.anim.canonicalState,
      arrowLeftHeadingRad: arrowLeft.last.playerHeading,
      arrowRightHeadingRad: arrowRight.last.playerHeading
    };

    // =========================================================================
    // TEST 7: SWITCH INTO FRONT-FACING VIEW ([V]) AND REPEAT TESTS
    // =========================================================================
    console.log('\n[TEST 7] Switch into Front-Facing View ([V]) and verify W/S/A/D and Arrow keys are NOT inverted by camera...');
    await client.evaluate('() => window.__resetPlayerOnFootPose(-83.6, -206.0, 0)');
    await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'v', code: 'KeyV', bubbles: true }));
      for (let i = 0; i < 20; i++) updateSimulation(1/60);
    }`);

    const frontInit = await client.evaluate('() => window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics()');
    assert.strictEqual(frontInit.isFrontViewMode, true, 'KeyV must activate Front-Facing mode');
    assert.strictEqual(frontInit.cameraMode, 'front', 'cameraMode must be front');
    assert.ok(frontInit.cameraPosition.z > frontInit.playerPosition.z + 2.0, 'Front camera must be positioned in front (+Z) of character facing +Z');

    // Walk forward in Front View
    const frontWalkFwd = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
      for (let i = 0; i < 65; i++) updateSimulation(1/60);
      if (renderer && scene && camera) renderer.render(scene, camera);
      const diag = window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
      return diag;
    }`);
    await client.screenshot('locomotion_07_front_view_walk_forward.png');
    assert.strictEqual(frontWalkFwd.anim.canonicalState, 'walk_forward', 'W in Front View must trigger walk_forward');
    assert.ok(frontWalkFwd.playerPosition.z > frontInit.playerPosition.z + 2.0, 'W in Front View must move character forward along their facing direction (+Z), never inverted by camera');

    // Walk backward in Front View
    const frontWalkBack = await client.evaluate('() => window.__stepKeys([{ key: "s", code: "KeyS" }], 50)');
    assert.strictEqual(frontWalkBack.last.anim.canonicalState, 'walk_backward', 'S in Front View must trigger walk_backward');
    assert.ok(frontWalkBack.last.playerPosition.z < frontWalkFwd.playerPosition.z - 0.8, 'S in Front View must move character backward (-Z)');

    // Turn Left (A) and Turn Right (D) in Front View
    await client.evaluate('() => { playerHeading = 0; frontCamYaw = 0; playerAvatar.rotation.y = 0; }');
    const frontTurnLeft = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
      for (let i = 0; i < 30; i++) updateSimulation(1/60);
      if (renderer && scene && camera) renderer.render(scene, camera);
      const diag = window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      return diag;
    }`);
    await client.screenshot('locomotion_08_front_view_turn_left_right.png');
    await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }));
      playerHeading = 0; frontCamYaw = 0; playerAvatar.rotation.y = 0;
    }`);
    const frontTurnRight = await client.evaluate('() => window.__stepKeys([{ key: "d", code: "KeyD" }], 30)');

    assert.ok(frontTurnLeft.playerHeading > 0.70, `A in Front View must turn character Left (+heading = ${frontTurnLeft.playerHeading})`);
    assert.ok(frontTurnRight.last.playerHeading < -0.70, `D in Front View must turn character Right (-heading = ${frontTurnRight.last.playerHeading})`);

    // Restore standard follow camera with KeyV
    await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'v', code: 'KeyV', bubbles: true }));
      for (let i = 0; i < 15; i++) updateSimulation(1/60);
    }`);
    console.log(`✅ PASS: Front-Facing View ([V]) — W moves forward (+Z), S moves backward (-Z), A turns Left (+${frontTurnLeft.playerHeading.toFixed(2)} rad), D turns Right (${frontTurnRight.last.playerHeading.toFixed(2)} rad)`);

    reportMetrics.frontViewMode = {
      isFrontViewMode: frontInit.isFrontViewMode,
      walkForwardDeltaZM: Number((frontWalkFwd.playerPosition.z - frontInit.playerPosition.z).toFixed(3)),
      turnLeftHeadingRad: frontTurnLeft.playerHeading,
      turnRightHeadingRad: frontTurnRight.last.playerHeading
    };

    // =========================================================================
    // TEST 8: ENTER AND EXIT A CAR ([E])
    // =========================================================================
    console.log('\n[TEST 8] Enter and exit a car ([E])...');
    // Position player next to parked Adera Sedan at (-89.8, 0.05, -202)
    await client.evaluate('() => window.__resetPlayerOnFootPose(-87.2, -202.0, 0)');
    const enterRes = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', bubbles: true }));
      for (let i = 0; i < 15; i++) updateSimulation(1/60);
      return window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
    }`);
    assert.strictEqual(enterRes.isDriving, true, 'Pressing E near parked car must enter vehicle (isDriving = true)');
    assert.strictEqual(enterRes.cameraMode, 'chase', 'Entering vehicle must use chase camera');
    assert.ok(enterRes.anim.stateHistory.includes('enter_vehicle'), 'State history must record enter_vehicle transition');

    // Exit vehicle with E
    const exitRes = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', code: 'KeyE', bubbles: true }));
      for (let i = 0; i < 10; i++) updateSimulation(1/60);
      return window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
    }`);
    assert.strictEqual(exitRes.isDriving, false, 'Pressing E while stationary in car must exit vehicle (isDriving = false)');
    assert.ok(exitRes.anim.stateHistory.includes('exit_vehicle'), 'State history must record exit_vehicle transition');
    console.log(`✅ PASS: Vehicle Entry & Exit ([E]) — enter_vehicle & exit_vehicle states verified`);

    reportMetrics.vehicleMountDismount = {
      enteredDriving: enterRes.isDriving,
      exitedOnFoot: !exitRes.isDriving,
      recordedEnterState: enterRes.anim.stateHistory.includes('enter_vehicle'),
      recordedExitState: exitRes.anim.stateHistory.includes('exit_vehicle')
    };

    // =========================================================================
    // TEST 9: DRIVE LEFT AND RIGHT IN BOTH THIRD-PERSON (CHASE) AND COCKPIT (HOOD) VIEWS
    // =========================================================================
    console.log('\n[TEST 9] Drive Left and Right in both Third-Person (Chase) and Cockpit (Hood) views...');

    // Helper to reset player car on clear Broad Street asphalt facing +Z (heading = 0)
    await client.evaluate(`() => {
      window.__resetCarPose = (mode = 'chase') => {
        if (!isDriving) toggleVehicleMount();
        currentVehicle = playerCar;
        activeVehicleKey = 'sedan';
        cameraMode = mode;
        isFrontViewMode = false;
        currentSpeedKmh = 28;
        steeringAngle = 0;
        vehicleHeading = 0;
        playerCar.position.set(-102.0, 0.05, -180.0);
        playerCar.rotation.set(0, 0, 0);
        for (let i = 0; i < 5; i++) updateSimulation(1/60);
        renderer.render(scene, camera);
        return window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      };
    }`);

    // 9A: Third-Person Chase Camera — Drive Left (A) and Right (D)
    const chaseStartL = await client.evaluate('() => window.__resetCarPose("chase")');
    const chaseLeft = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
      for (let i = 0; i < 45; i++) updateSimulation(1/60);
      if (renderer && scene && camera) renderer.render(scene, camera);
      const diag = window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
      return diag;
    }`);
    await client.screenshot('locomotion_09_driving_chase_steer_left_right.png');

    const chaseDeltaXLeft = chaseLeft.vehiclePosition.x - chaseStartL.vehiclePosition.x;
    assert.strictEqual(chaseLeft.cameraMode, 'chase');
    assert.ok(chaseLeft.steeringAngle > 0.25, `Pressing A in Chase view must set positive steeringAngle (+Left), got ${chaseLeft.steeringAngle}`);
    assert.ok(chaseLeft.vehicleHeading > 0.25, `Driving Left (A) in Chase view must increase vehicleHeading (+yaw Left), got ${chaseLeft.vehicleHeading}`);
    assert.ok(chaseDeltaXLeft > 0.60, `Driving Left (A) facing +Z must move car toward +X (Left), got ΔX = +${chaseDeltaXLeft.toFixed(2)}m`);

    const chaseStartR = await client.evaluate('() => window.__resetCarPose("chase")');
    const chaseRight = await client.evaluate('() => window.__stepKeys([{ key: "w", code: "KeyW" }, { key: "d", code: "KeyD" }], 45)');
    const chaseDeltaXRight = chaseRight.last.vehiclePosition.x - chaseStartR.vehiclePosition.x;
    assert.ok(chaseRight.mid.steeringAngle < -0.25, `Pressing D in Chase view must set negative steeringAngle (-Right), got ${chaseRight.mid.steeringAngle}`);
    assert.ok(chaseRight.last.vehicleHeading < -0.25, `Driving Right (D) in Chase view must decrease vehicleHeading (-yaw Right), got ${chaseRight.last.vehicleHeading}`);
    assert.ok(chaseDeltaXRight < -0.60, `Driving Right (D) facing +Z must move car toward -X (Right), got ΔX = ${chaseDeltaXRight.toFixed(2)}m`);

    // 9B: Cockpit (Hood) Camera — toggle via KeyC and test ArrowLeft / ArrowRight steering
    await client.evaluate('() => window.__resetCarPose("chase")');
    await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', code: 'KeyC', bubbles: true }));
    }`);
    const hoodStartL = await client.evaluate('() => window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics()');
    assert.strictEqual(hoodStartL.cameraMode, 'hood', 'KeyC while driving must switch to hood (cockpit) camera');

    const hoodLeft = await client.evaluate(`() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
      for (let i = 0; i < 45; i++) updateSimulation(1/60);
      if (renderer && scene && camera) renderer.render(scene, camera);
      const diag = window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
      return diag;
    }`);
    await client.screenshot('locomotion_10_driving_cockpit_steer_left_right.png');

    const hoodDeltaXLeft = hoodLeft.vehiclePosition.x - hoodStartL.vehiclePosition.x;
    assert.ok(hoodLeft.steeringAngle > 0.25, `ArrowLeft in Cockpit view must set positive steeringAngle (+Left), got ${hoodLeft.steeringAngle}`);
    assert.ok(hoodLeft.vehicleHeading > 0.25, `Driving Left (ArrowLeft) in Cockpit view must increase vehicleHeading (+yaw Left), got ${hoodLeft.vehicleHeading}`);
    assert.ok(hoodDeltaXLeft > 0.60, `Driving Left (ArrowLeft) in Cockpit view must move car toward +X (Left), got ΔX = +${hoodDeltaXLeft.toFixed(2)}m`);

    const hoodStartR = await client.evaluate('() => window.__resetCarPose("hood")');
    const hoodRight = await client.evaluate('() => window.__stepKeys([{ key: "ArrowUp", code: "ArrowUp" }, { key: "ArrowRight", code: "ArrowRight" }], 45)');
    const hoodDeltaXRight = hoodRight.last.vehiclePosition.x - hoodStartR.vehiclePosition.x;
    assert.ok(hoodRight.mid.steeringAngle < -0.25, `ArrowRight in Cockpit view must set negative steeringAngle (-Right), got ${hoodRight.mid.steeringAngle}`);
    assert.ok(hoodRight.last.vehicleHeading < -0.25, `Driving Right (ArrowRight) in Cockpit view must decrease vehicleHeading (-yaw Right), got ${hoodRight.last.vehicleHeading}`);
    assert.ok(hoodDeltaXRight < -0.60, `Driving Right (ArrowRight) in Cockpit view must move car toward -X (Right), got ΔX = ${hoodDeltaXRight.toFixed(2)}m`);

    console.log(`✅ PASS: Driving Steering in Chase & Cockpit Views — Chase L/R ΔX = +${chaseDeltaXLeft.toFixed(2)}m / ${chaseDeltaXRight.toFixed(2)}m, Cockpit L/R ΔX = +${hoodDeltaXLeft.toFixed(2)}m / ${hoodDeltaXRight.toFixed(2)}m`);

    reportMetrics.drivingSteering = {
      chaseSteerLeftAngle: chaseLeft.steeringAngle,
      chaseSteerLeftHeading: chaseLeft.vehicleHeading,
      chaseSteerLeftDeltaXM: Number(chaseDeltaXLeft.toFixed(3)),
      chaseSteerRightAngle: chaseRight.mid.steeringAngle,
      chaseSteerRightHeading: chaseRight.last.vehicleHeading,
      chaseSteerRightDeltaXM: Number(chaseDeltaXRight.toFixed(3)),
      cockpitSteerLeftAngle: hoodLeft.steeringAngle,
      cockpitSteerLeftHeading: hoodLeft.vehicleHeading,
      cockpitSteerLeftDeltaXM: Number(hoodDeltaXLeft.toFixed(3)),
      cockpitSteerRightAngle: hoodRight.mid.steeringAngle,
      cockpitSteerRightHeading: hoodRight.last.vehicleHeading,
      cockpitSteerRightDeltaXM: Number(hoodDeltaXRight.toFixed(3))
    };

    // Verify 0 uncaught runtime/console errors
    assert.strictEqual(client.pageErrors.length, 0, `Expected 0 uncaught page errors, got: ${client.pageErrors.join('; ')}`);
    assert.strictEqual(client.consoleErrors.length, 0, `Expected 0 console errors, got: ${client.consoleErrors.join('; ')}`);

    reportMetrics.consoleErrors = client.consoleErrors.length;
    reportMetrics.pageErrors = client.pageErrors.length;
    fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(reportMetrics, null, 2));

    console.log('\n================================================================');
    console.log('🎉 ALL CHARACTER LOCOMOTION & DIRECTIONAL CONTROL TESTS PASSED!');
    console.log('================================================================');
  } finally {
    if (client) client.close();
    chromeProc.kill('SIGKILL');
  }
}

runLocomotionVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
