/* =========================================================
   particles.js — 3D空間の粒子（蒸気・打ち粉・パン屑・火の粉）
   ビルボードの点群。1粒ずつ大きさ・不透明度・色を持たせるため
   自前のシェーダを使う。
   ========================================================= */
import * as THREE from 'three';

const MAX = 900;

function softSprite() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0.00, 'rgba(255,255,255,1)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0.62)');
  rg.addColorStop(0.72, 'rgba(255,255,255,0.16)');
  rg.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Particles3D {
  constructor(scene) {
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    const siz = new Float32Array(MAX);
    const alp = new Float32Array(MAX);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, -1), 12);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: softSprite() }, uPixelRatio: { value: 1 } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * 1200.0 / max(0.05, -mv.z);
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    this.geo = geo;
    this.list = [];
  }

  _push(p) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push(p);
  }

  /* 蒸気：大きく、ゆっくり広がり、上昇する */
  steam(x, y, z, n = 1, scale = 1, power = 1) {
    for (let i = 0; i < n; i++) {
      this._push({
        k: 's',
        x: x + rr(-0.05, 0.05) * scale, y: y + rr(-0.02, 0.03) * scale, z: z + rr(-0.05, 0.05) * scale,
        vx: rr(-0.09, 0.09) * power, vy: rr(0.16, 0.42) * power, vz: rr(-0.07, 0.07) * power,
        size: rr(0.05, 0.11) * scale, grow: rr(0.10, 0.24) * scale,
        life: 0, max: rr(1.3, 2.6),
        a: rr(0.24, 0.5),
        c: [0.98, 0.97, 0.95],
      });
    }
  }

  /* 打ち粉 */
  flour(x, y, z, n = 1, scale = 1) {
    for (let i = 0; i < n; i++) {
      this._push({
        k: 'f',
        x: x + rr(-0.03, 0.03), y: y + rr(-0.01, 0.02), z: z + rr(-0.03, 0.03),
        vx: rr(-0.22, 0.22) * scale, vy: rr(0.10, 0.45) * scale, vz: rr(-0.22, 0.22) * scale,
        size: rr(0.006, 0.020) * scale, grow: rr(0.004, 0.014),
        life: 0, max: rr(0.7, 1.5), a: rr(0.35, 0.8),
        c: [1.0, 0.99, 0.96], g: -0.55,
      });
    }
  }

  /* パン屑 */
  crumb(x, y, z, n = 1) {
    for (let i = 0; i < n; i++) {
      this._push({
        k: 'c',
        x, y, z,
        vx: rr(-0.5, 0.5), vy: rr(0.3, 0.9), vz: rr(-0.5, 0.5),
        size: rr(0.0025, 0.006), grow: 0,
        life: 0, max: rr(0.6, 1.1), a: 1,
        c: [0.80, 0.62, 0.36], g: -2.6,
      });
    }
  }

  /* 火の粉／きらめき */
  spark(x, y, z, n = 1, warm = 1) {
    for (let i = 0; i < n; i++) {
      this._push({
        k: 'k',
        x: x + rr(-0.02, 0.02), y: y + rr(-0.01, 0.02), z: z + rr(-0.02, 0.02),
        vx: rr(-0.2, 0.2), vy: rr(0.25, 0.75), vz: rr(-0.2, 0.2),
        size: rr(0.004, 0.011), grow: 0,
        life: 0, max: rr(0.5, 1.0), a: 1,
        c: warm ? [1.0, 0.72, 0.30] : [1.0, 0.95, 0.75], g: -0.5,
      });
    }
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life += dt;
      if (p.life >= p.max) { l.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.k === 's') {
        p.vy += 0.16 * dt; p.vx *= 0.985; p.vz *= 0.985;
        p.size += p.grow * dt;
      } else {
        p.vy += (p.g || -1.0) * dt;
        p.size += (p.grow || 0) * dt;
      }
    }

    const n = Math.min(l.length, MAX);
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.aColor.array;
    const siz = this.geo.attributes.aSize.array;
    const alp = this.geo.attributes.aAlpha.array;
    for (let i = 0; i < n; i++) {
      const p = l[i];
      const t = p.life / p.max;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      col[i * 3] = p.c[0]; col[i * 3 + 1] = p.c[1]; col[i * 3 + 2] = p.c[2];
      siz[i] = p.size;
      alp[i] = p.k === 's'
        ? p.a * Math.sin(Math.min(1, t * 1.25) * Math.PI) * 0.95
        : p.a * (1 - t);
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  clear() { this.list.length = 0; this.geo.setDrawRange(0, 0); }
}

function rr(a, b) { return a + Math.random() * (b - a); }
