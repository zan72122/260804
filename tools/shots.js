/* 各ステージの見た目をすばやく確認するためのツール
   node tools/shots.js [device]                                        */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEVICES = {
  'iphone-p': { width: 390, height: 844, dpr: 2 },
  'iphone-l': { width: 844, height: 390, dpr: 2 },
  'ipad-p': { width: 820, height: 1180, dpr: 2 },
  'ipad-l': { width: 1180, height: 820, dpr: 2 }
};
const which = process.argv[2] || 'iphone-p';
const d = DEVICES[which];
const OUT = '/tmp/claude-0/-home-user-260804/511ee5a0-b55b-5641-86d9-adb929afe053/scratchpad/look-' + which;
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(__dirname, '..');

/* ステージごとに「それらしい状態」を作ってから撮る */
const SETUPS = {
  CHOOSE: 'g.setStage("CHOOSE")',
  SHAPE: 'g.setStage("DOUGH"); PZ.stages.DOUGH.go(g); for(let i=0;i<160;i++){g.pizza.press(Math.cos(i*1.7)*80,Math.sin(i*1.7)*80,600,0.02); g.pizza.spin=6; g.pizza.applySpin(0.02);} g.setStage("SHAPE")',
  TOSS: 'seedDough(); g.setStage("TOSS"); PZ.stages.TOSS.launch(g,0.8); for(let i=0;i<24;i++) step(0.02)',
  SAUCE: 'seedDough(); g.setStage("SAUCE"); seedSauce(0.5)',
  TOPPING: 'seedDough(); seedSauce(1); seedTops(26); g.setStage("TOPPING"); for(let i=0;i<60;i++) step(0.02)',
  INSERT: 'seedDough(); seedSauce(1); seedTops(30); g.setStage("INSERT"); PZ.stages.INSERT.v=0.25; step(0.02)',
  BAKE: 'seedDough(); seedSauce(1); seedTops(30); g.setStage("BAKE"); for(let i=0;i<200;i++) step(0.03)',
  ROTATE: 'seedDough(); seedSauce(1); seedTops(30); g.setStage("BAKE"); for(let i=0;i<260;i++) step(0.03); g.setStage("ROTATE"); PZ.stages.ROTATE.peelIn=1; PZ.stages.ROTATE.grab=true; for(let i=0;i<20;i++) step(0.02)',
  RETRIEVE: 'seedDough(); seedSauce(1); seedTops(30); g.pizza.startBake(); for(let i=0;i<300;i++) g.pizza.bakeStep(0.05,1,g.flameAngle); g.setStage("RETRIEVE"); PZ.stages.RETRIEVE.peelIn=1; PZ.stages.RETRIEVE.v=-0.15; for(let i=0;i<10;i++) step(0.02)',
  CUT: 'seedDough(); seedSauce(1); seedTops(30); g.pizza.startBake(); for(let i=0;i<300;i++) g.pizza.bakeStep(0.05,1,g.flameAngle); g.setStage("CUT"); g.pizza.cuts=[0,Math.PI/4,Math.PI/2,Math.PI*0.75]; for(let i=0;i<80;i++) step(0.03)',
  DONE: 'seedDough(); seedSauce(1); seedTops(30); g.pizza.startBake(); for(let i=0;i<300;i++) g.pizza.bakeStep(0.05,1,g.flameAngle); g.pizza.cuts=[0,Math.PI/4,Math.PI/2,Math.PI*0.75]; g.setStage("DONE"); for(let i=0;i<90;i++) step(0.03)'
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr,
    hasTouch: true, isMobile: true
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const g = window.PZ.game;
    window.step = (dt) => { g.update(dt); };
    window.seedDough = () => {
      const p = g.pizza; p.reset();
      for (let i = 0; i < p.rad.length; i++) p.rad[i] = 186 + Math.sin(i * 0.7) * 4;
      p.thick = 12; p.flourAmt = 0.5; p.dirty = true;
    };
    window.seedSauce = (k) => {
      const p = g.pizza;
      for (let i = 0; i <= 120; i++) {
        const u = i / 120, a = u * Math.PI * 2 * 3.2, r = u * p.innerR() * 0.95 * 1;
        p.paintSauce(Math.cos(a) * r, Math.sin(a) * r, 46);
      }
    };
    window.seedTops = (n) => {
      const p = g.pizza;
      const items = g.recipe.items;
      for (let i = 0; i < n; i++) {
        const a = i * 2.399, r = Math.sqrt((i + 0.5) / n) * p.innerR() * 0.86;
        const type = i % 3 === 0 ? items[(i / 3 | 0) % items.length] : 'cheese';
        p.addTopping(type, Math.cos(a) * r, Math.sin(a) * r);
      }
      for (const t of p.toppings) t.drop = 0;
    };
  });

  for (const [name, code] of Object.entries(SETUPS)) {
    await page.evaluate((code) => {
      const g = window.PZ.game;
      // eslint-disable-next-line no-eval
      eval(code);
      g.applyCamTarget(true);
      g.idle = 3; g.guideAlpha = 1;
      for (let i = 0; i < 4; i++) g.update(0.016);
    }, code);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
  }
  console.log(which + ': ' + (errs.length ? 'ERRORS\n' + errs.slice(0, 10).join('\n') : 'ok'));
  await browser.close();
})();
