/**
 * Fast art-direction pass: screenshot a list of beats at a given device size
 * without playing through. `node qa/look.mjs [device] [stage,stage,...]`
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.QA_URL || 'http://127.0.0.1:5173/';
const DEVICES = {
  p: { width: 390, height: 844 },
  l: { width: 844, height: 390 },
  tp: { width: 834, height: 1112 },
  tl: { width: 1112, height: 834 },
};
const dev = DEVICES[process.argv[2] || 'p'];
const stages = (process.argv[3] || 'block,slicing,bath,relax,pickup,dewax,stain,mount,scopemount,focus,reveal').split(',');
const wait = Number(process.argv[4] || 1400);
const tag = process.argv[5] || (process.argv[2] || 'p');

mkdirSync('qa/look', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  viewport: dev, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });

for (const s of stages) {
  await page.goto(`${URL}?stage=${s}&ribbon=7&fast=${process.env.QA_FAST || 4}`, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `qa/look/${tag}-${s}.png` });
  const info = await page.evaluate(() => window.__lab.game.probe());
  console.log(s, JSON.stringify(info.targets), 'stage=' + info.stage);
}
await browser.close();
