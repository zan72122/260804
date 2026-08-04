import { clamp } from '../core/math'

export interface GuardResult {
  x: number
  y: number
  blocked: boolean
}

/**
 * The one hard rule borrowed from the real bench: nothing solid — brush, grid,
 * finger, tweezers — is ever allowed to reach the diamond edge. Instead of
 * punishing the child we simply stop the tool short, with a soft glow.
 */
export function guardEdge(
  x: number,
  y: number,
  tipX: number,
  tipY: number,
  guard: number,
): GuardResult {
  let gx = x
  let gy = y
  let blocked = false

  // Keep clear of the whole knife side of the boat...
  if (gx < tipX + guard) {
    gx = tipX + guard
    blocked = true
  }
  // ...and never above the water line where the edge itself sits.
  if (gy < tipY + guard * 0.35) {
    gy = tipY + guard * 0.35
    blocked = true
  }
  // ...and stay outside a comfortable disc around the tip.
  const dx = gx - tipX
  const dy = gy - tipY
  const d = Math.hypot(dx, dy)
  const need = guard * 1.15
  if (d < need) {
    const k = d < 1e-4 ? 0 : need / d
    gx = tipX + dx * (k || 1)
    gy = tipY + dy * (k || 1)
    blocked = true
  }
  return { x: gx, y: gy, blocked }
}

export function clampToRect(
  x: number,
  y: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { x: number; y: number } {
  return { x: clamp(x, rx, rx + rw), y: clamp(y, ry, ry + rh) }
}
