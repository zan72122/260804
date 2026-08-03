/**
 * Two projections of the SAME world:
 *  - landscape → side elevation (big grinder profile, sparks + rail wave visible)
 *  - portrait  → perspective looking down the track (rails converge to depth,
 *                big lever at the bottom)
 * Rotating the device only swaps the projection; world state is untouched.
 */
export interface ScreenPoint {
  x: number;
  y: number;
  /** pixels per metre at this depth (side view: constant). */
  scale: number;
}

export interface Projection {
  portrait: boolean;
  w: number;
  h: number;
  groundY: number;
  horizonY: number;
  pxPerM: number;
  camS: number;
  /**
   * @param s       position along the track in metres
   * @param up      metres above the rail head
   * @param lateral metres sideways from track centre (portrait);
   *                in side view: -1 = far rail, 0 = centre, +1 = near rail
   */
  toScreen(s: number, up: number, lateral: number): ScreenPoint;
}

const NEAR_CLIP = 1.7;

export function makeProjection(w: number, h: number, topInset: number, camS: number): Projection {
  const portrait = h >= w;
  if (!portrait) {
    const pxPerM = w / 30;
    const groundY = h * 0.74;
    return {
      portrait,
      w,
      h,
      groundY,
      horizonY: h * 0.42,
      pxPerM,
      camS,
      toScreen(s, up, lateral) {
        return {
          x: w / 2 + (s - camS) * pxPerM,
          y: groundY - up * pxPerM - (1 - lateral) * 9,
          scale: pxPerM,
        };
      },
    };
  }
  // camera rides high behind the car, looking over its roof down the track
  const horizonY = topInset + h * 0.28;
  const f = h * 0.92;
  const camHeight = 5.0;
  return {
    portrait,
    w,
    h,
    groundY: h * 0.9,
    horizonY,
    pxPerM: f / 8,
    camS,
    toScreen(s, up, lateral) {
      const d = Math.max(s - camS, NEAR_CLIP);
      const k = f / d;
      return {
        x: w / 2 + lateral * k,
        y: horizonY + (camHeight - up) * k,
        scale: k,
      };
    },
  };
}

/** Half-gap between the two rails, metres from track centre. */
export const RAIL_HALF_GAP = 0.75;
