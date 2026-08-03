// ============================================================================
// 低レベル音声合成ヘルパー: ノイズバッファ生成・エンベロープ・同時発音数制御。
// ============================================================================
import type { SfxId } from '../core/types';
import { getCtx, getMasterGain } from './context';

export interface VoiceHandle {
  /** fadeSec 秒でフェードアウトして止める(既定は短いクリック回避フェード) */
  stop: (fadeSec?: number) => void;
}

// ── ノイズバッファ(キャッシュ付き) ──────────────────────────────────
const noiseCache = new Map<string, AudioBuffer>();

export function noiseBuffer(seconds: number, kind: 'white' | 'brown' = 'white'): AudioBuffer | null {
  const ctx = getCtx();
  if (!ctx) return null;
  const key = `${kind}:${seconds.toFixed(3)}:${ctx.sampleRate}`;
  const cached = noiseCache.get(key);
  if (cached) return cached;
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  noiseCache.set(key, buf);
  return buf;
}

export function noiseSource(seconds: number, kind: 'white' | 'brown' = 'white', loop = false): AudioBufferSourceNode | null {
  const ctx = getCtx();
  const buf = noiseBuffer(seconds, kind);
  if (!ctx || !buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  return src;
}

export function connectToMaster(node: AudioNode): void {
  const master = getMasterGain();
  if (master) node.connect(master);
}

// ── エンベロープ ─────────────────────────────────────────────────
/** 指数的アタック→ディケイ(ポップ/クリック向け) */
export function expEnv(gain: GainNode, t0: number, attack: number, peak: number, decay: number, floor = 0.0008): void {
  const p = gain.gain;
  p.cancelScheduledValues(t0);
  p.setValueAtTime(floor, t0);
  p.exponentialRampToValueAtTime(Math.max(peak, floor), t0 + Math.max(attack, 0.001));
  p.exponentialRampToValueAtTime(floor, t0 + Math.max(attack, 0.001) + decay);
}

/** 線形アタック→ホールド→リリース */
export function linEnv(gain: GainNode, t0: number, attack: number, peak: number, hold: number, release: number): void {
  const p = gain.gain;
  p.cancelScheduledValues(t0);
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(peak, t0 + attack);
  p.setValueAtTime(peak, t0 + attack + hold);
  p.linearRampToValueAtTime(0.0001, t0 + attack + hold + release);
}

export function rampFreq(param: AudioParam, from: number, to: number, t0: number, dur: number): void {
  param.cancelScheduledValues(t0);
  param.setValueAtTime(Math.max(from, 0.0001), t0);
  param.exponentialRampToValueAtTime(Math.max(to, 0.0001), t0 + Math.max(dur, 0.001));
}

// ── 同時発音制御: SfxId ごとに最大3。超過は最古を止める ───────────────
interface ActiveEntry { stop: () => void; timer: ReturnType<typeof setTimeout> | null }
const activeVoices = new Map<SfxId, ActiveEntry[]>();
const MAX_CONCURRENT = 3;

export function registerVoice(id: SfxId, stop: () => void, durationSec: number): void {
  let list = activeVoices.get(id);
  if (!list) { list = []; activeVoices.set(id, list); }
  const entry: ActiveEntry = { stop, timer: null };
  list.push(entry);
  if (list.length > MAX_CONCURRENT) {
    const oldest = list.shift();
    if (oldest) {
      if (oldest.timer) clearTimeout(oldest.timer);
      oldest.stop();
    }
  }
  if (Number.isFinite(durationSec)) {
    entry.timer = setTimeout(() => {
      const l = activeVoices.get(id);
      if (!l) return;
      const idx = l.indexOf(entry);
      if (idx >= 0) l.splice(idx, 1);
    }, Math.max(0, Math.ceil(durationSec * 1000) + 60));
  }
}

/** id の全アクティブ音を止める(roll/belt-hum 等の sfx:stop 用) */
export function stopAllVoices(id: SfxId): void {
  const list = activeVoices.get(id);
  if (!list) return;
  for (const v of list) {
    if (v.timer) clearTimeout(v.timer);
    v.stop();
  }
  activeVoices.set(id, []);
}
