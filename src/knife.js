// ---------------------------------------------------------------------------
//  Maguro-bocho — the specialist tuna knife.
//  1.36 m of blade on a 0.34 m handle: standing on its tip it very nearly
//  reaches the craftsman's shoulder. That comparison is the whole point.
//
//  Local frame: +X runs handle -> tip, the edge faces -Y, flats face +/-Z.
//  The origin sits at the machi (blade/handle junction).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { lerp, clamp, smoothstep, buildGrid } from './util.js';
import { steelTexture, woodTexture, clothTexture } from './textures.js';

export const BLADE_LEN = 1.36;
export const HANDLE_LEN = 0.34;
export const TOTAL_LEN = BLADE_LEN + HANDLE_LEN;

/** Cross-section of the blade, from the cutting edge (0) to the mune (1). */
const HALF = [
  [0.000, 0.00], [0.040, 0.30], [0.110, 0.54], [0.250, 0.75],
  [0.440, 0.89], [0.660, 0.97], [0.870, 1.00], [0.975, 0.86], [1.000, 0.55],
];
const LOOP = [
  ...HALF.map((p) => [p[0], p[1]]),
  [1.006, 0.0],
  ...HALF.slice().reverse().map((p) => [p[0], -p[1]]),
];

const spineY = (t) => {
  const base = 0.102 - 0.019 * t;
  return t < 0.87 ? base : lerp(base, 0.016, smoothstep(0.87, 1.0, t));
};
const edgeY = (t) => (t < 0.93 ? 0 : lerp(0, 0.016, smoothstep(0.93, 1.0, t)));
const halfThick = (t) => 0.0036 * (1 - 0.40 * t);

function bladeGeometry() {
  const nk = LOOP.length - 1;
  return buildGrid((si, sj, p, col, o) => {
    const fi = si * nk;
    const i0 = Math.min(nk, Math.floor(fi));
    const f = fi - i0;
    const a = LOOP[i0], b = LOOP[Math.min(nk, i0 + 1)];
    const w = lerp(a[0], b[0], f);
    const zf = lerp(a[1], b[1], f);

    const t = sj;
    const y = lerp(edgeY(t), spineY(t), w);
    p.set(t * BLADE_LEN, y, zf * halfThick(t));

    // kasumi finish: a soft misted band above the polished edge bevel
    const shine = 1.25 - 0.42 * smoothstep(0.25, 0.85, w);
    const wear = 1 - 0.07 * Math.sin(t * 23.0) * smoothstep(0.2, 0.9, w);
    col.setRGB(shine * wear, shine * wear * 1.005, shine * wear * 1.02);

    o.uv[0] = t * 3.0;
    o.uv[1] = w;
  }, nk, 96, false);
}

export function createKnife() {
  const root = new THREE.Group();
  root.name = 'knife';

  const steel = steelTexture();
  // Darker base metal with a hard specular: against a pale concrete hall a
  // near-white blade simply disappears.
  const matBlade = new THREE.MeshPhysicalMaterial({
    color: '#b4bdc3', map: steel, vertexColors: true,
    metalness: 1.0, roughness: 0.09,
    clearcoat: 0.65, clearcoatRoughness: 0.05,
    envMapIntensity: 2.4,
  });
  const blade = new THREE.Mesh(bladeGeometry(), matBlade);
  blade.castShadow = true;
  blade.receiveShadow = true;
  root.add(blade);

  // machi collar / habaki
  const matFerrule = new THREE.MeshPhysicalMaterial({
    color: '#1a1a1c', roughness: 0.30, metalness: 0.15, clearcoat: 0.7, envMapIntensity: 1.1,
  });
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.034, 0.045, 8), matFerrule);
  ferrule.rotation.z = -Math.PI / 2;
  ferrule.position.set(-0.020, 0.040, 0);
  ferrule.castShadow = true;
  root.add(ferrule);

  // ho-wood octagonal handle, worn smooth by years of use
  const matHandle = new THREE.MeshPhysicalMaterial({
    color: '#c9a877', map: woodTexture(88), roughness: 0.52, clearcoat: 0.25, envMapIntensity: 0.8,
  });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0295, 0.0335, HANDLE_LEN - 0.05, 8), matHandle);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(-0.045 - (HANDLE_LEN - 0.05) / 2, 0.040, 0);
  handle.castShadow = true;
  root.add(handle);

  const butt = new THREE.Mesh(new THREE.SphereGeometry(0.0335, 12, 8), matHandle);
  butt.position.set(-HANDLE_LEN + 0.005, 0.040, 0);
  butt.scale.x = 0.5;
  butt.castShadow = true;
  root.add(butt);

  // cotton cloth wrapped round the mune — where the front hand presses
  const matCloth = new THREE.MeshStandardMaterial({
    color: '#dfe3e0', map: clothTexture('#eceee9', 17), roughness: 0.85, envMapIntensity: 0.6,
  });
  const WRAP_X = 0.34;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.15, 12), matCloth);
  wrap.rotation.z = Math.PI / 2;
  wrap.scale.z = 0.30;
  wrap.position.set(WRAP_X, spineY(WRAP_X / BLADE_LEN) - 0.010, 0);
  wrap.castShadow = true;
  root.add(wrap);

  return {
    root,
    blade,
    materials: { matBlade, matHandle },
    gripRear: new THREE.Vector3(-HANDLE_LEN + 0.10, 0.040, 0),
    gripFrontHandle: new THREE.Vector3(-0.085, 0.042, 0),
    gripFrontSpine: new THREE.Vector3(WRAP_X, spineY(WRAP_X / BLADE_LEN) + 0.028, 0),
    tip: new THREE.Vector3(BLADE_LEN, 0.010, 0),
  };
}

/**
 * Place the knife so its edge rides the work at `contact`, lying along
 * `along` (handle -> tip) with the edge biting toward `edgeDir`.
 *
 * `pull` in 0..1 slides the contact from the heel of the blade to the tip:
 * that is the long single draw a butcher makes, and it is why a 1.36 m blade
 * exists at all. `range` is [near, far] in metres from the machi.
 */
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
export function placeKnife(knife, contact, along, edgeDir, pull, range, roll = 0) {
  _x.copy(along).normalize();
  _y.copy(edgeDir).addScaledVector(_x, -edgeDir.dot(_x));
  if (_y.lengthSq() < 1e-8) {
    _y.set(0, -1, 0).addScaledVector(_x, -_x.y * -1);
    if (_y.lengthSq() < 1e-8) _y.set(0, 0, -1);
  }
  _y.normalize().negate();                     // local +Y is the mune, so flip the bite
  if (roll) {
    _z.crossVectors(_x, _y).normalize();
    _y.addScaledVector(_z, Math.tan(roll)).normalize();
  }
  _z.crossVectors(_x, _y).normalize();
  _y.crossVectors(_z, _x).normalize();

  _m.makeBasis(_x, _y, _z);
  knife.root.quaternion.setFromRotationMatrix(_m);

  const r = range || [0.18, 1.24];
  const at = lerp(r[0], r[1], clamp(pull, 0, 1));
  knife.root.position.copy(contact).addScaledVector(_x, -at).addScaledVector(_y, -0.012);
  return knife.root;
}
