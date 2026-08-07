// ============================================================================
// 折りエンジン / Fold engine
//
// このファイルがゲームの心臓部です。
//
//  * 布は材料座標 q ∈ [-0.5, 0.5]^2 で表されます (メートルに直すときは CLOTH_SIZE 倍)。
//  * 「折る」= 折り線 (crease) による逐次的な鏡映。紙折りと同じ規則で層 (layer) も反転します。
//  * 折りたたまれた束の中での位置 (a, b) を footprint と呼びます。
//  * 糸や板は footprint 空間に置かれるので、「1 か所を縛る」だけで
//    展開後には折りの対称性ぶんだけ模様が繰り返されます。
//    ＝ 模様は画像ではなく、折り位置と縛り位置から生成されます。
//
// 4 方式: accordion (蛇腹折り) / triangle (三角折り) / pinch (中央つまみ) / roll (巻き上げ)
// ============================================================================

import { TAU, clamp, clamp01, lerp, smoothstep, easeInOut, makeRng } from './util.js';

export const CLOTH_SIZE = 0.86;      // 布の一辺 (m)
export const CLOTH_THICK = 0.0030;   // 布そのものの厚み (m)
// たたんだ層と層のあいだ。実際の布も空気をふくんで浮くので、厚みより広い。
// これを大きくすると「何枚も重なっている」ことが目で見てわかる。
export const LAYER_GAP = 0.0082;
const S = CLOTH_SIZE;

// ---------------------------------------------------------------------------
// 折り線ベースの折り (蛇腹 / 三角)
// ---------------------------------------------------------------------------

function buildCreaseFold(creases, meta) {
  // 層番号を決めるための粗いプリパス。
  const N = 33;
  const n2 = (N + 1) * (N + 1);
  const qx = new Float32Array(n2), qy = new Float32Array(n2);
  const lay = new Int16Array(n2);
  let idx = 0;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++, idx++) {
      qx[idx] = i / N - 0.5;
      qy[idx] = j / N - 0.5;
      lay[idx] = 0;
    }
  }
  for (let k = 0; k < creases.length; k++) {
    const c = creases[k];
    let moveMax = -1, stayMax = -1;
    for (let p = 0; p < n2; p++) {
      const d = (qx[p] - c.ax) * c.nx + (qy[p] - c.ay) * c.ny;
      if (d > 1e-7) { if (lay[p] > moveMax) moveMax = lay[p]; }
      else { if (lay[p] > stayMax) stayMax = lay[p]; }
    }
    if (moveMax < 0) { c.base = 0; c.kmax = 0; c.noop = true; continue; }
    if (stayMax < 0) stayMax = -1;
    c.base = stayMax + 1;
    c.kmax = moveMax;
    for (let p = 0; p < n2; p++) {
      const d = (qx[p] - c.ax) * c.nx + (qy[p] - c.ay) * c.ny;
      if (d > 1e-7) {
        qx[p] -= 2 * d * c.nx;
        qy[p] -= 2 * d * c.ny;
        lay[p] = c.base + (c.kmax - lay[p]);
      }
    }
  }
  let maxLayer = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let p = 0; p < n2; p++) {
    if (lay[p] > maxLayer) maxLayer = lay[p];
    if (qx[p] < minX) minX = qx[p];
    if (qx[p] > maxX) maxX = qx[p];
    if (qy[p] < minY) minY = qy[p];
    if (qy[p] > maxY) maxY = qy[p];
  }
  return {
    creases,
    maxLayer,
    bbox: { minX, maxX, minY, maxY },
    stackH: (maxLayer + 1) * LAYER_GAP,
    meta
  };
}

// 折りを全部適用（=完全にたたんだ状態の材料座標と層）
function creasesApplyFull(cf, x, y, out) {
  let layer = 0;
  const cs = cf.creases;
  for (let k = 0; k < cs.length; k++) {
    const c = cs[k];
    if (c.noop) continue;
    const d = (x - c.ax) * c.nx + (y - c.ay) * c.ny;
    if (d > 0) {
      x -= 2 * d * c.nx;
      y -= 2 * d * c.ny;
      layer = c.base + (c.kmax - layer);
    }
  }
  out.x = x; out.y = y; out.layer = layer;
  return out;
}

const _tmpA = { x: 0, y: 0, layer: 0 };

// 途中まで折った姿勢。T ∈ [0,1] を折り線の本数に配分し、
// いま折っている 1 本だけをヒンジ回転させる。 → 「一枚ずつ折れていく」動き。
function creasesPose(cf, x, y, T, out) {
  const cs = cf.creases;
  const K = cs.length;
  if (K === 0) { out.x = x; out.y = y; out.h = 0; out.layer = 0; return out; }
  let g = clamp01(T) * K;
  let k = Math.floor(g);
  let s = g - k;
  if (k >= K) { k = K; s = 0; }

  let layer = 0;
  for (let i = 0; i < k; i++) {
    const c = cs[i];
    if (c.noop) continue;
    const d = (x - c.ax) * c.nx + (y - c.ay) * c.ny;
    if (d > 0) {
      x -= 2 * d * c.nx;
      y -= 2 * d * c.ny;
      layer = c.base + (c.kmax - layer);
    }
  }
  let h = layer * LAYER_GAP;

  if (k < K) {
    const c = cs[k];
    if (!c.noop) {
      const d = (x - c.ax) * c.nx + (y - c.ay) * c.ny;
      if (d > 0) {
        const e = easeInOut(s);
        const th = Math.PI * e;
        const ct = Math.cos(th), st = Math.sin(th);
        const alongX = x - c.ax - c.nx * d;
        const alongY = y - c.ay - c.ny * d;
        const h0 = h;
        const d2 = d * ct - h0 * st;
        const h2 = d * st + h0 * ct;
        x = c.ax + alongX + c.nx * d2;
        y = c.ay + alongY + c.ny * d2;
        const layerNew = c.base + (c.kmax - layer);
        h = h2 + (layerNew * LAYER_GAP + h0) * e;
        layer = layerNew;
      }
    }
  }
  out.x = x; out.y = y; out.h = h; out.layer = layer;
  return out;
}

function burialFromLayer(layer, maxLayer) {
  if (maxLayer <= 0) return 0;
  const half = Math.max(1, maxLayer * 0.5);
  return clamp01(Math.min(layer, maxLayer - layer) / half);
}

// ---------------------------------------------------------------------------
// 蛇腹折り
// ---------------------------------------------------------------------------

function makeAccordion(params) {
  const angle = params.angle || 0;
  const n = clamp(Math.round(params.panels || 5), 3, 8);
  const n2 = params.panels2 ? clamp(Math.round(params.panels2), 3, 6) : 0;
  const creases = [];

  function pushAccordion(a, count) {
    const nx = Math.cos(a), ny = Math.sin(a);
    const ext = (Math.abs(nx) + Math.abs(ny)) * 0.5;
    const w = (2 * ext) / count;
    for (let i = 1; i < count; i++) {
      const odd = (i % 2) === 1;
      const t = odd ? (-ext + w) : (-ext);
      const sg = odd ? 1 : -1;
      creases.push({ ax: nx * t, ay: ny * t, nx: nx * sg, ny: ny * sg });
    }
  }
  pushAccordion(angle, n);
  if (n2 >= 3) pushAccordion(angle + Math.PI * 0.5, n2);

  const cf = buildCreaseFold(creases, { angle, n, n2 });
  // 束の長軸: 折り線の法線に垂直な向き（帯の長い方向）
  let ux = Math.cos(angle), uy = Math.sin(angle);   // across (compressed)
  let vx = -uy, vy = ux;                            // along the strip
  if (n2 >= 3) {
    // 両方向に折った場合は残った長い方を長軸に
    const extU = (Math.abs(ux) + Math.abs(uy)) * 0.5 * 2 / n;
    const extV = (Math.abs(vx) + Math.abs(vy)) * 0.5 * 2 / n2;
    if (extU > extV) { const tx = ux, ty = uy; ux = vx; uy = vy; vx = tx; vy = ty; }
  }
  cf.axisU = { x: ux, y: uy };
  cf.axisV = { x: vx, y: vy };
  return cf;
}

// ---------------------------------------------------------------------------
// 三角折り
// ---------------------------------------------------------------------------

function makeTriangle(params) {
  const rot = params.rot || 0;
  const extra = !!params.extra;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const R = (px, py) => ({ x: px * cr - py * sr, y: px * sr + py * cr });
  const mk = (ax, ay, nx, ny) => {
    const a = R(ax, ay), n = R(nx, ny);
    return { ax: a.x, ay: a.y, nx: n.x, ny: n.y };
  };
  const inv = 1 / Math.SQRT2;
  const creases = [
    mk(0, 0, 1, 0),
    mk(0, 0, 0, 1),
    mk(-0.25, -0.25, inv, inv)
  ];
  if (extra) creases.push(mk(-0.32, -0.32, inv, -inv));

  const cf = buildCreaseFold(creases, { rot, extra });
  // 束の「とがった角」= たたみ切った直角の角
  const c = R(-0.5, -0.5);
  cf.corner = { x: c.x, y: c.y };
  const dOut = R(inv, inv);
  cf.outDir = { x: dOut.x, y: dOut.y };
  cf.maxDist = 0.5 * Math.SQRT2 * 0.72;
  return cf;
}

// ---------------------------------------------------------------------------
// 折りオブジェクトの生成
// ---------------------------------------------------------------------------

const PINCH_H = 0.29;
const ROLL_R0 = 0.040;

export const FOLD_LABELS = {
  none: 'ひろげたまま',
  accordion: 'じゃばらおり',
  triangle: 'さんかくおり',
  pinch: 'まんなかつまみ',
  roll: 'まきあげ'
};

export function createFold(spec) {
  const family = spec && spec.family ? spec.family : 'none';
  const rng = makeRng((spec && spec.seed) || 1);
  const f = {
    family,
    params: Object.assign({}, spec),
    label: FOLD_LABELS[family] || FOLD_LABELS.none,
    steps: 1
  };

  if (family === 'accordion' || family === 'triangle') {
    const cf = family === 'accordion' ? makeAccordion(spec) : makeTriangle(spec);
    f.cf = cf;
    f.steps = Math.max(1, cf.creases.length);
    f.stackH = cf.stackH;

    // ---- footprint -------------------------------------------------------
    if (family === 'accordion') {
      // 束は帯。 a = 帯にそった位置、 b = 帯の幅方向。
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      const o = { x: 0, y: 0, layer: 0 };
      for (let j = 0; j <= 24; j++) for (let i = 0; i <= 24; i++) {
        creasesApplyFull(cf, i / 24 - 0.5, j / 24 - 0.5, o);
        const av = o.x * cf.axisV.x + o.y * cf.axisV.y;
        const bv = o.x * cf.axisU.x + o.y * cf.axisU.y;
        if (av < aMin) aMin = av; if (av > aMax) aMax = av;
        if (bv < bMin) bMin = bv; if (bv > bMax) bMax = bv;
      }
      f.aMin = aMin; f.aMax = aMax; f.bMin = bMin; f.bMax = bMax;
      f.footprint = (u, v, out) => {
        creasesApplyFull(cf, u - 0.5, v - 0.5, _tmpA);
        const av = _tmpA.x * cf.axisV.x + _tmpA.y * cf.axisV.y;
        const bv = _tmpA.x * cf.axisU.x + _tmpA.y * cf.axisU.y;
        out.a = clamp01((av - aMin) / (aMax - aMin || 1));
        out.b = clamp01((bv - bMin) / (bMax - bMin || 1));
        out.burial = burialFromLayer(_tmpA.layer, cf.maxLayer);
        return out;
      };
      f.ringAt = (a) => {
        const av = lerp(aMin, aMax, a);
        const bc = (bMin + bMax) * 0.5;
        return {
          cx: (cf.axisV.x * av + cf.axisU.x * bc) * S,
          cy: cf.stackH * 0.5,
          cz: (cf.axisV.y * av + cf.axisU.y * bc) * S,
          axis: { x: cf.axisV.x, y: 0, z: cf.axisV.y },
          rx: (bMax - bMin) * 0.5 * S + 0.012,
          ry: cf.stackH * 0.5 + 0.012
        };
      };
      f.pointToA = (wx, wz) => {
        const av = (wx / S) * cf.axisV.x + (wz / S) * cf.axisV.y;
        return clamp01((av - aMin) / (aMax - aMin || 1));
      };
      f.pointToB = (wx, wz) => {
        const bv = (wx / S) * cf.axisU.x + (wz / S) * cf.axisU.y;
        return clamp01((bv - bMin) / (bMax - bMin || 1));
      };
    } else {
      // 三角束。 a = とがった角からの距離、 b = その角まわりの角度。
      const C = cf.corner, D = cf.outDir;
      const perp = { x: -D.y, y: D.x };
      const maxD = cf.maxDist;
      f.footprint = (u, v, out) => {
        creasesApplyFull(cf, u - 0.5, v - 0.5, _tmpA);
        const dx = _tmpA.x - C.x, dy = _tmpA.y - C.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dx * perp.x + dy * perp.y, dx * D.x + dy * D.y);
        out.a = clamp01(r / maxD);
        out.b = clamp01(ang / (Math.PI * 0.5) + 0.5);
        out.burial = burialFromLayer(_tmpA.layer, cf.maxLayer);
        return out;
      };
      f.ringAt = (a) => {
        const r = a * maxD;
        return {
          cx: (C.x + D.x * r) * S,
          cy: cf.stackH * 0.5,
          cz: (C.y + D.y * r) * S,
          axis: { x: D.x, y: 0, z: D.y },
          rx: Math.max(0.03, r * 0.85 * S) + 0.008,
          ry: cf.stackH * 0.5 + 0.012
        };
      };
      f.pointToA = (wx, wz) => {
        const dx = wx / S - C.x, dy = wz / S - C.y;
        return clamp01(Math.sqrt(dx * dx + dy * dy) / maxD);
      };
      f.pointToB = (wx, wz) => {
        const dx = wx / S - C.x, dy = wz / S - C.y;
        const ang = Math.atan2(dx * perp.x + dy * perp.y, dx * D.x + dy * D.y);
        return clamp01(ang / (Math.PI * 0.5) + 0.5);
      };
      f.aMin = 0; f.aMax = 1;
    }

    // ---- pose ------------------------------------------------------------
    const po = { x: 0, y: 0, h: 0, layer: 0 };
    f.pose = (u, v, T, out) => {
      creasesPose(cf, u - 0.5, v - 0.5, T, po);
      out.x = po.x * S;
      out.y = po.h;
      out.z = po.y * S;
      out.burial = burialFromLayer(po.layer, cf.maxLayer);
      out.layer = po.layer;
      return out;
    };
    f.bundleHeight = cf.stackH;

  } else if (family === 'pinch') {
    const k = clamp(Math.round(spec.pleats || 7), 4, 11);
    const rot = spec.rot || 0;
    const rmax = 0.7072;
    f.steps = 1;
    f.pleats = k;

    f.pose = (u, v, T, out) => {
      const qx = u - 0.5, qy = v - 0.5;
      const r = Math.sqrt(qx * qx + qy * qy);
      const th = Math.atan2(qy, qx);
      const rn = clamp01(r / rmax);
      const g = clamp01(T);
      const pleat = Math.cos(k * th + rot);
      const rg = r * (1 - 0.74 * g) * (1 + 0.11 * g * pleat);
      const h = g * (PINCH_H * (1 - rn) * (1 - rn * 0.25)) + g * 0.014 * Math.sin(k * th + rot) * rn;
      out.x = rg * Math.cos(th) * S;
      out.z = rg * Math.sin(th) * S;
      out.y = h;
      out.burial = smoothstep(0.92, 0.06, rn) * 0.85;
      out.layer = 0;
      return out;
    };
    f.footprint = (u, v, out) => {
      const qx = u - 0.5, qy = v - 0.5;
      const r = Math.sqrt(qx * qx + qy * qy);
      const th = Math.atan2(qy, qx);
      const rn = clamp01(r / rmax);
      let bb = (th + Math.PI) / TAU * k;
      bb = bb - Math.floor(bb);
      out.a = rn;
      out.b = bb;
      out.burial = smoothstep(0.92, 0.06, rn) * 0.85;
      return out;
    };
    f.ringAt = (a) => {
      const r = a * rmax;
      const rn = clamp01(a);
      const rg = r * 0.26;
      return {
        cx: 0, cy: PINCH_H * (1 - rn) * (1 - rn * 0.25), cz: 0,
        axis: { x: 0, y: 1, z: 0 },
        rx: Math.max(0.018, rg * S) + 0.012,
        ry: Math.max(0.018, rg * S) + 0.012,
        radial: true
      };
    };
    f.pointToA = (wx, wz) => clamp01(Math.sqrt(wx * wx + wz * wz) / (rmax * S) * 1.35);
    f.pointToB = (wx, wz) => {
      let bb = (Math.atan2(wz, wx) + Math.PI) / TAU * k;
      return bb - Math.floor(bb);
    };
    f.aMin = 0; f.aMax = 1;
    f.bundleHeight = PINCH_H;

  } else if (family === 'roll') {
    const angle = spec.angle || 0;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const perp = { x: -dir.y, y: dir.x };
    const ext = (Math.abs(dir.x) + Math.abs(dir.y)) * 0.5;
    const extW = (Math.abs(perp.x) + Math.abs(perp.y)) * 0.5;
    const Ltot = 2 * ext * S;
    const phiTot = Ltot / ROLL_R0;
    const Rout = ROLL_R0 + LAYER_GAP * phiTot / TAU;
    f.steps = 1;
    f.rollAngle = angle;
    f.scrunch = 0;

    f.pose = (u, v, T, out) => {
      const qx = u - 0.5, qy = v - 0.5;
      const sm = (qx * dir.x + qy * dir.y) * S;
      let wm = (qx * perp.x + qy * perp.y) * S;
      const g = clamp01(T);
      const rolledLen = g * Ltot;
      const sc = ext * S - rolledLen;
      const L = ext * S - sm;
      let px, py, phi = 0;
      if (L <= rolledLen + 1e-6) {
        const ell = rolledLen - L;
        phi = ell / ROLL_R0;
        const R = ROLL_R0 + LAYER_GAP * phi / TAU;
        const RoutNow = ROLL_R0 + LAYER_GAP * (rolledLen / ROLL_R0) / TAU;
        px = sc + R * Math.sin(phi);
        py = RoutNow - R * Math.cos(phi);
      } else {
        px = sm;
        const t = clamp01((sc - sm) / 0.09);
        py = ROLL_R0 * 1.5 * t * (1 - t);
      }
      const sc2 = f.scrunch;
      if (sc2 > 0) {
        wm *= (1 - 0.20 * sc2);
        py += 0.007 * sc2 * Math.sin(wm * 78 + phi * 1.7);
      }
      out.x = dir.x * px + perp.x * wm;
      out.z = dir.y * px + perp.y * wm;
      out.y = py;
      out.burial = smoothstep(0.12, 0.95, clamp01((sm / S + ext) / (2 * ext)));
      out.layer = Math.floor(phi / TAU);
      return out;
    };
    f.footprint = (u, v, out) => {
      const qx = u - 0.5, qy = v - 0.5;
      const s = qx * dir.x + qy * dir.y;
      const w = qx * perp.x + qy * perp.y;
      const b = clamp01((s + ext) / (2 * ext));
      out.a = clamp01((w + extW) / (2 * extW));
      out.b = b;
      out.burial = smoothstep(0.12, 0.95, b);
      return out;
    };
    f.ringAt = (a) => {
      const wm = lerp(-extW, extW, a) * S;
      const scEnd = -ext * S;
      return {
        cx: dir.x * scEnd + perp.x * wm,
        cy: Rout,
        cz: dir.y * scEnd + perp.y * wm,
        axis: { x: perp.x, y: 0, z: perp.y },
        rx: Rout * 1.08,
        ry: Rout * 1.08
      };
    };
    f.pointToA = (wx, wz) => clamp01(((wx * perp.x + wz * perp.y) / S + extW) / (2 * extW));
    f.pointToB = (wx, wz) => clamp01(((wx * dir.x + wz * dir.y) / S + ext) / (2 * ext));
    f.aMin = 0; f.aMax = 1;
    f.bundleHeight = Rout * 2;

  } else {
    // 折らない（平らなまま）
    f.steps = 1;
    f.pose = (u, v, T, out) => {
      out.x = (u - 0.5) * S; out.y = 0; out.z = (v - 0.5) * S;
      out.burial = 0; out.layer = 0;
      return out;
    };
    f.footprint = (u, v, out) => { out.a = u; out.b = v; out.burial = 0; return out; };
    f.ringAt = (a) => ({
      cx: 0, cy: 0.01, cz: lerp(-0.5, 0.5, a) * S,
      axis: { x: 0, y: 0, z: 1 }, rx: S * 0.52, ry: 0.02
    });
    f.pointToA = (wx, wz) => clamp01(wz / S + 0.5);
    f.pointToB = (wx, wz) => clamp01(wx / S + 0.5);
    f.aMin = 0; f.aMax = 1;
    f.bundleHeight = 0.02;
  }

  // -------------------------------------------------------------------------
  // 束の中心ずらし。
  // 折りは「片側を反対側へ倒す」操作なので、たたみ終わると束は端に寄ってしまう。
  // 実際に手で折るときは束を作業台の真ん中に置きなおすので、それと同じことをする。
  // T=0（平ら）では 0、T=1（束）で完全に中央へ、と連続的に効かせる。
  // -------------------------------------------------------------------------
  const rawPose = f.pose;
  const rawRing = f.ringAt;
  const rawPtA = f.pointToA;
  const rawPtB = f.pointToB;

  let offX = 0, offZ = 0;
  {
    const o = { x: 0, y: 0, z: 0, burial: 0, layer: 0 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let j = 0; j <= 20; j++) for (let i = 0; i <= 20; i++) {
      rawPose(i / 20, j / 20, 1, o);
      if (o.x < minX) minX = o.x; if (o.x > maxX) maxX = o.x;
      if (o.z < minZ) minZ = o.z; if (o.z > maxZ) maxZ = o.z;
    }
    offX = (minX + maxX) * 0.5;
    offZ = (minZ + maxZ) * 0.5;
    f.bundleSize = { w: maxX - minX, d: maxZ - minZ };
  }
  f.offX = offX;
  f.offZ = offZ;

  f.pose = (u, v, T, out) => {
    rawPose(u, v, T, out);
    const k = clamp01(T);
    out.x -= offX * k;
    out.z -= offZ * k;
    return out;
  };
  const ringCap = 0.5 * Math.hypot(f.bundleSize.w, f.bundleSize.d) * 0.62;
  f.ringAt = (a) => {
    const r = rawRing(a);
    r.cx -= offX;
    r.cz -= offZ;
    r.rx = Math.min(r.rx, ringCap);
    r.ry = Math.min(r.ry, ringCap);
    return r;
  };
  f.pointToA = (wx, wz) => rawPtA(wx + offX, wz + offZ);
  f.pointToB = (wx, wz) => rawPtB(wx + offX, wz + offZ);

  // 掲げて見せるときの向き。帯の長い方を画面の横に寝かせる。
  f.displayYaw = (f.bundleSize && f.bundleSize.d > f.bundleSize.w * 1.15) ? Math.PI / 2 : 0;
  // 束をあおぐときに、平らな面をこちらへ向ける角度（つまみ折りだけは自然に垂らす）
  f.displayTilt = (family === 'pinch') ? 0 : -1.05;

  // 折った束のだいたいの大きさ（カメラ寄せ・当たり判定用）
  f.bundleRadius = (() => {
    const o = { x: 0, y: 0, z: 0, burial: 0, layer: 0 };
    let m = 0.02;
    for (let j = 0; j <= 10; j++) for (let i = 0; i <= 10; i++) {
      f.pose(i / 10, j / 10, 1, o);
      const d = Math.sqrt(o.x * o.x + o.z * o.z);
      if (d > m) m = d;
    }
    return m;
  })();

  return f;
}

// ---------------------------------------------------------------------------
// ドラッグの向きから「どの折り方をしたいのか」を推定する。
// 4 歳の指なので、正確さは求めず、大きく寄せて解釈する。
// ---------------------------------------------------------------------------

export function inferFold(startU, startV, endU, endV, seed) {
  const rng = makeRng(seed >>> 0);
  const sx = startU - 0.5, sy = startV - 0.5;
  const dx = endU - startU, dy = endV - startV;
  const len = Math.hypot(dx, dy);
  const startR = Math.hypot(sx, sy);
  const ang = Math.atan2(dy, dx);

  if (len < 0.06) return null;

  // 1) 中央から外へ引っぱった → 中央つまみ
  if (startR < 0.26) {
    return { family: 'pinch', pleats: rng.int(5, 9), rot: rng.range(0, TAU), seed: (seed * 7919) >>> 0 };
  }

  // 2) ふちに沿って長くなでた → 巻き上げ
  const nearEdge = Math.max(Math.abs(sx), Math.abs(sy)) > 0.34;
  const edgeDir = Math.abs(sx) > Math.abs(sy) ? Math.PI / 2 : 0;
  const alongEdge = Math.abs(Math.cos(ang - edgeDir)) > 0.72;
  if (nearEdge && alongEdge && len > 0.22) {
    return { family: 'roll', angle: edgeDir + Math.PI / 2, seed: (seed * 104729) >>> 0 };
  }

  // 3) 角から斜めに引いた → 三角折り
  const diagness = Math.abs(Math.abs(Math.cos(ang)) - Math.abs(Math.sin(ang)));
  const cornerish = Math.abs(sx) > 0.24 && Math.abs(sy) > 0.24;
  if (diagness < 0.42 && cornerish) {
    const rot = Math.abs(sx + sy) > Math.abs(sx - sy) ? 0 : Math.PI * 0.25;
    return { family: 'triangle', rot, extra: rng.chance(0.5), seed: (seed * 15485863) >>> 0 };
  }

  // 4) それ以外の大きなドラッグ → 蛇腹折り（ドラッグ方向に直交する折り目）
  //    束が布からはみ出さないよう、折り目はタテかヨコに寄せる。
  const snapped = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
  return {
    family: 'accordion',
    angle: snapped,
    panels: rng.int(4, 7),
    panels2: 0,
    seed: (seed * 2654435761) >>> 0
  };
}

// 2 回目のドラッグ = 同じ折り方をさらに深くする（子どもの「もっと！」に応える）
export function refineFold(spec, startU, startV, endU, endV, seed) {
  const rng = makeRng(seed >>> 0);
  const next = Object.assign({}, spec);
  const dx = endU - startU, dy = endV - startV;
  const ang = Math.atan2(dy, dx);
  if (spec.family === 'accordion') {
    const perpness = Math.abs(Math.cos(ang - (spec.angle + Math.PI / 2)));
    if (!spec.panels2 && perpness > 0.55) next.panels2 = rng.int(3, 5);
    else next.panels = clamp((spec.panels || 5) + 1, 3, 8);
  } else if (spec.family === 'triangle') {
    next.extra = !spec.extra ? true : spec.extra;
    if (spec.extra) next.rot = spec.rot === 0 ? Math.PI * 0.25 : 0;
  } else if (spec.family === 'pinch') {
    next.pleats = clamp((spec.pleats || 7) + 1, 4, 11);
  } else if (spec.family === 'roll') {
    next.angle = (spec.angle || 0) + Math.PI / 8;
  }
  next.seed = (seed * 40503) >>> 0;
  return next;
}
