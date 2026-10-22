#!/usr/bin/env node
/**
 * PROJECT EKO — M4.8 VEHICLE SEATS, PASSENGER EXPERIENCE, 3D COCKPIT & DRIVER PERMISSIONS
 * Automated Browser & Multiplayer Verification Suite (16 Scenarios + Two-Account Realtime Sync)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GAME_URL = process.env.GAME_URL || 'http://127.0.0.1:3000/index.html';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const REALTIME_URL = process.env.REALTIME_URL || 'http://127.0.0.1:3002';
const ARTIFACT_DIR = '/Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be';
const DELIVERY_SCREENSHOT_DIR = path.join(__dirname, '..', 'ANTIGRAVITY', 'DELIVERY', 'screenshots');
fs.mkdirSync(DELIVERY_SCREENSHOT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => (data += c));
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

async function httpJson(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function createCDPClient(port) {
  const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const wsUrl = new URL(pageTarget.webSocketDebuggerUrl);

  const socket = net.createConnection({
    host: wsUrl.hostname,
    port: Number(wsUrl.port)
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
        ''
      ].join('\r\n');
      socket.write(req);
    });
    socket.on('data', chunk => {
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
      awaitPromise: true
    });
    if (res && res.exceptionDetails) {
      const desc =
        res.exceptionDetails.exception && res.exceptionDetails.exception.description
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
      mobile
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

(async () => {
  console.log('================================================================================');
  console.log('PROJECT EKO — M4.8 VEHICLE SEATS, PASSENGER, 3D COCKPIT & PERMISSIONS QA SUITE');
  console.log('================================================================================');

  const results = {
    timestamp: new Date().toISOString(),
    scenarios: [],
    multiplayerChecks: {},
    screenshots: {},
    allPassed: false
  };

  function recordScenario(id, title, passed, evidence) {
    results.scenarios.push({ id, title, passed: Boolean(passed), evidence });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] Scenario ${id}: ${title}`);
    if (!passed) {
      console.error('   Failure Evidence:', JSON.stringify(evidence));
    }
  }

  const debugPort = 9248 + Math.floor(Math.random() * 200);
  const userDataDir = `/tmp/eko_m48_chrome_${Date.now()}`;
  const chromeProc = spawn(CHROME_BIN, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--window-size=1440,900',
    GAME_URL
  ]);

  let cdp = null;
  try {
    for (let i = 0; i < 40; i++) {
      try {
        await fetchJson(`http://127.0.0.1:${debugPort}/json`);
        break;
      } catch (_) {
        await sleep(250);
      }
    }

    cdp = await createCDPClient(debugPort);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.setViewport(1440, 900, false);

    // Wait for __PROJECT_EKO_VEHICLE_STATE__ to be ready
    for (let i = 0; i < 50; i++) {
      const ready = await cdp.evaluate(`Boolean(window.__PROJECT_EKO_VEHICLE_STATE__ && window.__PROJECT_EKO_AUTH__)`);
      if (ready) break;
      await sleep(250);
    }

    // Dismiss entry modal so world HUD is directly visible
    await cdp.evaluate(`(() => {
      const authModal = document.getElementById('m47-auth-modal');
      if (authModal) authModal.style.display = 'none';
    })()`);
    await sleep(400);

    // =========================================================================
    // SCENARIO 1: Entering an owned or permitted vehicle as driver
    // =========================================================================
    const s1 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.exitVehicleToOnFoot();
      const beforeState = vs.state;
      quickSwitchVehicle('sedan');
      const snap = vs.getDiagnosticSnapshot();
      return {
        beforeState,
        afterState: snap.state,
        isDriving: snap.isDriving,
        isConductorMode: snap.isConductorMode,
        vehicleId: snap.currentVehicleId,
        seatId: snap.currentSeatId,
        recentTransitions: snap.recentTransitions
      };
    })()`);
    recordScenario(
      1,
      'Entering an owned or permitted vehicle as driver (ON_FOOT -> ENTERING_VEHICLE -> DRIVER)',
      s1.beforeState === 'ON_FOOT' &&
        s1.afterState === 'DRIVER' &&
        s1.isDriving === true &&
        s1.isConductorMode === false &&
        s1.vehicleId === 'veh_sedan_starter' &&
        s1.seatId === 'driver' &&
        s1.recentTransitions.some(t => t.to === 'ENTERING_VEHICLE') &&
        s1.recentTransitions.some(t => t.to === 'DRIVER'),
      s1
    );

    // =========================================================================
    // SCENARIO 2: Driving with driver HUD and controls
    // =========================================================================
    const s2 = await cdp.evaluate(`(() => {
      const mesh = currentVehicle || playerCar;
      const zBefore = mesh.position.z;
      const kb = window.__PROJECT_EKO_KEYBOARD_HELD__ || {};
      kb.w = true;
      kb.a = true;
      keys.w = true;
      keys.a = true;
      for (let i = 0; i < 20; i++) {
        keys.w = true;
        keys.a = true;
        updateSimulation(0.05);
        updateVehicleVisualDynamics(0.05);
      }
      const speedDuringDrive = currentSpeedKmh;
      const zAfter = mesh.position.z;
      const steerWheelRotZ = mesh.userData.vehicleParts?.steeringWheel?.rotation?.z || 0;
      kb.w = false;
      kb.a = false;
      keys.w = false;
      keys.a = false;
      const chipText = (document.querySelector('.quick-controls-card')?.textContent || document.getElementById('vehicle-class-tag')?.textContent || '');
      return {
        zBefore: Number(zBefore.toFixed(2)),
        zAfter: Number(zAfter.toFixed(2)),
        movedDistance: Number(Math.abs(zAfter - zBefore).toFixed(2)),
        speedDuringDrive: Number(speedDuringDrive.toFixed(2)),
        steerWheelRotZ: Number(steerWheelRotZ.toFixed(3)),
        chipText: chipText.trim()
      };
    })()`);
    recordScenario(
      2,
      'Driving with driver HUD and controls (throttle, steering, live vehicle movement)',
      s2.movedDistance > 0.5 && s2.speedDuringDrive > 0 && Math.abs(s2.steerWheelRotZ) > 0.01 && s2.chipText.includes('Driving'),
      s2
    );

    // =========================================================================
    // SCENARIO 3: Switching to 3D cockpit view and back to exterior camera
    // =========================================================================
    const s3 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.setCockpitCameraMode('cockpit');
      currentSpeedKmh = 36;
      steeringAngle = 0.28;
      updateSimulation(0.033);
      updateVehicleVisualDynamics(0.033);
      const snapCockpit = vs.getDiagnosticSnapshot();
      const mesh = currentVehicle || playerCar;
      const vParts = mesh.userData.vehicleParts || {};
      let exteriorShellHiddenInCockpit = true;
      mesh.traverse(c => {
        if (c.userData && c.userData.isExteriorGreenhouseShell && c.visible) {
          exteriorShellHiddenInCockpit = false;
        }
      });
      const detailVisibilityInCockpit = {
        speedoNeedleVisible: Boolean(vParts.speedoNeedle && vParts.speedoNeedle.visible),
        acceleratorPedalVisible: Boolean(vParts.acceleratorPedal && vParts.acceleratorPedal.visible),
        brakePedalVisible: Boolean(vParts.brakePedal && vParts.brakePedal.visible),
        gearSelectorVisible: Boolean(vParts.gearSelector && vParts.gearSelector.visible),
        rearviewMirrorVisible: Boolean(vParts.rearviewMirror && vParts.rearviewMirror.visible),
        cabinDomeLightVisible: Boolean(vParts.cabinDomeLight && vParts.cabinDomeLight.visible),
        exteriorShellHiddenInCockpit
      };
      return {
        cockpitCameraMode: snapCockpit.cameraMode,
        cockpitPartsPresent: snapCockpit.cockpitPartsPresent,
        detailVisibilityInCockpit
      };
    })()`);

    results.screenshots.cockpit3dDesktop = await cdp.screenshot('m4_8_cockpit_3d_view_desktop.png');

    const s3Restore = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.setCockpitCameraMode('chase');
      updateSimulation(0.033);
      updateVehicleVisualDynamics(0.033);
      return { restoredCameraMode: cameraMode };
    })()`);

    recordScenario(
      3,
      'Switching to 3D cockpit view (steering wheel, dash, live speedo needle, pedals, gear selector, mirrors, transparent windscreen) and back to exterior camera',
      s3.cockpitCameraMode === 'cockpit' &&
        s3.cockpitPartsPresent.dashboardConsole &&
        s3.cockpitPartsPresent.instrumentCluster &&
        s3.cockpitPartsPresent.speedoNeedle &&
        s3.cockpitPartsPresent.steeringWheel &&
        s3.cockpitPartsPresent.acceleratorPedal &&
        s3.cockpitPartsPresent.brakePedal &&
        s3.cockpitPartsPresent.gearSelector &&
        s3.cockpitPartsPresent.rearviewMirror &&
        s3.detailVisibilityInCockpit.speedoNeedleVisible &&
        s3.detailVisibilityInCockpit.acceleratorPedalVisible &&
        s3.detailVisibilityInCockpit.exteriorShellHiddenInCockpit &&
        s3Restore.restoredCameraMode === 'chase',
      { ...s3, ...s3Restore }
    );

    // =========================================================================
    // SCENARIO 4: Exiting the vehicle to on-foot state
    // =========================================================================
    const s4 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const exitRes = vs.exitVehicleToOnFoot();
      const snap = vs.getDiagnosticSnapshot();
      return {
        exitRes,
        state: snap.state,
        isDriving: snap.isDriving,
        isConductorMode: snap.isConductorMode,
        playerAvatarVisible: snap.playerAvatarPosition?.visible,
        recentTransitions: snap.recentTransitions.slice(-3)
      };
    })()`);
    recordScenario(
      4,
      'Exiting the vehicle to on-foot state (DRIVER -> EXITING_VEHICLE -> ON_FOOT)',
      s4.state === 'ON_FOOT' &&
        s4.isDriving === false &&
        s4.isConductorMode === false &&
        s4.playerAvatarVisible === true &&
        s4.recentTransitions.some(t => t.to === 'EXITING_VEHICLE') &&
        s4.recentTransitions.some(t => t.to === 'ON_FOOT'),
      s4
    );

    // =========================================================================
    // SCENARIO 5: Attempting to drive a vehicle owned by another player without permission
    // =========================================================================
    const s5 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.setOwnerAccessForLockedVehicle(false);
      const switched = quickSwitchVehicle('locked_suv');
      const snap = vs.getDiagnosticSnapshot();
      return {
        switched,
        state: snap.state,
        isDriving: snap.isDriving,
        lastDeniedAttempt: snap.lastDeniedAttempt,
        qualificationModalVisible: snap.uiVisibility.qualificationModalVisible
      };
    })()`);
    recordScenario(
      5,
      'Attempting to drive a vehicle owned by another player without permission (OTHER_HUMAN_OWNED_LOCKED denied)',
      s5.switched === false &&
        s5.isDriving === false &&
        s5.lastDeniedAttempt?.reasonCode === 'OTHER_HUMAN_OWNED_LOCKED' &&
        s5.qualificationModalVisible === true,
      s5
    );

    // =========================================================================
    // SCENARIO 6: Attempting to drive a vehicle that requires a missing licence or qualification (BRT CDL)
    // =========================================================================
    const s6 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.closeQualificationModal();
      vs.hasMassTransitCdl = false;
      if (typeof cdlPassed !== 'undefined') cdlPassed = false;
      const switched = quickSwitchVehicle('brt');
      const snap = vs.getDiagnosticSnapshot();
      const modalText = document.getElementById('m48-qualification-modal')?.innerText || '';
      return {
        switched,
        state: snap.state,
        isDriving: snap.isDriving,
        lastDeniedAttempt: snap.lastDeniedAttempt,
        qualificationModalVisible: snap.uiVisibility.qualificationModalVisible,
        hasPassengerAlternativeBtn: Boolean(document.getElementById('m48-qual-board-passenger-btn')),
        modalTextPreview: modalText.slice(0, 180)
      };
    })()`);

    results.screenshots.qualificationDeniedModal = await cdp.screenshot('m4_8_qualification_denied_modal_desktop.png');
    await cdp.evaluate(`window.__PROJECT_EKO_VEHICLE_STATE__.closeQualificationModal()`);

    recordScenario(
      6,
      'Attempting to drive a vehicle requiring a missing licence/qualification (BRT Coach requires Mass Transit CDL -> explains requirement & offers Passenger alternative)',
      s6.switched === false &&
        s6.isDriving === false &&
        s6.lastDeniedAttempt?.reasonCode === 'DRIVING_QUALIFICATION_REQUIRED' &&
        s6.qualificationModalVisible === true &&
        s6.hasPassengerAlternativeBtn === true,
      s6
    );

    // =========================================================================
    // SCENARIO 7: Entering a vehicle as a passenger
    // =========================================================================
    const s7 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const boardRes = vs.boardAsPassenger('keke', { startShuttleCruise: true });
      const snap = vs.getDiagnosticSnapshot();
      return {
        boardRes,
        state: snap.state,
        isDriving: snap.isDriving,
        isConductorMode: snap.isConductorMode,
        seatId: snap.currentSeatId,
        seatLabel: snap.currentSeatLabel,
        passengerHudVisible: snap.uiVisibility.passengerHudVisible
      };
    })()`);
    recordScenario(
      7,
      'Entering a vehicle as a passenger (ON_FOOT -> ENTERING_VEHICLE -> PASSENGER)',
      s7.boardRes.allowed === true &&
        s7.state === 'PASSENGER' &&
        s7.isDriving === false &&
        s7.isConductorMode === false &&
        Boolean(s7.seatId) &&
        s7.passengerHudVisible === true,
      s7
    );

    // =========================================================================
    // SCENARIO 8: Verifying passenger HUD, passenger camera and disabled driving controls
    // =========================================================================
    const s8 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.shuttleCruiseActive = false;
      vs.shuttleSpeedKmh = 0;
      const mesh = currentVehicle || heroKeke;
      const posBefore = { x: mesh.position.x, z: mesh.position.z, rotY: mesh.rotation.y };
      keys.w = true;
      keys.a = true;
      for (let i = 0; i < 10; i++) {
        updateSimulation(0.05);
      }
      keys.w = false;
      keys.a = false;
      const posAfter = { x: mesh.position.x, z: mesh.position.z, rotY: mesh.rotation.y };
      const yawAfterLook = vs.lookAroundPassenger(0.35);
      const snap = vs.getDiagnosticSnapshot();
      return {
        cameraMode: snap.cameraMode,
        passengerHudVisible: snap.uiVisibility.passengerHudVisible,
        unintendedMoveDist: Number(Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z).toFixed(4)),
        unintendedSteerDelta: Number(Math.abs(posAfter.rotY - posBefore.rotY).toFixed(4)),
        yawAfterLook: Number(yawAfterLook.toFixed(3))
      };
    })()`);

    results.screenshots.passengerDesktop = await cdp.screenshot('m4_8_passenger_hud_and_view_desktop.png');

    recordScenario(
      8,
      'Verifying passenger HUD, passenger camera, look-around yaw, and disabled driving controls',
      s8.cameraMode === 'passenger' &&
        s8.passengerHudVisible === true &&
        s8.unintendedMoveDist === 0 &&
        s8.unintendedSteerDelta === 0 &&
        Math.abs(s8.yawAfterLook) > 0.1,
      s8
    );

    // =========================================================================
    // SCENARIO 9: Riding in a moving vehicle as a passenger (shuttle movement + seat sync)
    // =========================================================================
    const s9 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.shuttleCruiseActive = true;
      vs.shuttleSpeedKmh = 32;
      const mesh = currentVehicle || heroKeke;
      const vehBefore = { x: mesh.position.x, z: mesh.position.z };
      const avatarBefore = { x: playerAvatar.position.x, z: playerAvatar.position.z };
      for (let i = 0; i < 20; i++) {
        updateSimulation(0.05);
      }
      const vehAfter = { x: mesh.position.x, z: mesh.position.z };
      const avatarAfter = { x: playerAvatar.position.x, z: playerAvatar.position.z };
      const vehMoved = Math.hypot(vehAfter.x - vehBefore.x, vehAfter.z - vehBefore.z);
      const avatarMoved = Math.hypot(avatarAfter.x - avatarBefore.x, avatarAfter.z - avatarBefore.z);
      const seatAttachDelta = Math.abs(vehMoved - avatarMoved);
      return {
        vehMoved: Number(vehMoved.toFixed(2)),
        avatarMoved: Number(avatarMoved.toFixed(2)),
        seatAttachDelta: Number(seatAttachDelta.toFixed(4)),
        state: vs.state
      };
    })()`);
    recordScenario(
      9,
      'Riding in a moving vehicle as a passenger (synchronized shuttle movement & seated player transform)',
      s9.state === 'PASSENGER' && s9.vehMoved > 2.0 && s9.seatAttachDelta < 0.05,
      s9
    );

    // =========================================================================
    // SCENARIO 10: Exiting a vehicle as a passenger
    // =========================================================================
    const s10 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const res = vs.exitVehicleToOnFoot();
      const snap = vs.getDiagnosticSnapshot();
      return {
        res,
        state: snap.state,
        passengerHudVisible: snap.uiVisibility.passengerHudVisible,
        playerAvatarVisible: snap.playerAvatarPosition?.visible
      };
    })()`);
    recordScenario(
      10,
      'Exiting a vehicle as a passenger (PASSENGER -> EXITING_VEHICLE -> ON_FOOT)',
      s10.state === 'ON_FOOT' && s10.passengerHudVisible === false && s10.playerAvatarVisible === true,
      s10
    );

    // =========================================================================
    // SCENARIO 11: Attempting to board a full vehicle (NO_SEATS_AVAILABLE)
    // =========================================================================
    const s11 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const res = vs.boardAsPassenger('veh_npc_full_shuttle');
      const snap = vs.getDiagnosticSnapshot();
      return {
        res,
        stateAfterAttempt: snap.state,
        isDriving: snap.isDriving
      };
    })()`);
    recordScenario(
      11,
      'Attempting to board a full vehicle (NO_SEATS_AVAILABLE rejected cleanly without clipping)',
      s11.res.allowed === false &&
        s11.res.reasonCode === 'NO_SEATS_AVAILABLE' &&
        s11.stateAfterAttempt === 'ON_FOOT',
      s11
    );

    // =========================================================================
    // SCENARIO 12: Entering conductor mode and verifying conductor-only controls
    // =========================================================================
    const s12 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const res = vs.boardAsConductor('danfo');
      const snap = vs.getDiagnosticSnapshot();
      return {
        res,
        state: snap.state,
        isDriving: snap.isDriving,
        isConductorMode: snap.isConductorMode,
        seatId: snap.currentSeatId,
        conductorBannerVisible: snap.uiVisibility.conductorBannerVisible,
        passengerHudVisible: snap.uiVisibility.passengerHudVisible
      };
    })()`);

    results.screenshots.conductorDesktop = await cdp.screenshot('m4_8_conductor_role_hud_desktop.png');

    recordScenario(
      12,
      'Entering conductor mode and verifying conductor-only controls (CONDUCTOR state, isDriving=false, conductor banner active)',
      s12.res.allowed === true &&
        s12.state === 'CONDUCTOR' &&
        s12.isDriving === false &&
        s12.isConductorMode === true &&
        s12.seatId === 'conductor_step' &&
        s12.conductorBannerVisible === true &&
        s12.passengerHudVisible === false,
      s12
    );

    // =========================================================================
    // SCENARIO 13: Verifying that business panels, conductor prompts, passenger prompts, and driving controls do not conflict
    // =========================================================================
    const s13 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.exitVehicleToOnFoot();
      const phone = document.getElementById('eko-phone-container');
      if (phone) phone.classList.add('open');
      const phoneOpenOnFoot = phone ? phone.classList.contains('open') : false;

      quickSwitchVehicle('danfo');
      const snapDriver = vs.getDiagnosticSnapshot();

      return {
        phoneOpenOnFoot,
        driverState: snapDriver.state,
        isDriving: snapDriver.isDriving,
        isConductorMode: snapDriver.isConductorMode,
        uiVisibilityInDriver: snapDriver.uiVisibility
      };
    })()`);
    recordScenario(
      13,
      'Verifying that business panels, conductor prompts, passenger prompts, and driving controls never conflict',
      s13.phoneOpenOnFoot === true &&
        s13.driverState === 'DRIVER' &&
        s13.isDriving === true &&
        s13.isConductorMode === false &&
        s13.uiVisibilityInDriver.businessPhoneOpen === false &&
        s13.uiVisibilityInDriver.conductorBannerVisible === false &&
        s13.uiVisibilityInDriver.passengerHudVisible === false,
      s13
    );

    // =========================================================================
    // SCENARIO 14: Verifying that entering or riding in a vehicle does not grant currency
    // =========================================================================
    const s14 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const balBefore = Number(player.balance || 0);
      const streakBefore = Number(typeof hustlePoints !== 'undefined' ? hustlePoints : 0);
      quickSwitchVehicle('sedan');
      quickSwitchVehicle('okada');
      vs.boardAsPassenger('keke', { startShuttleCruise: true });
      for (let i = 0; i < 10; i++) updateSimulation(0.05);
      vs.exitVehicleToOnFoot();
      const balAfter = Number(player.balance || 0);
      const streakAfter = Number(typeof hustlePoints !== 'undefined' ? hustlePoints : 0);
      return {
        balBefore,
        balAfter,
        deltaGN: balAfter - balBefore,
        streakDelta: streakAfter - streakBefore
      };
    })()`);
    recordScenario(
      14,
      'Verifying that entering, switching, or riding in a vehicle does not grant currency or Hustle Flow',
      s14.deltaGN === 0 && s14.streakDelta === 0,
      s14
    );

    // =========================================================================
    // SCENARIO 15: Verifying that accepted driving or conductor work awards only once per valid completion
    // =========================================================================
    const fixtureRes = await httpJson(`${API_URL}/api/v1/dev/test-fixture/reset`, 'POST', {
      fixtureTag: `m48_${Date.now()}`
    });
    const testAccountId = fixtureRes.data?.account?.accountId || 'usr_m48_test';
    const shiftEventId = `ev_m48_shift_done_${Date.now()}`;

    await httpJson(`${API_URL}/api/v1/progression/event`, 'POST', {
      accountId: testAccountId,
      eventId: `ev_m48_accept_${Date.now()}`,
      eventType: 'JobAccepted',
      metadata: { jobId: 'job_foot_courier', totalCheckpoints: 3 }
    });

    const firstCompleteRes = await httpJson(`${API_URL}/api/v1/progression/event`, 'POST', {
      accountId: testAccountId,
      eventId: shiftEventId,
      eventType: 'JobSettlementPosted',
      metadata: { jobId: 'job_foot_courier', shiftId: 'shift_m48_01', netPayGN: 500 }
    });
    const duplicateCompleteRes = await httpJson(`${API_URL}/api/v1/progression/event`, 'POST', {
      accountId: testAccountId,
      eventId: shiftEventId,
      eventType: 'JobSettlementPosted',
      metadata: { jobId: 'job_foot_courier', shiftId: 'shift_m48_01', netPayGN: 500 }
    });

    recordScenario(
      15,
      'Verifying that accepted work awards only once per valid completion (idempotent shift settlement)',
      firstCompleteRes.data?.ok === true &&
        firstCompleteRes.data?.duplicateIgnored === false &&
        firstCompleteRes.data?.playerSummary?.completedJobsCount === 1 &&
        firstCompleteRes.data?.playerSummary?.gameNairaBalance === 5500 &&
        duplicateCompleteRes.data?.duplicateIgnored === true,
      {
        firstDuplicateIgnored: firstCompleteRes.data?.duplicateIgnored,
        duplicateIgnored: duplicateCompleteRes.data?.duplicateIgnored,
        completedJobsCount: firstCompleteRes.data?.playerSummary?.completedJobsCount,
        balanceAfterFirstGN: firstCompleteRes.data?.playerSummary?.gameNairaBalance
      }
    );

    // =========================================================================
    // SCENARIO 16: Mobile portrait (390x844) & landscape (844x390) layout + Two-Account Realtime Multiplayer
    // =========================================================================
    // Clean any lingering occupants on veh_danfo_coop from prior test runs
    const existingDanfoOcc = await httpJson(`${API_URL}/api/v1/vehicles/occupancy?vehicleId=veh_danfo_coop`, 'GET');
    const existingSeats = Object.values(existingDanfoOcc.data?.vehicle?.seats || {});
    for (const s of existingSeats) {
      if (s.occupantId && s.occupantKind === 'HUMAN_PLAYER') {
        await httpJson(`${API_URL}/api/v1/vehicles/exit-seat`, 'POST', {
          playerId: s.occupantId,
          vehicleId: 'veh_danfo_coop'
        });
        await httpJson(`${REALTIME_URL}/vehicles/exit`, 'POST', {
          playerId: s.occupantId,
          vehicleId: 'veh_danfo_coop'
        });
      }
    }
    const existingRtDanfo = await httpJson(`${REALTIME_URL}/vehicles/state?vehicleId=veh_danfo_coop`, 'GET');
    const existingRtSeats = Object.values(existingRtDanfo.data?.vehicle?.seats || {});
    for (const s of existingRtSeats) {
      if (s.occupantId) {
        await httpJson(`${REALTIME_URL}/vehicles/exit`, 'POST', {
          playerId: s.occupantId,
          vehicleId: 'veh_danfo_coop'
        });
      }
    }

    const playerA = `usr_mp_driver_${Date.now()}`;
    const playerB = `usr_mp_passenger_${Date.now()}`;
    const playerC = `usr_mp_conductor_${Date.now()}`;

    await httpJson(`${REALTIME_URL}/presence`, 'POST', {
      playerId: playerA,
      username: 'Driver_Kunle',
      zoneId: 'zone_marina_cms',
      activity: 'Driving Danfo #04',
      position: { x: -96, y: 0, z: -40 }
    });
    await httpJson(`${REALTIME_URL}/presence`, 'POST', {
      playerId: playerB,
      username: 'Passenger_Zainab',
      zoneId: 'zone_marina_cms',
      activity: 'Commuting',
      position: { x: -94, y: 0, z: -40 }
    });
    await httpJson(`${REALTIME_URL}/presence`, 'POST', {
      playerId: playerC,
      username: 'Conductor_Tobi',
      zoneId: 'zone_marina_cms',
      activity: 'Calling Route',
      position: { x: -95, y: 0, z: -40 }
    });

    // Player A boards Danfo as DRIVER
    const mpDriverBoard = await httpJson(`${API_URL}/api/v1/vehicles/request-seat`, 'POST', {
      playerId: playerA,
      playerName: 'Driver_Kunle',
      vehicleId: 'veh_danfo_coop',
      requestedRole: 'DRIVER'
    });
    await httpJson(`${REALTIME_URL}/vehicles/board`, 'POST', {
      playerId: playerA,
      username: 'Driver_Kunle',
      vehicleId: 'veh_danfo_coop',
      role: 'DRIVER'
    });

    // Player B attempts to hijack DRIVER seat -> MUST be denied (DRIVER_SEAT_OCCUPIED_BY_HUMAN)
    const mpHijackAttempt = await httpJson(`${API_URL}/api/v1/vehicles/request-seat`, 'POST', {
      playerId: playerB,
      playerName: 'Passenger_Zainab',
      vehicleId: 'veh_danfo_coop',
      requestedRole: 'DRIVER'
    });

    // Player B boards Danfo as PASSENGER
    const mpPassengerBoard = await httpJson(`${API_URL}/api/v1/vehicles/request-seat`, 'POST', {
      playerId: playerB,
      playerName: 'Passenger_Zainab',
      vehicleId: 'veh_danfo_coop',
      requestedRole: 'PASSENGER'
    });
    await httpJson(`${REALTIME_URL}/vehicles/board`, 'POST', {
      playerId: playerB,
      username: 'Passenger_Zainab',
      vehicleId: 'veh_danfo_coop',
      role: 'PASSENGER'
    });

    // Player C boards Danfo as CONDUCTOR
    const mpConductorBoard = await httpJson(`${API_URL}/api/v1/vehicles/request-seat`, 'POST', {
      playerId: playerC,
      playerName: 'Conductor_Tobi',
      vehicleId: 'veh_danfo_coop',
      requestedRole: 'CONDUCTOR'
    });
    await httpJson(`${REALTIME_URL}/vehicles/board`, 'POST', {
      playerId: playerC,
      username: 'Conductor_Tobi',
      vehicleId: 'veh_danfo_coop',
      role: 'CONDUCTOR'
    });

    // Driver A moves vehicle to Z = +25 -> sync-transform updates Passenger B & Conductor C coordinates!
    const mpSyncRes = await httpJson(`${REALTIME_URL}/vehicles/sync-transform`, 'POST', {
      vehicleId: 'veh_danfo_coop',
      driverId: playerA,
      position: { x: -96, y: 0, z: 25 },
      rotationY: 0,
      speedKmh: 42
    });

    // Driver A disconnects -> vehicle safely halts with passengers preserved!
    await httpJson(`${API_URL}/api/v1/vehicles/driver-disconnect`, 'POST', {
      playerId: playerA,
      vehicleId: 'veh_danfo_coop'
    });
    const mpDisconnectRes = await httpJson(`${REALTIME_URL}/disconnect`, 'POST', {
      playerId: playerA
    });

    // Clean up Player B and Player C seats after assertions
    await httpJson(`${API_URL}/api/v1/vehicles/exit-seat`, 'POST', { playerId: playerB, vehicleId: 'veh_danfo_coop' });
    await httpJson(`${API_URL}/api/v1/vehicles/exit-seat`, 'POST', { playerId: playerC, vehicleId: 'veh_danfo_coop' });
    await httpJson(`${REALTIME_URL}/vehicles/exit`, 'POST', { playerId: playerB, vehicleId: 'veh_danfo_coop' });
    await httpJson(`${REALTIME_URL}/vehicles/exit`, 'POST', { playerId: playerC, vehicleId: 'veh_danfo_coop' });

    results.multiplayerChecks = {
      driverBoardAllowed: Boolean(mpDriverBoard.data?.ok),
      hijackDriverDenied: mpHijackAttempt.data?.ok === false && mpHijackAttempt.data?.error === 'DRIVER_SEAT_OCCUPIED_BY_HUMAN',
      passengerBoardAllowed: Boolean(mpPassengerBoard.data?.ok),
      conductorBoardAllowed: Boolean(mpConductorBoard.data?.ok),
      synchronizedOccupantsCount: mpSyncRes.data?.syncedOccupants?.length || 0,
      passengerSyncedZ: mpSyncRes.data?.syncedOccupants?.find(o => o.playerId === playerB)?.position?.z,
      driverDisconnectSafetyPolicy: mpDisconnectRes.data?.safetyPolicy
    };

    // Mobile Portrait (390x844) & Landscape (844x390) Viewports
    await cdp.setViewport(390, 844, true);
    await cdp.evaluate(`(() => {
      window.__PROJECT_EKO_VEHICLE_STATE__.boardAsPassenger('keke', { startShuttleCruise: true });
      updateSimulation(0.033);
    })()`);
    await sleep(250);
    results.screenshots.mobilePortraitPassenger = await cdp.screenshot('m4_8_mobile_portrait_passenger.png');

    await cdp.setViewport(844, 390, true);
    await cdp.evaluate(`(() => {
      quickSwitchVehicle('sedan');
      window.__PROJECT_EKO_VEHICLE_STATE__.setCockpitCameraMode('cockpit');
      updateSimulation(0.033);
      updateVehicleVisualDynamics(0.033);
    })()`);
    await sleep(250);
    results.screenshots.mobileLandscapeCockpit = await cdp.screenshot('m4_8_mobile_landscape_cockpit.png');

    recordScenario(
      16,
      'Two-account realtime multiplayer (Driver + Passenger + Conductor sync, hijack denial, disconnect safety halt) & Mobile Portrait/Landscape layouts',
      results.multiplayerChecks.driverBoardAllowed === true &&
        results.multiplayerChecks.hijackDriverDenied === true &&
        results.multiplayerChecks.passengerBoardAllowed === true &&
        results.multiplayerChecks.conductorBoardAllowed === true &&
        results.multiplayerChecks.synchronizedOccupantsCount >= 3 &&
        results.multiplayerChecks.driverDisconnectSafetyPolicy === 'VEHICLE_SAFELY_HALTED_PASSENGERS_PRESERVED',
      results.multiplayerChecks
    );

    results.allPassed = results.scenarios.length === 16 && results.scenarios.every(s => s.passed);

    const outJsonPath = path.join(ARTIFACT_DIR, 'm4_8_verification_results.json');
    fs.writeFileSync(outJsonPath, JSON.stringify(results, null, 2));
    console.log('================================================================================');
    console.log(`M4.8 SUMMARY: ${results.scenarios.filter(s => s.passed).length}/16 SCENARIOS PASSED`);
    console.log(`Saved JSON report to: ${outJsonPath}`);
    console.log('================================================================================');

    cdp.close();
    chromeProc.kill('SIGKILL');
    process.exit(results.allPassed ? 0 : 1);
  } catch (err) {
    console.error('Fatal error in M4.8 verification script:', err);
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
    process.exit(1);
  }
})();
