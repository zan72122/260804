// src/game/coords.ts
// 所有: A5 (flow) — A7統合フェーズで座標を実機の見た目に合わせて調整。
//
// ゲーム進行(flow.ts)・故障(faults.ts)が使うワールド座標のマジックナンバーを
// すべてここに一元化する。可能な限り「見た目の一次情報源」である
// render/scene.ts の WORLD と sim/escalator.ts の ESC_GEOM から import し、
// 座標の二重管理・ズレを防ぐ(A7統合裁定: 2026-08-03)。
//
// 座標系(CONTRACT.md準拠): 原点(0,0)=下端乗り口の床、x+=上り方向(水平投影)、
// y-=上。傾斜30°、水平投影長520、階高300。
//
// 【点検床板の位置について】(A7統合裁定・確定)
// CONTRACT.md 「点検床板は上端の床」に従い、床板の取っ手・開閉操作・ステップ
// 引き抜き位置は「上端(インクライン上端付近)」に統一する。scene.ts の
// WORLD.plateHandle/plateCenter をそのまま流用し、ステップ引き抜き位置
// (stepPullT)も床板のすぐ下(incline上端寄り、t≈0.30)に置く。

import type { EscalatorModel } from '../core/types';
import { WORLD } from '../render/scene';
import { ESC_GEOM } from '../sim/escalator';

export interface WorldPoint { x: number; y: number; }
export interface WorldSpot extends WorldPoint { r: number; }

function spot(p: { x: number; y: number }, r: number): WorldSpot {
  return { x: p.x, y: p.y, r };
}

// incline 区間(t < T1)上の点を求める補助(escalator.ts の生成ロジックと同じ線形補間)。
// stepPullT のような「ループが止まっている間だけ使う固定寄りの目印」の算出に使う。
function inclinePoint(t: number): WorldPoint {
  const { A0, A1 } = ESC_GEOM.main.points;
  const frac = t / ESC_GEOM.main.t.T1;
  return { x: A0.x + (A1.x - A0.x) * frac, y: A0.y + (A1.y - A0.y) * frac };
}

// --- ステップ引き抜き位置(上端の点検床板のすぐ下、incline上端付近) ---
const STEP_PULL_T = 0.3; // incline上端寄り(t≈0.28〜0.32目安、T1≈0.344)
const STEP_POINT = inclinePoint(STEP_PULL_T);

export const COORDS = {
  // --- 下端乗り口まわり(安全装備一式。scene.ts WORLD と同値を共有) ---
  fenceParked: { x: -190, y: 40 } as WorldPoint, // 柵の待機置き場(工具箱寄り)
  fenceDrop: spot(WORLD.fenceDrop, 95), // 柵の設置先(下端乗り口脇)

  stopSwitch: spot(WORLD.switchPos, 70), // 停止スイッチ(大きな赤ボタン)
  lockIcon: spot(WORLD.keyholePos, 70), // ロック鍵アイコン

  // --- 床板の取っ手(上端の点検床板。scene.ts WORLD.plateHandle と同値) ---
  plateHandle: spot(WORLD.plateHandle, 90),

  // --- ステップ引き抜き/復旧(床板直下、incline上端付近) ---
  stepPullT: STEP_PULL_T,
  stepHandleSpot: { ...STEP_POINT, r: 80 } as WorldSpot, // ハンドル装着位置(=引き抜き位置)
  stepGapDrop: { ...STEP_POINT, r: 100 } as WorldSpot, // 隙間へ戻すドロップ先(未使用時のフォールバック値。実際は stepGapT で追跡)

  // --- 下部歯車まわりのクランクホイール(scene.ts WORLD.crankCenter と同値) ---
  crankWheel: spot(WORLD.crankCenter, 120),

  // --- 工具箱(ピンク) ---
  toolbox: { x: -230, y: 95 } as WorldPoint,
  toolboxNewRoller: { x: -230, y: 60, r: 80 } as WorldSpot, // 新品ローラー置き場
  removedRollerBin: { x: -90, y: -230, r: 110 } as WorldSpot, // 外した古ローラーの置き場

  // --- notice フェーズの💥アイコン(異常に気付く合図) ---
  noticeAlert: { x: 300, y: -260, r: 95 } as WorldSpot,

  // --- 故障のループ上アンカー位置をランダム選出する際の許容範囲(t) ---
  // incline / return 区間の中央寄りのみを使い、上下ターンや乗り口/降り口、
  // および床板/ステップ引き抜き位置(t≈0.30)の近くを避ける
  // (ホットスポットの取り合い・見た目の重なりを防ぐ)。
  faultAnchorRanges: {
    incline: { lo: 0.06, hi: 0.2 },
    return: { lo: 0.6, hi: 0.9 }
  },

  // --- アニメーション速度(1秒あたりの進度) ---
  plateAnimSpeed: 1.25, // plateOpen 0<->1 の速さ(≒0.8秒)
  stepAnimSpeed: 1.8, // stepRemoved 0<->1 の速さ(≒0.55秒)

  // --- 試運転速度 ---
  slowSpeed: 0.035,
  normalSpeed: 0.11,
  noticeSpeed: 0.06,

  // --- ヒント演出タイミング(秒) ---
  hintFirstDelay: 4,
  hintRepeatInterval: 8,

  // --- お祝い演出の長さ(秒) ---
  celebrateDuration: 3.2,

  // --- カメラフレーミングの余白(px、ワールド単位) ---
  cameraPad: {
    tightPortrait: { x: 150, y: 175 },
    tightLandscape: { x: 170, y: 195 },
    widePortrait: { x: 110, y: 130 },
    wideLandscape: { x: 130, y: 150 }
  },
  cameraScaleMin: 0.35,
  cameraScaleMax: 2.6
};

// ---------------------------------------------------------------------------
// 「今、ステップの隙間がループ上のどのt位置にあるか」(A7統合修正)。
// crankCheck で手回しすると loopT が進み、抜いた隙間もベルトと一緒に移動する
// (scene.ts は removedStep index を stepT(i) で毎フレーム追跡して描画している)。
// restoreStep のホットスポット/カメラ/持ち手ステップの表示が、抜いた瞬間の
// 固定位置(stepPullT)のまま止まっていると、たくさん回した後に隙間の実位置と
// ズレて「戻せない」誤操作の原因になる。removedStep が確定している間は
// そのインデックスの現在位置を、まだ抜いていない間は固定の引き抜き位置を返す。
// ---------------------------------------------------------------------------
export function stepGapT(model: EscalatorModel): number {
  return model.removedStep !== null ? model.stepT(model.removedStep) : STEP_PULL_T;
}

// 「抜いたステップを一時的に置く場所」も、隙間(stepGapT)からの相対オフセットで
// 追従させる(A7統合修正)。固定のワールド座標のままだと、crankCheckで大きく
// 回した後は隙間から遠く離れてしまい、縦画面の一点ズームカメラで両方が同時に
// 画面に入らず「どこに置けばいいか見えない」誤操作の原因になる。
const STEP_PARKED_OFFSET: WorldPoint = { x: -130, y: -60 };

export function stepParkedFor(model: EscalatorModel): WorldPoint {
  const p = model.pathPoint(stepGapT(model));
  return { x: p.x + STEP_PARKED_OFFSET.x, y: p.y + STEP_PARKED_OFFSET.y };
}
