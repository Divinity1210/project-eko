#!/usr/bin/env node
/**
 * PROJECT EKO — MOBILE-FIRST GAMEPLAY, TOUCH CONTROLS & MULTI-VIEWPORT VERIFICATION
 * Launches Headless Google Chrome over CDP and verifies all Section A–F acceptance
 * requirements across 7 viewports (320x568, 360x640, 360x800, 390x844, 430x932,
 * 780x360 landscape, and 1366x768 desktop).
 */

const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9227;
const SCREENSHOT_DIR = path.join(__dirname, '..', 'ANTIGRAVITY', 'DELIVERY', 'screenshots');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = new URL(wsUrl);
    this.socket = null;
    this.msgId = 0;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const req = http.request({
        hostname: this.wsUrl.hostname,
        port: this.wsUrl.port,
        path: this.wsUrl.pathname + this.wsUrl.search,
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13'
        }
      });

      req.on('upgrade', (res, socket, head) => {
        this.socket = socket;
        if (head && head.length > 0) {
          this._onData(head);
        }
        socket.on('data', (chunk) => this._onData(chunk));
        socket.on('error', (err) => console.error('CDP Socket Error:', err.message));
        resolve();
      });

      req.on('error', reject);
      req.end();
    });
  }

  _sendFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81;
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
      masked[i] = payload[i] ^ mask[i % 4];
    }
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const secondByte = this.buffer[1];
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < 4) return;
        payloadLen = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (this.buffer.length < 10) return;
        payloadLen = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      if (isMasked) offset += 4;
      if (this.buffer.length < offset + payloadLen) return;

      const opcode = this.buffer[0] & 0x0f;
      const payload = this.buffer.slice(offset, offset + payloadLen);
      this.buffer = this.buffer.slice(offset + payloadLen);

      if (opcode === 0x01) {
        this._handleMessage(payload.toString('utf8'));
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

  async setViewport(width, height, mobile = true) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile
    });
    await this.send('Emulation.setTouchEmulationEnabled', {
      enabled: mobile,
      maxTouchPoints: mobile ? 5 : 1
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
  const userDataDir = path.join('/tmp', `eko-chrome-mobile-${Date.now()}`);

  console.log('🚀 Launching Headless Google Chrome for Project Eko Mobile-First Gameplay Verification...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=390,844',
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
    await client.setViewport(390, 844, true);

    await sleep(2000);

    // Helper to step simulation frames deterministically and render
    const stepSim = async (frames = 45, dt = 1 / 60) => {
      return await client.evaluate(`() => {
        for (let i = 0; i < ${frames}; i++) {
          const t0 = performance.now();
          updateSimulation(${dt});
          if (i === ${frames} - 1 || i % 6 === 0) {
            renderer.render(scene, camera);
          }
          const execMs = performance.now() - t0;
          if (window.__PROJECT_EKO_PERF_MANAGER__) {
            window.__PROJECT_EKO_PERF_MANAGER__.recordFrame(
              Math.max(16.67, execMs),
              renderer.info.render.calls,
              renderer.info.render.triangles
            );
          }
        }
        renderer.render(scene, camera);
        return {
          loco: window.__PROJECT_EKO_LOCOMOTION__.getDiagnostics(),
          mobile: window.__PROJECT_EKO_MOBILE__.getDiagnostics(),
          perf: window.__PROJECT_EKO_PERF_MANAGER__.getDiagnostics(),
          interaction: window.__PROJECT_EKO_INTERACTION__.getDiagnostics()
        };
      }`);
    };

    // =========================================================================
    // 1. MULTI-VIEWPORT BREAKPOINT & ZERO-OVERLAP AUDIT (ON-FOOT & DRIVING)
    // =========================================================================
    const targetViewports = [
      { width: 320, height: 568, mobile: true, label: '320x568_portrait' },
      { width: 360, height: 640, mobile: true, label: '360x640_portrait' },
      { width: 360, height: 800, mobile: true, label: '360x800_portrait' },
      { width: 390, height: 844, mobile: true, label: '390x844_portrait' },
      { width: 430, height: 932, mobile: true, label: '430x932_portrait' },
      { width: 780, height: 360, mobile: true, label: '780x360_landscape' },
      { width: 1366, height: 768, mobile: false, label: '1366x768_desktop' }
    ];

    const viewportAuditResults = [];

    console.log('\n📱 Testing all 7 target viewports in On-Foot mode...');
    await client.evaluate(`() => {
      if (isDriving) toggleVehicleMount();
      const toast = document.getElementById('toast-notification');
      if (toast) toast.classList.remove('active');
    }`);

    for (const vp of targetViewports) {
      await client.setViewport(vp.width, vp.height, vp.mobile);
      await sleep(180);
      const state = await stepSim(5);
      const audit = state.mobile.layoutAudit;
      console.log(`   • [On-Foot ${vp.label}] Elements=${audit.measuredElementCount}, Overlaps=${audit.overlapCount}, OutOfBounds=${audit.outOfBoundsCount}, Preset=${state.perf.activePreset}`);
      assert.strictEqual(audit.overlapCount, 0, `Expected 0 HUD overlaps at ${vp.label} On-Foot, got: ${JSON.stringify(audit.overlaps)}`);
      assert.strictEqual(audit.outOfBoundsCount, 0, `Expected 0 out-of-bounds HUD elements at ${vp.label} On-Foot, got: ${JSON.stringify(audit.outOfBounds)}`);
      if (vp.mobile) {
        assert.strictEqual(state.mobile.touchControlsVisible, true, `Touch controls must be visible at mobile viewport ${vp.label}`);
      } else {
        assert.strictEqual(state.mobile.touchControlsVisible, false, `Touch controls must be hidden on desktop viewport ${vp.label}`);
      }
      await client.screenshot(`mobile_onfoot_${vp.label}.png`);
      viewportAuditResults.push({ viewport: vp.label, mode: 'onfoot', ...audit, preset: state.perf.activePreset });
    }

    // =========================================================================
    // 2. SMARTPHONE ON-FOOT TOUCH CONTROLS (NO KEYBOARD) AT 390x844
    // =========================================================================
    console.log('\n🕹️ Testing On-Foot Touch Controls at 390x844 (Smartphone Portrait without Keyboard)...');
    await client.setViewport(390, 844, true);
    await client.evaluate(`() => {
      if (isDriving) toggleVehicleMount();
      playerAvatar.position.set(-96.0, 0.05, -185.0);
      playerHeading = 0;
      followCamYaw = 0;
      frontCamYaw = 0;
      playerCurrentSpeed = 0;
      playerTurnVel = 0;
      window.__PROJECT_EKO_MOBILE__.cancelAllInputs('test_reset');
    }`);
    await stepSim(15);

    // 2A. Virtual Joystick Walk Forward
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.simulateJoystick(0, -0.72)`);
    const joyFwdState = await stepSim(50);
    console.log('   • Virtual Joystick Forward:', {
      joyY: joyFwdState.mobile.joyY,
      speed: joyFwdState.loco.playerCurrentSpeed,
      state: joyFwdState.loco.anim.canonicalState,
      z: joyFwdState.loco.playerPosition.z
    });
    assert.strictEqual(joyFwdState.mobile.keysState.w, true, 'Joystick up must activate forward movement (keys.w)');
    assert.ok(joyFwdState.loco.playerCurrentSpeed > 1.5, 'Joystick forward must accelerate player forward');
    assert.strictEqual(joyFwdState.loco.anim.canonicalState, 'walk_forward', 'Joystick forward must play walk_forward gait');
    assert.ok(joyFwdState.loco.playerPosition.z > -184.0, 'Joystick forward must move player along +Z');

    // Release Joystick -> Stop cleanly
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.releaseJoystick()`);
    const joyStopState = await stepSim(45);
    assert.strictEqual(joyStopState.loco.playerCurrentSpeed, 0, 'Releasing joystick must bring player to 0 speed');
    assert.strictEqual(joyStopState.loco.anim.canonicalState, 'idle', 'Releasing joystick must return character to idle');

    // 2B. Virtual Joystick Walk Backward
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.simulateJoystick(0, 0.78)`);
    const joyBackState = await stepSim(45);
    console.log('   • Virtual Joystick Backward:', {
      joyY: joyBackState.mobile.joyY,
      speed: joyBackState.loco.playerCurrentSpeed,
      state: joyBackState.loco.anim.canonicalState
    });
    assert.strictEqual(joyBackState.mobile.keysState.s, true, 'Joystick down must activate backward movement (keys.s)');
    assert.ok(joyBackState.loco.playerCurrentSpeed < -1.0, 'Joystick down must move player backward');
    assert.strictEqual(joyBackState.loco.anim.canonicalState, 'walk_backward', 'Joystick down must play walk_backward gait');
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.releaseJoystick()`);
    await stepSim(40);

    // 2C. Dedicated Turn Left & Turn Right Touch Buttons
    const headingBeforeTurn = (await stepSim(2)).loco.playerHeading;
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-turn-left')`);
    const turnLeftState = await stepSim(30);
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-turn-left')`);
    await stepSim(15);

    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-turn-right')`);
    const turnRightState = await stepSim(30);
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-turn-right')`);
    await stepSim(15);

    console.log('   • Dedicated Turn Buttons:', {
      headingBeforeTurn,
      afterTurnLeft: turnLeftState.loco.playerHeading,
      turnLeftAnim: turnLeftState.loco.anim.canonicalState,
      afterTurnRight: turnRightState.loco.playerHeading,
      turnRightAnim: turnRightState.loco.anim.canonicalState
    });
    assert.ok(turnLeftState.loco.playerHeading > headingBeforeTurn + 0.3, 'Touch Turn Left button must rotate character Left (+yaw)');
    assert.strictEqual(turnLeftState.loco.anim.canonicalState, 'turn_left', 'Touch Turn Left button must trigger turn_left state');
    assert.ok(turnRightState.loco.playerHeading < turnLeftState.loco.playerHeading - 0.3, 'Touch Turn Right button must rotate character Right (-yaw)');
    assert.strictEqual(turnRightState.loco.anim.canonicalState, 'turn_right', 'Touch Turn Right button must trigger turn_right state');

    // 2D. Run Control Button (Tap Latch + Joystick Forward)
    await client.evaluate(`() => {
      window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-foot-run');
      window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-foot-run');
      window.__PROJECT_EKO_MOBILE__.simulateJoystick(0, -0.85);
    }`);
    const runState = await stepSim(45);
    console.log('   • Touch Run Control:', {
      runLatched: runState.mobile.runLatched,
      speed: runState.loco.playerCurrentSpeed,
      state: runState.loco.anim.canonicalState
    });
    assert.strictEqual(runState.mobile.runLatched, true, 'Tapping #btn-touch-foot-run must latch sprint mode');
    assert.ok(runState.loco.playerCurrentSpeed > 4.2, 'Running with touch control must exceed 4.2 m/s');
    assert.strictEqual(runState.loco.anim.canonicalState, 'run', 'Running with touch control must play run state');
    await client.evaluate(`() => {
      window.__PROJECT_EKO_MOBILE__.releaseJoystick();
      window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-foot-run');
      window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-foot-run');
    }`);
    await stepSim(40);

    // 2E. Touch Camera / Front-View Button (#btn-touch-foot-cam)
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-foot-cam')`);
    const frontCamTouchState = await stepSim(15);
    assert.strictEqual(frontCamTouchState.loco.isFrontViewMode, true, 'Tapping #btn-touch-foot-cam must activate Front-Facing Selfie view');
    await sleep(300);
    await client. evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-foot-cam')`);
    const chaseCamTouchState = await stepSim(10);
    assert.strictEqual(chaseCamTouchState.loco.isFrontViewMode, false, 'Second tap on #btn-touch-foot-cam must return to Follow view');

    // 2F. Touch Interaction Button (#btn-touch-foot-interact) -> Enter Vehicle + Rapid-Tap Debounce
    const mountDebounceTest = await client.evaluate(`() => {
      playerAvatar.position.set(playerCar.position.x + 2.2, 0.05, playerCar.position.z);
      const beforeSuppressions = window.__PROJECT_EKO_MOBILE__.debouncedTapSuppressions;
      // Simulate 5 rapid consecutive touch taps within 20ms
      for (let i = 0; i < 5; i++) {
        window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-foot-interact');
      }
      const afterSuppressions = window.__PROJECT_EKO_MOBILE__.debouncedTapSuppressions;
      return {
        isDrivingAfterRapidTaps: isDriving,
        suppressionsAdded: afterSuppressions - beforeSuppressions,
        mobileDiag: window.__PROJECT_EKO_MOBILE__.getDiagnostics()
      };
    }`);
    console.log('   • Touch Interact Vehicle Entry & Rapid-Tap Debounce:', {
      isDriving: mountDebounceTest.isDrivingAfterRapidTaps,
      activeMode: mountDebounceTest.mobileDiag.activeMode,
      suppressionsAdded: mountDebounceTest.suppressionsAdded
    });
    assert.strictEqual(mountDebounceTest.isDrivingAfterRapidTaps, true, 'Tapping #btn-touch-foot-interact near vehicle must enter vehicle');
    assert.strictEqual(mountDebounceTest.mobileDiag.activeMode, 'driving', 'Entering vehicle must automatically switch touch controls to driving mode');
    assert.ok(mountDebounceTest.suppressionsAdded >= 4, 'Rapid repeated touch taps on Interact must be debounced so player does not immediately exit vehicle');

    // =========================================================================
    // 3. MULTI-VIEWPORT AUDIT IN DRIVING MODE (ALL 7 TARGET VIEWPORTS)
    // =========================================================================
    console.log('\n🚗 Testing all 7 target viewports in Driving mode...');
    await client.evaluate(`() => {
      const toast = document.getElementById('toast-notification');
      if (toast) toast.classList.remove('active');
    }`);
    for (const vp of targetViewports) {
      await client.setViewport(vp.width, vp.height, vp.mobile);
      await sleep(180);
      const state = await stepSim(5);
      const audit = state.mobile.layoutAudit;
      console.log(`   • [Driving ${vp.label}] Elements=${audit.measuredElementCount}, Overlaps=${audit.overlapCount}, OutOfBounds=${audit.outOfBoundsCount}`);
      assert.strictEqual(audit.overlapCount, 0, `Expected 0 HUD overlaps at ${vp.label} Driving, got: ${JSON.stringify(audit.overlaps)}`);
      assert.strictEqual(audit.outOfBoundsCount, 0, `Expected 0 out-of-bounds HUD elements at ${vp.label} Driving, got: ${JSON.stringify(audit.outOfBounds)}`);
      await client.screenshot(`mobile_driving_${vp.label}.png`);
      viewportAuditResults.push({ viewport: vp.label, mode: 'driving', ...audit, preset: state.perf.activePreset });
    }

    // =========================================================================
    // 4. DRIVING TOUCH CONTROLS & SIMULTANEOUS THROTTLE + STEERING (780x360 LANDSCAPE)
    // =========================================================================
    console.log('\n🏎️ Testing Driving Touch Controls & Simultaneous Throttle + Steering at 780x360 Landscape...');
    await client.setViewport(780, 360, true);
    await client.evaluate(`() => {
      if (!isDriving) quickSwitchVehicle('danfo');
      currentVehicle.position.set(-96.0, 0.05, -180.0);
      currentVehicle.rotation.set(0, 0, 0);
      vehicleHeading = 0;
      currentSpeedKmh = 0;
      steeringAngle = 0;
      window.__PROJECT_EKO_MOBILE__.cancelAllInputs('reset_driving_test');
    }`);
    await stepSim(10);

    // 4A. Independent Accelerator (#btn-touch-drive-gas)
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-gas')`);
    const gasOnlyState = await stepSim(45);
    assert.strictEqual(gasOnlyState.mobile.keysState.w, true, 'Holding #btn-touch-drive-gas must set keys.w = true');
    assert.ok(gasOnlyState.loco.currentSpeedKmh > 18, `Accelerator must increase vehicle speed (got ${gasOnlyState.loco.currentSpeedKmh} km/h)`);

    // 4B. Simultaneous Accelerator + Left Steer (#btn-touch-drive-gas + #btn-touch-steer-left)
    const headingBeforeSteerL = gasOnlyState.loco.vehicleHeading;
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-steer-left')`);
    const simSteerLeftState = await stepSim(40);
    console.log('   • Simultaneous Gas + Left Steer:', {
      activeButtons: simSteerLeftState.mobile.activeButtons,
      speedKmh: simSteerLeftState.loco.currentSpeedKmh,
      steeringAngle: simSteerLeftState.loco.steeringAngle,
      headingBefore: headingBeforeSteerL,
      headingAfter: simSteerLeftState.loco.vehicleHeading
    });
    assert.strictEqual(simSteerLeftState.mobile.keysState.w, true, 'Accelerator must remain active during simultaneous left steering');
    assert.strictEqual(simSteerLeftState.mobile.keysState.a, true, 'Left steer must be active simultaneously with accelerator');
    assert.ok(simSteerLeftState.loco.steeringAngle > 0.1, 'Left touch steer must produce positive steeringAngle');
    assert.ok(simSteerLeftState.loco.vehicleHeading > headingBeforeSteerL + 0.12, 'Simultaneous gas + left steer must turn vehicle Left (+yaw)');

    // 4C. Simultaneous Accelerator + Right Steer (#btn-touch-drive-gas + #btn-touch-steer-right)
    await client.evaluate(`() => {
      window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-steer-left');
      window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-steer-right');
    }`);
    const simSteerRightState = await stepSim(45);
    console.log('   • Simultaneous Gas + Right Steer:', {
      activeButtons: simSteerRightState.mobile.activeButtons,
      speedKmh: simSteerRightState.loco.currentSpeedKmh,
      steeringAngle: simSteerRightState.loco.steeringAngle,
      headingAfter: simSteerRightState.loco.vehicleHeading
    });
    assert.strictEqual(simSteerRightState.mobile.keysState.w, true, 'Accelerator must remain active during simultaneous right steering');
    assert.strictEqual(simSteerRightState.mobile.keysState.d, true, 'Right steer must be active simultaneously with accelerator');
    assert.ok(simSteerRightState.loco.steeringAngle < -0.1, 'Right touch steer must produce negative steeringAngle');
    assert.ok(simSteerRightState.loco.vehicleHeading < simSteerLeftState.loco.vehicleHeading - 0.12, 'Simultaneous gas + right steer must turn vehicle Right (-yaw)');

    // Release gas & right steer
    await client.evaluate(`() => {
      window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-drive-gas');
      window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-steer-right');
    }`);

    // 4D. Handbrake (#btn-touch-drive-handbrake) & Brake/Reverse (#btn-touch-drive-brake)
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-handbrake')`);
    const handbrakeState = await stepSim(45);
    assert.strictEqual(handbrakeState.loco.currentSpeedKmh, 0, 'Holding touch handbrake must bring vehicle to a complete stop');
    await client.evaluate(`() => {
      window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-drive-handbrake');
      window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-brake');
    }`);
    const reverseState = await stepSim(40);
    assert.strictEqual(reverseState.mobile.keysState.s, true, 'Holding #btn-touch-drive-brake must set keys.s = true');
    assert.ok(reverseState.loco.currentSpeedKmh < -3, `Holding brake/reverse from standstill must reverse vehicle (got ${reverseState.loco.currentSpeedKmh} km/h)`);
    await client.evaluate(`() => {
      window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-drive-brake');
      currentSpeedKmh = 0;
    }`);

    // 4E. Horn (#btn-touch-drive-horn) & Camera Switch (#btn-touch-drive-cam)
    await sleep(300);
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-horn')`);
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.releaseButton('btn-touch-drive-horn')`);
    const hornTouchState = await stepSim(5);
    assert.strictEqual(hornTouchState.interaction.lastOutcome.action, 'HORN_BLAST_TOUCH', 'Touch horn button must trigger HORN_BLAST_TOUCH');

    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-cam')`);
    const hoodCamTouchState = await stepSim(10);
    assert.strictEqual(hoodCamTouchState.loco.cameraMode, 'hood', 'Touch driving camera button must switch to cockpit/hood view');
    await sleep(320);
    await client.evaluate(`() => window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-cam')`);
    const chaseBackState = await stepSim(10);
    assert.strictEqual(chaseBackState.loco.cameraMode, 'chase', 'Second tap on driving camera button must return to chase view');

    // 4F. Pointer Cancellation / Focus Loss Reset
    await client.evaluate(`() => {
      window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-gas');
      window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-steer-left');
      window.dispatchEvent(new Event('blur'));
    }`);
    const cancelState = await stepSim(5);
    console.log('   • Input Cancellation on Focus Loss:', {
      activeButtons: cancelState.mobile.activeButtons,
      keysState: cancelState.mobile.keysState,
      cancelCount: cancelState.mobile.cancellationEventsCount,
      lastReason: cancelState.mobile.lastCancelReason
    });
    assert.strictEqual(cancelState.mobile.activeButtons.length, 0, 'Blur/cancellation must clear all active touch buttons');
    assert.strictEqual(cancelState.mobile.keysState.w, false, 'Blur/cancellation must reset keys.w to false');
    assert.strictEqual(cancelState.mobile.keysState.a, false, 'Blur/cancellation must reset keys.a to false');

    // 4G. Driving Interact / Exit Button (#btn-touch-drive-interact)
    await sleep(400);
    await client.evaluate(`() => {
      currentSpeedKmh = 0;
      if (currentVehicle) {
        currentVehicle.position.set(-66.5, currentVehicle.position.y, -155.0);
      }
      activeNearbyBusStop = null;
      window.__PROJECT_EKO_MOBILE__.syncModeUI(true);
      window.__PROJECT_EKO_MOBILE__.pressButton('btn-touch-drive-interact');
    }`);
    const exitTouchState = await stepSim(10);
    assert.strictEqual(exitTouchState.loco.isDriving, false, 'Tapping #btn-touch-drive-interact while stopped must exit vehicle');
    assert.strictEqual(exitTouchState.mobile.activeMode, 'onfoot', 'Exiting vehicle must switch touch controls back to onfoot mode');

    // =========================================================================
    // 5. EXPANDABLE MOBILE TOOLS DRAWER & EKOPHONE READABILITY AT 390x844
    // =========================================================================
    console.log('\n📂 Testing Expandable Mobile Tools Drawer & EkoPhone at 390x844...');
    await client.setViewport(390, 844, true);
    await sleep(200);
    const drawerOpenState = await client.evaluate(`() => {
      toggleMobileHudDrawer(true);
      const drawer = document.getElementById('mobile-hud-drawer');
      const r = drawer.getBoundingClientRect();
      return {
        isActive: drawer.classList.contains('active'),
        rect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) }
      };
    }`);
    assert.strictEqual(drawerOpenState.isActive, true, 'toggleMobileHudDrawer(true) must open #mobile-hud-drawer');
    assert.ok(drawerOpenState.rect.left >= 0 && drawerOpenState.rect.right <= 390, 'Mobile tools drawer must fit within 390px viewport');
    await client.screenshot('mobile_tools_drawer_390x844.png');

    // Close drawer, open EkoPhone Dealership, test rapid duplicate purchase protection, and close via #btn-close-ekophone
    const phoneTest = await client.evaluate(`() => {
      toggleMobileHudDrawer(false);
      const phone = document.getElementById('eko-phone-container');
      phone.style.transition = 'none';
      if (!phone.classList.contains('active')) toggleEkoPhone();
      openPhoneApp('dealership');
      void phone.offsetHeight;
      const r = phone.getBoundingClientRect();

      // Test rapid duplicate purchase protection
      player.balance = 95000;
      player.ownedVehicleModels = player.ownedVehicleModels.filter(m => m !== 'koro_okada_125');
      player.ownedVehicles = player.ownedVehicles.filter(v => v !== 'okada');
      const firstBuy = buyDealershipVehicle('koro_okada_125', 35000);
      const rapidSecondBuy = buyDealershipVehicle('koro_okada_125', 35000);

      return {
        phoneActive: phone.classList.contains('active'),
        phoneRect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
        firstBuy,
        rapidSecondBuy
      };
    }`);
    console.log('   • EkoPhone Dealership & Rapid-Buy Protection:', phoneTest);
    assert.strictEqual(phoneTest.phoneActive, true, 'EkoPhone must open on mobile');
    assert.ok(phoneTest.phoneRect.left >= 0 && phoneTest.phoneRect.right <= 390 && phoneTest.phoneRect.bottom <= 844, 'EkoPhone must fit inside 390x844 viewport');
    assert.strictEqual(phoneTest.firstBuy, true, 'First dealership purchase must succeed');
    assert.strictEqual(phoneTest.rapidSecondBuy, false, 'Rapid duplicate dealership purchase must be blocked');
    await client.screenshot('mobile_ekophone_dealership_390x844.png');

    // Close EkoPhone using the new mobile close button (#btn-close-ekophone)
    const phoneClosed = await client.evaluate(`() => {
      const closeBtn = document.getElementById('btn-close-ekophone');
      if (closeBtn) closeBtn.click();
      return !document.getElementById('eko-phone-container').classList.contains('active');
    }`);
    assert.strictEqual(phoneClosed, true, '#btn-close-ekophone must close EkoPhone on mobile');

    // =========================================================================
    // 6. MOBILE PERFORMANCE & QUALITY PRESETS BENCHMARK
    // =========================================================================
    console.log('\n⚡ Profiling Mobile Performance & Quality Presets (mobile_low, mobile_balanced, desktop_high)...');
    const perfBenchmarks = {};
    for (const preset of ['mobile_low', 'mobile_balanced', 'desktop_high']) {
      await client.evaluate(`() => window.__PROJECT_EKO_PERF_MANAGER__.applyPreset('${preset}')`);
      const pState = await stepSim(30);
      perfBenchmarks[preset] = pState.perf;
      console.log(`   • Preset [${preset}]: FPS=${pState.perf.measuredFps}, FrameTime=${pState.perf.avgFrameTimeMs}ms, Calls=${pState.perf.drawCalls}, Tris=${pState.perf.triangles}, Shadows=${pState.perf.shadowEnabled}, NPC_LOD=${JSON.stringify(pState.perf.npcAnimationLOD)}`);
      assert.ok(pState.perf.drawCalls <= 75, `Draw calls (${pState.perf.drawCalls}) must stay within budget <= 75`);
      assert.ok(pState.perf.triangles <= 35000, `Triangles (${pState.perf.triangles}) must stay within budget <= 35,000`);
    }

    // =========================================================================
    // 7. DESKTOP KEYBOARD CONTROLS VERIFICATION (1366x768)
    // =========================================================================
    console.log('\n💻 Verifying Desktop Keyboard Controls at 1366x768...');
    await client.setViewport(1366, 768, false);
    await sleep(200);
    const desktopCheck = await client.evaluate(`() => {
      if (isDriving) toggleVehicleMount();
      const z0 = playerAvatar.position.z;
      keys.w = true;
      for (let i = 0; i < 30; i++) updateSimulation(1 / 60);
      keys.w = false;
      const z1 = playerAvatar.position.z;
      const quickCard = document.querySelector('.quick-controls-card');
      const touchEl = document.getElementById('mobile-touch-controls');
      return {
        movedForwardM: Number((z1 - z0).toFixed(3)),
        quickCardVisible: quickCard ? window.getComputedStyle(quickCard).display !== 'none' : false,
        touchHidden: touchEl ? window.getComputedStyle(touchEl).display === 'none' : false
      };
    }`);
    assert.ok(desktopCheck.movedForwardM > 0.6, 'Desktop keyboard W must move player forward');
    assert.strictEqual(desktopCheck.quickCardVisible, true, 'Desktop keyboard card must be visible at 1366x768');
    assert.strictEqual(desktopCheck.touchHidden, true, 'Mobile touch controls must be hidden at 1366x768');

    assert.strictEqual(client.pageErrors.length, 0, `Expected 0 page errors, got: ${client.pageErrors.join('; ')}`);

    console.log('\n================================================================');
    console.log('✅ MOBILE-FIRST GAMEPLAY & MULTI-VIEWPORT VERIFICATION PASSED!');
    console.log(`   • Viewports Verified: ${targetViewports.map(v => v.label).join(', ')}`);
    console.log('   • HUD Overlaps Across All 7 Viewports (On-Foot & Driving): 0');
    console.log('   • On-Foot Touch Controls: Joystick, Turn L/R, Run, Cam, Interact PASS');
    console.log('   • Driving Touch Controls: Multi-Touch Gas+Steer, Brake/Rev, Handbrake, Horn, Cam, Exit PASS');
    console.log(`   • Load Time: ${perfBenchmarks.mobile_balanced.loadTimeMs} ms`);
    console.log('================================================================');
  } finally {
    if (client) client.close();
    chromeProc.kill('SIGKILL');
  }
}

runVerification().catch((err) => {
  console.error('❌ Mobile-First Gameplay Verification Failed:', err);
  process.exit(1);
});
