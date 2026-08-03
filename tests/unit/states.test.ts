import { describe, it, expect } from 'vitest';
import { PHASES, TRANSITIONS, canGo } from '../../src/game/states';

describe('state machine table', () => {
  it('covers the full loop in order', () => {
    const loop = [
      'title',
      'arrive',
      'scanBefore',
      'prepUnits',
      'lower',
      'grind',
      'scanAfter',
      'testRun',
      'replay',
    ] as const;
    for (let i = 0; i < loop.length - 1; i++) {
      expect(canGo(loop[i], loop[i + 1])).toBe(true);
    }
    // replay loops back to arrive
    expect(canGo('replay', 'arrive')).toBe(true);
  });

  it('refuses skipping ahead or jumping backwards', () => {
    expect(canGo('title', 'grind')).toBe(false);
    expect(canGo('scanBefore', 'grind')).toBe(false);
    expect(canGo('grind', 'scanBefore')).toBe(false);
    expect(canGo('testRun', 'title')).toBe(false);
  });

  it('every phase has at least one exit and no undefined targets', () => {
    for (const p of PHASES) {
      expect(TRANSITIONS[p].length).toBeGreaterThan(0);
      for (const q of TRANSITIONS[p]) expect(PHASES).toContain(q);
    }
  });
});
