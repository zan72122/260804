// Visual audit: free-play layout at iphone-landscape + drain motion frames.
// Read-only w.r.t. src/. Screenshots go to docs/qa/shots/audit-*.png
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const cfg = { label: 'iphone-landscape', w: 844, h: 390 };
const page = await browser.newPage({ viewport: { width: cfg.w, height: cfg.h } });
page.on('pageerror', (e) => console.log('PAGEERR', String(e)));
await page.goto('http://127.0.0.1:8000/?scene=menu');
await page.waitForTimeout(600);
const state = () => page.evaluate(() => window.__qa.state());
const targets = () => page.evaluate(() => window.__qa.targets());
const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); };
async function drag(x0, y0, x1, y1, steps = 12, delay = 20) {
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
    await page.waitForTimeout(delay);
  }
  await page.mouse.up();
}

const m = await targets();
await tap(m.cards[2].x, m.cards[2].y);
await page.waitForTimeout(1200);
console.log('scene:', (await state()).scene);
await page.screenshot({ path: 'docs/qa/shots/audit-free-iphone-landscape-empty.png' });

let t = await targets();
console.log('bowls:', JSON.stringify(t.bowls));
console.log('lever:', JSON.stringify(t.lever), 'leverEnd:', JSON.stringify(t.leverEnd));
for (let i = 0; i < Math.min(3, t.bowls.length); i++) { await tap(t.bowls[i].x, t.bowls[i].y); await page.waitForTimeout(700); }
await page.screenshot({ path: 'docs/qa/shots/audit-free-iphone-landscape-poured.png' });

const tk = t.tank;
await drag(tk.x + tk.w * 0.2, tk.y + tk.h * 0.3, tk.x + tk.w * 0.8, tk.y + tk.h * 0.7, 16, 22);
t = await targets();
await drag(t.lever.x, t.lever.y, t.leverEnd.x, t.leverEnd.y + 30, 10, 24);
console.log('draining:', (await state()).draining);
await page.waitForTimeout(1200);
await page.screenshot({ path: 'docs/qa/shots/audit-free-iphone-landscape-drainA.png' });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'docs/qa/shots/audit-free-iphone-landscape-drainB.png' });
await page.close();
await browser.close();
console.log('done');
