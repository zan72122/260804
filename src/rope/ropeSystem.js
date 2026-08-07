import * as THREE from 'three';
import { ROPE, WALK } from '../core/config.js';
import { clamp, clamp01, lerp, smoothstep, smootherstep } from '../core/util.js';
import { fiberMaterial } from './fiberMaterial.js';

// ---------------------------------------------------------------------------
// ロープウォークそのもの。
//
//   s = 0            近端。撚り合わさった太い一本が出てくる側。
//   s = WALK.span    遠端。3つの回転フック。細いストランドが3本ぶら下がる。
//
// トップ（溝付きの木のこま）は s = close の位置にいて、
//   s <  close … すでに綯われた「太い一本」
//   s >  close … まだ別々の「細い3本」
// この二つを、ひとつの連続した面として毎フレーム作りなおす。切れ目はない。
// ---------------------------------------------------------------------------

const RADIAL = ROPE.radial;         // 断面の分割数
const RING = RADIAL + 1;            // 継ぎ目を複製するので +1
const N_STRANDS = ROPE.strands;
const CELL = 0.05;                  // 撚りピッチを記録する目盛りの細かさ

export class RopeSystem {
  constructor() {
    this.group = new THREE.Group();

    this.stations = ROPE.stations;
    this.span = WALK.span;

    // --- 進行の状態 -------------------------------------------------------
    this.extend = 0;      // 0=フックの上だけ  1=近端まで引き出した
    this.twist = 0;       // ストランド1本ずつの撚り
    this.close = -1;      // トップの位置（負なら、まだ置いていない）
    this.tension = 0;     // ぴんと張っている度合い
    this.visible = false;

    // --- 撚り模様の記録 ---------------------------------------------------
    // 指の速さとゆれを、綯い上がった撚りピッチへ少しだけ残す。
    this.cells = Math.ceil(this.span / CELL) + 2;
    this.layPitch = new Float32Array(this.cells).fill(ROPE.layPitch);
    this.layBulge = new Float32Array(this.cells);
    this._recordedTo = 0;

    // --- 経路（まっすぐな作業場 → 滑車に掛けた吊り経路） ------------------
    this.pathBlend = 0;
    this.rigCurve = null;

    // --- 計算用の配列 -----------------------------------------------------
    const n = this.stations;
    this.sArr = new Float32Array(n);
    this.arc = new Float32Array(n);
    this.pos = new Float32Array(n * 3);
    this.nrm = new Float32Array(n * 3);   // 平行移動枠 N
    this.bin = new Float32Array(n * 3);   // 平行移動枠 B
    this.tan = new Float32Array(n * 3);
    this.theta = new Float32Array(n);
    this.radius = new Float32Array(n);    // ストランド中心が乗る円の半径
    this.thick = new Float32Array(n);     // ストランド自身の太さ
    this.laid = new Float32Array(n);      // 0=ばらばら 1=綯い上がり

    this._cosA = new Float32Array(RING);
    this._sinA = new Float32Array(RING);
    for (let k = 0; k < RING; k++) {
      const a = (k / RADIAL) * Math.PI * 2;
      this._cosA[k] = Math.cos(a);
      this._sinA[k] = Math.sin(a);
    }

    this._buildTube();
    this._buildFuzz();

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._focus = 0;
  }

  // -------------------------------------------------------------------------
  // 形の定義
  // -------------------------------------------------------------------------

  /** 綯い終わりの手前側の端（引き出し中は動く） */
  get sMin() {
    return this.span * (1 - clamp01(this.extend));
  }

  /** s における、ばらばらのときのストランド中心円の半径 */
  openRadius(s) {
    const s0 = this.sMin;
    const nearT = smoothstep(s0, s0 + 0.95, s);
    const farT = smoothstep(this.span, this.span - 1.15, s);
    let r = lerp(ROPE.layRadius * 1.25, ROPE.spread, nearT);
    r = lerp(ROPE.hookRing, r, farT);
    return r;
  }

  /** s におけるトップ通過後の度合い。ここが「細い複数本 → 太い一本」の峠。 */
  closeAmount(s) {
    if (this.close < 0) return 0;
    const h = ROPE.closeLength * 0.5;
    return 1 - smootherstep(this.close - h, this.close + h, s);
  }

  cellAt(s) {
    return clamp(Math.floor(s / CELL), 0, this.cells - 1);
  }

  /**
   * トップを進める。通過した区間へ、そのときの手の速さとゆれを焼き込む。
   * 速いところは撚りが少しゆるく、ゆっくりのところは少し詰まる。
   */
  advanceClose(newC, speed, wobble) {
    const prev = this.close;
    this.close = clamp(newC, 0, this.span);
    if (prev < 0) {
      this._recordedTo = 0;
      return;
    }
    if (this.close <= this._recordedTo) return;
    const norm = clamp(speed / 0.5, 0, 2.2);
    const w = clamp(wobble, -1, 1);
    const pitch = ROPE.layPitch * (1 + ROPE.layPitchJitter * (norm - 1) * 0.5 + w * 0.06);
    const bulge = w * 0.055 + (norm - 1) * 0.02;
    const from = this.cellAt(this._recordedTo);
    const to = this.cellAt(this.close);
    for (let k = from; k <= to; k++) {
      // 前の値と混ぜて、模様が急に変わらないようにする
      this.layPitch[k] = lerp(this.layPitch[k], clamp(pitch, 0.2, 0.62), 0.55);
      this.layBulge[k] = lerp(this.layBulge[k], bulge, 0.55);
    }
    this._recordedTo = this.close;
  }

  setRigCurve(curve, blend) {
    this.rigCurve = curve;
    this.pathBlend = clamp01(blend);
  }

  /** 作業場のまっすぐな経路。たわみは張りが強いほど減る。 */
  _walkPoint(s, out) {
    const s0 = this.sMin;
    const L = Math.max(0.001, this.span - s0);
    const u = clamp01((s - s0) / L);
    const sag = lerp(0.125, 0.011, clamp01(this.tension)) * (L / this.span);
    out.set(WALK.x0 + s, WALK.y - sag * 4 * u * (1 - u), 0);
    return out;
  }

  _pathPoint(s, out) {
    this._walkPoint(s, out);
    if (this.pathBlend > 0.0005 && this.rigCurve) {
      const u = clamp01(s / this.span);
      this.rigCurve.getPointAt(u, this._tmpB);
      out.lerp(this._tmpB, this.pathBlend);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // 毎フレームの作りなおし
  // -------------------------------------------------------------------------

  /** カメラの近くほど細かく刻む。長い作業場でも手元は滑らかに見える。 */
  _distribute(focus) {
    const n = this.stations;
    const s0 = this.sMin;
    const s1 = this.span;
    const M = 96;
    const ds = (s1 - s0) / M;
    let total = 0;
    const cum = this._cum || (this._cum = new Float32Array(M + 1));
    cum[0] = 0;
    for (let m = 0; m < M; m++) {
      const sm = s0 + (m + 0.5) * ds;
      const d = 0.18 + 1 / (1 + Math.abs(sm - focus) / 2.6);
      total += d * ds;
      cum[m + 1] = total;
    }
    let m = 0;
    for (let j = 0; j < n; j++) {
      const target = (total * j) / (n - 1);
      while (m < M - 1 && cum[m + 1] < target) m++;
      const seg = cum[m + 1] - cum[m] || 1e-6;
      const t = clamp01((target - cum[m]) / seg);
      this.sArr[j] = s0 + (m + t) * ds;
    }
    this.sArr[n - 1] = s1;
  }

  update(dt, cameraX) {
    if (!this.visible) return;
    const n = this.stations;
    const focus = clamp(cameraX - WALK.x0 + 3.2, 0, this.span);
    this._focus = focus;
    this._distribute(focus);

    const P = this.pos;
    const Nv = this.nrm;
    const Bv = this.bin;
    const Tv = this.tan;
    const a = this._tmpA;

    // 1) 経路上の点
    for (let j = 0; j < n; j++) {
      this._pathPoint(this.sArr[j], a);
      P[j * 3] = a.x;
      P[j * 3 + 1] = a.y;
      P[j * 3 + 2] = a.z;
    }

    // 2) 接線と、ねじれの少ない枠（平行移動枠）
    let px = 0, py = 1, pz = 0;
    let arc = 0;
    for (let j = 0; j < n; j++) {
      const j0 = Math.max(0, j - 1) * 3;
      const j1 = Math.min(n - 1, j + 1) * 3;
      let tx = P[j1] - P[j0];
      let ty = P[j1 + 1] - P[j0 + 1];
      let tz = P[j1 + 2] - P[j0 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      Tv[j * 3] = tx; Tv[j * 3 + 1] = ty; Tv[j * 3 + 2] = tz;

      // 前の N を接線に直交化して運ぶ
      const d = px * tx + py * ty + pz * tz;
      let nx = px - tx * d;
      let ny = py - ty * d;
      let nz = pz - tz * d;
      let nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-4) {
        nx = 0; ny = 0; nz = 1;
        nl = 1;
      }
      nx /= nl; ny /= nl; nz /= nl;
      px = nx; py = ny; pz = nz;
      Nv[j * 3] = nx; Nv[j * 3 + 1] = ny; Nv[j * 3 + 2] = nz;
      Bv[j * 3] = ty * nz - tz * ny;
      Bv[j * 3 + 1] = tz * nx - tx * nz;
      Bv[j * 3 + 2] = tx * ny - ty * nx;

      if (j > 0) {
        const q = (j - 1) * 3;
        arc += Math.hypot(P[j * 3] - P[q], P[j * 3 + 1] - P[q + 1], P[j * 3 + 2] - P[q + 2]);
      }
      this.arc[j] = arc;
    }

    // 3) 半径・太さ・綯い度合い・撚り角の積分
    const rOpen = lerp(ROPE.rRaw, ROPE.rTwisted, clamp01(this.twist));
    const openOmega = clamp01(this.twist) * 0.85; // ばらけた3本のゆるい共回り
    let th = 0;
    for (let j = 0; j < n; j++) {
      const s = this.sArr[j];
      const b = this.closeAmount(s);
      const cell = this.cellAt(s);
      const layR = ROPE.layRadius * (1 + this.layBulge[cell]);
      this.laid[j] = b;
      this.radius[j] = lerp(this.openRadius(s), layR, b);
      this.thick[j] = lerp(rOpen, ROPE.rLaid * (1 + this.layBulge[cell] * 0.5), b);

      if (j > 0) {
        const ds = this.arc[j] - this.arc[j - 1];
        const bm = (b + this.laid[j - 1]) * 0.5;
        const omegaLay = (Math.PI * 2) / this.layPitch[cell];
        th += lerp(openOmega, omegaLay, bm) * ds;
      }
      this.theta[j] = th;
    }
    this.thetaEnd = th;

    this._writeTube();
    this._writeFuzz();
  }

  // -------------------------------------------------------------------------
  // 面を書き出す
  // -------------------------------------------------------------------------

  _buildTube() {
    const n = this.stations;
    const total = n * RING * N_STRANDS;
    const g = new THREE.BufferGeometry();
    const position = new Float32Array(total * 3);
    const normal = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    const aLaid = new Float32Array(total);
    const aTone = new Float32Array(total);

    for (let i = 0; i < N_STRANDS; i++) {
      const tone = 0.34 + i * 0.22;
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < RING; k++) {
          const v = (i * n + j) * RING + k;
          uv[v * 2] = k / RADIAL;
          aTone[v] = tone;
        }
      }
    }

    const idx = [];
    for (let i = 0; i < N_STRANDS; i++) {
      const base = i * n * RING;
      for (let j = 0; j < n - 1; j++) {
        for (let k = 0; k < RADIAL; k++) {
          const a = base + j * RING + k;
          const b = a + RING;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }

    g.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLaid', new THREE.BufferAttribute(aLaid, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTone', new THREE.BufferAttribute(aTone, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(WALK.x0 + this.span * 0.5, 1.2, 0), this.span);

    this.material = fiberMaterial();
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.group.add(this.mesh);
    this.tubeGeo = g;
  }

  _writeTube() {
    const n = this.stations;
    const g = this.tubeGeo;
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    const uv = g.attributes.uv.array;
    const lai = g.attributes.aLaid.array;
    const P = this.pos, Nv = this.nrm, Bv = this.bin;
    const cosA = this._cosA, sinA = this._sinA;

    for (let i = 0; i < N_STRANDS; i++) {
      const phase = (i / N_STRANDS) * Math.PI * 2;
      const base = i * n * RING;
      for (let j = 0; j < n; j++) {
        const j3 = j * 3;
        const nx = Nv[j3], ny = Nv[j3 + 1], nz = Nv[j3 + 2];
        const bx = Bv[j3], by = Bv[j3 + 1], bz = Bv[j3 + 2];
        const ang = this.theta[j] + phase;
        const R = this.radius[j];
        const cx = P[j3] + R * (Math.cos(ang) * nx + Math.sin(ang) * bx);
        const cy = P[j3 + 1] + R * (Math.cos(ang) * ny + Math.sin(ang) * by);
        const cz = P[j3 + 2] + R * (Math.cos(ang) * nz + Math.sin(ang) * bz);
        const r = this.thick[j];
        const arc = this.arc[j];
        const laid = this.laid[j];
        const vbase = base + j * RING;
        for (let k = 0; k < RING; k++) {
          const ca = cosA[k], sa = sinA[k];
          const dx = ca * nx + sa * bx;
          const dy = ca * ny + sa * by;
          const dz = ca * nz + sa * bz;
          const v = vbase + k;
          const v3 = v * 3;
          pos[v3] = cx + r * dx;
          pos[v3 + 1] = cy + r * dy;
          pos[v3 + 2] = cz + r * dz;
          nor[v3] = dx;
          nor[v3 + 1] = dy;
          nor[v3 + 2] = dz;
          uv[v * 2 + 1] = arc;
          lai[v] = laid;
        }
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.attributes.aLaid.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // けば。撚る前はぼさぼさ、撚ると寝て、綯うとほとんど収まる。
  // -------------------------------------------------------------------------

  _buildFuzz() {
    this.fuzzStep = 5;
    this.fuzzPerStation = 3;
    const stations = Math.floor(this.stations / this.fuzzStep);
    this.fuzzStations = stations;
    const hairs = stations * this.fuzzPerStation * N_STRANDS;
    const pos = new Float32Array(hairs * 2 * 3);
    const col = new Float32Array(hairs * 2 * 3);
    // 毛の生え方は固定。毎回ちがう場所から生えたらちらつく。
    this.fuzzSeed = new Float32Array(hairs * 3);
    for (let h = 0; h < hairs; h++) {
      this.fuzzSeed[h * 3] = Math.random() * Math.PI * 2;      // 生える向き
      this.fuzzSeed[h * 3 + 1] = 0.45 + Math.random() * 0.85;  // 長さの割合
      this.fuzzSeed[h * 3 + 2] = Math.random();                // 色と傾き
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(WALK.x0 + this.span * 0.5, 1.2, 0), this.span);
    const m = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: true,
    });
    this.fuzz = new THREE.LineSegments(g, m);
    this.fuzz.frustumCulled = false;
    this.fuzz.visible = false;
    this.group.add(this.fuzz);
    this.fuzzGeo = g;
  }

  _writeFuzz() {
    const g = this.fuzzGeo;
    const pos = g.attributes.position.array;
    const col = g.attributes.color.array;
    const P = this.pos, Nv = this.nrm, Bv = this.bin, Tv = this.tan;
    const n = this.stations;
    const tw = clamp01(this.twist);
    let h = 0;
    for (let i = 0; i < N_STRANDS; i++) {
      const phase = (i / N_STRANDS) * Math.PI * 2;
      for (let q = 0; q < this.fuzzStations; q++) {
        const j = Math.min(n - 1, q * this.fuzzStep + 2);
        const j3 = j * 3;
        const nx = Nv[j3], ny = Nv[j3 + 1], nz = Nv[j3 + 2];
        const bx = Bv[j3], by = Bv[j3 + 1], bz = Bv[j3 + 2];
        const tx = Tv[j3], ty = Tv[j3 + 1], tz = Tv[j3 + 2];
        const ang = this.theta[j] + phase;
        const R = this.radius[j];
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const cx = P[j3] + R * (ca * nx + sa * bx);
        const cy = P[j3 + 1] + R * (ca * ny + sa * by);
        const cz = P[j3 + 2] + R * (ca * nz + sa * bz);
        const r = this.thick[j];
        const laid = this.laid[j];
        const lenBase = lerp(0.026, 0.0075, tw) * lerp(1, 0.5, laid);
        for (let f = 0; f < this.fuzzPerStation; f++, h++) {
          const a = this.fuzzSeed[h * 3] + this.theta[j] * 0.4;
          const lf = this.fuzzSeed[h * 3 + 1];
          const cs = this.fuzzSeed[h * 3 + 2];
          const ux = Math.cos(a), uy = Math.sin(a);
          const rx = ux * nx + uy * bx;
          const ry = ux * ny + uy * by;
          const rz = ux * nz + uy * bz;
          const x0 = cx + r * rx, y0 = cy + r * ry, z0 = cz + r * rz;
          const L = lenBase * lf;
          // 撚りが進むほど、毛は軸に沿って寝る
          const along = lerp(0.25, 1.5, tw) * (cs - 0.5) * 2;
          const x1 = x0 + rx * L + tx * L * along;
          const y1 = y0 + ry * L + ty * L * along - L * 0.5;
          const z1 = z0 + rz * L + tz * L * along;
          const o = h * 6;
          pos[o] = x0; pos[o + 1] = y0; pos[o + 2] = z0;
          pos[o + 3] = x1; pos[o + 4] = y1; pos[o + 5] = z1;
          const br = 0.42 + cs * 0.34;
          col[o] = 0.72 * br; col[o + 1] = 0.58 * br; col[o + 2] = 0.32 * br;
          col[o + 3] = 0.80 * br; col[o + 4] = 0.68 * br; col[o + 5] = 0.42 * br;
        }
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // 参照用
  // -------------------------------------------------------------------------

  _indexOf(s) {
    const n = this.stations;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sArr[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** s の位置と枠。トップや端止めを置くのに使う。 */
  sampleFrame(s, out = {}) {
    const j = this._indexOf(clamp(s, this.sMin, this.span));
    const j3 = j * 3;
    out.p = (out.p || new THREE.Vector3()).set(this.pos[j3], this.pos[j3 + 1], this.pos[j3 + 2]);
    out.t = (out.t || new THREE.Vector3()).set(this.tan[j3], this.tan[j3 + 1], this.tan[j3 + 2]);
    out.n = (out.n || new THREE.Vector3()).set(this.nrm[j3], this.nrm[j3 + 1], this.nrm[j3 + 2]);
    out.b = (out.b || new THREE.Vector3()).set(this.bin[j3], this.bin[j3 + 1], this.bin[j3 + 2]);
    out.theta = this.theta[j];
    out.radius = this.radius[j];
    out.thick = this.thick[j];
    out.laid = this.laid[j];
    return out;
  }

  ropeRadiusAt(s) {
    const j = this._indexOf(clamp(s, this.sMin, this.span));
    return this.radius[j] + this.thick[j];
  }

  setVisible(v) {
    this.visible = v;
    this.mesh.visible = v;
    this.fuzz.visible = v;
  }

  setFuzzVisible(v) {
    this.fuzz.visible = v && this.visible;
  }
}
