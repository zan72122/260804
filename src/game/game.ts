import type { World } from './world'
import { createWorld } from './world'
import { computeLayout } from './layout'
import type { Insets } from './layout'
import { poolScale } from './layout'
import type { GameEvent } from './state'
import { SPECIMENS, createSection, facePeel, nextPhase } from './state'
import type { Section } from './state'
import { MAX_RIBBON, TARGET_SECTIONS, createRibbonShape, isTidy, relaxShape, slotLateral, waveFromStroke } from './ribbon'
import { WATER_IDEAL, WATER_MAX, addDrop, createWater, meniscusReached, stepWater } from './water'
import { guardEdge } from './safety'
import { cardSlots, hitCard } from './cards'
import type { Card } from './cards'
import { Sfx } from '../core/audio'
import type { PointerEventLite } from '../core/pointer'
import { approach, clamp, clamp01, dist, easeInOutSine, lerp, smoothstep } from '../core/math'
import { makeRng } from '../core/rng'
import { band } from './color'
import type { Ctx } from '../render/draw'
import { hintRing } from '../render/draw'
import {
  drawAlignmentGuide,
  drawArm,
  drawBackground,
  drawBlock,
  drawConsole,
  drawFrame,
  drawKnifeAndBoat,
  drawKnifeEdge,
  drawRipples,
  drawWater,
  surfacePoint,
} from '../render/scene'
import {
  drawDroplets,
  drawFloatingSection,
  drawPeelingSection,
  drawRibbonBase,
  drawRibbonSeams,
  drawSparkles,
  placeSection,
} from '../render/film'
import {
  drawChooseCard,
  drawDropper,
  drawEyelash,
  drawGrid,
  drawHomeButton,
  drawIonizer,
  drawLever,
  drawMute,
  drawReplayCard,
  drawTemPort,
} from '../render/tools'
import type { TemScene } from '../render/tem'
import { buildTemScene, drawTem, temZoom } from '../render/tem'

type Grab = 'none' | 'block' | 'lever' | 'dropper' | 'ionizer' | 'eyelash' | 'grid' | 'card' | 'mute'

const rng = makeRng(20260804)

export class Game {
  world: World
  sfx = new Sfx()
  private temScene: TemScene
  private grab: Grab = 'none'
  private pressedCard = -1
  private cards: Card[] = []
  private holdTimer = 0
  private seatTimer = 0
  private introT = 0
  private lowestGridY = 0
  private releaseTimer = 0
  private autoWaterTimer = 0
  private chimeTimer = 0
  private fpsAvg = 60
  private fpsTimer = 0
  private downgraded = false

  constructor(w: number, h: number, insets: Insets) {
    this.world = createWorld(w, h, insets)
    this.temScene = buildTemScene(this.world.specimen)
    this.resetGridHome()
  }

  // ---------------------------------------------------------------- layout

  resize(w: number, h: number, insets: Insets): void {
    const old = this.world.layout
    const next = computeLayout({ w, h, insets })
    // Everything meaningful (water level, ribbon slots, phase) is resolution
    // independent; only free-floating screen positions need remapping.
    const kx = next.w / old.w
    const ky = next.h / old.h
    this.world.block.dragX *= kx
    this.world.block.dragY *= ky
    this.world.grid.x *= kx
    this.world.grid.y *= ky
    this.world.ionizer.x *= kx
    this.world.ionizer.y *= ky
    this.world.eyelash.x *= kx
    this.world.eyelash.y *= ky
    for (const d of this.world.droplets) {
      d.x *= kx
      d.y *= ky
    }
    for (const s of this.world.sparkles) {
      s.x *= kx
      s.y *= ky
    }
    this.world.eyelash.trail.length = 0
    this.world.layout = next
    if (this.world.grid.state === 'home') this.resetGridHome()
  }

  private resetGridHome(): void {
    const g = this.world.layout.tools.grid
    this.world.grid.x = g.x
    this.world.grid.y = g.y
  }

  private fire(ev: GameEvent): void {
    const before = this.world.phase
    const after = nextPhase(before, ev)
    if (after === before) return
    this.world.phase = after
    this.world.phaseT = 0
    this.onEnterPhase(after)
  }

  private onEnterPhase(p: World['phase']): void {
    const w = this.world
    switch (p) {
      case 'choose':
        w.sections = []
        w.active = null
        w.water = createWater()
        w.chimeDone = false
        w.block.seat = 0
        w.block.seated = false
        w.block.travel = 0
        w.lever.value = 0
        w.grid.state = 'home'
        w.grid.submerge = 0
        w.grid.carry = 0
        w.grid.lift = 0
        w.grid.insert = 0
        w.freeMode = false
        this.resetGridHome()
        break
      case 'mount':
        this.introT = 0
        break
      case 'water':
        this.autoWaterTimer = 0
        this.chimeTimer = 0
        break
      case 'cut':
        w.lever.armed = true
        w.freeMode = false
        break
      case 'tidy':
        this.armStatic()
        break
      case 'pickup':
        w.grid.state = 'home'
        this.resetGridHome()
        break
      case 'tem':
        w.tem.t = 0
        w.tem.zoom = 1
        w.tem.active = true
        this.temScene = buildTemScene(w.specimen)
        this.sfx.startHum()
        break
      case 'replay':
        break
      case 'free':
        w.freeMode = true
        w.lever.armed = true
        break
    }
  }

  // ---------------------------------------------------------------- input

  onPointer(e: PointerEventLite): void {
    const w = this.world
    // A fingertip dawdling on the glass must not count as "the child is busy",
    // or it would silently switch off every hint and every rescue at once.
    if (e.phase !== 'move' || Math.hypot(e.x - e.px, e.y - e.py) > 4) w.sinceInput = 0
    this.sfx.unlock()

    if (e.phase === 'down' && dist(e.x, e.y, w.layout.mute.x, w.layout.mute.y) < w.layout.mute.r * 2) {
      this.grab = 'mute'
      return
    }
    if (this.grab === 'mute') {
      if (e.phase === 'up') {
        w.muted = !w.muted
        this.sfx.setMuted(w.muted)
        this.grab = 'none'
      }
      return
    }

    switch (w.phase) {
      case 'choose':
        this.inputChoose(e)
        break
      case 'mount':
        this.inputMount(e)
        break
      case 'water':
        this.inputWater(e)
        break
      case 'cut':
      case 'free':
        this.inputCut(e)
        break
      case 'tidy':
        this.inputTidy(e)
        break
      case 'pickup':
        this.inputPickup(e)
        break
      case 'tem':
        if (e.phase === 'down' && w.tem.t > 2.5) w.tem.t = 11.6
        break
      case 'replay':
        this.inputReplay(e)
        break
    }
  }

  private inputChoose(e: PointerEventLite): void {
    if (e.phase === 'down') {
      this.pressedCard = this.cards.findIndex((c) => hitCard(c, e.x, e.y, 14))
      this.grab = this.pressedCard >= 0 ? 'card' : 'none'
    } else if (e.phase === 'up' && this.grab === 'card') {
      const i = this.cards.findIndex((c) => hitCard(c, e.x, e.y, 24))
      if (i >= 0 && i === this.pressedCard) {
        const w = this.world
        w.specimen = SPECIMENS[i % SPECIMENS.length].id
        w.chosen = true
        w.block.dragX = this.cards[i].cx
        w.block.dragY = this.cards[i].cy
        w.block.seat = 0
        this.sfx.sparkle(i)
        this.fire('blockChosen')
      }
      this.pressedCard = -1
      this.grab = 'none'
    }
  }

  private blockSeatPoint(): { x: number; y: number } {
    const l = this.world.layout
    return { x: l.block.faceX - l.block.w * 0.5, y: l.block.restY + l.block.h * 0.5 }
  }

  private blockHome(): { x: number; y: number } {
    const l = this.world.layout
    return { x: l.w * 0.5, y: l.barCy }
  }

  private inputMount(e: PointerEventLite): void {
    const w = this.world
    if (w.block.seat > 0.01) return
    const l = w.layout
    const seat = this.blockSeatPoint()
    const grabR = Math.max(l.block.w * 1.5, 62 * l.ui)
    if (e.phase === 'down') {
      if (dist(e.x, e.y, w.block.dragX, w.block.dragY) < grabR) {
        this.grab = 'block'
        w.block.dragging = true
      } else if (dist(e.x, e.y, seat.x, seat.y) < Math.max(l.block.w * 2.4, 96 * l.ui)) {
        // Tapping the empty holder is enough: the block flies home by itself.
        this.seatBlock()
      }
    } else if (e.phase === 'move' && this.grab === 'block') {
      // The resin block is a solid object too: it may not be swept through the edge.
      const g = guardEdge(e.x, e.y, l.knife.tipX, l.knife.tipY, l.edgeGuard * 1.2)
      w.block.dragX = e.x
      w.block.dragY = Math.min(e.y, g.y)
      if (e.x > l.knife.tipX - l.block.w * 0.5 && e.y > l.knife.tipY - l.block.h) {
        w.block.dragX = Math.min(e.x, l.knife.tipX - l.block.w * 0.5)
      }
    } else if (e.phase === 'up' && this.grab === 'block') {
      this.grab = 'none'
      w.block.dragging = false
      const snapR = Math.max(l.block.w * 2.8, 118 * l.ui)
      if (dist(w.block.dragX, w.block.dragY, seat.x, seat.y) < snapR || e.moved < 10) {
        this.seatBlock()
      }
    }
  }

  private seatBlock(): void {
    const w = this.world
    if (w.block.seat > 0.01) return
    w.block.dragging = false
    w.block.seated = true
    this.seatTimer = 0
    this.sfx.release()
  }

  private inputWater(e: PointerEventLite): void {
    const w = this.world
    const d = w.layout.tools.dropper
    const bar = e.y > w.layout.h - w.layout.insets.bottom - w.layout.barH * 1.12
    if (e.phase === 'down' && (bar || dist(e.x, e.y, d.x, d.y) < d.r * 2.1)) {
      this.grab = 'dropper'
      this.holdTimer = 0
      this.squeeze()
    } else if (e.phase === 'up' && this.grab === 'dropper') {
      this.grab = 'none'
    }
  }

  private squeeze(): void {
    const w = this.world
    // A couple of drops past the mark are allowed on purpose: the child gets to
    // see the meniscus bulge and wick itself back, rather than being told no.
    if (w.water.level >= WATER_MAX - 0.02) return
    w.water = addDrop(w.water)
    w.dropperPress = 1
    this.sfx.drop()
    const l = w.layout
    const p = surfacePoint(l, w.water.level, 0.1 + rng() * 0.2, 0.3 + rng() * 0.4)
    w.droplets.push({
      x: l.tools.dropper.x + (rng() - 0.5) * 6,
      y: l.tools.dropper.y + l.tools.dropper.r * 1.4,
      vx: (p.x - l.tools.dropper.x) * 0.9,
      vy: -260 * l.ui,
      r: 4.2 * l.ui,
      life: 1,
    })
    this.addRipple(0.08 + rng() * 0.25, 0.3 + rng() * 0.4, 0.6)
  }

  private inputCut(e: PointerEventLite): void {
    const w = this.world
    const t = w.layout.tools.lever
    if (w.phase === 'free' && e.phase === 'down') {
      const hx = w.layout.w - w.layout.insets.right - 34 * w.layout.ui
      const hy = w.layout.top + 30 * w.layout.ui
      if (dist(e.x, e.y, hx, hy) < 44 * w.layout.ui) {
        this.fire('exitFree')
        return
      }
    }
    if (e.phase === 'down') {
      const bar = e.y > w.layout.h - w.layout.insets.bottom - w.layout.barH * 1.12
      const near =
        bar || (Math.abs(e.x - t.x) < t.r * 3 && e.y > t.trackTop - t.r * 2.4 && e.y < t.trackBottom + t.r * 2.4)
      if (near) {
        this.grab = 'lever'
        w.lever.grabbed = true
        w.lever.autoActive = false
      } else {
        // Tapping the machine itself — the part a child actually looks at — runs
        // one gentle stroke, so the interesting 70% of the screen is never dead.
        this.grab = 'none'
        if (!w.lever.autoActive && !w.active) {
          w.lever.autoActive = true
          w.lever.auto = 0
        }
      }
    } else if (e.phase === 'move' && this.grab === 'lever') {
      // Relative control: the knob never jumps to the finger, so a clumsy grab
      // cannot yank the block through the edge.
      const span = Math.max(1, t.trackBottom - t.trackTop)
      const dv = (e.y - e.py) / span
      w.lever.velocity = dv * 60
      w.lever.value = clamp01(w.lever.value + dv)
    } else if (e.phase === 'up' && this.grab === 'lever') {
      this.grab = 'none'
      w.lever.grabbed = false
      // A simple tap runs one complete, gentle stroke.
      if (e.moved < 12) {
        w.lever.autoActive = true
        w.lever.auto = 0
      }
    }
  }

  private inputTidy(e: PointerEventLite): void {
    const w = this.world
    const l = w.layout
    const io = l.tools.ionizer
    const ey = l.tools.eyelash
    if (e.phase === 'down') {
      if (dist(e.x, e.y, io.x, io.y) < io.r * 2.1) {
        this.grab = 'ionizer'
        w.ionizer.home = false
        this.moveIonizer(e.x, e.y)
        this.holdTimer = 0
      } else if (dist(e.x, e.y, ey.x, ey.y) < ey.r * 2.1) {
        this.grab = 'eyelash'
        w.eyelash.active = true
        w.eyelash.x = e.x
        w.eyelash.y = e.y
        w.eyelash.trail.length = 0
      }
    } else if (e.phase === 'move') {
      if (this.grab === 'ionizer') {
        this.moveIonizer(e.x, e.y)
      } else if (this.grab === 'eyelash') {
        const g = guardEdge(e.x, e.y, l.knife.tipX, l.knife.tipY, l.edgeGuard)
        w.eyelash.x = g.x
        w.eyelash.y = g.y
        if (g.blocked) w.eyelash.blocked = 1
        w.eyelash.trail.push({ x: g.x, y: g.y })
        if (w.eyelash.trail.length > 22) w.eyelash.trail.shift()
      }
    } else if (e.phase === 'up') {
      if (this.grab === 'ionizer') {
        // A tap is enough: the breeze keeps blowing for a moment on its own.
        if (e.moved < 12) w.ionizer.blow = 1
        w.ionizer.home = true
        this.grab = 'none'
      } else if (this.grab === 'eyelash') {
        w.eyelash.active = false
        this.grab = 'none'
      }
    }
  }

  /** Even the air blower is kept away from the diamond — the rule has no exceptions. */
  private moveIonizer(x: number, y: number): void {
    const w = this.world
    const l = w.layout
    const g = guardEdge(x, y, l.knife.tipX, l.knife.tipY, l.edgeGuard)
    w.ionizer.x = g.x
    w.ionizer.y = g.y
    if (g.blocked) w.eyelash.blocked = 1
  }

  private inputPickup(e: PointerEventLite): void {
    const w = this.world
    const l = w.layout
    const g = w.grid
    const r = l.tools.grid.r
    if (e.phase === 'down') {
      if (dist(e.x, e.y, g.x, g.y) < r * 2.4) {
        this.grab = 'grid'
        if (g.state === 'home') g.state = 'drag'
        this.lowestGridY = g.y
      } else if (g.state === 'carrying' || g.state === 'inserted') {
        if (dist(e.x, e.y, l.tem.x, l.tem.y) < l.tem.r * 2) g.state = 'inserted'
      } else if (g.state === 'home' || g.state === 'drag') {
        // Tapping the water itself is enough: the mesh flies over and dips.
        // The test is the surface, not merely "below and right of it".
        const onWater =
          e.y > l.pool.y - r * 0.5 &&
          e.y < l.pool.y + l.pool.depth + r * 0.5 &&
          e.x > l.pool.x + l.edgeGuard &&
          e.x < l.pool.x + l.pool.shear + l.pool.len * 1.04 + r
        if (onWater) {
          const c = this.ribbonCenter()
          g.state = 'drag'
          g.x = c.x
          g.y = c.y + r * 0.5
          this.grab = 'none'
        }
      }
    } else if (e.phase === 'move' && this.grab === 'grid') {
      const guard = guardEdge(e.x, e.y, l.knife.tipX, l.knife.tipY, l.edgeGuard)
      g.x = guard.x
      g.y = guard.y
      if (g.state === 'submerged') {
        this.lowestGridY = Math.max(this.lowestGridY, g.y)
        if (this.lowestGridY - g.y > 26 * l.ui) this.beginLift()
      }
    } else if (e.phase === 'up' && this.grab === 'grid') {
      this.grab = 'none'
      if (g.state === 'submerged') this.releaseTimer = 0
    }
  }

  private inputReplay(e: PointerEventLite): void {
    if (e.phase === 'down') {
      this.pressedCard = this.cards.findIndex((c) => hitCard(c, e.x, e.y, 14))
      this.grab = this.pressedCard >= 0 ? 'card' : 'none'
    } else if (e.phase === 'up' && this.grab === 'card') {
      const i = this.cards.findIndex((c) => hitCard(c, e.x, e.y, 24))
      if (i >= 0 && i === this.pressedCard) {
        this.sfx.stopHum()
        this.world.tem.active = false
        if (i === 0) {
          this.resetForCut()
          this.fire('replaySame')
        } else if (i === 1) {
          this.fire('replayOther')
        } else {
          this.resetForCut()
          this.fire('replayFree')
        }
      }
      this.pressedCard = -1
      this.grab = 'none'
    }
  }

  /** One tap from the reward screen puts the child straight back on the lever. */
  private resetForCut(): void {
    const w = this.world
    w.sections = []
    w.active = null
    w.ribbon = createRibbonShape()
    w.ripples.length = 0
    w.droplets.length = 0
    w.sparkles.length = 0
    w.grid.state = 'home'
    w.grid.submerge = 0
    w.grid.carry = 0
    w.grid.lift = 0
    w.grid.insert = 0
    w.grid.tilt = 0
    w.staticEvent = { armed: false, fired: false, t: 0 }
    w.lever.value = 0
    w.lever.armed = true
    w.lever.autoActive = false
    w.block.travel = 0
    w.block.seat = 1
    w.block.seated = true
    w.water.level = 1
    w.water.touched = true
    w.chimeDone = true
    this.resetGridHome()
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    const w = this.world
    w.time += dt
    w.phaseT += dt
    w.sinceInput += dt
    w.dropperPress = approach(w.dropperPress, 0, 6, dt)
    w.eyelash.blocked = approach(w.eyelash.blocked, 0, 4, dt)
    w.flash = approach(w.flash, 0, 3, dt)
    w.water = stepWater(w.water, dt)

    this.trackFps(dt)
    this.updateParticles(dt)

    switch (w.phase) {
      case 'choose':
        this.cards = cardSlots(w.layout, 3)
        break
      case 'mount':
        this.updateMount(dt)
        break
      case 'water':
        this.updateWater(dt)
        break
      case 'cut':
      case 'free':
        this.updateCut(dt)
        break
      case 'tidy':
        // No more cutting while tidying: an accidental bar tap must not undo the
        // very thing the child is being asked to do.
        w.lever.value = approach(w.lever.value, 0, 4.5, dt)
        w.block.travel = w.lever.value * w.layout.block.travel
        this.updateSections(dt)
        this.updateTidy(dt)
        break
      case 'pickup':
        this.updateSections(dt)
        this.updatePickup(dt)
        break
      case 'tem':
        this.updateTem(dt)
        break
      case 'replay':
        this.cards = cardSlots(w.layout, 3)
        // Hold the reward image still behind the cards instead of drifting past it.
        w.tem.zoomPrev = w.tem.zoom
        w.tem.zoom = approach(w.tem.zoom, temZoom(11.4), 0.5, dt)
        break
    }
  }

  private trackFps(dt: number): void {
    const w = this.world
    const fps = 1 / Math.max(0.0005, dt)
    this.fpsAvg = this.fpsAvg * 0.94 + fps * 0.06
    this.fpsTimer += dt
    if (!this.downgraded && this.fpsTimer > 2.5 && this.fpsAvg < 44) {
      w.quality = 'low'
      this.downgraded = true
    }
  }

  private updateParticles(dt: number): void {
    const w = this.world
    const l = w.layout
    for (let i = w.ripples.length - 1; i >= 0; i--) {
      const r = w.ripples[i]
      r.r += dt * (r.soft ? 34 : 58) * l.ui
      r.a -= dt * (r.soft ? 0.5 : 0.75)
      if (r.a <= 0 || r.r > r.max) w.ripples.splice(i, 1)
    }
    for (let i = w.droplets.length - 1; i >= 0; i--) {
      const d = w.droplets[i]
      d.vy += 900 * l.ui * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.life -= dt * 0.75
      const surf = surfacePoint(l, w.water.level, 0.3, 0.5).y
      if (d.y > surf && d.vy > 0) {
        this.addRipple(clamp01((d.x - l.pool.x) / l.pool.len), 0.42 + rng() * 0.24, 0.5)
        w.droplets.splice(i, 1)
        continue
      }
      if (d.life <= 0) w.droplets.splice(i, 1)
    }
    for (let i = w.sparkles.length - 1; i >= 0; i--) {
      const s = w.sparkles[i]
      s.life -= dt
      s.y -= dt * 14 * l.ui
      if (s.life <= 0) w.sparkles.splice(i, 1)
    }
  }

  private addRipple(u: number, v: number, strength: number): void {
    const w = this.world
    if (w.quality === 'low' && w.ripples.length > 8) return
    if (w.ripples.length > 26) return
    w.ripples.push({
      u,
      v,
      r: 2,
      max: (26 + 44 * strength) * w.layout.ui * poolScale(v),
      a: 0.5 + 0.5 * strength,
      soft: strength < 0.55,
    })
  }

  private addSparkle(x: number, y: number, hue: number): void {
    const w = this.world
    if (w.sparkles.length > 34) return
    w.sparkles.push({ x, y, r: 10 * w.layout.ui, life: 0.85, max: 0.85, hue })
  }

  private updateMount(dt: number): void {
    const w = this.world
    this.introT += dt
    const home = this.blockHome()
    if (!w.block.dragging && w.block.seat < 0.01) {
      const k = 1 - Math.exp(-dt * 5)
      w.block.dragX += (home.x - w.block.dragX) * k
      w.block.dragY += (home.y - w.block.dragY) * k
    }
    if (w.block.seated) {
      this.seatTimer += dt
      w.block.seat = clamp01(this.seatTimer / 0.5)
      // A little self-levelling wobble, then the faces are parallel.
      w.block.tilt = Math.sin(this.seatTimer * 16) * 0.06 * Math.exp(-this.seatTimer * 4)
      if (this.seatTimer > 1.15) {
        w.block.tilt = 0
        this.sfx.sparkle(2)
        this.fire('blockSeated')
      }
    } else if (this.introT > 5 && w.sinceInput > 4.5) {
      // Never a dead end: after a long pause the block seats itself.
      this.seatBlock()
    }
  }

  private updateWater(dt: number): void {
    const w = this.world
    if (this.grab === 'dropper') {
      this.holdTimer += dt
      if (this.holdTimer > 0.34) {
        this.holdTimer = 0
        this.squeeze()
      }
    }
    this.autoWaterTimer += dt
    if (w.sinceInput > 4 && this.autoWaterTimer > 0.9 && !meniscusReached(w.water)) {
      this.autoWaterTimer = 0
      this.squeeze()
    }
    if (meniscusReached(w.water) && !w.chimeDone) {
      w.chimeDone = true
      w.water.agitation = 0
      this.sfx.chime()
      const l = w.layout
      for (let i = 0; i < 5; i++) {
        const p = surfacePoint(l, 1, 0.02 + i * 0.02, 0.1 + i * 0.18)
        this.addSparkle(p.x, p.y, 0.55 + i * 0.05)
      }
      this.addRipple(0.02, 0.5, 0.35)
    }
    if (w.chimeDone) this.chimeTimer += dt
    // Wait for any surplus to wick back before starting, so the child sees the
    // surface settle by itself.
    if (w.chimeDone && this.chimeTimer > 1 && w.water.level <= WATER_IDEAL + 0.015) {
      this.fire('meniscusReady')
    }
  }

  private updateCut(dt: number): void {
    const w = this.world
    const l = w.layout

    if (w.lever.autoActive) {
      w.lever.auto += dt
      const t = w.lever.auto
      if (t < 1.0) w.lever.value = easeInOutSine(t / 1.0)
      else if (t < 1.15) w.lever.value = 1
      else if (t < 1.75) w.lever.value = 1 - easeInOutSine((t - 1.15) / 0.6)
      else {
        w.lever.value = 0
        w.lever.autoActive = false
      }
    } else if (!w.lever.grabbed) {
      // The lever always returns on its own, so the block cannot be left stranded.
      w.lever.value = approach(w.lever.value, 0, 4.5, dt)
    }

    const prevTravel = w.block.travel
    w.block.travel = w.lever.value * l.block.travel
    const speed = Math.abs(w.block.travel - prevTravel) / Math.max(dt, 0.0001) / Math.max(1, l.block.travel)
    w.cutSpeed = approach(w.cutSpeed, clamp(speed, 0, 3), 8, dt)
    w.cutJitter = approach(w.cutJitter, Math.abs(w.lever.velocity) * 0.02, 3, dt)

    const blockTop = l.block.restY + w.block.travel
    const peel = facePeel(blockTop, l.block.h, l.knife.tipY)

    if (peel <= 0) w.lever.armed = true

    if (peel > 0 && !w.active && w.lever.armed && w.sections.length < (w.freeMode ? MAX_RIBBON + 4 : MAX_RIBBON)) {
      const thickness = w.freeMode
        ? 0.1 + rng() * 0.85
        : clamp(0.16 + w.cutSpeed * 0.5 + (rng() - 0.5) * 0.1, 0.12, 0.7)
      w.active = createSection(w.nextSectionId++, thickness, w.freeMode && rng() < 0.4)
      w.lever.armed = false
    }

    if (w.active) {
      const before = w.active.peel
      w.active.peel = Math.max(w.active.peel, peel)
      w.active.shimmer += dt * 2.2
      if (w.active.peel > before + 0.0005) {
        w.sliceSound += w.active.peel - before
        if (w.sliceSound > 0.34) {
          w.sliceSound = 0
          this.sfx.slice(clamp01(w.cutSpeed))
        }
        // Ripples trail the leading edge once it is on the water.
        if (w.active.peel > 0.2 && rng() < 0.28) {
          this.addRipple((w.active.peel * l.section.len) / l.pool.len, 0.1, 0.35)
        }
      }
      if (w.active.peel >= 0.999) this.releaseSection(w.active)
    }

    this.updateSections(dt)

    // Never a dead end: if nothing has been touched for a while the machine takes
    // a stroke by itself, so the ribbon keeps growing and the child keeps watching.
    if (w.sinceInput > 5 && !w.active && !w.lever.autoActive && !w.lever.grabbed) {
      w.lever.autoActive = true
      w.lever.auto = 0
      w.sinceInput = 2
    }

    if (!w.freeMode && w.phase === 'cut' && !w.active && w.sections.length >= TARGET_SECTIONS) {
      this.fire('ribbonComplete')
    }
  }

  private releaseSection(s: Section): void {
    const w = this.world
    const l = w.layout
    s.phase = 'landing'
    s.peel = 1
    s.wobble = 1
    s.flow = 1
    for (const other of w.sections) other.slotTarget += 1
    s.slotTarget = 0
    s.slot = -0.55
    w.sections.push(s)
    w.active = null
    w.ribbon = { ...w.ribbon, amplitude: waveFromStroke(w.cutSpeed, w.cutJitter) }
    this.sfx.release()
    for (let i = 0; i < 3; i++) {
      this.addRipple(0.02 + i * 0.03 + (l.section.len * 0.5) / l.pool.len, 0.09 + i * 0.05, 0.85 - i * 0.2)
    }
    const p = surfacePoint(l, w.water.level, (l.section.len * 0.5) / l.pool.len, 0.12)
    this.addSparkle(p.x, p.y, s.thickness)
  }

  private updateSections(dt: number): void {
    const w = this.world
    for (let i = w.sections.length - 1; i >= 0; i--) {
      const s = w.sections[i]
      s.age += dt
      s.slot = approach(s.slot, s.slotTarget, 5.5, dt)
      s.spread = approach(s.spread, 1, 3.4, dt)
      s.flow = approach(s.flow, 0, 6, dt)
      s.wobble = approach(s.wobble, 0, 1.6, dt)
      s.shimmer += dt * (0.7 + s.wobble * 2.4)
      s.lift = approach(s.lift, s.liftTarget, 2.6, dt)
      if (s.liftTarget > 0.05) s.lift += Math.sin(w.time * 3.4 + s.id) * 0.02
      if (s.phase === 'landing' && s.spread > 0.994) s.phase = 'floating'
      // Slices pushed past the far end of the boat quietly float away — never a loss.
      if (s.slotTarget >= MAX_RIBBON) {
        s.fade = approach(s.fade, 0, 1.1, dt)
        if (s.fade < 0.02) w.sections.splice(i, 1)
      }
    }
  }

  private armStatic(): void {
    const w = this.world
    if (w.sections.length === 0) return
    w.staticEvent = { armed: true, fired: true, t: 0 }
    const picks = Math.min(2, w.sections.length)
    for (let i = 0; i < picks; i++) {
      const s = w.sections[Math.floor(rng() * w.sections.length)]
      s.liftTarget = 0.55 + rng() * 0.4
    }
    this.sfx.sparkle(1)
  }

  private updateTidy(dt: number): void {
    const w = this.world
    const l = w.layout
    w.staticEvent.t += dt
    w.ionizer.blow = approach(w.ionizer.blow, this.grab === 'ionizer' ? 1 : 0, this.grab === 'ionizer' ? 6 : 1.1, dt)

    if (w.ionizer.blow > 0.25) {
      if (rng() < dt * 6) this.sfx.breeze()
      for (const s of w.sections) {
        const p = placeSection(l, w.ribbon, w.water.level, s)
        const d = dist(p.x, p.y, w.ionizer.home ? l.tools.ionizer.x : w.ionizer.x, w.ionizer.home ? l.tools.ionizer.y : w.ionizer.y)
        if (d < l.pool.len * 0.55) {
          s.liftTarget = approach(s.liftTarget, 0, 2.4 * w.ionizer.blow, dt)
          if (s.lift < 0.12 && s.liftTarget < 0.05 && rng() < dt * 3) {
            this.addRipple(clamp01((p.x - l.pool.x) / l.pool.len), p.v, 0.4)
          }
        }
      }
    }

    if (this.grab === 'eyelash') {
      // The lash never touches a slice: it stirs the water, and the water tidies.
      let near = 0
      for (const s of w.sections) {
        const p = placeSection(l, w.ribbon, w.water.level, s)
        const d = dist(p.x, p.y, w.eyelash.x, w.eyelash.y)
        near = Math.max(near, 1 - clamp01(d / (l.pool.depth * 0.9)))
      }
      if (near > 0.02) {
        w.ribbon = relaxShape(w.ribbon, dt, near)
        if (rng() < dt * 4) this.addRipple(clamp01((w.eyelash.x - l.pool.x) / l.pool.len), clamp01((w.eyelash.y - l.pool.y) / l.pool.depth), 0.3)
      }
    }

    // Gentle auto-assist so a child who only watches still moves on.
    if (w.staticEvent.t > 4) for (const s of w.sections) s.liftTarget = approach(s.liftTarget, 0, 1.4, dt)
    if (w.staticEvent.t > 6) w.ribbon = relaxShape(w.ribbon, dt, 0.6)

    const settled = w.sections.every((s) => s.lift < 0.06)
    // A half-cut film must finish its journey onto the water before we move on.
    if (w.active) {
      w.active.peel = Math.min(1, w.active.peel + dt * 1.6)
      if (w.active.peel >= 0.999) this.releaseSection(w.active)
      return
    }
    if (settled && (isTidy(w.ribbon) || w.phaseT > 9)) this.fire('ribbonTidy')
  }

  private beginLift(): void {
    const w = this.world
    if (w.grid.state !== 'submerged') return
    w.grid.state = 'lifting'
    w.grid.lift = 0
    this.sfx.pickup()
    const l = w.layout
    for (let i = 0; i < 7; i++) {
      w.droplets.push({
        x: w.grid.x + (rng() - 0.5) * l.tools.grid.r * 2,
        y: w.grid.y + l.tools.grid.r * 0.4,
        vx: (rng() - 0.5) * 40 * l.ui,
        vy: 40 * l.ui + rng() * 90 * l.ui,
        r: (2 + rng() * 2.6) * l.ui,
        life: 1,
      })
    }
    this.addRipple(clamp01((w.grid.x - l.pool.x) / l.pool.len), clamp01((w.grid.y - l.pool.y) / l.pool.depth), 1)
  }

  private ribbonCenter(): { x: number; y: number } {
    const w = this.world
    const l = w.layout
    if (w.sections.length === 0) return surfacePoint(l, w.water.level, 0.3, 0.5)
    let sx = 0
    let sy = 0
    for (const s of w.sections) {
      const p = placeSection(l, w.ribbon, w.water.level, s)
      sx += p.x
      sy += p.y
    }
    return { x: sx / w.sections.length, y: sy / w.sections.length }
  }

  private updatePickup(dt: number): void {
    const w = this.world
    const l = w.layout
    const g = w.grid
    const r = l.tools.grid.r

    if (g.state === 'drag') {
      // A grid left hanging in mid-air drifts over the boat by itself.
      if (this.grab !== 'grid' && w.sinceInput > 2.2) {
        const c = this.ribbonCenter()
        g.x = approach(g.x, c.x, 2.4, dt)
        g.y = approach(g.y, c.y + r * 0.5, 2.4, dt)
      }
      const inPool =
        g.x > l.pool.x + l.edgeGuard * 0.8 &&
        g.x < l.pool.x + l.pool.len + l.pool.shear &&
        g.y > l.pool.y + l.pool.depth * 0.12
      if (inPool) {
        g.state = 'submerged'
        this.lowestGridY = g.y
        this.sfx.ripple()
        this.addRipple(clamp01((g.x - l.pool.x) / l.pool.len), clamp01((g.y - l.pool.y) / l.pool.depth), 0.9)
      }
    }

    if (g.state === 'submerged') {
      g.submerge = approach(g.submerge, 1, 5, dt)
      // Gentle magnetism: the mesh lines itself up under the ribbon.
      const c = this.ribbonCenter()
      const k = this.grab === 'grid' ? 1.1 : 3.4
      g.x = approach(g.x, c.x, k, dt)
      g.y = approach(g.y, c.y + r * 0.5, k, dt)
      g.tilt = approach(g.tilt, -0.16, 3, dt)
      if (this.grab !== 'grid') {
        this.releaseTimer += dt
        if (this.releaseTimer > 1.1) this.beginLift()
      } else if (w.sinceInput > 1.6) {
        // Holding the mesh still under the ribbon also lifts it.
        this.beginLift()
      }
    } else if (g.state === 'lifting') {
      g.lift = clamp01(g.lift + dt / 0.9)
      const c = this.ribbonCenter()
      const targetY = l.pool.y - l.pool.depth * 0.12
      g.x = lerp(c.x, l.tem.x, smoothstep(0.4, 1, g.lift) * 0.25)
      g.y = lerp(c.y + r * 0.5, targetY, easeInOutSine(g.lift))
      g.submerge = approach(g.submerge, 0.22, 4, dt)
      g.tilt = approach(g.tilt, 0.0, 3, dt)
      g.carry = clamp01((g.lift - 0.15) / 0.5)
      for (const s of w.sections) s.fade = approach(s.fade, 0, 3.2, dt)
      if (g.lift > 0.35 && rng() < dt * 8) {
        w.droplets.push({
          x: g.x + (rng() - 0.5) * r * 1.6,
          y: g.y + r * 0.5,
          vx: 0,
          vy: 30 * l.ui,
          r: (1.6 + rng() * 2) * l.ui,
          life: 1,
        })
      }
      if (g.lift >= 1) {
        g.state = 'carrying'
        // Remember the ribbon the child actually made, so the same slices ride
        // out on the mesh instead of a couple of generic blobs.
        w.carried = w.sections.map((x) => x.thickness)
        w.sections = []
        this.releaseTimer = 0
      }
    } else if (g.state === 'carrying') {
      if (this.grab !== 'grid') {
        this.releaseTimer += dt
        const k = this.releaseTimer > 1.2 ? 2.2 : 0.6
        g.x = approach(g.x, l.tem.x, k, dt)
        g.y = approach(g.y, l.tem.y + l.tem.r * 0.5, k, dt)
        if (dist(g.x, g.y, l.tem.x, l.tem.y + l.tem.r * 0.5) < r * 0.5) g.state = 'inserted'
      } else {
        this.releaseTimer = 0
        if (dist(g.x, g.y, l.tem.x, l.tem.y + l.tem.r * 0.5) < l.tem.r * 0.9) g.state = 'inserted'
      }
    } else if (g.state === 'inserted') {
      g.insert = clamp01(g.insert + dt / 0.55)
      g.x = approach(g.x, l.tem.x, 6, dt)
      g.y = approach(g.y, l.tem.y + l.tem.r * 0.5, 6, dt)
      if (g.insert >= 1) this.fire('ribbonLifted')
    } else if (g.state === 'home') {
      g.submerge = approach(g.submerge, 0, 4, dt)
    }
  }

  private updateTem(dt: number): void {
    const w = this.world
    w.tem.t += dt
    w.tem.zoomPrev = w.tem.zoom
    w.tem.zoom = temZoom(w.tem.t)
    if (w.tem.t >= 12) this.fire('revealDone')
  }

  // ---------------------------------------------------------------- draw

  draw(ctx: Ctx): void {
    const w = this.world
    const l = w.layout
    ctx.clearRect(0, 0, l.w, l.h)

    if (w.phase === 'tem' || w.phase === 'replay') {
      const fade = w.phase === 'tem' ? clamp01(w.tem.t / 0.8) : 1
      // The workshop is only worth drawing while the reveal is still fading in.
      if (fade < 1) {
        drawBackground(ctx, w)
        this.drawWorkshop(ctx)
      }
      drawTem(ctx, w, this.temScene, fade)
      if (w.phase === 'replay') {
        ctx.fillStyle = 'rgba(6,10,16,0.42)'
        ctx.fillRect(0, 0, l.w, l.h)
        this.cards.forEach((c, i) => {
          drawReplayCard(ctx, w, c, i === 0 ? 'same' : i === 1 ? 'other' : 'free', this.pressedCard === i)
        })
        // "Cut this one again" breathes first, so the easiest way back is obvious.
        if (w.sinceInput > 3.2 && this.cards[0]) {
          const c0 = this.cards[0]
          hintRing(ctx, c0.cx, c0.cy, Math.min(c0.w, c0.h) * 0.26, w.time, '255,226,190')
        }
      }
      drawMute(ctx, w)
      return
    }

    drawBackground(ctx, w)
    this.drawWorkshop(ctx)

    if (w.phase === 'choose') {
      ctx.fillStyle = 'rgba(6,10,16,0.55)'
      ctx.fillRect(0, 0, l.w, l.h)
      this.cards.forEach((c, i) => drawChooseCard(ctx, w, c, i, this.pressedCard === i))
      if (w.sinceInput > 3.2) {
        // The three trays take it in turns to breathe: pick any one of us.
        const i = Math.floor(w.time / 1.9) % this.cards.length
        const c = this.cards[i]
        if (c) hintRing(ctx, c.cx, c.cy, Math.min(c.w, c.h) * 0.26, w.time, '255,226,190')
      }
    }

    drawMute(ctx, w)
  }

  /** Everything that lives on the bench, in strict back-to-front order. */
  private drawWorkshop(ctx: Ctx): void {
    const w = this.world
    const l = w.layout
    const phase = w.phase

    drawConsole(ctx, w)
    drawFrame(ctx, w)
    drawKnifeAndBoat(ctx, w)
    drawWater(ctx, w)
    drawRipples(ctx, w)

    // The mesh is under the water while it is dipped, and above everything once
    // it is on its way out. It is drawn in exactly one of the two, always.
    const gridUnder = w.grid.state === 'submerged' && w.grid.submerge > 0.05
    if (gridUnder) drawGrid(ctx, w, 0.62)

    const sorted = [...w.sections].sort(
      (a, b) => slotLateral(w.ribbon, a.slot) - slotLateral(w.ribbon, b.slot),
    )
    drawRibbonBase(ctx, w)
    for (const s of sorted) drawFloatingSection(ctx, w, s)
    drawRibbonSeams(ctx, w)

    drawKnifeEdge(ctx, w)

    // The guide shows where the block belongs *before* it is seated, and fades as
    // the faces come parallel.
    if (phase === 'mount') drawAlignmentGuide(ctx, w, 1 - clamp01(w.block.seat * 1.6))
    drawArm(ctx, w)
    if (phase !== 'choose') drawBlock(ctx, w)
    // The film that is being cut right now lies on top of the block face, so it
    // is the very last thing drawn on the machine.
    if (w.active) drawPeelingSection(ctx, w, w.active)

    drawDroplets(ctx, w)
    drawSparkles(ctx, w)

    if (!gridUnder && (phase === 'pickup' || w.grid.state !== 'home')) drawGrid(ctx, w, 1)

    // Tool bar: only the tool that matters right now is bright.
    if (phase === 'water') drawDropper(ctx, w, 1)
    if (phase === 'cut' || phase === 'tidy' || phase === 'free') drawLever(ctx, w, phase === 'tidy' ? 0.45 : 1)
    if (phase === 'tidy') {
      drawIonizer(ctx, w, 1)
      drawEyelash(ctx, w, 1)
    }
    if (phase === 'pickup') {
      drawTemPort(ctx, w, w.grid.state === 'carrying' || w.grid.state === 'inserted' ? 1 : 0.35)
    }
    if (phase === 'free') {
      const hx = l.w - l.insets.right - 34 * l.ui
      const hy = l.top + 30 * l.ui
      drawHomeButton(ctx, w, hx, hy, 28 * l.ui)
      if (w.sinceInput > 6) hintRing(ctx, hx, hy, 34 * l.ui, w.time, '200,224,250')
    }

    // Non-verbal "your turn" nudges.
    if (w.sinceInput > 3.2) {
      if (phase === 'mount' && w.block.seat < 0.01) {
        const seat = this.blockSeatPoint()
        hintRing(ctx, seat.x, seat.y, l.block.w * 0.8, w.time)
        hintRing(ctx, w.block.dragX, w.block.dragY, l.block.w * 0.7, w.time + 0.6, '255,214,232')
      }
      if (phase === 'pickup' && (w.grid.state === 'home' || w.grid.state === 'drag')) {
        hintRing(ctx, w.grid.x, w.grid.y, l.tools.grid.r * 1.5, w.time, '255,226,190')
        const target = this.ribbonCenter()
        hintRing(ctx, target.x, target.y, l.section.width * 1.4, w.time + 0.9, '180,235,250')
      }
      if (phase === 'pickup' && w.grid.state === 'carrying') {
        hintRing(ctx, l.tem.x, l.tem.y + l.tem.r * 0.56, l.tem.r * 0.9, w.time, '170,240,220')
      }
      if (phase === 'water') {
        const p = surfacePoint(l, w.water.level, 0.06, 0.16)
        hintRing(ctx, p.x, p.y, 18 * l.ui, w.time + 1.2, '190,236,255')
      }
      if (phase === 'cut' || phase === 'free') {
        // Point at the knob, which is the thing that can actually be touched.
        const t = l.tools.lever
        hintRing(ctx, t.x, lerp(t.trackTop, t.trackBottom, w.lever.value), t.r * 1.5, w.time + 1.2, '190,236,255')
      }
    }
  }

  /** Screen-space anchors, exposed only so the screenshot audit can play the game. */
  debug(): Record<string, unknown> {
    const w = this.world
    const l = w.layout
    return {
      phase: w.phase,
      w: l.w,
      h: l.h,
      orientation: l.orientation,
      quality: w.quality,
      fps: Math.round(this.fpsAvg),
      sections: w.sections.length,
      sectionInfo: w.sections.map((s) => ({
        thickness: s.thickness,
        band: band(s.thickness),
        lift: s.lift,
        slot: s.slot,
        spread: s.spread,
      })),
      activePeel: w.active ? w.active.peel : -1,
      waterLevel: w.water.level,
      cards: this.cards.map((c) => ({ x: c.cx, y: c.cy })),
      block: { x: w.block.dragX, y: w.block.dragY, seat: w.block.seat },
      seat: this.blockSeatPoint(),
      dropper: { x: l.tools.dropper.x, y: l.tools.dropper.y },
      lever: { x: l.tools.lever.x, top: l.tools.lever.trackTop, bottom: l.tools.lever.trackBottom },
      ionizer: { x: l.tools.ionizer.x, y: l.tools.ionizer.y },
      eyelash: { x: l.tools.eyelash.x, y: l.tools.eyelash.y },
      grid: { x: w.grid.x, y: w.grid.y, state: w.grid.state },
      tem: { x: l.tem.x, y: l.tem.y },
      ribbonCenter: this.ribbonCenter(),
      pool: l.pool,
      knife: l.knife,
      temT: w.tem.t,
    }
  }
}
