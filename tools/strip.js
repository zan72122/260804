/* 看板動作を「動画」として確かめるためのコマ撮り。
   静止画では見つからない、接触の外れ・瞬間移動・消滅を探す。
   node tools/strip.js [device] [stage]                                */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const D = {
  'iphone-p': { width: 390, height: 844, dpr: 1.5 },
  'iphone-l': { width: 844, height: 390, dpr: 1.5 },
  'ipad-l': { width: 1180, height: 820, dpr: 1 }
};
const which = process.argv[2] || 'iphone-l';
const what = process.argv[3] || 'insert';
const d = D[which];
const OUT = '/tmp/claude-0/-home-user-260804/511ee5a0-b55b-5641-86d9-adb929afe053/scratchpad/strip-' + what + '-' + which;
fs.mkdirSync(OUT, { recursive: true });

/* [ラベル, その時点までに進める秒数] */
const PLANS = {
  insert: { setup: 'ready()', times: [0, 0.10, 0.22, 0.36, 0.55, 0.85] },
  toss: { setup: 'tossReady()', times: [0, 0.10, 0.22, 0.38, 0.55, 0.72] }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await (await browser.newContext({
    viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr
  })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('ERR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const g = window.PZ.game, PZ = window.PZ;
    g.paused = true;
    window.seed = function () {
      const p = g.pizza; p.reset();
      for (let i = 0; i < p.rad.length; i++) p.rad[i] = 182;
      p.thick = 8; p.dirty = true; p.texDirty = true;
      for (let i = 0; i <= 140; i++) {
        const u = i / 140, a = u * Math.PI * 2 * 3.4, r = u * p.innerR() * 0.95;
        p.paintSauce(Math.cos(a) * r, Math.sin(a) * r, 46);
      }
      for (let i = 0; i < 26; i++) {
        const a = i * 2.399, r = Math.sqrt((i + 0.5) / 26) * p.innerR() * 0.84;
        p.addTopping(i % 3 === 0 ? g.recipe.items[i % g.recipe.items.length] : 'cheese',
          Math.cos(a) * r, Math.sin(a) * r);
      }
      for (const t of p.toppings) t.drop = 0;
    };
    window.ready = function () {
      seed();
      g.setStage('INSERT');
      const st = PZ.stages.INSERT;
      st.v = -0.12; st.vSpeed = 2.2;
      g.setCam('oven', true);
      for (let i = 0; i < 4; i++) g.update(0.016);
      st.doLaunch(g);
    };
    window.tossReady = function () {
      seed();
      g.setStage('TOSS');
      g.setCam('toss', true);
      for (let i = 0; i < 4; i++) g.update(0.016);
      PZ.stages.TOSS.launch(g, 0.8);
    };
    window.adv = function (sec) {
      const n = Math.round(sec / (1 / 120));
      for (let i = 0; i < n; i++) g.update(1 / 120);
    };
  });

  const plan = PLANS[what];
  await page.evaluate((s) => { const g = window.PZ.game; g.paused = false; eval(s); g.paused = true; }, plan.setup);

  let prev = 0;
  for (let i = 0; i < plan.times.length; i++) {
    const t = plan.times[i];
    await page.evaluate((dt) => { window.adv(dt); window.PZ.game.update(0.0001); }, t - prev);
    prev = t;
    const info = await page.evaluate(() => {
      const g = window.PZ.game, PZ = window.PZ;
      const peel = PZ.scene3.peel;
      return {
        pzY: +g.pz.pos.y.toFixed(4), pzZ: +g.pz.pos.z.toFixed(3),
        peelZ: +peel.position.z.toFixed(3), peelVis: peel.visible,
        gap: +(g.pz.pos.y - peel.position.y).toFixed(4)
      };
    });
    console.log('t=' + t.toFixed(2) + ' ' + JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, String(i) + '-t' + String(Math.round(t * 100)).padStart(3, '0') + '.png') });
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no js errors');
  await browser.close();
})();
