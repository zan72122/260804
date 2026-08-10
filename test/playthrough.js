// 自動試遊テスト: 全レシピ・全フェーズを通しでプレイし、スクリーンショットとエラーを検証する
// 使い方: node test/server.js を起動した状態で
//   node test/playthrough.js [portrait|landscape] [dome|glaze|brulee]
// 低fps環境(ヘッドレスChromium/SwiftShader, 約5fps。レシピによっては更に低い)を考慮し、
// タイムアウトは長め・トレイのボタンは force タップで統一する。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const MODE = process.argv[2] || 'portrait';
const RECIPE = process.argv[3] || 'dome';
const VIEW = MODE === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 };
const OUT = path.join(__dirname, 'shots', `${MODE}-${RECIPE}`);
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

  // state には THREE.Group 等の循環参照オブジェクトも含まれるため、JSON化できるよう
  // レシピごとに必要なプリミティブ値だけを抜き出す（契約書§4のフィールド名に準拠）。
  const gameState = () => page.evaluate((recipe) => {
    const s = window.__game && window.__game.state;
    if (!s) return null;
    if (recipe === 'dome') {
      return {
        phase: s.phase,
        mixReady: !!s.mixReady,
        mixProgress: s.mixProgress,
        pourLevel: s.pourLevel,
        layerIndex: s.layerIndex,
        creamProgress: s.creamProgress,
        hasCream: !!s.currentCream,
        decoCount: s.decorations.length,
        melt: s.melt,
      };
    } else if (recipe === 'glaze') {
      return {
        phase: s.phase,
        mousseLayer: s.mousseLayer,
        pourProgress: s.pourProgress,
        insertCount: s.insertCount,
        freezeStarted: s.freezeStarted,
        unmoldProgress: s.unmoldProgress,
        glazeProgress: s.glazeProgress,
        decoCount: s.decoCount,
        cutProgress: s.cutProgress,
      };
    } else if (recipe === 'brulee') {
      return {
        phase: s.phase,
        custardLevel: s.custardLevel,
        scoopCount: s.scoopCount,
        meringueProgress: s.meringueProgress,
        sugarProgress: s.sugarProgress,
        torchProgress: s.torchProgress,
        crackStage: s.crackStage,
      };
    }
    return { phase: s.phase };
  }, RECIPE);

  const waitPhase = async (phase, timeout = 45000) => {
    const phases = Array.isArray(phase) ? phase : [phase];
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const s = await gameState();
      if (s && phases.includes(s.phase)) return s;
      await page.waitForTimeout(250);
    }
    throw new Error(`timeout waiting for phase ${phases.join('|')}; now ${(await gameState()).phase}`);
  };

  // 画面のどこでも長押し（契約書の無操作アシスト仕様に合わせたテスト方法）:
  // 対象の数値フィールドが1になるかフェーズが変わるまで、指定座標で押し続ける。
  const shot = (name) => page.screenshot({ path: path.join(OUT, name) });

  // midShotName: 完了直後だと非同期のすきに次フェーズへ進んでしまうことがあるため、
  // 「進行中」のスクショが欲しい場合は最初のポーリング直後（まだ確実に進行中）に撮る。
  const holdUntil = async (cx, cy, fieldOrPhaseCheck, timeout = 45000, midShotName = null) => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    const t0 = Date.now();
    let last = null;
    let first = true;
    while (Date.now() - t0 < timeout) {
      await page.waitForTimeout(250);
      if (first && midShotName) { await shot(midShotName); first = false; }
      const s = await gameState();
      last = s;
      if (fieldOrPhaseCheck(s)) break;
    }
    await page.mouse.up();
    return last;
  };

  // WebGL が動いているか
  const glOK = await page.evaluate(() => {
    const c = document.getElementById('c');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  console.log('WebGL context:', glOK ? 'OK' : 'MISSING');

  await shot('00-title.png');

  const cx = VIEW.width / 2, cy = VIEW.height * 0.55;

  if (RECIPE === 'dome') await runDome();
  else if (RECIPE === 'glaze') await runGlaze();
  else if (RECIPE === 'brulee') await runBrulee();
  else throw new Error(`unknown recipe: ${RECIPE}`);

  // パフォーマンス計測（最も重い場面 = お祝い/DONE演出）
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
  console.log(`PLAYTHROUGH ${MODE} ${RECIPE} PASSED`);

  // ---------------------------------------------------------------------
  // dome: 既存フロー（維持。トレイタップのみ force:true を追加）
  // ---------------------------------------------------------------------
  async function runDome() {
    await page.tap('#recipeSelect [data-recipe="dome"]', { force: true });
    await page.waitForTimeout(3600); // 材料投入の演出
    await page.waitForFunction(() => window.__game.state.mixReady === true, null, { timeout: 15000 });
    await shot('02-mix-start.png');

    // --- まぜまぜ: 円を描くようにドラッグ ---
    const R = Math.min(VIEW.width, VIEW.height) * 0.16;
    await page.mouse.move(cx + R, cy);
    await page.mouse.down();
    let mixed = false;
    for (let loop = 0; loop < 24 && !mixed; loop++) {
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
    await holdUntil(cx, cy, s => s.pourLevel >= 1 || s.phase !== 'POUR', 40000, '04-pouring.png');
    console.log('pour done:', await gameState());

    // --- やく: タップ ---
    await waitPhase('BAKE', 20000);
    await page.waitForTimeout(600);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(2500);
    await shot('05-baking.png');
    await waitPhase('LAYER', 40000);

    // --- つみあげ: クリーム3回 ---
    const colors = ['pink', 'sky', 'lemon'];
    for (let c = 0; c < 3; c++) {
      await page.waitForFunction(
        () => document.getElementById('palette').classList.contains('show'),
        null, { timeout: 30000 }
      );
      await page.tap(`#palette [data-color="${colors[c]}"]`, { force: true });
      await page.waitForTimeout(300);
      // 長押し進行（hasCreamがfalseになるまで=完成まで）
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 0; i < 80; i++) {
        await page.waitForTimeout(200);
        const s = await gameState();
        if (c === 0 && i === 6) await shot('06-piping.png');
        if (!s.hasCream) break;
      }
      await page.mouse.up();
      console.log(`cream ${c + 1} done:`, await gameState());
    }
    await waitPhase('DECORATE', 30000);
    await shot('07-layered.png');

    // --- かざる ---
    const decos = ['strawberry', 'candle', 'blueberry', 'cookie', 'candy', 'orange', 'strawberry'];
    for (const d of decos) {
      await page.tap(`#tray [data-deco="${d}"]`, { force: true });
      await page.waitForTimeout(450);
    }
    await shot('08-decorated.png');
    await page.tap('#doneBtn', { force: true });

    // --- ドーム ---
    await waitPhase('REVEAL', 30000);
    await page.waitForTimeout(1200);
    await shot('09-dome.png');

    // --- ソースをかけて溶かす ---
    await holdUntil(cx, cy, s => s.melt >= 1 || s.phase === 'DONE', 40000, '10-melting.png');
    await waitPhase('DONE', 25000);
    await page.waitForTimeout(2500);
    await shot('11-celebrate.png');
    await page.waitForTimeout(2500);
    await shot('12-celebrate2.png');
  }

  // ---------------------------------------------------------------------
  // glaze: MOUSSE→INSERT→FREEZE→UNMOLD→GLAZE→DECO→CUT→DONE
  // ---------------------------------------------------------------------
  async function runGlaze() {
    await page.tap('#recipeSelect [data-recipe="glaze"]', { force: true });
    await waitPhase('MOUSSE', 15000);
    await shot('01-mousse-start.png');

    const colors = ['pink', 'mint', 'lemon'];
    for (let i = 0; i < 3; i++) {
      await page.waitForFunction(() => {
        const el = document.getElementById('trayMousse');
        return el && el.classList.contains('show');
      }, null, { timeout: 30000 });
      await page.tap(`#trayMousse [data-key="${colors[i]}"]`, { force: true });
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let j = 0; j < 120; j++) {
        await page.waitForTimeout(250);
        const s = await gameState();
        if (s.mousseLayer > i || s.phase !== 'MOUSSE') break;
      }
      await page.mouse.up();
      if (i === 1) await shot('02-mousse-pouring.png');
    }
    console.log('mousse done:', await gameState());

    // --- INSERT: フルーツを2個タップ ---
    await waitPhase('INSERT', 30000);
    await shot('03-insert.png');
    await page.tap('#trayFruit [data-key="strawberry"]', { force: true });
    await page.waitForTimeout(1500);
    await page.tap('#trayFruit [data-key="blueberry"]', { force: true });
    await page.waitForFunction(() => {
      const el = document.getElementById('glazeNext');
      return el && el.classList.contains('show');
    }, null, { timeout: 30000 });
    console.log('insert done:', await gameState());
    await page.tap('#glazeNext', { force: true });

    // --- FREEZE: タップ→自動で数秒後に完了 ---
    await waitPhase('FREEZE', 20000);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await shot('04-freeze.png');
    await waitPhase('UNMOLD', 20000);

    // --- UNMOLD: 長押し ---
    await holdUntil(cx, cy, s => s.unmoldProgress >= 1 || s.phase !== 'UNMOLD', 30000);
    await shot('05-unmold.png');
    await waitPhase('GLAZE', 20000);

    // --- GLAZE: 色を選んで長押し ---
    await page.waitForFunction(() => {
      const el = document.getElementById('trayGlaze');
      return el && el.classList.contains('show');
    }, null, { timeout: 20000 });
    await page.tap('#trayGlaze [data-key="rainbow"]', { force: true });
    await holdUntil(cx, cy, s => s.glazeProgress >= 1 || s.phase !== 'GLAZE', 40000, '06-glaze-pouring.png');
    await shot('06b-glaze-after.png');
    await waitPhase('DECO', 25000);
    await page.waitForTimeout(500);
    await shot('07-glaze-mirror.png');

    // --- DECO: 飾りタップ ---
    await page.tap('#trayGdeco [data-key="gold"]', { force: true });
    await page.waitForTimeout(800);
    await page.tap('#trayGdeco [data-key="flower"]', { force: true });
    await page.waitForFunction(() => {
      const el = document.getElementById('glazeCut');
      return el && el.classList.contains('show');
    }, null, { timeout: 20000 });
    await shot('08-deco.png');
    await page.tap('#glazeCut', { force: true });

    // --- CUT: 長押し ---
    await waitPhase('CUT', 20000);
    await holdUntil(cx, cy, s => s.cutProgress >= 1 || s.phase === 'DONE', 30000);
    await shot('09-cut.png');
    await waitPhase('DONE', 20000);
    await page.waitForTimeout(1500);
    await shot('10-done.png');
  }

  // ---------------------------------------------------------------------
  // brulee: CUSTARD→SCOOP→MERINGUE→SUGAR→TORCH→CRACK→DONE
  // ---------------------------------------------------------------------
  async function runBrulee() {
    await page.tap('#recipeSelect [data-recipe="brulee"]', { force: true });
    await waitPhase('CUSTARD', 15000);
    await shot('01-custard-start.png');

    // --- CUSTARD: 長押し ---
    await holdUntil(cx, cy, s => s.custardLevel >= 1 || s.phase !== 'CUSTARD', 30000);
    await shot('02-custard.png');
    await waitPhase('SCOOP', 20000);

    // --- SCOOP: 3種タップ ---
    const flavors = ['vanilla', 'berry', 'melon'];
    for (const f of flavors) {
      await page.tap(`#trayFlavor [data-key="${f}"]`, { force: true });
      await page.waitForTimeout(1200);
    }
    await shot('03-scoop.png');
    console.log('scoop done:', await gameState());

    // --- MERINGUE: 長押し ---
    await waitPhase('MERINGUE', 20000);
    await holdUntil(cx, cy, s => s.meringueProgress >= 1 || s.phase !== 'MERINGUE', 30000);
    await shot('04-meringue.png');

    // --- SUGAR: 長押し ---
    await waitPhase('SUGAR', 20000);
    await holdUntil(cx, cy, s => s.sugarProgress >= 1 || s.phase !== 'SUGAR', 30000);
    await shot('05-sugar.png');

    // --- TORCH: ゆっくり円をなぞる ---
    await waitPhase('TORCH', 20000);
    const R = Math.min(VIEW.width, VIEW.height) * 0.11;
    await page.mouse.move(cx + R, cy);
    await page.mouse.down();
    let torched = false;
    for (let loop = 0; loop < 60 && !torched; loop++) {
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.6);
        await page.waitForTimeout(60);
      }
      // 低fps環境ではごく短時間で完了することがあるため、途中経過は最初のループ直後に
      // 即座に撮る（「完了直前」を待つと、非同期のすきに演出が先へ進んでしまう）
      if (loop === 0) await shot('06-torch-mid.png');
      const s = await gameState();
      if (s.torchProgress >= 1 || s.phase !== 'TORCH') torched = true;
    }
    await page.mouse.up();
    // pointerが確実に離れたことをページ側に反映させる猶予（低fps環境でのCDP遅延対策）
    await page.waitForTimeout(1000);
    await shot('07-torch-done.png');
    console.log('torch done:', await gameState());

    // --- CRACK: タップ3回（間隔1秒。低fps環境ではアシストで早まる場合もあるため早期終了を許容） ---
    await waitPhase(['CRACK', 'DONE'], 20000);
    for (let i = 0; i < 3; i++) {
      const s0 = await gameState();
      if (s0.phase !== 'CRACK') break;
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(1100);
      console.log(`crack tap ${i + 1}:`, await gameState());
    }
    await shot('08-crack.png');
    await waitPhase('DONE', 25000);
    await page.waitForTimeout(1500);
    await shot('09-done.png');
  }
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
