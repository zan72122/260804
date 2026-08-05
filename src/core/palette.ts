import { Color } from 'three'

/** 空・海・霧の色は「時刻(t)」と「天気」の二つで決まる。 */
export type WeatherId = 'clear' | 'fog' | 'snow'

export interface WeatherPreset {
  id: WeatherId
  /** UI 用の絵文字（文字が読めなくても選べるように） */
  icon: string
  label: string
  /** 大気の濃さ 0..1 — 空気遠近の強さ */
  haze: number
  /** 霧粒の量 */
  motes: number
  /** 降るもの */
  precip: 'none' | 'snow' | 'rain'
  /** 波の高さ倍率 */
  swell: number
  /** 光の筋の見えやすさ（霧が濃いほどよく見える） */
  beamDensity: number
  /** 夕焼けの彩度 */
  sunsetSaturation: number
  fogTint: [number, number, number]
}

export const WEATHERS: Record<WeatherId, WeatherPreset> = {
  clear: {
    id: 'clear',
    icon: '🌅',
    label: 'はれた ゆうがた',
    haze: 0.3,
    motes: 0.12,
    precip: 'none',
    swell: 1.0,
    beamDensity: 0.55,
    sunsetSaturation: 1.0,
    fogTint: [0.44, 0.35, 0.5],
  },
  fog: {
    id: 'fog',
    icon: '🌫️',
    label: 'きりの よる',
    haze: 0.92,
    motes: 1.0,
    precip: 'none',
    swell: 0.55,
    beamDensity: 1.0,
    sunsetSaturation: 0.55,
    fogTint: [0.5, 0.52, 0.62],
  },
  snow: {
    id: 'snow',
    icon: '❄️',
    label: 'ゆきの よる',
    haze: 0.6,
    motes: 0.5,
    precip: 'snow',
    swell: 0.8,
    beamDensity: 0.8,
    sunsetSaturation: 0.7,
    fogTint: [0.55, 0.58, 0.7],
  },
}

export const WEATHER_ORDER: WeatherId[] = ['clear', 'fog', 'snow']

/** 灯りの色（灯室のかざりも一緒に変わる） */
export interface LightPreset {
  id: string
  icon: string
  label: string
  lamp: number
  beam: number
  trim: number
}

export const LIGHTS: LightPreset[] = [
  { id: 'warm', icon: '🌟', label: 'きんいろ', lamp: 0xfff0c4, beam: 0xffe2a0, trim: 0xf7d78a },
  { id: 'rose', icon: '🌸', label: 'ももいろ', lamp: 0xffd9e6, beam: 0xffb9d6, trim: 0xff9ec4 },
  { id: 'sea', icon: '💎', label: 'みずいろ', lamp: 0xd8f2ff, beam: 0xa8e0ff, trim: 0x8fd6f2 },
  { id: 'rainbow', icon: '🌈', label: 'にじいろ', lamp: 0xffffff, beam: 0xffffff, trim: 0xffc7e6 },
]

/** レンズの汚れ方 */
export type GrimeId = 'salt' | 'haze' | 'drops'

export interface GrimePreset {
  id: GrimeId
  icon: string
  label: string
}

export const GRIMES: GrimePreset[] = [
  { id: 'salt', icon: '🧂', label: 'しおの つぶ' },
  { id: 'haze', icon: '💨', label: 'しろい くもり' },
  { id: 'drops', icon: '💧', label: 'みずの つぶ' },
]

/** 絵本っぽい基調色 */
export const PALETTE = {
  towerBody: 0xfdf6ef,
  towerStripe: 0xff9fb8,
  towerRoof: 0x3b4f8a,
  rock: 0x584b57,
  rockLit: 0x7a6a74,
  brassDark: 0x7a5a2e,
  brass: 0xd9a441,
  brassBright: 0xf3d089,
  coatPink: 0xff86ab,
  coatCuff: 0xfff2f6,
  woodDark: 0x4b3a34,
  wood: 0x8a6350,
  glass: 0xbfe6ff,
}

/** 時間 t(0=日没直前 .. 1=夜) から空の色を作る */
export function skyColors(t: number, w: WeatherPreset) {
  const sat = w.sunsetSaturation
  const zenithDay = new Color(0x4f6bb5)
  const zenithNight = new Color(0x070c26)
  const horizonDay = new Color(0xffb27a).lerp(new Color(0x9a8fa8), 1 - sat)
  const horizonNight = new Color(0x1b2350)
  const glowDay = new Color(0xff9d5c).lerp(new Color(0xa79aac), 1 - sat)
  const glowNight = new Color(0x2a2c58)

  const k = smoothstep(0, 1, t)
  return {
    zenith: zenithDay.clone().lerp(zenithNight, k),
    horizon: horizonDay.clone().lerp(horizonNight, k),
    glow: glowDay.clone().lerp(glowNight, k),
    starAmount: smoothstep(0.35, 1.0, t),
    sunHeight: 0.16 - t * 0.34,
  }
}

export function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function clamp(x: number, a: number, b: number) {
  return x < a ? a : x > b ? b : x
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** フレーム独立の指数補間 */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}
