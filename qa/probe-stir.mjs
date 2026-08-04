// Focused probe: get to the tank, pour, stir like drive.mjs does, and log
// dispersion + fps over time to diagnose stirring efficacy.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('PAGEERR', String(e)));
await page.goto('http://127.0.0.1:8000/');
await page.waitForTimeout(500);

const state = () => page.evaluate(() => window.__qa.state());
const targets = () => page.evaluate(() => window.__qa.targets());
async function drag(x0, y0, x1, y1, steps = 14, delay = 16) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
    await page.waitForTimeout(delay);
  }
  await page.mouse.up();
}
const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); };

// intro fast-path
for (let i = 0; i < 5; i++) {
  const st = await state();
  if (st.scene !== 'book' || st.pending) break;
  const t = await targets();
  if (!t.tab) break;
  await drag(t.tab.x, t.tab.y, t.tab.x, t.tab.y - 260, 12, 20);
}
await page.waitForTimeout(1500);
{
  const t = await targets();
  await page.mouse.move(t.lens.x, t.lens.y);
  await page.mouse.down();
  outer:
  for (const d of t.damages) {
    for (let i = 1; i <= 10; i++) {
      const cur = await targets();
      if (!cur.lens) break outer;
      await page.mouse.move(cur.lens.x + (d.x - cur.lens.x) * 0.5, cur.lens.y + (d.y - cur.lens.y) * 0.5);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(300);
  }
  await page.mouse.up();
}
await page.waitForTimeout(2000);
{
  const t = await targets();
  await drag(t.page.x, t.page.y, t.target.x, t.target.y, 18, 20);
}
await page.waitForTimeout(4000);
let s = await state();
console.log('scene:', s.scene);

const t = await targets();
for (let n = 0; n < 3; n++) {
  await tap(t.bowls[n % t.bowls.length].x, t.bowls[n % t.bowls.length].y);
  await page.waitForTimeout(900);
}
s = await state();
console.log('poured', s.fibersPoured, 'active', s.fibersActive, 'disp', s.dispersion.toFixed(3));

const fps = await page.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 > 2000) r((n / 2).toFixed(1)); else requestAnimationFrame(f); };
  requestAnimationFrame(f);
}));
console.log('tank fps:', fps);

const tk = t.tank;
for (let round = 0; round < 8; round++) {
  await page.mouse.move(tk.x + tk.w * 0.2, tk.y + tk.h * 0.25);
  await page.mouse.down();
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 3.2;
    await page.mouse.move(
      tk.x + tk.w * (0.5 + 0.36 * Math.cos(a + round)),
      tk.y + tk.h * (0.5 + 0.36 * Math.sin(a * 1.3 + round)));
    await page.waitForTimeout(24);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  s = await state();
  console.log(`round ${round}: disp=${s.dispersion.toFixed(3)} slurryT-ish dispersedFlag=${s.flags.dispersed}`);
  if (s.flags.dispersed) break;
}
await page.screenshot({ path: 'docs/qa/shots/probe-stir.png' });
await browser.close();
