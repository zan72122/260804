// Everything that isn't the building or the furniture: the crew's hose line,
// egress markers, the two things we are looking for, and the appliance parked
// outside the front door.

import * as THREE from '../vendor/three.module.js';
import { materials } from './materials.js';
import { chamferBox, lathe, tube, mesh, group, applyBoxUV } from './build.js';
import { contactShadowTexture, softSprite } from './textures.js';
import { mulberry32 } from './noise.js';
import { applySmoke } from './smoke.js';

/** Soft dark blob pressed into the floor under an object. */
export function contactShadow(radius, x, z, opacity = 0.5, y = 0.004) {
  const M = materials();
  const m = M.contactShadow.clone();
  m.opacity = opacity;
  const g = new THREE.PlaneGeometry(radius * 2, radius * 2);
  g.rotateX(-Math.PI / 2);
  return mesh(g, m, { pos: [x, y, z], shadow: false, receive: false });
}

/* ------------------------------------------------------------------ *
 * The hose line. This is the handrail: the crew laid it on the way in,
 * and following it is how you find your way back out.
 * ------------------------------------------------------------------ */
export function buildHose(scene, route) {
  const M = materials();
  const g = group('hoseLine');
  const N = 150;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * route.length;
    const p = route.at(s);
    const t = route.tangentAt(s);
    // Lay it a little to one side of the crawl line, snaking as real hose does.
    const nx = -t.z, nz = t.x;
    const wob = Math.sin(s * 1.35) * 0.075 + Math.sin(s * 0.41 + 1.7) * 0.055;
    const off = 0.30 + wob;
    pts.push(new THREE.Vector3(p.x + nx * off, 0.034, p.z + nz * off));
  }
  // Continue out through the front door to the appliance.
  pts.push(new THREE.Vector3(0.30, 0.034, 2.75));
  pts.push(new THREE.Vector3(0.34, 0.034, 3.6));
  pts.push(new THREE.Vector3(0.40, 0.034, 5.0));
  pts.reverse();

  const geo = tube(pts, 0.034, { tubular: 320, radial: 12 });
  applyBoxUV(geo, 3.0);
  const hose = mesh(geo, M.hose, { shadow: true, receive: true });
  g.add(hose);

  // Instantaneous couplings every 20 m of hose, plus the shadow it casts.
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  for (const u of [0.30, 0.62, 0.88]) {
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const coup = group('coupling');
    const body = lathe([
      [0.034, -0.055], [0.046, -0.05], [0.047, -0.03], [0.040, -0.028],
      [0.040, 0.028], [0.047, 0.03], [0.046, 0.05], [0.034, 0.055],
    ], 20);
    coup.add(mesh(body, M.brass, {}));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      coup.add(mesh(chamferBox(0.014, 0.030, 0.018, 0.003, 0.002), M.brass,
        { pos: [Math.cos(a) * 0.046, Math.sin(a) * 0.046, 0] , rot: [0, 0, a]}));
    }
    coup.position.copy(p);
    coup.lookAt(p.clone().add(t));
    coup.rotateX(Math.PI / 2);
    g.add(coup);
  }

  // Contact shading under the run so the hose sits on the boards.
  for (let i = 0; i <= 40; i++) {
    const p = curve.getPointAt(i / 40);
    if (p.z > 2.8) continue;
    g.add(contactShadow(0.10, p.x, p.z, 0.42, 0.003));
  }
  scene.add(g);
  return g;
}

/* ------------------------------------------------------------ *
 * Low-level photoluminescent way-guidance: little green chevrons
 * on the skirting that always point back to the way out.
 * ------------------------------------------------------------ */
export function buildEgressMarkers(scene, route) {
  const M = materials();
  const g = group('egress');
  const step = 1.6;
  for (let s = 1.2; s < route.length - 0.4; s += step) {
    const p = route.at(s);
    const t = route.tangentAt(s);
    const nx = -t.z, nz = t.x;
    const m = group('marker');
    const plate = mesh(chamferBox(0.13, 0.055, 0.006, 0.006, 0.004), M.plasticBlack, { pos: [0, 0.07, 0] });
    m.add(plate);
    // Arrow made of three chevrons, glowing gently.
    for (let i = 0; i < 3; i++) {
      const w = 0.020;
      const c1 = mesh(chamferBox(w, 0.026, 0.004, 0.002, 0.0015), M.exitGreen, { pos: [-0.038 + i * 0.030, 0.079, 0.005] });
      c1.rotation.z = Math.PI / 4;
      const c2 = mesh(chamferBox(w, 0.026, 0.004, 0.002, 0.0015), M.exitGreen, { pos: [-0.038 + i * 0.030, 0.061, 0.005] });
      c2.rotation.z = -Math.PI / 4;
      m.add(c1); m.add(c2);
    }
    m.position.set(p.x - nx * 0.40, 0, p.z - nz * 0.40);
    // Face across the route, arrows pointing back towards the door.
    m.lookAt(p.x, 0, p.z);
    g.add(m);
  }
  scene.add(g);
  return g;
}

/* --------------------------------- *
 * Maintained EXIT sign over a doorway *
 * --------------------------------- */
export function makeExitSign() {
  const M = materials();
  const g = group('exitSign');
  g.add(mesh(chamferBox(0.30, 0.145, 0.030, 0.006, 0.004), M.plasticWhite, { pos: [0, 0, 0] }));
  g.add(mesh(chamferBox(0.275, 0.122, 0.006, 0.004, 0.003), M.exitGreen, { pos: [0, 0, 0.018] }));
  // A running figure and a door, in white on green — no words needed.
  const white = M.exitWhite;
  const fig = group('runner');
  fig.add(mesh(new THREE.SphereGeometry(0.016, 10, 8), white, { pos: [-0.03, 0.038, 0] }));
  const torso = mesh(chamferBox(0.022, 0.05, 0.006, 0.006, 0.003), white, { pos: [-0.025, 0.0, 0] });
  torso.rotation.z = 0.18; fig.add(torso);
  const legA = mesh(chamferBox(0.016, 0.052, 0.006, 0.005, 0.003), white, { pos: [-0.048, -0.04, 0] });
  legA.rotation.z = 0.55; fig.add(legA);
  const legB = mesh(chamferBox(0.016, 0.05, 0.006, 0.005, 0.003), white, { pos: [0.002, -0.04, 0] });
  legB.rotation.z = -0.35; fig.add(legB);
  const arm = mesh(chamferBox(0.013, 0.044, 0.006, 0.005, 0.003), white, { pos: [0.0, 0.012, 0] });
  arm.rotation.z = -0.9; fig.add(arm);
  fig.position.set(-0.045, 0.0, 0.023);
  g.add(fig);
  // Door frame the figure runs through
  for (const [w, h, x, y] of [[0.008, 0.10, 0.055, 0.0], [0.008, 0.10, 0.115, 0.0], [0.068, 0.008, 0.085, 0.046]]) {
    g.add(mesh(chamferBox(w, h, 0.005, 0.002, 0.0015), white, { pos: [x, y, 0.023] }));
  }
  // Arrow
  const ar = mesh(chamferBox(0.05, 0.012, 0.005, 0.003, 0.002), white, { pos: [0.048, -0.045, 0.023] });
  g.add(ar);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softSprite(2.2), color: 0x2fe488, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(0.85, 0.55, 1);
  glow.position.z = 0.06;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

/** Battery emergency luminaire — twin spots on a white box. */
export function makeEmergencyLight() {
  const M = materials();
  const g = group('emerg');
  g.add(mesh(chamferBox(0.26, 0.10, 0.075, 0.008, 0.005), M.plasticWhite, { pos: [0, 0, 0] }));
  for (const sx of [-1, 1]) {
    const cup = lathe([[0.005, 0], [0.030, 0.030], [0.032, 0.034], [0.028, 0.034], [0.004, 0.004]], 16);
    const c = mesh(cup, M.plasticWhite, { pos: [sx * 0.07, -0.005, 0.045] });
    c.rotation.x = Math.PI / 2;
    g.add(c);
    g.add(mesh(new THREE.SphereGeometry(0.019, 12, 10), M.exitWhite, { pos: [sx * 0.07, -0.005, 0.062] }));
  }
  const led = mesh(new THREE.SphereGeometry(0.005, 8, 6), M.exitGreen, { pos: [0.10, 0.032, 0.04] });
  g.add(led);
  return g;
}

/* ---------------------------------- *
 * The teddy bear — first thing to find *
 * ---------------------------------- */
export function makeTeddy() {
  const M = materials();
  const g = group('teddy');
  const body = new THREE.SphereGeometry(0.088, 18, 14);
  body.scale(1.0, 1.12, 0.86);
  g.add(mesh(body, M.furTeddy, { pos: [0, 0.095, 0] }));
  const belly = new THREE.SphereGeometry(0.055, 14, 12);
  belly.scale(1.0, 0.95, 0.6);
  g.add(mesh(belly, M.furMuzzle, { pos: [0, 0.075, 0.062] }));
  const head = new THREE.SphereGeometry(0.072, 18, 14);
  head.scale(1.0, 0.95, 0.92);
  g.add(mesh(head, M.furTeddy, { pos: [0, 0.225, 0.012] }));
  const muzzle = new THREE.SphereGeometry(0.032, 14, 12);
  muzzle.scale(1.15, 0.85, 1.0);
  g.add(mesh(muzzle, M.furMuzzle, { pos: [0, 0.205, 0.072] }));
  g.add(mesh(new THREE.SphereGeometry(0.011, 10, 8), M.plasticBlack, { pos: [0, 0.222, 0.099] }));
  for (const sx of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.028, 12, 10);
    ear.scale(1, 1, 0.55);
    g.add(mesh(ear, M.furTeddy, { pos: [sx * 0.055, 0.278, 0.005] }));
    const inner = new THREE.SphereGeometry(0.016, 10, 8);
    inner.scale(1, 1, 0.5);
    g.add(mesh(inner, M.furMuzzle, { pos: [sx * 0.055, 0.278, 0.019] }));
    // Eyes: little glass beads that flare when the torch finds them.
    g.add(mesh(new THREE.SphereGeometry(0.0085, 10, 8), M.plasticBlack, { pos: [sx * 0.026, 0.246, 0.066] }));
    // Arms and legs, jointed at the shoulder / hip
    const arm = new THREE.CapsuleGeometry(0.024, 0.062, 6, 12);
    const a = mesh(arm, M.furTeddy, { pos: [sx * 0.088, 0.125, 0.018] });
    a.rotation.z = sx * 0.85; a.rotation.x = -0.35;
    g.add(a);
    const leg = new THREE.CapsuleGeometry(0.030, 0.055, 6, 12);
    const l = mesh(leg, M.furTeddy, { pos: [sx * 0.052, 0.038, 0.030] });
    l.rotation.x = Math.PI / 2.1; l.rotation.z = sx * 0.25;
    g.add(l);
    const pad = new THREE.SphereGeometry(0.024, 10, 8);
    pad.scale(1, 0.6, 1);
    g.add(mesh(pad, M.furMuzzle, { pos: [sx * 0.055, 0.030, 0.088] }));
  }
  // A ribbon round its neck
  const ribbon = new THREE.TorusGeometry(0.052, 0.008, 8, 24);
  const rb = mesh(ribbon, M.plasticPink, { pos: [0, 0.168, 0.012] });
  rb.rotation.x = Math.PI / 2 - 0.15;
  g.add(rb);
  return g;
}

/* ------------------------------------ *
 * The kitten — the reason we came in here *
 * ------------------------------------ */
export function makeKitten() {
  const M = materials();
  const g = group('kitten');
  const fur = M.furKitten, pale = M.furKittenPale;
  // Curled up small, the way a frightened cat actually sits.
  const body = new THREE.SphereGeometry(0.085, 20, 16);
  body.scale(1.25, 0.92, 1.0);
  g.add(mesh(body, fur, { pos: [0, 0.082, 0] }));
  const chest = new THREE.SphereGeometry(0.05, 14, 12);
  g.add(mesh(chest, pale, { pos: [0, 0.062, 0.075] }));
  const head = new THREE.SphereGeometry(0.056, 20, 16);
  head.scale(1.05, 0.95, 0.95);
  const headG = group('kittenHead');
  headG.add(mesh(head, fur, { pos: [0, 0, 0] }));
  const snout = new THREE.SphereGeometry(0.028, 14, 12);
  snout.scale(1.1, 0.8, 0.9);
  headG.add(mesh(snout, pale, { pos: [0, -0.014, 0.046] }));
  headG.add(mesh(new THREE.SphereGeometry(0.008, 10, 8), M.plasticPink, { pos: [0, -0.004, 0.070] }));
  for (const sx of [-1, 1]) {
    // Triangular ears with pink inners
    const ear = new THREE.ConeGeometry(0.026, 0.05, 4);
    const e = mesh(ear, fur, { pos: [sx * 0.036, 0.052, -0.004] });
    e.rotation.z = sx * 0.22; e.rotation.y = Math.PI / 4;
    headG.add(e);
    const ei = new THREE.ConeGeometry(0.014, 0.03, 4);
    const eim = mesh(ei, M.plasticPink, { pos: [sx * 0.036, 0.048, 0.008] });
    eim.rotation.z = sx * 0.22; eim.rotation.y = Math.PI / 4;
    headG.add(eim);
    // Eyes with a bright retroreflective tapetum — these catch the torch beam.
    const eye = mesh(new THREE.SphereGeometry(0.0125, 12, 10), M.plasticBlack, { pos: [sx * 0.024, 0.008, 0.046] });
    headG.add(eye);
    const shine = mesh(new THREE.SphereGeometry(0.0105, 12, 10), applySmoke(new THREE.MeshStandardMaterial({
      color: 0x1a2a12, emissive: new THREE.Color(0x9be86a), emissiveIntensity: 0.9, roughness: 0.15,
    })), { pos: [sx * 0.024, 0.008, 0.050] });
    shine.name = 'eyeShine';
    headG.add(shine);
    // Whiskers
    for (let i = -1; i <= 1; i++) {
      const w = tube([
        [sx * 0.018, -0.008 + i * 0.006, 0.062],
        [sx * 0.055, -0.004 + i * 0.010, 0.070],
        [sx * 0.085, 0.002 + i * 0.014, 0.070],
      ], 0.0012, { tubular: 6, radial: 4 });
      headG.add(mesh(w, M.plasticWhite, { shadow: false }));
    }
  }
  headG.position.set(0, 0.135, 0.062);
  g.add(headG);
  g.userData.head = headG;

  // Front paws tucked, tail wrapped round the body
  for (const sx of [-1, 1]) {
    const paw = new THREE.CapsuleGeometry(0.018, 0.03, 6, 10);
    const p = mesh(paw, pale, { pos: [sx * 0.032, 0.028, 0.088] });
    p.rotation.x = Math.PI / 2.2;
    g.add(p);
  }
  const tail = tube([
    [-0.02, 0.055, -0.095], [-0.10, 0.045, -0.075], [-0.135, 0.038, 0.0],
    [-0.115, 0.034, 0.065], [-0.055, 0.030, 0.098],
  ], 0.017, { tubular: 24, radial: 8 });
  g.add(mesh(tail, fur, {}));
  g.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), pale, { pos: [-0.055, 0.030, 0.098] }));
  return g;
}

/* ---------------------------------------------------------- *
 * The appliance on the street outside — pump, ladder, beacons. *
 * ---------------------------------------------------------- */
export function buildAppliance() {
  const M = materials();
  const g = group('appliance');
  const bodyRed = applySmoke(new THREE.MeshStandardMaterial({ color: 0x8e0f10, roughness: 0.28, metalness: 0.15, envMapIntensity: 0.8 }));
  const L = 7.4, W = 2.5, chassisY = 0.72;

  // Chassis rails and cross members
  for (const sx of [-1, 1]) {
    g.add(mesh(chamferBox(0.10, 0.22, L - 0.6, 0.01, 0.008), M.steelDark, { pos: [sx * 0.42, chassisY - 0.11, 0] }));
  }
  for (let i = -2; i <= 2; i++) {
    g.add(mesh(chamferBox(0.86, 0.10, 0.09, 0.008, 0.006), M.steelDark, { pos: [0, chassisY - 0.11, i * 1.3] }));
  }
  // Wheels: tyre, rim, hub
  const wheel = (x, z) => {
    const wg = group('wheel');
    const tyre = new THREE.TorusGeometry(0.40, 0.135, 12, 30);
    wg.add(mesh(tyre, M.rubber, {}));
    wg.add(mesh(lathe([[0.0, -0.12], [0.26, -0.12], [0.30, -0.09], [0.30, 0.09], [0.26, 0.12], [0, 0.12]], 22), M.alu, {}));
    wg.add(mesh(lathe([[0, 0.13], [0.10, 0.13], [0.11, 0.11], [0.11, 0.09]], 16), M.alu, {}));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      wg.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8), M.alu,
        { pos: [Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.125], rot: [Math.PI / 2, 0, 0] }));
    }
    wg.rotation.y = Math.PI / 2;
    wg.position.set(x, 0.40, z);
    return wg;
  };
  for (const sx of [-1, 1]) {
    g.add(wheel(sx * (W / 2 - 0.14), 2.35));
    g.add(wheel(sx * (W / 2 - 0.14), -1.55));
    g.add(wheel(sx * (W / 2 - 0.14), -2.55));
  }

  // Cab
  const cab = group('cab');
  cab.add(mesh(chamferBox(W, 1.42, 2.30, 0.06, 0.04), bodyRed, { pos: [0, chassisY + 0.71, 2.35] }));
  cab.add(mesh(chamferBox(W - 0.16, 0.62, 0.10, 0.03, 0.02), M.glassLens, { pos: [0, chassisY + 1.05, 2.35 + 1.16] }));
  for (const sx of [-1, 1]) {
    cab.add(mesh(chamferBox(0.10, 0.55, 0.95, 0.03, 0.02), M.glassLens, { pos: [sx * (W / 2 - 0.02), chassisY + 1.02, 2.42] }));
    // Mirror arms
    cab.add(mesh(tube([[sx * (W / 2), chassisY + 1.22, 3.30], [sx * (W / 2 + 0.28), chassisY + 1.30, 3.34]], 0.018, { tubular: 6, radial: 6 }), M.steelDark, {}));
    cab.add(mesh(chamferBox(0.05, 0.30, 0.20, 0.012, 0.008), M.plasticBlack, { pos: [sx * (W / 2 + 0.30), chassisY + 1.22, 3.34] }));
    // Steps up to the cab
    cab.add(mesh(chamferBox(0.12, 0.04, 0.55, 0.008, 0.005), M.alu, { pos: [sx * (W / 2 - 0.02), chassisY - 0.16, 2.40] }));
  }
  // Grille and lamps
  cab.add(mesh(chamferBox(W - 0.30, 0.28, 0.08, 0.02, 0.015), M.steelDark, { pos: [0, chassisY + 0.36, 3.50] }));
  for (const sx of [-1, 1]) {
    cab.add(mesh(lathe([[0, 0], [0.10, 0], [0.105, 0.03], [0.09, 0.055], [0, 0.055]], 18), M.exitWhite,
      { pos: [sx * (W / 2 - 0.32), chassisY + 0.62, 3.52], rot: [Math.PI / 2, 0, 0] }));
  }
  g.add(cab);

  // Body: lockers with roller shutters and a top rail
  const bodyZ = -1.2;
  g.add(mesh(chamferBox(W, 1.62, 3.9, 0.05, 0.035), bodyRed, { pos: [0, chassisY + 0.81, bodyZ] }));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = bodyZ + 1.25 - i * 1.25;
      // Shutter recess + slats
      g.add(mesh(chamferBox(0.03, 1.05, 1.06, 0.01, 0.008), M.steelDark, { pos: [sx * (W / 2 + 0.005), chassisY + 0.80, z] }));
      for (let k = 0; k < 11; k++) {
        g.add(mesh(chamferBox(0.018, 0.078, 1.02, 0.004, 0.003), M.alu,
          { pos: [sx * (W / 2 + 0.022), chassisY + 0.32 + k * 0.092, z] }));
      }
      g.add(mesh(chamferBox(0.02, 0.03, 0.26, 0.006, 0.004), M.alu, { pos: [sx * (W / 2 + 0.03), chassisY + 0.30, z] }));
    }
    // Reflective chevron band along the lower body
    g.add(mesh(chamferBox(0.012, 0.16, 3.7, 0.004, 0.003), M.tape, { pos: [sx * (W / 2 + 0.016), chassisY + 1.50, bodyZ] }));
  }
  // Roof: ladder on gantry, and the light bar
  for (const sx of [-1, 1]) {
    g.add(mesh(chamferBox(0.06, 0.16, 3.8, 0.01, 0.008), M.alu, { pos: [sx * 0.75, chassisY + 1.70, bodyZ] }));
  }
  const ladder = group('ladder');
  for (const sx of [-1, 1]) ladder.add(mesh(chamferBox(0.05, 0.11, 3.4, 0.008, 0.006), M.alu, { pos: [sx * 0.28, 0, 0] }));
  for (let i = 0; i < 12; i++) ladder.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 10), M.alu,
    { pos: [0, 0, -1.55 + i * 0.28], rot: [0, 0, Math.PI / 2] }));
  ladder.position.set(0.0, chassisY + 1.83, bodyZ);
  g.add(ladder);

  // Light bar over the cab
  const bar = group('lightbar');
  bar.add(mesh(chamferBox(1.75, 0.10, 0.24, 0.02, 0.015), M.plasticBlack, { pos: [0, 0, 0] }));
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const x = -0.76 + i * 0.217;
    const isRed = i % 2 === 0;
    const lens = mesh(chamferBox(0.185, 0.075, 0.14, 0.012, 0.008), isRed ? M.beaconRed : M.beaconBlue, { pos: [x, 0.03, 0] });
    lens.userData.phase = i * 0.25;
    lens.userData.isRed = isRed;
    bar.add(lens);
    lamps.push(lens);
  }
  bar.position.set(0, chassisY + 1.50, 2.90);
  g.add(bar);
  g.userData.lamps = lamps;

  // Pump panel with gauges, on the near side
  const panel = group('panel');
  panel.add(mesh(chamferBox(0.05, 0.72, 1.05, 0.01, 0.008), M.alu, { pos: [0, 0, 0] }));
  for (let i = 0; i < 4; i++) {
    panel.add(mesh(lathe([[0, 0], [0.055, 0], [0.058, 0.012], [0.05, 0.018], [0, 0.018]], 16), M.steelDark,
      { pos: [0.03, 0.18 - Math.floor(i / 2) * 0.30, -0.28 + (i % 2) * 0.56], rot: [0, 0, Math.PI / 2] }));
  }
  panel.position.set(-(W / 2 + 0.03), chassisY + 0.75, 0.55);
  g.add(panel);

  return g;
}

/** Dust and ash drifting in the beam — sells the scale of the air. */
export function buildMotes(scene, count = 260) {
  const rnd = mulberry32(17);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = -8.4 + rnd() * 11.6;
    pos[i * 3 + 1] = 0.05 + rnd() * 1.9;
    pos[i * 3 + 2] = -6.2 + rnd() * 9.4;
    seed[i] = rnd() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBeamOrigin: { value: new THREE.Vector3() },
      uBeamDir: { value: new THREE.Vector3() },
      uBeamStrength: { value: 1 },
      uSize: { value: 34 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime, uSize, uBeamStrength;
      uniform vec3 uBeamOrigin, uBeamDir;
      varying float vLit;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.30 + aSeed) * 0.16;
        p.y += sin(uTime * 0.21 + aSeed * 1.7) * 0.10;
        p.z += cos(uTime * 0.26 + aSeed * 0.6) * 0.16;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 toP = p - uBeamOrigin;
        float d = length(toP);
        float c = dot(normalize(toP), uBeamDir);
        vLit = smoothstep(0.90, 0.995, c) * uBeamStrength / (1.0 + d * d * 0.35);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize / max(-mv.z, 0.4);
      }`,
    fragmentShader: /* glsl */`
      varying float vLit;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        if (vLit < 0.002) discard;
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.78) * vLit * 1.6, a * min(vLit * 2.2, 1.0));
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { points: pts, material: mat };
}
