/**
 * PROJECT EKO — LOCAL MONOREPO DEV ORCHESTRATOR
 * Launches 3D Game Client, Domain API, and Realtime Zone Worker simultaneously.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('====================================================');
console.log('PROJECT EKO — LAUNCHING LOCAL DEV SERVERS (M0)');
console.log('====================================================\n');

function runProcess(name, scriptPath, cwd) {
  const child = spawn('node', [scriptPath], {
    cwd: cwd || __dirname,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (err) => {
    console.error(`[${name}] Failed to start:`, err);
  });

  child.on('exit', (code) => {
    console.log(`[${name}] Exited with code ${code}`);
  });

  return child;
}

const rootDir = path.resolve(__dirname, '..');

// 1. Launch Game Client (Port 3000)
const gameProc = runProcess('Game Client', path.join(rootDir, 'apps/game/server.js'), path.join(rootDir, 'apps/game'));

// 2. Launch Domain API (Port 3001)
const apiProc = runProcess('Domain API', path.join(rootDir, 'services/api/dist/server.js'), rootDir);

// 3. Launch Realtime Zone Worker (Port 3002)
const realtimeProc = runProcess('Realtime Worker', path.join(rootDir, 'services/realtime/dist/server.js'), rootDir);

process.on('SIGINT', () => {
  console.log('\nShutting down Project Eko dev processes...');
  gameProc.kill();
  apiProc.kill();
  realtimeProc.kill();
  process.exit(0);
});
