/* =========================================================================
   scene.js — the café, built to real dimensions in millimetres.
   Y is up, -Z goes away from the player.  Counter top sits at y = 950,
   which is where a real bar counter is.
   ========================================================================= */
'use strict';

const LAY = {
  counterY: 950, counterFront: 40, counterBack: -830,
  grinder: { x: -950, z: -300, forkY: 1132, chuteY: 1168 },
  tamp: { x: -560, z: -150, matY: 962 },
  machine: { cx: 100, hw: 370, front: -240, back: -770 },
  group: { x: 0, y: 1122, z: -150 },      // portafilter mounting plane
  group2: { x: 320 },
  trayY: 992,
  cup: { x: 0, z: -132, rim: 42.5, h: 62 },
  wand: { baseX: 500, baseY: 1258, baseZ: -246, tipX: 524, tipY: 1042, tipZ: -104 },
  pitcherRest: { x: 700, z: -140 },
  serve: { x: 1060, z: -170 },
  stack: { x: 250, y: 1487, z: -330 },
  lever: { x: -170, y: 1268, z: -232 }
};

/* Named material presets — tint/roughness overrides on the texture banks. */
const MAT = {
  steel:      { tex: 'steel', uvScale: [2.2, 2.2], rough: [1, 0.07], metal: 0.94, normalAmt: 0.45 },
  steelFine:  { tex: 'steel', uvScale: [5, 5], rough: [0.92, 0.09], metal: 0.93, normalAmt: 0.35 },
  chrome:     { tex: 'chrome', uvScale: [3, 3], rough: [1, 0], metal: 1, normalAmt: 0.35 },
  chromeWorn: { tex: 'chrome', uvScale: [4, 4], rough: [1.6, 0.03], metal: 1, normalAmt: 0.5 },
  blackPly:   { tex: 'paint', uvScale: [3, 3], rough: [1, 0], metal: 0, normalAmt: 0.7,
                tint: [0.85, 0.85, 0.9] },
  wood:       { tex: 'wood', uvScale: [1, 1], rough: [1, 0], metal: 0, normalAmt: 1.0 },
  tile:       { tex: 'tile', uvScale: [1, 1], rough: [1, 0], metal: 0, normalAmt: 1.0 },
  floor:      { tex: 'floor', uvScale: [1, 1], rough: [1, 0], metal: 0, normalAmt: 0.9 },
  plaster:    { tex: 'floor', uvScale: [3, 3], rough: [1.05, 0.08], metal: 0, normalAmt: 0.4,
                tint: [2.5, 2.35, 2.15] },
  porcelain:  { tex: 'porcelain', uvScale: [1.4, 1.4], rough: [1, 0], metal: 0, normalAmt: 0.35 },
  rubber:     { tex: 'rubber', uvScale: [4, 4], rough: [1, 0], metal: 0, normalAmt: 1.1 },
  coffee:     { tex: 'coffee', uvScale: [3, 3], rough: [1, 0], metal: 0, normalAmt: 1.4 },
  brass:      { tex: 'brass', uvScale: [2, 2], rough: [1, 0], metal: 1, normalAmt: 0.6 },
  satin:      { tex: 'steel', uvScale: [3.4, 3.4], rough: [1.15, 0.16], metal: 0.88,
                normalAmt: 0.4, tint: [1.06, 1.05, 1.04] },
  paint:      { tex: 'paint', uvScale: [2, 2], rough: [1, 0], metal: 0, normalAmt: 0.8,
                tint: [1.2, 1.15, 1.1] },
  milk:       { tex: 'porcelain', uvScale: [2, 2], rough: [0.5, 0.06], metal: 0, normalAmt: 0.2,
                tint: [1.02, 1.0, 0.95] },
  espresso:   { tex: 'porcelain', uvScale: [2, 2], rough: [0.2, 0.02], metal: 0, normalAmt: 0.1,
                tint: [0.11, 0.055, 0.03], mode: 2 },
  glass:      { tex: 'chrome', uvScale: [2, 2], rough: [0.3, 0.02], metal: 0, normalAmt: 0.2,
                tint: [0.55, 0.58, 0.6], mode: 2 }
};
function mat(base, over) { return Object.assign({}, MAT[base], over || {}); }

const Scene = {
  nodes: [], named: {}, statics: null,

  /* ------------------------------------------------------------- plumbing */
  _bank: null,
  begin() { this._bank = {}; },
  put(matName, geo, m) {
    if (!this._bank[matName]) this._bank[matName] = Geo.empty();
    Geo.add(this._bank[matName], geo, m);
  },
  flush() {
    for (const k in this._bank) {
      const g = this._bank[k];
      if (!g.idx.length) continue;
      this.node(GLX.mesh(Geo.finish(g)), mat(k), M4.make());
    }
    this._bank = null;
  },
  node(mesh, material, m, opts) {
    const n = Object.assign({ mesh, material, mat: m || M4.make(), visible: true }, opts || {});
    this.nodes.push(n);
    return n;
  },
  mesh(geo) { return GLX.mesh(Geo.finish(geo)); },

  /* ================================================================ build */
  build() {
    this.nodes.length = 0;
    this.begin();
    this.room();
    this.counter();
    this.machine();
    this.grinder();
    this.dressing();
    this.flush();
    this.movables();
    return this.nodes;
  },

  /* ------------------------------------------------------------ far layer */
  room() {
    const g = Geo;
    // floor
    this.put('floor', g.groundAO(g.plane(9000, 9000, 4, 4, 900), 0, 1, 0),
             g.mat(0, 0, -1500));
    // back wall: tiled dado, plaster above
    const wall = g.plane(9000, 1150, 4, 4, 700);
    this.put('tile', wall, M4.compose(M4.make(), 0, 1520, -1500, Math.PI / 2, 0, 0, 1, 1, 1));
    const upper = g.plane(9000, 1900, 2, 2, 1400);
    this.put('plaster', upper, M4.compose(M4.make(), 0, 3040, -1500, Math.PI / 2, 0, 0, 1, 1, 1));
    // side walls
    this.put('plaster', g.plane(3400, 3600, 2, 2, 1400),
             M4.compose(M4.make(), -2900, 1800, -400, 0, 0, -Math.PI / 2, 1, 1, 1));
    this.put('plaster', g.plane(3400, 3600, 2, 2, 1400),
             M4.compose(M4.make(), 3100, 1800, -400, 0, 0, Math.PI / 2, 1, 1, 1));
    // ceiling
    this.put('plaster', g.plane(9000, 5000, 2, 2, 1400),
             M4.compose(M4.make(), 0, 3000, -400, Math.PI, 0, 0, 1, 1, 1));

    // window on the left wall — the cool key the chrome reflects
    const fr = g.empty();
    g.add(fr, g.roundBox(40, 1500, 1100, 8), g.mat(0, 0, 0));
    this.put('plaster', fr, g.mat(-2870, 1750, -500));
    this.node(this.mesh(g.plane(1360, 960, 1, 1, 1)),
      mat('plaster', { mode: 3, emissive: [7.5, 8.2, 9.2], tint: [1, 1, 1] }),
      M4.compose(M4.make(), -2855, 1750, -500, 0, 0, -Math.PI / 2, 1, 1, 1), { noShadow: true });
    // muntins
    const mun = g.empty();
    for (const oy of [-460, 0, 460]) g.add(mun, g.roundBox(26, 26, 1000, 6), g.mat(0, oy, 0));
    g.add(mun, g.roundBox(26, 1440, 26, 6), g.mat(0, 0, 0));
    this.put('blackPly', mun, g.mat(-2846, 1750, -500));

    // back-bar shelf with jars and cups
    const shelf = g.empty();
    g.add(shelf, g.roundBox(2600, 34, 260, 5), g.mat(0, 0, 0));
    for (let i = -2; i <= 2; i++) g.add(shelf, g.roundBox(40, 300, 240, 6), g.mat(i * 620, -160, 0));
    this.put('wood', shelf, g.mat(200, 1700, -1370));
    const jars = g.empty(), lids = g.empty();
    for (let i = 0; i < 7; i++) {
      const x = -840 + i * 290 + (i % 2) * 30;
      const h = 190 + (i % 3) * 45, r = 62 + (i % 2) * 10;
      g.add(jars, g.lathe([[r * 0.86, 0], [r, 14], [r, h - 20], [r * 0.9, h]], 24, true, false),
            g.mat(x, 0, 0));
      g.add(lids, g.lathe([[r * 0.92, h - 4], [r * 0.98, h + 4], [r * 0.86, h + 26]], 24, false, true),
            g.mat(x, 0, 0));
    }
    this.put('glass', jars, g.mat(200, 1734, -1360));
    this.put('brass', lids, g.mat(200, 1734, -1360));

    // pendant lamps
    for (const lx of [-620, 640]) {
      const rod = g.tube([[lx, 3000, -700], [lx, 2360, -700]], 9, 8);
      this.put('blackPly', rod);
      const shade = g.lathe([[16, 260], [150, 96], [168, 70], [172, 60, 1], [160, 62], [140, 96], [14, 250]], 36);
      this.put('paint', shade, g.mat(lx, 2100, -700));
      this.node(this.mesh(g.sphere(58, 20, 14)),
        mat('porcelain', { mode: 3, emissive: [16, 13.5, 10], tint: [1, 1, 1] }),
        g.mat(lx, 2150, -700), { noShadow: true });
    }
  },

  /* ------------------------------------------------------------ mid layer */
  counter() {
    const g = Geo, Y = LAY.counterY;
    // solid oak top with a bullnose front edge and real thickness
    const top = g.roundBox(3600, 52, 880, 9, 12);
    g.groundAO(top, Y - 52, 40, 0.25);
    this.put('wood', top, g.mat(50, Y - 26, -395));
    // cabinet
    const cab = g.empty();
    g.add(cab, g.roundBox(3520, 820, 780, 4, 6), g.mat(0, 0, 0));
    this.put('blackPly', g.groundAO(cab, -410, 120, 0.5), g.mat(50, Y - 52 - 410, -420));
    // panelled oak front, so the near field is a surface and not a void
    const panels = g.empty();
    for (let i = -3; i <= 3; i++) {
      g.add(panels, g.roundBox(470, 700, 26, 8, 6), g.mat(i * 500, 0, 0));
      g.add(panels, g.roundBox(390, 600, 14, 6, 5), g.mat(i * 500, 0, 10));
    }
    this.put('wood', g.groundAO(panels, -350, 160, 0.45),
             g.mat(50, Y - 52 - 390, -30));
    // toe kick + shadow gap
    this.put('rubber', g.roundBox(3400, 110, 700, 3), g.mat(50, 55, -440));
    // brass foot rail on the front (a real bar detail, and a near-field anchor)
    const rail = g.tube([[-1700, 300, 60], [1760, 300, 60]], 22, 14);
    this.put('brass', rail);
    for (const rx of [-1400, -400, 600, 1500]) {
      this.put('brass', g.lathe([[26, 0], [26, 250], [34, 262], [30, 300]], 18, true, true),
               g.mat(rx, 0, 60));
    }
    // tamping mat: rubber, with a worn dish where the tamper lands
    const mm = g.roundBox(230, 14, 165, 6, 8);
    this.put('rubber', mm, g.mat(LAY.tamp.x, Y + 7, LAY.tamp.z));
  },

  /* ------------------------------------------------- the espresso machine */
  machine() {
    const g = Geo, M = LAY.machine, Y = LAY.counterY;
    const cx = M.cx, hw = M.hw;
    const zc = (M.front + M.back) / 2, dz = M.back - M.front;   // negative depth

    // ---- chassis on rubber feet
    for (const fx of [-1, 1]) for (const fz of [-1, 1]) {
      this.put('rubber', g.lathe([[26, 0], [26, 16], [22, 22]], 16, true, true),
               g.mat(cx + fx * (hw - 60), Y, zc + fz * (Math.abs(dz) / 2 - 70)));
    }
    // ---- lower body (holds the groups) and the upper boiler box
    const body = g.empty();
    g.add(body, g.roundBox(hw * 2, 150, Math.abs(dz), 10, 10), g.mat(0, 97, 0));
    g.add(body, g.roundBox(hw * 2, 300, Math.abs(dz), 26, 12), g.mat(0, 322, 0));
    this.put('steel', g.groundAO(body, 22, 60, 0.35), g.mat(cx, Y + 22, zc));

    // ---- chrome top rail with a cup grid
    const rail = g.empty();
    g.add(rail, g.roundBox(hw * 2 + 26, 26, Math.abs(dz) + 20, 9, 8), g.mat(0, 0, 0));
    this.put('chrome', rail, g.mat(cx, Y + 22 + 470 + 8, zc));
    const bars = g.empty();
    for (let i = -6; i <= 6; i++) {
      Geo.add(bars, g.tube([[i * 52, 0, -dz * 0.5 + 30], [i * 52, 0, dz * 0.5 - 30]], 5, 8));
    }
    this.put('chromeWorn', bars, g.mat(cx, Y + 22 + 470 + 24, zc));

    // ---- stainless front with a black instrument inset
    this.put('steelFine', g.roundBox(hw * 1.92, 268, 24, 7, 8), g.mat(cx, Y + 22 + 326, M.front + 5));
    this.put('blackPly', g.roundBox(300, 150, 20, 10, 8), g.mat(cx + 176, Y + 22 + 344, M.front + 12));
    // machined bezel around the whole face
    this.put('chrome', g.roundBox(hw * 1.98, 12, 20, 5, 5), g.mat(cx, Y + 22 + 464, M.front + 10));
    this.put('chrome', g.roundBox(hw * 1.98, 12, 20, 5, 5), g.mat(cx, Y + 22 + 190, M.front + 10));
    // pressure gauge
    const gx = cx + 200, gy = Y + 22 + 348;
    this.put('chrome', g.lathe([[52, 0], [56, 8], [56, 20, 1], [48, 24], [46, 26]], 32, true, false),
             M4.compose(M4.make(), gx, gy, M.front + 20, Math.PI / 2, 0, 0, 1, 1, 1));
    this.node(this.mesh(g.disc(45, 32, 1)),
      mat('porcelain', { tint: [0.95, 0.93, 0.87], rough: [0.5, 0.03] }),
      M4.compose(M4.make(), gx, gy, M.front + 28, Math.PI / 2, 0, 0, 1, 1, 1));
    const needle = g.roundBox(5, 40, 3, 1.5, 3);
    this.named.gauge = this.node(this.mesh(needle), mat('blackPly', { tint: [3.0, 0.5, 0.4] }),
      M4.make(), { noShadow: true });
    this.put('chrome', g.lathe([[9, 0], [9, 5]], 16, true, true),
             M4.compose(M4.make(), gx, gy, M.front + 31, Math.PI / 2, 0, 0, 1, 1, 1));

    // ---- group heads
    for (const gxp of [LAY.group.x, LAY.group2.x]) {
      const head = g.empty();
      // machined chrome group: locking flange, waist, collar, then up into the body
      g.add(head, g.lathe([
        [50, -26], [58, -22], [58, -8, 1],
        [48, -4], [48, 12],
        [55, 16], [55, 30, 1],
        [44, 34], [44, 92], [50, 100], [50, 126]
      ], 44, false, true), g.mat(0, 0, 0));
      this.put('chrome', head, g.mat(gxp, LAY.group.y, LAY.group.z));
      // the stainless shroud the group hangs from
      this.put('steelFine', g.roundBox(168, 96, 150, 16, 8),
               g.mat(gxp, LAY.group.y + 150, LAY.group.z - 40));
      // rubber gasket + shower screen at the mounting face
      this.put('rubber', g.lathe([[46, -30], [56, -30], [56, -20], [46, -20]], 32),
               g.mat(gxp, LAY.group.y, LAY.group.z));
      this.put('chromeWorn', g.disc(44, 32, -1), g.mat(gxp, LAY.group.y - 22, LAY.group.z));
      // the three lugs the portafilter twists under
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU + 0.5;
        this.put('chrome', g.roundBox(34, 11, 16, 4, 5),
          M4.compose(M4.make(), gxp + Math.cos(a) * 54, LAY.group.y - 2, LAY.group.z + Math.sin(a) * 54,
                     0, -a, 0, 1, 1, 1));
      }
    }

    // a portafilter left locked in the second group
    const parked = M4.compose(M4.make(), LAY.group2.x, LAY.group.y, LAY.group.z,
                              0, -Math.PI / 2 + 0.10, 0, 1, 1, 1);
    this.put('chromeWorn', this.portafilterGeo(), parked);
    this.put('blackPly', this.pfHandleGeo(), parked);

    // stainless back wall of the brew area, so the recess reads as metal
    this.put('steelFine', g.roundBox(hw * 1.9, 176, 20, 6, 6),
             g.mat(cx, Y + 22 + 110, M.front + 18));

    // ---- drip tray: pan + slotted grill, stained
    const pan = g.empty();
    g.add(pan, g.roundBox(700, 46, 250, 6, 8), g.mat(0, 0, 0));
    this.put('steelFine', pan, g.mat(cx - 60, LAY.trayY - 23, LAY.group.z + 22));
    const grill = g.empty();
    for (let i = -16; i <= 16; i++) {
      Geo.add(grill, g.roundBox(14, 8, 224, 3, 4), g.mat(i * 20, 0, 0));
    }
    Geo.add(grill, g.roundBox(690, 9, 16, 3, 4), g.mat(0, 0, 112));
    Geo.add(grill, g.roundBox(690, 9, 16, 3, 4), g.mat(0, 0, -112));
    this.put('chromeWorn', grill, g.mat(cx - 60, LAY.trayY, LAY.group.z + 22));

    // ---- brew paddles (one per group)
    for (const gxp of [LAY.group.x, LAY.group2.x]) {
      const isActive = gxp === LAY.group.x;
      const pivot = M4.make();
      const paddle = g.empty();
      g.add(paddle, g.lathe([[16, 0], [17, 8], [15, 12]], 20, true, true), g.mat(0, 0, 0));
      g.add(paddle, g.roundBox(24, 96, 22, 10, 8), g.mat(0, -48, 6));
      g.add(paddle, g.lathe([[20, 0], [21, 14], [17, 22]], 20, true, true),
            M4.compose(M4.make(), 0, -96, 6, Math.PI / 2, 0, 0, 1, 1, 1));
      const px = gxp - 92, py = LAY.lever.y, pz = M.front + 16;
      if (isActive) {
        this.named.paddle = this.node(this.mesh(paddle), mat('chrome'),
          M4.compose(M4.make(), px, py, pz, 0, 0, 0, 1, 1, 1));
        this.named.paddleBase = [px, py, pz];
      } else {
        this.put('chrome', paddle, g.mat(px, py, pz));
      }
      // status lamp
      this.node(this.mesh(g.lathe([[8, 0], [8, 4], [6, 7]], 16, true, true)),
        mat('porcelain', { mode: 3, emissive: isActive ? [0.2, 0.5, 0.25] : [0.35, 0.9, 0.42],
                           tint: [1, 1, 1] }),
        M4.compose(M4.make(), gxp - 92, py + 44, pz + 6, Math.PI / 2, 0, 0, 1, 1, 1),
        { noShadow: true, isLamp: isActive });
      if (isActive) this.named.brewLamp = this.nodes[this.nodes.length - 1];
    }

    // ---- steam wand + valve
    const W = LAY.wand;
    this.put('chrome', g.sphere(26, 24, 16), g.mat(W.baseX, W.baseY, W.baseZ));
    const path = [
      [W.baseX, W.baseY, W.baseZ],
      [W.baseX + 4, W.baseY - 60, W.baseZ + 6],
      [(W.baseX + W.tipX) / 2 + 10, (W.baseY + W.tipY) / 2 - 20, (W.baseZ + W.tipZ) / 2],
      [W.tipX, W.tipY + 30, W.tipZ - 12],
      [W.tipX, W.tipY, W.tipZ]
    ];
    const smooth = [];
    for (let i = 0; i < 24; i++) {
      const t = i / 23 * (path.length - 1);
      const i0 = Math.min(path.length - 2, Math.floor(t)), f = t - i0;
      const a = path[i0], b = path[i0 + 1];
      smooth.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]);
    }
    this.put('chrome', g.tube(smooth, 11, 14));
    // black grip sleeve + the perforated tip (milk-crusted)
    this.put('rubber', g.lathe([[15, 0], [16, 10], [16, 78], [14, 88]], 20, true, true),
             M4.compose(M4.make(), W.tipX, W.tipY + 96, W.tipZ - 26, 0.30, 0, 0, 1, 1, 1));
    this.put('chromeWorn', g.lathe([[12, 0], [13, 6], [13, 26], [9, 34]], 20, true, true),
             M4.compose(M4.make(), W.tipX, W.tipY, W.tipZ, 0.30, 0, 0, 1, 1, 1));
    // valve knob (turns when steaming)
    const knob = g.empty();
    Geo.add(knob, g.lathe([[8, 0], [8, 40]], 16, true, true), g.mat(0, 0, 0));
    Geo.add(knob, g.roundBox(112, 20, 20, 9, 6), g.mat(0, 44, 0));
    Geo.add(knob, g.sphere(15, 16, 12), g.mat(-52, 44, 0));
    this.named.steamKnob = this.node(this.mesh(knob), mat('chrome'),
      M4.compose(M4.make(), W.baseX + 26, W.baseY + 34, W.baseZ, 0, 0, 0, 1, 1, 1));
    this.named.steamKnobBase = [W.baseX + 26, W.baseY + 34, W.baseZ];

    // hot-water tap on the far left
    this.put('chrome', g.tube([[cx - hw + 44, Y + 22 + 300, M.front + 10],
                               [cx - hw + 44, Y + 22 + 120, M.front + 40],
                               [cx - hw + 44, Y + 60, M.front + 46]], 9, 12));
  },

  /* ------------------------------------------------------------- grinder */
  grinder() {
    const g = Geo, G = LAY.grinder, Y = LAY.counterY;
    const base = g.empty();
    g.add(base, g.roundBox(210, 96, 280, 12, 8), g.mat(0, 48, 0));
    g.add(base, g.roundBox(184, 300, 250, 18, 10), g.mat(0, 246, -10));
    this.put('steel', g.groundAO(base, 0, 60, 0.4), g.mat(G.x, Y, G.z));
    // throat and chute
    this.put('steelFine', g.lathe([[62, 0], [62, 74], [48, 86], [44, 120]], 28),
             g.mat(G.x, G.chuteY - 26, G.z - 10));
    this.put('blackPly', g.lathe([[40, 0], [40, 34], [34, 40]], 24, false, true),
             g.mat(G.x, G.chuteY - 40, G.z - 10));
    // portafilter fork
    const fork = g.empty();
    g.add(fork, g.roundBox(30, 16, 130, 6, 5), g.mat(-72, 0, 0));
    g.add(fork, g.roundBox(30, 16, 130, 6, 5), g.mat(72, 0, 0));
    g.add(fork, g.roundBox(180, 14, 30, 5, 5), g.mat(0, 0, -66));
    this.put('chrome', fork, g.mat(G.x, G.forkY, G.z + 34));
    // hopper: smoked polycarbonate cone with a chrome collar and a lid
    this.put('chrome', g.lathe([[86, 0], [90, 10], [90, 26], [84, 34]], 32),
             g.mat(G.x, Y + 396, G.z - 10));
    this.put('glass', g.lathe([[80, 0], [104, 130], [112, 250], [110, 268]], 34),
             g.mat(G.x, Y + 424, G.z - 10));
    this.put('blackPly', g.lathe([[112, 0], [116, 10], [104, 26], [40, 34]], 32, false, true),
             g.mat(G.x, Y + 690, G.z - 10));
    // beans heaped inside the hopper
    const beans = g.empty();
    for (let i = 0; i < 90; i++) {
      const a = i * 2.399, r = Math.sqrt((i % 30 + 1) / 31) * 78;
      const y = 40 + ((i * 37) % 90);
      const b = g.sphere(5.6, 8, 6);
      for (let k = 0; k < b.pos.length; k += 3) { b.pos[k] *= 1.35; b.pos[k + 2] *= 0.8; }
      g.add(beans, b, M4.compose(M4.make(), Math.cos(a) * r, y, Math.sin(a) * r,
                                 0, a * 1.7, 0.4, 1, 1, 1));
    }
    this.put('coffee', beans, g.mat(G.x, Y + 440, G.z - 10));
    // control face + running lamp
    this.put('blackPly', g.roundBox(120, 74, 16, 8, 6), g.mat(G.x, Y + 300, G.z + 116));
    this.named.grindLamp = this.node(this.mesh(g.lathe([[11, 0], [11, 5], [8, 9]], 18, true, true)),
      mat('porcelain', { mode: 3, emissive: [0.25, 0.05, 0.04], tint: [1, 1, 1] }),
      M4.compose(M4.make(), G.x, Y + 300, G.z + 126, Math.PI / 2, 0, 0, 1, 1, 1),
      { noShadow: true });
  },

  /* ------------------- near-field props: they give the frame its foreground */
  dressing() {
    const g = Geo, Y = LAY.counterY;
    // knock box, right at the front edge and close to camera
    const kb = g.empty();
    g.add(kb, g.roundBox(190, 150, 190, 14, 8), g.mat(0, 75, 0));
    this.put('blackPly', g.groundAO(kb, 0, 40, 0.5), g.mat(-300, Y, -40));
    this.put('chromeWorn', g.roundBox(150, 26, 26, 11, 8), g.mat(-300, Y + 132, -40));
    this.put('coffee', g.lathe([[70, 0], [66, 22], [40, 30]], 24, false, true),
             g.mat(-300, Y + 32, -40));
    // folded cloth
    this.put('rubber', g.roundBox(210, 22, 150, 10, 6),
             M4.compose(M4.make(), -790, Y + 11, -70, 0, 0.26, 0, 1, 1, 1));
    // a jar of spoons
    this.put('glass', g.lathe([[42, 0], [46, 14], [46, 118], [44, 126]], 24, true, false),
             g.mat(880, Y, -300));
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      this.put('chrome', g.tube([[880 + Math.cos(a) * 12, Y + 20, -300 + Math.sin(a) * 12],
                                 [880 + Math.cos(a) * 26, Y + 190, -300 + Math.sin(a) * 26]], 4.5, 8));
    }
    // stack of saucers by the serving area
    for (let i = 0; i < 4; i++) {
      this.put('porcelain', this.saucerGeo(), g.mat(LAY.serve.x + 210, Y + i * 13, LAY.serve.z - 60));
    }
    // serving tray
    const tray = g.empty();
    g.add(tray, g.roundBox(420, 22, 300, 8, 8), g.mat(0, 0, 0));
    g.add(tray, g.roundBox(430, 12, 310, 6, 6), g.mat(0, 12, 0));
    this.put('wood', g.groundAO(tray, -11, 20, 0.4), g.mat(LAY.serve.x, Y + 11, LAY.serve.z));

    // clean cups warming on the machine top
    this.named.stackCups = [];
    for (let i = 0; i < 4; i++) {
      const n = this.node(this.mesh(this.cupGeo(true)), mat('porcelain'),
        g.mat(LAY.stack.x + (i % 2) * 130 - 65, LAY.stack.y, LAY.stack.z + Math.floor(i / 2) * 120 - 60));
      this.named.stackCups.push(n);
    }
  },

  /* ---------------------------------------------------------- prop makers */
  /** cappuccino cup: rim Ø85, height 62, 4 mm porcelain, real handle */
  cupGeo(upsideDown) {
    const g = Geo;
    const m = g.empty();
    const prof = [
      [26, 0], [28, 3, 1], [28, 6], [24, 9, 1],          // foot ring
      [26, 12], [34, 30], [40.5, 52], [42.5, 60],
      [42.5, 62, 1],
      [38.5, 61], [37, 52], [30, 30], [22, 13], [0, 11]  // inside wall + floor
    ];
    g.add(m, g.lathe(prof, 44, true, false));
    // handle: a real loop with an oval section
    const hp = g.bezier([40, 46, 0], [82, 50, 0], [86, 20, 0], [40, 20, 0], 16);
    g.add(m, g.tube(hp, t => 5.5 + Math.sin(t * Math.PI) * 1.8, 12));
    if (upsideDown) {
      const out = g.empty();
      g.add(out, m, M4.compose(M4.make(), 0, 62, 0, Math.PI, 0, 0, 1, 1, 1));
      return out;
    }
    return m;
  },
  saucerGeo() {
    return Geo.lathe([[30, 0], [34, 2, 1], [34, 4], [46, 5], [72, 9],
                      [75, 12, 1], [72, 14], [44, 10], [32, 8], [0, 8]], 40, false, false);
  },
  /** 0.6 L stainless pitcher: Ø95 rim, 135 tall, beak spout, strap handle */
  pitcherGeo() {
    const g = Geo, m = g.empty();
    const prof = [
      [38, 0], [40, 4, 1], [42, 10], [47.5, 118], [47.5, 128, 1],
      [43.5, 127], [43, 116], [37, 8], [0, 6]
    ];
    g.add(m, g.lathe(prof, 40, true, false));
    // spout beak folded out of the rim on -X
    const beak = g.empty();
    const bp = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bp.push([-47 - t * 26, 128 - t * t * 16, 0]);
    }
    g.add(beak, g.tube(bp, t => 15 * (1 - t * 0.55), 10, [15, 6]));
    g.add(m, beak);
    // strap handle on +X
    const hp = g.bezier([46, 112, 0], [104, 108, 0], [104, 34, 0], [44, 28, 0], 18);
    g.add(m, g.tube(hp, 7, 10, [9, 5]));
    return m;
  },
  /** 58 mm portafilter.  Origin = the mounting plane, axis = Y. */
  portafilterGeo() {
    const g = Geo, m = g.empty();
    // ring + basket, hanging below the mounting plane
    g.add(m, g.lathe([
      [30, -58], [32, -56, 1], [32, -46], [29.5, -44],   // basket floor
      [29.5, -6], [30, -4, 1],
      [38, -4], [38, 2, 1], [34, 4], [34, 0],
      [29, -4], [29, -44], [26, -46], [26, -56]
    ], 40, false, false));
    // outer collar with the three ears
    g.add(m, g.lathe([[34, -30], [38, -26], [38, -6], [34, -2]], 40));
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU + 0.5;
      g.add(m, g.roundBox(34, 11, 17, 3.5, 5),
        M4.compose(M4.make(), Math.cos(a) * 40, -12, Math.sin(a) * 40, 0, -a, 0, 1, 1, 1));
    }
    // twin spouts
    g.add(m, g.lathe([[26, -62], [24, -58], [24, -56]], 28, true, false), g.mat(0, 0, 0));
    for (const sx of [-11, 11]) {
      g.add(m, g.lathe([[7, 0], [7, -12], [4.5, -18]], 16, false, true), g.mat(sx, -60, 0));
    }
    // chromed neck; the grip itself is a separate black part
    g.add(m, g.lathe([[15, 0], [15, 34], [13, 38]], 22, true, true),
      M4.compose(M4.make(), 34, -18, 0, 0, 0, -Math.PI / 2, 1, 1, 1));
    return m;
  },
  /** the moulded grip — matt black phenolic, so the handle reads at a glance */
  pfHandleGeo() {
    const g = Geo, m = g.empty();
    g.add(m, g.lathe([[16, 0], [17, 8], [16.5, 26], [15, 74], [16.5, 92], [14, 104], [7, 110]],
                     26, true, true),
      M4.compose(M4.make(), 70, -18, 0, 0, 0, -Math.PI / 2, 1, 1, 1));
    return m;
  },
  /** the puck of ground coffee inside the basket */
  puckGeo() {
    return Geo.lathe([[0, 0], [24, 0], [28.5, 1], [29, 4], [28, 6], [0, 6]], 36, false, false);
  },
  tamperGeo() {
    const g = Geo, m = g.empty();
    g.add(m, g.lathe([[0, 0], [28.5, 0.5], [29, 3, 1], [29, 13], [26, 16], [11, 18]], 36, false, false));
    g.add(m, g.lathe([[11, 18], [11, 44], [16, 47]], 24));
    return m;
  },
  tamperKnobGeo() {
    return Geo.lathe([[16, 0], [24, 6], [27, 22], [24, 40], [15, 48], [0, 50]], 32, false, false);
  },

  /* ------------------------------------------------------ movable objects */
  movables() {
    const g = Geo;
    const N = this.named;

    N.portafilter = this.node(this.mesh(this.portafilterGeo()), mat('chromeWorn'), M4.make());
    N.pfHandle = this.node(this.mesh(this.pfHandleGeo()),
      mat('blackPly', { tint: [0.62, 0.60, 0.60], rough: [0.9, 0.10] }), M4.make());
    N.pfHandle.visible = false;
    N.puck = this.node(this.mesh(this.puckGeo()), mat('coffee'), M4.make());
    N.puck.visible = false;

    N.cup = this.node(this.mesh(this.cupGeo()), mat('porcelain'), M4.make());
    N.cup.visible = false;
    N.saucer = this.node(this.mesh(this.saucerGeo()), mat('porcelain'), M4.make());
    N.saucer.visible = false;

    // the drink surface: a disc whose texture is the live latte-art field
    this.lattePix = document.createElement('canvas');
    this.lattePix.width = this.lattePix.height = Fluid.N;
    this.latteTex = GLX.texDynamic(Fluid.N, Fluid.N);
    N.drink = this.node(this.mesh(g.disc(1, 64, 1)),
      mat('porcelain', { mode: 1, extra: this.latteTex, tint: [1, 1, 1] }),
      M4.make(), { noShadow: true });
    N.drink.visible = false;
    // plain liquid surface for espresso-only / pre-art states
    N.liquid = this.node(this.mesh(g.disc(1, 48, 1)), mat('espresso'), M4.make(), { noShadow: true });
    N.liquid.visible = false;

    N.pitcher = this.node(this.mesh(this.pitcherGeo()), mat('satin'), M4.make());
    N.pitcher.visible = false;
    N.milk = this.node(this.mesh(this.vortexGeo()), mat('milk'), M4.make(), { noShadow: true });
    N.milk.visible = false;

    N.tamper = this.node(this.mesh(this.tamperGeo()), mat('chrome'), M4.make());
    N.tamper.visible = false;
    N.tamperKnob = this.node(this.mesh(this.tamperKnobGeo()), mat('wood',
      { uvScale: [4, 4], tint: [1.5, 1.1, 0.9] }), M4.make());
    N.tamperKnob.visible = false;

    // two espresso threads
    N.stream = [];
    for (let i = 0; i < 2; i++) {
      const n = this.node(this.mesh(g.lathe([[1, 0], [0.72, 1]], 12)),
        mat('espresso', { tint: [0.16, 0.075, 0.035] }), M4.make(), { noShadow: true });
      n.visible = false;
      N.stream.push(n);
    }
    // the milk thread while pouring
    N.milkStream = this.node(this.mesh(g.lathe([[1, 0], [0.8, 1]], 12)),
      mat('milk', { tint: [1.05, 1.02, 0.95], rough: [0.3, 0.02] }), M4.make(), { noShadow: true });
    N.milkStream.visible = false;

    // finished drinks that accumulate on the tray
    N.trayCups = [];
    for (let i = 0; i < 5; i++) {
      const c = this.node(this.mesh(this.cupGeo()), mat('porcelain'), M4.make());
      const s = this.node(this.mesh(this.saucerGeo()), mat('porcelain'), M4.make());
      const d = this.node(this.mesh(g.disc(1, 40, 1)), mat('porcelain', { mode: 1 }), M4.make(),
                          { noShadow: true });
      c.visible = s.visible = d.visible = false;
      N.trayCups.push({ cup: c, saucer: s, drink: d, tex: null });
    }
  },

  /** a milk surface with a real whirlpool dimple and spiral ridges */
  vortexGeo() {
    const rings = 26, seg = 56, R = 43;
    const m = Geo.empty();
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, r = t * R;
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * TAU;
        const dip = -14 * Math.exp(-Math.pow(r / (R * 0.42), 2));
        const spiral = Math.sin(a * 2 + r * 0.16) * 1.6 * Math.min(1, r / 12) * (1 - t * 0.4);
        const y = dip + spiral;
        m.pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        // normal from the analytic slope
        const dr = 0.5;
        const dip2 = -14 * Math.exp(-Math.pow((r + dr) / (R * 0.42), 2));
        const slope = (dip2 - dip) / dr;
        const nx = -slope * Math.cos(a), nz = -slope * Math.sin(a);
        const l = Math.hypot(nx, 1, nz);
        m.nrm.push(nx / l, 1 / l, nz / l);
        m.uv.push(0.5 + Math.cos(a) * t * 0.5, 0.5 + Math.sin(a) * t * 0.5);
        m.ao.push(1 - Math.exp(-Math.pow(r / (R * 0.5), 2)) * 0.35);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
        m.idx.push(a, c, b, b, c, d);
      }
    }
    return m;
  }
};
