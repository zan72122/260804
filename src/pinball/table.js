// The table: one layout description, used for both the physics colliders and
// the 3-D geometry, so what you see is exactly what the ball hits.
//
// Table space is (u, v): u across the table, v up the slope from the drain at
// v = 0 to the top arc. The whole thing is a group tilted about X, hinged at
// the near edge of the counter, so the back of the playfield rises the way a
// real cabinet does and the counter top stays where it always was.

import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as G from '../engine/geo.js';
import * as TEX from '../engine/textures.js';
import { COUNTER } from '../game/config.js';

export const TABLE = {
  width: 1.50,          // outer slab
  depth: 0.92,
  halfPlay: 0.71,       // inner playfield half-width
  tilt: 7 * Math.PI / 180,
  ballR: 0.033,
  wallH: 0.058,

  // Launch lane, right-hand side.
  laneU: [0.555, 0.71],
  laneTop: 0.68,
  plungerRest: 0.045,
  plungerPull: 0.040,   // stays above the drain line even fully drawn
  launchMin: 2.0,
  launchMax: 4.3,

  // pivotU is set so the gap between the flipper tips clears the ball with
  // room to spare: tips at ±0.07 leave 102 mm between the rubbers for a 66 mm
  // ball. Any narrower and the ball simply rests on both tips and the drain
  // stops being a drain.
  flipper: { length: 0.15, radius: 0.019, pivotU: 0.20, pivotV: 0.13, rest: 0.52, swing: 0.56 },
};

TABLE.laneCentre = (TABLE.laneU[0] + TABLE.laneU[1]) / 2;
TABLE.gravity = 9.81 * Math.sin(TABLE.tilt);     // ≈ 1.20 m/s² down the slope
TABLE.nearZ = COUNTER.centerZ + TABLE.depth / 2; // world z of the hinge edge

/**
 * Per-city dressing. The table is the same table everywhere — same geometry,
 * same physics — but a stall in Kyoto does not paint its slingshots Lisbon
 * red. Only the painted and printed parts move; the wood stays wood.
 */
const SKIN = {
  lisbon: {
    sling: 0xc4452f, paint: 0xf0dcae, broth: 0xb8341f,
    sign: '#2b3230', ink: '#f0e2bd', edge: '#8a6a3a',
  },
  kyoto: {
    sling: 0x2f4f45, paint: 0xdfe6e2, broth: 0x8a5a1e,
    sign: '#1d2622', ink: '#e9efe6', edge: '#6f8a72',
  },
  marrakech: {
    sling: 0x1f6f77, paint: 0xf3d9a0, broth: 0xc0651e,
    sign: '#2a1c12', ink: '#f6dfae', edge: '#c08a3a',
  },
};

/** Sample an elliptical arc, used for the top of the playfield. */
function arc(cx, cy, rx, ry, a0, a1, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Static walls, as polylines in table space. */
export function layout() {
  const H = TABLE.halfPlay;
  const [laneIn, laneOut] = TABLE.laneU;
  const F = TABLE.flipper;

  return {
    // Outer rails and the dome across the top.
    rails: [
      { pts: [[-H, 0.02], [-H, 0.72]], tag: 'rail' },
      { pts: arc(0, 0.72, H, 0.17, Math.PI, 0, 16), tag: 'rail' },
      { pts: [[laneOut, 0.03], [laneOut, 0.74]], tag: 'rail' },
    ],
    // Launch lane: divider, floor, and the one-way gate at the exit.
    lane: [
      { pts: [[laneIn, 0.03], [laneIn, TABLE.laneTop]], tag: 'lane' },
      { pts: [[laneIn, 0.03], [laneOut, 0.03]], tag: 'lane' },
    ],
    gate: { p0: [laneIn, TABLE.laneTop], p1: [laneOut, 0.735], tag: 'gate' },
    // The bottom of the table, in two pieces a side.
    //
    // The guide brings the ball down from the rail and stops short. Below it
    // the slingshot carries on to the flipper, and it ends exactly on the
    // pivot, not short of it: any notch left between wall and pivot boss is
    // narrower than the ball, and a ball that rolls into one wedges there for
    // good. Ending on the pivot leaves a continuous surface — down the wall,
    // over the boss, onto the bat.
    //
    // The gap between guide and sling is the outlane. A ball with pace crosses
    // it and comes back to the flipper; a slow one drops through into the open
    // corner, where nothing is holding it above the drain line, and is lost.
    // The mouth is 84 mm across for a 66 mm ball — a real threat rather than a
    // coin flip, and the reason the nudge keys and the slingshots exist.
    inlanes: [
      { pts: [[-H, 0.36], [-0.435, 0.263]], tag: 'inlane' },
      { pts: [[laneIn, 0.36], [0.435, 0.263]], tag: 'inlane' },
    ],
    slings: [
      { pts: [[-0.362, 0.222], [-F.pivotU, F.pivotV]], tag: 'sling' },
      { pts: [[0.362, 0.222], [F.pivotU, F.pivotV]], tag: 'sling' },
    ],

    // Pots hanging over the fire: pop bumpers that also put heat into
    // whatever hits them. They sit where a launched ball arrives, but pushed
    // off the centre line — one of them used to stand directly under the
    // delivery chute and screen the one shot the whole game ends on. The lane
    // left between them is 222 mm wide against a 66 mm ball, so a decent
    // centre shot runs straight up into the chute funnel.
    bumpers: [
      { u: -0.30, v: 0.60, r: 0.056 },
      { u: -0.19, v: 0.73, r: 0.056 },
      { u: 0.21, v: 0.62, r: 0.056 },
    ],

    // Preserve jars standing in a row on the left. Knock all five down and
    // the oven roars: every ball on the table gets hot at once.
    targets: [
      { u: -0.615, v: 0.36, r: 0.026 },
      { u: -0.615, v: 0.44, r: 0.026 },
      { u: -0.615, v: 0.52, r: 0.026 },
      { u: -0.615, v: 0.60, r: 0.026 },
      { u: -0.615, v: 0.68, r: 0.026 },
    ],

    // Sensors. The whisk spins as a ball passes — it sits out in the open
    // field rather than up against the arc, where a ball would rattle in the
    // pocket and ring it over and over. The stew pot swallows a ball and gives
    // it back cooked; the chute at the top is where dishes leave the table.
    spinner: { u: -0.42, v: 0.46, r: 0.05 },
    pot: { u: 0.33, v: 0.72, r: 0.052 },
    chute: { u: 0.0, v: 0.845, r: 0.055 },

    // The cheeks of the delivery chute, as real walls. They used to be drawn
    // and not collided with, which broke this file's one rule — and made the
    // shot the whole game ends on land in 1 attempt out of 54, because the
    // mouth was a bare 110 mm target at the top of the table. As a funnel,
    // 350 mm wide at the bottom, a decent centre shot is gathered into it.
    chuteWalls: [
      { pts: [[-0.175, 0.755], [-0.062, 0.862]], tag: 'chutewall' },
      { pts: [[0.175, 0.755], [0.062, 0.862]], tag: 'chutewall' },
    ],
  };
}

export class Table {
  constructor(view) {
    this.view = view;
    this.group = new THREE.Group();
    this.group.position.set(0, COUNTER.topY, TABLE.nearZ);
    this.group.rotation.x = TABLE.tilt;
    this.group.visible = false;
    view.scene.add(this.group);
    this.flipperMeshes = [];
    this._v = new THREE.Vector3();
  }

  /** Table space → world. h is the height above the playfield surface. */
  toWorld(u, v, h = 0, out = new THREE.Vector3()) {
    out.set(u, h, -v);
    return this.group.localToWorld(out);
  }

  /** Build colliders into `world` and the matching geometry into the group. */
  build(world, dest) {
    for (const c of [...this.group.children]) this.group.remove(c);
    this.flipperMeshes.length = 0;
    this._stains = [];
    world.clearStatics();

    const L = layout();
    // paintedWood bakes the colour into its texture and caches by key, so the
    // dressing is not readable off the materials afterwards. Keep it here.
    const sk = SKIN[dest?.id] ?? SKIN.lisbon;
    this.skin = sk;
    const wood = M.counterWood();
    const rail = M.darkWood();
    const brass = M.brass();

    // ---- playfield ------------------------------------------------------
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.width, 0.022, TABLE.depth),
      wood,
    );
    slab.position.set(0, -0.011, -TABLE.depth / 2);
    slab.receiveShadow = true;
    slab.castShadow = true;
    this.group.add(slab);

    // Painted lane markings: cheap, and they tell you where the ball will go.
    const paint = new THREE.MeshStandardMaterial({
      color: sk.paint, roughness: 0.7, transparent: true, opacity: 0.35, depthWrite: false,
    });
    // Two strokes a side: the line the ball takes to the flipper, and the one
    // it takes out of the game. Painting the outlane is the only warning the
    // player gets that the corner past the sling is not a wall.
    for (const [u0, v0, u1, v1] of [
      [-0.60, 0.315, -0.30, 0.155], [0.60, 0.315, 0.30, 0.155],
      [-0.50, 0.235, -0.60, 0.055], [0.50, 0.235, 0.60, 0.055],
    ]) {
      const len = Math.hypot(u1 - u0, v1 - v0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.012), paint);
      m.position.set((u0 + u1) / 2, 0.0012, -(v0 + v1) / 2);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(v1 - v0, u1 - u0);
      this.group.add(m);
    }

    // ---- walls ----------------------------------------------------------
    const addWalls = (list, opts, mat) => {
      for (const { pts, tag } of list) {
        world.addPolyline(pts, { ...opts, tag });
        for (let i = 0; i < pts.length - 1; i++) this._rail(pts[i], pts[i + 1], mat);
      }
    };
    addWalls(L.rails, { restitution: 0.45, friction: 1.2 }, rail);
    addWalls(L.lane, { restitution: 0.3, friction: 2.5 }, rail);
    addWalls(L.inlanes, { restitution: 0.35, friction: 2.0 }, M.crateWood(1));
    // Slingshots: the same funnel wall, but sprung. kickMin is the switch — a
    // ball rolling along the rubber must not get a free shove every pass.
    addWalls(L.slings, { restitution: 0.5, friction: 1.5, kick: 1.15, kickMin: 0.45 },
      M.paintedWood(sk.sling, 4));

    // One-way gate: the ball leaves the lane through it and can never fall back in.
    world.addSegment(L.gate.p0[0], L.gate.p0[1], L.gate.p1[0], L.gate.p1[1], {
      restitution: 0.2, friction: 3, tag: 'gate', oneWay: 1,
    });
    this._rail(L.gate.p0, L.gate.p1, brass, 0.03);

    // ---- pop bumpers ----------------------------------------------------
    this.bumpers = [];
    for (const b of L.bumpers) {
      const post = world.addPost(b.u, b.v, b.r, {
        restitution: 0.45, kick: 1.5, kickMin: 0.35, tag: 'bumper',
      });
      const g = new THREE.Group();
      g.position.set(b.u, 0, -b.v);
      // A copper pot on a ring stand: the ball hits the belly and is thrown off.
      G.mesh(G.torus(b.r, 0.008, 20, 6), M.iron(), { pos: [0, 0.004, 0], rot: [Math.PI / 2, 0, 0], parent: g });
      G.mesh(G.lathe([
        [0.001, 0.006], [b.r * 0.72, 0.008], [b.r * 0.95, 0.03], [b.r, 0.055],
        [b.r * 1.02, 0.062], [b.r * 0.96, 0.062], [b.r * 0.94, 0.03], [b.r * 0.68, 0.012], [0.001, 0.012],
      ], 22), M.brass(), { pos: [0, 0, 0], parent: g });
      G.mesh(G.cyl(b.r * 0.9, b.r * 0.9, 0.006, 20), M.food(sk.broth, { rough: 0.4, clearcoat: 0.5 }),
        { pos: [0, 0.05, 0], parent: g, cast: false });
      // Glow under the pot: the fire it sits on, and the hit flash. Cloned per
      // bumper, since the flash writes opacity and the library copy is shared.
      const glow = new THREE.Sprite(M.halo(0xff9a3c, 0.7).clone());
      glow.scale.setScalar(b.r * 3);
      glow.position.set(0, 0.03, 0);
      g.add(glow);
      this.group.add(g);
      this.bumpers.push({ post, g, glow, flash: 0, baseY: 0 });
    }

    // ---- drop targets ---------------------------------------------------
    this.targets = [];
    L.targets.forEach((t, i) => {
      const post = world.addPost(t.u, t.v, t.r, { restitution: 0.3, tag: 'target', index: i });
      const g = new THREE.Group();
      g.position.set(t.u, 0, -t.v);
      const h = 0.075;
      G.mesh(G.lathe([
        [0.001, 0], [t.r * 0.9, 0], [t.r, 0.008], [t.r, h - 0.016], [t.r * 0.72, h - 0.004],
        [t.r * 0.72, h], [t.r * 0.62, h], [t.r * 0.62, h - 0.006], [t.r * 0.9, h - 0.018],
        [t.r * 0.9, 0.008], [0.001, 0.006],
      ], 16), M.glass(0xdfe8dd), { parent: g });
      G.mesh(G.cyl(t.r * 0.78, t.r * 0.78, 0.008, 14), M.brass(true), { pos: [0, h + 0.002, 0], parent: g });
      G.mesh(G.cyl(t.r * 0.86, t.r * 0.86, h * 0.6, 14),
        M.food([0xc4552f, 0x8a6b2f, 0x4f6b3a, 0x7a3f5c, 0xb2603c][i % 5], { rough: 0.6 }),
        { pos: [0, h * 0.32, 0], parent: g });
      this.group.add(g);
      this.targets.push({ post, g, down: 0 });
    });

    // ---- spinner --------------------------------------------------------
    world.addSensor(L.spinner.u, L.spinner.v, L.spinner.r, { tag: 'spinner' });
    this.spinnerAt = L.spinner;
    const wh = new THREE.Group();
    wh.position.set(L.spinner.u, 0.03, -L.spinner.v);
    G.mesh(G.cyl(0.006, 0.006, 0.05, 8), M.steel(0.3), { pos: [0, 0.03, 0], parent: wh });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const wire = G.mesh(G.torus(0.02, 0.0018, 12, 4, Math.PI), M.steel(0.35), {
        pos: [0, 0.005, 0], rot: [0, a, 0], parent: wh,
      });
      wire.rotation.z = Math.PI / 2;
    }
    this.group.add(wh);
    this.spinnerMesh = wh;
    this.spinnerSpin = 0;

    // ---- stew pot (swallows a ball, gives it back cooked) ---------------
    world.addSensor(L.pot.u, L.pot.v, L.pot.r, { tag: 'pot' });
    const pot = new THREE.Group();
    pot.position.set(L.pot.u, 0, -L.pot.v);
    G.mesh(G.lathe([
      [0.001, 0], [L.pot.r * 0.9, 0], [L.pot.r, 0.012], [L.pot.r * 1.04, 0.05],
      [L.pot.r * 1.08, 0.056], [L.pot.r * 0.98, 0.056], [L.pot.r * 0.94, 0.012], [0.001, 0.01],
    ], 22), M.iron(), { parent: pot });
    G.mesh(G.cyl(L.pot.r * 0.9, L.pot.r * 0.9, 0.004, 20),
      M.food(0x6b3a1c, { rough: 0.35, clearcoat: 0.5 }), { pos: [0, 0.02, 0], parent: pot, cast: false });
    const potGlow = new THREE.Sprite(M.halo(0xff8a2c, 0.5));
    potGlow.scale.setScalar(0.16);
    potGlow.position.set(0, 0.05, 0);
    pot.add(potGlow);
    this.group.add(pot);
    this.potMesh = pot;

    // ---- delivery chute -------------------------------------------------
    world.addSensor(L.chute.u, L.chute.v, L.chute.r, { tag: 'chute' });
    // The cheeks are colliders first and scenery second — same polylines, so
    // the funnel the player aims into is the funnel the ball meets.
    addWalls(L.chuteWalls, { restitution: 0.3, friction: 2.2 }, M.crateWood(2));
    const chute = new THREE.Group();
    chute.position.set(L.chute.u, 0, -L.chute.v);
    G.mesh(G.box(0.14, 0.006, 0.1, 0.002), M.crateWood(1), { pos: [0, 0.002, 0.01], parent: chute });
    const sign = TEX.label({
      w: 256, h: 96, bg: sk.sign,
      lines: [{ text: '納品口', size: 46, color: sk.ink, y: 48 }],
      border: sk.edge, grain: 0.1,
    });
    G.mesh(G.plane(0.13, 0.048), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.9 }),
      { pos: [0, 0.055, -0.03], rot: [-0.5, 0, 0], parent: chute, cast: false });
    const chuteGlow = new THREE.Sprite(M.halo(0xffd9a0, 0.35));
    chuteGlow.scale.setScalar(0.2);
    chuteGlow.position.set(0, 0.04, 0);
    chute.add(chuteGlow);
    this.group.add(chute);
    this.chuteMesh = chute;
    this.chuteGlow = chuteGlow;

    // ---- flippers -------------------------------------------------------
    const F = TABLE.flipper;
    for (const side of ['left', 'right']) {
      const s = side === 'left' ? -1 : 1;
      const restAngle = side === 'left' ? -F.rest : Math.PI + F.rest;
      const activeAngle = side === 'left' ? F.swing : Math.PI - F.swing;
      const f = world.addFlipper({
        pivot: [s * F.pivotU, F.pivotV],
        length: F.length, radius: F.radius,
        restAngle, activeAngle, side,
      });
      const g = new THREE.Group();
      g.position.set(s * F.pivotU, 0.012, -F.pivotV);
      // Tapered bat with a brass pivot boss — a market tong doing a job.
      const bat = G.mesh(
        new THREE.CapsuleGeometry(F.radius, F.length, 4, 12),
        M.paintedWood(0xc4452f, 4),
        { pos: [F.length / 2, 0.008, 0], rot: [0, 0, Math.PI / 2], parent: g },
      );
      bat.scale.set(1, 1, 0.8);
      G.mesh(G.cyl(0.026, 0.03, 0.03, 14), brass, { pos: [0, 0.014, 0], parent: g });
      G.mesh(G.cyl(0.008, 0.008, 0.05, 8), M.steel(0.3), { pos: [0, 0.03, 0], parent: g });
      this.group.add(g);
      this.flipperMeshes.push({ f, g });
    }

    // ---- plunger --------------------------------------------------------
    const pg = new THREE.Group();
    // A rolling pin on a rod: pull it back down the lane and let go.
    G.mesh(G.cyl(0.042, 0.042, 0.1, 16), M.crateWood(2), { pos: [0, 0.038, 0.05], rot: [Math.PI / 2, 0, 0], parent: pg });
    G.mesh(G.cyl(0.012, 0.012, 0.1, 10), M.steel(0.3), { pos: [0, 0.038, -0.05], rot: [Math.PI / 2, 0, 0], parent: pg });
    G.mesh(G.cyl(0.05, 0.05, 0.014, 16), M.brass(), { pos: [0, 0.038, -0.008], rot: [Math.PI / 2, 0, 0], parent: pg });
    pg.position.set(TABLE.laneCentre, 0, -TABLE.plungerRest);
    this.group.add(pg);
    this.plungerMesh = pg;

    // The plunger face is a moving wall so a resting ball is genuinely held.
    this.plungerWall = world.addSegment(
      TABLE.laneU[0], TABLE.plungerRest, TABLE.laneU[1], TABLE.plungerRest,
      { restitution: 0.1, friction: 6, tag: 'plunger' },
    );

    // ---- apron ----------------------------------------------------------
    // Front lip below the flippers: the drain, and the thing the ball sails
    // over when you lose it.
    G.mesh(new THREE.BoxGeometry(TABLE.width, 0.05, 0.03), rail,
      { pos: [0, 0.014, 0.012], parent: this.group });

    this.built = true;
    return this.group;
  }

  _rail(p0, p1, mat, h = TABLE.wallH) {
    const dx = p1[0] - p0[0], dv = p1[1] - p0[1];
    const len = Math.hypot(dx, dv);
    if (len < 1e-4) return;
    const m = G.mesh(new THREE.BoxGeometry(len + 0.02, h, 0.022), mat, {
      pos: [(p0[0] + p1[0]) / 2, h / 2, -(p0[1] + p1[1]) / 2], parent: this.group,
    });
    m.rotation.y = Math.atan2(dv, dx);
    m.castShadow = true;
    m.receiveShadow = true;
  }

  /**
   * Splatter left where something burst. The table gets messier as you play,
   * which is both honest and a record of where your shots have been landing.
   */
  addStain(u, v, color, size = 0.07) {
    if (!this._stains) this._stains = [];
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.42,
      alphaMap: TEX.radialFalloff(1.5), depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.85), mat);
    m.position.set(u, 0.0011, -v);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI;
    m.renderOrder = 1;
    this.group.add(m);
    this._stains.push(m);
    // Cap it: an hour of play should not turn the playfield into a texture.
    while (this._stains.length > 48) {
      const old = this._stains.shift();
      this.group.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
    return m;
  }

  clearStains() {
    for (const m of this._stains || []) {
      this.group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this._stains = [];
  }

  /** Sync the visible flippers and plunger to the simulation. */
  sync(plungerV) {
    for (const { f, g } of this.flipperMeshes) g.rotation.y = f.angle;
    if (this.plungerMesh) this.plungerMesh.position.z = -plungerV;
  }

  /** Animate the furniture: bumper flashes, sinking targets, the whisk. */
  update(dt) {
    for (const b of this.bumpers || []) {
      if (b.flash > 0) {
        b.flash = Math.max(0, b.flash - dt * 4);
        const k = b.flash;
        b.g.scale.setScalar(1 + k * 0.12);
        b.glow.scale.setScalar(b.post.r * 3 * (1 + k * 1.4));
        b.glow.material.opacity = 0.5 + k * 0.5;
      }
    }
    for (const t of this.targets || []) {
      // Knocked-down jars sink through the playfield and come back up when the
      // bank resets — the same motion a real drop target makes.
      const want = t.post.enabled ? 0 : -0.09;
      t.g.position.y += (want - t.g.position.y) * Math.min(1, dt * 12);
    }
    if (this.spinnerSpin > 0.001) {
      this.spinnerMesh.rotation.y += this.spinnerSpin * dt;
      this.spinnerSpin *= Math.exp(-2.2 * dt);
    }
    if (this.chuteGlow) {
      this.chuteGlow.material.opacity = 0.5 + Math.sin(performance.now() / 400) * 0.15;
    }
  }

  hitBumper(post) {
    const b = (this.bumpers || []).find((x) => x.post === post);
    if (b) b.flash = 1;
  }

  dropTarget(post) {
    post.enabled = false;
    return (this.targets || []).every((t) => !t.post.enabled);
  }

  resetTargets() {
    for (const t of this.targets || []) t.post.enabled = true;
  }

  spinWhisk(speed) { this.spinnerSpin = Math.max(this.spinnerSpin, speed); }

  /**
   * Fold the table up out of the counter. k = 0 lays it flat on the top, k = 1
   * is the full playing tilt. Only the presentation moves: the solver works in
   * table space and never sees this, so the ball parked in the lane behaves the
   * same throughout the swing.
   */
  setRaise(k) {
    this.group.rotation.x = TABLE.tilt * k;
    this.group.position.y = COUNTER.topY + 0.006 * k;
  }

  setVisible(on) { this.group.visible = on; }
}
