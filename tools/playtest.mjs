// 自動試遊 — 縦画面 / 横画面 / 画面回転 / 連打 / 途中で指を離す / 再プレイ を検証する。
//   node tools/playtest.mjs [--shots]
// ヘッドレスは SwiftShader（ソフトウェア描画）なので実機よりずっと遅い。
// 待ち時間は固定せず、状態が変わるまでポーリングする。
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'tools', 'shots');
const WANT_SHOTS = process.argv.includes('--shots');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8'
};

function serve(port) {
  return new Promise((res) => {
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        rep.writeHead(404); rep.end('nf'); return;
      }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    s.listen(port, () => res(s));
  });
}

const PORT = 8931;
const URL = `http://127.0.0.1:${PORT}/index.html?hq`;

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const IPAD_P = { width: 820, height: 1180 };

let failures = 0;
const log = (...a) => console.log(...a);
function check(name, cond, extra) {
  if (cond) log(`  ✓ ${name}`);
  else { failures++; log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

async function shot(page, name) {
  if (!WANT_SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

const state = (page) => page.evaluate(() => window.__aizome.state());

// 状態が満たされるまで待つ（フレームレートに依存しない）
async function until(page, fn, ms = 30000, label = '') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await state(page);
    if (fn(s)) return s;
    await page.waitForTimeout(120);
  }
  const s = await state(page);
  log(`     …待ちタイムアウト ${label} ${JSON.stringify(s)}`);
  return s;
}

async function untilDom(page, sel, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.locator(sel).isVisible()) return true;
    await page.waitForTimeout(120);
  }
  return false;
}

async function newPage(browser, size, errors) {
  const ctx = await browser.newContext({
    viewport: size, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__aizome, null, { timeout: 30000 });
  return { ctx, page };
}

async function dragPath(page, pts, steps = 12, holdMs = 0) {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  if (holdMs) await page.waitForTimeout(holdMs);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    for (let s = 1; s <= steps; s++) {
      await page.mouse.move(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps);
    }
  }
  await page.mouse.up();
}

async function circleDrag(page, cx, cy, r, turns) {
  const per = 26;
  const N = Math.round(per * turns);
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= N; i++) {
    const a = (i / per) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    await page.waitForTimeout(4);
  }
  await page.mouse.up();
}

async function clickNext(page) {
  const btn = page.locator('#next-btn');
  if (await btn.isVisible()) { await btn.click({ force: true }); return true; }
  return false;
}

// ---------------------------------------------------------------------------

async function playthrough(page, size, tag, opts = {}) {
  const cx = size.width / 2, cy = size.height / 2;
  log(`\n[${tag}] ${size.width}x${size.height}`);

  await page.click('#start-btn');
  await until(page, s => s.stage === 'fold', 15000, 'fold');
  check('FOLD に入った', (await state(page)).stage === 'fold');
  await shot(page, tag + '-1-flat');

  // --- おる ---------------------------------------------------------------
  await dragPath(page, [[cx - 90, cy + 40], [cx + 95, cy - 30]]);
  let s = await until(page, x => x.foldT > 0.98, 25000, 'folded');
  check('ドラッグで折れた', s.fold !== 'none', s.fold);
  check('折りたたまれた (foldT≈1)', s.foldT > 0.95, s.foldT);
  log(`     → おりかた: ${s.fold}`);
  await shot(page, tag + '-2-folded');

  await dragPath(page, [[cx + 60, cy - 60], [cx - 60, cy + 60]]);
  s = await until(page, x => x.foldT > 0.98, 25000, 'folded2');
  check('2 回目のドラッグでもっと折れる', s.foldT > 0.95, s.foldT);

  check('つぎへ が出ている', await untilDom(page, '#next-btn', 8000));
  await clickNext(page);
  await until(page, x => x.stage === 'bind', 12000, 'bind');
  check('BIND に入った', (await state(page)).stage === 'bind');

  // --- しばる -------------------------------------------------------------
  const rr = Math.min(size.width, size.height) * 0.17;
  await circleDrag(page, cx, cy, rr, 2.4);
  await page.waitForTimeout(300);
  await circleDrag(page, cx + 34, cy - 34, rr * 0.85, 1.8);
  s = await until(page, x => x.ties >= 1, 12000, 'ties');
  check('ゆびの円運動で糸が巻けた', s.ties >= 1, s.ties);

  await page.locator('.tool[data-id="star"]').click({ force: true });
  await page.mouse.click(cx - 18, cy + 14);
  s = await until(page, x => x.boards >= 1, 12000, 'boards');
  check('板締めも置けた', s.boards >= 1, s.boards);
  await shot(page, tag + '-3-bound');

  // --- 甕へ ---------------------------------------------------------------
  await clickNext(page);
  s = await until(page, x => x.stage === 'dip', 30000, 'dip');
  check('DIP に入った', s.stage === 'dip', s.stage);
  await shot(page, tag + '-4-vat');

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(cx + Math.sin(i * 0.9 + Date.now() * 0.004) * 60, cy);
    }
    await page.waitForTimeout(80);
    s = await state(page);
    if (s.dye > 0.85) break;
  }
  check('液の中で しっかり染まった', s.dye > 0.5, s.dye);
  await shot(page, tag + '-5-submerged');
  await page.mouse.up();

  s = await until(page, x => x.stage === 'oxidize', 20000, 'oxidize');
  check('引きあげたら OXIDIZE に入った', s.stage === 'oxidize', s.stage);
  check('引き上げ直後はまだ酸化していない（黄緑〜緑）', s.ox < 0.55, s.ox);
  check('染めた回数が増えた', s.dips >= 1, s.dips);
  await shot(page, tag + '-6-green');

  // --- 酸化: 連続的に青くなること -----------------------------------------
  const oxTrail = [s.ox];
  for (let i = 0; i < 40; i++) {
    await dragPath(page, [[cx - 110, cy], [cx + 110, cy]], 5);
    await page.waitForTimeout(120);
    s = await state(page);
    oxTrail.push(s.ox);
    if (s.ox >= 0.999) break;
  }
  check('酸化しきって深い藍になった', s.ox > 0.98, s.ox);
  const monotone = oxTrail.every((v, i) => i === 0 || v >= oxTrail[i - 1] - 1e-6);
  const steps = new Set(oxTrail.map(v => v.toFixed(2))).size;
  check('色の変化が連続的（段階が 4 つ以上）', steps >= 4 && monotone, { steps, monotone });
  await shot(page, tag + '-7-indigo');

  // --- 重ね染め -----------------------------------------------------------
  if (opts.redip) {
    await page.locator('.tool[data-id="again"]').click({ force: true });
    s = await until(page, x => x.stage === 'dip', 15000, 'redip');
    check('もういちど そめる で甕に戻れた', s.stage === 'dip', s.stage);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await until(page, x => x.submerged, 25000, 'submerged2');
    await page.waitForTimeout(600);
    await page.mouse.up();
    s = await until(page, x => x.stage === 'oxidize', 25000, 'ox2');
    check('重ね染めで回数が増えた', s.dips >= 2, s.dips);
    for (let i = 0; i < 40 && s.ox < 0.999; i++) {
      await dragPath(page, [[cx - 110, cy], [cx + 110, cy]], 5);
      await page.waitForTimeout(120);
      s = await state(page);
    }
    check('2 回目も酸化しきった', s.ox > 0.98, s.ox);
  }

  // --- ほどく -------------------------------------------------------------
  await clickNext(page);
  s = await until(page, x => x.stage === 'unbind', 20000, 'unbind');
  check('UNBIND に入った', s.stage === 'unbind', s.stage);
  let unbound = false;
  for (let i = 0; i < 24; i++) {
    await dragPath(page, [[cx - 60 + (i % 4) * 34, cy - 40 + (i % 5) * 22], [cx + 90, cy + 50]], 4);
    await page.waitForTimeout(320);
    if (await page.locator('#next-btn').isVisible()) { unbound = true; break; }
  }
  check('糸と板を全部ほどけた', unbound);
  await shot(page, tag + '-8-unbound');

  // --- ひらく（最大の見せ場） ---------------------------------------------
  await clickNext(page);
  s = await until(page, x => x.stage === 'unfold', 20000, 'unfold');
  check('UNFOLD に入った', s.stage === 'unfold', s.stage);
  check('ひらく前は模様がまだ出ていない', s.pattern === null, s.pattern);
  const trail = [];
  for (let i = 0; i < 60; i++) {
    await dragPath(page, [[cx - 100, cy - 20], [cx + 100, cy + 20]], 8);
    await page.waitForTimeout(90);
    s = await state(page);
    trail.push(s.foldT);
    if (i === 4) await shot(page, tag + '-9-opening');
    if (s.pattern) break;
  }
  const distinctT = new Set(trail.map(v => v.toFixed(2))).size;
  check('段階的にひらいた（一瞬で切り替わらない）', distinctT >= 5, distinctT);
  s = await until(page, x => !!x.pattern, 15000, 'pattern');
  check('ひらいて模様が現れた', !!s.pattern, s.pattern);
  check('完全に開いた', s.foldT < 0.03, s.foldT);
  log(`     → もよう: ${s.pattern}`);
  await shot(page, tag + '-10-revealed');

  // --- すすぐ -------------------------------------------------------------
  await clickNext(page);
  s = await until(page, x => x.stage === 'rinse', 20000, 'rinse');
  check('RINSE に入った', s.stage === 'rinse', s.stage);
  for (let i = 0; i < 60; i++) {
    await dragPath(page, [[cx - 90, cy], [cx + 90, cy]], 4);
    await page.waitForTimeout(60);
    s = await state(page);
    if (s.rinse > 0.76) break;
  }
  check('すすげた', s.rinse > 0.7, s.rinse);
  await shot(page, tag + '-11-rinse');

  // --- ほす ---------------------------------------------------------------
  await clickNext(page);
  s = await until(page, x => x.stage === 'dry', 20000, 'dry');
  check('DRY に入った', s.stage === 'dry', s.stage);
  check('できあがりカードが出た', await untilDom(page, '#reveal', 30000));
  const nm = (await page.locator('#reveal-name').textContent()).trim();
  log(`     → できあがり: ${nm}`);
  await shot(page, tag + '-12-dry');
  return nm;
}

// ---------------------------------------------------------------------------

(async () => {
  const server = await serve(PORT);
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const errors = [];

  try {
    // ---- 1) 縦画面フルプレイ + 重ね染め ----
    let { ctx, page } = await newPage(browser, PORTRAIT, errors);
    await shot(page, 'title');
    await playthrough(page, PORTRAIT, 'portrait', { redip: true });

    // ---- 2) 再プレイ ----
    log('\n[再プレイ]');
    await page.locator('#again-btn').click({ force: true });
    let s = await until(page, x => x.stage === 'fold', 15000, 'replay');
    check('もういちど はじめから遊べる',
      s.stage === 'fold' && s.ties === 0 && s.boards === 0 && s.dye === 0 && s.dips === 0 && !s.pattern, s);
    await ctx.close();

    // ---- 3) 横画面フルプレイ ----
    ({ ctx, page } = await newPage(browser, LANDSCAPE, errors));
    await playthrough(page, LANDSCAPE, 'landscape', { redip: false });
    await ctx.close();

    // ---- 4) 画面回転で状態が保たれるか ----
    log('\n[画面回転]');
    ({ ctx, page } = await newPage(browser, PORTRAIT, errors));
    await page.click('#start-btn');
    await until(page, x => x.stage === 'fold', 15000);
    await dragPath(page, [[100, 500], [300, 380]]);
    await until(page, x => x.foldT > 0.98, 25000, 'rot-fold');
    await clickNext(page);
    await until(page, x => x.stage === 'bind', 12000);
    await circleDrag(page, 195, 420, 74, 2.4);
    await until(page, x => x.ties >= 1, 12000);
    const beforeRot = await state(page);
    await page.setViewportSize(LANDSCAPE);
    await page.waitForTimeout(900);
    const afterRot = await state(page);
    check('回転しても工程が保たれる', beforeRot.stage === afterRot.stage, { beforeRot, afterRot });
    check('回転しても折り方が保たれる', beforeRot.fold === afterRot.fold);
    check('回転しても縛りが保たれる', beforeRot.ties === afterRot.ties, { b: beforeRot.ties, a: afterRot.ties });
    check('回転しても折りたたみ状態が保たれる', Math.abs(beforeRot.foldT - afterRot.foldT) < 0.02);
    await shot(page, 'rotate-landscape');
    await page.setViewportSize(PORTRAIT);
    await page.waitForTimeout(800);
    const back = await state(page);
    check('もどしても保たれる', back.ties === beforeRot.ties && back.fold === beforeRot.fold, back);

    // ---- 5) 連打・途中で指を離す ----
    log('\n[連打・途中で指を離す]');
    const errBefore = errors.length;
    for (let i = 0; i < 40; i++) {
      await page.mouse.click(195 + (i % 7) * 12, 400 + (i % 5) * 15, { delay: 2 });
    }
    for (let i = 0; i < 10; i++) {
      const b = page.locator('#next-btn');
      if (await b.isVisible()) await b.click({ force: true, timeout: 3000 }).catch(() => { });
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1500);
    check('連打しても落ちない', errors.length === errBefore, errors.slice(errBefore, errBefore + 3));

    await page.mouse.move(195, 500);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
    });
    await page.waitForTimeout(400);
    check('途中で指が離れても入力状態が残らない',
      await page.evaluate(() => !window.__aizome.input.active));
    await page.mouse.up().catch(() => { });

    // 沈めている最中にタブが隠れる → 復帰
    await page.mouse.move(195, 480);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.mouse.up().catch(() => { });
    await page.waitForTimeout(800);
    const beforeAlive = (await state(page)).stage;
    await page.waitForTimeout(1200);
    check('割り込み後もゲームが動き続ける', typeof beforeAlive === 'string' && errors.length === errBefore);
    await ctx.close();

    // ---- 6) iPad 縦 ----
    log('\n[iPad たて]');
    ({ ctx, page } = await newPage(browser, IPAD_P, errors));
    await page.click('#start-btn');
    s = await until(page, x => x.stage === 'fold', 15000);
    check('iPad たてでも起動する', s.stage === 'fold');
    await shot(page, 'ipad-fold');
    await ctx.close();

    // ---- 7) 折り 4 方式 × 縛り 2 方式 → 模様の種類 ----
    log('\n[折り 4 方式・縛り 2 方式・模様の生成]');
    ({ ctx, page } = await newPage(browser, LANDSCAPE, errors));
    const gen = await page.evaluate(async () => {
      const g = window.__aizome.game;
      const M = await import('/src/resist.js');
      const out = [], fams = ['accordion', 'triangle', 'pinch', 'roll'];
      const mods = ['thread1', 'thread2', 'thread4', 'boardCircle', 'boardStar', 'boardTri'];
      for (const f of fams) {
        for (const m of mods) {
          g.startPlay();
          g.pickFoldTool(f);
          g.cloth.foldT = 1;
          if (m.startsWith('board')) {
            const sh = { boardCircle: 'circle', boardStar: 'star', boardTri: 'triangle' }[m];
            g.binding.boards.push({ a: 0.42, b: 0.5, shape: sh, size: 0.2, rot: 0, clamp: 1, removed: false });
          } else {
            const n = { thread1: 1, thread2: 2, thread4: 4 }[m];
            for (let i = 0; i < n; i++) {
              g.binding.ties.push({ a: 0.2 + i * 0.19, width: 0.04, strength: 0.9, wraps: 2, tighten: 1, removed: false });
            }
          }
          out.push({ combo: f + '/' + m, name: M.analysePattern(g.fold, g.binding).name });
        }
      }
      return out;
    });
    gen.forEach(o => log(`     ${o.combo.padEnd(22)} → ${o.name}`));
    const distinct = new Set(gen.map(o => o.name));
    check('模様のバリエーションが 12 種類以上', distinct.size >= 12, distinct.size);

    // 同じ折り方でも縛り位置が違えば別の防染マップになる（＝毎回ちがう模様）
    const variety = await page.evaluate(async () => {
      const M = await import('/src/resist.js');
      const F = await import('/src/folds.js');
      const sig = (ties) => {
        const fold = F.createFold({ family: 'triangle', rot: 0, extra: true, seed: 1 });
        const fm = M.buildFootprintMap(fold, 96);
        const b = M.createBinding();
        for (const a of ties) M.addTie(b, a);
        b.ties.forEach(t => t.tighten = 1);
        const data = M.bakeResist(fold, b, fm);
        let sum = 0, white = 0;
        for (let i = 0; i < data.length; i += 4) { sum += data[i]; if (data[i] > 140) white++; }
        return { sum, white };
      };
      const a = sig([0.3]), b = sig([0.55]), c = sig([0.3, 0.62, 0.8]);
      return { a, b, c };
    });
    check('縛り位置を変えると白の出方が変わる',
      variety.a.white !== variety.b.white && variety.c.white > variety.a.white, variety);
    const whiteRatio = variety.a.white / (96 * 96);
    check('白く残る面積が妥当（0 でも全面でもない）', whiteRatio > 0.005 && whiteRatio < 0.7, whiteRatio.toFixed(3));
    await ctx.close();

    log('\n---------------------------------------------');
    if (errors.length) {
      log('JS エラー:');
      [...new Set(errors)].slice(0, 20).forEach(e => log('   ! ' + e));
      failures += errors.length;
    }
    log(failures === 0 ? '✅ すべて通過' : `❌ ${failures} 件の失敗`);
  } catch (e) {
    console.error('テストが例外で停止:', e);
    failures++;
  } finally {
    await browser.close();
    server.close();
    process.exit(failures === 0 ? 0 : 1);
  }
})();
