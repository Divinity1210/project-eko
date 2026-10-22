#!/usr/bin/env node
/**
 * Isolated Phase 1 acceptance check for API sessions and realtime identity.
 * Uses temporary ports and data so the developer's saved accounts are untouched.
 */
const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eko-phase1-'));
const children = [];

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function startService(label, entry, env) {
  const child = spawn(process.execPath, [entry], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.failureOutput = () => `${label}\n${output}`;
  children.push(child);
  return child;
}

async function waitForHealth(url, service) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (service.exitCode !== null) throw new Error(service.failureOutput());
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}\n${service.failureOutput()}`);
}

async function request(baseUrl, route, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers['X-Session-Token'] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  const apiPort = await reservePort();
  let realtimePort = await reservePort();
  while (realtimePort === apiPort) realtimePort = await reservePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const realtimeUrl = `http://127.0.0.1:${realtimePort}`;
  const env = {
    ...process.env,
    PROJECT_EKO_DATA_DIR: tempDataDir,
    PROJECT_EKO_API_PORT: String(apiPort),
    PROJECT_EKO_REALTIME_PORT: String(realtimePort),
  };

  const api = startService('API', path.join(root, 'services/api/dist/server.js'), env);
  const realtime = startService('Realtime', path.join(root, 'services/realtime/dist/server.js'), env);
  await Promise.all([
    waitForHealth(`${apiUrl}/health`, api),
    waitForHealth(`${realtimeUrl}/health`, realtime),
  ]);

  for (const [url, route] of [[apiUrl, '/api/v1/player/profile'], [realtimeUrl, '/snapshot']]) {
    assert.strictEqual((await request(url, route)).status, 401, `Expected unauthenticated ${route} to reject`);
  }
  assert.strictEqual((await request(realtimeUrl, '/presence', {
    method: 'POST', token: 'invalid-token', body: { playerId: 'forged-player' },
  })).status, 401, 'Expected invalid realtime session to reject forged player ID');

  const guestA = await request(apiUrl, '/api/v1/auth/guest', { method: 'POST', body: {} });
  const guestB = await request(apiUrl, '/api/v1/auth/guest', { method: 'POST', body: {} });
  assert.strictEqual(guestA.status, 200);
  assert.strictEqual(guestB.status, 200);
  const accountA = guestA.body.account.accountId;
  const accountB = guestB.body.account.accountId;
  const tokenA = guestA.body.sessionToken;
  const tokenB = guestB.body.sessionToken;
  assert.notStrictEqual(accountA, accountB);

  const sync = await request(apiUrl, '/api/v1/journey/sync-state', {
    method: 'POST', token: tokenA,
    body: { sessionToken: tokenB, accountId: accountB, activeJobShift: { shiftId: 'phase1-a', jobId: 'phase1-account-a-job', currentStepIndex: 1 } },
  });
  assert.strictEqual(sync.status, 200, 'Authenticated account A should sync its own state');
  const stateA = await request(apiUrl, '/api/v1/journey/state', { token: tokenA });
  const stateB = await request(apiUrl, '/api/v1/journey/state', { token: tokenB });
  assert.strictEqual(stateA.body.account.accountId, accountA);
  assert.strictEqual(stateA.body.account.onboarding.activeJobId, 'phase1-account-a-job');
  assert.strictEqual(stateB.body.account.accountId, accountB);
  assert.notStrictEqual(stateB.body.account.onboarding.activeJobId, 'phase1-account-a-job');

  const clientClaimedSettlement = await request(apiUrl, '/api/v1/multiplayer/coop-danfo/settle', {
    method: 'POST', token: tokenA,
    body: { driverPlayerId: accountA, conductorPlayerId: accountB, completedStops: 99, passengersBoarded: 999 },
  });
  assert.strictEqual(clientClaimedSettlement.status, 503, 'Settlement must remain disabled until it can verify zone evidence');
  assert.strictEqual(clientClaimedSettlement.body.error, 'SERVER_VERIFIED_COOP_SETTLEMENT_REQUIRED');

  const presence = await request(realtimeUrl, '/presence', {
    method: 'POST', token: tokenA,
    body: { playerId: accountB, username: 'Forged Name', position: { x: 12, y: 0, z: 8 } },
  });
  assert.strictEqual(presence.status, 200);
  assert.strictEqual(presence.body.player.playerId, accountA, 'Realtime identity must come from the session');
  assert.strictEqual(presence.body.player.username, guestA.body.account.username, 'Realtime name must come from the account');

  const chat = await request(realtimeUrl, '/chat', {
    method: 'POST', token: tokenA, body: { senderId: accountB, senderName: 'Forged Name', text: 'Phase one smoke check' },
  });
  assert.strictEqual(chat.status, 200);
  assert.strictEqual(chat.body.message.senderId, accountA, 'Chat sender must come from the session');
  assert.strictEqual(chat.body.message.senderName, guestA.body.account.username);

  const disconnect = await request(realtimeUrl, '/disconnect', {
    method: 'POST', token: tokenA, body: { playerId: accountB },
  });
  assert.strictEqual(disconnect.status, 200);
  assert.strictEqual(disconnect.body.playerId, accountA, 'Disconnect must target the authenticated account');

  console.log('Phase 1 identity acceptance passed: unauthenticated/invalid sessions reject, M47 account state is isolated, and realtime presence/chat/disconnect use the authenticated identity.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  await Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('close', resolve);
  })));
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});
