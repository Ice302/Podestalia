// Renders story frames with headless Chrome so you can review every chapter.
// Setup:  npm i -D puppeteer-core   (and serve the site: python3 -m http.server 8765)
// Usage:  node tools/snapshot.mjs [outDir] [width] [height] [T,T,...] [query]
//   e.g.  node tools/snapshot.mjs shots 1440 900 0,1.85,3.55,5.35,9.45,10.2
// T is story time: chapter index + progress (0 = intro … 10 = gallery, 11 = contact).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [outDir = 'shots', w = '1440', h = '900', ts = '0,1.85,3.55,5.35,9.45,10.2', query = ''] = process.argv.slice(2);
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.env.URL || 'http://127.0.0.1:8765/';
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome, headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: +w, height: +h, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
await page.goto(`${url}?debug${query ? '&' + query : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
for (const T of ts.split(',').map(Number)) {
  await page.evaluate((T) => window.scrollTo(0, window.__podestalia.scroll.yAt(T) + 1), T);
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${outDir}/T${T.toFixed(2)}.png` });
  console.log(`saved ${outDir}/T${T.toFixed(2)}.png`);
}
console.log(problems.length ? problems.join('\n') : 'no page errors');
await browser.close();
