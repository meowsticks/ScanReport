// Regression test for the annotation-overflow bug.
//
// Bug (fixed): scan-photo annotations (arrows, lines, circles, text) were drawn
// on an overlay canvas sized in on-screen pixels. When the report printed/exported
// to PDF the photo reflowed smaller, but the canvas kept its screen size, so the
// strokes overflowed the photo and ran down the page onto later pages.
//
// This drives the REAL print path the desktop app uses (Electron printToPDF,
// file:// load, dark theme) with a heavily-annotated photo, and writes a PDF you
// can eyeball: every annotation must stay INSIDE the photo box.
//
// Run:
//   cd gssi-report-app && npm run build           # build the dist first
//   # Windows:  node ..\pdf-mockups\test-annotation-overflow.cjs
//   # Linux:    xvfb-run -a ./node_modules/.bin/electron --no-sandbox ../pdf-mockups/test-annotation-overflow.cjs
// Output: annotation-overflow-test.pdf next to this script. Open it and confirm
// the arrow/line/circle/label sit within the photo on both the scan-photo card
// and the full-size "MARKED-UP SLAB" page.

require('electron').app.commandLine.appendSwitch('no-sandbox');
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'gssi-report-app', 'dist', 'index.html');
const OUT = path.join(__dirname, 'annotation-overflow-test.pdf');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 1000 });
  await win.loadFile(DIST);
  await win.webContents.executeJavaScript(`(function(){
    const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
    const x = c.getContext('2d'); x.fillStyle = '#9a9a92'; x.fillRect(0,0,900,1200);
    x.fillStyle = '#7a7a72';
    for (let i=0;i<40;i++){ x.fillRect(Math.random()*900, Math.random()*1200, 30, 8); }
    const dataUrl = c.toDataURL('image/jpeg', 0.8);
    // Big annotations that used to overflow the photo at print scale.
    const ann = [
      { type:'line',   color:'black', strokeScale:6, start:{x:0.5,y:0.08}, end:{x:0.5,y:0.96} },
      { type:'arrow',  color:'red',   strokeScale:6, start:{x:0.15,y:0.2}, end:{x:0.82,y:0.88} },
      { type:'circle', color:'black', strokeScale:5, center:{x:0.55,y:0.7}, radius:0.12 },
      { type:'text',   color:'black', position:{x:0.18,y:0.42}, content:'Top Rebar 3" Deep', fontSize:14, strokeScale:5 }
    ];
    const report = {
      client:'TEST', projectNo:'ANNOT-TEST', scanArea:'overflow check', scanDate:'2026-06-08',
      tier:'standard', status:'issued', showWatermark:false, cores:[], targets:[],
      scanPhotos:[{ id:'p1', dataUrl, caption:'Annotation overflow test', confidence:'high', scanType:'site', annotations:ann }],
      scanLocations:[]
    };
    localStorage.clear();
    localStorage.setItem('ak_theme','dark');
    localStorage.setItem('ak_help_autoshow','0');
    localStorage.setItem('ak_last_seen_version','99.0.0');
    localStorage.setItem('ak_report_t', JSON.stringify(report));
    localStorage.setItem('ak_reports_index','[{"id":"t","name":"T","updatedAt":0}]');
    localStorage.setItem('ak_current_report','t');
    return true;
  })()`);
  await win.loadFile(DIST);
  await new Promise(r => setTimeout(r, 1800));
  const data = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'Letter' });
  fs.writeFileSync(OUT, data);
  console.log('wrote', OUT, '·', data.length, 'bytes');
  app.quit();
});
