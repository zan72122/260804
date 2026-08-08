// The firefighter.
//
// Built as a jointed rig so the same model can stand at the door and then go
// down onto forearms and knees. The gear is the point of the silhouette:
// composite cylinder high on the back, harness straps over the shoulders,
// facepiece with its regulator, and three rows of retro-reflective tape that
// catch every stray photon in the smoke.
//
// Local axes: +Z is forward, +Y is up, origin on the floor between the feet.

import * as THREE from '../vendor/three.module.js';
import { materials } from './materials.js';
import { chamferBox, lathe, tube, mesh, group, applyBoxUV } from './build.js';
import { applySmoke } from './smoke.js';

const D2R = Math.PI / 180;

function band(w, h, d, mat, pos, rot) {
  const g = chamferBox(w, h, d, Math.min(w, d) * 0.34, 0.006);
  applyBoxUV(g, 3.2);
  return mesh(g, mat, { pos, rot });
}

/* --------------------------- SCBA cylinder --------------------------- */
function buildCylinder() {
  const M = materials();
  const g = group('scbaCylinder');
  const R = 0.098, L = 0.58;
  // Composite bottle: domed base, parallel body, shoulder into a neck boss.
  const prof = [
    [0.0, -L / 2 - 0.02],
    [R * 0.55, -L / 2 - 0.012], [R * 0.85, -L / 2 + 0.018], [R * 0.98, -L / 2 + 0.055],
    [R, -L / 2 + 0.09], [R, L / 2 - 0.10],
    [R * 0.96, L / 2 - 0.055], [R * 0.80, L / 2 - 0.016], [R * 0.5, L / 2 + 0.004],
    [0.030, L / 2 + 0.012], [0.030, L / 2 + 0.040], [0.0, L / 2 + 0.040],
  ];
  const bottle = mesh(lathe(prof, 32), M.cylinder, {});
  g.add(bottle);
  // Hoop bands at each end where the filament winding doubles up
  for (const y of [-L / 2 + 0.10, L / 2 - 0.12]) {
    g.add(mesh(lathe([[R + 0.002, y - 0.020], [R + 0.006, y - 0.014], [R + 0.006, y + 0.014], [R + 0.002, y + 0.020]], 28), M.plasticBlack, {}));
  }
  // Valve block, handwheel, burst disc and gauge take-off
  const valve = group('valve');
  valve.add(mesh(chamferBox(0.062, 0.070, 0.058, 0.008, 0.005), M.brass, { pos: [0, L / 2 + 0.075, 0] }));
  valve.add(mesh(lathe([[0.018, 0], [0.020, 0.026], [0.016, 0.030]], 14), M.brass, { pos: [0, L / 2 + 0.040, 0] }));
  const wheel = new THREE.TorusGeometry(0.036, 0.008, 8, 20);
  const wh = mesh(wheel, M.plasticBlack, { pos: [0, L / 2 + 0.108, -0.004] });
  wh.rotation.x = Math.PI / 2;
  valve.add(wh);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    valve.add(mesh(chamferBox(0.010, 0.010, 0.034, 0.002, 0.0015), M.plasticBlack,
      { pos: [Math.cos(a) * 0.018, L / 2 + 0.108, Math.sin(a) * 0.018 - 0.004], rot: [0, -a, 0] }));
  }
  valve.add(mesh(lathe([[0.012, 0], [0.014, 0.018], [0.011, 0.022]], 12), M.brass,
    { pos: [0.040, L / 2 + 0.075, 0.026], rot: [Math.PI / 2.4, 0, 0] }));
  g.add(valve);
  return g;
}

/* ----------------------- Facepiece + regulator ----------------------- */
function buildFacepiece() {
  const M = materials();
  const g = group('facepiece');
  // Rubber skirt that seals on the face
  const skirt = new THREE.SphereGeometry(0.108, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62);
  skirt.scale(1.0, 1.12, 0.92);
  const sk = mesh(skirt, M.rubberGrey, { pos: [0, 0, 0.012] });
  sk.rotation.x = Math.PI / 2;
  g.add(sk);
  // Sealing edge roll
  const roll = new THREE.TorusGeometry(0.098, 0.012, 10, 28);
  roll.scale(1.0, 1.10, 1.0);
  g.add(mesh(roll, M.rubberGrey, { pos: [0, 0, -0.030] }));
  // Wide curved polycarbonate lens
  const lensG = new THREE.SphereGeometry(0.104, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.46);
  lensG.scale(1.02, 1.02, 0.72);
  const lens = mesh(lensG, applySmoke(new THREE.MeshPhysicalMaterial({
    color: 0x1e2732, roughness: 0.035, metalness: 0.0, opacity: 0.86, transparent: true,
    clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: 3.2, side: THREE.DoubleSide,
  })), { pos: [0, 0.006, 0.030], shadow: false });
  lens.rotation.x = Math.PI / 2;
  g.add(lens);
  // Lens surround / frame
  const frame = new THREE.TorusGeometry(0.093, 0.008, 8, 30);
  frame.scale(1.0, 1.0, 1.0);
  g.add(mesh(frame, M.plasticBlack, { pos: [0, 0.006, 0.052] }));
  // Demand valve (regulator) clipped into the port at the mouth
  const reg = group('regulator');
  reg.add(mesh(lathe([[0, 0], [0.030, 0], [0.034, 0.012], [0.036, 0.046], [0.030, 0.056], [0.020, 0.058], [0, 0.058]], 22), M.plasticBlack,
    { pos: [0, -0.052, 0.062], rot: [Math.PI / 2 - 0.35, 0, 0] }));
  reg.add(mesh(lathe([[0, 0], [0.020, 0], [0.021, 0.020], [0.016, 0.024]], 16), M.alu,
    { pos: [0, -0.062, 0.088], rot: [Math.PI / 2 - 0.35, 0, 0] }));
  reg.add(mesh(chamferBox(0.030, 0.016, 0.020, 0.004, 0.003), M.plasticYellow, { pos: [0.030, -0.052, 0.078] }));
  g.add(reg);
  // Exhalation port under the chin
  g.add(mesh(lathe([[0, 0], [0.022, 0], [0.024, 0.010], [0.018, 0.016]], 16), M.plasticBlack,
    { pos: [0, -0.088, 0.030], rot: [Math.PI / 2 + 0.5, 0, 0] }));
  return g;
}

/* ------------------------------ Helmet ------------------------------ */
function buildHelmet() {
  const M = materials();
  const g = group('helmet');
  const shellMat = applySmoke(new THREE.MeshStandardMaterial({
    color: 0xd8b21a, roughness: 0.30, metalness: 0.05, envMapIntensity: 1.0,
  }));
  // Shell: a structural fire helmet. Crown 225 mm across, extending to about
  // 300 mm front-to-back once the neck brim is included.
  const shell = new THREE.SphereGeometry(0.112, 30, 24, 0, Math.PI * 2, 0, Math.PI * 0.62);
  shell.scale(1.0, 1.06, 1.16);
  g.add(mesh(shell, shellMat, { pos: [0, -0.004, -0.016] }));
  // Rolled rim all the way round the shell edge
  const rim = new THREE.TorusGeometry(0.1105, 0.010, 10, 36);
  rim.scale(1.0, 1.16, 1.0);
  const rm = mesh(rim, shellMat, { pos: [0, -0.016, -0.016] });
  rm.rotation.x = Math.PI / 2;
  g.add(rm);
  // Brim: a shallow dish, wide behind the ears, cut back at the front so it
  // clears the facepiece.
  const brimG = new THREE.LatheGeometry(
    [new THREE.Vector2(0.106, -0.020), new THREE.Vector2(0.126, -0.030),
     new THREE.Vector2(0.146, -0.048), new THREE.Vector2(0.149, -0.056)], 36);
  const bp = brimG.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const z = bp.getZ(i), x = bp.getX(i);
    const front = Math.max(0, z) / 0.15;
    bp.setZ(i, z * (1 - front * 0.46));
    bp.setX(i, x * (1 - front * 0.10));
  }
  brimG.computeVertexNormals();
  g.add(mesh(brimG, shellMat, { pos: [0, -0.004, -0.016] }));
  // Moulded stiffening rib over the crown
  const ridge = new THREE.TorusGeometry(0.113, 0.008, 8, 26, Math.PI * 0.66);
  const rg = mesh(ridge, shellMat, { pos: [0, -0.004, -0.016] });
  rg.rotation.y = Math.PI / 2; rg.rotation.z = Math.PI * 0.17;
  g.add(rg);
  // Retro-reflective tape round the shell
  const tapeRing = new THREE.TorusGeometry(0.1095, 0.007, 8, 36);
  tapeRing.scale(1.0, 1.15, 1.0);
  const tr = mesh(tapeRing, M.tape, { pos: [0, 0.008, -0.016] });
  tr.rotation.x = Math.PI / 2;
  g.add(tr);
  // Drop-down visor, parked up under the front peak
  const visorG = new THREE.SphereGeometry(0.116, 26, 10, Math.PI * 0.70, Math.PI * 0.60, Math.PI * 0.40, Math.PI * 0.22);
  visorG.scale(1.0, 1.0, 1.08);
  const visor = mesh(visorG, applySmoke(new THREE.MeshPhysicalMaterial({
    color: 0x33240b, roughness: 0.07, metalness: 0.55, transparent: true, opacity: 0.72,
    side: THREE.DoubleSide, clearcoat: 1.0,
  })), { pos: [0, 0.004, -0.016] });
  g.add(visor);
  // Chin strap over the ears
  for (const sx of [-1, 1]) {
    g.add(mesh(tube([
      [sx * 0.100, -0.028, -0.016], [sx * 0.090, -0.100, 0.006], [sx * 0.050, -0.150, 0.022], [0, -0.162, 0.026],
    ], 0.008, { tubular: 12, radial: 6 }), M.rubberGrey, {}));
  }
  // Helmet lamp: bracketed torch with a real bezel and lens
  const lamp = group('helmetLamp');
  lamp.add(mesh(chamferBox(0.052, 0.042, 0.034, 0.007, 0.005), M.plasticBlack, { pos: [0, 0.026, 0.096] }));
  lamp.add(mesh(lathe([[0, 0], [0.026, 0], [0.028, 0.016], [0.032, 0.040], [0.028, 0.044], [0, 0.044]], 20), M.plasticBlack,
    { pos: [0, 0.026, 0.106], rot: [Math.PI / 2 - 0.22, 0, 0] }));
  const lensMat = applySmoke(new THREE.MeshStandardMaterial({
    color: 0xfff3d8, emissive: new THREE.Color(0xfff0cf), emissiveIntensity: 6.0, roughness: 0.1,
  }));
  const lampLens = mesh(new THREE.CircleGeometry(0.027, 20), lensMat, { pos: [0, 0.035, 0.148], rot: [0.22, 0, 0] });
  lamp.add(lampLens);
  g.add(lamp);
  g.userData.lampLens = lampLens;
  g.userData.lampMat = lensMat;
  return g;
}

/* ------------------------- Harness + backplate ------------------------ */
function buildHarness(torsoW, torsoD) {
  const M = materials();
  const g = group('harness');
  // Moulded backplate: a contoured shell about 300 x 460 mm, ribbed down the
  // centre, with the cylinder band bolted through it.
  const plate = chamferBox(0.30, 0.46, 0.036, 0.055, 0.014);
  applyBoxUV(plate, 2.4);
  const pl = mesh(plate, M.plasticBlack, { pos: [0, 0.075, -0.185] });
  pl.rotation.x = -0.05;
  g.add(pl);
  g.add(mesh(chamferBox(0.085, 0.42, 0.022, 0.02, 0.008), M.plasticBlack, { pos: [0, 0.075, -0.208] }));
  // Cylinder band strap round the bottle with its cam buckle
  const bandG = new THREE.TorusGeometry(0.112, 0.013, 8, 26);
  bandG.scale(1.0, 1.0, 0.9);
  const bnd = mesh(bandG, M.plasticBlack, { pos: [0, 0.02, -0.255] });
  bnd.rotation.x = Math.PI / 2;
  g.add(bnd);
  g.add(mesh(chamferBox(0.05, 0.036, 0.018, 0.005, 0.004), M.alu, { pos: [0.10, 0.02, -0.20] }));
  // Shoulder straps arcing over the trapezius down to the waist
  for (const sx of [-1, 1]) {
    const strap = tube([
      [sx * 0.075, -0.14, -0.155],
      [sx * 0.092, 0.13, -0.140],
      [sx * 0.108, 0.250, -0.020],
      [sx * 0.114, 0.238, 0.115],
      [sx * 0.108, 0.060, 0.150],
      [sx * 0.098, -0.14, 0.130],
    ], 0.026, { tubular: 30, radial: 8 });
    const s = mesh(strap, M.webbing, {});
    g.add(s);
    // Adjuster buckle on the front run
    g.add(mesh(chamferBox(0.050, 0.030, 0.014, 0.004, 0.003), M.alu, { pos: [sx * 0.105, -0.05, 0.150] }));
  }
  // Waist belt, following the same elliptical section as the coat
  const beltG = lathe([[0.214, -0.172], [0.226, -0.162], [0.226, -0.118], [0.214, -0.108]], 34);
  beltG.scale(1.0, 1.0, 0.68);
  applyBoxUV(beltG, 3.0);
  g.add(mesh(beltG, M.webbing, {}));
  g.add(mesh(chamferBox(0.082, 0.056, 0.022, 0.006, 0.004), M.alu, { pos: [0, -0.141, 0.168] }));
  // PASS device / radio on the chest strap
  const pass = group('pass');
  pass.add(mesh(chamferBox(0.058, 0.090, 0.028, 0.006, 0.004), M.plasticBlack, { pos: [0, 0, 0] }));
  const passLed = mesh(new THREE.SphereGeometry(0.0075, 10, 8), M.beaconRed, { pos: [0, 0.032, 0.017] });
  pass.add(passLed);
  pass.add(mesh(chamferBox(0.030, 0.016, 0.006, 0.003, 0.002), M.exitGreen, { pos: [0, 0.006, 0.016] }));
  pass.position.set(-0.112, 0.010, 0.152);
  g.add(pass);
  g.userData.passLed = passLed;
  // High-pressure hose from the cylinder valve round the flank to the regulator
  const hp = tube([
    [0.02, 0.30, -torsoD / 2 - 0.18],
    [0.11, 0.24, -torsoD / 2 - 0.10],
    [0.15, 0.18, 0.0],
    [0.13, 0.20, torsoD / 2 + 0.03],
    [0.07, 0.31, torsoD / 2 + 0.06],
  ], 0.014, { tubular: 26, radial: 8 });
  g.add(mesh(hp, M.rubberGrey, {}));
  // Contents gauge on a short whip on the left
  const gaugeArm = tube([
    [-0.02, 0.30, -torsoD / 2 - 0.16], [-0.12, 0.22, -torsoD / 2 - 0.05], [-0.16, 0.10, 0.03], [-0.15, 0.02, torsoD / 2 + 0.02],
  ], 0.010, { tubular: 18, radial: 6 });
  g.add(mesh(gaugeArm, M.rubberGrey, {}));
  const gauge = group('gauge');
  gauge.add(mesh(lathe([[0, 0], [0.030, 0], [0.032, 0.010], [0.028, 0.016], [0, 0.016]], 18), M.plasticBlack, {}));
  const face = mesh(new THREE.CircleGeometry(0.024, 18), M.hudGauge, { pos: [0, 0.0175, 0] });
  face.rotation.x = -Math.PI / 2;
  gauge.add(face);
  gauge.position.set(-0.155, 0.005, 0.132);
  gauge.rotation.x = Math.PI / 2 - 0.4;
  g.add(gauge);
  g.userData.gaugeFace = face;
  return g;
}

/* ------------------------------- Limbs ------------------------------- */
function buildArm(side) {
  const M = materials();
  const shoulder = group('shoulder');
  const upperLen = 0.30, foreLen = 0.28;

  const upper = mesh(new THREE.CapsuleGeometry(0.062, upperLen - 0.08, 8, 14), M.turnoutCoat, { pos: [0, -upperLen / 2, 0] });
  shoulder.add(upper);
  // Shoulder cap so the coat reads as a garment, not a tube
  const cap = new THREE.SphereGeometry(0.068, 16, 12);
  cap.scale(1, 0.85, 1);
  shoulder.add(mesh(cap, M.turnoutCoat, { pos: [0, -0.012, 0] }));

  const elbow = group('elbow');
  elbow.position.y = -upperLen;
  shoulder.add(elbow);
  elbow.add(mesh(new THREE.CapsuleGeometry(0.055, foreLen - 0.09, 8, 14), M.turnoutCoat, { pos: [0, -foreLen / 2, 0] }));
  // Cuff tape just above the glove
  elbow.add(band(0.122, 0.055, 0.122, M.tape, [0, -foreLen + 0.055, 0]));

  const wrist = group('wrist');
  wrist.position.y = -foreLen;
  elbow.add(wrist);
  // Structural firefighting glove: palm, knuckle box, splayed thumb
  const palm = chamferBox(0.088, 0.105, 0.055, 0.022, 0.012);
  wrist.add(mesh(palm, M.rubberGrey, { pos: [0, -0.055, 0.006] }));
  wrist.add(mesh(chamferBox(0.084, 0.030, 0.048, 0.014, 0.008), M.rubberGrey, { pos: [0, -0.112, 0.010] }));
  const thumb = mesh(new THREE.CapsuleGeometry(0.019, 0.035, 6, 10), M.rubberGrey, { pos: [side * 0.048, -0.062, 0.024] });
  thumb.rotation.z = side * 0.6; thumb.rotation.x = -0.4;
  wrist.add(thumb);
  wrist.add(mesh(chamferBox(0.092, 0.045, 0.062, 0.018, 0.010), M.rubberGrey, { pos: [0, -0.012, 0.004] }));

  return { shoulder, elbow, wrist };
}

function buildLeg(side) {
  const M = materials();
  const hip = group('hip');
  const thighLen = 0.44, shinLen = 0.44;
  hip.add(mesh(new THREE.CapsuleGeometry(0.088, thighLen - 0.12, 8, 14), M.turnoutTrouser, { pos: [0, -thighLen / 2, 0] }));

  const knee = group('knee');
  knee.position.y = -thighLen;
  hip.add(knee);
  // Reinforced knee pad — the part that takes the whole crawl
  knee.add(mesh(chamferBox(0.135, 0.135, 0.115, 0.035, 0.018), M.turnoutTrouser, { pos: [0, -0.045, 0.020] }));
  knee.add(mesh(new THREE.CapsuleGeometry(0.078, shinLen - 0.16, 8, 14), M.turnoutTrouser, { pos: [0, -shinLen / 2 - 0.02, 0] }));
  knee.add(band(0.176, 0.050, 0.176, M.tape, [0, -shinLen + 0.215, 0]));

  const ankle = group('ankle');
  ankle.position.y = -shinLen;
  knee.add(ankle);
  // Rubber fire boot: shaft, moulded sole with a heel, steel toe cap
  ankle.add(mesh(new THREE.CapsuleGeometry(0.082, 0.10, 8, 14), M.rubber, { pos: [0, 0.02, 0] }));
  const foot = chamferBox(0.115, 0.075, 0.30, 0.028, 0.014);
  ankle.add(mesh(foot, M.rubber, { pos: [0, -0.038, 0.058] }));
  ankle.add(mesh(chamferBox(0.124, 0.028, 0.31, 0.012, 0.008), M.rubberGrey, { pos: [0, -0.070, 0.056] }));
  ankle.add(mesh(chamferBox(0.120, 0.032, 0.09, 0.010, 0.007), M.rubberGrey, { pos: [0, -0.088, -0.028] })); // heel block
  for (let i = 0; i < 7; i++) {                                                       // tread bars
    ankle.add(mesh(chamferBox(0.114, 0.014, 0.020, 0.004, 0.003), M.rubberGrey, { pos: [0, -0.086, -0.052 + i * 0.031] }));
  }
  ankle.add(mesh(chamferBox(0.104, 0.052, 0.055, 0.020, 0.012), M.steelDark, { pos: [0, -0.030, 0.176] }));
  return { hip, knee, ankle };
}

/* ============================== the rig ============================== */
export function buildFirefighter() {
  const M = materials();
  const root = group('firefighter');

  const hips = group('hips');
  hips.position.y = 0.95;
  root.add(hips);

  const spine = group('spine');
  hips.add(spine);

  // Turnout coat. A body of revolution squashed front-to-back: that gives the
  // real garment shape — flared hem, nipped waist, chest and shoulder bulk —
  // instead of a slab with rounded corners.
  const torsoW = 0.44, torsoH = 0.62, torsoD = 0.30;
  const coatProfile = [
    [0.215, -0.175], [0.228, -0.155], [0.232, -0.120],
    [0.212, -0.055], [0.203, 0.020], [0.208, 0.100],
    [0.222, 0.190], [0.232, 0.270], [0.234, 0.330],
    [0.222, 0.395], [0.190, 0.440], [0.140, 0.462], [0.100, 0.468],
  ];
  const coat = lathe(coatProfile, 34);
  coat.scale(1.0, 1.0, 0.68);
  applyBoxUV(coat, 2.0);
  spine.add(mesh(coat, M.turnoutCoat, {}));
  // Collar standing up round the neck
  const collar = lathe([[0.098, 0.408], [0.120, 0.426], [0.128, 0.462], [0.122, 0.500], [0.108, 0.506], [0.100, 0.470]], 26);
  collar.scale(1.0, 1.0, 0.80);
  spine.add(mesh(collar, M.turnoutCoat, {}));
  // Storm flap up the centre front, standing proud with a stitch shadow
  spine.add(mesh(chamferBox(0.070, torsoH - 0.10, 0.022, 0.010, 0.006), M.turnoutCoat, { pos: [0, 0.185, 0.150] }));
  // Bellows pockets on the skirt
  for (const sx of [-1, 1]) {
    spine.add(mesh(chamferBox(0.118, 0.130, 0.042, 0.014, 0.009), M.turnoutCoat, { pos: [sx * 0.130, -0.060, 0.128] }));
    spine.add(mesh(chamferBox(0.128, 0.036, 0.048, 0.010, 0.007), M.turnoutCoat, { pos: [sx * 0.130, 0.018, 0.132] }));
  }
  // Two rows of reflective trim, wrapped as rings rather than stuck-on slabs
  const trim = (y, r) => {
    const t = lathe([[r, y - 0.028], [r + 0.008, y - 0.022], [r + 0.008, y + 0.022], [r, y + 0.028]], 34);
    t.scale(1.0, 1.0, 0.68);
    applyBoxUV(t, 3.4);
    return mesh(t, M.tape, {});
  };
  spine.add(trim(-0.115, 0.222));
  spine.add(trim(0.255, 0.230));

  const harness = buildHarness(torsoW, torsoD);
  spine.add(harness);

  const cylMount = group('cylMount');
  cylMount.position.set(0, 0.035, -0.255);
  cylMount.rotation.x = -0.06;
  const cylinder = buildCylinder();
  cylMount.add(cylinder);
  spine.add(cylMount);

  const neck = group('neck');
  neck.position.set(0, 0.455, 0.005);
  spine.add(neck);
  neck.add(mesh(new THREE.CapsuleGeometry(0.055, 0.05, 6, 12), M.rubberGrey, { pos: [0, 0.03, -0.01] }));

  const head = group('head');
  head.position.set(0, 0.085, 0.0);
  neck.add(head);
  // Nomex hood over the head, under the facepiece straps
  // Nomex hood, open at the face the way a real one is.
  const hood = new THREE.SphereGeometry(0.100, 24, 18, Math.PI * 0.30, Math.PI * 1.40);
  hood.scale(0.96, 1.06, 1.02);
  const hoodMesh = mesh(hood, M.hood, { pos: [0, 0.008, -0.008] });
  hoodMesh.material = M.hood;
  head.add(hoodMesh);
  // Rolled edge round the face opening
  const hoodEdge = new THREE.TorusGeometry(0.086, 0.010, 8, 22);
  hoodEdge.scale(1.0, 1.10, 1.0);
  head.add(mesh(hoodEdge, M.hood, { pos: [0, 0.004, 0.028] }));
  // The hood's bib tucks down inside the collar
  const bib = lathe([[0.052, -0.055], [0.082, -0.115], [0.098, -0.175], [0.104, -0.215]], 22);
  head.add(mesh(bib, M.hood, { pos: [0, 0, -0.008] }));
  // A face inside the hood, so there is a person in there before the mask goes
  // on — and a clear before/after when it does.
  const face = group('face');
  const skinG = new THREE.SphereGeometry(0.086, 20, 16);
  skinG.scale(0.92, 1.02, 0.98);
  face.add(mesh(skinG, M.skin, { pos: [0, -0.004, 0.012] }));
  for (const sx of [-1, 1]) {
    face.add(mesh(new THREE.SphereGeometry(0.0105, 12, 10), M.plasticBlack, { pos: [sx * 0.031, -0.006, 0.078] }));
    face.add(mesh(new THREE.SphereGeometry(0.0042, 8, 6), M.exitWhite, { pos: [sx * 0.031 + 0.004, -0.002, 0.085] }));
    const brow = mesh(chamferBox(0.024, 0.006, 0.005, 0.002, 0.0015), M.hood, { pos: [sx * 0.031, 0.014, 0.078] });
    brow.rotation.z = sx * 0.12;
    face.add(brow);
  }
  face.add(mesh(new THREE.SphereGeometry(0.012, 12, 10), M.skin, { pos: [0, -0.028, 0.084] }));
  const smile = new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI * 0.8);
  const sm = mesh(smile, M.plasticBlack, { pos: [0, -0.048, 0.076] });
  sm.rotation.z = Math.PI + 0.4;
  face.add(sm);
  head.add(face);

  const facepiece = buildFacepiece();
  facepiece.position.set(0, -0.014, 0.036);
  facepiece.scale.setScalar(0.80);
  head.add(facepiece);
  // Head harness webbing over the hood
  for (const [a, r] of [[0, 0.10], [0.55, 0.098], [-0.55, 0.098]]) {
    head.add(mesh(tube([
      [Math.sin(a) * 0.085, 0.02 + Math.cos(a) * 0.02, 0.075],
      [Math.sin(a) * 0.105, 0.055 + Math.cos(a) * 0.03, -0.02],
      [Math.sin(a) * 0.075, 0.02, -0.098],
    ], 0.010, { tubular: 12, radial: 6 }), M.webbing, {}));
  }
  const helmet = buildHelmet();
  helmet.position.set(0, 0.086, 0.002);
  head.add(helmet);

  const armL = buildArm(-1), armR = buildArm(1);
  armL.shoulder.position.set(-(torsoW / 2 + 0.035), 0.335, 0);
  armR.shoulder.position.set((torsoW / 2 + 0.035), 0.335, 0);
  spine.add(armL.shoulder); spine.add(armR.shoulder);

  const legL = buildLeg(-1), legR = buildLeg(1);
  legL.hip.position.set(-0.115, -0.16, 0);
  legR.hip.position.set(0.115, -0.16, 0);
  hips.add(legL.hip); hips.add(legR.hip);

  // Sockets for carried things
  const beltSocket = group('beltSocket');
  beltSocket.position.set(0.24, -0.20, -0.02);
  spine.add(beltSocket);
  const backSocket = group('backSocket');
  backSocket.position.set(0.0, 0.38, -0.05);
  spine.add(backSocket);

  // Helmet torch
  const torch = new THREE.SpotLight(0xffe8c4, 0, 18, 0.44, 0.55, 1.35);
  torch.castShadow = true;
  torch.shadow.mapSize.set(768, 768);
  torch.shadow.camera.near = 0.12;
  torch.shadow.camera.far = 14;
  torch.shadow.bias = -0.0016;
  torch.shadow.normalBias = 0.022;
  const torchTarget = new THREE.Object3D();
  helmet.add(torch);
  torch.position.set(0, 0.035, 0.16);
  helmet.add(torchTarget);
  torchTarget.position.set(0, 0.035 - 0.35, 2.0);
  torch.target = torchTarget;

  return {
    root, hips, spine, neck, head, helmet, facepiece, face, harness, cylMount, cylinder,
    armL, armR, legL, legR, beltSocket, backSocket,
    torch, torchTarget,
    lampLens: helmet.userData.lampLens,
    lampMat: helmet.userData.lampMat,
    passLed: harness.userData.passLed,
  };
}

/* ---------------------------- posing ---------------------------- */
// Two key poses; `t` blends standing (0) to crawling (1). Angles in degrees.
//
// Sign convention (all rotations about local X): a positive angle swings a
// limb's downward axis towards -Z, i.e. backwards. The spine's up axis swings
// towards +Z, i.e. the chest pitches forwards.
const STAND = {
  hipY: 0.95, spineX: 3, neckX: -2,
  shoulderX: -4, shoulderZ: 5, elbowX: -12, wristX: 0,
  hipX: -2, kneeX: 4, ankleX: 0,
};
// Down on hands and knees, chest low, head up to look along the floor.
const CRAWL = {
  hipY: 0.520, spineX: 44, neckX: -48,
  shoulderX: -50, shoulderZ: 7, elbowX: -20, wristX: -46,
  hipX: 16, kneeX: 78, ankleX: -30,
};

function mix(a, b, t) { return a + (b - a) * t; }

/**
 * @param rig      firefighter rig
 * @param t        0 = standing, 1 = down on forearms and knees
 * @param phase    crawl cycle phase in radians (drives the stroke)
 * @param stride   0..1 how energetically the cycle is playing
 * @param walk     0..1 upright walking cycle, used on the way in
 */
export function poseFirefighter(rig, t, phase, stride, walk = 0) {
  const k = (a) => mix(STAND[a], CRAWL[a], t) * D2R;
  const sway = Math.sin(phase) * stride;
  const bob = Math.cos(phase * 2) * stride;
  const w = walk * (1 - t);

  rig.hips.position.y = mix(STAND.hipY, CRAWL.hipY, t) + bob * 0.018 * t;
  rig.hips.rotation.z = sway * 0.06 * t;
  rig.hips.rotation.y = sway * 0.10 * t;

  rig.spine.rotation.x = k('spineX') + bob * 0.03 * t;
  rig.spine.rotation.z = -sway * 0.05 * t;
  rig.neck.rotation.x = k('neckX') - bob * 0.05 * t;
  rig.neck.rotation.z = sway * 0.04 * t;

  // Arms alternate: one reaches forward while the other bears weight.
  for (const [rig_, sign] of [[rig.armL, 1], [rig.armR, -1]]) {
    const s = Math.sin(phase + (sign > 0 ? 0 : Math.PI)) * stride * t;
    rig_.shoulder.rotation.x = k('shoulderX') + s * 0.55;
    rig_.shoulder.rotation.z = (sign > 0 ? -1 : 1) * k('shoulderZ') + s * 0.10 * sign;
    rig_.elbow.rotation.x = k('elbowX') - Math.max(0, -s) * 0.45;
    rig_.wrist.rotation.x = k('wristX') + s * 0.18;
  }
  // Legs push in counter-phase with the arms.
  for (const [rig_, sign] of [[rig.legL, -1], [rig.legR, 1]]) {
    const s = Math.sin(phase + (sign > 0 ? 0 : Math.PI)) * stride * t;
    rig_.hip.rotation.x = k('hipX') + s * 0.34;
    rig_.hip.rotation.z = sign * 0.10 * t;
    rig_.knee.rotation.x = k('kneeX') - Math.max(0, s) * 0.30;
    rig_.ankle.rotation.x = k('ankleX');
  }

  // Upright walk, layered on whatever is left of the standing pose.
  if (w > 0.001) {
    const st = Math.sin(phase);
    rig.hips.position.y += Math.abs(Math.cos(phase)) * 0.022 * w - 0.012 * w;
    rig.hips.rotation.y += st * 0.10 * w;
    rig.spine.rotation.x -= 0.06 * w;
    rig.spine.rotation.y = -st * 0.08 * w;
    for (const [arm, sign] of [[rig.armL, 1], [rig.armR, -1]]) {
      arm.shoulder.rotation.x += sign * st * 0.52 * w;
      arm.elbow.rotation.x -= (0.30 + sign * st * 0.22) * w;
    }
    for (const [leg, sign] of [[rig.legL, 1], [rig.legR, -1]]) {
      leg.hip.rotation.x += sign * st * 0.55 * w;
      leg.knee.rotation.x -= (0.30 + Math.max(0, -sign * st) * 0.70) * w;
      leg.ankle.rotation.x += sign * st * 0.18 * w;
    }
  }
}
