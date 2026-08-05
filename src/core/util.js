/**
 * 小さなユーティリティ集。
 * ゲーム全体で使う数学ヘルパーと、手続き的にテクスチャを作る関数をまとめている。
 */
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a, b, v) => {
  const t = clamp(invLerp(a, b, v), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** フレームレートに依存しない指数補間。dt 秒で現在値を目標値へ寄せる。 */
export const damp = (current, target, smoothing, dt) =>
  lerp(current, target, 1 - Math.pow(smoothing, dt));

/** Vector3 版の damp。 */
export const dampV3 = (current, target, smoothing, dt) => {
  const t = 1 - Math.pow(smoothing, dt);
  current.x = lerp(current.x, target.x, t);
  current.y = lerp(current.y, target.y, t);
  current.z = lerp(current.z, target.z, t);
  return current;
};

/** 決定的な擬似乱数。見た目を毎回同じにしたい配置に使う。 */
export function makeRandom(seed = 1) {
  let s = seed >>> 0 || 1;
  return function random() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const randRange = (rng, a, b) => a + (b - a) * rng();
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/** ふんわり光る円のスプライト。泡・ホコリ・きらめきに使い回す。 */
export function makeGlowTexture(size = 128, inner = '#ffffff', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 四芒星のきらめき。宝石みたいなハイライトに。 */
export function makeSparkleTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 2; i++) {
    g.save();
    g.translate(h, h);
    g.rotate((i * Math.PI) / 2);
    const grad2 = g.createLinearGradient(-h, 0, h, 0);
    grad2.addColorStop(0, 'rgba(255,255,255,0)');
    grad2.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad2.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad2;
    g.fillRect(-h, -size * 0.018, size, size * 0.036);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 木の葉のアルファマップ。落ち葉の板ポリに貼る。 */
export function makeLeafTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.scale(size / 128, size / 128);
  g.beginPath();
  g.moveTo(0, -58);
  g.bezierCurveTo(42, -34, 44, 22, 0, 58);
  g.bezierCurveTo(-44, 22, -42, -34, 0, -58);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  // 葉脈をうっすら。アルファを少し抜いて厚みの表情を出す。
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(0, -54); g.lineTo(0, 54); g.stroke();
  g.lineWidth = 1.4;
  for (let i = -4; i <= 4; i++) {
    const y = i * 11;
    g.beginPath();
    g.moveTo(0, y);
    g.quadraticCurveTo(16 * Math.sign(i || 1), y + 4, 30 * Math.sign(i || 1), y + 16);
    g.stroke();
    g.beginPath();
    g.moveTo(0, y);
    g.quadraticCurveTo(-16 * Math.sign(i || 1), y + 4, -30 * Math.sign(i || 1), y + 16);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 砂地のこまかな粒＋うねりを描いたラフネス／ノーマル用のグレースケール。 */
export function makeSandTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8a8a';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  const rng = makeRandom(7);
  for (let i = 0; i < d.length; i += 4) {
    const n = 128 + (rng() - 0.5) * 90;
    d[i] = d[i + 1] = d[i + 2] = n;
  }
  g.putImageData(img, 0, 0);
  // 大きめのうねりを重ねて、粒だけの単調さを消す。
  g.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 70; i++) {
    const x = rng() * size, y = rng() * size, r = 30 + rng() * 120;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const v = rng() > 0.5 ? 210 : 60;
    grad.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 現在のカメラで、指定した z 平面において画面に映る半幅・半高を返す。 */
export function visibleExtentsAt(camera, z) {
  const dist = Math.abs(camera.position.z - z);
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
  return { halfW: halfH * camera.aspect, halfH };
}
