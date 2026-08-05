import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { PALETTE, clamp01, damp, lerp } from '../core/palette'
import { attachInterior, contactShadowTexture, type InteriorLightUniforms } from './lighthouse'

function std(color: number, rough = 0.75, metal = 0, emissive = 0x000000) {
  return new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive })
}

let _glow: CanvasTexture | null = null
function glowTex() {
  if (_glow) return _glow
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(48, 48, 0, 48, 48, 48)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,236,190,0.6)')
  grd.addColorStop(1, 'rgba(255,220,150,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 96, 96)
  _glow = new CanvasTexture(c)
  return _glow
}

/**
 * 灯台守の女の子。うしろ姿と視線で「どこへ向かうか」を伝える係。
 * 文字を読まなくても、彼女が見上げれば上へ、レンズを見ればレンズへ。
 */
export class Keeper {
  readonly group = new Group()
  readonly lanternPos = new Vector3()

  private legL = new Group()
  private legR = new Group()
  private armL = new Group()
  private armR = new Group()
  private head = new Group()
  private body = new Group()
  private lantern = new Group()
  private lanternGlow: Mesh
  private scarfEnd: Mesh
  private walkPhase = 0
  private lookTarget = new Vector3()
  private headYaw = 0
  private headPitch = 0

  constructor(interior: InteriorLightUniforms) {
    this.group.name = 'keeper'

    const coat = std(PALETTE.coatPink, 0.82)
    const coatDark = std(0xe2678f, 0.82)
    const cuff = std(PALETTE.coatCuff, 0.8)
    const skin = std(0xffdcc4, 0.85)
    const hair = std(0x5a3a2e, 0.9)
    const hat = std(0x39457a, 0.7)
    const boot = std(0x3c3243, 0.8)

    for (const m of [coat, coatDark, cuff, skin, hair, hat, boot]) attachInterior(m, interior)

    // --- 脚 ---
    for (const [g, s] of [[this.legL, -1], [this.legR, 1]] as [Group, number][]) {
      const leg = new Mesh(new CylinderGeometry(0.045, 0.04, 0.34, 8), std(0x6d5f78, 0.85))
      attachInterior(leg.material as MeshStandardMaterial, interior)
      leg.position.y = -0.17
      g.add(leg)
      const b = new Mesh(new BoxGeometry(0.11, 0.09, 0.17), boot)
      b.position.set(0, -0.37, 0.02)
      g.add(b)
      g.position.set(s * 0.075, 0.42, 0)
      this.body.add(g)
    }

    // --- コート（すそが広がっている） ---
    const skirt = new Mesh(new ConeGeometry(0.26, 0.44, 14, 1, true), coat)
    skirt.position.y = 0.6
    skirt.castShadow = true
    this.body.add(skirt)
    const hem = new Mesh(new TorusGeometry(0.255, 0.028, 6, 18), cuff)
    hem.rotation.x = Math.PI / 2
    hem.position.y = 0.39
    this.body.add(hem)

    const torso = new Mesh(new CylinderGeometry(0.14, 0.19, 0.34, 12), coat)
    torso.position.y = 0.79
    torso.castShadow = true
    this.body.add(torso)
    // 前あわせのボタン
    for (let i = 0; i < 3; i++) {
      const btn = new Mesh(new SphereGeometry(0.022, 8, 6), cuff)
      btn.position.set(0, 0.72 + i * 0.11, 0.15)
      this.body.add(btn)
    }

    // --- 腕 ---
    for (const [g, s] of [[this.armL, -1], [this.armR, 1]] as [Group, number][]) {
      const arm = new Mesh(new CylinderGeometry(0.042, 0.036, 0.3, 8), coat)
      arm.position.y = -0.15
      g.add(arm)
      const hand = new Mesh(new SphereGeometry(0.045, 8, 6), cuff)
      hand.position.y = -0.31
      g.add(hand)
      g.position.set(s * 0.185, 0.93, 0)
      this.body.add(g)
    }

    // --- マフラー（虹のふち取り） ---
    const scarf = new Mesh(new TorusGeometry(0.13, 0.045, 8, 16), std(0xff9ec4, 0.85))
    attachInterior(scarf.material as MeshStandardMaterial, interior)
    scarf.rotation.x = Math.PI / 2
    scarf.position.y = 0.99
    this.body.add(scarf)
    this.scarfEnd = new Mesh(new BoxGeometry(0.075, 0.3, 0.04), std(0xffc7e6, 0.85))
    attachInterior(this.scarfEnd.material as MeshStandardMaterial, interior)
    this.scarfEnd.position.set(-0.05, 0.85, -0.11)
    this.body.add(this.scarfEnd)

    // --- 頭 ---
    const skull = new Mesh(new SphereGeometry(0.145, 16, 14), skin)
    this.head.add(skull)
    const hairCap = new Mesh(new SphereGeometry(0.152, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair)
    hairCap.position.y = 0.006
    this.head.add(hairCap)
    for (const s of [-1, 1]) {
      const bun = new Mesh(new SphereGeometry(0.075, 12, 10), hair)
      bun.position.set(s * 0.16, -0.03, -0.03)
      this.head.add(bun)
      const tie = new Mesh(new TorusGeometry(0.055, 0.018, 6, 12), std(0xffd6e6, 0.7))
      attachInterior(tie.material as MeshStandardMaterial, interior)
      tie.position.set(s * 0.13, 0.0, -0.03)
      tie.rotation.y = Math.PI / 2
      this.head.add(tie)
    }
    // 帽子
    const cap = new Mesh(new CylinderGeometry(0.115, 0.13, 0.11, 14), hat)
    cap.position.y = 0.15
    this.head.add(cap)
    const brim = new Mesh(new CylinderGeometry(0.185, 0.185, 0.022, 16), hat)
    brim.position.y = 0.1
    this.head.add(brim)
    const ribbon = new Mesh(new TorusGeometry(0.125, 0.022, 6, 16), std(PALETTE.coatPink, 0.7))
    attachInterior(ribbon.material as MeshStandardMaterial, interior)
    ribbon.rotation.x = Math.PI / 2
    ribbon.position.y = 0.115
    this.head.add(ribbon)
    // 目（うしろ姿でも、ふり向いたときに分かる）
    for (const s of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.021, 8, 6), std(0x2f2733, 0.3, 0, 0x0a0a0a))
      eye.position.set(s * 0.055, 0.01, 0.132)
      this.head.add(eye)
      const cheek = new Mesh(new SphereGeometry(0.028, 8, 6), std(0xffb3c6, 0.8))
      cheek.position.set(s * 0.085, -0.045, 0.115)
      cheek.scale.set(1, 0.6, 0.4)
      this.head.add(cheek)
    }
    this.head.position.y = 1.11
    this.body.add(this.head)

    // --- ランタン（右手） ---
    const handleBar = new Mesh(new TorusGeometry(0.05, 0.008, 6, 12, Math.PI), std(PALETTE.brass, 0.3, 0.8))
    attachInterior(handleBar.material as MeshStandardMaterial, interior)
    handleBar.position.y = 0.09
    this.lantern.add(handleBar)
    const cage = new Mesh(new CylinderGeometry(0.05, 0.055, 0.11, 8), std(PALETTE.brass, 0.35, 0.8))
    attachInterior(cage.material as MeshStandardMaterial, interior)
    this.lantern.add(cage)
    const flameMat = new MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffc46a, emissiveIntensity: 2.4, roughness: 0.4 })
    const flame = new Mesh(new SphereGeometry(0.032, 10, 8), flameMat)
    this.lantern.add(flame)
    this.lanternGlow = new Mesh(
      new SphereGeometry(0.16, 10, 8),
      new MeshBasicMaterial({ map: glowTex(), color: 0xffd88a, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
    )
    this.lantern.add(this.lanternGlow)
    this.lantern.position.set(0, -0.34, 0.02)
    this.armR.add(this.lantern)

    // 接地感（足もとの影）
    const shadow = new Mesh(
      new PlaneGeometry(0.95, 0.95),
      new MeshBasicMaterial({ map: contactShadowTexture(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.025
    shadow.renderOrder = 3
    this.group.add(shadow)

    this.group.add(this.body)
    this.group.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true
    })
  }

  /** どこを見てほしいか（視線誘導） */
  lookAt(p: Vector3) {
    this.lookTarget.copy(p)
  }

  /**
   * @param speed 0..1 くらいの歩調
   * @param carry ランタンを持ち上げているか
   */
  update(dt: number, time: number, speed: number, carry = true) {
    this.walkPhase += dt * (2.2 + speed * 7.5)
    const s = clamp01(speed)
    const sw = Math.sin(this.walkPhase) * (0.18 + s * 0.5)
    this.legL.rotation.x = sw
    this.legR.rotation.x = -sw
    this.armL.rotation.x = -sw * 0.65
    this.armR.rotation.x = lerp(-0.35, -0.55, s)
    this.armR.rotation.z = -0.18
    this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * (0.012 + s * 0.03)
    this.body.rotation.z = Math.sin(this.walkPhase) * 0.022 * (0.4 + s)
    this.scarfEnd.rotation.x = -0.25 - Math.sin(this.walkPhase * 0.9) * 0.2 - s * 0.35

    // 頭で「そっちだよ」を示す
    const local = this.group.worldToLocal(this.lookTarget.clone())
    const yaw = Math.atan2(local.x, local.z)
    const pitch = Math.atan2(local.y - 1.11, Math.hypot(local.x, local.z))
    this.headYaw = damp(this.headYaw, Math.max(-1.0, Math.min(1.0, yaw)), 5, dt)
    this.headPitch = damp(this.headPitch, Math.max(-0.7, Math.min(0.85, pitch)), 5, dt)
    this.head.rotation.y = this.headYaw
    this.head.rotation.x = -this.headPitch

    const glow = carry ? 0.45 + 0.15 * Math.sin(time * 3.1) : 0
    ;(this.lanternGlow.material as MeshBasicMaterial).opacity = glow
    this.lanternGlow.scale.setScalar(1 + Math.sin(time * 2.4) * 0.06)
    this.lantern.getWorldPosition(this.lanternPos)
  }

  setVisible(v: boolean) {
    this.group.visible = v
  }
}
