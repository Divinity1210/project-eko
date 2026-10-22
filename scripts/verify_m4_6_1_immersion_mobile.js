#!/usr/bin/env node
/**
 * PROJECT EKO — M4.6.1 IMMERSION, OCCLUSION & MOBILE UX ACCEPTANCE
 * Drives the running app (http://localhost:3000) in headless Chrome via CDP using REAL key events
 * (Input.dispatchKeyEvent) and REAL multi-touch events (Input.dispatchTouchEvent) at phone portrait,
 * phone landscape, tablet and desktop viewports. Writes m4_6_1_acceptance_results.json + screenshots.
 * NOTE: device-metrics + touch emulation is not a physical phone; see the delivery report.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GAME_URL = 'http://localhost:3000/index.html';
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
      awaitPromise: true
    });
    if (res && res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text}`);
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

  return { ws: { close: () => socket.destroy() }, send, evaluate, setViewport, screenshot };
}

// =============================================================================
// M4.6.1 ACCEPTANCE HARNESS — real key events (Input.dispatchKeyEvent) and real
// multi-touch events (Input.dispatchTouchEvent) against the running application.
// =============================================================================
const KEY_CODES = { e: 69, h: 72, c: 67, w: 87, a: 65, s: 83, d: 68, r: 82, Escape: 27 };

async function main() {
  const debugPort = 9346;
  const userDataDir = path.join('/tmp', `eko_chrome_m461_${Date.now()}`);
  const chromeProc = spawn(
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
      GAME_URL
    ],
    { stdio: 'ignore' }
  );

  const results = {
    timestamp: new Date().toISOString(),
    environment: 'Headless Chrome (CDP) with device-metrics + touch emulation; NOT a physical phone',
    checks: [],
    perf: {},
    occlusion: {},
    input: {},
    viewports: {},
    persistence: {},
    walk: {},
    screenshots: []
  };
  let failures = 0;
  function check(name, condition, details = '') {
    const passed = Boolean(condition);
    results.checks.push({ name, passed, details });
    if (!passed) failures++;
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` (${details})` : ''}`);
    return passed;
  }

  let client;
  try {
    for (let i = 0; i < 40; i++) {
      try { await fetchJson(`http://127.0.0.1:${debugPort}/json/version`); break; } catch (_) { await sleep(250); }
    }
    client = await createCDPClient(debugPort);
    const send = (method, params) => Promise.race([
      client.send(method, params),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`CDP timeout: ${method} ${JSON.stringify(params || {}).slice(0, 120)}`)), 12000))
    ]);
    const T0 = Date.now();
    async function evaluate(expr) {
      const t = Date.now();
      const v = await Promise.race([client.evaluate(expr), new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timeout: ' + expr.slice(0, 100))), 15000))]);
      const dt = Date.now() - t;
      if (dt > 3000) console.log(`   ⏱️ slow evaluate ${dt}ms @${((Date.now() - T0) / 1000).toFixed(1)}s: ${expr.slice(0, 80).replace(/\s+/g, ' ')}`);
      return v;
    }
    await send('Page.enable');
    await send('Runtime.enable');

    async function waitBoot() {
      for (let i = 0; i < 60; i++) {
        const ok = await evaluate(`Boolean(window.__PROJECT_EKO_LIFE__ && window.__PROJECT_EKO_PERF__ && window.__PROJECT_EKO_HUD_MODE__ && window.__PROJECT_EKO_HUD_MODE__.mode)`);
        if (ok) return true;
        await sleep(250);
      }
      return false;
    }
    check('Application boots with M4.6.1 HUD-mode, prompt & visibility services', await waitBoot());
    await sleep(800);
    await evaluate(`window.__m461errs = []; window.addEventListener('error', e => window.__m461errs.push(String(e.message) + ' @' + e.lineno + ':' + e.colno + ' ' + (e.error && e.error.stack ? e.error.stack.split('\\n').slice(0, 4).join(' | ') : ''))); true`);

    async function setViewport(width, height, mobile = false) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
      await evaluate(`window.dispatchEvent(new Event('resize'));`);
      await sleep(300);
    }
    async function key(k, holdMs = 60) {
      const code = k === 'Escape' ? 'Escape' : `Key${k.toUpperCase()}`;
      const vk = KEY_CODES[k] || k.toUpperCase().charCodeAt(0);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: k.length === 1 ? k : undefined });
      await sleep(holdMs);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
      await sleep(120);
    }
    async function rectOf(id) {
      return evaluate(`(() => { const el = document.getElementById('${id}'); if (!el) return null; const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom, visible: st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0 }; })()`);
    }
    async function touchStart(points) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points }); }
    async function touchMove(points) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points }); }
    async function touchEnd(points = []) { await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: points }); }
    async function tap(id) {
      const r = await rectOf(id);
      if (!r || !r.visible) return false;
      await touchStart([{ x: r.x, y: r.y, id: 1 }]);
      await sleep(70);
      await touchEnd([]);
      await sleep(260);
      return true;
    }
    async function holdTouch(id, ms) {
      const r = await rectOf(id);
      if (!r || !r.visible) return false;
      await touchStart([{ x: r.x, y: r.y, id: 7 }]);
      await sleep(ms);
      await touchEnd([]);
      await sleep(120);
      return true;
    }
    async function state() {
      return evaluate(`(() => {
        const L = window.__PROJECT_EKO_LIFE__;
        return {
          mode: window.__PROJECT_EKO_HUD_MODE__.mode,
          device: window.__PROJECT_EKO_INPUT_PROMPTS__.device,
          inside: Boolean(L.isInsideHomeInterior),
          camMode: L.homeCameraMode,
          driving: Boolean(isDriving),
          front: Boolean(isFrontViewMode),
          heading: playerHeading,
          px: playerAvatar.position.x, py: playerAvatar.position.y, pz: playerAvatar.position.z,
          cx: camera.position.x, cy: camera.position.y, cz: camera.position.z,
          keys: { w: keys.w, a: keys.a, s: keys.s, d: keys.d, shift: keys.shift },
          joy: window.__PROJECT_EKO_MOBILE__.joystickActive
        };
      })()`);
    }
    async function frameRate() {
      const f0 = await evaluate(`EkoVisibility.frame`);
      await sleep(500);
      const f1 = await evaluate(`EkoVisibility.frame`);
      return (f1 - f0) * 2;
    }
    async function resetPerfWindow() {
      await evaluate(`if (window.__PROJECT_EKO_PERF_MANAGER__) { window.__PROJECT_EKO_PERF_MANAGER__.frameTimesMs = []; window.__PROJECT_EKO_PERF_MANAGER__.warmupFramesRemaining = 2; }`);
    }
    async function measure(label) {
      await resetPerfWindow();
      await sleep(1500);
      const p = await evaluate(`({ ...window.__PROJECT_EKO_PERF__, heapMB: performance.memory ? Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1)) : null })`);
      results.perf[label] = p;
      return p;
    }
    async function shot(name) {
      await evaluate(`typeof dismissToast === 'function' && dismissToast()`);
      await sleep(250);
      const ts = Date.now();
      const out = await client.screenshot(name);
      console.log(`   📸 ${name} (${Date.now() - ts}ms @${((Date.now() - T0) / 1000).toFixed(1)}s)`);
      results.screenshots.push(out);
      return out;
    }

    // -------------------------------------------------------------------------
    // 0. DESKTOP KEYBOARD BASELINE + LOAD COST + STREET PERFORMANCE
    // -------------------------------------------------------------------------
    await setViewport(1440, 900, false);
    await evaluate(`toggleCityOverviewCamera(false); localStorage.removeItem('__PROJECT_EKO_MASTER_BIBLE_V1__');`);
    const load = await evaluate(`(() => { const nav = performance.getEntriesByType('navigation')[0]; return { domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null, loadEventMs: nav ? Math.round(nav.loadEventEnd) : null, perfManagerLoadMs: window.__PROJECT_EKO_PERF__.loadTimeMs, scripts: performance.getEntriesByType('resource').filter(r => /three/.test(r.name)).map(r => ({ name: r.name.split('/').pop(), ms: Math.round(r.duration), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024) })) }; })()`);
    results.perf.loading = load;
    await key('w', 30); // establishes keyboard as the active device
    const streetDesk = await measure('street_desktop_1440x900');
    check('Street-level exploration performance measured (desktop)', streetDesk.drawCalls > 0, `fps=${streetDesk.fps}, frame=${streetDesk.frameTimeMs}ms, p95=${streetDesk.p95FrameTimeMs}ms, calls=${streetDesk.drawCalls}, tris=${streetDesk.triangles}`);
    await shot('m4_6_1_street_desktop.png');

    // -------------------------------------------------------------------------
    // 1. ENTER / EXIT STARTER HOME WITH REAL [H] KEY (exterior spawn, indoor spawn, camera)
    // -------------------------------------------------------------------------
    await evaluate(`window.__PROJECT_EKO_LIFE__.spawnOutsideStarterHome();`);
    await sleep(500);
    const porch = await evaluate(`(() => {
      const p = playerAvatar.position;
      const resolved = EkoSpatialEngine.resolvePlayerOnFootCollisions(p.x, p.z, p.x, p.z - 3.0);
      const life = window.__PROJECT_EKO_LIFE__;
      const shell = life.structBoxes.find(b => b.isPlayerExteriorShell && b.sx > 8);
      const door = life.structBoxes.find(b => b.isPlayerExteriorShell && b.hex === 0x78350F);
      return { px: p.x, pz: p.z, walkIntoHouseStopsAtZ: resolved.z, shellMaxZ: shell.z + shell.sz / 2, doorZ: door.z, cue: document.getElementById('interaction-cue').textContent };
    })()`);
    check('Exterior shell, front door & interior doorway are spatially aligned', Math.abs(porch.shellMaxZ - (-147.75)) < 0.01 && Math.abs(porch.doorZ - (-147.64)) < 0.05, `shellMaxZ=${porch.shellMaxZ}, doorZ=${porch.doorZ}, interiorDoorZ=-147.95`);
    check('Residence shell is solid from the street (walking into the house stops at the facade)', porch.walkIntoHouseStopsAtZ > -147.76, `tried z=${(porch.pz - 3).toFixed(2)} → resolved z=${porch.walkIntoHouseStopsAtZ.toFixed(2)}`);
    check('Residence keyboard prompt names real keys', /PRESS \[E\] OR \[H\] TO ENTER/.test(porch.cue), porch.cue);
    await shot('m4_6_1_home_exterior_porch.png');

    const tEnter0 = Date.now();
    await key('h');
    await sleep(500);
    const enterMs = Date.now() - tEnter0;
    let s = await state();
    if (!s || typeof s.px !== 'number') console.log('   DEBUG state:', JSON.stringify(s));
    const spawnCheck = await evaluate(`({ blocked: window.__PROJECT_EKO_LIFE__.isHomeInteriorPointBlocked(playerAvatar.position.x, playerAvatar.position.z), fallback: window.__PROJECT_EKO_LIFE__.lastSpawnFallback })`);
    check('[H] at the porch enters the home (previously unreachable horn branch fixed)', s.inside && s.mode === 'home', `inside=${s.inside}, hudMode=${s.mode}`);
    check('Indoor spawn is clear of walls, door and furniture', !spawnCheck.blocked && Math.abs(s.px + 62) < 3.7 && s.pz > -155.7 && s.pz < -148.1, `spawn=(${s.px.toFixed(2)}, ${s.py.toFixed(2)}, ${s.pz.toFixed(2)})`);
    // Third-person: camera must be BEHIND the avatar (opposite to facing), at human height, inside the room
    const fwdX = Math.sin(s.heading), fwdZ = Math.cos(s.heading);
    const behindDot = (s.px - s.cx) * fwdX + (s.pz - s.cz) * fwdZ;
    check('Home Exploration camera is a human-height third-person camera behind the avatar', behindDot > 0.4 && s.cy > 1.2 && s.cy < 2.4, `behindDot=${behindDot.toFixed(2)}m, camY=${s.cy.toFixed(2)}m`);
    check('Driving HUD & vehicle selectors hidden in home', await evaluate(`getComputedStyle(document.querySelector('.hud-bottom-bar')).display === 'none' && getComputedStyle(document.getElementById('interaction-cue')).display === 'none'`));
    results.perf.homeEntryTransitionMs = enterMs;
    const homeExp = await measure('home_exploration_desktop_1440x900');
    check('Home exploration performance measured', homeExp.drawCalls > 0, `fps=${homeExp.fps}, frame=${homeExp.frameTimeMs}ms, calls=${homeExp.drawCalls}, tris=${homeExp.triangles}, entry=${enterMs}ms`);
    await shot('m4_6_1_home_exploration_desktop.png');

    // -------------------------------------------------------------------------
    // 2. WALK AROUND FURNITURE (real held W/A/D keys) — no clipping into furniture or walls
    // -------------------------------------------------------------------------
    const walkSamples = [];
    const headings = [Math.PI, -Math.PI / 2, Math.PI / 2, 2.4, -2.4, 0.0, Math.PI * 0.75];
    for (const h of headings) {
      await evaluate(`playerHeading = ${h}; playerAvatar.rotation.y = playerHeading;`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
      for (let i = 0; i < 14; i++) {
        await sleep(110);
        walkSamples.push(await evaluate(`({ x: playerAvatar.position.x, z: playerAvatar.position.z, y: playerAvatar.position.y })`));
      }
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
      await sleep(150);
    }
    const walkAudit = await evaluate(`(() => {
      const L = window.__PROJECT_EKO_LIFE__;
      const samples = ${JSON.stringify(walkSamples)};
      let furnitureHits = 0, wallHits = 0, minClear = 99, offGround = 0;
      samples.forEach(sm => {
        const lx = sm.x + 62, lz = sm.z + 152;
        if (Math.abs(sm.y - (L.homeAvatarFootY || 0.22)) > 0.02) offGround++;
        const inDoor = Math.abs(lx) < 0.72 && lz > 3.45 && lz < 4.25;
        if (!inDoor && (Math.abs(lx) > 3.73 || Math.abs(lz) > 3.73)) wallHits++;
        L.placedFurniture.forEach(p => {
          if (p.itemId === 'itm_afrobeat_painting') return;
          const rn = Math.abs(Math.round((p.rotY || 0) / (Math.PI / 2))) % 2;
          const hw = (rn ? p.d : p.w) / 2, hd = (rn ? p.w : p.d) / 2;
          const dx = Math.max(0, Math.abs(lx - p.x) - hw), dz = Math.max(0, Math.abs(lz - p.z) - hd);
          const clear = Math.hypot(dx, dz);
          minClear = Math.min(minClear, clear);
          if (clear < 0.12) furnitureHits++;
        });
      });
      // Reachability: flood-fill the walkable grid from the spawn and confirm every object has a reachable use spot
      const step = 0.1, cells = new Set(), q = [[-62, -149.4]];
      const k = (x, z) => Math.round(x / step) + ',' + Math.round(z / step);
      cells.add(k(-62, -149.4));
      while (q.length) {
        const [x, z] = q.shift();
        [[step, 0], [-step, 0], [0, step], [0, -step]].forEach(([dx, dz]) => {
          const nx = x + dx, nz = z + dz;
          if (nz > -148.0) return;
          const kk = k(nx, nz);
          if (cells.has(kk) || L.isHomeInteriorPointBlocked(nx, nz)) return;
          cells.add(kk); q.push([nx, nz]);
        });
      }
      const reach = L.placedFurniture.map(p => {
        const ox = -62 + p.x, oz = -152 + p.z;
        let best = 99;
        cells.forEach(c => { const [cx, cz] = c.split(',').map(Number); best = Math.min(best, Math.hypot(cx * step - ox, cz * step - oz)); });
        return { itemId: p.itemId, nearestReachableM: Number(best.toFixed(2)) };
      });
      return { samples: samples.length, furnitureHits, wallHits, offGround, minClearM: Number(minClear.toFixed(3)), walkableCells: cells.size, walkableAreaM2: Number((cells.size * step * step).toFixed(2)), reach };
    })()`);
    results.walk = walkAudit;
    const moved = walkSamples.length > 1 && Math.hypot(walkSamples[0].x - walkSamples[walkSamples.length - 1].x, walkSamples[0].z - walkSamples[walkSamples.length - 1].z) > 0.2;
    check('Avatar walks around the furniture with real keys and never clips into furniture or walls', moved && walkAudit.furnitureHits === 0 && walkAudit.wallHits === 0 && walkAudit.offGround === 0, `samples=${walkAudit.samples}, furnitureHits=${walkAudit.furnitureHits}, wallHits=${walkAudit.wallHits}, minClearance=${walkAudit.minClearM}m, grounded=${walkAudit.offGround === 0}`);
    check('Every placed object is reachable on foot within interaction range (2.55m)', walkAudit.reach.every(r => r.nearestReachableM <= 2.55), walkAudit.reach.map(r => `${r.itemId.replace('itm_', '')}:${r.nearestReachableM}m`).join(', '));

    // -------------------------------------------------------------------------
    // 3. EXPLORATION ↔ PLANNER SWITCH (real [C] key) — no furniture/character/geometry side effects
    // -------------------------------------------------------------------------
    await evaluate(`playerAvatar.position.set(-62, window.__PROJECT_EKO_LIFE__.homeAvatarFootY || 0.22, -150.6); playerHeading = Math.PI; playerAvatar.rotation.y = Math.PI;`);
    await sleep(300);
    const before = await evaluate(`JSON.stringify({ f: window.__PROJECT_EKO_LIFE__.placedFurniture, p: [playerAvatar.position.x.toFixed(3), playerAvatar.position.z.toFixed(3)] })`);
    await key('c');
    await sleep(700);
    const plan = await state();
    const afterPlan = await evaluate(`JSON.stringify({ f: window.__PROJECT_EKO_LIFE__.placedFurniture, p: [playerAvatar.position.x.toFixed(3), playerAvatar.position.z.toFixed(3)] })`);
    check('[C] switches to Planner Mode (elevated cutaway) without moving furniture or the character', plan.camMode === 'planner' && plan.mode === 'planner' && afterPlan === before && plan.cy > 4.5, `camY=${plan.cy.toFixed(2)}, furnitureUnchanged=${afterPlan === before}`);
    const planner = await measure('home_planner_desktop_1440x900');
    const placementCheck = await evaluate(`(() => { const L = window.__PROJECT_EKO_LIFE__; const fan = L.placedFurniture.find(p => p.itemId === 'itm_standing_fan'); return { wall: L.validateFurniturePlacement(fan.instanceId, 3.8, 0, fan.w, fan.d, 0), door: L.validateFurniturePlacement(fan.instanceId, 0, 3.3, fan.w, fan.d, 0), ok: L.validateFurniturePlacement(fan.instanceId, fan.x, fan.z, fan.w, fan.d, fan.rotY || 0) }; })()`);
    check('Planner placement validation reports invalid & valid positions', !placementCheck.wall.valid && !placementCheck.door.valid && placementCheck.ok.valid !== false, `wall=${placementCheck.wall.reason || placementCheck.wall.error}, door=${placementCheck.door.reason || placementCheck.door.error}`);
    await shot('m4_6_1_home_planner_desktop.png');
    const moverCheck = await evaluate(`(() => {
      const L = window.__PROJECT_EKO_LIFE__;
      const saved = JSON.parse(JSON.stringify(L.placedFurniture));
      const fan = L.placedFurniture.find(p => p.itemId === 'itm_standing_fan') || L.placedFurniture[0];
      L.selectHomeFurnitureForMove(fan.instanceId, true);
      const x0 = fan.x, z0 = fan.z;
      const east = L.nudgePlacedFurniture(fan.instanceId, 0.35, 0);
      const xEast = fan.x;
      const west = L.nudgePlacedFurniture(fan.instanceId, -0.35, 0);
      const xWest = fan.x;
      const south = L.nudgePlacedFurniture(fan.instanceId, 0, 0.35);
      const zSouth = fan.z;
      const north = L.nudgePlacedFurniture(fan.instanceId, 0, -0.35);
      const zNorth = fan.z;
      const floorMove = L.moveSelectedFurnitureToFloorPoint(0.2, 0.6, true);
      const xFloor = fan.x, zFloor = fan.z;
      const snap = L.snapFurnitureToPreferredZone(fan.instanceId);
      const tidy = L.resetOrTidyHomeFurnitureLayout();
      L.placedFurniture = saved;
      L.rebuild3DHomeInteriorMesh();
      L.saveMasterBibleStateToStorage();
      const moverBarVisible = document.getElementById('home-hud-selected-mover-bar') && getComputedStyle(document.getElementById('home-hud-selected-mover-bar')).display !== 'none';
      return {
        moverBarVisible,
        eastOk: east.success && xEast > x0,
        westOk: west.success && xWest < xEast,
        southOk: south.success && zSouth > z0,
        northOk: north.success && zNorth < zSouth,
        floorMoveOk: floorMove.success && Math.hypot(xFloor - 0.2, zFloor - 0.6) < 0.65,
        snapOk: snap.success,
        tidyOk: tidy.success
      };
    })()`);
    check('Interactive 3D Furniture Mover supports 4-way nudges (West/East/North/South), 3D floor click-to-move, Zone Snap & Tidy Room', moverCheck.moverBarVisible && moverCheck.eastOk && moverCheck.westOk && moverCheck.southOk && moverCheck.northOk && moverCheck.floorMoveOk && moverCheck.snapOk && moverCheck.tidyOk, JSON.stringify(moverCheck));
    await shot('m4_6_2_home_furniture_mover_desktop.png');
    const minCheck = await evaluate(`(() => {
      const L = window.__PROJECT_EKO_LIFE__;
      const hud = document.getElementById('home-interior-hud-bar');
      const fullH = hud.getBoundingClientRect().height;
      L.toggleHomePlannerDrawer();
      const drawerCollapsedH = hud.getBoundingClientRect().height;
      const actionsHiddenWhenDrawerClosed = getComputedStyle(document.getElementById('home-hud-furniture-actions')).display === 'none';
      L.toggleHomePlannerDrawer();
      L.toggleHomeHudMinimized(true);
      const minH = hud.getBoundingClientRect().height;
      const moverHidden = getComputedStyle(document.getElementById('home-hud-selected-mover-bar')).display === 'none';
      const actionsHidden = getComputedStyle(document.getElementById('home-hud-furniture-actions')).display === 'none';
      const quickInlineVisible = getComputedStyle(document.getElementById('home-hud-minimized-quick-mover')).display !== 'none';
      return { fullH: Math.round(fullH), drawerCollapsedH: Math.round(drawerCollapsedH), minH: Math.round(minH), actionsHiddenWhenDrawerClosed, moverHidden, actionsHidden, quickInlineVisible };
    })()`);
    check('Home HUD panel minimizes to a compact pill & Objects drawer collapses in Planner Mode', minCheck.minH <= 76 && minCheck.minH < minCheck.fullH * 0.35 && minCheck.actionsHiddenWhenDrawerClosed && minCheck.moverHidden && minCheck.actionsHidden && minCheck.quickInlineVisible, JSON.stringify(minCheck));
    await shot('m4_6_2_home_planner_minimized_desktop.png');
    await evaluate(`window.__PROJECT_EKO_LIFE__.toggleHomeHudMinimized(false);`);
    await key('c');
    await sleep(600);
    const back = await state();
    const afterBack = await evaluate(`JSON.stringify({ f: window.__PROJECT_EKO_LIFE__.placedFurniture, p: [playerAvatar.position.x.toFixed(3), playerAvatar.position.z.toFixed(3)] })`);
    check('[C] returns to Exploration with identical furniture & character state', back.camMode === 'exploration' && afterBack === before, `mode=${back.mode}`);
    check('Planner camera performance measured', planner.drawCalls > 0, `fps=${planner.fps}, frame=${planner.frameTimeMs}ms, calls=${planner.drawCalls}, tris=${planner.triangles}`);

    // -------------------------------------------------------------------------
    // 4. FUNCTIONAL HOUSEHOLD OBJECT VIA REAL [E] KEY
    // -------------------------------------------------------------------------
    await evaluate(`(() => { const fan = window.__PROJECT_EKO_LIFE__.placedFurniture.find(p => p.itemId === 'itm_standing_fan'); playerAvatar.position.set(-62 + fan.x - 0.9, 0.22, -152 + fan.z - 0.6); })()`);
    await sleep(250);
    const fanBefore = await evaluate(`({ on: Boolean(window.__PROJECT_EKO_LIFE__.homeApplianceState && window.__PROJECT_EKO_LIFE__.homeApplianceState.fanOn), comfort: window.__PROJECT_EKO_LIFE__.needsState.comfort, prompt: document.getElementById('home-hud-nearby-object').textContent })`);
    await key('e');
    await sleep(400);
    const fanAfter = await evaluate(`({ on: Boolean(window.__PROJECT_EKO_LIFE__.homeApplianceState && window.__PROJECT_EKO_LIFE__.homeApplianceState.fanOn), comfort: window.__PROJECT_EKO_LIFE__.needsState.comfort })`);
    check('[E] near the standing fan toggles real appliance state', fanAfter.on !== fanBefore.on, `fan ${fanBefore.on ? 'ON' : 'OFF'} → ${fanAfter.on ? 'ON' : 'OFF'}, comfort ${Math.round(fanBefore.comfort)} → ${Math.round(fanAfter.comfort)}; prompt="${fanBefore.prompt.slice(0, 70)}"`);
    await key('e', 40); // immediate repeat must be suppressed by the object cooldown (no double toggle)
    await sleep(300);
    const fanRepeat = await evaluate(`Boolean(window.__PROJECT_EKO_LIFE__.homeApplianceState && window.__PROJECT_EKO_LIFE__.homeApplianceState.fanOn)`);
    results.input.fanRepeatSuppressed = fanRepeat === fanAfter.on;

    // -------------------------------------------------------------------------
    // 4b. WEARING CLOTHES ON 3D AVATAR & ALL 19 ITEMS RESPONSIVENESS
    // -------------------------------------------------------------------------
    const wearsAndItemsAudit = await evaluate(`(() => {
      const L = window.__PROJECT_EKO_LIFE__;
      const savedPlaced = JSON.parse(JSON.stringify(L.placedFurniture));
      const savedOwned = JSON.parse(JSON.stringify(L.ownedItems));
      const savedFit = L.currentOutfitId;

      // Ensure Aso-Ebi & Work Shirt are owned and placed in the 3D home
      ['itm_ceremonial_asoebi', 'itm_everyday_shirt'].forEach((itemId, idx) => {
        let own = L.ownedItems.find(o => o.itemId === itemId);
        if (!own) {
          own = { instanceId: 'own_test_' + itemId, itemId, condition: 100, placed: false };
          L.ownedItems.push(own);
        }
        const tx = idx === 0 ? -1.4 : -0.4;
        const tz = idx === 0 ? -0.4 : 1.1;
        L.placeOwnedItemIn3DHome(own.instanceId, tx, tz, 0.25, 'storage_zone');
      });

      // Reset cooldowns so we can test all 19 canonical items sequentially
      L.lastHomeObjectUseAt = {};
      L.homePantryServings = 5;
      L.needsState.energy = 85;

      // 1. Test wearing Smart Everyday Lagos Work Shirt
      const shirtRes = L.walkToAndUseHomeObject('itm_everyday_shirt');
      const afterShirtFit = L.currentOutfitId;
      const afterShirtVisualId = playerAvatar.currentVisualOutfitId;
      const hasSpineAfterShirt = Boolean(playerAvatar.outfitSpineMesh);

      // 2. Test cycling outfit via Wardrobe Rack
      L.lastHomeObjectUseAt = {};
      const wardRes = L.walkToAndUseHomeObject('itm_wardrobe_rack');
      const afterWardrobeFit = L.currentOutfitId;
      const wardrobeDoorOpen = Boolean(L.homeApplianceState.wardrobeOpen);

      // 3. Test wearing Tailored Owambe Aso-Ebi & Fila Set (puts on Royal Gold Agbada + Fila Cap!)
      L.lastHomeObjectUseAt = {};
      const asoRes = L.walkToAndUseHomeObject('itm_ceremonial_asoebi');
      const afterAsoFit = L.currentOutfitId;
      const afterAsoVisualId = playerAvatar.currentVisualOutfitId;
      const hasSpineAgbada = Boolean(playerAvatar.outfitSpineMesh && playerAvatar.outfitSpineMesh.geometry.attributes.position.count > 20);
      const hasHeadFila = Boolean(playerAvatar.outfitHeadMesh && playerAvatar.outfitHeadMesh.geometry.attributes.position.count > 20);

      // 4. Verify all 19 canonical items respond cleanly (either as placed 3D objects or consumables)
      const all19Results = [];
      L.itemDefinitions.forEach(def => {
        L.lastHomeObjectUseAt = {};
        L.homePantryServings = Math.max(3, L.homePantryServings);
        L.needsState.energy = Math.max(50, L.needsState.energy);
        if (!def.consumable && !L.placedFurniture.some(p => p.itemId === def.itemId)) {
          L.placedFurniture.push({
            placementId: 'plc_temp_' + def.itemId,
            instanceId: 'own_temp_' + def.itemId,
            itemId: def.itemId,
            name: def.name,
            roomZone: def.zone || 'living_social_zone',
            x: 0, y: 0, z: 0.4, rotY: 0,
            w: def.size ? def.size.w : 0.8,
            d: def.size ? def.size.d : 0.8,
            h: def.size ? def.size.h : 0.8,
            hex: def.hex || 0x10B981
          });
        }
        const r = L.useHomeObject(def.itemId);
        all19Results.push({ itemId: def.itemId, ok: Boolean(r && r.success) });
      });

      // Keep Aso-Ebi placed & worn for the visual proof screenshot, then restore after screenshot
      L.placedFurniture = savedPlaced;
      L.ownedItems = savedOwned;
      const asoOwn = { instanceId: 'own_shot_asoebi', itemId: 'itm_ceremonial_asoebi', condition: 100, placed: true };
      L.ownedItems.push(asoOwn);
      L.placeOwnedItemIn3DHome(asoOwn.instanceId, -1.2, -0.3, 0.3, 'storage_zone');
      L.lastHomeObjectUseAt = {};
      L.walkToAndUseHomeObject('itm_ceremonial_asoebi');

      return {
        shirtOk: shirtRes.success && afterShirtFit === 'outfit_corporate_suit' && afterShirtVisualId === 'outfit_corporate_suit' && hasSpineAfterShirt,
        wardrobeOk: wardRes.success && wardrobeDoorOpen && Boolean(afterWardrobeFit),
        asoebiOk: asoRes.success && afterAsoFit === 'outfit_owambe_agbada' && afterAsoVisualId === 'outfit_owambe_agbada' && hasSpineAgbada && hasHeadFila,
        all19Count: all19Results.length,
        all19Passed: all19Results.every(x => x.ok),
        subBoxCount: L.lastHomeInteriorSubBoxCount
      };
    })()`);
    check('Wearing clothes (Aso-Ebi, Work Shirt, Wardrobe) visibly dresses the 3D avatar (Agbada tunic + Fila cap meshes & vertex colors) and all 19 items respond', wearsAndItemsAudit.shirtOk && wearsAndItemsAudit.wardrobeOk && wearsAndItemsAudit.asoebiOk && wearsAndItemsAudit.all19Count === 19 && wearsAndItemsAudit.all19Passed, JSON.stringify(wearsAndItemsAudit));
    await sleep(350);
    await shot('m4_6_3_home_wears_and_items_desktop.png');
    await evaluate(`(() => {
      const L = window.__PROJECT_EKO_LIFE__;
      L.placedFurniture = L.placedFurniture.filter(p => p.instanceId !== 'own_shot_asoebi');
      L.ownedItems = L.ownedItems.filter(o => o.instanceId !== 'own_shot_asoebi');
      L.rebuild3DHomeInteriorMesh();
      L.saveMasterBibleStateToStorage();
    })()`);

    // -------------------------------------------------------------------------
    // 5. NAMEPLATE OCCLUSION (interior boundary, doorway, exterior walls, distance)
    // -------------------------------------------------------------------------
    async function placePeerAndRead(px, pz) {
      return evaluate(`(() => {
        const peer = multiplayerPeers[0];
        peer.mesh.position.set(${px}, 0.22, ${pz});
        peer.mesh.visible = true;
        EkoVisibility.cache.clear();
        return new Promise(r => setTimeout(() => {
          const el = document.getElementById('badge-' + peer.id);
          r({ id: peer.id, name: peer.name, display: el ? el.style.display : 'missing', reason: el ? el.dataset.visibilityReason : null });
        }, 260));
      })()`);
    }
    const savedPeer = await evaluate(`(() => { const p = multiplayerPeers[0].mesh.position; return { x: p.x, y: p.y, z: p.z }; })()`);
    // 5a. Inside home facing the west wall, peer outside behind it (in frustum, 14m away)
    await evaluate(`playerAvatar.position.set(-61.2, 0.22, -151.2); playerHeading = -Math.PI / 2; playerAvatar.rotation.y = playerHeading; cameraOrbitYaw = 0;`);
    await sleep(500);
    const occWest = await placePeerAndRead(-75, -151.5);
    check('Exterior player nameplate is hidden behind the solid interior wall', occWest.display === 'none' && occWest.reason === 'INTERIOR_BOUNDARY_OCCLUDED', `peer=${occWest.name}, reason=${occWest.reason}`);
    results.occlusion.insideWestWall = occWest;
    await shot('m4_6_1_occlusion_inside_home_no_labels.png');
    // 5b. Inside home looking out through the open front doorway → legitimately visible
    await evaluate(`playerAvatar.position.set(-62, 0.22, -152.6); playerHeading = 0; playerAvatar.rotation.y = 0; cameraOrbitYaw = 0;`);
    await sleep(600);
    const occDoor = await placePeerAndRead(-62, -139);
    check('Nameplate stays visible when seen through the open doorway', occDoor.display === 'flex' && occDoor.reason === 'VISIBLE_THROUGH_DOORWAY', `reason=${occDoor.reason}`);
    results.occlusion.throughDoorway = occDoor;
    await shot('m4_6_1_occlusion_through_doorway.png');
    // 5c. Exit (real [H]) and verify exterior porch spawn + camera outside the shell
    await key('h');
    await sleep(500);
    s = await state();
    check('[H] inside exits to just outside the real entrance; camera never inside the shell', !s.inside && Math.abs(s.px + 62) < 0.6 && s.pz > -147.4 && s.pz < -144.5 && s.cz > -147.76, `avatar=(${s.px.toFixed(2)}, ${s.pz.toFixed(2)}), camZ=${s.cz.toFixed(2)}`);
    // 5d. Street: house between camera and peer → occluded by the residence shell collider
    await evaluate(`playerAvatar.position.set(-62, 0.22, -143.5); playerHeading = Math.PI; playerAvatar.rotation.y = playerHeading; cameraOrbitYaw = 0;`);
    await sleep(900);
    const occHouse = await placePeerAndRead(-62, -162);
    check('Street nameplate behind the house is hidden by wall occlusion', occHouse.display === 'none' && occHouse.reason === 'WALL_OCCLUDED', `reason=${occHouse.reason}`);
    const occClear = await placePeerAndRead(-60.0, -146.6);
    check('Nearby visible player nameplate remains discoverable', occClear.display === 'flex' && occClear.reason === 'VISIBLE', `reason=${occClear.reason}`);
    const occFar = await placePeerAndRead(-62, -95);
    check('Distant nameplate culled by distance budget', occFar.display === 'none' && occFar.reason === 'OUT_OF_RANGE', `reason=${occFar.reason}`);
    results.occlusion.street = { behindHouse: occHouse, clear: occClear, far: occFar };
    console.log('   frames/s after street occlusion:', await frameRate());
    await evaluate(`multiplayerPeers[0].mesh.position.set(${savedPeer.x}, ${savedPeer.y}, ${savedPeer.z}); EkoVisibility.cache.clear();`);

    // -------------------------------------------------------------------------
    // 6. INTERACTABLE NPC NAMEPLATE + REAL [E] TALK
    // -------------------------------------------------------------------------
    const npcTarget = await evaluate(`(() => { const n = lagosNPCs.find(n => n.userData && n.userData.name === 'Mama Nkechi') || lagosNPCs.find(n => n.userData && !n.userData.isPeer && !n.userData.isWalking); return { name: n.userData.name, x: n.position.x, z: n.position.z }; })()`);
    await evaluate(`playerAvatar.position.set(${npcTarget.x}, 0.22, ${npcTarget.z + 2.6}); playerHeading = Math.PI; playerAvatar.rotation.y = Math.PI; cameraOrbitYaw = 0;`);
    await sleep(900);
    const plate = await evaluate(`(() => { const el = document.getElementById('npc-nameplate'); return { display: el.style.display, text: el.textContent, reason: el.dataset.visibilityReason }; })()`);
    check('Nearest interactable NPC shows an occlusion-aware nameplate', plate.display === 'block' && plate.text.includes(npcTarget.name), `"${plate.text}" (${plate.reason})`);
    await shot('m4_6_1_npc_nameplate_desktop.png');
    await key('e');
    await sleep(400);
    const dlgOpen = await evaluate(`document.getElementById('npc-dialogue-modal').style.display === 'block'`);
    check('[E] opens dialogue with the visible nearby NPC', dlgOpen, npcTarget.name);
    console.log('   frames/s after dialogue open:', await frameRate());
    await key('Escape');
    await sleep(300);
    console.log('   frames/s after Escape:', await frameRate());
    console.log('   page errors:', JSON.stringify(await evaluate(`(window.__m461errs || []).slice(-5)`)));

    // -------------------------------------------------------------------------
    // 6b. COMPLETE 6-STAGE START-TO-FINISH PLAYABILITY FLOW
    // -------------------------------------------------------------------------
    const flowReport = await evaluate(`(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const startSpec = resetPlayableJourneyFromStart();
      const stage1StartOk = startSpec && startSpec.id === 'obj_stage1_home' && window.__PROJECT_EKO_OBJECTIVE__.guidedIndex === 0;

      // Stage 1: Enter 3D Home -> Use Wears -> Exit 3D Home -> Auto-Advances to Stage 2
      const act1a = triggerActiveObjectiveAction(); // ENTER_3D_HOME
      await wait(120);
      const act1b = triggerActiveObjectiveAction(); // USE_HOME_WEARS
      await wait(120);
      const act1c = triggerActiveObjectiveAction(); // EXIT_3D_HOME
      await wait(120);
      const afterStage1Idx = window.__PROJECT_EKO_OBJECTIVE__.guidedIndex;

      // Stage 2: Walk to Onikan 3D Shop Counter (-66.5, -144.0) & press [E] -> Buy & Place -> Auto-Advances to Stage 3
      playerAvatar.position.set(-66.5, 0.22, -143.2);
      const shopInteractRes = handleInteractKey(true);
      const counterHudOpen = document.getElementById('m6-shop-counter-hud')?.style.display === 'block';
      const act2b = triggerActiveObjectiveAction(); // BUY_AND_PLACE_SHOP_ITEM
      const afterStage2Idx = window.__PROJECT_EKO_OBJECTIVE__.guidedIndex;

      // Stage 3: Start Street Job -> Minimize/Expand Job HUD -> Complete 3 Checkpoints -> Auto-Advances to Stage 4
      const balBeforeJob = player.balance;
      const act3Start = triggerActiveObjectiveAction(); // START_JOB_SHIFT
      const jobOverrideActive = resolveActiveObjectiveSpec().mode === 'active_job_shift';
      const minJobRes = window.__PROJECT_EKO_LIFE__.toggleJobShiftHudMinimized(true);
      const jobBodyHidden = document.getElementById('jobshub-hud-body')?.style.display === 'none';
      window.__PROJECT_EKO_LIFE__.toggleJobShiftHudMinimized(false);
      triggerActiveObjectiveAction(); // Step 1/3
      triggerActiveObjectiveAction(); // Step 2/3
      const act3Finish = triggerActiveObjectiveAction(); // Step 3/3 -> COMPLETE_JOB_SHIFT
      const balAfterJob = player.balance;
      const afterStage3Idx = window.__PROJECT_EKO_OBJECTIVE__.guidedIndex;

      // Stage 4: Mount Sedan -> Arrive Sister Blessing Pickup -> Verify W key auto-dismisses greeting -> Complete TBS Dropoff -> Stage 5
      const act4Mount = triggerActiveObjectiveAction(); // MOUNT_SEDAN
      const act4Pickup = triggerActiveObjectiveAction(); // ARRIVE_SISTER_BLESSING_PICKUP
      await wait(120); // Let animate() board Sister Blessing at (-96, -120)
      const boardedOk = passengerState === 'onboard';
      // Press W key while passenger greeting modal is open -> must auto-close dialogue and set keys.w = true
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
      const wDismissedGreeting = document.getElementById('npc-dialogue-modal')?.style.display === 'none' && Boolean(keys.w);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
      const act4Dropoff = triggerActiveObjectiveAction(); // COMPLETE_SISTER_BLESSING_DROPOFF
      dismissCelebrationModal();
      const phone = document.getElementById('eko-phone-container');
      if (phone) phone.classList.remove('active');
      const afterStage4Idx = window.__PROJECT_EKO_OBJECTIVE__.guidedIndex;

      // Stage 5: Load Balogun Wholesale Cargo & Deliver to Haruna Suya Spot -> Auto-Advances to Stage 6
      const balBeforeCargo = player.balance;
      const act5Load = triggerActiveObjectiveAction(); // LOAD_BALOGUN_CARGO
      const act5Deliver = triggerActiveObjectiveAction(); // DELIVER_SUYA_CARGO
      const balAfterCargo = player.balance;
      const afterStage5Idx = window.__PROJECT_EKO_OBJECTIVE__.guidedIndex;

      // Return to on-foot street posture & restore playerCar curb slot for clean screenshot & subsequent checks
      if (isDriving) toggleVehicleMount();
      if (typeof playerCar !== 'undefined' && playerCar) {
        playerCar.position.set(-89.8, 0.05, -202);
        playerCar.rotation.set(0, 0, 0);
      }
      playerHasCargo = false;
      updateObjectiveTrackerHUD();

      return {
        stage1StartOk,
        act1a, act1b, act1c,
        afterStage1Idx,
        shopInteractRes,
        counterHudOpen,
        act2b,
        afterStage2Idx,
        act3Start,
        jobOverrideActive,
        jobBodyHidden,
        act3Finish,
        jobEarnedGN: balAfterJob - balBeforeJob,
        afterStage3Idx,
        act4Mount,
        act4Pickup,
        boardedOk,
        wDismissedGreeting,
        act4Dropoff,
        afterStage4Idx,
        act5Load,
        act5Deliver,
        cargoEarnedGN: balAfterCargo - balBeforeCargo,
        afterStage5Idx,
        milestones: { ...window.__PROJECT_EKO_OBJECTIVE__.journeyMilestones }
      };
    })()`);
    check(
      '6-Stage Start-to-Finish Playable Journey executes end-to-end (Home & Wears -> 3D Shop -> 3-Step Street Job -> Sister Blessing Drive -> Cargo Delivery -> Stage 6)',
      flowReport.stage1StartOk &&
      flowReport.afterStage1Idx === 1 &&
      flowReport.shopInteractRes === 'OPEN_SHOP_COUNTER_3D' &&
      flowReport.counterHudOpen &&
      flowReport.afterStage2Idx === 2 &&
      flowReport.jobOverrideActive &&
      flowReport.jobBodyHidden &&
      flowReport.jobEarnedGN > 0 &&
      flowReport.afterStage3Idx === 3 &&
      flowReport.boardedOk &&
      flowReport.wDismissedGreeting &&
      flowReport.afterStage4Idx === 4 &&
      flowReport.cargoEarnedGN >= 1800 &&
      flowReport.afterStage5Idx === 5,
      `stages=${flowReport.afterStage1Idx}->${flowReport.afterStage2Idx}->${flowReport.afterStage3Idx}->${flowReport.afterStage4Idx}->${flowReport.afterStage5Idx}, job=+₦${flowReport.jobEarnedGN}, cargo=+₦${flowReport.cargoEarnedGN}, wDismiss=${flowReport.wDismissedGreeting}`
    );
    results.completePlayableFlow = flowReport;
    await shot('m4_6_4_complete_playable_flow_desktop.png');

    // -------------------------------------------------------------------------
    // 7. ATLAS & DESKTOP PERFORMANCE
    // -------------------------------------------------------------------------
    await evaluate(`toggleCityOverviewCamera(true)`);
    await sleep(600);
    console.log('   frames/s in aerial view:', await frameRate());
    const atlasPerf = await measure('ekoatlas_aerial_desktop_1440x900');
    const atlasMode = await evaluate(`({ mode: window.__PROJECT_EKO_HUD_MODE__.mode, overview: isCityOverviewMode, hist: window.__PROJECT_EKO_HUD_MODE__.history.slice(-4).map(h => h.from + '>' + h.to).join(',') })`);
    check('EkoAtlas aerial view sets HUD mode "atlas"', atlasMode.mode === 'atlas', `overview=${atlasMode.overview}, hist=${atlasMode.hist}, fps=${atlasPerf.fps}, frame=${atlasPerf.frameTimeMs}ms, calls=${atlasPerf.drawCalls}, tris=${atlasPerf.triangles}`);
    await evaluate(`toggleCityOverviewCamera(false)`);
    await sleep(500);
    await evaluate(`openEkoAtlasModal('map')`);
    await sleep(500);
    const atlasModalPerf = await measure('ekoatlas_modal_desktop_1440x900');
    results.perf.ekoatlas_modal_desktop_1440x900 = atlasModalPerf;
    await evaluate(`closeEkoAtlasModal()`);
    await sleep(400);
    check('Closing EkoAtlas restores the street interface', (await state()).mode !== 'atlas');

    // -------------------------------------------------------------------------
    // 8. MOBILE PORTRAIT 390x844 WITH REAL MULTI-TOUCH
    // -------------------------------------------------------------------------
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await setViewport(390, 844, true);
    await sleep(500);
    await evaluate(`playerAvatar.position.set(-84, 0.22, -150); playerHeading = Math.PI; playerAvatar.rotation.y = Math.PI; cameraOrbitYaw = 0; if (isFrontViewMode) toggleFrontViewCamera(false);`);
    await sleep(400);
    // 8a. Joystick forward + simultaneous Interact tap (multi-touch)
    const joy = await rectOf('touch-joystick-zone');
    const interactR = await rectOf('btn-touch-foot-interact');
    await touchStart([{ x: joy.x, y: joy.y - joy.h * 0.4, id: 1 }]);
    await sleep(200);
    const joyState1 = await state();
    await touchStart([{ x: joy.x, y: joy.y - joy.h * 0.4, id: 1 }, { x: interactR.x, y: interactR.y, id: 2 }]);
    await sleep(160);
    const joyState2 = await state(); // both fingers down
    // Lift ONLY the second finger (CDP: a touchMove that omits a point releases that point)
    await touchMove([{ x: joy.x, y: joy.y - joy.h * 0.42, id: 1 }]);
    await sleep(200);
    const joyState2b = await state();
    results.input.multiTouch = { joystickOnly: joyState1.keys, bothDown: joyState2.keys, afterSecondLift: joyState2b.keys, joyAfterSecondLift: joyState2b.joy };
    await touchEnd([]);
    await sleep(250);
    const joyState3 = await state();
    check('Touch becomes the active input device from real touch events', joyState1.device === 'touch', `device=${joyState1.device}`);
    check('Joystick keeps driving movement while Interact is pressed with a second finger', joyState1.keys.w && joyState2.joy && joyState2.keys.w && joyState2b.joy && joyState2b.keys.w, `w(joystick)=${joyState1.keys.w}, w(+interact finger)=${joyState2.keys.w}, w(after lifting interact finger)=${joyState2b.keys.w}`);
    check('Touch release clears movement (no stuck input)', !joyState3.joy && !joyState3.keys.w && !joyState3.keys.a && !joyState3.keys.d);

    // 8b. Left/right direction in follow camera and mirrored front view
    let h0 = (await state()).heading;
    await holdTouch('btn-touch-turn-left', 500);
    let h1 = (await state()).heading;
    await holdTouch('btn-touch-turn-right', 500);
    let h2 = (await state()).heading;
    const dl = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
    const dr = Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1));
    check('LEFT turns the avatar left and RIGHT turns it right (follow camera)', dl > 0.3 && dr < -0.3, `ΔLEFT=${dl.toFixed(2)}rad, ΔRIGHT=${dr.toFixed(2)}rad`);
    await tap('btn-touch-foot-cam');
    const fv = await state();
    h0 = fv.heading;
    await holdTouch('btn-touch-turn-left', 500);
    h1 = (await state()).heading;
    const dlFront = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
    // Front view: joystick up still walks along the avatar's facing (toward the camera), never backwards
    const p0 = await state();
    await touchStart([{ x: joy.x, y: joy.y - joy.h * 0.4, id: 3 }]);
    await sleep(600);
    await touchEnd([]);
    await sleep(200);
    const p1 = await state();
    const moveDot = (p1.px - p0.px) * Math.sin(p0.heading) + (p1.pz - p0.pz) * Math.cos(p0.heading);
    check('Front-view mode mirrors screen-left/right and does not invert forward movement', fv.front && dlFront < -0.3 && moveDot > 0.3, `front=${fv.front}, ΔLEFT(front)=${dlFront.toFixed(2)}rad (screen-left), forwardAdvance=${moveDot.toFixed(2)}m`);
    await tap('btn-touch-foot-cam');
    check('CAM toggles front view off again', !(await state()).front);

    // 8c. Browser focus loss while holding the joystick
    await touchStart([{ x: joy.x, y: joy.y - joy.h * 0.4, id: 4 }]);
    await sleep(150);
    await evaluate(`window.dispatchEvent(new Event('blur'))`);
    await sleep(120);
    const blurState = await state();
    await touchEnd([]);
    check('Window blur cancels held touch movement', !blurState.joy && !blurState.keys.w);

    // 8d. Street portrait HUD + prompts on touch
    await evaluate(`playerAvatar.position.set(-62, 0.22, -146.2); playerHeading = Math.PI; playerAvatar.rotation.y = Math.PI;`);
    await sleep(700);
    const porchTouch = await evaluate(`({ cue: document.getElementById('interaction-cue').textContent, label: document.getElementById('touch-foot-interact-label').textContent, mode: window.__PROJECT_EKO_HUD_MODE__.mode, gaugeHidden: getComputedStyle(document.querySelector('.hud-bottom-bar')).display === 'none' })`);
    check('Touch prompt at the residence uses on-screen controls (no keyboard keys)', /TAP INTERACT TO ENTER/i.test(porchTouch.cue) && !/\[[A-Z]\]/.test(porchTouch.cue), porchTouch.cue);
    check('Primary touch button shows the contextual verb', /ENTER/.test(porchTouch.label), porchTouch.label);
    check('On-foot portrait hides the speedometer/vehicle strip', porchTouch.gaugeHidden && porchTouch.mode === 'interact', `mode=${porchTouch.mode}`);
    results.input.streetTouchOffenders = await evaluate(`window.__PROJECT_EKO_INPUT_PROMPTS__.auditVisibleKeyboardHints()`);
    check('No visible keyboard-only instructions on the touch street HUD', results.input.streetTouchOffenders.length === 0, JSON.stringify(results.input.streetTouchOffenders.slice(0, 3)));
    await shot('m4_6_1_mobile_portrait_street_porch.png');
    const streetPortrait = await measure('street_mobile_portrait_390x844');

    // 8e. Tap Interact to enter the home
    await tap('btn-touch-foot-interact');
    await sleep(600);
    s = await state();
    const homeTouch = await evaluate(`(() => {
      const vis = id => { const el = document.getElementById(id); if (!el) return false; const st = getComputedStyle(el); return st.display !== 'none' && el.getBoundingClientRect().width > 0; };
      const r = id => { const el = document.getElementById(id); return el ? el.getBoundingClientRect() : null; };
      const hud = r('home-interior-hud-bar'), L = r('touch-cluster-onfoot-left'), R = r('touch-cluster-onfoot-right');
      const ov = (a, b) => (a && b) ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
      const btns = ['btn-touch-foot-interact', 'btn-touch-foot-run', 'btn-touch-foot-cam', 'btn-touch-foot-exit-home', 'btn-touch-turn-left', 'btn-touch-turn-right'].map(id => { const b = r(id); return { id, w: Math.round(b.width), h: Math.round(b.height) }; });
      return {
        exitVisible: vis('btn-touch-foot-exit-home'), driveHidden: !vis('touch-cluster-drive-left') && !vis('touch-cluster-drive-right'),
        hudOverlapPx: Math.round(ov(hud, L) + ov(hud, R)), hudTop: Math.round(hud.top), viewportH: innerHeight,
        promptText: document.getElementById('home-hud-nearby-object').textContent,
        camLabel: document.getElementById('touch-foot-cam-label').textContent,
        btns, offenders: window.__PROJECT_EKO_INPUT_PROMPTS__.auditVisibleKeyboardHints()
      };
    })()`);
    results.viewports.phone_portrait_390x844 = homeTouch;
    check('Tap Interact at the porch enters the home on touch', s.inside && s.mode === 'home');
    check('Home touch layout: Exit Home + PLAN shown, driving controls hidden', homeTouch.exitVisible && homeTouch.driveHidden && /PLAN/.test(homeTouch.camLabel), `cam="${homeTouch.camLabel}"`);
    check('Home HUD no longer overlaps the touch controls (portrait)', homeTouch.hudOverlapPx === 0, `overlap=${homeTouch.hudOverlapPx}px², hudTop=${homeTouch.hudTop}/${homeTouch.viewportH}`);
    check('Touch targets meet a 40px minimum', homeTouch.btns.every(b => b.h >= 40 && b.w >= 40), homeTouch.btns.map(b => `${b.id.replace('btn-touch-', '')}:${b.w}x${b.h}`).join(' '));
    check('No keyboard-only instructions visible inside the home on touch', homeTouch.offenders.length === 0, homeTouch.offenders.length ? JSON.stringify(homeTouch.offenders.slice(0, 3)) : `prompt="${homeTouch.promptText.slice(0, 80)}"`);
    await shot('m4_6_1_mobile_portrait_home_exploration.png');
    const homePortrait = await measure('home_exploration_mobile_portrait_390x844');

    // 8f. Walk to the stove with the joystick-free contextual path and tap Interact (functional object)
    await evaluate(`(() => { const st = window.__PROJECT_EKO_LIFE__.placedFurniture.find(p => p.itemId === 'itm_table_stove'); playerAvatar.position.set(-62 + st.x - 1.0, 0.22, -152 + st.z + 0.2); playerHeading = Math.PI / 2; playerAvatar.rotation.y = playerHeading; window.__PROJECT_EKO_LIFE__.homePantryServings = Math.max(2, window.__PROJECT_EKO_LIFE__.homePantryServings); })()`);
    await sleep(500);
    const cookBefore = await evaluate(`({ pantry: window.__PROJECT_EKO_LIFE__.homePantryServings, hunger: window.__PROJECT_EKO_LIFE__.needsState.hunger, label: document.getElementById('touch-foot-interact-label').textContent, prompt: document.getElementById('home-hud-nearby-object').textContent })`);
    await tap('btn-touch-foot-interact');
    await sleep(400);
    const cookAfter = await evaluate(`({ pantry: window.__PROJECT_EKO_LIFE__.homePantryServings, hunger: window.__PROJECT_EKO_LIFE__.needsState.hunger })`);
    check('Tap Interact at the stove cooks a meal (pantry -1)', cookAfter.pantry === cookBefore.pantry - 1, `label="${cookBefore.label}", pantry ${cookBefore.pantry} → ${cookAfter.pantry}; prompt="${cookBefore.prompt.slice(0, 70)}"`);
    await tap('btn-touch-foot-interact');
    await sleep(300);
    const cookRepeat = await evaluate(`window.__PROJECT_EKO_LIFE__.homePantryServings`);
    results.input.touchDoubleTapCookSuppressed = cookRepeat === cookAfter.pantry;
    check('A second rapid tap does not perform the interaction twice', cookRepeat === cookAfter.pantry, `pantry after 2nd tap=${cookRepeat}`);

    // 8g. PLAN / WALK touch toggle
    await tap('btn-touch-foot-cam');
    await sleep(600);
    const planTouch = await state();
    const planOverlap = await evaluate(`(() => { const r = id => document.getElementById(id).getBoundingClientRect(); const hud = r('home-interior-hud-bar'), R = r('touch-cluster-onfoot-right'), L = r('touch-cluster-onfoot-left'); const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); return Math.round(ov(hud, R) + ov(hud, L)); })()`);
    check('Tap PLAN enters Planner Mode on touch', planTouch.camMode === 'planner' && planTouch.mode === 'planner', `overlap=${planOverlap}px²`);
    await shot('m4_6_1_mobile_portrait_home_planner.png');
    const plannerPortrait = await measure('home_planner_mobile_portrait_390x844');
    await tap('btn-touch-foot-cam');
    await sleep(500);
    check('Tap WALK returns to Exploration on touch', (await state()).camMode === 'exploration');

    // 8h. Tap EXIT HOME
    await tap('btn-touch-foot-exit-home');
    await sleep(600);
    s = await state();
    check('Tap Exit Home leaves the home and restores the street interface', !s.inside && (s.mode === 'street' || s.mode === 'interact'), `mode=${s.mode}`);

    // 8i. Walking → driving → walking with no input inversion
    await evaluate(`playerAvatar.position.set(playerCar.position.x + 2.2, 0.22, playerCar.position.z); playerHeading = -Math.PI / 2; playerAvatar.rotation.y = playerHeading;`);
    await sleep(500);
    await tap('btn-touch-foot-interact');
    await sleep(800);
    s = await state();
    const driveUI = await evaluate(`({ left: getComputedStyle(document.getElementById('touch-cluster-drive-left')).display, right: getComputedStyle(document.getElementById('touch-cluster-drive-right')).display, foot: getComputedStyle(document.getElementById('touch-cluster-onfoot-left')).display })`);
    check('Tap Interact beside the sedan enters driving mode with driving controls exposed', s.driving && s.mode === 'driving' && driveUI.left !== 'none' && driveUI.right !== 'none' && driveUI.foot === 'none', JSON.stringify(driveUI));
    const gasR = await rectOf('btn-touch-drive-gas');
    const steerR = await rectOf('btn-touch-steer-left');
    await touchStart([{ x: gasR.x, y: gasR.y, id: 5 }]);
    await sleep(120);
    await touchStart([{ x: gasR.x, y: gasR.y, id: 5 }, { x: steerR.x, y: steerR.y, id: 6 }]);
    await sleep(200);
    const driveKeys = await state();
    await touchEnd([]);
    await sleep(200);
    const driveReleased = await state();
    check('GAS + STEER LEFT work simultaneously and release cleanly', driveKeys.keys.w && driveKeys.keys.a && !driveKeys.keys.d && !driveReleased.keys.w && !driveReleased.keys.a, `held=${JSON.stringify(driveKeys.keys)}`);
    await shot('m4_6_1_mobile_portrait_driving.png');
    await evaluate(`currentSpeedKmh = 0;`);
    await tap('btn-touch-drive-interact');
    await sleep(800);
    s = await state();
    h0 = s.heading;
    await holdTouch('btn-touch-turn-left', 450);
    h1 = (await state()).heading;
    const dlAfterDrive = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
    check('After driving, on-foot LEFT still turns left (no inversion across modes)', !s.driving && dlAfterDrive > 0.25, `ΔLEFT=${dlAfterDrive.toFixed(2)}rad`);

    // 8j. EkoAtlas via the Tools drawer on touch: walking/driving controls hidden, restored on close
    await tap('btn-mobile-drawer-toggle');
    await sleep(300);
    await tap('drawer-btn-ekoatlas');
    await sleep(600);
    const atlasTouch = await evaluate(`({ mode: window.__PROJECT_EKO_HUD_MODE__.mode, touchDeck: getComputedStyle(document.getElementById('mobile-touch-controls')).display })`);
    check('Opening EkoAtlas on touch hides walking & driving controls', atlasTouch.mode === 'atlas' && atlasTouch.touchDeck === 'none', JSON.stringify(atlasTouch));
    await shot('m4_6_1_mobile_portrait_atlas.png');
    const atlasPortrait = await measure('ekoatlas_modal_mobile_portrait_390x844');
    await evaluate(`closeEkoAtlasModal()`);
    await sleep(400);
    const afterAtlas = await evaluate(`({ mode: window.__PROJECT_EKO_HUD_MODE__.mode, touchDeck: getComputedStyle(document.getElementById('mobile-touch-controls')).display })`);
    check('Closing EkoAtlas restores the previous on-foot touch interface', afterAtlas.mode !== 'atlas' && afterAtlas.touchDeck !== 'none', JSON.stringify(afterAtlas));

    // 8k. Danfo Hustle state
    await evaluate(`switchGameMode('danfo_hustle')`);
    await sleep(900);
    const hustleMode = await evaluate(`window.__PROJECT_EKO_HUD_MODE__.mode`);
    await evaluate(`switchGameMode('free')`);
    await sleep(900);
    const afterHustle = await evaluate(`window.__PROJECT_EKO_HUD_MODE__.mode`);
    check('Danfo Hustle has its own HUD state and exiting restores Living Lagos', hustleMode === 'hustle' && afterHustle !== 'hustle', `${hustleMode} → ${afterHustle}`);
    results.hudHistory = await evaluate(`window.__PROJECT_EKO_HUD_MODE__.history.map(h => (h.from || 'boot') + '→' + h.to)`);

    // -------------------------------------------------------------------------
    // 9. LANDSCAPE PHONE 844x390 (home + driving) & TABLET 768x1024
    // -------------------------------------------------------------------------
    async function viewportHomeAudit(w, h, label) {
      await setViewport(w, h, true);
      await sleep(400);
      await evaluate(`if (isDriving) { currentSpeedKmh = 0; toggleVehicleMount(); }`);
      await sleep(300);
      await evaluate(`window.__PROJECT_EKO_LIFE__.enterHomeInterior();`);
      await sleep(700);
      const a = await evaluate(`(() => {
        const r = id => document.getElementById(id).getBoundingClientRect();
        const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const hud = r('home-interior-hud-bar');
        return { overlapPx: Math.round(ov(hud, r('touch-cluster-onfoot-left')) + ov(hud, r('touch-cluster-onfoot-right'))), hudInViewport: hud.left >= -1 && hud.right <= innerWidth + 1 && hud.bottom <= innerHeight + 1 && hud.top >= 0, offenders: window.__PROJECT_EKO_INPUT_PROMPTS__.auditVisibleKeyboardHints().length, mode: window.__PROJECT_EKO_HUD_MODE__.mode };
      })()`);
      results.viewports[label] = a;
      check(`${label}: home HUD fits the viewport, no overlap with touch controls, no keyboard hints`, a.overlapPx === 0 && a.hudInViewport && a.offenders === 0 && a.mode === 'home', JSON.stringify(a));
      await shot(`m4_6_1_${label}_home.png`);
      results.perf[`home_exploration_${label}`] = await measure(`home_exploration_${label}`);
      await evaluate(`window.__PROJECT_EKO_LIFE__.exitHomeInterior();`);
      await sleep(400);
    }
    await viewportHomeAudit(844, 390, 'phone_landscape_844x390');
    // Landscape driving
    await evaluate(`playerAvatar.position.set(playerCar.position.x + 2.2, 0.22, playerCar.position.z);`);
    await sleep(300);
    await tap('btn-touch-foot-interact');
    await sleep(700);
    const lsDrive = await evaluate(`(() => { const r = id => document.getElementById(id).getBoundingClientRect(); const a = r('touch-cluster-drive-left'), b = r('touch-cluster-drive-right'), g = document.querySelector('.hud-bottom-bar').getBoundingClientRect(); const ov = (x, y) => Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)); return { driving: isDriving, overlapPx: Math.round(ov(a, b) + ov(a, g) + ov(b, g)), mode: window.__PROJECT_EKO_HUD_MODE__.mode }; })()`);
    check('Landscape driving: steering, pedals & gauge strip do not overlap', lsDrive.driving && lsDrive.overlapPx === 0 && lsDrive.mode === 'driving', JSON.stringify(lsDrive));
    await shot('m4_6_1_phone_landscape_844x390_driving.png');
    results.perf.driving_landscape_844x390 = await measure('driving_landscape_844x390');
    await viewportHomeAudit(768, 1024, 'tablet_768x1024');

    // -------------------------------------------------------------------------
    // 10. KEYBOARD ↔ TOUCH PROMPT SWITCHING ON DESKTOP
    // -------------------------------------------------------------------------
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await setViewport(1440, 900, false);
    await evaluate(`if (isDriving) { currentSpeedKmh = 0; toggleVehicleMount(); }`);
    await sleep(300);
    await key('w', 30);
    await evaluate(`playerAvatar.position.set(-62, 0.22, -146.2); playerHeading = Math.PI; playerAvatar.rotation.y = Math.PI;`);
    await sleep(600);
    const kbCue = await evaluate(`({ device: window.__PROJECT_EKO_INPUT_PROMPTS__.device, cue: document.getElementById('interaction-cue').textContent })`);
    check('Keyboard users see the real key names again after switching back from touch', kbCue.device === 'keyboard' && /PRESS \[E\] OR \[H\]/.test(kbCue.cue), kbCue.cue);
    results.input.promptDiagnostics = await evaluate(`window.__PROJECT_EKO_INPUT_PROMPTS__.getDiagnostics()`);

    // -------------------------------------------------------------------------
    // 11. RELOAD PERSISTENCE OF HOME & FURNITURE STATE
    // -------------------------------------------------------------------------
    await evaluate(`(() => { const L = window.__PROJECT_EKO_LIFE__; const desk = L.placedFurniture.find(p => p.itemId === 'itm_study_desk'); L.rotatePlacedFurniture(desk.instanceId); L.saveMasterBibleStateToStorage(); })()`);
    await sleep(300);
    const persistBefore = await evaluate(`(() => { const L = window.__PROJECT_EKO_LIFE__; return { furniture: JSON.stringify(L.placedFurniture.map(p => [p.itemId, p.x, p.z, Number((p.rotY || 0).toFixed(4))])), pantry: L.homePantryServings, fan: Boolean(L.homeApplianceState && L.homeApplianceState.fanOn), residence: L.currentResidenceId, owned: (L.ownedItems || []).length, balance: player.balance }; })()`);
    await send('Page.reload', { ignoreCache: false });
    await sleep(1500);
    await waitBoot();
    await sleep(1500);
    const persistAfter = await evaluate(`(() => { const L = window.__PROJECT_EKO_LIFE__; return { furniture: JSON.stringify(L.placedFurniture.map(p => [p.itemId, p.x, p.z, Number((p.rotY || 0).toFixed(4))])), pantry: L.homePantryServings, fan: Boolean(L.homeApplianceState && L.homeApplianceState.fanOn), residence: L.currentResidenceId, owned: (L.ownedItems || []).length, balance: player.balance }; })()`);
    results.persistence = { before: persistBefore, after: persistAfter };
    check('Home, furniture positions/rotations, pantry, fan & residence persist across reload', persistAfter.furniture === persistBefore.furniture && persistAfter.pantry === persistBefore.pantry && persistAfter.fan === persistBefore.fan && persistAfter.residence === persistBefore.residence, `pantry=${persistAfter.pantry}, fan=${persistAfter.fan}, residence=${persistAfter.residence}, furnitureMatch=${persistAfter.furniture === persistBefore.furniture}`);
    check('Ownership & Game Naira persist across reload', persistAfter.owned === persistBefore.owned && persistAfter.balance === persistBefore.balance, `owned=${persistAfter.owned}, balance=${persistAfter.balance}`);
    await evaluate(`window.__PROJECT_EKO_LIFE__.enterHomeInterior();`);
    await sleep(900);
    await shot('m4_6_1_home_after_reload.png');
    await evaluate(`window.__PROJECT_EKO_LIFE__.exitHomeInterior();`);

    results.visibilityDiagnostics = await evaluate(`window.__PROJECT_EKO_VISIBILITY__.getDiagnostics().stats`);
    results.summary = { passed: results.checks.filter(c => c.passed).length, failed: failures };
  } catch (err) {
    failures++;
    results.fatal = String(err && err.stack || err);
    console.error('FATAL:', err);
  } finally {
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'm4_6_1_acceptance_results.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(__dirname, '..', 'ANTIGRAVITY', 'DELIVERY', 'm4_6_1_acceptance_results.json'), JSON.stringify(results, null, 2));
    console.log('\n====================================================');
    console.log(`M4.6.1 ACCEPTANCE: ${results.checks.filter(c => c.passed).length} PASSED | ${failures} FAILED`);
    console.log('====================================================');
    try { if (client) client.ws.close(); } catch (_) {}
    try { chromeProc.kill('SIGKILL'); } catch (_) {}
    process.exit(failures === 0 ? 0 : 1);
  }
}

main();
