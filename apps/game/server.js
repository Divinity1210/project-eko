const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PROJECT_EKO_GAME_PORT || process.env.PORT || 3000);
const PUBLIC_API_URL = process.env.PROJECT_EKO_PUBLIC_API_URL || 'http://localhost:3001';
const PUBLIC_REALTIME_URL = process.env.PROJECT_EKO_PUBLIC_REALTIME_URL || 'http://localhost:3002';
const ALLOWED_ORIGINS = (
  process.env.PROJECT_EKO_CORS_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

function applySecurityAndCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin && ALLOWED_ORIGINS.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: http: data: blob:; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: http:; connect-src 'self' http: https: ws: wss:;"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

const server = http.createServer((req, res) => {
  applySecurityAndCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawPath = (req.url || '/').split('?')[0];

  if (rawPath === '/health' || rawPath === '/readyz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'project-eko-game-client',
        ready: true,
        apiBaseUrl: PUBLIC_API_URL,
        realtimeBaseUrl: PUBLIC_REALTIME_URL,
        timestamp: Date.now(),
      })
    );
    return;
  }

  if (rawPath === '/config.js') {
    const runtimeConfig = {
      environment: process.env.NODE_ENV || 'development',
      apiBaseUrl: PUBLIC_API_URL,
      realtimeBaseUrl: PUBLIC_REALTIME_URL,
      liveFiatPayoutsEnabled: false,
      fiatRewardsEnabled: false,
    };
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(`window.__PROJECT_EKO_CONFIG__ = ${JSON.stringify(runtimeConfig)};\n`);
    return;
  }

  let reqPath = rawPath === '/' ? '/index.html' : rawPath;
  let decodedPath = reqPath;
  try {
    decodedPath = decodeURIComponent(reqPath);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  const rootDir = path.resolve(__dirname);
  const filePath = path.resolve(rootDir, '.' + decodedPath);
  if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Project Eko Game Client] Serving 3D Client on http://localhost:${PORT}`);
});
