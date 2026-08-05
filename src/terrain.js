/**
 * じめん（ハイトフィールド）
 * ・ショベルで けずる（carve）
 * ・ローラーで ならす（flatten）
 * 上面のグリッド + まわりの「土の断面」スカート を 1つの BufferGeometry で もつ。
 */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, makeNoise } from './util.js';

export const AREA = {
  minX: -7.2, maxX: 7.2,
  minZ: -3.0, maxZ: 3.0,
};
export const GRADE = 0.0;      // かんせい どうろの たかさ
export const FLOOR_Y = -0.30;  // これいじょう ふかくは ほれない
const SKIRT_Y = -1.4;

const SEG_X = 104;
const SEG_Z = 40;

// いろ
const C_DRY = new THREE.Color('#d0a670');   // かわいた 表面
const C_SOIL = new THREE.Color('#8e5c37');  // ふつうの 土
const C_WET = new THREE.Color('#5d3a21');   // ほったて の しめった 土
const C_DEEP = new THREE.Color('#472c1c');  // だんめん おく
const C_ROAD = new THREE.Color('#b9b0a4');  // ならした どうろ
const C_ROAD_D = new THREE.Color('#9d948a');

// つかいまわしの いろ（まいフレーム あたらしく つくらない）
const _roadTmp = new THREE.Color();
// レイキャスト の つかいまわし（まいフレーム つくらない）
const _ray = new THREE.Ray();
const _rayHit = new THREE.Vector3();
const _rayOut = new THREE.Vector3();
const _rayBox = new THREE.Box3(
  new THREE.Vector3(AREA.minX, FLOOR_Y - 0.1, AREA.minZ),
  new THREE.Vector3(AREA.maxX, 3.2, AREA.maxZ)
);
const _colTmp = new THREE.Color();
const _deepTmp = new THREE.Color();

export class Terrain {
  constructor() {
    this.nx = SEG_X + 1;
    this.nz = SEG_Z + 1;
    this.dx = (AREA.maxX - AREA.minX) / SEG_X;
    this.dz = (AREA.maxZ - AREA.minZ) / SEG_Z;
    this.cellArea = this.dx * this.dz;

    const n = this.nx * this.nz;
    this.h = new Float32Array(n);       // たかさ
    this.h0 = new Float32Array(n);      // さいしょの たかさ
    this.wet = new Float32Array(n);     // ほりたて ぐあい 0..1
    this.road = new Float32Array(n);    // ならし ぐあい 0..1

    this._buildHeights();
    this._buildGeometry();
    this._recolorAll();
    this._recomputeNormals();

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
      flatShading: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();

    this._dirty = false;
    // かわった はんい（グリッドの ばんごう）
    this._d = { i0: 0, i1: this.nx - 1, j0: 0, j1: this.nz - 1 };
    this.initialVolumeAboveGrade = this.volumeAboveGrade();
  }

  // ---------- せいせい ----------

  _buildHeights() {
    const noise = makeNoise(20260804);
    const { nx, nz } = this;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = AREA.minX + i * this.dx;
        const z = AREA.minZ + j * this.dz;

        // みちの りょうはじは なだらかに おちる
        const edgeX = smoothstep(clamp((Math.min(x - AREA.minX, AREA.maxX - x)) / 1.2, 0, 1));
        const edgeZ = smoothstep(clamp((Math.min(z - AREA.minZ, AREA.maxZ - z)) / 0.9, 0, 1));

        // おおきな つちの やまが 3つ ＋ こまかい でこぼこ
        let hgt = 0.34;
        hgt += 1.05 * Math.exp(-(((x + 3.7) ** 2) / 3.4 + ((z + 0.5) ** 2) / 2.2));
        hgt += 1.35 * Math.exp(-(((x - 0.3) ** 2) / 3.8 + ((z - 0.4) ** 2) / 2.4));
        hgt += 0.95 * Math.exp(-(((x - 4.4) ** 2) / 3.2 + ((z + 0.3) ** 2) / 2.0));
        hgt += 0.42 * Math.exp(-(((x - 2.1) ** 2) / 1.6 + ((z - 1.6) ** 2) / 1.2));
        hgt += 0.38 * Math.exp(-(((x + 1.7) ** 2) / 1.4 + ((z + 1.7) ** 2) / 1.1));
        hgt += 0.20 * noise(x * 0.55, z * 0.55);
        hgt += 0.09 * noise(x * 1.6 + 11, z * 1.6 - 7);
        hgt += 0.05 * noise(x * 3.4 - 5, z * 3.4 + 2);

        const k = i * 1 + j * nx;
        this.h[k] = Math.max(GRADE + 0.02, hgt * (0.35 + 0.65 * edgeX * edgeZ));
        this.h0[k] = this.h[k];
      }
    }
  }

  _buildGeometry() {
    const { nx, nz } = this;
    const nTop = nx * nz;

    // まわりの ループ（左→右→下→左 の じゅんに ふちを たどる）
    const loop = [];
    for (let i = 0; i < nx; i++) loop.push([i, 0]);
    for (let j = 1; j < nz; j++) loop.push([nx - 1, j]);
    for (let i = nx - 2; i >= 0; i--) loop.push([i, nz - 1]);
    for (let j = nz - 2; j >= 1; j--) loop.push([0, j]);
    this.loop = loop;
    const L = loop.length;

    this.nTop = nTop;
    this.skirtTop = nTop;
    this.skirtBot = nTop + L;
    this.capStart = nTop + 2 * L;
    const total = nTop + 2 * L + 4;

    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);

    // 上面
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = AREA.minX + i * this.dx;
        pos[k * 3 + 1] = this.h[k];
        pos[k * 3 + 2] = AREA.minZ + j * this.dz;
        nor[k * 3 + 1] = 1;
      }
    }

    // スカート（土の だんめん）
    for (let s = 0; s < L; s++) {
      const [i, j] = loop[s];
      const k = j * nx + i;
      const x = AREA.minX + i * this.dx;
      const z = AREA.minZ + j * this.dz;
      const t = this.skirtTop + s, b = this.skirtBot + s;
      pos[t * 3] = x; pos[t * 3 + 1] = this.h[k]; pos[t * 3 + 2] = z;
      pos[b * 3] = x; pos[b * 3 + 1] = SKIRT_Y; pos[b * 3 + 2] = z;
    }
    // そとむき ほうせん
    for (let s = 0; s < L; s++) {
      const prev = loop[(s - 1 + L) % L], next = loop[(s + 1) % L];
      const ex = (next[0] - prev[0]) * this.dx;
      const ez = (next[1] - prev[1]) * this.dz;
      let ox = ez, oz = -ex;
      const len = Math.hypot(ox, oz) || 1;
      ox /= len; oz /= len;
      for (const idx of [this.skirtTop + s, this.skirtBot + s]) {
        nor[idx * 3] = ox; nor[idx * 3 + 1] = 0.12; nor[idx * 3 + 2] = oz;
      }
    }

    // そこ の ふた
    const capPts = [
      [AREA.minX, AREA.minZ], [AREA.maxX, AREA.minZ],
      [AREA.maxX, AREA.maxZ], [AREA.minX, AREA.maxZ],
    ];
    for (let c = 0; c < 4; c++) {
      const idx = this.capStart + c;
      pos[idx * 3] = capPts[c][0];
      pos[idx * 3 + 1] = SKIRT_Y;
      pos[idx * 3 + 2] = capPts[c][1];
      nor[idx * 3 + 1] = -1;
      col[idx * 3] = C_DEEP.r; col[idx * 3 + 1] = C_DEEP.g; col[idx * 3 + 2] = C_DEEP.b;
    }

    // インデックス
    const idxTop = SEG_X * SEG_Z * 6;
    const idxSkirt = L * 6;
    const indices = new Uint32Array(idxTop + idxSkirt + 6);
    let p = 0;
    for (let j = 0; j < SEG_Z; j++) {
      for (let i = 0; i < SEG_X; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        indices[p++] = a; indices[p++] = c; indices[p++] = b;
        indices[p++] = b; indices[p++] = c; indices[p++] = d;
      }
    }
    for (let s = 0; s < L; s++) {
      const s2 = (s + 1) % L;
      const t0 = this.skirtTop + s, t1 = this.skirtTop + s2;
      const b0 = this.skirtBot + s, b1 = this.skirtBot + s2;
      indices[p++] = t0; indices[p++] = b0; indices[p++] = t1;
      indices[p++] = t1; indices[p++] = b0; indices[p++] = b1;
    }
    const c0 = this.capStart;
    indices[p++] = c0; indices[p++] = c0 + 1; indices[p++] = c0 + 2;
    indices[p++] = c0; indices[p++] = c0 + 2; indices[p++] = c0 + 3;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeBoundingSphere();
    this.geometry = g;
    this.posAttr = g.getAttribute('position');
    this.norAttr = g.getAttribute('normal');
    this.colAttr = g.getAttribute('color');
  }

  // ---------- いろ ----------

  _vertexColor(k, out) {
    const h = this.h[k];
    const dug = clamp((this.h0[k] - h) / 0.55, 0, 1);
    const high = clamp((h - GRADE) / 0.9, 0, 1);

    out.copy(C_SOIL).lerp(C_DRY, high * 0.9);
    out.lerp(C_WET, dug * 0.85);
    out.lerp(C_WET, this.wet[k] * 0.6);

    const r = this.road[k];
    if (r > 0) {
      _roadTmp.copy(C_ROAD).lerp(C_ROAD_D, clamp(0.5 - h * 2.2, 0, 1));
      out.lerp(_roadTmp, smoothstep(clamp(r, 0, 1)));
    }
    return out;
  }

  /** かわった ところ だけ ぬりなおす（i0..i1, j0..j1） */
  _recolorRect(i0, i1, j0, j1) {
    const col = this.colAttr.array;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * this.nx + i;
        this._vertexColor(k, _colTmp);
        col[k * 3] = _colTmp.r; col[k * 3 + 1] = _colTmp.g; col[k * 3 + 2] = _colTmp.b;
      }
    }
    // ふちの スカートも（ふちに かかる ぶんだけ）
    const L = this.loop.length;
    for (let s = 0; s < L; s++) {
      const [i, j] = this.loop[s];
      if (i < i0 || i > i1 || j < j0 || j > j1) continue;
      const k = j * this.nx + i;
      this._vertexColor(k, _colTmp);
      const t = this.skirtTop + s, b = this.skirtBot + s;
      col[t * 3] = _colTmp.r; col[t * 3 + 1] = _colTmp.g; col[t * 3 + 2] = _colTmp.b;
      _deepTmp.copy(_colTmp).lerp(C_DEEP, 0.8);
      col[b * 3] = _deepTmp.r; col[b * 3 + 1] = _deepTmp.g; col[b * 3 + 2] = _deepTmp.b;
    }
    this.colAttr.needsUpdate = true;
  }

  _recolorAll() { this._recolorRect(0, this.nx - 1, 0, this.nz - 1); }

  // ---------- ほうせん ----------

  _recomputeNormals(i0 = 0, i1 = this.nx - 1, j0 = 0, j1 = this.nz - 1) {
    const { nx, nz, dx, dz } = this;
    const nor = this.norAttr.array;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * nx + i;
        const hl = this.h[j * nx + Math.max(0, i - 1)];
        const hr = this.h[j * nx + Math.min(nx - 1, i + 1)];
        const hd = this.h[Math.max(0, j - 1) * nx + i];
        const hu = this.h[Math.min(nz - 1, j + 1) * nx + i];
        const sx = (hl - hr) / (2 * dx);
        const sz = (hd - hu) / (2 * dz);
        const len = Math.hypot(sx, 1, sz);
        nor[k * 3] = sx / len;
        nor[k * 3 + 1] = 1 / len;
        nor[k * 3 + 2] = sz / len;
      }
    }
    this.norAttr.needsUpdate = true;
  }

  // ---------- といあわせ ----------

  indexAt(x, z) {
    const fi = clamp((x - AREA.minX) / this.dx, 0, this.nx - 1.001);
    const fj = clamp((z - AREA.minZ) / this.dz, 0, this.nz - 1.001);
    return { fi, fj };
  }

  /** ほかん した たかさ。エリアの そとは GRADE */
  heightAt(x, z) {
    if (x < AREA.minX || x > AREA.maxX || z < AREA.minZ || z > AREA.maxZ) return GRADE;
    const { fi, fj } = this.indexAt(x, z);
    const i = Math.floor(fi), j = Math.floor(fj);
    const tx = fi - i, tz = fj - j;
    const nx = this.nx;
    const h00 = this.h[j * nx + i];
    const h10 = this.h[j * nx + i + 1];
    const h01 = this.h[(j + 1) * nx + i];
    const h11 = this.h[(j + 1) * nx + i + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  inside(x, z, margin = 0) {
    return x > AREA.minX + margin && x < AREA.maxX - margin &&
           z > AREA.minZ + margin && z < AREA.maxZ - margin;
  }

  /** レイ と じめんの こうてん（レイマーチ）。あたらなければ null */
  raycast(origin, dir, maxDist = 60) {
    let t = 0;
    // エリア AABB に はいる ところまで すすむ
    const box = _rayBox;
    const ray = _ray.set(origin, dir);
    const hit = _rayHit;
    if (!box.containsPoint(origin)) {
      if (!ray.intersectBox(box, hit)) return null;
      t = origin.distanceTo(hit);
    }
    const step = 0.09;
    let prevT = t;
    let prevDiff = origin.y + dir.y * t - this.heightAt(origin.x + dir.x * t, origin.z + dir.z * t);
    if (prevDiff <= 0) prevDiff = 1e-4;
    // やまの りんかくを かすめた とき用に「いちばん ちかづいた ところ」も おぼえて おく
    let nearT = -1, nearDiff = Infinity;
    for (t += step; t < maxDist; t += step) {
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      if (px < AREA.minX - 0.5 || px > AREA.maxX + 0.5 || pz < AREA.minZ - 0.5 || pz > AREA.maxZ + 0.5) {
        if (py < FLOOR_Y - 0.5) break;
        prevT = t; prevDiff = 1;
        continue;
      }
      const diff = py - this.heightAt(px, pz);
      if (diff > 0 && diff < nearDiff) { nearDiff = diff; nearT = t; }
      if (diff <= 0 && prevDiff > 0) {
        // にぶんほう で しあげ
        let a = prevT, b = t;
        for (let k = 0; k < 12; k++) {
          const m = (a + b) * 0.5;
          const d = origin.y + dir.y * m - this.heightAt(origin.x + dir.x * m, origin.z + dir.z * m);
          if (d > 0) a = m; else b = m;
        }
        const m = (a + b) * 0.5;
        return _rayOut.set(origin.x + dir.x * m, origin.y + dir.y * m, origin.z + dir.z * m);
      }
      prevT = t; prevDiff = diff;
    }
    // かすった だけ でも 「そこを さして いる」と みなす（こどもむけの ほじょ）
    if (nearT > 0 && nearDiff < 0.45) {
      const px = origin.x + dir.x * nearT;
      const pz = origin.z + dir.z * nearT;
      return _rayOut.set(px, this.heightAt(px, pz), pz);
    }
    return null;
  }

  // ---------- へんけい ----------

  /** かわった はんいを ひろげる */
  _touch(i0, i1, j0, j1) {
    if (!this._dirty) { this._d.i0 = i0; this._d.i1 = i1; this._d.j0 = j0; this._d.j1 = j1; }
    else {
      if (i0 < this._d.i0) this._d.i0 = i0;
      if (i1 > this._d.i1) this._d.i1 = i1;
      if (j0 < this._d.j0) this._d.j0 = j0;
      if (j1 > this._d.j1) this._d.j1 = j1;
    }
    this._dirty = true;
  }

  /**
   * まるく けずる。とれた 土の りょう（㎥ 相当）を かえす。
   */
  carve(x, z, radius, depth) {
    const r2 = radius * radius;
    const i0 = Math.max(0, Math.floor((x - radius - AREA.minX) / this.dx));
    const i1 = Math.min(this.nx - 1, Math.ceil((x + radius - AREA.minX) / this.dx));
    const j0 = Math.max(0, Math.floor((z - radius - AREA.minZ) / this.dz));
    const j1 = Math.min(this.nz - 1, Math.ceil((z + radius - AREA.minZ) / this.dz));
    let removed = 0;
    for (let j = j0; j <= j1; j++) {
      const pz = AREA.minZ + j * this.dz;
      for (let i = i0; i <= i1; i++) {
        const px = AREA.minX + i * this.dx;
        const d2 = (px - x) * (px - x) + (pz - z) * (pz - z);
        if (d2 > r2) continue;
        const fall = smoothstep(1 - Math.sqrt(d2) / radius);
        const k = j * this.nx + i;
        const nh = Math.max(FLOOR_Y, this.h[k] - depth * fall);
        removed += (this.h[k] - nh) * this.cellArea;
        this.h[k] = nh;
        this.wet[k] = Math.min(1, this.wet[k] + fall * 0.9);
        this.road[k] *= 1 - fall * 0.8;
      }
    }
    if (removed > 0) this._touch(i0, i1, j0, j1);
    return removed;
  }

  /** 土を もりあげる（ダンプから こぼれた ぶん など、いまは みちの ならし用） */
  addSoil(x, z, radius, amount) {
    const r2 = radius * radius;
    const i0 = Math.max(0, Math.floor((x - radius - AREA.minX) / this.dx));
    const i1 = Math.min(this.nx - 1, Math.ceil((x + radius - AREA.minX) / this.dx));
    const j0 = Math.max(0, Math.floor((z - radius - AREA.minZ) / this.dz));
    const j1 = Math.min(this.nz - 1, Math.ceil((z + radius - AREA.minZ) / this.dz));
    for (let j = j0; j <= j1; j++) {
      const pz = AREA.minZ + j * this.dz;
      for (let i = i0; i <= i1; i++) {
        const px = AREA.minX + i * this.dx;
        const d2 = (px - x) * (px - x) + (pz - z) * (pz - z);
        if (d2 > r2) continue;
        const fall = smoothstep(1 - Math.sqrt(d2) / radius);
        const k = j * this.nx + i;
        this.h[k] += amount * fall;
      }
    }
    this._touch(i0, i1, j0, j1);
  }

  /**
   * ローラーで ならす。だ円の あしあとの なかを GRADE に ちかづけ、
   * road（ならし ぐあい）を あげる。
   */
  roll(x, z, radiusX, radiusZ, strength) {
    const i0 = Math.max(0, Math.floor((x - radiusX - AREA.minX) / this.dx));
    const i1 = Math.min(this.nx - 1, Math.ceil((x + radiusX - AREA.minX) / this.dx));
    const j0 = Math.max(0, Math.floor((z - radiusZ - AREA.minZ) / this.dz));
    const j1 = Math.min(this.nz - 1, Math.ceil((z + radiusZ - AREA.minZ) / this.dz));
    let moved = 0;
    for (let j = j0; j <= j1; j++) {
      const pz = AREA.minZ + j * this.dz;
      for (let i = i0; i <= i1; i++) {
        const px = AREA.minX + i * this.dx;
        const u = (px - x) / radiusX, v = (pz - z) / radiusZ;
        const d = Math.hypot(u, v);
        if (d > 1) continue;
        const fall = smoothstep(1 - d);
        const k = j * this.nx + i;
        const target = GRADE;
        const nh = lerp(this.h[k], target, clamp(strength * fall, 0, 1));
        moved += Math.abs(this.h[k] - nh);
        this.h[k] = nh;
        this.road[k] = Math.min(1, this.road[k] + fall * strength * 2.2);
        this.wet[k] *= 1 - fall * 0.5;
      }
    }
    this._touch(i0, i1, j0, j1);
    return moved;
  }

  /** ならし の しんちょく 0..1（ローラーが とどく まんなか だけを みる） */
  rollProgress() {
    let done = 0, total = 0;
    const nx = this.nx;
    for (let j = 4; j < this.nz - 4; j += 2) {
      for (let i = 7; i < nx - 7; i += 2) {
        const k = j * nx + i;
        total++;
        if (this.road[k] > 0.7 && Math.abs(this.h[k] - GRADE) < 0.06) done++;
      }
    }
    return total ? done / total : 0;
  }

  /** GRADE より うえに のこって いる 土の りょう */
  volumeAboveGrade() {
    let v = 0;
    for (let k = 0; k < this.nTop; k++) {
      const d = this.h[k] - GRADE;
      if (d > 0.05) v += d * this.cellArea;
    }
    return v;
  }

  /**
   * (cx,cz) から maxDist いないで いちばん 土が たかい ところ。
   * 「とどく はんいで ほりごたえの ある ばしょ」を さがす（ヒント／じどう ほじょ用）
   */
  bestDigPoint(cx, cz, maxDist, out = new THREE.Vector3()) {
    let best = -Infinity, bx = cx, bz = cz;
    const md2 = maxDist * maxDist;
    for (let j = 2; j < this.nz - 2; j += 2) {
      const pz = AREA.minZ + j * this.dz;
      for (let i = 2; i < this.nx - 2; i += 2) {
        const px = AREA.minX + i * this.dx;
        const d2 = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
        if (d2 > md2) continue;
        // とおすぎず ちかすぎない ところを すこし ゆうせん
        const h = this.h[j * this.nx + i];
        const score = h - Math.abs(Math.sqrt(d2) - maxDist * 0.72) * 0.06;
        if (score > best) { best = score; bx = px; bz = pz; }
      }
    }
    return out.set(bx, this.heightAt(bx, bz), bz);
  }

  /** いちばん 土が たかい ところ（ヒント用） */
  highestPoint(out = new THREE.Vector3()) {
    let best = -Infinity, bi = 0, bj = 0;
    for (let j = 3; j < this.nz - 3; j += 2) {
      for (let i = 3; i < this.nx - 3; i += 2) {
        const h = this.h[j * this.nx + i];
        if (h > best) { best = h; bi = i; bj = j; }
      }
    }
    return out.set(AREA.minX + bi * this.dx, best, AREA.minZ + bj * this.dz);
  }

  /**
   * しあげ：x が finishX までの ところを かんぜんに たいら＆どうろいろ に する。
   * クリア えんしゅつで つかう（はしっこの のこりも きれいに）
   */
  finishTo(finishX, dt) {
    let changed = false;
    const iMax = Math.min(this.nx - 1, Math.ceil((finishX - AREA.minX) / this.dx));
    if (iMax < 0) return false;
    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i <= iMax; i++) {
        const k = j * this.nx + i;
        const nh = lerp(this.h[k], GRADE, clamp(dt * 6, 0, 1));
        if (Math.abs(nh - this.h[k]) > 1e-5 || this.road[k] < 0.999) changed = true;
        this.h[k] = nh;
        this.road[k] = Math.min(1, this.road[k] + dt * 4);
      }
    }
    if (changed) this._touch(0, iMax, 0, this.nz - 1);
    return changed;
  }

  reset() {
    this.h.set(this.h0);
    this.wet.fill(0);
    this.road.fill(0);
    this._touch(0, this.nx - 1, 0, this.nz - 1);
    this.flush(true);
  }

  /** へんこうを GPU へ */
  flush(force = false) {
    if (!this._dirty && !force) return;
    this._dirty = false;
    const d = this._d;
    // ほうせんは となりの たかさも つかうので 1つ ひろげる
    const i0 = Math.max(0, d.i0 - 1), i1 = Math.min(this.nx - 1, d.i1 + 1);
    const j0 = Math.max(0, d.j0 - 1), j1 = Math.min(this.nz - 1, d.j1 + 1);

    const pos = this.posAttr.array;
    for (let j = j0; j <= j1; j++) {
      const row = j * this.nx;
      for (let i = i0; i <= i1; i++) pos[(row + i) * 3 + 1] = this.h[row + i];
    }
    const L = this.loop.length;
    for (let s = 0; s < L; s++) {
      const [i, j] = this.loop[s];
      if (i < i0 || i > i1 || j < j0 || j > j1) continue;
      pos[(this.skirtTop + s) * 3 + 1] = this.h[j * this.nx + i];
    }
    this.posAttr.needsUpdate = true;
    this._recomputeNormals(i0, i1, j0, j1);
    this._recolorRect(i0, i1, j0, j1);
  }

  update(dt) {
    this.flush();
  }
}
