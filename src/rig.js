// ---------------------------------------------------------------------------
// The rope access rig and the worker.
//
// This is the star of the show, so every part that a rope tech would actually
// touch is modelled: a working line and a backup line, a bobbin descender with
// side plates and a control handle, a screw-lock connector, a plywood seat
// board slung on a four-leg bridle, and a harness whose three buckles really
// open and close.
// ---------------------------------------------------------------------------

import * as THREE from '../vendor/three/three.module.js';
import * as T from './textures.js';
import { xf, mergeGeoms, beveledBox, roundedRect, frameGeom, lathe, capsule, DynamicTube, pbr, repeated } from './geom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();

/** Place a +Y-aligned mesh so it spans from a to b. */
function seg(mesh, a, b) {
  _a.subVectors(b, a);
  const len = _a.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  if (len > 1e-6) {
    _a.divideScalar(len);
    mesh.quaternion.setFromUnitVectors(UP, _a);
  }
  mesh.scale.y = len / mesh.userData.baseLen;
}

/** Two-bone IK. Returns the elbow/knee position. */
function ik(root, target, l1, l2, pole, out) {
  _a.subVectors(target, root);
  let d = _a.length();
  const maxD = (l1 + l2) * 0.998;
  if (d > maxD) { _a.multiplyScalar(maxD / d); d = maxD; }
  if (d < 1e-4) { d = 1e-4; _a.set(0, -1, 0).multiplyScalar(d); }
  const a = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _b.copy(_a).normalize();
  _c.copy(pole).addScaledVector(_b, -pole.dot(_b));
  if (_c.lengthSq() < 1e-8) _c.set(0, 0, 1).addScaledVector(_b, -_b.z);
  _c.normalize();
  out.copy(root).addScaledVector(_b, a).addScaledVector(_c, h);
  return out;
}

export class Rig {
  constructor(scene, env) {
    this.scene = scene;
    this.group = new THREE.Group();      // origin = harness ventral attachment
    scene.add(this.group);

    this.hang = 0;          // 0 = standing on the roof, 1 = suspended
    this.lean = 0;          // sideways swing toward the pane being cleaned
    this.buckles = [0, 0, 0];
    this.descenderAttached = 0;
    this.toolPoint = null;       // world point on the glass the tool is working
    this.bladeRoll = 0;          // squeegee roll, kept square to the stroke
    this.sprayNozzleWorld = null;
    this.tool = 'none';          // 'none' | 'spray' | 'squeegee'
    this.t = 0;
    this.wallZ = 0;              // world z of the glass face

    this._materials();
    this._buildBoard();
    this._buildHarness();
    this._buildCharacter();
    this._buildDescender();
    this._buildTools();
    this._buildRopes();
  }

  _materials() {
    this.mAlu = new THREE.MeshStandardMaterial({ color: 0xc3c8cc, roughness: 0.30, metalness: 1.0, envMapIntensity: 1.3 });
    this.mSteel = new THREE.MeshStandardMaterial({ color: 0xa9b0b6, roughness: 0.22, metalness: 1.0, envMapIntensity: 1.4 });
    this.mAnodRed = new THREE.MeshStandardMaterial({ color: 0xd2321f, roughness: 0.30, metalness: 0.85, envMapIntensity: 1.2 });
    this.mAnodGold = new THREE.MeshStandardMaterial({ color: 0xd9a02a, roughness: 0.26, metalness: 1.0, envMapIntensity: 1.35 });
    this.mRubber = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.72, metalness: 0.0 });
    this.mSkin = new THREE.MeshStandardMaterial({ color: 0xf6ceb0, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.8 });
    this.mHair = new THREE.MeshStandardMaterial({ color: 0x53341f, roughness: 0.45, metalness: 0.0, envMapIntensity: 0.9 });
    this.mHelmet = new THREE.MeshPhysicalMaterial({ color: 0xfff2f6, roughness: 0.16, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.3 });

    // Woven softshell rather than moulded plastic.
    const jacket = T.clothMaps(256, [0.98, 0.45, 0.62]);
    this.mVis = pbr(jacket, { envMapIntensity: 0.85 });
    this.mVis.map = repeated(jacket.map, 4, 3);
    this.mVis.normalMap = repeated(jacket.normalMap, 4, 3);
    this.mVis.roughnessMap = this.mVis.metalnessMap = repeated(jacket.rmMap, 4, 3);
    this.mVis.normalScale.set(0.85, 0.85);

    const trouser = T.clothMaps(256, [0.20, 0.34, 0.60]);
    this.mVisDark = pbr(trouser, { envMapIntensity: 0.7 });
    this.mVisDark.map = repeated(trouser.map, 3, 4);
    this.mVisDark.normalMap = repeated(trouser.normalMap, 3, 4);
    this.mVisDark.roughnessMap = this.mVisDark.metalnessMap = repeated(trouser.rmMap, 3, 4);

    this.mReflect = new THREE.MeshStandardMaterial({ color: 0xc9d3d8, roughness: 0.18, metalness: 0.62, envMapIntensity: 2.0 });
    this.mGlassLens = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.45, envMapIntensity: 1.6, clearcoat: 1 });

    const web = T.webbingMaps(256, [0.90, 0.30, 0.46]);
    this.mWeb = pbr(web, { envMapIntensity: 0.75 });
    this.mWeb.map = repeated(web.map, 1, 5);
    this.mWeb.normalMap = repeated(web.normalMap, 1, 5);
    this.mWeb.roughnessMap = this.mWeb.metalnessMap = repeated(web.rmMap, 1, 5);

    const web2 = T.webbingMaps(256, [0.26, 0.32, 0.42]);
    this.mWeb2 = pbr(web2, { envMapIntensity: 0.75 });
    this.mWeb2.map = repeated(web2.map, 7, 7);
    this.mWeb2.normalMap = repeated(web2.normalMap, 7, 7);
    this.mWeb2.roughnessMap = this.mWeb2.metalnessMap = repeated(web2.rmMap, 7, 7);

    this.plyMaps = T.plywoodMaps(256);
    this.mPly = pbr(this.plyMaps, { envMapIntensity: 0.9 });

    this.ropeMaps = T.ropeMaps(256);
    this.mRope = pbr(this.ropeMaps, { envMapIntensity: 0.7 });
    this.mRope.map = repeated(this.ropeMaps.map, 1, 1);
    this.mRope.normalMap = repeated(this.ropeMaps.normalMap, 1, 1);
    this.mRope.roughnessMap = this.mRope.metalnessMap = repeated(this.ropeMaps.rmMap, 1, 1);
    this.mRope.normalScale.set(1.4, 1.4);

    const rope2 = T.ropeMaps(256);
    this.mRope2 = pbr(rope2, { color: 0x9fd9a6, envMapIntensity: 0.7 });
  }

  _add(mesh, parent) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (parent || this.group).add(mesh);
    return mesh;
  }

  // --- seat board ----------------------------------------------------------

  _buildBoard() {
    const g = new THREE.Group();
    this.boardGroup = g;
    this.group.add(g);

    const W = 0.60, D = 0.235, TH = 0.030;
    // Plywood plank: rounded ends, chamfered top edges, two rope holes.
    const shape = roundedRect(W, D, 0.045);
    const holeR = 0.017;
    for (const hx of [-W / 2 + 0.045, W / 2 - 0.045]) {
      const p = new THREE.Path();
      p.absarc(hx, 0, holeR, 0, Math.PI * 2, true);
      shape.holes.push(p);
    }
    const plank = new THREE.ExtrudeGeometry(shape, {
      depth: TH - 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 8,
    });
    plank.rotateX(-Math.PI / 2);
    plank.translate(0, TH / 2, 0);
    const board = this._add(new THREE.Mesh(plank, this.mPly), g);
    board.position.y = -0.265;
    this.board = board;

    // Edge banding strip so the laminations read on the end grain.
    for (const s of [-1, 1]) {
      const e = this._add(new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, 0.012, 16, 1, false, 0, Math.PI), this.mPly), g);
      e.position.set(s * (W / 2 - 0.001), -0.250, 0);
      e.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    }

    // Four-leg bridle: rope legs up from the board holes to a steel ring.
    this.bridle = [];
    const legGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 8);
    legGeo.computeBoundingBox();
    for (let i = 0; i < 4; i++) {
      const m = this._add(new THREE.Mesh(legGeo, this.mRope), g);
      m.userData.baseLen = 1;
      this.bridle.push(m);
    }
    const ring = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.010, 10, 22), this.mSteel), g);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, 0.055, 0.030);
    this.bridleRing = ring;

    // Backrest strap — the bit that makes a seat board comfortable.
    const back = this._add(new THREE.Mesh(beveledBox(0.33, 0.062, 0.016, 0.004), this.mWeb), g);
    back.position.set(0, -0.115, 0.250);
    back.rotation.x = 0.12;
    this.backrest = back;
  }

  // --- harness -------------------------------------------------------------

  /** An oval webbing loop (waist belt / leg loop) built as a flat strap ring. */
  _strapLoop(rx, rz, width, thick, mat) {
    const pts = [];
    const N = 40;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * rz));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const frames = curve.computeFrenetFrames(N, true);
    const posArr = [], nrmArr = [], uvArr = [], idx = [];
    const prof = [[-width / 2, thick / 2], [width / 2, thick / 2], [width / 2, -thick / 2], [-width / 2, -thick / 2]];
    for (let i = 0; i <= N; i++) {
      const ii = i % N;
      const p = curve.getPointAt(ii / N);
      const nrm = frames.normals[ii], bin = frames.binormals[ii];
      for (let j = 0; j < prof.length; j++) {
        const [u, v] = prof[j];
        posArr.push(p.x + nrm.x * u + bin.x * v, p.y + nrm.y * u + bin.y * v, p.z + nrm.z * u + bin.z * v);
        const nx = nrm.x * Math.sign(u) * 0.2 + bin.x * Math.sign(v);
        const ny = nrm.y * Math.sign(u) * 0.2 + bin.y * Math.sign(v);
        const nz = nrm.z * Math.sign(u) * 0.2 + bin.z * Math.sign(v);
        const l = Math.hypot(nx, ny, nz) || 1;
        nrmArr.push(nx / l, ny / l, nz / l);
        uvArr.push(j / prof.length, i / N * 6);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < prof.length; j++) {
        const a = i * prof.length + j;
        const b = a + prof.length;
        const a2 = i * prof.length + ((j + 1) % prof.length);
        const b2 = a2 + prof.length;
        idx.push(a, b, a2, b, b2, a2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrmArr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    g.setIndex(idx);
    return new THREE.Mesh(g, mat);
  }

  /** Aluminium quick-connect buckle: female frame + male tongue that swings in. */
  _buckle() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(mergeGeoms([
      frameGeom(0.070, 0.048, 0.011, 0.014, 0.002),
      xf(beveledBox(0.020, 0.048, 0.014, 0.002), { pos: [-0.043, 0, 0] }),
    ]), this.mAnodGold);
    body.castShadow = true;
    g.add(body);
    const tongue = new THREE.Group();
    const tg = new THREE.Mesh(mergeGeoms([
      xf(beveledBox(0.052, 0.030, 0.009, 0.002), { pos: [0.026, 0, 0] }),
      xf(beveledBox(0.022, 0.046, 0.011, 0.002), { pos: [0.062, 0, 0] }),
    ]), this.mAlu);
    tg.castShadow = true;
    tongue.add(tg);
    tongue.position.set(0.001, 0, 0);
    g.add(tongue);
    g.userData.tongue = tongue;
    return g;
  }

  _buildHarness() {
    const g = new THREE.Group();
    this.harness = g;
    this.group.add(g);

    // Waist belt with padded lumbar section.
    const belt = this._strapLoop(0.152, 0.120, 0.072, 0.015, this.mWeb);
    belt.castShadow = true;
    belt.position.set(0, -0.020, 0.01);
    g.add(belt);
    this.belt = belt;
    const pad = this._add(new THREE.Mesh(beveledBox(0.205, 0.105, 0.042, 0.012), this.mWeb2), g);
    pad.position.set(0, -0.018, 0.128);

    // Leg loops.
    this.legLoops = [];
    for (const s of [-1, 1]) {
      const l = this._strapLoop(0.075, 0.095, 0.055, 0.013, this.mWeb);
      l.castShadow = true;
      l.position.set(s * 0.085, -0.215, 0.03);
      l.rotation.x = 0.5;
      g.add(l);
      this.legLoops.push(l);
    }

    // Shoulder straps for the chest attachment / backup line.
    for (const s of [-1, 1]) {
      const st = this._add(new THREE.Mesh(beveledBox(0.045, 0.42, 0.012, 0.004), this.mWeb), g);
      st.position.set(s * 0.088, 0.20, 0.062);
      st.rotation.set(-0.16, s * 0.16, s * 0.18);
    }
    const chestBar = this._add(new THREE.Mesh(beveledBox(0.16, 0.040, 0.012, 0.004), this.mWeb), g);
    chestBar.position.set(0, 0.30, -0.060);

    // Ventral attachment: two aluminium half-rings on a bridge.
    for (const s of [-1, 1]) {
      const r = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.008, 10, 20, Math.PI * 1.2), this.mAnodGold), g);
      r.position.set(s * 0.052, -0.012, -0.045);
      r.rotation.set(0, Math.PI / 2, s * 0.4);
    }
    const bridge = this._add(new THREE.Mesh(beveledBox(0.10, 0.030, 0.013, 0.004), this.mAnodGold), g);
    bridge.position.set(0, -0.012, -0.045);

    // The three buckles the player closes at the start.
    this.buckleMeshes = [];
    const places = [
      { p: [0.0, -0.020, -0.132], r: [0, 0, 0] },              // waist
      { p: [-0.108, -0.230, -0.072], r: [0.5, 0.25, 0] },      // left leg
      { p: [0.108, -0.230, -0.072], r: [0.5, -0.25, 0] },      // right leg
    ];
    for (const pl of places) {
      const b = this._buckle();
      b.position.set(...pl.p);
      b.rotation.set(...pl.r);
      g.add(b);
      this.buckleMeshes.push(b);
    }

    // Tool loops and a small bucket hooked on the side.
    const bucket = new THREE.Group();
    const pail = this._add(new THREE.Mesh(lathe([[0, 0], [0.075, 0], [0.082, 0.012], [0.098, 0.16], [0.101, 0.175], [0.094, 0.178], [0.092, 0.02], [0.070, 0.008], [0, 0.006]], 22), this.mVisDark), bucket);
    const handle = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.093, 0.005, 8, 20, Math.PI), this.mSteel), bucket);
    handle.position.y = 0.175; handle.rotation.y = Math.PI / 2;
    const water = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.074, 0.005, 20), new THREE.MeshPhysicalMaterial({ color: 0x69c8e0, roughness: 0.06, metalness: 0, envMapIntensity: 1.4, transparent: true, opacity: 0.85 })), bucket);
    water.position.y = 0.125;
    bucket.position.set(0.215, -0.12, 0.175);
    bucket.rotation.z = -0.18;
    bucket.scale.setScalar(0.62);
    g.add(bucket);
    this.bucket = bucket;
  }

  // --- character -----------------------------------------------------------

  _buildCharacter() {
    const g = new THREE.Group();
    this.char = g;
    this.group.add(g);

    // Torso: a jacket with a real shoulder yoke, hem band, zip placket,
    // chest pocket and two narrow retroreflective tapes.
    const torsoGeo = lathe([
      [0.00, -0.27], [0.112, -0.272], [0.136, -0.248], [0.141, -0.15],
      [0.130, -0.03], [0.136, 0.075], [0.148, 0.150], [0.150, 0.186],
      [0.130, 0.218], [0.082, 0.242], [0.0, 0.248],
    ], 28);
    this.torso = this._add(new THREE.Mesh(torsoGeo, this.mVis), g);
    this.torso.scale.set(1.0, 0.82, 1.0);
    for (const [y, r] of [[-0.20, 0.1395], [0.030, 0.1345]]) {
      const band = this._add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.022, 28, 1, true), this.mReflect), this.torso);
      band.position.y = y;
    }
    const hem = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.132, 0.032, 28), this.mVisDark), this.torso);
    hem.position.y = -0.262;
    const zip = this._add(new THREE.Mesh(beveledBox(0.024, 0.46, 0.010, 0.003), this.mVisDark), this.torso);
    zip.position.set(0, -0.01, -0.130);
    const pocket = this._add(new THREE.Mesh(beveledBox(0.070, 0.062, 0.016, 0.005), this.mVis), this.torso);
    pocket.position.set(-0.062, 0.055, -0.116); pocket.rotation.y = 0.35;
    const pocketFlap = this._add(new THREE.Mesh(beveledBox(0.074, 0.020, 0.014, 0.004), this.mVisDark), this.torso);
    pocketFlap.position.set(-0.062, 0.090, -0.118); pocketFlap.rotation.y = 0.35;
    // Shoulder seams, so the yoke reads as tailoring and not a moulding.
    for (const s of [-1, 1]) {
      const seam = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0045, 6, 18), this.mVisDark), this.torso);
      seam.position.set(s * 0.118, 0.168, 0);
      seam.rotation.set(0, 0, s * 1.25);
      seam.scale.set(1, 1, 1.25);
    }
    const collar = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.024, 8, 24), this.mVisDark), this.torso);
    collar.position.y = 0.232; collar.rotation.x = Math.PI / 2; collar.scale.set(1, 1.05, 1);

    // Head, hair, helmet.
    const head = new THREE.Group();
    head.scale.setScalar(1.12);
    this.head = head;
    g.add(head);
    const skull = this._add(new THREE.Mesh(new THREE.SphereGeometry(0.108, 26, 20), this.mSkin), head);
    skull.scale.set(1.0, 1.08, 0.98);
    const jaw = this._add(new THREE.Mesh(new THREE.SphereGeometry(0.082, 20, 14), this.mSkin), head);
    jaw.position.set(0, -0.055, -0.018); jaw.scale.set(0.98, 0.82, 1.02);
    const hairCap = this._add(new THREE.Mesh(lathe([[0, 0.118], [0.058, 0.112], [0.096, 0.078], [0.116, 0.015], [0.118, -0.045], [0.110, -0.075], [0.104, -0.078], [0.100, -0.04], [0.096, 0.02], [0.078, 0.072], [0.046, 0.100], [0, 0.106]], 26), this.mHair), head);
    const fringe = this._add(new THREE.Mesh(new THREE.SphereGeometry(0.112, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), this.mHair), head);
    fringe.position.set(0, 0.012, -0.012); fringe.scale.set(1.0, 0.85, 1.06);
    const pony = this._add(new THREE.Mesh(lathe([[0, 0], [0.034, -0.018], [0.044, -0.085], [0.034, -0.155], [0.017, -0.198], [0, -0.208]], 18), this.mHair), head);
    pony.position.set(0, 0.028, 0.108); pony.rotation.x = -0.42;
    this.pony = pony;
    const tie = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.010, 8, 18), this.mVisDark), head);
    tie.position.set(0, 0.045, 0.105); tie.rotation.x = 1.1;

    // Eyes — simple, friendly, with a glossy highlight.
    for (const s of [-1, 1]) {
      const eye = this._add(new THREE.Mesh(new THREE.SphereGeometry(0.020, 14, 12), new THREE.MeshPhysicalMaterial({ color: 0x2a1d16, roughness: 0.05, clearcoat: 1 })), head);
      eye.position.set(s * 0.042, -0.008, -0.093);
      eye.scale.set(1, 1.15, 0.6);
      const cheek = this._add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf7a6a0, roughness: 0.8 })), head);
      cheek.position.set(s * 0.058, -0.045, -0.083);
      cheek.scale.set(1, 0.7, 0.35);
    }

    // Hard hat: shell, brim, ventilation ridge, chin strap.
    const helmet = new THREE.Group();
    head.add(helmet);
    const shell = this._add(new THREE.Mesh(lathe([[0, 0.128], [0.048, 0.124], [0.090, 0.100], [0.117, 0.050], [0.128, -0.005], [0.130, -0.030], [0.124, -0.036], [0.121, -0.005], [0.110, 0.048], [0.084, 0.094], [0.044, 0.118], [0, 0.122]], 28), this.mHelmet), helmet);
    const brim = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.014, 28, 1, false, Math.PI * 0.62, Math.PI * 0.76), this.mHelmet), helmet);
    brim.position.set(0, -0.030, 0);
    brim.scale.set(1.42, 1, 1.42);
    // Front-to-back crown ridge with a moulded rib either side of it.
    const ridge = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.1265, 0.0105, 8, 26, Math.PI), this.mVis), helmet);
    ridge.rotation.set(0, Math.PI / 2, 0);
    for (const s of [-1, 1]) {
      const rib = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.121, 0.005, 6, 24, Math.PI * 0.8), this.mHelmet), helmet);
      rib.rotation.set(0, Math.PI / 2, 0);
      rib.position.set(s * 0.036, -0.004, 0);
      rib.scale.set(1, 0.94, 1);
    }
    const strap = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.006, 6, 22, Math.PI * 1.1), this.mWeb2), helmet);
    strap.position.set(0, -0.055, 0.005); strap.rotation.set(0.1, Math.PI / 2, Math.PI * 0.95);
    helmet.position.y = 0.020;

    // Goggles pushed up on the brim.
    const gog = new THREE.Group();
    const gband = this._add(new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.010, 8, 24), this.mVisDark), gog);
    gband.rotation.x = Math.PI / 2; gband.scale.set(1, 1, 0.7);
    const lens = this._add(new THREE.Mesh(new THREE.SphereGeometry(0.098, 20, 12, 0, Math.PI, Math.PI * 0.34, Math.PI * 0.32), this.mGlassLens), gog);
    lens.rotation.y = Math.PI / 2 + Math.PI;
    lens.scale.set(1.02, 0.72, 1.08);
    gog.position.set(0, 0.048, 0.0);
    gog.rotation.x = -0.35;
    head.add(gog);

    // Limbs. Capsules with joint spheres so elbows and knees keep volume.
    const mkLimb = (r1, l1, r2, l2, sleeveMat) => {
      const up = new THREE.Mesh(capsule(r1, l1), sleeveMat);
      up.userData.baseLen = l1 + r1 * 2;
      const fo = new THREE.Mesh(capsule(r2, l2), sleeveMat);
      fo.userData.baseLen = l2 + r2 * 2;
      up.castShadow = fo.castShadow = true;
      g.add(up, fo);
      return { up, fo };
    };
    this.arms = [];
    this.legs = [];
    for (const s of [-1, 1]) {
      const arm = mkLimb(0.037, 0.16, 0.031, 0.15, this.mVis);
      const cuff = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.0345, 0.024, 16), this.mReflect), g);
      const hand = new THREE.Group();
      const palm = this._add(new THREE.Mesh(beveledBox(0.052, 0.075, 0.040, 0.012, 3), this.mVisDark), hand);
      const thumb = this._add(new THREE.Mesh(capsule(0.014, 0.030), this.mVisDark), hand);
      thumb.position.set(0.030, 0.010, 0.012); thumb.rotation.z = -0.9;
      g.add(hand);
      const shoulderPad = this._add(new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 12), this.mVis), g);
      this.arms.push({ ...arm, hand, cuff, shoulderPad, side: s, elbow: V(), handPos: V() });

      const leg = mkLimb(0.048, 0.20, 0.040, 0.20, this.mVisDark);
      const boot = new THREE.Group();
      const bs = this._add(new THREE.Mesh(beveledBox(0.075, 0.085, 0.150, 0.016, 3), new THREE.MeshStandardMaterial({ color: 0x37312c, roughness: 0.55, metalness: 0.05 })), boot);
      const sole = this._add(new THREE.Mesh(beveledBox(0.082, 0.028, 0.165, 0.008), this.mRubber), boot);
      sole.position.set(0, -0.045, -0.006);
      g.add(boot);
      this.legs.push({ ...leg, boot, side: s, knee: V(), footPos: V() });
    }
  }

  // --- descender + connector ----------------------------------------------

  _buildDescender() {
    const g = new THREE.Group();
    this.descender = g;
    this.group.add(g);

    // Side plates: a real bobbin descender silhouette, chamfered all round.
    const plateShape = new THREE.Shape();
    plateShape.moveTo(-0.052, -0.052);
    plateShape.quadraticCurveTo(-0.070, 0.000, -0.048, 0.048);
    plateShape.quadraticCurveTo(-0.020, 0.082, 0.030, 0.072);
    plateShape.quadraticCurveTo(0.072, 0.060, 0.070, 0.010);
    plateShape.quadraticCurveTo(0.066, -0.040, 0.020, -0.062);
    plateShape.quadraticCurveTo(-0.020, -0.078, -0.052, -0.052);
    const hole = new THREE.Path(); hole.absarc(-0.036, -0.036, 0.017, 0, Math.PI * 2, true);
    plateShape.holes.push(hole);
    const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
      depth: 0.008, bevelEnabled: true, bevelSize: 0.0022, bevelThickness: 0.0022, bevelSegments: 2, curveSegments: 8,
    });
    for (const s of [-1, 1]) {
      const p = this._add(new THREE.Mesh(plateGeo, s > 0 ? this.mAnodRed : this.mAlu), g);
      p.position.z = s * 0.020;
      p.rotation.y = s > 0 ? 0 : Math.PI;
    }
    // Sheaves the rope actually wraps around.
    for (const [sx, sy, r] of [[-0.006, 0.036, 0.026], [0.034, -0.012, 0.024]]) {
      const sh = this._add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.030, 20), this.mSteel), g);
      sh.position.set(sx, sy, 0);
      sh.rotation.x = Math.PI / 2;
      const groove = this._add(new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.006, 8, 20), this.mSteel), g);
      groove.position.set(sx, sy, 0);
    }
    // Axles
    for (const [sx, sy] of [[-0.006, 0.036], [0.034, -0.012]]) {
      const ax = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.052, 10), this.mSteel), g);
      ax.position.set(sx, sy, 0); ax.rotation.x = Math.PI / 2;
    }
    // Control handle.
    const handle = new THREE.Group();
    const hg = this._add(new THREE.Mesh(mergeGeoms([
      xf(beveledBox(0.020, 0.088, 0.012, 0.003), { pos: [0, -0.044, 0] }),
      xf(beveledBox(0.020, 0.026, 0.012, 0.003), { pos: [0.020, -0.086, 0], rot: [0, 0, -0.7] }),
    ]), this.mAnodRed), handle);
    const grip = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.055, 12), this.mRubber), handle);
    grip.position.set(0.044, -0.106, 0); grip.rotation.z = -0.7;
    handle.position.set(-0.006, 0.036, 0.030);
    g.add(handle);
    this.descHandle = handle;

    // Screw-lock connector to the harness bridge.
    const car = new THREE.Group();
    const bodyShape = roundedRect(0.052, 0.108, 0.024);
    const inner = new THREE.Path();
    const ir = roundedRect(0.052 - 0.020, 0.108 - 0.020, 0.017);
    inner.curves = ir.curves; inner.autoClose = true;
    bodyShape.holes.push(inner);
    const carGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.010, bevelEnabled: true, bevelSize: 0.0028, bevelThickness: 0.0028, bevelSegments: 3, curveSegments: 8,
    });
    const carBody = this._add(new THREE.Mesh(carGeo, this.mAnodGold), car);
    carBody.rotation.y = Math.PI / 2;
    const gate = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.092, 10), this.mSteel), car);
    gate.position.set(0, 0.004, -0.020);
    const sleeve = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.030, 12), this.mAnodRed), car);
    sleeve.position.set(0, 0.010, -0.020);
    car.position.set(0, -0.088, 0);
    g.add(car);
    this.connector = car;

    // Backup device (rope grab) riding the second line at chest height.
    const grab = new THREE.Group();
    const gb = this._add(new THREE.Mesh(mergeGeoms([
      beveledBox(0.030, 0.070, 0.030, 0.004),
      xf(beveledBox(0.022, 0.030, 0.036, 0.003), { pos: [0.018, -0.026, 0] }),
    ]), this.mAlu), grab);
    const gcam = this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 12), this.mAnodRed), grab);
    gcam.rotation.x = Math.PI / 2; gcam.position.set(0.008, 0.010, 0);
    grab.position.set(-0.145, 0.315, -0.055);
    this.group.add(grab);
    this.ropeGrab = grab;
  }

  // --- tools ---------------------------------------------------------------

  _buildTools() {
    // Spray bottle: moulded body, trigger head, adjustable nozzle.
    const spray = new THREE.Group();
    const bottleMat = new THREE.MeshPhysicalMaterial({ color: 0x7fd4ea, roughness: 0.16, metalness: 0.0, transmission: 0.0, envMapIntensity: 1.3, clearcoat: 0.8, transparent: true, opacity: 0.92 });
    const body = this._add(new THREE.Mesh(lathe([[0, 0], [0.036, 0.002], [0.040, 0.012], [0.041, 0.130], [0.036, 0.150], [0.020, 0.160], [0.019, 0.176], [0, 0.178]], 22), bottleMat), spray);
    const liquid = this._add(new THREE.Mesh(lathe([[0, 0.006], [0.035, 0.008], [0.036, 0.100], [0, 0.100]], 20), new THREE.MeshPhysicalMaterial({ color: 0x3fb6dc, roughness: 0.05, envMapIntensity: 1.2 })), spray);
    const head = this._add(new THREE.Mesh(mergeGeoms([
      xf(beveledBox(0.036, 0.048, 0.036, 0.008, 3), { pos: [0, 0.200, 0] }),
      xf(beveledBox(0.030, 0.024, 0.072, 0.006, 3), { pos: [0, 0.212, -0.030] }),
      xf(new THREE.CylinderGeometry(0.020, 0.020, 0.026, 14), { pos: [0, 0.176, 0] }),
    ]), this.mVisDark), spray);
    const nozzle = this._add(new THREE.Mesh(lathe([[0, 0], [0.012, 0], [0.013, 0.014], [0.008, 0.020], [0.004, 0.020], [0, 0.018]], 14), new THREE.MeshStandardMaterial({ color: 0xf05a8c, roughness: 0.35, metalness: 0.1 })), spray);
    nozzle.rotation.x = -Math.PI / 2; nozzle.position.set(0, 0.212, -0.068);
    const trigger = this._add(new THREE.Mesh(beveledBox(0.014, 0.040, 0.014, 0.004), new THREE.MeshStandardMaterial({ color: 0xf05a8c, roughness: 0.35 })), spray);
    trigger.position.set(0, 0.180, -0.030); trigger.rotation.x = 0.25;
    this.sprayTrigger = trigger;
    spray.scale.setScalar(0.92);
    this.sprayTool = spray;
    this.scene.add(spray);
    this.sprayNozzleLocal = new THREE.Vector3(0, 0.212, -0.082);

    // Squeegee: aluminium channel, rubber blade, moulded handle.
    const sq = new THREE.Group();
    const CHANNEL = [
      [-0.011, 0.000], [0.011, 0.000], [0.013, -0.004], [0.013, -0.017],
      [0.008, -0.021], [0.008, -0.010], [-0.008, -0.010], [-0.008, -0.021], [-0.013, -0.017], [-0.013, -0.004],
    ];
    const chShape = new THREE.Shape();
    chShape.moveTo(CHANNEL[0][0], CHANNEL[0][1]);
    for (let i = 1; i < CHANNEL.length; i++) chShape.lineTo(CHANNEL[i][0], CHANNEL[i][1]);
    chShape.closePath();
    const chGeo = new THREE.ExtrudeGeometry(chShape, { depth: 0.34, bevelEnabled: false });
    chGeo.translate(0, 0, -0.17);
    chGeo.rotateY(Math.PI / 2);
    const channel = this._add(new THREE.Mesh(chGeo, this.mAlu), sq);
    const blade = this._add(new THREE.Mesh(beveledBox(0.345, 0.026, 0.0035, 0.0012), this.mRubber), sq);
    blade.position.set(0, -0.030, 0);
    this.blade = blade;
    for (const s of [-1, 1]) {
      const clip = this._add(new THREE.Mesh(beveledBox(0.012, 0.026, 0.014, 0.002), this.mSteel), sq);
      clip.position.set(s * 0.168, -0.014, 0);
    }
    const neck = this._add(new THREE.Mesh(mergeGeoms([
      xf(beveledBox(0.028, 0.034, 0.028, 0.005), { pos: [0, 0.020, 0] }),
      xf(new THREE.CylinderGeometry(0.010, 0.013, 0.080, 12), { pos: [0, 0.063, 0.014], rot: [0.32, 0, 0] }),
    ]), this.mAlu), sq);
    const grip = this._add(new THREE.Mesh(lathe([[0, 0], [0.018, 0.004], [0.021, 0.020], [0.017, 0.074], [0.020, 0.094], [0.016, 0.108], [0, 0.110]], 16), new THREE.MeshStandardMaterial({ color: 0xf3d84a, roughness: 0.45, metalness: 0.0 })), sq);
    grip.position.set(0, 0.098, 0.031); grip.rotation.x = 0.32;
    this.squeegeeTool = sq;
    this.scene.add(sq);
    this.squeegeeGripLocal = new THREE.Vector3(0, 0.152, 0.049);
  }

  // --- ropes ---------------------------------------------------------------

  _buildRopes() {
    this.workLine = new DynamicTube(30, 8, 0.0055, 22);
    this.workMesh = new THREE.Mesh(this.workLine.geom, this.mRope);
    this.workMesh.castShadow = true;
    this.workMesh.frustumCulled = false;
    this.scene.add(this.workMesh);

    this.backLine = new DynamicTube(24, 6, 0.0045, 22);
    this.backMesh = new THREE.Mesh(this.backLine.geom, this.mRope2);
    this.backMesh.castShadow = true;
    this.backMesh.frustumCulled = false;
    this.scene.add(this.backMesh);

    this.tailLine = new DynamicTube(22, 6, 0.0055, 22);
    this.tailMesh = new THREE.Mesh(this.tailLine.geom, this.mRope);
    this.tailMesh.frustumCulled = false;
    this.scene.add(this.tailMesh);

    this._wpts = Array.from({ length: 31 }, () => V());
    this._bpts = Array.from({ length: 25 }, () => V());
    this._tpts = Array.from({ length: 23 }, () => V());
  }

  // --- animation -----------------------------------------------------------

  /**
   * @param {object} s  { pos, anchor, lipA, lipB, speed, wind }
   */
  update(dt, s) {
    this.t += dt;
    const t = this.t;
    const hang = this.hang;

    // Pendulum: the whole rig swings a little under wind and player input.
    const sway = Math.sin(t * 0.9) * 0.012 + Math.sin(t * 1.7 + 1.3) * 0.006;
    const swing = this.lean * 0.30;
    this.group.position.copy(s.pos);
    this.group.position.x += swing;
    this.group.rotation.z = -swing * 0.28 + sway * hang;
    this.group.rotation.y = this.lean * 0.20;             // she already faces -Z
    this.group.rotation.x = (-0.05 - s.speed * 0.02) * hang;
    this.group.updateMatrixWorld(true);

    // Board and bridle.
    const boardY = -0.265 - 0.015 * Math.sin(t * 1.3);
    this.board.position.y = boardY;
    this.boardGroup.rotation.x = THREE.MathUtils.lerp(-1.15, 0.06, hang);
    const ringLocal = V(0, 0.055, 0.030);
    let bi = 0;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a = V(sx * 0.255, boardY + 0.03, sz * 0.075);
        seg(this.bridle[bi++], a, ringLocal);
      }
    }

    // Buckle tongues swing shut as the player taps them.
    for (let i = 0; i < 3; i++) {
      const b = this.buckleMeshes[i];
      const o = 1 - this.buckles[i];
      b.userData.tongue.position.x = 0.001 + o * 0.062;
      b.userData.tongue.rotation.y = o * 0.85;
      b.userData.tongue.rotation.z = o * -0.25;
    }

    // Pose. Standing on the roof vs seated in the harness.
    const pelvisY = THREE.MathUtils.lerp(-0.20, -0.12, hang);
    const pelvisZ = THREE.MathUtils.lerp(0.02, 0.16, hang);
    const lean = THREE.MathUtils.lerp(0.02, 0.24, hang);
    this.char.position.set(0, pelvisY, pelvisZ);
    this.torso.position.set(0, 0.245, -0.02);
    this.torso.rotation.x = lean;
    const headBob = Math.sin(t * 1.1) * 0.006 * hang;
    this.head.position.set(0, 0.545 + headBob, -0.050 - lean * 0.10);
    this.head.rotation.x = -lean * 0.5 + 0.06;
    this.head.rotation.y = this.lean * 0.25;
    this.pony.rotation.z = Math.sin(t * 1.6) * 0.12;
    this.boardGroup.position.z = 0.13 * hang;

    // Legs: braced flat on the facade when hanging, under her when standing.
    for (const L of this.legs) {
      const hip = V(L.side * 0.085, -0.02, 0.01);
      const standFoot = V(L.side * 0.10, -0.72, -0.02 + Math.sin(t * 0.7 + L.side) * 0.004);
      // Feet flat on the glass, thighs near horizontal, knees riding up:
      // the stance a rope tech actually works in.
      const hangFoot = V(L.side * 0.245, -0.10 + Math.sin(t * 0.8 + L.side) * 0.016, -0.375);
      const foot = standFoot.lerp(hangFoot, hang);
      ik(hip, foot, 0.296, 0.28,
        V(0, 0, -1).lerp(V(L.side * 0.30, 0.86, -0.22), hang).normalize(), L.knee);
      seg(L.up, hip, L.knee);
      seg(L.fo, L.knee, foot);
      L.footPos.copy(foot);
      L.boot.position.copy(foot).add(V(0, -0.015, -0.045 * (1 - hang) - 0.02 * hang));
      L.boot.rotation.set(THREE.MathUtils.lerp(0, 1.62, hang), 0, 0);
    }

    // --- tools, placed directly in world space ---------------------------
    const toChar = (w) => {
      const v = w.clone();
      this.group.worldToLocal(v);
      v.y -= pelvisY; v.z -= pelvisZ;
      return v;
    };
    const stow = (mesh, lp, e) => {
      mesh.position.set(lp[0], lp[1], lp[2]);
      this.group.localToWorld(mesh.position);
      mesh.quaternion.copy(this.group.quaternion).multiply(_q.setFromEuler(new THREE.Euler(e[0], e[1], e[2])));
      mesh.updateMatrixWorld();
    };
    let handL = null, handR = null;
    const sq = this.squeegeeTool, sp = this.sprayTool;
    sq.visible = this.tool === 'squeegee';
    if (sq.visible) {
      if (this.toolPoint) {
        sq.position.set(this.toolPoint.x, this.toolPoint.y, this.wallZ + 0.030);
        sq.rotation.set(Math.PI / 2 - 0.26, 0, this.bladeRoll);
      } else {
        sq.position.set(0.235, -0.095, 0.205);
        this.group.localToWorld(sq.position);
        sq.rotation.set(0.62, 0, -0.72);
      }
      sq.updateMatrixWorld();
      handR = sq.localToWorld(this.squeegeeGripLocal.clone());
    }
    if (this.tool === 'spray' && this.toolPoint) {
      sp.position.set(this.toolPoint.x - 0.06, this.toolPoint.y + 0.25, this.wallZ + 0.33);
      sp.rotation.set(-0.30, 0, 0.12);
      sp.updateMatrixWorld();
      handL = sp.localToWorld(V(0, 0.186, 0.030));
      this.sprayNozzleWorld = sp.localToWorld(this.sprayNozzleLocal.clone());
      this.sprayTrigger.rotation.x = 0.25 - 0.25;
    } else {
      stow(sp, [-0.205, -0.205, 0.155], [0.30, 0, 0.62]);
      this.sprayNozzleWorld = null;
      this.sprayTrigger.rotation.x = 0.25;
    }

    // Arms. The working hand goes wherever the player's finger went.
    for (const A of this.arms) {
      const shoulder = V(A.side * 0.126, 0.395, -0.03 - lean * 0.06);
      A.shoulderPad.position.copy(shoulder);
      const world = A.side > 0 ? handR : handL;
      let target;
      if (world) target = toChar(world);
      else if (hang > 0.5) target = V(A.side * 0.21, 0.16 + Math.sin(t * 1.2 + A.side) * 0.02, -0.24);
      else target = V(A.side * 0.19, 0.10, 0.03 + Math.sin(t * 1.1 + A.side) * 0.01);
      const d = target.clone().sub(shoulder);
      const maxR = 0.44;
      if (d.length() > maxR) { d.multiplyScalar(maxR / d.length()); target.copy(shoulder).add(d); }
      ik(shoulder, target, 0.234, 0.212, V(A.side * 0.7, -0.45, 0.55).normalize(), A.elbow);
      seg(A.up, shoulder, A.elbow);
      seg(A.fo, A.elbow, target);
      A.handPos.copy(target);
      A.hand.position.copy(target);
      _a.subVectors(target, A.elbow);
      if (_a.lengthSq() > 1e-8) A.hand.quaternion.setFromUnitVectors(UP, _a.normalize());
      A.cuff.position.copy(A.elbow).lerp(target, 0.80);
      A.cuff.quaternion.copy(A.fo.quaternion);
    }

    // Descender sits just above the attachment, connector below it.
    this.descender.position.set(0, 0.115 + (1 - this.descenderAttached) * 0.16, -0.055 - (1 - this.descenderAttached) * 0.10);
    this.descender.rotation.set(0, 0, (1 - this.descenderAttached) * 0.5);
    this.descHandle.rotation.z = -s.speed * 0.7;

    this._updateRopes(s);
  }

  _updateRopes(s) {
    const g = this.group;
    const dev = new THREE.Vector3(0, 0.14, -0.055);
    g.localToWorld(dev);
    const devOut = new THREE.Vector3(0, 0.06, -0.02);
    g.localToWorld(devOut);
    const anchor = s.anchor, lip = s.lip;
    const t = this.t;

    // Working line: anchor -> edge roller -> descender. Above the roller the
    // rope is slack and drifts; below it, it is loaded and nearly straight.
    const N = 30;
    const lipT = 0.28;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = this._wpts[i];
      if (u < lipT) {
        const k = u / lipT;
        p.lerpVectors(anchor, lip, k);
        p.y += Math.sin(k * Math.PI) * 0.10;
        p.z += Math.sin(k * Math.PI) * 0.05;
      } else {
        const k = (u - lipT) / (1 - lipT);
        p.lerpVectors(lip, dev, k);
        const amp = Math.sin(k * Math.PI) * (0.05 + s.wind * 0.09);
        p.x += Math.sin(t * 0.85 + k * 2.1) * amp;
        p.z += Math.sin(t * 0.62 + k * 1.4) * amp * 0.7 + Math.sin(k * Math.PI) * 0.03;
      }
    }
    this.workLine.update(this._wpts);

    // Backup line: separate anchor, runs to the rope grab on the chest.
    const grab = new THREE.Vector3(-0.145, 0.315, -0.055);
    g.localToWorld(grab);
    const bAnchor = anchor.clone().add(new THREE.Vector3(-0.55, -0.02, 0.02));
    const M = 24;
    for (let i = 0; i <= M; i++) {
      const u = i / M;
      const p = this._bpts[i];
      p.lerpVectors(bAnchor, grab, u);
      const amp = Math.sin(u * Math.PI) * (0.10 + s.wind * 0.16);
      p.x += Math.sin(t * 0.7 + u * 2.6) * amp;
      p.z += Math.sin(t * 0.5 + u * 1.9) * amp * 0.8 + Math.sin(u * Math.PI) * 0.05;
    }
    this.backLine.update(this._bpts);

    // Tail: the rest of the line hanging below, kicking in the wind.
    const K = 22;
    for (let i = 0; i <= K; i++) {
      const u = i / K;
      const p = this._tpts[i];
      p.copy(devOut);
      p.y -= u * 16;
      const amp = u * u * (0.25 + s.wind * 0.5);
      p.x += Math.sin(t * 0.9 + u * 3.4) * amp;
      p.z += Math.sin(t * 0.72 + u * 2.6) * amp + u * 0.25;
    }
    this.tailLine.update(this._tpts);
  }
}
