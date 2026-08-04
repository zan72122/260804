import type { Layout } from './layout'
import { clamp } from '../core/math'

export interface Card {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
}

/**
 * Big picture buttons. Portrait stacks them, landscape puts them in a row, and
 * every card stays inside the safe area at all four reference sizes.
 */
export function cardSlots(l: Layout, n: number): Card[] {
  const out: Card[] = []
  const areaX = l.insets.left + 12
  // Leave the corner where the sound button lives clear, so a tap on the first
  // card can never silence the workshop by accident.
  const areaY = l.mute.y + l.mute.r * 2.4
  const areaW = l.w - l.insets.left - l.insets.right - 24
  const areaH = l.h - l.insets.bottom - 16 - areaY

  if (l.orientation === 'portrait') {
    const gap = clamp(areaH * 0.045, 8, 26)
    const h = (areaH - gap * (n - 1)) / n
    const w = Math.min(areaW, h * 1.9)
    for (let i = 0; i < n; i++) {
      const x = areaX + (areaW - w) / 2
      const y = areaY + i * (h + gap)
      out.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 })
    }
  } else {
    const gap = clamp(areaW * 0.035, 10, 32)
    const w = (areaW - gap * (n - 1)) / n
    const h = Math.min(areaH, w * 1.28)
    for (let i = 0; i < n; i++) {
      const x = areaX + i * (w + gap)
      const y = areaY + (areaH - h) / 2
      out.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 })
    }
  }
  return out
}

export function hitCard(c: Card, x: number, y: number, pad = 8): boolean {
  return x >= c.x - pad && x <= c.x + c.w + pad && y >= c.y - pad && y <= c.y + c.h + pad
}
