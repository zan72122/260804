// ============================================================================
// save.ts — localStorage への進行保存。壊れたJSON/プライベートモードでも安全。
// ============================================================================
import type { Progress } from './types';

const KEY = 'pin-factory-v1';

function defaultProgress(): Progress {
  return {
    clearedOnce: false,
    playCount: 0,
    freePlayUnlocked: false,
    decoration: 'classic',
    muted: false,
  };
}

function isValidDecoration(v: unknown): v is Progress['decoration'] {
  return v === 'classic' || v === 'pink' || v === 'rainbow' || v === 'flower';
}

function sanitize(raw: unknown): Progress {
  const def = defaultProgress();
  if (typeof raw !== 'object' || raw === null) return def;
  const r = raw as Record<string, unknown>;
  return {
    clearedOnce: typeof r.clearedOnce === 'boolean' ? r.clearedOnce : def.clearedOnce,
    playCount: typeof r.playCount === 'number' && isFinite(r.playCount) ? r.playCount : def.playCount,
    freePlayUnlocked: typeof r.freePlayUnlocked === 'boolean' ? r.freePlayUnlocked : def.freePlayUnlocked,
    decoration: isValidDecoration(r.decoration) ? r.decoration : def.decoration,
    muted: typeof r.muted === 'boolean' ? r.muted : def.muted,
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as unknown;
    return sanitize(parsed);
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // プライベートモード等で保存不可でも黙って無視
  }
}
