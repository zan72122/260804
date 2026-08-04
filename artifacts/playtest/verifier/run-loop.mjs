// Full happy-path loop at one viewport, screenshotting every phase.
// usage: node run-loop.mjs <w> <h> <tag>
import { launch, flow, shot, phase, signals, apiErrors, rms, tap, hotspots, center, waitPhase } from './helpers.mjs';

const [w, h, tag] = [parseInt(process.argv[2]), parseInt(process.argv[3]), process.argv[4]];
const { browser, page, errors } = await launch({ width: w, height: h });
try {
  await page.waitForTimeout(500);
  await shot(page, `${tag}-title`);
  const rmsBefore = await rms(page);
  await flow.titleToScan(page, tag);
  await flow.doScan(page, tag);
  await page.waitForTimeout(2500);
  await shot(page, `${tag}-scan-revealed`);
  await flow.prep(page, tag);
  await flow.lever(page, tag);
  const samples = await flow.grind(page, tag);
  console.log('grind samples:', JSON.stringify(samples.filter((_, i) => i % 3 === 0)));
  await flow.scanAfter(page, tag);
  const rmsAfter = await rms(page);
  await flow.testRun(page, tag);
  // sample train quietness
  const sigs = [];
  for (let i = 0; i < 8; i++) {
    if ((await phase(page)) !== 'testRun') break;
    sigs.push(await signals(page));
    await page.waitForTimeout(400);
  }
  console.log('testRun whoosh/bob:', JSON.stringify(sigs.map((s) => ({ whoosh: +s.whoosh.toFixed(2), bob: +s.trainBob.toFixed(2) }))));
  await flow.replay(page, tag);
  // choose "same track" to verify replay works
  const hs = await hotspots(page);
  await tap(page, center(hs.replaySame).x, center(hs.replaySame).y);
  await waitPhase(page, 'arrive', 8000);
  await shot(page, `${tag}-replay-arrive2`);
  console.log(`rms before=${rmsBefore.toFixed(3)} after=${rmsAfter.toFixed(3)}`);
  console.log('final phase:', await phase(page));
} finally {
  console.log('page errors:', JSON.stringify(errors));
  console.log('api errors:', JSON.stringify(await apiErrors(page).catch(() => 'n/a')));
  await browser.close();
}
