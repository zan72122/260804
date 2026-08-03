// ============================================================================
// e2e/playthrough.mjs — 「ガコン！くるん！レーンのうらがわ工場」必須ループの
// 自動プレイスクリプト(Playwright, headless Chromium)。
//
// 実行前提:
//   - `npm run dev` 等で開発サーバーが起動していること (デフォルト http://localhost:5183)
//   - PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers を設定していること
//
// 実行例:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers BASE_URL=http://localhost:5183 \
//     node e2e/playthrough.mjs
//
// window.__game (src/main.ts が公開するデバッグフック) 経由で
//   - flow.step / sim.state をポーリングして遷移を確認
//   - screenOf(wx,wy) / uiButtonScreen(action) でワールド→画面座標を求め
//     canvasへ合成PointerEventを発行してジェスチャーを再現する
// ============================================================================
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://localhost:5183';
const OUT_SHOT_DIR = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-260804/ade12300-5f53-5166-9ea3-492f89970c76/scratchpad';

const log = [];
function mark(label) {
  const t = (performance.now() / 1000).toFixed(2);
  log.push(`[t+${t}s] ${label}`);
  console.log(`[t+${t}s] ${label}`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PW_CHROMIUM_PATH, // 未指定ならPlaywright既定(bundled)探索
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone縦
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  page.on('pageerror', (err) => mark(`!! pageerror: ${err.message}\n${err.stack ?? ''}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') mark(`!! console.error: ${msg.text()}`);
  });

  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window).__game, null, { timeout: 15000 });
  mark('game loaded, __game hook ready');

  // ── ヘルパー ──────────────────────────────────────────────────────
  const getStep = () => page.evaluate(() => (window).__game.flow.step);
  const getScene = () => page.evaluate(() => (window).__game.flow.scene);
  const getState = () => page.evaluate(() => {
    const s = (window).__game.sim.state;
    return JSON.parse(JSON.stringify(s));
  });

  async function waitStep(expected, timeoutMs = 12000) {
    const start = Date.now();
    let last = null;
    while (Date.now() - start < timeoutMs) {
      const s = await getStep();
      if (s !== last) { last = s; }
      if (Array.isArray(expected) ? expected.includes(s) : s === expected) {
        mark(`step -> ${s}`);
        return s;
      }
      await page.waitForTimeout(100);
    }
    throw new Error(`timeout waiting for step ${JSON.stringify(expected)}, last seen: ${last}`);
  }

  /** canvasへワールド座標を基準にした合成PointerEventのドラッグ/スワイプを発行する。 */
  async function gestureWorld(points, { holdMs = 16 } = {}) {
    await page.evaluate(({ points, holdMs }) => {
      const g = window.__game;
      const canvas = document.getElementById('game');
      const rect = canvas.getBoundingClientRect();
      function toClient(wx, wy) {
        const s = g.screenOf(wx, wy);
        return { clientX: rect.left + s.sx, clientY: rect.top + s.sy };
      }
      function fire(type, wx, wy) {
        const { clientX, clientY } = toClient(wx, wy);
        const ev = new PointerEvent(type, {
          pointerId: 1,
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
        });
        canvas.dispatchEvent(ev);
      }
      fire('pointerdown', points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) fire('pointermove', points[i][0], points[i][1]);
      fire('pointerup', points[points.length - 1][0], points[points.length - 1][1]);
    }, { points, holdMs });
    await page.waitForTimeout(holdMs);
  }

  /** wFrom→wToへ直線でn分割したスワイプ/ドラッグ。 */
  function lerpPath(wFrom, wTo, n = 14) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      pts.push([wFrom[0] + (wTo[0] - wFrom[0]) * k, wFrom[1] + (wTo[1] - wFrom[1]) * k]);
    }
    return pts;
  }

  /** center周りの円軌道(turns周)。 */
  function circlePath(center, r, turns = 1.3, n = 40, startAngle = 0) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = startAngle + (i / n) * Math.PI * 2 * turns;
      pts.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]);
    }
    return pts;
  }

  async function tapUIButton(action) {
    const b = await page.evaluate((a) => window.__game.uiButtonScreen(a), action);
    if (!b) throw new Error(`UIボタンが見つからない: ${action}`);
    await page.mouse.move(b.sx, b.sy);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    mark(`tap UI '${action}'`);
  }

  async function shot(name) {
    await page.screenshot({ path: path.join(OUT_SHOT_DIR, `shot-${name}.png`) });
    mark(`screenshot: shot-${name}.png`);
  }

  // ── 1. title ──────────────────────────────────────────────────────
  await waitStep('title');
  await shot('01-title');
  await tapUIButton('start');
  await waitStep('bowl');

  // ── 2. bowl: 上スワイプで投球 ─────────────────────────────────────
  {
    const st = await getState();
    const from = [st.ball.x, st.ball.y];
    const to = [st.ball.x, st.ball.y - 420];
    await gestureWorld(lerpPath(from, to, 16));
    mark('bowl: swipe up');
  }
  await waitStep('breakdown');
  await shot('02-breakdown');

  // ── 3. approach: 奥スワイプ/タップ ───────────────────────────────
  await waitStep('approach');
  {
    // LANE_VIEW座標: 奥(backWallY)寄りをタップすればよい
    await gestureWorld([[500, 200], [500, 200]]);
  }
  // approachタップ即時にscene='machine'へ切替 → 少し待ってpower-off→safety-lockへ自動遷移
  await waitStep('safety-lock', 6000);
  mark(`scene now: ${await getScene()}`);
  await shot('03-safety-lock');

  // ── 4. safety-lock: レバーを下へドラッグ ────────────────────────
  {
    const SAFETY_LEVER = { x: 1620, y: 560 };
    const from = [SAFETY_LEVER.x, SAFETY_LEVER.y - 30];
    const to = [SAFETY_LEVER.x, SAFETY_LEVER.y + 240];
    await gestureWorld(lerpPath(from, to, 20));
  }
  await waitStep('open-door');
  mark('safety-lock done (gakon)');

  // ── 5. open-door: 取っ手を横へドラッグ ──────────────────────────
  {
    const DOOR_HANDLE = { x: 1290, y: 560 };
    const from = [DOOR_HANDLE.x - 20, DOOR_HANDLE.y];
    const to = [DOOR_HANDLE.x + 260, DOOR_HANDLE.y];
    await gestureWorld(lerpPath(from, to, 20));
  }
  await waitStep('find-fault', 8000);
  mark('door open (paka)');
  await shot('04-find-fault');

  // ── 6. find-fault: 少し待つと自動でfixへ(発見演出) ───────────────
  await waitStep('fix', 6000);
  await shot('05-fix');

  // ── 7. fix: stuck-pinドラッグ → belt-traceなぞり → roller円なぞり ─
  // 7a. stuck-pin
  {
    let pin = null;
    for (let i = 0; i < 120 && !pin; i++) {
      const st = await getState();
      pin = st.pins.find((p) => p.stuck);
      if (!pin) {
        if (i % 10 === 0) {
          const belt = st.pins.filter((p) => p.zone === 'belt').map((p) => p.t.toFixed(2));
          mark(`  ...waiting stuck-pin (belt.run=${st.belt.run} belt ts=[${belt.join(',')}])`);
        }
        await page.waitForTimeout(150);
      }
    }
    if (!pin) throw new Error('詰まりピンが見つからない');
    mark(`stuck pin found at (${pin.x.toFixed(0)},${pin.y.toFixed(0)})`);
    const from = [pin.x, pin.y];
    const to = [pin.x - 30, pin.y - 160];
    await gestureWorld(lerpPath(from, to, 12));
  }
  {
    const st = await getState();
    const jam = st.faults.find((f) => f.id === 'pin-jam');
    mark(`pin-jam fixed=${jam ? jam.fixed : 'n/a'}`);
  }

  // 7b. belt-trace: ローラー付近をベルト経路に沿ってなぞる
  {
    const ROLLER = { x: 860, y: 975 };
    // ベルト経路(BELT_PATH)に沿った往復なぞり
    const path = [
      [ROLLER.x + 260, 945], [ROLLER.x + 120, 950], [ROLLER.x, 960],
      [ROLLER.x - 120, 960], [ROLLER.x - 260, 950], [ROLLER.x - 120, 945],
      [ROLLER.x, 950], [ROLLER.x + 120, 950], [ROLLER.x + 260, 945],
    ];
    await gestureWorld(path, { holdMs: 30 });
  }
  {
    const st = await getState();
    mark(`belt.derail after trace=${st.belt.derail.toFixed(3)}`);
  }

  // 7c. roller-spin: ローラーを円でなぞって1回転(仕様どおりの動作確認ジェスチャー)
  {
    const ROLLER = { x: 860, y: 975 };
    const path = circlePath([ROLLER.x, ROLLER.y], 55, 1.4, 48, -Math.PI / 2);
    await gestureWorld(path, { holdMs: 30 });
  }
  {
    const st = await getState();
    const belt = st.faults.find((f) => f.id === 'belt-derail');
    mark(`belt-derail fixed=${belt ? belt.fixed : 'n/a'} rollerAngle=${st.belt.rollerAngle.toFixed(2)}`);
  }

  await waitStep('close-cover', 8000);
  await shot('06-close-cover');

  // ── 8. close-cover: 扉を閉め戻すスワイプ ─────────────────────────
  // (cover-closeの当たり判定はDOOR_HANDLE中心から半径110なので、
  //  そこから始めてなぞる。開けたときと逆方向へ)
  {
    const DOOR_HANDLE = { x: 1290, y: 560 };
    const from = [DOOR_HANDLE.x + 20, DOOR_HANDLE.y];
    const to = [DOOR_HANDLE.x - 260, DOOR_HANDLE.y];
    await gestureWorld(lerpPath(from, to, 20));
  }
  await waitStep('orient-pins', 8000);
  await shot('07-orient-pins');

  // ── 9. orient-pins: 選別機のピンをスワイプ×必要回数 ───────────────
  {
    let oriented = 0;
    let guard = 0;
    const startT = Date.now();
    while (true) {
      guard++;
      // ラック搬送は1本ずつ・低速コンベアなので10本で数十秒かかりうる(意図した速度)。
      if (Date.now() - startT > 120000) throw new Error('orient-pinsが終わらない(タイムアウト)');
      const step = await getStep();
      if (step !== 'orient-pins' && step !== 'rack-fill') break;
      const st = await getState();
      const bp = st.orienter.busyPin;
      if (guard % 10 === 0) {
        const filled = st.rack.slots.filter((s) => s !== null).length;
        mark(`  ...orient loop step=${step} busyPin=${bp} rackFilled=${filled}`);
      }
      if (bp !== null) {
        const pin = st.pins.find((p) => p.id === bp);
        if (pin) {
          const from = [pin.x, pin.y];
          const to = [pin.x + 10, pin.y - 140];
          await gestureWorld(lerpPath(from, to, 8), { holdMs: 20 });
          oriented++;
        }
      } else {
        await page.waitForTimeout(120);
      }
      if (step === 'rack-fill') {
        // ラック投入待ちのピンがなければ終了
        const st2 = await getState();
        if (st2.orienter.busyPin === null && st2.rack.slots.every((s) => s !== null)) break;
      }
    }
    mark(`orient-pins: swiped ${oriented} times`);
  }

  await waitStep('table-drop', 20000);
  await shot('08-table-drop');

  // ── 10. table-drop: レバーを下へ ─────────────────────────────────
  {
    const TABLE_LEVER = { x: 1620, y: 560 };
    const from = [TABLE_LEVER.x, TABLE_LEVER.y - 30];
    const to = [TABLE_LEVER.x, TABLE_LEVER.y + 240];
    await gestureWorld(lerpPath(from, to, 20));
  }
  await waitStep('ball-return', 8000);
  await shot('09-ball-return');

  // ── 11. ball-return: フラップを上スワイプ ────────────────────────
  {
    const FLAP = { x: 1560, y: 1040 };
    const from = [FLAP.x, FLAP.y + 20];
    const to = [FLAP.x, FLAP.y - 160];
    await gestureWorld(lerpPath(from, to, 16));
  }
  await waitStep('unlock', 8000);
  await shot('10-unlock');

  // ── 12. unlock: 安全レバーを上へ戻す(逆操作) ─────────────────────
  // (当たり判定はSAFETY_LEVER中心から半径90固定なので、そこから始める)
  {
    const SAFETY_LEVER = { x: 1620, y: 560 };
    const from = [SAFETY_LEVER.x, SAFETY_LEVER.y + 20];
    const to = [SAFETY_LEVER.x, SAFETY_LEVER.y - 240];
    await gestureWorld(lerpPath(from, to, 20));
  }
  await waitStep('full-run', 8000);
  mark('unlock done -> full-run (自動観覧)');
  await shot('11-full-run');

  // ── 13. full-run(自動)→celebrate→replay-menu ─────────────────────
  await waitStep('celebrate', 20000);
  await shot('12-celebrate');
  await waitStep('replay-menu', 8000);
  await shot('13-replay-menu');

  mark('=== 一周プレイ完走 ===');

  await browser.close();
  return log;
}

main().then((log) => {
  console.log('\n--- SUMMARY LOG ---');
  console.log(log.join('\n'));
  process.exit(0);
}).catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
