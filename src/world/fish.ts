import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { ellipsoid, lathe, mergeAll } from './geom';
import { makeRng, randRange, TAU } from '../core/util';

export type FishKind = 'ayu' | 'oikawa' | 'amago' | 'zako';

export const FISH_KINDS: FishKind[] = ['ayu', 'oikawa', 'amago', 'zako'];

interface Spec {
  body: number;
  belly: number;
  mark: number;
  fin: number;
  len: number;
  girth: number;
}

/**
 * The four fish a Nagara-gawa cormorant actually brings up. They are tiny on
 * screen, so each one is separated by silhouette and by one strong colour note
 * rather than by detail: the ayu's yellow cheek, the oikawa's spawning bands,
 * the amago's red spots.
 */
const SPECS: Record<FishKind, Spec> = {
  ayu: { body: 0x4d6247, belly: 0xd9dfe0, mark: 0xe8c24a, fin: 0x8f9a7c, len: 0.23, girth: 0.043 },
  oikawa: {
    body: 0x38607a,
    belly: 0xdfe4e6,
    mark: 0xc9607a,
    fin: 0x7a8fa0,
    len: 0.18,
    girth: 0.04,
  },
  amago: {
    body: 0x5a5240,
    belly: 0xdcd6c8,
    mark: 0xd0512e,
    fin: 0x8d8266,
    len: 0.21,
    girth: 0.045,
  },
  zako: { body: 0x8b93a0, belly: 0xe6ecf0, mark: 0xb9c4cf, fin: 0x9aa4b0, len: 0.15, girth: 0.033 },
};

/** Fish point along -Z, like everything else that swims in this scene. */
export function makeFish(kind: FishKind, seed = 1): Group {
  const s = SPECS[kind];
  const rng = makeRng(seed * 977 + 13);
  const parent = new Group();

  // Colour lives in vertex colours: a fish is a dozen small painted pieces and
  // there can be a dozen fish in the basket, so they all share one material.
  const bodyMat = new MeshStandardMaterial({ color: new Color(s.body) });
  const bellyMat = new MeshStandardMaterial({ color: new Color(s.belly) });
  const finMat = new MeshStandardMaterial({ color: new Color(s.fin) });
  const markMat = new MeshStandardMaterial({ color: new Color(s.mark) });
  const parts: Mesh[] = [];

  // Body: a fusiform back over a brighter belly, so it flashes when it turns.
  const body = new Mesh(ellipsoid(s.girth, s.girth * 1.22, s.len * 0.5, 14), bodyMat);
  parts.push(body);
  const belly = new Mesh(ellipsoid(s.girth * 0.86, s.girth * 0.72, s.len * 0.45, 12), bellyMat);
  belly.position.y = -s.girth * 0.52;
  parts.push(belly);

  // Snout.
  const head = new Mesh(ellipsoid(s.girth * 0.62, s.girth * 0.78, s.len * 0.2, 12), bodyMat);
  head.position.z = -s.len * 0.46;
  parts.push(head);

  // Tail: forked, and thin enough to catch the fire from behind.
  const tail = new Mesh(
    lathe(
      [
        [0.002, 0],
        [s.girth * 0.5, 0.01],
        [s.girth * 1.5, s.len * 0.2],
        [s.girth * 1.15, s.len * 0.24],
        [0.002, s.len * 0.16],
      ],
      6,
    ),
    finMat,
  );
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(1, 1, 0.22);
  tail.position.z = s.len * 0.44;
  parts.push(tail);

  // Dorsal + pectorals.
  const dorsal = new Mesh(ellipsoid(s.girth * 0.08, s.girth * 0.7, s.len * 0.13, 8), finMat);
  dorsal.position.set(0, s.girth * 1.1, -s.len * 0.02);
  parts.push(dorsal);
  for (const side of [-1, 1]) {
    const pec = new Mesh(ellipsoid(s.girth * 0.5, s.girth * 0.07, s.len * 0.09, 8), finMat);
    pec.position.set(side * s.girth * 0.8, -s.girth * 0.25, -s.len * 0.2);
    pec.rotation.z = side * 0.5;
    parts.push(pec);
  }

  // Species mark.
  if (kind === 'ayu') {
    const cheek = new Mesh(ellipsoid(s.girth * 0.12, s.girth * 0.3, s.len * 0.06, 8), markMat);
    cheek.position.set(s.girth * 0.55, s.girth * 0.2, -s.len * 0.3);
    parts.push(cheek);
    const cheek2 = cheek.clone();
    cheek2.position.x *= -1;
    parts.push(cheek2);
  } else if (kind === 'oikawa') {
    for (let i = 0; i < 4; i++) {
      const band = new Mesh(ellipsoid(s.girth * 1.03, s.girth * 0.9, s.len * 0.022, 10), markMat);
      band.position.z = -s.len * 0.2 + i * s.len * 0.14;
      parts.push(band);
    }
  } else if (kind === 'amago') {
    for (let i = 0; i < 7; i++) {
      const spot = new Mesh(ellipsoid(s.girth * 0.06, s.girth * 0.09, s.girth * 0.09, 6), markMat);
      const side = i % 2 === 0 ? 1 : -1;
      spot.position.set(
        side * s.girth * 0.92,
        randRange(rng, -0.2, 0.6) * s.girth,
        randRange(rng, -0.35, 0.4) * s.len,
      );
      parts.push(spot);
    }
  }

  const mesh = mergeAll(parts, FISH_MAT, true);
  parent.add(mesh);
  parent.rotation.z = randRange(rng, -0.1, 0.1);
  return parent;
}

/** Wet, faintly metallic scales. Shared by every fish in the game. */
const FISH_MAT = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.3,
  metalness: 0.45,
});

/**
 * A handful of fish glimpsed under the surface: dark shapes with the odd
 * silver flash. They give the river something worth diving for.
 */
export class FishShoal {
  readonly group = new Group();
  private fish: { m: Group; base: Vector3; phase: number; speed: number; r: number }[] = [];

  constructor(count = 14) {
    const rng = makeRng(5150);
    for (let i = 0; i < count; i++) {
      const kind = FISH_KINDS[i % FISH_KINDS.length];
      const m = makeFish(kind, i + 3);
      m.scale.setScalar(randRange(rng, 0.75, 1.15));
      const base = new Vector3(
        randRange(rng, -7.5, 7.5),
        randRange(rng, -1.7, -0.85),
        randRange(rng, -12, -2),
      );
      m.position.copy(base);
      this.fish.push({
        m,
        base,
        phase: randRange(rng, 0, TAU),
        speed: randRange(rng, 0.25, 0.6),
        r: randRange(rng, 0.5, 1.8),
      });
      this.group.add(m);
    }
  }

  update(t: number): void {
    for (const f of this.fish) {
      const a = f.phase + t * f.speed;
      f.m.position.set(
        f.base.x + Math.cos(a) * f.r,
        f.base.y + Math.sin(a * 1.7) * 0.12,
        f.base.z + Math.sin(a) * f.r * 0.7,
      );
      f.m.rotation.y = -a + Math.PI / 2;
      f.m.rotation.z = Math.sin(a * 3.1) * 0.18;
    }
  }
}
