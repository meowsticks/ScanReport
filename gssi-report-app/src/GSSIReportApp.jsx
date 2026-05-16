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
        --ak-bg:            #000000;
        --ak-bg-raised:     #0a0a0a;
        --ak-card:          #111111;
        --ak-card-alt:      #161616;
        --ak-border:        #1f1f1f;
        --ak-border-strong: #2a2a2a;
        --ak-text:          #ffffff;
        --ak-text-dim:      #b0b0b0;
        --ak-text-faint:    #7a7a7a;
        --ak-accent:        #e02020;
        --ak-accent-dim:    #7a0e10;
        --ak-green:         #3fb950;
        --ak-green-bg:      #0d2818;
        --ak-green-strong:  #56d364;
        --ak-amber:         #e0a020;
        --ak-amber-bg:      #2a1f08;
        --ak-amber-strong:  #f4ba3f;
        --ak-red:           #e02020;
        --ak-red-bg:        #2a1010;
        --ak-red-strong:    #ff5a5a;
      }
      :root[data-theme="light"] {
        --ak-bg:            #ffffff;
        --ak-bg-raised:     #f4f4f4;
        --ak-card:          #ffffff;
        --ak-card-alt:      #f0f0f0;
        --ak-border:        #c8c8c8;
        --ak-border-strong: #909090;
        --ak-text:          #000000;
        --ak-text-dim:      #2a2a2a;
        --ak-text-faint:    #555555;
        --ak-accent:        #b81010;
        --ak-accent-dim:    #fbd6d6;
        --ak-green:         #117a26;
        --ak-green-bg:      #d8f1de;
        --ak-green-strong:  #0b5e1c;
        --ak-amber:         #8a5800;
        --ak-amber-bg:      #fff0d0;
        --ak-amber-strong:  #6a4400;
        --ak-red:           #b81010;
        --ak-red-bg:        #f5dada;
        --ak-red-strong:    #8a0d0d;
      }
      html, body, #root { background: var(--ak-bg); color: var(--ak-text); }
    `}</style>
  );
}

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
  const [anchor, setAnchor] = useState(null);
  const [hoverPt, setHoverPt] = useState(null);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [pinSize, setPinSize] = useState(18);

  const toolColors = {
    'draw-rebar': '#FAC775',
    'draw-pt': '#F09595',
    'draw-conduit': '#9BC5E8',
    'draw-note': '#5DCAA5',
  };

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

  useEffect(redraw, [report.diagramStrokes, report.diagramPins, anchor, hoverPt, tool, strokeWidth, pinSize]);

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
    } else if (tool.startsWith('draw-')) {
      if (!anchor) {
        setAnchor(pt);
        setHoverPt(pt);
      } else {
        const color = toolColors[tool];
        update({
          diagramStrokes: [...report.diagramStrokes, { color, points: [anchor, pt], width: strokeWidth }],
        });
        setAnchor(null);
        setHoverPt(null);
      }
    }
  };

  const handleMove = (e) => {
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
      </div>
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
          <span style={{ color: c.green }}>● Safe</span>
          <span style={{ color: c.amber }}>● Caution</span>
          <span style={{ color: c.red }}>● No drill</span>
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
  } else if (a.type === 'circle' && a.center && typeof a.radius === 'number') {
    ctx.beginPath();
    ctx.arc(a.center.x * W, a.center.y * H, a.radius * minDim, 0, Math.PI * 2);
    ctx.stroke();
  } else if (a.type === 'rect' && a.topLeft && a.bottomRight) {
    const x = a.topLeft.x * W, y = a.topLeft.y * H;
    const w = (a.bottomRight.x - a.topLeft.x) * W;
    const h = (a.bottomRight.y - a.topLeft.y) * H;
    ctx.strokeRect(x, y, w, h);
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

    // Preview of in-progress shape
    if (anchor && hover) {
      const previewColor = ANNOTATION_COLOR_HEX[color];
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([5, 4]);
      const minDim = Math.min(W, H);
      ctx.strokeStyle = previewColor;
      ctx.fillStyle = previewColor;
      ctx.lineWidth = Math.max(1.5, minDim * 0.0012 * strokeScale);
      if (tool === 'arrow') {
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

  useEffect(redraw, [annotations, anchor, hover, tool, color, strokeScale]);

  useEffect(() => {
    const handler = () => redraw();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [annotations, anchor, hover]);

  const handleClick = (e) => {
    e.preventDefault();
    const pt = getFractionalCoords(e);
    if (!pt) return;
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

  const pushAnnotation = (a) => setAnnotations(prev => [...prev, a]);

  const handleMove = (e) => {
    if (!anchor || tool === 'text') return;
    e.preventDefault();
    const pt = getFractionalCoords(e);
    if (pt) setHover(pt);
  };

  const undo = () => setAnnotations(prev => prev.slice(0, -1));
  const clearAll = () => {
    if (confirm('Clear all annotations on this scan?')) setAnnotations([]);
  };

  const save = () => onSave(annotations);

  useEffect(() => {
    setAnchor(null);
    setHover(null);
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
            touchAction: 'none', cursor: tool === 'text' ? 'text' : 'crosshair',
          }}
          onClick={handleClick}
          onMouseMove={handleMove}
          onTouchStart={handleClick}
          onTouchMove={handleMove}
        />
      </div>

      <div style={{
        padding: '10px 12px', background: c.bgRaised,
        borderTop: `1px solid ${c.borderStrong}`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
          {[
            { id: 'arrow',  label: '→ Arrow' },
            { id: 'circle', label: '○ Circle' },
            { id: 'rect',   label: '▭ Rect' },
            { id: 'text',   label: 'T Text' },
          ].map(opt => (
            <button key={opt.id}
              onClick={() => setTool(opt.id)}
              style={{
                background: tool === opt.id ? c.accentDim : c.cardAlt,
                border: `1px solid ${tool === opt.id ? c.accent : c.border}`,
                borderRadius: 6, padding: '8px 4px',
                color: tool === opt.id ? '#fff' : c.text,
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
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5 }}>
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
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" onClick={undo}
              style={{ fontSize: 12 }} disabled={annotations.length === 0}>↶ Undo</Btn>
            <Btn variant="ghost" onClick={clearAll}
              style={{ fontSize: 12 }} disabled={annotations.length === 0}>Clear</Btn>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: c.textFaint, textAlign: 'center' }}>
          {tool === 'text'
            ? 'Tap to place a text label.'
            : anchor
              ? `Tap to finish the ${tool}.`
              : `Tap to start the ${tool}.`}
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

function ScanLocations({ report, update }) {
  const fileInputRefs = useRef({});
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

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
      }],
    });
  };

  const updateLoc = (id, patch) => {
    update({
      scanLocations: report.scanLocations.map(l =>
        l.id === id ? { ...l, ...patch } : l
      ),
    });
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

      {report.scanLocations.map((loc, idx) => {
        const vm = verdictMeta[loc.verdict] || verdictMeta.safe;
        return (
          <div key={loc.id}
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
                }}>
                  {loc.photo ? (
                    <>
                      <img src={loc.photo} alt={loc.label}
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                          position: 'absolute', inset: 0,
                        }} />
                      <NorthArrow rotation={loc.northRotation} />
                      <div style={{
                        position: 'absolute', bottom: 6, right: 6,
                        background: 'rgba(0,0,0,0.7)', color: '#fff',
                        padding: '3px 8px', borderRadius: 4,
                        fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                      }}>{loc.label}</div>
                    </>
                  ) : (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: c.textFaint, fontSize: 12, padding: 16, textAlign: 'center',
                    }}>
                      No photo yet
                    </div>
                  )}
                </div>

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
        );
      })}

      {report.scanLocations.length === 0 && (
        <div style={{
          padding: '14px', textAlign: 'center', fontSize: 12,
          color: c.textFaint, background: c.cardAlt, borderRadius: 6, marginBottom: 8,
        }}>
          No scan locations yet. Add one to build the side-by-side card.
        </div>
      )}

      <Btn onClick={addLocation} style={{ width: '100%' }}>+ Add scan location</Btn>
    </Card>
  );
}

// ============================================================
// KamikazeMark — gear-and-saw brand badge (inline SVG)
// ============================================================

function KamikazeMark({ size = 56 }) {
  // 22-tooth circular-saw blade, teeth chiseled forward (clockwise lean)
  const teeth = 22;
  const rTip = 49;     // tooth tip radius
  const rGullet = 41;  // gullet (between-tooth low) radius
  const skew = 0.55;   // 0 = symmetric, >0.5 = forward-leaning chisel
  const path = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2 - Math.PI / 2;
    const aNext = ((i + 1) / teeth) * Math.PI * 2 - Math.PI / 2;
    const tipA = a + (aNext - a) * skew;
    const gx  = 50 + rGullet * Math.cos(a);
    const gy  = 50 + rGullet * Math.sin(a);
    const tx  = 50 + rTip    * Math.cos(tipA);
    const ty  = 50 + rTip    * Math.sin(tipA);
    const ngx = 50 + rGullet * Math.cos(aNext);
    const ngy = 50 + rGullet * Math.sin(aNext);
    if (i === 0) path.push(`M${gx.toFixed(2)} ${gy.toFixed(2)}`);
    path.push(`L${tx.toFixed(2)} ${ty.toFixed(2)} L${ngx.toFixed(2)} ${ngy.toFixed(2)}`);
  }
  path.push('Z');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Aggarwal Kamikazes saw blade">
      {/* saw blade body (red, with chiseled teeth jutting outward) */}
      <path d={path.join(' ')} fill="#e02020" stroke="#7a0e10" strokeWidth="0.6" strokeLinejoin="round" />
      {/* dark hub disc, leaving a thin red ring of gullet visible */}
      <circle cx="50" cy="50" r="36" fill="#000" stroke="#e02020" strokeWidth="2" />
      {/* arbor hole hint */}
      <circle cx="50" cy="50" r="2.5" fill="#e02020" />
      {/* AK monogram */}
      <text x="50" y="55" textAnchor="middle" dominantBaseline="central"
        fontFamily='Impact, "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif'
        fontSize="26" fontWeight="900" fill="#fff" letterSpacing="-0.5">AK</text>
    </svg>
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

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ak_theme') || 'dark'; }
    catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(report)); } catch {}
  }, [report]);

  useEffect(() => {
    try { localStorage.setItem('ak_theme', theme); } catch {}
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

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
    <div className="ak-shell" style={{
      background: c.bg, minHeight: '100vh', color: c.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '14px 12px 100px', maxWidth: 720, margin: '0 auto',
    }}>
      <ThemeStyles />
      <style>{`
        .print-only { display: none; }
        .scan-location-card.dragging,
        .scan-photo-row.dragging { opacity: 0.35; }
        .scan-location-card.drop-target,
        .scan-photo-row.drop-target {
          outline: 2px dashed #e02020;
          outline-offset: -2px;
        }
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
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
        marginBottom: 14, padding: '12px 14px',
        background: c.bgRaised,
        border: `1px solid ${c.borderStrong}`,
        borderLeft: `4px solid ${c.accent}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <KamikazeMark size={56} />
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.05 }}>
            <div className="ak-title" style={{
              fontSize: 26, color: c.text, fontWeight: 900,
              letterSpacing: 0.8, textTransform: 'uppercase',
              fontFamily: 'Impact, "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
            }}>
              Aggarwal Kamikazes
            </div>
            <div style={{
              fontSize: 13, color: c.accent, fontWeight: 800,
              letterSpacing: 3, textTransform: 'uppercase',
              marginTop: 2,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}>
              Cutting &amp; Coring&nbsp;Ltd
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light (outdoor) mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            style={{
              background: c.cardAlt, border: `1px solid ${c.borderStrong}`,
              borderRadius: 6, padding: '9px 11px', fontSize: 16,
              color: c.text, cursor: 'pointer', fontWeight: 900,
              whiteSpace: 'nowrap', lineHeight: 1,
            }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <label style={{
            background: c.accent, border: `2px solid ${c.accent}`,
            borderRadius: 6, padding: '9px 14px', textAlign: 'center', fontSize: 12,
            color: '#fff', cursor: 'pointer', fontWeight: 900, whiteSpace: 'nowrap',
            letterSpacing: 1.2, textTransform: 'uppercase',
            boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
          }}>
            📂 Load
            <input type="file" accept=".json,application/json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      <style>{`
        /* Responsive shell — phone first, breathes on wider screens */
        .ak-shell { max-width: 720px; }
        @media (min-width: 900px)  { .ak-shell { max-width: 820px; padding-left: 20px; padding-right: 20px; } }
        @media (min-width: 1200px) { .ak-shell { max-width: 920px; padding-left: 28px; padding-right: 28px; } }
        @media (max-width: 480px)  {
          .ak-shell { padding-left: 10px; padding-right: 10px; }
          .ak-header .ak-title { font-size: 19px !important; letter-spacing: 0.4px !important; }
        }
        @media print {
          .ak-shell { max-width: none !important; padding: 0 !important; }
        }
      `}</style>

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

      {/* === SITE DIAGRAM === */}
      <SiteDiagram report={report} update={update} />

      {/* === SCAN PHOTOS === */}
      <ScanPhotos report={report} update={update} />

      {/* === SCAN LOCATIONS (per-location cards · prints side-by-side) === */}
      <ScanLocations report={report} update={update} />

      {/* === GPR SCANS (full-size grouping for the PDF) === */}
      <GPRScans report={report} />

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

      {/* === LEGAL DISCLAIMER === */}
      <Card title="Legal disclaimer">
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
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        background: c.bg, padding: '10px 0 0',
      }}>
        <Btn variant="primary" onClick={printPDF}>📄 PDF</Btn>
        <Btn onClick={exportJSON}>💾 Save draft</Btn>
      </div>

      <div style={{ fontSize: 10, color: c.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
        Tier: <strong style={{ color: c.textDim, textTransform: 'capitalize' }}>{tier}</strong><br/>
        GSSI StructureScan Mini XT · British Columbia engineering edition
      </div>
    </div>
  );
}
