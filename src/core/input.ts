import { Vector2 } from 'three'

export interface PointerSample {
  id: number
  /** NDC -1..1 */
  ndc: Vector2
  /** 前フレームからの NDC 移動量 */
  delta: Vector2
  /** CSS px */
  px: Vector2
  pxDelta: Vector2
  downAt: number
  startPx: Vector2
  /** 押してから動いた総距離(px) */
  travel: number
  moved: boolean
}

export interface SwipeEvent {
  dx: number
  dy: number
  /** px/秒 */
  speed: number
  duration: number
}

type Listener<T> = (e: T) => void

/**
 * Pointer Events を一本化した入力層。
 * iOS Safari では touch-action:none と preventDefault を両方やらないと
 * ページごとスクロール／ズームしてしまうので、両方入れてある。
 */
export class Input {
  readonly pointers = new Map<number, PointerSample>()
  private el: HTMLElement
  private downCbs: Listener<PointerSample>[] = []
  private moveCbs: Listener<PointerSample>[] = []
  private upCbs: Listener<PointerSample>[] = []
  private swipeCbs: Listener<SwipeEvent>[] = []
  private tapCbs: Listener<PointerSample>[] = []
  private firstGestureCbs: (() => void)[] = []
  private gotFirstGesture = false
  /** 直近の軌跡（速度推定用） */
  private trails = new Map<number, { t: number; x: number; y: number }[]>()

  constructor(el: HTMLElement) {
    this.el = el
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', this.handleDown, { passive: false })
    el.addEventListener('pointermove', this.handleMove, { passive: false })
    window.addEventListener('pointerup', this.handleUp, { passive: false })
    window.addEventListener('pointercancel', this.handleUp, { passive: false })
    // iOS のダブルタップズーム／ピンチを止める
    el.addEventListener('gesturestart', prevent as EventListener, { passive: false })
    el.addEventListener('touchmove', prevent as EventListener, { passive: false })
    document.addEventListener('dblclick', prevent as EventListener, { passive: false })
  }

  onDown(cb: Listener<PointerSample>) { this.downCbs.push(cb) }
  onMove(cb: Listener<PointerSample>) { this.moveCbs.push(cb) }
  onUp(cb: Listener<PointerSample>) { this.upCbs.push(cb) }
  onSwipe(cb: Listener<SwipeEvent>) { this.swipeCbs.push(cb) }
  onTap(cb: Listener<PointerSample>) { this.tapCbs.push(cb) }
  onFirstGesture(cb: () => void) { this.firstGestureCbs.push(cb) }

  get primary(): PointerSample | undefined {
    for (const p of this.pointers.values()) return p
    return undefined
  }

  get isDown() { return this.pointers.size > 0 }

  /** 毎フレーム末に呼ぶ。delta を消費済みにする */
  endFrame() {
    for (const p of this.pointers.values()) {
      p.delta.set(0, 0)
      p.pxDelta.set(0, 0)
    }
  }

  private toNdc(e: PointerEvent, out: Vector2) {
    const r = this.el.getBoundingClientRect()
    out.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    return out
  }

  private handleDown = (e: PointerEvent) => {
    e.preventDefault()
    if (!this.gotFirstGesture) {
      this.gotFirstGesture = true
      for (const cb of this.firstGestureCbs) cb()
    }
    try { this.el.setPointerCapture(e.pointerId) } catch { /* noop */ }
    const ndc = this.toNdc(e, new Vector2())
    const s: PointerSample = {
      id: e.pointerId,
      ndc,
      delta: new Vector2(),
      px: new Vector2(e.clientX, e.clientY),
      pxDelta: new Vector2(),
      downAt: performance.now(),
      startPx: new Vector2(e.clientX, e.clientY),
      travel: 0,
      moved: false,
    }
    this.pointers.set(e.pointerId, s)
    this.trails.set(e.pointerId, [{ t: s.downAt, x: e.clientX, y: e.clientY }])
    for (const cb of this.downCbs) cb(s)
  }

  private handleMove = (e: PointerEvent) => {
    const s = this.pointers.get(e.pointerId)
    if (!s) return
    e.preventDefault()
    const prev = s.ndc.clone()
    this.toNdc(e, s.ndc)
    s.delta.add(s.ndc.clone().sub(prev))
    const dx = e.clientX - s.px.x
    const dy = e.clientY - s.px.y
    s.pxDelta.add(new Vector2(dx, dy))
    s.px.set(e.clientX, e.clientY)
    s.travel += Math.hypot(dx, dy)
    if (s.travel > 8) s.moved = true
    const tr = this.trails.get(e.pointerId)!
    tr.push({ t: performance.now(), x: e.clientX, y: e.clientY })
    if (tr.length > 12) tr.shift()
    for (const cb of this.moveCbs) cb(s)
  }

  private handleUp = (e: PointerEvent) => {
    const s = this.pointers.get(e.pointerId)
    if (!s) return
    e.preventDefault?.()
    const now = performance.now()
    const tr = this.trails.get(e.pointerId) ?? []
    this.pointers.delete(e.pointerId)
    this.trails.delete(e.pointerId)
    for (const cb of this.upCbs) cb(s)

    const dur = (now - s.downAt) / 1000
    if (!s.moved && dur < 0.6) {
      for (const cb of this.tapCbs) cb(s)
      return
    }
    // 末尾 ~120ms の平均速度でフリックを判定する
    let ref = tr[0]
    for (let i = tr.length - 1; i >= 0; i--) {
      if (now - tr[i].t > 120) break
      ref = tr[i]
    }
    if (!ref) return
    const dt = Math.max(0.016, (now - ref.t) / 1000)
    const dx = e.clientX - ref.x
    const dy = e.clientY - ref.y
    const dist = Math.hypot(dx, dy)
    const speed = dist / dt
    const totalDist = Math.hypot(e.clientX - s.startPx.x, e.clientY - s.startPx.y)
    if (totalDist > 24) {
      for (const cb of this.swipeCbs) cb({ dx: e.clientX - s.startPx.x, dy: e.clientY - s.startPx.y, speed, duration: dur })
    }
  }
}

function prevent(e: Event) {
  if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 1) e.preventDefault()
  else if (e.type !== 'touchmove') e.preventDefault()
  else e.preventDefault()
}

/**
 * 指の「ぐるぐる」を角度に変える。中心のまわりの符号付き角度を積算する。
 * 円でもジグザグでも、ある程度回っていれば進む寛容な作り。
 */
export class CircleTracker {
  private lastAngle: number | null = null
  /** ラジアン積算（符号つき） */
  total = 0
  /** 直近の角速度 rad/s */
  speed = 0
  private lastT = 0

  reset() {
    this.lastAngle = null
    this.speed = 0
  }

  update(cx: number, cy: number, px: number, py: number, now: number) {
    const a = Math.atan2(py - cy, px - cx)
    if (this.lastAngle === null) {
      this.lastAngle = a
      this.lastT = now
      return 0
    }
    let d = a - this.lastAngle
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    // 中心のごく近くはノイズになるので効きを弱める
    const r = Math.hypot(px - cx, py - cy)
    const w = Math.min(1, r / 40)
    d *= w
    this.lastAngle = a
    const dt = Math.max(0.008, (now - this.lastT) / 1000)
    this.lastT = now
    this.speed = d / dt
    this.total += d
    return d
  }
}
