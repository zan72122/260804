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

  // Volume-weighted mix. Hue is blended as a 2D vector on the unit circle,
  // each side weighted by its own c*volume ("colour mass") — a colourless
  // side contributes zero hue-weight, so it can never drag the hue, and two
  // near-opposite hues cancel their vectors instead of averaging to a random
  // in-between colour. The resulting chroma is that vector's length divided
  // by total volume, which is never larger than a plain weighted average of
  // the two chromas — so same-hue mixes are never diluted below what a
  // straight average would give, and c can never sneak past 1. This is what
  // keeps mixing free of brown/grey: colour only ever moves toward another
  // hue on the shorter arc, or drains straight toward white.
  function mix(a, va, b, vb) {
    va = Math.max(0, Number(va) || 0);
    vb = Math.max(0, Number(vb) || 0);
    if (va <= 0 && vb <= 0) return make(WHITE.h, WHITE.c);
    if (va <= 0) return make(b.h, b.c);
    if (vb <= 0) return make(a.h, a.c);

    const total = va + vb;
    const wa = clamp01(a.c) * va;
    const wb = clamp01(b.c) * vb;
    const vx = wa * Math.cos(a.h * DEG2RAD) + wb * Math.cos(b.h * DEG2RAD);
    const vy = wa * Math.sin(a.h * DEG2RAD) + wb * Math.sin(b.h * DEG2RAD);
    const r = Math.hypot(vx, vy);
    const c = clamp01(r / total);
    const h = r > 1e-6 ? norm360(Math.atan2(vy, vx) * RAD2DEG) : 0;
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

  // hsl(H S% L%) — space-separated, no commas. White stays a soft warm
  // cream rather than flat grey so it still reads as milk, not concrete.
  function css(t, l) {
    const cc = clamp01(t.c);
    const ll = Math.round(clamp01(l) * 100);
    if (cc <= 0.02) return `hsl(40 22% ${ll}%)`;
    const hh = Math.round(norm360(t.h));
    const ss = Math.round(55 + cc * 40); // always candy-bright, 55-95%
    return `hsl(${hh} ${ss}% ${ll}%)`;
  }

  // Top-to-bottom gradient stops for a bowl of this tint. Coloured drinks
  // sweep from a near-white sparkle at the rim down to a deep candy pool.
  // White gets its own curve: a faint multi-hue pearl sheen (cream -> pink
  // -> blue-white -> cream -> warm shadow) so it glows instead of reading
  // as flat grey milk.
  function cssStops(t) {
    const cc = clamp01(t.c);
    if (cc <= 0.02) {
      return [
        'hsl(48 40% 97%)',
        'hsl(330 20% 92%)',
        'hsl(200 16% 87%)',
        'hsl(45 14% 79%)',
        'hsl(38 12% 67%)',
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
