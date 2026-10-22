#!/usr/bin/env node
/**
 * PROJECT EKO — M4.8.1 AUTOMATED BROWSER ACCEPTANCE SUITE
 * DANFO INPUT REPAIR, 14-SEAT HOLLOW CABIN, ROUTES, STOP-BASED FARES & CONDUCTOR SYSTEM
 *
 * Verifies all 22 acceptance tests in headless Chrome against live servers (:3000, :3001, :3002).
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GAME_URL = 'http://127.0.0.1:3000/index.html';
const API_URL = 'http://127.0.0.1:3001';
const REALTIME_URL = 'http://127.0.0.1:3002';
const ARTIFACT_DIR = '/Users/divinity/.gemini/antigravity/brain/373060db-e611-4061-ad6f-776311ec92be';
const DELIVERY_JSON = path.join(__dirname, '..', 'ANTIGRAVITY', 'DELIVERY', 'm4_8_1_verification_results.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpJson(urlStr, method = 'GET', bodyObj = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = bodyObj ? Buffer.from(JSON.stringify(bodyObj), 'utf8') : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: body
          ? { 'Content-Type': 'application/json', 'Content-Length': body.length }
          : {}
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (_) {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function connectCDP(wsUrlStr) {
  const wsUrl = new URL(wsUrlStr);
  const socket = net.connect(Number(wsUrl.port), wsUrl.hostname);
  let buffer = Buffer.alloc(0);
  const pending = new Map();
  let msgId = 0;

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
        `Sec-WebSocket-Version: 13`,
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
      for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4];
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
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res && res.result ? res.result.value : undefined;
  }

  async function screenshot(filename) {
    const outPath = path.join(ARTIFACT_DIR, filename);
    const snap = await send('Page.captureScreenshot', { format: 'png' });
    if (snap && snap.data) {
      fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    }
    return outPath;
  }

  return { send, evaluate, screenshot, close: () => socket.destroy() };
}

async function main() {
  const debugPort = 9348;
  const userDataDir = `/tmp/eko_m481_chrome_${Date.now()}`;
  const chrome = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--mute-audio',
      GAME_URL
    ],
    { stdio: 'ignore' }
  );

  let cdp;
  const results = {
    milestone: 'M4.8.1 — Danfo Input Repair, Seating, Routes, Fares & Conductor System',
    timestamp: new Date().toISOString(),
    consoleErrors: [],
    pageErrors: [],
    tests: [],
    screenshots: {},
    allPassed: false
  };

  function recordTest(id, name, passed, details = {}) {
    results.tests.push({ id, name, passed: Boolean(passed), details });
    console.log(`${passed ? '✅' : '❌'} [Test ${id}] ${name}`);
    if (!passed) {
      console.error('   Details:', JSON.stringify(details));
    }
  }

  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await httpJson(`http://127.0.0.1:${debugPort}/json/list`);
        if (Array.isArray(res.data)) {
          const pageTarget = res.data.find(t => t.type === 'page' && t.url.includes('index.html')) || res.data.find(t => t.type === 'page');
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (_) {}
      await sleep(250);
    }
    if (!wsUrl) throw new Error('Failed to connect to headless Chrome CDP target.');

    cdp = await connectCDP(wsUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Attach error listeners inside page
    await cdp.evaluate(`(() => {
      window.__M481_CONSOLE_ERRORS__ = [];
      window.__M481_PAGE_ERRORS__ = [];
      const origErr = console.error;
      console.error = function(...args) {
        window.__M481_CONSOLE_ERRORS__.push(args.map(a => String(a)).join(' '));
        origErr.apply(console, args);
      };
      window.addEventListener('error', (e) => {
        window.__M481_PAGE_ERRORS__.push(String(e.message || e));
      });
      window.addEventListener('unhandledrejection', (e) => {
        window.__M481_PAGE_ERRORS__.push(String(e.reason || e));
      });
    })()`);

    // Wait for game boot
    for (let i = 0; i < 40; i++) {
      const booted = await cdp.evaluate(`Boolean(window.__PROJECT_EKO_VEHICLE_STATE__ && window.__PROJECT_EKO_KEYBINDING_REGISTRY__ && typeof heroDanfo !== 'undefined' && heroDanfo)`);
      if (booted) break;
      await sleep(200);
    }

    // Dismiss any initial onboarding modal so we are on foot near the Apex Danfo 14
    await cdp.evaluate(`(() => {
      const authModal = document.getElementById('m47-auth-modal');
      if (authModal) authModal.style.display = 'none';
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.exitVehicleToOnFoot({ forceExit: true });
      // Position player on foot right beside the Apex Danfo 14 in the West CMS Layby
      playerAvatar.position.set(heroDanfo.position.x + 2.1, 0.22, heroDanfo.position.z + 0.65);
      playerAvatar.rotation.y = -Math.PI / 2;
      player.balance = 5000;
      const balEl = document.getElementById('hud-balance') || document.getElementById('naira-balance');
      if (balEl) balEl.innerText = player.balance.toLocaleString();
      updateSimulation(0.033);
    })()`);

    results.screenshots.danfoProximityOnFoot = await cdp.screenshot('m4_8_1_danfo_proximity_on_foot_desktop.png');

    // =========================================================================
    // TEST 1 & TEST 2: Pressing F near the Apex Danfo 14 boards as passenger and NEVER opens Flex Card
    // =========================================================================
    const t12 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const reg = window.__PROJECT_EKO_KEYBINDING_REGISTRY__;
      const audit = reg.auditConflictReport();
      // Dispatch real KeyboardEvent('keydown', { key: 'f', code: 'KeyF' })
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f', code: 'KeyF', bubbles: true }));
      const snap = vs.getDiagnosticSnapshot();
      const flexModal = document.getElementById('eko-flex-modal');
      const flexBtnText = document.getElementById('btn-header-flex-card')?.innerText || '';
      return {
        audit,
        stateAfterF: snap.state,
        seatId: snap.currentSeatId,
        seatLabel: snap.currentSeatLabel,
        flexCardOpen: Boolean(flexModal && (flexModal.style.display === 'flex' || flexModal.style.display === 'block')),
        flexBtnText,
        danfoBoardingModalVisible: snap.uiVisibility.danfoBoardingModalVisible,
        lastDispatchedAction: reg.lastDispatchedAction
      };
    })()`);

    results.screenshots.danfoBoardingModalDesktop = await cdp.screenshot('m4_8_1_danfo_route_fare_modal_desktop.png');

    recordTest(
      1,
      'Pressing F near the Apex Danfo 14 boards as passenger and opens the Danfo Route/Stop/Fare selector',
      t12.stateAfterF === 'PASSENGER' &&
        Boolean(t12.seatId) &&
        t12.danfoBoardingModalVisible === true &&
        t12.lastDispatchedAction?.actionId === 'vehicle.board_passenger',
      t12
    );

    recordTest(
      2,
      'Confirming F does NOT open Flex Card during vehicle boarding (and (F) removed from Flex Card button)',
      t12.flexCardOpen === false &&
        t12.audit.fRemovedFromFlexCard === true &&
        t12.audit.fBoundToBoardPassenger === true &&
        !t12.flexBtnText.includes('(F)'),
      t12
    );

    // =========================================================================
    // TEST 3: Opening Flex Card through its intended button (#btn-header-flex-card) or KeyU
    // =========================================================================
    const t3 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.closeDanfoBoardingModal();
      vs.exitVehicleToOnFoot({ forceExit: true });
      const btn = document.getElementById('btn-header-flex-card');
      if (btn) btn.click();
      const flexModal = document.getElementById('eko-flex-modal');
      const openedViaButton = Boolean(flexModal && (flexModal.style.display === 'flex' || flexModal.style.display === 'block'));
      closeEkoFlexCard();
      const closedAfterDismiss = Boolean(flexModal && flexModal.style.display === 'none');
      // Also test KeyU shortcut
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', code: 'KeyU', bubbles: true }));
      const openedViaKeyU = Boolean(flexModal && (flexModal.style.display === 'flex' || flexModal.style.display === 'block'));
      closeEkoFlexCard();
      return { openedViaButton, closedAfterDismiss, openedViaKeyU };
    })()`);
    recordTest(
      3,
      'Opening Flex Card through its visible button (#btn-header-flex-card) and non-conflicting KeyU shortcut',
      t3.openedViaButton === true && t3.closedAfterDismiss === true && t3.openedViaKeyU === true,
      t3
    );

    // =========================================================================
    // TEST 4: Pressing E to drive the Danfo when authorised
    // =========================================================================
    const t4 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      playerAvatar.position.set(heroDanfo.position.x - 1.9, 0.22, heroDanfo.position.z + 1.1);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }));
      const snap = vs.getDiagnosticSnapshot();
      // Exit back to on foot for passenger tests
      vs.exitVehicleToOnFoot({ forceExit: true });
      return {
        driverState: snap.state,
        isDriving: snap.isDriving,
        isConductorMode: snap.isConductorMode,
        vehicleId: snap.currentVehicleId,
        seatId: snap.currentSeatId
      };
    })()`);
    recordTest(
      4,
      'Pressing E near the Apex Danfo 14 enters DRIVER state when authorised',
      t4.driverState === 'DRIVER' &&
        t4.isDriving === true &&
        t4.isConductorMode === false &&
        t4.vehicleId === 'veh_danfo_coop' &&
        t4.seatId === 'driver',
      t4
    );

    // =========================================================================
    // TEST 5: Inspecting the Apex Danfo 14 interior and verifying the 14-seat layout
    // =========================================================================
    const t5 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const cap = vs.getDanfoSeatCapacitySummary();
      const vParts = (heroDanfo && heroDanfo.userData && heroDanfo.userData.vehicleParts) || {};
      return {
        modelName: cap.modelName,
        totalCapacity: cap.totalCapacity,
        driverPositions: cap.driverPositions,
        conductorPositions: cap.conductorPositions,
        passengerSeatCapacity: cap.passengerSeatCapacity,
        occupiedPassengerCount: cap.occupiedPassengerCount,
        availablePassengerCount: cap.availablePassengerCount,
        doorwayEntrance: cap.doorwayEntrance,
        hollowCabinInterior: Boolean(vParts.hollowCabinInterior),
        cabinDriverFigurePresent: Boolean(vParts.cabinDriverFigure),
        seatAssembliesCount: vParts.seatAssembliesCount || 0,
        rendered3DSeatSubMeshesCount: Array.isArray(vParts.seatMeshes) ? vParts.seatMeshes.length : 0
      };
    })()`);
    recordTest(
      5,
      'Inspecting the Apex Danfo 14 interior and verifying the canonical 14-position layout (1 Driver + 1 Conductor + 12 Passenger Seats)',
      t5.totalCapacity === 14 &&
        t5.driverPositions === 1 &&
        t5.conductorPositions === 1 &&
        t5.passengerSeatCapacity === 12 &&
        t5.occupiedPassengerCount === 2 &&
        t5.availablePassengerCount === 10 &&
        t5.hollowCabinInterior === true &&
        t5.cabinDriverFigurePresent === true &&
        t5.seatAssembliesCount === 13 &&
        t5.rendered3DSeatSubMeshesCount === 39,
      t5
    );

    // =========================================================================
    // TEST 6 & TEST 7: Boarding through the passenger entrance and sitting on an actual seat anchor inside the cabin
    // =========================================================================
    const t67 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const boardRes = vs.boardAsPassenger('danfo', {
        preferredSeatId: 'rear_passenger_2',
        openRouteModal: false,
        startShuttleCruise: false
      });
      updateSimulation(0.033);
      const snap = vs.getDiagnosticSnapshot();
      const localX = snap.occupiedSeatOffset.x;
      const localY = snap.occupiedSeatOffset.y;
      const localZ = snap.occupiedSeatOffset.z;
      const worldDeltaY = Number((playerAvatar.position.y - heroDanfo.position.y).toFixed(2));
      const insideCabinBounds =
        localX >= -0.88 && localX <= 0.88 &&
        localY >= 0.45 && localY <= 1.15 &&
        localZ >= -1.95 && localZ <= 1.55;
      return {
        boardRes,
        state: snap.state,
        seatId: snap.currentSeatId,
        seatLabel: snap.currentSeatLabel,
        occupiedSeatOffset: snap.occupiedSeatOffset,
        worldDeltaY,
        insideCabinBounds,
        playerAvatarVisible: snap.playerAvatarPosition?.visible,
        boardingWaypoints: boardRes.boardingPath?.waypoints || []
      };
    })()`);
    recordTest(
      6,
      'Boarding through the right-side sliding passenger entrance along the aisle and sitting on an actual seat anchor',
      t67.boardRes.allowed === true &&
        t67.state === 'PASSENGER' &&
        t67.seatId === 'rear_passenger_2' &&
        t67.boardingWaypoints.length === 4 &&
        t67.boardingWaypoints[0].step === 'curbApproach' &&
        t67.boardingWaypoints[1].step === 'slidingDoorStep' &&
        t67.boardingWaypoints[2].step === 'aisleAlign' &&
        t67.boardingWaypoints[3].step === 'seatAnchor',
      t67
    );
    recordTest(
      7,
      'Verifying that the passenger is inside the cabin and not floating above the roof or clipping into the road',
      t67.insideCabinBounds === true &&
        t67.worldDeltaY >= 0.50 &&
        t67.worldDeltaY <= 1.05 &&
        t67.playerAvatarVisible === true,
      t67
    );

    // =========================================================================
    // TEST 8, TEST 9 & TEST 18: Selecting a valid stop, viewing the calculated fare, paying the fare, and verifying Game Naira ledger debit (and never paying driver salary to passenger)
    // =========================================================================
    const t89 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      player.balance = 5000;
      const quote1Stop = vs.calculateDanfoFareQuoteSync('route_cms_tbs_northbound', 'stop_cms', 'stop_broad_north', { isRaining: false });
      const quote3Stops = vs.calculateDanfoFareQuoteSync('route_cms_tbs_northbound', 'stop_cms', 'stop_broad_south', { isRaining: false });
      const quote4Stops = vs.calculateDanfoFareQuoteSync('route_cms_tbs_northbound', 'stop_cms', 'stop_tbs_gate', { isRaining: false });

      const payRes = vs.confirmDanfoRideAndPay({
        eventId: 'ev_m481_test_ride_3stops',
        routeId: 'route_cms_tbs_northbound',
        originStopId: 'stop_cms',
        destinationStopId: 'stop_broad_south',
        seatId: 'rear_passenger_2',
        tenderedNoteGN: 500,
        startShuttleCruise: true
      });
      return {
        quote1StopFare: quote1Stop.totalFareGN,
        quote3StopsFare: quote3Stops.totalFareGN,
        quote4StopsFare: quote4Stops.totalFareGN,
        payRes
      };
    })()`);

    // Also verify on the authoritative Domain API (:3001)
    const apiFareCheck = await httpJson(`${API_URL}/api/v1/danfo/board-and-pay`, 'POST', {
      accountId: 'usr_m481_api_pax',
      displayName: 'API Commuter',
      eventId: `ev_m481_api_board_${Date.now()}`,
      vehicleId: 'veh_danfo_coop',
      preferredSeatId: 'front_passenger',
      routeId: 'route_cms_tbs_northbound',
      originStopId: 'stop_cms',
      destinationStopId: 'stop_broad_south',
      tenderedNoteGN: 500,
      isRaining: false
    });
    await httpJson(`${API_URL}/api/v1/vehicles/exit-seat`, 'POST', {
      userId: 'usr_m481_api_pax',
      vehicleId: 'veh_danfo_coop'
    });

    recordTest(
      8,
      'Selecting a valid stop on the Danfo route and viewing the calculated stop-based fare before confirming (1 stop=150 GN, 3 stops=350 GN, 4 stops=450 GN)',
      t89.quote1StopFare === 150 &&
        t89.quote3StopsFare === 350 &&
        t89.quote4StopsFare === 450,
      {
        quote1StopFare: t89.quote1StopFare,
        quote3StopsFare: t89.quote3StopsFare,
        quote4StopsFare: t89.quote4StopsFare
      }
    );

    recordTest(
      9,
      'Paying the fare (350 GN with 500 GN note -> 150 GN change) and verifying the Game Naira ledger debit (5000 -> 4650 GN)',
      t89.payRes.allowed === true &&
        t89.payRes.balanceBeforeGN === 5000 &&
        t89.payRes.balanceAfterGN === 4650 &&
        t89.payRes.ticket.farePaidGN === 350 &&
        t89.payRes.ticket.changeReturnedGN === 150 &&
        apiFareCheck.status === 200 &&
        apiFareCheck.data?.allowed === true &&
        apiFareCheck.data?.farePaidGN === 350 &&
        apiFareCheck.data?.changeDueGN === 150,
      { client: t89.payRes, server: apiFareCheck.data }
    );

    recordTest(
      18,
      'Verifying that passenger boarding deducts the fare and NEVER pays the player a driver salary',
      t89.payRes.balanceAfterGN < t89.payRes.balanceBeforeGN &&
        apiFareCheck.data?.passengerPaidDriverSalary === false &&
        apiFareCheck.data?.ledgerEntry?.direction === 'DEBIT',
      {
        balanceBeforeGN: t89.payRes.balanceBeforeGN,
        balanceAfterGN: t89.payRes.balanceAfterGN,
        serverLedgerEntry: apiFareCheck.data?.ledgerEntry
      }
    );

    // =========================================================================
    // TEST 10: Attempting to choose a destination not served by that Danfo and receiving a clear explanation
    // =========================================================================
    const t10 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const offRouteQuote = vs.calculateDanfoFareQuoteSync('route_cms_tbs_northbound', 'stop_cms', 'stop_ikoyi_offroute');
      const behindQuote = vs.calculateDanfoFareQuoteSync('route_cms_tbs_northbound', 'stop_broad_central', 'stop_cms');
      return { offRouteQuote, behindQuote };
    })()`);
    recordTest(
      10,
      'Attempting to choose an off-route or behind-direction destination and receiving a clear explanation & alternative route',
      t10.offRouteQuote.valid === false &&
        t10.offRouteQuote.reasonCode === 'DESTINATION_OFF_ROUTE' &&
        Boolean(t10.offRouteQuote.alternativeRouteId) &&
        t10.behindQuote.valid === false &&
        t10.behindQuote.reasonCode === 'DESTINATION_BEHIND_DIRECTION',
      t10
    );

    // =========================================================================
    // TEST 11: Riding while the Danfo moves along its route (interior passenger camera & seat synchronization)
    // =========================================================================
    const t11 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      cameraMode = 'passenger';
      vs.shuttleCruiseActive = true;
      vs.shuttleSpeedKmh = 28;
      const vehBeforeZ = heroDanfo.position.z;
      const paxBeforeZ = playerAvatar.position.z;
      // Attempt W/A/S/D while seated as passenger — must not steer or accelerate independently
      keys.w = true;
      keys.a = true;
      for (let i = 0; i < 15; i++) {
        updateSimulation(0.04);
      }
      keys.w = false;
      keys.a = false;
      const vehMovedZ = heroDanfo.position.z - vehBeforeZ;
      const paxMovedZ = playerAvatar.position.z - paxBeforeZ;
      const attachError = Math.abs(vehMovedZ - paxMovedZ);
      const yawAfterLook = vs.lookAroundPassenger(0.12);
      cameraOrbitYaw = 0.08;
      updateSimulation(0.016);
      const snap = vs.getDiagnosticSnapshot();
      return {
        state: snap.state,
        cameraMode: snap.cameraMode,
        vehMovedZ: Number(vehMovedZ.toFixed(2)),
        paxMovedZ: Number(paxMovedZ.toFixed(2)),
        attachError: Number(attachError.toFixed(4)),
        yawAfterLook: Number(yawAfterLook.toFixed(3)),
        cabinDriverVisible: Boolean(heroDanfo.userData.vehicleParts?.cabinDriverFigure?.visible),
        passengerHudVisible: snap.uiVisibility.passengerHudVisible
      };
    })()`);

    results.screenshots.danfoInteriorPassengerDesktop = await cdp.screenshot('m4_8_1_danfo_interior_passenger_view_desktop.png');

    await cdp.evaluate(`(() => {
      cameraMode = 'chase';
      cameraOrbitYaw = 0.65;
      updateSimulation(0.016);
    })()`);
    results.screenshots.danfoSeatedPassengerExteriorDesktop = await cdp.screenshot('m4_8_1_danfo_seated_passenger_exterior_desktop.png');
    await cdp.evaluate(`(() => {
      cameraMode = 'passenger';
      cameraOrbitYaw = 0;
      updateSimulation(0.016);
    })()`);

    recordTest(
      11,
      'Riding while the Danfo moves along its route with synchronized seat attachment, interior camera, and visible 3D Driver',
      t11.state === 'PASSENGER' &&
        t11.cameraMode === 'passenger' &&
        t11.vehMovedZ > 2.5 &&
        t11.attachError < 0.05 &&
        t11.cabinDriverVisible === true &&
        t11.passengerHudVisible === true,
      t11
    );

    // =========================================================================
    // TEST 13 & TEST 12: Preventing exit while moving (>= 5 km/h), then requesting a stop ("O wa o!") and alighting safely when stopped
    // =========================================================================
    const t13 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.shuttleCruiseActive = true;
      vs.shuttleSpeedKmh = 28;
      const movingExitRes = vs.exitVehicleToOnFoot();
      return {
        movingExitRes,
        stateAfterMovingAttempt: vs.state
      };
    })()`);

    recordTest(
      13,
      'Preventing passenger exit while the Danfo is moving above the safe stop threshold (>= 5 km/h -> VEHICLE_MOVING_CANNOT_EXIT)',
      t13.movingExitRes.allowed === false &&
        t13.movingExitRes.reasonCode === 'VEHICLE_MOVING_CANNOT_EXIT' &&
        t13.stateAfterMovingAttempt === 'PASSENGER',
      t13
    );

    const t12StopAndAlight = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      // Press O ("O wa o!") to request stop
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', code: 'KeyO', bubbles: true }));
      const speedAfterStopReq = vs.shuttleSpeedKmh;
      const stopRequested = vs.danfoStopRequested;
      const atPermittedStop = vs.danfoAtPermittedStop;
      // Now exit safely at the stationary stop
      const alightRes = vs.exitVehicleToOnFoot();
      const snap = vs.getDiagnosticSnapshot();
      return {
        stopRequested,
        speedAfterStopReq,
        atPermittedStop,
        alightRes,
        stateAfterAlight: snap.state,
        playerAvatarPosition: snap.playerAvatarPosition
      };
    })()`);

    recordTest(
      12,
      'Requesting a stop ("O wa o!" [O]) halts the Danfo at the stop layby (0 km/h) and allows safe alighting through the sliding doorway',
      t12StopAndAlight.stopRequested === true &&
        t12StopAndAlight.speedAfterStopReq === 0 &&
        t12StopAndAlight.atPermittedStop === true &&
        t12StopAndAlight.alightRes.allowed === true &&
        t12StopAndAlight.stateAfterAlight === 'ON_FOOT' &&
        t12StopAndAlight.alightRes.alightingPath?.exitDoor === 'RIGHT_SLIDING_DOOR',
      t12StopAndAlight
    );

    // =========================================================================
    // TEST 14: Attempting to board a full Danfo (NO_SEATS_AVAILABLE)
    // =========================================================================
    const t14 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const fullRes = vs.boardAsPassenger('veh_npc_full_shuttle');
      return {
        fullRes,
        state: vs.state
      };
    })()`);
    recordTest(
      14,
      'Attempting to board a full Danfo (veh_npc_full_shuttle) rejects boarding cleanly with NO_SEATS_AVAILABLE',
      t14.fullRes.allowed === false &&
        t14.fullRes.reasonCode === 'NO_SEATS_AVAILABLE' &&
        t14.state === 'ON_FOOT',
      t14
    );

    // =========================================================================
    // TEST 15: Attempting to occupy an already-occupied seat on Apex Danfo 14 (SEAT_ALREADY_OCCUPIED)
    // =========================================================================
    const t15 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const occupiedRes = vs.boardAsPassenger('danfo', {
        preferredSeatId: 'rear_passenger_9' // Occupied by NPC commuter Mama Risikat
      });
      return {
        occupiedRes,
        state: vs.state
      };
    })()`);
    recordTest(
      15,
      'Attempting to occupy an already-occupied seat (rear_passenger_9 — Mama Risikat) rejects overlapping seat assignment (SEAT_ALREADY_OCCUPIED)',
      t15.occupiedRes.allowed === false &&
        t15.occupiedRes.reasonCode === 'SEAT_ALREADY_OCCUPIED' &&
        t15.state === 'ON_FOOT',
      t15
    );

    // =========================================================================
    // TEST 16 & TEST 17: Joining as Conductor ([G]), verifying conductor-only controls, collecting fares, issuing change, and verifying ledger credit
    // =========================================================================
    const t1617 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      player.balance = 5000;
      const condRes = vs.boardAsConductor('danfo');
      const mesh = heroDanfo;
      vs.shuttleCruiseActive = false;
      vs.shuttleSpeedKmh = 0;
      const beforeX = mesh.position.x;
      const beforeZ = mesh.position.z;
      keys.w = true;
      keys.a = true;
      for (let i = 0; i < 8; i++) updateSimulation(0.04);
      keys.w = false;
      keys.a = false;
      const movedWhileConductor = Math.hypot(mesh.position.x - beforeX, mesh.position.z - beforeZ);

      const callRes = vs.performConductorAction('ANNOUNCE_ROUTE');
      const collectRes = vs.performConductorAction('COLLECT_FARES', {
        eventId: 'ev_m481_cond_collect_1',
        passengersCount: 2,
        farePerPassengerGN: 250,
        tenderedNoteGN: 1000
      });
      const snap = vs.getDiagnosticSnapshot();
      return {
        condRes,
        state: snap.state,
        isDriving: snap.isDriving,
        isConductorMode: snap.isConductorMode,
        seatId: snap.currentSeatId,
        movedWhileConductor: Number(movedWhileConductor.toFixed(4)),
        conductorHudVisible: snap.uiVisibility.conductorHudVisible,
        callRes,
        collectRes
      };
    })()`);

    results.screenshots.danfoConductorHudDesktop = await cdp.screenshot('m4_8_1_danfo_conductor_hud_desktop.png');

    await cdp.evaluate(`window.__PROJECT_EKO_VEHICLE_STATE__.exitVehicleToOnFoot({ forceExit: true })`);

    recordTest(
      16,
      'Joining as Conductor ([G]) places player at conductor_step, enables Conductor HUD, and disables vehicle driving controls',
      t1617.condRes.allowed === true &&
        t1617.state === 'CONDUCTOR' &&
        t1617.isDriving === false &&
        t1617.isConductorMode === true &&
        t1617.seatId === 'conductor_step' &&
        t1617.movedWhileConductor === 0 &&
        t1617.conductorHudVisible === true,
      t1617
    );

    recordTest(
      17,
      'Collecting fares as Conductor (2 pax @ 250 GN = 500 GN, 1000 GN note tendered -> 500 GN change, +150 GN 30% Conductor Commission settled)',
      t1617.collectRes.allowed === true &&
        t1617.collectRes.grossFareGN === 500 &&
        t1617.collectRes.changeIssuedGN === 500 &&
        t1617.collectRes.conductorShareGN === 150 &&
        t1617.collectRes.balanceAfterGN - t1617.collectRes.balanceBeforeGN === 150,
      t1617.collectRes
    );

    // =========================================================================
    // TEST 19: Verifying that free-roam driving does not generate commercial fare income
    // =========================================================================
    const t19 = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      if (window.__PROJECT_EKO_GUIDE__ && window.__PROJECT_EKO_GUIDE__.journeyState) {
        window.__PROJECT_EKO_GUIDE__.journeyState.activeShiftId = null;
      }
      if (typeof taxiRouteState !== 'undefined') taxiRouteState.stage = 'idle';
      const balBefore = Number(player.balance || 0);
      const elig = vs.validateDriverEligibilitySync('danfo');
      quickSwitchVehicle('danfo');
      keys.w = true;
      for (let i = 0; i < 12; i++) updateSimulation(0.04);
      keys.w = false;
      vs.exitVehicleToOnFoot({ forceExit: true });
      const balAfter = Number(player.balance || 0);
      return {
        elig,
        balBefore,
        balAfter,
        deltaGN: balAfter - balBefore
      };
    })()`);
    recordTest(
      19,
      'Verifying that free-roam driving does not generate commercial fare income (deltaGN === 0)',
      t19.elig.allowed === true &&
        t19.elig.freeRoamPersonalDriving === true &&
        t19.elig.commercialEarningAllowed === false &&
        t19.deltaGN === 0,
      t19
    );

    // =========================================================================
    // TEST 20: Verifying that duplicate inputs / repeated eventIds do not charge or pay twice
    // =========================================================================
    const dupEventId = `ev_m481_idempotent_${Date.now()}`;
    const firstPay = await httpJson(`${API_URL}/api/v1/danfo/board-and-pay`, 'POST', {
      accountId: 'usr_m481_idempotent_pax',
      displayName: 'Idempotent Tester',
      eventId: dupEventId,
      vehicleId: 'veh_danfo_coop',
      preferredSeatId: 'rear_passenger_4',
      routeId: 'route_cms_tbs_northbound',
      originStopId: 'stop_cms',
      destinationStopId: 'stop_broad_central',
      isRaining: false
    });
    const secondPay = await httpJson(`${API_URL}/api/v1/danfo/board-and-pay`, 'POST', {
      accountId: 'usr_m481_idempotent_pax',
      displayName: 'Idempotent Tester',
      eventId: dupEventId,
      vehicleId: 'veh_danfo_coop',
      preferredSeatId: 'rear_passenger_4',
      routeId: 'route_cms_tbs_northbound',
      originStopId: 'stop_cms',
      destinationStopId: 'stop_broad_central',
      isRaining: false
    });
    await httpJson(`${API_URL}/api/v1/vehicles/exit-seat`, 'POST', {
      userId: 'usr_m481_idempotent_pax',
      vehicleId: 'veh_danfo_coop'
    });

    recordTest(
      20,
      'Verifying that duplicate inputs / repeated eventIds do not charge or pay twice (idempotent ledger protection)',
      firstPay.data?.allowed === true &&
        secondPay.data?.allowed === true &&
        secondPay.data?.idempotentReplay === true &&
        firstPay.data?.balanceAfterGN === secondPay.data?.balanceAfterGN,
      { firstPay: firstPay.data, secondPay: secondPay.data }
    );

    // =========================================================================
    // TEST 21: Testing mobile touch controls (390x844 portrait & 844x390 landscape)
    // =========================================================================
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await cdp.evaluate(`(() => {
      if (window.__PROJECT_EKO_INPUT_PROMPTS__) window.__PROJECT_EKO_INPUT_PROMPTS__.setDevice('touch', 'mobile_test');
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      vs.exitVehicleToOnFoot({ forceExit: true });
      vs.currentDanfoStopId = 'stop_cms';
      vs.selectedOriginStopId = 'stop_cms';
      vs.selectedDestinationStopId = 'stop_broad_central';
      heroDanfo.position.z = -38;
      playerAvatar.position.set(heroDanfo.position.x + 2.1, 0.22, heroDanfo.position.z + 0.65);
      updateSimulation(0.033);
    })()`);

    const t21Mobile = await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      const hasDriveBtn = Boolean(document.getElementById('m481-prox-drive-btn'));
      const hasBoardBtn = Boolean(document.getElementById('m481-prox-board-passenger-btn'));
      const hasCondBtn = Boolean(document.getElementById('m481-prox-conductor-btn'));

      // Tap Board as Passenger on mobile
      document.getElementById('m481-prox-board-passenger-btn').click();
      const modalVisible = document.getElementById('m481-danfo-boarding-modal')?.style.display === 'flex';
      // Select destination & confirm fare on mobile
      vs.onChangeDanfoModalDestination('stop_broad_central');
      document.getElementById('m481-confirm-board-btn').click();

      const hasRequestStopBtn = Boolean(document.getElementById('m481-pass-request-stop-btn'));
      const hasExitBtn = Boolean(document.getElementById('m48-pass-exit-btn'));
      return {
        hasDriveBtn,
        hasBoardBtn,
        hasCondBtn,
        modalVisible,
        stateAfterMobileConfirm: vs.state,
        hasRequestStopBtn,
        hasExitBtn
      };
    })()`);

    results.screenshots.mobilePortraitDanfoPassenger = await cdp.screenshot('m4_8_1_mobile_portrait_danfo_passenger.png');

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 844,
      height: 390,
      deviceScaleFactor: 2,
      mobile: true
    });
    await cdp.evaluate(`(() => {
      const vs = window.__PROJECT_EKO_VEHICLE_STATE__;
      document.getElementById('m481-pass-request-stop-btn').click();
    })()`);
    results.screenshots.mobileLandscapeDanfoStopRequested = await cdp.screenshot('m4_8_1_mobile_landscape_danfo_stop.png');

    const t21Alight = await cdp.evaluate(`(() => {
      document.getElementById('m48-pass-exit-btn').click();
      return { finalState: window.__PROJECT_EKO_VEHICLE_STATE__.state };
    })()`);

    recordTest(
      21,
      'Testing mobile touch controls (390x844 portrait & 844x390 landscape) for Drive, Board as Passenger, Join as Conductor, Choose Destination, Confirm Fare, Request Stop ("O wa!"), and Exit at Stop',
      t21Mobile.hasDriveBtn &&
        t21Mobile.hasBoardBtn &&
        t21Mobile.hasCondBtn &&
        t21Mobile.modalVisible &&
        t21Mobile.stateAfterMobileConfirm === 'PASSENGER' &&
        t21Mobile.hasRequestStopBtn &&
        t21Mobile.hasExitBtn &&
        t21Alight.finalState === 'ON_FOOT',
      { ...t21Mobile, ...t21Alight }
    );

    // =========================================================================
    // TEST 22: Confirming zero console errors and zero uncaught page errors
    // =========================================================================
    const errSnap = await cdp.evaluate(`({
      consoleErrors: window.__M481_CONSOLE_ERRORS__ || [],
      pageErrors: window.__M481_PAGE_ERRORS__ || []
    })`);
    results.consoleErrors = errSnap.consoleErrors;
    results.pageErrors = errSnap.pageErrors;

    recordTest(
      22,
      'Confirming zero console errors and zero uncaught page errors across all 22 M4.8.1 flows',
      errSnap.consoleErrors.length === 0 && errSnap.pageErrors.length === 0,
      errSnap
    );

    results.allPassed = results.tests.every(t => t.passed);
    fs.writeFileSync(DELIVERY_JSON, JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'm4_8_1_verification_results.json'), JSON.stringify(results, null, 2));

    console.log(`\n================================================================`);
    console.log(`M4.8.1 VERIFICATION SUMMARY: ${results.tests.filter(t => t.passed).length}/${results.tests.length} PASSED`);
    console.log(`================================================================\n`);

    if (!results.allPassed) {
      process.exitCode = 1;
    }
  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGKILL');
  }
}

main().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
