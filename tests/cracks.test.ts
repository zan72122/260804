import { describe, expect, it } from "vitest";
import {
  Crack, detectability, fluxAngleForYoke, generateCracks, leakStrength,
  meanAccum, meanReveal
} from "../src/cracks";

const FLUX_PASS1 = fluxAngleForYoke(0);   // poles left/right -> horizontal flux
const FLUX_PASS2 = fluxAngleForYoke(90);  // after rotation -> vertical flux

/** per-point effective strengths, the same rule the renderer accumulates by */
function effs(crack: Crack, flux: number): number[][] {
  return crack.tang.map((arr) => arr.map((t) => leakStrength(detectability(t, flux))));
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

  it("crack A lights fully in pass 1; crack B stays dark until the rotation — for every seed", () => {
    // Judged point-by-point with the same leakStrength rule the game
    // accumulates by, so a passing test means the *rendered* behaviour
    // holds: no local kink of the "parallel" crack may form a line.
    for (let seed = 0; seed < 300; seed++) {
      const [a, b] = generateCracks(seed);
      // A under horizontal flux: nearly every point holds particles
      const aE = effs(a, FLUX_PASS1).flat();
      expect(aE.filter((e) => e > 0.5).length / aE.length).toBeGreaterThan(0.85);
      // B under horizontal flux: essentially nothing, and never two
      // consecutive points strong enough to draw a line segment
      const bE1 = effs(b, FLUX_PASS1);
      const all = bE1.flat();
      expect(all.reduce((s, v) => s + v, 0) / all.length).toBeLessThan(0.05);
      for (const poly of bE1) {
        let run = 0;
        for (const e of poly) {
          run = e > 0.35 ? run + 1 : 0;
          expect(run).toBeLessThanOrEqual(1);
        }
      }
      // B after the 90-degree rotation: main line fully strong, branch clear
      const bE2 = effs(b, FLUX_PASS2);
      expect(bE2[0].filter((e) => e > 0.5).length / bE2[0].length).toBeGreaterThan(0.85);
      const br = bE2[1];
      expect(br.reduce((s, v) => s + v, 0) / br.length).toBeGreaterThan(0.5);
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

  it("leakStrength gates weak leakage to zero and saturates strong leakage", () => {
    expect(leakStrength(0)).toBe(0);
    expect(leakStrength(0.42)).toBe(0);
    expect(leakStrength(0.3)).toBe(0);
    expect(leakStrength(0.72)).toBe(1);
    expect(leakStrength(1)).toBe(1);
    expect(leakStrength(0.57)).toBeGreaterThan(0.2);
    expect(leakStrength(0.57)).toBeLessThan(0.8);
  });
});
