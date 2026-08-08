/* 実機に近いサイズで実際に一周操作して検証するためのツール
   使い方: node tools/playtest.js [device] [outdir]                     */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEVICES = {
  'iphone-p': { width: 390, height: 844, dpr: 3 },
  'iphone-l': { width: 844, height: 390, dpr: 3 },
  'ipad-p': { width: 820, height: 1180, dpr: 2 },
  'ipad-l': { width: 1180, height: 820, dpr: 2 }
};

const which = process.argv[2] || 'iphone-p';
const OUT = path.resolve(process.argv[3] || ('/tmp/claude-0/-home-user-260804/511ee5a0-b55b-5641-86d9-adb929afe053/scratchpad/shots-' + which));
fs.mkdirSync(OUT, { recursive: true });

const ROOT = path.resolve(__dirname, '..');
const d = DEVICES[which];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader']
  });
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: d.dpr,
    hasTouch: true,
    isMobile: true
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));

  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(900);

  let shotN = 0;
  const shot = async (name) => {
    shotN++;
    await page.screenshot({ path: path.join(OUT, String(shotN).padStart(2, '0') + '-' + name + '.png') });
  };
  const stage = () => page.evaluate(() => window.PZ.game.stageName);
  const info = () => page.evaluate(() => {
    const g = window.PZ.game;
    return {
      stage: g.stageName, meanR: Math.round(g.pizza.meanR()), bake: +g.pizza.bake.toFixed(2),
      sauce: +g.pizza.sauceCover.toFixed(2), tops: g.pizza.toppings.length,
      pzv: +g.pz.v.toFixed(2), cuts: g.pizza.cuts.length, fps: Math.round(g.fps || 0)
    };
  });

  // 世界座標 → 画面座標
  const w2s = (x, y) => page.evaluate(([x, y]) => {
    const p = window.PZ.game.toScreen(x, y); return { x: p.x, y: p.y };
  }, [x, y]);
  const pathScreen = (v) => page.evaluate((v) => {
    const g = window.PZ.game; const q = g.pathAt(v); const p = g.toScreen(q.x, q.y);
    return { x: p.x, y: p.y };
  }, v);

  const swipe = async (x0, y0, x1, y1, steps = 20, hold = 0) => {
    await page.touchscreen.tap(-5, -5).catch(() => { });
    const t = page.touchscreen;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await page.mouse.move(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      await page.waitForTimeout(16);
    }
    if (hold) await page.waitForTimeout(hold);
    await page.mouse.up();
  };
  const waitStage = async (notThis, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 9000)) {
      if ((await stage()) !== notThis) return true;
      await page.waitForTimeout(200);
    }
    return false;
  };
  const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); };

  const log = [];
  const step = async (label) => { const i = await info(); log.push(label + ' -> ' + JSON.stringify(i)); return i; };

  // 1) レシピをえらぶ
  await shot('choose');
  const card = await page.evaluate(() => {
    const s = window.PZ.stages.CHOOSE; return { x: s.cards[0].x, y: s.cards[0].y };
  });
  await tap(card.x, card.y);
  await page.waitForTimeout(400);
  await step('after-choose');

  // 2) 生地玉を置く
  await shot('dough');
  const b = await page.evaluate(() => { const g = window.PZ.game; const p = g.toScreen(g.board.x, g.board.y); return p; });
  await tap(b.x, b.y);
  await page.waitForTimeout(900);
  await step('after-place');
  await shot('shape-start');

  // 3) 押し広げる＋まわす
  for (let round = 0; round < 26; round++) {
    const c = await page.evaluate(() => { const g = window.PZ.game; return g.toScreen(g.pz.x, g.pz.y); });
    const a = (round / 26) * Math.PI * 2 * 3;
    const r = 40 + (round % 5) * 12;
    await swipe(c.x + Math.cos(a) * r * 0.3, c.y + Math.sin(a) * r * 0.3 * 0.6,
      c.x + Math.cos(a) * r * 2.4, c.y + Math.sin(a) * r * 2.4 * 0.6, 6);
    const s = await stage();
    if (s !== 'SHAPE') break;
  }
  await page.waitForTimeout(300);
  // まだ SHAPE なら円を描いて広げる
  for (let round = 0; round < 40 && (await stage()) === 'SHAPE'; round++) {
    const c = await page.evaluate(() => { const g = window.PZ.game; return { s: g.toScreen(g.pz.x, g.pz.y), r: g.pizza.meanR() * g.zoom }; });
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2 + round;
      pts.push([c.s.x + Math.cos(a) * c.r * 0.75, c.s.y + Math.sin(a) * c.r * 0.75 * 0.6]);
    }
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1]); await page.waitForTimeout(14); }
    await page.mouse.up();
  }
  await step('after-shape');
  await shot('shaped');

  // 4) 空中へ投げる
  for (let k = 0; k < 3 && (await stage()) === 'TOSS'; k++) {
    const c = await page.evaluate(() => window.PZ.game.toScreen(window.PZ.game.pz.x, window.PZ.game.pz.y));
    await swipe(c.x, c.y, c.x, Math.max(20, c.y - d.height * 0.42), 8);
    await page.waitForTimeout(500);
    if (k === 0) await shot('toss-air');
    await page.waitForTimeout(1400);
  }
  await waitStage('TOSS', 30000);
  await step('after-toss');

  // 5) ソース
  await shot('sauce-start');
  for (let k = 0; k < 12 && (await stage()) === 'SAUCE'; k++) {
    const c = await page.evaluate(() => { const g = window.PZ.game; return { s: g.toScreen(g.pz.x, g.pz.y), r: g.pizza.innerR() * g.zoom }; });
    const pts = [];
    for (let i = 0; i <= 46; i++) {
      const u = i / 46;
      const a = u * Math.PI * 2 * 2.6 + k;
      const rr = u * c.r * 0.92;
      pts.push([c.s.x + Math.cos(a) * rr, c.s.y + Math.sin(a) * rr * 0.6]);
    }
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1]); await page.waitForTimeout(10); }
    await page.mouse.up();
  }
  await waitStage('SAUCE', 20000);
  await step('after-sauce');
  await shot('sauced');

  // 6) 具材
  for (let k = 0; k < 16 && (await stage()) === 'TOPPING'; k++) {
    const st = await page.evaluate(() => {
      const s = window.PZ.stages.TOPPING, g = window.PZ.game;
      return { bowls: s.bowls.map(b => ({ x: b.x, y: b.y })), pz: g.toScreen(g.pz.x, g.pz.y), r: g.pizza.innerR() * g.zoom, ready: s.peelReady };
    });
    if (st.ready) break;
    const bw = st.bowls[k % st.bowls.length];
    const a = k * 1.9, rr = (0.25 + (k % 3) * 0.22) * st.r;
    await swipe(bw.x, bw.y, st.pz.x + Math.cos(a) * rr, st.pz.y + Math.sin(a) * rr * 0.6, 10);
    await page.waitForTimeout(120);
  }
  await step('after-topping');
  await shot('topped');

  // 7) ピールへ移す
  {
    const st = await page.evaluate(() => {
      const g = window.PZ.game; const q = g.pathAt(-1);
      return { pz: g.toScreen(g.pz.x, g.pz.y), peel: g.toScreen(q.x, q.y) };
    });
    await swipe(st.pz.x, st.pz.y, st.peel.x, st.peel.y, 18);
    await page.waitForTimeout(1000);
  }
  await waitStage('TOPPING', 20000);
  await step('after-toPeel');
  await shot('on-peel');

  // 8) ★ 石窯の奥へスッ ★
  if ((await stage()) === 'INSERT') {
    const p0 = await pathScreen(-1);
    const p1 = await pathScreen(0.55);
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    const N = 26;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      await page.mouse.move(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k);
      await page.waitForTimeout(15);
      if (i === Math.floor(N * 0.55)) await shot('insert-mid');
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
    await shot('insert-done');
  }
  await waitStage('INSERT', 30000);
  await step('after-insert');

  // 9) 焼く
  await page.waitForTimeout(4000);
  await shot('baking');
  await waitStage('BAKE', 90000);
  await step('bake->rotate');

  // 10) 窯の中でくるっ
  if ((await stage()) === 'ROTATE') {
    await shot('rotate-prompt');
    for (let round = 0; round < 6 && (await stage()) === 'ROTATE'; round++) {
      const c = await page.evaluate(() => { const g = window.PZ.game; return { s: g.toScreen(g.pz.x, g.pz.y), r: g.pizza.meanR() * g.pz.scale * g.zoom }; });
      const pts = [];
      for (let i = 0; i <= 22; i++) {
        const a = (i / 22) * Math.PI * 2 * 1.2;
        pts.push([c.s.x + Math.cos(a) * c.r * 0.8, c.s.y + Math.sin(a) * c.r * 0.8 * 0.4]);
      }
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1]); await page.waitForTimeout(14); }
      await page.mouse.up();
      await page.waitForTimeout(200);
    }
    await shot('rotated');
  }
  await waitStage('ROTATE', 40000);
  await step('after-rotate');

  // 11) 引き出す
  await waitStage('BAKE2', 90000);
  if ((await stage()) === 'RETRIEVE') {
    await shot('retrieve-prompt');
    const a0 = await pathScreen(0.62);
    await page.mouse.move(a0.x, a0.y);
    await page.mouse.down();
    await page.waitForTimeout(500);   // ピールが差し込まれるのを待つ
    const a1 = await pathScreen(-0.9);
    const N = 24;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      await page.mouse.move(a0.x + (a1.x - a0.x) * k, a0.y + (a1.y - a0.y) * k);
      await page.waitForTimeout(16);
      if (i === Math.floor(N * 0.5)) await shot('retrieve-mid');
    }
    await page.mouse.up();
    await page.waitForTimeout(1200);
  }
  await waitStage('RETRIEVE', 40000);
  await step('after-retrieve');
  await shot('out');

  // 12) カット
  for (let k = 0; k < 8 && (await stage()) === 'CUT'; k++) {
    const st = await page.evaluate(() => {
      const g = window.PZ.game;
      return { s: g.toScreen(g.pz.x, g.pz.y), r: g.pizza.meanR() * g.zoom, cuts: g.pizza.cuts.length };
    });
    if (st.cuts >= 4) break;
    const a = (st.cuts) * Math.PI / 4;
    await swipe(st.s.x - Math.cos(a) * st.r * 1.1, st.s.y - Math.sin(a) * st.r * 0.66,
      st.s.x + Math.cos(a) * st.r * 1.1, st.s.y + Math.sin(a) * st.r * 0.66, 12);
    await page.waitForTimeout(200);
  }
  await shot('cut');
  // スライスを持ち上げる
  {
    const st = await page.evaluate(() => {
      const g = window.PZ.game; return { s: g.toScreen(g.pz.x, g.pz.y), r: g.pizza.meanR() * g.zoom };
    });
    await page.mouse.move(st.s.x + st.r * 0.4, st.s.y - st.r * 0.25);
    await page.mouse.down();
    await page.waitForTimeout(160);
    await page.mouse.move(st.s.x + st.r * 0.9, st.s.y - st.r * 0.7);
    await page.waitForTimeout(400);
    await shot('cheese-stretch');
    await page.mouse.up();
  }
  await page.waitForTimeout(1600);
  await waitStage('CUT', 20000);
  await step('after-cut');
  await shot('done');

  // fps 計測
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); }
    requestAnimationFrame(f);
  }));
  log.push('fps(headless) = ' + fps);

  console.log('=== ' + which + ' ===');
  console.log(log.join('\n'));
  if (errors.length) { console.log('--- ERRORS ---'); console.log(errors.slice(0, 20).join('\n')); }
  else console.log('no js errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
