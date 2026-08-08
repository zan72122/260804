// 打紙 — the beaten paper that gets peeled open (ペロン).
// A real sheet of geometry that rolls back over a cylinder of finite radius, so
// you see the paper's own thickness, its curl, and the shadow it throws on the
// leaf underneath.

import { mat4, clamp, lerp } from '../core/math.js';
import * as GL from '../core/gl.js';

const NX = 26, NZ = 26;

export class PeelSheet {
  constructor(gl, width = 0.158, depth = 0.158) {
    this.gl = gl;
    this.w = width;
    this.d = depth;
    this.dim = { x: NX + 1, z: NZ + 1 };
    const count = this.dim.x * this.dim.z;
    this.count = count;
    this.data = new Float32Array(count * 9);
    this.pos = new Float32Array(count * 3);
    const idx = [];
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * this.dim.x + i, b = a + this.dim.x;
        idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    this.mesh = GL.createMesh(gl, this.data, new Uint32Array(idx), true);
    this.model = mat4.create();
    this.progress = 0;
    this.visible = true;
    this.update(0);
  }

  setTransform(t, r = [0, 0, 0]) {
    mat4.fromTRS(this.model, t, r, [1, 1, 1]);
    this.origin = t;
    this.yaw = r[1] || 0;
  }

  /**
   * World height of the sheet above a point, or null if the point is not under
   * it. The leaf lying between the papers uses this as a ceiling: at 0.1 micron
   * it has no business poking through a sheet of 打紙.
   */
  heightAt(worldX, worldZ) {
    if (!this.origin) return null;
    const dx = worldX - this.origin[0], dz = worldZ - this.origin[2];
    const c = Math.cos(-this.yaw), s = Math.sin(-this.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) > this.w / 2) return null;
    const halfD = this.d / 2;
    const zh = -halfD;
    const phi = this.progress * Math.PI * 1.01;
    const lag = 0.62 * Math.sin(phi);
    // invert the hinge rotation: which point of the sheet is over lz?
    // for small progress this is near-identity, which is the case that matters
    const dRaw = clamp(lz - zh, 0, this.d);
    const t = dRaw / this.d;
    const p = phi - lag * Math.pow(t, 1.4);
    const y = dRaw * Math.sin(p);
    if (dRaw <= 0 || dRaw >= this.d) return null;
    return this.origin[1] + Math.max(y, 0);
  }

  /**
   * progress 0 = lying closed on the bundle, 1 = swung right open like a cover.
   * The sheet hinges on its far edge and every point rotates about that hinge,
   * with points further out lagging slightly — that lag is what gives the paper
   * its soft curl instead of a rigid flap.
   */
  update(progress, time = 0) {
    this.progress = clamp(progress, 0, 1);
    const halfD = this.d / 2;
    const zh = -halfD;                       // hinge line, far edge
    const phi = this.progress * Math.PI * 1.01;
    const lag = 0.62 * Math.sin(phi);        // vanishes when closed and when open
    const data = this.data, pos = this.pos;
    for (let j = 0; j <= NZ; j++) {
      for (let i = 0; i <= NX; i++) {
        const k = j * this.dim.x + i;
        const x = (i / NX - 0.5) * this.w;
        const z0 = (j / NZ - 0.5) * this.d;
        const d = z0 - zh;                    // distance from the hinge
        const t = d / this.d;
        const p = phi - lag * Math.pow(t, 1.4);
        let z = zh + d * Math.cos(p);
        let y = d * Math.sin(p) + 0.0006;
        // the free corners droop, and a sheet this light trembles as it swings
        const lateral = (x / (this.w / 2)) ** 2;
        y -= lateral * Math.sin(phi) * t * 0.007;
        y += Math.sin(time * 5.1 + x * 26) * 0.0011 * t * Math.sin(phi);
        // once it is right over, the far end sags down toward the board rather
        // than hanging in the air like a shelf
        if (this.progress > 0.68) {
          const open = (this.progress - 0.68) / 0.32;
          y -= open * t * t * 0.046;
        }
        if (this.progress < 0.002) y = Math.sin(x * 34 + z0 * 21) * 0.00035;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      }
    }
    for (let j = 0; j <= NZ; j++) {
      for (let i = 0; i <= NX; i++) {
        const k = j * this.dim.x + i;
        const kl = (i > 0 ? k - 1 : k) * 3, kr = (i < NX ? k + 1 : k) * 3;
        const kd = (j > 0 ? k - this.dim.x : k) * 3, ku = (j < NZ ? k + this.dim.x : k) * 3;
        const ax = pos[kr] - pos[kl], ay = pos[kr + 1] - pos[kl + 1], az = pos[kr + 2] - pos[kl + 2];
        const bx = pos[ku] - pos[kd], by = pos[ku + 1] - pos[kd + 1], bz = pos[ku + 2] - pos[kd + 2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const l = Math.hypot(nx, ny, nz) || 1;
        const o = k * 9;
        data[o] = pos[k * 3]; data[o + 1] = pos[k * 3 + 1]; data[o + 2] = pos[k * 3 + 2];
        data[o + 3] = -nx / l; data[o + 4] = -ny / l; data[o + 5] = -nz / l;
        data[o + 6] = i / NX * 0.16; data[o + 7] = j / NZ * 0.16;
        data[o + 8] = 1;
      }
    }
    GL.updateMesh(this.gl, this.mesh, data);
  }
}
