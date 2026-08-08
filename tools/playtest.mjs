/**
 * Headless play-through harness.
 *
 * Boots the built game at the four target viewports and plays a whole evening
 * with synthesised one-finger swipes aimed at where things actually are on
 * screen, then rotates the device and replays. Writes screenshots plus a log
 * per viewport, so a regression in framing or in interaction shows up as a
 * picture rather than as a silent pass.
 *
 *   node tools/playtest.mjs [--url=http://localhost:5180] [--out=shots]
 */
import { chromium, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};

const URL = arg('url', 'http://localhost:5180/');
const OUT = arg('out', 'shots');
const ONLY = arg('only', '');
// Headless runs use a software rasteriser, so retina pixel counts make them
// crawl. `--dpr=1` trades screenshot resolution for a much faster pass;
// preview.mjs is the tool for beauty shots.
const DPR = +arg('dpr', '0');

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 393, height: 852, dpr: 3 },
  { name: 'iphone-landscape', width: 852, height: 393, dpr: 3 },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2 },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Software GL runs at a handful of fps and the game clamps dt so a stalled tab
 * never fast-forwards, so wall-clock waits badly under-run the simulation.
 * Everything here waits on the game's own clock instead.
 */
async function waitGame(page, seconds, capMs = 120000) {
  const t0 = await page.evaluate(() => window.__ukai.game.t);
  const start = Date.now();
  for (;;) {
    await sleep(120);
    const t = await page.evaluate(() => window.__ukai.game.t).catch(() => t0 + seconds);
    if (t - t0 >= seconds || Date.now() - start > capMs) return;
  }
}

/** One finger, moved in steps, so the gesture reader sees real chunks. */
async function swipe(page, x0, y0, x1, y1, steps = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    await sleep(9);
  }
  await page.mouse.up();
  await sleep(30);
}

const state = (page) =>
  page.evaluate(() => {
    const g = window.__ukai.game;
    return {
      phase: g.phase,
      fire: +g.fire.strength.toFixed(2),
      fish: g.fishCount,
      birds: g.birds.map((b) => b.state).join(','),
      waiting: g.birds.filter((b) => b.waitingToHaul).length,
      inBasket: g.boat.basket.children.length,
    };
  });

/** Where each interactive thing currently is, in CSS pixels. */
const targets = (page) =>
  page.evaluate(() => {
    const g = window.__ukai.game;
    const st = window.__ukai.stage;
    const p = { x: 0, y: 0 };
    const at = (v) => {
      st.project(v.clone(), p);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    };
    return {
      fire: at(g.fireWorld),
      perched: g.birds
        .filter((b) => b.state === 'perch')
        .map((b) => ({ i: b.index, ...at(b.pos) })),
      ropes: g.birds
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => b.state === 'under' || b.state === 'rising')
        .map(({ b, i }) => ({
          i,
          waiting: b.waitingToHaul,
          ...at(g.ropes[i].pts[Math.floor(g.ropes[i].n * 0.5)]),
        })),
    };
  });

const inFrame = (t, W, H) => t.x > 4 && t.x < W - 4 && t.y > 4 && t.y < H - 4;

async function run(vp) {
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: DPR || vp.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  const page = await ctx.newPage();
  const logs = [];
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'load' });
  await sleep(900);

  const dir = path.join(OUT, vp.name);
  await mkdir(dir, { recursive: true });
  const shot = (n) => page.screenshot({ path: path.join(dir, `${n}.png`) });

  const W = vp.width;
  const H = vp.height;
  const cx = W / 2;

  // --- 1. dusk -------------------------------------------------------------
  await shot('01-dusk');
  await waitGame(page, 7.2);
  await shot('02-embers');
  logs.push(`after dusk: ${JSON.stringify(await state(page))}`);

  // --- 2. fan the fire -----------------------------------------------------
  for (let i = 0; i < 8; i++) {
    const t = await targets(page);
    const fy = Math.min(H - 60, Math.max(60, t.fire.y));
    const fx = Math.min(W - 30, Math.max(30, t.fire.x));
    await swipe(page, fx, fy + H * 0.07, fx, fy - H * 0.07, 8);
    await waitGame(page, 0.35);
    if ((await state(page)).fire > 0.97) break;
  }
  await waitGame(page, 1.2);
  await shot('03-lit');
  const lit = await state(page);
  logs.push(`after fanning: ${JSON.stringify(lit)}`);
  if (lit.phase !== 'fishing') problems.push(`fire did not light: phase=${lit.phase}`);

  // --- 3. work the birds ---------------------------------------------------
  let released = 0;
  let hauls = 0;
  for (let round = 0; round < 90; round++) {
    const s = await state(page);
    if (s.phase === 'finale' || s.phase === 'done') break;
    if (s.fish >= 11) break;

    const t = await targets(page);
    for (const b of t.perched) {
      if (!inFrame(b, W, H)) {
        problems.push(`perched bird ${b.i} off-screen at ${b.x},${b.y}`);
        continue;
      }
      const away = b.x < cx ? -1 : 1;
      await swipe(page, b.x, b.y, b.x + away * W * 0.11, b.y - H * 0.13, 8);
      released++;
      await waitGame(page, 0.3);
    }
    // Haul whoever is loudest about it.
    const rope = t.ropes.sort((a, b) => (b.waiting ? 1 : 0) - (a.waiting ? 1 : 0))[0];
    if (rope && inFrame(rope, W, H)) {
      await swipe(page, rope.x, rope.y, rope.x, Math.min(H - 10, rope.y + H * 0.22), 8);
      hauls++;
    }
    if (round === 3) await shot('04-released');
    if (round === 12) await shot('05-working');
    if (round === 26) await shot('06-hauling');
    await waitGame(page, 0.55);
  }
  await waitGame(page, 2.5);
  await shot('07-basket');
  const fished = await state(page);
  logs.push(`after fishing (${released} releases, ${hauls} hauls): ${JSON.stringify(fished)}`);
  if (fished.fish < 6) problems.push(`only ${fished.fish} fish landed`);
  if (fished.inBasket !== fished.fish) {
    problems.push(`basket holds ${fished.inBasket} but ${fished.fish} were caught`);
  }

  // --- 4. downstream -------------------------------------------------------
  for (let i = 0; i < 14; i++) {
    const s = await state(page);
    if (s.phase === 'finale' || s.phase === 'done') break;
    await swipe(page, cx, H * 0.8, cx, H * 0.22, 16);
    await waitGame(page, 1.0);
  }
  const fin = await state(page);
  logs.push(`after downstream: ${JSON.stringify(fin)}`);
  if (fin.phase !== 'finale' && fin.phase !== 'done') problems.push('finale never started');
  await waitGame(page, 4);
  await shot('08-drifting');
  await waitGame(page, 10);
  await shot('09-ending');

  const replayVisible = await page.evaluate(() => {
    const b = document.getElementById('replay');
    return !b.hidden && b.classList.contains('is-shown');
  });
  logs.push(`replay button shown: ${replayVisible}`);
  if (!replayVisible) problems.push('replay button never appeared');

  // --- 5. rotate -----------------------------------------------------------
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await waitGame(page, 1.2);
  await shot('10-rotated');
  const rotated = await page.evaluate(() => ({
    w: window.__ukai.stage.width,
    h: window.__ukai.stage.height,
    o: window.__ukai.stage.orientation,
    cw: document.getElementById('scene').clientWidth,
  }));
  logs.push(`after rotate: ${JSON.stringify(rotated)}`);
  if (rotated.w !== vp.height) problems.push('stage did not pick up the rotation');
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await waitGame(page, 1.0);

  // --- 6. replay -----------------------------------------------------------
  if (replayVisible) {
    await page.click('#replay');
    await waitGame(page, 2.5);
    await shot('11-replay');
    const again = await state(page);
    logs.push(`after replay: ${JSON.stringify(again)}`);
    if (again.fish !== 0 || again.inBasket !== 0) problems.push('replay did not empty the basket');
    if (again.birds.split(',').some((s) => s !== 'perch')) {
      problems.push(`replay left birds in ${again.birds}`);
    }
    // And it must still be playable.
    const t = await targets(page);
    await swipe(page, t.fire.x, t.fire.y + H * 0.07, t.fire.x, t.fire.y - H * 0.07, 8);
    await waitGame(page, 1.0);
    logs.push(`replay still responsive: ${JSON.stringify(await state(page))}`);
  }

  const perf = await page.evaluate(
    () =>
      new Promise((res) => {
        const ts = [];
        let last = performance.now();
        const tick = () => {
          const now = performance.now();
          ts.push(now - last);
          last = now;
          if (ts.length < 90) requestAnimationFrame(tick);
          else {
            ts.sort((a, b) => a - b);
            res({ medianMs: +ts[45].toFixed(1), p90Ms: +ts[81].toFixed(1) });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  logs.push(`frame time under software GL: ${JSON.stringify(perf)}`);

  logs.push(problems.length ? `PROBLEMS:\n  ${problems.join('\n  ')}` : 'PROBLEMS: none');
  await writeFile(path.join(dir, 'log.txt'), logs.join('\n'), 'utf8');
  await browser.close();
  return { logs, problems };
}

let failed = 0;
for (const vp of VIEWPORTS) {
  if (ONLY && !vp.name.includes(ONLY)) continue;
  process.stdout.write(`\n=== ${vp.name} ===\n`);
  const { logs, problems } = await run(vp);
  failed += problems.length;
  process.stdout.write(logs.join('\n') + '\n');
}
process.exit(failed ? 1 : 0);
