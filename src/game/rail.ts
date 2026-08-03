import { mulberry32 } from './rng';

/**
 * One rail modelled as a 1D heightfield along the track.
 * Heights are corrugation deviation from the ideal rail line (abstract units,
 * roughly "exaggerated millimetres"). Grinding pulls heights continuously
 * toward 0 near the grinder position — never a sudden swap.
 */
export const TRACK_LENGTH = 60; // metres of playable track
export const SAMPLES = 512;

export interface Zone {
  start: number;
  end: number;
}

export class Rail {
  readonly seed: number;
  readonly heights: Float32Array;
  /** 0..1 per sample: how much this sample has been ground (for shine). */
  readonly groundMask: Float32Array;
  readonly zone: Zone;
  readonly initialRms: number;

  constructor(seed: number) {
    this.seed = seed;
    const rnd = mulberry32(seed);
    const zoneLen = 10 + rnd() * 6;
    const zoneStart = 20 + rnd() * 8;
    this.zone = { start: zoneStart, end: zoneStart + zoneLen };

    const lambda1 = 0.7 + rnd() * 0.5; // main corrugation wavelength (m)
    const lambda2 = lambda1 * (1.9 + rnd() * 0.8);
    const phase1 = rnd() * Math.PI * 2;
    const phase2 = rnd() * Math.PI * 2;
    const amp2 = 0.3 + rnd() * 0.3;

    this.heights = new Float32Array(SAMPLES);
    this.groundMask = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      const s = (i / (SAMPLES - 1)) * TRACK_LENGTH;
      const env = envelope(s, this.zone);
      if (env <= 0) continue;
      const w =
        Math.sin((s / lambda1) * Math.PI * 2 + phase1) +
        amp2 * Math.sin((s / lambda2) * Math.PI * 2 + phase2);
      this.heights[i] = w * env;
    }
    this.initialRms = this.rmsInZone();
  }

  static sampleToPos(i: number): number {
    return (i / (SAMPLES - 1)) * TRACK_LENGTH;
  }

  static posToSample(s: number): number {
    return (s / TRACK_LENGTH) * (SAMPLES - 1);
  }

  heightAt(s: number): number {
    const f = Math.min(Math.max(Rail.posToSample(s), 0), SAMPLES - 1);
    const i = Math.floor(f);
    const j = Math.min(i + 1, SAMPLES - 1);
    const t = f - i;
    return this.heights[i] * (1 - t) + this.heights[j] * t;
  }

  /**
   * Grind around position `s` for a travel of `ds` metres.
   * Removal per metre travelled is constant, so a fast swipe and a slow crawl
   * both repair the rail (child never fails by speed).
   */
  grindAt(s: number, ds: number): void {
    if (ds <= 0) return;
    const halfWidth = 1.0; // metres of stone contact influence
    const i0 = Math.max(0, Math.floor(Rail.posToSample(s - halfWidth)));
    const i1 = Math.min(SAMPLES - 1, Math.ceil(Rail.posToSample(s + halfWidth)));
    for (let i = i0; i <= i1; i++) {
      const d = Math.abs(Rail.sampleToPos(i) - s) / halfWidth;
      const falloff = Math.max(0, 1 - d * d);
      const k = Math.min(0.95, ds * 4.5 * falloff);
      this.heights[i] *= 1 - k;
      this.groundMask[i] = Math.min(1, this.groundMask[i] + k * 1.5);
    }
  }

  rmsInZone(): number {
    const i0 = Math.floor(Rail.posToSample(this.zone.start));
    const i1 = Math.ceil(Rail.posToSample(this.zone.end));
    let sum = 0;
    let n = 0;
    for (let i = i0; i <= i1 && i < SAMPLES; i++) {
      sum += this.heights[i] * this.heights[i];
      n++;
    }
    return n > 0 ? Math.sqrt(sum / n) : 0;
  }

  /** RMS of an arbitrary span — used to prove untouched track stays untouched. */
  rmsInSpan(a: number, b: number): number {
    const i0 = Math.max(0, Math.floor(Rail.posToSample(a)));
    const i1 = Math.min(SAMPLES - 1, Math.ceil(Rail.posToSample(b)));
    let sum = 0;
    let n = 0;
    for (let i = i0; i <= i1; i++) {
      sum += this.heights[i] * this.heights[i];
      n++;
    }
    return n > 0 ? Math.sqrt(sum / n) : 0;
  }

  snapshotHeights(): Float32Array {
    return new Float32Array(this.heights);
  }
}

function envelope(s: number, zone: Zone): number {
  const fade = 2.2; // metres of smooth ramp at each zone edge
  if (s <= zone.start || s >= zone.end) return 0;
  const a = smoothstep((s - zone.start) / fade);
  const b = smoothstep((zone.end - s) / fade);
  return Math.min(a, b);
}

function smoothstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}
