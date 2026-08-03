// scripts/e2e.mjs
// A7統合: 実ブラウザ(Chromium, Playwright)で実際にゲームを一周プレイする検証スクリプト。
// 4視口(iPhone縦/横, iPad縦/横)で起動し、実ポインタ軌跡(down/move/up)で
// タップ/スワイプ/ドラッグ/円(crank)/なぞり(trace)/こすり(rub)を模擬する。
//
// 使い方: node scripts/e2e.mjs
// 事前に `npm run build` 済みであること(このスクリプトが vite preview を起動する)。

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = '/tmp/claude-0/-home-user-260804/2eeaee21-2a8b-56e3-9168-8c4b4d89a82d/scratchpad/shots';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/`;
const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ALL_ERRORS = []; // { view, kind, text }

// ---------------------------------------------------------------------------
// ワールド座標定数(src/game/coords.ts / src/render/scene.ts WORLD の値と一致させる)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// viewport定義
// ---------------------------------------------------------------------------
const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'ipad-landscape', width: 1180, height: 820 }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// preview サーバ起動
// ---------------------------------------------------------------------------
function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let resolved = false;
    const onData = (data) => {
      const s = data.toString();
      if (!resolved && s.includes('Local:')) {
        resolved = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (d) => process.stderr.write(`[preview:err] ${d}`));
    proc.on('exit', (code) => {
      if (!resolved) reject(new Error(`preview server exited early (code ${code})`));
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(proc); // ポートが既に開いている可能性もあるので一定時間で諦めて続行
      }
    }, 6000);
  });
}

// ---------------------------------------------------------------------------
// ジェスチャー・ヘルパー(ワールド座標 -> screenToWorld/worldToScreenの逆で変換)
// ---------------------------------------------------------------------------
async function worldToScreen(page, x, y) {
  return page.evaluate(([x, y]) => window.__layoutDebug.worldToScreen(x, y), [x, y]);
}

async function pathPoint(page, t) {
  return page.evaluate((t) => {
    const p = window.__flowDebug.state.escalator.pathPoint(t);
    return { x: p.x, y: p.y };
  }, t);
}

async function getState(page) {
  return page.evaluate(() => {
    const st = window.__flowDebug.state;
    return {
      phase: st.phase,
      mode: st.mode,
      view: st.view,
      location: st.location,
      fencePlaced: st.fencePlaced,
      stopped: st.stopped,
      locked: st.locked,
      plateOpen: st.plateOpen,
      handleAttached: st.handleAttached,
      stepRemoved: st.stepRemoved,
      crankTotal: st.crankTotal,
      testRunStage: st.testRunStage,
      faultKind: st.fault ? st.fault.kind : null,
      faultFixed: st.fault ? st.fault.fixed : null,
      faultProgress: st.fault ? st.fault.progress : null,
      faultAnchorT: st.fault ? st.fault.anchorT : null
    };
  });
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
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
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
  for (let i = 1; i <= steps; i++) {
    const a = startAngle + (totalRadians * i) / steps;
    const wp = { x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) };
    const s = await worldToScreen(page, wp.x, wp.y);
    await page.mouse.move(s.x, s.y);
    await sleep(10);
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

// カメラ(layout.camera)が収束するまで待つ。フェーズ転換直後は wideLoop から
// 一点ズームへ等、大きくジャンプすることがある(例: notice の全景 -> safety の
// 一点ズーム)。ジェスチャー中は毎ステップ worldToScreen を読み直しているので
// 理屈上は動いていても平気なはずだが、evaluate の往復(数十ms)の間にも
// camera.update(dt) が毎フレーム進むため、収束前に最初の pointerdown を打つと
// 「読み取った時のカメラ」と「ブラウザがイベントを処理する時のカメラ」がズレて
// ホットスポットの許容半径を外れることがある。収束を待つことでこれを避ける。
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
  return file;
}

// ---------------------------------------------------------------------------
// 故障ごとの修理ジェスチャー
// ---------------------------------------------------------------------------
async function doRepair(page, viewName) {
  const st = await getState(page);
  const anchor = await faultAnchorWorld(page);
  if (!anchor) throw new Error('no fault anchor');

  if (st.faultKind === 'roller') {
    // 古ローラーをドラッグで外す -> removedRollerBin
    await dragWorld(page, anchor, W.removedRollerBin, { steps: 10 });
    await waitFn(page, () => window.__flowDebug.state.fault && window.__flowDebug.state.fault.progress >= 0.5);
    // 新品ローラーを toolboxNewRoller からアンカーへ
    const anchor2 = await faultAnchorWorld(page);
    await dragWorld(page, W.toolboxNewRoller, anchor2, { steps: 10 });
  } else if (st.faultKind === 'chainGuide') {
    const from = { x: anchor.x + CHAIN_GUIDE_OFFSET.x, y: anchor.y + CHAIN_GUIDE_OFFSET.y };
    await dragWorld(page, from, anchor, { steps: 8 });
  } else if (st.faultKind === 'handrail') {
    const sx = anchor.x + HANDRAIL_START_OFFSET.x;
    const sy = anchor.y + HANDRAIL_START_OFFSET.y;
    const ex = anchor.x + HANDRAIL_END_OFFSET.x;
    const ey = anchor.y + HANDRAIL_END_OFFSET.y;
    const N = 8;
    const path = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const bow = Math.sin(u * Math.PI) * 22;
      path.push({ x: sx + (ex - sx) * u, y: sy + (ey - sy) * u + bow });
    }
    await traceGesture(page, path);
  } else if (st.faultKind === 'sensor') {
    await rubGesture(page, anchor, { amp: 34, cycles: 14 });
  } else {
    throw new Error(`unknown fault kind: ${st.faultKind}`);
  }

  await waitPhase(page, 'crankCheck', 8000);
  void viewName;
}

// ---------------------------------------------------------------------------
// フル一周(タイトル -> select)。shotPrefix が渡されればスクリーンショットを撮る。
// ---------------------------------------------------------------------------
async function fullPlaythrough(page, { shotPrefix = null, misclicks = false } = {}) {
  const errorsBefore = ALL_ERRORS.length;

  await waitFn(page, () => !!window.__flowDebug && !!window.__layoutDebug, 10000);
  if (shotPrefix) await shot(page, shotPrefix, '01-title');

  // --- title ---
  await clickHud(page, 'ui:start');
  await waitPhase(page, 'notice');
  if (shotPrefix) await shot(page, shotPrefix, '02-notice');

  if (misclicks) {
    // 誤操作: 関係ない場所を連打しても何も起きない/壊れないことを確認
    await tapWorld(page, -300, 200, { holdMs: 40 });
    await tapWorld(page, 250, -50, { holdMs: 40 });
  }

  // --- notice: 💥タップ ---
  await tapWorld(page, W.noticeAlert.x, W.noticeAlert.y);
  await waitPhase(page, 'safety');

  // --- safety: 柵ドラッグ -> スイッチ -> 鍵 ---
  await dragWorld(page, W.fenceParked, W.fenceDrop, { steps: 8 });
  await waitFn(page, () => window.__flowDebug.state.fencePlaced === true);
  await tapWorld(page, W.stopSwitch.x, W.stopSwitch.y);
  await waitFn(page, () => window.__flowDebug.state.stopped === true);
  await tapWorld(page, W.lockIcon.x, W.lockIcon.y);
  await waitPhase(page, 'openPlate');
  if (shotPrefix) await shot(page, shotPrefix, '03-safety-done');

  // --- openPlate: 上スワイプ「パカッ」---
  await swipeWorld(page, W.plateHandle, 0, -170, { steps: 10, stepMs: 25 });
  // 開いている途中(輪+暖色光が見える瞬間)を捉える
  await sleep(280);
  if (shotPrefix) await shot(page, shotPrefix, '04-paka-mid-open');
  await waitPhase(page, 'removeStep', 4000);
  if (shotPrefix) await shot(page, shotPrefix, '05-paka-full-open');

  // --- removeStep: ハンドル装着 -> 上スワイプ「スポン」---
  const stepPos1 = await pathPoint(page, STEP_PULL_T);
  await tapWorld(page, stepPos1.x, stepPos1.y);
  await waitFn(page, () => window.__flowDebug.state.handleAttached === true);
  const stepPos2 = await pathPoint(page, STEP_PULL_T);
  await swipeWorld(page, stepPos2, 0, -150, { steps: 8, stepMs: 25 });
  await waitPhase(page, 'inspect', 4000);
  if (shotPrefix) await shot(page, shotPrefix, '06-step-removed-inside');

  // --- inspect: 故障タップ ---
  const anchor = await faultAnchorWorld(page);
  if (misclicks) {
    await tapWorld(page, anchor.x + 400, anchor.y + 200, { holdMs: 40 }); // 外れた場所
  }
  await tapWorld(page, anchor.x, anchor.y);
  await waitPhase(page, 'repair', 4000);
  if (shotPrefix) await shot(page, shotPrefix, '07-inspect-found');

  // --- repair: 故障別ジェスチャー ---
  await doRepair(page, shotPrefix ?? 'run');
  if (shotPrefix) await shot(page, shotPrefix, '08-repaired-crankcheck');

  // --- crankCheck: 円ジェスチャーで2π+ ---
  await crankGesture(page, W.crankWheel, 90, Math.PI * 2 * 1.25, { steps: 60 });
  await waitPhase(page, 'restoreStep', 6000);
  if (shotPrefix) await shot(page, shotPrefix, '09-crank-done');

  // --- restoreStep: ステップをドラッグで戻す ---
  const gapBefore = await page.evaluate(() => {
    const st = window.__flowDebug.state;
    const t = st.escalator.removedStep !== null ? st.escalator.stepT(st.escalator.removedStep) : null;
    return t !== null ? st.escalator.pathPoint(t) : null;
  });
  const stepParked = { x: gapBefore.x - 130, y: gapBefore.y - 60 };
  await dragWorld(page, stepParked, gapBefore, { steps: 10 });
  await waitPhase(page, 'closePlate', 4000);

  // --- closePlate: 下スワイプ ---
  await swipeWorld(page, W.plateHandle, 0, 170, { steps: 10, stepMs: 25 });
  await waitPhase(page, 'testRun', 4000);
  if (shotPrefix) await shot(page, shotPrefix, '10-testrun');

  // --- testRun: 🐢 -> 🐇 ---
  await clickHud(page, 'ui:slow');
  await sleep(500);
  await clickHud(page, 'ui:fast');
  await waitPhase(page, 'celebrate', 4000);
  if (shotPrefix) await shot(page, shotPrefix, '11-celebrate');

  await waitPhase(page, 'select', 6000);
  await sleep(1000); // select の誤タップ防止ディレイ
  if (shotPrefix) await shot(page, shotPrefix, '12-select');

  const newErrors = ALL_ERRORS.slice(errorsBefore);
  return { newErrors };
}

// ---------------------------------------------------------------------------
// 故障種別を forceFault で固定して一周
// ---------------------------------------------------------------------------
async function faultLoop(page, kind, shotPrefix) {
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
  await shot(page, shotPrefix, `fault-${kind}-repair`);
  await doRepair(page, shotPrefix);
  const st = await getState(page);
  if (st.faultKind !== kind) throw new Error(`forceFault mismatch: expected ${kind}, got ${st.faultKind}`);
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
  console.log(`  [fault:${kind}] OK`);
}

// ---------------------------------------------------------------------------
// モードテスト: observe / stepPlay / replay / next
// ---------------------------------------------------------------------------
async function modeTests(page, shotPrefix) {
  // select にいる前提
  await clickHud(page, 'ui:observe');
  await waitFn(page, () => window.__flowDebug.state.mode === 'freeObserve');
  await crankGesture(page, W.crankWheel, 90, Math.PI * 1.6, { steps: 30 });
  await shot(page, shotPrefix, 'mode-freeObserve');
  await clickHud(page, 'ui:back');
  await waitFn(page, () => window.__flowDebug.state.mode === 'play' && window.__flowDebug.state.phase === 'select');
  await sleep(900);

  await clickHud(page, 'ui:stepPlay');
  await waitFn(page, () => window.__flowDebug.state.mode === 'stepPlay');
  for (let i = 0; i < 2; i++) {
    const p = await pathPoint(page, STEP_PULL_T);
    await tapWorld(page, p.x, p.y); // handle attach (最初の1回のみ効果あり)
    await waitFn(page, () => window.__flowDebug.state.handleAttached === true);
    const p2 = await pathPoint(page, STEP_PULL_T);
    await swipeWorld(page, p2, 0, -140, { steps: 6, stepMs: 18 });
    await waitFn(page, () => window.__flowDebug.state.stepRemoved >= 1, 4000);
    await sleep(150);
    const gap = await page.evaluate(() => {
      const st = window.__flowDebug.state;
      const t = st.escalator.removedStep !== null ? st.escalator.stepT(st.escalator.removedStep) : null;
      return t !== null ? st.escalator.pathPoint(t) : null;
    });
    const parked = { x: gap.x - 130, y: gap.y - 60 };
    await dragWorld(page, parked, gap, { steps: 8 });
    await waitFn(page, () => window.__flowDebug.state.stepRemoved <= 0, 4000);
    await sleep(150);
  }
  await shot(page, shotPrefix, 'mode-stepPlay');
  await clickHud(page, 'ui:back');
  await waitFn(page, () => window.__flowDebug.state.mode === 'play' && window.__flowDebug.state.phase === 'select');
  await sleep(900);

  const beforeLoc = (await getState(page)).location;
  await clickHud(page, 'ui:next');
  await waitPhase(page, 'notice', 4000);
  const afterLoc = (await getState(page)).location;
  if (afterLoc === beforeLoc) throw new Error('ui:next did not change location');
  console.log(`  [ui:next] location ${beforeLoc} -> ${afterLoc} OK`);

  // notice に居るのでタイトルへ戻さず replay 検証のため一旦 select まで進める簡易ショートカット
  // (replayはselectからのみ有効なので、ここでは replay の入口だけ軽く確認: 現在地から安全にselectへ)
  await page.evaluate(() => window.__flowDebug.forcePhase('select'));
  await sleep(900);
  await clickHud(page, 'ui:replay');
  await waitPhase(page, 'notice', 4000);
  console.log('  [ui:replay] restarted to notice OK');
}

// ---------------------------------------------------------------------------
// 回転保持テスト
// ---------------------------------------------------------------------------
async function rotationTest(page, context, shotPrefix) {
  await page.evaluate(() => window.__flowDebug.forcePhase('title'));
  await sleep(200);
  await clickHud(page, 'ui:start');
  await waitPhase(page, 'notice');
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

  const before = await getState(page);
  const vpBefore = page.viewportSize();
  await shot(page, shotPrefix, 'rotate-before');

  // 縦横入れ替え
  await page.setViewportSize({ width: vpBefore.height, height: vpBefore.width });
  await sleep(400);
  await shot(page, shotPrefix, 'rotate-after');
  const after = await getState(page);

  if (after.phase !== before.phase) throw new Error(`rotation lost phase: ${before.phase} -> ${after.phase}`);
  if (after.plateOpen < 0.99) throw new Error(`rotation lost plateOpen: ${after.plateOpen}`);
  if (after.faultKind !== before.faultKind) throw new Error('rotation lost fault kind');
  console.log(`  [rotation] phase/plateOpen/fault kept across rotation OK (${before.phase}, plateOpen=${after.plateOpen.toFixed(2)}, fault=${after.faultKind})`);

  // 元に戻す
  await page.setViewportSize(vpBefore);
  await sleep(300);
}

// ---------------------------------------------------------------------------
// 1ビューポートのセットアップ+一連のテスト実行
// ---------------------------------------------------------------------------
async function runViewport(browser, vp, { full = false, faults = false, modes = false, rotation = false }) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      ALL_ERRORS.push({ view: vp.name, kind: 'console', text: msg.text() });
      console.log(`  [console.error] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    ALL_ERRORS.push({ view: vp.name, kind: 'pageerror', text: String(err) });
    console.log(`  [pageerror] ${err}`);
  });

  await page.goto(BASE_URL, { waitUntil: 'load' });

  try {
    if (full) {
      console.log('  running full playthrough...');
      await fullPlaythrough(page, { shotPrefix: vp.name, misclicks: true });
      console.log('  full playthrough OK -> select reached');
    } else {
      // 軽量チェック: タイトル->notice到達+スクショのみ
      await waitFn(page, () => !!window.__flowDebug, 10000);
      await shot(page, vp.name, '01-title');
      await clickHud(page, 'ui:start');
      await waitPhase(page, 'notice');
      await shot(page, vp.name, '02-notice');
      await tapWorld(page, W.noticeAlert.x, W.noticeAlert.y);
      await waitPhase(page, 'safety');
      await dragWorld(page, W.fenceParked, W.fenceDrop, { steps: 6 });
      await waitFn(page, () => window.__flowDebug.state.fencePlaced === true);
      await shot(page, vp.name, '03-fence-placed');
      console.log('  lightweight smoke OK (title->notice->safety fence-drag)');
    }

    if (rotation) {
      console.log('  running rotation test...');
      await rotationTest(page, context, vp.name);
      // rotationTest は removeStep 途中で終わる。以降のテストが select 前提のため
      // (実際に閉じてまで確認する必要はない検証用ショートカットとして) select へ戻す。
      await page.evaluate(() => window.__flowDebug.forcePhase('select'));
      await sleep(1000);
    }

    if (faults) {
      console.log('  running 4 fault kinds via forceFault...');
      for (const kind of ['roller', 'chainGuide', 'handrail', 'sensor']) {
        await faultLoop(page, kind, vp.name);
      }
    }

    if (modes) {
      console.log('  running mode tests (observe/stepPlay/next/replay)...');
      await modeTests(page, vp.name);
    }
  } catch (err) {
    console.error(`  !! ERROR on ${vp.name}: ${err.stack || err}`);
    await shot(page, vp.name, 'ERROR-state');
    ALL_ERRORS.push({ view: vp.name, kind: 'test-exception', text: String(err.stack || err) });
  }

  // 横断面全景(cutaway)をもう一度、確実な状態で撮っておく
  try {
    await page.evaluate(() => window.__flowDebug.forcePhase('select'));
    await sleep(300);
    await page.evaluate(() => {
      const st = window.__flowDebug.state;
      st.view = 'cutaway';
    });
    await sleep(200);
    await shot(page, vp.name, 'panorama-cutaway');
  } catch {
    /* ベストエフォート */
  }

  await context.close();
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------
async function main() {
  console.log('starting vite preview server...');
  const server = await startPreviewServer();

  console.log('launching chromium...');
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });

  try {
    // 1. iPhone縦: フル一周 + 回転保持 + モードテスト
    await runViewport(browser, VIEWPORTS[0], { full: true, rotation: true, modes: true });

    // 2. iPad横: フル一周 + 4故障種
    await runViewport(browser, VIEWPORTS[3], { full: true, faults: true });

    // 3. iPhone横: 軽量チェック
    await runViewport(browser, VIEWPORTS[1], {});

    // 4. iPad縦: 軽量チェック
    await runViewport(browser, VIEWPORTS[2], {});
  } finally {
    await browser.close();
    server.kill();
  }

  console.log('\n=== SUMMARY ===');
  console.log(`total console/page errors collected: ${ALL_ERRORS.length}`);
  if (ALL_ERRORS.length > 0) {
    for (const e of ALL_ERRORS) {
      console.log(`  [${e.view}] (${e.kind}) ${e.text}`);
    }
    process.exitCode = 1;
  } else {
    console.log('no console/page errors across all runs.');
  }
  console.log(`screenshots saved to: ${SHOTS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
