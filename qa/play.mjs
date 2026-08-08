/**
 * Automated device pass. Drives the real pointer pipeline (pointerdown /
 * pointermove / pointerup) at four device sizes and screenshots every beat.
 *
 *   node qa/play.mjs [device] [--abuse]
 *
 * `--abuse` adds the misuse checks: mashing, releasing mid-circle, cranking
 * backwards, dragging things off the bath, spinning the focus knob flat out.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = (process.env.QA_URL || 'http://127.0.0.1:5173/') + (process.env.QA_FAST ? `?fast=${process.env.QA_FAST}` : '');
const OUT = process.env.QA_OUT || 'qa/shots';

const DEVICES = {
  'iphone-portrait': { width: 390, height: 844, dpr: 3 },
  'iphone-landscape': { width: 844, height: 390, dpr: 3 },
  'ipad-portrait': { width: 834, height: 1112, dpr: 2 },
  'ipad-landscape': { width: 1112, height: 834, dpr: 2 },
};

const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const ABUSE = process.argv.includes('--abuse');

const SLOW = Number(process.env.QA_SLOW || 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SLOW));

async function probe(page) {
  return page.evaluate(() => window.__lab.game.probe());
}

const ORDER = ['Intro', 'BlockMount', 'Slicing', 'BathDrop', 'BathRelax', 'Pickup',
  'Dewax', 'Stain', 'Mount', 'DarkRoom', 'ScopeMount', 'Focus', 'Reveal'];
const idx = (s) => ORDER.indexOf(s);

/**
 * Wait until the game has reached `name` OR already moved past it. The game is
 * allowed to run ahead of the script — a forgiving game skips steps for you,
 * and the harness must not call that a failure.
 */
async function waitStage(page, name, timeout = 20000 * SLOW) {
  const t0 = Date.now();
  let lastSeen = '?';
  while (Date.now() - t0 < timeout) {
    const p = await probe(page);
    lastSeen = p.stage;
    if (idx(p.stage) >= idx(name)) return p;
    await sleep(120 / SLOW);
  }
  throw new Error(`timeout waiting for stage ${name} (stuck at ${lastSeen})`);
}

/** A slow, human-ish drag. */
async function drag(page, from, to, steps = 26, hold = 0) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
    await sleep(12 / SLOW);
  }
  if (hold) await sleep(hold);
  await page.mouse.up();
}

async function tap(page, at) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await sleep(60 / SLOW);
  await page.mouse.up();
}

/** Draw `turns` circles around a centre — the クルッ / クルクル gesture. */
async function crank(page, centre, turns, radius = 70, stepsPerTurn = 40, dir = 1, onStep) {
  const total = Math.round(turns * stepsPerTurn);
  await page.mouse.move(centre.x + radius, centre.y);
  await page.mouse.down();
  for (let i = 1; i <= total; i++) {
    const a = dir * (i / stepsPerTurn) * Math.PI * 2;
    await page.mouse.move(centre.x + Math.cos(a) * radius, centre.y + Math.sin(a) * radius);
    await sleep(9 / SLOW);
    if (onStep && i % stepsPerTurn === 0) {
      const stop = await onStep(i / stepsPerTurn);
      if (stop) break;
    }
  }
  await page.mouse.up();
}

async function run(name, dev) {
  const dir = `${OUT}/${name}`;
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.QA_CHROME || '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-lcd-text', '--force-device-scale-factor=1'],
  });
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

  let shot = 0;
  const snap = async (label) => {
    await page.screenshot({ path: `${dir}/${String(shot++).padStart(2, '0')}-${label}.png` });
  };

  const log = [];
  const note = (s) => { log.push(s); console.log(`  [${name}] ${s}`); };

  await page.goto(URL, { waitUntil: 'load' });
  await sleep(2600);
  await snap('boot');

  // --- Scene 1: mount the block ------------------------------------------
  let p = await waitStage(page, 'BlockMount');
  await snap('block');
  if (ABUSE) {
    // release the block halfway across the screen: must not get stuck
    await drag(page, p.targets.grab, { x: p.targets.grab.x + 40, y: p.targets.grab.y - 130 }, 14);
    await sleep(900);
    p = await probe(page);
    if (p.stage !== 'BlockMount' && p.stage !== 'Slicing') throw new Error('block abuse broke flow: ' + p.stage);
    p = await waitStage(page, p.stage === 'Slicing' ? 'Slicing' : 'BlockMount', 4000);
  }
  if (p.stage === 'BlockMount') {
    await drag(page, p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 30);
  }

  // --- Scene 2/3: クルッ + スルスル ---------------------------------------
  p = await waitStage(page, 'Slicing');
  note(`slicing shot; wheel at ${Math.round(p.targets.wheel.x)},${Math.round(p.targets.wheel.y)} of ${dev.width}x${dev.height}`);
  await sleep(1700);
  p = await probe(page);
  await snap('wheel');
  const wheel = p.targets.wheel;
  if (wheel.x < 0 || wheel.x > dev.width || wheel.y < 0 || wheel.y > dev.height)
    note(`!! WHEEL OFF SCREEN: ${JSON.stringify(wheel)}`);

  if (ABUSE) {
    await crank(page, wheel, 1.2, 70, 40, -1);          // backwards: must be harmless
    await sleep(300);
    const back = await probe(page);
    note(`after reverse crank: ribbon=${back.ribbon.toFixed(2)} (want ~0)`);
    // release mid-circle
    await page.mouse.move(wheel.x + 70, wheel.y);
    await page.mouse.down();
    for (let i = 0; i < 14; i++) { const a = i * 0.22; await page.mouse.move(wheel.x + Math.cos(a) * 70, wheel.y + Math.sin(a) * 70); await sleep(10); }
    await page.mouse.up();
    await sleep(700);
  }

  await crank(page, wheel, 2.2, 72, 42, 1);
  p = await probe(page);
  note(`after 2.2 turns: ribbon=${p.ribbon.toFixed(2)} sections`);
  await snap('ribbon-2');
  await sleep(2200);                                     // let the macro insert play
  await snap('ribbon-macro');

  // keep cranking until the ribbon can be taken
  for (let attempt = 0; attempt < 6; attempt++) {
    p = await probe(page);
    if (p.ribbon >= 4.2) break;
    const w = (await probe(page)).targets.wheel || wheel;
    await crank(page, w, 2.2, 72, 42, 1);
    await sleep(400);
  }
  p = await probe(page);
  note(`ribbon length before pick: ${p.ribbon.toFixed(2)}`);
  await snap('ribbon-long');

  // --- Scene 3: take a piece ---------------------------------------------
  if (!p.targets.ribbon) throw new Error('no ribbon target offered');
  await tap(page, p.targets.ribbon);

  // --- Scene 4: フワッ ----------------------------------------------------
  p = await waitStage(page, 'BathDrop');
  await sleep(2200);
  p = await probe(page);
  await snap('bath');
  if (ABUSE && p.targets.grab) {
    // fling it off the bath entirely — the game must walk it back
    await drag(page, p.targets.grab, { x: 12, y: 24 }, 18);
    await sleep(1600);
    p = await probe(page);
    note(`after off-bath release: stage=${p.stage}`);
  }
  if (p.stage === 'BathDrop') {
    await drag(page, p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 26);
  }
  p = await waitStage(page, 'BathRelax');
  await snap('relax-start');
  // stroke the water to help it along
  for (let i = 0; i < 3; i++) {
    const q = await probe(page);
    if (q.stage !== 'BathRelax') break;
    const c = q.targets.stroke;
    if (c) await drag(page, { x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }, 12);
    await sleep(200);
  }
  p = await probe(page);
  note(`morph after relax: ${p.morph.toFixed(2)}`);
  await snap('relax-flat');

  // --- Scene 5: スーッ ----------------------------------------------------
  p = await waitStage(page, 'Pickup');
  await sleep(1900);
  p = await probe(page);
  await snap('pickup');
  if (p.stage === 'Pickup')
    await drag(page, p.targets.grab, { x: p.targets.grab.x, y: p.targets.grab.y - 170 }, 26);

  // --- Scene 6: clearing --------------------------------------------------
  p = await waitStage(page, 'Dewax');
  await sleep(1900);
  p = await probe(page);
  await snap('dewax');
  if (p.stage === 'Dewax') {
    if (p.targets.grab.x < 0 || p.targets.grab.x > dev.width) note(`!! DEWAX SLIDE OFF SCREEN ${JSON.stringify(p.targets.grab)}`);
    await drag(page, p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 24);
  }
  await sleep(4200);
  await snap('dewaxed');

  // --- Scene 7: staining --------------------------------------------------
  p = await waitStage(page, 'Stain');
  await sleep(1700);
  for (let i = 0; i < 4; i++) {
    p = await probe(page);
    if (p.stage !== 'Stain') break;
    if (!p.targets.drop) break;
    if (ABUSE && i === 0) { for (let k = 0; k < 6; k++) await tap(page, p.targets.grab); }
    await drag(page, p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 20);
    await sleep(600);
    if (i === 0) await snap('staining');
    await sleep(3600);
  }
  await snap('stained');

  // --- Scene 8: mounting --------------------------------------------------
  p = await waitStage(page, 'Mount');
  await sleep(1700);
  p = await probe(page);
  await snap('mount');
  if (p.stage === 'Mount') {
    if (p.targets.grab.x < 0 || p.targets.grab.x > dev.width) note(`!! DROPPER OFF SCREEN ${JSON.stringify(p.targets.grab)}`);
    await drag(page, p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 22);
  }
  await sleep(900);
  p = await probe(page);
  await snap('drop-placed');
  if (p.stage === 'Mount' && p.targets.grab) {
    await drag(page, p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 60 }, 30, 260);
  }

  // --- Scene 9/10 ---------------------------------------------------------
  p = await waitStage(page, 'DarkRoom', 15000 * SLOW);
  await sleep(1500);
  await snap('dark');
  p = await waitStage(page, 'ScopeMount', 15000 * SLOW);
  await sleep(1600);
  p = await probe(page);
  await snap('scope');
  if (p.stage === 'ScopeMount')
    await drag(page, p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 24);

  p = await waitStage(page, 'Focus');
  await sleep(2200);
  p = await probe(page);
  await snap('focus-blur');
  const knob = p.targets.knob || { x: dev.width / 2, y: dev.height * 0.75 };
  note(`knob at ${Math.round(knob.x)},${Math.round(knob.y)}`);
  if (knob.y > dev.height || knob.y < 0) note('!! KNOB OFF SCREEN');

  if (ABUSE) {
    await crank(page, knob, 1.5, 60, 8, -1);   // spin it fast, the wrong way
    await sleep(500);
  }
  let focusSeen = 0;
  await crank(page, knob, 6, 66, 30, 1, async () => {
    const q = await probe(page);
    focusSeen = Math.max(focusSeen, q.focus);
    return q.stage === 'Reveal';
  });
  await sleep(400);
  p = await probe(page);
  note(`peak focus reached ${focusSeen.toFixed(2)}, stage=${p.stage}`);
  if (p.stage !== 'Reveal') {
    for (let i = 0; i < 5 && p.stage !== 'Reveal'; i++) {
      await crank(page, (await probe(page)).targets.knob, 3, 66, 30, 1, async () => (await probe(page)).stage === 'Reveal');
      await sleep(300);
      p = await probe(page);
    }
  }
  await waitStage(page, 'Reveal', 15000 * SLOW);
  await sleep(1800);
  await snap('reveal');
  await sleep(5000);
  await snap('reveal-zoom');

  // --- restart ------------------------------------------------------------
  await sleep(1200);
  const again = await page.$('#btnAgain');
  const vis = await again.evaluate((el) => el.classList.contains('on'));
  note(`again button shown: ${vis}`);
  if (vis) {
    await again.click({ force: true });
    await sleep(2500);
    p = await probe(page);
    note(`after restart: stage=${p.stage}`);
    await snap('restarted');
  }

  // --- background / foreground --------------------------------------------
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(700);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await sleep(700);
  p = await probe(page);
  note(`after background round trip: stage=${p.stage}`);

  note(`console errors: ${errors.length}`);
  for (const e of errors.slice(0, 8)) note('  ERR ' + e);

  writeFileSync(`${dir}/log.txt`, log.join('\n'));
  await browser.close();
  return { name, errors, log };
}

const results = [];
for (const [name, dev] of Object.entries(DEVICES)) {
  if (only && only !== name) continue;
  console.log(`\n=== ${name} ${dev.width}x${dev.height} ===`);
  try {
    results.push(await run(name, dev));
  } catch (e) {
    console.log(`  [${name}] FAILED: ${e.message}`);
    results.push({ name, errors: ['FAILED ' + e.message], log: [] });
  }
}
console.log('\n--- summary ---');
for (const r of results) console.log(`${r.name}: ${r.errors.length} errors`);
