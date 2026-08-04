import type { Layout } from './layout'
import { computeLayout } from './layout'
import type { Phase, Section, SpecimenId } from './state'
import { SPECIMENS } from './state'
import type { WaterState } from './water'
import { createWater } from './water'
import type { RibbonShape } from './ribbon'
import { createRibbonShape } from './ribbon'

export interface Ripple {
  u: number
  v: number
  r: number
  max: number
  a: number
  soft: boolean
}

export interface Droplet {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
}

export interface Sparkle {
  x: number
  y: number
  r: number
  life: number
  max: number
  hue: number
}

export type GridState = 'home' | 'drag' | 'submerged' | 'lifting' | 'carrying' | 'inserted'

export interface World {
  layout: Layout
  phase: Phase
  time: number
  phaseT: number
  sinceInput: number
  quality: 'high' | 'low'
  muted: boolean
  reduceMotion: boolean

  specimen: SpecimenId
  chosen: boolean

  water: WaterState
  dropperPress: number
  chimeDone: boolean

  block: {
    seated: boolean
    /** 0 → floating in the child's hand, 1 → clicked into the holder. */
    seat: number
    dragging: boolean
    dragX: number
    dragY: number
    /** Descent in pixels driven by the lever. */
    travel: number
    /** Gentle self-levelling wobble while it settles. */
    tilt: number
  }

  lever: {
    grabbed: boolean
    value: number
    velocity: number
    auto: number
    autoActive: boolean
    armed: boolean
  }

  sections: Section[]
  /** Interference thicknesses of the ribbon riding out of the boat on the grid. */
  carried: number[]
  active: Section | null
  nextSectionId: number
  ribbon: RibbonShape
  cutSpeed: number
  cutJitter: number
  sliceSound: number

  ripples: Ripple[]
  droplets: Droplet[]
  sparkles: Sparkle[]

  ionizer: { x: number; y: number; active: boolean; blow: number; home: boolean }
  eyelash: { x: number; y: number; active: boolean; blocked: number; trail: { x: number; y: number }[] }
  staticEvent: { armed: boolean; fired: boolean; t: number }

  grid: {
    state: GridState
    x: number
    y: number
    tilt: number
    submerge: number
    lift: number
    carry: number
    insert: number
    swipeY: number
  }

  tem: { t: number; zoom: number; zoomPrev: number; active: boolean }

  freeMode: boolean
  flash: number
}

export function createWorld(w: number, h: number, insets = { top: 0, right: 0, bottom: 0, left: 0 }): World {
  const layout = computeLayout({ w, h, insets })
  return {
    layout,
    phase: 'choose',
    time: 0,
    phaseT: 0,
    sinceInput: 0,
    quality: 'high',
    muted: false,
    reduceMotion: false,

    specimen: SPECIMENS[1].id,
    chosen: false,

    water: createWater(),
    dropperPress: 0,
    chimeDone: false,

    block: { seated: false, seat: 0, dragging: false, dragX: 0, dragY: 0, travel: 0, tilt: 0 },
    lever: { grabbed: false, value: 0, velocity: 0, auto: 0, autoActive: false, armed: true },

    sections: [],
    carried: [],
    active: null,
    nextSectionId: 1,
    ribbon: createRibbonShape(),
    cutSpeed: 0,
    cutJitter: 0,
    sliceSound: 0,

    ripples: [],
    droplets: [],
    sparkles: [],

    ionizer: { x: 0, y: 0, active: false, blow: 0, home: true },
    eyelash: { x: 0, y: 0, active: false, blocked: 0, trail: [] },
    staticEvent: { armed: false, fired: false, t: 0 },

    grid: {
      state: 'home',
      x: 0,
      y: 0,
      tilt: 0,
      submerge: 0,
      lift: 0,
      carry: 0,
      insert: 0,
      swipeY: 0,
    },

    tem: { t: 0, zoom: 1, zoomPrev: 1, active: false },

    freeMode: false,
    flash: 0,
  }
}
