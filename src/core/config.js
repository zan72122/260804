// ---------------------------------------------------------------------------
// 実寸法。すべてメートル。ロープウォーク（綱作り作業場）の現実的な寸法を基準に
// している。ここを触ると世界全体のスケール感が変わる。
// ---------------------------------------------------------------------------

export const WALK = {
  // 撚り合わせの作業区間（近端の回転環から遠方のフック車まで）
  span: 14.0,
  // 近端（撚り合わさったロープが出てくる側）の x
  x0: -0.9,
  // 綱の高さ（作業者の腰よりやや上）
  y: 1.06,

  // 小屋そのものは作業区間よりずっと長い。奥は霞んで見えなくなる。
  shedFrom: -7.0,
  shedTo: 58.0,
  halfWidth: 2.42, // 中心から柱まで
  eaves: 2.62, // 軒の高さ
  ridge: 3.72, // 棟の高さ
  bayStep: 3.0, // 柱間
  plankWidth: 0.215,
};

export const ROPE = {
  strands: 3,

  // 撚る前のストランド半径（けばだって太い）→ 撚った後 → 綯った後
  rRaw: 0.0210,
  rTwisted: 0.0164,
  rLaid: 0.0132,

  // 開いた状態のストランド中心が乗る円の半径
  spread: 0.132,
  // 遠方フックの取り付け円
  hookRing: 0.168,
  // 綯った後のストランド中心円（3本が接するとき r/ sin60 = 1.1547 r）
  get layRadius() {
    return this.rLaid * 1.1547;
  },
  // ロープ外径 ≒ 2 * (layRadius + rLaid) ≒ 54mm
  layPitch: 0.34, // 撚りピッチ（1回転あたりの長さ）
  layPitchJitter: 0.16, // 入力の速さ・ゆれが撚り模様へ反映される割合

  // 木製トップ
  topLength: 0.265,
  topRadius: 0.052,
  topGrooveDepth: 0.0135,

  // 収束区間の長さ（トップの前後で細い複数本 → 太い一本になる距離）
  closeLength: 0.30,

  // 描画解像度
  stations: 720,
  radial: 9,
};

// 空気遠近のための色。近景は彩度と明暗差が高く、遠景ほど霞の色へ寄る。
export const PALETTE = {
  skyTop: 0x7fa8c8,
  skyHorizon: 0xd8dcd2,
  haze: 0xc3c4b4, // 屋外の霞
  interiorHaze: 0x8f7a5f, // 小屋の中の埃っぽい空気
  sun: 0xffe6bd,
  bounce: 0x8a6f4a,
};

export const QUALITY = {
  maxPixelRatio: 2.0,
  shadowMapSize: 1024,
};
