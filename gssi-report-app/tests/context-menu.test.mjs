// Regression for v1.0.12:
//   Boss reported he couldn't right-click → Copy in the shipped .exe.
//   Cause: Electron suppresses the OS context menu by default; the app
//   never registered one. Fix: electron-context-menu, wired up in the
//   main process so every BrowserWindow gets Cut/Copy/Paste/Select All.
//
// This is a pure-text guard — confirms the dep is in `dependencies` (so
// electron-builder bundles it into the .exe), and that main.cjs both
// requires the module AND configures it. Cheap, runs without a browser.
import fs from 'fs';
import path from 'path';

const candidates = [
  'electron/main.cjs',
  'gssi-report-app/electron/main.cjs',
  '../gssi-report-app/electron/main.cjs',
].map(p => path.resolve(process.cwd(), p));
const main = candidates.map(p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }).find(Boolean);
if (!main) { console.error('main.cjs not found'); process.exit(1); }

const pkgCandidates = [
  'package.json',
  'gssi-report-app/package.json',
  '../gssi-report-app/package.json',
].map(p => path.resolve(process.cwd(), p));
const pkgRaw = pkgCandidates.map(p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }).find(Boolean);
if (!pkgRaw) { console.error('package.json not found'); process.exit(1); }
const pkg = JSON.parse(pkgRaw);

const FAILS = [];
const pass = (n) => console.log('  ✓', n);
const fail = (n, why) => { console.log('  ✗', n, '—', why); FAILS.push(n); };

if (pkg.dependencies && pkg.dependencies['electron-context-menu']) {
  pass(`electron-context-menu in dependencies (${pkg.dependencies['electron-context-menu']})`);
} else {
  fail('electron-context-menu in dependencies',
    'must be in `dependencies` (not devDependencies) so electron-builder bundles it');
}

if (/require\(['"]electron-context-menu['"]\)/.test(main)) {
  pass('main.cjs requires electron-context-menu');
} else {
  fail('main.cjs requires electron-context-menu', 'no require() found');
}

if (/contextMenu\s*\(/.test(main)) {
  pass('main.cjs invokes contextMenu(...) to attach the handler');
} else {
  fail('main.cjs invokes contextMenu(...)', 'no contextMenu(...) call found');
}

if (/shouldShowMenu/.test(main)) {
  pass('contextMenu config has shouldShowMenu guard (keeps canvas right-click clean)');
} else {
  fail('shouldShowMenu guard',
    'without this, the menu pops up over the diagram canvas and competes with cancel-stroke');
}

// v1.0.12/1.0.13 shipped electron-context-menu@^4.x which is ESM-only;
// the .exe crashed on launch with ERR_REQUIRE_ESM because main.cjs
// uses CommonJS require(). v3.x is the last CommonJS-compatible major.
// Fail loud if anyone tries to bump back into ESM territory.
const spec = pkg.dependencies && pkg.dependencies['electron-context-menu'];
const majorMatch = spec && spec.match(/(\d+)/);
if (majorMatch) {
  const major = Number(majorMatch[1]);
  if (major < 4) pass(`electron-context-menu pinned to CommonJS major (v${major}.x)`);
  else fail('electron-context-menu major < 4',
    `pinned to v${major}.x which is ESM-only; main.cjs require() will crash on launch. Pin to ^3.6.1.`);
}

console.log(`\n${FAILS.length} failures`);
if (FAILS.length) process.exit(1);
console.log('Right-click Cut/Copy/Paste is wired into the Electron shell.');
