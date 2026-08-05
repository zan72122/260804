import { BufferAttribute, BufferGeometry, Vector3 } from 'three'

/** 明示的な法線つきでクアッドを積んでいく簡易ビルダ */
export class QuadBuilder {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  idx: number[] = []
  private count = 0

  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, n?: Vector3, uvScale = 1) {
    const nn = n ?? faceNormal(a, b, c)
    const base = this.count
    for (const v of [a, b, c, d]) {
      this.pos.push(v.x, v.y, v.z)
      this.nor.push(nn.x, nn.y, nn.z)
    }
    this.uv.push(0, 0, uvScale, 0, uvScale, uvScale, 0, uvScale)
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    this.count += 4
  }

  /** 頂点ごとに別の法線を与えるクアッド（円筒のなめらか面用） */
  quadN(a: Vector3, b: Vector3, c: Vector3, d: Vector3, na: Vector3, nb: Vector3, nc: Vector3, nd: Vector3, uvs?: number[]) {
    const base = this.count
    const vs = [a, b, c, d]
    const ns = [na, nb, nc, nd]
    for (let i = 0; i < 4; i++) {
      this.pos.push(vs[i].x, vs[i].y, vs[i].z)
      this.nor.push(ns[i].x, ns[i].y, ns[i].z)
    }
    if (uvs) this.uv.push(...uvs)
    else this.uv.push(0, 0, 1, 0, 1, 1, 0, 1)
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    this.count += 4
  }

  build() {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3))
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

function faceNormal(a: Vector3, b: Vector3, c: Vector3) {
  return new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize()
}

export interface Hole {
  /** 角度（ラジアン、中心） */
  a: number
  /** 角度の半幅 */
  aw: number
  y0: number
  y1: number
}

/**
 * 窓の穴があいた、厚みのある塔の壁を作る。
 * 外面・内面・窓のかえし（reveal）を持つので、内側からのぞくと本当に外が見える。
 */
export function buildTowerWall(opts: {
  y0: number
  y1: number
  radiusAt: (t: number) => number
  thickness: number
  radialSeg: number
  heightSeg: number
  holes: Hole[]
}) {
  const { y0, y1, thickness, radialSeg, heightSeg, holes, radiusAt } = opts
  const qb = new QuadBuilder()
  const H = y1 - y0

  const ang = (i: number) => (i / radialSeg) * Math.PI * 2
  const yAt = (j: number) => y0 + (j / heightSeg) * H
  const outerP = (i: number, j: number) => {
    const y = yAt(j)
    const r = radiusAt((y - y0) / H)
    return new Vector3(Math.cos(ang(i)) * r, y, Math.sin(ang(i)) * r)
  }
  const innerP = (i: number, j: number) => {
    const y = yAt(j)
    const r = radiusAt((y - y0) / H) - thickness
    return new Vector3(Math.cos(ang(i)) * r, y, Math.sin(ang(i)) * r)
  }
  const radialN = (i: number, s: number) => new Vector3(Math.cos(ang(i)) * s, 0, Math.sin(ang(i)) * s)

  const inHole = (i: number, j: number) => {
    const aMid = ang(i + 0.5)
    const yMid = yAt(j + 0.5)
    for (const h of holes) {
      let d = aMid - h.a
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      if (Math.abs(d) < h.aw && yMid > h.y0 && yMid < h.y1) return h
    }
    return null
  }

  for (let j = 0; j < heightSeg; j++) {
    for (let i = 0; i < radialSeg; i++) {
      if (inHole(i, j)) continue
      const i2 = (i + 1) % radialSeg
      // 外面
      qb.quadN(
        outerP(i, j), outerP(i, j + 1), outerP(i2, j + 1), outerP(i2, j),
        radialN(i, 1), radialN(i, 1), radialN(i2, 1), radialN(i2, 1),
        [i / radialSeg * 8, j / heightSeg * 8, i / radialSeg * 8, (j + 1) / heightSeg * 8,
         i2 / radialSeg * 8, (j + 1) / heightSeg * 8, i2 / radialSeg * 8, j / heightSeg * 8],
      )
      // 内面（巻きを逆に）
      qb.quadN(
        innerP(i2, j), innerP(i2, j + 1), innerP(i, j + 1), innerP(i, j),
        radialN(i2, -1), radialN(i2, -1), radialN(i, -1), radialN(i, -1),
      )
    }
  }

  // 窓のかえし（穴のふち）
  for (let j = 0; j < heightSeg; j++) {
    for (let i = 0; i < radialSeg; i++) {
      const here = inHole(i, j)
      if (!here) continue
      const i2 = (i + 1) % radialSeg
      const im = (i - 1 + radialSeg) % radialSeg
      const up = new Vector3(0, 1, 0)
      // 下ふち
      if (!inHole(i, j - 1)) {
        qb.quad(innerP(i, j), innerP(i2, j), outerP(i2, j), outerP(i, j), up)
      }
      // 上ふち
      if (!inHole(i, j + 1)) {
        qb.quad(outerP(i, j + 1), outerP(i2, j + 1), innerP(i2, j + 1), innerP(i, j + 1), up.clone().negate())
      }
      // 横ふち
      if (!inHole(im, j)) {
        const t = new Vector3().subVectors(outerP(i, j), outerP(i, j + 1)).normalize().cross(radialN(i, 1)).normalize()
        qb.quad(innerP(i, j), innerP(i, j + 1), outerP(i, j + 1), outerP(i, j), t)
      }
      if (!inHole(i2, j)) {
        const t = new Vector3().subVectors(outerP(i2, j + 1), outerP(i2, j)).normalize().cross(radialN(i2, 1)).normalize()
        qb.quad(outerP(i2, j), outerP(i2, j + 1), innerP(i2, j + 1), innerP(i2, j), t)
      }
    }
  }

  return qb.build()
}

/** らせん階段の一段（扇形のブロック） */
export function buildStepWedge(rIn: number, rOut: number, halfAngle: number, thickness: number, seg = 5) {
  const qb = new QuadBuilder()
  const top = 0
  const bot = -thickness
  const p = (r: number, a: number, y: number) => new Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
  for (let i = 0; i < seg; i++) {
    const a0 = -halfAngle + (i / seg) * halfAngle * 2
    const a1 = -halfAngle + ((i + 1) / seg) * halfAngle * 2
    // 上面
    qb.quad(p(rIn, a0, top), p(rOut, a0, top), p(rOut, a1, top), p(rIn, a1, top), new Vector3(0, 1, 0))
    // 底面
    qb.quad(p(rIn, a1, bot), p(rOut, a1, bot), p(rOut, a0, bot), p(rIn, a0, bot), new Vector3(0, -1, 0))
    // 外側の側面
    const n0 = new Vector3(Math.cos(a0), 0, Math.sin(a0))
    const n1 = new Vector3(Math.cos(a1), 0, Math.sin(a1))
    qb.quadN(p(rOut, a0, bot), p(rOut, a0, top), p(rOut, a1, top), p(rOut, a1, bot), n0, n0, n1, n1)
  }
  // 前後の切り口
  const face = (a: number, s: number) => {
    const n = new Vector3(-Math.sin(a) * s, 0, Math.cos(a) * s)
    if (s > 0) qb.quad(p(rIn, a, bot), p(rOut, a, bot), p(rOut, a, top), p(rIn, a, top), n)
    else qb.quad(p(rIn, a, top), p(rOut, a, top), p(rOut, a, bot), p(rIn, a, bot), n)
  }
  face(halfAngle, 1)
  face(-halfAngle, -1)
  return qb.build()
}
