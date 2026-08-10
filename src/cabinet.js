// The arcade cabinet: base with the prize chute, glazed showcase, gantry rails
// and marquee. Dimensions here are the single source of truth for the whole
// game (aim bounds, physics walls, claw travel).

import * as THREE from '../vendor/three/three.module.min.js';
import {
  acrylicMaterial, plasticMaterial, clawMetalMaterial, darkMetalMaterial, emissiveMaterial,
} from './materials.js';
import { matTexture, marqueeTexture, smudgeMap, softBlob, backdropTexture } from './textures.js';
import { mergeStatic } from './merge.js';

// Single source of truth for every dimension in the game. The case is only
// slightly wider than before but much deeper: depth foreshortens under the 3/4
// camera, so it buys room for a twelve-toy heap without shrinking any toy on
// screen (widening the case would, because the camera fits to its width).
export const CAB = {
  inX: 1.28,          // interior half width
  inZ: 1.16,          // interior half depth
  floorY: 0,
  ceilY: 2.10,
  railY: 1.90,
  clawHomeY: 1.56,
  clawFloorY: 0.34,   // lowest the claw tip goes over the pile
  baseBottom: -1.5,
  hole: { x: -0.84, z: 0.70, r: 0.34, rim: 0.40 },
  binY: -1.18,
  /** delivery tray under the chute */
  bin: { x: -0.84, halfW: 0.48, zFrom: -0.24, zTo: 0.92 },
  /** opening in the front of the base you see the prize land through */
  // raised lintel: the biggest prize resting on the tray floor reaches y ≈ -0.36,
  // so an opening that stopped at -0.44 clipped the top of it off
  win: { l: -1.32, r: -0.34, b: -1.26, t: -0.28 },
  /** walls a falling prize is kept inside on its way down the chute */
  chute: { minX: -1.22, maxX: -0.46, minZ: -0.10, maxZ: 0.94 },
  aim: { minX: -1.04, maxX: 1.04, minZ: -0.92, maxZ: 0.68 },
};

// The cabinet is all boxes; the chrome trims read as the bevels, which is far
// cheaper than actually rounding every edge.
function box(parent, w, h, d, mat, p, r) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  m.userData.mergeable = true;   // the cabinet shell never moves
  parent.add(m);
  return m;
}

/** Floor plane with a hole cut for the prize chute. */
function floorWithHole() {
  const shape = new THREE.Shape();
  shape.moveTo(-CAB.inX, -CAB.inZ);
  shape.lineTo(CAB.inX, -CAB.inZ);
  shape.lineTo(CAB.inX, CAB.inZ);
  shape.lineTo(-CAB.inX, CAB.inZ);
  shape.closePath();
  const hole = new THREE.Path();
  // shape-space +Y becomes world -Z after the rotateX below
  hole.absarc(CAB.hole.x, -CAB.hole.z, CAB.hole.r, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ShapeGeometry(shape, 24);
  g.rotateX(-Math.PI / 2);
  // ShapeGeometry uv is in shape space; remap for the mat texture
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + CAB.inX) / (CAB.inX * 2) * 2, (uv.getY(i) + CAB.inZ) / (CAB.inZ * 2) * 1.5);
  }
  return g;
}

export function buildCabinet(scene, { quality = 1 } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const shellMat = plasticMaterial(0xf5f7fa, { roughness: 0.42, metalness: 0.08, clearcoat: 0.7 });
  const accentMat = plasticMaterial(0xff8fb8, { roughness: 0.3, metalness: 0.1, clearcoat: 0.9 });
  const trimMat = clawMetalMaterial();
  const darkMat = plasticMaterial(0x2f3440, { roughness: 0.55, metalness: 0.2, clearcoat: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 1, roughness: 0.12, envMapIntensity: 1.8 });

  const OX = CAB.inX + 0.07;   // outer half width
  const OZ = CAB.inZ + 0.07;

  /* ---------------- base cabinet ---------------- */
  const baseH = -CAB.baseBottom;
  const baseTopY = CAB.floorY - 0.02;

  // side + back walls of the base
  box(group, 0.09, baseH, OZ * 2, shellMat, [-OX + 0.045, baseTopY - baseH / 2, 0]);
  box(group, 0.09, baseH, OZ * 2, shellMat, [OX - 0.045, baseTopY - baseH / 2, 0]);
  box(group, OX * 2, baseH, 0.09, shellMat, [0, baseTopY - baseH / 2, -OZ + 0.045]);
  // front of the base: split around the delivery window (left side)
  const { l: winL, r: winR, b: winB, t: winT } = CAB.win;
  const fz = OZ - 0.045;
  box(group, OX * 2, baseTopY - winT, 0.09, accentMat, [0, (baseTopY + winT) / 2, fz]);                       // above window
  box(group, OX * 2, winB - CAB.baseBottom, 0.09, shellMat, [0, (winB + CAB.baseBottom) / 2, fz]);             // below window
  box(group, winL + OX, winT - winB, 0.09, shellMat, [(-OX + winL) / 2, (winT + winB) / 2, fz]);               // left of window
  box(group, OX - winR, winT - winB, 0.09, shellMat, [(OX + winR) / 2, (winT + winB) / 2, fz]);                // right of window
  // window frame; clamped so its mitred overlap can't poke past the shell —
  // at this width the window's left edge sits only ~0.01 from the case's own
  // outer wall (winL -1.34 vs -OX -1.35), far tighter than the old cabinet
  const hL = Math.max(winL - 0.05, -OX + 0.005), hR = Math.min(winR + 0.05, OX - 0.005);
  const vL = Math.max(winL - 0.02, -OX + 0.03), vR = Math.min(winR + 0.02, OX - 0.03);
  const frameMat = chrome;
  box(group, hR - hL, 0.05, 0.13, frameMat, [(hL + hR) / 2, winT + 0.02, fz]);
  box(group, hR - hL, 0.05, 0.13, frameMat, [(hL + hR) / 2, winB - 0.02, fz]);
  box(group, 0.05, winT - winB + 0.1, 0.13, frameMat, [vL, (winT + winB) / 2, fz]);
  box(group, 0.05, winT - winB + 0.1, 0.13, frameMat, [vR, (winT + winB) / 2, fz]);

  // base top deck (everything except the interior opening is solid)
  box(group, OX * 2, 0.06, OZ * 2, shellMat, [0, baseTopY - 0.03, 0]);

  // delivery bin: a tray you can see into through the window, centered under
  // the hole so a straight drop lands inside it with no lateral drift needed
  const binMat = plasticMaterial(0x59617a, { roughness: 0.62, metalness: 0.1, clearcoat: 0.2 });
  const bin = new THREE.Group();
  group.add(bin);
  const { x: bx, halfW: bHalf, zFrom: bz0, zTo: bz1 } = CAB.bin;
  const bw = bHalf * 2, bzLen = bz1 - bz0, bzMid = (bz0 + bz1) / 2;
  const binFloor = box(bin, bw, 0.05, bzLen, binMat, [bx, CAB.binY, bzMid]);
  binFloor.receiveShadow = true;
  box(bin, 0.05, 0.5, bzLen, binMat, [bx - bHalf, CAB.binY + 0.25, bzMid]);
  box(bin, 0.05, 0.5, bzLen, binMat, [bx + bHalf, CAB.binY + 0.25, bzMid]);
  box(bin, bw, 0.5, 0.05, binMat, [bx, CAB.binY + 0.25, bz0]);
  // chute back wall, slanted, so a falling prize is guided forward toward
  // the open front (the window looks in from the +z side)
  box(bin, bw, 0.9, 0.04, binMat, [bx, -0.62, bz0 + 0.03], [0.32, 0, 0]);
  // soft light inside the bin so the landed prize is readable
  const binLight = new THREE.PointLight(0xffe6c8, 4.5, 2.4, 2);
  binLight.position.set(bx, CAB.binY + 0.42, bzMid);
  group.add(binLight);

  /* ---------------- showcase floor ---------------- */
  const mat = matTexture();
  const floorMat = new THREE.MeshStandardMaterial({ map: mat, roughness: 0.85, metalness: 0, envMapIntensity: 0.4 });
  const floor = new THREE.Mesh(floorWithHole(), floorMat);
  floor.position.y = CAB.floorY;
  floor.receiveShadow = true;
  group.add(floor);

  // hole rim: chrome ring + a glowing lip so a 4-year-old can see the goal.
  // CAB.hole.rim is the ring's own radius (bigger than the hole itself, since
  // the interior fills more of the screen now the rim needs to read from far
  // across the case), the glow sits just outside it.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(CAB.hole.rim, 0.04, 8, 32), chrome);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(CAB.hole.x, CAB.floorY + 0.012, CAB.hole.z);
  group.add(rim);
  const glowMat = emissiveMaterial(0xffd166, 2.4);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(CAB.hole.rim + 0.045, 0.026, 6, 32), glowMat);
  glow.rotation.x = Math.PI / 2;
  glow.position.set(CAB.hole.x, CAB.floorY + 0.006, CAB.hole.z);
  group.add(glow);
  // chute throat: deep enough that a steep viewing angle still hits its dark
  // wall instead of seeing past it into the void below the floor
  const throatLen = 0.7;
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(CAB.hole.r + 0.02, CAB.hole.r + 0.02, throatLen, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.8, side: THREE.BackSide })
  );
  throat.position.set(CAB.hole.x, CAB.floorY - throatLen / 2, CAB.hole.z);
  group.add(throat);

  /* ---------------- showcase walls ---------------- */
  const backMat = new THREE.MeshStandardMaterial({ color: 0xf7bdd4, roughness: 0.85, metalness: 0 });
  const back = box(group, CAB.inX * 2 + 0.1, CAB.ceilY - CAB.floorY, 0.05, backMat,
    [0, (CAB.ceilY + CAB.floorY) / 2, -CAB.inZ - 0.03]);
  back.receiveShadow = true;
  // depth cue: a big soft star painted on the back wall, sized as a fixed
  // fraction of wall width so it still reads at the wider case
  const starTex = softBlob('255,190,215', 1.0);
  const starMat = new THREE.MeshBasicMaterial({ map: starTex, transparent: true, opacity: 0.75, depthWrite: false });
  const starSize = (CAB.inX * 2 + 0.1) * 0.7;
  const starQ = new THREE.Mesh(new THREE.PlaneGeometry(starSize, starSize), starMat);
  starQ.position.set(0, 1.1, -CAB.inZ + 0.01);
  group.add(starQ);

  // corner posts
  for (const sx of [-1, 1]) {
    box(group, 0.075, CAB.ceilY - CAB.floorY + 0.1, 0.075, accentMat, [sx * (CAB.inX + 0.035), (CAB.ceilY + CAB.floorY) / 2, CAB.inZ + 0.035]);
    box(group, 0.075, CAB.ceilY - CAB.floorY + 0.1, 0.075, accentMat, [sx * (CAB.inX + 0.035), (CAB.ceilY + CAB.floorY) / 2, -CAB.inZ - 0.035]);
    // side panels are solid-ish frames with an acrylic pane
    box(group, 0.05, CAB.ceilY - CAB.floorY + 0.1, 0.06, accentMat, [sx * (CAB.inX + 0.035), (CAB.ceilY + CAB.floorY) / 2, 0]);
  }
  // top / bottom horizontal trims
  for (const z of [CAB.inZ + 0.035, -CAB.inZ - 0.035]) {
    box(group, CAB.inX * 2 + 0.14, 0.07, 0.07, accentMat, [0, CAB.ceilY, z]);
    box(group, CAB.inX * 2 + 0.14, 0.07, 0.07, accentMat, [0, CAB.floorY - 0.02, z]);
  }
  for (const sx of [-1, 1]) {
    box(group, 0.07, 0.07, CAB.inZ * 2 + 0.14, accentMat, [sx * (CAB.inX + 0.035), CAB.ceilY, 0]);
    box(group, 0.07, 0.07, CAB.inZ * 2 + 0.14, accentMat, [sx * (CAB.inX + 0.035), CAB.floorY - 0.02, 0]);
  }

  /* ---------------- ceiling + lighting hardware ---------------- */
  const ceil = box(group, CAB.inX * 2 + 0.14, 0.07, CAB.inZ * 2 + 0.14, shellMat, [0, CAB.ceilY + 0.045, 0]);
  ceil.receiveShadow = false;
  const ledMat = emissiveMaterial(0xfff4e0, 2.2);
  for (const z of [-CAB.inZ * 0.55, CAB.inZ * 0.55]) {
    box(group, CAB.inX * 1.85, 0.03, 0.07, ledMat, [0, CAB.ceilY - 0.02, z]);
  }
  for (const sx of [-1, 1]) {
    box(group, 0.04, 0.03, CAB.inZ * 1.6, emissiveMaterial(sx > 0 ? 0xff9ecb : 0x9ed8ff, 1.6), [sx * CAB.inX * 0.94, CAB.ceilY - 0.02, 0]);
  }

  /* ---------------- marquee ---------------- */
  const signH = 0.52;
  const signY = CAB.ceilY + 0.09 + signH / 2;
  const signMat = new THREE.MeshStandardMaterial({
    map: marqueeTexture(), roughness: 0.4, metalness: 0.05,
    emissiveMap: marqueeTexture(), emissive: 0xffffff, emissiveIntensity: 0.55,
  });
  box(group, CAB.inX * 2 + 0.14, signH, 0.1, signMat, [0, signY, CAB.inZ + 0.02]);
  box(group, CAB.inX * 2 + 0.14, signH, 0.1, accentMat, [0, signY, -CAB.inZ - 0.02]);
  box(group, CAB.inX * 2 + 0.2, 0.08, CAB.inZ * 2 + 0.2, shellMat, [0, signY + signH / 2 + 0.04, 0]);
  const signSide = plasticMaterial(0xffc2da);
  box(group, 0.1, signH, CAB.inZ * 2, signSide, [-CAB.inX - 0.05, signY, 0]);
  box(group, 0.1, signH, CAB.inZ * 2, signSide, [CAB.inX + 0.05, signY, 0]);

  /* ---------------- acrylic panes ---------------- */
  const paneMat = acrylicMaterial();
  const panes = new THREE.Group();
  panes.renderOrder = 10;
  group.add(panes);
  const mkPane = (w, h, p, r) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paneMat);
    m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    m.renderOrder = 10;
    panes.add(m);
    // faint smudge overlay (additive) — sells "there is glass here"
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: smudgeMap(), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sm.position.copy(m.position);
    sm.rotation.copy(m.rotation);
    sm.translateZ(0.002);
    sm.renderOrder = 11;
    panes.add(sm);
    return m;
  };
  const paneH = CAB.ceilY - CAB.floorY;
  mkPane(CAB.inX * 2, paneH, [0, paneH / 2, CAB.inZ + 0.005]);
  mkPane(CAB.inZ * 2, paneH, [-CAB.inX - 0.005, paneH / 2, 0], [0, Math.PI / 2, 0]);
  mkPane(CAB.inZ * 2, paneH, [CAB.inX + 0.005, paneH / 2, 0], [0, -Math.PI / 2, 0]);

  /* ---------------- control deck (visual only, the real control is the screen) -------- */
  box(group, 0.5, 0.09, 0.3, darkMat, [0.62, -0.5, OZ + 0.1], [0.3, 0, 0]);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), plasticMaterial(0xff5f8a, { clearcoat: 1 }));
  knob.position.set(0.62, -0.42, OZ + 0.14);
  group.add(knob);

  // ~50 static boxes -> a handful of draw calls
  mergeStatic(group);

  return {
    group, panes, floor, glowMat, chromeMat: chrome, binLight,
    trimMat, darkMat, darkMetal: darkMetalMaterial(),
  };
}

/** Distant arcade context: keeps the cabinet reading as "near", not floating. */
export function buildBackdrop(scene, { quality = 1 } = {}) {
  const g = new THREE.Group();
  scene.add(g);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a3f5c, roughness: 0.75, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = CAB.baseBottom - 0.001;
  floor.receiveShadow = true;
  g.add(floor);

  // pool of warm light under the machine
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: softBlob('255,205,170', 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = CAB.baseBottom + 0.004;
  g.add(pool);

  if (quality > 0.4) {
    // blurry sibling cabinets far behind, dim and low detail
    const cols = [0x4c4272, 0x3d5273, 0x724257, 0x3f6b63];
    const bodyMats = cols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1 }));
    const signMats = [emissiveMaterial(0xc2e6ff, 0.55), emissiveMaterial(0xffc2e0, 0.55)];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      // pushed out from the old spacing so the now-deeper cabinet (inZ 1.16,
      // outer edge ~1.23) still clears the nearest sibling with margin
      const x = side * (4.0 + Math.floor(i / 2) * 2.0);
      const z = -5.6 - Math.floor(i / 2) * 1.6;
      const h = 3.6 + (i % 3) * 0.35;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.2), bodyMats[i % bodyMats.length]);
      m.position.set(x, CAB.baseBottom + h / 2, z);
      m.userData.mergeable = true;
      g.add(m);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.06), signMats[i % 2]);
      sign.position.set(x, CAB.baseBottom + h - 0.3, z + 0.63);
      sign.userData.mergeable = true;
      g.add(sign);
    }
  }

  mergeStatic(g);

  scene.background = backdropTexture('#241d3a', '#5b4a72');
  scene.fog = new THREE.Fog(0x3d3352, 6.5, 21);
  return g;
}
