#!/usr/bin/env node
/**
 * PROJECT EKO — TAXI PICKUP/DROPOFF & IN-WORLD GAME LOGIC VERIFICATION
 * Verifies the exact bug reported by the user:
 * 1. Picking up Sister Blessing at z = -120 hides her sidewalk mesh permanently across animation frames.
 * 2. Places her 3D seated mesh inside the active vehicle and updates PASSENGERS gauge to 1 / 4.
 * 3. Switches Minimap GPS, 3D World Objective Pin, and EkoGuide HUD to TBS Dropoff (z = +45m).
 * 4. Prevents #world-objective-pin from overlapping #controls-card.
 * 5. Dropping her off at TBS Plaza (z = +45m) credits GN fare, resets PASSENGERS to 0 / 4, and places her at TBS Plaza.
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
const ARTIFACT_DIR = '/Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be';

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
    return outPath;
  }

  return { close: () => socket.destroy(), send, evaluate, setViewport, screenshot };
}

async function launchChromeOnPort(debugPort, url) {
  const userDataDir = path.join('/tmp', `eko_chrome_taxi_verify_${debugPort}_${Date.now()}`);
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
      url,
    ],
    { stdio: 'ignore' }
  );

  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetchJson(`http://127.0.0.1:${debugPort}/json`);
      if (Array.isArray(list) && list.length > 0) {
        const client = await createCDPClient(debugPort);
        return { proc, client };
      }
    } catch (_) {}
    await sleep(250);
  }
  proc.kill('SIGKILL');
  throw new Error('Failed to connect to Chrome CDP');
}

(async () => {
  console.log('1. Launching headless Chrome on Project Eko ...');
  const { proc, client } = await launchChromeOnPort(9466, GAME_URL);
  try {
    await client.setViewport(1440, 900, false);
    await sleep(1500);

    // Reproduce exact user scenario: walking shift was at Checkpoint 2/3, then player got into the car and picked up Sister Blessing at z = -120
    await client.evaluate(`(() => {
      const authModal = document.getElementById('m47-auth-modal-backdrop');
      if (authModal) authModal.classList.remove('open');
      if (window.__PROJECT_EKO_LIFE__) {
        window.__PROJECT_EKO_LIFE__.startActiveJobShift('job_foot_courier');
        window.__PROJECT_EKO_LIFE__.advanceActiveJobCheckpoint();
      }
      if (typeof quickSwitchVehicle === 'function') {
        quickSwitchVehicle('sedan');
      }
      if (typeof currentVehicle !== 'undefined' && currentVehicle) {
        currentVehicle.position.set(-96, 0.05, -120);
        currentVehicle.rotation.y = 0;
        vehicleHeading = 0;
        currentSpeedKmh = 0;
      }
    })()`);

    // Wait 1200ms (~72 simulation frames) to prove updateSimulation(dt) does NOT unhide Sister Blessing on the sidewalk
    await sleep(1200);
    await client.evaluate(`if (typeof closeNPCDialogue === 'function') closeNPCDialogue();`);
    await sleep(250);

    const pickupState = await client.evaluate(`(() => {
      const sbPed = lagosNPCs.find((p) => p.userData && p.userData.name === 'Sister Blessing');
      const paxText = document.getElementById('passenger-count-text')?.innerText?.trim();
      const gpsText = document.getElementById('gps-target-dist')?.innerText?.trim();
      const ekoGuideTitle = document.getElementById('m47-guide-primary-title')?.innerText?.trim();
      const ekoGuideStep = document.getElementById('m47-guide-overall-journey-line')?.innerText?.trim();
      const pinText = document.getElementById('world-objective-pin-text')?.innerText?.trim();
      const pinRect = document.getElementById('world-objective-pin')?.getBoundingClientRect();
      const ctrlRect = document.getElementById('controls-card')?.getBoundingClientRect();
      const overlapsControls = (pinRect && ctrlRect && pinRect.width > 0 && ctrlRect.width > 0)
        ? !(pinRect.right < ctrlRect.left || pinRect.left > ctrlRect.right || pinRect.bottom < ctrlRect.top || pinRect.top > ctrlRect.bottom)
        : false;

      return {
        passengerState,
        sbPedExists: Boolean(sbPed),
        sbPedVisible: sbPed ? sbPed.visible : null,
        sbPedIsBoardedFlag: sbPed && sbPed.userData ? Boolean(sbPed.userData.isBoardedInVehicle) : false,
        passengerInCarVisible: passengerInCarMesh ? passengerInCarMesh.visible : false,
        paxText,
        gpsText,
        ekoGuideTitle,
        ekoGuideStep,
        pinText,
        overlapsControls
      };
    })()`);

    console.log('2. Pickup State after 72 frames:', JSON.stringify(pickupState, null, 2));

    assert.strictEqual(pickupState.passengerState, 'onboard', 'passengerState must be onboard');
    assert.strictEqual(pickupState.sbPedVisible, false, 'Sister Blessing sidewalk mesh MUST be hidden (visible === false) after pickup');
    assert.strictEqual(pickupState.sbPedIsBoardedFlag, true, 'Sister Blessing must have isBoardedInVehicle === true');
    assert.strictEqual(pickupState.passengerInCarVisible, true, 'Sister Blessing seated in-car mesh must be visible');
    assert.strictEqual(pickupState.paxText, '1 / 4', 'Dashboard passenger counter must read 1 / 4');
    assert.ok(pickupState.gpsText.includes('Tafawa Balewa Square (TBS)') && pickupState.gpsText.includes('NORTH'), `Minimap GPS must point North to Tafawa Balewa Square (TBS), got: ${pickupState.gpsText}`);
    assert.ok(pickupState.ekoGuideTitle.includes('Drop Off Sister Blessing'), `EkoGuide HUD must prioritize Sister Blessing dropoff while onboard, got: ${pickupState.ekoGuideTitle}`);
    assert.ok(pickupState.pinText.includes('TBS DROPOFF BAY'), `3D World Objective Pin must point to TBS DROPOFF BAY, got: ${pickupState.pinText}`);
    assert.strictEqual(pickupState.overlapsControls, false, '3D World Objective Pin must not overlap #controls-card');

    const shot1 = await client.screenshot('m4_7_taxi_pickup_sister_blessing_in_car.png');
    console.log(`   📸 Saved verification screenshot: ${shot1}`);

    // 3. Drive to TBS Dropoff at z = +45m and verify completion
    const dropoffState = await client.evaluate(`(() => {
      const balBefore = player.balance;
      currentVehicle.position.set(-96, 0.05, 45);
      currentSpeedKmh = 0;
      handleInteractKey();
      const sbPed = lagosNPCs.find((p) => p.userData && p.userData.name === 'Sister Blessing');
      return {
        passengerState,
        balBefore,
        balAfter: player.balance,
        paxText: document.getElementById('passenger-count-text')?.innerText?.trim(),
        sbPedVisible: sbPed ? sbPed.visible : null,
        sbPedZ: sbPed ? Math.round(sbPed.position.z) : null,
        passengerInCarVisible: passengerInCarMesh ? passengerInCarMesh.visible : null
      };
    })()`);

    console.log('3. Dropoff State at TBS Plaza:', JSON.stringify(dropoffState, null, 2));
    assert.strictEqual(dropoffState.passengerState, 'dropped_off', 'passengerState must transition to dropped_off');
    assert.ok(dropoffState.balAfter > dropoffState.balBefore, 'Player balance must increase after TBS dropoff');
    assert.strictEqual(dropoffState.paxText, '0 / 4', 'Passenger gauge must reset to 0 / 4 on dropoff');
    assert.strictEqual(dropoffState.sbPedVisible, true, 'Sister Blessing must reappear at TBS Plaza after dropoff');
    assert.strictEqual(dropoffState.sbPedZ, 48, 'Sister Blessing must be positioned at TBS Plaza (z = 48)');
    assert.strictEqual(dropoffState.passengerInCarVisible, false, 'In-car passenger mesh must hide after dropoff');

    console.log('\n✅ ALL TAXI PICKUP, IN-CAR PASSENGER, GPS, EKOGUIDE & DROPOFF CHECKS PASSED!');
  } finally {
    client.close();
    proc.kill('SIGKILL');
  }
})().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
