import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'
import type { GrimeId } from '../core/palette'
import { PALETTE, clamp01 } from '../core/palette'
import { TOWER, attachInterior, makeBrass, type InteriorLightUniforms } from './lighthouse'

const LENS_R = 1.42
const LENS_H = 2.5
const GRIME_R = LENS_R + 0.14
/**
 * よごれの殻は「カメラから見えて、指が届く」範囲だけに貼る。
 * 横画面では ±45 度まで画面に入るので、弧は 90 度ぶん。
 * 縦画面では両はしが画面の外へ出るため、「磨けた割合」は
 * まんなか 60% の帯だけで数える（MEASURE_LO/HI）。
 */
const GRIME_ARC = Math.PI * 0.38
const MEASURE_LO = 0.14
const MEASURE_HI = 0.86

/**
 * 回転レンズ。表面にかぶさる「よごれの殻」を指でこすって消す。
 * 消えたところだけ向こうの海が透ける（本物のジオメトリ越しなので視差も出る）。
 */
export class Lens {
  readonly group = new Group()
  /** レンズ本体（回る） */
  readonly drum = new Group()
  readonly grimeMesh: Mesh
  readonly lamp: Mesh
  readonly lampLight: PointLight
  readonly panels: Mesh[] = []

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tex: CanvasTexture
  private grid: Float32Array
  private readonly GW = 44
  private readonly GH = 34
  private cleanedCells = 0
  private totalCells: number
  private measureLo = 0
  private measureHi = 0

  /** 0..1 */
  polished = 0
  /** こすり方のクセ（光の模様がすこし変わる） */
  swirl = 0
  private lastPaint: Vector2 | null = null
  private strokeTurn = 0
  private strokeLen = 0

  private glowMat: MeshStandardMaterial
  private prismMat!: MeshStandardMaterial
  private haloMat: MeshBasicMaterial
  private halo: Mesh
  private ribMats: MeshStandardMaterial[] = []

  constructor(interior: InteriorLightUniforms, quality: number) {
    this.group.position.set(0, TOWER.lensY, 0)
    this.group.name = 'lensAssembly'

    // キャンバスもほぼ正方形にする
    const size = quality > 0.6 ? [896, 768] : [576, 512]
    this.canvas = document.createElement('canvas')
    this.canvas.width = size[0]
    this.canvas.height = size[1]
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!
    this.tex = new CanvasTexture(this.canvas)
    this.tex.minFilter = LinearFilter
    this.tex.magFilter = LinearFilter
    this.grid = new Float32Array(this.GW * this.GH).fill(1)
    this.measureLo = Math.floor(this.GW * MEASURE_LO)
    this.measureHi = Math.ceil(this.GW * MEASURE_HI)
    this.totalCells = (this.measureHi - this.measureLo) * this.GH

    // --- 台座と回転軸 ---
    const pedestal = new Mesh(new CylinderGeometry(1.0, 1.35, 0.9, 20), new MeshStandardMaterial({ color: 0x5b4a3c, roughness: 0.8 }))
    attachInterior(pedestal.material as MeshStandardMaterial, interior)
    pedestal.position.y = -LENS_H / 2 - 0.55
    pedestal.castShadow = true
    this.group.add(pedestal)

    const bearing = new Mesh(new TorusGeometry(0.95, 0.09, 8, 22), makeBrass(interior))
    bearing.rotation.x = Math.PI / 2
    bearing.position.y = -LENS_H / 2 - 0.06
    this.group.add(bearing)

    // --- ランプ（中の火） ---
    const glowMat = new MeshStandardMaterial({
      color: 0xfff3d4,
      emissive: new Color(0xffd98a),
      emissiveIntensity: 0.15,
      roughness: 0.4,
    })
    this.glowMat = glowMat
    this.lamp = new Mesh(new SphereGeometry(0.26, 18, 14), glowMat)
    this.lamp.scale.set(1, 1.25, 1)
    this.group.add(this.lamp)
    // 火口（ランプの下の真鍮の座）
    const burner = new Mesh(new CylinderGeometry(0.13, 0.2, 0.24, 12), makeBrass(interior))
    burner.position.y = -0.34
    this.group.add(burner)

    this.lampLight = new PointLight(0xffd9a0, 0, 46, 1.6)
    this.lampLight.position.set(0, 0, 0)
    this.group.add(this.lampLight)

    // ランプのまわりの光の玉
    this.haloMat = new MeshBasicMaterial({
      color: 0xffe6b0,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide,
    })
    this.halo = new Mesh(new SphereGeometry(1.05, 18, 14), this.haloMat)
    this.halo.renderOrder = 8
    this.group.add(this.halo)

    // --- 回るレンズの胴 ---
    const glass = new MeshStandardMaterial({
      color: 0xcfeeff,
      transparent: true,
      opacity: 0.17,
      roughness: 0.04,
      metalness: 0.0,
      side: DoubleSide,
      emissive: new Color(0x99ccff),
      emissiveIntensity: 0.05,
      depthWrite: false,
    })
    // プリズムのふち（光をよく拾う、きらっとした環）
    const prism = new MeshStandardMaterial({
      color: 0xeafaff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.02,
      metalness: 0.12,
      side: DoubleSide,
      emissive: new Color(0xbfe4ff),
      emissiveIntensity: 0.1,
      depthWrite: false,
    })
    this.prismMat = prism
    const drumGlass = new Mesh(new CylinderGeometry(LENS_R, LENS_R, LENS_H, quality > 0.6 ? 40 : 26, 1, true), glass)
    drumGlass.renderOrder = 4
    this.drum.add(drumGlass)

    // プリズムの段（フレネルらしさ）
    const ringCount = quality > 0.6 ? 11 : 7
    for (let i = 0; i < ringCount; i++) {
      const t = i / (ringCount - 1)
      const y = (t - 0.5) * (LENS_H - 0.3)
      const bulge = 1 + Math.cos((t - 0.5) * Math.PI) * 0.055
      const ring = new Mesh(new TorusGeometry(LENS_R * bulge - 0.03, 0.038, 6, quality > 0.6 ? 34 : 22), prism)
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      ring.renderOrder = 5
      this.drum.add(ring)
    }

    // 縦の真鍮リブ
    const ribMat = makeBrass(interior)
    this.ribMats.push(ribMat)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const rib = new Mesh(new CylinderGeometry(0.05, 0.05, LENS_H + 0.1, 6), ribMat)
      rib.position.set(Math.cos(a) * LENS_R, 0, Math.sin(a) * LENS_R)
      rib.castShadow = true
      this.drum.add(rib)
    }
    for (const yy of [-LENS_H / 2, LENS_H / 2]) {
      const hoop = new Mesh(new TorusGeometry(LENS_R + 0.02, 0.07, 8, quality > 0.6 ? 30 : 20), ribMat)
      hoop.rotation.x = Math.PI / 2
      hoop.position.y = yy
      this.drum.add(hoop)
    }

    // 二枚のふくらんだ主レンズ（ここから光が出る）
    const panelMat = new MeshStandardMaterial({
      color: 0xdff2ff,
      transparent: true,
      opacity: 0.34,
      roughness: 0.03,
      metalness: 0.0,
      emissive: new Color(0xbfe4ff),
      emissiveIntensity: 0.06,
      side: DoubleSide,
      depthWrite: false,
    })
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI
      const p = new Mesh(new SphereGeometry(1.0, 22, 16), panelMat)
      p.scale.set(0.34, LENS_H * 0.44, 0.62)
      p.position.set(Math.cos(a) * (LENS_R - 0.05), 0, Math.sin(a) * (LENS_R - 0.05))
      p.rotation.y = -a
      p.renderOrder = 6
      this.panels.push(p)
      this.drum.add(p)
    }

    this.group.add(this.drum)

    // --- よごれの殻（回らない：ガラスの外側にへばりついている） ---
    const grimeMat = new MeshStandardMaterial({
      map: this.tex,
      transparent: true,
      side: DoubleSide,
      roughness: 0.95,
      metalness: 0,
      depthWrite: false,
      alphaTest: 0.004,
    })
    attachInterior(grimeMat, interior)
    // 手前側だけの殻。向こう側にはよごれが無いので、磨いた穴からそのまま海が見える。
    // Three の CylinderGeometry は theta=0 が +Z なので、+Z を中心にした弧にする。
    this.grimeMesh = new Mesh(
      // 高さは「画面に収まって指が届く」帯ぶんだけ。上下は真鍮の輪が隠してくれる。
      new CylinderGeometry(GRIME_R, GRIME_R, LENS_H * 0.78, 44, 1, true, -GRIME_ARC / 2, GRIME_ARC),
      grimeMat,
    )
    this.grimeMesh.renderOrder = 7
    this.grimeMesh.name = 'grime'
    this.group.add(this.grimeMesh)
  }

  // ---------------------------------------------------------------

  setGrime(kind: GrimeId) {
    const { ctx: g, canvas: c } = this
    const W = c.width
    const H = c.height
    g.clearRect(0, 0, W, H)
    this.grid.fill(1)
    this.cleanedCells = 0
    this.polished = 0
    this.swirl = 0

    if (kind === 'haze') {
      g.globalCompositeOperation = 'source-over'
      g.fillStyle = 'rgba(232,238,246,0.62)'
      g.fillRect(0, 0, W, H)
      for (let i = 0; i < 190; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        const r = 24 + Math.random() * 110
        const grd = g.createRadialGradient(x, y, 0, x, y, r)
        grd.addColorStop(0, `rgba(255,255,255,${0.16 + Math.random() * 0.2})`)
        grd.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grd
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
      }
    } else if (kind === 'salt') {
      g.fillStyle = 'rgba(226,232,240,0.3)'
      g.fillRect(0, 0, W, H)
      for (let i = 0; i < 2600; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        // ふちほど濃い
        const edge = 1 - Math.abs(y / H - 0.5) * 1.5
        if (Math.random() > 0.35 + edge * 0.5) continue
        const r = 1.2 + Math.random() * 5.5
        g.fillStyle = `rgba(${244 + Math.random() * 11 | 0},${248},${255},${0.35 + Math.random() * 0.55})`
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
      }
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        const r = 12 + Math.random() * 34
        const grd = g.createRadialGradient(x, y, 0, x, y, r)
        grd.addColorStop(0, 'rgba(255,255,255,0.4)')
        grd.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grd
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
      }
    } else {
      // 水滴
      g.fillStyle = 'rgba(214,226,240,0.26)'
      g.fillRect(0, 0, W, H)
      for (let i = 0; i < 330; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        const r = 5 + Math.random() * 26
        const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.06, x, y, r)
        grd.addColorStop(0, 'rgba(255,255,255,0.85)')
        grd.addColorStop(0.45, 'rgba(206,224,244,0.5)')
        grd.addColorStop(0.86, 'rgba(226,238,252,0.72)')
        grd.addColorStop(1, 'rgba(226,238,252,0)')
        g.fillStyle = grd
        g.beginPath()
        g.ellipse(x, y, r, r * (0.72 + Math.random() * 0.5), 0, 0, Math.PI * 2)
        g.fill()
        // したたり
        if (Math.random() < 0.22) {
          const grd2 = g.createLinearGradient(x, y, x, y + r * 2.6)
          grd2.addColorStop(0, 'rgba(226,238,252,0.55)')
          grd2.addColorStop(1, 'rgba(226,238,252,0)')
          g.fillStyle = grd2
          g.fillRect(x - r * 0.22, y, r * 0.44, r * 2.6)
        }
      }
    }
    this.tex.needsUpdate = true
    const m = this.grimeMesh.material as MeshStandardMaterial
    m.opacity = 1
    m.visible = true
  }

  /** UV(0..1) をこする。radius は UV の u 方向割合 */
  rub(u: number, v: number, radiusPx: number) {
    const W = this.canvas.width
    const H = this.canvas.height
    const x = u * W
    const y = (1 - v) * H
    const g = this.ctx

    g.globalCompositeOperation = 'destination-out'
    const paintAt = (px: number, py: number) => {
      const grd = g.createRadialGradient(px, py, 0, px, py, radiusPx)
      grd.addColorStop(0, 'rgba(0,0,0,0.92)')
      grd.addColorStop(0.55, 'rgba(0,0,0,0.55)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.beginPath()
      g.arc(px, py, radiusPx, 0, Math.PI * 2)
      g.fill()
    }

    // 前回位置とつなぐ（速く動かしても途切れない）
    if (this.lastPaint) {
      const dx = x - this.lastPaint.x
      const dy = y - this.lastPaint.y
      const dist = Math.hypot(dx, dy)
      if (dist < W * 0.4) {
        const steps = Math.min(24, Math.ceil(dist / (radiusPx * 0.45)))
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          paintAt(this.lastPaint.x + dx * t, this.lastPaint.y + dy * t)
        }
        // こすり方のクセを覚える（曲がっているほど swirl が上がる）
        const ang = Math.atan2(dy, dx)
        if (this.strokeLen > 0) {
          let d = ang - this.strokeTurn
          while (d > Math.PI) d -= Math.PI * 2
          while (d < -Math.PI) d += Math.PI * 2
          this.swirl = clamp01(this.swirl * 0.985 + Math.abs(d) * 0.02)
        }
        this.strokeTurn = ang
        this.strokeLen += dist
      } else {
        paintAt(x, y)
      }
    } else {
      paintAt(x, y)
    }
    g.globalCompositeOperation = 'source-over'
    this.lastPaint = new Vector2(x, y)
    this.tex.needsUpdate = true

    this.markGrid(u, v, radiusPx / W)
  }

  endStroke() {
    this.lastPaint = null
  }

  private markGrid(u: number, v: number, ru: number) {
    const gx = u * this.GW
    const gy = (1 - v) * this.GH
    const rx = Math.max(1.0, ru * this.GW)
    const ry = Math.max(1.0, ru * (this.canvas.width / this.canvas.height) * this.GH)
    const i0 = Math.max(0, Math.floor(gx - rx) - 1)
    const i1 = Math.min(this.GW - 1, Math.ceil(gx + rx) + 1)
    const j0 = Math.max(0, Math.floor(gy - ry) - 1)
    const j1 = Math.min(this.GH - 1, Math.ceil(gy + ry) + 1)
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i + 0.5 - gx
        const dy = j + 0.5 - gy
        const d = Math.hypot(dx / rx, dy / ry)
        if (d > 1) continue
        const k = i + j * this.GW
        const before = this.grid[k]
        const after = Math.max(0, before - (1 - d * 0.6) * 0.85)
        this.grid[k] = after
        if (before >= 0.3 && after < 0.3 && i >= this.measureLo && i < this.measureHi) this.cleanedCells++
      }
    }
    // 4歳の指でも必ず終われるように、半分くらい磨けたら「ぴかぴか」とみなす
    this.polished = clamp01(this.cleanedCells / (this.totalCells * 0.62))
  }

  /** 動作確認用：どこが磨けたかの粗いマップ */
  debugGrid() {
    const rows: string[] = []
    for (let j = 0; j < this.GH; j++) {
      let r = ''
      for (let i = 0; i < this.GW; i++) r += this.grid[i + j * this.GW] < 0.3 ? '.' : '#'
      rows.push(r)
    }
    return rows
  }

  /** 残りを一気にきれいにする（自由あそび／おてつだい用） */
  wipeAll() {
    this.ctx.globalCompositeOperation = 'destination-out'
    this.ctx.fillStyle = 'rgba(0,0,0,1)'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.globalCompositeOperation = 'source-over'
    this.tex.needsUpdate = true
    this.grid.fill(0)
    this.cleanedCells = this.totalCells
    this.polished = 1
  }

  /** 点灯の度合いに応じてレンズを光らせる */
  setGlow(amount: number, color: Color, rainbowPhase: number) {
    const a = clamp01(amount)
    this.glowMat.emissive.copy(color)
    this.glowMat.emissiveIntensity = a * 5.2
    this.glowMat.color.setRGB(1, 1, 1)
    this.lampLight.intensity = a * 58
    this.lampLight.color.copy(color)
    this.lampLight.distance = 46
    this.haloMat.opacity = a * 0.42
    this.haloMat.color.copy(color)
    this.halo.scale.setScalar(1 + a * 0.35 + Math.sin(rainbowPhase * 2.1) * 0.02 * a)

    for (const p of this.panels) {
      const m = p.material as MeshStandardMaterial
      m.emissive.copy(color)
      m.emissiveIntensity = a * 2.6
      m.opacity = 0.34 + a * 0.35
    }
    this.prismMat.emissive.copy(color)
    this.prismMat.emissiveIntensity = 0.1 + a * 1.8
    this.prismMat.opacity = 0.34 + a * 0.34
    for (const m of this.ribMats) {
      m.emissive.setRGB(0.09 + a * 0.35 * color.r, 0.06 + a * 0.3 * color.g, 0.02 + a * 0.25 * color.b)
    }
  }

  setRotation(angle: number) {
    this.drum.rotation.y = angle
  }

  get rotation() {
    return this.drum.rotation.y
  }

  static get radius() { return GRIME_R }
  static get height() { return LENS_H }
  static get lensColor() { return PALETTE.glass }
}
