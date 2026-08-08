/* =========================================================
   game.js — 進行・入力・レイアウト・描画のとりまとめ
   ========================================================= */
(function (global) {
  'use strict';

  const STAGES = ['place', 'press', 'roll', 'stretch', 'couche', 'proof',
    'score', 'load', 'steam', 'bake', 'out', 'tap'];

  const BAKE_SECONDS = 11.5;

  const G = {
    canvas: null, ctx: null,
    w: 0, h: 0, dpr: 1,
    time: 0, last: 0,
    stage: 'menu', stageT: 0,
    loaf: null, loaves: [],
    typeKey: 'normal', freeMode: false,
    parts: null,
    cam: { x: 0, y: 0, ang: 0, unit: 100 },
    camT: { x: 0, y: 0, ang: 0, unit: 100 },
    camReady: false,
    idleT: 0,
    L: null,
    buttons: {},
    ptr: { down: false, id: null, x: 0, y: 0, px: 0, py: 0, sx: 0, sy: 0, st: 0, moved: 0 },
    trail: [],
    flashes: [],
    rollAcc: 0, stretchAcc: 0, pressCount: 0,
    bakeT: 0, steamK: 0, heat: 0,
    doorK: 0, slideK: 0,
    crackleT: 0, knockCount: 0,
    celebrateT: 0,
    bubbles: [], sibs: [],
    seamK: 0,
    dropK: 0,
    soundOn: true,
    started: false,
    history: [],
  };

  /* =========================================================
     レイアウト
     ========================================================= */
  function layout() {
    const w = G.w, h = G.h;
    const portrait = h >= w * 1.02;
    const mn = Math.min(w, h), mx = Math.max(w, h);
    const L = { w: w, h: h, portrait: portrait, mn: mn, mx: mx };

    L.benchY = portrait ? h * 0.33 : h * 0.30;

    /* バゲットの向きと基準の大きさ
       縦画面 … 1本を大きく斜めに（クープが引きやすい）
       横画面 … 3本を並べて、オーブンごと広く見せる */
    L.loafAng = portrait ? -1.06 : -0.045;
    const spec = Loaf.TYPES[G.typeKey] || Loaf.TYPES.normal;
    L.sibs = portrait ? 0 : 2;
    L.gapU = spec.rad * 3.3;                        // 隣のバゲットまでの距離（loaf unit）
    L.groupR = spec.rad * 1.40 + (L.sibs ? L.gapU : 0);
    const avail = portrait ? h * 0.72 : w * 0.78;
    L.unitBase = (avail / 2) * (1 + 0.30 * (1 - spec.len));
    if (!portrait) {
      /* 3本ぶんの厚みが画面に収まるように抑える */
      const fitH = (h * 0.74) / (2 * L.groupR);
      L.unitBase = Math.min(L.unitBase, fitH);
    }

    /* 作業台の上（成形） */
    L.benchCenter = { x: w * 0.5, y: portrait ? h * 0.62 : h * 0.58 };

    /* バゲットの軸に直交する向きに、画面のどれだけの余裕があるか。
       ここに生地の太さと「なぞる幅」が収まらないと、指が画面外に出てしまう。 */
    {
      const ca = Math.abs(Math.cos(L.loafAng)), sa = Math.abs(Math.sin(L.loafAng));
      L.availPerp = Math.min(
        sa > 0.02 ? (w * 0.46) / sa : 1e9,
        ca > 0.02 ? (h * 0.42) / ca : 1e9
      );
    }

    /* 発酵布 */
    const loafLen = 2 * spec.len * L.unitBase;
    L.cloth = {
      x: w * 0.5,
      y: portrait ? h * 0.60 : h * 0.52,
      w: loafLen * 1.14,
      h: portrait
        ? Math.max(mn * 0.30, loafLen * 0.34)
        : Math.min(h * 0.94, 2 * L.groupR * L.unitBase * 1.28),
      ang: L.loafAng,
    };

    /* オーブン庫内 */
    L.ovenIn = portrait
      ? { x: w * 0.035, y: h * 0.085, w: w * 0.93, h: h * 0.735 }
      : { x: w * 0.05, y: h * 0.05, w: w * 0.90, h: h * 0.72 };
    /* オーブンの中でのバゲットの向き（縦画面は斜めに寝かせて大きく見せる） */
    L.ovenAng = portrait ? -0.95 : -0.045;

    /* 冷やす場所（ラックは毎フレーム、パンの真下に平行に置く） */
    L.coolAng = portrait ? L.loafAng * 0.34 : -0.045;
    L.coolH = portrait ? h * 0.40 : h * 0.42;
    L.coolPos = { x: w * 0.5, y: portrait ? h * 0.54 : h * 0.50 };

    /* 焼き上がりを飾る棚 */
    L.shelf = { x: w * 0.06, y: h * 0.10, w: w * 0.88, h: mn * 0.10 };

    /* 職人 */
    L.baker = portrait
      ? { x: w * 0.17, y: h * 0.295, s: mn * 0.00165 }
      : { x: w * 0.085, y: h * 0.40, s: mn * 0.0019 };

    /* ボタン */
    const br = U.clamp(mn * 0.055, 22, 46);
    L.btnR = br;
    L.bigR = U.clamp(mn * 0.098, 40, 96);
    G.buttons.sound = { x: w - br * 1.5, y: br * 1.5, r: br, icon: G.soundOn ? 'sound' : 'mute' };
    G.buttons.home = { x: w - br * 1.5, y: br * 4.0, r: br, icon: 'home' };
    G.buttons.go = {
      x: portrait ? w - L.bigR * 1.3 : w - L.bigR * 1.35,
      y: portrait ? h - L.bigR * 1.5 : h - L.bigR * 1.4,
      r: L.bigR, icon: 'arrowR', pulse: true,
      color: ['#fff0d8', '#ffd9a5'], ring: 'rgba(224,122,60,0.9)',
    };

    /* メニューの種類ボタン */
    const keys = ['normal', 'petite', 'batard', 'free'];
    const icons = { normal: 'baguette', petite: 'petite', batard: 'batard', free: 'sparkleLame' };
    const mr = U.clamp(mn * (portrait ? 0.155 : 0.135), 44, 132);
    L.menuR = mr;
    G.buttons.menu = keys.map((k, i) => {
      let x, y;
      if (portrait) {
        x = w * (i % 2 === 0 ? 0.29 : 0.71);
        y = h * (i < 2 ? 0.50 : 0.74);
      } else {
        x = w * (0.14 + 0.24 * i);
        y = h * 0.60;
      }
      return {
        x: x, y: y, r: mr, icon: icons[k], key: k, pulse: true,
        color: k === 'free' ? ['#fff2fb', '#ffd9ee'] : ['#fff6e6', '#f6dcc0'],
        ring: k === 'free' ? 'rgba(228,120,180,0.9)' : 'rgba(233,150,120,0.85)',
      };
    });

    /* できあがり画面の3択 */
    const dr = U.clamp(mn * (portrait ? 0.135 : 0.115), 40, 110);
    G.buttons.done = [
      { key: 'same', icon: icons[G.typeKey] || 'baguette' },
      { key: 'other', icon: 'three' },
      { key: 'free', icon: 'sparkleLame', color: ['#fff2fb', '#ffd9ee'], ring: 'rgba(228,120,180,0.9)' },
    ].map((b, i) => {
      const x = portrait ? w * (0.20 + 0.30 * i) : w * (0.30 + 0.20 * i);
      const y = portrait ? h * 0.85 : h * 0.84;
      return Object.assign({ x: x, y: y, r: dr, pulse: true }, b);
    });

    /* 蒸気ボタン */
    G.buttons.steam = {
      x: w * 0.5, y: portrait ? h * 0.905 : h * 0.88,
      r: L.bigR * 1.12, icon: 'steam', pulse: true,
      color: ['#eefaff', '#c8e8f8'], ring: 'rgba(90,160,205,0.9)',
    };

    G.L = L;
    updateCamTarget(true);
  }

  /* =========================================================
     カメラ（バゲットのローカル空間 ←→ 画面）
     ========================================================= */
  /* 成形中は生地に寄る。伸びるにつれて自然に引く（画面外に出さない） */
  function unitForStage() {
    const L = G.L;
    const dm = G.loaf ? G.loaf.dims() : { hl: 0.3, R: 0.24 };
    const fit = (L.mn * 0.36) / Math.max(dm.hl, 0.18);
    /* 太さ方向にも収める（なぞる操作が画面外へ出ないように） */
    const fitPerp = L.availPerp / (2.2 * Math.max(dm.R, 0.05));
    const shaping = Math.min(L.unitBase * 2.3, fit, fitPerp);
    if (G.stage === 'stretch') return U.lerp(shaping, L.unitBase, U.smooth(G.loaf ? G.loaf.stretch : 0));
    return shaping;
  }

  /* 箱の中に「太さも含めて」収まる拡大率を求める（はみ出し防止） */
  function fitUnitInBox(spec, boxW, boxH, ang) {
    const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
    const L2 = spec.len * 1.06;                        // 発酵＋オーブンスプリング込みの半長
    const R2 = G.L ? G.L.groupR : spec.rad * 1.40;     // 隣のバゲットも含めた広がり
    const ua = (boxW * 0.5) / (L2 * c + R2 * s);
    const ub = (boxH * 0.5) / (L2 * s + R2 * c);
    return Math.min(ua, ub);
  }

  function updateCamTarget(snap) {
    const L = G.L;
    if (!L) return;
    const spec = Loaf.TYPES[G.typeKey] || Loaf.TYPES.normal;
    const st = G.stage;
    let x, y, ang, unit;

    if (st === 'menu') {
      x = L.w * 0.5; y = L.h * (L.portrait ? 0.26 : 0.24);
      ang = L.loafAng * 0.4; unit = L.unitBase * 0.42;
    } else if (st === 'place' || st === 'press' || st === 'roll' || st === 'stretch') {
      x = L.benchCenter.x; y = L.benchCenter.y;
      ang = L.loafAng; unit = unitForStage();
    } else if (st === 'couche' || st === 'proof' || st === 'score') {
      x = L.cloth.x; y = L.cloth.y;
      ang = L.loafAng; unit = L.unitBase;
    } else if (st === 'load') {
      const o = L.ovenIn;
      ang = L.ovenAng;
      unit = fitUnitInBox(spec, o.w * 0.92, o.h * 0.86, ang);
      /* 手前（オーブンの外）で待機 */
      x = L.w * 0.5;
      y = L.h * (L.portrait ? 0.93 : 0.92);
      const k = U.smoother(G.slideK);
      x = U.lerp(x, o.x + o.w * 0.5, k);
      y = U.lerp(y, o.y + o.h * 0.52, k);
    } else if (st === 'steam' || st === 'bake') {
      const o = L.ovenIn;
      ang = L.ovenAng;
      unit = fitUnitInBox(spec, o.w * 0.92, o.h * 0.86, ang) * (1 + 0.07 * U.smooth(G.loaf ? G.loaf.bake : 0));
      x = o.x + o.w * 0.5; y = o.y + o.h * 0.52;
    } else if (st === 'out') {
      const o = L.ovenIn;
      const kk = U.smoother(G.slideK);
      ang = U.lerp(L.ovenAng, L.coolAng, kk);
      const uIn = fitUnitInBox(spec, o.w * 0.92, o.h * 0.86, ang);
      const uOut = fitUnitInBox(spec, L.w * 0.88, L.coolH, ang);
      unit = U.lerp(uIn, uOut, kk);
      x = U.lerp(o.x + o.w * 0.5, L.coolPos.x, kk);
      y = U.lerp(o.y + o.h * 0.52, L.coolPos.y, kk);
    } else { /* tap / done */
      ang = L.coolAng;
      unit = fitUnitInBox(spec, L.w * 0.88, L.coolH, ang);
      x = L.coolPos.x; y = L.coolPos.y;
    }

    G.camT.x = x; G.camT.y = y; G.camT.ang = ang; G.camT.unit = unit;
    if (snap || !G.camReady) {
      G.cam.x = x; G.cam.y = y; G.cam.ang = ang; G.cam.unit = unit;
      G.camReady = true;
    }
  }

  function toLocal(sx, sy) {
    const c = G.cam;
    const dx = sx - c.x, dy = sy - c.y;
    const ca = Math.cos(-c.ang), sa = Math.sin(-c.ang);
    return { x: (dx * ca - dy * sa) / c.unit, y: (dx * sa + dy * ca) / c.unit };
  }
  function toScreen(lx, ly) {
    const c = G.cam;
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang);
    const x = lx * c.unit, y = ly * c.unit;
    return { x: c.x + x * ca - y * sa, y: c.y + x * sa + y * ca };
  }
  G.toLocal = toLocal; G.toScreen = toScreen;

  /* =========================================================
     進行
     ========================================================= */
  function setStage(s) {
    G.history.push(s + '@' + G.time.toFixed(2));
    G.stage = s;
    G.stageT = 0;
    G.idleT = 0;
    G.trail.length = 0;

    if (s === 'place') { G.dropK = 0; }
    if (s === 'press') {
      G.pressCount = 0;
      G.bubbles = [];
      const n = 4;
      for (let i = 0; i < n; i++) {
        G.bubbles.push({
          u: -0.55 + (1.1 * i) / (n - 1) + U.rr(-0.08, 0.08),
          v: U.rr(-0.35, 0.35), r: U.rr(0.055, 0.085), pop: 0,
        });
      }
    }
    if (s === 'roll') { G.rollAcc = 0; G.seamK = 0; }
    if (s === 'stretch') { G.stretchAcc = 0; }
    if (s === 'couche') makeSiblings();
    if (s === 'load') { G.slideK = 0; G.doorK = 0; copyScoresToSiblings(); }
    if (s === 'steam') { G.steamK = 0; }
    if (s === 'bake') { G.bakeT = 0; if (G.soundOn) { Sfx.ovenHum(true); Sfx.swell(4.0); } }
    if (s === 'out') { G.slideK = 0; Sfx.ovenHum(false); }
    if (s === 'tap') { G.knockCount = 0; }
    if (s === 'done') {
      G.celebrateT = 0;
      if (G.loaf && G.loaves.indexOf(G.loaf) < 0) G.loaves.push(G.loaf);
      layout();
    }
    updateCamTarget(false);
  }
  G.setStage = setStage;

  /* 横画面で隣に並ぶバゲット。職人が同時に焼いている分。
     プレイヤーがクープを入れたら、同じ模様が写し取られる。 */
  function makeSiblings() {
    G.sibs = [];
    if (!G.L || !G.L.sibs) return;
    for (let i = 0; i < G.L.sibs; i++) {
      const lf = new Loaf(G.typeKey);
      lf.press = 1; lf.roll = 1; lf.stretch = 1;
      lf.proof = G.loaf.proof;
      G.sibs.push({ loaf: lf, side: i === 0 ? -1 : 1 });
    }
  }
  function copyScoresToSiblings() {
    if (!G.sibs) return;
    G.sibs.forEach((sb) => {
      sb.loaf.scores.length = 0;
      sb.loaf.lean = G.loaf.lean;
      G.loaf.scores.forEach((s) => {
        const c = Object.assign({}, s);
        c.t = U.clamp(s.t + U.rr(-0.03, 0.03), 0.10, 0.90);
        c.off = s.off * 0.6 + U.rr(-0.06, 0.06);
        c.angle = s.angle + U.rr(-0.05, 0.05);
        c.len = U.clamp(s.len + U.rr(-0.10, 0.10), 0, 1);
        c.depth = U.clamp(s.depth + U.rr(-0.08, 0.08), 0.6, 1.35);
        c.seed = (Math.random() * 1e6) | 0;
        c.settle = 1; c.born = 1; c.popped = false;
        c.rawGeom = { t: c.t, off: c.off, angle: c.angle, halfLenU: U.lerp(0.14, 0.30, c.len) };
        sb.loaf.scores.push(c);
      });
    });
  }
  function syncSiblings() {
    if (!G.sibs) return;
    G.sibs.forEach((sb) => {
      sb.loaf.proof = G.loaf.proof;
      sb.loaf.bake = G.loaf.bake;
      sb.loaf.cool = G.loaf.cool;
      sb.loaf.update(0.016);
    });
  }

  function newLoaf(key) {
    G.typeKey = key === 'free' ? 'free' : key;
    G.freeMode = key === 'free';
    G.loaf = new Loaf(G.typeKey);
    G.sibs = [];
    layout();
    setStage('place');
    updateCamTarget(true);
  }
  G.newLoaf = newLoaf;

  function advance() { const i = STAGES.indexOf(G.stage); if (i >= 0 && i < STAGES.length - 1) setStage(STAGES[i + 1]); else setStage('done'); }

  /* =========================================================
     入力
     ========================================================= */
  function pointerPos(e) {
    const r = G.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    if (G.ptr.down) return;
    const p = pointerPos(e);
    G.ptr.down = true; G.ptr.id = e.pointerId;
    G.ptr.x = G.ptr.px = G.ptr.sx = p.x;
    G.ptr.y = G.ptr.py = G.ptr.sy = p.y;
    G.ptr.st = G.time; G.ptr.moved = 0;
    G.idleT = 0;
    if (!G.started) { G.started = true; Sfx.unlock(); }
    Sfx.unlock();

    /* ボタン判定（ボタンが最優先） */
    if (handleButtonDown(p.x, p.y)) { G.ptr.consumed = true; return; }
    G.ptr.consumed = false;

    const st = G.stage;
    if (st === 'place') {
      doPlace();
    } else if (st === 'press') {
      doPress(p.x, p.y);
    } else if (st === 'roll' || st === 'stretch') {
      Sfx.frictionStart();
    } else if (st === 'score') {
      /* 受付はとても広く。少しくらい外しても自分のバゲットに線が入る */
      const l = toLocal(p.x, p.y);
      const d = G.loaf.dims();
      const padY = d.R + (G.L.gapU || 0.3) + 0.22;
      G.cutting = Math.abs(l.x) < d.hl * 1.4 && Math.abs(l.y) < padY;
      if (G.cutting) G.trail = [{ x: p.x, y: p.y }];
    } else if (st === 'tap') {
      doKnock(p.x, p.y);
    } else if (st === 'proof') {
      if (G.loaf.proof > 0.9) advance();
    }
  }

  function onMove(e) {
    if (!G.ptr.down || (G.ptr.id !== null && e.pointerId !== G.ptr.id)) return;
    const p = pointerPos(e);
    G.ptr.px = G.ptr.x; G.ptr.py = G.ptr.y;
    G.ptr.x = p.x; G.ptr.y = p.y;
    const dx = G.ptr.x - G.ptr.px, dy = G.ptr.y - G.ptr.py;
    G.ptr.moved += Math.hypot(dx, dy);
    G.idleT = 0;
    if (G.ptr.consumed) return;

    const st = G.stage;
    const l = toLocal(G.ptr.x, G.ptr.y), lp = toLocal(G.ptr.px, G.ptr.py);

    if (st === 'roll') {
      const d = Math.abs(l.y - lp.y);
      G.rollAcc += d;
      const k = U.clamp(G.rollAcc / 1.5, 0, 1);
      G.loaf.roll = k; G.seamK = k;
      Sfx.frictionLevel(U.clamp(Math.hypot(dx, dy) / 22, 0, 1));
      if (Math.random() < 0.25) {
        G.parts.flour(G.ptr.x, G.ptr.y, 1, G.L.mn * 0.0016);
      }
      if (k >= 1) { finishRoll(); }
    } else if (st === 'stretch') {
      const d = Math.abs(l.x - lp.x);
      G.stretchAcc += d;
      const k = U.clamp(G.stretchAcc / 3.2, 0, 1);
      G.loaf.stretch = k;
      Sfx.frictionLevel(U.clamp(Math.hypot(dx, dy) / 22, 0, 1));
      if (Math.random() < 0.30) G.parts.flour(G.ptr.x, G.ptr.y, 1, G.L.mn * 0.0016);
      if (k >= 1) { finishStretch(); }
    } else if (st === 'couche') {
      /* 指でバゲットを運ぶ */
      G.cam.x += dx; G.cam.y += dy;
    } else if (st === 'score' && G.cutting) {
      const last = G.trail[G.trail.length - 1];
      if (!last || U.dist(last.x, last.y, p.x, p.y) > 4) G.trail.push({ x: p.x, y: p.y });
      if (G.trail.length > 90) G.trail.shift();
    } else if (st === 'load') {
      if (G.ptr.moved > G.L.mn * 0.10 && G.slideK <= 0) startLoad();
    } else if (st === 'out') {
      if (G.ptr.moved > G.L.mn * 0.08 && G.slideK <= 0) startOut();
    }
  }

  function onUp(e) {
    if (!G.ptr.down) return;
    const wasConsumed = G.ptr.consumed;
    const p = { x: G.ptr.x, y: G.ptr.y };
    G.ptr.down = false; G.ptr.id = null;
    Sfx.frictionStop();
    if (wasConsumed) { handleButtonUp(p.x, p.y); return; }

    const st = G.stage;
    if (st === 'score' && G.cutting) {
      finishCut();
      G.cutting = false;
    } else if (st === 'couche') {
      snapToCouche();
    } else if (st === 'load') {
      if (G.slideK <= 0) startLoad();
    } else if (st === 'out') {
      if (G.slideK <= 0) startOut();
    } else if (st === 'proof' && G.loaf.proof > 0.9) {
      advance();
    } else if (st === 'roll' && G.ptr.moved < 6) {
      /* 動かせない子のための救済：タップでも少し進む */
      G.rollAcc += 0.30; G.loaf.roll = U.clamp(G.rollAcc / 1.5, 0, 1); G.seamK = G.loaf.roll;
      Sfx.press(1.1);
      if (G.loaf.roll >= 1) finishRoll();
    } else if (st === 'stretch' && G.ptr.moved < 6) {
      G.stretchAcc += 0.7; G.loaf.stretch = U.clamp(G.stretchAcc / 3.2, 0, 1);
      Sfx.press(0.9);
      if (G.loaf.stretch >= 1) finishStretch();
    }
  }

  /* ---- ボタン ---- */
  function activeButtons() {
    const out = [];
    const st = G.stage;
    out.push(G.buttons.sound);
    if (st !== 'menu') out.push(G.buttons.home);
    if (st === 'menu') G.buttons.menu.forEach((b) => out.push(b));
    if (st === 'done') G.buttons.done.forEach((b) => out.push(b));
    if (st === 'score' && G.loaf && G.loaf.scores.length >= (G.freeMode ? 2 : 3)) {
      G.buttons.go.icon = 'oven';
      G.buttons.go.badge = G.loaf.scores.length;
      out.push(G.buttons.go);
    }
    if (st === 'load' && G.slideK <= 0) {
      G.buttons.go.icon = 'arrowR'; G.buttons.go.badge = 0;
      out.push(G.buttons.go);
    }
    if (st === 'steam' && G.steamK <= 0) out.push(G.buttons.steam);
    if (st === 'proof' && G.loaf && G.loaf.proof > 0.9) {
      G.buttons.go.icon = 'lame'; G.buttons.go.badge = 0;
      out.push(G.buttons.go);
    }
    if (st === 'out' && G.slideK <= 0) {
      G.buttons.go.icon = 'arrowR'; G.buttons.go.badge = 0;
      out.push(G.buttons.go);
    }
    return out;
  }

  function handleButtonDown(x, y) {
    const bs = activeButtons();
    for (let i = 0; i < bs.length; i++) {
      if (UI.hit(bs[i], x, y)) { bs[i].press = true; G.pressedBtn = bs[i]; return true; }
    }
    return false;
  }
  function handleButtonUp(x, y) {
    const b = G.pressedBtn;
    G.pressedBtn = null;
    if (!b) return;
    b.press = false;
    if (!UI.hit(b, x, y, 12)) return;
    Sfx.tapUI();

    if (b === G.buttons.sound) {
      G.soundOn = !G.soundOn;
      Sfx.setEnabled(G.soundOn);
      b.icon = G.soundOn ? 'sound' : 'mute';
      return;
    }
    if (b === G.buttons.home) { Sfx.ovenHum(false); setStage('menu'); layout(); updateCamTarget(true); return; }
    if (b.key && G.stage === 'menu') { newLoaf(b.key); return; }
    if (G.stage === 'done') {
      if (b.key === 'same') newLoaf(G.typeKey);
      else if (b.key === 'free') newLoaf('free');
      else { setStage('menu'); layout(); updateCamTarget(true); }
      return;
    }
    if (b === G.buttons.go) {
      if (G.stage === 'score') advance();
      else if (G.stage === 'proof') advance();
      else if (G.stage === 'load') startLoad();
      else if (G.stage === 'out') startOut();
      return;
    }
    if (b === G.buttons.steam) { doSteam(); return; }
  }

  /* =========================================================
     各工程のアクション
     ========================================================= */
  function doPlace() {
    if (G.dropK > 0) return;
    G.dropK = 0.0001;
  }

  function doPress(x, y) {
    const l = toLocal(x, y);
    if (!G.loaf.contains(l.x, l.y, 0.30)) return;
    /* 一番近い気泡をつぶす */
    let best = -1, bd = 1e9;
    for (let i = 0; i < G.bubbles.length; i++) {
      const b = G.bubbles[i];
      if (b.pop > 0) continue;
      const dm = G.loaf.dims();
      const d = U.dist(b.u, b.v, l.x / Math.max(0.05, dm.hl), l.y / Math.max(0.05, dm.R * 0.7));
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) G.bubbles[best].pop = 0.0001;
    G.pressCount++;
    G.loaf.press = U.clamp(G.pressCount / 4, 0, 1);
    G.loaf.wobble = 0.5; G.loaf.wobblePhase = 0;
    Sfx.press(0.9 + G.pressCount * 0.09);
    G.parts.flour(x, y, 7, G.L.mn * 0.0022);
    if (G.pressCount >= 4) {
      Sfx.chime();
      setTimeout(() => { if (G.stage === 'press') advance(); }, 420);
    }
  }

  function finishRoll() {
    if (G.stage !== 'roll') return;
    G.loaf.roll = 1;
    Sfx.chime();
    Sfx.frictionStop();
    setTimeout(() => { if (G.stage === 'roll') advance(); }, 380);
  }
  function finishStretch() {
    if (G.stage !== 'stretch') return;
    G.loaf.stretch = 1;
    Sfx.chime();
    Sfx.frictionStop();
    setTimeout(() => { if (G.stage === 'stretch') advance(); }, 420);
  }

  function snapToCouche() {
    Sfx.cloth();
    G.parts.flour(G.L.cloth.x, G.L.cloth.y, 12, G.L.mn * 0.003);
    updateCamTarget(false);
    setTimeout(() => { if (G.stage === 'couche') { Sfx.chime(); advance(); } }, 480);
  }

  /* ---- クープ確定 ---- */
  function finishCut() {
    if (G.trail.length < 2) { G.trail.length = 0; return; }
    const a = G.trail[0], b = G.trail[G.trail.length - 1];
    const px = U.dist(a.x, a.y, b.x, b.y);
    if (px < G.L.mn * 0.035) { G.trail.length = 0; return; }  /* ただのタップ */

    const l0 = toLocal(a.x, a.y), l1 = toLocal(b.x, b.y);
    const dur = G.time - G.ptr.st;
    const sc = G.loaf.addScore(l0.x, l0.y, l1.x, l1.y, dur, G.freeMode);
    G.trail.length = 0;
    if (!sc) return;

    Sfx.slash(U.clamp(px / (G.L.mn * 0.35), 0.35, 1.3));
    /* 切った線に沿って粉と光 */
    const g = G.loaf.scoreCenterLocal(sc);
    const p0 = toScreen(g.x - Math.cos(g.ang) * g.half, g.y - Math.sin(g.ang) * g.half);
    const p1 = toScreen(g.x + Math.cos(g.ang) * g.half, g.y + Math.sin(g.ang) * g.half);
    G.flashes.push({ x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, t: 0 });
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      G.parts.flour(U.lerp(p0.x, p1.x, k), U.lerp(p0.y, p1.y, k), 2, G.L.mn * 0.0013);
    }
    const max = G.freeMode ? 8 : 5;
    if (G.loaf.scores.length >= max) {
      setTimeout(() => { if (G.stage === 'score') advance(); }, 900);
    }
  }

  function startLoad() {
    if (G.slideK > 0) return;
    G.slideK = 0.0001;
    G.doorK = 1;
    Sfx.door(true);
  }

  function doSteam() {
    if (G.steamK > 0) return;
    G.steamK = 0.0001;
    Sfx.steam(2.2);
    const o = G.L.ovenIn;
    /* 庫内いっぱいに、あちこちから もうもうと立ちのぼらせる */
    for (let i = 0; i < 9; i++) {
      setTimeout(() => {
        if (!G.parts) return;
        for (let j = 0; j < 5; j++) {
          const kx = (j + 0.5) / 5;
          G.parts.steam(
            o.x + o.w * (0.08 + 0.84 * kx) + U.rr(-o.w * 0.05, o.w * 0.05),
            o.y + o.h * U.rr(0.45, 0.92),
            1, G.L.mn * 0.0030, 1.3
          );
        }
        /* パンのまわりからも */
        G.parts.steam(G.cam.x + U.rr(-1, 1) * G.cam.unit * 0.8, G.cam.y + U.rr(-0.3, 0.5) * G.cam.unit * 0.6, 2, G.L.mn * 0.0022, 1.0);
      }, i * 90);
    }
    setTimeout(() => { if (G.stage === 'steam') advance(); }, 1500);
  }

  function startOut() {
    if (G.slideK > 0) return;
    G.slideK = 0.0001;
    Sfx.door(false);
  }

  function doKnock(x, y) {
    const l = toLocal(x, y);
    if (!G.loaf.contains(l.x, l.y, 0.35)) return;
    G.knockCount++;
    G.loaf.wobble = 0.75; G.loaf.wobblePhase = 0;
    Sfx.knock();
    G.parts.crumb(x, y, 8);
    G.parts.spark(x, y, 6, 44);
    for (let i = 0; i < 5; i++) setTimeout(() => Sfx.crackle(1.1), 120 + i * 90);
    if (G.knockCount >= 2) {
      setTimeout(() => {
        if (G.stage !== 'tap') return;
        Sfx.chime('big');
        setStage('done');
      }, 700);
    }
  }

  /* =========================================================
     更新
     ========================================================= */
  function update(dt) {
    G.time += dt;
    G.stageT += dt;
    if (!G.ptr.down) G.idleT += dt;
    G.parts.update(dt);
    if (G.loaf) G.loaf.update(dt);
    syncSiblings();

    for (let i = G.flashes.length - 1; i >= 0; i--) {
      G.flashes[i].t += dt * 2.6;
      if (G.flashes[i].t >= 1) G.flashes.splice(i, 1);
    }

    const st = G.stage;

    if (st === 'place' && G.dropK > 0 && G.dropK < 1) {
      const prev = G.dropK;
      G.dropK = Math.min(1, G.dropK + dt * 2.6);
      if (prev < 0.62 && G.dropK >= 0.62) {
        Sfx.pof();
        G.loaf.wobble = 1.0; G.loaf.wobblePhase = 0;
        const p = toScreen(0, 0);
        G.parts.flour(p.x, p.y + G.cam.unit * 0.2, 22, G.L.mn * 0.0035);
      }
      if (G.dropK >= 1) setTimeout(() => { if (G.stage === 'place') advance(); }, 320);
    }

    if (st === 'press') {
      for (let i = 0; i < G.bubbles.length; i++) {
        const b = G.bubbles[i];
        if (b.pop > 0 && b.pop < 1) b.pop = Math.min(1, b.pop + dt * 3.4);
      }
    }

    if (st === 'proof') {
      G.loaf.proof = U.clamp(G.loaf.proof + dt / 2.8, 0, 1);
      if (Math.random() < dt * 2.4) {
        const p = toScreen(U.rr(-0.8, 0.8), U.rr(-0.4, 0.4));
        G.parts.spark(p.x, p.y, 1, 46);
      }
      if (G.loaf.proof >= 1 && G.stageT > 3.6) advance();
    }

    if (st === 'load') {
      if (G.slideK > 0 && G.slideK < 1) {
        G.slideK = Math.min(1, G.slideK + dt * 0.95);
        if (G.slideK >= 1) {
          Sfx.door(false);
          setTimeout(() => { if (G.stage === 'load') advance(); }, 420);
        }
      }
      if (G.doorK > 0) G.doorK = Math.max(0, G.doorK - dt * 0.5);
    }

    if (st === 'steam') {
      G.heat = U.approach(G.heat, 0.5, 1.4, dt);
      if (G.steamK > 0) G.steamK = Math.min(1, G.steamK + dt * 0.8);
    }

    if (st === 'bake') {
      G.bakeT += dt;
      const p = U.clamp(G.bakeT / BAKE_SECONDS, 0, 1);
      G.loaf.bake = 1 - Math.pow(1 - p, 1.32);
      G.heat = U.approach(G.heat, 1.0, 1.0, dt);

      /* 蒸気：最初はもうもう、だんだん引く */
      const o = G.L.ovenIn;
      const steamRate = U.lerp(30, 0.8, U.smooth(U.range(p, 0.0, 0.55)));
      let want = dt * steamRate;
      while (want > 0) {
        if (Math.random() < Math.min(1, want)) {
          /* 半分はパンのそばから（膨らみと結びつけて見せる） */
          if (Math.random() < 0.5) {
            G.parts.steam(
              G.cam.x + U.rr(-1, 1) * G.cam.unit * 0.85,
              G.cam.y + U.rr(-0.4, 0.4) * G.cam.unit * 0.5,
              1, G.L.mn * 0.0022, 0.8
            );
          } else {
            G.parts.steam(
              o.x + o.w * U.rr(0.08, 0.92),
              o.y + o.h * U.rr(0.35, 0.9), 1, G.L.mn * 0.0028, 0.9
            );
          }
        }
        want -= 1;
      }
      /* クープが開いた合図 */
      const pops = G.loaf.consumePops();
      for (let i = 0; i < pops.length; i++) {
        Sfx.pop(0.85 + i * 0.12);
        const g = G.loaf.scoreCenterLocal(pops[i]);
        const s = toScreen(g.x, g.y);
        G.parts.steam(s.x, s.y, 3, G.L.mn * 0.0016, 0.7);
        G.parts.spark(s.x, s.y, 4, 42);
      }
      /* 後半のパチパチ */
      if (p > 0.72) {
        G.crackleT -= dt;
        if (G.crackleT <= 0) { Sfx.crackle(0.7); G.crackleT = U.rr(0.10, 0.4); }
      }
      if (p >= 1) {
        Sfx.chime('big');
        Sfx.ovenHum(false);
        setTimeout(() => { if (G.stage === 'bake') advance(); }, 900);
      }
    }

    if (st === 'out') {
      G.heat = U.approach(G.heat, 0.25, 0.8, dt);
      if (G.slideK > 0 && G.slideK < 1) {
        G.slideK = Math.min(1, G.slideK + dt * 0.85);
        if (G.slideK >= 1) setTimeout(() => { if (G.stage === 'out') advance(); }, 500);
      }
      if (G.slideK > 0.2) {
        const p = toScreen(U.rr(-0.9, 0.9), -0.1);
        if (Math.random() < dt * 8) G.parts.steam(p.x, p.y, 1, G.L.mn * 0.0016, 0.5);
        G.crackleT -= dt;
        if (G.crackleT <= 0) { Sfx.crackle(0.85); G.crackleT = U.rr(0.08, 0.32); }
      }
    }

    if (st === 'tap' || st === 'done') {
      G.loaf.cool = U.clamp(G.loaf.cool + dt / 6, 0, 1);
      if (st === 'tap') {
        G.crackleT -= dt;
        if (G.crackleT <= 0) { Sfx.crackle(0.4); G.crackleT = U.rr(0.5, 1.6); }
        const p = toScreen(U.rr(-0.9, 0.9), -0.2);
        if (Math.random() < dt * 2.2) G.parts.steam(p.x, p.y, 1, G.L.mn * 0.0012, 0.35);
      } else {
        G.celebrateT += dt;
      }
    }

    /* カメラ追従 */
    updateCamTarget(false);
    if (G.stage !== 'couche' || !G.ptr.down) {
      const rate = 6.0;
      G.cam.x = U.approach(G.cam.x, G.camT.x, rate, dt);
      G.cam.y = U.approach(G.cam.y, G.camT.y, rate, dt);
      G.cam.ang = G.cam.ang + U.wrapAngle(G.camT.ang - G.cam.ang) * (1 - Math.exp(-rate * dt));
    }
    G.cam.unit = U.approach(G.cam.unit, G.camT.unit, 5.0, dt);
  }

  /* =========================================================
     描画
     ========================================================= */
  function drawLoafAt(ctx, extraScale, yOffset) {
    const c = G.cam;
    const showSibs = ['couche', 'proof', 'score', 'load', 'steam', 'bake', 'out', 'tap', 'done'];
    if (G.sibs && G.sibs.length && showSibs.indexOf(G.stage) >= 0) {
      const off = c.unit * G.L.gapU;
      const nx = -Math.sin(c.ang), ny = Math.cos(c.ang);
      ctx.save();
      ctx.globalAlpha = 0.93;
      G.sibs.forEach((sb) => {
        ctx.save();
        ctx.translate(c.x + nx * off * sb.side, c.y + (yOffset || 0) + ny * off * sb.side);
        ctx.rotate(c.ang);
        const s2 = c.unit * (extraScale || 1) * 0.97;
        ctx.scale(s2, s2);
        sb.loaf.draw(ctx, { quality: 'low' });
        ctx.restore();
      });
      ctx.restore();
    }
    ctx.save();
    ctx.translate(c.x, c.y + (yOffset || 0));
    ctx.rotate(c.ang);
    const s = c.unit * (extraScale || 1);
    ctx.scale(s, s);
    G.loaf.draw(ctx, {});
    ctx.restore();
  }

  function drawSeam(ctx) {
    const shows = ['roll', 'stretch', 'couche'];
    if (G.seamK <= 0.02 || shows.indexOf(G.stage) < 0) return;
    const c = G.cam;
    const d = G.loaf.dims();
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.ang); ctx.scale(c.unit, c.unit);
    ctx.strokeStyle = `rgba(196,150,100,${(0.5 * G.seamK).toFixed(3)})`;
    ctx.lineWidth = d.R * 0.06;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = -0.92 + (1.84 * i) / 40;
      const p = G.loaf.profile(u, d);
      const x = u * d.hl;
      const y = d.R * p * (0.35 + 0.1 * Math.sin(u * 7));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawBubbles(ctx) {
    if (G.stage !== 'press') return;
    const c = G.cam, d = G.loaf.dims();
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.ang); ctx.scale(c.unit, c.unit);
    for (let i = 0; i < G.bubbles.length; i++) {
      const b = G.bubbles[i];
      const k = b.pop > 0 ? U.easeOut(b.pop) : 0;
      if (k >= 1) continue;
      const x = b.u * d.hl, y = b.v * d.R * 0.7;
      const r = b.r * (1 + k * 1.5);
      ctx.globalAlpha = 1 - k;
      /* 生地の下でふくらんだ気泡：やわらかい膨らみ＋上の光＋下の影 */
      const g = ctx.createRadialGradient(x - r * 0.34, y - r * 0.38, r * 0.04, x, y, r * 1.05);
      g.addColorStop(0, 'rgba(255,255,252,0.85)');
      g.addColorStop(0.45, 'rgba(255,250,238,0.34)');
      g.addColorStop(0.86, 'rgba(228,206,168,0.26)');
      g.addColorStop(1, 'rgba(228,206,168,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r, 0, 0, U.TAU); ctx.fill();
      /* 下の縁のやわらかい影 */
      ctx.strokeStyle = 'rgba(186,152,106,0.28)';
      ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.86, r * 0.80, 0, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      /* きらり */
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.36, r * 0.20, r * 0.13, -0.6, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* 指の生の軌跡（クープ中） */
  function drawTrail(ctx) {
    if (!G.trail.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const w = G.L.mn * 0.012;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = w * 1.9;
    ctx.beginPath();
    for (let i = 0; i < G.trail.length; i++) {
      const p = G.trail[i];
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,190,0.95)';
    ctx.lineWidth = w * 0.85;
    ctx.stroke();
    ctx.restore();
  }

  function drawFlashes(ctx) {
    for (let i = 0; i < G.flashes.length; i++) {
      const f = G.flashes[i];
      const a = 1 - f.t;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,255,255,${(a * 0.85).toFixed(3)})`;
      ctx.lineWidth = G.L.mn * 0.010 * (1 + f.t * 1.6);
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---- ヒント ---- */
  function drawHints(ctx) {
    const L = G.L, st = G.stage, t = G.time;
    if (G.idleT < 0.7) return;
    const alpha = U.clamp((G.idleT - 0.7) / 0.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const hs = L.mn / 420;

    if (st === 'place' && G.dropK <= 0) {
      UI.hintTap(ctx, L.benchCenter.x, L.benchCenter.y, t, hs);
    } else if (st === 'press') {
      const b = G.bubbles.find((x) => x.pop <= 0);
      if (b) {
        const d = G.loaf.dims();
        const p = toScreen(b.u * d.hl, b.v * d.R * 0.7);
        UI.hintTap(ctx, p.x, p.y, t, hs);
      }
    } else if (st === 'roll') {
      const d = G.loaf.dims();
      const a = toScreen(0, d.R * 2.0), b = toScreen(0, -d.R * 2.0);
      UI.hintSwipe(ctx, a.x, a.y, b.x, b.y, t, hs);
    } else if (st === 'stretch') {
      const d = G.loaf.dims();
      const a = toScreen(-d.hl * 0.95, 0), b = toScreen(d.hl * 0.95, 0);
      const k = Math.floor(t * 0.62) % 2;
      if (k) UI.hintSwipe(ctx, a.x, a.y, b.x, b.y, t, hs);
      else UI.hintSwipe(ctx, b.x, b.y, a.x, a.y, t, hs);
    } else if (st === 'couche') {
      const a = { x: G.cam.x, y: G.cam.y };
      UI.hintSwipe(ctx, a.x, a.y, L.cloth.x, L.cloth.y, t, hs);
    } else if (st === 'score') {
      const d = G.loaf.dims();
      const n = G.loaf.scores.length;
      const maxN = G.freeMode ? 5 : 5;
      if (n < maxN) {
        const tt = 0.22 + n * 0.18;
        const cx = (tt * 2 - 1) * d.hl;
        const ang = (G.loaf.scores.length ? G.loaf.lean : -1) * 0.36;
        const half = 0.22 * d.hl;
        const a = toScreen(cx - Math.cos(ang) * half, -Math.sin(ang) * half);
        const b = toScreen(cx + Math.cos(ang) * half, Math.sin(ang) * half);
        UI.hintSwipe(ctx, a.x, a.y, b.x, b.y, t, hs);
      }
    } else if (st === 'load' && G.slideK <= 0) {
      const o = L.ovenIn;
      const a = { x: G.cam.x, y: G.cam.y };
      UI.hintSwipe(ctx, a.x, a.y, o.x + o.w * 0.5, o.y + o.h * 0.62, t, hs);
    } else if (st === 'out' && G.slideK <= 0) {
      const a = { x: G.cam.x, y: G.cam.y };
      UI.hintSwipe(ctx, a.x, a.y, L.coolPos.x, L.coolPos.y, t, hs);
    } else if (st === 'tap') {
      const p = toScreen(U.rr(-0.02, 0.02), 0);
      UI.hintTap(ctx, G.cam.x, G.cam.y, t, hs * 1.2);
    }
    ctx.restore();
  }

  function draw() {
    const ctx = G.ctx, L = G.L, t = G.time, st = G.stage;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);

    Scene.background(ctx, L, t);

    const benchStages = ['menu', 'place', 'press', 'roll', 'stretch', 'couche', 'proof', 'score', 'out', 'tap', 'done'];
    const ovenStages = ['load', 'steam', 'bake'];

    if (benchStages.indexOf(st) >= 0) {
      Scene.baker(ctx, L.baker.x, L.baker.y, L.baker.s, t, st === 'done' ? 'happy' : '');
      Scene.bench(ctx, L);
    }

    if (st === 'menu') {
      Scene.shelf(ctx, L, G.loaves, t);
      /* 見本のバゲット（焼き上がり） */
      if (!G.demoLoaf) {
        G.demoLoaf = new Loaf('normal', 4242);
        G.demoLoaf.press = 1; G.demoLoaf.roll = 1; G.demoLoaf.stretch = 1; G.demoLoaf.proof = 1;
        for (let i = 0; i < 4; i++) {
          const tt = 0.2 + i * 0.2;
          G.demoLoaf.addScore((tt * 2 - 1) - 0.16, 0.05, (tt * 2 - 1) + 0.16, -0.05, 0.3, false);
          G.demoLoaf.scores[i].settle = 1;
        }
        G.demoLoaf.bake = 0.88; G.demoLoaf.cool = 1;
      }
      ctx.save();
      ctx.translate(L.w * 0.5, L.h * (L.portrait ? 0.19 : 0.24));
      ctx.rotate(-0.08 + Math.sin(t * 0.7) * 0.02);
      const ds = Math.min(L.w * 0.30, L.h * (L.portrait ? 0.20 : 0.30));
      ctx.scale(ds, ds);
      G.demoLoaf.draw(ctx, {});
      ctx.restore();
      G.buttons.menu.forEach((b) => UI.button(ctx, b, t));
      UI.button(ctx, G.buttons.sound, t);
      G.parts.draw(ctx);
      return;
    }

    /* --- 発酵布 --- */
    if (st === 'couche' || st === 'proof' || st === 'score') {
      Scene.cloth(ctx, L, { folds: L.sibs ? L.sibs + 2 : 3 });
    }

    /* --- ラック --- */
    if (st === 'out' || st === 'tap' || st === 'done') {
      const c = G.cam;
      const nx = -Math.sin(c.ang), ny = Math.cos(c.ang);
      const off = c.unit * L.groupR * 1.10;
      const spec2 = Loaf.TYPES[G.typeKey] || Loaf.TYPES.normal;
      Scene.rack(ctx, {
        x: c.x + nx * off, y: c.y + ny * off, ang: c.ang,
        w: c.unit * spec2.len * 2.20, h: Math.max(10, c.unit * 0.085),
      });
    }

    /* --- オーブン --- */
    if (ovenStages.indexOf(st) >= 0) {
      Scene.ovenInterior(ctx, L, G.heat, t);
    }

    /* --- ピール（板） --- */
    if (st === 'load' && G.slideK < 0.5) {
      const k = 1 - U.smooth(U.range(G.slideK, 0.0, 0.5));
      ctx.save();
      ctx.globalAlpha = k;
      Scene.peel(ctx, G.cam.x, G.cam.y + G.cam.unit * 0.19, G.cam.unit * 2.2, G.cam.unit * 0.30, G.cam.ang);
      ctx.restore();
    }

    /* --- バゲット --- */
    if (G.loaf) {
      const inOven = ovenStages.indexOf(st) >= 0;
      if (inOven) {
        ctx.save();
        const o = L.ovenIn;
        U.roundRect(ctx, o.x, o.y, o.w, o.h, Math.min(o.w, o.h) * 0.06);
        ctx.clip();
      }

      let yOff = 0;
      if (st === 'place' && G.dropK < 1) {
        const k = U.clamp(G.dropK / 0.62, 0, 1);
        yOff = -(1 - U.easeIn(k)) * L.h * 0.36;
        if (G.dropK > 0.62) {
          const b = U.range(G.dropK, 0.62, 1);
          yOff = Math.sin(b * Math.PI) * -L.h * 0.012;
        }
      } else if (G.dropK <= 0 && st === 'place') {
        yOff = -L.h * 0.36;
      }

      drawLoafAt(ctx, 1, yOff);
      drawSeam(ctx);
      drawBubbles(ctx);

      /* 焼成中：パンにあたる熱の光 */
      if (st === 'bake' || st === 'steam') {
        const glow = 0.16 + 0.22 * G.heat;
        const gr = ctx.createRadialGradient(G.cam.x, G.cam.y, G.cam.unit * 0.05, G.cam.x, G.cam.y, G.cam.unit * 1.5);
        gr.addColorStop(0, `rgba(255,190,110,${(glow * 0.35).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(L.ovenIn.x, L.ovenIn.y, L.ovenIn.w, L.ovenIn.h);
      }

      if (inOven) {
        G.parts.draw(ctx);
        ctx.restore();
        Scene.ovenFrame(ctx, L, G.doorK, t);
      }
    }

    if (ovenStages.indexOf(st) < 0) G.parts.draw(ctx);

    drawFlashes(ctx);
    drawTrail(ctx);

    /* lame（クープ中は指の先に） */
    if (st === 'score') {
      let lx, ly, la;
      if (G.cutting && G.trail.length > 1) {
        const p = G.trail[G.trail.length - 1];
        const q = G.trail[Math.max(0, G.trail.length - 6)];
        lx = p.x; ly = p.y; la = Math.atan2(p.y - q.y, p.x - q.x) + Math.PI / 2;
      } else {
        /* 使っていないときは、台のすみに立てかけておく */
        lx = L.portrait ? L.w * 0.155 : L.w * 0.075;
        ly = (L.portrait ? L.h * 0.90 : L.h * 0.86) + Math.sin(t * 1.8) * L.mn * 0.008;
        la = -0.42 + Math.sin(t * 1.1) * 0.05;
      }
      Scene.lame(ctx, lx, ly, la, L.mn * 0.0028, G.cutting);
    }

    /* できあがりのお祝い */
    if (st === 'done' && G.celebrateT < 3.2) {
      ctx.save();
      ctx.globalAlpha = U.clamp(1 - (G.celebrateT - 2.2) / 1.0, 0, 1);
      UI.celebrate(ctx, L, G.celebrateT);
      ctx.restore();
    }

    drawHints(ctx);

    /* UI */
    activeButtons().forEach((b) => UI.button(ctx, b, t));
    const si = STAGES.indexOf(st);
    if (si >= 0) UI.steps(ctx, L, si, STAGES.length);
    if (st === 'done') UI.steps(ctx, L, STAGES.length - 1, STAGES.length);
  }

  /* =========================================================
     初期化・ループ
     ========================================================= */
  function resize() {
    const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    const w = Math.round(G.canvas.clientWidth);
    const h = Math.round(G.canvas.clientHeight);
    if (!w || !h) return;
    G.dpr = dpr; G.w = w; G.h = h;
    G.canvas.width = Math.round(w * dpr);
    G.canvas.height = Math.round(h * dpr);
    G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    updateCamTarget(true);
  }
  G.resize = resize;

  function frame(ts) {
    if (!G.last) G.last = ts;
    let dt = (ts - G.last) / 1000;
    G.last = ts;
    dt = U.clamp(dt, 0, 0.05);
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  G.init = function () {
    G.canvas = document.getElementById('game');
    G.ctx = G.canvas.getContext('2d');
    G.parts = new Scene.Particles();
    G.loaf = new Loaf('normal');
    resize();
    setStage('menu');
    updateCamTarget(true);

    global.addEventListener('resize', resize);
    global.addEventListener('orientationchange', () => setTimeout(resize, 120));
    if (global.visualViewport) global.visualViewport.addEventListener('resize', resize);

    const c = G.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { c.setPointerCapture && c.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      onDown(e);
    }, { passive: false });
    c.addEventListener('pointermove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
    c.addEventListener('pointerup', (e) => { e.preventDefault(); onUp(e); }, { passive: false });
    c.addEventListener('pointercancel', () => { G.ptr.down = false; Sfx.frictionStop(); });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    requestAnimationFrame(frame);
  };

  G.STAGES = STAGES;
  global.Game = G;
})(window);

window.addEventListener('load', () => window.Game.init());
