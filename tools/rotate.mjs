/*
 * Rotation test: plays partway into the loop, then flips the viewport between
 * portrait and landscape at several points and checks the canvas resizes, the
 * camera reframes, and the game keeps running.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await (await browser.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
})).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:4173/?quality=low', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__timeScale = 8; });

const probe = () => page.evaluate(() => {
  const c = document.querySelector('#stage canvas');
  const g = window.__takajo;
  return {
    state: g.state,
    canvas: [c.width, c.height],
    css: [c.clientWidth, c.clientHeight],
    aspect: +g.camera.aspect.toFixed(3),
    fov: +g.camera.fov.toFixed(1),
    camY: +g.camera.position.y.toFixed(2),
  };
});

async function rotate(w, h, label) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1800);
  const p = await probe();
  const okAspect = Math.abs(p.aspect - w / h) < 0.02;
  const okCss = p.css[0] === w && p.css[1] === h;
  console.log(`  ${label} ${w}x${h}: state=${p.state} css=${p.css} aspect=${p.aspect} fov=${p.fov} ` +
    `${okAspect && okCss ? 'OK' : 'MISMATCH'}`);
  await page.screenshot({ path: `${OUT}/rot-${label}.png` });
  return okAspect && okCss;
}

let ok = true;
console.log('\n=== rotation ===');
// Rotate at the very start, then again once the hawk is on the fist, then in
// mid-flight, since each stage frames the shot differently.
ok = (await rotate(852, 393, 'a-landscape-start')) && ok;
ok = (await rotate(393, 852, 'b-portrait-start')) && ok;
await page.mouse.click(200, 500);
const until = async (s, ms = 60000) => { const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (s.includes((await probe()).state)) return; await page.waitForTimeout(200); } };
await until(['tethered']);
ok = (await rotate(1180, 820, 'c-ipad-landscape-fist')) && ok;
ok = (await rotate(820, 1180, 'd-ipad-portrait-fist')) && ok;
await page.mouse.click(400, 600);
await until(['ready']);
await page.evaluate(() => window.__takajo._force.cast());
await until(['soar', 'lure']);
ok = (await rotate(852, 393, 'e-landscape-soar')) && ok;
ok = (await rotate(375, 667, 'f-small-portrait-soar')) && ok;
console.log('  errors:', errors.length ? errors.slice(0, 3) : 'none');
console.log(ok && !errors.length ? '  RESULT: rotation ok' : '  RESULT: PROBLEM');
await browser.close();
