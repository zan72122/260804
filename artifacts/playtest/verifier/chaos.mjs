// Break-it attempts at 390x844 portrait, incl. rotation mid-grind and
// settings mid-action, plus two replay loops in a row.
import { launch, flow, shot, phase, signals, hotspots, center, waitPhase, tap, swipe, apiErrors, carPos } from './helpers.mjs';

const { browser, page, errors } = await launch({ width: 390, height: 844 });
const log = (...a) => console.log(...a);
const vp = () => page.viewportSize();
try {
  // ---- title: rapid taps everywhere
  for (let i = 0; i < 14; i++) {
    await page.mouse.click(30 + Math.random() * 330, 30 + Math.random() * 780, { delay: 10 });
  }
  log('after rapid title taps, phase:', await phase(page));
  // if a stray tap hit play/gear, recover
  let s = await signals(page);
  if (s.settingsOpen) {
    const hs = await hotspots(page);
    await tap(page, center(hs.closeSettings).x, center(hs.closeSettings).y);
    log('closed settings that opened from stray tap');
  }
  if ((await phase(page)) === 'title') {
    const hs = await hotspots(page);
    await tap(page, center(hs.play).x, center(hs.play).y);
  }
  // arrive: mash taps (should skip roll-in harmlessly)
  await page.waitForTimeout(200);
  for (let i = 0; i < 8; i++) await page.mouse.click(200, 400, { delay: 5 });
  await waitPhase(page, 'scanBefore', 20000);
  log('reached scanBefore');

  // scan: double-tap scan button, then tap it again mid-sweep
  const hs1 = await hotspots(page);
  await tap(page, center(hs1.scan).x, center(hs1.scan).y);
  await tap(page, center(hs1.scan).x, center(hs1.scan).y);
  await page.waitForTimeout(400);
  await tap(page, center(hs1.scan).x, center(hs1.scan).y);
  // open settings mid-scan
  const hsG = await hotspots(page);
  await tap(page, center(hsG.gear).x, center(hsG.gear).y);
  await page.waitForTimeout(300);
  await shot(page, 'chaos-settings-midscan');
  s = await signals(page);
  log('settings open mid-scan:', s.settingsOpen);
  const hs2 = await hotspots(page);
  await tap(page, center(hs2.closeSettings).x, center(hs2.closeSettings).y);
  await waitPhase(page, 'prepUnits', 20000);

  // prep: drag unit into the sky and drop it
  const hs3 = await hotspots(page);
  await swipe(page, center(hs3.tray0), { x: vp().width / 2, y: 80 }, 350, 10);
  await page.waitForTimeout(300);
  await shot(page, 'chaos-unit-dropped-sky');
  s = await signals(page);
  log('after sky drop, docked:', JSON.stringify(s.unitsDocked));
  // drag tray0 unit onto the WRONG socket (socket1)
  const hs4 = await hotspots(page);
  await swipe(page, center(hs4.tray0), center(hs4.socket1), 400, 14);
  s = await signals(page);
  log('after wrong-socket drag, docked:', JSON.stringify(s.unitsDocked));
  // finish docking properly (whichever remain)
  for (const i of [0, 1]) {
    const h = await hotspots(page);
    const sg = await signals(page);
    if (!sg.unitsDocked[i] && h['tray' + i] && h['socket' + i]) {
      await swipe(page, center(h['tray' + i]), center(h['socket' + i]), 400, 14);
      await page.waitForTimeout(200);
    }
  }
  await waitPhase(page, 'lower', 15000);

  // lever: diagonal/zigzag pull, with a mid-gesture settings tap attempt ignored
  const hs5 = await hotspots(page);
  const lv = hs5.lever;
  await page.mouse.move(lv.x + lv.w / 2, lv.y + 20);
  await page.mouse.down();
  await page.mouse.move(lv.x + lv.w / 2 + 120, lv.y + lv.h * 0.5, { steps: 6 });
  await page.mouse.move(lv.x + lv.w / 2 - 60, lv.y + lv.h + 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  s = await signals(page);
  log('lever after zigzag overshoot: locked=', s.locked, 'progress=', s.leverProgress.toFixed(2));
  if (!s.locked) {
    await swipe(page, { x: lv.x + lv.w / 2, y: lv.y + 20 }, { x: lv.x + lv.w / 2, y: lv.y + lv.h }, 600, 16);
  }
  await waitPhase(page, 'grind', 15000);
  await page.waitForTimeout(400);

  // grind: start driving, then ROTATE mid-gesture
  const w0 = vp().width;
  await page.mouse.move(w0 / 2, 600);
  await page.mouse.down();
  await page.mouse.move(w0 / 2, 350, { steps: 6 });
  await page.setViewportSize({ width: 844, height: 390 }); // rotate mid-drag
  await page.waitForTimeout(600);
  await shot(page, 'chaos-rotate-midgrind');
  log('after rotate mid-grind: phase=', await phase(page), 'viewport=', JSON.stringify(await page.evaluate(() => window.__railGameTest.getViewport())));
  await page.mouse.up().catch(() => {});
  // rotate back
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await shot(page, 'chaos-rotate-back');

  // open settings while driving
  await page.mouse.move(195, 600);
  await page.mouse.down();
  await page.mouse.move(195, 400, { steps: 5 });
  const hs6 = await hotspots(page);
  await page.mouse.up();
  await tap(page, center(hs6.gear).x, center(hs6.gear).y);
  s = await signals(page);
  const posA = await carPos(page);
  await page.waitForTimeout(800);
  const posB = await carPos(page);
  log('settings mid-grind: open=', s.settingsOpen, 'world paused:', Math.abs(posB - posA) < 0.01);
  await shot(page, 'chaos-settings-midgrind');
  // toggle all three settings, close
  const hs7 = await hotspots(page);
  for (const k of ['toggleLight', 'toggleMotion', 'toggleSound']) await tap(page, center(hs7[k]).x, center(hs7[k]).y);
  await tap(page, center(hs7.closeSettings).x, center(hs7.closeSettings).y);
  log('settings after toggles:', JSON.stringify(await page.evaluate(() => window.__railGameTest.getSettings())));
  // toggle back
  await tap(page, center(hs6.gear).x, center(hs6.gear).y);
  const hs8 = await hotspots(page);
  for (const k of ['toggleLight', 'toggleMotion', 'toggleSound']) await tap(page, center(hs8[k]).x, center(hs8[k]).y);
  await tap(page, center(hs8.closeSettings).x, center(hs8.closeSettings).y);

  // finish the grind
  await flow.grind(page);
  await flow.scanAfter(page);
  // testRun: reverse swipe first (should not launch), then forward
  await waitPhase(page, 'testRun', 20000);
  await page.waitForTimeout(300);
  await swipe(page, { x: 195, y: 400 }, { x: 195, y: 620 }, 200, 8); // downward = backwards in portrait
  await page.waitForTimeout(500);
  s = await signals(page);
  log('after reverse swipe, trainLaunched:', s.trainLaunched);
  await swipe(page, { x: 195, y: 550 }, { x: 195, y: 330 }, 200, 8);
  await flow.replay(page);

  // replay loop 1: mash both cards quickly (replayNew)
  const hs9 = await hotspots(page);
  await tap(page, center(hs9.replayNew).x, center(hs9.replayNew).y);
  await tap(page, center(hs9.replaySame).x, center(hs9.replaySame).y);
  await tap(page, center(hs9.replayNew).x, center(hs9.replayNew).y);
  await waitPhase(page, 'arrive', 8000);
  log('replay #1 (new wiggle) ok, phase:', await phase(page));
  // speedrun round 2 with helpers
  await waitPhase(page, 'scanBefore', 20000);
  await flow.doScan(page);
  await flow.prep(page);
  await flow.lever(page);
  await flow.grind(page);
  await flow.scanAfter(page);
  await flow.testRun(page);
  await flow.replay(page);
  const hs10 = await hotspots(page);
  await tap(page, center(hs10.replaySame).x, center(hs10.replaySame).y);
  await waitPhase(page, 'arrive', 8000);
  log('replay #2 (same track) ok, phase:', await phase(page));
  await shot(page, 'chaos-after-two-replays');
  log('phaseLog tail:', JSON.stringify((await page.evaluate(() => window.__railGameTest.getPhaseLog())).slice(-12)));
} finally {
  log('page errors:', JSON.stringify(errors));
  log('api errors:', JSON.stringify(await apiErrors(page).catch(() => 'n/a')));
  await browser.close();
}
