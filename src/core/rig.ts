/**
 * Scripted camera. The player never drives it — the game always moves to the
 * angle at which the current signature action reads most clearly, exactly as
 * the ten-shot chain in the design calls for.
 */
import * as THREE from 'three';
import { clamp, easeInOutCubic, damp } from './util';

export interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** amplitude of the slow idle drift, world units */
  drift?: number;
}

export type ShotName =
  | 'establish' | 'posture' | 'action' | 'ribbonMacro' | 'ribbonPick'
  | 'bath' | 'pickup' | 'dewax' | 'stain' | 'mount'
  | 'scope' | 'optical';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3();
  private tgt = new THREE.Vector3();
  private fromPos = new THREE.Vector3();
  private fromTgt = new THREE.Vector3();
  private fromFov = 45;
  private toPos = new THREE.Vector3();
  private toTgt = new THREE.Vector3();
  private toFov = 45;
  private t = 1;
  private dur = 1;
  private drift = 1;
  private clock = 0;
  /** additive nudge used for impact shakes */
  private shake = 0;
  current: ShotName | null = null;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 120);
  }

  snap(s: Shot) {
    this.fromPos.set(...s.pos); this.toPos.set(...s.pos);
    this.fromTgt.set(...s.target); this.toTgt.set(...s.target);
    this.fromFov = this.toFov = s.fov;
    this.drift = s.drift ?? 1;
    this.t = 1;
    this.pos.copy(this.toPos); this.tgt.copy(this.toTgt);
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
  }

  moveTo(s: Shot, duration = 1.4) {
    this.fromPos.copy(this.pos); this.fromTgt.copy(this.tgt);
    this.fromFov = this.camera.fov;
    this.toPos.set(...s.pos); this.toTgt.set(...s.target);
    this.toFov = s.fov;
    this.drift = s.drift ?? 1;
    this.t = 0;
    this.dur = Math.max(0.001, duration);
  }

  get moving() { return this.t < 1; }

  /**
   * Continuously track a shot that is itself changing — used while the ribbon
   * grows, so the frame opens up to keep the whole thing visible without ever
   * looking like a cut.
   */
  follow(s: Shot, dt: number, speed = 1.6) {
    if (this.t < 1) return;                 // a scripted move wins
    _t1.set(...s.pos); _t2.set(...s.target);
    this.pos.lerp(_t1, 1 - Math.exp(-speed * dt));
    this.tgt.lerp(_t2, 1 - Math.exp(-speed * dt));
    this.toPos.copy(this.pos); this.toTgt.copy(this.tgt);
    const f = damp(this.camera.fov, s.fov, speed, dt);
    if (Math.abs(f - this.camera.fov) > 1e-4) {
      this.camera.fov = f;
      this.camera.updateProjectionMatrix();
    }
    this.drift = s.drift ?? 1;
  }

  bump(amount = 1) { this.shake = Math.min(1.4, this.shake + amount); }

  update(dt: number) {
    this.clock += dt;
    if (this.t < 1) {
      this.t = clamp(this.t + dt / this.dur);
      const e = easeInOutCubic(this.t);
      this.pos.lerpVectors(this.fromPos, this.toPos, e);
      this.tgt.lerpVectors(this.fromTgt, this.toTgt, e);
      this.camera.fov = this.fromFov + (this.toFov - this.fromFov) * e;
      this.camera.updateProjectionMatrix();
    }
    this.shake = damp(this.shake, 0, 7, dt);

    const d = this.drift * 0.012;
    const c = this.clock;
    const sx = Math.sin(c * 0.31) * d + Math.sin(c * 27.0) * this.shake * 0.01;
    const sy = Math.cos(c * 0.24) * d * 0.7 + Math.cos(c * 31.0) * this.shake * 0.012;
    const sz = Math.sin(c * 0.19 + 1.2) * d * 0.5;

    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z + sz);
    this.camera.lookAt(this.tgt.x, this.tgt.y + sy * 0.35, this.tgt.z);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** World position -> css pixels inside the canvas. */
  project(world: THREE.Vector3, w: number, h: number, out: { x: number; y: number }) {
    _v.copy(world).project(this.camera);
    out.x = (_v.x * 0.5 + 0.5) * w;
    out.y = (-_v.y * 0.5 + 0.5) * h;
    return out;
  }

  /** Intersect the ray through a css pixel with a world-space plane. */
  rayToPlane(px: number, py: number, w: number, h: number, plane: THREE.Plane, out: THREE.Vector3) {
    _ndc.set((px / w) * 2 - 1, -((py / h) * 2 - 1));
    _ray.setFromCamera(_ndc, this.camera);
    const hit = _ray.ray.intersectPlane(plane, out);
    if (!hit) out.set(0, 0, 0);
    return !!hit;
  }
}

const _v = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
