// Renderer, camera rig and post chain.

// Rendering is deliberately single-pass: no EffectComposer, no post chain.
// Glow around light sources is done in-scene with additive halo sprites, which
// costs a few triangles instead of several full-screen render targets, and
// behaves identically on software rasterisers and mobile GPUs.

import * as THREE from 'three';
import { clamp, damp, lerp } from './util.js';

export const QUALITY = {
  high: { pr: 2.0, shadow: 2048, halo: 1.0, aniso: 8, softShadow: true },
  mid: { pr: 1.5, shadow: 1024, halo: 1.0, aniso: 4, softShadow: true },
  low: { pr: 1.0, shadow: 512, halo: 0.6, aniso: 1, softShadow: false },
};

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    // 50° vertical FOV. Wide enough that standing at the counter you still see
    // the terrace, the town below and a band of sky above the board — the
    // convergence of the counter edges into that depth is the whole point.
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.03, 900);

    // Camera rig, in spherical coordinates around a look-at target.
    // Standing at your own stall: eye ~1.68 m, pitched about 21° down at the
    // tray. The board lands in the lower half; the parapet, the town below and
    // the sky stack up behind it.
    this.home = { az: 0, el: 0.32, dist: 1.62, target: new THREE.Vector3(0, 1.14, -0.30) };
    this.rig = { az: this.home.az, el: this.home.el, dist: this.home.dist };
    this.want = { ...this.rig };
    this.target = this.home.target.clone();
    this.wantTarget = this.home.target.clone();
    this.parallax = new THREE.Vector2();
    this.wantParallax = new THREE.Vector2();
    this.shake = 0;
    this.time = 0;

    this.limits = { azMin: -0.68, azMax: 0.68, elMin: 0.08, elMax: 0.98, dMin: 1.15, dMax: 3.4 };

    this.quality = 'high';

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  setQuality(name) {
    const q = QUALITY[name] || QUALITY.high;
    this.quality = name;
    this.renderer.shadowMap.type = q.softShadow ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    this.shadowSize = q.shadow;
    this.haloScale = q.halo;
    this.aniso = Math.min(q.aniso, this.renderer.capabilities.getMaxAnisotropy());
    this.resize();
    return q;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // On tall/narrow phone screens widen the FOV and back the camera off, so
    // the 0.82 m tray always fits across the frame instead of being cropped.
    const a = this.camera.aspect;
    this.camera.fov = a < 0.85 ? 62 : a < 1.25 ? 56 : 50;
    this.camera.updateProjectionMatrix();
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * a);
    // 0.58 m of half-width to cover: the tray plus a margin for its rim.
    this.fitScale = Math.max(1, (0.58 / Math.tan(hHalf)) / 1.35);
  }

  orbit(dAz, dEl) {
    const L = this.limits;
    this.want.az = clamp(this.want.az + dAz, L.azMin, L.azMax);
    this.want.el = clamp(this.want.el + dEl, L.elMin, L.elMax);
  }

  zoom(delta) {
    const L = this.limits;
    this.want.dist = clamp(this.want.dist + delta, L.dMin, L.dMax);
  }

  /** Pointer-driven micro parallax: the head-move that proves the space is 3D. */
  setPointer(nx, ny) {
    this.wantParallax.set(clamp(nx, -1, 1), clamp(ny, -1, 1));
  }

  resetCamera() {
    this.want.az = this.home.az;
    this.want.el = this.home.el;
    this.want.dist = this.home.dist;
    this.wantTarget.copy(this.home.target);
  }

  addShake(amount) { this.shake = Math.min(1, this.shake + amount); }

  update(dt) {
    this.time += dt;
    this.rig.az = damp(this.rig.az, this.want.az, 8, dt);
    this.rig.el = damp(this.rig.el, this.want.el, 8, dt);
    this.rig.dist = damp(this.rig.dist, this.want.dist, 8, dt);
    this.target.lerp(this.wantTarget, 1 - Math.exp(-6 * dt));
    this.parallax.lerp(this.wantParallax, 1 - Math.exp(-3.2 * dt));
    this.shake = Math.max(0, this.shake - dt * 2.2);

    const { az, el } = this.rig;
    const dist = this.rig.dist * (this.fitScale || 1);
    // Idle breathing keeps the frame alive without fighting player input.
    const breathe = Math.sin(this.time * 0.42) * 0.006 + Math.sin(this.time * 0.23) * 0.004;
    const pAz = az + this.parallax.x * 0.055;
    const pEl = clamp(el + this.parallax.y * 0.035 + breathe, 0.12, 1.35);

    const x = Math.sin(pAz) * Math.cos(pEl) * dist;
    const y = Math.sin(pEl) * dist;
    const z = Math.cos(pAz) * Math.cos(pEl) * dist;

    const s = this.shake * this.shake;
    this.camera.position.set(
      this.target.x + x + (Math.sin(this.time * 47) * 0.012) * s,
      this.target.y + y + (Math.sin(this.time * 39) * 0.012) * s,
      this.target.z + z,
    );
    this.camera.lookAt(this.target);
    this.camera.rotation.z += Math.sin(this.time * 31) * 0.006 * s;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}

