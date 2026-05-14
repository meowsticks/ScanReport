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
  const [anchor, setAnchor] = useState(null);
  const [hoverPt, setHoverPt] = useState(null);

  const toolColors = {
    'draw-rebar': '#FAC775',
    'draw-pt': '#F09595',
    'draw-conduit': '#9BC5E8',
    'draw-note': '#5DCAA5',
  };

  const lineWidthFor = (color) => color === '#F09595' ? 6 : 5;

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    report.diagramStrokes.forEach(s => {
      if (s.points.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = lineWidthFor(s.color);
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
      ctx.lineWidth = lineWidthFor(color);
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
      ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2);
      ctx.fill();
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

  useEffect(redraw, [report.diagramStrokes, report.diagramPins, anchor, hoverPt, tool]);

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
      if (!anchor) {
        setAnchor(pt);
        setHoverPt(pt);
      } else {
        const color = toolColors[tool];
        update({
          diagramStrokes: [...report.diagramStrokes, { color, points: [anchor, pt] }],
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

function ScanPhotos({ report, update }) {
  const fileInputRef = useRef(null);

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const loaded = await Promise.all(files.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl: ev.target.result,
        caption: '',
        confidence: 'high',
        pinRef: '',
      });
      reader.readAsDataURL(file);
    })));
    update({ scanPhotos: [...report.scanPhotos, ...loaded] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

      <label style={{
        display: 'block', background: c.cardAlt, border: `1px dashed ${c.borderStrong}`,
        borderRadius: 6, padding: '11px', textAlign: 'center', fontSize: 13,
        color: c.text, cursor: 'pointer', fontWeight: 500, marginBottom: 10,
      }}>
        📷 Add photos (one or many)
        <input ref={fileInputRef} type="file" accept="image/*" multiple
          capture="environment" onChange={addPhotos} style={{ display: 'none' }} />
      </label>

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
              return (
                <div key={photo.id} className="scan-photo-row" style={{
                  border: `1px solid ${c.border}`, borderRadius: 6,
                  padding: 9, marginBottom: 7, background: c.cardAlt,
                }}>
                  <div style={{
                    display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 7,
                  }}>
                    <img src={photo.dataUrl} alt={photo.caption || 'Scan photo'}
                      style={{
                        width: 84, height: 84, objectFit: 'cover',
                        borderRadius: 4, border: `1px solid ${c.border}`,
                        flexShrink: 0,
                      }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Textarea
                        value={photo.caption}
                        onChange={e => updatePhoto(photo.id, { caption: e.target.value })}
                        placeholder="Caption: what does this photo show?"
                        style={{ minHeight: 56, fontSize: 12, padding: '6px 9px' }}
                      />
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
                    <Btn variant="ghost" onClick={() => movePhoto(photo.id, -1)}
                      style={{ flex: 1, fontSize: 11, padding: '5px 6px' }}
                      disabled={globalIdx === 0}>↑ Up</Btn>
                    <Btn variant="ghost" onClick={() => movePhoto(photo.id, 1)}
                      style={{ flex: 1, fontSize: 11, padding: '5px 6px' }}
                      disabled={globalIdx === report.scanPhotos.length - 1}>↓ Down</Btn>
                    <Btn variant="danger" onClick={() => removePhoto(photo.id)}
                      style={{ flex: 1, fontSize: 11, padding: '5px 6px' }}>✕ Remove</Btn>
                  </div>
                </div>
              );
            })}
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
          <div key={loc.id} className="scan-location-card" style={{
            border: `1px solid ${c.borderStrong}`, borderRadius: 8,
            marginBottom: 12, overflow: 'hidden',
          }}>
            {/* On-screen header: editable label + verdict */}
            <div className="loc-header" style={{
              background: '#5DCAA5', color: '#0f1419', padding: '7px 11px',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>Concrete Scanning Data</span>
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
          .scan-photo-row {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .scan-photo-row img { max-width: 100% !important; height: auto !important; }

          .scan-location-card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #999 !important;
            border-radius: 0 !important;
            margin-bottom: 14px;
          }
          .scan-location-card .loc-header {
            background: #5DCAA5 !important;
            color: #000 !important;
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
      <div className="no-print" style={{
        marginBottom: 14, paddingBottom: 12,
        borderBottom: `1px solid ${c.borderStrong}`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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
        <label style={{
          background: c.accentDim, border: `1px solid ${c.accent}`,
          borderRadius: 6, padding: '8px 12px', textAlign: 'center', fontSize: 12,
          color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          📂 Load draft
          <input type="file" accept=".json,application/json" onChange={importJSON} style={{ display: 'none' }} />
        </label>
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
