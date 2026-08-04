import type { Ctx } from './draw'
import { circle, glow } from './draw'
import { surfacePoint } from './scene'
import type { World } from '../game/world'
import { poolScale } from '../game/layout'
import type { Layout } from '../game/layout'
import { SLOT_SPACING, slotDistance, slotLateral } from '../game/ribbon'
import type { RibbonShape } from '../game/ribbon'
import type { Section } from '../game/state'
import { TOUCHDOWN_AT } from '../game/state'
import { interference, lighten, mix, rainbow, rgb } from '../game/color'
import { clamp01, lerp } from '../core/math'

export interface Placed {
  x: number
  y: number
  ang: number
  len: number
  wid: number
  scale: number
  v: number
}

function slotPoint(l: Layout, shape: RibbonShape, level: number, slot: number): { x: number; y: number; v: number } {
  const v = slotLateral(shape, slot)
  const p = surfacePoint(l, level, (slotDistance(slot) * l.section.len) / l.pool.len, v)
  return { x: p.x, y: p.y, v }
}

/**
 * A slice spans exactly from its own leading seam to its trailing seam, so
 * neighbours in a ribbon always touch — no gaps, no overlaps, whatever the
 * ribbon is doing.
 */
export function placeSection(l: Layout, shape: RibbonShape, level: number, s: Section): Placed {
  const back = slotPoint(l, shape, level, s.slot - SLOT_SPACING / 2)
  const fwd = slotPoint(l, shape, level, s.slot + SLOT_SPACING / 2)
  const v = slotLateral(shape, s.slot)
  const sc = poolScale(v)
  const len = Math.hypot(fwd.x - back.x, fwd.y - back.y) * s.spread
  return {
    x: (back.x + fwd.x) / 2,
    y: (back.y + fwd.y) / 2 - s.lift * 8 * l.ui,
    ang: Math.atan2(fwd.y - back.y, fwd.x - back.x),
    len: Math.max(4, len),
    wid: l.section.width * sc,
    scale: sc,
    v,
  }
}

function stripPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  ang: number,
  len: number,
  wid: number,
  wave: number,
  phase: number,
  segs: number,
): void {
  const cos = Math.cos(ang)
  const sin = Math.sin(ang)
  const put = (lx: number, ly: number, first: boolean): void => {
    const x = cx + lx * cos - ly * sin
    const y = cy + lx * sin + ly * cos
    if (first) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.beginPath()
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const lx = -len / 2 + len * t
    const hw = (wid / 2) * (1 + wave * Math.sin(t * 5.6 + phase))
    put(lx, -hw, i === 0)
  }
  for (let i = segs; i >= 0; i--) {
    const t = i / segs
    const lx = -len / 2 + len * t
    const hw = (wid / 2) * (1 + wave * Math.sin(t * 5.6 + phase + 0.9))
    put(lx, hw, false)
  }
  ctx.closePath()
}

/**
 * Interference banding on a floating film runs ACROSS the slice, not along it,
 * and it is metal, not paper: the bright band is a narrow specular streak rather
 * than a wash of white over the whole slice.
 */
function filmGradient(ctx: Ctx, p: Placed, s: Section, time: number): CanvasGradient {
  const nx = -Math.sin(p.ang)
  const ny = Math.cos(p.ang)
  const x0 = p.x - (p.wid / 2) * nx
  const y0 = p.y - (p.wid / 2) * ny
  const x1 = p.x + (p.wid / 2) * nx
  const y1 = p.y + (p.wid / 2) * ny
  const base = s.rainbow ? rainbow(s.thickness + time * 0.05) : interference(s.thickness)
  const warm = s.rainbow
    ? rainbow(s.thickness + 0.18 + time * 0.05)
    : interference(s.thickness + 0.16)
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  const sheen = 0.46 + 0.3 * Math.sin(time * 0.7 + s.id * 1.3)
  g.addColorStop(0, rgb(mix(base, [90, 112, 140], 0.28), 0.94))
  g.addColorStop(clamp01(sheen - 0.13), rgb(base, 0.95))
  g.addColorStop(clamp01(sheen - 0.03), rgb(lighten(base, 0.42), 0.98))
  g.addColorStop(clamp01(sheen + 0.05), rgb(warm, 0.96))
  g.addColorStop(1, rgb(mix(warm, [104, 96, 120], 0.24), 0.92))
  return g
}

/** A floating slice: translucent shadow on the water, then the interference film. */
export function drawFloatingSection(ctx: Ctx, w: World, s: Section): void {
  const l = w.layout
  const p = placeSection(l, w.ribbon, w.water.level, s)
  const segs = w.quality === 'high' ? 12 : 6
  const wave = 0.03 + s.wobble * 0.055
  const phase = s.shimmer
  const cos = Math.cos(p.ang)
  const sin = Math.sin(p.ang)

  // Just after release the film is still pouring over the edge: its tail is up on
  // the block face and slides down onto the water instead of popping into place.
  const flow = s.flow
  const flowing = flow > 0.02
  const edge = surfacePoint(l, w.water.level, 0, 0.045)
  const tail = { x: p.x - (p.len / 2) * cos, y: p.y - (p.len / 2) * sin }
  const head = { x: p.x + (p.len / 2) * cos, y: p.y + (p.len / 2) * sin }
  const face = {
    x: tail.x + (edge.x - l.block.w * 0.05 - tail.x) * flow,
    y: tail.y + (edge.y - l.block.h * 0.62 - tail.y) * flow,
  }
  const ctrl = { x: tail.x + (edge.x - tail.x) * flow, y: tail.y + (edge.y - tail.y) * flow }

  ctx.save()
  ctx.globalAlpha = s.fade

  // Shadow cast through the film onto the water below. Slices inside a ribbon
  // share the ribbon's own shadow, so they do not each cast a separate one.
  const own = flowing || s.lift > 0.35 || w.sections.length < 2 ? 1 : 0.35
  ctx.save()
  ctx.globalAlpha = s.fade * (0.24 + s.lift * 0.14) * own
  ctx.fillStyle = '#04141c'
  if (w.quality === 'high') ctx.filter = `blur(${(1.4 + s.lift * 2.4).toFixed(2)}px)`
  if (flowing) {
    curvedStrip(ctx, face, ctrl, head, p.wid * 0.94, segs, 2.2 * l.ui, (5.5 + s.lift * 9) * l.ui)
  } else {
    stripPath(
      ctx,
      p.x + 2.2 * l.ui + s.lift * 4 * l.ui,
      p.y + (5.5 + s.lift * 9) * l.ui,
      p.ang,
      p.len * 0.98,
      p.wid * 0.94,
      wave,
      phase,
      segs,
    )
  }
  ctx.fill()
  ctx.restore()

  if (flowing) curvedStrip(ctx, face, ctrl, head, p.wid, segs)
  else stripPath(ctx, p.x, p.y, p.ang, p.len, p.wid, wave, phase, segs)
  ctx.fillStyle = filmGradient(ctx, p, s, w.time)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = Math.max(0.6, 0.8 * l.ui)
  ctx.stroke()

  // Surface-tension dimple ring where the slice presses on the water.
  if (s.lift < 0.2 && !flowing) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = s.fade * 0.28
    ctx.strokeStyle = 'rgba(190,235,250,0.8)'
    ctx.lineWidth = Math.max(0.6, 1 * l.ui)
    stripPath(ctx, p.x, p.y + 1.4 * l.ui, p.ang, p.len * 1.03, p.wid * 1.12, wave, phase, segs)
    ctx.stroke()
    ctx.restore()
  }

  if (s.lift > 0.05) {
    glow(ctx, p.x, p.y, p.wid * 1.5, 'rgba(180,220,255,0.5)', 0.35 * s.lift * s.fade)
  }
  ctx.restore()
}

/**
 * One continuous band running under the whole ribbon. Without it, five slices
 * with five outlines and five shadows read as five separate cards lying on the
 * water instead of one ribbon that came off the knife in one piece.
 */
export function drawRibbonBase(ctx: Ctx, w: World): void {
  const l = w.layout
  const secs = w.sections.filter((s) => s.fade > 0.35 && s.flow < 0.5 && s.lift < 0.4)
  if (secs.length < 2) return
  let lo = Infinity
  let hi = -Infinity
  for (const s of secs) {
    lo = Math.min(lo, s.slot)
    hi = Math.max(hi, s.slot)
  }
  lo -= SLOT_SPACING / 2
  hi += SLOT_SPACING / 2
  const steps = Math.max(8, Math.round((hi - lo) * 5))
  const pts: { x: number; y: number; nx: number; ny: number; wid: number }[] = []
  for (let i = 0; i <= steps; i++) {
    const slot = lo + ((hi - lo) * i) / steps
    const a = slotPoint(l, w.ribbon, w.water.level, slot - 0.08)
    const b = slotPoint(l, w.ribbon, w.water.level, slot + 0.08)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    pts.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      nx: -dy / len,
      ny: dx / len,
      wid: l.section.width * poolScale((a.v + b.v) / 2),
    })
  }
  const band = (k: number): void => {
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const p = pts[i]
      const x = p.x + p.nx * p.wid * 0.5 * k
      const y = p.y + p.ny * p.wid * 0.5 * k
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    for (let i = steps; i >= 0; i--) {
      const p = pts[i]
      ctx.lineTo(p.x - p.nx * p.wid * 0.5 * k, p.y - p.ny * p.wid * 0.5 * k)
    }
    ctx.closePath()
  }

  ctx.save()
  // One shared shadow for the whole ribbon.
  ctx.globalAlpha = 0.3
  ctx.fillStyle = '#04141c'
  if (w.quality === 'high') ctx.filter = 'blur(2.6px)'
  ctx.translate(2.4 * l.ui, 6 * l.ui)
  band(0.99)
  ctx.fill()
  ctx.restore()

  ctx.save()
  // A dark under-band, so the seams between slices read as folds, not gaps.
  ctx.globalAlpha = 0.9
  band(1.04)
  ctx.fillStyle = 'rgba(96,118,140,0.55)'
  ctx.fill()
  ctx.restore()
}

/** The seam where two slices in a ribbon hold on to each other. */
export function drawRibbonSeams(ctx: Ctx, w: World): void {
  if (w.sections.length < 2) return
  const l = w.layout
  const sorted = [...w.sections].sort((a, b) => a.slot - b.slot)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 1; i < sorted.length; i++) {
    const a = placeSection(l, w.ribbon, w.water.level, sorted[i - 1])
    const b = placeSection(l, w.ribbon, w.water.level, sorted[i])
    if (Math.abs(sorted[i].slot - sorted[i - 1].slot) > 1.6) continue
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2
    const hw = ((a.wid + b.wid) / 2) * 0.5
    // A lit fold: bright crest with a soft crease beside it.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(1, 1.5 * l.ui)
    ctx.beginPath()
    ctx.moveTo(mx - Math.cos(ang) * hw, my - Math.sin(ang) * hw)
    ctx.lineTo(mx + Math.cos(ang) * hw, my + Math.sin(ang) * hw)
    ctx.stroke()
  }
  ctx.restore()
}

/** Samples a quadratic curve and walks a ribbon of the given width along it. */
function curvedStrip(
  ctx: Ctx,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  wid: number,
  segs: number,
  offX = 0,
  offY = 0,
): void {
  const pts: { x: number; y: number; nx: number; ny: number }[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const mt = 1 - t
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x + offX
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y + offY
    const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x)
    const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    const len = Math.hypot(dx, dy) || 1
    pts.push({ x, y, nx: -dy / len, ny: dx / len })
  }
  ctx.beginPath()
  for (let i = 0; i <= segs; i++) {
    const p = pts[i]
    const x = p.x + p.nx * wid * 0.5
    const y = p.y + p.ny * wid * 0.5
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = segs; i >= 0; i--) {
    const p = pts[i]
    ctx.lineTo(p.x - p.nx * wid * 0.5, p.y - p.ny * wid * 0.5)
  }
  ctx.closePath()
}

/**
 * The signature moment: the film is still attached to the block face, peeling
 * upward against it, curling over the diamond edge and touching down on the
 * water — one continuous ribbon of film, never a slice that pops into being.
 */
export function drawPeelingSection(ctx: Ctx, w: World, s: Section): void {
  const l = w.layout
  const level = w.water.level
  const grown = s.peel
  if (grown <= 0.002) return

  const lenPx = l.section.len * 0.93 * grown
  const edge = surfacePoint(l, level, 0, 0.045)
  // Part of the film is still lying against the vertical block face.
  const rise = grown * l.block.h * 0.62
  const face = { x: edge.x - l.block.w * 0.06, y: edge.y - rise }
  const headU = lenPx / l.pool.len
  const headV = 0.045 + 0.08 * clamp01(grown)
  const head = surfacePoint(l, level, headU, headV)
  const wid = l.section.width * poolScale(headV) * 0.94
  const segs = w.quality === 'high' ? 12 : 6

  const ang = Math.atan2(head.y - face.y, head.x - face.x)
  const placed: Placed = {
    x: (face.x + head.x) / 2,
    y: (face.y + head.y) / 2,
    ang,
    len: Math.hypot(head.x - face.x, head.y - face.y),
    wid,
    scale: 1,
    v: headV,
  }

  ctx.save()

  // Shadow appears only once the film is actually over the water.
  const touched = clamp01((grown - TOUCHDOWN_AT) / (1 - TOUCHDOWN_AT))
  if (touched > 0) {
    ctx.save()
    ctx.globalAlpha = 0.22 * touched
    ctx.fillStyle = '#04141c'
    if (w.quality === 'high') ctx.filter = 'blur(1.8px)'
    curvedStrip(ctx, face, edge, head, wid * 0.92, segs, 2 * l.ui, 4.5 * l.ui)
    ctx.fill()
    ctx.restore()
  }

  curvedStrip(ctx, face, edge, head, wid, segs)
  ctx.fillStyle = filmGradient(ctx, placed, s, w.time)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.62)'
  ctx.lineWidth = Math.max(0.6, 0.9 * l.ui)
  ctx.stroke()

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  // The hairline where the film is separating from the block face, right now.
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = Math.max(1.2, 1.8 * l.ui)
  ctx.beginPath()
  ctx.moveTo(face.x - wid * 0.5, face.y)
  ctx.lineTo(face.x + wid * 0.5, face.y)
  ctx.stroke()
  glow(ctx, face.x, face.y, 15 * l.ui, 'rgba(255,252,240,0.95)', 0.55)
  // And the light caught on the fold as it goes over the diamond.
  glow(ctx, edge.x, edge.y, 18 * l.ui, 'rgba(226,246,255,0.9)', 0.45)

  // Leading edge meniscus flash at the moment of touchdown.
  if (grown > TOUCHDOWN_AT - 0.05 && grown < TOUCHDOWN_AT + 0.18) {
    const k = 1 - Math.abs(grown - TOUCHDOWN_AT) / 0.18
    glow(ctx, head.x, head.y, 24 * l.ui, 'rgba(210,245,255,0.95)', 0.85 * clamp01(k))
  }
  ctx.restore()
  ctx.restore()
}

export function drawDroplets(ctx: Ctx, w: World): void {
  for (const d of w.droplets) {
    const a = clamp01(d.life)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = 'rgba(150,214,236,0.85)'
    circle(ctx, d.x, d.y, d.r)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    circle(ctx, d.x - d.r * 0.3, d.y - d.r * 0.34, d.r * 0.32)
    ctx.fill()
    ctx.restore()
  }
}

export function drawSparkles(ctx: Ctx, w: World): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const s of w.sparkles) {
    const k = clamp01(s.life / s.max)
    const r = s.r * lerp(0.4, 1.25, 1 - k)
    const c = rainbow(s.hue)
    ctx.globalAlpha = k * 0.85
    ctx.strokeStyle = rgb(lighten(c, 0.5), 1)
    ctx.lineWidth = Math.max(0.8, r * 0.16)
    ctx.beginPath()
    ctx.moveTo(s.x - r, s.y)
    ctx.lineTo(s.x + r, s.y)
    ctx.moveTo(s.x, s.y - r)
    ctx.lineTo(s.x, s.y + r)
    ctx.stroke()
    glow(ctx, s.x, s.y, r * 1.6, rgb(lighten(c, 0.3), 1), k * 0.4)
  }
  ctx.restore()
}
