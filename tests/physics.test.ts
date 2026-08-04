import { describe, expect, it } from 'vitest'
import {
  DROP_STEP,
  MENISCUS_TOUCH,
  WATER_IDEAL,
  WATER_MAX,
  addDrop,
  createWater,
  meniscusReached,
  reflectionJoin,
  stepWater,
} from '../src/game/water'
import { guardEdge } from '../src/game/safety'
import {
  MAX_RIBBON,
  TARGET_SECTIONS,
  createRibbonShape,
  isTidy,
  relaxShape,
  slotDistance,
  slotLateral,
  waveFromStroke,
} from '../src/game/ribbon'
import { band, interference, rainbow } from '../src/game/color'

describe('knife boat water', () => {
  it('rises one drop at a time and reaches the edge', () => {
    let w = createWater()
    const levels = [w.level]
    let taps = 0
    while (!meniscusReached(w) && taps < 40) {
      w = addDrop(w)
      levels.push(w.level)
      taps++
    }
    expect(meniscusReached(w)).toBe(true)
    expect(taps).toBeLessThanOrEqual(Math.ceil(1 / DROP_STEP) + 1)
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1])
  })

  it('treats overfilling as harmless and settles back to the ideal meniscus', () => {
    let w = createWater()
    for (let i = 0; i < 30; i++) w = addDrop(w)
    expect(w.level).toBeLessThanOrEqual(WATER_MAX)
    for (let i = 0; i < 600; i++) w = stepWater(w, 1 / 60)
    expect(w.level).toBeCloseTo(WATER_IDEAL, 3)
    expect(w.touched).toBe(true)
  })

  it('calms the surface on its own', () => {
    let w = addDrop(createWater())
    expect(w.agitation).toBeGreaterThan(0)
    for (let i = 0; i < 200; i++) w = stepWater(w, 1 / 60)
    expect(w.agitation).toBe(0)
  })

  it('joins the reflection line exactly when the meniscus arrives', () => {
    expect(reflectionJoin({ level: 0.5, agitation: 0, touched: false })).toBe(0)
    expect(reflectionJoin({ level: MENISCUS_TOUCH, agitation: 0, touched: true })).toBeCloseTo(1, 5)
    expect(reflectionJoin({ level: 1.2, agitation: 0, touched: true })).toBe(1)
  })
})

describe('diamond edge safety', () => {
  const tip = { x: 200, y: 300 }
  const guard = 40

  it('never lets a solid tool reach the edge', () => {
    for (let x = 0; x <= 600; x += 7) {
      for (let y = 0; y <= 600; y += 7) {
        const g = guardEdge(x, y, tip.x, tip.y, guard)
        const d = Math.hypot(g.x - tip.x, g.y - tip.y)
        expect(d).toBeGreaterThanOrEqual(guard * 1.15 - 1e-6)
        expect(g.x).toBeGreaterThanOrEqual(tip.x + guard - 1e-6)
      }
    }
  })

  it('leaves tools alone when they are already well clear', () => {
    const g = guardEdge(500, 500, tip.x, tip.y, guard)
    expect(g.blocked).toBe(false)
    expect(g.x).toBe(500)
    expect(g.y).toBe(500)
  })

  it('flags the block so the UI can show a soft stop', () => {
    expect(guardEdge(tip.x, tip.y, tip.x, tip.y, guard).blocked).toBe(true)
  })
})

describe('ribbon', () => {
  it('lays slices out end to end, marching away from the edge', () => {
    for (let s = 1; s < MAX_RIBBON; s++) {
      expect(slotDistance(s)).toBeGreaterThan(slotDistance(s - 1))
    }
    expect(slotDistance(1) - slotDistance(0)).toBeCloseTo(0.985, 5)
  })

  it('starts each slice at the edge and swings it out into the boat', () => {
    const shape = createRibbonShape()
    expect(slotLateral(shape, -0.55)).toBeLessThan(0.2)
    expect(slotLateral(shape, 3)).toBeGreaterThan(0.3)
    for (let s = -1; s < MAX_RIBBON; s += 0.25) {
      const v = slotLateral(shape, s)
      expect(v).toBeGreaterThanOrEqual(0.1)
      expect(v).toBeLessThanOrEqual(0.92)
    }
  })

  it('always produces a pretty wave, whatever the child does with the lever', () => {
    for (const speed of [0, 0.3, 1, 4, 100]) {
      for (const jitter of [0, 0.5, 9]) {
        const a = waveFromStroke(speed, jitter)
        expect(a).toBeGreaterThanOrEqual(0.03)
        expect(a).toBeLessThanOrEqual(0.13)
      }
    }
  })

  it('lets the eyelash tidy the ribbon, and tidies on its own eventually', () => {
    let shape = { ...createRibbonShape(), amplitude: 0.13 }
    expect(isTidy(shape)).toBe(false)
    for (let i = 0; i < 240; i++) shape = relaxShape(shape, 1 / 60, 1)
    expect(isTidy(shape)).toBe(true)

    let slow = { ...createRibbonShape(), amplitude: 0.13 }
    for (let i = 0; i < 60 * 20; i++) slow = relaxShape(slow, 1 / 60, 0)
    expect(isTidy(slow)).toBe(true)
  })

  it('targets fewer slices than the boat can hold', () => {
    expect(TARGET_SECTIONS).toBeLessThan(MAX_RIBBON)
  })
})

describe('thin film colour', () => {
  it('runs silver then pale gold across the usable range', () => {
    expect(band(0.15)).toBe('silver')
    expect(band(0.55)).toBe('gold')
    expect(band(0.95)).toBe('thick')
  })

  it('stays bright and in gamut everywhere', () => {
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const c = interference(t)
      for (const ch of c) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(255)
      }
      // Sections must never read as dark blobs on the water.
      expect((c[0] + c[1] + c[2]) / 3).toBeGreaterThan(150)
    }
  })

  it('moves smoothly, with no colour jumps between neighbouring thicknesses', () => {
    let prev = interference(0)
    for (let t = 0.01; t <= 1.0001; t += 0.01) {
      const c = interference(t)
      const jump = Math.max(
        Math.abs(c[0] - prev[0]),
        Math.abs(c[1] - prev[1]),
        Math.abs(c[2] - prev[2]),
      )
      expect(jump).toBeLessThan(12)
      prev = c
    }
  })

  it('keeps the playful rainbow inside gamut too', () => {
    for (let p = -2; p < 3; p += 0.05) {
      for (const ch of rainbow(p)) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(255)
      }
    }
  })
})
