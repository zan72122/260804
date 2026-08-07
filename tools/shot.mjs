/* 自動試遊：シミュレーションを直接進めながらスクリーンショットを撮る
   （ヘッドレスは SwiftShader なので実時間の rAF では進まない） */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.env.OUT
  || '/tmp/claude-0/-home-user-260804/22733108-75c0-5bd5-987e-4304adc8d2d3/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = {
  land: { width: 1024, height: 640 },
  port: { width: 430, height: 860 },
  pad: { width: 1180, height: 820 },
};

const view = process.argv[2] || 'land';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: VIEWS[view], deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (!m.text().includes('404')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));

await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__tbm, null, { timeout: 60000 });

/** シミュレーションだけを n 秒ぶん進める（描画はしない） */
const sim = (sec) => page.evaluate((s) => {
  const g = window.__tbm;
  const steps = Math.round(s * 60);
  for (let i = 0; i < steps; i++) g.update(1 / 60);
}, sec);

const info = () => page.evaluate(() => {
  const g = window.__tbm;
  const r = g.renderer.info;
  return {
    st: g.state, z: +g.machineZ.toFixed(2), rings: g.ringsBuilt,
    piece: g.pieceIdx, calls: r.render.calls, tris: r.render.triangles,
  };
});

const shot = async (name) => {
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/${view}-${name}.png` });
  const i = await info();
  console.log(String(name).padEnd(18), JSON.stringify(i));
};

await shot('00-title');

// はじめる（本物のボタンを押す）
await page.locator('#startBtn').dispatchEvent('pointerdown');
await page.evaluate(() => { document.getElementById('title').style.display = 'none'; });
await sim(0.5);
await shot('01-idle');

// 始動レバー
await page.evaluate(() => { window.__tbm.onLever(1); window.__tbm.onLeverDone(); });
await sim(1.2);
await shot('02-spinup');
await sim(1.6);
await shot('03-drill-ready');

// 掘進
await page.evaluate(() => window.__tbm.setDigging(true));
await sim(1.8);
await shot('04-drilling');
await sim(2.0);
await shot('05-drilling-late');

for (let i = 0; i < 60 && (await page.evaluate(() => window.__tbm.state)) === 'drill'; i++) await sim(0.3);
await sim(1.4);
await shot('06-strokeEnd');

await sim(0.6);            // → retract
await page.evaluate(() => window.__tbm.onJack(0.55));
await sim(0.3);
await shot('07-retract');
await page.evaluate(() => { window.__tbm.onJack(1); window.__tbm.onJackDone(); });
await sim(0.8);
await shot('08-erectPick');

// セグメント 5 枚
for (let i = 0; i < 5; i++) {
  for (let k = 0; k < 40 && (await page.evaluate(() => window.__tbm.state)) !== 'erectMove'; k++) await sim(0.2);
  if (i === 0) await shot('09-erectMove');
  await page.evaluate(() => {
    const g = window.__tbm;
    if (g.held) g.pointerAngle = g.held.spec.angle * Math.PI / 180;
  });
  await sim(0.9);
  await page.evaluate(() => { window.__tbm.pointerAngle = null; });
  await sim(1.0);
  if (i === 2) await shot('10-erect-mid');
  if (i === 4) await shot('10b-erect-five');
}

for (let k = 0; k < 40 && (await page.evaluate(() => window.__tbm.state)) !== 'keyPush'; k++) await sim(0.2);
await shot('11-keyPush');
await page.evaluate(() => window.__tbm.pushKey());
await sim(0.6);
await shot('12-ringDone');
await sim(2.2);
await shot('13-afterRing');

// あと 3 リングを一気に組んで、引きの演出まで確認する
for (let r = 0; r < 3; r++) {
  await page.evaluate(() => window.__tbm.setDigging(true));
  for (let k = 0; k < 80 && (await page.evaluate(() => window.__tbm.state)) === 'drill'; k++) await sim(0.3);
  await sim(1.8);
  await page.evaluate(() => { window.__tbm.onJack(1); window.__tbm.onJackDone(); });
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 40 && !['erectMove', 'keyPush'].includes(await page.evaluate(() => window.__tbm.state)); k++) await sim(0.2);
    const st = await page.evaluate(() => window.__tbm.state);
    if (st === 'keyPush') { await page.evaluate(() => window.__tbm.pushKey()); await sim(1.0); break; }
    await page.evaluate(() => { const g = window.__tbm; if (g.held) g.pointerAngle = g.held.spec.angle * Math.PI / 180; });
    await sim(0.9);
    await page.evaluate(() => { window.__tbm.pointerAngle = null; });
    await sim(1.0);
  }
  await sim(2.2);
}
await shot('14-reveal-start');
await sim(3.0);
await shot('15-reveal');
await sim(3.0);
await shot('16-reveal-end');

console.log('--- console ---');
console.log(logs.slice(0, 30).join('\n') || '(clean)');
await browser.close();
