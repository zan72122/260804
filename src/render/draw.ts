import { TAU } from '../core/math'

export type Ctx = CanvasRenderingContext2D

export function roundRectPath(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU)
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU)
}

export function poly(ctx: Ctx, pts: number[][]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

export function radial(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  inner: string,
  outer: string,
): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(0.1, r))
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  return g
}

export function linear(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [t, c] of stops) g.addColorStop(t, c)
  return g
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  circle(ctx, x, y, r)
  ctx.fillStyle = radial(ctx, x, y, r, color, 'rgba(0,0,0,0)')
  ctx.fill()
  ctx.restore()
}

/** A soft breathing ring used for every non-verbal "look here" hint. */
export function hintRing(ctx: Ctx, x: number, y: number, r: number, t: number, color = '255,236,200'): void {
  const k = (t % 1.9) / 1.9
  const rr = r * (0.72 + k * 0.75)
  const a = (1 - k) * 0.55
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = `rgba(${color},${a.toFixed(3)})`
  ctx.lineWidth = Math.max(2, r * 0.075)
  circle(ctx, x, y, rr)
  ctx.stroke()
  ctx.restore()
}
