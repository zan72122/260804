import { describe, expect, it } from "vitest";
import {
  detectability, fluxAngleForYoke, generateCracks, meanAccum, meanReveal
} from "../src/cracks";

const FLUX_PASS1 = fluxAngleForYoke(0);   // poles left/right -> horizontal flux
const FLUX_PASS2 = fluxAngleForYoke(90);  // after rotation -> vertical flux

function meanDetectability(crack: ReturnType<typeof generateCracks>[number], flux: number): number {
  let s = 0, n = 0;
  for (const arr of crack.tang) for (const t of arr) { s += detectability(t, flux); n++; }
  return s / n;
}

describe("crack generation", () => {
  it("produces exactly two cracks, one per magnetization pass", () => {
    const cracks = generateCracks(7);
    expect(cracks).toHaveLength(2);
    expect(cracks[0].pass).toBe(1);
    expect(cracks[1].pass).toBe(2);
  });

  it("keeps every point on the inspection face", () => {
    for (const seed of [1, 7, 42, 999]) {
      for (const c of generateCracks(seed)) {
        for (const poly of c.polys) {
          for (const p of poly) {
            expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.85);
          }
        }
      }
    }
  });

  it("crack A leaks strongly under pass-1 flux, crack B only after rotation", () => {
    for (const seed of [1, 7, 42, 999, 12345]) {
      const [a, b] = generateCracks(seed);
      // vertical-ish crack vs horizontal flux: strong indication
      expect(meanDetectability(a, FLUX_PASS1)).toBeGreaterThan(0.6);
      // the tilted horizontal crack barely shows in pass 1...
      expect(meanDetectability(b, FLUX_PASS1)).toBeLessThan(0.45);
      // ...and pops after the 90-degree rotation
      expect(meanDetectability(b, FLUX_PASS2)).toBeGreaterThan(0.55);
      // pass-2 beats pass-1 decisively for crack B
      expect(meanDetectability(b, FLUX_PASS2)).toBeGreaterThan(
        meanDetectability(b, FLUX_PASS1) * 1.8
      );
    }
  });

  it("same seed reproduces the same cracks; new seeds vary them", () => {
    const a1 = generateCracks(77)[0].polys[0];
    const a2 = generateCracks(77)[0].polys[0];
    const a3 = generateCracks(78)[0].polys[0];
    expect(a1).toEqual(a2);
    expect(a1).not.toEqual(a3);
  });

  it("accum/reveal aggregate math behaves", () => {
    const [a] = generateCracks(5);
    expect(meanAccum(a)).toBe(0);
    expect(meanReveal(a)).toBe(0);
    for (const arr of a.accum) arr.fill(1);
    for (const arr of a.reveal) arr.fill(0.5);
    expect(meanAccum(a)).toBe(1);
    expect(meanReveal(a)).toBeCloseTo(0.5);
  });

  it("detectability follows sin^2 of tangent-vs-flux angle", () => {
    expect(detectability(Math.PI / 2, 0)).toBeCloseTo(1);
    expect(detectability(0, 0)).toBeCloseTo(0);
    expect(detectability(Math.PI / 4, 0)).toBeCloseTo(0.5);
  });
});
