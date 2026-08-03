// ============================================================================
// AudioContext ライフサイクル管理
// iOS Safari 対応: 最初のユーザージェスチャー(pointerdown/touchend)で resume。
// ページが非表示→復帰した際に iOS が自動 suspend するため visibilitychange でも再試行。
// resume が完了するまで(state !== 'running')は再生要求を破棄する(isReady() で判定)。
// ============================================================================

const BASE_VOLUME = 0.7;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let muted = false;
let gestureBound = false;

function build(): void {
  if (ctx) return;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, ctx.currentTime);
  compressor.knee.setValueAtTime(12, ctx.currentTime);
  compressor.ratio.setValueAtTime(6, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.15, ctx.currentTime);
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : BASE_VOLUME;
  masterGain.connect(compressor);
  compressor.connect(ctx.destination);
}

function tryResume(): void {
  if (!ctx) return;
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {
      /* 無視: 次のジェスチャー/可視化タイミングで再試行される */
    });
  }
}

/** initAudio() から一度だけ呼ぶ。document に一度きりの解錠リスナーを張る。 */
export function setupContext(): void {
  build();
  tryResume();
  if (gestureBound) return;
  gestureBound = true;
  const handler = (): void => {
    build();
    tryResume();
    document.removeEventListener('pointerdown', handler);
    document.removeEventListener('touchend', handler);
  };
  document.addEventListener('pointerdown', handler, { passive: true });
  document.addEventListener('touchend', handler, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryResume();
  });
}

export function getCtx(): AudioContext | null {
  return ctx;
}

export function getMasterGain(): GainNode | null {
  return masterGain;
}

/** resume が完了し、実際に音を鳴らしてよい状態か */
export function isReady(): boolean {
  return !!ctx && ctx.state === 'running';
}

export function setMuted(v: boolean): void {
  muted = v;
  if (masterGain && ctx) masterGain.gain.setValueAtTime(v ? 0 : BASE_VOLUME, ctx.currentTime);
}

export function isMuted(): boolean {
  return muted;
}
