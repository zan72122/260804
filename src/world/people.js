// Low-poly but correctly proportioned people. They exist for scale: a 1.72 m
// figure standing at the counter is what tells you the counter is 0.92 m and
// the buildings behind are four storeys.

import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as G from '../engine/geo.js';

const SKINS = [0xe8c0a0, 0xd8a583, 0xb9805c, 0x8d5f42, 0x5f3d2b, 0xf0d3b8];
const HAIRS = [0x241a14, 0x4a3020, 0x6e5a44, 0x151515, 0x8a7250, 0xa03d28];
const COATS = [0x3d4a5c, 0x6b3a34, 0x2f4a3f, 0x7a6a4f, 0x4a3f5c, 0x8a7a63, 0xa8483a, 0x2f5f6b];

/**
 * @param {Function} rng  deterministic random source
 * @param {object}   o    { height, detail: 'far'|'near' }
 */
export function buildPerson(rng, o = {}) {
  const height = o.height ?? rng.range(1.6, 1.86);
  const detail = o.detail ?? 'far';
  const s = height / 1.75;
  const g = new THREE.Group();

  const skinCol = o.skin ?? rng.pick(SKINS);
  const skin = M.skin(skinCol);
  const coatCol = o.coat ?? rng.pick(COATS);
  const coat = M.cloth(coatCol, 0.94);
  const trouser = M.cloth(rng.pick([0x2b2f36, 0x3f3a30, 0x4a4f58, 0x5c4636]), 0.95);
  const hairMat = M.hair(rng.pick(HAIRS));

  // Legs — separate so they can swing when walking.
  const legs = new THREE.Group();
  const hipY = 0.9;
  const l1 = G.mesh(G.capsule(0.072, 0.42, detail === 'near' ? 10 : 6), trouser, { pos: [-0.078, -0.24, 0], parent: legs });
  const l2 = G.mesh(G.capsule(0.072, 0.42, detail === 'near' ? 10 : 6), trouser, { pos: [0.078, -0.24, 0], parent: legs });
  legs.position.y = hipY;
  g.add(legs);
  for (const l of [l1, l2]) {
    G.mesh(G.box(0.085, 0.045, 0.16, 0.02), M.cloth(0x27211c, 0.7), {
      pos: [l.position.x, -0.47, 0.03], parent: legs,
    });
  }

  // Torso — a tapered box reads as a coat better than a capsule does.
  const torso = G.mesh(G.box(0.3, 0.46, 0.19, 0.055), coat, { pos: [0, 1.16, 0], parent: g });
  G.mesh(G.box(0.32, 0.06, 0.21, 0.03), coat, { pos: [0, 1.36, 0], parent: g });   // shoulders

  // Arms.
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.175, 1.34, 0);
    const upper = G.mesh(G.capsule(0.052, 0.2, detail === 'near' ? 10 : 6), coat, { pos: [0, -0.12, 0], parent: shoulder });
    const fore = new THREE.Group();
    fore.position.set(0, -0.24, 0);
    G.mesh(G.capsule(0.045, 0.18, detail === 'near' ? 10 : 6), coat, { pos: [0, -0.11, 0], parent: fore });
    G.mesh(G.blob(0.045, 0.9, 1.1, 0.7, 8), skin, { pos: [0, -0.22, 0], parent: fore });
    shoulder.add(fore);
    shoulder.rotation.z = sx * 0.08;
    g.add(shoulder);
    arms.push({ shoulder, fore, side: sx });
  }

  // Head.
  G.mesh(G.cyl(0.045, 0.05, 0.07, 8), skin, { pos: [0, 1.44, 0], parent: g });
  const head = new THREE.Group();
  head.position.set(0, 1.56, 0);
  g.add(head);
  G.mesh(G.blob(0.105, 0.92, 1.12, 0.96, detail === 'near' ? 16 : 10), skin, { parent: head });
  G.mesh(G.blob(0.108, 0.96, 0.86, 1.0, detail === 'near' ? 16 : 10), hairMat, { pos: [0, 0.035, -0.006], parent: head });
  if (detail === 'near') {
    // Eyes and a nose: just enough for a customer to have a face at 1 m.
    for (const sx of [-1, 1]) {
      G.mesh(G.sphere(0.012, 8), M.ceramic(0xf6f4f0, 0.2), { pos: [sx * 0.035, 0.012, 0.088], parent: head, cast: false });
      G.mesh(G.sphere(0.0062, 8), new THREE.MeshStandardMaterial({ color: 0x1b1512, roughness: 0.25 }),
        { pos: [sx * 0.037, 0.012, 0.096], parent: head, cast: false });
      G.mesh(G.box(0.03, 0.006, 0.006, 0.002), hairMat, { pos: [sx * 0.036, 0.036, 0.09], rot: [0, 0, sx * 0.12], parent: head, cast: false });
    }
    G.mesh(G.cone(0.014, 0.028, 8), M.skin(skinCol), { pos: [0, -0.008, 0.098], rot: [1.35, 0, 0], parent: head, cast: false });
    G.mesh(G.torus(0.016, 0.004, 10, 5, Math.PI), M.skin(skinCol), { pos: [0, -0.045, 0.08], rot: [0.2, 0, Math.PI], parent: head, cast: false });
  }

  // Accessories: hats, scarves, bags — variety without extra rigs.
  const acc = rng();
  if (acc < 0.22) {
    G.mesh(G.cyl(0.115, 0.115, 0.012, 14), M.cloth(0xd8c9a8, 0.9), { pos: [0, 0.09, 0], parent: head });
    G.mesh(G.cyl(0.085, 0.095, 0.07, 14), M.cloth(0xd8c9a8, 0.9), { pos: [0, 0.125, 0], parent: head });
  } else if (acc < 0.36) {
    G.mesh(G.blob(0.112, 1, 0.7, 1, 12), M.cloth(rng.pick([0x8a3b32, 0x2f4a5c, 0x4a5f3a]), 0.95),
      { pos: [0, 0.06, 0], parent: head });
  }
  if (rng() < 0.3) {
    G.mesh(G.torus(0.1, 0.022, 12, 6), M.cloth(rng.pick([0xa8483a, 0x3f5a78, 0xc9a45c]), 0.98),
      { pos: [0, 1.4, 0], rot: [Math.PI / 2, 0, 0], parent: g });
  }
  if (rng() < 0.35) {
    const bag = G.group({ pos: [0.2, 1.02, 0.02], rot: [0, 0, 0.1], parent: g });
    G.mesh(G.box(0.16, 0.2, 0.08, 0.02), M.sackcloth(0xc0a87c), { parent: bag });
    G.mesh(G.torus(0.07, 0.008, 12, 5, Math.PI), M.sackcloth(0x8a6a3c), { pos: [0, 0.1, 0], parent: bag });
  }

  g.userData = { legs: [l1, l2], head, arms, torso, height };
  g.scale.setScalar(s);
  return g;
}

/** Walk cycle driver shared by background walkers and arriving customers. */
export function walkPose(person, phase, amount = 1) {
  const [l1, l2] = person.userData.legs;
  l1.rotation.x = Math.sin(phase) * 0.55 * amount;
  l2.rotation.x = -Math.sin(phase) * 0.55 * amount;
  for (const a of person.userData.arms) {
    a.shoulder.rotation.x = -Math.sin(phase) * 0.42 * amount * a.side;
  }
  return Math.abs(Math.sin(phase * 2)) * 0.016 * amount;
}

/** Standing-around pose: weight shifts, small head turns, arm settle. */
export function idlePose(person, t, seed = 0) {
  const sway = Math.sin(t * 0.8 + seed) * 0.02;
  person.rotation.z = sway * 0.3;
  person.userData.head.rotation.y = Math.sin(t * 0.42 + seed * 2) * 0.28;
  person.userData.head.rotation.x = Math.sin(t * 0.31 + seed) * 0.08;
  for (const a of person.userData.arms) {
    a.shoulder.rotation.x = Math.sin(t * 0.6 + seed + a.side) * 0.06 - 0.05;
    a.shoulder.rotation.z = a.side * (0.08 + Math.sin(t * 0.5 + seed) * 0.02);
  }
  const [l1, l2] = person.userData.legs;
  l1.rotation.x = 0; l2.rotation.x = 0;
}
