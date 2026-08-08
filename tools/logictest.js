/* 操作の流れを決定論的に検証する。
   描画待ちに左右されないよう、g.update(dt) を手で回し、
   入力は実際のイベント処理と同じ経路（g.queue）へ流し込む。
   node tools/logictest.js [device]                                    */
const { chromium } = require('playwright');
const path = require('path');

const DEVICES = {
  'iphone-p': [390, 844], 'iphone-l': [844, 390],
  'ipad-p': [820, 1180], 'ipad-l': [1180, 820]
};
const which = process.argv[2] || 'iphone-p';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await (await browser.newContext({
    viewport: { width: DEVICES[which][0], height: DEVICES[which][1] }, deviceScaleFactor: 1
  })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('ERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(2500);

  const res = await page.evaluate(() => {
    const g = window.PZ.game, PZ = window.PZ;
    g.paused = true;                       // 描画ループの update を止め、こちらで回す
    let clock = 0;
    const DT = 1 / 60;
    const seen = [];
    let last = '';

    function step(sec) {
      const n = Math.round(sec / DT);
      for (let i = 0; i < n; i++) {
        clock += DT;
        g.update(DT);
        if (g.stageName !== last) { last = g.stageName; seen.push(last + '@' + clock.toFixed(1)); }
      }
    }
    /* 実際のイベント経路へ座標を流す */
    function ev(k, x, y) { g.queue.push({ k: k, x: x, y: y, t: clock }); }
    function drag(pts, holdEach) {
      ev('d', pts[0][0], pts[0][1]); step(DT * 2);
      for (let i = 1; i < pts.length; i++) {
        clock += (holdEach || 0.016);
        ev('m', pts[i][0], pts[i][1]);
        g.update(DT);
      }
      ev('u', pts[pts.length - 1][0], pts[pts.length - 1][1]);
      step(DT * 2);
    }
    function tap(x, y) { ev('d', x, y); step(DT * 3); ev('u', x, y); step(DT * 2); }
    const s3 = (v) => g.toScreen(v.clone ? v.clone() : new THREE.Vector3(v.x, v.y, v.z));
    function pz() {
      const c = g.toScreen(g.pz.pos.clone());
      const e = g.toScreen(g.pz.pos.clone().add(new THREE.Vector3(g.pizza.meanR() * 0.00075, 0, 0)));
      return { x: c.x, y: c.y, r: Math.max(12, Math.abs(e.x - c.x)) };
    }
    const notes = [];

    /* 1) えらぶ */
    step(0.5);
    const card = s3(PZ.stages.CHOOSE.cards[0].position.clone().setY(0.96));
    tap(card.x, card.y);
    notes.push('choose -> ' + g.stageName);

    /* 2) 生地玉 */
    const b = s3({ x: PZ.LAY.boardX, y: 0.95, z: PZ.LAY.boardZ });
    tap(b.x, b.y);
    step(1.2);
    notes.push('place -> ' + g.stageName);

    /* 3) のばす＋まわす */
    for (let round = 0; round < 60 && g.stageName === 'SHAPE'; round++) {
      const c = pz();
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI * 2 + round * 0.6;
        const k = 0.5 + (round % 4) * 0.2;
        pts.push([c.x + Math.cos(a) * c.r * k, c.y + Math.sin(a) * c.r * k * 0.6]);
      }
      drag(pts);
    }
    step(1.0);
    notes.push('shape -> ' + g.stageName + ' r=' + Math.round(g.pizza.meanR()));

    /* 4) とばす */
    for (let k = 0; k < 3 && g.stageName === 'TOSS'; k++) {
      const c = pz();
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push([c.x, c.y - (i / 8) * g.H * 0.4]);
      drag(pts, 0.012);
      step(2.6);
    }
    step(2.5);
    notes.push('toss -> ' + g.stageName);

    /* 5) ソース */
    for (let k = 0; k < 16 && g.stageName === 'SAUCE'; k++) {
      const c = pz();
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const u = i / 48, a = u * Math.PI * 2 * 2.8 + k, rr = u * c.r * 0.92;
        pts.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.6]);
      }
      drag(pts, 0.010);
    }
    step(1.2);
    notes.push('sauce -> ' + g.stageName + ' cover=' + g.pizza.sauceCover.toFixed(2));

    /* 6) ぐざい */
    for (let k = 0; k < 20 && g.stageName === 'TOPPING' && !PZ.stages.TOPPING.peelReady; k++) {
      const bw = PZ.stages.TOPPING.bowls[k % PZ.stages.TOPPING.bowls.length];
      const from = s3(bw.group.position.clone().setY(bw.group.position.y + 0.05));
      const c = pz();
      const a = k * 1.9, rr = (0.3 + (k % 3) * 0.2) * c.r;
      const to = [c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.6];
      const pts = [[from.x, from.y]];
      for (let i = 1; i <= 10; i++) pts.push([from.x + (to[0] - from.x) * i / 10, from.y + (to[1] - from.y) * i / 10]);
      drag(pts);
      step(0.1);
    }
    notes.push('topping -> tops=' + g.pizza.toppings.length + ' ready=' + PZ.stages.TOPPING.peelReady);

    /* 7) ピールへ */
    {
      const c = pz();
      const p = PZ.pathAt(-1);
      const to = s3(p);
      const pts = [[c.x, c.y]];
      for (let i = 1; i <= 16; i++) pts.push([c.x + (to.x - c.x) * i / 16, c.y + (to.y - c.y) * i / 16]);
      drag(pts);
      step(1.5);
    }
    notes.push('toPeel -> ' + g.stageName);

    /* 8) 窯の奥へスッ */
    if (g.stageName === 'INSERT') {
      const p0 = s3(PZ.pathAt(-1)), p1 = s3(PZ.pathAt(0.55));
      const pts = [[p0.x, p0.y]];
      for (let i = 1; i <= 24; i++) pts.push([p0.x + (p1.x - p0.x) * i / 24, p0.y + (p1.y - p0.y) * i / 24]);
      drag(pts, 0.018);
      step(2.0);
    }
    notes.push('insert -> ' + g.stageName + ' v=' + g.pz.v.toFixed(2));

    /* 9-10) 焼く → くるっ */
    for (let i = 0; i < 40 && g.stageName === 'BAKE'; i++) step(0.5);
    if (g.stageName === 'ROTATE') {
      for (let round = 0; round < 10 && g.stageName === 'ROTATE'; round++) {
        const c = pz();
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2 * 1.2;
          pts.push([c.x + Math.cos(a) * c.r * 0.85, c.y + Math.sin(a) * c.r * 0.45]);
        }
        drag(pts, 0.014);
        step(0.3);
      }
    }
    notes.push('rotate -> ' + g.stageName + ' bake=' + g.pizza.bake.toFixed(2));

    /* 11) 引き出す */
    for (let i = 0; i < 40 && g.stageName === 'BAKE2'; i++) step(0.5);
    if (g.stageName === 'RETRIEVE') {
      const a0 = s3(PZ.pathAt(g.vBake));
      ev('d', a0.x, a0.y); step(0.6);
      const a1 = s3(PZ.pathAt(-0.9));
      for (let i = 1; i <= 22; i++) {
        clock += 0.018;
        ev('m', a0.x + (a1.x - a0.x) * i / 22, a0.y + (a1.y - a0.y) * i / 22);
        g.update(DT);
      }
      ev('u', a1.x, a1.y);
      step(2.0);
    }
    notes.push('retrieve -> ' + g.stageName + ' bake=' + g.pizza.bake.toFixed(2));

    /* 12) カット */
    for (let k = 0; k < 10 && g.stageName === 'CUT' && PZ.stages.CUT.cutN < 4; k++) {
      const c = pz();
      const a = PZ.stages.CUT.cutN * Math.PI / 4;
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = -1 + (i / 12) * 2;
        pts.push([c.x + Math.cos(a) * c.r * 1.2 * t, c.y + Math.sin(a) * c.r * 0.7 * t]);
      }
      drag(pts);
      step(0.3);
    }
    notes.push('cut -> n=' + PZ.stages.CUT.cutN + ' slices=' + g.pizza.sliceCount);
    /* スライスを持ち上げる */
    {
      const c = pz();
      ev('d', c.x + c.r * 0.5, c.y - c.r * 0.25); step(0.4);
      ev('u', c.x + c.r * 0.5, c.y - c.r * 0.25); step(2.0);
    }
    for (let i = 0; i < 20 && g.stageName === 'CUT'; i++) step(0.4);
    notes.push('done -> ' + g.stageName);

    return { seen: seen, notes: notes, stage: g.stageName, bake: +g.pizza.bake.toFixed(2), slices: g.pizza.sliceCount };
  });

  console.log('[' + which + ']');
  console.log(res.notes.join('\n'));
  console.log('たどった流れ: ' + res.seen.join(' -> '));
  const ok = res.stage === 'DONE';
  console.log(ok ? 'OK: 操作だけで一周した' : 'NG: ' + res.stage + ' で止まった');
  if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 8).join('\n'));
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
