// Water systems: stateless GPU ballistic particle jets (position derived in the
// vertex shader from seed + time, so thousands of droplets cost no CPU),
// expanding surface rings, mist, and hose bubbles.
import * as THREE from 'three';
import { dotSprite, ringSprite } from './textures.js';

const SPRITE = { map: null };
function sprite() { if (!SPRITE.map) SPRITE.map = dotSprite(); return SPRITE.map; }

// Shared perspective scale: drawingBufferHeight / (2 * tan(fov/2)).
// Set from main on init/resize so point sprites have a real-world size.
export const JET_SCALE = { value: 700 };

const VERT = /* glsl */`
uniform float uTime;
uniform float uLife;
uniform float uSpeed;
uniform vec3  uDir;
uniform float uSpread;
uniform float uGravity;
uniform float uSize;
uniform float uScale;
uniform float uOn;      // 0..1 fraction of particles active
uniform float uFloor;   // world y where droplets die
uniform float uMirror;  // 1 => reflect through uFloor plane
attribute vec4 aSeed;
varying float vFade;
varying float vT;
void main(){
  float phase = aSeed.x;
  float t = fract(uTime / uLife + phase);
  float age = t * uLife;
  float act = step(aSeed.y, uOn);
  vec3 dir = normalize(uDir);
  vec3 o1 = normalize(abs(dir.y) < 0.99 ? cross(dir, vec3(0.0,1.0,0.0)) : vec3(1.0,0.0,0.0));
  vec3 o2 = cross(dir, o1);
  float ang = aSeed.z * 6.2831853;
  float rad = pow(aSeed.w, 1.5) * uSpread;
  vec3 v0 = normalize(dir + o1*cos(ang)*rad + o2*sin(ang)*rad) * uSpeed * (0.82 + 0.36*aSeed.y);
  vec3 pos = position + v0 * age + vec3(0.0, -0.5*uGravity*age*age, 0.0);
  float alive = step(uFloor - 0.02, pos.y);
  pos.y = max(pos.y, uFloor);
  if (uMirror > 0.5) pos.y = 2.0*uFloor - pos.y;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float grow = 1.0 + t * 1.8;
  // uSize is droplet diameter in meters; uScale converts to pixels
  gl_PointSize = clamp(uSize * grow * (uScale / max(0.5, -mv.z)), 1.0, 64.0);
  vFade = act * alive * (1.0 - t*t) * smoothstep(0.0, 0.04, t);
  vT = t;
}
`;

const FRAG = /* glsl */`
uniform sampler2D uMap;
uniform vec3 uColor;
uniform vec3 uTipColor;
uniform float uOpacity;
varying float vFade;
varying float vT;
void main(){
  vec4 s = texture2D(uMap, gl_PointCoord);
  vec3 col = mix(uColor, uTipColor, vT);
  gl_FragColor = vec4(col, s.a * vFade * uOpacity);
  if (gl_FragColor.a < 0.003) discard;
}
`;

export class Jet {
  // origin: Vector3 | Vector3[] (ring/line emitters pass many origins)
  constructor({
    count = 900, life = 1.4, speed = 8, dir = new THREE.Vector3(0, 1, 0),
    spread = 0.06, gravity = 9.8, size = 9, color = 0xbfe6ff, tip = 0xffffff,
    floor = 0, origin = new THREE.Vector3(), opacity = 1, mirror = false, mirrorOpacity = 0.35,
  }) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const origins = Array.isArray(origin) ? origin : [origin];
    for (let i = 0; i < count; i++) {
      const o = origins[i % origins.length];
      pos[i * 3] = o.x; pos[i * 3 + 1] = o.y; pos[i * 3 + 2] = o.z;
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.geo = geo;
    this.uniforms = {
      uTime: { value: 0 }, uLife: { value: life }, uSpeed: { value: speed },
      uDir: { value: dir.clone().normalize() }, uSpread: { value: spread },
      uGravity: { value: gravity }, uSize: { value: size * 0.012 }, uOn: { value: 0 },
      uScale: JET_SCALE,
      uFloor: { value: floor }, uMirror: { value: 0 },
      uMap: { value: sprite() }, uColor: { value: new THREE.Color(color) },
      uTipColor: { value: new THREE.Color(tip) }, uOpacity: { value: opacity },
    };
    this.points = new THREE.Points(geo, this.mat(0));
    this.points.frustumCulled = false;
    this.points.renderOrder = 3; // after the translucent pool surface
    this.group = new THREE.Group();
    this.group.add(this.points);
    if (mirror) {
      this.mirrorMat = this.mat(1);
      this.mirrorMat.uniforms.uOpacity = { value: opacity * mirrorOpacity };
      this.mirror = new THREE.Points(geo, this.mirrorMat);
      this.mirror.frustumCulled = false;
      this.mirror.renderOrder = 2;
      this.group.add(this.mirror);
    }
    this.on = 0;        // target activation
    this._on = 0;       // smoothed
    this.speedTarget = speed;
  }
  mat(mirrorFlag) {
    const u = {};
    for (const k in this.uniforms) u[k] = this.uniforms[k];
    const m = new THREE.ShaderMaterial({
      uniforms: { ...u, uMirror: { value: mirrorFlag }, uOpacity: { value: this.uniforms?.uOpacity?.value ?? 1 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    return m;
  }
  update(t, dt) {
    this._on += (this.on - this._on) * Math.min(1, dt * 3.5);
    const sp = this.uniforms.uSpeed;
    sp.value += (this.speedTarget - sp.value) * Math.min(1, dt * 2.2);
    this.uniforms.uTime.value = t;
    this.uniforms.uOn.value = this._on;
    // shared uniform objects: mirror material sees the same values except its own uMirror/uOpacity
  }
  setColor(c) { this.uniforms.uColor.value.set(c); }
}

// Expanding rings on the water surface (spawned where jets land / on beat).
export class RingWaves {
  constructor({ y = 0.16, color = 0xcfefff, max = 14 } = {}) {
    this.group = new THREE.Group();
    this.items = [];
    const map = ringSprite();
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending, color,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.visible = false;
      this.group.add(m);
      this.items.push({ mesh: m, t: 1, dur: 1, size: 1 });
    }
  }
  spawn(x, z, size = 2.4, dur = 1.4, color = null) {
    const it = this.items.find(i => i.t >= 1);
    if (!it) return;
    it.t = 0; it.dur = dur; it.size = size;
    it.mesh.position.x = x; it.mesh.position.z = z;
    it.mesh.visible = true;
    if (color) it.mesh.material.color.set(color);
  }
  update(dt) {
    for (const it of this.items) {
      if (it.t >= 1) { it.mesh.visible = false; continue; }
      it.t = Math.min(1, it.t + dt / it.dur);
      const s = 0.25 + it.t * it.size;
      it.mesh.scale.set(s, s, 1);
      it.mesh.material.opacity = (1 - it.t) * 0.8;
    }
  }
}

// Slow-rising mist sprites around jet bases.
export class Mist {
  constructor({ count = 26, area = 4, y = 0.2, color = 0xdff4ff } = {}) {
    this.group = new THREE.Group();
    this.items = [];
    const map = sprite();
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map, color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * area;
      s.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      s.scale.setScalar(1.5 + Math.random() * 2.5);
      this.group.add(s);
      this.items.push({ s, ph: Math.random() * 10, sp: 0.15 + Math.random() * 0.3 });
    }
    this.level = 0;
  }
  update(t, dt) {
    for (const it of this.items) {
      const k = (t * it.sp + it.ph) % 1;
      it.s.position.y = 0.2 + k * 2.2;
      it.s.material.opacity = this.level * 0.14 * Math.sin(k * Math.PI);
    }
  }
}

// Bubbles flowing through the transparent hose (a THREE.Curve path).
export class HoseBubbles {
  constructor(curve, { count = 60, size = 0.03, color = 0xeaf8ff } = {}) {
    this.curve = curve;
    this.group = new THREE.Group();
    this.items = [];
    const map = sprite();
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map, color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      s.scale.setScalar(size * (0.6 + Math.random()));
      this.group.add(s);
      this.items.push({ s, ph: Math.random(), sp: 0.55 + Math.random() * 0.5, off: (Math.random() - 0.5) * 0.05 });
    }
    this.on = 0; this._on = 0;
    this._v = new THREE.Vector3();
  }
  update(t, dt) {
    this._on += (this.on - this._on) * Math.min(1, dt * 3);
    if (this._on < 0.01) { this.group.visible = false; return; }
    this.group.visible = true;
    for (const it of this.items) {
      const k = (t * it.sp * 0.35 + it.ph) % 1;
      this.curve.getPointAt(k, this._v);
      it.s.position.set(this._v.x, this._v.y + it.off, this._v.z + it.off);
      it.s.material.opacity = this._on * 0.85 * Math.sin(Math.min(1, k * 8) * Math.PI * 0.5);
    }
  }
}
