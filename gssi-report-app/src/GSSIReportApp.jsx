import React, { useState, useRef, useEffect, useMemo } from 'react';
import QRGen from './qrcode.js';

// ============================================================
// GSSI StructureScan Mini XT — Scan Report Builder v2
// BC-tuned · Tiered deliverables · Executive summary first
// Modeled on Terraprobe / EGBC practice expectations
// ============================================================

const STORAGE_KEY = 'gssi_report_v2';
const CONTACTS_KEY = 'ak_contacts';   // customer/contact directory (cross-report)
const DRAFTS_KEY   = 'ak_drafts';     // named saved reports (cross-report)
const AUTOFILL_KEY = 'ak_autofill';   // remembered sticky fields + recent client/site values
const HELP_SEEN_KEY = 'ak_help_seen'; // first-run Getting Started guide dismissed

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

// Subtle company tagline used by the optional Brand Flourishes flag.
// Plays on the company name (cutting & coring) and what GPR actually does.
const BRAND_TAGLINE = 'Cutting through what others can’t see.';

const DEFAULT_REPORT = {
  // Tier
  tier: 'standard',  // quick | standard | full

  // Assistant UI
  assistantOn: true,
  customReminders: [],  // [{ id, text, level: 'high'|'med'|'low' }]

  // Cover
  projectNo: '',
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
    'Aggarwal Kamikazes Cutting & Coring Ltd (the "Company") for the named client only. ' +
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
// Design tokens — Aggarwal Kamikazes palette (light + dark)
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, paddingBottom: 8,
        borderBottom: `1px solid ${c.border}`,
      }}>
        <h2 style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          color: accent ? c.accent : c.textDim,
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>{title}</h2>
        {badge}
      </div>
    )}
    {children}
  </div>
);

const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{
      fontSize: 10.5, color: c.textDim, marginBottom: 3,
      textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
    }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 11, color: c.textFaint, marginTop: 3 }}>{hint}</div>}
  </div>
);

const Input = (props) => (
  <input {...props} style={{
    width: '100%', background: c.cardAlt,
    border: `1px solid ${c.border}`, borderRadius: 6,
    padding: '9px 11px', color: c.text, fontSize: 14,
    fontFamily: 'inherit', boxSizing: 'border-box',
    ...props.style,
  }} />
);

const Textarea = (props) => (
  <textarea {...props} style={{
    width: '100%', background: c.cardAlt,
    border: `1px solid ${c.border}`, borderRadius: 6,
    padding: '9px 11px', color: c.text, fontSize: 14,
    fontFamily: 'inherit', boxSizing: 'border-box',
    resize: 'vertical', minHeight: 64,
    ...props.style,
  }} />
);

// Textarea that auto-resizes to fit its content (no internal scrollbar)
function AutoGrowTextarea({ value, onChange, className, style }) {
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
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      onInput={fit}
      style={{
        width: '100%', background: c.cardAlt,
        border: `1px solid ${c.border}`, borderRadius: 6,
        padding: '10px 12px', color: c.text, fontSize: 13, lineHeight: 1.55,
        fontFamily: 'inherit', boxSizing: 'border-box',
        resize: 'none', overflow: 'hidden',
        ...style,
      }}
    />
  );
}

const Select = ({ children, ...props }) => (
  <select {...props} style={{
    width: '100%', background: c.cardAlt,
    border: `1px solid ${c.border}`, borderRadius: 6,
    padding: '9px 11px', color: c.text, fontSize: 14,
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
      borderRadius: 6, padding: '9px 12px', color: v.fg,
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
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
  const confMeta = {
    high: { label: 'HIGH', color: c.green, bg: c.greenBg },
    med:  { label: 'MEDIUM', color: c.amber, bg: c.amberBg },
    low:  { label: 'LOW', color: c.red, bg: c.redBg },
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
      z.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
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
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawSiteDiagramTo(ctx, width, height, report, { backgroundImage: imgRef.current });
  }, [report.diagramImage, report.diagramStrokes, report.diagramPins, report.diagramZones, report.enableZones, width, height]);
  return (
    <>
      {report.diagramImage && (
        <img ref={imgRef} src={report.diagramImage} alt=""
          style={{ display: 'none' }}
          onLoad={() => {
            const c = canvasRef.current;
            if (!c) return;
            const ctx = c.getContext('2d');
            drawSiteDiagramTo(ctx, c.width, c.height, report, { backgroundImage: imgRef.current });
          }} />
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
  const [pinSize, setPinSize] = useState(18);
  const [zonePattern, setZonePattern] = useState('hatch-red');
  const [zoneDraft, setZoneDraft] = useState(null); // { points: [], pattern }

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
        ctx.moveTo(z.points[0].x, z.points[0].y);
        z.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
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

      // In-progress zone draft preview
      if (zoneDraft && zoneDraft.points.length > 0) {
        const meta = ZONE_PATTERNS[zoneDraft.pattern] || ZONE_PATTERNS['hatch-red'];
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = meta.color;
        ctx.fillStyle = meta.color;
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(zoneDraft.points[0].x, zoneDraft.points[0].y);
        zoneDraft.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        if (hoverPt) ctx.lineTo(hoverPt.x, hoverPt.y);
        ctx.stroke();
        // Vertex markers
        ctx.setLineDash([]);
        zoneDraft.points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }
    }

    report.diagramStrokes.forEach(s => {
      if (s.points.length < 2) return;
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

  useEffect(redraw, [report.diagramStrokes, report.diagramPins, report.diagramZones, report.enableZones, anchor, hoverPt, tool, strokeWidth, pinSize, zoneDraft]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }, [report.diagramImage]);

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

  const handleStart = (e) => {
    e.preventDefault();
    const pt = getCoords(e);
    if (tool === 'pin') {
      const nextLabel = String.fromCharCode(65 + report.diagramPins.length);
      const v = prompt(`Pin ${nextLabel} verdict?\nType: safe / caution / nogo`, 'safe');
      if (!v) return;
      const n = v.toLowerCase().trim();
      if (!['safe', 'caution', 'nogo'].includes(n)) return;
      update({
        diagramPins: [...report.diagramPins, { x: pt.x, y: pt.y, label: nextLabel, verdict: n, size: pinSize }],
      });
    } else if (tool === 'draw-zone') {
      // Each click appends a vertex to the working zone draft
      setZoneDraft(prev => ({
        pattern: prev?.pattern || zonePattern,
        points:  [...(prev?.points || []), pt],
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
      alert('A zone needs at least 3 points. Tap the diagram to add points first.');
      return;
    }
    const labelDefault = `Z${(report.diagramZones || []).length + 1}`;
    const label = prompt('Zone label (e.g. "Z1", "Slab band", "BoH"):', labelDefault) || labelDefault;
    const id = `dz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    update({
      diagramZones: [...(report.diagramZones || []), {
        id, label, points: zoneDraft.points, pattern: zoneDraft.pattern,
      }],
    });
    setZoneDraft(null);
    setHoverPt(null);
  };

  const cancelZone = () => { setZoneDraft(null); setHoverPt(null); };

  const handleMove = (e) => {
    if (tool === 'draw-zone' && zoneDraft) {
      e.preventDefault();
      setHoverPt(getCoords(e));
      return;
    }
    if (!anchor || !tool.startsWith('draw-')) return;
    e.preventDefault();
    setHoverPt(getCoords(e));
  };

  const handleEnd = () => {};

  useEffect(() => {
    setAnchor(null);
    setHoverPt(null);
  }, [tool]);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update({ diagramImage: ev.target.result });
    reader.readAsDataURL(file);
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
        {report.diagramImage ? (
          <img src={report.diagramImage} alt="Site"
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        ) : (
          <div style={{
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
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 6 }}>
        <label style={{
          background: c.cardAlt, border: `1px solid ${c.borderStrong}`,
          borderRadius: 6, padding: '8px', textAlign: 'center', fontSize: 13,
          color: c.text, cursor: 'pointer', fontWeight: 500,
        }}>
          📷 Photo
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        </label>
        {toolBtn('pin', '📍 Pin core')}
        {toolBtn('draw-rebar', 'Rebar', '#FAC775')}
        {toolBtn('draw-pt', 'PT cable', '#F09595')}
        {toolBtn('draw-conduit', 'Conduit', '#9BC5E8')}
        {toolBtn('draw-note', 'Note', '#5DCAA5')}
        {toolBtn('draw-crack', '⋯ Crack', '#cccccc')}
        {report.enableZones && toolBtn('draw-zone', '▦ Zone', '#e02020')}
      </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Btn variant="primary" onClick={finishZone}
              disabled={!zoneDraft || zoneDraft.points.length < 3}
              style={{ fontSize: 12 }}>
              ✓ Finish zone {zoneDraft ? `(${zoneDraft.points.length} pts)` : ''}
            </Btn>
            <Btn variant="ghost" onClick={cancelZone}
              disabled={!zoneDraft}
              style={{ fontSize: 12 }}>Cancel zone</Btn>
          </div>
          <div style={{ fontSize: 10, color: c.textFaint, marginTop: 5, lineHeight: 1.4 }}>
            Tap the diagram to drop polygon vertices; tap Finish when the outline is closed
            (need 3+ points). Undo pops the last vertex.
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
            Line thickness: <span style={{ color: c.text }}>{strokeWidth}px</span>
          </div>
          <input type="range" min="1" max="16" step="1"
            value={strokeWidth}
            onChange={e => setStrokeWidth(Number(e.target.value))}
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
        <Btn variant="ghost" onClick={clearAll} style={{ fontSize: 12 }}>Clear</Btn>
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
    </Card>
  );
}

// ============================================================
// Scan Photos (embedded in PDF, grouped by confidence)
// ============================================================

const CONFIDENCE_ORDER = ['high', 'med', 'low'];
const CONFIDENCE_META = {
  high: { label: 'High confidence', color: c.green,  bg: c.greenBg },
  med:  { label: 'Medium confidence', color: c.amber, bg: c.amberBg },
  low:  { label: 'Low confidence',  color: c.red,   bg: c.redBg },
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

function AnnotatedImage({ src, annotations = [], style, alt }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  const redraw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const container = containerRef.current;
    if (!canvas || !img || !container) return;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;
    canvas.style.left = (imgRect.left - containerRect.left) + 'px';
    canvas.style.top = (imgRect.top - containerRect.top) + 'px';
    canvas.style.width = imgRect.width + 'px';
    canvas.style.height = imgRect.height + 'px';
    canvas.width = imgRect.width;
    canvas.height = imgRect.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotations.forEach(a => drawAnnotation(ctx, a, canvas.width, canvas.height));
  };

  useEffect(redraw, [annotations, src]);

  useEffect(() => {
    const handler = () => redraw();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [annotations]);

  return (
    <div ref={containerRef} style={{
      position: 'relative', display: 'block', lineHeight: 0, ...style,
    }}>
      <img ref={imgRef} src={src} alt={alt || 'Scan'}
        onLoad={redraw}
        style={{ display: 'block', width: '100%', height: 'auto' }} />
      <canvas ref={canvasRef} style={{
        position: 'absolute', pointerEvents: 'none',
      }} />
    </div>
  );
}

// ============================================================
// AnnotationEditor — full-screen modal canvas editor
// ============================================================

function AnnotationEditor({ photo, onSave, onClose }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [annotations, setAnnotations] = useState(() => [...(photo.annotations || [])]);
  const [tool, setTool] = useState('arrow');
  const [color, setColor] = useState('red');
  const [strokeScale, setStrokeScale] = useState(5); // 1..16, default = legacy
  const [anchor, setAnchor] = useState(null);   // first click (fractional)
  const [hover, setHover] = useState(null);     // mouse-move (fractional)
  const [drawingPath, setDrawingPath] = useState(null);  // active freehand stroke
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
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;
    canvas.style.left = (imgRect.left - containerRect.left) + 'px';
    canvas.style.top = (imgRect.top - containerRect.top) + 'px';
    canvas.style.width = imgRect.width + 'px';
    canvas.style.height = imgRect.height + 'px';
    canvas.width = imgRect.width;
    canvas.height = imgRect.height;
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
    if (tool !== 'freehand') return;
    e.preventDefault();
    const pt = getFractionalCoords(e);
    if (!pt) return;
    setDrawingPath([pt]);
  };

  const handleEnd = (e) => {
    if (tool !== 'freehand' || !drawingPath) return;
    e.preventDefault();
    if (drawingPath.length >= 2) {
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      pushAnnotation({ id, type: 'freehand', color, points: drawingPath, strokeScale });
    }
    setDrawingPath(null);
  };

  const handleClick = (e) => {
    if (tool === 'freehand') return;
    e.preventDefault();
    let pt = getFractionalCoords(e);
    if (!pt) return;
    // Shift snaps line/arrow endpoints to 15° increments
    if (e.shiftKey && anchor && (tool === 'line' || tool === 'arrow')) {
      pt = snapToAngle(anchor, pt, 15);
    }
    if (tool === 'text') {
      const content = prompt('Label text:', '');
      if (!content) return;
      pushAnnotation({
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'text', color, position: pt, content, fontSize: 14, strokeScale,
      });
      return;
    }
    if (!anchor) {
      setAnchor(pt);
      setHover(pt);
    } else {
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let ann = null;
      if (tool === 'arrow') {
        ann = { id, type: 'arrow', color, start: anchor, end: pt, strokeScale };
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
        <img
          ref={imgRef}
          src={photo.dataUrl}
          alt="scan"
          onLoad={redraw}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain', display: 'block', userSelect: 'none',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            touchAction: 'none',
            cursor: tool === 'text' ? 'text' : (tool === 'freehand' ? 'crosshair' : 'crosshair'),
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

      <div style={{
        padding: '10px 12px', background: c.bgRaised,
        borderTop: `1px solid ${c.borderStrong}`,
        display: 'flex', flexDirection: 'column', gap: 8,
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
                borderRadius: 6, padding: '8px 4px',
                color: tool === opt.id ? c.onAccentDim : c.text,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{opt.label}</button>
          ))}
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
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {ANNOTATION_COLORS.map(co => (
              <button key={co.id}
                onClick={() => setColor(co.id)}
                title={co.id}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: co.hex, cursor: 'pointer',
                  border: color === co.id ? `3px solid ${c.text}` : `1px solid ${c.border}`,
                }} />
            ))}
            <label title="Custom color"
              style={{
                position: 'relative', display: 'inline-flex',
                width: 28, height: 28, borderRadius: '50%',
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
        <div style={{ fontSize: 10.5, color: c.textFaint, textAlign: 'center', lineHeight: 1.45 }}>
          {tool === 'freehand'
            ? 'Press and drag to draw a smooth line. Release to finish.'
            : tool === 'text'
              ? 'Tap to place a text label.'
              : anchor
                ? `Tap to finish the ${tool}.${(tool === 'line' || tool === 'arrow') ? ' Hold Shift to snap to 15° angles.' : ''}`
                : `Tap to start the ${tool}.${(tool === 'line' || tool === 'arrow') ? ' Hold Shift while dragging for angle-snap.' : ''}`}
        </div>
      </div>
    </div>
  );
}

function ScanPhotos({ report, update }) {
  const fileInputRef = useRef(null);
  const cameraRef    = useRef(null);
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [dragPhotoId, setDragPhotoId] = useState(null);
  const [overPhotoId, setOverPhotoId] = useState(null);

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
    const loaded = await Promise.all(files.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      const detected = parseScanFilename(file.name || '');
      reader.onload = (ev) => resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl: ev.target.result,
        caption: '',
        confidence: 'high',
        pinRef: '',
        scanType: detected.scanType || 'site',
        locationRef: detected.locationRef || '',
        scaleInfo: detected.scaleInfo || '',
        panelGroup: '',
        panelLabel: '',
        annotations: [],
      });
      reader.readAsDataURL(file);
    })));
    update({ scanPhotos: [...report.scanPhotos, ...loaded] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const editingPhoto = report.scanPhotos.find(p => p.id === editingPhotoId);

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
      <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
        Add photos of the scanned area with markup, obstructions, or context shots.
        Each photo is grouped by confidence and embedded into the PDF.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
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

            {group.photos.map(photo => {
              const globalIdx = report.scanPhotos.findIndex(p => p.id === photo.id);
              const annotationCount = (photo.annotations || []).length;
              return (
                <div key={photo.id}
                  className={
                    'scan-photo-row' +
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
                  <div style={{
                    display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 7,
                  }}>
                    <div style={{ width: 84, flexShrink: 0 }}>
                      <AnnotatedImage
                        src={photo.dataUrl}
                        annotations={photo.annotations || []}
                        alt={photo.caption || 'Scan photo'}
                        style={{
                          width: 84, height: 84, overflow: 'hidden',
                          borderRadius: 4, border: `1px solid ${c.border}`,
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Textarea
                        value={photo.caption}
                        onChange={e => updatePhoto(photo.id, { caption: e.target.value })}
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
                  <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                    <Btn variant="primary" onClick={() => setEditingPhotoId(photo.id)}
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
                </div>
              );
            })}
          </div>
        );
      })}

      {editingPhoto && (
        <AnnotationEditor
          photo={editingPhoto}
          onSave={(annotations) => {
            updatePhoto(editingPhoto.id, { annotations });
            setEditingPhotoId(null);
          }}
          onClose={() => setEditingPhotoId(null)}
        />
      )}
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
      <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
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
                        src={p.dataUrl}
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
                  src={p.dataUrl}
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

  const handlePhoto = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateLoc(id, { photo: ev.target.result });
    reader.readAsDataURL(file);
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
      <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
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
                  title={loc.photo ? 'Click to edit / replace / annotate' : 'Click to add a photo'}
                >
                  {loc.photo ? (
                    <>
                      {(loc.photoAnnotations && loc.photoAnnotations.length > 0) ? (
                        <div style={{ position: 'absolute', inset: 0 }}>
                          <AnnotatedImage
                            src={loc.photo}
                            annotations={loc.photoAnnotations}
                            alt={loc.label}
                            style={{ width: '100%', height: '100%' }}
                          />
                        </div>
                      ) : (
                        <img src={loc.photo} alt={loc.label}
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
                            if (!loc.photo) { alert('Add a photo first, then annotate it.'); return; }
                            setAnnotLocId(loc.id);
                            setMenuLocId(null);
                          }}
                          style={photoMenuBtnStyle(c)}>
                          🖊<br /><span style={{ fontSize: 11 }}>Annotate</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!loc.photo) { setMenuLocId(null); return; }
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
                              src={p.dataUrl}
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
                    📷 {loc.photo ? 'Replace photo' : 'Add photo'}
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
        <div style={{
          padding: '14px', textAlign: 'center', fontSize: 12,
          color: c.textFaint, background: c.cardAlt, borderRadius: 6, marginBottom: 8,
        }}>
          No scan locations yet. Add one to build the side-by-side card.
        </div>
      )}

      <Btn onClick={addLocation} style={{ width: '100%' }}>+ Add scan location</Btn>

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
        if (!loc || !loc.photo) return null;
        return (
          <AnnotationEditor
            photo={{ dataUrl: loc.photo, annotations: loc.photoAnnotations || [] }}
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

export default function GSSIReportApp() {
  const [report, setReport] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? { ...DEFAULT_REPORT, ...JSON.parse(s) } : DEFAULT_REPORT;
    } catch { return DEFAULT_REPORT; }
  });

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ak_theme') || 'dark'; }
    catch { return 'dark'; }
  });

  // ---------- Auto-save status indicator ----------
  const [savedAt, setSavedAt] = useState(null);

  // Persist the working report on every change, stamp the save time, and
  // remember the sticky (repeat-every-job) fields for auto-fill on the next report.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
      setSavedAt(Date.now());
    } catch {}
    const sticky = {};
    STICKY_FIELDS.forEach(f => {
      if (report[f] !== undefined && report[f] !== '' && report[f] !== null) sticky[f] = report[f];
    });
    lsSet(AUTOFILL_KEY, { ...lsGet(AUTOFILL_KEY, {}), ...sticky });
  }, [report]);

  useEffect(() => {
    try { localStorage.setItem('ak_theme', theme); } catch {}
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

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

  // ---------- Named drafts (cross-report saved copies) ----------
  const [drafts, setDrafts] = useState(() => lsGet(DRAFTS_KEY, []));
  const [draftsOpen, setDraftsOpen] = useState(false);
  useEffect(() => { lsSet(DRAFTS_KEY, drafts); }, [drafts]);
  const saveNamedDraft = (name) => {
    const label = (name || '').trim() || report.projectNo || `Draft · ${new Date().toLocaleString()}`;
    const entry = { id: `d-${Date.now()}`, name: label, savedAt: Date.now(), report };
    setDrafts(d => [entry, ...d]);
    rememberRecents();
  };
  const loadDraft = (id) => {
    const d = drafts.find(x => x.id === id);
    if (d) { setReport({ ...DEFAULT_REPORT, ...d.report }); setDraftsOpen(false); }
  };
  const deleteDraft = (id) => setDrafts(d => d.filter(x => x.id !== id));

  // ---------- Customer / contact directory ----------
  const [contacts, setContacts] = useState(() => lsGet(CONTACTS_KEY, []));
  const [contactsOpen, setContactsOpen] = useState(false);
  useEffect(() => { lsSet(CONTACTS_KEY, contacts); }, [contacts]);
  const addContact = (ct) => setContacts(cs => [...cs, { id: `c-${Date.now()}`, name: '', email: '', company: '', note: '', ...ct }]);
  const updateContact = (id, patch) => setContacts(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeContact = (id) => setContacts(cs => cs.filter(c => c.id !== id));

  // ---------- Getting Started guide (opens automatically the first time) ----------
  const [helpOpen, setHelpOpen] = useState(() => {
    try { return !localStorage.getItem(HELP_SEEN_KEY); } catch { return false; }
  });
  const dismissHelp = () => {
    try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch {}
    setHelpOpen(false);
  };

  // ---------- Reset/refresh form (with save-first guard) ----------
  const [confirmReset, setConfirmReset] = useState(false);
  const doReset = () => {
    setReport(freshReport());
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
      '— Aggarwal Kamikazes Cutting & Coring Ltd',
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
  const openMailto = () => {
    rememberRecents();
    const url =
      `mailto:${encodeURIComponent(emailTo)}` +
      `?subject=${encodeURIComponent(emailSubject)}` +
      `&body=${encodeURIComponent(emailBody)}`;
    window.location.href = url;
    setEmailDialogOpen(false);
  };

  // Native share sheet (mobile): lets the user push the report into Mail, Messages,
  // etc. Optionally attaches the JSON backup as a real file when the platform allows it.
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const [shareNote, setShareNote] = useState('');
  const shareReport = async () => {
    rememberRecents();
    const payload = { title: emailSubject, text: emailBody };
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const file = new File(
        [blob],
        `gssi-${report.projectNo || 'draft'}-${report.scanDate}.json`,
        { type: 'application/json' },
      );
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
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
    { id: 'cadPage',        label: 'CAD-style drawing page (landscape)' },
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

  // CSS class to drop a section from print/preview while keeping it visible on
  // screen, plus a stable per-section hook used to drive the print order.
  const ph = (id) => `ak-sec ak-sec-${id}${vis(id) ? '' : ' print-hidden'}`;

  useEffect(() => {
    if (previewMode) document.body.classList.add('preview-mode');
    else document.body.classList.remove('preview-mode');
    return () => document.body.classList.remove('preview-mode');
  }, [previewMode]);

  const update = (patch) => setReport(r => ({ ...r, ...patch }));

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

  // ---------- Export ----------
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gssi-${report.projectNo || 'draft'}-${report.scanDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try { setReport({ ...DEFAULT_REPORT, ...JSON.parse(ev.target.result) }); }
      catch { alert('Invalid JSON'); }
    };
    r.readAsText(file);
  };

  const printPDF = () => { rememberRecents(); window.print(); };

  // Tier-based visibility
  const tier = report.tier;
  const showCalibration = tier !== 'quick';
  const showLimitations = tier !== 'quick';
  const showUncertainty = tier !== 'quick';
  const showFullEquipment = tier === 'full';

  return (
    <div className="ak-shell" style={{
      background: c.bg, minHeight: '100vh', color: c.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '14px 12px 100px', maxWidth: 720, margin: '0 auto',
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
            <button onClick={() => window.print()} style={{
              background: '#e02020', color: '#fff', border: '1px solid #e02020',
              borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
            }}>📄 Save / send PDF</button>
          </div>
        </div>
      )}
      <style>{`
        .print-only { display: none; }
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
        .scan-location-card.dragging,
        .scan-photo-row.dragging { opacity: 0.35; }
        .scan-location-card.drop-target,
        .scan-photo-row.drop-target {
          outline: 2px dashed #e02020;
          outline-offset: -2px;
        }
        /* Report body is a flex column so section print order can be set via
           CSS 'order'. Brand letterhead pins to the very top, footer to bottom. */
        .report-body { display: flex; flex-direction: column; }
        .report-body > .brand-ribbon  { order: -100; }
        .report-body > .brand-signoff { order: 100000; }
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
          @page cad { size: A4 landscape; margin: 1.0cm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .cad-page {
            page: cad;
            page-break-before: always;
            page-break-after: always;
            position: relative;
            padding: 6mm 8mm;
            border: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .cad-letterhead {
            display: grid;
            grid-template-columns: 60px 1fr auto;
            gap: 10px;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .cad-logo { width: 56px; height: auto; }
          .cad-company { font-size: 14pt; font-weight: 900; letter-spacing: 0.5px; }
          .cad-subtitle { font-size: 9pt; color: #444; letter-spacing: 1.5px; text-transform: uppercase; }
          .cad-letterhead-meta { font-size: 9pt; text-align: right; line-height: 1.3; color: #222; }
          .cad-body {
            display: grid;
            grid-template-columns: 1fr 240px;
            gap: 10px;
            height: calc(100% - 92mm);
            min-height: 130mm;
          }
          .cad-diagram { border: 1px solid #555; padding: 4px; }
          .cad-diagram canvas { width: 100% !important; height: auto !important; }
          .cad-notes { font-size: 8.5pt; line-height: 1.4; }
          .cad-notes-block { margin-bottom: 8px; }
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
            position: absolute;
            bottom: 6mm; right: 8mm;
            width: 70mm;
            border: 1.5px solid #000;
            font-size: 8pt;
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
        }
          input, select, textarea {
            border: 1px solid #ddd !important;
            background: white !important; color: black !important;
          }
          .legal-disclaimer-print {
            page-break-inside: avoid;
            break-inside: avoid;
            font-size: 9pt;
            line-height: 1.45;
            color: #000;
            border-top: 1px solid #999;
            margin-top: 12px;
            padding-top: 10px;
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
          }
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
          }
          .scan-photo-row img { max-width: 100% !important; height: auto !important; }

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
            border: 1px solid #999 !important;
            border-radius: 0 !important;
            margin-bottom: 14px;
          }
          .scan-location-card .loc-header {
            background: #e02020 !important;
            color: #fff !important;
            border-bottom: 1px solid #999;
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
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
          <button onClick={() => setDraftsOpen(true)}
            title="Saved drafts — keep multiple reports"
            aria-label="Saved drafts"
            style={{
              background: c.cardAlt, color: c.text,
              border: `1px solid ${c.borderStrong}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            📚 {drafts.length > 0 ? drafts.length : ''}
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
            <input type="file" accept=".json,application/json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
          </span>
        </div>

        {/* Logo centered as its own hero element (now carries the brand on its own) */}
        <img
          src="/kamikaze-logo.png"
          alt="Aggarwal Kamikazes Cutting & Coring Ltd"
          className="ak-logo"
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
        .ak-shell { max-width: 720px; }
        @media (min-width: 900px)  { .ak-shell { max-width: 820px; padding-left: 20px; padding-right: 20px; } }
        @media (min-width: 1200px) { .ak-shell { max-width: 920px; padding-left: 28px; padding-right: 28px; } }
        @media (max-width: 480px)  {
          .ak-shell { padding-left: 10px; padding-right: 10px; }
          .ak-header .ak-logo { height: 110px !important; }
        }
        @media print {
          .ak-shell { max-width: none !important; padding: 0 !important; }
        }
      `}</style>

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
          { id: 'enableCadPage',       label: 'CAD-style drawing page',     hint: 'Landscape engineered-drawing page with letterhead, notes column, and title block.' },
          { id: 'enableColorLegend',   label: 'Markup color key',           hint: 'Prints an APWA-aligned legend explaining what each annotation color means (rebar, PT cable, conduit, water, proposed core).' },
          { id: 'enableConfidenceBand', label: 'Overall confidence band',   hint: 'Adds a rolled-up confidence rating (the lowest per-core confidence governs) to the executive summary.' },
          { id: 'enableQR',            label: 'QR code on report',          hint: 'Stamps a scannable QR code on the report linking to the live report tool (or any URL you set below). Off by default.' },
          { id: 'brandFlourishes',     label: 'Brand flourishes',           hint: 'Adds a subtle Aggarwal Kamikazes ribbon at the top of the printed report and a small "signed by the crew" line at the bottom. Off by default so reviewers see a clean professional document.' },
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
        {report.enableQR && (
          <div style={{ marginTop: 6 }}>
            <Field label="QR code links to" hint="Pasted onto the report when QR code is on. Default points to the live report tool.">
              <Input value={report.qrUrl} onChange={e => update({ qrUrl: e.target.value })} placeholder="https://scan-report.vercel.app" />
            </Field>
          </div>
        )}
      </Card>

      {/* === PRINT SETUP (per-section include/exclude + preview) === */}
      <Card title="Print setup · sections, order & visibility" dense className="no-print">
        <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
          Tick which sections appear in the PDF, and use ▲▼ to set the order they print in.
          The Preview button shows exactly what will print before you save or send.
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
            return (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 6px', borderRadius: 4,
                background: on ? c.cardAlt : 'transparent',
                fontSize: 11, color: on ? c.text : c.textFaint,
              }}>
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

      {/* Per-section print order, driven by report.sectionOrder */}
      <style>{
        effectiveOrder.map((id, i) => `.ak-sec-${id}{order:${i};}`).join('')
      }</style>

      {/* === REPORT BODY (flex column; section order set via CSS) === */}
      <div className="report-body">

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

      {/* === BRAND FLOURISH RIBBON (print/preview only, opt-in) === */}
      {report.brandFlourishes && (
        <div className="print-only brand-ribbon">
          <img src="/kamikaze-logo.png" alt="" className="brand-ribbon-mark" />
          <div className="brand-ribbon-text">
            <div className="brand-ribbon-title">Aggarwal Kamikazes Cutting &amp; Coring Ltd</div>
            <div className="brand-ribbon-tagline">{BRAND_TAGLINE}</div>
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
        {report.enableQR && report.qrUrl && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 10,
            paddingTop: 10, borderTop: `1px solid ${c.border}`,
          }}>
            <div style={{ background: '#fff', padding: 6, borderRadius: 6, flexShrink: 0 }}>
              <QRCode value={report.qrUrl} size={96} />
            </div>
            <div style={{ fontSize: 11.5, color: c.textDim, lineHeight: 1.5 }}>
              <strong style={{ color: c.text }}>Scan to open the live report tool.</strong><br/>
              Point any phone camera at the code.
            </div>
          </div>
        )}
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
      <Card title="Targets identified" className={ph('targets')} badge={
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
                    <span style={{
                      background: c.cardAlt, padding: '2px 7px', borderRadius: 4,
                      fontSize: 11, fontWeight: 600, color: c.text, minWidth: 38, textAlign: 'center',
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
                    <Btn variant="ghost" onClick={() => moveTarget(i, -1)} disabled={i === 0}
                      title="Move up" style={{ padding: '4px 7px', fontSize: 12, opacity: i === 0 ? 0.35 : 1 }}>▲</Btn>
                    <Btn variant="ghost" onClick={() => moveTarget(i, 1)} disabled={i === report.targets.length - 1}
                      title="Move down" style={{ padding: '4px 7px', fontSize: 12, opacity: i === report.targets.length - 1 ? 0.35 : 1 }}>▼</Btn>
                    <Btn variant="ghost" onClick={() => removeTarget(i)} style={{ padding: '4px 9px', fontSize: 12 }}>✕</Btn>
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
              <Field label="Notes (overall cover commentary)">
                <Textarea value={cs.note || ''} onChange={e => set('note', e.target.value)}
                  style={{ minHeight: 56 }} />
              </Field>

              {/* Print summary block */}
              <div className="print-only cover-summary-print" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
                  COVER THICKNESS SUMMARY
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', color: '#000' }}>
                  <thead>
                    <tr>
                      <th>Mat</th><th>Min cover</th><th>Avg cover</th><th>Target cover</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Top</td><td>{topMin || '—'}</td><td>{topAvg || '—'}</td><td>{cs.topTarget || '—'}</td>
                    </tr>
                    <tr>
                      <td>Bottom</td><td>{botMin || '—'}</td><td>{botAvg || '—'}</td><td>{cs.botTarget || '—'}</td>
                    </tr>
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

      {/* === SITE DIAGRAM === */}
      <div className={ph('diagram')}>
        <SiteDiagram report={report} update={update} />
      </div>

      {/* === DRAWING NOTES (CAD page) === */}
      {report.enableCadPage && (
        <Card title="Drawing notes (CAD page)" className={ph('drawingNotes')}>
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
            Project-specific notes that print in the right-side column of the landscape
            CAD page. Use one paragraph per zone or finding.
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
        <Card title="Markup color key" dense>
          <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 8, lineHeight: 1.5 }}>
            Aligned to the APWA Uniform Color Code (utility-locating standard) plus concrete-scanning convention.
            Colors below match the annotation presets used on the scan photos.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
            {APWA_LEGEND.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: c.text }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                  background: item.color, border: '1px solid rgba(128,128,128,0.4)',
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
        <Card title="Zones" className={ph('zones')}>
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
            <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
              PROPOSED CORE SCHEDULE
            </div>
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
        {report.cores.map((co, i) => {
          const v = {
            safe:    { color: c.green, bg: c.greenBg, label: '✓ Safe to drill' },
            caution: { color: c.amber, bg: c.amberBg, label: '⚠ Caution' },
            nogo:    { color: c.red,   bg: c.redBg,   label: '✕ Do not drill' },
          }[co.verdict];
          return (
            <div key={i} style={{
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
                <div style={{ display: 'flex', gap: 4 }}>
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
        <Btn onClick={addCore} style={{ width: '100%' }}>+ Add core location</Btn>
      </Card>

      {/* === UNCERTAINTY ZONES (standard + full only) === */}
      {showUncertainty && (
        <Card title="Areas of uncertainty" className={ph('uncertainty')}>
          <Field label="Daylighting recommended in" hint="Per Terraprobe-style practice — call out zones where GPR resolution is insufficient for definitive interpretation.">
            <Textarea
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
            <Field label="Override (leave blank to use auto-generated)">
              <Textarea value={report.methodsOverride || ''}
                onChange={e => update({ methodsOverride: e.target.value })}
                style={{ minHeight: 80 }}
                placeholder={auto} />
            </Field>
            <div className="print-only methods-print" style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
                METHODS
              </div>
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
        </Card>
      )}

      {/* === STANDARD NOTES (Xradar-style numbered general notes) === */}
      {report.enableStandardNotes && (
        <Card title="Standard notes" className={ph('standardNotes')}>
          <div className="no-print" style={{ fontSize: 11, color: c.textFaint, marginBottom: 9, lineHeight: 1.5 }}>
            Numbered general notes printed alongside the drawing (CAD page) or as a
            standalone block before the legal disclaimer.
          </div>
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
            <img src="/kamikaze-logo.png" alt="" className="cad-logo" />
            <div className="cad-letterhead-text">
              <div className="cad-company">Aggarwal Kamikazes Cutting &amp; Coring Ltd</div>
              <div className="cad-subtitle">GPR Concrete Scan — Drawing</div>
            </div>
            <div className="cad-letterhead-meta">
              <div>Project: <strong>{report.projectNo || '—'}</strong></div>
              <div>Date: <strong>{report.scanDate || '—'}</strong></div>
            </div>
          </div>
          <div className="cad-body">
            <div className="cad-diagram">
              <DiagramSnapshot report={report} width={1100} height={750} />
            </div>
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

        <div style={{
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
            padding: 12, textAlign: 'center', marginTop: 8,
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
      </Card>

      {/* === BRAND FLOURISH FOOTER SIGNATURE (print/preview only, opt-in) === */}
      {report.brandFlourishes && (
        <div className="print-only brand-signoff">
          Prepared with care by the AKCC crew · {BRAND_TAGLINE}
        </div>
      )}

      </div>{/* === END REPORT BODY === */}

      {/* === ACTIONS === */}
      <div className="no-print" style={{
        position: 'sticky', bottom: 10,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
        background: c.bg, padding: '10px 0 0',
      }}>
        <Btn variant="primary" onClick={printPDF}>📄 PDF</Btn>
        <Btn onClick={() => setEmailDialogOpen(true)}>📧 Email</Btn>
        <Btn onClick={exportJSON}>💾 Save draft</Btn>
      </div>

      <div style={{ fontSize: 10, color: c.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
        Tier: <strong style={{ color: c.textDim, textTransform: 'capitalize' }}>{tier}</strong><br/>
        GSSI StructureScan Mini XT · British Columbia engineering edition
      </div>

      <Assistant report={report} update={update} />

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
              Opens your default mail app with a draft pre-filled from the project info.
              <strong style={{ color: c.amberStrong }}> Browsers can't auto-attach the PDF</strong> —
              tap 📄 PDF first, save it, then attach the file after the email opens.
            </div>

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
              <Btn variant="ghost" onClick={() => { printPDF(); }}
                title="Triggers Save as PDF — keep this dialog open while you save">
                📄 Save PDF first
              </Btn>
              <Btn variant="primary" onClick={openMailto}>
                ✉ Open Email
              </Btn>
            </div>
            {canShare && (
              <Btn onClick={shareReport} style={{ width: '100%', marginTop: 6 }}
                title="Open your device's share menu (Mail, Messages, etc.) with this draft and a backup file attached">
                📤 Share · attaches backup file
              </Btn>
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
      {draftsOpen && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setDraftsOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: c.bgRaised, border: `1px solid ${c.borderStrong}`,
            borderRadius: 10, padding: 18,
            width: 'min(520px, 100%)', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 4 }}>
              📚 Saved drafts
            </div>
            <div style={{ fontSize: 11, color: c.textDim, marginBottom: 14, lineHeight: 1.5 }}>
              Keep multiple reports on this device. Saving snapshots the current report;
              loading replaces what's on screen (the live report auto-saves separately).
            </div>
            <Btn variant="primary" onClick={() => saveNamedDraft()} style={{ width: '100%', marginBottom: 12 }}>
              ＋ Save current report as a draft
            </Btn>
            {drafts.length === 0 ? (
              <div style={{
                padding: 14, textAlign: 'center', fontSize: 12, color: c.textFaint,
                background: c.cardAlt, borderRadius: 6,
              }}>No saved drafts yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {drafts.map(d => (
                  <div key={d.id} style={{
                    border: `1px solid ${c.border}`, borderRadius: 6, padding: 9, background: c.cardAlt,
                  }}>
                    <Input value={d.name}
                      onChange={e => setDrafts(list => list.map(x => x.id === d.id ? { ...x, name: e.target.value } : x))}
                      style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }} />
                    <div style={{ fontSize: 10.5, color: c.textFaint, marginBottom: 7 }}>
                      Saved {new Date(d.savedAt).toLocaleString()}
                      {(d.report?.targets?.length || 0) > 0 && ` · ${d.report.targets.length} target${d.report.targets.length === 1 ? '' : 's'}`}
                      {(d.report?.cores?.length || 0) > 0 && ` · ${d.report.cores.length} core${d.report.cores.length === 1 ? '' : 's'}`}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                      <Btn variant="primary" onClick={() => loadDraft(d.id)} style={{ fontSize: 12 }}>
                        📂 Load
                      </Btn>
                      <Btn variant="ghost" onClick={() => deleteDraft(d.id)}
                        style={{ fontSize: 12, borderColor: c.red, color: c.red }}>
                        🗑 Delete
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Btn variant="ghost" onClick={() => setDraftsOpen(false)} style={{ width: '100%', marginTop: 12 }}>
              Close
            </Btn>
          </div>
        </div>
      )}

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

      {/* === GETTING STARTED GUIDE === */}
      {helpOpen && (
        <div className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 250,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={dismissHelp}>
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
                icon: '✓', title: 'Your work saves itself',
                body: 'Everything you type is saved automatically on this computer, in this web browser. ' +
                      'You can close the tab and come back later — it will still be here. The green ' +
                      '“✓ Saved” tag at the top shows the last time it saved.',
              },
              {
                icon: '📚', title: 'Keep more than one report',
                body: 'Click 📚 (top of the screen) to save a snapshot of the current report and start a ' +
                      'fresh one. Open 📚 again any time to load an older report back up.',
              },
              {
                icon: '💾', title: 'Save a backup file to your computer',
                body: 'Click “💾 Save draft” at the bottom. Your browser downloads a small backup file ' +
                      '(its name ends in .json). Keep it in a project folder. To open it again later — ' +
                      'on this computer or a different one — click “📂 Load” at the top and pick that file.',
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

            <Btn variant="primary" onClick={dismissHelp} style={{ width: '100%', marginTop: 4, padding: '11px 12px', fontWeight: 700 }}>
              Got it — let’s go
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
