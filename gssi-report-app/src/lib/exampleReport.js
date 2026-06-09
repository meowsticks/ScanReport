// A fully-built example report. Loading it gives the operator a "copy & tweak"
// starting point AND doubles as a one-shot product check: every major section is
// populated (targets, cores, scan-location photos with annotations, named zones,
// CAD page, color key, confidence band, sign-off), so exporting it to PDF
// exercises the whole render path. Images are generated at call time so nothing
// heavy is bundled.

function makePhoto(label, hue) {
  const c = document.createElement('canvas');
  c.width = 1000; c.height = 1300;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1300);
  g.addColorStop(0, `hsl(${hue},10%,72%)`);
  g.addColorStop(1, `hsl(${hue},8%,58%)`);
  x.fillStyle = g; x.fillRect(0, 0, 1000, 1300);
  // speckle so it reads as concrete
  x.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 220; i++) x.fillRect(Math.random() * 1000, Math.random() * 1300, 4 + Math.random() * 10, 3);
  x.fillStyle = 'rgba(20,20,20,0.78)'; x.fillRect(0, 0, 1000, 70);
  x.fillStyle = '#fff'; x.font = '700 34px Inter, Segoe UI, sans-serif';
  x.fillText(label, 24, 48);
  return c.toDataURL('image/jpeg', 0.82);
}

function makeDiagram() {
  const c = document.createElement('canvas');
  c.width = 1100; c.height = 760;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 760);
  g.addColorStop(0, '#e7ecf2'); g.addColorStop(1, '#cdd6e0');
  x.fillStyle = g; x.fillRect(0, 0, 1100, 760);
  x.strokeStyle = 'rgba(90,110,130,0.5)'; x.lineWidth = 2;
  for (let k = 0; k < 5; k++) { x.beginPath();
    for (let px = 0; px <= 1100; px += 8) { const t = (px - 550) / 200; x.lineTo(px, 200 + k * 90 + t * t * 26); }
    x.stroke(); }
  x.fillStyle = 'rgba(20,20,20,0.82)'; x.fillRect(0, 0, 1100, 60);
  x.fillStyle = '#fff'; x.font = '700 30px Inter, Segoe UI, sans-serif';
  x.fillText('Site Plan — Level 2 slab', 22, 42);
  x.fillStyle = '#c0282d'; x.font = '700 18px Inter, sans-serif';
  x.fillText('Grid B–E / 2–5 · 1:50', 22, 740);
  return c.toDataURL('image/jpeg', 0.85);
}

export function buildExampleReport() {
  const today = new Date().toISOString().slice(0, 10);
  // Annotations stay within 0..1 (fractional) — exercises the overlay render.
  const annL1 = [
    { type: 'line',   color: 'black', strokeScale: 6, start: { x: 0.5, y: 0.1 }, end: { x: 0.5, y: 0.9 } },
    { type: 'arrow',  color: 'red',   strokeScale: 6, start: { x: 0.2, y: 0.22 }, end: { x: 0.74, y: 0.62 } },
    { type: 'text',   color: 'black', position: { x: 0.16, y: 0.4 }, content: 'Top Rebar 3" deep', fontSize: 14, strokeScale: 5 },
    { type: 'circle', color: 'black', strokeScale: 5, center: { x: 0.55, y: 0.74 }, radius: 0.1 },
  ];
  const annL2 = [
    { type: 'arrow',  color: 'orange', strokeScale: 6, start: { x: 0.8, y: 0.18 }, end: { x: 0.4, y: 0.55 } },
    { type: 'text',   color: 'black',  position: { x: 0.3, y: 0.5 }, content: 'Conduit ~25 mm', fontSize: 14, strokeScale: 5 },
  ];

  return {
    tier: 'full',
    status: 'draft',
    projectNo: 'EXAMPLE-001',
    jobNote: 'EXAMPLE — every section filled (copy & tweak / product check)',
    scanDate: today,
    client: 'Example Client Ltd.',
    siteAddress: '1200 W Georgia St, Vancouver, BC',
    scanArea: 'Level 2 suspended slab — Grid B–E / 2–5',
    weather: 'Indoor, ~18°C',
    slabThickness: '200 mm',
    serialNo: 'MXT-0098',
    firmware: '4.0.2',
    preparedBy: 'T. Aggarwal',
    preparedCert: 'Decifer GPR #DC-20418',
    reviewedBy: 'J. Mehta, P.Eng.',
    coreStandoff: '25 mm',
    uncertaintyZones: 'NE corner near column footing: rebar congestion reduces depth confidence below 200 mm — daylight verify before coring within a 0.5 m radius.',
    // every feature on
    brandFlourishes: true,
    enableColorLegend: true,
    enableConfidenceBand: true,
    enableZones: true,
    enableCadPage: true,
    enableStandardNotes: true,
    enableNamedZones: true,
    drawingNo: 'EXAMPLE-D01',
    drawingScale: '1 : 50',
    diagramNotes: 'Scan performed on Level 2 suspended slab, Grid B–E / 2–5. Top mat #4 @ 200 mm o/c at ~45 mm cover; bottom mat #5 @ 250 mm o/c. Two PT bands run E–W through the central bay — treat as live. Daylight and hand-verify each location before coring.',
    diagramImage: makeDiagram(),
    targets: [
      { id: 't1', type: 'Rebar (top mat)',    depth: '45',  cover: '45', confidence: 'high', note: '#4 @ 200 mm o/c, both directions' },
      { id: 't2', type: 'Rebar (bottom mat)', depth: '175', cover: '25', confidence: 'high', note: '#5 @ 250 mm o/c' },
      { id: 't3', type: 'Post-tension cable', depth: '95',  cover: '',   confidence: 'high', note: 'Band A — E–W draped, ~600 mm spacing' },
      { id: 't4', type: 'Conduit / unknown',  depth: '60',  cover: '',   confidence: 'med',  note: '32 mm EMT, N–S in east bay' },
    ],
    cores: [
      { label: 'A', size: '4"', verdict: 'safe',    clearance: '65 mm', note: 'Clear of all targets' },
      { label: 'B', size: '4"', verdict: 'safe',    clearance: '58 mm', note: 'Nearest rebar 58 mm W' },
      { label: 'C', size: '6"', verdict: 'caution', clearance: '22 mm', note: 'PT band A within 22 mm — shift 100 mm N' },
      { label: 'D', size: '4"', verdict: 'safe',    clearance: '70 mm', note: 'Clear' },
      { label: 'E', size: '4"', verdict: 'nogo',    clearance: '0',     note: 'Directly over PT cable — relocate or redesign' },
      { label: 'F', size: '4"', verdict: 'safe',    clearance: '61 mm', note: 'Clear' },
    ],
    scanLocations: [
      { id: 'l1', label: 'L1', photo: makePhoto('Scan L1 — Bay C4', 200), northRotation: 0, coreSize: '4"', overCut: '25 mm', coreCount: 4, notes: 'All four cores clear of marked targets. Proceed — keep 25 mm standoff.', verdict: 'safe', instruction: 'Use proposed core location only when coring.', confidence: 'high', photoAnnotations: annL1 },
      { id: 'l2', label: 'L2', photo: makePhoto('Scan L2 — east bay', 30), northRotation: 0, coreSize: '6"', overCut: '0', coreCount: 2, notes: 'PT band crosses the NE corner. Keep cores 100 mm clear of the marked cable; daylight before drilling.', verdict: 'caution', instruction: 'Use proposed core location only when coring.', confidence: 'med', photoAnnotations: annL2 },
    ],
    zones: [
      { id: 'z-boh', label: 'Back of House', notes: 'Mechanical + storage rooms — confined headroom; watch for embedded conduit feeding the gear room.' },
      { id: 'z-foh', label: 'Front of House', notes: 'Lobby + retail slab — architectural finishes below; daylight before any core near the feature stair.' },
    ],
  };
}
