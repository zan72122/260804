// ---------------------------------------------------------------------------
// ステンドグラス板の割り付け生成
// 板ローカル座標 (メートル): x ∈ [-0.56, 0.56], 下端 y = -0.54,
// y = 0 から上は半径 0.56 のアーチ。
// ---------------------------------------------------------------------------
'use strict';

const PANEL = {
  hw: 0.56,       // 半幅
  bottom: -0.54,  // 下端
  archR: 0.56,    // アーチ半径 (中心 = 原点)
  thickness: 0.006,
  get top() { return this.archR; },
  get height() { return this.archR - this.bottom; },
  get uvRect() { return [-this.hw, this.bottom, this.hw * 2, this.archR - this.bottom]; },
};

// 原点から角度 θ 方向に伸ばしたときの外形までの距離
function outlineRadius(th) {
  const c = Math.cos(th), s = Math.sin(th);
  if (s >= 0) return PANEL.archR;
  let r = Infinity;
  if (Math.abs(c) > 1e-6) r = Math.min(r, PANEL.hw / Math.abs(c));
  if (Math.abs(s) > 1e-6) r = Math.min(r, -PANEL.bottom / Math.abs(s));
  return r;
}

function outlinePolygon(step) {
  const pts = [];
  const n = Math.max(48, Math.round(Math.PI * 2 / (step || 0.06)));
  for (let i = 0; i < n; i++) {
    const th = i / n * Math.PI * 2;
    const r = outlineRadius(th);
    pts.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  return pts;
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function ensureCCW(pts) {
  return signedArea(pts) < 0 ? pts.slice().reverse() : pts;
}

function circlePts(cx, cy, r, n, squashY) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (squashY || 1)]);
  }
  return pts;
}

// --- モチーフ定義 -----------------------------------------------------------
// cell: { pts, plate } plate=true は前面に重ねる小片 (プレーティング技法)

const MOTIFS = {
  hana: {
    id: 'hana', label: 'おはな',
    build() {
      const cells = [];
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + Math.PI / 2;
        const cx = Math.cos(a) * 0.175, cy = Math.sin(a) * 0.175;
        const pts = [];
        const N = 16;
        for (let i = 0; i < N; i++) {
          const t = i / N * Math.PI * 2;
          // 花弁: 半径方向に長い楕円を少しだけ先細りに
          const rr = 0.104 * (1 + 0.12 * Math.cos(t));
          const lx = Math.cos(t) * rr, ly = Math.sin(t) * 0.072;
          pts.push([cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a)]);
        }
        cells.push({ pts: ensureCCW(pts), hint: k % 2 ? 5 : 0 });
      }
      cells.push({ pts: ensureCCW(circlePts(0, 0, 0.085, 18)), hint: 1 });
      return cells;
    },
  },

  hoshi: {
    id: 'hoshi', label: 'ほし',
    build() {
      const cells = [];
      const outer = [], inner = [];
      for (let k = 0; k < 5; k++) {
        const ao = Math.PI / 2 + k * Math.PI * 2 / 5;
        const ai = ao + Math.PI / 5;
        outer.push([Math.cos(ao) * 0.29, Math.sin(ao) * 0.29]);
        inner.push([Math.cos(ai) * 0.128, Math.sin(ai) * 0.128]);
      }
      for (let k = 0; k < 5; k++) {
        const prev = inner[(k + 4) % 5];
        cells.push({ pts: ensureCCW([prev, outer[k], inner[k]]), hint: 1 });
      }
      cells.push({ pts: ensureCCW(inner.slice()), hint: 3 });
      return cells;
    },
  },

  neko: {
    id: 'neko', label: 'ねこ',
    build() {
      const cells = [];
      // 耳 (頭より先に定義。奥から手前の順で並べる)
      for (const s of [-1, 1]) {
        cells.push({
          pts: ensureCCW([
            [s * 0.055, 0.175], [s * 0.235, 0.145], [s * 0.185, 0.315],
          ]), hint: 5,
        });
      }
      cells.push({ pts: ensureCCW(circlePts(0, 0.01, 0.215, 22, 0.95)), hint: 4 });
      // 目と鼻は前面にプレーティングする小片
      for (const s of [-1, 1]) {
        cells.push({ pts: ensureCCW(circlePts(s * 0.085, 0.055, 0.045, 14)), plate: true, hint: 2 });
      }
      cells.push({
        pts: ensureCCW([[-0.045, -0.05], [0.045, -0.05], [0, -0.115]]),
        plate: true, hint: 0,
      });
      return cells;
    },
  },

  chou: {
    id: 'chou', label: 'ちょうちょ',
    build() {
      const cells = [];
      const wing = (sx, sy, cx, cy, rx, ry) => {
        const pts = [];
        const N = 18;
        for (let i = 0; i < N; i++) {
          const t = i / N * Math.PI * 2;
          const w = 1 + 0.18 * Math.cos(t * 2);
          pts.push([cx + Math.cos(t) * rx * w * sx, cy + Math.sin(t) * ry * w * sy]);
        }
        return ensureCCW(pts);
      };
      for (const s of [-1, 1]) {
        cells.push({ pts: wing(s, 1, s * 0.155, 0.115, 0.125, 0.105), hint: 3 });
        cells.push({ pts: wing(s, 1, s * 0.135, -0.115, 0.098, 0.088), hint: 5 });
      }
      cells.push({ pts: ensureCCW(circlePts(0, 0.0, 0.038, 16, 3.4)), hint: 4 });
      return cells;
    },
  },
};

const MOTIF_LIST = ['hana', 'hoshi', 'neko', 'chou'];

// --- 板全体の割り付け -------------------------------------------------------
// モチーフ + 背景 (放射状 6 分割 × 2 リング)

function buildPanelCells(motifId) {
  const cells = [];
  const R0 = 0.315;

  // 中心の円板 (モチーフの下地)。これが無いとモチーフの隙間が抜けてしまう。
  cells.push({ pts: ensureCCW(circlePts(0, 0, R0, 40)), plate: false, hint: 2, group: 'bg' });

  const SECT = 8;
  const cornerAngles = [
    Math.atan2(PANEL.bottom, PANEL.hw),
    Math.atan2(PANEL.bottom, -PANEL.hw),
  ].map((a) => (a + Math.PI * 2) % (Math.PI * 2));

  for (let s = 0; s < SECT; s++) {
    const a0 = s / SECT * Math.PI * 2 - Math.PI / 12;
    const a1 = (s + 1) / SECT * Math.PI * 2 - Math.PI / 12;
    // サンプル角度 (外形の角を必ず含める)
    const angles = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) angles.push(a0 + (a1 - a0) * i / steps);
    for (const ca of cornerAngles) {
      for (const off of [-Math.PI * 2, 0, Math.PI * 2]) {
        const a = ca + off;
        if (a > a0 + 1e-4 && a < a1 - 1e-4) angles.push(a);
      }
    }
    angles.sort((x, y) => x - y);

    const inner = [], outer = [];
    for (const a of angles) {
      const ro = outlineRadius(a);
      inner.push([Math.cos(a) * R0, Math.sin(a) * R0]);
      outer.push([Math.cos(a) * ro, Math.sin(a) * ro]);
    }
    cells.push({
      pts: ensureCCW(inner.concat(outer.slice().reverse())),
      plate: false, hint: (s * 2 + 1) % 6, group: 'bg',
    });
  }

  // モチーフは下地の上に重ねる (プレーティング)
  for (const c of MOTIFS[motifId].build()) {
    cells.push({ pts: c.pts, plate: true, hint: c.hint, group: 'motif' });
  }
  return cells;
}

function polyContains(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyCentroid(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  return [cx / pts.length, cy / pts.length];
}

// 点からポリゴン外周までの最短距離 (きる / つなぐ の当たり判定)
function distToOutline(pts, x, y) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const l2 = ex * ex + ey * ey || 1e-9;
    let t = ((x - a[0]) * ex + (y - a[1]) * ey) / l2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const d = Math.hypot(x - (a[0] + ex * t), y - (a[1] + ey * t));
    if (d < best) best = d;
  }
  return best;
}
