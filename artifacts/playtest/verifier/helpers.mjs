import { chromium } from '/home/user/260804/node_modules/playwright-core/index.mjs';

export const SHOTS = '/home/user/260804/artifacts/playtest/verifier/shots';

export async function launch(viewport) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__railGameTest, null, { timeout: 10000 });
  return { browser, page, errors };
}

export const phase = (page) => page.evaluate(() => window.__railGameTest.getPhase());
export const hotspots = (page) => page.evaluate(() => window.__railGameTest.getHotspots());
export const signals = (page) => page.evaluate(() => window.__railGameTest.getSignals());
export const zone = (page) => page.evaluate(() => window.__railGameTest.getZone());
export const carPos = (page) => page.evaluate(() => window.__railGameTest.getCarPos());
export const rms = (page) => page.evaluate(() => window.__railGameTest.getRailRms());
export const sparkCount = (page) => page.evaluate(() => window.__railGameTest.getSparkCount());
export const apiErrors = (page) => page.evaluate(() => window.__railGameTest.getErrors());

export const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export async function waitPhase(page, ph, timeout = 20000) {
  await page.waitForFunction((p) => window.__railGameTest.getPhase() === p, ph, { timeout });
}

export async function tap(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
}

/** Real-gesture swipe: down, stepped moves, up. */
export async function swipe(page, from, to, ms = 220, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.waitForTimeout(Math.max(1, ms / steps));
  }
  await page.mouse.up();
}

export async function shot(page, name) {
  const p = `${SHOTS}/${name}.png`;
  await page.screenshot({ path: p });
  return p;
}

/** Advance through the loop using only real gestures. Each step screenshots. */
export const flow = {
  async titleToScan(page, tag) {
    const hs = await hotspots(page);
    await tap(page, ...xy(center(hs.play)));
    await waitPhase(page, 'arrive', 8000).catch(() => {});
    // let the car rattle in naturally
    await waitPhase(page, 'scanBefore', 20000);
    await page.waitForTimeout(300);
    if (tag) await shot(page, `${tag}-scanBefore-idlebtn`);
  },
  async doScan(page, tag, midShotDelay = 1200) {
    const hs = await hotspots(page);
    await tap(page, ...xy(center(hs.scan)));
    await page.waitForTimeout(midShotDelay);
    if (tag) await shot(page, `${tag}-scan-sweep`);
  },
  async prep(page, tag) {
    await waitPhase(page, 'prepUnits', 20000);
    await page.waitForTimeout(300);
    if (tag) await shot(page, `${tag}-prep-start`);
    for (const i of [0, 1]) {
      const hs = await hotspots(page);
      const tray = hs['tray' + i];
      const sock = hs['socket' + i];
      if (!tray || !sock) continue;
      await swipe(page, center(tray), center(sock), 450, 18);
      await page.waitForTimeout(250);
    }
    if (tag) await shot(page, `${tag}-prep-docked`);
  },
  async lever(page, tag) {
    await waitPhase(page, 'lower', 15000);
    await page.waitForTimeout(300);
    if (tag) await shot(page, `${tag}-lever-start`);
    const hs = await hotspots(page);
    const lv = hs.lever;
    const from = { x: lv.x + lv.w / 2, y: lv.y + 24 };
    const to = { x: lv.x + lv.w / 2, y: lv.y + lv.h - 8 };
    await swipe(page, from, to, 700, 20);
    await page.waitForTimeout(200);
    if (tag) await shot(page, `${tag}-lever-locked`);
  },
  /** Drive: fast swipe then hold. Returns spark/intensity samples. */
  async grind(page, tag) {
    await waitPhase(page, 'grind', 15000);
    await page.waitForTimeout(300);
    if (tag) await shot(page, `${tag}-grind-start`);
    const vp = page.viewportSize();
    const portrait = vp.height >= vp.width;
    const start = portrait
      ? { x: vp.width / 2, y: vp.height * 0.66 }
      : { x: vp.width * 0.4, y: vp.height * 0.45 };
    const samples = [];
    const deadline = Date.now() + 45000;
    let shotTaken = false;
    while (Date.now() < deadline) {
      if ((await phase(page)) !== 'grind') break;
      const end = portrait ? { x: start.x, y: start.y - 260 } : { x: start.x + 260, y: start.y };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(start.x + ((end.x - start.x) * i) / 6, start.y + ((end.y - start.y) * i) / 6);
        await page.waitForTimeout(12);
      }
      // hold — targetSpeed persists while finger is down
      for (let k = 0; k < 12; k++) {
        await page.waitForTimeout(220);
        const s = await signals(page);
        samples.push({ sparks: await sparkCount(page), intensity: s.grindIntensity, car: await carPos(page) });
        if (!shotTaken && s.grindIntensity > 0.3) {
          shotTaken = true;
          if (tag) await shot(page, `${tag}-grind-sparks`);
        }
        if ((await phase(page)) !== 'grind') break;
      }
      await page.mouse.up();
      await page.waitForTimeout(80);
    }
    await page.mouse.up().catch(() => {});
    return samples;
  },
  async scanAfter(page, tag) {
    await waitPhase(page, 'scanAfter', 20000);
    await page.waitForTimeout(400);
    const hs = await hotspots(page);
    await tap(page, ...xy(center(hs.scan)));
    await page.waitForTimeout(1400);
    if (tag) await shot(page, `${tag}-scanAfter-ghost`);
  },
  async testRun(page, tag) {
    await waitPhase(page, 'testRun', 20000);
    await page.waitForTimeout(400);
    if (tag) await shot(page, `${tag}-testrun-wait`);
    const vp = page.viewportSize();
    const portrait = vp.height >= vp.width;
    const mid = { x: vp.width / 2, y: vp.height * 0.55 };
    const to = portrait ? { x: mid.x, y: mid.y - 200 } : { x: mid.x + 200, y: mid.y };
    await swipe(page, mid, to, 250, 10);
    await page.waitForTimeout(1500);
    if (tag) await shot(page, `${tag}-testrun-glide`);
  },
  async replay(page, tag) {
    await waitPhase(page, 'replay', 30000);
    await page.waitForTimeout(400);
    if (tag) await shot(page, `${tag}-replay`);
  },
};

const xy = (p) => [p.x, p.y];
