// src/audio/engine.ts
// 所有: A4 (audio)。全音声を WebAudio で合成する(音声ファイル不使用)。
//
// 設計メモ(詳細な合成レシピ・パラメータ根拠は最終レポートに記載):
// - マスターチェーン: 各音源 -> masterGain -> compressor -> destination
// - ノイズは起動時に1回だけ AudioBuffer 生成し使い回す(都度生成しない)
// - パンは StereoPannerNode を優先し、非対応環境(古い iOS Safari)では
//   PannerNode(equalpower) にフォールバックする薄いラッパーを使う
// - ループ音は全てクロスフェード(gainのlinearRamp)で開始/停止する。
//   同名の loopStart は張り替えず、pan/intensity を滑らかに更新するだけ。
// - 回転系(kotokoto/kachikachi/zuruzuru/gurun/run*)は state.escalator.loopT の
//   フレーム間差分から実測回転速度を求め、それでピッチ/レートを変調する。
//   (escalator.crank() は speed フィールドを更新しないため、speed ではなく
//    loopT の差分から自前で "今どれだけ回っているか" を計算する)

import type { GameState, SfxName, LoopName } from '../core/types';
import { bus } from '../core/events';
import { layout } from '../core/layout';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

// ---------------------------------------------------------------------------
// モジュール状態
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let initialized = false;

let lastState: GameState | null = null;
let appliedVolume = -1;

// 回転速度の実測(loopT/sec)。crank/自動走行どちらも捉える。
let lastLoopT: number | null = null;
let smoothedRotSpeed = 0; // >=0

// ---------------------------------------------------------------------------
// パン・ラッパー (StereoPannerNode が使えない古い iOS Safari 用フォールバック)
// ---------------------------------------------------------------------------

interface PanNode {
  input: AudioNode;
  setPan(v: number): void;
}

function makePanNode(): PanNode {
  const c = ctx!;
  if (typeof c.createStereoPanner === 'function') {
    const sp = c.createStereoPanner();
    return {
      input: sp,
      setPan(v: number) {
        const t = c.currentTime;
        sp.pan.setTargetAtTime(clamp(v, -1, 1), t, 0.05);
      }
    };
  }
  // フォールバック: 古いブラウザ向け PannerNode(equalpower)
  const p = c.createPanner();
  p.panningModel = 'equalpower';
  const apply = (v: number) => {
    const x = clamp(v, -1, 1);
    p.setPosition(x, 0, 1 - Math.abs(x));
  };
  apply(0);
  return { input: p, setPan: apply };
}

// ---------------------------------------------------------------------------
// ノイズバッファ生成(白色ノイズ、2秒、ループ再生時の継ぎ目は聴感上ほぼ気にならない)
// ---------------------------------------------------------------------------

function buildNoiseBuffer(c: AudioContext): AudioBuffer {
  const seconds = 2;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function newNoiseSource(loop = false): AudioBufferSourceNode {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = loop;
  return src;
}

// ---------------------------------------------------------------------------
// 汎用シンセ・ヘルパー
// ---------------------------------------------------------------------------

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  freqEnd?: number; // 指定時は指数的にピッチベンド
  start?: number; // 現在時刻からのオフセット(秒)
  dur: number;
  attack?: number;
  release?: number;
  peak?: number;
  pan?: number;
  detune?: number;
  dest?: AudioNode;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterFreqEnd?: number;
  filterQ?: number;
}

function tone(opts: ToneOpts): void {
  if (!ctx || !masterGain) return;
  const c = ctx;
  const t0 = c.currentTime + (opts.start ?? 0);
  const attack = opts.attack ?? 0.008;
  const release = opts.release ?? Math.max(0.03, opts.dur * 0.6);
  const peak = opts.peak ?? 0.3;
  const dest = opts.dest ?? masterGain;

  const osc = c.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(Math.max(1, opts.freq), t0);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t0 + opts.dur);
  }
  if (opts.detune !== undefined) osc.detune.setValueAtTime(opts.detune, t0);

  let node: AudioNode = osc;
  if (opts.filterType) {
    const f = c.createBiquadFilter();
    f.type = opts.filterType;
    f.Q.value = opts.filterQ ?? 1;
    f.frequency.setValueAtTime(opts.filterFreq ?? 1000, t0);
    if (opts.filterFreqEnd !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(1, opts.filterFreqEnd), t0 + opts.dur);
    }
    node.connect(f);
    node = f;
  }

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  g.gain.setValueAtTime(0, t0 + attack + release + 0.01);

  node.connect(g);
  const pan = makePanNode();
  if (opts.pan !== undefined) pan.setPan(opts.pan);
  g.connect(pan.input);
  pan.input.connect(dest);

  osc.start(t0);
  osc.stop(t0 + attack + release + 0.02);
}

interface NoiseOpts {
  start?: number;
  dur: number;
  filterType?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  peak?: number;
  attack?: number;
  release?: number;
  pan?: number;
  dest?: AudioNode;
}

function noiseBurst(opts: NoiseOpts): void {
  if (!ctx || !masterGain || !noiseBuffer) return;
  const c = ctx;
  const t0 = c.currentTime + (opts.start ?? 0);
  const attack = opts.attack ?? 0.004;
  const release = opts.release ?? Math.max(0.02, opts.dur * 0.8);
  const peak = opts.peak ?? 0.3;
  const dest = opts.dest ?? masterGain;

  const src = newNoiseSource(false);
  let node: AudioNode = src;
  if (opts.filterType) {
    const f = c.createBiquadFilter();
    f.type = opts.filterType;
    f.Q.value = opts.q ?? 1;
    f.frequency.setValueAtTime(opts.freq ?? 1000, t0);
    if (opts.freqEnd !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t0 + opts.dur);
    }
    node.connect(f);
    node = f;
  }

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  g.gain.setValueAtTime(0, t0 + attack + release + 0.01);

  node.connect(g);
  const pan = makePanNode();
  if (opts.pan !== undefined) pan.setPan(opts.pan);
  g.connect(pan.input);
  pan.input.connect(dest);

  src.start(t0);
  src.stop(t0 + attack + release + 0.02);
}

// ---------------------------------------------------------------------------
// 単発SFX(全15種)
// ---------------------------------------------------------------------------

function sfxPita(pan?: number): void {
  // 「プシュ..ピタッ」: 空気が抜けるノイズ減衰 → 短い高音の静止音 + 低い着地感
  noiseBurst({ start: 0, dur: 0.16, filterType: 'bandpass', freq: 1400, freqEnd: 350, q: 0.8, peak: 0.28, attack: 0.005, release: 0.15, pan });
  tone({ type: 'sine', freq: 1300, dur: 0.09, attack: 0.002, release: 0.08, peak: 0.32, start: 0.14, pan });
  tone({ type: 'sine', freq: 95, dur: 0.14, attack: 0.004, release: 0.13, peak: 0.22, start: 0.15, pan });
}

function sfxPaka(pan?: number): void {
  // 木箱を開ける「パカッ」: パルス2連 + きしみ、その後に神秘的な薄いキラキラパッド
  noiseBurst({ start: 0, dur: 0.03, filterType: 'bandpass', freq: 700, q: 6, peak: 0.3, attack: 0.002, release: 0.025, pan });
  tone({ type: 'triangle', freq: 620, dur: 0.03, attack: 0.002, release: 0.025, peak: 0.22, pan });
  noiseBurst({ start: 0.05, dur: 0.03, filterType: 'bandpass', freq: 900, q: 6, peak: 0.26, attack: 0.002, release: 0.025, pan });
  tone({ type: 'triangle', freq: 780, dur: 0.03, attack: 0.002, release: 0.025, peak: 0.18, start: 0.05, pan });
  // きしみ
  tone({ type: 'sawtooth', freq: 420, freqEnd: 240, dur: 0.09, attack: 0.01, release: 0.08, peak: 0.08, start: 0.02, pan, filterType: 'lowpass', filterFreq: 900 });
  // 神秘のキラキラパッド(2秒フェード、薄い)
  const chord = [523.25, 659.25, 784.0];
  for (const f of chord) {
    tone({ type: 'sine', freq: f, dur: 1.9, attack: 0.3, release: 1.6, peak: 0.05, start: 0.08, pan, detune: randRange(-4, 4) });
  }
}

function sfxSpon(pan?: number): void {
  // コルク抜き「スポンッ!」— 最重要。複数レイヤーで気持ちよさ優先。
  // A: 急峻な上昇ピッチベンド
  tone({ type: 'sine', freq: 170, freqEnd: 950, dur: 0.09, attack: 0.003, release: 0.08, peak: 0.4, pan });
  // B: ポップの瞬間ノイズ(帯域スイープ)
  noiseBurst({ start: 0.005, dur: 0.045, filterType: 'bandpass', freq: 250, freqEnd: 3200, q: 1.1, peak: 0.5, attack: 0.002, release: 0.04, pan });
  // C: 抜けた後の胴鳴り(低域の余韻)
  noiseBurst({ start: 0.05, dur: 0.16, filterType: 'bandpass', freq: 150, q: 3, peak: 0.22, attack: 0.004, release: 0.15, pan });
  // D: きらめく余韻(下降アルペジオ)
  const tail = [1800, 1500, 1200];
  tail.forEach((f, i) => {
    tone({ type: 'triangle', freq: f, dur: 0.09, attack: 0.003, release: 0.07, peak: 0.14, start: 0.09 + i * 0.045, pan });
  });
}

function sfxGurun(pan?: number): void {
  // 回転の「ぐるん」: 低めのウォブル + ラチェット音。実測回転速度で変調。
  const speed = smoothedRotSpeed; // loopT/sec, 目安 0(静止)〜0.3+(速回し)
  const wobbleBase = clamp(65 + speed * 300, 55, 260);
  const clickCount = clamp(Math.round(2 + speed * 20), 2, 8);
  const spacing = clamp(0.13 - speed * 0.28, 0.028, 0.13);
  const dur = 0.22 + spacing * clickCount;

  if (!ctx || !masterGain) return;
  const c = ctx;
  const t0 = c.currentTime;
  // ウォブル: 低音サインをゆっくりLFOで周波数揺らし
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(wobbleBase, t0);
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(7 + speed * 10, t0);
  const lfoGain = c.createGain();
  lfoGain.gain.value = wobbleBase * 0.35;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.gain.setValueAtTime(0, t0 + dur + 0.02);
  osc.connect(g);
  const pn = makePanNode();
  if (pan !== undefined) pn.setPan(pan);
  g.connect(pn.input);
  pn.input.connect(masterGain);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + dur + 0.03);
  lfo.stop(t0 + dur + 0.03);

  // ラチェット・クリック列
  for (let i = 0; i < clickCount; i++) {
    noiseBurst({ start: i * spacing, dur: 0.02, filterType: 'highpass', freq: 2200, q: 0.7, peak: 0.16, attack: 0.001, release: 0.018, pan });
  }
}

function sfxSuu(pan?: number): void {
  // 修理後の滑らか試運転「スーッ」: フィルタ掛けたノイズのスウェル
  noiseBurst({ start: 0, dur: 0.95, filterType: 'lowpass', freq: 400, freqEnd: 2200, q: 0.6, peak: 0.22, attack: 0.16, release: 0.55, pan });
  noiseBurst({ start: 0.05, dur: 0.7, filterType: 'bandpass', freq: 900, freqEnd: 1600, q: 1.2, peak: 0.08, attack: 0.2, release: 0.4, pan });
}

function sfxKachi(pan?: number): void {
  tone({ type: 'square', freq: 1800, dur: 0.018, attack: 0.001, release: 0.016, peak: 0.22, pan });
  tone({ type: 'square', freq: 2400, dur: 0.014, attack: 0.001, release: 0.012, peak: 0.14, start: 0.02, pan });
}

function sfxSnap(pan?: number): void {
  noiseBurst({ start: 0, dur: 0.02, filterType: 'bandpass', freq: 1200, q: 6, peak: 0.32, attack: 0.001, release: 0.018, pan });
  tone({ type: 'sine', freq: 220, dur: 0.05, attack: 0.002, release: 0.045, peak: 0.24, pan });
}

function sfxClick(pan?: number): void {
  tone({ type: 'sine', freq: 1000, dur: 0.02, attack: 0.001, release: 0.018, peak: 0.14, pan });
}

function sfxPop(pan?: number): void {
  tone({ type: 'sine', freq: 260, freqEnd: 520, dur: 0.05, attack: 0.002, release: 0.045, peak: 0.24, pan });
  noiseBurst({ start: 0.003, dur: 0.035, filterType: 'bandpass', freq: 300, freqEnd: 1500, q: 1, peak: 0.24, attack: 0.001, release: 0.03, pan });
}

function sfxWipe(pan?: number): void {
  noiseBurst({ start: 0, dur: 0.2, filterType: 'bandpass', freq: 1000, freqEnd: 2800, q: 1.4, peak: 0.18, attack: 0.02, release: 0.15, pan });
  noiseBurst({ start: 0.1, dur: 0.12, filterType: 'bandpass', freq: 2800, freqEnd: 1500, q: 1.4, peak: 0.12, attack: 0.01, release: 0.1, pan });
}

function sfxMagnet(pan?: number): void {
  tone({ type: 'sine', freq: 400, freqEnd: 1200, dur: 0.08, attack: 0.005, release: 0.07, peak: 0.2, pan });
  tone({ type: 'triangle', freq: 1600, dur: 0.03, attack: 0.002, release: 0.025, peak: 0.14, start: 0.08, pan });
}

function sfxSparkle(pan?: number): void {
  const notes = [1046.5, 1318.5, 1568.0, 1760.0, 2093.0];
  notes.forEach((f, i) => {
    tone({ type: 'triangle', freq: f, dur: 0.09, attack: 0.004, release: 0.075, peak: 0.16, start: i * 0.055, pan, detune: randRange(-6, 6) });
  });
}

function sfxUiTap(pan?: number): void {
  tone({ type: 'sine', freq: 700, dur: 0.03, attack: 0.002, release: 0.025, peak: 0.12, pan });
}

function sfxTada(pan?: number): void {
  const notesA = [523.25, 659.25, 784.0]; // C5
  const notesB = [783.99, 987.77, 1174.66]; // G5
  notesA.forEach((f) => tone({ type: 'triangle', freq: f, dur: 0.16, attack: 0.005, release: 0.14, peak: 0.16, pan }));
  notesB.forEach((f) => tone({ type: 'triangle', freq: f, dur: 0.28, attack: 0.005, release: 0.25, peak: 0.18, start: 0.14, pan }));
  tone({ type: 'sine', freq: 2349.3, dur: 0.3, attack: 0.01, release: 0.28, peak: 0.06, start: 0.15, pan });
}

function sfxFanfare(pan?: number): void {
  // 明るい和音進行(3秒以内): C -> F -> G -> C(伸ばして終止)
  const chords: number[][] = [
    [523.25, 659.25, 784.0], // C
    [698.46, 880.0, 1046.5], // F
    [784.0, 987.77, 1174.66] // G
  ];
  const starts = [0, 0.42, 0.82];
  chords.forEach((chord, ci) => {
    chord.forEach((f) => {
      tone({ type: 'triangle', freq: f, dur: 0.4, attack: 0.006, release: 0.34, peak: 0.15, start: starts[ci], pan });
    });
  });
  // 終止和音(長め、余韻あり)
  const finalChord = [523.25, 659.25, 784.0, 1046.5];
  finalChord.forEach((f) => {
    tone({ type: 'triangle', freq: f, dur: 1.5, attack: 0.01, release: 1.35, peak: 0.16, start: 1.3, pan });
    tone({ type: 'sine', freq: f * 2, dur: 1.3, attack: 0.02, release: 1.2, peak: 0.03, start: 1.35, pan });
  });
  // 仕上げのキラキラ
  const sparkleNotes = [1568.0, 2093.0, 2637.0];
  sparkleNotes.forEach((f, i) => {
    tone({ type: 'triangle', freq: f, dur: 0.35, attack: 0.005, release: 0.3, peak: 0.12, start: 1.7 + i * 0.12, pan });
  });
}

const sfxPlayers: Record<SfxName, (pan?: number) => void> = {
  pita: sfxPita,
  paka: sfxPaka,
  spon: sfxSpon,
  gurun: sfxGurun,
  suu: sfxSuu,
  kachi: sfxKachi,
  snap: sfxSnap,
  click: sfxClick,
  pop: sfxPop,
  wipe: sfxWipe,
  sparkle: sfxSparkle,
  fanfare: sfxFanfare,
  tada: sfxTada,
  uiTap: sfxUiTap,
  magnet: sfxMagnet
};

// ---------------------------------------------------------------------------
// ループ音
// ---------------------------------------------------------------------------

type LoopKind = 'drone' | 'generative';

interface LoopHandle {
  name: LoopName;
  kind: LoopKind;
  gain: GainNode; // 全体音量(クロスフェード用)
  pan: PanNode;
  baseVolume: number;
  intensity: number;
  stopping: boolean;
  stopTimer: ReturnType<typeof setTimeout> | null;
  // drone用の永続ノード
  nodes?: {
    stopAll(): void;
    update?(dt: number, rotSpeed: number, state: GameState): void;
  };
  // generative用のスケジューラ状態
  nextHitTime?: number; // ctx.currentTime基準
  beepNextTime?: number; // jiji専用
}

const activeLoops = new Map<LoopName, LoopHandle>();

const LOOP_BASE_VOLUME: Record<LoopName, number> = {
  kotokoto: 0.22,
  kachikachi: 0.2,
  zuruzuru: 0.16,
  jiji: 0.13,
  runNormal: 0.17,
  runSlow: 0.11,
  runBroken: 0.22
};

function createLoopHandle(name: LoopName, pan: number, intensity: number): LoopHandle {
  const c = ctx!;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  const panNode = makePanNode();
  panNode.setPan(pan);
  gain.connect(panNode.input);
  panNode.input.connect(masterGain!);

  const kind: LoopKind = name === 'kotokoto' || name === 'kachikachi' ? 'generative' : 'drone';

  const handle: LoopHandle = {
    name,
    kind,
    gain,
    pan: panNode,
    baseVolume: LOOP_BASE_VOLUME[name],
    intensity,
    stopping: false,
    stopTimer: null
  };

  const target = handle.baseVolume * clamp(intensity, 0, 2);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0015, target), c.currentTime + 0.3);

  if (kind === 'drone') {
    handle.nodes = buildDroneNodes(name, gain);
  } else {
    handle.nextHitTime = c.currentTime + 0.05;
  }

  return handle;
}

function buildDroneNodes(name: LoopName, dest: GainNode): { stopAll(): void; update(dt: number, rotSpeed: number, state: GameState): void } {
  const c = ctx!;
  const t0 = c.currentTime;

  if (name === 'runNormal') {
    // 滑らかで心地よいモーターハム: 倍音がきれいな複数サイン
    const osc1 = c.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 110;
    const osc1b = c.createOscillator();
    osc1b.type = 'sine';
    osc1b.frequency.value = 110;
    osc1b.detune.value = 5;
    const osc2 = c.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 220;
    const osc3 = c.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = 330;

    const g1 = c.createGain();
    g1.gain.value = 0.5;
    const g1b = c.createGain();
    g1b.gain.value = 0.35;
    const g2 = c.createGain();
    g2.gain.value = 0.16;
    const g3 = c.createGain();
    g3.gain.value = 0.07;

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.Q.value = 0.5;

    osc1.connect(g1);
    osc1b.connect(g1b);
    osc2.connect(g2);
    osc3.connect(g3);
    g1.connect(lp);
    g1b.connect(lp);
    g2.connect(lp);
    g3.connect(lp);
    lp.connect(dest);

    [osc1, osc1b, osc2, osc3].forEach((o) => o.start(t0));

    return {
      stopAll() {
        [osc1, osc1b, osc2, osc3].forEach((o) => {
          try { o.stop(); } catch { /* noop */ }
        });
      },
      update(_dt, rotSpeed) {
        const f = clamp(90 + rotSpeed * 260, 70, 170);
        osc1.frequency.setTargetAtTime(f, c.currentTime, 0.15);
        osc1b.frequency.setTargetAtTime(f, c.currentTime, 0.15);
        osc2.frequency.setTargetAtTime(f * 2, c.currentTime, 0.15);
        osc3.frequency.setTargetAtTime(f * 3, c.currentTime, 0.15);
      }
    };
  }

  if (name === 'runSlow') {
    // 静かな低速モーター音: 単純なサイン+ごく薄いノイズ
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;
    const g = c.createGain();
    g.gain.value = 0.6;
    osc.connect(g);

    const noiseSrc = newNoiseSource(true);
    const nf = c.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 250;
    const ng = c.createGain();
    ng.gain.value = 0.12;
    noiseSrc.connect(nf);
    nf.connect(ng);

    g.connect(dest);
    ng.connect(dest);
    osc.start(t0);
    noiseSrc.start(t0);

    return {
      stopAll() {
        try { osc.stop(); } catch { /* noop */ }
        try { noiseSrc.stop(); } catch { /* noop */ }
      },
      update(_dt, rotSpeed) {
        const f = clamp(48 + rotSpeed * 200, 42, 90);
        osc.frequency.setTargetAtTime(f, c.currentTime, 0.2);
      }
    };
  }

  if (name === 'runBroken') {
    // 低いゴロゴロ(共鳴ノイズ) + 不規則なガタガタ(生成打撃はupdateでスケジュール)
    const noiseSrc = newNoiseSource(true);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 70;
    bp.Q.value = 4;
    const g = c.createGain();
    g.gain.value = 0.7;
    noiseSrc.connect(lp);
    lp.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noiseSrc.start(t0);

    let rattleNext = t0 + 0.2;

    return {
      stopAll() {
        try { noiseSrc.stop(); } catch { /* noop */ }
      },
      update(_dt, rotSpeed, state) {
        const wobble = state.escalator.wobbleAmp ?? 0;
        const now = c.currentTime;
        bp.frequency.setTargetAtTime(60 + Math.sin(now * (2 + rotSpeed * 4)) * 20, now, 0.3);
        if (now >= rattleNext) {
          const amp = clamp(0.18 + wobble * 0.25, 0.1, 0.5);
          noiseBurst({ dur: 0.06, filterType: 'bandpass', freq: 220, q: 2, peak: amp, attack: 0.002, release: 0.05, dest });
          const interval = clamp(0.55 / (0.4 + rotSpeed * 3 + wobble), 0.12, 0.9);
          rattleNext = now + interval * randRange(0.7, 1.3);
        }
      }
    };
  }

  if (name === 'zuruzuru') {
    // ゴムが擦れる「ズルズル/キュルキュル」: 共鳴フィルタ周波数を揺らす
    const noiseSrc = newNoiseSource(true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 9;
    const g = c.createGain();
    g.gain.value = 0.8;
    noiseSrc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noiseSrc.start(t0);

    let wanderNext = t0;
    let ampNext = t0;

    return {
      stopAll() {
        try { noiseSrc.stop(); } catch { /* noop */ }
      },
      update(_dt, rotSpeed) {
        const now = c.currentTime;
        if (now >= wanderNext) {
          const f = clamp(randRange(500, 1800), 400, 2000);
          bp.frequency.setTargetAtTime(f, now, 0.18);
          wanderNext = now + randRange(0.25, 0.6) / (1 + rotSpeed * 2);
        }
        if (now >= ampNext) {
          g.gain.setTargetAtTime(randRange(0.5, 1.0), now, 0.08);
          ampNext = now + randRange(0.12, 0.3);
        }
      }
    };
  }

  // jiji: 電気ノイズ「ジジ...」+ 時々「ピッ」警告
  const noiseSrc = newNoiseSource(true);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 5000;
  bp.Q.value = 2;
  const g = c.createGain();
  g.gain.value = 0.5;
  noiseSrc.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(dest);
  noiseSrc.start(t0);

  let flickerNext = t0;

  return {
    stopAll() {
      try { noiseSrc.stop(); } catch { /* noop */ }
    },
    update() {
      const now = c.currentTime;
      if (now >= flickerNext) {
        g.gain.setTargetAtTime(randRange(0.25, 0.75), now, 0.03);
        flickerNext = now + randRange(0.05, 0.14);
      }
    }
  };
}

function playGenerativeHit(name: LoopName, handle: LoopHandle): void {
  const dest = handle.gain;
  if (name === 'kotokoto') {
    // 木質な不規則打撃
    const detune = randRange(-60, 60);
    noiseBurst({ dur: 0.045, filterType: 'bandpass', freq: 450 + detune, q: 5, peak: randRange(0.5, 0.9), attack: 0.002, release: 0.04, dest });
    tone({ type: 'triangle', freq: 900 + detune, dur: 0.02, attack: 0.001, release: 0.018, peak: 0.25, dest });
    return;
  }
  // kachikachi: 金属の規則的なカチカチ
  tone({ type: 'square', freq: 1500, dur: 0.02, attack: 0.001, release: 0.018, peak: 0.5, dest });
  noiseBurst({ dur: 0.012, filterType: 'bandpass', freq: 3000, q: 3, peak: 0.3, attack: 0.001, release: 0.01, dest });
}

function tickGenerative(handle: LoopHandle, rotSpeed: number): void {
  const c = ctx!;
  const now = c.currentTime;
  if (handle.nextHitTime === undefined || now < handle.nextHitTime) return;

  playGenerativeHit(handle.name, handle);

  if (handle.name === 'kotokoto') {
    const speedFactor = 1 + rotSpeed * 4.5;
    const base = 0.36 / speedFactor;
    handle.nextHitTime = now + clamp(base * randRange(0.6, 1.6), 0.08, 1.0);
  } else {
    const speedFactor = 1 + rotSpeed * 5.5;
    const base = 0.28 / speedFactor;
    handle.nextHitTime = now + clamp(base * randRange(0.92, 1.08), 0.06, 0.65);
  }
}

function tickJijiBeep(handle: LoopHandle): void {
  if (handle.name !== 'jiji') return;
  const c = ctx!;
  const now = c.currentTime;
  if (handle.beepNextTime === undefined) {
    handle.beepNextTime = now + randRange(1.2, 2.5);
    return;
  }
  if (now >= handle.beepNextTime) {
    tone({ type: 'sine', freq: 1800, dur: 0.09, attack: 0.003, release: 0.08, peak: 0.32, dest: handle.gain });
    handle.beepNextTime = now + randRange(1.5, 4);
  }
}

function stopLoopHandle(handle: LoopHandle): void {
  if (!ctx) return;
  handle.stopping = true;
  const c = ctx;
  const t = c.currentTime;
  handle.gain.gain.cancelScheduledValues(t);
  handle.gain.gain.setValueAtTime(handle.gain.gain.value, t);
  handle.gain.gain.linearRampToValueAtTime(0.0001, t + 0.3);
  if (handle.stopTimer) clearTimeout(handle.stopTimer);
  handle.stopTimer = setTimeout(() => {
    handle.nodes?.stopAll();
    activeLoops.delete(handle.name);
  }, 340);
}

function updateExistingLoop(handle: LoopHandle, pan: number | undefined, intensity: number | undefined): void {
  if (!ctx) return;
  const c = ctx;
  if (handle.stopTimer) {
    // フェードアウト中に再度 loopStart が来た場合は復帰させる
    clearTimeout(handle.stopTimer);
    handle.stopTimer = null;
    handle.stopping = false;
  }
  if (pan !== undefined) handle.pan.setPan(pan);
  if (intensity !== undefined) handle.intensity = intensity;
  const target = handle.baseVolume * clamp(handle.intensity, 0, 2);
  handle.gain.gain.cancelScheduledValues(c.currentTime);
  handle.gain.gain.setValueAtTime(handle.gain.gain.value, c.currentTime);
  handle.gain.gain.linearRampToValueAtTime(Math.max(0.0015, target), c.currentTime + 0.25);
}

// ---------------------------------------------------------------------------
// hint (方向チャイム)
// ---------------------------------------------------------------------------

function playHintChime(x: number, y: number): void {
  const screen = layout.worldToScreen(x, y);
  const w = Math.max(1, layout.w);
  const pan = clamp((screen.x / w) * 2 - 1, -1, 1);
  tone({ type: 'sine', freq: 1568.0, dur: 0.11, attack: 0.005, release: 0.09, peak: 0.16, pan });
  tone({ type: 'sine', freq: 2093.0, dur: 0.13, attack: 0.005, release: 0.11, peak: 0.14, start: 0.09, pan });
  void y;
}

// ---------------------------------------------------------------------------
// 音量
// ---------------------------------------------------------------------------

function applyVolume(v: number): void {
  const vol = clamp(v, 0, 1);
  if (vol === appliedVolume || !masterGain || !ctx) return;
  appliedVolume = vol;
  masterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

export const audio: {
  init(): void;
  update(dt: number, state: GameState): void;
  setVolume(v: number): void;
} = {
  init() {
    if (initialized) return;
    initialized = true;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        noiseBuffer = buildNoiseBuffer(ctx);
        masterGain = ctx.createGain();
        masterGain.gain.value = lastState?.settings.volume ?? 1;
        appliedVolume = masterGain.gain.value;
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 24;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.15;
        masterGain.connect(compressor);
        compressor.connect(ctx.destination);
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }
      }
    } catch {
      ctx = null;
    }

    bus.on('sfx', (e) => {
      if (!ctx || !masterGain) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const player = sfxPlayers[e.name];
      if (player) player(e.pan);
    });

    bus.on('loopStart', (e) => {
      if (!ctx || !masterGain) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const existing = activeLoops.get(e.name);
      if (existing) {
        updateExistingLoop(existing, e.pan, e.intensity);
        return;
      }
      const handle = createLoopHandle(e.name, e.pan ?? 0, e.intensity ?? 1);
      activeLoops.set(e.name, handle);
    });

    bus.on('loopStop', (e) => {
      const h = activeLoops.get(e.name);
      if (!h || h.stopping) return;
      stopLoopHandle(h);
    });

    bus.on('settingsChanged', () => {
      if (lastState) applyVolume(lastState.settings.volume);
    });

    bus.on('hint', (e) => {
      if (!ctx || !masterGain) return;
      playHintChime(e.x, e.y);
    });
  },

  update(dt: number, state: GameState) {
    lastState = state;
    if (!ctx || !masterGain) return;

    applyVolume(state.settings.volume);

    // 実測回転速度(loopT/sec)を計算(crank/自動走行どちらも捉える)
    const loopT = state.escalator.loopT;
    if (lastLoopT !== null && dt > 0) {
      let d = loopT - lastLoopT;
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      const inst = Math.abs(d) / dt;
      smoothedRotSpeed += (inst - smoothedRotSpeed) * clamp(dt * 8, 0, 1);
    }
    lastLoopT = loopT;

    for (const handle of activeLoops.values()) {
      if (handle.kind === 'drone') {
        handle.nodes?.update?.(dt, smoothedRotSpeed, state);
      } else {
        tickGenerative(handle, smoothedRotSpeed);
      }
      if (handle.name === 'jiji') tickJijiBeep(handle);
    }
  },

  setVolume(v: number) {
    applyVolume(v);
    if (lastState) lastState.settings.volume = clamp(v, 0, 1);
  }
};
