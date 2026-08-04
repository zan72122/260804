export interface PointerSample {
  id: number
  x: number
  y: number
  px: number
  py: number
  downX: number
  downY: number
  age: number
  moved: number
}

export type PointerPhase = 'down' | 'move' | 'up'

export interface PointerEventLite extends PointerSample {
  phase: PointerPhase
}

type Handler = (e: PointerEventLite) => void

/** A primary pointer that has not moved for this long may be taken over. */
const STALE_AFTER = 1.2

/**
 * Single-primary-pointer input. A second finger never interrupts a live drag —
 * but a contact that has gone quiet (a palm or a forgotten thumb resting on the
 * glass) hands control to the next finger, so the game can never be locked out.
 */
export class PointerInput {
  private active: PointerSample | null = null
  private idle = 0
  private handlers: Handler[] = []
  private el: HTMLElement
  private toLocal: (clientX: number, clientY: number) => { x: number; y: number }

  constructor(el: HTMLElement, toLocal: (clientX: number, clientY: number) => { x: number; y: number }) {
    this.el = el
    this.toLocal = toLocal
    el.addEventListener('pointerdown', this.onDown, { passive: false })
    el.addEventListener('pointermove', this.onMove, { passive: false })
    el.addEventListener('pointerup', this.onUp, { passive: false })
    el.addEventListener('pointercancel', this.onUp, { passive: false })
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
  }

  on(h: Handler): void {
    this.handlers.push(h)
  }

  get current(): PointerSample | null {
    return this.active
  }

  private emit(phase: PointerPhase, s: PointerSample): void {
    for (const h of this.handlers) h({ ...s, phase })
  }

  private onDown = (ev: PointerEvent): void => {
    ev.preventDefault()
    if (this.active) {
      if (this.idle < STALE_AFTER) return
      // The old contact has gone quiet; let it go and give this finger the game.
      const stale = this.active
      this.active = null
      this.emit('up', stale)
    }
    const p = this.toLocal(ev.clientX, ev.clientY)
    this.active = {
      id: ev.pointerId,
      x: p.x,
      y: p.y,
      px: p.x,
      py: p.y,
      downX: p.x,
      downY: p.y,
      age: 0,
      moved: 0,
    }
    this.idle = 0
    try {
      this.el.setPointerCapture(ev.pointerId)
    } catch {
      /* capture is best effort */
    }
    this.emit('down', this.active)
  }

  private onMove = (ev: PointerEvent): void => {
    if (!this.active || ev.pointerId !== this.active.id) return
    ev.preventDefault()
    const p = this.toLocal(ev.clientX, ev.clientY)
    const a = this.active
    a.px = a.x
    a.py = a.y
    a.x = p.x
    a.y = p.y
    const step = Math.hypot(a.x - a.px, a.y - a.py)
    a.moved += step
    if (step > 0.6) this.idle = 0
    this.emit('move', a)
  }

  private onUp = (ev: PointerEvent): void => {
    if (!this.active || ev.pointerId !== this.active.id) return
    ev.preventDefault()
    const a = this.active
    this.emit('up', a)
    this.active = null
    try {
      this.el.releasePointerCapture(ev.pointerId)
    } catch {
      /* ignore */
    }
  }

  tick(dt: number): void {
    if (this.active) {
      this.active.age += dt
      this.idle += dt
    }
  }
}
