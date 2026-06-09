import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import QRGen from './qrcode.js';
import { useAuth } from './lib/useAuth.js';
import { useCloudSync } from './lib/useCloudSync.js';
import { compressImage } from './lib/image.js';
import { ensureLibrary, loadReport, saveReport, removeReport, saveIndex, setCurrentId as persistCurrentId, newId } from './lib/reportsLibrary.js';
import { loadTemplates, saveTemplates, newTemplateId, extractTemplateFields } from './lib/templates.js';
import { buildExampleReport } from './lib/exampleReport.js';
import SyncControl from './SyncControl.jsx';
import { FeedbackButton, VersionToggle } from './DesktopTools.jsx';
import TemplateEditor from './TemplateEditor.jsx';
import StartReportModal from './StartReportModal.jsx';

// ============================================================
// GSSI StructureScan Mini XT — Scan Report Builder v2
// BC-tuned · Tiered deliverables · Executive summary first
// Modeled on Terraprobe / EGBC practice expectations
// ============================================================

const STORAGE_KEY = 'gssi_report_v2';
const CONTACTS_KEY = 'ak_contacts';   // customer/contact directory (cross-report)
const DRAFTS_KEY   = 'ak_drafts';     // named saved reports (cross-report)
const AUTOFILL_KEY = 'ak_autofill';   // remembered sticky fields + recent client/site values
const HELP_AUTOSHOW_KEY = 'ak_help_autoshow'; // whether the Getting Started guide opens on startup
const RECENT_FILES_KEY = 'ak_recent_files';   // desktop: recently opened/saved file paths
const AUTOSAVE_KEY = 'ak_autosave_min';        // desktop/FS: auto-save interval in minutes (0 = off)
const EMAIL_PROVIDER_KEY = 'ak_email_provider'; // preferred webmail/compose target
const SHARE_BACKUP_KEY = 'ak_share_attach_backup'; // attach the .json backup when sharing (default off)
const LAST_SEEN_VERSION_KEY = 'ak_last_seen_version'; // drives the What's-new popup

// Bumped on every release. Each entry is shown by the What's-new modal the
// first time the user opens that version. anchorId points to a DOM id on the
// page so the "Take me there" button can scroll the user to the section.
const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) || '0.0.0';
const CHANGELOG = [
  {
    version: '1.0.14',
    headline: 'Critical fix: the .exe launches again',
    items: [
      { title: 'App no longer crashes on startup', anchorClass: null,
        body: 'v1.0.12 and v1.0.13 shipped a context-menu library that turned out to be ESM-only — Electron\'s main process is CommonJS, so the app threw ERR_REQUIRE_ESM before the window even opened. Pinned the library to the last CommonJS-compatible release (v3.6.1). Right-click → Cut / Copy / Paste / Select All still works exactly as designed.' },
      { title: 'How to recover if you were on v1.0.12 or v1.0.13', anchorClass: null,
        body: 'Auto-update can\'t reach you from a crashed app (the updater runs in the same main process that\'s throwing). Download AK.ScanReport.Setup.exe for v1.0.14 from the GitHub releases page and run it — it installs over the broken version. Your reports survive: localStorage and any saved .akscan files on disk are preserved.' },
    ],
  },
  {
    version: '1.0.13',
    headline: 'Update-safe save: your file is written before an update installs',
    items: [
      { title: 'Auto-update flushes the linked .akscan file too', anchorClass: null,
        body: 'Already supported: File → Save / Save As writes a real .akscan file you can re-open later (great safety net before any update). New in this release: when an auto-update is about to install, the app now persists BOTH the in-app library (localStorage) AND the linked file on disk before letting the update proceed. So the .akscan on your disk is always current when an update lands — nothing lost.' },
      { title: 'How to use the safety net', anchorClass: null,
        body: 'Click 💾 Save on any report → "📌 Choose file & save" → pick a place on your hard drive (Documents, OneDrive, etc.). After that the same Save button writes silently to that file. If anything goes sideways with the app, double-click the .akscan file or use File → Open to load it back exactly as it was — every field, target, core, annotation, photo.' },
    ],
  },
  {
    version: '1.0.12',
    headline: 'Right-click → Copy works, and photo comment input is bulletproof',
    items: [
      { title: 'Right-click → Cut / Copy / Paste / Select All', anchorClass: null,
        body: 'Highlight any text in any field, on any photo comment, anywhere — right-click and the OS menu now appears with Cut, Copy, Paste, Select All, and spell-check suggestions. Electron suppresses the OS menu by default; we wire it up now via electron-context-menu in the main process. Diagram canvas right-click (cancel stroke / straighten edge) still works as before.' },
      { title: 'Inline photo comment box: typing always lands', anchorClass: 'ak-sec-scanPhotos',
        body: 'Boss reported the inline "Comment for this spot" box on photo annotations sometimes wouldn\'t accept keystrokes. Cause was a racy 30 ms focus setTimeout that could lose the race on slower Electron hardware, plus possible event bubbling from the input to the canvas underneath. Replaced with a rAF-driven focus that runs after React commits the DOM, added stopPropagation on the input so pointer events can\'t leak through to the canvas, and added a key prop so each new spot gets a fresh-mounted input.' },
    ],
  },
  {
    version: '1.0.11',
    headline: 'Fix: no more Vercel sign-in prompt on launch',
    items: [
      { title: 'Production builds load the bundled app, not a remote URL', anchorClass: null,
        body: 'On a fresh install the .exe was defaulting to "Test mode" which loads a Vercel preview URL — and that preview is behind Vercel auth, so users hit a sign-in wall before they could even see the app. Production builds now correctly load the bundled Stable app on first launch. Users already trapped in Test mode auto-recover to Stable on next launch. The 🧪 Test toggle still works for power-users who set their own preview URL.' },
    ],
  },
  {
    version: '1.0.10',
    headline: 'Typing is now truly instant — zero state-propagation lag',
    items: [
      { title: 'Removed the last 120 ms gap on input → parent state', anchorClass: null,
        body: 'v1.0.9 used a small 120 ms debounce to keep typing fast. Now using React 18 concurrent rendering (startTransition) instead: the input updates urgently (character shows instantly) AND the parent report state updates on the same keystroke at low priority. So Preview, Save, the assistant — everything that reads from the report — sees your latest typed value within one frame, not after a pause. Heavy tree re-renders still don\'t block typing.' },
    ],
  },
  {
    version: '1.0.9',
    headline: 'Typing is fast again — no more lag in long reports',
    items: [
      { title: 'Inputs no longer re-render the whole report per keystroke', anchorClass: null,
        body: 'Boss flagged sluggish typing in the .exe. Every key was triggering a state update on the giant top-level report, which made React re-render every section card (and every embedded scan photo) on each keystroke. Inputs and Textareas now keep a local copy of what you\'re typing and only push it up to the report state after 120 ms idle or when you tab/click out — typing measured ~4x faster, even more on photo-heavy reports. Autosave, undo, and demo-load still work exactly the same.' },
    ],
  },
  {
    version: '1.0.8',
    headline: 'Preview polish — ribbon glued to top, drag-reorder cards in Preview',
    items: [
      { title: 'Company logo + name pinned to the top in Preview', anchorClass: null,
        body: 'Brand ribbon was hidden in Preview (rule missing). Now it sits at the very top of the report — clean strip with the logo, the company name in black, and "Know before you cut." in red. Not wrapped in a card, just glued to the top exactly like the PDF.' },
      { title: 'Drag any card in Preview to reorder it', anchorClass: null,
        body: 'In Preview mode, grab any section card and drop it above/below another — the new order saves to sectionOrder immediately and persists. Cursor turns into grab, red drop-indicator shows where the card will land. Cards stay column-aligned (no horizontal drift).' },
      { title: '👁 Preview shortcut in the Setup bar', anchorClass: null,
        body: 'New "👁 Preview saved PDF" button right at the top — no more scrolling into Print setup to preview. One tap from anywhere on the page.' },
    ],
  },
  {
    version: '1.0.7',
    headline: 'Saved PDF — polished output, no more dark theme in the print',
    items: [
      { title: 'White pages, black text in the PDF', anchorClass: null,
        body: 'The dark editor theme was bleeding into saved PDFs — most pages came out almost entirely black with tiny content. Fixed two CSS bugs (missing @media print wrapper around page-break rules + no print override for inline card backgrounds). Pages now print as clean white paper with readable black text. Color swatches and the brand-red headers still print in colour.' },
      { title: 'Preview now matches what saves to PDF', anchorClass: null,
        body: 'Hit 👁 Preview before saving — what you see is exactly what lands in the file. Same dark-theme kill applied, so the engineer can confirm the report is polished before sending.' },
      { title: 'Markup color key card was being skipped', anchorClass: null,
        body: 'The APWA color key was the only card not wired into the section system, so the print rules missed it entirely. Now wrapped properly — its swatches print clean alongside everything else.' },
    ],
  },
  {
    version: '1.0.6',
    headline: 'Workflow polish — collapse setup, drag-reorder sections, jump nav, photo prompt',
    items: [
      { title: 'Setup cards collapse at top', anchorId: null,
        body: 'Report tier / Sections / Print setup are now hidden behind a single ⚙ Setup toggle by default, so Project info is right at the top of the page. Tap ⚙ Setup to expand when you need to change tier or reorder sections. Your choice is remembered.' },
      { title: 'Drag-and-drop section reorder', anchorClass: null,
        body: 'Expand ⚙ Setup → Print setup. Grab any section row (cursor turns into a grab handle, drag icon ⋮⋮ on the left) and drop it anywhere — the print order updates instantly. ▲▼ buttons still work for fine-tuning.' },
      { title: 'Floating 📑 Sections jump-menu', anchorClass: null,
        body: 'Bottom-right corner has a 📑 Sections button. Tap it for a list of every visible section. Tap a name → smooth-scroll right to it. Stops the scroll-hunt on long reports.' },
      { title: 'Photo upload asks before opening editor', anchorClass: 'ak-sec-scanPhotos',
        body: 'After uploading a scan photo, a small "Open annotation editor for this photo? [Annotate now] [Not now]" banner appears next to it. Tap Annotate now to jump straight into markup; tap Not now to keep working on something else.' },
    ],
  },
  {
    version: '1.0.5',
    headline: 'Photo annotations: text comments work on .exe',
    items: [
      { title: 'T Text tool now opens an inline comment box', anchorClass: 'ak-sec-scanPhotos',
        body: 'On a scan photo, hit 🖊 Annotate → pick T Text → tap the photo where you want a comment. A small input pops up at the tap point — type the comment and hit Enter. Tap somewhere else to commit and add another. Works on both the web build and the installed .exe.' },
      { title: 'Arrow + comment workflow (already there)', anchorClass: 'ak-sec-scanPhotos',
        body: 'Use the → Arrow tool to point at the spot, then T Text to attach a comment nearby. Both share colors and presets. The PDF embeds both.' },
    ],
  },
  {
    version: '1.0.4',
    headline: 'Pin tool fix — works in the installed app',
    items: [
      { title: 'Pin core now drops on tap (desktop fix)', anchorClass: 'ak-sec-diagram',
        body: 'The old verdict prompt used window.prompt() which Electron disables — so on the installed .exe taps did nothing. Replaced with a verdict picker (Safe / Caution / No-go) in the toolbar. Pick one, tap the diagram, pin drops with that verdict. Switch verdicts between drops for mixed sets.' },
      { title: 'Zone label is now an inline field', anchorClass: 'ak-sec-diagram',
        body: 'Same prompt() issue — zone labels were defaulting to Z1/Z2 with no way to rename on the .exe. Now there\'s a label input in the zone toolbar after you drag a box. Edit before tapping Save, or leave it as the default.' },
      { title: 'Regression test covers every diagram tool', anchorClass: null,
        body: 'gssi-report-app/tests/diagram-tools.test.mjs exercises Pin/Rebar/PT/Conduit/Note/Crack/Zone/Pick — so the next time a tool quietly breaks, CI catches it before you do.' },
    ],
  },
  {
    version: '1.0.3',
    headline: 'Diagram polish + auto-template + What\'s new popup',
    items: [
      { title: 'Caption typing & copy/paste fixed', anchorClass: 'ak-sec-scanPhotos',
        body: 'On scan photos the caption field was eating keystrokes and losing the selection on long-press. Now types like a normal field — try copy/paste on any caption.' },
      { title: 'Remove-photo moved off the diagram', anchorClass: 'ak-sec-diagram',
        body: 'The ✕ Remove photo button no longer sits on top of your sketch. It\'s in the toolbar under the canvas now.' },
      { title: 'Right-click / Esc cancels mid-task', anchorClass: 'ak-sec-diagram',
        body: 'Right-click the diagram (or hit Esc) to cancel an in-progress line, zone draft, or selection. One press = one undo step.' },
      { title: 'Auto-template at report start', anchorId: 'btn-new-report',
        body: 'When you tap + New report, pick a saved client/template and see a preview of what gets filled in before you commit.' },
      { title: 'Drawable zones — box + curves', anchorClass: 'ak-sec-diagram',
        body: 'In Zone mode you can drag a box, then bend each edge into a curve or pull corners around for irregular slabs.' },
      { title: 'What\'s new popup (this dialog)',
        body: 'Auto-opens on launch when there\'s a new version, so you always know what changed. Tap Take me there to jump straight to a section.' },
    ],
  },
  {
    version: '1.0.2',
    headline: 'Scan-photo caption fix',
    items: [
      { title: 'Caption typing + copy/paste on mobile', anchorClass: 'ak-sec-scanPhotos',
        body: 'Controlled-textarea was fighting the Android keyboard. Made it uncontrolled so typing/select/copy/paste behave natively.' },
    ],
  },
];

// Semver compare a.b.c → -1/0/1. Treats malformed strings as 0.
function compareVersions(a, b) {
  const pa = String(a || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// Web-mail "compose" deep links that pre-fill To/Subject/Body. Sources:
//   Gmail   - mail.google.com/mail/?view=cm
//   Outlook - outlook.office.com / outlook.live.com .../deeplink/compose
//   Yahoo   - compose.mail.yahoo.com
const EMAIL_PROVIDERS = [
  { id: 'mailto', label: 'Default mail app' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'outlook', label: 'Outlook / Office 365' },
  { id: 'outlook-personal', label: 'Outlook.com / Hotmail' },
  { id: 'yahoo', label: 'Yahoo Mail' },
];
const composeUrl = (provider, to, subject, body) => {
  const t = encodeURIComponent(to || '');
  const s = encodeURIComponent(subject || '');
  const b = encodeURIComponent(body || '');
  switch (provider) {
    case 'gmail':
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${t}&su=${s}&body=${b}`;
    case 'outlook':
      return `https://outlook.office.com/mail/deeplink/compose?to=${t}&subject=${s}&body=${b}`;
    case 'outlook-personal':
      return `https://outlook.live.com/mail/0/deeplink/compose?to=${t}&subject=${s}&body=${b}`;
    case 'yahoo':
      return `https://compose.mail.yahoo.com/?to=${t}&subject=${s}&body=${b}`;
    default:
      return `mailto:${t}?subject=${s}&body=${b}`;
  }
};

// Fields that repeat job-to-job — carried forward into a new/blank report so the
// technician doesn't re-key equipment, calibration, sign-off and legal text every time.
const STICKY_FIELDS = [
  'scanner', 'antenna', 'serialNo', 'firmware',
  'scanMode', 'dielectric', 'scanDensity', 'depthRange',
  'preparedBy', 'preparedRole', 'preparedCert',
  'reviewedBy', 'reviewedRole', 'egbcEnabled', 'permitNo',
  'legalDisclaimer', 'limitations', 'standardNotes',
  'coreStandoff', 'enableColorLegend', 'enableConfidenceBand',
  'brandFlourishes', 'qrUrl', 'drawingScale',
];

// Safe JSON-backed localStorage helpers (no-op if storage is blocked).
const lsGet = (key, fallback) => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
};
const lsSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// Push a value to the front of a recents list, de-duped and capped.
const uniqTop = (arr, val, cap = 8) => {
  const v = (val || '').trim();
  const base = (arr || []).filter(Boolean);
  if (!v) return base.slice(0, cap);
  return [v, ...base.filter(x => x !== v)].slice(0, cap);
};

// Swap an array item with its neighbour in the given direction (-1 up, +1 down).
const moveInArray = (arr, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

// Make a value safe and tidy for use inside a file name.
const slugify = (s, cap = 40) => (s || '')
  .trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, cap);

// Subtle company tagline used by the optional Brand Flourishes flag.
// Plays on the company name (cutting & coring) and what GPR actually does.
const BRAND_TAGLINE = 'Know before you cut.';

// Logo lives in public/. Routed through BASE_URL so it resolves both on the web
// (served at "/") and in the desktop build (loaded from a file:// path).
const LOGO_SRC = `${import.meta.env.BASE_URL}kamikaze-logo.png`;

// Dev-only debug fixture — loaded by the 🧪 Demo button in the setup bar
// (visible only in `npm run dev`, stripped from prod builds). Lets the
// engineer fill a realistic report in one tap so they can hit 👁 Preview
// immediately and iterate on PDF styling without hand-typing every field.
const DEMO_REPORT = {
  tier: 'full',
  projectNo: 'AKCC-2026-0518',
  jobNote: 'P2 parkade — Bay 14 slab penetration set',
  scanDate: '2026-05-26',
  client: 'Stuart Olson Construction',
  siteAddress: '1133 Melville St, Vancouver BC',
  scanArea: 'P2 parkade slab — between gridlines C-D / 4-5, total 22 sqm',
  weather: '14°C overcast, slab dry',
  surface: 'Dry',
  slabThickness: '300 mm (per as-built)',
  slabAge: '> 30 days cured',
  scanCoverage: '100%',
  serialNo: 'XMT-7741',
  firmware: '4.0.2',
  uncertaintyZones:
    'Near east column footing (NE corner of scan area): rebar congestion gives ' +
    'overlapping reflections — depth confidence below 200 mm is reduced. Daylight ' +
    'verify before any core in that 0.5 m radius.',
  workflow: {
    scanComplete:      '2026-05-26T09:45',
    reportIssued:      '2026-05-26T11:30',
    clearedForCoring:  '',
  },
  // Targets use schema: { id, type, depth, cover, note, confidence } — match
  // addTarget() in the component or React renderers crash.
  targets: [
    { id: 'T-01', type: 'Rebar (top mat)',    depth: '50',  cover: '50',  confidence: 'high', note: '#4 @ 200 mm o/c' },
    { id: 'T-02', type: 'Rebar (bottom mat)', depth: '230', cover: '70',  confidence: 'high', note: '#5 @ 250 mm o/c' },
    { id: 'T-03', type: 'Post-tension cable', depth: '135', cover: '',    confidence: 'high', note: 'Two cables E-W, ~600 mm apart' },
    { id: 'T-04', type: 'Conduit / unknown',  depth: '210', cover: '',    confidence: 'med',  note: '~25 mm dia, N-S near east edge' },
  ],
  // Cores use schema: { label, size, verdict, clearance, note }
  cores: [
    { label: 'A', size: '4"', verdict: 'safe',    clearance: '60 mm', note: 'Clear of all targets' },
    { label: 'B', size: '6"', verdict: 'caution', clearance: '25 mm', note: 'PT cable within 25 mm — relocate 75 mm S' },
    { label: 'C', size: '4"', verdict: 'nogo',    clearance: '0',     note: 'Directly over conduit; redesign required' },
  ],
  brandFlourishes: true,
  enableColorLegend: true,
};

const DEFAULT_REPORT = {
  // Tier
  tier: 'standard',  // quick | standard | full

  // Assistant UI
  assistantOn: true,
  customReminders: [],  // [{ id, text, level: 'high'|'med'|'low' }]

  // Report status — drives the DRAFT watermark on PDF/print exports.
  // 'draft' (default) stamps a diagonal DRAFT watermark; 'issued' exports clean.
  status: 'draft',       // 'draft' | 'issued' | 'approved' (approved = locked & archived)

  // Cover
  projectNo: '',
  jobNote: '',           // short description used to make saved file names recognizable
  scanDate: new Date().toISOString().slice(0, 10),
  client: '',
  siteAddress: '',
  scanArea: '',
  weather: '',
  surface: 'Dry',

  // NEW: Slab context (engineers always check these)
  slabThickness: '',
  slabAge: '',           // e.g. ">30 days cured" or "New pour"
  scanCoverage: '100%',  // % of area scanned

  // Equipment
  scanner: 'GSSI StructureScan Mini XT',
  antenna: '2.7 GHz integrated',
  serialNo: '',
  firmware: '',

  // Calibration
  scanMode: 'Scan3D',
  dielectric: '6.5',
  scanDensity: '3 scans/cm',
  depthRange: '0 – 600 mm',

  // Findings
  targets: [],

  // Site diagram
  diagramImage: null,
  diagramImageUrl: null,   // cloud copy: site image fetched from Storage
  diagramImagePath: null,  // Storage path for the site image
  diagramStrokes: [],
  diagramPins: [],

  // Scan photos (embedded in PDF)
  scanPhotos: [],

  // Scan locations (per-location card with notes + annotated photo)
  scanLocations: [],

  // Cores
  cores: [],

  // NEW: Areas of uncertainty (Terraprobe-style)
  uncertaintyZones: '',

  // Legal disclaimer (printed at the end of every report)
  legalDisclaimer:
    'This report is a non-destructive subsurface investigation prepared by ' +
    'Aggarwal Kamikaze\'s Cutting & Coring Ltd (the "Company") for the named client only. ' +
    'Ground Penetrating Radar is an interpretive method; subsurface conditions may differ ' +
    'from those depicted, and the Company makes no warranty, express or implied, regarding ' +
    'the absence of utilities, conduits, post-tensioning cables, reinforcing steel, voids, ' +
    'or other features not detected at the time of scan. The client is solely responsible ' +
    'for verifying all marked and unmarked features prior to coring, cutting, drilling, ' +
    'or excavation — including by physical exposure (daylighting) wherever any risk to ' +
    'embedded services exists. The Company\'s total aggregate liability arising from or ' +
    'related to this report, regardless of cause of action, is limited to the fees paid ' +
    'for the scanning service. This report is valid only for the scan area, date, ' +
    'equipment, and conditions specified herein; subsequent modifications to the structure ' +
    'or surrounding area void these findings.',

  // Limitations (BC-tuned defaults)
  limitations: [
    'Depths derived from assumed dielectric constant; actual depths may vary ±10%.',
    '2.7 GHz antenna effective depth approx. 600 mm; targets below this depth not assessed.',
    'T-R offset creates a 0–58 mm near-surface resolution zone; shallow targets verified visually where possible.',
    'GPR interpretation is inherently subjective; results reflect best technical judgment at time of scan.',
    'Findings are not a substitute for as-built drawings or destructive verification (daylighting).',
    'Report is valid only for the scan area and date specified. Subsequent modifications void findings.',
  ],

  // Sign-off (BC practice: tech prepares, engineer reviews)
  preparedBy: '',
  preparedRole: 'Certified GPR Technician',
  preparedCert: '',     // e.g. Decifer cert #
  reviewedBy: '',
  reviewedRole: 'Engineer of Record',
  egbcEnabled: false,   // Off by default — most scan reports aren't P.Eng stamped
  permitNo: '',
  signDate: new Date().toISOString().slice(0, 10),
  // Editable closing line printed at the very bottom (brand flourish). Crews can
  // set their own sign-off / company saying.
  footerTagline: 'Prepared with care by the AKCC crew · Know before you cut.',
  // Small print-footer sub-line (equipment / edition). Editable; clear to hide.
  footerSubline: 'GSSI StructureScan Mini XT · British Columbia engineering edition',

  // Engineer approval (F3). Set when the engineer approves by email; status
  // moves to 'approved' and the report is flagged archived in the reports list.
  approvedBy: '',
  approvedDate: '',
  showWatermark: true,   // DRAFT / FOR REVIEW watermark on the PDF (off = clean)

  // ----- Xradar-style togglable features -----
  enableZones: false,         // hatched fill regions on the site diagram
  enableCadPage: false,       // landscape "drawing" page with title block
  enableStandardNotes: false, // numbered general-notes block alongside the diagram
  enableNamedZones: false,    // group scan locations under named zones (e.g. "Back of House")
  brandFlourishes: false,     // subtle company-personality ribbon + footer sig on the PDF
  enableColorLegend: true,    // print the APWA-aligned markup color key
  enableConfidenceBand: true, // roll per-core confidence into an overall band on the summary
  coreStandoff: '25 mm',      // recommended standoff margin to keep off any marked target
  enableQR: false,            // stamp a QR code on the report (off by default)
  qrUrl: 'https://scan-report.vercel.app', // what the QR points to

  diagramZones: [],           // graphical hatched/filled polygons on the diagram
  diagramNotes: '',           // project-specific notes column on the CAD page
  drawingScale: '1 : 50',
  drawingNo: '',
  zones: [],                  // organizational zones (Back of House, Zone 4...)
  standardNotes: [
    'GPR is an interpretive method; subsurface conditions may differ from those depicted.',
    'Depths are derived from an assumed dielectric constant. Actual depths may vary ±10%.',
    'All marked locations must be verified by daylighting (small exploratory hole) before coring or cutting.',
    'The 2.7 GHz antenna has an effective depth of approximately 600 mm. Targets below this depth are not assessed.',
    'T-R offset creates a 0–58 mm near-surface resolution zone; shallow targets verified visually where possible.',
    'Service channels and post-tensioning cables shall be treated as live until physically confirmed inactive.',
    'Slab-band hatched areas are NOT suitable for coring, drilling, or anchoring without engineer approval.',
    'Report is valid only for the scan area, date, equipment and conditions specified herein.',
  ],

  // ----- Engineered-deliverable extras (Xradar / GPRS / United Scanning) -----
  methodsOverride: '',        // when set, replaces the auto-generated methods paragraph
  coverSummary: {
    topMin: '', topAvg: '', topTarget: '',
    botMin: '', botAvg: '', botTarget: '',
    note: '',
    autoFromTargets: true,
  },
  workflow: {
    scanComplete: '',         // 'YYYY-MM-DDTHH:MM' (datetime-local)
    reportIssued: '',
    clearedForCoring: '',
  },

  // Per-section include/exclude for PDF export.
  // Empty object means "all sections on" — only exclusions are stored.
  // Section ids match the SECTION_IDS list rendered in the Print setup card.
  sectionVisibility: {},

  // Custom print order for sections (list of section ids). Empty = default
  // SECTION_IDS order. Missing ids fall back to their default position.
  sectionOrder: [],
};

// ============================================================
// Design tokens — Aggarwal Kamikaze's palette (light + dark)
// Token values are CSS variables so theme switches without a
// React re-render. See <ThemeStyles /> for the palette definitions
// and the data-theme="light" overrides for outdoor readability.
// ============================================================

const c = {
  bg:           'var(--ak-bg)',
  bgRaised:     'var(--ak-bg-raised)',
  card:         'var(--ak-card)',
  cardAlt:      'var(--ak-card-alt)',
  border:       'var(--ak-border)',
  borderStrong: 'var(--ak-border-strong)',
  text:         'var(--ak-text)',
  textDim:      'var(--ak-text-dim)',
  textFaint:    'var(--ak-text-faint)',
  accent:       'var(--ak-accent)',
  accentDim:    'var(--ak-accent-dim)',
  onAccentDim:  'var(--ak-on-accent-dim)',  // text/icon on accent-dim bg
  green:        'var(--ak-green)',
  greenBg:      'var(--ak-green-bg)',
  greenStrong:  'var(--ak-green-strong)',
  amber:        'var(--ak-amber)',
  amberBg:      'var(--ak-amber-bg)',
  amberStrong:  'var(--ak-amber-strong)',
  red:          'var(--ak-red)',
  redBg:        'var(--ak-red-bg)',
  redStrong:    'var(--ak-red-strong)',
};

function ThemeStyles() {
  return (
    <style>{`
      :root, :root[data-theme="dark"] {
        --ak-bg:            #14171c;
        --ak-bg-raised:     #1a1e24;
        --ak-card:          #1e232a;
        --ak-card-alt:      #242a32;
        --ak-border:        #2c333c;
        --ak-border-strong: #3a4250;
        --ak-text:          #e8e4dc;
        --ak-text-dim:      #a8a59e;
        --ak-text-faint:    #6e6c66;
        --ak-accent:        #d44545;
        --ak-accent-dim:    #5a1c1f;
        --ak-on-accent-dim: #f4ece0;
        --ak-green:         #4fb86a;
        --ak-green-bg:      #16291e;
        --ak-green-strong:  #6cd082;
        --ak-amber:         #d9a35a;
        --ak-amber-bg:      #2a2114;
        --ak-amber-strong:  #ecbf6e;
        --ak-red:           #d44545;
        --ak-red-bg:        #2c1818;
        --ak-red-strong:    #e96868;
      }
      :root[data-theme="light"] {
        --ak-bg:            #f6f3ec;
        --ak-bg-raised:     #ede9df;
        --ak-card:          #fbf8f1;
        --ak-card-alt:      #e8e4d8;
        --ak-border:        #cfcabc;
        --ak-border-strong: #9c9685;
        --ak-text:          #1f1d18;
        --ak-text-dim:      #46423a;
        --ak-text-faint:    #6e6a5e;
        --ak-accent:        #a32626;
        --ak-accent-dim:    #f0d4d2;
        --ak-on-accent-dim: #5e1416;
        --ak-green:         #2b6e3a;
        --ak-green-bg:      #d8ecdc;
        --ak-green-strong:  #1d5028;
        --ak-amber:         #7a5510;
        --ak-amber-bg:      #f4e4c4;
        --ak-amber-strong:  #5e4308;
        --ak-red:           #a32626;
        --ak-red-bg:        #efd8d6;
        --ak-red-strong:    #7c1818;
      }
      html, body, #root { background: var(--ak-bg); color: var(--ak-text); }
    `}</style>
  );
}

// ============================================================
// UI Primitives
// ============================================================

const Card = ({ title, badge, children, dense, accent, className, style }) => (
  <div className={className} style={{
    background: c.card,
    border: `1px solid ${accent ? c.accent : c.border}`,
    borderRadius: 10,
    padding: dense ? 12 : 14,
    marginBottom: 12,
    ...(accent && { boxShadow: `0 0 0 1px ${c.accentDim}` }),
    ...style,
  }}>
    {title && (
      <div className="ak-card-head" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, paddingBottom: 8,
        borderBottom: `1px solid ${c.border}`,
      }}>
        <h2 style={{
          margin: 0, fontSize: 13, fontWeight: 700,
          color: accent ? c.accent : c.textDim,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>{title}</h2>
        {badge}
      </div>
    )}
    {children}
  </div>
);

const Field = ({ label, children, hint, className }) => (
  <div className={className} style={{ marginBottom: 10 }}>
    <div style={{
      fontSize: 12, color: c.textDim, marginBottom: 4,
      textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
    }}>{label}</div>
    {children}
    {hint && <div className="no-print" style={{ fontSize: 12.5, color: c.textFaint, marginTop: 4 }}>{hint}</div>}
  </div>
);

// Shared input hook for Input/Textarea — truly-instant typing.
// Whole report lives in one giant useState; a naive controlled <input>
// would call setReport per keystroke and re-render the entire ~7500-line
// tree (that was the v1.0.8 lag your boss reported).
//
// Strategy now: keep a local copy of the typed value (urgent) AND push
// to the parent on the SAME keystroke wrapped in React.startTransition.
// React 18 then:
//   1. Commits the local-state change urgently → character shows on screen
//      with zero perceptible delay
//   2. Commits the heavy tree re-render at low priority → never blocks
//      the next keystroke even on photo-heavy reports
// Net: input feels instant AND the parent report state is in sync within
// one frame. No 120 ms debounce. onBlur flushes synchronously so clicking
// Save right after typing always sees the latest value.
function useInstantFieldValue(value, onChange, onBlur) {
  const [local, setLocal] = useState(value ?? '');
  const lastExternal = useRef(value);

  // Sync DOWN on external changes (demo load, undo, switching reports).
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setLocal(value ?? '');
    }
  }, [value]);

  const onLocalChange = (e) => {
    const v = e.target.value;
    setLocal(v);                     // urgent: input shows the char instantly
    lastExternal.current = v;        // suppress the down-sync on the matching prop update
    if (onChange) {
      React.startTransition(() => {  // low-priority: heavy tree re-render
        onChange({ target: { value: v }, currentTarget: { value: v } });
      });
    }
  };

  // Blur is the user moving focus elsewhere — commit synchronously so a
  // Save / Submit click right after typing sees the latest value, no race
  // with the transition.
  const onLocalBlur = (e) => {
    if (onBlur) onBlur(e);
  };

  return { local, onLocalChange, onLocalBlur };
}

const Input = ({ value, onChange, onBlur, ...rest }) => {
  const { local, onLocalChange, onLocalBlur } = useInstantFieldValue(value, onChange, onBlur);
  return (
    <input {...rest} value={local} onChange={onLocalChange} onBlur={onLocalBlur} style={{
      width: '100%', background: c.cardAlt,
      border: `1px solid ${c.border}`, borderRadius: 6,
      padding: '10px 12px', color: c.text, fontSize: 16,
      fontFamily: 'inherit', boxSizing: 'border-box',
      ...rest.style,
    }} />
  );
};

const Textarea = ({ value, onChange, onBlur, ...rest }) => {
  const { local, onLocalChange, onLocalBlur } = useInstantFieldValue(value, onChange, onBlur);
  return (
    <textarea {...rest} value={local} onChange={onLocalChange} onBlur={onLocalBlur} style={{
      width: '100%', background: c.cardAlt,
      border: `1px solid ${c.border}`, borderRadius: 6,
      padding: '10px 12px', color: c.text, fontSize: 16,
      fontFamily: 'inherit', boxSizing: 'border-box',
      resize: 'vertical', minHeight: 64,
      ...rest.style,
    }} />
  );
};

// Textarea that auto-resizes to fit its content (no internal scrollbar)
function AutoGrowTextarea({ value, onChange, className, style, placeholder }) {
  const ref = useRef(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(fit, [value]);
  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  // If the caller already renders its own print output (it marks the textarea
  // 'no-print' and prints a sibling, e.g. the legal disclaimer), don't add a
  // second mirror — that would duplicate the text in the PDF.
  const ownsPrint = (className || '').includes('no-print');
  return (
    <>
      <textarea
        ref={ref}
        className={`${className || ''} no-print`.trim()}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onInput={fit}
        style={{
          width: '100%', background: c.cardAlt,
          border: `1px solid ${c.border}`, borderRadius: 6,
          padding: '11px 13px', color: c.text, fontSize: 15, lineHeight: 1.55,
          fontFamily: 'inherit', boxSizing: 'border-box',
          resize: 'none', overflow: 'hidden',
          ...style,
        }}
      />
      {/* Print mirror: a real flowing <div> so long text paginates across page
          breaks instead of being clipped by the unbreakable <textarea> box
          (the classic "info lost between pages"). Screen shows the textarea. */}
      {!ownsPrint && (
        <div className="print-only ak-ta-print" style={{
          width: '100%', border: '1px solid #98a0aa', borderRadius: 6,
          padding: '11px 13px', fontSize: 15, lineHeight: 1.55,
          whiteSpace: 'pre-wrap', boxSizing: 'border-box', ...style,
        }}>{value}</div>
      )}
    </>
  );
}

const Select = ({ children, ...props }) => (
  <select {...props} style={{
    width: '100%', background: c.cardAlt,
    border: `1px solid ${c.border}`, borderRadius: 6,
    padding: '10px 12px', color: c.text, fontSize: 16,
    fontFamily: 'inherit', boxSizing: 'border-box',
    ...props.style,
  }}>{children}</select>
);

const Btn = ({ children, variant = 'default', ...props }) => {
  const v = {
    default: { bg: c.cardAlt, bd: c.borderStrong, fg: c.text },
    primary: { bg: c.accentDim, bd: c.accent, fg: c.onAccentDim },
    danger:  { bg: c.redBg, bd: c.red, fg: c.redStrong },
    ghost:   { bg: 'transparent', bd: c.border, fg: c.textDim },
  }[variant];
  return (
    <button {...props} style={{
      background: v.bg, border: `1px solid ${v.bd}`,
      borderRadius: 6, padding: '10px 14px', color: v.fg,
      fontSize: 15, fontWeight: 500, cursor: 'pointer',
      fontFamily: 'inherit',
      ...props.style,
    }}>{children}</button>
  );
};

// ============================================================
// Executive Summary — the headline at the top
// ============================================================

function ExecutiveSummary({ report }) {
  const stats = useMemo(() => {
    const safe = report.cores.filter(x => x.verdict === 'safe').length;
    const caution = report.cores.filter(x => x.verdict === 'caution').length;
    const nogo = report.cores.filter(x => x.verdict === 'nogo').length;
    const targets = report.targets.length;
    return { safe, caution, nogo, targets, total: report.cores.length };
  }, [report.cores, report.targets]);

  // Overall confidence = the lowest per-core confidence (weakest link governs)
  const confidence = useMemo(() => {
    const cs = (report.cores || []).map(x => x.confidence || 'high');
    if (cs.length === 0) return null;
    if (cs.includes('low')) return 'low';
    if (cs.includes('med')) return 'med';
    return 'high';
  }, [report.cores]);
  // Solid fill + white text so the pill stays legible on screen (dark theme) and
  // in the printed PDF — the old translucent dark-green bg made HIGH unreadable.
  const confMeta = {
    high: { label: 'HIGH',   color: '#fff', bg: '#1a7f37' },
    med:  { label: 'MEDIUM', color: '#fff', bg: '#b07400' },
    low:  { label: 'LOW',    color: '#fff', bg: '#c0282d' },
  }[confidence] || null;

  const overallVerdict =
    stats.nogo > 0 ? 'ATTENTION REQUIRED' :
    stats.caution > 0 ? 'PROCEED WITH CAUTION' :
    stats.total > 0 ? 'CLEARED FOR WORK' :
    'NO VERDICTS YET';

  const verdictColor =
    stats.nogo > 0 ? c.red :
    stats.caution > 0 ? c.amber :
    stats.total > 0 ? c.green : c.textDim;

  const verdictBg =
    stats.nogo > 0 ? c.redBg :
    stats.caution > 0 ? c.amberBg :
    stats.total > 0 ? c.greenBg : c.cardAlt;

  return (
    <Card title="Executive summary" accent>
      <div style={{
        background: verdictBg,
        border: `1px solid ${verdictColor}`,
        borderRadius: 8, padding: '12px 14px', marginBottom: 12,
      }}>
        <div style={{
          fontSize: 10, color: c.textDim, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 4,
        }}>Overall verdict</div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: verdictColor,
          letterSpacing: 0.3,
        }}>{overallVerdict}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <StatTile color={c.green} bg={c.greenBg} value={stats.safe} label="Safe" />
        <StatTile color={c.amber} bg={c.amberBg} value={stats.caution} label="Caution" />
        <StatTile color={c.red} bg={c.redBg} value={stats.nogo} label="No-go" />
      </div>

      <div style={{
        background: c.cardAlt, borderRadius: 6, padding: 10,
        fontSize: 13, color: c.text, lineHeight: 1.5,
      }}>
        <strong style={{ color: c.textDim, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Site:
        </strong>{' '}
        {report.siteAddress || '—'}<br/>
        <strong style={{ color: c.textDim, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Area:
        </strong>{' '}
        {report.scanArea || '—'}<br/>
        <strong style={{ color: c.textDim, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Targets located:
        </strong>{' '}
        {stats.targets} · <strong style={{ color: c.textDim, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Cores assessed:
        </strong>{' '}
        {stats.total}
        {report.enableConfidenceBand && confMeta && (
          <>
            <br/>
            <strong style={{ color: c.textDim, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Overall confidence:
            </strong>{' '}
            <span style={{
              display: 'inline-block', padding: '1px 8px', borderRadius: 4,
              background: confMeta.bg, color: confMeta.color,
              fontWeight: 700, fontSize: 12, letterSpacing: 0.5,
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            }}>{confMeta.label}</span>
          </>
        )}
        {report.coreStandoff && (
          <>
            <br/>
            <strong style={{ color: c.textDim, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Standoff margin:
            </strong>{' '}
            Keep all coring/cutting at least <strong>{report.coreStandoff}</strong> clear of any marked target. Daylight to verify before drilling.
          </>
        )}
      </div>
    </Card>
  );
}

const StatTile = ({ color, bg, value, label }) => (
  <div style={{
    background: bg, border: `1px solid ${color}40`,
    borderRadius: 6, padding: '10px 8px', textAlign: 'center',
  }}>
    <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
  </div>
);

// "At a glance" rail (editor-only). Each verdict row is clickable: it expands a
// list of the matching core chips, and tapping a chip smooth-scrolls to that
// core's editor card and briefly flashes it — a quick jump while rewriting.
function AtAGlanceRail({ cores, targets }) {
  const [open, setOpen] = useState(null); // 'safe' | 'caution' | 'nogo' | null
  const cc = cores.reduce((a, co) => { a[co.verdict] = (a[co.verdict] || 0) + 1; return a; }, {});
  const rows = [
    { key: 'safe',    label: 'Safe',    n: cc.safe || 0,    color: c.greenStrong },
    { key: 'caution', label: 'Caution', n: cc.caution || 0, color: c.amberStrong },
    { key: 'nogo',    label: 'No-go',   n: cc.nogo || 0,    color: c.redStrong },
  ];
  const cell = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 7,
    padding: '7px 10px', font: 'inherit', textAlign: 'left', boxSizing: 'border-box',
  };
  const jumpTo = (i) => {
    const el = document.getElementById('core-card-' + i);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('jump-flash');
    void el.offsetWidth; // restart the animation on repeat clicks
    el.classList.add('jump-flash');
    setTimeout(() => el.classList.remove('jump-flash'), 1600);
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map(r => {
        const items = cores.map((co, i) => ({ co, i })).filter(x => x.co.verdict === r.key);
        const expandable = r.n > 0;
        const isOpen = open === r.key && expandable;
        return (
          <div key={r.key}>
            <button type="button" disabled={!expandable}
              onClick={() => setOpen(isOpen ? null : r.key)}
              aria-expanded={isOpen}
              style={{ ...cell, width: '100%',
                cursor: expandable ? 'pointer' : 'default',
                borderColor: isOpen ? r.color : c.border }}>
              <span style={{ fontSize: 12, color: c.textDim, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 9, width: 8, color: c.textFaint }}>{expandable ? (isOpen ? '▾' : '▸') : ''}</span>
                {r.label}
              </span>
              <b style={{ fontSize: 16, color: r.color }}>{r.n}</b>
            </button>
            {isOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '7px 2px 3px' }}>
                {items.map(({ co, i }) => (
                  <button key={i} type="button" onClick={() => jumpTo(i)}
                    title={[co.size, co.clearance, co.note].filter(Boolean).join(' · ') || 'Jump to core'}
                    style={{ fontSize: 12, fontWeight: 700, color: r.color,
                      background: c.cardAlt, border: `1px solid ${c.border}`,
                      borderRadius: 6, padding: '4px 9px', cursor: 'pointer', font: 'inherit' }}>
                    {co.label || (i + 1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={cell}>
        <span style={{ fontSize: 12, color: c.textDim }}>Cores · Targets</span>
        <b style={{ fontSize: 14, color: c.text }}>{cores.length} · {targets.length}</b>
      </div>
    </div>
  );
}

// ============================================================
// Site Diagram (photo + sketch + pins)
// ============================================================

// Hatched-zone styles. Shared between the live editor canvas and the
// print-only CAD-page snapshot canvas.
const ZONE_PATTERNS = {
  'hatch-red':       { color: '#e02020', label: 'Red hatch — not suitable for coring',  angle: 45 },
  'hatch-yellow':    { color: '#e0a020', label: 'Yellow hatch — service channel',        angle: 135 },
  'fill-amber':      { color: '#e0a020', label: 'Amber fill — caution',                  angle: null },
  'dashed-boundary': { color: '#9BC5E8', label: 'Dashed boundary — complete-scan area',  angle: 'dashed' },
};

function buildZonePattern(ctx, patternId) {
  const meta = ZONE_PATTERNS[patternId];
  if (!meta) return null;
  const tile = document.createElement('canvas');
  tile.width = 14; tile.height = 14;
  const tctx = tile.getContext('2d');
  if (meta.angle === null) {
    tctx.fillStyle = meta.color;
    tctx.globalAlpha = 0.22;
    tctx.fillRect(0, 0, 14, 14);
  } else if (meta.angle === 'dashed') {
    // no fill
  } else {
    tctx.strokeStyle = meta.color;
    tctx.lineWidth = 2;
    tctx.lineCap = 'round';
    const a = meta.angle === 45;
    tctx.beginPath();
    if (a) {
      tctx.moveTo(-2, 16); tctx.lineTo(16, -2);
      tctx.moveTo(4, 18);  tctx.lineTo(18, 4);
    } else {
      tctx.moveTo(-2, -2); tctx.lineTo(16, 16);
      tctx.moveTo(-2, 12); tctx.lineTo(4, 18);
    }
    tctx.stroke();
  }
  return ctx.createPattern(tile, 'repeat');
}

// Pure rendering of the site diagram into any canvas context.
// Used by both the live editor (SiteDiagram) and the CAD-page snapshot.
function drawSiteDiagramTo(ctx, W, H, report, opts = {}) {
  const { backgroundImage = null } = opts;
  ctx.clearRect(0, 0, W, H);
  if (backgroundImage && backgroundImage.complete && backgroundImage.naturalWidth > 0) {
    // Letterbox the image to fit
    const ir = backgroundImage.naturalWidth / backgroundImage.naturalHeight;
    const cr = W / H;
    let dw, dh, dx, dy;
    if (ir > cr) { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    else         { dh = H; dw = H * ir; dy = 0; dx = (W - dw) / 2; }
    ctx.drawImage(backgroundImage, dx, dy, dw, dh);
  }
  if (report.enableZones) {
    (report.diagramZones || []).forEach(z => {
      if (!z.points || z.points.length < 3) return;
      const meta = ZONE_PATTERNS[z.pattern] || ZONE_PATTERNS['hatch-red'];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(z.points[0].x, z.points[0].y);
      const n = z.points.length;
      for (let i = 0; i < n; i++) {
        const next = z.points[(i + 1) % n];
        const cp = z.controlPoints && z.controlPoints[i];
        if (cp) ctx.quadraticCurveTo(cp.x, cp.y, next.x, next.y);
        else ctx.lineTo(next.x, next.y);
      }
      ctx.closePath();
      if (z.pattern !== 'dashed-boundary') {
        const pat = buildZonePattern(ctx, z.pattern);
        if (pat) { ctx.fillStyle = pat; ctx.fill(); }
      }
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2.4;
      if (z.pattern === 'dashed-boundary') ctx.setLineDash([10, 6]);
      ctx.stroke();
      ctx.restore();
      if (z.label) {
        const cx = z.points.reduce((s, p) => s + p.x, 0) / z.points.length;
        const cy = z.points.reduce((s, p) => s + p.y, 0) / z.points.length;
        ctx.save();
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const m = ctx.measureText(z.label);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(cx - m.width / 2 - 5, cy - 10, m.width + 10, 20);
        ctx.fillStyle = meta.color;
        ctx.fillText(z.label, cx, cy);
        ctx.restore();
      }
    });
  }
  (report.diagramStrokes || []).forEach(s => {
    if (!s.points || s.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width ?? (s.color === '#F09595' ? 6 : 5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.dashed) ctx.setLineDash([Math.max(6, (s.width || 3) * 2), Math.max(4, (s.width || 3) * 1.6)]);
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    s.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
  });
  (report.diagramPins || []).forEach(pin => {
    const vc = {
      safe:    { fill: '#3fb950', stroke: '#0d2818', text: '#000' },
      caution: { fill: '#e0a020', stroke: '#2a1f08', text: '#000' },
      nogo:    { fill: '#e02020', stroke: '#2a1010', text: '#fff' },
    }[pin.verdict] || { fill: '#888', stroke: '#000', text: '#fff' };
    const r = pin.size ?? 18;
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, r, 0, Math.PI * 2);
    ctx.fillStyle = vc.fill; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.strokeStyle = vc.stroke; ctx.stroke();
    ctx.fillStyle = vc.text;
    ctx.font = `bold ${Math.max(10, r * 0.85).toFixed(0)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pin.label, pin.x, pin.y);
  });
}

// Print-only snapshot canvas — drawn from report data, independent
// of the live editor canvas. Used inside the CAD page.
function DiagramSnapshot({ report, width = 1100, height = 750 }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  // Size the canvas to the background image's aspect ratio when one is present,
  // so the image fills it edge-to-edge instead of being letterboxed with dark
  // bars. Falls back to the default WxH for image-less (drawn-only) diagrams.
  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = imgRef.current;
    let w = width, h = height;
    if (img && img.complete && img.naturalWidth > 0) {
      h = Math.round(width * img.naturalHeight / img.naturalWidth);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawSiteDiagramTo(ctx, w, h, report, { backgroundImage: img });
  };
  useEffect(() => {
    paint();
  }, [report.diagramImage, report.diagramImageUrl, report.diagramStrokes, report.diagramPins, report.diagramZones, report.enableZones, width, height]);
  return (
    <>
      {diagramSrc(report) && (
        <img ref={imgRef} src={diagramSrc(report)} alt="" crossOrigin="anonymous"
          style={{ display: 'none' }}
          onLoad={paint} />
      )}
      <canvas ref={canvasRef}
        style={{ width: '100%', height: 'auto', display: 'block', background: '#2a2a28' }} />
    </>
  );
}

function SiteDiagram({ report, update }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('pin');
  const [anchor, setAnchor] = useState(null);
  const [hoverPt, setHoverPt] = useState(null);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [selectedStrokeIdx, setSelectedStrokeIdx] = useState(null);
  const dragRef = useRef(null);
  const [pinSize, setPinSize] = useState(18);
  // Verdict the next pin will use. Picked from the sub-toolbar that shows
  // when pin mode is active. We don't use window.prompt() — Electron
  // disables it (returns null silently), so the prompt path would just
  // drop the click on the floor on the .exe build.
  const [pinVerdict, setPinVerdict] = useState('safe');
  // Label for the next zone the user saves. Pre-populated to Z1/Z2/...
  // when a draft starts; user can rename inline before tapping Save.
  // Same Electron-prompt-disabled story as pinVerdict.
  const [zoneLabel, setZoneLabel] = useState('');
  const [zonePattern, setZonePattern] = useState('hatch-red');
  // zoneDraft = { points: [...], controlPoints: [null|{x,y}, ...], pattern }
  //   controlPoints[i] = bezier control point for the curve from points[i] to
  //   points[(i+1) % length]. null/missing = straight segment.
  const [zoneDraft, setZoneDraft] = useState(null);
  // 'box'   — click-drag draws a 4-corner rectangle as the draft
  // 'points'— each click adds a polygon vertex (legacy behaviour)
  const [zoneDrawMode, setZoneDrawMode] = useState('box');
  // In-progress click-drag rectangle (during box draw): { start: {x,y} }
  const boxDragRef = useRef(null);
  // In-progress vertex/midpoint drag on the active zone draft.
  //   { type: 'vertex'|'midpoint', index: i }
  const handleDragRef = useRef(null);
  const HANDLE_HIT_RADIUS = 12;

  const toolColors = {
    'draw-rebar': '#FAC775',
    'draw-pt': '#F09595',
    'draw-conduit': '#9BC5E8',
    'draw-note': '#5DCAA5',
    'draw-crack': '#cccccc',
  };
  const dashedTools = new Set(['draw-crack']);

  // ZONE_PATTERNS + buildZonePattern are defined at module scope above.
  const getZonePattern = (ctx, patternId) => buildZonePattern(ctx, patternId);

  const lineWidthFor = (color) => color === '#F09595' ? 6 : 5;
  // Resolve the actual line width for an already-saved stroke
  // (fall back to legacy hardcoded width when the field is absent)
  const widthOf = (s) => s.width ?? lineWidthFor(s.color);
  const pinRadius = (pin) => pin.size ?? 18;

  // Trace a closed zone polygon on the current 2D context, using quadratic
  // bezier curves wherever a control point is set, straight segments
  // otherwise. Caller is expected to do beginPath / fill / stroke around it.
  const traceZonePath = (ctx, points, controlPoints) => {
    if (!points || points.length < 2) return;
    ctx.moveTo(points[0].x, points[0].y);
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const next = points[(i + 1) % n];
      const cp = controlPoints && controlPoints[i];
      if (cp) ctx.quadraticCurveTo(cp.x, cp.y, next.x, next.y);
      else ctx.lineTo(next.x, next.y);
    }
    ctx.closePath();
  };

  // Midpoint handle position for edge i. If a control point exists, the
  // visual handle sits at the curve's t=0.5 point (so dragging it feels like
  // grabbing the actual curve); otherwise it's the geometric midpoint of the
  // straight edge.
  const edgeHandlePos = (points, controlPoints, i) => {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const cp = controlPoints && controlPoints[i];
    if (cp) return { x: 0.25 * p0.x + 0.5 * cp.x + 0.25 * p1.x,
                     y: 0.25 * p0.y + 0.5 * cp.y + 0.25 * p1.y };
    return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  };

  // Invert edgeHandlePos: given a handle position, compute the control point
  // that places the curve through that point at t=0.5.
  const controlPointForHandle = (p0, p1, handlePos) => ({
    x: 2 * handlePos.x - 0.5 * p0.x - 0.5 * p1.x,
    y: 2 * handlePos.y - 0.5 * p0.y - 0.5 * p1.y,
  });

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hatched zones render UNDER strokes/pins
    if (report.enableZones) {
      (report.diagramZones || []).forEach(z => {
        if (!z.points || z.points.length < 3) return;
        const meta = ZONE_PATTERNS[z.pattern] || ZONE_PATTERNS['hatch-red'];
        ctx.save();
        ctx.beginPath();
        traceZonePath(ctx, z.points, z.controlPoints);
        if (z.pattern !== 'dashed-boundary') {
          const pat = getZonePattern(ctx, z.pattern);
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fill();
          }
        }
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 2.4;
        if (z.pattern === 'dashed-boundary') ctx.setLineDash([10, 6]);
        ctx.stroke();
        ctx.restore();
        // Label centered
        if (z.label) {
          const cx = z.points.reduce((s, p) => s + p.x, 0) / z.points.length;
          const cy = z.points.reduce((s, p) => s + p.y, 0) / z.points.length;
          ctx.save();
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const text = z.label;
          const m = ctx.measureText(text);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(cx - m.width / 2 - 5, cy - 10, m.width + 10, 20);
          ctx.fillStyle = meta.color;
          ctx.fillText(text, cx, cy);
          ctx.restore();
        }
      });

      // In-progress click-drag rectangle (box draw mode)
      if (boxDragRef.current && hoverPt) {
        const s = boxDragRef.current.start;
        const meta = ZONE_PATTERNS[zonePattern] || ZONE_PATTERNS['hatch-red'];
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = meta.color;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.strokeRect(
          Math.min(s.x, hoverPt.x), Math.min(s.y, hoverPt.y),
          Math.abs(hoverPt.x - s.x), Math.abs(hoverPt.y - s.y),
        );
        ctx.restore();
      }

      // In-progress zone draft preview (with editable handles)
      if (zoneDraft && zoneDraft.points.length > 0) {
        const meta = ZONE_PATTERNS[zoneDraft.pattern] || ZONE_PATTERNS['hatch-red'];
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = meta.color;
        ctx.fillStyle = meta.color;
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (zoneDraft.points.length >= 3) {
          // Closed preview with bezier curves where control points exist.
          traceZonePath(ctx, zoneDraft.points, zoneDraft.controlPoints);
        } else {
          // Open polyline + rubber band to cursor for the point-by-point flow.
          ctx.moveTo(zoneDraft.points[0].x, zoneDraft.points[0].y);
          zoneDraft.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
          if (hoverPt && zoneDrawMode === 'points') ctx.lineTo(hoverPt.x, hoverPt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Vertex handles (square markers)
        zoneDraft.points.forEach((p) => {
          ctx.beginPath();
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = meta.color;
          ctx.lineWidth = 2;
          ctx.rect(p.x - 5, p.y - 5, 10, 10);
          ctx.fill();
          ctx.stroke();
        });

        // Edge midpoint handles (circles) — only when the polygon is closed
        // (3+ points), so users can pull a side into a curve.
        if (zoneDraft.points.length >= 3) {
          zoneDraft.points.forEach((_, i) => {
            const m = edgeHandlePos(zoneDraft.points, zoneDraft.controlPoints, i);
            const hasCurve = !!(zoneDraft.controlPoints && zoneDraft.controlPoints[i]);
            ctx.beginPath();
            ctx.fillStyle = hasCurve ? meta.color : '#fff';
            ctx.strokeStyle = meta.color;
            ctx.lineWidth = 2;
            ctx.arc(m.x, m.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
        ctx.restore();
      }
    }

    report.diagramStrokes.forEach((s, i) => {
      if (s.points.length < 2) return;
      if (i === selectedStrokeIdx) {
        // Glow / halo behind the selected line so the user can see what they've grabbed.
        ctx.save();
        ctx.lineWidth = widthOf(s) + 10;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.55;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        s.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = widthOf(s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    if (anchor && hoverPt && tool.startsWith('draw-')) {
      const color = toolColors[tool];
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(hoverPt.x, hoverPt.y);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, Math.max(4, strokeWidth * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }

    report.diagramPins.forEach(pin => {
      const vc = {
        safe:    { fill: '#3fb950', stroke: '#0d2818', text: '#000' },
        caution: { fill: '#e0a020', stroke: '#2a1f08', text: '#000' },
        nogo:    { fill: '#e02020', stroke: '#2a1010', text: '#fff' },
      }[pin.verdict] || { fill: '#888', stroke: '#000', text: '#fff' };

      const r = pinRadius(pin);
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, r, 0, Math.PI * 2);
      ctx.fillStyle = vc.fill;
      ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.18);
      ctx.strokeStyle = vc.stroke;
      ctx.stroke();
      ctx.fillStyle = vc.text;
      ctx.font = `bold ${Math.max(10, r * 0.85).toFixed(0)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pin.label, pin.x, pin.y);
    });
  };

  useEffect(redraw, [report.diagramStrokes, report.diagramPins, report.diagramZones, report.enableZones, anchor, hoverPt, tool, strokeWidth, pinSize, zoneDraft, selectedStrokeIdx, zoneDrawMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }, [report.diagramImage, report.diagramImageUrl]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches?.[0] || e.changedTouches?.[0];
    const cx = t ? t.clientX : e.clientX;
    const cy = t ? t.clientY : e.clientY;
    return {
      x: (cx - rect.left) * (canvas.width / rect.width),
      y: (cy - rect.top) * (canvas.height / rect.height),
    };
  };

  // --- Select / move existing lines ---
  const distToSegment = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx, cy = a.y + t * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  };
  const hitTestStrokes = (pt) => {
    let bestIdx = -1, bestDist = Infinity;
    (report.diagramStrokes || []).forEach((s, i) => {
      if (!s || !s.points || s.points.length < 2) return;
      for (let j = 0; j < s.points.length - 1; j++) {
        const d = distToSegment(pt, s.points[j], s.points[j + 1]);
        const tol = Math.max(10, (s.width || 5) / 2 + 8);
        if (d <= tol && d < bestDist) { bestDist = d; bestIdx = i; }
      }
    });
    return bestIdx;
  };
  const deleteSelected = () => {
    if (selectedStrokeIdx == null) return;
    update({ diagramStrokes: report.diagramStrokes.filter((_, i) => i !== selectedStrokeIdx) });
    setSelectedStrokeIdx(null);
  };

  const handleStart = (e) => {
    e.preventDefault();
    const pt = getCoords(e);
    if (tool === 'select') {
      const idx = hitTestStrokes(pt);
      if (idx >= 0) {
        setSelectedStrokeIdx(idx);
        dragRef.current = { startPt: pt, original: report.diagramStrokes[idx].points.map(p => ({ ...p })) };
      } else {
        setSelectedStrokeIdx(null);
        dragRef.current = null;
      }
      return;
    }
    if (tool === 'pin') {
      const nextLabel = String.fromCharCode(65 + report.diagramPins.length);
      update({
        diagramPins: [...report.diagramPins, {
          x: pt.x, y: pt.y, label: nextLabel, verdict: pinVerdict, size: pinSize,
        }],
      });
    } else if (tool === 'draw-zone') {
      // If an editable draft exists, check first whether the user grabbed a
      // vertex or edge midpoint handle — that takes priority over adding more
      // points / starting a new box.
      if (zoneDraft && zoneDraft.points.length >= 3) {
        const hr = HANDLE_HIT_RADIUS;
        // Vertex hit
        for (let i = 0; i < zoneDraft.points.length; i++) {
          const v = zoneDraft.points[i];
          if (Math.hypot(pt.x - v.x, pt.y - v.y) <= hr) {
            handleDragRef.current = { type: 'vertex', index: i };
            return;
          }
        }
        // Edge midpoint hit
        for (let i = 0; i < zoneDraft.points.length; i++) {
          const m = edgeHandlePos(zoneDraft.points, zoneDraft.controlPoints, i);
          if (Math.hypot(pt.x - m.x, pt.y - m.y) <= hr) {
            handleDragRef.current = { type: 'midpoint', index: i };
            return;
          }
        }
      }
      if (zoneDrawMode === 'box' && !zoneDraft) {
        // Start dragging out a rectangle.
        boxDragRef.current = { start: pt };
        setHoverPt(pt);
        return;
      }
      // Legacy point-by-point: each click appends a vertex to the draft.
      setZoneDraft(prev => ({
        pattern: prev?.pattern || zonePattern,
        points: [...(prev?.points || []), pt],
        controlPoints: prev?.controlPoints || [],
      }));
    } else if (tool.startsWith('draw-')) {
      if (!anchor) {
        setAnchor(pt);
        setHoverPt(pt);
      } else {
        const color = toolColors[tool];
        update({
          diagramStrokes: [...report.diagramStrokes, {
            color, points: [anchor, pt], width: strokeWidth,
            dashed: dashedTools.has(tool),
          }],
        });
        setAnchor(null);
        setHoverPt(null);
      }
    }
  };

  const finishZone = () => {
    if (!zoneDraft || zoneDraft.points.length < 3) {
      alert('A zone needs at least 3 points. Drag a box on the diagram (or switch to Points mode and tap to add vertices).');
      return;
    }
    const labelDefault = `Z${(report.diagramZones || []).length + 1}`;
    const label = (zoneLabel || '').trim() || labelDefault;
    const id = `dz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Only persist controlPoints if any are actually set, to keep the saved
    // zone tidy in JSON exports.
    const cps = zoneDraft.controlPoints || [];
    const anyCurve = cps.some(cp => cp);
    update({
      diagramZones: [...(report.diagramZones || []), {
        id, label,
        points: zoneDraft.points,
        controlPoints: anyCurve ? cps : undefined,
        pattern: zoneDraft.pattern,
      }],
    });
    setZoneDraft(null);
    setHoverPt(null);
  };

  const cancelZone = () => { setZoneDraft(null); setHoverPt(null); boxDragRef.current = null; };

  // Right-click / Esc cancels whatever the user has in progress. We pick the
  // most-recent thing they were doing so a single cancel undoes one step.
  const cancelCurrentTask = () => {
    if (zoneDraft) { setZoneDraft(null); setHoverPt(null); return; }
    if (anchor) { setAnchor(null); setHoverPt(null); return; }
    if (selectedStrokeIdx != null) { setSelectedStrokeIdx(null); dragRef.current = null; return; }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancelCurrentTask(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleMove = (e) => {
    if (tool === 'select' && dragRef.current && selectedStrokeIdx != null) {
      e.preventDefault();
      const pt = getCoords(e);
      const dx = pt.x - dragRef.current.startPt.x;
      const dy = pt.y - dragRef.current.startPt.y;
      const moved = dragRef.current.original.map(p => ({ x: p.x + dx, y: p.y + dy }));
      update({
        diagramStrokes: report.diagramStrokes.map((s, i) =>
          i === selectedStrokeIdx ? { ...s, points: moved } : s
        ),
      });
      return;
    }
    if (tool === 'draw-zone') {
      // Rectangle drag preview
      if (boxDragRef.current) {
        e.preventDefault();
        setHoverPt(getCoords(e));
        return;
      }
      // Vertex / midpoint drag on the active draft
      if (handleDragRef.current && zoneDraft) {
        e.preventDefault();
        const pt = getCoords(e);
        const drag = handleDragRef.current;
        if (drag.type === 'vertex') {
          const next = zoneDraft.points.map((p, i) => i === drag.index ? pt : p);
          setZoneDraft({ ...zoneDraft, points: next });
        } else if (drag.type === 'midpoint') {
          const p0 = zoneDraft.points[drag.index];
          const p1 = zoneDraft.points[(drag.index + 1) % zoneDraft.points.length];
          const cp = controlPointForHandle(p0, p1, pt);
          const cps = (zoneDraft.controlPoints || []).slice();
          while (cps.length < zoneDraft.points.length) cps.push(null);
          cps[drag.index] = cp;
          setZoneDraft({ ...zoneDraft, controlPoints: cps });
        }
        return;
      }
      if (zoneDraft) {
        e.preventDefault();
        setHoverPt(getCoords(e));
        return;
      }
    }
    if (!anchor || !tool.startsWith('draw-')) return;
    e.preventDefault();
    setHoverPt(getCoords(e));
  };

  const handleEnd = (e) => {
    dragRef.current = null;
    // Finish a click-drag rectangle: only commit if it has real area.
    if (boxDragRef.current) {
      const s = boxDragRef.current.start;
      // Use the LAST hoverPt rather than the touchend coords (which on touch
      // are sometimes the same as start) so a real drag commits.
      const end = (e && (e.changedTouches?.[0] || e.clientX != null)) ? getCoords(e) : hoverPt;
      boxDragRef.current = null;
      if (end && Math.abs(end.x - s.x) > 6 && Math.abs(end.y - s.y) > 6) {
        const x0 = Math.min(s.x, end.x), x1 = Math.max(s.x, end.x);
        const y0 = Math.min(s.y, end.y), y1 = Math.max(s.y, end.y);
        setZoneDraft({
          pattern: zoneDraft?.pattern || zonePattern,
          points: [
            { x: x0, y: y0 }, { x: x1, y: y0 },
            { x: x1, y: y1 }, { x: x0, y: y1 },
          ],
          controlPoints: [null, null, null, null],
        });
      }
      setHoverPt(null);
    }
    handleDragRef.current = null;
  };

  useEffect(() => {
    setAnchor(null);
    setHoverPt(null);
    if (tool !== 'select') setSelectedStrokeIdx(null);
  }, [tool]);

  // Seed/clear the zoneLabel field when a draft starts or finishes. Default
  // is Z1/Z2/... so the engineer just taps Save unless they want a custom
  // name (e.g. "Slab band", "BoH"). Inline edit happens in the toolbar.
  useEffect(() => {
    if (zoneDraft && !zoneLabel) {
      setZoneLabel(`Z${(report.diagramZones || []).length + 1}`);
    } else if (!zoneDraft && zoneLabel) {
      setZoneLabel('');
    }
  }, [zoneDraft]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file);
    if (dataUrl) update({ diagramImage: dataUrl });
  };

  const undo = () => {
    // Prefer popping from the in-progress zone draft first
    if (zoneDraft && zoneDraft.points.length > 0) {
      const next = zoneDraft.points.slice(0, -1);
      setZoneDraft(next.length ? { ...zoneDraft, points: next } : null);
      return;
    }
    if ((report.diagramZones || []).length > 0 && report.enableZones) {
      update({ diagramZones: report.diagramZones.slice(0, -1) });
      return;
    }
    if (report.diagramPins.length > 0) {
      update({ diagramPins: report.diagramPins.slice(0, -1) });
    } else if (report.diagramStrokes.length > 0) {
      update({ diagramStrokes: report.diagramStrokes.slice(0, -1) });
    }
  };

  const clearAll = () => {
    if (confirm('Clear all sketches and pins?')) {
      update({ diagramStrokes: [], diagramPins: [] });
    }
  };

  const toolBtn = (id, label, color) => (
    <Btn
      variant={tool === id ? 'primary' : 'default'}
      onClick={() => setTool(id)}
      style={{ fontSize: 12, padding: '8px 6px' }}
    >
      {color && <span style={{ color, marginRight: 4 }}>━</span>}{label}
    </Btn>
  );

  return (
    <Card title="Site diagram & sketch">
      <div ref={containerRef} style={{
        position: 'relative', background: '#2a2a28',
        borderRadius: 8, aspectRatio: '4 / 3',
        overflow: 'hidden', marginBottom: 10,
        border: `1px solid ${c.border}`,
      }}>
        {diagramSrc(report) ? (
          <img src={diagramSrc(report)} alt="Site"
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        ) : (
          <div className="no-print" style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: c.textFaint, fontSize: 12, textAlign: 'center', padding: 20,
          }}>
            Tap Photo to add site image<br/>or sketch on the blank canvas
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            touchAction: 'none',
            cursor: tool === 'pin' ? 'crosshair' : 'cell',
          }}
          onMouseDown={handleStart} onMouseMove={handleMove}
          onMouseUp={handleEnd} onMouseLeave={handleEnd}
          onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            // Right-click on an edge midpoint = straighten that edge again.
            if (tool === 'draw-zone' && zoneDraft && zoneDraft.points.length >= 3) {
              const pt = getCoords(e);
              for (let i = 0; i < zoneDraft.points.length; i++) {
                const m = edgeHandlePos(zoneDraft.points, zoneDraft.controlPoints, i);
                if (Math.hypot(pt.x - m.x, pt.y - m.y) <= HANDLE_HIT_RADIUS &&
                    zoneDraft.controlPoints && zoneDraft.controlPoints[i]) {
                  const cps = zoneDraft.controlPoints.slice();
                  cps[i] = null;
                  setZoneDraft({ ...zoneDraft, controlPoints: cps });
                  return;
                }
              }
            }
            cancelCurrentTask();
          }}
        />
      </div>
      {/* Editor chrome (toolbar, tools, sliders, undo/clear, legend) — wrapped
          no-print so the saved PDF / preview shows only the diagram itself,
          never the editing controls. */}
      <div className="no-print">
      {/* Photo toolbar — sits OUTSIDE the canvas so the Remove button can't
          land on the sketch the user is working on. */}
      {diagramSrc(report) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, marginBottom: 6, padding: '6px 10px',
          background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 6,
          fontSize: 11, color: c.textDim,
        }}>
          <span>📷 Site photo loaded</span>
          <Btn variant="ghost"
            onClick={() => {
              if (confirm('Remove the site diagram photo? Your sketches and pins stay.')) {
                update({ diagramImage: null, diagramImageUrl: null, diagramImagePath: null });
              }
            }}
            title="Remove site photo"
            style={{ fontSize: 11, padding: '4px 9px' }}>
            ✕ Remove photo
          </Btn>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 6 }}>
        <label style={{
          background: c.cardAlt, border: `1px solid ${c.borderStrong}`,
          borderRadius: 6, padding: '8px', textAlign: 'center', fontSize: 13,
          color: c.text, cursor: 'pointer', fontWeight: 500,
        }}>
          📷 Photo
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        </label>
        {toolBtn('select', '✥ Pick / Move')}
        {toolBtn('pin', '📍 Pin core')}
        {toolBtn('draw-rebar', 'Rebar', '#FAC775')}
        {toolBtn('draw-pt', 'PT cable', '#F09595')}
        {toolBtn('draw-conduit', 'Conduit', '#9BC5E8')}
        {toolBtn('draw-note', 'Note', '#5DCAA5')}
        {toolBtn('draw-crack', '⋯ Crack', '#cccccc')}
        {report.enableZones && toolBtn('draw-zone', '▦ Zone', '#e02020')}
      </div>
      {/* Pin verdict picker — replaces window.prompt() (which is disabled in
          Electron). Pick a verdict, tap the diagram to drop a pin with it. */}
      {tool === 'pin' && (
        <div style={{
          background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 6,
          padding: '8px 10px', marginBottom: 6,
        }}>
          <div style={{ fontSize: 10.5, color: c.textDim, marginBottom: 5,
            textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Next pin verdict
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {[
              { id: 'safe',    label: 'Safe',    bg: '#3fb950', fg: '#000' },
              { id: 'caution', label: 'Caution', bg: '#e0a020', fg: '#000' },
              { id: 'nogo',    label: 'No-go',   bg: '#e02020', fg: '#fff' },
            ].map(v => (
              <button key={v.id}
                onClick={() => setPinVerdict(v.id)}
                style={{
                  background: pinVerdict === v.id ? v.bg : c.card,
                  color: pinVerdict === v.id ? v.fg : c.text,
                  border: `1px solid ${pinVerdict === v.id ? v.bg : c.border}`,
                  borderRadius: 5, padding: '7px 8px',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>● {v.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: c.textFaint, marginTop: 5, lineHeight: 1.4 }}>
            Tap the diagram to drop a pin with the selected verdict. Switch the
            verdict between drops for mixed sets.
          </div>
        </div>
      )}
      {report.enableZones && tool === 'draw-zone' && (
        <div style={{
          background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 6,
          padding: '8px 10px', marginBottom: 6,
        }}>
          <div style={{ fontSize: 10.5, color: c.textDim, marginBottom: 5,
            textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Zone pattern
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
            {Object.entries(ZONE_PATTERNS).map(([id, meta]) => (
              <button key={id}
                onClick={() => setZonePattern(id)}
                style={{
                  background: zonePattern === id ? c.accentDim : c.card,
                  color: zonePattern === id ? c.onAccentDim : c.text,
                  border: `1px solid ${zonePattern === id ? c.accent : c.border}`,
                  borderLeft: `4px solid ${meta.color}`,
                  borderRadius: 5, padding: '6px 7px',
                  fontSize: 11, fontWeight: 600, textAlign: 'left', cursor: 'pointer',
                }}>{meta.label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
            <Btn
              variant={zoneDrawMode === 'box' ? 'primary' : 'default'}
              onClick={() => setZoneDrawMode('box')}
              disabled={!!zoneDraft}
              style={{ fontSize: 11 }}>▭ Drag a box</Btn>
            <Btn
              variant={zoneDrawMode === 'points' ? 'primary' : 'default'}
              onClick={() => setZoneDrawMode('points')}
              disabled={!!zoneDraft}
              style={{ fontSize: 11 }}>✥ Tap points</Btn>
          </div>
          {zoneDraft && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10.5, color: c.textDim, marginBottom: 3,
                textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Zone label
              </div>
              <input
                value={zoneLabel}
                onChange={(e) => setZoneLabel(e.target.value)}
                placeholder={`Z${(report.diagramZones || []).length + 1}`}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: c.bg || c.cardAlt, color: c.text,
                  border: `1px solid ${c.borderStrong}`, borderRadius: 5,
                  padding: '6px 8px', fontSize: 12, fontFamily: 'inherit',
                }} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Btn variant="primary" onClick={finishZone}
              disabled={!zoneDraft || zoneDraft.points.length < 3}
              style={{ fontSize: 12 }}>
              ✓ Save zone {zoneDraft ? `(${zoneDraft.points.length} pts)` : ''}
            </Btn>
            <Btn variant="ghost" onClick={cancelZone}
              disabled={!zoneDraft && !boxDragRef.current}
              style={{ fontSize: 12 }}>Cancel zone</Btn>
          </div>
          <div style={{ fontSize: 10, color: c.textFaint, marginTop: 5, lineHeight: 1.4 }}>
            {zoneDrawMode === 'box'
              ? 'Click-drag a box on the diagram to start. Then drag the corner squares to reshape, or drag any edge\'s circle outward to bend that side into a curve. Right-click an edge\'s circle to straighten it again. Esc or right-click on empty area cancels the draft.'
              : 'Tap the diagram to drop polygon vertices (3+). When the outline is closed, drag corners to reshape or edge midpoints to bend into curves. Esc cancels.'}
          </div>
        </div>
      )}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        padding: '8px 10px', marginBottom: 6,
        background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 6,
      }}>
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: c.textDim }}>
          <div style={{ marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Line thickness{selectedStrokeIdx != null ? ' (selected)' : ''}: <span style={{ color: c.text }}>
              {(selectedStrokeIdx != null && report.diagramStrokes[selectedStrokeIdx]?.width) || strokeWidth}px
            </span>
          </div>
          <input type="range" min="1" max="48" step="1"
            value={(selectedStrokeIdx != null && report.diagramStrokes[selectedStrokeIdx]?.width) || strokeWidth}
            onChange={e => {
              const v = Number(e.target.value);
              if (selectedStrokeIdx != null && report.diagramStrokes[selectedStrokeIdx]) {
                update({ diagramStrokes: report.diagramStrokes.map((s, i) => i === selectedStrokeIdx ? { ...s, width: v } : s) });
              } else {
                setStrokeWidth(v);
              }
            }}
            style={{ width: '100%', accentColor: c.accent }} />
        </label>
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: c.textDim }}>
          <div style={{ marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Pin size: <span style={{ color: c.text }}>{pinSize}px</span>
          </div>
          <input type="range" min="10" max="36" step="2"
            value={pinSize}
            onChange={e => setPinSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: c.accent }} />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Btn onClick={undo} style={{ fontSize: 12 }}>↶ Undo</Btn>
        {selectedStrokeIdx != null ? (
          <Btn variant="danger" onClick={deleteSelected} style={{ fontSize: 12 }}>🗑 Delete selected line</Btn>
        ) : (
          <Btn variant="ghost" onClick={clearAll} style={{ fontSize: 12 }}>Clear</Btn>
        )}
      </div>

      <div style={{
        marginTop: 10, padding: 9, background: c.cardAlt,
        borderRadius: 6, fontSize: 11,
      }}>
        <div style={{ color: c.textDim, marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>LEGEND (CSA color codes)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', color: c.text, fontSize: 11 }}>
          <span><span style={{ color: '#FAC775' }}>━</span> Rebar</span>
          <span><span style={{ color: '#F09595' }}>━</span> PT cable</span>
          <span><span style={{ color: '#9BC5E8' }}>━</span> Conduit</span>
          <span><span style={{ color: '#5DCAA5' }}>━</span> Note</span>
          <span><span style={{ color: '#cccccc' }}>┄</span> Crack</span>
          <span style={{ color: c.green }}>● Safe</span>
          <span style={{ color: c.amber }}>● Caution</span>
          <span style={{ color: c.red }}>● No drill</span>
          {report.enableZones && Object.entries(ZONE_PATTERNS).map(([id, meta]) => (
            <span key={id}>
              <span style={{ color: meta.color }}>▦</span> {meta.label}
            </span>
          ))}
        </div>
      </div>
      </div>{/* end .no-print editor chrome */}
    </Card>
  );
}

// ============================================================
// Scan Photos (embedded in PDF, grouped by confidence)
// ============================================================

const CONFIDENCE_ORDER = ['high', 'med', 'low'];
// Solid fill + white text so HIGH/MED/LOW stay legible on the dark editor and in
// preview. (Print uses the .ak-conf-* rules, which already render readable
// light-fill/dark-text pills.)
const CONFIDENCE_META = {
  high: { label: 'High confidence', color: '#fff',  bg: '#1a7f37' },
  med:  { label: 'Medium confidence', color: '#fff', bg: '#b07400' },
  low:  { label: 'Low confidence',  color: '#fff',   bg: '#c0282d' },
};

const SCAN_TYPES = [
  { id: 'site',    label: 'Marked-up slab' },
  { id: 'bscan',   label: 'B-scan (linescan)' },
  { id: 'cscan',   label: 'C-scan / Scan3D' },
  { id: 'focus',   label: 'Focus' },
  { id: 'other',   label: 'Other' },
];
const SCAN_TYPE_ORDER = ['bscan', 'cscan', 'focus', 'site', 'other'];
const SCAN_TYPE_LABEL = SCAN_TYPES.reduce((acc, t) => { acc[t.id] = t.label; return acc; }, {});

const ANNOTATION_COLORS = [
  { id: 'red',    hex: '#e84a4a' },
  { id: 'blue',   hex: '#3a8de8' },
  { id: 'orange', hex: '#e89c3a' },
  { id: 'green',  hex: '#45c97a' },
  { id: 'black',  hex: '#000000' },
];
const ANNOTATION_COLOR_HEX = ANNOTATION_COLORS.reduce((acc, c) => { acc[c.id] = c.hex; return acc; }, {});

// One-click target presets — engineers don't want to dial color/thickness/tool
// for every conduit they trace. Persisted in localStorage so each tech's
// workflow defaults travel with them.
// Defaults aligned to the APWA Uniform Color Code + concrete-scanning danger
// convention: red = PT/tendon (the hard-stop hazard), orange = conduit/comms,
// black = rebar, blue = water/reference. See APWA_LEGEND below.
const DEFAULT_PRESETS = [
  { id: 'rebar',   label: 'Rebar',        tool: 'freehand', color: '#1a1a1a', strokeScale: 6 },
  { id: 'pt',      label: 'PT Cable',     tool: 'freehand', color: '#e84a4a', strokeScale: 8 },
  { id: 'conduit', label: 'Conduit',      tool: 'freehand', color: '#e89c3a', strokeScale: 5 },
  { id: 'water',   label: 'Water line',   tool: 'freehand', color: '#3a8de8', strokeScale: 5 },
  { id: 'core',    label: 'Core ⊙',       tool: 'circle',   color: '#45c97a', strokeScale: 4 },
  { id: 'anomaly', label: 'Anomaly',      tool: 'freehand', color: '#e89c3a', strokeScale: 6 },
  { id: 'depth',   label: 'Depth marker', tool: 'text',     color: '#3a8de8', strokeScale: 5 },
  { id: 'nocore',  label: 'No-core zone', tool: 'rect',     color: '#e84a4a', strokeScale: 5 },
  { id: 'grid',    label: 'Grid line',    tool: 'line',     color: '#3a8de8', strokeScale: 3 },
];

// Printed markup key — blends the APWA Uniform Color Code (utility locating
// standard across North America incl. BC) with concrete-scanning convention.
const APWA_LEGEND = [
  { color: '#1a1a1a', label: 'Reinforcing steel (rebar)' },
  { color: '#e84a4a', label: 'Post-tension cable / power — DANGER' },
  { color: '#e89c3a', label: 'Conduit / communication / anomaly' },
  { color: '#3a8de8', label: 'Water line / depth / reference grid' },
  { color: '#45c97a', label: 'Proposed core — cleared to drill' },
];
const PRESETS_STORAGE_KEY = 'ak_annotation_presets';
function loadAnnotationPresets() {
  try {
    const s = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch {}
  return DEFAULT_PRESETS;
}
function saveAnnotationPresets(presets) {
  try { localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets)); } catch {}
}

// Snap an endpoint to the nearest N° increment from the anchor (held Shift)
function snapToAngle(anchor, pt, snapDeg = 15) {
  const dx = pt.x - anchor.x;
  const dy = pt.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return pt;
  const rad = Math.atan2(dy, dx);
  const step = (snapDeg * Math.PI) / 180;
  const snapped = Math.round(rad / step) * step;
  return {
    x: Math.max(0, Math.min(1, anchor.x + Math.cos(snapped) * dist)),
    y: Math.max(0, Math.min(1, anchor.y + Math.sin(snapped) * dist)),
  };
}

function parseScanFilename(name) {
  if (!name) return {};
  const lower = name.toLowerCase();
  const out = {};
  if (/linescan|bscan|b-scan/.test(lower))            out.scanType = 'bscan';
  else if (/scan3d|cscan|c-scan|plan/.test(lower))    out.scanType = 'cscan';
  else if (/focus/.test(lower))                       out.scanType = 'focus';
  const parts = [];
  const cm  = lower.match(/(\d+)\s*[-–]\s*(\d+)\s*cm/);
  const inch = lower.match(/(\d+)\s*[-–]\s*(\d+)\s*in/);
  if (cm)   parts.push(`${cm[1]}–${cm[2]} cm`);
  if (inch) parts.push(`${inch[1]}–${inch[2]} in`);
  if (parts.length) out.scaleInfo = parts.join(' × ');
  const loc = name.match(/[_\-](L\d+)(?:[_\-.]|$)/i) || name.match(/^(L\d+)[_\-.]/i);
  if (loc) out.locationRef = loc[1].toUpperCase();
  return out;
}

// Draw an arrowhead at (x2, y2) pointing away from (x1, y1)
function drawArrowHead(ctx, x1, y1, x2, y2, color, lineWidth) {
  const headLen = Math.max(10, Math.hypot(x2 - x1, y2 - y1) * 0.18, (lineWidth || 0) * 2.4);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 7), y2 - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 7), y2 - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawAnnotation(ctx, a, W, H) {
  const color = ANNOTATION_COLOR_HEX[a.color] || a.color || '#e84a4a';
  const minDim = Math.min(W, H);
  // strokeScale is the user-picked thickness (1..16, default 5).
  // 5 reproduces the previous auto-width formula.
  const strokeScale = (typeof a.strokeScale === 'number' ? a.strokeScale : 5);
  const drawnLineWidth = Math.max(1.5, minDim * 0.0012 * strokeScale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = drawnLineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (a.type === 'arrow' && a.start && a.end) {
    const x1 = a.start.x * W, y1 = a.start.y * H;
    const x2 = a.end.x * W,   y2 = a.end.y * H;
    // Outline / halo so a coloured arrow stays readable on busy slab photos and
    // doesn't get lost among the chalk/crayon marks. On unless a.outline ===
    // false; a.outlineColor overrides the dark default.
    if (a.outline !== false) {
      const oc = a.outlineColor || 'rgba(0,0,0,0.9)';
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const headLen = Math.max(10, Math.hypot(x2 - x1, y2 - y1) * 0.18, drawnLineWidth * 2.4);
      ctx.save();
      ctx.strokeStyle = oc; ctx.fillStyle = oc;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.lineWidth = drawnLineWidth + Math.max(2.5, drawnLineWidth * 0.85);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(ang - Math.PI / 7), y2 - headLen * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(x2 - headLen * Math.cos(ang + Math.PI / 7), y2 - headLen * Math.sin(ang + Math.PI / 7));
      ctx.closePath();
      ctx.lineWidth = Math.max(2.5, drawnLineWidth * 1.6);
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = drawnLineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    drawArrowHead(ctx, x1, y1, x2, y2, color, drawnLineWidth);
  } else if (a.type === 'line' && a.start && a.end) {
    ctx.beginPath();
    ctx.moveTo(a.start.x * W, a.start.y * H);
    ctx.lineTo(a.end.x * W, a.end.y * H);
    ctx.stroke();
  } else if (a.type === 'circle' && a.center && typeof a.radius === 'number') {
    ctx.beginPath();
    ctx.arc(a.center.x * W, a.center.y * H, a.radius * minDim, 0, Math.PI * 2);
    ctx.stroke();
  } else if (a.type === 'rect' && a.topLeft && a.bottomRight) {
    const x = a.topLeft.x * W, y = a.topLeft.y * H;
    const w = (a.bottomRight.x - a.topLeft.x) * W;
    const h = (a.bottomRight.y - a.topLeft.y) * H;
    ctx.strokeRect(x, y, w, h);
  } else if (a.type === 'freehand' && Array.isArray(a.points) && a.points.length >= 2) {
    const pts = a.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * W, pts[0].y * H);
    // Smooth midpoint-quadratic-bezier through the polyline
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = ((pts[i].x + pts[i + 1].x) / 2) * W;
      const yc = ((pts[i].y + pts[i + 1].y) / 2) * H;
      ctx.quadraticCurveTo(pts[i].x * W, pts[i].y * H, xc, yc);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x * W, last.y * H);
    ctx.stroke();
  } else if (a.type === 'text' && a.position) {
    const fontSize = Math.max(10, (a.fontSize || 14) * (minDim / 400) * (strokeScale / 5));
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'top';
    const text = a.content || '';
    const padX = fontSize * 0.3;
    const padY = fontSize * 0.15;
    const m = ctx.measureText(text);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(
      a.position.x * W - padX,
      a.position.y * H - padY,
      m.width + padX * 2,
      fontSize + padY * 2,
    );
    ctx.fillStyle = color;
    ctx.fillText(text, a.position.x * W, a.position.y * H);
  }
}

// ============================================================
// QRCode — renders a QR matrix to a canvas (offline, no deps)
// ============================================================

function QRCode({ value, size = 110 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!value || !canvasRef.current) return;
    try {
      const matrix = QRGen.generate(value);
      const n = matrix.length;
      const quiet = 4;
      const total = n + quiet * 2;
      const cell = Math.max(1, Math.floor(size / total));
      const dim = cell * total;
      const canvas = canvasRef.current;
      canvas.width = dim;
      canvas.height = dim;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = '#000000';
      for (let r = 0; r < n; r++) {
        for (let cc = 0; cc < n; cc++) {
          if (matrix[r][cc] === 1) {
            ctx.fillRect((cc + quiet) * cell, (r + quiet) * cell, cell, cell);
          }
        }
      }
    } catch (e) {
      console.error('QR generation failed:', e);
    }
  }, [value, size]);
  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />;
}

// ============================================================
// AnnotatedImage — img with overlay canvas of annotations
// ============================================================

// A photo's best display source: the local base64 (instant + offline) if we
// have it, else the Storage URL (for photos received from another device).
function photoSrc(p) {
  return (p && (p.dataUrl || p.url)) || '';
}
function diagramSrc(report) {
  return report.diagramImage || report.diagramImageUrl || null;
}
// Scan-location photos use their own field names (photo / photoUrl).
function locPhotoSrc(loc) {
  return (loc && (loc.photo || loc.photoUrl)) || '';
}

function AnnotatedImage({ src, annotations = [], style, alt }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Draw the photo AND its annotations into ONE canvas at the image's natural
  // resolution. Because the marks are baked into the same bitmap as the photo,
  // any later CSS sizing (width:100%, max-height, object-fit) scales them
  // TOGETHER — the marks can NEVER drift off the photo.
  //
  // The previous overlay-canvas approach broke on the print path: a tall photo
  // hit `max-height: 21cm` + `object-fit: contain`, which letterboxed the photo
  // inside a wider element box, while the absolutely-positioned overlay filled
  // that whole box — so arrows/circles landed way off the actual photo (only in
  // the PDF/preview, only on portrait photos). Baking removes the overlay
  // entirely, so there's nothing left to misalign.
  const redraw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = img.naturalWidth || 1000;
    const h = img.naturalHeight || 750;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (img.complete && img.naturalWidth) {
      try { ctx.drawImage(img, 0, 0, w, h); } catch (e) { /* tainted remote img still displays */ }
    }
    annotations.forEach(a => drawAnnotation(ctx, a, w, h));
  };

  useEffect(redraw, [annotations, src]);

  return (
    <div style={{ display: 'block', lineHeight: 0, ...style }}>
      {/* Hidden source image — feeds drawImage; never displayed itself. */}
      <img ref={imgRef} src={src} alt="" onLoad={redraw} style={{ display: 'none' }} />
      <canvas ref={canvasRef} className="ak-annot-photo" aria-label={alt || 'Scan'}
        style={{ display: 'block', width: '100%', height: 'auto' }} />
    </div>
  );
}

// ============================================================
// AnnotationEditor — full-screen modal canvas editor
// ============================================================

function AnnotationEditor({ photo, onSave, onClose, colorLegend = APWA_LEGEND }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [annotations, setAnnotations] = useState(() => [...(photo.annotations || [])]);
  const [tool, setTool] = useState('arrow');
  const [color, setColor] = useState('red');
  const [strokeScale, setStrokeScale] = useState(5); // 1..16, default = legacy
  // Arrow outline/halo so arrows don't get lost on busy slab photos. On by
  // default; colour adjustable.
  const [outlineOn, setOutlineOn] = useState(true);
  const [outlineColor, setOutlineColor] = useState('#111111');
  const [anchor, setAnchor] = useState(null);   // first click (fractional)
  const [hover, setHover] = useState(null);     // mouse-move (fractional)
  const [drawingPath, setDrawingPath] = useState(null);  // active freehand stroke
  // In-progress text annotation. After the user taps the canvas in text mode,
  // a small input field floats over the tap location so they can type the
  // comment inline. Replaces window.prompt() which Electron disables on
  // the .exe build (silently returns null → click dropped on the floor).
  //   { pt: { x, y } fractional 0..1, content: '' }
  const [pendingText, setPendingText] = useState(null);
  const pendingTextInputRef = useRef(null);
  const [redoStack, setRedoStack] = useState([]);        // undone annotations, for redo
  const [presets, setPresets] = useState(loadAnnotationPresets);
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  useEffect(() => { saveAnnotationPresets(presets); }, [presets]);

  const applyPreset = (p) => {
    setTool(p.tool);
    setColor(p.color);
    setStrokeScale(p.strokeScale);
  };
  const isActivePreset = (p) =>
    tool === p.tool && color === p.color && strokeScale === p.strokeScale;
  const updatePreset = (id, patch) =>
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  const removePreset = (id) =>
    setPresets(prev => prev.filter(p => p.id !== id));
  const addPreset = () => {
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPresets(prev => [...prev, {
      id, label: 'New preset', tool: 'freehand', color: '#3a8de8', strokeScale: 5,
    }]);
  };
  const resetPresets = () => setPresets(DEFAULT_PRESETS);

  // ---- Zoom & pan (desktop-tuned) ----------------------------------------
  // Annotations are stored in 0..1 image coords, so the visual zoom is a pure
  // CSS transform on the image+canvas stage — getFractionalCoords keeps working
  // unchanged at any zoom, and the photo stays crisp (browser re-samples the
  // <img>). Wheel zooms toward the cursor; 🖐 Pan or middle-drag moves.
  const MIN_ZOOM = 1, MAX_ZOOM = 8;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const panDragRef = useRef(null);   // { x0, y0, panX, panY } while dragging
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = cont.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setZoom(z => {
        const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        setPan(p => {
          if (nz === z) return p;
          if (nz === 1) return { x: 0, y: 0 };
          const lx = (cx - p.x) / z, ly = (cy - p.y) / z;
          return { x: cx - lx * nz, y: cy - ly * nz };
        });
        return nz;
      });
    };
    cont.addEventListener('wheel', onWheel, { passive: false });
    return () => cont.removeEventListener('wheel', onWheel);
  }, []);

  const getFractionalCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches?.[0] || e.changedTouches?.[0];
    const cx = t ? t.clientX : e.clientX;
    const cy = t ? t.clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(1, (cx - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (cy - rect.top) / rect.height)),
    };
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const container = containerRef.current;
    if (!canvas || !img || !container) return;
    // Canvas overlays the image exactly (absolute inset:0 inside the stage), so
    // we only size its backing buffer to the displayed image — no positioning
    // math. The CSS transform on the stage handles zoom/pan for image+canvas.
    const w = img.clientWidth, h = img.clientHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    annotations.forEach(a => drawAnnotation(ctx, a, W, H));

    // Preview of in-progress freehand path (solid, full opacity — feels like real ink)
    if (drawingPath && drawingPath.length > 0) {
      const previewColor = ANNOTATION_COLOR_HEX[color] || color;
      ctx.save();
      const minDim = Math.min(W, H);
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = Math.max(1.5, minDim * 0.0012 * strokeScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(drawingPath[0].x * W, drawingPath[0].y * H);
      for (let i = 1; i < drawingPath.length - 1; i++) {
        const xc = ((drawingPath[i].x + drawingPath[i + 1].x) / 2) * W;
        const yc = ((drawingPath[i].y + drawingPath[i + 1].y) / 2) * H;
        ctx.quadraticCurveTo(drawingPath[i].x * W, drawingPath[i].y * H, xc, yc);
      }
      if (drawingPath.length > 1) {
        const last = drawingPath[drawingPath.length - 1];
        ctx.lineTo(last.x * W, last.y * H);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Preview of in-progress shape (arrow/circle/rect — dashed during drag)
    if (anchor && hover) {
      const previewColor = ANNOTATION_COLOR_HEX[color] || color;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([5, 4]);
      const minDim = Math.min(W, H);
      ctx.strokeStyle = previewColor;
      ctx.fillStyle = previewColor;
      ctx.lineWidth = Math.max(1.5, minDim * 0.0012 * strokeScale);
      if (tool === 'arrow' || tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(anchor.x * W, anchor.y * H);
        ctx.lineTo(hover.x * W, hover.y * H);
        ctx.stroke();
      } else if (tool === 'circle') {
        const dx = (hover.x - anchor.x) * W;
        const dy = (hover.y - anchor.y) * H;
        const r = Math.hypot(dx, dy);
        ctx.beginPath();
        ctx.arc(anchor.x * W, anchor.y * H, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'rect') {
        const x = Math.min(anchor.x, hover.x) * W;
        const y = Math.min(anchor.y, hover.y) * H;
        const w = Math.abs(hover.x - anchor.x) * W;
        const h = Math.abs(hover.y - anchor.y) * H;
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    }
  };

  useEffect(redraw, [annotations, anchor, hover, tool, color, strokeScale, drawingPath]);

  useEffect(() => {
    const handler = () => redraw();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [annotations, anchor, hover]);

  const handleStart = (e) => {
    // Pan takes priority: 🖐 Pan tool (left-drag) or middle-mouse drag.
    if (panMode || e.button === 1) {
      e.preventDefault();
      panDragRef.current = { x0: e.clientX, y0: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (tool !== 'freehand') return;
    e.preventDefault();
    const pt = getFractionalCoords(e);
    if (!pt) return;
    setDrawingPath([pt]);
  };

  const handleEnd = (e) => {
    if (panDragRef.current) { panDragRef.current = null; return; }
    if (tool !== 'freehand' || !drawingPath) return;
    e.preventDefault();
    if (drawingPath.length >= 2) {
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      pushAnnotation({ id, type: 'freehand', color, points: drawingPath, strokeScale });
    }
    setDrawingPath(null);
  };

  const handleClick = (e) => {
    if (panMode || panDragRef.current) return;
    if (tool === 'freehand') return;
    e.preventDefault();
    let pt = getFractionalCoords(e);
    if (!pt) return;
    // Shift snaps line/arrow endpoints to 15° increments
    if (e.shiftKey && anchor && (tool === 'line' || tool === 'arrow')) {
      pt = snapToAngle(anchor, pt, 15);
    }
    if (tool === 'text') {
      // If there's an in-progress comment, commit whatever's typed before
      // opening a new one at the new spot — so the user doesn't lose work
      // by accidentally tapping elsewhere on the canvas.
      if (pendingText && pendingText.content && pendingText.content.trim()) {
        pushAnnotation({
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'text', color, position: pendingText.pt,
          content: pendingText.content.trim(), fontSize: 14, strokeScale,
        });
      }
      // Stamp the spot — a useEffect below focuses the input once React
      // has actually committed the new <input> to the DOM. The old
      // setTimeout(30 ms) sometimes lost the focus race on slower
      // Electron hardware → boss reported "won't let me type" because
      // the input was never focused.
      setPendingText({ pt, content: '', stamp: Date.now() });
      return;
    }
    if (!anchor) {
      setAnchor(pt);
      setHover(pt);
    } else {
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let ann = null;
      if (tool === 'arrow') {
        ann = { id, type: 'arrow', color, start: anchor, end: pt, strokeScale, outline: outlineOn, outlineColor: outlineOn ? outlineColor : undefined };
      } else if (tool === 'line') {
        ann = { id, type: 'line', color, start: anchor, end: pt, strokeScale };
      } else if (tool === 'circle') {
        const W = canvasRef.current.width, H = canvasRef.current.height;
        const dx = (pt.x - anchor.x) * W;
        const dy = (pt.y - anchor.y) * H;
        const radiusPx = Math.hypot(dx, dy);
        const radius = radiusPx / Math.min(W, H);
        ann = { id, type: 'circle', color, center: anchor, radius, strokeScale };
      } else if (tool === 'rect') {
        ann = {
          id, type: 'rect', color, strokeScale,
          topLeft:     { x: Math.min(anchor.x, pt.x), y: Math.min(anchor.y, pt.y) },
          bottomRight: { x: Math.max(anchor.x, pt.x), y: Math.max(anchor.y, pt.y) },
        };
      }
      if (ann) pushAnnotation(ann);
      setAnchor(null);
      setHover(null);
    }
  };

  // Tag each new annotation with the preset it was drawn under (if the current
  // tool+color+thickness still matches one) so undo can name what it removes.
  const pushAnnotation = (a) => {
    const match = presets.find(p =>
      p.tool === tool && p.color === color && p.strokeScale === strokeScale);
    const tagged = match ? { ...a, presetLabel: match.label } : a;
    setAnnotations(prev => [...prev, tagged]);
    setRedoStack([]); // a fresh action invalidates the redo history
  };

  const handleMove = (e) => {
    if (panDragRef.current) {
      const d = panDragRef.current;
      setPan({ x: d.panX + (e.clientX - d.x0), y: d.panY + (e.clientY - d.y0) });
      return;
    }
    if (tool === 'freehand') {
      if (!drawingPath) return;
      e.preventDefault();
      const pt = getFractionalCoords(e);
      if (pt) setDrawingPath(prev => (prev ? [...prev, pt] : [pt]));
      return;
    }
    if (!anchor || tool === 'text') return;
    e.preventDefault();
    let pt = getFractionalCoords(e);
    if (!pt) return;
    // Shift snaps lines/arrows to 15° increments
    if (e.shiftKey && (tool === 'line' || tool === 'arrow') && anchor) {
      pt = snapToAngle(anchor, pt, 15);
    }
    setHover(pt);
  };

  const undo = () => {
    if (annotations.length === 0) return;
    setRedoStack(r => [...r, annotations[annotations.length - 1]]);
    setAnnotations(prev => prev.slice(0, -1));
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setAnnotations(prev => [...prev, last]);
    setRedoStack(prev => prev.slice(0, -1));
  };
  const clearAll = () => {
    if (confirm('Clear all annotations on this scan?')) {
      setAnnotations([]);
      setRedoStack([]);
    }
  };

  // Human-friendly name for what undo will remove next
  const TYPE_NAMES = { freehand: 'draw', line: 'line', arrow: 'arrow', circle: 'circle', rect: 'box', text: 'label' };
  const lastAnn = annotations[annotations.length - 1];
  const undoLabel = lastAnn ? (lastAnn.presetLabel || TYPE_NAMES[lastAnn.type] || lastAnn.type) : '';

  const save = () => onSave(annotations);

  useEffect(() => {
    setAnchor(null);
    setHover(null);
    setDrawingPath(null);
  }, [tool]);

  // Focus the inline comment input once it's actually in the DOM. This
  // runs after React commits, so the ref is guaranteed populated — no
  // racy setTimeout, no autoFocus quirks on Electron. Re-fires every time
  // a new comment spot is opened (key on pendingText.stamp).
  useEffect(() => {
    if (!pendingText) return;
    const el = pendingTextInputRef.current;
    if (!el) return;
    // Two-tick focus: rAF for the DOM to paint, then a microtask retry in
    // case something stole focus on the same frame (the canvas's click
    // bubble, for example).
    const r1 = requestAnimationFrame(() => {
      el.focus();
      el.select?.();
      queueMicrotask(() => {
        if (document.activeElement !== el) el.focus();
      });
    });
    return () => cancelAnimationFrame(r1);
  }, [pendingText?.stamp]);

  // Draw-color swatches mirror the report's editable Markup Color Key, so you
  // can annotate in a client's exact palette (not just print a legend that
  // says so). Deduped by hex; falls back to the built-in defaults.
  const swatchColors = (() => {
    const seen = new Set();
    const out = [];
    (colorLegend || []).forEach(e => {
      const hex = (e.color || '').toLowerCase();
      if (hex && !seen.has(hex)) { seen.add(hex); out.push({ hex: e.color, label: e.label || e.color }); }
    });
    return out.length ? out : ANNOTATION_COLORS.map(co => ({ hex: co.hex, label: co.id }));
  })();
  // Resolve the current color to a hex so a swatch highlights whether the color
  // was picked by id ('red'), preset, legend swatch, or custom picker.
  const activeHex = (ANNOTATION_COLOR_HEX[color] || color || '').toLowerCase();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.95)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '10px 12px', background: c.bgRaised,
        borderBottom: `1px solid ${c.borderStrong}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>
          🖊 Annotate scan
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="ghost" onClick={onClose} style={{ fontSize: 12 }}>Cancel</Btn>
          <Btn variant="primary" onClick={save} style={{ fontSize: 12 }}>✓ Save</Btn>
        </div>
      </div>

      <div ref={containerRef} style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
      }}>
        <div style={{
          position: 'relative', display: 'inline-block',
          maxWidth: '100%', maxHeight: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: panDragRef.current ? 'none' : 'transform .08s ease-out',
          willChange: 'transform',
        }}>
          <img
            ref={imgRef}
            src={photoSrc(photo)}
            alt="scan"
            onLoad={redraw}
            draggable={false}
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain', display: 'block', userSelect: 'none',
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              touchAction: 'none',
              cursor: panMode ? (panDragRef.current ? 'grabbing' : 'grab')
                : (tool === 'text' ? 'text' : 'crosshair'),
            }}
            onClick={handleClick}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={tool === 'freehand' ? handleStart : handleClick}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>
        {/* Inline text-annotation input — opens at the tap point in text mode.
            Replaces window.prompt(), which Electron disables. */}
        {pendingText && (() => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const cr = canvas.getBoundingClientRect();
          const co = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
          // Convert fractional pt → CSS pixels relative to the container.
          const W = cr.width, H = cr.height;
          const px = (cr.left - co.left) + pendingText.pt.x * W;
          const py = (cr.top  - co.top)  + pendingText.pt.y * H;
          const commit = () => {
            const text = (pendingText.content || '').trim();
            if (text) {
              pushAnnotation({
                id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'text', color, position: pendingText.pt,
                content: text, fontSize: 14, strokeScale,
              });
            }
            setPendingText(null);
          };
          const cancel = () => setPendingText(null);
          // Position the input so it stays inside the canvas regardless of where
          // the tap landed — clamp to the right/bottom edges.
          const inputW = 220;
          const left = Math.max(8, Math.min(px + 8, (cr.left - co.left) + W - inputW - 8));
          const top  = Math.max(8, Math.min(py + 8, (cr.top  - co.top)  + H - 80));
          return (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', left, top, zIndex: 5,
                background: c.bgRaised, border: `1px solid ${c.accent}`,
                borderRadius: 6, padding: 6, width: inputW,
                boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
              <div style={{ fontSize: 10, color: c.textFaint, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Comment for this spot
              </div>
              <input
                key={pendingText.stamp}
                ref={pendingTextInputRef}
                value={pendingText.content}
                onChange={(e) => {
                  const v = e.target.value;
                  setPendingText(p => p ? { ...p, content: v } : p);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  { e.preventDefault(); commit(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                // Stop pointer events from leaking to the canvas below.
                // Without this, clicking the input could (on some Electron
                // setups) re-trigger handleClick → setPendingText with
                // empty content, wiping what the user is mid-typing.
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  // Defensive: if focus didn't land here, force it now.
                  if (document.activeElement !== e.currentTarget) e.currentTarget.focus();
                }}
                placeholder="Type a comment, then Enter…"
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: c.bg, color: c.text,
                  border: `1px solid ${c.borderStrong}`, borderRadius: 4,
                  padding: '6px 8px', fontSize: 13, fontFamily: 'inherit',
                }} />
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={commit}
                  style={{
                    flex: 1, background: c.accent, color: '#fff', border: 'none',
                    borderRadius: 4, padding: '5px 8px',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>✓ Add</button>
                <button onClick={cancel}
                  style={{
                    background: 'transparent', color: c.textDim,
                    border: `1px solid ${c.border}`, borderRadius: 4,
                    padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                  }}>Cancel</button>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{
        padding: '6px 10px', background: c.bgRaised,
        borderTop: `1px solid ${c.borderStrong}`,
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        {/* === Preset chips — quick-switch color/thickness/tool combos === */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {presets.map(p => {
            const active = isActivePreset(p);
            return (
              <button key={p.id} onClick={() => applyPreset(p)}
                title={`${p.label} · ${p.tool} · thickness ${p.strokeScale}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: active ? c.accentDim : c.cardAlt,
                  border: `1px solid ${active ? c.accent : c.border}`,
                  borderRadius: 14, padding: '4px 9px',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  color: active ? c.onAccentDim : c.text, whiteSpace: 'nowrap',
                }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: p.color, border: '1px solid rgba(255,255,255,0.15)',
                }} />
                {p.label}
              </button>
            );
          })}
          <button onClick={() => setShowPresetEditor(s => !s)}
            title={showPresetEditor ? 'Close preset editor' : 'Customize presets'}
            style={{
              background: showPresetEditor ? c.cardAlt : 'transparent',
              border: `1px dashed ${c.border}`,
              borderRadius: 14, padding: '4px 9px',
              cursor: 'pointer', fontSize: 11, color: c.textDim,
            }}>
            ⚙ {showPresetEditor ? 'Close' : 'Edit'}
          </button>
        </div>

        {showPresetEditor && (
          <div style={{
            background: c.cardAlt, border: `1px solid ${c.border}`,
            borderRadius: 6, padding: 8, fontSize: 11,
          }}>
            <div style={{ fontSize: 10.5, color: c.textFaint, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Customize presets (saved on this device)
            </div>
            {presets.map(p => (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
                gap: 5, alignItems: 'center', marginBottom: 4,
              }}>
                <input value={p.label}
                  onChange={e => updatePreset(p.id, { label: e.target.value })}
                  style={{
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    borderRadius: 4, padding: '4px 6px', fontSize: 11, minWidth: 0,
                  }} />
                <select value={p.tool}
                  onChange={e => updatePreset(p.id, { tool: e.target.value })}
                  style={{
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    borderRadius: 4, padding: '4px 4px', fontSize: 11,
                  }}>
                  <option value="freehand">Draw</option>
                  <option value="line">Line</option>
                  <option value="arrow">Arrow</option>
                  <option value="circle">Circle</option>
                  <option value="rect">Rect</option>
                </select>
                <input type="color" value={p.color}
                  onChange={e => updatePreset(p.id, { color: e.target.value })}
                  style={{
                    width: 28, height: 24, padding: 0, cursor: 'pointer',
                    background: 'transparent', border: `1px solid ${c.border}`,
                    borderRadius: 4,
                  }} />
                <input type="range" min="1" max="16" value={p.strokeScale}
                  onChange={e => updatePreset(p.id, { strokeScale: Number(e.target.value) })}
                  title={`Thickness ${p.strokeScale}`}
                  style={{ width: 70, accentColor: c.accent }} />
                <button onClick={() => removePreset(p.id)}
                  title="Delete preset"
                  style={{
                    background: 'transparent', border: 'none', color: c.textFaint,
                    cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
                  }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              <Btn variant="ghost" onClick={addPreset} style={{ fontSize: 11, flex: 1 }}>
                + Add preset
              </Btn>
              <Btn variant="ghost" onClick={resetPresets}
                style={{ fontSize: 11, color: c.textFaint }}
                title="Restore the original 5 presets">
                ↺ Reset
              </Btn>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
          {[
            { id: 'freehand', label: '✎ Draw' },
            { id: 'line',     label: '— Line' },
            { id: 'arrow',    label: '→ Arrow' },
            { id: 'circle',   label: '○ Circle' },
            { id: 'rect',     label: '▭ Rect' },
            { id: 'text',     label: 'T Text' },
          ].map(opt => (
            <button key={opt.id}
              onClick={() => setTool(opt.id)}
              style={{
                background: tool === opt.id ? c.accentDim : c.cardAlt,
                border: `1px solid ${tool === opt.id ? c.accent : c.border}`,
                borderRadius: 6, padding: '5px 4px',
                color: tool === opt.id ? c.onAccentDim : c.text,
                fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}>{opt.label}</button>
          ))}
        </div>
        {tool === 'arrow' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: c.textDim }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={outlineOn}
                onChange={e => setOutlineOn(e.target.checked)}
                style={{ accentColor: c.accent }} />
              <span>Arrow outline <span style={{ color: c.textFaint }}>(stops it getting lost on busy photos)</span></span>
            </label>
            {outlineOn && (
              <label title="Outline color" style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 4, overflow: 'hidden', border: `1px solid ${c.border}`, cursor: 'pointer', flexShrink: 0 }}>
                <input type="color" value={outlineColor}
                  onChange={e => setOutlineColor(e.target.value)}
                  style={{ width: '150%', height: '150%', margin: '-25%', cursor: 'pointer', border: 'none', padding: 0, background: 'none' }} />
              </label>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setPanMode(m => !m)}
            title="Pan / move the photo (or hold middle-mouse and drag). Scroll to zoom."
            style={{
              background: panMode ? c.accentDim : c.cardAlt,
              border: `1px solid ${panMode ? c.accent : c.border}`,
              borderRadius: 6, padding: '7px 11px',
              color: panMode ? c.onAccentDim : c.text,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>🖐 Pan</button>
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z / 1.25).toFixed(2)))}
            title="Zoom out" style={{ fontSize: 16, padding: '4px 12px' }} disabled={zoom <= MIN_ZOOM}>−</Btn>
          <span style={{ fontSize: 12, color: c.textDim, minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(zoom * 100)}%
          </span>
          <Btn variant="ghost" onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z * 1.25).toFixed(2)))}
            title="Zoom in" style={{ fontSize: 16, padding: '4px 12px' }} disabled={zoom >= MAX_ZOOM}>+</Btn>
          <Btn variant="ghost" onClick={resetView}
            title="Reset zoom & position" style={{ fontSize: 12 }}
            disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>Reset view</Btn>
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: c.textDim,
        }}>
          <span style={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Thickness <span style={{ color: c.text }}>{strokeScale}</span>
          </span>
          <input type="range" min="1" max="16" step="1"
            value={strokeScale}
            onChange={e => setStrokeScale(Number(e.target.value))}
            style={{ flex: 1, accentColor: c.accent }} />
        </label>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            {swatchColors.map(sw => (
              <button key={sw.hex}
                onClick={() => setColor(sw.hex)}
                title={sw.label}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: sw.hex, cursor: 'pointer',
                  border: activeHex === sw.hex.toLowerCase() ? `3px solid ${c.text}` : `1px solid ${c.border}`,
                }} />
            ))}
            <label title="Custom color"
              style={{
                position: 'relative', display: 'inline-flex',
                width: 24, height: 24, borderRadius: '50%',
                background: typeof color === 'string' && color.startsWith('#') ? color : 'conic-gradient(red, orange, yellow, green, blue, purple, red)',
                cursor: 'pointer', overflow: 'hidden',
                border: typeof color === 'string' && color.startsWith('#') ? `3px solid ${c.text}` : `1px solid ${c.border}`,
              }}>
              <input type="color"
                value={typeof color === 'string' && color.startsWith('#') ? color : '#e84a4a'}
                onChange={e => setColor(e.target.value)}
                style={{
                  position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
                  width: '100%', height: '100%',
                }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" onClick={undo}
              title={undoLabel ? `Undo ${undoLabel}` : 'Nothing to undo'}
              style={{ fontSize: 12 }} disabled={annotations.length === 0}>
              ↶ Undo{undoLabel ? ` ${undoLabel}` : ''}
            </Btn>
            <Btn variant="ghost" onClick={redo}
              title="Redo last undone annotation"
              style={{ fontSize: 12 }} disabled={redoStack.length === 0}>↷ Redo</Btn>
            <Btn variant="ghost" onClick={clearAll}
              style={{ fontSize: 12 }} disabled={annotations.length === 0}>Clear</Btn>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: c.textFaint, textAlign: 'center', lineHeight: 1.35 }}>
          {tool === 'freehand'
            ? 'Press and drag to draw a smooth line. Release to finish.'
            : tool === 'text'
              ? 'Tap to place a text label.'
              : anchor
                ? `Tap to finish the ${tool}.${(tool === 'line' || tool === 'arrow') ? ' Hold Shift to snap to 15° angles.' : ''}`
                : `Tap to start the ${tool}.${(tool === 'line' || tool === 'arrow') ? ' Hold Shift while dragging for angle-snap.' : ''}`}
          <span style={{ opacity: 0.7 }}> · Scroll to zoom · 🖐 Pan to move</span>
        </div>
      </div>
    </div>
  );
}

// What's-new dialog. Pops up the first time the user opens a new version so
// Floating button bottom-right that opens a menu of visible sections. Tap
// a section name to smooth-scroll to it. Replaces hunting through a long
// vertical report.
// Simple floating scratchpad (bottom-right). Saves to this browser only — it's
// never part of the report or the PDF. Deliberately minimal: a base to grow
// into something richer (per-report notes, checklists) in v3.
function Notepad() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => {
    try { return localStorage.getItem('ak_notepad') || ''; } catch { return ''; }
  });
  const onChange = (v) => {
    setText(v);
    try { localStorage.setItem('ak_notepad', v); } catch {}
  };
  return (
    <div className="no-print" style={{
      position: 'fixed', right: 14, bottom: 70, zIndex: 90,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
    }}>
      {open && (
        <div style={{
          background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
          borderRadius: 8, padding: 10, width: 290,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: c.textFaint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Notepad</span>
            {text && (
              <button onClick={() => onChange('')} title="Clear the notepad"
                style={{ background: 'transparent', border: 0, color: c.textFaint, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
            )}
          </div>
          <textarea value={text} onChange={e => onChange(e.target.value)}
            placeholder="Quick notes, reminders, to-dos… saved in this browser only."
            style={{
              width: '100%', height: 160, resize: 'vertical', boxSizing: 'border-box',
              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              borderRadius: 6, padding: 8, fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.45,
            }} />
          <div style={{ fontSize: 10, color: c.textFaint, marginTop: 5 }}>Saved on this device · never prints</div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        title="Scratch notepad" aria-label="Notepad"
        style={{
          background: c.cardAlt, color: c.text,
          border: `1px solid ${c.borderStrong}`, borderRadius: 22,
          padding: '9px 12px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
        {open ? '✕' : '📝'} Notepad
      </button>
    </div>
  );
}

// Floating, toggleable on-screen shortcuts cheat-sheet (bottom-left). Never
// prints. Remembers open/closed. Covers the mouse/keyboard moves that aren't
// obvious from buttons (zoom, pan, angle-snap, reorder).
function ShortcutsPanel() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('ak_shortcuts_open') === '1'; } catch { return false; }
  });
  const toggle = () => setOpen(o => {
    const n = !o;
    try { localStorage.setItem('ak_shortcuts_open', n ? '1' : '0'); } catch {}
    return n;
  });
  const groups = [
    { title: 'Scan-photo annotator', items: [
      ['Scroll wheel', 'Zoom in / out (toward the cursor)'],
      ['🖐 Pan / middle-drag', 'Move around when zoomed in'],
      ['Shift + drag', 'Snap a line/arrow to 15°'],
      ['Enter / Esc', 'Save / cancel a text label'],
    ] },
    { title: 'Side panel · sections', items: [
      ['Checkbox', 'Add or leave a section out'],
      ['▲ ▼ or drag', 'Reorder (report + PDF together)'],
      ['Section name', 'Jump to that section'],
      ['Reset', 'Default order + every section on'],
    ] },
    { title: 'At a glance', items: [
      ['Safe / Caution / No-go', 'List those cores'],
      ['A core chip', 'Jump to that core card'],
    ] },
    { title: 'Report editor', items: [
      ['👁 Preview', 'See the exact PDF page'],
      ['Markup color key', 'Click a swatch to recolor'],
      ['📝 Notepad', 'Private notes (this device only)'],
      ['Esc', 'Cancel the current action'],
    ] },
  ];
  return (
    <div className="no-print" style={{
      position: 'fixed', left: 14, bottom: 70, zIndex: 90,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
    }}>
      {open && (
        <div style={{
          background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
          borderRadius: 8, padding: '8px 10px',
          maxHeight: '62vh', overflowY: 'auto',
          minWidth: 256, maxWidth: 310,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}>
          {groups.map(g => (
            <div key={g.title} style={{ marginBottom: 9 }}>
              <div style={{
                fontSize: 10, color: c.textFaint, fontWeight: 700,
                letterSpacing: 1, textTransform: 'uppercase', padding: '2px 2px 6px',
              }}>{g.title}</div>
              {g.items.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, padding: '3px 2px', fontSize: 12, lineHeight: 1.4 }}>
                  <span style={{ flex: '0 0 auto', fontWeight: 700, color: c.text, minWidth: 110 }}>{k}</span>
                  <span style={{ color: c.textDim }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{
            fontSize: 10, color: c.textFaint, paddingTop: 5,
            borderTop: `1px solid ${c.border}`, marginTop: 1,
          }}>On-screen only — never prints.</div>
        </div>
      )}
      <button onClick={toggle}
        title="Keyboard & mouse shortcuts"
        aria-label="Shortcuts"
        style={{
          background: c.cardAlt, color: c.text,
          border: `1px solid ${c.borderStrong}`, borderRadius: 22,
          padding: '9px 12px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
        {open ? '✕' : '⌨'} Shortcuts
      </button>
    </div>
  );
}

// they immediately see what changed. Each item can scroll the user to the
// section it touches via "Take me there".
function WhatsNewModal({ entries, onClose }) {
  if (!entries || entries.length === 0) return null;
  const jumpTo = (item) => {
    let el = null;
    if (item.anchorId) el = document.getElementById(item.anchorId);
    if (!el && item.anchorClass) el = document.querySelector('.' + item.anchorClass);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Flash a brief outline so the user can see what landed.
      el.style.transition = 'box-shadow 0.4s';
      el.style.boxShadow = `0 0 0 3px ${c.accent}`;
      setTimeout(() => { el.style.boxShadow = ''; }, 1500);
    }
    onClose();
  };
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 14,
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: c.card, border: `1px solid ${c.borderStrong}`,
          borderRadius: 10, maxWidth: 540, width: '100%',
          maxHeight: '88vh', overflowY: 'auto',
          color: c.text, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
        <div style={{
          padding: '16px 18px', borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: c.textFaint, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
              What's new
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
              AK ScanReport · v{entries[0].version}
            </div>
            {entries[0].headline && (
              <div style={{ fontSize: 12, color: c.textDim, marginTop: 3 }}>
                {entries[0].headline}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{
              background: 'transparent', border: 'none', color: c.text,
              fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1,
            }}>×</button>
        </div>
        <div style={{ padding: '12px 18px 18px' }}>
          {entries.map((entry, ei) => (
            <div key={entry.version} style={{
              borderTop: ei === 0 ? 'none' : `1px solid ${c.border}`,
              marginTop: ei === 0 ? 0 : 14, paddingTop: ei === 0 ? 0 : 14,
            }}>
              {ei > 0 && (
                <div style={{ fontSize: 12, color: c.textFaint, marginBottom: 6, fontWeight: 700 }}>
                  v{entry.version} · {entry.headline}
                </div>
              )}
              {entry.items.map((item, i) => (
                <div key={i} style={{
                  padding: '10px 11px', marginBottom: 7,
                  background: c.cardAlt, borderRadius: 7,
                  border: `1px solid ${c.border}`,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.title}</div>
                    {(item.anchorId || item.anchorClass) && (
                      <button
                        onClick={() => jumpTo(item)}
                        style={{
                          background: c.accent, color: c.onAccent || '#fff',
                          border: 'none', borderRadius: 5,
                          padding: '5px 9px', fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                        }}>Take me there →</button>
                    )}
                  </div>
                  {item.body && (
                    <div style={{ fontSize: 12, color: c.textDim, marginTop: 5, lineHeight: 1.45 }}>
                      {item.body}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', marginTop: 8,
          }}>
            <Btn variant="primary" onClick={onClose} style={{ fontSize: 12 }}>
              Got it
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Full-size photo viewer (lightbox). Tapping a thumbnail opens the photo large
// with its markup, so uploaded photos can actually be looked at on a phone.
function PhotoLightbox({ photo, onClose }) {
  if (!photo) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.88)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <button
        onClick={onClose} aria-label="Close photo"
        style={{
          position: 'absolute', top: 14, right: 16, zIndex: 2,
          background: 'rgba(255,255,255,0.16)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.45)', borderRadius: 8,
          padding: '8px 13px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
        }}>
        ✕ Close
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflow: 'auto' }}>
        <AnnotatedImage
          src={photoSrc(photo)}
          annotations={photo.annotations || []}
          alt={photo.caption || 'Scan photo'}
          style={{ width: 'min(94vw, 1100px)' }}
        />
        {photo.caption && (
          <div style={{ color: '#fff', fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
            {photo.caption}
          </div>
        )}
      </div>
    </div>
  );
}

// Uncontrolled caption input. We keep the textarea uncontrolled so React never
// re-renders the DOM mid-keystroke — a controlled textarea was fighting the
// Android keyboard, resetting the cursor and dropping selections (so long-press
// copy/paste didn't work). External value changes (cloud sync, undo, switching
// reports) are written to the DOM imperatively, but only when the user isn't
// actively editing. Commits to the (multi-MB) report stay debounced to 400ms
// idle / blur so typing is snappy regardless of report size.
function CaptionField({ value, onCommit, style, ...rest }) {
  const ref = useRef(null);
  const editingRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || editingRef.current) return;
    const next = value ?? '';
    if (el.value !== next) el.value = next;
  }, [value]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    editingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { editingRef.current = false; onCommit(v); }, 400);
  };
  const handleBlur = (e) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    editingRef.current = false;
    const cur = e.target.value;
    if ((value ?? '') !== cur) onCommit(cur);
  };

  return (
    <textarea
      ref={ref}
      defaultValue={value ?? ''}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{
        width: '100%', background: c.cardAlt,
        border: `1px solid ${c.border}`, borderRadius: 6,
        padding: '10px 12px', color: c.text, fontSize: 16,
        fontFamily: 'inherit', boxSizing: 'border-box',
        resize: 'vertical', minHeight: 64,
        ...style,
      }}
      {...rest}
    />
  );
}

function ScanPhotos({ report, update }) {
  const fileInputRef = useRef(null);
  const cameraRef    = useRef(null);
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [viewingPhotoId, setViewingPhotoId] = useState(null);
  const [dragPhotoId, setDragPhotoId] = useState(null);
  const [overPhotoId, setOverPhotoId] = useState(null);
  // IDs of photos that were just uploaded and haven't been annotated or
  // dismissed yet. Each row shows an "Annotate now? / Not now" prompt next
  // to the photo so the engineer can either open the editor or keep working
  // on whatever they're focused on.
  const [pendingAnnotateIds, setPendingAnnotateIds] = useState(() => new Set());
  const dismissAnnotatePrompt = (id) => {
    setPendingAnnotateIds(prev => {
      const next = new Set(prev); next.delete(id); return next;
    });
  };

  const reorderPhotos = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const list = [...report.scanPhotos];
    const fromIdx = list.findIndex(p => p.id === fromId);
    const toIdx   = list.findIndex(p => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    update({ scanPhotos: list });
  };

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const loaded = await Promise.all(files.map(async (file) => {
      const detected = parseScanFilename(file.name || '');
      const dataUrl = await compressImage(file);
      if (!dataUrl) return null;
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl,
        caption: '',
        confidence: 'high',
        pinRef: '',
        scanType: detected.scanType || 'site',
        locationRef: detected.locationRef || '',
        scaleInfo: detected.scaleInfo || '',
        panelGroup: '',
        panelLabel: '',
        annotations: [],
      };
    }));
    update({ scanPhotos: [...report.scanPhotos, ...loaded.filter(Boolean)] });
    // Queue an annotate prompt for each new photo so the engineer can decide
    // whether to mark it up now or defer.
    setPendingAnnotateIds(prev => {
      const next = new Set(prev);
      loaded.filter(Boolean).forEach(p => next.add(p.id));
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const editingPhoto = report.scanPhotos.find(p => p.id === editingPhotoId);
  const viewingPhoto = report.scanPhotos.find(p => p.id === viewingPhotoId);

  const updatePhoto = (id, patch) => {
    update({
      scanPhotos: report.scanPhotos.map(p => p.id === id ? { ...p, ...patch } : p),
    });
  };

  const removePhoto = (id) => {
    update({ scanPhotos: report.scanPhotos.filter(p => p.id !== id) });
  };

  const movePhoto = (id, dir) => {
    const idx = report.scanPhotos.findIndex(p => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= report.scanPhotos.length) return;
    const next = [...report.scanPhotos];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    update({ scanPhotos: next });
  };

  const grouped = CONFIDENCE_ORDER.map(level => ({
    level,
    meta: CONFIDENCE_META[level],
    photos: report.scanPhotos.filter(p => (p.confidence || 'high') === level),
  }));

  return (
    <Card title="Scan photos" badge={
      <span style={{
        background: c.cardAlt, color: c.textDim, fontSize: 11,
        padding: '2px 8px', borderRadius: 4, fontWeight: 500,
      }}>{report.scanPhotos.length}</span>
    }>
      <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
        Add photos of the scanned area with markup, obstructions, or context shots.
        Each photo is grouped by confidence and embedded into the PDF.
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <label style={{
          display: 'block', background: c.accent, border: `1px solid ${c.accent}`,
          borderRadius: 6, padding: '11px', textAlign: 'center', fontSize: 13,
          color: '#fff', cursor: 'pointer', fontWeight: 700,
        }}>
          📷 Take photo
          <input ref={cameraRef} type="file" accept="image/*"
            capture="environment" onChange={addPhotos} style={{ display: 'none' }} />
        </label>
        <label style={{
          display: 'block', background: c.cardAlt, border: `1px dashed ${c.borderStrong}`,
          borderRadius: 6, padding: '11px', textAlign: 'center', fontSize: 13,
          color: c.text, cursor: 'pointer', fontWeight: 500,
        }}>
          📂 From library
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={addPhotos} style={{ display: 'none' }} />
        </label>
      </div>

      {report.scanPhotos.length === 0 ? (
        <div style={{
          padding: '14px', textAlign: 'center', fontSize: 12,
          color: c.textFaint, background: c.cardAlt, borderRadius: 6,
        }}>
          No photos yet.
        </div>
      ) : grouped.map(group => {
        if (group.photos.length === 0) return null;
        return (
          <div key={group.level} style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 9px', marginBottom: 7,
              background: group.meta.bg,
              borderLeft: `3px solid ${group.meta.color}`,
              borderRadius: '0 4px 4px 0',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                color: group.meta.color, textTransform: 'uppercase',
              }}>{group.meta.label}</span>
              <span style={{ fontSize: 11, color: c.textDim }}>
                · {group.photos.length} photo{group.photos.length === 1 ? '' : 's'}
              </span>
            </div>

            {group.photos.map((photo, idxInGroup) => {
              const globalIdx = report.scanPhotos.findIndex(p => p.id === photo.id);
              const annotationCount = (photo.annotations || []).length;
              // Trailing odd photo in a group has no 2-up partner, so it would
              // otherwise sit half-width with blank space beside it. Flip it to a
              // full-width side-by-side figure (image + info panel) instead.
              const isSoloFigure =
                idxInGroup === group.photos.length - 1 && group.photos.length % 2 === 1;
              return (
                <div key={photo.id}
                  className={
                    'scan-photo-row' +
                    (isSoloFigure ? ' scan-photo-row--solo' : '') +
                    (dragPhotoId === photo.id ? ' dragging' : '') +
                    (overPhotoId === photo.id && dragPhotoId && dragPhotoId !== photo.id ? ' drop-target' : '')
                  }
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', photo.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragPhotoId(photo.id);
                  }}
                  onDragOver={(e) => {
                    if (!dragPhotoId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (overPhotoId !== photo.id) setOverPhotoId(photo.id);
                  }}
                  onDragLeave={() => { if (overPhotoId === photo.id) setOverPhotoId(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData('text/plain') || dragPhotoId;
                    reorderPhotos(fromId, photo.id);
                    setDragPhotoId(null); setOverPhotoId(null);
                  }}
                  onDragEnd={() => { setDragPhotoId(null); setOverPhotoId(null); }}
                  style={{
                    border: `1px solid ${c.border}`, borderRadius: 6,
                    padding: 9, marginBottom: 7, background: c.cardAlt,
                    cursor: 'grab',
                  }}>
                  <div className="no-print">
                  <div style={{
                    display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 7,
                  }}>
                    <div style={{ width: 84, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setViewingPhotoId(photo.id)}
                        title="Open / view full size"
                        aria-label="Open photo full size"
                        style={{
                          position: 'relative', display: 'block', padding: 0,
                          border: 'none', background: 'none', cursor: 'zoom-in', width: 84,
                        }}>
                        <AnnotatedImage
                          src={photoSrc(photo)}
                          annotations={photo.annotations || []}
                          alt={photo.caption || 'Scan photo'}
                          style={{
                            width: 84, height: 84, overflow: 'hidden',
                            borderRadius: 4, border: `1px solid ${c.border}`,
                            pointerEvents: 'none',
                          }}
                        />
                        <span style={{
                          position: 'absolute', bottom: 3, right: 3,
                          background: 'rgba(0,0,0,0.62)', color: '#fff',
                          borderRadius: 4, fontSize: 11, lineHeight: 1,
                          padding: '2px 4px', pointerEvents: 'none',
                        }}>🔍</span>
                      </button>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <CaptionField
                        value={photo.caption}
                        onCommit={v => updatePhoto(photo.id, { caption: v })}
                        placeholder="Caption: what does this photo show?"
                        style={{ minHeight: 56, fontSize: 12, padding: '6px 9px' }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 5 }}>
                        <Select
                          value={photo.scanType || 'site'}
                          onChange={e => updatePhoto(photo.id, { scanType: e.target.value })}
                          style={{ padding: '6px 8px', fontSize: 12 }}
                        >
                          {SCAN_TYPES.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </Select>
                        <Input
                          value={photo.locationRef || ''}
                          onChange={e => updatePhoto(photo.id, { locationRef: e.target.value.toUpperCase() })}
                          placeholder="Loc (L1)"
                          list={`loc-list-${photo.id}`}
                          style={{ padding: '6px 8px', fontSize: 12 }}
                        />
                        <datalist id={`loc-list-${photo.id}`}>
                          {(report.scanLocations || []).map(l => (
                            <option key={l.id} value={l.label} />
                          ))}
                        </datalist>
                      </div>
                      <Input
                        value={photo.scaleInfo || ''}
                        onChange={e => updatePhoto(photo.id, { scaleInfo: e.target.value })}
                        placeholder="Scale (e.g. 0–70 cm × 0–20 in)"
                        style={{ marginTop: 5, padding: '6px 9px', fontSize: 12 }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 5 }}>
                        <Input
                          value={photo.panelGroup || ''}
                          onChange={e => updatePhoto(photo.id, { panelGroup: e.target.value })}
                          placeholder="Panel group"
                          style={{ padding: '6px 9px', fontSize: 12 }}
                        />
                        <Input
                          value={photo.panelLabel || ''}
                          onChange={e => updatePhoto(photo.id, { panelLabel: e.target.value })}
                          placeholder="Sub-label (a/b/c)"
                          style={{ padding: '6px 9px', fontSize: 12 }}
                        />
                      </div>
                      <Input
                        value={photo.pinRef}
                        onChange={e => updatePhoto(photo.id, { pinRef: e.target.value })}
                        placeholder="Refs pin (e.g. A, B)"
                        style={{ marginTop: 5, padding: '6px 9px', fontSize: 12 }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[
                      { id: 'high', label: 'High', color: c.green, bg: c.greenBg },
                      { id: 'med',  label: 'Med',  color: c.amber, bg: c.amberBg },
                      { id: 'low',  label: 'Low',  color: c.red,   bg: c.redBg },
                    ].map(opt => (
                      <button key={opt.id}
                        className={`ak-conf ${photo.confidence === opt.id ? `ak-conf-on ak-conf-${opt.id}` : 'ak-conf-off'}`}
                        onClick={() => updatePhoto(photo.id, { confidence: opt.id })}
                        style={{
                          flex: 1,
                          background: photo.confidence === opt.id ? opt.bg : c.card,
                          color: photo.confidence === opt.id ? opt.color : c.textDim,
                          border: `1px solid ${photo.confidence === opt.id ? opt.color : c.border}`,
                          borderRadius: 4, padding: '5px 6px',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}>{opt.label} conf.</button>
                    ))}
                  </div>
                  {pendingAnnotateIds.has(photo.id) && (
                    <div style={{
                      marginTop: 5, padding: '7px 8px',
                      background: c.accentDim, color: c.onAccentDim,
                      border: `1px solid ${c.accent}`, borderRadius: 5,
                      fontSize: 11, display: 'flex', alignItems: 'center',
                      gap: 6, flexWrap: 'wrap',
                    }}>
                      <span style={{ flex: 1, minWidth: 100 }}>Open annotation editor for this photo?</span>
                      <button
                        onClick={() => { dismissAnnotatePrompt(photo.id); setEditingPhotoId(photo.id); }}
                        style={{
                          background: '#fff', color: '#000', border: 'none',
                          borderRadius: 4, padding: '4px 8px',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>Annotate now</button>
                      <button
                        onClick={() => dismissAnnotatePrompt(photo.id)}
                        style={{
                          background: 'transparent', color: c.onAccentDim,
                          border: '1px solid rgba(255,255,255,0.4)',
                          borderRadius: 4, padding: '4px 8px',
                          fontSize: 11, cursor: 'pointer',
                        }}>Not now</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                    <Btn variant="primary"
                      onClick={() => { dismissAnnotatePrompt(photo.id); setEditingPhotoId(photo.id); }}
                      style={{ flex: 1.4, fontSize: 11, padding: '5px 6px' }}>
                      🖊 Annotate{annotationCount > 0 ? ` (${annotationCount})` : ''}
                    </Btn>
                    <Btn variant="ghost" onClick={() => movePhoto(photo.id, -1)}
                      style={{ flex: 1, fontSize: 11, padding: '5px 6px' }}
                      disabled={globalIdx === 0}>↑ Up</Btn>
                    <Btn variant="ghost" onClick={() => movePhoto(photo.id, 1)}
                      style={{ flex: 1, fontSize: 11, padding: '5px 6px' }}
                      disabled={globalIdx === report.scanPhotos.length - 1}>↓ Down</Btn>
                    <Btn variant="danger" onClick={() => removePhoto(photo.id)}
                      style={{ flex: 1, fontSize: 11, padding: '5px 6px' }}>✕</Btn>
                  </div>
                  </div>{/* /no-print editor */}
                  {/* Print-only clean figure: large photo + caption + confidence */}
                  <div className="print-only photo-print">
                    <AnnotatedImage
                      src={photoSrc(photo)}
                      annotations={photo.annotations || []}
                      alt={photo.caption || 'Scan photo'}
                      style={{ width: '100%', background: '#000', borderRadius: 4, display: 'block' }}
                    />
                    <div className="photo-print-meta">
                      <span className="photo-print-tags">
                        {photo.locationRef && <strong className="photo-print-loc">{photo.locationRef}</strong>}
                        <span className={`ak-conf-badge ak-conf-${photo.confidence || 'high'} photo-print-conf`}>
                          {(photo.confidence || 'high') === 'high' ? 'HIGH' : photo.confidence === 'med' ? 'MED' : 'LOW'} CONF
                        </span>
                      </span>
                      {photo.scaleInfo && <div className="photo-print-scale">{photo.scaleInfo}</div>}
                      {photo.caption && <div className="photo-print-cap">{photo.caption}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {editingPhoto && (
        <AnnotationEditor
          photo={editingPhoto}
          colorLegend={report.colorLegend || APWA_LEGEND}
          onSave={(annotations) => {
            updatePhoto(editingPhoto.id, { annotations });
            setEditingPhotoId(null);
          }}
          onClose={() => setEditingPhotoId(null)}
        />
      )}

      <PhotoLightbox photo={viewingPhoto} onClose={() => setViewingPhotoId(null)} />
    </Card>
  );
}

// ============================================================
// GPR Scans — print section grouping all scans by type
// ============================================================

function GPRScans({ report }) {
  const photos = report.scanPhotos || [];
  if (photos.length === 0) return null;

  // Group by scanType in declared order
  const byType = SCAN_TYPE_ORDER.map(type => ({
    type,
    label: SCAN_TYPE_LABEL[type],
    items: photos.filter(p => (p.scanType || 'site') === type),
  })).filter(g => g.items.length > 0);

  // Within a type, partition into panel-groups + singles
  const partition = (items) => {
    const groups = {};
    const singles = [];
    items.forEach(p => {
      const g = (p.panelGroup || '').trim();
      if (!g) { singles.push(p); return; }
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    return { groups, singles };
  };

  return (
    <Card title="GPR scans · full size">
      <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
        Full-size render of every scan (B-scan, C-scan, Focus, marked-up slab) grouped by
        type. Multi-panel figures (a/b/c) display side-by-side. Annotations are baked in.
      </div>

      {byType.map(group => {
        const { groups, singles } = partition(group.items);
        return (
          <div key={group.type} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
              color: c.textDim, textTransform: 'uppercase',
              padding: '6px 9px', marginBottom: 8,
              borderLeft: `3px solid ${c.accent}`, background: c.cardAlt,
            }}>{group.label} · {group.items.length}</div>

            {/* Multi-panel groups */}
            {Object.entries(groups).map(([gname, items]) => (
              <div key={gname} className="gpr-scan-figure gpr-panel-group" style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10,
              }}>
                {items
                  .slice()
                  .sort((a, b) => (a.panelLabel || '').localeCompare(b.panelLabel || ''))
                  .map(p => (
                    <div key={p.id} className="gpr-panel" style={{
                      flex: '1 1 30%', minWidth: 0,
                      border: `1px solid ${c.border}`, borderRadius: 4, padding: 6,
                      background: c.cardAlt,
                    }}>
                      <div className="gpr-panel-sublabel" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: c.text }}>
                        {p.panelLabel ? `(${p.panelLabel}) ` : ''}{p.locationRef || ''}
                      </div>
                      <AnnotatedImage
                        src={photoSrc(p)}
                        annotations={p.annotations || []}
                        style={{ background: '#000', borderRadius: 3 }}
                      />
                      {(p.caption || p.scaleInfo) && (
                        <div style={{ fontSize: 11, color: c.text, marginTop: 5, lineHeight: 1.4 }}>
                          {p.caption && <div>{p.caption}</div>}
                          {p.scaleInfo && <div style={{ color: c.textDim }}>{p.scaleInfo}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                <div style={{ flexBasis: '100%', fontSize: 11, color: c.textDim, fontStyle: 'italic' }}>
                  Figure: {gname}
                </div>
              </div>
            ))}

            {/* Singles */}
            {singles.map(p => (
              <div key={p.id} className="gpr-scan-figure" style={{
                border: `1px solid ${c.border}`, borderRadius: 6, padding: 9,
                marginBottom: 9, background: c.cardAlt,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6, fontSize: 11, color: c.textDim,
                }}>
                  <span>
                    {p.locationRef && <strong style={{ color: c.text }}>{p.locationRef}</strong>}
                    {p.locationRef && p.scaleInfo && ' · '}
                    {p.scaleInfo}
                  </span>
                </div>
                <AnnotatedImage
                  src={photoSrc(p)}
                  annotations={p.annotations || []}
                  style={{ background: '#000', borderRadius: 4 }}
                />
                {p.caption && (
                  <div style={{ fontSize: 12, color: c.text, marginTop: 6, lineHeight: 1.4 }}>
                    {p.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </Card>
  );
}

// ============================================================
// Scan Locations (per-location card · prints side-by-side)
// ============================================================

const DEFAULT_INSTRUCTION = 'Use proposed core location ONLY when coring.';

function NorthArrow({ rotation, size = 36 }) {
  return (
    <div style={{
      position: 'absolute', top: 6, right: 6,
      background: '#fff', borderRadius: 6, padding: '3px 6px',
      display: 'flex', alignItems: 'center', gap: 4,
      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      fontSize: 10, fontWeight: 700, color: '#000',
      letterSpacing: 0.5, lineHeight: 1,
    }}>
      <span style={{
        display: 'inline-block', transform: `rotate(${rotation || 0}deg)`,
        fontSize: size * 0.45, lineHeight: 1,
      }}>↑</span>
      <span>N</span>
    </div>
  );
}

const photoMenuBtnStyle = (c) => ({
  background: c.card, color: c.text,
  border: `1px solid ${c.borderStrong}`,
  borderRadius: 8, padding: '14px 6px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
  textAlign: 'center', lineHeight: 1.2,
});

function ScanLocations({ report, update }) {
  const fileInputRefs = useRef({});
  const takePhotoRefs = useRef({});
  const libraryRefs = useRef({});
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [menuLocId, setMenuLocId] = useState(null);          // location whose photo menu is open
  const [annotLocId, setAnnotLocId] = useState(null);        // location whose annotation editor is open
  const [pendingSyncs, setPendingSyncs] = useState([]);      // proposed cross-section updates awaiting approval

  const reorderLocs = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const list = [...report.scanLocations];
    const fromIdx = list.findIndex(l => l.id === fromId);
    const toIdx   = list.findIndex(l => l.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    update({ scanLocations: list });
  };

  // Slab-contents quick-pick types
  const SLAB_TYPES = [
    { id: 'top-rebar',  label: 'Top mat',    color: '#FAC775' },
    { id: 'bot-rebar',  label: 'Bottom mat', color: '#E0A340' },
    { id: 'top-pt',     label: 'Top PT',     color: '#F09595' },
    { id: 'bot-pt',     label: 'Bottom PT',  color: '#D06060' },
    { id: 'conduit',    label: 'Conduit',    color: '#9BC5E8' },
    { id: 'embed',      label: 'Embed/plate', color: '#9C8FE0' },
    { id: 'cold-joint', label: 'Cold joint', color: '#A0A0A0' },
    { id: 'anomaly',    label: 'Anomaly',    color: '#E02020' },
    { id: 'other',      label: 'Other',      color: '#888' },
  ];
  const SLAB_TYPE_BY_ID = SLAB_TYPES.reduce((a, t) => { a[t.id] = t; return a; }, {});

  const addSlabContent = (locId, typeId) => {
    const loc = report.scanLocations.find(l => l.id === locId);
    if (!loc) return;
    const next = [...(loc.slabContents || []), {
      id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: typeId, depth: '', count: '', notes: '',
    }];
    updateLoc(locId, { slabContents: next });
  };
  const updateSlabContent = (locId, scId, patch) => {
    const loc = report.scanLocations.find(l => l.id === locId);
    if (!loc) return;
    updateLoc(locId, {
      slabContents: (loc.slabContents || []).map(s => s.id === scId ? { ...s, ...patch } : s),
    });
  };
  const removeSlabContent = (locId, scId) => {
    const loc = report.scanLocations.find(l => l.id === locId);
    if (!loc) return;
    updateLoc(locId, {
      slabContents: (loc.slabContents || []).filter(s => s.id !== scId),
    });
  };

  const addLocation = () => {
    const id = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const idx = report.scanLocations.length;
    update({
      scanLocations: [...report.scanLocations, {
        id,
        label: `L${idx + 1}`,
        photo: null,
        northRotation: 0,
        coreSize: '',
        overCut: '',
        coreCount: '',
        notes: '',
        depthCallouts: [],
        slabContents: [],
        verdict: 'safe',
        instruction: DEFAULT_INSTRUCTION,
        confidence: 'high',
        zoneId: null,
        photoAnnotations: [],
      }],
    });
  };

  const updateLoc = (id, patch) => {
    const oldLoc = report.scanLocations.find(l => l.id === id);

    // Apply the change to the location immediately
    update({
      scanLocations: report.scanLocations.map(l =>
        l.id === id ? { ...l, ...patch } : l
      ),
    });

    // Detect cross-section sync candidates so the user can approve/skip each one
    if (!oldLoc) return;
    const newLoc = { ...oldLoc, ...patch };
    const proposed = [];

    // 1) Label change → propose updating any scanPhoto whose locationRef was the old label
    if ('label' in patch && patch.label !== oldLoc.label && oldLoc.label) {
      (report.scanPhotos || []).forEach(p => {
        if ((p.locationRef || '').toUpperCase() === oldLoc.label.toUpperCase()) {
          proposed.push({
            id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${p.id}`,
            kind: 'scanPhoto-locationRef',
            targetId: p.id,
            what: `Scan photo "${p.caption || p.id}" → location reference`,
            oldValue: p.locationRef,
            newValue: newLoc.label,
            apply: () => update({
              scanPhotos: report.scanPhotos.map(x =>
                x.id === p.id ? { ...x, locationRef: newLoc.label } : x
              ),
            }),
          });
        }
      });
    }

    // 2) Verdict / coreSize / coreCount change → propose updating a core entry whose
    //    label matches this location's label (e.g. core labelled "L1" gets synced)
    [
      { locField: 'verdict',   coreField: 'verdict' },
      { locField: 'coreSize',  coreField: 'size'    },
      { locField: 'coreCount', coreField: 'count'   },
    ].forEach(({ locField, coreField }) => {
      if (locField in patch && patch[locField] !== oldLoc[locField] && newLoc.label) {
        (report.cores || []).forEach((core, idx) => {
          if ((core.label || '').toUpperCase() === (newLoc.label || '').toUpperCase()
              && core[coreField] !== patch[locField]) {
            proposed.push({
              id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-c${idx}-${coreField}`,
              kind: 'core-' + coreField,
              targetId: idx,
              what: `Core "${core.label}" → ${coreField}`,
              oldValue: core[coreField] || '—',
              newValue: patch[locField],
              apply: () => {
                const next = [...report.cores];
                next[idx] = { ...next[idx], [coreField]: patch[locField] };
                update({ cores: next });
              },
            });
          }
        });
      }
    });

    if (proposed.length) {
      setPendingSyncs(prev => [...prev, ...proposed]);
    }
  };

  const approveSyncs = (ids) => {
    const idSet = new Set(ids);
    pendingSyncs.filter(s => idSet.has(s.id)).forEach(s => s.apply());
    setPendingSyncs(prev => prev.filter(s => !idSet.has(s.id)));
  };
  const skipSyncs = (ids) => {
    const idSet = new Set(ids);
    setPendingSyncs(prev => prev.filter(s => !idSet.has(s.id)));
  };

  const removeLoc = (id) => {
    if (!confirm('Remove this scan location?')) return;
    update({ scanLocations: report.scanLocations.filter(l => l.id !== id) });
  };

  const moveLoc = (id, dir) => {
    const idx = report.scanLocations.findIndex(l => l.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= report.scanLocations.length) return;
    const next = [...report.scanLocations];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    update({ scanLocations: next });
  };

  const handlePhoto = async (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file);
    if (dataUrl) updateLoc(id, { photo: dataUrl, photoUrl: null, photoPath: null });
    if (fileInputRefs.current[id]) fileInputRefs.current[id].value = '';
  };

  const addDepth = (id, loc) => {
    updateLoc(id, { depthCallouts: [...(loc.depthCallouts || []), { position: '', depth: '' }] });
  };
  const updateDepth = (id, loc, i, patch) => {
    const next = [...(loc.depthCallouts || [])];
    next[i] = { ...next[i], ...patch };
    updateLoc(id, { depthCallouts: next });
  };
  const removeDepth = (id, loc, i) => {
    updateLoc(id, { depthCallouts: (loc.depthCallouts || []).filter((_, j) => j !== i) });
  };

  const verdictMeta = {
    safe:    { color: c.green, bg: c.greenBg, label: '✓ Safe to drill' },
    caution: { color: c.amber, bg: c.amberBg, label: '⚠ Caution' },
    nogo:    { color: c.red,   bg: c.redBg,   label: '✕ Do not drill' },
  };

  return (
    <Card title="Scan locations · per-location cards" badge={
      <span style={{
        background: c.cardAlt, color: c.textDim, fontSize: 11,
        padding: '2px 8px', borderRadius: 4, fontWeight: 500,
      }}>{report.scanLocations.length}</span>
    }>
      <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
        Each location (L1, L2…) prints as a side-by-side card: notes + core spec on
        the left, annotated photo with north arrow on the right. This is the industry-
        standard "Concrete Scanning Data" format.
      </div>

      {(() => {
        // Optionally sort by named zone for grouped rendering
        let ordered = report.scanLocations;
        if (report.enableNamedZones) {
          const zoneOrder = new Map((report.zones || []).map((z, i) => [z.id, i]));
          ordered = report.scanLocations
            .map((loc, idx) => ({ loc, idx }))
            .sort((a, b) => {
              const ai = zoneOrder.has(a.loc.zoneId) ? zoneOrder.get(a.loc.zoneId) : Infinity;
              const bi = zoneOrder.has(b.loc.zoneId) ? zoneOrder.get(b.loc.zoneId) : Infinity;
              if (ai !== bi) return ai - bi;
              return a.idx - b.idx;
            })
            .map(o => o.loc);
        }
        const seenZones = new Set();
        return ordered.map((loc, idx) => {
          const vm = verdictMeta[loc.verdict] || verdictMeta.safe;
          let zoneHeader = null;
          if (report.enableNamedZones && !seenZones.has(loc.zoneId ?? '__unzoned__')) {
            seenZones.add(loc.zoneId ?? '__unzoned__');
            const zone = (report.zones || []).find(z => z.id === loc.zoneId);
            const label = zone ? zone.label : 'Unzoned';
            const notes = zone ? zone.notes : '';
            const isLast = idx > 0;
            zoneHeader = (
              <div className="zone-group-header" style={{
                marginTop: isLast ? 16 : 0, marginBottom: 8,
                padding: '8px 12px', borderRadius: 6,
                background: c.amberBg, borderLeft: `4px solid ${c.amber}`,
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
                  color: c.amberStrong,
                }}>{label}</div>
                {notes && (
                  <div style={{ fontSize: 11.5, color: c.text, lineHeight: 1.45, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {notes}
                  </div>
                )}
              </div>
            );
          }
          return (
            <React.Fragment key={loc.id}>
              {zoneHeader}
          <div
            className={
              'scan-location-card' +
              (dragId === loc.id ? ' dragging' : '') +
              (overId === loc.id && dragId && dragId !== loc.id ? ' drop-target' : '')
            }
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overId !== loc.id) setOverId(loc.id);
            }}
            onDragLeave={() => { if (overId === loc.id) setOverId(null); }}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = e.dataTransfer.getData('text/plain') || dragId;
              reorderLocs(fromId, loc.id);
              setDragId(null); setOverId(null);
            }}
            style={{
              border: `1px solid ${c.borderStrong}`, borderRadius: 8,
              marginBottom: 12, overflow: 'hidden',
            }}>
            {/* On-screen header: doubles as drag handle */}
            <div className="loc-header"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', loc.id);
                e.dataTransfer.effectAllowed = 'move';
                setDragId(loc.id);
              }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              style={{
                background: c.accent, color: '#fff', padding: '7px 11px',
                fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                cursor: 'grab', userSelect: 'none',
              }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="no-print" style={{
                  fontSize: 13, opacity: 0.85, letterSpacing: 0,
                  fontWeight: 900, lineHeight: 1,
                }} aria-hidden>⋮⋮</span>
                Concrete Scanning Data
              </span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>{loc.label}</span>
            </div>

            <div className="loc-body" style={{ padding: 11 }}>
              {/* Left side (notes etc) */}
              <div className="loc-left">
                {/* Print-only summary line */}
                <div className="loc-print-only" style={{ fontSize: 12, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Location: {loc.label || '—'}</div>
                  {(loc.coreCount || loc.coreSize || loc.overCut) && (
                    <div>
                      Notes: {loc.coreCount && `${loc.coreCount} `}
                      {loc.coreSize && `${loc.coreSize} core`}
                      {loc.overCut && ` with an ${loc.overCut} over-cut`}.
                    </div>
                  )}
                </div>

                <div className="loc-edit-only" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <Field label="Label">
                    <Input value={loc.label}
                      onChange={e => updateLoc(loc.id, { label: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600 }} />
                  </Field>
                  <Field label="Count">
                    <Input value={loc.coreCount}
                      onChange={e => updateLoc(loc.id, { coreCount: e.target.value })}
                      placeholder="(1)"
                      style={{ padding: '6px 8px', fontSize: 13 }} />
                  </Field>
                  <Field label="Core">
                    <Input value={loc.coreSize}
                      onChange={e => updateLoc(loc.id, { coreSize: e.target.value })}
                      placeholder='5"'
                      style={{ padding: '6px 8px', fontSize: 13 }} />
                  </Field>
                  <Field label="Over-cut">
                    <Input value={loc.overCut}
                      onChange={e => updateLoc(loc.id, { overCut: e.target.value })}
                      placeholder='8"'
                      style={{ padding: '6px 8px', fontSize: 13 }} />
                  </Field>
                </div>

                <div className="loc-edit-only">
                  <Field label="Notes" hint="Multi-paragraph free text. What was found, what's nearby, what to watch out for.">
                    <Textarea value={loc.notes}
                      onChange={e => updateLoc(loc.id, { notes: e.target.value })}
                      placeholder="No targets will be cut in the proposed core location.&#10;&#10;Note: the proposed 8&quot; over-cut will be within 1&quot; of marked PT boundary..."
                      style={{ minHeight: 88 }} />
                  </Field>
                </div>

                {/* Print-only notes text */}
                {loc.notes && (
                  <div className="loc-print-only" style={{
                    fontSize: 12, lineHeight: 1.5, marginBottom: 10,
                    whiteSpace: 'pre-wrap',
                  }}>{loc.notes}</div>
                )}

                {/* What's in the slab — editor */}
                <div className="loc-edit-only" style={{ marginBottom: 10 }}>
                  <div style={{
                    fontSize: 10.5, color: c.textDim, marginBottom: 6,
                    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
                  }}>What's in the slab</div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 7,
                  }}>
                    {SLAB_TYPES.map(t => (
                      <button key={t.id}
                        onClick={() => addSlabContent(loc.id, t.id)}
                        style={{
                          background: c.cardAlt, border: `1px solid ${c.border}`,
                          borderLeft: `4px solid ${t.color}`, borderRadius: 5,
                          padding: '6px 6px', fontSize: 11, fontWeight: 700,
                          color: c.text, cursor: 'pointer', textAlign: 'left',
                          letterSpacing: 0.2,
                        }}>+ {t.label}</button>
                    ))}
                  </div>
                  {(loc.slabContents || []).map(sc => {
                    const t = SLAB_TYPE_BY_ID[sc.type] || SLAB_TYPE_BY_ID.other;
                    return (
                      <div key={sc.id} style={{
                        border: `1px solid ${c.border}`, borderLeft: `4px solid ${t.color}`,
                        borderRadius: 5, padding: 6, marginBottom: 5, background: c.cardAlt,
                      }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginBottom: 5,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{t.label}</span>
                          <Btn variant="ghost" onClick={() => removeSlabContent(loc.id, sc.id)}
                            style={{ padding: '2px 7px', fontSize: 11 }}>✕</Btn>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
                          <Input value={sc.depth}
                            onChange={e => updateSlabContent(loc.id, sc.id, { depth: e.target.value })}
                            placeholder='Depth (e.g. 2.5")'
                            style={{ padding: '5px 8px', fontSize: 12 }} />
                          <Input value={sc.count}
                            onChange={e => updateSlabContent(loc.id, sc.id, { count: e.target.value })}
                            placeholder='Count / spacing'
                            style={{ padding: '5px 8px', fontSize: 12 }} />
                        </div>
                        <Input value={sc.notes}
                          onChange={e => updateSlabContent(loc.id, sc.id, { notes: e.target.value })}
                          placeholder='Description / orientation / notes'
                          style={{ padding: '5px 8px', fontSize: 12 }} />
                      </div>
                    );
                  })}
                </div>

                {/* What's in the slab — print */}
                {(loc.slabContents || []).length > 0 && (
                  <div className="loc-print-only" style={{ fontSize: 12, marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>What's in the slab:</div>
                    {(loc.slabContents || []).map((sc, i) => {
                      const t = SLAB_TYPE_BY_ID[sc.type] || SLAB_TYPE_BY_ID.other;
                      const bits = [sc.depth, sc.count].filter(Boolean).join(' · ');
                      return (
                        <div key={i} style={{ marginBottom: 2 }}>
                          • <strong>{t.label}</strong>
                          {bits && ` — ${bits}`}
                          {sc.notes && ` — ${sc.notes}`}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Depth callouts — editor */}
                <div className="loc-edit-only">
                  <div style={{
                    fontSize: 10.5, color: c.textDim, marginBottom: 4,
                    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
                  }}>Depth callouts</div>
                  {(loc.depthCallouts || []).map((d, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 5, marginBottom: 5 }}>
                      <Input value={d.position}
                        onChange={e => updateDepth(loc.id, loc, i, { position: e.target.value })}
                        placeholder="east side"
                        style={{ padding: '5px 8px', fontSize: 12 }} />
                      <Input value={d.depth}
                        onChange={e => updateDepth(loc.id, loc, i, { depth: e.target.value })}
                        placeholder='1.5"'
                        style={{ padding: '5px 8px', fontSize: 12 }} />
                      <Btn variant="ghost" onClick={() => removeDepth(loc.id, loc, i)}
                        style={{ padding: '4px 8px', fontSize: 11 }}>✕</Btn>
                    </div>
                  ))}
                  <Btn onClick={() => addDepth(loc.id, loc)}
                    style={{ width: '100%', fontSize: 11, padding: '5px 8px', marginBottom: 8 }}>
                    + Add depth callout
                  </Btn>
                </div>

                {/* Depth callouts — print */}
                {(loc.depthCallouts || []).filter(d => d.position || d.depth).length > 0 && (
                  <div className="loc-print-only" style={{ fontSize: 12, marginBottom: 10 }}>
                    {(loc.depthCallouts || []).filter(d => d.position || d.depth).map((d, i) => (
                      <div key={i}>• {d.position}: {d.depth}</div>
                    ))}
                  </div>
                )}

                <div className="loc-edit-only">
                  <Field label="Coring instruction (bold in PDF)">
                    <Input value={loc.instruction}
                      onChange={e => updateLoc(loc.id, { instruction: e.target.value })}
                      placeholder={DEFAULT_INSTRUCTION}
                      style={{ fontWeight: 600 }} />
                  </Field>
                </div>

                {loc.instruction && (
                  <div className="loc-print-only" style={{
                    fontSize: 12, fontWeight: 700, marginTop: 4,
                  }}>- {loc.instruction}</div>
                )}

                {report.enableNamedZones && (
                  <div className="loc-edit-only" style={{ marginBottom: 7 }}>
                    <Field label="Zone">
                      <Select value={loc.zoneId || ''}
                        onChange={e => updateLoc(loc.id, { zoneId: e.target.value || null })}>
                        <option value="">— Unzoned —</option>
                        {(report.zones || []).map(z => (
                          <option key={z.id} value={z.id}>{z.label}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}

                <div className="loc-edit-only" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Field label="Verdict">
                    <Select value={loc.verdict}
                      onChange={e => updateLoc(loc.id, { verdict: e.target.value })}
                      style={{ color: vm.color, fontWeight: 600 }}>
                      <option value="safe">✓ Safe to drill</option>
                      <option value="caution">⚠ Caution</option>
                      <option value="nogo">✕ Do not drill</option>
                    </Select>
                  </Field>
                  <Field label="Confidence">
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[
                        { id: 'high', label: 'High', color: c.green, bg: c.greenBg },
                        { id: 'med',  label: 'Med',  color: c.amber, bg: c.amberBg },
                        { id: 'low',  label: 'Low',  color: c.red,   bg: c.redBg },
                      ].map(opt => (
                        <button key={opt.id}
                          className={`ak-conf ${loc.confidence === opt.id ? `ak-conf-on ak-conf-${opt.id}` : 'ak-conf-off'}`}
                          onClick={() => updateLoc(loc.id, { confidence: opt.id })}
                          style={{
                            flex: 1,
                            background: loc.confidence === opt.id ? opt.bg : c.cardAlt,
                            color: loc.confidence === opt.id ? opt.color : c.textDim,
                            border: `1px solid ${loc.confidence === opt.id ? opt.color : c.border}`,
                            borderRadius: 4, padding: '7px 4px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}>{opt.label}</button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="loc-print-only" style={{
                  marginTop: 8, paddingTop: 6, borderTop: '1px solid #ccc',
                  fontSize: 11, color: '#444',
                }}>
                  Verdict: <strong>{vm.label}</strong> · Confidence: <strong>{(loc.confidence || 'high').toUpperCase()}</strong>
                </div>
              </div>

              {/* Right side (photo + north arrow) */}
              <div className="loc-right" style={{ marginTop: 12 }}>
                <div style={{
                  fontSize: 10.5, color: c.textDim, marginBottom: 4,
                  textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
                }}>Annotated photo</div>
                <div className="loc-photo" style={{
                  position: 'relative', background: c.cardAlt, borderRadius: 6,
                  aspectRatio: '4 / 3', overflow: 'hidden',
                  border: `1px solid ${c.border}`, marginBottom: 8,
                  cursor: 'pointer',
                }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuLocId(menuLocId === loc.id ? null : loc.id);
                  }}
                  title={locPhotoSrc(loc) ? 'Click to edit / replace / annotate' : 'Click to add a photo'}
                >
                  {locPhotoSrc(loc) ? (
                    <>
                      {(loc.photoAnnotations && loc.photoAnnotations.length > 0) ? (
                        <div style={{ position: 'absolute', inset: 0 }}>
                          <AnnotatedImage
                            src={locPhotoSrc(loc)}
                            annotations={loc.photoAnnotations}
                            alt={loc.label}
                            style={{ width: '100%', height: '100%' }}
                          />
                        </div>
                      ) : (
                        <img src={locPhotoSrc(loc)} alt={loc.label}
                          style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            position: 'absolute', inset: 0,
                          }} />
                      )}
                      <NorthArrow rotation={loc.northRotation} />
                      <div style={{
                        position: 'absolute', bottom: 6, right: 6,
                        background: 'rgba(0,0,0,0.7)', color: '#fff',
                        padding: '3px 8px', borderRadius: 4,
                        fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                      }}>{loc.label}</div>
                      <div className="no-print" style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(0,0,0,0.7)', color: '#fff',
                        padding: '3px 8px', borderRadius: 4,
                        fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}>🖊 Click to edit</div>
                    </>
                  ) : (
                    <div className="no-print" style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 4,
                      color: c.textFaint, fontSize: 12, padding: 16, textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 28 }}>📷</div>
                      <div style={{ fontWeight: 600, color: c.text }}>Click to add a photo</div>
                      <div style={{ fontSize: 10.5 }}>Take · From library · Annotate</div>
                    </div>
                  )}

                  {menuLocId === loc.id && (
                    <div
                      className="no-print"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0, 0, 0, 0.78)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10,
                      }}>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                        padding: 12, width: '88%', maxWidth: 320,
                      }}>
                        <button
                          onClick={() => { takePhotoRefs.current[loc.id]?.click(); setMenuLocId(null); }}
                          style={photoMenuBtnStyle(c)}>
                          📷<br /><span style={{ fontSize: 11 }}>Take photo</span>
                        </button>
                        <button
                          onClick={() => { libraryRefs.current[loc.id]?.click(); setMenuLocId(null); }}
                          style={photoMenuBtnStyle(c)}>
                          📂<br /><span style={{ fontSize: 11 }}>From library</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!locPhotoSrc(loc)) { alert('Add a photo first, then annotate it.'); return; }
                            setAnnotLocId(loc.id);
                            setMenuLocId(null);
                          }}
                          style={photoMenuBtnStyle(c)}>
                          🖊<br /><span style={{ fontSize: 11 }}>Annotate</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!locPhotoSrc(loc)) { setMenuLocId(null); return; }
                            if (!confirm('Remove this location\'s photo (and annotations)?')) return;
                            updateLoc(loc.id, { photo: null, photoAnnotations: [] });
                            setMenuLocId(null);
                          }}
                          style={{ ...photoMenuBtnStyle(c), color: '#ff7b7b' }}>
                          ✕<br /><span style={{ fontSize: 11 }}>Remove</span>
                        </button>
                        <button
                          onClick={() => setMenuLocId(null)}
                          style={{
                            ...photoMenuBtnStyle(c),
                            gridColumn: '1 / -1',
                            background: 'transparent',
                            border: '1px solid #555',
                            color: '#ddd',
                          }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hidden inputs that the menu triggers */}
                <input
                  ref={el => { if (el) takePhotoRefs.current[loc.id] = el; }}
                  type="file" accept="image/*" capture="environment"
                  onChange={e => handlePhoto(loc.id, e)}
                  style={{ display: 'none' }} />
                <input
                  ref={el => { if (el) libraryRefs.current[loc.id] = el; }}
                  type="file" accept="image/*"
                  onChange={e => handlePhoto(loc.id, e)}
                  style={{ display: 'none' }} />

                {/* Inline scan thumbnails referenced at this location */}
                {(() => {
                  const refs = (report.scanPhotos || []).filter(p =>
                    (p.locationRef || '').toUpperCase() === (loc.label || '').toUpperCase() && loc.label
                  );
                  if (refs.length === 0) return null;
                  return (
                    <div className="loc-scan-refs" style={{ marginBottom: 8 }}>
                      <div style={{
                        fontSize: 10.5, color: c.textDim, marginBottom: 4,
                        textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
                      }}>Referenced scans · {refs.length}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {refs.map(p => (
                          <div key={p.id} className="loc-scan-ref" style={{
                            border: `1px solid ${c.border}`, borderRadius: 4,
                            background: c.cardAlt, padding: 4,
                          }}>
                            <AnnotatedImage
                              src={photoSrc(p)}
                              annotations={p.annotations || []}
                              style={{ background: '#000', borderRadius: 3 }}
                            />
                            <div style={{ fontSize: 10, color: c.text, marginTop: 3, lineHeight: 1.35 }}>
                              <strong>{SCAN_TYPE_LABEL[p.scanType || 'site'] || p.scanType}</strong>
                              {p.scaleInfo && <> · {p.scaleInfo}</>}
                            </div>
                            {p.caption && (
                              <div style={{ fontSize: 10, color: c.textDim, lineHeight: 1.35 }}>
                                {p.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="loc-photo-controls">
                  <label style={{
                    display: 'block', background: c.cardAlt, border: `1px solid ${c.borderStrong}`,
                    borderRadius: 6, padding: '8px', textAlign: 'center', fontSize: 12,
                    color: c.text, cursor: 'pointer', fontWeight: 500, marginBottom: 8,
                  }}>
                    📷 {locPhotoSrc(loc) ? 'Replace photo' : 'Add photo'}
                    <input
                      ref={el => { if (el) fileInputRefs.current[loc.id] = el; }}
                      type="file" accept="image/*" capture="environment"
                      onChange={e => handlePhoto(loc.id, e)}
                      style={{ display: 'none' }} />
                  </label>

                  <Field label={`North arrow rotation: ${loc.northRotation || 0}°`}>
                    <input type="range" min="0" max="359" step="1"
                      value={loc.northRotation || 0}
                      onChange={e => updateLoc(loc.id, { northRotation: parseInt(e.target.value, 10) })}
                      style={{ width: '100%' }} />
                  </Field>
                </div>
              </div>

              {/* Row controls */}
              <div className="loc-controls" style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                <Btn variant="ghost" onClick={() => moveLoc(loc.id, -1)}
                  disabled={idx === 0}
                  style={{ flex: 1, fontSize: 11, padding: '6px' }}>↑ Up</Btn>
                <Btn variant="ghost" onClick={() => moveLoc(loc.id, 1)}
                  disabled={idx === report.scanLocations.length - 1}
                  style={{ flex: 1, fontSize: 11, padding: '6px' }}>↓ Down</Btn>
                <Btn variant="danger" onClick={() => removeLoc(loc.id)}
                  style={{ flex: 1, fontSize: 11, padding: '6px' }}>✕ Remove</Btn>
              </div>
            </div>
          </div>
            </React.Fragment>
          );
        });
      })()}

      {report.scanLocations.length === 0 && (
        <div className="no-print" style={{
          padding: '14px', textAlign: 'center', fontSize: 12,
          color: c.textFaint, background: c.cardAlt, borderRadius: 6, marginBottom: 8,
        }}>
          No scan locations yet. Add one to build the side-by-side card.
        </div>
      )}

      <div className="no-print">
        <Btn onClick={addLocation} style={{ width: '100%' }}>+ Add scan location</Btn>
      </div>

      {/* Pending cross-section sync proposals */}
      {pendingSyncs.length > 0 && (
        <div className="no-print" style={{
          position: 'fixed', bottom: 12, left: 12, right: 12,
          zIndex: 800, maxWidth: 680, margin: '0 auto',
          background: c.bgRaised, color: c.text,
          border: `2px solid ${c.accent}`, borderRadius: 10,
          padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8, gap: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              🔗 Sync changes to the rest of the report ({pendingSyncs.length})
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn variant="ghost" onClick={() => skipSyncs(pendingSyncs.map(s => s.id))}
                style={{ fontSize: 11 }}>Skip all</Btn>
              <Btn variant="primary" onClick={() => approveSyncs(pendingSyncs.map(s => s.id))}
                style={{ fontSize: 11 }}>✓ Approve all</Btn>
            </div>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 5 }}>
            {pendingSyncs.map(s => (
              <div key={s.id} style={{
                display: 'flex', gap: 6, alignItems: 'center',
                padding: '6px 8px', background: c.cardAlt,
                border: `1px solid ${c.border}`, borderRadius: 6,
                fontSize: 11.5,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: c.text }}>{s.what}</div>
                  <div style={{ color: c.textDim, marginTop: 1 }}>
                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{s.oldValue || '—'}</span>
                    {' → '}
                    <strong style={{ color: c.accent }}>{s.newValue}</strong>
                  </div>
                </div>
                <Btn variant="ghost" onClick={() => skipSyncs([s.id])}
                  style={{ padding: '4px 8px', fontSize: 11 }}>Skip</Btn>
                <Btn variant="primary" onClick={() => approveSyncs([s.id])}
                  style={{ padding: '4px 8px', fontSize: 11 }}>✓ Apply</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Annotation editor for the per-location photo */}
      {annotLocId && (() => {
        const loc = report.scanLocations.find(l => l.id === annotLocId);
        if (!loc || !locPhotoSrc(loc)) return null;
        return (
          <AnnotationEditor
            photo={{ dataUrl: locPhotoSrc(loc), annotations: loc.photoAnnotations || [] }}
            colorLegend={report.colorLegend || APWA_LEGEND}
            onSave={(annotations) => {
              updateLoc(loc.id, { photoAnnotations: annotations });
              setAnnotLocId(null);
            }}
            onClose={() => setAnnotLocId(null)}
          />
        );
      })()}
    </Card>
  );
}

// ============================================================
// Main App
// ============================================================

// ============================================================
// In-app Assistant — rule-based, offline, no network
// Surfaces the next-most-useful nudge based on report state.
// ============================================================

function getAssistantTips(report) {
  const tips = [];
  const need = (cond, level, text) => { if (cond) tips.push({ level, text }); };

  // Critical: PT slab needs explicit exclusion language
  if (report.slabType === 'PT') {
    const hasPtNote = (report.cores || []).some(co =>
      ((co.note || '') + ' ' + (co.clearance || '')).toLowerCase().includes('pt') ||
      ((co.note || '') + ' ' + (co.clearance || '')).toLowerCase().includes('tendon')
    );
    need(!hasPtNote && (report.cores || []).length > 0, 'high',
      'PT slab: at least one core should explicitly call out the tendon exclusion zone (e.g. "no cores within 300 mm of tendon band").');
    const hasPtTarget = (report.targets || []).some(t => t.type && t.type.includes('PT'));
    need(!hasPtTarget && (report.targets || []).length > 0, 'med',
      'PT slab but no PT cable target logged. If tendons are present, log them; if not visible on radargram, note it in uncertainty zones.');
  }

  // Cure status vs. depth confidence
  if (report.slabAge && report.slabAge.includes('green')) {
    need(true, 'med',
      'Green concrete (<7 days): GPR signal is attenuated. Add a limitation noting reduced depth confidence and consider a follow-up scan after cure.');
  }

  // Dielectric sanity check
  const eps = parseFloat(report.dielectric);
  need(!isNaN(eps) && (eps < 4 || eps > 12), 'med',
    `Dielectric εr=${report.dielectric} is outside the typical concrete range (4–12). Verify calibration on a known target before relying on depths.`);

  // Coverage polygon: pins outside the scanned area
  const cov = report.coveragePolygon?.points || [];
  if (cov.length >= 3) {
    const pip = (pt) => {
      let inside = false;
      for (let i = 0, j = cov.length - 1; i < cov.length; j = i++) {
        const xi = cov[i].x, yi = cov[i].y, xj = cov[j].x, yj = cov[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
          (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-9) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };
    const outside = (report.diagramPins || []).filter(p => !pip(p));
    need(outside.length > 0, 'high',
      `${outside.length} pin(s) sit outside the scanned coverage area. Either extend the scan or relocate the cores — drilling outside the scanned zone is high-risk.`);
  } else if ((report.diagramPins || []).length > 0 && (report.coveragePolygon?.points || []).length < 3) {
    need(true, 'low',
      'Consider outlining the scanned coverage area on the diagram so the reviewer can tell what was vs. wasn\'t surveyed.');
  }

  // Rebar mat summary populated?
  const rs = report.rebarSummary;
  if (rs && (report.targets || []).some(t => (t.type || '').toLowerCase().includes('rebar'))) {
    const blank = !rs.topBarSize && !rs.bottomBarSize && !rs.topSpacing && !rs.bottomSpacing;
    need(blank, 'low',
      'Rebar targets logged but the mat summary is empty. Add bar size / spacing estimates so the EoR can back-calc capacity.');
  }

  // Pin / core consistency
  const coresArr = report.cores || [];
  const pinsArr = report.diagramPins || [];
  need(coresArr.length > 0 && pinsArr.length === 0, 'med',
    'You have core verdicts but no pins on the diagram. Pin each core location so the crew can find them.');
  need(coresArr.length > pinsArr.length && pinsArr.length > 0, 'low',
    `${coresArr.length - pinsArr.length} core(s) without a matching pin on the diagram.`);

  // Pin datum references
  const pinsMissingDatum = pinsArr.filter(p => !p.datumA && !p.datumB);
  need(pinsMissingDatum.length > 0, 'med',
    `${pinsMissingDatum.length} pin(s) missing datum offset. Chalk washes off — add at least one measured offset per pin.`);

  // Drill envelope on safe cores
  const safeUnscoped = coresArr.filter(co =>
    co.verdict === 'safe' && (!co.drillMaxDepth || !co.drillDia)
  );
  need(safeUnscoped.length > 0, 'med',
    `${safeUnscoped.length} safe core(s) without a drill envelope. State max bit Ø and max depth — the crew shouldn't have to guess.`);

  // Cover essentials
  need(!report.projectNo, 'low', 'Project number is blank.');
  need(!report.client, 'low', 'Client field is blank.');
  need(!report.siteAddress, 'low', 'Site address is blank.');
  need(!report.preparedBy, 'med', 'Sign-off: prepared-by name is empty.');

  // Revision sanity
  need(report.rev && report.rev !== '0' && !report.revNotes, 'low',
    'Revision is past 0 — add a "Changes since last rev" note for the reviewer.');

  // Custom user-added reminders — always shown, tagged so UI can offer delete
  const customs = (report.customReminders || []).map(r => ({
    level: r.level || 'med', text: r.text, customId: r.id,
  }));

  // Found nothing? Praise (only when there are no auto-tips AND no customs)
  if (tips.length === 0 && customs.length === 0) {
    return [{ level: 'ok', text: 'Report looks complete. Print to PDF when ready.' }];
  }
  // Sort high → low (customs share the same priority lanes)
  const order = { high: 0, med: 1, low: 2, ok: 3 };
  const all = [...tips, ...customs];
  all.sort((a, b) => order[a.level] - order[b.level]);
  return all;
}

function Assistant({ report, update }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftLevel, setDraftLevel] = useState('med');
  const tips = useMemo(() => getAssistantTips(report), [report]);
  if (!report.assistantOn) return null;

  const tone = {
    high: { bd: c.red, bg: c.redBg, fg: c.redStrong, icon: '⚠' },
    med:  { bd: c.amber, bg: c.amberBg, fg: c.amberStrong, icon: '•' },
    low:  { bd: c.border, bg: c.cardAlt, fg: c.textDim, icon: '·' },
    ok:   { bd: c.green, bg: c.greenBg, fg: c.greenStrong, icon: '✓' },
  };

  const addCustom = () => {
    const t = draftText.trim();
    if (!t) return;
    const id = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    update({
      customReminders: [...(report.customReminders || []), { id, text: t, level: draftLevel }],
    });
    setDraftText('');
    setDraftLevel('med');
    setShowAdd(false);
  };
  const removeCustom = (id) => {
    update({
      customReminders: (report.customReminders || []).filter(r => r.id !== id),
    });
  };

  return (
    <div className="no-print" style={{
      position: 'fixed', right: 14, bottom: 80, zIndex: 50,
      width: 'min(360px, calc(100vw - 28px))',
      background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      <button onClick={() => setCollapsed(x => !x)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: c.accentDim, color: '#fff', border: 'none',
          padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
        }}>
        <span>🤖 Assistant {tips[0]?.level === 'ok' ? '· all good' : `· ${tips.length} tip${tips.length === 1 ? '' : 's'}`}</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>{collapsed ? '▴' : '▾'}</span>
          <span onClick={(e) => { e.stopPropagation(); update({ assistantOn: false }); }}
            style={{ fontSize: 14, opacity: 0.8 }}>✕</span>
        </span>
      </button>
      {!collapsed && (
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
          {tips.map((t, i) => {
            const s = tone[t.level];
            return (
              <div key={t.customId || i} style={{
                background: s.bg, borderLeft: `3px solid ${s.bd}`,
                padding: '7px 9px', marginBottom: 6, borderRadius: '0 6px 6px 0',
                fontSize: 12, color: c.text, lineHeight: 1.4,
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <span style={{ color: s.fg, fontWeight: 700, flexShrink: 0 }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{t.text}</span>
                {t.customId && (
                  <button onClick={() => removeCustom(t.customId)}
                    title="Delete this custom reminder"
                    style={{
                      background: 'transparent', border: 'none', color: c.textFaint,
                      cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
                      flexShrink: 0,
                    }}>✕</button>
                )}
              </div>
            );
          })}

          {showAdd ? (
            <div style={{
              marginTop: 4, padding: 8, background: c.cardAlt,
              border: `1px solid ${c.border}`, borderRadius: 6,
            }}>
              <textarea
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                placeholder="e.g. Confirm PT layout with EoR before any cores in Zone B"
                style={{
                  width: '100%', minHeight: 52, boxSizing: 'border-box',
                  background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                  borderRadius: 4, padding: 6, fontSize: 12, fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <select
                  value={draftLevel}
                  onChange={e => setDraftLevel(e.target.value)}
                  style={{
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    borderRadius: 4, padding: '4px 6px', fontSize: 12,
                  }}>
                  <option value="high">High ⚠</option>
                  <option value="med">Med •</option>
                  <option value="low">Low ·</option>
                </select>
                <button onClick={addCustom}
                  disabled={!draftText.trim()}
                  style={{
                    background: c.accent, color: '#fff', border: 'none',
                    borderRadius: 4, padding: '5px 10px', fontSize: 12, fontWeight: 700,
                    cursor: draftText.trim() ? 'pointer' : 'not-allowed',
                    opacity: draftText.trim() ? 1 : 0.5,
                  }}>Add</button>
                <button onClick={() => { setShowAdd(false); setDraftText(''); }}
                  style={{
                    background: 'transparent', color: c.textDim, border: `1px solid ${c.border}`,
                    borderRadius: 4, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                  }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              style={{
                width: '100%', marginTop: 2,
                background: 'transparent', color: c.textDim,
                border: `1px dashed ${c.border}`, borderRadius: 6,
                padding: '6px 8px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}>
              + Add custom reminder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function deriveReportName(r) {
  if (!r) return 'Untitled report';
  return (r.projectNo || r.jobNote || r.client || 'Untitled report').toString().slice(0, 60);
}

export default function GSSIReportApp() {
  // Multi-report library: the open report plus a lightweight index of all reports.
  const [lib] = useState(() => ensureLibrary(DEFAULT_REPORT, deriveReportName));
  const [currentId, setCurrentIdState] = useState(lib.currentId);
  const [reportsIndex, setReportsIndex] = useState(lib.index);
  const [report, setReport] = useState(lib.currentReport);

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ak_theme') || 'dark'; }
    catch { return 'dark'; }
  });

  // ---------- Auto-save status indicator ----------
  const [savedAt, setSavedAt] = useState(null);

  // Persist the working report. Photos are embedded as data URLs, so the report
  // can be several MB; serializing it on every keystroke made typing (captions
  // especially) lag badly. We debounce the write, and flush it when the page is
  // hidden or closed so nothing is ever lost.
  const latestReportRef = useRef(report);
  useEffect(() => { latestReportRef.current = report; }, [report]);
  const currentIdRef = useRef(currentId);
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);

  const persistNow = useRef(() => {});
  persistNow.current = () => {
    const r = latestReportRef.current;
    const id = currentIdRef.current;
    saveReport(id, r);
    setSavedAt(Date.now());
    setReportsIndex((idx) => {
      const next = idx.map((e) => e.id === id ? { ...e, name: deriveReportName(r), updatedAt: Date.now(), status: r.status || 'draft' } : e);
      saveIndex(next);
      return next;
    });
    const sticky = {};
    STICKY_FIELDS.forEach(f => {
      if (r[f] !== undefined && r[f] !== '' && r[f] !== null) sticky[f] = r[f];
    });
    lsSet(AUTOFILL_KEY, { ...lsGet(AUTOFILL_KEY, {}), ...sticky });
  };

  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistNow.current(), 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [report]);

  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      persistNow.current();
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);

    // Desktop: when an update is about to install, save EVERYTHING first —
    // localStorage (fast, the library of all reports) AND the linked
    // .akscan file on disk if the user picked one. Only tell the main
    // process we're done once both writes have completed, so an update
    // can't install while the file is half-written.
    let offFlush;
    if (window.akDesktop?.onFlushSave) {
      offFlush = window.akDesktop.onFlushSave(async () => {
        flush();
        try { await autoSaveNowRef.current?.(); } catch {}
        window.akDesktop.flushSaveDone?.();
      });
    }
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      if (offFlush) offFlush();
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem('ak_theme', theme); } catch {}
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // ---------- Cloud sync (opt-in: only active once signed in) ----------
  // The app stays fully local until a user signs in via the header ☁ button.
  // BENCHED: cloud sync only handles a single report today, and we're storing
  // locally for now. Flip SYNC_ENABLED back to true (and the code below + the
  // header button revive untouched) once multi-report sync is worth it.
  const SYNC_ENABLED = false;
  const auth = useAuth();
  const applyRemote = useCallback((data) => {
    setReport({ ...DEFAULT_REPORT, ...data });
  }, []);
  const sync = useCloudSync({ session: SYNC_ENABLED ? auth.session : null, report, applyRemote });

  // ---------- Auto-fill: build a fresh report carrying sticky fields forward ----------
  const freshReport = () => {
    const mem = lsGet(AUTOFILL_KEY, {});
    const carried = {};
    STICKY_FIELDS.forEach(f => { if (mem[f] !== undefined) carried[f] = mem[f]; });
    const today = new Date().toISOString().slice(0, 10);
    return { ...DEFAULT_REPORT, ...carried, scanDate: today, signDate: today };
  };

  // Record client/site into the recents list (used for input suggestions).
  // Called at meaningful moments (save/email/share) to avoid per-keystroke noise.
  const [recents, setRecents] = useState(() => {
    const m = lsGet(AUTOFILL_KEY, {});
    return { recentClients: m.recentClients || [], recentSites: m.recentSites || [] };
  });
  const rememberRecents = () => {
    const mem = lsGet(AUTOFILL_KEY, {});
    const next = {
      recentClients: uniqTop(mem.recentClients, report.client),
      recentSites: uniqTop(mem.recentSites, report.siteAddress),
    };
    lsSet(AUTOFILL_KEY, { ...mem, ...next });
    setRecents(next);
  };

  // ---------- Reports library (work on multiple reports) ----------
  const [reportsOpen, setReportsOpen] = useState(false);

  const switchReport = (id) => {
    if (id === currentIdRef.current) { setReportsOpen(false); return; }
    persistNow.current();                         // save the report we're leaving
    const data = loadReport(id);
    setCurrentIdState(id); persistCurrentId(id);
    setReport(data ? { ...DEFAULT_REPORT, ...data } : DEFAULT_REPORT);
    forgetFile();
    setReportsOpen(false);
  };

  const createReport = () => {
    persistNow.current();
    const r = freshReport();
    const id = newId();
    saveReport(id, r);
    setReportsIndex((idx) => {
      const next = [{ id, name: deriveReportName(r), updatedAt: Date.now() }, ...idx];
      saveIndex(next); return next;
    });
    setCurrentIdState(id); persistCurrentId(id);
    setReport(r);
    forgetFile();
    setReportsOpen(false);
  };

  const duplicateReport = (id) => {
    const src = id === currentIdRef.current ? latestReportRef.current : loadReport(id);
    if (!src) return;
    const nid = newId();
    saveReport(nid, { ...src });
    setReportsIndex((idx) => {
      const next = [{ id: nid, name: deriveReportName(src) + ' (copy)', updatedAt: Date.now() }, ...idx];
      saveIndex(next); return next;
    });
  };

  const renameReport = (id, name) => {
    const nm = (name || '').trim() || 'Untitled report';
    setReportsIndex((idx) => {
      const next = idx.map((e) => e.id === id ? { ...e, name: nm } : e);
      saveIndex(next); return next;
    });
  };

  const deleteReport = (id) => {
    removeReport(id);
    setReportsIndex((idx) => {
      let next = idx.filter((e) => e.id !== id);
      if (id === currentIdRef.current) {
        if (next.length === 0) {
          const r = freshReport(); const fid = newId();
          saveReport(fid, r);
          next = [{ id: fid, name: deriveReportName(r), updatedAt: Date.now() }];
          setCurrentIdState(fid); persistCurrentId(fid); setReport(r); forgetFile();
        } else {
          const nid = next[0].id;
          setCurrentIdState(nid); persistCurrentId(nid);
          setReport({ ...DEFAULT_REPORT, ...(loadReport(nid) || {}) }); forgetFile();
        }
      }
      saveIndex(next);
      return next;
    });
  };

  // ---------- Per-client templates ----------
  const [templates, setTemplates] = useState(() => loadTemplates());
  const [templateEditor, setTemplateEditor] = useState(null);
  const [startReportOpen, setStartReportOpen] = useState(false);
  const persistTemplates = (next) => { setTemplates(next); saveTemplates(next); };

  // Opens the editor in "preview before saving" mode for a brand-new template.
  const openCreateTemplate = () => {
    setTemplateEditor({
      mode: 'create',
      initialName: report.client || 'Template',
      initialFields: extractTemplateFields(report),
      onSave: ({ name, fields }) => {
        const t = { id: newTemplateId(), name, createdAt: Date.now(), fields };
        persistTemplates([t, ...templates]);
        setTemplateEditor(null);
      },
    });
  };

  // Opens the editor in "customize" mode for an existing template.
  const openEditTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplateEditor({
      mode: 'edit',
      initialName: t.name,
      initialFields: t.fields || {},
      onSave: ({ name, fields }) => {
        persistTemplates(templates.map((x) => x.id === id ? { ...x, name, fields } : x));
        setTemplateEditor(null);
      },
    });
  };

  const renameTemplate = (id, name) => {
    const nm = (name || '').trim() || 'Template';
    persistTemplates(templates.map(t => t.id === id ? { ...t, name: nm } : t));
  };
  const deleteTemplate = (id) => {
    persistTemplates(templates.filter(t => t.id !== id));
  };
  const createReportFromTemplate = (id) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    persistNow.current();
    const r = { ...freshReport(), ...t.fields };
    const rid = newId();
    saveReport(rid, r);
    setReportsIndex((idx) => {
      const next = [{ id: rid, name: deriveReportName(r), updatedAt: Date.now() }, ...idx];
      saveIndex(next); return next;
    });
    setCurrentIdState(rid); persistCurrentId(rid);
    setReport(r); forgetFile();
    setReportsOpen(false);
  };

  // Create a new report from the fully-built example (sample targets, cores,
  // annotated photos, zones, CAD page — every section populated).
  const createReportFromExample = () => {
    persistNow.current();
    const r = { ...freshReport(), ...buildExampleReport() };
    const rid = newId();
    saveReport(rid, r);
    setReportsIndex((idx) => {
      const next = [{ id: rid, name: deriveReportName(r), updatedAt: Date.now() }, ...idx];
      saveIndex(next); return next;
    });
    setCurrentIdState(rid); persistCurrentId(rid);
    setReport(r); forgetFile();
    setReportsOpen(false); setStartReportOpen(false);
  };

  // ---------- Customer / contact directory ----------
  const [contacts, setContacts] = useState(() => lsGet(CONTACTS_KEY, []));
  const [contactsOpen, setContactsOpen] = useState(false);
  useEffect(() => { lsSet(CONTACTS_KEY, contacts); }, [contacts]);
  const addContact = (ct) => setContacts(cs => [...cs, { id: `c-${Date.now()}`, name: '', email: '', company: '', note: '', ...ct }]);
  const updateContact = (id, patch) => setContacts(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeContact = (id) => setContacts(cs => cs.filter(c => c.id !== id));

  // ---------- Getting Started guide ----------
  // Auto-opens on startup while the "show automatically" toggle is on. The toggle
  // is persisted so anyone can turn it off, or back on if they need a refresher.
  const [helpAutoShow, setHelpAutoShow] = useState(() => {
    try { const v = localStorage.getItem(HELP_AUTOSHOW_KEY); return v === null ? true : v === '1'; }
    catch { return true; }
  });
  const [helpOpen, setHelpOpen] = useState(helpAutoShow);
  useEffect(() => {
    try { localStorage.setItem(HELP_AUTOSHOW_KEY, helpAutoShow ? '1' : '0'); } catch {}
  }, [helpAutoShow]);

  // ---------- What's-new dialog ----------
  // Opens once per version bump. Tracks the last version the user saw so the
  // changelog only pops the first time they open a new build (web or .exe).
  const [whatsNewEntries, setWhatsNewEntries] = useState(null);
  useEffect(() => {
    let lastSeen;
    try { lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY) || ''; } catch { lastSeen = ''; }
    if (compareVersions(APP_VERSION, lastSeen) > 0) {
      const fresh = CHANGELOG.filter(e => compareVersions(e.version, lastSeen) > 0);
      if (fresh.length) setWhatsNewEntries(fresh);
    }
  }, []);
  const dismissWhatsNew = () => {
    setWhatsNewEntries(null);
    try { localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION); } catch {}
  };

  // ---------- Reset/refresh form (with save-first guard) ----------
  const [confirmReset, setConfirmReset] = useState(false);
  const doReset = () => {
    setReport(freshReport());
    forgetFile();
    setConfirmReset(false);
  };

  // ---------- Email-this-report dialog ----------
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const buildEmailDraft = () => {
    const subject =
      `Scan Report — ${report.projectNo || 'Draft'}` +
      (report.client ? ` · ${report.client}` : '') +
      (report.scanDate ? ` · ${report.scanDate}` : '');
    const findings = (report.targets || []).length;
    const cores = (report.cores || []).length;
    const summary = (findings || cores)
      ? `Summary: ${findings} target${findings === 1 ? '' : 's'} identified, ${cores} core verdict${cores === 1 ? '' : 's'} issued.`
      : 'Summary: see attached report.';
    const body = [
      'Hi,',
      '',
      'Please find the GSSI Ground Penetrating Radar scan report attached.',
      '',
      `Project: ${report.projectNo || '—'}`,
      `Client: ${report.client || '—'}`,
      `Site: ${report.siteAddress || '—'}`,
      `Scan area: ${report.scanArea || '—'}`,
      `Scan date: ${report.scanDate || '—'}`,
      report.preparedBy ? `Prepared by: ${report.preparedBy}` : null,
      '',
      summary,
      '',
      '(Attach the saved PDF before sending — the report does not auto-attach from the browser.)',
      '',
      '— Aggarwal Kamikaze\'s Cutting & Coring Ltd',
    ].filter(l => l !== null).join('\n');
    return { subject, body };
  };
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  useEffect(() => {
    if (emailDialogOpen) {
      const d = buildEmailDraft();
      setEmailSubject(d.subject);
      setEmailBody(d.body);
    }
  }, [emailDialogOpen]); // eslint-disable-line

  // Native share sheet (mobile): lets the user push the report into Mail, Messages,
  // etc. Optionally attaches the JSON backup as a real file when the platform allows it.
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const [shareNote, setShareNote] = useState('');
  const shareReport = async () => {
    rememberRecents();
    const payload = { title: emailSubject, text: emailBody };
    try {
      // Only attach the .json backup when the user opts in — most recipients
      // (client, engineer) just want the PDF.
      let file = null;
      if (shareBackup) {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        file = new File(
          [blob],
          `gssi-${report.projectNo || 'draft'}-${report.scanDate}.json`,
          { type: 'application/json' },
        );
      }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ ...payload, files: [file] });
      } else {
        await navigator.share(payload);
      }
      setEmailDialogOpen(false);
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        setShareNote('Sharing isn’t available here — use Open Email instead.');
      }
    }
  };

  // Reflect project number in the browser tab so multiple drafts stay sortable
  useEffect(() => {
    document.title = report.projectNo
      ? `Scan Report — ${report.projectNo}`
      : 'GSSI Scan Report';
  }, [report.projectNo]);

  // ---------- Print preview + per-section include/exclude ----------
  const [previewMode, setPreviewMode] = useState(false);
  // Setup cards (Tier / Sections / Print setup) collapse to a single toggle
  // by default so the report body starts near the top of the screen.
  // Persisted so it stays the way the engineer left it last session.
  const [setupCollapsed, setSetupCollapsedState] = useState(() => {
    try { return localStorage.getItem('ak_setup_collapsed') !== '0'; } catch { return true; }
  });
  const setSetupCollapsed = (v) => {
    const next = typeof v === 'function' ? v(setupCollapsed) : v;
    setSetupCollapsedState(next);
    try { localStorage.setItem('ak_setup_collapsed', next ? '1' : '0'); } catch {}
  };
  // Each section id used by the Print setup card. Order = order on print.
  const SECTION_IDS = [
    { id: 'workflowStatus', label: 'Workflow status (timestamps)' },
    { id: 'summary',        label: 'Executive summary' },
    { id: 'cover',          label: 'Project info (cover)' },
    { id: 'slab',           label: 'Slab context' },
    { id: 'targets',        label: 'Targets identified' },
    { id: 'findings',       label: 'Findings schedule (table)' },
    { id: 'coverSummary',   label: 'Cover thickness summary' },
    { id: 'diagram',        label: 'Site diagram' },
    { id: 'drawingNotes',   label: 'Drawing notes (CAD page editor)' },
    { id: 'scanPhotos',     label: 'Scan photos' },
    { id: 'zones',          label: 'Named zones list' },
    { id: 'locations',      label: 'Scan locations (Concrete Scanning Data cards)' },
    { id: 'proposedCores',  label: 'Proposed core schedule' },
    { id: 'gprScans',       label: 'GPR scans · full size' },
    { id: 'cores',          label: 'Core verdicts' },
    { id: 'uncertainty',    label: 'Areas of uncertainty' },
    { id: 'equipment',      label: 'Equipment & calibration' },
    { id: 'methods',        label: 'Methods narrative' },
    { id: 'limitations',    label: 'Limitations & assumptions' },
    { id: 'standardNotes',  label: 'Standard notes' },
    { id: 'cadPage',        label: 'CAD-style drawing page' },
    { id: 'disclaimer',     label: 'Legal disclaimer' },
    { id: 'signoff',        label: 'Authorship & review' },
  ];
  const vis = (id) => report.sectionVisibility?.[id] !== false;
  const setVis = (id, on) => update({
    sectionVisibility: { ...(report.sectionVisibility || {}), [id]: on },
  });
  const setAllVis = (on) => update({
    sectionVisibility: on ? {} : SECTION_IDS.reduce((a, s) => { a[s.id] = false; return a; }, {}),
  });

  // ---------- Section print order ----------
  // Effective order = saved custom order first (valid ids only), then any
  // sections not yet in the custom list, in their default SECTION_IDS order.
  const effectiveOrder = (() => {
    const base = SECTION_IDS.map(s => s.id);
    const saved = (report.sectionOrder || []).filter(id => base.includes(id));
    return [...saved, ...base.filter(id => !saved.includes(id))];
  })();
  const moveSection = (id, dir) => {
    const arr = [...effectiveOrder];
    const i = arr.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    update({ sectionOrder: arr });
  };
  // Drag-and-drop reorder for the Print setup rows. Drops the dragged id
  // into the position of the target id (before or after based on cursor
  // half-height), and persists via update({sectionOrder}).
  const [dragSectionId, setDragSectionId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null); // {id, side: 'above'|'below'}
  const reorderTo = (sourceId, targetId, side) => {
    if (!sourceId || sourceId === targetId) return;
    const arr = effectiveOrder.filter(id => id !== sourceId);
    let idx = arr.indexOf(targetId);
    if (idx < 0) idx = arr.length;
    if (side === 'below') idx += 1;
    arr.splice(idx, 0, sourceId);
    update({ sectionOrder: arr });
  };

  // CSS class to drop a section from print/preview while keeping it visible on
  // screen, plus a stable per-section hook used to drive the print order.
  const ph = (id) => `ak-sec ak-sec-${id}${vis(id) ? '' : ' print-hidden'}`;

  useEffect(() => {
    if (previewMode) document.body.classList.add('preview-mode');
    else document.body.classList.remove('preview-mode');
    return () => document.body.classList.remove('preview-mode');
  }, [previewMode]);

  // ---------- Preview-mode drag-to-reorder cards ----------
  // In Preview, the engineer can grab any rendered section card and drop it
  // above/below another to set print order — same data as the Print setup
  // panel's drag rows, but applied directly on the live preview so they can
  // see where it lands. Listeners are attached only while previewMode is on
  // so the editor stays untouched.
  useEffect(() => {
    if (!previewMode) return;
    const idFromEl = (el) => {
      if (!el) return null;
      const m = (el.className || '').toString().match(/ak-sec-([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    };
    let dragId = null;
    let lastTarget = null;
    const clearMarker = () => {
      if (lastTarget) {
        lastTarget.el.style.boxShadow = '';
        lastTarget = null;
      }
    };
    const onDragStart = (e) => {
      const card = e.target.closest('.ak-sec');
      const id = idFromEl(card);
      if (!id) return;
      dragId = id;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      }
      card.style.opacity = '0.4';
    };
    const onDragEnd = (e) => {
      const card = e.target.closest('.ak-sec');
      if (card) card.style.opacity = '';
      dragId = null;
      clearMarker();
    };
    const onDragOver = (e) => {
      const card = e.target.closest('.ak-sec');
      const id = idFromEl(card);
      if (!id || !dragId || id === dragId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const r = card.getBoundingClientRect();
      const side = (e.clientY - r.top) < r.height / 2 ? 'above' : 'below';
      if (!lastTarget || lastTarget.el !== card || lastTarget.side !== side) {
        clearMarker();
        card.style.boxShadow = side === 'above'
          ? 'inset 0 3px 0 0 #e02020'
          : 'inset 0 -3px 0 0 #e02020';
        lastTarget = { el: card, side };
      }
    };
    const onDrop = (e) => {
      const card = e.target.closest('.ak-sec');
      const id = idFromEl(card);
      if (id && dragId && id !== dragId) {
        e.preventDefault();
        const r = card.getBoundingClientRect();
        const side = (e.clientY - r.top) < r.height / 2 ? 'above' : 'below';
        reorderTo(dragId, id, side);
      }
      clearMarker();
      dragId = null;
    };
    const cards = Array.from(document.querySelectorAll('.ak-sec'));
    cards.forEach(card => {
      card.setAttribute('draggable', 'true');
      card.style.cursor = 'grab';
      card.addEventListener('dragstart', onDragStart);
      card.addEventListener('dragend',   onDragEnd);
      card.addEventListener('dragover',  onDragOver);
      card.addEventListener('drop',      onDrop);
    });
    return () => {
      cards.forEach(card => {
        card.removeAttribute('draggable');
        card.style.cursor = '';
        card.style.opacity = '';
        card.style.boxShadow = '';
        card.removeEventListener('dragstart', onDragStart);
        card.removeEventListener('dragend',   onDragEnd);
        card.removeEventListener('dragover',  onDragOver);
        card.removeEventListener('drop',      onDrop);
      });
    };
    // Re-bind whenever sectionOrder/visibility changes — new DOM may have
    // appeared (e.g. tier change makes more cards visible).
  }, [previewMode, report.sectionOrder, report.sectionVisibility, report.tier]);

  const update = (patch) => setReport(r => ({ ...r, ...patch }));

  // Dev-only — wired to the 🧪 Demo button in the setup bar. Merges a
  // realistic-looking report on top of the current one so the engineer can
  // jump straight to 👁 Preview without typing every field. Visible in
  // `npm run dev` only; stripped from prod by Vite (import.meta.env.DEV).
  const loadDemoReport = () => {
    if (!window.confirm('Overwrite current report with demo data?')) return;
    setReport(r => {
      const next = { ...r, ...DEMO_REPORT };
      const id = currentIdRef.current;
      if (id) saveReport(id, next);
      return next;
    });
  };

  // ---------- Targets ----------
  const addTarget = () => update({
    targets: [...report.targets, {
      id: `T-${String(report.targets.length + 1).padStart(2, '0')}`,
      type: 'Rebar (top mat)', depth: '', cover: '',
      note: '', confidence: 'high',
    }],
  });
  const updateTarget = (i, patch) => {
    const next = [...report.targets];
    next[i] = { ...next[i], ...patch };
    update({ targets: next });
  };
  const removeTarget = (i) => update({ targets: report.targets.filter((_, j) => j !== i) });
  const moveTarget = (i, dir) => update({ targets: moveInArray(report.targets, i, dir) });

  // ---------- Cores ----------
  const addCore = () => update({
    cores: [...report.cores, {
      label: String.fromCharCode(65 + report.cores.length),
      size: '4"', verdict: 'safe', clearance: '', note: '',
    }],
  });
  const updateCore = (i, patch) => {
    const next = [...report.cores];
    next[i] = { ...next[i], ...patch };
    update({ cores: next });
  };
  const removeCore = (i) => update({ cores: report.cores.filter((_, j) => j !== i) });
  const moveCore = (i, dir) => update({ cores: moveInArray(report.cores, i, dir) });

  // ---------- Markup color key ----------
  // Editable per-report legend so a crew can match a region/client colour
  // standard. Falls back to the APWA default for reports saved before this
  // existed (no migration needed).
  const legend = report.colorLegend || APWA_LEGEND;
  const updateLegend = (i, patch) => {
    const next = legend.map((it, j) => j === i ? { ...it, ...patch } : it);
    update({ colorLegend: next });
  };
  const addLegend = () => update({ colorLegend: [...legend, { color: '#888888', label: '' }] });
  const removeLegend = (i) => update({ colorLegend: legend.filter((_, j) => j !== i) });
  const resetLegend = () => update({ colorLegend: APWA_LEGEND.map(x => ({ ...x })) });

  // ---------- Save / export ----------
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveNote, setSaveNote] = useState('');           // status line shown in the Save dialog
  const supportsFS = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  // Desktop build (Electron) exposes a native file API; when present we save/open
  // real files through OS dialogs instead of the browser.
  const desktop = typeof window !== 'undefined' && window.akDesktop && window.akDesktop.isDesktop;
  const fileHandleRef = useRef(null);                     // the file we keep updating (this session)
  const desktopPathRef = useRef(null);                    // native file path (desktop build)
  const [savedFileName, setSavedFileName] = useState(null);
  // Desktop: recently opened/saved files; auto-save cadence; last auto-save time.
  const [recentFiles, setRecentFiles] = useState(() => lsGet(RECENT_FILES_KEY, []));
  const [autoSaveMin, setAutoSaveMin] = useState(() => lsGet(AUTOSAVE_KEY, 0));
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState(null);
  const lastAutoSaveRef = useRef(null);
  // Preferred email/compose target, remembered between reports.
  const [emailProvider, setEmailProvider] = useState(() => lsGet(EMAIL_PROVIDER_KEY, 'mailto'));
  // Whether sharing attaches the .json backup. Off by default — a client or
  // engineer only needs the PDF; the backup is for re-opening/editing in-app.
  const [shareBackup, setShareBackup] = useState(() => lsGet(SHARE_BACKUP_KEY, false));
  const toggleShareBackup = (on) => { setShareBackup(on); lsSet(SHARE_BACKUP_KEY, on); };

  const reportJSON = () => JSON.stringify(report, null, 2);

  // Desktop recent-files list: most-recent first, de-duped by path, capped.
  const pushRecentFile = (entry) => {
    if (!entry || !entry.path) return;
    setRecentFiles((prev) => {
      const next = [
        { path: entry.path, name: entry.name || entry.path, at: Date.now() },
        ...prev.filter((f) => f.path !== entry.path),
      ].slice(0, 8);
      lsSet(RECENT_FILES_KEY, next);
      return next;
    });
  };
  const removeRecentFile = (filePath) => {
    setRecentFiles((prev) => {
      const next = prev.filter((f) => f.path !== filePath);
      lsSet(RECENT_FILES_KEY, next);
      return next;
    });
  };

  // A recognizable, collision-resistant file name: job number + description + date.
  const baseFileName = () => {
    const parts = ['gssi', report.projectNo, slugify(report.jobNote || report.client), report.scanDate];
    const base = parts.map(p => slugify(String(p || ''))).filter(Boolean).join('-');
    return base || 'gssi-scan-report';
  };

  // Download path: ALWAYS a unique file (adds a time stamp), so a download can
  // never overwrite an earlier saved file.
  const exportJSON = () => {
    rememberRecents();
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/[-:]/g, '');
    const blob = new Blob([reportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFileName()}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveNote(`Downloaded ${a.download}`);
  };

  // File System Access path: pick a file once, then keep updating that same file.
  const writeToHandle = async (handle) => {
    const writable = await handle.createWritable();
    await writable.write(new Blob([reportJSON()], { type: 'application/json' }));
    await writable.close();
  };
  const saveToFile = async (forceNew = false) => {
    // Desktop build: write a real file via native dialogs. The first save (or
    // "Save As") picks a path; later saves overwrite that same file silently.
    if (desktop) {
      try {
        let name;
        if (forceNew || !desktopPathRef.current) {
          const res = await window.akDesktop.saveFileAs(`${baseFileName()}.akscan`, reportJSON());
          if (!res) return;                       // user cancelled the dialog
          desktopPathRef.current = res.path;
          name = res.name;
        } else {
          const res = await window.akDesktop.saveFile(desktopPathRef.current, reportJSON());
          name = (res && res.name) ? res.name : (savedFileName || 'file');
        }
        setSavedFileName(name);
        pushRecentFile({ path: desktopPathRef.current, name });
        lastAutoSaveRef.current = reportJSON();
        rememberRecents();
        setSaveNote(`Saved to ${name}`);
      } catch {
        setSaveNote('Could not save that file.');
      }
      return;
    }
    if (!supportsFS) { exportJSON(); return; }
    try {
      if (forceNew || !fileHandleRef.current) {
        fileHandleRef.current = await window.showSaveFilePicker({
          suggestedName: `${baseFileName()}.json`,
          types: [{ description: 'Scan report backup', accept: { 'application/json': ['.json'] } }],
        });
      }
      await writeToHandle(fileHandleRef.current);
      rememberRecents();
      setSavedFileName(fileHandleRef.current.name);
      setSaveNote(`Saved to ${fileHandleRef.current.name}`);
    } catch (err) {
      if (err && err.name !== 'AbortError') setSaveNote('Could not save to that file — try Download backup instead.');
    }
  };
  // Starting/loading a different job must not write into the previous job's file.
  const forgetFile = () => { fileHandleRef.current = null; desktopPathRef.current = null; setSavedFileName(null); };

  // Desktop: reveal the linked .akscan file in its folder (Explorer/Finder) so
  // the saved report is easy to find/attach.
  const revealSavedFile = () => {
    if (desktop && desktopPathRef.current && window.akDesktop?.showInFolder) {
      window.akDesktop.showInFolder(desktopPathRef.current);
    }
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try { setReport({ ...DEFAULT_REPORT, ...JSON.parse(ev.target.result) }); forgetFile(); }
      catch { alert('Invalid JSON'); }
    };
    r.readAsText(file);
  };

  // ---------- Desktop (Electron) file open ----------
  // Load a report from a native file payload and remember its path so the next
  // "Save" overwrites the same file.
  const applyLoadedReport = (payload) => {
    if (!payload || !payload.content) return;
    try {
      setReport({ ...DEFAULT_REPORT, ...JSON.parse(payload.content) });
      desktopPathRef.current = payload.path || null;
      setSavedFileName(payload.name || null);
      lastAutoSaveRef.current = payload.content;
      if (payload.path) pushRecentFile({ path: payload.path, name: payload.name });
      setSaveNote(payload.name ? `Opened ${payload.name}` : '');
    } catch {
      setSaveNote('That file could not be read (not a valid report).');
    }
  };
  const openFromDesktop = async () => {
    const payload = await window.akDesktop.openFile();
    if (payload) applyLoadedReport(payload);
  };
  // Open a file straight from the recent-files list (desktop).
  const openRecentFile = async (filePath) => {
    try {
      const payload = await window.akDesktop.readFile(filePath);
      if (payload) { applyLoadedReport(payload); setSaveOpen(false); }
    } catch {
      setSaveNote('That file is no longer there — removing it from recents.');
      removeRecentFile(filePath);
    }
  };

  // ---------- Auto-save (desktop file or web File System handle) ----------
  const hasLinkedFile = () => (desktop && !!desktopPathRef.current) || (supportsFS && !!fileHandleRef.current);
  const autoSaveNow = async () => {
    if (!hasLinkedFile()) return;
    const json = reportJSON();
    if (json === lastAutoSaveRef.current) return;     // nothing changed since last save
    try {
      if (desktop && desktopPathRef.current) {
        await window.akDesktop.saveFile(desktopPathRef.current, json);
      } else if (supportsFS && fileHandleRef.current) {
        await writeToHandle(fileHandleRef.current);
      } else return;
      lastAutoSaveRef.current = json;
      setLastAutoSaveAt(Date.now());
    } catch { /* leave for the next tick or a manual save */ }
  };
  // Keep the interval calling the latest closure without re-subscribing.
  const autoSaveNowRef = useRef(autoSaveNow);
  autoSaveNowRef.current = autoSaveNow;
  useEffect(() => { lsSet(AUTOSAVE_KEY, autoSaveMin); }, [autoSaveMin]);
  useEffect(() => {
    if (!autoSaveMin) return;
    const id = setInterval(() => { autoSaveNowRef.current(); }, autoSaveMin * 60 * 1000);
    return () => clearInterval(id);
  }, [autoSaveMin]);

  // ---------- PDF export ----------
  // Desktop: render to a real PDF saved next to the report file (then revealed
  // in its folder). Web: open the browser print dialog with "Save as PDF".
  const savePdfDesktop = async () => {
    rememberRecents();
    try {
      const res = await window.akDesktop.savePdf({
        suggestedName: `${baseFileName()}.pdf`,
        currentFilePath: desktopPathRef.current || null,
      });
      if (res) setSaveNote(`PDF saved to ${res.name} — opened its folder.`);
    } catch {
      setSaveNote('Could not create the PDF.');
    }
  };
  const printPDF = () => { rememberRecents(); window.print(); };
  const exportPDF = () => { if (desktop) savePdfDesktop(); else printPDF(); };

  // ---------- Email / compose ----------
  useEffect(() => { lsSet(EMAIL_PROVIDER_KEY, emailProvider); }, [emailProvider]);
  // mailto opens the OS mail client; webmail links open in the real browser.
  // On desktop, window.open is routed to the system browser/mail app.
  const openExternalUrl = (url) => {
    if (desktop) { window.open(url, '_blank'); }
    else if (url.startsWith('mailto:')) { window.location.href = url; }
    else { window.open(url, '_blank', 'noopener'); }
  };
  const sendEmail = () => {
    rememberRecents();
    openExternalUrl(composeUrl(emailProvider, emailTo, emailSubject, emailBody));
    setEmailDialogOpen(false);
  };

  // Native menu actions are kept in a ref so the (mount-only) listener always
  // calls the latest handlers without re-subscribing.
  const desktopActionsRef = useRef({});
  desktopActionsRef.current = {
    'new': () => setConfirmReset(true),
    'open': openFromDesktop,
    'save': () => saveToFile(false),
    'save-as': () => saveToFile(true),
    'print': exportPDF,
  };
  useEffect(() => {
    if (!desktop) return;
    const offMenu = window.akDesktop.onMenu((action) => {
      const fn = desktopActionsRef.current[action];
      if (fn) fn();
    });
    const offOpen = window.akDesktop.onOpenFile((payload) => applyLoadedReport(payload));
    window.akDesktop.getLaunchFile().then((payload) => { if (payload) applyLoadedReport(payload); });
    return () => { offMenu && offMenu(); offOpen && offOpen(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tier-based visibility
  const tier = report.tier;
  const showCalibration = tier !== 'quick';
  const showLimitations = tier !== 'quick';
  const showUncertainty = tier !== 'quick';
  const showFullEquipment = tier === 'full';

  return (
    <div className="ak-shell" style={{
      background: c.bg, minHeight: '100vh', color: c.text,
      fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '14px 12px 100px', margin: '0 auto',
    }}>
      <ThemeStyles />
      {previewMode && (
        <div className="preview-bar">
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            👁 PDF Preview · {SECTION_IDS.filter(s => vis(s.id)).length} of {SECTION_IDS.length} sections
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPreviewMode(false)} style={{
              background: 'transparent', color: '#fff', border: '1px solid #555',
              borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
            }}>✕ Exit preview</button>
            <button onClick={exportPDF} style={{
              background: '#e02020', color: '#fff', border: '1px solid #e02020',
              borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
            }}>📄 Save / send PDF</button>
          </div>
        </div>
      )}
      <style>{`
        .print-only { display: none; }
        /* In Preview mode, treat the page as if it were printing — so the
           brand ribbon (logo + company name pinned to the very top of the
           report) actually shows. Without this rule, the ribbon was hidden
           in Preview even though it would appear in the saved PDF. */
        body.preview-mode .print-only { display: block !important; }
        /* === Brand flourishes (opt-in via report.brandFlourishes) === */
        .brand-ribbon {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; margin-bottom: 12px;
          background: linear-gradient(90deg, rgba(212,69,69,0.08), rgba(212,69,69,0));
          border-left: 3px solid var(--ak-accent);
          border-radius: 6px;
        }
        .brand-ribbon-mark {
          height: 44px; width: auto; flex-shrink: 0;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));
        }
        .brand-ribbon-text { line-height: 1.2; }
        .brand-ribbon-title {
          font-size: 11pt; font-weight: 800;
          color: var(--ak-text); letter-spacing: 0.3px;
        }
        .brand-ribbon-tagline {
          font-size: 9.5pt; font-style: italic;
          color: var(--ak-accent); margin-top: 2px;
        }
        .brand-signoff {
          margin-top: 18px; padding-top: 10px;
          border-top: 1px solid var(--ak-border);
          font-size: 9pt; font-style: italic; text-align: center;
          color: var(--ak-text-faint);
        }
        @media print {
          .brand-ribbon { background: #fafafa; }
          .brand-ribbon-title { color: #111; }
          .brand-ribbon-tagline { color: #a32626; }
          .brand-signoff { color: #555; border-top-color: #ccc; }
        }
        /* Mirror brand-ribbon print colours into Preview mode — without
           these, the title renders white-on-light (invisible) since the
           dark-theme var(--ak-text) is still in effect on screen. */
        body.preview-mode .brand-ribbon { background: #fafafa !important; }
        body.preview-mode .brand-ribbon-title { color: #111 !important; }
        body.preview-mode .brand-ribbon-tagline { color: #a32626 !important; }
        body.preview-mode .brand-signoff { color: #555 !important; border-top-color: #ccc !important; }
        /* === BRANDED LETTERHEAD (v1.0.15 facelift) — Caveat two-tone wordmark.
           Ported from the finalized pdf-mockup. Print + preview only; the
           full v1 report (disclaimer + every section) renders beneath it. === */
        @font-face{font-family:'Caveat';font-weight:700;font-display:swap;
          src:url(${import.meta.env.BASE_URL}fonts/caveat-700.woff2) format('woff2');}
        @font-face{font-family:'Caveat';font-weight:400;font-display:swap;
          src:url(${import.meta.env.BASE_URL}fonts/caveat-400.woff2) format('woff2');}
        .ak-lh { display: none; }
        @media print { .ak-lh { display: grid !important; } }
        body.preview-mode .ak-lh { display: grid !important; }
        .ak-lh {
          grid-template-columns: auto 1fr auto; gap: 16px; align-items: center;
          border-bottom: 3px solid #141414; padding-bottom: 11px; margin-bottom: 14px;
        }
        .report-body > .ak-lh { order: -100; }
        .ak-lh-logo { height: 78px; width: auto; filter: drop-shadow(0 2px 3px rgba(176,138,30,.45)); }
        .ak-lh-nm1 { font-family: 'Caveat', cursive; font-weight: 700; font-size: 34pt; line-height: .82; color: #141414; }
        .ak-lh-nm2 { font-family: 'Caveat', cursive; font-weight: 700; font-size: 22pt; line-height: .9; color: #6b7682; }
        /* Red left-accent on section cards (focus) + faint gold lift — mirrors the locked PDF */
        @media print { .ak-shell .ak-sec { border-left: 3px solid #c0282d !important; box-shadow: 0 4px 7px -2px rgba(0,0,0,.13) !important; } }
        body.preview-mode .ak-shell .ak-sec { border-left: 3px solid #c0282d !important; box-shadow: 0 4px 7px -2px rgba(0,0,0,.13) !important; }
        .ak-lh-sub { font-size: 8pt; color: #555; letter-spacing: .16em; text-transform: uppercase; margin-top: 6px; font-weight: 600; }
        .ak-lh-addr { font-size: 7.5pt; color: #777; margin-top: 4px; line-height: 1.45; }
        .ak-lh-box { font-size: 8pt; text-align: right; line-height: 1.5; border-left: 1px solid #cfcfcf; padding-left: 13px; }
        .ak-lh-box b { display: block; color: #555; font-size: 6.8pt; letter-spacing: .09em; text-transform: uppercase; font-weight: 700; }
        .ak-lh-box .v { font-size: 10pt; font-weight: 700; margin-bottom: 5px; color: #141414; }
        /* === DRAFT watermark (report.status === 'draft') ===
           Additive diagonal overlay. Fixed so Chrome repeats it on every
           printed page. Pure translucent grey — does NOT alter the locked-in
           PDF palette (white paper, black text, brand-red headers). */
        .draft-watermark {
          position: fixed; inset: 0; z-index: 9000;
          pointer-events: none; display: none;
        }
        .draft-watermark svg { width: 100%; height: 100%; }
        @media print { .draft-watermark { display: block !important; } }
        body.preview-mode .draft-watermark { display: block !important; }
        .scan-location-card.dragging,
        .scan-photo-row.dragging { opacity: 0.35; }
        .scan-location-card.drop-target,
        .scan-photo-row.drop-target {
          outline: 2px dashed #e02020;
          outline-offset: -2px;
        }
        /* Typography polish — crisp rendering and aligned figures for a more
           professional printed report (font itself is the bundled Inter). */
        .ak-shell {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          font-feature-settings: "kern" 1, "liga" 1, "tnum" 1;
          font-variant-numeric: tabular-nums;
        }
        @media print {
          .ak-shell { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        /* Report body is a flex column so section print order can be set via
           CSS 'order'. Brand letterhead pins to the very top, footer to bottom. */
        .report-body { display: flex; flex-direction: column; }
        .report-body > .brand-ribbon  { order: -100; }
        .report-body > .brand-signoff { order: 100000; }
        /* === v2: 3-column responsive workspace shell (screen only) === */
        .ws-grid { display: block; }
        .ws-nav, .ws-rail { display: none; }
        /* Brief highlight when "At a glance" jumps to a core card. */
        @keyframes jumpFlash {
          0%, 18% { box-shadow: 0 0 0 3px rgba(192,40,45,0.55); }
          100%    { box-shadow: 0 0 0 3px rgba(192,40,45,0); }
        }
        .jump-flash { animation: jumpFlash 1.6s ease-out 1; }
        @media (min-width: 900px) {
          .ws-grid {
            display: grid;
            grid-template-columns: 214px minmax(0, 1fr) 208px;
            gap: 18px; align-items: start;
          }
          .ws-nav, .ws-rail { display: block; position: sticky; top: 12px; align-self: start; max-height: calc(100vh - 24px); overflow-y: auto; }
        }
        .ws-nav .sep {
          font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
          color: ${c.textFaint}; margin: 0 0 6px 11px;
        }
        .ws-nav .ni {
          display: block; width: 100%; text-align: left; cursor: pointer;
          background: transparent; border: 0; border-left: 2px solid transparent;
          color: ${c.textDim}; font: inherit; font-size: 13.5px; line-height: 1.35;
          padding: 6px 11px; border-radius: 0 7px 7px 0; margin-bottom: 1px;
          transition: background .12s, color .12s, border-color .12s;
        }
        .ws-nav .ni:hover { background: ${c.cardAlt}; color: ${c.text}; border-left-color: ${c.accent}; }
        /* Side-panel section manager rows: include toggle + jump + reorder. */
        .ws-nav .sep-row { display: flex; align-items: center; justify-content: space-between; padding-right: 6px; }
        .ws-nav .nav-reset {
          background: transparent; border: 0; cursor: pointer; font: inherit;
          font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
          color: ${c.textFaint}; padding: 2px 4px;
        }
        .ws-nav .nav-reset:hover { color: ${c.accent}; }
        .ws-nav .nav-row {
          display: flex; align-items: center; gap: 3px;
          padding: 1px 3px 1px 4px; border-radius: 5px;
          border-left: 2px solid transparent; transition: background .12s;
        }
        .ws-nav .nav-row:hover { background: ${c.cardAlt}; }
        .ws-nav .nav-grip { color: ${c.textFaint}; font-size: 11px; cursor: grab; user-select: none; flex-shrink: 0; padding: 0 1px; }
        .ws-nav .nav-row input[type=checkbox] { accent-color: ${c.accent}; flex-shrink: 0; margin: 0; cursor: pointer; }
        .ws-nav .nav-name {
          flex: 1; min-width: 0; text-align: left; background: transparent; border: 0;
          color: ${c.textDim}; font: inherit; font-size: 12.5px; line-height: 1.3; cursor: pointer;
          padding: 5px 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ws-nav .nav-name:hover { color: ${c.text}; }
        .ws-nav .nav-arrows { display: flex; flex-direction: column; gap: 0; flex-shrink: 0; }
        .ws-nav .nav-arrows button {
          background: transparent; border: 0; color: ${c.textFaint}; cursor: pointer;
          font-size: 8px; line-height: 1; padding: 1px 3px;
        }
        .ws-nav .nav-arrows button:hover:not(:disabled) { color: ${c.text}; }
        .ws-nav .nav-arrows button:disabled { opacity: 0.25; cursor: default; }
        @media print {
          .ws-grid { display: block !important; }
          .ws-nav, .ws-rail { display: none !important; }
        }
        /* Preview mode must mirror print: collapse the 3-column editor grid so
           the report fills the full page width. Otherwise the hidden nav/rail
           columns (172px + 208px) stay reserved and squish the report into the
           middle ~400px — a "mobile width" preview even on a maximized window. */
        body.preview-mode .ws-grid { display: block !important; }
        body.preview-mode .ws-nav, body.preview-mode .ws-rail { display: none !important; }
        /* CAD-page on-screen container (matches the print landscape look loosely) */
        .cad-page {
          background: #fff; color: #000;
          border: 1px solid #999;
          margin-bottom: 14px;
          padding: 16px;
        }
        /* Per-section drop from PDF: hide on print AND in preview mode,
           keep visible on screen so the editor stays usable. */
        @media print { .print-hidden { display: none !important; } }
        body.preview-mode .print-hidden { display: none !important; }
        body.preview-mode .no-print     { display: none !important; }
        /* Match print: fields read as clean text, not editable boxes. */
        body.preview-mode .ak-shell input:not([type="checkbox"]):not([type="radio"]),
        body.preview-mode .ak-shell select {
          border: none !important; background: transparent !important;
          padding-left: 0 !important; -webkit-appearance: none !important; appearance: none !important;
        }
        body.preview-mode .ak-shell input[type="date"]::-webkit-calendar-picker-indicator { display: none !important; }
        body.preview-mode {
          background: #6a6a6a !important;
          padding: 0 !important;
          color: #000;
        }
        body.preview-mode .ak-shell {
          background: #fff !important;
          color: #000 !important;
          max-width: 8.5in !important;
          margin: 64px auto 64px !important;
          padding: 0.7in !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.45);
          border: 1px solid #aaa;
          min-height: 11in;
        }
        /* On a phone the 8.5in "paper on a desk" page renders as a small
           card boxed in grey margins. Drop that chrome so the preview fills
           the screen edge-to-edge and the text is readable without pinch-zoom.
           Screen-only: the saved PDF uses window.print() + @media print, so
           the real page geometry (8.5in + 0.7in margins) is unaffected. */
        @media (max-width: 700px) {
          body.preview-mode { background: #fff !important; }
          body.preview-mode .ak-shell {
            max-width: none !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            border: none !important;
            min-height: 0 !important;
          }
        }
        /* If the user prints (or the review harness captures) while Preview mode
           is on, strip the "paper on a desk" chrome so the grey desk background
           and the shell's screen margins/shadow never bleed into the saved PDF. */
        @media print {
          body.preview-mode { background: #fff !important; }
          body.preview-mode .ak-shell {
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
        body.preview-mode .ak-shell .scan-photo-row,
        body.preview-mode .ak-shell .gpr-scan-figure,
        body.preview-mode .ak-shell .scan-location-card,
        body.preview-mode .ak-shell input,
        body.preview-mode .ak-shell select,
        body.preview-mode .ak-shell textarea {
          border-color: #ccc !important;
          background: #fff !important;
          color: #000 !important;
        }
        /* Preview matches print: deeper brand-red location header (not neon),
           rounded to follow the card corner. */
        body.preview-mode .ak-shell .scan-location-card { border: 1.5px solid #5b6470 !important; }
        body.preview-mode .ak-shell .scan-location-card .loc-header {
          background: #c0282d !important; color: #fff !important;
          border-radius: 7px 7px 0 0;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        /* Preview matches print: scan photos as a clean 2-up figure grid. */
        body.preview-mode .ak-shell .scan-photo-row {
          display: inline-block !important; width: 48% !important;
          margin: 0 1% 10px !important; vertical-align: top; box-sizing: border-box;
          background: transparent !important; border: 1px solid #c2c6cc !important;
          border-radius: 6px !important; padding: 7px !important; cursor: default !important;
        }
        body.preview-mode .ak-shell .photo-print img,
        body.preview-mode .ak-shell .photo-print canvas {
          width: 100% !important; height: auto !important; max-height: 9cm;
          object-fit: contain;
        }
        body.preview-mode .ak-shell .photo-print-meta { font-size: 9pt; line-height: 1.45; margin-top: 6px; color: #000; }
        body.preview-mode .ak-shell .photo-print-loc { font-size: 10pt; margin-right: 8px; }
        body.preview-mode .ak-shell .photo-print-conf { font-size: 7.5pt; padding: 1px 6px; border-radius: 4px; letter-spacing: .5px; }
        body.preview-mode .ak-shell .photo-print-scale { color: #555 !important; font-size: 8.5pt; }
        /* Lone/trailing odd photo: full-width side-by-side figure so the freed
           half carries the caption/meta instead of sitting blank. */
        body.preview-mode .ak-shell .scan-photo-row--solo { width: 98% !important; }
        body.preview-mode .ak-shell .scan-photo-row--solo .photo-print {
          display: flex !important; gap: 16px; align-items: flex-start;
        }
        body.preview-mode .ak-shell .scan-photo-row--solo .photo-print > :first-child {
          flex: 0 0 58%; max-width: 58%;
        }
        body.preview-mode .ak-shell .scan-photo-row--solo .photo-print-meta {
          flex: 1; margin-top: 0 !important; align-self: stretch;
          border-left: 2px solid #e1e4e8; padding-left: 16px;
        }
        /* Mirror the dark-theme kill from @media print so Preview matches
           the saved PDF exactly — engineer sees what will actually print. */
        body.preview-mode .ak-sec {
          background: #fff !important;
          color: #000 !important;
          border-color: #999 !important;
          box-shadow: none !important;
          /* Plain-div sections (scanPhotos/summary/locations/gprScans) lack the
             Card primitive's inline borderRadius:10, so the red border-left
             accent rendered as a square bar. Round every .ak-sec uniformly. */
          border-radius: 10px !important;
        }
        body.preview-mode .ak-sec div,
        body.preview-mode .ak-sec section,
        body.preview-mode .ak-sec article,
        body.preview-mode .ak-sec li,
        body.preview-mode .ak-sec td,
        body.preview-mode .ak-sec th,
        body.preview-mode .ak-sec label {
          background-color: transparent !important;
          box-shadow: none !important;
        }
        body.preview-mode .ak-sec,
        body.preview-mode .ak-sec h1, body.preview-mode .ak-sec h2,
        body.preview-mode .ak-sec h3, body.preview-mode .ak-sec h4,
        body.preview-mode .ak-sec p, body.preview-mode .ak-sec span,
        body.preview-mode .ak-sec div, body.preview-mode .ak-sec label,
        body.preview-mode .ak-sec li, body.preview-mode .ak-sec strong,
        body.preview-mode .ak-sec em, body.preview-mode .ak-sec a,
        body.preview-mode .ak-sec td, body.preview-mode .ak-sec th {
          color: #000 !important;
        }
        body.preview-mode .ak-sec div[style*="border"],
        body.preview-mode .ak-sec section[style*="border"] {
          border-color: #bbb !important;
        }
        .preview-bar {
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 9999;
          background: #1a1a1a; color: #fff;
          padding: 10px 14px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          border-bottom: 2px solid #e02020;
        }
        @media print { .preview-bar { display: none !important; } }
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }

          /* === DARK-THEME PRINT KILL ===
             Cards have inline background: c.card (dark) and text uses
             dark-theme colors. Force the printed paper to white and text to
             black; specific elements that need to keep colour (brand ribbon,
             location header, photos, color swatches) opt back in below via
             higher-specificity rules later in this @media block. */
          html, body, #root, .ak-shell {
            background: #fff !important;
            color: #000 !important;
          }
          /* #root is the React mount between body and the shell; it carried the
             dark theme background and showed as a black frame around the page on
             the real print path. Force it (and any padding) flat-white. */
          #root { padding: 0 !important; margin: 0 !important; }
          .ak-shell {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          .ak-sec {
            background: #fff !important;
            color: #000 !important;
            border: 1.5px solid #5b6470 !important;
            box-shadow: none !important;
            /* Match preview: round plain-div sections so the red border-left
               accent follows the corner instead of rendering as a square bar. */
            border-radius: 10px !important;
          }
          /* Cards have inline background: c.card on the structural wrappers
             (div). Clear those, plus any nested dark sub-cards. Spans and
             buttons keep their inline backgrounds so colour swatches, status
             pills and pickers still render correctly. */
          .ak-sec div,
          .ak-sec section,
          .ak-sec article,
          .ak-sec li,
          .ak-sec td,
          .ak-sec th,
          .ak-sec label {
            background-color: transparent !important;
            box-shadow: none !important;
          }
          /* Force all text-bearing elements to black — dark-theme inline
             colors (c.text, c.textDim, c.textFaint) are dark greys/whites. */
          .ak-sec, .ak-sec h1, .ak-sec h2, .ak-sec h3, .ak-sec h4,
          .ak-sec p, .ak-sec span, .ak-sec div, .ak-sec label,
          .ak-sec li, .ak-sec strong, .ak-sec em, .ak-sec a,
          .ak-sec td, .ak-sec th, .ak-sec dt, .ak-sec dd,
          .ak-sec section, .ak-sec article {
            color: #000 !important;
          }
          /* Borders fade to grey so they read as lines, not blocks. */
          .ak-sec div[style*="border"],
          .ak-sec section[style*="border"] {
            border-color: #8a9099 !important;
          }
          .ak-sec input, .ak-sec textarea, .ak-sec select {
            background: #fff !important;
            color: #000 !important;
            border: 1px solid #98a0aa !important;
            -webkit-text-fill-color: #000 !important;
          }
          /* Confidence toggles as light chips on white paper: unselected = white/
             grey, selected = a light tint of its colour. (Dark-theme button bgs
             are preserved by the print kill, so they'd otherwise print navy.) */
          .ak-conf, .ak-conf-on, .ak-conf-off, .ak-conf-badge {
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
            -webkit-text-fill-color: currentColor !important;
          }
          .ak-conf-badge { border: 1px solid; }
          .ak-conf-off { background: #fff !important; color: #555 !important; border-color: #b9bdc4 !important; }
          /* Selected confidence chips + the matching T-0X badge share one (less
             bleached) colour so they read as a set. */
          .ak-conf-on.ak-conf-high, .ak-conf-badge.ak-conf-high { background: #c9ead4 !important; color: #14713a !important; border-color: #1a7f37 !important; }
          .ak-conf-on.ak-conf-med,  .ak-conf-badge.ak-conf-med  { background: #fbe3b8 !important; color: #8a5300 !important; border-color: #b8810a !important; }
          .ak-conf-on.ak-conf-low,  .ak-conf-badge.ak-conf-low  { background: #f7cfcf !important; color: #b21f24 !important; border-color: #c0282d !important; }
          /* B4: a hair of letter-spacing so tight pairs (e.g. "Hi") don't kiss. */
          .ak-sec p, .ak-sec li, .ak-sec span, .ak-sec strong, .ak-sec label,
          .ak-sec td, .ak-sec th, .ak-sec h1, .ak-sec h2, .ak-sec h3, .ak-sec h4 {
            letter-spacing: 0.01em;
          }
          /* Preserve intentionally-coloured elements (brand red, swatches,
             scan annotations, photo content, etc.) — !important rules that
             follow these in the file will win because cascade is source-order
             at equal specificity. */

          .cad-page {
            page-break-before: always;
            page-break-after: always;
            padding: 4mm 2mm;
            border: none;
            font-family: 'Inter Variable', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .cad-letterhead {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 14px;
            align-items: center;
            border-bottom: 3px solid #141414;
            padding-bottom: 9px;
            margin-bottom: 10px;
          }
          .cad-logo { height: 70px; width: auto; }
          /* Mirror the page-1 letterhead wordmark (two-tone Caveat, nm1 > nm2).
             !important on colors because the CAD page sits inside an .ak-sec,
             whose dark-theme print color-kill would otherwise force black. */
          .cad-nm1 { font-family: 'Caveat', cursive; font-weight: 700; font-size: 32pt; line-height: 0.82; color: #141414 !important; }
          .cad-nm2 { font-family: 'Caveat', cursive; font-weight: 700; font-size: 21pt; line-height: 0.9; color: #6b7682 !important; }
          .cad-subtitle { font-size: 8pt; color: #555 !important; letter-spacing: .16em; text-transform: uppercase; margin-top: 6px; font-weight: 600; }
          .cad-addr { font-size: 7.5pt; color: #777 !important; margin-top: 4px; line-height: 1.45; }
          .cad-letterhead-meta { font-size: 8pt; text-align: right; line-height: 1.5; border-left: 1px solid #cfcfcf; padding-left: 13px; }
          .cad-letterhead-meta b { display: block; color: #555 !important; font-size: 6.8pt; letter-spacing: .09em; text-transform: uppercase; font-weight: 700; }
          .cad-letterhead-meta .v { font-size: 10pt; font-weight: 700; margin-bottom: 5px; color: #141414 !important; }
          /* Portrait sheet: drawing full-width on top, then the notes (two
             balanced columns, full width) and finally the title block, all in
             normal flow so the sheet fills one page in the common case. */
          .cad-diagram { border: 1px solid #555; padding: 4px; margin: 4mm auto 0; width: fit-content; max-width: 100%; }
          .cad-diagram canvas { display: block !important; height: 88mm !important; width: auto !important; max-width: 100% !important; }
          .cad-lower { margin-top: 5mm; }
          .cad-notes {
            font-size: 8pt; line-height: 1.35;
            columns: 3; column-gap: 7mm;
          }
          /* Heading stays with its first lines; the list itself may flow across
             the two columns so they balance and leave room for the title block. */
          .cad-notes-block { margin-bottom: 7px; }
          .cad-notes-heading { break-after: avoid; }
          .cad-notes-heading {
            font-size: 8pt; font-weight: 900; letter-spacing: 1.2px;
            border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;
          }
          .cad-notes-body { white-space: pre-wrap; }
          .cad-notes-list { margin: 0; padding-left: 18px; }
          .cad-notes-list li { margin-bottom: 3px; }
          .cad-legend { list-style: none; margin: 0; padding: 0; }
          .cad-legend li { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
          .cad-legend-swatch {
            display: inline-block; width: 14px; height: 10px;
            border: 1px solid #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cad-titleblock {
            margin-top: 4mm;
            margin-left: auto;
            width: 90mm;
            border: 1.5px solid #000;
            font-size: 8pt;
            break-inside: avoid;
          }
          .cad-tb-row {
            display: grid;
            grid-template-columns: 24mm 1fr;
            border-bottom: 1px solid #000;
            padding: 3px 6px;
          }
          .cad-tb-row:last-child { border-bottom: none; }
          .cad-tb-row span { color: #666; letter-spacing: 0.5px; text-transform: uppercase; font-size: 7pt; }
          .cad-tb-row strong { font-size: 9pt; }
          /* (Earlier this brace closed @media print, leaking all rules below
             into the live editor. Closing brace moved to line ~5478 so every
             rule from here to .scan-location-card .loc-photo is print-only.) */
          input, select, textarea {
            border: 1px solid #98a0aa !important;
            background: white !important; color: black !important;
          }
          /* Keep a section header glued to its content — never orphan a title at
             the bottom of a page (e.g. a "Site diagram" header alone with the
             photo on the next page). */
          .ak-card-head, .ak-sec h1, .ak-sec h2, .ak-sec h3, .ak-sec h4 {
            break-after: avoid !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
          }
          /* Cap large media to one page so a tall diagram/photo can't overflow a
             page or land header-less on its own — keeps it WITH its header. */
          .ak-sec-diagram canvas, .ak-sec-diagram img,
          .scan-photo-row img, .gpr-scan-figure img,
          .scan-location-card .loc-photo img,
          .ak-annot-photo {
            max-height: 21cm !important;
            height: auto !important;
            object-fit: contain !important;
          }
          .ak-sec .approval-audit-print {
            display: block;
            margin-top: 12px; padding: 8px 11px;
            box-sizing: border-box;
            border: 1.5px solid #1a7f37 !important;
            border-radius: 5px;
            background: #eafaf0 !important;
            color: #0b3d1c !important;
            font-size: 10pt; font-weight: 700;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
            page-break-inside: avoid; break-inside: avoid;
          }
          .legal-disclaimer-print {
            page-break-inside: avoid;
            break-inside: avoid;
            font-size: 9pt;
            line-height: 1.45;
            color: #000;
            /* No own divider — the card title already draws one. Keeps spacing
               consistent with every other card (single line under the title). */
          }
          .findings-table, .cover-summary-print table {
            border: 1px solid #555;
            page-break-inside: auto;
            break-inside: auto;
          }
          .findings-table th, .findings-table td,
          .cover-summary-print th, .cover-summary-print td {
            border: 1px solid #888;
            padding: 4px 7px;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          /* Free-text fields the engineer fills in: wrap long unbroken
             tokens (URLs, ref codes) instead of forcing the page wider. */
          .methods-print, .std-notes-print, .legal-disclaimer-print,
          .workflow-status-print, .loc-print-only, .ak-ta-print,
          .proposed-cores-print {
            overflow-wrap: break-word;
            word-break: break-word;
          }
          /* Cover / equipment fields are the report's content, not controls —
             strip the editable-box chrome so they read as clean printed text. */
          .ak-shell input:not([type="checkbox"]):not([type="radio"]),
          .ak-shell select {
            border: none !important;
            background: transparent !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            color: #000 !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }
          .ak-shell input[type="date"]::-webkit-calendar-picker-indicator { display: none !important; }
          .findings-table th, .cover-summary-print th {
            background: #eee !important;
            font-size: 8pt;
            letter-spacing: 0.7px;
            text-transform: uppercase;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .findings-table tr, .cover-summary-print tr,
          .proposed-cores-print li, .methods-print, .std-notes-print,
          .workflow-status-print {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .scan-photo-row {
            page-break-inside: avoid;
            break-inside: avoid;
            display: inline-block !important;
            width: 48% !important;
            margin: 0 1% 10px !important;
            vertical-align: top;
            box-sizing: border-box;
            background: transparent !important;
            border: 1px solid #c2c6cc !important;
            border-radius: 6px !important;
            padding: 7px !important;
            cursor: default !important;
          }
          .scan-photo-row img { max-width: 100% !important; height: auto !important; }
          .photo-print img, .photo-print canvas {
            width: 100% !important; height: auto !important; max-height: 9cm;
            object-fit: contain;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .photo-print-meta { font-size: 9pt; line-height: 1.45; margin-top: 6px; color: #000; }
          .photo-print-tags { margin-bottom: 2px; }
          .photo-print-loc { font-size: 10pt; margin-right: 8px; }
          .photo-print-conf { font-size: 7.5pt; padding: 1px 6px; border-radius: 4px; letter-spacing: .5px; }
          .photo-print-scale { color: #555 !important; font-size: 8.5pt; }
          /* Lone/trailing odd photo: full-width side-by-side figure so the freed
             half carries the caption/meta instead of sitting blank. */
          .scan-photo-row--solo { width: 98% !important; }
          .scan-photo-row--solo .photo-print {
            display: flex !important; gap: 16px; align-items: flex-start;
          }
          .scan-photo-row--solo .photo-print > :first-child {
            flex: 0 0 58%; max-width: 58%;
          }
          .scan-photo-row--solo .photo-print-meta {
            flex: 1; margin-top: 0 !important; align-self: stretch;
            border-left: 2px solid #e1e4e8; padding-left: 16px;
          }

          .gpr-scan-figure {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 12px;
          }
          .gpr-scan-figure img { max-width: 100% !important; height: auto !important; }
          .gpr-panel-group {
            display: flex !important;
            gap: 8px !important;
            align-items: flex-start !important;
            flex-wrap: wrap !important;
          }
          .gpr-panel-group .gpr-panel { flex: 1 1 30% !important; min-width: 0 !important; }
          .gpr-panel-sublabel { font-weight: 700 !important; font-size: 12px !important; }
          .loc-scan-refs { page-break-inside: avoid; break-inside: avoid; }
          .loc-scan-ref { page-break-inside: avoid; break-inside: avoid; }

          .scan-location-card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1.5px solid #5b6470 !important;
            border-radius: 8px !important;
            margin-bottom: 14px;
          }
          .scan-location-card .loc-header {
            background: #c0282d !important;
            color: #fff !important;
            border-bottom: 1px solid #8a2025;
            border-radius: 7px 7px 0 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .scan-location-card .loc-body {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 0 !important;
            padding: 0 !important;
          }
          .scan-location-card .loc-left,
          .scan-location-card .loc-right {
            padding: 10px 12px !important;
            margin-top: 0 !important;
          }
          .scan-location-card .loc-left {
            border-right: 1px solid #999;
          }
          .scan-location-card .loc-controls,
          .scan-location-card .loc-photo-controls,
          .scan-location-card .loc-edit-only {
            display: none !important;
          }
          .scan-location-card .loc-print-only {
            display: block !important;
          }
          .scan-location-card .loc-photo img {
            max-width: 100% !important;
            height: auto !important;
          }
          .scan-location-card .loc-photo {
            border: 1px solid #999 !important;
            border-radius: 0 !important;
          }
        }
        .loc-print-only { display: none; }
        input::placeholder, textarea::placeholder { color: ${c.textFaint}; }
        input:focus, textarea:focus, select:focus {
          outline: none; border-color: ${c.accent};
        }
      `}</style>

      {/* === HEADER === */}
      <div className="no-print ak-header" style={{
        position: 'relative',
        marginBottom: 14,
        padding: '12px 14px 14px',
        background: c.bgRaised,
        border: `1px solid ${c.borderStrong}`,
        borderLeft: `4px solid ${c.accent}`,
        borderRadius: 8,
        textAlign: 'center',
        overflow: 'visible',
      }}>
        {/* Action buttons sit in their own row; save status pinned to the left */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span title="Your work auto-saves to this device" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
            color: c.green, background: c.greenBg,
            border: `1px solid ${c.green}`, borderRadius: 20,
            padding: '4px 9px', whiteSpace: 'nowrap',
          }}>
            ✓ {savedAt
              ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Auto-save on'}
          </span>
          {desktop && savedFileName && (
            <button onClick={revealSavedFile}
              title={`Show “${savedFileName}” in its folder`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
                color: c.textDim, background: c.cardAlt,
                border: `1px solid ${c.border}`, borderRadius: 20,
                padding: '4px 9px', whiteSpace: 'nowrap', cursor: 'pointer',
                fontFamily: 'inherit', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
              📁 Show file
            </button>
          )}
          </span>
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {report.status === 'approved' ? (
            <span title="Approved & archived — manage in Authorship & review"
              style={{
                background: c.greenBg, color: c.green, border: `1px solid ${c.green}`,
                borderRadius: 6, padding: '7px 10px',
                fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: 0.4,
              }}>✓ APPROVED</span>
          ) : (
          <button onClick={() => update({ status: report.status === 'issued' ? 'draft' : 'issued' })}
            title={report.status === 'issued'
              ? 'Issued — sent to the engineer for review (FOR REVIEW watermark). Click to revert to Draft.'
              : 'Draft — not sent yet. PDF carries a FOR REVIEW watermark until approved. Click to mark Issued.'}
            aria-label="Toggle draft / issued status"
            style={{
              background: report.status === 'issued' ? c.greenBg : c.amberBg,
              color: report.status === 'issued' ? c.green : c.amber,
              border: `1px solid ${report.status === 'issued' ? c.green : c.amber}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: 0.4,
            }}>
            {report.status === 'issued' ? '✓ ISSUED' : '● DRAFT'}
          </button>
          )}
          {SYNC_ENABLED && <SyncControl auth={auth} sync={sync} c={c} />}
          <FeedbackButton c={c} />
          {typeof window !== 'undefined' && window.akDesktop && <VersionToggle c={c} />}
          <button onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light (outdoor) mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            style={{
              background: c.cardAlt, border: `1px solid ${c.borderStrong}`,
              borderRadius: 6, padding: '7px 10px', fontSize: 15,
              color: c.text, cursor: 'pointer', fontWeight: 900,
              whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button onClick={() => update({ assistantOn: !report.assistantOn })}
            title={report.assistantOn ? 'Hide assistant' : 'Show assistant'}
            aria-label="Toggle assistant"
            style={{
              background: report.assistantOn ? c.accentDim : c.cardAlt,
              color: report.assistantOn ? '#fff' : c.textDim,
              border: `1px solid ${report.assistantOn ? c.accent : c.borderStrong}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            🤖 {report.assistantOn ? 'On' : 'Off'}
          </button>
          <button onClick={() => setReportsOpen(true)}
            title="Reports — work on multiple reports"
            aria-label="Reports library"
            style={{
              background: c.cardAlt, color: c.text,
              border: `1px solid ${c.borderStrong}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            🗂 {reportsIndex.length > 1 ? reportsIndex.length : ''}
          </button>
          <button onClick={() => setContactsOpen(true)}
            title="Customer contacts"
            aria-label="Customer contacts"
            style={{
              background: c.cardAlt, color: c.text,
              border: `1px solid ${c.borderStrong}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            👥
          </button>
          <button onClick={() => setHelpOpen(true)}
            title="Getting started — how to save and send"
            aria-label="Getting started guide"
            style={{
              background: c.cardAlt, color: c.text,
              border: `1px solid ${c.borderStrong}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            ❓
          </button>
          <button onClick={() => setConfirmReset(true)}
            title="Reset the form (with save-first prompt)"
            aria-label="Reset form"
            style={{
              background: c.cardAlt, color: c.text,
              border: `1px solid ${c.borderStrong}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            ↻
          </button>
          <label style={{
            background: c.accent, border: `1px solid ${c.accent}`,
            borderRadius: 6, padding: '7px 12px', textAlign: 'center', fontSize: 11,
            color: '#fff', cursor: 'pointer', fontWeight: 800, whiteSpace: 'nowrap',
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            📂 Load
            <input type="file" accept=".json,.akscan,application/json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
          </span>
        </div>

        {/* Logo centered as its own hero element (now carries the brand on its own) */}
        <img
          src={LOGO_SRC}
          alt="Aggarwal Kamikaze's Cutting & Coring Ltd"
          className="ak-logo no-print"
          style={{
            display: 'block',
            height: 140,
            width: 'auto',
            maxWidth: '100%',
            margin: '0 auto',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
          }}
        />
      </div>
      <style>{`
        /* Responsive shell — phone first, breathes on wider screens */
        /* Fluid: fills the window/monitor, capped so a 30"+ wide screen never
           over-stretches the forms and the report never side-scrolls. */
        .ak-shell { max-width: 720px; }
        @media (min-width: 900px)  { .ak-shell { max-width: 1180px; padding-left: 20px; padding-right: 20px; } }
        @media (min-width: 1200px) { .ak-shell { max-width: 1600px; padding-left: 28px; padding-right: 28px; } }
        @media (min-width: 1700px) { .ak-shell { max-width: 2000px; padding-left: 32px; padding-right: 32px; } }
        @media (max-width: 480px)  {
          .ak-shell { padding-left: 10px; padding-right: 10px; }
          .ak-header .ak-logo { height: 110px !important; }
        }
        /* === Responsive safety net — screen only; the printed PDF is locked
           A4 and untouched by everything below. Desktop is the primary
           surface; this just keeps phones/tablets from ever forcing a
           horizontal scroll, and lets a client read a shared report on a
           small screen. === */
        /* Below 900px the sticky side nav/rail are already display:none, so
           clamping body overflow-x here cannot break sticky positioning, and
           position:fixed elements ignore ancestor overflow entirely. */
        @media (max-width: 899px) {
          html, body { overflow-x: hidden; }
        }
        /* Media + long text inside the report can never push the page wider. */
        .ak-shell img, .ak-shell canvas, .ak-shell svg { max-width: 100%; }
        .ak-shell .findings-table, .ak-shell .cover-summary-print table { max-width: 100%; }
        .ak-shell .findings-table td, .ak-shell .findings-table th,
        .ak-shell .methods-print, .ak-shell .std-notes-print,
        .ak-shell .legal-disclaimer-print, .ak-shell .workflow-status-print,
        .ak-shell .loc-print-only, .ak-shell .ak-ta-print,
        .ak-shell .proposed-cores-print {
          overflow-wrap: break-word; word-break: break-word;
        }
        /* Client opening a SHARED report on a phone: stack the 2-up scan
           photos to full width so figures stay readable rather than squeezed
           into 48% columns. Preview-mode + narrow screens only. */
        @media (max-width: 600px) {
          body.preview-mode .ak-shell .scan-photo-row,
          body.preview-mode .ak-shell .scan-photo-row--solo {
            display: block !important; width: 100% !important;
            margin: 0 0 12px !important;
          }
          body.preview-mode .ak-shell .scan-photo-row--solo .photo-print {
            display: block !important;
          }
          body.preview-mode .ak-shell .scan-photo-row--solo .photo-print > :first-child {
            max-width: 100% !important;
          }
          body.preview-mode .ak-shell .scan-photo-row--solo .photo-print-meta {
            border-left: 0 !important; padding-left: 0 !important; margin-top: 8px !important;
          }
        }
        @media print {
          .ak-shell { max-width: none !important; padding: 0 !important; }
        }
      `}</style>

      {/* === SETUP CARDS COLLAPSIBLE ===
          Tier / Sections / Print setup are setup, not data. Collapsing them
          by default puts Project info closer to the top so the engineer can
          start typing without scrolling past five config cards every report. */}
      <div className="no-print" style={{ marginBottom: 12 }}>
        <button
          onClick={() => setSetupCollapsed(s => !s)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: c.cardAlt, border: `1px solid ${c.borderStrong}`,
            borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
            color: c.text, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>
          <span>⚙ Setup — tier · sections · print order</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: c.textFaint, fontWeight: 500 }}>
            {!setupCollapsed && <span>tap to hide</span>}
            <span style={{ fontSize: 14 }}>{setupCollapsed ? '▾' : '▴'}</span>
          </span>
        </button>
        {setupCollapsed && (
          <div style={{ fontSize: 10.5, color: c.textFaint, marginTop: 5, padding: '0 4px', lineHeight: 1.4 }}>
            Tier: <strong style={{ color: c.textDim, textTransform: 'capitalize' }}>{tier}</strong>
            {' · '}
            Sections: <strong style={{ color: c.textDim }}>
              {effectiveOrder.filter(id => vis(id)).length}/{SECTION_IDS.length}
            </strong> on
          </div>
        )}
        {/* Quick-access strip: Preview shortcut + (dev only) demo loader.
            Without these, hitting Preview means scrolling into the Print
            setup card every time — slow loop when debugging PDF styling. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <Btn variant="primary" onClick={() => setPreviewMode(true)}
            style={{ flex: 1, fontSize: 11, padding: '6px 8px' }}>
            👁 Preview saved PDF
          </Btn>
          {import.meta.env.DEV && (
            <Btn variant="ghost" onClick={loadDemoReport}
              title="DEV ONLY — fill the current report with realistic sample data"
              style={{ fontSize: 11, padding: '6px 10px' }}>
              🧪 Demo
            </Btn>
          )}
        </div>
      </div>
      {!setupCollapsed && (<>

      {/* === TIER PICKER === */}
      <Card title="Report tier" dense className="no-print">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            { id: 'quick', label: 'Quick Mark', sub: 'Field 1-pg' },
            { id: 'standard', label: 'Standard', sub: 'Engineer review' },
            { id: 'full', label: 'Full', sub: 'Regulatory' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                const presets = {
                  quick:    { enableZones: false, enableCadPage: false, enableStandardNotes: false, enableNamedZones: false },
                  standard: { enableZones: false, enableCadPage: false, enableStandardNotes: true,  enableNamedZones: false },
                  full:     { enableZones: true,  enableCadPage: true,  enableStandardNotes: true,  enableNamedZones: true  },
                };
                update({ tier: t.id, ...presets[t.id] });
              }}
              style={{
                background: tier === t.id ? c.accentDim : c.cardAlt,
                border: `1px solid ${tier === t.id ? c.accent : c.border}`,
                borderRadius: 6, padding: '8px 4px', cursor: 'pointer',
                color: tier === t.id ? c.onAccentDim : c.text,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: tier === t.id ? c.onAccentDim : c.textDim, marginTop: 2 }}>{t.sub}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* === REPORT SECTIONS (Xradar-style togglable features) === */}
      <Card title="Report sections" dense className="no-print">
        <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
          Switch each Xradar-style feature on or off independently. Tier sets sensible
          defaults; you can override per report.
        </div>
        {[
          { id: 'enableStandardNotes', label: 'Standard notes column',     hint: 'Numbered general-notes block printed with the report.' },
          { id: 'enableNamedZones',    label: 'Named zones',                hint: 'Group scan locations under zones like "Back of House".' },
          { id: 'enableZones',         label: 'Hatched zones on diagram',   hint: 'Red / yellow / amber fill areas marking unsuitable, caution, or boundary regions on the site diagram.' },
          { id: 'enableCadPage',       label: 'CAD-style drawing page',     hint: 'Engineered drawing page with letterhead, drawing, notes, and title block.' },
          { id: 'enableColorLegend',   label: 'Markup color key',           hint: 'Prints an APWA-aligned legend explaining what each annotation color means (rebar, PT cable, conduit, water, proposed core).' },
          { id: 'enableConfidenceBand', label: 'Overall confidence band',   hint: 'Adds a rolled-up confidence rating (the lowest per-core confidence governs) to the executive summary.' },
          { id: 'brandFlourishes',     label: 'Brand flourishes',           hint: 'Adds a subtle Aggarwal Kamikaze\'s ribbon at the top of the printed report and a small "signed by the crew" line at the bottom. Off by default so reviewers see a clean professional document.' },
        ].map(f => (
          <label key={f.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 9,
            padding: '7px 8px', marginBottom: 4,
            background: report[f.id] ? c.accentDim : c.cardAlt,
            border: `1px solid ${report[f.id] ? c.accent : c.border}`,
            borderRadius: 6, cursor: 'pointer',
          }}>
            <input type="checkbox"
              checked={!!report[f.id]}
              onChange={e => update({ [f.id]: e.target.checked })}
              style={{ marginTop: 2, flexShrink: 0, accentColor: c.accent }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: report[f.id] ? c.onAccentDim : c.text,
              }}>{f.label}</div>
              <div style={{
                fontSize: 11, lineHeight: 1.4, marginTop: 1,
                color: report[f.id] ? c.onAccentDim : c.textFaint,
                opacity: report[f.id] ? 0.85 : 1,
              }}>{f.hint}</div>
            </div>
          </label>
        ))}
      </Card>

      {/* === PRINT SETUP (per-section include/exclude + preview) === */}
      <Card title="Print setup · sections, order & visibility" dense className="no-print">
        <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
          Tick which sections appear in the PDF, and drag any row (or use ▲▼) to set
          print order. Preview shows exactly what will print before you save.
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 9, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={() => setAllVis(true)}
            style={{ flex: 1, fontSize: 11 }}>✓ Select all</Btn>
          <Btn variant="ghost" onClick={() => setAllVis(false)}
            style={{ flex: 1, fontSize: 11 }}>✕ Clear all</Btn>
          <Btn variant="ghost" onClick={() => update({ sectionOrder: [] })}
            title="Restore the default section order"
            style={{ flex: 1, fontSize: 11 }}>↕ Reset order</Btn>
          <Btn variant="primary" onClick={() => setPreviewMode(true)}
            style={{ flex: 1.4, fontSize: 11 }}>👁 Preview</Btn>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          maxHeight: 320, overflowY: 'auto',
          border: `1px solid ${c.border}`, borderRadius: 6, padding: 6,
        }}>
          {effectiveOrder.map((id, idx) => {
            const s = SECTION_IDS.find(x => x.id === id);
            if (!s) return null;
            const on = vis(id);
            const isBeingDragged = dragSectionId === id;
            const isDropTarget   = dropTargetId?.id === id;
            return (
              <div key={id}
                draggable
                onDragStart={(e) => {
                  setDragSectionId(id);
                  e.dataTransfer.effectAllowed = 'move';
                  // Setting data is required for Firefox to enable dragging.
                  e.dataTransfer.setData('text/plain', id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!dragSectionId || dragSectionId === id) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const side = (e.clientY - r.top) < r.height / 2 ? 'above' : 'below';
                  setDropTargetId({ id, side });
                }}
                onDragLeave={(e) => {
                  // Only clear if we're really leaving (not into a child)
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDropTargetId(prev => prev?.id === id ? null : prev);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSectionId && dropTargetId) {
                    reorderTo(dragSectionId, dropTargetId.id, dropTargetId.side);
                  }
                  setDragSectionId(null);
                  setDropTargetId(null);
                }}
                onDragEnd={() => { setDragSectionId(null); setDropTargetId(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 6px', borderRadius: 4,
                  background: on ? c.cardAlt : 'transparent',
                  fontSize: 11, color: on ? c.text : c.textFaint,
                  opacity: isBeingDragged ? 0.4 : 1,
                  boxShadow: isDropTarget
                    ? (dropTargetId.side === 'above'
                        ? `inset 0 2px 0 0 ${c.accent}`
                        : `inset 0 -2px 0 0 ${c.accent}`)
                    : 'none',
                  cursor: 'grab',
                  transition: 'opacity 0.12s',
                }}>
                <span style={{
                  color: c.textFaint, fontSize: 13, lineHeight: 1, userSelect: 'none',
                  cursor: 'grab', flexShrink: 0, padding: '0 2px',
                }}
                  title="Drag to reorder">⋮⋮</span>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
                  cursor: 'pointer', textDecoration: on ? 'none' : 'line-through',
                }}>
                  <input type="checkbox" checked={on}
                    onChange={e => setVis(id, e.target.checked)}
                    style={{ accentColor: c.accent, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                </label>
                <button onClick={() => moveSection(id, -1)} disabled={idx === 0}
                  title="Move up" aria-label="Move section up" style={{
                    background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 4,
                    color: c.text, fontSize: 11, padding: '2px 6px', cursor: 'pointer',
                    opacity: idx === 0 ? 0.3 : 1, flexShrink: 0,
                  }}>▲</button>
                <button onClick={() => moveSection(id, 1)} disabled={idx === effectiveOrder.length - 1}
                  title="Move down" aria-label="Move section down" style={{
                    background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 4,
                    color: c.text, fontSize: 11, padding: '2px 6px', cursor: 'pointer',
                    opacity: idx === effectiveOrder.length - 1 ? 0.3 : 1, flexShrink: 0,
                  }}>▼</button>
              </div>
            );
          })}
        </div>
      </Card>

      </>)}{/* === END SETUP COLLAPSIBLE === */}

      {/* Per-section print order, driven by report.sectionOrder */}
      <style>{
        effectiveOrder.map((id, i) => `.ak-sec-${id}{order:${i};}`).join('')
      }</style>

      {/* === REPORT BODY (flex column; section order set via CSS) === */}
      <div className="ws-grid">
      {/* LEFT: jump-nav — scrolls via existing .ak-sec-<id> classes. Screen only. */}
      <nav className="ws-nav no-print" aria-label="Report sections">
        <div className="sep sep-row">
          <span>Report · {effectiveOrder.filter(id => vis(id)).length}/{SECTION_IDS.length}</span>
          <button type="button" className="nav-reset"
            title="Reset to the default order and show every section"
            onClick={() => update({ sectionOrder: [], sectionVisibility: {} })}>Reset</button>
        </div>
        {effectiveOrder.map((id, idx) => {
          const s = SECTION_IDS.find(x => x.id === id);
          if (!s) return null;
          const L = { workflowStatus: 'Workflow', summary: 'Summary', cover: 'Project', slab: 'Slab', targets: 'Targets', findings: 'Findings', coverSummary: 'Cover depths', diagram: 'Diagram', drawingNotes: 'Drawing notes', scanPhotos: 'Photos', zones: 'Zones', locations: 'Scan locations', proposedCores: 'Proposed cores', gprScans: 'GPR scans', cores: 'Core verdicts', uncertainty: 'Uncertainty', equipment: 'Equipment', methods: 'Methods', limitations: 'Limitations', standardNotes: 'Std notes', cadPage: 'CAD page', disclaimer: 'Disclaimer', signoff: 'Sign-off' };
          const on = vis(id);
          const isDragged = dragSectionId === id;
          const isTarget = dropTargetId?.id === id;
          return (
            <div key={id} className="nav-row" draggable
              onDragStart={(e) => { setDragSectionId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragSectionId || dragSectionId === id) return;
                const r = e.currentTarget.getBoundingClientRect();
                const side = (e.clientY - r.top) < r.height / 2 ? 'above' : 'below';
                setDropTargetId({ id, side });
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetId(prev => prev?.id === id ? null : prev); }}
              onDrop={(e) => { e.preventDefault(); if (dragSectionId && dropTargetId) reorderTo(dragSectionId, dropTargetId.id, dropTargetId.side); setDragSectionId(null); setDropTargetId(null); }}
              onDragEnd={() => { setDragSectionId(null); setDropTargetId(null); }}
              style={{
                opacity: isDragged ? 0.4 : 1,
                boxShadow: isTarget ? (dropTargetId.side === 'above' ? `inset 0 2px 0 0 ${c.accent}` : `inset 0 -2px 0 0 ${c.accent}`) : 'none',
              }}>
              <span className="nav-grip" title="Drag to reorder">⋮⋮</span>
              <input type="checkbox" checked={on} onChange={e => setVis(id, e.target.checked)}
                title={on ? 'In the report — uncheck to leave it out' : 'Left out — check to add it'} />
              <button type="button" className="nav-name"
                style={{ textDecoration: on ? 'none' : 'line-through', opacity: on ? 1 : 0.5 }}
                title={`Jump to ${s.label}`}
                onClick={() => { const el = document.querySelector('.ak-sec-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                {L[id] || s.label}
              </button>
              <span className="nav-arrows">
                <button onClick={() => moveSection(id, -1)} disabled={idx === 0} title="Move up" aria-label="Move section up">▲</button>
                <button onClick={() => moveSection(id, 1)} disabled={idx === effectiveOrder.length - 1} title="Move down" aria-label="Move section down">▼</button>
              </span>
            </div>
          );
        })}
      </nav>
      <div className="report-body ws-main">
        {/* === DRAFT watermark — print/preview only, while status !== 'issued' === */}
        {report.showWatermark !== false && report.status !== 'approved' && (
          <div className="draft-watermark" aria-hidden="true">
            <svg viewBox="0 0 1000 1300" preserveAspectRatio="xMidYMid meet">
              <text x="500" y="700" textAnchor="middle"
                transform="rotate(-30 500 660)"
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize="150" fontWeight="800" letterSpacing="14"
                fill="#9ca3af" fillOpacity="0.18">FOR REVIEW</text>
            </svg>
          </div>
        )}

      {/* === SAME-DAY WORKFLOW STATUS === */}
      <Card title="Workflow status" dense className={ph('workflowStatus')}>
        <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
          Track the same-day cycle: when scanning finished, when this report was issued,
          and when the area was cleared for coring. Prints as a small status block at the
          top of the report when any timestamp is set.
        </div>
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { id: 'scanComplete',      label: 'Scan complete' },
            { id: 'reportIssued',      label: 'Report issued' },
            { id: 'clearedForCoring',  label: 'Cleared for coring' },
          ].map(f => (
            <Field key={f.id} label={f.label}>
              <Input type="datetime-local"
                value={(report.workflow || {})[f.id] || ''}
                onChange={e => update({
                  workflow: { ...(report.workflow || {}), [f.id]: e.target.value },
                })}
                style={{ fontSize: 12 }} />
            </Field>
          ))}
        </div>
        {(report.workflow?.scanComplete || report.workflow?.reportIssued || report.workflow?.clearedForCoring) && (
          <div className="print-only workflow-status-print" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
            border: '1px solid #888', padding: '8px 10px', marginTop: 4,
            fontSize: '9pt', color: '#000',
            width: '100%', boxSizing: 'border-box',
          }}>
            {[
              { id: 'scanComplete',      label: 'SCAN COMPLETE' },
              { id: 'reportIssued',      label: 'REPORT ISSUED' },
              { id: 'clearedForCoring',  label: 'CLEARED FOR CORING' },
            ].map(f => {
              const v = (report.workflow || {})[f.id];
              const fmt = v ? new Date(v).toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }) : '—';
              return (
                <div key={f.id}>
                  <div style={{ fontSize: '7.5pt', letterSpacing: 1, color: '#666' }}>{f.label}</div>
                  <div style={{ fontWeight: 700, fontSize: '10pt' }}>{fmt}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* === BRANDED LETTERHEAD (print/preview only) — PERMANENT STAPLE ===
           v1.0.15 facelift: the finalized Caveat two-tone wordmark from the
           pdf-mockups, ported onto the full v1 report. Always renders once at
           the top (page 1) to promote the company — decoupled from
           brandFlourishes (which now gates only the optional footer signature).
           Border-rule under it, project/operator/date meta box right. */}
      {(
        <div className="ak-lh">
          <img src={LOGO_SRC} alt="" className="ak-lh-logo" />
          <div className="ak-lh-co">
            <div className="ak-lh-nm1">Aggarwal Kamikaze's</div>
            <div className="ak-lh-nm2">Cutting &amp; Coring Ltd.</div>
            <div className="ak-lh-sub">GPR Concrete Scanning · Core Clearance Report</div>
            <div className="ak-lh-addr">123 Industrial Way, Burnaby BC V5A 1A1 · (604) 555-0199 · scans@aggarwalkamikazes.ca</div>
          </div>
          <div className="ak-lh-box">
            <b>Project</b><div className="v">{report.projectNo || '—'}</div>
            <b>Operator</b><div className="v">{report.preparedBy || '—'}</div>
            <b>Date</b><div className="v">{report.scanDate || '—'}</div>
          </div>
        </div>
      )}

      {/* === EXECUTIVE SUMMARY (always at top) === */}
      <div className={ph('summary')}>
        <ExecutiveSummary report={report} />
      </div>

      {/* === COVER === */}
      <Card title="Project info" className={ph('cover')}>
        <Field label="Project number">
          <Input value={report.projectNo} onChange={e => update({ projectNo: e.target.value })} placeholder="VAN-2026-0341" />
        </Field>
        <Field label="Job description"
          hint="A short note to recognize this job later — also used to name saved files.">
          <Input value={report.jobNote} onChange={e => update({ jobNote: e.target.value })}
            placeholder="P2 parkade north wall" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Scan date">
            <Input type="date" value={report.scanDate} onChange={e => update({ scanDate: e.target.value })} />
          </Field>
          <Field label="Weather">
            <Input value={report.weather} onChange={e => update({ weather: e.target.value })} placeholder="15°C overcast" />
          </Field>
        </div>
        <Field label="Client">
          <Input value={report.client} onChange={e => update({ client: e.target.value })}
            list="ak-client-suggestions" placeholder="Client name" />
          <datalist id="ak-client-suggestions">
            {[...new Set([
              ...contacts.map(ct => ct.company).filter(Boolean),
              ...contacts.map(ct => ct.name).filter(Boolean),
              ...(recents.recentClients || []),
            ])].map((v, k) => <option key={k} value={v} />)}
          </datalist>
        </Field>
        <Field label="Site address">
          <Input value={report.siteAddress} onChange={e => update({ siteAddress: e.target.value })}
            list="ak-site-suggestions" placeholder="1055 W Georgia, Vancouver BC" />
          <datalist id="ak-site-suggestions">
            {(recents.recentSites || []).map((v, k) => <option key={k} value={v} />)}
          </datalist>
        </Field>
        <Field label="Scan area / description">
          <Input value={report.scanArea} onChange={e => update({ scanArea: e.target.value })} placeholder="P2 parkade slab, grid C4" />
        </Field>
      </Card>

      {/* === SLAB CONTEXT === */}
      <Card title="Slab context" className={ph('slab')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Slab thickness">
            <Input value={report.slabThickness} onChange={e => update({ slabThickness: e.target.value })} placeholder="200 mm" />
          </Field>
          <Field label="Cure status">
            <Select value={report.slabAge} onChange={e => update({ slabAge: e.target.value })}>
              <option value="">— select —</option>
              <option>{'>30 days cured'}</option>
              <option>7–30 days</option>
              <option>{'<7 days (green)'}</option>
              <option>Existing / unknown age</option>
            </Select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Surface">
            <Select value={report.surface} onChange={e => update({ surface: e.target.value })}>
              <option>Dry</option>
              <option>Damp</option>
              <option>Wet</option>
              <option>Painted / sealed</option>
            </Select>
          </Field>
          <Field label="Scan coverage">
            <Select value={report.scanCoverage} onChange={e => update({ scanCoverage: e.target.value })}>
              <option>100% (full grid)</option>
              <option>Spot scans only</option>
              <option>Linear transects</option>
              <option>Limited (access restricted)</option>
            </Select>
          </Field>
        </div>
        <Field label="Recommended core standoff" hint="Min clearance to keep off any marked target. Prints on the summary. Clear to hide.">
          <Input value={report.coreStandoff} onChange={e => update({ coreStandoff: e.target.value })} placeholder="25 mm" />
        </Field>
      </Card>

      {/* === FINDINGS === */}
      <Card title="Targets identified" className={`${ph('targets')} no-print`} badge={
        <span style={{
          background: c.cardAlt, color: c.textDim, fontSize: 11,
          padding: '2px 8px', borderRadius: 4, fontWeight: 500,
        }}>{report.targets.length}</span>
      }>
        {CONFIDENCE_ORDER.map(level => {
          const meta = CONFIDENCE_META[level];
          const items = report.targets
            .map((t, i) => ({ t, i }))
            .filter(({ t }) => (t.confidence || 'high') === level);
          if (items.length === 0) return null;
          return (
            <div key={level} style={{ marginBottom: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 9px', marginBottom: 7,
                background: meta.bg, borderLeft: `3px solid ${meta.color}`,
                borderRadius: '0 4px 4px 0',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                  color: meta.color, textTransform: 'uppercase',
                }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: c.textDim }}>
                  · {items.length} target{items.length === 1 ? '' : 's'}
                </span>
              </div>

              {items.map(({ t, i }) => (
                <div key={i} style={{
                  border: `1px solid ${c.border}`, borderRadius: 6,
                  padding: 9, marginBottom: 7,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, gap: 6 }}>
                    <span className={`ak-conf-badge ak-conf-${level}`} style={{
                      background: meta.bg, padding: '2px 7px', borderRadius: 4,
                      fontSize: 11, fontWeight: 700, color: meta.color,
                      border: `1px solid ${meta.color}`, minWidth: 38, textAlign: 'center',
                    }}>{t.id}</span>
                    <Select value={t.type} onChange={e => updateTarget(i, { type: e.target.value })}
                      style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}>
                      <option>Rebar (top mat)</option>
                      <option>Rebar (bottom mat)</option>
                      <option>PT cable</option>
                      <option>Conduit (metallic)</option>
                      <option>Conduit (non-metallic)</option>
                      <option>Void</option>
                      <option>Pan decking</option>
                      <option>Unknown anomaly</option>
                    </Select>
                    <span className="no-print" style={{ display: 'contents' }}>
                    <Btn variant="ghost" onClick={() => moveTarget(i, -1)} disabled={i === 0}
                      title="Move up" style={{ padding: '4px 7px', fontSize: 12, opacity: i === 0 ? 0.35 : 1 }}>▲</Btn>
                    <Btn variant="ghost" onClick={() => moveTarget(i, 1)} disabled={i === report.targets.length - 1}
                      title="Move down" style={{ padding: '4px 7px', fontSize: 12, opacity: i === report.targets.length - 1 ? 0.35 : 1 }}>▼</Btn>
                    <Btn variant="ghost" onClick={() => removeTarget(i)} style={{ padding: '4px 9px', fontSize: 12 }}>✕</Btn>
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
                    <Input placeholder="Depth (mm)" value={t.depth}
                      onChange={e => updateTarget(i, { depth: e.target.value })}
                      style={{ padding: '6px 9px', fontSize: 13 }} />
                    <Input placeholder="Cover (mm)" value={t.cover}
                      onChange={e => updateTarget(i, { cover: e.target.value })}
                      style={{ padding: '6px 9px', fontSize: 13 }} />
                  </div>
                  <Input placeholder="Note: size, spacing, observation"
                    value={t.note}
                    onChange={e => updateTarget(i, { note: e.target.value })}
                    style={{ padding: '6px 9px', fontSize: 13, marginBottom: 5 }} />
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[
                      { id: 'high', label: 'High', color: c.green, bg: c.greenBg },
                      { id: 'med',  label: 'Med',  color: c.amber, bg: c.amberBg },
                      { id: 'low',  label: 'Low',  color: c.red,   bg: c.redBg },
                    ].map(opt => (
                      <button key={opt.id}
                        className={`ak-conf ${t.confidence === opt.id ? `ak-conf-on ak-conf-${opt.id}` : 'ak-conf-off'}`}
                        onClick={() => updateTarget(i, { confidence: opt.id })}
                        style={{
                          flex: 1,
                          background: t.confidence === opt.id ? opt.bg : c.cardAlt,
                          color: t.confidence === opt.id ? opt.color : c.textDim,
                          border: `1px solid ${t.confidence === opt.id ? opt.color : c.border}`,
                          borderRadius: 4, padding: '4px 6px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}>{opt.label} conf.</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {report.targets.length === 0 && (
          <div style={{
            padding: '14px', textAlign: 'center', fontSize: 12,
            color: c.textFaint, background: c.cardAlt, borderRadius: 6, marginBottom: 7,
          }}>
            No targets yet.
          </div>
        )}
        <Btn onClick={addTarget} style={{ width: '100%' }}>+ Add target</Btn>
      </Card>

      {/* === FINDINGS SCHEDULE (print-only structured table) === */}
      {report.targets.length > 0 && (
        <Card title="Findings schedule" className={ph('findings')}>
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 4, lineHeight: 1.5 }}>
            Prints as a formal tabular schedule (engineering deliverable format). Edit individual targets above.
          </div>
          <table className="print-only findings-table" style={{
            width: '100%', borderCollapse: 'collapse', fontSize: '9pt', color: '#000', marginTop: 4,
          }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Depth</th>
                <th>Cover</th>
                <th>Conf.</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {report.targets.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.id}</strong></td>
                  <td>{t.type}</td>
                  <td>{t.depth || '—'}</td>
                  <td>{t.cover || '—'}</td>
                  <td>{(t.confidence || 'high').toUpperCase()}</td>
                  <td>{t.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* === COVER-THICKNESS SUMMARY === */}
      <Card title="Cover thickness summary" className={ph('coverSummary')}>
        <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
          Single-block summary of cover (concrete over rebar) for the top and bottom mats.
          Auto-fill from your Targets list, or override manually.
        </div>
        <label className="no-print" style={{
          display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, marginBottom: 8,
          color: c.text,
        }}>
          <input type="checkbox"
            checked={!!(report.coverSummary?.autoFromTargets)}
            onChange={e => update({
              coverSummary: { ...(report.coverSummary || {}), autoFromTargets: e.target.checked },
            })}
            style={{ accentColor: c.accent }} />
          Auto-compute min / avg from Targets where type matches "rebar (top mat)" / "rebar (bot mat)"
        </label>
        {(() => {
          const cs = report.coverSummary || {};
          // Auto-compute from targets when enabled
          let topMin = cs.topMin, topAvg = cs.topAvg;
          let botMin = cs.botMin, botAvg = cs.botAvg;
          if (cs.autoFromTargets) {
            const numericCover = (t) => {
              const m = String(t.cover || '').match(/[\d.]+/);
              return m ? parseFloat(m[0]) : null;
            };
            const tops = report.targets.filter(t => /top/i.test(t.type) && numericCover(t) != null);
            const bots = report.targets.filter(t => /bot/i.test(t.type) && numericCover(t) != null);
            const stats = (arr) => {
              const vals = arr.map(numericCover);
              if (!vals.length) return { min: '', avg: '' };
              const min = Math.min(...vals);
              const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
              return {
                min: `${min.toFixed(0)} mm`,
                avg: `${avg.toFixed(0)} mm`,
              };
            };
            const t = stats(tops), b = stats(bots);
            topMin = t.min; topAvg = t.avg;
            botMin = b.min; botAvg = b.avg;
          }
          const set = (k, v) => update({ coverSummary: { ...(report.coverSummary || {}), [k]: v } });
          const ro = !!cs.autoFromTargets;
          return (
            <>
              <div className="no-print">
              <div style={{ fontSize: 10.5, color: c.textDim, textTransform: 'uppercase',
                letterSpacing: 0.6, fontWeight: 700, marginBottom: 4 }}>Top mat</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                <Field label="Min cover"><Input value={topMin || ''} readOnly={ro}
                  onChange={e => set('topMin', e.target.value)} placeholder="e.g. 28 mm" /></Field>
                <Field label="Avg cover"><Input value={topAvg || ''} readOnly={ro}
                  onChange={e => set('topAvg', e.target.value)} placeholder="e.g. 36 mm" /></Field>
                <Field label="Target cover"><Input value={cs.topTarget || ''}
                  onChange={e => set('topTarget', e.target.value)} placeholder="e.g. 40 mm" /></Field>
              </div>
              <div style={{ fontSize: 10.5, color: c.textDim, textTransform: 'uppercase',
                letterSpacing: 0.6, fontWeight: 700, marginBottom: 4 }}>Bottom mat</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                <Field label="Min cover"><Input value={botMin || ''} readOnly={ro}
                  onChange={e => set('botMin', e.target.value)} placeholder="e.g. 22 mm" /></Field>
                <Field label="Avg cover"><Input value={botAvg || ''} readOnly={ro}
                  onChange={e => set('botAvg', e.target.value)} placeholder="e.g. 30 mm" /></Field>
                <Field label="Target cover"><Input value={cs.botTarget || ''}
                  onChange={e => set('botTarget', e.target.value)} placeholder="e.g. 40 mm" /></Field>
              </div>
              </div>
              <Field label="Notes (overall cover commentary)" className="no-print">
                <Textarea value={cs.note || ''} onChange={e => set('note', e.target.value)}
                  style={{ minHeight: 56 }} />
              </Field>

              {/* Print summary block */}
              <div className="print-only cover-summary-print" style={{ marginTop: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', color: '#000' }}>
                  <thead>
                    <tr>
                      <th>Mat</th><th>Min cover</th><th>Avg cover</th><th>Target cover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const hasTop = !!(topMin || topAvg || cs.topTarget);
                      const hasBot = !!(botMin || botAvg || cs.botTarget);
                      // Show only the mat(s) with data; if the whole section is
                      // blank, keep both rows so the table structure is intact.
                      const showTop = hasTop || !hasBot;
                      const showBot = hasBot || !hasTop;
                      return (
                        <>
                          {showTop && (
                            <tr>
                              <td>Top</td><td>{topMin || '—'}</td><td>{topAvg || '—'}</td><td>{cs.topTarget || '—'}</td>
                            </tr>
                          )}
                          {showBot && (
                            <tr>
                              <td>Bottom</td><td>{botMin || '—'}</td><td>{botAvg || '—'}</td><td>{cs.botTarget || '—'}</td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
                {cs.note && (
                  <div style={{ marginTop: 6, fontSize: '9pt', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {cs.note}
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </Card>

      {/* === SITE DIAGRAM === (hidden in print/preview when there's no diagram
          content, so an unused sketch pad never prints an empty box) */}
      <div className={`${ph('diagram')}${
        (report.diagramImage || report.diagramImageUrl ||
         (report.diagramStrokes || []).length || (report.diagramPins || []).length ||
         (report.diagramZones || []).length) ? '' : ' no-print'}`}>
        <SiteDiagram report={report} update={update} />
      </div>

      {/* === DRAWING NOTES (CAD page) === */}
      {report.enableCadPage && (
        <Card title="Drawing notes (CAD page)" className={`${ph('drawingNotes')} no-print`}>
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
            Project-specific notes that print in the notes columns of the CAD
            drawing page. Use one paragraph per zone or finding.
          </div>
          <Field label="Notes">
            <AutoGrowTextarea
              value={report.diagramNotes || ''}
              onChange={e => update({ diagramNotes: e.target.value })}
              style={{ minHeight: 140 }}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Drawing scale">
              <Input value={report.drawingScale || ''}
                onChange={e => update({ drawingScale: e.target.value })}
                placeholder="e.g. 1 : 50 or NTS" />
            </Field>
            <Field label="Drawing no.">
              <Input value={report.drawingNo || ''}
                onChange={e => update({ drawingNo: e.target.value })}
                placeholder={`${report.projectNo || 'PROJ'}-D01`} />
            </Field>
          </div>
        </Card>
      )}

      {/* === MARKUP COLOR KEY (APWA-aligned) === */}
      {report.enableColorLegend && (
        <Card title="Markup color key" dense className="ak-sec ak-sec-colorLegend">
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 8, lineHeight: 1.5 }}>
            Defaults to the APWA Uniform Color Code plus concrete-scanning convention.
            Click a swatch to recolor it or edit a label to match a region or client
            standard — this prints as the report's legend.
          </div>
          {/* Editor controls */}
          <div className="no-print" style={{ display: 'grid', gap: 6 }}>
            {legend.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={item.color}
                  onChange={e => updateLegend(i, { color: e.target.value })}
                  title="Pick a color"
                  style={{ width: 30, height: 30, padding: 0, border: `1px solid ${c.border}`,
                    borderRadius: 5, background: 'none', cursor: 'pointer', flexShrink: 0 }} />
                <Input value={item.label} onChange={e => updateLegend(i, { label: e.target.value })}
                  placeholder="What this color means" style={{ flex: 1, fontSize: 12 }} />
                <Btn variant="ghost" onClick={() => removeLegend(i)}
                  title="Remove" style={{ padding: '4px 9px', fontSize: 12 }}>✕</Btn>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <Btn onClick={addLegend} style={{ flex: 1 }}>+ Add color</Btn>
              <Btn variant="ghost" onClick={resetLegend} title="Restore the APWA default key">↺ Reset</Btn>
            </div>
          </div>
          {/* Print legend */}
          <div className="print-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
            {legend.filter(it => (it.label || '').trim()).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#000' }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                  background: item.color, border: '1px solid rgba(128,128,128,0.4)',
                  WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                }} />
                {item.label}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* === SCAN PHOTOS === */}
      <div className={ph('scanPhotos')}>
        <ScanPhotos report={report} update={update} />
      </div>

      {/* === ZONES (named area groupings) === */}
      {report.enableNamedZones && (
        <Card title="Zones" className={`${ph('zones')} no-print`}>
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
            Group scan locations under named areas (e.g. "Back of House", "Zone 4 — north corridor").
            Each location can be assigned a zone in its card.
          </div>
          {(report.zones || []).map((z, i) => (
            <div key={z.id} style={{
              border: `1px solid ${c.border}`, borderRadius: 6,
              padding: 9, marginBottom: 7, background: c.cardAlt,
            }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                <Input value={z.label}
                  onChange={e => update({
                    zones: report.zones.map(zz => zz.id === z.id ? { ...zz, label: e.target.value } : zz),
                  })}
                  placeholder="Zone name (e.g. Back of House)"
                  style={{ fontSize: 13, fontWeight: 600 }} />
                <Btn variant="ghost"
                  onClick={() => {
                    if (i === 0) return;
                    const next = [...report.zones];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    update({ zones: next });
                  }}
                  disabled={i === 0}
                  style={{ padding: '6px 9px', fontSize: 11 }}>↑</Btn>
                <Btn variant="ghost"
                  onClick={() => {
                    if (i === report.zones.length - 1) return;
                    const next = [...report.zones];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    update({ zones: next });
                  }}
                  disabled={i === report.zones.length - 1}
                  style={{ padding: '6px 9px', fontSize: 11 }}>↓</Btn>
                <Btn variant="danger"
                  onClick={() => {
                    if (!confirm(`Remove zone "${z.label}"? Locations assigned to it will become Unzoned.`)) return;
                    update({
                      zones: report.zones.filter(zz => zz.id !== z.id),
                      scanLocations: report.scanLocations.map(l =>
                        l.zoneId === z.id ? { ...l, zoneId: null } : l
                      ),
                    });
                  }}
                  style={{ padding: '6px 9px', fontSize: 11 }}>✕</Btn>
              </div>
              <Textarea value={z.notes || ''}
                onChange={e => update({
                  zones: report.zones.map(zz => zz.id === z.id ? { ...zz, notes: e.target.value } : zz),
                })}
                placeholder="Zone-level notes (overall conditions, scope, hazards…)"
                style={{ minHeight: 56, fontSize: 12 }} />
              <div style={{ fontSize: 10.5, color: c.textFaint, marginTop: 4 }}>
                {report.scanLocations.filter(l => l.zoneId === z.id).length} location(s) assigned
              </div>
            </div>
          ))}
          <Btn onClick={() => {
            const id = `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            update({ zones: [...(report.zones || []), { id, label: `Zone ${(report.zones || []).length + 1}`, notes: '' }] });
          }} style={{ width: '100%' }}>+ Add zone</Btn>
        </Card>
      )}

      {/* === SCAN LOCATIONS (per-location cards · prints side-by-side) === */}
      <div className={ph('locations')}>
        <ScanLocations report={report} update={update} />
      </div>

      {/* === PROPOSED CORE SCHEDULE (print-only) === */}
      {report.scanLocations.length > 0 && (
        <Card title="Proposed core schedule" className={ph('proposedCores')}>
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 4, lineHeight: 1.5 }}>
            Prints as a numbered schedule pulling label + verdict + instruction from each
            Scan Location. Useful for engineer sign-off and the coring crew's day-of checklist.
          </div>
          <div className="print-only proposed-cores-print" style={{ marginTop: 6 }}>
            <ol style={{ margin: 0, paddingLeft: 22, fontSize: '10pt', lineHeight: 1.5, color: '#000' }}>
              {report.scanLocations.map(loc => {
                const verdictLabel = {
                  safe: '✓ Safe to drill',
                  caution: '⚠ Caution',
                  nogo: '✕ Do not drill',
                }[loc.verdict] || loc.verdict;
                const spec = [loc.coreCount, loc.coreSize, loc.overCut && `over-cut ${loc.overCut}`]
                  .filter(Boolean).join(' · ');
                return (
                  <li key={loc.id} style={{ marginBottom: 5 }}>
                    <strong>{loc.label || '—'}</strong>
                    {spec && <> · {spec}</>}
                    {' · '}<em>{verdictLabel}</em>
                    {loc.instruction && (
                      <div style={{ marginTop: 2, fontWeight: 600 }}>↳ {loc.instruction}</div>
                    )}
                    {loc.notes && (
                      <div style={{ marginTop: 1, color: '#444', whiteSpace: 'pre-wrap' }}>
                        {loc.notes}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </Card>
      )}

      {/* === GPR SCANS (full-size grouping for the PDF) === */}
      <div className={ph('gprScans')}>
        <GPRScans report={report} />
      </div>

      {/* === CORE VERDICTS === */}
      <Card title="Drill / core verdicts" className={ph('cores')} badge={
        <span style={{
          background: c.cardAlt, color: c.textDim, fontSize: 11,
          padding: '2px 8px', borderRadius: 4, fontWeight: 500,
        }}>{report.cores.length}</span>
      }>
        <div className="no-print">
        {report.cores.map((co, i) => {
          const v = {
            safe:    { color: c.green, bg: c.greenBg, label: '✓ Safe to drill' },
            caution: { color: c.amber, bg: c.amberBg, label: '⚠ Caution' },
            nogo:    { color: c.red,   bg: c.redBg,   label: '✕ Do not drill' },
          }[co.verdict];
          return (
            <div key={i} id={`core-card-${i}`} style={{
              borderLeft: `3px solid ${v.color}`, background: v.bg,
              padding: '9px 11px', borderRadius: '0 6px 6px 0', marginBottom: 7,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Input value={co.label} onChange={e => updateCore(i, { label: e.target.value })}
                    style={{ width: 36, padding: '4px 6px', fontSize: 13, textAlign: 'center', fontWeight: 600 }} />
                  <Input value={co.size} onChange={e => updateCore(i, { size: e.target.value })}
                    placeholder='4"' style={{ width: 56, padding: '4px 6px', fontSize: 12 }} />
                </div>
                <div className="no-print" style={{ display: 'flex', gap: 4 }}>
                  <Btn variant="ghost" onClick={() => moveCore(i, -1)} disabled={i === 0}
                    title="Move up" style={{ padding: '4px 7px', fontSize: 12, opacity: i === 0 ? 0.35 : 1 }}>▲</Btn>
                  <Btn variant="ghost" onClick={() => moveCore(i, 1)} disabled={i === report.cores.length - 1}
                    title="Move down" style={{ padding: '4px 7px', fontSize: 12, opacity: i === report.cores.length - 1 ? 0.35 : 1 }}>▼</Btn>
                  <Btn variant="ghost" onClick={() => removeCore(i)} style={{ padding: '4px 9px', fontSize: 12 }}>✕</Btn>
                </div>
              </div>
              <Select value={co.verdict} onChange={e => updateCore(i, { verdict: e.target.value })}
                style={{ marginBottom: 5, fontSize: 13, color: v.color, fontWeight: 600 }}>
                <option value="safe">✓ Safe to drill</option>
                <option value="caution">⚠ Caution</option>
                <option value="nogo">✕ Do not drill</option>
              </Select>
              <Input value={co.clearance} onChange={e => updateCore(i, { clearance: e.target.value })}
                placeholder="Clearance / max safe depth"
                style={{ padding: '5px 9px', fontSize: 12, marginBottom: 5 }} />
              <Input value={co.note} onChange={e => updateCore(i, { note: e.target.value })}
                placeholder="Instructions for crew"
                style={{ padding: '5px 9px', fontSize: 12 }} />
            </div>
          );
        })}
        </div>
        {/* Clean read-only verdict table for the report. The editor cards above
            are no-print; their inputs would otherwise clip in the PDF. */}
        {report.cores.length > 0 && (
          <table className="print-only findings-table" style={{
            width: '100%', borderCollapse: 'collapse', fontSize: '9pt', color: '#000', marginTop: 4,
          }}>
            <thead>
              <tr>
                <th>Core</th>
                <th>Size</th>
                <th>Verdict</th>
                <th>Clearance</th>
                <th>Instructions</th>
              </tr>
            </thead>
            <tbody>
              {report.cores.map((co, i) => {
                const vlabel = { safe: '✓ Safe to drill', caution: '⚠ Caution', nogo: '✕ Do not drill' }[co.verdict] || co.verdict;
                return (
                  <tr key={i}>
                    <td><strong>{co.label || '—'}</strong></td>
                    <td>{co.size || '—'}</td>
                    <td>{vlabel}</td>
                    <td>{co.clearance || '—'}</td>
                    <td>{co.note || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="no-print">
          <Btn onClick={addCore} style={{ width: '100%' }}>+ Add core location</Btn>
        </div>
      </Card>

      {/* === UNCERTAINTY ZONES (standard + full only) === */}
      {showUncertainty && (
        <Card title="Areas of uncertainty" className={ph('uncertainty')}>
          <Field label="Daylighting recommended in" hint="Per Terraprobe-style practice — call out zones where GPR resolution is insufficient for definitive interpretation.">
            <AutoGrowTextarea
              value={report.uncertaintyZones}
              onChange={e => update({ uncertaintyZones: e.target.value })}
              placeholder="e.g. NE corner: dense rebar mat creates shadowing. Recommend daylighting before drilling within 600 mm of column line C-4."
            />
          </Field>
        </Card>
      )}

      {/* === EQUIPMENT & CALIBRATION (standard + full) === */}
      {showCalibration && (
        <Card title="Equipment & calibration" className={ph('equipment')}>
          {showFullEquipment && (
            <>
              <Field label="Scanner">
                <Input value={report.scanner} onChange={e => update({ scanner: e.target.value })} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="Serial no.">
                  <Input value={report.serialNo} onChange={e => update({ serialNo: e.target.value })} placeholder="MXT-…" />
                </Field>
                <Field label="Firmware">
                  <Input value={report.firmware} onChange={e => update({ firmware: e.target.value })} placeholder="3.2.1" />
                </Field>
              </div>
              <Field label="Antenna">
                <Input value={report.antenna} onChange={e => update({ antenna: e.target.value })} />
              </Field>
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Scan mode">
              <Select value={report.scanMode} onChange={e => update({ scanMode: e.target.value })}>
                <option>Linescan</option>
                <option>Focus</option>
                <option>Scan3D</option>
                <option>Scan3D + Focus</option>
              </Select>
            </Field>
            <Field label="Dielectric εr">
              <Input value={report.dielectric} onChange={e => update({ dielectric: e.target.value })} placeholder="6.5" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Scan density">
              <Input value={report.scanDensity} onChange={e => update({ scanDensity: e.target.value })} />
            </Field>
            <Field label="Depth range">
              <Input value={report.depthRange} onChange={e => update({ depthRange: e.target.value })} />
            </Field>
          </div>
          <div style={{
            marginTop: 8, padding: 9,
            background: c.amberBg, borderLeft: `3px solid ${c.amber}`,
            borderRadius: '0 6px 6px 0',
          }}>
            <div style={{ fontSize: 11, color: c.amberStrong, fontWeight: 600, marginBottom: 2 }}>⚠ T-R offset zone</div>
            <div style={{ fontSize: 12, color: c.text, lineHeight: 1.4 }}>
              Top 58 mm: reduced resolution (near-surface fuzzy zone) per GSSI 2.7 GHz handbook.
            </div>
          </div>
        </Card>
      )}

      {/* === METHODS NARRATIVE (auto-prose from equipment + calibration) === */}
      {showCalibration && (() => {
        const auto = [
          `Scanning performed with a ${report.scanner || 'GPR system'}`,
          report.antenna ? ` (${report.antenna})` : '',
          ` in ${report.scanMode || 'Scan3D'} mode`,
          report.scanDensity ? ` at ${report.scanDensity}` : '',
          report.dielectric ? `, assuming a dielectric constant of εr = ${report.dielectric}` : '',
          report.depthRange ? `. Effective depth range ${report.depthRange}` : '',
          '. The technician marked subsurface features directly on the slab with paint and crayon prior to client coring/cutting; locations were also recorded photographically and digitally for this report.',
        ].filter(Boolean).join('');
        return (
          <Card title="Methods" className={ph('methods')}>
            <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
              Auto-generated from your Equipment &amp; calibration entries. Override only
              if you need custom phrasing.
            </div>
            <Field label="Override (leave blank to use auto-generated)" className="no-print">
              <Textarea value={report.methodsOverride || ''}
                className="no-print"
                onChange={e => update({ methodsOverride: e.target.value })}
                style={{ minHeight: 80 }}
                placeholder={auto} />
            </Field>
            <div className="print-only methods-print">
              <div style={{ fontSize: '10pt', lineHeight: 1.5, color: '#000', whiteSpace: 'pre-wrap' }}>
                {(report.methodsOverride && report.methodsOverride.trim()) || auto}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* === LIMITATIONS (standard + full) === */}
      {showLimitations && (
        <Card title="Limitations & assumptions" className={ph('limitations')}>
          <div className="no-print">
            {report.limitations.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
                <span style={{ color: c.accent, marginTop: 9, fontSize: 11 }}>▸</span>
                <Input value={line} onChange={e => {
                  const next = [...report.limitations];
                  next[i] = e.target.value;
                  update({ limitations: next });
                }} style={{ fontSize: 12, padding: '6px 9px' }} />
                <Btn variant="ghost"
                  onClick={() => update({ limitations: report.limitations.filter((_, j) => j !== i) })}
                  style={{ padding: '6px 8px', fontSize: 11 }}>✕</Btn>
              </div>
            ))}
            <Btn onClick={() => update({ limitations: [...report.limitations, ''] })} style={{ width: '100%', fontSize: 12 }}>
              + Add limitation
            </Btn>
          </div>
          {/* Clean read-only list for the report. The inputs above are editor-
              only; a single-line <input> can't wrap, so it would clip in print. */}
          <ul className="print-only lim-print" style={{ margin: 0, paddingLeft: 20, fontSize: '10pt', lineHeight: 1.55, color: '#000' }}>
            {report.limitations.filter(l => l && l.trim()).map((line, i) => (
              <li key={i} style={{ marginBottom: 3 }}>{line}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* === STANDARD NOTES (Xradar-style numbered general notes) === */}
      {report.enableStandardNotes && (
        <Card title="Standard notes" className={`${ph('standardNotes')}${report.enableCadPage ? ' no-print' : ''}`}>
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
            Numbered general notes printed alongside the drawing (CAD page) or as a
            standalone block before the legal disclaimer.
          </div>
          <div className="no-print">
          {(report.standardNotes || []).map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
              <span style={{
                color: c.accent, marginTop: 7, fontSize: 11, fontWeight: 700, minWidth: 22, textAlign: 'right',
              }}>{i + 1}.</span>
              <Input value={line} onChange={e => {
                const next = [...report.standardNotes];
                next[i] = e.target.value;
                update({ standardNotes: next });
              }} style={{ fontSize: 12, padding: '6px 9px' }} />
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <Btn variant="ghost"
                  onClick={() => {
                    if (i === 0) return;
                    const next = [...report.standardNotes];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    update({ standardNotes: next });
                  }}
                  disabled={i === 0}
                  style={{ padding: '6px 7px', fontSize: 11 }}>↑</Btn>
                <Btn variant="ghost"
                  onClick={() => {
                    if (i === report.standardNotes.length - 1) return;
                    const next = [...report.standardNotes];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    update({ standardNotes: next });
                  }}
                  disabled={i === report.standardNotes.length - 1}
                  style={{ padding: '6px 7px', fontSize: 11 }}>↓</Btn>
                <Btn variant="ghost"
                  onClick={() => update({ standardNotes: report.standardNotes.filter((_, j) => j !== i) })}
                  style={{ padding: '6px 8px', fontSize: 11 }}>✕</Btn>
              </div>
            </div>
          ))}
          <Btn onClick={() => update({ standardNotes: [...(report.standardNotes || []), ''] })} style={{ width: '100%', fontSize: 12 }}>
            + Add standard note
          </Btn>
          </div>

          {/* Print rendering when CAD page is OFF — standalone block */}
          {!report.enableCadPage && (
            <div className="print-only std-notes-print" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
                STANDARD NOTES
              </div>
              <ol style={{ margin: 0, paddingLeft: 22, fontSize: 10.5, lineHeight: 1.55, color: '#000' }}>
                {(report.standardNotes || []).filter(s => s.trim()).map((s, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}

      {/* === CAD-STYLE LANDSCAPE DRAWING PAGE (print-only) === */}
      {report.enableCadPage && (
        <div className={`cad-page print-only ${ph('cadPage')}`}>
          <div className="cad-letterhead">
            <img src={LOGO_SRC} alt="" className="cad-logo" />
            <div className="cad-letterhead-text">
              <div className="cad-nm1">Aggarwal Kamikaze's</div>
              <div className="cad-nm2">Cutting &amp; Coring Ltd.</div>
              <div className="cad-subtitle">GPR Concrete Scan — Drawing</div>
              <div className="cad-addr">123 Industrial Way, Burnaby BC V5A 1A1 · (604) 555-0199 · scans@aggarwalkamikazes.ca</div>
            </div>
            <div className="cad-letterhead-meta">
              <b>Project</b><div className="v">{report.projectNo || '—'}</div>
              <b>Operator</b><div className="v">{report.preparedBy || '—'}</div>
              <b>Date</b><div className="v">{report.scanDate || '—'}</div>
            </div>
          </div>
          <div className="cad-diagram">
            <DiagramSnapshot report={report} width={1100} height={750} />
          </div>
          <div className="cad-lower">
            <div className="cad-notes">
              {report.diagramNotes && (
                <div className="cad-notes-block">
                  <div className="cad-notes-heading">PROJECT NOTES</div>
                  <div className="cad-notes-body">{report.diagramNotes}</div>
                </div>
              )}
              {report.enableStandardNotes && (report.standardNotes || []).filter(s => s.trim()).length > 0 && (
                <div className="cad-notes-block">
                  <div className="cad-notes-heading">STANDARD NOTES</div>
                  <ol className="cad-notes-list">
                    {(report.standardNotes || []).filter(s => s.trim()).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {report.enableZones && (report.diagramZones || []).length > 0 && (
                <div className="cad-notes-block">
                  <div className="cad-notes-heading">LEGEND</div>
                  <ul className="cad-legend">
                    {Object.entries(ZONE_PATTERNS).map(([id, meta]) => (
                      <li key={id}>
                        <span className="cad-legend-swatch" style={{ background: meta.color }} />
                        {meta.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="cad-titleblock">
              <div className="cad-tb-row"><span>Client</span><strong>{report.client || '—'}</strong></div>
              <div className="cad-tb-row"><span>Site</span><strong>{report.siteAddress || '—'}</strong></div>
              <div className="cad-tb-row"><span>Project no</span><strong>{report.projectNo || '—'}</strong></div>
              <div className="cad-tb-row"><span>Date</span><strong>{report.scanDate || '—'}</strong></div>
              <div className="cad-tb-row"><span>Scale</span><strong>{report.drawingScale || 'NTS'}</strong></div>
              <div className="cad-tb-row"><span>Drawing no</span><strong>{report.drawingNo || `${report.projectNo || 'PROJ'}-D01`}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* === LEGAL DISCLAIMER === */}
      <Card title="Legal disclaimer" className={ph('disclaimer')}>
        <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 7, lineHeight: 1.5 }}>
          Printed at the end of every report. Have your own counsel review before
          relying on this language for production work.
        </div>
        <AutoGrowTextarea
          className="no-print"
          value={report.legalDisclaimer || ''}
          onChange={e => update({ legalDisclaimer: e.target.value })}
        />
        <div className="print-only legal-disclaimer-print">
          {report.legalDisclaimer || ''}
        </div>
      </Card>

      {/* === SIGN-OFF === */}
      <Card title="Authorship & review" className={ph('signoff')}>
        <Field label="Prepared by">
          <Input value={report.preparedBy} onChange={e => update({ preparedBy: e.target.value })} placeholder="Technician name" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Role">
            <Input value={report.preparedRole} onChange={e => update({ preparedRole: e.target.value })} />
          </Field>
          <Field label="Certification">
            <Input value={report.preparedCert} onChange={e => update({ preparedCert: e.target.value })} placeholder="Decifer #" />
          </Field>
        </div>
        <Field label="Reviewed by">
          <Input value={report.reviewedBy} onChange={e => update({ reviewedBy: e.target.value })} placeholder="Engineer of Record" />
        </Field>
        <Field label="Reviewer role">
          <Input value={report.reviewedRole} onChange={e => update({ reviewedRole: e.target.value })} />
        </Field>

        <div className="no-print" style={{
          marginTop: 6, padding: 9,
          background: c.cardAlt, borderRadius: 6,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={report.egbcEnabled}
              onChange={e => update({ egbcEnabled: e.target.checked })}
              style={{ width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Add EGBC seal block</div>
              <div style={{ fontSize: 11, color: c.textDim }}>For P.Eng-stamped reports only</div>
            </div>
          </label>
        </div>

        {report.egbcEnabled && (
          <div style={{
            border: `1px dashed ${c.borderStrong}`, borderRadius: 6,
            padding: 12, textAlign: 'center', marginTop: 8, marginBottom: 16,
            background: c.cardAlt,
          }}>
            <div style={{ fontSize: 10, color: c.textFaint, letterSpacing: 1.5, marginBottom: 3, fontWeight: 600 }}>EGBC SEAL</div>
            <div style={{ fontSize: 11, color: c.textDim }}>Engineers and Geoscientists BC</div>
            <Input value={report.permitNo} onChange={e => update({ permitNo: e.target.value })}
              placeholder="Permit to Practice #"
              style={{ marginTop: 6, textAlign: 'center', fontSize: 12 }} />
          </div>
        )}

        <Field label="Signature date">
          <Input type="date" value={report.signDate} onChange={e => update({ signDate: e.target.value })} />
        </Field>

        <Field label="Report footer line" className="no-print"
          hint='Printed at the very bottom when brand flourishes are on. Make it your own — e.g. "Shut up and cut straight." Clear it to hide the line.'>
          <Input value={report.footerTagline ?? ''}
            onChange={e => update({ footerTagline: e.target.value })}
            placeholder="Prepared with care by the AKCC crew · Know before you cut." />
        </Field>

        <Field label="Footer sub-line" className="no-print"
          hint="Small grey line under the footer (equipment / edition). Optional — edit it or clear it to remove.">
          <Input value={report.footerSubline ?? ''}
            onChange={e => update({ footerSubline: e.target.value })}
            placeholder="GSSI StructureScan Mini XT · British Columbia engineering edition" />
        </Field>

        {/* === ENGINEER APPROVAL (F3) — the engineer reviews & approves by email;
             recording it marks the report Approved and archives it. No lock. === */}
        <div className="no-print" style={{
          marginTop: 12, padding: 11, borderRadius: 8,
          background: report.status === 'approved' ? c.greenBg : c.cardAlt,
          border: `1px solid ${report.status === 'approved' ? c.green : c.borderStrong}`,
        }}>
          {report.status === 'approved' ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: c.green, marginBottom: 4 }}>✓ Approved &amp; archived</div>
              <div style={{ fontSize: 12, color: c.text, lineHeight: 1.5 }}>
                Approved by <strong>{report.approvedBy || '—'}</strong>
                {report.approvedDate ? ` on ${report.approvedDate}` : ''} · via email.
              </div>
              <Btn variant="ghost"
                onClick={() => { if (confirm('Revert to Issued? This un-approves the report so you can revise it.')) update({ status: 'issued', approvedBy: '', approvedDate: '' }); }}
                style={{ marginTop: 8, fontSize: 12 }}>↩ Revert to Issued</Btn>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: c.textDim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Engineer approval</div>
              <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 8, lineHeight: 1.5 }}>
                The engineer reviews &amp; approves by email — they don't type into this report. Record their name and the date, then approve.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8, marginBottom: 8 }}>
                <Input value={report.approvedBy} onChange={e => update({ approvedBy: e.target.value })} placeholder={report.reviewedBy || 'Engineer name'} />
                <Input type="date" value={report.approvedDate || ''} onChange={e => update({ approvedDate: e.target.value })} />
              </div>
              <Btn variant="primary"
                onClick={() => {
                  const by = (report.approvedBy || report.reviewedBy || '').trim();
                  if (!by) { alert('Enter the approving engineer’s name first (or fill “Reviewed by”).'); return; }
                  if (!confirm(`Mark this report APPROVED by ${by} and archive it?`)) return;
                  update({ status: 'approved', approvedBy: by, approvedDate: report.approvedDate || new Date().toISOString().slice(0, 10) });
                }}
                style={{ width: '100%' }}>✓ Mark approved &amp; archive</Btn>
            </>
          )}
        </div>

        <label className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 12, color: c.textDim, lineHeight: 1.4 }}>
          <input type="checkbox" checked={report.showWatermark !== false}
            onChange={e => update({ showWatermark: e.target.checked })} style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>Show <strong>DRAFT / FOR REVIEW</strong> watermark on the PDF until approved <span style={{ color: c.textFaint }}>(recommended)</span></span>
        </label>

        {report.status === 'approved' && report.approvedBy && (
          <div className="print-only approval-audit-print">
            ✓ Approved by {report.approvedBy}{report.approvedDate ? ` on ${report.approvedDate}` : ''} · via email
          </div>
        )}
      </Card>

      {/* === BRAND FLOURISH FOOTER SIGNATURE (print/preview only, opt-in) === */}
      {report.brandFlourishes && (() => {
        // undefined (legacy/sample) → default line; '' (user cleared) → hidden.
        const line = report.footerTagline ?? `Prepared with care by the AKCC crew · ${BRAND_TAGLINE}`;
        return line.trim() ? <div className="print-only brand-signoff">{line}</div> : null;
      })()}

      </div>{/* === END REPORT BODY === */}
      {/* RIGHT: At-a-glance rail — live core verdict tallies. Screen only. */}
      <aside className="ws-rail no-print" aria-label="At a glance">
        <Card title="At a glance" dense>
          <AtAGlanceRail cores={report.cores} targets={report.targets} />
        </Card>
      </aside>
      </div>{/* === END WS-GRID === */}

      {/* === ACTIONS === */}
      <div className="no-print" style={{
        position: 'sticky', bottom: 10,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
        background: c.bg, padding: '10px 0 0',
      }}>
        <Btn variant="primary" onClick={exportPDF} title={desktop ? 'Save a PDF next to your report file' : 'Open the print window — choose “Save as PDF” to make the file you send'}>📄 PDF</Btn>
        <Btn onClick={() => setEmailDialogOpen(true)} title="Open a ready-made email (attach the saved PDF yourself before sending)">📧 Email</Btn>
        <Btn onClick={() => { setSaveNote(''); setSaveOpen(true); }} title="Save a backup file you can re-open or update later">💾 Save</Btn>
      </div>
      <div className="no-print" style={{ fontSize: 10.5, color: c.textFaint, textAlign: 'center', marginTop: 7, lineHeight: 1.5 }}>
        Your work auto-saves in this browser. <strong>💾 Save</strong> makes a backup file you can
        update or keep — downloads never overwrite an earlier one. New here? Tap <strong>❓</strong> up top.
      </div>

      <div style={{ fontSize: 10, color: c.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
        <span className="no-print">Tier: <strong style={{ color: c.textDim, textTransform: 'capitalize' }}>{tier}</strong> · v{APP_VERSION}<br/></span>
        {(report.footerSubline ?? 'GSSI StructureScan Mini XT · British Columbia engineering edition').trim() || null}
      </div>

      <Assistant report={report} update={update} />

      {/* Sections quick-nav now lives in the always-on side panel (.ws-nav),
          so the floating bottom-right button was removed. */}
      <Notepad />
      <ShortcutsPanel />

      {emailDialogOpen && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setEmailDialogOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
            borderRadius: 10, padding: 18,
            width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 4 }}>
              📧 Email this report
            </div>
            <div style={{ fontSize: 11, color: c.textDim, marginBottom: 14, lineHeight: 1.5 }}>
              Opens a new email pre-filled from the project info.
              <strong style={{ color: c.amberStrong }}> The PDF can't attach itself</strong> —
              tap 📄 PDF first, save it, then attach that file after the email opens.
            </div>

            <Field label="Send with" hint="Your choice is remembered for next time.">
              <Select value={emailProvider} onChange={e => setEmailProvider(e.target.value)}>
                {EMAIL_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </Field>

            {contacts.length > 0 && (
              <Field label="Pick a saved contact">
                <Select value=""
                  onChange={e => { if (e.target.value) setEmailTo(e.target.value); }}>
                  <option value="">— choose a contact —</option>
                  {contacts.filter(ct => ct.email).map(ct => (
                    <option key={ct.id} value={ct.email}>
                      {[ct.name, ct.company].filter(Boolean).join(' · ') || ct.email} — {ct.email}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="To (optional)" hint={
              <span>Manage saved customers from the <strong>👥</strong> button in the header.</span>
            }>
              <Input value={emailTo} onChange={e => setEmailTo(e.target.value)}
                list="ak-contact-emails" placeholder="reviewer@example.com" />
              <datalist id="ak-contact-emails">
                {contacts.filter(ct => ct.email).map(ct => (
                  <option key={ct.id} value={ct.email}>{ct.name || ct.company}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Subject">
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </Field>
            <Field label="Body">
              <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                style={{ minHeight: 200, fontFamily: 'inherit', fontSize: 12 }} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
              <Btn variant="ghost" onClick={exportPDF}
                title={desktop ? 'Save the PDF first, then attach it' : 'Triggers Save as PDF — keep this dialog open while you save'}>
                📄 Save PDF first
              </Btn>
              <Btn variant="primary" onClick={sendEmail}>
                ✉ Open {EMAIL_PROVIDERS.find(p => p.id === emailProvider)?.label || 'Email'}
              </Btn>
            </div>
            {canShare && (
              <>
                <Btn onClick={shareReport} style={{ width: '100%', marginTop: 6 }}
                  title="Open your device's share menu (Mail, Messages, etc.) with this draft">
                  📤 Share{shareBackup ? ' · with backup file' : ''}
                </Btn>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, fontSize: 11.5, color: c.textDim, cursor: 'pointer' }}>
                  <input type="checkbox" checked={shareBackup}
                    onChange={e => toggleShareBackup(e.target.checked)}
                    style={{ accentColor: c.accent, flexShrink: 0 }} />
                  Attach the .json backup file (for re-opening/editing — clients and engineers don't need it)
                </label>
              </>
            )}
            {shareNote && (
              <div style={{ fontSize: 11, color: c.amberStrong, marginTop: 6, textAlign: 'center' }}>
                {shareNote}
              </div>
            )}
            <Btn variant="ghost" onClick={() => setEmailDialogOpen(false)}
              style={{ width: '100%', marginTop: 6 }}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setConfirmReset(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
            borderRadius: 10, padding: 18,
            width: 'min(440px, 100%)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 6 }}>
              ↻ Reset the form?
            </div>
            <div style={{ fontSize: 12.5, color: c.textDim, lineHeight: 1.5, marginBottom: 14 }}>
              This clears every field — project info, targets, cores, photos, annotations, custom reminders, everything.
              Once cleared, it can't be undone. Save a draft first so you have a copy.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <Btn variant="primary" onClick={() => { exportJSON(); setTimeout(doReset, 250); }}>
                💾 Save first, then reset
              </Btn>
              <Btn variant="ghost" onClick={doReset}
                style={{ borderColor: c.red, color: c.red }}>
                ↻ Already saved — reset
              </Btn>
            </div>
            <Btn variant="ghost" onClick={() => setConfirmReset(false)}
              style={{ width: '100%', marginTop: 6 }}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {/* === SAVED DRAFTS === */}
      {reportsOpen && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setReportsOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
            borderRadius: 10, padding: 18,
            width: 'min(540px, 100%)', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 4 }}>
              🗂 My reports
            </div>
            <div style={{ fontSize: 11, color: c.textDim, marginBottom: 14, lineHeight: 1.5 }}>
              Work on as many reports as you like — each one auto-saves on its own.
              Tap a report to open it; the one you're in is marked <strong>Open</strong>.
            </div>
            <Btn id="btn-new-report" variant="primary"
              onClick={() => { setStartReportOpen(true); setReportsOpen(false); }}
              style={{ width: '100%', marginBottom: 12 }}>
              ＋ New report — templates &amp; example
            </Btn>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[...reportsIndex].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(e => {
                const isOpen = e.id === currentId;
                return (
                  <div key={e.id} style={{
                    border: `1px solid ${isOpen ? c.accent : c.border}`, borderRadius: 6, padding: 9,
                    background: isOpen ? c.accentDim : c.cardAlt,
                  }}>
                    <Input value={e.name}
                      onChange={ev => renameReport(e.id, ev.target.value)}
                      style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }} />
                    <div style={{ fontSize: 10.5, color: isOpen ? '#fff' : c.textFaint, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {e.status === 'approved' && (
                        <span style={{ background: c.greenBg, color: c.green, border: `1px solid ${c.green}`, borderRadius: 4, padding: '1px 6px', fontWeight: 800, fontSize: 9.5, letterSpacing: 0.3 }}>✓ APPROVED · ARCHIVED</span>
                      )}
                      {e.status === 'issued' && (
                        <span style={{ background: c.amberBg, color: c.amber, border: `1px solid ${c.amber}`, borderRadius: 4, padding: '1px 6px', fontWeight: 800, fontSize: 9.5, letterSpacing: 0.3 }}>FOR REVIEW</span>
                      )}
                      <span>{isOpen ? 'Open now · ' : ''}Updated {e.updatedAt ? new Date(e.updatedAt).toLocaleString() : '—'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
                      <Btn variant="primary" onClick={() => switchReport(e.id)} disabled={isOpen}
                        style={{ fontSize: 12, opacity: isOpen ? 0.6 : 1 }}>
                        {isOpen ? '✓ Open' : '📂 Open'}
                      </Btn>
                      <Btn variant="ghost" onClick={() => duplicateReport(e.id)} style={{ fontSize: 12 }}>
                        ⧉ Copy
                      </Btn>
                      <Btn variant="ghost"
                        onClick={() => { if (confirm('Delete this report? This cannot be undone.')) deleteReport(e.id); }}
                        style={{ fontSize: 12, borderColor: c.red, color: c.red }}>
                        🗑
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 14, paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: c.text }}>📋 Templates</div>
                <Btn onClick={openCreateTemplate} style={{ fontSize: 11.5, padding: '6px 10px' }}>
                  💾 Save current as template…
                </Btn>
              </div>
              {templates.length === 0 ? (
                <div style={{ padding: 10, fontSize: 11.5, color: c.textFaint, background: c.cardAlt, borderRadius: 6, lineHeight: 1.5 }}>
                  No templates yet. Save the current report as a template to reuse its client info, equipment defaults, sign-off, and section toggles on every new job for that client.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {templates.map(t => (
                    <div key={t.id} style={{
                      border: `1px solid ${c.border}`, borderRadius: 6, padding: 7, background: c.cardAlt,
                      display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6, alignItems: 'center',
                    }}>
                      <Input value={t.name}
                        onChange={(e) => renameTemplate(t.id, e.target.value)}
                        style={{ fontSize: 12, fontWeight: 600 }} />
                      <Btn variant="primary" onClick={() => createReportFromTemplate(t.id)} style={{ fontSize: 11, padding: '6px 10px' }}>
                        📂 Use
                      </Btn>
                      <Btn variant="ghost" onClick={() => openEditTemplate(t.id)}
                        style={{ fontSize: 11, padding: '6px 10px' }}>
                        ✏️ Edit
                      </Btn>
                      <Btn variant="ghost"
                        onClick={() => { if (confirm('Delete this template?')) deleteTemplate(t.id); }}
                        style={{ fontSize: 11, borderColor: c.red, color: c.red, padding: '5px 8px' }}>
                        🗑
                      </Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Btn variant="ghost" onClick={() => setReportsOpen(false)} style={{ width: '100%', marginTop: 12 }}>
              Close
            </Btn>
          </div>
        </div>
      )}

      {templateEditor && (
        <TemplateEditor
          open
          mode={templateEditor.mode}
          initialName={templateEditor.initialName}
          initialFields={templateEditor.initialFields}
          onSave={templateEditor.onSave}
          onClose={() => setTemplateEditor(null)}
          c={c}
        />
      )}

      <StartReportModal
        open={startReportOpen}
        templates={templates}
        c={c}
        onUseTemplate={(id) => { setStartReportOpen(false); createReportFromTemplate(id); }}
        onUseBlank={() => { setStartReportOpen(false); createReport(); }}
        onUseExample={createReportFromExample}
        onEditTemplate={(id) => { setStartReportOpen(false); openEditTemplate(id); }}
        onClose={() => setStartReportOpen(false)}
      />


      {/* === CUSTOMER CONTACTS === */}
      {contactsOpen && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setContactsOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
            borderRadius: 10, padding: 18,
            width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 4 }}>
              👥 Customer contacts
            </div>
            <div style={{ fontSize: 11, color: c.textDim, marginBottom: 14, lineHeight: 1.5 }}>
              Save the people you send reports to. They appear as quick-pick options in the
              Email dialog and as suggestions on the Client field.
            </div>
            <Btn variant="primary" onClick={() => addContact({})} style={{ width: '100%', marginBottom: 12 }}>
              ＋ Add contact
            </Btn>
            {contacts.length === 0 ? (
              <div style={{
                padding: 14, textAlign: 'center', fontSize: 12, color: c.textFaint,
                background: c.cardAlt, borderRadius: 6,
              }}>No contacts yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {contacts.map(ct => (
                  <div key={ct.id} style={{
                    border: `1px solid ${c.border}`, borderRadius: 6, padding: 9, background: c.cardAlt,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                      <Input value={ct.name} placeholder="Contact name"
                        onChange={e => updateContact(ct.id, { name: e.target.value })}
                        style={{ fontSize: 13 }} />
                      <Input value={ct.company} placeholder="Company"
                        onChange={e => updateContact(ct.id, { company: e.target.value })}
                        style={{ fontSize: 13 }} />
                    </div>
                    <Input value={ct.email} type="email" placeholder="email@example.com"
                      onChange={e => updateContact(ct.id, { email: e.target.value })}
                      style={{ fontSize: 13, marginBottom: 6 }} />
                    <Input value={ct.note} placeholder="Note (optional)"
                      onChange={e => updateContact(ct.id, { note: e.target.value })}
                      style={{ fontSize: 12, marginBottom: 6 }} />
                    <Btn variant="ghost" onClick={() => removeContact(ct.id)}
                      style={{ width: '100%', fontSize: 12, borderColor: c.red, color: c.red }}>
                      🗑 Remove
                    </Btn>
                  </div>
                ))}
              </div>
            )}
            <Btn variant="ghost" onClick={() => setContactsOpen(false)} style={{ width: '100%', marginTop: 12 }}>
              Close
            </Btn>
          </div>
        </div>
      )}

      {/* === SAVE DIALOG === */}
      {saveOpen && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 220,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setSaveOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
            borderRadius: 10, padding: 18,
            width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 4 }}>
              💾 Save this report
            </div>
            <div style={{ fontSize: 11, color: c.textDim, marginBottom: 12, lineHeight: 1.5 }}>
              Your work already auto-saves inside this browser. Saving here makes a backup
              <strong> file</strong> you can keep, re-open, or move to another computer.
            </div>

            {desktop && recentFiles.length > 0 && (
              <div style={{
                border: `1px solid ${c.border}`, borderRadius: 8, padding: 11, marginBottom: 10,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text, marginBottom: 6 }}>
                  Recent files
                </div>
                {recentFiles.map(f => (
                  <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <button onClick={() => openRecentFile(f.path)} title={f.path} style={{
                      flex: 1, textAlign: 'left', background: c.cardAlt, color: c.text,
                      border: `1px solid ${c.border}`, borderRadius: 6, padding: '6px 9px',
                      fontSize: 11.5, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>📂 {f.name}</button>
                    <button onClick={() => removeRecentFile(f.path)} title="Remove from list" style={{
                      background: 'transparent', color: c.textFaint, border: `1px solid ${c.border}`,
                      borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <Field label="Job description (used in the file name)"
              hint="A short note so you can recognize this job's file later.">
              <Input value={report.jobNote} onChange={e => update({ jobNote: e.target.value })}
                placeholder="P2 parkade north wall" />
            </Field>
            <div style={{
              fontSize: 11, color: c.textDim, background: c.cardAlt,
              border: `1px solid ${c.border}`, borderRadius: 6, padding: '7px 9px',
              marginBottom: 12, wordBreak: 'break-all',
            }}>
              File name: <strong style={{ color: c.text }}>{baseFileName()}{desktop ? '.akscan' : '.json'}</strong>
            </div>

            {(desktop || supportsFS) && (
              <div style={{
                border: `1px solid ${c.border}`, borderRadius: 8, padding: 11, marginBottom: 10,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text, marginBottom: 4 }}>
                  Save to a file you can update
                </div>
                <div style={{ fontSize: 11, color: c.textDim, marginBottom: 9, lineHeight: 1.5 }}>
                  Pick the file once. After that, one click updates that same file —
                  no piling-up copies.
                </div>
                {savedFileName ? (
                  <>
                    <div style={{ fontSize: 11, color: c.green, marginBottom: 8 }}>
                      ✓ Linked to <strong>{savedFileName}</strong>
                    </div>
                    <Btn variant="primary" onClick={() => saveToFile(false)} style={{ width: '100%', marginBottom: 6 }}>
                      💾 Update “{savedFileName}”
                    </Btn>
                    <Btn variant="ghost" onClick={() => saveToFile(true)} style={{ width: '100%', fontSize: 12 }}>
                      Choose a different file…
                    </Btn>
                  </>
                ) : (
                  <Btn variant="primary" onClick={() => saveToFile(false)} style={{ width: '100%' }}>
                    📌 Choose file &amp; save
                  </Btn>
                )}
              </div>
            )}

            {(desktop || supportsFS) && (
              <div style={{
                border: `1px solid ${c.border}`, borderRadius: 8, padding: 11, marginBottom: 10,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text, marginBottom: 4 }}>
                  Auto-save
                </div>
                <div style={{ fontSize: 11, color: c.textDim, marginBottom: 9, lineHeight: 1.5 }}>
                  Once a file is linked above, save it again automatically on a timer — so a crash
                  or closed window never costs you more than a few minutes.
                </div>
                <Field label="Save the linked file every">
                  <Select value={String(autoSaveMin)} onChange={e => setAutoSaveMin(Number(e.target.value))}>
                    <option value="0">Off</option>
                    <option value="1">1 minute</option>
                    <option value="2">2 minutes</option>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                  </Select>
                </Field>
                {autoSaveMin > 0 && !hasLinkedFile() && (
                  <div style={{ fontSize: 10.5, color: c.amberStrong, marginTop: 4 }}>
                    Link a file (above) to start auto-saving.
                  </div>
                )}
                {lastAutoSaveAt && (
                  <div style={{ fontSize: 10.5, color: c.textFaint, marginTop: 4 }}>
                    Last auto-save: {new Date(lastAutoSaveAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}

            <div style={{
              border: `1px solid ${c.border}`, borderRadius: 8, padding: 11, marginBottom: 10,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text, marginBottom: 4 }}>
                Download a backup copy
              </div>
              <div style={{ fontSize: 11, color: c.textDim, marginBottom: 9, lineHeight: 1.5 }}>
                Saves to your Downloads folder. Each download includes the date &amp; time, so it
                <strong> never overwrites</strong> an earlier file.
              </div>
              <Btn variant={(supportsFS || desktop) ? 'default' : 'primary'} onClick={exportJSON} style={{ width: '100%' }}>
                ⬇ Download backup copy
              </Btn>
            </div>

            {!supportsFS && !desktop && (
              <div style={{ fontSize: 10.5, color: c.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
                Tip: the one-click “save &amp; update the same file” option works in Chrome or Edge
                on a computer.
              </div>
            )}
            {saveNote && (
              <div style={{ fontSize: 11.5, color: c.green, textAlign: 'center', marginBottom: 8 }}>
                {saveNote}
              </div>
            )}
            <Btn variant="ghost" onClick={() => setSaveOpen(false)} style={{ width: '100%' }}>
              Close
            </Btn>
          </div>
        </div>
      )}

      {/* === WHAT'S-NEW DIALOG (auto-opens once per version bump) === */}
      {whatsNewEntries && (
        <WhatsNewModal entries={whatsNewEntries} onClose={dismissWhatsNew} />
      )}

      {/* === GETTING STARTED GUIDE === */}
      {helpOpen && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 250,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setHelpOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
            borderRadius: 10, padding: 20,
            width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.text, marginBottom: 4 }}>
              👋 Getting started
            </div>
            <div style={{ fontSize: 12.5, color: c.textDim, marginBottom: 16, lineHeight: 1.5 }}>
              A quick guide to saving your work and sending a report. You can reopen this
              any time with the <strong>❓</strong> button at the top.
            </div>

            {[
              {
                icon: '✓', title: 'Your work saves itself (inside the app)',
                body: 'Everything you type is saved automatically on this computer, inside this web browser. ' +
                      'You don’t have to do anything — close the tab and come back later and it will still be ' +
                      'here. The green “✓ Saved” tag at the top shows the last time it saved. Note this is the ' +
                      'browser’s own memory, not a file you can see in your folders — for that, see step 3.',
              },
              {
                icon: '📚', title: 'Keep more than one report',
                body: 'Click 📚 (top of the screen) to save a snapshot of the current report and start a ' +
                      'fresh one. Open 📚 again any time to load an older report back up.',
              },
              {
                icon: '💾', title: 'Save a backup file to your computer',
                body: 'Click “💾 Save” at the bottom. Give the job a short description (it becomes the file ' +
                      'name, so files are easy to recognize). In Chrome or Edge you can “Choose file & save”, ' +
                      'then later just click “Update” to save changes back into that same file. ' +
                      'Or use “Download backup copy” — each download is stamped with the date & time, so it ' +
                      'never overwrites an earlier file. To re-open a saved file later (on this or another ' +
                      'computer), click “📂 Load” at the top and pick it.',
              },
              {
                icon: '📄', title: 'Make the PDF to send',
                body: 'Click “📄 PDF”. Your browser’s print window opens. In the “Destination” or ' +
                      '“Printer” box, choose “Save as PDF”, then Save. Pick somewhere easy to find, ' +
                      'like your Desktop. Tip: use “👁 Preview” first to choose which sections to include.',
              },
              {
                icon: '📧', title: 'Email the report',
                body: 'Click “📧 Email” for a ready-made message. Browsers can’t attach the PDF for you, ' +
                      'so attach the PDF you just saved before you send. Save the people you email often ' +
                      'under “👥 Contacts” so their address fills in with one click.',
              },
              {
                icon: '⚠', title: 'Important — where things are stored',
                body: 'Drafts and contacts live only in this browser, on this computer. If you clear your ' +
                      'browser history/data or move to another computer, use the backup file (💾 to save, ' +
                      '📂 to load) to carry your work across. The backup file is the safe copy.',
              },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', gap: 11, marginBottom: 13,
                paddingBottom: 13,
                borderBottom: i < 5 ? `1px solid ${c.border}` : 'none',
              }}>
                <div style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                  background: c.accentDim, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800,
                }}>{step.icon}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text, marginBottom: 3 }}>
                    {i + 1}. {step.title}
                  </div>
                  <div style={{ fontSize: 12, color: c.textDim, lineHeight: 1.55 }}>{step.body}</div>
                </div>
              </div>
            ))}

            <label style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '10px 12px', marginBottom: 10, marginTop: 2,
              background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 8,
              cursor: 'pointer',
            }}>
              <input type="checkbox" checked={helpAutoShow}
                onChange={e => setHelpAutoShow(e.target.checked)}
                style={{ accentColor: c.accent, width: 17, height: 17, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: c.text, lineHeight: 1.4 }}>
                Show this guide automatically when the app opens.
                <span style={{ color: c.textFaint }}> You can turn it back on any time with the ❓ button.</span>
              </span>
            </label>
            <Btn variant="primary" onClick={() => setHelpOpen(false)} style={{ width: '100%', padding: '11px 12px', fontWeight: 700 }}>
              Got it — let’s go
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
