import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { PAL } from '../core/palette';
import { clamp, clamp01 } from '../core/util';

const FIXED = 1 / 120;
const G = 7.2;

/**
 * Tezuna — the hand rope between the usho's fist and a cormorant.
 *
 * A verlet chain rather than a drawn line, because the whole feel of ukai is
 * in how these behave: they sag into the water when a bird is close, snap
 * taut and lift clear when it swims out, hang heavy and slow while submerged,
 * and shiver along their length when a bird takes a fish.
 */
export class Rope {
  readonly pts: Vector3[] = [];
  private prev: Vector3[] = [];
  private acc: Vector3[] = [];
  readonly n: number;
  /** Rest length of the whole rope; hauling shrinks this. */
  length: number;
  private lengthTarget: number;
  readonly maxLength: number;
  readonly minLength: number;
  private t = 0;
  private carry = 0;
  private twitch = 0;
  private twitchPhase = 0;

  readonly start = new Vector3();
  readonly end = new Vector3();
  /** When false the far end is free (bird has let go / not attached yet). */
  endPinned = true;

  constructor(n: number, length: number, minLength: number, maxLength: number) {
    this.n = n;
    this.length = length;
    this.lengthTarget = length;
    this.minLength = minLength;
    this.maxLength = maxLength;
    for (let i = 0; i < n; i++) {
      this.pts.push(new Vector3());
      this.prev.push(new Vector3());
      this.acc.push(new Vector3());
    }
  }

  /** Lay the rope out in a straight line between two points. */
  reset(a: Vector3, b: Vector3): void {
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1);
      this.pts[i].lerpVectors(a, b, t);
      this.prev[i].copy(this.pts[i]);
    }
    this.start.copy(a);
    this.end.copy(b);
  }

  setLength(v: number): void {
    this.lengthTarget = clamp(v, this.minLength, this.maxLength);
  }

  get targetLength(): number {
    return this.lengthTarget;
  }

  /** Pull in by `amount`; this is what one haul stroke does. */
  haul(amount: number): void {
    this.setLength(this.lengthTarget - amount);
  }

  /** Shiver along the rope: a bird has found something down there. */
  shiver(strength = 1): void {
    this.twitch = Math.max(this.twitch, strength);
  }

  get tension(): number {
    const d = this.start.distanceTo(this.end);
    return clamp01(d / Math.max(0.0001, this.length));
  }

  /** How much of the rope is lying in the water. */
  get wetFraction(): number {
    let w = 0;
    for (let i = 0; i < this.n; i++) if (this.pts[i].y < 0) w++;
    return w / this.n;
  }

  step(dt: number, waveAt: (x: number, z: number) => number): void {
    this.t += dt;
    this.length += (this.lengthTarget - this.length) * Math.min(1, dt * 5.5);
    this.twitch = Math.max(0, this.twitch - dt * 0.55);
    this.twitchPhase += dt * 34;

    this.carry += dt;
    let steps = 0;
    while (this.carry >= FIXED && steps < 5) {
      this.carry -= FIXED;
      steps++;
      this.substep(FIXED, waveAt);
    }
    if (steps === 5) this.carry = 0;
  }

  private substep(h: number, waveAt: (x: number, z: number) => number): void {
    const n = this.n;
    const seg = this.length / (n - 1);

    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const pr = this.prev[i];
      const a = this.acc[i].set(0, -G, 0);

      const submerged = p.y < 0;
      if (submerged) {
        // Wet hemp: buoyant enough to drift, damped enough to feel heavy.
        const depth = clamp01(-p.y / 0.6);
        a.y += G * (0.62 + depth * 0.5);
        a.x += Math.sin(this.t * 1.7 + p.z * 0.9) * 0.3;
        a.z += Math.cos(this.t * 1.3 + p.x * 0.8) * 0.22;
      }

      // Shiver: a travelling wave along the rope, strongest mid-span.
      if (this.twitch > 0.001) {
        const u = i / (n - 1);
        const env = Math.sin(u * Math.PI) * this.twitch;
        const w = Math.sin(this.twitchPhase - u * 9.0);
        a.x += w * env * 11;
        a.y += Math.cos(this.twitchPhase * 0.87 - u * 7.0) * env * 8;
      }

      const vx = (p.x - pr.x) * (submerged ? 0.86 : 0.995);
      const vy = (p.y - pr.y) * (submerged ? 0.8 : 0.995);
      const vz = (p.z - pr.z) * (submerged ? 0.86 : 0.995);
      pr.copy(p);
      p.x += vx + a.x * h * h;
      p.y += vy + a.y * h * h;
      p.z += vz + a.z * h * h;
    }

    // Distance constraints, endpoints pinned.
    for (let it = 0; it < 9; it++) {
      this.pts[0].copy(this.start);
      if (this.endPinned) this.pts[n - 1].copy(this.end);
      for (let i = 0; i < n - 1; i++) {
        const a = this.pts[i];
        const b = this.pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-5;
        const mA = i === 0 ? 0 : 1;
        const mB = i + 1 === n - 1 && this.endPinned ? 0 : 1;
        const sum = mA + mB;
        if (sum === 0) continue;
        const corr = (d - seg) / d;
        const fa = (corr * mA) / sum;
        const fb = (corr * mB) / sum;
        a.x += dx * fa;
        a.y += dy * fa;
        a.z += dz * fa;
        b.x -= dx * fb;
        b.y -= dy * fb;
        b.z -= dz * fb;
      }
      // Bending stiffness: a one-sided constraint across every other point.
      // Without this a slack rope buckles into a sawtooth; with it, it curls
      // and loops the way wet hemp actually does.
      const bend = seg * 1.72;
      for (let i = 0; i < n - 2; i++) {
        const a = this.pts[i];
        const b = this.pts[i + 2];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-5;
        if (d >= bend) continue;
        const mA = i === 0 ? 0 : 1;
        const mB = i + 2 === n - 1 && this.endPinned ? 0 : 1;
        const sum = mA + mB;
        if (sum === 0) continue;
        const corr = ((d - bend) / d) * 0.32;
        a.x += dx * ((corr * mA) / sum);
        a.y += dy * ((corr * mA) / sum);
        a.z += dz * ((corr * mA) / sum);
        b.x -= dx * ((corr * mB) / sum);
        b.y -= dy * ((corr * mB) / sum);
        b.z -= dz * ((corr * mB) / sum);
      }
      this.pts[0].copy(this.start);
      if (this.endPinned) this.pts[n - 1].copy(this.end);
    }

    // Let the surface carry the floating middle of the rope.
    for (let i = 1; i < n - 1; i++) {
      const p = this.pts[i];
      const surf = waveAt(p.x, p.z);
      if (p.y < surf - 0.5) p.y += (surf - 0.5 - p.y) * 0.06;
    }
  }

  /** Points that are crossing the surface — where ripples should be born. */
  waterContacts(out: Vector3[]): number {
    let c = 0;
    for (let i = 1; i < this.n - 1 && c < out.length; i++) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      if (a.y * b.y < 0) {
        const t = a.y / (a.y - b.y);
        out[c].lerpVectors(a, b, t);
        c++;
      }
    }
    return c;
  }
}

/**
 * Tube mesh for a rope, rebuilt in place each frame. Submerged sections darken
 * so you can see, at a glance, how much rope is in the river.
 */
export class RopeMesh {
  readonly mesh: Mesh;
  private radial: number;
  private n: number;
  private pos: Float32Array;
  private nor: Float32Array;
  private col: Float32Array;
  private up = new Vector3(0, 1, 0);
  private tan = new Vector3();
  private nrm = new Vector3();
  private bin = new Vector3();
  private dry = new Color(PAL.rope);
  private wet = new Color(PAL.ropeWet);
  private tmpCol = new Color();
  private radiusList: Float32Array;

  constructor(n: number, radius = 0.021, radial = 5) {
    this.n = n;
    this.radial = radial;
    const verts = n * radial;
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 3);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const j2 = (j + 1) % radial;
        const a = i * radial + j;
        const b = i * radial + j2;
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + j2;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new BufferAttribute(this.nor, 3));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    g.setIndex(idx);
    g.boundingSphere = null;
    const mat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.03,
    });
    this.mesh = new Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.radiusList = new Float32Array(n).fill(radius);
  }

  /** Taper the rope slightly toward the bird so it reads as hand-laid hemp. */
  setTaper(base: number, tip: number): void {
    for (let i = 0; i < this.n; i++) {
      this.radiusList[i] = base + (tip - base) * (i / (this.n - 1));
    }
  }

  update(pts: Vector3[], sheen = 0): void {
    const n = this.n;
    const R = this.radial;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      this.tan.subVectors(b, a);
      if (this.tan.lengthSq() < 1e-9) this.tan.set(0, 0, 1);
      this.tan.normalize();
      // Stable frame: cross with world up unless we're nearly vertical.
      this.up.set(0, 1, 0);
      if (Math.abs(this.tan.y) > 0.94) this.up.set(1, 0, 0);
      this.nrm.crossVectors(this.tan, this.up).normalize();
      this.bin.crossVectors(this.tan, this.nrm).normalize();

      const wetness = clamp01(-p.y * 3.2 + 0.35);
      const r = this.radiusList[i];
      const c = this.tmpCol.copy(this.dry).lerp(this.wet, wetness).multiplyScalar(1 + sheen * 0.5);
      for (let j = 0; j < R; j++) {
        const ang = (j / R) * Math.PI * 2;
        const cx = Math.cos(ang);
        const sy = Math.sin(ang);
        const nx = this.nrm.x * cx + this.bin.x * sy;
        const ny = this.nrm.y * cx + this.bin.y * sy;
        const nz = this.nrm.z * cx + this.bin.z * sy;
        const k = (i * R + j) * 3;
        this.pos[k] = p.x + nx * r;
        this.pos[k + 1] = p.y + ny * r;
        this.pos[k + 2] = p.z + nz * r;
        this.nor[k] = nx;
        this.nor[k + 1] = ny;
        this.nor[k + 2] = nz;
        this.col[k] = c.r;
        this.col[k + 1] = c.g;
        this.col[k + 2] = c.b;
      }
    }
    const g = this.mesh.geometry;
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('normal') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }
}
