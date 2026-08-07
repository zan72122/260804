// Fast visual regression tool: jumps the game straight to each key beat and
// screenshots it in portrait and landscape. Far quicker to iterate on than a
// full playthrough, and it makes framing problems obvious side by side.
//
//   node tools/shots.mjs [beat ...]
//
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'playtest', 'shots');
const PORT = Number(process.env.PT_PORT || 4300);
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

/** Each beat: how to force the game into that state. Runs in page context. */
const BEATS = {
  map: { settle: 2500, fn: () => {} },
  prep: {
    settle: 4000,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
    },
  },
  thread: {
    settle: 3000,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
      const s = g.sea;
      s.prepState = 'thread';
      s.threadT = 0.45;
    },
  },
  payoutEarly: {
    settle: 3500,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
      const s = g.sea;
      s.prepState = 'ready';
      s.threadT = 1;
      s.phase = 'payout';
      s.paid = 22;
      s.payRate = 14;
      s.shipDist = 22 * 0.85;
    },
  },
  payoutLate: {
    settle: 3500,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
      const s = g.sea;
      s.prepState = 'ready';
      s.threadT = 1;
      s.phase = 'payout';
      s.paid = 180;
      s.payRate = 16;
      s.shipDist = 180 * 0.85;
      s.layS = Math.max(0, (180 * 0.85 - 46) / 380);
    },
  },
  descentTop: {
    settle: 3000,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
      const s = g.sea;
      s.prepState = 'ready';
      s.threadT = 1;
      s.phase = 'descent';
      s.paid = 310;
      s.shipDist = 310 * 0.85;
      s.layS = (310 * 0.85 - 46) / 380;
      s.descentT = 2.0;
      s.descentIdx = 210;
    },
  },
  descentMid: {
    settle: 3000,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
      const s = g.sea;
      s.prepState = 'ready';
      s.threadT = 1;
      s.phase = 'descent';
      s.paid = 340;
      s.shipDist = 340 * 0.85;
      s.layS = (340 * 0.85 - 46) / 380;
      s.descentT = 7.5;
      s.descentIdx = 175;
    },
  },
  rovDark: {
    settle: 3000,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
      const s = g.sea;
      s.prepState = 'ready';
      s.threadT = 1;
      s.phase = 'rov';
      s.paid = 420;
      s.shipDist = 420 * 0.85;
      s.layS = Math.min(1, (420 * 0.85 - 46) / 380);
      s.buryS = 0.03;
    },
  },
  trench: {
    settle: 8000,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterSea();
      const s = g.sea;
      s.prepState = 'ready';
      s.threadT = 1;
      s.phase = 'rov';
      s.paid = 420;
      s.shipDist = 420 * 0.85;
      s.layS = Math.min(1, (420 * 0.85 - 46) / 380);
      s.buryS = 0.45;
      s.lightsRequested = true;
      s.buryVel = 0.03;
    },
  },
  finale: {
    settle: 9000,
    fn: () => {
      const g = window.__game;
      g.hud.setTitle(false);
      g.enterFinale();
    },
  },
};

const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const beats = Object.keys(BEATS).filter((b) => !want.length || want.includes(b));
const SIZES = [
  { name: 'p', w: 390, h: 844 },
  { name: 'l', w: 844, h: 390 },
];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

for (const size of SIZES) {
  const page = await browser.newPage({
    viewport: { width: size.w, height: size.h },
    isMobile: true,
    hasTouch: true,
  });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE', m.text().split('\n')[0]);
  });
  for (const b of beats) {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await sleep(2200);
    await page.evaluate(BEATS[b].fn);
    await sleep(BEATS[b].settle);
    // The damped camera needs many frames to arrive and software rendering
    // only gives us a handful; snap it so the capture shows the real framing.
    await page.evaluate(() => window.__game.sea?.snapCamera?.());
    await sleep(900);
    await page.screenshot({ path: join(OUT, `${b}-${size.name}.png`) });
    process.stdout.write(`${b}-${size.name} `);
  }
  await page.close();
}
console.log('\ndone ->', OUT);
await browser.close();
server.close();
