// Observe the signature "すうっ" (suction) moment N times and quantify it.
// Metrics per run:
//  - timeline of {t, level, fill, active, perDamage}
//  - participation delay: per-fiber time of first significant motion vs
//    its initial distance to the nearest sink
//  - curvature: mean angle between per-step displacement and the direct
//    line to the fiber's eventual sink region
// Usage: node qa/probe-drain.mjs [runs] [shotsLabel]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const RUNS = Number(process.argv[2] || 10);
const SHOT_LABEL = process.argv[3] || 'drain';
const SIZES = [
  { label: 'iphone-portrait', w: 390, h: 844 },
  { label: 'iphone-landscape', w: 844, h: 390 },
  { label: 'ipad-portrait', w: 820, h: 1180 },
  { label: 'ipad-landscape', w: 1180, h: 820 },
];
fs.mkdirSync('docs/qa/drain', { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const allRuns = [];

for (let run = 0; run < RUNS; run++) {
  const cfg = SIZES[run % SIZES.length];
  const page = await browser.newPage({ viewport: { width: cfg.w, height: cfg.h } });
  page.on('pageerror', (e) => console.log('PAGEERR', String(e)));
  await page.goto('http://127.0.0.1:8000/');
  await page.waitForTimeout(400);
  const state = () => page.evaluate(() => window.__qa.state());
  const targets = () => page.evaluate(() => window.__qa.targets());
  const fibers = () => page.evaluate(() => window.__qa.fibers());
  const sinks = () => page.evaluate(() => window.__qa.sinks());
  async function drag(x0, y0, x1, y1, steps = 12, delay = 18) {
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
      await page.waitForTimeout(delay);
    }
    await page.mouse.up();
  }
  const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up(); };

  // fast path to tank
  for (let i = 0; i < 5; i++) {
    const st = await state();
    if (st.scene !== 'book' || st.pending) break;
    const t = await targets();
    if (!t.tab) break;
    await drag(t.tab.x, t.tab.y, t.tab.x, Math.max(20, t.tab.y - cfg.h * 0.3), 10, 16);
  }
  await page.waitForTimeout(1300);
  {
    const t = await targets();
    if (t.lens) {
      await page.mouse.move(t.lens.x, t.lens.y);
      await page.mouse.down();
      outer:
      for (const d of t.damages) {
        for (let i = 1; i <= 10; i++) {
          const cur = await targets();
          if (!cur.lens) break outer;
          await page.mouse.move(cur.lens.x + (d.x - cur.lens.x) * 0.5, cur.lens.y + (d.y - cur.lens.y) * 0.5);
          await page.waitForTimeout(80);
        }
        await page.waitForTimeout(250);
      }
      await page.mouse.up();
    }
  }
  await page.waitForTimeout(1800);
  {
    const t = await targets();
    if (t.page && t.target) await drag(t.page.x, t.page.y, t.target.x, t.target.y, 14, 18);
  }
  await page.waitForTimeout(3500);
  let t = await targets();
  for (let n = 0; n < 3; n++) { await tap(t.bowls[n].x, t.bowls[n].y); await page.waitForTimeout(750); }
  const tk = t.tank;
  await page.mouse.move(tk.x + tk.w * 0.25, tk.y + tk.h * 0.3);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 3;
    await page.mouse.move(tk.x + tk.w * (0.5 + 0.34 * Math.cos(a)), tk.y + tk.h * (0.5 + 0.34 * Math.sin(a * 1.3)));
    await page.waitForTimeout(22);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  let s = await state();
  for (let extra = 0; extra < 3 && !(await state()).flags.dispersed; extra++) {
    console.log(`run${run}: not dispersed, stirring again`);
    await page.mouse.move(tk.x + tk.w * 0.3, tk.y + tk.h * 0.35);
    await page.mouse.down();
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2.6;
      await page.mouse.move(tk.x + tk.w * (0.5 + 0.33 * Math.cos(a + extra)), tk.y + tk.h * (0.5 + 0.33 * Math.sin(a * 1.2)));
      await page.waitForTimeout(24);
    }
    await page.mouse.up();
    await page.waitForTimeout(800);
  }

  // capture initial fiber field + sinks, then latch the lever
  const sk = await sinks();
  const f0 = await fibers();
  t = await targets();
  const shotTimes = run < SIZES.length ? [0, 0.4, 0.8, 1.4, 2.2, 3.2, 4.5, 6.5, 9, 12] : [];
  const t0 = Date.now();
  const timeline = [];
  const fiberFrames = [];
  // latch (async while sampling: do the drag first — it takes ~0.3s)
  await drag(t.lever.x, t.lever.y, t.leverEnd.x, t.leverEnd.y + 30, 8, 18);
  if (!(await state()).flags.latched) {
    const t2 = await targets();
    await drag(t2.lever.x, t2.lever.y, t2.leverEnd.x, t2.leverEnd.y + 30, 8, 18);
  }
  let shotIdx = 0;
  while (Date.now() - t0 < 26000) {
    const el = (Date.now() - t0) / 1000;
    s = await state();
    timeline.push({
      t: +el.toFixed(2), level: s.level, fill: +(s.fill ?? 0).toFixed(3),
      active: s.fibersActive, latched: s.flags.latched, cast: s.flags.cast,
      dmg: s.damages.map(d => +d.fill.toFixed(2)),
    });
    if ((timeline.length % 2) === 0) fiberFrames.push({ t: el, f: await fibers() });
    if (shotIdx < shotTimes.length && el >= shotTimes[shotIdx]) {
      await page.screenshot({ path: `docs/qa/drain/${SHOT_LABEL}-${cfg.label}-t${shotTimes[shotIdx].toFixed(1)}.png` });
      shotIdx++;
    }
    if (s.flags.cast) break;
    await page.waitForTimeout(180);
  }
  // ---- offline metrics
  const nearSink = (x, y) => {
    let bd = 1e9;
    for (const k of sk) { const d = Math.hypot(k.x - x, k.y - y); if (d < bd) bd = d; }
    return bd;
  };
  // participation delay: first frame where fiber moved >0.02 from its start
  const startPos = new Map(f0.filter(f => !f.st).map(f => [f.i, f]));
  const partic = [];
  for (const [i, p] of startPos) {
    for (const fr of fiberFrames) {
      const f = fr.f[i];
      if (!f) break;
      if (Math.hypot(f.x - p.x, f.y - p.y) > 0.04) { partic.push({ d0: nearSink(p.x, p.y), t: fr.t }); break; }
    }
  }
  // curvature: mean |angle(displacement, toNearestSink)| over moving fibers
  let angSum = 0, angN = 0;
  for (let fi = 1; fi < fiberFrames.length; fi++) {
    const A = fiberFrames[fi - 1], B = fiberFrames[fi];
    for (const fb of B.f) {
      if (fb.st) continue;
      const fa = A.f[fb.i];
      if (!fa || fa.st) continue;
      const dx = fb.x - fa.x, dy = fb.y - fa.y;
      const sp = Math.hypot(dx, dy);
      if (sp < 0.02) continue;
      // direction to nearest sink from previous pos
      let bd = 1e9, sx = 0, sy = 0;
      for (const k of sk) { const d = Math.hypot(k.x - fa.x, k.y - fa.y); if (d < bd) { bd = d; sx = k.x; sy = k.y; } }
      const a1 = Math.atan2(dy, dx), a2 = Math.atan2(sy - fa.y, sx - fa.x);
      let da = Math.abs(a1 - a2) % (Math.PI * 2);
      if (da > Math.PI) da = Math.PI * 2 - da;
      angSum += da; angN++;
    }
  }
  const castRow = timeline.find(r => r.cast);
  const latchRow = timeline.find(r => r.latched);
  const lvl = (v) => timeline.find(r => r.latched && r.level <= v);
  const summary = {
    run, size: cfg.label,
    latchT: latchRow?.t ?? null,
    castT: castRow?.t ?? null,
    drainDur: castRow && latchRow ? +(castRow.t - latchRow.t).toFixed(2) : null,
    levelStages: { l75: lvl(0.75)?.t ?? null, l50: lvl(0.5)?.t ?? null, l25: lvl(0.25)?.t ?? null, l05: lvl(0.05)?.t ?? null },
    fillAtHalfLevel: lvl(0.5) ? lvl(0.5).fill : null,
    meanAngleDeg: angN ? +(angSum / angN * 180 / Math.PI).toFixed(1) : null,
    particNearT: avg(partic.filter(p => p.d0 < 0.2).map(p => p.t)),
    particFarT: avg(partic.filter(p => p.d0 > 0.32).map(p => p.t)),
    particN: partic.length,
  };
  console.log(JSON.stringify(summary));
  allRuns.push({ summary, timeline });
  await page.close();
}
function avg(a) { return a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : null; }
fs.writeFileSync(`docs/qa/drain/${SHOT_LABEL}-runs.json`, JSON.stringify(allRuns, null, 1));
await browser.close();
console.log('done');
