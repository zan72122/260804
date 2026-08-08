import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { makeRng, randRange } from '../core/util';
import { mergeAll } from './geom';

/**
 * The valley the boat is working in: layered ridge silhouettes, two dark banks
 * with reeds and rocks, drifting mist, and — far upstream — the other boats of
 * the fleet, because ukai is never done alone.
 */
export class Environment {
  readonly group = new Group();
  private mistPanels: Mesh[] = [];
  private farFires: Sprite[] = [];
  private rng = makeRng(7717);

  constructor() {
    this.group.add(this.ridge(-146, 260, 46, 0x070c1a, 0x101830, 0.0, 3));
    this.group.add(this.ridge(-112, 205, 33, 0x04070f, 0x0a1120, 1.4, 2));
    this.group.add(this.ridge(-84, 165, 22, 0x02040a, 0x060a14, 2.9, 1));

    this.group.add(this.bank(-1));
    this.group.add(this.bank(1));
    this.buildMist();
    this.buildFleet();
  }

  /** A ridge line drawn as a vertical gradient silhouette, with pine tops. */
  private ridge(
    z: number,
    width: number,
    height: number,
    lowHex: number,
    topHex: number,
    seed: number,
    trees: number,
  ): Mesh {
    const N = 420;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const col = new Float32Array((N + 1) * 2 * 3);
    const low = new Color(lowHex);
    const top = new Color(topHex);
    const idx: number[] = [];

    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (t - 0.5) * width;
      const u = x * 0.055 + seed;
      let h =
        Math.sin(u) * 0.45 +
        Math.sin(u * 2.13 + 1.7) * 0.26 +
        Math.sin(u * 4.7 + 0.4) * 0.14 +
        Math.sin(u * 9.3 + 2.2) * 0.06;
      h = (h * 0.5 + 0.5) * height + height * 0.22;
      // Pines breaking the skyline near the water's edge.
      if (trees > 0) {
        const tp = Math.sin(u * 7.9 + 3.1) * Math.sin(u * 2.3);
        if (tp > 0.55) {
          const local = (tp - 0.55) / 0.45;
          h += Math.sin(local * Math.PI) * height * 0.035 * trees;
        }
      }
      const b = i * 6;
      pos[b] = x;
      pos[b + 1] = -6;
      pos[b + 2] = z;
      pos[b + 3] = x;
      pos[b + 4] = h;
      pos[b + 5] = z;
      col[b] = low.r;
      col[b + 1] = low.g;
      col[b + 2] = low.b;
      col[b + 3] = top.r;
      col[b + 4] = top.g;
      col[b + 5] = top.b;
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, fog: false }));
    m.frustumCulled = false;
    m.renderOrder = -90;
    return m;
  }

  /** Near bank: real geometry so the kagaribi can just barely rim-light it. */
  private bank(side: number): Group {
    const g = new Group();
    const rng = this.rng;
    const earth = new MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1, metalness: 0 });
    const stone = new MeshStandardMaterial({ color: 0x121214, roughness: 0.92, metalness: 0.02 });
    const reedMat = new MeshStandardMaterial({ color: 0x171a13, roughness: 1, metalness: 0 });

    // A shelving bank rather than a flat plate: the waterline wanders, the
    // ground rises away from it, and the whole thing stays nearly black so it
    // reads as the far side of the dark rather than as lit scenery.
    const N = 96;
    const z0 = 16;
    const z1 = -118;
    const pos: number[] = [];
    const idx: number[] = [];
    const edgeAt = (z: number): number =>
      44 +
      Math.sin(z * 0.031 + side * 1.7) * 1.6 +
      Math.sin(z * 0.011 + side * 4.1) * 3.0 +
      Math.sin(z * 0.09 + side) * 0.5;
    for (let i = 0; i <= N; i++) {
      const z = z0 + ((z1 - z0) * i) / N;
      const e = edgeAt(z);
      const rise = 0.34 + Math.sin(z * 0.03 + side * 2.2) * 0.14 + Math.sin(z * 0.11) * 0.07;
      // waterline, mid slope, top of bank
      pos.push(side * e, -0.04, z);
      pos.push(side * (e + 3.4), rise * 0.45, z);
      pos.push(side * (e + 30), rise * 3.2, z);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 3;
      const b = a + 3;
      for (let k = 0; k < 2; k++) {
        idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
      }
    }
    const bankGeo = new BufferGeometry();
    bankGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    bankGeo.setIndex(idx);
    bankGeo.computeVertexNormals();
    const shore = new Mesh(bankGeo, earth);
    shore.frustumCulled = false;
    g.add(shore);

    // Rounded boulders along the wandering waterline.
    const rocks: Mesh[] = [];
    for (let i = 0; i < 40; i++) {
      const z = randRange(rng, -108, 12);
      const near = 1 - Math.min(1, Math.abs(z + 40) / 64);
      const s = randRange(rng, 0.3, 0.9) * (0.6 + near * 0.9);
      const rock = new Mesh(new IcosahedronGeometry(s, 1), stone);
      rock.position.set(
        side * (edgeAt(z) + randRange(rng, -1.2, 3.2)),
        randRange(rng, -0.35, 0.2),
        z,
      );
      rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      rock.scale.set(1, randRange(rng, 0.4, 0.75), randRange(rng, 0.8, 1.3));
      rocks.push(rock);
    }
    g.add(mergeAll(rocks, stone));

    // Reed clusters catching a sliver of firelight.
    const reeds: Mesh[] = [];
    for (let i = 0; i < 26; i++) {
      const cz = randRange(rng, -84, 10);
      const cx = side * (edgeAt(cz) + randRange(rng, -0.6, 2.4));
      for (let k = 0; k < 5; k++) {
        const h = randRange(rng, 1.2, 2.6);
        const reed = new Mesh(new ConeGeometry(0.045, h, 4, 1, true), reedMat);
        reed.position.set(cx + randRange(rng, -0.5, 0.5), h * 0.5 - 0.2, cz + randRange(rng, -0.6, 0.6));
        reed.rotation.z = randRange(rng, -0.28, 0.28);
        reed.rotation.x = randRange(rng, -0.2, 0.2);
        reeds.push(reed);
      }
    }
    g.add(mergeAll(reeds, reedMat));
    return g;
  }

  private buildMist(): void {
    const tex = mistTexture();
    for (let i = 0; i < 5; i++) {
      const m = new Mesh(
        new PlaneGeometry(90 + i * 22, 11 + i * 2.5),
        new MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          opacity: 0.03 + i * 0.008,
          color: new Color(0x1b2c48),
          fog: false,
        }),
      );
      m.position.set(randRange(this.rng, -8, 8), 0.7 + i * 0.35, -34 - i * 19);
      m.renderOrder = 8;
      this.mistPanels.push(m);
      this.group.add(m);
    }
  }

  /** Other ukai boats working the same reach, far upstream. */
  private buildFleet(): void {
    const glow = fireGlowTexture();
    const hull = new MeshStandardMaterial({ color: 0x030407, roughness: 0.95, metalness: 0 });
    const spots: [number, number][] = [
      [-14, -62],
      [12.5, -80],
      [-6.5, -101],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      const g = new Group();
      const body = new Mesh(new CapsuleGeometry(0.42, 4.2, 4, 8), hull);
      body.rotation.z = Math.PI / 2;
      body.scale.set(1, 1, 0.5);
      body.position.y = 0.12;
      g.add(body);
      const pole = new Mesh(new CapsuleGeometry(0.05, 1.7, 3, 5), hull);
      pole.position.set(-2.2, 0.95, 0);
      pole.rotation.z = 0.42;
      g.add(pole);

      const s = new Sprite(
        new SpriteMaterial({
          map: glow,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          color: new Color(0xff9a44),
          opacity: 0,
          fog: false,
        }),
      );
      s.scale.setScalar(2.4);
      s.position.set(-2.9, 1.6, 0);
      g.add(s);
      this.farFires.push(s);

      g.position.set(x, 0, z);
      g.rotation.y = randRange(this.rng, -0.4, 0.4);
      g.scale.setScalar(0.55 + i * 0.06);
      this.group.add(g);
    }
  }

  update(t: number, night: number): void {
    for (let i = 0; i < this.mistPanels.length; i++) {
      const m = this.mistPanels[i];
      m.position.x = Math.sin(t * 0.035 + i * 2.1) * 9;
      const mat = m.material as MeshBasicMaterial;
      mat.opacity = (0.026 + i * 0.007) * (0.5 + night * 0.7);
    }
    for (let i = 0; i < this.farFires.length; i++) {
      const s = this.farFires[i];
      const flick = 0.75 + 0.25 * Math.sin(t * (5.3 + i) + i * 4.7) * Math.sin(t * 2.1 + i);
      (s.material as SpriteMaterial).opacity = night * 0.5 * flick;
      s.scale.setScalar(2.2 + flick * 0.6);
    }
  }
}

function mistTexture(): CanvasTexture {
  const w = 256;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  const rng = makeRng(4242);
  for (let i = 0; i < 46; i++) {
    const x = randRange(rng, 0, w);
    const y = randRange(rng, h * 0.25, h * 0.75);
    const r = randRange(rng, 14, 44);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.09)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fade the edges so panels never show a seam.
  const fade = g.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.16, 'rgba(0,0,0,0)');
  fade.addColorStop(0.84, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  return new CanvasTexture(c);
}

export function fireGlowTexture(): CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,244,214,1)');
  grd.addColorStop(0.14, 'rgba(255,190,110,0.72)');
  grd.addColorStop(0.42, 'rgba(255,120,44,0.26)');
  grd.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  return new CanvasTexture(c);
}

export function softSpriteTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)'): CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  return new CanvasTexture(c);
}
