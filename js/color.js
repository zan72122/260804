/* Rainbow Glass Tower — tint math.
   A colour is {h, c}: hue in degrees (0..360), chroma/purity in 0..1.
   c === 0 means pure white base (milk) — h is meaningless at c === 0. */
'use strict';

window.Tint = (function () {
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function norm360(h) {
    h = h % 360;
    return h < 0 ? h + 360 : h;
  }

  function clamp01(x) {
    return x < 0 ? 0 : (x > 1 ? 1 : x);
  }

  function make(h, c) {
    h = Number(h); c = Number(c);
    if (!isFinite(h)) h = 0;
    if (!isFinite(c)) c = 0;
    return { h: norm360(h), c: clamp01(c) };
  }

  const WHITE = Object.freeze(make(0, 0));

  // Shortest angular distance between two hues, 0..180.
  function hueArc(h1, h2) {
    const d = Math.abs(norm360(h1) - norm360(h2)) % 360;
    return d > 180 ? 360 - d : d;
  }

  // Chroma-cancellation factor, applied on top of the plain chroma average.
  // 1.0 (no cancellation) for any arc up to ~150 degrees — every "obvious"
  // mix a child would try (red+blue, pink+blue, yellow+green, ...) stays
  // vivid — then eases down to 0 by exactly 180 degrees, so only a genuine
  // complementary pair (contract rule 4) fades all the way to pearly white.
  // Smoothstep gives a gentle start (e.g. red+blue at a 155 degree arc keeps
  // ~93% of its chroma) and its steepest drop near the far end.
  function cancelFactor(arc) {
    if (arc <= 150) return 1;
    if (arc >= 180) return 0;
    const t = (arc - 150) / 30;
    return 1 - t * t * (3 - 2 * t);
  }

  // Volume-weighted mix.
  // Hue is blended as a 2D vector on the unit circle, each side weighted by
  // its own c*volume ("colour mass") — a colourless side contributes zero
  // hue-weight, so it can never drag the hue, and the vector sum naturally
  // lands on the shorter arc between the two hues.
  // Chroma is *decoupled* from that vector's magnitude (which collapses for
  // any wide-ish arc, not just true complements) and instead computed as a
  // plain volume-weighted average of the two chromas, then scaled by
  // `cancelFactor`. The factor only ever engages when both sides actually
  // carry colour (so diluting with white never triggers it) and only bites
  // once the hues are genuinely far apart — this is what keeps mixing free
  // of brown/grey: colour only ever moves toward another hue on the shorter
  // arc, or drains straight toward white, and a child's "obvious" mixes
  // (like red + blue -> purple) stay vivid instead of washing out.
  function mix(a, va, b, vb) {
    va = Math.max(0, Number(va) || 0);
    vb = Math.max(0, Number(vb) || 0);
    if (va <= 0 && vb <= 0) return make(WHITE.h, WHITE.c);
    if (va <= 0) return make(b.h, b.c);
    if (vb <= 0) return make(a.h, a.c);

    const total = va + vb;
    const ca = clamp01(a.c);
    const cb = clamp01(b.c);
    const wa = ca * va;
    const wb = cb * vb;

    const vx = wa * Math.cos(a.h * DEG2RAD) + wb * Math.cos(b.h * DEG2RAD);
    const vy = wa * Math.sin(a.h * DEG2RAD) + wb * Math.sin(b.h * DEG2RAD);
    const r = Math.hypot(vx, vy);
    const h = r > 1e-6 ? norm360(Math.atan2(vy, vx) * RAD2DEG) : 0;

    const cAvg = (ca * va + cb * vb) / total;
    const factor = (wa > 1e-9 && wb > 1e-9) ? cancelFactor(hueArc(a.h, b.h)) : 1;
    const c = clamp01(cAvg * factor);

    return { h, c };
  }

  // Tolerance-based equality via the same quantisation used for the cache
  // key, so "equal" and "shares a cached sprite" always agree.
  function equal(a, b) {
    return key(a) === key(b);
  }

  // 24 hue buckets x 8 chroma buckets. Any tint whose chroma rounds down to
  // bucket 0 collapses to the single "h0c0" white key, regardless of hue.
  function key(t) {
    const cBucket = Math.round(clamp01(t.c) * 7);
    if (cBucket === 0) return 'h0c0';
    const hBucket = Math.round(norm360(t.h) / 360 * 24) % 24;
    return 'h' + hBucket + 'c' + cBucket;
  }

  // hsl(H S% L%) — space-separated, no commas. White stays a near-neutral,
  // bright pearl (a whisper of cool blue-lavender) rather than a warm
  // khaki/tan cast, so the white swatch reads as "milk", not a muddy 7th
  // colour among the candy-bright ones.
  function css(t, l) {
    const cc = clamp01(t.c);
    const ll = Math.round(clamp01(l) * 100);
    if (cc <= 0.02) return `hsl(216 14% ${ll}%)`;
    const hh = Math.round(norm360(t.h));
    const ss = Math.round(55 + cc * 40); // always candy-bright, 55-95%
    return `hsl(${hh} ${ss}% ${ll}%)`;
  }

  // Top-to-bottom gradient stops for a bowl of this tint. Coloured drinks
  // sweep from a near-white sparkle at the rim down to a deep candy pool.
  // White gets its own curve: a faint cool pearl sheen (icy white -> soft
  // pink -> blue-white -> lavender -> cool blue-grey shadow) that stays
  // near-neutral top to bottom — never dipping into warm tan/khaki — so a
  // thinly-filled glass (which only shows the bottom-most stops) still
  // reads as pearlescent milk, not a beige puddle.
  function cssStops(t) {
    const cc = clamp01(t.c);
    if (cc <= 0.02) {
      return [
        'hsl(200 28% 97%)',
        'hsl(320 16% 93%)',
        'hsl(212 18% 88%)',
        'hsl(255 12% 80%)',
        'hsl(220 13% 71%)',
      ];
    }
    const h = Math.round(norm360(t.h));
    const s = Math.round(55 + cc * 40);
    const rows = [
      [h, Math.min(100, s + 8), 91],
      [h, s, 79],
      [h, s, 63],
      [h, Math.min(100, s + 5), 47],
      [h, Math.min(100, s + 10), 33],
    ];
    return rows.map(([hh, ss, ll]) => `hsl(${hh} ${ss}% ${ll}%)`);
  }

  const PALETTE = [
    { id: 'white', h: 0, c: 0 },
    { id: 'pink', h: 340, c: 1 },
    { id: 'orange', h: 32, c: 1 },
    { id: 'yellow', h: 52, c: 1 },
    { id: 'green', h: 140, c: 1 },
    { id: 'blue', h: 205, c: 1 },
    { id: 'purple', h: 275, c: 1 },
  ];

  return { WHITE, make, mix, equal, key, css, cssStops, PALETTE };
})();
