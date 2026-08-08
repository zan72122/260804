import * as THREE from 'three';
import * as TX from './textures.js';
import {
  blobGeometry,
  featherGeometry,
  limbGeometry,
  mergeGeometries,
  strapGeometry,
  clamp,
  lerp,
  TAU,
} from './util.js';

/*
 * The hawk is built as a real wing skeleton — humerus, forearm, hand — because
 * the whole game hangs on one image: a folded bird opening into a full span and
 * cupping its wings to stop on a fist. A two-bone flapping card cannot sell
 * that. Individual primaries fan off the hand, secondaries trail the forearm,
 * and the tail spreads as an airbrake.
 *
 * Convention: the bird faces +Z, up is +Y, the right wing runs out along +X.
 * The left wing is the same rig rotated 180 degrees about Y, so every joint
 * angle is shared; only sweep (Y-axis) angles need their sign flipped, which
 * each wing carries as `sgn`.
 */

const DARK = 0x6a4f36;
const DARK_TIP = 0x33261c;
const PALE = 0xbfa47e;

function materials() {
  const back = TX.plumage(DARK, DARK_TIP, PALE, 0);
  const breast = TX.plumage(0xcdb392, 0x8a6a49, 0xf3e8d5, 11);
  back.map.repeat.set(2.2, 2.2);
  back.normalMap.repeat.set(2.2, 2.2);
  breast.map.repeat.set(2.4, 2.4);
  breast.normalMap.repeat.set(2.4, 2.4);

  return {
    back: new THREE.MeshStandardMaterial({
      map: back.map,
      normalMap: back.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.72,
      metalness: 0.02,
      color: 0xffffff,
    }),
    breast: new THREE.MeshStandardMaterial({
      map: breast.map,
      normalMap: breast.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.78,
      metalness: 0,
    }),
    primary: new THREE.MeshStandardMaterial({
      map: TX.featherVane(0x8b7252, 0x2e231a, 0xeadfc8, false).map,
      roughness: 0.52,
      metalness: 0.03,
      side: THREE.DoubleSide,
    }),
    secondary: new THREE.MeshStandardMaterial({
      map: TX.featherVane(0x9c8460, 0x4a3a29, 0xeadfc8, true).map,
      roughness: 0.55,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    tail: new THREE.MeshStandardMaterial({
      map: TX.featherVane(0xa89070, 0x3b2d20, 0xe6d9be, true).map,
      roughness: 0.55,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    covert: new THREE.MeshStandardMaterial({
      map: back.map,
      normalMap: back.normalMap,
      roughness: 0.7,
      metalness: 0.02,
      side: THREE.DoubleSide,
      color: 0xa8927a,
    }),
    beak: new THREE.MeshStandardMaterial({ color: 0x35302c, roughness: 0.28, metalness: 0.2 }),
    cere: new THREE.MeshStandardMaterial({ color: 0xf0c04a, roughness: 0.5 }),
    eye: new THREE.MeshStandardMaterial({
      color: 0x2a1a0c,
      roughness: 0.12,
      metalness: 0.1,
      emissive: 0x281403,
      emissiveIntensity: 0.35,
    }),
    iris: new THREE.MeshStandardMaterial({ color: 0xc98a2e, roughness: 0.18, metalness: 0.05 }),
    leg: new THREE.MeshStandardMaterial({ color: 0xe8ba43, roughness: 0.55 }),
    talon: new THREE.MeshStandardMaterial({ color: 0x241f1b, roughness: 0.25, metalness: 0.25 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd9b062, roughness: 0.3, metalness: 0.9 }),
  };
}

/* ---------- one wing ---------- */

function buildWing(M, sgn) {
  const L_HUM = 0.145,
    L_ARM = 0.165,
    L_HAND = 0.105;

  const shoulder = new THREE.Group();
  const humerus = new THREE.Group();
  shoulder.add(humerus);
  const elbow = new THREE.Group();
  elbow.position.x = L_HUM;
  humerus.add(elbow);
  const wrist = new THREE.Group();
  wrist.position.x = L_ARM;
  elbow.add(wrist);

  // Bone bodies — the fleshy leading edge of the wing.
  const boneMat = M.back;
  const hum = new THREE.Mesh(limbGeometry(L_HUM * 1.08, 0.026, 0.05, 6, 10), boneMat);
  hum.rotation.z = -Math.PI / 2;
  hum.castShadow = true;
  humerus.add(hum);
  const arm = new THREE.Mesh(limbGeometry(L_ARM * 1.06, 0.019, 0.032, 6, 10), boneMat);
  arm.rotation.z = -Math.PI / 2;
  arm.castShadow = true;
  elbow.add(arm);
  const hnd = new THREE.Mesh(limbGeometry(L_HAND * 1.1, 0.013, 0.024, 5, 8), boneMat);
  hnd.rotation.z = -Math.PI / 2;
  hnd.castShadow = true;
  wrist.add(hnd);

  /**
   * Places a feather so its length runs outboard, its face is horizontal and
   * `sweep` rakes it backwards — the same little frame every feather uses.
   */
  function feather(parent, geo, mat, x, y, z, sweep, dihedral) {
    const stem = new THREE.Group();
    stem.position.set(x, y, z);
    stem.rotation.set(0, sweep * sgn, dihedral, 'YZX');
    // `blade` maps the feather (built along +Y, vane facing +Z) so its length
    // runs outboard and its face lies horizontal.
    const blade = new THREE.Group();
    blade.rotation.set(-Math.PI / 2, -Math.PI / 2, 0, 'YXZ');
    // Twist has to happen inside that mapping, about the quill itself, so it
    // gets its own pivot rather than riding on the blade's Euler angles.
    const twist = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    twist.add(m);
    blade.add(twist);
    stem.add(blade);
    parent.add(stem);
    stem.userData.blade = blade;
    stem.userData.twist = twist;
    return stem;
  }

  // Primaries: the long fingered feathers off the hand. Individually fanned,
  // which is what makes the wing look like it is opening rather than scaling.
  const primaries = [];
  const NP = 8;
  for (let i = 0; i < NP; i++) {
    const t = i / (NP - 1);
    const len = lerp(0.30, 0.175, Math.pow(t, 1.25));
    const wid = lerp(0.052, 0.062, t);
    const geo = featherGeometry(len, wid, {
      camber: 0.13,
      cup: 0.3,
      root: 0.38,
      slot: i < 4 ? 0.42 - i * 0.08 : 0,
    });
    const st = feather(
      wrist,
      geo,
      M.primary,
      L_HAND * (0.9 - t * 0.55),
      0.004 - t * 0.004,
      -0.002 - t * 0.012,
      0,
      0,
      0,
    );
    st.userData.i = i;
    st.userData.t = t;
    primaries.push(st);
  }

  // Secondaries: broad, blunt feathers trailing the forearm.
  const secondaries = [];
  const NS = 7;
  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1);
    const len = lerp(0.195, 0.125, Math.pow(t, 0.8));
    const geo = featherGeometry(len, 0.082, { camber: 0.14, cup: 0.22, root: 0.58 });
    const st = feather(
      elbow,
      geo,
      M.secondary,
      L_ARM * (0.94 - t * 0.9),
      -0.002,
      -0.01,
      0,
      0,
      0,
    );
    st.userData.t = t;
    secondaries.push(st);
  }

  // Tertials: the innermost feathers that bridge wing to back.
  const tertials = [];
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const geo = featherGeometry(lerp(0.165, 0.12, t), 0.08, { camber: 0.16, cup: 0.24, root: 0.56 });
    const st = feather(humerus, geo, M.secondary, L_HUM * (0.7 - t * 0.6), 0.005, -0.012, 0, 0, 0);
    st.userData.t = t;
    tertials.push(st);
  }

  // Covert rows: short overlapping feathers that close the wing's top surface.
  // Baked into one mesh per bone since they only ever move with their bone.
  function covertRow(parent, count, spanFrom, spanTo, len, wid, zOff) {
    const parts = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const g = featherGeometry(len * (1 - t * 0.3), wid, { camber: 0.05, cup: 0.09, root: 0.68 });
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, -Math.PI / 2, 0, 'YXZ'),
      );
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(lerp(spanFrom, spanTo, t), 0.012, zOff),
        new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(0, sgn * (1.12 + t * 0.12), 0.06, 'YZX'))
          .multiply(q),
        new THREE.Vector3(1, 1, 1),
      );
      g.applyMatrix4(m);
      parts.push(g);
    }
    const merged = mergeGeometries(parts);
    const mesh = new THREE.Mesh(merged, M.covert);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  covertRow(elbow, 13, L_ARM * 1.0, -0.008, 0.082, 0.1, -0.004);
  covertRow(elbow, 11, L_ARM * 0.92, -0.008, 0.05, 0.09, 0.014);
  covertRow(wrist, 8, L_HAND * 0.98, -0.008, 0.072, 0.084, -0.004);
  covertRow(humerus, 7, L_HUM * 0.88, -0.008, 0.086, 0.104, -0.004);

  // Alula — the little thumb-tuft a hawk flicks up when braking hard.
  const alula = new THREE.Group();
  alula.position.set(0.0, 0.016, 0.03);
  wrist.add(alula);
  for (let i = 0; i < 2; i++) {
    const g = featherGeometry(0.062 - i * 0.012, 0.03, { camber: 0.2, cup: 0.35, root: 0.5 });
    const stem = new THREE.Group();
    stem.rotation.set(0, sgn * (0.35 + i * 0.18), 0, 'YZX');
    const blade = new THREE.Group();
    blade.rotation.set(-Math.PI / 2, -Math.PI / 2, 0, 'YXZ');
    const m = new THREE.Mesh(g, M.secondary);
    m.castShadow = true;
    blade.add(m);
    stem.add(blade);
    alula.add(stem);
  }

  return { shoulder, humerus, elbow, wrist, primaries, secondaries, tertials, alula, sgn };
}

/* ---------- head ---------- */

function buildHead(M) {
  const head = new THREE.Group();

  const skull = new THREE.Mesh(
    blobGeometry(0.135, (t) => Math.sin(Math.pow(t, 0.82) * Math.PI) * 0.065 + 0.004, 16, 16),
    M.back,
  );
  skull.rotation.x = Math.PI / 2;
  skull.position.z = -0.05;
  skull.scale.set(1, 1.06, 0.98);
  skull.castShadow = true;
  head.add(skull);

  // Pale throat and cheek patch.
  const cheek = new THREE.Mesh(
    blobGeometry(0.1, (t) => Math.sin(Math.pow(t, 0.8) * Math.PI) * 0.056 + 0.003, 12, 14),
    M.breast,
  );
  cheek.rotation.x = Math.PI / 2;
  cheek.position.set(0, -0.021, -0.028);
  cheek.scale.set(0.95, 1, 0.92);
  head.add(cheek);

  // Hooked beak: a tapered cone whose tip is pulled down into a raptor's hook.
  const beakGeo = blobGeometry(0.085, (t) => (1 - Math.pow(t, 1.5)) * 0.031 + 0.002, 14, 12);
  beakGeo.rotateX(Math.PI / 2);
  {
    const p = beakGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const t = clamp(z / 0.085, 0, 1);
      p.setY(i, p.getY(i) - Math.pow(t, 2.6) * 0.052);
      p.setZ(i, z - Math.pow(t, 3.2) * 0.016);
    }
    beakGeo.computeVertexNormals();
  }
  const beak = new THREE.Mesh(beakGeo, M.beak);
  beak.position.set(0, -0.012, 0.052);
  beak.castShadow = true;
  head.add(beak);

  // Lower mandible, tucked under.
  const lower = new THREE.Mesh(
    blobGeometry(0.055, (t) => (1 - Math.pow(t, 1.4)) * 0.022 + 0.002, 8, 10),
    M.beak,
  );
  lower.rotateX(Math.PI / 2);
  lower.position.set(0, -0.028, 0.05);
  head.add(lower);

  // Cere with nostrils.
  const cere = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 14, 10, 0, TAU, 0, Math.PI * 0.62),
    M.cere,
  );
  cere.rotation.x = Math.PI * 0.42;
  cere.position.set(0, 0.0, 0.044);
  cere.scale.set(1, 0.8, 1);
  head.add(cere);
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 5), M.beak);
    n.position.set(s * 0.016, 0.004, 0.062);
    head.add(n);
  }

  // Eyes with a heavy supraorbital ridge — the scowl that makes a hawk a hawk.
  for (const s of [-1, 1]) {
    const socket = new THREE.Group();
    socket.position.set(s * 0.049, 0.012, 0.026);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), M.iris);
    socket.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 14, 10), M.eye);
    pupil.position.set(s * 0.006, 0.001, 0.014);
    socket.add(pupil);
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.0055, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    glint.position.set(s * 0.011, 0.009, 0.019);
    socket.add(glint);
    // The brow: a wedge that overhangs the eye.
    const brow = new THREE.Mesh(
      blobGeometry(0.05, (t) => Math.sin(t * Math.PI) * 0.011 + 0.003, 8, 8),
      M.back,
    );
    brow.rotation.set(Math.PI / 2, 0, s * 0.22);
    brow.position.set(s * 0.004, 0.021, -0.014);
    brow.scale.set(1.25, 1, 0.55);
    socket.add(brow);
    head.add(socket);
  }

  // Nape feathering, so head-to-neck isn't a bald joint.
  const nape = new THREE.Mesh(
    blobGeometry(0.07, (t) => Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.06 + 0.01, 10, 14),
    M.back,
  );
  nape.rotation.x = Math.PI / 2;
  nape.position.z = -0.085;
  nape.scale.set(1.05, 1, 1);
  head.add(nape);

  return head;
}

/* ---------- feet ---------- */

function buildLeg(M, sgn) {
  const g = new THREE.Group();

  const thigh = new THREE.Mesh(limbGeometry(0.075, 0.026, 0.038, 6, 9), M.breast);
  thigh.rotation.x = Math.PI;
  g.add(thigh);

  const shank = new THREE.Group();
  shank.position.y = -0.06;
  g.add(shank);
  const tarsus = new THREE.Mesh(limbGeometry(0.09, 0.017, 0.023, 6, 9), M.leg);
  tarsus.rotation.x = Math.PI;
  tarsus.castShadow = true;
  shank.add(tarsus);

  const foot = new THREE.Group();
  foot.position.y = -0.088;
  shank.add(foot);

  // Three forward toes and a hallux, each with a black talon. The curl pivot
  // sits inside the toe's own frame so balling the foot up bends every toe
  // along its own length instead of swinging them sideways.
  const toeAngles = [-0.55, 0, 0.55, Math.PI];
  const toes = [];
  for (let i = 0; i < 4; i++) {
    const a = toeAngles[i];
    const toe = new THREE.Group();
    toe.rotation.y = a;
    const curl = new THREE.Group();
    toe.add(curl);
    const len = i === 3 ? 0.036 : 0.05;
    const seg1 = new THREE.Mesh(limbGeometry(len, 0.008, 0.012, 4, 7), M.leg);
    seg1.rotation.x = Math.PI / 2;
    curl.add(seg1);
    const tip = new THREE.Group();
    tip.position.z = len;
    curl.add(tip);
    const talon = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.028, 7), M.talon);
    talon.rotation.x = Math.PI * 0.72;
    talon.position.set(0, -0.008, 0.008);
    tip.add(talon);
    foot.add(toe);
    toes.push(curl);
  }

  // Feathered "trousers" over the thigh, which is what actually hides the leg
  // when it is folded away in flight.
  const trouser = new THREE.Mesh(
    blobGeometry(0.11, (t) => Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.048 + 0.012, 8, 12),
    M.breast,
  );
  trouser.rotation.x = Math.PI;
  trouser.position.y = 0.012;
  trouser.castShadow = true;
  g.add(trouser);

  // Jesses — the short leather straps that stay on a hawk's legs for life.
  const jess = new THREE.Mesh(
    strapGeometry(0.11, 0.018, 0.006, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.7 }),
  );
  jess.position.set(sgn * 0.012, -0.03, 0.004);
  shank.add(jess);

  if (sgn > 0) {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), M.brass);
    bell.position.set(0.016, -0.035, -0.014);
    shank.add(bell);
  }

  return { group: g, shank, foot, jess, toes };
}

/* ---------- the hawk ---------- */

export function createHawk() {
  const M = materials();
  const root = new THREE.Group(); // driven by the flight controller
  const body = new THREE.Group(); // local pitch/roll of the torso
  root.add(body);

  const BODY_L = 0.375;
  const torso = new THREE.Mesh(
    blobGeometry(
      BODY_L,
      (t) => Math.sin(Math.pow(t, 0.68) * Math.PI * 0.98) * 0.085 * (1 - t * 0.18) + 0.012,
      22,
      20,
    ),
    M.back,
  );
  torso.rotation.x = Math.PI / 2;
  torso.position.z = -0.12;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  // Pale breast laid over the front of the torso.
  const breast = new THREE.Mesh(
    blobGeometry(0.26, (t) => Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.072 + 0.008, 16, 18),
    M.breast,
  );
  breast.rotation.x = Math.PI / 2;
  breast.position.set(0, -0.021, -0.055);
  breast.scale.set(0.94, 0.9, 1);
  body.add(breast);

  // Neck and head.
  const neck = new THREE.Group();
  neck.position.set(0, 0.052, 0.145);
  body.add(neck);
  const neckMesh = new THREE.Mesh(
    blobGeometry(0.075, (t) => lerp(0.058, 0.045, t) + 0.004, 8, 12),
    M.back,
  );
  neckMesh.rotation.x = Math.PI / 2;
  neckMesh.position.z = -0.04;
  neck.add(neckMesh);
  const head = buildHead(M);
  head.position.set(0, 0.026, 0.042);
  neck.add(head);

  // Tail: nine rectrices that fan into an airbrake.
  const tailBase = new THREE.Group();
  tailBase.position.set(0, 0.01, -0.155);
  body.add(tailBase);
  const tailFeathers = [];
  const NT = 9;
  for (let i = 0; i < NT; i++) {
    const t = (i - (NT - 1) / 2) / ((NT - 1) / 2); // -1 .. 1
    const geo = featherGeometry(lerp(0.235, 0.2, Math.abs(t)), 0.055, {
      camber: 0.07,
      cup: 0.18,
      root: 0.55,
    });
    const stem = new THREE.Group();
    // Same mapping as the wing feathers, minus the outboard swing: the tail
    // lies flat and trails straight back off the body.
    const blade = new THREE.Group();
    blade.rotation.set(-Math.PI / 2, 0, 0);
    const twist = new THREE.Group();
    const m = new THREE.Mesh(geo, M.tail);
    m.castShadow = true;
    twist.add(m);
    blade.add(twist);
    stem.add(blade);
    stem.userData.t = t;
    stem.userData.i = i;
    stem.userData.twist = twist;
    tailBase.add(stem);
    tailFeathers.push(stem);
  }
  // Upper tail coverts hiding the quill roots.
  const tailCov = new THREE.Mesh(
    blobGeometry(0.1, (t) => Math.sin(Math.pow(t, 0.6) * Math.PI) * 0.055 + 0.006, 8, 12),
    M.back,
  );
  tailCov.rotation.x = -Math.PI / 2;
  tailCov.position.set(0, 0.014, -0.15);
  body.add(tailCov);

  // Wings.
  const wingR = buildWing(M, 1);
  wingR.shoulder.position.set(0.055, 0.045, -0.02);
  body.add(wingR.shoulder);
  const wingL = buildWing(M, -1);
  wingL.shoulder.position.set(-0.055, 0.045, -0.02);
  wingL.shoulder.rotation.y = Math.PI;
  body.add(wingL.shoulder);

  // Legs.
  const legR = buildLeg(M, 1);
  legR.group.position.set(0.05, -0.055, -0.01);
  body.add(legR.group);
  const legL = buildLeg(M, -1);
  legL.group.position.set(-0.05, -0.055, -0.01);
  body.add(legL.group);

  /* ---- pose ---- */

  const pose = {
    spread: 0, // 0 folded, 1 full span
    flap: 0, // -1 down-stroke bottom .. +1 up-stroke top
    cup: 0, // wings swept forward and cupped to brake
    tail: 0, // 0 closed, 1 fanned
    tailPitch: 0,
    legs: 0, // 0 tucked, 1 reaching for the perch
    headYaw: 0,
    headPitch: 0,
    bodyPitch: 0,
    bodyRoll: 0,
    ruffle: 0,
    jess: 0,
  };

  /*
   * Joint angles are worked out as *absolute* sweeps — how far each bone is
   * rotated back from pointing straight outboard — and only converted to the
   * relative angles the scene graph wants at the last moment. Reasoning in
   * absolutes is the only way the folded pose comes out right: a tucked wing is
   * a Z-fold (humerus back, forearm forward, hand back again) that leaves the
   * wrist beside the shoulder and the primaries lying along the tail, and
   * chaining relative guesses to reach that never converges.
   */
  function applyWing(w) {
    const s = pose.spread;
    const sg = w.sgn;
    const flap = pose.flap;
    const cup = pose.cup;

    const humAbs = lerp(1.21, -0.04, s) - cup * 0.42;
    const armAbs = lerp(-1.77, -0.13, s) + cup * 0.5;
    const handAbs = lerp(1.52, 0.03, s) + cup * 0.46;

    const humDihedral = lerp(0.02, 0.15, s) + flap * 0.72 + cup * 0.14;
    const humTwist = lerp(-0.08, 0.02, s) - flap * 0.1;
    w.humerus.rotation.set(humTwist, humAbs * sg, humDihedral, 'YZX');

    // The forearm lags the shoulder — the whip that reads as a real wingbeat.
    const armDihedral = lerp(-0.06, 0.05, s) + flap * 0.3 - cup * 0.1;
    w.elbow.rotation.set(0, (armAbs - humAbs) * sg, armDihedral, 'YZX');

    const handDihedral = lerp(0.04, 0.09, s) + flap * 0.34 - cup * 0.2;
    const handTwist = lerp(0.1, 0, s) + flap * 0.32 + cup * 0.45;
    w.wrist.rotation.set(handTwist, (handAbs - armAbs) * sg, handDihedral, 'YZX');

    // Primaries fan open like fingers, and splay further when braking.
    for (const p of w.primaries) {
      const t = p.userData.t;
      const fan = lerp(0.035, 0.36, s) + cup * 0.28 * (1 - t);
      const abs = lerp(1.45, 0.02, s) + t * fan;
      const dihedral = (1 - s) * -0.02 + s * (0.06 + (1 - t) * 0.16) + flap * 0.22 * (0.4 + t) + cup * 0.4 * (0.3 + t * 0.9);
      const twist = lerp(0.08, 0.0, s) + flap * 0.4 * (0.3 + t) - cup * 0.45;
      p.rotation.set(0, (abs - handAbs) * sg, dihedral, 'YZX');
      p.userData.twist.rotation.y = twist;
      p.userData.blade.scale.setScalar(lerp(0.88, 1, s));
    }
    // Secondaries trail square off the back of the forearm in both states.
    for (const q of w.secondaries) {
      const t = q.userData.t;
      const abs = lerp(1.42, 1.5 + t * 0.16, s);
      const dihedral = (1 - s) * -0.03 + flap * 0.14 - cup * 0.2;
      q.rotation.set(0, (abs - armAbs) * sg, dihedral, 'YZX');
      q.userData.twist.rotation.y = lerp(0.06, 0.04, s) - cup * 0.3;
    }
    for (const q of w.tertials) {
      const t = q.userData.t;
      const abs = lerp(1.5, 1.46 + t * 0.14, s);
      q.rotation.set(0, (abs - humAbs) * sg, -0.02 + flap * 0.08, 'YZX');
      q.userData.twist.rotation.y = lerp(0.06, 0.05, s);
    }
    // The alula pops up only in a hard, slow approach.
    w.alula.rotation.set(0, 0, clamp(cup, 0, 1) * 0.75);
    w.alula.visible = s > 0.35;
  }

  function apply() {
    body.rotation.set(pose.bodyPitch, 0, pose.bodyRoll);
    applyWing(wingR);
    applyWing(wingL);

    // Tail fan: feathers rotate about the vertical, and the whole tail tips
    // down as an airbrake.
    const fan = pose.tail;
    tailFeathers.forEach((f) => {
      const t = f.userData.t;
      f.rotation.set(0, -t * lerp(0.055, 0.34, fan), 0, 'YZX');
      f.userData.twist.rotation.y = -t * lerp(0.02, 0.3, fan);
      f.position.y = Math.abs(t) * lerp(0.004, -0.008, fan);
    });
    tailBase.rotation.x = pose.tailPitch;

    // Legs: tucked flat under the belly in flight, dropped and reaching to land.
    for (const [leg, sg] of [
      [legR, 1],
      [legL, -1],
    ]) {
      const e = pose.legs;
      leg.group.rotation.x = lerp(0.95, -0.26, e);
      leg.shank.rotation.x = lerp(-2.95, 0.2, e);
      leg.foot.rotation.x = lerp(1.5, 0.05, e);
      leg.group.rotation.z = sg * lerp(0.05, 0.16, e);
      leg.group.position.set(sg * lerp(0.036, 0.05, e), lerp(-0.02, -0.055, e), lerp(-0.075, -0.01, e));
      // Toes ball up when the feet are stowed and open to grasp on approach.
      for (const curl of leg.toes) curl.rotation.x = lerp(0.95, 0, e);
      leg.jess.rotation.x = pose.jess * 0.5;
      leg.jess.rotation.z = Math.sin(pose.jess * 3 + sg) * 0.3;
    }

    neck.rotation.set(pose.headPitch * 0.35, pose.headYaw * 0.3, 0, 'YXZ');
    head.rotation.set(pose.headPitch * 0.75, pose.headYaw * 0.75, 0, 'YXZ');

    // Ruffle: the bird puffs slightly when it settles or braces.
    const r = 1 + pose.ruffle * 0.07;
    torso.scale.set(r, r, 1 + pose.ruffle * 0.03);
    breast.scale.set(0.94 * r, 0.9 * r, 1);
  }

  apply();

  return {
    root,
    body,
    head,
    neck,
    pose,
    apply,
    // How far the root sits above the feet, so anything the bird stands on can
    // place it by the perch surface rather than by its belly.
    standOffset: 0.205,
    wings: [wingR, wingL],
    legs: [legR, legL],
    tailFeathers,
    materials: M,
  };
}
