import './style.css'
import { Game } from './core/game'

const canvas = document.getElementById('scene') as HTMLCanvasElement
const uiRoot = document.getElementById('ui') as HTMLElement

function fail(msg: string) {
  uiRoot.innerHTML = `<div class="layer on"><div class="scrim"></div><div class="stack">
    <div class="title"><span class="sub">ごめんね</span><span class="main">がめんが つかえません</span></div>
    <div class="credit">${msg}</div></div></div>`
}

try {
  const test = document.createElement('canvas')
  const ok = !!(test.getContext('webgl2') || test.getContext('webgl'))
  if (!ok) throw new Error('WebGL not available')
  const game = new Game(canvas, uiRoot)
  game.start()
  // 動作確認用（本番でも害はない小さな窓口）
  Object.defineProperty(window, '__game', { value: game })
  // iOS で 100vh がずれる問題への保険
  const fixVh = () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
  }
  fixVh()
  window.addEventListener('resize', fixVh)
} catch (e) {
  fail(String((e as Error)?.message ?? e))
}
