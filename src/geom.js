/**
 * geom.js — 断面をカーブに沿って掃引する軽量ヘルパ。
 * 樋（U字の耐火チャネル）と、その中を流れる溶銑の帯を作るのに使う。
 * Frenet フレームは水平カーブでねじれるので、常に上向きを維持する独自フレームを使う。
 */
import * as THREE from 'three';

function frames(curve, steps) {
  const pts = [], tan = [], right = [], up = [];
  const UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(curve.getPointAt(t));
    const tg = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(UP, tg);
    if (r.lengthSq() < 1e-6) r.set(1, 0, 0);
    r.normalize();
    const u = new THREE.Vector3().crossVectors(tg, r).normalize();
    tan.push(tg); right.push(r); up.push(u);
  }
  return { pts, tan, right, up };
}

/**
 * 開いた断面（折れ線）を掃引して帯／樋の内面を作る。
 * profile: [{x: 横, y: 上}] （断面ローカル）
 */
export function sweepStrip(curve, profile, steps, { uvRepeatV = 1, closed = false } = {}) {
  const f = frames(curve, steps);
  const P = profile.length;
  const N = closed ? P : P;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j < N; j++) {
      const p = profile[j % P];
      const v = f.pts[i].clone()
        .addScaledVector(f.right[i], p.x)
        .addScaledVector(f.up[i], p.y);
      pos.push(v.x, v.y, v.z);
      uv.push(j / (N - 1), (i / steps) * uvRepeatV);
    }
  }
  const ringLen = closed ? N : N;
  for (let i = 0; i < steps; i++) {
    const lim = closed ? N : N - 1;
    for (let j = 0; j < lim; j++) {
      const a = i * ringLen + j;
      const b = i * ringLen + ((j + 1) % ringLen);
      const c = (i + 1) * ringLen + ((j + 1) % ringLen);
      const d = (i + 1) * ringLen + j;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 閉じた断面（トンネル状）を掃引 */
export function sweepClosed(curve, profile, steps, opts = {}) {
  return sweepStrip(curve, profile, steps, { ...opts, closed: true });
}

/**
 * 半径がカーブに沿って変化するチューブ（出銑流の噴出に使う）。
 * radiusFn(t) -> 半径
 */
export function taperedTube(curve, steps, radial, radiusFn) {
  const f = frames(curve, steps);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = radiusFn(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const v = f.pts[i].clone()
        .addScaledVector(f.right[i], Math.cos(a) * r)
        .addScaledVector(f.up[i], Math.sin(a) * r);
      pos.push(v.x, v.y, v.z);
      uv.push(j / radial, t);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j, b = a + 1, c = (i + 1) * ring + j + 1, d = (i + 1) * ring + j;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 角を丸めた箱（玩具感を出す主要パーツ用） */
export function roundedBox(w, h, d, r = 0.08, seg = 2) {
  // three の BoxGeometry を面取りする簡易版（頂点を球状に丸める）
  const g = new THREE.BoxGeometry(w, h, d, seg + 1, seg + 1, seg + 1);
  const p = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -hw, hw), THREE.MathUtils.clamp(v.y, -hh, hh), THREE.MathUtils.clamp(v.z, -hd, hd));
    v.sub(c);
    if (v.lengthSq() > 1e-9) v.setLength(r);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
