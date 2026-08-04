// Throwaway audit script (child-touch-auditor): rapid taps, reverse swipes,
// mid-release drags, rotation persistence (couch/press/dry/ret), idle hints.
// Does NOT modify src/. Screenshots go to the session scratchpad.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = 'http://127.0.0.1:8000/';
const OUT = process.env.SHOT_DIR || '/tmp/audit-shots';
fs.mkdirSync(OUT, { recursive: true });

const W = 390, H = 844;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(URL);
await page.waitForTimeout(600);

const results = [];
let errMark = 0;
function report(scene, test, ok, detail) {
  const newErrs = errors.slice(errMark);
  errMark = errors.length;
  results.push({ scene, test, ok: ok && newErrs.length === 0, detail, errs: newErrs });
  console.log(`${ok && newErrs.length === 0 ? 'ok  ' : 'FAIL'} [${scene}] ${test} — ${detail}${newErrs.length ? ' | ' + newErrs.join(';') : ''}`);
}

const state = () => page.evaluate(() => window.__qa.state());
const targets = () => page.evaluate(() => window.__qa.targets());
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
async function drag(x0, y0, x1, y1, steps = 14, delay = 16, release = true) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
    await page.waitForTimeout(delay);
  }
  if (release) await page.mouse.up();
}
const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up(); };
async function rapidTaps(x, y, n = 10) {
  for (let i = 0; i < n; i++) { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(30); await page.mouse.up(); await page.waitForTimeout(35); }
}
async function waitFor(fn, desc, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await fn()) return true;
    await page.waitForTimeout(200);
  }
  return false;
}
const waitScene = (name, timeout) => waitFor(async () => (await state()).scene === name, `scene=${name}`, timeout);
async function idleShot(scene, secs = 6.5) {
  await page.waitForTimeout(secs * 1000);
  await shot(`idle-${scene}`);
  report(scene, 'idle-hint-shot', true, `screenshot idle-${scene}.png after ${secs}s no input`);
}
// second-finger interference: dispatch a synthetic second pointer during a drag
async function secondFinger(x, y) {
  await page.evaluate(([x, y]) => {
    const cv = document.getElementById('game');
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      cv.dispatchEvent(new PointerEvent(type, { pointerId: 99, clientX: x, clientY: y, bubbles: true, isPrimary: false }));
    }
  }, [x, y]);
}

async function rotateCheck(sceneName, extraFields = []) {
  const before = await state();
  const beforeT = await targets();
  await page.setViewportSize({ width: H, height: W });
  await page.waitForTimeout(500);
  const after = await state();
  const afterT = await targets();
  await shot(`rot-${sceneName}`);
  await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(500);
  const back = await state();
  const probs = [];
  if (after.scene !== before.scene || back.scene !== before.scene) probs.push(`scene ${before.scene}→${after.scene}→${back.scene}`);
  if (Math.abs(after.fill - before.fill) > 0.01) probs.push(`fill ${before.fill?.toFixed(3)}→${after.fill?.toFixed(3)}`);
  if (before.level != null && after.level != null && Math.abs(after.level - before.level) > 0.05) probs.push(`level ${before.level?.toFixed(2)}→${after.level?.toFixed(2)}`);
  if (after.fibersActive !== before.fibersActive) probs.push(`fibers ${before.fibersActive}→${after.fibersActive}`);
  for (const f of ['clothOn', 'lifted', 'feltOn', 'pressed', 'dried', 'flipped', 'latched', 'dispersed', 'cast', 'placed', 'found']) {
    if (before.flags && after.flags && JSON.stringify(before.flags[f]) !== JSON.stringify(after.flags[f])) probs.push(`flags.${f} ${before.flags[f]}→${after.flags[f]}`);
  }
  for (const f of ['press', 'wet', 'flip', 'lift']) {
    if (before.flags && typeof before.flags[f] === 'number' && Math.abs((after.flags[f] ?? 0) - before.flags[f]) > 0.05) probs.push(`flags.${f} ${before.flags[f]?.toFixed(3)}→${after.flags[f]?.toFixed(3)}`);
  }
  for (const f of extraFields) {
    if (JSON.stringify(beforeT[f]) !== JSON.stringify(afterT[f])) probs.push(`targets.${f} ${JSON.stringify(beforeT[f])}→${JSON.stringify(afterT[f])}`);
  }
  report(sceneName, 'rotate-persist', probs.length === 0, probs.length ? probs.join(', ') : 'state preserved across portrait↔landscape');
}

try {
  // ============================================================ book
  {
    let s = await state();
    report('book', 'start', s.scene === 'book', `scene=${s.scene}`);
    await idleShot('book');
    let t = await targets();
    await rapidTaps(t.tab.x, t.tab.y);
    s = await state();
    report('book', 'rapid-taps x10 on tab', s.scene === 'book' || s.pending, `scene=${s.scene} pending=${s.pending}`);
    // reverse swipe: push the tab DOWN into the book
    t = await targets();
    if (t.tab) await drag(t.tab.x, t.tab.y, t.tab.x, t.tab.y + H * 0.2, 10, 16);
    s = await state();
    report('book', 'reverse swipe (down)', s.scene === 'book' || s.pending, `scene=${s.scene}`);
    // mid-release: pull up a little, let go
    t = await targets();
    if (t.tab) await drag(t.tab.x, t.tab.y, t.tab.x, t.tab.y - H * 0.06, 6, 16);
    await page.waitForTimeout(600);
    s = await state();
    const tabBack = (await targets()).tab;
    report('book', 'mid-release snapback', (s.scene !== 'book') || !!tabBack, `tab still targetable=${!!tabBack}`);
    // recover: normal pulls
    for (let i = 0; i < 6; i++) {
      const st = await state();
      if (st.scene !== 'book' || st.pending) break;
      const tt = await targets();
      if (!tt.tab) break;
      await drag(tt.tab.x, tt.tab.y, tt.tab.x, Math.max(20, tt.tab.y - H * 0.3), 12, 20);
    }
    const okAdv = await waitScene('light', 15000);
    report('book', 'recoverable → light', okAdv, `advanced=${okAdv}`);
  }

  // ============================================================ light
  {
    await idleShot('light');
    let t = await targets();
    await rapidTaps(t.lens.x, t.lens.y);
    let s = await state();
    report('light', 'rapid-taps x10 on lens', s.scene === 'light', `scene=${s.scene} found=${s.flags.found}`);
    // reverse: grab lens and yank to screen corner, release mid-way
    t = await targets();
    await drag(t.lens.x, t.lens.y, 5, 5, 8, 16);
    await page.waitForTimeout(400);
    t = await targets();
    report('light', 'yank lens to corner + release', !!t.lens, `lens recoverable=${!!t.lens}`);
    // second finger during lens drag
    await page.mouse.move(t.lens.x, t.lens.y);
    await page.mouse.down();
    await secondFinger(W / 2, H / 2);
    await page.mouse.move(t.lens.x + 30, t.lens.y + 30);
    await page.mouse.up();
    s = await state();
    report('light', 'second finger during drag', s.scene === 'light', `scene=${s.scene}`);
    // normal completion
    t = await targets();
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
    const okAdv = await waitScene('place', 15000);
    report('light', 'recoverable → place', okAdv, `advanced=${okAdv}`);
  }

  // ============================================================ place
  {
    await idleShot('place');
    let t = await targets();
    await rapidTaps(t.page.x, t.page.y);
    let s = await state();
    report('place', 'rapid-taps x10 on page', s.scene === 'place' && !s.flags.placed, `scene=${s.scene} placed=${s.flags.placed}`);
    // reverse: drag page AWAY from mesh target
    t = await targets();
    const awayX = t.page.x + (t.page.x - t.target.x) * 0.5, awayY = Math.min(H - 20, t.page.y + (t.page.y - t.target.y) * 0.5 + 80);
    await drag(t.page.x, t.page.y, awayX, awayY, 10, 16);
    await page.waitForTimeout(500);
    s = await state();
    report('place', 'reverse drag away from mesh', s.scene === 'place' && !s.flags.placed, `placed=${s.flags.placed}`);
    // mid-release: halfway to target
    t = await targets();
    await drag(t.page.x, t.page.y, (t.page.x + t.target.x) / 2, (t.page.y + t.target.y) / 2, 10, 16);
    await page.waitForTimeout(600);
    t = await targets();
    report('place', 'mid-release halfway', !!t.page, `page target=${JSON.stringify(t.page)}`);
    // complete
    t = await targets();
    await drag(t.page.x, t.page.y, t.target.x, t.target.y, 18, 20);
    s = await state();
    const okAdv = await waitScene('tank', 15000);
    report('place', 'recoverable → tank', s.flags.placed && okAdv, `placed=${s.flags.placed} advanced=${okAdv}`);
  }

  // ============================================================ tank
  {
    await idleShot('tank-empty');
    let t = await targets();
    // lever before unlock: reverse + forward yanks must not latch
    await drag(t.lever.x, t.lever.y, t.lever.x, t.lever.y - 100, 8, 16);
    await drag(t.lever.x, t.lever.y, t.leverEnd.x, t.leverEnd.y + 30, 8, 16);
    let s = await state();
    report('tank', 'yank locked lever both ways', !s.flags.latched, `latched=${s.flags.latched} unlocked=${(await targets()).unlocked}`);
    // rapid taps on bowl
    await rapidTaps(t.bowls[0].x, t.bowls[0].y);
    await page.waitForTimeout(1500);
    s = await state();
    report('tank', 'rapid-taps x10 on bowl', s.scene === 'tank' && s.fibersPoured > 0, `poured=${s.fibersPoured}/${s.need} active=${s.fibersActive}`);
    // pour remainder normally
    let n = 0;
    while ((await state()).fibersPoured < (await state()).need && n < 8) {
      await tap(t.bowls[n % t.bowls.length].x, t.bowls[n % t.bowls.length].y);
      await page.waitForTimeout(900);
      n++;
    }
    // reverse-ish stir: straight strokes instead of circles + second finger
    const tk = t.tank;
    await page.mouse.move(tk.x + tk.w * 0.15, tk.y + tk.h * 0.5);
    await page.mouse.down();
    await secondFinger(tk.x + tk.w * 0.8, tk.y + tk.h * 0.5);
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(tk.x + tk.w * (i % 2 ? 0.15 : 0.85), tk.y + tk.h * 0.5);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    s = await state();
    report('tank', 'straight-line stir + 2nd finger', s.scene === 'tank' && s.fibersActive > 100, `active=${s.fibersActive} disp=${s.dispersion.toFixed(2)}`);
    // stir until dispersed
    for (let round = 0; round < 12 && !(await state()).flags.dispersed; round++) {
      await page.mouse.move(tk.x + tk.w * 0.2, tk.y + tk.h * 0.25);
      await page.mouse.down();
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * Math.PI * 3.2;
        await page.mouse.move(tk.x + tk.w * (0.5 + 0.36 * Math.cos(a + round)), tk.y + tk.h * (0.5 + 0.36 * Math.sin(a * 1.3 + round)));
        await page.waitForTimeout(24);
      }
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
    s = await state();
    report('tank', 'dispersal reached', s.flags.dispersed, `disp=${s.dispersion.toFixed(2)}`);
    await idleShot('tank-dispersed');
    // lever mid-release: pull 40%, let go → must not latch, must be re-pullable
    t = await targets();
    const midY = t.lever.y + (t.leverEnd.y - t.lever.y) * 0.4;
    await drag(t.lever.x, t.lever.y, t.lever.x, midY, 8, 20);
    await page.waitForTimeout(800);
    s = await state();
    report('tank', 'lever mid-release', !s.flags.latched && s.level > 0.9, `latched=${s.flags.latched} level=${s.level?.toFixed(2)}`);
    // reverse: push lever upward
    await drag(t.lever.x, t.lever.y, t.lever.x, t.lever.y - 120, 8, 16);
    s = await state();
    report('tank', 'lever reverse (up)', !s.flags.latched, `latched=${s.flags.latched}`);
    // full pull
    t = await targets();
    await drag(t.lever.x, t.lever.y, t.leverEnd.x, t.leverEnd.y + 30, 10, 24);
    s = await state();
    report('tank', 'lever full pull latches', s.flags.latched, `latched=${s.flags.latched}`);
    // rapid taps everywhere while draining
    await rapidTaps(tk.x + tk.w / 2, tk.y + tk.h / 2, 10);
    s = await state();
    report('tank', 'rapid-taps while draining', s.flags.latched && s.scene === 'tank', `level=${s.level?.toFixed(2)} fill=${s.fill?.toFixed(2)}`);
    const okCast = await waitFor(async () => (await state()).flags.cast, 'cast', 40000);
    report('tank', 'cast completes', okCast, `fill=${(await state()).fill?.toFixed(2)}`);
    const okAdv = await waitScene('couch', 15000);
    report('tank', '→ couch', okAdv, `advanced=${okAdv}`);
  }

  // ============================================================ couch
  {
    await idleShot('couch');
    await rotateCheck('couch-preCloth');
    let t = await targets();
    await rapidTaps(t.sheet.x, t.sheet.y);
    let s = await state();
    report('couch', 'rapid-taps x10 on sheet', s.scene === 'couch' && !s.flags.lifted, `scene=${s.scene} lifted=${s.flags.lifted}`);
    // reverse: try to lift sheet before cloth
    await drag(t.sheet.x, t.sheet.y, t.sheet.x, t.sheet.y - H * 0.3, 10, 16);
    s = await state();
    report('couch', 'lift before cloth', !s.flags.lifted && s.scene === 'couch', `lifted=${s.flags.lifted} clothOn=${s.flags.clothOn}`);
    // mid-release cloth drag
    t = await targets();
    await drag(t.cloth.x, t.cloth.y, (t.cloth.x + t.sheet.x) / 2, (t.cloth.y + t.sheet.y) / 2, 10, 16);
    await page.waitForTimeout(600);
    t = await targets();
    report('couch', 'cloth mid-release', !!t.cloth && !(await state()).flags.clothOn, `cloth=${JSON.stringify(t.cloth)}`);
    // place cloth
    t = await targets();
    await drag(t.cloth.x, t.cloth.y, t.sheet.x, t.sheet.y, 16, 20);
    s = await state();
    report('couch', 'cloth placed', s.flags.clothOn, `clothOn=${s.flags.clothOn}`);
    await rotateCheck('couch-clothOn');
    // reverse: swipe sheet DOWN instead of up
    t = await targets();
    await drag(t.sheet.x, t.sheet.y, t.sheet.x, Math.min(H - 10, t.sheet.y + H * 0.25), 10, 16);
    s = await state();
    report('couch', 'reverse swipe down w/ cloth', s.scene === 'couch' && !s.flags.lifted, `lifted=${s.flags.lifted}`);
    // mid-release lift
    await drag(t.sheet.x, t.sheet.y + 20, t.sheet.x, t.sheet.y - H * 0.08, 6, 16);
    await page.waitForTimeout(500);
    s = await state();
    report('couch', 'lift mid-release', s.scene === 'couch' || s.pending, `lifted=${s.flags.lifted} lift=${s.flags.lift}`);
    // full lift
    for (let i = 0; i < 5 && !(await state()).flags.lifted; i++) {
      const tt = await targets();
      await drag(tt.sheet.x, tt.sheet.y + 20, tt.sheet.x, Math.max(10, tt.sheet.y - H * 0.35), 12, 18);
    }
    const okAdv = await waitScene('press', 15000);
    report('couch', 'recoverable → press', okAdv, `lifted=${(await state()).flags?.lifted}`);
  }

  // ============================================================ press
  {
    await idleShot('press');
    await rotateCheck('press-preFelt');
    let t = await targets();
    await rapidTaps(t.wheel.x, t.wheel.y);
    let s = await state();
    report('press', 'rapid-taps x10 on wheel', s.scene === 'press', `press=${s.flags.press}`);
    // reverse: spin wheel UP before felt
    await drag(t.wheel.x, t.wheel.y, t.wheel.x, t.wheel.y - H * 0.25, 10, 16);
    s = await state();
    report('press', 'wheel up before felt', s.flags.press >= 0 && !s.flags.pressed, `press=${s.flags.press}`);
    // felt mid-release
    t = await targets();
    await drag(t.felt.x, t.felt.y, (t.felt.x + t.stack.x) / 2, (t.felt.y + t.stack.y) / 2, 10, 16);
    await page.waitForTimeout(600);
    t = await targets();
    report('press', 'felt mid-release', !!t.felt && !(await state()).flags.feltOn, `felt=${JSON.stringify(t.felt)}`);
    // place felt
    t = await targets();
    await drag(t.felt.x, t.felt.y, t.stack.x, t.stack.y, 16, 20);
    s = await state();
    report('press', 'felt placed', s.flags.feltOn, `feltOn=${s.flags.feltOn}`);
    // partial press then reverse then rotate mid-press
    t = await targets();
    await drag(t.wheel.x, t.wheel.y, t.wheel.x, t.wheel.y + H * 0.12, 8, 20);
    s = await state();
    const partial = s.flags.press;
    await drag(t.wheel.x, t.wheel.y, t.wheel.x, t.wheel.y - H * 0.3, 10, 16);
    s = await state();
    report('press', 'reverse wheel after partial', s.flags.press >= 0 && s.flags.press <= 1, `press ${partial?.toFixed(2)}→${s.flags.press?.toFixed(2)}`);
    if (s.flags.press > 0.02 && s.flags.press < 0.95) await rotateCheck('press-midPress');
    // finish press
    for (let i = 0; i < 6 && (await state()).flags.press < 1 && !(await state()).flags.pressed; i++) {
      const tt = await targets();
      await drag(tt.wheel.x, tt.wheel.y, tt.wheel.x, tt.wheel.y + H * 0.3, 10, 20);
    }
    s = await state();
    report('press', 'press closes', s.flags.press >= 0.99 || s.flags.pressed, `press=${s.flags.press}`);
    const okAdv = await waitScene('dry', 15000);
    report('press', '→ dry', okAdv, ``);
  }

  // ============================================================ dry
  {
    await idleShot('dry');
    let t = await targets();
    await rapidTaps(t.page.x + t.page.w / 2, t.sheet.y);
    let s = await state();
    report('dry', 'rapid-taps x10 on sheet', s.scene === 'dry', `wet=${s.flags.wet?.toFixed(2)}`);
    // premature flip attempt while wet
    t = await targets();
    await drag(t.corner.x - 8, t.corner.y - 8, Math.max(10, t.page.x - 60), t.corner.y - 40, 12, 16);
    s = await state();
    report('dry', 'flip attempt while wet', !s.flags.flipped && s.scene === 'dry', `flipped=${s.flags.flipped} dried=${s.flags.dried}`);
    // partial dry then rotate
    t = await targets();
    for (let i = 0; i < 3; i++) {
      await drag(t.page.x + 14, t.sheet.y, t.page.x + t.page.w - 14, t.sheet.y + 8, 12, 14);
      await page.waitForTimeout(250);
    }
    s = await state();
    if (!s.flags.dried) await rotateCheck('dry-partial');
    // reverse stroke direction (right→left) must also dry
    const wetBefore = (await state()).flags.wet;
    t = await targets();
    await drag(t.page.x + t.page.w - 14, t.sheet.y, t.page.x + 14, t.sheet.y - 8, 12, 14);
    await page.waitForTimeout(300);
    s = await state();
    report('dry', 'reverse-direction stroke', s.flags.wet <= wetBefore, `wet ${wetBefore?.toFixed(2)}→${s.flags.wet?.toFixed(2)}`);
    // finish drying
    for (let i = 0; i < 10 && !(await state()).flags.dried; i++) {
      const tt = await targets();
      await drag(tt.page.x + 14, tt.sheet.y, tt.page.x + tt.page.w - 14, tt.sheet.y + 8, 12, 14);
      await page.waitForTimeout(250);
    }
    s = await state();
    report('dry', 'dried', s.flags.dried, `dried=${s.flags.dried}`);
    await rotateCheck('dry-dried');
    // flip: wrong direction first (drag corner RIGHT/outward)
    t = await targets();
    await drag(t.corner.x - 8, t.corner.y - 8, Math.min(W - 5, t.corner.x + 80), t.corner.y - 20, 10, 16);
    s = await state();
    report('dry', 'flip wrong direction', !s.flags.flipped && s.scene === 'dry', `flip=${s.flags.flip}`);
    // mid-release flip
    t = await targets();
    await drag(t.corner.x - 8, t.corner.y - 8, t.corner.x - t.page.w * 0.25, t.corner.y - 20, 8, 16);
    await page.waitForTimeout(700);
    s = await state();
    report('dry', 'flip mid-release snapback', !s.flags.flipped && (s.flags.flip ?? 0) < 0.2, `flip=${s.flags.flip?.toFixed(2)}`);
    // full flip
    for (let i = 0; i < 4 && !(await state()).flags.flipped; i++) {
      const tt = await targets();
      await drag(tt.corner.x - 8, tt.corner.y - 8, Math.max(10, tt.page.x - 60), tt.corner.y - 40, 14, 18);
    }
    s = await state();
    report('dry', 'flipped', s.flags.flipped, `flipped=${s.flags.flipped}`);
    const okAdv = await waitScene('ret', 15000);
    report('dry', '→ ret', okAdv, ``);
  }

  // ============================================================ ret
  {
    await idleShot('ret-place');
    await rotateCheck('ret-place', ['phase']);
    let t = await targets();
    await rapidTaps(t.page.x, t.page.y);
    let s = await state();
    report('ret', 'rapid-taps x10 on page', s.scene === 'ret', `phase=${(await targets()).phase}`);
    // reverse: drag page away from slot
    t = await targets();
    await drag(t.page.x, t.page.y, t.page.x, Math.min(H - 10, t.page.y + 100), 8, 16);
    await page.waitForTimeout(400);
    t = await targets();
    report('ret', 'reverse drag away from slot', t.phase === 'place', `phase=${t.phase} page=${JSON.stringify(t.page)}`);
    // mid-release halfway to slot
    t = await targets();
    await drag(t.page.x, t.page.y, (t.page.x + t.slot.x) / 2, (t.page.y + t.slot.y) / 2, 10, 16);
    await page.waitForTimeout(500);
    t = await targets();
    report('ret', 'mid-release halfway', t.phase === 'place' && !!t.page, `page=${JSON.stringify(t.page)}`);
    await rotateCheck('ret-midway', ['phase']);
    // complete placement
    t = await targets();
    await drag(t.page.x, t.page.y, t.slot.x, t.slot.y, 18, 20);
    s = await state();
    report('ret', 'page returned', s.flags.returned, `returned=${s.flags.returned}`);
    const okTurn = await waitFor(async () => (await targets()).phase === 'turn', 'turn', 15000);
    report('ret', 'book reopens (turn phase)', okTurn, ``);
    await idleShot('ret-turn', 4.5);
    await rotateCheck('ret-turn', ['phase']);
    // reverse page turn: swipe RIGHT instead of left
    t = await targets();
    await drag(t.slot.x - 40, t.slot.y, t.slot.x + W * 0.3, t.slot.y, 10, 16);
    t = await targets();
    report('ret', 'reverse page-turn swipe', t.phase === 'turn', `phase=${t.phase}`);
    // rapid taps on the open book
    await rapidTaps(t.slot.x, t.slot.y);
    t = await targets();
    report('ret', 'rapid-taps on open book', t.phase === 'turn' || t.phase === 'done', `phase=${t.phase}`);
    // correct swipe left
    for (let i = 0; i < 4 && (await targets()).phase === 'turn'; i++) {
      const tt = await targets();
      await drag(tt.slot.x + 60, tt.slot.y, tt.slot.x - W * 0.3, tt.slot.y, 12, 18);
      await page.waitForTimeout(400);
    }
    const okDone = await waitFor(async () => (await targets()).phase === 'done', 'done', 10000);
    report('ret', 'recoverable → page turn done', okDone, ``);
    const okAdv = await waitScene('menu', 15000);
    report('ret', '→ menu', okAdv, ``);
  }

  // ============================================================ menu
  {
    await idleShot('menu');
    const t = await targets();
    await rapidTaps(t.cards[0].x, t.cards[0].y);
    const okAdv = await waitScene('book', 8000);
    const s = await state();
    report('menu', 'rapid-taps x10 on card', okAdv && s.scene === 'book', `scene=${s.scene} — replay starts cleanly`);
    await shot('replay-book');
  }
} catch (e) {
  console.log('EXCEPTION', e.stack);
  await shot('99-exception');
  report(await state().then(s => s.scene).catch(() => '?'), 'EXCEPTION', false, String(e));
}

const fails = results.filter(r => !r.ok);
console.log(`\n==== ${results.length} checks, ${fails.length} failures ====`);
for (const f of fails) console.log(`FAIL [${f.scene}] ${f.test}: ${f.detail} ${f.errs.join(';')}`);
if (errors.length) console.log('ALL ERRORS:', errors.join('\n'));
await browser.close();
process.exit(fails.length ? 1 : 0);
