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
  accent: '#4a9eff',       // steel blue — engineering primary
  accentDim: '#1f4d80',
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

const Card = ({ title, badge, children, dense, accent }) => (
  <div style={{
    background: c.card,
    border: `1px solid ${accent ? c.accent : c.border}`,
    borderRadius: 10,
    padding: dense ? 12 : 14,
    marginBottom: 12,
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

function SiteDiagram({ report, update }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('pin');
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);

  const toolColors = {
    'draw-rebar': '#FAC775',
    'draw-pt': '#F09595',
    'draw-conduit': '#9BC5E8',
    'draw-note': '#5DCAA5',
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  useEffect(redraw, [report.diagramStrokes, report.diagramPins, currentStroke]);

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
        diagramPins: [...report.diagramPins, { x: pt.x, y: pt.y, label: nextLabel, verdict: n }],
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
        {toolBtn('draw-rebar', 'Rebar', '#FAC775')}
        {toolBtn('draw-pt', 'PT cable', '#F09595')}
        {toolBtn('draw-conduit', 'Conduit', '#9BC5E8')}
        {toolBtn('draw-note', 'Note', '#5DCAA5')}
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
          <span style={{ color: c.green }}>● Safe</span>
          <span style={{ color: c.amber }}>● Caution</span>
          <span style={{ color: c.red }}>● No drill</span>
        </div>
      </div>
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
      note: '', confidence: 'high',
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
    }],
  });
  const updateCore = (i, patch) => {
    const next = [...report.cores];
    next[i] = { ...next[i], ...patch };
    update({ cores: next });
  };
  const removeCore = (i) => update({ cores: report.cores.filter((_, j) => j !== i) });

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
      padding: '14px 12px 100px', maxWidth: 480, margin: '0 auto',
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
      `}</style>

      {/* === HEADER === */}
      <div className="no-print" style={{
        marginBottom: 14, paddingBottom: 12,
        borderBottom: `1px solid ${c.borderStrong}`,
      }}>
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
      <Card title="Project info">
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
      <Card title="Slab context">
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
      <Card title="Targets identified" badge={
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
        <Btn onClick={addTarget} style={{ width: '100%' }}>+ Add target</Btn>
      </Card>

      {/* === SITE DIAGRAM === */}
      <SiteDiagram report={report} update={update} />

      {/* === CORE VERDICTS === */}
      <Card title="Drill / core verdicts" badge={
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
                <Btn variant="ghost" onClick={() => removeCore(i)} style={{ padding: '4px 9px', fontSize: 12 }}>✕</Btn>
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
        <Card title="Equipment & calibration">
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
      <Card title="Authorship & review">
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
        Tier: <strong style={{ color: c.textDim, textTransform: 'capitalize' }}>{tier}</strong><br/>
        GSSI StructureScan Mini XT · British Columbia engineering edition
      </div>
    </div>
  );
}
