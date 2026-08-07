// The near layer: your own stall. This is the object the player actually
// touches, so it carries the most material detail — a waxed hardwood counter
// with a visible slab edge, a worn prep tray, a hanging work lamp that throws
// real contact shadows, and foreground clutter that frames the shot.

import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as G from '../engine/geo.js';
import * as TEX from '../engine/textures.js';
import { makeRng } from '../engine/util.js';
import { BOARD, COUNTER, cellPos } from '../game/config.js';

export class Stall {
  constructor(view) {
    this.view = view;
    this.root = new THREE.Group();
    view.scene.add(this.root);
    this.animated = [];
  }

  build(dest) {
    this.clear();
    const rng = makeRng(4242);
    this.dest = dest;

    this._counter(rng);
    this._tray();
    this._awning(dest, rng);
    this._workLamp(dest);
    this._props(dest, rng);
    this._foreground(dest, rng);
    return this.root;
  }

  clear() {
    for (const c of [...this.root.children]) this.root.remove(c);
    this.animated.length = 0;
  }

  // --------------------------------------------------------- counter ----
  _counter(rng) {
    const { width: W, depth: D, topY, slab, centerZ } = COUNTER;
    const woodTop = M.counterWood();
    const woodBody = M.crateWood(1);
    const dark = M.darkWood();

    // Slab: a real 55 mm thick top with a rounded front arris, sat proud of
    // the frame so the edge catches light and reads as thickness.
    const top = G.mesh(new THREE.BoxGeometry(W, slab, D), woodTop, {
      pos: [0, topY - slab / 2, centerZ], parent: this.root,
    });
    top.geometry.userData.shared = false;
    top.receiveShadow = true;

    // Apron rails and legs.
    G.mesh(G.box(W - 0.06, 0.14, 0.04, 0.006), woodBody, { pos: [0, topY - 0.13, centerZ + D / 2 - 0.03], parent: this.root });
    G.mesh(G.box(W - 0.06, 0.14, 0.04, 0.006), woodBody, { pos: [0, topY - 0.13, centerZ - D / 2 + 0.03], parent: this.root });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        G.mesh(G.box(0.07, topY - slab, 0.07, 0.006), dark, {
          pos: [sx * (W / 2 - 0.07), (topY - slab) / 2, centerZ + sz * (D / 2 - 0.07)], parent: this.root,
        });
      }
    }

    // Front skirt boards facing the street, with a painted price panel.
    const skirt = G.mesh(G.box(W, 0.52, 0.028, 0.004), M.paintedWood(0x2f5d55, 9), {
      pos: [0, topY - 0.42, centerZ + D / 2 - 0.005], parent: this.root,
    });
    skirt.receiveShadow = true;
    const signTex = TEX.label({
      w: 512, h: 128, bg: 'rgba(0,0,0,0)',
      lines: [
        { text: 'MERCADO  ·  FRESCO', size: 44, color: '#f2e2bd', y: 50 },
        { text: 'アペティート食堂', size: 30, color: '#d9c08a', y: 96 },
      ],
      grain: 0.06,
    });
    G.mesh(G.plane(1.1, 0.26), new THREE.MeshStandardMaterial({
      map: signTex, transparent: true, roughness: 0.9, metalness: 0,
    }), { pos: [0, topY - 0.36, centerZ + D / 2 + 0.012], parent: this.root, cast: false });

    // Under-counter shelf with stock: reads through the leg gaps and adds
    // occlusion depth right where the counter meets the ground.
    const shelfY = 0.3;
    G.mesh(G.box(W - 0.2, 0.03, D - 0.22, 0.004), woodBody, { pos: [0, shelfY, centerZ], parent: this.root });
    for (let i = 0; i < 3; i++) {
      const c = G.crate(0.34, 0.22, 0.28, M.crateWood(0), M.darkWood(), 2);
      c.position.set(-0.45 + i * 0.45, shelfY + 0.13, centerZ + rng.range(-0.05, 0.05));
      c.rotation.y = rng.range(-0.14, 0.14);
      this.root.add(G.freeze(c));
    }
    // Sack of flour slumped against a leg — soft mass against hard timber.
    const sack = G.mesh(G.blob(0.14, 1.0, 1.25, 0.85, 14), M.sackcloth(), {
      pos: [W / 2 - 0.22, 0.17, centerZ + 0.22], rot: [0.1, 0.4, 0.08], parent: this.root,
    });
    sack.scale.set(1, 1, 1);
  }

  // ------------------------------------------------------------ tray ----
  _tray() {
    const w = BOARD.cols * BOARD.cell, d = BOARD.rows * BOARD.cell;
    const rim = 0.014, th = 0.018;
    const y = BOARD.surfaceY;
    const trayWood = M.counterWood();

    // Board with a lip: the lip is what makes items feel contained and gives
    // the grid a physical boundary instead of a painted one.
    const base = G.mesh(new THREE.BoxGeometry(w + rim * 2, th, d + rim * 2), trayWood, {
      pos: [BOARD.centerX, y - th / 2, BOARD.centerZ], parent: this.root,
    });
    base.geometry.userData.shared = false;
    base.receiveShadow = true;

    for (const [sx, sz, lw, ld] of [
      [0, -(d / 2 + rim / 2), w + rim * 2, rim],
      [0, (d / 2 + rim / 2), w + rim * 2, rim],
      [-(w / 2 + rim / 2), 0, rim, d + rim * 2],
      [(w / 2 + rim / 2), 0, rim, d + rim * 2],
    ]) {
      const bar = G.mesh(new THREE.BoxGeometry(lw, 0.012, ld), M.darkWood(), {
        pos: [BOARD.centerX + sx, y + 0.005, BOARD.centerZ + sz], parent: this.root,
      });
      bar.geometry.userData.shared = false;
    }

    // Knife-scored grid, barely there: guidance without UI overlay.
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x2a1c10, transparent: true, opacity: 0.16, depthWrite: false,
    });
    const grid = new THREE.Group();
    for (let c = 1; c < BOARD.cols; c++) {
      const p = cellPos(c, 0);
      G.mesh(G.plane(0.0025, d), lineMat, {
        pos: [p.x - BOARD.cell / 2, y + 0.0012, BOARD.centerZ], rot: [-Math.PI / 2, 0, 0],
        cast: false, receive: false, parent: grid,
      });
    }
    for (let r = 1; r < BOARD.rows; r++) {
      const p = cellPos(0, r);
      G.mesh(G.plane(w, 0.0025), lineMat, {
        pos: [BOARD.centerX, y + 0.0012, p.z - BOARD.cell / 2], rot: [-Math.PI / 2, 0, 0],
        cast: false, receive: false, parent: grid,
      });
    }
    this.root.add(grid);

    // Cut marks and stains on the working surface.
    const stainMat = new THREE.MeshBasicMaterial({
      color: 0x3a2413, transparent: true, opacity: 0.2, depthWrite: false,
      alphaMap: TEX.radialFalloff(1.6),
    });
    const rng = makeRng(88);
    for (let i = 0; i < 7; i++) {
      G.mesh(G.plane(rng.range(0.05, 0.13), rng.range(0.05, 0.13)), stainMat, {
        pos: [BOARD.centerX + rng.range(-w / 2, w / 2), y + 0.0014, BOARD.centerZ + rng.range(-d / 2, d / 2)],
        rot: [-Math.PI / 2, 0, rng.range(0, 3.14)], cast: false, receive: false, parent: this.root,
      });
    }
  }

  // ---------------------------------------------------------- awning ----
  _awning(dest, rng) {
    const g = new THREE.Group();
    const post = M.darkWood();
    const h = 2.06;
    const W = COUNTER.width;

    for (const sx of [-1, 1]) {
      G.mesh(G.box(0.055, h, 0.055, 0.006), post, {
        pos: [sx * (W / 2 - 0.04), h / 2, COUNTER.centerZ + 0.42], parent: g,
      });
      G.mesh(G.box(0.055, h + 0.28, 0.055, 0.006), post, {
        pos: [sx * (W / 2 - 0.04), (h + 0.28) / 2, COUNTER.centerZ - 0.5], parent: g,
      });
      // Diagonal brace: a real triangle, so the structure looks like it stands up.
      const brace = G.mesh(G.box(0.04, 0.62, 0.04, 0.005), post, {
        pos: [sx * (W / 2 - 0.06), h - 0.22, COUNTER.centerZ + 0.16], parent: g,
      });
      brace.rotation.x = 0.72;
    }
    // Ridge and front beams.
    G.mesh(G.box(W, 0.06, 0.06, 0.008), post, { pos: [0, h + 0.26, COUNTER.centerZ - 0.5], parent: g });
    G.mesh(G.box(W, 0.05, 0.05, 0.008), post, { pos: [0, h, COUNTER.centerZ + 0.42], parent: g });

    // Fabric covers the back half only: the front of the tray keeps direct
    // sun, the back sits in warm shade. That light gradient does more for
    // depth on the board than any amount of extra geometry.
    const cloth = new THREE.Mesh(
      G.draped(W + 0.14, 0.98, 0.055, 0.02, 20),
      M.awning(dest.awning.a, dest.awning.b, 7),
    );
    cloth.position.set(0, h + 0.14, COUNTER.centerZ - 0.06);
    cloth.rotation.x = -Math.PI / 2 + 0.26;
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    g.add(cloth);
    this.animated.push({ kind: 'awning', obj: cloth, base: cloth.rotation.x, phase: 0 });

    // Scalloped valance hanging off the front beam.
    const val = new THREE.Mesh(G.draped(W + 0.1, 0.17, 0.01, 0.006, 18), M.awning(dest.awning.a, dest.awning.b, 7));
    val.position.set(0, h + 0.16, COUNTER.centerZ - 0.53);
    val.rotation.x = -0.06;
    val.castShadow = true;
    g.add(val);

    this.root.add(g);
    this.awning = g;
  }

  // -------------------------------------------------------- work lamp ----
  _workLamp(dest) {
    const g = new THREE.Group();
    // Hung off-centre and high, so it lights the tray without sitting in the
    // middle of the view down the street.
    const y = 1.84, x = -0.36, z = COUNTER.centerZ - 0.1;
    const cord = G.mesh(G.cyl(0.004, 0.004, 0.4, 6), M.iron(), {
      pos: [x, y + 0.26, z], parent: g, cast: false,
    });
    // Enamelled tin shade — the classic market lamp.
    const shade = G.mesh(
      G.lathe([[0.02, 0.12], [0.03, 0.115], [0.16, 0.0], [0.165, -0.004], [0.155, -0.004], [0.022, 0.108], [0.018, 0.115]], 24),
      new THREE.MeshStandardMaterial({ color: 0x2b4f47, roughness: 0.42, metalness: 0.15, side: THREE.DoubleSide }),
      { pos: [x, y, z], parent: g },
    );
    const bulb = G.mesh(G.sphere(0.022, 10), M.emissive(0xffe0b0, 4.0), {
      pos: [x, y + 0.03, z], parent: g, cast: false, receive: false,
    });
    const glow = new THREE.Sprite(M.halo(0xffd9a8, 0.5));
    glow.position.set(x, y + 0.02, z);
    glow.scale.setScalar(0.34);
    g.add(glow);

    // The only shadow-casting local light: it is directly over the tray, so
    // every ingredient gets a short, sharp contact shadow and reads as sitting
    // on the wood rather than floating above it.
    // Intensity is candela with inverse-square decay: over the ~0.95 m throw
    // down to the tray this lands around 1.7 — a warm pool, not a floodlight.
    const spot = new THREE.SpotLight(0xffd9a8, 1.55, 4.2, Math.PI * 0.44, 0.55, 2);
    spot.position.set(x, y + 0.02, z);
    spot.target.position.set(0, BOARD.surfaceY, BOARD.centerZ);
    spot.castShadow = true;
    spot.shadow.mapSize.set(this.view.shadowSize, this.view.shadowSize);
    spot.shadow.camera.near = 0.15;
    spot.shadow.camera.far = 3.2;
    spot.shadow.bias = -0.0009;
    spot.shadow.normalBias = 0.006;
    spot.shadow.radius = 2.6;
    g.add(spot, spot.target);
    this.lamp = spot;
    this.lampBulb = bulb;
    this.animated.push({ kind: 'lamp', obj: spot, base: spot.intensity, phase: 1.3 });

    this.root.add(g);
  }

  // ----------------------------------------------------------- props ----
  _props(dest, rng) {
    const { topY, width: W, depth: D, centerZ } = COUNTER;
    const y = topY;

    // Brass balance scale, back right — tall, glinting, breaks the horizon of
    // the counter and reads instantly as "market".
    const scale = new THREE.Group();
    G.mesh(G.cyl(0.075, 0.085, 0.018, 18), M.brass(true), { pos: [0, 0.009, 0], parent: scale });
    G.mesh(G.cyl(0.011, 0.013, 0.3, 10), M.brass(), { pos: [0, 0.16, 0], parent: scale });
    G.mesh(G.box(0.24, 0.012, 0.012, 0.004), M.brass(), { pos: [0, 0.31, 0], parent: scale });
    for (const sx of [-1, 1]) {
      G.mesh(G.lathe([[0.001, 0], [0.055, 0.012], [0.058, 0.02], [0.054, 0.02], [0.05, 0.012], [0.001, 0]], 18),
        M.brass(), { pos: [sx * 0.11, 0.245, 0], parent: scale });
      for (const a of [0, Math.PI * 0.66, Math.PI * 1.33]) {
        const wire = G.mesh(G.cyl(0.0016, 0.0016, 0.068, 4), M.brass(true), {
          pos: [sx * 0.11 + Math.cos(a) * 0.024, 0.278, Math.sin(a) * 0.024], parent: scale, cast: false,
        });
        wire.rotation.z = Math.cos(a) * 0.34;
        wire.rotation.x = -Math.sin(a) * 0.34;
      }
    }
    // Lemons in the left pan: gives the scale a reason to exist.
    for (let i = 0; i < 3; i++) {
      G.mesh(G.blob(0.022, 1, 0.82, 1, 10), M.food(0xe8c53a, { rough: 0.44, clearcoat: 0.25 }), {
        pos: [-0.11 + rng.range(-0.02, 0.02), 0.262, rng.range(-0.02, 0.02)], parent: scale,
      });
    }
    scale.position.set(-W / 2 + 0.19, y, centerZ - D / 2 + 0.17);
    scale.rotation.y = 0.5;
    this.root.add(G.freeze(scale));

    // Chopping board + knife, front right of the tray.
    const board = G.mesh(G.box(0.3, 0.022, 0.2, 0.006), M.crateWood(2), {
      pos: [W / 2 - 0.24, y + 0.011, centerZ + 0.3], rot: [0, -0.28, 0], parent: this.root,
    });
    const knife = new THREE.Group();
    G.mesh(G.box(0.14, 0.0035, 0.035, 0.001), M.steel(0.22), { pos: [0, 0, 0], parent: knife });
    G.mesh(G.box(0.075, 0.016, 0.022, 0.005), M.darkWood(), { pos: [0.105, 0.004, 0], parent: knife });
    knife.position.set(W / 2 - 0.26, y + 0.024, centerZ + 0.31);
    knife.rotation.y = -0.28 + 0.5;
    this.root.add(G.freeze(knife));
    // Chopped herbs on the board.
    for (let i = 0; i < 14; i++) {
      G.mesh(G.box(0.008, 0.002, 0.006, 0.0005), M.leaf(0x4e7a2e), {
        pos: [W / 2 - 0.3 + rng.range(-0.04, 0.04), y + 0.024, centerZ + 0.28 + rng.range(-0.03, 0.03)],
        rot: [0, rng.range(0, 3.14), 0], parent: this.root,
      });
    }

    // Stack of plates, left front — clean ceramic against all that wood.
    const plates = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      G.mesh(G.lathe([[0.001, 0], [0.055, 0.002], [0.062, 0.009], [0.064, 0.011], [0.058, 0.011], [0.05, 0.004], [0.001, 0.003]], 22),
        M.ceramic(0xf5f0e6), { pos: [rng.range(-0.002, 0.002), i * 0.011, rng.range(-0.002, 0.002)], parent: plates });
    }
    plates.position.set(-W / 2 + 0.15, y, centerZ + 0.32);
    this.root.add(G.freeze(plates));

    // Herb pot at the back edge, catching rim light from the sun.
    const pot = new THREE.Group();
    G.mesh(G.lathe([[0.001, 0], [0.042, 0], [0.048, 0.012], [0.055, 0.085], [0.06, 0.092], [0.055, 0.092], [0.05, 0.012], [0.001, 0.012]], 18),
      M.terracotta(0xb26240), { parent: pot });
    G.mesh(G.cyl(0.05, 0.05, 0.008, 14), new THREE.MeshStandardMaterial({ color: 0x36291d, roughness: 1 }),
      { pos: [0, 0.09, 0], parent: pot });
    for (let i = 0; i < 22; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(0, 0.04);
      const leaf = G.mesh(G.plane(0.022, 0.05), M.leaf(0x3f6b2a), {
        pos: [Math.cos(a) * r, 0.115 + rng.range(0, 0.06), Math.sin(a) * r],
        rot: [rng.range(-0.9, -0.2), a, rng.range(-0.4, 0.4)], parent: pot,
      });
      leaf.material.side = THREE.DoubleSide;
    }
    pot.position.set(W / 2 - 0.17, y, centerZ - D / 2 + 0.15);
    this.root.add(G.freeze(pot));

    // Coin bowl — where deliveries pay out.
    const bowl = G.mesh(
      G.lathe([[0.001, 0], [0.03, 0.0], [0.052, 0.028], [0.056, 0.036], [0.05, 0.036], [0.046, 0.028], [0.026, 0.004], [0.001, 0.004]], 20),
      M.ceramic(0x2f4f5c, 0.3), { pos: [-W / 2 + 0.36, y, centerZ + 0.3], parent: this.root });
    this.coinBowl = bowl;
    for (let i = 0; i < 6; i++) {
      G.mesh(G.cyl(0.011, 0.011, 0.0022, 12), M.brass(), {
        pos: [-W / 2 + 0.36 + rng.range(-0.02, 0.02), y + 0.012 + i * 0.001, centerZ + 0.3 + rng.range(-0.02, 0.02)],
        rot: [rng.range(-0.2, 0.2), rng.range(0, 3), rng.range(-0.2, 0.2)], parent: this.root,
      });
    }

    // Chalkboard menu leaning against the left post.
    const chalk = TEX.label({
      w: 384, h: 512, bg: '#22282a',
      lines: [
        { text: 'HOY / 本日', size: 46, color: '#f0e6cf', y: 66 },
        { text: '— — — — —', size: 28, color: '#9fb0a8', y: 112 },
        { text: 'トマトのソース', size: 34, color: '#e8dcc0', y: 176 },
        { text: 'パン・デ・カサ', size: 34, color: '#e8dcc0', y: 232 },
        { text: '本日の焼き魚', size: 34, color: '#e8dcc0', y: 288 },
        { text: 'レモネード', size: 34, color: '#e8dcc0', y: 344 },
        { text: '★ 旅の味 ★', size: 30, color: '#dcc98a', y: 424 },
      ],
      border: '#6b5a3a', grain: 0.12,
    });
    const cb = new THREE.Group();
    G.mesh(G.box(0.34, 0.46, 0.02, 0.004), M.darkWood(), { pos: [0, 0.23, 0], parent: cb });
    G.mesh(G.plane(0.3, 0.42), new THREE.MeshStandardMaterial({ map: chalk, roughness: 0.95 }),
      { pos: [0, 0.23, 0.011], parent: cb });
    cb.position.set(-W / 2 - 0.09, 0.0, centerZ + 0.1);
    cb.rotation.set(0.14, 0.42, 0.0);
    cb.position.y = 0.0;
    this.root.add(G.freeze(cb));

    // Jar shelf on the back-left post: silhouette clutter at customer height.
    const shelf = new THREE.Group();
    G.mesh(G.box(0.46, 0.022, 0.13, 0.004), M.crateWood(0), { pos: [0, 0, 0], parent: shelf });
    const jarCols = [0xc4552f, 0x8a6b2f, 0x4f6b3a, 0x7a3f5c];
    for (let i = 0; i < 4; i++) {
      const jg = new THREE.Group();
      const hgt = rng.range(0.07, 0.11);
      G.mesh(G.lathe([[0.001, 0], [0.028, 0], [0.032, 0.008], [0.032, hgt - 0.02], [0.024, hgt], [0.024, hgt + 0.012], [0.021, hgt + 0.012], [0.021, hgt - 0.004], [0.029, hgt - 0.024], [0.029, 0.008], [0.001, 0.006]], 16),
        M.glass(0xdfe8dd, true), { parent: jg, cast: true });
      G.mesh(G.cyl(0.026, 0.026, 0.012, 14), M.brass(true), { pos: [0, hgt + 0.014, 0], parent: jg });
      G.mesh(G.cyl(0.026, 0.026, hgt * 0.72, 14), M.food(jarCols[i], { rough: 0.6 }), { pos: [0, hgt * 0.4, 0], parent: jg });
      jg.position.set(-0.17 + i * 0.115, 0.011, rng.range(-0.02, 0.02));
      shelf.add(jg);
    }
    shelf.position.set(-W / 2 + 0.06, 1.42, centerZ - 0.48);
    shelf.rotation.y = 0.1;
    this.root.add(G.freeze(shelf));
  }

  // ------------------------------------------------------ foreground ----
  _foreground(dest, rng) {
    // Objects between the camera and the counter. They are large in frame,
    // dark, and mostly out of the play area — pure depth framing.
    const left = new THREE.Group();
    const c1 = G.crate(0.42, 0.3, 0.34, M.crateWood(0), M.darkWood(), 3);
    c1.position.set(0, 0.15, 0);
    const c2 = G.crate(0.4, 0.28, 0.32, M.crateWood(2), M.darkWood(), 3);
    c2.position.set(0.03, 0.44, -0.02);
    c2.rotation.y = 0.16;
    left.add(c1, c2);
    // Oranges spilling out of the top crate.
    for (let i = 0; i < 9; i++) {
      G.mesh(G.sphere(0.036, 12), M.food(0xe07f22, { rough: 0.5, clearcoat: 0.2, seed: 3 }), {
        pos: [rng.range(-0.13, 0.13), 0.6 + rng.range(0, 0.05), rng.range(-0.1, 0.1)], parent: left,
      });
    }
    left.position.set(-1.0, 0, COUNTER.centerZ + 0.72);
    left.rotation.y = 0.34;
    this.root.add(G.freeze(left));

    // Right: stacked sacks and a leaning broom.
    const right = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = G.mesh(G.blob(0.19, 1, 0.72, 0.9, 14), M.sackcloth(i === 1 ? 0xbfa47c : 0xcbb187), {
        pos: [rng.range(-0.04, 0.04), 0.13 + i * 0.2, rng.range(-0.04, 0.04)],
        rot: [rng.range(-0.1, 0.1), rng.range(0, 3), rng.range(-0.1, 0.1)], parent: right,
      });
      s.scale.set(1, 1, 1);
    }
    const broom = new THREE.Group();
    G.mesh(G.cyl(0.012, 0.014, 1.25, 8), M.crateWood(1), { pos: [0, 0.62, 0], parent: broom });
    G.mesh(G.box(0.22, 0.05, 0.06, 0.01), M.darkWood(), { pos: [0, 0.05, 0], parent: broom });
    for (let i = 0; i < 16; i++) {
      G.mesh(G.cyl(0.0025, 0.0025, 0.09, 4), M.sackcloth(0xb99a63), {
        pos: [-0.1 + (i / 15) * 0.2, -0.01, rng.range(-0.02, 0.02)], parent: broom, cast: false,
      });
    }
    broom.position.set(0.34, 0, 0.06);
    broom.rotation.set(0.2, 0, 0.26);
    right.add(broom);
    right.position.set(1.02, 0, COUNTER.centerZ + 0.66);
    right.rotation.y = -0.3;
    this.root.add(G.freeze(right));

    // Chilli / garlic braid hanging off the front-left awning post, swinging
    // slowly in the breeze right in front of the lens.
    const braid = new THREE.Group();
    const rope = G.mesh(G.cyl(0.006, 0.006, 0.12, 6), M.sackcloth(0xa8925f), { pos: [0, -0.06, 0], parent: braid });
    const chilliMat = M.food(dest.id === 'kyoto' ? 0xd8552f : 0xc0332a, { rough: 0.34, clearcoat: 0.5 });
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const a = i * 2.4;
      const ch = G.mesh(G.capsule(0.008, 0.038, 8), chilliMat, {
        pos: [Math.cos(a) * 0.026, -0.12 - t * 0.24, Math.sin(a) * 0.026],
        rot: [rng.range(-0.3, 0.3), a, rng.range(-0.25, 0.25)], parent: braid,
      });
      ch.scale.set(1, 1, 1);
    }
    // Hung low off the front beam so it hangs into the corner of the lens —
    // a near-layer object the camera has to look past.
    braid.position.set(-0.70, 1.74, COUNTER.centerZ + 0.44);
    const frozenBraid = G.freeze(braid);
    this.root.add(frozenBraid);
    this.animated.push({ kind: 'swing', obj: frozenBraid, phase: 0.4, amp: 0.05 });
  }

  update(dt, t) {
    for (const a of this.animated) {
      if (a.kind === 'swing') {
        a.obj.rotation.z = Math.sin(t * 0.7 + a.phase) * a.amp;
        a.obj.rotation.x = Math.sin(t * 0.53 + a.phase * 2) * a.amp * 0.6;
      } else if (a.kind === 'awning') {
        // Canvas breathing in the wind — a couple of degrees, no more.
        a.obj.rotation.x = a.base + Math.sin(t * 0.9) * 0.012 + Math.sin(t * 1.7) * 0.006;
      } else if (a.kind === 'lamp') {
        a.obj.intensity = a.base * (1 + Math.sin(t * 3.1 + a.phase) * 0.018);
      }
    }
  }
}
