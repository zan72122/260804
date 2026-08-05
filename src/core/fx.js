// 木くず・粉じん・きらめき・波紋・ガイド矢印などの演出。
import * as THREE from 'three';
import { makeSoftCircleTexture, makeDashTexture } from './materials.js';
import { rand, clamp, tween, easeOutCubic, damp } from './util.js';

/* ---------------- 細かい粉（点） ---------------- */
const POINT_VS = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main(){
  vAlpha = aAlpha; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (260.0 / max(0.001, -mv.z));
}`;
const POINT_FS = `
uniform sampler2D uTex;
varying float vAlpha;
varying vec3 vColor;
void main(){
  vec4 t = texture2D(uTex, gl_PointCoord);
  float a = t.a * vAlpha;
  if(a < 0.02) discard;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}`;

export class DustField {
  constructor(scene, count = 260) {
    this.count = count;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.col = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.grav = new Float32Array(count);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeSoftCircleTexture() } },
      vertexShader: POINT_VS,
      fragmentShader: POINT_FS,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.cursor = 0;
    for (let i = 0; i < count; i++) this.alpha[i] = 0;
  }
  spawn(p, opts = {}) {
    const n = opts.count ?? 6;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const i3 = i * 3;
      this.pos[i3] = p.x + rand(-0.01, 0.01);
      this.pos[i3 + 1] = p.y + rand(-0.008, 0.012);
      this.pos[i3 + 2] = p.z + rand(-0.01, 0.01);
      const sp = opts.speed ?? 0.5;
      const dir = opts.dir;
      this.vel[i3] = (dir ? dir.x * sp : 0) + rand(-sp, sp) * 0.6;
      this.vel[i3 + 1] = (dir ? dir.y * sp : 0) + rand(0.05, sp);
      this.vel[i3 + 2] = (dir ? dir.z * sp : 0) + rand(-sp, sp) * 0.6;
      this.size[i] = opts.size ? opts.size * rand(0.6, 1.4) : rand(0.012, 0.03);
      const c = opts.color || new THREE.Color('#e8c98f');
      this.col[i3] = c.r * rand(0.85, 1.1);
      this.col[i3 + 1] = c.g * rand(0.85, 1.1);
      this.col[i3 + 2] = c.b * rand(0.85, 1.1);
      this.maxLife[i] = opts.life ?? rand(0.5, 1.1);
      this.life[i] = this.maxLife[i];
      this.alpha[i] = 1;
      this.grav[i] = opts.gravity ?? 1.6;
    }
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; any = true; } continue; }
      any = true;
      const i3 = i * 3;
      this.life[i] -= dt;
      this.vel[i3 + 1] -= this.grav[i] * dt;
      this.vel[i3] *= 0.97; this.vel[i3 + 2] *= 0.97;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = clamp(this.life[i] / this.maxLife[i], 0, 1);
      this.alpha[i] = t * t;
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
    }
  }
}

/* ---------------- 木くず（立体・転がる） ---------------- */
export class ChipField {
  constructor(scene, count = 90) {
    this.count = count;
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0, 0);
    const m = new THREE.MeshStandardMaterial({ color: '#c99a5e', roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(g, m, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = count;
    scene.add(this.mesh);
    this.items = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      this.items.push({
        p: new THREE.Vector3(0, -99, 0),
        v: new THREE.Vector3(),
        r: new THREE.Euler(),
        rv: new THREE.Vector3(),
        s: new THREE.Vector3(0.02, 0.006, 0.012),
        life: 0, rest: false, floor: 0,
      });
      dummy.position.set(0, -99, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this._dummy = dummy;
    this.cursor = 0;
    this.color = new THREE.Color('#e6c68e');
  }
  setColor(c) { this.mesh.material.color.copy(c); }
  spawn(p, opts = {}) {
    const n = opts.count ?? 2;
    for (let k = 0; k < n; k++) {
      const it = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.count;
      it.p.copy(p).add(new THREE.Vector3(rand(-0.012, 0.012), rand(0, 0.015), rand(-0.012, 0.012)));
      const sp = opts.speed ?? 0.6;
      it.v.set(rand(-sp, sp), rand(0.25, 0.9) * (opts.up ?? 1), rand(-sp, sp));
      if (opts.dir) it.v.addScaledVector(opts.dir, sp * 0.8);
      it.rv.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
      it.r.set(rand(0, 6), rand(0, 6), rand(0, 6));
      const sc = opts.scale ?? 1;
      it.s.set(rand(0.014, 0.03) * sc, rand(0.003, 0.007) * sc, rand(0.008, 0.02) * sc);
      it.life = opts.life ?? rand(6, 12);
      it.rest = false;
      it.floor = opts.floor ?? 0;
    }
  }
  update(dt) {
    const d = this._dummy;
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (it.life <= 0) continue;
      it.life -= dt;
      if (!it.rest) {
        it.v.y -= 3.2 * dt;
        it.p.addScaledVector(it.v, dt);
        it.r.x += it.rv.x * dt; it.r.y += it.rv.y * dt; it.r.z += it.rv.z * dt;
        if (it.p.y <= it.floor + it.s.y) {
          it.p.y = it.floor + it.s.y;
          it.v.y *= -0.28;
          it.v.x *= 0.6; it.v.z *= 0.6;
          it.rv.multiplyScalar(0.5);
          if (Math.abs(it.v.y) < 0.12) { it.rest = true; it.r.x = 0; it.r.z = 0; }
        }
      }
      const fade = clamp(it.life / 1.2, 0, 1);
      d.position.copy(it.p);
      d.rotation.copy(it.r);
      d.scale.copy(it.s).multiplyScalar(fade);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      if (it.life <= 0) {
        d.position.set(0, -99, 0); d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() {
    for (const it of this.items) it.life = 0;
    const d = this._dummy;
    d.position.set(0, -99, 0); d.scale.set(0.001, 0.001, 0.001); d.updateMatrix();
    for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, d.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- 波紋・きらめき ---------------- */
export class Rings {
  constructor(scene, count = 10) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.42, 0.5, 40);
    for (let i = 0; i < count; i++) {
      const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(geo, m);
      mesh.visible = false;
      mesh.renderOrder = 8;
      scene.add(mesh);
      this.items.push({ mesh, t: 0, dur: 1, scale: 1, color: null });
    }
    this.cursor = 0;
  }
  pop(pos, { size = 0.3, color = '#ffd76e', dur = 0.6, normal = null } = {}) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    it.mesh.position.copy(pos);
    it.mesh.visible = true;
    it.mesh.material.color.set(color);
    if (normal) {
      it.mesh.lookAt(pos.clone().add(normal));
    } else {
      it.mesh.rotation.set(-Math.PI / 2, 0, 0);
    }
    it.t = 0; it.dur = dur; it.scale = size;
    return it;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.t += dt;
      const k = clamp(it.t / it.dur, 0, 1);
      const s = it.scale * (0.35 + easeOutCubic(k) * 1.5);
      it.mesh.scale.set(s, s, s);
      it.mesh.material.opacity = (1 - k) * 0.85;
      if (k >= 1) it.mesh.visible = false;
    }
  }
}

/* ---------------- 「ここ！」の吹き出し ---------------- */
export function makeLabelSprite(text, { bg = '#ffffff', fg = '#e0553c', size = 256 } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size / 2;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = bg;
  g.strokeStyle = fg;
  g.lineWidth = 8;
  const r = 34;
  g.beginPath();
  g.roundRect(8, 8, c.width - 16, c.height - 34, r);
  g.fill(); g.stroke();
  g.beginPath();
  g.moveTo(c.width / 2 - 20, c.height - 26);
  g.lineTo(c.width / 2, c.height - 4);
  g.lineTo(c.width / 2 + 20, c.height - 26);
  g.closePath();
  g.fillStyle = bg; g.fill();
  g.strokeStyle = fg; g.stroke();
  g.fillStyle = fg;
  g.font = `bold ${size * 0.28}px "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 - 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(0.34, 0.17, 1);
  sp.renderOrder = 20;
  return sp;
}

/* ---------------- 操作を促す矢印（点線の道） ---------------- */
export class GuideArrows {
  constructor(scene, count = 7) {
    this.group = new THREE.Group();
    this.group.renderOrder = 10;
    scene.add(this.group);
    const tex = makeChevronTexture();
    this.sprites = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, toneMapped: false, color: '#ffffff' });
      const s = new THREE.Sprite(m);
      s.scale.set(0.05, 0.05, 1);
      this.group.add(s);
      this.sprites.push(s);
    }
    this.visible = false;
    this.t = 0;
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
    this.pingPong = false;
    this.group.visible = false;
  }
  show(a, b, { pingPong = false, color = '#ff8f5e' } = {}) {
    this.a.copy(a); this.b.copy(b);
    this.pingPong = pingPong;
    this.visible = true;
    this.group.visible = true;
    this.sprites.forEach((s) => s.material.color.set(color));
    this.t = 0;
  }
  hide() { this.visible = false; this.group.visible = false; }
  update(dt) {
    if (!this.visible) return;
    this.t += dt * 0.65;
    const n = this.sprites.length;
    for (let i = 0; i < n; i++) {
      let k = (this.t + i / n) % 1;
      let kk = k;
      if (this.pingPong) {
        const c = (this.t * 0.7 + i / n) % 2;
        kk = c < 1 ? c : 2 - c;
      }
      const s = this.sprites[i];
      s.position.lerpVectors(this.a, this.b, kk);
      s.position.y += 0.035 + Math.sin(k * Math.PI) * 0.01;
      const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
      s.material.opacity = 0.15 + fade * 0.75;
      const sc = 0.035 + fade * 0.028;
      s.scale.set(sc, sc, 1);
    }
  }
}

function makeChevronTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.34, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- 接地影（柔らかい丸） ---------------- */
export function makeContactShadow(size = 0.5, opacity = 0.5) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: makeSoftCircleTexture('rgba(60,38,18,0.75)', 'rgba(60,38,18,0)'),
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(size, size, 1);
  m.renderOrder = 1;
  return m;
}

/* ---------------- キラキラ（完成の合図） ---------------- */
export class Sparkles {
  constructor(scene, count = 60) {
    this.field = new DustField(scene, count);
  }
  burst(center, { radius = 0.3, count = 26, color = '#fff2b0' } = {}) {
    for (let i = 0; i < count; i++) {
      const p = center.clone().add(new THREE.Vector3(rand(-radius, radius), rand(-radius * 0.4, radius), rand(-radius, radius)));
      this.field.spawn(p, { count: 1, speed: 0.3, size: 0.05, life: rand(0.6, 1.2), color: new THREE.Color(color), gravity: -0.25 });
    }
  }
  update(dt) { this.field.update(dt); }
}
