export const TAU = Math.PI * 2

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a)
}

/** Frame-rate independent exponential approach. `rate` = how much of the gap closes per second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  const k = 1 - Math.exp(-rate * dt)
  return current + (target - current) * k
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01(invLerp(edge0, edge1, x))
  return t * t * (3 - 2 * t)
}

export function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t)
  return 1 - u * u * u
}

export function easeInOutSine(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t))
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const u = clamp01(t) - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

/** Shortest signed distance from point p to segment ab, plus the closest point. */
export function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { d: number; cx: number; cy: number; t: number } {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / len2)
  const cx = ax + dx * t
  const cy = ay + dy * t
  return { d: Math.hypot(px - cx, py - cy), cx, cy, t }
}

export function wrapAngle(a: number): number {
  let x = a
  while (x > Math.PI) x -= TAU
  while (x < -Math.PI) x += TAU
  return x
}
