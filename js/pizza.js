/* ------------------------------------------------------------------
   pizza.js — ピザの実ジオメトリ
   ・生地は 72 分割の可変半径メッシュ。押すと伸び、回すとまるくなる
   ・ふち（コルニチョーネ）は焼成に応じて実際に盛り上がる
   ・具材は板ではなく立体（インスタンス描画）。チーズは溶けて平たくなる
   ・生地表面（粉・ソース・焼き色・焦げ斑）はキャンバスから焼き込むテクスチャ
   モデル内部の単位は 1/0.00075 m（既存の手ざわりを保つため）。
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const T = PZ.tex;
  const G = PZ.geo;
  const TAU = U.TAU;

  const N = 72;                 // 輪郭の分割数
  const MAXR = 200;             // モデル単位での最大半径
  const MS = 0.00075;           // モデル単位 → メートル（200 → 0.15m）
  const RINGS = [0, 0.30, 0.55, 0.72, 0.845, 0.915, 0.962, 1.0];

  const COL = {
    doughPale: [238, 220, 186], doughMid: [226, 200, 158],
    bakedLight: [222, 178, 116], bakedMid: [190, 132, 66], bakedDeep: [146, 86, 36],
    char: [52, 32, 20],
    sauce: [176, 42, 28], sauceDeep: [132, 26, 20]
  };

  const TOP_COL = {
    cheese: 0xfaf3e2, tomato: 0xcf3a2b, basil: 0x4f9a44, corn: 0xf2c33c,
    pepperR: 0xd8483a, pepperY: 0xefb73a, pepperG: 0x5aa653,
    olive: 0x3f3d32, broccoli: 0x5c9a52, mushroom: 0xd9c3a0
  };
  const TOP_R = {
    cheese: 20, basil: 26, corn: 12, tomato: 25, pepperR: 24, pepperY: 24,
    pepperG: 24, olive: 14, broccoli: 24, mushroom: 22
  };
  PZ.TOP_R = TOP_R;

  function Pizza() {
    this.SS = 2;
    const px = 512;
    this.oc = T.cv(px); this.octx = this.oc.getContext('2d');
    this.sc = T.cv(px); this.sctx = this.sc.getContext('2d');
    this.texScale = px / (MAXR * 2.16);   // モデル単位 → テクスチャ px

    this.tex = new THREE.CanvasTexture(this.oc);
    this.tex.encoding = THREE.sRGBEncoding;
    this.tex.anisotropy = 8;

    this.group = new THREE.Group();
    this.doughGroup = new THREE.Group();
    this.group.add(this.doughGroup);

    this.mat = new THREE.MeshStandardMaterial({
      map: this.tex, roughness: 0.82, metalness: 0.0,
      envMapIntensity: 0.55
    });
    this.matSide = new THREE.MeshStandardMaterial({
      color: 0xd8bb8e, roughness: 0.9, envMapIntensity: 0.35
    });

    this.topMats = {};
    this.topMeshes = {};
    this.reset();
  }
  PZ.Pizza = Pizza;
  Pizza.MS = MS;
  Pizza.MAXR = MAXR;

  /* ================================================================
     状態
  ================================================================ */
  Pizza.prototype.reset = function () {
    this.rad = new Float32Array(N);
    this.r0 = 46;
    for (let i = 0; i < N; i++) this.rad[i] = this.r0 * (0.95 + Math.random() * 0.1);
    this.rot = 0; this.spin = 0;
    this.thick = 26;
    this.rimPuff = 0;
    this.bake = 0;
    this.flourAmt = 1;
    this.toppings = [];
    this.charSpots = [];
    this.blisters = [];
    this.cuts = [];
    this.sauceCover = 0;
    this.sauceCells = null; this.sauceCellsN = 0;
    this.sctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sctx.clearRect(0, 0, this.sc.width, this.sc.height);
    this.dirty = true;         // 形
    this.texDirty = true;      // 表面
    this.topDirty = true;      // 具材
    this.sliceCount = 1;
    this.buildDough();
    this.clearToppingMeshes();
  };

  Pizza.prototype.meanR = function () {
    let s = 0; for (let i = 0; i < N; i++) s += this.rad[i];
    return s / N;
  };
  Pizza.prototype.maxRad = function () {
    let m = 0; for (let i = 0; i < N; i++) if (this.rad[i] > m) m = this.rad[i];
    return m;
  };
  Pizza.prototype.radAt = function (ang) {
    let a = ang % TAU; if (a < 0) a += TAU;
    const f = (a / TAU) * N, i = Math.floor(f), t = f - i;
    return U.lerp(this.rad[i % N], this.rad[(i + 1) % N], t);
  };
  Pizza.prototype.innerR = function () { return Math.max(10, this.meanR() - this.rimW()); };
  Pizza.prototype.rimW = function () {
    return (11 + this.meanR() * 0.075) * (1 + this.rimPuff * 1.05);
  };

  /* --- 押し広げ・回転（手ざわりは 2D 版から引き継ぎ） --- */
  Pizza.prototype.press = function (mx, my, speed, dt) {
    const d = Math.hypot(mx, my);
    const ang = Math.atan2(my, mx);
    const local = this.radAt(ang);
    const nearEdge = U.sat(d / Math.max(1, local));
    const force = (0.35 + speed * 0.0016) * (0.4 + nearEdge * 1.1);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const dd = Math.abs(U.angDiff(a, ang));
      const w = Math.exp(-(dd * dd) / (2 * 0.62 * 0.62));
      if (w < 0.02) continue;
      const room = U.sat((MAXR - this.rad[i]) / 60);
      this.rad[i] += force * w * 62 * dt * room;
    }
    this.thick = U.clamp(26 * Math.pow(this.r0 / Math.max(this.r0, this.meanR()) * 3.4, 0.55), 8, 26);
    this.dirty = true;
  };

  Pizza.prototype.applySpin = function (dt) {
    const w = Math.abs(this.spin);
    this.rot += this.spin * dt;
    if (w > 0.2) {
      const grow = Math.min(w, 7) * 1.5 * dt;
      for (let i = 0; i < N; i++) {
        this.rad[i] += grow * U.sat((MAXR - this.rad[i]) / 70);
      }
      this.dirty = true;
    }
    const relax = 1.4 + Math.min(w, 8) * 1.5;
    const m = this.meanR();
    for (let i = 0; i < N; i++) {
      const nb = (this.rad[(i - 1 + N) % N] + this.rad[(i + 1) % N]) * 0.5;
      this.rad[i] = U.approach(this.rad[i], U.lerp(nb, m, 0.42), relax, dt);
    }
    this.spin *= Math.exp(-1.05 * dt);
    if (Math.abs(this.spin) < 0.02) this.spin = 0;
  };

  Pizza.prototype.relax = function (dt, rate) {
    const m = this.meanR();
    for (let i = 0; i < N; i++) {
      const nb = (this.rad[(i - 1 + N) % N] + this.rad[(i + 1) % N]) * 0.5;
      this.rad[i] = U.approach(this.rad[i], U.lerp(nb, m, 0.3), rate || 1.2, dt);
    }
    this.dirty = true;
  };

  Pizza.prototype.tossGrow = function (power) {
    const add = 6 + power * 16;
    for (let i = 0; i < N; i++) this.rad[i] += add * U.sat((MAXR - this.rad[i]) / 60);
    const m = this.meanR();
    for (let i = 0; i < N; i++) this.rad[i] = U.lerp(this.rad[i], m, 0.35 + power * 0.3);
    this.thick = U.clamp(this.thick * 0.94, 8, 26);
    this.dirty = true;
  };

  /* --- ソース --- */
  Pizza.prototype.paintSauce = function (mx, my, radius) {
    const lim = this.innerR() * 1.02;
    const d = Math.hypot(mx, my);
    if (d > lim) { const k = lim / d; mx *= k; my *= k; }
    const s = this.sctx, k = this.texScale, C = this.sc.width / 2;
    const px = C + mx * k, py = C + my * k, pr = radius * k;
    const g = s.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, U.css(COL.sauce, 0.96));
    g.addColorStop(0.62, U.css(COL.sauce, 0.86));
    g.addColorStop(1, U.css(COL.sauce, 0));
    s.fillStyle = g;
    s.beginPath(); s.arc(px, py, pr, 0, TAU); s.fill();
    if (U.chance(0.55)) {
      const g2 = s.createRadialGradient(px, py, 0, px, py, pr * 0.6);
      g2.addColorStop(0, U.css(COL.sauceDeep, 0.4));
      g2.addColorStop(1, U.css(COL.sauceDeep, 0));
      s.fillStyle = g2;
      s.beginPath(); s.arc(px + U.rand(-6, 6), py + U.rand(-6, 6), pr * 0.6, 0, TAU); s.fill();
    }

    if (!this.sauceCells) {
      this.grid = 18;
      this.sauceCells = new Uint8Array(this.grid * this.grid);
      this.sauceCellsN = 0; this.gridTotal = 0;
      for (let gy = 0; gy < this.grid; gy++) for (let gx = 0; gx < this.grid; gx++) {
        const cx = (gx + 0.5) / this.grid * 2 - 1, cy = (gy + 0.5) / this.grid * 2 - 1;
        if (cx * cx + cy * cy <= 1) this.gridTotal++;
      }
    }
    const R = this.innerR();
    for (let gy = 0; gy < this.grid; gy++) for (let gx = 0; gx < this.grid; gx++) {
      const cx = ((gx + 0.5) / this.grid * 2 - 1) * R;
      const cy = ((gy + 0.5) / this.grid * 2 - 1) * R;
      if (cx * cx + cy * cy > R * R) continue;
      if (Math.hypot(cx - mx, cy - my) <= radius * 0.8) {
        const idx = gy * this.grid + gx;
        if (!this.sauceCells[idx]) { this.sauceCells[idx] = 1; this.sauceCellsN++; }
      }
    }
    this.sauceCover = this.gridTotal ? this.sauceCellsN / this.gridTotal : 0;
    this.flourAmt *= 0.985;
    this.texDirty = true;
  };

  /* --- 具材 --- */
  Pizza.prototype.addTopping = function (type, mx, my) {
    const lim = this.innerR() * (type === 'cheese' ? 1.0 : 0.93);
    const d = Math.hypot(mx, my);
    if (d > lim) { const k = lim / Math.max(1, d); mx *= k; my *= k; }
    const t = {
      type: type, x: mx, y: my,
      r: (TOP_R[type] || 20) * U.rand(0.85, 1.14),
      rot: U.rand(0, TAU), tilt: U.rand(-0.25, 0.25),
      melt: 0, drop: 1, seed: Math.random()
    };
    this.toppings.push(t);
    if (this.toppings.length > 120) this.toppings.shift();
    this.topDirty = true;
    return t;
  };
  Pizza.prototype.countType = function (type) {
    let n = 0;
    for (let i = 0; i < this.toppings.length; i++) if (this.toppings[i].type === type) n++;
    return n;
  };
  Pizza.prototype.updateToppings = function (dt) {
    let any = false;
    for (let i = 0; i < this.toppings.length; i++) {
      const t = this.toppings[i];
      if (t.drop > 0) { t.drop = Math.max(0, t.drop - dt * 3.6); any = true; }
    }
    if (any) this.topDirty = true;
  };

  /* --- 焼成 --- */
  Pizza.prototype.startBake = function () {
    this.charSpots.length = 0;
    for (let i = 0; i < 30; i++) {
      this.charSpots.push({ a: U.rand(0, TAU), rr: U.rand(0.895, 0.995), size: U.rand(6, 16), dose: 0, onRim: true });
    }
    for (let i = 0; i < 16; i++) {
      this.charSpots.push({ a: U.rand(0, TAU), rr: U.rand(0.2, 0.82), size: U.rand(4, 10), dose: 0, onRim: false });
    }
    this.blisters.length = 0;
    for (let i = 0; i < 26; i++) {
      this.blisters.push({ a: U.rand(0, TAU), rr: U.rand(0.88, 0.99), s: U.rand(0.5, 1.3) });
    }
    this.dirty = true;
  };

  Pizza.prototype.bakeStep = function (dt, heat, flameAngleWorld) {
    this.bake = U.sat(this.bake + dt * 0.052 * heat);
    const np = U.sat(this.bake * 2.4);
    if (Math.abs(np - this.rimPuff) > 0.002) this.dirty = true;
    this.rimPuff = U.approach(this.rimPuff, np, 0.9, dt);
    const flameModel = flameAngleWorld - this.rot;
    for (let i = 0; i < this.charSpots.length; i++) {
      const s = this.charSpots[i];
      const face = Math.max(0, Math.cos(s.a - flameModel));
      s.dose = U.sat(s.dose + dt * heat * 0.115 * (0.35 + 0.65 * Math.pow(face, 1.4)) * (s.onRim ? 1.25 : 0.8));
    }
    for (let i = 0; i < this.toppings.length; i++) {
      const t = this.toppings[i];
      t.melt = U.sat(t.melt + dt * (t.type === 'cheese' ? 0.30 : 0.12) * heat);
    }
    this.texDirty = true;
    this.topDirty = true;
  };

  Pizza.prototype.charImbalance = function () {
    let sx = 0, sy = 0, tot = 0;
    for (let i = 0; i < this.charSpots.length; i++) {
      const s = this.charSpots[i];
      sx += Math.cos(s.a) * s.dose; sy += Math.sin(s.a) * s.dose; tot += s.dose;
    }
    return tot < 0.001 ? 0 : Math.hypot(sx, sy) / tot;
  };

  /* ================================================================
     生地の断面（u: 0=中心, 1=ふち）→ 高さ（モデル単位）
  ================================================================ */
  Pizza.prototype.profile = function (u, meanR) {
    const ball = U.smooth(U.inv(96, 52, meanR));      // 生地玉のときは丸く
    const base = Math.max(5.2, this.thick * 0.42);
    // 平たい生地：中央は薄く、ふちがぷくっと立ち上がる
    let disc;
    if (u < 0.80) disc = base * (1 + 0.10 * (1 - u));
    else {
      const k = U.smooth((u - 0.80) / 0.16);
      const fall = u > 0.96 ? U.smooth((u - 0.96) / 0.04) : 0;
      const rim = base + (18 + this.rimPuff * 30) * k;
      disc = U.lerp(rim, base * 0.85, fall);
    }
    const dome = Math.sqrt(Math.max(0, 1 - u * u)) * meanR * 0.86 + base * 0.5;
    return U.lerp(disc, dome, ball);
  };

  /* ================================================================
     生地メッシュの生成／更新
  ================================================================ */
  Pizza.prototype.buildDough = function () {
    // 既存を破棄
    while (this.doughGroup.children.length) {
      const c = this.doughGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      this.doughGroup.remove(c);
    }
    this.slices = [];
    const sc = this.sliceCount;
    const per = N / sc;
    for (let s = 0; s < sc; s++) {
      const i0 = Math.round(s * per), i1 = Math.round((s + 1) * per);
      const geo = this.makeSectorGeometry(i0, i1, sc > 1);
      const mesh = new THREE.Mesh(geo, [this.mat, this.matSide]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.doughGroup.add(mesh);
      this.slices.push(mesh);
    }
    this.dirty = true;
    this.updateDough();
  };

  /* 扇形（i0..i1）の頂点を張る。閉じた円のときは i1 で一周する */
  Pizza.prototype.makeSectorGeometry = function (i0, i1, closed) {
    const cols = i1 - i0 + 1;
    const rows = RINGS.length;
    const topCount = cols * rows;
    const posT = new Float32Array(topCount * 3);
    const uvT = new Float32Array(topCount * 2);
    const idxTop = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idxTop.push(a, b, d, b, e, d);      // 上面は +Y を向く
      }
    }
    // 底面（同じ列で y=0）
    const posB = new Float32Array(topCount * 3);
    const idxBot = [];
    const off = topCount;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = off + r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idxBot.push(a, d, b, b, d, e);      // 底面は -Y を向く
      }
    }
    // 側面（外周のリング）
    const sideCount = cols * 2;
    const idxSide = [];
    const off2 = topCount * 2;
    for (let c = 0; c < cols - 1; c++) {
      const a = off2 + c, b = off2 + c + 1, d = off2 + cols + c, e = off2 + cols + c + 1;
      idxSide.push(a, b, d, b, e, d);
    }
    // 切り口（扇形のとき）
    const idxCut = [];
    let cutOff = off2 + sideCount;
    let cutCount = 0;
    if (!closed) { cutCount = 0; }
    else {
      cutCount = rows * 2 * 2;
      for (let side = 0; side < 2; side++) {
        const base = cutOff + side * rows * 2;
        for (let r = 0; r < rows - 1; r++) {
          const a = base + r * 2, b = a + 1, d = a + 2, e = a + 3;
          if (side === 0) idxCut.push(a, b, d, b, e, d);
          else idxCut.push(a, d, b, b, d, e);
        }
      }
    }

    const total = topCount * 2 + sideCount + cutCount;
    const pos = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idxTop.concat(idxBot, idxSide, idxCut));
    geo.addGroup(0, idxTop.length, 0);
    geo.addGroup(idxTop.length, idxBot.length + idxSide.length + idxCut.length, 1);
    geo.userData = { i0: i0, i1: i1, cols: cols, rows: rows, topCount: topCount, sideOff: topCount * 2, cutOff: cutOff, hasCut: cutCount > 0 };
    return geo;
  };

  Pizza.prototype.updateDough = function () {
    if (!this.dirty) return;
    this.dirty = false;
    const m = this.meanR();
    const texR = MAXR * 1.08;
    for (let s = 0; s < this.slices.length; s++) {
      const geo = this.slices[s].geometry;
      const d = geo.userData;
      const pos = geo.attributes.position.array;
      const uv = geo.attributes.uv.array;
      const cols = d.cols, rows = d.rows;
      let p = 0, q = 0;
      // 上面
      for (let r = 0; r < rows; r++) {
        const u = RINGS[r];
        for (let c = 0; c < cols; c++) {
          const i = (d.i0 + c) % N;
          const a = ((d.i0 + c) / N) * TAU;
          const rr = this.rad[i] * u;
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          const y = this.profile(u, m);
          pos[p++] = x * MS; pos[p++] = y * MS; pos[p++] = z * MS;
          uv[q++] = 0.5 + x / (texR * 2);
          uv[q++] = 0.5 - z / (texR * 2);
        }
      }
      // 底面
      for (let r = 0; r < rows; r++) {
        const u = RINGS[r];
        for (let c = 0; c < cols; c++) {
          const i = (d.i0 + c) % N;
          const a = ((d.i0 + c) / N) * TAU;
          const rr = this.rad[i] * u;
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          pos[p++] = x * MS; pos[p++] = 0; pos[p++] = z * MS;
          uv[q++] = 0.5 + x / (texR * 2);
          uv[q++] = 0.5 - z / (texR * 2);
        }
      }
      // 側面（外周）
      for (let k = 0; k < 2; k++) {
        for (let c = 0; c < cols; c++) {
          const i = (d.i0 + c) % N;
          const a = ((d.i0 + c) / N) * TAU;
          const rr = this.rad[i];
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          const y = k === 0 ? this.profile(1, m) : 0;
          pos[p++] = x * MS; pos[p++] = y * MS; pos[p++] = z * MS;
          uv[q++] = 0.5 + x / (texR * 2);
          uv[q++] = 0.5 - z / (texR * 2);
        }
      }
      // 切り口
      if (d.hasCut) {
        for (let side = 0; side < 2; side++) {
          const ci = side === 0 ? d.i0 : d.i1;
          const i = ((ci % N) + N) % N;
          const a = (ci / N) * TAU;
          for (let r = 0; r < rows; r++) {
            const u = RINGS[r];
            const rr = this.rad[i] * u;
            const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
            pos[p++] = x * MS; pos[p++] = this.profile(u, m) * MS; pos[p++] = z * MS;
            uv[q++] = 0.5 + x / (texR * 2); uv[q++] = 0.5 - z / (texR * 2);
            pos[p++] = x * MS; pos[p++] = 0; pos[p++] = z * MS;
            uv[q++] = 0.5 + x / (texR * 2); uv[q++] = 0.5 - z / (texR * 2);
          }
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }
  };

  /* ================================================================
     表面テクスチャ（粉・ソース・焼き色・焦げ）
  ================================================================ */
  Pizza.prototype.updateTexture = function () {
    if (!this.texDirty) return;
    this.texDirty = false;
    const ctx = this.octx, S = this.oc.width, C = S / 2;
    const k = this.texScale;
    const bake = this.bake;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.translate(C, C);

    const m = this.meanR();
    const R = m * k;

    // 生地の地色
    const baseCol = U.mixColor(
      U.mixColor(COL.doughPale, COL.bakedLight, U.sat(bake * 1.65)),
      COL.bakedMid, U.sat((bake - 0.45) * 1.7));
    const g = ctx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R * 1.15);
    g.addColorStop(0, U.css(U.mixColor(baseCol, [255, 255, 255], 0.08)));
    g.addColorStop(0.72, U.css(baseCol));
    g.addColorStop(1, U.css(U.mixColor(baseCol, COL.bakedDeep, 0.32)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, C, 0, TAU); ctx.fill();

    // 粉
    if (this.flourAmt > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.34 * this.flourAmt;
      for (let i = 0; i < 34; i++) {
        const a = i * 2.399, rr = Math.sqrt((i + 0.5) / 34) * R;
        softBlob(ctx, Math.cos(a) * rr, Math.sin(a) * rr, R * (0.05 + (i % 5) * 0.03), [255, 255, 255], 0.55);
      }
      ctx.restore();
    }

    // ソース（内側だけ）
    if (this.sauceCellsN > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, this.innerR() * k, 0, TAU);
      ctx.clip();
      ctx.drawImage(this.sc, -C, -C);
      if (bake > 0.05) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = U.sat(bake * 0.5);
        ctx.fillStyle = 'rgb(206,146,116)';
        ctx.fillRect(-C, -C, S, S);
      }
      ctx.restore();
    }

    // 焦げ斑（レオパード）
    for (let i = 0; i < this.charSpots.length; i++) {
      const s = this.charSpots[i];
      if (s.dose < 0.02) continue;
      const rr = this.radAt(s.a) * s.rr * k;
      const x = Math.cos(s.a) * rr, y = Math.sin(s.a) * rr;
      const kk = U.smooth(s.dose);
      const col = U.mixColor(COL.bakedDeep, COL.char, U.sat((s.dose - 0.38) * 1.9));
      softBlob(ctx, x, y, s.size * k * (0.7 + kk * 1.0), col, 0.18 + kk * 0.62);
    }

    // ふちの気泡（明るいハイライト）
    if (this.rimPuff > 0.06) {
      for (let i = 0; i < this.blisters.length; i++) {
        const b = this.blisters[i];
        const rr = this.radAt(b.a) * b.rr * k;
        const x = Math.cos(b.a) * rr, y = Math.sin(b.a) * rr;
        const s = b.s * 9 * k * this.rimPuff;
        softBlob(ctx, x - s * 0.2, y - s * 0.2, s * 1.6, [255, 244, 218], 0.42 * this.rimPuff);
      }
    }

    ctx.restore();
    this.tex.needsUpdate = true;
    this.mat.roughness = U.lerp(0.85, 0.62, U.sat(this.sauceCover));
  };

  function softBlob(ctx, x, y, r, col, alpha) {
    if (r <= 0.3) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.css(col, alpha));
    g.addColorStop(0.55, U.css(col, alpha * 0.55));
    g.addColorStop(1, U.css(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  /* ================================================================
     具材（インスタンス描画）
  ================================================================ */
  Pizza.prototype.clearToppingMeshes = function () {
    for (const k in this.topMeshes) {
      const im = this.topMeshes[k];
      this.group.remove(im);
      im.geometry.dispose();
    }
    this.topMeshes = {};
    this.topDirty = true;
  };

  Pizza.prototype.topMaterial = function (type) {
    if (this.topMats[type]) return this.topMats[type];
    let m;
    if (type === 'cheese') {
      m = new THREE.MeshStandardMaterial({ color: TOP_COL.cheese, roughness: 0.55, envMapIntensity: 0.8 });
    } else if (type === 'basil') {
      m = new THREE.MeshStandardMaterial({ color: TOP_COL.basil, roughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.7 });
    } else {
      m = new THREE.MeshStandardMaterial({ color: TOP_COL[type] || 0xcccccc, roughness: 0.42, envMapIntensity: 0.8 });
    }
    this.topMats[type] = m;
    return m;
  };

  const _mtx = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _qt = new THREE.Quaternion();
  const _scl = new THREE.Vector3();
  const _eul = new THREE.Euler();

  Pizza.prototype.updateToppingMeshes = function () {
    if (!this.topDirty) return;
    this.topDirty = false;
    const byType = {};
    for (let i = 0; i < this.toppings.length; i++) {
      const t = this.toppings[i];
      (byType[t.type] = byType[t.type] || []).push(t);
    }
    // 不要になったものを消す
    for (const k in this.topMeshes) {
      if (!byType[k]) { this.group.remove(this.topMeshes[k]); delete this.topMeshes[k]; }
    }
    const m = this.meanR();
    for (const type in byType) {
      const list = byType[type];
      let im = this.topMeshes[type];
      if (!im || im.count < list.length) {
        if (im) this.group.remove(im);
        im = new THREE.InstancedMesh(G.topping(type), this.topMaterial(type), Math.max(8, list.length + 8));
        im.castShadow = true;
        im.receiveShadow = true;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(im);
        this.topMeshes[type] = im;
      }
      const melt = list.length ? list[0].melt : 0;
      for (let i = 0; i < im.count; i++) {
        const t = list[i];
        if (!t) { _mtx.makeScale(0, 0, 0); im.setMatrixAt(i, _mtx); continue; }
        const u = Math.hypot(t.x, t.y) / Math.max(1, this.radAt(Math.atan2(t.y, t.x)));
        const surf = this.profile(Math.min(0.92, u), m);
        const drop = t.drop * t.drop * 60;
        let sx = t.r * 2 * MS, sy = sx, sz = sx;
        if (type === 'cheese') {
          const k = t.melt;
          sx *= 1 + k * 0.85; sz *= 1 + k * 0.85;
          sy *= (1 - k * 0.62) * 0.62;
        } else if (type === 'basil') {
          sy *= 0.5;
          sx *= 1 - t.melt * 0.12; sz *= 1 - t.melt * 0.12;
        } else {
          sy *= 0.9 - t.melt * 0.25;
        }
        sx *= (1 + t.drop * 0.35); sz *= (1 + t.drop * 0.35);
        _pos.set(t.x * MS, (surf + drop) * MS + sy * 0.42, t.y * MS);
        _eul.set(t.tilt * (1 - t.melt), t.rot, t.tilt * 0.6 * (1 - t.melt));
        _qt.setFromEuler(_eul);
        _scl.set(sx, sy, sz);
        _mtx.compose(_pos, _qt, _scl);
        im.setMatrixAt(i, _mtx);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.computeBoundingSphere) im.computeBoundingSphere();
      im.frustumCulled = false;
      // 溶けたチーズはつやが出て、焼けると色づく
      if (type === 'cheese') {
        const mat = this.topMats.cheese;
        mat.roughness = U.lerp(0.62, 0.18, melt);
        mat.color.setHex(0xfaf3e2).lerp(new THREE.Color(0xe8bf6e), U.sat(this.bake * 1.1) * melt);
      }
    }
  };

  /* ================================================================
     毎フレーム
  ================================================================ */
  Pizza.prototype.sync = function () {
    this.updateDough();
    this.updateTexture();
    this.updateToppingMeshes();
    this.doughGroup.rotation.y = 0;      // 回転はグループ側で
    this.group.rotation.y = -this.rot;
  };

  /* スライスを開く／持ち上げる */
  Pizza.prototype.setCuts = function (n) {
    if (this.sliceCount === n) return;
    this.sliceCount = n;
    this.buildDough();
  };

  Pizza.prototype.layoutSlices = function (spread, lift) {
    const sc = this.sliceCount;
    if (sc <= 1) return;
    for (let s = 0; s < sc; s++) {
      const mid = ((s + 0.5) / sc) * TAU;
      const mesh = this.slices[s];
      let ox = Math.cos(mid) * spread, oz = Math.sin(mid) * spread, oy = 0;
      let rx = 0;
      if (lift && lift.index === s) {
        ox = Math.cos(mid) * lift.out; oz = Math.sin(mid) * lift.out;
        oy = lift.up;
        rx = lift.tilt;
      }
      mesh.position.set(ox, oy, oz);
      mesh.rotation.set(Math.cos(mid) * -rx, 0, Math.sin(mid) * rx);
    }
  };

  /* チーズの糸（実ジオメトリ） */
  Pizza.prototype.makeStrands = function (from, to, amount) {
    if (amount <= 0.02) return null;
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf6e7bc, roughness: 0.20, transparent: true,
      opacity: 0.95, envMapIntensity: 0.8
    });
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5) * 0.011;
      const a = new THREE.Vector3(from.x + o, from.y, from.z + o * 0.6);
      const b = new THREE.Vector3(to.x + o * 0.8, to.y, to.z + o * 0.5);
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= 0.035 + i * 0.009;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const g = new THREE.TubeGeometry(curve, 14, 0.0035 * (1 - amount * 0.45) + 0.0012, 6, false);
      grp.add(new THREE.Mesh(g, mat));
    }
    grp.userData.dispose = function () {
      grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    };
    return grp;
  };

})();
