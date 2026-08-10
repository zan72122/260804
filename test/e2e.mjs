/**
 * Real-browser end-to-end check (Chromium via Playwright).
 *
 *   node server.mjs 8080 &
 *   node test/e2e.mjs [--shots]
 *
 * Drives the actual page: portrait and landscape, dragging the crane with
 * touch-style pointer events, pressing Grab several times, and asserting that
 * the prize genuinely changes state and eventually falls.
 */

import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:8080/';
const SHOTS = path.join(process.cwd(), 'shots');
const wantShots = process.argv.includes('--shots');
if (wantShots) fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: 'portrait-iphone', width: 390, height: 844, dpr: 1 },
  { name: 'landscape-iphone', width: 844, height: 390, dpr: 1 },
  { name: 'portrait-ipad', width: 820, height: 1180, dpr: 1 },
];

let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

const state = (page) => page.evaluate(() => {
  const g = window.__crane;
  const p = g.p;
  const st = p.prizeState();
  return {
    phase: g.game.phase,
    grabs: g.game.grabs,
    instability: g.game.instability,
    aim: { ...g.game.aim },
    head: p.head.translation(),
    prize: st ? { x: st.pos.x, y: st.pos.y, z: st.pos.z, speed: st.speed } : null,
    yaw: (p.prizeYaw() * 180) / Math.PI,
    tilt: (p.prizeTilt() * 180) / Math.PI,
    dims: p.prizeDims,
    fps: g.__fps ?? 0,
  };
});

const waitIdle = async (page, timeout = 45000) => {
  await page.waitForFunction(
    () => window.__crane.game.phase === 'idle' || window.__crane.game.phase === 'won',
    null, { timeout },
  );
};

/** Waits until the claw has stopped travelling (software rendering is slow). */
async function settleClaw(page, timeout = 25000) {
  await page.waitForFunction(() => {
    const g = window.__crane;
    const h = g.p.head.translation();
    const a = g.game.aim;
    return Math.hypot(h.x - a.x, h.z - a.z) < 0.022;
  }, null, { timeout }).catch(() => {});
}

async function drag(page, from, to, steps = 14) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
  await settleClaw(page);
  return to;
}

/**
 * Aims the way a player does: drag, look at where the claw actually went,
 * correct, repeat. This exercises the whole feedback loop rather than assuming
 * anything about how screen pixels map to the play surface.
 */
async function aimAt(page, wx, wz, startPx) {
  let cursor = startPx ?? await project(page, 0, 0.46, -0.02);
  for (let i = 0; i < 5; i++) {
    const cur = await page.evaluate(() => ({ ...window.__crane.game.aim }));
    if (Math.hypot(cur.x - wx, cur.z - wz) < 0.012) break;
    const here = await project(page, cur.x, 0.46, cur.z);
    const want = await project(page, wx, 0.46, wz);
    const next = { x: cursor.x + (want.x - here.x), y: cursor.y + (want.y - here.y) };
    await drag(page, cursor, next, 8);
    cursor = next;
  }
  return cursor;
}

/** Screen position of a world point, via the live camera. */
const project = (page, x, y, z) => page.evaluate(([px, py, pz]) => {
  const g = window.__crane;
  const Vec3 = g.view.camTarget.constructor;
  const p = new Vec3(px, py, pz).project(g.view.camera);
  const r = g.canvas.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}, [x, y, z]);

async function pressGrab(page) {
  await page.locator('#grab').click({ force: true });
  await page.waitForTimeout(120);
}

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height} @${vp.dpr}) ===`);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      hasTouch: true,
      isMobile: true,
      userAgent: devices['iPhone 13'].userAgent,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__crane, null, { timeout: 20000 });
    await page.waitForTimeout(1400);

    // measure frame rate over one second of real rendering
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => {
        n++;
        if (performance.now() - t0 > 1000) res(Math.round((n * 1000) / (performance.now() - t0)));
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));

    const s0 = await state(page);
    check(s0.prize !== null, 'prize spawned');
    check(Math.abs(s0.prize.y - (0.46 + s0.dims.h / 2)) < 0.012, 'prize rests on the bars',
      `y=${s0.prize.y.toFixed(4)}`);
    check(fps >= 2, 'renders continuously (CPU rasteriser in CI)', `${fps} fps`);

    // the grab button must be inside the viewport and finger-sized
    const btn = await page.locator('#grab').boundingBox();
    check(btn.x >= 0 && btn.y >= 0 && btn.x + btn.width <= vp.width + 1 && btn.y + btn.height <= vp.height + 1,
      'grab button fully on screen', JSON.stringify(btn));
    check(btn.width >= 88, 'grab button is large enough', `${Math.round(btn.width)}px`);

    // the play area must be visible: project the bar ends and the prize
    for (const [label, pt] of [
      ['prize', [s0.prize.x, s0.prize.y, s0.prize.z]],
      ['bar-front', [0, 0.46, 0.28]],
      ['bar-back', [0, 0.46, -0.28]],
    ]) {
      const p = await project(page, ...pt);
      check(p.x > -2 && p.x < vp.width + 2 && p.y > -2 && p.y < vp.height + 2,
        `${label} inside viewport`, `${Math.round(p.x)},${Math.round(p.y)}`);
    }

    // --- drag the crane: the claw must follow the finger one-to-one ---------
    const goal = { x: -0.16, z: 0.10 };
    let cursor = await aimAt(page, goal.x, goal.z);
    const s1 = await state(page);
    check(Math.abs(s1.head.x - goal.x) < 0.035 && Math.abs(s1.head.z - goal.z) < 0.045,
      'claw follows the drag', `head=(${s1.head.x.toFixed(3)},${s1.head.z.toFixed(3)})`);

    // one-to-one feel: a given finger travel must move the claw by the same
    // distance across the play surface
    const before1to1 = await state(page);
    const p0 = await project(page, before1to1.head.x, 0.46, before1to1.head.z);
    const p1 = await project(page, before1to1.head.x + 0.10, 0.46, before1to1.head.z);
    cursor = await drag(page, cursor, { x: cursor.x + (p1.x - p0.x), y: cursor.y + (p1.y - p0.y) }, 10);
    const after1to1 = await state(page);
    check(Math.abs(after1to1.head.x - before1to1.head.x - 0.10) < 0.03,
      'finger travel maps 1:1 to claw travel',
      `moved ${((after1to1.head.x - before1to1.head.x) * 100).toFixed(1)}cm, wanted 10.0cm`);

    if (wantShots) await page.screenshot({ path: path.join(SHOTS, `${vp.name}-idle.png`) });

    // --- several grabs: state must persist and keep changing ---------------
    const history = [];
    let fell = false;
    for (let i = 0; i < 11 && !fell; i++) {
      const before = await state(page);
      const ends = await page.evaluate(() => window.__crane.game.prizeEnds());
      const aimX = i % 2 === 0 ? ends.left.x + 0.045 : ends.right.x - 0.045;
      const aimZ = ends.c.z + (i % 3 === 0 ? -0.85 : 0.85) * ends.dz;
      cursor = await aimAt(page, aimX, aimZ, cursor);
      await pressGrab(page);
      await page.waitForTimeout(300);
      await waitIdle(page);
      await page.waitForTimeout(150);
      const after = await state(page);
      const moved = Math.hypot(after.prize.x - before.prize.x, after.prize.z - before.prize.z);
      const turned = Math.abs(after.yaw - before.yaw);
      history.push({ moved, turned, tilt: after.tilt, y: after.prize.y, phase: after.phase });
      if (after.phase === 'won') fell = true;
      if (i === 0 && wantShots) await page.screenshot({ path: path.join(SHOTS, `${vp.name}-grab1.png`) });
    }

    const changed = history.filter((h) => h.moved > 0.004 || h.turned > 1.2).length;
    check(changed >= Math.min(3, history.length), 'each grab changes the board',
      history.map((h) => `${(h.moved * 100).toFixed(1)}cm/${h.turned.toFixed(0)}°`).join(' '));
    check(fell, 'prize eventually falls', `${history.length} grabs`);

    if (fell) {
      // the prize must reach the tray, and the camera must keep it on screen
      await page.waitForFunction(
        () => window.__crane.p.prizeState().pos.y < 0.18, null, { timeout: 30000 },
      ).catch(() => {});
      const w = await state(page);
      check(w.prize.y < 0.18, 'prize lands in the tray', `y=${w.prize.y.toFixed(3)}`);
      const landPx = await project(page, w.prize.x, w.prize.y, w.prize.z);
      check(landPx.x > 0 && landPx.x < vp.width && landPx.y > 0 && landPx.y < vp.height,
        'camera keeps the landing on screen', `${Math.round(landPx.x)},${Math.round(landPx.y)}`);
      if (wantShots) await page.screenshot({ path: path.join(SHOTS, `${vp.name}-win.png`) });
      // a new round must start automatically
      await page.waitForFunction(() => window.__crane.game.grabs === 0, null, { timeout: 40000 });
      const n = await state(page);
      check(n.prize.y > 0.4 && n.phase === 'idle', 'next round starts clean', `y=${n.prize.y.toFixed(3)}`);
    }

    // --- new game button ---------------------------------------------------
    await page.locator('#newgame').click({ force: true });
    await page.waitForTimeout(1600);
    const ng = await state(page);
    check(ng.grabs === 0 && ng.prize.y > 0.4, 'new game resets the round');

    check(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
