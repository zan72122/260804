import { clamp, smoothstep } from '../core/math'

/** How far the newest section (slot 0) rests from the diamond edge, in section lengths. */
export const SLOT0_OFFSET = 0.72
/** Sections in a ribbon touch end to end; a hair under 1 keeps the seam visible. */
export const SLOT_SPACING = 0.985
export const MAX_RIBBON = 6
export const TARGET_SECTIONS = 5
/** Slots the boat must hold, including the half slice of clearance at each end. */
export const RIBBON_SPAN = SLOT0_OFFSET + (MAX_RIBBON - 1) * SLOT_SPACING + SLOT_SPACING / 2

export interface RibbonShape {
  /** Lateral wander of the ribbon across the boat, 0..1 of boat depth. */
  amplitude: number
  wavelength: number
  phase: number
  base: number
}

export function createRibbonShape(): RibbonShape {
  return { amplitude: 0.055, wavelength: 3.1, phase: 0.6, base: 0.46 }
}

/** Distance from the edge, in section lengths, for a (fractional) ribbon slot. */
export function slotDistance(slot: number): number {
  return SLOT0_OFFSET + slot * SLOT_SPACING
}

/**
 * Lateral position across the boat for a ribbon slot. Slices are born hard against
 * the edge (v ≈ 0.15) and swing out into the middle of the boat as the ribbon
 * grows — the same graceful curve a real ribbon traces as it leaves the knife.
 */
export function slotLateral(shape: RibbonShape, slot: number): number {
  const entry = smoothstep(-1, 3.4, slot)
  const base = 0.19 + (shape.base - 0.19) * entry
  const wave = shape.amplitude * Math.sin(slot / shape.wavelength + shape.phase) * entry
  return clamp(base + wave, 0.1, 0.92)
}

/** Screen-space angle of the ribbon at a slot, in "boat" units (dv per du). */
export function slotSlope(shape: RibbonShape, slot: number): number {
  return (shape.amplitude / shape.wavelength) * Math.cos(slot / shape.wavelength + shape.phase)
}

/**
 * A faster or shakier stroke gives the ribbon a livelier wave — but never an ugly
 * one: amplitude is clamped into a range that always reads as a ribbon.
 */
export function waveFromStroke(speed: number, jitter: number): number {
  return clamp(0.035 + speed * 0.045 + jitter * 0.06, 0.03, 0.13)
}

/** The eyelash coaxes the water, which straightens the ribbon over time. */
export function relaxShape(shape: RibbonShape, dt: number, strength: number): RibbonShape {
  const k = 1 - Math.exp(-dt * (0.4 + strength * 2.6))
  return {
    ...shape,
    amplitude: shape.amplitude + (0.028 - shape.amplitude) * k,
    wavelength: shape.wavelength + (4.2 - shape.wavelength) * k * 0.6,
  }
}

export function isTidy(shape: RibbonShape): boolean {
  return shape.amplitude <= 0.05
}
