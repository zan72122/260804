// Automated play-through of the whole vertical slice, at 4 device sizes.
// Usage: node qa/drive.mjs [labelFilter]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = 'http://127.0.0.1:8000/';
const OUT = 'docs/qa/shots';
const CONFIGS = [
  { label: 'iphone-portrait', w: 390, h: 844 },
  { label: 'iphone-landscape', w: 844, h: 390 },
  { label: 'ipad-portrait', w: 820, h: 1180 },
  { label: 'ipad-landscape', w: 1180, h: 820 },
];

const filter = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

let failures = 0;
for (const cfg of CONFIGS) {
  if (filter && !cfg.label.includes(filter)) continue;
  console.log(`\n=== ${cfg.label} (${cfg.w}x${cfg.h}) ===`);
  const page = await browser.newPage({ viewport: { width: cfg.w, height: cfg.h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(500);

  const state = () => page.evaluate(() => window.__qa.state());
  const targets = () => page.evaluate(() => window.__qa.targets());
  const shot = (name) => page.screenshot({ path: `${OUT}/${cfg.label}-${name}.png` });
  const check = (cond, msg) => {
    if (!cond) { console.log(`  FAIL: ${msg}`); failures++; }
    else console.log(`  ok: ${msg}`);
  };
  async function waitFor(fn, desc, timeout = 30000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await fn()) return true;
      await page.waitForTimeout(200);
    }
    console.log(`  TIMEOUT waiting for: ${desc}`);
    failures++;
    throw new Error(`timeout: ${desc}`);
  }
  const waitScene = (name, timeout) =>
    waitFor(async () => (await state()).scene === name, `scene=${name}`, timeout);
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

  try {
    // ---- 1. book: pull the damaged page out
    let s = await state();
    check(s.scene === 'book', 'starts at book');
    await shot('01-book');
    for (let i = 0; i < 5; i++) {
      const st = await state();
      if (st.scene !== 'book' || st.pending) break;
      const t = await targets();
      if (!t.tab) break;
      await drag(t.tab.x, t.tab.y, t.tab.x, Math.max(20, t.tab.y - cfg.h * 0.3), 12, 20);
    }
    await waitScene('light');
    await shot('02-light');

    // ---- 2. light table: find all damages with the lens
    {
      const t = await targets();
      await page.mouse.move(t.lens.x, t.lens.y);
      await page.mouse.down();
      outer:
      for (const d of t.damages) {
        // approach slowly so the lagging lens can catch up
        for (let i = 1; i <= 10; i++) {
          const cur = await targets();
          if (!cur.lens) break outer; // scene auto-advanced
          await page.mouse.move(cur.lens.x + (d.x - cur.lens.x) * 0.5, cur.lens.y + (d.y - cur.lens.y) * 0.5);
          await page.waitForTimeout(90);
        }
        await page.waitForTimeout(300);
      }
      await page.mouse.up();
      s = await state();
      check(s.flags.found >= 3 || s.scene !== 'light', `found damages (${s.flags.found})`);
    }
    await waitScene('place');
    await shot('03-place');

    // ---- 3. place the paper on the mesh
    {
      const t = await targets();
      await drag(t.page.x, t.page.y, t.target.x, t.target.y, 18, 20);
      s = await state();
      check(s.flags.placed, 'paper placed on mesh');
    }
    await waitScene('tank', 15000); // water fills
    await shot('04-tank-empty');

    // ---- 4. pour fibers
    {
      let t = await targets();
      let n = 0;
      while ((await state()).fibersPoured < (await state()).need && n < 8) {
        await tap(t.bowls[n % t.bowls.length].x, t.bowls[n % t.bowls.length].y);
        await page.waitForTimeout(900);
        n++;
      }
      s = await state();
      check(s.fibersPoured >= s.need, `poured enough fibers (${s.fibersPoured}/${s.need})`);
      check(s.fibersActive > 100, `fibers actually floating (${s.fibersActive})`);
      await shot('05-fibers-poured');

      // ---- 5. stir to disperse
      const tk = t.tank;
      for (let round = 0; round < 10 && !(await state()).flags.dispersed; round++) {
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
      }
      s = await state();
      check(s.flags.dispersed, `dispersed (${s.dispersion.toFixed(2)})`);
      await shot('06-dispersed');
    }

    // ---- rotation persistence test mid-slurry
    {
      const before = await state();
      await page.setViewportSize({ width: cfg.h, height: cfg.w });
      await page.waitForTimeout(400);
      const after = await state();
      check(after.fibersActive === before.fibersActive, `rotation keeps fibers (${before.fibersActive}→${after.fibersActive})`);
      check(Math.abs((after.level ?? 0) - (before.level ?? 0)) < 0.05, 'rotation keeps water level');
      check(after.scene === before.scene, 'rotation keeps scene');
      await shot('07-rotated');
      await page.setViewportSize({ width: cfg.w, height: cfg.h });
      await page.waitForTimeout(400);
    }

    // ---- 6. pull the suction lever down
    {
      const t = await targets();
      check(t.unlocked, 'lever unlocked after dispersal');
      await drag(t.lever.x, t.lever.y, t.leverEnd.x, t.leverEnd.y + 30, 10, 24);
      s = await state();
      check(s.flags.latched, 'lever latched → draining');
      await page.waitForTimeout(900);
      const mid = await state();
      check(mid.level > 0 && mid.level < 1, `water drains gradually (level=${mid.level?.toFixed(2)})`);
      check(mid.fill > 0.02 && mid.fill < 0.98, `holes fill gradually (fill=${mid.fill?.toFixed(2)})`);
      await shot('08-draining');
    }
    await waitFor(async () => (await state()).flags.cast, 'sheet cast (すうっ complete)', 40000);
    s = await state();
    check(s.damages.every(d => d.done), `all deficits sealed (${s.damages.map(d => d.fill.toFixed(2)).join('/')})`);
    await shot('09-cast');
    await waitScene('couch', 15000);
    await shot('10-couch');

    // ---- 7. support cloth + lift
    {
      let t = await targets();
      await drag(t.cloth.x, t.cloth.y, t.sheet.x, t.sheet.y, 16, 20);
      s = await state();
      check(s.flags.clothOn, 'support cloth on wet sheet');
      t = await targets();
      for (let i = 0; i < 4 && !(await state()).flags.lifted; i++) {
        await drag(t.sheet.x, t.sheet.y + 20, t.sheet.x, Math.max(10, t.sheet.y - cfg.h * 0.35), 12, 18);
      }
      check((await state()).flags.lifted, 'wet sheet lifted with cloth');
    }
    await waitScene('press', 15000);
    await shot('11-press');

    // ---- 8. felt + press
    {
      let t = await targets();
      await drag(t.felt.x, t.felt.y, t.stack.x, t.stack.y, 16, 20);
      check((await state()).flags.feltOn, 'felt placed');
      t = await targets();
      for (let i = 0; i < 5 && (await state()).flags.press < 1 && !(await state()).flags.pressed; i++) {
        await drag(t.wheel.x, t.wheel.y, t.wheel.x, t.wheel.y + cfg.h * 0.3, 10, 20);
      }
      await shot('12-pressing');
      check((await state()).flags.press >= 0.99 || (await state()).flags.pressed, 'press closed');
    }
    await waitScene('dry', 15000);
    await shot('13-dry-wet');

    // ---- 9. dry with strokes, then flip (ひらり)
    {
      let t = await targets();
      for (let i = 0; i < 10 && !(await state()).flags.dried; i++) {
        await drag(t.page.x + 14, t.sheet.y, t.page.x + t.page.w - 14, t.sheet.y + 8, 12, 14);
        await page.waitForTimeout(250);
      }
      check((await state()).flags.dried, 'sheet dried');
      await shot('14-dried');
      t = await targets();
      for (let i = 0; i < 4 && !(await state()).flags.flipped; i++) {
        await drag(t.corner.x - 8, t.corner.y - 8, Math.max(10, t.page.x - 60), t.corner.y - 40, 14, 18);
      }
      check((await state()).flags.flipped, 'page flipped (ひらり)');
      await shot('15-flip');
    }
    await waitScene('ret', 15000);
    await shot('16-return');

    // ---- 10. return to book
    {
      const t = await targets();
      await drag(t.page.x, t.page.y, t.slot.x, t.slot.y, 18, 20);
      check((await state()).flags.returned, 'page returned to book');
      await waitFor(async () => (await targets()).phase === 'turn', 'book reopened', 15000);
      await shot('17-book-open');
      const t2 = await targets();
      await drag(t2.slot.x + 60, t2.slot.y, t2.slot.x - cfg.w * 0.3, t2.slot.y, 12, 18);
      await waitFor(async () => (await targets()).phase === 'done', 'restored page turns safely', 10000);
      await shot('18-page-turn');
    }
    await waitScene('menu', 15000);
    await shot('19-menu');

    // ---- 11. two taps to play again
    {
      const t = await targets();
      await tap(t.cards[0].x, t.cards[0].y);
      await waitScene('book', 8000);
      s = await state();
      check(s.scene === 'book', 'replay same paper reachable in 1 tap');
      await shot('20-replay');
    }

    check(errors.length === 0, errors.length ? `console errors: ${errors.slice(0, 3).join(' | ')}` : 'no console errors');
  } catch (e) {
    console.log(`  EXCEPTION: ${e.stack}`);
    failures++;
    await shot('99-exception');
  }
  await page.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
