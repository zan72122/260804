// Focused diagnostic: drives to the ROV phase, then screenshots the scene with
// individual layers toggled off so it is obvious which mesh is which.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'playtest', 'probe');
const PORT = Number(process.env.PT_PORT || 4200);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = await new Promise((res) => {
  const s = createServer(async (req, rq) => {
    let p = normalize(decodeURIComponent(req.url.split('?')[0]));
    if (p === '/') p = '/index.html';
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f)) return rq.writeHead(404).end();
    rq.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
    rq.end(await readFile(f));
  });
  s.listen(PORT, () => res(s));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await mkdir(OUT, { recursive: true });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await sleep(2500);

// Jump straight to the seabed by driving the state machine directly.
await page.evaluate(() => {
  const g = window.__game;
  g.hud.setTitle(false);
  g.sel.cableIndex = 1;
  g.sel.rovIndex = 1;
  g.sel.decorIndex = 1;
  g.go(() => g.enterSea());
});
await sleep(1600);
await page.evaluate(() => {
  const s = window.__game.sea;
  s.prepState = 'ready';
  s.threadT = 1;
  s.phase = 'rov';
  s.paid = 420;
  s.shipDist = 420 * 0.85;
  s.layS = Math.min(1, (420 * 0.85 - 46) / 380);
  s.buryS = 0.84;
  s.lightsRequested = true;
});
await sleep(11000);

const dump = await page.evaluate(() => {
  const s = window.__game.sea;
  const p = (v) => (v ? [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)] : null);
  return {
    cam: p(s.camera.position),
    phase: s.phase,
    layS: +s.layS.toFixed(3),
    buryS: +s.buryS.toFixed(3),
    plough: p(s.plough.group.position),
    rov: p(s.rov.group.position),
    ship: p(s.ship.group.position),
    spine0: p(s.spine[0]),
    spine70: p(s.spine[70]),
    spine141: p(s.spine[141]),
    spine180: p(s.spine[180]),
    spine223: p(s.spine[223]),
    spine319: p(s.spine[319]),
  };
});
console.log(JSON.stringify(dump, null, 1));

const shot = async (n) => page.screenshot({ path: join(OUT, `${n}.png`) });
await shot('a-all');
await page.evaluate(() => (window.__game.sea.strand.mesh.visible = false));
await sleep(700);
await shot('b-no-cable');
await page.evaluate(() => {
  window.__game.sea.strand.mesh.visible = true;
  window.__game.sea.guidePath.visible = false;
});
await sleep(700);
await shot('c-no-guide');
await page.evaluate(() => {
  window.__game.sea.guidePath.visible = true;
  window.__game.sea.trench.mesh.visible = false;
});
await sleep(700);
await shot('d-no-trench');


// --- freeze the loop and inspect the trench from a fixed vantage ------------
await page.evaluate(() => {
  const g = window.__game;
  g.sea.trench.mesh.visible = true;
  g.sea.guidePath.visible = true;
  g.sea.strand.mesh.visible = true;
  const s = g.sea;
  cancelAnimationFrame(g.raf);
  g.raf = 0;
  const cam = s.camera.clone();
  const p = s.plough.group.position.clone();
  const t = s.ploughTangent.clone().normalize();
  const side = t.clone().cross(new (p.constructor)(0, 1, 0)).normalize();
  cam.position.copy(p).addScaledVector(t, -18).addScaledVector(side, 14);
  cam.position.y = p.y + 11;
  cam.lookAt(p.x - t.x * 8, p.y, p.z - t.z * 8);
  cam.fov = 55;
  cam.aspect = window.innerWidth / window.innerHeight;
  cam.updateProjectionMatrix();
  window.__probeCam = cam;
  g.renderer.render(s.scene, cam);
});
await sleep(300);
await page.evaluate(() => window.__game.renderer.render(window.__game.sea.scene, window.__probeCam));
await page.screenshot({ path: join(OUT, 'e-trench-inspect.png') });

// force the whole route open, to prove the vertex displacement is live
await page.evaluate(() => {
  const g = window.__game;
  g.sea.trench.set(1, 1, -1);
  g.renderer.render(g.sea.scene, window.__probeCam);
});
await sleep(200);
await page.evaluate(() => window.__game.renderer.render(window.__game.sea.scene, window.__probeCam));
await page.screenshot({ path: join(OUT, 'f-all-open.png') });
await page.evaluate(() => {
  const g = window.__game;
  const m = g.sea.trench.mesh.material;
  m.wireframe = true;
  m.emissive.setHex(0x00ff88);
  m.emissiveIntensity = 3;
  g.sea.ground = null;
  g.sea.scene.traverse((o) => {
    if (o.isMesh && o !== g.sea.trench.mesh && o.material && o.material.vertexColors) o.visible = false;
  });
  g.renderer.render(g.sea.scene, window.__probeCam);
});
await sleep(200);
await page.evaluate(() => window.__game.renderer.render(window.__game.sea.scene, window.__probeCam));
await page.screenshot({ path: join(OUT, 'g-wire.png') });
console.log('shaderRan', await page.evaluate(() => {
  const m = window.__game.sea.trench.mesh.material;
  return { hasHook: typeof m.onBeforeCompile === 'function', key: m.customProgramCacheKey().length };
}));

await browser.close();
server.close();
