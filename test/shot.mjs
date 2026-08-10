/** Quick visual iteration: grab screenshots of a few states/viewports. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2] ?? '/tmp/claude-0/-home-user-260804/dac3c133-3b7e-5203-9765-50e49a930c97/scratchpad';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
for (const [name, w, h] of [['p', 390, 844], ['l', 844, 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  console.log('step: goto', name);
  await p.goto('http://localhost:8080/');
  await p.waitForFunction(() => !!window.__crane, null, { timeout: 20000 });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${OUT}/${name}-idle.png` });
  // mid-grab shot
  await p.evaluate(() => { window.__crane.game.setAim(-0.09, -0.06); });
  await p.waitForTimeout(900);
  console.log('step: grab', name);
  await p.evaluate(() => window.__crane._doGrab());
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${OUT}/${name}-grab.png` });
  try { await p.waitForFunction(() => window.__crane.game.phase === 'idle' || window.__crane.game.phase === 'won', null, {timeout:25000}); } catch(e){ console.log('stuck in phase', await p.evaluate(()=>window.__crane.game.phase)); }
  await p.screenshot({ path: `${OUT}/${name}-after.png` });
  if (errs.length) console.log(name, 'ERRORS', errs.slice(0,4));
  await p.close();
}
await b.close();
console.log('shots in', OUT);
