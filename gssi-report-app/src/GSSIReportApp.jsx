import React, { useState, useRef, useEffect, useMemo } from 'react';

// ============================================================
// GSSI StructureScan Mini XT — Scan Report Builder v2
// BC-tuned · Tiered deliverables · Executive summary first
// Modeled on Terraprobe / EGBC practice expectations
// ============================================================

const STORAGE_KEY = 'gssi_report_v2';

const DEFAULT_REPORT = {
  // Tier
  tier: 'standard',  // quick | standard | full

  // Revision
  rev: '0',
  revNotes: '',

  // Assistant UI
  assistantOn: true,

  // Cover
  projectNo: '',
  scanDate: new Date().toISOString().slice(0, 10),
  client: '',
  siteAddress: '',
  scanArea: '',
  weather: '',
  surface: 'Dry',

  // Slab context (engineers always check these)
  slabType: 'SOG',       // SOG | Suspended | PT | Topping
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
  coveragePolygon: { points: [] },  // scan coverage area (canvas coords)

  // Rebar mat summary (engineers use to back-calc slab capacity)
  rebarSummary: {
    topBarSize: '', topSpacing: '', topCover: '',
    bottomBarSize: '', bottomSpacing: '', bottomCover: '',
    notes: '',
  },

  // Cores
  cores: [],

  // NEW: Areas of uncertainty (Terraprobe-style)
  uncertaintyZones: '',

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

  // Marking colours — must match the scanner's chalk on the slab. Editable + addable;
  // these drive the site-diagram draw tools and the report legend so there's one colour key.
  markings: [
    { key: 'rebar',   label: 'Rebar',          color: '#FAC775' },
    { key: 'pt',      label: 'PT cable',        color: '#F09595' },
    { key: 'conduit', label: 'Conduit',        color: '#9BC5E8' },
    { key: 'note',    label: 'Note / other',   color: '#5DCAA5' },
  ],
  // Scan-photo display size in the cards (percent)
  photoScale: 100,
};

// ============================================================
// Design tokens — refined Vancouver-engineering palette
// Dark slate + steel + safety colors. Not PoE this time —
// more "engineering firm letterhead", clean and serious.
// ============================================================

const c = {
  bg: '#0f1419',
  bgRaised: '#161c23',
  card: '#1c232c',
  cardAlt: '#232b35',
  border: '#2a333e',
  borderStrong: '#3a4553',
  text: '#e6edf3',
  textDim: '#8a96a3',
  textFaint: '#5d6874',
  accent: '#7aa2c8',       // steel — v2 accent (lightened slate for the dark UI)
  accentDim: '#314c68',
  accent2: '#a9caea',      // brighter steel for highlights/focus rings
  green: '#3fb950',
  greenBg: '#0d2818',
  greenStrong: '#56d364',
  amber: '#d29922',
  amberBg: '#2a1f08',
  amberStrong: '#e3b341',
  red: '#f85149',
  redBg: '#2a1010',
  redStrong: '#ff7b72',
};

// ============================================================
// UI Primitives
// ============================================================

const Card = ({ title, badge, children, dense, accent, id }) => (
  <div id={id} style={{
    background: c.card,
    border: `1px solid ${accent ? c.accent : c.border}`,
    borderRadius: 10,
    padding: dense ? 12 : 14,
    marginBottom: 12,
    scrollMarginTop: 16,
    ...(accent && { boxShadow: `0 0 0 1px ${c.accentDim}` }),
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
    primary: { bg: c.accentDim, bd: c.accent, fg: '#fff' },
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
      </div>
    </Card>
  );
}

// ============================================================
// Image helper: downscale to keep localStorage under control
// ============================================================
function downscaleImage(file, maxDim = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(ev.target.result);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

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
      (co.note + ' ' + co.clearance).toLowerCase().includes('pt') ||
      (co.note + ' ' + co.clearance).toLowerCase().includes('tendon')
    );
    need(!hasPtNote && report.cores.length > 0, 'high',
      'PT slab: at least one core should explicitly call out the tendon exclusion zone (e.g. "no cores within 300 mm of tendon band").');
    const hasPtTarget = (report.targets || []).some(t => t.type && t.type.includes('PT'));
    need(!hasPtTarget && report.targets.length > 0, 'med',
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
  need(report.cores.length > 0 && report.diagramPins.length === 0, 'med',
    'You have core verdicts but no pins on the diagram. Pin each core location so the crew can find them.');
  need(report.cores.length > report.diagramPins.length && report.diagramPins.length > 0, 'low',
    `${report.cores.length - report.diagramPins.length} core(s) without a matching pin on the diagram.`);

  // Pin datum references
  const pinsMissingDatum = (report.diagramPins || []).filter(p => !p.datumA && !p.datumB);
  need(pinsMissingDatum.length > 0, 'med',
    `${pinsMissingDatum.length} pin(s) missing datum offset. Chalk washes off — add at least one measured offset per pin.`);

  // Drill envelope on safe cores
  const safeUnscoped = (report.cores || []).filter(co =>
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

  // Found nothing? Praise.
  if (tips.length === 0) {
    return [{ level: 'ok', text: 'Report looks complete. Print to PDF when ready.' }];
  }
  // Sort high → low
  const order = { high: 0, med: 1, low: 2, ok: 3 };
  tips.sort((a, b) => order[a.level] - order[b.level]);
  return tips;
}

function Assistant({ report, update }) {
  const [collapsed, setCollapsed] = useState(false);
  const tips = useMemo(() => getAssistantTips(report), [report]);
  if (!report.assistantOn) return null;

  const tone = {
    high: { bd: c.red, bg: c.redBg, fg: c.redStrong, icon: '⚠' },
    med:  { bd: c.amber, bg: c.amberBg, fg: c.amberStrong, icon: '•' },
    low:  { bd: c.border, bg: c.cardAlt, fg: c.textDim, icon: '·' },
    ok:   { bd: c.green, bg: c.greenBg, fg: c.greenStrong, icon: '✓' },
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
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: 8 }}>
          {tips.map((t, i) => {
            const s = tone[t.level];
            return (
              <div key={i} style={{
                background: s.bg, borderLeft: `3px solid ${s.bd}`,
                padding: '7px 9px', marginBottom: 6, borderRadius: '0 6px 6px 0',
                fontSize: 12, color: c.text, lineHeight: 1.4,
              }}>
                <span style={{ color: s.fg, fontWeight: 700, marginRight: 6 }}>{s.icon}</span>
                {t.text}
              </div>
            );
          })}
        </div>
      )}
    </div>
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

function SiteDiagram({ report, update, setReport }) {
  const update_pin_gps = (idx, gps) => {
    setReport(r => {
      if (!r.diagramPins[idx]) return r;
      const next = [...r.diagramPins];
      next[idx] = { ...next[idx], gps };
      return { ...r, diagramPins: next };
    });
  };
  const updatePinField = (idx, patch) => {
    setReport(r => {
      if (!r.diagramPins[idx]) return r;
      const next = [...r.diagramPins];
      next[idx] = { ...next[idx], ...patch };
      return { ...r, diagramPins: next };
    });
  };

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('pin');
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);

  // colours come from the editable report markings (one source of truth)
  const toolColors = {};
  (report.markings || []).forEach(m => { toolColors['draw-' + m.key] = m.color; });

  const coveragePoints = report.coveragePolygon?.points || [];

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Coverage polygon (under everything else)
    if (coveragePoints.length >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(coveragePoints[0].x, coveragePoints[0].y);
      coveragePoints.forEach(p => ctx.lineTo(p.x, p.y));
      if (tool !== 'coverage' && coveragePoints.length >= 3) ctx.closePath();
      ctx.fillStyle = 'rgba(74, 158, 255, 0.18)';
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.setLineDash(tool === 'coverage' ? [6, 4] : []);
      if (coveragePoints.length >= 3) ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      // Vertex dots while editing
      if (tool === 'coverage') {
        coveragePoints.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#4a9eff';
          ctx.fill();
        });
      }
      ctx.restore();
    }

    report.diagramStrokes.forEach(s => {
      if (s.points.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.color === '#F09595' ? 4 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    if (currentStroke && currentStroke.points.length >= 2) {
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.color === '#F09595' ? 4 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentStroke.points[0].x, currentStroke.points[0].y);
      currentStroke.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }

    report.diagramPins.forEach(pin => {
      const vc = {
        safe:    { fill: '#3fb950', stroke: '#0d2818', text: '#fff' },
        caution: { fill: '#d29922', stroke: '#2a1f08', text: '#fff' },
        nogo:    { fill: '#f85149', stroke: '#2a1010', text: '#fff' },
      }[pin.verdict] || { fill: '#888', stroke: '#000', text: '#fff' };

      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = vc.fill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = vc.stroke;
      ctx.stroke();
      ctx.fillStyle = vc.text;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pin.label, pin.x, pin.y);
    });
  };

  useEffect(redraw, [report.diagramStrokes, report.diagramPins, report.coveragePolygon, currentStroke, tool]);

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
      const newPin = {
        x: pt.x, y: pt.y, label: nextLabel, verdict: n,
        ts: new Date().toISOString(),
        gps: null,
        datumA: '',
        datumB: '',
      };
      update({ diagramPins: [...report.diagramPins, newPin] });
      // Try to capture GPS in the background (non-blocking)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const idx = report.diagramPins.length; // index of the just-added pin
            const gps = {
              lat: +pos.coords.latitude.toFixed(6),
              lng: +pos.coords.longitude.toFixed(6),
              acc: Math.round(pos.coords.accuracy),
            };
            // Read latest pins from a state setter to avoid stale closure
            update_pin_gps(idx, gps);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
      }
    } else if (tool === 'coverage') {
      update({
        coveragePolygon: { points: [...coveragePoints, pt] },
      });
    } else if (tool.startsWith('draw-')) {
      setDrawing(true);
      setCurrentStroke({ color: toolColors[tool], points: [pt] });
    }
  };

  const handleMove = (e) => {
    if (!drawing || !currentStroke) return;
    e.preventDefault();
    const pt = getCoords(e);
    setCurrentStroke(s => ({ ...s, points: [...s.points, pt] }));
  };

  const handleEnd = () => {
    if (drawing && currentStroke && currentStroke.points.length > 1) {
      update({ diagramStrokes: [...report.diagramStrokes, currentStroke] });
    }
    setDrawing(false);
    setCurrentStroke(null);
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update({ diagramImage: ev.target.result });
    reader.readAsDataURL(file);
  };

  const undo = () => {
    if (report.diagramPins.length > 0) {
      update({ diagramPins: report.diagramPins.slice(0, -1) });
    } else if (report.diagramStrokes.length > 0) {
      update({ diagramStrokes: report.diagramStrokes.slice(0, -1) });
    }
  };

  const clearAll = () => {
    if (confirm('Clear all sketches, pins, and coverage?')) {
      update({ diagramStrokes: [], diagramPins: [], coveragePolygon: { points: [] } });
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
            Tap Photo to add site image<br/>or draw on the blank canvas
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
        {toolBtn('coverage', '▢ Coverage', c.accent)}
        {toolBtn('draw-rebar', 'Rebar', '#FAC775')}
        {toolBtn('draw-pt', 'PT cable', '#F09595')}
        {toolBtn('draw-conduit', 'Conduit', '#9BC5E8')}
        {toolBtn('draw-note', 'Note', '#5DCAA5')}
      </div>
      {tool === 'coverage' && (
        <div style={{
          background: c.accentDim, color: '#fff',
          borderRadius: 6, padding: '7px 10px', fontSize: 12, marginBottom: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>Tap to add vertices · {coveragePoints.length} so far</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <Btn onClick={() => update({ coveragePolygon: { points: coveragePoints.slice(0, -1) } })}
              style={{ fontSize: 11, padding: '4px 8px' }}>↶</Btn>
            <Btn onClick={() => { setTool('pin'); }}
              variant="primary" style={{ fontSize: 11, padding: '4px 8px' }}>Done</Btn>
            <Btn onClick={() => update({ coveragePolygon: { points: [] } })}
              variant="ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#fff' }}>Clear</Btn>
          </span>
        </div>
      )}
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
          <span style={{ color: c.green }}>● Safe</span>
          <span style={{ color: c.amber }}>● Caution</span>
          <span style={{ color: c.red }}>● No drill</span>
          <span><span style={{
            display: 'inline-block', width: 12, height: 8,
            background: 'rgba(74, 158, 255, 0.35)', border: `1px solid ${c.accent}`,
            marginRight: 3, verticalAlign: 'middle',
          }} /> Scanned area</span>
        </div>
      </div>

      {report.diagramPins.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontSize: 10.5, color: c.textDim, marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
          }}>Pin references (datum offsets)</div>
          {report.diagramPins.map((p, i) => {
            const vc = p.verdict === 'safe' ? c.green : p.verdict === 'caution' ? c.amber : c.red;
            const ts = p.ts ? new Date(p.ts) : null;
            return (
              <div key={i} style={{
                border: `1px solid ${c.border}`, borderRadius: 6,
                padding: 8, marginBottom: 6, background: c.cardAlt,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    background: vc, color: '#fff', minWidth: 26, height: 22,
                    borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12,
                  }}>{p.label}</span>
                  <span style={{ fontSize: 11, color: c.textDim }}>
                    {ts ? ts.toLocaleString() : '—'}
                  </span>
                  {p.gps && (
                    <span style={{ fontSize: 10.5, color: c.textFaint, marginLeft: 'auto' }}>
                      📍 {p.gps.lat.toFixed(5)}, {p.gps.lng.toFixed(5)} ±{p.gps.acc}m
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Input placeholder='Offset A (e.g. 1.2 m W of col C-4)'
                    value={p.datumA || ''}
                    onChange={e => updatePinField(i, { datumA: e.target.value })}
                    style={{ padding: '6px 9px', fontSize: 12 }} />
                  <Input placeholder='Offset B (e.g. 0.8 m N of wall)'
                    value={p.datumB || ''}
                    onChange={e => updatePinField(i, { datumB: e.target.value })}
                    style={{ padding: '6px 9px', fontSize: 12 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Main App
// ============================================================

export default function GSSIReportApp() {
  const [report, setReport] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? { ...DEFAULT_REPORT, ...JSON.parse(s) } : DEFAULT_REPORT;
    } catch { return DEFAULT_REPORT; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(report)); } catch {}
  }, [report]);

  const update = (patch) => setReport(r => ({ ...r, ...patch }));

  // ---------- Targets ----------
  const addTarget = () => update({
    targets: [...report.targets, {
      id: `T-${String(report.targets.length + 1).padStart(2, '0')}`,
      type: 'Rebar (top mat)', depth: '', cover: '',
      note: '', confidence: 'high', bscanImage: null,
    }],
  });
  const updateTarget = (i, patch) => {
    const next = [...report.targets];
    next[i] = { ...next[i], ...patch };
    update({ targets: next });
  };
  const removeTarget = (i) => update({ targets: report.targets.filter((_, j) => j !== i) });

  // ---------- Cores ----------
  const addCore = () => update({
    cores: [...report.cores, {
      label: String.fromCharCode(65 + report.cores.length),
      size: '4"', verdict: 'safe', clearance: '', note: '',
      drillDia: '', drillMaxDepth: '', photo: null,
    }],
  });
  const updateCore = (i, patch) => {
    const next = [...report.cores];
    next[i] = { ...next[i], ...patch };
    update({ cores: next });
  };
  const removeCore = (i) => update({ cores: report.cores.filter((_, j) => j !== i) });
  // downscale phone photos so several fit in localStorage (~5 MB cap)
  const downscalePhoto = (file, maxDim, cb) => {
    const r = new FileReader();
    r.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(canvas.toDataURL('image/jpeg', 0.82)); }
        catch { cb(ev.target.result); }
      };
      img.onerror = () => cb(ev.target.result);
      img.src = ev.target.result;
    };
    r.readAsDataURL(file);
  };
  const readCorePhoto = (i, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    downscalePhoto(file, 1280, (dataUrl) => updateCore(i, { photo: dataUrl }));
    e.target.value = '';
  };

  // ---------- Marking colours (match the chalk on the slab) ----------
  const updateMarking = (i, patch) => {
    const next = [...(report.markings || [])];
    next[i] = { ...next[i], ...patch };
    update({ markings: next });
  };
  const addMarking = () => update({
    markings: [...(report.markings || []), { key: 'm' + Math.random().toString(36).slice(2, 7), label: 'New marking', color: '#cccccc' }],
  });
  const removeMarking = (i) => update({ markings: (report.markings || []).filter((_, j) => j !== i) });

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

  const printPDF = () => window.print();

  // Tier-based visibility
  const tier = report.tier;
  const showCalibration = tier !== 'quick';
  const showLimitations = tier !== 'quick';
  const showUncertainty = tier !== 'quick';
  const showFullEquipment = tier === 'full';

  return (
    <div style={{
      background: c.bg, minHeight: '100vh', color: c.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '14px 14px 100px', maxWidth: 1180, margin: '0 auto',
    }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          input, select, textarea {
            border: 1px solid #ddd !important;
            background: white !important; color: black !important;
          }
        }
        input::placeholder, textarea::placeholder { color: ${c.textFaint}; }
        input:focus, textarea:focus, select:focus {
          outline: none; border-color: ${c.accent};
        }
        /* === direction-3 responsive workspace shell === */
        .ws-grid { display: grid; grid-template-columns: 178px 1fr 220px; gap: 16px; align-items: start; }
        .ws-nav, .ws-rail { position: sticky; top: 12px; align-self: start; }
        .ws-nav .ni {
          display: block; width: 100%; text-align: left; background: transparent;
          border: 0; border-left: 3px solid transparent; color: ${c.textDim};
          font: inherit; font-size: 12.5px; padding: 7px 11px; border-radius: 0 7px 7px 0;
          cursor: pointer; margin-bottom: 1px; transition: background .12s, color .12s, border-color .12s;
        }
        .ws-nav .ni:hover { background: ${c.cardAlt}; color: ${c.text}; border-left-color: ${c.accent}; }
        .ws-nav .sep { font-size: 9px; font-weight: 800; letter-spacing: .12em; color: ${c.textFaint};
          text-transform: uppercase; margin: 14px 0 5px 11px; }
        .ws-nav .sep:first-child { margin-top: 0; }
        @media (max-width: 900px) {
          .ws-grid { grid-template-columns: 1fr; }
          .ws-nav { display: none; }
          .ws-rail { position: static; }
        }
        @media print { .ws-grid { display: block; } .ws-nav, .ws-rail { display: none !important; } }
      `}</style>

      {/* === HEADER === */}
      <div className="no-print" style={{
        marginBottom: 14, paddingBottom: 12,
        borderBottom: `1px solid ${c.borderStrong}`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, color: c.accent, letterSpacing: 2, fontWeight: 700, marginBottom: 2 }}>
            GPR SCAN REPORT · BC EDITION
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>
            GSSI StructureScan Mini XT
          </h1>
          <div style={{ fontSize: 11, color: c.textFaint, marginTop: 4 }}>
            Engineers and Geoscientists BC · standard practice
          </div>
        </div>
        <button
          onClick={() => update({ assistantOn: !report.assistantOn })}
          title={report.assistantOn ? 'Hide assistant' : 'Show assistant'}
          style={{
            background: report.assistantOn ? c.accentDim : c.cardAlt,
            color: report.assistantOn ? '#fff' : c.textDim,
            border: `1px solid ${report.assistantOn ? c.accent : c.border}`,
            borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >🤖 Assistant {report.assistantOn ? 'On' : 'Off'}</button>
      </div>

      <div className="ws-grid">
        <nav className="ws-nav no-print">
          <div className="sep">Report</div>
          {[
            ['sec-project', 'Project'], ['sec-slab', 'Slab context'], ['sec-targets', 'Targets'],
            ['sec-rebar', 'Rebar mat'], ['sec-settings', 'Markings & photos'], ['sec-cores', 'Core verdicts'],
            ['sec-equip', 'Equipment'], ['sec-signoff', 'Sign-off'],
          ].map(([sid, label]) => (
            <button key={sid} className="ni" type="button"
              onClick={() => { const el = document.getElementById(sid); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              {label}
            </button>
          ))}
        </nav>
        <div className="ws-main">

      {/* === TIER PICKER === */}
      <Card title="Report tier" dense>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            { id: 'quick', label: 'Quick Mark', sub: 'Field 1-pg' },
            { id: 'standard', label: 'Standard', sub: 'Engineer review' },
            { id: 'full', label: 'Full', sub: 'Regulatory' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => update({ tier: t.id })}
              style={{
                background: tier === t.id ? c.accentDim : c.cardAlt,
                border: `1px solid ${tier === t.id ? c.accent : c.border}`,
                borderRadius: 6, padding: '8px 4px', cursor: 'pointer',
                color: tier === t.id ? '#fff' : c.text,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: tier === t.id ? '#fff' : c.textDim, marginTop: 2 }}>{t.sub}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* === EXECUTIVE SUMMARY (always at top) === */}
      <ExecutiveSummary report={report} />

      {/* === COVER === */}
      <Card id="sec-project" title="Project info">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <Field label="Project number">
            <Input value={report.projectNo} onChange={e => update({ projectNo: e.target.value })} placeholder="VAN-2026-0341" />
          </Field>
          <Field label="Revision" hint="Bump on every reissue">
            <Input value={report.rev} onChange={e => update({ rev: e.target.value })} placeholder="0" />
          </Field>
        </div>
        {report.rev && report.rev !== '0' && (
          <Field label="Changes since last rev">
            <Textarea value={report.revNotes}
              onChange={e => update({ revNotes: e.target.value })}
              placeholder="e.g. Rev 1: added cores E & F after slab demo; updated PT exclusion zone."
              style={{ minHeight: 48 }} />
          </Field>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Scan date">
            <Input type="date" value={report.scanDate} onChange={e => update({ scanDate: e.target.value })} />
          </Field>
          <Field label="Weather">
            <Input value={report.weather} onChange={e => update({ weather: e.target.value })} placeholder="15°C overcast" />
          </Field>
        </div>
        <Field label="Client">
          <Input value={report.client} onChange={e => update({ client: e.target.value })} placeholder="Client name" />
        </Field>
        <Field label="Site address">
          <Input value={report.siteAddress} onChange={e => update({ siteAddress: e.target.value })} placeholder="1055 W Georgia, Vancouver BC" />
        </Field>
        <Field label="Scan area / description">
          <Input value={report.scanArea} onChange={e => update({ scanArea: e.target.value })} placeholder="P2 parkade slab, grid C4" />
        </Field>
      </Card>

      {/* === SLAB CONTEXT === */}
      <Card id="sec-slab" title="Slab context">
        <Field label="Slab type" hint={
          report.slabType === 'PT'
            ? '⚠ PT slab — call out explicit no-core exclusion zones around tendon bands.'
            : report.slabType === 'Suspended'
            ? 'Suspended slab — check both top and bottom mats.'
            : report.slabType === 'Topping'
            ? 'Topping pour — confirm depth to structural slab below.'
            : 'Slab-on-grade — typically single mat at mid-depth.'
        }>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { id: 'SOG', label: 'SOG' },
              { id: 'Suspended', label: 'Suspended' },
              { id: 'PT', label: 'PT' },
              { id: 'Topping', label: 'Topping' },
            ].map(t => (
              <button key={t.id}
                onClick={() => update({ slabType: t.id })}
                style={{
                  background: report.slabType === t.id
                    ? (t.id === 'PT' ? c.redBg : c.accentDim)
                    : c.cardAlt,
                  color: report.slabType === t.id
                    ? (t.id === 'PT' ? c.redStrong : '#fff')
                    : c.text,
                  border: `1px solid ${report.slabType === t.id
                    ? (t.id === 'PT' ? c.red : c.accent)
                    : c.border}`,
                  borderRadius: 6, padding: '8px 4px', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer',
                }}>{t.label}</button>
            ))}
          </div>
        </Field>
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
      </Card>

      {/* === FINDINGS === */}
      <Card id="sec-targets" title="Targets identified" badge={
        <span style={{
          background: c.cardAlt, color: c.textDim, fontSize: 11,
          padding: '2px 8px', borderRadius: 4, fontWeight: 500,
        }}>{report.targets.length}</span>
      }>
        {report.targets.map((t, i) => (
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
            <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.bscanImage ? (
                <>
                  <img src={t.bscanImage} alt={`B-scan ${t.id}`}
                    style={{ width: 56, height: 42, objectFit: 'cover',
                      borderRadius: 4, border: `1px solid ${c.border}` }} />
                  <span style={{ fontSize: 11, color: c.textDim, flex: 1 }}>B-scan attached</span>
                  <Btn variant="ghost" onClick={() => updateTarget(i, { bscanImage: null })}
                    style={{ fontSize: 11, padding: '4px 8px' }}>Remove</Btn>
                </>
              ) : (
                <label style={{
                  flex: 1, background: c.cardAlt, border: `1px dashed ${c.border}`,
                  borderRadius: 4, padding: '6px', fontSize: 11, textAlign: 'center',
                  color: c.textDim, cursor: 'pointer',
                }}>
                  📸 Attach B-scan / radargram screenshot
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const dataURL = await downscaleImage(f, 1200, 0.7);
                      updateTarget(i, { bscanImage: dataURL });
                    }} />
                </label>
              )}
            </div>
          </div>
        ))}
        <Btn onClick={addTarget} style={{ width: '100%' }}>+ Add target</Btn>
      </Card>

      {/* === REBAR MAT SUMMARY === */}
      {(() => {
        const rebarTargets = (report.targets || []).filter(t =>
          (t.type || '').toLowerCase().includes('rebar'));
        const num = (s) => {
          const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
          return isFinite(n) ? n : null;
        };
        const depths = rebarTargets.map(t => num(t.depth)).filter(n => n !== null);
        const covers = rebarTargets.map(t => num(t.cover)).filter(n => n !== null);
        const stat = (arr) => arr.length
          ? { min: Math.min(...arr), max: Math.max(...arr),
              avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }
          : null;
        const dStat = stat(depths);
        const cStat = stat(covers);
        const rs = report.rebarSummary;
        const updRS = (patch) => update({ rebarSummary: { ...rs, ...patch } });
        return (
          <Card id="sec-rebar" title="Rebar mat summary" badge={
            <span style={{
              background: c.cardAlt, color: c.textDim, fontSize: 11,
              padding: '2px 8px', borderRadius: 4, fontWeight: 500,
            }}>{rebarTargets.length} logged</span>
          }>
            {(dStat || cStat) && (
              <div style={{
                background: c.cardAlt, borderRadius: 6, padding: 9, marginBottom: 10,
                fontSize: 12, color: c.text,
              }}>
                <div style={{ color: c.textDim, fontSize: 10.5, marginBottom: 5,
                  letterSpacing: 0.6, fontWeight: 600, textTransform: 'uppercase' }}>
                  Auto from logged targets
                </div>
                {dStat && (
                  <div>Depth (mm): min <strong>{dStat.min}</strong> · avg <strong>{dStat.avg}</strong> · max <strong>{dStat.max}</strong></div>
                )}
                {cStat && (
                  <div>Cover (mm): min <strong>{cStat.min}</strong> · avg <strong>{cStat.avg}</strong> · max <strong>{cStat.max}</strong></div>
                )}
              </div>
            )}
            <div style={{
              fontSize: 10.5, color: c.textDim, marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
            }}>Top mat</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <Input placeholder="Bar size (10M)" value={rs.topBarSize}
                onChange={e => updRS({ topBarSize: e.target.value })} style={{ fontSize: 13 }} />
              <Input placeholder='Spacing (200 c/c)' value={rs.topSpacing}
                onChange={e => updRS({ topSpacing: e.target.value })} style={{ fontSize: 13 }} />
              <Input placeholder="Cover (mm)" value={rs.topCover}
                onChange={e => updRS({ topCover: e.target.value })} style={{ fontSize: 13 }} />
            </div>
            <div style={{
              fontSize: 10.5, color: c.textDim, marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
            }}>Bottom mat</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <Input placeholder="Bar size (10M)" value={rs.bottomBarSize}
                onChange={e => updRS({ bottomBarSize: e.target.value })} style={{ fontSize: 13 }} />
              <Input placeholder='Spacing (200 c/c)' value={rs.bottomSpacing}
                onChange={e => updRS({ bottomSpacing: e.target.value })} style={{ fontSize: 13 }} />
              <Input placeholder="Cover (mm)" value={rs.bottomCover}
                onChange={e => updRS({ bottomCover: e.target.value })} style={{ fontSize: 13 }} />
            </div>
            <Field label="Notes" hint="Bar size estimates are visual / GPR-inferred unless verified by daylighting.">
              <Textarea value={rs.notes} onChange={e => updRS({ notes: e.target.value })}
                placeholder="e.g. Top mat appears #4 @ 200 c/c, bottom mat could not be resolved below the top mat in the NE quadrant." />
            </Field>
          </Card>
        );
      })()}

      {/* === MARKING COLOURS & PHOTO SETTINGS === */}
      <Card id="sec-settings" title="Marking colours & photo size">
        <div style={{ fontSize: 11.5, color: c.textDim, marginBottom: 11, lineHeight: 1.5 }}>
          Set these to match your chalk on the slab. The same colours flow into the site diagram and the report legend — one colour key, no confusion.
        </div>
        {(report.markings || []).map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input type="color" value={m.color} onChange={e => updateMarking(i, { color: e.target.value })}
              style={{ width: 38, height: 34, border: `1px solid ${c.border}`, borderRadius: 6, background: c.cardAlt, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
            <Input value={m.label} onChange={e => updateMarking(i, { label: e.target.value })} placeholder="Marking name (e.g. Conduit)" style={{ flex: 1 }} />
            <Btn variant="ghost" onClick={() => removeMarking(i)} style={{ padding: '7px 10px', fontSize: 12 }}>✕</Btn>
          </div>
        ))}
        <Btn onClick={addMarking} style={{ width: '100%', marginTop: 4 }}>+ Add marking colour</Btn>

        <div style={{ marginTop: 13, paddingTop: 11, borderTop: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 10, color: c.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Legend preview · prints on the report</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 16px' }}>
            {(report.markings || []).map((m, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: c.text }}>
                <span style={{ width: 18, height: 4, borderRadius: 2, background: m.color, flexShrink: 0 }} /> {m.label || '—'}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 11, borderTop: `1px solid ${c.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10.5, color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, marginBottom: 9 }}>
            <span>Scan photo size</span><span style={{ color: c.accent2, fontWeight: 800, fontSize: 13 }}>{report.photoScale}%</span>
          </div>
          <input type="range" min="60" max="180" step="5" value={report.photoScale}
            onChange={e => update({ photoScale: Number(e.target.value) })}
            style={{ width: '100%', accentColor: c.accent }} />
          <div style={{ fontSize: 11, color: c.textFaint, marginTop: 5 }}>Bigger photos make on-image annotations easier to read.</div>
        </div>
      </Card>

      {/* === SITE DIAGRAM === */}
      <SiteDiagram report={report} update={update} setReport={setReport} />

      {/* === CORE VERDICTS === */}
      <Card id="sec-cores" title="Drill / core verdicts" badge={
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
          const ps = (report.photoScale || 100) / 100;
          const phW = Math.round(132 * ps), phH = Math.round(104 * ps);
          return (
            <div key={i} style={{
              borderLeft: `3px solid ${v.color}`, background: v.bg,
              padding: '9px 11px', borderRadius: '0 6px 6px 0', marginBottom: 7,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              {/* scan photo (left) */}
              <div style={{ width: phW, flexShrink: 0 }}>
                {co.photo ? (
                  <div style={{ position: 'relative' }}>
                    <img src={co.photo} alt="scan" style={{ width: '100%', height: phH, objectFit: 'cover', borderRadius: 6, display: 'block', border: `1px solid ${c.border}` }} />
                    <button onClick={() => updateCore(i, { photo: null })} title="Remove photo"
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(10,16,22,.72)', color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, height: phH, border: `1px dashed ${c.borderStrong}`, borderRadius: 6, color: c.textDim, fontSize: 10.5, cursor: 'pointer', background: c.cardAlt, textAlign: 'center', padding: 4 }}>
                    <span style={{ fontSize: 18 }}>📷</span> Add scan photo
                    <input type="file" accept="image/*" capture="environment" onChange={e => readCorePhoto(i, e)} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              {/* details (right) */}
              <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Input value={co.label} onChange={e => updateCore(i, { label: e.target.value })}
                    style={{ width: 36, padding: '4px 6px', fontSize: 13, textAlign: 'center', fontWeight: 600 }} />
                  <Input value={co.size} onChange={e => updateCore(i, { size: e.target.value })}
                    placeholder='4"' style={{ width: 56, padding: '4px 6px', fontSize: 12 }} />
                </div>
                <Btn variant="ghost" onClick={() => removeCore(i)} style={{ padding: '4px 9px', fontSize: 12 }}>✕</Btn>
              </div>
              <Select value={co.verdict} onChange={e => updateCore(i, { verdict: e.target.value })}
                style={{ marginBottom: 5, fontSize: 13, color: v.color, fontWeight: 600 }}>
                <option value="safe">✓ Safe to drill</option>
                <option value="caution">⚠ Caution</option>
                <option value="nogo">✕ Do not drill</option>
              </Select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
                <Input value={co.drillDia || ''} onChange={e => updateCore(i, { drillDia: e.target.value })}
                  placeholder='Max bit Ø (e.g. 2")'
                  style={{ padding: '5px 9px', fontSize: 12 }} />
                <Input value={co.drillMaxDepth || ''} onChange={e => updateCore(i, { drillMaxDepth: e.target.value })}
                  placeholder="Max depth (mm)"
                  style={{ padding: '5px 9px', fontSize: 12 }} />
              </div>
              <Input value={co.clearance} onChange={e => updateCore(i, { clearance: e.target.value })}
                placeholder="Clearance / nearest target"
                style={{ padding: '5px 9px', fontSize: 12, marginBottom: 5 }} />
              <Input value={co.note} onChange={e => updateCore(i, { note: e.target.value })}
                placeholder="Instructions for crew"
                style={{ padding: '5px 9px', fontSize: 12 }} />
              </div>{/* /details */}
            </div>
          );
        })}
        <Btn onClick={addCore} style={{ width: '100%' }}>+ Add core location</Btn>
      </Card>

      {/* === UNCERTAINTY ZONES (standard + full only) === */}
      {showUncertainty && (
        <Card title="Areas of uncertainty">
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
        <Card id="sec-equip" title="Equipment & calibration">
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

      {/* === LIMITATIONS (standard + full) === */}
      {showLimitations && (
        <Card title="Limitations & assumptions">
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

      {/* === SIGN-OFF === */}
      <Card id="sec-signoff" title="Authorship & review">
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

        </div>{/* ws-main */}
        <aside className="ws-rail no-print">
          {(() => {
            const cc = report.cores.reduce((a, co) => { a[co.verdict] = (a[co.verdict] || 0) + 1; return a; }, {});
            const rows = [
              { label: 'Safe', n: cc.safe || 0, color: c.greenStrong },
              { label: 'Caution', n: cc.caution || 0, color: c.amberStrong },
              { label: 'No-go', n: cc.nogo || 0, color: c.redStrong },
            ];
            return (
              <Card title="At a glance" dense>
                <div style={{ display: 'grid', gap: 6 }}>
                  {rows.map(r => (
                    <div key={r.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 7, padding: '7px 10px',
                    }}>
                      <span style={{ fontSize: 12, color: c.textDim }}>{r.label}</span>
                      <b style={{ fontSize: 16, color: r.color }}>{r.n}</b>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: c.cardAlt, border: `1px solid ${c.border}`, borderRadius: 7, padding: '7px 10px',
                  }}>
                    <span style={{ fontSize: 12, color: c.textDim }}>Cores · Targets</span>
                    <b style={{ fontSize: 15, color: c.text }}>{report.cores.length} · {report.targets.length}</b>
                  </div>
                </div>
              </Card>
            );
          })()}
        </aside>
      </div>{/* ws-grid */}

      {/* === ACTIONS === */}
      <div className="no-print" style={{
        position: 'sticky', bottom: 10,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
        background: c.bg, padding: '10px 0 0',
      }}>
        <Btn variant="primary" onClick={printPDF}>📄 PDF</Btn>
        <Btn onClick={exportJSON}>💾 Save</Btn>
        <label style={{
          background: c.cardAlt, border: `1px solid ${c.borderStrong}`,
          borderRadius: 6, padding: '9px 12px', textAlign: 'center', fontSize: 13,
          color: c.text, cursor: 'pointer', fontWeight: 500,
        }}>
          📂 Load
          <input type="file" accept=".json,application/json" onChange={importJSON} style={{ display: 'none' }} />
        </label>
      </div>

      <div style={{ fontSize: 10, color: c.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
        Tier: <strong style={{ color: c.textDim, textTransform: 'capitalize' }}>{tier}</strong>
        {report.rev && report.rev !== '0' && <> · Rev {report.rev}</>}<br/>
        GSSI StructureScan Mini XT · British Columbia engineering edition
      </div>

      <Assistant report={report} update={update} />
    </div>
  );
}
