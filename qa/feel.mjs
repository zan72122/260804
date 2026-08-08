/**
 * Signature-action review. Not a flow test — this one measures whether the four
 * actions actually feel the way they are supposed to:
 *
 *   クルッ    one turn == exactly one section, five times running
 *             reversing mid-cut pulls the emerging section back in, and never
 *             takes away a section that is already finished
 *   スルスル  the ribbon grows monotonically and keeps growing to the cap
 *   フワッ    the section goes from creased to flat over a visible span of time,
 *             monotonically, and the stroke assist speeds it up
 *   パッ      the focus knob is genuinely through-focus: turning past the sweet
 *             spot blurs the image again
 *
 * Runs the whole thing three times over to confirm the specimen really changes.
 */
import { chromium } from 'playwright';

const BASE = process.env.QA_URL || 'http://127.0.0.1:5173/';
const FAST = process.env.QA_FAST || 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => n.toFixed(2);

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  // small viewport on purpose: this pass measures timing, and the software
  // renderer needs the fill-rate headroom to sample a gesture properly
  viewport: { width: 300, height: 650 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
});
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));

const probe = () => page.evaluate(() => window.__lab.game.probe());
const state = () => page.evaluate(() => {
  const g = window.__lab.game;
  const u = g.fluoro.mat.uniforms;
  return { ribbon: g.ribbonLen, morph: g.section?.morph ?? 0, focus: u.uFocus.value, stage: g.probe().stage };
});

async function arc(centre, turns, radius, dir, steps) {
  const total = Math.max(1, Math.round(turns * steps));
  await page.mouse.move(centre.x + radius, centre.y);
  await page.mouse.down();
  for (let i = 1; i <= total; i++) {
    const a = dir * (i / steps) * Math.PI * 2;
    await page.mouse.move(centre.x + Math.cos(a) * radius, centre.y + Math.sin(a) * radius);
    await sleep(20);
  }
  await page.mouse.up();
}

async function drag(from, to, steps = 22) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
    await sleep(10);
  }
  await page.mouse.up();
}

async function waitFor(fn, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(80);
  }
  return false;
}

const check = (ok, msg) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`); if (!ok) problems.push(msg); };

await page.goto(`${BASE}?fast=${FAST}`, { waitUntil: 'load' });
await sleep(4000);

const kinds = [];
for (let round = 1; round <= 3; round++) {
  console.log(`\n=== round ${round} ===`);

  // ---- get the block in ----------------------------------------------------
  await waitFor(async () => (await probe()).stage === 'BlockMount');
  let p = await probe();
  await drag(p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 26);
  await waitFor(async () => (await probe()).stage === 'Slicing');
  await sleep(2500);

  // ---- クルッ : five separate turns ---------------------------------------
  const perTurn = [];
  for (let i = 0; i < 5; i++) {
    const before = (await state()).ribbon;
    const w = (await probe()).targets.wheel;
    await arc(w, 1, 60, 1, 30);
    await sleep(500);
    const after = (await state()).ribbon;
    perTurn.push(after - before);
  }
  console.log(`  クルッ  per-turn sections: ${perTurn.map(fmt).join(' ')}`);
  // one turn == one section, plus whatever the flywheel coasts on after release
  check(perTurn.every((d) => d > 0.9 && d < 1.4), 'every turn produces one section, five times running');

  // ---- reversing mid-cut ---------------------------------------------------
  const banked = (await state()).ribbon;
  const w = (await probe()).targets.wheel;
  await arc(w, 0.18, 60, 1, 30);            // part way into the next section
  await sleep(300);
  const mid = (await state()).ribbon;
  await arc(w, 0.16, 60, -1, 30);           // back out again
  await sleep(600);
  const backOut = (await state()).ribbon;
  console.log(`  クルッ  banked ${fmt(banked)} -> mid-cut ${fmt(mid)} -> reversed ${fmt(backOut)}`);
  check(mid > banked + 0.05, 'a partial turn shows a partly emerged section');
  check(backOut < mid - 0.02, 'reversing pulls the emerging section back in');
  check(backOut >= banked - 0.001, 'reversing never destroys a finished section');

  // ---- スルスル : keeps growing -------------------------------------------
  for (let i = 0; i < 4; i++) {
    const q = await probe();
    if (q.ribbon >= 8.5) break;
    await arc(q.targets.wheel, 2, 60, 1, 26);
    await sleep(300);
  }
  const grown = (await state()).ribbon;
  console.log(`  スルスル ribbon reached ${fmt(grown)} sections`);
  check(grown >= 6, 'the ribbon can be grown long');

  // ---- take a piece and watch フワッ ---------------------------------------
  p = await probe();
  await page.mouse.move(p.targets.ribbon.x, p.targets.ribbon.y);
  await page.mouse.down(); await sleep(50); await page.mouse.up();
  await waitFor(async () => (await probe()).stage === 'BathDrop');
  await sleep(2400);
  p = await probe();
  await drag(p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 24);
  await waitFor(async () => (await probe()).stage !== 'BathDrop', 30000);

  const morphs = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const s = await state();
    morphs.push(s.morph);
    if (s.morph >= 0.999 || s.stage === 'Pickup') break;
    await sleep(50);
  }
  const rising = morphs.every((v, i) => i === 0 || v >= morphs[i - 1] - 1e-6);
  const span = Math.max(...morphs) - Math.min(...morphs);
  console.log(`  フワッ  ${morphs.length} samples, ${fmt(morphs[0])} -> ${fmt(morphs[morphs.length - 1])} (span ${fmt(span)})`);
  check(span > 0.6, 'the section visibly changes shape as it relaxes');
  check(morphs[morphs.length - 1] > 0.9, 'and ends flat');
  check(rising, 'the relaxation is monotonic — it never snaps back');
  check(morphs.length >= 4, 'the relaxation takes real time rather than cutting');

  // ---- through the rest of the chain --------------------------------------
  await waitFor(async () => (await probe()).stage === 'Pickup');
  await sleep(2200);
  p = await probe();
  await drag(p.targets.grab, { x: p.targets.grab.x, y: p.targets.grab.y - 170 }, 24);

  await waitFor(async () => (await probe()).stage === 'Dewax');
  await sleep(2200);
  p = await probe();
  await drag(p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 22);

  await waitFor(async () => (await probe()).stage === 'Stain', 40000);
  for (let i = 0; i < 4; i++) {
    await sleep(1800);
    p = await probe();
    if (p.stage !== 'Stain' || !p.targets.drop) break;
    await drag(p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 18);
    await waitFor(async () => { const q = await probe(); return q.stage !== 'Stain' || q.stained.filter(Boolean).length > i; }, 30000);
  }

  await waitFor(async () => (await probe()).stage === 'Mount', 40000);
  await sleep(2000);
  p = await probe();
  await drag(p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 20);
  await sleep(1400);
  p = await probe();
  if (p.stage === 'Mount') await drag(p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 60 }, 26);

  await waitFor(async () => (await probe()).stage === 'ScopeMount', 60000);
  await sleep(2200);
  p = await probe();
  await drag(p.targets.grab, { x: p.targets.drop.x, y: p.targets.drop.y + 55 }, 22);

  // ---- パッ : is it really through-focus? ---------------------------------
  await waitFor(async () => (await probe()).stage === 'Focus', 40000);
  await sleep(2600);
  const knob = (await probe()).targets.knob;
  const curve = [];
  for (let i = 0; i < 14; i++) {
    await arc(knob, 0.5, 56, 1, 18);
    const s = await state();
    curve.push(s.focus);
    if (s.stage === 'Reveal') break;
    await sleep(120);
  }
  const peak = Math.max(...curve);
  const peakAt = curve.indexOf(peak);
  const fell = curve.slice(peakAt + 1).some((v) => v < peak - 0.12);
  console.log(`  パッ    focus curve: ${curve.map((v) => v.toFixed(2)).join(' ')}`);
  check(curve[0] < 0.35, 'the field starts genuinely out of focus');
  check(peak > 0.9, 'turning the knob does reach a sharp focus');
  check(fell || (await state()).stage === 'Reveal',
    'the focus is a through-focus: past the sweet spot it blurs again, or it locked in');

  const landed = await waitFor(async () => (await probe()).stage === 'Reveal', 60000);
  if (!landed) {
    for (let i = 0; i < 8 && !(await probe()).stage.startsWith('Reveal'); i++) {
      await arc((await probe()).targets.knob, 0.4, 56, 1, 18);
      await sleep(200);
    }
  }
  check((await probe()).stage === 'Reveal', 'the reveal lands');

  kinds.push(await page.evaluate(() => window.__lab.game.specimen.kind));

  // ---- go again ------------------------------------------------------------
  if (round < 3) {
    await waitFor(async () => page.$eval('#btnAgain', (el) => el.classList.contains('on')), 40000);
    await page.click('#btnAgain', { force: true });
    await sleep(2500);
  }
}

console.log(`\nspecimen kinds across three plays: ${kinds.join(', ')}`);
check(new Set(kinds).size === 3, 'three consecutive plays give three different tissue architectures');

console.log(`\n${problems.length === 0 ? 'ALL GOOD' : `${problems.length} PROBLEM(S)`}`);
for (const p of problems) console.log('  - ' + p);
await browser.close();
