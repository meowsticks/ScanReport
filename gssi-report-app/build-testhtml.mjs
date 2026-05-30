// Build a SINGLE self-contained HTML test build of the real app, preloaded
// with a rich, realistic filled report (full tier, many targets/cores and a
// set of scan-location cards) so an engineer can double-click one file and
// review exactly what they'd see in the app — no install, no server.
//
// Strategy: take the normal `vite build` output in dist/, inline the JS + CSS
// (and the fonts/logo they reference) into one HTML, then inject a localStorage
// seed that runs before the app boots. Output: ScanReport-TEST.html
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve('.');                 // gssi-report-app
const DIST = path.join(APP, 'dist');
const OUT = path.resolve('..', 'pdf-mockups', 'ScanReport-TEST.html');

const b64 = (p) => fs.readFileSync(p).toString('base64');
const read = (p) => fs.readFileSync(p, 'utf8');

// ---------------- the filled report ----------------
// Schema mirrors DEFAULT_REPORT / addTarget / addCore / addScanLocation in
// GSSIReportApp.jsx. Kept in sync by hand; if the app crashes on load, a field
// name drifted.
const SEED = {
  tier: 'full',
  assistantOn: true,
  projectNo: 'AKCC-2026-0431',
  jobNote: 'Cedar Crossing podium — multi-level core clearance set',
  scanDate: '2026-05-29',
  client: 'Northpoint Construction Ltd.',
  siteAddress: '8800 Cambie St, Vancouver BC',
  scanArea: 'P1 / L2 / L3 suspended decks — 9 proposed cores across gridlines C–H, ~22.4 m² scanned',
  weather: '16°C overcast, slabs dry',
  surface: 'Dry',
  slabThickness: '300 mm (per as-built), L2 two-way PT',
  slabAge: '> 30 days cured',
  scanCoverage: '100%',
  scanner: 'GSSI StructureScan Mini XT',
  antenna: '2.7 GHz integrated',
  serialNo: 'XMT-7741',
  firmware: '4.0.2',
  scanMode: 'Scan3D',
  dielectric: '6.4',
  scanDensity: '3 scans/cm',
  depthRange: '0 – 600 mm',

  uncertaintyZones:
    'Grid H sits ~300 mm from the L2 slab edge with a low-amplitude zone beneath, ' +
    'consistent with a void or delamination — depth confidence reduced in that 0.5 m radius. ' +
    'Grid G shows a strong isolated reflection not matching rebar spacing; treat as unknown ' +
    'until daylight-verified. Heavy second-mat congestion at Grid E reduces sub-100 mm clarity.',

  workflow: {
    scanComplete: '2026-05-29T10:15',
    reportIssued: '2026-05-29T13:40',
    clearedForCoring: '',
  },

  // { id, type, depth, cover, confidence, note }
  // NOTE: `type` MUST be one of TARGET_TYPES in GSSIReportApp.jsx, or the
  // dropdown silently falls back to "Rebar (top mat)". Keep these in sync.
  targets: [
    { id:'T-01', type:'Rebar (top mat)',          depth:'45',  cover:'45', confidence:'high', note:'#4 @ 200 mm o/c — consistent across all three decks' },
    { id:'T-02', type:'Rebar (top mat)',          depth:'95',  cover:'',   confidence:'med',  note:'L2 second mat — two-way congestion reduces sub-100 mm clarity' },
    { id:'T-03', type:'Rebar (bottom mat)',       depth:'235', cover:'65', confidence:'high', note:'#5 @ 250 mm o/c' },
    { id:'T-04', type:'Post-tension cable',       depth:'135', cover:'',   confidence:'high', note:'Single tendon crossing Grid B on a diagonal — DANGER' },
    { id:'T-05', type:'Electrical conduit',       depth:'110', cover:'',   confidence:'high', note:'Energised run beneath Grid C — treat as live' },
    { id:'T-06', type:'Cooling / radiant tubing', depth:'160', cover:'',   confidence:'med',  note:'Hydronic radiant loop, Grid F mechanical room' },
    { id:'T-07', type:'Unknown / anomaly',        depth:'90',  cover:'',   confidence:'low',  note:'Strong isolated metallic reflection, Grid G — verify intrusively' },
    { id:'T-08', type:'Void',                     depth:'140', cover:'',   confidence:'low',  note:'Low-amplitude zone near Grid H slab edge — suspected void/delamination' },
  ],

  // { label, size, verdict, clearance, note }
  cores: [
    { label:'A', size:'4"', verdict:'safe',    clearance:'65 mm', note:'Clear of all targets — drill as marked' },
    { label:'B', size:'6"', verdict:'caution', clearance:'30 mm', note:'PT tendon within 30 mm — relocate 80 mm S, re-scan' },
    { label:'C', size:'4"', verdict:'nogo',    clearance:'0',     note:'Over energised conduit — do not drill, EOR redesign' },
    { label:'D', size:'8"', verdict:'safe',    clearance:'55 mm', note:'Clear at top mat; limit depth to 130 mm (bottom mat)' },
    { label:'E', size:'4"', verdict:'caution', clearance:'18 mm', note:'Two-mat congestion — tight, centre precisely' },
    { label:'F', size:'5"', verdict:'safe',    clearance:'55 mm', note:'Radiant tubing mapped & avoided — cleared' },
    { label:'G', size:'4"', verdict:'nogo',    clearance:'0',     note:'Unknown metallic at 90 mm — verify before drilling' },
    { label:'H', size:'6"', verdict:'caution', clearance:'',      note:'Near slab edge, suspected void — pilot slowly' },
    { label:'J', size:'4"', verdict:'safe',    clearance:'70 mm', note:'Single top mat, generous spacing — cleared' },
  ],

  // { id, label, gridRef, photo, photoAnnotations, targetsPresent, verdict, clearance, notes, recommendation }
  scanLocations: [
    { id:'L-a', label:'Core A', gridRef:'P1 · Bay 1 mid-span', photo:null, photoAnnotations:[],
      targetsPresent:'Top-mat rebar only (~45 mm)', verdict:'safe', clearance:'65 mm',
      notes:'Clear cone at the proposed centre — no targets within 65 mm in any direction. Uniform top mat.',
      recommendation:'Safe to drill as marked.' },
    { id:'L-b', label:'Core B', gridRef:'P1 · Bay 2 column line', photo:null, photoAnnotations:[],
      targetsPresent:'Top-mat rebar + PT tendon (diagonal)', verdict:'caution', clearance:'30 mm',
      notes:'A post-tension tendon crosses on a diagonal within 30 mm of the proposed centre.',
      recommendation:'Relocate the core 80 mm south, clear of the tendon envelope, and re-scan before drilling.' },
    { id:'L-c', label:'Core C', gridRef:'P1 · Bay 2 wall line', photo:null, photoAnnotations:[],
      targetsPresent:'Top-mat rebar + energised conduit (~110 mm)', verdict:'nogo', clearance:'0',
      notes:'Energised electrical conduit detected directly beneath the proposed centre at ~110 mm.',
      recommendation:'No-go — do not drill; refer to the EOR for a redesigned core position.' },
    { id:'L-d', label:'Core D', gridRef:'P1 · Bay 3 mid-span', photo:null, photoAnnotations:[],
      targetsPresent:'Top + bottom mat', verdict:'safe', clearance:'55 mm',
      notes:'Large-diameter (8") core clear at top mat; bottom mat noted at ~150 mm.',
      recommendation:'Cleared — limit drill depth to 130 mm to stay clear of the bottom mat.' },
    { id:'L-e', label:'Core E', gridRef:'L2 · Bay 4 mid-span', photo:null, photoAnnotations:[],
      targetsPresent:'Top mat (~40 mm) + second mat (~95 mm)', verdict:'caution', clearance:'18 mm',
      notes:'Heavy two-way reinforcement — top and second mats both present. Best clear gap at the mark is 18 mm.',
      recommendation:'Workable for a 4" core if centred precisely; flag the tight tolerance to the operator.' },
    { id:'L-f', label:'Core F', gridRef:'L2 · mechanical room', photo:null, photoAnnotations:[],
      targetsPresent:'Top-mat rebar + hydronic radiant tubing', verdict:'safe', clearance:'55 mm',
      notes:'Radiant floor-heating tubing mapped along the south of the grid and avoided.',
      recommendation:'Cleared to drill as marked — 55 mm clear of both rebar and tubing.' },
    { id:'L-g', label:'Core G', gridRef:'L2 · Bay 5 wall line', photo:null, photoAnnotations:[],
      targetsPresent:'Top-mat rebar + unidentified metallic object', verdict:'nogo', clearance:'0',
      notes:'A strong, isolated metallic reflection sits at ~90 mm directly below — not consistent with rebar spacing.',
      recommendation:'No-go until its nature is confirmed by intrusive verification (small inspection hole).' },
    { id:'L-h', label:'Core H', gridRef:'L2 · slab edge', photo:null, photoAnnotations:[],
      targetsPresent:'Top-mat rebar + suspected void', verdict:'caution', clearance:'',
      notes:'Core sits ~300 mm from a slab edge with a low-amplitude zone suggesting a void/delamination beneath.',
      recommendation:'Reduced confidence — proceed slowly with a pilot; stop and reassess if the bit breaks through.' },
    { id:'L-j', label:'Core J', gridRef:'L3 · Bay 1 mid-span', photo:null, photoAnnotations:[],
      targetsPresent:'Single top mat, generous spacing', verdict:'safe', clearance:'70 mm',
      notes:'Single top mat with wide bar spacing. 70 mm clear in all directions.',
      recommendation:'Cleared to drill as marked.' },
  ],

  preparedBy: 'D. Cunningham',
  preparedRole: 'Certified GPR Technician',
  preparedCert: 'Decifer #DC-22841',
  reviewedBy: '',
  reviewedRole: 'Engineer of Record',
  signDate: '2026-05-29',

  brandFlourishes: true,
  enableColorLegend: true,
  enableConfidenceBand: true,
  coreStandoff: '50 mm',
};

// ---------------- inline the build into one HTML ----------------
let html = read(path.join(DIST, 'index.html'));

// locate the hashed JS + CSS
const jsRef = (html.match(/(?:\.\/)?assets\/[^"']+\.js/) || [])[0];
const cssRef = (html.match(/(?:\.\/)?assets\/[^"']+\.css/) || [])[0];
if (!jsRef || !cssRef) throw new Error('could not find built js/css refs in index.html');

const jsPath = path.join(DIST, jsRef.replace(/^\.\//, ''));
const cssPath = path.join(DIST, cssRef.replace(/^\.\//, ''));
let js = read(jsPath);
let css = read(cssPath);

// inline fonts referenced from the CSS via url(...woff2|woff|ttf)
css = css.replace(/url\((['"]?)([^'")]+\.(woff2|woff|ttf))\1\)/g, (m, q, url) => {
  const clean = url.replace(/^\.\//, '').replace(/^\/+/, '');
  const fp = path.join(DIST, clean.startsWith('assets/') ? clean : path.join('assets', path.basename(clean)));
  try {
    const ext = path.extname(fp).slice(1);
    const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : 'font/ttf';
    return `url(data:${mime};base64,${b64(fp)})`;
  } catch { return m; }
});

// inline the logo (public/ asset referenced at runtime as ./kamikaze-logo.png)
const logoData = 'data:image/png;base64,' + b64(path.join(DIST, 'kamikaze-logo.png'));
js = js.split('./kamikaze-logo.png').join(logoData)
       .split('kamikaze-logo.png').join(logoData); // catch any unprefixed use

// CRITICAL: when inlining a bundle into <script>, any literal "</script" inside
// the JS would terminate the tag early (the HTML parser doesn't know JS). Escape
// it so the browser sees the full module. Same guard for the CSS block.
const guard = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
js = guard(js);
css = guard(css);

// favicon — drop the external ref to keep it single-file & quiet
html = html.replace(/<link[^>]+rel="[^"]*icon[^"]*"[^>]*>/g, '');

// seed script: install the filled report into localStorage BEFORE the app runs,
// only if the user hasn't already created their own reports in this file.
const seedScript = `<script>(function(){try{
  var INDEX='ak_reports_index', CUR='ak_current_report';
  if(!localStorage.getItem(INDEX)){
    var id='r-demo-cedar';
    var rep=${JSON.stringify(SEED)};
    localStorage.setItem('ak_report_'+id, JSON.stringify(rep));
    localStorage.setItem(INDEX, JSON.stringify([{id:id,name:'AKCC-2026-0431 — Cedar Crossing',updatedAt:Date.now()}]));
    localStorage.setItem(CUR, id);
    localStorage.setItem('ak_help_autoshow','0');
  }
}catch(e){console.warn('seed failed',e);}})();</script>`;

// swap external css/js for inlined versions + inject seed before the module.
// IMPORTANT: use FUNCTION replacers — the bundle is full of '$', and a string
// replacement would treat $&, $1, $` etc. as special and corrupt the code.
html = html
  .replace(/<link[^>]+href="(?:\.\/)?assets\/[^"]+\.css"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script[^>]*src="(?:\.\/)?assets\/[^"]+\.js"[^>]*><\/script>/,
           () => `${seedScript}\n<script type="module">${js}</script>`);

fs.writeFileSync(OUT, html);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log('wrote ' + OUT + ' (' + kb + ' KB)');
