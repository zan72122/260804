/**
 * Two small effects that carry meaning rather than decoration:
 *   Wisps       — paraffin leaving the section in the clearing bath
 *   BindingView — a symbolic "the dye is finding its target" window, shown
 *                 during staining. It shows binding, never the final picture:
 *                 the fluorescence image is kept back for the microscope.
 */
import * as THREE from 'three';
import { TAU } from '../core/util';

let softDot: THREE.Texture | null = null;
function dotTexture() {
  if (softDot) return softDot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  softDot = new THREE.CanvasTexture(c);
  return softDot;
}

export class Wisps {
  readonly group = new THREE.Group();
  private items: { m: THREE.Mesh; life: number; max: number; vy: number; sway: number }[] = [];
  private mat: THREE.MeshBasicMaterial;

  constructor(count = 7) {
    this.mat = new THREE.MeshBasicMaterial({
      map: dotTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xf6fbff, opacity: 0.7,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat.clone());
      m.visible = false;
      m.renderOrder = 12;
      this.group.add(m);
      this.items.push({ m, life: 0, max: 1, vy: 0, sway: 0 });
    }
  }

  emit(origin: THREE.Vector3, scale = 0.12) {
    for (const it of this.items) {
      if (it.life > 0) continue;
      it.m.position.copy(origin);
      it.m.position.x += (Math.random() - 0.5) * 0.14;
      it.m.position.z += (Math.random() - 0.5) * 0.14;
      it.m.scale.setScalar(scale * (0.7 + Math.random() * 0.8));
      it.m.visible = true;
      it.max = it.life = 1.1 + Math.random() * 0.9;
      it.vy = 0.13 + Math.random() * 0.12;
      it.sway = Math.random() * TAU;
      return;
    }
  }

  update(dt: number, camera: THREE.Camera) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      it.m.position.y += it.vy * dt;
      it.sway += dt * 1.4;
      it.m.position.x += Math.sin(it.sway) * 0.05 * dt;
      it.m.quaternion.copy(camera.quaternion);
      const k = it.life / it.max;
      (it.m.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
      it.m.scale.multiplyScalar(1 + dt * 0.35);
      if (it.life <= 0) it.m.visible = false;
    }
  }

  clear() { for (const it of this.items) { it.life = 0; it.m.visible = false; } }
  dispose() {
    this.mat.dispose();
    for (const it of this.items) (it.m.material as THREE.Material).dispose();
    this.items[0]?.m.geometry.dispose();
  }
}

/**
 * The staining window: free dye drifting in, then locking onto a structure.
 * `progress` 0 -> 1 moves from "floating everywhere" to "bound".
 */
export class BindingView {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(0x4d86ff) },
        uAlpha: { value: 0 },
        uPattern: { value: 0 },   // 0 rings, 1 mesh-like, 2 speckle
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uProgress, uAlpha, uPattern;
        uniform vec3 uColor;
        varying vec2 vUv;

        float hash(float n) { return fract(sin(n) * 43758.5453); }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          // the structure the dye is looking for
          float target;
          if (uPattern < 0.5)      target = smoothstep(0.06, 0.0, abs(r - 0.52));
          else if (uPattern < 1.5) target = smoothstep(0.05, 0.0, abs(sin(p.x * 6.0 + p.y * 3.0) * 0.35 + p.y * 0.4));
          else                     target = smoothstep(0.16, 0.0, length(fract(p * 2.4) - 0.5) - 0.18);

          vec3 col = vec3(0.02, 0.035, 0.06);
          col += uColor * target * (0.10 + uProgress * 0.85);

          // free dye molecules drifting, then snapping to the target
          for (int i = 0; i < 14; i++) {
            float fi = float(i);
            float a0 = hash(fi * 1.7) * 6.2831;
            float rr = 0.35 + hash(fi * 3.1) * 0.6;
            vec2 free = vec2(cos(a0 + uTime * (0.4 + hash(fi) * 0.5)) * rr,
                             sin(a0 * 1.3 + uTime * (0.3 + hash(fi * 2.0) * 0.5)) * rr);
            float ta = a0 * 2.0;
            vec2 bound = uPattern < 0.5 ? vec2(cos(ta), sin(ta)) * 0.52
                       : uPattern < 1.5 ? vec2(cos(ta) * 0.8, -sin(cos(ta) * 6.0) * 0.35 - cos(ta) * 0.32)
                       : (fract(vec2(hash(fi * 5.0), hash(fi * 7.0)) * 2.4) - 0.5) * 0.8;
            vec2 q = mix(free, bound, smoothstep(0.0, 1.0, uProgress));
            float d = length(p - q);
            col += uColor * exp(-d * d * 900.0) * (0.6 + uProgress * 0.6);
          }

          float vign = smoothstep(1.0, 0.86, r);
          float rim = smoothstep(0.94, 1.0, r) * (1.0 - smoothstep(1.0, 1.02, r));
          col *= vign;
          col += vec3(0.4, 0.6, 0.75) * rim * 0.7;
          gl_FragColor = vec4(col, uAlpha * (vign + rim));
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.renderOrder = 950;
    this.mesh.visible = false;
  }

  show(color: THREE.Color, pattern: number) {
    this.mat.uniforms.uColor.value.copy(color);
    this.mat.uniforms.uPattern.value = pattern;
    this.mesh.visible = true;
  }
  set alpha(v: number) {
    this.mat.uniforms.uAlpha.value = v;
    this.mesh.visible = v > 0.005;
  }
  set progress(v: number) { this.mat.uniforms.uProgress.value = v; }
  tick(t: number) { this.mat.uniforms.uTime.value = t; }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
