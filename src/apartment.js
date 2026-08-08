// The flat: an L-shaped two-and-a-half room apartment at 1:1 scale.
//
//        z
//        ^      +-----------------------------+
//        |      |        LIVING ROOM          |
//   -----+      |                             |
//   KID  |      |                             |
//   ROOM |      +--------+          +---------+
//        |               |  HALL    |
//        +---------------+  (front  +
//                           door)
//
// Ceiling 2.45 m, doors 2.02 m, walls 120 mm, skirting 120 mm — the real numbers
// matter because the whole game is about the 600 mm of clear air near the floor.

import * as THREE from '../vendor/three.module.js';
import { materials } from './materials.js';
import { chamferBox, extrudeProfile, mesh, group, applyBoxUV, lathe, tube } from './build.js';

export const CEIL = 2.45;
const WALL_T = 0.12;
const DOOR_H = 2.02;

const UV = { floor: 0.9, wall: 0.85, ceil: 0.7, joinery: 1.6 };

/** Floor / ceiling slabs for one rectangular room. */
function slab(x1, z1, x2, z2, y, mat, uv, flip) {
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1);
  const g = new THREE.PlaneGeometry(w, d, Math.ceil(w), Math.ceil(d));
  g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
  applyBoxUV(g, uv);
  const m = mesh(g, mat, { pos: [(x1 + x2) / 2, y, (z1 + z2) / 2], shadow: false, receive: true });
  return m;
}

/** Skirting board cross-section: 18 mm boards with a chamfered top edge. */
function skirtingGeo(len) {
  const p = [
    [0, 0], [0.018, 0], [0.018, 0.098], [0.010, 0.118], [0.010, 0.122], [0, 0.122],
  ];
  const g = extrudeProfile(p, len, { bevel: 0.0015 });
  g.rotateY(Math.PI / 2);          // extrusion axis Z -> X, profile depth -> -Z
  applyBoxUV(g, UV.joinery);
  return g;
}

/**
 * A straight wall with rectangular openings punched through it, built from real
 * segments plus a header over each opening — so every doorway has a reveal you
 * can see the 120 mm thickness of.
 */
function buildWall(parent, x1, z1, x2, z2, opts = {}) {
  const M = materials();
  const {
    h = CEIL, t = WALL_T, mat = M.wall, matBack = null,
    openings = [], skirtFront = true, skirtBack = false,
  } = opts;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const theta = Math.atan2(-dz, dx);
  const g = new THREE.Group();
  g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  g.rotation.y = theta;
  parent.add(g);

  // Openings are given as { at, width, height } with `at` measured from the wall
  // centre along its length.
  const cuts = openings.slice().sort((a, b) => a.at - b.at);
  let cursor = -len / 2;
  const segs = [];
  for (const o of cuts) {
    const a = o.at - o.width / 2, b = o.at + o.width / 2;
    if (a > cursor) segs.push([cursor, a]);
    if (o.height < h - 0.001) {
      const hh = h - o.height;
      const head = mesh(chamferBox(o.width, hh, t, 0.006, 0.004), mat,
        { pos: [o.at, o.height + hh / 2, 0], shadow: true, receive: true });
      g.add(head);
    }
    cursor = b;
  }
  if (cursor < len / 2) segs.push([cursor, len / 2]);

  for (const [a, b] of segs) {
    const w = b - a;
    if (w < 0.004) continue;
    const m = mesh(chamferBox(w, h, t, 0.006, 0.004), mat, { pos: [(a + b) / 2, h / 2, 0], shadow: true, receive: true });
    g.add(m);
    if (matBack) {
      // A thin veneer on the far face when the two sides are painted differently.
      const v = mesh(chamferBox(w, h, 0.004, 0.004, 0.002), matBack, { pos: [(a + b) / 2, h / 2, -t / 2 - 0.003], shadow: false, receive: true });
      g.add(v);
    }
    for (const [side, on] of [[1, skirtFront], [-1, skirtBack]]) {
      if (!on) continue;
      const sk = mesh(skirtingGeo(w), M.joinery, { pos: [(a + b) / 2, 0, side * (t / 2)], shadow: false, receive: true });
      sk.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(sk);
    }
  }

  // Casing / lining inside each opening so the reveal is a real lined jamb.
  for (const o of cuts) {
    if (!o.lined) continue;
    const jam = (sx) => {
      const j = mesh(chamferBox(0.028, o.height, t + 0.006, 0.004, 0.003), M.joinery,
        { pos: [o.at + sx * (o.width / 2 - 0.014), o.height / 2, 0] });
      g.add(j);
    };
    jam(-1); jam(1);
    const top = mesh(chamferBox(o.width, 0.028, t + 0.006, 0.004, 0.003), M.joinery,
      { pos: [o.at, o.height - 0.014, 0] });
    g.add(top);
    // Architrave on both faces.
    for (const side of [1, -1]) {
      const arch = (w, hh, px, py) => {
        const a = mesh(chamferBox(w, hh, 0.016, 0.003, 0.002), M.joinery,
          { pos: [px, py, side * (t / 2 + 0.008)] });
        g.add(a);
      };
      arch(0.062, o.height + 0.062, o.at - o.width / 2 - 0.031, (o.height + 0.062) / 2);
      arch(0.062, o.height + 0.062, o.at + o.width / 2 + 0.031, (o.height + 0.062) / 2);
      arch(o.width + 0.124, 0.062, o.at, o.height + 0.031);
    }
  }
  return g;
}

/** A four-panel painted door leaf with real rails, stiles and raised panels. */
function doorLeaf(w = 0.86, h = DOOR_H) {
  const M = materials();
  const g = new THREE.Group();
  const t = 0.042;
  const stile = 0.11, railT = 0.11, railM = 0.17, railB = 0.22;
  // Core
  g.add(mesh(chamferBox(w, h, t * 0.55, 0.004, 0.003), M.joinery, { pos: [0, h / 2, 0] }));
  const face = (side) => {
    const z = side * (t * 0.275 + t * 0.225 / 2);
    const add = (bw, bh, bx, by) =>
      g.add(mesh(chamferBox(bw, bh, t * 0.225, 0.004, 0.003), M.joinery, { pos: [bx, by, z] }));
    add(stile, h, -w / 2 + stile / 2, h / 2);
    add(stile, h, w / 2 - stile / 2, h / 2);
    add(w - stile * 2, railT, 0, h - railT / 2);
    add(w - stile * 2, railM, 0, h * 0.46);
    add(w - stile * 2, railB, 0, railB / 2);
    // Raised panels sit proud inside the frame openings.
    const panelW = w - stile * 2 - 0.02;
    const upperH = h - railT - h * 0.46 - railM / 2 - 0.02;
    const lowerH = h * 0.46 - railM / 2 - railB - 0.02;
    g.add(mesh(chamferBox(panelW, upperH, t * 0.12, 0.008, 0.006), M.joinery,
      { pos: [0, (h - railT + h * 0.46 + railM / 2) / 2, side * (t * 0.275 + 0.004)] }));
    g.add(mesh(chamferBox(panelW, lowerH, t * 0.12, 0.008, 0.006), M.joinery,
      { pos: [0, (railB + h * 0.46 - railM / 2) / 2, side * (t * 0.275 + 0.004)] }));
  };
  face(1); face(-1);
  // Lever handle on a rose, both sides.
  for (const side of [1, -1]) {
    const rose = mesh(lathe([[0, 0], [0.026, 0], [0.028, 0.004], [0.026, 0.009], [0.012, 0.010], [0, 0.010]], 20), M.alu,
      { pos: [w / 2 - 0.075, 1.045, side * t / 2] });
    rose.rotation.x = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(rose);
    const lever = mesh(tube([
      [w / 2 - 0.075, 1.045, side * (t / 2 + 0.012)],
      [w / 2 - 0.075, 1.045, side * (t / 2 + 0.045)],
      [w / 2 - 0.115, 1.043, side * (t / 2 + 0.052)],
      [w / 2 - 0.165, 1.040, side * (t / 2 + 0.050)],
    ], 0.0105, { tubular: 16, radial: 8 }), M.alu, {});
    g.add(lever);
  }
  // Hinges
  for (const y of [0.28, h - 0.28]) {
    g.add(mesh(chamferBox(0.02, 0.085, 0.012, 0.002, 0.0015), M.brass, { pos: [-w / 2 + 0.008, y, 0] }));
  }
  return g;
}

/** Casement window: lined reveal, sill, frame, sashes and glazing. */
function window3D(w, h, { bars = 1 } = {}) {
  const M = materials();
  const g = new THREE.Group();
  const fr = 0.055, t = 0.07;
  // Outer frame
  g.add(mesh(chamferBox(w, fr, t, 0.005, 0.004), M.joinery, { pos: [0, h / 2 - fr / 2, 0] }));
  g.add(mesh(chamferBox(w, fr, t, 0.005, 0.004), M.joinery, { pos: [0, -h / 2 + fr / 2, 0] }));
  g.add(mesh(chamferBox(fr, h - fr * 2, t, 0.005, 0.004), M.joinery, { pos: [-w / 2 + fr / 2, 0, 0] }));
  g.add(mesh(chamferBox(fr, h - fr * 2, t, 0.005, 0.004), M.joinery, { pos: [w / 2 - fr / 2, 0, 0] }));
  // Central mullion + transom bars
  g.add(mesh(chamferBox(0.042, h - fr * 2, t * 0.8, 0.004, 0.003), M.joinery, { pos: [0, 0, 0] }));
  for (let i = 1; i <= bars; i++) {
    const y = -h / 2 + (h * i) / (bars + 1);
    g.add(mesh(chamferBox(w - fr * 2, 0.032, t * 0.7, 0.004, 0.003), M.joinery, { pos: [0, y, 0] }));
  }
  // Glazing, set back in the rebate
  const glass = mesh(new THREE.PlaneGeometry(w - fr * 1.6, h - fr * 1.6), M.windowGlass, { pos: [0, 0, -t * 0.22], shadow: false, receive: false });
  g.add(glass);
  // Stone sill with a drip nose
  g.add(mesh(chamferBox(w + 0.12, 0.045, t + 0.09, 0.006, 0.004), M.joinery, { pos: [0, -h / 2 - 0.022, 0.012] }));
  return g;
}

/**
 * Night beyond the glass. A dark shell around the whole set, plus a
 * neighbouring block in each window's line of sight so the view has depth
 * rather than reading as a hole in the wall.
 */
function exterior(scene) {
  const g = group('exterior');
  const night = new THREE.MeshBasicMaterial({ color: 0x080b12, side: THREE.BackSide });
  g.add(mesh(new THREE.BoxGeometry(90, 44, 90), night, { pos: [0, 12, 0], shadow: false, receive: false }));

  const wallMat = new THREE.MeshBasicMaterial({ color: 0x14161c });
  const litWarm = new THREE.MeshBasicMaterial({ color: 0x3b3222 });
  const litCold = new THREE.MeshBasicMaterial({ color: 0x1d2530 });

  // A facade with lit windows, built once and dropped in front of each window.
  const block = (w, h, seed) => {
    const b = group('block');
    b.add(mesh(new THREE.PlaneGeometry(w, h), wallMat, { shadow: false, receive: false }));
    const cols = Math.floor(w / 2.4), rows = Math.floor(h / 2.8);
    for (let i = 0; i < cols * rows; i++) {
      const cx = -w / 2 + 1.4 + (i % cols) * 2.4;
      const cy = -h / 2 + 1.8 + Math.floor(i / cols) * 2.8;
      const on = ((i * 7 + seed) % 5) < 2;
      b.add(mesh(new THREE.PlaneGeometry(1.0, 1.4), on ? litWarm : litCold,
        { pos: [cx, cy, 0.04], shadow: false, receive: false }));
    }
    return b;
  };

  const north = block(28, 16, 3);
  north.position.set(-5.0, 7.0, -18.0);
  g.add(north);

  const east = block(26, 15, 5);
  east.position.set(17.0, 6.5, -3.0);
  east.rotation.y = -Math.PI / 2;
  g.add(east);

  scene.add(g);
  return g;
}

export function buildApartment(scene) {
  const M = materials();
  const root = group('apartment');
  scene.add(root);

  // ---- Rooms (interior extents) -------------------------------------------
  const HALL = { x1: -0.95, x2: 0.95, z1: 0.20, z2: 2.90 };
  const LIV = { x1: -3.40, x2: 2.60, z1: -5.80, z2: 0.20 };
  const KID = { x1: -7.80, x2: -3.40, z1: -5.80, z2: -2.20 };

  // ---- Floor & ceiling -----------------------------------------------------
  for (const r of [HALL, LIV, KID]) {
    root.add(slab(r.x1, r.z1, r.x2, r.z2, 0, M.floor, UV.floor, false));
    root.add(slab(r.x1, r.z1, r.x2, r.z2, CEIL, M.ceiling, UV.ceil, true));
  }

  // ---- Walls ---------------------------------------------------------------
  // Front (south) wall of the hall, with the entrance door: this is the way out.
  buildWall(root, HALL.x1 - WALL_T / 2, HALL.z2, HALL.x2 + WALL_T / 2, HALL.z2, {
    openings: [{ at: 0, width: 0.95, height: DOOR_H, lined: true }], skirtFront: false, skirtBack: true,
  });
  // Hall side walls
  buildWall(root, HALL.x1, HALL.z2, HALL.x1, HALL.z1, { skirtFront: false, skirtBack: true });
  buildWall(root, HALL.x2, HALL.z1, HALL.x2, HALL.z2, { skirtFront: false, skirtBack: true });
  // Living room south wall with the cased opening into the hall
  buildWall(root, LIV.x1, LIV.z2, LIV.x2, LIV.z2, {
    openings: [{ at: (0 - (LIV.x1 + LIV.x2) / 2), width: 1.90, height: 2.10, lined: true }],
    skirtFront: true, skirtBack: false,
  });
  // Living room east wall (window onto the street)
  buildWall(root, LIV.x2, LIV.z2, LIV.x2, LIV.z1, {
    openings: [{ at: 2.05, width: 1.45, height: 2.05 }], skirtFront: true,
  });
  // North wall, spanning living room + kid room, with the kid room window
  buildWall(root, LIV.x2, LIV.z1, KID.x1, KID.z1, {
    openings: [{ at: 6.35, width: 1.25, height: 2.00 }], skirtFront: true,
  });
  // Kid room west wall
  buildWall(root, KID.x1, KID.z1, KID.x1, KID.z2, { skirtFront: true });
  // Kid room south wall
  buildWall(root, KID.x1, KID.z2, KID.x2, KID.z2, { skirtFront: true });
  // Divider between living room and kid room, with the door the player crawls through
  const divCz = (LIV.z1 + LIV.z2) / 2;
  buildWall(root, LIV.x1, LIV.z2, LIV.x1, LIV.z1, {
    openings: [{ at: -(-4.50 - divCz), width: 0.90, height: DOOR_H, lined: true }],
    mat: M.wall, skirtFront: true, skirtBack: true,
  });

  // ---- Door leaves ---------------------------------------------------------
  // Both are hung on a hinge group so they swing about their real pivot and
  // finish flat against the wall, out of the crawl route.
  const hang = (leaf, w, hinge, angle) => {
    const h = new THREE.Group();
    leaf.position.x = w / 2;
    h.add(leaf);
    h.position.set(hinge[0], 0, hinge[1]);
    h.rotation.y = angle;
    root.add(h);
    return h;
  };
  // Front door: thrown wide by the crew, folded back against the hall wall.
  hang(doorLeaf(0.93, DOOR_H), 0.93, [-0.475, HALL.z2 - 0.075], Math.PI / 2 - 0.10);
  // Kid's room door: pushed open flat against the partition inside the room.
  hang(doorLeaf(0.88, DOOR_H), 0.88, [LIV.x1 - 0.075, -4.94], Math.PI / 2 - 0.06);

  // ---- Windows -------------------------------------------------------------
  const wLiv = window3D(1.42, 1.30, { bars: 1 });
  wLiv.position.set(LIV.x2 + 0.005, 1.62, -2.25);
  wLiv.rotation.y = -Math.PI / 2;
  root.add(wLiv);

  const wKid = window3D(1.22, 1.15, { bars: 1 });
  wKid.position.set(-5.90, 1.55, KID.z1 - 0.005);
  root.add(wKid);

  exterior(scene);

  // ---- Ceiling fittings (power is out; they read as silhouettes) ----------
  const pendant = group('pendant');
  pendant.add(mesh(tube([[0, CEIL, 0], [0, CEIL - 0.55, 0]], 0.004, { tubular: 4, radial: 6 }), M.plasticBlack, {}));
  pendant.add(mesh(lathe([[0, 0], [0.03, 0.005], [0.032, 0.02], [0.03, 0.03], [0, 0.032]], 16), M.plasticWhite, { pos: [0, CEIL - 0.03, 0] }));
  const shade = mesh(lathe([[0.128, 0.0], [0.127, 0.018], [0.108, 0.075], [0.062, 0.150], [0.016, 0.205]], 28), M.plasticWhite, { pos: [0, CEIL - 0.55, 0] });
  shade.material = M.plasticWhite.clone();
  shade.material.side = THREE.DoubleSide;
  pendant.add(shade);
  pendant.position.set(0.3, 0, -2.5);
  root.add(pendant);

  return { root, rooms: { HALL, LIV, KID } };
}
