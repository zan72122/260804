/**
 * Headless play-through harness.
 *
 * Boots the built game at the four target viewports, drives a full loop with
 * synthesised one-finger swipes, and writes screenshots plus a console/error
 * log so regressions in framing or interaction show up as pictures.
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

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 393, height: 852, dpr: 3 },
  { name: 'iphone-landscape', width: 852, height: 393, dpr: 3 },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2 },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One finger, moved in steps, so the gesture reader sees real chunks. */
async function swipe(page, x0, y0, x1, y1, steps = 14, holdMs = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    await sleep(holdMs);
  }
  await page.mouse.up();
  await sleep(40);
}

async function state(page) {
  return page.evaluate(() => {
    const g = window.__ukai?.game;
    if (!g) return null;
    return {
      phase: g.phase,
      fire: +g.fire.strength.toFixed(3),
      fish: g.fishCount,
      birds: g.birds.map((b) => b.state),
      waiting: g.birds.filter((b) => b.waitingToHaul).length,
    };
  });
}

async function run(vp) {
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));

  await page.goto(URL, { waitUntil: 'load' });
  await sleep(900);

  const dir = path.join(OUT, vp.name);
  await mkdir(dir, { recursive: true });
  const shot = (n) => page.screenshot({ path: path.join(dir, `${n}.png`) });

  const W = vp.width;
  const H = vp.height;
  const cx = W / 2;

  // --- 1. dusk departure --------------------------------------------------
  await shot('01-dusk');
  await sleep(3000);
  await shot('02-arriving');
  // Wait out the departure.
  for (let i = 0; i < 40; i++) {
    const s = await state(page);
    if (s && s.phase !== 'depart') break;
    await sleep(300);
  }
  await shot('03-embers');

  // --- 2. fan the fire ----------------------------------------------------
  // Fire sits high and forward; fan with short up-strokes over it.
  const fireY = H * (vp.width > vp.height ? 0.3 : 0.36);
  for (let i = 0; i < 6; i++) {
    await swipe(page, cx, fireY + H * 0.06, cx, fireY - H * 0.06, 8, 10);
    await sleep(160);
  }
  await sleep(700);
  await shot('04-lit');
  let s = await state(page);
  logs.push(`after fanning: ${JSON.stringify(s)}`);

  // --- 3. release every bird ---------------------------------------------
  for (let round = 0; round < 3; round++) {
    const pos = await page.evaluate(() => {
      const g = window.__ukai.game;
      const st = window.__ukai.stage;
      const out = [];
      const p = { x: 0, y: 0 };
      for (const b of g.birds) {
        if (b.state !== 'perch') continue;
        st.project(b.pos.clone(), p);
        out.push({ i: b.index, x: p.x, y: p.y });
      }
      return out;
    });
    for (const b of pos) {
      await swipe(page, b.x, b.y, b.x + (b.x < cx ? -W * 0.13 : W * 0.13), b.y - H * 0.15, 9, 10);
      await sleep(240);
    }
    if (round === 0) {
      await sleep(700);
      await shot('05-released');
    }
    await sleep(900);
  }
  await sleep(1500);
  await shot('06-diving');

  // --- 4. haul until the basket fills ------------------------------------
  for (let i = 0; i < 150; i++) {
    s = await state(page);
    if (!s) break;
    if (s.phase === 'finale' || s.phase === 'done') break;
    if (s.fish >= 12) break;

    const targets = await page.evaluate(() => {
      const g = window.__ukai.game;
      const st = window.__ukai.stage;
      const p = { x: 0, y: 0 };
      const out = [];
      g.birds.forEach((b, i) => {
        if (b.state === 'under' || b.state === 'rising') {
          const r = g.ropes[i];
          st.project(r.pts[Math.floor(r.n * 0.5)].clone(), p);
          out.push({ i, x: p.x, y: p.y, waiting: b.waitingToHaul });
        } else if (b.state === 'perch') {
          st.project(b.pos.clone(), p);
          out.push({ i, x: p.x, y: p.y, perch: true });
        }
      });
      return out;
    });

    const haulable = targets.filter((t) => !t.perch);
    if (haulable.length) {
      const t = haulable.sort((a, b) => (b.waiting ? 1 : 0) - (a.waiting ? 1 : 0))[0];
      await swipe(page, t.x, t.y, t.x, Math.min(H - 12, t.y + H * 0.2), 8, 9);
    }
    const perched = targets.filter((t) => t.perch);
    for (const b of perched.slice(0, 2)) {
      await swipe(page, b.x, b.y, b.x + (b.x < cx ? -W * 0.12 : W * 0.12), b.y - H * 0.14, 8, 9);
      await sleep(120);
    }
    if (i === 6) await shot('07-hauling');
    if (i === 20) await shot('08-working');
    await sleep(220);
  }
  await sleep(900);
  await shot('09-basket');
  s = await state(page);
  logs.push(`after fishing: ${JSON.stringify(s)}`);

  // --- 5. downstream ------------------------------------------------------
  for (let i = 0; i < 8; i++) {
    s = await state(page);
    if (s && (s.phase === 'finale' || s.phase === 'done')) break;
    await swipe(page, cx, H * 0.78, cx, H * 0.22, 16, 12);
    await sleep(500);
  }
  await sleep(2500);
  await shot('10-drifting');
  await sleep(9000);
  await shot('11-ending');

  const replayVisible = await page.evaluate(() => {
    const b = document.getElementById('replay');
    return !b.hidden && b.classList.contains('is-shown');
  });
  logs.push(`replay button shown: ${replayVisible}`);

  // --- 6. rotate, then replay --------------------------------------------
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await sleep(900);
  await shot('12-rotated');
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await sleep(700);

  if (replayVisible) {
    await page.click('#replay');
    await sleep(1400);
    await shot('13-replay');
    s = await state(page);
    logs.push(`after replay: ${JSON.stringify(s)}`);
  }

  // --- 7. frame timing ----------------------------------------------------
  const perf = await page.evaluate(async () => {
    return await new Promise((res) => {
      const ts = [];
      let last = performance.now();
      let n = 0;
      const tick = () => {
        const now = performance.now();
        ts.push(now - last);
        last = now;
        if (++n < 100) requestAnimationFrame(tick);
        else {
          ts.sort((a, b) => a - b);
          res({ median: +ts[50].toFixed(2), p90: +ts[90].toFixed(2) });
        }
      };
      requestAnimationFrame(tick);
    });
  });
  logs.push(`frame ms (software GL): ${JSON.stringify(perf)}`);

  await writeFile(path.join(dir, 'log.txt'), logs.join('\n'), 'utf8');
  await browser.close();
  return logs;
}

for (const vp of VIEWPORTS) {
  if (ONLY && !vp.name.includes(ONLY)) continue;
  process.stdout.write(`\n=== ${vp.name} ===\n`);
  const logs = await run(vp);
  process.stdout.write(logs.join('\n') + '\n');
}
