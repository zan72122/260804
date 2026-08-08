/**
 * The camera director.
 *
 * The child never drives the camera. The game moves it to whichever position
 * makes the *next verb* obvious, and it always moves continuously — the one
 * rule we never break is that a cause and its effect (reel passing, fruit
 * coming loose, fruit surfacing) are never separated by a cut.
 *
 * Every shot is authored twice, once for landscape and once for portrait,
 * because a rotated phone is a different composition, not a smaller one.
 */

import * as THREE from 'three';
import { damp, lerp } from '../core/math';
import { prefersReducedMotion } from '../core/settings';

export interface Shot {
  /** Point the camera looks at. */
  target: THREE.Vector3;
  /** Compass angle around the target, radians (0 = looking from +Z). */
  yaw: number;
  /** Height angle, radians above the horizon. */
  pitch: number;
  /** Distance from target. */
  dist: number;
  fov: number;
  /** Positive lifts the subject on screen (leaves room for controls below). */
  bias?: number;
  /** Move rate; lower = statelier. */
  rate?: number;
}

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;

  private readonly cur = {
    target: new THREE.Vector3(),
    yaw: 0,
    pitch: 0.5,
    dist: 40,
    fov: 46,
    bias: 0,
  };
  private want: Shot | null = null;
  private time = 0;
  private breathe = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.3, 600);
    this.camera.position.set(0, 22, 44);
  }

  set(shot: Shot, immediate = false): void {
    this.want = shot;
    if (immediate) {
      this.cur.target.copy(shot.target);
      this.cur.yaw = shot.yaw;
      this.cur.pitch = shot.pitch;
      this.cur.dist = shot.dist;
      this.cur.fov = shot.fov;
      this.cur.bias = shot.bias ?? 0;
      this.apply();
    }
  }

  /** Nudge only the look-at point, e.g. to follow the reel inside a shot. */
  retarget(p: THREE.Vector3): void {
    if (this.want) this.want.target.copy(p);
  }

  update(dt: number): void {
    this.time += dt;
    const w = this.want;
    if (!w) return;
    const reduce = prefersReducedMotion();
    const rate = (w.rate ?? 1.6) * (reduce ? 2.6 : 1);

    this.cur.target.x = damp(this.cur.target.x, w.target.x, rate, dt);
    this.cur.target.y = damp(this.cur.target.y, w.target.y, rate, dt);
    this.cur.target.z = damp(this.cur.target.z, w.target.z, rate, dt);

    // shortest way round, so a yaw change never spins the long way
    let dy = w.yaw - this.cur.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.cur.yaw = damp(this.cur.yaw + dy, w.yaw, rate, dt);
    this.cur.pitch = damp(this.cur.pitch, w.pitch, rate, dt);
    this.cur.dist = damp(this.cur.dist, w.dist, rate, dt);
    this.cur.fov = damp(this.cur.fov, w.fov, rate, dt);
    this.cur.bias = damp(this.cur.bias, w.bias ?? 0, rate, dt);

    // a very small breathing drift keeps the frame alive without motion sickness
    this.breathe = reduce ? 0 : Math.sin(this.time * 0.28) * 0.012;
    this.apply();
  }

  private apply(): void {
    const c = this.cur;
    const pitch = c.pitch + this.breathe;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    this.camera.position.set(
      c.target.x + Math.sin(c.yaw) * cp * c.dist,
      c.target.y + sp * c.dist,
      c.target.z + Math.cos(c.yaw) * cp * c.dist,
    );
    // bias raises the look-at so the subject sits above the thumb zone
    this.camera.lookAt(c.target.x, c.target.y - c.bias, c.target.z);
    if (Math.abs(this.camera.fov - c.fov) > 0.01) {
      this.camera.fov = c.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Blend two authored shots — used for orientation changes. */
  static blend(a: Shot, b: Shot, t: number): Shot {
    return {
      target: a.target.clone().lerp(b.target, t),
      yaw: lerp(a.yaw, b.yaw, t),
      pitch: lerp(a.pitch, b.pitch, t),
      dist: lerp(a.dist, b.dist, t),
      fov: lerp(a.fov, b.fov, t),
      bias: lerp(a.bias ?? 0, b.bias ?? 0, t),
      rate: a.rate ?? b.rate,
    };
  }
}
