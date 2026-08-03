// src/game/coords.ts
// 所有: A5 (flow)
//
// ゲーム進行(flow.ts)・故障(faults.ts)が使うワールド座標のマジックナンバーを
// すべてここに一元化する。統合フェーズ(A7)が実機の見た目に合わせて数値だけ
// 調整できるように、ロジック側にハードコードしない方針。
//
// 座標系(CONTRACT.md準拠): 原点(0,0)=下端乗り口の床、x+=上り方向(水平投影)、
// y-=上。傾斜30°、水平投影長520、階高300。上下に水平助走部(各~100)。
// EscalatorModel.pathPoint(t)/handrailPoint(t) はこのローカル座標をそのまま
// ワールド座標として返す(scene側で追加変換しない想定)ので、ループ上の位置が
// 欲しい場合は基本 escalator.pathPoint(t) を直接使い、固定の操作パーツ(柵・
// スイッチ・鍵・取っ手・クランク・工具箱等)だけここの定数を使う。

export interface WorldPoint { x: number; y: number; }
export interface WorldSpot extends WorldPoint { r: number; }

export const COORDS = {
  // --- 下端乗り口まわり(x≈-60付近) ---
  fenceParked: { x: -190, y: 40 } as WorldPoint, // 柵の待機置き場(工具箱寄り)
  fenceDrop: { x: -55, y: -30, r: 95 } as WorldSpot, // 柵の設置先(下端乗り口脇)

  stopSwitch: { x: -60, y: -95, r: 70 } as WorldSpot, // 停止スイッチ(大きな赤ボタン)
  lockIcon: { x: -60, y: -15, r: 70 } as WorldSpot, // ロック鍵アイコン

  // --- 床板の取っ手(開閉共通、下端乗り口の床) ---
  plateHandleBottom: { x: 15, y: -55, r: 80 } as WorldSpot,

  // --- 上端床板(上端助走部。将来の演出用に予約) ---
  topPlate: { x: 570, y: -300 } as WorldPoint,

  // --- ステップ引き抜き/復旧 ---
  stepPullT: 0.045, // ループ上、下端付近で引き抜くステップの位相(t)
  stepHandleSpot: { x: 65, y: -35, r: 80 } as WorldSpot, // ハンドル装着位置
  stepParked: { x: -230, y: -235 } as WorldPoint, // 抜いたステップの置き場(画面端)
  stepGapDrop: { x: 65, y: -35, r: 100 } as WorldSpot, // 隙間へ戻すドロップ先

  // --- 下部歯車まわりのクランクホイール ---
  crankWheel: { x: 0, y: 65, r: 120 } as WorldSpot,

  // --- 工具箱(ピンク) ---
  toolbox: { x: -230, y: 95 } as WorldPoint,
  toolboxNewRoller: { x: -230, y: 60, r: 80 } as WorldSpot, // 新品ローラー置き場
  removedRollerBin: { x: -90, y: -230, r: 110 } as WorldSpot, // 外した古ローラーの置き場

  // --- notice フェーズの💥アイコン(異常に気付く合図) ---
  noticeAlert: { x: 300, y: -260, r: 95 } as WorldSpot,

  // --- 故障のループ上アンカー位置をランダム選出する際の許容範囲(t) ---
  // incline / return 区間の中央寄りのみを使い、上下ターンや乗り口/降り口の
  // 近くを避ける(ホットスポットの取り合いを防ぐ)。
  faultAnchorRanges: {
    incline: { lo: 0.1, hi: 0.4 },
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
