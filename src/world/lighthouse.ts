import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
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
import { buildStepWedge, buildTowerWall, type Hole } from './geom'

/** three が型を公開していないので、onBeforeCompile が受け取る形だけ手で書く */
export interface ShaderLike {
  uniforms: Record<string, { value: unknown }>
  vertexShader: string
  fragmentShader: string
}
import { PALETTE, lerp } from '../core/palette'

export const TOWER = {
  baseY: 1.15,
  topY: 30.0,
  lampFloorY: 30.2,
  lampCeilY: 35.6,
  lensY: 32.85,
  thickness: 0.5,
  rOuterBase: 4.7,
  rOuterTop: 3.5,
  rOuterAt(y: number) {
    const t = Math.min(1, Math.max(0, (y - this.baseY) / (this.topY - this.baseY)))
    return lerp(this.rOuterBase, this.rOuterTop, t)
  },
  rInnerAt(y: number) {
    return this.rOuterAt(y) - this.thickness
  },
}

export const STAIRS = {
  count: 96,
  perLanding: 12,
  landings: 8,
  startY: 1.95,
  rise: (TOWER.lampFloorY - 1.95) / 96,
  anglePerStep: (Math.PI * 2) / 18,
}

export interface LandingInfo {
  index: number
  step: number
  y: number
  angle: number
  windowAngle: number
  windowY: number
  hasWindow: boolean
}

export const LANDINGS: LandingInfo[] = Array.from({ length: STAIRS.landings }, (_, k) => {
  const step = (k + 1) * STAIRS.perLanding
  const y = STAIRS.startY + step * STAIRS.rise
  const angle = step * STAIRS.anglePerStep
  return {
    index: k,
    step,
    y,
    angle,
    windowAngle: angle + 0.62,
    windowY: y + 1.45,
    hasWindow: k < STAIRS.landings - 1,
  }
})

export const DOOR_ANGLE = Math.PI / 2

/** 階段上のカメラ位置（step は連続値でよい） */
export function stairPose(step: number) {
  const y = STAIRS.startY + step * STAIRS.rise
  const angle = step * STAIRS.anglePerStep
  const r = Math.max(1.35, TOWER.rInnerAt(y) - 1.25)
  return { y, angle, r, x: Math.cos(angle) * r, z: Math.sin(angle) * r }
}

// ---------------------------------------------------------------------------
// 材質：窓から差し込む光を最大4つまで手で足して、屋内の「回る影」を作る
// ---------------------------------------------------------------------------

export interface InteriorLightUniforms {
  uWinPos: { value: Vector3[] }
  uWinCol: { value: Color }
  uWinPow: { value: number }
  uLampPos: { value: Vector3 }
  uLampCol: { value: Color }
  uLampPow: { value: number }
  uBeamOrigin: { value: Vector3 }
  uBeamAngle: { value: number }
  uBeamStrength: { value: number }
  uBeamColor: { value: Color }
}

export function makeInteriorUniforms(): InteriorLightUniforms {
  return {
    uWinPos: { value: [new Vector3(999, 0, 0), new Vector3(999, 0, 0), new Vector3(999, 0, 0), new Vector3(999, 0, 0)] },
    uWinCol: { value: new Color(0xffb27a) },
    uWinPow: { value: 1 },
    uLampPos: { value: new Vector3(0, 0, 0) },
    uLampCol: { value: new Color(0xffdcb4) },
    uLampPow: { value: 1 },
    uBeamOrigin: { value: new Vector3(0, TOWER.lensY, 0) },
    uBeamAngle: { value: 0 },
    uBeamStrength: { value: 0 },
    uBeamColor: { value: new Color(0xffe2a0) },
  }
}

const INTERIOR_CHUNK_VERT = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNor;
`
const INTERIOR_CHUNK_FRAG = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNor;
uniform vec3 uWinPos[4];
uniform vec3 uWinCol;
uniform float uWinPow;
uniform vec3 uLampPos;
uniform vec3 uLampCol;
uniform float uLampPow;
uniform vec3 uBeamOrigin;
uniform float uBeamAngle;
uniform float uBeamStrength;
uniform vec3 uBeamColor;

vec3 interiorLight(vec3 albedo) {
  vec3 n = normalize(vWNor);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 dv = uWinPos[i] - vWPos;
    float d2 = dot(dv, dv);
    if (d2 > 400.0) continue;
    vec3 l = dv * inversesqrt(d2);
    float nd = max(dot(n, l), 0.0);
    acc += uWinCol * nd * (2.6 / (1.0 + d2 * 0.55)) * uWinPow;
  }
  vec3 dv = uLampPos - vWPos;
  float d2 = dot(dv, dv);
  vec3 l = dv * inversesqrt(max(d2, 0.0001));
  float nd = max(dot(n, l), 0.0) * 0.7 + 0.3;
  acc += uLampCol * nd * (0.5 / (1.0 + d2 * 0.45)) * uLampPow;

  // 灯台の光が壁や床を舐めていく（回転するレンズの反射）
  if (uBeamStrength > 0.001) {
    vec2 rel = vWPos.xz - uBeamOrigin.xz;
    float a = atan(rel.y, rel.x);
    float best = 0.0;
    for (int i = 0; i < 2; i++) {
      float diff = a - (uBeamAngle + float(i) * 3.14159265);
      diff = atan(sin(diff), cos(diff));
      best = max(best, smoothstep(0.75, 0.05, abs(diff)));
    }
    vec3 bl = normalize(uBeamOrigin - vWPos + vec3(0.0001));
    float bnd = max(dot(n, bl), 0.0) * 0.6 + 0.4;
    float dy = abs(vWPos.y - uBeamOrigin.y);
    acc += uBeamColor * best * bnd * uBeamStrength * (1.9 / (1.0 + dy * dy * 0.35));
  }
  return albedo * acc;
}
`

/** MeshStandardMaterial に屋内ライティングを足す */
export function attachInterior(mat: MeshStandardMaterial, u: InteriorLightUniforms, extra?: (s: ShaderLike) => void) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = INTERIOR_CHUNK_VERT + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
         vWNor = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
       #else
         vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vWNor = normalize(mat3(modelMatrix) * objectNormal);
       #endif`,
    )
    shader.fragmentShader = INTERIOR_CHUNK_FRAG + shader.fragmentShader
    // lights_fragment_end に足すことで、トーンマッピングと霧を正しく通る
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
       reflectedLight.indirectDiffuse += interiorLight(material.diffuseColor);`,
    )
    extra?.(shader)
  }
  mat.customProgramCacheKey = () => 'interior'
  return mat
}

// ---------------------------------------------------------------------------

function stripeInject(shader: ShaderLike) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
     {
       vec3 radial = normalize(vec3(vWPos.x, 0.0, vWPos.z) + vec3(0.0001));
       float outer = smoothstep(0.15, 0.6, dot(normalize(vWNor), radial));
       float f = fract(vWPos.y * 0.105 + 0.1);
       float band = smoothstep(0.30, 0.40, f) * smoothstep(0.74, 0.64, f);
       vec3 outerCol = mix(vec3(0.992, 0.965, 0.937), vec3(1.0, 0.62, 0.72), band);

       // 内側は石積み。目地があることで、のぼるときの回転が体で分かる。
       float ang = atan(vWPos.z, vWPos.x);
       float row = floor(vWPos.y * 1.9);
       float col2 = ang * 3.6 + mod(row, 2.0) * 0.5;
       float mortarY = smoothstep(0.0, 0.10, fract(vWPos.y * 1.9)) * smoothstep(1.0, 0.90, fract(vWPos.y * 1.9));
       float mortarX = smoothstep(0.0, 0.07, fract(col2)) * smoothstep(1.0, 0.93, fract(col2));
       float mortar = mortarY * mortarX;
       float tone = 0.82 + 0.18 * fract(sin(row * 12.9898 + floor(col2) * 78.233) * 43758.5453);
       vec3 innerCol = mix(vec3(0.14, 0.15, 0.20), vec3(0.33, 0.34, 0.40) * tone, mortar);
       diffuseColor.rgb *= mix(innerCol, outerCol, outer);
     }`,
  )
}

export class Lighthouse {
  readonly group = new Group()
  readonly interior: InteriorLightUniforms
  readonly doorPivot = new Group()
  readonly stairGroup = new Group()
  readonly lampRoom = new Group()
  readonly gallery = new Group()
  readonly decorations: { obj: Object3D; landing: number; icon: string; id: string }[] = []
  readonly windowShutters: { pivot: Group; landing: number; open: boolean }[] = []
  readonly glassPanes: Mesh[] = []
  readonly stripeMats: MeshStandardMaterial[] = []
  readonly workLampPos = new Vector3()
  private roofStar!: Mesh
  private wallMat!: MeshStandardMaterial

  constructor(quality: number) {
    this.interior = makeInteriorUniforms()
    this.group.name = 'lighthouse'
    this.buildTower(quality)
    this.buildDoor()
    this.buildStairs(quality)
    this.buildGallery()
    this.buildLampRoomShell(quality)
    this.group.add(this.stairGroup, this.lampRoom, this.gallery)
  }

  // --- 塔本体 -------------------------------------------------------------

  private buildTower(quality: number) {
    const holes: Hole[] = [{ a: DOOR_ANGLE, aw: 0.185, y0: TOWER.baseY, y1: TOWER.baseY + 3.1 }]
    for (const L of LANDINGS) {
      if (!L.hasWindow) continue
      holes.push({ a: L.windowAngle, aw: 0.175, y0: L.y + 0.75, y1: L.y + 2.35 })
    }

    const geo = buildTowerWall({
      y0: TOWER.baseY,
      y1: TOWER.topY,
      radiusAt: (t) => lerp(TOWER.rOuterBase, TOWER.rOuterTop, t),
      thickness: TOWER.thickness,
      radialSeg: quality > 0.6 ? 64 : 44,
      heightSeg: quality > 0.6 ? 96 : 64,
      holes,
    })

    const mat = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.0,
      side: DoubleSide,
    })
    attachInterior(mat, this.interior, stripeInject)
    mat.customProgramCacheKey = () => 'tower-wall'
    this.wallMat = mat

    const wall = new Mesh(geo, mat)
    wall.castShadow = true
    wall.receiveShadow = true
    wall.name = 'towerWall'
    this.group.add(wall)

    // 土台のふくらみ
    const plinth = new Mesh(
      new CylinderGeometry(TOWER.rOuterBase + 0.55, TOWER.rOuterBase + 1.15, 1.5, 40),
      new MeshStandardMaterial({ color: 0xe9dfd6, roughness: 0.95 }),
    )
    attachInterior(plinth.material as MeshStandardMaterial, this.interior)
    plinth.position.y = TOWER.baseY - 0.15
    plinth.castShadow = true
    plinth.receiveShadow = true
    this.group.add(plinth)

    // 1階の床
    const floor = new Mesh(
      new CylinderGeometry(TOWER.rOuterBase - TOWER.thickness, TOWER.rOuterBase - TOWER.thickness, 0.3, 40),
      new MeshStandardMaterial({ color: PALETTE.woodDark, roughness: 0.9 }),
    )
    attachInterior(floor.material as MeshStandardMaterial, this.interior)
    floor.position.y = TOWER.baseY + 0.15
    floor.receiveShadow = true
    this.group.add(floor)

    // 窓わく（外側から見たときの表情）
    for (const L of LANDINGS) {
      if (!L.hasWindow) continue
      const frame = this.makeWindowFrame(L)
      this.group.add(frame)
    }
  }

  private makeWindowFrame(L: LandingInfo) {
    const g = new Group()
    const y = L.y + 1.55
    const r = TOWER.rOuterAt(y)
    const mat = new MeshStandardMaterial({ color: PALETTE.towerRoof, roughness: 0.55, metalness: 0.15 })
    attachInterior(mat, this.interior)
    const ring = new Mesh(new TorusGeometry(0.85, 0.1, 8, 20), mat)
    ring.scale.set(1, 1.15, 1)
    ring.position.set(Math.cos(L.windowAngle) * (r + 0.02), y, Math.sin(L.windowAngle) * (r + 0.02))
    ring.lookAt(new Vector3(0, y, 0))
    g.add(ring)

    // 開ける小窓（内側の雨戸）
    const shutterPivot = new Group()
    const inner = TOWER.rInnerAt(y)
    shutterPivot.position.set(
      Math.cos(L.windowAngle) * inner - Math.sin(L.windowAngle) * 0.62,
      y,
      Math.sin(L.windowAngle) * inner + Math.cos(L.windowAngle) * 0.62,
    )
    shutterPivot.rotation.y = -L.windowAngle
    const shMat = new MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 })
    attachInterior(shMat, this.interior)
    const shutter = new Mesh(new BoxGeometry(0.09, 1.75, 1.25), shMat)
    shutter.position.set(0.02, 0, -0.6)
    shutter.castShadow = true
    // 取っ手
    const knob = new Mesh(
      new SphereGeometry(0.075, 10, 8),
      new MeshStandardMaterial({ color: PALETTE.brassBright, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a10 }),
    )
    knob.position.set(-0.09, 0, -1.1)
    shutter.add(knob)
    shutterPivot.add(shutter)
    g.add(shutterPivot)
    this.windowShutters.push({ pivot: shutterPivot, landing: L.index, open: false })
    return g
  }

  private buildDoor() {
    const y = TOWER.baseY
    const r = TOWER.rOuterAt(y + 1.5) - TOWER.thickness * 0.5
    const pivotOffset = 0.82
    this.doorPivot.position.set(
      Math.cos(DOOR_ANGLE) * r - Math.sin(DOOR_ANGLE) * pivotOffset,
      y,
      Math.sin(DOOR_ANGLE) * r + Math.cos(DOOR_ANGLE) * pivotOffset,
    )
    this.doorPivot.rotation.y = -DOOR_ANGLE

    const mat = new MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.78 })
    attachInterior(mat, this.interior)
    const door = new Mesh(new BoxGeometry(0.16, 3.0, 1.6), mat)
    door.position.set(0, 1.5, -0.8)
    door.castShadow = true
    door.receiveShadow = true

    const plankMat = new MeshStandardMaterial({ color: PALETTE.woodDark, roughness: 0.8 })
    attachInterior(plankMat, this.interior)
    for (let i = 0; i < 2; i++) {
      const band = new Mesh(new BoxGeometry(0.2, 0.14, 1.62), plankMat)
      band.position.set(0.01, 0.6 + i * 1.5, 0)
      door.add(band)
    }
    const handle = new Mesh(
      new TorusGeometry(0.16, 0.045, 8, 16),
      new MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.25, metalness: 0.85, emissive: 0x2a1c06 }),
    )
    handle.position.set(-0.11, 1.45, -1.42)
    handle.rotation.y = Math.PI / 2
    door.add(handle)

    // ハートの窓（4歳の目印）
    const heart = new Mesh(
      new SphereGeometry(0.13, 10, 8),
      new MeshStandardMaterial({ color: PALETTE.coatPink, emissive: 0x9c3050, emissiveIntensity: 0.6, roughness: 0.5 }),
    )
    heart.position.set(-0.09, 2.35, -0.8)
    heart.scale.set(0.5, 1, 1)
    door.add(heart)

    this.doorPivot.add(door)
    this.group.add(this.doorPivot)
  }

  // --- 階段 ---------------------------------------------------------------

  private buildStairs(quality: number) {
    const stepMat = new MeshStandardMaterial({ color: 0xa08464, roughness: 0.9 })
    attachInterior(stepMat, this.interior)
    const stepGeo = buildStepWedge(0.52, 3.85, STAIRS.anglePerStep * 0.52, 0.16, quality > 0.6 ? 6 : 4)
    const landingGeo = buildStepWedge(0.52, 4.05, STAIRS.anglePerStep * 0.64, 0.2, quality > 0.6 ? 7 : 5)

    const landingCount = Math.floor(STAIRS.count / STAIRS.perLanding)
    const stepMesh = new InstancedMesh(stepGeo, stepMat, STAIRS.count - landingCount)
    const landingMesh = new InstancedMesh(landingGeo, stepMat, landingCount)
    stepMesh.receiveShadow = true
    landingMesh.receiveShadow = true
    const dummy = new Object3D()
    let si = 0
    let li = 0
    for (let i = 1; i <= STAIRS.count; i++) {
      const y = STAIRS.startY + i * STAIRS.rise
      const a = i * STAIRS.anglePerStep
      const isLanding = i % STAIRS.perLanding === 0
      dummy.position.set(0, y, 0)
      dummy.rotation.set(0, a, 0)
      // 塔がすぼまるので、上ほど段も短く
      const shrink = TOWER.rInnerAt(y) / TOWER.rInnerAt(STAIRS.startY)
      dummy.scale.set(shrink, 1, shrink)
      dummy.updateMatrix()
      if (isLanding) landingMesh.setMatrixAt(li++, dummy.matrix)
      else stepMesh.setMatrixAt(si++, dummy.matrix)
    }
    stepMesh.instanceMatrix.needsUpdate = true
    landingMesh.instanceMatrix.needsUpdate = true
    this.stairGroup.add(stepMesh, landingMesh)

    // 中心の柱
    const colMat = new MeshStandardMaterial({ color: 0x8d7f74, roughness: 0.9 })
    attachInterior(colMat, this.interior)
    const col = new Mesh(new CylinderGeometry(0.5, 0.56, TOWER.lampFloorY - TOWER.baseY, 20), colMat)
    col.position.y = (TOWER.lampFloorY + TOWER.baseY) / 2
    col.receiveShadow = true
    this.stairGroup.add(col)

    // らせんの手すり（ぐるぐる上がっている感じの主役）
    this.buildHandrail(quality)

    // 踊り場のちいさな発見
    this.buildDiscoveries()
  }

  private buildHandrail(quality: number) {
    const segs = quality > 0.6 ? 420 : 260
    const pts: number[] = []
    const idx: number[] = []
    const nor: number[] = []
    const tubeR = 0.055
    const around = quality > 0.6 ? 6 : 4
    for (let s = 0; s <= segs; s++) {
      const t = s / segs
      const step = t * STAIRS.count
      const y = STAIRS.startY + step * STAIRS.rise + 0.95
      const a = step * STAIRS.anglePerStep
      const rr = Math.max(1.0, TOWER.rInnerAt(y) - 0.42)
      const cx = Math.cos(a) * rr
      const cz = Math.sin(a) * rr
      const tang = new Vector3(-Math.sin(a) * rr, STAIRS.rise / STAIRS.anglePerStep, Math.cos(a) * rr).normalize()
      const up = new Vector3(0, 1, 0)
      const side = new Vector3().crossVectors(tang, up).normalize()
      const nUp = new Vector3().crossVectors(side, tang).normalize()
      for (let k = 0; k < around; k++) {
        const ang = (k / around) * Math.PI * 2
        const n = side.clone().multiplyScalar(Math.cos(ang)).addScaledVector(nUp, Math.sin(ang))
        pts.push(cx + n.x * tubeR, y + n.y * tubeR, cz + n.z * tubeR)
        nor.push(n.x, n.y, n.z)
      }
      if (s > 0) {
        const b0 = (s - 1) * around
        const b1 = s * around
        for (let k = 0; k < around; k++) {
          const k2 = (k + 1) % around
          idx.push(b0 + k, b1 + k, b1 + k2, b0 + k, b1 + k2, b0 + k2)
        }
      }
    }
    const rail = new Mesh(bufferFrom(pts, nor, idx), makeBrass(this.interior))
    rail.name = 'handrail'
    this.stairGroup.add(rail)

    // 支柱（こちらもインスタンス化）
    const postMat = makeBrass(this.interior)
    const postCount = Math.floor(STAIRS.count / 3)
    const posts = new InstancedMesh(new CylinderGeometry(0.028, 0.028, 0.95, 6), postMat, postCount)
    const d2 = new Object3D()
    for (let k = 0; k < postCount; k++) {
      const i = (k + 1) * 3
      const y = STAIRS.startY + i * STAIRS.rise
      const a = i * STAIRS.anglePerStep
      const rr = Math.max(1.0, TOWER.rInnerAt(y) - 0.42)
      d2.position.set(Math.cos(a) * rr, y + 0.48, Math.sin(a) * rr)
      d2.rotation.set(0, 0, 0)
      d2.scale.setScalar(1)
      d2.updateMatrix()
      posts.setMatrixAt(k, d2.matrix)
    }
    posts.instanceMatrix.needsUpdate = true
    this.stairGroup.add(posts)
  }

  private buildDiscoveries() {
    const defs: { id: string; icon: string; make: () => Object3D }[] = [
      { id: 'shell', icon: '🐚', make: () => makeShell() },
      { id: 'cat', icon: '🐱', make: () => makeCat() },
      { id: 'bottle', icon: '🫙', make: () => makeBottle() },
      { id: 'star', icon: '⭐', make: () => makeStarToy() },
      { id: 'bird', icon: '🐦', make: () => makeGull(0.55) },
      { id: 'flower', icon: '🌷', make: () => makeFlowerPot() },
      { id: 'music', icon: '🎵', make: () => makeMusicBox() },
      { id: 'ribbon', icon: '🎀', make: () => makeRibbon() },
    ]
    // 毎回ちがう並びになるように軽くシャッフル
    const order = defs.map((d, i) => ({ d, k: Math.sin(i * 12.9898 + Math.random() * 100) }))
    order.sort((a, b) => a.k - b.k)

    LANDINGS.forEach((L, i) => {
      const def = order[i % order.length].d
      const obj = def.make()
      // 最後の踊り場は灯室の床なので、機械のじゃまにならない隅へ置く
      const last = i === LANDINGS.length - 1
      const rr = last ? 3.5 : Math.max(1.1, TOWER.rInnerAt(L.y) - 0.85)
      const a = last ? -2.35 : L.angle + 0.18
      obj.position.set(Math.cos(a) * rr, L.y + 0.06, Math.sin(a) * rr)
      obj.rotation.y = -a + Math.PI
      obj.traverse((o) => {
        const mm = (o as Mesh).material
        if (mm && mm instanceof MeshStandardMaterial) attachInterior(mm, this.interior)
        if ((o as Mesh).isMesh) (o as Mesh).castShadow = true
      })
      // 接触影
      const shadow = new Mesh(
        new PlaneGeometry(0.9, 0.9),
        new MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, opacity: 0.5, depthWrite: false, color: 0x000000 }),
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.position.y = 0.012
      shadow.renderOrder = 2
      obj.add(shadow)

      this.stairGroup.add(obj)
      this.decorations.push({ obj, landing: L.index, icon: def.icon, id: def.id })
    })
  }

  // --- 灯室まわり ---------------------------------------------------------

  private buildGallery() {
    const y = TOWER.topY
    const r = TOWER.rOuterTop + 1.5
    const deckMat = new MeshStandardMaterial({ color: 0x5a6a92, roughness: 0.7, metalness: 0.2 })
    attachInterior(deckMat, this.interior)
    const deck = new Mesh(new CylinderGeometry(r, r - 0.1, 0.28, 40), deckMat)
    deck.position.y = y + 0.1
    deck.castShadow = true
    deck.receiveShadow = true
    this.gallery.add(deck)

    const railMat = makeBrass(this.interior)
    const top = new Mesh(new TorusGeometry(r - 0.12, 0.06, 8, 44), railMat)
    top.rotation.x = Math.PI / 2
    top.position.y = y + 1.15
    this.gallery.add(top)
    const mid = new Mesh(new TorusGeometry(r - 0.12, 0.04, 6, 44), railMat)
    mid.rotation.x = Math.PI / 2
    mid.position.y = y + 0.65
    this.gallery.add(mid)
    const balusters = new InstancedMesh(new CylinderGeometry(0.035, 0.035, 1.1, 6), railMat, 24)
    const d3 = new Object3D()
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      d3.position.set(Math.cos(a) * (r - 0.12), y + 0.68, Math.sin(a) * (r - 0.12))
      d3.updateMatrix()
      balusters.setMatrixAt(i, d3.matrix)
    }
    balusters.instanceMatrix.needsUpdate = true
    this.gallery.add(balusters)
  }

  private buildLampRoomShell(quality: number) {
    const y0 = TOWER.lampFloorY
    const y1 = TOWER.lampCeilY
    // 本物の灯台と同じように、灯室は塔よりひとまわり広い。
    // 作業がしやすく、外の海もよく見える。
    const r = TOWER.rOuterTop + 0.7

    // 床
    const floorMat = new MeshStandardMaterial({ color: 0x8c7a68, roughness: 0.85 })
    attachInterior(floorMat, this.interior)
    const floor = new Mesh(new CylinderGeometry(r + 0.2, r + 0.2, 0.24, 32), floorMat)
    floor.position.y = y0 - 0.12
    floor.receiveShadow = true
    this.lampRoom.add(floor)

    // 階段からの上がり口（穴のふちの飾り）
    const hatch = new Mesh(new TorusGeometry(1.0, 0.08, 8, 22), makeBrass(this.interior))
    hatch.rotation.x = Math.PI / 2
    hatch.position.set(Math.cos(-2.2) * 2.5, y0 + 0.04, Math.sin(-2.2) * 2.5)
    this.lampRoom.add(hatch)

    // 縦の柱（ガラスのわく）
    const ribMat = makeBrass(this.interior)
    const ribs = 12
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI * 2
      const p = new Mesh(new CylinderGeometry(0.075, 0.085, y1 - y0 - 0.4, 6), ribMat)
      p.position.set(Math.cos(a) * r, (y0 + y1) / 2 - 0.2, Math.sin(a) * r)
      p.castShadow = true
      this.lampRoom.add(p)
    }
    // 上下のわく
    for (const yy of [y0 + 0.12, y1 - 0.45]) {
      const t = new Mesh(new TorusGeometry(r, 0.09, 8, 36), ribMat)
      t.rotation.x = Math.PI / 2
      t.position.y = yy
      this.lampRoom.add(t)
    }

    // ガラス（外が見える）
    const glassMat = new MeshStandardMaterial({
      color: 0xdff2ff,
      transparent: true,
      opacity: 0.06,
      roughness: 0.06,
      metalness: 0.0,
      side: DoubleSide,
      depthWrite: false,
    })
    const glass = new Mesh(new CylinderGeometry(r - 0.02, r - 0.02, y1 - y0 - 0.6, quality > 0.6 ? 36 : 24, 1, true), glassMat)
    glass.position.y = (y0 + y1) / 2 - 0.2
    glass.renderOrder = 6
    this.glassPanes.push(glass)
    this.lampRoom.add(glass)

    // 屋根
    const roofMat = new MeshStandardMaterial({ color: PALETTE.towerRoof, roughness: 0.55, metalness: 0.25 })
    attachInterior(roofMat, this.interior)
    const roof = new Mesh(new ConeGeometry(r + 0.6, 2.1, 24), roofMat)
    roof.position.y = y1 + 0.5
    roof.castShadow = true
    this.lampRoom.add(roof)
    const roofIn = new Mesh(new ConeGeometry(r + 0.55, 2.0, 24, 1, true), new MeshStandardMaterial({ color: 0x2a3050, roughness: 0.9, side: BackSide }))
    attachInterior(roofIn.material as MeshStandardMaterial, this.interior)
    roofIn.position.y = y1 + 0.45
    this.lampRoom.add(roofIn)

    // 作業用の吊りランプ（灯室がちゃんと見える）
    const hang = new Group()
    hang.position.set(0, y1 - 0.55, 1.9)
    const cord = new Mesh(new CylinderGeometry(0.012, 0.012, 0.55, 5), new MeshStandardMaterial({ color: 0x2a2530 }))
    cord.position.y = 0.28
    hang.add(cord)
    const shade = new Mesh(new ConeGeometry(0.32, 0.3, 14, 1, true), ribMat)
    hang.add(shade)
    const bulbMat = new MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xffce7e, emissiveIntensity: 2.6, roughness: 0.4 })
    const bulb = new Mesh(new SphereGeometry(0.13, 12, 10), bulbMat)
    bulb.position.y = -0.13
    hang.add(bulb)
    this.workLampPos.set(0, y1 - 0.72, 1.9)
    this.lampRoom.add(hang)

    // てっぺんのお星さま
    const star = new Mesh(
      new IcosahedronGeometry(0.34, 0),
      new MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcf60, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.3 }),
    )
    star.position.y = y1 + 1.75
    this.lampRoom.add(star)
    this.roofStar = star

    const finial = new Mesh(new CylinderGeometry(0.05, 0.07, 0.9, 8), makeBrass(this.interior))
    finial.position.y = y1 + 1.25
    this.lampRoom.add(finial)
  }

  // --- 更新 ---------------------------------------------------------------

  /** 直近の窓4つを屋内ライトとして選ぶ */
  updateWindowLights(camY: number, dayLight: Color, strength: number) {
    const arr = this.interior.uWinPos.value
    const sorted = LANDINGS.filter((l) => l.hasWindow)
      .map((l) => ({ l, d: Math.abs(l.windowY - camY) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
    for (let i = 0; i < 4; i++) {
      if (i < sorted.length) {
        const L = sorted[i].l
        const r = TOWER.rInnerAt(L.windowY) - 0.1
        arr[i].set(Math.cos(L.windowAngle) * r, L.windowY, Math.sin(L.windowAngle) * r)
      } else {
        arr[i].set(9999, 0, 0)
      }
    }
    // 扉が開いていれば入り口も光源に
    this.interior.uWinCol.value.copy(dayLight)
    this.interior.uWinPow.value = strength
  }

  update(time: number) {
    this.roofStar.rotation.y = time * 0.4
    this.roofStar.rotation.x = Math.sin(time * 0.6) * 0.2
  }

  get wallMaterial() { return this.wallMat }
}

// ---------------------------------------------------------------------------
// 小物
// ---------------------------------------------------------------------------

function bufferFrom(pos: number[], nor: number[], idx: number[]) {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  return geo
}

export function makeBrass(u: InteriorLightUniforms) {
  const m = new MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.32, metalness: 0.85, emissive: 0x180f04 })
  attachInterior(m, u)
  return m
}

let _shadowTex: CanvasTexture | null = null
export function contactShadowTexture() {
  if (_shadowTex) return _shadowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62)
  grd.addColorStop(0, 'rgba(0,0,0,0.85)')
  grd.addColorStop(0.55, 'rgba(0,0,0,0.35)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  _shadowTex = new CanvasTexture(c)
  return _shadowTex
}

function std(color: number, rough = 0.7, metal = 0.0, emissive = 0x000000) {
  return new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive })
}

function makeShell() {
  const g = new Group()
  const s = new Mesh(new SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), std(0xffd9e2, 0.55))
  s.rotation.x = Math.PI
  s.scale.set(1, 0.55, 1)
  s.position.y = 0.12
  g.add(s)
  for (let i = 0; i < 6; i++) {
    const rib = new Mesh(new BoxGeometry(0.02, 0.02, 0.46), std(0xf5b8c8, 0.6))
    rib.position.y = 0.13
    rib.rotation.y = (i / 6) * Math.PI
    g.add(rib)
  }
  return g
}

function makeCat() {
  const g = new Group()
  const body = new Mesh(new SphereGeometry(0.3, 14, 12), std(0xf1e4d6, 0.85))
  body.scale.set(1.25, 0.85, 1)
  body.position.y = 0.26
  g.add(body)
  const head = new Mesh(new SphereGeometry(0.2, 14, 12), std(0xf7ece0, 0.85))
  head.position.set(0.28, 0.5, 0)
  g.add(head)
  for (const s of [-1, 1]) {
    const ear = new Mesh(new ConeGeometry(0.08, 0.15, 4), std(0xffc0cf, 0.8))
    ear.position.set(0.28, 0.66, s * 0.11)
    g.add(ear)
  }
  const tail = new Mesh(new TorusGeometry(0.16, 0.035, 6, 12, Math.PI * 1.3), std(0xf1e4d6, 0.85))
  tail.position.set(-0.34, 0.32, 0)
  tail.rotation.set(Math.PI / 2, 0, 0.6)
  g.add(tail)
  for (const s of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.032, 8, 6), std(0x2a2430, 0.4, 0, 0x111111))
    eye.position.set(0.44, 0.53, s * 0.075)
    g.add(eye)
  }
  return g
}

function makeBottle() {
  const g = new Group()
  const b = new Mesh(new CylinderGeometry(0.11, 0.13, 0.4, 12), new MeshStandardMaterial({ color: 0x9fd6c8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.65 }))
  b.position.y = 0.2
  g.add(b)
  const neck = new Mesh(new CylinderGeometry(0.05, 0.08, 0.18, 10), new MeshStandardMaterial({ color: 0x9fd6c8, roughness: 0.15, transparent: true, opacity: 0.65 }))
  neck.position.y = 0.47
  g.add(neck)
  const cork = new Mesh(new CylinderGeometry(0.05, 0.05, 0.09, 8), std(0xc79a63, 0.9))
  cork.position.y = 0.6
  g.add(cork)
  const note = new Mesh(new BoxGeometry(0.06, 0.22, 0.12), std(0xfff6e0, 0.9))
  note.position.y = 0.2
  note.rotation.z = 0.3
  g.add(note)
  return g
}

function makeStarToy() {
  const g = new Group()
  const m = std(0xffe6a0, 0.4, 0.2, 0xffbe4a)
  ;(m as MeshStandardMaterial).emissiveIntensity = 0.45
  const core = new Mesh(new IcosahedronGeometry(0.2, 0), m)
  core.position.y = 0.24
  g.add(core)
  const base = new Mesh(new CylinderGeometry(0.13, 0.16, 0.08, 10), std(0xd9a441, 0.4, 0.7))
  base.position.y = 0.04
  g.add(base)
  return g
}

export function makeGull(scale = 1) {
  const g = new Group()
  const body = new Mesh(new SphereGeometry(0.2, 12, 10), std(0xfdfdff, 0.75))
  body.scale.set(1.5, 0.85, 0.85)
  g.add(body)
  const head = new Mesh(new SphereGeometry(0.12, 12, 10), std(0xfdfdff, 0.75))
  head.position.set(0.26, 0.14, 0)
  g.add(head)
  const beak = new Mesh(new ConeGeometry(0.04, 0.16, 6), std(0xffb03a, 0.5))
  beak.position.set(0.42, 0.13, 0)
  beak.rotation.z = -Math.PI / 2
  g.add(beak)
  for (const s of [-1, 1]) {
    const w = new Mesh(new BoxGeometry(0.34, 0.035, 0.5), std(0xe7e9f2, 0.8))
    w.position.set(-0.03, 0.06, s * 0.28)
    w.rotation.x = s * 0.18
    w.name = 'wing'
    g.add(w)
  }
  const tail = new Mesh(new BoxGeometry(0.22, 0.03, 0.2), std(0xe7e9f2, 0.8))
  tail.position.set(-0.3, 0.04, 0)
  g.add(tail)
  g.scale.setScalar(scale)
  return g
}

function makeFlowerPot() {
  const g = new Group()
  const pot = new Mesh(new CylinderGeometry(0.16, 0.12, 0.22, 12), std(0xd98a6a, 0.9))
  pot.position.y = 0.11
  g.add(pot)
  const soil = new Mesh(new CylinderGeometry(0.15, 0.15, 0.03, 12), std(0x4a3a30, 1))
  soil.position.y = 0.22
  g.add(soil)
  const colors = [0xff9ec4, 0xffd76e, 0xb9a6ff]
  for (let i = 0; i < 3; i++) {
    const stem = new Mesh(new CylinderGeometry(0.014, 0.014, 0.26, 5), std(0x6faa5a, 0.9))
    const a = (i / 3) * Math.PI * 2
    stem.position.set(Math.cos(a) * 0.06, 0.35, Math.sin(a) * 0.06)
    g.add(stem)
    const fl = new Mesh(new SphereGeometry(0.075, 10, 8), std(colors[i], 0.6))
    fl.position.set(Math.cos(a) * 0.06, 0.5, Math.sin(a) * 0.06)
    fl.scale.set(1, 0.75, 1)
    g.add(fl)
  }
  return g
}

function makeMusicBox() {
  const g = new Group()
  const box = new Mesh(new BoxGeometry(0.34, 0.2, 0.26), std(0x8a6350, 0.7))
  box.position.y = 0.1
  g.add(box)
  const lid = new Mesh(new BoxGeometry(0.36, 0.05, 0.28), std(0xb58a6f, 0.6))
  lid.position.y = 0.22
  lid.rotation.z = 0.12
  g.add(lid)
  const key = new Mesh(new TorusGeometry(0.06, 0.018, 6, 12), std(PALETTE.brass, 0.3, 0.8))
  key.position.set(0.2, 0.1, 0)
  key.rotation.y = Math.PI / 2
  g.add(key)
  const note = new Mesh(new SphereGeometry(0.05, 8, 6), std(0xffc7e6, 0.5, 0, 0x883355))
  note.position.set(0, 0.36, 0)
  g.add(note)
  return g
}

function makeRibbon() {
  const g = new Group()
  const mat = std(PALETTE.coatPink, 0.6)
  for (const s of [-1, 1]) {
    const loop = new Mesh(new TorusGeometry(0.13, 0.05, 8, 14), mat)
    loop.position.set(s * 0.13, 0.16, 0)
    loop.rotation.set(Math.PI / 2, 0, s * 0.5)
    loop.scale.set(1, 0.7, 1)
    g.add(loop)
  }
  const knot = new Mesh(new SphereGeometry(0.07, 10, 8), std(0xff6f9c, 0.55))
  knot.position.y = 0.16
  g.add(knot)
  return g
}

/** 岩の島 */
export function makeIsland(u: InteriorLightUniforms) {
  const g = new Group()
  const rockMat = new MeshStandardMaterial({ color: PALETTE.rock, roughness: 1.0, flatShading: true })
  attachInterior(rockMat, u)
  const main = new Mesh(new IcosahedronGeometry(11, 2), rockMat)
  // でこぼこにする
  const pos = main.geometry.getAttribute('position') as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const n = Math.sin(x * 0.5) * Math.cos(z * 0.42) * 0.8 + Math.sin(y * 0.7 + x * 0.2) * 0.5
    const l = Math.sqrt(x * x + y * y + z * z)
    const s = 1 + n * 0.08
    pos.setXYZ(i, (x / l) * l * s, (y / l) * l * s, (z / l) * l * s)
  }
  main.geometry.computeVertexNormals()
  main.scale.set(1.35, 0.42, 1.35)
  main.position.y = -2.4
  main.receiveShadow = true
  main.castShadow = true
  g.add(main)

  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4
    const r = 11 + Math.sin(i * 3.1) * 3
    const rock = new Mesh(new IcosahedronGeometry(1.2 + Math.abs(Math.sin(i * 2.7)) * 1.4, 0), rockMat)
    rock.position.set(Math.cos(a) * r, -0.5 + Math.sin(i) * 0.4, Math.sin(a) * r)
    rock.rotation.set(i, i * 2, i * 0.5)
    rock.scale.set(1, 0.7, 1)
    rock.castShadow = true
    rock.receiveShadow = true
    g.add(rock)
  }

  // 岩まわりの白波
  const foam = new Mesh(
    new RingGeometry(12.5, 17.5, 48),
    new MeshBasicMaterial({ color: 0xdfe7f5, transparent: true, opacity: 0.2, depthWrite: false }),
  )
  foam.rotation.x = -Math.PI / 2
  foam.position.y = 0.12
  foam.renderOrder = 1
  foam.name = 'foam'
  g.add(foam)
  return g
}
