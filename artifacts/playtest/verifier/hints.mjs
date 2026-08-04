// Idle-hint audit at 390x844: reach each interactive phase, idle 5s, screenshot.
import { launch, flow, shot, phase, waitPhase } from './helpers.mjs';

const { browser, page, errors } = await launch({ width: 390, height: 844 });
const idleShot = async (name) => {
  await page.waitForTimeout(5200);
  await shot(page, name);
  console.log(name, 'phase:', await phase(page));
};
try {
  await idleShot('hint-title');
  await flow.titleToScan(page);
  await idleShot('hint-scanBefore');
  await flow.doScan(page);
  await flow.prep(page);
  await waitPhase(page, 'lower', 15000);
  await idleShot('hint-lower');
  await flow.lever(page);
  await waitPhase(page, 'grind', 15000);
  await idleShot('hint-grind');
  await flow.grind(page);
  await waitPhase(page, 'scanAfter', 20000);
  await idleShot('hint-scanAfter');
  await flow.scanAfter(page);
  await waitPhase(page, 'testRun', 20000);
  await idleShot('hint-testRun');
  await flow.testRun(page);
  await flow.replay(page);
  await idleShot('hint-replay');
} finally {
  console.log('page errors:', JSON.stringify(errors));
  await browser.close();
}
