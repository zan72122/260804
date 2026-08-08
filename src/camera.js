/**
 * camera.js — 「カメラ鎖」。
 * 4歳児に視点を探させない。工程ごとに最適なショットへゲーム側が導く。
 * 各ショットは 横画面 / 縦画面 の2つの構図を持ち、端末を回しても主役が見える。
 * a: 到着ポーズ / b: ゆっくり流れる終着ポーズ（省略時は a のまま）
 */
import * as THREE from 'three';

const P = (x, y, z) => [x, y, z];

/** lift: 画面内で主役を上へ寄せる量（下の指で隠れないように） */
export const SHOTS = {
  /* 1. 全景：高炉・出銑口・左右の機械の位置関係 */
  wide: {
    L: { a: { p: P(1.4, 5.0, 19.5), t: P(0.4, 3.2, 2.6), fov: 42 }, b: { p: P(-1.6, 4.6, 18.2), t: P(0.0, 3.0, 2.4), fov: 42 }, drift: 18, lift: 0.10 },
    Pt: { a: { p: P(1.2, 5.6, 17.6), t: P(0.5, 3.1, 2.0), fov: 54 }, b: { p: P(-0.9, 5.3, 16.6), t: P(0.1, 3.0, 1.8), fov: 54 }, drift: 18, lift: 0.07 },
  },
  /* 2. ドリル接近：機械の後ろ上から寄っていく */
  drillIn: {
    L: { a: { p: P(-8.8, 4.5, 11.0), t: P(-1.5, 2.7, 2.3), fov: 42 }, b: { p: P(-6.0, 3.9, 8.6), t: P(-0.7, 2.5, 1.8), fov: 40 }, drift: 6.0, lift: 0.05 },
    Pt: { a: { p: P(-11.3, 2.9, 6.8), t: P(-0.9, 2.55, 1.55), fov: 44 }, b: { p: P(-9.0, 3.2, 5.9), t: P(-0.5, 2.45, 1.35), fov: 42 }, drift: 6.0, lift: 0.10 },
  },
  /* 3. ドリル先端のアクション・クローズアップ */
  drillWork: {
    L: { a: { p: P(3.5, 3.45, 6.2), t: P(-0.15, 2.34, 1.15), fov: 34 }, b: { p: P(2.9, 3.20, 5.2), t: P(-0.10, 2.31, 1.10), fov: 33 }, drift: 14, lift: 0.13 },
    Pt: { a: { p: P(3.9, 3.85, 6.7), t: P(-0.10, 2.34, 1.10), fov: 38 }, b: { p: P(3.3, 3.60, 5.8), t: P(-0.06, 2.31, 1.05), fov: 37 }, drift: 14, lift: 0.20 },
  },
  /* 4. 貫通直後：少し引く */
  breakOut: {
    L: { a: { p: P(2.6, 3.9, 8.2), t: P(0.1, 2.35, 1.7), fov: 44 }, b: { p: P(3.0, 4.1, 9.2), t: P(0.2, 2.2, 2.1), fov: 44 }, drift: 6, lift: 0.02 },
    Pt: { a: { p: P(2.4, 4.6, 8.6), t: P(0.1, 2.30, 1.8), fov: 52 }, b: { p: P(2.7, 4.9, 9.6), t: P(0.2, 2.15, 2.2), fov: 52 }, drift: 6, lift: 0.05 },
  },
  /* 5. 溶銑が樋を流れるリビール */
  flow: {
    L: { a: { p: P(2.8, 6.6, 11.4), t: P(0.6, 1.7, 3.4), fov: 46 }, b: { p: P(3.6, 5.6, 14.6), t: P(1.6, 1.1, 6.9), fov: 46 }, drift: 9, lift: 0.00 },
    Pt: { a: { p: P(1.9, 7.2, 11.0), t: P(0.6, 1.7, 3.4), fov: 56 }, b: { p: P(2.6, 6.2, 14.0), t: P(1.6, 1.1, 6.9), fov: 56 }, drift: 9, lift: 0.00 },
  },
  /* 6. mud gun 接近（ごごごご……） */
  mudIn: {
    L: { a: { p: P(9.4, 4.5, 11.4), t: P(1.9, 2.7, 2.5), fov: 42 }, b: { p: P(6.4, 3.9, 8.8), t: P(0.8, 2.5, 1.9), fov: 40 }, drift: 6.0, lift: 0.05 },
    Pt: { a: { p: P(11.6, 2.9, 7.4), t: P(0.9, 2.55, 1.95), fov: 44 }, b: { p: P(9.3, 3.2, 6.5), t: P(0.5, 2.45, 1.65), fov: 42 }, drift: 6.0, lift: 0.10 },
  },
  /* 7. 出銑口付近のクローズアップ（ノズルが密着） */
  mudClose: {
    L: { a: { p: P(-3.7, 3.45, 6.2), t: P(0.15, 2.34, 1.30), fov: 36 }, b: { p: P(-3.1, 3.20, 5.3), t: P(0.10, 2.31, 1.2), fov: 35 }, drift: 12, lift: 0.13 },
    Pt: { a: { p: P(-4.1, 3.85, 6.8), t: P(0.12, 2.34, 1.25), fov: 38 }, b: { p: P(-3.4, 3.60, 5.9), t: P(0.08, 2.31, 1.15), fov: 37 }, drift: 12, lift: 0.20 },
  },
  /* 8. 断面クローズアップ：閉塞材が内部へ押し込まれるのを見せる */
  cutaway: {
    L: { a: { p: P(-4.3, 2.88, 2.6), t: P(0.35, 2.26, 0.35), fov: 28 }, b: { p: P(-3.9, 2.80, 2.35), t: P(0.30, 2.24, 0.28), fov: 27 }, drift: 12, lift: 0.11 },
    Pt: { a: { p: P(-3.5, 4.6, 4.8), t: P(0.10, 2.30, 0.75), fov: 46 }, b: { p: P(-3.1, 4.3, 4.3), t: P(0.06, 2.28, 0.65), fov: 45 }, drift: 12, lift: 0.16 },
  },
};

const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export function createCameraRig(camera) {
  const cur = { p: new THREE.Vector3(), t: new THREE.Vector3(), fov: 45, lift: 0 };
  const want = { p: new THREE.Vector3(), t: new THREE.Vector3(), fov: 45, lift: 0 };
  let shot = SHOTS.wide, elapsed = 0, tau = 0.75, shake = 0, shakeDecay = 3.0;
  let portrait = false, W = 1, H = 1;
  let started = false;

  function pose(out) {
    const s = portrait ? shot.Pt : shot.L;
    const u = s.drift ? THREE.MathUtils.smoothstep(elapsed / s.drift, 0, 1) : 0;
    const b = s.b || s.a;
    out.p.copy(v(s.a.p)).lerp(v(b.p), u);
    out.t.copy(v(s.a.t)).lerp(v(b.t), u);
    out.fov = THREE.MathUtils.lerp(s.a.fov, b.fov ?? s.a.fov, u);
    out.lift = s.lift || 0;
  }

  const api = {
    get shot() { return shot; },
    cut(name, { instant = false, speed = 0.62 } = {}) {
      const next = SHOTS[name];
      if (!next) return;
      shot = next; elapsed = 0; tau = speed;
      pose(want);
      if (instant || !started) {
        cur.p.copy(want.p); cur.t.copy(want.t); cur.fov = want.fov; cur.lift = want.lift;
        started = true;
      }
    },
    punch(amount = 0.35, decay = 3.2) { shake = Math.max(shake, amount); shakeDecay = decay; },
    setViewport(w, h) { W = w; H = h; portrait = h > w * 1.02; },
    get portrait() { return portrait; },
    update(dt) {
      elapsed += dt;
      pose(want);
      const k = 1 - Math.exp(-dt / Math.max(0.001, tau));
      cur.p.lerp(want.p, k);
      cur.t.lerp(want.t, k);
      cur.fov += (want.fov - cur.fov) * k;
      cur.lift += (want.lift - cur.lift) * k;

      shake = Math.max(0, shake - dt * shakeDecay * shake - dt * 0.05);
      const sx = shake ? (Math.random() - 0.5) * shake : 0;
      const sy = shake ? (Math.random() - 0.5) * shake : 0;

      camera.position.set(cur.p.x + sx, cur.p.y + sy, cur.p.z);
      camera.lookAt(cur.t.x, cur.t.y + sy * 0.4, cur.t.z);
      if (Math.abs(camera.fov - cur.fov) > 0.001) { camera.fov = cur.fov; }
      // 主役を画面の上寄りに置く（下半分は指のためのゾーン）
      const off = cur.lift * H;
      if (off > 0.5) camera.setViewOffset(W, H, 0, off, W, H);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    },
  };
  api.cut('wide', { instant: true });
  return api;
}
