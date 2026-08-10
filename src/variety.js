// バラエティ＋株分けプランの純ロジックモジュール。
// シーン操作・flowers.add 呼び出しは一切行わず、プランオブジェクトの配列を返すだけ。
import * as THREE from 'three';
import { FLOWER_TYPE_LIST } from './flowers.js';

// 別種・白ミックス時のベース色（うっすらクリームがかった白）
export const WHITE_MIX = 0xfff2ef;

// chosen.type 以外の花種2つを返す
function otherTypes(type) {
  return FLOWER_TYPE_LIST.filter(t => t !== type);
}

// 0〜1 の範囲を [min, max] へ線形マップ
function lerp(min, max, u) {
  return min + (max - min) * u;
}

// chosen.colorHex を HSL でゆらす（main.js の jitterColor 相当）
// hAmount: 色相の振れ幅（±hAmount/2）、lAmount: 明度の振れ幅（±lAmount/2）
function jitterHex(colorHex, hAmount, lAmount) {
  return new THREE.Color(colorHex)
    .offsetHSL((Math.random() - 0.5) * hAmount, 0, (Math.random() - 0.5) * lAmount)
    .getHex();
}

// chosen.colorHex を明るくした色（lightness を加算）
function brightenHex(colorHex, lightness) {
  return new THREE.Color(colorHex).offsetHSL(0, 0, lightness).getHex();
}

// role に応じて種・色・スケールを決定する
export function pickVariety(chosen, role) {
  if (role === 'player') {
    return {
      type: chosen.type,
      colorHex: jitterHex(chosen.colorHex, 0.06, 0.16),
      scale: lerp(0.9, 1.4, Math.random()),
    };
  }
  // child / accent 共通の配合ロジック
  const others = otherTypes(chosen.type);
  let type;
  const rt = Math.random();
  if (rt < 0.7) {
    type = chosen.type;
  } else if (rt < 0.85) {
    type = others[0];
  } else {
    type = others[1];
  }

  let colorHex;
  const rc = Math.random();
  if (rc < 0.6) {
    colorHex = jitterHex(chosen.colorHex, 0.06, 0.16);
  } else if (rc < 0.8) {
    colorHex = WHITE_MIX;
  } else {
    colorHex = brightenHex(chosen.colorHex, 0.15);
  }

  const scale = role === 'accent'
    ? lerp(1.0, 1.5, Math.random())
    : lerp(0.6, 1.7, Math.random());

  return { type, colorHex, scale };
}

// アーチの株分け増幅プラン：親の t 値配列からラウンドロビンで子株を生成
export function amplifyArchPlan(ts, chosen, targetTotal = 55) {
  const plan = [];
  if (!ts || ts.length === 0) return plan;
  const total = Math.min(targetTotal, ts.length * 6);
  for (let i = 0; i < total; i++) {
    const parentT = ts[i % ts.length];
    let t = parentT + (Math.random() - 0.5) * 0.12; // ±0.06
    t = Math.min(0.98, Math.max(0.02, t));
    const v = pickVariety(chosen, 'child');
    plan.push({ t, type: v.type, colorHex: v.colorHex, scale: v.scale });
  }
  return plan;
}

// テーブルの株分け増幅プラン：既存の花の周囲へ極座標オフセットで子株を散らす
export function amplifyTablePlan(locals, chosen, targetPerTable = 26) {
  const plan = [];
  const localsLen = locals ? locals.length : 0;
  const total = Math.max(0, targetPerTable - localsLen);
  if (total <= 0 || localsLen === 0) return plan;
  const clothRadius = 0.72;
  for (let i = 0; i < total; i++) {
    const parent = locals[i % localsLen];
    const angle = Math.random() * Math.PI * 2;
    const r = lerp(0.06, 0.16, Math.random());
    let x = parent.x + Math.cos(angle) * r;
    let z = parent.z + Math.sin(angle) * r;
    const d = Math.hypot(x, z);
    if (d > clothRadius) {
      const k = clothRadius / d;
      x *= k; z *= k;
    }
    const v = pickVariety(chosen, 'child');
    plan.push({ x, z, type: v.type, colorHex: v.colorHex, scale: v.scale });
  }
  return plan;
}

// 吊りボールの追加株プラン：正規化済みのランダム方向（やや下半球寄り）
export function ballExtraPlan(chosen, n = 4) {
  const plan = [];
  for (let i = 0; i < n; i++) {
    const yaw = Math.random() * Math.PI * 2;
    // y は -1〜0.4 の範囲に偏らせ、下半球寄りにする
    const y = lerp(-1, 0.4, Math.random());
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const dir = new THREE.Vector3(Math.cos(yaw) * radius, y, Math.sin(yaw) * radius).normalize();
    const v = pickVariety(chosen, 'child');
    plan.push({ dir, type: v.type, colorHex: v.colorHex, scale: v.scale });
  }
  return plan;
}
