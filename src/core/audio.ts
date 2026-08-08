/**
 * Procedural audio. Everything is synthesised at runtime (no asset download,
 * no long first load). Sounds are short onomatopoeic cues, never narration:
 *   gate  → ゴゴゴ / ジャアア     reel → ブンブン / バシャバシャ
 *   float → ポコ・プク・ポン      boom → チャプ / スーッ
 *   pump  → ゴォー / シュポポポ    bed  → パラパラ・コロコロ
 *
 * Every one-shot randomises pitch, gain and timing so that a hundred berries
 * surfacing at once reads as a shimmer rather than a machine-gun.
 */

import { settings } from './settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
/** Rolling budget so simultaneous plops cannot pile into distortion. */
let voicesThisFrame = 0;
let lastVoiceReset = 0;

export function audioReady(): boolean {
  return !!ctx && ctx.state === 'running';
}

export function initAudio(): void {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = settings.volume;
  master.connect(ctx.destination);

  const len = Math.floor(ctx.sampleRate * 2);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  void ctx.resume();
}

export function setVolume(v: number): void {
  if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend();
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

function budgetOk(max = 6): boolean {
  const now = performance.now();
  if (now - lastVoiceReset > 50) {
    lastVoiceReset = now;
    voicesThisFrame = 0;
  }
  if (voicesThisFrame >= max) return false;
  voicesThisFrame++;
  return true;
}

function noiseSource(): AudioBufferSourceNode | null {
  if (!ctx || !noiseBuf) return null;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  return s;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ *
 * One-shots
 * ------------------------------------------------------------------ */

/** ポコッ — a berry breaking the surface. Pitch-scattered per call. */
export function sfxPop(strength = 1): void {
  if (!ctx || !master || !budgetOk(7)) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const f0 = rnd(280, 660);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0 * 0.55, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * rnd(1.7, 2.6), t + 0.055);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16 * strength, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t + rnd(0.09, 0.16));
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.24);

  // tiny water tick riding on top
  const n = noiseSource();
  if (n) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rnd(1800, 4200);
    bp.Q.value = 3;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * strength, t);
    ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
    n.connect(bp).connect(ng).connect(master);
    n.start(t);
    n.stop(t + 0.08);
  }
}

/** チャプ — boom / finger touching the water. */
export function sfxLap(strength = 1): void {
  if (!ctx || !master || !budgetOk(4)) return;
  const t = ctx.currentTime;
  const n = noiseSource();
  if (!n) return;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(rnd(700, 1400), t);
  bp.frequency.exponentialRampToValueAtTime(rnd(2200, 3600), t + 0.12);
  bp.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09 * strength, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0006, t + rnd(0.16, 0.3));
  n.connect(bp).connect(g).connect(master);
  n.start(t);
  n.stop(t + 0.4);
}

/** コロコロ — berries tumbling into the truck bed. */
export function sfxTumble(): void {
  if (!ctx || !master || !budgetOk(5)) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(rnd(90, 190), t);
  osc.frequency.exponentialRampToValueAtTime(rnd(55, 95), t + 0.09);
  g.gain.setValueAtTime(0.09, t);
  g.gain.exponentialRampToValueAtTime(0.0006, t + rnd(0.07, 0.13));
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** カチッ — hose snapping onto its coupling; also used for UI confirmation. */
export function sfxClick(): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.05);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.12);
}

/** A soft warm chime for scene completion — never a score jingle. */
export function sfxChime(): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    const s = t + i * 0.11;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.1, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, s + 0.7);
    osc.connect(g).connect(master!);
    osc.start(s);
    osc.stop(s + 0.8);
  });
}

/* ------------------------------------------------------------------ *
 * Continuous loops (gate, reel, pump). Each is an amplitude we ramp.
 * ------------------------------------------------------------------ */

class Loop {
  private gain: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private target = 0;

  constructor(private readonly build: (c: AudioContext, out: GainNode) => AudioScheduledSourceNode[]) {}

  private ensure(): void {
    if (this.gain || !ctx || !master) return;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(master);
    this.nodes = this.build(ctx, this.gain);
    this.nodes.forEach((n) => n.start());
  }

  /** level 0..1 — call every frame; ramps smoothly. */
  set(level: number): void {
    if (level <= 0.001 && !this.gain) return;
    this.ensure();
    if (!this.gain || !ctx) return;
    if (Math.abs(level - this.target) < 0.002) return;
    this.target = level;
    this.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.09);
  }

  stop(): void {
    this.set(0);
  }
}

/** ゴゴゴ / ジャアア — sluice gate machinery + inrushing water. */
export const gateLoop = new Loop((c, out) => {
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 160;
  const g = c.createGain();
  g.gain.value = 0.5;
  n.connect(lp).connect(hp).connect(g).connect(out);

  const rumble = c.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 46;
  const rg = c.createGain();
  rg.gain.value = 0.055;
  const rlp = c.createBiquadFilter();
  rlp.type = 'lowpass';
  rlp.frequency.value = 220;
  rumble.connect(rlp).connect(rg).connect(out);
  return [n, rumble];
});

/** ブンブン + バシャバシャ — the water reel churning. */
export const reelLoop = new Loop((c, out) => {
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 78;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = c.createGain();
  g.gain.value = 0.09;
  osc.connect(lp).connect(g).connect(out);

  // chopping amplitude — the paddle wheel hitting water
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 7.5;
  const lfoG = c.createGain();
  lfoG.gain.value = 0.055;
  lfo.connect(lfoG).connect(g.gain);

  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 0.7;
  const ng = c.createGain();
  ng.gain.value = 0.16;
  const nlfo = c.createOscillator();
  nlfo.type = 'sine';
  nlfo.frequency.value = 7.5;
  const nlfoG = c.createGain();
  nlfoG.gain.value = 0.11;
  nlfo.connect(nlfoG).connect(ng.gain);
  n.connect(bp).connect(ng).connect(out);
  return [osc, lfo, n, nlfo];
});

/** ゴォー / シュポポポ — the suction pump. */
export const pumpLoop = new Loop((c, out) => {
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700;
  bp.Q.value = 0.6;
  const g = c.createGain();
  g.gain.value = 0.34;
  n.connect(bp).connect(g).connect(out);

  const motor = c.createOscillator();
  motor.type = 'square';
  motor.frequency.value = 58;
  const mlp = c.createBiquadFilter();
  mlp.type = 'lowpass';
  mlp.frequency.value = 300;
  const mg = c.createGain();
  mg.gain.value = 0.07;
  motor.connect(mlp).connect(mg).connect(out);

  // シュポポポ — irregular gulps of fruit going through
  const glug = c.createOscillator();
  glug.type = 'sine';
  glug.frequency.value = 11;
  const glugG = c.createGain();
  glugG.gain.value = 0.16;
  glug.connect(glugG).connect(g.gain);
  return [n, motor, glug];
});

/** Gentle ambience: wind and distant birds, so silence never feels broken. */
export const ambienceLoop = new Loop((c, out) => {
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = c.createGain();
  g.gain.value = 0.35;
  n.connect(lp).connect(g).connect(out);
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.13;
  const lg = c.createGain();
  lg.gain.value = 0.18;
  lfo.connect(lg).connect(g.gain);
  return [n, lfo];
});

/* ------------------------------------------------------------------ *
 * Spoken cues — very short, and never load-bearing: every one of them is
 * also expressed visually, so muting loses nothing.
 * ------------------------------------------------------------------ */

let lastSpoken = '';
let lastSpokeAt = 0;

export function say(text: string): void {
  if (!settings.voice || settings.volume <= 0.01) return;
  if (typeof speechSynthesis === 'undefined') return;
  const now = performance.now();
  if (text === lastSpoken && now - lastSpokeAt < 6000) return;
  lastSpoken = text;
  lastSpokeAt = now;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.95;
    u.pitch = 1.35;
    u.volume = Math.min(1, settings.volume);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* speech unavailable — visuals already carry the message */
  }
}

export function stopSpeech(): void {
  try {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
