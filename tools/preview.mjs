/**
 * Fast visual preview: jumps the game straight to a named beat and grabs one
 * screenshot per viewport. Used while art-directing; the full interaction
 * check lives in playtest.mjs.
 *
 *   node tools/preview.mjs --beat=working --vp=ip,il,pp,pl --out=shots
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};

const URL = arg('url', 'http://localhost:5180/');
const OUT = arg('out', 'shots');
const BEAT = arg('beat', 'working');
const WAIT = +arg('wait', '0');

const VPS = {
  ip: { name: 'iphone-portrait', width: 393, height: 852, dpr: 3 },
  il: { name: 'iphone-landscape', width: 852, height: 393, dpr: 3 },
  pp: { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2 },
  pl: { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Software GL renders at a handful of fps, and the game clamps dt so a stalled
 * tab never fast-forwards. Waiting on wall-clock therefore under-runs the
 * simulation badly; wait on the game's own clock instead.
 */
async function waitGame(page, seconds, capMs = 240000) {
  const t0 = await page.evaluate(() => window.__ukai.game.t);
  const start = Date.now();
  for (;;) {
    await sleep(150);
    const t = await page.evaluate(() => window.__ukai.game.t);
    if (t - t0 >= seconds || Date.now() - start > capMs) return;
  }
}

/** Beats are expressed as things the game can be told to do, not as fake state. */
const BEATS = {
  dusk: `g.phase='depart'; g.phaseT=0.4;`,
  embers: `g.phase='kindle'; g.phaseT=1; g.night=0.92;`,
  lit: `g.phase='fishing'; g.night=1; g.fire.setStrength(1); g.fire.strength=1;`,
  released: `
    g.phase='fishing'; g.night=1; g.fire.setStrength(1); g.fire.strength=1;
    window.__script = [[0.0,'r0'],[0.4,'r1'],[0.8,'r2'],[1.2,'r3'],[1.6,'r4']];`,
  working: `
    g.phase='fishing'; g.night=1; g.fire.setStrength(1); g.fire.strength=1;
    window.__script = [[0,'r0'],[0.35,'r1'],[0.7,'r2'],[1.05,'r3'],[1.4,'r4'],[5.0,'find']];`,
  hauling: `
    g.phase='fishing'; g.night=1; g.fire.setStrength(1); g.fire.strength=1;
    window.__script = [[0,'r0'],[0.35,'r1'],[0.7,'r2'],[1.05,'r3'],[1.4,'r4'],[4.6,'find'],
      [6.0,'haul'],[6.5,'haul'],[7.0,'haul'],[7.5,'haul'],[8.0,'haul'],[8.6,'haul']];`,
  basket: `
    g.phase='fishing'; g.night=1; g.fire.setStrength(1); g.fire.strength=1;
    g.fishCount=0;
    for(let i=0;i<11;i++){ const f=window.__mkFish(i); g.boat.addToBasket(f,i); }
    g.fishCount=11;
    g.birds.forEach((b,i)=>{ if(i<2) setTimeout(()=>g.doRelease(b), i*300); });`,
  finale: `
    g.night=1; g.fire.setStrength(1); g.fire.strength=1; g.fishCount=10;
    g.startFinale();`,
};

/** In game seconds, not wall-clock. */
const WAITS = {
  dusk: 2.6,
  embers: 1.2,
  lit: 1.4,
  released: 2.6,
  working: 7,
  hauling: 11,
  basket: 2.2,
  finale: 11,
};

async function run(vp, beat) {
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
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${m.type()}] ${m.text()}`);
  });
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(700);
  const cam = arg('cam', '');
  if (cam) {
    const n = cam.split(',').map(Number);
    await page.evaluate((v) => window.__ukai.stage.debugCamera(...v), n);
  }
  const hide = arg('hide', '');
  if (hide) {
    await page.evaluate((names) => {
      const g = window.__ukai.game;
      for (const n of names.split('+')) {
        const o =
          n === 'banks'
            ? g.env.group.children.filter((c) => c.type === 'Group')
            : [g[n]?.group ?? g[n]];
        for (const x of o) if (x) x.visible = false;
      }
    }, hide);
  }
  await page.evaluate(`(() => { const g = window.__ukai.game; ${BEATS[beat]} })()`);
  // Drive scripted beats off the game clock so software GL doesn't skew them.
  await page.evaluate(() => {
    const g = window.__ukai.game;
    const script = window.__script;
    if (!script) return;
    const t0 = g.t;
    const done = new Set();
    const tick = () => {
      const dt = g.t - t0;
      script.forEach(([at, what], i) => {
        if (dt < at || done.has(i)) return;
        done.add(i);
        if (what.startsWith('r')) g.doRelease(g.birds[+what.slice(1)]);
        else if (what === 'find') g.birds.forEach((b) => b.hurryFind && b.hurryFind());
        else if (what === 'haul') g.birds.forEach((b) => g.doHaul(b, 0.16));
      });
      if (done.size < script.length) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await waitGame(page, WAIT || WAITS[beat] || 2);
  const dir = path.join(OUT, beat);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${vp.name}.png`) });
  await browser.close();
  return errs;
}

const wanted = arg('vp', 'ip').split(',');
for (const key of wanted) {
  const vp = VPS[key.trim()];
  if (!vp) continue;
  const errs = await run(vp, BEAT);
  console.log(
    `${BEAT}/${vp.name}${errs.length ? ' ERRORS: ' + errs.slice(0, 4).join(' | ') : ' ok'}`,
  );
}
