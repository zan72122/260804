/**
 * おさかな。掃除が終わったごほうびとして、水槽に帰ってくる。
 * 体は頂点シェーダでくねらせ、尾びれは同じ式を JS 側で再現して追従させる。
 */
import * as THREE from 'three';
import { TANK } from './config.js';
import { applyFishWave } from './shaders.js';
import { makeRandom, randRange, clamp, easeOutCubic, TAU } from '../core/util.js';

const PALETTES = [
  { body: 0xff8a3d, stripe: 0xfff6e8, accent: 0x2a2f3a },   // カクレクマノミ風
  { body: 0xffd23f, stripe: 0xffe98a, accent: 0x3a2f1a },   // きいろ
  { body: 0x4fb8ff, stripe: 0x9ee6ff, accent: 0x1a2f4a },   // あお
  { body: 0xff79b0, stripe: 0xffd6e8, accent: 0x4a1a35 },   // ももいろ
  { body: 0x8de08a, stripe: 0xd8ffd0, accent: 0x1f3a25 },   // みどり
  { body: 0xb38aff, stripe: 0xe0d0ff, accent: 0x2b1f4a },   // むらさき
];

/** 縞模様のテクスチャ。体の長さ方向に帯が入る。 */
function stripeTexture(body, stripe, count = 3) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = `#${new THREE.Color(body).getHexString()}`;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = `#${new THREE.Color(stripe).getHexString()}`;
  for (let i = 0; i < count; i++) {
    const x = 20 + i * (88 / count);
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 13, 0);
    g.lineTo(x + 7, 64);
    g.lineTo(x - 6, 64);
    g.closePath();
    g.fill();
  }
  // おなかを明るく
  const grad = g.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function finShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function bodyGeometry() {
  const geo = new THREE.SphereGeometry(0.5, 22, 16);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const u = clamp((v.x + 0.5), 0, 1);         // 0 = 尾、1 = 頭
    const r = Math.pow(Math.max(4 * u * (1 - u), 0.0001), 0.40) * (0.52 + 0.48 * u);
    v.y *= r * 1.02;
    v.z *= r * 0.68;
    v.x *= 1.7;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export class School {
  constructor(scene, shared, count = 11) {
    this.scene = scene;
    this.shared = shared;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    const rng = makeRandom(2468);
    const bodyGeo = bodyGeometry();
    const tailGeo = finShape([[0, 0], [-0.62, 0.46], [-0.42, 0], [-0.62, -0.46]]);
    const dorsalGeo = finShape([[0.30, 0], [0.12, 0.40], [-0.30, 0.34], [-0.34, 0]]);
    const analGeo = finShape([[0.16, 0], [0.02, -0.22], [-0.24, -0.18], [-0.28, 0]]);
    const pectGeo = finShape([[0, 0], [-0.26, 0.14], [-0.30, -0.10]]);

    this.fish = [];
    for (let i = 0; i < count; i++) {
      const pal = PALETTES[i % PALETTES.length];
      const tex = stripeTexture(pal.body, pal.stripe, 2 + Math.floor(rng() * 3));
      const phase = rng() * TAU;
      const amp = randRange(rng, 0.12, 0.2);
      const freq = randRange(rng, 3.4, 4.8);
      const speed = randRange(rng, 5.2, 7.4);

      const bodyMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.34,
        metalness: 0.12,
        emissive: new THREE.Color(pal.body).multiplyScalar(0.07),
      });
      applyFishWave(bodyMat, shared, { amp, freq, speed, phase });

      const finMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(pal.body).lerp(new THREE.Color(0xffffff), 0.35),
        roughness: 0.45,
        metalness: 0.05,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
      });

      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      g.add(body);

      const tail = new THREE.Mesh(tailGeo, finMat);
      tail.position.x = -0.84;
      g.add(tail);

      const dorsal = new THREE.Mesh(dorsalGeo, finMat);
      dorsal.position.set(0.05, 0.24, 0);
      g.add(dorsal);

      const anal = new THREE.Mesh(analGeo, finMat);
      anal.position.set(-0.25, -0.20, 0);
      g.add(anal);

      const pects = [];
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(pectGeo, finMat);
        p.position.set(0.34, -0.04, s * 0.16);
        p.rotation.y = s * 0.9;
        g.add(p);
        pects.push({ mesh: p, side: s });
      }

      // 目
      const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
      const eyeMat = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.2 });
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), eyeWhiteMat);
        w.position.set(0.60, 0.09, s * 0.135);
        g.add(w);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), eyeMat);
        p.position.set(0.645, 0.095, s * 0.165);
        g.add(p);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        shine.position.set(0.672, 0.12, s * 0.175);
        g.add(shine);
      }

      const scale = randRange(rng, 0.34, 0.62);
      g.scale.setScalar(scale);
      this.group.add(g);

      // 泳ぐ道すじ（リサージュ）。互いにぶつからないよう位相をずらす。
      this.fish.push({
        group: g, tail, pects,
        amp, freq, speed, phase,
        // 縦持ちでも半分以上が画面に残るよう、横の振れ幅は控えめに
        A: randRange(rng, 1.0, 3.4),
        B: randRange(rng, 0.5, 1.5),
        C: randRange(rng, 0.9, TANK.halfD - 1.1),
        a: randRange(rng, 0.16, 0.30),
        b: randRange(rng, 0.20, 0.42),
        c: randRange(rng, 0.13, 0.26),
        p1: rng() * TAU, p2: rng() * TAU, p3: rng() * TAU,
        yc: randRange(rng, 1.7, TANK.waterY - 1.8),
        t: rng() * 40,
        enter: 0,
        from: new THREE.Vector3(
          (rng() < 0.5 ? -1 : 1) * (TANK.halfW + randRange(rng, 1.5, 4)),
          randRange(rng, 2.0, 5.5),
          randRange(rng, -2, 2)
        ),
        delay: i * 0.28 + rng() * 0.25,
      });
    }

    this._p = new THREE.Vector3();
    this._pPrev = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._enterDir = new THREE.Vector3();
    this.active = false;
    this.elapsed = 0;
  }

  /** 掃除が終わったら呼ぶ。端から順にすいすい入ってくる。 */
  release() {
    this.active = true;
    this.elapsed = 0;
    this.group.visible = true;
  }

  reset() {
    this.active = false;
    this.elapsed = 0;
    this.group.visible = false;
    for (const f of this.fish) {
      f.group.position.copy(f.from);
      f.group.visible = false;
    }
  }

  _pathPoint(f, t, out) {
    out.set(
      Math.sin(t * f.a + f.p1) * f.A,
      f.yc + Math.sin(t * f.b + f.p2) * f.B,
      Math.sin(t * f.c + f.p3) * f.C
    );
    return out;
  }

  update(dt, time) {
    if (!this.active) return;
    this.elapsed += dt;
    for (const f of this.fish) {
      f.t += dt;
      this._pathPoint(f, f.t, this._p);
      this._pathPoint(f, f.t - 0.06, this._pPrev);

      const since = this.elapsed - f.delay;
      if (since < 0) {
        f.group.position.copy(f.from);
        f.group.visible = false;
        continue;
      }
      f.group.visible = true;
      const k = clamp(since / 2.6, 0, 1);
      const e = easeOutCubic(k);
      f.group.position.lerpVectors(f.from, this._p, e);

      // 進行方向を向く（尾を後ろに）
      this._look.copy(this._p).sub(this._pPrev);
      if (k < 1) {
        // 入場中は「入ってきた向き」と「泳ぐ向き」を混ぜる
        this._enterDir.copy(this._p).sub(f.from);
        if (this._enterDir.lengthSq() > 1e-6) this._enterDir.normalize();
        this._look.lerp(this._enterDir, 1 - e);
      }
      if (this._look.lengthSq() > 1e-6) {
        this._look.normalize().multiplyScalar(2).add(f.group.position);
        // 体の +x が前なので、lookAt(+z) との差を回転で補正する
        f.group.lookAt(this._look);
        f.group.rotateY(Math.PI / 2);
      }

      // 尾びれをシェーダと同じ式でくねらせる
      const tailX = -0.84;
      const mask = 1 - clamp((tailX + 0.75) / 1.0, 0, 1);
      f.tail.position.z = Math.sin(tailX * f.freq - time * f.speed + f.phase) * f.amp * mask;
      f.tail.rotation.y = Math.cos(tailX * f.freq - time * f.speed + f.phase) * 0.55;
      for (const p of f.pects) {
        p.mesh.rotation.z = Math.sin(time * f.speed * 0.6 + f.phase + (p.side > 0 ? 0 : 1.6)) * 0.35;
      }
    }
  }
}
