/* ------------------------------------------------------------------
   stages.js — あそびの流れ（3D 空間版）
   まるめる → のばす → まわす → とばす → ソース → ぐざい →
   ピールへ → 窯の奥へスッ → やける → くるっ → 手前へスッ → カット
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const T = PZ.tex;
  const G = PZ.geo;
  const S = PZ.snd;
  const L = PZ.LAY;
  const TAU = U.TAU;
  const MS = 0.00075;                 // モデル単位 → m
  const AUTO = 15;

  const RECIPES = (PZ.RECIPES = [
    { id: 'margherita', items: ['cheese', 'tomato', 'basil'], need: 7 },
    { id: 'corn', items: ['cheese', 'corn'], need: 9 },
    { id: 'veggie', items: ['cheese', 'pepperR', 'pepperY', 'pepperG', 'broccoli', 'corn'], need: 9 },
    { id: 'free', rainbow: true, items: ['cheese', 'tomato', 'corn', 'pepperR', 'pepperG', 'basil', 'olive', 'mushroom'], need: 5 }
  ]);

  const BOWL_COL = {
    cheese: 0xf6ead0, tomato: 0xf0c0b4, basil: 0xc8e0bc, corn: 0xf8e6b0,
    pepperR: 0xf3c4bb, pepperY: 0xf8e4b0, pepperG: 0xc0e0b6,
    olive: 0xd6d2c0, broccoli: 0xc0e0b6, mushroom: 0xe8dcc6
  };

  const boardTop = () => L.counterY + 0.029;
  const St = (PZ.stages = {});

  /* 板の上のワールド点 → ピザのモデル座標 */
  function toModel(g, wp, center) {
    return {
      x: (wp.x - center.x) / MS,
      y: (wp.z - center.z) / MS
    };
  }
  function pickBoard(g, center, h) {
    const wp = g.rayToPlane(g.input.sx, g.input.sy, h === undefined ? boardTop() : h);
    return toModel(g, wp, center);
  }
  function sparkle(g, p, n) {
    g.pSpark.burst(p.x, p.y + 0.02, p.z, n || 16, 0.05, 0.5, 0.7, 0.016);
    S.sparkle(4);
  }

  /* ================================================================
     えらぶ（実物のミニピザを並べる）
  ================================================================ */
  function miniPizzaTex(recipe) {
    const S2 = 256, c = T.cv(S2), x = c.getContext('2d');
    const R = S2 * 0.46;
    x.translate(S2 / 2, S2 / 2);
    const g = x.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#f0d5a4'); g.addColorStop(0.75, '#dcb87e'); g.addColorStop(1, '#bd8f52');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
    x.fillStyle = '#b3301f'; x.beginPath(); x.arc(0, 0, R * 0.80, 0, TAU); x.fill();
    if (recipe.rainbow) {
      const cols = ['#e4739b', '#e5943c', '#e3c246', '#63a95a', '#4f97c4', '#8e77b8'];
      for (let i = 0; i < 6; i++) {
        x.fillStyle = cols[i];
        x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R * 0.80, (i / 6) * TAU, ((i + 1) / 6) * TAU); x.closePath(); x.fill();
      }
    }
    const colOf = { cheese: '#fbf3df', tomato: '#cf3a2b', basil: '#4f9a44', corn: '#f2c33c', pepperR: '#d8483a', pepperY: '#efb73a', pepperG: '#5aa653', olive: '#3f3d32', broccoli: '#5c9a52', mushroom: '#d9c3a0' };
    let k = 0;
    for (let ring = 0; ring < 2; ring++) {
      const cnt = ring === 0 ? 3 : 7;
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU + ring * 0.5;
        const rr = ring === 0 ? R * 0.26 : R * 0.55;
        const type = recipe.items[k % recipe.items.length]; k++;
        x.fillStyle = colOf[type] || '#eee';
        x.beginPath();
        x.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.11, R * (type === 'cheese' ? 0.07 : 0.11), a, 0, TAU);
        x.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  St.CHOOSE = {
    cam: 'choose',
    enter(g) {
      g.pizza.reset();
      g.pz.visible = false;
      this.t = 0;
      if (!this.group) {
        this.group = new THREE.Group();
        g.scene.add(this.group);
        this.cards = [];
        const M = PZ.scene3.mats;
        for (let i = 0; i < RECIPES.length; i++) {
          const grp = new THREE.Group();
          const plate = new THREE.Mesh(G.plate(0.115, 0.016), M.porcelain);
          plate.castShadow = plate.receiveShadow = true;
          grp.add(plate);
          const pz = new THREE.Mesh(
            new THREE.CylinderGeometry(0.088, 0.082, 0.016, 40),
            new THREE.MeshStandardMaterial({ map: miniPizzaTex(RECIPES[i]), roughness: 0.7 })
          );
          pz.position.y = 0.020;
          pz.castShadow = true;
          grp.add(pz);
          grp.userData.recipe = RECIPES[i];
          grp.userData.pick = plate;
          this.group.add(grp);
          this.cards.push(grp);
        }
      }
      this.group.visible = true;
      // 板が皿を飲み込んでしまうので、えらぶあいだは片づける
      PZ.scene3.board.visible = false;
      PZ.scene3.flourDecal.visible = false;
      const n = this.cards.length;
      if (g.land) {
        for (let i = 0; i < n; i++) {
          this.cards[i].position.set(-0.34 + (i - (n - 1) / 2) * 0.335, L.counterY, L.counterZ - 0.02);
        }
      } else {
        // たて画面：カメラが近づけるように 2 列 2 段に並べる（的も大きくなる）
        for (let i = 0; i < n; i++) {
          const col = i % 2, row = (i / 2) | 0;
          this.cards[i].position.set(-0.34 + (col - 0.5) * 0.34, L.counterY, L.counterZ - 0.17 + row * 0.30);
        }
      }
    },
    exit(g) {
      if (this.group) this.group.visible = false;
      PZ.scene3.board.visible = true;
      PZ.scene3.flourDecal.visible = true;
    },
    update(g, dt) {
      this.t += dt;
      g.pz.visible = false;
      for (let i = 0; i < this.cards.length; i++) {
        const c = this.cards[i];
        const k = U.sat((this.t - i * 0.1) * 2.2);
        c.scale.setScalar(U.easeOutBack(k));
        c.rotation.y = this.t * 0.4 + i;
        c.position.y = L.counterY + Math.sin(this.t * 1.8 + i) * 0.004;
      }
    },
    guide(g, al) {
      const i = Math.floor(g.t / 1.6) % this.cards.length;
      const c = this.cards[i];
      g.showPulse(c.position.x, L.counterY + 0.02, c.position.z, 0.16, al);
      g.showHand(c.position.x + 0.05, L.counterY + 0.10, c.position.z + 0.07, al, 1.1);
    },
    up(g) {
      const r = g.rayAt(g.input.sx, g.input.sy);
      const hits = r.intersectObjects(this.cards, true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && !o.userData.recipe) o = o.parent;
        if (o) {
          g.recipe = o.userData.recipe;
          S.tap(1.1);
          g.setStage('DOUGH');
        }
      }
    }
  };

  /* ================================================================
     生地玉を置く
  ================================================================ */
  St.DOUGH = {
    cam: 'bench',
    enter(g) {
      g.pizza.reset();
      this.fly = null; this.placed = false;
      if (!this.bowl) {
        this.bowl = new THREE.Mesh(G.bowl(0.115, 0.075, 0.075), PZ.scene3.mats.porcelain);
        this.bowl.castShadow = this.bowl.receiveShadow = true;
        g.scene.add(this.bowl);
      }
      this.bowl.visible = true;
      this.bowl.position.set(L.boardX - 0.36, L.counterY, L.boardZ - 0.04);
      g.pz.pos.set(this.bowl.position.x, L.counterY + 0.05, this.bowl.position.z);
      g.pz.scale = 1;
    },
    exit(g) { if (this.bowl) this.bowl.visible = false; },
    update(g, dt) {
      g.pz.visible = true;
      if (this.fly) {
        this.fly.t += dt * 2.0;
        const k = U.sat(this.fly.t), e = U.easeOut(k);
        g.pz.pos.set(
          U.lerp(this.fly.x0, L.boardX, e),
          U.lerp(this.fly.y0, boardTop(), e) + Math.sin(k * Math.PI) * 0.16,
          U.lerp(this.fly.z0, L.boardZ, e));
        if (k >= 1) {
          this.fly = null; this.placed = true;
          S.doughDrop(); S.flour(1.4);
          g.pFlour.burst(L.boardX, boardTop() + 0.01, L.boardZ, 20, 0.05, 0.4, 1.0, 0.03);
          g.shake(0.006);
          g.setStage('SHAPE');
        }
      }
    },
    guide(g, al) {
      const b = this.bowl.position;
      const k = (g.t * 0.6) % 1, e = U.easeInOut(k);
      g.showHand(U.lerp(b.x, L.boardX, e), U.lerp(b.y + 0.10, boardTop() + 0.09, e) + Math.sin(k * Math.PI) * 0.08,
        U.lerp(b.z, L.boardZ, e), al, 1.1);
      g.showPulse(L.boardX, boardTop() + 0.004, L.boardZ, 0.13, al * 0.7);
    },
    down(g) { this.go(g); },
    auto(g) { this.go(g); },
    go(g) {
      if (this.fly || this.placed) return;
      this.fly = { t: 0, x0: g.pz.pos.x, y0: g.pz.pos.y, z0: g.pz.pos.z };
      S.tap(0.9);
    }
  };

  /* ================================================================
     押し広げる＋まわす
  ================================================================ */
  St.SHAPE = {
    cam: 'bench',
    enter(g) {
      this.done = false; this.doneT = 0; this.lastA = null; this.prsT = 0; this.spinSnd = 0;
      this.target = 182;
      g.pz.pos.set(L.boardX, boardTop(), L.boardZ);
      g.pz.scale = 1;
    },
    update(g, dt) {
      const p = g.pizza;
      p.applySpin(dt); p.relax(dt, 0.7);
      g.pz.pos.set(L.boardX, boardTop(), L.boardZ);
      const m = p.meanR();
      if (Math.abs(p.spin) > 1.2) {
        this.spinSnd -= dt;
        if (this.spinSnd <= 0) { this.spinSnd = 0.22; S.spin(U.sat(Math.abs(p.spin) / 8)); }
        if (U.chance(dt * 10)) {
          const a = U.rand(0, TAU), r = m * MS * 0.95;
          g.pFlour.spawn(L.boardX + Math.cos(a) * r, boardTop() + 0.01, L.boardZ + Math.sin(a) * r,
            Math.cos(a) * 0.25, 0.10, Math.sin(a) * 0.25, 0.9, 0.02);
        }
      }
      if (!this.done && m >= this.target * 0.97) {
        this.done = true;
        sparkle(g, g.pz.pos, 20);
        g.pFlour.burst(L.boardX, boardTop() + 0.02, L.boardZ, 16, m * MS, 0.4, 1.1, 0.035);
      }
      if (this.done) { this.doneT += dt; if (this.doneT > 0.7) g.setStage('TOSS'); }
    },
    guide(g, al) {
      const p = g.pizza, m = p.meanR();
      const hit = m >= this.target * 0.97;
      g.showRing(L.boardX, boardTop() + 0.003, L.boardZ, this.target * MS, al * 0.9, hit);
      if (this.done) return;
      const cyc = (g.t / 3.4) % 1;
      if (cyc < 0.5) {
        const k = cyc / 0.5;
        const a = Math.sin(k * TAU) * 1.2 + 0.6;
        const rr = U.lerp(m * 0.35, Math.min(this.target, m + 70), U.smooth(Math.abs(Math.sin(k * Math.PI)))) * MS;
        g.showHand(L.boardX + Math.cos(a) * rr, boardTop() + 0.055, L.boardZ + Math.sin(a) * rr, al, 1.0);
      } else {
        const a = g.t * 2.0;
        const rr = m * MS * 0.8;
        g.showHand(L.boardX + Math.cos(a) * rr, boardTop() + 0.055, L.boardZ + Math.sin(a) * rr, al, 1.0);
        g.showRing(L.boardX, boardTop() + 0.004, L.boardZ, rr, al * 0.45, false);
      }
    },
    move(g) {
      const i = g.input, p = g.pizza;
      if (!i.down) return;
      const c = g.pz.pos;
      const w = g.rayToPlane(i.sx, i.sy, boardTop() + 0.01);
      const mx = (w.x - c.x) / MS, my = (w.z - c.z) / MS;
      const pw = g.rayToPlane(i.psx === undefined ? i.sx : i.psx, i.psy === undefined ? i.sy : i.psy, boardTop() + 0.01);
      const spd = Math.hypot(w.x - pw.x, w.z - pw.z) / Math.max(0.001, i.dt) / MS;
      const d = Math.hypot(mx, my);
      if (d < p.maxRad() * 1.35) {
        p.press(mx, my, spd, i.dt);
        this.prsT -= i.dt;
        if (this.prsT <= 0 && spd > 60) {
          this.prsT = 0.14; S.press(U.sat(spd / 900));
          if (U.chance(0.5)) {
            g.pFlour.spawn(w.x, boardTop() + 0.012, w.z, U.rand(-0.1, 0.1), 0.14, U.rand(-0.1, 0.1), 0.8, 0.018);
            S.flour(0.7);
          }
        }
      }
      const ang = Math.atan2(my, mx);
      if (this.lastA !== null && d > p.meanR() * 0.22) {
        const da = U.angDiff(this.lastA, ang);
        if (Math.abs(da) < 1.2) p.spin = U.clamp(p.spin + da * (5 + 6 * U.sat(d / Math.max(1, p.meanR()))), -13, 13);
      }
      this.lastA = ang;
      g.wake();
    },
    up(g) { this.lastA = null; },
    auto(g) {
      const p = g.pizza, a = U.rand(0, TAU);
      p.press(Math.cos(a) * p.meanR() * 0.8, Math.sin(a) * p.meanR() * 0.8, 700, 0.45);
      p.spin += 5;
      g.pFlour.burst(L.boardX, boardTop() + 0.01, L.boardZ, 4, 0.05, 0.3, 0.8, 0.02);
      S.press(0.5);
      g.autoT = 0.6;
    }
  };

  /* ================================================================
     空中へ！
  ================================================================ */
  St.TOSS = {
    cam: 'toss',
    enter(g) { this.flight = null; this.count = 0; this.wait = 0; this.start = null; },
    update(g, dt) {
      const p = g.pizza;
      p.applySpin(dt); p.relax(dt, 0.5);
      g.pz.pos.set(L.boardX, boardTop(), L.boardZ);
      g.pz.scale = 1; g.pz.flip = 0;
      if (this.flight) {
        const f = this.flight;
        f.t += dt;
        const k = U.sat(f.t / f.dur);
        const h = Math.sin(k * Math.PI) * f.height;
        g.pz.pos.y = boardTop() + h;
        g.pz.flip = f.flips * k;
        p.rot += f.spin * dt;
        if (U.chance(dt * 16 * f.power)) {
          g.pFlour.spawn(L.boardX + U.rand(-0.06, 0.06), boardTop() + h, L.boardZ + U.rand(-0.06, 0.06),
            U.rand(-0.1, 0.1), -0.15, U.rand(-0.1, 0.1), 1.1, 0.02);
        }
        if (k >= 1) {
          this.flight = null; g.pz.flip = 0;
          p.tossGrow(f.power); p.spin *= 0.5;
          S.catchDough(f.power);
          g.pFlour.burst(L.boardX, boardTop() + 0.01, L.boardZ, 14 + f.power * 16, p.meanR() * MS, 0.5, 1.1, 0.03);
          g.shake(0.004 + f.power * 0.008);
          this.count++; this.wait = 2.1;
          if (this.count === 1) sparkle(g, g.pz.pos, 12);
        }
      } else if (this.count > 0) {
        this.wait -= dt;
        if (this.wait <= 0) g.setStage('SAUCE');
      }
    },
    guide(g, al) {
      if (this.flight) return;
      const k = (g.t * 0.75) % 1;
      const y0 = boardTop() + 0.05, y1 = boardTop() + 0.42;
      g.showChevrons(function (u) {
        return { x: L.boardX, y: U.lerp(y0, y1, u), z: L.boardZ + 0.02, yaw: 0, s: 1 - u * 0.25, pitchUp: true };
      }, 6, al * 0.9);
      for (let i = 0; i < g.gChevrons.length; i++) {
        const m = g.gChevrons[i];
        if (m.visible) m.rotation.x = -Math.PI / 2 + 0.9;
      }
      g.showHand(L.boardX, U.lerp(y0, y1, U.easeOut(k)), L.boardZ + 0.05, al * (1 - k * 0.4), 1.1);
    },
    down(g) { if (!this.flight) this.start = { x: g.input.sx, y: g.input.sy }; },
    up(g) {
      if (this.flight) return;
      const i = g.input;
      const speed = -i.vsy;                       // 画面上向きのふりの速さ(px/s)
      const dist = this.start ? (this.start.y - i.sy) : 0;
      this.start = null;
      const ref = Math.min(g.W, g.H);
      if (dist < ref * 0.05 && speed < ref * 0.25) return;
      const power = U.clamp(Math.max((speed - ref * 0.25) / (ref * 4.2), (dist - ref * 0.05) / (ref * 0.62)), 0.08, 1);
      this.launch(g, power);
    },
    auto(g) { if (this.count === 0 && !this.flight) this.launch(g, 0.55); g.autoT = 6; },
    launch(g, power) {
      const p = U.clamp(power, 0.1, 1);
      this.flight = { t: 0, dur: 0.62 + p * 0.8, height: 0.10 + p * 0.55, flips: 1 + Math.round(p * 2), power: p, spin: U.rand(-2, 2) + 3 * p };
      S.toss(p);
      g.pFlour.burst(L.boardX, boardTop() + 0.01, L.boardZ, 10 + p * 12, 0.06, 0.5, 1.0, 0.025);
      g.wake();
    }
  };

  /* ================================================================
     トマトソース
  ================================================================ */
  St.SAUCE = {
    cam: 'bench',
    enter(g) {
      this.done = false; this.doneT = 0; this.sndT = 0; this.autoPhase = 0;
      if (!this.ladle) {
        const grp = new THREE.Group();
        const M = PZ.scene3.mats;
        const bowl = new THREE.Mesh(G.bowl(0.042, 0.018, 0.028), M.metal);
        bowl.rotation.x = Math.PI;
        bowl.position.y = 0.028;
        grp.add(bowl);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 12, 0, TAU, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0xa8281c, roughness: 0.35 }));
        inner.rotation.x = Math.PI;
        inner.position.y = 0.026;
        grp.add(inner);
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.22, 10), M.metal);
        h.position.set(0, 0.13, -0.05);
        h.rotation.x = -0.35;
        grp.add(h);
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 12),
          new THREE.MeshStandardMaterial({ color: 0xe4759f, roughness: 0.5 }));
        grip.position.set(0, 0.20, -0.075);
        grip.rotation.x = -0.35;
        grp.add(grip);
        grp.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        g.scene.add(grp);
        this.ladle = grp;
      }
      this.ladle.visible = true;
      this.lp = new THREE.Vector3(L.boardX, boardTop() + 0.06, L.boardZ);
    },
    exit(g) { if (this.ladle) this.ladle.visible = false; },
    update(g, dt) {
      const p = g.pizza;
      p.applySpin(dt);
      g.pz.pos.set(L.boardX, boardTop(), L.boardZ);
      const i = g.input;
      let tx = L.boardX, ty = boardTop() + 0.11, tz = L.boardZ;
      if (i.down) {
        const w = g.rayToPlane(i.sx, i.sy, boardTop() + 0.01);
        tx = w.x; ty = boardTop() + 0.055; tz = w.z;
      }
      this.lp.x = U.approach(this.lp.x, tx, 26, dt);
      this.lp.y = U.approach(this.lp.y, ty, 22, dt);
      this.lp.z = U.approach(this.lp.z, tz, 26, dt);
      this.ladle.position.copy(this.lp);
      this.ladle.rotation.z = U.clamp((this.lp.x - tx) * 4, -0.4, 0.4);
      if (!this.done && p.sauceCover >= 0.60) { this.done = true; sparkle(g, g.pz.pos, 16); }
      if (this.done) { this.doneT += dt; if (this.doneT > 0.8) g.setStage('TOPPING'); }
    },
    guide(g, al) {
      if (this.done) return;
      const p = g.pizza;
      const prog = (g.t * 0.42) % 1;
      const R = p.innerR() * MS * 0.9;
      const a = prog * 2.6 * TAU, rr = prog * R;
      g.showHand(L.boardX + Math.cos(a) * rr, boardTop() + 0.06, L.boardZ + Math.sin(a) * rr, al, 1.0);
      g.showChevrons(function (u) {
        const aa = u * 2.6 * TAU * prog, r2 = u * rr;
        return { x: L.boardX + Math.cos(aa) * r2, y: boardTop() + 0.004, z: L.boardZ + Math.sin(aa) * r2, yaw: -aa + Math.PI / 2, s: 0.55 };
      }, 7, al * 0.7);
    },
    move(g) {
      const i = g.input, p = g.pizza;
      if (!i.down) return;
      const c = g.pz.pos;
      const w = g.rayToPlane(i.sx, i.sy, boardTop() + 0.01);
      const mx = (w.x - c.x) / MS, my = (w.z - c.z) / MS;
      if (Math.hypot(mx, my) > p.meanR() * 1.3) return;
      const pw = g.rayToPlane(i.psx === undefined ? i.sx : i.psx, i.psy === undefined ? i.sy : i.psy, boardTop() + 0.01);
      const lx = (pw.x - c.x) / MS, ly = (pw.z - c.z) / MS;
      const steps = Math.min(8, 1 + Math.floor(Math.hypot(mx - lx, my - ly) / 14));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        p.paintSauce(U.lerp(lx, mx, t), U.lerp(ly, my, t), 46);
      }
      this.sndT -= i.dt;
      if (this.sndT <= 0) { this.sndT = 0.16; S.sauce(0.5); }
      g.wake();
    },
    auto(g) {
      const p = g.pizza;
      this.autoPhase += 0.5;
      const a = this.autoPhase * 1.4, rr = (this.autoPhase / 14) * p.innerR();
      p.paintSauce(Math.cos(a) * rr, Math.sin(a) * rr, 62);
      S.sauce(0.5);
      g.autoT = 0.12;
    }
  };

  /* ================================================================
     具材 → ピールへ
  ================================================================ */
  St.TOPPING = {
    cam: 'topping',
    enter(g) {
      this.held = null; this.sprinkleT = 0;
      this.peelReady = false; this.peelIn = 0;
      this.moving = false; this.snapped = false; this.snapT = 0;
      this.off = new THREE.Vector3();
      this.buildBowls(g);
    },
    exit(g) { this.clearBowls(g); if (this.heldMesh) { g.scene.remove(this.heldMesh); this.heldMesh = null; } },
    clearBowls(g) {
      if (!this.bowls) return;
      for (let i = 0; i < this.bowls.length; i++) g.scene.remove(this.bowls[i].group);
      this.bowls = null;
    },
    buildBowls(g) {
      this.clearBowls(g);
      const items = g.recipe.items.slice(0, 6);
      const n = items.length;
      this.bowls = [];
      for (let i = 0; i < n; i++) {
        const grp = new THREE.Group();
        const type = items[i];
        const bowl = new THREE.Mesh(G.bowl(0.072, 0.048, 0.045),
          new THREE.MeshStandardMaterial({ color: BOWL_COL[type] || 0xeeeeee, roughness: 0.28, envMapIntensity: 1.1 }));
        bowl.castShadow = bowl.receiveShadow = true;
        grp.add(bowl);
        const geo = G.topping(type);
        const im = new THREE.InstancedMesh(geo, g.pizza.topMaterial(type), 7);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
        const r = (PZ.TOP_R[type] || 20) * MS * 2;
        for (let k = 0; k < 7; k++) {
          const a = k * 2.399, rr = Math.sqrt((k + 0.4) / 7) * 0.036;
          pos.set(Math.cos(a) * rr, 0.030 + (k % 2) * 0.008, Math.sin(a) * rr);
          q.setFromEuler(new THREE.Euler(0, a, 0));
          sc.set(r, r * 0.8, r);
          m4.compose(pos, q, sc);
          im.setMatrixAt(k, m4);
        }
        im.castShadow = true;
        grp.add(im);
        grp.userData.type = type;
        const x = L.boardX + (i - (n - 1) / 2) * 0.175;
        grp.position.set(x, L.counterY, L.counterZ + L.counterD * 0.5 - 0.11);
        g.scene.add(grp);
        this.bowls.push({ group: grp, type: type });
      }
    },
    peelPos() { return PZ.pathAt(-1); },
    update(g, dt) {
      const p = g.pizza;
      p.updateToppings(dt); p.applySpin(dt);
      const need = g.recipe.need;
      if (!this.peelReady && p.toppings.length >= need) { this.peelReady = true; S.slide(0.5, 0.5); }
      if (this.peelReady) this.peelIn = Math.min(1, this.peelIn + dt * 2.2);

      const pp = this.peelPos();
      if (this.snapped) {
        this.snapT += dt;
        const k = U.sat(this.snapT / 0.45), e = U.easeOut(k);
        g.pz.pos.set(U.lerp(this.from.x, pp.x, e), U.lerp(this.from.y, pp.y + 0.010, e), U.lerp(this.from.z, pp.z, e));
        if (this.snapT > 0.6) { g.setStage('INSERT'); return; }
      } else {
        g.pz.pos.set(L.boardX + this.off.x, boardTop() + this.off.y, L.boardZ + this.off.z);
      }
      if (this.peelIn > 0) {
        const e = U.easeOut(this.peelIn);
        g.peel.visible = true;
        g.peel.pos.set(pp.x, pp.y, U.lerp(pp.z + 0.85, pp.z, e));
        g.peel.yaw = 0;
      }
      if (this.held && this.heldMesh) {
        const w = g.rayToPlane(g.input.sx, g.input.sy, boardTop() + 0.08);
        this.heldMesh.position.copy(w);
        this.heldMesh.rotation.y += dt * 2;
      }
    },
    guide(g, al) {
      const p = g.pizza;
      if (this.peelReady && !this.snapped) {
        const pp = this.peelPos();
        const a = new THREE.Vector3(g.pz.pos.x, boardTop() + 0.02, g.pz.pos.z);
        const b = new THREE.Vector3(pp.x, pp.y + 0.02, pp.z);
        g.showChevrons(function (u) {
          return { x: U.lerp(a.x, b.x, u), y: U.lerp(a.y, b.y, u), z: U.lerp(a.z, b.z, u), yaw: Math.atan2(b.x - a.x, b.z - a.z), s: 0.9 };
        }, 6, al * 0.9);
        const k = (g.t * 0.7) % 1, e = U.easeInOut(k);
        g.showHand(U.lerp(a.x, b.x, e), U.lerp(a.y, b.y, e) + 0.05, U.lerp(a.z, b.z, e), al, 1.1);
      } else if (this.bowls && this.bowls.length) {
        const i = Math.floor(g.t / 2.2) % this.bowls.length;
        const b = this.bowls[i].group.position;
        const k = (g.t / 2.2) % 1, e = U.smooth(U.sat((k - 0.15) / 0.7));
        g.showPulse(b.x, L.counterY + 0.02, b.z, 0.10, al * 0.8);
        g.showHand(U.lerp(b.x, g.pz.pos.x, e), L.counterY + 0.09, U.lerp(b.z, g.pz.pos.z, e), al, 1.0);
      }
    },
    down(g) {
      const r = g.rayAt(g.input.sx, g.input.sy);
      if (this.bowls) {
        const objs = this.bowls.map(b => b.group);
        const hits = r.intersectObjects(objs, true);
        if (hits.length) {
          let o = hits[0].object; while (o && !o.userData.type) o = o.parent;
          if (o) {
            this.held = o.userData.type;
            const rr = (PZ.TOP_R[this.held] || 20) * MS * 2.4;
            this.heldMesh = new THREE.Mesh(G.topping(this.held), g.pizza.topMaterial(this.held));
            this.heldMesh.scale.setScalar(rr);
            this.heldMesh.castShadow = true;
            g.scene.add(this.heldMesh);
            S.tap(1.2);
            return;
          }
        }
      }
      if (this.peelReady) {
        const w = g.rayToPlane(g.input.sx, g.input.sy, boardTop() + 0.01);
        const d = Math.hypot(w.x - g.pz.pos.x, w.z - g.pz.pos.z) / MS;
        if (d < g.pizza.meanR() * 1.35) {
          this.moving = true;
          this.grab = { x: w.x - g.pz.pos.x, z: w.z - g.pz.pos.z };
        }
      }
    },
    move(g) {
      const i = g.input, p = g.pizza;
      if (this.held) {
        const w = g.rayToPlane(i.sx, i.sy, boardTop() + 0.01);
        const mx = (w.x - g.pz.pos.x) / MS, my = (w.z - g.pz.pos.z) / MS;
        if (this.held === 'cheese' && Math.hypot(mx, my) < p.innerR()) {
          this.sprinkleT -= i.dt;
          if (this.sprinkleT <= 0) {
            this.sprinkleT = 0.06;
            p.addTopping('cheese', mx + U.rand(-18, 18), my + U.rand(-18, 18));
            if (U.chance(0.35)) S.plop(1.6);
          }
        }
        g.wake();
        return;
      }
      if (this.moving && !this.snapped) {
        const w = g.rayToPlane(i.sx, i.sy, boardTop() + 0.01);
        this.off.x = U.approach(this.off.x, w.x - this.grab.x - L.boardX, 26, i.dt);
        this.off.z = U.approach(this.off.z, w.z - this.grab.z - L.boardZ, 26, i.dt);
        const pp = this.peelPos();
        if (Math.hypot(g.pz.pos.x - pp.x, g.pz.pos.z - pp.z) < 0.16) this.snap(g);
        g.wake();
      }
    },
    up(g) {
      const i = g.input, p = g.pizza;
      if (this.held) {
        const w = g.rayToPlane(i.sx, i.sy, boardTop() + 0.01);
        const mx = (w.x - g.pz.pos.x) / MS, my = (w.z - g.pz.pos.z) / MS;
        if (Math.hypot(mx, my) < p.meanR() * 1.55) {
          p.addTopping(this.held, mx, my);
          S.plop(this.held === 'cheese' ? 1.6 : 1);
        }
        if (this.heldMesh) { g.scene.remove(this.heldMesh); this.heldMesh = null; }
        this.held = null;
        return;
      }
      if (this.moving) {
        this.moving = false;
        if (!this.snapped) {
          const pp = this.peelPos();
          if (Math.hypot(g.pz.pos.x - pp.x, g.pz.pos.z - pp.z) < 0.30) this.snap(g);
          else { this.off.set(0, 0, 0); }
        }
      }
    },
    snap(g) {
      if (this.snapped) return;
      this.snapped = true; this.snapT = 0;
      this.from = g.pz.pos.clone();
      S.slide(0.8, 0.5);
      g.pFlour.burst(g.pz.pos.x, g.pz.pos.y + 0.01, g.pz.pos.z, 10, 0.05, 0.35, 0.9, 0.02);
    },
    auto(g) {
      const p = g.pizza;
      if (!this.peelReady) {
        const b = this.bowls[U.randInt(0, this.bowls.length - 1)];
        const a = U.rand(0, TAU), rr = U.rand(0, p.innerR() * 0.85);
        p.addTopping(b.type, Math.cos(a) * rr, Math.sin(a) * rr);
        S.plop(1);
        g.autoT = 0.35;
      } else { this.snap(g); }
    }
  };

  /* ================================================================
     ★ 看板動作 ★ ピールで石窯の奥へ
  ================================================================ */
  St.INSERT = {
    cam: 'oven',
    enter(g) {
      this.v = -1; this.grab = null; this.launch = null; this.retreat = null;
      this.slideSnd = 0; this.vSpeed = 0; this.autoAnim = 0;
      S.startFire();
    },
    update(g, dt) {
      const p = g.pizza;
      p.applySpin(dt);
      g.peel.visible = true; g.peel.held = true; g.peel.yaw = 0;

      if (this.launch) {
        const Lc = this.launch;
        Lc.t += dt;
        const k1 = U.sat(Lc.t / 0.44);
        const over = U.lerp(Lc.v0, g.vBake + 0.14, U.easeOut(k1));
        const k2 = U.sat((Lc.t - 0.44) / 0.34);
        this.v = k2 > 0 ? U.lerp(g.vBake + 0.14, g.vBake, U.easeOut(k2)) : over;
        const pk = U.sat((Lc.t - 0.08) / 0.36);
        Lc.peelV = U.lerp(Lc.v0, -1.5, U.easeIn(pk));
        if (Lc.t > 0.16 && !Lc.snd) { Lc.snd = true; S.landStone(); }
        if (Lc.t > 0.2 && !Lc.spark) {
          Lc.spark = true;
          const q = PZ.pathAt(g.vBake);
          g.pEmber.burst(q.x, q.y + 0.02, q.z, 26, 0.10, 0.9, 1.2, 0.012);
          g.pSmoke.burst(q.x, q.y + 0.05, q.z, 5, 0.08, 0.25, 1.6, 0.06);
        }
        g.peel.visible = pk < 1;
        if (Lc.t > 0.95) { g.setStage('BAKE'); return; }
      } else if (this.retreat) {
        this.retreat.t += dt;
        const k = U.sat(this.retreat.t / 0.5);
        this.v = U.lerp(this.retreat.v0, -1, U.easeOut(k));
        if (k >= 1) this.retreat = null;
      }

      this.v = U.clamp(this.v, -1.15, 1);
      g.pz.v = this.v;
      const q = PZ.pathAt(this.v);
      const onPeel = !this.launch || this.launch.t < 0.2;
      g.pz.pos.set(q.x, q.y + (onPeel ? 0.010 : 0.001), q.z);
      g.pz.inOven = this.v > -0.05;

      const pv = this.launch ? this.launch.peelV : this.v;
      const pq = PZ.pathAt(pv);
      g.peel.pos.set(pq.x, pq.y, pq.z);

      const spd = Math.abs(this.vSpeed);
      if (spd > 0.25) {
        this.slideSnd -= dt;
        if (this.slideSnd <= 0) { this.slideSnd = 0.13; S.slide(U.sat(spd / 2.2), 0.28); }
      }
      if (this.v > 0.1 && U.chance(dt * 6)) {
        g.pEmber.spawn(q.x + U.rand(-0.1, 0.1), q.y + 0.03, q.z, U.rand(-0.1, 0.1), U.rand(0.3, 0.8), U.rand(0.1, 0.5), 1.0, 0.008);
      }
    },
    guide(g, al) {
      if (this.launch) return;
      g.showChevrons(function (u) {
        const p = PZ.pathAt(U.lerp(-0.86, 0.5, u));
        return { x: p.x, y: p.y + 0.055, z: p.z, yaw: 0, s: 1 - u * 0.3 };
      }, 8, al * 0.95);
      const k = (g.t * 0.55) % 1;
      const q = PZ.pathAt(U.lerp(-0.9, 0.45, U.easeInOut(k)));
      g.showHand(q.x, q.y + 0.10, q.z + 0.06, al * (1 - k * 0.35), 1.15 - k * 0.3);
    },
    down(g) {
      if (this.launch) return;
      this.retreat = null;
      const v = g.projectV(g.input.sx, g.input.sy);
      this.grab = { off: this.v - v };
      g.wake();
    },
    move(g) {
      if (!this.grab || this.launch) return;
      const i = g.input;
      const v = g.projectV(i.sx, i.sy) + this.grab.off;
      const nv = U.clamp(v, -1.12, 0.98);
      this.vSpeed = (nv - this.v) / Math.max(0.001, i.dt);
      this.v = nv;
      g.wake();
    },
    up(g) {
      if (!this.grab || this.launch) return;
      const fast = this.vSpeed > 0.6;
      if (this.v > 0.30 || (this.v > 0.02 && fast)) this.doLaunch(g);
      else {
        this.retreat = { t: 0, v0: this.v };
        if (this.v > -0.9) S.slide(0.4, 0.4);
      }
      this.grab = null; this.vSpeed = 0;
    },
    doLaunch(g) {
      this.launch = { t: 0, v0: this.v, peelV: this.v };
      S.slide(1, 0.5);
      g.shake(0.008);
      g.camPush = 0.9;
    },
    auto(g) {
      if (this.launch) return;
      this.autoAnim += 0.06;
      this.v = U.lerp(-1, 0.5, U.easeInOut(U.sat(this.autoAnim)));
      if (this.autoAnim >= 1) { this.doLaunch(g); this.autoAnim = 0; }
      g.autoT = 0.1;
    }
  };

  /* ================================================================
     焼く
  ================================================================ */
  function bakeCommon(g, dt) {
    const p = g.pizza;
    const q = PZ.pathAt(g.vBake);
    g.pz.pos.set(q.x, q.y + 0.001 + Math.sin(g.t * 5) * 0.0004, q.z);
    g.pz.v = g.vBake; g.pz.inOven = true;
    // 炎の方位（炉床の面で見た向き）
    const f = g.fire.group.position;
    const ang = Math.atan2(f.z - q.z, f.x - q.x);
    p.bakeStep(dt, 1, -ang);
    p.applySpin(dt);
    if (U.chance(dt * 2.0)) {
      g.pSmoke.spawn(q.x + U.rand(-0.08, 0.08), q.y + 0.03, q.z + U.rand(-0.08, 0.08),
        U.rand(-0.05, 0.05), U.rand(0.14, 0.3), U.rand(-0.05, 0.05), 1.8, 0.05);
    }
    if (U.chance(dt * 0.8)) S.sizzle(1);
  }

  St.BAKE = {
    cam: 'bake',
    enter(g) { g.pizza.startBake(); this.t = 0; },
    update(g, dt) { bakeCommon(g, dt); this.t += dt; if (this.t > 6.2) g.setStage('ROTATE'); },
    down(g) {
      const f = g.fire.group.position;
      g.pEmber.burst(f.x, f.y + 0.06, f.z, 24, 0.10, 1.2, 1.3, 0.012);
      S.flare(); g.wake();
    },
    guide(g, al) { }
  };

  St.BAKE2 = {
    cam: 'bake',
    enter(g) { this.t = 0; },
    update(g, dt) { bakeCommon(g, dt); this.t += dt; if (this.t > 5.4) g.setStage('RETRIEVE'); },
    down: St.BAKE.down,
    guide(g, al) { }
  };

  /* ================================================================
     窯の中でくるっ
  ================================================================ */
  St.ROTATE = {
    cam: 'bake',
    enter(g) { this.peelIn = 0; this.turned = 0; this.lastA = null; this.grab = false; this.out = 0; this.done = false; },
    update(g, dt) {
      const p = g.pizza;
      bakeCommon(g, dt);
      const q = PZ.pathAt(g.vBake);
      if (this.grab || this.done) this.peelIn = Math.min(1, this.peelIn + dt * 3.4);
      if (this.done) { this.out += dt; if (this.out > 0.5) { g.setStage('BAKE2'); return; } }
      const e = this.done ? 1 - U.easeIn(U.sat(this.out / 0.5)) : U.easeOut(this.peelIn);
      if (e > 0.01) {
        const from = PZ.pathAt(-0.7);
        g.peel.visible = true; g.peel.held = true; g.peel.yaw = 0;
        g.peel.pos.set(q.x, U.lerp(from.y, q.y - 0.004, e), U.lerp(from.z, q.z, e));
      }
      if (!this.grab) p.spin *= Math.exp(-2.4 * dt);
    },
    guide(g, al) {
      if (this.done) return;
      const q = PZ.pathAt(g.vBake);
      const r = g.pizza.meanR() * MS * 0.85;
      g.showRing(q.x, q.y + 0.03, q.z, r, al * 0.55, false);
      const a = g.t * 2.0;
      g.showHand(q.x + Math.cos(a) * r, q.y + 0.09, q.z + Math.sin(a) * r, al, 1.0);
      g.showChevrons(function (u) {
        const aa = a + 0.4 + u * 1.6;
        return { x: q.x + Math.cos(aa) * r, y: q.y + 0.012, z: q.z + Math.sin(aa) * r, yaw: -aa, s: 0.6 };
      }, 5, al * 0.8);
    },
    down(g) { this.grab = true; this.lastA = null; g.wake(); },
    move(g) {
      if (!this.grab || this.done) return;
      const i = g.input, p = g.pizza;
      const q = PZ.pathAt(g.vBake);
      const w = g.rayToPlane(i.sx, i.sy, q.y + 0.02);
      const a = Math.atan2(w.z - q.z, w.x - q.x);
      if (this.lastA !== null && this.peelIn > 0.5) {
        let da = U.angDiff(this.lastA, a);
        if (Math.abs(da) > 1.2) da = 0;
        p.spin = U.clamp(p.spin - da * 9, -12, 12);
        this.turned += Math.abs(da);
        if (this.turned > 2.4) this.finish(g);
      }
      this.lastA = a;
      g.wake();
    },
    up(g) { this.grab = false; this.lastA = null; },
    finish(g) {
      if (this.done) return;
      this.done = true;
      S.kuru();
      const q = PZ.pathAt(g.vBake);
      g.pEmber.burst(q.x, q.y + 0.03, q.z, 18, 0.10, 0.9, 1.1, 0.011);
      g.pSpark.burst(q.x, q.y + 0.06, q.z, 10, 0.08, 0.5, 0.8, 0.014);
      g.pizza.spin = 7;
    },
    auto(g) {
      this.grab = true;
      if (this.peelIn > 0.6) {
        g.pizza.spin = 7; this.turned += 0.5;
        if (this.turned > 2.4) this.finish(g);
      }
      g.autoT = 0.12;
    }
  };

  /* ================================================================
     手前へ引き出す
  ================================================================ */
  St.RETRIEVE = {
    cam: 'oven',
    enter(g) { this.peelIn = 0; this.grab = null; this.v = g.vBake; this.done = null; this.slideSnd = 0; this.vSpeed = 0; },
    update(g, dt) {
      const p = g.pizza;
      p.applySpin(dt);
      const f = g.fire.group.position;
      const q0 = PZ.pathAt(this.v);
      p.bakeStep(dt * (this.v > 0.2 ? 1 : 0.15), 1, -Math.atan2(f.z - q0.z, f.x - q0.x));
      if (this.grab || this.peelIn > 0) this.peelIn = Math.min(1, this.peelIn + dt * 3.6);
      if (this.done) {
        this.done.t += dt;
        const k = U.sat(this.done.t / 0.55);
        this.v = U.lerp(this.done.v0, -1.05, U.easeOut(k));
        if (this.done.t > 0.75) { g.setStage('CUT'); return; }
      }
      this.v = U.clamp(this.v, -1.1, 1);
      const q = PZ.pathAt(this.v);
      const e = U.easeOut(this.peelIn);
      g.pz.pos.set(q.x, q.y + (e > 0.9 ? 0.010 : 0.001), q.z);
      g.pz.v = this.v; g.pz.inOven = this.v > -0.05;
      const from = PZ.pathAt(-1.25);
      g.peel.visible = this.peelIn > 0.02;
      g.peel.held = g.peel.visible;
      g.peel.yaw = 0;
      g.peel.pos.set(q.x, U.lerp(from.y, q.y - 0.004, e), U.lerp(from.z, q.z, e));
      const spd = Math.abs(this.vSpeed);
      if (spd > 0.25) {
        this.slideSnd -= dt;
        if (this.slideSnd <= 0) { this.slideSnd = 0.13; S.slide(U.sat(spd / 2), 0.26); }
      }
      if (this.v < 0.3 && U.chance(dt * 4)) {
        g.pSmoke.spawn(q.x + U.rand(-0.06, 0.06), q.y + 0.04, q.z, 0, 0.22, 0.05, 1.6, 0.05);
      }
    },
    guide(g, al) {
      if (this.done) return;
      g.showChevrons(function (u) {
        const p = PZ.pathAt(U.lerp(g.vBake, -0.86, u));
        return { x: p.x, y: p.y + 0.055, z: p.z, yaw: Math.PI, s: 0.7 + u * 0.3 };
      }, 8, al * 0.95);
      const k = (g.t * 0.55) % 1;
      const q = PZ.pathAt(U.lerp(g.vBake, -0.86, U.easeInOut(k)));
      g.showHand(q.x, q.y + 0.10, q.z + 0.06, al * (1 - k * 0.3), 0.9 + k * 0.3);
    },
    down(g) { if (!this.done) { this.grab = { off: null }; g.wake(); } },
    move(g) {
      if (!this.grab || this.done) return;
      const i = g.input;
      if (this.peelIn < 0.9) { this.grab.off = null; return; }
      const v = g.projectV(i.sx, i.sy);
      if (this.grab.off === null) this.grab.off = this.v - v;
      const nv = U.clamp(v + this.grab.off, -1.05, 1);
      this.vSpeed = (nv - this.v) / Math.max(0.001, i.dt);
      this.v = nv;
      g.wake();
    },
    up(g) {
      if (!this.grab || this.done) return;
      this.grab = null;
      if (this.v < -0.15 || this.vSpeed < -0.6) {
        this.done = { t: 0, v0: this.v };
        S.slide(0.9, 0.6); g.shake(0.006);
      }
      this.vSpeed = 0;
    },
    auto(g) {
      if (this.done) return;
      this.peelIn = Math.min(1, this.peelIn + 0.12);
      if (this.peelIn >= 1) {
        this.v = U.lerp(this.v, -0.4, 0.12);
        if (this.v < -0.2) { this.done = { t: 0, v0: this.v }; S.slide(0.9, 0.6); }
      }
      g.autoT = 0.12;
    }
  };

  /* ================================================================
     カット（大人の職人が切る）
  ================================================================ */
  St.CUT = {
    cam: 'serve',
    enter(g) {
      this.slide = 0;
      this.from = g.pz.pos.clone();
      this.to = new THREE.Vector3(-0.30, L.counterY + 0.030, -0.30);
      this.drag = null; this.lift = null; this.lifted = 0; this.done = 0;
      this.cutN = 0;
      g.pizza.setCuts(1);
      if (!this.cutter) this.cutter = buildCutter(g);
      this.cutter.visible = true;
      this.cp = new THREE.Vector3(this.to.x + 0.24, L.counterY + 0.14, this.to.z + 0.12);
      const sp = PZ.scene3.servePlate;
      sp.visible = true;
      sp.position.copy(this.to).setY(L.counterY + 0.002);
    },
    exit(g) {
      if (this.cutter) this.cutter.visible = false;
      if (this.strands) { g.scene.remove(this.strands); this.strands = null; }
    },
    update(g, dt) {
      const p = g.pizza;
      this.slide = Math.min(1, this.slide + dt * 1.5);
      const e = U.easeOut(this.slide);
      g.pz.pos.lerpVectors(this.from, this.to, e);
      p.spin *= Math.exp(-3 * dt);
      p.applySpin(dt);
      if (U.chance(dt * 2.2)) {
        g.pSmoke.spawn(g.pz.pos.x + U.rand(-0.06, 0.06), g.pz.pos.y + 0.03, g.pz.pos.z, 0, 0.18, 0, 1.5, 0.04);
      }
      // カッターの位置
      const i = g.input;
      let tx, ty, tz;
      if (i.down && this.drag) {
        const w = g.rayToPlane(i.sx, i.sy, g.pz.pos.y + 0.02);
        tx = w.x; ty = g.pz.pos.y + 0.055; tz = w.z;
      } else {
        tx = this.to.x + 0.26; ty = L.counterY + 0.15; tz = this.to.z + 0.14;
      }
      this.cp.x = U.approach(this.cp.x, tx, 20, dt);
      this.cp.y = U.approach(this.cp.y, ty, 16, dt);
      this.cp.z = U.approach(this.cp.z, tz, 20, dt);
      this.cutter.position.copy(this.cp);
      this.cutter.rotation.y = this.cutAngle || 0;
      g.chefHand = this.cp.clone().add(new THREE.Vector3(0, 0.14, 0));

      if (this.lift) {
        this.lift.k = U.approach(this.lift.k, this.lift.target, 12, dt);
        const l = this.lift;
        p.layoutSlices(0.004, { index: l.index, out: 0.05 * l.k, up: 0.09 * l.k, tilt: 0.5 * l.k });
        // チーズの糸
        if (this.strands) { g.scene.remove(this.strands); if (this.strands.userData.dispose) this.strands.userData.dispose(); this.strands = null; }
        if (l.k > 0.05) {
          const mid = ((l.index + 0.5) / p.sliceCount) * TAU - p.rot;
          const a = new THREE.Vector3(g.pz.pos.x + Math.cos(mid) * 0.05, g.pz.pos.y + 0.012, g.pz.pos.z + Math.sin(mid) * 0.05);
          const b = new THREE.Vector3(g.pz.pos.x + Math.cos(mid) * 0.11, g.pz.pos.y + 0.012 + 0.09 * l.k, g.pz.pos.z + Math.sin(mid) * 0.11);
          const st = p.makeStrands(a, b, l.k);
          if (st) { g.scene.add(st); this.strands = st; }
        }
        if (l.target === 0 && l.k < 0.03) { this.lift = null; p.layoutSlices(0.004, null); }
      } else if (this.cutN >= 4) {
        p.layoutSlices(0.004, null);
      }
      if (this.cutN >= 4 && this.lifted >= 1) {
        this.done += dt;
        if (this.done > 1.0) g.setStage('DONE');
      }
    },
    guide(g, al) {
      const p = g.pizza;
      const c = g.pz.pos;
      const r = p.meanR() * MS;
      if (this.cutN < 4) {
        const a = this.cutN * Math.PI / 4;
        g.showChevrons(function (u) {
          const t = -1 + u * 2;
          return { x: c.x + Math.cos(a) * r * 1.15 * t, y: c.y + 0.03, z: c.z + Math.sin(a) * r * 1.15 * t, yaw: Math.PI / 2 - a, s: 0.7 };
        }, 6, al * 0.9);
        const k = (g.t * 0.7) % 1, t = -1 + U.easeInOut(k) * 2;
        g.showHand(c.x + Math.cos(a) * r * 1.15 * t, c.y + 0.07, c.z + Math.sin(a) * r * 1.15 * t, al, 1.0);
      } else if (this.lifted < 1) {
        const a = -Math.PI * 0.25;
        g.showHand(c.x + Math.cos(a) * r * 0.6, c.y + 0.07, c.z + Math.sin(a) * r * 0.6, al, 1.05);
        g.showChevrons(function (u) {
          return { x: c.x + Math.cos(a) * r * (0.6 + u * 0.7), y: c.y + 0.03 + u * 0.06, z: c.z + Math.sin(a) * r * (0.6 + u * 0.7), yaw: Math.PI / 2 - a, s: 0.7 };
        }, 5, al * 0.9);
      }
    },
    down(g) {
      const p = g.pizza, i = g.input;
      const w = g.rayToPlane(i.sx, i.sy, g.pz.pos.y + 0.01);
      const dx = w.x - g.pz.pos.x, dz = w.z - g.pz.pos.z;
      const d = Math.hypot(dx, dz) / MS;
      if (this.cutN < 4) {
        this.drag = { x0: w.x, z0: w.z };
      } else if (d < p.meanR() * 1.2) {
        let a = Math.atan2(dz, dx) + p.rot;
        a = ((a % TAU) + TAU) % TAU;
        const idx = Math.floor(a / TAU * p.sliceCount) % p.sliceCount;
        this.lift = { index: idx, k: 0, target: 1 };
        S.stretch();
      }
      g.wake();
    },
    move(g) { g.wake(); },
    up(g) {
      const p = g.pizza, i = g.input;
      if (this.drag && this.cutN < 4) {
        const w = g.rayToPlane(i.sx, i.sy, g.pz.pos.y + 0.01);
        const dx = w.x - this.drag.x0, dz = w.z - this.drag.z0;
        if (Math.hypot(dx, dz) / MS > p.meanR() * 0.5) {
          this.cutN++;
          p.setCuts(this.cutN * 2);
          p.layoutSlices(0.004, null);
          this.cutAngle = Math.atan2(dx, dz);
          S.cut();
          g.shake(0.003);
          if (this.cutN >= 4) sparkle(g, g.pz.pos, 18);
        }
        this.drag = null;
      }
      if (this.lift && this.lift.target === 1) {
        this.lift.target = 0;
        this.lifted++;
        if (this.lifted === 1) { sparkle(g, g.pz.pos, 16); S.fanfare(); }
      }
    },
    auto(g) {
      const p = g.pizza;
      if (this.cutN < 4) {
        this.cutN++; p.setCuts(this.cutN * 2); p.layoutSlices(0.004, null);
        S.cut(); g.shake(0.003);
        if (this.cutN >= 4) sparkle(g, g.pz.pos, 18);
        g.autoT = 0.8;
      } else if (this.lifted < 1) {
        this.lift = { index: 0, k: 0, target: 1 };
        this.lifted = 1;
        S.stretch(); S.fanfare();
        const self = this;
        setTimeout(function () { if (self.lift) self.lift.target = 0; }, 900);
      }
    }
  };

  function buildCutter(g) {
    const grp = new THREE.Group();
    const M = PZ.scene3.mats;
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.0025, 40), M.metal);
    blade.rotation.z = Math.PI / 2;
    blade.castShadow = true;
    grp.add(blade);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.012, 14), M.metal);
    hub.rotation.z = Math.PI / 2;
    grp.add(hub);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.075, 0.012), M.metal);
    fork.position.y = 0.038;
    grp.add(fork);
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.075, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xd4699a, roughness: 0.45, envMapIntensity: 0.9 }));
    handle.position.y = 0.115;
    handle.castShadow = true;
    grp.add(handle);
    g.scene.add(grp);
    return grp;
  }

  /* ================================================================
     できた！
  ================================================================ */
  St.DONE = {
    cam: 'serve',
    enter(g) {
      this.t = 0;
      S.fanfare();
      sparkle(g, g.pz.pos, 26);
      PZ.scene3.board.visible = false;
      PZ.scene3.flourDecal.visible = false;
      if (!this.cards) {
        this.cards = [];
        for (let i = 0; i < 3; i++) {
          const grp = new THREE.Group();
          const plate = new THREE.Mesh(G.plate(0.085, 0.013), PZ.scene3.mats.porcelain);
          plate.castShadow = true;
          grp.add(plate);
          grp.userData.kind = i;
          g.scene.add(grp);
          this.cards.push(grp);
        }
      }
      // 中身を作り直す
      for (let i = 0; i < 3; i++) {
        const grp = this.cards[i];
        while (grp.children.length > 1) grp.remove(grp.children[1]);
        const rec = i === 0 ? g.recipe : (i === 1 ? RECIPES[1] : RECIPES[3]);
        const pz = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.013, 32),
          new THREE.MeshStandardMaterial({ map: miniPizzaTex(rec), roughness: 0.7 }));
        pz.position.y = 0.017;
        pz.castShadow = true;
        grp.add(pz);
        if (i === 1) {
          for (let k = 0; k < 2; k++) {
            const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.037, 0.012, 24),
              new THREE.MeshStandardMaterial({ map: miniPizzaTex(RECIPES[k === 0 ? 0 : 2]), roughness: 0.7 }));
            p2.position.set((k ? 1 : -1) * 0.055, 0.017, 0.045);
            grp.add(p2);
          }
        }
        grp.visible = true;
        grp.position.set(-0.30 + (i - 1) * 0.30, L.counterY, L.counterZ + 0.33);
      }
    },
    exit(g) {
      for (let i = 0; i < this.cards.length; i++) this.cards[i].visible = false;
      PZ.scene3.servePlate.visible = false;
      PZ.scene3.board.visible = true;
      PZ.scene3.flourDecal.visible = true;
    },
    update(g, dt) {
      this.t += dt;
      const p = g.pizza;
      p.spin *= Math.exp(-2 * dt);
      p.applySpin(dt);
      g.pz.pos.y = U.approach(g.pz.pos.y, L.counterY + 0.032, 3, dt);
      for (let i = 0; i < this.cards.length; i++) {
        const c = this.cards[i];
        const k = U.sat((this.t - 0.5 - i * 0.12) * 2.4);
        c.scale.setScalar(U.easeOutBack(k));
        c.rotation.y = this.t * 0.5 + i * 1.2;
      }
      if (U.chance(dt * 3.5)) {
        const a = U.rand(0, TAU), r = p.meanR() * MS * 1.1;
        g.pSpark.spawn(g.pz.pos.x + Math.cos(a) * r, g.pz.pos.y + 0.03, g.pz.pos.z + Math.sin(a) * r,
          0, U.rand(0.1, 0.3), 0, 0.9, 0.012);
      }
    },
    guide(g, al) {
      if (this.t < 1.4) return;
      const i = Math.floor(g.t / 1.6) % this.cards.length;
      const c = this.cards[i];
      g.showPulse(c.position.x, L.counterY + 0.02, c.position.z, 0.11, al * 0.85);
      g.showHand(c.position.x + 0.04, L.counterY + 0.09, c.position.z + 0.05, al, 1.0);
    },
    up(g) {
      if (this.t < 0.9) return;
      const r = g.rayAt(g.input.sx, g.input.sy);
      const hits = r.intersectObjects(this.cards, true);
      if (hits.length) {
        let o = hits[0].object; while (o && o.userData.kind === undefined) o = o.parent;
        if (!o) return;
        S.tap(1.1);
        if (o.userData.kind === 0) g.setStage('DOUGH');
        else if (o.userData.kind === 1) g.setStage('CHOOSE');
        else { g.recipe = RECIPES[3]; g.setStage('DOUGH'); }
      }
    }
  };

})();
