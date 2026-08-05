/** 水槽まわりの寸法。全モジュールがここを見る。 */
export const TANK = {
  halfW: 5.6,     // 内寸の半幅（x）
  halfD: 3.4,     // 内寸の半奥行（z）
  floorY: 0,      // 砂の高さ
  waterY: 9.2,    // 水面の高さ（縦持ちで画面が水槽で埋まる高さにしてある）
  glassZ: 3.4,    // 手前ガラスの内側
  backZ: -3.4,
};

/** カメラのフレーミング条件。縦持ちでも遊べる幅を必ず確保する。 */
export const CAMERA_FIT = {
  fov: 45,
  focusY: 4.6,
  minHalfWidth: 2.95,   // 縦持ちでも指を動かせる最低限の横幅
};

/**
 * 画面の縦横比ごとの「見せたい高さ」。
 * 横長になるほど水槽の上下を少し切り、水槽が小さく見えないようにする。
 * （縦持ちは水槽まるごと、横持ちは水の中に入り込んだ絵になる）
 */
export function fitHalfHeight(aspect) {
  if (aspect >= 1.75) return 4.05;
  if (aspect >= 1.25) return 4.65;
  if (aspect >= 0.95) return 5.10;
  return 5.40;
}

/** 汚れ／澄み具合の色味。clarity 0 = にごり、1 = すきとおり。 */
export const WATER = {
  murkyFog: 0x4d7c58,
  clearFog: 0x2f9dc8,
  murkyDensity: 0.054,
  clearDensity: 0.0155,
};
