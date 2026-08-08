import { chromium } from 'playwright';

const OUT = '/tmp/claude-0/-home-user-260804/a1749338-086b-596f-8546-d01c60c6422c/scratchpad';
const URL = 'http://127.0.0.1:8123/index.html';

const mode = process.argv[2] || 'landscape';
const size = mode === 'portrait' ? { width: 414, height: 896 } : { width: 896, height: 414 };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-gpu-sandbox', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const ok = await page.evaluate(() => !!window.__game);
if (!ok) { console.log(logs.join('\n')); await browser.close(); process.exit(1); }

// 見た目の確認は「時間ではなくフレーム数」で進める（swiftshader は遅い）
async function step(n = 40, dt = 1 / 30) {
  await page.evaluate(async ({ n, dt }) => {
    const g = window.__game;
    for (let i = 0; i < n; i++) {
      g.game.update(dt); g.cam.update(dt);
      g.molten.update(dt, g.camera, 1); g.ui.update(dt);
    }
  }, { n, dt });
  await page.waitForTimeout(160);
}

async function set(fn) { await page.evaluate(fn); }
async function shot(name) {
  await page.waitForTimeout(650);   // CSS アニメーションの着地を待つ
  await page.screenshot({ path: `${OUT}/${mode}-${name}.png` });
  const ph = await page.evaluate(() => window.__game.game.phase);
  console.log(`${mode}-${name}: ${ph}`);
}

await shot('1-title');

await set(() => { window.__game.ui.screen(null); window.__game.game.go('DRILL_IN'); });
await step(30); await shot('2-drillIn');

await set(() => { const S = window.__game.game.S; S.prog = 1.4; });
await step(4); await step(40); await shot('3-drillWork');

await set(() => { const S = window.__game.game.S; S.depth = 0.7; S.dSpinT = 26; S.dSpin = 26; });
await step(20); await shot('4-drilling');

await set(() => { const S = window.__game.game.S; S.depth = 1; });
await step(3);
await step(14); await shot('5-break');
await step(24); await shot('6-gush');

await set(() => window.__game.game.go('FLOW'));
await step(70); await shot('7-flow');

await set(() => window.__game.game.go('MUD_IN'));
await step(20);
await set(() => { const S = window.__game.game.S; S.prog = 1.4; });
await step(4); await step(40); await shot('8-mudIn');

await set(() => window.__game.game.go('PLUG'));
await step(30);
await set(() => { const S = window.__game.game.S; S.push = 0.55; });
await step(10); await shot('9-cutaway');

await set(() => { const S = window.__game.game.S; S.push = 1; });
await step(4); await step(40); await shot('10-sealed');
await step(70); await shot('11-replay');

console.log(logs.length ? logs.join('\n') : '(no errors)');
await browser.close();
