/** Small deterministic PRNG (mulberry32). Deterministic output keeps visuals testable. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cheap smooth 1-D value noise, good enough for water shimmer and TEM texture. */
export function makeNoise1(seed: number): (x: number) => number {
  const rng = makeRng(seed)
  const table = new Float32Array(256)
  for (let i = 0; i < 256; i++) table[i] = rng() * 2 - 1
  return function noise(x: number): number {
    const i = Math.floor(x)
    const f = x - i
    const a = table[i & 255]
    const b = table[(i + 1) & 255]
    const u = f * f * (3 - 2 * f)
    return a + (b - a) * u
  }
}

/** 2-D value noise built from the same table; used for TEM cytoplasm grain. */
export function makeNoise2(seed: number): (x: number, y: number) => number {
  const rng = makeRng(seed)
  const size = 64
  const table = new Float32Array(size * size)
  for (let i = 0; i < table.length; i++) table[i] = rng()
  const at = (x: number, y: number): number => table[(y & (size - 1)) * size + (x & (size - 1))]
  return function noise(x: number, y: number): number {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v
  }
}
