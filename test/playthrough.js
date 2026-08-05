// 自動試遊テスト: 全フェーズを通しでプレイし、スクリーンショットとエラーを検証する
// 使い方: node test/server.js を起動した状態で node test/playthrough.js [portrait|landscape]
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const MODE = process.argv[2] || 'portrait';
const VIEW = MODE === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 };
const OUT = path.join(__dirname, 'shots', MODE);
fs.mkdirSync(OUT, { recursive: true });

const URL = 'http://localhost:8347/';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: VIEW,
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const gameState = () => page.evaluate(() => ({
    phase: window.__game.state.phase,
    mixReady: !!window.__game.state.mixReady,
    mixProgress: window.__game.state.mixProgress,
    pourLevel: window.__game.state.pourLevel,
    layerIndex: window.__game.state.layerIndex,
    creamProgress: window.__game.state.creamProgress,
    hasCream: !!window.__game.state.currentCream,
    decoCount: window.__game.state.decorations.length,
    melt: window.__game.state.melt,
  }));

  const waitPhase = async (phase, timeout = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const s = await gameState();
      if (s.phase === phase) return s;
      await page.waitForTimeout(200);
    }
    throw new Error(`timeout waiting for phase ${phase}; now ${(await gameState()).phase}`);
  };

  const shot = (name) => page.screenshot({ path: path.join(OUT, name) });

  // WebGL が動いているか
  const glOK = await page.evaluate(() => {
    const c = document.getElementById('c');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  console.log('WebGL context:', glOK ? 'OK' : 'MISSING');

  await shot('01-title.png');

  // --- はじめる ---
  await page.tap('#startBtn', { force: true });
  await page.waitForTimeout(3600); // 材料投入の演出
  await page.waitForFunction(() => window.__game.state.mixReady === true, null, { timeout: 10000 });
  await shot('02-mix-start.png');

  // --- まぜまぜ: 円を描くようにドラッグ ---
  const cx = VIEW.width / 2, cy = VIEW.height * 0.55;
  const R = Math.min(VIEW.width, VIEW.height) * 0.16;
  await page.mouse.move(cx + R, cy);
  await page.mouse.down();
  let mixed = false;
  for (let loop = 0; loop < 18 && !mixed; loop++) {
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.7);
      await page.waitForTimeout(14);
    }
    const s = await gameState();
    if (s.mixProgress >= 1 || s.phase !== 'MIX') mixed = true;
    if (loop === 3) await shot('03-mixing.png');
  }
  await page.mouse.up();
  console.log('mix done:', await gameState());
  await waitPhase('POUR');
  await page.waitForTimeout(1500);

  // --- そそぐ: 長押し ---
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let poured = false;
  for (let i = 0; i < 60 && !poured; i++) {
    await page.waitForTimeout(200);
    const s = await gameState();
    if (i === 8) await shot('04-pouring.png');
    if (s.pourLevel >= 1 || s.phase !== 'POUR') poured = true;
  }
  await page.mouse.up();
  console.log('pour done:', await gameState());

  // --- やく: タップ ---
  await waitPhase('BAKE');
  await page.waitForTimeout(600);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(2500);
  await shot('05-baking.png');
  await waitPhase('LAYER', 30000);

  // --- つみあげ: クリーム3回 ---
  const colors = ['pink', 'sky', 'lemon'];
  for (let c = 0; c < 3; c++) {
    await page.waitForFunction(
      () => document.getElementById('palette').classList.contains('show'),
      null, { timeout: 20000 }
    );
    await page.tap(`#palette [data-color="${colors[c]}"]`);
    await page.waitForTimeout(300);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(150);
      const s = await gameState();
      if (c === 0 && i === 6) await shot('06-piping.png');
      if (!s.hasCream) break;
    }
    await page.mouse.up();
    console.log(`cream ${c + 1} done:`, await gameState());
  }
  await waitPhase('DECORATE', 20000);
  await shot('07-layered.png');

  // --- かざる ---
  const decos = ['strawberry', 'candle', 'blueberry', 'cookie', 'candy', 'orange', 'strawberry'];
  for (const d of decos) {
    await page.tap(`#tray [data-deco="${d}"]`);
    await page.waitForTimeout(450);
  }
  await shot('08-decorated.png');
  await page.tap('#doneBtn', { force: true });

  // --- ドーム ---
  await waitPhase('REVEAL', 20000);
  await page.waitForTimeout(1200);
  await shot('09-dome.png');

  // --- ソースをかけて溶かす ---
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let melted = false;
  for (let i = 0; i < 80 && !melted; i++) {
    await page.waitForTimeout(200);
    const s = await gameState();
    if (i === 12) await shot('10-melting.png');
    if (s.melt >= 1 || s.phase === 'DONE') melted = true;
  }
  await page.mouse.up();
  await waitPhase('DONE', 15000);
  await page.waitForTimeout(2500);
  await shot('11-celebrate.png');
  await page.waitForTimeout(2500);
  await shot('12-celebrate2.png');

  // パフォーマンス計測（お祝い画面 = 最も重い場面）
  const fps = await page.evaluate(() => new Promise(res => {
    let frames = 0;
    const t0 = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
      else res(Math.round(frames / ((performance.now() - t0) / 1000)));
    };
    requestAnimationFrame(tick);
  }));
  console.log('FPS (celebrate scene):', fps);

  console.log('final state:', await gameState());
  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
  console.log(`PLAYTHROUGH ${MODE} PASSED`);
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
