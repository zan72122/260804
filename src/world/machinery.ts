import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { PALETTE, clamp01, damp } from '../core/palette'
import { TOWER, attachInterior, contactShadowTexture, makeBrass, type InteriorLightUniforms } from './lighthouse'

const FLOOR = TOWER.lampFloorY

export const MACHINE = {
  /**
   * 灯室の「正面」は +Z。プレイヤーはここから見る。
   * 三つの仕事（歯車・ハンドル・スイッチ）が重ならないよう、
   * 左・右・下まんなか に配置している。
   */
  /** 左：歯車の板 と 予備の歯車（近くにあるので運ぶ道すじが分かる） */
  plate: new Vector3(-2.08, FLOOR + 1.5, 1.0),
  looseGear: new Vector3(-1.28, FLOOR + 1.02, 2.32),
  /** 右：ハンドル と 大きなスイッチ */
  crank: new Vector3(2.08, FLOOR + 1.35, 1.0),
  lever: new Vector3(1.3, FLOOR + 0.85, 2.42),
  camera: new Vector3(0, FLOOR + 1.95, 3.45),
}

function gearGeometry(radius: number, teeth: number, thickness: number) {
  const g = new Group()
  const body = new Mesh(new CylinderGeometry(radius, radius, thickness, Math.max(14, teeth * 2)), new MeshStandardMaterial())
  body.rotation.x = Math.PI / 2
  g.add(body)
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const t = new Mesh(new BoxGeometry(radius * 0.26, radius * 0.24, thickness), new MeshStandardMaterial())
    t.position.set(Math.cos(a) * (radius + radius * 0.1), Math.sin(a) * (radius + radius * 0.1), 0)
    t.rotation.z = a
    g.add(t)
  }
  return g
}

/** 歯車ひとつ（材質を共有して描画コールを減らす） */
export function makeGear(radius: number, teeth: number, thickness: number, mat: MeshStandardMaterial, hubMat: MeshStandardMaterial) {
  const g = gearGeometry(radius, teeth, thickness)
  g.traverse((o) => {
    if ((o as Mesh).isMesh) {
      ;(o as Mesh).material = mat
      ;(o as Mesh).castShadow = true
    }
  })
  const hub = new Mesh(new CylinderGeometry(radius * 0.26, radius * 0.26, thickness * 1.5, 12), hubMat)
  hub.rotation.x = Math.PI / 2
  g.add(hub)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const spoke = new Mesh(new BoxGeometry(radius * 1.3, radius * 0.13, thickness * 0.7), hubMat)
    spoke.rotation.z = a
    g.add(spoke)
  }
  return g
}

export class Machinery {
  readonly group = new Group()

  readonly gearTrain: Group[] = []
  readonly loosePart: Group
  readonly socket: Group
  readonly crankGroup = new Group()
  readonly crankWheel = new Group()
  readonly crankKnob: Mesh
  readonly leverGroup = new Group()
  readonly leverArm = new Group()
  readonly beltMesh: Mesh

  /** レイキャスト用 */
  readonly hitLoose: Mesh
  readonly hitSocket: Mesh
  readonly hitCrank: Mesh
  readonly hitLever: Mesh

  private glowRings: Mesh[] = []
  private socketMat: MeshBasicMaterial
  private looseShadow: Mesh
  private leverLight: MeshStandardMaterial
  private crankMat: MeshStandardMaterial

  gearInstalled = false
  crankAngle = 0
  leverPull = 0

  constructor(interior: InteriorLightUniforms) {
    this.group.name = 'machinery'

    const brass = makeBrass(interior)
    const dark = new MeshStandardMaterial({ color: PALETTE.brassDark, roughness: 0.55, metalness: 0.7 })
    attachInterior(dark, interior)
    this.crankMat = brass

    // --- 歯車の板 ---
    const plate = new Group()
    plate.position.copy(MACHINE.plate)
    plate.lookAt(MACHINE.camera.clone().setY(MACHINE.plate.y))
    this.group.add(plate)

    const board = new Mesh(new BoxGeometry(1.45, 1.45, 0.13), new MeshStandardMaterial({ color: 0x5a4e60, roughness: 0.9 }))
    attachInterior(board.material as MeshStandardMaterial, interior)
    board.position.z = -0.13
    board.castShadow = true
    board.receiveShadow = true
    plate.add(board)

    // 大きい歯車 2つは最初から付いている
    const g1 = makeGear(0.44, 14, 0.12, brass, dark)
    g1.position.set(-0.4, 0.3, 0)
    plate.add(g1)
    this.gearTrain.push(g1)

    const g2 = makeGear(0.29, 10, 0.11, brass, dark)
    g2.position.set(0.4, -0.3, 0)
    plate.add(g2)
    this.gearTrain.push(g2)

    // 抜けている歯車の場所（大きな影）
    this.socket = new Group()
    this.socket.position.set(0.14, 0.4, 0)
    plate.add(this.socket)
    this.socketMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })
    const shadowDisc = new Mesh(new PlaneGeometry(0.8, 0.8), new MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, opacity: 0.75, color: 0x000000, depthWrite: false }))
    shadowDisc.position.z = 0.02
    this.socket.add(shadowDisc)
    const outline = new Mesh(new RingGeometry(0.3, 0.36, 24), this.socketMat)
    outline.position.z = 0.03
    this.socket.add(outline)
    const pulse = new Mesh(
      new RingGeometry(0.26, 0.45, 26),
      new MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }),
    )
    pulse.position.z = 0.04
    this.socket.add(pulse)
    this.glowRings.push(pulse)
    this.hitSocket = new Mesh(new PlaneGeometry(1.5, 1.5), new MeshBasicMaterial({ visible: false }))
    this.hitSocket.position.z = 0.08
    this.socket.add(this.hitSocket)

    // 軸受け
    const spindle = new Mesh(new CylinderGeometry(0.06, 0.06, 0.24, 10), dark)
    spindle.rotation.x = Math.PI / 2
    spindle.position.set(0.14, 0.4, -0.02)
    plate.add(spindle)

    // ベルト（歯車から上のレンズ軸へ）
    this.beltMesh = new Mesh(
      new TorusGeometry(0.62, 0.035, 6, 26),
      new MeshStandardMaterial({ color: 0x2f2a35, roughness: 0.95 }),
    )
    attachInterior(this.beltMesh.material as MeshStandardMaterial, interior)
    this.beltMesh.scale.set(1.0, 1.9, 1)
    this.beltMesh.position.set(-0.05, 0.02, -0.04)
    plate.add(this.beltMesh)

    // --- 外れている歯車（床に落ちている） ---
    // 置き台（歯車が手の届く高さにあることが見て分かる）
    const crate = new Mesh(new BoxGeometry(0.9, 0.78, 0.7), new MeshStandardMaterial({ color: 0x7c5c46, roughness: 0.92 }))
    attachInterior(crate.material as MeshStandardMaterial, interior)
    crate.position.set(MACHINE.looseGear.x, FLOOR + 0.39, MACHINE.looseGear.z)
    crate.castShadow = true
    crate.receiveShadow = true
    this.group.add(crate)
    const crateTop = new Mesh(new BoxGeometry(0.98, 0.06, 0.78), new MeshStandardMaterial({ color: 0x96704f, roughness: 0.9 }))
    attachInterior(crateTop.material as MeshStandardMaterial, interior)
    crateTop.position.set(MACHINE.looseGear.x, FLOOR + 0.79, MACHINE.looseGear.z)
    this.group.add(crateTop)

    this.loosePart = new Group()
    this.loosePart.position.copy(MACHINE.looseGear)
    const loose = makeGear(0.4, 12, 0.14, brass, dark)
    loose.rotation.x = Math.PI / 2
    this.loosePart.add(loose)
    const sparkle = new Mesh(
      new RingGeometry(0.36, 0.5, 22),
      new MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false }),
    )
    sparkle.rotation.x = -Math.PI / 2
    sparkle.position.y = 0.02
    this.loosePart.add(sparkle)
    this.glowRings.push(sparkle)
    this.looseShadow = new Mesh(
      new PlaneGeometry(1.1, 1.1),
      new MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, opacity: 0.55, color: 0x000000, depthWrite: false }),
    )
    this.looseShadow.rotation.x = -Math.PI / 2
    this.looseShadow.position.y = -0.19
    this.loosePart.add(this.looseShadow)
    this.hitLoose = new Mesh(new SphereGeometry(0.72, 8, 6), new MeshBasicMaterial({ visible: false }))
    this.loosePart.add(this.hitLoose)
    this.group.add(this.loosePart)

    // --- ハンドル ---
    this.crankGroup.position.copy(MACHINE.crank)
    this.crankGroup.lookAt(MACHINE.camera)
    this.group.add(this.crankGroup)

    const mount = new Mesh(new CylinderGeometry(0.16, 0.22, 0.5, 12), dark)
    mount.rotation.x = Math.PI / 2
    mount.position.z = -0.3
    this.crankGroup.add(mount)

    const rim = new Mesh(new TorusGeometry(0.4, 0.05, 8, 26), brass)
    this.crankWheel.add(rim)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const sp = new Mesh(new BoxGeometry(0.4, 0.05, 0.05), brass)
      sp.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0)
      sp.rotation.z = a
      this.crankWheel.add(sp)
    }
    const hub = new Mesh(new CylinderGeometry(0.1, 0.1, 0.18, 12), dark)
    hub.rotation.x = Math.PI / 2
    this.crankWheel.add(hub)
    this.crankKnob = new Mesh(new SphereGeometry(0.115, 12, 10), new MeshStandardMaterial({ color: PALETTE.coatPink, roughness: 0.45, emissive: 0x55142c }))
    attachInterior(this.crankKnob.material as MeshStandardMaterial, interior)
    this.crankKnob.position.set(0.4, 0, 0.11)
    this.crankWheel.add(this.crankKnob)
    this.crankGroup.add(this.crankWheel)

    const crankGlow = new Mesh(
      new RingGeometry(0.48, 0.63, 26),
      new MeshBasicMaterial({ color: 0xffd6e6, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false }),
    )
    crankGlow.position.z = 0.02
    this.crankGroup.add(crankGlow)
    this.glowRings.push(crankGlow)

    this.hitCrank = new Mesh(new CylinderGeometry(0.7, 0.7, 0.5, 14), new MeshBasicMaterial({ visible: false }))
    this.hitCrank.rotation.x = Math.PI / 2
    this.crankGroup.add(this.hitCrank)

    // --- 大きなスイッチ ---
    this.leverGroup.position.copy(MACHINE.lever)
    this.leverGroup.lookAt(MACHINE.camera.clone().setY(MACHINE.lever.y + 0.25))
    this.group.add(this.leverGroup)

    const panel = new Mesh(new BoxGeometry(0.8, 1.1, 0.18), new MeshStandardMaterial({ color: 0x46538a, roughness: 0.6, metalness: 0.3 }))
    attachInterior(panel.material as MeshStandardMaterial, interior)
    panel.position.z = -0.16
    panel.castShadow = true
    this.leverGroup.add(panel)

    const slot = new Mesh(new BoxGeometry(0.16, 0.78, 0.06), new MeshStandardMaterial({ color: 0x15182c, roughness: 0.9 }))
    slot.position.z = -0.03
    this.leverGroup.add(slot)

    // 上＝消えている、下＝ついている の目印
    this.leverLight = new MeshStandardMaterial({ color: 0x442222, roughness: 0.4, emissive: 0x220505 })
    const bulb = new Mesh(new SphereGeometry(0.1, 12, 10), this.leverLight)
    bulb.position.set(0.28, 0.42, 0.02)
    this.leverGroup.add(bulb)

    const arm = new Mesh(new CylinderGeometry(0.045, 0.058, 0.68, 10), brass)
    arm.position.y = 0.34
    this.leverArm.add(arm)
    const grip = new Mesh(new SphereGeometry(0.125, 14, 12), new MeshStandardMaterial({ color: 0xff6f9c, roughness: 0.35, emissive: 0x5c1030 }))
    attachInterior(grip.material as MeshStandardMaterial, interior)
    grip.position.y = 0.68
    this.leverArm.add(grip)
    this.leverArm.position.set(0, -0.28, 0.08)
    this.leverGroup.add(this.leverArm)

    const leverGlow = new Mesh(
      new RingGeometry(0.24, 0.36, 22),
      new MeshBasicMaterial({ color: 0xffc7e6, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }),
    )
    leverGlow.position.set(0, 0.42, 0.14)
    this.leverGroup.add(leverGlow)
    this.glowRings.push(leverGlow)

    this.hitLever = new Mesh(new BoxGeometry(0.95, 1.5, 0.9), new MeshBasicMaterial({ visible: false }))
    this.hitLever.position.set(0, 0.15, 0.2)
    this.leverGroup.add(this.hitLever)
  }

  /** 光る輪をどれだけ目立たせるか（今やってほしいことだけ光らせる） */
  setHints(which: 'gear' | 'crank' | 'lever' | 'none') {
    const map: Record<string, number> = { socket: 0, loose: 1, crank: 2, lever: 3 }
    const on = which === 'gear' ? [map.socket, map.loose] : which === 'crank' ? [map.crank] : which === 'lever' ? [map.lever] : []
    this.glowRings.forEach((r, i) => {
      r.visible = on.includes(i)
    })
  }

  installGear(target: Object3D) {
    if (this.gearInstalled) return
    this.gearInstalled = true
    const worldPos = new Vector3()
    this.socket.getWorldPosition(worldPos)
    this.loosePart.visible = false
    // 板の上に歯車を生やす
    const g = this.loosePart.children[0] as Group
    this.loosePart.remove(g)
    g.rotation.set(0, 0, 0)
    g.position.set(0, 0, 0)
    target.add(g)
    this.gearTrain.push(g)
    this.socketMat.opacity = 0
    void worldPos
  }

  update(dt: number, time: number, spin: number, lit: boolean) {
    // 歯車が回る（ハンドルとレンズに同期）
    const ratios = [1, -1.5, 1.35]
    this.gearTrain.forEach((g, i) => {
      g.rotation.z = spin * (ratios[i % ratios.length] ?? 1)
    })
    this.beltMesh.rotation.z = spin * 0.3

    // 誘いの微妙な揺れ
    for (const r of this.glowRings) {
      if (!r.visible) continue
      const m = r.material as MeshBasicMaterial
      m.opacity = 0.34 + 0.36 * (0.5 + 0.5 * Math.sin(time * 2.6))
      r.scale.setScalar(1 + 0.11 * Math.sin(time * 2.6))
    }
    if (!this.gearInstalled) {
      this.loosePart.rotation.y = Math.sin(time * 1.4) * 0.25
      this.loosePart.position.y = MACHINE.looseGear.y + Math.sin(time * 2.2) * 0.03
    }

    this.crankWheel.rotation.z = this.crankAngle
    this.leverArm.rotation.x = damp(this.leverArm.rotation.x, this.leverPull * 1.15, 12, dt)

    const on = lit ? 1 : 0
    this.leverLight.emissive.setRGB(0.15 + on * 0.9, 0.05 + on * 0.85, 0.05 + on * 0.4)
    this.leverLight.emissiveIntensity = 0.6 + on * 2.4
    this.leverLight.color.setRGB(0.3 + on * 0.7, 0.15 + on * 0.75, 0.15 + on * 0.4)

    this.crankMat.emissive.setRGB(0.09 + on * 0.16, 0.06 + on * 0.12, 0.02 + on * 0.05)
    ;(this.looseShadow.material as MeshBasicMaterial).opacity = clamp01(0.55 - on * 0.15)
  }
}
