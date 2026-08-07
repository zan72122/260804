import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { textures } from '../core/textures';
import type { CableDef, DecorDef } from '../core/content';
import { clamp01, lerp, makeRng, smoothstep } from '../core/util';

/**
 * A cable-laying vessel, built to plausible dimensions:
 *   LOA 78 m, beam 16 m, freeboard 4.0 m, draft 5.4 m.
 * Everything the cable touches is a real object in the scene - bellmouth,
 * guide roller, drum engine, linear tensioner, stern sheave - and the cable
 * spine is derived from those same objects' positions.
 */

export const SHIP_L = 78;
export const SHIP_B = 16;
export const DECK_Y = 4.0;
export const KEEL_Y = -5.4;

export const TANK_CENTER = new THREE.Vector3(1.5, DECK_Y, 0);
export const TANK_RADIUS = 6.2;
/**
 * Shallow on purpose. The sea surface is one continuous plane that passes
 * straight through the hull (the hull's inner faces are culled, so nothing
 * occludes it), so a tank floor below the waterline shows open water inside
 * the ship. 2.9 m keeps the whole tank above the wave crests and still reads
 * as a proper below-deck tank.
 */
export const TANK_DEPTH = 2.9;

const BELLMOUTH = new THREE.Vector3(1.5, DECK_Y + 6.6, 0);
const GUIDE = new THREE.Vector3(-10, DECK_Y + 1.0, 0);
const DRUM = new THREE.Vector3(-15.5, DECK_Y - 0.5, 0);
const DRUM_R = 1.5;
const TENS = new THREE.Vector3(-21.5, DECK_Y + 1.0, 0);
/**
 * The overboarding sheave rides at the head of the stern A-frame, ~9.5 m above
 * the waterline, exactly as on a real cable ship. Height is not decoration: it
 * is what gives the cable a long, visible free span from the ship down to the
 * sea instead of vanishing at the waterline the moment it clears the wheel.
 */
const SHEAVE = new THREE.Vector3(-36.2, DECK_Y + 5.5, 0);
const SHEAVE_R = 2.5;

export interface RigPoints {
  bellmouth: THREE.Vector3;
  guide: THREE.Vector3;
  drum: THREE.Vector3;
  tensioner: THREE.Vector3;
  sheave: THREE.Vector3;
  sheaveR: number;
  /** local-space polyline, index 0 = sheave exit (downstream), last = in tank */
  path: THREE.Vector3[];
  /** cumulative arc length of `path` */
  cum: number[];
  /** index in `path` of each station, for UI hinting */
  idxGuide: number;
  idxDrum: number;
  idxTensioner: number;
  idxSheave: number;
}

function arc(
  out: THREE.Vector3[],
  centre: THREE.Vector3,
  radius: number,
  a0: number,
  a1: number,
  steps: number,
) {
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    out.push(new THREE.Vector3(centre.x + Math.cos(a) * radius, centre.y + Math.sin(a) * radius, centre.z));
  }
}

function densify(a: THREE.Vector3, b: THREE.Vector3, steps: number, out: THREE.Vector3[], skipFirst = true) {
  for (let i = skipFirst ? 1 : 0; i <= steps; i++) out.push(new THREE.Vector3().lerpVectors(a, b, i / steps));
}

/** Builds the exact route the cable takes across the deck, in ship-local space. */
export function buildRigPath(): RigPoints {
  // Written upstream-first, then reversed so index 0 is the sheave exit.
  const up: THREE.Vector3[] = [];
  // in the tank, rising up through the overhead bellmouth
  up.push(new THREE.Vector3(TANK_CENTER.x + TANK_RADIUS * 0.55, DECK_Y - TANK_DEPTH + 1.2, 0));
  up.push(new THREE.Vector3(TANK_CENTER.x + TANK_RADIUS * 0.3, DECK_Y - TANK_DEPTH + 2.6, 0));
  up.push(new THREE.Vector3(TANK_CENTER.x + 0.4, DECK_Y + 1.5, 0));
  up.push(BELLMOUTH.clone());
  // bellmouth -> guide roller (comes down and aft)
  densify(BELLMOUTH, new THREE.Vector3(GUIDE.x + 2.2, GUIDE.y + 0.45, 0), 14, up);
  // over the guide roller: on from the forward side, off towards the stern
  arc(up, new THREE.Vector3(GUIDE.x, GUIDE.y - 0.55, 0), 0.55 + 0.12, 0.72, Math.PI - 0.5, 10);
  // down and around the drum engine (a generous over-the-top wrap)
  const drumEntry = new THREE.Vector3(DRUM.x + DRUM_R + 0.15, DRUM.y + 0.9, 0);
  densify(up[up.length - 1], drumEntry, 6, up);
  arc(up, DRUM, DRUM_R + 0.14, 0.55, Math.PI - 0.35, 14);
  // back up into the linear tensioner
  const tensIn = new THREE.Vector3(TENS.x + 3.2, TENS.y, 0);
  densify(up[up.length - 1], tensIn, 8, up);
  densify(tensIn, new THREE.Vector3(TENS.x - 3.2, TENS.y, 0), 8, up);
  // rising lead aft from the linear engine up to the sheave at the A-frame head
  const R = SHEAVE_R + 0.13;
  const onA = 0.42;
  const lead = new THREE.Vector3(SHEAVE.x + Math.cos(onA) * R, SHEAVE.y + Math.sin(onA) * R, 0);
  densify(up[up.length - 1], lead, 14, up);
  // over the top of the sheave and down its AFT face, out over the transom
  // stop just short of the aft horizontal: the cable then leaves the wheel
  // heading down and slightly aft, clear of the transom, and the catenary
  // trails astern from there
  arc(up, SHEAVE, R, onA, Math.PI - 0.12, 20);

  const path = up.reverse();
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));

  // station indices (in the reversed, downstream-first order)
  const n = path.length;
  const findNearest = (p: THREE.Vector3) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = path[i].distanceToSquared(p);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };

  return {
    bellmouth: BELLMOUTH.clone(),
    guide: GUIDE.clone(),
    drum: DRUM.clone(),
    tensioner: TENS.clone(),
    sheave: SHEAVE.clone(),
    sheaveR: SHEAVE_R,
    path,
    cum,
    idxSheave: 0,
    idxTensioner: findNearest(TENS),
    idxDrum: findNearest(DRUM),
    idxGuide: findNearest(GUIDE),
  };
}

// ---------------------------------------------------------------------------
// Hull
// ---------------------------------------------------------------------------

function halfBeamAt(t: number) {
  // t: 0 = transom, 1 = stem
  const parallel = smoothstep(0.12, 0.34, t) * (1 - smoothstep(0.62, 0.99, t));
  const transom = 0.66 + 0.34 * smoothstep(0, 0.3, t);
  const bow = 1 - Math.pow(smoothstep(0.7, 1.0, t), 1.6) * 0.97;
  return (SHIP_B / 2) * Math.min(transom, bow) * (0.9 + parallel * 0.1);
}

function keelAt(t: number) {
  // slight rise of floor aft and a raked stem forward
  return KEEL_Y + smoothstep(0.86, 1.0, t) * 3.4 + smoothstep(0.16, 0.0, t) * 0.9;
}

function sheerAt(t: number) {
  // deck line rises towards the bow
  return DECK_Y + Math.pow(smoothstep(0.55, 1.0, t), 1.7) * 1.9 + smoothstep(0.2, 0.0, t) * 0.25;
}

function buildHullGeometry() {
  const NS = 40;
  const NV = 12;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const ring = NV * 2 - 1;

  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1);
    const x = lerp(-SHIP_L / 2, SHIP_L / 2, t);
    const hb = halfBeamAt(t);
    const ky = keelAt(t);
    const dy = sheerAt(t);
    for (let k = 0; k < ring; k++) {
      // k from 0 (port deck edge) through NV-1 (keel) to ring-1 (stbd deck edge)
      const s = k - (NV - 1); // -(NV-1)..(NV-1)
      const v = 1 - Math.abs(s) / (NV - 1); // 1 at keel, 0 at deck edge
      const side = s === 0 ? 0 : Math.sign(s);
      // section curve: fast rise out of the keel, then flare near the deck
      const wide = Math.pow(1 - v, 0.62);
      const flare = 1 + smoothstep(0.72, 1.0, 1 - v) * smoothstep(0.62, 1.0, t) * 0.5;
      const z = side * hb * wide * flare;
      const y = lerp(ky, dy, Math.pow(1 - v, 0.82));
      verts.push(x, y, z);
      uvs.push(t * 6, (1 - v) * 1.5);
    }
  }
  for (let i = 0; i < NS - 1; i++) {
    for (let k = 0; k < ring - 1; k++) {
      const a = i * ring + k;
      const b = a + 1;
      const c = a + ring;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Deck plating with a circular opening for the cable tank. */
function buildDeckGeometry() {
  const NS = 44;
  const NZ = 16;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const pos: THREE.Vector3[] = [];
  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1);
    const x = lerp(-SHIP_L / 2 + 0.4, SHIP_L / 2 - 0.6, t);
    const tt = clamp01((x + SHIP_L / 2) / SHIP_L);
    const hb = halfBeamAt(tt) * (1 + smoothstep(0.72, 1.0, tt) * 0.5) - 0.35;
    const y = sheerAt(tt);
    for (let k = 0; k < NZ; k++) {
      const z = lerp(-hb, hb, k / (NZ - 1));
      verts.push(x, y, z);
      uvs.push(x * 0.12, z * 0.12);
      pos.push(new THREE.Vector3(x, y, z));
    }
  }
  const rHole = TANK_RADIUS;
  for (let i = 0; i < NS - 1; i++) {
    for (let k = 0; k < NZ - 1; k++) {
      const a = i * NZ + k;
      const b = a + 1;
      const c = a + NZ;
      const d = c + 1;
      // drop quads that fall inside the tank opening
      let inside = 0;
      for (const q of [a, b, c, d]) {
        const p = pos[q];
        if (Math.hypot(p.x - TANK_CENTER.x, p.z - TANK_CENTER.z) < rHole) inside++;
      }
      if (inside >= 3) continue;
      // wound so the plating faces up: here +i is +x and +k is +z, the
      // opposite handedness to the hull loft, so the triplets flip
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface ShipBuild {
  group: THREE.Group;
  rig: RigPoints;
  /** spinning parts, driven by payout speed */
  spinners: { mesh: THREE.Object3D; axis: 'x' | 'z'; radius: number }[];
  tensionerBelts: THREE.Mesh[];
  coils: { mesh: THREE.Mesh; uniforms: { uConsumed: { value: number }; uCount: { value: number } }; count: number };
  /** emissive window / lens quads, so the ship can be seen to be manned */
  deckLights: THREE.Mesh[];
  /** cable-tank inner surface, so the camera can dive into it in prep */
  tankGroup: THREE.Group;
}

export function buildShip(decor: DecorDef, cable: CableDef): ShipBuild {
  const tex = textures();
  const group = new THREE.Group();
  const spinners: ShipBuild['spinners'] = [];
  const deckLights: THREE.Mesh[] = [];

  const paint = new THREE.MeshStandardMaterial({
    map: tex.hullPaint,
    normalMap: tex.hullNormal,
    roughnessMap: tex.hullRough,
    color: 0xdfe4e6,
    roughness: 1,
    metalness: 0.12,
  });
  const hullRed = new THREE.MeshStandardMaterial({
    map: tex.hullPaint,
    normalMap: tex.hullNormal,
    color: 0x8f2f28,
    roughness: 0.85,
    metalness: 0.1,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    map: tex.steel,
    normalMap: tex.steelNormal,
    color: 0xbcc2c6,
    roughness: 0.62,
    metalness: 0.75,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    map: tex.steel,
    color: 0x5a6167,
    roughness: 0.72,
    metalness: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    map: tex.steel,
    color: decor.accent,
    roughness: 0.55,
    metalness: 0.35,
  });
  // Structural gear stays industrial regardless of the chosen decoration -
  // the decoration is trim, not a repaint of the working machinery.
  const safetyMat = new THREE.MeshStandardMaterial({
    map: tex.steel,
    normalMap: tex.steelNormal,
    color: 0xd8a12a,
    roughness: 0.72,
    metalness: 0.3,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    map: tex.deck,
    normalMap: tex.deckNormal,
    color: 0xaab5ad,
    roughness: 0.95,
    metalness: 0.05,
  });

  // ---- hull ---------------------------------------------------------------
  const hull = new THREE.Mesh(buildHullGeometry(), paint);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // boot-topping: a slightly larger, clipped copy below the waterline
  {
    const g = buildHullGeometry();
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > -0.35) {
        p.setY(i, -0.35);
      }
      const sc = 1.006;
      p.setX(i, p.getX(i) * sc);
      p.setZ(i, p.getZ(i) * sc);
    }
    g.computeVertexNormals();
    const boot = new THREE.Mesh(g, hullRed);
    group.add(boot);
  }

  const deck = new THREE.Mesh(buildDeckGeometry(), deckMat);
  deck.receiveShadow = true;
  group.add(deck);

  // bulwarks along the working deck
  {
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const NS = 26;
      for (let i = 0; i < NS - 1; i++) {
        const t0 = lerp(0.02, 0.62, i / (NS - 1));
        const t1 = lerp(0.02, 0.62, (i + 1) / (NS - 1));
        const x0 = lerp(-SHIP_L / 2, SHIP_L / 2, t0);
        const x1 = lerp(-SHIP_L / 2, SHIP_L / 2, t1);
        const z0 = side * (halfBeamAt(t0) - 0.3);
        const z1 = side * (halfBeamAt(t1) - 0.3);
        const y0 = sheerAt(t0);
        const len = Math.hypot(x1 - x0, z1 - z0);
        const b = new THREE.BoxGeometry(len, 1.25, 0.22);
        b.translate(0, 0.62, 0);
        const m = new THREE.Matrix4();
        m.makeRotationY(-Math.atan2(z1 - z0, x1 - x0));
        m.setPosition((x0 + x1) / 2, y0, (z0 + z1) / 2);
        b.applyMatrix4(m);
        parts.push(b);
      }
    }
    const merged = mergeGeometries(parts, false);
    if (merged) group.add(new THREE.Mesh(merged, paint));
    parts.forEach((p) => p.dispose());
  }

  // ---- cable tank ---------------------------------------------------------
  const tankGroup = new THREE.Group();
  tankGroup.position.copy(TANK_CENTER);
  group.add(tankGroup);
  {
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(TANK_RADIUS, TANK_RADIUS, TANK_DEPTH, 44, 1, true),
      new THREE.MeshStandardMaterial({
        map: tex.steel,
        color: 0x7d858b,
        roughness: 0.8,
        metalness: 0.5,
        side: THREE.BackSide,
      }),
    );
    wall.position.y = -TANK_DEPTH / 2;
    tankGroup.add(wall);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(TANK_RADIUS, 44),
      new THREE.MeshStandardMaterial({ map: tex.steel, color: 0x6d757b, roughness: 0.9, metalness: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -TANK_DEPTH;
    tankGroup.add(floor);
    // central cone, exactly as in a real cable tank
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 2.1, 28),
      new THREE.MeshStandardMaterial({ map: tex.steel, color: 0x98a0a6, roughness: 0.7, metalness: 0.6 }),
    );
    cone.position.y = -TANK_DEPTH + 1.05;
    tankGroup.add(cone);
    // Flat collar around the opening. The deck grid can only cut the hole to
    // quad resolution, so without this you can see straight through the gap
    // into the (backface-culled) hull and out to the sea.
    const collar = new THREE.Mesh(
      new THREE.RingGeometry(TANK_RADIUS - 0.05, TANK_RADIUS + 3.2, 48, 1),
      deckMat,
    );
    collar.rotation.x = -Math.PI / 2;
    collar.position.y = 0.02;
    tankGroup.add(collar);
    // coaming ring at deck level
    const coam = new THREE.Mesh(
      new THREE.TorusGeometry(TANK_RADIUS + 0.18, 0.28, 8, 48),
      accentMat,
    );
    coam.rotation.x = Math.PI / 2;
    tankGroup.add(coam);
  }

  // ---- coils inside the tank ---------------------------------------------
  const coils = (() => {
    const layers = 5;
    const perLayer = 11;
    const tube = 0.12;
    const geos: THREE.BufferGeometry[] = [];
    const coilIds: number[] = [];
    let id = 0;
    const total = layers * perLayer;
    for (let L = 0; L < layers; L++) {
      const y = -TANK_DEPTH + 0.42 + L * (tube * 2.05);
      for (let r = 0; r < perLayer; r++) {
        // top layer pays out first, and within a layer the outside goes first
        const major = 2.35 + r * ((TANK_RADIUS - 2.9) / (perLayer - 1));
        const g = new THREE.TorusGeometry(major, tube, 6, 46);
        g.rotateX(Math.PI / 2);
        g.translate(0, y + (r % 2) * tube * 0.35, 0);
        const c = g.attributes.position.count;
        const order = (layers - 1 - L) * perLayer + (perLayer - 1 - r);
        for (let i = 0; i < c; i++) coilIds.push(order);
        geos.push(g);
        id++;
      }
    }
    const merged = mergeGeometries(geos, false)!;
    geos.forEach((g) => g.dispose());
    merged.setAttribute('aCoil', new THREE.Float32BufferAttribute(coilIds, 1));
    const uniforms = { uConsumed: { value: 0 }, uCount: { value: total } };
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cable.jacket).multiplyScalar(1.9),
      roughness: 0.5,
      metalness: 0.2,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uConsumed = uniforms.uConsumed;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float aCoil;\nuniform float uConsumed;\nvarying float vHide;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float k = clamp((aCoil - uConsumed + 1.0), 0.0, 1.0);
           transformed *= k;
           vHide = k;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying float vHide;`)
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\nif (vHide < 0.02) discard;`);
    };
    const mesh = new THREE.Mesh(merged, mat);
    mesh.frustumCulled = false;
    tankGroup.add(mesh);
    void id;
    return { mesh, uniforms, count: total };
  })();

  // ---- overhead bellmouth gantry -----------------------------------------
  {
    const gantry = new THREE.Group();
    const legMat = steelMat;
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 7.4, 10), legMat);
      leg.position.set(TANK_CENTER.x, DECK_Y + 3.7, s * (TANK_RADIUS + 0.9));
      gantry.add(leg);
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 5.4, 8), legMat);
      brace.position.set(TANK_CENTER.x, DECK_Y + 3.2, s * (TANK_RADIUS * 0.6));
      brace.rotation.x = s * 0.62;
      gantry.add(brace);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, (TANK_RADIUS + 0.9) * 2), safetyMat);
    beam.position.set(TANK_CENTER.x, DECK_Y + 7.3, 0);
    gantry.add(beam);
    // the bellmouth itself - a flared ring the cable rises through
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.5, 1.5, 24, 1, true), darkSteel);
    bell.material.side = THREE.DoubleSide;
    bell.position.copy(BELLMOUTH);
    gantry.add(bell);
    const bellRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 8, 26), accentMat);
    bellRing.rotation.x = Math.PI / 2;
    bellRing.position.copy(BELLMOUTH).add(new THREE.Vector3(0, 0.75, 0));
    gantry.add(bellRing);
    group.add(gantry);
  }

  // ---- guide roller -------------------------------------------------------
  {
    const g = new THREE.Group();
    g.position.copy(GUIDE).add(new THREE.Vector3(0, -0.55, 0));
    // grooved roller, axis across the ship
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 20), steelMat);
    roller.rotation.x = Math.PI / 2;
    g.add(roller);
    spinners.push({ mesh: roller, axis: 'z', radius: 0.55 });
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.16, 20), steelMat);
      cheek.rotation.x = Math.PI / 2;
      cheek.position.z = s * 0.8;
      g.add(cheek);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.4), darkSteel);
      post.position.set(0, -1.1, s * 1.05);
      g.add(post);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 3.0), darkSteel);
    base.position.y = -1.95;
    g.add(base);
    // vertical side rollers, the fairlead pair
    for (const s of [-1, 1]) {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.5, 14), steelMat);
      v.position.set(-1.1, 0.35, s * 0.62);
      g.add(v);
    }
    group.add(g);
  }

  // ---- drum engine (capstan) ---------------------------------------------
  {
    const g = new THREE.Group();
    g.position.copy(DRUM);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, 2.1, 30), steelMat);
    drum.rotation.x = Math.PI / 2;
    g.add(drum);
    spinners.push({ mesh: drum, axis: 'z', radius: DRUM_R });
    for (const s of [-1, 1]) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R + 0.4, DRUM_R + 0.4, 0.22, 30), safetyMat);
      flange.rotation.x = Math.PI / 2;
      flange.position.z = s * 1.12;
      g.add(flange);
      const bearing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.7), darkSteel);
      bearing.position.set(0, -1.2, s * 1.6);
      g.add(bearing);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 4.4), darkSteel);
    bed.position.y = -2.5;
    g.add(bed);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 16), darkSteel);
    motor.rotation.x = Math.PI / 2;
    motor.position.set(-1.6, -1.0, 2.4);
    g.add(motor);
    group.add(g);
  }

  // ---- linear (caterpillar) tensioner -------------------------------------
  const tensionerBelts: THREE.Mesh[] = [];
  {
    const g = new THREE.Group();
    g.position.copy(TENS);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.55, 2.9), safetyMat);
    frame.position.y = -2.0;
    g.add(frame);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.0, 0.35), darkSteel);
      side.position.set(0, -0.4, s * 1.6);
      g.add(side);
    }
    // upper and lower gripping tracks
    for (const s of [1, -1]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.42, 1.5), new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.95 }));
      track.position.set(0, s * 0.62, 0);
      g.add(track);
      tensionerBelts.push(track);
      // pads on the belt so movement is visible
      for (let i = 0; i < 10; i++) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 1.4), new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.9 }));
        pad.position.set(-2.7 + i * 0.6, s * 0.32, 0);
        track.add(pad);
      }
      for (const ex of [-2.9, 2.9]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.55, 16), steelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(ex, s * 0.62, 0);
        g.add(wheel);
        spinners.push({ mesh: wheel, axis: 'z', radius: 0.42 });
      }
    }
    // control cabinet with a little display
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 1.0), paint);
    cab.position.set(1.6, -1.0, 2.6);
    g.add(cab);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x6effc8 }),
    );
    screen.position.set(1.6, -0.6, 3.11);
    g.add(screen);
    deckLights.push(screen);
    group.add(g);
  }

  // ---- stern sheave -------------------------------------------------------
  {
    const g = new THREE.Group();
    g.position.copy(SHEAVE);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(SHEAVE_R, SHEAVE_R, 1.0, 40), steelMat);
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
    spinners.push({ mesh: wheel, axis: 'z', radius: SHEAVE_R });
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CylinderGeometry(SHEAVE_R + 0.42, SHEAVE_R + 0.42, 0.2, 40), accentMat);
      cheek.rotation.x = Math.PI / 2;
      cheek.position.z = s * 0.6;
      g.add(cheek);
      // spokes
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.34, SHEAVE_R * 1.85, 0.12), darkSteel);
        sp.rotation.z = (i / 6) * Math.PI;
        sp.position.z = s * 0.72;
        g.add(sp);
      }
    }
    const hubL = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.2, 14), darkSteel);
    hubL.rotation.x = Math.PI / 2;
    g.add(hubL);
    // A-frame carrying the sheave head out over the transom. Group-local y = 0
    // is the sheave centre, so the deck is at -(SHEAVE.y - DECK_Y).
    const deckDrop = SHEAVE.y - DECK_Y;
    for (const s of [-1, 1]) {
      const legLen = Math.hypot(deckDrop, 4.4) + 0.6;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, legLen, 12), safetyMat);
      leg.position.set(2.2, -deckDrop / 2, s * 2.0);
      leg.rotation.z = Math.atan2(4.4, deckDrop);
      g.add(leg);
      const aftLen = Math.hypot(deckDrop, 1.4) + 0.4;
      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, aftLen, 12), steelMat);
      leg2.position.set(-0.7, -deckDrop / 2, s * 1.95);
      leg2.rotation.z = -Math.atan2(1.4, deckDrop);
      g.add(leg2);
      // knee brace
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), steelMat);
      brace.position.set(0.8, -deckDrop * 0.55, s * 2.0);
      brace.rotation.z = 1.0;
      g.add(brace);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), safetyMat);
    cross.position.set(0, 0.9, 0);
    g.add(cross);
    const crossLow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 4.6), steelMat);
    crossLow.position.set(1.2, -deckDrop * 0.62, 0);
    g.add(crossLow);
    group.add(g);
  }

  // ---- superstructure -----------------------------------------------------
  {
    const s = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(20, 3.6, 12.4), paint);
    base.position.set(19, DECK_Y + 2.1, 0);
    s.add(base);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, 11.2), paint);
    mid.position.set(19.5, DECK_Y + 5.5, 0);
    s.add(mid);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(10.5, 3.0, 12.6), paint);
    bridge.position.set(16.5, DECK_Y + 8.6, 0);
    s.add(bridge);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.3, 13.2), darkSteel);
    roof.position.set(16.5, DECK_Y + 10.2, 0);
    s.add(roof);

    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0f2733,
      roughness: 0.12,
      metalness: 0.6,
      emissive: 0xffd9a0,
      emissiveIntensity: 0.35,
    });
    // bridge windows, raked forward
    for (let i = 0; i < 9; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.5), winMat);
      const a = (i / 8 - 0.5) * 1.6;
      w.position.set(16.5 + Math.cos(a) * 5.4, DECK_Y + 8.9, Math.sin(a) * 6.4);
      w.rotation.y = Math.PI / 2 - a;
      s.add(w);
      deckLights.push(w);
    }
    // accommodation portholes
    for (let i = 0; i < 8; i++)
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), winMat);
        p.position.set(12 + i * 2.0, DECK_Y + 2.4, side * 6.25);
        p.rotation.y = side > 0 ? 0 : Math.PI;
        s.add(p);
        deckLights.push(p);
      }
    // funnel
    const funnel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.2, 4.2), paint);
    funnel.position.set(25.5, DECK_Y + 8.0, 0);
    s.add(funnel);
    const band = new THREE.Mesh(new THREE.BoxGeometry(3.32, 1.5, 4.32), accentMat);
    band.position.set(25.5, DECK_Y + 9.3, 0);
    s.add(band);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.4, 12), darkSteel);
    stack.position.set(25.5, DECK_Y + 11.0, 0);
    s.add(stack);
    // mast + radar
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 6.5, 10), steelMat);
    mast.position.set(15.0, DECK_Y + 13.4, 0);
    s.add(mast);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.34, 3.6), steelMat);
    radar.position.set(15.0, DECK_Y + 16.4, 0);
    s.add(radar);
    spinners.push({ mesh: radar, axis: 'x', radius: -0.06 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), paint);
    dome.position.set(12.6, DECK_Y + 11.0, 3.6);
    s.add(dome);
    // masthead light
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    );
    navLight.position.set(15.0, DECK_Y + 17.0, 0);
    s.add(navLight);
    deckLights.push(navLight);
    group.add(s);
  }

  // ---- deck cranes, containers and A-frame furniture -----------------------
  {
    const crane = new THREE.Group();
    crane.position.set(8.5, DECK_Y, -5.6);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 3.0, 14), safetyMat);
    ped.position.y = 1.5;
    crane.add(ped);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.6, 0.7), safetyMat);
    jib.position.set(3.6, 4.4, 0);
    jib.rotation.z = 0.42;
    crane.add(jib);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.6), paint);
    cab.position.set(-0.9, 3.6, 0);
    crane.add(cab);
    group.add(crane);

    const boxMat = new THREE.MeshStandardMaterial({ map: tex.hullPaint, color: 0x4d7f8c, roughness: 0.9, metalness: 0.15 });
    const rng = makeRng(5);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 5.2), i % 2 ? boxMat : paint);
      b.position.set(-25 + i * 3.0, DECK_Y + 1.1, (rng() > 0.5 ? 1 : -1) * 5.0);
      group.add(b);
    }
    // life raft canisters
    for (const s of [-1, 1]) {
      const raft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.7 }));
      raft.rotation.z = Math.PI / 2;
      raft.position.set(11.5, DECK_Y + 4.5, s * 6.4);
      group.add(raft);
    }
  }

  // ---- railings -----------------------------------------------------------
  {
    const posts: THREE.BufferGeometry[] = [];
    const rails: THREE.BufferGeometry[] = [];
    const add = (x0: number, z0: number, x1: number, z1: number, y: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(2, Math.round(len / 1.8));
      for (let i = 0; i <= n; i++) {
        const p = new THREE.CylinderGeometry(0.045, 0.045, 1.05, 6);
        p.translate(lerp(x0, x1, i / n), y + 0.52, lerp(z0, z1, i / n));
        posts.push(p);
      }
      for (const hy of [0.45, 0.95]) {
        const r = new THREE.BoxGeometry(len, 0.05, 0.05);
        const m = new THREE.Matrix4();
        m.makeRotationY(-Math.atan2(z1 - z0, x1 - x0));
        m.setPosition((x0 + x1) / 2, y + hy, (z0 + z1) / 2);
        r.applyMatrix4(m);
        rails.push(r);
      }
    };
    // bow railing following the sheer
    for (const side of [-1, 1]) {
      const NS = 10;
      for (let i = 0; i < NS - 1; i++) {
        const t0 = lerp(0.66, 0.985, i / (NS - 1));
        const t1 = lerp(0.66, 0.985, (i + 1) / (NS - 1));
        const x0 = lerp(-SHIP_L / 2, SHIP_L / 2, t0);
        const x1 = lerp(-SHIP_L / 2, SHIP_L / 2, t1);
        const f0 = 1 + smoothstep(0.72, 1.0, t0) * 0.5;
        const f1 = 1 + smoothstep(0.72, 1.0, t1) * 0.5;
        add(x0, side * (halfBeamAt(t0) * f0 - 0.4), x1, side * (halfBeamAt(t1) * f1 - 0.4), sheerAt(t0));
      }
      add(11.0, side * 6.3, 30.0, side * 6.3, DECK_Y + 3.9);
    }
    const pg = mergeGeometries(posts, false);
    const rg = mergeGeometries(rails, false);
    if (pg) group.add(new THREE.Mesh(pg, steelMat));
    if (rg) group.add(new THREE.Mesh(rg, steelMat));
    posts.forEach((g) => g.dispose());
    rails.forEach((g) => g.dispose());
  }

  // ---- working floodlights -------------------------------------------------
  // No real spotlight here: in daylight it contributes nothing visible and it
  // would cost a spot-light loop iteration on every lit pixel all game. The
  // lamp housings and their emissive lenses carry the read.
  {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 9.0, 10), steelMat);
    mast.position.set(-16, DECK_Y + 4.5, 0);
    group.add(mast);
    for (const s of [-1, 1]) {
      const lampBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.9), darkSteel);
      lampBody.position.set(-16, DECK_Y + 8.6, s * 1.1);
      group.add(lampBody);
      const lens = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.62),
        new THREE.MeshBasicMaterial({ color: decor.lamp }),
      );
      lens.position.set(-16.32, DECK_Y + 8.6, s * 1.1);
      lens.rotation.y = -Math.PI / 2;
      group.add(lens);
      deckLights.push(lens);
    }
  }

  // ---- decorative trim (pink / rainbow / stars) ---------------------------
  if (decor.stars || decor.rainbow) {
    const rng = makeRng(12);
    const starGeos: THREE.BufferGeometry[] = [];
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 0.5 : 0.22;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    for (let i = 0; i < 12; i++) {
      const g = new THREE.ShapeGeometry(shape);
      const s = 0.9 + rng() * 0.7;
      g.scale(s, s, s);
      const m = new THREE.Matrix4();
      const side = rng() > 0.5 ? 1 : -1;
      const t = 0.2 + rng() * 0.35;
      const x = lerp(-SHIP_L / 2, SHIP_L / 2, t);
      m.makeRotationY(side > 0 ? 0 : Math.PI);
      m.setPosition(x, 1.4 + rng() * 1.4, side * (halfBeamAt(t) + 0.08));
      g.applyMatrix4(m);
      starGeos.push(g);
    }
    const merged = mergeGeometries(starGeos, false);
    if (merged) {
      const mat = new THREE.MeshStandardMaterial({
        color: decor.rainbow ? 0xffffff : decor.accent,
        emissive: decor.accent,
        emissiveIntensity: 0.25,
        roughness: 0.5,
        side: THREE.DoubleSide,
      });
      group.add(new THREE.Mesh(merged, mat));
    }
    starGeos.forEach((g) => g.dispose());
  }
  if (decor.rainbow) {
    // a slim rainbow band along the hull side - decoration, not a repaint
    const cols = [0xff5a5a, 0xffa64d, 0xffe34d, 0x6fdc6f, 0x5ab7ff, 0xa87bff];
    cols.forEach((c, i) => {
      const t0 = 0.18 + i * 0.055;
      const x = lerp(-SHIP_L / 2, SHIP_L / 2, t0 + 0.027);
      for (const side of [-1, 1]) {
        const band = new THREE.Mesh(
          new THREE.PlaneGeometry(SHIP_L * 0.055, 0.55),
          new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }),
        );
        band.position.set(x, 2.05, side * (halfBeamAt(t0 + 0.027) + 0.06));
        band.rotation.y = side > 0 ? 0 : Math.PI;
        group.add(band);
      }
    });
  }

  return {
    group,
    rig: buildRigPath(),
    spinners,
    tensionerBelts,
    coils,
    deckLights,
    tankGroup,
  };
}
