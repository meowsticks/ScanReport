// One-off review harness (NOT the locked design): drives the REAL app to a PDF
// with every card populated, so Dustin can eyeball a maximally-filled report.
// Seeds the app's localStorage library with a maxed report, enters Preview,
// and exports the app's own print output. Output is scratch (gitignored).
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(OUT, '..', 'gssi-report-app');
const URL = 'http://localhost:4173/';
const sample = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'samples', 'sample-full-report.json'), 'utf8'));

const browser = await puppeteer.launch({ args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1300, height: 1000, deviceScaleFactor: 2 });

// 1) Generate tidy labeled placeholder images on a blank page (canvas → dataURL),
//    so the photo/diagram cards render with real content instead of empty boxes.
await page.goto('about:blank');
const mkImg = (label, sub, hue) => page.evaluate((label, sub, hue) => {
  const c = document.createElement('canvas'); c.width = 800; c.height = 560;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0,0,0,560);
  g.addColorStop(0, `hsl(${hue},18%,90%)`); g.addColorStop(1, `hsl(${hue},20%,72%)`);
  x.fillStyle = g; x.fillRect(0,0,800,560);
  // faint GPR-style hyperbola arcs so it reads as a scan, not a flat swatch
  x.strokeStyle = `hsla(${hue},35%,38%,.5)`; x.lineWidth = 2;
  for (let k=0;k<5;k++){ x.beginPath();
    for (let px=0;px<=800;px+=8){ const t=(px-400)/170; const py=130+k*78+ t*t*22; x.lineTo(px,py); }
    x.stroke(); }
  x.fillStyle = 'rgba(20,20,20,.82)'; x.fillRect(0,0,800,64);
  x.fillStyle = '#fff'; x.font = '700 30px Inter, Segoe UI, sans-serif';
  x.fillText(label, 22, 42);
  x.fillStyle = '#c0282d'; x.font = '700 18px Inter, sans-serif';
  x.fillText(sub, 22, 540);
  return c.toDataURL('image/jpeg', 0.85);
}, label, sub, hue);

const diagramImage = await mkImg('Site Plan — Level 2 slab', 'Grid B–E / 2–5 · 1:50', 210);
// one annotated photo per scan location + a couple of standalone scan photos
const locImgs = [];
for (let i=0;i<(sample.scanLocations||[]).length;i++){
  locImgs.push(await mkImg(`Scan ${sample.scanLocations[i].label} — target map`, 'GPR B-scan · 1.6 GHz · 0–200 mm', 200 + i*40));
}
const photoImgs = [
  await mkImg('Slab overview — Bay C4', 'Site reference photo', 30),
  await mkImg('Marked core set — A through D', 'Field markup', 140),
];

// 2) Build a maximally-filled report: full tier, every toggle on, no blanks,
//    issued (clean, no DRAFT), images in every visual card.
const now = '2026-06-01';
const zones = [
  { id: 'z-boh', name: 'Back of House', note: 'Mechanical + storage rooms' },
  { id: 'z-foh', name: 'Front of House', note: 'Lobby + retail slab' },
];
const report = {
  ...sample,
  tier: 'full',
  status: 'issued',
  showWatermark: false,
  jobNote: 'FULL — every card populated for PDF review',
  // fill the blanks left in the sample
  reviewedBy: 'J. Mehta, P.Eng.',
  reviewedRole: 'Engineer of Record',
  preparedBy: sample.preparedBy || 'T. Aggarwal',
  preparedRole: sample.preparedRole || 'Certified GPR Technician',
  preparedCert: 'Decifer GPR #DC-20418',
  egbcEnabled: true,
  permitNo: 'BP-2026-114537',
  signDate: now,
  approvedBy: 'J. Mehta, P.Eng. (EGBC #38217)',
  approvedDate: now,
  scanner: sample.scanner || 'GSSI StructureScan Mini XT',
  antenna: sample.antenna || '2.7 GHz integrated',
  firmware: sample.firmware || '4.0.2',
  scanMode: sample.scanMode || 'Scan3D',
  workflow: {
    scanComplete:     '2026-06-01T09:45',
    reportIssued:     '2026-06-01T13:10',
    clearedForCoring: '2026-06-02T08:00',
  },
  uncertaintyZones: sample.uncertaintyZones ||
    'NE corner near column footing: rebar congestion reduces depth confidence below 200 mm — daylight verify before coring within a 0.5 m radius.',
  coreStandoff: '25 mm',
  // every feature ON
  brandFlourishes: true,
  enableColorLegend: true,
  enableConfidenceBand: true,
  enableZones: true,
  enableCadPage: true,
  enableStandardNotes: true,
  enableNamedZones: true,
  enableQR: true,
  qrUrl: 'https://scan-report.vercel.app',
  // CAD page
  drawingNo: 'AKCC-2026-0518-S01',
  drawingScale: '1 : 50',
  diagramNotes: sample.diagramNotes ||
    'Scan performed on Level 2 suspended slab, Grid B-E / 2-5. All cores marked in red; no-go zones hatched.',
  // visual cards
  diagramImage,
  zones,
  scanPhotos: photoImgs.map((dataUrl, i) => ({
    id: `sp-${i}`, dataUrl, caption: ['Slab overview at Bay C4','Marked core set A–D'][i],
    confidence: 'high', pinRef: `P${i+1}`, scanType: 'site', locationRef: `L${i+1}`,
    scaleInfo: '', panelGroup: '', panelLabel: '', annotations: [],
  })),
  scanLocations: (sample.scanLocations||[]).map((loc, i) => ({
    ...loc,
    photo: locImgs[i] || null,
    photoAnnotations: [],
    zoneId: zones[i % zones.length].id,
    notes: loc.notes || 'Clear of all marked targets — proceed with 25 mm standoff.',
    confidence: loc.confidence || 'high',
  })),
};

// 3) Seed localStorage BEFORE the app boots, then load the app.
const id = 'r-fullreview';
await page.evaluateOnNewDocument((id, report) => {
  try {
    localStorage.clear();
    localStorage.setItem('ak_help_autoshow', '0');
    localStorage.setItem('ak_setup_collapsed', '0');
    localStorage.setItem('ak_theme', 'light');
    localStorage.setItem('ak_report_' + id, JSON.stringify(report));
    localStorage.setItem('ak_reports_index', JSON.stringify([{ id, name: 'FULL review', updatedAt: Date.now() }]));
    localStorage.setItem('ak_current_report', id);
  } catch (e) {}
}, id, report);

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await new Promise(r => setTimeout(r, 600));

// Dismiss any onboarding, then enter Preview so the report renders as it prints.
await page.evaluate(() => {
  const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Got it');
  if(b) b.click();
});
await new Promise(r => setTimeout(r, 300));
const clickedPreview = await page.evaluate(() => {
  const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Preview saved PDF'));
  if (b) { b.click(); return true; } return false;
});
await new Promise(r => setTimeout(r, 1000));
const inPreview = await page.evaluate(() => document.body.classList.contains('preview-mode'));
console.log('clicked preview button:', clickedPreview, '· preview-mode active:', inPreview);
if (!inPreview) throw new Error('Failed to enter preview mode — aborting so we do not export the editor view.');

// Sanity screenshot (on-screen preview) for self-review.
await page.screenshot({ path: path.join(OUT, 'app-fullreport-preview.png'), fullPage: true });

// 4) Export the app's own print output to PDF. Respect the app's own @page
//    rules (A4 + the named landscape `cad` page) instead of forcing a size.
await page.pdf({ path: path.join(OUT, 'app-fullreport.pdf'),
  printBackground: true, preferCSSPageSize: true });

await browser.close();
console.log('wrote app-fullreport.pdf + app-fullreport-preview.png');
