// Fast headless verification of the whole play loop: steps the game at a fixed
// timestep with synthetic pointer input and reports every state transition.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log('[error]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 300)); });
await page.goto('file://' + resolve(root, 'index.html'));
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });

const log = await page.evaluate(() => {
  const g = window.__game;
  const out = [];
  const W = window.innerWidth, H = window.innerHeight;
  const Vec = g.camera.position.constructor;

  // The game normally advances on rAF; drive it directly instead.
  const step = (n, fn) => {
    for (let i = 0; i < n; i++) { if (fn) fn(i); g.update(1 / 60); }
  };
  const setPtr = (down, dy) => {
    g.ptr.down = down; g.ptr.x = W / 2; g.ptr.y = H / 2; g.ptr.dx = 0; g.ptr.dy = dy;
  };

  g.audio.setMuted(true);
  g.start();
  out.push('start -> ' + g.state);

  // 1. buckles
  for (let i = 0; i < 3; i++) {
    step(20);
    const k = g.rig.buckles.findIndex((b) => b < 0.5);
    if (k < 0) break;
    const v = g.rig.buckleMeshes[k].getWorldPosition(new Vec());
    v.project(g.camera);
    g.onDown((v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H);
  }
  step(60);
  out.push('after buckles: ' + g.state + ' buckles=' + g.rig.buckles.join(','));

  // 2. connect
  step(200, () => setPtr(true, 6));
  setPtr(false, 0);
  step(90);
  out.push('after connect: ' + g.state + ' attached=' + g.rig.descenderAttached.toFixed(2));

  // 3. over the edge
  step(420, () => setPtr(true, 12));
  setPtr(false, 0);
  step(60);
  out.push('after edge: ' + g.state + ' y=' + g.workerY.toFixed(2));

  // 4. five full stops
  for (let stop = 0; stop < 6; stop++) {
    if (g.state === 'finale') break;
    let guard = 0;
    while (g.state === 'descend' && guard++ < 900) { setPtr(true, 14); g.update(1 / 60); }
    setPtr(false, 0);
    step(40);
    out.push(`stop ${stop}: reached ${g.state} at y=${g.workerY.toFixed(2)} (descend frames ${guard})`);
    if (g.state !== 'spray') break;

    const hp = g.heroGroup.position.clone();
    const paint = (rows, cols) => {
      // Raycasts need current world matrices; render() normally supplies them.
      g.scene.updateMatrixWorld(true);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p = new Vec(
            hp.x + (-0.5 + c / (cols - 1)) * 1.2,
            hp.y + (0.5 - r / (rows - 1)) * 2.0,
            hp.z + 0.05
          );
          p.project(g.camera);
          const sx = (p.x * 0.5 + 0.5) * W, sy = (-p.y * 0.5 + 0.5) * H;
          if (c === 0) { g.lastPaint = null; g.onDown(sx, sy); }
          else g._paint(sx, sy, false);
          g.update(1 / 60);
        }
      }
    };
    let pass = 0;
    while (g.state === 'spray' && pass++ < 14) paint(7, 7);
    out.push(`  sprayed -> ${g.state} wet=${g.wetFrac.toFixed(2)} (${pass} passes)`);
    pass = 0;
    while (g.state === 'wipe' && pass++ < 16) paint(11, 9);
    out.push(`  wiped -> ${g.state} clean=${g.cleanFrac.toFixed(2)} (${pass} passes)`);
    if (g.state === 'reveal') step(200);
    out.push(`  after reveal: ${g.state} stopIndex=${g.stopIndex} cleanY=${g.world.cleanY.value.toFixed(1)}`);
  }

  step(500);
  out.push('finale: ' + g.state + ' t=' + g.finaleT.toFixed(1));
  g.reset();
  step(30);
  out.push('after reset: ' + g.state + ' stopIndex=' + g.stopIndex + ' hang=' + g.rig.hang.toFixed(2));
  return out;
});
console.log(log.join('\n'));
await browser.close();
