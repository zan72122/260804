export type Phase =
  | 'choose'
  | 'mount'
  | 'water'
  | 'cut'
  | 'tidy'
  | 'pickup'
  | 'tem'
  | 'replay'
  | 'free'

export type GameEvent =
  | 'blockChosen'
  | 'blockSeated'
  | 'meniscusReady'
  | 'ribbonComplete'
  | 'ribbonTidy'
  | 'ribbonLifted'
  | 'revealDone'
  | 'replaySame'
  | 'replayOther'
  | 'replayFree'
  | 'exitFree'

const TABLE: Record<Phase, Partial<Record<GameEvent, Phase>>> = {
  choose: { blockChosen: 'mount' },
  mount: { blockSeated: 'water' },
  water: { meniscusReady: 'cut' },
  cut: { ribbonComplete: 'tidy' },
  tidy: { ribbonTidy: 'pickup' },
  pickup: { ribbonLifted: 'tem' },
  tem: { revealDone: 'replay' },
  replay: { replaySame: 'cut', replayOther: 'choose', replayFree: 'free' },
  free: { exitFree: 'replay' },
}

export function nextPhase(phase: Phase, event: GameEvent): Phase {
  return TABLE[phase][event] ?? phase
}

export type SpecimenId = 'petal' | 'leaf' | 'feather'

export interface Specimen {
  id: SpecimenId
  /** Resin tint of the embedded block. */
  resin: [number, number, number]
  /** Colour of the hidden thing inside. */
  inner: [number, number, number]
}

export const SPECIMENS: Specimen[] = [
  { id: 'petal', resin: [226, 196, 205], inner: [214, 128, 158] },
  { id: 'leaf', resin: [200, 216, 196], inner: [96, 152, 104] },
  { id: 'feather', resin: [206, 210, 224], inner: [150, 166, 200] },
]

export function specimenById(id: SpecimenId): Specimen {
  return SPECIMENS.find((s) => s.id === id) ?? SPECIMENS[0]
}

export type SectionPhase = 'peeling' | 'landing' | 'floating'

export interface Section {
  id: number
  /** 0 while attached to the block face, 1 when the whole face has passed the edge. */
  peel: number
  phase: SectionPhase
  /** Animated ribbon slot; the whole ribbon glides forward as each new slice is born. */
  slot: number
  slotTarget: number
  /** Compression relief after release: 0.93 → 1.0. */
  spread: number
  /** Thin-film thickness parameter → colour. */
  thickness: number
  rainbow: boolean
  /** Static charge lifting the slice off the surface, 0..1. */
  lift: number
  liftTarget: number
  wobble: number
  shimmer: number
  /** 1 right after release, easing to 0 as the film pours off the edge onto the water. */
  flow: number
  /** Time since the slice touched the water. */
  age: number
  /** Fades out only for slices that drift off the far end in free play. */
  fade: number
}

export function createSection(id: number, thickness: number, rainbowMode: boolean): Section {
  return {
    id,
    peel: 0,
    phase: 'peeling',
    slot: -0.55,
    slotTarget: 0,
    spread: 0.93,
    thickness,
    rainbow: rainbowMode,
    lift: 0,
    liftTarget: 0,
    wobble: 0,
    shimmer: 0,
    flow: 0,
    age: 0,
    fade: 1,
  }
}

/**
 * The section only exists while the block face is crossing the edge. Progress is
 * the fraction of the face that has already gone past, so the film grows
 * continuously instead of popping into existence.
 */
export function facePeel(blockTopY: number, blockH: number, edgeY: number): number {
  if (blockH <= 0) return 0
  // Contact starts when the bottom of the face reaches the edge and finishes when
  // the top of the face has gone past it — screen y grows downwards.
  const p = (blockTopY - (edgeY - blockH)) / blockH
  return p <= 0 ? 0 : p >= 1 ? 1 : p
}

/** Fraction of the growing film that has already touched water (rest still on wet steel). */
export const TOUCHDOWN_AT = 0.2
