import { mulberry32 } from "./rng";

export interface Vec { x: number; y: number; }

/**
 * A crack lives in part-space unit coordinates (part face = unit circle).
 * `polys` is one main polyline plus optional short branches.
 * Parallel arrays `accum` (particle build-up from the bath, 0..1) and
 * `reveal` (UV exposure, 0..1) mirror the polyline structure.
 */
export interface Crack {
  polys: Vec[][];
  /** per-point tangent angle, radians, mirrors polys */
  tang: number[][];
  /** which magnetization pass makes this crack detectable */
  pass: 1 | 2;
  accum: number[][];
  reveal: number[][];
  recorded: boolean;
}

/** Flux direction (radians) for a yoke angle in degrees. Pass 1 yoke = poles left/right = horizontal flux. */
export function fluxAngleForYoke(yokeDeg: number): number {
  return (yokeDeg * Math.PI) / 180;
}

/**
 * How strongly leakage flux attracts particles at a crack point.
 * Cracks perpendicular to the flux leak the most: sin^2 of the angle
 * between the crack tangent and the flux direction.
 */
export function detectability(tangent: number, fluxAngle: number): number {
  const s = Math.sin(tangent - fluxAngle);
  return s * s;
}

function samplePoly(
  rnd: () => number,
  cx: number, cy: number,
  angle: number, len: number, bend: number, n: number
): Vec[] {
  // quadratic bezier from start to end, control offset perpendicular by `bend`
  const hx = (Math.cos(angle) * len) / 2;
  const hy = (Math.sin(angle) * len) / 2;
  const px = -Math.sin(angle) * bend;
  const py = Math.cos(angle) * bend;
  const p0 = { x: cx - hx, y: cy - hy };
  const p2 = { x: cx + hx, y: cy + hy };
  const p1 = { x: cx + px, y: cy + py };
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    const jx = (rnd() - 0.5) * 0.012;
    const jy = (rnd() - 0.5) * 0.012;
    pts.push({
      x: a * p0.x + b * p1.x + c * p2.x + jx,
      y: a * p0.y + b * p1.y + c * p2.y + jy
    });
  }
  return pts;
}

function tangents(poly: Vec[]): number[] {
  return poly.map((_, i) => {
    const a = poly[Math.max(0, i - 1)];
    const b = poly[Math.min(poly.length - 1, i + 1)];
    return Math.atan2(b.y - a.y, b.x - a.x);
  });
}

function clampIntoFace(polys: Vec[][], maxR: number): void {
  let worst = 0;
  for (const poly of polys) {
    for (const p of poly) {
      worst = Math.max(worst, Math.hypot(p.x, p.y));
    }
  }
  if (worst > maxR) {
    const k = maxR / worst;
    for (const poly of polys) {
      for (const p of poly) { p.x *= k; p.y *= k; }
    }
  }
}

function makeCrack(
  rnd: () => number,
  pass: 1 | 2,
  baseAngle: number,
  center: Vec,
  withBranch: boolean
): Crack {
  const len = 0.62 + rnd() * 0.22;
  const bend = (rnd() - 0.5) * 0.5;
  const main = samplePoly(rnd, center.x, center.y, baseAngle, len, bend, 26);
  const polys = [main];
  if (withBranch) {
    const i = 8 + Math.floor(rnd() * 8);
    const at = main[i];
    const dir = baseAngle + (rnd() < 0.5 ? 1 : -1) * (0.5 + rnd() * 0.4);
    const bl = 0.16 + rnd() * 0.1;
    const branch = samplePoly(
      rnd,
      at.x + (Math.cos(dir) * bl) / 2,
      at.y + (Math.sin(dir) * bl) / 2,
      dir, bl, (rnd() - 0.5) * 0.08, 8
    );
    polys.push(branch);
  }
  clampIntoFace(polys, 0.62);
  return {
    polys,
    tang: polys.map(tangents),
    pass,
    accum: polys.map((p) => p.map(() => 0)),
    reveal: polys.map((p) => p.map(() => 0)),
    recorded: false
  };
}

/**
 * Vertical slice: exactly two cracks.
 * Crack A: roughly vertical -> detected by horizontal flux (yoke at 0 deg, pass 1).
 * Crack B: roughly horizontal with a slight tilt and a small branch ->
 * nearly invisible in pass 1, clearly detected after the 90 deg rotation.
 */
export function generateCracks(seed: number): Crack[] {
  const rnd = mulberry32(seed);
  const aAngle = Math.PI / 2 + (rnd() - 0.5) * 0.55;
  const aCenter = { x: -0.18 - rnd() * 0.22, y: (rnd() - 0.5) * 0.4 };
  const a = makeCrack(rnd, 1, aAngle, aCenter, false);

  const tilt = (0.28 + rnd() * 0.14) * (rnd() < 0.5 ? 1 : -1);
  const bCenter = { x: 0.2 + rnd() * 0.18, y: (rnd() - 0.5) * 0.36 };
  const b = makeCrack(rnd, 2, tilt, bCenter, true);
  return [a, b];
}

/** Mean accumulation of a crack (how much powder has gathered). */
export function meanAccum(c: Crack): number {
  let s = 0, n = 0;
  for (const arr of c.accum) for (const v of arr) { s += v; n++; }
  return n ? s / n : 0;
}

/** Accum-weighted mean reveal (how much of the indication the UV has grown). */
export function meanReveal(c: Crack): number {
  let s = 0, w = 0;
  for (let pi = 0; pi < c.polys.length; pi++) {
    for (let i = 0; i < c.polys[pi].length; i++) {
      const a = c.accum[pi][i];
      s += a * c.reveal[pi][i];
      w += a;
    }
  }
  return w > 0.001 ? s / w : 0;
}
