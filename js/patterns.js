// Motifs. Deliberately big, round and forgiving — a four year old traces a
// whole petal in one sweep of the finger.
//
// These are simplified, child-sized shapes drawn in the *spirit* of Javanese
// and Cirebon batik families (flowers, clouds, water, birds, stars). They are
// not reproductions of specific ceremonial patterns such as parang or kawung,
// which carry court and family meaning; see docs/culture.md.
//
// Each motif is split into two waxing rounds, and that split is the game:
//   round 1 seals what stays WHITE
//   round 2 seals what stays INDIGO
//   whatever was never sealed ends up SOGA BROWN

const TAU = Math.PI * 2;

function arc(cx, cy, r, a0, a1, steps = 24, squash = 1) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash]);
  }
  return pts;
}

function circle(cx, cy, r, steps = 32) { return arc(cx, cy, r, 0, TAU, steps); }

// A fat teardrop petal pointing along `ang`.
function petal(cx, cy, ang, len, wide) {
  const pts = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    // Teardrop in local space: out along +x on the way up, back on the way down.
    const x = len * (1 - Math.cos(a)) * 0.5;
    const y = wide * Math.sin(a) * (1 - x / (len * 1.25));
    const s = Math.sin(ang), c = Math.cos(ang);
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

function scallop(cx, cy, r, a0, a1, bumps, amp) {
  const pts = [];
  const steps = bumps * 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    const rr = r + Math.sin(t * TAU * bumps) * amp;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

function waveLine(y, amp, cycles, phase, x0 = 0.06, x1 = 0.94) {
  const pts = [];
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    pts.push([x, y + Math.sin(t * TAU * cycles + phase) * amp]);
  }
  return pts;
}

function starOutline(cx, cy, rOuter, rInner, points) {
  const pts = [];
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function bird(cx, cy, s) {
  const body = [
    [cx - 0.9 * s, cy - 0.05 * s], [cx - 0.5 * s, cy - 0.28 * s], [cx + 0.1 * s, cy - 0.30 * s],
    [cx + 0.55 * s, cy - 0.10 * s], [cx + 0.80 * s, cy + 0.18 * s], [cx + 0.62 * s, cy + 0.22 * s],
    [cx + 0.30 * s, cy + 0.10 * s], [cx - 0.20 * s, cy + 0.26 * s], [cx - 0.72 * s, cy + 0.30 * s],
    [cx - 0.95 * s, cy + 0.10 * s], [cx - 0.9 * s, cy - 0.05 * s],
  ];
  const wing = [
    [cx - 0.35 * s, cy + 0.02 * s], [cx - 0.05 * s, cy + 0.32 * s],
    [cx + 0.30 * s, cy + 0.30 * s], [cx + 0.34 * s, cy + 0.10 * s],
  ];
  return [body, wing];
}

export const PATTERNS = [
  {
    id: 'flower',
    label: 'おおきな はな',
    hint: 'sekar — flower',
    emoji: '🌸',
    note: 'Flower (sekar) motifs are one of the most common families in Javanese batik.',
    build() {
      const s1 = [];
      for (let i = 0; i < 6; i++) {
        s1.push(petal(0.5, 0.5, (i / 6) * TAU, 0.40, 0.155));
      }
      s1.push(circle(0.5, 0.5, 0.085, 28));
      const s2 = [circle(0.5, 0.5, 0.155, 32)];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + TAU / 12;
        s2.push(petal(0.5, 0.5, a, 0.26, 0.085));
      }
      s2.push(circle(0.5, 0.5, 0.455, 44));
      return { stage1: s1, stage2: s2 };
    },
  },
  {
    id: 'cloud',
    label: 'もくもく くも',
    hint: 'mendung — cloud',
    emoji: '☁️',
    note: 'Cloud motifs in the Cirebon tradition (mega mendung) are built from '
      + 'layered, rounded banks of cloud and stand for calm and patience.',
    build() {
      const s1 = [];
      for (let k = 0; k < 3; k++) {
        const r = 0.20 + k * 0.105;
        s1.push(scallop(0.5, 0.36, r, Math.PI * 0.06, Math.PI * 0.94, 4 + k, 0.030));
      }
      s1.push([[0.09, 0.335], [0.91, 0.335]]);
      const s2 = [];
      s2.push(scallop(0.5, 0.36, 0.135, Math.PI * 0.05, Math.PI * 0.95, 3, 0.024));
      s2.push(scallop(0.5, 0.20, 0.135, Math.PI * 1.05, Math.PI * 1.95, 3, 0.024));
      s2.push(scallop(0.5, 0.22, 0.245, Math.PI * 1.08, Math.PI * 1.92, 4, 0.028));
      return { stage1: s1, stage2: s2 };
    },
  },
  {
    id: 'wave',
    label: 'なみ と とり',
    hint: 'banyu — water & bird',
    emoji: '🌊',
    note: 'Water and bird motifs appear across many coastal (pesisir) batik styles.',
    build() {
      const s1 = [
        waveLine(0.24, 0.075, 2.0, 0),
        waveLine(0.40, 0.075, 2.0, Math.PI),
        waveLine(0.56, 0.075, 2.0, 0),
      ];
      const s2 = [
        ...bird(0.5, 0.79, 0.30),
        waveLine(0.32, 0.055, 2.0, Math.PI * 0.5, 0.12, 0.88),
        waveLine(0.48, 0.055, 2.0, Math.PI * 1.5, 0.12, 0.88),
      ];
      return { stage1: s1, stage2: s2 };
    },
  },
  {
    id: 'star',
    label: 'ほし と は',
    hint: 'lintang — star & leaf',
    emoji: '⭐',
    note: 'Star and leaf shapes are common filler (isen) motifs in many regional batiks.',
    build() {
      const s1 = [starOutline(0.5, 0.54, 0.36, 0.165, 6)];
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i / 4) * TAU;
        s1.push(petal(0.5 + Math.cos(a) * 0.30, 0.54 + Math.sin(a) * 0.30, a, 0.16, 0.06));
      }
      const s2 = [starOutline(0.5, 0.54, 0.185, 0.085, 6), circle(0.5, 0.54, 0.065, 24)];
      s2.push(circle(0.5, 0.54, 0.44, 44));
      return { stage1: s1, stage2: s2 };
    },
  },
  {
    id: 'free',
    label: 'じゆうに かく',
    hint: 'free drawing',
    emoji: '✋',
    note: 'No guide at all — the cloth is blank and every line is the child\'s own.',
    free: true,
    build() { return { stage1: [], stage2: [] }; },
  },
];

export function getPattern(id) {
  return PATTERNS.find((p) => p.id === id) || PATTERNS[0];
}

// Nearest point on a set of polylines — used to pull a wobbly finger onto the
// guide so a four year old's line always looks intentional.
export function snapToGuide(u, v, polylines, maxDist) {
  let bestD = Infinity, bx = u, by = v;
  for (const line of polylines) {
    for (let i = 0; i < line.length - 1; i++) {
      const ax = line[i][0], ay = line[i][1];
      const cx = line[i + 1][0], cy = line[i + 1][1];
      const dx = cx - ax, dy = cy - ay;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((u - ax) * dx + (v - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t, py = ay + dy * t;
      const d = Math.hypot(u - px, v - py);
      if (d < bestD) { bestD = d; bx = px; by = py; }
    }
  }
  if (bestD > maxDist) return null;
  return { x: bx, y: by, dist: bestD };
}

// Evenly spaced checkpoints along the guide, so we can tell how much of the
// motif has been waxed without reading pixels back from the GPU.
export function sampleGuide(polylines, spacing = 0.02) {
  const pts = [];
  for (const line of polylines) {
    let carry = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const ax = line[i][0], ay = line[i][1];
      const bx = line[i + 1][0], by = line[i + 1][1];
      const len = Math.hypot(bx - ax, by - ay);
      let d = carry;
      while (d < len) {
        const t = d / (len || 1);
        pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, hit: false });
        d += spacing;
      }
      carry = d - len;
    }
  }
  return pts;
}
