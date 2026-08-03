// ============================================================================
// SfxId ごとの音色合成。オシレーター+ノイズ+フィルタのみで構成(音声ファイル不使用)。
// ============================================================================
import type { SfxId } from '../core/types';
import { getCtx, getMasterGain, isReady } from './context';
import {
  type VoiceHandle,
  noiseSource,
  expEnv,
  linEnv,
  rampFreq,
  registerVoice,
  stopAllVoices,
} from './dsp';

type Stopper = () => void;

function makeHandle(stoppers: Stopper[]): VoiceHandle {
  let stopped = false;
  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      for (const s of stoppers) s();
    },
  };
}

function safeStop(node: OscillatorNode | AudioBufferSourceNode, t: number): void {
  try {
    node.stop(t);
  } catch {
    /* すでに停止予定済み等は無視 */
  }
}

// ── 汎用ビルダー ─────────────────────────────────────────────────────
function burstNoise(
  ctx: AudioContext,
  dest: AudioNode,
  t0: number,
  opts: {
    seconds: number;
    kind?: 'white' | 'brown';
    filterType?: BiquadFilterType;
    freq: number;
    q?: number;
    attack: number;
    decay: number;
    peak: number;
  },
): Stopper {
  const src = noiseSource(opts.seconds, opts.kind ?? 'white', false);
  if (!src) return () => {};
  const filt = ctx.createBiquadFilter();
  filt.type = opts.filterType ?? 'bandpass';
  filt.frequency.setValueAtTime(opts.freq, t0);
  filt.Q.setValueAtTime(opts.q ?? 1, t0);
  const g = ctx.createGain();
  expEnv(g, t0, opts.attack, opts.peak, opts.decay);
  src.connect(filt);
  filt.connect(g);
  g.connect(dest);
  src.start(t0);
  safeStop(src, t0 + opts.attack + opts.decay + 0.06);
  return () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(src, now + 0.03);
  };
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  t0: number,
  opts: { type: OscillatorType; freq: number; attack: number; decay: number; peak: number },
): Stopper {
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freq, t0);
  const g = ctx.createGain();
  expEnv(g, t0, opts.attack, opts.peak, opts.decay);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + opts.attack + opts.decay + 0.06);
  return () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc, now + 0.03);
  };
}

/** 鉄琴風ベル音(sine + 倍音triangle、指数減衰)。chime/stars/voice で共用。 */
export function bell(ctx: AudioContext, dest: AudioNode, t0: number, freq: number, decay: number, peak: number): Stopper {
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, t0);
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 2.01, t0);
  const g1 = ctx.createGain();
  const g2 = ctx.createGain();
  expEnv(g1, t0, 0.006, peak, decay);
  expEnv(g2, t0, 0.006, peak * 0.25, decay * 0.6);
  osc1.connect(g1);
  g1.connect(dest);
  osc2.connect(g2);
  g2.connect(dest);
  osc1.start(t0);
  osc2.start(t0);
  safeStop(osc1, t0 + decay + 0.15);
  safeStop(osc2, t0 + decay * 0.6 + 0.15);
  return () => {
    const now = ctx.currentTime;
    g1.gain.cancelScheduledValues(now);
    g1.gain.setTargetAtTime(0.0001, now, 0.01);
    g2.gain.cancelScheduledValues(now);
    g2.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc1, now + 0.03);
    safeStop(osc2, now + 0.03);
  };
}

// ── ループ系(roll / roll-under / belt-hum) ────────────────────────────
function rollLoop(
  ctx: AudioContext,
  dest: AudioNode,
  vol: number,
  pitch: number,
  cutoff: number,
  wobbleRate: number,
  wobbleDepth: number,
  baseGain: number,
): VoiceHandle {
  const src = noiseSource(1.0, 'white', true);
  if (!src) return makeHandle([]);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff * pitch;
  const g = ctx.createGain();
  g.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = wobbleRate;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = wobbleDepth * baseGain * vol;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  src.connect(lp);
  lp.connect(g);
  g.connect(dest);
  const t0 = ctx.currentTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(baseGain * vol, t0 + 0.15);
  src.start(t0);
  lfo.start(t0);
  return {
    stop(fadeSec = 0.15): void {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fadeSec);
      safeStop(src, t + fadeSec + 0.03);
      safeStop(lfo, t + fadeSec + 0.03);
    },
  };
}

function beltHumLoop(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 58 * pitch;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 650;
  const g = ctx.createGain();
  g.gain.value = 0;
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 0.28;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.value = 2.4 * pitch;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(osc.frequency);
  const tremolo = ctx.createOscillator();
  tremolo.frequency.value = 0.42;
  const tremoloGain = ctx.createGain();
  tremoloGain.gain.value = 0.07 * vol;
  tremolo.connect(tremoloGain);
  tremoloGain.connect(g.gain);
  osc.connect(lp);
  lp.connect(g);
  g.connect(dest);
  const t0 = ctx.currentTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.32 * vol, t0 + 0.25);
  osc.start(t0);
  vibrato.start(t0);
  tremolo.start(t0);
  return {
    stop(fadeSec = 0.2): void {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fadeSec);
      safeStop(osc, t + fadeSec + 0.03);
      safeStop(vibrato, t + fadeSec + 0.03);
      safeStop(tremolo, t + fadeSec + 0.03);
    },
  };
}

// ── 個別音色 ─────────────────────────────────────────────────────────
function sfxRoll(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  return rollLoop(ctx, dest, vol, pitch, 1300, 5.5, 0.5, 0.5);
}
function sfxRollUnder(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  return rollLoop(ctx, dest, vol, pitch, 500, 4.5, 0.4, 0.42);
}
function sfxBeltHum(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  return beltHumLoop(ctx, dest, vol, pitch);
}

function sfxPinsCrash(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const stoppers: Stopper[] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const dt = Math.random() * 0.12;
    const freq = (700 + Math.random() * 900) * pitch;
    stoppers.push(
      burstNoise(ctx, dest, t0 + dt, {
        seconds: 0.12,
        kind: 'white',
        filterType: 'bandpass',
        freq,
        q: 1.2,
        attack: 0.002,
        decay: 0.09 + Math.random() * 0.05,
        peak: (0.5 + Math.random() * 0.3) * vol,
      }),
    );
  }
  stoppers.push(
    burstNoise(ctx, dest, t0, {
      seconds: 0.08,
      kind: 'white',
      filterType: 'highpass',
      freq: 2500 * pitch,
      q: 0.7,
      attack: 0.001,
      decay: 0.06,
      peak: 0.6 * vol,
    }),
  );
  return makeHandle(stoppers);
}

function sfxGaragara(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const stoppers: Stopper[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const dt = Math.max(0, (i / n) * 0.6 + (Math.random() - 0.5) * 0.04);
    const freq = (500 + Math.random() * 700) * pitch;
    stoppers.push(
      burstNoise(ctx, dest, t0 + dt, {
        seconds: 0.08,
        kind: 'white',
        filterType: 'bandpass',
        freq,
        q: 2,
        attack: 0.001,
        decay: 0.04 + Math.random() * 0.03,
        peak: (0.35 + Math.random() * 0.25) * vol,
      }),
    );
  }
  return makeHandle(stoppers);
}

function sfxKoto(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const s1 = burstNoise(ctx, dest, t0, {
    seconds: 0.1,
    filterType: 'bandpass',
    freq: 1400 * pitch,
    q: 3,
    attack: 0.001,
    decay: 0.07,
    peak: 0.55 * vol,
  });
  const s2 = tone(ctx, dest, t0, { type: 'triangle', freq: 900 * pitch, attack: 0.001, decay: 0.05, peak: 0.2 * vol });
  return makeHandle([s1, s2]);
}

function sfxKurun(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const g = ctx.createGain();
  rampFreq(osc.frequency, 400 * pitch, 800 * pitch, t0, 0.3);
  linEnv(g, t0, 0.02, 0.55 * vol, 0.2, 0.12);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + 0.5);
  const stopOsc: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc, now + 0.03);
  };
  const click = burstNoise(ctx, dest, t0 + 0.3, {
    seconds: 0.05,
    filterType: 'bandpass',
    freq: 1600 * pitch,
    q: 3,
    attack: 0.001,
    decay: 0.04,
    peak: 0.3 * vol,
  });
  return makeHandle([stopOsc, click]);
}

function sfxKoron(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const g = ctx.createGain();
  rampFreq(osc.frequency, 300 * pitch, 500 * pitch, t0, 0.18);
  linEnv(g, t0, 0.015, 0.5 * vol, 0.1, 0.08);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + 0.35);
  const stopOsc: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc, now + 0.03);
  };
  const click = burstNoise(ctx, dest, t0 + 0.17, {
    seconds: 0.04,
    filterType: 'bandpass',
    freq: 1300 * pitch,
    q: 3,
    attack: 0.001,
    decay: 0.03,
    peak: 0.25 * vol,
  });
  return makeHandle([stopOsc, click]);
}

function sfxKachi(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const s1 = tone(ctx, dest, t0, { type: 'square', freq: 2600 * pitch, attack: 0.0008, decay: 0.035, peak: 0.35 * vol });
  const s2 = tone(ctx, dest, t0, { type: 'sine', freq: 4200 * pitch, attack: 0.0008, decay: 0.02, peak: 0.18 * vol });
  const s3 = burstNoise(ctx, dest, t0, {
    seconds: 0.03,
    filterType: 'highpass',
    freq: 3000 * pitch,
    q: 0.5,
    attack: 0.0005,
    decay: 0.02,
    peak: 0.3 * vol,
  });
  return makeHandle([s1, s2, s3]);
}

function sfxGakon(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const thump = burstNoise(ctx, dest, t0, {
    seconds: 0.15,
    kind: 'brown',
    filterType: 'lowpass',
    freq: 400 * pitch,
    q: 0.7,
    attack: 0.002,
    decay: 0.12,
    peak: 0.7 * vol,
  });
  const low = tone(ctx, dest, t0, { type: 'triangle', freq: 95 * pitch, attack: 0.004, decay: 0.4, peak: 0.6 * vol });
  const ring1 = tone(ctx, dest, t0 + 0.02, { type: 'sine', freq: 720 * pitch, attack: 0.003, decay: 0.35, peak: 0.22 * vol });
  const ring2 = tone(ctx, dest, t0 + 0.02, { type: 'sine', freq: 1300 * pitch, attack: 0.003, decay: 0.28, peak: 0.15 * vol });
  const ring3 = tone(ctx, dest, t0 + 0.03, { type: 'sine', freq: 1900 * pitch, attack: 0.003, decay: 0.22, peak: 0.1 * vol });
  return makeHandle([thump, low, ring1, ring2, ring3]);
}

function sfxPaka(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const air = burstNoise(ctx, dest, t0, {
    seconds: 0.2,
    filterType: 'bandpass',
    freq: 1800 * pitch,
    q: 0.6,
    attack: 0.005,
    decay: 0.15,
    peak: 0.5 * vol,
  });
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.Q.value = 4;
  filt.frequency.setValueAtTime(900 * pitch, t0);
  const g = ctx.createGain();
  rampFreq(osc.frequency, 300 * pitch, 220 * pitch, t0 + 0.02, 0.15);
  linEnv(g, t0 + 0.02, 0.02, 0.15 * vol, 0.05, 0.1);
  osc.connect(filt);
  filt.connect(g);
  g.connect(dest);
  osc.start(t0 + 0.02);
  safeStop(osc, t0 + 0.3);
  const stopCreak: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc, now + 0.03);
  };
  return makeHandle([air, stopCreak]);
}

function sfxPachin(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const snap = burstNoise(ctx, dest, t0, {
    seconds: 0.06,
    filterType: 'bandpass',
    freq: 2200 * pitch,
    q: 2,
    attack: 0.0005,
    decay: 0.05,
    peak: 0.6 * vol,
  });
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const g = ctx.createGain();
  rampFreq(osc.frequency, 900 * pitch, 200 * pitch, t0, 0.035);
  expEnv(g, t0, 0.003, 0.35 * vol, 0.03);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + 0.08);
  const stopBlip: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.008);
    safeStop(osc, now + 0.02);
  };
  return makeHandle([snap, stopBlip]);
}

function sfxTableDown(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70 * pitch, t0);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 350 * pitch;
  const g = ctx.createGain();
  linEnv(g, t0, 0.08, 0.4 * vol, 0.55, 0.15);
  osc.connect(filt);
  filt.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + 0.9);
  const stopMotor: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.02);
    safeStop(osc, now + 0.05);
  };
  const stoppers: Stopper[] = [stopMotor];
  const ticks = 9;
  for (let i = 0; i < ticks; i++) {
    const dt = 0.1 + i * (0.6 / ticks);
    stoppers.push(
      burstNoise(ctx, dest, t0 + dt, {
        seconds: 0.03,
        filterType: 'bandpass',
        freq: 1100 * pitch,
        q: 3,
        attack: 0.001,
        decay: 0.02,
        peak: 0.22 * vol,
      }),
    );
  }
  return makeHandle(stoppers);
}

function sfxSton(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const g = ctx.createGain();
  rampFreq(osc.frequency, 160 * pitch, 38 * pitch, t0, 0.16);
  expEnv(g, t0, 0.006, 0.75 * vol, 0.22);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + 0.45);
  const stopThump: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc, now + 0.03);
  };
  const thud = burstNoise(ctx, dest, t0, {
    seconds: 0.15,
    kind: 'brown',
    filterType: 'lowpass',
    freq: 250 * pitch,
    q: 0.6,
    attack: 0.003,
    decay: 0.15,
    peak: 0.5 * vol,
  });
  const tail = burstNoise(ctx, dest, t0 + 0.1, {
    seconds: 0.25,
    kind: 'brown',
    filterType: 'lowpass',
    freq: 180 * pitch,
    q: 0.5,
    attack: 0.02,
    decay: 0.2,
    peak: 0.18 * vol,
  });
  return makeHandle([stopThump, thud, tail]);
}

function sfxPon(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const g = ctx.createGain();
  rampFreq(osc.frequency, 1200 * pitch, 400 * pitch, t0, 0.12);
  expEnv(g, t0, 0.004, 0.55 * vol, 0.1);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + 0.22);
  const stopPop: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc, now + 0.03);
  };
  const click = burstNoise(ctx, dest, t0, {
    seconds: 0.02,
    filterType: 'highpass',
    freq: 3500 * pitch,
    q: 0.5,
    attack: 0.0005,
    decay: 0.015,
    peak: 0.25 * vol,
  });
  return makeHandle([stopPop, click]);
}

function sfxWhirr(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80 * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(260 * pitch, t0 + 0.7);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(400, t0);
  filt.frequency.exponentialRampToValueAtTime(2200, t0 + 0.7);
  const g = ctx.createGain();
  linEnv(g, t0, 0.1, 0.4 * vol, 0.5, 0.15);
  osc.connect(filt);
  filt.connect(g);
  g.connect(dest);
  osc.start(t0);
  safeStop(osc, t0 + 0.9);
  const stopMotor: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.02);
    safeStop(osc, now + 0.05);
  };
  return makeHandle([stopMotor]);
}

function sfxSputter(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(260 * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(70 * pitch, t0 + 0.45);
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(dest);
  const p = g.gain;
  p.setValueAtTime(0.0001, t0);
  let tcur = t0;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const on = 0.4 * vol * (1 - (i / steps) * 0.5);
    p.linearRampToValueAtTime(on, tcur + 0.02);
    tcur += 0.02 + Math.random() * 0.05;
    p.linearRampToValueAtTime(0.02 * vol, tcur);
    tcur += 0.01 + Math.random() * 0.02;
  }
  p.linearRampToValueAtTime(0.0001, tcur + 0.05);
  osc.start(t0);
  safeStop(osc, tcur + 0.15);
  const stopOsc: Stopper = () => {
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.01);
    safeStop(osc, now + 0.03);
  };
  const pop = burstNoise(ctx, dest, tcur + 0.02, {
    seconds: 0.08,
    filterType: 'lowpass',
    freq: 500 * pitch,
    q: 0.8,
    attack: 0.002,
    decay: 0.06,
    peak: 0.35 * vol,
  });
  return makeHandle([stopOsc, pop]);
}

function sfxGata(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const stoppers: Stopper[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const dt = Math.random() * 0.4;
    if (Math.random() < 0.5) {
      stoppers.push(
        burstNoise(ctx, dest, t0 + dt, {
          seconds: 0.08,
          filterType: 'bandpass',
          freq: (600 + Math.random() * 500) * pitch,
          q: 1.5,
          attack: 0.001,
          decay: 0.05,
          peak: (0.35 + Math.random() * 0.2) * vol,
        }),
      );
    } else {
      stoppers.push(
        tone(ctx, dest, t0 + dt, {
          type: 'triangle',
          freq: (1600 + Math.random() * 700) * pitch,
          attack: 0.001,
          decay: 0.06,
          peak: (0.2 + Math.random() * 0.15) * vol,
        }),
      );
    }
  }
  return makeHandle(stoppers);
}

function sfxChime(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
  const stoppers: Stopper[] = notes.map((f, i) => bell(ctx, dest, t0 + i * 0.14, f * pitch, 0.5, 0.35 * vol));
  return makeHandle(stoppers);
}

function sfxStars(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const t0 = ctx.currentTime;
  const scale = [784, 880, 987.77, 1174.66, 1318.51, 1567.98];
  const stoppers: Stopper[] = scale.map((f, i) => bell(ctx, dest, t0 + i * 0.06, f * pitch, 0.22, 0.22 * vol));
  stoppers.push(
    burstNoise(ctx, dest, t0, {
      seconds: 0.5,
      filterType: 'highpass',
      freq: 4000 * pitch,
      q: 0.4,
      attack: 0.05,
      decay: 0.4,
      peak: 0.15 * vol,
    }),
  );
  return makeHandle(stoppers);
}

function sfxTap(ctx: AudioContext, dest: AudioNode, vol: number, pitch: number): VoiceHandle {
  const s = tone(ctx, dest, ctx.currentTime, { type: 'sine', freq: 1500 * pitch, attack: 0.001, decay: 0.035, peak: 0.3 * vol });
  return makeHandle([s]);
}

// ── ディスパッチテーブル ────────────────────────────────────────────
type SfxPlayer = (ctx: AudioContext, dest: AudioNode, vol: number, pitch: number) => VoiceHandle;

const sfxMap: Record<SfxId, SfxPlayer> = {
  roll: sfxRoll,
  'pins-crash': sfxPinsCrash,
  garagara: sfxGaragara,
  'belt-hum': sfxBeltHum,
  koto: sfxKoto,
  kurun: sfxKurun,
  koron: sfxKoron,
  kachi: sfxKachi,
  gakon: sfxGakon,
  paka: sfxPaka,
  pachin: sfxPachin,
  'table-down': sfxTableDown,
  ston: sfxSton,
  'roll-under': sfxRollUnder,
  pon: sfxPon,
  whirr: sfxWhirr,
  sputter: sfxSputter,
  gata: sfxGata,
  chime: sfxChime,
  stars: sfxStars,
  tap: sfxTap,
};

const sfxDuration: Record<SfxId, number> = {
  roll: Infinity,
  'pins-crash': 0.35,
  garagara: 0.65,
  'belt-hum': Infinity,
  koto: 0.15,
  kurun: 0.45,
  koron: 0.3,
  kachi: 0.06,
  gakon: 0.55,
  paka: 0.3,
  pachin: 0.1,
  'table-down': 0.9,
  ston: 0.5,
  'roll-under': Infinity,
  pon: 0.25,
  whirr: 0.9,
  sputter: 0.7,
  gata: 0.5,
  chime: 0.7,
  stars: 0.7,
  tap: 0.05,
};

export function playSfx(id: SfxId, vol = 1, pitch = 1): void {
  if (!isReady()) return; // resume前は破棄
  const ctx = getCtx();
  const master = getMasterGain();
  if (!ctx || !master) return;
  const player = sfxMap[id];
  if (!player) return;
  const handle = player(ctx, master, vol, pitch);
  registerVoice(id, () => handle.stop(), sfxDuration[id]);
}

export function stopSfx(id: SfxId): void {
  stopAllVoices(id);
}
