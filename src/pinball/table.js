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
    // Inlane walls funnelling everything down onto the flippers. They end
    // exactly on the flipper pivot, not short of it: any notch left between
    // wall and pivot boss is narrower than the ball, and a ball that rolls
    // into it wedges there for good. Ending on the pivot leaves a continuous
    // surface — down the wall, over the boss, onto the bat.
    inlanes: [
      { pts: [[-H, 0.34], [-0.30, 0.175], [-F.pivotU, F.pivotV]], tag: 'inlane' },
      { pts: [[laneIn, 0.34], [0.30, 0.175], [F.pivotU, F.pivotV]], tag: 'inlane' },
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
      color: 0xf0dcae, roughness: 0.7, transparent: true, opacity: 0.35, depthWrite: false,
    });
    for (const [u0, v0, u1, v1] of [
      [-0.62, 0.30, -0.30, 0.14], [0.30, 0.14, 0.52, 0.30],
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

    // One-way gate: the ball leaves the lane through it and can never fall back in.
    world.addSegment(L.gate.p0[0], L.gate.p0[1], L.gate.p1[0], L.gate.p1[1], {
      restitution: 0.2, friction: 3, tag: 'gate', oneWay: 1,
    });
    this._rail(L.gate.p0, L.gate.p1, brass, 0.03);

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

  setVisible(on) { this.group.visible = on; }
}
