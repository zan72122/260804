import { describe, it, expect } from 'vitest';
import { Rail, TRACK_LENGTH } from '../../src/game/rail';

describe('Rail heightfield', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rail(42);
    const b = new Rail(42);
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(a.zone).toEqual(b.zone);
  });

  it('differs between seeds', () => {
    const a = new Rail(1);
    const b = new Rail(2);
    const same = Array.from(a.heights).every((v, i) => v === b.heights[i]);
    expect(same).toBe(false);
  });

  it('has corrugation only inside the zone', () => {
    const r = new Rail(7);
    expect(r.initialRms).toBeGreaterThan(0.3);
    expect(r.rmsInSpan(0, r.zone.start - 1)).toBe(0);
    expect(r.rmsInSpan(r.zone.end + 1, TRACK_LENGTH)).toBe(0);
  });

  it('grinding smooths only near the grinder position', () => {
    const r = new Rail(7);
    const mid = (r.zone.start + r.zone.end) / 2;
    const beforeNear = r.rmsInSpan(mid - 1, mid + 1);
    const beforeFar = r.rmsInSpan(r.zone.start, r.zone.start + 2);
    // simulate the grinder passing over just the middle metre
    for (let k = 0; k < 20; k++) r.grindAt(mid - 0.5 + k * 0.05, 0.05);
    expect(r.rmsInSpan(mid - 1, mid + 1)).toBeLessThan(beforeNear * 0.4);
    expect(r.rmsInSpan(r.zone.start, r.zone.start + 2)).toBeCloseTo(beforeFar, 5);
  });

  it('a full pass at any speed repairs the zone', () => {
    for (const step of [0.02, 0.3]) {
      const r = new Rail(11);
      for (let s = r.zone.start - 2; s < r.zone.end + 2; s += step) {
        r.grindAt(s, step);
      }
      expect(r.rmsInZone()).toBeLessThan(r.initialRms * 0.15);
    }
  });

  it('grinding is continuous, never a sudden swap', () => {
    const r = new Rail(5);
    const mid = (r.zone.start + r.zone.end) / 2;
    let prev = r.rmsInZone();
    for (let k = 0; k < 10; k++) {
      r.grindAt(mid, 0.05);
      const now = r.rmsInZone();
      expect(now).toBeLessThanOrEqual(prev);
      // one small step must not jump straight to done
      expect(now).toBeGreaterThan(prev * 0.7);
      prev = now;
    }
  });
});
