/* ============================================================
 *  config.js — 寸法（すべて実スケール・メートル）
 *  Ø8.7 m 級の泥土圧シールド TBM を想定する。
 *
 *  座標系：トンネル軸 = Z（+Z が掘進方向）／ +Y が上
 *  機械ローカル原点 z=0 = テール面 ＝「次に組むリングの前端面」
 * ============================================================ */

export const BORE_R = 4.35;        // 素掘り坑の半径
export const SHIELD_R = 4.24;      // シールド外殻半径
export const SEG_RO = 4.16;        // セグメント外半径
export const SEG_RI = 3.82;        // セグメント内半径
export const RING_W = 1.50;        // リング幅（＝1 ストロークの掘進長）
export const GROUT_R = 4.30;       // 裏込め注入層

export const HEAD_Z = 11.0;        // カッターヘッド前面（機械ローカル）
export const HEAD_R = 4.32;        // カッターヘッド半径

export const SHIELD_Z0 = 6.9;      // 前胴スキン 開始
export const SHIELD_Z1 = 10.45;    // 前胴スキン 終端
export const BULKHEAD_Z = 9.35;    // 隔壁

export const JACK_R = 3.95;        // 推進ジャッキ配置半径
export const JACK_N = 14;          // ジャッキ本数
export const JACK_Z0 = 1.15;       // ジャッキ基部
export const JACK_LEN = 1.85;      // シリンダ長

export const ERECTOR_Z = 0.55;     // エレクター旋回中心（軸方向位置）
export const ERECTOR_HOLD_DR = -0.85; // 把持時の半径オフセット（内側へ引き込む）

export const RING_ZC = -RING_W / 2;   // 組立中リングの中心（機械ローカル）

/* セグメント割付：標準 5 ピース + K セグメント 1 ピース */
export const KEY_SPAN = 50;        // 度
export const STD_SPAN = (360 - KEY_SPAN) / 5;   // = 62 度
export const KEY_ANGLE = 90;       // 天端に K セグメント

/** リング n における各ピースの中心角（度）。奇数リングは千鳥に振る。 */
export function ringAngles(ringIndex) {
  const stagger = (ringIndex % 2) ? STD_SPAN / 2 : 0;
  const list = [];
  for (let i = 0; i < 5; i++) {
    list.push({
      key: false,
      angle: KEY_ANGLE + KEY_SPAN / 2 + STD_SPAN / 2 + i * STD_SPAN + stagger,
      span: STD_SPAN,
    });
  }
  list.push({ key: true, angle: KEY_ANGLE + stagger, span: KEY_SPAN });
  return list;
}

/** 組立順：下（インバート）から左右交互に上がり、最後に天端の K */
export function buildOrder(ringIndex) {
  const list = ringAngles(ringIndex);
  const std = list.filter((s) => !s.key);
  std.sort((a, b) => {
    const da = Math.abs(((a.angle - 270 + 540) % 360) - 180);
    const db = Math.abs(((b.angle - 270 + 540) % 360) - 180);
    return db - da;   // 270°に近いものを先に
  });
  return [...std, list.find((s) => s.key)];
}

/* 地層（ストロークごとに切り替わる） */
export const STRATA = [
  { id: 'soil', name: 'やわらかい つち', face: 0x6b5238, muck: 0x7a5c3c, sparkle: 0, hard: 0.45 },
  { id: 'gravel', name: 'じゃり', face: 0x6a6258, muck: 0x736a5e, sparkle: 0.15, hard: 0.7 },
  { id: 'rock', name: 'かたい いわ', face: 0x585a5c, muck: 0x5f6164, sparkle: 0.05, hard: 1.0 },
  { id: 'crystal', name: 'きらきら こうせき', face: 0x4c5f6b, muck: 0x6c8494, sparkle: 1.0, hard: 0.85 },
  { id: 'clay', name: 'ねんど', face: 0x71503f, muck: 0x8a614a, sparkle: 0, hard: 0.5 },
  { id: 'sandstone', name: 'すなの いわ', face: 0x7d6d54, muck: 0x8b7a5e, sparkle: 0.1, hard: 0.75 },
];

export const RINGS_PER_REVEAL = 4;   // 何リングごとに引きのカメラを見せるか
export const PRESET_RINGS = 10;       // 開始時に既に組まれているリング数
