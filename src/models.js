/* 空港グランドハンドリング — 3Dモデル構築 */
(function (AG) {
  'use strict';
  const M = AG.M, G = AG.G, T = AG.T, Obj = AG.Obj;
  const Mo = (AG.Models = {});
  const PI = Math.PI;

  /* sRGB hex -> リニア色 */
  function C(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.pow(v / 255, 2.2) * (k === undefined ? 1 : k);
    return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
  }
  Mo.C = C;

  Mo.materials = function (R) {
    const tex = {
      apron: R.texture(T.apron(), { repeat: true }),
      gate: R.texture(T.gateMarks()),
      fuse: R.texture(T.fuselage()),
      fin: R.texture(T.fin()),
      term: R.texture(T.terminal(), { repeat: true }),
      wear: R.texture(T.wear(21, 1.0), { repeat: true }),
      wearLight: R.texture(T.wear(77, 0.45), { repeat: true }),
      tread: R.texture(T.tread(), { repeat: true }),
      hazard: R.texture(T.hazard('#e8b81c', '#16181b'), { repeat: true }),
      hazardR: R.texture(T.hazard('#e8e6e2', '#b8352a'), { repeat: true }),
      belt: R.texture(T.belt(), { repeat: true }),
      tire: R.texture(T.tire(), { repeat: true }),
      grass: R.texture(T.grass(), { repeat: true }),
      bagA: R.texture(T.bag('#b8412f')),
      bagB: R.texture(T.bag('#2f5d8c')),
      bagC: R.texture(T.bag('#4c7a44')),
      aoSoft: R.texture(T.aoBlob(0.30, 1.25)),
      aoTight: R.texture(T.aoBlob(0.14, 2.1)),
    };
    const m = {
      apron: { color: C('#ffffff'), map: tex.apron, uvRep: [240, 240], gloss: 0.10, shine: 12 },
      gate: { color: C('#ffffff'), map: tex.gate, alpha: 0.97, gloss: 0.06, noShadow: true },
      grass: { color: C('#ffffff'), map: tex.grass, uvRep: [90, 90], gloss: 0.04 },

      fuse: { color: C('#ffffff'), map: tex.fuse, gloss: 0.40, shine: 130, metal: 0.10, coat: 0.42 },
      finM: { color: C('#ffffff'), map: tex.fin, gloss: 0.36, shine: 120, coat: 0.40 },
      white: { color: C('#e8ebee'), gloss: 0.36, shine: 120, coat: 0.38 },
      alum: { color: C('#b4b9bf'), gloss: 0.62, shine: 96, metal: 0.55 },
      engine: { color: C('#dfe3e7'), gloss: 0.38, shine: 130, metal: 0.18, coat: 0.45 },
      engDark: { color: C('#1b1e22'), gloss: 0.45, shine: 60, metal: 0.6 },
      navy: { color: C('#123a72'), gloss: 0.55, shine: 80 },
      red: { color: C('#c0392b'), gloss: 0.5, shine: 60 },
      chrome: { color: C('#d4dae0'), gloss: 0.98, shine: 260, metal: 0.95 },
      gearMetal: { color: C('#868d95'), gloss: 0.34, shine: 46, metal: 0.80 },
      tire: { color: C('#d8d8dc'), map: tex.tire, uvRep: [6, 1], gloss: 0.07, shine: 12 },
      glass: { color: C('#0d1218'), gloss: 0.95, shine: 240, metal: 0.5, coat: 0.8 },
      glassBlue: { color: C('#46647f'), gloss: 0.95, shine: 240, alpha: 0.5, coat: 0.9 },

      term: { color: C('#ffffff'), map: tex.term, uvRep: [8, 1], gloss: 0.45, shine: 70 },
      concrete: { color: C('#aeaaa3'), gloss: 0.03, shine: 8 },
      hill: { color: C('#40575f'), gloss: 0.04, shine: 10 },

      /* --- 材質の類別 --------------------------------------------------
         塗装鋼板(coat付き) / 亜鉛メッキ / アルミ / 塗装シャシー / ゴム   */
      paintW: { color: C('#eef1f4'), map: tex.wear, uvRep: [2, 2], gloss: 0.42, shine: 120, metal: 0.05, coat: 0.55 },
      paintY: { color: C('#e9b81a'), map: tex.wear, uvRep: [2, 2], gloss: 0.40, shine: 110, metal: 0.05, coat: 0.50 },
      paintOr: { color: C('#e0701c'), map: tex.wear, uvRep: [2, 2], gloss: 0.40, shine: 110, metal: 0.05, coat: 0.50 },
      paintBl: { color: C('#1d4d84'), map: tex.wear, uvRep: [2, 2], gloss: 0.40, shine: 110, metal: 0.05, coat: 0.50 },
      paintRd: { color: C('#b23428'), map: tex.wear, uvRep: [2, 2], gloss: 0.40, shine: 110, metal: 0.05, coat: 0.50 },
      paintGn: { color: C('#2c6b4a'), map: tex.wear, uvRep: [2, 2], gloss: 0.38, shine: 100, metal: 0.05, coat: 0.45 },
      galv: { color: C('#9199a1'), map: tex.wear, uvRep: [3, 3], gloss: 0.26, shine: 30, metal: 0.80 },
      alu: { color: C('#bcc3ca'), map: tex.wearLight, uvRep: [2, 2], gloss: 0.42, shine: 58, metal: 0.85 },
      chassis: { color: C('#31363c'), map: tex.wear, uvRep: [3, 3], gloss: 0.18, shine: 24, metal: 0.35 },
      rubber: { color: C('#1a1b1f'), gloss: 0.05, shine: 10 },
      tread: { color: C('#ffffff'), map: tex.tread, uvRep: [1, 1], gloss: 0.22, shine: 34, metal: 0.6 },
      hazard: { color: C('#ffffff'), map: tex.hazard, uvRep: [1, 1], gloss: 0.32, shine: 60, coat: 0.30 },
      hazardR: { color: C('#ffffff'), map: tex.hazardR, uvRep: [1, 1], gloss: 0.32, shine: 60, coat: 0.30 },
      /* 旧名の互換（順次置き換え） */
      darkMetal: { color: C('#31363c'), map: tex.wear, uvRep: [3, 3], gloss: 0.18, shine: 24, metal: 0.35 },
      panel: { color: C('#9199a1'), map: tex.wear, uvRep: [3, 3], gloss: 0.26, shine: 30, metal: 0.80 },
      panelY: { color: C('#e9b81a'), map: tex.wear, uvRep: [2, 2], gloss: 0.40, shine: 110, metal: 0.05, coat: 0.50 },
      panelW: { color: C('#eef1f4'), map: tex.wear, uvRep: [2, 2], gloss: 0.42, shine: 120, metal: 0.05, coat: 0.55 },
      belt: { color: C('#ffffff'), map: tex.belt, uvRep: [1, 6], gloss: 0.14, shine: 18 },

      hiVis: { color: C('#d8e83a'), gloss: 0.3, shine: 30, emissive: C('#3a4008', 0.10) },
      reflect: { color: C('#dfe4e8'), gloss: 0.85, shine: 150, emissive: C('#5a6068', 0.18) },
      skin: { color: C('#e0b295'), gloss: 0.2, shine: 24 },
      cloth: { color: C('#2b3a4a'), gloss: 0.12, shine: 18 },
      boot: { color: C('#23242a'), gloss: 0.25, shine: 30 },
      helmet: { color: C('#f0f2f4'), gloss: 0.6, shine: 80 },
      earmuff: { color: C('#d64a2a'), gloss: 0.35, shine: 40 },

      chock: { color: C('#e8721c'), gloss: 0.35, shine: 40 },
      chockDark: { color: C('#7a3a0c'), gloss: 0.3, shine: 30 },
      rope: { color: C('#e8e2d0'), gloss: 0.2, shine: 20 },

      wandGlow: { color: C('#ff8c2a'), emissive: C('#ff7a10', 2.4), gloss: 0.5, shine: 60, alpha: 0.92 },
      wandBody: { color: C('#2a2c30'), gloss: 0.4, shine: 50 },

      hoseBlack: { color: C('#1d1f23'), gloss: 0.10, shine: 16 },
      cableRed: { color: C('#8d2b20'), gloss: 0.35, shine: 44 },
      plugYellow: { color: C('#e8b21c'), gloss: 0.55, shine: 80 },
      bagA: { color: C('#ffffff'), map: tex.bagA, gloss: 0.35, shine: 40 },
      bagB: { color: C('#ffffff'), map: tex.bagB, gloss: 0.35, shine: 40 },
      bagC: { color: C('#ffffff'), map: tex.bagC, gloss: 0.35, shine: 40 },

      lightRed: { color: C('#ff2020'), emissive: C('#ff1010', 2.2), gloss: 0.5 },
      lightGreen: { color: C('#20ff40'), emissive: C('#10ff30', 2.0), gloss: 0.5 },
      lightWhite: { color: C('#ffffff'), emissive: C('#ffffff', 2.4), gloss: 0.5 },
      lightAmber: { color: C('#ffb020'), emissive: C('#ffa000', 2.4), gloss: 0.5 },
      lampGlass: { color: C('#fff0c0'), emissive: C('#ffe8b0', 1.6), gloss: 0.7 },

      guideOK: { color: C('#3fe07a'), emissive: C('#20e060', 1.5), alpha: 0.55, noShadow: true, doubleSided: true },
      guideDir: { color: C('#ffd23a'), emissive: C('#ffb800', 1.4), alpha: 0.7, noShadow: true, doubleSided: true },
      ghost: { color: C('#ffffff'), emissive: C('#ffffff', 0.9), alpha: 0.30, noShadow: true, doubleSided: true },
      shadowBlob: { color: C('#000000'), alpha: 0.28, noShadow: true, doubleSided: true },
      /* 接触・環境遮蔽デカール（乗算合成） */
      aoSoft: { map: tex.aoSoft, decal: true, strength: 0.85, noShadow: true },
      aoTight: { map: tex.aoTight, decal: true, strength: 1.0, noShadow: true },
    };
    return { tex, mat: m };
  };

  /* 材質ごとにジオメトリをまとめ、描画コールを抑える */
  function Builder() { this.g = new Map(); }
  Builder.prototype.add = function (mat, geo) {
    if (!this.g.has(mat)) this.g.set(mat, []);
    this.g.get(mat).push(geo);
    return this;
  };
  Builder.prototype.build = function (R, parent, cast) {
    for (const [mat, list] of this.g) {
      const o = new Obj(R.mesh(G.merge(list)), mat);
      o.cast = cast !== false;
      parent.add(o);
    }
    return parent;
  };
  Mo.Builder = Builder;

  /* 地面へ落とす接触/環境遮蔽デカール */
  let aoMeshCache = null;
  Mo.ao = function (R, MAT, w, d, opt) {
    opt = opt || {};
    if (!aoMeshCache) aoMeshCache = R.mesh(G.plane(1, 1, 1, 1));
    const o = new Obj(aoMeshCache, opt.tight ? MAT.aoTight : MAT.aoSoft);
    o.cast = false;
    o.setScale(w, 1, d);
    o.setPos(opt.x || 0, opt.y === undefined ? 0.028 : opt.y, opt.z || 0);
    if (opt.strength !== undefined) {
      o.mat = Object.assign({}, o.mat);
      o.mat.strength = opt.strength;
    }
    return o;
  };

  /* ============ 車輪 ============ */
  function wheelGeo(r, halfW, hubR) {
    /* リムシート → サイドウォールの膨らみ → ショルダー → トレッド */
    const prof = [
      [hubR, -halfW * 0.94],
      [r * 0.66, -halfW * 1.00],
      [r * 0.90, -halfW * 0.96],
      [r * 0.985, -halfW * 0.74],
      [r, -halfW * 0.58],
      [r, halfW * 0.58],
      [r * 0.985, halfW * 0.74],
      [r * 0.90, halfW * 0.96],
      [r * 0.66, halfW * 1.00],
      [hubR, halfW * 0.94],
    ];
    return G.rot(G.lathe(prof, 24), 0, 0, PI / 2);
  }
  function hubGeo(hubR, halfW) {
    const parts = [
      /* リム本体 */
      G.rot(G.lathe([
        [hubR * 0.35, -halfW * 0.9], [hubR * 0.9, -halfW * 0.95], [hubR, -halfW * 0.86],
        [hubR * 0.86, -halfW * 0.3], [hubR * 0.86, halfW * 0.3],
        [hubR, halfW * 0.86], [hubR * 0.9, halfW * 0.95], [hubR * 0.35, halfW * 0.9],
      ], 20), 0, 0, PI / 2),
      /* ハブキャップ */
      G.place(G.cyl(hubR * 0.34, hubR * 0.30, halfW * 0.5, 12), [halfW * 0.92, 0, 0], [0, 0, PI / 2]),
    ];
    /* ホイールボルト */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      parts.push(G.place(G.cyl(hubR * 0.10, hubR * 0.10, halfW * 0.36, 6),
        [halfW * 0.90, Math.cos(a) * hubR * 0.52, Math.sin(a) * hubR * 0.52], [0, 0, PI / 2]));
    }
    return G.merge(parts);
  }

  function makeWheel(R, MAT, r, halfW) {
    const hubR = r * 0.46;
    const o = new Obj(R.mesh(wheelGeo(r, halfW, hubR)), MAT.tire);
    const hub = new Obj(R.mesh(hubGeo(hubR, halfW)), MAT.gearMetal);
    o.add(hub);
    o.userData = { r, halfW };
    return o;
  }

  /* 車輪の接地デカールを親ノードへ追加する（車輪自体は回転するため） */
  function wheelContact(R, MAT, parent, wheels) {
    for (const w of wheels) {
      const r = w.userData.r, hw = w.userData.halfW;
      const axisZ = Math.abs(w.r[1]) > 0.5;      /* r[1]=PI/2 なら車軸がZ方向 */
      const a = Mo.ao(R, MAT, axisZ ? r * 2.9 : hw * 5.2, axisZ ? hw * 5.2 : r * 2.9,
        { x: w.p[0], z: w.p[2], y: 0.022, tight: true, strength: 0.95 });
      parent.add(a);
    }
  }
  Mo.wheelContact = wheelContact;

  /* ============ 旅客機 ============ */
  Mo.aircraft = function (R, MAT) {
    const root = new Obj();
    root.name = 'aircraft';
    const b = new Builder();
    const FR = 1.98;           /* 胴体半径 */
    const AXIS = 3.22;         /* 胴体中心高さ */
    const LEN = 37.6;

    /* --- 胴体 --- */
    const sec = [
      { z: 0.00, r: 0.03, y: 0.30 }, { z: -0.30, r: 0.48, y: 0.26 },
      { z: -0.85, r: 0.92, y: 0.20 }, { z: -1.60, r: 1.33, y: 0.13 },
      { z: -2.60, r: 1.66, y: 0.06 }, { z: -3.90, r: 1.88, y: 0.02 },
      { z: -5.40, r: 1.97, y: 0.00 }, { z: -10.0, r: FR, y: 0 },
      { z: -18.0, r: FR, y: 0 }, { z: -25.0, r: FR, y: 0 },
      { z: -28.2, r: 1.94, y: 0.12 }, { z: -30.6, r: 1.80, y: 0.42 },
      { z: -32.8, r: 1.52, y: 0.95 }, { z: -34.8, r: 1.14, y: 1.62 },
      { z: -36.4, r: 0.70, y: 2.24 }, { z: -37.3, r: 0.30, y: 2.72 },
      { z: -37.6, r: 0.05, y: 2.86 },
    ];
    for (const s of sec) { s.y += AXIS; s.sy = 1.02; }
    b.add(MAT.fuse, G.hull(sec, 30));

    /* --- 主翼 --- */
    const wingOpt = { span: 16.4, rootChord: 6.4, tipChord: 1.7, sweep: 25 * PI / 180, dihedral: 5.5 * PI / 180, thick: 0.115, ribs: 7 };
    const wR = G.place(G.wing(wingOpt), [1.4, AXIS - 1.45, -13.6]);
    const wL = G.place(G.scale(G.wing(wingOpt), -1, 1, 1), [-1.4, AXIS - 1.45, -13.6]);
    b.add(MAT.white, wR); b.add(MAT.white, wL);
    /* 翼胴フェアリング */
    b.add(MAT.white, G.place(G.scale(G.sphere(1, 20, 12), 3.1, 1.5, 7.6), [0, AXIS - 1.55, -16.4]));
    /* ウィングレット */
    for (const s of [1, -1]) {
      const wl = G.wing({ span: 2.3, rootChord: 1.7, tipChord: 0.75, sweep: 38 * PI / 180, dihedral: 0, thick: 0.10, ribs: 3 });
      G.rot(wl, 0, 0, PI / 2 * s * 0.98);
      G.trans(wl, s * (1.4 + 16.4), AXIS - 1.45 + 16.4 * Math.tan(5.5 * PI / 180), -13.6 - 16.4 * Math.tan(25 * PI / 180));
      b.add(MAT.navy, wl);
    }
    /* フラップトラックフェアリング */
    for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
      const f = 0.22 + i * 0.20;
      const x = s * (1.4 + f * 16.4);
      const z = -13.6 - f * 16.4 * Math.tan(25 * PI / 180) - (6.4 + (1.7 - 6.4) * f) * 0.82;
      const y = AXIS - 1.45 + f * 16.4 * Math.tan(5.5 * PI / 180) - 0.28;
      const fair = G.rot(G.lathe([[0.02, -1.9], [0.22, -1.1], [0.30, 0.2], [0.20, 1.1], [0.02, 1.5]], 10), PI / 2, 0, 0);
      b.add(MAT.white, G.place(fair, [x, y, z], [0, 0, 0], [1, 1, 1]));
    }

    /* --- 尾翼 --- */
    const finG = G.wing({ span: 6.6, rootChord: 5.6, tipChord: 2.4, sweep: 40 * PI / 180, dihedral: 0, thick: 0.11, ribs: 5 });
    G.rot(finG, 0, 0, PI / 2);
    G.trans(finG, 0, AXIS + 1.55, -30.4);
    b.add(MAT.finM, finG);
    const stabOpt = { span: 5.9, rootChord: 3.6, tipChord: 1.3, sweep: 31 * PI / 180, dihedral: 6 * PI / 180, thick: 0.10, ribs: 4 };
    b.add(MAT.white, G.place(G.wing(stabOpt), [0.6, AXIS + 1.5, -33.2]));
    b.add(MAT.white, G.place(G.scale(G.wing(stabOpt), -1, 1, 1), [-0.6, AXIS + 1.5, -33.2]));
    /* APU排気 */
    b.add(MAT.engDark, G.place(G.cyl(0.26, 0.32, 0.7, 14), [0, AXIS + 2.86, -37.55], [PI / 2, 0, 0]));

    /* --- エンジン --- */
    const engRefs = [];
    for (const s of [1, -1]) {
      const ex = s * 5.55, ez = -13.9, ey = AXIS - 2.42;
      /* ナセル外皮 → リップを回り込み → 吸気ダクト内面（開口している） */
      const nac = G.rot(G.lathe([
        [0.66, -2.34], [0.90, -2.12], [1.04, -1.78],
        [1.30, -1.20], [1.35, -0.20], [1.31, 0.86], [1.22, 1.60], [1.13, 2.06], [1.06, 2.26],
        [1.00, 2.35],
        [0.96, 2.28], [0.94, 2.10], [0.97, 1.88], [1.00, 1.72],
      ], 26), PI / 2, 0, 0);
      b.add(MAT.engine, G.place(nac, [ex, ey, ez]));
      /* リップの金属光沢 */
      b.add(MAT.chrome, G.place(G.rot(G.lathe([[1.045, 2.29], [1.00, 2.355], [0.958, 2.30]], 26), PI / 2, 0, 0), [ex, ey, ez]));
      /* ダクト奥の暗がり */
      b.add(MAT.engDark, G.place(G.rot(G.cyl(0.99, 0.99, 0.5, 24, false, false), PI / 2, 0, 0), [ex, ey, ez + 1.6]));
      /* ファン */
      const fan = new Obj(R.mesh(fanGeo()), MAT.engDark);
      fan.setPos(ex, ey, ez + 1.62);
      root.add(fan); engRefs.push(fan);
      /* 排気コーン */
      b.add(MAT.engDark, G.place(G.rot(G.lathe([[0.62, -0.5], [0.55, 0.4], [0.30, 1.1], [0.02, 1.5]], 16), PI / 2, 0, 0), [ex, ey, ez - 2.6]));
      b.add(MAT.engDark, G.place(G.rot(G.cyl(0.92, 0.86, 0.9, 20, false, false), PI / 2, 0, 0), [ex, ey, ez - 2.65]));
      /* パイロン */
      b.add(MAT.white, G.place(G.box(0.44, 1.55, 3.2), [ex, ey + 1.45, ez - 0.7]));
      b.add(MAT.white, G.place(G.scale(G.sphere(1, 14, 8), 0.42, 0.55, 1.5), [ex, ey + 2.18, ez - 1.5]));
      /* エンジン下の擦り傷・帯 */
      b.add(MAT.navy, G.place(G.rot(G.cyl(1.345, 1.345, 0.34, 24, false, false), PI / 2, 0, 0), [ex, ey, ez - 0.5]));
    }
    function fanGeo() {
      const parts = [G.rot(G.cyl(0.96, 0.96, 0.08, 24), PI / 2, 0, 0)];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * PI * 2;
        const bl = G.box(0.13, 0.72, 0.045);
        G.place(bl, [Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0.07], [0, 0.55, a + PI / 2]);
        parts.push(bl);
      }
      /* スピナー（渦巻き印の代わりに白い螺旋帯） */
      parts.push(G.place(G.rot(G.lathe([[0.0, 0], [0.15, 0.09], [0.19, 0.24], [0.11, 0.40], [0.0, 0.47]], 12), -PI / 2, 0, 0), [0, 0, 0.14]));
      return G.merge(parts);
    }

    /* --- 脚 --- */
    const wheels = [];
    /* 前脚 */
    const NG_Z = -4.35;
    b.add(MAT.gearMetal, G.place(G.cyl(0.18, 0.20, 1.55, 14), [0, 0.98, NG_Z]));
    b.add(MAT.chrome, G.place(G.cyl(0.145, 0.145, 0.72, 14), [0, 0.62, NG_Z]));
    b.add(MAT.gearMetal, G.place(G.box(0.10, 0.62, 0.16), [0, 0.72, NG_Z + 0.24], [0.5, 0, 0]));
    b.add(MAT.gearMetal, G.place(G.cyl(0.09, 0.09, 0.86, 10), [0, 0.42, NG_Z], [0, 0, PI / 2]));
    /* 前脚まわりの補機（胴体内に収める） */
    b.add(MAT.darkMetal, G.place(G.box(0.52, 0.40, 1.10), [0, 2.30, NG_Z]));
    /* トーイング用の牽引点 */
    b.add(MAT.gearMetal, G.place(G.cyl(0.07, 0.07, 1.02, 10), [0, 0.30, NG_Z - 0.02], [0, 0, PI / 2]));
    for (const s of [1, -1]) {
      const w = makeWheel(R, MAT, 0.44, 0.14);
      w.setPos(s * 0.30, 0.44, NG_Z);
      root.add(w); wheels.push(w);
    }
    /* 主脚 */
    const MG_Z = -18.6;
    for (const s of [1, -1]) {
      const mx = s * 3.75;
      b.add(MAT.gearMetal, G.place(G.cyl(0.24, 0.27, 1.85, 14), [mx, 1.40, MG_Z], [0, 0, -s * 0.05]));
      b.add(MAT.chrome, G.place(G.cyl(0.20, 0.20, 0.85, 14), [mx + s * 0.03, 0.80, MG_Z]));
      b.add(MAT.gearMetal, G.place(G.box(0.13, 0.80, 0.20), [mx, 0.95, MG_Z + 0.34], [0.45, 0, 0]));
      b.add(MAT.gearMetal, G.place(G.cyl(0.12, 0.12, 1.55, 10), [mx, 0.62, MG_Z], [0, 0, PI / 2]));
      b.add(MAT.darkMetal, G.place(G.box(0.86, 0.72, 1.9), [mx * 0.46, 2.42, MG_Z]));
      b.add(MAT.gearMetal, G.place(G.cyl(0.10, 0.10, 2.5, 8), [mx * 0.86, 2.0, MG_Z], [0, 0, PI / 2 + s * 0.35]));
      /* 油圧・ブレーキ配管 */
      for (const t of [1, -1]) {
        b.add(MAT.chrome, G.place(G.cyl(0.028, 0.028, 1.5, 6), [mx + t * 0.10, 1.32, MG_Z + 0.20]));
        b.add(MAT.hoseBlack, G.place(G.cyl(0.022, 0.022, 0.62, 6), [mx + t * 0.34, 0.78, MG_Z + 0.16], [0, 0, -t * 0.42]));
      }
      /* ドラッグブレース */
      b.add(MAT.gearMetal, G.place(G.cyl(0.075, 0.075, 1.9, 8), [mx, 1.55, MG_Z - 0.62], [0.42, 0, 0]));
      for (const t of [1, -1]) {
        const w = makeWheel(R, MAT, 0.62, 0.21);
        w.setPos(mx + t * 0.50, 0.62, MG_Z);
        root.add(w); wheels.push(w);
        /* ブレーキディスクスタック（内側の面に見える） */
        const bx = mx + t * 0.50 - t * 0.20;
        b.add(MAT.engDark, G.place(G.cyl(0.30, 0.30, 0.16, 16), [bx, 0.62, MG_Z], [0, 0, PI / 2]));
        for (let k = 0; k < 4; k++) {
          b.add(MAT.gearMetal, G.place(G.cyl(0.315, 0.315, 0.018, 16),
            [bx - t * 0.06 + t * k * 0.04, 0.62, MG_Z], [0, 0, PI / 2]));
        }
      }
    }

    /* --- 灯火 --- */
    const lights = {};
    function lamp(mat, x, y, z, r) {
      const o = new Obj(R.mesh(G.sphere(r || 0.14, 10, 6)), mat);
      o.setPos(x, y, z); o.cast = false; root.add(o);
      return o;
    }
    const tipY = AXIS - 1.45 + 16.4 * Math.tan(5.5 * PI / 180) + 0.9;
    const tipZ = -13.6 - 16.4 * Math.tan(25 * PI / 180) - 0.9;
    lights.navL = lamp(MAT.lightRed, -(1.4 + 16.3), tipY, tipZ);
    lights.navR = lamp(MAT.lightGreen, (1.4 + 16.3), tipY, tipZ);
    lights.beaconTop = lamp(MAT.lightRed, 0, AXIS + FR + 0.08, -12.0, 0.13);
    lights.beaconBot = lamp(MAT.lightRed, 0, AXIS - FR - 0.06, -12.0, 0.13);
    lights.taxi = lamp(MAT.lightWhite, 0, 1.85, NG_Z - 0.42, 0.16);
    lights.landL = lamp(MAT.lightWhite, -3.0, AXIS - 1.75, -12.6, 0.17);
    lights.landR = lamp(MAT.lightWhite, 3.0, AXIS - 1.75, -12.6, 0.17);
    lights.logo = lamp(MAT.lightWhite, 0, AXIS + 1.7, -29.6, 0.10);

    b.build(R, root);
    /* 接地・環境遮蔽 */
    wheelContact(R, MAT, root, wheels);
    root.add(Mo.ao(R, MAT, 30, 34, { z: -16, y: 0.020, strength: 0.34 }));
    root.add(Mo.ao(R, MAT, 7.5, 30, { z: -17, y: 0.021, strength: 0.30 }));
    root.userData = {
      wheels, engines: engRefs, lights,
      FR, AXIS, LEN, NG_Z, MG_Z,
      doorL1: [-FR, AXIS - 0.13, -4.3],
      cargoR: [1.17, AXIS - 1.60, -10.8],
      gpuPort: [-1.15, 1.85, -2.9],
      fuelPort: [5.60, AXIS - 1.42, -18.2],
      towPoint: [0, 0.30, NG_Z],
    };
    return root;
  };

  /* ============ 人物（マーシャラー / 地上作業員） ============ */
  Mo.person = function (R, MAT, opt) {
    opt = opt || {};
    const root = new Obj();
    const b = new Builder();
    const vest = opt.vest || MAT.hiVis;

    /* 脚 */
    for (const s of [1, -1]) {
      b.add(MAT.cloth, G.place(G.cyl(0.085, 0.075, 0.86, 10), [s * 0.115, 0.50, 0]));
      b.add(MAT.boot, G.place(G.box(0.15, 0.11, 0.28), [s * 0.115, 0.055, 0.03]));
    }
    /* 腰・胴 */
    b.add(MAT.cloth, G.place(G.scale(G.sphere(1, 14, 8), 0.20, 0.14, 0.14), [0, 0.94, 0]));
    b.add(MAT.cloth, G.place(G.cyl(0.175, 0.19, 0.52, 14), [0, 1.19, 0]));
    /* 安全ベスト */
    b.add(vest, G.place(G.cyl(0.205, 0.215, 0.44, 16, false, false), [0, 1.20, 0]));
    b.add(vest, G.place(G.scale(G.sphere(1, 14, 8), 0.21, 0.06, 0.16), [0, 1.42, 0]));
    /* 再帰反射帯 */
    for (const y of [1.10, 1.30]) b.add(MAT.reflect, G.place(G.cyl(0.218, 0.218, 0.055, 16, false, false), [0, y, 0]));
    for (const s of [1, -1]) b.add(MAT.reflect, G.place(G.box(0.05, 0.44, 0.012), [s * 0.09, 1.20, 0.205]));
    /* 首・頭 */
    b.add(MAT.skin, G.place(G.cyl(0.055, 0.06, 0.09, 10), [0, 1.485, 0]));
    b.add(MAT.skin, G.place(G.scale(G.sphere(1, 16, 10), 0.105, 0.125, 0.115), [0, 1.60, 0]));
    b.add(MAT.helmet, G.place(G.scale(G.sphere(1, 16, 8), 0.118, 0.10, 0.126), [0, 1.635, -0.004]));
    b.add(MAT.helmet, G.place(G.box(0.20, 0.020, 0.10), [0, 1.618, 0.108]));
    /* イヤーマフ */
    for (const s of [1, -1]) {
      b.add(MAT.earmuff, G.place(G.cyl(0.055, 0.055, 0.045, 12), [s * 0.115, 1.585, 0], [0, 0, PI / 2]));
      b.add(MAT.darkMetal, G.place(G.box(0.02, 0.09, 0.02), [s * 0.10, 1.68, 0], [0, 0, s * 0.4]));
    }
    b.add(MAT.darkMetal, G.place(G.box(0.20, 0.018, 0.03), [0, 1.722, 0]));
    /* サングラス */
    b.add(MAT.glass, G.place(G.box(0.16, 0.038, 0.02), [0, 1.605, 0.108]));

    b.build(R, root);

    /* --- 可動腕 --- */
    function arm(side) {
      const sh = new Obj();
      sh.setPos(side * 0.205, 1.395, 0);
      root.add(sh);
      const ub = new Builder();
      ub.add(vest, G.place(G.cyl(0.062, 0.052, 0.30, 10), [0, -0.15, 0]));
      ub.add(MAT.reflect, G.place(G.cyl(0.064, 0.056, 0.035, 10), [0, -0.24, 0]));
      ub.build(R, sh);
      const el = new Obj();
      el.setPos(0, -0.30, 0);
      sh.add(el);
      const fb = new Builder();
      fb.add(MAT.cloth, G.place(G.cyl(0.050, 0.044, 0.27, 10), [0, -0.135, 0]));
      fb.add(MAT.skin, G.place(G.sphere(0.048, 10, 6), [0, -0.285, 0]));
      fb.build(R, el);
      const hand = new Obj();
      hand.setPos(0, -0.30, 0);
      el.add(hand);
      return { shoulder: sh, elbow: el, hand };
    }
    const arms = { l: arm(-1), r: arm(1) };

    /* --- 発光ワンド --- */
    function wand(parent) {
      const w = new Obj();
      parent.add(w);
      const g1 = new Obj(R.mesh(G.place(G.cyl(0.028, 0.030, 0.14, 12), [0, -0.07, 0])), MAT.wandBody);
      w.add(g1);
      const cone = G.merge([
        G.place(G.cyl(0.036, 0.030, 0.36, 14), [0, -0.32, 0]),
        G.place(G.sphere(0.036, 12, 8), [0, -0.50, 0]),
      ]);
      const g2 = new Obj(R.mesh(cone), MAT.wandGlow);
      g2.cast = false;
      w.add(g2);
      w.userData = { tip: [0, -0.52, 0] };
      return w;
    }
    const wands = opt.wands === false ? null : { l: wand(arms.l.hand), r: wand(arms.r.hand) };
    root.add(Mo.ao(R, MAT, 0.80, 0.66, { y: 0.020, tight: true, strength: 0.85 }));

    root.userData = { arms, wands };
    return root;
  };

  /* ============ 輪止め ============ */
  Mo.chock = function (R, MAT) {
    const root = new Obj();
    const b = new Builder();
    /* くさび形。前面は傾斜、上に取っ手ロープ */
    const w = 0.46, h = 0.26, d = 0.52;
    const g = G.mk();
    const P = [
      [-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2],
      [-w / 2, h, -d / 2 + 0.10], [w / 2, h, -d / 2 + 0.10], [w / 2, h * 0.55, d / 2 - 0.06], [-w / 2, h * 0.55, d / 2 - 0.06],
    ];
    const cen = [0, h * 0.45, 0];
    function face(a, b2, c, d2) {
      const ax = P[b2][0] - P[a][0], ay = P[b2][1] - P[a][1], az = P[b2][2] - P[a][2];
      const bx = P[d2][0] - P[a][0], by = P[d2][1] - P[a][1], bz = P[d2][2] - P[a][2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      /* 重心から外を向くように法線を揃える */
      const mx = (P[a][0] + P[b2][0] + P[c][0] + P[d2][0]) / 4 - cen[0];
      const my = (P[a][1] + P[b2][1] + P[c][1] + P[d2][1]) / 4 - cen[1];
      const mz = (P[a][2] + P[b2][2] + P[c][2] + P[d2][2]) / 4 - cen[2];
      if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const i0 = G.vert(g, P[a][0], P[a][1], P[a][2], nx, ny, nz, 0, 0);
      const i1 = G.vert(g, P[b2][0], P[b2][1], P[b2][2], nx, ny, nz, 1, 0);
      const i2 = G.vert(g, P[c][0], P[c][1], P[c][2], nx, ny, nz, 1, 1);
      const i3 = G.vert(g, P[d2][0], P[d2][1], P[d2][2], nx, ny, nz, 0, 1);
      G.quad(g, i0, i1, i2, i3);
    }
    face(0, 1, 5, 4); face(3, 7, 6, 2); face(1, 2, 6, 5); face(0, 4, 7, 3);
    face(4, 5, 6, 7); face(0, 3, 2, 1);
    G.fixWinding(g);
    b.add(MAT.chock, g);
    /* 滑り止めリブ */
    for (let i = 0; i < 4; i++) b.add(MAT.chockDark, G.place(G.box(w * 0.94, 0.014, 0.045), [0, h - 0.02 - i * 0.045, -d / 2 + 0.13 + i * 0.075]));
    /* 取っ手ロープ */
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([(t - 0.5) * 0.30, h + Math.sin(t * PI) * 0.13, -d / 2 + 0.13]);
    }
    b.add(MAT.rope, G.tube(pts, 0.014, 0, 6));
    b.build(R, root);
    root.add(Mo.ao(R, MAT, 0.72, 0.78, { y: 0.018, tight: true, strength: 0.95 }));
    return root;
  };

  /* ============ ボーディングブリッジ ============ */
  Mo.jetBridge = function (R, MAT) {
    const root = new Obj();
    const b = new Builder();
    const BY = 3.7;             /* 通路の中心高さ */
    /* ロタンダ（ターミナル側の回転部） */
    b.add(MAT.concrete, G.place(G.cyl(2.9, 3.1, BY + 1.6, 20), [0, (BY + 1.6) / 2, 0]));
    b.add(MAT.alu, G.place(G.cyl(3.15, 3.15, 0.4, 20), [0, BY + 1.5, 0]));
    b.add(MAT.chassis, G.place(G.cyl(3.2, 3.2, 0.25, 20), [0, BY - 1.6, 0]));
    b.build(R, root);

    /* 外筒（固定） */
    const outer = new Obj();
    outer.setPos(0, 0, 0);
    root.add(outer);
    const ob = new Builder();
    const OL = 22.0;
    tunnel(ob, MAT, OL, 3.05, 2.95, 0.0);
    ob.build(R, outer);

    /* 内筒（伸縮） */
    const inner = new Obj();
    root.add(inner);
    const ib = new Builder();
    const IL = 20.0;
    tunnel(ib, MAT, IL, 2.78, 2.72, 0.0);
    ib.build(R, inner);

    function tunnel(bb, MAT, len, w, h, x0) {
      const yc = BY;
      /* 側壁（窓帯付き） */
      for (const s of [1, -1]) {
        bb.add(MAT.alu, G.place(G.box(len, h, 0.10), [x0 + len / 2, yc, s * w / 2]));
        bb.add(MAT.glass, G.place(G.box(len - 0.5, h * 0.30, 0.13), [x0 + len / 2, yc + h * 0.16, s * w / 2]));
        /* 側面の手すり */
        bb.add(MAT.galv, G.place(G.box(len - 0.3, 0.06, 0.06), [x0 + len / 2, yc - h / 2 + 0.62, s * (w / 2 + 0.16)]));
        for (let i = 0; i < Math.max(2, Math.round(len / 3)); i++) {
          const x = x0 + 0.6 + i * 3;
          if (x > x0 + len - 0.4) break;
          bb.add(MAT.galv, G.place(G.box(0.06, 0.66, 0.06), [x, yc - h / 2 + 0.30, s * (w / 2 + 0.16)]));
        }
      }
      /* 屋根（かまぼこ） */
      bb.add(MAT.alu, G.place(G.rot(G.cyl(w * 0.52, w * 0.52, len, 14, false, false), 0, 0, PI / 2), [x0 + len / 2, yc + h / 2 - 0.10, 0]));
      /* 床 */
      bb.add(MAT.chassis, G.place(G.box(len, 0.18, w), [x0 + len / 2, yc - h / 2, 0]));
      /* 補強リブ */
      const n = Math.max(3, Math.round(len / 2.2));
      for (let i = 0; i <= n; i++) {
        const x = x0 + (i / n) * len;
        bb.add(MAT.galv, G.place(G.box(0.13, h + 0.1, w + 0.06), [x, yc, 0]));
      }
    }

    /* キャブ（先端の回転部） + 蛇腹 + 支柱 */
    const cab = new Obj();
    root.add(cab);
    const cb = new Builder();
    const CW = 3.5, CH = 3.1, CL = 3.2, cy = BY;
    cb.add(MAT.alu, G.place(G.box(CL, CH, CW), [CL / 2, cy, 0]));
    cb.add(MAT.glass, G.place(G.box(CL - 0.4, 0.95, CW + 0.06), [CL / 2, cy + 0.55, 0]));
    cb.add(MAT.chassis, G.place(G.box(CL + 0.1, 0.22, CW + 0.1), [CL / 2, cy - CH / 2, 0]));
    cb.add(MAT.paintY, G.place(G.box(0.3, 0.5, CW + 0.14), [CL * 0.5, cy + CH / 2 + 0.2, 0]));
    /* 操作盤 */
    cb.add(MAT.chassis, G.place(G.box(0.5, 0.6, 0.4), [CL - 0.2, cy - 0.4, CW / 2 - 0.4]));
    cb.add(MAT.lampGlass, G.place(G.box(0.12, 0.14, 0.14), [CL - 0.45, cy - 0.2, CW / 2 - 0.4]));
    cb.build(R, cab);

    /* 蛇腹（伸縮するフレーム群） */
    const bellows = new Obj();
    cab.add(bellows);
    const NB = 11;
    const bellowFrames = [];
    for (let i = 0; i < NB; i++) {
      const t = i / (NB - 1);
      const wq = 3.36 - t * 0.30, hq = 3.0 - t * 0.28;
      const fg = G.merge([
        G.place(G.box(0.11, hq, 0.16), [0, 0, wq / 2]),
        G.place(G.box(0.11, hq, 0.16), [0, 0, -wq / 2]),
        G.place(G.box(0.11, 0.16, wq), [0, hq / 2, 0]),
        G.place(G.box(0.11, 0.16, wq), [0, -hq / 2, 0]),
      ]);
      const o = new Obj(R.mesh(fg), i % 2 ? MAT.rubber : MAT.galv);
      o.setPos(0, cy + 0.1, 0);
      bellows.add(o);
      bellowFrames.push(o);
    }
    /* 先端のゴム縁 */
    const bumper = new Obj(R.mesh(G.merge([
      G.place(G.box(0.20, 2.72, 0.22), [0, 0, 1.52]),
      G.place(G.box(0.20, 2.72, 0.22), [0, 0, -1.52]),
      G.place(G.box(0.20, 0.22, 3.26), [0, 1.36, 0]),
      G.place(G.box(0.20, 0.22, 3.26), [0, -1.36, 0]),
    ])), MAT.hoseBlack);
    bellows.add(bumper);
    bumper.setPos(0, cy + 0.1, 0);

    /* 支柱と車輪 */
    const column = new Obj();
    root.add(column);
    const colB = new Builder();
    const colH = cy - CH / 2 - 0.15;
    colB.add(MAT.galv, G.place(G.box(0.5, colH, 0.5), [0, 0.55 + colH / 2, 0]));
    colB.add(MAT.chassis, G.place(G.box(0.9, 0.42, 3.0), [0, 0.72, 0]));
    colB.add(MAT.paintY, G.place(G.box(0.66, 0.36, 0.66), [0, 0.55 + colH, 0]));
    colB.build(R, column);
    const bogieWheels = [];
    for (const s of [1, -1]) {
      const w = makeWheel(R, MAT, 0.52, 0.20);
      w.setPos(0, 0.52, s * 1.25);
      w.r[1] = PI / 2;
      column.add(w);
      bogieWheels.push(w);
    }

    wheelContact(R, MAT, column, bogieWheels);
    column.add(Mo.ao(R, MAT, 2.6, 3.8, { y: 0.020, strength: 0.5 }));
    root.userData = { outer, inner, cab, bellows, bellowFrames, bumper, column, bogieWheels, cy };
    return root;
  };

  /* ============ プッシュバックトラクター ============ */
  Mo.tractor = function (R, MAT) {
    const root = new Obj();
    const b = new Builder();
    /* 低い車体 */
    b.add(MAT.paintY, G.place(G.box(5.0, 0.78, 2.55), [0, 0.72, 0]));
    b.add(MAT.chassis, G.place(G.box(5.1, 0.22, 2.62), [0, 0.34, 0]));
    /* 前後のバンパー（黒黄の警戒色） */
    for (const s of [1, -1]) b.add(MAT.hazard, G.uvScale(G.place(G.box(0.28, 0.44, 2.7), [s * 2.55, 0.62, 0]), 4.5, 1));
    /* 泥よけ */
    for (const sx of [1.6, -1.6]) for (const sz of [1, -1]) {
      b.add(MAT.chassis, G.place(G.rot(G.arcBand(0.72, 0.07, 0.54, 0.12, PI - 0.12, 9), 0, PI / 2, 0), [sx, 0.56, sz * 1.28]));
    }
    /* キャブ */
    b.add(MAT.paintY, G.place(G.box(1.9, 0.35, 2.4), [-1.0, 1.28, 0]));
    for (const s of [1, -1]) b.add(MAT.chassis, G.place(G.box(0.09, 1.25, 0.09), [-0.15, 2.05, s * 1.05]));
    for (const s of [1, -1]) b.add(MAT.chassis, G.place(G.box(0.09, 1.25, 0.09), [-1.85, 2.05, s * 1.05]));
    /* ミラー */
    for (const s of [1, -1]) {
      b.add(MAT.chassis, G.place(G.cyl(0.02, 0.02, 0.34, 6), [-0.15, 2.30, s * 1.28], [0, 0, PI / 2.6]));
      b.add(MAT.chassis, G.place(G.box(0.05, 0.24, 0.16), [-0.15, 2.42, s * 1.44]));
    }
    b.add(MAT.glassBlue, G.place(G.box(1.75, 1.15, 0.06), [-1.0, 2.05, 1.10]));
    b.add(MAT.glassBlue, G.place(G.box(1.75, 1.15, 0.06), [-1.0, 2.05, -1.10]));
    b.add(MAT.glassBlue, G.place(G.box(0.06, 1.15, 2.15), [-0.15, 2.05, 0]));
    b.add(MAT.paintY, G.place(G.box(2.1, 0.14, 2.5), [-1.0, 2.70, 0]));
    /* 座席・ハンドル */
    b.add(MAT.cloth, G.place(G.box(0.5, 0.6, 0.55), [-1.55, 1.72, 0]));
    b.add(MAT.cloth, G.place(G.box(0.55, 0.12, 0.55), [-1.25, 1.50, 0]));
    b.add(MAT.chassis, G.place(G.cyl(0.22, 0.22, 0.05, 14), [-0.62, 1.72, 0], [0, 0, PI / 2.4]));
    /* 排気管 */
    b.add(MAT.chrome, G.place(G.cyl(0.07, 0.07, 1.1, 10), [0.9, 1.55, 1.05]));
    b.add(MAT.chassis, G.place(G.cyl(0.09, 0.09, 0.12, 10), [0.9, 2.14, 1.05]));
    /* 踏板 */
    for (const sz of [1, -1]) b.add(MAT.tread, G.place(G.box(0.5, 0.05, 0.26), [-1.2, 0.72, sz * 1.34]));
    /* 回転灯の台座 */
    b.add(MAT.chassis, G.place(G.cyl(0.10, 0.10, 0.18, 10), [-1.0, 2.86, 0]));
    b.build(R, root);

    const beacon = new Obj(R.mesh(G.cyl(0.16, 0.16, 0.22, 14)), MAT.lightAmber);
    beacon.setPos(-1.0, 3.02, 0); beacon.cast = false;
    root.add(beacon);

    const wheels = [];
    for (const sx of [1.6, -1.6]) for (const sz of [1, -1]) {
      const w = makeWheel(R, MAT, 0.56, 0.24);
      w.setPos(sx, 0.56, sz * 1.28);
      w.r[1] = PI / 2;
      root.add(w); wheels.push(w);
    }

    /* トーバー */
    const bar = new Obj();
    root.add(bar);
    const bb2 = new Builder();
    bb2.add(MAT.paintY, G.place(G.box(5.2, 0.24, 0.30), [2.6 + 2.6, 0.55, 0]));
    bb2.add(MAT.chassis, G.place(G.box(0.5, 0.36, 0.36), [2.75, 0.55, 0]));
    /* 機体側のヘッド */
    bb2.add(MAT.chassis, G.place(G.box(0.7, 0.42, 1.05), [7.55, 0.45, 0]));
    for (const s of [1, -1]) bb2.add(MAT.chrome, G.place(G.cyl(0.075, 0.075, 0.30, 10), [7.75, 0.30, s * 0.42], [0, 0, PI / 2]));
    /* 中間の支持輪 */
    bb2.add(MAT.chassis, G.place(G.box(0.16, 0.34, 0.16), [5.0, 0.40, 0]));
    bb2.build(R, bar);
    const barWheel = makeWheel(R, MAT, 0.20, 0.07);
    barWheel.setPos(5.0, 0.20, 0); barWheel.r[1] = PI / 2;
    bar.add(barWheel);

    wheelContact(R, MAT, root, wheels);
    root.add(Mo.ao(R, MAT, 5.6, 3.2, { y: 0.020, strength: 0.45 }));
    root.userData = { wheels, beacon, bar, barWheel };
    return root;
  };

  /* ============ ベルトローダー ============ */
  Mo.beltLoader = function (R, MAT) {
    const root = new Obj();
    const b = new Builder();
    b.add(MAT.paintW, G.place(G.box(4.6, 0.60, 2.15), [0, 1.18, 0]));
    b.add(MAT.paintBl, G.place(G.box(4.62, 0.30, 2.17), [0, 0.76, 0]));
    b.add(MAT.chassis, G.place(G.box(4.7, 0.18, 2.2), [0, 0.58, 0]));
    /* 前後の警戒帯 */
    for (const s2 of [1, -1]) b.add(MAT.hazard, G.uvScale(G.place(G.box(0.10, 0.30, 2.16), [s2 * 2.32, 0.98, 0]), 3.5, 1));
    /* 泥よけ */
    for (const sx of [1.55, -1.55]) for (const sz of [1, -1]) {
      b.add(MAT.chassis, G.place(G.rot(G.arcBand(0.60, 0.06, 0.44, 0.15, PI - 0.15, 9), 0, PI / 2, 0), [sx, 0.46, sz * 1.05]));
    }
    /* 運転席（後方） */
    b.add(MAT.paintW, G.place(G.box(1.4, 1.1, 2.0), [-1.55, 2.0, 0]));
    b.add(MAT.glassBlue, G.place(G.box(0.06, 0.85, 1.8), [-0.85, 2.15, 0]));
    b.add(MAT.cloth, G.place(G.box(0.45, 0.55, 0.5), [-1.9, 2.1, 0]));
    b.add(MAT.chassis, G.place(G.cyl(0.19, 0.19, 0.05, 12), [-1.15, 2.05, 0], [0, 0, PI / 2.4]));
    /* 作業灯・排気管・踏板・番号板 */
    for (const sz of [1, -1]) {
      b.add(MAT.chassis, G.place(G.box(0.14, 0.16, 0.16), [-1.05, 2.62, sz * 0.62]));
      b.add(MAT.lampGlass, G.place(G.box(0.05, 0.13, 0.13), [-0.96, 2.62, sz * 0.62]));
    }
    b.add(MAT.chrome, G.place(G.cyl(0.055, 0.055, 0.9, 10), [-2.05, 1.9, 0.82]));
    b.add(MAT.chassis, G.place(G.cyl(0.075, 0.075, 0.14, 10), [-2.05, 2.4, 0.82]));
    for (const sz of [1, -1]) {
      b.add(MAT.tread, G.place(G.box(0.42, 0.05, 0.30), [-1.9, 1.02, sz * 1.14]));
      b.add(MAT.galv, G.place(G.box(0.05, 0.42, 0.05), [-1.72, 0.82, sz * 1.14]));
    }
    b.add(MAT.tread, G.uvScale(G.place(G.box(0.30, 0.03, 1.9), [1.6, 1.49, 0]), 1, 5));
    /* 手すり */
    for (const s of [1, -1]) {
      b.add(MAT.paintY, G.place(G.box(2.2, 0.07, 0.07), [0.9, 2.05, s * 1.05]));
      b.add(MAT.paintY, G.place(G.box(0.07, 0.9, 0.07), [-0.1, 1.65, s * 1.05]));
      b.add(MAT.paintY, G.place(G.box(0.07, 0.9, 0.07), [1.95, 1.65, s * 1.05]));
    }
    b.build(R, root);

    const wheels = [];
    for (const sx of [1.55, -1.55]) for (const sz of [1, -1]) {
      const w = makeWheel(R, MAT, 0.46, 0.18);
      w.setPos(sx, 0.46, sz * 1.05);
      w.r[1] = PI / 2;
      root.add(w); wheels.push(w);
    }

    /* コンベアブーム（ヒンジで俯仰） */
    const boom = new Obj();
    boom.setPos(-1.6, 1.30, 0);
    root.add(boom);
    const bo = new Builder();
    const L = 6.6, W2 = 1.15;
    for (const s of [1, -1]) {
      bo.add(MAT.galv, G.place(G.box(L, 0.34, 0.09), [L / 2, 0.16, s * (W2 / 2 + 0.05)]));
      bo.add(MAT.paintY, G.place(G.box(L, 0.07, 0.07), [L / 2, 0.62, s * (W2 / 2 + 0.05)]));
      for (let i = 1; i < 6; i++) bo.add(MAT.paintY, G.place(G.box(0.06, 0.44, 0.06), [i * L / 6, 0.40, s * (W2 / 2 + 0.05)]));
    }
    bo.add(MAT.chassis, G.place(G.box(L, 0.10, W2), [L / 2, -0.06, 0]));
    /* ローラー */
    bo.add(MAT.chrome, G.place(G.cyl(0.14, 0.14, W2 + 0.1, 12), [0.05, 0.03, 0], [0, 0, PI / 2]));
    bo.add(MAT.chrome, G.place(G.cyl(0.14, 0.14, W2 + 0.1, 12), [L - 0.05, 0.03, 0], [0, 0, PI / 2]));
    bo.build(R, boom);
    /* ベルト面（UVスクロール） */
    const beltMat = Object.assign({}, MAT.belt);
    beltMat.uvOff = [0, 0];
    const belt = new Obj(R.mesh(G.uvScale(G.place(G.plane(L - 0.1, W2, 1, 8), [L / 2, 0.045, 0]), 1, 7)), beltMat);
    belt.cast = false;
    boom.add(belt);
    /* 先端の作業灯 */
    const tipLight = new Obj(R.mesh(G.sphere(0.10, 8, 6)), MAT.lightWhite);
    tipLight.setPos(L - 0.2, 0.75, 0.55); tipLight.cast = false;
    boom.add(tipLight);

    wheelContact(R, MAT, root, wheels);
    root.add(Mo.ao(R, MAT, 5.2, 2.8, { y: 0.020, strength: 0.45 }));
    root.userData = { wheels, boom, belt, beltMat, boomLen: L };
    return root;
  };

  /* ============ 地上電源車（GPU） ============ */
  Mo.gpu = function (R, MAT) {
    const root = new Obj();
    const b = new Builder();
    b.add(MAT.paintW, G.place(G.box(3.1, 1.7, 1.75), [0, 1.35, 0]));
    b.add(MAT.paintOr, G.place(G.box(3.12, 0.26, 1.77), [0, 1.86, 0]));
    b.add(MAT.chassis, G.place(G.box(3.15, 0.22, 1.8), [0, 0.55, 0]));
    /* 冷却グリル */
    b.add(MAT.chassis, G.place(G.box(0.06, 1.30, 1.42), [1.55, 1.45, 0]));
    for (let i = 0; i < 8; i++) b.add(MAT.galv, G.place(G.box(0.05, 0.09, 1.36), [1.59, 0.92 + i * 0.16, 0]));
    /* 操作盤と表示灯 */
    b.add(MAT.chassis, G.place(G.box(0.10, 0.52, 0.62), [-1.58, 1.55, 0.42]));
    b.add(MAT.glass, G.place(G.box(0.04, 0.30, 0.44), [-1.64, 1.62, 0.42]));
    b.add(MAT.lightGreen, G.place(G.sphere(0.045, 8, 6), [-1.64, 1.34, 0.26]));
    b.add(MAT.lightRed, G.place(G.sphere(0.045, 8, 6), [-1.64, 1.34, 0.40]));
    /* 消火器 */
    b.add(MAT.paintRd, G.place(G.cyl(0.09, 0.09, 0.42, 10), [-1.52, 1.05, -0.62]));
    b.add(MAT.chassis, G.place(G.cyl(0.03, 0.03, 0.10, 6), [-1.52, 1.30, -0.62]));
    b.add(MAT.paintY, G.place(G.box(3.2, 0.16, 1.85), [0, 2.22, 0]));
    /* 牽引アーム */
    b.add(MAT.chassis, G.place(G.box(1.4, 0.12, 0.12), [-2.1, 0.6, 0]));
    b.add(MAT.galv, G.place(G.cyl(0.12, 0.12, 0.4, 10), [-2.75, 0.45, 0], [0, 0, PI / 2]));
    /* ケーブルリール（横向きのドラム） */
    b.add(MAT.galv, G.place(G.cyl(0.14, 0.14, 1.30, 10), [0.45, 1.62, 0.55], [0, 0, PI / 2]));
    for (const s2 of [-1, 1]) b.add(MAT.galv, G.place(G.cyl(0.54, 0.54, 0.07, 18), [0.45 + s2 * 0.30, 1.62, 0.55], [0, 0, PI / 2]));
    b.add(MAT.cableRed, G.place(G.cyl(0.44, 0.44, 0.52, 18), [0.45, 1.62, 0.55], [0, 0, PI / 2]));
    b.add(MAT.galv, G.place(G.box(0.10, 0.34, 0.10), [0.45, 1.90, 0.55]));
    b.build(R, root);
    const wheels = [];
    for (const sx of [1.1, -1.1]) for (const sz of [1, -1]) {
      const w = makeWheel(R, MAT, 0.40, 0.15);
      w.setPos(sx, 0.40, sz * 0.85); w.r[1] = PI / 2;
      root.add(w); wheels.push(w);
    }
    wheelContact(R, MAT, root, wheels);
    root.add(Mo.ao(R, MAT, 3.6, 2.4, { y: 0.020, strength: 0.45 }));
    root.userData = { wheels, reelPos: [0.4, 1.55, 1.25] };
    return root;
  };

  /* ============ 給油車 ============ */
  Mo.fueler = function (R, MAT) {
    const root = new Obj();
    const b = new Builder();
    b.add(MAT.chassis, G.place(G.box(6.4, 0.32, 2.5), [0, 0.72, 0]));
    /* キャブ */
    b.add(MAT.paintW, G.place(G.box(2.0, 1.75, 2.4), [-2.1, 1.78, 0]));
    b.add(MAT.paintRd, G.place(G.box(2.02, 0.22, 2.42), [-2.1, 1.20, 0]));
    for (const s2 of [1, -1]) b.add(MAT.chassis, G.place(G.rot(G.arcBand(0.70, 0.06, 0.46, 0.15, PI - 0.15, 9), 0, PI / 2, 0), [-2.2, 0.58, s2 * 1.16]));
    b.add(MAT.glassBlue, G.place(G.box(0.07, 0.85, 2.15), [-3.05, 2.25, 0]));
    b.add(MAT.glassBlue, G.place(G.box(1.7, 0.8, 0.06), [-2.1, 2.25, 1.20]));
    /* 作業デッキ + 手すり */
    b.add(MAT.tread, G.uvScale(G.place(G.box(4.2, 0.16, 2.4), [1.2, 0.95, 0]), 9, 5));
    for (const s of [1, -1]) {
      b.add(MAT.paintY, G.place(G.box(4.2, 0.07, 0.07), [1.2, 2.0, s * 1.18]));
      b.add(MAT.paintY, G.place(G.box(0.07, 1.0, 0.07), [-0.8, 1.5, s * 1.18]));
      b.add(MAT.paintY, G.place(G.box(0.07, 1.0, 0.07), [3.2, 1.5, s * 1.18]));
    }
    b.add(MAT.paintY, G.place(G.box(4.2, 0.07, 0.07), [1.2, 2.0, 0]));
    /* ホースリール */
    b.add(MAT.galv, G.place(G.cyl(0.75, 0.75, 0.14, 18), [1.0, 1.85, -0.85], [PI / 2, 0, 0]));
    b.add(MAT.hoseBlack, G.place(G.cyl(0.62, 0.62, 0.40, 18), [1.0, 1.85, -0.72], [PI / 2, 0, 0]));
    b.add(MAT.galv, G.place(G.cyl(0.75, 0.75, 0.14, 18), [1.0, 1.85, -0.55], [PI / 2, 0, 0]));
    /* 計器盤 */
    b.add(MAT.paintY, G.place(G.box(1.0, 0.9, 0.18), [3.0, 1.7, 1.1]));
    b.add(MAT.glass, G.place(G.cyl(0.26, 0.26, 0.06, 16), [3.0, 1.85, 1.22], [PI / 2, 0, 0]));
    b.build(R, root);
    const wheels = [];
    for (const sx of [2.2, -0.2, -2.2]) for (const sz of [1, -1]) {
      const w = makeWheel(R, MAT, 0.55, 0.20);
      w.setPos(sx, 0.55, sz * 1.15); w.r[1] = PI / 2;
      root.add(w); wheels.push(w);
    }
    wheelContact(R, MAT, root, wheels);
    root.add(Mo.ao(R, MAT, 7.0, 3.2, { y: 0.020, strength: 0.45 }));
    root.userData = { wheels, reelPos: [1.0, 1.85, -0.72] };
    return root;
  };

  /* ============ 手荷物カート（ドーリー） ============ */
  Mo.dolly = function (R, MAT) {
    const root = new Obj();
    const b = new Builder();
    b.add(MAT.tread, G.uvScale(G.place(G.box(3.2, 0.14, 1.9), [0, 0.72, 0]), 7, 4));
    b.add(MAT.paintGn, G.place(G.box(3.3, 0.20, 0.16), [0, 0.60, 0.90]));
    b.add(MAT.paintGn, G.place(G.box(3.3, 0.20, 0.16), [0, 0.60, -0.90]));
    b.add(MAT.chassis, G.place(G.box(3.0, 0.12, 1.5), [0, 0.50, 0]));
    for (const s2 of [1, -1]) {
      b.add(MAT.paintGn, G.place(G.box(0.09, 0.85, 0.09), [s2 * 1.5, 1.14, 0.85]));
      b.add(MAT.paintGn, G.place(G.box(0.09, 0.85, 0.09), [s2 * 1.5, 1.14, -0.85]));
      b.add(MAT.paintGn, G.place(G.box(0.09, 0.09, 1.8), [s2 * 1.5, 1.54, 0]));
      /* 荷崩れ防止のフック */
      for (const sz of [1, -1]) b.add(MAT.galv, G.place(G.cyl(0.025, 0.025, 0.12, 6), [s2 * 1.05, 0.66, sz * 0.94]));
    }
    b.add(MAT.chassis, G.place(G.box(1.3, 0.10, 0.10), [-2.2, 0.42, 0]));
    b.add(MAT.galv, G.place(G.cyl(0.12, 0.12, 0.34, 10), [-2.85, 0.36, 0], [0, 0, PI / 2]));
    b.add(MAT.galv, G.place(G.cyl(0.09, 0.09, 0.26, 8), [2.15, 0.42, 0], [0, 0, PI / 2]));
    b.build(R, root);
    const dw = [];
    for (const sx of [1.15, -1.15]) for (const sz of [1, -1]) {
      const w = makeWheel(R, MAT, 0.30, 0.11);
      w.setPos(sx, 0.30, sz * 0.78); w.r[1] = PI / 2;
      root.add(w); dw.push(w);
    }
    wheelContact(R, MAT, root, dw);
    root.add(Mo.ao(R, MAT, 3.6, 2.2, { y: 0.020, strength: 0.42 }));
    return root;
  };

  /* ============ 手荷物 ============ */
  Mo.bag = function (R, MAT, kind) {
    const mats = [MAT.bagA, MAT.bagB, MAT.bagC];
    const m = mats[kind % 3];
    const root = new Obj(R.mesh(G.merge([
      G.box(0.72, 0.48, 0.30),
      G.place(G.box(0.16, 0.06, 0.05), [0, 0.27, 0]),
    ])), m);
    return root;
  };

  /* ============ ターミナル・環境 ============ */
  Mo.environment = function (R, MAT) {
    const root = new Obj();
    root.name = 'env';

    /* 舗装 */
    const ground = new Obj(R.mesh(G.plane(1800, 1800, 1, 1)), MAT.apron);
    ground.cast = false;
    root.add(ground);
    /* ゲート標示（テクスチャの世界座標系に合わせて配置） */
    const marks = new Obj(R.mesh(G.plane(T.GATE.W, T.GATE.D, 1, 1)), MAT.gate);
    marks.setPos(0, 0.016, T.GATE.CZ);
    marks.cast = false;
    root.add(marks);
    /* 遠方の草地 */
    const grass = new Obj(R.mesh(G.plane(1800, 420, 1, 1)), MAT.grass);
    grass.setPos(0, 0.01, -520); grass.cast = false;
    root.add(grass);

    const b = new Builder();
    /* ターミナルビル（-X 側） */
    const TX = -46;
    b.add(MAT.concrete, G.place(G.box(26, 15.5, 220), [TX - 13, 7.75, -40]));
    b.add(MAT.term, G.uvScale(G.place(G.box(0.6, 9.5, 218), [TX - 0.1, 8.6, -40]), 1, 1));
    b.add(MAT.panelW, G.place(G.box(28, 1.3, 224), [TX - 13, 16.1, -40]));
    b.add(MAT.panelW, G.place(G.box(6.5, 0.7, 224), [TX + 2.6, 16.6, -40], [0, 0, -0.14]));
    for (let i = 0; i < 12; i++) b.add(MAT.concrete, G.place(G.cyl(0.42, 0.42, 16.4, 10), [TX + 4.6, 8.2, -150 + i * 20]));
    /* 屋上設備 */
    for (let i = 0; i < 7; i++) b.add(MAT.panel, G.place(G.box(3.4, 1.8, 4.2), [TX - 14 + (i % 3) * 6, 17.6, -130 + i * 32]));

    /* 管制塔（遠景） */
    b.add(MAT.concrete, G.place(G.cyl(3.4, 4.4, 42, 16), [TX - 40, 21, -230]));
    b.add(MAT.panelW, G.place(G.cyl(7.4, 6.2, 4.6, 16), [TX - 40, 44, -230]));
    b.add(MAT.glass, G.place(G.cyl(7.2, 6.6, 3.0, 16, false, false), [TX - 40, 44.2, -230]));
    b.add(MAT.panelW, G.place(G.cyl(8.0, 7.6, 0.7, 16), [TX - 40, 46.8, -230]));
    b.add(MAT.darkMetal, G.place(G.cyl(0.16, 0.10, 6, 8), [TX - 40, 50, -230]));

    /* 照明ポール */
    for (let i = 0; i < 7; i++) {
      const z = -20 - i * 46, x = 52;
      b.add(MAT.darkMetal, G.place(G.cyl(0.30, 0.42, 26, 10), [x, 13, z]));
      b.add(MAT.darkMetal, G.place(G.box(3.4, 0.35, 1.6), [x - 1.4, 26.2, z]));
      for (let k = 0; k < 3; k++) b.add(MAT.lampGlass, G.place(G.box(0.85, 0.22, 1.2), [x - 2.6 + k * 1.1, 26.0, z]));
    }
    /* 誘導路の縁 */
    b.add(MAT.panelY, G.place(G.box(1.0, 0.06, 300), [30, 0.03, -170]));

    /* 風向計（空港らしい遠景） */
    b.add(MAT.darkMetal, G.place(G.cyl(0.16, 0.22, 9, 8), [66, 4.5, -120]));
    b.add(MAT.red, G.place(G.rot(G.cyl(0.75, 1.15, 3.4, 12, false, false), 0, 0, PI / 2), [68.4, 8.7, -120], [0, 0.5, 0]));

    /* 遠景の丘（空気遠近で沈む） */
    for (let i = 0; i < 7; i++) {
      const x = -900 + i * 330, z = -1180 - (i % 3) * 190;
      const h = 62 + (i % 4) * 34;
      b.add(MAT.hill, G.place(G.scale(G.sphere(1, 20, 8), 330, h, 190), [x, -h * 0.34, z]));
    }
    b.build(R, root, false);

    /* 誘導路灯（青） */
    const lampB = new Builder();
    for (let i = 0; i < 26; i++) {
      const z = -30 - i * 22;
      for (const s of [1, -1]) lampB.add(MAT.lightWhite, G.place(G.sphere(0.16, 6, 4), [s * 24 + 8, 0.16, z]));
    }
    lampB.build(R, root, false);

    return root;
  };

  /* 遠方に駐機する別の機体（同一メッシュを再利用） */
  Mo.cloneAircraft = function (src) {
    const root = new Obj();
    const walk = (s, d) => {
      for (const c of s.children) {
        const o = new Obj(c.mesh, c.mat);
        o.p = c.p.slice(); o.r = c.r.slice(); o.s = c.s.slice();
        o.cast = c.cast;
        d.add(o);
        walk(c, o);
      }
    };
    walk(src, root);
    return root;
  };
})(window.AG);
