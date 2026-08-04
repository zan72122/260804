/**
 * Everything is synthesised: no asset downloads, no autoplay surprises.
 * The context is created on the first real gesture so iOS Safari unlocks it.
 */
export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  muted = false

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05)
    }
  }

  private ready(): boolean {
    return !!this.ctx && !!this.master && !this.muted
  }

  private env(
    type: OscillatorType,
    freq: number,
    dur: number,
    gain: number,
    glideTo?: number,
    delay = 0,
  ): void {
    if (!this.ready()) return
    const ctx = this.ctx!
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(this.master!)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private noise(dur: number, gain: number, freq: number, q: number, delay = 0, sweepTo?: number): void {
    if (!this.ready()) return
    const ctx = this.ctx!
    const t0 = ctx.currentTime + delay
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(freq, t0)
    if (sweepTo !== undefined) bp.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur)
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(bp).connect(g).connect(this.master!)
    src.start(t0)
  }

  drop(): void {
    this.env('sine', 900, 0.16, 0.12, 320)
    this.noise(0.09, 0.05, 1800, 3, 0.01)
  }

  chime(): void {
    this.env('sine', 1046, 0.9, 0.13)
    this.env('sine', 1568, 0.8, 0.07, undefined, 0.06)
    this.env('sine', 2093, 0.7, 0.04, undefined, 0.12)
  }

  /** The long whisper as the block face travels past the edge. */
  slice(strength: number): void {
    this.noise(0.34, 0.028 + 0.03 * strength, 2600, 1.1, 0, 5200)
  }

  /** Section lets go of the block and relaxes onto the water. */
  release(): void {
    this.env('sine', 640, 0.22, 0.08, 880)
    this.noise(0.18, 0.03, 1200, 2)
  }

  ripple(): void {
    this.noise(0.22, 0.022, 700, 1.6, 0, 380)
  }

  sparkle(i = 0): void {
    this.env('triangle', 1320 + i * 180, 0.28, 0.05)
  }

  /** Surface tension grabbing the ribbon onto the grid. */
  pickup(): void {
    this.env('sine', 420, 0.3, 0.1, 980)
    this.noise(0.26, 0.05, 2400, 1.4, 0.02, 900)
    this.env('sine', 1568, 0.5, 0.05, undefined, 0.16)
  }

  breeze(): void {
    this.noise(0.5, 0.02, 900, 0.7, 0, 2200)
  }

  startHum(): void {
    if (!this.ready() || this.humOsc) return
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 62
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 1.2)
    osc.connect(g).connect(this.master!)
    osc.start()
    this.humOsc = osc
    this.humGain = g
  }

  stopHum(): void {
    if (!this.ctx || !this.humOsc || !this.humGain) return
    const t = this.ctx.currentTime
    this.humGain.gain.cancelScheduledValues(t)
    this.humGain.gain.setTargetAtTime(0.0001, t, 0.25)
    this.humOsc.stop(t + 1.4)
    this.humOsc = null
    this.humGain = null
  }
}
