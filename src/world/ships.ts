import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three'
import { Ocean } from './ocean'
import { TOWER } from './lighthouse'
import { clamp01, damp, PALETTE } from '../core/palette'

export type ShipKind = 'boat' | 'liner' | 'fishing'

let _glowTex: CanvasTexture | null = null
function glowTexture() {
  if (_glowTex) return _glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.22, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  _glowTex = new CanvasTexture(c)
  return _glowTex
}

function std(color: number, rough = 0.75, metal = 0, emissive = 0x000000) {
  return new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive })
}

export class Ship {
  readonly group = new Group()
  readonly kind: ShipKind
  x: number
  z: number
  heading: number
  safeHeading: number
  speed = 0
  found = false
  guided = false
  replyTimer = 0
  private windows: MeshStandardMaterial[] = []
  private signal: Mesh
  private signalMat: MeshStandardMaterial
  private signalGlow: Sprite
  private lamps: Sprite[] = []
  private hull: Group
  private wake: Mesh
  private lostWander = Math.random() * Math.PI * 2
  onFound?: (s: Ship) => void

  constructor(kind: ShipKind, x: number, z: number, safeHeading: number) {
    this.kind = kind
    this.x = x
    this.z = z
    this.safeHeading = safeHeading
    this.heading = safeHeading + (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.7)
    this.hull = new Group()
    this.group.add(this.hull)

    if (kind === 'liner') this.buildLiner()
    else if (kind === 'fishing') this.buildFishing()
    else this.buildBoat()

    // 灯台へ返す合図の灯り
    this.signalMat = std(0xfff0c0, 0.4, 0, 0x221800)
    this.signal = new Mesh(new SphereGeometry(0.28, 10, 8), this.signalMat)
    this.signal.position.set(0, this.mastHeight, 0)
    this.hull.add(this.signal)
    this.signalGlow = new Sprite(new SpriteMaterial({ map: glowTexture(), color: 0xfff0c0, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }))
    this.signalGlow.scale.setScalar(5)
    this.signalGlow.position.copy(this.signal.position)
    this.hull.add(this.signalGlow)

    // 航跡
    this.wake = new Mesh(
      new PlaneGeometry(2.2, 9),
      new MeshBasicMaterial({ map: glowTexture(), color: 0xcfe0f5, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    )
    this.wake.rotation.x = -Math.PI / 2
    this.wake.position.set(0, 0.12, -5.5)
    this.wake.renderOrder = 3
    this.hull.add(this.wake)

    this.group.scale.setScalar(kind === 'liner' ? 1.5 : kind === 'fishing' ? 1.05 : 0.85)
  }

  private mastHeight = 3

  private addLamp(pos: Vector3, color: number, size: number) {
    const s = new Sprite(new SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }))
    s.scale.setScalar(size)
    s.position.copy(pos)
    this.hull.add(s)
    this.lamps.push(s)
  }

  private buildBoat() {
    const hullMat = std(0xf3ede4, 0.8)
    const h = new Mesh(new SphereGeometry(1, 14, 10, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), hullMat)
    h.scale.set(1.15, 1.1, 3.0)
    h.position.y = 0.5
    this.hull.add(h)
    const stripe = new Mesh(new TorusGeometry(1.1, 0.09, 6, 18), std(PALETTE.coatPink, 0.7))
    stripe.rotation.x = Math.PI / 2
    stripe.scale.set(1.0, 2.7, 1)
    stripe.position.y = 0.62
    this.hull.add(stripe)
    const cabinMat = std(0xfff6e2, 0.7, 0, 0x000000)
    const cabin = new Mesh(new BoxGeometry(1.2, 0.85, 1.5), cabinMat)
    cabin.position.set(0, 1.1, -0.2)
    this.hull.add(cabin)
    const win = std(0xffdf9a, 0.3, 0, 0x000000)
    this.windows.push(win)
    const w = new Mesh(new BoxGeometry(1.24, 0.34, 1.1), win)
    w.position.set(0, 1.2, -0.2)
    this.hull.add(w)
    const mast = new Mesh(new CylinderGeometry(0.045, 0.05, 2.4, 6), std(0x8a6350, 0.8))
    mast.position.set(0, 2.2, -0.2)
    this.hull.add(mast)
    this.mastHeight = 3.35
    this.addLamp(new Vector3(0, 1.2, 0.6), 0xffcf7a, 3.2)
  }

  private buildLiner() {
    const hullMat = std(0x2f3b63, 0.75)
    const h = new Mesh(new SphereGeometry(1, 16, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), hullMat)
    h.scale.set(1.5, 1.2, 5.2)
    h.position.y = 0.55
    this.hull.add(h)
    const deck = new Mesh(new BoxGeometry(2.6, 0.25, 8.6), std(0xfaf4ea, 0.8))
    deck.position.y = 1.2
    this.hull.add(deck)
    const win = std(0xffe6a8, 0.3)
    this.windows.push(win)
    for (let lvl = 0; lvl < 3; lvl++) {
      const w = 2.4 - lvl * 0.35
      const l = 7.4 - lvl * 1.5
      const body = new Mesh(new BoxGeometry(w, 0.62, l), std(0xfffaf0, 0.75))
      body.position.set(0, 1.6 + lvl * 0.82, -lvl * 0.35)
      this.hull.add(body)
      const strip = new Mesh(new BoxGeometry(w + 0.04, 0.24, l - 0.4), win)
      strip.position.set(0, 1.68 + lvl * 0.82, -lvl * 0.35)
      this.hull.add(strip)
    }
    for (const s of [-1, 1]) {
      const funnel = new Mesh(new CylinderGeometry(0.36, 0.42, 1.3, 12), std(0xff8fb1, 0.6))
      funnel.position.set(s * 0.6, 4.6, -1.2)
      this.hull.add(funnel)
      const cap = new Mesh(new CylinderGeometry(0.38, 0.38, 0.16, 12), std(0x39406b, 0.6))
      cap.position.set(s * 0.6, 5.3, -1.2)
      this.hull.add(cap)
    }
    this.mastHeight = 6.0
    this.addLamp(new Vector3(0, 2.0, 4.0), 0xfff0c0, 4.5)
    this.addLamp(new Vector3(-1.4, 2.6, 0), 0xff8f8f, 3.0)
    this.addLamp(new Vector3(1.4, 2.6, 0), 0x9fffb2, 3.0)
  }

  private buildFishing() {
    const hullMat = std(0x3f6f6a, 0.85)
    const h = new Mesh(new SphereGeometry(1, 14, 10, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), hullMat)
    h.scale.set(1.25, 1.15, 3.6)
    h.position.y = 0.5
    this.hull.add(h)
    const cabin = new Mesh(new BoxGeometry(1.5, 1.1, 1.7), std(0xf0e3cf, 0.8))
    cabin.position.set(0, 1.2, -1.0)
    this.hull.add(cabin)
    const win = std(0xffe0a0, 0.3)
    this.windows.push(win)
    const w = new Mesh(new BoxGeometry(1.54, 0.36, 1.3), win)
    w.position.set(0, 1.42, -1.0)
    this.hull.add(w)
    const mast = new Mesh(new CylinderGeometry(0.05, 0.06, 3.4, 6), std(0x7a5a3a, 0.85))
    mast.position.set(0, 2.4, 0.4)
    this.hull.add(mast)
    // 網の腕
    for (const s of [-1, 1]) {
      const arm = new Mesh(new CylinderGeometry(0.04, 0.04, 3.0, 5), std(0x7a5a3a, 0.85))
      arm.position.set(s * 0.9, 2.6, 0.4)
      arm.rotation.z = s * 0.55
      this.hull.add(arm)
    }
    const flag = new Mesh(new ConeGeometry(0.22, 0.5, 4), std(0xffc7e6, 0.6))
    flag.position.set(0, 4.0, 0.4)
    this.hull.add(flag)
    this.mastHeight = 4.2
    this.addLamp(new Vector3(0, 1.5, 1.2), 0xffd27a, 3.4)
    this.addLamp(new Vector3(0, 3.6, 0.4), 0x9fe8ff, 2.6)
  }

  /** ビームに照らされているか */
  private inBeam(beamAngle: number, strength: number) {
    if (strength < 0.25) return false
    const a = Math.atan2(this.z, this.x)
    for (let i = 0; i < 2; i++) {
      let d = a - (beamAngle + i * Math.PI)
      d = Math.atan2(Math.sin(d), Math.cos(d))
      if (Math.abs(d) < 0.2) return true
    }
    return false
  }

  update(dt: number, time: number, swell: number, beamAngle: number, beamStrength: number, night: number) {
    if (!this.found && this.inBeam(beamAngle, beamStrength)) {
      this.found = true
      this.replyTimer = 0.9 + Math.random() * 1.2
      this.onFound?.(this)
    }

    // 見つかる前はゆらゆら迷っている。見つかったら正しい航路へ。
    let target: number
    if (this.found) {
      target = this.safeHeading
      this.speed = damp(this.speed, 3.4, 0.6, dt)
    } else {
      this.lostWander += dt * 0.35
      target = this.heading + Math.sin(this.lostWander) * 0.02
      this.speed = damp(this.speed, 0.75, 0.5, dt)
    }
    let d = target - this.heading
    d = Math.atan2(Math.sin(d), Math.cos(d))
    this.heading += d * Math.min(1, dt * (this.found ? 0.55 : 0.4))

    this.x += Math.cos(this.heading) * this.speed * dt
    this.z += Math.sin(this.heading) * this.speed * dt

    // 遠くへ行きすぎたら反対側から戻す（夜がずっと続く）
    const r = Math.hypot(this.x, this.z)
    if (r > 330) {
      const a = Math.atan2(this.z, this.x) + Math.PI + (Math.random() - 0.5) * 0.8
      const nr = 150 + Math.random() * 90
      this.x = Math.cos(a) * nr
      this.z = Math.sin(a) * nr
      this.safeHeading = Math.atan2(-this.z, -this.x) + (Math.random() > 0.5 ? 1.15 : -1.15)
      this.heading = this.safeHeading + (Math.random() > 0.5 ? 1 : -1) * 1.1
      this.found = false
      this.guided = false
    }
    // 灯台に近づきすぎない
    if (r < 34) {
      const push = Math.atan2(this.z, this.x)
      this.x += Math.cos(push) * 8 * dt
      this.z += Math.sin(push) * 8 * dt
    }

    const y = Ocean.heightAt(this.x, this.z, time, swell)
    const yF = Ocean.heightAt(this.x + Math.cos(this.heading) * 3, this.z + Math.sin(this.heading) * 3, time, swell)
    const yS = Ocean.heightAt(this.x - Math.sin(this.heading) * 3, this.z + Math.cos(this.heading) * 3, time, swell)
    this.group.position.set(this.x, y - 0.35, this.z)
    this.group.rotation.y = -this.heading + Math.PI / 2
    this.hull.rotation.x = Math.atan2(yF - y, 3) * 0.9
    this.hull.rotation.z = -Math.atan2(yS - y, 3) * 0.9

    // 灯り：夜ほど明るく、見つかったらいっそう明るく
    const lampBase = 0.25 + night * 0.55
    const lit = this.found ? 1 : 0.55
    for (const l of this.lamps) {
      (l.material as SpriteMaterial).opacity = lampBase * lit
    }
    for (const w of this.windows) {
      w.emissive.setRGB(0.95, 0.78, 0.42)
      w.emissiveIntensity = (0.25 + night * 0.9) * lit
    }

    // 合図の返事（ぴかっ、ぴかっ）
    if (this.found) {
      this.replyTimer -= dt
      const blink = this.replyTimer <= 0 ? (Math.sin(time * 5.2) > 0.35 ? 1 : 0.06) : 0.06
      this.signalMat.emissive.setRGB(1, 0.93, 0.72)
      this.signalMat.emissiveIntensity = blink * 3.2
      ;(this.signalGlow.material as SpriteMaterial).opacity = blink * 0.75
      if (this.replyTimer <= 0 && !this.guided) this.guided = true
    } else {
      this.signalMat.emissiveIntensity = 0.05
      ;(this.signalGlow.material as SpriteMaterial).opacity = 0
    }

    ;(this.wake.material as MeshBasicMaterial).opacity = clamp01(this.speed / 4) * 0.35
  }
}

export class Fleet {
  readonly group = new Group()
  readonly ships: Ship[] = []
  onGuided?: (s: Ship) => void
  private guidedCount = 0

  constructor() {
    const specs: [ShipKind, number, number][] = [
      ['boat', 150, -1.1],
      ['liner', 235, 2.3],
      ['fishing', 185, 0.4],
      ['boat', 205, 3.6],
      ['fishing', 265, 5.1],
    ]
    for (const [kind, dist, ang] of specs) {
      const x = Math.cos(ang) * dist
      const z = Math.sin(ang) * dist
      const safe = Math.atan2(-z, -x) + (Math.random() > 0.5 ? 1.2 : -1.2)
      const s = new Ship(kind, x, z, safe)
      s.onFound = (sh) => this.onGuided?.(sh)
      this.ships.push(s)
      this.group.add(s.group)
    }
  }

  get guided() { return this.guidedCount }

  reset() {
    this.guidedCount = 0
    for (const s of this.ships) {
      s.found = false
      s.guided = false
    }
  }

  update(dt: number, time: number, swell: number, beamAngle: number, beamStrength: number, night: number) {
    let g = 0
    for (const s of this.ships) {
      s.update(dt, time, swell, beamAngle, beamStrength, night)
      if (s.found) g++
    }
    this.guidedCount = g
  }

  /** カメラから見て一番の「見せ場」になる船 */
  focusTarget(): Vector3 | null {
    let best: Ship | null = null
    let bestD = Infinity
    for (const s of this.ships) {
      if (!s.found) continue
      const d = Math.hypot(s.x, s.z)
      if (d < bestD) { bestD = d; best = s }
    }
    if (!best) {
      for (const s of this.ships) {
        const d = Math.hypot(s.x, s.z)
        if (d < bestD) { bestD = d; best = s }
      }
    }
    return best ? new Vector3(best.x, TOWER.lensY * 0.06, best.z) : null
  }

  /** 灯台から見た、その船の方角 */
  static bearing(s: Ship) {
    return Math.atan2(s.z, s.x)
  }

  nearestBearing(): number {
    let best = 0
    let bestD = Infinity
    for (const s of this.ships) {
      if (s.found) continue
      const d = Math.hypot(s.x, s.z)
      if (d < bestD) { bestD = d; best = Fleet.bearing(s) }
    }
    return best
  }
}

export const SHIP_ICON: Record<ShipKind, string> = {
  boat: '⛵',
  liner: '🛳️',
  fishing: '🚤',
}

export function shipHornKind(k: ShipKind): 0 | 1 | 2 {
  return k === 'liner' ? 1 : k === 'fishing' ? 2 : 0
}

export const SHIP_LIGHT_COLOR = new Color(0xffe2a0)
