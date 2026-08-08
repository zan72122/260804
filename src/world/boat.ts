import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
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
      side: DoubleSide,
    });
    const iron = new MeshStandardMaterial({ color: PAL.iron, roughness: 0.52, metalness: 0.72 });
    // Lathed shells are open at the back; show both faces.
    const straw = new MeshStandardMaterial({ color: PAL.basketStraw, roughness: 0.92 });

    // ---- shell ------------------------------------------------------------
    const outer = new Mesh(hullSkin(HULL), lacquer);
    outer.castShadow = true;
    outer.receiveShadow = true;
    this.group.add(outer);

    const inner = new Mesh(hullSkin({ ...HULL, inset: 0.9, topTrim: 0.94, flip: true }), innerWood);
    inner.receiveShadow = true;
    this.group.add(inner);

    // ---- rail (the bevel that carries the firelight) ----------------------
    const railPts = [...sheerLine(HULL, -1, 30, 0.95), ...sheerLine(HULL, 1, 30, 0.95).reverse()];
    const rail = new Mesh(tubeThrough(railPts, 0.062, 7, true), railWood);
    rail.castShadow = true;
    this.group.add(rail);

    // A second, thinner beading just below the rail: layered geometry.
    const beadPts = [
      ...sheerLine(HULL, -1, 26, 0.99).map((p) => p.clone().setY(p.y - 0.13)),
      ...sheerLine(HULL, 1, 26, 0.99)
        .map((p) => p.clone().setY(p.y - 0.13))
        .reverse(),
    ];
    this.group.add(new Mesh(tubeThrough(beadPts, 0.026, 6, true), railWood));

    // ---- deck planks ------------------------------------------------------
    this.group.add(new Mesh(this.deckPlanks(), innerWood));

    // ---- thwarts ----------------------------------------------------------
    for (const z of [-1.35, 0.55, 2.35]) {
      const t = 0.5 - z / HULL.length;
      const sec = hullSection(t, HULL);
      const plank = new Mesh(roundedBox(sec.halfW * 1.92, 0.09, 0.36, 0.035), innerWood);
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
    const perchZ = [-3.0, -2.62, -2.24, -1.86, -1.48, -1.1];
    for (let i = 0; i < perchZ.length; i++) {
      const z = perchZ[i];
      const t = 0.5 - z / HULL.length;
      const sec = hullSection(t, HULL);
      // Starboard is the camera side in both layouts, so the perches nearest
      // the stern — the ones most likely to slide off the edge of a tall
      // portrait frame — go there.
      const side = i % 2 === 0 ? 1 : -1;
      // Slightly inboard of the rail, which both looks like a bird gripping
      // the gunwale and keeps the port-side perches clear of the frame edge.
      this.perchSlots.push(new Vector3(side * sec.halfW * 0.84, sec.sheer + 0.05, z));
    }

    // ---- the catch basket -------------------------------------------------
    this.buildBasket(straw, railWood);

    // ---- deck clutter, all of it period-plausible --------------------------
    this.buildRopeCoil();
    this.buildBucket(railWood, iron);

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
      straw,
    );
    straw.side = DoubleSide;
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

    const z = 0.85;
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
    const z = -0.25;
    const sec = hullSection(0.5 - z / HULL.length, HULL);
    coil.position.set(-0.26, -sec.draft * 0.34 + 0.03, z);
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
    g.add(body);
    const bands: Mesh[] = [];
    for (const y of [0.06, 0.26]) {
      const band = new Mesh(new TorusGeometry(0.215 + y * 0.12, 0.012, 5, 18), iron);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      bands.push(band);
    }
    g.add(mergeAll(bands, iron));
    const z = 0.15;
    const sec = hullSection(0.5 - z / HULL.length, HULL);
    g.position.set(0.32, -sec.draft * 0.34 + 0.03, z);
    g.castShadow = true;
    this.group.add(g);
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
    o.position.set(
      Math.cos(a) * r,
      0.07 + layer * 0.055 + randRange(rng, 0, 0.02),
      Math.sin(a) * r,
    );
    o.rotation.set(randRange(rng, -0.4, 0.4), randRange(rng, 0, TAU), randRange(rng, -0.5, 0.5));
    this.basket.add(o);
  }
}
