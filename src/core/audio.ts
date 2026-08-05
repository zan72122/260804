/**
 * 効果音・環境音はすべて WebAudio で合成する（読み込み待ちゼロ、モバイル Safari で安定）。
 * 最初のタップまで AudioContext は作らない（iOS の自動再生制限）。
 */
export class Sound {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private conv!: ConvolverNode
  private wetBus!: GainNode

  private waveGain: GainNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private hum: { osc: OscillatorNode; gain: GainNode } | null = null
  private padGain: GainNode | null = null
  private padVoices: { osc: OscillatorNode; gain: GainNode }[] = []
  private noiseBuf: AudioBuffer | null = null

  enabled = true
  ready = false
  private padTarget = 0.16

  start() {
    if (this.ctx) return
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0.0
    this.master.connect(ctx.destination)

    this.conv = ctx.createConvolver()
    this.conv.buffer = makeImpulse(ctx, 2.4, 2.6)
    this.wetBus = ctx.createGain()
    this.wetBus.gain.value = 0.26
    this.conv.connect(this.wetBus)
    this.wetBus.connect(this.master)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.9
    this.sfxBus.connect(this.master)
    this.sfxBus.connect(this.conv)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.5
    this.musicBus.connect(this.master)
    this.musicBus.connect(this.conv)

    this.noiseBuf = makeNoise(ctx, 3)

    this.master.gain.linearRampToValueAtTime(this.enabled ? 0.9 : 0, ctx.currentTime + 1.2)
    this.ready = true

    this.startAmbience()
    this.startPad()
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!this.ctx) return
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.linearRampToValueAtTime(on ? 0.9 : 0, this.ctx.currentTime + 0.25)
  }

  // ---------- 環境音 ----------

  private startAmbience() {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuf) return

    // 波：ノイズを低く絞って、ゆっくり音量を揺らす
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    lp.Q.value = 0.4
    const g = ctx.createGain()
    g.gain.value = 0.16
    src.connect(lp).connect(g).connect(this.master)
    // 寄せては返す
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.11
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.09
    lfo.connect(lfoG).connect(g.gain)
    lfo.start()
    src.start()
    this.waveGain = g

    // 風：高いほど強くなる
    const src2 = ctx.createBufferSource()
    src2.buffer = this.noiseBuf
    src2.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700
    bp.Q.value = 0.7
    const g2 = ctx.createGain()
    g2.gain.value = 0.0
    src2.connect(bp).connect(g2).connect(this.master)
    src2.start()
    this.windGain = g2
    this.windFilter = bp
  }

  /** 高さ 0..1、屋内なら inside=true で風をこもらせる */
  setWind(amount: number, inside: boolean) {
    if (!this.ctx || !this.windGain || !this.windFilter) return
    const t = this.ctx.currentTime
    this.windGain.gain.setTargetAtTime(amount * (inside ? 0.05 : 0.13), t, 0.6)
    this.windFilter.frequency.setTargetAtTime(inside ? 380 : 500 + amount * 900, t, 0.8)
  }

  setWaves(amount: number) {
    if (!this.ctx || !this.waveGain) return
    this.waveGain.gain.setTargetAtTime(0.05 + amount * 0.16, this.ctx.currentTime, 0.8)
  }

  // ---------- やさしいパッド ----------

  private startPad() {
    const ctx = this.ctx
    if (!ctx) return
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.0
    this.padGain.connect(this.musicBus)
    // Fメジャー9th あたりの静かな和音
    const freqs = [87.31, 130.81, 174.61, 261.63, 329.63]
    for (const f of freqs) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.16 / freqs.length
      const det = ctx.createOscillator()
      det.frequency.value = 0.06 + Math.random() * 0.08
      const detG = ctx.createGain()
      detG.gain.value = 1.6
      det.connect(detG).connect(osc.detune)
      det.start()
      osc.connect(g).connect(this.padGain)
      osc.start()
      this.padVoices.push({ osc, gain: g })
    }
    // 音が使えるようになる前に指定された音量を、ここで反映する
    this.padGain.gain.setTargetAtTime(this.padTarget, ctx.currentTime, 1.4)
  }

  setPad(level: number) {
    this.padTarget = level
    if (!this.ctx || !this.padGain) return
    this.padGain.gain.setTargetAtTime(level, this.ctx.currentTime, 1.4)
  }

  /** 和音を明るい方へ持ち上げる（点灯時） */
  liftPad() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const targets = [87.31 * 1.5, 130.81 * 1.5, 174.61 * 1.5, 261.63 * 1.5, 392.0]
    this.padVoices.forEach((v, i) => {
      v.osc.frequency.setTargetAtTime(targets[i % targets.length], t, 2.2)
    })
  }

  resetPad() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const targets = [87.31, 130.81, 174.61, 261.63, 329.63]
    this.padVoices.forEach((v, i) => v.osc.frequency.setTargetAtTime(targets[i % targets.length], t, 1.5))
  }

  // ---------- 単発の音 ----------

  private noiseBurst(dur: number, type: BiquadFilterType, freq: number, q: number, gain: number, decay = 1) {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuf) return null
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    src.playbackRate.value = 0.7 + Math.random() * 0.6
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur * decay)
    src.connect(f).connect(g).connect(this.sfxBus)
    src.start(t)
    src.stop(t + dur * decay + 0.05)
    return { src, filter: f, gain: g }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, glide = 0) {
    const ctx = this.ctx
    if (!ctx) return
    const o = ctx.createOscillator()
    o.type = type
    const t = ctx.currentTime
    o.frequency.setValueAtTime(freq, t)
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    o.connect(g).connect(this.sfxBus)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  /** かつん、と一段のぼる音 */
  step(pitch = 1) {
    this.noiseBurst(0.16, 'bandpass', 220 * pitch, 1.6, 0.32)
    this.tone(90 * pitch, 0.14, 'sine', 0.16, 0.6)
  }

  /** きゅっ（磨く） */
  squeak(rate: number) {
    const ctx = this.ctx
    if (!ctx) return
    const o = ctx.createOscillator()
    o.type = 'sine'
    const t = ctx.currentTime
    const base = 900 + rate * 900
    o.frequency.setValueAtTime(base * 0.75, t)
    o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.07)
    o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.16)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.075, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.19)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = base
    f.Q.value = 4
    o.connect(f).connect(g).connect(this.sfxBus)
    o.start(t)
    o.stop(t + 0.24)
    this.noiseBurst(0.1, 'highpass', 2600, 0.7, 0.05)
  }

  /** かちり（歯車の歯が噛む） */
  ratchet(pitch = 1) {
    this.noiseBurst(0.06, 'bandpass', 1700 * pitch, 6, 0.16)
    this.tone(320 * pitch, 0.05, 'square', 0.035)
  }

  /** かちん（小物・UI） */
  blip(freq = 880) {
    this.tone(freq, 0.12, 'triangle', 0.09)
  }

  /** きらきら（発見） */
  sparkle() {
    const notes = [1046, 1318, 1568, 2093]
    notes.forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.5, 'sine', 0.075), i * 70)
    })
  }

  /** ぎいい（扉） */
  door() {
    const b = this.noiseBurst(1.1, 'bandpass', 420, 3.5, 0.13, 1)
    if (b && this.ctx) {
      const t = this.ctx.currentTime
      b.filter.frequency.setValueAtTime(300, t)
      b.filter.frequency.linearRampToValueAtTime(900, t + 0.9)
    }
    this.tone(70, 0.9, 'sine', 0.1, 0.7)
  }

  /** ガチャン（大きなスイッチ） */
  clunk() {
    const ctx = this.ctx
    if (!ctx) return
    this.noiseBurst(0.35, 'lowpass', 900, 0.8, 0.5)
    this.tone(140, 0.32, 'square', 0.16, 0.35)
    this.tone(62, 0.6, 'sine', 0.26, 0.5)
    window.setTimeout(() => this.noiseBurst(0.18, 'bandpass', 2400, 3, 0.12), 60)
  }

  /** 灯りのうなり（点灯中ずっと） */
  lampOn() {
    const ctx = this.ctx
    if (!ctx || this.hum) return
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 58
    const g = ctx.createGain()
    g.gain.value = 0
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 260
    o.connect(f).connect(g).connect(this.master)
    o.start()
    g.gain.setTargetAtTime(0.075, ctx.currentTime, 2.0)
    this.hum = { osc: o, gain: g }
    // ふわっと立ち上がる光の音
    const b = this.noiseBurst(2.6, 'lowpass', 300, 0.6, 0.13, 1)
    if (b) {
      const t = ctx.currentTime
      b.filter.frequency.setValueAtTime(180, t)
      b.filter.frequency.linearRampToValueAtTime(2600, t + 2.2)
    }
  }

  lampOff() {
    if (!this.ctx || !this.hum) return
    const h = this.hum
    this.hum = null
    h.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5)
    h.osc.stop(this.ctx.currentTime + 2.5)
  }

  /** ぼおーっ（汽笛） */
  horn(kind: 0 | 1 | 2 = 0) {
    const ctx = this.ctx
    if (!ctx) return
    const base = [128, 96, 172][kind]
    const dur = [2.0, 2.6, 1.4][kind]
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.16, t + 0.22)
    g.gain.setValueAtTime(0.16, t + dur * 0.68)
    g.gain.exponentialRampToValueAtTime(0.0007, t + dur)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 900
    g.connect(f)
    f.connect(this.sfxBus)
    for (const [mult, amp] of [[1, 1], [1.5, 0.5], [2.01, 0.34], [2.98, 0.16]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = base * mult
      const og = ctx.createGain()
      og.gain.value = 0.24 * amp
      // わずかにゆれる
      const v = ctx.createOscillator()
      v.frequency.value = 4.5
      const vg = ctx.createGain()
      vg.gain.value = 2.4
      v.connect(vg).connect(o.detune)
      v.start(t)
      v.stop(t + dur + 0.1)
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + dur + 0.1)
    }
  }

  /** 巻き上げのごろごろ音（ハンドル回転中） */
  private crankNode: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null

  setCrank(intensity: number) {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuf) return
    if (!this.crankNode) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 260
      f.Q.value = 1.4
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(f).connect(g).connect(this.sfxBus)
      src.start()
      this.crankNode = { src, gain: g, filter: f }
    }
    const n = this.crankNode
    n.gain.gain.setTargetAtTime(Math.min(0.2, intensity * 0.2), ctx.currentTime, 0.08)
    n.filter.frequency.setTargetAtTime(180 + intensity * 420, ctx.currentTime, 0.1)
  }
}

function makeNoise(ctx: AudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    // ざらつきを抑えたピンクノイズ寄り
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57555 * b2 + w * 1.0526913
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16
  }
  return buf
}

function makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}
