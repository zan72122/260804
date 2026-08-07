import * as THREE from 'three';
import { bronze, petalTex, softDisc, stone, woodPost } from '../core/textures.js';
import { clamp01, makeRandom } from '../core/util.js';

// ---------------------------------------------------------------------------
// 作業場の外、明るい庭に立つ大きな梵鐘と、それを吊る櫓（やぐら）。
// できあがったロープの、いちばん最後の仕事。
// ---------------------------------------------------------------------------

export const GANTRY_X = -10.2;
export const GROUND_Y = -0.36;
export const PULLEY = new THREE.Vector3(GANTRY_X, 4.32, 0);

function bellGeometry() {
  const outer = [
    [0.625, 0.0], [0.638, 0.055], [0.622, 0.115], [0.606, 0.30],
    [0.582, 0.56], [0.552, 0.86], [0.508, 1.13], [0.428, 1.33],
    [0.305, 1.46], [0.175, 1.53], [0.10, 1.56],
  ];
  const pts = outer.map(([r, y]) => new THREE.Vector2(r, y));
  // 内側をたどって戻る。厚みのある鋳物にする。
  for (let i = outer.length - 1; i >= 0; i--) {
    const [r, y] = outer[i];
    const t = i / (outer.length - 1);
    pts.push(new THREE.Vector2(Math.max(0.055, r - 0.055 - t * 0.02), y + (i === 0 ? 0.0 : 0.01)));
  }
  pts.push(new THREE.Vector2(0.625, 0.0));
  const g = new THREE.LatheGeometry(pts, 40);
  g.computeVertexNormals();
  return g;
}

export class Payload {
  constructor() {
    this.group = new THREE.Group();
    const rnd = makeRandom(404);

    const timber = new THREE.MeshStandardMaterial({ map: woodPost(41), roughness: 0.86 });
    const rock = new THREE.MeshStandardMaterial({ map: stone(), roughness: 0.98 });

    // 敷石
    const pave = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.14, 24), rock);
    pave.position.set(GANTRY_X, GROUND_Y + 0.07, 0);
    pave.receiveShadow = true;
    this.group.add(pave);

    // 櫓。四本の足が下で広がり、上で梁の下へ集まる。
    const legLen = 5.4;
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, legLen, 0.24), timber);
        // x 方向にだけ開く。z は開いたままにして、滑車の通り道を塞がない。
        leg.position.set(GANTRY_X + sx * 0.72, GROUND_Y + 2.47, sz * 1.05);
        leg.rotation.z = sx * 0.28;
        leg.castShadow = true;
        leg.receiveShadow = true;
        this.group.add(leg);
      }
      const brace = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 0.16), timber);
      brace.position.set(GANTRY_X, GROUND_Y + 1.55, sz * 0.98);
      brace.castShadow = true;
      brace.receiveShadow = true;
      this.group.add(brace);
    }
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.2), timber);
    tie.position.set(GANTRY_X, GROUND_Y + 1.55, 0);
    tie.castShadow = true;
    this.group.add(tie);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2.9), timber);
    beam.position.set(GANTRY_X, PULLEY.y + 0.32, 0);
    beam.castShadow = true;
    beam.receiveShadow = true;
    this.group.add(beam);

    // 滑車
    const iron = new THREE.MeshStandardMaterial({ color: 0x504a42, roughness: 0.5, metalness: 0.78 });
    const block = new THREE.Group();
    block.position.copy(PULLEY);
    for (const sgn of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.035), timber);
      cheek.position.set(0, 0.03, sgn * 0.075);
      cheek.castShadow = true;
      block.add(cheek);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 8, 22), iron);
    strap.rotation.y = Math.PI / 2;
    strap.position.y = 0.05;
    block.add(strap);
    this.sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.075, 22), iron);
    this.sheave.rotation.x = Math.PI / 2;
    this.sheave.rotation.z = Math.PI / 2;
    this.sheave.castShadow = true;
    block.add(this.sheave);
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), iron);
    hang.position.y = 0.26;
    block.add(hang);
    this.group.add(block);

    // 梵鐘
    this.bell = new THREE.Group();
    const bellMat = new THREE.MeshStandardMaterial({
      map: bronze(),
      color: 0xe8eddf,
      roughness: 0.36,
      metalness: 0.6,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bellGeometry(), bellMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.bell.add(body);

    // 帯と乳
    for (const y of [0.42, 0.86, 1.14]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.585 - (y - 0.42) * 0.09, 0.018, 8, 34), bellMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      this.bell.add(band);
    }
    const bossGeo = new THREE.SphereGeometry(0.031, 8, 6);
    const bosses = new THREE.InstancedMesh(bossGeo, bellMat, 64);
    const d = new THREE.Object3D();
    let n = 0;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const y = 0.94 + row * 0.052;
        const r = 0.545 - row * 0.012;
        d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        d.updateMatrix();
        bosses.setMatrixAt(n++, d.matrix);
      }
    }
    bosses.count = n;
    bosses.castShadow = true;
    this.bell.add(bosses);

    // 竜頭（吊り輪）
    for (const rot of [0, Math.PI / 2]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.026, 8, 22), bellMat);
      loop.position.y = 1.63;
      loop.rotation.y = rot;
      loop.castShadow = true;
      this.bell.add(loop);
    }
    this.crownY = 1.72;
    this.bell.position.set(GANTRY_X, GROUND_Y + 0.14, 0);
    this.group.add(this.bell);
    this.baseY = this.bell.position.y;
    this.lift = 0;

    // 花びらの吹き上がり
    this.petals = this._makeBurst(petalTex(), 200, 0.34);
    this.group.add(this.petals.points);
    this.dust = this._makeBurst(softDisc('rgba(226,206,168,1)'), 70, 0.38);
    this.group.add(this.dust.points);

    this.group.visible = false;
    this._rnd = rnd;
  }

  _makeBurst(map, count, size) {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.PointsMaterial({
      map,
      size,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
      opacity: 0,
      fog: true,
    });
    const points = new THREE.Points(g, m);
    points.frustumCulled = false;
    return { points, pos, vel, life, count, t: 0, active: false };
  }

  burst(system, origin, spread, up) {
    const { pos, vel, life, count } = system;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      pos[i * 3] = origin.x + Math.cos(a) * r;
      pos[i * 3 + 1] = origin.y + Math.random() * 0.3;
      pos[i * 3 + 2] = origin.z + Math.sin(a) * r;
      vel[i * 3] = Math.cos(a) * (0.5 + Math.random()) * 0.7;
      vel[i * 3 + 1] = up * (0.5 + Math.random());
      vel[i * 3 + 2] = Math.sin(a) * (0.5 + Math.random()) * 0.7;
      life[i] = 1;
    }
    system.active = true;
    system.t = 0;
    system.points.material.opacity = 1;
  }

  celebrate() {
    const o = new THREE.Vector3(GANTRY_X, GROUND_Y + 1.2, 0);
    this.burst(this.petals, o, 1.6, 3.1);
    this.burst(this.dust, new THREE.Vector3(GANTRY_X, GROUND_Y + 0.2, 0), 1.1, 0.7);
  }

  /** 0..1 で持ち上がる。1 のとき鐘の口が地面から離れる。 */
  setLift(t) {
    this.lift = clamp01(t);
    this.bell.position.y = this.baseY + this.lift * 1.35;
    this.bell.rotation.z = Math.sin(this.lift * 9) * 0.012 * (1 - this.lift * 0.6);
    this.sheave.rotation.y = -this.lift * 9;
  }

  crownWorld(out = new THREE.Vector3()) {
    return out.set(GANTRY_X, this.bell.position.y + this.crownY, 0);
  }

  update(dt) {
    for (const sys of [this.petals, this.dust]) {
      if (!sys.active) continue;
      sys.t += dt;
      const { pos, vel, count } = sys;
      for (let i = 0; i < count; i++) {
        vel[i * 3 + 1] -= dt * (sys === this.petals ? 0.9 : 1.6);
        vel[i * 3] *= 1 - dt * 0.8;
        vel[i * 3 + 2] *= 1 - dt * 0.8;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < GROUND_Y) {
          pos[i * 3 + 1] = GROUND_Y;
          vel[i * 3 + 1] = 0;
        }
      }
      sys.points.geometry.attributes.position.needsUpdate = true;
      sys.points.material.opacity = Math.max(0, 1 - sys.t / 6);
      if (sys.t > 6.2) sys.active = false;
    }
  }
}
