/* 動きを数値で観察する。
   静止画では見えない「重さ・接触・速度の不連続」を探すための計測器。
   g.update(dt) を固定ステップで回し、毎フレームの位置・速度・加速度を記録して、
   重力加速度の実効値、接触の隙間、瞬間的な跳び、音と接触のずれを出す。
   node tools/motion.js [device]                                       */
const { chromium } = require('playwright');
const path = require('path');

const D = { 'iphone-p': [390, 844], 'iphone-l': [844, 390], 'ipad-p': [820, 1180], 'ipad-l': [1180, 820] };
const which = process.argv[2] || 'iphone-l';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await (await browser.newContext({
    viewport: { width: D[which][0], height: D[which][1] }, deviceScaleFactor: 1
  })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('ERR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(2500);

  const out = await page.evaluate(() => {
    const g = window.PZ.game, PZ = window.PZ, U = PZ.util;
    g.paused = true;
    const DT = 1 / 120;                 // 細かく刻んで加速度まで見る
    const R = {};

    /* 音が鳴った時刻を記録する（実装を差し替えず、包んで覗く） */
    const sndLog = [];
    let clock = 0;
    for (const k in PZ.snd) {
      if (typeof PZ.snd[k] !== 'function') continue;
      if (/^(fireLevel|updateMusic|noise|tone|unlock|ctx)$/.test(k)) continue;
      const orig = PZ.snd[k];
      PZ.snd[k] = function () { sndLog.push({ n: k, t: +clock.toFixed(4) }); return orig.apply(this, arguments); };
    }

    function step(n, sample) {
      for (let i = 0; i < n; i++) {
        clock += DT;
        g.update(DT);
        if (sample) sample(clock);
      }
    }

    /* --- ピザの形の最下点（接触の隙間を測るのに要る） --- */
    g.scene.updateMatrixWorld(true);
    (function () {
      const p = g.pizza;
      p.reset();
      for (let i = 0; i < p.rad.length; i++) p.rad[i] = 182;
      p.thick = 8; p.dirty = true;
      p.sync();
      let geo = null;
      p.doughGroup.traverse(function (o) { if (o.isMesh && !geo) geo = o.geometry; });
      let minY = Infinity, maxY = -Infinity;
      if (geo) {
        const a = geo.attributes.position;
        for (let i = 0; i < a.count; i++) { minY = Math.min(minY, a.getY(i)); maxY = Math.max(maxY, a.getY(i)); }
      }
      R.doughLocalMinY = +minY.toFixed(5);
      R.doughLocalMaxY = +maxY.toFixed(5);
    })();

    /* ================= 1) 生地を空中へ投げる：実効重力 ================= */
    (function () {
      g.recipe = PZ.RECIPES[0];
      g.setStage('TOSS');
      const p = g.pizza;
      for (let i = 0; i < p.rad.length; i++) p.rad[i] = 182;
      p.dirty = true;
      const runs = [];
      for (const power of [0.15, 0.55, 1.0]) {
        PZ.stages.TOSS.flight = null;
        PZ.stages.TOSS.count = 0;
        PZ.stages.TOSS.launch(g, power);
        const ys = [], ts = [];
        let n = 0;
        while (PZ.stages.TOSS.flight && n < 1200) {
          clock += DT; g.update(DT); n++;
          ys.push(g.pz.pos.y); ts.push(n * DT);
        }
        const base = ys.length ? ys[0] : 0;
        let apex = -Infinity, apexT = 0;
        for (let i = 0; i < ys.length; i++) if (ys[i] > apex) { apex = ys[i]; apexT = ts[i]; }
        const H = apex - base;
        const dur = ts.length ? ts[ts.length - 1] : 0;
        // 放物運動なら H = g*dur^2/8
        runs.push({
          power: power, apexH: +H.toFixed(4), dur: +dur.toFixed(3),
          impliedG: +(8 * H / (dur * dur)).toFixed(2),
          realDurForH: +(2 * Math.sqrt(2 * H / 9.81)).toFixed(3)
        });
      }
      R.toss = runs;
    })();

    /* ================= 2) 生地玉を置く：落下の実効重力 ================= */
    (function () {
      g.setStage('DOUGH');
      PZ.stages.DOUGH.go(g);
      const ys = []; let n = 0;
      while (PZ.stages.DOUGH.fly && n < 600) { clock += DT; g.update(DT); n++; ys.push(g.pz.pos.y); }
      const base = ys[ys.length - 1] || 0;
      let apex = -Infinity;
      for (const y of ys) apex = Math.max(apex, y);
      const dur = n * DT;
      R.doughPlace = { apexH: +(apex - base).toFixed(4), dur: +dur.toFixed(3), impliedG: +(8 * (apex - base) / (dur * dur)).toFixed(2) };
    })();

    /* ============ 3) 看板動作：ピールとピザの接触・速度・消え方 ============ */
    (function () {
      g.setStage('INSERT');
      const st = PZ.stages.INSERT;
      st.v = -1;
      const rows = [];
      sndLog.length = 0;
      const t0 = clock;
      st.doLaunch(g);
      for (let i = 0; i < 150; i++) {
        clock += DT; g.update(DT);
        const peel = PZ.scene3.peel;
        rows.push({
          t: +(clock - t0).toFixed(4),
          pzY: +g.pz.pos.y.toFixed(5), pzZ: +g.pz.pos.z.toFixed(4),
          peelY: +peel.position.y.toFixed(5), peelZ: +peel.position.z.toFixed(4),
          peelVis: peel.visible, peelOpacity: 1,
          gap: +(g.pz.pos.y - peel.position.y).toFixed(5)
        });
      }
      R.insert = {
        snd: sndLog.slice(),
        // ピザがピールから離れる瞬間
        contactGapWhileOnPeel: rows.slice(0, 24).map(r => r.gap).filter((v, i, a) => a.indexOf(v) === i),
        peelVanishAt: (function () {
          for (let i = 1; i < rows.length; i++) if (rows[i - 1].peelVis && !rows[i].peelVis) return rows[i].t;
          return null;
        })(),
        peelZAtVanish: (function () {
          for (let i = 1; i < rows.length; i++) if (rows[i - 1].peelVis && !rows[i].peelVis) return rows[i - 1].peelZ;
          return null;
        })(),
        peelSpeedAtVanish: (function () {
          for (let i = 2; i < rows.length; i++) if (rows[i - 1].peelVis && !rows[i].peelVis) return +((rows[i - 1].peelZ - rows[i - 2].peelZ) / DT).toFixed(2);
          return null;
        })(),
        pizzaLandT: (function () {
          for (let i = 1; i < rows.length; i++) if (rows[i].gap !== rows[i - 1].gap && rows[i].t > 0.05) return rows[i].t;
          return null;
        })(),
        // ピザの前進速度の推移（急停止していないか）
        pzSpeed: rows.filter((r, i) => i % 6 === 0 && i > 0).map((r, i, a) =>
          i === 0 ? 0 : +((r.pzZ - a[i - 1].pzZ) / (DT * 6)).toFixed(2))
      };
    })();

    /* ====== 3b) 押しこみの強さと、止まる位置の因果関係 ====== */
    (function () {
      const runs = [];
      for (const push of [0.9, 1.6, 2.4, 3.2]) {
        g.setStage('INSERT');
        const st = PZ.stages.INSERT;
        st.v = -0.15; st.vSpeed = push;
        st.doLaunch(g);
        let peak = 0, n = 0;
        clock += DT; g.update(DT);              // 1 フレーム進めてから計測（前状態の残りを除く）
        let prevZ = g.pz.pos.z;
        while (g.stageName === 'INSERT' && n < 900) {
          clock += DT; g.update(DT); n++;
          const sp = Math.abs((g.pz.pos.z - prevZ) / DT); prevZ = g.pz.pos.z;
          peak = Math.max(peak, sp);
        }
        runs.push({
          push: push, restV: +g.vBake.toFixed(3),
          restZ: +PZ.pathAt(g.vBake).z.toFixed(3),
          peakSpeed_mps: +peak.toFixed(2),
          travelTime: +(n * DT).toFixed(2)
        });
        g.setStage('INSERT');
      }
      R.pushCausality = runs;
    })();

    /* ============ 4) 小道具は台に接地しているか ============ */
    (function () {
      g.scene.updateMatrixWorld(true);
      const L = PZ.LAY;
      const list = [];
      const ray = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      function probe(name, obj) {
        if (!obj) return;
        const box = new THREE.Box3().setFromObject(obj);
        list.push({ name: name, minY: +box.min.y.toFixed(4), maxY: +box.max.y.toFixed(4) });
      }
      probe('board', PZ.scene3.board);
      probe('peelBlade', PZ.scene3.peel.children[0]);
      const st = PZ.stages.TOPPING;
      if (st && st.bowls) for (let i = 0; i < st.bowls.length; i++) probe('bowl' + i, st.bowls[i].group);
      R.counterY = L.counterY;
      R.props = list;
    })();

    /* ============ 5) カメラの動き（ステージ切替時） ============ */
    (function () {
      g.setStage('TOPPING'); g.setCam('topping', true);
      const path = [];
      g.setStage('INSERT');
      for (let i = 0; i < 180; i++) {
        clock += DT; g.update(DT);
        path.push([+g.camera.position.x.toFixed(4), +g.camera.position.y.toFixed(4), +g.camera.position.z.toFixed(4)]);
      }
      const sp = [];
      for (let i = 1; i < path.length; i++) {
        sp.push(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]) / DT);
      }
      R.camMove = {
        totalDist: +path.reduce((s, p, i) => i ? s + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1], p[2] - path[i - 1][2]) : 0, 0).toFixed(3),
        peakSpeed: +Math.max.apply(null, sp).toFixed(3),
        speedAtStart: +sp[0].toFixed(3),
        speedAt10: +sp[10].toFixed(3),
        settle95: (function () {
          const tot = sp.reduce((a, b) => a + b, 0);
          let acc = 0;
          for (let i = 0; i < sp.length; i++) { acc += sp[i]; if (acc > tot * 0.95) return +(i * DT).toFixed(2); }
          return null;
        })()
      };
    })();

    return R;
  });

  console.log(JSON.stringify(out, null, 1));
  if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
  await browser.close();
})();
