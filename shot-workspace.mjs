import puppeteer from 'puppeteer';

const URL = 'http://127.0.0.1:5173/';
const DEMO = '/home/user/ScanReport/gssi-report-app/samples/demo-L2-slab-20-cores.json';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
page.on('dialog', d => d.accept().catch(() => {}));

await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => {
  localStorage.setItem('ak_help_autoshow', '0');
  localStorage.setItem('ak_last_seen_version', '99.0.0');
});
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });

const input = await page.waitForSelector('input[accept*=".akscan"]', { timeout: 20000 });
await input.uploadFile(DEMO);
await new Promise(r => setTimeout(r, 2500));

// Wide: should show the 3-column workspace (jump-nav | report | At-a-glance rail)
await page.screenshot({ path: '/tmp/ws-wide.png' });

// Narrow: should collapse to the single column (like the old layout)
await page.setViewport({ width: 760, height: 1000 });
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: '/tmp/ws-narrow.png' });

await browser.close();
console.log('WROTE /tmp/ws-wide.png and /tmp/ws-narrow.png');
