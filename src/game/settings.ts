/**
 * Accessibility settings (softer light / motion / sound) and light progress.
 * Persisted to localStorage; storage failures are swallowed (private mode).
 */
export interface Settings {
  softLight: boolean;
  softMotion: boolean;
  softSound: boolean;
}

export interface Progress {
  rounds: number;
  lastSeed: number;
}

const SETTINGS_KEY = 'railgrinder.v1.settings';
const PROGRESS_KEY = 'railgrinder.v1.progress';

export function loadSettings(): Settings {
  const def: Settings = { softLight: false, softMotion: false, softSound: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      softLight: !!p.softLight,
      softMotion: !!p.softMotion,
      softSound: !!p.softSound,
    };
  } catch {
    return def;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. — settings just won't persist */
  }
}

export function loadProgress(): Progress {
  const def: Progress = { rounds: 0, lastSeed: 1 };
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      rounds: typeof p.rounds === 'number' ? p.rounds : 0,
      lastSeed: typeof p.lastSeed === 'number' ? p.lastSeed : 1,
    };
  } catch {
    return def;
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
