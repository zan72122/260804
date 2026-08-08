import * as THREE from 'three';
import * as TX from './textures.js';
import {
  blobGeometry,
  limbGeometry,
  featherGeometry,
  strapGeometry,
  mergeGeometries,
  RoundedBoxGeometry,
  damp,
  TAU,
  lerp,
} from './util.js';

/*
 * The falconer is the point of the game, so the rig is built around the one
 * posture the sport is known for: shoulders square, the gloved arm held out
 * level, forearm horizontal, fist steady enough for a bird to stand on. Every
 * other pose here is a departure from that line and a return to it.
 *
 * Joint angles live in plain pose objects that get eased toward, so the whole
 * movement vocabulary is readable in one place — see POSES below.
 */

const ARM_UP = 0.34; // upper arm
const ARM_LO = 0.31; // forearm

/** Blend-able pose. Every entry is [x, y, z] Euler radians unless noted. */
const P = (o) => ({
  hips: [0, 0, 0],
  spine: [0, 0, 0],
  neck: [0, 0, 0],
  lShoulder: [0.1, 0, 0.1],
  lElbow: [-0.3, 0, 0],
  lWrist: [0, 0, 0],
  rShoulder: [0.1, 0, -0.1],
  rElbow: [-0.3, 0, 0],
  rWrist: [0, 0, 0],
  rootY: 0,
  lean: 0,
  ...o,
});

/*
 * The left arm carries the glove. Abduction is rotation.z: -PI/2 swings the arm
 * straight out to the character's left; rotation.y then brings it round toward
 * the front; rotation.x swings it fore and aft.
 */
export const POSES = {
  // Waiting, hands easy at the sides.
  rest: P({}),

  // Reaching down for the gauntlet on its block.
  takeGlove: P({
    spine: [0.3, -0.34, 0],
    rShoulder: [-0.95, 0.2, -0.66],
    rElbow: [-0.5, 0, 0],
    lShoulder: [0.24, 0, 0.16],
    lElbow: [-0.55, 0, 0],
    neck: [0.34, -0.28, 0],
    rootY: -0.12,
  }),

  // Pulling the gauntlet onto the left hand, held up across the chest.
  donGlove: P({
    spine: [0.04, -0.12, 0],
    lShoulder: [-0.5, 0.62, -0.5],
    lElbow: [-1.45, 0, 0],
    rShoulder: [-0.66, 0.56, -0.56],
    rElbow: [-1.7, 0, 0],
    neck: [0.26, 0.06, 0],
  }),

  // THE pose: gloved arm out level, fist ready to be stood on.
  offer: P({
    spine: [0, 0.05, 0.02],
    lShoulder: [0.05, 0.3, -1.52],
    lElbow: [-0.16, 0, 0.05],
    lWrist: [0, 0, 0.1],
    rShoulder: [0.14, 0, -0.16],
    rElbow: [-0.52, 0, 0],
    neck: [0.02, -0.3, 0],
    lean: 0.05,
  }),

  // The free hand comes across to the fist to unclip the leash.
  unclip: P({
    spine: [0.05, 0.12, 0.02],
    lShoulder: [0.05, 0.3, -1.52],
    lElbow: [-0.16, 0, 0.05],
    rShoulder: [-0.7, -0.8, -0.72],
    rElbow: [-1.45, 0, 0],
    neck: [0.26, -0.44, 0],
    lean: 0.06,
  }),

  // Wind-up: the arm drops and cocks back before the cast.
  castLoad: P({
    spine: [0.08, -0.16, 0],
    lShoulder: [0.44, 0.06, -1.14],
    lElbow: [-0.4, 0, 0.05],
    rShoulder: [0.22, 0, -0.24],
    rElbow: [-0.62, 0, 0],
    neck: [0.06, -0.2, 0],
    rootY: -0.07,
    lean: -0.07,
  }),

  // The cast: the whole body drives the arm up and out.
  cast: P({
    spine: [-0.22, 0.36, 0.04],
    lShoulder: [-0.66, 0.66, -1.66],
    lElbow: [-0.02, 0, 0.02],
    lWrist: [0, 0, -0.22],
    rShoulder: [0.55, -0.24, -0.4],
    rElbow: [-0.9, 0, 0],
    neck: [-0.32, -0.3, 0],
    rootY: 0.06,
    lean: 0.18,
  }),

  // Watching the hawk work overhead.
  watch: P({
    spine: [-0.12, 0.05, 0],
    lShoulder: [0.26, 0.05, -0.36],
    lElbow: [-0.72, 0, 0],
    rShoulder: [0.22, 0, -0.22],
    rElbow: [-0.62, 0, 0],
    neck: [-0.46, -0.15, 0],
  }),

  // Base for the lure swing; the right arm is overwritten procedurally.
  lure: P({
    spine: [-0.05, -0.08, 0],
    lShoulder: [0.32, 0.05, -0.32],
    lElbow: [-0.88, 0, 0],
    rShoulder: [-1.2, -0.2, -0.5],
    rElbow: [-0.3, 0, 0],
    neck: [-0.28, -0.1, 0],
  }),
};

/* ---------- the gauntlet ---------- */

/*
 * Built already in its worn orientation, in the wrist's local frame: +Y runs
 * back up the forearm toward the elbow, so the stiff cuff climbs the arm and
 * the fist hangs off the bottom. That way putting it on is a straight parent
 * swap with no flipping about.
 */
function buildGauntlet(M) {
  const g = new THREE.Group();

  const CUFF_H = 0.23;
  const cuff = new THREE.Mesh(
    blobGeometry(CUFF_H, (t) => lerp(0.068, 0.093, t) + Math.sin(t * Math.PI) * 0.006, 12, 20),
    M.gloveLeather,
  );
  cuff.castShadow = true;
  cuff.receiveShadow = true;
  g.add(cuff);

  // Rolled rim in a bright trim colour at the wide, elbow-end opening.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.016, 10, 26), M.trim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = CUFF_H - 0.012;
  rim.castShadow = true;
  g.add(rim);

  // Fringe hanging off the cuff, the way a working gauntlet always has.
  const fringeParts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const s = strapGeometry(0.075 + (i % 3) * 0.014, 0.015, 0.005, 0.3);
    s.rotateX(-0.12);
    s.translate(Math.cos(a) * 0.09, CUFF_H - 0.02, Math.sin(a) * 0.09);
    fringeParts.push(s);
  }
  const fringe = new THREE.Mesh(mergeGeometries(fringeParts), M.gloveLeather);
  fringe.castShadow = true;
  g.add(fringe);

  // Stitching around the cuff.
  for (const y of [0.05, 0.15]) {
    const stitch = new THREE.Mesh(new THREE.TorusGeometry(0.0755 + y * 0.09, 0.0035, 6, 30), M.stitch);
    stitch.rotation.x = Math.PI / 2;
    stitch.position.y = y;
    g.add(stitch);
  }

  // The fist: a chunky mitt with the fingers rolled over — the shape a bird
  // actually stands on.
  const hand = new THREE.Group();
  hand.position.y = -0.055;
  g.add(hand);
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.135, 0.15, 4, 0.05), M.gloveLeather);
  palm.castShadow = true;
  palm.receiveShadow = true;
  hand.add(palm);
  const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.07, 5, 12), M.gloveLeather);
  fingers.rotation.z = Math.PI / 2;
  fingers.position.set(0, -0.035, 0.055);
  fingers.castShadow = true;
  hand.add(fingers);
  for (let i = 0; i < 3; i++) {
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), M.gloveLeather);
    knuckle.position.set(-0.032 + i * 0.032, 0.0, 0.072);
    hand.add(knuckle);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.05, 4, 10), M.gloveLeather);
  thumb.rotation.set(0.6, 0, 1.0);
  thumb.position.set(0.052, 0.03, 0.052);
  hand.add(thumb);

  // Brass swivel and leash clasp on the fist — the fitting the player taps.
  const clasp = new THREE.Group();
  clasp.position.set(-0.055, -0.02, 0.05);
  hand.add(clasp);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 18), M.brass);
  ring.rotation.y = Math.PI / 2;
  clasp.add(ring);
  const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.026, 4, 10), M.brass);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = -0.03;
  clasp.add(barrel);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0048, 6, 14, Math.PI * 1.5), M.brass);
  hook.rotation.y = Math.PI / 2;
  hook.position.x = -0.055;
  clasp.add(hook);

  return { group: g, hand, clasp, palm };
}

export function createFalconer() {
  const gloveTex = TX.leather(0x5b3418, 0xa9713d, 9);
  gloveTex.map.repeat.set(2, 2);
  gloveTex.normalMap.repeat.set(2, 2);
  const tunicTex = TX.cloth(0x2b5f66, 0x53939a, 4);
  tunicTex.map.repeat.set(3, 3);
  tunicTex.normalMap.repeat.set(3, 3);
  const sleeveTex = TX.cloth(0x8d7551, 0xc4ad84, 6);
  sleeveTex.map.repeat.set(2, 3);
  sleeveTex.normalMap.repeat.set(2, 3);
  const trouserTex = TX.cloth(0x3b3a52, 0x5d5b78, 21);
  trouserTex.map.repeat.set(3, 4);
  trouserTex.normalMap.repeat.set(3, 4);
  const beltTex = TX.leather(0x4a2c15, 0x81522b, 17);

  const M = {
    gloveLeather: new THREE.MeshStandardMaterial({
      map: gloveTex.map,
      normalMap: gloveTex.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.56,
      metalness: 0.03,
    }),
    trim: new THREE.MeshStandardMaterial({ color: 0xef97b8, roughness: 0.52 }),
    stitch: new THREE.MeshStandardMaterial({ color: 0xf2e0bd, roughness: 0.75 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xdcb265, roughness: 0.26, metalness: 0.92 }),
    tunic: new THREE.MeshStandardMaterial({
      map: tunicTex.map,
      normalMap: tunicTex.normalMap,
      roughness: 0.88,
      metalness: 0,
    }),
    sleeve: new THREE.MeshStandardMaterial({
      map: sleeveTex.map,
      normalMap: sleeveTex.normalMap,
      roughness: 0.9,
      metalness: 0,
    }),
    trouser: new THREE.MeshStandardMaterial({
      map: trouserTex.map,
      normalMap: trouserTex.normalMap,
      roughness: 0.93,
      metalness: 0,
    }),
    belt: new THREE.MeshStandardMaterial({
      map: beltTex.map,
      normalMap: beltTex.normalMap,
      roughness: 0.6,
      metalness: 0.02,
    }),
    skin: new THREE.MeshStandardMaterial({ color: 0xf3cba6, roughness: 0.68 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.78 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x4a3120, roughness: 0.66 }),
    scarf: new THREE.MeshStandardMaterial({ color: 0xe2708f, roughness: 0.84 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a2c26, roughness: 0.6 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x281c14, roughness: 0.18 }),
    blush: new THREE.MeshStandardMaterial({
      color: 0xe98f92,
      roughness: 0.9,
      transparent: true,
      opacity: 0.4,
    }),
  };

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.82;
  root.add(hips);

  /* legs */
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.105, -0.02, 0);
    hips.add(leg);
    const thigh = new THREE.Mesh(limbGeometry(0.45, 0.07, 0.1, 8, 12), M.trouser);
    thigh.rotation.x = Math.PI;
    thigh.castShadow = true;
    leg.add(thigh);
    const shin = new THREE.Mesh(limbGeometry(0.39, 0.055, 0.08, 8, 12), M.trouser);
    shin.rotation.x = Math.PI;
    shin.position.y = -0.43;
    shin.castShadow = true;
    leg.add(shin);
    const boot = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.12, 0.25, 4, 0.05), M.boot);
    boot.position.set(0, -0.83, 0.045);
    boot.castShadow = true;
    boot.receiveShadow = true;
    leg.add(boot);
    // Turned-down boot top.
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.115, 14), M.belt);
    cuff.position.set(0, -0.72, 0);
    cuff.castShadow = true;
    leg.add(cuff);
    leg.rotation.z = s * 0.03;
  }

  /* torso — narrow enough that the arms read as separate limbs */
  const spine = new THREE.Group();
  hips.add(spine);
  const torso = new THREE.Mesh(
    blobGeometry(
      0.56,
      (t) =>
        // Waist in, chest out, shoulders tapering back in at the top.
        lerp(0.135, 0.163, Math.sin(Math.pow(t, 0.9) * Math.PI * 0.92)) *
          (1 - Math.pow(t, 3) * 0.28) +
        0.005,
      16,
      20,
    ),
    M.tunic,
  );
  torso.castShadow = true;
  torso.receiveShadow = true;
  spine.add(torso);

  // Leather belt, pouch, buckle.
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.147, 0.075, 22), M.belt);
  belt.position.y = 0.05;
  belt.castShadow = true;
  spine.add(belt);
  const buckle = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.055, 0.02, 3, 0.012), M.brass);
  buckle.position.set(0, 0.05, 0.15);
  spine.add(buckle);
  const pouch = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.16, 0.085, 4, 0.038), M.belt);
  pouch.position.set(0.145, -0.035, 0.075);
  pouch.rotation.y = -0.5;
  pouch.castShadow = true;
  spine.add(pouch);
  const flap = new THREE.Mesh(new RoundedBoxGeometry(0.145, 0.075, 0.095, 3, 0.032), M.gloveLeather);
  flap.position.set(0.145, 0.043, 0.075);
  flap.rotation.y = -0.5;
  spine.add(flap);

  const skirt = new THREE.Mesh(
    blobGeometry(0.2, (t) => lerp(0.172, 0.14, Math.pow(t, 0.75)) + 0.004, 10, 22),
    M.tunic,
  );
  skirt.position.y = -0.115;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  spine.add(skirt);

  // Rainbow-stitched hem: a splash of colour that stays well off the bird.
  const hemColors = [0xe8879f, 0xf0b45f, 0xf2e08a, 0x8fd08a, 0x7fb8e8, 0xb69ae0];
  hemColors.forEach((c, i) => {
    const seg = new THREE.Mesh(
      new THREE.TorusGeometry(0.166, 0.0085, 6, 12, TAU / hemColors.length),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }),
    );
    seg.rotation.x = Math.PI / 2;
    seg.rotation.z = (i / hemColors.length) * TAU;
    seg.position.y = -0.152;
    spine.add(seg);
  });

  // Shoulder scarf.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.028, 10, 24), M.scarf);
  collar.position.y = 0.545;
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 1, 0.85);
  collar.castShadow = true;
  spine.add(collar);
  const cape = new THREE.Mesh(
    blobGeometry(0.26, (t) => lerp(0.1, 0.15, Math.sin(t * Math.PI * 0.8)) + 0.004, 8, 16),
    M.scarf,
  );
  cape.rotation.x = Math.PI - 0.2;
  cape.position.set(0, 0.55, -0.075);
  cape.scale.set(1.35, 1, 0.5);
  cape.castShadow = true;
  spine.add(cape);

  /* head */
  const neck = new THREE.Group();
  neck.position.y = 0.585;
  spine.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 12), M.skin);
  neckMesh.position.y = -0.03;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.y = 0.072;
  head.scale.setScalar(0.9);
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 20), M.skin);
  skull.scale.set(1, 1.06, 0.98);
  skull.position.y = 0.105;
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), M.skin);
  jaw.scale.set(1, 0.8, 0.98);
  jaw.position.set(0, 0.05, 0.008);
  head.add(jaw);

  // Face: minimal but warm — dot eyes, soft brows, a small smile.
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), M.eye);
    e.position.set(s * 0.052, 0.1, 0.132);
    e.scale.set(1, 1.2, 0.55);
    head.add(e);
    const gl = new THREE.Mesh(
      new THREE.SphereGeometry(0.0065, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    gl.position.set(s * 0.058, 0.111, 0.143);
    head.add(gl);
    const brow = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.01, 0.012, 2, 0.004), M.hair);
    brow.position.set(s * 0.052, 0.139, 0.129);
    brow.rotation.z = s * 0.06;
    head.add(brow);
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), M.blush);
    bl.position.set(s * 0.086, 0.062, 0.106);
    bl.scale.set(1, 0.6, 0.3);
    head.add(bl);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), M.skin);
  nose.position.set(0, 0.077, 0.144);
  head.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0035, 6, 14, Math.PI * 0.85), M.dark);
  smile.position.set(0, 0.052, 0.146);
  smile.rotation.set(0.1, 0, Math.PI * 1.075);
  head.add(smile);

  /*
   * Hair sits as a cap: slightly larger than the skull, pushed back and up so
   * the face stays clear of it, with a fringe blob over the brow.
   */
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.158, 22, 18), M.hair);
  hair.scale.set(1.03, 1.04, 0.94);
  hair.position.set(0, 0.122, -0.038);
  hair.castShadow = true;
  head.add(hair);
  const fringeBlob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), M.hair);
  fringeBlob.scale.set(1.4, 0.5, 0.62);
  fringeBlob.position.set(0, 0.196, 0.045);
  head.add(fringeBlob);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M.hair);
    side.scale.set(0.62, 1.35, 0.85);
    side.position.set(s * 0.128, 0.095, -0.022);
    head.add(side);
  }

  // Braid down the back, swinging with the body.
  const braid = new THREE.Group();
  braid.position.set(0, 0.075, -0.13);
  head.add(braid);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.042 - i * 0.006, 12, 10), M.hair);
    b.position.y = -0.065 * i;
    b.scale.set(1, 0.88, 1);
    b.castShadow = true;
    braid.add(b);
  }
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.01, 6, 14), M.trim);
  ribbon.position.y = -0.225;
  ribbon.rotation.x = Math.PI / 2;
  braid.add(ribbon);

  // Headband with a feather tucked in it, in place of a hat.
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.015, 8, 26), M.trim);
  band.position.set(0, 0.152, -0.012);
  band.rotation.set(Math.PI / 2 - 0.12, 0, 0);
  head.add(band);
  const capFeather = new THREE.Mesh(
    featherGeometry(0.17, 0.045, { camber: 0.3, cup: 0.4, root: 0.4 }),
    new THREE.MeshStandardMaterial({
      map: TX.featherVane(0xb8875f, 0x4a3020, 0xf0e2c8, true).map,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  capFeather.position.set(-0.125, 0.145, -0.055);
  capFeather.rotation.set(-0.35, -0.75, 1.15);
  capFeather.castShadow = true;
  head.add(capFeather);

  /* arms */
  function buildArm(sgn) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sgn * 0.185, 0.47, 0.005);
    spine.add(shoulder);

    // A small sleeve cap rounds off the shoulder joint without turning it into
    // a pad; a thin leather strap over it gives the seam something to read as.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), M.sleeve);
    cap.scale.set(1, 0.92, 1);
    cap.castShadow = true;
    shoulder.add(cap);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.009, 6, 16), M.belt);
    strap.rotation.set(0, 0, Math.PI / 2);
    strap.position.y = -0.012;
    shoulder.add(strap);

    const upper = new THREE.Mesh(limbGeometry(ARM_UP, 0.05, 0.072, 7, 12), M.sleeve);
    upper.rotation.x = Math.PI;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -ARM_UP;
    shoulder.add(elbow);
    // Rolled cuff where the sleeve ends and the bare forearm starts.
    const sleeveEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.075, 14), M.sleeve);
    sleeveEnd.position.y = -0.02;
    sleeveEnd.castShadow = true;
    elbow.add(sleeveEnd);
    const fore = new THREE.Mesh(limbGeometry(ARM_LO, 0.043, 0.055, 7, 12), M.skin);
    fore.rotation.x = Math.PI;
    fore.castShadow = true;
    elbow.add(fore);

    const wrist = new THREE.Group();
    wrist.position.y = -ARM_LO;
    elbow.add(wrist);

    // Bare hand, used by the free arm throughout and by the left until the
    // gauntlet goes on.
    const bare = new THREE.Group();
    wrist.add(bare);
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.095, 0.055, 4, 0.026), M.skin);
    palm.position.y = -0.048;
    palm.castShadow = true;
    bare.add(palm);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.028, 4, 8), M.skin);
    thumb.position.set(sgn * 0.036, -0.036, 0.018);
    thumb.rotation.z = sgn * 0.6;
    bare.add(thumb);

    return { shoulder, elbow, wrist, bare };
  }

  const armL = buildArm(-1);
  const armR = buildArm(1);

  // A leather vambrace on the free forearm balances the gauntlet visually.
  const vambrace = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.054, 0.15, 14), M.belt);
  vambrace.position.y = -0.16;
  vambrace.castShadow = true;
  armR.elbow.add(vambrace);

  /* gauntlet, initially off the hand */
  const gauntlet = buildGauntlet(M);
  const gloveMount = new THREE.Group();
  armL.wrist.add(gloveMount);

  /* ---------- pose blending ---------- */

  const joints = {
    hips,
    spine,
    neck,
    lShoulder: armL.shoulder,
    lElbow: armL.elbow,
    lWrist: armL.wrist,
    rShoulder: armR.shoulder,
    rElbow: armR.elbow,
    rWrist: armR.wrist,
  };

  const current = P({});
  let target = P({});
  let blendRate = 6;

  function setPose(pose, rate = 6) {
    target = pose;
    blendRate = rate;
  }
  function snapPose(pose) {
    target = pose;
    for (const k of Object.keys(current)) {
      if (Array.isArray(current[k])) current[k] = pose[k].slice();
      else current[k] = pose[k];
    }
  }

  let swayT = 0;

  function update(dt) {
    swayT += dt;
    for (const k of Object.keys(current)) {
      if (Array.isArray(current[k])) {
        for (let i = 0; i < 3; i++) current[k][i] = damp(current[k][i], target[k][i], blendRate, dt);
      } else {
        current[k] = damp(current[k], target[k], blendRate, dt);
      }
    }

    // Idle breathing and a slow weight shift, so a still frame is never static.
    const breathe = Math.sin(swayT * 1.5) * 0.012;
    const shift = Math.sin(swayT * 0.62) * 0.02;

    hips.rotation.set(current.hips[0], current.hips[1] + shift * 0.6, current.hips[2]);
    hips.position.y = 0.82 + current.rootY + breathe * 0.4;
    spine.rotation.set(
      current.spine[0] + breathe,
      current.spine[1],
      current.spine[2] + current.lean * 0.4 + shift,
    );
    neck.rotation.set(current.neck[0] - breathe * 0.6, current.neck[1], current.neck[2], 'YXZ');

    for (const key of ['lShoulder', 'lElbow', 'lWrist', 'rShoulder', 'rElbow', 'rWrist']) {
      const a = current[key];
      joints[key].rotation.set(a[0], a[1], a[2], 'YZX');
    }

    braid.rotation.x = Math.sin(swayT * 1.1) * 0.09 - current.neck[0] * 0.5;
    braid.rotation.z = Math.sin(swayT * 0.8) * 0.07;
  }

  update(0.016);

  /* ---------- glove handling ---------- */

  let gloveState = 'off';

  /** Park the loose gauntlet somewhere in the world, waiting to be picked up. */
  function detachGlove(worldParent, pos) {
    worldParent.add(gauntlet.group);
    gauntlet.group.position.copy(pos);
    gauntlet.group.rotation.set(-0.34, 0.7, 0.2);
    gloveState = 'off';
  }
  function gloveToHand(hand) {
    hand.add(gauntlet.group);
    gauntlet.group.position.set(0, -0.11, 0.05);
    gauntlet.group.rotation.set(-1.5, 0, 0.5);
    gloveState = 'carried';
  }
  function wearGlove() {
    gloveMount.add(gauntlet.group);
    gauntlet.group.position.set(0, 0.01, 0);
    gauntlet.group.rotation.set(0, 0, 0);
    gloveState = 'worn';
  }

  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  /**
   * Where the hawk's feet go: the back of the fist, just inboard of the
   * knuckles, which is where a bird actually stands. Taken from the fist's
   * world position and lifted straight up, so it stays right whatever angle
   * the wrist is held at — a hawk stands level even when the hand does not.
   */
  function fistPoint(target) {
    gauntlet.hand.getWorldPosition(_v);
    armL.wrist.getWorldPosition(_w);
    _v.lerp(_w, 0.55);
    _v.y += 0.072;
    return (target || new THREE.Vector3()).copy(_v);
  }
  /** The facing a bird on the fist settles into: the falconer's own facing. */
  function fistQuaternion(target) {
    const q = target || new THREE.Quaternion();
    return q.setFromEuler(new THREE.Euler(0, root.rotation.y + current.spine[1], 0, 'YXZ'));
  }

  return {
    root,
    joints,
    spine,
    neck,
    head,
    armL,
    armR,
    gauntlet,
    materials: M,
    setPose,
    snapPose,
    update,
    detachGlove,
    gloveToHand,
    wearGlove,
    fistPoint,
    fistQuaternion,
    get gloveState() {
      return gloveState;
    },
    poseNow: current,
  };
}
