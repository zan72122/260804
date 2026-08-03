import { chromium } from 'playwright';

const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE_URL = 'http://localhost:5193/';
const OUT = '/tmp/claude-0/-home-user-260804/2eeaee21-2a8b-56e3-9168-8c4b4d89a82d/scratchpad/shots-p3';

const VIEWPORTS = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'ipad-land', width: 1180, height: 820 }
];

const PHASES = ['title', 'notice', 'safety', 'openPlate', 'removeStep', 'inspect', 'repair', 'crankCheck', 'restoreStep', 'closePlate', 'testRun', 'celebrate', 'select'];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') console.log(`[console.error][${vp.name}] ${m.text()}`); });
    page.on('pageerror', (e) => console.log(`[pageerror][${vp.name}] ${e}`));
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__flowDebug, null, { timeout: 10000 });

    // タイトル(ロボは出ない想定)
    await page.screenshot({ path: `${OUT}/${vp.name}__00-title.png` });

    // フェーズを開始してから各フェーズへ強制ジャンプ(fault固定でrollerを使う)
    await page.evaluate(() => window.__flowDebug.forceFault('roller'));
    await sleep(150);

    for (const phase of PHASES) {
      if (phase === 'title') continue;
      await page.evaluate((p) => window.__flowDebug.forcePhase(p), phase);
      // カメラ・ロボの追従が収束するのを少し待つ
      await sleep(900);
      await page.screenshot({ path: `${OUT}/${vp.name}__${phase}.png` });
    }

    // celebrateはもう少し長めに待って紙吹雪が画面に満ちた状態も撮る
    await page.evaluate(() => window.__flowDebug.forcePhase('celebrate'));
    await sleep(1400);
    await page.screenshot({ path: `${OUT}/${vp.name}__celebrate-full.png` });

    await context.close();
  }
  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
