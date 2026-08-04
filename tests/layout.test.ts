import { describe, expect, it } from 'vitest'
import { computeLayout, poolPoint } from '../src/game/layout'
import type { Layout } from '../src/game/layout'
import { SLOT_SPACING, TARGET_SECTIONS, createRibbonShape, slotDistance, slotLateral } from '../src/game/ribbon'

const NOTCH = { top: 47, right: 0, bottom: 34, left: 0 }
const FLAT = { top: 0, right: 0, bottom: 0, left: 0 }

const SIZES = [
  { name: 'iPhone 14 portrait', w: 390, h: 844, insets: NOTCH },
  { name: 'iPhone 14 landscape', w: 844, h: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 } },
  { name: 'iPad 11 portrait', w: 820, h: 1180, insets: FLAT },
  { name: 'iPad 11 landscape', w: 1180, h: 820, insets: FLAT },
  { name: 'iPhone SE portrait', w: 320, h: 568, insets: FLAT },
]

function toolDiscs(l: Layout): { name: string; x: number; y: number; r: number }[] {
  return [
    { name: 'dropper', ...l.tools.dropper },
    { name: 'lever', x: l.tools.lever.x, y: l.tools.lever.y, r: l.tools.lever.r },
    { name: 'ionizer', ...l.tools.ionizer },
    { name: 'eyelash', ...l.tools.eyelash },
    { name: 'grid', ...l.tools.grid },
    { name: 'tem', ...l.tem },
  ]
}

describe.each(SIZES)('layout $name', (size) => {
  const l = computeLayout(size)

  it('keeps the whole boat on screen', () => {
    const corners = [
      poolPoint(l, 0, 0),
      poolPoint(l, 1, 0),
      poolPoint(l, 1, 1),
      poolPoint(l, 0, 1),
    ]
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(size.insets.left - 1)
      expect(c.x).toBeLessThanOrEqual(size.w - size.insets.right + 1)
      expect(c.y).toBeGreaterThanOrEqual(size.insets.top - 1)
      expect(c.y).toBeLessThanOrEqual(size.h - size.insets.bottom + 1)
    }
  })

  it('keeps every tool inside the safe area', () => {
    for (const t of toolDiscs(l)) {
      expect(t.x - t.r, `${t.name} left`).toBeGreaterThanOrEqual(size.insets.left - 2)
      expect(t.x + t.r, `${t.name} right`).toBeLessThanOrEqual(size.w - size.insets.right + 2)
      expect(t.y - t.r, `${t.name} top`).toBeGreaterThanOrEqual(size.insets.top - 2)
      expect(t.y + t.r, `${t.name} bottom`).toBeLessThanOrEqual(size.h - size.insets.bottom + 2)
    }
  })

  it('keeps the whole lever travel on screen, cap and all', () => {
    const t = l.tools.lever
    const top = t.trackTop - t.r * 0.6
    const bottom = t.trackBottom + t.r * 0.6
    expect(bottom).toBeLessThanOrEqual(size.h - size.insets.bottom + 0.5)
    expect(top).toBeGreaterThanOrEqual(size.h - size.insets.bottom - l.barH - 0.5)
    // The knob must still be able to travel far enough to feel like a stroke.
    expect(t.trackBottom - t.trackTop).toBeGreaterThanOrEqual(44)
  })

  it('gives every required control a finger-sized target', () => {
    for (const t of toolDiscs(l)) {
      expect(t.r * 2, `${t.name} diameter`).toBeGreaterThanOrEqual(52)
    }
  })

  it('never puts a bottom-bar tool on top of the water', () => {
    const nearEdgeY = poolPoint(l, 0.5, 1).y
    for (const t of [l.tools.dropper, l.tools.lever, l.tools.ionizer, l.tools.eyelash]) {
      expect(t.y - t.r).toBeGreaterThan(nearEdgeY - 1)
    }
  })

  it('hangs the block above the diamond edge with room to travel past it', () => {
    expect(l.block.restY + l.block.h).toBeLessThan(l.knife.tipY)
    expect(l.block.restY + l.block.travel).toBeGreaterThanOrEqual(l.knife.tipY - l.block.h)
    // The block clears the edge entirely at the bottom of the stroke.
    expect(l.block.restY + l.block.travel + l.block.h).toBeGreaterThan(l.knife.tipY)
    expect(l.block.faceX).toBeCloseTo(l.knife.tipX, 5)
  })

  it('has room for a whole ribbon on the water', () => {
    const shape = createRibbonShape()
    const far = slotDistance(TARGET_SECTIONS - 1) + SLOT_SPACING / 2
    expect((far * l.section.len) / l.pool.len).toBeLessThan(1)
    for (let s = 0; s < TARGET_SECTIONS; s++) {
      const v = slotLateral(shape, s)
      const p = poolPoint(l, (slotDistance(s) * l.section.len) / l.pool.len, v)
      expect(p.x).toBeLessThan(size.w - size.insets.right)
      expect(p.y).toBeGreaterThan(l.pool.y - 1)
      expect(p.y).toBeLessThan(l.pool.y + l.pool.depth + 1)
    }
  })

  it('reserves a real exclusion zone around the diamond edge', () => {
    expect(l.edgeGuard).toBeGreaterThan(20)
  })

  it('reports the orientation the device is actually in', () => {
    expect(l.orientation).toBe(size.w >= size.h ? 'landscape' : 'portrait')
  })
})

describe('layout stability across rotation', () => {
  it('maps the same ribbon slot to a valid spot in both orientations', () => {
    const p = computeLayout({ w: 390, h: 844, insets: NOTCH })
    const ls = computeLayout({ w: 844, h: 390, insets: NOTCH })
    const shape = createRibbonShape()
    for (let s = 0; s < TARGET_SECTIONS; s++) {
      for (const l of [p, ls]) {
        const u = (slotDistance(s) * l.section.len) / l.pool.len
        expect(u).toBeGreaterThan(0)
        expect(u).toBeLessThan(1)
        const pt = poolPoint(l, u, slotLateral(shape, s))
        expect(Number.isFinite(pt.x)).toBe(true)
        expect(Number.isFinite(pt.y)).toBe(true)
      }
    }
  })

  it('survives absurd viewport sizes without producing NaN', () => {
    for (const [w, h] of [
      [1, 1],
      [10000, 200],
      [200, 10000],
    ]) {
      const l = computeLayout({ w, h, insets: FLAT })
      expect(Number.isFinite(l.pool.len)).toBe(true)
      expect(l.pool.len).toBeGreaterThan(0)
      expect(l.section.len).toBeGreaterThan(0)
    }
  })
})
