// 世界の寸法と「意味のある段階」の定義。単位は m。
// +Z が手前（プレイヤー側）。組立モードと試遊モードは同じ座標系だけを使う。

export const BAR_RADIUS = 0.011;

// バー端がはまるソケット。x は左右の絶対値、y はバー軸の高さ。
// 3 段階の間隔 x 2 段階の高さ = 端ごとに 6 個。
export const SLOT_X = [0.042, 0.080, 0.106]; // 狭い / 中 / 広い
export const SLOT_Y = [0.244, 0.300];        // 低い / 高い

export const SLOT_X_DEFAULT = 1;
export const SLOT_Y_DEFAULT = 1;

export const CAB = {
  hx: 0.19,          // 内部の左右の半分
  nearZ: 0.175,      // 手前のソケット盤
  farZ: -0.175,      // 奥のソケット盤
  topY: 0.430,
  rampFarY: 0.105,   // 下の斜面（奥が高い）
  rampNearY: 0.030,
  rampNearZ: 0.120,  // ここから先は急なシュート（段差は作らない）
  chuteY: -0.035,
  chuteNearZ: 0.240,
};

export const PANEL_T = 0.012;


export const BAR = {
  radius: BAR_RADIUS,
  z0: CAB.nearZ + PANEL_T * 0.5,   // 端 0 = 手前（ソケット盤の中）
  z1: CAB.farZ - PANEL_T * 0.5,    // 端 1 = 奥
};

export const BAR_LENGTH = Math.abs(BAR.z0 - BAR.z1);

// バー端の大きな丸ハンドル（バーより上・手前にずらして指で隠れにくくする）
export const HANDLE = { dy: 0.036, dz: 0.020, radius: 0.0235, pickRadius: 0.050 };

export const PRIZE = {
  capsule: {
    kind: 'capsule',
    halfLen: 0.067,          // 円柱部の半分（軸は局所 X）→ 全長の半分 0.114
    radius: 0.047,           // 直径 0.094：狭い隙間 0.074 は通れない
    mass: 0.090,
    friction: 0.40,
    rollDamp: 7.0,           // 転がりやすい（でも、じきに止まる）
    comOffset: [0.004, -0.007, 0.001], // わずかに重心が偏っている
  },
  box: {
    kind: 'box',
    hx: 0.114,
    hy: 0.050,               // 高さ 0.100：狭い隙間 0.074 は通れない
    hz: 0.060,
    mass: 0.100,
    friction: 0.20,          // 滑りやすい
    rollDamp: 3.0,           // 角で止まりやすい
    comOffset: [0, 0, 0],
  },
};

// 景品のスタート位置（毎回ここから始めるので、前回との差が読み取れる）
export const PRIZE_START_Z = -0.045;

export const CLAW = {
  bladeHalfX: 0.008,
  bladeHalfZ: 0.016,
  spacing: 0.017,      // 爪 2 本の間隔の半分（本物のクレーンの爪くらい狭い）
  rodLength: 0.115,
  homeTipY: 0.418,
  xLimit: 0.155,       // 景品の端の外側まで動かせる
  stroke: 0.038,
  descendSpeed: 0.30,
  strokeSpeed: 0.15,
  liftSpeed: 0.36,
  maxImpulse: 0.015,   // 爪の接触インパルス上限（暴れ防止）
  gantryZMin: -0.145,
  gantryZMax: 0.145,
};

export const TRAY = {
  y: 0.090,
  z: [0.305, 0.392],
  width: 0.45,
};

export const STORAGE_KEY = 'toddler-crane-builder-v1';
