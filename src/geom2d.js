// Small 2-D polygon toolkit used by the pattern / cutting / sewing code.
// Points are plain {x, y} objects in "pattern space" (y is up).

export function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function lerp2(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Cubic bezier sampled into `steps` points (the start point is not emitted).
export function bezier(p0, c0, c1, p1, steps) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push({
      x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
      y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
    });
  }
  return out;
}

/**
 * Builds one half of a symmetric garment outline, then mirrors it.
 * Every segment carries a `seam` flag: `false` marks the opening that is
 * left unstitched so the garment can be turned right side out.
 */
export class HalfOutline {
  constructor(start) {
    this.pts = [{ ...start }];
    this.seam = [];           // seam[i] describes the edge pts[i] -> pts[i+1]
  }
  get last() { return this.pts[this.pts.length - 1]; }

  line(to, seam = true, steps = 6) {
    const from = this.last;
    for (let i = 1; i <= steps; i++) {
      this.pts.push(lerp2(from, to, i / steps));
      this.seam.push(seam);
    }
    return this;
  }

  curve(c0, c1, to, seam = true, steps = 14) {
    const from = this.last;
    for (const p of bezier(from, c0, c1, to, steps)) {
      this.pts.push(p);
      this.seam.push(seam);
    }
    return this;
  }

  /**
   * Mirrors the half around x = 0 and returns the closed outline.
   * Returns { pts, seam, openCount } where `openCount` is the number of
   * leading points that belong to the opening (the turning gap).
   */
  close() {
    const half = this.pts;
    const halfSeam = this.seam;
    const pts = half.map((p) => ({ ...p }));
    const seam = halfSeam.slice();
    // mirror, skipping the shared first/last points on the centre line
    for (let i = half.length - 2; i >= 1; i--) {
      pts.push({ x: -half[i].x, y: half[i].y });
      seam.push(halfSeam[i]);
    }
    seam.push(halfSeam[0]);         // the closing edge, back to the start point
    let openCount = 0;
    while (openCount < halfSeam.length && !halfSeam[openCount]) openCount++;
    return { pts, seam, openCount };
  }
}


/** Even-odd point-in-polygon test. */
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y)) {
      const x = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (p.x < x) inside = !inside;
    }
  }
  return inside;
}

function closestOnSegment(p, a, b, out) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 1e-12 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  out.x = a.x + abx * t;
  out.y = a.y + aby * t;
  out.t = t;
  return out;
}

const _tmp = { x: 0, y: 0, t: 0 };

/** Closest point on a closed polygon. Returns { x, y, dist, index, t }. */
export function closestOnPolygon(p, poly) {
  let best = { x: poly[0].x, y: poly[0].y, dist: Infinity, index: 0, t: 0 };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    closestOnSegment(p, a, b, _tmp);
    const dx = p.x - _tmp.x, dy = p.y - _tmp.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < best.dist) { best.x = _tmp.x; best.y = _tmp.y; best.dist = d; best.index = i; best.t = _tmp.t; }
  }
  return best;
}

/** Signed-ish distance: distance to the boundary (always positive). */
export function distanceToBoundary(p, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    closestOnSegment(p, a, b, _tmp);
    const dx = p.x - _tmp.x, dy = p.y - _tmp.y;
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/**
 * An arc-length parameterised path with a forgiving "follow the finger"
 * head. Used identically for tracing, cutting and sewing.
 */
export class PathTrack {
  constructor(pts, closed) {
    this.pts = pts;
    this.closed = closed;
    this.cum = [0];
    const n = pts.length;
    const end = closed ? n : n - 1;
    let L = 0;
    for (let i = 0; i < end; i++) {
      L += dist2(pts[i], pts[(i + 1) % n]);
      this.cum.push(L);
    }
    this.length = L;
  }

  /** Point at normalised arc position s in [0,1]. */
  at(s, out = { x: 0, y: 0 }) {
    const target = Math.max(0, Math.min(1, s)) * this.length;
    const cum = this.cum;
    let lo = 0, hi = cum.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid; else hi = mid;
    }
    const segLen = cum[lo + 1] - cum[lo];
    const t = segLen > 1e-9 ? (target - cum[lo]) / segLen : 0;
    const a = this.pts[lo % this.pts.length];
    const b = this.pts[(lo + 1) % this.pts.length];
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
  }

  /** Unit tangent at normalised arc position s. */
  tangent(s, out = { x: 0, y: 0 }) {
    const h = 0.004;
    const a = this.at(Math.max(0, s - h), { x: 0, y: 0 });
    const b = this.at(Math.min(1, s + h), { x: 0, y: 0 });
    let dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    out.x = dx / L; out.y = dy / L;
    return out;
  }

  /**
   * Finds the arc position nearest `p`, searching only a window ahead of
   * (and slightly behind) `from`. Returns { s, dist }.
   */
  search(p, from, back = 0.03, ahead = 0.13, samples = 46) {
    const lo = Math.max(0, from - back);
    const hi = Math.min(1, from + ahead);
    let bestS = from, bestD = Infinity;
    const probe = { x: 0, y: 0 };
    for (let i = 0; i <= samples; i++) {
      const s = lo + ((hi - lo) * i) / samples;
      this.at(s, probe);
      const d = Math.hypot(p.x - probe.x, p.y - probe.y);
      if (d < bestD) { bestD = d; bestS = s; }
    }
    return { s: bestS, dist: bestD };
  }
}

/**
 * Pushes a run of outline points a little way inside the shape — the seam
 * allowance the stitches sit on.
 */
export function insetPath(pts, poly, amount) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const L = Math.hypot(tx, ty) || 1;
    tx /= L; ty /= L;
    let nx = -ty, ny = tx;
    const probe = { x: pts[i].x + nx * 0.01, y: pts[i].y + ny * 0.01 };
    if (!pointInPolygon(probe, poly)) { nx = -nx; ny = -ny; }
    out.push({ x: pts[i].x + nx * amount, y: pts[i].y + ny * amount });
  }
  return out;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
export function easeOutElastic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
}
