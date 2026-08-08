/**
 * Persistent player/parent settings plus the derived quality tier.
 *
 * Quality is guessed once from the device, then can be forced down by the
 * parent ("低負荷") or automatically by the frame-time watchdog in loop.ts.
 * Nothing here ever removes the signature moments (floating berries, the
 * squeeze, the hose flow) — it only changes how many of each we draw.
 */

export type Tier = 'low' | 'mid' | 'high';

export interface Settings {
  volume: number; // 0..1
  voice: boolean; // short Japanese spoken cues
  reduceMotion: boolean; // shorter camera moves, cross-fades instead of sweeps
  lowGraphics: boolean; // parent-forced low tier
}

const KEY = 'pokopoko.settings.v1';

const DEFAULTS: Settings = {
  volume: 0.8,
  voice: true,
  reduceMotion: false,
  lowGraphics: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode — run with in-memory settings */
  }
}

export function prefersReducedMotion(): boolean {
  return (
    settings.reduceMotion ||
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

/** Rough device class. Deliberately conservative: mid is the safe default. */
function guessTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const px = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1);
  if (cores <= 4 || mem <= 3) return 'low';
  if (cores >= 6 && px >= 1600) return 'high';
  return 'mid';
}

/**
 * `?tier=low|mid|high` forces the tier. Used by the QA sweep so the heavy
 * profiles can be exercised on machines that would otherwise be detected as
 * low, and handy when a parent wants to pin quality.
 */
function forcedTier(): Tier | null {
  try {
    const t = new URLSearchParams(location.search).get('tier');
    return t === 'low' || t === 'mid' || t === 'high' ? t : null;
  } catch {
    return null;
  }
}

let autoTier: Tier = forcedTier() ?? guessTier();

export function currentTier(): Tier {
  return settings.lowGraphics ? 'low' : autoTier;
}

/** Called by the frame watchdog when we are persistently missing frames. */
export function degradeTier(): boolean {
  if (autoTier === 'high') {
    autoTier = 'mid';
    return true;
  }
  if (autoTier === 'mid') {
    autoTier = 'low';
    return true;
  }
  return false;
}

export interface QualityProfile {
  /** Total berries simulated on the vines / water. */
  berries: number;
  /** Water plane grid resolution (per side). */
  waterSegments: number;
  /** Live particle cap (bubbles, droplets, foam). */
  particles: number;
  /** Vine clump instances. */
  vines: number;
  /** Cap on renderer pixel ratio. */
  maxPixelRatio: number;
  shadows: boolean;
  /** Extra decorative props (trees, crates, distant sheds). */
  decor: boolean;
}

const PROFILES: Record<Tier, QualityProfile> = {
  low: {
    berries: 620,
    waterSegments: 48,
    particles: 150,
    vines: 700,
    maxPixelRatio: 1.25,
    shadows: false,
    decor: false,
  },
  mid: {
    berries: 1100,
    waterSegments: 80,
    particles: 280,
    vines: 1250,
    maxPixelRatio: 1.75,
    shadows: true,
    decor: true,
  },
  high: {
    berries: 1500,
    waterSegments: 118,
    particles: 440,
    vines: 1700,
    maxPixelRatio: 2,
    shadows: true,
    decor: true,
  },
};

export function quality(): QualityProfile {
  return PROFILES[currentTier()];
}
