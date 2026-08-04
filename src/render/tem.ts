import type { Ctx } from './draw'
import { circle, glow, radial } from './draw'
import type { World } from '../game/world'
import type { SpecimenId } from '../game/state'
import { makeRng } from '../core/rng'
import { clamp01, lerp, smoothstep, TAU } from '../core/math'

interface Cell {
  x: number
  y: number
  pts: number[][]
  tone: number
}

type FeatureKind = 'blob' | 'vesicle' | 'fibril' | 'lattice'

interface Feature {
  x: number
  y: number
  r: number
  aspect: number
  rot: number
  tone: number
  stripes: number
  grains: number[][]
  kind: FeatureKind
}

export interface TemScene {
  id: SpecimenId
  cells: Cell[]
  features: Feature[]
  focus: { x: number; y: number }
  tint: [number, number, number]
  /** Feather keratin has no walled cells — it is drawn as fibre bundles instead. */
  walled: boolean
}

/**
 * An electron micrograph has no colour of its own. All three specimens share one
 * neutral warm grey; what differs between them is the structure, not the tint.
 */
const PLATE: [number, number, number] = [234, 234, 238]

const SPACE = 1000
/** Each octave halves the feature size, so there is structure at every magnification. */
const OCTAVES = 7

export function buildTemScene(id: SpecimenId, seed = 7): TemScene {
  const rng = makeRng(seed + id.length * 31)
  const walled = id !== 'feather'
  const cells: Cell[] = []

  const grid = 3
  const step = SPACE / grid
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const cx = (gx + 0.5) * step + (rng() - 0.5) * step * 0.24
      const cy = (gy + 0.5) * step + (rng() - 0.5) * step * 0.24
      const n = 8
      const pts: number[][] = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng() * 0.2
        // Keratin fibre bundles run long and narrow; plant cells are blocky.
        const r = step * (walled ? 0.46 + rng() * 0.12 : 0.2 + rng() * 0.06)
        const stretch = walled ? 1 : 2.5
        pts.push([cx + Math.cos(a) * r * stretch, cy + Math.sin(a) * r * 0.95])
      }
      cells.push({ x: cx, y: cy, pts, tone: walled ? 0.46 + rng() * 0.12 : 0.3 + rng() * 0.14 })
    }
  }

  const focus = { x: cells[4].x, y: cells[4].y }

  // Self-similar detail packed around the point the beam dives into: organelles,
  // then vesicles and membranes, then fibril bundles, then a crystal lattice.
  // organelles → vesicles → ribosomes → fibril bundles. The finest octaves are
  // fibrils, not an atomic lattice: you never resolve atoms in a resin section.
  const KINDS: FeatureKind[] = walled
    ? ['blob', 'blob', 'vesicle', 'vesicle', 'fibril', 'vesicle', 'fibril']
    : ['blob', 'fibril', 'blob', 'fibril', 'vesicle', 'fibril', 'fibril']
  const COUNTS = [22, 34, 46, 46, 22, 52, 20]
  const features: Feature[] = []
  for (let oct = 0; oct < OCTAVES; oct++) {
    const scale = 1 / 2 ** oct
    const r = SPACE * 0.085 * scale
    // Each octave is scattered over roughly the frame it will be seen in, so the
    // plate stays evenly populated all the way down instead of clumping at the
    // point the beam is diving into.
    const spread = Math.min(SPACE * 0.7, r * 17)
    const kind = KINDS[oct]
    for (let i = 0; i < COUNTS[oct]; i++) {
      const a = rng() * TAU
      const rr = spread * Math.sqrt(rng())
      const grains: number[][] = []
      for (let k = 0; k < 2; k++) {
        grains.push([(rng() - 0.5) * r * 1.0, (rng() - 0.5) * r * 0.7, r * (0.16 + rng() * 0.12)])
      }
      const tone =
        kind === 'vesicle'
          ? oct >= 5
            ? 0.08 + rng() * 0.16 // ribosomes: small and dense
            : 0.74 + rng() * 0.22 // vesicles: pale lumen behind a dark membrane
          : 0.18 + rng() * 0.34
      features.push({
        x: focus.x + Math.cos(a) * rr,
        y: focus.y + Math.sin(a) * rr,
        r: r * (0.72 + rng() * 0.56),
        aspect: kind === 'blob' ? 0.44 + rng() * 0.34 : 0.84 + rng() * 0.3,
        rot: rng() * TAU,
        tone,
        stripes: 4 + Math.floor(rng() * 6),
        grains,
        kind,
      })
    }
  }

  return { id, cells, features, focus, tint: PLATE, walled }
}

/** Zoom follows a smooth exponential, so the dive never jerks. */
export function temZoom(t: number): number {
  const d = clamp01(t / 12)
  const eased = d * d * (3 - 2 * d)
  return Math.exp(eased * Math.log(60))
}

export function temDone(t: number): boolean {
  return t >= 12
}

function gray(tone: number, a: number, tint: [number, number, number]): string {
  const v = clamp01(tone)
  const r = Math.round(lerp(24, tint[0], v))
  const g = Math.round(lerp(26, tint[1], v))
  const b = Math.round(lerp(32, tint[2], v))
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}

let grain: HTMLCanvasElement | null = null
function grainTile(): HTMLCanvasElement | null {
  if (grain) return grain
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  const img = g.createImageData(64, 64)
  const rng = makeRng(99)
  for (let i = 0; i < 64 * 64; i++) {
    const v = 128 + (rng() - 0.5) * 96
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 40
  }
  g.putImageData(img, 0, 0)
  grain = c
  return grain
}

export function drawTem(ctx: Ctx, w: World, scene: TemScene, alpha: number): void {
  const l = w.layout
  const cx = l.w / 2
  const cy = l.h / 2
  const zoom = w.tem.zoom
  const viewR = Math.min(l.w, l.h) * 0.46
  const detail = w.quality === 'high' ? 1 : 0.55

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#070a0e'
  ctx.fillRect(0, 0, l.w, l.h)

  ctx.save()
  circle(ctx, cx, cy, viewR)
  ctx.clip()

  // Cytoplasm ground tone: a real plate is mid grey, never black.
  ctx.fillStyle = gray(0.4, 1, scene.tint)
  ctx.fillRect(cx - viewR, cy - viewR, viewR * 2, viewR * 2)

  const base = (viewR * 2) / SPACE
  const s = base * zoom
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(s, s)
  ctx.translate(-scene.focus.x, -scene.focus.y)
  const px = 1 / s

  const half = (viewR / s) * 1.25
  const inView = (x: number, y: number, pad: number): boolean =>
    Math.abs(x - scene.focus.x) - pad <= half && Math.abs(y - scene.focus.y) - pad <= half

  // The bars of the grid square, framing the very first view.
  const aBars = 1 - smoothstep(1.4, 3, zoom)
  if (aBars > 0.01) {
    ctx.fillStyle = gray(0.04, aBars * 0.95, scene.tint)
    const m = SPACE * 0.06
    ctx.fillRect(-SPACE, -SPACE, SPACE * 3, SPACE + m)
    ctx.fillRect(-SPACE, SPACE - m, SPACE * 3, SPACE + m)
    ctx.fillRect(-SPACE, -SPACE, SPACE + m, SPACE * 3)
    ctx.fillRect(SPACE - m, -SPACE, SPACE + m, SPACE * 3)
  }

  // Cell walls arrive first, at the lowest magnification, and slide out of frame
  // as the beam dives into a single cell.
  const aCells = smoothstep(0.85, 1.5, zoom) * (1 - smoothstep(9, 16, zoom))
  if (aCells > 0.01) {
    for (const c of scene.cells) {
      if (!inView(c.x, c.y, SPACE / 2.2)) continue
      ctx.beginPath()
      ctx.moveTo((c.pts[0][0] + c.pts[1][0]) / 2, (c.pts[0][1] + c.pts[1][1]) / 2)
      for (let i = 1; i <= c.pts.length; i++) {
        const p = c.pts[i % c.pts.length]
        const q = c.pts[(i + 1) % c.pts.length]
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
      }
      ctx.closePath()
      ctx.fillStyle = gray(c.tone, aCells, scene.tint)
      ctx.fill()
      if (scene.walled) {
        // Cell wall: a pale band with the dark middle lamella down its centre.
        ctx.lineWidth = px * 11
        ctx.strokeStyle = gray(0.88, aCells * 0.95, scene.tint)
        ctx.stroke()
        ctx.lineWidth = px * 3
        ctx.strokeStyle = gray(0.05, aCells * 0.9, scene.tint)
        ctx.stroke()
      } else {
        // Keratin bundle: a dark sheath, no wall.
        ctx.lineWidth = px * 5
        ctx.strokeStyle = gray(0.12, aCells * 0.85, scene.tint)
        ctx.stroke()
      }
    }
  }

  // Multi-scale contents. A feature fades in once it is big enough to resolve and
  // fades out again once it is larger than the aperture, so the plate is never
  // an empty field and never one giant blob.
  for (const f of scene.features) {
    const rPx = f.r * s
    if (rPx < 3) continue
    const a = smoothstep(3.5, 11, rPx) * (1 - smoothstep(viewR * 0.3, viewR * 0.62, rPx))
    if (a < 0.02) continue
    if (!inView(f.x, f.y, f.r * 2)) continue

    ctx.save()
    ctx.translate(f.x, f.y)
    ctx.rotate(f.rot)
    if (f.kind === 'fibril') {
      const n = Math.max(2, Math.round(4 * detail) + 1)
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(px, f.r * 0.11)
      ctx.strokeStyle = gray(f.tone * 0.4, a * 0.85, scene.tint)
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * f.r * 0.34
        ctx.beginPath()
        ctx.moveTo(-f.r * 0.95, off)
        ctx.lineTo(f.r * 0.95, off)
        ctx.stroke()
      }
    } else if (f.kind === 'lattice') {
      ctx.fillStyle = gray(f.tone * 0.5, a * 0.9, scene.tint)
      const n = Math.max(2, Math.round(3 * detail) + 1)
      for (let iy = -n; iy <= n; iy++) {
        for (let ix = -n; ix <= n; ix++) {
          ctx.fillRect(ix * f.r * 0.7 - f.r * 0.16, iy * f.r * 0.7 - f.r * 0.16, f.r * 0.32, f.r * 0.32)
        }
      }
    } else {
      const rx = f.r
      const ry = f.r * f.aspect
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU)
      ctx.fillStyle = gray(f.tone, a * 0.95, scene.tint)
      ctx.fill()
      // Dense little bodies read better without an outline of their own.
      if (f.tone > 0.35) {
        ctx.lineWidth = Math.max(px, f.r * 0.09)
        ctx.strokeStyle = gray(0.05, a * 0.92, scene.tint)
        ctx.stroke()
      }
      if (f.kind === 'blob' && rPx > 26) {
        // Internal lamellae and bright storage grains.
        const inner = smoothstep(26, 60, rPx)
        const n = Math.max(3, Math.round(f.stripes * detail))
        ctx.lineWidth = Math.max(px, f.r * 0.045)
        ctx.strokeStyle = gray(0.04, a * inner * 0.8, scene.tint)
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n
          const y = lerp(-ry * 0.78, ry * 0.78, t)
          const halfW = rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)) * 0.86
          ctx.beginPath()
          ctx.moveTo(-halfW, y)
          ctx.lineTo(halfW, y)
          ctx.stroke()
        }
        for (const gr of f.grains) {
          ctx.beginPath()
          ctx.arc(gr[0], gr[1], gr[2], 0, TAU)
          ctx.fillStyle = gray(0.94, a * inner * 0.9, scene.tint)
          ctx.fill()
          ctx.lineWidth = Math.max(px, f.r * 0.03)
          ctx.strokeStyle = gray(0.2, a * inner * 0.7, scene.tint)
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  }
  ctx.restore()

  // Beam grain over the whole plate.
  const tile = grainTile()
  if (tile && w.quality === 'high') {
    const pat = ctx.createPattern(tile, 'repeat')
    if (pat) {
      ctx.globalAlpha = alpha * 0.55
      ctx.fillStyle = pat
      ctx.fillRect(cx - viewR, cy - viewR, viewR * 2, viewR * 2)
      ctx.globalAlpha = alpha
    }
  }

  // Gentle aperture falloff, not a black hole.
  ctx.fillStyle = radial(ctx, cx, cy, viewR * 1.02, 'rgba(0,0,0,0)', 'rgba(2,6,10,0.78)')
  ctx.fillRect(cx - viewR, cy - viewR, viewR * 2, viewR * 2)
  ctx.restore()

  // Rush lines: the only cue that says "we are still travelling inwards".
  const speed = clamp01((zoom - w.tem.zoomPrev) / Math.max(0.001, zoom) / 0.02)
  if (speed > 0.02 && w.quality === 'high') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(200,240,232,${(0.1 * speed).toFixed(3)})`
    ctx.lineWidth = Math.max(1, 1.6 * l.ui)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.21
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * viewR * 0.52, cy + Math.sin(a) * viewR * 0.52)
      ctx.lineTo(cx + Math.cos(a) * viewR * 0.99, cy + Math.sin(a) * viewR * 0.99)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.strokeStyle = 'rgba(168,232,214,0.5)'
  ctx.lineWidth = Math.max(1.6, 2.6 * l.ui)
  circle(ctx, cx, cy, viewR)
  ctx.stroke()
  glow(ctx, cx, cy, viewR * 1.14, 'rgba(130,225,205,0.22)', 0.55)
  ctx.restore()
}
