// Night-visibility probe: scan button before hint appears + arrive shake.
import { launch, flow, shot, phase, hotspots, center, tap, waitPhase, SHOTS } from './helpers.mjs';

const { browser, page, errors } = await launch({ width: 390, height: 844 });
try {
  const hs0 = await hotspots(page);
  await tap(page, center(hs0.play).x, center(hs0.play).y);
  // sample shake during arrive (rattle evidence)
  const shakes = [];
  for (let i = 0; i < 20; i++) {
    if ((await phase(page)) !== 'arrive') break;
    shakes.push(+(await page.evaluate(() => window.__railGameTest.getSignals().shake)).toFixed(2));
    await page.waitForTimeout(250);
  }
  console.log('arrive shake samples:', JSON.stringify(shakes));
  await waitPhase(page, 'scanBefore', 20000);
  // touch once so hint timer resets, then shoot at 2s (pre-hint)
  await page.mouse.move(300, 300);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(2000);
  await shot(page, 'vis-scanBefore-nohint');
  const hs = await hotspots(page);
  const r = hs.scan;
  await page.screenshot({ path: `${SHOTS}/vis-scan-button-clip.png`, clip: { x: Math.max(0, r.x - 40), y: Math.max(0, r.y - 40), width: r.w + 80, height: Math.min(r.h + 80, 844 - r.y + 40) } });
  console.log('scan rect:', JSON.stringify(r));
} finally {
  console.log('page errors:', JSON.stringify(errors));
  await browser.close();
}
