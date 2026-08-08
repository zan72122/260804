import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-260804/a1749338-086b-596f-8546-d01c60c6422c/scratchpad';
const size = (process.argv[2] === 'portrait') ? { width: 414, height: 896 } : { width: 896, height: 414 };
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--mute-audio'],
});
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const phase = () => page.evaluate(() => window.__game.game.phase);
const prog  = () => page.evaluate(() => { const S = window.__game.game.S; return { prog:+S.prog.toFixed(2), depth:+S.depth.toFixed(2), push:+S.push.toFixed(2) }; });
const cx = size.width / 2, cy = size.height * 0.74;

async function waitPhase(p, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await phase() === p) return true; await page.waitForTimeout(250); }
  return false;
}
async function drag(times) {
  for (let i = 0; i < times; i++) {
    await page.mouse.move(cx - 130, cy);
    await page.mouse.down();
    for (let s = 1; s <= 12; s++) await page.mouse.move(cx - 130 + s * 22, cy + Math.sin(s) * 4);
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
}
async function circles(turns) {
  const R = Math.min(size.width, size.height) * 0.20;
  await page.mouse.move(cx + R, cy); await page.mouse.down();
  const steps = Math.round(turns * 24);
  for (let i = 1; i <= steps; i++) {
    const a = (i / 24) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  await page.mouse.up();
}
async function hold(ms) {
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

console.log('phase:', await phase());
await page.mouse.click(cx, cy);                      // タイトルをタップ
console.log('after tap:', await phase());
console.log('DRILL_IN reached:', await waitPhase('DRILL_IN', 8000));

await drag(4); console.log('after drags:', await phase(), await prog());
if (await phase() === 'DRILL_IN') { await drag(4); console.log('after more drags:', await phase(), await prog()); }
console.log('DRILL_WORK:', await waitPhase('DRILL_WORK', 12000));

await circles(3.5); console.log('after circles:', await phase(), await prog());
if (await phase() === 'DRILL_WORK') { await circles(3.5); console.log('after more circles:', await phase(), await prog()); }
console.log('BREAK:', await waitPhase('BREAK', 15000));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/play-gush.png` });
console.log('FLOW:', await waitPhase('FLOW', 15000));
console.log('MUD_IN:', await waitPhase('MUD_IN', 40000));

await drag(5); console.log('after mud drags:', await phase(), await prog());
if (await phase() === 'MUD_IN') { await drag(5); console.log('more:', await phase(), await prog()); }
console.log('PLUG:', await waitPhase('PLUG', 25000));
await page.screenshot({ path: `${OUT}/play-plug.png` });
await hold(3500); console.log('after hold:', await phase(), await prog());
if (await phase() === 'PLUG') { await hold(3000); console.log('after hold2:', await phase(), await prog()); }
console.log('SEALED:', await waitPhase('SEALED', 20000));
console.log('REPLAY:', await waitPhase('REPLAY', 25000));
await page.screenshot({ path: `${OUT}/play-replay.png` });
await page.click('#againBtn');
await page.waitForTimeout(600);
console.log('after replay tap:', await phase());
console.log(errs.length ? errs.join('\n') : '(no errors)');
await browser.close();
