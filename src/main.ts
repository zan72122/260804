import { Game } from './game/game'
import { PointerInput } from './core/pointer'
import type { Insets } from './game/layout'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D

function readInsets(): Insets {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
    'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const v = (s: string): number => {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : 0
  }
  const out: Insets = {
    top: v(cs.paddingTop),
    right: v(cs.paddingRight),
    bottom: v(cs.paddingBottom),
    left: v(cs.paddingLeft),
  }
  probe.remove()
  return out
}

function viewportSize(): { w: number; h: number } {
  const vv = window.visualViewport
  return {
    w: Math.round(vv ? vv.width : window.innerWidth),
    h: Math.round(vv ? vv.height : window.innerHeight),
  }
}

let dpr = 1
const size = viewportSize()
const game = new Game(size.w, size.h, readInsets())

function applySize(): void {
  const { w, h } = viewportSize()
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  // Keep the backing store under ~3.2 MP: past that even an iPad Pro drops frames
  // on a full-screen canvas, and the extra pixels buy nothing at arm's length.
  const budget = 3.2e6
  if (w * h * dpr * dpr > budget) dpr = Math.max(1, Math.sqrt(budget / (w * h)))
  canvas.width = Math.max(1, Math.round(w * dpr))
  canvas.height = Math.max(1, Math.round(h * dpr))
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  game.resize(w, h, readInsets())
}

applySize()

if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  game.world.reduceMotion = true
  game.world.quality = 'low'
}

const input = new PointerInput(canvas, (cx, cy) => {
  const r = canvas.getBoundingClientRect()
  return { x: cx - r.left, y: cy - r.top }
})
input.on((e) => game.onPointer(e))

let last = performance.now()
let raf = 0

function frame(now: number): void {
  raf = requestAnimationFrame(frame)
  // A tab that has been in the background must not fast-forward the workshop, but
  // the clamp has to stay loose enough that a slow device does not run in slow
  // motion — otherwise the reveal would crawl instead of dive.
  const dt = Math.min(0.12, Math.max(0.0005, (now - last) / 1000))
  last = now
  input.tick(dt)
  // `__pause` exists purely so the screenshot audit can freeze a moment and
  // capture it without the clock running on during the capture.
  if (!(window as unknown as { __pause?: boolean }).__pause) game.update(dt)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  game.draw(ctx)
}

raf = requestAnimationFrame(frame)

let resizeTimer = 0
function scheduleResize(): void {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(applySize, 60)
}

window.addEventListener('resize', scheduleResize)
window.addEventListener('orientationchange', () => {
  scheduleResize()
  window.setTimeout(applySize, 320)
})
window.visualViewport?.addEventListener('resize', scheduleResize)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') last = performance.now()
})

window.addEventListener('pagehide', () => cancelAnimationFrame(raf))

// Exposed purely so the screenshot audit can drive the game deterministically.
;(window as unknown as { __game?: Game }).__game = game
