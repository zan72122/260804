// ============================================================================
// audio モジュール公開API。CONTRACTS.md 準拠。
// bus('sfx' / 'sfx:stop' / 'voice') を購読し、WebAudio合成で再生する。
// ============================================================================
import { bus } from '../core/events';
import { setupContext, setMuted as setMutedInternal, isMuted as isMutedInternal } from './context';
import { playSfx, stopSfx } from './sfx';
import { playVoice } from './voice';

export { registerVoiceClip } from './voice';

let wired = false;

/** busを購読し、初回ユーザージェスチャーでAudioContextをresumeする */
export function initAudio(): void {
  setupContext();
  if (wired) return;
  wired = true;

  bus.on('sfx', ({ id, vol, pitch }) => {
    playSfx(id, vol ?? 1, pitch ?? 1);
  });

  bus.on('sfx:stop', ({ id }) => {
    stopSfx(id);
  });

  bus.on('voice', ({ id }) => {
    playVoice(id);
  });
}

export function setMuted(v: boolean): void {
  setMutedInternal(v);
}

export function isMuted(): boolean {
  return isMutedInternal();
}
