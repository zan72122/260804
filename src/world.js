// ---------------------------------------------------------------------------
// シーン構築。すべて実寸 (メートル)。
//   部屋: 幅 4.2 / 奥行 3.8 / 高さ 2.75
//   窓  : 内法幅 1.32、腰高 0.78、y=2.00 から上は半径 0.66 のアーチ
//   壁厚: 0.34 (窓の見込みが深いので視差が効く)
// ---------------------------------------------------------------------------
'use strict';

const BENCH_X = -0.95;

const ROOM = {
  w: 4.2, d: 4.6, h: 2.75,
  wallZ: -1.9,          // 窓のある壁の室内面
  wallOut: -2.24,       // 同・屋外面
  zc: 0.4,              // 床の中心 z (窓壁から奥行 4.6 の部屋)
  get zBack() { return this.zc + this.d / 2; },
};

const WIN = {
  hx: 0.66,             // 内法半幅
  y0: 0.78,             // 腰 (石の窓台)
  yc: 2.00,             // アーチ起点
  R: 0.66,              // アーチ半径
  glassZ: -1.925,       // ガラス面の z
  get top() { return this.yc + this.R; },
  center: [0, 1.72, -1.925],
};

// パネル (上部アーチ) の設置位置: パネルローカル原点 = 世界 (0, 2.00, glassZ)
const PANEL_MOUNT = [0, 2.00, WIN.glassZ];

function holeBoundary(hx, y0, yc, R, arcSegs) {
  const pts = [[-hx, y0], [hx, y0], [hx, yc]];
  const n = arcSegs || 22;
  for (let i = 1; i < n; i++) {
    const a = i / n * Math.PI;
    pts.push([Math.cos(a) * R, yc + Math.sin(a) * R]);
  }
  pts.push([-hx, yc]);
  return pts;
}

function mat(o) {
  const m = {
    albedo: '#808080', rough: 0.85, metal: 0, type: 0, wear: 0.5,
    emissive: [0, 0, 0], ao: 1, fog: 0.05, sunMode: 0,
  };
  Object.assign(m, o);
  if (typeof m.albedo === 'string') m.albedo = MathX.toLinear(MathX.hexToRgb(m.albedo));
  return m;
}

function obj(name, mesh, model, material, extra) {
  const o = {
    name, mesh, model: model || M4.c(), mat: material || mat({}),
    nrm: M3.c(), visible: true, lm: null, pass: 'opaque',
  };
  M3.normalFromM4(o.nrm, o.model);
  if (extra) Object.assign(o, extra);
  return o;
}

function setModel(o, m) {
  M4.copy(o.model, m);
  M3.normalFromM4(o.nrm, o.model);
}

// --- 窓のある壁 (アーチ状の開口を持つ) --------------------------------------
function buildHoledWall() {
  const d = Geom.empty();
  const W = ROOM.w, H = ROOM.h;
  const hx = WIN.hx, y0 = WIN.y0, yc = WIN.yc, R = WIN.R;
  const zi = ROOM.wallZ, zo = ROOM.wallOut;

  function quad(x0, y0_, x1, y1, z, nz) {
    const b = d.pos.length / 3;
    const pts = [[x0, y0_], [x1, y0_], [x1, y1], [x0, y1]];
    for (const p of pts) Geom.push(d, p[0], p[1], z, 0, 0, nz, p[0], p[1]);
    if (nz > 0) d.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else d.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  // 台形 (アーチ脇) — 内側の辺が弧に沿う
  function trap(xo, xi0, xi1, ya, yb, z, nz, sign) {
    const b = d.pos.length / 3;
    const pts = sign > 0
      ? [[xi0, ya], [xo, ya], [xo, yb], [xi1, yb]]
      : [[xo, ya], [xi0, ya], [xi1, yb], [xo, yb]];
    for (const p of pts) Geom.push(d, p[0], p[1], z, 0, 0, nz, p[0], p[1]);
    if (nz > 0) d.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else d.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }

  for (const [z, nz] of [[zi, 1], [zo, -1]]) {
    quad(-W / 2, 0, W / 2, y0, z, nz);                    // 腰下
    quad(-W / 2, y0, -hx, yc, z, nz);                     // 左
    quad(hx, y0, W / 2, yc, z, nz);                       // 右
    const K = 10;
    for (let i = 0; i < K; i++) {
      const ya = yc + R * i / K, yb = yc + R * (i + 1) / K;
      const wa = Math.sqrt(Math.max(0, R * R - (ya - yc) * (ya - yc)));
      const wb = Math.sqrt(Math.max(0, R * R - (yb - yc) * (yb - yc)));
      trap(-W / 2, -wa, -wb, ya, yb, z, nz, -1);
      trap(W / 2, wa, wb, ya, yb, z, nz, 1);
    }
    quad(-W / 2, yc + R, W / 2, H, z, nz);                // アーチ上
  }

  // 見込み (方立・まぐさ・窓台の見付け面)
  const bd = holeBoundary(hx, y0, yc, R, 22);
  const cx = 0, cy = (y0 + yc + R) * 0.5;
  for (let i = 0; i < bd.length; i++) {
    const p = bd[i], q = bd[(i + 1) % bd.length];
    let ex = q[0] - p[0], ey = q[1] - p[1];
    const el = Math.hypot(ex, ey) || 1;
    let nx = -ey / el, ny = ex / el;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (nx * (cx - mx) + ny * (cy - my) < 0) { nx = -nx; ny = -ny; }
    const b = d.pos.length / 3;
    Geom.push(d, p[0], p[1], zi, nx, ny, 0, 0, 0);
    Geom.push(d, q[0], q[1], zi, nx, ny, 0, 1, 0);
    Geom.push(d, q[0], q[1], zo, nx, ny, 0, 1, 0.34);
    Geom.push(d, p[0], p[1], zo, nx, ny, 0, 0, 0.34);
    d.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    d.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return d;
}

// --- 世界 -------------------------------------------------------------------
function buildWorld(gl) {
  const objects = [];
  const by = {};
  const add = (o) => { objects.push(o); by[o.name] = o; return o; };

  const M = (pos, rot, scl) => M4.compose(M4.c(), pos, rot || [0, 0, 0], scl || [1, 1, 1]);

  // 床
  add(obj('floor', new Mesh(gl, Geom.planeXZ(ROOM.w, ROOM.d, 16, 1)), M([0, 0, ROOM.zc]),
    mat({ albedo: '#9c7a55', rough: 0.55, type: 1, wear: 1.0, ao: 0.95 })));
  // 天井
  add(obj('ceil', new Mesh(gl, Geom.planeXZ(ROOM.w, ROOM.d, 6, 1)), M([0, ROOM.h, ROOM.zc], [Math.PI, 0, 0]),
    mat({ albedo: '#b9ada0', rough: 0.95, type: 2, ao: 0.7 })));
  // 側壁・背面壁
  add(obj('wallL', new Mesh(gl, Geom.planeXY(ROOM.d, ROOM.h, 8, 1)), M([-ROOM.w / 2, ROOM.h / 2, ROOM.zc], [0, Math.PI / 2, 0]),
    mat({ albedo: '#c3b6a4', rough: 0.93, type: 2, ao: 0.9 })));
  add(obj('wallR', new Mesh(gl, Geom.planeXY(ROOM.d, ROOM.h, 8, 1)), M([ROOM.w / 2, ROOM.h / 2, ROOM.zc], [0, -Math.PI / 2, 0]),
    mat({ albedo: '#c3b6a4', rough: 0.93, type: 2, ao: 0.9 })));
  add(obj('wallB', new Mesh(gl, Geom.planeXY(ROOM.w, ROOM.h, 8, 1)), M([0, ROOM.h / 2, ROOM.zBack], [0, Math.PI, 0]),
    mat({ albedo: '#c3b6a4', rough: 0.93, type: 2, ao: 0.9 })));
  // 窓壁
  add(obj('wallF', new Mesh(gl, buildHoledWall()), M4.c(),
    mat({ albedo: '#c8bcab', rough: 0.92, type: 2, ao: 0.92 })));

  // 幅木 (接地感)
  const skirt = new Mesh(gl, Geom.box(ROOM.w, 0.12, 0.025, 4));
  add(obj('skirtB', skirt, M([0, 0.06, ROOM.zBack - 0.013], [0, Math.PI, 0]), mat({ albedo: '#6d5a46', rough: 0.6, type: 4, wear: 0.8 })));
  add(obj('skirtF', skirt, M([0, 0.06, ROOM.wallZ + 0.013]), mat({ albedo: '#6d5a46', rough: 0.6, type: 4, wear: 0.8 })));
  const skirtS = new Mesh(gl, Geom.box(ROOM.d, 0.12, 0.025, 4));
  add(obj('skirtL', skirtS, M([-ROOM.w / 2 + 0.013, 0.06, ROOM.zc], [0, Math.PI / 2, 0]), mat({ albedo: '#6d5a46', rough: 0.6, type: 4, wear: 0.8 })));
  add(obj('skirtR', skirtS, M([ROOM.w / 2 - 0.013, 0.06, ROOM.zc], [0, -Math.PI / 2, 0]), mat({ albedo: '#6d5a46', rough: 0.6, type: 4, wear: 0.8 })));

  // --- 窓まわり ------------------------------------------------------------
  // 木の窓台
  add(obj('sill', new Mesh(gl, Geom.box(1.62, 0.055, 0.42, 3)), M([0, WIN.y0 + 0.028, ROOM.wallZ - 0.13]),
    mat({ albedo: '#8f7350', rough: 0.5, type: 4, wear: 0.9 })));
  // 障子枠 (アーチに沿った見付け)
  const frameOutline = holeBoundary(WIN.hx - 0.03, WIN.y0 + 0.05, WIN.yc, WIN.R - 0.03, 22);
  add(obj('winFrame', new Mesh(gl, Geom.ribbon(frameOutline, 0.038, 0.048)),
    M([0, 0, WIN.glassZ]), mat({ albedo: '#9a8060', rough: 0.45, type: 4, wear: 0.7 })),
  ).lm = 'blocker';
  // 中桟 (無目) と方立
  add(obj('transom', new Mesh(gl, Geom.box(1.30, 0.075, 0.10, 3)), M([0, 1.43, WIN.glassZ]),
    mat({ albedo: '#9a8060', rough: 0.45, type: 4, wear: 0.7 }))).lm = 'blocker';
  add(obj('muntin', new Mesh(gl, Geom.box(0.05, 0.60, 0.075, 3)), M([0, 1.12, WIN.glassZ]),
    mat({ albedo: '#9a8060', rough: 0.45, type: 4, wear: 0.7 }))).lm = 'blocker';

  // 下部の透明ガラス (遠景が見える。透過パスで描く)
  const clearPane = new Mesh(gl, Geom.planeXY(0.58, 0.545, 1));
  for (const s of [-1, 1]) {
    const o = add(obj('clear' + (s < 0 ? 'L' : 'R'), clearPane, M([s * 0.305, 1.125, WIN.glassZ]),
      mat({ albedo: '#e8f2ff', rough: 0.05 })));
    o.pass = 'clear';
    o.lm = 'clear';
  }

  // --- 雨戸 ----------------------------------------------------------------
  // 2 枚を別のレールに載せる (中央で重なるので光が漏れない)
  const shutterMesh = new Mesh(gl, Geom.box(0.98, 2.14, 0.028, 4));
  for (const s of [-1, 1]) {
    const o = add(obj('shutter' + (s < 0 ? 'L' : 'R'), shutterMesh,
      M([s * 0.40, 1.68, ROOM.wallOut - (s < 0 ? 0.030 : 0.070)]),
      mat({ albedo: '#5d6b63', rough: 0.72, type: 4, wear: 1.0 })));
    o.lm = 'blocker';
    o.side = s;
  }
  // 戸袋レール
  add(obj('railT', new Mesh(gl, Geom.box(3.7, 0.07, 0.14, 3)), M([0, 2.79, ROOM.wallOut - 0.052]),
    mat({ albedo: '#4e5a53', rough: 0.8, type: 4, wear: 1.0 })));
  add(obj('railB', new Mesh(gl, Geom.box(3.7, 0.06, 0.14, 3)), M([0, 0.57, ROOM.wallOut - 0.052]),
    mat({ albedo: '#4e5a53', rough: 0.8, type: 4, wear: 1.0 })));
  // 取っ手 (ドラッグの目標)
  const handle = new Mesh(gl, Geom.cylinder(0.022, 0.022, 0.16, 10, true));
  add(obj('handle', handle, M([0.30, 1.68, ROOM.wallOut - 0.10]),
    mat({ albedo: '#3b3a36', rough: 0.35, metal: 1, type: 3, wear: 0.9 })));

  // --- 作業台 --------------------------------------------------------------
  // 窓から差し込む光が床に届く場所を空けるため、作業台は左に寄せる。
  const BX = BENCH_X, BY = 0.78, BZ = 0.5;
  add(obj('benchTop', new Mesh(gl, Geom.box(1.80, 0.062, 1.16, 3)), M([BX, BY, BZ]),
    mat({ albedo: '#7d6247', rough: 0.62, type: 4, wear: 1.0 }))).lm = 'blocker';
  const leg = new Mesh(gl, Geom.box(0.075, 0.75, 0.075, 4));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(obj('leg' + sx + sz, leg, M([BX + sx * 0.80, 0.375, BZ + sz * 0.50]),
      mat({ albedo: '#6b5238', rough: 0.7, type: 4, wear: 1.0 })));
  }
  add(obj('brace', new Mesh(gl, Geom.box(1.64, 0.05, 0.05, 3)), M([BX, 0.22, BZ + 0.50]),
    mat({ albedo: '#6b5238', rough: 0.7, type: 4, wear: 1.0 })));
  // 台の下の接地影
  add(obj('benchShadow', new Mesh(gl, Geom.quadXZ(2.5, 1.75)), M([BX, 0.004, BZ]),
    mat({ albedo: '#000000' }), { pass: 'shadow', strength: 0.55 }));
  add(obj('lampShadow', new Mesh(gl, Geom.quadXZ(0.34, 0.34)), M([BENCH_X + 0.78, 0.813, 0.72]),
    mat({ albedo: '#000000' }), { pass: 'shadow', strength: 0.5 }));

  // --- 道具 (近景の情報量) --------------------------------------------------
  const cutter = Geom.empty();
  Geom.merge(cutter, Geom.cylinder(0.011, 0.013, 0.135, 10, true));
  Geom.merge(cutter, Geom.translate(Geom.cylinder(0.010, 0.010, 0.03, 8, true), 0, -0.08, 0));
  add(obj('cutter', new Mesh(gl, cutter), M([BX + 0.66, 0.828, 0.72], [Math.PI / 2 - 0.12, 0.5, 0]),
    mat({ albedo: '#8b5a3c', rough: 0.5, type: 4, wear: 0.8 })));
  add(obj('cutterWheel', new Mesh(gl, Geom.cylinder(0.012, 0.012, 0.004, 12, true)),
    M([BX + 0.725, 0.816, 0.79], [0, 0, Math.PI / 2]),
    mat({ albedo: '#c9ccd0', rough: 0.22, metal: 1, type: 3, wear: 1.0 })));
  add(obj('pliers', new Mesh(gl, Geom.box(0.026, 0.012, 0.19, 3)), M([BX - 0.72, 0.818, 0.30], [0, 0.7, 0]),
    mat({ albedo: '#9aa0a6', rough: 0.3, metal: 1, type: 3, wear: 1.0 })));
  add(obj('rag', new Mesh(gl, Geom.box(0.20, 0.014, 0.16, 3)), M([BX - 0.70, 0.818, 0.72], [0, 0.3, 0]),
    mat({ albedo: '#cfc4ae', rough: 0.95, type: 2, wear: 1.0 })));
  add(obj('cratebox', new Mesh(gl, Geom.box(0.30, 0.08, 0.22, 3)), M([BX + 0.68, 0.855, 0.28], [0, -0.25, 0]),
    mat({ albedo: '#8a6f4e', rough: 0.75, type: 4, wear: 1.0 })));

  // --- 作業灯 (台の右端。パネルを斜めから照らす) ----------------------------
  const LX = BX + 0.78;
  const lampPos = [LX + 0.01, 1.30, 0.60];
  add(obj('lampBase', new Mesh(gl, Geom.cylinder(0.085, 0.075, 0.03, 14, true)), M([LX, 0.826, 0.72]),
    mat({ albedo: '#3f4348', rough: 0.4, metal: 1, type: 3, wear: 0.8 })));
  add(obj('lampArm', new Mesh(gl, Geom.cylinder(0.010, 0.010, 0.56, 8, true)), M([LX, 1.09, 0.70], [0.12, 0, -0.06]),
    mat({ albedo: '#3f4348', rough: 0.4, metal: 1, type: 3, wear: 0.8 })));
  add(obj('lampShade', new Mesh(gl, Geom.cylinder(0.115, 0.045, 0.13, 16, false)), M([LX - 0.005, 1.36, 0.63], [0.55, 0, -0.10]),
    mat({ albedo: '#4b5157', rough: 0.45, metal: 1, type: 3, wear: 0.9 })));
  add(obj('lampBulb', new Mesh(gl, Geom.sphere(0.032, 12, 8)), M([LX, 1.315, 0.665]),
    mat({ albedo: '#fff2d8', rough: 1, emissive: [3.0, 2.0, 1.05] })));

  // --- 屋外 (遠景) ---------------------------------------------------------
  add(obj('ground', new Mesh(gl, Geom.planeXZ(360, 360, 8, 0.35)), M([0, -0.03, -170]),
    mat({ albedo: '#5f7a45', rough: 1, type: 5, fog: 1, sunMode: 1, ao: 1 })));

  const ridgeCfg = [
    { z: -46, w: 150, h: 11, col: '#5c7b52', fog: 1.0, seed: 3 },
    { z: -105, w: 300, h: 26, col: '#6c8673', fog: 1.0, seed: 9 },
    { z: -230, w: 620, h: 62, col: '#8fa3ac', fog: 1.0, seed: 17 },
  ];
  ridgeCfg.forEach((c, i) => {
    const rnd = MathX.rng(c.seed);
    const a = [rnd(), rnd(), rnd(), rnd(), rnd()];
    const prof = (t) => 0.35 + 0.32 * Math.sin(t * 7.1 + a[0] * 6) + 0.22 * Math.sin(t * 13.3 + a[1] * 6)
      + 0.16 * Math.sin(t * 3.1 + a[2] * 6) + 0.10 * Math.sin(t * 23.0 + a[3] * 6);
    add(obj('ridge' + i, new Mesh(gl, Geom.ridge(c.w, 3, c.h, 90, prof)), M([0, 0, c.z]),
      mat({ albedo: c.col, rough: 1, type: 5, fog: c.fog, sunMode: 1 })));
  });

  // 木立 (中景と遠景をつなぐ)
  const trunk = new Mesh(gl, Geom.cylinder(0.16, 0.11, 2.2, 7, true));
  const crown = new Mesh(gl, Geom.cylinder(0.02, 1.5, 3.4, 9, true));
  const rnd = MathX.rng(77);
  for (let i = 0; i < 11; i++) {
    const x = (rnd() - 0.5) * 26;
    const z = -8 - rnd() * 26;
    const s = 0.7 + rnd() * 0.8;
    add(obj('trunk' + i, trunk, M([x, 1.1 * s, z], [0, rnd() * 3, 0], [s, s, s]),
      mat({ albedo: '#6b5540', rough: 0.95, type: 5, fog: 1, sunMode: 1 })));
    add(obj('crown' + i, crown, M([x, (2.2 + 1.5) * s, z], [0, rnd() * 3, 0], [s, s, s]),
      mat({ albedo: '#4f7340', rough: 1, type: 5, fog: 1, sunMode: 1 })));
  }

  return { objects, by, lampPos };
}

// --- 光の柱 (窓の開口を太陽方向へ押し出したプリズム) ------------------------
function buildShaftMesh(gl, sunDir, L) {
  const bd = holeBoundary(WIN.hx + 0.01, WIN.y0 - 0.01, WIN.yc, WIN.R + 0.01, 16);
  const z = WIN.glassZ;
  const d = Geom.empty();
  const n = bd.length;
  for (let i = 0; i < n; i++) {
    const p = bd[i], q = bd[(i + 1) % n];
    let ex = q[0] - p[0], ey = q[1] - p[1];
    const el = Math.hypot(ex, ey) || 1;
    // 側面の法線 = 断面接線 × 進行方向
    const tx = ex / el, ty = ey / el;
    const nx = ty * sunDir[2] - 0 * sunDir[1];
    const ny = 0 * sunDir[0] - tx * sunDir[2];
    const nz = tx * sunDir[1] - ty * sunDir[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const b = d.pos.length / 3;
    Geom.push(d, p[0], p[1], z, nx / nl, ny / nl, nz / nl, 0, 0);
    Geom.push(d, q[0], q[1], z, nx / nl, ny / nl, nz / nl, 1, 0);
    Geom.push(d, q[0] + sunDir[0] * L, q[1] + sunDir[1] * L, z + sunDir[2] * L, nx / nl, ny / nl, nz / nl, 1, 1);
    Geom.push(d, p[0] + sunDir[0] * L, p[1] + sunDir[1] * L, z + sunDir[2] * L, nx / nl, ny / nl, nz / nl, 0, 1);
    d.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return new Mesh(gl, d);
}

// 光の柱の中を漂うほこり
function buildDust(gl, sunDir, count) {
  const rnd = MathX.rng(1234);
  const pos = [], ext = [];
  for (let i = 0; i < count; i++) {
    const x = (rnd() - 0.5) * (WIN.hx * 2);
    const y = WIN.y0 + rnd() * (WIN.top - WIN.y0);
    const t = Math.pow(rnd(), 0.75) * 5.5;
    pos.push(x + sunDir[0] * t, y + sunDir[1] * t, WIN.glassZ + sunDir[2] * t);
    ext.push(rnd(), 0.10 + rnd() * 0.35, 0.5 + rnd() * 2.4);
  }
  return new PointCloud(gl, pos, ext);
}

// --- ステンドグラス板 -------------------------------------------------------
function buildPanel(gl, motifId) {
  const cells = buildPanelCells(motifId);
  const list = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const cen = polyCentroid(c.pts);
    const glassMesh = new Mesh(gl, Geom.extrude(c.pts, PANEL.thickness, PANEL.uvRect));
    const cameMesh = new Mesh(gl, Geom.ribbon(c.pts, 0.0105, 0.0115, 0.0107));
    const scoreMesh = new Mesh(gl, Geom.ribbon(c.pts, 0.0022, 0.0017, 0.0026));
    let area = 0;
    for (let k = 0; k < c.pts.length; k++) {
      const p = c.pts[k], q = c.pts[(k + 1) % c.pts.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    list.push({
      index: i, pts: c.pts, plate: !!c.plate, group: c.group, hint: c.hint,
      centroid: cen, area: Math.abs(area) / 2,
      glassMesh, cameMesh, scoreMesh,
      color: null, fill: 0, cut: 0, join: 0, pop: 0,
      model: M4.c(), nrm: M3.c(), seed: i * 1.37,
    });
  }
  return list;
}

// モチーフ選択カード (小さな 3D タイル)
function buildMotifCard(gl, motifId) {
  const cells = MOTIFS[motifId].build();
  const parts = [];
  for (const c of cells) {
    parts.push({
      mesh: new Mesh(gl, Geom.extrude(c.pts, 0.010, PANEL.uvRect)),
      hint: c.hint, plate: !!c.plate,
    });
  }
  return parts;
}
