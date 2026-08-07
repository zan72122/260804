import * as THREE from 'three';
import { ROPE } from '../core/config.js';
import { polishedWood, woodPost } from '../core/textures.js';
import { clamp, lerp, smootherstep, wrapAngle } from '../core/util.js';

// ---------------------------------------------------------------------------
// 溝付きの木製トップ（こま）。
// 3本のストランドがそれぞれの溝に乗り、後ろで一本に閉じる。
// 形は「収束の断面」そのものから作る。だから前は3つに開き、後ろは点に近い。
// ---------------------------------------------------------------------------

const NU = 52; // 長さ方向
const NA = 64; // まわり

function buildBody() {
  const L = ROPE.topLength;
  const h = ROPE.closeLength * 0.5;
  const phases = [];
  for (let i = 0; i < ROPE.strands; i++) phases.push((i / ROPE.strands) * Math.PI * 2);

  // 断面のパラメータ。ds<0 が後ろ（綯い上がった側）。
  const sample = (t) => {
    let ds, rimScale;
    if (t <= 0.86) {
      ds = -L / 2 + (t / 0.86) * L;
      rimScale = 1;
    } else {
      const k = (t - 0.86) / 0.14;
      ds = L / 2 + k * 0.028;
      rimScale = 1 - 0.72 * smootherstep(0, 1, k);
    }
    const b = 1 - smootherstep(-h, h, ds);
    const Rc = lerp(ROPE.spread, ROPE.layRadius, b);
    const thick = lerp(ROPE.rTwisted, ROPE.rLaid, b);
    const base = Math.max(0.0028, (Rc - thick * 0.9) * rimScale);
    const depth = ROPE.topGrooveDepth * Math.pow(1 - b, 0.55) * rimScale;
    const gw = clamp(Math.asin(Math.min(0.985, thick / Math.max(Rc, 1e-4))) * 1.4, 0.14, 1.05);
    return { ds, b, Rc, thick, base, depth, gw };
  };

  // 溝のらせん。ロープ本体の撚りとぴったり合わせる。
  const omegaLay = (Math.PI * 2) / ROPE.layPitch;
  const twistOf = [];
  {
    const steps = 200;
    const prof = [];
    for (let k = 0; k <= steps; k++) {
      const ds = -L / 2 - 0.03 + (k / steps) * (L + 0.09);
      const b = 1 - smootherstep(-h, h, ds);
      prof.push({ ds, w: lerp(0.85, omegaLay, b) });
    }
    // ds = 0 を基準に前後へ積分する
    const zero = prof.findIndex((p) => p.ds >= 0);
    const acc = new Array(prof.length).fill(0);
    for (let k = zero + 1; k < prof.length; k++)
      acc[k] = acc[k - 1] + prof[k].w * (prof[k].ds - prof[k - 1].ds);
    for (let k = zero - 1; k >= 0; k--)
      acc[k] = acc[k + 1] - prof[k + 1].w * (prof[k + 1].ds - prof[k].ds);
    twistOf.push(...prof.map((p, k) => ({ ds: p.ds, th: acc[k] })));
  }
  const twistAt = (ds) => {
    let lo = 0, hi = twistOf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (twistOf[mid].ds < ds) lo = mid + 1;
      else hi = mid;
    }
    return twistOf[lo].th;
  };

  const pos = [];
  const col = [];
  const uv = [];
  const idx = [];
  const grease = new THREE.Color(0x33240f);
  const bare = new THREE.Color(0xffffff);
  const tmp = new THREE.Color();

  for (let iu = 0; iu <= NU; iu++) {
    const t = iu / NU;
    const p = sample(t);
    const tw = twistAt(p.ds);
    for (let ia = 0; ia <= NA; ia++) {
      const a = (ia / NA) * Math.PI * 2;
      let d = 0;
      for (const ph of phases) {
        const da = wrapAngle(a - (tw + ph));
        d = Math.max(d, Math.exp(-((da / p.gw) * (da / p.gw)) * 1.7));
      }
      const r = p.base - p.depth * d;
      pos.push(Math.cos(a) * r, Math.sin(a) * r, p.ds);
      uv.push(ia / NA, t * 1.6);
      // 溝の底には油と麻くずが溜まる
      tmp.copy(bare).lerp(grease, Math.min(0.9, d * 0.85));
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let iu = 0; iu < NU; iu++) {
    for (let ia = 0; ia < NA; ia++) {
      const a = iu * (NA + 1) + ia;
      const b = a + NA + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class RopeTop {
  constructor() {
    this.root = new THREE.Group();        // 場面に足すのはこれ
    this.group = new THREE.Group();       // ロープの枠に合わせて回す部分
    this.spinner = new THREE.Group();     // さらに撚りに合わせて回る部分
    this.group.add(this.spinner);
    this.root.add(this.group);

    const wood = polishedWood();
    wood.repeat.set(2, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: wood,
      vertexColors: true,
      roughness: 0.46,
      metalness: 0.02,
      color: 0xffffff,
    });

    const body = new THREE.Mesh(buildBody(), mat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.spinner.add(body);

    // 前へ突き出す心棒。ここを叉（やぐら）で受ける。
    const axleMat = new THREE.MeshStandardMaterial({ map: polishedWood(), roughness: 0.5 });
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.15, 12), axleMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.z = ROPE.topLength / 2 + 0.085;
    axle.castShadow = true;
    this.spinner.add(axle);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), axleMat);
    knob.position.z = ROPE.topLength / 2 + 0.162;
    knob.castShadow = true;
    this.spinner.add(knob);

    // 鉄の輪。木口が割れないように嵌めてある。
    const iron = new THREE.MeshStandardMaterial({ color: 0x4c4741, roughness: 0.55, metalness: 0.75 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0295, 0.0035, 8, 28), iron);
    band.position.z = ROPE.topLength / 2 + 0.024;
    this.spinner.add(band);

    // 作業者が握る叉。これは回らない。世界の「下」へ垂れる。
    const yoke = new THREE.Group();
    const yokeMat = new THREE.MeshStandardMaterial({ map: woodPost(12), roughness: 0.72 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.115, 0.026), yokeMat);
    arm.position.set(0, -0.058, 0);
    arm.castShadow = true;
    yoke.add(arm);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.21, 12), yokeMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(0, -0.118, 0);
    grip.castShadow = true;
    yoke.add(grip);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0055, 8, 20), yokeMat);
    collar.rotation.y = Math.PI / 2;
    collar.position.set(0, -0.004, 0);
    yoke.add(collar);
    this.root.add(yoke);
    this.yoke = yoke;
    this.yokeOffset = ROPE.topLength / 2 + 0.115;

    this.root.visible = false;
    this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
  }

  get visible() {
    return this.root.visible;
  }

  set visible(v) {
    this.root.visible = v;
  }

  /** ロープの枠に合わせて置く。frame は ropeSystem.sampleFrame の結果。 */
  place(frame, spin) {
    // 局所 z 軸をロープの進行方向（+s）へ、x を N、y を B へ向ける
    this._m.makeBasis(frame.n, frame.b, frame.t);
    this._q.setFromRotationMatrix(this._m);
    this.group.quaternion.copy(this._q);
    this.group.position.copy(frame.p);
    this.spinner.rotation.z = spin;
    // 叉は、心棒の先で受ける。姿勢は世界の上下に合わせたまま。
    this._v.copy(frame.t).multiplyScalar(this.yokeOffset).add(frame.p);
    this.yoke.position.copy(this._v);
    const yaw = Math.atan2(frame.t.x, frame.t.z);
    this.yoke.rotation.set(0, yaw, 0);
  }
}
