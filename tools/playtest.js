/* 実機に近いサイズで実際に一周操作して検証する（3D 版）
   node tools/playtest.js [device]                                     */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEVICES = {
  'iphone-p': { width: 390, height: 844, dpr: 2 },
  'iphone-l': { width: 844, height: 390, dpr: 2 },
  'ipad-p': { width: 820, height: 1180, dpr: 1.5 },
  'ipad-l': { width: 1180, height: 820, dpr: 1.5 }
};
const which = process.argv[2] || 'iphone-p';
const d = DEVICES[which];
const OUT = '/tmp/claude-0/-home-user-260804/511ee5a0-b55b-5641-86d9-adb929afe053/scratchpad/shots-' + which;
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await (await browser.newContext({
    viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr, hasTouch: true, isMobile: true
  })).newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(2500);

  let n = 0;
  const shot = async (name) => { n++; await page.screenshot({ path: path.join(OUT, String(n).padStart(2, '0') + '-' + name + '.png') }); };
  const stage = () => page.evaluate(() => window.PZ.game.stageName);
  const info = () => page.evaluate(() => {
    const g = window.PZ.game;
    return {
      stage: g.stageName, meanR: Math.round(g.pizza.meanR()), bake: +g.pizza.bake.toFixed(2),
      sauce: +g.pizza.sauceCover.toFixed(2), tops: g.pizza.toppings.length,
      pzv: +g.pz.v.toFixed(2), slices: g.pizza.sliceCount
    };
  });
  /* ワールド座標 → 画面座標 */
  const w2s = (x, y, z) => page.evaluate(([x, y, z]) =>
    window.PZ.game.toScreen(new THREE.Vector3(x, y, z)), [x, y, z]);
  const pzScreen = () => page.evaluate(() => {
    const g = window.PZ.game;
    const c = g.toScreen(g.pz.pos.clone());
    const e = g.toScreen(g.pz.pos.clone().add(new THREE.Vector3(g.pizza.meanR() * 0.00075, 0, 0)));
    return { x: c.x, y: c.y, r: Math.abs(e.x - c.x) };
  });
  const pathScreen = (v) => page.evaluate((v) => {
    const g = window.PZ.game, p = window.PZ.pathAt(v);
    return g.toScreen(new THREE.Vector3(p.x, p.y, p.z));
  }, v);

  const swipe = async (x0, y0, x1, y1, steps = 18) => {
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await page.mouse.move(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
      await page.waitForTimeout(14);
    }
    await page.mouse.up();
  };
  const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); };
  const waitStage = async (notThis, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) {
      if ((await stage()) !== notThis) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const log = [];
  const step = async (l) => { log.push(l + ' -> ' + JSON.stringify(await info())); };

  // 1) えらぶ
  await shot('choose');
  const card = await page.evaluate(() => {
    const g = window.PZ.game, c = window.PZ.stages.CHOOSE.cards[0];
    return g.toScreen(c.position.clone().setY(c.position.y + 0.03));
  });
  await tap(card.x, card.y);
  await page.waitForTimeout(600);
  await step('after-choose');

  // 2) 生地玉
  await shot('dough');
  const b = await w2s(-0.62, 0.95, -0.34);
  await tap(b.x, b.y);
  await waitStage('DOUGH', 8000);
  await step('after-place');

  // 3) のばす＋まわす
  for (let round = 0; round < 40 && (await stage()) === 'SHAPE'; round++) {
    const c = await pzScreen();
    const rr = Math.max(28, c.r);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2 + round * 0.7;
      const k = 0.45 + (round % 4) * 0.22;
      pts.push([c.x + Math.cos(a) * rr * k, c.y + Math.sin(a) * rr * k * 0.62]);
    }
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
    for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1]); await page.waitForTimeout(12); }
    await page.mouse.up();
  }
  await step('after-shape');
  await shot('shaped');

  // 4) とばす
  for (let k = 0; k < 3 && (await stage()) === 'TOSS'; k++) {
    const c = await pzScreen();
    await swipe(c.x, c.y, c.x, Math.max(20, c.y - d.height * 0.4), 8);
    await page.waitForTimeout(600);
    if (k === 0) await shot('toss-air');
    await page.waitForTimeout(1500);
  }
  await waitStage('TOSS', 20000);
  await step('after-toss');

  // 5) ソース
  await shot('sauce-start');
  for (let k = 0; k < 14 && (await stage()) === 'SAUCE'; k++) {
    const c = await pzScreen();
    const pts = [];
    for (let i = 0; i <= 46; i++) {
      const u = i / 46, a = u * Math.PI * 2 * 2.8 + k, rr = u * c.r * 0.9;
      pts.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.62]);
    }
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
    for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1]); await page.waitForTimeout(9); }
    await page.mouse.up();
  }
  await waitStage('SAUCE', 20000);
  await step('after-sauce');
  await shot('sauced');

  // 6) ぐざい
  for (let k = 0; k < 18 && (await stage()) === 'TOPPING'; k++) {
    const st = await page.evaluate(() => {
      const g = window.PZ.game, s = window.PZ.stages.TOPPING;
      if (!s.bowls) return null;
      return {
        bowls: s.bowls.map(b => g.toScreen(b.group.position.clone().setY(b.group.position.y + 0.04))),
        ready: s.peelReady
      };
    });
    if (!st || st.ready) break;
    const c = await pzScreen();
    const bw = st.bowls[k % st.bowls.length];
    const a = k * 1.9, rr = (0.25 + (k % 3) * 0.2) * c.r;
    await swipe(bw.x, bw.y, c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.62, 10);
    await page.waitForTimeout(120);
  }
  await step('after-topping');
  await shot('topped');

  // 7) ピールへ
  {
    const c = await pzScreen();
    const pp = await pathScreen(-1);
    await swipe(c.x, c.y, pp.x, pp.y, 18);
  }
  await waitStage('TOPPING', 20000);
  await step('after-toPeel');
  await shot('on-peel');

  // 8) ★ 窯の奥へスッ ★
  if ((await stage()) === 'INSERT') {
    const p0 = await pathScreen(-1), p1 = await pathScreen(0.55);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down();
    const N = 24;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      await page.mouse.move(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k);
      await page.waitForTimeout(16);
      if (i === Math.floor(N * 0.6)) await shot('insert-mid');
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
    await shot('insert-done');
  }
  await waitStage('INSERT', 20000);
  await step('after-insert');

  // 9) 焼く
  await page.waitForTimeout(3500);
  await shot('baking');
  await waitStage('BAKE', 90000);
  await step('bake->rotate');

  // 10) くるっ
  if ((await stage()) === 'ROTATE') {
    await shot('rotate-prompt');
    for (let round = 0; round < 8 && (await stage()) === 'ROTATE'; round++) {
      const c = await pzScreen();
      const pts = [];
      for (let i = 0; i <= 22; i++) {
        const a = (i / 22) * Math.PI * 2 * 1.2;
        pts.push([c.x + Math.cos(a) * c.r * 0.8, c.y + Math.sin(a) * c.r * 0.45]);
      }
      await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
      for (const p of pts.slice(1)) { await page.mouse.move(p[0], p[1]); await page.waitForTimeout(14); }
      await page.mouse.up();
      await page.waitForTimeout(250);
    }
    await shot('rotated');
  }
  await waitStage('ROTATE', 40000);
  await step('after-rotate');

  // 11) 引き出す
  await waitStage('BAKE2', 90000);
  if ((await stage()) === 'RETRIEVE') {
    await shot('retrieve-prompt');
    const a0 = await pathScreen(0.42);
    await page.mouse.move(a0.x, a0.y); await page.mouse.down();
    await page.waitForTimeout(600);
    const a1 = await pathScreen(-0.9);
    const N = 22;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      await page.mouse.move(a0.x + (a1.x - a0.x) * k, a0.y + (a1.y - a0.y) * k);
      await page.waitForTimeout(16);
      if (i === Math.floor(N * 0.5)) await shot('retrieve-mid');
    }
    await page.mouse.up();
    await page.waitForTimeout(1400);
  }
  await waitStage('RETRIEVE', 40000);
  await step('after-retrieve');
  await shot('out');

  // 12) カット
  for (let k = 0; k < 10 && (await stage()) === 'CUT'; k++) {
    const st = await page.evaluate(() => ({ n: window.PZ.stages.CUT.cutN }));
    if (st.n >= 4) break;
    const c = await pzScreen();
    const a = st.n * Math.PI / 4;
    await swipe(c.x - Math.cos(a) * c.r * 1.2, c.y - Math.sin(a) * c.r * 0.7,
      c.x + Math.cos(a) * c.r * 1.2, c.y + Math.sin(a) * c.r * 0.7, 12);
    await page.waitForTimeout(250);
  }
  await shot('cut');
  {
    const c = await pzScreen();
    await page.mouse.move(c.x + c.r * 0.45, c.y - c.r * 0.25);
    await page.mouse.down(); await page.waitForTimeout(200);
    await page.mouse.move(c.x + c.r * 0.9, c.y - c.r * 0.6);
    await page.waitForTimeout(500);
    await shot('cheese-stretch');
    await page.mouse.up();
  }
  await page.waitForTimeout(1800);
  await waitStage('CUT', 20000);
  await step('after-cut');
  await shot('done');

  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); }
    requestAnimationFrame(f);
  }));
  console.log('=== ' + which + ' ===');
  console.log(log.join('\n'));
  console.log('fps(software renderer) = ' + fps);
  console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'no js errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
