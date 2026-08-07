// ============================================================================
// 防染 (resist) — 糸縛り・板締めから「染まらない場所」を生成する
//
// 縛りは、たたんだ束の中の座標 (a, b) に置かれます。
// 布を開くと、折りの対称性のぶんだけ同じ縛りが繰り返し現れます。
// だから、固定画像を選ぶのではなく、折り位置＋縛り位置から模様が生まれます。
// ============================================================================

import { clamp01, lerp, smoothstep, fbm2, valueNoise2, makeRng } from './util.js';

export const BOARD_SHAPES = ['circle', 'square', 'triangle', 'hexagon', 'star', 'diamond'];
export const BOARD_SHAPE_LABEL = {
  circle: 'まる', square: 'しかく', triangle: 'さんかく',
  hexagon: 'ろっかく', star: 'ほし', diamond: 'ひしがた'
};

export function createBinding() {
  return { ties: [], boards: [], version: 0 };
}

export function addTie(binding, a, opts = {}) {
  // 近い位置の縛りはまとめて「巻き数が増えた」ことにする
  for (const t of binding.ties) {
    if (Math.abs(t.a - a) < 0.045) {
      t.wraps = Math.min(9, t.wraps + 1);
      t.width = Math.min(0.115, t.width + 0.0125);
      t.strength = Math.min(1, t.strength + 0.07);
      binding.version++;
      return t;
    }
  }
  const t = {
    a: clamp01(a),
    width: opts.width != null ? opts.width : 0.036,
    strength: opts.strength != null ? opts.strength : 0.86,
    wraps: 1,
    seed: (Math.floor(a * 9973) * 7919 + binding.ties.length * 131) >>> 0,
    tighten: 0,      // 0→1 で締まっていくアニメ
    removed: false
  };
  binding.ties.push(t);
  binding.version++;
  return t;
}

export function addBoard(binding, a, b, shape, size, rot) {
  const bd = {
    a: clamp01(a), b: clamp01(b),
    shape: shape || 'circle',
    size: size != null ? size : 0.20,
    rot: rot || 0,
    seed: (binding.boards.length * 60013 + Math.floor(a * 7919)) >>> 0,
    clamp: 0,
    removed: false
  };
  binding.boards.push(bd);
  binding.version++;
  return bd;
}

export function activeTies(binding) { return binding.ties.filter(t => !t.removed); }
export function activeBoards(binding) { return binding.boards.filter(b => !b.removed); }
export function bindingCount(binding) {
  return activeTies(binding).length + activeBoards(binding).length;
}

// ---------------------------------------------------------------------------
// 形の距離関数（board 用）— 負なら内側
// ---------------------------------------------------------------------------

function sdShape(shape, x, y, r) {
  switch (shape) {
    case 'square': {
      const dx = Math.abs(x) - r, dy = Math.abs(y) - r;
      const ax = Math.max(dx, 0), ay = Math.max(dy, 0);
      return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0);
    }
    case 'diamond': {
      return (Math.abs(x) + Math.abs(y)) * 0.7071 - r * 0.78;
    }
    case 'triangle': {
      // 正三角形（上向き）
      const k = Math.sqrt(3);
      let px = Math.abs(x) - r, py = y + r / k;
      if (px + k * py > 0) {
        const nx = (px - k * py) * 0.5, ny = (-k * px - py) * 0.5;
        px = nx; py = ny;
      }
      px -= Math.min(Math.max(px, -2 * r), 0);
      return -Math.hypot(px, py) * Math.sign(py);
    }
    case 'hexagon': {
      const kx = -0.8660254, ky = 0.5, kz = 0.5773503;
      let px = Math.abs(x), py = Math.abs(y);
      const d = 2 * Math.min(0, kx * px + ky * py);
      px -= d * kx; py -= d * ky;
      px -= Math.min(Math.max(px, -kz * r), kz * r);
      py -= r;
      return Math.hypot(px, py) * (py < 0 ? -1 : 1);
    }
    case 'star': {
      const a = Math.atan2(y, x);
      const rr = Math.hypot(x, y);
      const spikes = 5;
      const mod = 0.68 + 0.32 * Math.cos(spikes * a);
      return rr - r * mod;
    }
    case 'circle':
    default:
      return Math.hypot(x, y) - r;
  }
}

// ---------------------------------------------------------------------------
// footprint のキャッシュ（テクスチャ解像度ぶん）
// ---------------------------------------------------------------------------

export function buildFootprintMap(fold, res) {
  const n = res * res;
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  const BU = new Float32Array(n);
  const out = { a: 0, b: 0, burial: 0 };
  let p = 0;
  for (let j = 0; j < res; j++) {
    const v = (j + 0.5) / res;
    for (let i = 0; i < res; i++, p++) {
      const u = (i + 0.5) / res;
      fold.footprint(u, v, out);
      A[p] = out.a; B[p] = out.b; BU[p] = out.burial;
    }
  }
  return { res, A, B, BU };
}

// ---------------------------------------------------------------------------
// 防染マップの焼き込み
//  R = 防染量, G = 埋まり具合, B = 染めむらノイズ, A = 255
// ---------------------------------------------------------------------------

export function bakeResist(fold, binding, fmap, target) {
  const res = fmap.res;
  const n = res * res;
  const data = target && target.length === n * 4 ? target : new Uint8Array(n * 4);
  const ties = activeTies(binding);
  const boards = activeBoards(binding);
  const family = fold.family;
  const wobbleScale = family === 'pinch' ? 9 : 13;

  for (let p = 0; p < n; p++) {
    const a0 = fmap.A[p], b0 = fmap.B[p], bu = fmap.BU[p];
    const tu = (p % res) / res, tv = ((p / res) | 0) / res;

    // 染液のにじみ（毛細管現象）で境界をゆらす
    const wob = (fbm2(a0 * wobbleScale + 3.1, b0 * wobbleScale + 7.7, 3) - 0.5);
    let a = a0 + wob * 0.014 + (valueNoise2(a0 * 47 + 5.5, b0 * 47 + 8.1) - 0.5) * 0.006;
    let b = b0 + (fbm2(b0 * 13 + 19.3, a0 * 13 + 2.5, 2) - 0.5) * 0.018;

    // 巻き上げは締めたときに布がしわしわに寄る → すじが波打つ
    if (family === 'roll') a += 0.022 * Math.sin(b0 * 21.0 + a0 * 5.0);

    let r = 0;

    for (let i = 0; i < ties.length; i++) {
      const t = ties[i];
      const w = t.width * lerp(0.55, 1.0, t.tighten);
      if (w <= 0) continue;
      const d = Math.abs(a - t.a);
      if (d > w * 2.2) continue;
      let v = smoothstep(w, w * 0.82, d) * t.strength * lerp(0.35, 1, t.tighten);
      // 巻き数が多いほど、糸のあいだに細い染めすじが残る
      if (t.wraps > 2) {
        const rip = 0.5 + 0.5 * Math.cos((a - t.a) / (w + 1e-6) * Math.PI * (t.wraps - 1));
        v *= lerp(1, 0.72 + 0.28 * rip, 0.45);
      }
      if (v > r) r = v;
    }

    for (let i = 0; i < boards.length; i++) {
      const bd = boards[i];
      const ca = Math.cos(bd.rot), sa = Math.sin(bd.rot);
      const dx0 = (a - bd.a), dy0 = (b - bd.b);
      const dx = dx0 * ca - dy0 * sa, dy = dx0 * sa + dy0 * ca;
      const sd = sdShape(bd.shape, dx, dy, bd.size);
      if (sd > bd.size * 0.9) continue;
      const feather = 0.006 + 0.02 * (1 - bd.clamp);
      let v = smoothstep(feather, -feather * 0.5, sd) * lerp(0.25, 0.97, bd.clamp);
      if (v > r) r = v;
    }

    // 奥に埋まっているところほど、染液がとどきにくい＝防染が効く
    r *= lerp(0.86, 1.0, bu);
    r = clamp01(r);

    const mura = fbm2(tu * 7.0 + 41.0, tv * 7.0 + 13.0, 3);
    const q = p * 4;
    data[q] = (r * 255) | 0;
    data[q + 1] = (bu * 255) | 0;
    data[q + 2] = (mura * 255) | 0;
    data[q + 3] = 255;
  }
  return data;
}

// ---------------------------------------------------------------------------
// 模様の見立て（点数ではなく「なにが出たか」を伝えるための名前）
// ---------------------------------------------------------------------------

const PATTERNS = {
  plain: { name: 'あいいろ むじ', note: 'そらの ふかい あお。' },
  stripe: { name: 'しま もよう', note: 'おりめの かずだけ すじが でたよ。' },
  fineStripe: { name: 'こまかい しま', note: 'いとを たくさん まいたから、すじが ふえた。' },
  lattice: { name: 'こうし もよう', note: 'たてと よこが かさなった。' },
  checker: { name: 'いちまつ もよう', note: 'しかくが ならんだ。' },
  starRing: { name: 'ほしの わ', note: 'さんかくおりが ほしを つくった。' },
  snow: { name: 'せっか もよう', note: 'ゆきの けっしょうみたい。' },
  mountain: { name: 'やまなみ もよう', note: 'やまが ならんで みえる。' },
  window: { name: 'まどわく もよう', note: 'しかくい まどが ひらいた。' },
  firework: { name: 'はなび もよう', note: 'ぱっと ひらいた はなび。' },
  bigCircle: { name: 'おおきな まる', note: 'まんなかが まっしろ。' },
  ripple: { name: 'なみの わ', note: 'みずの わっかが ひろがった。' },
  spider: { name: 'くもの す', note: 'ほそい いとが たくさん。' },
  sun: { name: 'たいよう もよう', note: 'まんなかから ひかりが でてる。' },
  storm: { name: 'あらしの すじ', note: 'ななめの あめの ように。' },
  bamboo: { name: 'たけの ふし', note: 'たけの ふしみたいに ならんだ。' },
  wave: { name: 'なみがしら もよう', note: 'なみが うねっている。' },
  mystery: { name: 'まぼろし もよう', note: 'いとと いたが まざった、めずらしい かたち。' }
};

export function analysePattern(fold, binding) {
  // ほどいたあとに呼ばれても模様は変わらないので、外した縛りも数に入れる
  const ties = binding.ties.length;
  const boards = binding.boards;
  const nb = boards.length;
  const fam = fold.family;
  let key = 'plain';

  if (ties === 0 && nb === 0) key = 'plain';
  else if (ties > 0 && nb > 0) key = 'mystery';
  else if (fam === 'accordion') {
    if (nb > 0) key = 'checker';
    else if (fold.params.panels2) key = 'lattice';
    else key = ties >= 4 ? 'fineStripe' : 'stripe';
  } else if (fam === 'triangle') {
    if (nb > 0) {
      const s = boards[0].shape;
      key = s === 'circle' ? 'snow'
        : s === 'triangle' ? 'mountain'
          : s === 'square' || s === 'diamond' ? 'window'
            : 'firework';
    } else key = 'starRing';
  } else if (fam === 'pinch') {
    if (nb > 0) key = 'sun';
    else key = ties <= 1 ? 'bigCircle' : (ties <= 3 ? 'ripple' : 'spider');
  } else if (fam === 'roll') {
    if (nb > 0) key = 'wave';
    else key = ties <= 2 ? 'storm' : 'bamboo';
  } else {
    key = ties + nb > 0 ? 'mystery' : 'plain';
  }

  const P = PATTERNS[key] || PATTERNS.plain;
  return { key, name: P.name, note: P.note };
}

export const PATTERN_COUNT = Object.keys(PATTERNS).length;
