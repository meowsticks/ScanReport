// Headless render of the live React report to a print-accurate PDF.
//
// Drives the running Vite dev server with Puppeteer, loads a report fixture
// through the app's own JSON import, then prints with Chrome's @media print
// rules applied — i.e. exactly what "Save PDF" produces (company letterhead
// on, editor chrome hidden). Handy for reviewing the report output without a
// local desktop (e.g. send the PDF to a phone).
//
// Usage (dev server must be running on PORT, default 5173):
//   node render-report.mjs [fixture.json] [out.pdf]
//   PORT=5173 node render-report.mjs gssi-report-app/samples/demo-L2-slab-20-cores.json /tmp/report.pdf
import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || '5173';
const URL = `http://127.0.0.1:${PORT}/`;
const DEMO = path.resolve(repoRoot, process.argv[2] || 'gssi-report-app/samples/demo-L2-slab-20-cores.json');
const OUT = path.resolve(process.argv[3] || '/tmp/facelift-report.pdf');

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
page.on('dialog', d => d.accept().catch(() => {}));
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

// Suppress the first-launch Getting-Started guide and the What's-new popup,
// which auto-open on fresh storage and aren't real report content.
await page.evaluate(() => {
  localStorage.setItem('ak_help_autoshow', '0');
  localStorage.setItem('ak_last_seen_version', '99.0.0');
});
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await page.keyboard.press('Escape').catch(() => {});

// Feed the report fixture in via the app's own hidden JSON import input.
const input = await page.waitForSelector('input[accept*=".akscan"]', { timeout: 20000 });
await input.uploadFile(DEMO);
await new Promise(r => setTimeout(r, 2500)); // let React commit + canvases redraw

// Render exactly what the saved PDF produces (Chrome applies @media print).
await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true, format: 'A4' });

await browser.close();
console.log('WROTE', OUT);
