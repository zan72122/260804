// End-to-end playthrough test for the projectionist game.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'test', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(8931, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'],
});

const results = [];
const ok = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
};

async function phase(page) { return page.evaluate(() => window.__game.state.phase); }
async function waitPhase(page, ph, timeout = 15000) {
  await page.waitForFunction(p => window.__game.state.phase === p && window.__game.camIdle(), ph, { timeout });
}
async function target(page) { return page.evaluate(() => window.__game.target()); }
async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  console.log('shot:', name);
}

async function playthrough(vw, vh, label, full) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, hasTouch: true });
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
  page.on('pageerror', e => console.log('PAGE EXCEPTION:', e.message));
  await page.goto('http://localhost:8931/');
  await page.waitForFunction(() => window.__game && window.__game.ready, { timeout: 20000 });
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  ok(`${label}: WebGL context`, gl);
  await page.waitForTimeout(1200);
  await shot(page, `${label}-0-title`);
  if (!full) { await page.close(); return; }

  // --- title tap ---
  await page.mouse.click(vw / 2, vh / 2);
  await waitPhase(page, 'lens');
  await page.waitForTimeout(400);
  await shot(page, `${label}-1-lens`);

  // --- lens rubbing: lawnmower scrub across the whole lens ---
  for (let round = 0; round < 8; round++) {
    const t = await target(page);
    await page.mouse.move(t.x, t.y);
    await page.mouse.down();
    const R = 46;
    for (let row = -4; row <= 4; row++) {
      const y = t.y + row * (R / 4.5);
      await page.mouse.move(t.x - R, y, { steps: 3 });
      await page.mouse.move(t.x + R, y, { steps: 6 });
    }
    await page.mouse.up();
    const clean = await page.evaluate(() => window.__game.state.clean);
    if (clean >= 0.84) break;
  }
  const clean = await page.evaluate(() => window.__game.state.clean);
  ok(`${label}: lens cleaned`, clean >= 0.84, `clean=${clean.toFixed(2)}`);
  await waitPhase(page, 'filmPick');
  await page.waitForTimeout(300);
  await shot(page, `${label}-2-reelpick`);

  // --- pick the middle reel (meadow) ---
  const rt = await target(page);
  await page.mouse.click(rt.x, rt.y);
  await waitPhase(page, 'filmThread');
  const theme = await page.evaluate(() => window.__game.state.theme);
  ok(`${label}: reel picked`, theme === 'meadow', `theme=${theme}`);
  await page.waitForTimeout(300);
  await shot(page, `${label}-3-thread-start`);

  // --- thread the film along the curve ---
  {
    const h = await target(page);
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    for (let t = 0.02; t <= 1.001; t += 0.012) {
      const p = await page.evaluate(tt => window.__game.curvePointScreen(tt), Math.min(1, t));
      await page.mouse.move(p.x, p.y, { steps: 1 });
      const ft = await page.evaluate(() => window.__game.state.filmT);
      if (ft >= 0.985) break;
    }
    await page.mouse.up();
  }
  const filmT = await page.evaluate(() => window.__game.state.filmT);
  ok(`${label}: film threaded`, filmT >= 0.985, `filmT=${filmT.toFixed(3)}`);
  await waitPhase(page, 'sound');
  await page.waitForTimeout(300);
  await shot(page, `${label}-4-sound`);

  // --- drag the plug to the socket ---
  {
    const pt = await target(page);
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    for (let i = 0; i <= 24; i++) {
      const st = await page.evaluate(() => window.__game.socketScreen());
      const cur = await target(page);
      const nx = cur.x + (st.x - cur.x) * 0.25;
      const ny = cur.y + (st.y - cur.y) * 0.25;
      await page.mouse.move(nx, ny, { steps: 2 });
      const plugged = await page.evaluate(() => window.__game.state.plugged);
      if (plugged) break;
    }
    await page.mouse.up();
  }
  const plugged = await page.evaluate(() => window.__game.state.plugged);
  ok(`${label}: plugged in`, plugged);
  await waitPhase(page, 'focus');
  await page.waitForTimeout(600);
  await shot(page, `${label}-5-focus-blurry`);

  // --- focus: horizontal swipes ---
  for (let s = 0; s < 8; s++) {
    await page.mouse.move(vw * 0.25, vh * 0.55);
    await page.mouse.down();
    await page.mouse.move(vw * 0.75, vh * 0.55, { steps: 12 });
    await page.mouse.up();
    const f = await page.evaluate(() => window.__game.state.focus);
    if (f <= 0.04) break;
  }
  const focus = await page.evaluate(() => window.__game.state.focus);
  ok(`${label}: focused`, focus <= 0.04, `focus=${focus.toFixed(2)}`);
  await shot(page, `${label}-6-focus-sharp`);
  await waitPhase(page, 'seats');
  await page.waitForTimeout(300);
  await shot(page, `${label}-7-seats`);

  // --- tap all crooked seats ---
  for (let i = 0; i < 8; i++) {
    const left = await page.evaluate(() => window.__game.refs.crooked.filter(c => !c.fixed).length);
    if (left === 0) break;
    const t = await target(page);
    if (!t) break;
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(700);
  }
  const seatsLeft = await page.evaluate(() => window.__game.refs.crooked.filter(c => !c.fixed).length);
  ok(`${label}: seats fixed`, seatsLeft === 0, `left=${seatsLeft}`);
  await waitPhase(page, 'curtain');
  await page.waitForTimeout(300);
  await shot(page, `${label}-8-curtain-open`);

  // --- pull the tassel: curtains close ---
  const ct = await target(page);
  await page.mouse.click(ct.x, ct.y);
  let closed = false;
  try {
    await page.waitForFunction(() =>
      window.__game.refs.curtainL.scale.x > 0.95 && window.__game.refs.curtainR.scale.x > 0.95,
      null, { timeout: 20000 });
    closed = true;
  } catch { /* stays false */ }
  ok(`${label}: curtains closed`, closed);
  await shot(page, `${label}-9-curtains-closed`);
  await waitPhase(page, 'ready');
  await page.waitForTimeout(300);
  await shot(page, `${label}-10-ready`);

  // --- press START ---
  const bt = await target(page);
  await page.mouse.click(bt.x, bt.y);
  let dimmed = false;
  try {
    await page.waitForFunction(() => window.__game.refs.lights.house.intensity < 10,
      null, { timeout: 20000 });
    dimmed = true;
  } catch { /* stays false */ }
  ok(`${label}: house lights dimmed`, dimmed);
  await shot(page, `${label}-11-dimming`);
  await page.waitForFunction(() => window.__game.refs.beam.mat1.opacity > 0.05, null, { timeout: 25000 });
  await shot(page, `${label}-12-beam`);
  await page.waitForFunction(() => window.__game.state.showT > 7 && window.__game.refs.movieMat.opacity > 0.9,
    null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const showState = await page.evaluate(() => ({
    curtL: window.__game.refs.curtainL.scale.x,
    beam: window.__game.refs.beam.mat1.opacity,
    spot: window.__game.refs.spot.intensity,
    movie: window.__game.refs.movieMat.opacity,
    showT: window.__game.state.showT,
  }));
  ok(`${label}: curtains reopened`, showState.curtL < 0.3, `scale=${showState.curtL.toFixed(2)}`);
  ok(`${label}: beam visible`, showState.beam > 0.05 && showState.spot > 100, `beam=${showState.beam.toFixed(3)} spot=${showState.spot.toFixed(0)}`);
  ok(`${label}: movie on screen`, showState.movie > 0.9, `opacity=${showState.movie.toFixed(2)}`);
  await shot(page, `${label}-13-show-meadow`);

  // --- tap the screen: characters react ---
  const st2 = await target(page);
  await page.mouse.click(st2.x, st2.y);
  await page.waitForTimeout(400);
  await shot(page, `${label}-14-show-tap`);

  // --- switch reels mid-show ---
  await page.click('.reelbtn[data-reel="0"]');
  await page.waitForTimeout(1500);
  const theme2 = await page.evaluate(() => window.__game.state.theme);
  ok(`${label}: theme switched`, theme2 === 'ocean', `theme=${theme2}`);
  await shot(page, `${label}-15-show-ocean`);
  await page.click('.reelbtn[data-reel="2"]');
  await page.waitForTimeout(1500);
  await shot(page, `${label}-16-show-space`);

  // rough fps sample
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const loop = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res(n / 2); };
    requestAnimationFrame(loop);
  }));
  // SwiftShader software rendering — real devices render on GPU, so the bar here is just "not stalled"
  ok(`${label}: fps (software rendering)`, fps > 5, `fps=${fps.toFixed(0)}`);

  await page.close();
}

// full playthrough on iPhone landscape; smoke on portrait & iPad
await playthrough(844, 390, 'iphone-land', true);
await playthrough(390, 844, 'iphone-port', false);
await playthrough(1024, 768, 'ipad', false);

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} passed ===`);
process.exit(fails.length ? 1 : 0);
