import { describe, expect, it } from 'vitest'
import { facePeel, nextPhase, TOUCHDOWN_AT, createSection, SPECIMENS, specimenById } from '../src/game/state'
import type { Phase } from '../src/game/state'

describe('phase machine', () => {
  it('walks the whole loop from choose to replay', () => {
    let p: Phase = 'choose'
    p = nextPhase(p, 'blockChosen')
    expect(p).toBe('mount')
    p = nextPhase(p, 'blockSeated')
    expect(p).toBe('water')
    p = nextPhase(p, 'meniscusReady')
    expect(p).toBe('cut')
    p = nextPhase(p, 'ribbonComplete')
    expect(p).toBe('tidy')
    p = nextPhase(p, 'ribbonTidy')
    expect(p).toBe('pickup')
    p = nextPhase(p, 'ribbonLifted')
    expect(p).toBe('tem')
    p = nextPhase(p, 'revealDone')
    expect(p).toBe('replay')
  })

  it('gets back to cutting from the reward screen in a single step', () => {
    expect(nextPhase('replay', 'replaySame')).toBe('cut')
  })

  it('ignores events that do not belong to the current phase', () => {
    expect(nextPhase('choose', 'ribbonLifted')).toBe('choose')
    expect(nextPhase('cut', 'blockChosen')).toBe('cut')
    // Mashing the same event never advances twice.
    expect(nextPhase(nextPhase('choose', 'blockChosen'), 'blockChosen')).toBe('mount')
  })

  it('offers free play and a way back out', () => {
    expect(nextPhase('replay', 'replayFree')).toBe('free')
    expect(nextPhase('free', 'exitFree')).toBe('replay')
    expect(nextPhase('replay', 'replayOther')).toBe('choose')
  })
})

describe('face peel', () => {
  const blockH = 60
  const edgeY = 300

  it('grows continuously from 0 to 1 as the face crosses the edge', () => {
    const samples: number[] = []
    for (let travel = 0; travel <= 120; travel += 2) {
      samples.push(facePeel(edgeY - blockH - 20 + travel, blockH, edgeY))
    }
    expect(samples[0]).toBe(0)
    expect(samples[samples.length - 1]).toBe(1)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
      // No single frame may jump the film into existence.
      expect(samples[i] - samples[i - 1]).toBeLessThan(0.06)
    }
    // And it really does pass through the middle rather than snapping.
    expect(samples.some((v) => v > 0.2 && v < 0.8)).toBe(true)
  })

  it('touches the water only after part of the film has formed', () => {
    expect(TOUCHDOWN_AT).toBeGreaterThan(0)
    expect(TOUCHDOWN_AT).toBeLessThan(0.5)
  })

  it('clamps outside the contact window', () => {
    // Block still parked above the edge: nothing has been shaved yet.
    expect(facePeel(edgeY - 500, blockH, edgeY)).toBe(0)
    // Block fully past the edge: the slice is complete.
    expect(facePeel(edgeY + 10, blockH, edgeY)).toBe(1)
    expect(facePeel(0, 0, edgeY)).toBe(0)
  })
})

describe('specimens', () => {
  it('exposes three mystery blocks and resolves them by id', () => {
    expect(SPECIMENS).toHaveLength(3)
    for (const s of SPECIMENS) expect(specimenById(s.id).id).toBe(s.id)
  })

  it('creates slices that start attached and compressed', () => {
    const s = createSection(1, 0.3, false)
    expect(s.peel).toBe(0)
    expect(s.phase).toBe('peeling')
    expect(s.spread).toBeLessThan(1)
    expect(s.fade).toBe(1)
  })
})
