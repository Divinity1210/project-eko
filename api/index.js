const path = require('path');

process.env.PROJECT_EKO_SERVERLESS = '1';
if (!process.env.PROJECT_EKO_DATA_DIR) {
  process.env.PROJECT_EKO_DATA_DIR = path.join('/tmp', 'project-eko-data');
}

const { apiServer } = require('../services/api/dist/server');
const { realtimeServer } = require('../services/realtime/dist/server');

module.exports = (req, res) => {
  const rawUrl = String(req.url || '/');
  const parsed = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);

  // Serve dynamic runtime /config.js for the browser client
  if (parsed.pathname === '/config.js') {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
    const origin = `${proto}://${host}`;
    const runtimeConfig = {
      environment: process.env.NODE_ENV || 'production',
      apiBaseUrl: origin,
      realtimeBaseUrl: `${origin}/rt`,
      fiatRewardsEnabled: false,
      liveFiatPayoutsEnabled: false,
    };
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    res.end(`window.__PROJECT_EKO_CONFIG__ = ${JSON.stringify(runtimeConfig)};\n`);
    return;
  }

  // Route /rt/* requests to the Realtime Worker
  if (parsed.pathname === '/rt' || parsed.pathname.startsWith('/rt/')) {
    const strippedPath = parsed.pathname.slice(3) || '/';
    req.url = strippedPath + parsed.search;
    realtimeServer.emit('request', req, res);
    return;
  }

  // Route all /api/*, /health, /readyz, /metrics requests to the Domain API
  apiServer.emit('request', req, res);
};
