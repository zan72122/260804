import type { Ctx } from './draw'
import { circle, glow, linear, poly, radial, roundRectPath } from './draw'
import { specimenDetail, specimenSilhouette } from './shapes'
import type { World } from '../game/world'
import { poolPoint } from '../game/layout'
import type { Layout } from '../game/layout'
import { clamp, clamp01, smoothstep, TAU } from '../core/math'
import { reflectionJoin } from '../game/water'
import { specimenById } from '../game/state'
import { makeNoise1 } from '../core/rng'

const shimmerNoise = makeNoise1(1337)

export function waterDrop(l: Layout, level: number): number {
  return Math.max(0, 1 - level) * l.pool.sink
}

export function surfacePoint(
  l: Layout,
  level: number,
  u: number,
  v: number,
): { x: number; y: number } {
  const p = poolPoint(l, u, v)
  return { x: p.x, y: p.y + waterDrop(l, level) }
}

function corners(l: Layout): { A: P; B: P; C: P; D: P } {
  return {
    A: poolPoint(l, 0, 0),
    B: poolPoint(l, 1, 0),
    C: poolPoint(l, 1, 1),
    D: poolPoint(l, 0, 1),
  }
}

interface P {
  x: number
  y: number
}

export function drawBackground(ctx: Ctx, w: World): void {
  const l = w.layout
  ctx.fillStyle = linear(ctx, 0, 0, 0, l.h, [
    [0, '#16233a'],
    [0.34, '#101a2b'],
    [0.78, '#0a1120'],
    [1, '#060a13'],
  ])
  ctx.fillRect(0, 0, l.w, l.h)

  // The stereo microscope hanging over the bench, far out of focus.
  const sx = l.w * 0.78
  const sy = l.top - l.h * 0.02
  const sr = Math.max(l.w, l.h) * 0.3
  ctx.save()
  ctx.fillStyle = radial(ctx, sx, sy, sr, 'rgba(9,14,24,0.92)', 'rgba(9,14,24,0)')
  ctx.beginPath()
  ctx.ellipse(sx, sy, sr, sr * 0.72, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
  glow(ctx, sx - sr * 0.32, sy + sr * 0.34, sr * 0.3, 'rgba(150,196,236,0.5)', 0.35)
  glow(ctx, sx + sr * 0.24, sy + sr * 0.36, sr * 0.28, 'rgba(150,196,236,0.45)', 0.3)

  // Two lamps: the cold ring light over the boat, and a warm one on the block.
  glow(ctx, l.pool.x + l.pool.len * 0.35, l.pool.y - l.h * 0.12, l.h * 0.42, 'rgba(122,168,220,0.42)', 0.55)
  glow(ctx, l.knife.tipX - l.block.w * 0.5, l.knife.tipY - l.block.h * 1.4, l.block.h * 3, 'rgba(255,228,196,0.42)', 0.5)
}

/** The console the whole instrument stands on; the tool row lives on it. */
export function drawConsole(ctx: Ctx, w: World): void {
  const l = w.layout
  const y = l.pool.y + l.pool.depth * 0.9
  ctx.save()
  ctx.fillStyle = linear(ctx, 0, y, 0, l.h, [
    [0, 'rgba(38,52,72,0.0)'],
    [0.22, 'rgba(34,47,66,0.85)'],
    [0.55, 'rgba(22,31,45,0.96)'],
    [1, 'rgba(11,16,25,1)'],
  ])
  ctx.fillRect(0, y, l.w, l.h - y)
  ctx.strokeStyle = 'rgba(150,180,214,0.16)'
  ctx.lineWidth = Math.max(1, 1.4 * l.ui)
  ctx.beginPath()
  ctx.moveTo(0, l.bottom + 8 * l.ui)
  ctx.lineTo(l.w, l.bottom + 8 * l.ui)
  ctx.stroke()
  ctx.restore()
}

/** The column and the knife-holder clamp: the mass that makes it read as a machine. */
export function drawFrame(ctx: Ctx, w: World): void {
  const l = w.layout
  const colW = l.column.w
  const colX = l.column.x
  const colTop = l.column.y
  const colBottom = l.knife.tipY + l.block.h * 1.35

  ctx.save()
  roundRectPath(ctx, colX, colTop, colW, colBottom - colTop, colW * 0.22)
  ctx.fillStyle = linear(ctx, colX, 0, colX + colW, 0, [
    [0, '#39485d'],
    [0.22, '#8fa4bd'],
    [0.5, '#63768e'],
    [0.78, '#3b4a5f'],
    [1, '#222c3b'],
  ])
  ctx.fill()
  ctx.strokeStyle = 'rgba(214,232,255,0.22)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Knurled adjustment knobs.
  for (let i = 0; i < 2; i++) {
    const ky = colTop + colW * (0.7 + i * 0.9)
    const kr = colW * 0.3
    circle(ctx, colX + colW * (i === 0 ? 0.86 : 0.14), ky, kr)
    ctx.fillStyle = radial(ctx, colX + colW * 0.4, ky - kr * 0.5, kr * 2.2, '#cddcec', '#4a5c74')
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,28,40,0.45)'
    ctx.stroke()
  }

  // Knife-holder clamp: a chunk of steel under the edge, well clear of the block.
  const clampTop = l.knife.tipY + l.block.h * 1.06
  const clampW = clamp(l.block.w * 0.9, 40, 150)
  poly(ctx, [
    [l.knife.tipX - clampW * 0.62, clampTop],
    [l.knife.tipX + l.pool.shear * 0.34, clampTop + l.pool.depth * 0.26],
    [l.knife.tipX + l.pool.shear * 0.72, l.h],
    [l.knife.tipX - clampW * 0.62, l.h],
  ])
  ctx.fillStyle = linear(ctx, l.knife.tipX - clampW, clampTop, l.knife.tipX + l.pool.shear, l.h, [
    [0, '#6d8098'],
    [0.34, '#465569'],
    [1, '#242e3c'],
  ])
  ctx.fill()
  ctx.strokeStyle = 'rgba(176,206,242,0.3)'
  ctx.lineWidth = Math.max(1, 1.4 * l.ui)
  ctx.beginPath()
  ctx.moveTo(l.knife.tipX - clampW * 0.62, clampTop)
  ctx.lineTo(l.knife.tipX + l.pool.shear * 0.34, clampTop + l.pool.depth * 0.26)
  ctx.stroke()
  // Seam where the two halves of the clamp meet around the diamond.
  ctx.strokeStyle = 'rgba(150,180,214,0.18)'
  ctx.beginPath()
  ctx.moveTo(l.knife.tipX - clampW * 0.62, clampTop + l.pool.depth * 0.34)
  ctx.lineTo(l.knife.tipX + l.pool.shear * 0.46, clampTop + l.pool.depth * 0.55)
  ctx.stroke()

  // Tilt-adjust knob on the knife holder.
  const kx = l.knife.tipX - clampW * 0.24
  const ky = clampTop + l.pool.depth * 0.2
  const kr = clamp(l.block.h * 0.17, 9, 22)
  circle(ctx, kx, ky, kr)
  ctx.fillStyle = radial(ctx, kx - kr * 0.3, ky - kr * 0.3, kr * 2, '#b9cadd', '#334153')
  ctx.fill()
  ctx.strokeStyle = 'rgba(16,24,34,0.5)'
  ctx.stroke()
  ctx.restore()
}

/** Metal boat glued onto the knife, and the trough that holds the water. */
export function drawKnifeAndBoat(ctx: Ctx, w: World): void {
  const l = w.layout
  const { A, B, C, D } = corners(l)
  const wall = clamp(l.pool.sink * 2.1, 22, 70)
  const rim = clamp(7 * l.ui, 5, 14)

  ctx.save()

  // Outer boat shell: extruded from the far, right and near rims.
  poly(ctx, [
    [A.x, A.y - rim],
    [B.x + rim, B.y - rim],
    [C.x + rim, C.y + wall + rim],
    [D.x - rim * 0.4, D.y + wall + rim],
  ])
  ctx.fillStyle = linear(ctx, A.x, A.y, C.x, C.y + wall, [
    [0, '#95a9c2'],
    [0.16, '#5f7189'],
    [0.55, '#36445a'],
    [1, '#1a2331'],
  ])
  ctx.fill()

  // Trough cavity: only the opening. Anything the water does not reach shows the
  // dark inner walls, and the metal shell already covers everything below.
  poly(ctx, [
    [A.x, A.y],
    [B.x, B.y],
    [C.x, C.y],
    [D.x, D.y],
  ])
  ctx.fillStyle = linear(ctx, A.x, A.y, D.x, D.y, [
    [0, '#0c1a24'],
    [1, '#16303e'],
  ])
  ctx.fill()

  // Bright rim along the near lip so the boat reads as a container.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(212,232,255,0.5)'
  ctx.lineWidth = Math.max(1.4, 2.2 * l.ui)
  ctx.beginPath()
  ctx.moveTo(D.x - rim * 0.4, D.y + wall + rim)
  ctx.lineTo(C.x + rim, C.y + wall + rim)
  ctx.lineTo(B.x + rim, B.y - rim)
  ctx.stroke()
  ctx.restore()
}

export function drawWater(ctx: Ctx, w: World): void {
  const l = w.layout
  const level = w.water.level
  const dy = waterDrop(l, level)
  const { A, B, C, D } = corners(l)

  ctx.save()
  // Clip to the mouth of the trough: as the level drops the surface slides down
  // inside the boat and the dark far wall is revealed, instead of the water
  // sliding out over the rim.
  poly(ctx, [
    [A.x, A.y],
    [B.x, B.y],
    [C.x, C.y],
    [D.x, D.y],
  ])
  ctx.clip()

  poly(ctx, [
    [A.x, A.y + dy],
    [B.x, B.y + dy],
    [C.x, C.y + dy],
    [D.x, D.y + dy],
  ])
  ctx.save()
  ctx.clip()
  const g = ctx.createLinearGradient(A.x, A.y + dy, D.x, D.y + dy)
  g.addColorStop(0, '#123c4d')
  g.addColorStop(0.28, '#1c586c')
  g.addColorStop(0.7, '#2b7c8f')
  g.addColorStop(1, '#47a3ae')
  ctx.fillStyle = g
  ctx.fillRect(A.x - 6, A.y + dy - 6, l.w + 12, l.pool.depth + 12)

  // Reflection of the lamp sliding across the surface.
  const sheen = ctx.createLinearGradient(A.x, A.y + dy, C.x, C.y + dy)
  sheen.addColorStop(0, 'rgba(190,225,240,0)')
  sheen.addColorStop(clamp01(0.4 + Math.sin(w.time * 0.3) * 0.07), 'rgba(206,236,248,0.22)')
  sheen.addColorStop(1, 'rgba(215,240,250,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(A.x - 6, A.y + dy - 6, l.w + 12, l.pool.depth + 12)

  // A soft dark reflection of the knife and block hanging over the far edge.
  const refl = ctx.createLinearGradient(A.x, A.y + dy, A.x, A.y + dy + l.pool.depth * 0.45)
  refl.addColorStop(0, 'rgba(6,16,26,0.55)')
  refl.addColorStop(1, 'rgba(6,16,26,0)')
  ctx.fillStyle = refl
  ctx.fillRect(A.x - 6, A.y + dy - 6, l.w + 12, l.pool.depth * 0.5)

  // Slow caustic threads. Fewer of them on the low-power path.
  const lines = w.quality === 'high' ? 8 : 3
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineWidth = Math.max(1, 1.3 * l.ui)
  for (let i = 0; i < lines; i++) {
    const v = (i + 0.5) / (lines + 0.1)
    const amp = 2.2 * l.ui * (0.5 + v)
    ctx.strokeStyle = `rgba(174,228,246,${(0.045 + 0.05 * v).toFixed(3)})`
    ctx.beginPath()
    for (let s = 0; s <= 18; s++) {
      const u = s / 18
      const p = surfacePoint(l, level, u, v)
      const off =
        Math.sin(u * 7.5 + w.time * 0.85 + i * 1.7) * amp + shimmerNoise(u * 4 + w.time * 0.5 + i) * amp
      if (s === 0) ctx.moveTo(p.x, p.y + off)
      else ctx.lineTo(p.x, p.y + off)
    }
    ctx.stroke()
  }
  ctx.restore()
  ctx.restore()
}

/** Ripple rings live on the surface, squashed by the viewing angle. */
export function drawRipples(ctx: Ctx, w: World): void {
  const l = w.layout
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const r of w.ripples) {
    const p = surfacePoint(l, w.water.level, r.u, r.v)
    ctx.strokeStyle = `rgba(196,236,248,${(r.a * (r.soft ? 0.4 : 0.8)).toFixed(3)})`
    ctx.lineWidth = Math.max(0.8, (r.soft ? 1.1 : 1.7) * l.ui)
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, Math.max(0.5, r.r), Math.max(0.3, r.r * 0.3), 0, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * The diamond edge. It is only ever a line of light — the one part of the scene
 * nothing solid is allowed to reach.
 */
export function drawKnifeEdge(ctx: Ctx, w: World): void {
  const l = w.layout
  const { A, D } = corners(l)
  const dy = waterDrop(l, w.water.level)
  const join = reflectionJoin(w.water)
  const nx = -(D.y - A.y)
  const ny = D.x - A.x
  const nlen = Math.hypot(nx, ny) || 1
  const bevel = clamp(9 * l.ui, 5, 18)

  ctx.save()
  // Back facet of the diamond, a narrow bevel on the knife side of the edge.
  poly(ctx, [
    [A.x, A.y],
    [D.x, D.y],
    [D.x - (nx / nlen) * bevel, D.y - (ny / nlen) * bevel],
    [A.x - (nx / nlen) * bevel, A.y - (ny / nlen) * bevel],
  ])
  ctx.fillStyle = linear(ctx, A.x - bevel, A.y, A.x, A.y, [
    [0, 'rgba(112,140,172,0.55)'],
    [1, 'rgba(226,244,255,0.85)'],
  ])
  ctx.fill()

  // Reflection of the edge in the water: it climbs to meet the real edge as the
  // boat fills, and the two become one line at exactly the right level.
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = `rgba(150,214,240,${(0.16 + 0.36 * join).toFixed(3)})`
  ctx.lineWidth = Math.max(1, 2 * l.ui)
  ctx.beginPath()
  ctx.moveTo(A.x, A.y + dy * 2)
  ctx.lineTo(D.x, D.y + dy * 2)
  ctx.stroke()

  // Overfilled: the meniscus bulges proud of the edge and then wicks itself back.
  const swell = Math.max(0, w.water.level - 1)
  if (swell > 0.005) {
    ctx.strokeStyle = `rgba(196,244,255,${(0.4 * Math.min(1, swell * 4)).toFixed(3)})`
    ctx.lineWidth = Math.max(3, (6 + swell * 26) * l.ui)
    ctx.beginPath()
    ctx.moveTo(A.x, A.y - swell * 10 * l.ui)
    ctx.lineTo(D.x, D.y - swell * 10 * l.ui)
    ctx.stroke()
  }

  // Meniscus climbing the diamond.
  const men = ctx.createLinearGradient(A.x, A.y, D.x, D.y)
  men.addColorStop(0, `rgba(184,242,255,${(0.55 * join).toFixed(3)})`)
  men.addColorStop(1, `rgba(140,220,255,${(0.2 * join).toFixed(3)})`)
  ctx.strokeStyle = men
  ctx.lineWidth = Math.max(2.4, 5 * l.ui)
  ctx.beginPath()
  ctx.moveTo(A.x, A.y + dy)
  ctx.lineTo(D.x, D.y + dy)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(232,246,255,0.97)'
  ctx.lineWidth = Math.max(1.2, 1.8 * l.ui)
  ctx.beginPath()
  ctx.moveTo(A.x, A.y)
  ctx.lineTo(D.x, D.y)
  ctx.stroke()

  // A glint travelling along the edge keeps it alive without any words.
  const t = (w.time * 0.34) % 1
  glow(ctx, A.x + (D.x - A.x) * t, A.y + (D.y - A.y) * t, 24 * l.ui, 'rgba(255,255,255,0.8)', 0.6)
  glow(ctx, A.x, A.y, 22 * l.ui, 'rgba(206,238,255,0.75)', 0.6)
  ctx.restore()
}

function blockScreen(w: World): { x: number; y: number; scale: number } {
  const l = w.layout
  const target = { x: l.block.faceX - l.block.w * 0.5, y: l.block.restY + l.block.h * 0.5 }
  if (w.block.dragging || w.block.seat < 1) {
    const k = smoothstep(0, 1, w.block.seat)
    return {
      x: w.block.dragX + (target.x - w.block.dragX) * k,
      y: w.block.dragY + (target.y - w.block.dragY) * k,
      scale: 1 + (1 - k) * 0.18,
    }
  }
  return { x: target.x, y: target.y + w.block.travel, scale: 1 }
}

/** The specimen arm: a cantilever from the column that carries the block past the edge. */
export function drawArm(ctx: Ctx, w: World): void {
  const l = w.layout
  const b = blockScreen(w)
  const colW = l.column.w
  const colX = l.column.x
  const pivotX = colX + colW * 0.5
  const pivotY = l.column.y + colW * 2.2
  const armH = Math.max(16, l.block.h * 0.42)
  const tipX = b.x - l.block.w * 0.42

  ctx.save()
  // Arm body, tapering toward the specimen.
  poly(ctx, [
    [pivotX, pivotY - armH * 0.9],
    [tipX, b.y - armH * 0.5],
    [tipX, b.y + armH * 0.5],
    [pivotX, pivotY + armH * 0.9],
  ])
  ctx.fillStyle = linear(ctx, pivotX, pivotY - armH, tipX, b.y + armH, [
    [0, '#a8bcd2'],
    [0.28, '#75899f'],
    [0.68, '#495a70'],
    [1, '#2a3648'],
  ])
  ctx.fill()
  ctx.strokeStyle = 'rgba(220,238,255,0.28)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Pivot.
  circle(ctx, pivotX, pivotY, armH * 0.62)
  ctx.fillStyle = radial(ctx, pivotX - armH * 0.2, pivotY - armH * 0.2, armH * 1.5, '#dbe8f6', '#3c4c62')
  ctx.fill()

  // Chuck jaws gripping the little resin block.
  const jawW = l.block.w * 0.62
  const jawH = l.block.h * 0.3
  for (const s of [-1, 1]) {
    roundRectPath(ctx, tipX - jawW * 0.1, b.y + s * (l.block.h * 0.37) - jawH / 2, jawW, jawH, jawH * 0.38)
    ctx.fillStyle = linear(ctx, 0, b.y - l.block.h * 0.5, 0, b.y + l.block.h * 0.5, [
      [0, '#c2d2e4'],
      [1, '#44536a'],
    ])
    ctx.fill()
  }
  ctx.restore()
}

export function drawBlock(ctx: Ctx, w: World): void {
  const l = w.layout
  const spec = specimenById(w.specimen)
  const b = blockScreen(w)
  const bw = l.block.w * b.scale
  const bh = l.block.h * b.scale
  const x = b.x - bw / 2
  const y = b.y - bh / 2
  const r = bh * 0.14

  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(w.block.tilt)
  ctx.translate(-b.x, -b.y)

  ctx.save()
  ctx.globalAlpha = 0.35
  roundRectPath(ctx, x + 4 * l.ui, y + 7 * l.ui, bw, bh, r)
  ctx.fillStyle = '#050a11'
  if (w.quality === 'high') ctx.filter = 'blur(3px)'
  ctx.fill()
  ctx.restore()

  roundRectPath(ctx, x, y, bw, bh, r)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = linear(ctx, x, y, x + bw, y + bh, [
    [0, `rgba(${spec.resin[0]},${spec.resin[1]},${spec.resin[2]},0.95)`],
    [0.46, `rgba(${(spec.resin[0] * 0.8) | 0},${(spec.resin[1] * 0.8) | 0},${(spec.resin[2] * 0.84) | 0},0.9)`],
    [1, `rgba(${(spec.resin[0] * 0.46) | 0},${(spec.resin[1] * 0.48) | 0},${(spec.resin[2] * 0.56) | 0},0.94)`],
  ])
  ctx.fillRect(x, y, bw, bh)

  // The specimen suspended inside, softened by the resin.
  ctx.save()
  ctx.globalAlpha = 0.55
  if (w.quality === 'high') ctx.filter = `blur(${(bh * 0.03).toFixed(2)}px)`
  specimenSilhouette(ctx, spec.id, x + bw * 0.5, y + bh * 0.52, bh * 0.34, -0.4)
  ctx.fillStyle = `rgba(${spec.inner[0]},${spec.inner[1]},${spec.inner[2]},0.9)`
  ctx.fill()
  ctx.restore()
  specimenDetail(
    ctx,
    spec.id,
    x + bw * 0.5,
    y + bh * 0.52,
    bh * 0.32,
    -0.4,
    `rgba(${(spec.inner[0] * 0.55) | 0},${(spec.inner[1] * 0.55) | 0},${(spec.inner[2] * 0.55) | 0},0.5)`,
    Math.max(0.7, bh * 0.014),
  )

  ctx.fillStyle = radial(ctx, x + bw * 0.3, y + bh * 0.22, bh * 0.9, 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)')
  ctx.fillRect(x, y, bw, bh)
  ctx.restore()

  // The trimmed face that meets the knife: a bright band down the right edge.
  const faceW = Math.max(3, bw * 0.13)
  ctx.fillStyle = linear(ctx, x + bw - faceW, 0, x + bw, 0, [
    [0, 'rgba(255,255,255,0.04)'],
    [1, 'rgba(255,255,255,0.46)'],
  ])
  ctx.fillRect(x + bw - faceW, y + bh * 0.06, faceW, bh * 0.88)
  ctx.strokeStyle = 'rgba(255,255,255,0.62)'
  ctx.lineWidth = Math.max(1, 1.4 * l.ui)
  ctx.beginPath()
  ctx.moveTo(x + bw, y + bh * 0.06)
  ctx.lineTo(x + bw, y + bh * 0.94)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = Math.max(0.8, 1.1 * l.ui)
  roundRectPath(ctx, x, y, bw, bh, r)
  ctx.stroke()
  ctx.restore()
}

/** Non-verbal alignment aid: the block face and the edge line up as one bright line. */
export function drawAlignmentGuide(ctx: Ctx, w: World, strength: number): void {
  if (strength <= 0.01) return
  const l = w.layout
  const b = blockScreen(w)
  ctx.save()
  ctx.globalAlpha = strength * 0.55
  ctx.globalCompositeOperation = 'lighter'
  const y = l.knife.tipY - 5 * l.ui
  ctx.strokeStyle = 'rgba(196,228,255,0.85)'
  ctx.lineWidth = Math.max(1, 1.6 * l.ui)
  ctx.setLineDash([6 * l.ui, 5 * l.ui])
  ctx.beginPath()
  ctx.moveTo(b.x - l.block.w * 0.75, y)
  ctx.lineTo(l.knife.tipX + 12 * l.ui, y)
  ctx.stroke()
  ctx.setLineDash([])
  circle(ctx, l.knife.tipX, l.knife.tipY, 11 * l.ui * (1 + 0.2 * Math.sin(w.time * 4)))
  ctx.stroke()
  ctx.restore()
}
