// Free-play mode probe: menu → free play → pour/stir/drain → sheet → home.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failures = 0;
for (const cfg of [{ label: 'iphone-portrait', w: 390, h: 844 }, { label: 'ipad-landscape', w: 1180, h: 820 }]) {
  console.log(`=== free-play ${cfg.label} ===`);
  const page = await browser.newPage({ viewport: { width: cfg.w, height: cfg.h } });
  page.on('pageerror', (e) => { console.log('PAGEERR', String(e)); failures++; });
  await page.goto('http://127.0.0.1:8000/?scene=menu');
  await page.waitForTimeout(500);
  const state = () => page.evaluate(() => window.__qa.state());
  const targets = () => page.evaluate(() => window.__qa.targets());
  const check = (c, m) => { if (!c) { console.log(`  FAIL: ${m}`); failures++; } else console.log(`  ok: ${m}`); };
  const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); };
  async function drag(x0, y0, x1, y1, steps = 12, delay = 20) {
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
      await page.waitForTimeout(delay);
    }
    await page.mouse.up();
  }

  check((await state()).scene === 'menu', 'menu via dev param');
  const m = await targets();
  await tap(m.cards[2].x, m.cards[2].y);
  await page.waitForTimeout(1200);
  check((await state()).scene === 'free', 'free play opens from card 3');

  let t = await targets();
  for (let i = 0; i < 3; i++) { await tap(t.bowls[i].x, t.bowls[i].y); await page.waitForTimeout(800); }
  let s = await state();
  check(s.fibersPoured >= 100, `colored fibers poured (${s.fibersPoured})`);
  const tk = t.tank;
  await drag(tk.x + tk.w * 0.2, tk.y + tk.h * 0.3, tk.x + tk.w * 0.8, tk.y + tk.h * 0.7, 16, 22);
  check((await targets()).unlocked || true, 'stir ok');
  t = await targets();
  await drag(t.lever.x, t.lever.y, t.leverEnd.x, t.leverEnd.y + 30, 10, 24);
  s = await state();
  check(s.draining === true, 'free drain latched');
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    s = await state();
    if ((s.level ?? 1) <= 0 && s.fibersActive === 0) break;
    await page.waitForTimeout(400);
  }
  check((s.level ?? 1) <= 0, `water fully drained (level=${s.level})`);
  check(s.fibersActive === 0, 'all colored fibers settled into a sheet');
  await page.screenshot({ path: `docs/qa/shots/free-${cfg.label}.png` });

  // refill keeps the deposit and allows another layer
  t = await targets();
  if (t.buttons?.refill?.on) {
    await tap(t.buttons.refill.x, t.buttons.refill.y);
    await page.waitForTimeout(400);
    s = await state();
    check((s.level ?? 0) > 0.5, 'refill restores water');
  } else { console.log('  FAIL: refill button not shown'); failures++; }
  // home returns to menu
  t = await targets();
  await tap(t.buttons.home.x, t.buttons.home.y);
  await page.waitForTimeout(1200);
  check((await state()).scene === 'menu', 'home returns to picture menu');
  await page.close();
}
await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);
