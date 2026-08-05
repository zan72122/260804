// 小さな計算ヘルパー
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
// フレームレートに依存しない補間
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 決定的なハッシュノイズ（見た目の再現性用）
export function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

// ばね（減衰つき）。止めたあとに余韻が残る動きに使う。
export class Spring {
  constructor(value = 0, { stiffness = 40, damping = 6 } = {}) {
    this.value = value;
    this.target = value;
    this.vel = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  set(v) { this.value = v; this.target = v; this.vel = 0; }
  kick(v) { this.vel += v; }
  step(dt) {
    const steps = Math.max(1, Math.min(4, Math.ceil(dt / 0.012)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = (this.target - this.value) * this.stiffness - this.vel * this.damping;
      this.vel += a * h;
      this.value += this.vel * h;
    }
    return this.value;
  }
}

// 1次元の遅れ（下のほうがゆっくり付いてくる、みたいな表現に）
export class Lag {
  constructor(value = 0, rate = 6) { this.value = value; this.rate = rate; }
  step(target, dt) {
    this.value = damp(this.value, target, this.rate, dt);
    return this.value;
  }
}

export function fmtHexLerp(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((lerp(ar, br, t) | 0) << 16) | ((lerp(ag, bg, t) | 0) << 8) | (lerp(ab, bb, t) | 0);
}
