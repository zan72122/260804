/* 各ステージの見た目をすばやく確認する
   node tools/shots.js [device]                                        */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEVICES = {
  'iphone-p': { width: 390, height: 844, dpr: 2 },
  'iphone-l': { width: 844, height: 390, dpr: 2 },
  'ipad-p': { width: 820, height: 1180, dpr: 1.5 },
  'ipad-l': { width: 1180, height: 820, dpr: 1.5 }
};
const which = process.argv[2] || 'iphone-p';
const only = process.argv[3];
const d = DEVICES[which];
const OUT = '/tmp/claude-0/-home-user-260804/511ee5a0-b55b-5641-86d9-adb929afe053/scratchpad/look-' + which;
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(__dirname, '..');

const SETUPS = {
  CHOOSE: 'g.setStage("CHOOSE")',
  SHAPE: 'seedDough(0.35); g.setStage("SHAPE"); run(0.5)',
  SHAPE2: 'seedDough(1); g.setStage("SHAPE"); run(0.5)',
  TOSS: 'seedDough(1); g.setStage("TOSS"); PZ.stages.TOSS.launch(g,0.85); run(0.55)',
  SAUCE: 'seedDough(1); seedSauce(); g.setStage("SAUCE"); run(0.6)',
  TOPPING: 'seedDough(1); seedSauce(); seedTops(26); g.setStage("TOPPING"); run(1.2)',
  INSERT: 'seedDough(1); seedSauce(); seedTops(30); g.setStage("INSERT"); PZ.stages.INSERT.v=0.20; run(0.4)',
  INSERT2: 'seedDough(1); seedSauce(); seedTops(30); g.setStage("INSERT"); PZ.stages.INSERT.v=-0.75; run(0.4)',
  BAKE: 'seedDough(1); seedSauce(); seedTops(30); g.setStage("BAKE"); run(5.5)',
  ROTATE: 'seedDough(1); seedSauce(); seedTops(30); g.setStage("BAKE"); run(6.4); PZ.stages.ROTATE.grab=true; run(1.0)',
  RETRIEVE: 'seedDough(1); seedSauce(); seedTops(30); g.pizza.startBake(); bakeTo(0.9); g.setStage("RETRIEVE"); PZ.stages.RETRIEVE.peelIn=1; PZ.stages.RETRIEVE.v=-0.35; run(0.4)',
  CUT: 'seedDough(1); seedSauce(); seedTops(30); g.pizza.startBake(); bakeTo(0.9); g.setStage("CUT"); run(1.2); PZ.stages.CUT.cutN=4; g.pizza.setCuts(8); run(0.6)',
  LIFT: 'seedDough(1); seedSauce(); seedTops(30); g.pizza.startBake(); bakeTo(0.9); g.setStage("CUT"); run(1.2); PZ.stages.CUT.cutN=4; g.pizza.setCuts(8); PZ.stages.CUT.lift={index:1,k:0,target:1}; run(1.0)',
  DONE: 'seedDough(1); seedSauce(); seedTops(30); g.pizza.startBake(); bakeTo(0.9); g.pizza.setCuts(8); g.setStage("DONE"); run(2.0)'
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr, hasTouch: true, isMobile: true
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('ERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const g = window.PZ.game;
    window.run = (sec) => { const n = Math.ceil(sec / 0.033); for (let i = 0; i < n; i++) g.update(0.033); };
    window.bakeTo = (b) => {
      const f = g.fire.group.position, q = window.PZ.pathAt(g.vBake);
      const ang = Math.atan2(f.z - q.z, f.x - q.x);
      for (let i = 0; i < 400 && g.pizza.bake < b; i++) g.pizza.bakeStep(0.05, 1, -ang);
    };
    window.seedDough = (k) => {
      const p = g.pizza; p.reset();
      const r = 46 + (182 - 46) * k;
      for (let i = 0; i < p.rad.length; i++) p.rad[i] = r + Math.sin(i * 0.7) * r * 0.02;
      p.thick = 26 - 18 * k; p.flourAmt = 1 - k * 0.5; p.dirty = true; p.texDirty = true;
    };
    window.seedSauce = () => {
      const p = g.pizza;
      for (let i = 0; i <= 140; i++) {
        const u = i / 140, a = u * Math.PI * 2 * 3.4, r = u * p.innerR() * 0.95;
        p.paintSauce(Math.cos(a) * r, Math.sin(a) * r, 46);
      }
    };
    window.seedTops = (n) => {
      const p = g.pizza, items = g.recipe.items;
      for (let i = 0; i < n; i++) {
        const a = i * 2.399, r = Math.sqrt((i + 0.5) / n) * p.innerR() * 0.84;
        const type = i % 3 === 0 ? items[((i / 3) | 0) % items.length] : 'cheese';
        p.addTopping(type, Math.cos(a) * r, Math.sin(a) * r);
      }
      for (const t of p.toppings) t.drop = 0;
    };
  });

  for (const [name, code] of Object.entries(SETUPS)) {
    if (only && name !== only) continue;
    const e = await page.evaluate((code) => {
      try {
        const g = window.PZ.game;
        g.paused = false;
        // eslint-disable-next-line no-eval
        eval(code);
        g.setCam(g.stage.cam || 'bench', true);
        g.idle = 3; g.guideAlpha = 1;
        for (let i = 0; i < 3; i++) g.update(0.016);
        g.paused = true;
        return null;
      } catch (err) { return name + ': ' + err.message; }
    }, code);
    if (e) errs.push(e);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
  }
  console.log(which + ': ' + (errs.length ? 'ERRORS\n' + errs.slice(0, 12).join('\n') : 'ok'));
  await browser.close();
})();
