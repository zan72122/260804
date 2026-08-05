import { GRIMES, LIGHTS, WEATHERS, WEATHER_ORDER, type GrimeId, type WeatherId } from '../core/palette'
import { TOTAL_LANDINGS } from '../core/state'

export type HintKind = 'none' | 'door' | 'climb' | 'window' | 'rub' | 'gear' | 'crank' | 'lever' | 'watch'

const HINTS: Record<Exclude<HintKind, 'none'>, { glyph: string; word: string; cls: string; pos: [number, number] }> = {
  door:   { glyph: '👆', word: 'とびらを あける', cls: 'tap',  pos: [50, 62] },
  climb:  { glyph: '👆', word: 'うえへ すーっ',   cls: 'up',   pos: [50, 66] },
  window: { glyph: '🪟', word: 'まどを あける',   cls: 'tap',  pos: [50, 58] },
  rub:    { glyph: '🧽', word: 'きゅっ きゅっ',   cls: 'rub',  pos: [50, 74] },
  gear:   { glyph: '⚙️', word: 'ここへ はこぶ',   cls: 'tap',  pos: [50, 72] },
  crank:  { glyph: '🔄', word: 'ぐるぐる まわす', cls: 'turn', pos: [50, 74] },
  lever:  { glyph: '👇', word: 'ガチャン',        cls: 'down', pos: [50, 72] },
  watch:  { glyph: '✨', word: '',                cls: 'tap',  pos: [50, 82] },
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  return e
}

export interface UiCallbacks {
  onStart: (w: WeatherId, grime: GrimeId, light: number) => void
  onRelight: () => void
  onNewNight: () => void
  onFreePlay: () => void
  onToggleSound: (on: boolean) => void
  onHome: () => void
}

export class Ui {
  private root: HTMLElement
  private cb: UiCallbacks

  private titleLayer = el('div', 'layer')
  private endLayer = el('div', 'layer')
  private hint = el('div', 'hint')
  private hintGlyph = el('div', 'glyph')
  private hintWord = el('div', 'word')
  private topbar = el('div', 'topbar')
  private soundBtn = el('button', 'icon-btn', '🔊')
  private homeBtn = el('button', 'icon-btn hidden', '🏠')
  private foundRow = el('div', 'found-row')
  private climb = el('div', 'climb')
  private climbFill = el('div', 'fill')
  private climbKnob = el('div', 'knob', '🧣')
  private polish = el('div', 'polish')
  private polishBar = el('i')
  private toast = el('div', 'toast')
  private flash = el('div', 'flash')

  private selWeather: WeatherId = 'clear'
  private selGrime: GrimeId = 'salt'
  private selLight = 0
  private toastTimer = 0

  constructor(root: HTMLElement, cb: UiCallbacks) {
    this.root = root
    this.cb = cb
    this.buildTitle()
    this.buildEnd()
    this.buildOverlays()
  }

  // ---------------- タイトル ----------------

  private buildTitle() {
    const scrim = el('div', 'scrim')
    const stack = el('div', 'stack')

    stack.appendChild(
      el('div', 'title', `<span class="sub">のぼって！みがいて！</span><span class="main">ひかりの灯台</span>`),
    )

    const wRow = el('div', 'chips')
    const wChips: HTMLElement[] = []
    WEATHER_ORDER.forEach((id) => {
      const w = WEATHERS[id]
      const c = el('button', 'chip', `<span>${w.icon}</span><span class="cap">${w.label}</span>`)
      c.addEventListener('click', () => {
        this.selWeather = id
        wChips.forEach((x, i) => x.classList.toggle('sel', WEATHER_ORDER[i] === id))
      })
      wChips.push(c)
      wRow.appendChild(c)
    })
    wChips[0].classList.add('sel')
    stack.appendChild(wRow)

    const gRow = el('div', 'chips')
    const gChips: HTMLElement[] = []
    GRIMES.forEach((g, i) => {
      const c = el('button', 'chip', `<span>${g.icon}</span><span class="cap">${g.label}</span>`)
      c.addEventListener('click', () => {
        this.selGrime = g.id
        gChips.forEach((x, k) => x.classList.toggle('sel', k === i))
      })
      gChips.push(c)
      gRow.appendChild(c)
    })
    gChips[0].classList.add('sel')
    stack.appendChild(gRow)

    const lRow = el('div', 'chips')
    const lChips: HTMLElement[] = []
    LIGHTS.forEach((l, i) => {
      const c = el('button', 'chip', `<span>${l.icon}</span><span class="cap">${l.label}</span>`)
      c.addEventListener('click', () => {
        this.selLight = i
        lChips.forEach((x, k) => x.classList.toggle('sel', k === i))
      })
      lChips.push(c)
      lRow.appendChild(c)
    })
    lChips[0].classList.add('sel')
    stack.appendChild(lRow)

    const play = el('button', 'big', '🗼 <span>はじめる</span>')
    play.addEventListener('click', () => {
      this.hideTitle()
      this.cb.onStart(this.selWeather, this.selGrime, this.selLight)
    })
    stack.appendChild(play)
    stack.appendChild(el('div', 'credit', 'ゆびで あそべます'))

    this.titleLayer.appendChild(scrim)
    this.titleLayer.appendChild(stack)
    this.root.appendChild(this.titleLayer)
  }

  showTitle() {
    this.titleLayer.classList.add('on')
    this.endLayer.classList.remove('on')
    this.homeBtn.classList.add('hidden')
    this.setHint('none')
    this.setClimb(-1)
    this.setPolish(-1)
  }

  hideTitle() {
    this.titleLayer.classList.remove('on')
    this.homeBtn.classList.remove('hidden')
  }

  // ---------------- おわりのメニュー ----------------

  private endTitle = el('div', 'title')

  private buildEnd() {
    this.endLayer.id = 'end-layer'
    const scrim = el('div', 'scrim')
    const stack = el('div', 'stack')
    this.endTitle.innerHTML = `<span class="sub">ふねが みつけた</span><span class="main">ひかりが とどいた！</span>`
    stack.appendChild(this.endTitle)

    const again = el('button', 'big', '💡 <span>もういちど つける</span>')
    again.addEventListener('click', () => {
      this.hideEnd()
      this.cb.onRelight()
    })
    const other = el('button', 'big alt', '🌫️ <span>べつの よる</span>')
    other.addEventListener('click', () => {
      this.hideEnd()
      this.cb.onNewNight()
    })
    const free = el('button', 'big alt2', '🎠 <span>じゆうに あそぶ</span>')
    free.addEventListener('click', () => {
      this.hideEnd()
      this.cb.onFreePlay()
    })
    const row = el('div', 'row')
    row.appendChild(again)
    row.appendChild(other)
    row.appendChild(free)
    stack.appendChild(row)

    this.endLayer.appendChild(scrim)
    this.endLayer.appendChild(stack)
    this.root.appendChild(this.endLayer)
  }

  showEnd(shipCount: number) {
    this.endTitle.innerHTML = `<span class="sub">${'⛵'.repeat(Math.max(1, shipCount))} が ひかりを みつけた</span><span class="main">よるの うみが ひかった！</span>`
    this.endLayer.classList.add('on')
    this.setHint('none')
  }

  hideEnd() {
    this.endLayer.classList.remove('on')
  }

  // ---------------- 常設のもの ----------------

  private buildOverlays() {
    this.hint.appendChild(this.hintGlyph)
    this.hint.appendChild(this.hintWord)
    this.root.appendChild(this.hint)

    this.soundBtn.addEventListener('click', () => {
      const on = this.soundBtn.textContent === '🔇'
      this.soundBtn.textContent = on ? '🔊' : '🔇'
      this.cb.onToggleSound(on)
    })
    this.homeBtn.addEventListener('click', () => this.cb.onHome())

    const left = el('div')
    left.appendChild(this.homeBtn)
    const right = el('div')
    right.appendChild(this.soundBtn)
    this.topbar.appendChild(left)
    this.topbar.appendChild(this.foundRow)
    this.topbar.appendChild(right)
    this.root.appendChild(this.topbar)

    this.climb.appendChild(this.climbFill)
    this.climb.appendChild(this.climbKnob)
    this.climb.appendChild(el('div', 'top-mark', '🔦'))
    this.root.appendChild(this.climb)

    this.polish.appendChild(el('div', 'em', '🧽'))
    const bar = el('div', 'bar')
    bar.appendChild(this.polishBar)
    this.polish.appendChild(bar)
    this.root.appendChild(this.polish)

    this.root.appendChild(this.toast)
    this.root.appendChild(this.flash)
  }

  setHint(kind: HintKind) {
    if (kind === 'none') {
      this.hint.classList.remove('on')
      return
    }
    const h = HINTS[kind]
    this.hintGlyph.textContent = h.glyph
    this.hintWord.textContent = h.word
    this.hint.className = `hint on ${h.cls}`
    this.hint.style.left = `${h.pos[0]}%`
    this.hint.style.top = `${h.pos[1]}%`
  }

  /** -1 で非表示。0..1 で高さ */
  setClimb(t: number) {
    if (t < 0) {
      this.climb.classList.remove('on')
      return
    }
    this.climb.classList.add('on')
    const pct = Math.max(0, Math.min(1, t)) * 100
    this.climbFill.style.height = `${pct}%`
    this.climbKnob.style.bottom = `calc(${pct}% - ${0}px)`
  }

  setPolish(t: number) {
    if (t < 0) {
      this.polish.classList.remove('on')
      return
    }
    this.polish.classList.add('on')
    this.polishBar.style.width = `${Math.max(0, Math.min(1, t)) * 100}%`
  }

  addFound(icon: string) {
    const f = el('div', 'f', icon)
    this.foundRow.appendChild(f)
    if (this.foundRow.children.length > TOTAL_LANDINGS) this.foundRow.removeChild(this.foundRow.children[0])
  }

  clearFound() {
    this.foundRow.innerHTML = ''
  }

  showToast(icon: string, text: string, ms = 1900) {
    this.toast.innerHTML = `<span style="font-size:1.4em">${icon}</span><span>${text}</span>`
    this.toast.classList.add('on')
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('on'), ms)
  }

  /** 点灯の瞬間のやわらかい白フラッシュ（高速点滅はしない） */
  softFlash(strength = 0.5) {
    this.flash.style.transition = 'opacity 0.12s ease-out'
    this.flash.style.opacity = String(strength)
    window.setTimeout(() => {
      this.flash.style.transition = 'opacity 1.4s ease-out'
      this.flash.style.opacity = '0'
    }, 130)
  }

  setSoundIcon(on: boolean) {
    this.soundBtn.textContent = on ? '🔊' : '🔇'
  }
}
