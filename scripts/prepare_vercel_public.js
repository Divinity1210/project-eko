const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'apps', 'game');
const OUT_DIR = path.join(ROOT, 'public');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

fs.copyFileSync(path.join(SRC_DIR, 'index.html'), path.join(OUT_DIR, 'index.html'));
if (fs.existsSync(path.join(SRC_DIR, 'assets'))) {
  fs.cpSync(path.join(SRC_DIR, 'assets'), path.join(OUT_DIR, 'assets'), { recursive: true });
}

console.log('[Vercel Build] Prepared public/ directory from apps/game (index.html + 3D assets).');
