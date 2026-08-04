import { clamp01 } from '../core/math'

export type RGB = [number, number, number]

/**
 * Thin-film interference of a floating section.
 * t = 0 → the thinnest usable slice (silver); t ≈ 0.55 → pale gold; beyond that the
 * film gets thick enough to run purple/blue. The standard run is kept in 0.1–0.7.
 */
const STOPS: { t: number; c: RGB }[] = [
  { t: 0.0, c: [150, 173, 199] },
  { t: 0.22, c: [186, 205, 224] },
  { t: 0.42, c: [214, 214, 198] },
  { t: 0.58, c: [232, 208, 140] },
  { t: 0.74, c: [220, 178, 96] },
  { t: 0.87, c: [196, 148, 158] },
  { t: 1.0, c: [150, 154, 210] },
]

export function interference(t: number): RGB {
  const x = clamp01(t)
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1]
    const b = STOPS[i]
    if (x <= b.t) {
      const k = (x - a.t) / (b.t - a.t)
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * k),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * k),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * k),
      ]
    }
  }
  return STOPS[STOPS.length - 1].c
}

/** Human-readable band, used by tests and by the reward sparkle picker. */
export function band(t: number): 'silver' | 'gold' | 'thick' {
  const x = clamp01(t)
  if (x < 0.4) return 'silver'
  if (x < 0.8) return 'gold'
  return 'thick'
}

export function rgb(c: RGB, a = 1): string {
  return a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

export function mix(a: RGB, b: RGB, k: number): RGB {
  const t = clamp01(k)
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

export function lighten(c: RGB, k: number): RGB {
  return mix(c, [255, 255, 255], k)
}

/** Playful full-spectrum variant, only offered in free-play mode. */
export function rainbow(phase: number): RGB {
  const h = ((phase % 1) + 1) % 1
  const s = 0.42
  const v = 0.98
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - s * f)
  const u = v * (1 - s * (1 - f))
  let r = v
  let g = u
  let b = p
  if (i % 6 === 1) {
    r = q
    g = v
    b = p
  } else if (i % 6 === 2) {
    r = p
    g = v
    b = u
  } else if (i % 6 === 3) {
    r = p
    g = q
    b = v
  } else if (i % 6 === 4) {
    r = u
    g = p
    b = v
  } else if (i % 6 === 5) {
    r = v
    g = p
    b = q
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}
