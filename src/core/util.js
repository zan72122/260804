// 小さな数学 / 補間 / トゥイーンのユーティリティ
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a, b, v) => {
  const t = clamp(invLerp(a, b, v), 0, 1);
  return t * t * (3 - 2 * t);
};
// フレームレート非依存の指数減衰補間
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
export const easeOutBounce = (t) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

const _tweens = [];
/**
 * 汎用トゥイーン。onUpdate(v, t) が毎フレーム呼ばれる。
 * 戻り値の Promise は完了で解決する（cancel された場合も解決する）。
 */
export function tween(opts) {
  const t = {
    from: opts.from ?? 0,
    to: opts.to ?? 1,
    dur: Math.max(0.0001, opts.dur ?? 0.4),
    delay: opts.delay ?? 0,
    ease: opts.ease ?? easeOutCubic,
    onUpdate: opts.onUpdate,
    onDone: opts.onDone,
    time: 0,
    dead: false,
    resolve: null,
  };
  const p = new Promise((res) => (t.resolve = res));
  p.cancel = () => { t.dead = true; t.resolve && t.resolve(); };
  _tweens.push(t);
  return p;
}
export function updateTweens(dt) {
  for (let i = _tweens.length - 1; i >= 0; i--) {
    const t = _tweens[i];
    if (t.dead) { _tweens.splice(i, 1); continue; }
    t.time += dt;
    if (t.time < t.delay) continue;
    const raw = clamp((t.time - t.delay) / t.dur, 0, 1);
    const e = t.ease(raw);
    const v = lerp(t.from, t.to, e);
    if (t.onUpdate) t.onUpdate(v, e, raw);
    if (raw >= 1) {
      t.dead = true;
      _tweens.splice(i, 1);
      if (t.onDone) t.onDone();
      t.resolve && t.resolve();
    }
  }
}
export function wait(sec) {
  return tween({ dur: Math.max(0.0001, sec) });
}
export function clearTweens() {
  for (const t of _tweens) { t.dead = true; t.resolve && t.resolve(); }
  _tweens.length = 0;
}

// 決定的な擬似乱数（木目などの再現性のため）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
