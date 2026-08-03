// Usage: node shot.mjs <outPrefix>
// Takes screenshots for each phase x viewport combo using window.__flowDebug.
import { chromium } from 'playwright';

const OUT = process.argv[2] || '/tmp/claude-0/-home-user-260804/2eeaee21-2a8b-56e3-9168-8c4b4d89a82d/scratchpad/shots-p2';
const URL = 'http://localhost:5192/';

const VIEWPORTS = [
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 1180, height: 820 }
];

// phase, optional fault kind, optional extra setup fn body (string executed in page)
const SCENES = [
  { name: 'safety', phase: 'safety', view: 'exterior' },
  { name: 'safety-fenced', phase: 'safety', view: 'exterior', fenced: true },
  { name: 'notice', phase: 'notice', view: 'exterior' },
  { name: 'inspect', phase: 'inspect', view: 'inside' },
  { name: 'repair-roller', phase: 'repair', fault: 'roller', view: 'inside' },
  { name: 'repair-roller-progress', phase: 'repair', fault: 'roller', progress: 0.6, view: 'inside' },
  { name: 'repair-chainGuide', phase: 'repair', fault: 'chainGuide', view: 'inside' },
  { name: 'repair-handrail', phase: 'repair', fault: 'handrail', view: 'inside' },
  { name: 'repair-sensor', phase: 'repair', fault: 'sensor', view: 'inside' },
  { name: 'removeStep', phase: 'removeStep', view: 'cutaway' },
  { name: 'removeStep-pulled', phase: 'removeStep', view: 'cutaway', handleAttached: true },
  { name: 'restoreStep', phase: 'restoreStep', view: 'cutaway', stepPulled: true },
  { name: 'testRun', phase: 'testRun', view: 'exterior' },
  { name: 'select', phase: 'select', view: 'exterior' },
  { name: 'celebrate', phase: 'celebrate', view: 'exterior' }
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true
});

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(URL);
  await page.waitForFunction(() => !!(window).__flowDebug);
  // start game
  await page.evaluate(() => (window).__flowDebug.ui('start'));
  await page.waitForTimeout(200);

  for (const sc of SCENES) {
    await page.evaluate(({ phase, fault, progress, view, handleAttached, stepPulled, fenced }) => {
      const dbg = (window).__flowDebug;
      if (fault) {
        dbg.forceFault(fault);
      }
      dbg.forcePhase(phase);
      if (view) dbg.state.view = view;
      if (phase === 'safety') { dbg.state.fencePlaced = !!fenced; dbg.state.stopped = false; dbg.state.locked = false; dbg.state.plateOpen = 0; }
      if (progress !== undefined && dbg.state.fault) {
        dbg.state.fault.progress = progress;
      }
      if (handleAttached) dbg.state.handleAttached = true;
      if (stepPulled) {
        dbg.state.handleAttached = true;
        dbg.state.stepRemoved = 1;
        dbg.state.escalator.removedStep = 3;
      }
    }, sc);
    await page.waitForTimeout(400);
    const file = `${OUT}/${sc.name}-${vp.name}.png`;
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  await page.close();
}

await browser.close();
