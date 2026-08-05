// ---------------------------------------------------------------------------
// ゲーム進行 / 入力 / 演出
// 進行: title → motif → cut → fill → join → polish → install → open → view
// ---------------------------------------------------------------------------
'use strict';

const PALETTES = [
  { id: 'niji', colors: ['#e0473c', '#ef913a', '#f3cf46', '#4aa85f', '#3b7ed0', '#9455cf'] },
  { id: 'umi', colors: ['#2b9fc9', '#3fc7ad', '#7ad9dd', '#3a6ed0', '#a6e2ef', '#28518f'] },
  { id: 'yume', colors: ['#f07fa8', '#f8b9d2', '#c294e8', '#8fb8f0', '#f8db8c', '#a6e6bf'] },
];

// 太陽は環境光の 100 倍以上 — この比率が「差し込む光」の説得力になる。
// sunDir は光の進行方向。奥へ寝かせるほど床の模様が室内へ届く。
const TIMES = [
  {
    id: 'hiru', sunDir: [0.32, -0.76, 0.57], sunCol: [13.5, 12.8, 11.6],
    skyTop: [0.26, 0.57, 1.28], skyHorizon: [1.00, 1.19, 1.43],
    fogCol: [0.70, 0.79, 0.90], fogDensity: 0.0050, stars: 0, lamp: 0.26,
  },
  {
    id: 'asa', sunDir: [0.44, -0.62, 0.65], sunCol: [11.5, 8.4, 5.6],
    skyTop: [0.33, 0.63, 1.17], skyHorizon: [1.35, 1.14, 0.93],
    fogCol: [0.82, 0.76, 0.70], fogDensity: 0.0055, stars: 0, lamp: 0.40,
  },
  {
    id: 'yugata', sunDir: [0.50, -0.62, 0.60], sunCol: [13.0, 5.8, 2.3],
    skyTop: [0.36, 0.33, 0.69], skyHorizon: [1.50, 0.75, 0.36],
    fogCol: [0.86, 0.54, 0.36], fogDensity: 0.0062, stars: 0.12, lamp: 0.52,
  },
  {
    id: 'yoru', sunDir: [0.12, -0.72, 0.68], sunCol: [1.5, 1.9, 3.4],
    skyTop: [0.012, 0.022, 0.066], skyHorizon: [0.054, 0.090, 0.190],
    fogCol: [0.05, 0.07, 0.13], fogDensity: 0.0060, stars: 1.0, lamp: 1.0,
  },
];

const BX = -0.95;   // 作業台の中心 (world.js の BENCH_X と一致させる)

const CAMS = {
  title: { pos: [BX + 1.35, 1.62, 1.95], target: [BX + 0.15, 1.05, 0.20], fov: 42, fovH: 58 },
  motif: { pos: [BX + 0.06, 1.74, 1.70], target: [BX, 1.22, 0.30], fov: 44, fovH: 60 },
  bench: { pos: [BX + 0.01, 2.06, 1.52], target: [BX, 0.83, 0.33], fov: 46, fovH: 58 },
  install: { pos: [1.28, 1.62, 2.08], target: [-0.50, 1.42, -0.70], fov: 52, fovH: 74 },
  open: { pos: [0.92, 1.62, 1.62], target: [-0.02, 1.30, -1.25], fov: 50, fovH: 70 },
  view: { pos: [1.74, 1.76, 2.22], target: [0.30, 0.88, -0.62], fov: 55, fovH: 76 },
};

const STAGE_CAM = {
  title: 'title', motif: 'motif', cut: 'bench', fill: 'bench', join: 'bench',
  polish: 'bench', install: 'install', open: 'open', view: 'view',
};

const STAGE_WORD = {
  motif: 'えらぶ', cut: 'きる', fill: 'いろ', join: 'つなぐ',
  polish: 'みがく', install: 'つける', open: 'あける', view: '',
};

const BENCH_PANEL = { pos: [BX, 0.818, 0.42], rot: [-Math.PI / 2, 0, 0] };

class Game {
  constructor(gl, canvas, renderer, sound, ui) {
    this.gl = gl;
    this.canvas = canvas;
    this.renderer = renderer;
    this.sound = sound;
    this.ui = ui;

    this.world = buildWorld(gl);
    this.cards = [];
    this.panelCells = null;
    this.panelInstalled = false;
    this.motif = null;
    this.paletteIndex = 0;
    this.timeIndex = 0;

    this.stage = 'title';
    this.stageTime = 0;
    this.time = 0;
    this.fade = 0;
    this.idle = 0;
    this.dirtAmt = 0;
    this.scoreAlpha = 0;
    this.backlight = 0;
    this.shutterOpen = 0;
    this.installProgress = 0;
    this.sprites = [];
    this.sparks = [];
    this.shaftStrength = 0;
    this.autoTimer = 0;
    this.birdTimer = 4;

    this.cam = { pos: V3.c(1.2, 1.6, 2.2), target: V3.c(0, 1.2, 0), fov: 45 };
    this.camPos = V3.c(1.2, 1.6, 2.2);
    this.camTarget = V3.c(0, 1.2, 0);
    this.orbit = { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, auto: 0 };

    this.view = M4.c();
    this.proj = M4.c();
    this.viewProj = M4.c();
    this.invViewProj = M4.c();
    this.invPanel = M4.c();
    this.panelModel = M4.c();
    this.tmpM = M4.c();
    this.tmpV = V3.c();
    this.tmpV2 = V3.c();

    this.env = {
      sunDir: V3.c(), sunCol: V3.c(), skyTop: V3.c(), skyHorizon: V3.c(),
      ambTop: V3.c(), ambBot: V3.c(), lampPos: V3.c(), lampCol: V3.c(),
      lampRange: 4.2, fogCol: V3.c(), fogDensity: 0.005, stars: 0,
      bloom: 0.85, vignette: 0.42, bloomThresh: 0.85, sunAmount: 0, bounce: V3.c(),
    };
    V3.copy(this.env.lampPos, this.world.lampPos);

    this.pointer = { down: false, x: 0, y: 0, px: 0, py: 0, moved: 0 };
    this.cssW = 1; this.cssH = 1;

    this.setTime(0, true);
    this.buildCards();
    this.setPanelModel(BENCH_PANEL.pos, BENCH_PANEL.rot);
    this.ui.setPalette(PALETTES[this.paletteIndex].colors, (i) => { this.selectColor(i); });
    this.selectedColor = 0;
  }

  // --- 環境 ---------------------------------------------------------------
  setTime(i, immediate) {
    this.timeIndex = ((i % TIMES.length) + TIMES.length) % TIMES.length;
    const t = TIMES[this.timeIndex];
    V3.norm(this.env.sunDir, V3.c(t.sunDir[0], t.sunDir[1], t.sunDir[2]));
    this.rebuildShaft();
    if (immediate) this.applyEnv(1);
  }

  rebuildShaft() {
    if (this.shaftMesh) this.shaftMesh.dispose();
    if (this.dust) this.dust.dispose();
    this.shaftMesh = buildShaftMesh(this.gl, this.env.sunDir, 7.5);
    this.dust = buildDust(this.gl, this.env.sunDir, 520);
  }

  applyEnv(k) {
    const t = TIMES[this.timeIndex];
    const e = this.env;
    const s = this.env.sunAmount;
    V3.set(e.sunCol, t.sunCol[0], t.sunCol[1], t.sunCol[2]);
    V3.set(e.skyTop, t.skyTop[0], t.skyTop[1], t.skyTop[2]);
    V3.set(e.skyHorizon, t.skyHorizon[0], t.skyHorizon[1], t.skyHorizon[2]);
    V3.set(e.fogCol, t.fogCol[0], t.fogCol[1], t.fogCol[2]);
    e.fogDensity = t.fogDensity;
    e.stars = t.stars;
    // 準備中は暗い室内、開放後は空の色を含んだ環境光
    const ambT = [
      MathX.lerp(0.020, t.skyHorizon[0] * 0.055 + 0.012, s),
      MathX.lerp(0.021, t.skyHorizon[1] * 0.055 + 0.012, s),
      MathX.lerp(0.028, t.skyHorizon[2] * 0.060 + 0.014, s),
    ];
    const ambB = [
      MathX.lerp(0.011, 0.016 + t.sunCol[0] * 0.0034, s),
      MathX.lerp(0.010, 0.014 + t.sunCol[1] * 0.0032, s),
      MathX.lerp(0.009, 0.012 + t.sunCol[2] * 0.0030, s),
    ];
    V3.set(e.ambTop, ambT[0], ambT[1], ambT[2]);
    V3.set(e.ambBot, ambB[0], ambB[1], ambB[2]);
    const lampK = MathX.lerp(1.0, t.lamp, s);
    V3.set(e.lampCol, 4.7 * lampK, 3.15 * lampK, 1.85 * lampK);
    // ガラスの平均色で室内をほんのり染める (擬似的な一次反射)
    let br = 0.55, bg = 0.58, bb = 0.62;
    if (this.panelInstalled && this.panelCells) {
      let r = 0, g2 = 0, b = 0, n = 0;
      for (const c of this.panelCells) {
        if (!c.color) continue;
        r += c.color[0]; g2 += c.color[1]; b += c.color[2]; n++;
      }
      if (n) { br = r / n * 0.55 + 0.45; bg = g2 / n * 0.55 + 0.45; bb = b / n * 0.55 + 0.45; }
    }
    const bk = 0.0125 * s;
    V3.set(e.bounce, e.sunCol[0] * br * bk, e.sunCol[1] * bg * bk, e.sunCol[2] * bb * bk);
    e.vignette = MathX.lerp(0.55, 0.30, s);
    e.bloom = MathX.lerp(0.55, 1.05, s);
  }

  // --- モチーフカード ------------------------------------------------------
  buildCards() {
    const gl = this.gl;
    const pal = PALETTES[this.paletteIndex].colors;
    const xs = [BX - 0.54, BX - 0.18, BX + 0.18, BX + 0.54];
    MOTIF_LIST.forEach((id, i) => {
      const parts = buildMotifCard(gl, id).map((p, k) => ({
        mesh: p.mesh, hint: p.hint, plate: p.plate,
        model: M4.c(), nrm: M3.c(), seed: k * 2.1,
        color: MathX.toLinear(MathX.hexToRgb(pal[p.hint % pal.length])),
      }));
      const plate = {
        name: 'card' + i,
        mesh: new Mesh(gl, Geom.box(0.32, 0.32, 0.018, 3)),
        model: M4.c(), nrm: M3.c(), visible: true, pass: 'opaque',
        mat: mat({ albedo: '#6a5136', rough: 0.7, type: 4, wear: 0.9 }),
      };
      this.cards.push({
        id, index: i, parts, plate, alpha: 0, glow: 0, highlight: 0,
        base: [xs[i], 1.24, 0.30], offset: 0, scale: 1, chosen: false,
      });
    });
  }

  updateCards(dt) {
    const show = this.stage === 'motif';
    // 縦持ちでは 2×2、横持ちでは横一列に並べる
    const portrait = this.cssW < this.cssH;
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (portrait) {
        c.base[0] = BX + (i % 2 ? 0.19 : -0.19);
        c.base[1] = i < 2 ? 1.42 : 1.05;
      } else {
        c.base[0] = BX - 0.54 + i * 0.36;
        c.base[1] = 1.24;
      }
    }
    for (const c of this.cards) {
      const target = show ? 1 : 0;
      c.alpha = MathX.damp(c.alpha, target, show ? 4 : 8, dt);
      const bob = Math.sin(this.time * 1.3 + c.index * 1.1) * 0.018;
      const rise = (1 - c.alpha) * (c.chosen ? 0.30 : -0.45);
      const hl = c.chosen ? 1 : 0;
      c.highlight = MathX.damp(c.highlight, hl * 0.8, 8, dt);
      c.glow = MathX.damp(c.glow, show ? 0.30 : 0, 3, dt);
      const sc = c.scale * (0.6 + 0.4 * c.alpha) * (c.chosen ? 1.18 : 1);
      const rot = [-0.34, Math.sin(this.time * 0.7 + c.index) * 0.12, 0];
      M4.compose(c.plate.model, [c.base[0], c.base[1] + bob + rise, c.base[2]], rot, [sc, sc, sc]);
      M3.normalFromM4(c.plate.nrm, c.plate.model);
      c.plate.visible = c.alpha > 0.02;
      c.plate.mat.emissive = [c.highlight * 0.25, c.highlight * 0.22, c.highlight * 0.16];
      for (const p of c.parts) {
        M4.identity(this.tmpM);
        this.tmpM[0] = 0.42; this.tmpM[5] = 0.42; this.tmpM[10] = 0.42;
        this.tmpM[14] = 0.014;
        M4.mul(p.model, c.plate.model, this.tmpM);
        M3.normalFromM4(p.nrm, p.model);
      }
    }
  }

  // --- パネル -------------------------------------------------------------
  setPanelModel(pos, rot) {
    M4.compose(this.panelModel, pos, rot, [1, 1, 1]);
    M4.invert(this.invPanel, this.panelModel);
  }

  newPanel() {
    if (this.panelCells) {
      for (const c of this.panelCells) {
        c.glassMesh.dispose(); c.cameMesh.dispose(); c.scoreMesh.dispose();
      }
    }
    this.panelCells = buildPanel(this.gl, this.motif);
    // 磨き用の判定グリッド
    const R = PANEL.uvRect;
    this.grid = [];
    for (let j = 0; j < 18; j++) {
      for (let i = 0; i < 18; i++) {
        const x = R[0] + R[2] * (i + 0.5) / 18;
        const y = R[1] + R[3] * (j + 0.5) / 18;
        let inside = false;
        for (const c of this.panelCells) if (polyContains(c.pts, x, y)) { inside = true; break; }
        if (inside) this.grid.push({ x, y, done: 0 });
      }
    }
    this.renderer.clearDirt(1);
  }

  updateCellModels() {
    if (!this.panelCells) return;
    for (const c of this.panelCells) {
      const sep = c.cut * (1 - c.join);
      let dx = c.centroid[0], dy = c.centroid[1];
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      const ox = dx * 0.016 * sep, oy = dy * 0.016 * sep;
      const oz = (c.plate ? 0.0062 : 0) + 0.004 * sep;
      const s = 1 + c.pop * 0.09;
      const cx = c.centroid[0], cy = c.centroid[1];
      const m = this.tmpM;
      M4.identity(m);
      m[0] = s; m[5] = s; m[10] = s;
      m[12] = cx * (1 - s) + ox; m[13] = cy * (1 - s) + oy; m[14] = oz;
      M4.mul(c.model, this.panelModel, m);
      M3.normalFromM4(c.nrm, c.model);
    }
  }

  // --- ステージ管理 --------------------------------------------------------
  setStage(name) {
    this.stage = name;
    this.stageTime = 0;
    this.idle = 0;
    this.autoTimer = 0;
    this.ui.setStage(STAGE_WORD[name] || '');
    this.sound.rubbing(0);
    this.sound.shutter(0);
    this.ui.showPalette(name === 'fill');
    this.ui.showViewButtons(name === 'view');
    if (name === 'cut') this.sound.ambience(true);
    if (name === 'polish') this.dirtTarget = 1.0;
    if (name === 'install') this.installProgress = 0;
    if (name === 'view') this.orbit.auto = 0;
  }

  selectColor(i) {
    this.selectedColor = i;
    this.sound.pop(i + 2);
  }

  currentPalette() { return PALETTES[this.paletteIndex].colors; }

  colorOf(i) {
    const pal = this.currentPalette();
    return MathX.toLinear(MathX.hexToRgb(pal[i % pal.length]));
  }

  // --- 入力 ---------------------------------------------------------------
  setViewport(w, h) { this.cssW = w; this.cssH = h; }

  ray(px, py) {
    const x = px / this.cssW * 2 - 1;
    const y = 1 - py / this.cssH * 2;
    const p0 = M4.transformPoint(V3.c(), this.invViewProj, [x, y, -1]);
    const p1 = M4.transformPoint(V3.c(), this.invViewProj, [x, y, 1]);
    const d = V3.norm(V3.c(), V3.sub(V3.c(), p1, p0));
    return { o: this.cam.pos, d };
  }

  hitPanel(px, py) {
    const r = this.ray(px, py);
    const o = M4.transformPoint(V3.c(), this.invPanel, r.o);
    const d = M4.transformDir(V3.c(), this.invPanel, r.d);
    if (Math.abs(d[2]) < 1e-6) return null;
    const t = -o[2] / d[2];
    if (t < 0) return null;
    return [o[0] + d[0] * t, o[1] + d[1] * t];
  }

  hitCard(px, py) {
    const r = this.ray(px, py);
    let best = null, bestT = 1e9;
    for (const c of this.cards) {
      if (c.alpha < 0.5) continue;
      const inv = M4.invert(M4.c(), c.plate.model);
      const o = M4.transformPoint(V3.c(), inv, r.o);
      const d = M4.transformDir(V3.c(), inv, r.d);
      if (Math.abs(d[2]) < 1e-6) continue;
      const t = -o[2] / d[2];
      if (t < 0 || t > bestT) continue;
      const x = o[0] + d[0] * t, y = o[1] + d[1] * t;
      if (Math.abs(x) < 0.19 && Math.abs(y) < 0.19) { best = c; bestT = t; }
    }
    return best;
  }

  onDown(x, y) {
    this.sound.start();
    this.pointer.down = true;
    this.pointer.x = x; this.pointer.y = y;
    this.pointer.px = x; this.pointer.py = y;
    this.pointer.moved = 0;
    this.idle = 0;
    this.lastLocal = null;
    if (this.stage === 'motif') {
      const c = this.hitCard(x, y);
      if (c) this.chooseCard(c);
    } else if (this.stage === 'view') {
      this.orbit.auto = 0;
    }
    this.handleDrag(x, y, 0, 0, 0.016);
  }

  onMove(x, y) {
    if (!this.pointer.down) return;
    const dx = x - this.pointer.x, dy = y - this.pointer.y;
    this.pointer.moved += Math.hypot(dx, dy);
    this.pointer.x = x; this.pointer.y = y;
    this.idle = 0;
    this.handleDrag(x, y, dx, dy, 0.016);
  }

  onUp() {
    this.pointer.down = false;
    this.sound.rubbing(0);
    this.sound.shutter(0);
    this.lastLocal = null;
  }

  handleDrag(x, y, dx, dy, dt) {
    const st = this.stage;
    if (st === 'cut' || st === 'join') {
      const lp = this.hitPanel(x, y);
      if (!lp) return;
      let travel = 0;
      if (this.lastLocal) travel = Math.hypot(lp[0] - this.lastLocal[0], lp[1] - this.lastLocal[1]);
      this.lastLocal = lp;
      this.workSeam(lp[0], lp[1], travel, st);
    } else if (st === 'fill') {
      const lp = this.hitPanel(x, y);
      if (!lp) return;
      this.fillAt(lp[0], lp[1]);
    } else if (st === 'polish') {
      const lp = this.hitPanel(x, y);
      if (!lp) return;
      let travel = 0;
      if (this.lastLocal) travel = Math.hypot(lp[0] - this.lastLocal[0], lp[1] - this.lastLocal[1]);
      this.lastLocal = lp;
      this.polishAt(lp[0], lp[1], travel);
    } else if (st === 'install') {
      // 上へのドラッグで取り付けが進む
      const adv = (-dy) / (this.cssH * 0.42);
      if (adv > 0) this.installProgress = Math.min(1, this.installProgress + adv);
      else this.installProgress = Math.min(1, this.installProgress + Math.abs(dx) / (this.cssW * 1.6));
    } else if (st === 'open') {
      const adv = Math.abs(dx) / (this.cssW * 0.52) + Math.abs(dy) / (this.cssH * 1.4);
      if (adv > 0) this.setShutter(Math.min(1, this.shutterOpen + adv));
    } else if (st === 'view') {
      this.orbit.vyaw += dx / this.cssW * 2.4;
      this.orbit.vpitch += dy / this.cssH * 1.1;
    }
  }

  // きる / つなぐ: 継ぎ目の近くをなぞると進む
  workSeam(lx, ly, travel, mode) {
    const cells = this.panelCells;
    if (!cells) return;
    const amount = Math.min(0.22, travel * 2.6 + 0.010);
    let touched = 0;
    for (const c of cells) {
      const d = distToOutline(c.pts, lx, ly);
      if (d > 0.10) continue;
      const k = 1 - d / 0.10;
      const add = amount * (0.35 + 0.9 * k);
      if (mode === 'cut') {
        if (c.cut >= 1) continue;
        const before = c.cut;
        c.cut = Math.min(1, c.cut + add);
        if (c.cut > before) touched++;
        if (before < 1 && c.cut >= 1) { this.sound.pop(c.index + 1); this.spawnSparks(c, 6); }
      } else {
        if (c.join >= 1) continue;
        const before = c.join;
        c.join = Math.min(1, c.join + add * 0.85);
        if (c.join > before) touched++;
        if (before < 1 && c.join >= 1) this.sound.clink(c.index);
      }
    }
    if (touched > 0) {
      this.seamNoise = (this.seamNoise || 0) + travel;
      if (this.seamNoise > 0.07) {
        this.seamNoise = 0;
        if (mode === 'cut') this.sound.cut(0.6); else this.sound.clink(Math.floor(lx * 7 + 9));
      }
    }
  }

  fillAt(lx, ly) {
    const cells = this.panelCells;
    if (!cells) return;
    // 手前 (プレート) を優先
    for (let pass = 0; pass < 2; pass++) {
      for (let i = cells.length - 1; i >= 0; i--) {
        const c = cells[i];
        if ((pass === 0) !== !!c.plate) continue;
        if (!polyContains(c.pts, lx, ly)) continue;
        const col = this.colorOf(this.selectedColor);
        if (c.colorIndex === this.selectedColor) return;
        c.colorIndex = this.selectedColor;
        c.color = col;
        c.fill = Math.max(c.fill, 0.001);
        c.pop = 1;
        this.sound.chime(c.index % 8, 0.9);
        this.spawnSparks(c, 5);
        return;
      }
    }
  }

  polishAt(lx, ly, travel) {
    const R = PANEL.uvRect;
    const u = (lx - R[0]) / R[2];
    const v = (ly - R[1]) / R[3];
    if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) return;
    this.renderer.paintDirt(u, v, 0.115, 0.55);
    const rad = 0.115 * Math.max(R[2], R[3]);
    for (const g of this.grid) {
      if (Math.hypot(g.x - lx, g.y - ly) < rad) g.done = 1;
    }
    this.sound.rubbing(Math.min(1, travel * 40));
    if (Math.random() < 0.25) {
      const p = M4.transformPoint(V3.c(), this.panelModel, [lx, ly, 0.02]);
      this.sparks.push({
        pos: p, size: 0.02 + Math.random() * 0.03, life: 0.6,
        color: [1.0, 0.95, 0.85], vel: V3.c((Math.random() - 0.5) * 0.2, 0.25, (Math.random() - 0.5) * 0.2),
      });
    }
  }

  spawnSparks(c, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.08;
      const p = M4.transformPoint(V3.c(), c.model,
        [c.centroid[0] + Math.cos(a) * r, c.centroid[1] + Math.sin(a) * r, 0.01]);
      this.sparks.push({
        pos: p, size: 0.015 + Math.random() * 0.025, life: 0.5 + Math.random() * 0.3,
        color: c.color ? [c.color[0] + 0.5, c.color[1] + 0.5, c.color[2] + 0.5] : [1, 1, 1],
        vel: V3.c((Math.random() - 0.5) * 0.25, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.25),
      });
    }
  }

  chooseCard(card) {
    if (this.motif) return;
    this.motif = card.id;
    card.chosen = true;
    this.sound.chime(5, 1.0);
    this.newPanel();
    setTimeout(() => { if (this.stage === 'motif') this.setStage('cut'); }, 620);
  }

  setShutter(v) {
    const prev = this.shutterOpen;
    this.shutterOpen = v;
    if (v > prev) {
      this.sound.shutter(Math.min(1, (v - prev) * 60));
      if (prev < 0.02 && v >= 0.02) this.sound.knock();
    }
  }

  // --- 更新 ---------------------------------------------------------------
  update(dt) {
    this.time += dt;
    this.stageTime += dt;
    this.fade = MathX.damp(this.fade, 1, 1.6, dt);
    if (!this.pointer.down) this.idle += dt;

    this.updateReplay(dt);
    this.updateCards(dt);
    this.updateStage(dt);
    this.updateShutters(dt);
    this.applyEnv(dt);
    this.updateCamera(dt);
    this.updateCellModels();
    this.updateSprites(dt);

    // 行列 (レイと描画で共用)
    const aspect = this.cssW / this.cssH;
    M4.perspective(this.proj, this.cam.fov * Math.PI / 180, aspect, 0.05, 500);
    M4.lookAt(this.view, this.cam.pos, this.cam.target, [0, 1, 0]);
    M4.mul(this.viewProj, this.proj, this.view);
    M4.invert(this.invViewProj, this.viewProj);
  }

  updateStage(dt) {
    const cells = this.panelCells;
    const st = this.stage;

    // 汚れ量
    let dirtGoal = 0;
    if (st === 'cut' || st === 'fill' || st === 'join') dirtGoal = 0.34;
    else if (st === 'polish') dirtGoal = 1.0;
    else if (st === 'install' || st === 'open' || st === 'view') dirtGoal = this.polishDone ? 0.0 : 0.2;
    this.dirtAmt = MathX.damp(this.dirtAmt, dirtGoal, 2.5, dt);

    // けがき線の見え方
    const scoreGoal = st === 'cut' ? 1 : (st === 'fill' ? 0.45 : (st === 'join' ? 0.3 : 0));
    this.scoreAlpha = MathX.damp(this.scoreAlpha, scoreGoal, 3, dt);

    if (cells) {
      for (const c of cells) {
        if (c.color) c.fill = MathX.damp(c.fill, 1, 7, dt);
        c.pop = Math.max(0, c.pop - dt * 3.2);
        c.highlight = Math.max(0, (c.highlight || 0) - dt * 2.5);
      }
    }

    if (st === 'title') return;

    if (st === 'motif') {
      if (this.idle > 2.4) {
        const k = Math.floor(this.time * 0.7) % this.cards.length;
        this.hintAt(this.cards[k].base[0], this.cards[k].base[1], this.cards[k].base[2] + 0.16, 0.16);
      }
      return;
    }

    if (st === 'cut') {
      // 失敗なし: 手が止まったら少しずつ自動で進む
      if (this.idle > 2.6) this.assistSeam(dt * 1.5, 'cut');
      const rest = cells.filter((c) => c.cut < 0.999);
      if (rest.length === 0 && this.stageTime > 1.2) { this.sound.chime(7, 1); this.setStage('fill'); }
      else if (this.idle > 2.2 && rest.length) this.hintSeam(rest);
      return;
    }

    if (st === 'fill') {
      const rest = cells.filter((c) => !c.color);
      if (this.idle > 2.8 && rest.length) {
        this.autoTimer += dt;
        if (this.autoTimer > 0.38) {
          this.autoTimer = 0;
          const c = rest[Math.floor(Math.random() * rest.length)];
          c.colorIndex = c.hint % this.currentPalette().length;
          c.color = this.colorOf(c.colorIndex);
          c.pop = 1;
          this.sound.chime(c.index % 8, 0.7);
          this.spawnSparks(c, 4);
        }
      }
      if (rest.length === 0 && this.stageTime > 1.0) { this.sound.chime(8, 1); this.setStage('join'); }
      else if (this.idle > 2.0 && rest.length) {
        const c = rest[0];
        const p = M4.transformPoint(V3.c(), this.panelModel, [c.centroid[0], c.centroid[1], 0.02]);
        this.hintAt(p[0], p[1], p[2], 0.10);
      }
      return;
    }

    if (st === 'join') {
      if (this.idle > 2.6) this.assistSeam(dt * 1.5, 'join');
      const rest = cells.filter((c) => c.join < 0.999);
      if (rest.length === 0 && this.stageTime > 1.2) { this.sound.chime(7, 1); this.setStage('polish'); }
      else if (this.idle > 2.2 && rest.length) this.hintSeam(rest);
      return;
    }

    if (st === 'polish') {
      const done = this.grid.filter((g) => g.done).length / Math.max(1, this.grid.length);
      if (this.idle > 3.2) {
        // 自動で少しずつ拭き取る
        this.autoTimer += dt;
        if (this.autoTimer > 0.11) {
          this.autoTimer = 0;
          const rest = this.grid.filter((g) => !g.done);
          if (rest.length) {
            const g = rest[Math.floor(Math.random() * rest.length)];
            this.polishAt(g.x, g.y, 0.02);
          }
        }
      }
      if (done > 0.88) {
        this.polishDone = true;
        this.sound.chime(8, 1);
        this.renderer.clearDirt(0);
        this.setStage('install');
      } else if (this.idle > 2.0) {
        const rest = this.grid.filter((g) => !g.done);
        if (rest.length) {
          const g = rest[Math.floor(this.time * 0.5) % rest.length];
          const p = M4.transformPoint(V3.c(), this.panelModel, [g.x, g.y, 0.03]);
          this.hintAt(p[0], p[1], p[2], 0.11);
        }
      }
      return;
    }

    if (st === 'install') {
      const t = MathX.smoothstep(0, 1, this.installProgress);
      // ベンチ → 窓 への軌道 (制御点で弧を描く)
      const a = BENCH_PANEL.pos, b = PANEL_MOUNT;
      const c0 = [BX * 0.5, 1.78, 0.05];
      const mt = 1 - t;
      const px = mt * mt * a[0] + 2 * mt * t * c0[0] + t * t * b[0];
      const py = mt * mt * a[1] + 2 * mt * t * c0[1] + t * t * b[1];
      const pz = mt * mt * a[2] + 2 * mt * t * c0[2] + t * t * b[2];
      const rx = -Math.PI / 2 * (1 - MathX.smoothstep(0.05, 0.85, t));
      this.setPanelModel([px, py + Math.sin(t * Math.PI) * 0.05, pz], [rx, 0, 0]);
      if (this.installProgress >= 0.999) {
        if (!this.panelInstalled) {
          this.panelInstalled = true;
          this.sound.knock();
          this.sound.chime(6, 1);
          setTimeout(() => { if (this.stage === 'install') this.setStage('open'); }, 900);
        }
      } else if (this.idle > 1.6) {
        const ph = (this.time % 1.6) / 1.6;
        const p = M4.transformPoint(V3.c(), this.panelModel, [0, 0, 0.06]);
        this.hintAt(p[0], p[1] + 0.10 + ph * 0.3, p[2] - ph * 0.15, 0.13);
      }
      // 取り付け中は手が離れても少し進む
      if (this.idle > 3.0 && this.installProgress < 1) {
        this.installProgress = Math.min(1, this.installProgress + dt * 0.35);
      }
      return;
    }

    if (st === 'open') {
      if (this.shutterOpen < 1 && this.idle > 3.4) {
        this.setShutter(Math.min(1, this.shutterOpen + dt * 0.22));
      }
      if (!this.revealed && this.shutterOpen > 0.06) {
        this.revealed = true;
        this.sound.reveal();
      }
      if (this.shutterOpen >= 0.999 && this.stageTime > 1.0) {
        this.setStage('view');
      } else if (this.idle > 1.8 && this.shutterOpen < 0.999) {
        const ph = (this.time % 1.5) / 1.5;
        this.hintAt(0.32 + ph * 0.5, 1.68, ROOM.wallOut - 0.14, 0.13);
      }
      return;
    }

    if (st === 'view') {
      this.birdTimer -= dt;
      if (this.birdTimer < 0) {
        this.birdTimer = 6 + Math.random() * 12;
        if (TIMES[this.timeIndex].id !== 'yoru') this.sound.bird();
      }
    }
  }

  assistSeam(amount, mode) {
    const cells = this.panelCells;
    let target = null, worst = 2;
    for (const c of cells) {
      const v = mode === 'cut' ? c.cut : c.join;
      if (v < 0.999 && v < worst) { worst = v; target = c; }
    }
    if (!target) return;
    if (mode === 'cut') {
      const before = target.cut;
      target.cut = Math.min(1, target.cut + amount);
      if (before < 1 && target.cut >= 1) { this.sound.pop(target.index); this.spawnSparks(target, 4); }
    } else {
      const before = target.join;
      target.join = Math.min(1, target.join + amount);
      if (before < 1 && target.join >= 1) this.sound.clink(target.index);
    }
  }

  hintSeam(rest) {
    const c = rest[Math.floor(this.time * 0.4) % rest.length];
    const v = this.stage === 'cut' ? c.cut : c.join;
    const n = c.pts.length;
    const i = Math.min(n - 1, Math.floor(v * n));
    const p = M4.transformPoint(V3.c(), c.model, [c.pts[i][0], c.pts[i][1], 0.02]);
    this.hintAt(p[0], p[1], p[2], 0.085);
  }

  hintAt(x, y, z, size) {
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 4.2);
    this.sprites.push({
      pos: [x, y, z], size: size * (0.85 + pulse * 0.3),
      color: [0.55, 0.85, 1.0], alpha: 0.30 + pulse * 0.35, ring: true,
    });
  }

  updateSprites(dt) {
    this.sprites.length = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
      s.pos[0] += s.vel[0] * dt; s.pos[1] += s.vel[1] * dt; s.pos[2] += s.vel[2] * dt;
      s.vel[1] -= dt * 0.6;
      this.sprites.push({
        pos: s.pos, size: s.size * (0.6 + s.life), color: s.color,
        alpha: Math.min(1, s.life * 2) * 0.8, ring: false,
      });
    }
  }

  updateShutters(dt) {
    const open = this.shutterOpen;
    for (const nm of ['shutterL', 'shutterR']) {
      const o = this.world.by[nm];
      const s = o.side;
      M4.compose(this.tmpM, [s * (0.40 + open * 0.88), 1.68,
        ROOM.wallOut - (s < 0 ? 0.030 : 0.070)], [0, 0, 0], [1, 1, 1]);
      setModel(o, this.tmpM);
    }
    const h = this.world.by['handle'];
    M4.compose(this.tmpM, [0.30 + open * 0.88, 1.68, ROOM.wallOut - 0.095], [0, 0, 0], [1, 1, 1]);
    setModel(h, this.tmpM);

    // 開いた分だけ光が入る
    this.env.sunAmount = MathX.smoothstep(0.0, 0.55, open) * 0.55 + MathX.smoothstep(0.4, 1.0, open) * 0.45;
    this.shaftStrength = MathX.damp(this.shaftStrength, this.env.sunAmount * 0.13, 3, dt);

    // 雨戸が退いた分だけ、中央から外側へ順に光が回る
    if (this.panelCells) {
      const edge = open * 0.88;
      const gate = MathX.smoothstep(0.012, 0.05, open);
      for (const c of this.panelCells) {
        if (c.xMax === undefined) {
          let m = 0;
          for (const p of c.pts) m = Math.max(m, Math.abs(p[0]));
          c.xMax = m;
        }
        const bl = this.panelInstalled
          ? MathX.smoothstep(c.xMax * 0.88, c.xMax * 0.88 + 0.12, edge) * gate
          : 0;
        c.backlight = MathX.damp(c.backlight || 0, bl, 6, dt);
      }
    }
    this.backlight = this.panelInstalled ? this.env.sunAmount : 0;
  }

  updateCamera(dt) {
    const key = STAGE_CAM[this.stage] || 'view';
    const p = CAMS[key];
    const aspect = this.cssW / this.cssH;

    let pos = [p.pos[0], p.pos[1], p.pos[2]];
    const tgt = [p.target[0], p.target[1], p.target[2]];

    // 眺めるときは、時間帯ごとに変わる「床の模様の位置」へ画面を寄せる
    if (key === 'view') {
      const d = this.env.sunDir;
      const t = Math.min(6, 2.0 / Math.max(0.25, -d[1]));
      const px = MathX.clamp(d[0] * t, -1.7, 1.9);
      const pz = MathX.clamp(WIN.glassZ + d[2] * t, -1.8, 1.5);
      tgt[0] += (px - 0.84) * 0.70;
      tgt[2] += (pz + 0.42) * 0.55;
    }

    // 縦持ちでも被写体が収まるように: まず画角、足りなければ後退
    let fovDeg = p.fov;
    const tanH = Math.tan(p.fovH * Math.PI / 360);
    let need = tanH / (Math.tan(fovDeg * Math.PI / 360) * aspect);
    if (need > 1) {
      const wantDeg = 2 * Math.atan(tanH / aspect) * 180 / Math.PI;
      fovDeg = MathX.clamp(wantDeg, p.fov, Math.min(64, p.fov * 1.4));
      need = tanH / (Math.tan(fovDeg * Math.PI / 360) * aspect);
    }
    this.targetFov = fovDeg;
    const back = MathX.clamp(need, 1, 1.7);
    let dir = [pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]];
    pos = [tgt[0] + dir[0] * back, tgt[1] + dir[1] * back, tgt[2] + dir[2] * back];

    // 眺めるステージ: 一本指でゆっくり見回す
    if (this.stage === 'view' || this.stage === 'title') {
      this.orbit.yaw += this.orbit.vyaw * dt * 3;
      this.orbit.pitch += this.orbit.vpitch * dt * 3;
      this.orbit.vyaw = MathX.damp(this.orbit.vyaw, 0, 4, dt);
      this.orbit.vpitch = MathX.damp(this.orbit.vpitch, 0, 4, dt);
      this.orbit.yaw = MathX.clamp(this.orbit.yaw, -0.55, 0.55);
      this.orbit.pitch = MathX.clamp(this.orbit.pitch, -0.32, 0.30);
      if (!this.pointer.down) {
        this.orbit.auto += dt;
        this.orbit.yaw += Math.sin(this.time * 0.11) * dt * 0.045;
      }
      const yaw = this.orbit.yaw, pit = this.orbit.pitch;
      dir = [pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]];
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const nx = dir[0] * cy + dir[2] * sy;
      const nz = -dir[0] * sy + dir[2] * cy;
      pos = [tgt[0] + nx, tgt[1] + dir[1] + pit * 1.6, tgt[2] + nz];
    }

    // 部屋の中に収める
    pos[0] = MathX.clamp(pos[0], -ROOM.w / 2 + 0.28, ROOM.w / 2 - 0.28);
    pos[1] = MathX.clamp(pos[1], 0.45, ROOM.h - 0.22);
    pos[2] = MathX.clamp(pos[2], ROOM.wallZ + 0.45, ROOM.zBack - 0.30);

    // わずかな呼吸 (手持ちカメラ感)
    const br = Math.sin(this.time * 0.55) * 0.008;
    pos[1] += br;

    const lam = this.stageTime < 0.1 ? 30 : 2.6;
    MathX.dampV3(this.camPos, this.camPos, pos, lam, dt);
    MathX.dampV3(this.camTarget, this.camTarget, tgt, lam, dt);
    V3.copy(this.cam.pos, this.camPos);
    V3.copy(this.cam.target, this.camTarget);
    this.cam.fov = MathX.damp(this.cam.fov, this.targetFov, 3, dt);
  }

  // --- 再プレイ -----------------------------------------------------------
  // いきなり暗転させず、まず雨戸を閉じてから作り直しに戻る
  replay() {
    if (this.replayPending) return;
    this.replayPending = true;
    this.ui.showViewButtons(false);
    this.ui.setStage('');
    this.sound.chime(3, 0.8);
  }

  updateReplay(dt) {
    if (!this.replayPending) return;
    this.shutterOpen = Math.max(0, this.shutterOpen - dt * 0.75);
    this.sound.shutter(this.shutterOpen > 0.001 ? 0.5 : 0);
    if (this.shutterOpen <= 0.001) {
      this.replayPending = false;
      this.sound.knock();
      this.resetForNewPanel();
    }
  }

  resetForNewPanel() {
    this.motif = null;
    this.panelInstalled = false;
    this.revealed = false;
    this.polishDone = false;
    this.installProgress = 0;
    this.shutterOpen = 0;
    this.env.sunAmount = 0;
    this.backlight = 0;
    this.dirtAmt = 0;
    for (const c of this.cards) c.chosen = false;
    if (this.panelCells) {
      for (const c of this.panelCells) { c.glassMesh.dispose(); c.cameMesh.dispose(); c.scoreMesh.dispose(); }
      this.panelCells = null;
    }
    this.setPanelModel(BENCH_PANEL.pos, BENCH_PANEL.rot);
    this.setStage('motif');
  }

  nextPalette() {
    this.paletteIndex = (this.paletteIndex + 1) % PALETTES.length;
    this.ui.setPalette(this.currentPalette(), (i) => this.selectColor(i));
    if (this.panelCells) {
      for (const c of this.panelCells) {
        if (c.colorIndex !== undefined) c.color = this.colorOf(c.colorIndex);
        c.pop = 1;
      }
    }
    const pal = this.currentPalette();
    for (const card of this.cards) {
      for (const p of card.parts) p.color = MathX.toLinear(MathX.hexToRgb(pal[p.hint % pal.length]));
    }
    this.sound.chime(4, 0.8);
  }

  nextTime() {
    this.setTime(this.timeIndex + 1, false);
    this.sound.chime(2, 0.8);
  }
}
