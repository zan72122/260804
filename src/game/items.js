// Every ingredient in the game, modelled as real geometry.
//
// Proportions are kept honest within a chain — a tomato is 66 mm across, the
// crate that holds six of them is 110 mm, the sauce jar is 100 mm tall — and
// then the whole group is capped to the 113 mm grid cell so the board stays
// readable. Nothing here is a sprite or a billboard.

import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as G from '../engine/geo.js';
import * as TEX from '../engine/textures.js';
import { makeRng } from '../engine/util.js';

const R = (id) => makeRng([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);

// ------------------------------------------------------------ helpers ----

/** Green calyx + stem, the thing that makes a red ball read as a tomato. */
function calyx(parent, r, y, col = 0x4a7a2c) {
  const mat = M.leaf(col);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = G.mesh(G.plane(r * 0.42, r * 0.62), mat, {
      pos: [Math.cos(a) * r * 0.3, y, Math.sin(a) * r * 0.3],
      rot: [-Math.PI / 2 + 0.55, a, 0], parent, cast: false,
    });
    s.material.side = THREE.DoubleSide;
  }
  G.mesh(G.cyl(r * 0.09, r * 0.11, r * 0.34, 6), M.food(0x3f6b23, { rough: 0.8 }), {
    pos: [0, y + r * 0.16, 0], parent,
  });
}

/** Woven basket: vertical ribs + coiled bands, open top, real inner wall. */
function basket(parent, rTop, rBot, h, mat) {
  const ribs = 16;
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const r = (rTop + rBot) / 2;
    const rib = G.mesh(G.box(0.004, h, 0.006, 0.001), mat, {
      pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r], rot: [0, -a, 0], parent,
    });
    rib.rotation.z = (rTop - rBot) / h * 0.6 * Math.cos(a);
  }
  const bands = 4;
  for (let b = 0; b < bands; b++) {
    const t = (b + 0.5) / bands;
    const r = rBot + (rTop - rBot) * t;
    G.mesh(G.torus(r, 0.0045, 20, 5), mat, { pos: [0, t * h, 0], rot: [Math.PI / 2, 0, 0], parent });
  }
  G.mesh(G.cyl(rBot, rBot, 0.005, 18), mat, { pos: [0, 0.003, 0], parent });
  G.mesh(G.torus(rTop, 0.006, 22, 6), mat, { pos: [0, h, 0], rot: [Math.PI / 2, 0, 0], parent });
}

/** Shallow ceramic plate with a rim you can catch a highlight on. */
function plate(parent, r, mat, y = 0) {
  G.mesh(G.lathe([
    [0.001, 0], [r * 0.55, 0.001], [r * 0.62, 0.004], [r * 0.95, 0.012],
    [r, 0.016], [r, 0.019], [r * 0.93, 0.017], [r * 0.55, 0.006], [0.001, 0.005],
  ], 24), mat, { pos: [0, y, 0], parent });
}

/** Water/juice surface inside a vessel: a disc with a meniscus lip. */
function fill(parent, r, y, h, mat) {
  G.mesh(G.cyl(r, r * 0.97, h, 20), mat, { pos: [0, y + h / 2, 0], parent, cast: false });
  G.mesh(G.torus(r, r * 0.03, 20, 5), mat, { pos: [0, y + h, 0], rot: [Math.PI / 2, 0, 0], parent, cast: false });
}

function citrusSlice(parent, r, mat, pos, rot) {
  const g = G.group({ pos, rot, parent });
  G.mesh(G.cyl(r, r, 0.004, 16), mat, { parent: g });
  const seg = M.food(0xfff0b8, { rough: 0.5 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const w = G.mesh(G.box(r * 0.62, 0.0045, r * 0.2, 0.001), seg, {
      pos: [Math.cos(a) * r * 0.42, 0.0005, Math.sin(a) * r * 0.42], rot: [0, -a, 0], parent: g, cast: false,
    });
    w.scale.set(1, 1, 1);
  }
  return g;
}

// -------------------------------------------------------- vegetables ----

const buildSeedPouch = () => {
  const rng = R('seed');
  const g = new THREE.Group();
  const cloth = M.sackcloth(0xd6c096);
  const body = G.mesh(G.blob(0.028, 1.05, 1.0, 0.95, 16), cloth, { pos: [0, 0.026, 0], parent: g });
  body.scale.set(1, 1, 1);
  // Gathered neck, tied with twine.
  G.mesh(G.cyl(0.011, 0.017, 0.022, 12), cloth, { pos: [0, 0.055, 0], parent: g });
  G.mesh(G.torus(0.012, 0.0028, 12, 5), M.sackcloth(0x8a6a3c), { pos: [0, 0.052, 0], rot: [Math.PI / 2, 0, 0], parent: g });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    G.mesh(G.cone(0.007, 0.018, 6), cloth, {
      pos: [Math.cos(a) * 0.008, 0.072, Math.sin(a) * 0.008], rot: [rng.range(-0.4, 0.4), a, rng.range(-0.3, 0.3)], parent: g,
    });
  }
  // Spilled seeds on the ground beside it.
  for (let i = 0; i < 7; i++) {
    G.mesh(G.blob(0.0035, 1, 0.6, 1.3, 6), M.food(0xc4a45f, { rough: 0.7 }), {
      pos: [rng.range(-0.045, 0.045), 0.003, rng.range(-0.04, 0.04)], rot: [0, rng.range(0, 3), 0], parent: g,
    });
  }
  return g;
};

const buildTomato = () => {
  const g = new THREE.Group();
  const r = 0.033;
  const skin = M.food(0xc32e22, { rough: 0.28, clearcoat: 0.62, seed: 1 });
  const body = G.mesh(G.blob(r, 1.06, 0.86, 1.06, 22), skin, { pos: [0, r * 0.86, 0], parent: g });
  body.scale.set(1, 1, 1);
  calyx(g, r, r * 1.62);
  return g;
};

const buildTomatoCrate = () => {
  const rng = R('tomcrate');
  const g = new THREE.Group();
  const c = G.crate(0.104, 0.05, 0.082, M.crateWood(0), M.darkWood(), 2);
  c.position.y = 0.025;
  g.add(c);
  const skin = M.food(0xc32e22, { rough: 0.28, clearcoat: 0.62, seed: 1 });
  for (let i = 0; i < 8; i++) {
    const x = -0.032 + (i % 4) * 0.021, z = -0.016 + Math.floor(i / 4) * 0.028;
    const t = G.mesh(G.blob(0.0165, 1.05, 0.88, 1.05, 12), skin, {
      pos: [x + rng.range(-0.003, 0.003), 0.055 + rng.range(0, 0.006), z + rng.range(-0.004, 0.004)], parent: g,
    });
    t.scale.set(1, 1, 1);
    G.mesh(G.cyl(0.0015, 0.002, 0.006, 5), M.food(0x3f6b23, { rough: 0.8 }), {
      pos: [t.position.x, t.position.y + 0.015, t.position.z], parent: g, cast: false,
    });
  }
  // Chalked price tag wired to the crate.
  const tag = TEX.label({
    w: 128, h: 72, bg: '#e8dcc0',
    lines: [{ text: '1,20', size: 34, color: '#3a2a18', y: 26 }, { text: '/kg', size: 20, color: '#6b5a3a', y: 54 }],
    grain: 0.15,
  });
  G.mesh(G.plane(0.036, 0.02), new THREE.MeshStandardMaterial({ map: tag, roughness: 0.95, side: THREE.DoubleSide }),
    { pos: [0, 0.03, 0.043], rot: [0.15, 0, 0.08], parent: g, cast: false });
  return g;
};

const buildSauceJar = () => {
  const g = new THREE.Group();
  const h = 0.098;
  const profile = [
    [0.001, 0], [0.027, 0], [0.031, 0.006], [0.031, h * 0.62], [0.028, h * 0.78],
    [0.019, h * 0.86], [0.019, h], [0.0165, h], [0.0165, h * 0.87], [0.0255, h * 0.78],
    [0.0285, h * 0.62], [0.0285, 0.007], [0.001, 0.005],
  ];
  G.mesh(G.lathe(profile, 26), M.glass(0xe8f0e4), { parent: g });
  // Sauce inside, sitting a few millimetres below the shoulder.
  G.mesh(G.cyl(0.0275, 0.0265, h * 0.66, 22), M.food(0xa5231a, { rough: 0.42, seed: 2 }),
    { pos: [0, h * 0.34, 0], parent: g, cast: false });
  // Lid with a knurled edge.
  G.mesh(G.cyl(0.0195, 0.0195, 0.012, 22), M.brass(true), { pos: [0, h + 0.005, 0], parent: g });
  G.mesh(G.torus(0.0195, 0.0018, 22, 5), M.brass(), { pos: [0, h + 0.002, 0], rot: [Math.PI / 2, 0, 0], parent: g });
  // Paper label, slightly askew and scuffed.
  const lab = TEX.label({
    w: 256, h: 160, bg: '#f2e6c8',
    lines: [
      { text: 'SALSA', size: 44, color: '#8c2b1e', y: 52 },
      { text: 'DE TOMATE', size: 26, color: '#5a4530', y: 92 },
      { text: '· 1924 ·', size: 20, color: '#8a7a58', y: 128 },
    ],
    grain: 0.12,
  });
  const label = G.mesh(G.cyl(0.0315, 0.0315, 0.036, 26, true),
    new THREE.MeshStandardMaterial({ map: lab, roughness: 0.9, side: THREE.DoubleSide }),
    { pos: [0, h * 0.4, 0], rot: [0, 0.4, 0.012], parent: g });
  return g;
};

const buildMarinaraPot = () => {
  const g = new THREE.Group();
  const enamel = new THREE.MeshPhysicalMaterial({
    color: 0xb8341f, roughness: 0.24, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12,
  });
  const h = 0.062, r = 0.048;
  G.mesh(G.lathe([
    [0.001, 0], [r * 0.82, 0], [r * 0.9, 0.006], [r, h * 0.55], [r * 1.02, h],
    [r * 1.06, h + 0.004], [r * 0.99, h + 0.004], [r * 0.96, h * 0.55], [r * 0.86, 0.007], [0.001, 0.006],
  ], 26), enamel, { parent: g });
  // Handles, off the rim, with real gaps you can see the counter through.
  for (const s of [-1, 1]) {
    G.mesh(G.torus(0.014, 0.0045, 12, 6, Math.PI), enamel, {
      pos: [s * (r * 1.06), h * 0.8, 0], rot: [0, Math.PI / 2, s > 0 ? -0.4 : Math.PI + 0.4], parent: g,
    });
  }
  // Lid resting slightly ajar — steam escaping is implied by the gap.
  const lid = G.group({ pos: [0.004, h + 0.006, -0.003], rot: [0.09, 0, 0.06], parent: g });
  G.mesh(G.lathe([[0.001, 0], [r * 0.98, 0], [r * 1.02, 0.004], [r * 0.9, 0.012], [r * 0.4, 0.019], [0.001, 0.02]], 24),
    enamel, { parent: lid });
  G.mesh(G.sphere(0.007, 10), M.brass(), { pos: [0, 0.024, 0], parent: lid });
  G.mesh(G.cyl(0.004, 0.004, 0.006, 8), M.brass(true), { pos: [0, 0.02, 0], parent: lid });
  // Sauce visible through the gap.
  G.mesh(G.cyl(r * 0.9, r * 0.86, 0.03, 20), M.food(0x9e2016, { rough: 0.35, clearcoat: 0.4 }),
    { pos: [0, h * 0.55, 0], parent: g, cast: false });
  // Basil on top.
  for (let i = 0; i < 4; i++) {
    const a = i * 1.9;
    G.mesh(G.plane(0.014, 0.02), M.leaf(0x3d7028), {
      pos: [Math.cos(a) * 0.014, h * 0.55 + 0.016, Math.sin(a) * 0.014],
      rot: [-Math.PI / 2 + 0.2, a, 0], parent: g, cast: false,
    });
  }
  return g;
};

// ------------------------------------------------------------- bread ----

const buildWheat = () => {
  const rng = R('wheat');
  const g = new THREE.Group();
  const straw = M.food(0xd9b96a, { rough: 0.85 });
  const grain = M.food(0xc9a04e, { rough: 0.7 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const lean = rng.range(0.05, 0.16);
    const x = Math.cos(a) * 0.011, z = Math.sin(a) * 0.011;
    const stalk = G.mesh(G.cyl(0.0016, 0.002, 0.075, 5), straw, {
      pos: [x, 0.038, z], rot: [Math.cos(a) * lean, 0, -Math.sin(a) * lean], parent: g,
    });
    const head = G.group({ pos: [x + Math.sin(a) * 0.011, 0.086, z + Math.cos(a) * 0.004], parent: g });
    head.rotation.set(Math.cos(a) * lean, 0, -Math.sin(a) * lean);
    for (let k = 0; k < 7; k++) {
      G.mesh(G.blob(0.0035, 1, 1.5, 1, 6), grain, {
        pos: [0, k * 0.005 - 0.01, 0.0018 * (k % 2 ? 1 : -1)], parent: head, cast: false,
      });
      G.mesh(G.cyl(0.0006, 0.0006, 0.018, 4), straw, {
        pos: [0, k * 0.005 + 0.006, 0], rot: [rng.range(-0.2, 0.2), 0, rng.range(-0.25, 0.25)], parent: head, cast: false,
      });
    }
  }
  G.mesh(G.torus(0.014, 0.0035, 14, 5), M.sackcloth(0x9c7b45), { pos: [0, 0.036, 0], rot: [Math.PI / 2, 0, 0], parent: g });
  return g;
};

const buildDough = () => {
  const rng = R('dough');
  const g = new THREE.Group();
  const cloth = M.cloth(0xe8e0cf, 1.0);
  G.mesh(G.box(0.096, 0.004, 0.08, 0.002), cloth, { pos: [0, 0.002, 0], parent: g });
  const d = M.food(0xe6d3ac, { rough: 0.78, seed: 4 });
  const ball = G.mesh(G.blob(0.031, 1.08, 0.68, 1.02, 20), d, { pos: [0, 0.024, 0], parent: g });
  ball.scale.set(1, 1, 1);
  // Flour dusting: fine specks that catch the light.
  for (let i = 0; i < 24; i++) {
    const a = rng.range(0, 6.28), r = rng.range(0, 0.045);
    G.mesh(G.sphere(rng.range(0.0012, 0.0026), 5), M.food(0xf6f0e2, { rough: 1 }), {
      pos: [Math.cos(a) * r, 0.005 + (r < 0.03 ? 0.03 : 0), Math.sin(a) * r], parent: g, cast: false,
    });
  }
  return g;
};

const buildLoaf = () => {
  const rng = R('loaf');
  const g = new THREE.Group();
  const crust = M.food(0xb07338, { rough: 0.72, seed: 5 });
  const body = G.mesh(G.capsule(0.026, 0.05, 18), crust, { pos: [0, 0.026, 0], rot: [0, 0, Math.PI / 2], parent: g });
  body.scale.set(1, 1, 0.82);
  // Scored slashes across the top, opened up with a lighter crumb inside.
  for (let i = 0; i < 3; i++) {
    const x = -0.024 + i * 0.024;
    G.mesh(G.box(0.006, 0.008, 0.03, 0.002), M.food(0xe8cf9c, { rough: 0.85 }), {
      pos: [x, 0.048, 0], rot: [0, 0.4, 0], parent: g, cast: false,
    });
  }
  // Flour dusting on the crown.
  for (let i = 0; i < 12; i++) {
    G.mesh(G.sphere(0.0018, 5), M.food(0xf2ead8, { rough: 1 }), {
      pos: [rng.range(-0.04, 0.04), 0.05, rng.range(-0.018, 0.018)], parent: g, cast: false,
    });
  }
  return g;
};

const buildBaguetteBasket = () => {
  const rng = R('bag');
  const g = new THREE.Group();
  const wicker = M.crateWood(1);
  basket(g, 0.05, 0.038, 0.052, wicker);
  const crust = M.food(0xb87a3c, { rough: 0.7, seed: 6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const b = G.mesh(G.capsule(0.0085, 0.075, 10), crust, {
      pos: [Math.cos(a) * 0.017, 0.07, Math.sin(a) * 0.017],
      rot: [rng.range(-0.22, 0.22) + Math.cos(a) * 0.3, a, Math.sin(a) * 0.3], parent: g,
    });
    b.scale.set(1, 1, 1);
    // Diagonal scoring on each baguette.
    for (let k = 0; k < 4; k++) {
      G.mesh(G.box(0.0035, 0.004, 0.011, 0.001), M.food(0xe0c396, { rough: 0.85 }), {
        pos: [0, -0.024 + k * 0.017, 0.007], rot: [0, 0, 0.6], parent: b, cast: false,
      });
    }
  }
  return g;
};

const buildCroissantTray = () => {
  const rng = R('croi');
  const g = new THREE.Group();
  G.mesh(G.box(0.104, 0.008, 0.078, 0.003), M.crateWood(2), { pos: [0, 0.004, 0], parent: g });
  for (const s of [-1, 1]) {
    G.mesh(G.box(0.104, 0.012, 0.005, 0.002), M.crateWood(2), { pos: [0, 0.012, s * 0.038], parent: g });
  }
  const pastry = M.food(0xd39a4b, { rough: 0.44, clearcoat: 0.35, seed: 7 });
  const croissant = (x, z, ry) => {
    const c = G.group({ pos: [x, 0.02, z], rot: [0, ry, 0], parent: g });
    // Crescent from tapering segments — the classic rolled-and-curved form.
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = (t - 0.5) * 2.1;
      const rr = 0.014 * (1 - Math.abs(t - 0.5) * 1.1);
      G.mesh(G.blob(Math.max(rr, 0.003), 1, 0.85, 1.25, 10), pastry, {
        pos: [Math.sin(a) * 0.026, Math.cos(a) * 0.004, Math.cos(a) * 0.022 - 0.02], rot: [0, -a, 0], parent: c,
      });
    }
    return c;
  };
  croissant(-0.026, 0.014, rng.range(-0.3, 0.3));
  croissant(0.026, 0.012, rng.range(2.8, 3.4));
  croissant(0.0, -0.018, rng.range(1.2, 1.8));
  return g;
};

// --------------------------------------------------------------- sea ----

const buildClam = () => {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8cbb0, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3,
  });
  const half = (sign, tilt) => {
    const m = G.mesh(new THREE.SphereGeometry(0.026, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat, {
      pos: [0, 0.014, 0], rot: [tilt * sign, 0, 0], parent: g,
    });
    m.geometry.userData.shared = true;
    m.scale.set(1, 0.42 * sign, 1);
    // Growth ridges.
    for (let i = 1; i <= 3; i++) {
      const rr = 0.026 * (i / 3.4);
      G.mesh(G.torus(rr, 0.0012, 18, 4), shellMat, {
        pos: [0, 0.014 + sign * 0.004 * (1 - i / 4), 0], rot: [Math.PI / 2 + tilt * sign, 0, 0], parent: g, cast: false,
      });
    }
    return m;
  };
  half(1, 0.12);
  half(-1, -0.12);
  G.mesh(G.box(0.02, 0.004, 0.012, 0.001), M.food(0xe6c9b4, { rough: 0.35, clearcoat: 0.6 }),
    { pos: [0, 0.014, 0.004], parent: g, cast: false });
  return g;
};

const buildFish = () => {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({
    color: 0x9fb3bd, roughness: 0.28, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2,
  });
  const belly = M.food(0xe8e2d4, { rough: 0.4, clearcoat: 0.4 });
  const b = G.mesh(G.blob(0.03, 1.0, 0.72, 2.2, 20), body, { pos: [0, 0.022, 0], parent: g });
  b.scale.set(1, 1, 1);
  G.mesh(G.blob(0.026, 0.86, 0.42, 2.0, 16), belly, { pos: [0, 0.014, 0.002], parent: g, cast: false });
  // Tail fin.
  const tail = G.mesh(G.plane(0.03, 0.034), body, { pos: [0, 0.024, -0.07], rot: [0, Math.PI / 2, 0], parent: g });
  tail.material = new THREE.MeshStandardMaterial({ color: 0x8fa6b0, roughness: 0.4, side: THREE.DoubleSide });
  // Dorsal + pectoral fins.
  const fin = new THREE.MeshStandardMaterial({ color: 0x8fa6b0, roughness: 0.45, side: THREE.DoubleSide });
  G.mesh(G.plane(0.05, 0.018), fin, { pos: [0, 0.042, -0.005], rot: [0, Math.PI / 2, 0.3], parent: g, cast: false });
  for (const s of [-1, 1]) {
    G.mesh(G.plane(0.022, 0.014), fin, { pos: [s * 0.016, 0.018, 0.012], rot: [0.5, 0, s * 0.4], parent: g, cast: false });
  }
  // Eye and gill line: the two details that make a fish read at a glance.
  for (const s of [-1, 1]) {
    G.mesh(G.sphere(0.005, 8), M.ceramic(0xf4f2ee, 0.1), { pos: [s * 0.019, 0.03, 0.045], parent: g, cast: false });
    G.mesh(G.sphere(0.0028, 8), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.15 }),
      { pos: [s * 0.021, 0.03, 0.048], parent: g, cast: false });
    G.mesh(G.torus(0.012, 0.001, 10, 4, Math.PI), M.steel(0.5), {
      pos: [s * 0.018, 0.024, 0.028], rot: [0, Math.PI / 2, 1.2], parent: g, cast: false,
    });
  }
  return g;
};

const buildFishCrate = () => {
  const rng = R('fcrate');
  const g = new THREE.Group();
  const c = G.crate(0.106, 0.046, 0.084, M.crateWood(2), M.darkWood(), 2);
  c.position.y = 0.023;
  g.add(c);
  // Crushed ice: translucent chips, not a smooth blob.
  const ice = M.ice();
  for (let i = 0; i < 26; i++) {
    G.mesh(G.box(rng.range(0.006, 0.013), rng.range(0.005, 0.01), rng.range(0.006, 0.012), 0.001), ice, {
      pos: [rng.range(-0.042, 0.042), 0.042 + rng.range(0, 0.008), rng.range(-0.03, 0.03)],
      rot: [rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)], parent: g, cast: false,
    });
  }
  const fishMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8bcc6, roughness: 0.22, metalness: 0.3, clearcoat: 0.7,
  });
  for (let i = 0; i < 3; i++) {
    const f = G.mesh(G.blob(0.019, 1, 0.6, 2.0, 14), fishMat, {
      pos: [-0.026 + i * 0.026, 0.052, rng.range(-0.012, 0.012)],
      rot: [0, rng.range(-0.4, 0.4) + (i % 2 ? 0.2 : -0.2), 0.1], parent: g,
    });
    f.scale.set(1, 1, 1);
    G.mesh(G.plane(0.02, 0.022), new THREE.MeshStandardMaterial({ color: 0x93a8b2, roughness: 0.4, side: THREE.DoubleSide }),
      { pos: [f.position.x, 0.054, f.position.z - 0.04], rot: [0, Math.PI / 2, 0], parent: g, cast: false });
  }
  return g;
};

const buildGrilledFish = () => {
  const rng = R('grill');
  const g = new THREE.Group();
  plate(g, 0.052, M.ceramic(0xf2ece0));
  const charred = M.food(0xa88a5c, { rough: 0.52, seed: 8 });
  const f = G.mesh(G.blob(0.019, 1, 0.62, 2.1, 16), charred, { pos: [0, 0.017, 0], rot: [0, 0.35, 0], parent: g });
  f.scale.set(1, 1, 1);
  // Grill marks, burnt into the skin.
  for (let i = 0; i < 4; i++) {
    G.mesh(G.box(0.026, 0.0015, 0.004, 0.0005), M.food(0x4a3320, { rough: 0.8 }), {
      pos: [Math.sin(0.35) * (-0.012 + i * 0.011), 0.028, Math.cos(0.35) * (-0.012 + i * 0.011)],
      rot: [0, 0.35 + Math.PI / 2, 0], parent: g, cast: false,
    });
  }
  // Lemon wedge and herbs.
  const wedge = G.mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12, 1, false, 0, Math.PI * 0.6),
    M.food(0xe8c53a, { rough: 0.4, clearcoat: 0.3 }), { pos: [0.03, 0.022, 0.026], rot: [0.2, 0.6, 1.4], parent: g });
  wedge.geometry.userData.shared = true;
  for (let i = 0; i < 5; i++) {
    G.mesh(G.plane(0.008, 0.014), M.leaf(0x40702a), {
      pos: [-0.022 + rng.range(-0.01, 0.01), 0.02, -0.02 + rng.range(-0.01, 0.01)],
      rot: [-1.2, rng.range(0, 3), 0], parent: g, cast: false,
    });
  }
  return g;
};

const buildPaella = () => {
  const rng = R('paella');
  const g = new THREE.Group();
  const pan = M.steel(0.46);
  G.mesh(G.lathe([
    [0.001, 0], [0.045, 0], [0.05, 0.006], [0.052, 0.018], [0.054, 0.021],
    [0.05, 0.021], [0.048, 0.007], [0.001, 0.004],
  ], 26), pan, { parent: g });
  for (const s of [-1, 1]) {
    G.mesh(G.torus(0.012, 0.003, 12, 5, Math.PI), pan, {
      pos: [s * 0.055, 0.016, 0], rot: [Math.PI / 2, 0, s > 0 ? 0 : Math.PI], parent: g,
    });
  }
  // Saffron rice bed.
  G.mesh(G.cyl(0.047, 0.045, 0.012, 24), M.food(0xe0b455, { rough: 0.82, seed: 9 }), { pos: [0, 0.012, 0], parent: g, cast: false });
  // Prawns arranged around the rim, peas and peppers scattered.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = G.group({ pos: [Math.cos(a) * 0.026, 0.02, Math.sin(a) * 0.026], rot: [0, -a, 0], parent: g });
    const prawn = M.food(0xe2704a, { rough: 0.3, clearcoat: 0.55 });
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      G.mesh(G.blob(0.005 * (1 - t * 0.4), 1, 1, 1, 8), prawn, {
        pos: [Math.sin(t * 2.2) * 0.012, Math.cos(t * 2.2) * 0.003, t * 0.006], parent: p, cast: false,
      });
    }
    G.mesh(G.cone(0.004, 0.01, 6), prawn, { pos: [0.014, 0.002, 0.008], rot: [0, 0, 1.6], parent: p, cast: false });
  }
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, 6.28), r = rng.range(0, 0.04);
    G.mesh(G.sphere(0.0035, 6), M.food(0x5f8a34, { rough: 0.45 }), {
      pos: [Math.cos(a) * r, 0.019, Math.sin(a) * r], parent: g, cast: false,
    });
  }
  for (let i = 0; i < 8; i++) {
    const a = rng.range(0, 6.28), r = rng.range(0, 0.038);
    G.mesh(G.box(0.008, 0.002, 0.004, 0.0008), M.food(0xc03a2a, { rough: 0.4 }), {
      pos: [Math.cos(a) * r, 0.019, Math.sin(a) * r], rot: [0, rng.range(0, 3), 0], parent: g, cast: false,
    });
  }
  return g;
};

// ------------------------------------------------------------ drinks ----

const buildLemon = () => {
  const g = new THREE.Group();
  const skin = M.food(0xe9c62f, { rough: 0.46, clearcoat: 0.3, seed: 10 });
  const b = G.mesh(G.blob(0.028, 1, 0.86, 1.35, 20), skin, { pos: [0, 0.024, 0], parent: g });
  b.scale.set(1, 1, 1);
  G.mesh(G.cone(0.006, 0.01, 8), skin, { pos: [0, 0.024, 0.038], rot: [Math.PI / 2, 0, 0], parent: g, cast: false });
  G.mesh(G.cone(0.006, 0.01, 8), skin, { pos: [0, 0.024, -0.038], rot: [-Math.PI / 2, 0, 0], parent: g, cast: false });
  G.mesh(G.plane(0.02, 0.03), M.leaf(0x3d6b28), { pos: [0.012, 0.046, -0.006], rot: [-0.9, 0.4, 0.3], parent: g, cast: false });
  return g;
};

const buildLemonade = () => {
  const g = new THREE.Group();
  const h = 0.088, r = 0.024;
  G.mesh(G.lathe([
    [0.001, 0], [r * 0.78, 0], [r * 0.82, 0.005], [r * 0.9, h * 0.35], [r, h],
    [r * 0.96, h], [r * 0.86, h * 0.35], [r * 0.78, 0.007], [0.001, 0.006],
  ], 24), M.glass(0xeef6f4), { parent: g });
  fill(g, r * 0.9, 0.007, h * 0.72, M.liquid(0xf0c53a));
  // Ice cubes breaking the surface.
  const ice = M.ice();
  const rng = R('lemonade');
  for (let i = 0; i < 3; i++) {
    G.mesh(G.box(0.011, 0.011, 0.011, 0.002), ice, {
      pos: [rng.range(-0.008, 0.008), h * 0.55 + i * 0.012, rng.range(-0.008, 0.008)],
      rot: [rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)], parent: g, cast: false,
    });
  }
  citrusSlice(g, 0.016, M.food(0xf2d24a, { rough: 0.4 }), [r * 0.7, h * 0.86, 0], [0, 0, 1.35]);
  // Paper straw.
  const straw = G.mesh(G.cyl(0.0025, 0.0025, 0.11, 8), M.paper(0xd94a3c), { pos: [0.008, h * 0.62, -0.004], parent: g });
  straw.rotation.z = -0.24;
  return g;
};

const buildPitcher = () => {
  const g = new THREE.Group();
  const h = 0.095, r = 0.034;
  G.mesh(G.lathe([
    [0.001, 0], [r * 0.82, 0], [r * 0.88, 0.008], [r, h * 0.45], [r * 0.92, h * 0.85],
    [r * 0.96, h], [r * 0.92, h], [r * 0.88, h * 0.85], [r * 0.96, h * 0.45], [r * 0.84, 0.01], [0.001, 0.008],
  ], 26), M.glass(0xeaf2ee), { parent: g });
  fill(g, r * 0.9, 0.01, h * 0.66, M.liquid(0xe8a832));
  // Handle: a real loop with a gap you can see through.
  const handle = G.mesh(G.torus(0.019, 0.0042, 14, 6, Math.PI * 1.25), M.glass(0xeaf2ee), {
    pos: [-r * 0.96, h * 0.58, 0], rot: [0, Math.PI / 2, -0.4], parent: g,
  });
  // Pouring lip.
  G.mesh(G.cone(0.011, 0.014, 8, ), M.glass(0xeaf2ee), { pos: [r * 0.9, h * 0.99, 0], rot: [0, 0, -0.5], parent: g, cast: false });
  citrusSlice(g, 0.014, M.food(0xf2d24a, { rough: 0.4 }), [0, h * 0.5, r * 0.72], [1.5, 0, 0.2]);
  const mint = M.leaf(0x3f7a2c);
  for (let i = 0; i < 4; i++) {
    G.mesh(G.plane(0.012, 0.017), mint, {
      pos: [Math.cos(i * 1.7) * 0.012, h * 0.68, Math.sin(i * 1.7) * 0.012], rot: [-1.2, i * 1.7, 0], parent: g, cast: false,
    });
  }
  return g;
};

const buildCocktail = () => {
  const g = new THREE.Group();
  const glassMat = M.glass(0xf0f6f4);
  // Coupe: bowl, stem, foot — three distinct masses.
  G.mesh(G.lathe([
    [0.001, 0.052], [0.03, 0.052], [0.032, 0.056], [0.031, 0.078], [0.031, 0.08],
    [0.0285, 0.08], [0.0285, 0.057], [0.001, 0.056],
  ], 24), glassMat, { parent: g });
  G.mesh(G.cyl(0.0035, 0.004, 0.046, 10), glassMat, { pos: [0, 0.028, 0], parent: g });
  G.mesh(G.lathe([[0.001, 0], [0.021, 0], [0.022, 0.003], [0.018, 0.006], [0.001, 0.006]], 20), glassMat, { parent: g });
  // Drink with a foam line at the meniscus.
  G.mesh(G.cyl(0.0295, 0.012, 0.02, 22), M.liquid(0xe8623c), { pos: [0, 0.066, 0], parent: g, cast: false });
  G.mesh(G.cyl(0.0295, 0.0295, 0.0018, 22), M.food(0xffd9c0, { rough: 0.5 }), { pos: [0, 0.0765, 0], parent: g, cast: false });
  // Cherry on a stick, resting on the rim.
  const pick = G.mesh(G.cyl(0.0012, 0.0012, 0.05, 5), M.paper(0xdcc9a0), { pos: [0.004, 0.088, 0], rot: [0.2, 0, 0.55], parent: g });
  G.mesh(G.sphere(0.007, 10), M.food(0xa8203a, { rough: 0.24, clearcoat: 0.8 }), { pos: [0.016, 0.076, 0.003], parent: g });
  citrusSlice(g, 0.013, M.food(0xf0a83a, { rough: 0.4 }), [-0.026, 0.081, 0.008], [0.4, 0, 1.5]);
  return g;
};

const buildEspresso = () => {
  const g = new THREE.Group();
  const porcelain = M.ceramic(0xf6f2ea, 0.16);
  plate(g, 0.042, porcelain);
  // Cup: real wall thickness, visible interior, handle with a gap.
  G.mesh(G.lathe([
    [0.001, 0.018], [0.019, 0.018], [0.021, 0.021], [0.024, 0.048], [0.0245, 0.05],
    [0.0225, 0.05], [0.022, 0.022], [0.0165, 0.02], [0.001, 0.02],
  ], 24), porcelain, { pos: [0, 0, 0], parent: g });
  G.mesh(G.cyl(0.014, 0.017, 0.022, 16), porcelain, { pos: [0, 0.009, 0], parent: g });
  G.mesh(G.torus(0.011, 0.0028, 12, 5, Math.PI * 1.4), porcelain, {
    pos: [0.026, 0.036, 0], rot: [0, Math.PI / 2, -0.2], parent: g,
  });
  // Coffee with crema.
  G.mesh(G.cyl(0.0215, 0.0205, 0.016, 20), M.food(0x2a1508, { rough: 0.28, clearcoat: 0.6 }), { pos: [0, 0.04, 0], parent: g, cast: false });
  G.mesh(G.cyl(0.0215, 0.0215, 0.0015, 20), M.food(0xb07a3c, { rough: 0.5 }), { pos: [0, 0.0485, 0], parent: g, cast: false });
  // Spoon and a sugar cube on the saucer.
  const spoon = G.group({ pos: [-0.03, 0.021, 0.012], rot: [0, 0.6, 0], parent: g });
  G.mesh(G.box(0.028, 0.0018, 0.004, 0.0006), M.steel(0.2), { pos: [0.012, 0, 0], parent: spoon });
  G.mesh(G.blob(0.006, 1, 0.35, 0.7, 10), M.steel(0.18), { pos: [-0.006, 0.0008, 0], parent: spoon });
  G.mesh(G.box(0.008, 0.008, 0.008, 0.0008), M.food(0xf4f2ec, { rough: 0.9 }), { pos: [0.028, 0.024, 0.014], rot: [0, 0.4, 0], parent: g });
  return g;
};

// --------------------------------------------------------- producers ----

const buildVegProducer = () => {
  const rng = R('prodveg');
  const g = new THREE.Group();
  const c = G.crate(0.108, 0.062, 0.09, M.crateWood(0), M.darkWood(), 3);
  c.position.y = 0.031;
  g.add(c);
  const veg = [
    [0xc32e22, 0.016], [0x6f9b3a, 0.018], [0xd98a2b, 0.015], [0x8a4a8f, 0.014], [0xe0c25a, 0.013],
  ];
  for (let i = 0; i < 11; i++) {
    const [col, rad] = rng.pick(veg);
    G.mesh(G.blob(rad, 1, rng.range(0.8, 1.05), 1, 12), M.food(col, { rough: 0.4, clearcoat: 0.3, seed: 11 }), {
      pos: [rng.range(-0.04, 0.04), 0.064 + rng.range(0, 0.012), rng.range(-0.03, 0.03)],
      rot: [rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)], parent: g,
    });
  }
  const leafy = M.leaf(0x4a7a2c);
  for (let i = 0; i < 6; i++) {
    G.mesh(G.plane(0.02, 0.03), leafy, {
      pos: [rng.range(-0.045, 0.045), 0.078, rng.range(-0.035, 0.035)],
      rot: [rng.range(-1.5, -0.6), rng.range(0, 3), rng.range(-0.4, 0.4)], parent: g, cast: false,
    });
  }
  return g;
};

const buildBreadProducer = () => {
  const rng = R('prodbread');
  const g = new THREE.Group();
  const sack = M.sackcloth(0xd8c39a);
  const body = G.mesh(G.blob(0.045, 1.0, 1.15, 0.86, 18), sack, { pos: [0, 0.05, 0], parent: g });
  body.scale.set(1, 1, 1);
  // Rolled-open mouth showing flour inside.
  G.mesh(G.torus(0.026, 0.008, 16, 6), sack, { pos: [0, 0.094, 0], rot: [Math.PI / 2, 0.2, 0], parent: g });
  G.mesh(G.cyl(0.024, 0.024, 0.008, 16), M.food(0xf4eee0, { rough: 1 }), { pos: [0, 0.096, 0], parent: g, cast: false });
  // Stencilled mark on the sack.
  const stamp = TEX.label({
    w: 128, h: 128, bg: 'rgba(0,0,0,0)',
    lines: [{ text: 'FARINA', size: 26, color: '#6b5230', y: 54 }, { text: '25kg', size: 20, color: '#6b5230', y: 84 }],
    grain: 0.2,
  });
  G.mesh(G.plane(0.05, 0.05), new THREE.MeshStandardMaterial({ map: stamp, transparent: true, roughness: 1 }),
    { pos: [0, 0.05, 0.039], rot: [0, 0, 0.1], parent: g, cast: false });
  // Wooden scoop stuck in the flour.
  const scoop = G.group({ pos: [0.022, 0.1, 0.01], rot: [0.5, 0.4, 0.3], parent: g });
  G.mesh(G.cyl(0.0035, 0.0035, 0.05, 8), M.crateWood(2), { pos: [0, 0.025, 0], parent: scoop });
  G.mesh(new THREE.SphereGeometry(0.012, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.crateWood(2),
    { pos: [0, 0, 0], rot: [Math.PI, 0, 0], parent: scoop });
  for (let i = 0; i < 10; i++) {
    G.mesh(G.sphere(0.0018, 5), M.food(0xf6f0e2, { rough: 1 }), {
      pos: [rng.range(-0.05, 0.05), 0.002, rng.range(-0.05, 0.05)], parent: g, cast: false,
    });
  }
  return g;
};

const buildSeaProducer = () => {
  const rng = R('prodsea');
  const g = new THREE.Group();
  const zinc = M.steel(0.62);
  // Zinc-lined ice box with riveted corners.
  G.mesh(G.box(0.11, 0.05, 0.088, 0.006), zinc, { pos: [0, 0.025, 0], parent: g });
  G.mesh(G.box(0.104, 0.006, 0.082, 0.002), new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.9 }),
    { pos: [0, 0.05, 0], parent: g, cast: false });
  for (const sx of [-1, 1]) {
    G.mesh(G.box(0.006, 0.05, 0.006, 0.001), M.iron(), { pos: [sx * 0.052, 0.025, 0.042], parent: g });
    G.mesh(G.box(0.006, 0.05, 0.006, 0.001), M.iron(), { pos: [sx * 0.052, 0.025, -0.042], parent: g });
  }
  const ice = M.ice();
  for (let i = 0; i < 22; i++) {
    G.mesh(G.box(rng.range(0.007, 0.014), rng.range(0.006, 0.011), rng.range(0.007, 0.013), 0.001), ice, {
      pos: [rng.range(-0.044, 0.044), 0.054 + rng.range(0, 0.01), rng.range(-0.032, 0.032)],
      rot: [rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)], parent: g, cast: false,
    });
  }
  const fishMat = new THREE.MeshPhysicalMaterial({ color: 0xa8bcc6, roughness: 0.22, metalness: 0.3, clearcoat: 0.7 });
  for (let i = 0; i < 2; i++) {
    const f = G.mesh(G.blob(0.018, 1, 0.6, 2.0, 14), fishMat, {
      pos: [-0.02 + i * 0.04, 0.062, rng.range(-0.01, 0.01)], rot: [0, rng.range(-0.5, 0.5), 0.12], parent: g,
    });
    f.scale.set(1, 1, 1);
  }
  return g;
};

const buildDrinkProducer = () => {
  const rng = R('proddrink');
  const g = new THREE.Group();
  basket(g, 0.055, 0.042, 0.05, M.crateWood(1));
  const fruit = [[0xe9c62f, 0.017], [0xe07f22, 0.019], [0x9ec437, 0.015]];
  for (let i = 0; i < 12; i++) {
    const [col, rad] = rng.pick(fruit);
    G.mesh(G.blob(rad, 1, rng.range(0.85, 1.1), rng.range(0.95, 1.25), 12),
      M.food(col, { rough: 0.44, clearcoat: 0.3, seed: 12 }), {
      pos: [rng.range(-0.032, 0.032), 0.052 + rng.range(0, 0.016), rng.range(-0.03, 0.03)],
      rot: [rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)], parent: g,
    });
  }
  for (let i = 0; i < 5; i++) {
    G.mesh(G.plane(0.016, 0.024), M.leaf(0x3d6b28), {
      pos: [rng.range(-0.04, 0.04), 0.07, rng.range(-0.032, 0.032)],
      rot: [rng.range(-1.4, -0.5), rng.range(0, 3), rng.range(-0.4, 0.4)], parent: g, cast: false,
    });
  }
  return g;
};

// ------------------------------------------------------------- data ----

export const CHAINS = [
  {
    id: 'veg', name: '畑', unlockLevel: 1,
    producer: { id: 'p_veg', name: '野菜の木箱', build: buildVegProducer, cost: 2, capacity: 14, refill: 7 },
    items: [
      { id: 'veg1', name: '種袋', build: buildSeedPouch },
      { id: 'veg2', name: 'トマト', build: buildTomato },
      { id: 'veg3', name: 'トマト箱', build: buildTomatoCrate },
      { id: 'veg4', name: 'トマトソース瓶', build: buildSauceJar },
      { id: 'veg5', name: 'マリナーラ鍋', build: buildMarinaraPot },
    ],
  },
  {
    id: 'bread', name: '窯', unlockLevel: 1,
    producer: { id: 'p_bread', name: '小麦袋', build: buildBreadProducer, cost: 2, capacity: 14, refill: 7 },
    items: [
      { id: 'bread1', name: '麦の束', build: buildWheat },
      { id: 'bread2', name: 'パン生地', build: buildDough },
      { id: 'bread3', name: '田舎パン', build: buildLoaf },
      { id: 'bread4', name: 'バゲット籠', build: buildBaguetteBasket },
      { id: 'bread5', name: 'クロワッサン皿', build: buildCroissantTray },
    ],
  },
  {
    id: 'sea', name: '港', unlockLevel: 3,
    producer: { id: 'p_sea', name: '氷の魚箱', build: buildSeaProducer, cost: 3, capacity: 12, refill: 9 },
    items: [
      { id: 'sea1', name: 'アサリ', build: buildClam },
      { id: 'sea2', name: '鮮魚', build: buildFish },
      { id: 'sea3', name: '魚の木箱', build: buildFishCrate },
      { id: 'sea4', name: '焼き魚の皿', build: buildGrilledFish },
      { id: 'sea5', name: 'パエリア鍋', build: buildPaella },
    ],
  },
  {
    id: 'drink', name: '果樹', unlockLevel: 5,
    producer: { id: 'p_drink', name: '果物籠', build: buildDrinkProducer, cost: 3, capacity: 12, refill: 9 },
    items: [
      { id: 'drink1', name: 'レモン', build: buildLemon },
      { id: 'drink2', name: 'レモネード', build: buildLemonade },
      { id: 'drink3', name: '果汁ピッチャー', build: buildPitcher },
      { id: 'drink4', name: 'カクテル', build: buildCocktail },
      { id: 'drink5', name: 'エスプレッソ', build: buildEspresso },
    ],
  },
];

/** id -> { id, name, chain, tier, build, coin, xp, next } */
export const ITEMS = {};
export const PRODUCERS = {};

for (const chain of CHAINS) {
  chain.items.forEach((it, i) => {
    const tier = i + 1;
    ITEMS[it.id] = {
      ...it,
      chain: chain.id,
      chainName: chain.name,
      tier,
      coin: Math.round(3 * Math.pow(3.1, tier - 1)),
      xp: Math.round(1 * Math.pow(2.4, tier - 1)),
      next: chain.items[i + 1]?.id ?? null,
      isMax: i === chain.items.length - 1,
    };
  });
  PRODUCERS[chain.producer.id] = { ...chain.producer, chain: chain.id, seed: chain.items[0].id };
}

export const chainById = (id) => CHAINS.find((c) => c.id === id);

// ------------------------------------------------------------ meshes ----

const MAX_FOOTPRINT = 0.104;   // fits inside a 113 mm cell with a visible gap
const _box = new THREE.Box3();
const _size = new THREE.Vector3();

/**
 * Build an item's mesh group. The group's origin is the point that rests on
 * the counter, and the result is uniformly scaled so nothing overflows a cell.
 */
export function buildMesh(id) {
  const def = ITEMS[id] || PRODUCERS[id];
  if (!def) throw new Error(`unknown item: ${id}`);
  const g = def.build();
  _box.setFromObject(g);
  _box.getSize(_size);
  const footprint = Math.max(_size.x, _size.z);
  const s = footprint > MAX_FOOTPRINT ? MAX_FOOTPRINT / footprint : 1;
  const wrap = new THREE.Group();
  g.scale.multiplyScalar(s);
  g.position.y -= _box.min.y * s;         // sit exactly on y = 0
  wrap.add(g);
  wrap.userData.height = (_size.y) * s;
  wrap.userData.radius = footprint * s * 0.5;
  wrap.userData.itemId = id;
  return wrap;
}

/** Cheap silhouette copy for order bubbles: same geometry, no shadows. */
export function buildIcon(id) {
  const m = buildMesh(id);
  m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return m;
}
