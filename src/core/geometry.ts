// ============================================================================
// 機械の正準ジオメトリ（machine-space） ⚠️ オーケストレーター所有・編集禁止。
// sim（ピンの移動計算）と render（機械の描画）は必ずこの定数を共有して整合させる。
//
// machine-space: y下向き、単位は任意（約1mm相当）。全体 1800 x 1100。
// 【シーン'machine'のカットモデル側面図】
//   右側=レーン/手前(プレイヤー側)、左側=機械の奥。
//   循環: ピンはピット(右下)→ベルトで左へ→エレベーターで上へ→上部搬送路で右へ
//         →選別機(くるん)→ラック→ピンテーブル→レーンへストン。
//   ボールはピットから地下(最下部)を右へ→フラップ→リフトでポン。
// ============================================================================

export const WORLD = { w: 1800, h: 1100 } as const;

/** レーン面（機械シーン内の右側に見える部分） */
export const LANE = { deckX: 1560, surfaceY: 820, leftX: 1380, rightX: 1800 } as const;

/** ピンデッキ（10本が立つ場所）中心 */
export const PIN_DECK = { x: 1560, y: 815 } as const;

/** ピット（倒れたピン・ボールが落ちる場所） */
export const PIT = { x: 1180, y: 900, w: 240, h: 140 } as const;

/** 回収ベルト: ピット下からエレベーター取込口へ（右→左）。
    折れ線。CORNER_T はピン詰まり(pin-jam)が起きる曲がり角の t 値 */
export const BELT_PATH: ReadonlyArray<readonly [number, number]> = [
  [1300, 945], [560, 945], [430, 900], [340, 860],
];
export const BELT_CORNER_T = 0.72; // [560,945]付近の曲がり角
export const BELT_Y = 945;

/** ベルト張力ローラー（belt-derail 故障、指でなぞって戻す） */
export const ROLLER = { x: 860, y: 975, r: 30 } as const;

/** エレベーターホイール（回転してピンを持ち上げる） */
export const ELEVATOR = {
  cx: 250, cy: 545, r: 270,
  intake: [340, 830] as readonly [number, number],   // 下部取込
  release: [330, 265] as readonly [number, number],  // 上部放出
} as const;

/** 上部搬送路（左→右）。終端はラック投入口 */
export const TOP_PATH: ReadonlyArray<readonly [number, number]> = [
  [340, 250], [700, 235], [1130, 235],
];

/** 選別機（くるんが起きる場所）。TOP_PATH 上 t≈0.45 */
export const ORIENTER = { x: 700, y: 235, w: 180, h: 130 } as const;
export const ORIENTER_T = 0.45;

/** 10本ラック（4-3-2-1の台形を疑似奥行きで表示）。
    slots[i] = 各スロット中心。0..3=最前列(下)…9=最奥(上)。 */
export const RACK = {
  x: 1290, y: 330, w: 300, h: 190,
  slots: [
    [1180, 400], [1255, 400], [1330, 400], [1405, 400],
    [1218, 348], [1293, 348], [1368, 348],
    [1255, 300], [1330, 300],
    [1293, 256],
  ] as ReadonlyArray<readonly [number, number]>,
} as const;

/** ピンテーブル: yUp から yDown(レーン面直上)まで降りる */
export const TABLE = { x: 1290, w: 340, yUp: 470, yDown: 790 } as const;

/** スイープバー（倒れたピンをピットへ送る）。posはレーン奥→ピットの0..1 */
export const SWEEP = { x0: 1680, x1: 1400, y: 760 } as const;

/** ボールリターン地下経路: ピット → 地下 → 右端リフトで手前へ */
export const BALL_PATH: ReadonlyArray<readonly [number, number]> = [
  [1250, 940], [1250, 1030], [1450, 1050], [1700, 1050], [1735, 950],
];
/** リターンフラップ（flap-stuck 故障）。BALL_PATH 上 t≈0.55 */
export const FLAP = { x: 1560, y: 1040 } as const;
export const FLAP_T = 0.55;
/** ボール出口（ポン） */
export const BALL_EXIT = { x: 1735, y: 930 } as const;

/** 機械ハウジング（奥カバー/扉が覆う範囲） */
export const HOUSING = { x: 60, y: 140, w: 1280, h: 900 } as const;

/** 扉の取っ手（横スワイプでパカッ） */
export const DOOR_HANDLE = { x: 1290, y: 560 } as const;

/** 操作パネル＋安全レバー（下スワイプでガコン） */
export const PANEL = { x: 1520, y: 480, w: 200, h: 260 } as const;
export const SAFETY_LEVER = { x: 1620, y: 560, travel: 140 } as const;

/** ピンテーブル操作レバー */
export const TABLE_LEVER = { x: 1620, y: 560, travel: 120 } as const;

/** ピンの標準サイズ（machine-space） */
export const PIN_SIZE = { h: 96, r: 26 } as const;
export const BALL_R = 48;

// ── シーン'lane'（正面ビュー）の正準座標。ワールド 1000 x 1600 (縦長) ──
export const LANE_VIEW = {
  w: 1000, h: 1600,
  /** ファウルライン（プレイヤー手前）y */
  nearY: 1380,
  /** ピンデッキy（奥） */
  deckY: 420,
  centerX: 500,
  /** ピン間隔（正面透視で描く際の基準） */
  pinGapX: 62, pinGapY: 40,
  /** 機械室の扉（奥の壁） */
  backWallY: 300,
  /** ボールラック（手前右） */
  ballRack: { x: 810, y: 1430 },
} as const;

// ── パスユーティリティ（sim/render共用の純関数） ──
export function pathLength(path: ReadonlyArray<readonly [number, number]>): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) {
    L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  return L;
}

/** t(0..1) → {x, y, angle} 折れ線上の位置 */
export function pointOnPath(
  path: ReadonlyArray<readonly [number, number]>, t: number,
): { x: number; y: number; angle: number } {
  const total = pathLength(path);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (target <= seg || i === path.length - 1) {
      const k = seg === 0 ? 0 : target / seg;
      return {
        x: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k,
        y: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k,
        angle: Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]),
      };
    }
    target -= seg;
  }
  const last = path[path.length - 1];
  return { x: last[0], y: last[1], angle: 0 };
}
