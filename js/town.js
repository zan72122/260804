/* にじいろタウン - 町の世界：背景・地区・住民・リアクション */
window.NT = window.NT || {};
(function () {
  const U = NT.U;

  const WORLD = { w: 2000, h: 1250, horizon: 560 };

  const SITES = {
    house: {
      id: 'house', name: 'おうちひろば',
      x: 450, groundY: 940,
      hit: { x: 450, y: 780, r: 280 },
      drawRect: { x: 140, y: 470, w: 630, h: 440 },
      viewRect: { x: 90, y: 380, w: 740, h: 640 }
    },
    cake: {
      id: 'cake', name: 'おかしやさん',
      x: 1550, groundY: 955, counterY: 845,
      hit: { x: 1550, y: 780, r: 280 },
      drawRect: { x: 1290, y: 595, w: 520, h: 235 },
      viewRect: { x: 1180, y: 440, w: 760, h: 590 }
    },
    garden: {
      id: 'garden', name: 'にじいろかだん',
      x: 1000, groundY: 1075,
      hit: { x: 1000, y: 990, r: 250 },
      drawRect: { x: 680, y: 800, w: 640, h: 280 },
      viewRect: { x: 640, y: 730, w: 720, h: 420 }
    }
  };

  const T = {
    WORLD, SITES,
    works: { garden: null, house: null, cake: null }, // {record, art, bake}
    residents: [],
    butterflies: [],
    birds: [],
    scripts: [],
    ambientTimer: 12,
    tutorialTarget: null
  };

  /* ============ アートワークの組み立てとベイク ============ */
  T.buildArtwork = function (siteId, record) {
    const site = SITES[siteId];
    const art = NT.generators[siteId].build(record, site);
    art.siteId = siteId;
    art.record = record;
    return art;
  };

  T.bakeArtwork = function (art) {
    const site = SITES[art.siteId];
    const pad = 130;
    const bx = site.drawRect.x - pad, by = site.drawRect.y - pad;
    const bw = site.drawRect.w + pad * 2;
    const bh = (site.groundY + 60) - by;
    const scale = Math.min(1.6, (window.devicePixelRatio || 1) >= 2 ? 1.6 : 1.25);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(bw * scale);
    cv.height = Math.ceil(bh * scale);
    const c = cv.getContext('2d');
    c.scale(scale, scale);
    c.translate(-bx, -by);
    for (const p of art.parts) {
      if (!p.dynamic) p.draw(c, 1, 0);
    }
    return { canvas: cv, x: bx, y: by, w: bw, h: bh };
  };

  T.setArtwork = function (siteId, record, persist) {
    const art = T.buildArtwork(siteId, record);
    const bake = T.bakeArtwork(art);
    T.works[siteId] = { record, art, bake };
    if (persist !== false) NT.save.setWork(siteId, record);
    if (siteId === 'garden') {
      // 蝶を花に集める
      T.butterflies = T.butterflies.filter(b => !b.gardenBound);
      const n = NT.U.reducedMotion ? 2 : art.meta.butterflies;
      for (let i = 0; i < n; i++) {
        const b = new NT.chars.Butterfly(
          art.meta.heroPos.x + (Math.random() - 0.5) * 200,
          art.meta.heroPos.y - 60 - Math.random() * 80);
        b.setAnchor(art.meta.heroPos.x, art.meta.heroPos.y - 20);
        b.gardenBound = true;
        T.butterflies.push(b);
      }
    }
  };

  T.drawArtwork = function (ctx, siteId, t) {
    const w = T.works[siteId];
    if (!w) return;
    ctx.drawImage(w.bake.canvas, w.bake.x, w.bake.y, w.bake.w, w.bake.h);
    for (const p of w.art.parts) {
      if (p.dynamic) p.draw(ctx, 1, t);
    }
  };

  /* ============ 初期化 ============ */
  T.init = function (saveData) {
    const R = NT.chars.Resident;
    T.residents = [
      new R('guide', 950, 780, 0, { wander: { points: [{ x: 900, y: 790 }, { x: 1150, y: 820 }, { x: 700, y: 850 }] } }),
      new R('clerk', 1435, 950, 1, { hat: 'clerk', wander: { points: [{ x: 1420, y: 950 }, { x: 1470, y: 960 }] }, speed: 60 }),
      new R('lav', 550, 1000, 2, { wander: { points: [{ x: 480, y: 1010 }, { x: 800, y: 950 }, { x: 1150, y: 990 }] } }),
      new R('cream', 1250, 1080, 3, { wander: { points: [{ x: 1250, y: 1090 }, { x: 850, y: 1130 }, { x: 1500, y: 1060 }] } })
    ];
    T.birds = [new NT.chars.Bird(WORLD.w, 200), new NT.chars.Bird(WORLD.w, 300)];
    T.butterflies = [];
    T.scripts = [];
    T.works = { garden: null, house: null, cake: null };
    for (const id of ['garden', 'house', 'cake']) {
      const rec = NT.save.getWork(id);
      if (rec) T.setArtwork(id, rec, false);
    }
  };

  T.reset = function () {
    NT.save.clear();
    T.init(NT.save.data);
  };

  /* ============ ヒットテスト ============ */
  T.siteAt = function (wx, wy) {
    for (const id in SITES) {
      const s = SITES[id];
      if (U.dist(wx, wy, s.hit.x, s.hit.y) < s.hit.r) return s;
    }
    return null;
  };

  /* ============ スクリプト（住民の演技） ============ */
  function goStep(r, x, y, speed) {
    let started = false;
    return dt => {
      if (!started) { r.scripted = true; if (speed) r.speed = speed; r.goTo(x, y); started = true; }
      return !r.moving;
    };
  }
  function waitStep(sec) { let e = 0; return dt => { e += dt; return e >= sec; }; }
  function doStep(fn) { return () => { fn(); return true; }; }
  function moodStep(r, mood) { return () => { r.mood = mood; r.moodT = 0; return true; }; }
  function tweenStep(dur, fn) { let e = 0; return dt => { e += dt; fn(Math.min(1, e / dur)); return e >= dur; }; }

  T.runScript = function (steps) { T.scripts.push({ steps, i: 0 }); };

  function updateScripts(dt) {
    for (let i = T.scripts.length - 1; i >= 0; i--) {
      const sc = T.scripts[i];
      while (sc.i < sc.steps.length) {
        const done = sc.steps[sc.i](dt);
        if (done) sc.i++;
        else break;
      }
      if (sc.i >= sc.steps.length) T.scripts.splice(i, 1);
    }
  }

  function freeWanderer(nearX) {
    const cands = T.residents.filter(r => !r.scripted && r.id !== 'clerk');
    if (!cands.length) return null;
    cands.sort((a, b) => Math.abs(a.x - nearX) - Math.abs(b.x - nearX));
    return cands[0];
  }
  function release(r) { return doStep(() => { r.scripted = false; r.mood = 'normal'; }); }

  /* ============ 完成リアクション ============ */
  T.reaction = function (siteId) {
    const w = T.works[siteId];
    if (!w) return;
    const meta = w.art.meta;
    const site = SITES[siteId];

    if (siteId === 'garden') {
      const r = freeWanderer(site.x);
      if (!r) return;
      T.runScript([
        goStep(r, meta.reactPos.x, meta.reactPos.y, 130),
        moodStep(r, 'point'),
        doStep(() => { NT.audio.cheer(); }),
        waitStep(0.9),
        moodStep(r, 'joy'),
        doStep(() => {
          for (let i = 0; i < 5; i++) NT.fx.heart(meta.heroPos.x + (Math.random() - .5) * 60, meta.heroPos.y - 30);
          NT.fx.sparkle(meta.heroPos.x, meta.heroPos.y, { n: 8 });
        }),
        waitStep(1.6),
        release(r)
      ]);
    } else if (siteId === 'house') {
      const r = freeWanderer(site.x);
      const st = w.art.meta.state;
      if (!r) return;
      T.runScript([
        goStep(r, meta.doorPos.x + 60, meta.doorPos.y + 26, 130),
        moodStep(r, 'joy'),
        doStep(() => NT.audio.cheer()),
        waitStep(0.8),
        moodStep(r, 'normal'),
        goStep(r, meta.doorPos.x, meta.doorPos.y + 8, 80),
        doStep(() => NT.audio.door()),
        tweenStep(0.4, k => { st.doorOpen = k; }),
        tweenStep(0.35, k => { r.s = 1 - k * 0.5; }),
        doStep(() => { r.visible = false; r.s = 1; }),
        tweenStep(0.4, k => { st.doorOpen = 1 - k; }),
        doStep(() => {
          st.lit = true;
          if (meta.window) NT.fx.glow(meta.window.x, meta.window.y, { r: 30, max: 1.2, color: 'rgba(255,220,130,0.8)' });
        }),
        waitStep(4.5),
        doStep(() => NT.audio.door()),
        tweenStep(0.4, k => { st.doorOpen = k; }),
        doStep(() => { r.visible = true; r.x = meta.doorPos.x; r.y = meta.doorPos.y + 8; }),
        tweenStep(0.35, k => { r.s = 0.5 + k * 0.5; }),
        tweenStep(0.4, k => { st.doorOpen = 1 - k; }),
        doStep(() => { st.lit = false; }),
        release(r)
      ]);
    } else if (siteId === 'cake') {
      const clerk = T.residents.find(r => r.id === 'clerk');
      const cust = freeWanderer(site.x);
      if (clerk) {
        T.runScript([
          doStep(() => { clerk.scripted = true; }),
          moodStep(clerk, 'joy'),
          doStep(() => NT.audio.cheer()),
          waitStep(1.4),
          doStep(() => { clerk.scripted = false; clerk.mood = 'normal'; })
        ]);
      }
      if (cust) {
        T.runScript([
          goStep(cust, meta.reactPos.x, meta.reactPos.y, 140),
          moodStep(cust, 'point'),
          waitStep(0.7),
          goStep(cust, meta.munchPos.x, meta.munchPos.y, 90),
          moodStep(cust, 'eat'),
          doStep(() => NT.audio.munch()),
          tweenStep(0.9, k => {
            if (Math.random() < 0.12) NT.fx.crumb(meta.munchPos.x + 20, meta.munchPos.y - 40);
          }),
          moodStep(cust, 'joy'),
          doStep(() => {
            NT.audio.cheer();
            for (let i = 0; i < 4; i++) NT.fx.heart(meta.munchPos.x, meta.munchPos.y - 60);
          }),
          waitStep(1.5),
          release(cust)
        ]);
      }
    }
  };

  // 制作中、住民がそばで見守る
  T.summonWatcher = function (siteId) {
    const s = SITES[siteId];
    const r = freeWanderer(s.x);
    if (!r) return;
    const wx = siteId === 'cake' ? s.x - 340 : s.x + (siteId === 'house' ? 340 : 390);
    T.runScript([
      goStep(r, wx, s.groundY + 26, 115),
      doStep(() => {
        r.scripted = false;
        r.mood = 'normal';
        r.wanderWait = 14 + Math.random() * 6;
        r.dir = wx < s.x ? 1 : -1;
      })
    ]);
  };

  // 町の環境イベント：家への訪問・お店の客・鳥
  function ambient(dt) {
    T.ambientTimer -= dt;
    if (T.ambientTimer > 0) return;
    T.ambientTimer = 14 + Math.random() * 14;
    const opts = [];
    if (T.works.house) opts.push('house');
    if (T.works.cake) opts.push('cake');
    if (T.works.garden) opts.push('gardenVisit');
    if (!opts.length) return;
    const pick = opts[Math.floor(Math.random() * opts.length)];
    if (pick === 'gardenVisit') {
      const meta = T.works.garden.art.meta;
      const r = freeWanderer(SITES.garden.x);
      if (r) T.runScript([
        goStep(r, meta.reactPos.x, meta.reactPos.y, 100),
        moodStep(r, 'joy'),
        waitStep(1.4),
        release(r)
      ]);
    } else {
      T.reaction(pick);
    }
  }

  /* ============ 更新 ============ */
  T.update = function (dt, t, allowAmbient) {
    for (const r of T.residents) r.update(dt, t);
    for (const b of T.butterflies) b.update(dt, t);
    for (const b of T.birds) b.update(dt, t);
    updateScripts(dt);
    if (allowAmbient) ambient(dt);
  };

  /* ============ 描画 ============ */

  // 空（スクリーン空間で main が呼ぶ）
  T.drawSky = function (ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fd4ff');
    g.addColorStop(0.42, '#c3ebff');
    g.addColorStop(0.66, '#ffeef8');
    g.addColorStop(1, '#ffe3f0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 太陽のやわらかな光
    const sg = ctx.createRadialGradient(W * 0.78, H * 0.16, 10, W * 0.78, H * 0.16, H * 0.5);
    sg.addColorStop(0, 'rgba(255,250,220,0.9)');
    sg.addColorStop(0.25, 'rgba(255,244,200,0.35)');
    sg.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
  };

  /* ---- 静的レイヤーのベイク（毎フレームの手続き描画を避ける） ---- */
  let farCache = null, groundCache = null;

  function bakeLayer(x, y, w, h, scale, drawFn) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * scale);
    cv.height = Math.ceil(h * scale);
    const c = cv.getContext('2d');
    c.scale(scale, scale);
    c.translate(-x, -y);
    drawFn(c);
    return { canvas: cv, x, y, w, h };
  }
  function drawLayer(ctx, L) {
    ctx.drawImage(L.canvas, L.x, L.y, L.w, L.h);
  }

  // 雲＆遠景の丘（パララックス層・ワールド座標）
  T.drawFar = function (ctx, t) {
    if (!farCache) farCache = bakeLayer(-650, -60, 3300, 730, 0.7, drawFarStatic);
    drawClouds(ctx, t);
    drawLayer(ctx, farCache);
  };

  function drawClouds(ctx, t) {
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 460 + t * 9 + i * 97) % (WORLD.w + 700)) - 350;
      const cy = 80 + (i % 3) * 70;
      const s = 0.75 + (i % 3) * 0.2;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff';
      for (const [ox, oy, r] of [[0, 0, 46], [38, 8, 34], [-40, 10, 32], [8, -18, 34]]) {
        ctx.beginPath();
        ctx.arc(cx + ox * s, cy + oy * s, r * s, 0, U.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#bcd8f0';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 22 * s, 70 * s, 12 * s, 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawFarStatic(ctx) {
    ctx.save();
    // 丘（2層）
    const h1 = ctx.createLinearGradient(0, WORLD.horizon - 200, 0, WORLD.horizon + 40);
    h1.addColorStop(0, '#cdb3ee');
    h1.addColorStop(1, '#b9a3e0');
    ctx.fillStyle = h1;
    ctx.beginPath();
    ctx.moveTo(-600, WORLD.horizon + 40);
    for (let x = -600; x <= WORLD.w + 600; x += 50) {
      ctx.lineTo(x, WORLD.horizon - 60 - Math.sin(x * 0.0035) * 70 - Math.sin(x * 0.0011) * 60);
    }
    ctx.lineTo(WORLD.w + 600, WORLD.horizon + 40);
    ctx.closePath();
    ctx.fill();
    const h2 = ctx.createLinearGradient(0, WORLD.horizon - 120, 0, WORLD.horizon + 60);
    h2.addColorStop(0, '#a8dcc8');
    h2.addColorStop(1, '#8fcbb4');
    ctx.fillStyle = h2;
    ctx.beginPath();
    ctx.moveTo(-600, WORLD.horizon + 60);
    for (let x = -600; x <= WORLD.w + 600; x += 50) {
      ctx.lineTo(x, WORLD.horizon - 10 - Math.sin(x * 0.005 + 2) * 46 - Math.cos(x * 0.0016) * 30);
    }
    ctx.lineTo(WORLD.w + 600, WORLD.horizon + 60);
    ctx.closePath();
    ctx.fill();
    // 遠くの木
    for (let i = 0; i < 7; i++) {
      const x = 130 + i * 300, y = WORLD.horizon - 8 - Math.sin(x * 0.005 + 2) * 40;
      ctx.fillStyle = i % 2 ? '#7fbf9e' : '#8fcba8';
      ctx.beginPath(); ctx.arc(x, y - 22, 20, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#a58358';
      ctx.fillRect(x - 3, y - 8, 6, 14);
    }
    // 町の上にかかる淡い虹
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.lineCap = 'round';
    const RB = ['#ff9ecb', '#ffd48a', '#fff59b', '#a9e8b8', '#9fd8ff', '#cdb3ff'];
    RB.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(1000, WORLD.horizon + 210, 800 - i * 22, Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();
    });
    ctx.restore();
    ctx.restore();
  };

  // 地面と道
  function drawGround(ctx, t) {
    if (!groundCache) groundCache = bakeLayer(-200, WORLD.horizon, 2400, 1240, 0.85, drawGroundStatic);
    // ベイク範囲より下は同色で埋める（縦画面の深い手前）
    ctx.fillStyle = '#8fce84';
    ctx.fillRect(-2200, WORLD.horizon + 1200, WORLD.w + 4400, 3000);
    ctx.fillStyle = '#a8dc96';
    ctx.fillRect(-2200, WORLD.horizon, WORLD.w + 4400, 1200);
    drawLayer(ctx, groundCache);
  }

  function drawGroundStatic(ctx) {
    const g = ctx.createLinearGradient(0, WORLD.horizon, 0, WORLD.h);
    g.addColorStop(0, '#bfe6a8');
    g.addColorStop(0.5, '#a8dc96');
    g.addColorStop(1, '#8fce84');
    ctx.fillStyle = g;
    ctx.fillRect(-2200, WORLD.horizon, WORLD.w + 4400, 4200);
    // 草のむらむら
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#6ab868';
    for (let i = 0; i < 26; i++) {
      const x = (i * 397) % WORLD.w, y = WORLD.horizon + 80 + ((i * 173) % (WORLD.h - WORLD.horizon - 120));
      ctx.beginPath();
      ctx.ellipse(x, y, 60 + (i % 4) * 30, 16, 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 道：広場から各地区へ
    ctx.strokeStyle = '#f2e2c8';
    ctx.lineCap = 'round';
    ctx.lineWidth = 64;
    const paths = [
      [[1000, 760], [800, 850], [560, 900]],
      [[1000, 760], [1250, 850], [1480, 910]],
      [[1000, 760], [1000, 870], [1000, 980]]
    ];
    for (const p of paths) {
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.quadraticCurveTo(p[1][0], p[1][1], p[2][0], p[2][1]);
      ctx.stroke();
    }
    ctx.strokeStyle = '#faf0dc';
    ctx.lineWidth = 46;
    for (const p of paths) {
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.quadraticCurveTo(p[1][0], p[1][1], p[2][0], p[2][1]);
      ctx.stroke();
    }
    // 石畳のヒント
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#e0cfae';
    for (const p of paths) {
      for (let k = 0.15; k < 1; k += 0.18) {
        const x = (1 - k) * (1 - k) * p[0][0] + 2 * (1 - k) * k * p[1][0] + k * k * p[2][0];
        const y = (1 - k) * (1 - k) * p[0][1] + 2 * (1 - k) * k * p[1][1] + k * k * p[2][1];
        ctx.beginPath();
        ctx.ellipse(x, y, 12, 5, 0, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 広場
    const pg = ctx.createRadialGradient(1000, 760, 20, 1000, 760, 190);
    pg.addColorStop(0, '#fdf4e2');
    pg.addColorStop(1, '#f2e2c8');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(1000, 760, 190, 92, 0, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = '#e0cfae';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(1000, 760, 160, 74, 0, 0, U.TAU);
    ctx.stroke();

    // 手前の草原のデコ（縦画面の余白をにぎやかに）
    for (const [x, y, hue] of [
      [180, 1230, 333], [420, 1330, 45], [760, 1260, 268], [1120, 1350, 195],
      [1460, 1270, 333], [1750, 1340, 45], [300, 1520, 268], [900, 1560, 333],
      [1550, 1520, 195], [90, 1400, 45], [1930, 1210, 268]
    ]) {
      // 小さな花のかたまり
      for (let i = 0; i < 3; i++) {
        const fx = x + (i - 1) * 26, fy = y + (i % 2) * 14;
        for (let p = 0; p < 5; p++) {
          const a = p / 5 * U.TAU;
          ctx.fillStyle = `hsl(${hue},88%,78%)`;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 4.4, 0, U.TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#fff6c8';
        ctx.beginPath(); ctx.arc(fx, fy, 3.6, 0, U.TAU); ctx.fill();
      }
    }
    for (const [x, y] of [[600, 1460], [1300, 1440], [1850, 1580], [150, 1640]]) {
      const bg = ctx.createRadialGradient(x - 12, y - 26, 4, x, y - 14, 44);
      bg.addColorStop(0, '#b8e8a0');
      bg.addColorStop(1, '#7fbf76');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(x, y - 12, 44, 26, 0, 0, U.TAU);
      ctx.fill();
    }
  }

  // 噴水（水がヒーローマテリアル）
  function drawFountain(ctx, t) {
    const x = 1000, y = 745;
    ctx.save();
    // 池
    const pool = ctx.createRadialGradient(x, y + 22, 8, x, y + 22, 92);
    pool.addColorStop(0, '#bfeffc');
    pool.addColorStop(0.7, '#8fd8f0');
    pool.addColorStop(1, '#6fc0e0');
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.ellipse(x, y + 24, 100, 34, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.ellipse(x, y + 22, 88, 27, 0, 0, U.TAU); ctx.fill();
    // 波紋
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.5 + i * 0.5) % 1);
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x, y + 22, 20 + k * 60, 6 + k * 18, 0, 0, U.TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 台座
    const ped = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
    ped.addColorStop(0, '#f5ead2');
    ped.addColorStop(1, '#d8c8a8');
    ctx.fillStyle = ped;
    ctx.fillRect(x - 13, y - 44, 26, 62);
    ctx.beginPath(); ctx.ellipse(x, y - 44, 30, 10, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.ellipse(x, y - 40, 24, 7, 0, 0, U.TAU); ctx.fill();
    // 噴き上げる水
    for (let j = -1; j <= 1; j++) {
      ctx.strokeStyle = 'rgba(190,240,255,0.85)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - 48);
      ctx.quadraticCurveTo(x + j * 34, y - 96, x + j * 52, y + 12);
      ctx.stroke();
      // 水滴
      const k = ((t * 1.4 + j * 0.33 + 1) % 1);
      const dx = x + (2 * k - k * k) * j * 52 * 0.9;
      const dy = y - 48 - Math.sin(k * Math.PI) * 52 + k * k * 58;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, U.TAU); ctx.fill();
    }
    // 頂上の光
    const tw = (Math.sin(t * 3) + 1) / 2;
    ctx.globalAlpha = 0.6 + tw * 0.4;
    ctx.fillStyle = '#fff';
    U.starPath(ctx, x, y - 54, 5 + tw * 2, 4, 0.4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 街灯・木などの小物
  function drawDeco(ctx, t) {
    for (const [x, y] of [[790, 700], [1210, 700]]) {
      ctx.strokeStyle = '#8a7a9a';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 80); ctx.stroke();
      ctx.fillStyle = '#8a7a9a';
      ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, U.TAU); ctx.fill();
      const g = ctx.createRadialGradient(x, y - 88, 2, x, y - 88, 18);
      const pulse = 0.7 + Math.sin(t * 2 + x) * 0.3;
      g.addColorStop(0, `rgba(255,236,170,${0.8 * pulse})`);
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y - 88, 18, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#fff5d8';
      ctx.strokeStyle = '#8a7a9a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 88, 7, 0, U.TAU); ctx.fill(); ctx.stroke();
    }
    // キャンディツリー
    for (const [x, y, hue] of [[150, 1120, 150], [1880, 1120, 330], [240, 660, 200], [1770, 650, 280]]) {
      const sway = Math.sin(t * 1.2 + x) * 0.02;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sway);
      ctx.fillStyle = '#a58358';
      ctx.fillRect(-6, -34, 12, 36);
      const g = ctx.createRadialGradient(-8, -66, 4, 0, -60, 42);
      g.addColorStop(0, `hsl(${hue},70%,82%)`);
      g.addColorStop(1, `hsl(${hue},55%,64%)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -60, 38, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-12, -72, 10, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // おかし屋さんの屋台（常設）
  function drawStall(ctx, t, empty, glowK) {
    const s = SITES.cake;
    const x = s.x, gy = s.groundY, cy = s.counterY;
    ctx.save();
    // 背板
    const bw = 500;
    const back = ctx.createLinearGradient(0, gy - 405, 0, gy);
    back.addColorStop(0, '#fff6ee');
    back.addColorStop(1, '#f8e8dc');
    ctx.fillStyle = back;
    U.rr(ctx, x - bw / 2, gy - 405, bw, 405, 14);
    ctx.fill();
    ctx.strokeStyle = '#e8c8b8';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 柱
    for (const px of [x - bw / 2 + 16, x + bw / 2 - 16]) {
      const pg = ctx.createLinearGradient(px - 8, 0, px + 8, 0);
      pg.addColorStop(0, '#fff');
      pg.addColorStop(1, '#f0d8c8');
      ctx.fillStyle = pg;
      U.rr(ctx, px - 8, gy - 405, 16, 405, 6);
      ctx.fill();
    }
    // ひさし（スカラップ）
    const awnY = gy - 405;
    ctx.save();
    ctx.translate(x, awnY);
    ctx.rotate(Math.sin(t * 1.4) * 0.006);
    const aw = bw + 70, ah = 64;
    const ag = ctx.createLinearGradient(0, -ah, 0, 22);
    ag.addColorStop(0, '#ffb9d9');
    ag.addColorStop(1, '#ff8fc0');
    ctx.fillStyle = ag;
    U.rr(ctx, -aw / 2, -ah, aw, ah, 16);
    ctx.fill();
    const nS = 8;
    for (let i = 0; i < nS; i++) {
      const sx = -aw / 2 + aw * i / nS;
      ctx.fillStyle = i % 2 ? '#ff8fc0' : '#fff';
      ctx.beginPath();
      ctx.moveTo(sx, -2);
      ctx.lineTo(sx + aw / nS, -2);
      ctx.arc(sx + aw / nS / 2, -2, aw / nS / 2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    U.rr(ctx, -aw / 2 + 8, -ah + 6, aw - 16, 14, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 看板（カップケーキ）
    ctx.translate(0, -ah - 4);
    ctx.rotate(Math.sin(t * 1.1) * 0.03);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#e8a8c8';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(0, -30, 34, 0, U.TAU); ctx.fill(); ctx.stroke();
    // カップ
    const cg = ctx.createLinearGradient(-14, -26, 14, -26);
    cg.addColorStop(0, '#ffca5f');
    cg.addColorStop(1, '#ff9e3e');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(-14, -30); ctx.lineTo(14, -30); ctx.lineTo(10, -14); ctx.lineTo(-10, -14);
    ctx.closePath(); ctx.fill();
    // クリーム
    ctx.fillStyle = '#ffb9d9';
    ctx.beginPath();
    ctx.arc(-7, -34, 7, Math.PI * 0.9, Math.PI * 1.9);
    ctx.arc(0, -40, 8, Math.PI * 0.8, U.TAU);
    ctx.arc(7, -34, 7, Math.PI * 1.1, Math.PI * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4f68';
    ctx.beginPath(); ctx.arc(0, -47, 4, 0, U.TAU); ctx.fill();
    ctx.restore();

    // ガラスショーケース（カウンター）
    const cw = 380;
    // 中の棚
    ctx.fillStyle = '#fff';
    U.rr(ctx, x - cw / 2, cy - 4, cw, gy - cy + 4, 8);
    ctx.fill();
    // ガラス面
    const gg = ctx.createLinearGradient(x - cw / 2, cy, x + cw / 2, gy);
    gg.addColorStop(0, 'rgba(210,240,255,0.55)');
    gg.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    gg.addColorStop(1, 'rgba(190,225,250,0.5)');
    ctx.fillStyle = gg;
    U.rr(ctx, x - cw / 2, cy - 4, cw, gy - cy + 4, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // ガラスの反射
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - cw * 0.3, gy - 8);
    ctx.lineTo(x - cw * 0.12, cy + 6);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - cw * 0.05, gy - 8);
    ctx.lineTo(x + cw * 0.12, cy + 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // カウンター天板
    const tg = ctx.createLinearGradient(0, cy - 14, 0, cy);
    tg.addColorStop(0, '#fff');
    tg.addColorStop(1, '#f0d8c8');
    ctx.fillStyle = tg;
    U.rr(ctx, x - cw / 2 - 14, cy - 12, cw + 28, 14, 7);
    ctx.fill();
    // ストリングライト
    for (let i = 0; i < 7; i++) {
      const lx = x - bw / 2 + 30 + i * (bw - 60) / 6;
      const ly = gy - 395 + Math.sin(i * 1.4) * 6 + 8;
      const tw2 = (Math.sin(t * 3 + i * 1.7) + 1) / 2;
      const col = ['#ffca5f', '#ff9ecb', '#9fd8ff', '#cdb3ff'][i % 4];
      ctx.globalAlpha = 0.5 + tw2 * 0.5;
      const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 9);
      lg.addColorStop(0, col);
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(lx, ly, 9, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(lx, ly, 3, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  // 空き地の光るパッド＋ゴースト
  function drawEmptyPad(ctx, id, t, strong) {
    const s = SITES[id];
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
    const k = strong ? 1 : 0.55;
    ctx.save();
    if (id === 'house') {
      // 丸い敷地
      ctx.fillStyle = '#e8dcc4';
      ctx.beginPath(); ctx.ellipse(s.x, s.groundY - 10, 250, 62, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#f5ecd8';
      ctx.beginPath(); ctx.ellipse(s.x, s.groundY - 12, 225, 52, 0, 0, U.TAU); ctx.fill();
      glowRing(ctx, s.x, s.groundY - 12, 235, 58, pulse, k, t);
      ghost(ctx, t, pulse, k, () => {
        ctx.beginPath();
        ctx.moveTo(s.x - 110, s.groundY - 60);
        ctx.lineTo(s.x, s.groundY - 190);
        ctx.lineTo(s.x + 110, s.groundY - 60);
        ctx.moveTo(s.x - 90, s.groundY - 62);
        ctx.lineTo(s.x - 90, s.groundY - 20);
        ctx.moveTo(s.x + 90, s.groundY - 62);
        ctx.lineTo(s.x + 90, s.groundY - 20);
      });
    } else if (id === 'garden') {
      // 花壇：土＋ミニ柵
      const g = ctx.createLinearGradient(0, s.groundY - 90, 0, s.groundY + 10);
      g.addColorStop(0, '#a5714c');
      g.addColorStop(1, '#7a4f33');
      ctx.fillStyle = '#e8dcc4';
      U.rr(ctx, s.x - 330, s.groundY - 80, 660, 96, 40);
      ctx.fill();
      ctx.fillStyle = g;
      U.rr(ctx, s.x - 312, s.groundY - 70, 624, 78, 34);
      ctx.fill();
      // 白い柵
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 13; i++) {
        const fx = s.x - 290 + i * 48.5;
        U.rr(ctx, fx - 4, s.groundY - 118, 8, 44, 4);
        ctx.fill();
      }
      U.rr(ctx, s.x - 296, s.groundY - 104, 592, 7, 3);
      ctx.fill();
      glowRing(ctx, s.x, s.groundY - 34, 320, 56, pulse, k, t);
      ghost(ctx, t, pulse, k, () => {
        ctx.beginPath();
        ctx.moveTo(s.x, s.groundY - 24);
        ctx.quadraticCurveTo(s.x - 8, s.groundY - 60, s.x + 6, s.groundY - 92);
        ctx.moveTo(s.x + 6, s.groundY - 96);
        ctx.arc(s.x + 6, s.groundY - 110, 15, Math.PI * 0.5, Math.PI * 2.4);
      });
    } else if (id === 'cake') {
      glowRing(ctx, s.x, s.counterY + 40, 200, 60, pulse, k, t);
      ghost(ctx, t, pulse, k, () => {
        const cx = s.x, cy = s.counterY - 40;
        ctx.beginPath();
        ctx.moveTo(cx - 70, cy);
        ctx.lineTo(cx + 70, cy);
        ctx.moveTo(cx - 50, cy);
        ctx.lineTo(cx - 50, cy - 55);
        ctx.quadraticCurveTo(cx, cy - 90, cx + 50, cy - 55);
        ctx.lineTo(cx + 50, cy);
      });
    }
    // 誘いのキラキラ
    if (Math.random() < (strong ? 0.06 : 0.02)) {
      NT.fx.sparkle(
        s.hit.x + (Math.random() - 0.5) * s.hit.r,
        s.hit.y + (Math.random() - 0.5) * s.hit.r * 0.5,
        { n: 1, r: 4 }
      );
    }
    ctx.restore();
  }

  function glowRing(ctx, x, y, rx, ry, pulse, k, t) {
    ctx.save();
    const a = (0.14 + pulse * 0.18) * k;
    const g = ctx.createRadialGradient(x, y, Math.min(rx, ry) * 0.3, x, y, rx);
    g.addColorStop(0, `rgba(255,255,255,0)`);
    g.addColorStop(0.75, `rgba(255,240,180,${a})`);
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 1.12, ry * 1.25, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,214,110,${(0.45 + pulse * 0.5) * k})`;
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 20]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, U.TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function ghost(ctx, t, pulse, k, pathFn) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${(0.55 + pulse * 0.4) * k})`;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.setLineDash([14, 13]);
    ctx.lineDashOffset = -t * 24;
    pathFn();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // メイン描画（ワールド変換済みctx）
  T.draw = function (ctx, t, opts = {}) {
    drawGround(ctx, t);
    drawDeco(ctx, t);
    drawFountain(ctx, t);

    // おかし屋の屋台（常設）
    drawStall(ctx, t, !T.works.cake, 0);

    // 空き地 or 完成物
    for (const id of ['house', 'garden', 'cake']) {
      if (T.works[id] && !(opts.hideArt === id)) {
        if (id === 'garden') drawEmptyGardenBed(ctx);
        T.drawArtwork(ctx, id, t);
      } else {
        const strong = T.tutorialTarget === id;
        drawEmptyPad(ctx, id, t, strong);
        if (opts.hideArt === id && id === 'garden') { /* 制作中は花壇ベースのみ */ }
      }
    }

    // 鳥（空）
    for (const b of T.birds) b.draw(ctx, t);

    // 住民（yソート）
    const rs = [...T.residents].sort((a, b) => a.y - b.y);
    for (const r of rs) r.draw(ctx, t);

    // 蝶
    for (const b of T.butterflies) b.draw(ctx, t);
  };

  // 完成した花壇でも土のベースは描く
  function drawEmptyGardenBed(ctx) {
    const s = SITES.garden;
    ctx.fillStyle = '#e8dcc4';
    U.rr(ctx, s.x - 330, s.groundY - 80, 660, 96, 40);
    ctx.fill();
    const g = ctx.createLinearGradient(0, s.groundY - 90, 0, s.groundY + 10);
    g.addColorStop(0, '#a5714c');
    g.addColorStop(1, '#7a4f33');
    ctx.fillStyle = g;
    U.rr(ctx, s.x - 312, s.groundY - 70, 624, 78, 34);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 13; i++) {
      const fx = s.x - 290 + i * 48.5;
      U.rr(ctx, fx - 4, s.groundY - 118, 8, 44, 4);
      ctx.fill();
    }
    U.rr(ctx, s.x - 296, s.groundY - 104, 592, 7, 3);
    ctx.fill();
  }
  T.drawGardenBed = drawEmptyGardenBed;

  NT.town = T;
})();
