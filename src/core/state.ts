import type { GrimeId, WeatherId } from './palette'

export type Phase =
  | 'boot'
  | 'title'
  | 'door'
  | 'stairs'
  | 'lamproom'
  | 'polish'
  | 'gear'
  | 'crank'
  | 'switch'
  | 'beacon'
  | 'ships'
  | 'menu'
  | 'free'

export const TOTAL_LANDINGS = 8

export interface FoundThing {
  id: string
  icon: string
}

/**
 * 一回の点灯で持ち回る状態。画面回転はリロードではないので、
 * このオブジェクトはそのまま生き残る（＝上った段数・磨いた範囲は保持される）。
 */
export class GameState {
  phase: Phase = 'boot'
  weather: WeatherId = 'clear'
  lightIndex = 0
  grime: GrimeId = 'salt'

  /** 0..TOTAL_LANDINGS の連続値。スワイプでなめらかに増える */
  climb = 0
  /** 到達した最大の踊り場 */
  landing = 0

  /** 0..1 レンズの磨けた割合 */
  polished = 0
  /** 歯車をはめ直した */
  gearFixed = false
  /** ハンドルで巻き上げた量 0..1 */
  crank = 0
  /** スイッチが入った */
  lit = false
  /** 点灯からの経過（演出用） */
  litTime = 0
  /** 船が光を見つけた数 */
  shipsGuided = 0

  /** 空の暗さ 0=夕焼け 1=夜 */
  duskT = 0

  /** 階段でみつけた小さなもの */
  found: FoundThing[] = []

  /** 何回目の点灯か */
  runCount = 0

  /** 自由あそびモード（順番を気にせず何でも触れる） */
  freePlay = false

  reset(weather: WeatherId, grime: GrimeId) {
    this.weather = weather
    this.grime = grime
    this.climb = 0
    this.landing = 0
    this.polished = 0
    this.gearFixed = false
    this.crank = 0
    this.lit = false
    this.litTime = 0
    this.shipsGuided = 0
    this.duskT = weather === 'clear' ? 0 : 0.55
    this.found = []
    this.freePlay = false
  }
}

export interface SaveData {
  runs: number
  lightIndex: number
  seenWeathers: WeatherId[]
  found: string[]
}

const KEY = 'hikari-no-toudai/v1'

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) throw new Error('empty')
    const d = JSON.parse(raw) as Partial<SaveData>
    return {
      runs: d.runs ?? 0,
      lightIndex: d.lightIndex ?? 0,
      seenWeathers: d.seenWeathers ?? [],
      found: d.found ?? [],
    }
  } catch {
    return { runs: 0, lightIndex: 0, seenWeathers: [], found: [] }
  }
}

export function writeSave(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* プライベートブラウズでは黙って諦める */
  }
}
