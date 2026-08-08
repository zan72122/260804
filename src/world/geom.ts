import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bake a pile of little meshes into one draw call.
 *
 * The diorama is made of hundreds of small modelled parts — reeds, basket
 * staves, cage bars, straw strands — and on a phone the cost of those is
 * almost entirely per-draw-call overhead, not pixels. Merging keeps the detail
 * and throws away the cost.
 */
export function mergeAll(parts: Mesh[], material: Material, tint = false): Mesh {
  const geos: BufferGeometry[] = [];
  for (const m of parts) {
    m.updateMatrix();
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrix);
    if (tint) {
      // Carry each part's colour into vertex colours so a dozen little painted
      // pieces can share one material — and therefore one draw call.
      const c = (m.material as MeshStandardMaterial).color;
      const n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new Float32BufferAttribute(arr, 3));
    }
    // Merging needs identical attribute sets; drop anything exotic.
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') {
        g.deleteAttribute(name);
      }
    }
    if (!g.getAttribute('uv')) {
      const count = g.getAttribute('position').count;
      g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    geos.push(g.index ? g.toNonIndexed() : g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return new Mesh(merged ?? new BufferGeometry(), material);
}

/**
 * A tube whose centreline can be rewritten every frame. Used for a cormorant's
 * neck, which needs to move like a neck rather than like a stack of beads.
 */
export class DynamicTube {
  readonly mesh: Mesh;
  private n: number;
  private radial: number;
  private radii: Float32Array;
  private pos: Float32Array;
  private nor: Float32Array;
  private tan = new Vector3();
  private up = new Vector3();
  private nrm = new Vector3();
  private bin = new Vector3();

  constructor(n: number, radial: number, material: Material) {
    this.n = n;
    this.radial = radial;
    this.radii = new Float32Array(n).fill(0.05);
    this.pos = new Float32Array(n * radial * 3);
    this.nor = new Float32Array(n * radial * 3);
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
    g.setIndex(idx);
    g.boundingSphere = null;
    this.mesh = new Mesh(g, material);
    this.mesh.frustumCulled = false;
  }

  setRadii(fn: (t: number) => number): void {
    for (let i = 0; i < this.n; i++) this.radii[i] = fn(i / (this.n - 1));
  }

  update(pts: Vector3[]): void {
    const R = this.radial;
    for (let i = 0; i < this.n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(this.n - 1, i + 1)];
      this.tan.subVectors(b, a);
      if (this.tan.lengthSq() < 1e-10) this.tan.set(0, 0, -1);
      this.tan.normalize();
      this.up.set(0, 1, 0);
      if (Math.abs(this.tan.y) > 0.95) this.up.set(0, 0, 1);
      this.nrm.crossVectors(this.tan, this.up).normalize();
      this.bin.crossVectors(this.tan, this.nrm).normalize();
      const r = this.radii[i];
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
      }
    }
    const g = this.mesh.geometry;
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('normal') as BufferAttribute).needsUpdate = true;
  }
}

/** Cubic Bezier sample. */
export function bezier(
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  t: number,
  out: Vector3,
): Vector3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z,
  );
}

/**
 * A box with real bevels. Everything the player can imagine picking up gets
 * rounded edges — that single choice is most of the "tactile miniature" look,
 * because bevels are what catch the firelight.
 */
export function roundedBox(w: number, h: number, d: number, r = 0.04, seg = 2): BufferGeometry {
  const rr = Math.min(r, w * 0.45, h * 0.45, d * 0.4);
  const s = new Shape();
  const hw = w / 2 - rr;
  const hh = h / 2 - rr;
  s.moveTo(-hw, -h / 2);
  s.lineTo(hw, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  s.lineTo(w / 2, hh);
  s.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
  s.lineTo(-hw, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh);
  s.lineTo(-w / 2, -hh);
  s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const g = new ExtrudeGeometry(s, {
    depth: d - rr * 2,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr,
    bevelSegments: seg,
    curveSegments: 6,
  });
  g.translate(0, 0, -(d - rr * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Smooth tube through points — used for rails, hoops and rope coils. */
export function tubeThrough(
  points: Vector3[],
  radius: number,
  radial = 7,
  closed = false,
): BufferGeometry {
  const curve = new CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  return new TubeGeometry(curve, Math.max(12, points.length * 6), radius, radial, closed);
}

/** Lathe from a 2D profile given as [radius, height] pairs. */
export function lathe(profile: [number, number][], segments = 20): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(0.0001, r), y)),
    segments,
  );
}

/** Ellipsoid with controllable poles — the base form for birds and fish. */
export function ellipsoid(rx: number, ry: number, rz: number, seg = 16): BufferGeometry {
  const rings = Math.max(8, Math.round(seg * 0.65));
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const v = i / rings;
    const phi = v * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const u = j / seg;
      const th = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(th);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(th);
      pos.push(nx * rx, ny * ry, nz * rz);
      const n = new Vector3(nx / rx, ny / ry, nz / rz).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(u, 1 - v);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Hull skin for the ubune. Stations are swept from stern (t=0) to bow (t=1),
 * each one a rounded-V section, giving the long sheer line and the fine
 * upturned bow that make a river boat read as a river boat.
 */
export interface HullParams {
  length: number;
  halfWidth: number;
  draft: number;
  stations?: number;
  ringPoints?: number;
  /** <1 shrinks the section: used to build the inner shell. */
  inset?: number;
  /** Flip winding for inward-facing surfaces. */
  flip?: boolean;
  /** Trim the top of the section (0..1) so the inner shell sits below the rail. */
  topTrim?: number;
}

export function hullSection(
  t: number,
  p: HullParams,
): { halfW: number; draft: number; sheer: number } {
  const tt = Math.min(1, Math.max(0, t));
  const halfW = p.halfWidth * Math.pow(Math.sin(Math.PI * Math.pow(tt, 0.88)), 0.72);
  const draft = p.draft * Math.pow(Math.sin(Math.PI * Math.pow(tt, 0.7)), 0.4);
  const rise = Math.pow(Math.abs(tt - 0.44) / 0.56, 2.3);
  const bow = Math.pow(Math.max(0, tt - 0.68) / 0.32, 2.0);
  const sheer = 0.3 + rise * 0.3 + bow * 0.34;
  return { halfW, draft, sheer };
}

export function hullSkin(p: HullParams): BufferGeometry {
  const S = p.stations ?? 30;
  const R = p.ringPoints ?? 12;
  const inset = p.inset ?? 1;
  const topTrim = p.topTrim ?? 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const sec = hullSection(t, p);
    const z = (0.5 - t) * p.length;
    const hw = sec.halfW * inset;
    const dr = sec.draft * inset;
    const top = sec.sheer * topTrim;
    for (let j = 0; j <= 2 * R; j++) {
      const side = j < R ? -1 : 1;
      const s = Math.abs(j - R) / R;
      const y = -dr + (dr + top) * Math.pow(s, 1.3);
      const x = side * hw * Math.pow(Math.sin((s * Math.PI) / 2), 0.7);
      pos.push(x, y, z);
      uv.push(j / (2 * R), t);
    }
  }
  const row = 2 * R + 1;
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < 2 * R; j++) {
      const a = i * row + j;
      const b = a + row;
      if (p.flip) idx.push(a, a + 1, b, a + 1, b + 1, b);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Sheer line (top edge) of one side of the hull, for rails and rope anchors. */
export function sheerLine(p: HullParams, side: number, samples = 26, inset = 1): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const sec = hullSection(t, p);
    out.push(new Vector3(side * sec.halfW * inset, sec.sheer, (0.5 - t) * p.length));
  }
  return out;
}
