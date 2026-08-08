// 小さな数学 / 補間ユーティリティ
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-6));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-6));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// イージング
export const easeInQuad = (t) => t * t;
export const easeOutQuad = (t) => t * (2 - t);
export const easeInCubic = (t) => t * t * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t, s = 1.7) =>
  1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = (t, p = 0.34) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
};
// 「重いものが抜ける」抵抗カーブ: ためて → 少し戻して → 一気に
export const easeResistThenRelease = (t) => {
  if (t < 0.42) {
    // ゆっくり張力が高まる
    return 0.10 * easeInOutSine(t / 0.42);
  }
  if (t < 0.52) {
    // 一瞬 引っかかる（わずかに沈む）
    const u = (t - 0.42) / 0.10;
    return 0.10 - 0.022 * Math.sin(u * Math.PI);
  }
  // 解放
  const u = (t - 0.52) / 0.48;
  return 0.10 + 0.90 * easeOutQuint(u);
};

// 減衰つきバネ（フレームレート非依存）
export function springStep(state, target, dt, freq = 6, damp = 0.85) {
  const w = 2 * Math.PI * freq * 0.16;
  const a = (target - state.v) * w * w - 2 * damp * w * state.vel;
  state.vel += a * dt;
  state.v += state.vel * dt;
  return state.v;
}
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// 決定的乱数
export function makeRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export const rr = (rng, a, b) => a + (b - a) * rng();
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

// 2D 値ノイズ（Canvas テクスチャ生成用）
export function makeNoise2D(seed = 7) {
  const rng = makeRng(seed);
  const size = 256;
  const perm = new Uint8Array(size * 2);
  const grad = new Float32Array(size);
  for (let i = 0; i < size; i++) { perm[i] = i; grad[i] = rng(); }
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for (let i = 0; i < size; i++) perm[i + size] = perm[i];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function noise(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = grad[perm[perm[xi] + yi] & 255];
    const ab = grad[perm[perm[xi] + yi + 1] & 255];
    const ba = grad[perm[perm[xi + 1] + yi] & 255];
    const bb = grad[perm[perm[xi + 1] + yi + 1] & 255];
    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
  };
}
export function fbm(noise, x, y, oct = 4, lac = 2.0, gain = 0.5) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}

// タイマー付き簡易トゥイーン集合
export class Tweener {
  constructor() { this.items = []; }
  add(dur, onUpdate, onDone, ease = null, delay = 0) {
    const it = { t: -delay, dur, onUpdate, onDone, ease, done: false };
    this.items.push(it);
    return it;
  }
  wait(dur, onDone) { return this.add(dur, null, onDone); }
  clear() { this.items.length = 0; }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t < 0) continue;
      const raw = it.dur <= 0 ? 1 : clamp01(it.t / it.dur);
      const k = it.ease ? it.ease(raw) : raw;
      if (it.onUpdate) it.onUpdate(k, raw);
      if (raw >= 1) {
        this.items.splice(i, 1);
        if (it.onDone) it.onDone();
      }
    }
  }
}
