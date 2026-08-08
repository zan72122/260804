import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  TorusGeometry,
  Vector3,
} from 'three';
import { PAL } from '../core/palette';
import { makeRng, randRange, TAU } from '../core/util';
import {
  hullSection,
  hullSkin,
  HullParams,
  lathe,
  mergeAll,
  roundedBox,
  sheerLine,
  tubeThrough,
} from './geom';

export const HULL: HullParams = {
  length: 8.4,
  halfWidth: 0.82,
  draft: 0.46,
  stations: 34,
  ringPoints: 12,
};

/**
 * The ubune: a long, shallow, black-lacquered river boat. Built as a real
 * shell — outer skin, inner skin, and a rounded rail joining them — so the
 * firelight has an edge to run along and the boat reads as a solid object you
 * could lift out of the water.
 */
export class Boat {
  readonly group = new Group();
  /** Where the usho stands (local space). */
  readonly ushoAnchor = new Vector3(0.02, 0, -2.92);
  /** Where the kagaribi pole is stepped (local space). */
  readonly firePoleFoot = new Vector3(0, 0.12, -3.15);
  /** Perch spots along the rail, in release order, alternating sides. */
  readonly perchSlots: Vector3[] = [];
  /** Fish dropped in here pile up visibly. */
  readonly basket = new Group();
  readonly basketMouth = new Vector3();

  private lantern: PointLight;
  private lanternMesh: Mesh;

  constructor() {
    const lacquer = new MeshPhysicalMaterial({
      color: PAL.hullLacquer,
      roughness: 0.36,
      metalness: 0.07,
      clearcoat: 0.62,
      clearcoatRoughness: 0.3,
    });
    const innerWood = new MeshStandardMaterial({
      color: PAL.hullWood,
      roughness: 0.84,
      metalness: 0.02,
    });
    const railWood = new MeshStandardMaterial({
      color: PAL.hullWoodLight,
      roughness: 0.62,
      metalness: 0.03,
    });
    const iron = new MeshStandardMaterial({ color: PAL.iron, roughness: 0.52, metalness: 0.72 });
    const straw = new MeshStandardMaterial({ color: PAL.basketStraw, roughness: 0.92 });

    // ---- shell ------------------------------------------------------------
    const outer = new Mesh(hullSkin(HULL), lacquer);
    outer.castShadow = true;
    outer.receiveShadow = true;
    this.group.add(outer);

    const inner = new Mesh(
      hullSkin({ ...HULL, inset: 0.9, topTrim: 0.94, flip: true }),
      innerWood,
    );
    inner.receiveShadow = true;
    this.group.add(inner);

    // ---- rail (the bevel that carries the firelight) ----------------------
    const railPts = [
      ...sheerLine(HULL, -1, 30, 0.95),
      ...sheerLine(HULL, 1, 30, 0.95).reverse(),
    ];
    const rail = new Mesh(tubeThrough(railPts, 0.062, 7, true), railWood);
    rail.castShadow = true;
    this.group.add(rail);

    // A second, thinner beading just below the rail: layered geometry.
    const beadPts = [
      ...sheerLine(HULL, -1, 26, 0.99).map((p) => p.clone().setY(p.y - 0.13)),
      ...sheerLine(HULL, 1, 26, 0.99).map((p) => p.clone().setY(p.y - 0.13)).reverse(),
    ];
    this.group.add(new Mesh(tubeThrough(beadPts, 0.026, 6, true), railWood));

    // ---- deck planks ------------------------------------------------------
    this.group.add(new Mesh(this.deckPlanks(), innerWood));

    // ---- thwarts ----------------------------------------------------------
    for (const z of [-1.35, 0.55, 2.35]) {
      const t = 0.5 - z / HULL.length;
      const sec = hullSection(t, HULL);
      const plank = new Mesh(roundedBox(sec.halfW * 1.92, 0.09, 0.36, 0.035), railWood);
      plank.position.set(0, sec.sheer - 0.2, z);
      plank.castShadow = true;
      plank.receiveShadow = true;
      this.group.add(plank);
    }

    // ---- ribs -------------------------------------------------------------
    const ribs: Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const z = -3.0 + i * 1.0;
      const t = 0.5 - z / HULL.length;
      const sec = hullSection(t, HULL);
      if (sec.halfW < 0.2) continue;
      const rib = new Mesh(
        tubeThrough(
          [
            new Vector3(-sec.halfW * 0.88, sec.sheer * 0.9, z),
            new Vector3(-sec.halfW * 0.62, -sec.draft * 0.55, z),
            new Vector3(0, -sec.draft * 0.86, z),
            new Vector3(sec.halfW * 0.62, -sec.draft * 0.55, z),
            new Vector3(sec.halfW * 0.88, sec.sheer * 0.9, z),
          ],
          0.028,
          6,
        ),
        railWood,
      );
      ribs.push(rib);
    }
    this.group.add(mergeAll(ribs, railWood));

    // ---- perches for the birds -------------------------------------------
    const perchZ = [-2.45, -1.75, -1.05, -0.35, 0.35, 1.05];
    for (let i = 0; i < perchZ.length; i++) {
      const z = perchZ[i];
      const t = 0.5 - z / HULL.length;
      const sec = hullSection(t, HULL);
      const side = i % 2 === 0 ? -1 : 1;
      this.perchSlots.push(new Vector3(side * sec.halfW * 0.94, sec.sheer + 0.06, z));
    }

    // ---- the catch basket -------------------------------------------------
    this.buildBasket(straw, railWood);

    // ---- deck clutter, all of it period-plausible --------------------------
    this.buildRopeCoil();
    this.buildBucket(railWood, iron);
    const { light, mesh } = this.buildLantern();
    this.lantern = light;
    this.lanternMesh = mesh;

    this.group.name = 'ubune';
  }

  /** Longitudinal floorboards with visible seams. */
  private deckPlanks(): BufferGeometry {
    const S = 30;
    const planks = 5;
    const pos: number[] = [];
    const idx: number[] = [];
    let base = 0;
    for (let k = 0; k < planks; k++) {
      const a0 = -1 + (2 * k) / planks + 0.012;
      const a1 = -1 + (2 * (k + 1)) / planks - 0.012;
      const start = base;
      for (let i = 0; i <= S; i++) {
        const t = i / S;
        const sec = hullSection(t, HULL);
        const z = (0.5 - t) * HULL.length;
        const hw = sec.halfW * 0.84;
        const y = -sec.draft * 0.34 + 0.02 + Math.abs(a0 + a1) * 0.5 * 0.03;
        pos.push(a0 * hw, y, z, a1 * hw, y, z);
        base += 2;
      }
      for (let i = 0; i < S; i++) {
        const a = start + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** Woven kago: lathe body plus real staves and hoops so it reads as basketry. */
  private buildBasket(straw: MeshStandardMaterial, wood: MeshStandardMaterial): void {
    const g = new Group();
    const R = 0.52;
    const H = 0.5;
    const body = new Mesh(
      lathe(
        [
          [0.001, 0],
          [R * 0.5, 0],
          [R * 0.62, 0.02],
          [R * 0.84, H * 0.42],
          [R, H * 0.86],
          [R * 1.02, H],
        ],
        24,
      ),
      straw.clone(),
    );
    (body.material as MeshStandardMaterial).side = 2;
    body.receiveShadow = true;
    body.castShadow = true;
    g.add(body);

    const weave = new MeshStandardMaterial({ color: 0x6b4f28, roughness: 0.95 });
    const basketry: Mesh[] = [];
    // Horizontal weave hoops.
    for (let i = 0; i < 5; i++) {
      const y = 0.06 + i * 0.104;
      const rr = R * (0.66 + (y / H) * 0.36);
      const hoop = new Mesh(new TorusGeometry(rr, 0.017, 5, 20), weave);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
      basketry.push(hoop);
    }
    // Vertical staves.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const stave = new Mesh(
        tubeThrough(
          [
            new Vector3(Math.cos(a) * R * 0.55, 0.01, Math.sin(a) * R * 0.55),
            new Vector3(Math.cos(a) * R * 0.86, H * 0.5, Math.sin(a) * R * 0.5 * 1.7),
            new Vector3(Math.cos(a) * R * 1.02, H + 0.015, Math.sin(a) * R * 1.02),
          ],
          0.013,
          4,
        ),
        weave,
      );
      basketry.push(stave);
    }
    g.add(mergeAll(basketry, weave));
    // Rim binding.
    const rim = new Mesh(new TorusGeometry(R * 1.03, 0.028, 6, 26), wood);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = H + 0.01;
    g.add(rim);

    const z = 1.5;
    const t = 0.5 - z / HULL.length;
    const sec = hullSection(t, HULL);
    g.position.set(0, -sec.draft * 0.34 + 0.03, z);
    this.basketMouth.set(0, g.position.y + H + 0.06, z);
    g.add(this.basket);
    this.group.add(g);
  }

  private buildRopeCoil(): void {
    const ropeMat = new MeshStandardMaterial({ color: PAL.rope, roughness: 0.95 });
    const pts: Vector3[] = [];
    const turns = 3.4;
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = t * TAU * turns;
      const r = 0.3 - t * 0.1;
      pts.push(new Vector3(Math.cos(a) * r, 0.02 + t * 0.07, Math.sin(a) * r * 0.9));
    }
    const coil = new Mesh(tubeThrough(pts, 0.026, 5), ropeMat);
    const z = 2.55;
    const sec = hullSection(0.5 - z / HULL.length, HULL);
    coil.position.set(-0.22, -sec.draft * 0.34 + 0.03, z);
    coil.castShadow = true;
    this.group.add(coil);
  }

  private buildBucket(wood: MeshStandardMaterial, iron: MeshStandardMaterial): void {
    const g = new Group();
    const body = new Mesh(
      lathe(
        [
          [0.001, 0],
          [0.2, 0],
          [0.21, 0.015],
          [0.245, 0.3],
          [0.25, 0.32],
        ],
        18,
      ),
      wood,
    );
    (body.material as MeshStandardMaterial).side = 2;
    g.add(body);
    const bands: Mesh[] = [];
    for (const y of [0.06, 0.26]) {
      const band = new Mesh(new TorusGeometry(0.215 + y * 0.12, 0.012, 5, 18), iron);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      bands.push(band);
    }
    g.add(mergeAll(bands, iron));
    const z = 2.35;
    const sec = hullSection(0.5 - z / HULL.length, HULL);
    g.position.set(0.3, -sec.draft * 0.34 + 0.03, z);
    g.castShadow = true;
    this.group.add(g);
  }

  /** A small paper lantern: warm secondary light so the stern isn't dead black. */
  private buildLantern(): { light: PointLight; mesh: Mesh } {
    const g = new Group();
    const mat = new MeshStandardMaterial({
      color: 0xf0d09a,
      emissive: 0xff9a44,
      emissiveIntensity: 0.55,
      roughness: 0.85,
    });
    const body = new Mesh(
      lathe(
        [
          [0.001, 0],
          [0.07, 0.005],
          [0.115, 0.07],
          [0.125, 0.16],
          [0.1, 0.25],
          [0.06, 0.29],
          [0.001, 0.295],
        ],
        16,
      ),
      mat,
    );
    g.add(body);
    const ribMat = new MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 });
    const frame: Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const y = 0.06 + i * 0.06;
      const r = 0.098 + Math.sin((y / 0.3) * Math.PI) * 0.028;
      const hoop = new Mesh(new TorusGeometry(r, 0.006, 4, 14), ribMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
      frame.push(hoop);
    }
    const hook = new Mesh(new CylinderGeometry(0.012, 0.012, 0.42, 5), ribMat);
    hook.position.y = 0.5;
    frame.push(hook);
    g.add(mergeAll(frame, ribMat));

    const z = 3.3;
    const sec = hullSection(0.5 - z / HULL.length, HULL);
    g.position.set(-0.16, sec.sheer + 0.02, z);
    g.scale.setScalar(0.72);
    this.group.add(g);

    const light = new PointLight(0xffa04a, 0.75, 3.6, 2);
    light.position.set(-0.16, sec.sheer + 0.14, z);
    this.group.add(light);
    return { light, mesh: body };
  }

  update(t: number): void {
    const flick = 0.86 + 0.14 * Math.sin(t * 3.1) * Math.sin(t * 1.37 + 1.2);
    this.lantern.intensity = 0.7 * flick;
    (this.lanternMesh.material as MeshStandardMaterial).emissiveIntensity = 0.5 * flick;
  }

  /** World-space helper for anchors that live in boat-local space. */
  toWorld(local: Vector3, out = new Vector3()): Vector3 {
    return out.copy(local).applyMatrix4(this.group.matrixWorld);
  }

  addToBasket(o: Object3D, index: number): void {
    const rng = makeRng(1000 + index * 37);
    const layer = Math.floor(index / 5);
    const a = randRange(rng, 0, TAU);
    const r = randRange(rng, 0.03, 0.3) * (1 - layer * 0.12);
    o.position.set(Math.cos(a) * r, 0.07 + layer * 0.055 + randRange(rng, 0, 0.02), Math.sin(a) * r);
    o.rotation.set(randRange(rng, -0.4, 0.4), randRange(rng, 0, TAU), randRange(rng, -0.5, 0.5));
    this.basket.add(o);
  }
}
