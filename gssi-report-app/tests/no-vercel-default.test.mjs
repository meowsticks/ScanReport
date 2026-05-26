// Regression for v1.0.11:
//   Boss installed the .exe and got a Vercel sign-in page on first launch
//   because electron/main.cjs hard-coded DEFAULT_TEST_URL to a private
//   Vercel preview. Production builds MUST ship with that constant empty
//   so the bundled Stable app loads.
//
// This is a pure-text guard — it reads the file and asserts the line is
// the empty form. Cheap, no browser needed.
import fs from 'fs';
import path from 'path';

const file = path.resolve(process.cwd(), '../gssi-report-app/electron/main.cjs');
// Allow running from either repo root or tests/ dir
const candidates = [
  file,
  path.resolve(process.cwd(), 'electron/main.cjs'),
  path.resolve(process.cwd(), 'gssi-report-app/electron/main.cjs'),
];
const src = candidates.map(p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }).find(Boolean);
if (!src) { console.error('main.cjs not found'); process.exit(1); }

const m = src.match(/const\s+DEFAULT_TEST_URL\s*=\s*(['"])([^'"]*)\1/);
if (!m) {
  console.error('Could not locate DEFAULT_TEST_URL declaration');
  process.exit(1);
}
const value = m[2];
if (value === '') {
  console.log('  ✓ DEFAULT_TEST_URL is empty — production builds load the bundled Stable app');
  console.log('\n0 failures');
  process.exit(0);
}
console.error(`  ✗ DEFAULT_TEST_URL is "${value}"`);
console.error('    Shipped production builds will boot users straight into a remote URL,');
console.error('    which traps them on Vercel auth if that deployment is protected.');
console.error("    Set this to '' for production. Use the in-app Test toggle to point at a");
console.error('    custom URL at runtime if needed.');
process.exit(1);
