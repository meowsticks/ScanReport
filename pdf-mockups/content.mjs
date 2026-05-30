// Shared pieces for the PDF mockups: brand CSS, the report body, and the logo.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.');
export const logoData = 'data:image/png;base64,' +
  fs.readFileSync(path.join(OUT, 'logo.png')).toString('base64');

export const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export const baseCSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --ink:#111; --mut:#555; --faint:#777; --line:#cfcfcf;
    --red:#c0282d; --red-soft:#f7e9ea; --paper:#fff;
    --safe:#1d7a3a; --caution:#b8770a; --nogo:#c0282d;
  }
  body{font-family:'Inter','Segoe UI',-apple-system,system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;color:var(--ink);
    font-feature-settings:"kern" 1,"liga" 1,"tnum" 1;font-variant-numeric:tabular-nums}
  .page{width:8.5in;min-height:11in;background:var(--paper);padding:0.6in 0.65in 0.7in;position:relative}
  h2.sec{font-size:10.5pt;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);
    border-bottom:1px solid var(--line);padding-bottom:4px;margin:18px 0 10px}
  .muted{color:var(--mut)} .faint{color:var(--faint)}
  .pgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;font-size:9.5pt}
  .pgrid .row{display:flex;justify-content:space-between;border-bottom:1px dotted #e2e2e2;padding:3px 0}
  .pgrid .row b{color:var(--mut);font-weight:600;letter-spacing:.02em}
  table.find{width:100%;border-collapse:collapse;font-size:9pt;margin-top:4px}
  table.find th{background:#f0f0f0;text-transform:uppercase;font-size:7.5pt;letter-spacing:.08em;
    text-align:left;padding:6px 8px;border:1px solid #ccc;color:#333}
  table.find td{padding:6px 8px;border:1px solid #d8d8d8;vertical-align:top}
  .pill{display:inline-block;font-size:7.5pt;font-weight:700;letter-spacing:.05em;
    text-transform:uppercase;padding:2px 8px;border-radius:10px;color:#fff}
  .pill.safe{background:var(--safe)} .pill.caution{background:var(--caution)} .pill.nogo{background:var(--nogo)}
  .scard{border:1px solid #cfcfcf;border-radius:4px;overflow:hidden;margin-top:10px;page-break-inside:avoid}
  .scard .hd{display:flex;justify-content:space-between;align-items:center;
    background:#fafafa;border-bottom:1px solid #e3e3e3;padding:7px 10px}
  .scard .hd .t{font-weight:700;font-size:10pt}
  .scard .hd .m{font-size:8pt;color:var(--faint)}
  .scard .bd{display:grid;grid-template-columns:1.45fr 1fr;gap:10px;padding:10px}
  .radar{height:150px;border:1px solid #888;border-radius:2px;position:relative;overflow:hidden;
    background:
      repeating-linear-gradient(0deg,#0b0b0b 0 2px,#1b1b1b 2px 5px,#0f0f0f 5px 9px),
      linear-gradient(180deg,#222,#000)}
  .radar .scale{position:absolute;left:0;top:0;bottom:0;width:26px;background:#111;color:#bbb;
    font-size:6.5pt;border-right:1px solid #444;display:flex;flex-direction:column;
    justify-content:space-between;padding:3px 2px;text-align:center}
  .radar .reb{position:absolute;width:9px;height:9px;border-radius:50%;
    background:radial-gradient(circle,#fff 0 30%,#ffd23f 45%,transparent 70%)}
  .radar .hyp{position:absolute;border:2px solid transparent;border-top-color:#5aa0ff;border-radius:50%}
  .radar .cap{position:absolute;bottom:3px;right:5px;color:#9aa;font-size:6.5pt;letter-spacing:.05em}
  .legend{font-size:8.5pt;line-height:1.7}
  .legend .k{display:inline-block;width:11px;height:11px;border:1px solid #333;
    vertical-align:-1px;margin-right:6px;border-radius:2px}
  .summary{font-size:9.5pt;line-height:1.5;color:#222}
  .disc{margin-top:16px;border-top:1px solid #bbb;padding-top:8px;
    font-size:8pt;line-height:1.5;color:#444;page-break-inside:avoid}
  .pageno{position:absolute;bottom:0.32in;right:0.65in;font-size:8pt;color:var(--faint)}
`;

export const reportBody = `
  <h2 class="sec">Project Information</h2>
  <div class="pgrid">
    <div>
      <div class="row"><b>Site</b><span>1450 Industrial Way, Burnaby BC</span></div>
      <div class="row"><b>Client</b><span>Pinnacle Structural Eng.</span></div>
      <div class="row"><b>Scan date</b><span>2026-05-28</span></div>
      <div class="row"><b>Operator</b><span>D. Cunningham</span></div>
    </div>
    <div>
      <div class="row"><b>Equipment</b><span>GSSI StructureScan Mini XT</span></div>
      <div class="row"><b>Slab type</b><span>200 mm suspended deck</span></div>
      <div class="row"><b>Coverage</b><span>3 grids · 6.2 m²</span></div>
      <div class="row"><b>Project no.</b><span>AKCC-2026-0017</span></div>
    </div>
  </div>

  <h2 class="sec">Scan Summary</h2>
  <p class="summary">Ground-penetrating radar survey performed on the level-2 suspended deck to
  locate embedded reinforcement, post-tension cables and conduit prior to core drilling at three
  proposed locations. Top-mat rebar identified at ~45&nbsp;mm cover on 200&nbsp;mm centres; a single
  post-tension tendon crosses Grid&nbsp;B. No reinforcement detected within the cone of Core&nbsp;A.</p>

  <h2 class="sec">Core Clearance Findings</h2>
  <table class="find">
    <thead><tr><th style="width:54px">Core</th><th style="width:48px">Size</th>
      <th style="width:92px">Verdict</th><th>Clearance &amp; recommendation</th></tr></thead>
    <tbody>
      <tr><td><b>A</b></td><td>4&Prime;</td><td><span class="pill safe">Safe</span></td>
        <td>60&nbsp;mm clear of all targets. Cleared to drill as marked.</td></tr>
      <tr><td><b>B</b></td><td>6&Prime;</td><td><span class="pill caution">Caution</span></td>
        <td>PT tendon within 25&nbsp;mm — relocate 75&nbsp;mm south and re-scan before drilling.</td></tr>
      <tr><td><b>C</b></td><td>4&Prime;</td><td><span class="pill nogo">No-go</span></td>
        <td>Directly over conduit run. Do not drill; redesign required.</td></tr>
    </tbody>
  </table>

  <h2 class="sec">Scan Location — Grid B (Core B)</h2>
  <div class="scard">
    <div class="hd"><span class="t">Grid B · Bay 2 column line</span>
      <span class="m">0.9 m × 0.9 m · depth scale 0–200 mm</span></div>
    <div class="bd">
      <div class="radar">
        <div class="scale"><span>0</span><span>100</span><span>200</span></div>
        <div class="reb" style="left:70px;top:42px"></div>
        <div class="reb" style="left:120px;top:40px"></div>
        <div class="reb" style="left:170px;top:43px"></div>
        <div class="reb" style="left:220px;top:41px"></div>
        <div class="hyp" style="left:150px;top:70px;width:90px;height:46px"></div>
        <div class="cap">GPR B-scan · 1.6 GHz</div>
      </div>
      <div class="legend">
        <div><span class="k" style="background:#111"></span>Rebar — top mat, ~45 mm</div>
        <div><span class="k" style="background:#2b6cff"></span>Post-tension tendon</div>
        <div><span class="k" style="background:#c0282d"></span>Conduit / no-scan zone</div>
        <div style="margin-top:6px" class="faint">Targets marked on slab in matching colours.
          Photo of marked-up area on file.</div>
      </div>
    </div>
  </div>

  <div class="disc"><b>Limitations.</b> GPR results are interpretive and depend on moisture, cover and
  congestion. Clearances are referenced to the marked grid origin and should be verified on site before
  cutting. Aggarwal Kamikazes Cutting &amp; Coring Ltd. accepts no liability for drilling outside the
  cleared zones described above. Report valid for the slab and date stated.</div>
`;
