// E2E検証：フェーズ変化をポーリングしながら順に操作し、各段階のスクリーンショットを撮る。
// ヘッドレスGPUではゲーム内時間が実時間より遅いことがあるため、固定待ちではなく状態駆動で進める。
// 使い方: node verify.mjs [width] [height] [outdir]
import { chromium } from 'playwright-core';
import fs from 'fs';

const W = parseInt(process.argv[2] || '1280');
const H = parseInt(process.argv[3] || '800');
const OUT = process.argv[4] || `shots-${W}x${H}`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:8321/index.html');
await page.waitForTimeout(2000);

const st = () => page.evaluate(() => window.__flower ? {
  phase: window.__flower.phase, busy: window.__flower.busy, targets: window.__flower.targets(),
} : null);

const seen = new Set();
let shotIdx = 0;
let tapCount = 0;
async function shotOnce(tag) {
  if (seen.has(tag)) return;
  seen.add(tag);
  shotIdx++;
  await page.screenshot({ path: `${OUT}/${String(shotIdx).padStart(2, '0')}-${tag}.png` });
  console.log('shot', tag);
}

const t0 = Date.now();
const LIMIT = 620000;
let revealShot = false;
while (Date.now() - t0 < LIMIT) {
  const s = await st();
  if (!s) { await page.waitForTimeout(400); continue; }
  if (s.phase === 'party') {
    await shotOnce('party');
    break;
  }
  if (s.phase === 'fill') {
    if (!seen.has('fill-1')) {
      await page.waitForTimeout(2000);
      await shotOnce('fill-1');
    }
    await page.waitForTimeout(600);
    continue;
  }
  if (s.phase === 'reveal') {
    if (!revealShot) {
      await page.waitForTimeout(9000);
      await shotOnce('reveal-mid');
      revealShot = true;
    }
    await page.waitForTimeout(800);
    continue;
  }
  if (s.busy || !s.targets.length) { await page.waitForTimeout(350); continue; }
  await shotOnce(s.phase);
  const onScreen = s.targets.filter((t) => t.x > 8 && t.x < W - 8 && t.y > 8 && t.y < H - 8);
  if (!onScreen.length) { console.log('WARN: no on-screen targets', JSON.stringify(s.targets)); break; }
  const t = onScreen[tapCount++ % onScreen.length];
  // targets() の要素には星ボタン用に next:true が混ざることがあるが、
  // 星ボタンも通常ターゲットと同様に {x,y} をタップするだけでよいのでロジック変更は不要。
  if (t.drag && t.dropX !== undefined) {
    await page.mouse.move(t.x, t.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(t.x + (t.dropX - t.x) * i / 8, t.y + (t.dropY - t.y) * i / 8);
      await page.waitForTimeout(50);
    }
    await page.mouse.up();
  } else {
    await page.mouse.click(t.x, t.y);
  }
  await page.waitForTimeout(500);
}

// パーティーの後半（花びら・開花が進んだ状態）
await page.waitForTimeout(6000);
await shotOnce('party-late');
// ゲスト入場・着席が進んだ状態
await page.waitForTimeout(16000);
await shotOnce('party-guests');
// パーティー中のタップ（花びらバースト）
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(1500);
await shotOnce('party-tap');

const s = await st();
const info = await page.evaluate(() => {
  const r = window.__flower.renderer.info;
  return { calls: r.render.calls, triangles: r.render.triangles };
});
console.log('final phase:', s && s.phase);
console.log('render info:', JSON.stringify(info));
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
if (!s || s.phase !== 'party') { console.log('FAIL: did not reach party'); process.exit(1); }
if (errors.length) { console.log('FAIL: console errors'); process.exit(1); }
console.log('PASS');
