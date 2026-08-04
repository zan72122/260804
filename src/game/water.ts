import { clamp } from '../core/math'

export const WATER_IDEAL = 1
export const WATER_MAX = 1.3
export const DROP_STEP = 0.17
/** Below this the meniscus has not reached the diamond edge yet. */
export const MENISCUS_TOUCH = 0.965

export interface WaterState {
  level: number
  /** 0 = mirror still, 1 = freshly disturbed. */
  agitation: number
  touched: boolean
}

export function createWater(): WaterState {
  return { level: 0.34, agitation: 0, touched: false }
}

export function addDrop(w: WaterState): WaterState {
  return {
    ...w,
    level: clamp(w.level + DROP_STEP, 0, WATER_MAX),
    agitation: Math.min(1, w.agitation + 0.55),
  }
}

/**
 * Overfilling is never a failure: surplus water quietly wicks back to the ideal
 * meniscus, and the surface settles on its own.
 */
export function stepWater(w: WaterState, dt: number): WaterState {
  let level = w.level
  if (level > WATER_IDEAL) {
    level = Math.max(WATER_IDEAL, level - dt * 0.22)
  }
  const agitation = Math.max(0, w.agitation - dt * 0.85)
  const touched = w.touched || level >= MENISCUS_TOUCH
  return { level, agitation, touched }
}

export function meniscusReached(w: WaterState): boolean {
  return w.level >= MENISCUS_TOUCH
}

/** 0..1 — how convincingly the reflection line has closed up at the edge. */
export function reflectionJoin(w: WaterState): number {
  return clamp((w.level - 0.72) / (MENISCUS_TOUCH - 0.72), 0, 1)
}
