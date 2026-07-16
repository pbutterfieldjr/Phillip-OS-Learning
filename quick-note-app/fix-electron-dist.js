// electron-builder renames the Electron.app bundle inside
// node_modules/electron/dist to match productName while packaging (npm run
// dist), and doesn't always rename it back. That leaves `npm start` unable
// to find the binary path.txt points at. This runs automatically before
// `npm start` (see package.json's "prestart") and repairs that in place.
const fs = require('fs');
const path = require('path');

const electronDir = path.join(__dirname, 'node_modules', 'electron');
const distDir = path.join(electronDir, 'dist');
const pathFile = path.join(electronDir, 'path.txt');

if (!fs.existsSync(distDir) || !fs.existsSync(pathFile)) {
  // Nothing to fix yet - electron hasn't been installed/extracted at all.
  process.exit(0);
}

const relPath = fs.readFileSync(pathFile, 'utf8').trim();
const expectedAppName = relPath.split('/')[0];
const expectedAppPath = path.join(distDir, expectedAppName);

if (fs.existsSync(expectedAppPath)) {
  process.exit(0);
}

const entries = fs.readdirSync(distDir, { withFileTypes: true });
const renamedApp = entries.find((e) => e.isDirectory() && e.name.endsWith('.app') && e.name !== expectedAppName);

if (renamedApp) {
  fs.renameSync(path.join(distDir, renamedApp.name), expectedAppPath);
  console.log(`[fix-electron-dist] Renamed "${renamedApp.name}" back to "${expectedAppName}".`);
} else {
  console.warn(
    `[fix-electron-dist] "${expectedAppName}" is missing from node_modules/electron/dist and there's no renamed .app to recover.\n` +
    '[fix-electron-dist] Run: rm -rf node_modules/electron && npm install'
  );
}
