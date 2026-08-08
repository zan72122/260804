// Household furniture. Everything is modelled the way it would be made:
// carcasses with panel thickness, rails and aprons under table tops, turned
// legs, cushions that sit in a frame rather than float above it.

import * as THREE from '../vendor/three.module.js';
import { materials } from './materials.js';
import { chamferBox, lathe, tube, mesh, group, applyBoxUV } from './build.js';
import { mulberry32 } from './noise.js';

const UVJ = 1.4;

function panel(w, h, d, mat, pos, rot) {
  const g = chamferBox(w, h, d, 0.004, 0.003);
  applyBoxUV(g, UVJ);
  return mesh(g, mat, { pos, rot });
}

/** Turned hardwood leg with a taper and a collar. */
function turnedLeg(h = 0.15, r = 0.022) {
  return lathe([
    [r * 1.15, 0.0], [r * 1.15, 0.012], [r * 0.98, 0.02], [r * 1.05, 0.032],
    [r * 0.86, h * 0.5], [r * 0.72, h * 0.86], [r * 0.78, h * 0.94], [r * 0.8, h],
  ], 18);
}

/** Soft cushion: a rounded slab with slumped corners. */
function cushion(w, h, d, r = 0.055) {
  const g = chamferBox(w, h, d, r, Math.min(r, h * 0.45));
  applyBoxUV(g, 1.6);
  return g;
}

export function makeSofa() {
  const M = materials();
  const g = group('sofa');
  const W = 2.02, D = 0.90;
  // Plinth / frame
  g.add(panel(W, 0.20, D, M.sofa, [0, 0.24, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(turnedLeg(0.145, 0.026), M.joineryDark, { pos: [sx * (W / 2 - 0.10), 0, sz * (D / 2 - 0.12)] }));
  }
  // Seat cushions, two of them, each slightly compressed in the middle
  for (const sx of [-1, 1]) {
    const c = mesh(cushion(W / 2 - 0.14, 0.155, D - 0.24, 0.05), M.cushion,
      { pos: [sx * (W / 4 - 0.005), 0.425, 0.035] });
    c.rotation.x = -0.015;
    g.add(c);
  }
  // Back: frame board plus two loose cushions leaning on it
  const back = panel(W, 0.62, 0.17, M.sofa, [0, 0.66, -D / 2 + 0.085]);
  back.rotation.x = -0.11;
  g.add(back);
  for (const sx of [-1, 1]) {
    const bc = mesh(cushion(W / 2 - 0.16, 0.42, 0.17, 0.07), M.cushion,
      { pos: [sx * (W / 4 - 0.01), 0.68, -D / 2 + 0.20] });
    bc.rotation.x = -0.17;
    g.add(bc);
  }
  // Arms
  for (const sx of [-1, 1]) {
    g.add(mesh(cushion(0.19, 0.34, D, 0.075), M.sofa, { pos: [sx * (W / 2 - 0.095), 0.51, 0] }));
  }
  // A throw cushion knocked onto the seat
  const throwC = mesh(cushion(0.36, 0.12, 0.36, 0.08), M.rug, { pos: [-0.55, 0.53, 0.10] });
  throwC.rotation.set(-0.5, 0.4, 0.25);
  g.add(throwC);
  return g;
}

export function makeCoffeeTable() {
  const M = materials();
  const g = group('coffeeTable');
  const W = 1.10, D = 0.60, H = 0.42;
  const top = panel(W, 0.036, D, M.joineryDark, [0, H - 0.018, 0]);
  g.add(top);
  // Apron rails set in from the edge
  g.add(panel(W - 0.16, 0.055, 0.020, M.joineryDark, [0, H - 0.07, -D / 2 + 0.075]));
  g.add(panel(W - 0.16, 0.055, 0.020, M.joineryDark, [0, H - 0.07, D / 2 - 0.075]));
  g.add(panel(0.020, 0.055, D - 0.16, M.joineryDark, [-W / 2 + 0.075, H - 0.07, 0]));
  g.add(panel(0.020, 0.055, D - 0.16, M.joineryDark, [W / 2 - 0.075, H - 0.07, 0]));
  // Tapered legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = lathe([[0.016, 0], [0.018, 0.02], [0.022, H - 0.12], [0.026, H - 0.04], [0.026, H - 0.036]], 14);
    g.add(mesh(leg, M.joineryDark, { pos: [sx * (W / 2 - 0.075), 0, sz * (D / 2 - 0.075)] }));
  }
  // Lower shelf with a couple of magazines
  g.add(panel(W - 0.17, 0.016, D - 0.17, M.joineryDark, [0, 0.13, 0]));
  const mag = panel(0.24, 0.006, 0.30, M.plasticBlue, [0.10, 0.142, 0.02]);
  mag.rotation.y = 0.22; g.add(mag);
  const mag2 = panel(0.22, 0.005, 0.28, M.plasticYellow, [0.06, 0.149, -0.03]);
  mag2.rotation.y = -0.12; g.add(mag2);
  // A child's beaker left on top
  const cup = lathe([[0.033, 0], [0.035, 0.005], [0.032, 0.02], [0.036, 0.085], [0.034, 0.088], [0.030, 0.086], [0.030, 0.006], [0, 0.004]], 20);
  g.add(mesh(cup, M.plasticPink, { pos: [-0.28, H, 0.06] }));
  return g;
}

export function makeBookshelf() {
  const M = materials();
  const g = group('bookshelf');
  const W = 0.88, H = 1.78, D = 0.30, t = 0.019;
  g.add(panel(t, H, D, M.joinery, [-W / 2 + t / 2, H / 2, 0]));
  g.add(panel(t, H, D, M.joinery, [W / 2 - t / 2, H / 2, 0]));
  g.add(panel(W, t, D, M.joinery, [0, H - t / 2, 0]));
  g.add(panel(W, 0.09, D - 0.03, M.joinery, [0, 0.045, 0.015]));   // plinth
  g.add(panel(W - t * 2, 0.004, 0.004, M.joineryDark, [0, H / 2, -D / 2 + 0.006])); // back panel rebate
  const backG = chamferBox(W - t * 2 + 0.004, H - 0.1, 0.004, 0.002, 0.0015);
  applyBoxUV(backG, UVJ);
  g.add(mesh(backG, M.joineryDark, { pos: [0, H / 2 + 0.045, -D / 2 + 0.008] }));

  const shelfY = [0.42, 0.79, 1.16, 1.50];
  for (const y of shelfY) g.add(panel(W - t * 2, 0.017, D - 0.012, M.joinery, [0, y, 0.004]));

  // Books: varied heights, thicknesses and lean.
  const rnd = mulberry32(5);
  const palette = [M.plasticRed, M.plasticBlue, M.plasticYellow, M.plasticPink, M.joineryDark, M.plasticWhite];
  for (const y of [0.098, ...shelfY.map((v) => v + 0.0085)]) {
    let x = -W / 2 + t + 0.02;
    const limit = W / 2 - t - 0.03;
    while (x < limit) {
      const bw = 0.018 + rnd() * 0.032;
      if (x + bw > limit) break;
      const bh = 0.19 + rnd() * 0.11;
      const bd = 0.18 + rnd() * 0.07;
      const m = palette[Math.floor(rnd() * palette.length)];
      const b = mesh(chamferBox(bw, bh, bd, 0.003, 0.002), m, { pos: [x + bw / 2, y + bh / 2, 0.01] });
      if (rnd() < 0.13) { b.rotation.z = 0.16; b.position.y -= 0.006; }
      g.add(b);
      x += bw + 0.002;
    }
  }
  return g;
}

export function makeTvUnit() {
  const M = materials();
  const g = group('tvUnit');
  const W = 1.42, H = 0.46, D = 0.40, t = 0.018;
  g.add(panel(W, t, D, M.joinery, [0, H - t / 2, 0]));
  g.add(panel(W, t, D, M.joinery, [0, 0.09, 0]));
  g.add(panel(t, H - 0.09, D, M.joinery, [-W / 2 + t / 2, (H + 0.09) / 2, 0]));
  g.add(panel(t, H - 0.09, D, M.joinery, [W / 2 - t / 2, (H + 0.09) / 2, 0]));
  g.add(panel(W / 2 - t, H - 0.13, D, M.joinery, [0, (H + 0.09) / 2, 0])); // centre divider... shallow
  // Two drawers with a shadow gap and finger pulls
  for (const sx of [-1, 1]) {
    const dw = W / 2 - t * 2 - 0.012;
    const dr = panel(dw, H - 0.14, 0.018, M.joinery, [sx * (W / 4), (H + 0.09) / 2, D / 2 - 0.009]);
    g.add(dr);
    g.add(mesh(chamferBox(dw * 0.45, 0.012, 0.022, 0.004, 0.003), M.alu, { pos: [sx * (W / 4), (H + 0.09) / 2 + 0.09, D / 2 + 0.004] }));
  }
  for (const sx of [-1, 1]) g.add(mesh(turnedLeg(0.09, 0.018), M.joineryDark, { pos: [sx * (W / 2 - 0.09), 0, D / 2 - 0.08] }));
  for (const sx of [-1, 1]) g.add(mesh(turnedLeg(0.09, 0.018), M.joineryDark, { pos: [sx * (W / 2 - 0.09), 0, -D / 2 + 0.08] }));

  // Flat TV: bezel, dark panel, pedestal.
  const tv = group('tv');
  tv.add(mesh(chamferBox(0.94, 0.55, 0.028, 0.005, 0.004), M.plasticBlack, { pos: [0, 0.30, 0] }));
  tv.add(mesh(chamferBox(0.90, 0.51, 0.004, 0.002, 0.0015), M.glassLens, { pos: [0, 0.30, 0.017] }));
  tv.add(mesh(chamferBox(0.22, 0.10, 0.14, 0.01, 0.008), M.plasticBlack, { pos: [0, 0.035, -0.01] }));
  tv.add(mesh(chamferBox(0.34, 0.014, 0.20, 0.008, 0.006), M.plasticBlack, { pos: [0, 0.007, -0.01] }));
  tv.position.y = H;
  g.add(tv);
  return g;
}

export function makeShoeCabinet() {
  const M = materials();
  const g = group('shoeCabinet');
  const W = 0.86, H = 0.92, D = 0.34, t = 0.017;
  g.add(panel(W, t, D, M.joinery, [0, H - t / 2, 0]));
  g.add(panel(t, H, D, M.joinery, [-W / 2 + t / 2, H / 2, 0]));
  g.add(panel(t, H, D, M.joinery, [W / 2 - t / 2, H / 2, 0]));
  g.add(panel(W, 0.07, D - 0.02, M.joinery, [0, 0.035, 0]));
  for (let i = 0; i < 3; i++) {
    const y = 0.12 + i * 0.26;
    const door = panel(W - t * 2 - 0.008, 0.24, 0.016, M.joinery, [0, y + 0.12, D / 2 - 0.008]);
    if (i === 1) { door.rotation.y = -0.22; door.position.x += 0.06; door.position.z += 0.02; } // one flap left open
    g.add(door);
    g.add(mesh(chamferBox(0.16, 0.010, 0.020, 0.004, 0.003), M.alu, { pos: [0, y + 0.225, D / 2 + 0.003] }));
  }
  return g;
}

export function makeBed() {
  const M = materials();
  const g = group('bed');
  const W = 0.96, L = 1.92, frameH = 0.30;
  // Rails and slats — the underside matters here, the kitten hides in it.
  g.add(panel(0.036, 0.16, L, M.joinery, [-W / 2 + 0.018, frameH - 0.08, 0]));
  g.add(panel(0.036, 0.16, L, M.joinery, [W / 2 - 0.018, frameH - 0.08, 0]));
  g.add(panel(W, 0.16, 0.036, M.joinery, [0, frameH - 0.08, L / 2 - 0.018]));
  for (let i = 0; i < 9; i++) {
    g.add(panel(W - 0.06, 0.012, 0.07, M.joinery, [0, frameH - 0.14, -L / 2 + 0.16 + i * (L - 0.32) / 8]));
  }
  // Legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(chamferBox(0.05, frameH - 0.16, 0.05, 0.006, 0.004), M.joineryDark,
      { pos: [sx * (W / 2 - 0.03), (frameH - 0.16) / 2, sz * (L / 2 - 0.03)] }));
  }
  // Headboard with vertical slats
  const hbH = 0.78;
  g.add(panel(W + 0.04, 0.05, 0.035, M.joinery, [0, frameH + hbH - 0.025, -L / 2 - 0.01]));
  g.add(panel(0.06, hbH, 0.035, M.joinery, [-W / 2 - 0.01, frameH + hbH / 2, -L / 2 - 0.01]));
  g.add(panel(0.06, hbH, 0.035, M.joinery, [W / 2 + 0.01, frameH + hbH / 2, -L / 2 - 0.01]));
  for (let i = 0; i < 7; i++) {
    g.add(panel(0.038, hbH - 0.1, 0.024, M.joinery, [-W / 2 + 0.12 + i * (W - 0.24) / 6, frameH + hbH / 2 - 0.03, -L / 2 - 0.01]));
  }
  // Mattress + duvet + pillow
  g.add(mesh(cushion(W - 0.03, 0.17, L - 0.03, 0.035), M.bedding, { pos: [0, frameH + 0.085, 0] }));
  const duvet = mesh(cushion(W + 0.03, 0.13, L * 0.72, 0.07), M.bedding, { pos: [0, frameH + 0.225, L * 0.12] });
  duvet.rotation.x = 0.02;
  g.add(duvet);
  const pillow = mesh(cushion(0.52, 0.13, 0.34, 0.08), M.bedding, { pos: [0, frameH + 0.235, -L / 2 + 0.30] });
  pillow.rotation.x = -0.08;
  g.add(pillow);
  return g;
}

export function makeToyChest() {
  const M = materials();
  const g = group('toyChest');
  const W = 0.74, H = 0.44, D = 0.42, t = 0.016;
  g.add(panel(W, H, t, M.plasticBlue, [0, H / 2, -D / 2 + t / 2]));
  g.add(panel(W, H, t, M.plasticBlue, [0, H / 2, D / 2 - t / 2]));
  g.add(panel(t, H, D - t * 2, M.plasticBlue, [-W / 2 + t / 2, H / 2, 0]));
  g.add(panel(t, H, D - t * 2, M.plasticBlue, [W / 2 - t / 2, H / 2, 0]));
  g.add(panel(W - t * 2, t, D - t * 2, M.plasticBlue, [0, 0.06, 0]));
  const lid = panel(W + 0.03, 0.022, D + 0.03, M.plasticBlue, [0, H + 0.011, 0]);
  lid.position.z += 0.04;
  lid.rotation.x = -0.55;                       // propped open
  lid.position.y += 0.09;
  g.add(lid);
  // Toys spilling out
  const rnd = mulberry32(23);
  const mats = [M.plasticRed, M.plasticYellow, M.plasticPink, M.plasticWhite];
  for (let i = 0; i < 7; i++) {
    const s = 0.05 + rnd() * 0.035;
    const b = mesh(chamferBox(s, s, s, 0.006, 0.004), mats[i % mats.length],
      { pos: [(rnd() - 0.5) * (W - 0.2), 0.09 + rnd() * 0.22, (rnd() - 0.5) * (D - 0.2)] });
    b.rotation.set(rnd(), rnd(), rnd());
    g.add(b);
  }
  return g;
}

export function makePottedPlant() {
  const M = materials();
  const g = group('plant');
  const pot = lathe([[0.11, 0], [0.115, 0.01], [0.135, 0.20], [0.15, 0.26], [0.152, 0.275], [0.142, 0.275], [0.14, 0.26], [0.125, 0.20], [0.105, 0.01], [0, 0]], 24);
  g.add(mesh(pot, M.plasticWhite, { pos: [0, 0, 0] }));
  const soil = mesh(lathe([[0, 0.255], [0.13, 0.252], [0.135, 0.246]], 20), M.joineryDark, {});
  g.add(soil);
  const rnd = mulberry32(9);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2c4a24, roughness: 0.72, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.4;
    const lean = 0.35 + rnd() * 0.45;
    const hgt = 0.36 + rnd() * 0.34;
    const stem = tube([
      [0, 0.25, 0],
      [Math.cos(a) * 0.06 * lean, 0.25 + hgt * 0.4, Math.sin(a) * 0.06 * lean],
      [Math.cos(a) * 0.20 * lean, 0.25 + hgt * 0.85, Math.sin(a) * 0.20 * lean],
      [Math.cos(a) * 0.30 * lean, 0.25 + hgt, Math.sin(a) * 0.30 * lean],
    ], 0.006, { tubular: 10, radial: 6 });
    g.add(mesh(stem, leafMat, {}));
    const leaf = new THREE.SphereGeometry(0.085, 10, 8);
    leaf.scale(1.0, 0.10, 0.55);
    const lm = mesh(leaf, leafMat, {
      pos: [Math.cos(a) * 0.33 * lean, 0.25 + hgt + 0.01, Math.sin(a) * 0.33 * lean],
      rot: [rnd() * 0.4 - 0.2, -a, 0.5 + rnd() * 0.3],
    });
    g.add(lm);
  }
  return g;
}

/** Scattered play things — reads as "a child lives here" from crawl height. */
export function makeFloorToys(seed = 3) {
  const M = materials();
  const g = group('toys');
  const rnd = mulberry32(seed);
  const mats = [M.plasticRed, M.plasticBlue, M.plasticYellow, M.plasticPink, M.plasticWhite];
  for (let i = 0; i < 9; i++) {
    const kind = Math.floor(rnd() * 3);
    const m = mats[Math.floor(rnd() * mats.length)];
    let o;
    if (kind === 0) {
      const s = 0.052 + rnd() * 0.02;
      o = mesh(chamferBox(s, s, s, 0.007, 0.005), m, { pos: [0, s / 2, 0] });
      // studs on top, so it reads as a building brick
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        o.add(mesh(lathe([[0.011, 0], [0.011, 0.008], [0.009, 0.010], [0, 0.010]], 10), m,
          { pos: [dx * s * 0.24, s / 2, dz * s * 0.24] }));
      }
    } else if (kind === 1) {
      o = mesh(new THREE.SphereGeometry(0.048, 16, 12), m, { pos: [0, 0.048, 0] });
    } else {
      o = mesh(lathe([[0, 0], [0.05, 0], [0.052, 0.01], [0.05, 0.05], [0.03, 0.062], [0, 0.062]], 16), m, { pos: [0, 0, 0] });
    }
    o.position.x = (rnd() - 0.5) * 1.9;
    o.position.z = (rnd() - 0.5) * 1.5;
    o.rotation.y = rnd() * 3;
    g.add(o);
  }
  return g;
}

/** Wall shelf carrying a row of small plush animals. */
export function makeWallShelf() {
  const M = materials();
  const g = group('wallShelf');
  g.add(panel(0.92, 0.022, 0.20, M.joinery, [0, 0, 0]));
  for (const sx of [-1, 1]) {
    const br = chamferBox(0.016, 0.14, 0.16, 0.003, 0.002);
    g.add(mesh(br, M.alu, { pos: [sx * 0.33, -0.078, -0.01] }));
  }
  const furs = [M.furTeddy, M.furKitten, M.furKittenPale, M.furMuzzle];
  for (let i = 0; i < 4; i++) {
    const body = new THREE.SphereGeometry(0.055, 12, 10);
    body.scale(1, 1.15, 0.95);
    const b = mesh(body, furs[i], { pos: [-0.33 + i * 0.22, 0.075, 0] });
    g.add(b);
    const head = mesh(new THREE.SphereGeometry(0.042, 12, 10), furs[i], { pos: [-0.33 + i * 0.22, 0.155, 0.005] });
    g.add(head);
    for (const sx of [-1, 1]) {
      g.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), furs[i], { pos: [-0.33 + i * 0.22 + sx * 0.032, 0.185, 0] }));
    }
  }
  return g;
}
