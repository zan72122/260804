/** Captures the hero moment: the box slipping off and dropping into the tray. */
import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-260804/dac3c133-3b7e-5203-9765-50e49a930c97/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await p.goto('http://localhost:8080/');
await p.waitForFunction(() => !!window.__crane, null, { timeout: 20000 });
await p.waitForTimeout(1500);
// nudge the prize into a nearly-fallen state, then let one grab finish it
await p.evaluate(() => {
  const g = window.__crane;
  const r = g.round;
  g.p.prize.setTranslation({ x: r.box.w / 2 - r.barSpacing / 2 + 0.012, y: 0.46 + r.box.h / 2, z: -0.02 }, true);
});
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/f-teeter.png` });
await p.evaluate(() => { const g = window.__crane; const e = g.game.prizeEnds(); g.input.target.x = e.right.x - 0.045; g.input.target.z = e.c.z - e.dz * 0.85; });
await p.waitForTimeout(2500);
await p.evaluate(() => window.__crane._doGrab());
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(500);
  const y = await p.evaluate(() => window.__crane.p.prizeState().pos.y);
  if (y < 0.34) break;
}
await p.screenshot({ path: `${OUT}/f-falling.png` });
const landed = await p.waitForFunction(() => window.__crane.p.prizeState().pos.y < 0.16, null, { timeout: 120000 })
  .then(() => true).catch(() => false);
await p.screenshot({ path: `${OUT}/f-landed.png` });
console.log('landed in tray:', landed, await p.evaluate(() => JSON.stringify({ y: +window.__crane.p.prizeState().pos.y.toFixed(3), phase: window.__crane.game.phase })));
await b.close();
console.log('ok');
