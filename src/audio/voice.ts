// ============================================================================
// VoiceId ごとの音声。将来はファイル音声に差し替え可能な構造。
// 現状は鉄琴風の短いメロディチャイム(2〜3音)で代替合成する。
// registerVoiceClip(id, url) で URL を登録しておけば、ロード完了後は
// そちらが優先される(実際のデコード/フェッチ処理は本実装のスコープ外)。
// ============================================================================
import type { VoiceId } from '../core/types';
import { getCtx, getMasterGain, isReady } from './context';
import { bell } from './sfx';

type Stopper = () => void;

function makeStop(stoppers: Stopper[]): Stopper {
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    for (const s of stoppers) s();
  };
}

/** 各 VoiceId の音形(周波数Hz, 開始オフセット秒, 減衰秒)。鉄琴ベルで演奏。 */
type NotePlan = { freq: number; at: number; decay: number }[];

const VOICE_MELODIES: Record<VoiceId, NotePlan> = {
  // 「おくを、みてみよう」: 問いかけるような上昇2音
  'look-back': [
    { freq: 587.33, at: 0, decay: 0.28 }, // D5
    { freq: 880.0, at: 0.16, decay: 0.4 }, // A5
  ],
  // 「ロック、よし！」: 力強く決まる下降2音
  'lock-ok': [
    { freq: 987.77, at: 0, decay: 0.22 }, // B5
    { freq: 659.25, at: 0.13, decay: 0.45 }, // E5
  ],
  // 「つまっているね」: 揺らぐ3音(低→やや高→低)、心配そうに
  stuck: [
    { freq: 493.88, at: 0, decay: 0.22 }, // B4
    { freq: 587.33, at: 0.15, decay: 0.2 }, // D5
    { freq: 440.0, at: 0.3, decay: 0.4 }, // A4
  ],
  // 「くるん！」: 軽快に跳ねる上昇3音
  kurun: [
    { freq: 523.25, at: 0, decay: 0.16 }, // C5
    { freq: 659.25, at: 0.09, decay: 0.16 }, // E5
    { freq: 987.77, at: 0.18, decay: 0.35 }, // B5
  ],
  // 「10ほん、そろった！」: 明るい長3和音上昇(達成感)
  'ten-ready': [
    { freq: 523.25, at: 0, decay: 0.2 }, // C5
    { freq: 659.25, at: 0.12, decay: 0.2 }, // E5
    { freq: 1046.5, at: 0.24, decay: 0.5 }, // C6
  ],
  // 「ストン！」: 短く2音、下に落ち着く
  ston: [
    { freq: 698.46, at: 0, decay: 0.18 }, // F5
    { freq: 523.25, at: 0.1, decay: 0.4 }, // C5
  ],
  // 「ボールが、もどってきた！」: 弾むような往復3音
  'ball-back': [
    { freq: 587.33, at: 0, decay: 0.16 }, // D5
    { freq: 880.0, at: 0.1, decay: 0.16 }, // A5
    { freq: 698.46, at: 0.22, decay: 0.4 }, // F5
  ],
};

interface VoiceClip { url: string; buffer: AudioBuffer | null }
const voiceClips = new Map<VoiceId, VoiceClip>();

/**
 * 将来の音声ファイル差し替え口。URL を登録しておくと、デコード済みバッファが
 * 用意され次第そちらが優先再生される。本実装ではフェッチ/デコードは行わない
 * (構造のみ提供)。
 */
export function registerVoiceClip(id: VoiceId, url: string): void {
  voiceClips.set(id, { url, buffer: null });
  // 将来実装: fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
  //           .then(buf => { const c = voiceClips.get(id); if (c) c.buffer = buf; });
}

function playClip(ctx: AudioContext, dest: AudioNode, buffer: AudioBuffer): Stopper {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);
  src.start();
  return () => {
    try {
      src.stop();
    } catch {
      /* noop */
    }
  };
}

function playMelody(ctx: AudioContext, dest: AudioNode, plan: NotePlan): Stopper {
  const t0 = ctx.currentTime;
  const stoppers = plan.map((n) => bell(ctx, dest, t0 + n.at, n.freq, n.decay, 0.4));
  return makeStop(stoppers);
}

// voice(セリフ)は同時に複数流れると聞き取りづらいため、直前のvoiceは新規再生時に止める。
let currentStop: Stopper | null = null;

export function playVoice(id: VoiceId): void {
  if (!isReady()) return;
  const ctx = getCtx();
  const master = getMasterGain();
  if (!ctx || !master) return;
  if (currentStop) {
    currentStop();
    currentStop = null;
  }
  const clip = voiceClips.get(id);
  if (clip && clip.buffer) {
    currentStop = playClip(ctx, master, clip.buffer);
  } else {
    const plan = VOICE_MELODIES[id];
    currentStop = playMelody(ctx, master, plan);
  }
}
