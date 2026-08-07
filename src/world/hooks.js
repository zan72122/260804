import * as THREE from 'three';
import { ROPE, WALK } from '../core/config.js';
import { hemp, polishedWood, woodPost } from '../core/textures.js';
import { makeRandom } from '../core/util.js';

// ---------------------------------------------------------------------------
// 遠方の回転フック（撚り車）と、近端の回転環、そして繊維束。
// ---------------------------------------------------------------------------

const ironMat = () =>
  new THREE.MeshStandardMaterial({ color: 0x565049, roughness: 0.48, metalness: 0.8 });

function hookGeometry() {
  // J 字の鉄鉤
  const path = new THREE.CurvePath();
  path.add(
    new THREE.LineCurve3(new THREE.Vector3(0, 0, 0.0), new THREE.Vector3(0, 0, -0.055))
  );
  const arc = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -0.055),
    new THREE.Vector3(0, -0.026, -0.086),
    new THREE.Vector3(0, -0.055, -0.062),
    new THREE.Vector3(0, -0.05, -0.024),
  ]);
  path.add(arc);
  return new THREE.TubeGeometry(path, 22, 0.0075, 7, false);
}

/** 繊維束。撚る前の、ぼさぼさした麻の束。 */
export class FiberBundle {
  constructor(seed = 1) {
    this.group = new THREE.Group();
    const rnd = makeRandom(seed * 31 + 7);
    const profile = [];
    const L = 0.52;
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const r = Math.sin(t * Math.PI) * 0.052 + 0.008 + (rnd() - 0.5) * 0.004;
      profile.push(new THREE.Vector2(r, (t - 0.5) * L));
    }
    const body = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 16),
      new THREE.MeshStandardMaterial({ map: hemp(1), roughness: 0.98 })
    );
    body.rotation.z = Math.PI / 2; // 長さを x 方向へ
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // 真ん中の結わえ紐
    const tie = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.006, 6, 18),
      new THREE.MeshStandardMaterial({ map: hemp(0.5), roughness: 1 })
    );
    tie.rotation.y = Math.PI / 2;
    this.group.add(tie);

    // 端のけば
    const hairs = 90;
    const pos = new Float32Array(hairs * 6);
    const col = new Float32Array(hairs * 6);
    for (let i = 0; i < hairs; i++) {
      const side = i % 2 ? 1 : -1;
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.03;
      const x0 = side * L * 0.5;
      const y0 = Math.cos(a) * r;
      const z0 = Math.sin(a) * r;
      const len = 0.02 + rnd() * 0.07;
      const o = i * 6;
      pos[o] = x0; pos[o + 1] = y0; pos[o + 2] = z0;
      pos[o + 3] = x0 + side * len;
      pos[o + 4] = y0 + (rnd() - 0.5) * 0.03 - 0.01;
      pos[o + 5] = z0 + (rnd() - 0.5) * 0.03;
      const b = 0.6 + rnd() * 0.4;
      col[o] = 0.85 * b; col[o + 1] = 0.72 * b; col[o + 2] = 0.45 * b;
      col[o + 3] = 1.0 * b; col[o + 4] = 0.92 * b; col[o + 5] = 0.68 * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.group.add(
      new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })
      )
    );
  }
}

/** 遠方の撚り車。3つのフックが同じ向きに回る。 */
export class Jack {
  constructor(x) {
    this.x = x;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, 0);

    const wood = new THREE.MeshStandardMaterial({ map: woodPost(5), roughness: 0.84 });
    const iron = ironMat();

    // 太い枠。ここに撚りの力が全部かかる。
    for (const sgn of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.19, 1.95, 0.19), wood);
      p.position.set(0, 0.975, sgn * 0.62);
      p.castShadow = true;
      p.receiveShadow = true;
      this.group.add(p);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.32), wood);
      foot.position.set(0, 0.07, sgn * 0.62);
      foot.castShadow = true;
      this.group.add(foot);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 1.6), wood);
    head.position.set(0, 2.0, 0);
    head.castShadow = true;
    this.group.add(head);

    // 軸受け
    const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.3), wood);
    bearing.position.set(0.12, WALK.y, 0);
    bearing.castShadow = true;
    this.group.add(bearing);
    for (const sgn of [-1, 1]) {
      const stay = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), wood);
      stay.position.set(0.12, WALK.y / 2 + 0.2, sgn * 0.2);
      stay.rotation.x = sgn * 0.18;
      this.group.add(stay);
    }

    // 回る部分
    this.plate = new THREE.Group();
    this.plate.position.set(-0.02, WALK.y, 0);
    this.group.add(this.plate);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.055, 26), wood);
    disc.rotation.z = Math.PI / 2;
    disc.castShadow = true;
    this.plate.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.014, 8, 30), iron);
    rim.rotation.y = Math.PI / 2;
    this.plate.add(rim);

    // フック。ロープ側の位相と揃える。
    this.hooks = [];
    this.stubs = [];
    const hg = hookGeometry();
    const bundleMat = new THREE.MeshStandardMaterial({ map: hemp(1), roughness: 0.98 });
    for (let i = 0; i < ROPE.strands; i++) {
      const a = (i / ROPE.strands) * Math.PI * 2;
      const node = new THREE.Group();
      // ロープ系の枠では N=(0,1,0)、B=(0,0,1) なので、角度 a は y-z 平面
      node.position.set(-0.03, Math.cos(a) * ROPE.hookRing, Math.sin(a) * ROPE.hookRing);
      const h = new THREE.Mesh(hg, iron);
      h.rotation.y = -Math.PI / 2; // 鉤の向きを -x 側へ
      h.castShadow = true;
      node.add(h);
      // 掛かった麻の根元
      const stub = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.1, 3, 8), bundleMat);
      stub.rotation.z = Math.PI / 2;
      stub.position.set(-0.09, -0.012, 0);
      stub.castShadow = true;
      stub.visible = false;
      node.add(stub);
      this.stubs.push(stub);
      this.plate.add(node);
      this.hooks.push(node);
    }

    // 回し車。人が回すのはここ。
    this.wheel = new THREE.Group();
    this.wheel.position.set(0.34, WALK.y, 0);
    this.group.add(this.wheel);
    const felloe = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 34), wood);
    felloe.rotation.y = Math.PI / 2;
    felloe.castShadow = true;
    this.wheel.add(felloe);
    const nave = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.13, 14), wood);
    nave.rotation.z = Math.PI / 2;
    this.wheel.add(nave);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.8, 0.035), wood);
      sp.rotation.x = a;
      sp.castShadow = true;
      this.wheel.add(sp);
    }
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.15, 10),
      new THREE.MeshStandardMaterial({ map: polishedWood(), roughness: 0.4 })
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.1, 0.33, 0);
    handle.castShadow = true;
    this.wheel.add(handle);
    this.handle = handle;

    // 軸
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10), iron);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(0.16, WALK.y, 0);
    this.group.add(shaft);
  }

  attach(i) {
    if (this.stubs[i]) this.stubs[i].visible = true;
  }

  hookWorld(i, out = new THREE.Vector3()) {
    return this.hooks[i].getWorldPosition(out);
  }

  setSpin(theta) {
    this.plate.rotation.x = theta;
    this.wheel.rotation.x = theta * 0.55;
  }
}

/** 近端。撚り合わさった一本が出てくる側の回転環。 */
export class NearPost {
  constructor(x) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, 0);
    const wood = new THREE.MeshStandardMaterial({ map: woodPost(17), roughness: 0.85 });
    const iron = ironMat();

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.7, 0.22), wood);
    post.position.y = 0.85;
    post.castShadow = true;
    post.receiveShadow = true;
    this.group.add(post);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.6), wood);
    foot.position.y = 0.08;
    foot.castShadow = true;
    this.group.add(foot);
    for (const sgn of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood);
      brace.position.set(0, 0.45, sgn * 0.25);
      brace.rotation.x = sgn * 0.5;
      brace.castShadow = true;
      this.group.add(brace);
    }
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20), iron);
    eye.rotation.y = Math.PI / 2;
    eye.position.set(0.12, WALK.y, 0);
    eye.castShadow = true;
    this.group.add(eye);
    this.swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.12, 10), iron);
    this.swivel.rotation.z = Math.PI / 2;
    this.swivel.position.set(0.06, WALK.y, 0);
    this.group.add(this.swivel);
  }
}

/**
 * 引き出し台。ストランドの手前側の端をまとめて掴み、
 * 作業場を近端まで引いてくる小さな橇。
 */
export class Traveller {
  constructor() {
    this.group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: woodPost(23), roughness: 0.8 });
    const iron = ironMat();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.3), wood);
    body.position.y = 0.08;
    body.castShadow = true;
    this.group.add(body);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.09, WALK.y - 0.02, 0.09), wood);
    mast.position.y = (WALK.y - 0.02) / 2 + 0.14;
    mast.castShadow = true;
    this.group.add(mast);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 8, 18), iron);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.06, WALK.y, 0);
    this.group.add(ring);
    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 10), wood);
    handleBar.rotation.x = Math.PI / 2;
    handleBar.position.set(-0.19, WALK.y - 0.18, 0);
    handleBar.castShadow = true;
    this.group.add(handleBar);
    this.group.visible = false;
  }
}
