import type { Ctx } from './draw'
import { TAU } from '../core/math'
import type { SpecimenId } from '../game/state'

/** Hand-drawn-ish silhouettes for the thing hidden inside each resin block. */
export function specimenSilhouette(
  ctx: Ctx,
  id: SpecimenId,
  cx: number,
  cy: number,
  r: number,
  rot = 0,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.beginPath()
  if (id === 'petal') {
    ctx.moveTo(0, -r)
    ctx.bezierCurveTo(r * 0.9, -r * 0.7, r * 0.75, r * 0.55, 0, r)
    ctx.bezierCurveTo(-r * 0.75, r * 0.55, -r * 0.9, -r * 0.7, 0, -r)
  } else if (id === 'leaf') {
    ctx.moveTo(0, -r)
    ctx.bezierCurveTo(r * 0.78, -r * 0.5, r * 0.66, r * 0.6, 0, r)
    ctx.bezierCurveTo(-r * 0.66, r * 0.6, -r * 0.78, -r * 0.5, 0, -r)
  } else {
    ctx.moveTo(0, -r)
    ctx.bezierCurveTo(r * 0.42, -r * 0.6, r * 0.5, r * 0.4, 0, r)
    ctx.bezierCurveTo(-r * 0.5, r * 0.4, -r * 0.42, -r * 0.6, 0, -r)
  }
  ctx.closePath()
  ctx.restore()
}

/** Veins / barbs drawn on top of a silhouette so each block reads differently. */
export function specimenDetail(
  ctx: Ctx,
  id: SpecimenId,
  cx: number,
  cy: number,
  r: number,
  rot: number,
  color: string,
  width: number,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.94)
  ctx.lineTo(0, r * 0.94)
  ctx.stroke()
  const n = id === 'feather' ? 9 : 5
  for (let i = 0; i < n; i++) {
    const t = -0.72 + (1.44 * i) / (n - 1)
    const y = t * r
    const spread = id === 'feather' ? 0.42 : 0.62
    const w = Math.cos(t * 1.5) * r * spread
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.quadraticCurveTo(w * 0.6, y + r * 0.1, w, y + r * 0.22)
    ctx.moveTo(0, y)
    ctx.quadraticCurveTo(-w * 0.6, y + r * 0.1, -w, y + r * 0.22)
    ctx.stroke()
  }
  ctx.restore()
}

/** The tiny woven mesh of a TEM grid. */
export function gridMesh(ctx: Ctx, cx: number, cy: number, r: number, squash: number, color: string): void {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * squash, 0, 0, TAU)
  ctx.clip()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.6, r * 0.045)
  const step = r / 3.1
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * step, cy - r)
    ctx.lineTo(cx + i * step, cy + r)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - r, cy + i * step * squash)
    ctx.lineTo(cx + r, cy + i * step * squash)
    ctx.stroke()
  }
  ctx.restore()
}
