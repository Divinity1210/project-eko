#!/usr/bin/env node
/**
 * PROJECT EKO — M3.1 ATLAS POLISH & PERFORMANCE GATE VERIFICATION
 * Independently verifies & profiles:
 *  1. Visual composition & lowered elevated rail / coastal esplanade / East Estate relocation
 *  2. Zoom-dependent label visibility (LOW, MEDIUM, HIGH), clustering & 0-overlap AABB solver
 *  3. 100% canonical entity resolution, contextual details card (#aerial-entity-card) & street navigation continuity
 *  4. Mobile-first responsive layouts (Phone Portrait 390x844, Phone Landscape 844x390, Tablet 768x1024, Desktop 1440x900)
 *  5. Sponsored advertising visual differentiation & EkoMedia provenance
 *  6. Independent performance profiling of EkoAtlas, Living Lagos, and Danfo Hustle (Draw calls <= 75, 60 FPS target)
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

async function main() {
  const debugPort = 9345;
  const userDataDir = path.join('/tmp', `eko_chrome_m3_1_${Date.now()}`);
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

  let client;
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
        break;
      } catch (_) {
        await sleep(250);
      }
    }

    client = await createCDPClient(debugPort);
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // Wait for game boot
    for (let i = 0; i < 40; i++) {
      const booted = await client.evaluate(`Boolean(window.__PROJECT_EKO_ATLAS__ && window.__PROJECT_EKO_LIFE__ && window.__PROJECT_EKO_PERF__)`);
      if (booted) break;
      await sleep(250);
    }
    await sleep(900);

    const results = {
      timestamp: new Date().toISOString(),
      checks: [],
      modeProfiles: {},
      viewportTests: {},
      zoomTierTests: {},
      screenshots: []
    };

    function assertCheck(name, condition, details = '') {
      results.checks.push({ name, passed: Boolean(condition), details });
      const icon = condition ? '✅ PASS' : '❌ FAIL';
      console.log(`${icon}: ${name}${details ? ` (${details})` : ''}`);
      if (!condition) {
        throw new Error(`Verification failed: ${name} (${details})`);
      }
    }

    // =========================================================================
    // 1. PROFILE LIVING LAGOS (STREET-LEVEL GAMEPLAY) AT DESKTOP 1440x900
    // =========================================================================
    await client.setViewport(1440, 900, false);
    await client.evaluate(`
      toggleCityOverviewCamera(false);
      if (window.__PROJECT_EKO_PERF_MANAGER__) {
        window.__PROJECT_EKO_PERF_MANAGER__.frameTimesMs = [];
        window.__PROJECT_EKO_PERF_MANAGER__.warmupFramesRemaining = 2;
      }
    `);
    await sleep(1100);
    const livingLagosPerf = await client.evaluate(`({
      perf: window.__PROJECT_EKO_PERF__,
      realism: window.__PROJECT_EKO_REALISM__.getDiagnostics(),
      aerialCardHidden: !document.getElementById('aerial-entity-card').classList.contains('open'),
      topPillHidden: !document.getElementById('city-overview-top-pill').classList.contains('active')
    })`);
    results.modeProfiles.livingLagos_1440x900 = livingLagosPerf.perf;
    const streetShot = await client.screenshot('m3_1_after_living_lagos_street.png');
    results.screenshots.push(streetShot);

    assertCheck(
      'Living Lagos Street Mode Draw-Call Budget & Telemetry',
      livingLagosPerf.perf.drawCalls <= 75 && livingLagosPerf.perf.triangles <= 35000 && livingLagosPerf.perf.gatePassed,
      `calls=${livingLagosPerf.perf.drawCalls}, tris=${livingLagosPerf.perf.triangles}, fps=${livingLagosPerf.perf.fps}, frameTimeMs=${livingLagosPerf.perf.frameTimeMs}ms`
    );
    assertCheck(
      'Atlas-specific UI hidden in Street-Level Gameplay',
      livingLagosPerf.aerialCardHidden && livingLagosPerf.topPillHidden,
      `aerialCardHidden=${livingLagosPerf.aerialCardHidden}, topPillHidden=${livingLagosPerf.topPillHidden}`
    );

    // =========================================================================
    // 2. PROFILE EKOATLAS 3D AERIAL CITY OVERVIEW ACROSS ZOOM TIERS (LOW, MED, HIGH)
    // =========================================================================
    await client.evaluate(`
      toggleCityOverviewCamera(true);
      if (typeof dismissToast === 'function') dismissToast();
    `);
    await sleep(700);

    for (const tier of ['LOW', 'MEDIUM', 'HIGH']) {
      await client.evaluate(`
        window.__PROJECT_EKO_LIFE__.closeAerialEntityCard();
        window.__PROJECT_EKO_LIFE__.setAerialZoomPreset('${tier}');
        if (typeof dismissToast === 'function') dismissToast();
        if (window.__PROJECT_EKO_PERF_MANAGER__) {
          window.__PROJECT_EKO_PERF_MANAGER__.frameTimesMs = [];
          window.__PROJECT_EKO_PERF_MANAGER__.warmupFramesRemaining = 2;
        }
      `);
      await sleep(900);

      const tierDiag = await client.evaluate(`(() => {
        const life = window.__PROJECT_EKO_LIFE__.getDiagnostics();
        const perf = window.__PROJECT_EKO_PERF__;
        const visibleEls = Array.from(document.querySelectorAll('#city-overview-pins-layer .city-overview-pin'))
          .filter(el => el.style.display !== 'none');
        const rects = visibleEls.map(el => {
          const r = el.getBoundingClientRect();
          return { id: el.id || el.className, l: r.left, r: r.right, t: r.top, b: r.bottom };
        });
        let domOverlaps = 0;
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const b = rects[j];
            const overlapW = Math.min(a.r, b.r) - Math.max(a.l, b.l);
            const overlapH = Math.min(a.b, b.b) - Math.max(a.t, b.t);
            if (overlapW > 2 && overlapH > 2) domOverlaps++;
          }
        }
        const drivingControlsHidden = ['vehicle-switcher-bar', 'gauge-cluster', 'minimap-container', 'mobile-touch-controls']
          .every(id => {
            const el = document.getElementById(id);
            return !el || window.getComputedStyle(el).display === 'none';
          });
        return {
          tier: life.aerialZoomTier,
          cameraOrbitDist: life.cameraOrbitDist,
          visiblePinIds: life.visibleAerialPinIds,
          clusterCount: life.aerialClusterCount,
          solverOverlapCount: life.aerialOverlapCount,
          domOverlaps,
          allPinsCanonical: life.allPinsResolveToCanonicalEntities,
          drivingControlsHidden,
          perf
        };
      })()`);

      results.zoomTierTests[tier] = tierDiag;
      const shotName = tier === 'LOW'
        ? 'm3_1_after_aerial_low_zoom.png'
        : (tier === 'MEDIUM' ? 'm3_1_after_aerial_med_zoom.png' : 'm3_1_after_aerial_high_zoom.png');
      const shotPath = await client.screenshot(shotName);
      results.screenshots.push(shotPath);

      assertCheck(
        `Aerial Zoom Tier [${tier}] Zero Marker-Label Overlap & Draw-Call Budget`,
        tierDiag.tier === tier && tierDiag.solverOverlapCount === 0 && tierDiag.domOverlaps === 0 && tierDiag.perf.drawCalls <= 75,
        `visiblePins=${tierDiag.visiblePinIds.length}, clusters=${tierDiag.clusterCount}, overlaps=${tierDiag.domOverlaps}, calls=${tierDiag.perf.drawCalls}, fps=${tierDiag.perf.fps}`
      );
    }

    results.modeProfiles.ekoAtlasAerial_1440x900 = results.zoomTierTests.MEDIUM.perf;

    // Verify zoom-dependent progression: HIGH zoom reveals more individual pins than LOW zoom
    assertCheck(
      'Zoom-Dependent Label Visibility & Clustering Progression (LOW -> MEDIUM -> HIGH)',
      results.zoomTierTests.LOW.visiblePinIds.length <= results.zoomTierTests.MEDIUM.visiblePinIds.length &&
      results.zoomTierTests.MEDIUM.visiblePinIds.length < results.zoomTierTests.HIGH.visiblePinIds.length &&
      results.zoomTierTests.LOW.clusterCount >= 1,
      `LOW=${results.zoomTierTests.LOW.visiblePinIds.length} pins (${results.zoomTierTests.LOW.clusterCount} clusters), MED=${results.zoomTierTests.MEDIUM.visiblePinIds.length} pins, HIGH=${results.zoomTierTests.HIGH.visiblePinIds.length} pins`
    );

    assertCheck(
      '100% Canonical Entity Resolution & Driving Controls Hidden in Aerial View',
      results.zoomTierTests.HIGH.allPinsCanonical && results.zoomTierTests.HIGH.drivingControlsHidden,
      `allPinsCanonical=${results.zoomTierTests.HIGH.allPinsCanonical}, drivingControlsHidden=${results.zoomTierTests.HIGH.drivingControlsHidden}`
    );

    // =========================================================================
    // 3. INTERACTION: CONTEXTUAL DETAILS CARD (#aerial-entity-card) & STREET NAVIGATION
    // =========================================================================
    await client.evaluate(`
      window.__PROJECT_EKO_LIFE__.setAerialZoomPreset('MEDIUM');
      window.__PROJECT_EKO_LIFE__.selectAerialMarker('pin_balogun');
      if (typeof dismissToast === 'function') dismissToast();
    `);
    await sleep(450);

    const cardDiag = await client.evaluate(`(() => {
      const card = document.getElementById('aerial-entity-card');
      const isOpen = card && card.classList.contains('open');
      const text = card ? card.innerText : '';
      const hasInspect = Boolean(document.getElementById('btn-aerial-card-inspect'));
      const hasNavigate = Boolean(document.getElementById('btn-aerial-card-navigate'));
      const hasVisit = Boolean(document.getElementById('btn-aerial-card-visit'));
      return { isOpen, text, hasInspect, hasNavigate, hasVisit };
    })()`);
    const cardShot = await client.screenshot('m3_1_after_entity_card_selected.png');
    results.screenshots.push(cardShot);

    assertCheck(
      'Selected Place Opens Compact Contextual Details Card with Inspect, Navigate & Visit Actions',
      cardDiag.isOpen &&
      cardDiag.text.includes('Balogun Wholesale Market') &&
      cardDiag.text.includes('ent_balogun_wholesale_market') &&
      cardDiag.hasInspect &&
      cardDiag.hasNavigate &&
      cardDiag.hasVisit,
      `entity=ent_balogun_wholesale_market, actions=[Inspect, Navigate, Visit]`
    );

    // Test Navigation from Aerial Card -> Street-Level Game Continuity
    const navCont = await client.evaluate(`(() => {
      window.__PROJECT_EKO_LIFE__.navigateFromAerialCard('ent_balogun_wholesale_market');
      const atlasDiag = window.__PROJECT_EKO_ATLAS__.getDiagnostics();
      const lifeDiag = window.__PROJECT_EKO_LIFE__.getDiagnostics();
      return {
        returnedToStreetView: !lifeDiag.isCityOverviewMode,
        activeNavTargetId: atlasDiag.activeNavigationTargetId,
        gpsTargetKey: typeof gpsTargetKey !== 'undefined' ? gpsTargetKey : null,
        routeDestId: atlasDiag.activeRoute ? atlasDiag.activeRoute.destinationEntityId : null,
        routeDistM: atlasDiag.activeRoute ? atlasDiag.activeRoute.distanceMeters : 0
      };
    })()`);

    assertCheck(
      'Aerial-to-Street Navigation Transitions to Exact Same Canonical World Entity',
      navCont.returnedToStreetView &&
      navCont.activeNavTargetId === 'ent_balogun_wholesale_market' &&
      navCont.gpsTargetKey === 'ent_balogun_wholesale_market' &&
      navCont.routeDestId === 'ent_balogun_wholesale_market' &&
      navCont.routeDistM > 0,
      `target=${navCont.activeNavTargetId}, dist=${navCont.routeDistM}m, streetView=${navCont.returnedToStreetView}`
    );

    // =========================================================================
    // 4. MULTI-VIEWPORT MOBILE-FIRST LAYOUT & OVERLAP VERIFICATION
    // =========================================================================
    const viewports = [
      { key: 'phone_portrait_390x844', w: 390, h: 844, mobile: true, shot: 'm3_1_after_mobile_portrait_390x844.png' },
      { key: 'phone_landscape_844x390', w: 844, h: 390, mobile: true, shot: 'm3_1_after_mobile_landscape_844x390.png' },
      { key: 'tablet_768x1024', w: 768, h: 1024, mobile: true, shot: 'm3_1_after_tablet_768x1024.png' }
    ];

    for (const vp of viewports) {
      await client.setViewport(vp.w, vp.h, vp.mobile);
      await client.evaluate(`
        toggleCityOverviewCamera(true);
        window.__PROJECT_EKO_LIFE__.setAerialZoomPreset('MEDIUM');
        window.__PROJECT_EKO_LIFE__.selectAerialMarker('pin_cms');
        if (typeof dismissToast === 'function') dismissToast();
        if (window.__PROJECT_EKO_PERF_MANAGER__) {
          window.__PROJECT_EKO_PERF_MANAGER__.frameTimesMs = [];
          window.__PROJECT_EKO_PERF_MANAGER__.warmupFramesRemaining = 2;
        }
      `);
      await sleep(850);

      const vpDiag = await client.evaluate(`(() => {
        const life = window.__PROJECT_EKO_LIFE__.getDiagnostics();
        const perf = window.__PROJECT_EKO_PERF__;
        const topPill = document.getElementById('city-overview-top-pill').getBoundingClientRect();
        const card = document.getElementById('aerial-entity-card').getBoundingClientRect();
        const withinViewport = topPill.left >= 0 && topPill.right <= window.innerWidth &&
                               card.left >= 0 && card.right <= window.innerWidth && card.bottom <= window.innerHeight;
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          qualityPreset: perf.qualityPreset,
          drawCalls: perf.drawCalls,
          triangles: perf.triangles,
          fps: perf.fps,
          frameTimeMs: perf.frameTimeMs,
          p95FrameTimeMs: perf.p95FrameTimeMs,
          visiblePins: life.visibleAerialPinIds.length,
          overlaps: life.aerialOverlapCount,
          withinViewport
        };
      })()`);

      results.viewportTests[vp.key] = vpDiag;
      const vpShot = await client.screenshot(vp.shot);
      results.screenshots.push(vpShot);

      assertCheck(
        `Responsive Mobile/Tablet Viewport [${vp.key}] Layout & Zero Overlap`,
        vpDiag.withinViewport && vpDiag.overlaps === 0 && vpDiag.drawCalls <= 75,
        `preset=${vpDiag.qualityPreset}, calls=${vpDiag.drawCalls}, fps=${vpDiag.fps}, overlaps=${vpDiag.overlaps}`
      );
    }

    // =========================================================================
    // 5. PROFILE DANFO HUSTLE MODE INDEPENDENTLY (1440x900)
    // =========================================================================
    await client.setViewport(1440, 900, false);
    await client.evaluate(`
      toggleCityOverviewCamera(false);
      window.__PROJECT_EKO_DANFO_HUSTLE__.startRun('route_cms_tbs_express');
      if (typeof dismissToast === 'function') dismissToast();
      if (window.__PROJECT_EKO_PERF_MANAGER__) {
        window.__PROJECT_EKO_PERF_MANAGER__.frameTimesMs = [];
        window.__PROJECT_EKO_PERF_MANAGER__.warmupFramesRemaining = 2;
      }
    `);
    await sleep(1100);

    const danfoHustleDiag = await client.evaluate(`({
      perf: window.__PROJECT_EKO_PERF__,
      dh: window.__PROJECT_EKO_DANFO_HUSTLE__.getDiagnostics()
    })`);
    results.modeProfiles.danfoHustle_1440x900 = danfoHustleDiag.perf;
    const dhShot = await client.screenshot('m3_1_after_danfo_hustle_mode.png');
    results.screenshots.push(dhShot);

    await client.evaluate(`window.__PROJECT_EKO_DANFO_HUSTLE__.exitToLivingLagos();`);

    assertCheck(
      'Danfo Hustle Mode Independent Performance & Draw-Call Budget',
      danfoHustleDiag.dh.isActive && danfoHustleDiag.perf.drawCalls <= 75 && danfoHustleDiag.perf.triangles <= 35000,
      `calls=${danfoHustleDiag.perf.drawCalls}, tris=${danfoHustleDiag.perf.triangles}, fps=${danfoHustleDiag.perf.fps}, frameTimeMs=${danfoHustleDiag.perf.frameTimeMs}ms`
    );

    // =========================================================================
    // 6. SPONSORED ADVERTISING VISUAL DIFFERENTIATION & EKOATLAS 2.5D MODAL
    // =========================================================================
    await client.evaluate(`
      toggleCityOverviewCamera(true);
      window.__PROJECT_EKO_LIFE__.setAerialZoomPreset('HIGH');
      window.__PROJECT_EKO_LIFE__.selectAerialMarker('pin_ad_broad');
      if (typeof dismissToast === 'function') dismissToast();
    `);
    await sleep(500);
    const sponsoredDiag = await client.evaluate(`(() => {
      const cardText = document.getElementById('aerial-entity-card').innerText;
      const pinEl = document.getElementById('pin_ad_broad');
      const hasSponsoredClass = pinEl && pinEl.classList.contains('cat-sponsored');
      return {
        hasSponsoredClass,
        hasSponsoredBadge: cardText.includes('SPONSORED • VIRTUAL AD'),
        hasOperatorProvenance: cardText.includes('EkoMedia Outdoor Network')
      };
    })()`);
    const adShot = await client.screenshot('m3_1_after_sponsored_ad_card.png');
    results.screenshots.push(adShot);

    assertCheck(
      'Sponsored Advertisements Visually Distinct from Organic Landmarks & Businesses',
      sponsoredDiag.hasSponsoredClass && sponsoredDiag.hasSponsoredBadge && sponsoredDiag.hasOperatorProvenance,
      `catSponsored=${sponsoredDiag.hasSponsoredClass}, badge=${sponsoredDiag.hasSponsoredBadge}, provenance=${sponsoredDiag.hasOperatorProvenance}`
    );

    // Profile EkoAtlas 2.5D Modal open
    await client.evaluate(`
      window.__PROJECT_EKO_LIFE__.inspectFromAerialCard('ent_broad_digital_led_board_02');
      if (window.__PROJECT_EKO_PERF_MANAGER__) {
        window.__PROJECT_EKO_PERF_MANAGER__.frameTimesMs = [];
        window.__PROJECT_EKO_PERF_MANAGER__.warmupFramesRemaining = 2;
      }
    `);
    await sleep(950);
    const atlasModalDiag = await client.evaluate(`({
      perf: window.__PROJECT_EKO_PERF__,
      atlas: window.__PROJECT_EKO_ATLAS__.getDiagnostics()
    })`);
    results.modeProfiles.ekoAtlasModal_1440x900 = atlasModalDiag.perf;
    const atlasModalShot = await client.screenshot('m3_1_after_ekoatlas_modal.png');
    results.screenshots.push(atlasModalShot);

    assertCheck(
      'EkoAtlas 2.5D Directory Modal Independent Performance & Telemetry',
      atlasModalDiag.atlas.isOpen && atlasModalDiag.perf.drawCalls <= 75 && atlasModalDiag.perf.fps >= 30,
      `calls=${atlasModalDiag.perf.drawCalls}, tris=${atlasModalDiag.perf.triangles}, fps=${atlasModalDiag.perf.fps}, frameTimeMs=${atlasModalDiag.perf.frameTimeMs}ms`
    );

    // =========================================================================
    // 7. M4 EKOLIFE HOME SLICE: 3D CUTAWAY HOME INTERIOR, MULTI-PART FURNITURE & WALK-UP HUD
    // =========================================================================
    await client.evaluate(`
      if (typeof closeEkoAtlasModal === 'function') closeEkoAtlasModal();
      window.__PROJECT_EKO_LIFE__.enterHomeInterior();
      const buySofa = window.__PROJECT_EKO_LIFE__.buyShopItem('itm_lounge_sofa');
      if (buySofa && buySofa.instance) {
        window.__PROJECT_EKO_LIFE__.placeOwnedItemIn3DHome(buySofa.instance.instanceId, 0.05, 0.35, 0, 'living_social_zone');
      }
      window.__PROJECT_EKO_LIFE__.walkToAndUseHomeObject('itm_table_stove');
    `);
    await sleep(950);
    const m4InteriorDiag = await client.evaluate(`({
      perf: window.__PROJECT_EKO_PERF__,
      life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
      hudVisible: document.getElementById('home-interior-hud-bar') && document.getElementById('home-interior-hud-bar').style.display === 'block',
      modalClosed: !window.__PROJECT_EKO_LIFE__.isOpen
    })`);
    results.modeProfiles.m4HomeInterior_1440x900 = m4InteriorDiag.perf;
    const m4InteriorShot = await client.screenshot('m4_inside_3d_home_interior.png');
    results.screenshots.push(m4InteriorShot);

    assertCheck(
      'M4 3D Cutaway Home Interior, Multi-Part Furniture & Live Walk-Around HUD',
      m4InteriorDiag.life.isInsideHomeInterior &&
      m4InteriorDiag.modalClosed &&
      m4InteriorDiag.hudVisible &&
      m4InteriorDiag.life.placedFurnitureCount >= 7 &&
      m4InteriorDiag.life.homeInteriorSubBoxCount >= 60 &&
      m4InteriorDiag.perf.drawCalls <= 75,
      `inside=${m4InteriorDiag.life.isInsideHomeInterior}, placed=${m4InteriorDiag.life.placedFurnitureCount}, subBoxes=${m4InteriorDiag.life.homeInteriorSubBoxCount}, hud=${m4InteriorDiag.hudVisible}, calls=${m4InteriorDiag.perf.drawCalls}`
    );

    await client.evaluate(`window.__PROJECT_EKO_LIFE__.exitHomeInterior();`);

    // =========================================================================
    // 8. M5 JOBSHUB ENTRY WORK SLICE: ON-STREET 3D SHIFT, 3D BEACON & LIVE CHECKPOINT HUD
    // =========================================================================
    await client.evaluate(`
      window.__PROJECT_EKO_LIFE__.startActiveJobShift('job_foot_courier');
      window.__PROJECT_EKO_LIFE__.advanceActiveJobCheckpoint();
    `);
    await sleep(950);
    const m5ShiftDiag = await client.evaluate(`({
      perf: window.__PROJECT_EKO_PERF__,
      life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
      shiftHudVisible: document.getElementById('jobshub-active-shift-hud') && document.getElementById('jobshub-active-shift-hud').style.display === 'block',
      beaconVisible: Boolean(window.__PROJECT_EKO_LIFE__.activeJobBeaconGroup && window.__PROJECT_EKO_LIFE__.activeJobBeaconGroup.visible)
    })`);
    results.modeProfiles.m5JobsHubShift_1440x900 = m5ShiftDiag.perf;
    const m5ShiftShot = await client.screenshot('m5_jobshub_street_shift.png');
    results.screenshots.push(m5ShiftShot);

    const m5SettleDiag = await client.evaluate(`window.__PROJECT_EKO_LIFE__.completeActiveJobShiftNow()`);

    assertCheck(
      'M5 JobsHub On-Street 3D Entry Work Shift, 3D Checkpoint Beacon & Live Shift HUD',
      Boolean(m5ShiftDiag.life.activeJobShift) &&
      m5ShiftDiag.life.activeJobShift.currentStepIndex === 1 &&
      m5ShiftDiag.shiftHudVisible &&
      m5ShiftDiag.beaconVisible &&
      m5SettleDiag &&
      m5SettleDiag.shiftCompleted &&
      m5SettleDiag.receipt &&
      m5SettleDiag.receipt.checkpointsCompleted === 3 &&
      m5ShiftDiag.perf.drawCalls <= 75,
      `job=${m5ShiftDiag.life.activeJobShift ? m5ShiftDiag.life.activeJobShift.jobId : 'none'}, step=${m5ShiftDiag.life.activeJobShift ? m5ShiftDiag.life.activeJobShift.currentStepIndex : -1}/3, beacon=${m5ShiftDiag.beaconVisible}, hud=${m5ShiftDiag.shiftHudVisible}, settledGN=${m5SettleDiag && m5SettleDiag.receipt ? m5SettleDiag.receipt.netPayGN : 0}, calls=${m5ShiftDiag.perf.drawCalls}`
    );

    // =========================================================================
    // 9. M6 SHOPS, HOUSEHOLD ECONOMY & FIRST-WEEK LOOP: 3D SHOP COUNTER, BUY-AND-PLACE & RENT/UTILITIES SETTLEMENT
    // =========================================================================
    const m6CounterDiag = await client.evaluate(`(() => {
      const visit = window.__PROJECT_EKO_LIFE__.visitShopCounter3D('shop_furniture_home');
      const buyPlace = window.__PROJECT_EKO_LIFE__.buyAndPlaceFromCounter('itm_afrobeat_painting', false);
      const payOblig = window.__PROJECT_EKO_LIFE__.payHouseholdRentAndUtilities();
      const firstWeek = window.__PROJECT_EKO_LIFE__.simulateFirstWeekAffordability();
      if (typeof dismissToast === 'function') dismissToast();
      return {
        visit,
        buyPlace,
        payOblig,
        firstWeek,
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__,
        counterHudVisible: Boolean(document.getElementById('m6-shop-counter-hud') && document.getElementById('m6-shop-counter-hud').style.display === 'block')
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m6ShopCounter_1440x900 = m6CounterDiag.perf;
    const m6Shot = await client.screenshot('m6_shops_household_economy.png');
    results.screenshots.push(m6Shot);

    await client.evaluate(`window.__PROJECT_EKO_LIFE__.closeShopCounter3D();`);

    assertCheck(
      'M6 3D Shop Counter Storefront, 1-Click Buy & Auto-Place in 3D Home & Household Rent/Utilities Settlement',
      m6CounterDiag.visit &&
      m6CounterDiag.visit.success &&
      m6CounterDiag.counterHudVisible &&
      m6CounterDiag.buyPlace &&
      m6CounterDiag.buyPlace.success &&
      m6CounterDiag.payOblig &&
      m6CounterDiag.payOblig.success &&
      m6CounterDiag.life.householdCyclesPaidCount >= 1 &&
      m6CounterDiag.firstWeek &&
      m6CounterDiag.firstWeek.tuningMetrics.passesNoPaywallSurvivalRule &&
      m6CounterDiag.perf.drawCalls <= 75,
      `shop=${m6CounterDiag.life.activeShopCounterId}, placedInHome=${m6CounterDiag.life.placedFurnitureCount}, cyclesPaid=${m6CounterDiag.life.householdCyclesPaidCount}, ratio=${m6CounterDiag.firstWeek ? m6CounterDiag.firstWeek.tuningMetrics.coreNeedsToIncomeRatio : 'n/a'}, hud=${m6CounterDiag.counterHudVisible}, calls=${m6CounterDiag.perf.drawCalls}`
    );

    // =========================================================================
    // 10. M7 COMMERCIAL TRANSIT & MULTI-CLASS VEHICLE EXPANSION: 9-CLASS 3D FLEET TERMINAL, LASWA LAGOON FERRY & DANFO CONDUCTOR 60/40 CO-OP HUD
    // =========================================================================
    const m7FleetDiag = await client.evaluate(`(() => {
      const visitFerry = window.__PROJECT_EKO_LIFE__.visitFleetTerminal3D('veh_lagoon_ferry');
      const runFerry = window.__PROJECT_EKO_LIFE__.operateExpansionVehicle('veh_lagoon_ferry');
      const runKorope = window.__PROJECT_EKO_LIFE__.operateExpansionVehicle('veh_korope_shuttle');
      const runCoOp = window.__PROJECT_EKO_LIFE__.runDanfoConductorCoOpShift('route_cms_tbs_loop');
      window.__PROJECT_EKO_LIFE__.visitFleetTerminal3D('veh_lagoon_ferry');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        visitFerry,
        runFerry,
        runKorope,
        runCoOp,
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__,
        fleetHudVisible: Boolean(document.getElementById('m7-transit-fleet-hud') && document.getElementById('m7-transit-fleet-hud').style.display === 'block')
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m7FleetTerminal_1440x900 = m7FleetDiag.perf;
    const m7Shot = await client.screenshot('m7_commercial_transit_fleet.png');
    results.screenshots.push(m7Shot);

    await client.evaluate(`window.__PROJECT_EKO_LIFE__.closeFleetTerminal3D();`);

    assertCheck(
      'M7 9-Class 3D Fleet Terminal, LASWA Lagoon Ferry & Danfo Conductor 60/40 Co-Op HUD',
      m7FleetDiag.visitFerry &&
      m7FleetDiag.visitFerry.success &&
      m7FleetDiag.fleetHudVisible &&
      m7FleetDiag.runFerry &&
      m7FleetDiag.runFerry.success &&
      m7FleetDiag.runKorope &&
      m7FleetDiag.runKorope.success &&
      m7FleetDiag.runCoOp &&
      m7FleetDiag.runCoOp.success &&
      m7FleetDiag.life.nineVehicleClassesCount === 9 &&
      m7FleetDiag.life.playableVehicleClassesCount === 9 &&
      m7FleetDiag.life.totalFleetRunsCompleted >= 2 &&
      m7FleetDiag.perf.drawCalls <= 75,
      `terminal=${m7FleetDiag.life.activeFleetTerminalClassId}, playableClasses=${m7FleetDiag.life.playableVehicleClassesCount}/9, fleetRuns=${m7FleetDiag.life.totalFleetRunsCompleted}, coopShareGN=${m7FleetDiag.runCoOp && m7FleetDiag.runCoOp.receipt ? m7FleetDiag.runCoOp.receipt.conductorShareGN : 0}, hud=${m7FleetDiag.fleetHudVisible}, calls=${m7FleetDiag.perf.drawCalls}`
    );

    // =========================================================================
    // 11. M8 SKILLED CAREERS, 9 PLAYER BUSINESSES, 6 SUPPLY CHAINS & LABOUR MARKET 3D DEPOT HUD
    // =========================================================================
    const m8BizDiag = await client.evaluate(`(() => {
      const visitDepot = window.__PROJECT_EKO_LIFE__.visitBusinessDepot3D('biz_logistics_dispatch');
      const runBiz = window.__PROJECT_EKO_LIFE__.operatePlayerBusinessShift('biz_logistics_dispatch');
      const runChain = window.__PROJECT_EKO_LIFE__.executeSupplyChainRun('chain_auto_parts');
      const settleLabour = window.__PROJECT_EKO_LIFE__.advanceLabourMarketOffer('lbr_offer_01');
      const publishCreator = window.__PROJECT_EKO_LIFE__.submitCreatorStudioProject('crt_afrobeat_poster');
      const reconcileOps = window.__PROJECT_EKO_LIFE__.executeOperationsAction('RECONCILE_LEDGER');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        visitDepot,
        runBiz,
        runChain,
        settleLabour,
        publishCreator,
        reconcileOps,
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__,
        bizHudVisible: Boolean(document.getElementById('m8-business-supply-hud') && document.getElementById('m8-business-supply-hud').style.display === 'block')
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m8BusinessDepot_1440x900 = m8BizDiag.perf;
    const m8Shot = await client.screenshot('m8_businesses_supply_chains.png');
    results.screenshots.push(m8Shot);

    await client.evaluate(`window.__PROJECT_EKO_LIFE__.closeBusinessDepot3D();`);

    assertCheck(
      'M8 9 Player Businesses, 3D Business & Supply Depot HUD, 6 Causal Supply Chains & Labour Market',
      m8BizDiag.visitDepot &&
      m8BizDiag.visitDepot.success &&
      m8BizDiag.bizHudVisible &&
      m8BizDiag.runBiz &&
      m8BizDiag.runBiz.success &&
      m8BizDiag.runChain &&
      m8BizDiag.runChain.success &&
      m8BizDiag.settleLabour &&
      m8BizDiag.settleLabour.success &&
      m8BizDiag.publishCreator &&
      m8BizDiag.publishCreator.success &&
      m8BizDiag.reconcileOps &&
      m8BizDiag.reconcileOps.success &&
      m8BizDiag.life.playerBusinessesCount === 9 &&
      m8BizDiag.life.supplyChainsCount === 6 &&
      m8BizDiag.life.totalBusinessShiftsCompleted >= 3 &&
      m8BizDiag.perf.drawCalls <= 75,
      `depot=${m8BizDiag.life.activeBusinessDepotId}, businesses=${m8BizDiag.life.playerBusinessesCount}/9, chains=${m8BizDiag.life.supplyChainsCount}/6, bizShifts=${m8BizDiag.life.totalBusinessShiftsCompleted}, hud=${m8BizDiag.bizHudVisible}, calls=${m8BizDiag.perf.drawCalls}`
    );

    // =========================================================================
    // 12. M9 SOCIAL, CREWS, CULTURAL EVENTS (CHURCH / OWAMBE) & DEEPER HOUSING 3D VENUE HUD
    // =========================================================================
    const m9SocialDiag = await client.evaluate(`(() => {
      const visitVenue = window.__PROJECT_EKO_LIFE__.visitSocialCultureVenue3D('venue_owambe_arena');
      const sprayOk = window.__PROJECT_EKO_LIFE__.sprayNairaAtOwambe(2000);
      const worshipOk = window.__PROJECT_EKO_LIFE__.attendChurchWorship();
      const crewOk = window.__PROJECT_EKO_LIFE__.contributeToCrewSharedGoal();
      const upgTier = window.__PROJECT_EKO_LIFE__.advanceDeeperHousingTier(3);
      const perm = window.__PROJECT_EKO_LIFE__.updateHomeVisitPermission('PUBLIC_OPEN_HOUSE');
      const safety = window.__PROJECT_EKO_LIFE__.submitSafetyReport('M9 Trust & Safety Audit');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        visitVenue,
        sprayOk,
        worshipOk,
        crewOk,
        upgTier,
        perm,
        safety,
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__,
        socialHudVisible: Boolean(document.getElementById('m9-social-culture-hud') && document.getElementById('m9-social-culture-hud').style.display === 'block')
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m9SocialCulture_1440x900 = m9SocialDiag.perf;
    const m9Shot = await client.screenshot('m9_social_culture_housing.png');
    results.screenshots.push(m9Shot);

    await client.evaluate(`window.__PROJECT_EKO_LIFE__.closeSocialCultureVenue3D();`);

    assertCheck(
      'M9 3D Social & Cultural Venues (Church/Owambe), Co-Op Crew Goal, Deeper Housing Tiers & Home Permissions',
      m9SocialDiag.visitVenue &&
      m9SocialDiag.visitVenue.success &&
      m9SocialDiag.socialHudVisible &&
      m9SocialDiag.sprayOk &&
      m9SocialDiag.worshipOk &&
      m9SocialDiag.crewOk &&
      m9SocialDiag.crewOk.success &&
      m9SocialDiag.upgTier &&
      m9SocialDiag.upgTier.success &&
      m9SocialDiag.life.currentHousingTier === 3 &&
      m9SocialDiag.life.socialAndSafetyState.homeVisitPermission === 'PUBLIC_OPEN_HOUSE' &&
      m9SocialDiag.life.socialAndSafetyState.moderationReportsCount >= 1 &&
      m9SocialDiag.perf.drawCalls <= 75,
      `venue=${m9SocialDiag.life.activeSocialVenueId}, housingTier=${m9SocialDiag.life.currentHousingTier}/6, crewGoal=${m9SocialDiag.life.socialAndSafetyState.crewGoalPct}%, perm=${m9SocialDiag.life.socialAndSafetyState.homeVisitPermission}, hud=${m9SocialDiag.socialHudVisible}, calls=${m9SocialDiag.perf.drawCalls}`
    );

    // =========================================================================
    // 13. M10 MULTI-DISTRICT LAGOS EXPANSION: 8-DISTRICT 3D STREAMING HUB, REGIONAL CONTRACT & 18 LAMATA NODES HUD
    // =========================================================================
    const m10DistrictDiag = await client.evaluate(`(() => {
      const visitVI = window.__PROJECT_EKO_LIFE__.visitDistrictHub3D('dist_victoria_island');
      const contractVI = window.__PROJECT_EKO_LIFE__.completeDistrictRegionalContract('dist_victoria_island');
      const boardOshodi = window.__PROJECT_EKO_LIFE__.boardLamataInterchangeNode('node_lamata_oshodi');
      const returnVI = window.__PROJECT_EKO_LIFE__.visitDistrictHub3D('dist_victoria_island');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        visitVI,
        contractVI,
        boardOshodi,
        returnVI,
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__,
        districtHudVisible: Boolean(document.getElementById('m10-district-streaming-hud') && document.getElementById('m10-district-streaming-hud').style.display === 'block')
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m10MultiDistrict_1440x900 = m10DistrictDiag.perf;
    const m10Shot = await client.screenshot('m10_multi_district_lagos.png');
    results.screenshots.push(m10Shot);

    await client.evaluate(`window.__PROJECT_EKO_LIFE__.closeDistrictHub3D();`);

    assertCheck(
      'M10 8-District 3D World Streaming Hub, Regional Contract & 18 LAMATA Multi-Modal Nodes HUD',
      m10DistrictDiag.visitVI &&
      m10DistrictDiag.visitVI.success &&
      m10DistrictDiag.districtHudVisible &&
      m10DistrictDiag.contractVI &&
      m10DistrictDiag.contractVI.success &&
      m10DistrictDiag.boardOshodi &&
      m10DistrictDiag.boardOshodi.success &&
      m10DistrictDiag.life.eightLagosDistrictsCount === 8 &&
      m10DistrictDiag.life.transportReferenceNodesCount === 18 &&
      m10DistrictDiag.life.districtContractsCompletedCount >= 1 &&
      m10DistrictDiag.life.lamataTransfersCompletedCount >= 1 &&
      m10DistrictDiag.perf.drawCalls <= 75,
      `district=${m10DistrictDiag.life.activeDistrictHubHUDId}, districts=${m10DistrictDiag.life.eightLagosDistrictsCount}/8, lamataNodes=${m10DistrictDiag.life.transportReferenceNodesCount}/18, contracts=${m10DistrictDiag.life.districtContractsCompletedCount}, transfers=${m10DistrictDiag.life.lamataTransfersCompletedCount}, hud=${m10DistrictDiag.districtHudVisible}, calls=${m10DistrictDiag.perf.drawCalls}`
    );

    // =========================================================================
    // 14. M11 GATED REAL-REWARD COMPLIANCE ARCHITECTURE, 8 REGULATORY GATES, FAIL-CLOSED PAYOUT REJECTION & MASTER BIBLE AUDIT HUD
    // =========================================================================
    const m11ComplianceDiag = await client.evaluate(`(() => {
      const visitM11 = window.__PROJECT_EKO_LIFE__.visitComplianceOpsCenter3D();
      const rejectPayout = window.__PROJECT_EKO_LIFE__.attemptRealCashWithdrawalTest();
      const verifyKillSwitch = window.__PROJECT_EKO_LIFE__.executeOperationsAction('VERIFY_KILL_SWITCH_LOCKED');
      const reconcileLedger = window.__PROJECT_EKO_LIFE__.executeOperationsAction('RECONCILE_LEDGER');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        visitM11,
        rejectPayout,
        verifyKillSwitch,
        reconcileLedger,
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__,
        complianceHudVisible: Boolean(document.getElementById('m11-compliance-ops-hud') && document.getElementById('m11-compliance-ops-hud').style.display === 'block')
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m11ComplianceOps_1440x900 = m11ComplianceDiag.perf;
    const m11Shot = await client.screenshot('m11_compliance_ops_audit.png');
    results.screenshots.push(m11Shot);

    await client.evaluate(`window.__PROJECT_EKO_LIFE__.closeComplianceOpsCenter3D();`);

    assertCheck(
      'M11 Gated Real-Reward Compliance Architecture (8 Regulatory Gates Locked, Fail-Closed 403 Payout Rejection & Double-Entry Ledger Audit HUD)',
      m11ComplianceDiag.visitM11 &&
      m11ComplianceDiag.visitM11.success &&
      m11ComplianceDiag.complianceHudVisible &&
      m11ComplianceDiag.rejectPayout &&
      m11ComplianceDiag.rejectPayout.allowed === false &&
      m11ComplianceDiag.rejectPayout.rejectedFailClosed === true &&
      m11ComplianceDiag.rejectPayout.statusCode === 403 &&
      m11ComplianceDiag.life.realRewardComplianceState.realCashRewardsEnabled === false &&
      m11ComplianceDiag.life.realRewardComplianceState.realMoneyPropertyPurchaseEnabled === false &&
      m11ComplianceDiag.life.realRewardComplianceState.fiatWithdrawalsEnabled === false &&
      m11ComplianceDiag.life.realRewardComplianceState.eightRegulatoryGates.length === 8 &&
      m11ComplianceDiag.life.operationsConsoleState.ledgerBalanced === true &&
      m11ComplianceDiag.perf.drawCalls <= 75,
      `realCashEnabled=${m11ComplianceDiag.life.realRewardComplianceState.realCashRewardsEnabled}, gates=${m11ComplianceDiag.life.realRewardComplianceState.eightRegulatoryGates.length}/8, rejections=${m11ComplianceDiag.life.realRewardRejectionAuditsCount}, ledgerBalanced=${m11ComplianceDiag.life.operationsConsoleState.ledgerBalanced}, hud=${m11ComplianceDiag.complianceHudVisible}, calls=${m11ComplianceDiag.perf.drawCalls}`
    );

    // =========================================================================
    // CHECK 24: PRACTICABILITY, 5-STATION LAGOS FM RADIO TUNER & VISUAL PRODUCT/CLOTHING IMAGES
    // =========================================================================
    const practicabilityDiag = await client.evaluate(`(() => {
      // 1. Visit 3D Clothing & Tailoring Boutique Counter (renders both clothing items & 4 wearable outfits with <img> lookbook pictures)
      const visitClothing = window.__PROJECT_EKO_LIFE__.visitShopCounter3D('shop_clothing_tailor');
      // 2. Cycle through Lagos FM Radio Stations & open the interactive FM Radio Tuner Popover
      const st1 = window.AudioEngine.cycleStation();
      const st2 = window.AudioEngine.selectStation('stn_wazobia_highlife');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        visitClothing,
        stationsCount: window.AudioEngine.stations.length,
        activeStationId: st2 ? st2.id : null,
        activeStationFreq: st2 ? st2.freq : null,
        radioPlaying: window.AudioEngine.radioPlaying
      };
    })()`);
    await sleep(850);
    const imgDecodeDiag = await client.evaluate(`(() => {
      const counterImages = Array.from(document.querySelectorAll('#m6-counter-items-list img.eko-product-thumb'));
      const tunerCover = document.getElementById('radio-tuner-cover-img');
      const tunerVisible = Boolean(document.getElementById('eko-radio-tuner-popover') && document.getElementById('eko-radio-tuner-popover').style.display === 'block');
      return {
        tunerVisible,
        tunerCoverLoaded: Boolean(tunerCover && tunerCover.complete && tunerCover.naturalWidth > 0),
        counterImageCount: counterImages.length,
        allCounterImagesValid: counterImages.every(img => img.complete && img.naturalWidth > 0)
      };
    })()`);
    Object.assign(practicabilityDiag, imgDecodeDiag);
    const pracShot = await client.screenshot('m11_practicability_radio_and_item_images.png');
    results.screenshots.push(pracShot);

    await client.evaluate(`
      window.AudioEngine.closeRadioTunerPopover();
      window.AudioEngine.toggleRadio();
      window.__PROJECT_EKO_LIFE__.closeShopCounter3D();
    `);

    assertCheck(
      'Practicability Upgrade: 5-Station Lagos FM Radio Tuner & Illustrated Product/Clothing/Furniture Images (<img>)',
      practicabilityDiag.visitClothing &&
      practicabilityDiag.visitClothing.success &&
      practicabilityDiag.stationsCount === 5 &&
      practicabilityDiag.activeStationId === 'stn_wazobia_highlife' &&
      practicabilityDiag.radioPlaying === true &&
      practicabilityDiag.tunerVisible === true &&
      practicabilityDiag.tunerCoverLoaded === true &&
      practicabilityDiag.counterImageCount >= 6 &&
      practicabilityDiag.allCounterImagesValid === true,
      `stations=${practicabilityDiag.stationsCount}, activeStation=${practicabilityDiag.activeStationFreq} (${practicabilityDiag.activeStationId}), tunerVisible=${practicabilityDiag.tunerVisible}, counterImages=${practicabilityDiag.counterImageCount}, validImages=${practicabilityDiag.allCounterImagesValid}`
    );

    // =========================================================================
    // CHECK 25: M4.6 EXTERIOR FRONT ENTRANCE DOOR & SPATIAL CONTINUITY
    // =========================================================================
    const extDoorDiag = await client.evaluate(`(() => {
      const sp = window.__PROJECT_EKO_LIFE__.spawnOutsideStarterHome();
      if (typeof dismissToast === 'function') dismissToast();
      return {
        sp,
        perf: window.__PROJECT_EKO_PERF__
      };
    })()`);
    await sleep(750);
    const extDoorShot = await client.screenshot('m4_6_home_exterior_entrance.png');
    results.screenshots.push(extDoorShot);

    assertCheck(
      'M4.6 Starter Home Exterior Front Entrance Door & Ground-Level Spatial Alignment',
      extDoorDiag.sp &&
      extDoorDiag.sp.success &&
      extDoorDiag.sp.avatarPos.y === 0.22 &&
      Math.abs(extDoorDiag.sp.avatarPos.x - (-62)) < 0.01,
      `avatarPos=(${extDoorDiag.sp.avatarPos.x}, ${extDoorDiag.sp.avatarPos.y}, ${extDoorDiag.sp.avatarPos.z}), doorPos=(${extDoorDiag.sp.doorPos.x}, ${extDoorDiag.sp.doorPos.z})`
    );

    // =========================================================================
    // CHECK 26: M4.6 HOME EXPLORATION MODE (DEFAULT HUMAN-SCALE 3RD-PERSON CAMERA & CLEAN HOME HUD)
    // =========================================================================
    const expModeDiag = await client.evaluate(`(() => {
      const enter = window.__PROJECT_EKO_LIFE__.enterHomeInterior('exploration');
      window.__PROJECT_EKO_LIFE__.walkToAndUseHomeObject('itm_table_stove');
      if (typeof dismissToast === 'function') dismissToast();
      const bodyHasHomeClass = document.body.classList.contains('inside-home-interior-mode');
      const drivingControlsHidden = ['vehicle-switcher-bar', 'gauge-cluster', 'minimap-container']
        .every(id => {
          const el = document.getElementById(id);
          return !el || window.getComputedStyle(el).display === 'none';
        });
      const promptEl = document.getElementById('home-hud-nearby-object');
      return {
        enter,
        bodyHasHomeClass,
        drivingControlsHidden,
        promptText: promptEl ? promptEl.innerText : '',
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m4_6_homeExploration_1440x900 = expModeDiag.perf;
    const expShot = await client.screenshot('m4_6_home_exploration_mode.png');
    results.screenshots.push(expShot);

    assertCheck(
      'M4.6 Home Exploration Mode (Default Human-Scale 3rd-Person Camera, Grounded y=0.22m, Driving HUD Hidden & Contextual Prompt)',
      expModeDiag.enter &&
      expModeDiag.enter.success &&
      expModeDiag.enter.homeCameraMode === 'exploration' &&
      expModeDiag.enter.avatarY === 0.22 &&
      expModeDiag.enter.subBoxCount >= 100 &&
      expModeDiag.bodyHasHomeClass &&
      expModeDiag.drivingControlsHidden &&
      expModeDiag.promptText.length > 10 &&
      expModeDiag.perf.drawCalls <= 75,
      `cameraMode=${expModeDiag.enter.homeCameraMode}, avatarY=${expModeDiag.enter.avatarY}m, subBoxes=${expModeDiag.enter.subBoxCount}, drivingHidden=${expModeDiag.drivingControlsHidden}, calls=${expModeDiag.perf.drawCalls}, fps=${expModeDiag.perf.fps}`
    );

    // =========================================================================
    // CHECK 27: M4.6 HOME PLANNER MODE (ELEVATED CUTAWAY VIEW, NEEDS EXPANSION & PLACEMENT VALIDATION)
    // =========================================================================
    const plannerModeDiag = await client.evaluate(`(() => {
      const modeRes = window.__PROJECT_EKO_LIFE__.setHomeCameraMode('planner');
      window.__PROJECT_EKO_LIFE__.homeNeedsExpanded = true;
      window.__PROJECT_EKO_LIFE__.homePlannerExpanded = true;
      window.__PROJECT_EKO_LIFE__.updateHomeInteriorHUD();
      const badWall = window.__PROJECT_EKO_LIFE__.validateFurniturePlacement('inst_test', -4.8, 0, 1.0, 1.0, 0);
      const badDoor = window.__PROJECT_EKO_LIFE__.validateFurniturePlacement('inst_test', 0, 3.2, 1.0, 1.0, 0);
      const badPart = window.__PROJECT_EKO_LIFE__.validateFurniturePlacement('inst_test', 1.35, -3.0, 1.0, 1.0, 0);
      if (typeof dismissToast === 'function') dismissToast();
      return {
        modeRes,
        badWall,
        badDoor,
        badPart,
        needsStripVisible: document.getElementById('home-hud-needs-strip') && document.getElementById('home-hud-needs-strip').style.display !== 'none',
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__
      };
    })()`);
    await sleep(850);
    results.modeProfiles.m4_6_homePlanner_1440x900 = plannerModeDiag.perf;
    const planShot = await client.screenshot('m4_6_home_planner_mode.png');
    results.screenshots.push(planShot);

    assertCheck(
      'M4.6 Home Planner Mode (Elevated Cutaway View, Expandable 8-Needs Pill & Collision-Safe Placement Validation)',
      plannerModeDiag.modeRes &&
      plannerModeDiag.modeRes.homeCameraMode === 'planner' &&
      plannerModeDiag.needsStripVisible &&
      plannerModeDiag.badWall.error === 'PLACEMENT_OUT_OF_ROOM_BOUNDS' &&
      plannerModeDiag.badDoor.error === 'PLACEMENT_BLOCKS_DOORWAY' &&
      plannerModeDiag.badPart.error === 'PLACEMENT_COLLIDES_WITH_PARTITION' &&
      plannerModeDiag.perf.drawCalls <= 75,
      `cameraMode=${plannerModeDiag.modeRes.homeCameraMode}, needsExpanded=${plannerModeDiag.needsStripVisible}, wallErr=${plannerModeDiag.badWall.error}, doorErr=${plannerModeDiag.badDoor.error}, partErr=${plannerModeDiag.badPart.error}`
    );

    // =========================================================================
    // CHECK 28: M4.5 GENUINE FUNCTIONAL HOUSEHOLD OBJECTS (GROCERY BASKET -> STOVE -> FAN -> BED)
    // =========================================================================
    const funcObjDiag = await client.evaluate(`(() => {
      window.__PROJECT_EKO_LIFE__.setHomeCameraMode('exploration');
      window.__PROJECT_EKO_LIFE__.homeNeedsExpanded = false;
      const buyBasket = window.__PROJECT_EKO_LIFE__.buyAndPlaceFromCounter('itm_grocery_basket', true);
      const useBasket = window.__PROJECT_EKO_LIFE__.walkToAndUseHomeObject('itm_grocery_basket');
      const useStove = window.__PROJECT_EKO_LIFE__.walkToAndUseHomeObject('itm_table_stove');
      const useFan = window.__PROJECT_EKO_LIFE__.walkToAndUseHomeObject('itm_standing_fan');
      const useBed = window.__PROJECT_EKO_LIFE__.walkToAndUseHomeObject('itm_mattress_starter');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        buyBasket,
        useBasket,
        useStove,
        useFan,
        useBed,
        life: window.__PROJECT_EKO_LIFE__.getDiagnostics(),
        perf: window.__PROJECT_EKO_PERF__
      };
    })()`);
    await sleep(850);
    const cookBedShot = await client.screenshot('m4_6_home_cooking_and_bed.png');
    results.screenshots.push(cookBedShot);

    assertCheck(
      'M4.5 Genuine Functional Household Objects (Grocery Basket Restocks Pantry, Stove Cooks Meal, Fan Toggles & Bed Restores Energy)',
      funcObjDiag.useBasket &&
      funcObjDiag.useBasket.success &&
      funcObjDiag.useStove &&
      funcObjDiag.useStove.success &&
      funcObjDiag.useFan &&
      funcObjDiag.useFan.success &&
      funcObjDiag.useBed &&
      funcObjDiag.useBed.success &&
      funcObjDiag.life.homePantryServings >= 3,
      `pantryServings=${funcObjDiag.life.homePantryServings}, fanOn=${funcObjDiag.life.homeApplianceState.fanOn}, energy=${funcObjDiag.life.needsState.energy}%, hunger=${funcObjDiag.life.needsState.hunger}%`
    );

    // =========================================================================
    // CHECK 29: M4.5 & M4.6 MOBILE PORTRAIT (390x844) & LANDSCAPE (844x390) HOME INTERIOR ACCEPTANCE
    // =========================================================================
    await client.setViewport(390, 844, true);
    await sleep(600);
    const homeMobPortrait = await client.evaluate(`(() => {
      const hud = document.getElementById('home-interior-hud-bar');
      const r = hud ? hud.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
      return {
        inside: window.__PROJECT_EKO_LIFE__.isInsideHomeInterior,
        hudFitsViewport: r.left >= 0 && r.right <= 392 && r.bottom <= 844,
        perf: window.__PROJECT_EKO_PERF__
      };
    })()`);
    const homePortShot = await client.screenshot('m4_6_home_mobile_portrait.png');
    results.screenshots.push(homePortShot);

    await client.setViewport(844, 390, true);
    await sleep(600);
    const homeMobLandscape = await client.evaluate(`(() => {
      const hud = document.getElementById('home-interior-hud-bar');
      const r = hud ? hud.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
      return {
        inside: window.__PROJECT_EKO_LIFE__.isInsideHomeInterior,
        hudFitsViewport: r.left >= 0 && r.right <= 846 && r.bottom <= 390,
        perf: window.__PROJECT_EKO_PERF__
      };
    })()`);
    const homeLandShot = await client.screenshot('m4_6_home_mobile_landscape.png');
    results.screenshots.push(homeLandShot);

    await client.setViewport(1440, 900, false);
    await sleep(500);

    assertCheck(
      'M4.5 & M4.6 Mobile Portrait (390x844) & Landscape (844x390) Home Interior Layout & Touch Acceptance',
      homeMobPortrait.inside &&
      homeMobPortrait.hudFitsViewport &&
      homeMobLandscape.inside &&
      homeMobLandscape.hudFitsViewport,
      `portraitFits=${homeMobPortrait.hudFitsViewport} (${homeMobPortrait.perf.fps}fps), landscapeFits=${homeMobLandscape.hudFitsViewport} (${homeMobLandscape.perf.fps}fps)`
    );

    // =========================================================================
    // CHECK 30: M4.5 3 ECONOMIC PROFILES, NO-VEHICLE JOB RECEIPT & FULL PAGE RELOAD PERSISTENCE
    // =========================================================================
    const preReloadDiag = await client.evaluate(`(() => {
      const pNew = window.__PROJECT_EKO_LIFE__.applyEconomicStageProfile('new_arrival');
      const pWork = window.__PROJECT_EKO_LIFE__.applyEconomicStageProfile('working_player');
      const pEst = window.__PROJECT_EKO_LIFE__.applyEconomicStageProfile('established_player');
      // Settle a 3-checkpoint no-vehicle job on Working Player profile and open Jobs tab to show receipt
      window.__PROJECT_EKO_LIFE__.applyEconomicStageProfile('working_player');
      window.__PROJECT_EKO_LIFE__.startActiveJobShift('job_foot_courier');
      const jobDone = window.__PROJECT_EKO_LIFE__.completeActiveJobShiftNow();
      window.__PROJECT_EKO_LIFE__.openModal('jobs');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        pNew,
        pWork,
        pEst,
        jobDone,
        balanceBeforeReload: player.balance,
        placedBeforeReload: window.__PROJECT_EKO_LIFE__.placedFurniture.length,
        ownedBeforeReload: window.__PROJECT_EKO_LIFE__.ownedItems.length,
        pantryBeforeReload: window.__PROJECT_EKO_LIFE__.homePantryServings,
        receiptsBeforeReload: window.__PROJECT_EKO_LIFE__.completedJobReceipts.length
      };
    })()`);
    await sleep(750);
    const receiptShot = await client.screenshot('m4_5_shop_and_job_receipt.png');
    results.screenshots.push(receiptShot);

    // Perform full browser Page.reload and verify persisted state restoration
    await client.send('Page.reload', { ignoreCache: false });
    for (let i = 0; i < 40; i++) {
      const booted = await client.evaluate(`Boolean(window.__PROJECT_EKO_ATLAS__ && window.__PROJECT_EKO_LIFE__ && window.__PROJECT_EKO_PERF__)`);
      if (booted) break;
      await sleep(250);
    }
    await sleep(900);

    const postReloadDiag = await client.evaluate(`(() => {
      window.__PROJECT_EKO_LIFE__.enterHomeInterior('exploration');
      if (typeof dismissToast === 'function') dismissToast();
      return {
        balanceAfterReload: player.balance,
        placedAfterReload: window.__PROJECT_EKO_LIFE__.placedFurniture.length,
        ownedAfterReload: window.__PROJECT_EKO_LIFE__.ownedItems.length,
        pantryAfterReload: window.__PROJECT_EKO_LIFE__.homePantryServings,
        receiptsAfterReload: window.__PROJECT_EKO_LIFE__.completedJobReceipts.length,
        starterProfileAfterReload: window.__PROJECT_EKO_LIFE__.starterProfileId
      };
    })()`);
    await sleep(750);
    const reloadShot = await client.screenshot('m4_5_reload_persistence.png');
    results.screenshots.push(reloadShot);

    assertCheck(
      'M4.5 3 Economic Profiles & 100% Save/Reload Persistence (Wallet GN, Placed 3D Furniture, Inventory, Pantry & Job Receipts)',
      preReloadDiag.pNew.openingBalanceGN === 1200 &&
      preReloadDiag.pWork.openingBalanceGN === 8500 &&
      preReloadDiag.pEst.openingBalanceGN === 125000 &&
      postReloadDiag.balanceAfterReload === preReloadDiag.balanceBeforeReload &&
      postReloadDiag.placedAfterReload === preReloadDiag.placedBeforeReload &&
      postReloadDiag.ownedAfterReload === preReloadDiag.ownedBeforeReload &&
      postReloadDiag.pantryAfterReload === preReloadDiag.pantryBeforeReload &&
      postReloadDiag.receiptsAfterReload === preReloadDiag.receiptsBeforeReload,
      `balance=${postReloadDiag.balanceAfterReload} GN, placed=${postReloadDiag.placedAfterReload}, owned=${postReloadDiag.ownedAfterReload}, pantry=${postReloadDiag.pantryAfterReload}, jobReceipts=${postReloadDiag.receiptsAfterReload}`
    );

    const outJson = path.join(ARTIFACT_DIR, 'm3_1_verification_results.json');
    fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
    console.log('\n====================================================');
    console.log(`M3.1 VERIFICATION COMPLETE: ${results.checks.length} CHECKS PASSED | 0 FAILED`);
    console.log(`Saved telemetry to ${outJson}`);
    console.log('====================================================');
  } finally {
    if (client && client.ws) client.ws.close();
    chromeProc.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
