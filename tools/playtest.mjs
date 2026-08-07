// Drives the built game through a full playthrough on iPhone/iPad-sized
// viewports, captures screenshots at every beat and reports console errors.
//
//   npm run build && node tools/playtest.mjs [--dev]
//
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'playtest');
const PORT = Number(process.env.PT_PORT || 4178);

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = normalize(decodeURIComponent(req.url.split('?')[0]));
      if (p === '/' || p === '/index.html') p = '/index.html';
      const file = join(DIST, p);
      if (!file.startsWith(DIST) || !existsSync(file)) {
        res.writeHead(404);
        res.end('nope');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DEVICES = [
  { name: 'iphone-portrait', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'iphone-landscape', width: 844, height: 390, dpr: 3, touch: true },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2, touch: true },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2, touch: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tap(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
  await sleep(80);
}

async function swipe(page, x0, y0, x1, y1, steps = 14, hold = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await sleep(hold);
  }
  await page.mouse.up();
  await sleep(30);
}

async function run(device) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 1,
    hasTouch: device.touch,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const errors = [];
  const warnings = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errors.push(t);
    else if (m.type() === 'warning') warnings.push(t);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const dir = join(OUT, device.name);
  await mkdir(dir, { recursive: true });
  let shot = 0;
  const snap = async (label) => {
    await page.screenshot({ path: join(dir, `${String(shot++).padStart(2, '0')}-${label}.png`) });
  };
  const phase = async () =>
    page.evaluate(() => {
      const g = window.__game;
      if (!g) return null;
      return { stage: g.stage, seaPhase: g.sea?.phase, prep: g.sea?.prepState, bury: g.sea?.buryS, lay: g.sea?.layS };
    });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await sleep(2600);
  await snap('title');

  const W = device.width;
  const H = device.height;
  const cx = W / 2;
  const cy = H / 2;

  // ---- title -> select --------------------------------------------------
  await tap(page, cx, cy);
  await sleep(1600);
  await snap('select');

  // pick a different island pair + swap the cable / rov / decor chips
  await tap(page, cx * 0.7, cy * 0.72);
  await sleep(700);
  const chips = await page.$$('.chip');
  if (chips.length >= 8) {
    await chips[1].click();
    await sleep(180);
    await chips[4].click();
    await sleep(180);
    await chips[6].click();
    await sleep(300);
  }
  await snap('select-picked');

  // ---- go ----------------------------------------------------------------
  await page.click('#go');
  await sleep(2200);
  await snap('prep');

  // ---- prep: drag the cable head to the guide roller ---------------------
  // The head sits forward on deck; drag aft/down until it snaps.
  for (let attempt = 0; attempt < 4; attempt++) {
    const st = await phase();
    if (st?.seaPhase !== 'prep') break;
    await swipe(page, cx + W * 0.14, cy - H * 0.05, cx - W * 0.28, cy + H * 0.12, 18, 16);
    await sleep(600);
  }
  await sleep(600);
  await snap('threading');
  // threading takes a few seconds
  for (let i = 0; i < 40; i++) {
    const st = await phase();
    if (st?.seaPhase !== 'prep') break;
    await sleep(300);
  }
  await snap('payout-start');

  // ---- abuse: rapid taps, an abandoned drag, a rotation mid-phase --------
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(cx + (i % 3) * 20, cy + (i % 5) * 15);
    await page.mouse.down();
    await page.mouse.up();
  }
  // press, drag, and let go outside the window
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy - 80);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await sleep(400);
  // rotate mid-payout and rotate back
  await page.setViewportSize({ width: H, height: W });
  await sleep(900);
  await snap('rotated-payout');
  const midRotate = await phase();
  await page.setViewportSize({ width: W, height: H });
  await sleep(900);

  // ---- payout: alternate lever holds and swipes --------------------------
  let guard = 0;
  let lastLay = -1;
  let payStall = 0;
  while (guard++ < 90) {
    const st = await phase();
    if (!st || st.seaPhase !== 'payout') break;
    if (st.lay <= lastLay + 0.0005) payStall++;
    else payStall = 0;
    if (payStall > 20) {
      console.log('  !! payout made no progress - giving up at lay =', st.lay);
      break;
    }
    lastLay = st.lay;
    if (guard % 3 === 0) {
      // press and hold the lever
      const lever = await page.$('#lever');
      const box = await lever.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await sleep(900);
        await page.mouse.up();
      }
    } else {
      // swipe "backwards", i.e. along the cable
      await swipe(page, cx, cy - H * 0.16, cx - W * 0.1, cy + H * 0.22, 10, 10);
    }
    if (guard === 4) await snap('payout-mid');
  }
  await snap('descent');

  // ---- descent is automatic ----------------------------------------------
  for (let i = 0; i < 80; i++) {
    const st = await phase();
    if (st?.seaPhase !== 'descent') break;
    if (i === 12) await snap('descent-mid');
    if (i === 30) await snap('descent-deep');
    await sleep(300);
  }
  await sleep(400);
  await snap('rov-dark');

  // ---- rov: tap to light up, then trace ----------------------------------
  for (let i = 0; i < 6; i++) {
    await tap(page, cx, cy);
    await sleep(400);
  }
  await sleep(1200);
  await snap('rov-lit');

  guard = 0;
  let lastBury = 0;
  let stalled = 0;
  while (guard++ < 140) {
    const st = await phase();
    if (!st || (st.seaPhase !== 'rov' && st.seaPhase !== 'done')) break;
    if (st.seaPhase === 'done') break;
    if (st.bury <= lastBury + 0.0005) stalled++;
    else stalled = 0;
    if (stalled > 25) {
      console.log('  !! trace made no progress - giving up at bury =', st.bury);
      break;
    }
    lastBury = st.bury;
    // trace forwards - straight up the screen, the naive gesture
    await swipe(page, cx + W * 0.08, cy + H * 0.26, cx - W * 0.02, cy - H * 0.18, 12, 9);
    if (guard === 6) await snap('trench');
    if (guard === 20) await snap('trench-2');
  }
  await snap('buried');

  // ---- finale ------------------------------------------------------------
  for (let i = 0; i < 60; i++) {
    const st = await phase();
    if (st?.stage === 'finale') break;
    await sleep(400);
  }
  await sleep(3000);
  await snap('finale-mid');
  await sleep(5000);
  await snap('finale');

  // ---- rotate mid-game and make sure nothing is lost ---------------------
  await page.setViewportSize({ width: device.height, height: device.width });
  await sleep(1200);
  await snap('rotated');
  const afterRotate = await phase();

  // ---- replay ------------------------------------------------------------
  const replay = await page.$('#replay.on');
  if (replay) {
    await replay.click();
    await sleep(2600);
    await snap('replay');
  }
  const finalState = await phase();

  await browser.close();
  return { device: device.name, errors, warnings, lastBury, midRotate, afterRotate, finalState };
}

const server = await serve();
await rm(OUT, { recursive: true, force: true });
const results = [];
for (const d of DEVICES.filter((d) => !ONLY.length || ONLY.includes(d.name))) {
  process.stdout.write(`\n=== ${d.name} ===\n`);
  try {
    const r = await run(d);
    results.push(r);
    console.log('  errors  :', r.errors.length ? r.errors.map((e) => String(e).split('\n')[0]).slice(0, 8) : 'none');
    const w = r.warnings.filter((x) => !/GPU stall|no longer repeat/.test(x));
    console.log('  warnings:', w.length ? w.slice(0, 5) : 'none');
    console.log('  bury    :', r.lastBury);
    console.log('  midRot  :', JSON.stringify(r.midRotate));
    console.log('  rotate  :', JSON.stringify(r.afterRotate));
    console.log('  final   :', JSON.stringify(r.finalState));
  } catch (e) {
    console.log('  FAILED:', e.message);
    results.push({ device: d.name, fatal: e.message });
  }
}
server.close();

const bad = results.filter((r) => r.fatal || (r.errors && r.errors.length));
console.log(`\n${bad.length ? '✗' : '✓'} ${results.length - bad.length}/${results.length} devices clean`);
process.exit(bad.length ? 1 : 0);
