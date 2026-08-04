import type { Ctx } from './draw'
import { circle, ellipse, glow, hintRing, linear, poly, radial, roundRectPath } from './draw'
import { gridMesh, specimenSilhouette } from './shapes'
import type { World } from '../game/world'
import type { Card } from '../game/cards'
import { SPECIMENS } from '../game/state'
import { interference, lighten, mix, rainbow, rgb } from '../game/color'
import { clamp01, lerp, TAU } from '../core/math'

function metalKnob(ctx: Ctx, x: number, y: number, r: number, tint: string): void {
  circle(ctx, x, y, r)
  ctx.fillStyle = radial(ctx, x - r * 0.3, y - r * 0.35, r * 1.5, 'rgba(255,255,255,0.55)', tint)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = Math.max(1, r * 0.06)
  ctx.stroke()
}

export function drawDropper(ctx: Ctx, w: World, prominence: number): void {
  const l = w.layout
  const d = l.tools.dropper
  const squeeze = w.dropperPress
  const r = d.r
  ctx.save()
  ctx.globalAlpha = 0.35 + 0.65 * prominence
  ctx.translate(d.x, d.y + squeeze * 4 * l.ui)

  // Glass barrel.
  const bw = r * 0.5
  const bh = r * 1.25
  roundRectPath(ctx, -bw / 2, -bh * 0.12, bw, bh, bw * 0.3)
  ctx.fillStyle = linear(ctx, -bw / 2, 0, bw / 2, 0, [
    [0, 'rgba(206,232,246,0.5)'],
    [0.4, 'rgba(240,252,255,0.85)'],
    [1, 'rgba(160,196,214,0.55)'],
  ])
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Water inside.
  roundRectPath(ctx, -bw / 2 + 2, bh * 0.24, bw - 4, bh * 0.5, bw * 0.2)
  ctx.fillStyle = 'rgba(96,190,214,0.75)'
  ctx.fill()

  // Tip.
  poly(ctx, [
    [-bw * 0.18, bh * 1.05],
    [bw * 0.18, bh * 1.05],
    [0, bh * 1.42],
  ])
  ctx.fillStyle = 'rgba(226,244,252,0.9)'
  ctx.fill()

  // Soft pink bulb — one of the allowed decorations.
  const bulbR = r * (0.46 - squeeze * 0.06)
  ellipse(ctx, 0, -bh * 0.22 - bulbR * 0.6, bulbR * (1 + squeeze * 0.12), bulbR * (1 - squeeze * 0.16))
  ctx.fillStyle = radial(
    ctx,
    -bulbR * 0.3,
    -bh * 0.22 - bulbR,
    bulbR * 2,
    'rgba(255,220,232,0.95)',
    'rgba(226,132,168,0.95)',
  )
  ctx.fill()
  ctx.restore()

  if (prominence > 0.5 && w.sinceInput > 2.6) hintRing(ctx, d.x, d.y, d.r * 1.15, w.time)
}

export function drawLever(ctx: Ctx, w: World, prominence: number): void {
  const l = w.layout
  const t = l.tools.lever
  ctx.save()
  ctx.globalAlpha = 0.32 + 0.68 * prominence

  // Track: a lit channel the knob slides down.
  const tw = t.r * 0.72
  roundRectPath(ctx, t.x - tw / 2, t.trackTop - t.r * 0.6, tw, t.trackBottom - t.trackTop + t.r * 1.2, tw / 2)
  ctx.fillStyle = linear(ctx, t.x - tw / 2, 0, t.x + tw / 2, 0, [
    [0, 'rgba(44,62,84,0.98)'],
    [0.5, 'rgba(72,98,126,0.98)'],
    [1, 'rgba(38,54,74,0.98)'],
  ])
  ctx.fill()
  ctx.strokeStyle = 'rgba(160,200,236,0.4)'
  ctx.lineWidth = Math.max(1, 1.4 * l.ui)
  ctx.stroke()

  // Downward travel hint: chevrons inside the channel, breathing when untouched.
  ctx.save()
  ctx.globalAlpha *= 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(w.time * 2.4)) * (w.sinceInput > 2.4 ? 1 : 0.35)
  ctx.strokeStyle = 'rgba(180,232,255,0.85)'
  ctx.lineWidth = Math.max(1.6, 2.4 * l.ui)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < 3; i++) {
    const y = t.trackBottom + t.r * 0.34 - i * t.r * 0.3
    ctx.beginPath()
    ctx.moveTo(t.x - t.r * 0.2, y - t.r * 0.14)
    ctx.lineTo(t.x, y)
    ctx.lineTo(t.x + t.r * 0.2, y - t.r * 0.14)
    ctx.stroke()
  }
  ctx.restore()

  const ky = lerp(t.trackTop, t.trackBottom, w.lever.value)
  metalKnob(ctx, t.x, ky, t.r, 'rgba(74,102,134,1)')
  // Warm grip band so the knob reads as the thing to hold.
  ctx.strokeStyle = 'rgba(255,214,232,0.75)'
  ctx.lineWidth = Math.max(1.4, t.r * 0.1)
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(t.x - t.r * 0.44, ky + i * t.r * 0.26)
    ctx.lineTo(t.x + t.r * 0.44, ky + i * t.r * 0.26)
    ctx.stroke()
  }
  glow(ctx, t.x, ky, t.r * 1.5, 'rgba(190,226,255,0.5)', 0.3)
  ctx.restore()

  if (prominence > 0.5 && w.sinceInput > 3 && !w.lever.grabbed) {
    hintRing(ctx, t.x, ky, t.r * 1.2, w.time)
  }
}

export function drawIonizer(ctx: Ctx, w: World, prominence: number): void {
  const l = w.layout
  const home = l.tools.ionizer
  const x = w.ionizer.home ? home.x : w.ionizer.x
  const y = w.ionizer.home ? home.y : w.ionizer.y
  const r = home.r
  ctx.save()
  ctx.globalAlpha = 0.3 + 0.7 * prominence

  // Breeze cone toward the water.
  if (w.ionizer.blow > 0.02) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha *= w.ionizer.blow
    for (let i = 0; i < 5; i++) {
      const k = ((w.time * 0.8 + i / 5) % 1)
      const rr = r * (0.7 + k * 3.2)
      ctx.strokeStyle = `rgba(180,226,255,${(0.3 * (1 - k)).toFixed(3)})`
      ctx.lineWidth = Math.max(1, 1.8 * l.ui)
      ctx.beginPath()
      ctx.arc(x, y, rr, -Math.PI * 0.78, -Math.PI * 0.22)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Handle.
  roundRectPath(ctx, x - r * 0.26, y + r * 0.1, r * 0.52, r * 1.1, r * 0.2)
  ctx.fillStyle = linear(ctx, x - r * 0.26, 0, x + r * 0.26, 0, [
    [0, '#cfdcea'],
    [0.45, '#8497ad'],
    [1, '#4f6178'],
  ])
  ctx.fill()

  // Blower head with a spinning fan behind a guard.
  const hy = y - r * 0.4
  circle(ctx, x, hy, r * 0.66)
  ctx.fillStyle = radial(ctx, x - r * 0.2, hy - r * 0.25, r * 1.3, '#e7f3fb', '#4a6f8c')
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = Math.max(1.2, r * 0.09)
  ctx.stroke()
  ctx.save()
  ctx.translate(x, hy)
  ctx.rotate(w.time * (1.2 + w.ionizer.blow * 8))
  for (let i = 0; i < 5; i++) {
    ctx.rotate(TAU / 5)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(r * 0.3, -r * 0.12, r * 0.46, r * 0.1)
    ctx.quadraticCurveTo(r * 0.24, r * 0.1, 0, 0)
    ctx.fillStyle = 'rgba(126,168,200,0.85)'
    ctx.fill()
  }
  ctx.restore()
  circle(ctx, x, hy, r * 0.14)
  ctx.fillStyle = '#d7e6f2'
  ctx.fill()
  ctx.restore()

  if (prominence > 0.5 && w.sinceInput > 2.6 && w.ionizer.home) {
    hintRing(ctx, home.x, home.y, home.r * 1.2, w.time, '190,230,255')
  }
}

export function drawEyelash(ctx: Ctx, w: World, prominence: number): void {
  const l = w.layout
  const home = l.tools.eyelash
  const active = w.eyelash.active
  const x = active ? w.eyelash.x : home.x
  const y = active ? w.eyelash.y : home.y
  const r = home.r
  ctx.save()
  ctx.globalAlpha = 0.3 + 0.7 * prominence

  // Water it has coaxed: faint flow lines behind the hair.
  if (active && w.eyelash.trail.length > 1) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(180,230,246,0.28)'
    ctx.lineWidth = Math.max(1, 1.6 * l.ui)
    ctx.beginPath()
    ctx.moveTo(w.eyelash.trail[0].x, w.eyelash.trail[0].y)
    for (const p of w.eyelash.trail) ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ctx.restore()
  }

  // Handle: a matchstick with a soft pink grip.
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.5)
  roundRectPath(ctx, -r * 0.2, -r * 0.05, r * 0.4, r * 1.5, r * 0.2)
  ctx.fillStyle = linear(ctx, -r * 0.2, 0, r * 0.2, 0, [
    [0, '#fbe6ee'],
    [0.42, '#e8b7c9'],
    [1, '#a8798e'],
  ])
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1
  ctx.stroke()

  // The eyelash itself: one soft, curved hair.
  ctx.strokeStyle = 'rgba(36,28,32,0.92)'
  ctx.lineWidth = Math.max(1.6, r * 0.11)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.02)
  ctx.bezierCurveTo(r * 0.05, -r * 0.7, r * 0.35, -r * 1.15, r * 0.78, -r * 1.3)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(210,226,244,0.35)'
  ctx.lineWidth = Math.max(0.7, r * 0.04)
  ctx.stroke()
  ctx.restore()

  if (w.eyelash.blocked > 0.02) {
    glow(ctx, x, y, r * 1.6, 'rgba(255,214,180,0.9)', 0.5 * w.eyelash.blocked)
  }
  ctx.restore()

  if (prominence > 0.5 && w.sinceInput > 2.6 && !active) {
    hintRing(ctx, home.x, home.y, home.r * 1.2, w.time, '255,214,232')
  }
}

export function drawGrid(ctx: Ctx, w: World, alpha = 1): void {
  const l = w.layout
  const g = w.grid
  const r = l.tools.grid.r
  const squash = lerp(1, 0.34, clamp01(g.submerge))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(g.x, g.y)
  ctx.rotate(g.tilt)

  // Handle / tweezer stem so it never reads as a bare finger near the edge.
  roundRectPath(ctx, -r * 0.12, -r * 2.0, r * 0.24, r * 1.35, r * 0.12)
  ctx.fillStyle = linear(ctx, -r * 0.12, 0, r * 0.12, 0, [
    [0, '#e6eef8'],
    [1, '#7d8ea3'],
  ])
  ctx.fill()

  // Copper mesh: metal, with a specular arc across it, not a biscuit.
  ellipse(ctx, 0, 0, r, r * squash)
  ctx.fillStyle = radial(ctx, -r * 0.35, -r * 0.4, r * 2.2, '#fff3e2', '#8a5f3c')
  ctx.fill()
  gridMesh(ctx, 0, 0, r * 0.92, squash, 'rgba(46,28,16,0.66)')
  gridMesh(ctx, 0, 0, r * 0.92, squash, 'rgba(255,240,220,0.18)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgba(255,246,232,0.55)'
  ctx.lineWidth = Math.max(1.2, r * 0.13)
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.86, r * 0.86 * squash, 0, Math.PI * 1.05, Math.PI * 1.62)
  ctx.stroke()
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,238,214,0.9)'
  ctx.lineWidth = Math.max(1.2, r * 0.1)
  ellipse(ctx, 0, 0, r, r * squash)
  ctx.stroke()

  // Ribbon riding on the grid once it has been lifted out.
  if (g.carry > 0.01) {
    ctx.save()
    ctx.globalAlpha = clamp01(g.carry)
    const ribbon = w.carried.length ? w.carried : [0.22, 0.3, 0.4, 0.5]
    const n = ribbon.length
    const sw = (r * 1.7) / n
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * sw
      ctx.fillStyle = rgb(interference(ribbon[i]), 0.95)
      ctx.beginPath()
      ctx.ellipse(t, 0, sw * 0.52, r * 0.52 * squash, 0, 0, TAU)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = Math.max(0.6, r * 0.04)
    ctx.beginPath()
    ctx.ellipse(0, 0, (sw * n) / 2, r * 0.52 * squash, 0, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()

  // Surface tension: the water clings to the mesh all the way out of the boat,
  // domes under it, and lets go one drip at a time.
  if (g.lift > 0.02 && (g.state === 'lifting' || g.state === 'carrying')) {
    const cling = g.state === 'carrying' ? 0.5 : 1
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = cling * 0.75
    ctx.strokeStyle = 'rgba(190,236,252,0.9)'
    ctx.lineWidth = Math.max(1.4, 2.4 * l.ui)
    ctx.beginPath()
    ctx.ellipse(g.x, g.y + r * 0.34, r * 1.06, r * 0.5 * (0.4 + 0.6 * (1 - g.lift)), 0, 0, Math.PI)
    ctx.stroke()
    ctx.restore()
    // The pendant drop still hanging off the mesh.
    ctx.save()
    ctx.globalAlpha = cling * 0.8
    ctx.fillStyle = 'rgba(140,206,232,0.75)'
    const dropR = r * (0.2 + 0.1 * Math.sin(w.time * 3))
    ctx.beginPath()
    ctx.ellipse(g.x + r * 0.12, g.y + r * 0.72, dropR * 0.72, dropR, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath()
    ctx.ellipse(g.x + r * 0.02, g.y + r * 0.66, dropR * 0.22, dropR * 0.3, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

export function drawTemPort(ctx: Ctx, w: World, prominence: number): void {
  const l = w.layout
  const t = l.tem
  ctx.save()
  ctx.globalAlpha = 0.35 + 0.65 * prominence
  // Column.
  roundRectPath(ctx, t.x - t.r * 0.62, t.y - t.r * 1.15, t.r * 1.24, t.r * 2.2, t.r * 0.26)
  ctx.fillStyle = linear(ctx, t.x - t.r * 0.6, 0, t.x + t.r * 0.6, 0, [
    [0, '#d7e2ef'],
    [0.35, '#93a5ba'],
    [0.72, '#5c6c81'],
    [1, '#37455a'],
  ])
  ctx.fill()
  // Viewing port.
  circle(ctx, t.x, t.y - t.r * 0.1, t.r * 0.42)
  ctx.fillStyle = radial(
    ctx,
    t.x,
    t.y - t.r * 0.1,
    t.r * 0.5,
    'rgba(180,240,220,0.95)',
    'rgba(24,60,58,0.95)',
  )
  ctx.fill()
  // Grid slot glowing softly.
  roundRectPath(ctx, t.x - t.r * 0.5, t.y + t.r * 0.42, t.r, t.r * 0.28, t.r * 0.13)
  ctx.fillStyle = 'rgba(10,20,28,0.9)'
  ctx.fill()
  glow(ctx, t.x, t.y + t.r * 0.56, t.r * 0.9, 'rgba(160,240,220,0.8)', 0.35 + 0.25 * Math.sin(w.time * 2.4))
  ctx.restore()

  if (prominence > 0.5) hintRing(ctx, t.x, t.y + t.r * 0.56, t.r * 0.8, w.time, '170,240,220')
}

/** A small translucent resin block with its specimen suspended inside. */
function resinBlock(
  ctx: Ctx,
  cx: number,
  cy: number,
  bw: number,
  bh: number,
  spec: (typeof SPECIMENS)[number],
  ui: number,
): void {
  const x = cx - bw / 2
  const y = cy - bh / 2
  ctx.save()
  ctx.globalAlpha = 0.35
  roundRectPath(ctx, x + 2 * ui, y + 4 * ui, bw, bh, bh * 0.16)
  ctx.fillStyle = '#050a11'
  ctx.fill()
  ctx.restore()

  roundRectPath(ctx, x, y, bw, bh, bh * 0.16)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = linear(ctx, x, y, x + bw, y + bh, [
    [0, `rgba(${spec.resin[0]},${spec.resin[1]},${spec.resin[2]},0.95)`],
    [1, `rgba(${(spec.resin[0] * 0.48) | 0},${(spec.resin[1] * 0.5) | 0},${(spec.resin[2] * 0.58) | 0},0.95)`],
  ])
  ctx.fillRect(x, y, bw, bh)
  ctx.globalAlpha = 0.5
  specimenSilhouette(ctx, spec.id, cx, cy, bh * 0.32, -0.4)
  ctx.fillStyle = `rgba(${spec.inner[0]},${spec.inner[1]},${spec.inner[2]},0.9)`
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = radial(ctx, x + bw * 0.3, y + bh * 0.22, bh * 0.85, 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)')
  ctx.fillRect(x, y, bw, bh)
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = Math.max(1, 1.3 * ui)
  roundRectPath(ctx, x, y, bw, bh, bh * 0.16)
  ctx.stroke()
}

/** A short ribbon of linked slices, drawn the same way as the real thing. */
function ribbonIcon(
  ctx: Ctx,
  cx: number,
  cy: number,
  len: number,
  wid: number,
  ui: number,
  spectrum: boolean,
  time: number,
): void {
  const n = 6
  const sw = len / n
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = '#04141c'
  roundRectPath(ctx, cx - len / 2 + 2 * ui, cy - wid / 2 + 5 * ui, len, wid, wid * 0.2)
  ctx.fill()
  ctx.restore()
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const c = spectrum ? rainbow(t * 0.85 + time * 0.04) : interference(0.16 + t * 0.5)
    const x = cx - len / 2 + sw * i
    const dy = Math.sin(t * 3 + time * 0.8) * wid * 0.1
    const g = ctx.createLinearGradient(x, cy - wid / 2, x, cy + wid / 2)
    g.addColorStop(0, rgb(mix(c, [90, 112, 140], 0.3), 0.95))
    g.addColorStop(0.45, rgb(lighten(c, 0.4), 0.98))
    g.addColorStop(1, rgb(mix(c, [104, 96, 120], 0.24), 0.95))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x + sw / 2, cy + dy, sw * 0.56, wid * 0.5, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = Math.max(0.8, 1.1 * ui)
    ctx.beginPath()
    ctx.moveTo(x + sw * 0.02, cy + dy - wid * 0.42)
    ctx.lineTo(x + sw * 0.02, cy + dy + wid * 0.42)
    ctx.stroke()
  }
  ctx.restore()
}

function cardShell(ctx: Ctx, c: Card, ui: number, glowK: number): void {
  roundRectPath(ctx, c.x, c.y, c.w, c.h, Math.min(c.w, c.h) * 0.16)
  ctx.fillStyle = linear(ctx, c.x, c.y, c.x, c.y + c.h, [
    [0, 'rgba(48,66,90,0.95)'],
    [1, 'rgba(24,34,50,0.95)'],
  ])
  ctx.fill()
  ctx.strokeStyle = `rgba(190,220,255,${(0.28 + 0.4 * glowK).toFixed(3)})`
  ctx.lineWidth = Math.max(1.4, 2.2 * ui)
  ctx.stroke()
}

/** Mystery blocks on the tray — nothing inside is revealed yet. */
export function drawChooseCard(ctx: Ctx, w: World, c: Card, i: number, pressed: boolean): void {
  const l = w.layout
  const spec = SPECIMENS[i % SPECIMENS.length]
  cardShell(ctx, c, l.ui, pressed ? 1 : 0.35 + 0.3 * Math.sin(w.time * 1.6 + i))
  const r = Math.min(c.w, c.h) * 0.3
  const cx = c.cx
  const cy = c.cy

  ctx.save()
  roundRectPath(ctx, cx - r, cy - r * 0.92, r * 2, r * 1.84, r * 0.3)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = linear(ctx, cx - r, cy - r, cx + r, cy + r, [
    [0, `rgba(${spec.resin[0]},${spec.resin[1]},${spec.resin[2]},0.9)`],
    [1, `rgba(${spec.resin[0] * 0.55},${spec.resin[1] * 0.58},${spec.resin[2] * 0.62},0.92)`],
  ])
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  // Something in there, deliberately unreadable.
  ctx.globalAlpha = 0.32
  ctx.filter = 'blur(6px)'
  specimenSilhouette(ctx, spec.id, cx, cy, r * 0.6, 0.3 + i)
  ctx.fillStyle = `rgba(${spec.inner[0]},${spec.inner[1]},${spec.inner[2]},1)`
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = Math.max(1, 1.5 * l.ui)
  ctx.stroke()

  // Shimmer sweeping across the resin.
  const k = ((w.time * 0.5 + i * 0.33) % 1)
  glow(ctx, cx - r + k * r * 2, cy - r * 0.4, r * 0.6, 'rgba(255,255,255,0.8)', 0.35)
  ctx.restore()
}

export function drawReplayCard(ctx: Ctx, w: World, c: Card, kind: 'same' | 'other' | 'free', pressed: boolean): void {
  const l = w.layout
  cardShell(ctx, c, l.ui, pressed ? 1 : 0.3)
  const r = Math.min(c.w, c.h) * 0.3
  const cx = c.cx
  const cy = c.cy
  ctx.save()
  if (kind === 'same') {
    // The same block, back at the edge, with its ribbon running onto the water.
    ctx.fillStyle = 'rgba(38,104,120,0.55)'
    poly(ctx, [
      [cx - r * 0.3, cy - r * 0.5],
      [cx + r * 1.5, cy - r * 0.5],
      [cx + r * 1.6, cy + r * 0.72],
      [cx - r * 0.2, cy + r * 0.72],
    ])
    ctx.fill()
    resinBlock(ctx, cx - r * 0.78, cy - r * 0.05, r * 0.62, r * 0.86, SPECIMENS[0], l.ui)
    ctx.strokeStyle = 'rgba(236,250,255,0.95)'
    ctx.lineWidth = Math.max(1.8, 2.6 * l.ui)
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.34, cy - r * 0.52)
    ctx.lineTo(cx - r * 0.22, cy + r * 0.6)
    ctx.stroke()
    glow(ctx, cx - r * 0.32, cy - r * 0.4, r * 0.4, 'rgba(230,248,255,0.9)', 0.6)
    ribbonIcon(ctx, cx + r * 0.62, cy + r * 0.14, r * 1.4, r * 0.5, l.ui, false, w.time)
  } else if (kind === 'other') {
    // The tray of blocks waiting on the bench.
    roundRectPath(ctx, cx - r * 1.45, cy - r * 0.2, r * 2.9, r * 0.92, r * 0.16)
    ctx.fillStyle = linear(ctx, 0, cy - r * 0.2, 0, cy + r * 0.72, [
      [0, '#8fa3b9'],
      [0.4, '#55677d'],
      [1, '#2a3543'],
    ])
    ctx.fill()
    ctx.strokeStyle = 'rgba(220,238,255,0.35)'
    ctx.lineWidth = Math.max(1, 1.4 * l.ui)
    ctx.stroke()
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * r * 0.92
      resinBlock(ctx, cx + ox, cy - r * 0.16, r * 0.56, r * 0.8, SPECIMENS[i], l.ui)
    }
  } else {
    // One long ribbon whose interference runs through the whole spectrum.
    ctx.fillStyle = 'rgba(38,104,120,0.45)'
    poly(ctx, [
      [cx - r * 1.6, cy - r * 0.52],
      [cx + r * 1.6, cy - r * 0.52],
      [cx + r * 1.7, cy + r * 0.74],
      [cx - r * 1.7, cy + r * 0.74],
    ])
    ctx.fill()
    ribbonIcon(ctx, cx, cy + r * 0.1, r * 2.7, r * 0.56, l.ui, true, w.time)
  }
  ctx.restore()
}

export function drawMute(ctx: Ctx, w: World): void {
  const l = w.layout
  const m = l.mute
  ctx.save()
  ctx.globalAlpha = 0.55
  circle(ctx, m.x, m.y, m.r)
  ctx.fillStyle = 'rgba(20,30,44,0.8)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(190,214,240,0.7)'
  ctx.lineWidth = Math.max(1.2, 1.8 * l.ui)
  ctx.beginPath()
  ctx.moveTo(m.x - m.r * 0.42, m.y - m.r * 0.2)
  ctx.lineTo(m.x - m.r * 0.12, m.y - m.r * 0.2)
  ctx.lineTo(m.x + m.r * 0.22, m.y - m.r * 0.55)
  ctx.lineTo(m.x + m.r * 0.22, m.y + m.r * 0.55)
  ctx.lineTo(m.x - m.r * 0.12, m.y + m.r * 0.2)
  ctx.lineTo(m.x - m.r * 0.42, m.y + m.r * 0.2)
  ctx.closePath()
  ctx.fillStyle = 'rgba(210,230,250,0.85)'
  ctx.fill()
  if (w.muted) {
    ctx.beginPath()
    ctx.moveTo(m.x - m.r * 0.5, m.y - m.r * 0.5)
    ctx.lineTo(m.x + m.r * 0.6, m.y + m.r * 0.6)
    ctx.strokeStyle = 'rgba(255,160,160,0.95)'
    ctx.stroke()
  } else {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath()
      ctx.arc(m.x + m.r * 0.3, m.y, m.r * (0.5 + i * 0.28), -0.9, 0.9)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Small home glyph used to leave free play. */
export function drawHomeButton(ctx: Ctx, w: World, x: number, y: number, r: number): void {
  ctx.save()
  ctx.globalAlpha = 0.95
  circle(ctx, x, y, r)
  ctx.fillStyle = 'rgba(24,36,52,0.92)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(200,224,250,0.8)'
  ctx.lineWidth = Math.max(1.4, 2 * w.layout.ui)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - r * 0.45, y)
  ctx.lineTo(x, y - r * 0.45)
  ctx.lineTo(x + r * 0.45, y)
  ctx.moveTo(x - r * 0.28, y)
  ctx.lineTo(x - r * 0.28, y + r * 0.45)
  ctx.lineTo(x + r * 0.28, y + r * 0.45)
  ctx.lineTo(x + r * 0.28, y)
  ctx.stroke()
  ctx.restore()
}
