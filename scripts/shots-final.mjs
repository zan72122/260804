// scripts/shots-final.mjs
// A7最終検証: 指定シーン一式のスクリーンショットを iPhone縦(390x844) と
// iPad横(1180x820) の2視口で撮る。e2e.mjs のジェスチャーヘルパーを流用。
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = '/tmp/claude-0/-home-user-260804/2eeaee21-2a8b-56e3-9168-8c4b4d89a82d/scratchpad/shots-final';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const PORT = 4178;
const BASE_URL = `http://localhost:${PORT}/`;
const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const W = {
  noticeAlert: { x: 300, y: -260 },
  fenceParked: { x: -190, y: 40 },
  fenceDrop: { x: -55, y: -30 },
  stopSwitch: { x: -60, y: -95 },
  lockIcon: { x: -60, y: -15 },
  plateHandle: { x: 570, y: -308 },
  crankWheel: { x: 0, y: 65 },
  toolboxNewRoller: { x: -230, y: 60 },
  removedRollerBin: { x: -90, y: -230 }
};
const CHAIN_GUIDE_OFFSET = { x: 26, y: -16 };
const HANDRAIL_START_OFFSET = { x: -30, y: 34 };
const HANDRAIL_END_OFFSET = { x: 34, y: -6 };
const STEP_PULL_T = 0.3;

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'ipad-landscape', width: 1180, height: 820 }
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe']
    });
    let resolved = false;
    proc.stdout.on('data', (data) => {
      if (!resolved && data.toString().includes('Local:')) { resolved = true; resolve(proc); }
    });
    proc.stderr.on('data', (d) => process.stderr.write(`[preview:err] ${d}`));
    proc.on('exit', (code) => { if (!resolved) reject(new Error(`preview exited ${code}`)); });
    setTimeout(() => { if (!resolved) { resolved = true; resolve(proc); } }, 6000);
  });
}

async function worldToScreen(page, x, y) {
  return page.evaluate(([x, y]) => window.__layoutDebug.worldToScreen(x, y), [x, y]);
}
async function pathPoint(page, t) {
  return page.evaluate((t) => {
    const p = window.__flowDebug.state.escalator.pathPoint(t);
    return { x: p.x, y: p.y };
  }, t);
}
async function faultAnchorWorld(page) {
  return page.evaluate(() => {
    const st = window.__flowDebug.state;
    if (!st.fault) return null;
    const p = st.escalator.pathPoint(st.fault.anchorT);
    return { x: p.x, y: p.y };
  });
}
function lerpPts(a, b, n) {
  const out = [];
  for (let i = 1; i <= n; i++) { const t = i / n; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  return out;
}
async function dragPath(page, worldPoints, opts = {}) {
  const first = worldPoints[0];
  const s0 = await worldToScreen(page, first.x, first.y);
  await page.mouse.move(s0.x, s0.y);
  await page.mouse.down();
  await sleep(opts.startHoldMs ?? 40);
  for (let i = 1; i < worldPoints.length; i++) {
    const p = worldPoints[i];
    const s = await worldToScreen(page, p.x, p.y);
    await page.mouse.move(s.x, s.y, { steps: opts.substeps ?? 3 });
    await sleep(opts.stepMs ?? 22);
  }
  await sleep(opts.endHoldMs ?? 40);
  await page.mouse.up();
}
async function tapWorld(page, wx, wy, opts = {}) {
  const s = await worldToScreen(page, wx, wy);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await sleep(opts.holdMs ?? 70);
  await page.mouse.up();
  await sleep(opts.afterMs ?? 30);
}
async function swipeWorld(page, from, dxWorld, dyWorld, opts = {}) {
  const to = { x: from.x + dxWorld, y: from.y + dyWorld };
  const pts = [from, ...lerpPts(from, to, opts.steps ?? 8)];
  await dragPath(page, pts, opts);
}
async function dragWorld(page, from, to, opts = {}) {
  const pts = [from, ...lerpPts(from, to, opts.steps ?? 10)];
  await dragPath(page, pts, opts);
}
async function crankGesture(page, center, radius, totalRadians, opts = {}) {
  const steps = opts.steps ?? 50;
  const startAngle = opts.startAngle ?? 0.3;
  const first = { x: center.x + radius * Math.cos(startAngle), y: center.y + radius * Math.sin(startAngle) };
  const s0 = await worldToScreen(page, first.x, first.y);
  await page.mouse.move(s0.x, s0.y);
  await page.mouse.down();
  await sleep(30);
  const midStep = opts.midStopAt ?? null;
  for (let i = 1; i <= steps; i++) {
    const a = startAngle + (totalRadians * i) / steps;
    const wp = { x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) };
    const s = await worldToScreen(page, wp.x, wp.y);
    await page.mouse.move(s.x, s.y);
    await sleep(10);
    if (midStep && i === midStep.atStep) {
      await midStep.onReach();
    }
  }
  await sleep(30);
  await page.mouse.up();
}
async function traceGesture(page, worldPath, opts = {}) {
  await dragPath(page, worldPath, { substeps: 2, stepMs: 25, ...opts });
}
async function rubGesture(page, center, opts = {}) {
  const amp = opts.amp ?? 36;
  const cycles = opts.cycles ?? 12;
  const s0 = await worldToScreen(page, center.x - amp, center.y);
  await page.mouse.move(s0.x, s0.y);
  await page.mouse.down();
  await sleep(20);
  for (let i = 0; i < cycles; i++) {
    const wx = i % 2 === 0 ? center.x + amp : center.x - amp;
    const s = await worldToScreen(page, wx, center.y + (i % 4 < 2 ? 6 : -6));
    await page.mouse.move(s.x, s.y, { steps: 3 });
    await sleep(14);
  }
  await sleep(20);
  await page.mouse.up();
}
async function clickHud(page, id) {
  await page.click(`button[aria-label="${id}"]`);
  await sleep(60);
}
async function waitCameraSettled(page, { tries = 25, gapMs = 60, epsScale = 0.004, epsPos = 0.8 } = {}) {
  let prev = await page.evaluate(() => ({ ...window.__layoutDebug.camera }));
  for (let i = 0; i < tries; i++) {
    await sleep(gapMs);
    const cur = await page.evaluate(() => ({ ...window.__layoutDebug.camera }));
    const dScale = Math.abs(cur.scale - prev.scale);
    const dPos = Math.hypot(cur.cx - prev.cx, cur.cy - prev.cy);
    if (dScale < epsScale && dPos < epsPos) return;
    prev = cur;
  }
}
async function waitPhase(page, phase, timeout = 9000) {
  await page.waitForFunction((p) => window.__flowDebug && window.__flowDebug.state.phase === p, phase, { timeout });
  await waitCameraSettled(page);
}
async function waitFn(page, fnBody, timeout = 9000) {
  await page.waitForFunction(fnBody, null, { timeout });
}
async function shot(page, dir, name) {
  const file = path.join(SHOTS_DIR, `${dir}__${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  shot: ${dir}__${name}.png`);
  return file;
}

async function doRepair(page, kind) {
  const anchor = await faultAnchorWorld(page);
  if (kind === 'roller') {
    await dragWorld(page, anchor, W.removedRollerBin, { steps: 10 });
    await waitFn(page, () => window.__flowDebug.state.fault && window.__flowDebug.state.fault.progress >= 0.5);
    const anchor2 = await faultAnchorWorld(page);
    await dragWorld(page, W.toolboxNewRoller, anchor2, { steps: 10 });
  } else if (kind === 'chainGuide') {
    const from = { x: anchor.x + CHAIN_GUIDE_OFFSET.x, y: anchor.y + CHAIN_GUIDE_OFFSET.y };
    await dragWorld(page, from, anchor, { steps: 8 });
  } else if (kind === 'handrail') {
    const sx = anchor.x + HANDRAIL_START_OFFSET.x, sy = anchor.y + HANDRAIL_START_OFFSET.y;
    const ex = anchor.x + HANDRAIL_END_OFFSET.x, ey = anchor.y + HANDRAIL_END_OFFSET.y;
    const N = 8, path = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N; const bow = Math.sin(u * Math.PI) * 22;
      path.push({ x: sx + (ex - sx) * u, y: sy + (ey - sy) * u + bow });
    }
    await traceGesture(page, path);
  } else if (kind === 'sensor') {
    await rubGesture(page, anchor, { amp: 34, cycles: 14 });
  }
  await waitPhase(page, 'crankCheck', 8000);
}

async function driveToRepair(page, kind) {
  await page.evaluate((k) => window.__flowDebug.forceFault(k), kind);
  await waitPhase(page, 'notice', 4000);
  await tapWorld(page, W.noticeAlert.x, W.noticeAlert.y);
  await waitPhase(page, 'safety');
  await dragWorld(page, W.fenceParked, W.fenceDrop, { steps: 6 });
  await waitFn(page, () => window.__flowDebug.state.fencePlaced === true);
  await tapWorld(page, W.stopSwitch.x, W.stopSwitch.y);
  await waitFn(page, () => window.__flowDebug.state.stopped === true);
  await tapWorld(page, W.lockIcon.x, W.lockIcon.y);
  await waitPhase(page, 'openPlate');
  await swipeWorld(page, W.plateHandle, 0, -170, { steps: 8, stepMs: 20 });
  await waitPhase(page, 'removeStep', 4000);
  const stepPos1 = await pathPoint(page, STEP_PULL_T);
  await tapWorld(page, stepPos1.x, stepPos1.y);
  await waitFn(page, () => window.__flowDebug.state.handleAttached === true);
  const stepPos2 = await pathPoint(page, STEP_PULL_T);
  await swipeWorld(page, stepPos2, 0, -150, { steps: 6, stepMs: 20 });
  await waitPhase(page, 'inspect', 4000);
  const anchor = await faultAnchorWorld(page);
  await tapWorld(page, anchor.x, anchor.y);
  await waitPhase(page, 'repair', 4000);
}

async function finishRestOfLoop(page) {
  await crankGesture(page, W.crankWheel, 90, Math.PI * 2 * 1.2, { steps: 50 });
  await waitPhase(page, 'restoreStep', 6000);
  const gapBefore = await page.evaluate(() => {
    const st = window.__flowDebug.state;
    const t = st.escalator.removedStep !== null ? st.escalator.stepT(st.escalator.removedStep) : null;
    return t !== null ? st.escalator.pathPoint(t) : null;
  });
  const stepParked = { x: gapBefore.x - 130, y: gapBefore.y - 60 };
  await dragWorld(page, stepParked, gapBefore, { steps: 8 });
  await waitPhase(page, 'closePlate', 4000);
  await swipeWorld(page, W.plateHandle, 0, 170, { steps: 8, stepMs: 20 });
  await waitPhase(page, 'testRun', 4000);
  await clickHud(page, 'ui:slow');
  await sleep(300);
  await clickHud(page, 'ui:fast');
  await waitPhase(page, 'celebrate', 4000);
  await waitPhase(page, 'select', 6000);
  await sleep(1000);
}

async function runViewport(browser, vp) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE_URL, { waitUntil: 'load' });
  await waitFn(page, () => !!window.__flowDebug && !!window.__layoutDebug, 10000);

  // 1. title
  await shot(page, vp.name, '01-title');

  // start -> notice (💥視認)
  await clickHud(page, 'ui:start');
  await waitPhase(page, 'notice');
  await sleep(400);
  await shot(page, vp.name, '02-notice');

  // safety: fence -> switch -> lock
  await tapWorld(page, W.noticeAlert.x, W.noticeAlert.y);
  await waitPhase(page, 'safety');
  await dragWorld(page, W.fenceParked, W.fenceDrop, { steps: 8 });
  await waitFn(page, () => window.__flowDebug.state.fencePlaced === true);
  await tapWorld(page, W.stopSwitch.x, W.stopSwitch.y);
  await waitFn(page, () => window.__flowDebug.state.stopped === true);
  await tapWorld(page, W.lockIcon.x, W.lockIcon.y);
  await waitPhase(page, 'openPlate');
  await sleep(300);
  await shot(page, vp.name, '03-safety-fence-done');

  // openPlate: mid-open (light leak, exterior) + full open (cutaway zoom)
  await swipeWorld(page, W.plateHandle, 0, -170, { steps: 12, stepMs: 30 });
  await sleep(260);
  await shot(page, vp.name, '04-paka-mid-open');
  await waitPhase(page, 'removeStep', 4000);
  await sleep(200);
  await shot(page, vp.name, '05-paka-full-open');

  // removeStep: handle attach -> pull ("spon") -> shot right after
  const stepPos1 = await pathPoint(page, STEP_PULL_T);
  await tapWorld(page, stepPos1.x, stepPos1.y);
  await waitFn(page, () => window.__flowDebug.state.handleAttached === true);
  const stepPos2 = await pathPoint(page, STEP_PULL_T);
  await swipeWorld(page, stepPos2, 0, -150, { steps: 8, stepMs: 25 });
  await waitFn(page, () => window.__flowDebug.state.stepRemoved >= 1, 4000);
  await sleep(150);
  await shot(page, vp.name, '06-spon-step-removed');
  await waitPhase(page, 'inspect', 4000);

  // inspect: fault glowing, not yet tapped
  await sleep(500);
  await shot(page, vp.name, '07-inspect-found');

  // tap fault -> repair (roller, first kind)
  const anchor = await faultAnchorWorld(page);
  await tapWorld(page, anchor.x, anchor.y);
  await waitPhase(page, 'repair', 4000);
  await sleep(200);
  const kind1 = (await page.evaluate(() => window.__flowDebug.state.fault.kind));
  await shot(page, vp.name, `08-repair-${kind1}`);

  // repair gesture -> crankCheck, capture a mid-crank frame
  await doRepairWithMidShot(page, kind1, vp.name);

  // restoreStep: drop guide visible before dragging back
  await sleep(400);
  await shot(page, vp.name, '10-restoreStep-dropguide');
  const gapBefore = await page.evaluate(() => {
    const st = window.__flowDebug.state;
    const t = st.escalator.removedStep !== null ? st.escalator.stepT(st.escalator.removedStep) : null;
    return t !== null ? st.escalator.pathPoint(t) : null;
  });
  const stepParked = { x: gapBefore.x - 130, y: gapBefore.y - 60 };
  await dragWorld(page, stepParked, gapBefore, { steps: 10 });
  await waitPhase(page, 'closePlate', 4000);

  // closePlate -> testRun
  await swipeWorld(page, W.plateHandle, 0, 170, { steps: 10, stepMs: 25 });
  await waitPhase(page, 'testRun', 4000);
  await clickHud(page, 'ui:slow');
  await sleep(500);
  await shot(page, vp.name, '11-testRun');
  await clickHud(page, 'ui:fast');

  // celebrate (confetti) -> select
  await waitPhase(page, 'celebrate', 4000);
  await sleep(400);
  await shot(page, vp.name, '12-celebrate');
  await waitPhase(page, 'select', 6000);
  await sleep(1000);
  await shot(page, vp.name, '13-select');

  // freeObserve
  await clickHud(page, 'ui:observe');
  await waitFn(page, () => window.__flowDebug.state.mode === 'freeObserve');
  await crankGesture(page, W.crankWheel, 90, Math.PI * 1.2, { steps: 30 });
  await sleep(200);
  await shot(page, vp.name, '14-freeObserve');
  await clickHud(page, 'ui:back');
  await waitFn(page, () => window.__flowDebug.state.mode === 'play' && window.__flowDebug.state.phase === 'select');
  await sleep(900);

  // stepPlay
  await clickHud(page, 'ui:stepPlay');
  await waitFn(page, () => window.__flowDebug.state.mode === 'stepPlay');
  {
    const p = await pathPoint(page, STEP_PULL_T);
    await tapWorld(page, p.x, p.y);
    await waitFn(page, () => window.__flowDebug.state.handleAttached === true);
    const p2 = await pathPoint(page, STEP_PULL_T);
    await swipeWorld(page, p2, 0, -140, { steps: 6, stepMs: 18 });
    await waitFn(page, () => window.__flowDebug.state.stepRemoved >= 1, 4000);
    await sleep(200);
  }
  await shot(page, vp.name, '15-stepPlay');
  await clickHud(page, 'ui:back');
  await waitFn(page, () => window.__flowDebug.state.mode === 'play' && window.__flowDebug.state.phase === 'select');
  await sleep(900);

  // panorama cutaway (debug composite: full loop cross-section)
  await page.evaluate(() => { window.__flowDebug.state.view = 'cutaway'; });
  await sleep(250);
  await shot(page, vp.name, '16-panorama-cutaway');
  await page.evaluate(() => { window.__flowDebug.state.view = 'exterior'; });

  // remaining 3 fault kinds' repair shots (chainGuide/handrail/sensor)
  for (const kind of ['chainGuide', 'handrail', 'sensor']) {
    await driveToRepair(page, kind);
    await sleep(200);
    await shot(page, vp.name, `08-repair-${kind}`);
    await doRepair(page, kind);
    await finishRestOfLoop(page);
  }

  console.log(`  console/page errors: ${errors.length}`);
  if (errors.length) errors.forEach((e) => console.log(`    ${e}`));

  await context.close();
  return errors;
}

async function doRepairWithMidShot(page, kind, vpName) {
  const anchor = await faultAnchorWorld(page);
  if (kind === 'roller') {
    await dragWorld(page, anchor, W.removedRollerBin, { steps: 10 });
    await waitFn(page, () => window.__flowDebug.state.fault && window.__flowDebug.state.fault.progress >= 0.5);
    const anchor2 = await faultAnchorWorld(page);
    await dragWorld(page, W.toolboxNewRoller, anchor2, { steps: 10 });
  } else if (kind === 'chainGuide') {
    const from = { x: anchor.x + CHAIN_GUIDE_OFFSET.x, y: anchor.y + CHAIN_GUIDE_OFFSET.y };
    await dragWorld(page, from, anchor, { steps: 8 });
  } else if (kind === 'handrail') {
    const sx = anchor.x + HANDRAIL_START_OFFSET.x, sy = anchor.y + HANDRAIL_START_OFFSET.y;
    const ex = anchor.x + HANDRAIL_END_OFFSET.x, ey = anchor.y + HANDRAIL_END_OFFSET.y;
    const N = 8, path = [];
    for (let i = 0; i <= N; i++) { const u = i / N; const bow = Math.sin(u * Math.PI) * 22; path.push({ x: sx + (ex - sx) * u, y: sy + (ey - sy) * u + bow }); }
    await traceGesture(page, path);
  } else if (kind === 'sensor') {
    await rubGesture(page, anchor, { amp: 34, cycles: 14 });
  }
  await waitPhase(page, 'crankCheck', 8000);
  await sleep(300);
  await shot(page, vpName, '09-crank-start');
  await crankGesture(page, W.crankWheel, 90, Math.PI * 2 * 1.25, {
    steps: 60,
    midStopAt: { atStep: 30, onReach: async () => { await shot(page, vpName, '09-crank-mid'); } }
  });
  await waitPhase(page, 'restoreStep', 6000);
}

async function main() {
  console.log('starting preview server...');
  const server = await startPreviewServer();
  console.log('launching chromium...');
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const allErrors = [];
  try {
    for (const vp of VIEWPORTS) {
      try {
        const errs = await runViewport(browser, vp);
        allErrors.push(...errs.map((e) => ({ vp: vp.name, e })));
      } catch (err) {
        console.error(`!! ERROR on ${vp.name}: ${err.stack || err}`);
        allErrors.push({ vp: vp.name, e: String(err.stack || err) });
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('\n=== SUMMARY ===');
  console.log(`total errors: ${allErrors.length}`);
  allErrors.forEach((e) => console.log(`  [${e.vp}] ${e.e}`));
  console.log(`shots saved to: ${SHOTS_DIR}`);
}

main().then(() => { console.log('done'); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
