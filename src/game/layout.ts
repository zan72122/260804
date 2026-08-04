import { clamp } from '../core/math'
import { RIBBON_SPAN } from './ribbon'

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Viewport {
  w: number
  h: number
  insets: Insets
}

export interface Disc {
  x: number
  y: number
  r: number
}

export interface Layout {
  w: number
  h: number
  orientation: 'portrait' | 'landscape'
  /** Global UI scale so a 4-year-old's targets stay finger sized on every device. */
  ui: number
  insets: Insets
  /** Top of the usable play area (below the notch). */
  top: number
  /** Bottom of the usable play area (above the tool bar). */
  bottom: number
  barH: number
  barCy: number
  /** Diamond knife cutting edge, where every section is born. */
  knife: { tipX: number; tipY: number; rake: number; depth: number }
  /** Water surface of the knife boat: a receding band starting at the edge. */
  pool: { x: number; y: number; len: number; depth: number; sink: number; shear: number }
  block: { w: number; h: number; restY: number; travel: number; faceX: number }
  /** The vertical column the specimen arm swings from. */
  column: { x: number; y: number; w: number }
  section: { len: number; width: number }
  tools: {
    dropper: Disc
    lever: Disc & { trackTop: number; trackBottom: number }
    ionizer: Disc
    eyelash: Disc
    grid: Disc
  }
  tem: Disc
  mute: Disc
  /** Solid tools must never come closer than this to the diamond edge. */
  edgeGuard: number
}

export function computeLayout(vp: Viewport): Layout {
  const w = Math.max(280, vp.w)
  const h = Math.max(320, vp.h)
  const insets = vp.insets
  const orientation: 'portrait' | 'landscape' = w >= h ? 'landscape' : 'portrait'
  const short = Math.min(w, h)
  const ui = clamp(short / 430, 0.72, 1.65)

  const barH =
    orientation === 'portrait'
      ? clamp(h * 0.23, 128, 214)
      : clamp(h * 0.28, 104, 176)

  const top = insets.top + 8 * ui
  const bottom = h - insets.bottom - barH - 6 * ui
  const barCy = h - insets.bottom - barH * 0.5
  const playH = Math.max(120, bottom - top)

  const leftPad = insets.left + 10 * ui
  const rightPad = insets.right + 12 * ui
  const tipX = clamp(w * (orientation === 'portrait' ? 0.32 : 0.28), leftPad + 56 * ui, w * 0.4)
  const spanX = Math.max(90, w - rightPad - tipX)

  // The edge line recedes to the lower right, so the water quad is sheared.
  const shear0 = Math.min(playH * 0.17, spanX * 0.16)
  // The boat shell is drawn a rim proud of the water on every side; leave room for
  // it or the far corner gets clipped by the screen edge.
  const rim = clamp(9 * ui, 6, 18)
  const poolLen = Math.max(110, (spanX - shear0 - rim * 2) / 1.04)
  const colW = clamp(w * 0.075, 22, 66)

  const depthCap = poolLen * (orientation === 'portrait' ? 1.4 : 0.9)
  const poolDepth = clamp(playH * (orientation === 'portrait' ? 0.56 : 0.55), 64, depthCap)
  const shear = Math.min(poolDepth * 0.26, spanX * 0.16)
  const tipY = bottom - poolDepth
  const machineH = tipY - top

  // A slice is exactly as long as the block face it was shaved from, seen
  // foreshortened on the water. The block takes as much of the machine bay as it
  // can, and the boat is always long enough to hold a whole ribbon.
  const lenBudget = poolLen / (RIBBON_SPAN + 0.45)
  const blockH = clamp(Math.min((machineH - 24 * ui) / 1.2, lenBudget * 3), 30, 140)
  // Taller than wide, like a real trimmed block face — and it keeps the column clear.
  const blockW = blockH * 0.7
  const secLen = clamp(Math.min(lenBudget, blockH * 0.55), 12, 96)
  // Across the edge there is no foreshortening to hide behind: a slice is exactly
  // as wide as the block face that produced it.
  const secWidth = blockW
  const travel = blockH + 22 * ui

  const gap = clamp(Math.min(w * 0.24, 156 * ui), 76, 178)
  const cx = w * 0.5
  // The lever is drawn as a track with a rounded cap 0.6r proud at each end. Size
  // the knob and the track so that whole shape always fits inside the tool bar —
  // a control whose travel runs off the bottom of the screen is unusable.
  const levelR = clamp(Math.min(38 * ui, (barH - 58) / 1.2), 26, 62)
  const trackH = Math.max(46, Math.min(clamp(barH * 0.6, 58, 122), barH - 1.2 * levelR - 6))

  return {
    w,
    h,
    orientation,
    ui,
    insets,
    top,
    bottom,
    barH,
    barCy,
    knife: { tipX, tipY, rake: clamp(secLen * 0.5, 14, 40), depth: poolDepth },
    pool: {
      x: tipX,
      y: tipY,
      len: poolLen,
      depth: poolDepth,
      sink: clamp(poolDepth * 0.24, 14, 46),
      shear,
    },
    block: {
      w: blockW,
      h: blockH,
      restY: tipY - blockH - 20 * ui,
      travel,
      faceX: tipX,
    },
    column: { x: leftPad, y: top + clamp(40 * ui, 30, 60), w: colW },
    section: { len: secLen, width: secWidth },
    tools: {
      dropper: { x: cx, y: barCy, r: clamp(44 * ui, 34, 72) },
      lever: {
        x: cx,
        y: barCy,
        r: levelR,
        trackTop: barCy - trackH * 0.5,
        trackBottom: barCy + trackH * 0.5,
      },
      ionizer: { x: cx + gap, y: barCy, r: clamp(36 * ui, 28, 58) },
      eyelash: { x: cx - gap, y: barCy, r: clamp(36 * ui, 28, 58) },
      // The grid waits *above* the water so the child swipes down into the boat
      // and up to lift the ribbon out, exactly as the spec describes. Its handle
      // sticks up two radii, so it hangs low enough not to be cut off.
      grid: {
        x: w - rightPad - clamp(34 * ui, 26, 54),
        y: top + clamp(34 * ui, 26, 54) * 2.4,
        r: clamp(34 * ui, 26, 54),
      },
    },
    // The microscope stands to one side: the grid must never be lifted straight
    // into it, or the column would cover the moment the ribbon comes out.
    tem: {
      x: w - insets.right - clamp(60 * ui, 46, 96),
      y: barCy,
      r: clamp(48 * ui, 38, 80),
    },
    mute: { x: insets.left + 22 * ui, y: top + 16 * ui, r: clamp(17 * ui, 14, 26) },
    edgeGuard: Math.max(26, secLen * 0.85),
  }
}

/** Map a normalised boat coordinate (u along the ribbon, v across the boat) to screen space. */
/**
 * The boat's surface is a plane seen at a shallow angle: the far side (v = 0,
 * hard against the diamond edge) is both narrower and shifted left, so the water
 * reads as a surface receding away rather than as a pane of glass.
 */
export function poolPoint(l: Layout, u: number, v: number): { x: number; y: number } {
  return {
    x: l.pool.x + v * l.pool.shear + u * l.pool.len * (0.68 + 0.36 * v),
    y: l.pool.y + v * l.pool.depth,
  }
}

/** Nearer parts of the boat read slightly larger; keeps the 2.5D read honest. */
export function poolScale(v: number): number {
  return 0.9 + 0.26 * v
}

export function toU(l: Layout, px: number): number {
  return px / l.pool.len
}
