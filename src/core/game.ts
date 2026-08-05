import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PointLight,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { Input, CircleTracker, type PointerSample, type SwipeEvent } from './input'
import { Sound } from './audio'
import { GameState, TOTAL_LANDINGS, loadSave, writeSave, type Phase } from './state'
import {
  GRIMES,
  LIGHTS,
  WEATHERS,
  WEATHER_ORDER,
  clamp,
  clamp01,
  damp,
  lerp,
  smoothstep,
  type GrimeId,
  type WeatherId,
} from './palette'
import { Sky } from '../world/sky'
import { Ocean } from '../world/ocean'
import { Weather } from '../world/weather'
import {
  DOOR_ANGLE,
  LANDINGS,
  Lighthouse,
  STAIRS,
  TOWER,
  makeGull,
  makeIsland,
  stairPose,
} from '../world/lighthouse'
import { Keeper } from '../world/keeper'
import { Lens } from '../world/lens'
import { MACHINE, Machinery } from '../world/machinery'
import { Beam } from '../world/beam'
import { Fleet, shipHornKind, type Ship } from '../world/ships'
import { Ui, type HintKind } from '../ui/ui'

interface Pose {
  pos: Vector3
  look: Vector3
  fov: number
}

const LENS_PERIOD = 8.0 // 秒／一回転

export class Game {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: PerspectiveCamera
  private input: Input
  private sound = new Sound()
  private ui: Ui
  readonly state = new GameState()
  private save = loadSave()

  private sky: Sky
  private ocean: Ocean
  private weather: Weather
  private house: Lighthouse
  private lens: Lens
  private machinery: Machinery
  private beam: Beam
  private fleet: Fleet
  private keeper: Keeper
  private birds: { obj: Group; r: number; y: number; a: number; sp: number }[] = []
  private island: Group

  private sun: DirectionalLight
  private hemi: HemisphereLight
  private ambient: AmbientLight
  private keeperLamp: PointLight

  private quality: number
  private pixelCap: number
  private raycaster = new Raycaster()
  private clock = 0
  private last = 0
  private running = true
  private frameAcc = 0
  private frameN = 0

  // カメラ
  private camPos = new Vector3()
  private camLook = new Vector3()
  private targetPose: Pose
  private poseSnap = false

  // 階段
  private stepTarget = 0
  private stepShown = 0
  private lastStepSound = 0
  private visitedLanding = -1
  private openedShutters = new Set<number>()

  // 各種インタラクション
  private circle = new CircleTracker()
  private dragging: 'none' | 'polish' | 'gear' | 'crank' | 'lever' = 'none'
  private lastDrag: 'none' | 'polish' | 'gear' | 'crank' | 'lever' = 'none'
  private gearDragOffset = new Vector3()
  private leverStartY = 0
  private lensSpin = 0
  private lensSpinSpeed = 0
  private beaconTime = 0
  private endShown = false
  private hintTimer = 0
  private curHint: HintKind = 'none'
  private orbitAngle = 0
  private freeOrbit = { a: 0.6, h: 0.25, r: 1 }
  private doorOpen = 0
  private glowPulse = 0

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixels = window.innerWidth * window.innerHeight * dpr * dpr
    const cores = navigator.hardwareConcurrency ?? 4
    this.quality = pixels > 3.4e6 || cores <= 4 ? 0.5 : 0.85
    this.pixelCap = this.quality > 0.6 ? Math.min(dpr, 2) : Math.min(dpr, 1.6)

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.quality > 0.6,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    })
    this.renderer.setPixelRatio(this.pixelCap)
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap

    this.camera = new PerspectiveCamera(58, 1, 0.15, 2200)
    this.scene.fog = new FogExp2(0x2a2740, 0.0022)

    // --- world ---
    this.sky = new Sky()
    this.scene.add(this.sky.mesh)
    this.ocean = new Ocean(this.quality)
    this.scene.add(this.ocean.mesh)

    this.house = new Lighthouse(this.quality)
    this.scene.add(this.house.group)
    this.island = makeIsland(this.house.interior)
    this.scene.add(this.island)

    this.lens = new Lens(this.house.interior, this.quality)
    this.house.lampRoom.add(this.lens.group)

    this.machinery = new Machinery(this.house.interior)
    this.house.lampRoom.add(this.machinery.group)

    this.beam = new Beam(this.quality)
    this.scene.add(this.beam.group)

    this.weather = new Weather(this.quality)
    this.scene.add(this.weather.motes, this.weather.precip)

    this.fleet = new Fleet()
    this.scene.add(this.fleet.group)
    this.fleet.onGuided = (s) => this.onShipFound(s)

    this.keeper = new Keeper(this.house.interior)
    this.scene.add(this.keeper.group)

    this.buildBirds()

    // --- lights ---
    this.hemi = new HemisphereLight(0x9fb6e8, 0x2a2230, 0.5)
    this.scene.add(this.hemi)
    this.ambient = new AmbientLight(0xffffff, 0.16)
    this.scene.add(this.ambient)
    this.sun = new DirectionalLight(0xffb27a, 2.2)
    this.sun.castShadow = this.quality > 0.6
    this.sun.shadow.mapSize.set(this.quality > 0.6 ? 2048 : 1024, this.quality > 0.6 ? 2048 : 1024)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 220
    this.sun.shadow.camera.left = -34
    this.sun.shadow.camera.right = 34
    this.sun.shadow.camera.top = 60
    this.sun.shadow.camera.bottom = -14
    this.sun.shadow.bias = -0.0012
    this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target)

    this.keeperLamp = new PointLight(0xffd9ab, 0, 14, 1.7)
    this.scene.add(this.keeperLamp)

    // --- ui / input ---
    this.ui = new Ui(uiRoot, {
      onStart: (w, g, l) => this.startRun(w, g, l),
      onRelight: () => this.relight(),
      onNewNight: () => this.newNight(),
      onFreePlay: () => this.enterFreePlay(),
      onToggleSound: (on) => this.sound.setEnabled(on),
      onHome: () => this.goTitle(),
    })

    this.input = new Input(canvas)
    const wakeAudio = () => {
      this.sound.start()
      this.sound.resume()
    }
    this.input.onFirstGesture(wakeAudio)
    // タイトルのボタンは DOM なので、そちらの最初のタップでも音を起こす
    document.addEventListener('pointerdown', wakeAudio, { once: true, capture: true })
    this.input.onDown((p) => this.onDown(p))
    this.input.onMove((p) => this.onMove(p))
    this.input.onUp((p) => this.onUp(p))
    this.input.onTap((p) => this.onTap(p))
    this.input.onSwipe((e) => this.onSwipe(e))

    this.state.lightIndex = clamp(this.save.lightIndex, 0, LIGHTS.length - 1)
    this.state.duskT = 0
    this.targetPose = this.titlePose()
    this.camPos.copy(this.targetPose.pos)
    this.camLook.copy(this.targetPose.look)

    window.addEventListener('resize', () => this.resize())
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 220))
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden
      if (this.running) {
        this.last = performance.now()
        this.sound.resume()
      }
    })
    this.resize()

    this.lens.setGrime('salt')
    this.setPhase('title')
    this.ui.showTitle()
  }

  // -----------------------------------------------------------------------

  private buildBirds() {
    for (let i = 0; i < 7; i++) {
      const g = makeGull(1 + Math.random() * 0.5)
      const r = 22 + Math.random() * 40
      const y = 6 + Math.random() * 26
      this.birds.push({ obj: g, r, y, a: Math.random() * Math.PI * 2, sp: 0.09 + Math.random() * 0.13 })
      this.scene.add(g)
    }
  }

  private get aspect() {
    return window.innerWidth / Math.max(1, window.innerHeight)
  }

  private get portrait() {
    return this.aspect < 1.0
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setPixelRatio(this.pixelCap)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    // 画面が変わっても、のぼった段数・磨いた範囲・修理・点灯はそのまま
    this.refreshPose(true)
  }

  // ---------------- カメラの決め方（縦横で作り分ける） ----------------

  private titlePose(): Pose {
    const r = this.portrait ? 62 : 52
    const a = this.orbitAngle
    return {
      pos: new Vector3(Math.sin(a) * r, this.portrait ? 15 : 17, Math.cos(a) * r),
      look: new Vector3(0, this.portrait ? 21 : 19, 0),
      fov: this.portrait ? 56 : 48,
    }
  }

  private doorPose(): Pose {
    return {
      pos: new Vector3(0, 3.6, this.portrait ? 15.5 : 13.5),
      look: new Vector3(0, this.portrait ? 4.2 : 3.4, 4.6),
      fov: this.portrait ? 58 : 50,
    }
  }

  private stairsPose(): Pose {
    // 灯台守のうしろ姿を追う。らせんが見え、上っている実感が出る。
    const her = stairPose(this.stepShown)
    const back = stairPose(this.stepShown - (this.portrait ? 3.6 : 4.2))
    // 少し外（壁より）から、肩ごしに見下ろす。次に踏む段がちゃんと見える。
    const outR = (back.r + 0.5) / Math.max(0.001, back.r)
    const camY = Math.max(TOWER.baseY + 1.0, her.y + (this.portrait ? 1.5 : 1.35))
    const nod = stairPose(this.stepShown + 2.2)
    return {
      pos: new Vector3(back.x * outR, camY, back.z * outR),
      look: new Vector3(
        lerp(her.x, nod.x, 0.14),
        her.y + (this.portrait ? 1.02 : 0.95),
        lerp(her.z, nod.z, 0.14),
      ),
      fov: this.portrait ? 66 : 57,
    }
  }

  private lampPose(kind: 'arrive' | 'polish' | 'gear' | 'crank' | 'lever'): Pose {
    const F = TOWER.lampFloorY
    const wide = this.portrait ? 0 : 1
    switch (kind) {
      case 'arrive':
        return {
          pos: new Vector3(0.45, F + 1.85, 3.35 + wide * 0.15),
          look: new Vector3(0, TOWER.lensY - 0.2, 0),
          fov: this.portrait ? 64 : 56,
        }
      case 'polish': {
        const d = this.portrait ? 3.3 : 3.5
        return {
          pos: new Vector3(0, TOWER.lensY - 0.2, d),
          look: new Vector3(0, TOWER.lensY - 0.12, 0),
          fov: this.portrait ? 62 : 60,
        }
      }
      case 'gear':
        return {
          pos: new Vector3(0.45, F + 2.05, 3.4 + wide * 0.15),
          look: new Vector3(-1.62, F + 1.4, 1.55),
          fov: this.portrait ? 66 : 57,
        }
      case 'crank':
        return {
          pos: new Vector3(-0.5, F + 1.95, 3.35 + wide * 0.15),
          look: new Vector3(MACHINE.crank.x * 0.86, MACHINE.crank.y, MACHINE.crank.z + 0.1),
          fov: this.portrait ? 64 : 55,
        }
      case 'lever':
        return {
          pos: new Vector3(-0.75, F + 1.95, 3.4 + wide * 0.15),
          look: new Vector3(1.15, F + 1.12, 2.3),
          fov: this.portrait ? 64 : 55,
        }
    }
  }

  /** 点灯の見せ場：時間で動くカメラ */
  private beaconPose(t: number): Pose {
    const P = this.portrait
    const keys: { t: number; pos: Vector3; look: Vector3; fov: number }[] = [
      { t: 0.0, pos: new Vector3(-0.75, TOWER.lampFloorY + 1.95, 3.4), look: new Vector3(1.15, TOWER.lampFloorY + 1.12, 2.3), fov: P ? 64 : 55 },
      { t: 1.4, pos: new Vector3(0.0, TOWER.lensY - 0.15, 2.9), look: new Vector3(0, TOWER.lensY, 0), fov: P ? 62 : 56 },
      { t: 4.2, pos: new Vector3(1.8, TOWER.lensY + 1.2, 7.4), look: new Vector3(0, TOWER.lensY, 0), fov: P ? 60 : 52 },
      { t: 7.4, pos: new Vector3(P ? 15 : 21, TOWER.lensY + 3.4, P ? 22 : 27), look: new Vector3(0, P ? 22 : 25, 0), fov: P ? 58 : 50 },
      { t: 11.0, pos: new Vector3(P ? 34 : 46, 9.5, P ? 46 : 56), look: new Vector3(0, 24, 0), fov: P ? 56 : 48 },
      { t: 15.0, pos: new Vector3(P ? 22 : 32, 15.5, P ? 40 : 52), look: new Vector3(0, 20, 0), fov: P ? 56 : 47 },
      { t: 22.0, pos: new Vector3(P ? -26 : -38, 18.0, P ? 42 : 54), look: new Vector3(0, 22, 0), fov: P ? 56 : 47 },
    ]
    if (t >= keys[keys.length - 1].t) {
      // 最後はゆっくり回り続ける
      const a = this.orbitAngle
      const r = P ? 52 : 62
      return {
        pos: new Vector3(Math.sin(a) * r, 17 + Math.sin(a * 0.7) * 5, Math.cos(a) * r),
        look: new Vector3(0, 22, 0),
        fov: P ? 56 : 47,
      }
    }
    let i = 0
    while (i < keys.length - 2 && t > keys[i + 1].t) i++
    const a = keys[i]
    const b = keys[i + 1]
    const k = smoothstep(a.t, b.t, t)
    return {
      pos: a.pos.clone().lerp(b.pos, k),
      look: a.look.clone().lerp(b.look, k),
      fov: lerp(a.fov, b.fov, k),
    }
  }

  private freePose(): Pose {
    const o = this.freeOrbit
    const r = (this.portrait ? 46 : 40) * o.r
    return {
      pos: new Vector3(Math.sin(o.a) * r, 14 + o.h * 34, Math.cos(o.a) * r),
      look: new Vector3(0, 21, 0),
      fov: this.portrait ? 58 : 50,
    }
  }

  private refreshPose(snap = false) {
    switch (this.state.phase) {
      case 'title': this.targetPose = this.titlePose(); break
      case 'door': this.targetPose = this.doorPose(); break
      case 'stairs': this.targetPose = this.stairsPose(); break
      case 'lamproom': this.targetPose = this.lampPose('arrive'); break
      case 'polish': this.targetPose = this.lampPose('polish'); break
      case 'gear': this.targetPose = this.lampPose('gear'); break
      case 'crank': this.targetPose = this.lampPose('crank'); break
      case 'switch': this.targetPose = this.lampPose('lever'); break
      case 'beacon':
      case 'ships':
      case 'menu': this.targetPose = this.beaconPose(this.beaconTime); break
      case 'free': this.targetPose = this.freeMode === 'stairs' ? this.stairsPose() : this.freeMode === 'lamp' ? this.lampPose('polish') : this.freePose(); break
      default: this.targetPose = this.titlePose()
    }
    if (snap) this.poseSnap = true
  }

  // ---------------- 進行 ----------------

  private setPhase(p: Phase) {
    this.state.phase = p
    this.dragging = 'none'
    this.refreshPose()
    this.updateHintForPhase()
    this.machinery.setHints(p === 'gear' ? 'gear' : p === 'crank' ? 'crank' : p === 'switch' ? 'lever' : 'none')
    this.ui.setClimb(p === 'stairs' || (p === 'free' && this.freeMode === 'stairs') ? this.stepShown / STAIRS.count : -1)
    this.ui.setPolish(p === 'polish' ? this.lens.polished : -1)
  }

  private updateHintForPhase() {
    const map: Partial<Record<Phase, HintKind>> = {
      door: 'door',
      stairs: 'climb',
      polish: 'rub',
      gear: 'gear',
      crank: 'crank',
      switch: 'lever',
    }
    this.setHint(map[this.state.phase] ?? 'none')
  }

  private setHint(k: HintKind) {
    if (this.curHint === k) return
    this.curHint = k
    this.ui.setHint(k)
    this.hintTimer = 0
  }

  private startRun(w: WeatherId, g: GrimeId, light: number) {
    this.state.reset(w, g)
    this.state.lightIndex = light
    this.state.runCount = ++this.save.runs
    this.save.lightIndex = light
    if (!this.save.seenWeathers.includes(w)) this.save.seenWeathers.push(w)
    writeSave(this.save)

    this.lens.setGrime(g)
    this.weather.apply(WEATHERS[w])
    this.stepTarget = 0
    this.stepShown = 0
    this.visitedLanding = -1
    this.openedShutters.clear()
    this.beaconTime = 0
    this.endShown = false
    this.lensSpin = 0
    this.lensSpinSpeed = 0
    this.doorOpen = 0
    this.machinery.leverPull = 0
    this.machinery.crankAngle = 0
    this.crankProgress = 0
    this.ui.clearFound()
    this.fleet.reset()
    this.beam.strength = 0
    this.sound.lampOff()
    this.sound.resetPad()
    this.sound.setPad(0.16)
    this.setPhase('door')
    this.refreshPose(true)
  }

  private relight() {
    // 同じ夜にもう一度。汚れも歯車も戻して、また最初の点灯の手順を楽しめる。
    this.state.lit = false
    this.state.litTime = 0
    this.state.polished = 0
    this.state.crank = 0
    this.crankProgress = 0
    this.state.gearFixed = false
    this.beaconTime = 0
    this.endShown = false
    this.beam.strength = 0
    // 同じ夜でも、次はちがう汚れ方でもう一度点灯できる
    const nextGrime = GRIMES[(GRIMES.findIndex((x) => x.id === this.state.grime) + 1) % GRIMES.length].id
    this.state.grime = nextGrime
    this.lens.setGrime(nextGrime)
    this.machinery.leverPull = 0
    this.lensSpinSpeed = 0
    this.sound.lampOff()
    this.sound.resetPad()
    this.setPhase('polish')
    this.refreshPose(true)
  }

  private newNight() {
    const i = (WEATHER_ORDER.indexOf(this.state.weather) + 1) % WEATHER_ORDER.length
    const gi = (GRIMES.findIndex((x) => x.id === this.state.grime) + 1) % GRIMES.length
    this.startRun(WEATHER_ORDER[i], GRIMES[gi].id, this.state.lightIndex)
  }

  private freeMode: 'orbit' | 'stairs' | 'lamp' = 'orbit'

  private enterFreePlay() {
    this.state.freePlay = true
    this.state.lit = true
    this.freeMode = 'lamp'
    this.lens.setGrime(GRIMES[Math.floor(Math.random() * GRIMES.length)].id)
    this.machinery.setHints('none')
    this.setPhase('free')
    this.refreshPose(true)
    this.ui.showToast('🎠', 'すきなだけ あそんでね', 2600)
  }

  private goTitle() {
    this.state.freePlay = false
    this.state.lit = false
    this.beam.strength = 0
    this.sound.lampOff()
    this.sound.resetPad()
    this.sound.setPad(0.12)
    this.ui.hideEnd()
    this.ui.showTitle()
    this.setPhase('title')
    this.refreshPose(true)
  }

  // ---------------- 入力 ----------------

  private ndc = new Vector2()

  private pick(p: PointerSample, objs: Object3D[], recursive = true) {
    this.ndc.copy(p.ndc)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(objs, recursive)
    return hits.length ? hits[0] : null
  }

  private onDown(p: PointerSample) {
    const ph = this.state.phase
    if (ph === 'polish' || (ph === 'free' && this.freeMode === 'lamp')) {
      const hit = this.pick(p, [this.lens.grimeMesh], false)
      if (hit) {
        this.dragging = 'polish'
        this.applyRub(hit.uv)
        return
      }
    }
    if (ph === 'gear' && !this.machinery.gearInstalled) {
      const hit = this.pick(p, [this.machinery.hitLoose])
      if (hit) {
        this.dragging = 'gear'
        const wp = new Vector3()
        this.machinery.loosePart.getWorldPosition(wp)
        this.gearDragOffset.copy(wp).sub(hit.point)
        this.sound.blip(660)
        return
      }
    }
    if (ph === 'crank' || (ph === 'free' && this.freeMode === 'lamp')) {
      const hit = this.pick(p, [this.machinery.hitCrank])
      if (hit) {
        this.dragging = 'crank'
        this.circle.reset()
        const c = this.worldToScreen(this.machinery.crankGroup.getWorldPosition(new Vector3()))
        this.circle.update(c.x, c.y, p.px.x, p.px.y, performance.now())
        return
      }
    }
    if (ph === 'switch' || (ph === 'free' && this.freeMode === 'lamp')) {
      const hit = this.pick(p, [this.machinery.hitLever])
      if (hit) {
        this.dragging = 'lever'
        this.leverStartY = p.px.y
        return
      }
    }
  }

  private onMove(p: PointerSample) {
    switch (this.dragging) {
      case 'polish': {
        const hit = this.pick(p, [this.lens.grimeMesh], false)
        if (hit) this.applyRub(hit.uv)
        break
      }
      case 'gear': {
        const plane = new Plane(new Vector3(0, 0, 1), -MACHINE.plate.z)
        this.ndc.copy(p.ndc)
        this.raycaster.setFromCamera(this.ndc, this.camera)
        const pt = new Vector3()
        if (this.raycaster.ray.intersectPlane(plane, pt)) {
          pt.add(this.gearDragOffset)
          pt.y = clamp(pt.y, TOWER.lampFloorY + 0.1, TOWER.lampFloorY + 2.6)
          pt.x = clamp(pt.x, -2.6, 2.6)
          this.machinery.loosePart.position.lerp(pt, 0.55)
          this.checkGearSnap(false)
        }
        break
      }
      case 'crank': {
        const c = this.worldToScreen(this.machinery.crankGroup.getWorldPosition(new Vector3()))
        const d = this.circle.update(c.x, c.y, p.px.x, p.px.y, performance.now())
        // ぐるぐるでも、ごしごしでも進む（4歳の指はきれいな円を描かない）
        const path = Math.hypot(p.pxDelta.x, p.pxDelta.y)
        this.applyCrank(d, Math.abs(d) + Math.min(0.06, path / 1400))
        break
      }
      case 'lever': {
        const dy = (p.px.y - this.leverStartY) / (window.innerHeight * 0.22)
        this.machinery.leverPull = clamp01(dy)
        if (this.machinery.leverPull >= 0.92) this.throwSwitch()
        break
      }
      default:
        break
    }
  }

  private onUp(_p: PointerSample) {
    this.lastDrag = this.dragging
    if (this.dragging === 'polish') this.lens.endStroke()
    if (this.dragging === 'gear') this.checkGearSnap(true)
    if (this.dragging === 'crank') this.sound.setCrank(0)
    if (this.dragging === 'lever' && this.machinery.leverPull < 0.92 && !this.state.lit) {
      this.machinery.leverPull = 0
    }
    this.dragging = 'none'
  }

  private onTap(p: PointerSample) {
    const ph = this.state.phase
    if (ph === 'door') {
      this.openDoor()
      return
    }
    if (ph === 'stairs' || (ph === 'free' && this.freeMode === 'stairs')) {
      // 窓（雨戸）をタップして開ける
      const targets = this.house.windowShutters.map((s) => s.pivot)
      const hit = this.pick(p, targets)
      if (hit) {
        const s = this.house.windowShutters.find((w) => isDescendant(hit.object, w.pivot))
        if (s && !s.open) this.openShutter(s.landing)
        return
      }
      // タップでも一段のぼれる（スワイプが苦手でも進める）
      this.climbBy(2.6)
      return
    }
    if (ph === 'gear' && !this.machinery.gearInstalled) {
      const hit = this.pick(p, [this.machinery.hitLoose, this.machinery.hitSocket])
      if (hit) {
        this.installGear()
        return
      }
    }
    if (ph === 'switch' && !this.state.lit) {
      const hit = this.pick(p, [this.machinery.hitLever])
      if (hit) {
        this.machinery.leverPull = 1
        this.throwSwitch()
        return
      }
    }
    if (ph === 'free' && this.freeMode === 'lamp') {
      const hit = this.pick(p, [this.machinery.hitLever])
      if (hit) {
        this.state.lit = !this.state.lit
        this.machinery.leverPull = this.state.lit ? 1 : 0
        this.sound.clunk()
        if (this.state.lit) this.sound.lampOn()
        else this.sound.lampOff()
        return
      }
    }
    if (ph === 'beacon' || ph === 'ships') {
      // どこを触っても、光を見上げるだけ。何も失敗しない。
      this.sound.blip(1320)
    }
  }

  private onSwipe(e: SwipeEvent) {
    const ph = this.state.phase
    if (ph === 'stairs' || (ph === 'free' && this.freeMode === 'stairs')) {
      const ref = Math.max(1, window.innerHeight) * 1.64
      if (e.dy < -20) {
        const boost = clamp(e.speed / ref, 0.45, 1.9)
        this.climbBy(1.5 + boost * 2.4)
      } else if (e.dy > 60 && ph === 'free') {
        this.climbBy(-(1.5 + clamp(e.speed / ref, 0.4, 1.6) * 2.2))
      }
      return
    }
    if (ph === 'free' && this.freeMode === 'orbit') {
      this.freeOrbit.a -= e.dx * 0.004
      this.freeOrbit.h = clamp01(this.freeOrbit.h - e.dy * 0.0016)
    }
    // レンズをこすっていた指の動きは、階段への移動に使わない
    if (ph === 'free' && this.freeMode === 'lamp' && this.lastDrag === 'none' && e.dy > 90 && Math.abs(e.dx) < 120) {
      // 下へスワイプで階段へ降りる
      this.freeMode = 'stairs'
      this.stepTarget = STAIRS.count - 6
      this.stepShown = STAIRS.count - 6
      this.refreshPose(true)
      this.ui.setClimb(this.stepShown / STAIRS.count)
    }
  }

  // ---------------- 個別の遊び ----------------

  private applyRub(uv?: Vector2) {
    if (!uv) return
    // 指さきくらいの大きさ。どんなこすり方でも消える。
    const r = 0.088
    this.lens.rub(uv.x, uv.y, r * (this.quality > 0.6 ? 896 : 576))
    this.ui.setPolish(this.lens.polished)
    this.state.polished = this.lens.polished
    if (this.clock - this.lastSqueak > 0.11) {
      this.lastSqueak = this.clock
      this.sound.squeak(this.lens.polished)
    }
    if (this.lens.polished >= 1 && this.state.phase === 'polish') {
      // 端に取り残しが出ないよう、最後は自分でぴかぴかにする
      this.lens.wipeAll()
      this.sound.sparkle()
      this.ui.showToast('✨', 'ぴかぴか！', 1800)
      this.ui.setPolish(-1)
      window.setTimeout(() => {
        if (this.state.phase === 'polish') this.setPhase('gear')
      }, 900)
    }
  }
  private lastSqueak = 0

  private checkGearSnap(release: boolean) {
    const sockW = new Vector3()
    this.machinery.socket.getWorldPosition(sockW)
    const d = this.machinery.loosePart.position.distanceTo(sockW)
    if (d < (release ? 1.15 : 0.42)) this.installGear()
  }

  private installGear() {
    if (this.machinery.gearInstalled) return
    this.machinery.installGear(this.machinery.socket)
    this.state.gearFixed = true
    this.sound.ratchet(1)
    window.setTimeout(() => this.sound.ratchet(0.8), 90)
    window.setTimeout(() => this.sound.sparkle(), 200)
    this.ui.showToast('⚙️', 'はまった！', 1700)
    window.setTimeout(() => {
      if (this.state.phase === 'gear') this.setPhase('crank')
    }, 900)
  }

  private applyCrank(delta: number, progress = Math.abs(delta)) {
    if (Math.abs(delta) < 1e-5 && progress < 1e-5) return
    this.machinery.crankAngle += delta
    this.crankProgress += progress
    const gain = Math.max(Math.abs(delta), progress)
    this.lensSpinSpeed = Math.min(2.4, this.lensSpinSpeed + gain * 1.1)
    this.sound.setCrank(clamp01(gain * 26))
    // かちり、かちり
    const notch = Math.floor(this.machinery.crankAngle / 0.5)
    if (notch !== this.lastNotch) {
      this.lastNotch = notch
      this.sound.ratchet(0.9 + Math.random() * 0.25)
    }
    if (this.state.phase === 'crank') {
      this.state.crank = clamp01(Math.abs(this.machinery.crankAngle) / (Math.PI * 2 * 2.5))
      if (this.state.crank >= 1) {
        this.sound.sparkle()
        this.ui.showToast('🔄', 'まわった！', 1700)
        window.setTimeout(() => {
          if (this.state.phase === 'crank') this.setPhase('switch')
        }, 800)
      }
    }
  }
  private lastNotch = 0
  private crankProgress = 0

  private throwSwitch() {
    if (this.state.lit) return
    this.state.lit = true
    this.state.litTime = 0
    this.beaconTime = 0
    this.machinery.leverPull = 1
    this.sound.clunk()
    this.sound.lampOn()
    this.sound.liftPad()
    this.sound.setPad(0.3)
    this.ui.softFlash(0.28)
    this.setHint('watch')
    window.setTimeout(() => this.setHint('none'), 2600)
    this.setPhase('beacon')
  }

  private openDoor() {
    if (this.doorOpen > 0.01) return
    this.doorOpen = 0.001
    this.sound.door()
    this.setHint('none')
    window.setTimeout(() => {
      this.setPhase('stairs')
      this.ui.showToast('🕯️', 'のぼろう！', 1800)
    }, 1500)
  }

  private climbBy(steps: number) {
    this.stepTarget = clamp(this.stepTarget + steps, 0, STAIRS.count)
    if (this.state.phase === 'stairs' && this.stepTarget >= STAIRS.count - 0.4) {
      window.setTimeout(() => {
        if (this.state.phase === 'stairs') this.arriveLampRoom()
      }, 1200)
    }
  }

  private arriveLampRoom() {
    this.setPhase('lamproom')
    this.ui.setClimb(-1)
    this.ui.showToast('🔦', 'とうちゃく！', 2000)
    window.setTimeout(() => {
      if (this.state.phase === 'lamproom') this.setPhase('polish')
    }, 2200)
  }

  private openShutter(landing: number) {
    const s = this.house.windowShutters.find((w) => w.landing === landing)
    if (!s || s.open) return
    s.open = true
    this.openedShutters.add(landing)
    this.sound.door()
    this.sound.sparkle()
    const L = LANDINGS[landing]
    // 海鳥が窓の外を横切る
    const b = this.birds[landing % this.birds.length]
    b.y = L.windowY + 0.5
    b.r = TOWER.rOuterAt(L.windowY) + 5.5
    b.a = L.windowAngle - 0.9
    this.ui.showToast('🕊️', 'うみどりだ！', 2000)
  }

  private onShipFound(s: Ship) {
    this.state.shipsGuided++
    this.sound.horn(shipHornKind(s.kind))
    this.ui.showToast('⛵', 'ふねが みつけた！', 2200)
  }

  // ---------------- ループ ----------------

  start() {
    this.last = performance.now()
    const loop = (now: number) => {
      requestAnimationFrame(loop)
      if (!this.running) {
        this.last = now
        return
      }
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.update(dt)
      this.renderer.render(this.scene, this.camera)
      this.adapt(now)
    }
    requestAnimationFrame(loop)
  }

  private adapt(now: number) {
    this.frameAcc += performance.now() - now
    this.frameN++
    if (this.frameN >= 90) {
      const avg = this.frameAcc / this.frameN
      this.frameAcc = 0
      this.frameN = 0
      if (avg > 22 && this.pixelCap > 1.0) {
        this.pixelCap = Math.max(1.0, this.pixelCap - 0.25)
        this.renderer.setPixelRatio(this.pixelCap)
      }
    }
  }

  private update(dt: number) {
    this.clock += dt
    const st = this.state
    this.orbitAngle += dt * 0.045

    // --- 暗くなっていく空 ---
    const base = st.weather === 'clear' ? 0 : 0.45
    const byPhase: Partial<Record<Phase, number>> = {
      title: 0.06, door: 0.16, stairs: 0.2, lamproom: 0.55,
      polish: 0.62, gear: 0.72, crank: 0.8, switch: 0.88,
      beacon: 0.96, ships: 1, menu: 1, free: 0.94,
    }
    let target = byPhase[st.phase] ?? 0.2
    if (st.phase === 'stairs') target = 0.2 + (this.stepShown / STAIRS.count) * 0.36
    st.duskT = damp(st.duskT, Math.max(base, target), 0.55, dt)

    const w = WEATHERS[st.weather]
    const light = LIGHTS[st.lightIndex]
    const beamColor = new Color(light.beam)
    const rainbow = light.id === 'rainbow'

    // --- 階段の歩み ---
    if (st.phase === 'stairs' || (st.phase === 'free' && this.freeMode === 'stairs')) {
      const drag = this.input.primary
      if (drag && this.dragging === 'none') {
        // 指の動きに直接ついてくる（速さで歩調が変わる）
        // 画面の高さに対する割合で数えるので、縦横どちらでも歩調が同じになる
        const perScreen = 7.6
        this.stepTarget = clamp(
          this.stepTarget - (drag.pxDelta.y / Math.max(1, window.innerHeight)) * perScreen,
          0,
          STAIRS.count,
        )
      }
      const before = Math.floor(this.stepShown)
      this.stepShown = damp(this.stepShown, this.stepTarget, 4.2, dt)
      const after = Math.floor(this.stepShown)
      if (after !== before && this.clock - this.lastStepSound > 0.07) {
        this.lastStepSound = this.clock
        const rate = clamp(Math.abs(this.stepTarget - this.stepShown) * 0.1 + 0.85, 0.8, 1.35)
        this.sound.step(rate)
      }
      st.climb = this.stepShown / STAIRS.count
      this.ui.setClimb(st.climb)

      // 踊り場での小さな発見
      const li = Math.floor(this.stepShown / STAIRS.perLanding) - 1
      if (li >= 0 && li < TOTAL_LANDINGS && li !== this.visitedLanding) {
        this.visitedLanding = li
        st.landing = Math.max(st.landing, li + 1)
        const d = this.house.decorations.find((x) => x.landing === li)
        if (d && !st.found.some((f) => f.id === d.id)) {
          st.found.push({ id: d.id, icon: d.icon })
          this.ui.addFound(d.icon)
          this.sound.blip(880 + li * 60)
          if (!this.save.found.includes(d.id)) {
            this.save.found.push(d.id)
            writeSave(this.save)
          }
        }
        const L = LANDINGS[li]
        if (L?.hasWindow && !this.openedShutters.has(li) && st.phase === 'stairs') {
          this.setHint('window')
          window.setTimeout(() => {
            if (this.curHint === 'window') this.setHint('climb')
          }, 2600)
        }
      }
      if (st.phase === 'stairs' && this.stepShown >= STAIRS.count - 0.6) this.arriveLampRoom()
    }

    // --- 扉 ---
    if (this.doorOpen > 0) {
      this.doorOpen = Math.min(1, this.doorOpen + dt * 0.75)
      this.house.doorPivot.rotation.y = -DOOR_ANGLE - this.doorOpen * 1.9
    }
    for (const s of this.house.windowShutters) {
      s.pivot.rotation.y = damp(s.pivot.rotation.y, -LANDINGS[s.landing].windowAngle + (s.open ? -1.5 : 0), 4, dt)
    }

    // --- レンズの回転 ---
    if (st.lit) {
      st.litTime += dt
      this.beaconTime += dt
      this.lensSpinSpeed = damp(this.lensSpinSpeed, (Math.PI * 2) / LENS_PERIOD, 0.55, dt)
    } else {
      this.lensSpinSpeed = damp(this.lensSpinSpeed, 0, 0.8, dt)
    }
    this.lensSpin += this.lensSpinSpeed * dt
    this.lens.setRotation(this.lensSpin)
    this.machinery.update(dt, this.clock, this.lensSpin + this.machinery.crankAngle * 0.4, st.lit)

    // --- 光 ---
    const warm = st.lit ? smoothstep(0, 2.4, st.litTime) : 0
    const glow = warm * (0.94 + 0.06 * Math.sin(this.clock * 0.9)) // 高速点滅はしない
    this.lens.setGlow(glow, new Color(light.lamp), this.clock)
    this.beam.strength = glow * (0.55 + w.beamDensity * 0.45)
    this.beam.setAngle(this.lensSpin)
    this.beam.update(this.clock, this.camPos, beamColor, w.beamDensity, rainbow, this.lens.swirl)

    // 屋内へのはね返り
    const io = this.house.interior
    io.uBeamAngle.value = this.lensSpin
    io.uBeamStrength.value = glow * 1.1
    io.uBeamColor.value.copy(beamColor)
    io.uBeamOrigin.value.set(0, TOWER.lensY, 0)

    // --- 空と海 ---
    this.sky.update(st.duskT, w, this.clock, glow * 0.25, beamColor)
    const skyU = this.sky.mat.uniforms
    const oc = this.ocean.mat.uniforms
    oc.uTime.value = this.clock
    oc.uSwell.value = w.swell
    ;(oc.uSkyZenith.value as Color).copy(skyU.uZenith.value as Color)
    ;(oc.uSkyHorizon.value as Color).copy(skyU.uHorizon.value as Color)
    ;(oc.uGlow.value as Color).copy(skyU.uGlow.value as Color)
    ;(oc.uSunDir.value as Vector3).copy(this.sky.sunDir)
    ;(oc.uCam.value as Vector3).copy(this.camPos)
    ;(oc.uFogColor.value as Color).copy(this.sky.fogColor)
    oc.uFogDensity.value = 0.0009 + w.haze * 0.0035
    oc.uNight.value = st.duskT
    oc.uBeamAngle.value = this.lensSpin
    oc.uBeamStrength.value = glow
    ;(oc.uBeamColor.value as Color).copy(beamColor)
    oc.uRainbow.value = rainbow ? 1 : 0
    ;(oc.uDeep.value as Color).setHex(0x0b1836).lerp(new Color(0x1a2c4e), 1 - st.duskT)
    ;(oc.uShallow.value as Color).setHex(0x22406b).lerp(new Color(0x4a6d96), 1 - st.duskT)

    const fog = this.scene.fog as FogExp2
    fog.color.copy(this.sky.fogColor)
    fog.density = 0.0012 + w.haze * 0.0042
    this.renderer.setClearColor(this.sky.fogColor, 1)

    // --- 天気の粒 ---
    this.weather.update(this.clock, this.camPos, this.pixelCap, this.lensSpin, glow, beamColor, this.sky.fogColor)

    // --- 太陽と環境光 ---
    const dayAmt = 1 - smoothstep(0.1, 0.85, st.duskT)
    this.sun.position.copy(this.sky.sunDir).multiplyScalar(170)
    this.sun.target.position.set(0, 14, 0)
    this.sun.intensity = dayAmt * 2.6
    this.sun.color.copy(this.sky.horizonColor).lerp(new Color(0xffffff), 0.25)
    // 夜でも「こわくない明るさ」を残す。月あかりのつもりの下限。
    this.hemi.intensity = 0.42 + dayAmt * 0.62
    this.hemi.color.copy(skyU.uZenith.value as Color).lerp(new Color(0x9fb4e8), 0.45 * st.duskT)
    this.hemi.groundColor.copy(this.sky.fogColor).multiplyScalar(0.55)
    this.ambient.intensity = 0.1 + dayAmt * 0.13 + glow * 0.07

    // 屋内：窓からの光と、灯台守のちいさなランタン
    this.house.updateWindowLights(this.camPos.y, this.sky.horizonColor, 0.28 + dayAmt * 0.8)
    const inside = this.isInside()
    // 階段では灯台守のランタン、灯室では天井の作業ランプがあかりになる
    const inLamp =
      st.phase === 'lamproom' || st.phase === 'polish' || st.phase === 'gear' ||
      st.phase === 'crank' || st.phase === 'switch' ||
      (st.phase === 'free' && this.freeMode === 'lamp')
    const lampAt = inLamp
      ? this.house.workLampPos
      : this.keeper.group.visible
        ? this.keeper.lanternPos
        : this.camPos
    this.keeperLamp.position.copy(lampAt)
    this.keeperLamp.intensity = inside ? (inLamp ? 12 : 5.5) : 0
    this.keeperLamp.distance = inLamp ? 13 : 14
    io.uLampPos.value.copy(lampAt)
    io.uLampPow.value = inside ? (inLamp ? 1.6 : 1.0) : 0.0
    this.house.update(this.clock)

    // --- 船 ---
    this.fleet.update(dt, this.clock, w.swell, this.lensSpin, this.beam.strength, st.duskT)
    st.shipsGuided = this.fleet.guided

    // --- 灯台守 ---
    this.updateKeeper(dt)

    // --- 海鳥 ---
    for (const b of this.birds) {
      b.a += dt * b.sp
      const x = Math.cos(b.a) * b.r
      const z = Math.sin(b.a) * b.r
      const y = b.y + Math.sin(b.a * 2.3) * 1.6
      b.obj.position.set(x, y, z)
      b.obj.rotation.y = -b.a - Math.PI / 2
      b.obj.rotation.z = Math.sin(this.clock * 3.4 + b.a) * 0.18
      for (const c of b.obj.children) {
        if (c.name === 'wing') c.rotation.x = Math.sin(this.clock * 5.2 + b.a * 3) * 0.5
      }
    }

    // --- 音の環境 ---
    const h = clamp01((this.camPos.y - 2) / 32)
    this.sound.setWind(0.2 + h * 0.8, inside)
    this.sound.setWaves(inside ? 0.25 : 0.7)

    // --- 見せ場の進行 ---
    if (st.phase === 'beacon') {
      this.refreshPose()
      if (this.beaconTime > 13 && !this.endShown) {
        this.endShown = true
        this.ui.showEnd(Math.max(1, st.shipsGuided))
        this.setPhase('menu')
      }
    } else if (st.phase === 'menu') {
      this.refreshPose()
    } else if (st.phase === 'title' || (st.phase === 'free' && this.freeMode === 'orbit')) {
      this.refreshPose()
    } else if (st.phase === 'stairs' || (st.phase === 'free' && this.freeMode === 'stairs')) {
      this.refreshPose()
    }

    // --- ヒントの出し入れ ---
    this.hintTimer += dt
    if (st.phase === 'polish' && this.lens.polished > 0.06 && this.curHint === 'rub') this.setHint('none')
    if (st.phase === 'stairs' && this.stepShown > 2 && this.curHint === 'climb' && this.hintTimer > 4) this.setHint('none')
    if (st.phase === 'stairs' && this.stepShown < STAIRS.count - 1 && this.curHint === 'none' && this.hintTimer > 7 && !this.input.isDown) {
      this.setHint('climb')
    }
    this.glowPulse += dt

    // --- カメラ ---
    this.applyCamera(dt)

    // 指の移動量はこのフレームで使い切る（消さないと何度も効いてしまう）
    this.input.endFrame()
  }

  /** 灯台守の居場所と視線。うしろ姿と首の向きが、次にすることを教える。 */
  private updateKeeper(dt: number) {
    const ph = this.state.phase
    const k = this.keeper
    const onStairs = ph === 'stairs' || (ph === 'free' && this.freeMode === 'stairs')

    if (onStairs) {
      k.setVisible(true)
      const p = stairPose(this.stepShown)
      k.group.position.set(p.x, p.y, p.z)
      k.group.rotation.y = -p.angle
      const ahead = stairPose(this.stepShown + 7)
      // 頂上が近いと上を見上げる
      const nearTop = this.stepShown > STAIRS.count - 16
      k.lookAt(new Vector3(ahead.x, nearTop ? TOWER.lampFloorY + 0.6 : ahead.y + 1.6, ahead.z))
      const speed = clamp01(Math.abs(this.stepTarget - this.stepShown) * 0.16)
      k.update(dt, this.clock, speed)
    } else if (ph === 'title' || ph === 'door') {
      k.setVisible(true)
      const r = TOWER.rOuterAt(TOWER.baseY) + 2.6
      k.group.position.set(Math.cos(DOOR_ANGLE) * r - 0.9, TOWER.baseY + 0.9, Math.sin(DOOR_ANGLE) * r)
      k.group.rotation.y = Math.PI
      k.lookAt(new Vector3(0, ph === 'door' ? 3.0 : 26, 0))
      k.update(dt, this.clock, 0)
    } else if (ph === 'beacon' || ph === 'ships' || ph === 'menu') {
      // 見せ場では回廊に立って、自分の光を見ている
      k.setVisible(this.beaconTime > 4.0)
      const r = TOWER.rOuterTop + 0.75
      const a = -0.5
      k.group.position.set(Math.cos(a) * r, TOWER.topY + 0.24, Math.sin(a) * r)
      k.group.rotation.y = -a + Math.PI
      k.lookAt(new Vector3(Math.cos(a) * 200, 6, Math.sin(a) * 200))
      k.update(dt, this.clock, 0)
    } else {
      k.setVisible(false)
    }
  }

  private isInside() {
    const y = this.camPos.y
    const r = Math.hypot(this.camPos.x, this.camPos.z)
    // 灯室は塔よりひとまわり広いので、そこだけ判定を広げる
    if (y > TOWER.lampFloorY - 0.6) return y < TOWER.lampCeilY + 0.4 && r < TOWER.rOuterTop + 1.6
    return y > TOWER.baseY - 1 && r < TOWER.rOuterAt(y) + 0.6
  }

  private applyCamera(dt: number) {
    const t = this.targetPose
    const lam = this.state.phase === 'stairs' || (this.state.phase === 'free' && this.freeMode === 'stairs') ? 9 : 2.6
    if (this.poseSnap) {
      this.camPos.copy(t.pos)
      this.camLook.copy(t.look)
      this.camera.fov = t.fov
      this.poseSnap = false
    } else {
      this.camPos.x = damp(this.camPos.x, t.pos.x, lam, dt)
      this.camPos.y = damp(this.camPos.y, t.pos.y, lam, dt)
      this.camPos.z = damp(this.camPos.z, t.pos.z, lam, dt)
      this.camLook.x = damp(this.camLook.x, t.look.x, lam * 0.85, dt)
      this.camLook.y = damp(this.camLook.y, t.look.y, lam * 0.85, dt)
      this.camLook.z = damp(this.camLook.z, t.look.z, lam * 0.85, dt)
      this.camera.fov = damp(this.camera.fov, t.fov, 3, dt)
    }
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
    // 階段では、のぼる律動をほんの少しだけ体に伝える
    if (this.state.phase === 'stairs' || (this.state.phase === 'free' && this.freeMode === 'stairs')) {
      const bob = Math.sin(this.stepShown * Math.PI) * 0.045
      this.camera.position.y += bob
      this.camera.rotation.z += Math.sin(this.stepShown * Math.PI * 0.5) * 0.012
    }
    this.camera.updateProjectionMatrix()
  }

  /** 動作確認用：好きな場面へ飛ぶ */
  jump(phase: Phase, opts: { step?: number; polished?: boolean; gear?: boolean; lit?: boolean; beacon?: number } = {}) {
    if (opts.step !== undefined) {
      this.stepShown = opts.step
      this.stepTarget = opts.step
    }
    if (opts.polished) {
      this.lens.wipeAll()
      this.state.polished = 1
    }
    if (opts.gear) {
      this.machinery.installGear(this.machinery.socket)
      this.state.gearFixed = true
    }
    if (opts.lit) {
      this.state.lit = true
      this.state.litTime = opts.beacon ?? 0
      this.beaconTime = opts.beacon ?? 0
      this.machinery.leverPull = 1
      this.lensSpinSpeed = (Math.PI * 2) / LENS_PERIOD
    }
    this.setPhase(phase)
    this.refreshPose(true)
  }

  /** 動作確認用：主要な操作対象の画面座標 */
  debugScreenPoints() {
    const w = (o: Object3D) => this.worldToScreen(o.getWorldPosition(new Vector3())).toArray()
    return {
      loose: w(this.machinery.loosePart),
      socket: w(this.machinery.socket),
      crank: w(this.machinery.crankGroup),
      lever: w(this.machinery.leverArm),
      lens: this.worldToScreen(this.lens.group.getWorldPosition(new Vector3())).toArray(),
      shutters: this.house.windowShutters.map((sh) => w(sh.pivot)),
    }
  }

  debugGrid() { return this.lens.debugGrid() }

  /** 動作確認用のスナップショット */
  debug() {
    return {
      phase: this.state.phase,
      step: +this.stepShown.toFixed(2),
      target: +this.stepTarget.toFixed(2),
      cam: this.camPos.toArray().map((n) => +n.toFixed(2)),
      look: this.camLook.toArray().map((n) => +n.toFixed(2)),
      polished: +this.lens.polished.toFixed(3),
      gear: this.machinery.gearInstalled,
      crank: +this.state.crank.toFixed(2),
      dragging: this.dragging,
      lit: this.state.lit,
      ships: this.state.shipsGuided,
      dusk: +this.state.duskT.toFixed(2),
      tris: this.renderer.info.render.triangles,
      calls: this.renderer.info.render.calls,
    }
  }

  private worldToScreen(v: Vector3) {
    const p = v.clone().project(this.camera)
    return new Vector2(((p.x + 1) / 2) * window.innerWidth, ((-p.y + 1) / 2) * window.innerHeight)
  }
}

function isDescendant(o: Object3D, parent: Object3D) {
  let n: Object3D | null = o
  while (n) {
    if (n === parent) return true
    n = n.parent
  }
  return false
}
