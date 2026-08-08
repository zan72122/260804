// 自動カメラ。子どもは操作しない。縦横比に応じて必要な画角を自動計算する。
import * as THREE from '../vendor/three.module.js';
import { clamp, lerp, easeInOutCubic, easeOutCubic, clamp01 } from './util.js';

/**
 * ショット定義:
 *  dir   : 注視点から見たカメラ方向（正規化される）
 *  look  : 注視点オフセット（focus からの相対）
 *  fitW  : 収めたい横半幅（m）
 *  fitH  : 収めたい縦半高（m）
 *  fov   : 垂直画角
 *  margin: 余白倍率
 *  minY  : カメラの最低高さ
 */
export function makeShot(o) {
  return Object.assign({
    dir: new THREE.Vector3(0.55, 0.42, 1).normalize(),
    look: new THREE.Vector3(0, 2, 0),
    fitW: 8, fitH: 6, fov: 46, margin: 1.10, minY: 1.0,
  }, o);
}

export class CameraDirector {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.4, 320);
    this.focus = new THREE.Vector3();
    this.cur = { pos: new THREE.Vector3(10, 8, 16), target: new THREE.Vector3(0, 2, 0), fov: 46 };
    this.from = { pos: this.cur.pos.clone(), target: this.cur.target.clone(), fov: 46 };
    this.shot = makeShot({});
    this.tt = 1; this.dur = 1; this.ease = easeInOutCubic;
    this.aspect = 1;
    this.shake = 0; this.shakeT = 0; this.shakeFreq = 22;
    this._goal = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 46 };
    this._tmp = new THREE.Vector3();
  }

  setAspect(a) {
    this.aspect = a;
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  evalShot(shot, focus, out) {
    // 縦画面は横方向がとても狭いので、
    //  ・画角をすこし広げ
    //  ・横幅を入れるための後退量に上限をつける（木の高さを優先する）
    const portrait = this.aspect < 0.85;
    const fov = portrait ? Math.min(62, shot.fov * 1.16) : shot.fov;
    const fovRad = (fov * Math.PI) / 180;
    const tanH = Math.tan(fovRad / 2);
    const distV = shot.fitH / tanH;
    const distW = shot.fitW / (tanH * Math.max(0.2, this.aspect));
    const cap = distV * (portrait ? (shot.widthPull || 1.30) : 3.0);
    const dist = Math.min(Math.max(distV, distW), Math.max(distV, cap)) * shot.margin;
    out.target.copy(focus).add(shot.look);
    const d = this._tmp.copy(shot.dir).normalize();
    out.pos.copy(out.target).addScaledVector(d, dist);
    if (out.pos.y < shot.minY) out.pos.y = shot.minY;
    out.fov = fov;
    return out;
  }

  cut(shot, focus) {
    this.shot = shot;
    if (focus) this.focus.copy(focus);
    this.evalShot(shot, this.focus, this._goal);
    this.cur.pos.copy(this._goal.pos);
    this.cur.target.copy(this._goal.target);
    this.cur.fov = this._goal.fov;
    this.from.pos.copy(this.cur.pos);
    this.from.target.copy(this.cur.target);
    this.from.fov = this.cur.fov;
    this.tt = 1;
  }

  move(shot, dur = 1.6, ease = easeInOutCubic) {
    this.from.pos.copy(this.cur.pos);
    this.from.target.copy(this.cur.target);
    this.from.fov = this.cur.fov;
    this.shot = shot;
    this.tt = 0;
    this.dur = Math.max(0.001, dur);
    this.ease = ease;
  }

  setFocus(p) { this.focus.copy(p); }
  addShake(amount) { this.shake = Math.max(this.shake, amount); }

  update(dt) {
    this.evalShot(this.shot, this.focus, this._goal);
    this.tt = Math.min(1, this.tt + dt / this.dur);
    const k = this.ease(this.tt);
    this.cur.pos.lerpVectors(this.from.pos, this._goal.pos, k);
    this.cur.target.lerpVectors(this.from.target, this._goal.target, k);
    this.cur.fov = lerp(this.from.fov, this._goal.fov, k);

    // シェイク
    this.shakeT += dt;
    let sx = 0, sy = 0, sz = 0;
    if (this.shake > 0.0005) {
      const s = this.shake;
      sx = Math.sin(this.shakeT * this.shakeFreq * 1.0) * s;
      sy = Math.sin(this.shakeT * this.shakeFreq * 1.37 + 1.1) * s * 0.85;
      sz = Math.sin(this.shakeT * this.shakeFreq * 0.83 + 2.2) * s * 0.5;
      this.shake *= Math.exp(-dt * 5.2);
    }
    this.camera.position.set(this.cur.pos.x + sx, Math.max(0.7, this.cur.pos.y + sy), this.cur.pos.z + sz);
    this.camera.fov = this.cur.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.cur.target.x + sx * 0.3, this.cur.target.y + sy * 0.3, this.cur.target.z);
  }
}

/* ---------- ゲーム内の標準ショット ---------- */
const D = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const L = (x, y, z) => new THREE.Vector3(x, y, z);

/* カメラは常に -X 側（キャリア車両の反対側 = ゲート側）に置く。
   そうすると刃・幹・根鉢が車体に隠れない。 */
export const SHOTS = {
  // 全景：木と機械の関係
  wide: (treeH = 9) => makeShot({
    dir: D(-0.58, 0.44, 1.0), look: L(2.4, treeH * 0.42, 0),
    fitW: 13.5, fitH: treeH * 0.62, fov: 44, margin: 1.14, minY: 3.0, widthPull: 1.45,
  }),
  // タイトル用のゆったりした全景
  title: (treeH = 9) => makeShot({
    dir: D(-0.72, 0.30, 1.0), look: L(2.6, treeH * 0.34, 0),
    fitW: 15.5, fitH: treeH * 0.80, fov: 42, margin: 1.20, minY: 3.0, widthPull: 1.6,
  }),
  // 斜め上 3/4：刃が木を囲んでいるのを見る
  threeQuarter: () => makeShot({
    dir: D(-0.66, 0.40, 0.95), look: L(0, 2.1, 0),
    fitW: 7.6, fitH: 4.4, fov: 46, margin: 1.08, minY: 2.4,
  }),
  // 刃の接写（方位角 az を正面に）
  bladeClose: (az) => makeShot({
    // レール・シリンダーが刃を隠さないよう、方位を少しずらして低めから見る
    dir: D(Math.cos(az + 0.36), 0.40, Math.sin(az + 0.36)),
    look: L(Math.cos(az) * 1.55, 0.08, Math.sin(az) * 1.55),
    fitW: 4.3, fitH: 3.0, fov: 44, margin: 1.04, minY: 1.0,
  }),
  // 地下カットアウェイ：低い位置から根鉢を横から見る
  cutaway: (az = Math.PI / 2) => makeShot({
    dir: D(Math.cos(az), 0.46, Math.sin(az)), look: L(0, -0.95, 0),
    fitW: 6.4, fitH: 4.6, fov: 46, margin: 1.05, minY: 1.5,
  }),
  // 抜ける瞬間：低めの中景
  liftLow: () => makeShot({
    dir: D(-0.5, 0.24, 1.0), look: L(0, 1.5, 0),
    fitW: 5.9, fitH: 3.7, fov: 46, margin: 1.06, minY: 1.2,
  }),
  // ドリーアウト：木全体＋宙の根鉢＋残った穴
  dollyOut: (treeH = 9) => makeShot({
    dir: D(-0.52, 0.34, 1.0), look: L(0.8, treeH * 0.48 + 1.4, 0),
    fitW: 12.5, fitH: treeH * 0.80, fov: 44, margin: 1.12, minY: 3.6, widthPull: 1.22,
  }),
  // 運搬中：機械を横から追う
  haul: (treeH = 9, bias = 0) => makeShot({
    dir: D(-0.10, 0.32, 1.0), look: L(1.6 + bias, treeH * 0.46 + 1.6, 0),
    fitW: 15.5, fitH: treeH * 0.74, fov: 44, margin: 1.12, minY: 3.4, widthPull: 1.5,
  }),
  // 穴の斜め上：位置合わせ
  holeAbove: () => makeShot({
    dir: D(-0.45, 0.90, 0.85), look: L(0, 0.4, 0),
    fitW: 5.8, fitH: 4.6, fov: 48, margin: 1.08, minY: 4.2,
  }),
  // 下ろす：根鉢と穴を同時に
  lowering: () => makeShot({
    dir: D(-0.45, 0.32, 1.0), look: L(0, 2.6, 0),
    fitW: 8.2, fitH: 5.6, fov: 46, margin: 1.08, minY: 1.8,
  }),
  // 水やり：根元の接写
  water: () => makeShot({
    dir: D(-0.55, 0.50, 1.0), look: L(0, 0.8, 0),
    fitW: 4.8, fitH: 3.4, fov: 46, margin: 1.06, minY: 2.0,
  }),
  // 完成
  finish: (treeH = 9) => makeShot({
    dir: D(-0.5, 0.34, 1.0), look: L(0.4, treeH * 0.44, 0),
    fitW: 10.5, fitH: treeH * 0.64, fov: 44, margin: 1.18, minY: 3.0, widthPull: 1.35,
  }),
};
