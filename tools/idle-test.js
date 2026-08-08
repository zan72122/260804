/* 「まったく触らなくても職人がやってみせて先へ進む」ことを確認する
   （4歳児が詰まらないための保険が本当に効くか）                       */
const { chromium } = require('playwright');
const path = require('path');

const D = { 'iphone-p': [390, 844], 'iphone-l': [844, 390], 'ipad-p': [820, 1180], 'ipad-l': [1180, 820] };
const which = process.argv[2] || 'iphone-p';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await (await browser.newContext({
    viewport: { width: D[which][0], height: D[which][1] }, deviceScaleFactor: 1, hasTouch: true, isMobile: true
  })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);

  const res = await page.evaluate(() => {
    const g = window.PZ.game;
    const seen = [];
    let last = '';
    // レシピだけ選んで、あとは一切触らない
    g.recipe = window.PZ.RECIPES[0];
    g.setStage('DOUGH');
    for (let i = 0; i < 8000; i++) {          // 400 秒ぶん
      g.update(0.05);
      if (g.stageName !== last) { last = g.stageName; seen.push({ s: last, t: +(i * 0.05).toFixed(1) }); }
      if (last === 'DONE' && i * 0.05 > 5) break;
    }
    return { seen: seen, bake: +g.pizza.bake.toFixed(2), sauce: +g.pizza.sauceCover.toFixed(2), tops: g.pizza.toppings.length, cuts: g.pizza.cuts.length };
  });

  console.log('[' + which + '] 無操作でたどった流れ:');
  console.log(res.seen.map(x => x.t + 's ' + x.s).join('  ->  '));
  console.log('sauce=' + res.sauce + ' toppings=' + res.tops + ' bake=' + res.bake + ' cuts=' + res.cuts);
  const ok = res.seen.some(x => x.s === 'DONE');
  console.log(ok ? 'OK: 無操作でも一周した' : 'NG: 途中で止まった');
  if (errs.length) console.log('ERRORS: ' + errs.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
