import { describe, it, expect } from 'vitest';
import { SparkSystem } from '../../src/game/sparks';
import { mulberry32 } from '../../src/game/rng';

describe('spark pooling', () => {
  it('never exceeds pool capacity under heavy emission', () => {
    const sys = new SparkSystem();
    const rnd = mulberry32(1);
    for (let i = 0; i < 600; i++) sys.update(0.016, 1, 3.4, 1, rnd);
    expect(sys.sparks.count()).toBeLessThanOrEqual(sys.sparks.capacity);
    expect(sys.mist.count()).toBeLessThanOrEqual(sys.mist.capacity);
  });

  it('emits nothing at zero intensity and dies out', () => {
    const sys = new SparkSystem();
    const rnd = mulberry32(2);
    for (let i = 0; i < 30; i++) sys.update(0.016, 1, 2, 0, rnd);
    expect(sys.sparks.count()).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) sys.update(0.016, 0, 0, 0, rnd);
    expect(sys.sparks.count()).toBe(0);
  });

  it('sparks stay behind the stone and low (deflector plate)', () => {
    const sys = new SparkSystem();
    const rnd = mulberry32(3);
    for (let i = 0; i < 120; i++) {
      sys.update(0.016, 1, 3, 0, rnd);
      sys.sparks.forEach((p) => {
        expect(p.dx).toBeGreaterThanOrEqual(0);
        if (p.dx > 0.25 && p.dx < 1.4) expect(p.dy).toBeLessThanOrEqual(0.56);
      });
    }
  });
});
